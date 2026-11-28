import { sectionPose } from './transit-path.js';
import { breakableId } from '../physics/breakables.js';
import { COLL_CELL, CROSSING_HALF_WIDTH, RF } from '../config.js';

const cell = (x, z) => Math.floor(x / COLL_CELL) * 8192 + Math.floor(z / COLL_CELL);
const STOP_DECELERATION = 5.5;
const stopDistance = (distance, dt) => {
  const remaining = Math.max(0, distance);
  return Math.min(Math.sqrt(2 * STOP_DECELERATION * remaining), dt > 0 ? remaining / dt : Infinity);
};
const clamp = (x, hi) => Math.max(0, Math.min(hi, x));
const exitStart = {}, exitEnd = {}, crossingStart = {}, crossingEnd = {};

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

function blocksGreenCrossing(car, crossing, person, deceleration) {
  if (Math.abs(car.y - person?.y) > 3) return false;
  const vx = car.vx || 0, vz = car.vz || 0;
  // Při rovnoměrném brzdění je průměrná rychlost poloviční.
  const factor = car.mode !== 'parked' ? Math.hypot(vx, vz) / (2 * deceleration) : 0;
  return sweepsCrossing(car, crossing, vx * factor, vz * factor);
}

const railFront = {}, railRear = {}, railPose = {};

function transitBlocksCrossing(section, crossing, person) {
  if (Math.abs(section.y - person?.y) > 3) return false;
  if (sweepsCrossing(section, crossing, 0, 0)) return true;
  const distance = section.brakingDistance;
  if (!section.railRoute || !(distance > 0)) return false;
  const reach = distance + section.halfLen + section.radius + crossing.length / 2 + CROSSING_HALF_WIDTH;
  if (Math.abs(section.x - crossing.x) > reach || Math.abs(section.z - crossing.z) > reach) return false;
  // V oblouku se skříň otáčí. Po každém metru ověříme i prostor mezi polohami.
  const steps = Math.ceil(distance);
  let x = section.x, z = section.z;
  railPose.halfLen = section.halfLen;
  railPose.radius = section.radius;
  for (let i = 1; i <= steps; i++) {
    sectionPose(section.railRoute, section.center + distance * i / steps, section.side, section.axle,
      railFront, railRear, railPose);
    if (sweepsCrossing(railPose, crossing, x - railPose.x, z - railPose.z)) return true;
    x = railPose.x;
    z = railPose.z;
  }
  return false;
}

function sweepsCrossing(car, crossing, travelX, travelZ) {
  const dx = car.x - crossing.x, dz = car.z - crossing.z;
  const half = car.halfLen ?? 2, width = car.radius ?? 1;
  const halfCrossing = crossing.length / 2;
  const range = halfCrossing + CROSSING_HALF_WIDTH + half + width;
  if (Math.abs(dx) > range + Math.abs(travelX) || Math.abs(dz) > range + Math.abs(travelZ)) return false;

  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const cx = crossing.dx, cz = crossing.dz;
  const along = Math.abs(fx * cx + fz * cz), across = Math.abs(fx * cz - fz * cx);
  // Na všech čtyřech osách se musí obrysy překrývat ve stejné části brzdné dráhy.
  let enter = 0, leave = 1;
  function overlap(axisX, axisZ, extent) {
    const position = dx * axisX + dz * axisZ;
    const travel = travelX * axisX + travelZ * axisZ;
    if (Math.abs(travel) < 1e-9) return Math.abs(position) < extent;
    const a = (-extent - position) / travel, b = (extent - position) / travel;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    return enter < leave;
  }
  return overlap(cz, -cx, CROSSING_HALF_WIDTH + half * across + width * along)
    && overlap(cx, cz, halfCrossing + half * along + width * across)
    && overlap(fx, fz, half + halfCrossing * along + CROSSING_HALF_WIDTH * across)
    && overlap(fz, -fx, width + halfCrossing * across + CROSSING_HALF_WIDTH * along);
}

