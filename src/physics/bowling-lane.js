import { PhysicsWorld, layers } from './world.js';

export const LANE_HALF = .531;
export const PIN_LINE = 18.288;
export const LANE_END = 20.9;
export const BALL_RADIUS = .108;
export const PIN_HEIGHT = .38;
export const AIM_LIMIT = 35;
export const PIN_PROFILE = [
  [.028, 0], [.034, .029], [.050, .068], [.060, .117], [.054, .159],
  [.039, .214], [.024, .26], [.028, .296], [.035, .33], [.028, .362], [.013, .378], [0, PIN_HEIGHT],
];
const PIN_POINTS = Array.from({ length: 4 }, (_, row) => Array.from({ length: row + 1 }, (_pin, i) =>
  [(i - row / 2) * .305, PIN_LINE + row * .264])).flat();

export class BowlingLane {
  constructor(Jolt) {
    this.world = new PhysicsWorld(Jolt, 32);
    this.position = new Jolt.RVec3();
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
    this.vector = new Jolt.Vec3();
    this.fixed = [
      this.box(0, -.12, (LANE_END - 2) / 2, LANE_HALF, .12, (LANE_END + 2) / 2),
      this.box(0, .32, LANE_END, .84, .34, .11),
    ];
    for (const side of [-1, 1]) {
      this.fixed.push(this.box(side * (LANE_HALF + .13), -.26, LANE_END / 2, .13, .11, LANE_END / 2));
      this.fixed.push(this.box(side * (LANE_HALF + .29), -.02, LANE_END / 2, .025, .15, LANE_END / 2));
    }
    this.ball = this.body(new Jolt.SphereShape(BALL_RADIUS), 0, BALL_RADIUS + .007, 0, 6.75, true);
    const hull = new Jolt.ConvexHullShapeSettings();
    hull.mMaxConvexRadius = .003;
    hull.mHullTolerance = .0001;
    for (const [radius, y] of PIN_PROFILE) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.PI * i / 4;
        this.vector.Set(radius * Math.cos(angle), y, radius * Math.sin(angle));
        hull.mPoints.push_back(this.vector);
      }
    }
    const shape = hull.Create();
    try {
      if (shape.HasError()) throw new Error('Nepodařilo se vytvořit tvar kuželky.');
      this.pins = PIN_POINTS.map(([x, z]) => ({ x, z, standing: true, body: this.body(shape.Get(), x, .004, z, 1.55) }));
    } finally {
      shape.Clear();
      Jolt.destroy(hull);
    }
    this.rolling = false;
    this.world.step = dt => this.step(dt);
  }

  box(x, y, z, hx, hy, hz) {
    this.vector.Set(hx, hy, hz);
    return this.body(new this.world.Jolt.BoxShape(this.vector, .008), x, y, z);
  }

  body(shape, x, y, z, mass = 0, ball = false) {
    const { Jolt, bodies } = this.world;
    this.position.Set(x, y, z);
    const spec = new Jolt.BodyCreationSettings(shape, this.position, this.rotation,
      mass ? Jolt.EMotionType_Dynamic : Jolt.EMotionType_Static, mass ? layers.DEBRIS : layers.STATIC);
    spec.mFriction = ball ? .18 : .34;
    spec.mRestitution = ball ? .13 : .24;
    if (mass) {
      spec.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      spec.mMassPropertiesOverride.mMass = mass;
      spec.mAngularDamping = ball ? .075 : .19;
      spec.mLinearDamping = ball ? .055 : .09;
      if (ball) spec.mMotionQuality = Jolt.EMotionQuality_LinearCast;
    }
    const body = bodies.CreateBody(spec);
    Jolt.destroy(spec);
    bodies.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    return body;
  }

  park(body, x, y, z) {
    const { Jolt, bodies } = this.world;
    const id = body.GetID();
    this.position.Set(x, y, z);
    bodies.SetPositionAndRotation(id, this.position, this.rotation, Jolt.EActivation_DontActivate);
    this.vector.Set(0, 0, 0);
    body.SetLinearVelocity(this.vector);
    body.SetAngularVelocity(this.vector);
    bodies.DeactivateBody(id);
  }

  prepare(newRack) {
    const { Jolt, bodies } = this.world;
    this.park(this.ball, 0, BALL_RADIUS + .007, 0);
    for (const pin of this.pins) {
      const id = pin.body.GetID();
      if (newRack) {
        if (!bodies.IsAdded(id)) bodies.AddBody(id, Jolt.EActivation_DontActivate);
        pin.standing = true;
        this.park(pin.body, pin.x, .004, pin.z);
      } else if (!pin.standing) {
        if (bodies.IsAdded(id)) bodies.RemoveBody(id);
      } else {
        const pos = pin.body.GetPosition();
        this.park(pin.body, pos.GetX(), .004, pos.GetZ());
      }
    }
  }

  launch(aim, power) {
    if (this.rolling || !Number.isFinite(aim) || !Number.isFinite(power)) return false;
    const speed = 4.2 + 5.4 * Math.max(0, Math.min(power, 1));
    const angle = Math.max(-AIM_LIMIT, Math.min(aim, AIM_LIMIT)) * Math.PI / 1800;
    const vx = -Math.sin(angle) * speed, vz = Math.cos(angle) * speed;
    this.vector.Set(vx, 0, vz);
    this.ball.SetLinearVelocity(this.vector);
    this.vector.Set(vz / BALL_RADIUS, 0, -vx / BALL_RADIUS);
    this.ball.SetAngularVelocity(this.vector);
    this.world.bodies.ActivateBody(this.ball.GetID());
    this.rolling = true;
    this.gutter = false;
    this.elapsed = this.settled = 0;
    this.result = null;
    return true;
  }

  step(dt) {
    if (!this.rolling) return;
    this.world.engine.Step(dt, 1);
    this.elapsed += dt;
    const pos = this.ball.GetPosition();
    const z = pos.GetZ(), y = pos.GetY();
    if (z < PIN_LINE - .3 && y < BALL_RADIUS - .065 && Math.abs(pos.GetX()) > LANE_HALF) this.gutter = true;
    if (this.settled || z >= PIN_LINE + .95 || y < -.65 || this.elapsed > 4.7) this.settled += dt;
    if (this.settled < 1.7) return;
    let knocked = 0;
    for (const pin of this.pins) {
      if (!pin.standing) continue;
      const q = pin.body.GetRotation(), p = pin.body.GetPosition();
      const up = 1 - 2 * (q.GetX() ** 2 + q.GetZ() ** 2);
      if (up < .62 || Math.abs(p.GetX()) > LANE_HALF + .025 || p.GetY() < -.045 || p.GetZ() > LANE_END - .2) {
        pin.standing = false;
        knocked++;
      }
    }
    this.rolling = false;
    this.result = { knocked, gutter: this.gutter };
  }

  dispose() {
    const { Jolt, bodies } = this.world;
    for (const body of [...this.fixed, this.ball, ...this.pins.map(pin => pin.body)]) {
      const id = body.GetID();
      if (bodies.IsAdded(id)) bodies.RemoveBody(id);
      bodies.DestroyBody(id);
    }
    for (const scratch of [this.position, this.rotation, this.vector]) Jolt.destroy(scratch);
    this.world.dispose();
  }
}
