export const GOLF_HOLES = [
  {
    x: -1587.8, z: 3612.5, yaw: Math.PI / 2,
    halfWidth: 1.1, start: -0.9, end: 7.5, cupX: 0, cupZ: 5.8, obstacles: [],
    hint: 'Zamiř, nastav sílu a zahraj.',
  },
  {
    x: -1587.8, z: 3616.9, yaw: Math.PI / 2,
    halfWidth: 1.15, start: -0.9, end: 7.5, cupX: 0.6, cupZ: 5.1,
    entry: { x: -1590.7, z: 3616.9 },
    obstacles: [{ x: -0.35, z: 2.7, width: 1.54, length: 0.4, height: 0.21 }],
    hint: 'Zkus odraz od levého mantinelu.',
  },
  {
    x: -1587.8, z: 3621.5, yaw: Math.PI / 2,
    halfWidth: 1.28, start: -0.9, end: 8.6, cupX: 0.10, cupZ: 6.55,
    entry: { x: -1590.7, z: 3621.5 },
    obstacles: [
      { x: 0, z: 3.1, width: 1.12, length: 1.6, height: 0.23 },
      { x: -0.96, z: 5.15, width: 0.62, length: 0.65, height: 0.18 },
    ],
    hint: 'Kolem ostrůvku vedou dvě cesty. Odboč k jamce, až ho mineš.',
  },
];

export const MINIGOLF_RADIUS = 0.067;
export const CUP_RADIUS = 0.17;
export const STROKE_LIMIT = 7;
export const RAIL_HEIGHT = 0.19;
export const RAIL_WIDTH = 0.09;

export function golfWorldPoint(hole, x, z) {
  const c = Math.cos(hole.yaw), s = Math.sin(hole.yaw);
  return { x: hole.x + x * c + z * s, z: hole.z - x * s + z * c };
}

export function golfBallResult(hole, x, y, z, speed) {
  if (y < -0.15 || Math.abs(x) > hole.halfWidth + MINIGOLF_RADIUS ||
    z < hole.start - MINIGOLF_RADIUS || z > hole.end + MINIGOLF_RADIUS) return 'out';
  if (Math.abs(y - MINIGOLF_RADIUS) < 0.045 && speed <= 1.05 &&
    Math.hypot(x - hole.cupX, z - hole.cupZ) <= CUP_RADIUS - 0.025) return 'holed';
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


export class GolfRound {
  scores = [];

  get total() { return this.scores.reduce((total, strokes) => total + strokes, 0); }

  get complete() { return this.scores.length === GOLF_HOLES.length; }

  recordCandidate(previous) {
    if (!this.complete) return null;
    const total = this.total;
    return previous === undefined || total < previous ? total : null;
  }

  finishHole(index, score) {
    if (this.complete || index !== this.scores.length || (score.phase !== 'holed' && score.phase !== 'limit')) return false;
    this.scores.push(score.strokes);
    return true;
  }
}

export function validGolfRecord(strokes) {
  return Number.isInteger(strokes) && strokes >= GOLF_HOLES.length &&
    strokes <= GOLF_HOLES.length * STROKE_LIMIT;
}
