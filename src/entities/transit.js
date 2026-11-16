// MHD: tramvaje a trolejbusy jezdí po skutečných trasách linek a staví v zastávkách.
import { Timetable } from '../game/timetable.js';
import { DAY_SECONDS } from '../game/clock.js';
import { makeTramSegment, makeTrolleybus, TRAM_SEG, TROLLEY_LEN } from './models.js';

const _o = { x: 0, z: 0, tx: 0, tz: 1 };
const _ahead = { x: 0, z: 0, tx: 0, tz: 1 };

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

}

class TransitVehicle {
  constructor(event, s) {
    const { trip } = event, { route } = trip;
    const isTram = route.type === 'tram';
    this.event = event;
    this.route = route; this.destination = trip.destination;
    this.stops = trip.stops.map(({ target }) => target);
    this.s = s; this.v = 0; this.isTram = isTram;
    this.terminal = null;
    this.wait = 0; this.meshes = null; this.visible = false;
    this.x = 0; this.y = 0; this.z = 0; this.yaw = 0; this.vx = 0; this.vz = 0;
    this.len = isTram ? TRAM_SEG * 3 : TROLLEY_LEN;
    this.side = isTram ? 0 : 1.7;
    this.stopTarget = null;
    this.doorsOpen = false;
  }

  nextStop(s) { return this.stops.find((stop) => stop[0] > s + 0.5) ?? null; }
}

export class TransitManager {
  constructor(scene, world, game, schedule) {
    this.scene = scene; this.world = world; this.game = game;
    this.routes = [];
    this.vehicles = [];
    this.heavy = [];        // kruhy s „nekonečnou“ hmotností pro kolize aut
    this.obstacles = [];    // překážky pro provoz
    const routes = (world.meta.transit ?? []).map((r, i) => {
      if (r.gaps > 0 || r.path.length < 10 || r.length < 1500
          || [r.type, r.ref, r.from, r.to, r.length].some((value, k) => value !== schedule.routes[i]?.[k])) return null;
      return new Route(r);
    });
    this.routes = routes.filter(Boolean);
    this.timetable = new Timetable(schedule, routes);
    this.seen = new Map();
    this.serviceDay = null;
  }

