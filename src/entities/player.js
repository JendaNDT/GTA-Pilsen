import { effectsRandom, simulationRandom } from '../game/random.js';
import { nearStationPlatform, stationEntrance, stationTicket, stepStationWalk } from './station-walk.js';
import { followParkTrip, parkCrossing, parkTrip } from './pedestrian-walks.js';
import { servicePlatform, stepPassenger, waitAtDeparturePlatform } from './platform-passengers.js';
import { EDGE_MARGIN } from '../world/travel-bounds.js';
import { sampleWater, waterWalking } from '../world/water-profile.js';
// Hráč pěšky a chodci.
import { WalkingCharacter } from '../physics/character.js';
import { makePedMesh, poseCharacter } from './models.js';
import { LANDING_TIME, landingStrength, phaseRate } from './character-pose.js';
import { ORIGINAL_CHARACTER } from './character-shape.js';
import { QUALITY, RC, RF } from '../config.js';
import { wrapAngle } from './vehicles.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _pt = { x: 0, z: 0, tx: 0, tz: 1 };

export class Player {
  constructor(scene, world, physics, colliders) {
    this.world = world;
    this.mesh = makePedMesh(0, true);
    scene.add(this.mesh);
    this.x = 0; this.y = 0; this.z = 0; this.vy = 0; this.yaw = 0;
    this.vx = 0; this.vz = 0;
    this.health = 100;
    this.phase = 0;
    this.grounded = true;
    this.swimming = false;
    this.wading = 0;
    this.waterContact = false;
    this.water = {};
    this.radius = 0.35; this.halfLen = 0.4;
    this.fallStart = 0;
    this.stun = 0;
    this.lastCar = null;
    this.physics = physics;
    this.colliders = colliders;
    this.character = null;
    this.streetContact = { x: 0, z: 0, depth: 0 };
    // stav pro pohyby postavy (character-pose.js)
    this.time = 0; this.idle = 0; this.landing = 0; this.landingPower = 0; this.airVy = 0; this.turn = 0;
    this.pose = { speed: 0, phase: 0, time: 0, idle: 0, grounded: true, vy: 0, landing: 0, swimming: false, turn: 0, seed: 0 };
  }

  setWalking(active) {
    if (active && !this.character) this.character = new WalkingCharacter(this.physics, this);
    if (!active && this.character) {
      this.character.dispose();
      this.character = null;
    }
  }

  leaveVehicle(x, z, y) {
    this.place(x, z, this.colliders.exitHeight(x, z, y));
    this.setWalking(true);
    this.mesh.visible = true;
  }

  /** Postaví hráče na místo; bez výšky na zem (ne na most vysoko nad terénem). */
  place(x, z, y = null) {
    const w = this.world;
    this.x = x; this.z = z;
    this.y = y === null ? w.groundY(x, z, w.heightAt(x, z) + 1) : y;
    this.vy = 0; this.vx = this.vz = 0; this.grounded = true;
    this.fallStart = this.y;
    this.turn = 0;
    this.swimming = false;
    this.wading = 0;
    this.waterContact = false;
    this.character?.place(this.x, this.y, this.z);
    this.sync(0);
  }

