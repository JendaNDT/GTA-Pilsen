// MHD: tramvaje a trolejbusy jezdí po skutečných trasách linek a staví v zastávkách.
import * as THREE from 'three';
import { makeTramSegment, makeTrolleybus, TRAM_SEG, TROLLEY_LEN } from './models.js';

const _o = { x: 0, z: 0, tx: 0, tz: 1 };

class Route {
  constructor(r) {
    this.type = r.type; this.ref = r.ref; this.from = r.from; this.to = r.to; this.name = r.name;
    const n = r.path.length;
    this.pts = new Float32Array(n * 2);
    this.cum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.pts[i * 2] = r.path[i][0]; this.pts[i * 2 + 1] = r.path[i][1];
      if (i) this.cum[i] = this.cum[i - 1] + Math.hypot(r.path[i][0] - r.path[i - 1][0], r.path[i][1] - r.path[i - 1][1]);
    }
    this.length = this.cum[n - 1];
    this.stops = r.stops;      // [vzdálenost, název]
    this.partner = null;
  }

  posAt(s, side, out) {
    const cum = this.cum, n = cum.length;
    if (s <= 0) s = 0; else if (s >= this.length) s = this.length;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const x1 = this.pts[lo * 2], z1 = this.pts[lo * 2 + 1], x2 = this.pts[hi * 2], z2 = this.pts[hi * 2 + 1];
    const l = cum[hi] - cum[lo] || 1;
    const t = (s - cum[lo]) / l;
    const tx = (x2 - x1) / l, tz = (z2 - z1) / l;
    out.x = x1 + (x2 - x1) * t - tz * side; out.z = z1 + (z2 - z1) * t + tx * side;
    out.tx = tx; out.tz = tz;
    return out;
  }

  nextStop(s) {
    for (const st of this.stops) if (st[0] > s + 0.5) return st;
    return null;
  }
}

class TransitVehicle {
  constructor(route, s, isTram) {
    this.route = route; this.s = s; this.v = 0; this.isTram = isTram;
    this.wait = 0; this.meshes = null; this.visible = false;
    this.x = 0; this.z = 0; this.yaw = 0; this.vx = 0; this.vz = 0;
    this.len = isTram ? TRAM_SEG * 3 : TROLLEY_LEN;
    this.side = isTram ? 0 : 1.7;
    this.stopTarget = null;
    this.doorsOpen = false;
  }
}

export class TransitManager {
  constructor(scene, world, game) {
    this.scene = scene; this.world = world; this.game = game;
    this.routes = [];
    this.vehicles = [];
    this.heavy = [];        // kruhy s „nekonečnou“ hmotností pro kolize aut
    this.obstacles = [];    // překážky pro provoz
    const meta = world.meta.transit || [];
    for (const r of meta) {
      if (r.gaps > 0 || r.path.length < 10 || r.length < 1500) continue;
      this.routes.push(new Route(r));
    }
    for (const r of this.routes) {
      r.partner = this.routes.find((o) => o !== r && o.type === r.type && o.ref === r.ref && o.from === r.to && o.to === r.from)
        || this.routes.find((o) => o !== r && o.type === r.type && o.ref === r.ref && o.from === r.to) || r;
    }
    for (const r of this.routes) {
      const isTram = r.type === 'tram';
      const n = Math.max(1, Math.round(r.length / (isTram ? 1500 : 3200)));
      for (let k = 0; k < n; k++) {
        this.vehicles.push(new TransitVehicle(r, ((k + Math.random() * 0.4) / n) * r.length, isTram));
      }
    }
  }

  _show(v, on) {
    if (on === v.visible) return;
    v.visible = on;
    if (on) {
      if (!v.meshes) v.meshes = v.isTram ? [makeTramSegment(0), makeTramSegment(1), makeTramSegment(2)] : [makeTrolleybus()];
      for (const m of v.meshes) this.scene.add(m);
    } else if (v.meshes) for (const m of v.meshes) this.scene.remove(m);
  }

