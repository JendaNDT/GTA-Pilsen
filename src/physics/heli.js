import { Euler, Quaternion, Vector3 } from 'three/webgpu';
import { layers } from './world.js';

const MASS = 2500, G = 9.81;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const skidEnds = [[-0.95, -1.4], [-0.95, 2], [0.95, -1.4], [0.95, 2]];

export class HelicopterBody {
  constructor(physics, heli) {
    const { Jolt, bodies } = physics;
    this.physics = physics;
    this.heli = heli;
    this.euler = new Euler(0, 0, 0, 'YXZ');
    this.q = new Quaternion().setFromEuler(this.euler.set(heli.pitch, heli.yaw, heli.roll));
    this.point = new Vector3();
    this.pos = new Jolt.RVec3(heli.x, heli.y, heli.z);
    this.vec = new Jolt.Vec3();
    const rotation = new Jolt.Quat(0, 0, 0, 1);
    const shape = new Jolt.StaticCompoundShapeSettings();
    const box = (x, y, z, hx, hy, hz) => {
      this.vec.Set(hx, hy, hz);
      const part = new Jolt.BoxShapeSettings(this.vec, 0.025);
      this.vec.Set(x, y, z);
      shape.AddShape(this.vec, rotation, part, 0);
    };
    box(0, 1.35, 0.3, 0.85, 0.7, 1.8);
    box(0, 1.9, -3.4, 0.15, 0.17, 2.1);
    for (const side of [-1, 1]) box(side * 0.95, 0.1, 0.3, 0.05, 0.05, 1.7);
    const result = shape.Create();
    rotation.Set(this.q.x, this.q.y, this.q.z, this.q.w);
    const settings = new Jolt.BodyCreationSettings(result.Get(), this.pos, rotation, Jolt.EMotionType_Dynamic, layers.VEHICLE);
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = MASS;
    settings.mLinearDamping = 0;
    settings.mAngularDamping = 0.12;
    settings.mMotionQuality = Jolt.EMotionQuality_LinearCast;
    settings.mFriction = 0.85;
    settings.mLinearVelocity.Set(heli.vx, heli.vy, heli.vz);
    this.body = bodies.CreateBody(settings);
    bodies.AddBody(this.body.GetID(), Jolt.EActivation_Activate);
    result.Clear();
    for (const object of [settings, shape, rotation]) Jolt.destroy(object);
    this.ray = new Jolt.RRayCast();
    this.hit = new Jolt.CastRayClosestHitCollisionCollector();
    this.raySettings = new Jolt.RayCastSettings();
    this.filters = [new Jolt.BroadPhaseLayerFilter(), new Jolt.SpecifiedObjectLayerFilter(layers.STATIC),
      new Jolt.BodyFilter(), new Jolt.ShapeFilter()];
    this.holdY = heli.y;
    this.impact = 0;
    this.impactCooldown = 0;
  }

  // Každý konec ližiny má pružinu a tlumič. Paprsek dopadá i na skutečnou síť střechy.
  suspension() {
    const { heli: h, physics, body, point } = this;
    let clearance = Infinity, contacts = 0;
    const omega = body.GetAngularVelocity(), com = body.GetCenterOfMassPosition();
    for (const [x, z] of skidEnds) {
      point.set(x, 0.05, z).applyQuaternion(this.q);
      const px = h.x + point.x, py = h.y + point.y, pz = h.z + point.z;
      this.ray.mOrigin.Set(px, py + 0.4, pz);
      this.ray.mDirection.Set(0, -8.4, 0);
      this.hit.Reset();
      physics.system.GetNarrowPhaseQuery().CastRay(this.ray, this.raySettings, this.hit, ...this.filters);
      if (!this.hit.HadHit()) continue;
      const height = this.hit.mHit.mFraction * 8.4 - 0.4;
      clearance = Math.min(clearance, height);
      if (height > 0.15) continue;
      contacts++;
      const vy = h.vy + omega.GetZ() * (px - com.GetX()) - omega.GetX() * (pz - com.GetZ());
      const force = clamp((0.15 - height) * 61500 - vy * 8600, 0, MASS * G * 1.5);
      this.vec.Set(0, force, 0);
      this.pos.Set(px, py, pz);
      body.AddForce(this.vec, this.pos);
      if (vy < -5) this.impact = Math.max(this.impact, -vy);
    }
    h.landed = contacts >= 2 && Math.abs(h.vy) < 1;
    return clearance;
  }

