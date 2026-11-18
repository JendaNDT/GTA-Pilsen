import { COLL_CELL, RF } from '../config.js';

const cell = (x, z) => Math.floor(x / COLL_CELL) * 8192 + Math.floor(z / COLL_CELL);
const stopDistance = (distance, dt) => {
  const remaining = Math.max(0, distance);
  return Math.min(Math.sqrt(11 * remaining), dt > 0 ? remaining / dt : Infinity);
};
const clamp = (x, hi) => Math.max(0, Math.min(hi, x));
const exitStart = {}, exitEnd = {};

function addTo(map, key, entry) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(entry);
}

function nearby(map, x, z, radius) {
  const out = [];
  for (let a = Math.floor((x - radius) / COLL_CELL); a <= Math.floor((x + radius) / COLL_CELL); a++) {
    for (let b = Math.floor((z - radius) / COLL_CELL); b <= Math.floor((z + radius) / COLL_CELL); b++) {
      const entries = map.get(a * 8192 + b);
      if (entries) out.push(...entries);
    }
  }
  return out;
}

function intersects(ax, az, bx, bz, crossing) {
  const dx = bx - ax, dz = bz - az;
  const [cx, cz] = crossing.a, ex = crossing.b[0] - cx, ez = crossing.b[1] - cz;
  const determinant = dx * ez - dz * ex;
  if (Math.abs(determinant) < 0.01) return Infinity;
  const t = ((cx - ax) * ez - (cz - az) * ex) / determinant;
  const s = ((cx - ax) * dz - (cz - az) * dx) / determinant;
  return t >= 0 && t <= 1 && s >= -0.05 && s <= 1.05 ? Math.hypot(dx, dz) * t : Infinity;
}

