import { dentCar, enginePower, steeringPull } from '../entities/damage.js';
import { Euler, Quaternion, Vector3 } from 'three/webgpu';
import { BodyPose } from './step.js';
import { layers } from './world.js';

export function vehicleSpec(type, upgrades = {}) {
  const sport = type.id === 'sport', mass = 1200 * type.mass;
  const radius = type.id === 'suv' || type.id === 'pickup' ? 0.39 : type.id === 'van' ? 0.36 : 0.31;
  const rpm = sport ? 7200 : 6200;
  const finalRatio = 3.7;
  const lastGear = rpm * Math.PI * radius / (30 * type.maxSpeed * finalRatio);
  const driven = ['suv', 'pickup', 'police'].includes(type.id) ? [0, 2]
    : ['sport', 'van'].includes(type.id) ? [2] : [0];
  return { mass, radius, rpm, driven, finalRatio, wheelbase: type.len * 0.64, track: type.wid * 0.84,
    gears: [3.95, 2.45, 1.75, 1.32, 1].map((v) => v * lastGear),
    torque: mass * (sport ? 0.38 : 0.153) * type.accel / (sport ? 10.5 : 6.2),
    brake: mass * (upgrades.brakes ? 1.18 : 1), grip: upgrades.tires ? 1.08 : 1,
    frequency: 1.65 - (type.ride ?? 0) * 2, height: type.h * 0.43,
  };
}

function buildConstraint(physics, body, spec) {
  const { Jolt } = physics;
  const settings = new Jolt.VehicleConstraintSettings();
  settings.mMaxPitchRollAngle = Math.PI;
  for (let i = 0; i < 4; i++) {
    const w = new Jolt.WheelSettingsWV();
    w.mPosition.Set((i % 2 ? -1 : 1) * spec.track / 2,
      spec.radius + 0.28 - spec.height, (i < 2 ? 1 : -1) * spec.wheelbase / 2);
    w.mRadius = spec.radius;
    w.mWidth = 0.21;
    w.mSuspensionMinLength = 0.1;
    w.mSuspensionMaxLength = 0.38;
    w.mSuspensionSpring.mFrequency = spec.frequency;
    w.mSuspensionSpring.mDamping = 0.65;
    w.mMaxSteerAngle = i < 2 ? 0.62 : 0;
    w.mMaxBrakeTorque = spec.brake * (i < 2 ? 1.4 : 0.94);
    w.mMaxHandBrakeTorque = i < 2 ? 0 : spec.mass * 2;
    settings.mWheels.push_back(w);
  }
  for (const first of [0, 2]) {
    const bar = new Jolt.VehicleAntiRollBar();
    bar.mLeftWheel = first;
    bar.mRightWheel = first + 1;
    bar.mStiffness = spec.mass * spec.frequency;
    settings.mAntiRollBars.push_back(bar);
    Jolt.destroy(bar);
  }
  const drive = new Jolt.WheeledVehicleControllerSettings();
  drive.mEngine.mAngularDamping = 0.035;
  drive.mEngine.mInertia = 0.28;
  drive.mTransmission.mSwitchTime = 0.22;
  drive.mTransmission.mClutchReleaseTime = 0.17;
  drive.mEngine.mMaxTorque = spec.torque;
  drive.mEngine.mMaxRPM = spec.rpm;
  drive.mEngine.mNormalizedTorque.Clear();
  for (const [rpm, torque] of [[0, 0.55], [0.35, 0.95], [0.68, 1], [1, 0.78]]) drive.mEngine.mNormalizedTorque.AddPoint(rpm, torque);
  drive.mTransmission.mGearRatios.clear();
  for (const gear of spec.gears) drive.mTransmission.mGearRatios.push_back(gear);
  drive.mTransmission.mShiftUpRPM = spec.rpm * 0.91;
  drive.mTransmission.mShiftDownRPM = spec.rpm * 0.34;
  drive.mTransmission.mClutchStrength = 12;
  drive.mDifferentials.clear();
  for (const first of spec.driven) {
    const diff = new Jolt.VehicleDifferentialSettings();
    diff.mLeftWheel = first;
    diff.mRightWheel = first + 1;
    diff.mEngineTorqueRatio = 1 / spec.driven.length;
    diff.mDifferentialRatio = spec.finalRatio;
    drive.mDifferentials.push_back(diff);
    Jolt.destroy(diff);
  }
  settings.mController = drive;
  const constraint = new Jolt.VehicleConstraint(body, settings);
  constraint.SetVehicleCollisionTester(new Jolt.VehicleCollisionTesterCastCylinder(layers.VEHICLE, 0.05));
  physics.system.AddConstraint(constraint);
  Jolt.destroy(settings);
  return constraint;
}

