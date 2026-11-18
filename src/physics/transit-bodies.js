import { Vector3 } from 'three/webgpu';
import { layers } from './world.js';

// Každá skříň sleduje svoje nápravy. Spřáhlo ani měch mezi skříněmi netlačí na auto podruhé.
export class TransitBodies {
  constructor(physics) {
    this.physics = physics;
    this.sections = new Map();
    this.tick = 0;
    this.center = new Vector3();
    this.pos = new physics.Jolt.RVec3(0, 0, 0);
    this.rotation = new physics.Jolt.Quat(0, 0, 0, 1);
  }

  remove(mesh, entry) {
    const { bodies } = this.physics;
    const id = entry.body.GetID();
    bodies.RemoveBody(id);
    bodies.DestroyBody(id);
    this.sections.delete(mesh);
  }

  update(vehicles, focus, dt) {
    const { Jolt, bodies } = this.physics;
    this.tick++;
    for (const v of vehicles) {
      if (!v.visible) continue;
      for (const [index, mesh] of v.meshes.entries()) {
        const length = v.sections[index].length;
        const p = mesh.position, q = mesh.quaternion;
        if (Math.hypot(p.x - focus.x, p.z - focus.z) > 150 + length / 2) continue;
        const height = v.isTram ? 3.2 : 2.9;
        this.center.set(0, height / 2 + 0.15, 0).applyQuaternion(q).add(p);
        this.pos.Set(this.center.x, this.center.y, this.center.z);
        this.rotation.Set(q.x, q.y, q.z, q.w);
        let entry = this.sections.get(mesh);
        // Při přeskočení herních hodin nevznikne náraz přes celý projetý úsek.
        if (entry && Math.hypot(p.x - entry.x, p.z - entry.z) > 2 + dt * 25) {
          this.remove(mesh, entry);
          entry = null;
        }
        if (!entry) {
          const half = new Jolt.Vec3(1.25, height / 2, length / 2);
          const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), this.pos, this.rotation,
            Jolt.EMotionType_Kinematic, layers.TRANSIT);
          const body = bodies.CreateBody(settings);
          bodies.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
          Jolt.destroy(settings);
          Jolt.destroy(half);
          entry = { body };
          this.sections.set(mesh, entry);
        } else bodies.MoveKinematic(entry.body.GetID(), this.pos, this.rotation, dt);
        entry.x = p.x; entry.z = p.z; entry.tick = this.tick;
      }
    }
    for (const [mesh, entry] of this.sections) if (entry.tick !== this.tick) {
      this.remove(mesh, entry);
    }
  }
}
