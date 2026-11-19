import { Euler, Vector3 } from 'three/webgpu';
import { layers } from './world.js';

export class CarFragments {
  constructor(physics, scene) {
    this.physics = physics;
    this.scene = scene;
    this.pending = [];
    this.active = new Map();
    const { Jolt } = physics;
    this.position = new Jolt.RVec3(0, 0, 0);
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
    this.vector = new Jolt.Vec3(0, 0, 0);
  }

  queue(car, mesh, center) {
    mesh.quaternion.setFromEuler(new Euler(car.gPitch + car.pitch, car.yaw, car.gRoll + car.roll, 'YXZ'));
    mesh.position.copy(center).applyQuaternion(mesh.quaternion);
    mesh.position.add(new Vector3(car.x, car.y, car.z));
    this.pending.push({mesh, vx: car.vx, vy: car.vy, vz: car.vz});
  }

  create({mesh, vx, vy, vz}) {
    const { physics } = this, { bodies, Jolt } = physics;
    const half = mesh.geometry.boundingBox.getSize(new Vector3()).multiplyScalar(0.5);
    this.vector.Set(Math.max(0.04, half.x), Math.max(0.04, half.y), Math.max(0.04, half.z));
    const p = mesh.position, q = mesh.quaternion;
    this.position.Set(p.x, p.y, p.z);
    this.rotation.Set(q.x, q.y, q.z, q.w);
    const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(this.vector, 0.02),
      this.position, this.rotation, Jolt.EMotionType_Dynamic, layers.DEBRIS);
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = 12;
    const body = bodies.CreateBody(settings);
    Jolt.destroy(settings);
    bodies.AddBody(body.GetID(), Jolt.EActivation_Activate);
    this.vector.Set(vx, vy + 1, vz);
    body.SetLinearVelocity(this.vector);
    this.active.set(body, mesh);
    this.scene.add(mesh);
    physics.debris.add(body, () => this.remove(body));
  }

  remove(body) {
    const mesh = this.active.get(body);
    this.physics.debris.forget(body);
    this.active.delete(body);
    mesh.removeFromParent();
    mesh.geometry.dispose();
    const id = body.GetID();
    this.physics.bodies.RemoveBody(id);
    this.physics.bodies.DestroyBody(id);
  }

  step(budget, focus) {
    for (const [body, mesh] of this.active) {
      const p = body.GetPosition(), q = body.GetRotation();
      mesh.position.set(p.GetX(), p.GetY(), p.GetZ());
      mesh.quaternion.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
      if (budget && Math.hypot(mesh.position.x - focus.x, mesh.position.z - focus.z) > 160) {
        this.remove(body);
        budget--;
      }
    }
    while (budget && this.pending.length && this.physics.debris.room(1)) {
      this.create(this.pending.shift());
      budget--;
    }
    return budget;
  }

  dispose() {
    for (const body of this.active.keys()) this.remove(body);
    for (const { mesh } of this.pending) mesh.geometry.dispose();
    this.pending.length = 0;
    for (const v of [this.position, this.rotation, this.vector]) this.physics.Jolt.destroy(v);
  }
}