  /** dirX/dirZ = požadovaný směr pohybu ve světě (délka 0–1). */
  update(dt, dirX, dirZ, runAmount, jump) {
    const w = this.world;
    const len = Math.hypot(dirX, dirZ);
    const water = this.water;
    this.waterContact = w.isWater(this.x, this.z) &&
      this.y <= sampleWater(w, this.x, this.z, water).level + 0.3 &&
      (!w.onRoad(this.x, this.z, 0.3) || w.deckAt(this.x, this.z, Infinity) > this.y + 1.8);
    this.wading = this.waterContact && w.improvedWater
      ? waterWalking(water.depth, water.level - this.y, this.swimming) : 0;
    this.swimming = this.waterContact && (!w.improvedWater || this.wading === 1);
    const drySpeed = 2.4 + 4 * runAmount;
    let speed = this.swimming ? 1.7 : drySpeed * (1 - this.wading * 0.76);
    if (this.stun > 0) { this.stun -= dt; speed = 0; jump = false; }
    const yawBefore = this.yaw;
    let tvx = 0, tvz = 0;
    if (len > 0.05) {
      tvx = (dirX / Math.max(1, len)) * speed; tvz = (dirZ / Math.max(1, len)) * speed;
      const want = Math.atan2(dirX, dirZ);
      this.yaw += clamp(wrapAngle(want - this.yaw), -12 * dt, 12 * dt);
    }
    if (this.swimming) {
      tvx += water.vx;
      tvz += water.vz;
    }
    const wasGrounded = this.grounded;
    const k = Math.min(1, dt * (this.grounded ? 12 : 2.5));
    this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
    this.setWalking(true);
    const tile = w.chunkIndex(this.x, this.z);
    if (tile >= 0 && !this.colliders.tiles.has(tile)) this.colliders.update(this.x, this.z);
    const fallDamage = this.character.move(dt, this, jump);
    const contact = this.streetContact;
    contact.x = this.x; contact.z = this.z; contact.depth = 0;
    w.collideStreetObjects(contact, this.radius, this.y + 0.15);
    const x = clamp(contact.x, w.playMinX + EDGE_MARGIN.foot, w.playMaxX - EDGE_MARGIN.foot);
    const z = clamp(contact.z, w.playMinZ + EDGE_MARGIN.foot, w.playMaxZ - EDGE_MARGIN.foot);
    if (x !== this.x || z !== this.z) {
      this.x = x; this.z = z;
      this.character.place(x, this.y, z);
    }
    const moving = Math.hypot(this.vx, this.vz);
    // fáze kroku podle uražené vzdálenosti (boty neklouzají), ve vodě rytmus temp
    if (ORIGINAL_CHARACTER) this.phase += dt * (3 + moving * 2.2);
    else this.phase += this.swimming ? (moving > 0.2 ? dt * Math.PI * 2 / 1.3 : 0) : phaseRate(moving) * dt;
    this.time += dt;
    this.idle = moving < 0.15 && this.grounded ? this.idle + dt : 0;
    if (!this.grounded) this.airVy = this.vy;
    if (this.grounded && !wasGrounded) {
      this.landingPower = landingStrength(this.airVy);
      this.landing = this.landingPower > 0 ? LANDING_TIME : 0;
    }
    this.landing = Math.max(0, this.landing - dt);
    this.turn += ((dt > 0 ? wrapAngle(this.yaw - yawBefore) / dt : 0) - this.turn) * Math.min(1, dt * 8);
    this.sync(moving);
    return fallDamage;
  }

  sync(moving) {
    // ve vodě je vidět hlava a ramena: při šlapání vody je postava rovně, při plavání skloněná
    const swimDepth = !this.swimming ? 0 : ORIGINAL_CHARACTER ? 1.05 : moving > 0.2 ? 1.17 : 1.3;
    const depth = this.swimming && this.world.improvedWater
      ? Math.max(0, swimDepth - (this.water.level - this.y)) : swimDepth;
    this.mesh.position.set(this.x, this.y - depth, this.z);
    this.mesh.rotation.y = this.yaw;
    const s = this.pose;
    s.speed = moving; s.phase = this.phase; s.time = this.time; s.idle = this.idle;
    s.grounded = this.grounded; s.vy = this.vy; s.swimming = this.swimming; s.turn = this.turn;
    s.landing = this.landing > 0 ? this.landingPower * Math.sin(Math.PI * Math.min(1, (LANDING_TIME - this.landing) / LANDING_TIME * 1.6 + 0.2)) ** 0.7 : 0;
    poseCharacter(this.mesh, s);
  }
}

class Ped {
  constructor(variant) {
    this.id = variant;
    this.mesh = makePedMesh(variant);
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.speed = 1.2 + simulationRandom() * 0.5;
    this.edge = -1; this.s = 0; this.side = 0;
    this.state = 'walk'; this.timer = 0; this.phase = effectsRandom() * 6;
    this.vx = 0; this.vz = 0; this.fx = 0; this.fz = 0;
    this.radius = 0.35; this.halfLen = 0.4;
  }
}

export class PedManager {
  constructor(scene, world, game) {
    this.scene = scene; this.world = world; this.game = game;
    this.peds = [];
    this.timer = 0;
    this.seq = 1;
  }

  _sideFor(e) {
    const w = this.world, road = w.eRoad[e];
    return w.r.w[road] / 2 + 1.75;
  }

