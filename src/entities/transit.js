import { Vector3 } from 'three/webgpu';
import { STOP_DWELL, Timetable } from '../game/timetable.js';
import { CLOCK_RATE, DAY_SECONDS } from '../game/clock.js';
import { DRIVABLE_MAX, RF } from '../config.js';
import { makeTrolleybus, TROLLEY_LEN } from './models.js';
import { addTransitDisplay, addTransitDoors, setTransitDoors } from './transit-details.js';
import {
  BUS_SECTION, makeSorBus, makeTatraCar, makeTatraCoupler, makeTramJoint, makeTramSection,
  setModelDoors, TATRA_SECTIONS, TRAM_SECTIONS,
} from './transit-models.js';

export const TRANSIT_NAME = { tram: 'tramvaj', trolleybus: 'trolejbus', bus: 'autobus' };

const frontPoint = { x: 0, z: 0, tx: 0, tz: 1 };
const trailerPoint = { x: 0, z: 0, tx: 0, tz: 1 };
const aheadPoint = { x: 0, z: 0, tx: 0, tz: 1 };
const entryPoint = { x: 0, z: 0, tx: 0, tz: 1 };
const roadPoint = {};
const jointFront = new Vector3();
const jointRear = new Vector3();
const jointAxis = new Vector3();
const TROLLEY_SECTION = { length: TROLLEY_LEN, doors: [3.9, -1.5] };
const SECTIONS = { tram: TRAM_SECTIONS, bus: [BUS_SECTION], trolleybus: [TROLLEY_SECTION] };
const VIEW_DISTANCE = 520;
const DOOR_SPEED = 3;
const ARRIVE_DISTANCE = 0.55;

class Route {
  constructor({ type, ref, from, to, path, stops }) {
    this.type = type;
    this.ref = ref;
    this.from = from;
    this.to = to;
    this.stops = stops;
    const n = path.length;
    this.pts = new Float32Array(n * 2);
    this.cum = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.pts[i * 2] = path[i][0];
      this.pts[i * 2 + 1] = path[i][1];
      if (i) this.cum[i] = this.cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    }
    this.length = this.cum[n - 1];
  }

  posAt(s, side, out) {
    const cum = this.cum;
    s = Math.min(s, this.length);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= s) lo = m;
      else hi = m;
    }
    const x = this.pts[lo * 2], z = this.pts[lo * 2 + 1];
    const dx = this.pts[hi * 2] - x, dz = this.pts[hi * 2 + 1] - z;
    const length = cum[hi] - cum[lo] || 1;
    const along = (s - cum[lo]) / length;
    const tx = dx / length, tz = dz / length;
    out.x = x + dx * along - tz * side;
    out.z = z + dz * along + tx * side;
    out.tx = tx;
    out.tz = tz;
    return out;
  }
}

class TransitVehicle {
  constructor(event, state) {
    const { trip } = event;
    this.event = event;
    this.route = trip.route;
    this.destination = trip.destination;
    this.stops = trip.stops.map(({ target }) => target);
    this.isTram = this.route.type === 'tram';
    // Herní střídání na spojích linek 1 a 2, stálé pro konkrétní spoj.
    this.isTatra = this.isTram && ['1', '2'].includes(this.route.ref) && Number(trip.id) % 2 === 0;
    this.sections = this.isTatra ? TATRA_SECTIONS : SECTIONS[this.route.type];
    this.len = this.sections.reduce((sum, { length }) => sum + length, 0);
    this.halfLen = this.len / 2;
    this.radius = 1.4;
    this.side = this.isTram ? 0 : 1.7;
    this.visible = false;
    this.meshes = null;
    this.v = 0;
    this.vx = 0;
    this.vz = 0;
    this.yaw = 0;
    this.y = 0;
    this.doorFraction = 0;
    this.waitingForSpace = false;
    this.stopTarget = null;
    this.followSchedule(state);
  }

  followSchedule({ s, index, wait }) {
    this.s = s;
    this.stopIndex = index;
    this.wait = wait;
    this.doorsOpen = wait > 0;
    this.stopTarget = this.doorsOpen ? this.stops[index] : null;
  }

  get canBoard() {
    return this.doorsOpen && this.stopIndex < this.stops.length - 1
      && this.event.trip.times[this.stopIndex * 2 + 1] >= 0;
  }

  get canAlight() {
    return this.doorsOpen && (this.stopIndex === this.stops.length - 1
      || this.event.trip.times[this.stopIndex * 2] >= 0);
  }
}

