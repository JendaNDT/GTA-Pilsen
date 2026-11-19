import { Group } from 'three/webgpu';
import { trafficFurniture } from '../world/traffic-furniture.js';
import { trafficFragment } from '../world/traffic-meshes.js';
import { layers } from './world.js';

function bodyKey(body) {
  return body.GetID().GetIndexAndSequenceNumber();
}

function readPose(body) {
  const p = body.GetPosition(), q = body.GetRotation();
  return { x: p.GetX(), y: p.GetY(), z: p.GetZ(), qx: q.GetX(), qy: q.GetY(), qz: q.GetZ(), qw: q.GetW() };
}

export class TrafficFurnitureBodies {
  constructor(physics, world, scene) {
    this.physics = physics;
    this.world = world;
    this.registry = world.breakables;
    this.scene = scene;
    this.tiles = new Map();
    this.nearby = new Map();
    this.records = new Map();
    this.byBody = new Map();
    this.moving = new Set();
    this.pending = new Set();
    this.hits = new Map();
    const { Jolt } = physics;
    this.position = new Jolt.RVec3(0, 0, 0);
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
    this.offset = new Jolt.Vec3(0, 0, 0);
    this.axis = new Jolt.Vec3(0, 0, 0);
    this.up = new Jolt.Vec3(0, 1, 0);
  }

  load(ci) {
    const entries = this.world.traffic.chunks.get(ci);
    if (!entries) return;
    const fixtures = [
      ...(entries.posts ?? []).map(post => trafficFurniture(this.world, post, 'bollard')),
      ...entries.signs.map(sign => trafficFurniture(this.world, sign, 'sign')),
      ...entries.heads.map(head => trafficFurniture(this.world, head, 'signal')),
    ];
    this.tiles.set(ci, fixtures);
    for (const fixture of fixtures) {
      this.nearby.set(fixture.id, fixture);
      this.pending.add(fixture.id);
    }
  }

  unload(ci) {
    for (const { id } of this.tiles.get(ci) ?? []) {
      this.nearby.delete(id);
      this.pending.add(id);
    }
    this.tiles.delete(ci);
  }

  repair(ids) {
    for (const id of ids) if (this.nearby.has(id) || this.records.has(id)) this.pending.add(id);
  }

  contact(first, second, impulse) {
    const vehicle = first.GetObjectLayer() === layers.VEHICLE ? first : second;
    if (vehicle.GetObjectLayer() !== layers.VEHICLE || !vehicle.IsDynamic()) return;
    const record = this.byBody.get(bodyKey(vehicle === first ? second : first));
    if (!record) return;
    const { fixture, hinge } = record;
    if (hinge) {
      // Kloub drží patu ve světě. Pro práh zlomení počítáme s oporou v zemi.
      impulse *= 1 + record.body.GetMotionProperties().GetInverseMass() / vehicle.GetMotionProperties().GetInverseMass();
    }
    const breaks = impulse >= { bollard: 8000, sign: 9000, signal: 15000 }[fixture.type];
    if (!breaks && (fixture.type !== 'sign' || impulse < 2500 || record.state !== 'intact')) return;
    if ((this.hits.get(fixture.id)?.impulse ?? 0) >= impulse) return;
    const v = vehicle.GetLinearVelocity();
    this.hits.set(fixture.id, { impulse, breaks, car: bodyKey(vehicle), vx: v.GetX(), vz: v.GetZ() });
  }