  spawn(px, pz, cam) {
    const w = this.world;
    const a = simulationRandom() * Math.PI * 2, d = 35 + simulationRandom() * 110;
    const sampleX = px + Math.cos(a) * d, sampleZ = pz + Math.sin(a) * d;
    const trip = w.sady && Math.abs(sampleX) < 450 && Math.abs(sampleZ) < 350 && simulationRandom() < 0.55
      ? parkTrip(sampleX, sampleZ) : null;
    if (trip && Math.hypot(px - trip.x, pz - trip.z) > 32 && !w.blocked(trip.x, trip.z, 0.4) &&
        !this.peds.some(p => Math.hypot(p.x - trip.x, p.z - trip.z) < 2)) {
      const p = this._person(trip.x, trip.z);
      p.trip = trip;
      return;
    }
    const ci = w.chunkIndex(sampleX, sampleZ);
    if (ci < 0) return;
    const list = w.trafficEdges[ci];
    if (!list) return;
    const e = list[Math.floor(simulationRandom() * list.length)];
    const cls = w.r.cls[w.eRoad[e]];
    if (cls < RC.PRIMARY || (w.r.flags[w.eRoad[e]] & (RF.BRIDGE | RF.TUNNEL))) return;
    const s = simulationRandom() * w.eLen[e];
    const side = this._sideFor(e);
    w.edgePoint(e, s, side, _pt);
    const dd = Math.hypot(_pt.x - px, _pt.z - pz);
    if (dd < 30 || dd > 170) return;
    if (cam && dd < 70) {
      const dot = ((_pt.x - cam.x) * cam.fx + (_pt.z - cam.z) * cam.fz) / (Math.hypot(_pt.x - cam.x, _pt.z - cam.z) || 1);
      if (dot > 0.5) return;
    }
    if (w.blocked(_pt.x, _pt.z, 0.5) || w.isWater(_pt.x, _pt.z)) return;
    if (simulationRandom() >= this.game.trafficRhythm.pedestrianWeight(_pt.x, _pt.z, this.game.clock)) return;
    const p = this._person(_pt.x, _pt.z);
    p.edge = e; p.s = s; p.side = side;
    p.yaw = Math.atan2(_pt.tx, _pt.tz);
  }

  _person(x, z) {
    const p = new Ped(this.seq++);
    p.x = x; p.z = z;
    p.y = this.world.walkY(x, z, this.world.heightAt(x, z) + 1);
    p.mesh.position.set(x, p.y, z);
    this.peds.push(p);
    this.scene.add(p.mesh);
    return p;
  }

  /** Chodec vyhozený z auta. */
  spawnAt(x, z, yaw) {
    const p = new Ped(this.seq++);
    p.x = x; p.z = z; p.yaw = yaw; p.state = 'flee'; p.timer = 5;
    p.y = this.world.walkY(x, z, this.world.heightAt(x, z) + 1);
    p.fx = Math.sin(yaw); p.fz = Math.cos(yaw);
    this.peds.push(p);
    this.scene.add(p.mesh);
    return p;
  }

  remove(i) {
    this.game.falls.finish(this.peds[i]);
    this.world.traffic.leaveCrossing(this.peds[i]);
    this.peds[i].mesh.skeleton.dispose();
    this.scene.remove(this.peds[i].mesh);
    this.peds.splice(i, 1);
  }

  resetStationDepartures() {
    this.lastDeparture = null;
    this.nextDepartureCheck = 0;
    for (let i = this.peds.length - 1; i >= 0; i--) {
      if (this.peds[i].ticket?.eventKey) this.remove(i);
    }
  }

  _startStationWalk(player, capacity) {
    const [x, z] = stationEntrance;
    const { clock, transit } = this.game;
    if ((x - player.x) ** 2 + (z - player.z) ** 2 > 165 ** 2 || clock.now < this.nextDepartureCheck) return;
    this.nextDepartureCheck = clock.now + 8;
    this.departureStation ??= transit.timetable.stops.findIndex(stop => stop[3] === '53408/1');
    const ticket = stationTicket(transit.timetable, this.departureStation, clock);
    if (!ticket || ticket.eventKey === this.lastDeparture || this.peds.length >= capacity) return;
    const p = this._person(x, z);
    p.ticket = ticket;
    p.stationWaypoint = 0;
    this.lastDeparture = ticket.eventKey;
  }

  _selectCrossing(p) {
    const list = this.world.traffic.crossingsByEdge.get(p.edge);
    if (!list) return;
    if (p.planEdge !== p.edge) {
      p.planEdge = p.edge;
      p.plan = (p.id + p.edge) % 3 !== 0 ? list.find((stop) => stop.s > p.s + 3) : null;
    }
    if (!p.plan || p.s < p.plan.s - 0.8) return;
    const { crossing, s } = p.plan;
    p.plan = null;
    const a = Math.hypot(crossing.a[0] - p.x, crossing.a[1] - p.z);
    const b = Math.hypot(crossing.b[0] - p.x, crossing.b[1] - p.z);
    if (Math.min(a, b) > 4) return;
    p.crossing = { crossing, s, from: a < b ? crossing.a : crossing.b, to: a < b ? crossing.b : crossing.a };
    p.state = 'crossApproach';
  }

