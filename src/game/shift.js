import { GameClock, formatTime } from './clock.js';
import { shiftName, shiftOffers, shiftResult, shiftStops, SHIFT_LEAD, SHIFT_TYPES } from './shift-plans.js';
import { STOP_DWELL } from './timetable.js';

const STOP_RANGE = 4.5;
const STOP_SPEED = 0.28;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const text = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

// Zrychlení vozu ve směru kolejí nebo jízdního pruhu. Přilnavost omezuje sílu na obvodu kol.
export function shiftMotion(speed, previousAccel, demand, emergency, tram, dt) {
  const adhesion = tram ? 0.24 : 0.62;
  const grip = adhesion * 9.81;
  const effort = demand > 0 ? demand * (tram ? 1.22 : 1.45) : demand * 2.6 - 0.28;
  // Nouzová brzda tramvaje používá i kolejnicovou brzdu.
  const target = emergency ? -Math.min(4.6, grip + (tram ? 2.3 : 0)) : clamp(effort, -grip, grip);
  const change = (emergency ? 9 : 2.8) * dt;
  const accel = clamp(target, previousAccel - change, previousAccel + change);
  const next = clamp(speed + (previousAccel + accel) * 0.5 * dt, 0, 17);
  return { speed: next, accel: next === 0 && accel < 0 ? 0 : accel };
}

export const SHIFT_STATUS = { paid: 'Dokončeno', failed: 'Bez odměny', cancelled: 'Zrušeno', interrupted: 'Přerušeno' };

