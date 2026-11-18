// Auta: jízdní fyzika hráče, běžný provoz, zaparkovaná auta a policie.
import { driveRoute } from '../game/ai-driver.js';
import * as THREE from 'three/webgpu';
import { CAR_TYPES, CAR_COLORS, makeCarMesh } from './models.js';
import { QUALITY, RC, RF, DRIVABLE_MAX, CHUNK } from '../config.js';

const _pt = { x: 0, z: 0, tx: 0, tz: 1 };
const _pt2 = { x: 0, z: 0, tx: 0, tz: 1 };
const _road = {};
const TRAFFIC_TYPES = ['hatch', 'hatch', 'hatch', 'sedan', 'sedan', 'kombi', 'kombi', 'suv', 'suv', 'van', 'pickup', 'sport', 'taxi'];

export const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Car {
  constructor(typeId, color) {
    this.typeId = typeId;
    this.type = CAR_TYPES[typeId];
    this.color = color;
    this.mesh = makeCarMesh(typeId, color);
    this.x = 0; this.z = 0; this.y = 0; this.yaw = 0;
    this.vx = 0; this.vz = 0; this.speed = 0; this.steer = 0;
    this.skid = 0;
    this.mode = 'parked';        // parked | ai | player | loose | police
    this.health = 100;
    this.edge = -1; this.s = 0; this.next = -1; this.lane = 0; this.nextLane = 0; this.turnSlow = 99;
    this.exitPlan = [];
    this.blocked = 0; this.temper = 0.8 + Math.random() * 0.25;
    this.rest = 0; this.wasAI = false;
    this.route = null; this.wp = 0; this.repath = 0;
    this.turnContext = 0; this.trafficStop = null;
    this.halfLen = this.type.len / 2;
    this.radius = this.type.wid * 0.56;
    this.roll = 0; this.pitch = 0;       // náklon karoserie v zatáčce
    this.gPitch = 0; this.gRoll = 0;     // sklon podle terénu
    this.vy = 0; this.air = false;
    this.offroad = false; this.offroadCheck = 0;
    this.isCar = true;
  }

  /** Postaví auto na místo; bez výšky na zem (hint = výška, ze které se hledá povrch, např. pro most). */
  place(x, z, yaw, hint = null) {
    this.physicsTeleport = true;
    this.skid = 0;
    this.pitch = this.roll = this.gRoll = this.steer = 0;
    const w = Car.world;
    this.x = x; this.z = z; this.yaw = yaw; this.vx = this.vz = 0; this.speed = 0; this.vy = 0; this.air = false;
    this.turnContext = 0; this.trafficStop = null;
    this.exitPlan.length = 0;
    this.y = w.groundY(x, z, hint === null ? w.heightAt(x, z) + 1 : hint);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), hl = this.type.len * 0.36;
    this.gPitch = Math.atan2(w.groundY(x - fx * hl, z - fz * hl, this.y + 1) - w.groundY(x + fx * hl, z + fz * hl, this.y + 1), 2 * hl);
    this.sync();
  }

  sync() {
    const m = this.mesh;
    m.position.set(this.x, this.y, this.z);
    m.rotation.set(this.gPitch + this.pitch, this.yaw, this.gRoll + this.roll, 'YXZ');
  }

  get kinematic() { return this.mode === 'ai' || this.mode === 'police' || this.mode === 'parked'; }
}

