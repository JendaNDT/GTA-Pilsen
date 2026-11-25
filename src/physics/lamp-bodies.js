import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three/webgpu';
import { layers } from './world.js';

const box = new BoxGeometry(1, 1, 1);
const metal = new MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.64, metalness: 0.38 });
const housing = new MeshStandardMaterial({ color: 0xa5a39a, roughness: 0.6 });

export class LampBodies {
  constructor(physics, registry, scene) {
    this.physics = physics;
    this.registry = registry;
    this.scene = scene;
    this.nearby = new Map();
    this.bodies = new Map();
    this.byBody = new Map();
    this.pending = new Set();
    this.hits = new Map();
    this.debris = new Map();
    const { Jolt } = physics;
    this.position = new Jolt.RVec3(0, 0, 0);
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
    this.vector = new Jolt.Vec3(0, 0, 0);
  }

  load(lamps) {
    for (const lamp of lamps) {
      this.nearby.set(lamp.id, lamp);
      this.pending.add(lamp.id);
    }
  }

  unload(lamps) {
    for (const lamp of lamps) {
      this.nearby.delete(lamp.id);
      this.pending.add(lamp.id);
    }
  }

  contact(first, second, impulse) {
    if (impulse < 6000) return;
    const pole = first.GetObjectLayer() === layers.BREAKABLE ? first : second;
    const vehicle = pole === first ? second : first;
    if (vehicle.GetObjectLayer() !== layers.VEHICLE) return;
    const lamp = this.byBody.get(pole.GetID().GetIndexAndSequenceNumber());
    if (!lamp || (this.hits.get(lamp.id)?.impulse ?? 0) >= impulse) return;
    const v = vehicle.GetLinearVelocity();
    this.hits.set(lamp.id, { impulse, car: vehicle.GetID().GetIndexAndSequenceNumber(), vx: v.GetX(), vz: v.GetZ() });
  }

  create(lamp, head, loose) {
    const { Jolt, bodies } = this.physics;
    const height = head ? 0.14 : lamp.height;
    const width = head ? lamp.head : 0.16;
    this.position.Set(head ? lamp.lightX ?? lamp.x : lamp.x, lamp.y + (head ? lamp.height + height / 2 : height / 2),
      head ? lamp.lightZ ?? lamp.z : lamp.z);
    this.vector.Set(width / 2, height / 2, width / 2);
    const shape = head ? new Jolt.BoxShape(this.vector) : new Jolt.CylinderShape(height / 2, 0.1, 0.02);
    const settings = new Jolt.BodyCreationSettings(shape, this.position, this.rotation,
      loose ? Jolt.EMotionType_Dynamic : Jolt.EMotionType_Static, loose ? layers.DEBRIS : layers.BREAKABLE);
    if (loose) {
      settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      settings.mMassPropertiesOverride.mMass = head ? 5 : 45;
    }
    const body = bodies.CreateBody(settings);
    bodies.AddBody(body.GetID(), loose ? Jolt.EActivation_Activate : Jolt.EActivation_DontActivate);
    Jolt.destroy(settings);
    return body;
  }

  scatter(lamp, hit) {
    const pieces = [];
    for (const head of [false, true]) {
      const body = this.create(lamp, head, true);
      const mesh = new Mesh(box, head ? housing : metal);
      mesh.scale.set(head ? lamp.head : 0.16, head ? 0.14 : lamp.height, head ? lamp.head : 0.16);
      this.scene.add(mesh);
      this.vector.Set(hit.vx * 0.3, head ? 1 : 0.4, hit.vz * 0.3);
      this.physics.bodies.SetLinearVelocity(body.GetID(), this.vector);
      this.vector.Set(-hit.vz / lamp.height, 0, hit.vx / lamp.height);
      this.physics.bodies.SetAngularVelocity(body.GetID(), this.vector);
      const piece = { body, mesh };
      pieces.push(piece);
      this.physics.debris?.add(body, () => {
        this.remove(body);
        mesh.removeFromParent();
        pieces.splice(pieces.indexOf(piece), 1);
      });
    }
    this.debris.set(lamp.id, pieces);
  }

  remove(body) {
    this.physics.debris?.forget(body);
    const id = body.GetID();
    this.physics.bodies.RemoveBody(id);
    this.physics.bodies.DestroyBody(id);
  }

  dispose() {
    for (const body of this.bodies.values()) this.remove(body);
    for (const pieces of this.debris.values()) for (const { body, mesh } of pieces) {
      this.scene.remove(mesh);
      this.remove(body);
    }
    for (const value of [this.position, this.rotation, this.vector]) this.physics.Jolt.destroy(value);
  }

  repair(now) {
    const repaired = this.registry.repairDue(now);
    for (const id of repaired) if (this.nearby.has(id) || this.debris.has(id)) this.pending.add(id);
    return repaired;
  }

  step(now, budget = 20) {
    for (const [id, hit] of this.hits) {
      if (budget < 3 || this.physics.debris?.room(2) === false) break;
      this.hits.delete(id);
      const lamp = this.nearby.get(id), body = this.bodies.get(id);
      if (!lamp || !body || !this.registry.damage(id, 'broken', now)) continue;
      this.byBody.delete(body.GetID().GetIndexAndSequenceNumber());
      this.remove(body);
      this.bodies.delete(id);
      this.scatter(lamp, hit);
      this.physics.onFurnitureDamage?.(lamp, hit, 'metal');
      budget -= 3;
    }
    for (const id of this.pending) {
      if (budget < 3) break;
      this.pending.delete(id);
      const lamp = this.nearby.get(id);
      const intact = this.registry.state(id) === 'intact';
      const pieces = this.debris.get(id);
      if (pieces && (!lamp || intact)) {
        for (const piece of pieces) {
          this.remove(piece.body);
          this.scene.remove(piece.mesh);
          budget--;
        }
        this.debris.delete(id);
      }
      const body = this.bodies.get(id);
      if (body && (!lamp || !intact)) {
        this.byBody.delete(body.GetID().GetIndexAndSequenceNumber());
        this.remove(body);
        this.bodies.delete(id);
        budget--;
      } else if (!body && lamp && intact) {
        const pole = this.create(lamp, false, false);
        this.bodies.set(id, pole);
        this.byBody.set(pole.GetID().GetIndexAndSequenceNumber(), lamp);
        budget--;
      }
    }
    for (const pieces of this.debris.values()) for (const { body, mesh } of pieces) {
      const p = body.GetPosition(), q = body.GetRotation();
      mesh.position.set(p.GetX(), p.GetY(), p.GetZ());
      mesh.quaternion.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW());
    }
    return budget;
  }
}
