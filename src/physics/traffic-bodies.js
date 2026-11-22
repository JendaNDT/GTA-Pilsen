import { PlayerVehicle } from './vehicle.js';
import { layers } from './world.js';

const parkingBrake = Object.freeze({ throttle: 0, steer: 0, brake: 1 });

export class TrafficBodies {
  constructor(physics, quality = {}) {
    this.quality = quality;
    this.physics = physics;
    this.active = new Map();
    this.dynamic = new Map();
    this.owners = new Map();
    physics.onVehicleContact = (first, second) => {
      const a = this.carForBody(first.GetID().GetIndexAndSequenceNumber());
      const b = this.carForBody(second.GetID().GetIndexAndSequenceNumber());
      if (a?.physical) a.physical.touchedVehicle = true;
      if (b?.physical) b.physical.touchedVehicle = true;
    };
    const { Jolt } = physics;
    this.pos = new Jolt.RVec3(0, 0, 0);
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
    this.frame = 0;
  }

  removeProxy(key) {
    const entry = this.active.get(key);
    if (!entry) return;
    const id = entry.body.GetID();
    this.owners.delete(id.GetIndexAndSequenceNumber());
    this.physics.bodies.RemoveBody(id);
    this.physics.bodies.DestroyBody(id);
    this.active.delete(key);
  }

  takeCar(car) {
    this.removeProxy(car);
    const vehicle = this.dynamic.get(car);
    if (vehicle) {
      this.owners.delete(vehicle.body.GetID().GetIndexAndSequenceNumber());
      this.dynamic.delete(car);
      car.physical = null;
    }
    return vehicle;
  }

  keepCar(vehicle) {
    const { car } = vehicle;
    car.physical = vehicle;
    this.dynamic.set(car, vehicle);
    this.owners.set(vehicle.body.GetID().GetIndexAndSequenceNumber(), car);
  }

  removeCar(car) {
    this.takeCar(car)?.dispose();
  }

  selectCars(game) {
    const { focus, vehicles, world, colliders } = game;
    const cap = this.quality.name === 'low' ? 10 : this.quality.name === 'medium' ? 20 : 40;
    const distance = (car) => (car.x - focus.x) ** 2 + (car.z - focus.z) ** 2;
    const eligible = (car) => !car.dead && car !== game.driver?.car &&
      (car.mode === 'ai' || car.mode === 'police' || car.mode === 'parked' || car.mode === 'loose') &&
      colliders.tiles.has(world.chunkIndex(car.x, car.z));
    const candidates = vehicles.cars.filter((car) => eligible(car) && distance(car) <= (car.physical ? 220 : 150) ** 2);
    // Nejbližší auto musí jít odtlačit. Za ním potřebují kola hlavně vozy v provozu.
    const priority = (car) => {
      if (car.floodTime || car.mode === 'police') return 3;
      if (distance(car) < 25 ** 2 || car.mode === 'loose' && car.physical?.body.IsActive()) return 2;
      return car.mode === 'parked' ? 0 : 1;
    };
    candidates.sort((a, b) => priority(b) - priority(a) ||
      Number(!!b.physical) - Number(!!a.physical) || distance(a) - distance(b));
    const selected = new Set(candidates.slice(0, cap));
    for (const [car, vehicle] of this.dynamic) if (!selected.has(car)) {
      if (car.mode === 'parked' && !car.floodTime) {
        vehicle.read();
        // I mimo okruh musí valící se vrak dojet. Zaparkovaný vůz už polohu
        // nemění a nesmí si nést zbytkovou rychlost z posledního kroku.
        if (vehicle.body.IsActive() && (car.air || Math.hypot(car.vx, car.vy, car.vz) >= 0.2)) {
          car.mode = 'loose';
          car.rest = 0;
        } else {
          car.vx = car.vy = car.vz = car.speed = 0;
        }
      }
      this.removeCar(car);
    }
    for (const car of selected) {
      if (car.physical && !car.physicsTeleport) continue;
      if (!car.physical) {
        this.removeProxy(car);
        this.keepCar(new PlayerVehicle(this.physics, car));
      } else car.physical.teleport();
      if (car.mode === 'parked' && Math.abs(car.speed) < 0.1) this.physics.bodies.DeactivateBody(car.physical.body.GetID());
      car.physicsTeleport = false;
    }
  }

