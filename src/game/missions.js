// Zakázky (rozvoz jídla), objevování památek, navigace k cíli.
import { DRIVABLE_MAX } from '../config.js';
import { makeBeacon } from '../entities/models.js';
import { LANDMARK_INFO } from './landmarks.js';

const _road = {};
const FOOD_KIND = ['restaurace', 'rychlé občerstvení', 'kavárna', 'hospoda'];

export class Jobs {
  constructor(game) {
    this.game = game;
    this.world = game.world;
    this.job = null;
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

  _snap(x, z) {
    const r = this.world.nearestRoad(x, z, 60, DRIVABLE_MAX, 0, _road);
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
    const g = this.game;
    if (this.job) {
      this.job = null; this.beacon.visible = false; this.route = null;
      g.hud.toast('Zakázka zrušena.', 'bad');
      return;
    }
    const meta = this.world.meta;
    const p = g.focus;
    const cands = [];
    for (const f of meta.food) {
      const d = Math.hypot(f[0] - p.x, f[1] - p.z);
      if (d > 90 && d < 1400) cands.push([d, f]);
    }
    if (!cands.length) { g.hud.toast('V okolí není žádný podnik, který by potřeboval kurýra.', 'bad'); return; }
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
    this.job = {
      phase: 'pickup', name: f[3], kind: FOOD_KIND[f[2]] || 'podnik',
      pick, drop, label: `${meta.roadNames[addr[2]]} ${addr[3]}`,
      len, time: 0, limit: Math.round(len / 8.5 + 40), reward: Math.round((90 + len * 0.11) / 5) * 5,
    };
    this.routeTimer = 0;
    g.audio.coin();
    g.hud.toast(`Nová zakázka: vyzvedni jídlo – ${f[3]}`, 'big');
  }

  setWaypoint(x, z) {
    this.waypoint = this._snap(x, z);
    this.routeTimer = 0;
    this.game.hud.toast('Cíl nastaven – trasa je na minimapě.');
  }

  target() {
    if (this.job) return this.job.phase === 'pickup' ? this.job.pick : this.job.drop;
    return this.waypoint;
  }

  update(dt) {
    const g = this.game, p = g.focus, hud = g.hud;
    const speed = Math.hypot(p.vx || 0, p.vz || 0);
    const j = this.job;
    if (j) {
      const t = j.phase === 'pickup' ? j.pick : j.drop;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      this.beacon.visible = true;
      this.beacon.position.set(t.x, 0, t.z);
      if (j.phase === 'pickup') {
        hud.mission(`<b>Rozvoz jídla</b><br>Vyzvedni objednávku: <b>${j.name}</b> (${j.kind})<br>${Math.round(d)} m · odměna ${j.reward} Kč`);
        if (d < 11 && speed < 7) {
          j.phase = 'drop'; j.time = j.limit;
          this.routeTimer = 0;
          g.audio.door();
          hud.toast(`Jídlo naloženo. Doruč ho na adresu ${j.label}.`);
        }
      } else {
        j.time -= dt;
        const m = Math.max(0, Math.floor(j.time / 60)), s = Math.max(0, Math.floor(j.time % 60));
        hud.mission(`<b>Rozvoz jídla</b><br>Doruč na adresu <b>${j.label}</b><br>${Math.round(d)} m · <span class="timer">${m}:${String(s).padStart(2, '0')}</span>`);
        if (d < 11 && speed < 7) {
          const tip = Math.round((Math.max(0, j.time) / j.limit) * 80 / 5) * 5;
          g.addMoney(j.reward + tip);
          this.done++;
          g.stats.deliveries = (g.stats.deliveries || 0) + 1;
          g.audio.coin();
          hud.toast(`Doručeno! +${j.reward} Kč${tip ? ` a spropitné ${tip} Kč` : ''}`, 'big');
          this.job = null; this.beacon.visible = false; this.route = null;
          g.save();
        } else if (j.time <= 0) {
          g.audio.fail();
          hud.toast('Pozdě – jídlo vystydlo. Zakázka propadla.', 'bad');
          this.job = null; this.beacon.visible = false; this.route = null;
        }
      }
    } else {
      this.beacon.visible = false;
      hud.mission(null);
    }
    if (this.waypoint) {
      this.wpBeacon.visible = !this.job;
      this.wpBeacon.position.set(this.waypoint.x, 0, this.waypoint.z);
      if (Math.hypot(this.waypoint.x - p.x, this.waypoint.z - p.z) < 22) {
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
      const path = w.findPath(w.nearestNode(p.x, p.z, 250), w.nearestNode(tgt.x, tgt.z, 250), 12000);
      if (path && path.length) {
        const pts = [];
        for (const e of path) {
          const A = w.eA[e], B = w.eB[e], step = A < B ? 1 : -1;
          for (let k = A; ; k += step) { pts.push(w.rpx[k], w.rpz[k]); if (k === B) break; }
        }
        pts.push(tgt.x, tgt.z);
        this.route = pts;
      } else this.route = [tgt.x, tgt.z];
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
    const out = [];
    const t = this.job ? (this.job.phase === 'pickup' ? this.job.pick : this.job.drop) : null;
    if (t) out.push({ x: t.x, z: t.z, color: '#f2b632', size: 6.5 });
    if (this.waypoint) out.push({ x: this.waypoint.x, z: this.waypoint.z, color: '#b07cff', size: 6 });
    return out;
  }
}