export class Shifts {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.last = null;
  }

  load(saved) {
    if (typeof saved?.active === 'string') {
      this.last = { name: saved.active, state: 'interrupted', amount: 0, note: 'Načtení uložené hry' };
    } else if (saved?.last && Object.hasOwn(SHIFT_STATUS, saved.last.state)) {
      this.last = saved.last;
    }
  }

  snapshot() { return { active: this.active ? shiftName(this.active.offer) : null, last: this.last }; }
  offers() {
    const { clock, transit } = this.game;
    return shiftOffers(transit.timetable, clock.followsPrague ? new GameClock() : clock);
  }

  start(id) {
    const g = this.game;
    if (g.activities?.active) return 'Nejdřív ukonči zkušební trasu.';
    if (this.active || g.jobs.job) return 'Nejdřív ukonči rozpracovanou zakázku nebo směnu.';
    if (g.wanted) return 'Ke směně nastup až po skončení policejního pátrání.';
    if (g.mode !== 'foot') return 'Před nástupem do směny vystup z vozidla.';
    const offer = this.offers().find((candidate) => candidate.id === id);
    if (!offer) return 'Spoj teď není k dispozici.';
    const stops = shiftStops(offer, g.transit.timetable);
    const run = {
      offer, stops, index: 0, served: 1, dwell: 0, late: 0, early: 0, red: 0,
      ignoredStop: 0, yield: 0, speeding: 0, safetyStops: 0, harsh: 0, passed: new Set(),
      path: [],
    };
    const { trip } = offer.event;
    for (let s = stops[0].s; s < stops.at(-1).s; s += 12) {
      const p = trip.route.posAt(s, 0, {});
      run.path.push(p.x, p.z);
    }
    run.path.push(stops.at(-1).x, stops.at(-1).z);
    this.active = run;
    if (!g.save()) { this.active = null; return g.saveError; }

    g.clock.setTime(offer.departure - SHIFT_LEAD);
    const start = stops[0];
    const at = g._clearSpot(start.x, start.z, 0.5);
    g.player.place(at.x, at.z);
    g.syncClock(true);
    run.vehicle = g.transit.takeShift(offer.event, start.i);
    g._board(run.vehicle);
    g.placeTimer = g.promptTimer = 0;
    g.save();
    this.show();
    return null;
  }

  get stop() { return this.active?.stops[this.active.index]; }

  doors() {
    const g = this.game, run = this.active, stop = this.stop, v = run.vehicle;
    if (run.pending) { this.pay(); return; }
    if (v.doorsOpen) {
      const exchanging = g.peds?.peds.some(p => p.service === v && (p.state === 'board' || p.state === 'alight'));
      if (run.dwell < STOP_DWELL || exchanging) {
        g.hud.toast('Nech cestujícím čas na nástup a výstup.');
        return;
      }
      v.doorsOpen = false;
      v.wait = 0;
      g.audio.transitDoors(v, false);
      if (v.isTram) g.audio.bell(v);
      if (run.index === run.stops.length - 1) { this.complete(true); return; }
      run.departure = { s: v.s, time: stop.depart };
      run.index++;
      v.stopIndex = this.stop.i;
      v.stopTarget = null;
      return;
    }
    if (v.v > STOP_SPEED) { g.hud.toast('Dveře lze otevřít až po zastavení.'); return; }
    if (Math.abs(v.s - stop.s) > STOP_RANGE) { g.hud.toast(`Zastav přímo u stanoviště ${stop.name}.`); return; }
    v.v = 0;
    run.served++;
    run.dwell = 0;
    run.late += Math.max(0, g.clock.now - stop.arrive - 10);
    v.doorsOpen = true;
    v.stopTarget = v.stops[stop.i];
    g.audio.transitDoors(v, true, stop.name);
  }

  drive(v, dt, controls, limit, front, nearby, cars) {
    const run = this.active, g = this.game;
    if (v.doorsOpen || run.pending || v.doorFraction > 0.01) {
      v.v = 0;
      v.shiftAccel = 0;
      if (v.doorsOpen) {
        run.dwell += dt;
        v.wait = Math.max(0, STOP_DWELL - run.dwell);
      }
      return;
    }
    const stop = this.stop, traffic = g.world.traffic;
    const throttle = controls.moveY, emergency = controls.handbrake;
    const motion = shiftMotion(v.v, v.shiftAccel ?? 0, throttle, emergency, v.isTram, dt);
    v.shiftAccel = motion.accel;
    const ahead = v.route.posAt(v.s + 18, v.side, {});
    let clear = traffic.pedestrianDistance(front.x, front.z, ahead) - 1.5;
    for (const other of [...nearby, ...cars]) {
      if (other === v || Math.abs((other.y ?? v.y) - v.y) > 2.8) continue;
      const dx = other.x - front.x, dz = other.z - front.z;
      const along = dx * front.tx + dz * front.tz;
      const across = Math.abs(dx * front.tz - dz * front.tx);
      if (along > 0 && along < 45 && across < 1.55 + (other.radius ?? 1) * 0.35) {
        clear = Math.min(clear, along - (other.halfLen ?? 1) - 1.8);
      }
    }
    const safeSpeed = Math.sqrt(Math.max(0, clear) * 5.2);
    run.gap = clear < Math.max(16, v.v ** 2 / 4 + 8) ? Math.max(0, Math.round(clear)) : null;
    if (v.v > Math.max(3.3, safeSpeed + 0.9) && !run.protected) {
      run.safetyStops++;
      run.protected = true;
      g.hud.toast('Zásah brzdy kvůli překážce před vozem.', 'bad');
    } else if (clear > 18) run.protected = false;
    if (v.v > 3 && (emergency || v.v > safeSpeed + 0.9)) run.harsh += dt;
    v.v = Math.min(motion.speed, safeSpeed);
    if (v.v < motion.speed) v.shiftAccel = Math.min(0, v.shiftAccel);
    const advance = Math.min(v.v * dt, Math.max(0, clear));
    if (v.v > limit + 0.55) run.speeding += dt;

    this.checkTraffic(run, traffic, v, front, advance, dt, cars, nearby);
    v.s = Math.min(v.route.length, v.s + advance);
    if (run.departure && v.s - run.departure.s > 0.8) {
      run.early += Math.max(0, run.departure.time - g.clock.now - 2);
      run.departure = null;
    }
    if (v.s <= stop.s + STOP_RANGE && (stop.i !== run.offer.last || v.s < v.route.length - 0.01)) return;
    g.hud.toast(`Vynechaná zastávka · ${stop.name}`, 'bad');
    if (run.index === run.stops.length - 1) this.complete(false);
    else {
      run.index++;
      v.stopIndex = this.stop.i;
    }
  }

  checkTraffic(run, traffic, v, front, advance, dt, cars, nearby) {
    const next = traffic.transitControl(v, front);
    run.signal = null;
    if (!next || run.passed.has(next.control)) return;
    const { control, distance } = next;
    const color = control.kind === 'signal' ? traffic.light(control) : control.kind;
    run.signal = { color, distance };
    if (run.rule !== control) {
      run.rule = control;
      run.held = 0;
      v.trafficStop = { rule: control, ready: traffic.time };
    }
    if (color === 'stop' && distance <= 5 && v.v <= STOP_SPEED) run.held += dt;
    if (advance <= 0 || distance > advance) return;
    run.passed.add(control);
    traffic.enterJunction(v, control);
    if (color === 'red') { run.red++; this.game.hud.toast('Průjezd na červenou.', 'bad'); }
    if (color === 'stop' && run.held < 0.65) { run.ignoredStop++; this.game.hud.toast('Nezastavil jsi u značky STOP.', 'bad'); }
    if ((color === 'yield' || color === 'stop') && traffic.conflict(v, control, cars, nearby)) {
      run.yield++;
      this.game.hud.toast('Nedání přednosti v jízdě.', 'bad');
    }
  }

  show() {
    const g = this.game, run = this.active;
    if (!run) return;
    if (run.pending) {
      g.hud.mission('<b>Směna vyhodnocena</b><br>Zkus výsledek uložit znovu klávesou F nebo v nabídce Směny MHD.');
      return;
    }
    const stop = this.stop, v = run.vehicle;
    const metres = Math.max(0, Math.round(stop.s - v.s));
    const remaining = Math.ceil(stop.depart - g.clock.now);
    const beforeArrival = Math.ceil(stop.arrive - g.clock.now);
    const stopped = Math.abs(stop.s - v.s) <= STOP_RANGE && v.v <= STOP_SPEED;
    let action = `${metres} m · příjezd ${formatTime(stop.arrive)}${beforeArrival < 0 ? ` · +${-beforeArrival} s` : ''}`;
    if (v?.doorsOpen) {
      const dwell = Math.ceil(STOP_DWELL - run.dwell);
      action = dwell > 0 ? `Dveře otevřeny · obsluha ${dwell} s`
        : run.index === run.stops.length - 1 ? 'F · zavřít dveře a vyhodnotit'
          : remaining > 0 ? `Odjezd za ${remaining} s · F zavře dveře` : 'F · zavřít dveře a vyjet';
    } else if (stopped) action = 'F · otevřít dveře';
    else if (run.departure && g.clock.now < run.departure.time) {
      action = `Odjezd za ${Math.ceil(run.departure.time - g.clock.now)} s`;
    }
    const signal = { red: 'Červená', amber: 'Žlutá', green: 'Zelená', stop: 'STOP', yield: 'Dej přednost',
      off: 'Semafor mimo provoz' };
    const next = !v.doorsOpen && run.signal?.distance > 0
      ? `<br>${signal[run.signal.color]} · ${Math.ceil(run.signal.distance)} m` : '';
    const gap = !v.doorsOpen && run.gap != null ? `<br>Provoz vpředu · ${run.gap} m` : '';
    g.hud.mission(`<b>${SHIFT_TYPES[run.offer.type]} ${run.offer.ref} · směna</b><br>`
      + `${run.index + 1}/${run.stops.length} · <b>${text(stop.name)}</b>${stop.platform ? ` · st. ${text(stop.platform)}` : ''}<br>${action}${next}${gap}`);
  }

  markers() {
    const stop = this.stop;
    return stop ? [{ x: stop.x, z: stop.z, color: '#f2b632', size: 6.5 }] : [];
  }

  complete(terminalServed) {
    const run = this.active;
    run.vehicle.v = 0;
    run.pending = shiftResult(run, terminalServed);
    this.pay();
  }

  pay() {
    const g = this.game, result = this.active?.pending;
    if (!result) return null;
    const stats = result.amount ? { ...g.stats, shifts: (g.stats.shifts || 0) + 1 } : g.stats;
    if (!g.commitAccount({ money: g.money + result.amount, stats, shift: { active: null, last: result } })) {
      g.hud.toast(g.saveError, 'bad');
      return g.saveError;
    }
    this.last = result;
    this.release();
    if (result.amount) g.audio.coin(); else g.audio.fail();
    g.hud.toast(`${SHIFT_STATUS[result.state]} · ${result.score}/100${result.amount ? ` · +${result.amount} Kč` : ''}`, result.amount ? 'big' : 'bad', 6500);
    return null;
  }

  end(state, note, save = true) {
    if (!this.active) return;
    this.last = { name: shiftName(this.active.offer), state, note, amount: 0 };
    this.release();
    if (save) this.game.save();
    this.game.hud.toast(`Směna · ${SHIFT_STATUS[state]}${note ? ` · ${note}` : ''}`, 'bad');
  }

  release() {
    const g = this.game, v = this.active.vehicle;
    this.active = null;
    v.v = 0;
    v.trafficStop = null;
    // Vůz pokračuje v původním spoji, i když hráč končí svůj úsek dřív.
    v.wait = v.doorsOpen ? STOP_DWELL : 0;
    if (!v.doorsOpen && v.s >= v.stops[v.stopIndex][0] - STOP_RANGE) v.stopIndex++;
    if (g.ride === v) g._alight(true);
    g.hud.mission(null);
  }
}