export class VehicleManager {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.cars = [];
    this.spawnTimer = 0;
    this.obstacles = [];       // další překážky pro provoz (tramvaje, hráč pěšky): {x, y, z, vx, vz, halfLen, radius}
    this.crashPoints = 0;
    Car.world = world;
  }

  /**
   * Přizpůsobí výšku a sklon auta povrchu (terén nebo mostovka).
   * dynamic = auto může letět vzduchem (skok přes hranu, pád z mostu) a svah ho zrychluje.
   */
  followGround(car, dt, dynamic) {
    const w = this.world;
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const hl = car.type.len * 0.36, hint = car.y;
    const yf = w.groundY(car.x + fx * hl, car.z + fz * hl, hint), yr = w.groundY(car.x - fx * hl, car.z - fz * hl, hint);
    const g = (yf + yr) / 2;
    let impact = 0;
    if (!dynamic) {
      car.y = g; car.air = false;
      car.gPitch = Math.atan2(yr - yf, 2 * hl);
      return 0;
    }
    const hwid = car.type.wid * 0.42, lx = fz, lz = -fx;
    const yL = w.groundY(car.x + lx * hwid, car.z + lz * hwid, hint), yR = w.groundY(car.x - lx * hwid, car.z - lz * hwid, hint);
    // svislá rychlost, jakou auto stoupá nebo klesá, když kopíruje povrch
    const slopeV = (car.vx * fx + car.vz * fz) * (yf - yr) / (2 * hl);
    // setrvačnost: kam by auto doletělo volným pádem; když je to nad povrchem, je ve vzduchu
    const vyb = car.vy - 21 * dt, yb = car.y + vyb * dt;
    if (yb > g + 0.03) {
      car.y = yb; car.vy = vyb;
      car.air = yb - g > 0.25;
    } else {
      if (car.air) impact = slopeV - car.vy;        // dopad: o kolik rychleji auto padalo, než klesá povrch
      car.y = g; car.vy = slopeV; car.air = false;
    }
    const k = Math.min(1, dt * (car.air ? 2 : 12));
    car.gPitch += (Math.atan2(yr - yf, 2 * hl) - car.gPitch) * k;
    car.gRoll += (Math.atan2(yL - yR, 2 * hwid) - car.gRoll) * k;
    if (!car.air) {
      // svah: do kopce auto zpomaluje, z kopce se rozjíždí
      const slope = clamp((yf - yr) / (2 * hl), -0.5, 0.5);
      car.vx -= fx * 9.0 * slope * dt; car.vz -= fz * 9.0 * slope * dt;
    }
    if (impact > 8) {
      car.health = Math.max(0, car.health - (impact - 8) * 3);
      this.game.onCrash(car, impact, null);
    }
    return impact;
  }

  add(car) { this.cars.push(car); this.scene.add(car.mesh); return car; }

  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    this.game.trafficBodies?.removeCar(car);
    this.game.garage?.onRemove(car);
    this.game.audio.remove(car);
    this.scene.remove(car.mesh);
    if (car.mesh.userData.beacons) for (const b of car.mesh.userData.beacons) b.material.dispose();
  }

  countMode(mode) { let n = 0; for (const c of this.cars) if (c.mode === mode) n++; return n; }

  // ------------------------------------------------------ fyzika hráče ----
  /** Dynamický krok auta (hráč nebo „volné“ auto po nárazu). */
  stepDynamic(car, dt, throttle, steerIn, handbrake) {
    const w = this.world, t = car.type;
    // povrch (jen občas, je to drahé)
    car.offroadCheck -= dt;
    if (car.offroadCheck <= 0) {
      car.offroadCheck = 0.25;
      car.offroad = w.isSoft(car.x, car.z) && !w.onRoad(car.x, car.z, 1.0);
    }
    const damage = car.health < 30 ? 0.55 + car.health / 66 : 1;
    const maxSpeed = t.maxSpeed * (car.offroad ? 0.5 : 1) * damage;
    let fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    let vF = car.vx * fx + car.vz * fz;

    // řízení
    const sp = Math.abs(vF);
    // čím rychleji auto jede, tím méně se dají stočit kola (omezení bočního přetížení)
    const wb = t.len * 0.62;
    const maxSteer = Math.min(0.62, Math.atan((wb * (handbrake ? 26 : 17)) / Math.max(1, sp * sp)));
    const target = steerIn * maxSteer;
    car.steer += (target - car.steer) * Math.min(1, dt * (Math.abs(target) > Math.abs(car.steer) ? 7 : 11));
    const wheelbase = t.len * 0.62;
    const yawRate = (vF / wheelbase) * Math.tan(car.steer) * (handbrake && sp > 6 ? 1.35 : 1);
    car.yaw -= yawRate * dt;
    fx = Math.sin(car.yaw); fz = Math.cos(car.yaw);
    const lx = Math.cos(car.yaw), lz = -Math.sin(car.yaw);
    vF = car.vx * fx + car.vz * fz;
    let vL = car.vx * lx + car.vz * lz;

    // motor a brzdy
    const brake = car.upgrades?.brakes ? 21 : 16;
    if (throttle > 0) {
      if (vF < -0.6) vF = Math.min(0, vF + brake * dt * throttle);
      else vF += t.accel * throttle * Math.max(0, 1 - Math.pow(Math.max(0, vF) / maxSpeed, 1.6)) * dt;
    } else if (throttle < 0) {
      if (vF > 0.6) vF = Math.max(0, vF + brake * dt * throttle);
      else if (vF > -9) vF += t.accel * 0.7 * throttle * dt;
    } else {
      const dec = 1.1 * dt;
      vF = Math.abs(vF) < dec ? 0 : vF - Math.sign(vF) * dec;
    }
    vF -= vF * (0.06 + 0.0028 * Math.abs(vF) + (car.offroad ? 0.5 : 0)) * dt;
    if (vF > maxSpeed) vF -= (vF - maxSpeed) * Math.min(1, dt * 2);
    if (handbrake) { const dec = 9 * dt; vF = Math.abs(vF) < dec ? 0 : vF - Math.sign(vF) * dec; }
    const grip = (handbrake ? 1.6 : t.grip * (car.upgrades?.tires ? 1.25 : 1)) * (car.offroad ? 0.6 : 1);
    const slip = Math.abs(vL);
    vL *= Math.exp(-grip * dt);
    car.skid = slip > 3.5 && sp > 5 ? Math.min(1, slip / 9) : 0;

    if (!car.air) { car.vx = fx * vF + lx * vL; car.vz = fz * vF + lz * vL; }
    car.speed = car.vx * fx + car.vz * fz;
    car.x += car.vx * dt; car.z += car.vz * dt;

    // náklony karoserie
    car.roll += (clamp(-yawRate * vF * 0.012, -0.09, 0.09) - car.roll) * Math.min(1, dt * 6);
    this._collideWorld(car);
    this.followGround(car, dt, true);
  }

  _collideWorld(car) {
    const w = this.world;
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const off = car.type.len * 0.31, r = car.type.wid * 0.5;
    let impact = 0;
    for (let k = -1; k <= 1; k++) {
      const ox = fx * off * k, oz = fz * off * k;
      const cx = car.x + ox, cz = car.z + oz;
      if (!w.collideCircle(cx, cz, r, car.y + 0.3, car.y + 1.5)) continue;
      const h = w.hit;
      const dx = h.x - cx, dz = h.z - cz;
      car.x += dx; car.z += dz;
      if (k !== 0) car.yaw += clamp((dx * oz - dz * ox) / (off * off), -0.08, 0.08) * 0.6;
      const vn = car.vx * h.nx + car.vz * h.nz;
      if (vn < 0) {
        car.vx -= 1.2 * vn * h.nx; car.vz -= 1.2 * vn * h.nz;
        car.vx *= 0.94; car.vz *= 0.94;
        impact = Math.max(impact, -vn);
      }
    }
    // okraj mapy
    const m = 30;
    if (car.x < w.playMinX + m) { car.x = w.playMinX + m; if (car.vx < 0) car.vx *= -0.3; }
    if (car.x > w.playMaxX - m) { car.x = w.playMaxX - m; if (car.vx > 0) car.vx *= -0.3; }
    if (car.z < w.playMinZ + m) { car.z = w.playMinZ + m; if (car.vz < 0) car.vz *= -0.3; }
    if (car.z > w.playMaxZ - m) { car.z = w.playMaxZ - m; if (car.vz > 0) car.vz *= -0.3; }
    if (impact > 3) {
      car.health = Math.max(0, car.health - (impact - 3) * 1.5);
      this.game.onCrash(car, impact, null);
    }
  }

  // ------------------------------------------------------------ provoz ----
  _edgeTangent(e, atEnd, out) {
    const w = this.world;
    const A = w.eA[e], B = w.eB[e], step = A < B ? 1 : -1;
    const a = atEnd ? B - step : A, b = atEnd ? B : A + step;
    const dx = w.rpx[b] - w.rpx[a], dz = w.rpz[b] - w.rpz[a];
    const l = Math.hypot(dx, dz) || 1;
    out.tx = dx / l; out.tz = dz / l;
    return out;
  }

  _laneFor(e) {
    const w = this.world, road = w.eRoad[e];
    const width = w.r.w[road];
    if (w.r.flags[road] & RF.ONEWAY) {
      const lanes = w.r.lanes[road];
      return lanes >= 2 ? (Math.random() < 0.5 ? -1 : 1) * width / 4 : 0;
    }
    return Math.max(1.25, width / 4);
  }

  _nextMove(e, context) {
    const w = this.world;
    const node = w.eTo[e];
    const rev = w.reverseEdge(e);
    this._edgeTangent(e, true, _pt);
    const ex = _pt.tx, ez = _pt.tz;
    let total = 0;
    const cands = [];
    for (let q = w.outStart[node], qe = w.outStart[node + 1]; q < qe; q++) {
      const f = w.outEdges[q];
      if (f === rev) continue;
      const road = w.eRoad[f], cls = w.r.cls[road];
      if (cls > RC.LIVING || w.turnContext(e, f, context) < 0) continue;
      this._edgeTangent(f, false, _pt2);
      const cos = ex * _pt2.tx + ez * _pt2.tz;
      if (cos < -0.8) continue;
      const wt = (1 + 2.2 * Math.max(0, cos)) * (cls <= RC.TERTIARY_LINK ? 1.6 : 1);
      cands.push(f, wt, cos);
      total += wt;
    }
    if (!cands.length) {
      if (rev >= 0 && w.turnContext(e, rev, context) >= 0) {
        return { from: e, to: rev, lane: this._laneFor(rev), slow: 2.5 };
      }
      return { from: e, to: -1, lane: 0, slow: 99 };
    }
    let r = Math.random() * total;
    let pick = 0;
    for (let k = 0; k < cands.length; k += 3) { r -= cands[k + 1]; if (r <= 0) { pick = k; break; } }
    const to = cands[pick];
    const cos = cands[pick + 2];
    return { from: e, to, lane: this._laneFor(to), slow: cos > 0.92 ? 99 : 3.8 + 7 * Math.max(0, cos) };
  }

  _pickNext(car) {
    if (car.exitPlan[0]?.from !== car.edge) car.exitPlan.length = 0;
    const move = car.exitPlan.shift() ?? this._nextMove(car.edge, car.turnContext);
    car.next = move.to;
    car.nextLane = move.lane;
    car.turnSlow = move.slow;
  }

  _planJunctionExit(car) {
    const w = this.world;
    let edge = car.next, distance = w.eLen[edge];
    let context = w.turnContext(car.edge, edge, car.turnContext);
    // Stejná rozhodnutí použije auto při průjezdu, i když spojka sama nepojme celé auto.
    while (distance < 42 && car.exitPlan.length < 3) {
      const move = this._nextMove(edge, context);
      car.exitPlan.push(move);
      if (move.to < 0) break;
      context = w.turnContext(edge, move.to, context);
      edge = move.to;
      distance += w.eLen[edge];
    }
  }

  _obstacleLimit(car, limit, ignore) {
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const lx = fz, lz = -fx;
    const check = (o) => {
      const dx = o.x - car.x, dz = o.z - car.z;
      if (dx * dx + dz * dz > 900 || Math.abs((o.y === undefined ? car.y : o.y) - car.y) > 3) return;
      const ahead = dx * fx + dz * fz;
      if (ahead < 0.4 || ahead > 28) return;
      const side = Math.abs(dx * lx + dz * lz);
      if (side > 1.25 + (o.radius || 1) * 0.6) return;
      const gap = ahead - car.halfLen - (o.halfLen || 1);
      const along = (o.vx || 0) * fx + (o.vz || 0) * fz;
      const allowed = Math.max(0, along * 0.95 + (gap - 2.2) * 1.3);
      if (allowed < limit) limit = allowed;
    };
    for (const o of this.cars) if (o !== car && o !== ignore) check(o);
    for (const o of this.obstacles) if (o !== ignore) check(o);
    return limit;
  }

  stepAI(car, dt, physical = null) {
    const w = this.world;
    if (physical) {
      w.edgePoint(car.edge, car.s, car.lane, _pt);
      const along = (car.x - _pt.x) * _pt.tx + (car.z - _pt.z) * _pt.tz;
      car.s = Math.max(0, car.s + along);
      this._advanceEdge(car);
      if (car.dead) return;
    }
    const road = w.eRoad[car.edge];
    const len = w.eLen[car.edge];
    const roadLimit = w.roadSpeed(road, w.eA[car.edge] < w.eB[car.edge]) / 3.6;
    let vmax = Math.min(roadLimit, Math.min(roadLimit, 15) * car.temper);
    const remain = len - car.s;
    if (car.next >= 0) {
      const nextLimit = w.roadSpeed(w.eRoad[car.next], w.eA[car.next] < w.eB[car.next]) / 3.6;
      vmax = Math.min(vmax, Math.sqrt(nextLimit ** 2 + 8 * Math.max(0, remain)));
      if (remain < 50 && w.eLen[car.next] < 42 && !car.exitPlan.length && w.traffic.byEdge.has(car.edge)) {
        this._planJunctionExit(car);
      }
    }
    if (remain < 24 && car.turnSlow < vmax) vmax = car.turnSlow + (vmax - car.turnSlow) * Math.max(0, (remain - 6) / 18);
    let limit = this._obstacleLimit(car, vmax, null);
    if (car.blocked > 12) limit = Math.max(limit, 1.2);       // po dlouhém čekání se zkus protlačit
    if (physical) {
      let gap = Infinity;
      limit = w.traffic.drivingLimit(car, dt, limit, this.cars, this.obstacles,
        (distance) => { gap = Math.min(gap, distance); });
      car.blocked = car.speed < 0.3 ? car.blocked + dt : 0;
      const pointAt = (look) => car.s + look <= len || car.next < 0
        ? w.edgePoint(car.edge, Math.min(len, car.s + look), car.lane, _pt)
        : w.edgePoint(car.next, car.s + look - len, car.nextLane, _pt);
      physical.input = driveRoute(car, pointAt, limit, gap, physical.input, dt);
      physical.driveAI(physical.input, dt, this.game.tireSurface);
      return;
    }
    if (car.speed < limit) car.speed = Math.min(limit, car.speed + 2.6 * dt);
    else car.speed = Math.max(limit, car.speed - 8 * dt);
    car.speed = w.traffic.drivingLimit(car, dt, car.speed, this.cars, this.obstacles);
    car.blocked = car.speed < 0.3 ? car.blocked + dt : 0;

    const look = 3.2 + car.speed * 0.45;
    const s2 = car.s + look;
    if (s2 <= len || car.next < 0) w.edgePoint(car.edge, Math.min(s2, len), car.lane, _pt);
    else w.edgePoint(car.next, s2 - len, car.nextLane, _pt);
    const want = Math.atan2(_pt.x - car.x, _pt.z - car.z);
    const diff = wrapAngle(want - car.yaw);
    const maxTurn = 2.6 * dt * Math.min(1, car.speed / 2.5 + 0.1);
    const turn = clamp(diff, -maxTurn, maxTurn);
    car.yaw += turn;
    car.steer = clamp(-diff * 1.5, -0.5, 0.5);
    car.vx = Math.sin(car.yaw) * car.speed; car.vz = Math.cos(car.yaw) * car.speed;
    car.x += car.vx * dt; car.z += car.vz * dt;
    this.followGround(car, dt, false);
    car.s += car.speed * dt;
    this._advanceEdge(car);
  }

  _advanceEdge(car) {
    const w = this.world, len = w.eLen[car.edge];
    if (car.s >= len) {
      if (car.next < 0) { car.dead = true; return; }
      car.turnContext = Math.max(0, w.turnContext(car.edge, car.next, car.turnContext));
      if (car.trafficStop?.rule.edge !== car.next) car.trafficStop = null;
      car.s -= len; car.edge = car.next; car.lane = car.nextLane;
      this._pickNext(car);
    }
  }

  /** Vrátí auto z režimu provozu do dynamického (po nárazu, vyhození řidiče…). */
  knock(car) {
    if (car.mode === 'ai' || car.mode === 'police') car.wasAI = car.mode;
    if (car.mode !== 'player') car.mode = 'loose';
    car.rest = 0;
  }

  _resumeAI(car) {
    const w = this.world;
    const r = w.nearestRoad(car.x, car.z, 9, RC.LIVING, 0, _road, car.y);
    if (!r) return false;
    let e = w.edgeOfPt[r.seg];
    if (e < 0) return false;
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    let along = r.dx * fx + r.dz * fz;
    if (along < 0) { const rev = w.reverseEdge(e); if (rev < 0) return false; e = rev; along = -along; }
    if (along < 0.3) return false;
    // vzdálenost od začátku hrany
    const A = w.eA[e], B = w.eB[e], step = A < B ? 1 : -1;
    let s = 0;
    for (let k = A; k !== B; k += step) {
      const lo = Math.min(k, k + step);
      const l = Math.hypot(w.rpx[k + step] - w.rpx[k], w.rpz[k + step] - w.rpz[k]);
      if (lo === r.seg) { s += step > 0 ? l * r.t : l * (1 - r.t); break; }
      s += l;
    }
    car.edge = e; car.s = s; car.lane = this._laneFor(e); car.turnContext = 0; car.trafficStop = null;
    car.exitPlan.length = 0;
    car.mode = car.wasAI === 'police' && this.game.wanted > 0 ? 'police' : 'ai';
    car.speed = 0; car.blocked = 0;
    this._pickNext(car);
    return true;
  }

  // ----------------------------------------------------------- policie ----
  stepPolice(car, dt, target) {
    const w = this.world;
    const dx = target.x - car.x, dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    let tx, tz;
    car.repath -= dt;
    const direct = dist < 55 && w.raycast(car.x, car.z, target.x, target.z, 1.2) >= 1;
    if (direct) {
      tx = target.x + (target.vx || 0) * 0.35; tz = target.z + (target.vz || 0) * 0.35;
      car.route = null;
    } else {
      if (car.repath <= 0 || !car.route) {
        car.repath = 1.2 + Math.random() * 0.6;
        const a = w.nearestNode(car.x, car.z, 80), b = w.nearestNode(target.x, target.z, 200);
        const path = w.findPath(a, b, 5000);
        if (path && path.length) {
          const pts = [w.nodeX[a], w.nodeZ[a]];
          for (const e of path) {
            const A = w.eA[e], B = w.eB[e], step = A < B ? 1 : -1;
            for (let k = A + step; ; k += step) { pts.push(w.rpx[k], w.rpz[k]); if (k === B) break; }
          }
          // navaž na trasu v místě, kde auto právě je (ne od uzlu za zády)
          let best = 1e18, bi = 2;
          for (let i = 0; i + 3 < pts.length && i < 80; i += 2) {
            const sx = pts[i + 2] - pts[i], sz = pts[i + 3] - pts[i + 1];
            const l2 = sx * sx + sz * sz;
            const t = l2 > 0 ? clamp(((car.x - pts[i]) * sx + (car.z - pts[i + 1]) * sz) / l2, 0, 1) : 0;
            const d = (pts[i] + sx * t - car.x) ** 2 + (pts[i + 1] + sz * t - car.z) ** 2;
            if (d < best) { best = d; bi = i + 2; }
          }
          car.route = pts; car.wp = bi;
        } else car.route = null;
      }
      if (car.route) {
        while (car.wp < car.route.length - 2 && Math.hypot(car.route[car.wp] - car.x, car.route[car.wp + 1] - car.z) < 7) car.wp += 2;
        tx = car.route[car.wp]; tz = car.route[car.wp + 1];
        // na konci silnice pokračuj rovnou za cílem (náměstí, park, dvůr)
        if (car.wp >= car.route.length - 2 && Math.hypot(tx - car.x, tz - car.z) < 12) { tx = target.x; tz = target.z; car.repath = 0.5; }
      } else { tx = target.x; tz = target.z; }
    }
    const want = Math.atan2(tx - car.x, tz - car.z);
    const diff = wrapAngle(want - car.yaw);
    let vmax = Math.min(34, car.type.maxSpeed * 0.62);
    vmax = 7 + (vmax - 7) * Math.max(0, Math.cos(diff)) ** 2;
    if (!target.isCar) vmax = Math.min(vmax, Math.sqrt(2 * 8 * Math.max(0, dist - 7)));   // chodce nepřejíždět: včas dobrzdit a zastavit u něj
    else if (dist < 14) vmax = Math.min(vmax, Math.max(4, Math.hypot(target.vx || 0, target.vz || 0) + dist * 0.6));
    let limit = this._obstacleLimit(car, vmax, target);
    if (car.blocked > 1.2) limit = Math.max(limit, 4);
    if (car.speed < limit) car.speed = Math.min(limit, car.speed + car.type.accel * 0.8 * dt);
    else car.speed = Math.max(limit, car.speed - 17 * dt);
    car.blocked = car.speed < 0.5 ? car.blocked + dt : 0;
    const maxTurn = 2.9 * dt * Math.min(1, car.speed / 3 + 0.15);
    car.yaw += clamp(diff, -maxTurn, maxTurn);
    car.steer = clamp(-diff * 1.5, -0.5, 0.5);
    car.vx = Math.sin(car.yaw) * car.speed; car.vz = Math.cos(car.yaw) * car.speed;
    car.x += car.vx * dt; car.z += car.vz * dt;
    this.followGround(car, dt, false);
    if (w.collideCircle(car.x, car.z, 1.0, car.y + 0.3, car.y + 1.5)) {
      car.x = w.hit.x; car.z = w.hit.z;
      car.speed *= 0.9;
      car.yaw += (Math.random() - 0.5) * 0.1;
    }
    car.policeDist = dist;
  }

  // ------------------------------------------------------- spawn/úklid ----
  _freeSpot(x, z, r) {
    for (const c of this.cars) {
      const d = r + c.halfLen;
      if ((c.x - x) ** 2 + (c.z - z) ** 2 < d * d) return false;
    }
    return true;
  }

  _randomEdgeNear(px, pz, minD, maxD, ambient) {
    const w = this.world;
    for (let tries = 0; tries < 12; tries++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const ci = w.chunkIndex(px + Math.cos(a) * d, pz + Math.sin(a) * d);
      if (ci < 0) continue;
      const measured = ambient ? this.game.trafficRhythm.measuredByChunk.get(ci) : null;
      const list = measured && Math.random() < 0.55 ? measured : w.trafficEdges[ci];
      if (!list) continue;
      const first = list[Math.floor(Math.random() * list.length)];
      if (!ambient) return first;
      // Krátké spojky v hustém grafu by jinak dostávaly stejnou šanci jako celé ulice.
      const second = list[Math.floor(Math.random() * list.length)];
      const score = (edge) => Math.min(w.eLen[edge], 250) / (1 + 0.06 * w.r.cls[w.eRoad[edge]]);
      return score(second) > score(first) ? second : first;
    }
    return -1;
  }

  spawnTraffic(px, pz, cam, { typeId = null, minD = 110, maxD = 300, ambient = true } = {}) {
    const w = this.world;
    const e = this._randomEdgeNear(px, pz, minD, maxD, ambient);
    if (e < 0) return null;
    const s = 2 + Math.random() * Math.max(0, w.eLen[e] - 8);
    const lane = this._laneFor(e);
    w.edgePoint(e, s, lane, _pt);
    const d = Math.hypot(_pt.x - px, _pt.z - pz);
    if (d < minD * 0.7 || d > maxD * 1.2) return null;
    // ne přímo před kamerou zblízka
    if (cam && (ambient || d < 190)) {
      const dot = ((_pt.x - cam.x) * cam.fx + (_pt.z - cam.z) * cam.fz) / (Math.hypot(_pt.x - cam.x, _pt.z - cam.z) || 1);
      if (dot > 0.45) return null;
    }
    if (ambient && Math.random() >= this.game.trafficRhythm.carWeight(e, this.game.clock)) return null;
    if (!this._freeSpot(_pt.x, _pt.z, 7)) return null;
    const type = typeId || TRAFFIC_TYPES[Math.floor(Math.random() * TRAFFIC_TYPES.length)];
    const car = this.add(new Car(type, CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]));
    car.mode = 'ai';
    car.edge = e; car.s = s; car.lane = lane;
    const y = w.roadSurfaceY(w.eRoad[e], _pt.seg, _pt.t, _pt.x, _pt.z);
    car.place(_pt.x, _pt.z, Math.atan2(_pt.tx, _pt.tz), y);
    car.speed = 6;
    car.vx = Math.sin(car.yaw) * car.speed; car.vz = Math.cos(car.yaw) * car.speed;
    this._pickNext(car);
    return car;
  }

  spawnParked(px, pz, cam) {
    const w = this.world;
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 200;
    const ci = w.chunkIndex(px + Math.cos(a) * d, pz + Math.sin(a) * d);
    if (ci < 0) return null;
    const pieces = w.rPieces[ci];
    if (!pieces) return null;
    const q = Math.floor(Math.random() * (pieces.length / 3)) * 3;
    const i = pieces[q], s = pieces[q + 1], e = pieces[q + 2];
    const R = w.r, cls = R.cls[i], flags = R.flags[i];
    const aisle = cls === RC.SERVICE && (flags & RF.AISLE);
    if (!(aisle || cls === RC.RESIDENTIAL || cls === RC.LIVING || cls === RC.UNCLASSIFIED || (cls === RC.TERTIARY && Math.random() < 0.4))) return null;
    if (flags & (RF.BRIDGE | RF.TUNNEL | RF.ROUNDABOUT)) return null;
    const k = s + Math.floor(Math.random() * (e - s));
    const x1 = w.rpx[k], z1 = w.rpz[k], x2 = w.rpx[k + 1], z2 = w.rpz[k + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 7) return null;
    const t = (3 + Math.random() * (len - 6)) / len;
    const tx = (x2 - x1) / len, tz = (z2 - z1) / len;
    const side = Math.random() < 0.5 ? 1 : -1;
    const hw = R.w[i] / 2;
    const typeId = TRAFFIC_TYPES[Math.floor(Math.random() * (TRAFFIC_TYPES.length - 1))];
    const off = aisle ? hw + 2.5 : hw + 0.8;
    const x = x1 + (x2 - x1) * t - tz * side * off, z = z1 + (z2 - z1) * t + tx * side * off;
    let yaw = Math.atan2(tx, tz);
    if (aisle) yaw += side * Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0);
    else if (side < 0) yaw += Math.PI;
    const dd = Math.hypot(x - px, z - pz);
    if (dd < 28) return null;
    if (cam && dd < 80) {
      const dot = ((x - cam.x) * cam.fx + (z - cam.z) * cam.fz) / (Math.hypot(x - cam.x, z - cam.z) || 1);
      if (dot > 0.5) return null;
    }
    if (!this._freeSpot(x, z, 3.4)) return null;
    if (w.blocked(x, z, 2.3, 0.3, 1.5) || w.isWater(x, z)) return null;
    // nesmí stát na jiné vozovce
    const r = w.nearestRoad(x, z, 8, DRIVABLE_MAX, 0, _road);
    if (r && r.dist < R.w[r.road] / 2 + (aisle ? 1.6 : 0.2)) return null;
    const car = this.add(new Car(typeId, CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]));
    car.mode = 'parked';
    car.place(x, z, yaw);
    return car;
  }

  spawnPolice(target, cam) {
    const car = this.spawnTraffic(target.x, target.z, cam, { typeId: 'police', maxD: 210, ambient: false });
    if (car) { car.mode = 'police'; car.repath = 0; car.speed = 10; }
    return car;
  }

  // ------------------------------------------------------------ kolize ----
  _resolveCars(player) {
    const cars = this.cars;
    const px = player.x, pz = player.z;
    const near = [];
    for (const c of cars) if (!c.physical && c !== this.game.driver?.car && (c.x - px) ** 2 + (c.z - pz) ** 2 < 90 * 90) near.push(c);
    for (let i = 0; i < near.length; i++) {
      const a = near[i];
      for (let j = i + 1; j < near.length; j++) {
        const b = near[j];
        if (a.kinematic && b.kinematic && !(a.mode === 'police' || b.mode === 'police')) continue;
        if (Math.abs(a.y - b.y) > 2.2) continue;
        const R = a.halfLen + b.halfLen + 0.6;
        const ddx = a.x - b.x, ddz = a.z - b.z;
        if (ddx * ddx + ddz * ddz > R * R) continue;
        const afx = Math.sin(a.yaw), afz = Math.cos(a.yaw), bfx = Math.sin(b.yaw), bfz = Math.cos(b.yaw);
        const ao = a.type.len * 0.27, bo = b.type.len * 0.27;
        for (let ka = -1; ka <= 1; ka += 2) for (let kb = -1; kb <= 1; kb += 2) {
          const ax = a.x + afx * ao * ka, az = a.z + afz * ao * ka;
          const bx = b.x + bfx * bo * kb, bz = b.z + bfz * bo * kb;
          const dx = ax - bx, dz = az - bz, rr = a.radius + b.radius;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-6) continue;
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d;
          const ma = a.type.mass * (a.mode === 'parked' ? 1.4 : 1), mb = b.type.mass * (b.mode === 'parked' ? 1.4 : 1);
          const fa = mb / (ma + mb), fb = ma / (ma + mb);
          a.x += nx * pen * fa; a.z += nz * pen * fa;
          b.x -= nx * pen * fb; b.z -= nz * pen * fb;
          const vr = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
          if (vr < 0) {
            const jimp = -(1.25) * vr / (1 / ma + 1 / mb);
            if (-vr > 1.2) { if (a.kinematic) this.knock(a); if (b.kinematic) this.knock(b); }
            if (!a.kinematic) { a.vx += (jimp / ma) * nx; a.vz += (jimp / ma) * nz; a.yaw += clamp((nx * afz - nz * afx) * ka * jimp * 0.012 / ma, -0.12, 0.12); }
            else a.speed *= 0.7;
            if (!b.kinematic) { b.vx -= (jimp / mb) * nx; b.vz -= (jimp / mb) * nz; b.yaw -= clamp((nx * bfz - nz * bfx) * kb * jimp * 0.012 / mb, -0.12, 0.12); }
            else b.speed *= 0.7;
            if (-vr > 2.5) {
              const dmg = (-vr - 2.5) * 1.0;
              a.health = Math.max(0, a.health - dmg * fa * 2); b.health = Math.max(0, b.health - dmg * fb * 2);
              this.game.onCrash(a, -vr, b);
            }
          }
        }
      }
    }
  }

  /** Kolize aut s kruhovými překážkami s nekonečnou hmotností (tramvaje). */
  _resolveHeavy(heavy) {
    for (const c of this.cars) {
      if (c.physical || c.kinematic || c === this.game.driver?.car) continue;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), o = c.type.len * 0.27;
      for (const h of heavy) {
        if (h.y !== undefined && Math.abs(h.y - c.y) > 3) continue;
        const R = c.halfLen + h.r + 0.5;
        if ((c.x - h.x) ** 2 + (c.z - h.z) ** 2 > R * R) continue;
        for (let k = -1; k <= 1; k += 2) {
          const cx = c.x + fx * o * k, cz = c.z + fz * o * k;
          const dx = cx - h.x, dz = cz - h.z, rr = c.radius + h.r;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr || d2 < 1e-6) continue;
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
          c.x += nx * (rr - d); c.z += nz * (rr - d);
          const vr = (c.vx - h.vx) * nx + (c.vz - h.vz) * nz;
          if (vr < 0) {
            c.vx -= 1.3 * vr * nx; c.vz -= 1.3 * vr * nz;
            if (-vr > 3) { c.health = Math.max(0, c.health - (-vr - 3) * 2.5); this.game.onCrash(c, -vr, null); }
          }
        }
      }
    }
  }

  // ------------------------------------------------------------- update ----
  update(dt, player, cam, heavy) {
    const w = this.world;
    const px = player.x, pz = player.z;
    // doplňování provozu a zaparkovaných aut
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.12;
      let ai = 0, parked = 0, police = 0;
      for (const c of this.cars) { if (c.mode === 'ai') ai++; else if (c.mode === 'parked') parked++; else if (c.mode === 'police') police++; }
      const density = this.game.trafficRhythm.carDensity(px, pz, this.game.clock);
      const target = Math.ceil(QUALITY.traffic * (0.12 + 0.88 * density));
      if (ai < target) this.spawnTraffic(px, pz, cam, { typeId: Math.random() < 0.035 ? 'police' : null });
      if (ai > target && cam) {
        const offscreen = this.cars.find((c) => c.mode === 'ai' && c !== player.lastCar &&
          (c.x - px) ** 2 + (c.z - pz) ** 2 > 190 ** 2 && (c.x - cam.x) * cam.fx + (c.z - cam.z) * cam.fz < 0);
        if (offscreen) this.remove(offscreen);
      }
      if (parked < QUALITY.parked) { this.spawnParked(px, pz, cam); this.spawnParked(px, pz, cam); }
      const wantPolice = Math.min(5, this.game.wanted);
      if (police < wantPolice) this.spawnPolice(player, cam);
    }

    const wanted = this.game.wanted;
    const lightsOn = this.game.env.night > 0.25;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      const d2 = (c.x - px) ** 2 + (c.z - pz) ** 2;
      if (c.mode === 'ai') {
        // policejní hlídka se při hledanosti přidá k pronásledování
        if (c.typeId === 'police' && wanted > 0 && d2 < 160 * 160) { c.mode = 'police'; c.repath = 0; }
        else if (!c.physical) this.stepAI(c, dt);
        if (c.dead || d2 > 420 * 420) { this.remove(c); continue; }
      } else if (c.mode === 'police') {
        if (wanted <= 0) { c.wasAI = 'ai'; if (!this._resumeAI(c)) { c.mode = 'loose'; c.wasAI = 'ai'; } }
        else this.stepPolice(c, dt, player);
        if (d2 > 520 * 520) { this.remove(c); continue; }
      } else if (c.mode === 'loose') {
        if (!c.physical) {
          this.stepDynamic(c, dt, 0, 0, Math.abs(c.speed) < 4);
          c.vx *= Math.exp(-1.2 * dt); c.vz *= Math.exp(-1.2 * dt);
        }
        if (Math.hypot(c.vx, c.vz) < 0.4) {
          c.rest += dt;
          if (c.rest > 3 && c.wasAI && c.health > 25 && !c.noDriver) { if (this._resumeAI(c)) c.wasAI = false; else if (c.rest > 8) c.wasAI = false; }
          else if (c.rest > 2.5 && (c.noDriver || !c.wasAI)) { c.mode = 'parked'; c.vx = c.vz = 0; c.speed = 0; }
        } else c.rest = 0;
        if (d2 > 380 * 380 && c !== this.game.garage?.active) { this.remove(c); continue; }
      } else if (c.mode === 'parked') {
        if (d2 > 330 * 330 && c !== player.lastCar && c !== this.game.garage?.active) { this.remove(c); continue; }
      }
      if (c.mesh.userData.light) c.mesh.userData.light.visible = QUALITY.carLights && lightsOn && c.mode !== 'parked' && !c.noLights && d2 < 300 * 300;
      if (c.mesh.userData.beacons) {
        const on = c.mode === 'police';
        const ph = Math.floor(this.game.time / 0.16) % 2;
        c.mesh.userData.beacons[0].visible = on && ph === 0;
        c.mesh.userData.beacons[1].visible = on && ph === 1;
      }
    }
    this._resolveCars(player);
    if (heavy && heavy.length) this._resolveHeavy(heavy);
    for (const c of this.cars) {
      if (c.mesh.userData.hazards) c.mesh.userData.hazards.visible =
        c.mode === 'loose' && c.crashed && Math.floor(this.game.time * 2.5) % 2 === 0;
      if (c.physical) c.physical.render(this.game.physics.clock.alpha);
      else c.sync();
    }
  }

  /** Nejbližší auto, do kterého jde nastoupit. */
  nearestEnterable(x, z, y, maxD = 3.6) {
    let best = null, bd = maxD * maxD;
    for (const c of this.cars) {
      if (c.mode === 'player' || Math.abs(c.y - y) > 2) continue;
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      const lim = (maxD + c.halfLen * 0.5) ** 2;
      if (d < lim && d < bd + 4) { if (!best || d < bd) { best = c; bd = d; } }
    }
    return best;
  }
}
