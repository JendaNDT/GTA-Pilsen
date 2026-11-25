import { wheelTrail } from '../fx/wheel-trails.js';
import { NightLights } from '../world/night-lights.js';
import { Particles } from '../fx/particles.js';
import { restorePanels } from '../entities/damage.js';
import { CarFragments } from '../physics/car-fragments.js';
import { DebrisBudget } from '../physics/debris.js';
import { LampBodies } from '../physics/lamp-bodies.js';
import { TrafficFurnitureBodies } from '../physics/traffic-furniture.js';
import { Water } from '../physics/water.js';
import { Falls } from './falls.js';
import { HelicopterBody } from '../physics/heli.js';
import { TransitBodies } from '../physics/transit-bodies.js';
import { TrafficBodies } from '../physics/traffic-bodies.js';
import { PlayerVehicle } from '../physics/vehicle.js';
import { cameraRailFraction } from '../world/camera-railings.js';
import { TileColliders } from '../physics/colliders.js';
import { CollisionView } from '../physics/debug.js';
// Řízení hry: stav hráče, kamera, pravidla (hledanost, zdraví, peníze), ukládání.
import * as THREE from 'three/webgpu';
import { QUALITY, RC, DRIVABLE_MAX, IS_TOUCH, IS_MOBILE, DEBUG, PARAMS, DEFAULT_QUALITY, QUALITY_OVERRIDE,
  SAVED_GRAPHICS, applyQualityProfile } from '../config.js';