export class PlayerVehicle {
  constructor(physics, car) {
    const { Jolt, bodies } = physics;
    this.physics = physics;
    this.car = car;
    this.spec = vehicleSpec(car.type, car.upgrades);
    const s = this.spec;
    this.pos = new Jolt.RVec3(0, 0, 0);
    this.quat = new Jolt.Quat(0, 0, 0, 1);
    this.velocity = new Jolt.Vec3(0, 0, 0);
    const half = new Jolt.Vec3(car.type.wid * 0.46, car.type.h * 0.28, car.type.len * 0.48);
    const offset = new Jolt.Vec3(0, -car.type.h * 0.18, 0);
    const shape = new Jolt.OffsetCenterOfMassShapeSettings(offset, new Jolt.BoxShapeSettings(half));
    const result = shape.Create();
    const settings = new Jolt.BodyCreationSettings(result.Get(), this.pos, this.quat, Jolt.EMotionType_Dynamic, layers.VEHICLE);
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = s.mass;
    settings.mLinearDamping = 0.006;
    settings.mMotionQuality = Jolt.EMotionQuality_LinearCast;
    this.body = bodies.CreateBody(settings);
    bodies.AddBody(this.body.GetID(), Jolt.EActivation_Activate);
    result.Clear();
    for (const value of [settings, shape, offset, half]) Jolt.destroy(value);
    this.constraint = buildConstraint(physics, this.body, s);
    this.controller = Jolt.castObject(this.constraint.GetController(), Jolt.WheeledVehicleController);
    this.listener = new Jolt.VehicleConstraintStepListener(this.constraint);
    physics.system.AddStepListener(this.listener);
    this.wheels = Array.from({length: 4}, (_, i) => Jolt.castObject(this.constraint.GetWheel(i), Jolt.WheelWV));
    this.friction = 1;
    this.callbacks = new Jolt.VehicleConstraintCallbacksJS();
    this.callbacks.GetCombinedFriction = (_index, _direction, tireFriction) => tireFriction * this.friction;
    this.callbacks.OnPreStepCallback = () => {};
    this.callbacks.OnPostCollideCallback = () => {};
    this.callbacks.OnPostStepCallback = () => {};
    this.callbacks.SetVehicleConstraint(this.constraint);
    this.pose = new BodyPose(this.body);
    this.spawnFragment = (car, mesh, center) => physics.onCarFragment(car, mesh, center, this.pose, this.spec.height);
    this.euler = new Euler(0, 0, 0, 'YXZ');
    this.rotation = new Quaternion();
    this.impactPoint = new Vector3();
    this.impactNormal = new Vector3();
    this.surface = 1;
    this.surfaceTimer = 0;
    this.teleport();
  }

