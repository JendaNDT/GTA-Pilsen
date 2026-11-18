// Řízení hry: stav hráče, kamera, pravidla (hledanost, zdraví, peníze), ukládání.
import * as THREE from 'three/webgpu';
import { QUALITY, RC, DRIVABLE_MAX, IS_TOUCH, DEBUG, PARAMS } from '../config.js';
import { World } from '../world/world.js';
import { TUNNEL_HEIGHT } from '../world/tunnels.js';
import { ChunkManager } from '../world/chunks.js';
import { Environment } from '../world/scene.js';
import { createPostFX } from '../world/postfx.js';
import { env } from '../world/materials.js';
import { VehicleManager, Car, wrapAngle } from '../entities/vehicles.js';
import { Player, PedManager } from '../entities/player.js';
import { TRANSIT_NAME, TransitManager } from '../entities/transit.js';
import { Heli } from '../entities/heli.js';
import { Hud } from './hud.js';
import { Jobs } from './missions.js';
import { Garage } from './garage.js';
import { Shifts } from './shift.js';
import { GameAudio } from './audio.js';
import { input, pollInput, endFrame } from './input.js';
import { GameClock, HOUR_SECONDS, formatDay, parseDay } from './clock.js';
import { TrafficRhythm } from './traffic-rhythm.js';