export class Traffic {
  constructor(world, data = {}) {
    this.world = world;
    this.time = 0;
    this.byEdge = new Map();
    this.crossingsByEdge = new Map();
    this.crossingGrid = new Map();
    this.controlGrid = new Map();
    this.chunks = new Map();
    this.groups = [];
    this.crossings = [];
    this.controls = [];
    this.users = new Map();

    // Vzdálenost začátku každého úseku od začátku dopředné hrany.
    this.progress = new Float32Array(world.rpx.length);
    for (let e = 0; e < world.edgeCount; e++) {
      if (world.eA[e] > world.eB[e]) continue;
      for (let p = world.eA[e] + 1, s = 0; p < world.eB[e]; p++) {
        s += Math.hypot(world.rpx[p] - world.rpx[p - 1], world.rpz[p] - world.rpz[p - 1]);
        this.progress[p] = s;
      }
    }

    const signsByRoad = new Map();
    for (const sign of data.signs ?? []) addTo(signsByRoad, sign.road, sign);
    const linesByRoad = new Map();
    for (const line of data.lines ?? []) addTo(linesByRoad, line.road, line);
    const visualControls = [];
    const explicitSignals = new Map();
    for (const entry of data.controls ?? []) {
      if (entry.kind === 'signal' && entry.directedHead) addTo(explicitSignals, entry.road, entry);
    }
    for (const entry of data.controls ?? []) {
      const directions = entry.direction ? [entry.direction] : [1, -1];
      for (const direction of directions) {
        const mapped = this.locate(entry.road, entry.x, entry.z, direction);
        if (!mapped) continue;
        if (entry.kind === 'signal' && mapped.s < 0.18 && !entry.direction) continue;
        if (entry.kind === 'signal' && !entry.directedHead && explicitSignals.get(entry.road)?.some((head) =>
          head.direction === direction && Math.hypot(head.x - entry.x, head.z - entry.z) < 11)) continue;
        const control = { ...entry, ...mapped, direction };
        if (entry.kind === 'signal') {
          if (entry.directedHead) control.head = [control.x, control.z];
          const surveyed = this.surveyedLine(control, linesByRoad.get(entry.road));
          if (surveyed) {
            control.s = surveyed.s;
            control.mark = surveyed.id;
            this.moveToEdge(control);
          } else if (world.eLen[control.edge] - control.s < 1.2) {
            // Uzly přímo v křižovatce dávají polohu křižovatky. Čára je před ní.
            control.s = Math.max(0.1, control.s - 5);
            this.moveToEdge(control);
          }
          this.addToGroup(control);
        }
        if (this.addControl(control)) visualControls.push(control);
      }
    }
    for (const c of data.crossings ?? []) this.addCrossing(c);
    for (const [edge, controls] of this.byEdge) {
      const signals = controls.filter((c) => c.kind === 'signal');
      const active = controls.filter((c) => c.kind === 'signal' || !signals.some((light) =>
        (light.mark && light.mark === c.mark) || Math.abs(light.s - c.s) < 2.5));
      active.sort((a, b) => a.s - b.s);
      this.byEdge.set(edge, active);
    }
    for (const crossings of this.crossingsByEdge.values()) crossings.sort((a, b) => a.s - b.s);

    for (const sign of data.signs ?? []) this.addVisual(sign.x, sign.z, 'signs', sign);
    for (const control of visualControls) {
      const hw = world.r.w[control.road] / 2 + 0.95;
      const { x, z, tx, tz, kind, group, axis } = control;
      if (kind === 'signal') {
        const [hx, hz] = control.head ?? [x, z];
        this.addVisual(hx, hz, 'heads', { x: hx - tz * hw, z: hz + tx * hw, tx, tz, axis, group, kind });
      } else if (!signsByRoad.get(control.road)?.some((sign) => sign.kind === kind
        && sign.direction === control.direction && Math.hypot(sign.x - x, sign.z - z) < 15)) {
        this.addVisual(x, z, 'signs', { x: x - tz * hw, z: z + tx * hw, tx, tz, kind });
      }
      if (!control.mark && kind !== 'yield') {
        const offset = world.r.flags[control.road] & RF.ONEWAY ? -hw + 1 : 0.15;
        this.addVisual(x, z, 'lines', { a: [x - tz * offset, z + tx * offset],
          b: [x - tz * (hw - 1), z + tx * (hw - 1)] });
      }
    }
    for (const mark of data.lines ?? []) this.addVisual(...mark.a, 'lines', mark);
    for (const c of this.crossings) {
      this.addVisual(c.x, c.z, 'crossings', c);
      if (!c.group) continue;
      for (const [end, sign] of [[c.a, 1], [c.b, -1]]) {
        this.addVisual(...end, 'heads', { x: end[0] + c.dz * 1.45, z: end[1] - c.dx * 1.45,
          tx: c.dx * sign, tz: c.dz * sign, kind: 'pedestrian', group: c.group });
      }
    }
  }