  _stepCrossing(p, dt, cars) {
    const plan = p.crossing, traffic = this.world.traffic;
    if (p.state === 'crossWait') {
      if (!traffic.canWalk(plan.crossing, cars, this.game.transit.obstacles, p, this.game.weather)) return 0;
      traffic.waitingWalkers.delete(p);
      p.state = 'crossing';
      traffic.users.set(p, plan.crossing);
    }
    const onRoad = p.state === 'crossing';
    const target = onRoad ? plan.to : plan.from;
    const dx = target[0] - p.x, dz = target[1] - p.z, d = Math.hypot(dx, dz);
    const step = p.speed * dt;
    if (d <= step) {
      p.x = target[0]; p.z = target[1];
      if (onRoad) {
        traffic.users.delete(p);
        p.state = 'walk'; p.crossing = null;
        if (p.stationWaypoint !== undefined) p.stationWaypoint++;
        else if (p.trip) p.trip.index += p.trip.direction;
        else { p.s = plan.s + 0.2; p.side = -p.side; }
      } else {
        p.yaw = Math.atan2(plan.to[0] - p.x, plan.to[1] - p.z);
        p.state = 'crossWait';
        if (!plan.crossing.unmarked) traffic.waitingWalkers.set(p, plan.crossing);
      }
    } else {
      p.x += dx * step / d; p.z += dz * step / d;
      p.yaw = Math.atan2(dx, dz);
    }
    return p.speed;
  }

