import { PIZZA } from './pizza.js';
import { Group } from 'three/webgpu';
import { BIKE_STATIONS, BIKE_STATION_ALIASES, loadBikeStock } from './bike-stations.js';
import { BIKE_RADIUS, bikeTurn, pedalSpeed } from '../physics/bike-motion.js';
import { makeBikeMesh, makeBikeStationPost, poseBikeRider } from '../entities/bike-model.js';
import { EDGE_MARGIN } from '../world/travel-bounds.js';
import { sampleWater } from '../world/water-profile.js';
import { wrapAngle } from '../entities/vehicles.js';

const STOP_SPEED = 0.8;
const STATION_RADIUS = 3.7;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export class SharedBikes {
  constructor(game) {
    this.game = game;
    const { world } = game;
    this.stations = BIKE_STATIONS.map(station => {
      const source = world.gpsToWorld(station.lat, station.lon);
      const x = source.x + station.dx, z = source.z + station.dz;
      const y = world.groundY(x, z, world.heightAt(source.x, source.z) + 1.8);
      return { ...station, x, y, z, meshes: [] };
    });
    this.load(null);
    this.rental = null;
    this.speed = this.lean = this.wheel = this.crank = 0;
    this.rider = new Map(game.player.mesh.skeleton.bones.map(bone => [bone.name, bone]));
  }

  load(saved) {
    this.stock = loadBikeStock(this.stations, saved);
    this.interrupted = this.stations.some(({ id }) => saved?.origin === id);
  }

  snapshot() {
    return { stock: this.stock, origin: this.rental?.origin ?? null };
  }

  nearbyStation(player) {
    if (player.swimming) return null;
    let nearest = null, distance = STATION_RADIUS ** 2;
    for (const station of this.stations) {
      const squared = (player.x - station.x) ** 2 + (player.z - station.z) ** 2;
      if (squared < distance && Math.abs(player.y - station.y) < 1.65) {
        nearest = station;
        distance = squared;
      }
    }
    return nearest && !this.game.world.onCarriageway(player.x, player.z, player.y) ? nearest : null;
  }

  prepareCourier() {
    if (this.rental) return;
    const { x, z, yaw } = PIZZA.bike;
    this.rental = { courier: true, x, z, yaw, y: this.game.world.groundY(x, z) };
    this.visual ??= makeBikeMesh();
    if (!this.visual.parent) this.game.scene.add(this.visual);
  }

  finishCourier() {
    if (this.rental?.courier && this.game.mode !== 'bike') {
      this.rental = null;
      this.visual.visible = false;
    }
  }

  footChoice() {
    const { game, rental } = this, { player } = game;
    if ((game.jobs.job && game.jobs.job.type !== 'pizza') || player.swimming) return null;
    if (rental) {
      if (Math.abs(player.y - rental.y) < 1.4 && Math.hypot(player.x - rental.x, player.z - rental.z) < 1.85) {
        return { label: rental.courier ? 'Nasednout na kurýrní kolo' : 'Nasednout na vypůjčené elektrokolo', run: () => this.mount(rental) };
      }
      return null;
    }
    const station = this.nearbyStation(player);
    return station && this.stock[station.id] > 0 ?
      { label: 'Půjčit elektrokolo', run: () => this.borrow(station) } : null;
  }

  rideLabel() {
    if (this.speed > STOP_SPEED) return 'Zpomal pro sesednutí';
    if (!this.game.player.grounded) return 'Počkej na dosednutí';
    if (this.rental?.courier) return 'Sesednout z kurýrního kola';
    const station = this.nearbyStation(this.game.player);
    return station && this.stock[station.id] < station.capacity ? 'Vrátit elektrokolo' : 'Sesednout z elektrokola';
  }

  borrow(station) {
    const { game } = this;
    if (this.rental || this.stock[station.id] < 1) return;
    this.stock[station.id]--;
    this.rental = { origin: station.id, x: station.x, y: station.y, z: station.z, yaw: station.yaw };
    if (!game.save()) {
      this.stock[station.id]++;
      this.rental = null;
      game.hud.toast(game.saveError, 'bad');
      return;
    }
    this.mount(station);
    game.hud.toast('Elektrokolo vypůjčeno. Vrátit ho můžeš na označeném stanovišti.', 'big');
  }

  mount(point) {
    const { game } = this, { player } = game;
    player.yaw = point.yaw;
    player.place(point.x, point.z, game.colliders.exitHeight(point.x, point.z, point.y));
    player.setWalking(true);
    game.camYaw = player.yaw;
    game.lookIdle = 0;
    game.mode = 'bike';
    this.speed = this.lean = 0;
    this.lastDry = { x: player.x, y: player.y, z: player.z };
    this.visual ??= makeBikeMesh();
    if (!this.visual.parent) game.scene.add(this.visual);
    this.renderRider();
  }

  leavePoint() {
    const { world, player } = this.game;
    const { x, y, z, yaw } = player;
    for (const side of [-1, 1, -1.5, 1.5, 0]) {
      const sx = x + Math.cos(yaw) * side * .72, sz = z - Math.sin(yaw) * side * .72;
      const sy = world.groundY(sx, sz, y + .55);
      if (Math.abs(y - sy) <= .55 && !world.isWater(sx, sz) &&
        !world.collideCircle(sx, sz, .38, sy + .04, sy + 1.8)) return { x: sx, z: sz, y: sy };
    }
    return null;
  }

  leave(point) {
    const { game, rental } = this, { player } = game;
    if (rental) Object.assign(rental, { x: player.x, y: player.y, z: player.z, yaw: player.yaw });
    game.mode = 'foot';
    this.speed = this.lean = 0;
    for (const bone of this.rider.values()) bone.rotation.set(0, 0, 0);
    player.mesh.rotation.z = 0;
    player.leaveVehicle(point.x, point.z, point.y);
    game.jobs.onBikeDismount(point);
    game.promptTimer = 0;
    if (!rental) this.visual.visible = false;
  }

  action() {
    const { game } = this;
    if (this.speed > STOP_SPEED || !game.player.grounded) {
      game.hud.toast('Před sesednutím zastav.');
      return;
    }
    const point = this.leavePoint();
    if (!point) {
      game.hud.toast('Sesedni na volném místě.');
      return;
    }
    if (this.rental?.courier) {
      this.leave(point);
      if (game.jobs.job?.type !== 'pizza') this.finishCourier();
      return;
    }
    const station = this.nearbyStation(game.player);
    if (!station) {
      this.leave(point);
      game.hud.toast('Elektrokolo zůstává půjčené. Vrátíš ho na stanovišti.');
      return;
    }
    if (this.stock[station.id] >= station.capacity) {
      this.leave(point);
      game.hud.toast('Stanoviště je plné. Elektrokolo zůstává půjčené.');
      return;
    }
    const rental = this.rental;
    this.rental = null;
    this.stock[station.id]++;
    if (!game.save()) {
      this.rental = rental;
      this.stock[station.id]--;
      game.hud.toast(game.saveError, 'bad');
      return;
    }
    this.leave(point);
    game.hud.toast(`Elektrokolo vráceno · ${station.name}.`, 'big');
  }

  interrupt() {
    if (this.rental) {
      if (!this.rental.courier) this.stock[this.rental.origin]++;
      this.rental = null;
      this.visual.visible = false;
      for (const bone of this.rider.values()) bone.rotation.set(0, 0, 0);
      this.game.player.mesh.rotation.z = 0;
    }
  }

  recover() {
    // Při zablokování v terénu jde výpůjčku ukončit i bez volného místa vedle kola.
    const point = this.leavePoint() ?? this.lastDry;
    if (this.rental?.courier) {
      this.leave(point);
      this.finishCourier();
      if (this.game.jobs.job?.type === 'pizza') {
        this.prepareCourier();
        this.game.hud.toast('Náhradní kolo čeká u pizzerie.');
      }
      return;
    }
    const rental = this.rental;
    this.rental = null;
    this.stock[rental.origin]++;
    if (this.game.save()) this.leave(point);
    else {
      this.rental = rental;
      this.stock[rental.origin]--;
      this.leave(point);
      this.rental.x = point.x;
      this.rental.y = point.y;
      this.rental.z = point.z;
      this.game.hud.toast(this.game.saveError, 'bad');
    }
  }

  step(dt, input) {
    const { game } = this, { player: p, world: w } = game;
    const { character } = p.character;
    const startX = p.x, startZ = p.z;
    const grounded = p.grounded;
    const beforeX = Math.sin(p.yaw), beforeZ = Math.cos(p.yaw);
    const normal = character.GetGroundNormal();
    const grade = grounded && normal.GetY() > 0.7 ?
      -(normal.GetX() * beforeX + normal.GetZ() * beforeZ) / normal.GetY() : 0;
    const pedal = grounded ? Math.max(0, input.moveY) : 0;
    const brake = grounded ? Math.max(Number(input.handbrake), -input.moveY) : 0;
    this.speed = pedalSpeed(this.speed, pedal, brake, grade, dt);
    const steer = grounded ? input.moveX : 0;
    p.yaw = wrapAngle(p.yaw - bikeTurn(this.speed, steer) * dt);
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const frontX = p.x + fx * (.62 + this.speed * dt), frontZ = p.z + fz * (.62 + this.speed * dt);
    const border = EDGE_MARGIN.bike;
    const atEdge = frontX < w.playMinX + border || frontX > w.playMaxX - border ||
      frontZ < w.playMinZ + border || frontZ > w.playMaxZ - border;
    const flood = w.isWater(frontX, frontZ) && p.y < sampleWater(w, frontX, frontZ, p.water).level + 0.3;
    if (atEdge || flood || (this.speed > 0.1 && w.collideCircle(frontX, frontZ, .26, p.y + .2, p.y + 1.35))) {
      this.speed = 0;
    }
    p.vx = fx * this.speed;
    p.vz = fz * this.speed;
    const fall = p.character.move(dt, p, false, .16);
    const travelled = Math.hypot(p.x - startX, p.z - startZ);
    const job = game.jobs.job;
    if (job?.type === 'pizza' && job.phase === 'cycle') job.ridden += travelled;
    if (grounded && travelled < this.speed * dt * .55) this.speed = travelled / dt;
    if (p.grounded && !w.isWater(p.x, p.z)) {
      this.lastDry.x = p.x; this.lastDry.y = p.y; this.lastDry.z = p.z;
    }
    this.wheel -= travelled / BIKE_RADIUS;
    if (pedal > 0 && this.speed > .08) this.crank -= travelled * 2.4;
    this.lean += (steer * Math.min(.29, this.speed * .064) - this.lean) * Math.min(1, dt * 9);
    this.steer = -steer * Math.min(.5, .85 / (this.speed + .9));
    if (fall > 0 || (flood && p.y < sampleWater(w, p.x, p.z, p.water).level - .1)) this.recover();
    else this.renderRider();
  }

  renderRider() {
    const p = this.game.player, model = this.visual;
    model.visible = true;
    model.position.set(p.x, p.y, p.z);
    model.rotation.set(0, p.yaw, this.lean, 'YXZ');
    const { rear, front, crank, steering } = model.userData;
    rear.rotation.x = front.rotation.x = this.wheel;
    crank.rotation.x = this.crank;
    steering.rotation.y = this.steer || 0;
    const back = .29;
    p.mesh.position.set(p.x - Math.sin(p.yaw) * back, p.y + .105, p.z - Math.cos(p.yaw) * back);
    p.mesh.rotation.set(0, p.yaw, this.lean, 'YXZ');
    poseBikeRider(this.rider, this.crank);
  }

  update() {
    const { scene, focus, world } = this.game;
    for (const station of this.stations) {
      const near = (focus.x - station.x) ** 2 + (focus.z - station.z) ** 2 < 145 ** 2;
      if (!near) {
        station.display?.removeFromParent();
        continue;
      }
      const nx = Math.cos(station.yaw), nz = -Math.sin(station.yaw);
      if (!station.display) {
        station.display = new Group();
        const post = makeBikeStationPost();
        const x = station.x + nx * 1.45 * station.signSide;
        const z = station.z + nz * 1.45 * station.signSide;
        post.position.set(x, world.groundY(x, z, station.y + .5), z);
        post.rotation.y = station.yaw;
        station.display.add(post);
      }
      if (!station.display.parent) scene.add(station.display);
      const shown = Math.min(this.stock[station.id], station.parking);
      while (station.meshes.length < shown) {
        const model = makeBikeMesh();
        const offset = station.meshes.length ? -1.12 : -.45;
        const x = station.x + nx * offset, z = station.z + nz * offset;
        model.position.set(x, world.groundY(x, z, station.y + .5), z);
        model.rotation.y = station.yaw;
        station.meshes.push(model);
        station.display.add(model);
      }
      for (const [i, model] of station.meshes.entries()) model.visible = i < shown;
    }
    if (this.rental && this.game.mode !== 'bike') {
      const { x, y, z, yaw } = this.rental;
      this.visual.visible = Math.hypot(focus.x - x, focus.z - z) < 145;
      this.visual.position.set(x, y, z);
      this.visual.rotation.set(0, yaw, -.07, 'YXZ');
    }
  }

  mapSites() {
    return this.stations.map(({ id, name, x, z, capacity }) => ({
      id, name, x, z, capacity, bike: true, exact: true,
      title: `${name} · Pilsen Bike`, aliases: BIKE_STATION_ALIASES,
    }));
  }

  access(station) {
    const count = this.stock[station.id];
    return `Sdílená elektrokola · ve hře ${count} / ${station.capacity} kol`;
  }
}
