// Zakázky (rozvoz jídla), objevování památek, navigace k cíli.
import { DRIVABLE_MAX } from '../config.js';
import { makeBeacon, makePedMesh } from '../entities/models.js';
import { LANDMARK_INFO } from './landmarks.js';
import { curbStop, DEMO_ADDRESS, DEMO_DRIVE, DEMO_DROP, DEMO_FOOT, DEMO_NAME, DEMO_STOPS, taxiJourney } from './work-sites.js';

const _road = {};
const FOOD_KIND = ['restaurace', 'rychlé občerstvení', 'kavárna', 'hospoda'];
export const JOB_NAMES = { food: 'Rozvoz jídla', taxi: 'Taxi', car: DEMO_NAME, transit: DEMO_NAME };
const RESULT = { paid: 'Dokončeno', cancelled: 'Zrušeno', interrupted: 'Přerušeno', expired: 'Vypršel čas' };
const plain = (value) => String(value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const clock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const five = (amount) => Math.round(amount / 5) * 5;

export function resultText(result) {
  const { type, state, amount, note } = result;
  const mode = type === 'car' ? ' autem' : type === 'transit' ? ' MHD' : '';
  return `${JOB_NAMES[type]}${mode} · ${RESULT[state]}${amount ? ` · +${amount} Kč` : ''}${note ? ` · ${note}` : ''}`;
}

export class Jobs {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.job = null;
    this.last = null;
    this.waypoint = null;
    this.route = null;          // navigační trasa pro minimapu [x, z, x, z, …]
    this.routeTimer = 0;
    this.beacon = makeBeacon(0xf2b632);
    this.beacon.visible = false;
    game.scene.add(this.beacon);
    this.wpBeacon = makeBeacon(0xb07cff);
    this.wpBeacon.visible = false;
    game.scene.add(this.wpBeacon);
    this.landmarks = this.world.meta.landmarks.map(([x, z, name]) => ({ x, z, name, found: false }));
    this.checkTimer = 0;
    this.done = 0;
  }

  load(saved) {
    if (saved?.active && Object.hasOwn(JOB_NAMES, saved.active)) {
      this.last = { type: saved.active, state: 'interrupted', amount: 0, note: 'Načtení uložené hry' };
    } else if (saved?.last && Object.hasOwn(JOB_NAMES, saved.last.type) && Object.hasOwn(RESULT, saved.last.state)) {
      this.last = saved.last;
    }
  }

  snapshot() { return { active: this.job?.type ?? null, last: this.last }; }

  _snap(x, z) {
    const r = this.world.nearestRoad(x, z, 60, DRIVABLE_MAX, 0, _road, undefined, true);
    return r ? { x: r.x, z: r.z } : { x, z };
  }

  _routeLength(ax, az, bx, bz) {
    const w = this.world;
    const path = w.findPath(w.nearestNode(ax, az, 200), w.nearestNode(bx, bz, 200), 9000);
    if (!path) return Math.hypot(bx - ax, bz - az) * 1.5;
    let len = 0;
    for (const e of path) len += w.eLen[e];
    return Math.max(len, Math.hypot(bx - ax, bz - az));
  }

  /** Klávesa J: vezme novou zakázku, nebo rozpracovanou zruší. */
  toggle() {
    if (this.job) this.end('cancelled', 'Zrušeno hráčem');
    else {
      const error = this.start('food');
      if (error) this.game.hud.toast(error, 'bad');
    }
  }

  start(type) {
    const g = this.game;
    if (g.shifts.active) return 'Nejdřív dokonči nebo zruš směnu MHD.';
    if (this.job) return 'Nejdřív dokonči nebo zruš probíhající zakázku.';
    const canDrive = g.mode === 'car' && g.car.health > 0 && g.car.typeId !== 'police';
    if (type === 'taxi' && !canDrive) return 'Nejdřív nastup do pojízdného osobního auta.';
    let task;
    if (type === 'food') task = this._food();
    if (type === 'taxi') {
      const journey = taxiJourney(this.world, g.focus);
      if (!journey) return 'V okolí teď není dostupná jízda. Zkus to v jiné ulici.';
      task = { ...journey, car: g.car, limit: Math.ceil(journey.len / 7 + 75),
        reward: five(125 + journey.len * 0.15), comfort: 90, speed: 0 };
    }
    if (type === 'car' || type === 'transit') task = this._demo(type);
    if (!task) return type === 'food' ? 'V okolí není dostupný rozvoz.' : 'Trasu teď nelze najít.';
    this.job = { ...task, type, phase: 'pickup', time: type === 'taxi' ? 180 : null };
    this.routeTimer = 0;
    if (!g.save()) {
      this.job = null;
      return g.saveError;
    }
    if (type === 'taxi') {
      this.passenger = makePedMesh(9);
      const { waiting, tx, tz } = task.pick;
      this.passenger.position.set(waiting.x, this.world.groundY(waiting.x, waiting.z), waiting.z);
      this.passenger.rotation.y = Math.atan2(tz, -tx);
      g.scene.add(this.passenger);
    }
    g.audio.coin();
    g.hud.toast(`${JOB_NAMES[type]} · ${task.name}`, 'big');
    return null;
  }

  _food() {
    const g = this.game;
    const meta = this.world.meta;
    const p = g.focus;
    const cands = [];
    for (const f of meta.food) {
      const d = Math.hypot(f[0] - p.x, f[1] - p.z);
      if (d > 90 && d < 1400) cands.push([d, f]);
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a[0] - b[0]);
    const f = cands[Math.floor(Math.random() * Math.min(6, cands.length))][1];
    const pick = this._snap(f[0], f[1]);
    // adresa doručení 0,5–2,6 km od podniku
    let addr = null;
    for (let t = 0; t < 60 && !addr; t++) {
      const a = meta.addresses[Math.floor(Math.random() * meta.addresses.length)];
      const d = Math.hypot(a[0] - f[0], a[1] - f[1]);
      if (d > 500 && d < 2600 && this.world.inBounds(a[0], a[1], 120)) addr = a;
    }
    if (!addr) return;
    const drop = this._snap(addr[0], addr[1]);
    const len = this._routeLength(pick.x, pick.z, drop.x, drop.z);
    return {
      name: f[3], kind: FOOD_KIND[f[2]] || 'podnik',
      pick, drop, label: `${meta.roadNames[addr[2]]} ${addr[3]}`,
      len, limit: Math.round(len / 8.5 + 40), reward: five(90 + len * 0.11),
    };
  }

  _demo(type) {
    const pick = curbStop(this.world, 93.5, 49.6);
    if (!pick) return null;
    const task = { pick, name: 'Dhaba Beas · Dřevěná', label: DEMO_ADDRESS, limit: 1440, reward: 625 };
    if (type === 'car') {
      const park = curbStop(this.world, DEMO_DROP.x, DEMO_DROP.z);
      return park && { ...task, steps: [...DEMO_DRIVE, { ...park, label: 'Zastav u adresy U Velkého rybníka' }], index: 0 };
    }
    const timetable = this.game.transit.timetable;
    const point = (code) => {
      const i = timetable.stops.findIndex((s) => s[3] === code);
      if (i < 0) return null;
      const [label, x, z] = timetable.stops[i];
      return { x, z, label, i, platform: code.split('/')[1] };
    };
    const legs = DEMO_STOPS.map(({ from, to, ...leg }) => ({ ...leg, from: point(from), to: point(to) }));
    return legs.every((leg) => leg.from && leg.to) ? { ...task, legs, index: 0 } : null;
  }

  _clear() {
    if (this.passenger) {
      this.passenger.skeleton.dispose();
      this.game.scene.remove(this.passenger);
    }
    this.passenger = null;
    this.job = null;
    this.routeTimer = 0;
    this.beacon.visible = false;
    this.route = null;
    this.game.hud.mission(null);
  }

  end(state, note, save = true) {
    if (!this.job) return;
    this.last = { type: this.job.type, state, amount: 0, note };
    this._clear();
    if (save) {
      this.game.save();
      this.game.audio.fail();
      this.game.hud.toast(resultText(this.last), 'bad', 5800);
    }
  }

  interrupt(reason, save = true) { this.end('interrupted', reason, save); }

  onExitCar(car) {
    if (this.job?.type === 'taxi' && this.job.car === car && !this.job.pending) this.interrupt('Vystoupil jsi z auta');
  }

  onCrash(impact) {
    const j = this.job;
    if (j?.type === 'taxi' && j.phase === 'drop' && !j.pending && impact > 3) {
      j.comfort = Math.max(0, j.comfort - Math.min(45, 8 + impact * 2));
    }
  }

  onBoard(vehicle) {
    const j = this.job;
    if (j?.type !== 'transit' || j.phase !== 'board') return;
    const leg = j.legs[j.index], { trip } = vehicle.event, at = vehicle.stopIndex;
    if (vehicle.route.type !== leg.type || vehicle.route.ref !== leg.line
        || trip.stops[at]?.stop !== leg.from.i || !vehicle.canBoard
        || !trip.stops.some(({ stop }, i) => i > at && stop === leg.to.i && (trip.times[i * 2] >= 0 || i === trip.stops.length - 1))) {
      this.game.hud.toast(`Potřebuješ linku ${leg.line} ${leg.direction} ze zastávky ${leg.from.label}.`, 'bad');
      return;
    }
    j.vehicle = vehicle;
    j.phase = 'ride';
    this.routeTimer = 0;
  }

  onAlight(vehicle) {
    const j = this.job;
    if (j?.type !== 'transit' || j.vehicle !== vehicle || j.phase !== 'ride') return;
    const leg = j.legs[j.index];
    j.vehicle = null;
    if (vehicle.canAlight && vehicle.event.trip.stops[vehicle.stopIndex]?.stop === leg.to.i) {
      j.index++;
      j.phase = j.index < j.legs.length ? 'board' : 'walk';
    } else {
      j.phase = 'board';
      this.game.hud.toast(`Vystoupil jsi před cílem. Vrať se na zastávku ${leg.from.label}.`, 'bad');
    }
    this.routeTimer = 0;
  }

  _complete() {
    const j = this.job;
    const tip = five(Math.max(0, j.time) / j.limit * (j.type === 'car' || j.type === 'transit' ? 100 : 80));
    const smooth = five(j.comfort ?? 0);
    j.pending = { type: j.type, state: 'paid', amount: j.reward + tip + smooth,
      note: j.type === 'taxi' ? `${j.reward} Kč jízdné + ${tip} Kč za čas + ${smooth} Kč za plynulost`
        : tip ? `${j.reward} Kč odměna + ${tip} Kč spropitné` : '' };
    this.pay();
  }

  pay() {
    const g = this.game, result = this.job?.pending;
    if (!result) return null;
    const key = result.type === 'taxi' ? 'taxiRides' : 'deliveries';
    const stats = { ...g.stats, [key]: (g.stats[key] || 0) + 1 };
    if (!g.commitAccount({ money: g.money + result.amount, stats, job: { active: null, last: result } })) {
      g.hud.toast(g.saveError, 'bad', 5800);
      return g.saveError;
    }
    this.last = result;
    this.done++;
    this._clear();
    g.audio.coin();
    g.hud.toast(resultText(this.last), 'big', 6200);
    return null;
  }

  setWaypoint(x, z, name, stop = false) {
    const walk = this.world.meta.walkingApproaches?.[name];
    this.waypoint = stop ? { x, z } : walk ? { x: walk.at(-2), z: walk.at(-1), walk } : this._snap(x, z);
    this.routeTimer = 0;
    this.game.hud.toast(walk ? 'Cíl nastaven. Modré tečky vedou poslední úsek pěšky.' : 'Cíl nastaven – trasa je na minimapě.');
  }

  get walkRoute() {
    const j = this.job;
    if (!j) return this.waypoint?.walk;
    if (j.type === 'transit' && j.phase === 'walk') return DEMO_FOOT;
    if (j.type === 'transit' && j.phase === 'board') return j.legs[j.index].walk;
    return null;
  }

  target() {
    const j = this.job;
    if (!j) return this.waypoint;
    if (j.phase === 'pickup') return j.pick;
    if (j.phase === 'drive') return j.steps[j.index];
    if (j.phase === 'board') return j.legs[j.index].from;
    if (j.phase === 'ride') return j.legs[j.index].to;
    if (j.phase === 'walk') return DEMO_DROP;
    return j.drop;
  }

  _updateJob(dt, speed) {
    const g = this.game, p = g.focus, j = this.job;
    if (j.pending) {
      g.hud.mission(`<b>${JOB_NAMES[j.type]}</b><br>Cíl splněn. V nabídce Zakázky můžeš zkusit výplatu uložit znovu.`);
      return;
    }
    if (j.type === 'taxi' && (g.car !== j.car || j.car.health <= 0)) {
      this.interrupt('Vůz přestal být pojízdný');
      return;
    }
    if (j.time !== null) {
      j.time -= dt;
      if (j.time <= 0) { this.end('expired', 'Bez odměny'); return; }
    }
    const t = this.target(), d = Math.hypot(t.x - p.x, t.z - p.z);
    const ground = this.world.groundY(t.x, t.z);
    const at = (radius) => d < radius && Math.abs(p.y - ground) < 4.5;
    const foot = g.mode === 'foot', driver = g.mode === 'car' && g.car.health > 0;
    const taxiAt = () => at(6.5) && speed < 1.6;
    const walk = () => foot && at(8) && speed < 5.5;
    let instruction;
    const advance = (phase) => {
      j.phase = phase;
      this.routeTimer = 0;
    };
    this.beacon.visible = true;
    this.beacon.position.set(t.x, ground, t.z);
    switch (j.phase) {
      case 'pickup':
        instruction = j.type === 'taxi' ? `Zastav u zákazníka · <b>${plain(j.name)}</b>`
          : `Vyzvedni jídlo · <b>${plain(j.name)}</b>${j.kind ? ` (${j.kind})` : ''}`;
        if (j.type === 'taxi' ? taxiAt() : j.type === 'food' ? d < 11 && speed < 7 : (foot || driver) && at(10) && speed < 4) {
          j.time = j.limit;
          advance(j.type === 'car' ? 'drive' : j.type === 'transit' ? 'board' : 'drop');
          if (this.passenger) this.passenger.visible = false;
          g.audio.door(p);
          g.hud.toast(j.type === 'taxi' ? `Zákazník nastoupil. Cíl · ${j.label}` : `Jídlo vyzvednuto · ${j.label}`);
        }
        break;
      case 'drop':
        instruction = j.type === 'taxi' ? `Zastav u cíle · <b>${plain(j.label)}</b> · bonus za plynulost ${five(j.comfort)} Kč`
          : `Doruč na adresu <b>${plain(j.label)}</b>`;
        if (j.type === 'taxi') {
          if (dt > 0 && j.speed > 9 && j.speed - speed > 11 * dt) j.comfort = Math.max(0, j.comfort - 5 * dt);
          if (p.skid > 0.45) j.comfort = Math.max(0, j.comfort - 7 * dt);
          j.speed = speed;
        }
        if (j.type === 'taxi' ? taxiAt() : d < 11 && speed < 7) this._complete();
        break;
      case 'drive': {
        const park = j.index === j.steps.length - 1;
        instruction = park ? t.label : `Projeď autem · <b>${t.label}</b>`;
        if (driver && at(park ? 9 : 43) && (!park || speed < 1.6)) {
          if (park) advance('walk');
          else { j.index++; this.routeTimer = 0; }
        }
        break;
      }
      case 'board': {
        const leg = j.legs[j.index];
        instruction = `Nastup na zastávce <b>${leg.from.label}</b> · stanoviště ${leg.from.platform}<br>`
          + `${leg.type === 'tram' ? 'Tramvaj' : 'Autobus'} ${leg.line} ${leg.direction}`;
        break;
      }
      case 'ride':
        instruction = `Vystup na zastávce <b>${t.label}</b>`;
        break;
      case 'walk':
        instruction = `${g.mode === 'car' ? 'Vystup a předej' : 'Pěšky předej'} jídlo · <b>${DEMO_ADDRESS}</b>`;
        if (walk()) this._complete();
        break;
    }
    if (this.job === j && !j.pending) {
      const time = j.time === null ? '' : ` · <span class="timer">${clock(j.time)}</span>`;
      g.hud.mission(`<b>${JOB_NAMES[j.type]}</b><br>${instruction}<br>${Math.round(d)} m${time} · odměna od ${j.reward} Kč`);
    }
  }

  update(dt) {
    const g = this.game, p = g.focus, hud = g.hud;
    const speed = Math.hypot(p.vx || 0, p.vz || 0);
    if (this.job) this._updateJob(dt, speed);
    else if (!g.shifts.active) {
      this.beacon.visible = false;
      hud.mission(null);
    }
    if (this.waypoint) {
      this.wpBeacon.visible = !this.job;
      this.wpBeacon.position.set(this.waypoint.x, this.world.groundY(this.waypoint.x, this.waypoint.z), this.waypoint.z);
      const walk = this.waypoint.walk;
      if ((!walk || g.mode === 'foot') && Math.hypot(this.waypoint.x - p.x, this.waypoint.z - p.z) < (walk ? 7 : 22)) {
        this.waypoint = null; this.wpBeacon.visible = false;
        if (!this.job) { this.route = null; hud.toast('Jsi v cíli.'); }
      }
    } else this.wpBeacon.visible = false;
    const pulse = 1 + Math.sin(performance.now() / 300) * 0.12;
    this.beacon.userData.ring.scale.setScalar(pulse);
    this.wpBeacon.userData.ring.scale.setScalar(pulse);

    // navigační trasa
    this.routeTimer -= dt;
    const tgt = this.target();
    if (!tgt) this.route = null;
    else if (this.routeTimer <= 0) {
      this.routeTimer = 2.2;
      const w = this.world;
      const walk = this.walkRoute;
      const dx = walk ? walk[0] : tgt.x, dz = walk ? walk[1] : tgt.z;
      const atApproach = walk && (Math.hypot(p.x - dx, p.z - dz) < 25
        || (g.mode === 'foot' && Math.hypot(p.x - tgt.x, p.z - tgt.z) < 84));
      let start = w.nearestNode(p.x, p.z, 250, p.y), incoming = -1, sameEdge = false;
      if (g.mode === 'car') {
        const position = w.nearestRoad(p.x, p.z, 10, DRIVABLE_MAX, 0, _road, p.y, true);
        if (position) {
          const forward = position.dx * Math.sin(p.yaw) + position.dz * Math.cos(p.yaw) >= 0;
          const edge = w.edgeOfPt[position.seg];
          if (edge >= 0) incoming = forward ? edge : w.reverseEdge(edge);
          if (incoming >= 0) start = w.eTo[incoming];
          sameEdge = tgt.edge === incoming && Math.hypot(p.x - tgt.x, p.z - tgt.z) < 60;
        }
      }
      const destination = tgt.edge === undefined ? w.nearestNode(dx, dz, 250) : w.eFrom[tgt.edge];
      const ride = this.job?.phase === 'ride' && this.job.vehicle === g.ride ? g.ride : null;
      const path = atApproach || sameEdge || ride ? [] : w.findPath(start, destination, 18000, incoming);
      if (ride) {
        const stop = ride.event.trip.stops.find(({ stop }, i) => i >= ride.stopIndex && stop === tgt.i);
        const pts = [];
        for (let s = ride.s; s < stop?.target[0]; s += 30) {
          const pos = ride.route.posAt(s, ride.side, {});
          pts.push(pos.x, pos.z);
        }
        this.route = [...pts, dx, dz];
      } else if (path) {
        const pts = [];
        for (const e of path) {
          const A = w.eA[e], B = w.eB[e], step = A < B ? 1 : -1;
          for (let k = A; ; k += step) { pts.push(w.rpx[k], w.rpz[k]); if (k === B) break; }
        }
        if (tgt.edge !== undefined && !sameEdge) {
          for (let s = 0; s < tgt.along; s += 8) {
            const pos = w.edgePoint(tgt.edge, s, 0, {});
            pts.push(pos.x, pos.z);
          }
        }
        pts.push(dx, dz);
        this.route = pts;
      } else this.route = [dx, dz];
    }

    // památky
    this.checkTimer -= dt;
    if (this.checkTimer <= 0) {
      this.checkTimer = 0.5;
      for (const lm of this.landmarks) {
        if (lm.found) continue;
        if (Math.hypot(lm.x - p.x, lm.z - p.z) < 75) {
          lm.found = true;
          const n = this.landmarks.filter((l) => l.found).length;
          g.addMoney(150);
          g.audio.discover();
          hud.toast(`Objeveno: ${lm.name} (${n}/${this.landmarks.length}) · +150 Kč`, 'big', 5200);
          const info = LANDMARK_INFO[lm.name];
          if (info) hud.toast(info, '', 7000);
          g.save();
        }
      }
    }
  }

  markers() {
    const out = this.game.garage.markers();
    const t = this.job && this.target();
    if (t) out.push({ x: t.x, z: t.z, color: '#f2b632', size: 6.5 });
    if (this.waypoint) out.push({ x: this.waypoint.x, z: this.waypoint.z, color: '#b07cff', size: 6 });
    return out;
  }
}
