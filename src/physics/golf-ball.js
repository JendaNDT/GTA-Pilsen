import { GolfScore, MINIGOLF_RADIUS, RAIL_HEIGHT, RAIL_WIDTH, golfBallResult } from '../game/minigolf-rules.js';
import { layers } from './world.js';


export class GolfBall {
  constructor(physics, hole, surface) {
    this.physics = physics;
    this.hole = hole;
    this.surface = surface;
    this.cos = Math.cos(hole.yaw);
    this.sin = Math.sin(hole.yaw);
    this.score = new GolfScore();
    this.x = this.z = this.lastX = this.lastZ = 0;
    this.y = MINIGOLF_RADIUS;
    this.restTime = 0;
    const { Jolt } = physics;
    this.position = new Jolt.RVec3(0, 0, 0);
    this.rotation = new Jolt.Quat(0, Math.sin(hole.yaw / 2), 0, Math.cos(hole.yaw / 2));
    this.vector = new Jolt.Vec3(0, 0, 0);

    const center = (hole.start + hole.end) / 2;
    const halfLength = (hole.end - hole.start) / 2;
    this.lane = [this.box(0, -0.15, center, hole.halfWidth + RAIL_WIDTH, 0.15, halfLength)];
    for (const side of [-1, 1]) {
      this.lane.push(this.box(side * (hole.halfWidth + RAIL_WIDTH / 2), RAIL_HEIGHT / 2, center,
        RAIL_WIDTH / 2, RAIL_HEIGHT / 2, halfLength));
    }
    this.ball = this.create(new Jolt.SphereShape(MINIGOLF_RADIUS), 0, MINIGOLF_RADIUS, 0, true);
    this.park(0, 0);
  }

  locate(x, y, z) {
    this.position.Set(this.hole.x + x * this.cos + z * this.sin, this.surface + y,
      this.hole.z - x * this.sin + z * this.cos);
  }

  box(x, y, z, halfX, halfY, halfZ) {
    this.vector.Set(halfX, halfY, halfZ);
    return this.create(new this.physics.Jolt.BoxShape(this.vector, 0.01), x, y, z, false);
  }

  create(shape, x, y, z, moving) {
    const { bodies, Jolt } = this.physics;
    this.locate(x, y, z);
    const motion = moving ? Jolt.EMotionType_Dynamic : Jolt.EMotionType_Static;
    const layer = moving ? layers.GOLF_BALL : layers.GOLF_LANE;
    const settings = new Jolt.BodyCreationSettings(shape, this.position, this.rotation, motion, layer);
    settings.mFriction = 0.22;
    settings.mRestitution = moving ? 0.4 : 0.55;
    if (moving) {
      settings.mMotionQuality = Jolt.EMotionQuality_LinearCast;
      settings.mLinearDamping = 0.08;
      settings.mAngularDamping = 0.12;
      settings.mAllowSleeping = false;
    }
    const body = bodies.CreateBody(settings);
    Jolt.destroy(settings);
    bodies.AddBody(body.GetID(), moving ? Jolt.EActivation_Activate : Jolt.EActivation_DontActivate);
    return body;
  }

  park(x, z) {
    this.x = x;
    this.y = MINIGOLF_RADIUS;
    this.z = z;
    this.locate(x, this.y, z);
    const { bodies, Jolt } = this.physics;
    bodies.SetPositionAndRotation(this.ball.GetID(), this.position, this.rotation, Jolt.EActivation_DontActivate);
    this.vector.Set(0, 0, 0);
    this.ball.SetLinearVelocity(this.vector);
    this.ball.SetAngularVelocity(this.vector);
    bodies.DeactivateBody(this.ball.GetID());
  }

  restart() {
    this.score = new GolfScore();
    this.park(0, 0);
  }

  strike(angle, power) {
    if (!Number.isFinite(angle) || !Number.isFinite(power) || !this.score.strike()) return false;
    this.lastX = this.x;
    this.lastZ = this.z;
    this.restTime = 0;
    const speed = 0.75 + 6.3 * Math.max(0, Math.min(1, power));
    const shot = this.hole.yaw - angle;
    const vx = Math.sin(shot) * speed, vz = Math.cos(shot) * speed;
    this.vector.Set(vx, 0, vz);
    this.ball.SetLinearVelocity(this.vector);
    this.vector.Set(vz / MINIGOLF_RADIUS, 0, -vx / MINIGOLF_RADIUS);
    this.ball.SetAngularVelocity(this.vector);
    this.physics.bodies.ActivateBody(this.ball.GetID());
    return true;
  }

  step(dt) {
    if (this.score.phase !== 'rolling') return;
    const p = this.ball.GetPosition();
    const dx = p.GetX() - this.hole.x, dz = p.GetZ() - this.hole.z;
    this.x = dx * this.cos - dz * this.sin;
    this.y = p.GetY() - this.surface;
    this.z = dx * this.sin + dz * this.cos;
    const v = this.ball.GetLinearVelocity();
    const vx = v.GetX(), vy = v.GetY(), vz = v.GetZ();
    const speed = Math.hypot(vx, vz);
    const result = golfBallResult(this.hole, this.x, this.y, this.z, Math.hypot(speed, vy));
    if (result) {
      this.score.settle(result);
      if (result === 'out') this.park(this.lastX, this.lastZ);
      else this.park(0, this.hole.cup);
      return;
    }
    const grounded = Math.abs(this.y - MINIGOLF_RADIUS) < 0.045 && Math.abs(vy) < 0.12;
    this.restTime = grounded && speed < 0.075 ? this.restTime + dt : 0;
    if (this.restTime >= 0.12) {
      this.score.settle('stopped');
      this.park(this.x, this.z);
    } else if (grounded && speed > 0) {
      const rolling = Math.max(0, 1 - 1.35 * dt / speed);
      this.vector.Set(vx * rolling, vy, vz * rolling);
      this.ball.SetLinearVelocity(this.vector);
      const spin = this.ball.GetAngularVelocity();
      this.vector.Set(spin.GetX() * rolling, spin.GetY() * rolling, spin.GetZ() * rolling);
      this.ball.SetAngularVelocity(this.vector);
    }
  }

  dispose() {
    const { bodies, Jolt } = this.physics;
    for (const body of [this.ball, ...this.lane]) {
      const id = body.GetID();
      bodies.RemoveBody(id);
      bodies.DestroyBody(id);
    }
    for (const value of [this.position, this.rotation, this.vector]) Jolt.destroy(value);
  }
}
