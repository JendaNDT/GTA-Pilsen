import { layers } from './world.js';

// Ostatní vozy předávají fyzice své polohy z existující simulace dopravy.
export class TrafficBodies {
  constructor(physics) {
    this.physics = physics;
    this.active = new Map();
    this.owners = new Map();
    const { Jolt } = physics;
    this.pos = new Jolt.RVec3(0, 0, 0);
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
    this.frame = 0;
  }

  update(game, dt) {
    this.frame++;
    for (const ped of game.peds.peds) {
      if (ped.state === 'down' || Math.hypot(ped.x - game.focus.x, ped.z - game.focus.z) > 80) continue;
      this.move(game.focus, ped, ped.x, ped.y, ped.z, 0, 0.7, 1.8, 0.7, dt, layers.CHARACTER);
    }
    for (const car of game.vehicles.cars) if (car !== game.driver?.car && !car.dead) {
      this.move(game.focus, car, car.x, car.y, car.z, car.yaw, car.type.wid, car.type.h, car.type.len, dt, layers.VEHICLE);
    }
    if (game.driver) {
      for (const vehicle of game.transit.vehicles) if (vehicle.visible && vehicle.meshes) {
        for (const [i, mesh] of vehicle.meshes.entries()) {
          const p = mesh.position;
          this.move(game.car, mesh, p.x, p.y, p.z, mesh.rotation.y, 2.5, 2.9, vehicle.sections[i].length, dt, layers.TRANSIT);
        }
      }
    }
    for (const [key, entry] of this.active) if (entry.frame !== this.frame) {
      const id = entry.body.GetID();
      this.owners.delete(id.GetIndexAndSequenceNumber());
      this.physics.bodies.RemoveBody(id);
      this.physics.bodies.DestroyBody(id);
      this.active.delete(key);
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
