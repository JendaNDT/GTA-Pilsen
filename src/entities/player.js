// Hráč pěšky a chodci.
import { makePedMesh, animatePed } from './models.js';
import { QUALITY, RC, RF } from '../config.js';
import { wrapAngle } from './vehicles.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _pt = { x: 0, z: 0, tx: 0, tz: 1 };

export class Player {
  constructor(scene, world) {
    this.world = world;
    this.mesh = makePedMesh(0, true);
    scene.add(this.mesh);
    this.x = 0; this.y = 0; this.z = 0; this.vy = 0; this.yaw = 0;
    this.vx = 0; this.vz = 0;
    this.health = 100;
    this.phase = 0;
    this.grounded = true;
    this.swimming = false;
    this.radius = 0.35; this.halfLen = 0.4;
    this.fallStart = 0;
    this.stun = 0;
    this.lastCar = null;
  }

  /** Postaví hráče na místo; bez výšky na zem (ne na most vysoko nad terénem). */
  place(x, z, y = null) {
    const w = this.world;
    this.x = x; this.z = z;
    this.y = y === null ? w.groundY(x, z, w.heightAt(x, z) + 1) : y;
    this.vy = 0; this.vx = this.vz = 0; this.grounded = true;
    this.sync(0);
  }

  /** dirX/dirZ = požadovaný směr pohybu ve světě (délka 0–1). */
  update(dt, dirX, dirZ, run, jump) {
    const w = this.world;
    const len = Math.hypot(dirX, dirZ);
    this.swimming = this.y <= w.heightAt(this.x, this.z) + 0.3 && w.isWater(this.x, this.z) && !w.onRoad(this.x, this.z, 0.3);
    let speed = this.swimming ? 1.7 : run ? 6.4 : 2.4;
    if (this.stun > 0) { this.stun -= dt; speed = 0; }
    let tvx = 0, tvz = 0;
    if (len > 0.05) {
      tvx = (dirX / Math.max(1, len)) * speed; tvz = (dirZ / Math.max(1, len)) * speed;
      const want = Math.atan2(dirX, dirZ);
      this.yaw += clamp(wrapAngle(want - this.yaw), -12 * dt, 12 * dt);
    }
    const k = Math.min(1, dt * (this.grounded ? 12 : 2.5));
    this.vx += (tvx - this.vx) * k; this.vz += (tvz - this.vz) * k;
    this.x += this.vx * dt; this.z += this.vz * dt;

    if (w.collideCircle(this.x, this.z, this.radius, this.y + 0.15, this.y + 1.7)) {
      this.x = w.hit.x; this.z = w.hit.z;
    }
    const m = 20;
    this.x = clamp(this.x, w.playMinX + m, w.playMaxX - m);
    this.z = clamp(this.z, w.playMinZ + m, w.playMaxZ - m);

    // svislý pohyb: stojí se na zemi nebo na střeše, na kterou jde vystoupit
    const surface = w.surfaceAt(this.x, this.z, this.y + 0.55);
    if (this.grounded) {
      if (jump && !this.swimming) { this.vy = 5.0; this.grounded = false; this.fallStart = this.y; }
      else if (this.y > surface + 0.4) { this.grounded = false; this.vy = 0; this.fallStart = this.y; }   // hrana střechy, mostu
      else this.y = surface;                                                                             // svah: drž se země
    }
    let fallDamage = 0;
    if (!this.grounded) {
      this.vy -= 18 * dt;
      this.y += this.vy * dt;
      if (this.y <= surface && this.vy <= 0) {
        const drop = this.fallStart - surface;
        if (drop > 5) fallDamage = (drop - 5) * 6;
        this.y = surface; this.vy = 0; this.grounded = true;
      } else if (this.vy > 0) this.fallStart = Math.max(this.fallStart, this.y);
    }
    const moving = Math.hypot(this.vx, this.vz);
    this.phase += dt * (3 + moving * 2.2);
    this.sync(moving);
    return fallDamage;
  }

  sync(moving) {
    this.mesh.position.set(this.x, this.y - (this.swimming ? 1.05 : 0), this.z);
    this.mesh.rotation.y = this.yaw;
    animatePed(this.mesh, this.phase, Math.min(1, moving / 3));
  }
}