  update(dt, player, cam, cars) {
    const w = this.world;
    this.timer -= dt;
    if (this.timer <= 0) {
      const density = this.game.trafficRhythm.pedestrianWeight(player.x, player.z, this.game.clock);
      const target = Math.ceil(QUALITY.peds * (0.1 + 0.9 * density));
      for (const v of this.game.transit.vehicles) servicePlatform(this, v, player, target);
      this._startStationWalk(player, target);
      const waitingForTransit = this.peds.some(p => p.state === 'platform');
      const localLimit = target - Number(nearStationPlatform(player.x, player.z));
      const streetTarget = Math.min(localLimit, target - Number(waitingForTransit));
      this.timer = this.peds.length + 3 < streetTarget ? 0.13 : 0.2;
      if (this.peds.length < streetTarget) this.spawn(player.x, player.z, cam);
      if (this.peds.length > localLimit && cam) {
        const offscreen = this.peds.findIndex((p) => p.state === 'walk' && p.stationWaypoint === undefined &&
          (p.x - player.x) ** 2 + (p.z - player.z) ** 2 > 85 ** 2 &&
          (p.x - cam.x) * cam.fx + (p.z - cam.z) * cam.fz < 0);
        if (offscreen >= 0) this.remove(offscreen);
      }
    }
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      const d2 = (p.x - player.x) ** 2 + (p.z - player.z) ** 2;
      if (d2 > 230 * 230) { this.remove(i); continue; }
      let moving = 0;
      if (this.game.falls.active.has(p)) continue;
      const surface = w.walkY(p.x, p.z, p.y);
      if (p.y - surface > 5 && this.game.falls.enabled && d2 <= 80 ** 2) {
        w.traffic.leaveCrossing(p); p.crossing = null;
        p.state = 'down';
        this.game.falls.start(p, 0, -1, 0);
        continue;
      }
      p.y = surface;
      if (p.state === 'down') {
        p.timer -= dt;
        p.x += p.vx * dt; p.z += p.vz * dt;
        p.vx *= Math.exp(-3 * dt); p.vz *= Math.exp(-3 * dt);
        if (w.collideCircle(p.x, p.z, 0.35, p.y + 0.2, p.y + 1.5)) { p.x = w.hit.x; p.z = w.hit.z; }
        p.mesh.rotation.set(-Math.PI / 2 * Math.min(1, (7 - p.timer) * 4), p.yaw, 0, 'YXZ');
        p.mesh.position.set(p.x, p.y + 0.18, p.z);
        if (p.timer <= 0) { p.state = 'flee'; p.timer = 4; p.mesh.rotation.set(0, p.yaw, 0); }
        continue;
      }
      // nebezpečí: rychlé auto mířící na chodce
      if (d2 < 60 * 60) {
        for (const c of cars) {
          const dx = p.x - c.x, dz = p.z - c.z;
          const dd = dx * dx + dz * dz;
          if (dd > 100 || Math.abs(p.y - c.y) > 2) continue;
          const sp = Math.hypot(c.vx, c.vz);
          const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
          if (sp > 4 && p.state === 'walk') {
            const approaching = -(dx * c.vx + dz * c.vz) / (Math.sqrt(dd) * sp + 1e-6);
            if (approaching < -0.75 && dd < 64) {
              p.state = 'flee'; p.timer = 1.6;
              const sgn = (dx * fz - dz * fx) >= 0 ? 1 : -1;
              p.fx = fz * sgn; p.fz = -fx * sgn;
            }
          }
        }
      }
      if (p.platformCooldown) p.platformCooldown = Math.max(0, p.platformCooldown - dt);
      if (p.state === 'board' || p.state === 'alight' || p.state === 'platform') {
        moving = stepPassenger(p, dt);
        if (p.state === 'aboard') { this.remove(i); continue; }
      } else if (p.crossing) {
        moving = this._stepCrossing(p, dt, cars);
      } else if (p.state === 'flee') {
        p.timer -= dt;
        const sp = 4.6;
        p.x += p.fx * sp * dt; p.z += p.fz * sp * dt;
        p.yaw = Math.atan2(p.fx, p.fz);
        if (w.collideCircle(p.x, p.z, 0.35, p.y + 0.2, p.y + 1.7)) { p.x = w.hit.x; p.z = w.hit.z; }
        moving = sp;
        if (p.timer <= 0) {
          if (p.edge < 0 && p.stationWaypoint === undefined) { this.remove(i); continue; }
          p.state = 'walk';
        }
      } else if (p.stationWaypoint !== undefined) {
        if (stepStationWalk(p, dt)) {
          if (!p.ticket) { this.remove(i); continue; }
          waitAtDeparturePlatform(p, w, this.game.clock.now);
        }
        moving = p.speed;
      } else if (p.trip) {
        p.crossing = parkCrossing(p.trip);
        if (p.crossing) {
          p.state = 'crossApproach';
          moving = this._stepCrossing(p, dt, cars);
        } else {
          moving = followParkTrip(p, dt);
          if (w.collideCircle(p.x, p.z, 0.31, p.y + 0.24, p.y + 1.6)) {
            p.x = w.hit.x; p.z = w.hit.z;
          }
        }
      } else if (p.edge >= 0) {
        this._selectCrossing(p);
        if (p.crossing) {
          p.mesh.position.set(p.x, p.y, p.z);
          continue;
        }
        p.s += p.speed * dt;
        const len = w.eLen[p.edge];
        if (p.s >= len) {
          // na křižovatce pokračuj jinou ulicí
          const node = w.eTo[p.edge];
          const rev = w.reverseEdge(p.edge);
          const opts = [];
          for (let q = w.outStart[node], qe = w.outStart[node + 1]; q < qe; q++) {
            const f = w.outEdges[q];
            const cls = w.r.cls[w.eRoad[f]];
            if (f !== rev && cls >= RC.PRIMARY && cls <= RC.LIVING) opts.push(f);
          }
          const nxt = opts.length ? opts[Math.floor(simulationRandom() * opts.length)] : rev;
          if (nxt < 0) { this.remove(i); continue; }
          p.edge = nxt; p.s = 0; p.side = this._sideFor(nxt);
        }
        w.edgePoint(p.edge, p.s, p.side, _pt);
        const dx = _pt.x - p.x, dz = _pt.z - p.z;
        const dl = Math.hypot(dx, dz);
        if (dl > 0.01) {
          const step = Math.min(dl, (p.speed + 1.2) * dt);
          p.x += (dx / dl) * step; p.z += (dz / dl) * step;
          p.yaw += clamp(wrapAngle(Math.atan2(dx, dz) - p.yaw), -6 * dt, 6 * dt);
        }
        moving = p.speed;
      }
      p.phase += ORIGINAL_CHARACTER ? dt * (3 + moving * 2.4) : phaseRate(moving) * dt;
      p.time = (p.time ?? 0) + dt;
      p.idle = moving < 0.15 ? (p.idle ?? 0) + dt : 0;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y = p.yaw;
      if (d2 < 120 * 120) {
        const pose = p.pose ??= { grounded: true, calm: 1, seed: p.phase };
        pose.speed = moving; pose.phase = p.phase; pose.time = p.time; pose.idle = p.idle;
        poseCharacter(p.mesh, pose);
      }
    }
  }
}