export class Traffic {
  constructor(world, data = {}) {
    this.world = world;
    this.time = 0;
    this.byEdge = new Map();
    this.byTransitEdge = new Map();
    this.crossingsByEdge = new Map();
    this.crossingGrid = new Map();
    this.controlGrid = new Map();
    this.chunks = new Map();
    this.groups = [];
    this.crossings = [];
    this.controls = [];
    this.users = new Map();
    this.waitingWalkers = new Map();

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
    const transitSignals = [];
    const explicitSignals = new Map();
    for (const entry of data.controls ?? []) {
      if (entry.kind === 'signal' && entry.directedHead) addTo(explicitSignals, entry.road, entry);
    }
    for (const entry of data.controls ?? []) {
      const directions = entry.direction ? [entry.direction] : [1, -1];
      for (const direction of directions) {
        const transitSignal = entry.directedHead && world.busContraflow?.has(entry.road);
        const mapped = this.locate(entry.road, entry.x, entry.z, direction, transitSignal);
        if (!mapped) continue;
        if (entry.kind === 'signal' && mapped.s < 0.18 && !entry.direction) continue;
        if (entry.kind === 'signal' && !entry.directedHead && explicitSignals.get(entry.road)?.some((head) =>
          head.direction === direction && Math.hypot(head.x - entry.x, head.z - entry.z) < 11)) continue;
        const control = { ...entry, ...mapped, direction };
        if (entry.kind === 'signal') {
          if (entry.directedHead) control.head = [control.x, control.z];
          const surveyed = this.surveyedLine(control, linesByRoad.get(entry.road));
          if (surveyed) {
            if (control.directedHead) control.headS = control.s;
            control.s = surveyed.s;
            control.mark = surveyed.id;
            this.moveToEdge(control);
          } else if (world.eLen[control.edge] - control.s < 1.2) {
            // Uzly přímo v křižovatce dávají polohu křižovatky. Čára je před ní.
            control.s = Math.max(0.1, control.s - 5);
            this.moveToEdge(control);
          }
          if (control.transitOnly) { transitSignals.push(control); continue; }
          this.addToGroup(control);
        }
        if (this.addControl(control)) visualControls.push(control);
      }
    }
    // Připojíme skutečná směrová světla v protisměrných pruzích MHD. Křižovatka
    // přitom zachová společné hodiny svých ostatních návěstidel.
    for (const control of transitSignals) {
      this.addToGroup(control);
      if (this.addControl(control)) visualControls.push(control);
    }
    for (const c of data.crossings ?? []) this.addCrossing(c);
    this.joinSplitCrossings();
    for (const [edge, controls] of this.byEdge) {
      const signals = controls.filter((c) => c.kind === 'signal');
      const active = controls.filter((c) => c.kind === 'signal' || !signals.some((light) =>
        (light.mark && light.mark === c.mark) || Math.abs(light.s - c.s) < 2.5));
      active.sort((a, b) => a.s - b.s);
      // Značka před výstupním přechodem platí pro neřízený příjezd. Řidič,
      // který už do téže křižovatky vjel přes směrový semafor, má výjezd uvolnit.
      for (const sign of active) {
        if (sign.kind === 'signal') continue;
        const next = active.find(c => c.kind === 'signal' && c.s >= sign.s);
        if (next && !next.directedHead && next.s - sign.s <= 27) sign.exitSignal = next;
      }
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
        const fullWidth = world.r.flags[control.road] & RF.ONEWAY && !world.busContraflow?.has(control.road);
        const offset = fullWidth ? -hw + 1 : 0.15;
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

  locate(road, x, z, direction, allowTransit = false) {
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
      let transitOnly = false;
      if (direction < 0) {
        s = w.eLen[edge] - s;
        const reverse = w.reverseEdge(edge);
        if (reverse >= 0) edge = reverse;
        else if (allowTransit) transitOnly = true;
        else continue;
      }
      const score = Math.hypot(x - cx, z - cz) + (s < 0.15 ? 0.025 : 0);
      if (score < best) {
        result = { edge, s: clamp(s, w.eLen[edge]), x: cx, z: cz, tx: direction * dx / length, tz: direction * dz / length, transitOnly };
        best = score;
      }
    }
    return best < 15 ? result : null;
  }

  moveToEdge(control) {
    const pos = {};
    const s = control.transitOnly ? this.world.eLen[control.edge] - control.s : control.s;
    this.world.edgePoint(control.edge, s, 0, pos);
    if (control.transitOnly) { pos.tx *= -1; pos.tz *= -1; }
    Object.assign(control, pos);
  }

  surveyedLine(control, lines = []) {
    let best = 11, result = null;
    for (const line of lines) {
      const x = (line.a[0] + line.b[0]) / 2, z = (line.a[1] + line.b[1]) / 2;
      const dx = x - control.x, dz = z - control.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= best || dz * control.tx - dx * control.tz < -0.5) continue;
      const at = this.locate(control.road, x, z, control.direction, control.transitOnly);
      if (!at || at.edge !== control.edge || at.s < 0.18) continue;
      best = distance;
      result = { s: at.s, id: line.id };
    }
    return result;
  }

  addVisual(x, z, kind, entry) {
    const ci = this.world.chunkIndex(x, z);
    if (ci < 0) return;
    if (!this.chunks.has(ci)) this.chunks.set(ci, { signs: [], heads: [], posts: [], crossings: [], lines: [] });
    const list = this.chunks.get(ci)[kind];
    if (kind === 'heads' || kind === 'signs' || kind === 'posts') {
      const type = { heads: 'signal', signs: 'sign', posts: 'bollard' }[kind];
      const visual = { ...entry, breakableId: breakableId(type, ci, list.length) };
      if (kind === 'heads' && entry.group) (entry.group.fixtures ??= []).push(visual.breakableId);
      list.push(visual);
      return visual;
    } else {
      list.push(entry);
    }
  }

