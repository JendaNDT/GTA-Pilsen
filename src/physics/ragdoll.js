import { layers } from './world.js';

const radians = degrees => degrees * Math.PI / 180;

// Rozměry a středy odpovídají stojící postavě. Klouby jsou ve stejné místní soustavě.
export const parts = [
  { name: 'panev', parent: -1, x: 0, y: 0.91, size: [0.40, 0.18, 0.26], mass: 12, color: 'shirt' },
  { name: 'hrudnik', parent: 0, x: 0, y: 1.225, size: [0.45, 0.45, 0.26], mass: 21, color: 'shirt', joint: [0, 1.0], cone: [25, 20, 25] },
  { name: 'hlava', parent: 1, x: 0, y: 1.62, size: [0.24, 0.32, 0.24], mass: 5, color: 'skin', joint: [0, 1.46], cone: [45, 35, 60] },
];
for (const side of [1, -1]) {
  const arm = parts.length, x = 0.3 * side;
  parts.push(
    { name: 'paze' + side, parent: 1, x, y: 1.29, size: [0.12, 0.29, 0.14], mass: 2, color: 'shirt', joint: [x, 1.42], cone: [85, 90, 70] },
    { name: 'predlokti' + side, parent: arm, x, y: 0.99, size: [0.115, 0.31, 0.13], mass: 1.6, color: 'shirt', joint: [x, 1.145], hinge: [-140, 2] },
  );
  const leg = parts.length, hip = 0.12 * side;
  parts.push(
    { name: 'stehno' + side, parent: 0, x: hip, y: 0.64, size: [0.17, 0.40, 0.19], mass: 8, color: 'pants', joint: [hip, 0.84], cone: [60, 40, 35] },
    { name: 'lytko' + side, parent: leg, x: hip, y: 0.235, size: [0.17, 0.41, 0.19], mass: 4, color: 'pants', joint: [hip, 0.44], hinge: [-2, 135] },
  );
}

function jointSettings(Jolt, part) {
  const [x, y] = part.joint;
  if (part.hinge) {
    const c = new Jolt.HingeConstraintSettings();
    c.mPoint1.Set(x, y, 0); c.mPoint2.Set(x, y, 0);
    c.mHingeAxis1.Set(1, 0, 0); c.mHingeAxis2.Set(1, 0, 0);
    c.mNormalAxis1.Set(0, 0, 1); c.mNormalAxis2.Set(0, 0, 1);
    c.mLimitsMin = radians(part.hinge[0]); c.mLimitsMax = radians(part.hinge[1]);
    c.mMaxFrictionTorque = 2;
    return c;
  }
  const c = new Jolt.SwingTwistConstraintSettings();
  c.mPosition1.Set(x, y, 0); c.mPosition2.Set(x, y, 0);
  c.mTwistAxis1.Set(0, 1, 0); c.mTwistAxis2.Set(0, 1, 0);
  c.mPlaneAxis1.Set(0, 0, 1); c.mPlaneAxis2.Set(0, 0, 1);
  c.mNormalHalfConeAngle = radians(part.cone[0]); c.mPlaneHalfConeAngle = radians(part.cone[1]);
  c.mTwistMinAngle = -radians(part.cone[2]); c.mTwistMaxAngle = radians(part.cone[2]);
  c.mMaxFrictionTorque = 3;
  return c;
}

let group = 0;
export class Ragdoll {
  constructor(physics, actor, vx, vy, vz, floor) {
    const { Jolt, bodies, system } = physics;
    this.physics = physics;
    const settings = new Jolt.RagdollSettings(), skeleton = new Jolt.Skeleton();
    settings.mSkeleton = skeleton;
    settings.mParts.resize(parts.length);
    const half = new Jolt.Vec3();
    for (const [i, p] of parts.entries()) {
      const name = new Jolt.JPHString(p.name, p.name.length);
      skeleton.AddJoint(name, p.parent);
      Jolt.destroy(name);
      const spec = settings.mParts.at(i);
      half.Set(p.size[0] / 2, p.size[1] / 2, p.size[2] / 2);
      spec.SetShape(new Jolt.BoxShape(half, 0.015));
      spec.mPosition.Set(p.x, p.y, 0);
      spec.mMotionType = Jolt.EMotionType_Dynamic;
      spec.mObjectLayer = layers.DEBRIS;
      spec.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      spec.mMassPropertiesOverride.mMass = p.mass;
      spec.mFriction = 0.85;
      spec.mAngularDamping = 0.45;
      spec.mLinearDamping = 0.2;
      if (p.parent >= 0) spec.mToParent = jointSettings(Jolt, p);
    }
    settings.Stabilize();
    settings.DisableParentChildCollisions();
    // Ragdoll převezme nastavení se skeletem, tvary i klouby a uvolní je při zániku.
    this.doll = settings.CreateRagdoll(++group, 0, system);
    const cos = Math.cos(actor.yaw), sin = Math.sin(actor.yaw);
    const pos = new Jolt.RVec3(), rot = new Jolt.Quat(0, Math.sin(actor.yaw / 2), 0, Math.cos(actor.yaw / 2));
    let base = actor.y;
    for (const p of parts) {
      for (const sx of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) {
        const x = p.x + p.size[0] * sx, z = p.size[2] * sz;
        base = Math.max(base, floor(actor.x + cos * x + sin * z, actor.z - sin * x + cos * z)
          - p.y + p.size[1] / 2 + 0.02);
      }
    }
    this.links = parts.map((p, i) => {
      const id = this.doll.GetBodyID(i);
      pos.Set(actor.x + cos * p.x, base + p.y, actor.z - sin * p.x);
      bodies.SetPositionAndRotation(id, pos, rot, Jolt.EActivation_DontActivate);
      return system.GetBodyLockInterfaceNoLock().TryGetBody(id);
    });
    this.doll.AddToPhysicsSystem(Jolt.EActivation_Activate);
    const scale = Math.min(1, 16 / (Math.hypot(vx, vy, vz) || 1));
    half.Set(vx * scale, vy * scale, vz * scale);
    const angular = new Jolt.Vec3(vz * scale * 0.3 + 0.5, 0, -vx * scale * 0.3);
    this.doll.SetLinearAndAngularVelocity(half, angular);
    for (const value of [half, pos, rot, angular]) Jolt.destroy(value);
    this.age = 0;
    this.rest = 0;
  }

  update(dt) {
    this.age += dt;
    const resting = this.links.every(body => !body.IsActive() ||
      (body.GetLinearVelocity().LengthSq() < 0.04 && body.GetAngularVelocity().LengthSq() < 0.25));
    this.rest = resting ? this.rest + dt : 0;
  }

  dispose() {
    this.doll.RemoveFromPhysicsSystem();
    this.physics.Jolt.destroy(this.doll);
  }
}
