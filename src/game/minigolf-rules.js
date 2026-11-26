export const FIRST_HOLE = Object.freeze({
  x: -1587.8, z: 3612.5, yaw: Math.PI / 2,
  halfWidth: 1.1, start: -0.9, end: 7.5, cup: 5.8,
});

export const MINIGOLF_RADIUS = 0.067;
export const CUP_RADIUS = 0.17;
export const STROKE_LIMIT = 7;

export function golfWorldPoint(hole, x, z) {
  const c = Math.cos(hole.yaw), s = Math.sin(hole.yaw);
  return { x: hole.x + x * c + z * s, z: hole.z - x * s + z * c };
}

export function golfBallResult(hole, x, y, z, speed) {
  if (y < -0.15 || Math.abs(x) > hole.halfWidth + MINIGOLF_RADIUS ||
    z < hole.start - MINIGOLF_RADIUS || z > hole.end + MINIGOLF_RADIUS) return 'out';
  if (Math.abs(y - MINIGOLF_RADIUS) < 0.045 && speed <= 1.05 &&
    Math.hypot(x, z - hole.cup) <= CUP_RADIUS - 0.025) return 'holed';
  return null;
}

export class GolfScore {
  strokes = 0;
  phase = 'aim';
  lastResult = null;

  strike() {
    if (this.phase !== 'aim') return false;
    this.strokes++;
    this.phase = 'rolling';
    this.lastResult = null;
    return true;
  }

  settle(result) {
    if (this.phase !== 'rolling') return;
    this.lastResult = result;
    if (result === 'out') this.strokes = Math.min(STROKE_LIMIT, this.strokes + 1);
    this.phase = result === 'holed' ? 'holed' : this.strokes === STROKE_LIMIT ? 'limit' : 'aim';
  }
}