  drive(game, dt) {
    for (const [car, vehicle] of this.dynamic) {
      if (car.mode === 'ai') game.vehicles.stepAI(car, dt, vehicle);
      else if (car.mode === 'police' && game.wanted > 0) game.vehicles.stepPolice(car, dt, game.focus, vehicle);
      else if (vehicle.body.IsActive()) {
        if (car.mode === 'parked' && !car.floodTime) vehicle.driveAI(parkingBrake, dt, game.tireSurface);
        else vehicle.controller.SetDriverInput(0, 0, 0.6, 0);
      }
    }
  }

  recordImpact(a, b, impulse, manifold) {
    for (const body of [a, b]) {
      const car = this.owners.get(body.GetID().GetIndexAndSequenceNumber());
      car?.physical?.recordImpact(a, b, impulse, manifold);
    }
  }

  read(game) {
    for (const [car, vehicle] of this.dynamic) {
      if (car.mode === 'parked' && !vehicle.body.IsActive() && !vehicle.impactSpeed &&
          !car.vx && !car.vy && !car.vz && !car.speed) continue;
      vehicle.read();
      if (vehicle.touchedVehicle) {
        vehicle.touchedVehicle = false;
        const sideSpeed = car.vx * Math.cos(car.yaw) - car.vz * Math.sin(car.yaw);
        if ((car.mode === 'ai' || car.mode === 'police') && (Math.abs(sideSpeed) > 1.5 || car.speed < -1) ||
            car.mode === 'parked' && Math.hypot(car.vx, car.vz) > 0.6) game.vehicles.knock(car);
      }
      if (!vehicle.impactSpeed) continue;
      const other = this.carForBody(vehicle.impactBody);
      const hitPlayer = vehicle.impactBody === game.driver?.body.GetID().GetIndexAndSequenceNumber();
      const impact = vehicle.applyImpact();
      if (impact > 4) game.vehicles.knock(car);
      if (!hitPlayer) game.onCrash(car, impact, other);
    }
  }

  update(game, dt) {
    this.frame++;
    this.selectCars(game);
    for (const ped of game.peds.peds) {
      if (ped.state === 'down' || Math.hypot(ped.x - game.focus.x, ped.z - game.focus.z) > 80) continue;
      this.move(game.focus, ped, ped.x, ped.y, ped.z, 0, 0.7, 1.8, 0.7, dt, layers.CHARACTER);
    }
    for (const car of game.vehicles.cars) if (!car.physical && car !== game.driver?.car && !car.dead) {
      this.move(game.focus, car, car.x, car.y, car.z, car.yaw, car.type.wid, car.type.h, car.type.len, dt, layers.VEHICLE);
    }
    for (const [key, entry] of this.active) if (entry.frame !== this.frame) {
      this.removeProxy(key);
    }
  }

  carForBody(id) {
    const owner = this.owners.get(id);
    return owner?.isCar ? owner : null;
  }

  move(focus, key, x, y, z, yaw, width, height, length, dt, layer) {
    if ((x - focus.x) ** 2 + (z - focus.z) ** 2 > 150 ** 2) return;
    const { Jolt, bodies } = this.physics;
    this.pos.Set(x, y + height / 2, z);
    this.rotation.Set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
    let entry = this.active.get(key);
    if (!entry) {
      const half = new Jolt.Vec3(width / 2, height / 2, length / 2);
      const isPed = layer === layers.CHARACTER;
      const shape = isPed ? new Jolt.CapsuleShape((height - width) / 2, width / 2) : new Jolt.BoxShape(half);
      const settings = new Jolt.BodyCreationSettings(shape, this.pos, this.rotation, Jolt.EMotionType_Kinematic, layer);
      settings.mIsSensor = isPed;
      settings.mCollideKinematicVsNonDynamic = isPed;
      const body = bodies.CreateBody(settings);
      this.owners.set(body.GetID().GetIndexAndSequenceNumber(), key);
      bodies.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
      Jolt.destroy(settings);
      Jolt.destroy(half);
      entry = { body };
      this.active.set(key, entry);
    } else {
      bodies.MoveKinematic(entry.body.GetID(), this.pos, this.rotation, Math.max(1 / 60, dt));
    }
    entry.frame = this.frame;
  }
}