  teleport() {
    const { car, physics } = this;
    this.pos.Set(car.x, car.y + this.spec.height, car.z);
    const pitch = (car.gPitch || 0) + (car.mode === 'loose' ? car.pitch || 0 : 0);
    const roll = (car.gRoll || 0) + (car.mode === 'loose' ? car.roll || 0 : 0);
    const q = this.rotation.setFromEuler(this.euler.set(pitch, car.yaw, roll, 'YXZ'));
    this.quat.Set(q.x, q.y, q.z, q.w);
    this.velocity.Set(car.vx || 0, car.vy || 0, car.vz || 0);
    const id = this.body.GetID();
    physics.bodies.SetPositionAndRotation(id, this.pos, this.quat, physics.Jolt.EActivation_Activate);
    this.body.SetLinearVelocity(this.velocity);
    this.velocity.Set(0, 0, 0);
    this.body.SetAngularVelocity(this.velocity);
    for (const wheel of this.wheels) wheel.SetAngularVelocity(0);
    this.impactSpeed = 0;
    this.impactBody = null;
    this.pose.reset(this.body);
  }

  recordImpact(first, second, impulse, manifold) {
    const bodyID = this.body.GetID().GetIndexAndSequenceNumber();
    const a = first.GetID().GetIndexAndSequenceNumber(), b = second.GetID().GetIndexAndSequenceNumber();
    if (a !== bodyID && b !== bodyID) return;
    const speed = impulse / this.spec.mass;
    if (speed <= 3 || speed <= this.impactSpeed) return;
    this.impactSpeed = speed;
    this.impactBody = a === bodyID ? b : a;
    const points = a === bodyID ? manifold?.mRelativeContactPointsOn1 : manifold?.mRelativeContactPointsOn2;
    this.hasImpactPoint = !!points?.size();
    if (!this.hasImpactPoint) return;
    const origin = manifold.mBaseOffset, p = this.body.GetPosition(), q = this.body.GetRotation();
    const rotation = this.rotation.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW()).invert();
    // Střed kontaktní plochy omezuje náhodný výběr levého nebo pravého rohu.
    this.impactPoint.set(0, 0, 0);
    for (let i = 0; i < points.size(); i++) {
      const v = points.at(i);
      this.impactPoint.x += v.GetX();
      this.impactPoint.y += v.GetY();
      this.impactPoint.z += v.GetZ();
    }
    this.impactPoint.multiplyScalar(1 / points.size());
    this.impactPoint.x += origin.GetX() - p.GetX();
    this.impactPoint.y += origin.GetY() - p.GetY();
    this.impactPoint.z += origin.GetZ() - p.GetZ();
    this.impactPoint.applyQuaternion(rotation).y += this.spec.height;
    const n = manifold.mWorldSpaceNormal;
    this.impactNormal.set(n.GetX(), n.GetY(), n.GetZ()).applyQuaternion(rotation).multiplyScalar(a === bodyID ? -1 : 1);
  }

  applyImpact() {
    const speed = this.impactSpeed;
    if (speed <= 3) return 0;
    if (this.hasImpactPoint) dentCar(this.car, speed, this.impactPoint, this.impactNormal, this.physics.onCarFragment && this.spawnFragment);
    this.car.health = Math.max(0, this.car.health - (speed - 3) * 1.5);
    this.impactSpeed = 0;
    this.impactBody = null;
    return speed;
  }

  drive(dt, throttle, steer, handbrake, arcade, surface) {
    const { car, spec } = this;
    this.surfaceTimer -= dt;
    if (this.surfaceTimer <= 0) {
      this.surfaceTimer = 0.25;
      this.surface = surface(car.x, car.z);
    }
    this.friction = this.surface * (arcade ? 1.15 : 1) * spec.grip;
    const speed = car.speed;
    const braking = throttle * speed < 0 && Math.abs(speed) > 0.65;
    car.brakeLights = braking || handbrake;
    const slip = this.wheels.reduce((max, w) => w.HasContact() ? Math.max(max, Math.abs(w.mLongitudinalSlip)) : max, 0);
    const abs = arcade && Math.abs(speed) > 3 && slip > 0.18;
    const traction = arcade && Math.abs(speed) > 1 && slip > 0.22 ? 0.65 : 1;
    const limit = Math.min(1, 0.13 + 32 / (32 + speed * speed));
    car.steer += (Math.max(-1, Math.min(1, steer + steeringPull(car))) * limit - car.steer) * Math.min(1, dt * 8);
    this.controller.SetDriverInput(braking ? 0 : throttle * traction * enginePower(car),
      car.steer, braking ? (abs ? 0.68 : 1) : 0, handbrake ? 1 : 0);
    if (throttle || handbrake || steer) this.physics.bodies.ActivateBody(this.body.GetID());
    if (arcade && !handbrake && !steer && Math.abs(speed) > 4) {
      const omega = this.body.GetAngularVelocity();
      this.velocity.Set(omega.GetX(), omega.GetY() * Math.exp(-dt * 2), omega.GetZ());
      this.body.SetAngularVelocity(this.velocity);
    }
  }

  driveAI(input, dt, surface) {
    this.surfaceTimer -= dt;
    if (this.surfaceTimer <= 0) {
      this.surfaceTimer = 0.25;
      this.friction = surface(this.car.x, this.car.z) * this.spec.grip;
    }
    this.car.steer = Math.max(-1, Math.min(1, input.steer + steeringPull(this.car)));
    const c = this.car;
    c.brakeLights = input.brake > 0.05;
    const holding = input.brake === 1 && !input.throttle && Math.hypot(c.vx, c.vz) < 0.45 && Math.abs(c.vy) < 0.35;
    this.controller.SetDriverInput(input.throttle * enginePower(c), c.steer, input.brake, holding ? 1 : 0);
    if (input.throttle) this.physics.bodies.ActivateBody(this.body.GetID());
    // Na příčném svahu zabrzděné pneumatiky v klidu drží. Náraz nebo rozjezd
    // spící dynamické auto opět probudí stejně jako zaparkovaný vůz.
    if (holding && this.body.IsActive() && !this.touchedVehicle && Math.abs(c.roll) < 0.45 &&
        this.wheels.filter(wheel => wheel.HasContact()).length >= 3) this.physics.bodies.DeactivateBody(this.body.GetID());
  }

  read() {
    const { car } = this;
    this.pose.read(this.body);
    const { position: p, rotation: q } = this.pose;
    this.euler.setFromQuaternion(q, 'YXZ');
    car.x = p.x; car.y = p.y - this.spec.height; car.z = p.z;
    car.yaw = this.euler.y; car.pitch = this.euler.x; car.roll = this.euler.z;
    car.gPitch = 0; car.gRoll = 0;
    const v = this.body.GetLinearVelocity();
    car.vx = v.GetX(); car.vy = v.GetY(); car.vz = v.GetZ();
    car.speed = car.vx * Math.sin(car.yaw) + car.vz * Math.cos(car.yaw);
    car.air = this.wheels.every((w) => !w.HasContact());
    car.skid = Math.min(1, Math.max(...this.wheels.map((w) => w.HasContact() ? Math.abs(w.mLateralSlip) : 0)));
    car.rpm = this.controller.GetEngine().GetCurrentRPM();
    car.gear = this.controller.GetTransmission().GetCurrentGear();
  }

  render(alpha) {
    const { mesh } = this.car;
    this.pose.interpolate(alpha, mesh.position, mesh.quaternion);
    mesh.translateY(-this.spec.height);
  }

  dispose() {
    const { Jolt, bodies, system } = this.physics;
    system.RemoveStepListener(this.listener);
    Jolt.destroy(this.listener);
    system.RemoveConstraint(this.constraint);
    Jolt.destroy(this.callbacks);
    const id = this.body.GetID();
    bodies.RemoveBody(id);
    bodies.DestroyBody(id);
    for (const value of [this.pos, this.quat, this.velocity]) Jolt.destroy(value);
    delete this.car.rpm;
  }
}