  reset(clock, player) {
    for (const vehicle of this.vehicles) this._show(vehicle, false);
    this.vehicles = [];
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
      for (const [key, end] of this.seen) if (end <= clock.day * DAY_SECONDS) this.seen.delete(key);
    }
    while (this.eventIndex < this.events.length && this.events[this.eventIndex].start <= now) {
      const event = this.events[this.eventIndex++];
      if (now >= event.end || this.seen.has(event.key)) continue;
      this.seen.set(event.key, event.end);
      const s = this.timetable.position(event, now);
      const v = new TransitVehicle(event, s);
      v.route.posAt(s, v.side, _o);
      v.x = _o.x; v.z = _o.z;
      this.vehicles.push(v);
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

  update(dt, player, cars, playerOnFoot, clock) {
    const now = clock?.now;
    if (clock) this._dispatch(clock);
    this.heavy.length = 0;
    this.obstacles.length = 0;
    const px = player.x, pz = player.z;
    for (let index = this.vehicles.length - 1; index >= 0; index--) {
      const v = this.vehicles[index], r = v.route;
      // Vůz mimo dohled sleduje jízdní řád. U hráče pokračuje plynule a respektuje překážky.
      if (now !== undefined && !v.visible && now < v.event.end) v.s = this.timetable.position(v.event, now);
      r.posAt(v.s, v.side, _o);
      const d2 = (_o.x - px) ** 2 + (_o.z - pz) ** 2;
      const near = d2 < 520 * 520 || player === v;
      const endS = v.event.trip.endS;
      if (v.terminal !== null) v.terminal -= dt;
      if ((!near && now >= v.event.end) || v.terminal !== null && v.terminal <= 0) {
        if (this.game.ride === v) this.game._alight();
        this._show(v, false);
        this.vehicles.splice(index, 1);
        continue;
      }
      if (!near) {
        if (now === undefined) v.s += 6.5 * dt;
        else if (v.visible) v.s = this.timetable.position(v.event, now);
        this._show(v, false);
        v.v = 6.5; v.wait = 0; v.stopTarget = null; v.trafficStop = null; v.doorsOpen = false;
      } else {
        if (!v.visible) {
          // první zobrazení: tramvaj na tramvajovém mostě (trolejbus na silničním) začíná na mostovce
          const d = this.world.deckAt(_o.x, _o.z, 1e9, v.isTram ? 1 : 0);
          v.y = Math.max(d, this.world.heightAt(_o.x, _o.z) + 0.05);
        }
        this._show(v, true);
        let vmax = v.isTram ? 11.5 : 10.5;
        if (!v.isTram) {
          v.limitTimer = (v.limitTimer ?? 0) - dt;
          if (v.limitTimer <= 0) {
            const road = this.world.nearestRoad(_o.x, _o.z, 10, 13, 0, {}, v.y);
            v.roadLimit = road ? this.world.roadSpeed(road.road, road.dx * _o.tx + road.dz * _o.tz >= 0) / 3.6 : vmax;
            v.limitTimer = 0.5;
          }
          vmax = Math.min(vmax, v.roadLimit);
        }
        let limit = vmax;
        // zastávky
        if (v.terminal !== null) {
          limit = 0; v.doorsOpen = true;
        } else if (v.wait > 0) {
          v.wait -= dt; limit = 0; v.doorsOpen = true;
          if (v.wait <= 0) { v.doorsOpen = false; if (d2 < 60 * 60 && v.isTram) this.game.audio.bell(); }
        } else {
          const st = v.nextStop(v.s - 0.6);
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
          if (dx * dx + dz * dz > 30 * 30 || Math.abs((o.y === undefined ? v.y : o.y) - v.y) > 3) return;
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
        r.posAt(v.s + 16, v.side, _ahead);
        v.v = this.world.traffic.transitLimit(v, _o, _ahead, dt, v.v, cars);
        v.s += v.v * dt;
      }
      if (near && v.s >= endS && v.terminal === null) {
        v.s = endS; v.v = 0; v.terminal = 6;
        v.stopTarget = v.stops.at(-1);
        v.doorsOpen = true;
      }
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
            const ya = this.world.groundY(ax, az, v.y), yb = this.world.groundY(_o.x, _o.z, v.y);
            const cy = (ya + yb) / 2;
            const m = v.meshes[j];
            m.position.set(cx, cy, cz); m.rotation.set(Math.atan2(yb - ya, 5.2), yaw, 0, 'YXZ');
            const vx = Math.sin(yaw) * v.v, vz = Math.cos(yaw) * v.v;
            for (const k of [-2.6, 0, 2.6]) this.heavy.push({ x: cx + Math.sin(yaw) * k, y: cy, z: cz + Math.cos(yaw) * k, r: 1.3, vx, vz });
            this.obstacles.push({ x: cx, y: cy, z: cz, vx, vz, halfLen: TRAM_SEG / 2, radius: 1.4 });
            if (j === 1) { v.x = cx; v.z = cz; v.yaw = yaw; v.vx = vx; v.vz = vz; v.y = cy; }
          }
        } else {
          const sc = front - TROLLEY_LEN / 2;
          rr.posAt(sc + 3.5, v.side, _o); const ax = _o.x, az = _o.z;
          rr.posAt(sc - 3.5, v.side, _o);
          const cx = (ax + _o.x) / 2, cz = (az + _o.z) / 2;
          const yaw = Math.atan2(ax - _o.x, az - _o.z);
          const ya = this.world.groundY(ax, az, v.y), yb = this.world.groundY(_o.x, _o.z, v.y);
          const cy = (ya + yb) / 2;
          v.meshes[0].position.set(cx, cy, cz); v.meshes[0].rotation.set(Math.atan2(yb - ya, 7), yaw, 0, 'YXZ');
          v.x = cx; v.z = cz; v.y = cy; v.yaw = yaw; v.vx = Math.sin(yaw) * v.v; v.vz = Math.cos(yaw) * v.v;
          for (const k of [-4.2, 0, 4.2]) this.heavy.push({ x: cx + Math.sin(yaw) * k, y: cy, z: cz + Math.cos(yaw) * k, r: 1.35, vx: v.vx, vz: v.vz });
          this.obstacles.push({ x: cx, y: cy, z: cz, vx: v.vx, vz: v.vz, halfLen: TROLLEY_LEN / 2, radius: 1.4 });
        }
        v.halfLen = v.len / 2; v.radius = 1.4;
      } else {
        rr.posAt(v.s, v.side, _o);
        v.x = _o.x; v.z = _o.z;
      }
    }
  }

  /** Vůz MHD, do kterého jde právě nastoupit (stojí v zastávce poblíž). */
  boardable(x, z, y) {
    let best = null, bd = 1e9;
    for (const v of this.vehicles) {
      if (!v.visible || v.terminal !== null || v.v > 0.6 || Math.abs(v.y - y) > 2.5) continue;
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
