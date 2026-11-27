import { ballGroup } from './eight-ball.js';
import { BALL_RADIUS, HALF_LENGTH, HALF_WIDTH, POCKET_RADIUS, POCKETS } from '../physics/pool-table.js';

const diameter = 2 * BALL_RADIUS;
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const inside = p => Math.abs(p.x) <= HALF_WIDTH - BALL_RADIUS && Math.abs(p.z) <= HALF_LENGTH - BALL_RADIUS;

function clearPath(a, b, balls, target) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const length2 = dx * dx + dz * dz;
  if (!length2) return false;
  return balls.every(ball => {
    if (!ball.number || ball === target) return true;
    const t = Math.max(0, Math.min(1, ((ball.x - a.x) * dx + (ball.z - a.z) * dz) / length2));
    return Math.hypot(a.x + t * dx - ball.x, a.z + t * dz - ball.z) > diameter + .001;
  });
}

function stroke(from, aim, power, placement) {
  return { degrees: Math.atan2(aim.z - from.z, aim.x - from.x) * 180 / Math.PI, power, placement };
}

// Bod na mantinelu získáme zrcadlením cíle přes dráhu středu bílé.
function cushionPoint(white, target, axis, edge) {
  const along = axis === 'x' ? 'z' : 'x';
  const t = (edge - white[axis]) / (2 * edge - target[axis] - white[axis]);
  if (!(t > 0 && t < 1)) return null;
  const point = { [axis]: edge, [along]: white[along] + t * (target[along] - white[along]) };
  return POCKETS.some(h => distance(point, h) < .105) ? null : point;
}

export function choosePoolShot(balls, match) {
  const white = balls[0];
  if (match.breakShot) return stroke(white, { x: 0, z: .45 }, 1);
  const group = match.groups[match.player];
  const targets = balls.filter(b => {
    if (!b.number) return false;
    if (group && !match.remaining[group]) return b.number === 8;
    return b.number !== 8 && (!group || ballGroup(b.number) === group);
  });
  let best, bestCost = Infinity;
  for (const target of targets) {
    for (const pocket of POCKETS) {
      const travel = distance(target, pocket);
      if (!travel || !clearPath(target, pocket, balls, target)) continue;
      const dx = (pocket.x - target.x) / travel, dz = (pocket.z - target.z) / travel;
      const contact = { x: target.x - diameter * dx, z: target.z - diameter * dz };
      if (!inside(contact)) continue;
      const starts = [white];
      if (match.inHand) {
        for (const offset of [.16, .32]) {
          const spot = { x: contact.x - offset * dx, z: contact.z - offset * dz };
          if (inside(spot) && POCKETS.every(h => distance(spot, h) > POCKET_RADIUS) &&
              balls.every(b => !b.number || distance(spot, b) > diameter + .001)) starts.push(spot);
        }
      }
      for (const from of starts) {
        const approach = distance(from, contact);
        if (approach < .005 || !clearPath(from, contact, balls, target)) continue;
        const cosine = ((contact.x - from.x) * dx + (contact.z - from.z) * dz) / approach;
        if (cosine < .28) continue;
        // Stejné zpomalování na sukně jako v simulaci, s rezervou pro přenos při srážce.
        const speed = Math.sqrt(1.16 * (approach + (travel + .12) / (.90 * cosine) ** 2));
        const cost = speed + .45 * (1 - cosine);
        if (cost >= bestCost) continue;
        bestCost = cost;
        best = stroke(from, contact, Math.max(.12, Math.min(1, (speed - .6) / 1.8)), from !== white ? from : undefined);
      }
    }
  }
  if (best) return best;
  const ordered = targets.sort((a, b) => distance(white, a) - distance(white, b));
  for (const target of ordered) {
    if (clearPath(white, target, balls, target)) return stroke(white, target, .83);
  }
  for (const target of ordered) {
    for (const [axis, half] of [['x', HALF_WIDTH], ['z', HALF_LENGTH]]) {
      for (const side of [-1, 1]) {
        const rail = cushionPoint(white, target, axis, side * (half - BALL_RADIUS));
        if (rail && clearPath(white, rail, balls, target) && clearPath(rail, target, balls, target)) {
          return stroke(white, rail, 1);
        }
      }
    }
  }
  return stroke(white, ordered[0] ?? balls.find(b => b.number) ?? { x: 0, z: 0 }, .90);
}

export function planTableShot(table) {
  const balls = [];
  for (const [number, body] of table.balls.entries()) {
    if (!table.world.bodies.IsAdded(body.GetID())) continue;
    const p = body.GetPosition();
    balls.push({ number, x: p.GetX(), z: p.GetZ() });
  }
  return choosePoolShot(balls, table.match);
}