  drive(dt, forward, turn, lift, assisted) {
    const { heli: h, body, vec, point } = this;
    this.impactCooldown = Math.max(0, this.impactCooldown - dt);
    const clearance = this.suspension();
    const power = clamp((h.rotor - 10) / 16, 0, 1);
    const terrain = h.world.heightAt(h.x, h.z);
    const ceiling = terrain + 600;
    if (!h.occupied) { forward = 0; turn = 0; lift = -1; }
    if (lift || !assisted) this.holdY = h.y;
    const vz = lift ? lift * (lift > 0 ? 8 : 4) : clamp((this.holdY - h.y) * 1.8, -5, 5);
    const vertical = assisted ? (vz - h.vy) * 2.5 : lift * 5;
    const groundEffect = 1 + 0.12 * clamp(1 - clearance / 8, 0, 1);
    point.set(0, 1, 0).applyQuaternion(this.q);
    let thrust = (G + vertical) / (assisted ? Math.max(0.55, point.y) * groundEffect : 1);
    if (!h.occupied || h.landed && lift <= 0 && this.holdY <= h.y + 0.2) thrust = 0;
    if (h.y >= ceiling) thrust = Math.min(thrust, G - Math.max(0, h.vy));
    thrust = clamp(thrust * groundEffect * power, 0, 1.3 * G);
    const drag = h.landed ? 3 : 0.14;
    vec.Set(MASS * (thrust * point.x - h.vx * drag), MASS * thrust * point.y,
      MASS * (thrust * point.z - h.vz * drag));
    body.AddForce(vec);

    const omega = body.GetAngularVelocity(), sin = Math.sin(h.yaw), cos = Math.cos(h.yaw);
    const pitchRate = cos * omega.GetX() - sin * omega.GetZ();
    const rollRate = sin * omega.GetX() + cos * omega.GetZ();
    const pitch = assisted ? (forward * 0.51 - h.pitch) * 5 : forward * 0.9;
    const roll = assisted ? (-turn * Math.min(0.22, h.speed * 0.018) - h.roll) * 5 : 0;
    const pitchTorque = (pitch - pitchRate) * 16500 * power;
    const rollTorque = (roll - rollRate) * 4300 * power;
    vec.Set(pitchTorque * cos + rollTorque * sin, (-turn * 1.5 - omega.GetY()) * 12500 * power,
      -pitchTorque * sin + rollTorque * cos);
    body.AddTorque(vec);
    if (h.occupied) this.physics.bodies.ActivateBody(body.GetID());
  }

  read() {
    const { heli: h, body } = this;
    const pos = body.GetPosition(), rotation = body.GetRotation(), v = body.GetLinearVelocity();
    this.q.set(rotation.GetX(), rotation.GetY(), rotation.GetZ(), rotation.GetW());
    this.euler.setFromQuaternion(this.q);
    h.pitch = this.euler.x; h.yaw = this.euler.y; h.roll = this.euler.z;
    h.x = clamp(pos.GetX(), h.world.playMinX + 40, h.world.playMaxX - 40);
    h.z = clamp(pos.GetZ(), h.world.playMinZ + 40, h.world.playMaxZ - 40);
    h.y = pos.GetY();
    h.vx = v.GetX(); h.vy = v.GetY(); h.vz = v.GetZ();
    if (h.x !== pos.GetX() || h.z !== pos.GetZ()) {
      if (h.x !== pos.GetX()) h.vx = 0;
      if (h.z !== pos.GetZ()) h.vz = 0;
      this.pos.Set(h.x, h.y, h.z);
      this.physics.bodies.SetPosition(body.GetID(), this.pos, this.physics.Jolt.EActivation_Activate);
      this.vec.Set(h.vx, h.vy, h.vz);
      body.SetLinearVelocity(this.vec);
    }
    h.speed = Math.hypot(h.vx, h.vz);
    h.sync();
  }

  dispose() {
    const { Jolt, bodies } = this.physics;
    const id = this.body.GetID();
    bodies.RemoveBody(id); bodies.DestroyBody(id);
    for (const item of [...this.filters, this.raySettings, this.hit, this.ray, this.pos, this.vec]) Jolt.destroy(item);
  }
}