const SAVE_KEY = 'plzen-naplno-v1';
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _road = {};
const _v = new THREE.Vector3();
const START = { x: -42, z: 52 };
const plain = (text) => String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export class Game {
  constructor(renderer, data) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.4, QUALITY.view * 1.35);
    this.world = new World(data);
    if (this.world.tunnels.length) {
      this.tunnelLight = new THREE.PointLight(0xffe0b0, 35, 22);
      this.tunnelLight.visible = false;
      this.scene.add(this.tunnelLight);
    }
    this.env = new Environment(this.scene, renderer);
    this.postfx = createPostFX(renderer, this.scene, this.camera);
    this.chunks = new ChunkManager(this.scene, this.world, renderer, data.heritage, data.orthophotoSources);
    this.hud = new Hud(this.world);
    this.soundPlaces = data.soundPlaces;
    this.audio = new GameAudio(this);
    this.vehicles = new VehicleManager(this.scene, this.world, this);
    this.peds = new PedManager(this.scene, this.world, this);
    this.transit = new TransitManager(this.scene, this.world, this, data.timetable);
    this.clock = new GameClock(this.transit.timetable.monday);
    this.trafficRhythm = new TrafficRhythm(this.world, data.trafficProfiles, this.transit.timetable);
    this.clockVisible = true;
    this.orthophotoEnabled = true;
    this.player = new Player(this.scene, this.world);
    // vrtulníky: heliporty z mapy (FN Lochotín, pivovar, Bory) a jeden na náměstí Republiky
    this.helis = [[106, -1596], [984, -396], [-266, 1314], [48, 52]].map(([x, z], i) => {
      const p = this._heliSpot(x, z);
      return new Heli(this.scene, this.world, p.x, p.z, i * 1.3);
    });
    this.mode = 'foot'; this.car = null; this.heli = null; this.ride = null;
    this.focus = this.player;
    this.money = 500; this.wanted = 0; this.cool = 0; this.bust = 0;
    this.stats = {};
    this.time = 0; this.envTimer = 0; this.placeTimer = 0; this.promptTimer = 0; this.saveTimer = 20; this.waterTimer = 0;
    this.camYaw = 2.4; this.camPitch = 0.3; this.zoom = 1; this.camDist = 6; this.lookIdle = 9; this.camMode = 0;
    this.shake = 0; this.crashCool = 0; this.wantedCool = 0;
    this.paused = true; this.mapOpen = false;
    this.fpsAcc = 0; this.fpsN = 0; this.pixelRatio = Math.min(devicePixelRatio || 1, QUALITY.pixelRatio);
    this.garage = new Garage(this);
    this.jobs = new Jobs(this);
    this.shifts = new Shifts(this);
    this._load();
    this.chunks.setOrthophotoEnabled(this.orthophotoEnabled);
    this.player.yaw = this.camYaw;
    this._spawnStarterCar();
    this.hud.money(this.money);
    this.syncClock(true);
    if (DEBUG) window.__game = this;
  }

  get hour() { return this.clock.hour; }

  setClock(date, hour) {
    const day = date === null ? this.clock.day : parseDay(date);
    if (day === null || !Number.isFinite(hour) || hour < 0 || hour >= 24) return false;
    if (this.shifts.active) this.shifts.end('interrupted', 'Změna herního času');
    this.clock.set(day, hour);
    this.syncClock(true);
    return true;
  }

  syncClock(reposition = false) {
    if (reposition) {
      this.postfx?.resetHistory();
      if (this.ride) this._alight(true);
      this.audio.resetWorld();
      this.transit.reset(this.clock, this.focus);
      this.placeTimer = 0;
      this.vehicles.spawnTimer = 0;
      this.peds.timer = 0;
    }
    this.chunks.heritage.updateForge(this.hour, 0);
    this.env.setHour(this.hour, this.clock.day);
    this.hud.clock(this.clock, this.clockVisible);
    this.updateDepartures();
    this.envTimer = 0.4;
  }

  setClockVisible(visible) {
    this.clockVisible = visible;
    this.hud.clock(this.clock, visible);
    this.save();
  }

  setSoundEnabled(enabled) {
    this.audio.setMuted(!enabled);
    this.save();
  }

  setOrthophotoEnabled(enabled) {
    this.orthophotoEnabled = enabled;
    this.chunks.setOrthophotoEnabled(enabled);
    this.save();
  }

  updateDepartures() {
    this.hud.departures(this.mode === 'foot'
      ? this.transit.timetable.departures(this.player.x, this.player.z, this.clock, undefined, this.transit.active) : null);
  }

  // ----------------------------------------------------------- ukládání ----
  _load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { s = null; }
    let x = START.x, z = START.z;
    if (s && (s.v === 1 || s.v === 2)) {
      this.money = s.money ?? 500; this.stats = s.stats || {};
      const hour = Number.isFinite(s.hour) && s.hour >= 0 && s.hour < 24 ? s.hour : 9;
      const day = s.v === 2 ? parseDay(s.date) : null;
      this.clock.set(day ?? this.transit.timetable.monday, hour);
      this.clockVisible = s.v === 1 || s.clockVisible !== false;
      this.orthophotoEnabled = s.orthophotoEnabled !== false;
      this.audio.setMuted(s.soundEnabled === false);
      const w = this.world;
      if (Number.isFinite(s.x) && Number.isFinite(s.z)
          && s.x >= w.playMinX && s.x <= w.playMaxX && s.z >= w.playMinZ && s.z <= w.playMaxZ) {
        x = clamp(s.x, w.playMinX + 20, w.playMaxX - 20);
        z = clamp(s.z, w.playMinZ + 20, w.playMaxZ - 20);
      }
      const found = new Set(s.found || []);
      for (const lm of this.jobs.landmarks) lm.found = found.has(lm.name);
      this.garage.load(s.garage);
      this.jobs.load(s.job);
      this.shifts.load(s.shift);
      this.hasSave = true;
    }
    const p = this._clearSpot(x, z, 0.6);
    this.player.place(p.x, p.z);
  }

  _writeSave(changes = {}) {
    try {
      const f = this.focus;
      const tube = this.world.tunnelAt(f.x, f.z, f.y);
      const safe = tube?.inside ? tube.tunnel.portals.map((p) => p.outside)
        .reduce((a, b) => Math.hypot(a.x - f.x, a.z - f.z) < Math.hypot(b.x - f.x, b.z - f.z) ? a : b) : f;
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 2, money: this.money, date: formatDay(this.clock.day), hour: this.hour, clockVisible: this.clockVisible,
        soundEnabled: !this.audio.muted, orthophotoEnabled: this.orthophotoEnabled,
        stats: this.stats, x: Math.round(safe.x), z: Math.round(safe.z),
        found: this.jobs.landmarks.filter((l) => l.found).map((l) => l.name),
        garage: this.garage.snapshot(), job: this.jobs.snapshot(), shift: this.shifts.snapshot(),
        ...changes,
      }));
      return true;
    } catch { return false; }
  }

  save() { return this._writeSave(); }

  get saveError() { return 'Uložení selhalo. Uvolni místo v úložišti prohlížeče a zkus to znovu.'; }

  /** Peníze, statistiky a související stav patří do jednoho uloženého záznamu. */
  commitAccount({ money = this.money, stats = this.stats, garage = this.garage.snapshot(),
    job = this.jobs.snapshot(), shift = this.shifts.snapshot() }) {
    if (!this._writeSave({ money, stats, garage, job, shift })) return false;
    this.money = money;
    this.stats = stats;
    this.garage.owned = garage;
    this.hud.money(money);
    return true;
  }

  static clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* nic */ } }

  /** Najde poblíž volné místo (mimo budovy a vodu). */
  _clearSpot(x, z, r) {
    const w = this.world;
    for (let ring = 0; ring < 14; ring++) {
      for (let a = 0; a < (ring ? 8 : 1); a++) {
        const px = x + Math.cos(a * 0.785) * ring * 4, pz = z + Math.sin(a * 0.785) * ring * 4;
        if (w.buildingAt(px, pz) < 0 && !w.blocked(px, pz, r + 0.4) && !w.isWater(px, pz)) return { x: px, z: pz };
      }
    }
    const rd = w.nearestRoad(x, z, 300, DRIVABLE_MAX, 0, _road);
    return rd ? { x: rd.x, z: rd.z } : { x, z };
  }

  /** Místo pro vrtulník: mimo vozovku a s volným okolím (na střeše heliportu zůstane, kde je). */
  _heliSpot(x, z) {
    const w = this.world;
    if (w.buildingAt(x, z) >= 0) return { x, z };
    for (let ring = 0; ring < 10; ring++) {
      for (let a = 0; a < (ring ? 8 : 1); a++) {
        const px = x + Math.cos(a * 0.785) * ring * 6, pz = z + Math.sin(a * 0.785) * ring * 6;
        const r = w.nearestRoad(px, pz, 14, DRIVABLE_MAX, 0, _road);
        if (r && r.dist < w.r.w[r.road] / 2 + 5) continue;
        if (w.buildingAt(px, pz) < 0 && !w.blocked(px, pz, 6, 0.2, 3) && !w.isWater(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  _spawnStarterCar() {
    const w = this.world, p = this.player;
    const r = w.nearestRoad(p.x, p.z, 120, RC.LIVING, RC.TERTIARY, {});
    if (!r) return;
    const hw = w.r.w[r.road] / 2;
    const x = r.x - r.dz * (hw + 0.8), z = r.z + r.dx * (hw + 0.8);
    if (w.blocked(x, z, 2.2, 0.3, 1.5)) return;
    const car = this.vehicles.add(new Car('hatch', 0xc8922e));
    car.mode = 'parked';
    car.place(x, z, Math.atan2(r.dx, r.dz));
    this.player.lastCar = car;
  }

  // -------------------------------------------------------------- akce ----
  addMoney(n) { this.money = Math.max(0, this.money + n); this.hud.money(this.money); }

  addWanted(n, reason) {
    if (this.wantedCool > 0) return;
    this.wantedCool = 2.5;
    const before = this.wanted;
    this.wanted = Math.min(5, this.wanted + n);
    this.cool = 0;
    if (this.wanted > before) this.hud.toast(`${reason} – jde po tobě policie!`, 'bad');
  }

  _enterCar(car) {
    const p = this.player;
    if (car.mode === 'ai' || car.mode === 'police') {
      const lx = Math.cos(car.yaw), lz = -Math.sin(car.yaw);
      this.peds.spawnAt(car.x + lx * (car.type.wid / 2 + 0.7), car.z + lz * (car.type.wid / 2 + 0.7), car.yaw + Math.PI / 2);
      this.hud.toast(car.typeId === 'police' ? 'Ukrást policejní auto? Odvážné.' : '„Hej! To je moje auto!“');
      if (car.typeId === 'police') this.addWanted(2, 'Krádež policejního vozu');
      else if (Math.random() < 0.6) this.addWanted(1, 'Krádež auta');
      car.vx = Math.sin(car.yaw) * car.speed; car.vz = Math.cos(car.yaw) * car.speed;
    }
    car.mode = 'player'; car.wasAI = false; car.noDriver = true;
    this.car = car; this.mode = 'car'; this.focus = car;
    p.mesh.visible = false; p.lastCar = car;
    this.lookIdle = 9;
    this.audio.door(car);
  }

  _exitCar() {
    const car = this.car, p = this.player, w = this.world;
    if (Math.abs(car.speed) > 5) { this.hud.toast('Nejdřív zpomal.'); return; }
    const lx = Math.cos(car.yaw), lz = -Math.sin(car.yaw);
    const off = car.type.wid / 2 + 0.75;
    let x = car.x + lx * off, z = car.z + lz * off;
    if (w.collideCircle(x, z, 0.4, car.y + 0.2, car.y + 1.7)) {
      x = car.x - lx * off; z = car.z - lz * off;
      if (w.collideCircle(x, z, 0.4, car.y + 0.2, car.y + 1.7)) { x = w.hit.x; z = w.hit.z; }
    }
    car.mode = 'loose'; car.rest = 0; car.noDriver = true; car.wasAI = false;
    this.car = null; this.mode = 'foot'; this.focus = p;
    p.place(x, z, w.groundY(x, z, car.y + 0.5)); p.yaw = car.yaw; p.mesh.visible = true;
    this.audio.door(car);
    this.jobs.onExitCar(car);
    this.save();
  }

  _enterHeli(h) {
    h.occupied = true; this.heli = h; this.mode = 'heli'; this.focus = h;
    this.player.mesh.visible = false;
    this.lookIdle = 9;
    this.audio.door(h);
    this.hud.toast(IS_TOUCH ? 'Vrtulník: páčka = let, ▲ nahoru, ▼ dolů.' : 'Vrtulník: mezerník = nahoru, Shift = dolů, W/S = vpřed/vzad, A/D = otáčení.', '', 6000);
  }

  _exitHeli() {
    const h = this.heli, p = this.player;
    if (!h.landed || h.speed > 2) { this.hud.toast('Vystoupit jde až po přistání.'); return; }
    h.occupied = false;
    const lx = Math.cos(h.yaw), lz = -Math.sin(h.yaw);
    this.heli = null; this.mode = 'foot'; this.focus = p;
    p.place(h.x + lx * 2.2, h.z + lz * 2.2, h.y); p.mesh.visible = true;
    this.audio.door(h);
  }

  _board(v) {
    this.ride = v; this.mode = 'transit'; this.focus = v;
    this.player.mesh.visible = false;
    this.lookIdle = 9;
    this.jobs.onBoard(v);
    this.updateDepartures();
  }

  _alight(force = false) {
    const v = this.ride, p = this.player;
    if (!force && !v.canAlight) { this.hud.toast('Vystoupit jde v zastávce po otevření dveří.'); return; }
    const o = this.transit.exitPoint(v, {});
    const c = this._clearSpot(o.x, o.z, 0.4);
    this.ride = null; this.mode = 'foot'; this.focus = p;
    p.place(c.x, c.z, this.world.groundY(c.x, c.z, v.y + 0.5)); p.mesh.visible = true;
    this.jobs.onAlight(v);
    this.updateDepartures();
  }

  _nearestHeli() {
    const p = this.player;
    for (const h of this.helis) {
      if (Math.hypot(h.x - p.x, h.z - p.z) < 5 && Math.abs(h.y - p.y) < 2.5) return h;
    }
    return null;
  }

  doAction() {
    if (this.shifts.active) return this.shifts.doors();
    if (this.mode === 'car') return this._exitCar();
    if (this.mode === 'heli') return this._exitHeli();
    if (this.mode === 'transit') return this._alight();
    const p = this.player;
    const h = this._nearestHeli();
    if (h) return this._enterHeli(h);
    const v = this.transit.boardable(p.x, p.z, p.y);
    if (v) return this._board(v);
    const car = this.vehicles.nearestEnterable(p.x, p.z, p.y);
    if (car) return this._enterCar(car);
    return null;
  }

  /** Klávesa R: vrátí hráče (i s autem) na nejbližší silnici. */
  unstuck() {
    const f = this.focus, w = this.world;
    if (this.mode === 'transit' || this.mode === 'heli') return;
    const r = w.nearestRoad(f.x, f.z, 400, RC.LIVING, 0, _road, f.y);
    if (!r) return;
    const tube = w.tunnelAt(r.x, r.z, f.y);
    const y = tube?.floor ?? w.roadSurfaceY(r.road, r.seg, r.t, r.x, r.z);
    if (this.mode === 'car') {
      this.car.place(r.x, r.z, Math.atan2(r.dx, r.dz), y);
      if (this.car !== this.garage.active) this.car.health = Math.max(this.car.health, 40);
    }
    else this.player.place(r.x, r.z, y);
    this.hud.toast('Zpět na silnici.');
  }

  // -------------------------------------------------- události ze světa ----
  onCrash(car, impact, other) {
    const mine = !!this.car && (car === this.car || other === this.car);
    const f = this.focus;
    if ((car.x - f.x) ** 2 + (car.z - f.z) ** 2 < 70 * 70 && this.crashCool <= 0) {
      this.audio.crash(impact * (mine ? 1 : 0.5), car);
      this.crashCool = 0.18;
    }
    if (!mine) return;
    this.jobs.onCrash(impact);
    this.shake = Math.min(1, this.shake + impact / 25);
    if (impact > 13) this._hurt((impact - 13) * 2.2);
    const o = car === this.car ? other : car;
    if (o && o.typeId === 'police') this.addWanted(1, 'Náraz do policejního vozu');
    else if (o && o.wasAI && impact > 6) {
      this.vehicles.crashPoints++;
      if (this.vehicles.crashPoints >= 3) { this.vehicles.crashPoints = 0; this.addWanted(1, 'Nebezpečná jízda'); }
    }
    if (this.car && this.car.health <= 0 && !this.car.deadToast) {
      this.car.deadToast = true;
      this.hud.toast('Auto je na odpis. Najdi si jiné.', 'bad');
    }
  }

  onPedHit(ped, car, speed) {
    this.audio.crash(5, ped);
    if (car === this.car) {
      this.jobs.onCrash(speed);
      this.addWanted(1, 'Srazil jsi chodce');
    }
  }

  _hurt(n) {
    const p = this.player;
    p.health = Math.max(0, p.health - n);
    if (p.health <= 0) this._hospital();
  }

  _serviceNear(kind) {
    const f = this.focus;
    let best = null, bd = 1e18;
    for (const s of this.world.meta.services) {
      if (s[2] !== kind) continue;
      const d = (s[0] - f.x) ** 2 + (s[1] - f.z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  _toFoot(x, z) {
    if (this.car) { this.car.mode = 'loose'; this.car.noDriver = true; this.car.wasAI = false; this.car = null; }
    if (this.heli) { this.heli.occupied = false; this.heli = null; }
    this.ride = null;
    this.mode = 'foot'; this.focus = this.player;
    const c = this._clearSpot(x, z, 0.5);
    this.player.place(c.x, c.z);
    this.player.mesh.visible = true;
  }

  _hospital() {
    const s = this._serviceNear('hospital');
    const fee = Math.min(this.money, 300);
    this.addMoney(-fee);
    this.shifts.end('interrupted', 'Ošetření v nemocnici', false);
    this._toFoot(s ? s[0] : START.x, s ? s[1] : START.z);
    this.jobs.interrupt('Ošetření v nemocnici', false);
    this.player.health = 100;
    this.wanted = 0;
    this.hud.toast(`Probral ses v nemocnici${s && s[3] ? ` (${s[3]})` : ''}. Ošetření: ${fee} Kč.`, 'bad', 5000);
    this.save();
  }

  _busted() {
    const s = this._serviceNear('police');
    const fine = Math.min(this.money, Math.max(200, Math.round(this.money * 0.1 / 10) * 10));
    this.addMoney(-fine);
    this.shifts.end('interrupted', `Zatčení a pokuta ${fine} Kč`, false);
    this._toFoot(s ? s[0] : START.x, s ? s[1] : START.z);
    this.jobs.interrupt(`Zatčení a pokuta ${fine} Kč`, false);
    this.wanted = 0; this.bust = 0; this.cool = 0;
    this.stats.busted = (this.stats.busted || 0) + 1;
    this.hud.toast(`Zatčen! Pokuta ${fine} Kč.`, 'bad', 5000);
    this.audio.fail();
    this.save();
  }

  _updateWanted(dt) {
    const f = this.focus;
    let near = 1e9;
    for (const c of this.vehicles.cars) if (c.mode === 'police') near = Math.min(near, Math.hypot(c.x - f.x, c.z - f.z));
    if (this.wanted > 0) {
      if (near > 125) this.cool += dt; else this.cool = 0;
      if (this.cool > 11 + 3 * this.wanted) {
        this.wanted--; this.cool = 0;
        if (this.wanted === 0) { this.hud.toast('Policie tě ztratila.'); this.vehicles.crashPoints = 0; }
      }
      const speed = Math.hypot(f.vx || 0, f.vz || 0);
      if (near < 9 && speed < 2.2 && (this.mode === 'foot' || this.mode === 'car')) this.bust += dt;
      else this.bust = Math.max(0, this.bust - dt * 2);
      if (this.bust > 2.2) this._busted();
    } else this.bust = 0;
  }

  // ------------------------------------------------------------- kamera ----
  _updateCamera(dt) {
    const f = this.focus, w = this.world;
    this.camYaw -= input.lookDX * 0.0052;
    this.camPitch = clamp(this.camPitch + input.lookDY * 0.004, 0.04, 1.35);
    if (input.zoom) this.zoom = clamp(this.zoom * (input.zoom > 0 ? 1.12 : 0.89), 0.55, 3.2);
    if (input.lookDX || input.lookDY) this.lookIdle = 0; else this.lookIdle += dt;

    let height = 1.5, base = 5.2, follow = null;
    if (this.mode === 'car') {
      height = 1.25; base = 7.2 + Math.min(4.5, Math.abs(this.car.speed) * 0.075);
      if (Math.abs(this.car.speed) > 1.5) follow = this.car.speed < -1.5 && this.car.reverseTime > 0.8 ? this.car.yaw + Math.PI : this.car.yaw;
    } else if (this.mode === 'heli') { height = 2; base = 15; if (this.heli.speed > 3 || !this.heli.landed) follow = this.heli.yaw; }
    else if (this.mode === 'transit') { height = 2.6; base = this.ride.isTram ? 20 : 15; follow = this.ride.yaw; }
    else if (Math.hypot(this.player.vx, this.player.vz) > 1.2 && this.lookIdle > 1.6) follow = this.player.yaw;
    if (this.camMode === 1) base *= 1.9;
    if (follow !== null && this.lookIdle > (this.mode === 'foot' ? 1.6 : 0.9)) {
      const rate = this.mode === 'foot' ? 0.9 : 2.6;
      this.camYaw += wrapAngle(follow - this.camYaw) * Math.min(1, dt * rate);
    }
    this.camYaw = wrapAngle(this.camYaw);

    const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const ty = (f.y || 0) + height;
    let dist = base * this.zoom;
    const cx = f.x - fx * dist * cp, cz = f.z - fz * dist * cp, cy = ty + dist * sp;
    const t = w.raycast(f.x, f.z, cx, cz, (ty + cy) / 2 - 0.3);
    if (t < 1) dist = Math.max(1.3, dist * t - 0.5);
    this.camDist += (dist - this.camDist) * Math.min(1, dt * (dist < this.camDist ? 18 : 3.5));
    dist = this.camDist;
    const cam = this.camera;
    let camX = f.x - fx * dist * cp, camZ = f.z - fz * dist * cp;
    let camY = ty + dist * sp;
    const tunnel = w.tunnelAt(f.x, f.z, f.y);
    if (this.tunnelLight) {
      this.tunnelLight.visible = Boolean(tunnel?.inside);
      if (tunnel?.inside) this.tunnelLight.position.set(f.x, tunnel.floor + TUNNEL_HEIGHT - 0.45, f.z);
    }
    if (tunnel) {
      const tube = tunnel.tunnel, sampled = {};
      let floor = tunnel.floor;
      camX = f.x; camZ = f.z; camY = ty + 0.5;
      for (let d = 0.5; d <= dist; d += 0.5) {
        const x = f.x - fx * d * cp, z = f.z - fz * d * cp;
        if (!tube.position(x, z, tube.halfWidth - 0.3, sampled)) break;
        camX = x; camZ = z; floor = sampled.floor; camY = ty + d * sp;
      }
      camY = clamp(camY, floor + 0.7, floor + TUNNEL_HEIGHT - 0.35);
    } else {
      // Kamera zůstane nad terénem. U portálu respektuj výšku otevřeného zářezu.
      const ground = (x, z) => w.tunnelAt(x, z, Infinity)?.floor ?? w.heightAt(x, z);
      camY = Math.max(camY, ground(camX, camZ) + 0.7);
      for (let q = 1; q <= 3; q++) {
        const u = q / 4;
        const over = ground(f.x + (camX - f.x) * u, f.z + (camZ - f.z) * u) + 0.4 - (ty + (camY - ty) * u);
        if (over > 0) camY += over / u;
      }
    }
    cam.position.set(camX, camY, camZ);
    if (this.shake > 0.01) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.5;
      this.shake *= Math.exp(-6 * dt);
    }
    _v.set(f.x + fx * 1.5, ty + 0.2, f.z + fz * 1.5);
    cam.lookAt(_v);
    const speed = Math.hypot(f.vx || 0, f.vz || 0);
    const fov = 60 + Math.min(14, speed * 0.3);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    this.camInfo = this.camInfo || {};
    this.camInfo.x = cam.position.x; this.camInfo.z = cam.position.z; this.camInfo.fx = fx; this.camInfo.fz = fz;
  }

  // -------------------------------------------------------------- krok ----
  update(dt) {
    if (this.paused) return;
    pollInput();
    if (input.pressed.has('map')) this.toggleMap();
    if (this.mapOpen) { endFrame(); return; }

    this.time += dt;
    this.crashCool -= dt; this.wantedCool -= dt;
    const p = this.player;
    if (input.pressed.has('action')) this.doAction();
    if (input.pressed.has('job')) this.jobs.toggle();
    if (input.pressed.has('camera')) this.camMode = (this.camMode + 1) % 2;
    if (input.pressed.has('reset')) this.unstuck();
    if (input.pressed.has('horn') && this.mode === 'car') this.audio.horn(this.car);
    if (input.pressed.has('horn') && this.shifts.active) {
      if (this.ride.isTram) this.audio.bell(this.ride); else this.audio.horn(this.ride);
    }
    const previousDay = this.clock.day;
    this.clock.tick(dt);
    const jump = input.pressed.has('time');
    if (jump && this.shifts.active) this.hud.toast('Během směny platí její herní rozpis.');
    if (jump && !this.shifts.active) {
      this.clock.add(3 * HOUR_SECONDS);
      this.syncClock(true);
    } else {
      this.envTimer -= dt;
      if (this.envTimer <= 0 || this.clock.day !== previousDay) this.syncClock();
      else this.hud.clock(this.clock, this.clockVisible);
    }
    this.world.traffic.tick(dt, this.mode === 'foot' ? this.player : null);
    env.time.value = this.time;

    // pohyb podle režimu
    if (this.mode === 'foot') {
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      const dx = fx * input.moveY - fz * input.moveX, dz = fz * input.moveY + fx * input.moveX;
      const fall = p.update(dt, dx, dz, input.run, input.handbrake);
      if (fall > 0) { this.audio.crash(8, p); this._hurt(fall); }
      if (p.health < 100) p.health = Math.min(100, p.health + dt * 0.8);
    } else if (this.mode === 'car') {
      const car = this.car;
      car.reverseTime = car.speed < -1 ? (car.reverseTime || 0) + dt : 0;
      this.vehicles.stepDynamic(car, dt, input.moveY, input.moveX, input.handbrake);
      this.waterTimer -= dt;
      if (this.waterTimer <= 0) {
        this.waterTimer = 0.3;
        const w = this.world;
        if (car.y < w.heightAt(car.x, car.z) + 0.8 && !car.air && w.isWater(car.x, car.z) && !w.onRoad(car.x, car.z, 2.5)) {
          this.hud.toast('Auto skončilo ve vodě.', 'bad');
          const x = car.x, z = car.z;
          if (car === this.garage.active) car.health = 0;
          this.car = null; this.vehicles.remove(car);
          this.audio.splash({ x, z, y: car.y });
          this.mode = 'foot'; this.focus = p; p.place(x, z); p.mesh.visible = true;
        }
      }
    } else if (this.mode === 'heli') {
      const lift = (input.handbrake ? 1 : 0) - (input.down ? 1 : 0) + (IS_TOUCH && input.touchDrive ? input.moveY : 0);
      const impact = this.heli.update(dt, IS_TOUCH && input.touchDrive ? 0 : input.moveY, input.moveX, clamp(lift, -1, 1));
      if (impact > 0) { this.audio.crash(impact, this.heli); this._hurt(impact * 3); }
    }
    for (const h of this.helis) if (h !== this.heli) h.update(dt, 0, 0, 0);

    // svět
    const onFoot = this.mode === 'foot';
    this.transit.update(dt, this.focus, this.vehicles.cars, onFoot, this.clock, input);
    const obs = this.vehicles.obstacles;
    obs.length = 0;
    for (const o of this.transit.obstacles) obs.push(o);
    if (onFoot) obs.push(p);
    // stojící vrtulníky jsou pro auta pevná překážka
    const heavy = this.transit.heavy;
    for (const h of this.helis) {
      if (!h.landed) continue;
      obs.push(h);
      const hx = Math.sin(h.yaw), hz = Math.cos(h.yaw);
      heavy.push({ x: h.x + hx * 0.6, z: h.z + hz * 0.6, y: h.y, r: 1.5, vx: h.vx, vz: h.vz }, { x: h.x - hx * 2.6, z: h.z - hz * 2.6, y: h.y, r: 0.8, vx: h.vx, vz: h.vz });
    }
    this.vehicles.update(dt, this.focus, this.camInfo, heavy);
    this.peds.update(dt, this.focus, this.camInfo, this.vehicles.cars);
    // hráče pěšky může srazit auto
    if (onFoot && p.stun <= 0) {
      for (const c of this.vehicles.cars) {
        const dx = p.x - c.x, dz = p.z - c.z;
        if (dx * dx + dz * dz > 16) continue;
        const cfx = Math.sin(c.yaw), cfz = Math.cos(c.yaw);
        const along = dx * cfx + dz * cfz, across = dx * cfz - dz * cfx;
        if (Math.abs(along) < c.halfLen + 0.3 && Math.abs(across) < c.radius + 0.25 && Math.abs(p.y - c.y) < 1.4) {
          const sgn = across >= 0 ? 1 : -1;
          p.x += cfz * sgn * (c.radius + 0.3 - Math.abs(across)); p.z -= cfx * sgn * (c.radius + 0.3 - Math.abs(across));
          const sp = Math.hypot(c.vx, c.vz);
          if (sp > 4) { this._hurt(sp * 2.4); p.stun = 0.7; p.vx = c.vx * 0.5; p.vz = c.vz * 0.5; this.audio.crash(sp, c); this.shake = 0.6; }
        }
      }
    }
    this.jobs.update(dt);
    this.shifts.show();
    this._updateWanted(dt);
    this._updateCamera(dt);
    this.chunks.heritage.updateForge(this.hour, dt);
    this.audio.update(dt, input.moveY);
    this.env.update(this.camera);
    const fast = Math.hypot(this.focus.vx || 0, this.focus.vz || 0) > 18;
    this.chunks.update(this.focus.x, this.focus.z, QUALITY.view, fast ? 2 : 1, this.focus.y);
    this._updateHud(dt);

    this.saveTimer -= dt;
    if (this.saveTimer <= 0) { this.saveTimer = 20; this.save(); }
    endFrame();
  }

  _updateHud(dt) {
    const hud = this.hud, f = this.focus, w = this.world;
    hud.wanted(this.wanted);
    hud.health(this.player.health);
    if (this.mode === 'car') hud.speed(this.car.speed * 3.6, `${this.car === this.garage.active ? 'Vlastní · ' : ''}${this.car.type.name}${this.car.health < 40 ? ' · poškozené' : ''}`);
    else if (this.mode === 'heli') hud.speed(this.heli.speed * 3.6, `Vrtulník · výška ${Math.round(this.heli.y)} m`);
    else if (this.mode === 'transit') hud.speed(this.ride.v * 3.6, `${TRANSIT_NAME[this.ride.route.type]} ${this.ride.route.ref} → ${this.ride.destination}`);
    else hud.speed(null);

    this.placeTimer -= dt;
    if (this.placeTimer <= 0) {
      this.placeTimer = 0.4;
      const r = w.nearestRoad(f.x, f.z, 45, RC.PEDESTRIAN, 0, _road);
      const name = r ? w.roadNames[w.r.name[r.road]] : '';
      const alt = Math.round(w.baseElevation + (this.mode === 'heli' ? w.heightAt(f.x, f.z) : f.y || 0));
      const dist = w.districtAt(f.x, f.z);
      hud.place(name || '', `${dist ? `${dist} · ` : ''}${alt} m n. m.`);
      let limit = 0;
      if (this.mode === 'car') {
        const road = w.nearestRoad(f.x, f.z, 16, DRIVABLE_MAX, 0, _road, f.y);
        if (road && road.dist <= w.r.w[road.road] / 2 + 0.7) {
          const forward = road.dx * Math.sin(f.yaw) + road.dz * Math.cos(f.yaw) >= 0;
          limit = (forward ? w.r.limitForward : w.r.limitBackward)?.[road.road] ?? 0;
        }
      }
      hud.speedLimit(this.shifts.active ? f.shiftLimit : limit);
    }
    this.promptTimer -= dt;
    if (this.promptTimer <= 0) {
      this.promptTimer = 0.15;
      const key = 'F';
      let html = '';
      if (this.mode === 'foot') {
        const p = this.player;
        const h = this._nearestHeli();
        const v = !h ? this.transit.boardable(p.x, p.z, p.y) : null;
        const car = !h && !v ? this.vehicles.nearestEnterable(p.x, p.z, p.y) : null;
        if (h) html = `<kbd>${key}</kbd>Nasednout do vrtulníku`;
        else if (v) html = `<kbd>${key}</kbd>Nastoupit · ${TRANSIT_NAME[v.route.type]} ${plain(v.route.ref)} → ${plain(v.destination)}`;
        else if (car) html = `<kbd>${key}</kbd>${car.mode === 'parked' || car.mode === 'loose' ? 'Nastoupit' : 'Sebrat auto'} · ${car.type.name}`;
        else if (p.swimming) html = 'Plaveš…';
      } else if (this.shifts.active) {
        html = IS_TOUCH ? '▲ Plyn · ▼ Brzda · F Dveře' : 'W Plyn · S Brzda · F Dveře';
      } else if (this.mode === 'transit') {
        const ride = this.ride, st = ride.stops[ride.stopIndex];
        const boundary = ride.event.trip.exit && ride.stopIndex === ride.stops.length - 1;
        if (ride.canAlight) html = `<kbd>${key}</kbd>Vystoupit · ${plain(st[1])}`;
        else if (st) html = `Příští zastávka · ${plain(st[1])}`;
        if (boundary) html += ' · poslední zastávka na mapě';
      } else if (this.mode === 'heli' && this.heli.landed && this.heli.speed < 2) html = `<kbd>${key}</kbd>Vystoupit`;
      hud.prompt(html);
    }
    // minimapa
    const markers = [...this.jobs.markers(), ...this.shifts.markers()];
    if (this.mode === 'foot' || this.mode === 'transit') {
      for (const [, x, z] of this.transit.timetable.nearby(f.x, f.z, 240)) {
        markers.push({ x, z, color: '#8ee1d9', size: 2.8, local: true });
      }
    }
    for (const c of this.vehicles.cars) if (c.mode === 'police') markers.push({ x: c.x, z: c.z, color: Math.floor(this.time * 4) % 2 ? '#3d8bfd' : '#e2483d', size: 4.5, local: true });
    for (const h of this.helis) if (h !== this.heli) markers.push({ x: h.x, z: h.z, color: '#7fd0ff', size: 4, local: true });
    for (const lm of this.jobs.landmarks) if (!lm.found) markers.push({ x: lm.x, z: lm.z, color: '#aab3ba', size: 3.5, local: true });
    // naposledy použité auto, ať se dá znovu najít
    const lc = this.player.lastCar;
    if (this.mode === 'foot' && lc && this.vehicles.cars.includes(lc) && Math.hypot(lc.x - f.x, lc.z - f.z) < 500) {
      markers.push({ x: lc.x, z: lc.z, color: '#ffffff', size: 4.5 });
    }
    hud.minimap(f.x, f.z, this.camYaw, f.yaw || 0, markers, this.shifts.active?.path ?? this.jobs.route, this.jobs.walkRoute);
  }

  toggleMap(force) {
    const el = document.getElementById('bigmap');
    this.mapOpen = force !== undefined ? force : !this.mapOpen;
    this.audio.setMapPaused(this.mapOpen);
    el.classList.toggle('hidden', !this.mapOpen);
    if (this.mapOpen) this.drawBigMap();
    else if (el.contains(document.activeElement)) document.activeElement.blur();
  }

  drawBigMap() {
    const f = this.focus;
    const found = this.jobs.landmarks.filter((l) => l.found).length;
    this.mapToWorld = this.hud.bigMap(document.getElementById('bigmap-canvas'), {
      px: f.x, pz: f.z, heading: f.yaw || 0, landmarks: this.jobs.landmarks, helis: this.helis,
      markers: [...this.jobs.markers(), ...this.shifts.markers()], route: this.shifts.active?.path ?? this.jobs.route,
      walkRoute: this.jobs.walkRoute,
    });
    document.getElementById('bigmap-legend').innerHTML =
      `Památky: <b>${found}/${this.jobs.landmarks.length}</b> · tyrkysově garáž a vlastní auto · modré tečky vedou pěšky · červená příčka označuje uzavírku · klepnutím nastavíš cíl`;
  }

  render() {
    this.renderer.info.reset();
    this.env.updateSkyLight();
    if (this.postfx) this.postfx.render();
    else this.renderer.render(this.scene, this.camera);
  }

  /** Přizpůsobí rozlišení výkonu zařízení. */
  adapt(dt) {
    if (PARAMS.get('adapt') === '0') return;
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc < 2) return;
    const fps = this.fpsN / this.fpsAcc;
    this.fps = fps;
    this.fpsAcc = 0; this.fpsN = 0;
    const max = Math.min(devicePixelRatio || 1, QUALITY.pixelRatio);
    let pr = this.pixelRatio;
    // když nepomáhá ani nižší rozlišení, vypni stíny
    if (fps < 24 && pr <= 0.75 && this.env.shadows && this.env.sun.castShadow) {
      this.env.setShadows(false);
      this.hud.toast('Kvůli plynulosti vypínám stíny.');
    }
    if (fps < 30 && pr > 0.7) pr = Math.max(0.7, pr * 0.85);
    else if (fps > 56 && pr < max) pr = Math.min(max, pr * 1.1);
    if (pr !== this.pixelRatio) { this.pixelRatio = pr; this.renderer.setPixelRatio(pr); }
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if (this.env.csm?.camera) this.env.csm.updateFrustums();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
