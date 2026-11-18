import { layers } from './world.js';

// Ostatní vozy předávají fyzice své polohy z existující simulace dopravy.
export class TrafficBodies {
  constructor(physics) {
    this.physics = physics;
    this.active = new Map();
    const { Jolt } = physics;
    this.pos = new Jolt.RVec3(0, 0, 0);
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
    this.frame = 0;
  }

  update(game, dt) {
    this.frame++;
    if (game.driver) {
      for (const car of game.vehicles.cars) if (car !== game.car && !car.dead) {
        this.move(game.car, car, car.x, car.y, car.z, car.yaw, car.type.wid, car.type.h, car.type.len, dt, layers.VEHICLE);
      }
      for (const vehicle of game.transit.vehicles) if (vehicle.visible && vehicle.meshes) {
        for (const [i, mesh] of vehicle.meshes.entries()) {
          const p = mesh.position;
          this.move(game.car, mesh, p.x, p.y, p.z, mesh.rotation.y, 2.5, 2.9, vehicle.sections[i].length, dt, layers.TRANSIT);
        }
      }
    }
    for (const [key, entry] of this.active) if (entry.frame !== this.frame) {
      const id = entry.body.GetID();
      this.physics.bodies.RemoveBody(id);
      this.physics.bodies.DestroyBody(id);
      this.active.delete(key);
    }
  }

  move(focus, key, x, y, z, yaw, width, height, length, dt, layer) {
    if ((x - focus.x) ** 2 + (z - focus.z) ** 2 > 150 ** 2) return;
    const { Jolt, bodies } = this.physics;
    this.pos.Set(x, y + height / 2, z);
    this.rotation.Set(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
    let entry = this.active.get(key);
    if (!entry) {
      const half = new Jolt.Vec3(width / 2, height / 2, length / 2);
      const shape = new Jolt.BoxShape(half);
      const settings = new Jolt.BodyCreationSettings(shape, this.pos, this.rotation, Jolt.EMotionType_Kinematic, layer);
      const body = bodies.CreateBody(settings);
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