  update(dt, player, cars, playerOnFoot) {
    this.heavy.length = 0;
    this.obstacles.length = 0;
    const px = player.x, pz = player.z;
    for (const v of this.vehicles) {
      const r = v.route;
      r.posAt(v.s, v.side, _o);
      const d2 = (_o.x - px) ** 2 + (_o.z - pz) ** 2;
      const near = d2 < 520 * 520;
      if (!near) {
        // daleko od hráče: jen plynulý posun průměrnou rychlostí
        this._show(v, false);
        v.s += 6.5 * dt; v.v = 6.5; v.wait = 0; v.stopTarget = null;
      } else {
        this._show(v, true);
        const vmax = v.isTram ? 11.5 : 10.5;
        let limit = vmax;
        // zastávky
        if (v.wait > 0) {
          v.wait -= dt; limit = 0; v.doorsOpen = true;
          if (v.wait <= 0) { v.doorsOpen = false; if (d2 < 60 * 60 && v.isTram) this.game.audio.bell(); }
        } else {
          const st = r.nextStop(v.s - 0.6);
          if (st) {
            const d = st[0] - v.s;
            if (d < 0.6 && v.stopTarget !== st) { v.wait = 5 + Math.random() * 3; v.stopTarget = st; limit = 0; v.v = 0; }
            else if (v.stopTarget !== st) limit = Math.min(limit, Math.sqrt(2 * 1.1 * Math.max(0, d)) + 0.25);
          }
        }
        // překážky před vozem
        const fx = _o.tx, fz = _o.tz;
        const check = (o) => {
          const dx = o.x - _o.x, dz = o.z - _o.z;
          if (dx * dx + dz * dz > 30 * 30) return;
          const ahead = dx * fx + dz * fz;
          if (ahead < 0.5 || ahead > 22) return;
          if (Math.abs(dx * fz - dz * fx) > 1.5 + (o.radius || 1) * 0.5) return;
          const gap = ahead - (o.halfLen || 1) - 0.5;
          const along = (o.vx || 0) * fx + (o.vz || 0) * fz;
          limit = Math.min(limit, Math.max(0, along + (gap - 2.5) * 1.2));
        };
        for (const c of cars) check(c);
        if (playerOnFoot) check(player);
        for (const o of this.vehicles) {
          if (o === v || !o.visible) continue;
          check(o);
        }
        if (v.v < limit) v.v = Math.min(limit, v.v + 1.1 * dt); else v.v = Math.max(limit, v.v - 2.6 * dt);
        v.s += v.v * dt;
      }
      if (v.s >= r.length) { v.route = r.partner; v.s = 0; v.stopTarget = null; }
      // poloha a články
      const rr = v.route;
      if (v.visible) {
        const front = v.s;
        if (v.isTram) {
          for (let j = 0; j < 3; j++) {
            const sc = front - TRAM_SEG * (j + 0.5);
            rr.posAt(sc + 2.6, 0, _o); const ax = _o.x, az = _o.z;
            rr.posAt(sc - 2.6, 0, _o);
            const cx = (ax + _o.x) / 2, cz = (az + _o.z) / 2;
            const yaw = Math.atan2(ax - _o.x, az - _o.z);
            const m = v.meshes[j];
            m.position.set(cx, 0, cz); m.rotation.y = yaw;
            const vx = Math.sin(yaw) * v.v, vz = Math.cos(yaw) * v.v;
            for (const k of [-2.6, 0, 2.6]) this.heavy.push({ x: cx + Math.sin(yaw) * k, z: cz + Math.cos(yaw) * k, r: 1.3, vx, vz });
            this.obstacles.push({ x: cx, z: cz, vx, vz, halfLen: TRAM_SEG / 2, radius: 1.4 });
            if (j === 1) { v.x = cx; v.z = cz; v.yaw = yaw; v.vx = vx; v.vz = vz; }
          }
        } else {
          const sc = front - TROLLEY_LEN / 2;
          rr.posAt(sc + 3.5, v.side, _o); const ax = _o.x, az = _o.z;
          rr.posAt(sc - 3.5, v.side, _o);
          const cx = (ax + _o.x) / 2, cz = (az + _o.z) / 2;
          const yaw = Math.atan2(ax - _o.x, az - _o.z);
          v.meshes[0].position.set(cx, 0, cz); v.meshes[0].rotation.y = yaw;
          v.x = cx; v.z = cz; v.yaw = yaw; v.vx = Math.sin(yaw) * v.v; v.vz = Math.cos(yaw) * v.v;
          for (const k of [-4.2, 0, 4.2]) this.heavy.push({ x: cx + Math.sin(yaw) * k, z: cz + Math.cos(yaw) * k, r: 1.35, vx: v.vx, vz: v.vz });
          this.obstacles.push({ x: cx, z: cz, vx: v.vx, vz: v.vz, halfLen: TROLLEY_LEN / 2, radius: 1.4 });
        }
        v.halfLen = v.len / 2; v.radius = 1.4;
      } else {
        rr.posAt(v.s, v.side, _o);
        v.x = _o.x; v.z = _o.z;
      }
    }
  }

  /** Vůz MHD, do kterého jde právě nastoupit (stojí v zastávce poblíž). */
  boardable(x, z) {
    let best = null, bd = 1e9;
    for (const v of this.vehicles) {
      if (!v.visible || v.v > 0.6) continue;
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      const dx = x - v.x, dz = z - v.z;
      const along = Math.abs(dx * fx + dz * fz), across = Math.abs(dx * fz - dz * fx);
      if (along < v.len / 2 + 1.5 && across < 4.2) {
        const d = across + along * 0.1;
        if (d < bd) { bd = d; best = v; }
      }
    }
    return best;
  }

  /** Místo pro výstup: vpravo vedle vozu. */
  exitPoint(v, out) {
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    out.x = v.x - fz * 2.6; out.z = v.z + fx * 2.6;
    return out;
  }
}