  locate(road, x, z, direction) {
    const w = this.world;
    let result = null, best = 100;
    for (let p = w.rOff[road]; p < w.rOff[road + 1] - 1; p++) {
      let edge = w.edgeOfPt[p];
      if (edge < 0) continue;
      const ax = w.rpx[p], az = w.rpz[p];
      const dx = w.rpx[p + 1] - ax, dz = w.rpz[p + 1] - az;
      const length = Math.hypot(dx, dz);
      if (length < 0.05) continue;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (length * length), 1);
      const cx = ax + dx * t, cz = az + dz * t;
      let s = this.progress[p] + length * t;
      if (direction < 0) {
        s = w.eLen[edge] - s;
        edge = w.reverseEdge(edge);
        if (edge < 0) continue;
      }
      const score = Math.hypot(x - cx, z - cz) + (s < 0.15 ? 0.025 : 0);
      if (score < best) {
        result = { edge, s: clamp(s, w.eLen[edge]), x: cx, z: cz, tx: direction * dx / length, tz: direction * dz / length };
        best = score;
      }
    }
    return best < 15 ? result : null;
  }

  moveToEdge(control) {
    const pos = {};
    this.world.edgePoint(control.edge, control.s, 0, pos);
    Object.assign(control, pos);
  }

  surveyedLine(control, lines = []) {
    let best = 11, result = null;
    for (const line of lines) {
      const x = (line.a[0] + line.b[0]) / 2, z = (line.a[1] + line.b[1]) / 2;
      const dx = x - control.x, dz = z - control.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= best || dz * control.tx - dx * control.tz < -0.5) continue;
      const at = this.locate(control.road, x, z, control.direction);
      if (!at || at.edge !== control.edge || at.s < 0.18) continue;
      best = distance;
      result = { s: at.s, id: line.id };
    }
    return result;
  }

  addVisual(x, z, kind, entry) {
    const ci = this.world.chunkIndex(x, z);
    if (ci < 0) return;
    if (!this.chunks.has(ci)) this.chunks.set(ci, { signs: [], heads: [], crossings: [], lines: [] });
    this.chunks.get(ci)[kind].push(entry);
  }

  addControl(control) {
    const list = this.byEdge.get(control.edge);
    if (list?.some((c) => c.kind === control.kind && Math.abs(c.s - control.s) < 2.0)) return false;
    control.width = this.world.r.w[control.road];
    this.controls.push(control);
    addTo(this.byEdge, control.edge, control);
    addTo(this.controlGrid, cell(control.x, control.z), control);
    return true;
  }

  addToGroup(control) {
    const w = this.world, n = w.eTo[control.edge];
    const x = w.nodeX[n], z = w.nodeZ[n];
    const nearJunction = w.eLen[control.edge] - control.s < 27 && w.outStart[n + 1] - w.outStart[n] >= 2;
    const gx = nearJunction ? x : control.x, gz = nearJunction ? z : control.z;
    let group = this.groups.find((g) => Math.hypot(g.x - gx, g.z - gz) <= 38);
    if (!group) {
      group = { id: this.groups.length, x: gx, z: gz, tx: control.tx, tz: control.tz,
        timeOffset: (Math.abs(gx * 0.37 + gz * 0.61)) % 90, greenTime: 14 + (Math.abs(Math.floor(gx + gz)) % 4),
        hasSecond: false, crossings: [], clearance: 0 };
      this.groups.push(group);
    }
    control.group = group;
    control.axis = Math.abs(group.tx * control.tx + group.tz * control.tz) > 0.7 ? 0 : 1;
    if (control.axis === 1) group.hasSecond = true;
  }

  addCrossing(entry) {
    const [ax, az] = entry.a, [bx, bz] = entry.b;
    const length = Math.hypot(bx - ax, bz - az);
    if (length < 1.4) return;
    const x = (ax + bx) / 2, z = (az + bz) / 2;
    const crossing = { ...entry, x, z, length, dx: (bx - ax) / length, dz: (bz - az) / length, group: null };
    const candidates = nearby(this.controlGrid, x, z, 34).filter((c) => c.group
      && Math.hypot(c.x - x, c.z - z) < (entry.signal ? 35 : 16)
      && Math.abs(c.tx * crossing.dx + c.tz * crossing.dz) < 0.65);
    if (entry.signal || (entry.source === 'plzen' && candidates.some((c) => c.road === entry.road))) {
      const nearbyControl = candidates.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
      if (nearbyControl) {
        crossing.group = nearbyControl.group;
        crossing.group.crossings.push(crossing);
        crossing.group.clearance = Math.max(crossing.group.clearance, Math.ceil(length / 1.15) + 2);
      }
    }
    this.crossings.push(crossing);
    addTo(this.crossingGrid, cell(x, z), crossing);
    for (const direction of [1, -1]) {
      const edge = this.locate(entry.road, x, z, direction);
      if (edge) addTo(this.crossingsByEdge, edge.edge, { crossing, s: edge.s });
    }
  }

  phase(group, time = this.time) {
    const green = group.greenTime, road = green + 5;
    const vehicleTime = road * (group.hasSecond ? 2 : 1);
    const walkTime = group.crossings.length ? 9 : 0;
    const walkStart = vehicleTime + (walkTime ? 2 : 0);
    const t = (time + group.timeOffset) % (walkStart + walkTime + group.clearance + 3);
    if (t < vehicleTime) {
      const axis = Math.floor(t / road);
      const within = t % road;
      if (within < green) return axis === 0 ? 'green0' : 'green1';
      if (within < green + 2) return axis === 0 ? 'amber0' : 'amber1';
    }
    if (t >= walkStart && t < walkStart + walkTime) return 'walk';
    return 'red';
  }

  light(head) {
    const phase = this.phase(head.group);
    if (head.kind === 'pedestrian') return phase === 'walk' ? 'green' : 'red';
    const axis = head.axis ?? 0;
    if (this.groupOccupied(head.group)) return 'red';
    if (phase === 'green' + axis) return 'green';
    return phase === 'amber' + axis ? 'amber' : 'red';
  }

  tick(dt, player = null) {
    this.time += dt;
    if (this.player && this.player !== player) this.users.delete(this.player);
    this.player = player;
    if (!player) return;
    const cross = nearby(this.crossingGrid, player.x, player.z, 7).find((c) => {
      const dx = player.x - c.a[0], dz = player.z - c.a[1];
      const s = dx * c.dx + dz * c.dz;
      return s > 0.65 && s < c.length - 0.65 && Math.abs(dx * c.dz - dz * c.dx) <= 1.65
        && Math.abs(player.y - this.world.groundY(player.x, player.z, player.y)) < 1.2;
    });
    if (cross) this.users.set(player, cross);
    else this.users.delete(player);
  }

  groupOccupied(group) {
    // Poslední chodec drží kolizní směry na červené, i když už vypršela běžná vyklizovací doba.
    for (const crossing of this.users.values()) if (crossing.group === group) return true;
    return false;
  }

  canWalk(crossing, cars = []) {
    if (crossing.group) return this.phase(crossing.group) === 'walk';
    const { x, z, dx, dz } = crossing;
    return !cars.some((car) => {
      if (car.mode === 'parked') return false;
      const vx = car.vx || 0, vz = car.vz || 0;
      const speed = Math.hypot(vx, vz), distance = Math.hypot(car.x - x, car.z - z);
      const ahead = intersects(car.x, car.z, car.x + vx * 1.6, car.z + vz * 1.6, crossing);
      return (speed < 0.6 && distance < 6 && Math.abs((car.x - x) * dz - (car.z - z) * dx) < 2.2)
        || ahead < Infinity;
    });
  }

  drivingRule(car, control, distance, dt, limit, others, extra = [], stopping) {
    const signal = control.kind === 'signal';
    const speed = car.speed ?? car.v;
    const state = car.trafficStop?.rule === control ? car.trafficStop
      : (car.trafficStop = { rule: control, held: 0, ready: Infinity });
    let stop;
    if (signal) {
      const color = this.light(control);
      stop = color === 'red' || (color === 'amber' && speed ** 2 < 11 * Math.max(0, distance));
    } else {
      if (distance < 0.3 && speed < 0.18) state.held += dt;
      const ready = control.kind === 'yield' || state.held >= 0.65;
      if (ready && state.ready === Infinity && distance < 4) state.ready = this.time;
      stop = !ready || (distance < 22 && this.conflict(car, control, others, extra));
    }
    if (stop) stopping?.(distance + 0.45);
    return stop ? Math.min(limit, stopDistance(distance, dt)) : limit;
  }

  conflict(car, control, others, extra) {
    const w = this.world;
    const junction = w.eTo[control.edge];
    const x = w.nodeX[junction], z = w.nodeZ[junction];
    if (Math.hypot(x - control.x, z - control.z) > 36) return false;
    const priority = (other) => {
      if (other === car || other.mode === 'parked' || Math.abs(other.y - car.y) > 3) return false;
      const dx = x - other.x, dz = z - other.z, distance = Math.hypot(dx, dz);
      if (distance < 3.6) return true;
      if (distance > 34) return false;
      if (other.edge === car.edge) return false;
      const speed = Math.hypot(other.vx || 0, other.vz || 0);
      // Auto z jiné vedlejší cesty, které už čeká, účastní se pořadí příjezdu.
      const wait = other.trafficStop;
      if (speed < 0.25 && wait && wait.rule.kind !== 'signal'
          && Math.hypot(wait.rule.x - other.x, wait.rule.z - other.z) < 5) {
        const mine = car.trafficStop;
        return wait.ready < mine.ready || (wait.ready === mine.ready && wait.rule.edge < control.edge);
      }
      const closing = (dx * (other.vx || 0) + dz * (other.vz || 0)) / distance;
      return closing > 0.25 && distance / closing < 3;
    };
    return others.some(priority) || extra.some(priority);
  }

  exitBlocked(car, control, others, extra) {
    const w = this.world;
    const junction = w.eLen[car.edge] - control.s <= 27 && car.next >= 0;
    const carLength = car.halfLen * 2 + 1.4;
    const requiredEnd = (edge, start, base) => {
      let clearance = start + base;
      for (const { crossing, s } of this.crossingsByEdge.get(edge) ?? []) {
        const sameSignal = crossing.group && crossing.group === control.group;
        if (s >= start - 1 && (sameSignal ? s <= start + 30 : junction && s <= start + 12)) {
          clearance = Math.max(clearance, s + 2);
        }
      }
      return clearance + carLength;
    };
    if (!junction) {
      return this.laneOccupied(car, car.edge, car.lane, control.s, requiredEnd(car.edge, control.s, 7), others, extra);
    }
    if (this.laneOccupied(car, car.edge, car.lane, control.s, w.eLen[car.edge], others, extra)) return true;

    let edge = car.next, lane = car.nextLane, end = requiredEnd(edge, 0, 5);
    // Silniční graf někdy dělí výjezd na několik krátkých spojek.
    for (let links = 0; links < 4; links++) {
      const move = car.exitPlan[links];
      const continues = move?.from === edge && move.to >= 0;
      const length = w.eLen[edge];
      const connector = continues && length < 12;
      if (this.laneOccupied(car, edge, lane, 0, connector ? length : end, others, extra)) return true;
      if (!continues || !connector && end <= length) break;
      end = Math.max(end - length, requiredEnd(move.to, 0, connector ? 5 : 0));
      edge = move.to;
      lane = move.lane;
    }
    return false;
  }

  laneOccupied(car, edge, lane, start, end, others, extra) {
    const w = this.world;
    end = Math.min(w.eLen[edge], end);
    w.edgePoint(edge, start, lane, exitStart);
    // Krátké kroky kopírují i zakřivený výjezd při odbočení.
    for (let s = start; s < end; s += 4) {
      w.edgePoint(edge, Math.min(s + 4, end), lane, exitEnd);
      const dx = exitEnd.x - exitStart.x, dz = exitEnd.z - exitStart.z;
      const length = Math.hypot(dx, dz);
      if (length > 0.01) {
        const tx = dx / length, tz = dz / length;
        const inLane = (other) => {
          if (other === car || Math.abs((other.y ?? car.y) - car.y) > 3) return false;
          const ox = other.x - exitStart.x, oz = other.z - exitStart.z;
          const width = other.radius ?? 1;
          const half = other.halfLen ?? width;
          const reachBound = length + Math.max(width, half) + car.radius + 0.15;
          if (Math.abs(ox) > reachBound || Math.abs(oz) > reachBound) return false;
          // Plynule odjíždějící vůz ve stejném pruhu řidič sleduje s odstupem.
          // Čekání až na jeho úplné vyjetí by na zelenou pouštělo auta po jednom.
          const vx = other.vx || 0, vz = other.vz || 0;
          if (vx * tx + vz * tz > 2 && Math.abs(vx * tz - vz * tx) < 0.5 &&
              (other.physical?.input?.targetSpeed ?? Infinity) > 2) return false;
          const alignment = Number.isFinite(other.yaw) ? Math.abs(Math.sin(other.yaw) * tx + Math.cos(other.yaw) * tz) : 1;
          const across = Math.sqrt(Math.max(0, 1 - alignment ** 2));
          const along = ox * tx + oz * tz;
          // Konec stojícího vozu může přesahovat do výjezdu i s jeho středem za ním.
          const reach = Math.max(half * alignment, width * across);
          return along + reach > 0 && along - reach < length &&
            Math.abs(ox * tz - oz * tx) < car.radius + Math.max(width * alignment, half * across) + 0.15;
        };
        if (others.some(inLane) || extra.some(inLane)) return true;
      }
      Object.assign(exitStart, exitEnd);
    }
    return false;
  }

  drivingLimit(car, dt, limit, others, extra, stopping) {
    const w = this.world;
    const lead = car.s + car.halfLen + 0.45;
    const first = this.byEdge.get(car.edge)?.find((c) => c.s >= lead - 0.42);
    const second = !first && car.next >= 0 ? this.byEdge.get(car.next)?.[0] : null;
    const control = first ?? second;
    if (control) {
      const distance = (second ? w.eLen[car.edge] : 0) + control.s - lead;
      if (distance <= 50) {
        limit = this.drivingRule(car, control, distance, dt, limit, others, extra, stopping);
        const hold = stopDistance(distance, dt);
        if (!second && this.exitBlocked(car, control, others, extra)) {
          stopping?.(distance + 0.45);
          limit = Math.min(limit, hold);
        }
      }
    }
    if (!this.users.size) return limit;
    const direction = { x: car.x + Math.sin(car.yaw) * 20, z: car.z + Math.cos(car.yaw) * 20 };
    let turn = null;
    if (car.next >= 0 && w.eLen[car.edge] - car.s < 16) {
      turn = {};
      w.edgePoint(car.next, 14, car.nextLane, turn);
      w.edgePoint(car.edge, w.eLen[car.edge], car.lane, direction);
    }
    const distance = this.pedestrianDistance(car.x, car.z, direction, turn);
    stopping?.(distance - car.halfLen - 0.75);
    return Math.min(limit, stopDistance(distance - car.halfLen - 1.2, dt));
  }

  pedestrianDistance(x, z, ahead, turn) {
    let best = Infinity;
    for (const crossing of this.users.values()) {
      if (Math.hypot(x - crossing.x, z - crossing.z) > 40) continue;
      best = Math.min(best, intersects(x, z, ahead.x, ahead.z, crossing));
      if (turn) best = Math.min(best, Math.hypot(x - ahead.x, z - ahead.z)
        + intersects(ahead.x, ahead.z, turn.x, turn.z, crossing));
    }
    return best;
  }

  controlAhead(x, z, tx, tz, reach, tram = false) {
    let best = reach, result = null;
    for (const c of nearby(this.controlGrid, x, z, reach + 5)) {
      if (!this.byEdge.get(c.edge)?.includes(c)) continue;
      const dx = c.x - x, dz = c.z - z, distance = dx * tx + dz * tz;
      if (distance < -0.35 || distance >= best || c.tx * tx + c.tz * tz < 0.77) continue;
      // Z prostředního pásu je dál ke směrovému návěstidlu. Sousední pěší přechod
      // může končit na ostrůvku ještě před kolejí a řídit jen souběžnou vozovku.
      const besideTrack = tram && c.directedHead && c.tx * tx + c.tz * tz > 0.95;
      if (Math.abs(dx * tz - dz * tx) > Math.max(2.7, c.width / 2 + (besideTrack ? 4.2 : 0.6))) continue;
      best = distance;
      result = { control: c, distance };
    }
    return result;
  }

  transitLimit(vehicle, point, ahead, dt, limit, others) {
    const next = this.controlAhead(point.x, point.z, point.tx, point.tz, 42, vehicle.isTram);
    if (next) {
      // V trase MHD je s poloha čela vozu, nikoli jeho středu.
      limit = this.drivingRule(vehicle, next.control, next.distance - 0.55, dt, limit, others);
    } else vehicle.trafficStop = null;
    const distance = this.pedestrianDistance(point.x, point.z, ahead);
    return Math.min(limit, stopDistance(distance - 1.4, dt));
  }
}