  body(fixture, parts, dynamic, pose = null) {
    const { Jolt, bodies } = this.physics;
    const compound = new Jolt.StaticCompoundShapeSettings();
    for (const name of parts) {
      const part = fixture[name];
      this.offset.Set(part.width / 2, part.height / 2, part.depth / 2);
      const shape = name === 'pole'
        ? new Jolt.CylinderShapeSettings(part.height / 2, part.width / 2, 0.01)
        : new Jolt.BoxShapeSettings(this.offset, 0.01);
      this.offset.Set(part.x, part.y, part.z);
      this.rotation.Set(0, Math.sin(part.yaw / 2), 0, Math.cos(part.yaw / 2));
      compound.AddShape(this.offset, this.rotation, shape, 0);
    }
    const result = compound.Create();
    try {
      if (result.HasError()) throw new Error('Nepodařilo se vytvořit těleso značky: ' + result.GetError().c_str());
      this.position.Set(pose?.x ?? fixture.x, pose?.y ?? fixture.y, pose?.z ?? fixture.z);
      this.rotation.Set(pose?.qx ?? 0, pose?.qy ?? 0, pose?.qz ?? 0, pose?.qw ?? 1);
      const settings = new Jolt.BodyCreationSettings(result.Get(), this.position, this.rotation,
        dynamic ? Jolt.EMotionType_Dynamic : Jolt.EMotionType_Static, dynamic ? layers.DEBRIS : layers.BREAKABLE);
      try {
        if (dynamic) {
          settings.mAngularDamping = 0.8;
          settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
          settings.mMassPropertiesOverride.mMass = parts.length > 1 ? 9 : parts[0] === 'pole' ? 6 : 3;
        }
        const body = bodies.CreateBody(settings);
        bodies.AddBody(body.GetID(), dynamic ? Jolt.EActivation_Activate : Jolt.EActivation_DontActivate);
        return body;
      } finally {
        Jolt.destroy(settings);
      }
    } finally {
      result.Clear();
      Jolt.destroy(compound);
    }
  }

  bend(fixture, hit) {
    const { Jolt, engine, system, bodies } = this.physics;
    const body = this.body(fixture, ['pole', 'panel'], true, {
      x: fixture.x, y: fixture.y + 0.07, z: fixture.z, qx: 0, qy: 0, qz: 0, qw: 1,
    });
    const speed = Math.hypot(hit.vx, hit.vz);
    this.axis.Set(speed > 0.1 ? hit.vz / speed : fixture.entry.tz, 0,
      speed > 0.1 ? -hit.vx / speed : -fixture.entry.tx);
    const settings = new Jolt.HingeConstraintSettings();
    settings.mSpace = Jolt.EConstraintSpace_WorldSpace;
    this.position.Set(fixture.x, fixture.y + 0.07, fixture.z);
    settings.mPoint1 = settings.mPoint2 = this.position;
    settings.mHingeAxis1 = settings.mHingeAxis2 = this.axis;
    settings.mNormalAxis1 = settings.mNormalAxis2 = this.up;
    settings.mLimitsMin = 0;
    settings.mLimitsMax = Math.PI / 3;
    const motor = settings.mMotorSettings;
    motor.mSpringSettings.mFrequency = 2.2;
    motor.mSpringSettings.mDamping = 1.2;
    motor.mMinTorqueLimit = -220;
    motor.mMaxTorqueLimit = 220;
    const hinge = Jolt.castObject(settings.Create(engine.sGetFixedToWorldBody(), body), Jolt.HingeConstraint);
    Jolt.destroy(settings);
    hinge.SetTargetAngle(0.25 + 0.25 * (hit.impulse - 2500) / 6500);
    hinge.SetMotorState(Jolt.EMotorState_Position);
    system.AddConstraint(hinge);
    bodies.ActivateBody(body.GetID());
    this.addRecord({ fixture, state: 'bent', body, hinge });
  }

  scatter(fixture, hit, pose) {
    const pieces = [];
    for (const name of fixture.panel ? ['pole', 'panel'] : ['pole']) {
      const body = this.body(fixture, [name], true, pose);
      let mesh;
      if (this.scene) {
        const part = fixture[name];
        const fragment = trafficFragment(fixture, name);
        fragment.position.set(part.x, part.y, part.z);
        fragment.rotation.y = part.yaw;
        mesh = new Group();
        mesh.add(fragment);
        this.scene.add(mesh);
      }
      this.offset.Set(hit.vx * 0.22, name === 'pole' ? 0.35 : 1, hit.vz * 0.22);
      this.physics.bodies.SetLinearVelocity(body.GetID(), this.offset);
      this.offset.Set(hit.vz * 0.15, 0, -hit.vx * 0.15);
      this.physics.bodies.SetAngularVelocity(body.GetID(), this.offset);
      const piece = { body, mesh };
      pieces.push(piece);
      this.physics.debris?.add(body, () => {
        const id = body.GetID();
        this.physics.bodies.RemoveBody(id);
        this.physics.bodies.DestroyBody(id);
        mesh?.removeFromParent();
        pieces.splice(pieces.indexOf(piece), 1);
      });
    }
    this.addRecord({ fixture, state: 'broken', pieces });
  }