class Ped {
  constructor(variant) {
    this.mesh = makePedMesh(variant);
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.speed = 1.2 + Math.random() * 0.5;
    this.edge = -1; this.s = 0; this.side = 0;
    this.state = 'walk'; this.timer = 0; this.phase = Math.random() * 6;
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
    const a = Math.random() * Math.PI * 2, d = 35 + Math.random() * 110;
    const ci = w.chunkIndex(px + Math.cos(a) * d, pz + Math.sin(a) * d);
    if (ci < 0) return;
    const list = w.trafficEdges[ci];
    if (!list) return;
    const e = list[Math.floor(Math.random() * list.length)];
    const cls = w.r.cls[w.eRoad[e]];
    if (cls < RC.PRIMARY || (w.r.flags[w.eRoad[e]] & (RF.BRIDGE | RF.TUNNEL))) return;
    const s = Math.random() * w.eLen[e];
    const side = this._sideFor(e);
    w.edgePoint(e, s, side, _pt);
    const dd = Math.hypot(_pt.x - px, _pt.z - pz);
    if (dd < 30 || dd > 170) return;
    if (cam && dd < 70) {
      const dot = ((_pt.x - cam.x) * cam.fx + (_pt.z - cam.z) * cam.fz) / (Math.hypot(_pt.x - cam.x, _pt.z - cam.z) || 1);
      if (dot > 0.5) return;
    }
    if (w.blocked(_pt.x, _pt.z, 0.5) || w.isWater(_pt.x, _pt.z)) return;
    const p = new Ped(this.seq++);
    p.edge = e; p.s = s; p.side = side;
    p.x = _pt.x; p.z = _pt.z; p.yaw = Math.atan2(_pt.tx, _pt.tz);
    p.y = w.groundY(p.x, p.z, w.heightAt(p.x, p.z) + 1);
    this.peds.push(p);
    this.scene.add(p.mesh);
  }

  /** Chodec vyhozený z auta. */
  spawnAt(x, z, yaw) {
    const p = new Ped(this.seq++);
    p.x = x; p.z = z; p.yaw = yaw; p.state = 'flee'; p.timer = 5;
    p.y = this.world.groundY(x, z, this.world.heightAt(x, z) + 1);
    p.fx = Math.sin(yaw); p.fz = Math.cos(yaw);
    this.peds.push(p);
    this.scene.add(p.mesh);
    return p;
  }

  remove(i) {
    this.world.traffic.users.delete(this.peds[i]);
    this.scene.remove(this.peds[i].mesh);
    this.peds.splice(i, 1);
  }

  _selectCrossing(p) {
    const list = this.world.traffic.crossingsByEdge.get(p.edge);
    if (!list) return;
    if (p.planEdge !== p.edge) {
      p.planEdge = p.edge;
      p.plan = this.seq % 3 !== 0 ? list.find((stop) => stop.s > p.s + 3) : null;
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
      if (!traffic.canWalk(plan.crossing, cars)) return 0;
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
        p.state = 'walk'; p.s = plan.s + 0.2; p.side = -p.side; p.crossing = null;
      } else {
        p.yaw = Math.atan2(plan.to[0] - p.x, plan.to[1] - p.z);
        p.state = 'crossWait';
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
      this.timer = 0.2;
      if (this.peds.length < Math.ceil(QUALITY.peds * this.game.streetActivity)) this.spawn(player.x, player.z, cam);
    }
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      const d2 = (p.x - player.x) ** 2 + (p.z - player.z) ** 2;
      if (d2 > 230 * 230) { this.remove(i); continue; }
      let moving = 0;
      p.y = w.groundY(p.x, p.z, p.y);
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
          const hitR = c.radius + 0.3;
          // zásah autem
          const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
          const along = dx * fx + dz * fz, across = Math.abs(dx * fz - dz * fx);
          if (Math.abs(along) < c.halfLen + 0.3 && across < hitR) {
            if (sp > 2.5) {
              w.traffic.users.delete(p);
              p.crossing = null;
              p.state = 'down'; p.timer = 7;
              p.vx = c.vx * 0.9 + dx * 0.8; p.vz = c.vz * 0.9 + dz * 0.8;
              this.game.onPedHit(p, c, sp);
              break;
            } else {
              // pomalé auto chodce jen odtlačí
              const sgn = (dx * fz - dz * fx) >= 0 ? 1 : -1;
              p.x += fz * sgn * 0.08; p.z -= fx * sgn * 0.08;
            }
          } else if (sp > 4 && p.state === 'walk') {
            const approaching = -(dx * c.vx + dz * c.vz) / (Math.sqrt(dd) * sp + 1e-6);
            if (approaching < -0.75 && dd < 64) {
              p.state = 'flee'; p.timer = 1.6;
              const sgn = (dx * fz - dz * fx) >= 0 ? 1 : -1;
              p.fx = fz * sgn; p.fz = -fx * sgn;
            }
          }
        }
        if (p.state === 'down') continue;
      }
      if (p.crossing) {
        moving = this._stepCrossing(p, dt, cars);
      } else if (p.state === 'flee') {
        p.timer -= dt;
        const sp = 4.6;
        p.x += p.fx * sp * dt; p.z += p.fz * sp * dt;
        p.yaw = Math.atan2(p.fx, p.fz);
        if (w.collideCircle(p.x, p.z, 0.35, p.y + 0.2, p.y + 1.7)) { p.x = w.hit.x; p.z = w.hit.z; }
        moving = sp;
        if (p.timer <= 0) {
          if (p.edge < 0) { this.remove(i); continue; }
          p.state = 'walk';
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
          const nxt = opts.length ? opts[Math.floor(Math.random() * opts.length)] : rev;
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
      p.phase += dt * (3 + moving * 2.4);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.y = p.yaw;
      if (d2 < 120 * 120) animatePed(p.mesh, p.phase, Math.min(1, moving / 2.5));
    }
  }
}
