import { FixedStep } from './step.js';

export const layers = Object.freeze({
  STATIC: 0, VEHICLE: 1, CHARACTER: 2, RAILING: 3,
  BREAKABLE: 4, DEBRIS: 5, TRANSIT: 6, SENSOR: 7, FOOT_RAIL: 8,
  GOLF_LANE: 9, GOLF_BALL: 10,
});

const { STATIC, VEHICLE, CHARACTER, RAILING, BREAKABLE, DEBRIS, TRANSIT, SENSOR, FOOT_RAIL, GOLF_LANE, GOLF_BALL } = layers;
const partners = [
  [STATIC, VEHICLE, CHARACTER, DEBRIS],
  [VEHICLE, VEHICLE, CHARACTER, RAILING, BREAKABLE, DEBRIS, TRANSIT, SENSOR],
  [CHARACTER, RAILING, BREAKABLE, DEBRIS, TRANSIT, SENSOR, FOOT_RAIL],
  [DEBRIS, DEBRIS, TRANSIT],
  [GOLF_LANE, GOLF_BALL],
];

export class PhysicsWorld {
  constructor(Jolt) {
    this.Jolt = Jolt;
    this.clock = new FixedStep();
    this.step = (dt) => this.engine.Step(dt, 1);
    const count = Object.keys(layers).length;
    const pairs = new Jolt.ObjectLayerPairFilterTable(count);
    for (const [layer, ...others] of partners) {
      for (const other of others) pairs.EnableCollision(layer, other);
    }
    const broad = new Jolt.BroadPhaseLayerInterfaceTable(count, 2);
    const stationary = new Jolt.BroadPhaseLayer(0);
    const moving = new Jolt.BroadPhaseLayer(1);
    for (const layer of Object.values(layers)) {
      broad.MapObjectToBroadPhaseLayer(layer,
        [STATIC, RAILING, BREAKABLE, SENSOR, FOOT_RAIL, GOLF_LANE].includes(layer) ? stationary : moving);
    }
    Jolt.destroy(stationary);
    Jolt.destroy(moving);
    const settings = new Jolt.JoltSettings();
    settings.mMaxWorkerThreads = 0;
    settings.mObjectLayerPairFilter = pairs;
    settings.mBroadPhaseLayerInterface = broad;
    settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(broad, 2, pairs, count);
    this.engine = new Jolt.JoltInterface(settings);
    Jolt.destroy(settings);
    this.system = this.engine.GetPhysicsSystem();
    this.bodies = this.system.GetBodyInterface();
    const gravity = new Jolt.Vec3(0, -9.81, 0);
    this.system.SetGravity(gravity);
    Jolt.destroy(gravity);

    this.listener = new Jolt.ContactListenerJS();
    this.listener.OnContactValidate = () => Jolt.ValidateResult_AcceptAllContactsForThisBodyPair;

    this.listener.OnContactRemoved = () => {};
    const contactEvent = (a, b, contact, settings, added) => {
      const first = Jolt.wrapPointer(a, Jolt.Body);
      const second = Jolt.wrapPointer(b, Jolt.Body);
      const la = first.GetObjectLayer(), lb = second.GetObjectLayer();
      if (la === GOLF_BALL || lb === GOLF_BALL) return;
      if ((la === CHARACTER && lb === VEHICLE) || (lb === CHARACTER && la === VEHICLE)) {
        this.onPedContact?.(la === CHARACTER ? first : second, la === VEHICLE ? first : second);
        return;
      }
      if ((la === VEHICLE || la === TRANSIT) && (lb === VEHICLE || lb === TRANSIT)) {
        this.onVehicleContact?.(first, second);
      }
      if (!added && this.onMetalScrape && la === VEHICLE && lb === VEHICLE) {
        const manifold = Jolt.wrapPointer(contact, Jolt.ContactManifold);
        const n = manifold.mWorldSpaceNormal, v = first.GetLinearVelocity(), w = second.GetLinearVelocity();
        const dx = v.GetX() - w.GetX(), dy = v.GetY() - w.GetY(), dz = v.GetZ() - w.GetZ();
        const along = dx * n.GetX() + dy * n.GetY() + dz * n.GetZ();
        if (dx * dx + dy * dy + dz * dz - along * along > 16 && !manifold.mRelativeContactPointsOn1.empty()) {
          const base = manifold.mBaseOffset, point = manifold.mRelativeContactPointsOn1.at(0);
          this.onMetalScrape(base.GetX() + point.GetX(), base.GetY() + point.GetY(), base.GetZ() + point.GetZ());
        }
      }
      if (!added || !this.onImpact) return;
      const inverseMass = (first.IsDynamic() ? first.GetMotionProperties().GetInverseMass() : 0)
        + (second.IsDynamic() ? second.GetMotionProperties().GetInverseMass() : 0);
      if (!inverseMass) return;
      const manifold = Jolt.wrapPointer(contact, Jolt.ContactManifold);
      const normal = manifold.mWorldSpaceNormal;
      const approach = first.GetLinearVelocity().Dot(normal) - second.GetLinearVelocity().Dot(normal);
      if (approach <= 0) return;
      const impulse = approach / inverseMass;
      if ((la === RAILING && lb === VEHICLE) || (lb === RAILING && la === VEHICLE)) {
        const railFirst = la === RAILING;
        const broken = this.onRailingHit?.(railFirst ? first : second, railFirst ? second : first,
          railFirst ? manifold.mSubShapeID1 : manifold.mSubShapeID2, impulse);
        if (broken) Jolt.wrapPointer(settings, Jolt.ContactSettings).mIsSensor = true;
      }
      this.onImpact(first, second, impulse, manifold);
    };
    this.listener.OnContactAdded = (a, b, contact, settings) => contactEvent(a, b, contact, settings, true);
    this.listener.OnContactPersisted = (a, b, contact, settings) => {
      if (this.onPedContact || this.onVehicleContact || this.onMetalScrape) contactEvent(a, b, contact, settings, false);
    };
    this.system.SetContactListener(this.listener);
  }

  update(elapsed) {
    this.clock.advance(elapsed, this.step);
  }

  dispose() {
    this.Jolt.destroy(this.engine);
    this.Jolt.destroy(this.listener);
  }
}
