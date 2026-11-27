import { PhysicsWorld, layers } from './world.js';

export const HALF_WIDTH = .57, HALF_LENGTH = 1.14, BALL_RADIUS = .029;
export const POCKET_RADIUS = .073;
export const POCKETS = [-HALF_WIDTH, HALF_WIDTH].flatMap(x => [-HALF_LENGTH, 0, HALF_LENGTH].map(z => ({ x, z })));
export const BALL_STARTS = [[-.28, 0], [.16, 0], [-.16, .65], [.22, -.55]];
const GAP = .081, RAIL = .038;
export const CUSHIONS = [];
for (const side of [-1, 1]) {
  CUSHIONS.push({ x: 0, z: side * (HALF_LENGTH + RAIL), hx: HALF_WIDTH - GAP, hz: RAIL });
  for (const half of [-1, 1]) CUSHIONS.push({
    x: side * (HALF_WIDTH + RAIL), z: half * HALF_LENGTH / 2, hx: RAIL, hz: HALF_LENGTH / 2 - GAP,
  });
}

export class PoolTable {
  constructor(Jolt) {
    this.world = new PhysicsWorld(Jolt, 32);
    // Výchozí práh Jolt 1 m/s by pohltil pomalé odrazy od mantinelu.
    const settings = this.world.system.GetPhysicsSettings();
    settings.mMinVelocityForRestitution = .06;
    this.world.system.SetPhysicsSettings(settings);
    this.position = new Jolt.RVec3();
    this.rotation = new Jolt.Quat(0, 0, 0, 1);
    this.velocity = new Jolt.Vec3();
    this.rails = CUSHIONS.map(({ x, z, hx, hz }) => {
      this.velocity.Set(hx, .05, hz);
      return this.body(new Jolt.BoxShape(this.velocity, .005), x, z, false);
    });
    this.balls = BALL_STARTS.map(([x, z]) => this.body(new Jolt.SphereShape(BALL_RADIUS), x, z, true));
    this.world.step = dt => this.step(dt);
    this.reset();
  }

  body(shape, x, z, movable) {
    const { Jolt, bodies } = this.world;
    this.position.Set(x, 0, z);
    const spec = new Jolt.BodyCreationSettings(shape, this.position, this.rotation,
      movable ? Jolt.EMotionType_Dynamic : Jolt.EMotionType_Static, movable ? layers.DEBRIS : layers.STATIC);
    spec.mRestitution = movable ? .9 : .78;
    spec.mFriction = 0;
    if (movable) {
      spec.mAllowedDOFs = Jolt.EAllowedDOFs_TranslationX | Jolt.EAllowedDOFs_TranslationZ;
      spec.mGravityFactor = spec.mLinearDamping = 0;
      spec.mMotionQuality = Jolt.EMotionQuality_LinearCast;
    }
    const body = bodies.CreateBody(spec);
    Jolt.destroy(spec);
    bodies.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    return body;
  }

  place(body, x, z) {
    const { Jolt, bodies } = this.world, id = body.GetID();
    if (!bodies.IsAdded(id)) bodies.AddBody(id, Jolt.EActivation_DontActivate);
    this.position.Set(x, 0, z);
    bodies.SetPositionAndRotation(id, this.position, this.rotation, Jolt.EActivation_DontActivate);
    this.velocity.Set(0, 0, 0);
    body.SetLinearVelocity(this.velocity);
    bodies.DeactivateBody(id);
  }

  reset() {
    this.potted = 0;
    this.rolling = this.scratch = false;
    this.balls.forEach((ball, i) => this.place(ball, ...BALL_STARTS[i]));
  }

  launch(degrees, power) {
    if (this.rolling || this.complete || !Number.isFinite(degrees) || !Number.isFinite(power)) return false;
    const angle = degrees * Math.PI / 180, speed = .6 + 1.8 * Math.max(0, Math.min(1, power));
    this.velocity.Set(speed * Math.cos(angle), 0, speed * Math.sin(angle));
    this.world.bodies.ActivateBody(this.balls[0].GetID());
    this.balls[0].SetLinearVelocity(this.velocity);
    this.rolling = true;
    this.scratch = false;
    return true;
  }

  get complete() { return this.potted === this.balls.length - 1; }

  step(dt) {
    if (!this.rolling) return;
    this.world.engine.Step(dt, 1);
    const { bodies } = this.world;
    this.rolling = false;
    for (const [i, ball] of this.balls.entries()) {
      const id = ball.GetID();
      if (!bodies.IsAdded(id)) continue;
      const p = ball.GetPosition(), x = p.GetX(), z = p.GetZ();
      if (POCKETS.some(hole => Math.hypot(x - hole.x, z - hole.z) < POCKET_RADIUS)
          || Math.abs(x) > HALF_WIDTH + RAIL || Math.abs(z) > HALF_LENGTH + RAIL) {
        bodies.RemoveBody(id);
        if (i === 0) this.scratch = true;
        else this.potted++;
        continue;
      }
      const v = ball.GetLinearVelocity(), speed = Math.hypot(v.GetX(), v.GetZ());
      if (!speed) continue;
      const ratio = Math.max(0, 1 - .58 * dt / speed);
      this.velocity.Set(v.GetX() * ratio, 0, v.GetZ() * ratio);
      ball.SetLinearVelocity(this.velocity);
      if (ratio) this.rolling = true;
    }
    if (!this.rolling && this.scratch) {
      // Čtyři místa v rozestupu přes dva průměry nemohou obsadit tři barevné koule.
      const x = BALL_STARTS[0][0];
      const z = [0, -.18, .18, -.36].find(z => this.balls.slice(1).every(ball => {
        const p = ball.GetPosition();
        return !bodies.IsAdded(ball.GetID()) || Math.hypot(p.GetX() - x, p.GetZ() - z) > 2 * BALL_RADIUS;
      }));
      this.place(this.balls[0], x, z);
    }
  }

  dispose() {
    const { bodies, Jolt } = this.world;
    for (const body of [...this.balls, ...this.rails]) {
      const id = body.GetID();
      if (bodies.IsAdded(id)) bodies.RemoveBody(id);
      bodies.DestroyBody(id);
    }
    for (const value of [this.position, this.rotation, this.velocity]) Jolt.destroy(value);
    this.world.dispose();
  }
}