import { World } from '../world/world.js';
import { TUNNEL_HEIGHT } from '../world/tunnels.js';
import { ChunkManager } from '../world/chunks.js';
import { Environment } from '../world/scene.js';
import { createPostFX } from '../world/postfx.js';
import { env } from '../world/materials.js';
import { VehicleManager, Car, wrapAngle } from '../entities/vehicles.js';
import { snowDepth, weatherFog, cloudCover } from '../world/weather-surfaces.js';
import { Precipitation } from '../fx/precipitation.js';
import { Weather } from '../world/weather.js';
import { dirtLevel } from '../entities/car-appearance.js';
import { addCarLight, CAR_TYPES, setCarAppearanceQuality } from '../entities/models.js';
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
import { roadWear } from '../world/road-surface.js';
import { TrafficRhythm } from './traffic-rhythm.js';
import { automaticQuality, PROFILES, resolutionScale, SAVE_KEY } from './graphics-quality.js';
import { profilePixelRatio } from '../world/image-quality.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const _road = {};
const _v = new THREE.Vector3();
const START = { x: -42, z: 52 };
const plain = (text) => String(text).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export class Game {
  constructor(renderer, data, physics) {
    this.physics = physics;
    this.steering = 'arcade';
    this.heliAssist = true;
    this.driver = null;
    this.falls = new Falls(this);
    this.water = new Water(physics);
    this.trafficBodies = new TrafficBodies(physics, QUALITY);
    this.transitBodies = new TransitBodies(physics);
    this.weather = new Weather(DEBUG ? PARAMS.get('weather') : null);
    this.tireSurface = (x, z) => {
      const grip = this.weather.surfaceGrip(x, z);
      if (x > -66 && x < 75 && z > -60 && z < 68) return .9 * grip;
      const w = this.world;
      if (w.onRoad(x, z)) return (w.r.cls[w._tmpRoad.road] >= RC.TRACK ? .6 : 1) * grip;
      return (w.isSoft(x, z) ? .5 : .6) * grip;
    };
    this.pedHits = new Map();
    physics.onPedContact = (walker, vehicle) => {
      const id = walker.GetID().GetIndexAndSequenceNumber();
      const inner = this.player.character?.character.GetInnerBodyID().GetIndexAndSequenceNumber();
      const ped = id === inner ? this.player : this.trafficBodies.owners.get(id);
      const carID = vehicle.GetID().GetIndexAndSequenceNumber();
      const car = carID === this.driver?.body.GetID().GetIndexAndSequenceNumber()
        ? this.car : this.trafficBodies.carForBody(carID);
      if (ped && car) this.queuePedHit(ped, car, vehicle.GetLinearVelocity());
    };
    physics.onImpact = (first, second, impulse, manifold) => {
      this.colliders.roadFurniture.bump(first, second, impulse);
      this.lampBodies.contact(first, second, impulse);
      this.trafficFurniture.contact(first, second, impulse);
      this.driver?.recordImpact(first, second, impulse, manifold);
      this.trafficBodies.recordImpact(first, second, impulse, manifold);
      const flight = this.heli?.physical;
      if (flight) {
        const id = flight.body.GetID().GetIndexAndSequenceNumber();
        if (first.GetID().GetIndexAndSequenceNumber() === id || second.GetID().GetIndexAndSequenceNumber() === id) {
          flight.impact = Math.max(flight.impact, impulse / 2500);
        }
      }
    };
    physics.step = (dt) => {
      this.transit.update(dt, this.focus, this.vehicles.cars, this.mode === 'foot', this.clock, input);
      const start = DEBUG ? performance.now() : 0;
      this.transitBodies.update(this.transit.vehicles, this.focus, dt);
      this.trafficBodies.drive(this, dt);
      for (const h of this.helis) {
        if (!h.physical) continue;
        h.spinRotor(dt);
        const touchLift = IS_TOUCH && input.touchDrive;
        const lift = Number(input.handbrake) - Number(input.down) + (touchLift ? input.moveY : 0);
        h.physical.drive(dt, touchLift ? 0 : input.moveY, input.moveX, clamp(lift, -1, 1), this.heliAssist);
      }
      this.driver?.drive(dt, input.moveY, input.moveX, input.handbrake, this.steering === 'arcade', this.tireSurface);
      if (this.mode === 'foot' && !this.falls.active.has(this.player)) {
        const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
        const dx = fx * input.moveY - fz * input.moveX, dz = fz * input.moveY + fx * input.moveX;
        this.fallDamage += this.player.update(dt, dx, dz, input.run, input.handbrake);
        // Virtuální kapsle může ustoupit před kapotou ještě před dotykem vnitřního tělesa.
        const contacts = this.player.character.character.GetActiveContacts();
        for (let i = 0; i < contacts.size(); i++) {
          const contact = contacts.at(i);
          if (!contact.mHadCollision) continue;
          const car = this.trafficBodies.carForBody(contact.mBodyB.GetIndexAndSequenceNumber());
          if (car) this.queuePedHit(this.player, car, contact.mLinearVelocity);
        }
      }
      if (this.driver && this.water.step(this.driver, this.world, dt)) this.audio.splash(this.driver.car);
      for (const [car, vehicle] of this.trafficBodies.dynamic) {
        if (this.water.step(vehicle, this.world, dt)) this.audio.splash(car);
      }
      physics.engine.Step(dt, 1);
      const budget = physics.debris.step(20);
      const roadBudget = this.colliders.roadFurniture.step(this.clock.now, budget);
      const remaining = this.trafficFurniture.step(this.clock.now, roadBudget);
      const panelBudget = this.lampBodies.step(this.clock.now, remaining);
      this.fragments.step(panelBudget, this.focus);
      this.driver?.read();
      this.trafficBodies.read(this);
      for (const h of this.helis) if (h.physical) {
        h.physical.read();
        const impact = h.physical.impact;
        h.physical.impact = 0;
        if (h === this.heli && impact > 5 && !h.physical.impactCooldown) {
          h.physical.impactCooldown = 0.45;
          this.audio.crash(impact, h);
          this._hurt(impact * 3);
        }
      }
      this.falls.step(dt);
      if (DEBUG) physics.lastStepMs = performance.now() - start;
    };
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.particles = new Particles(this.scene, renderer, () => QUALITY.particles);
    this.fragments = new CarFragments(physics, this.scene);
    physics.onCarFragment = this.fragments.queue.bind(this.fragments);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.4, QUALITY.view * 1.35);
    const view = new THREE.Frustum(), matrix = new THREE.Matrix4(), sphere = new THREE.Sphere();
    physics.debris = new DebrisBudget(() => QUALITY.debris, body => {
      matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      view.setFromProjectionMatrix(matrix, this.camera.coordinateSystem, this.camera.reversedDepth);
      const p = body.GetPosition();
      sphere.center.set(p.GetX(), p.GetY(), p.GetZ());
      sphere.radius = body.GetShape().GetInnerRadius() + 3;
      return view.intersectsSphere(sphere);
    });
    let nextSparks = 0;
    physics.onMetalScrape = (x, y, z) => {
      if (this.time < nextSparks || Math.hypot(x - this.focus.x, z - this.focus.z) > 90) return;
      nextSparks = this.time + 0.08;
      this.particles.emit('sparks', x, y, z, 4);
    };
    this.propertyHits = new Set();
    this.lastPropertyHit = -Infinity;
    physics.onFurnitureDamage = (fixture, hit, material) => {
      this.particles.emit(material === 'metal' ? 'sparks' : material === 'stone' ? 'dust' : 'glass',
        fixture.x, fixture.y + 0.6, fixture.z, 12);
      this.audio.crash(Math.max(4, hit.impulse / 900), fixture, material);
      if (hit.car !== this.driver?.body.GetID().GetIndexAndSequenceNumber()) return;
      if (this.time - this.lastPropertyHit > 5) this.propertyHits.clear();
      this.lastPropertyHit = this.time;
      if (this.propertyHits.has(fixture.id)) return;
      this.propertyHits.add(fixture.id);
      if (this.propertyHits.size === 1 || this.propertyHits.size % 3 === 0) {
        this.addWanted(1, 'Poškození veřejného majetku', true);
      }
    };
    this.world = new World(data);
    const trailRoad = {};
    this.particles.wheelSurface = (x, z, y) => wheelTrail(this.world, x, z, y, env.wetPaving.value, trailRoad);
    if (this.world.tunnels.length) {
      this.tunnelLight = new THREE.PointLight(0xffe0b0, 35, 22);
      this.tunnelLight.visible = false;
      this.scene.add(this.tunnelLight);
    }
    this.nightLights = QUALITY.pointLights ? new NightLights(renderer, this.scene, QUALITY.pointLights, QUALITY.headLights) : null;
    this.precipitation = new Precipitation(this.scene);
    this.env = new Environment(this.scene, renderer);
    this.postfx = createPostFX(renderer, this.scene, this.camera, this.world, this.env);
    this.chunks = new ChunkManager(this.scene, this.world, renderer, data.heritage, data.orthophotoSources, data.soundPlaces);
    this.lampBodies = new LampBodies(physics, this.world.breakables, this.scene);
    this.trafficFurniture = new TrafficFurnitureBodies(physics, this.world, this.scene);
    this.colliders = new TileColliders(physics, this.world, data, DEBUG ? new CollisionView(this.scene) : null,
      this.lampBodies, this.trafficFurniture);
    physics.onRailingHit = (rail, car, subshape, impulse) => this.colliders.roadFurniture.contact(rail, car, subshape, impulse);
    this.hud = new Hud(this.world);
    this.soundPlaces = data.soundPlaces;
    this.particles.weirs = data.soundPlaces.map(([x, z]) => [x, this.world.heightAt(x, z), z]);
    this.audio = new GameAudio(this);
    this.vehicles = new VehicleManager(this.scene, this.world, this);
    this.peds = new PedManager(this.scene, this.world, this);
    this.transit = new TransitManager(this.scene, this.world, this, data.timetable);
    this.clock = new GameClock();
    this.trafficRhythm = new TrafficRhythm(this.world, data.trafficProfiles, this.transit.timetable);
    this.chunks.roadWear = roadWear(this.world, this.trafficRhythm.measured);
    this.clockVisible = true;
    this.orthophotoEnabled = true;
    this.flareEnabled = this.motionEnabled = false;
    this.fullscreenEnabled = true;
    this.player = new Player(this.scene, this.world, physics, this.colliders);
    // vrtulníky: heliporty z mapy (FN Lochotín, pivovar, Bory) a jeden na náměstí Republiky
    this.helis = [[106, -1596], [984, -396], [-266, 1314], [48, 52]].map(([x, z], i) => {
      const p = this._heliSpot(x, z);
      return new Heli(this.scene, this.world, p.x, p.z, i * 1.3);
    });
    this.mode = 'foot'; this.car = null; this.heli = null; this.ride = null;
    this.focus = this.player;
    this.money = 500; this.wanted = 0; this.cool = 0; this.bust = 0;
    this.stats = {};
    this.time = 0; this.envTimer = 0; this.placeTimer = 0; this.promptTimer = 0; this.saveTimer = 20;
    this.camYaw = 2.4; this.camPitch = 0.3; this.zoom = 1; this.camDist = 6; this.lookIdle = 9; this.camMode = 0;
    this.shake = 0; this.crashCool = 0; this.wantedCool = 0;
    this.paused = true; this.mapOpen = false;
    this.graphics = { ...SAVED_GRAPHICS };
    this.graphicsOverride = QUALITY_OVERRIDE;
    this.graphicsBusy = false;
    this.graphicsTime = 0;
    this.resolutionTime = 0;
    this.resolutionScale = 1;
    this.pixelRatio = Math.min(devicePixelRatio || 1, profilePixelRatio(QUALITY.pixelRatio, IS_MOBILE));
    this.garage = new Garage(this);
    this.jobs = new Jobs(this);
    this.shifts = new Shifts(this);
    this._load();
    this.applyOptics();
    this.chunks.setOrthophotoEnabled(this.orthophotoEnabled);
    this.player.yaw = this.camYaw;
    if (!this.car) this._spawnStarterCar();
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

  usePragueTime() {
    if (this.shifts.active) this.shifts.end('interrupted', 'Změna herního času');
    this.clock.setPrague();
    this.syncClock(true);
  }

  syncClock(reposition = false) {
    const repaired = this.lampBodies.repair(this.clock.now);
    this.trafficFurniture.repair(repaired);
    this.colliders.roadFurniture.repair(repaired);
    if (reposition) {
      if (this.env.clouds) this.env.clouds.valid = false;
      this.postfx?.resetHistory();
      if (this.ride) this._alight(true);
      this.audio.resetWorld();
      this.transit.reset(this.clock, this.focus);
      this.placeTimer = 0;
      this.vehicles.spawnTimer = 0;
      this.peds.timer = 0;
    }
    this.chunks.heritage.updateTime(this.hour, 0);
    this.updateWeather();
    this.env.setHour(this.hour, this.clock.day);
    this.hud.clock(this.clock, this.clockVisible);
    this.updateDepartures();
    this.envTimer = 0.4;
  }

  applyOptics() {
    this.env.setFlare(this.flareEnabled);
    if (this.postfx) this.postfx.motion.value = this.motionEnabled;
  }

  updateWeather() {
    this.weather.update(this.clock.now);
    snowDepth.value = this.weather.snow;
    weatherFog.value = this.weather.fog;
    const variable = this.weather.mode !== 'clear';
    cloudCover.value = variable ? this.weather.cloud : .41;
    if (this.env.clouds) this.env.clouds.enabled.value = variable;
    env.wetPaving.value = PARAMS.get('wet') === '1' ? 1 : this.weather.wet;
  }

  setWeatherMode(mode) {
    this.weather.mode = mode === 'clear' ? 'clear' : 'variable';
    this.updateWeather();
    this.env.setHour(this.hour, this.clock.day);
    this.save();
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
      const day = s.clockMode === 'manual' ? parseDay(s.date) : null;
      if (day !== null && Number.isFinite(s.hour) && s.hour >= 0 && s.hour < 24) this.clock.set(day, s.hour);
      this.clockVisible = s.v === 1 || s.clockVisible !== false;
      this.particles.enabled = s.particlesEnabled !== false;
      this.flareEnabled = s.flareEnabled === true;
      this.motionEnabled = s.motionEnabled === true;
      this.fullscreenEnabled = s.fullscreenEnabled !== false;
      this.falls.enabled = s.fallsEnabled !== false;
      this.weather.mode = s.weatherMode === 'clear' ? 'clear' : 'variable';
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
      this.heliAssist = s.heliAssist !== false;
      this.steering = s.steering === 'realistic' ? 'realistic' : 'arcade';
      this.garage.load(s.garage);
      this.jobs.load(s.job);
      this.shifts.load(s.shift);
      this.hasSave = true;
    }
    const p = this._clearSpot(x, z, 0.6);
    this.player.place(p.x, p.z);
    if (this.hasSave) this._restoreCar(s.car);
  }

  _restoreCar(saved) {
    const w = this.world;
    if (!saved || !Object.hasOwn(CAR_TYPES, saved.model)
        || ![saved.x, saved.z, saved.y, saved.yaw].every(Number.isFinite)
        || saved.x < w.playMinX || saved.x > w.playMaxX || saved.z < w.playMinZ || saved.z > w.playMaxZ) return;
    const owned = saved.owned === true ? this.garage.owned : null;
    if (saved.owned === true && owned?.model !== saved.model) return;
    const car = new Car(saved.model, Number.isInteger(saved.color) ? saved.color : 0xc8922e);
    car.place(saved.x, saved.z, saved.yaw, saved.y);
    car.dirt = dirtLevel(owned?.dirt ?? saved.dirt);
    car.health = owned?.health ?? (Number.isFinite(saved.health) ? clamp(saved.health, 0, 100) : 100);
    if (owned) {
      restorePanels(car, owned.damage);
      car.upgrades = owned.upgrades;
      this.garage.active = car;
    }
    this._enterCar(this.vehicles.add(car));
  }

  _writeSave(changes = {}) {
    try {
      const f = this.focus;
      const tube = this.world.tunnelAt(f.x, f.z, f.y);
      const safe = tube?.inside ? tube.tunnel.portals.map((p) => p.outside)
        .reduce((a, b) => Math.hypot(a.x - f.x, a.z - f.z) < Math.hypot(b.x - f.x, b.z - f.z) ? a : b) : f;
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 2, money: this.money, date: formatDay(this.clock.day), hour: this.hour, clockVisible: this.clockVisible,
        clockMode: this.clock.followsPrague ? 'prague' : 'manual',
        soundEnabled: !this.audio.muted, orthophotoEnabled: this.orthophotoEnabled,
        flareEnabled: this.flareEnabled, motionEnabled: this.motionEnabled, fullscreenEnabled: this.fullscreenEnabled, weatherMode: this.weather.mode, particlesEnabled: this.particles.enabled, fallsEnabled: this.falls.enabled, graphics: this.graphics, steering: this.steering, heliAssist: this.heliAssist,
        car: this.mode === 'car' ? {
          model: f.typeId, color: f.color, x: f.x, z: f.z, y: f.y, yaw: f.yaw,
          health: f.health, dirt: f.dirt, owned: f === this.garage.active,
        } : null,
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
    const type = CAR_TYPES.hatch;
    const owner = w.chunkIndex(r.x, r.z), col = owner % w.cols, row = Math.floor(owner / w.cols);
    const lamps = [];
    // Vůz se parkuje dřív, než se do scény načtou stožáry z okolních dlaždic.
    for (let j = Math.max(0, row - 1); j <= Math.min(w.rows - 1, row + 1); j++) {
      for (let i = Math.max(0, col - 1); i <= Math.min(w.cols - 1, col + 1); i++) {
        lamps.push(...w.lampsInTile(j * w.cols + i));
      }
    }
    const off = w.r.w[r.road] / 2 + 0.8;
    for (const shift of [0, 6, -6, 12, -12, 18, -18]) {
      const at = shift ? w.nearestRoad(r.x + r.dx * shift, r.z + r.dz * shift, 5, RC.LIVING, RC.TERTIARY, {}) : r;
      if (!at || at.road !== r.road) continue;
      const x = at.x - at.dz * off, z = at.z + at.dx * off;
      if (w.blocked(x, z, 2.2, 0.3, 1.5) || w.isWater(x, z)) continue;
      const y = w.heightAt(x, z);
      // Před nárazníkem nech místo, aby řidič mohl od obrubníku vyjet.
      const lampInPath = lamps.some(lamp => {
        const dx = lamp.x - x, dz = lamp.z - z;
        const along = dx * at.dx + dz * at.dz;
        return lamp.y < y + type.h && lamp.y + lamp.height > y &&
          along > -type.len / 2 - 0.15 && along < type.len / 2 + 8 &&
          Math.abs(dx * at.dz - dz * at.dx) < type.wid / 2 + 0.35;
      });
      if (lampInPath) continue;
      const car = this.vehicles.add(new Car('hatch', 0xc8922e));
      car.mode = 'parked';
      car.place(x, z, Math.atan2(at.dx, at.dz));
      this.player.lastCar = car;
      return;
    }
  }

  // -------------------------------------------------------------- akce ----
  addMoney(n) { this.money = Math.max(0, this.money + n); this.hud.money(this.money); }

  addWanted(n, reason, separateEvent = false) {
    if (this.wantedCool > 0 && !separateEvent) return;
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
    p.setWalking(false); p.mesh.visible = false; p.lastCar = car;
    this.lookIdle = 9;
    this.audio.door(car);
  }

  _exitCar() {
    const car = this.car, p = this.player, w = this.world;
    if (!car.floodTime && Math.abs(car.speed) > 5) { this.hud.toast('Nejdřív zpomal.'); return; }
    const lx = Math.cos(car.yaw), lz = -Math.sin(car.yaw);
    const off = car.type.wid / 2 + 0.75;
    let x = car.x + lx * off, z = car.z + lz * off;
    if (w.collideCircle(x, z, 0.4, car.y + 0.2, car.y + 1.7)) {
      x = car.x - lx * off; z = car.z - lz * off;
      if (w.collideCircle(x, z, 0.4, car.y + 0.2, car.y + 1.7)) { x = w.hit.x; z = w.hit.z; }
    }
    car.mode = 'loose'; car.rest = 0; car.noDriver = true; car.wasAI = false;
    this.car = null; this.mode = 'foot'; this.focus = p;
    p.yaw = car.yaw;
    if (car.floodTime && w.isWater(x, z)) {
      p.place(x, z, w.heightAt(x, z));
      p.setWalking(true);
      p.mesh.visible = true;
    } else p.leaveVehicle(x, z, car.y);
    this.audio.door(car);
    this.jobs.onExitCar(car);
    this.save();
  }

  _enterHeli(h) {
    if (h.physical) {
      const p = h.physical.body.GetPosition();
      if (Math.hypot(p.GetX() - h.x, p.GetY() - h.y, p.GetZ() - h.z) > 0.1) {
        h.physical.dispose();
        h.physical = null;
      }
    }
    h.occupied = true; this.heli = h; this.mode = 'heli'; this.focus = h;
    this.player.setWalking(false);
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
    p.leaveVehicle(h.x + lx * 2.2, h.z + lz * 2.2, h.y);
    this.audio.door(h);
  }

  _board(v) {
    this.ride = v; this.mode = 'transit'; this.focus = v;
    this.player.setWalking(false);
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
    p.leaveVehicle(c.x, c.z, v.y);
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
    if (this.falls.active.has(this.player) || this.player.stun > 0) return;
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
    if (this.falls.active.has(this.player) || this.player.stun > 0) return;
    const f = this.focus, w = this.world;
    if (this.mode === 'transit' || this.mode === 'heli') return;
    let r = w.nearestRoad(f.x, f.z, 400, RC.LIVING, 0, _road, f.y);
    if (!r) return;
    if (this.mode === 'car') {
      const first = r;
      const occupied = (obstacle, road) => obstacle !== f && Math.abs(obstacle.y - f.y) < 3
        && Math.hypot(obstacle.x - road.x, obstacle.z - road.z) < f.halfLen + obstacle.halfLen + 1;
      const free = (road) => !this.vehicles.cars.some((other) => occupied(other, road))
        && !this.transit.obstacles.some((other) => occupied(other, road));
      if (!free(first)) {
        r = null;
        for (const shift of [8, -8, 16, -16, 24, -24, 32, -32]) {
          const candidate = w.nearestRoad(first.x + first.dx * shift, first.z + first.dz * shift,
            6, RC.LIVING, 0, {}, f.y);
          if (candidate && free(candidate)) { r = candidate; break; }
        }
        if (!r) { this.hud.toast('Silnice je obsazená. Zkus to za chvíli.'); return; }
      }
    }
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
      this.particles.emit('sparks', car.x, car.y + 0.35, car.z, 6);
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

  queuePedHit(ped, car, velocity) {
    const vx = velocity.GetX(), vz = velocity.GetZ(), speed = Math.hypot(vx, vz);
    if (ped.state === 'down' || ped.stun > 0 || speed < 0.1) return;
    if ((this.pedHits.get(ped)?.speed ?? 0) < speed) this.pedHits.set(ped, { car, vx, vz, speed });
  }

  applyPedHit(ped, { car, vx, vz, speed }) {
    if (ped === this.player) {
      if (this.mode !== 'foot' || speed <= 4) return;
      ped.stun = 2;
      ped.vx = vx * 0.5; ped.vz = vz * 0.5;
      this.audio.crash(speed, car); this.shake = 0.6;
      this.falls.start(ped, vx * 0.9, Math.min(3, speed * 0.16), vz * 0.9);
      this._hurt(speed * 2.4);
      return;
    }
    if (speed <= 4) {
      const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
      const side = (ped.x - car.x) * fz - (ped.z - car.z) * fx >= 0 ? 1 : -1;
      ped.x += fz * side * 0.08; ped.z -= fx * side * 0.08;
      return;
    }
    this.world.traffic.leaveCrossing(ped);
    ped.crossing = null;
    ped.state = 'down'; ped.timer = 7;
    ped.vx = vx * 0.9; ped.vz = vz * 0.9;
    this.falls.start(ped, ped.vx, Math.min(3, speed * 0.16), ped.vz);
    this.onPedHit(ped, car, speed);
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
    this.falls.finish(this.player);
    this.player.stun = 0;
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
    const w = this.world;
    // Mezi kroky fyziky kamera sleduje stejnou polohu a natočení jako vykreslená karoserie.
    const carMesh = this.mode === 'car' && this.driver ? this.car.mesh : null;
    const f = carMesh?.position ?? this.focus;
    this.camYaw -= input.lookDX * 0.0052;
    this.camPitch = clamp(this.camPitch + input.lookDY * 0.004, 0.04, 1.35);
    if (input.zoom) this.zoom = clamp(this.zoom * (input.zoom > 0 ? 1.12 : 0.89), 0.55, 3.2);
    if (input.lookDX || input.lookDY) this.lookIdle = 0; else this.lookIdle += dt;

    let height = 1.5, base = 5.2, follow = null;
    if (this.mode === 'car') {
      height = 1.25; base = 7.2 + Math.min(4.5, Math.abs(this.car.speed) * 0.075);
      if (Math.abs(this.car.speed) > 1.5) {
        follow = carMesh?.rotation.y ?? this.car.yaw;
        if (this.car.speed < -1.5 && this.car.reverseTime > 0.8) follow += Math.PI;
      }
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
    const rail = cameraRailFraction(w, f.x, ty-0.18, f.z, camX, camY-0.18, camZ);
    if (rail < 1) {
      const length = Math.hypot(camX-f.x, camY-ty, camZ-f.z);
      const fraction = Math.max(0, rail - 0.18/length);
      camX = f.x + (camX-f.x)*fraction;
      camY = ty + (camY-ty)*fraction;
      camZ = f.z + (camZ-f.z)*fraction;
      this.camDist = Math.min(this.camDist, length*fraction);
    }
    cam.position.set(camX, camY, camZ);
    if (this.shake > 0.01) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.5;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.5;
      this.shake *= Math.exp(-6 * dt);
    }
    _v.set(f.x + fx * 1.5, ty + 0.2, f.z + fz * 1.5);
    cam.lookAt(_v);
    const speed = Math.hypot(this.focus.vx || 0, this.focus.vz || 0);
    const fov = 60 + Math.min(14, speed * 0.3);
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
    this.camInfo = this.camInfo || {};
    this.camInfo.x = cam.position.x; this.camInfo.z = cam.position.z; this.camInfo.fx = fx; this.camInfo.fz = fz;
  }

  // -------------------------------------------------------------- krok ----
  update(dt, elapsed = dt) {
    if (this.paused) return;
    pollInput();
    if (input.pressed.has('map')) this.toggleMap();
    if (this.mapOpen) { endFrame(); return; }

    this.time += dt;
    this.postfx?.exposure?.update(dt);
    this.crashCool -= dt; this.wantedCool -= dt;
    const p = this.player;
    if (input.pressed.has('action')) this.doAction();
    if (input.pressed.has('job')) this.jobs.toggle();
    if (input.pressed.has('camera')) this.camMode = (this.camMode + 1) % 2;
    if (input.pressed.has('reset')) this.unstuck();
    if (input.pressed.has('beams') && this.mode === 'car') this.car.highBeam = !this.car.highBeam;
    if (input.pressed.has('horn') && this.mode === 'car') this.audio.horn(this.car);
    if (input.pressed.has('horn') && this.shifts.active) {
      if (this.ride.isTram) this.audio.bell(this.ride); else this.audio.horn(this.ride);
    }
    const previousDay = this.clock.day, previousTime = this.clock.now;
    if (this.clock.followsPrague) this.clock.setPrague();
    else this.clock.tick(elapsed);
    const clockAdvance = this.clock.now - previousTime;
    const jump = input.pressed.has('time');
    if (jump && this.shifts.active) this.hud.toast('Během směny platí její herní rozpis.');
    if (jump && !this.shifts.active) {
      this.clock.setTime(this.clock.now + 3 * HOUR_SECONDS);
      this.syncClock(true);
    } else if (!this.shifts.active && (clockAdvance < 0 || clockAdvance > dt + 2)) {
      this.syncClock(true);
    } else {
      this.envTimer -= dt;
      if (this.envTimer <= 0 || this.clock.day !== previousDay) this.syncClock();
      else this.hud.clock(this.clock, this.clockVisible);
    }
    this.world.traffic.tick(dt, this.mode === 'foot' ? this.player : null);
    env.time.value = this.time;

    if (this.driver && (this.mode !== 'car' || this.car !== this.driver.car)) {
      if (this.vehicles.cars.includes(this.driver.car)) this.trafficBodies.keepCar(this.driver);
      else this.driver.dispose();
      this.driver = null;
    }
    this.colliders.update(this.focus.x, this.focus.z);
    this.player.setWalking(this.mode === 'foot' && !this.falls.active.has(this.player));
    if (this.mode === 'car' && !this.driver) this.driver = this.trafficBodies.takeCar(this.car) ?? new PlayerVehicle(this.physics, this.car);
    if (this.car?.physicsTeleport && this.driver) {
      this.driver.teleport();
      this.car.physicsTeleport = false;
    }
    for (const h of this.helis) {
      const near = h === this.heli || Math.hypot(h.x - this.focus.x, h.z - this.focus.z) <= 150;
      if (near && this.colliders.tiles.has(this.world.chunkIndex(h.x, h.z))) {
        if (!h.physical) h.physical = new HelicopterBody(this.physics, h);
      } else if (h.physical) {
        h.physical.dispose();
        h.physical = null;
      }
    }
    this.trafficBodies.update(this, dt);
    this.fallDamage = 0;
    this.physics.update(elapsed);
    for (const [ped, hit] of this.pedHits) this.applyPedHit(ped, hit);
    this.pedHits.clear();
    if (this.driver?.impactSpeed > 0) {
      const other = this.trafficBodies.carForBody(this.driver.impactBody);
      const impact = this.driver.applyImpact();
      this.onCrash(this.driver.car, impact, other);
    }

    if (this.car?.floodTime >= 4) this._exitCar();
    for (const car of this.water.sunk) {
      if (p.lastCar === car) {
        p.lastCar = null;
        this.hud.toast('Auto se potopilo.', 'bad');
      }
      if (car === this.garage.active) car.health = 0;
      this.vehicles.remove(car);
      this.save();
    }
    this.water.sunk.clear();

    // pohyb podle režimu
    if (this.mode === 'foot') {
      if (this.fallDamage > 0) {
        this.falls.start(p, p.vx, -3, p.vz);
        this.audio.crash(8, p); this._hurt(this.fallDamage);
      }
      if (p.health < 100) p.health = Math.min(100, p.health + dt * 0.8);
    } else if (this.mode === 'car') {
      const car = this.car;
      car.reverseTime = car.speed < -1 ? (car.reverseTime || 0) + dt : 0;
    }

    // svět
    const onFoot = this.mode === 'foot';
    const obs = this.vehicles.obstacles;
    obs.length = 0;
    for (const o of this.transit.obstacles) obs.push(o);
    if (onFoot) obs.push(p);
    // stojící vrtulníky jsou pro auta pevná překážka
    const heavy = this.transit.heavy.slice();
    for (const h of this.helis) {
      if (!h.landed) continue;
      obs.push(h);
      const hx = Math.sin(h.yaw), hz = Math.cos(h.yaw);
      heavy.push({ x: h.x + hx * 0.6, z: h.z + hz * 0.6, y: h.y, r: 1.5, vx: h.vx, vz: h.vz }, { x: h.x - hx * 2.6, z: h.z - hz * 2.6, y: h.y, r: 0.8, vx: h.vx, vz: h.vz });
    }
    this.vehicles.update(dt, this.focus, this.camInfo, heavy);
    this.driver?.render(this.physics.clock.alpha);
    this.peds.update(dt, this.focus, this.camInfo, this.vehicles.cars);
    this.jobs.update(dt);
    this.shifts.show();
    this._updateWanted(dt);
    this._updateCamera(dt);
    this.chunks.heritage.updateTime(this.hour, dt);
    this.particles.update(dt, this.vehicles.cars, this.focus, QUALITY.waterDetail);
    this.audio.update(dt);
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
    if (this.mapOpen) this.areaMap.open();
    else {
      this.areaMap.close();
      if (el.contains(document.activeElement)) document.activeElement.blur();
    }
  }

  render() {
    this.renderer.info.reset();
    const cam = this.camera.position;
    this.precipitation.update(this.weather, QUALITY.particles, !this.particles.enabled ||
      ((this.weather.rain || this.weather.flakes) && this.world.tunnelAt(cam.x, cam.z, cam.y)?.inside));
    if (this.postfx) this.postfx.motion.value = this.motionEnabled;
    this.env.clouds?.render(this.camera);
    this.env.updateSkyLight();
    this.nightLights?.update(this.camera, this.chunks.chunks, this.vehicles.cars, this.env.night, this.mode === 'car' ? this.car : null);
    if (this.postfx) this.postfx.render();
    else this.renderer.render(this.scene, this.camera);
  }

  adapt(elapsed, measure) {
    if (PARAMS.get('adapt') === '0' || this.graphicsBusy || this.mapOpen) return;
    this.graphicsTime += elapsed;
    this.resolutionTime += elapsed;
    const choosing = this.graphicsTime >= 10 && !this.graphicsOverride && this.graphics.choice === 'auto' && !this.graphics.automatic;
    if (this.resolutionTime < 2 && !choosing) return;
    this.resolutionTime = 0;
    const { workMs, gpuMs } = measure(choosing ? 10000 : 2000);
    if (!workMs) return;
    const cpu = workMs.p95, gpu = gpuMs?.p95 ?? null;
    if (choosing) {
      const profile = automaticQuality(IS_MOBILE, cpu, gpu);
      this.graphics.automatic = profile;
      void this.changeGraphics(profile).then((applied) => {
        if (!applied) this.graphics.automatic = QUALITY.name;
        this.save();
        this.onGraphicsChanged?.();
      });
      return;
    }
    this.setResolutionScale(resolutionScale(this.resolutionScale, cpu, gpu));
  }

  setResolutionScale(scale) {
    const ratio = Math.min(devicePixelRatio || 1, profilePixelRatio(QUALITY.pixelRatio, IS_MOBILE)) * scale;
    this.resolutionScale = scale;
    if (ratio === this.pixelRatio) return;
    this.pixelRatio = ratio;
    this.renderer.setPixelRatio(ratio);
  }

  async setGraphicsChoice(choice) {
    if (this.graphicsBusy || (choice !== 'auto' && !Object.hasOwn(PROFILES, choice))) return false;
    if (!await this.changeGraphics(choice === 'auto' ? DEFAULT_QUALITY : choice)) return false;
    this.graphicsOverride = null;
    this.graphics = { choice, automatic: null };
    this.graphicsTime = 0;
    this.save();
    this.onGraphicsChanged?.();
    return true;
  }

  async changeGraphics(profile) {
    if (profile === QUALITY.name) return true;
    const previous = QUALITY.name;
    this.graphicsBusy = true;
    try {
      await this.rebuildGraphics(profile);
      return true;
    } catch (error) {
      console.warn('Předvolbu grafiky se nepodařilo použít.', error);
      try { await this.rebuildGraphics(previous); }
      catch (restoreError) { console.error('Původní grafiku se nepodařilo obnovit.', restoreError); }
      return false;
    } finally {
      this.graphicsBusy = false;
    }
  }

  async rebuildGraphics(profile) {
    this.postfx?.dispose();
    this.postfx = null;
    this.env.dispose();
    this.nightLights?.dispose();
    applyQualityProfile(profile);
    this.nightLights = QUALITY.pointLights ? new NightLights(this.renderer, this.scene, QUALITY.pointLights, QUALITY.headLights) : null;
    this.falls.limit(QUALITY.ragdolls);
    this.renderer.shadowMap.enabled = QUALITY.shadows;
    this.camera.far = QUALITY.view * 1.35;
    this.camera.updateProjectionMatrix();
    this.setResolutionScale(1);
    this.chunks.applyQuality();
    for (const car of this.vehicles.cars) {
      setCarAppearanceQuality(car.mesh);
      if (QUALITY.carLights) addCarLight(car.mesh, car.type);
      else if (car.mesh.userData.light) car.mesh.userData.light.visible = false;
    }
    this.env = new Environment(this.scene, this.renderer);
    this.env.setFlare(this.flareEnabled);
    this.updateWeather();
    this.env.setHour(this.hour, this.clock.day);
    this.env.update(this.camera);
    this.postfx = createPostFX(this.renderer, this.scene, this.camera, this.world, this.env);
    const { x, y, z } = this.focus;
    this.chunks.update(x, z, QUALITY.view, 0, y);
    while (this.chunks.pendingStart > 0) {
      this.chunks.update(x, z, QUALITY.view, 6, y);
      await new Promise(requestAnimationFrame);
    }
    await this.env.prepareSkyLight();
    if (this.postfx) await this.postfx.prepare();
    else await this.renderer.compileAsync(this.scene, this.camera);
    this.render();
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    if (this.env.csm?.camera) this.env.csm.updateFrustums();
    this.renderer.setSize(innerWidth, innerHeight);
  }
}
