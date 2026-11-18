import { Quaternion, Vector3 } from 'three/webgpu';

export const STEP_SECONDS = 1 / 60;
const MAX_STEPS = 4;

export class FixedStep {
  constructor() {
    this.remainder = 0;
    this.alpha = 0;
  }

  advance(elapsed, step) {
    if (!Number.isFinite(elapsed) || elapsed < 0) return;
    this.remainder += elapsed;
    const available = Math.floor(this.remainder / STEP_SECONDS + 1e-10);
    this.remainder = Math.max(0, this.remainder - available * STEP_SECONDS);
    for (let i = 0; i < Math.min(MAX_STEPS, available); i++) step(STEP_SECONDS);
    this.alpha = this.remainder / STEP_SECONDS;
  }
}

export class BodyPose {
  constructor(body) {
    this.position = new Vector3();
    this.rotation = new Quaternion();
    this.previousPosition = new Vector3();
    this.previousRotation = new Quaternion();
    this.reset(body);
  }

  reset(body) {
    this.read(body);
    this.previousPosition.copy(this.position);
    this.previousRotation.copy(this.rotation);
  }

  read(body) {
    this.previousPosition.copy(this.position);
    this.previousRotation.copy(this.rotation);
    const pos = body.GetPosition(), rot = body.GetRotation();
    this.position.set(pos.GetX(), pos.GetY(), pos.GetZ());
    this.rotation.set(rot.GetX(), rot.GetY(), rot.GetZ(), rot.GetW());
  }

  interpolate(alpha, position, rotation) {
    position.lerpVectors(this.previousPosition, this.position, alpha);
    rotation.slerpQuaternions(this.previousRotation, this.rotation, alpha);
  }
}