export class TransitManager {
  constructor(scene, world, game, schedule) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    // Starší lokální balík může ještě odkazovat na původní trasy v metadatech.
    const source = schedule.version === 1 ? world.meta.transit.map((route, i) => {
      const key = [route.type, route.ref, route.from, route.to, route.length];
      return !route.gaps && route.path.length >= 2 && key.every((value, k) => value === schedule.routes[i]?.[k]) ? route : null;
    }) : schedule.routes;
    const routes = source.map((route) => route && new Route(route));
    this.routes = routes.filter(Boolean);
    this.vehicles = [];
    this.active = new Map();
    this.heavy = [];
    this.obstacles = [];
    this.timetable = new Timetable(schedule, routes);
    this.seen = new Map();
    this.serviceDay = null;
  }

  reset(clock, player) {
    for (const vehicle of this.vehicles) this._dispose(vehicle);
    this.vehicles = [];
    this.active.clear();
    this.seen.clear();
    this.serviceDay = null;
    this.update(0, player, [], true, clock);
  }

  _dispatch(clock) {
    const now = clock.now;
    if (clock.day !== this.serviceDay) {
      this.serviceDay = clock.day;
      this.events = this.timetable.events(clock.day);
      this.eventIndex = 0;
      for (const [key, end] of this.seen) {
        if (end <= clock.day * DAY_SECONDS && !this.active.has(key)) this.seen.delete(key);
      }
    }
    while (this.eventIndex < this.events.length && this.events[this.eventIndex].start <= now) {
      const event = this.events[this.eventIndex++];
      if (now >= event.end || this.seen.has(event.key)) continue;
      this.seen.set(event.key, event.end);
      const v = new TransitVehicle(event, this.timetable.state(event, now));
      v.justDispatched = now - event.start < CLOCK_RATE * 0.5;
      v.route.posAt(v.s, v.side, entryPoint);
      v.x = entryPoint.x;
      v.z = entryPoint.z;
      this.vehicles.push(v);
      this.active.set(event.key, v);
    }
  }

  takeShift(event, index) {
    let v = this.active.get(event.key);
    if (!v) {
      v = new TransitVehicle(event, { s: event.trip.stops[index].target[0], index, wait: STOP_DWELL });
      this.active.set(event.key, v);
      this.vehicles.push(v);
      this.seen.set(event.key, event.end);
    }
    v.followSchedule({ s: v.stops[index][0], index, wait: STOP_DWELL });
    v.stopTarget = v.stops[index];
    v.v = 0;
    v.waitingForSpace = false;
    v.trafficStop = null;
    v.route.posAt(v.s, v.side, frontPoint);
    v.y = this._routeSurface(v, frontPoint);
    this._show(v, true);
    this._pose(v, 1);
    return v;
  }

  _show(v, on) {
    if (on === v.visible) return;
    v.visible = on;
    if (on) {
      if (!v.meshes) {
        if (v.isTatra) {
          v.meshes = v.sections.map(makeTatraCar);
          v.joints = [makeTatraCoupler()];
        } else {
          v.meshes = v.isTram ? v.sections.map(makeTramSection)
            : [v.route.type === 'bus' ? makeSorBus() : makeTrolleybus()];
          v.joints = v.meshes.slice(1).map(makeTramJoint);
        }
        v.display = addTransitDisplay(v.meshes[0], v.sections[0].length, v.route.ref, v.destination);
        if (v.route.type === 'trolleybus') v.doors = addTransitDoors(v.meshes[0], TROLLEY_SECTION.doors);
      }
      for (const mesh of v.meshes) this.scene.add(mesh);
      for (const joint of v.joints) this.scene.add(joint);
    } else {
      this.game.audio.remove(v);
      for (const mesh of v.meshes) this.scene.remove(mesh);
      for (const joint of v.joints) this.scene.remove(joint);
    }
  }

  _dispose(v) {
    this._show(v, false);
    v.display?.map.dispose();
    v.display?.dispose();
    for (const mesh of v.meshes ?? []) mesh.userData.doors?.mesh.dispose();
  }

  _spawnSpace(v, nearby) {
    const { x, z, tx, tz } = frontPoint;
    const centerX = x - tx * v.halfLen, centerZ = z - tz * v.halfLen;
    return !nearby.some((other) => {
      if (other === v || !other.visible || Math.abs(other.y - v.y) > 3) return false;
      const dx = other.x - centerX, dz = other.z - centerZ;
      const across = Math.abs(dx * tz - dz * tx);
      const along = Math.abs(dx * tx + dz * tz);
      return across < 2.6 && along < (v.len + other.len) / 2 + 1.5
        && dx * dx + dz * dz < (v.halfLen + other.halfLen + 2) ** 2;
    });
  }

  _routeSurface(v, point) {
    const { x, z } = point;
    const ground = this.world.heightAt(x, z) + 0.05;
    const deck = this.world.deckAt(x, z, Infinity, v.isTram ? 1 : 0);
    if (v.isTram || deck < ground + 2.5) return Math.max(ground, deck);
    const road = this.world.nearestRoad(x, z, 9, DRIVABLE_MAX, 0, roadPoint, undefined, false, point);
    return road ? this.world.roadSurfaceY(road.road, road.seg, road.t, road.x, road.z) : Math.max(ground, deck);
  }

  _arrive(v, index, now) {
    v.s = v.stops[index][0];
    v.v = 0;
    v.stopTarget = v.stops[index];
    v.doorsOpen = true;
    const { trip, day } = v.event;
    const time = trip.times[index * 2 + 1];
    const planned = day * DAY_SECONDS + (time >= 0 ? time : -time - 1);
    v.wait = Math.max(STOP_DWELL, now === undefined ? 0 : (planned - now) / CLOCK_RATE);
  }

  _roadLane(v, dt) {
    if (v.isTram) return;
    v.limitTimer = (v.limitTimer ?? 0) - dt;
    if (v.limitTimer <= 0) {
      const x = frontPoint.x + frontPoint.tz * v.side, z = frontPoint.z - frontPoint.tx * v.side;
      const road = this.world.nearestRoad(x, z, 7, DRIVABLE_MAX, 0, roadPoint, v.y);
      const forward = road && road.dx * frontPoint.tx + road.dz * frontPoint.tz >= 0;
      v.roadLimit = road ? this.world.roadSpeed(road.road, forward) / 3.6 : 10.5;
      const { lanes, w, flags } = this.world.r;
      const oneWay = road && (flags[road.road] & RF.ONEWAY);
      const count = road && Math.max(oneWay ? 1 : 2, lanes[road.road]);
      v.lane = road ? Math.min(2.5, w[road.road] * (1 - 1 / count) / 2) : 1.7;
      v.limitTimer = 0.5;
    }
    v.side += (v.lane - v.side) * Math.min(1, dt * 4);
  }

  _drive(v, dt, now, nearby, cars, playerOnFoot, player) {
    const { trip } = v.event;
    this._roadLane(v, dt);
    if (v.wait > 0) {
      v.wait = Math.max(0, v.wait - dt);
      if (v.wait > 0) return;
      if (v.stopIndex === v.stops.length - 1 && this.game.ride === v) this.game._alight(true);
      v.stopIndex++;
      v.stopTarget = null;
      v.doorsOpen = false;
      if (v.stopIndex >= v.stops.length && !trip.exit) return;
    }

    // Zkušební průjezdy podél trasy mohou nastavit polohu bez posunu hodin.
    if (now === undefined) {
      const index = v.stops.findIndex((stop) => stop[0] >= v.s - ARRIVE_DISTANCE);
      v.stopIndex = index < 0 ? v.stops.length : index;
    }
    const stop = v.stops[v.stopIndex];
    const remaining = stop ? stop[0] - v.s : trip.endS - v.s;
    if (stop && remaining <= ARRIVE_DISTANCE && v.v <= 0.8) {
      this._arrive(v, v.stopIndex, now);
      return;
    }

    let limit = v.isTram ? 11.5 : Math.min(10.5, v.roadLimit);
    if (stop) limit = Math.min(limit, Math.sqrt(2 * 1.35 * Math.max(0, remaining)) + 0.2);
    const { tx, tz } = frontPoint;
    const dx = player.x - frontPoint.x, dz = player.z - frontPoint.z;
    const inLane = dx * tx + dz * tz;
    const blocking = playerOnFoot && remaining > 8 && v.v < 1 && Math.abs(player.y - v.y) < 2
      && inLane > 0.5 && inLane < 9 && Math.abs(dx * tz - dz * tx) < 1.55;
    v.hornWait = blocking ? (v.hornWait ?? 0) + dt : 0;
    if (v.hornWait >= 1.2) {
      if (v.isTram) this.game.audio.bell(v);
      else this.game.audio.horn(v);
      v.hornWait = -6;
    }
    const check = (other) => {
      if (other === v || Math.abs((other.y ?? v.y) - v.y) > 3) return;
      const dx = other.x - frontPoint.x, dz = other.z - frontPoint.z;
      if (dx * dx + dz * dz > 32 ** 2) return;
      const along = dx * tx + dz * tz;
      if (along < 0.2 || Math.abs(dx * tz - dz * tx) > 1.5 + (other.radius || 1) * 0.35) return;
      const gap = along - (other.halfLen || 1) - 0.5;
      const speed = (other.vx || 0) * tx + (other.vz || 0) * tz;
      limit = Math.min(limit, Math.max(0, speed + (gap - 2.5) * 1.2));
    };
    for (const other of nearby) if (other.visible) check(other);
    for (const car of cars) check(car);
    if (playerOnFoot) check(player);

    const acceleration = v.v < limit ? 1.1 : 2.6;
    v.v += Math.sign(limit - v.v) * Math.min(Math.abs(limit - v.v), acceleration * dt);
    v.route.posAt(v.s + 16, v.side, aheadPoint);
    v.v = this.world.traffic.transitLimit(v, frontPoint, aheadPoint, dt, v.v, cars);
    const advance = v.v * dt;
    if (stop && advance >= remaining && v.v < 2.3) this._arrive(v, v.stopIndex, now);
    else v.s = Math.min(trip.endS, v.s + advance);
  }

  _pose(v, dt) {
    let referenceY = v.y, end = v.s;
    for (const [index, mesh] of v.meshes.entries()) {
      const section = v.sections[index];
      const { length } = section;
      const center = end - length / 2;
      end -= length;
      const axle = section.axle ?? (v.isTram ? 2.6 : 3.5);
      const front = v.route.posAt(center + axle, v.side, frontPoint);
      const rear = v.route.posAt(center - axle, v.side, trailerPoint);
      const x = (front.x + rear.x) / 2, z = (front.z + rear.z) / 2;
      const yaw = Math.atan2(front.x - rear.x, front.z - rear.z);
      const fy = this.world.groundY(front.x, front.z, referenceY);
      const ry = this.world.groundY(rear.x, rear.z, referenceY);
      const y = (fy + ry) / 2;
      referenceY = y;
      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.atan2(ry - fy, axle * 2), yaw, 0, 'YXZ');
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const vx = fx * v.v, vz = fz * v.v;
      const collisionSpan = v.isTatra ? length / 2 - 1.35 : axle;
      const collisionPoints = v.isTatra ? [-collisionSpan, -axle, 0, axle, collisionSpan] : [-axle, 0, axle];
      for (const k of collisionPoints) this.heavy.push({ x: x + fx * k, y, z: z + fz * k, r: 1.35, vx, vz });
      this.obstacles.push({ x, y, z, vx, vz, yaw, halfLen: length / 2, radius: 1.4 });
      if (index === (v.isTram ? 1 : 0)) Object.assign(v, { x, y, z, yaw, vx, vz });
    }
    // Spřáhlo nebo měch překrývá konce sousedních skříní i v oblouku.
    for (const [index, joint] of v.joints.entries()) {
      const a = v.meshes[index], b = v.meshes[index + 1];
      const height = v.isTatra ? 0.62 : 1.75;
      jointFront.set(0, height, -v.sections[index].length / 2).applyQuaternion(a.quaternion).add(a.position);
      jointRear.set(0, height, v.sections[index + 1].length / 2).applyQuaternion(b.quaternion).add(b.position);
      joint.position.copy(jointFront).lerp(jointRear, 0.5);
      if (v.isTatra) {
        jointAxis.copy(jointFront).sub(jointRear);
        joint.scale.z = jointAxis.length() + 0.23;
        joint.rotation.set(-Math.atan2(jointAxis.y, Math.hypot(jointAxis.x, jointAxis.z)),
          Math.atan2(jointAxis.x, jointAxis.z), 0, 'YXZ');
        const yaw = Math.atan2(Math.sin(a.rotation.y) + Math.sin(b.rotation.y),
          Math.cos(a.rotation.y) + Math.cos(b.rotation.y));
        Object.assign(v, { x: joint.position.x, y: (a.position.y + b.position.y) / 2, z: joint.position.z,
          yaw, vx: Math.sin(yaw) * v.v, vz: Math.cos(yaw) * v.v });
        continue;
      }
      joint.quaternion.copy(a.quaternion).slerp(b.quaternion, 0.5);
      jointAxis.set(0, 0, 1).applyQuaternion(joint.quaternion);
      joint.scale.z = Math.abs(jointFront.sub(jointRear).dot(jointAxis)) + 0.63;
    }
    const target = Number(v.doorsOpen);
    if (v.doorFraction !== target) {
      v.doorFraction += Math.sign(target - v.doorFraction) * Math.min(Math.abs(target - v.doorFraction), dt * DOOR_SPEED);
      if (v.doors) setTransitDoors(v.doors, v.doorFraction);
      else for (const mesh of v.meshes) setModelDoors(mesh, v.doorFraction);
    }
  }

  update(dt, player, cars, playerOnFoot, clock, controls) {
    const now = clock?.now;
    if (clock) this._dispatch(clock);
    this.heavy.length = 0;
    this.obstacles.length = 0;
    const px = player.x, pz = player.z;
    const nearby = this.vehicles.filter((v) => v.visible);
    for (let index = this.vehicles.length - 1; index >= 0; index--) {
      const v = this.vehicles[index], { trip } = v.event;
      const manual = this.game.shifts?.active?.vehicle === v;
      if (now !== undefined && !v.visible && !v.waitingForSpace && now < v.event.end) {
        v.followSchedule(this.timetable.state(v.event, now));
      }
      v.route.posAt(v.s, v.side, frontPoint);
      const near = player === v || (frontPoint.x - px) ** 2 + (frontPoint.z - pz) ** 2 < VIEW_DISTANCE ** 2;
      const finished = v.stopIndex >= v.stops.length && v.s >= trip.endS - 0.02;
      const grace = near && v.waitingForSpace ? 3600 : 0;
      if (!manual && (finished || now >= v.event.end + grace && (!near || !v.visible))) {
        if (this.game.ride === v) this.game._alight(true);
        this._dispose(v);
        this.vehicles.splice(index, 1);
        this.active.delete(v.event.key);
        continue;
      }
      if (!near) {
        this._show(v, false);
        v.waitingForSpace = false;
        v.trafficStop = null;
        v.x = frontPoint.x;
        v.z = frontPoint.z;
        continue;
      }
      const wasVisible = v.visible, wasOpen = v.doorsOpen;
      if (!v.visible) {
        v.y = this._routeSurface(v, frontPoint);
        if (!this._spawnSpace(v, nearby)) { v.waitingForSpace = true; continue; }
        v.waitingForSpace = false;
        if (v.wait > 0) v.wait = Math.max(v.wait, STOP_DWELL * 0.7);
        v.v = v.wait > 0 ? 0 : 6.5;
        this._show(v, true);
        nearby.push(v);
      }
      if (manual) {
        this._roadLane(v, dt);
        v.route.posAt(v.s, v.side, frontPoint);
        const limit = v.isTram ? 40 / 3.6 : v.roadLimit;
        v.shiftLimit = Math.round(limit * 3.6);
        this.game.shifts.drive(v, dt, controls, limit, frontPoint, nearby, cars);
      } else this._drive(v, dt, now, nearby, cars, playerOnFoot, player);
      this._pose(v, dt);
      if (dt > 0 && (v.doorsOpen !== wasOpen || !wasVisible && v.doorsOpen && v.justDispatched)) {
        this.game.audio.transitDoors(v, v.doorsOpen, v.stopTarget?.[1]);
        if (!v.doorsOpen && v.isTram && v.stopIndex < v.stops.length) this.game.audio.bell(v);
      }
      v.justDispatched = false;
    }
  }

  boardable(x, z, y) {
    let best = null, distance = Infinity;
    for (const v of this.vehicles) {
      if (!v.visible || !v.canBoard || Math.abs(v.y - y) > 2.5) continue;
      for (const [index, mesh] of v.meshes.entries()) {
        const dx = x - mesh.position.x, dz = z - mesh.position.z;
        const fx = Math.sin(mesh.rotation.y), fz = Math.cos(mesh.rotation.y);
        const across = dz * fx - dx * fz, along = dx * fx + dz * fz;
        if (across < 0.8) continue;
        const doors = v.sections[index].doors;
        for (let i = 0; i < (v.doors ? 1 : doors.length); i++) {
          const door = doors[i];
          const d = (across - 2.6) ** 2 + (along - door) ** 2;
          if (d < 5.5 ** 2 && d < distance) { distance = d; best = v; }
        }
      }
    }
    return best;
  }

  /** Výstup u pravých předních dveří, podle natočení předního článku. */
  exitPoint(v, out) {
    const mesh = v.meshes?.[0];
    const longitudinal = v.sections[0].doors[0];
    const yaw = mesh?.rotation.y ?? v.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let offset = 0;
    if (v.isTatra) offset = v.sections[0].length / 2;
    else if (v.isTram) offset = (v.sections[0].length + v.sections[1].length) / 2;
    const x = mesh?.position.x ?? v.x + fx * offset;
    const z = mesh?.position.z ?? v.z + fz * offset;
    out.x = x + fx * longitudinal - fz * 2.6;
    out.z = z + fz * longitudinal + fx * 2.6;
    return out;
  }
}