  addRecord(record) {
    const { id } = record.fixture;
    this.records.set(id, record);
    if (record.body) this.byBody.set(bodyKey(record.body), record);
    if (record.hinge || record.pieces) this.moving.add(record);
  }

  removeRecord(record) {
    const { body, hinge, pieces, fixture } = record;
    const { system, bodies } = this.physics;
    let count = 0;
    const remove = bodyToRemove => {
      this.physics.debris?.forget(bodyToRemove);
      const id = bodyToRemove.GetID();
      bodies.RemoveBody(id);
      bodies.DestroyBody(id);
      count++;
    };
    if (hinge) system.RemoveConstraint(hinge);
    if (body) {
      this.byBody.delete(bodyKey(body));
      remove(body);
    }
    for (const piece of pieces ?? []) {
      piece.mesh?.removeFromParent();
      remove(piece.body);
    }
    this.records.delete(fixture.id);
    this.moving.delete(record);
    return count;
  }

  place(fixture, state, pose = null) {
    const body = this.body(fixture, fixture.panel ? ['pole', 'panel'] : ['pole'], false, pose);
    this.addRecord({ fixture, state, body });
  }

  step(now, budget = 20) {
    for (const [id, hit] of this.hits) {
      const record = this.records.get(id);
      if (!record?.body || !this.nearby.has(id)) {
        this.hits.delete(id);
        continue;
      }
      const parts = hit.breaks && record.fixture.panel ? 2 : 1;
      if (budget < 1 + parts || (hit.breaks && this.physics.debris?.room(parts) === false)) break;
      this.hits.delete(id);
      const state = hit.breaks ? 'broken' : 'bent';
      if (record.state !== this.registry.state(id) || !this.registry.damage(id, state, now)) continue;
      this.physics.onFurnitureDamage?.(record.fixture, hit, record.fixture.type === 'signal' ? 'glass' : 'metal');
      const pose = record.state === 'bent' ? readPose(record.body) : null;
      budget -= this.removeRecord(record);
      if (hit.breaks) {
        this.scatter(record.fixture, hit, pose);
        budget -= parts;
      } else {
        this.bend(record.fixture, hit);
        budget--;
      }
    }
    for (const id of this.pending) {
      const record = this.records.get(id), fixture = this.nearby.get(id), state = this.registry.state(id);
      const remove = record && (!fixture || state !== record.state);
      const place = fixture && state !== 'broken' && (!record || remove);
      if (budget < (remove ? record.pieces?.length ?? 1 : 0) + Number(!!place)) break;
      this.pending.delete(id);
      if (remove) budget -= this.removeRecord(record);
      if (place) {
        this.place(fixture, state, this.registry.damaged.get(id)?.pose);
        budget--;
      }
    }
    for (const record of this.moving) {
      const { fixture, body, hinge, pieces } = record;
      if (hinge) {
        if (this.registry.state(fixture.id) !== 'bent') continue;
        const pose = readPose(body);
        this.registry.bendPose(fixture.id, pose);
        if (!body.IsActive() && budget >= 2) {
          this.removeRecord(record);
          this.place(fixture, 'bent', pose);
          budget -= 2;
        }
      }
      for (const piece of pieces ?? []) if (piece.mesh) {
        const p = readPose(piece.body);
        piece.mesh.position.set(p.x, p.y, p.z);
        piece.mesh.quaternion.set(p.qx, p.qy, p.qz, p.qw);
      }
    }
    return budget;
  }

  dispose() {
    for (const record of this.records.values()) this.removeRecord(record);
    for (const vector of [this.position, this.rotation, this.offset, this.axis, this.up]) this.physics.Jolt.destroy(vector);
  }
}