  addControl(control) {
    const edges = control.transitOnly ? this.byTransitEdge : this.byEdge;
    const list = edges.get(control.edge);
    if (list?.some((c) => c.kind === control.kind && Math.abs(c.s - control.s) < 2.0)) return false;
    control.width = this.world.r.w[control.road];
    this.controls.push(control);
    addTo(edges, control.edge, control);
    addTo(this.controlGrid, cell(control.x, control.z), control);
    return true;
  }

  controlsJunction(control) {
    // Měřená stopčára může být několik metrů před návěstidlem téže křižovatky.
    return this.world.eLen[control.edge] - Math.max(control.s, control.headS ?? control.s) <= 27;
  }

  addToGroup(control) {
    const w = this.world, n = control.transitOnly ? w.eFrom[control.edge] : w.eTo[control.edge];
    const x = w.nodeX[n], z = w.nodeZ[n];
    const nearJunction = this.controlsJunction(control) && w.outStart[n + 1] - w.outStart[n] >= 2;
    const gx = nearJunction ? x : control.x, gz = nearJunction ? z : control.z;
    let group = this.groups.find((g) => Math.hypot(g.x - gx, g.z - gz) <= 38);
    if (!group) {
      group = { id: this.groups.length, x: gx, z: gz, tx: control.tx, tz: control.tz,
        timeOffset: (Math.abs(gx * 0.37 + gz * 0.61)) % 90, greenTime: 14 + (Math.abs(Math.floor(gx + gz)) % 4),
        hasSecond: false, crossings: [], clearance: 0 };
      this.groups.push(group);
    }
    control.group = group;
    group.radius = Math.max(group.radius ?? 0, Math.hypot(control.x - group.x, control.z - group.z));
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

  joinSplitCrossings() {
    // Na dělené třídě tvoří dvě navazující části téhož přechodu jednu pěší trasu.
    // Osamocené světlo za ostrůvkem proto patří k návěstidlům stejné křižovatky.
    const junctions = new Set(this.controls.filter(c => c.directedHead).map(c => c.group));
    const joined = new Map();
    for (const c of this.crossings) {
      if (!c.signal || !c.group || c.group.crossings.length !== 1 || junctions.has(c.group) || c.group.hasSecond) continue;
      let closest = 7, selected = null;
      for (const other of nearby(this.crossingGrid, c.x, c.z, 30)) {
        if (!other.signal || !junctions.has(other.group) || other.road === c.road ||
            Math.abs(c.dx * other.dx + c.dz * other.dz) < 0.98) continue;
        const dx = other.x - c.x, dz = other.z - c.z;
        if (Math.abs(dx * c.dz - dz * c.dx) > 1 ||
            Math.abs(dx * c.dx + dz * c.dz) < (c.length + other.length) / 2 - 1) continue;
        for (const a of [c.a, c.b]) for (const b of [other.a, other.b]) {
          const gap = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (gap < closest) { closest = gap; selected = other.group; }
        }
      }
      if (selected) joined.set(c.group, selected);
    }
    for (const [old, group] of joined) {
      for (const crossing of old.crossings) { crossing.group = group; group.crossings.push(crossing); }
      group.clearance = Math.max(group.clearance, old.clearance);
    }
    for (const c of this.controls) {
      const group = joined.get(c.group);
      if (!group) continue;
      c.group = group;
      c.axis = Math.abs(group.tx * c.tx + group.tz * c.tz) > 0.7 ? 0 : 1;
      if (c.axis === 1) group.hasSecond = true;
      group.radius = Math.max(group.radius, Math.hypot(c.x - group.x, c.z - group.z));
    }
    this.groups = this.groups.filter(g => !joined.has(g));
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
    if (this.signalsOff(head.group)) return 'off';
    const phase = this.phase(head.group);
    if (head.kind === 'pedestrian') return phase === 'walk' ? 'green' : 'red';
    const axis = head.axis ?? 0;
    if (this.groupOccupied(head.group)) return 'red';
    if (phase === 'green' + axis) return 'green';
    return phase === 'amber' + axis ? 'amber' : 'red';
  }

  signalsOff(group) {
    const registry = this.world?.breakables;
    return !!registry?.damaged.size && !!group?.fixtures?.some(id => registry.state(id) === 'broken');
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

  leaveCrossing(person) {
    this.users.delete(person);
    this.waitingWalkers.delete(person);
  }

  routeCrossingDistance(car, crossing, reach) {
    if (car.mode !== 'ai' || car.edge < 0 || car.edge == null) return Infinity;
    const w = this.world;
    for (const edge of [car.edge, car.next]) {
      if (edge == null || edge < 0) continue;
      const offset = edge === car.edge ? -car.s : w.eLen[car.edge] - car.s;
      if (offset > reach) continue;
      const stop = this.crossingsByEdge.get(edge)?.find(entry => entry.crossing === crossing);
      if (!stop || stop.s + offset < -2 || stop.s + offset > reach + 2) continue;
      // Střed zebry může být i na opačné půlce dělené silnice. Ověříme vlastní pruh.
      const lane = edge === car.edge ? car.lane : car.nextLane;
      const start = Math.max(0, stop.s - 4);
      w.edgePoint(edge, start, lane, crossingStart);
      w.edgePoint(edge, Math.min(w.eLen[edge], stop.s + 4), lane, crossingEnd);
      const gap = offset + start + intersects(crossingStart.x, crossingStart.z, crossingEnd.x, crossingEnd.z, crossing);
      if (gap >= 0 && gap <= reach) return gap;
    }
    return Infinity;
  }

  canWalk(crossing, cars = [], transit = [], person, weather) {
    const controlled = crossing.group && !this.signalsOff(crossing.group);
    if (controlled) {
      if (this.phase(crossing.group) !== 'walk') return false;
      const deceleration = STOP_DECELERATION * (weather?.surfaceGrip(crossing.x, crossing.z) ?? 1);
      return !cars.some(car => blocksGreenCrossing(car, crossing, person, deceleration))
        && !transit.some(section => transitBlocksCrossing(section, crossing, person));
    }
    const occupied = car => {
      if (car.mode === 'parked' || Math.abs(car.y - person?.y) > 3) return false;
      const dx = car.x - crossing.x, dz = car.z - crossing.z;
      const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
      const half = car.halfLen ?? 2, width = car.radius ?? 1;
      const normal = Math.abs(fx * crossing.dz - fz * crossing.dx);
      const tangent = Math.abs(fx * crossing.dx + fz * crossing.dz);
      if (Math.abs(dx * crossing.dz - dz * crossing.dx) < half * normal + width * tangent + 0.45 &&
          Math.abs(dx * crossing.dx + dz * crossing.dz) < crossing.length / 2 + half * tangent + width * normal) return true;
      const vx = car.vx || 0, vz = car.vz || 0;
      const speed = Math.hypot(vx, vz);
      if (speed < 0.35) return false;
      const horizon = Math.min(6, crossing.length / (person?.speed ?? 1.4));
      const reach = horizon + half / speed;
      return Number.isFinite(this.routeCrossingDistance(car, crossing, speed * reach)) ||
        Number.isFinite(intersects(car.x, car.z, car.x + vx * reach, car.z + vz * reach, crossing));
    };
    return !cars.some(occupied) && !transit.some(occupied);
  }

  drivingRule(car, control, distance, dt, limit, others, extra = [], stopping, checkExit = false) {
    const signal = control.kind === 'signal';
    const speed = car.speed ?? car.v;
    const state = car.trafficStop?.rule === control ? car.trafficStop
      : (car.trafficStop = { rule: control, held: 0, ready: Infinity });
    let stop;
    const color = signal && this.light(control);
    if (signal) {
      if (color === 'off') {
        if (state.ready === Infinity && distance < 4) state.ready = this.time;
        stop = distance < 22 && this.yieldAtBlackout(car, control, others, extra);
        limit = Math.min(limit, Math.sqrt(5.5 ** 2 + 6 * Math.max(0, distance - 8)));
      } else {
        state.rightBlocker = null;
        stop = color === 'red' || (color === 'amber' && speed ** 2 < 11 * Math.max(0, distance));
      }
      if (checkExit && control.directedHead && state.movement === undefined &&
          (control.edge === car.edge || car.exitPlan[0]?.from === control.edge)) {
        state.movement = this.junctionMovement(car, control);
      }
    } else {
      // U auta je distance měřena od bodu 45 cm před nárazníkem.
      if (distance <= 0.5 && Math.abs(speed) < 0.18) state.held += dt;
      const ready = control.kind === 'yield' || state.held >= 0.65;
      if (ready && state.ready === Infinity && distance < 4) state.ready = this.time;
      stop = !ready || (distance < 22 && this.conflict(car, control, others, extra));
    }
    // Při povinném zastavení před stejnou čárou stačí zkoumat výjezd až při rozjezdu.
    state.yieldingTo = null;
    if (!stop && checkExit) {
      if (state.movement) state.yieldingTo = this.turnInProgress(car, state.movement, others, extra);
      stop = !!state.yieldingTo || this.exitBlocked(car, control, others, extra);
      if (stop && color === 'green' && state.movement?.left && distance < 4 && Math.abs(speed) < 0.3) {
        state.turnWait = (state.turnWait ?? 0) + dt;
      }
    }
    // Při souběhu dvou pruhů si řidič ještě před čárou ponechá místo k zařazení.
    state.entering = !stop && !!state.movement && limit > 0 && distance < 3 + speed * speed / 8;
    state.crossing = !stop && checkExit && control.directedHead && speed > 0 && distance < 2;
    if (stop) {
      stopping?.(distance + 0.45);
      if (distance < 1.4) this.onRuleWait?.(car, control, color, others, extra, checkExit);
    } else if (checkExit && control.directedHead && limit > 0 && speed > 0 && distance <= speed * dt) {
      this.enterJunction(car, control);
    }
    return stop ? Math.min(limit, stopDistance(distance, dt)) : limit;
  }

  yieldAtBlackout(car, control, others, extra) {
    const { x, z } = control.group, { tx, tz } = control;
    const state = car.trafficStop;
    state.rightBlocker = null;
    const near = other => other !== car && other.mode !== 'parked' &&
      Math.abs((other.y ?? car.y) - car.y) <= 3;
    const inside = other => {
      if (!near(other)) return false;
      const movement = other.junctionMovement;
      if (movement?.control.group === control.group && Math.abs(other.s - movement.control.s) > other.halfLen + 1) return true;
      const dx = other.x - x, dz = other.z - z;
      const across = dx * tz - dz * tx;
      return Math.abs(across) < (other.halfLen ?? 1) + 2 && Math.abs(dx * tx + dz * tz) < 3.5;
    };
    if (others.some(inside) || extra.some(inside)) return true;
    const fromRight = other => {
      if (!near(other)) return false;
      const dx = other.x - x, dz = other.z - z, distance = Math.hypot(dx, dz);
      if (distance < 1 || distance > 36 || dz * tx - dx * tz < 0.55 * distance) return false;
      const waiting = other.trafficStop;
      if (waiting?.rule.group === control.group && waiting.ready < Infinity) return true;
      const approaching = -(dx * (other.vx || 0) + dz * (other.vz || 0)) / distance;
      return approaching > 0.35 && distance < 5 + 3 * approaching;
    };
    const blocker = others.find(fromRight) ?? extra.find(fromRight);
    if (!blocker) return false;
    state.rightBlocker = blocker;

    // Při úplném patu projede dříve příchozí. Mimo řetězec mají auta zprava přednost.
    let next = blocker, earliest = state;
    for (let remaining = others.length; next && next !== car && remaining > 0; remaining--) {
      const wait = next.trafficStop;
      if (!wait || wait.rule.group !== control.group || wait.ready === Infinity || Math.abs(next.speed ?? next.v) > 0.3) {
        return true;
      }
      if (wait.ready < earliest.ready || wait.ready === earliest.ready && wait.rule.edge < earliest.rule.edge) earliest = wait;
      next = wait.rightBlocker;
    }
    return next !== car || earliest !== state;
  }

  junctionMovement(car, control) {
    const w = this.world;
    const ahead = control.edge === car.next && car.edge !== car.next;
    const first = ahead ? car.exitPlan[0] : null;
    let edge = ahead ? first?.to : car.next;
    if (edge == null || edge < 0 || !this.controlsJunction(control)) return null;
    const lane = ahead ? car.nextLane : car.lane;
    let exitLane = ahead ? first.lane : car.nextLane, turn = ahead ? first.turn : car.plannedTurn;
    let width = w.r.w[w.eRoad[control.edge]];
    for (let index = ahead ? 1 : 0; index < car.exitPlan.length; index++) {
      const move = car.exitPlan[index];
      if (move.from !== edge || move.to < 0 || w.eLen[edge] >= 12) break;
      width = Math.max(width, w.r.w[w.eRoad[edge]]);
      edge = move.to;
      exitLane = move.lane;
      turn = move.turn;
    }
    const exit = w.edgePoint(edge, turn?.exit ?? 0, 0, {});
    const left = control.tx * exit.tz - control.tz * exit.tx < -0.35;
    return { control, lane, edge, exitLane, left, exitX: exit.x, exitZ: exit.z, reached: false,
      clearAt: Math.min(w.eLen[edge], Math.max(width / 2, turn?.exit ?? 0) + car.halfLen + 1) };
  }

  crossesTransit(movement, head) {
    return head && movement?.control.group === head.group && (movement.left || movement.control.axis !== head.axis);
  }

  turnInProgress(car, mine, others, sections = []) {
    const light = mine.control;
    for (const other of others) {
      if (other === car || other.mode !== 'ai') continue;
      const active = other.junctionMovement;
      const state = other.trafficStop;
      const approach = state?.movement?.control;
      const entering = active ?? (state?.entering && approach && (other.next === approach.edge ||
        other.edge === approach.edge && other.s + other.halfLen < approach.s + 1) ? state.movement : null);
      if (entering?.control === light && entering.lane !== mine.lane && entering.edge === mine.edge &&
          entering.exitLane === mine.exitLane && Number.isFinite(mine.exitLane)) return entering;
      if (!entering || entering.control.group !== light.group) continue;
      // Zelená příčné osy může začít dřív, než pomalý vůz vyklidí křižovatku.
      if (entering.control.axis !== light.axis) {
        if (active) return active;
        continue;
      }
      const alignment = entering.control.tx * light.tx + entering.control.tz * light.tz;
      // Vlevo odbočíme až po uvolnění protisměru. Vůz jedoucí rovně si
      // zachovává přednost. Za odbočujícím ve vlastním pruhu necháme prostor.
      if (alignment < -0.75) {
        // U protisměru zohledníme již zahájený rozjezd i před přejetím čáry.
        if (mine.left) return entering;
        // Před obloukem odbočující čeká. Pokud už do oblouku najel, musí
        // protijedoucí řidič před čárou ponechat místo k jeho dokončení.
        const turn = other.finishingTurn ?? other.plannedTurn;
        if (active?.left && turn?.sign < 0 && (other.edge === turn.to ||
            other.edge === turn.from && other.s >= turn.entry)) return active;
      } else if (active?.left && active.control === light && Math.abs(active.lane - mine.lane) < car.type.wid) {
        return active;
      }
    }
    // Linkový vůz se nesmí ocitnout čelem proti autu uprostřed kolejí.
    return sections.find(section => {
      if (!this.crossesTransit(mine, section.control)) return false;
      // Jakmile i zadní článek minul dráhu auta, smí auto vyjet. Dlouhá
      // tramvaj už může stát u dalšího semaforu, zatímco pořád patří do téže skupiny.
      const tx = Math.sin(section.yaw), tz = Math.cos(section.yaw);
      const beyond = (x, z) => (section.x - x) * tx + (section.z - z) * tz;
      const rear = section.halfLen + car.radius + light.width / 2;
      return Math.min(beyond(light.x, light.z), beyond(mine.exitX, mine.exitZ)) <= rear;
    });
  }

  conflict(car, control, others, extra) {
    const w = this.world;
    const junction = w.eTo[control.edge];
    const x = w.nodeX[junction], z = w.nodeZ[junction];
    if (Math.hypot(x - control.x, z - control.z) > 36) return false;
    // Při odbočení vlevo z vedlejší musí i záď vozu opustit první pruh.
    // Čára v ulici Kardinála Berana je přitom deset metrů před středem křižovatky.
    let gapTime = 3;
    if (car.plannedTurn?.sign < 0) {
      const speed = Math.max(0, car.speed ?? 0);
      const distance = Math.hypot(x - car.x, z - car.z) + car.halfLen + 2;
      gapTime = Math.max(gapTime, (Math.sqrt(speed * speed + 4 * distance) - speed) / 2 + 0.8);
    }
    const priority = (other) => {
      if (other === car || other.mode === 'parked' || Math.abs(other.y - car.y) > 3) return false;
      const dx = x - other.x, dz = z - other.z, distance = Math.hypot(dx, dz);
      if (distance < 3.6) return true;
      if (distance > Math.max(34, 18 * gapTime)) return false;
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
      return closing > 0.25 && distance / closing < gapTime;
    };
    return others.some(priority) || extra.some(priority);
  }

  exitBlocked(car, control, others, extra) {
    const w = this.world;
    const approach = control.edge;
    const ahead = approach === car.next && car.edge !== car.next;
    const approachLane = ahead ? car.nextLane : car.lane;
    const first = ahead ? car.exitPlan[0] : null;
    let edge = ahead ? first?.to : car.next;
    const junction = edge >= 0 && this.controlsJunction(control);
    const carLength = car.halfLen * 2 + 1.4;
    const requiredEnd = (edge, start, base) => {
      let clearance = start + base;
      for (const { crossing, s } of this.crossingsByEdge.get(edge) ?? []) {
        // Za křižovatkou může být ještě další přechod. Když se před něj
        // vejde celé auto, může opustit křižovatku a nechat oba přechody volné.
        if (s - 2 > clearance + carLength) break;
        const sameSignal = crossing.group && crossing.group === control.group;
        if (s >= start - 1 && (sameSignal ? s <= start + 30 : junction && s <= start + 12)) {
          clearance = Math.max(clearance, s + 2);
        }
      }
      return clearance + carLength;
    };
    if (!junction) {
      return this.laneOccupied(car, approach, approachLane, control.s, requiredEnd(approach, control.s, 7), others, extra);
    }
    if (this.laneOccupied(car, approach, approachLane, control.s, w.eLen[approach], others, extra)) return true;

    let lane = ahead ? first.lane : car.nextLane, end = requiredEnd(edge, 0, 5);
    // Silniční graf někdy dělí výjezd na několik krátkých spojek.
    for (let links = 0; links < 4; links++) {
      const move = car.exitPlan[links + (ahead ? 1 : 0)];
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

  exitSegments(edge, lane, start, end) {
    const cache = this.exitGeometry ??= new Map();
    const key = [edge, lane, start, end].join(',');
    if (cache.has(key)) return cache.get(key);
    const path = { segments: [], minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
    this.world.edgePoint(edge, start, lane, exitStart);
    for (let s = start; s < end; s += 4) {
      this.world.edgePoint(edge, Math.min(s + 4, end), lane, exitEnd);
      const x = exitStart.x, z = exitStart.z;
      const dx = exitEnd.x - x, dz = exitEnd.z - z, length = Math.hypot(dx, dz);
      if (length > 0.01) {
        path.segments.push({ x, z, length, tx: dx / length, tz: dz / length });
        path.minX = Math.min(path.minX, x - length);
        path.maxX = Math.max(path.maxX, x + length);
        path.minZ = Math.min(path.minZ, z - length);
        path.maxZ = Math.max(path.maxZ, z + length);
      }
      exitStart.x = exitEnd.x; exitStart.z = exitEnd.z;
    }
    // Geometrie silnice je stálá. Polohu a pohyb vozidel posuzujeme při každém dotazu.
    if (cache.size >= 1024) cache.clear();
    cache.set(key, path);
    return path;
  }

  laneOccupied(car, edge, lane, start, end, others, extra) {
    const path = this.exitSegments(edge, lane, start, Math.min(this.world.eLen[edge], end));
    const inLane = other => {
      if (other === car || Math.abs((other.y ?? car.y) - car.y) > 3) return false;
      const width = other.radius ?? 1, half = other.halfLen ?? width;
      const margin = Math.max(width, half) + car.radius + 0.15;
      if (other.x < path.minX - margin || other.x > path.maxX + margin ||
          other.z < path.minZ - margin || other.z > path.maxZ + margin) return false;
      const vx = other.vx || 0, vz = other.vz || 0;
      const directed = Number.isFinite(other.yaw);
      const fx = directed ? Math.sin(other.yaw) : 0, fz = directed ? Math.cos(other.yaw) : 0;
      for (const { x, z, length, tx, tz } of path.segments) {
        const ox = other.x - x, oz = other.z - z;
        if (Math.abs(ox) > length + margin || Math.abs(oz) > length + margin) continue;
        // Plynule odjíždějící vůz ve stejném pruhu řidič sleduje s odstupem.
        if (!other.upcomingLeft && vx * tx + vz * tz > 2 && Math.abs(vx * tz - vz * tx) < 0.5 &&
            (other.physical?.input?.targetSpeed ?? Infinity) > 2) continue;
        const alignment = directed ? Math.abs(fx * tx + fz * tz) : 1;
        const across = Math.sqrt(Math.max(0, 1 - alignment ** 2));
        const along = ox * tx + oz * tz, reach = Math.max(half * alignment, width * across);
        if (along + reach > 0 && along - reach < length &&
            Math.abs(ox * tz - oz * tx) < car.radius + Math.max(width * alignment, half * across) + 0.15) return true;
      }
      return false;
    };
    return others.some(inLane) || extra.some(inLane);
  }

  drivingLimit(car, dt, limit, others, extra, stopping) {
    const w = this.world;
    const previous = car.trafficStop;
    // Při změně úseku nebo rychlém kroku může nárazník přejet celou toleranci
    // hledání čáry. Vjezd posoudíme podle posledního kroku těsně před ní.
    if (previous?.crossing && previous.rule.edge === car.edge && car.s + car.halfLen + 0.45 > previous.rule.s) {
      this.enterJunction(car, previous.rule);
      previous.crossing = false;
    }
    this.updateJunction(car, car.x, car.z);
    const lead = car.s + car.halfLen + 0.45;
    const first = this.byEdge.get(car.edge)?.find((c) => c.s >= lead - 0.42 && !this.passedEntry(car, c));
    const second = !first && car.next >= 0 ? this.byEdge.get(car.next)?.find(c => !this.passedEntry(car, c)) : null;
    const control = first ?? second;
    if (control) {
      const distance = (second ? w.eLen[car.edge] : 0) + control.s - lead;
      if (distance <= 50) {
        // Čára může ležet hned za hranicí dvou úseků. Brzdění před obsazenou
        // křižovatkou musí začít stejně brzy jako brzdění na červenou.
        limit = this.drivingRule(car, control, distance, dt, limit, others, extra, stopping,
          !!first || !!control.directedHead);
      }
    }
    if (!this.users.size && !this.waitingWalkers.size) return limit;
    const reach = Math.min(65, Math.max(20, car.speed ** 2 / 5 + car.halfLen + 4));
    const direction = { x: car.x + Math.sin(car.yaw) * reach, z: car.z + Math.cos(car.yaw) * reach };
    let turn = null;
    if (car.next >= 0 && w.eLen[car.edge] - car.s < 16) {
      turn = {};
      w.edgePoint(car.next, 14, car.nextLane, turn);
      w.edgePoint(car.edge, w.eLen[car.edge], car.lane, direction);
    }
    const distance = this.pedestrianDistance(car.x, car.z, direction, turn, car);
    if (distance < car.halfLen + 1.7) this.onCrossingWait?.(car);
    stopping?.(distance - car.halfLen - 0.75);
    const room = Math.max(0, distance - car.halfLen - 1.2);
    return Math.min(limit, Math.sqrt(5 * room), stopDistance(room, dt));
  }

  pedestrianDistance(x, z, ahead, turn, car, frontOffset = car?.halfLen ?? 0) {
    if (!this.users.size && (!car || !this.waitingWalkers.size)) return Infinity;
    let best = Infinity;
    const distanceTo = crossing => {
      const first = Math.min(car ? this.routeCrossingDistance(car, crossing, 65) : Infinity,
        intersects(x, z, ahead.x, ahead.z, crossing));
      if (!turn || first < Infinity) return first;
      return Math.hypot(x - ahead.x, z - ahead.z) + intersects(ahead.x, ahead.z, turn.x, turn.z, crossing);
    };
    for (const crossing of this.users.values()) best = Math.min(best, distanceTo(crossing));
    if (car) for (const [person, crossing] of this.waitingWalkers) {
      if (Math.abs(person.y - car.y) > 3 || crossing.group && !this.signalsOff(crossing.group)) continue;
      const d = distanceTo(crossing);
      const room = d - frontOffset - 1.2;
      if (room >= -0.5 && (car.speed ?? car.v) ** 2 <= 7 * Math.max(0.25, room)) best = Math.min(best, d);
    }
    return best;
  }

  controlAhead(x, z, tx, tz, reach, tram = false, vehicle = null) {
    let best = reach, result = null;
    for (const c of nearby(this.controlGrid, x, z, reach + 5)) {
      if (c.transitOnly ? !vehicle || tram : !this.byEdge.get(c.edge)?.includes(c)) continue;
      if (vehicle && this.passedEntry(vehicle, c)) continue;
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
    const next = this.transitControl(vehicle, point);
    if (next) {
      // V trase MHD je s poloha čela vozu, nikoli jeho středu.
      limit = this.drivingRule(vehicle, next.control, next.distance - 0.55, dt, limit, others);
      if (next.control.directedHead && vehicle.enteredSignal?.group !== next.control.group) {
        const crossing = others.find(car => car.mode === 'ai' && this.crossesTransit(car.junctionMovement, next.control));
        if (crossing) {
          if (next.distance < 2) this.onTransitYield?.(vehicle, crossing);
          limit = Math.min(limit, stopDistance(next.distance - 0.55, dt));
        }
      }
    } else vehicle.trafficStop = null;
    const distance = this.pedestrianDistance(point.x, point.z, ahead, null, vehicle.isTram ? null : vehicle, 0);
    if (distance <= 1.6) this.onCrossingWait?.(vehicle);
    const room = Math.max(0, distance - 1.4);
    limit = Math.min(limit, Math.sqrt(5 * room), stopDistance(room, dt));
    if (next && limit > 0 && next.distance <= limit * dt) this.enterJunction(vehicle, next.control);
    return limit;
  }

  transitControl(vehicle, point) {
    this.updateJunction(vehicle, point.x, point.z);
    return this.controlAhead(point.x, point.z, point.tx, point.tz, 42, vehicle.isTram, vehicle);
  }

  updateJunction(vehicle, x, z) {
    const group = vehicle.enteredSignal?.group;
    if (group && Math.hypot(x - group.x, z - group.z) > group.radius + vehicle.halfLen + 2) vehicle.enteredSignal = null;
    const movement = vehicle.junctionMovement;
    if (movement) {
      const atExit = vehicle.edge === movement.edge;
      if (!vehicle.enteredSignal || (atExit && vehicle.s >= movement.clearAt) || (movement.reached && !atExit)) {
        vehicle.junctionMovement = null;
      } else if (atExit) movement.reached = true;
    }
  }

  passedEntry(vehicle, control) {
    // Body přechodů kolem téže křižovatky nejsou dalšími vjezdy. Skuteční chodci
    // a obsazený výjezd se kontrolují nezávisle na barvě semaforu.
    const entry = vehicle.enteredSignal;
    if (entry && control.exitSignal?.group === entry.group) return true;
    return entry && control.group === entry.group && (!control.directedHead || entry === control);
  }

  enterJunction(vehicle, control) {
    if (control.directedHead) {
      vehicle.enteredSignal = control;
      vehicle.junctionMovement = vehicle.trafficStop?.movement ?? null;
    }
  }
}
