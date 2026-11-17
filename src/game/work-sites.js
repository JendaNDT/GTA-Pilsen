import { CHUNK, RC, RF } from '../config.js';

export const DEMO_NAME = 'Rozvoz k Boleváku';
export const DEMO_ADDRESS = 'U Velkého rybníka 2315/3';
export const DEMO_DROP = { x: 1465.5, z: -2584.6 };
export const DEMO_STOPS = [
  { type: 'tram', line: '1', from: '54717/1', to: '57061/1', direction: 'směr Bolevec',
    walk: [94.1, 39.6, 65, 39, 59, 22, 63, -20, 66, -39, 76, -51, 118.9, -55.7] },
  { type: 'bus', line: '30', from: '57061/4', to: '57125/2', direction: 'přes Bolevecký rybník',
    walk: [123.7, -3040.6, 131, -3065, 144, -3110, 169, -3165, 206.8, -3200.1] },
];
export const DEMO_FOOT = [1393.8, -2648.1, 1424, -2628, 1441, -2613, 1456, -2600, 1465.5, -2584.6];
export const DEMO_DRIVE = [
  { x: -490.6, z: -1634, label: 'Lochotín · Lidická u Lékařské fakulty' },
  { x: 131.2, z: -3037.4, label: 'Bolevec · Plaská u Bolevecké návsi' },
];

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const badRoad = RF.PRIVATE | RF.BRIDGE | RF.TUNNEL | RF.ROUNDABOUT;

/** Hledá místo u pravého kraje vozovky a volné místo pro čekajícího chodce. */
export function curbStop(world, x, z, radius = 58) {
  const center = { x, z };
  const edges = new Set();
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const i = world.chunkIndex(x + dx * CHUNK, z + dz * CHUNK);
    for (const e of world.trafficEdges[i] ?? []) edges.add(e);
  }
  let best = null, score = radius;
  for (const edge of edges) {
    const road = world.eRoad[edge], len = world.eLen[edge], width = world.r.w[road];
    if (world.r.cls[road] < RC.TERTIARY || world.r.flags[road] & badRoad || len < 24 || width < 4) continue;
    const forward = world.eA[edge] < world.eB[edge];
    if (world.roadSpeed(road, forward) > 50) continue;
    const curb = Math.max(1.2, width / 2 - 1);
    for (let along = 10; along <= len - 10; along += 5) {
      const p = world.edgePoint(edge, along, curb, {});
      const d = distance(p, center);
      if (d >= score || !world.inBounds(p.x, p.z, 35)) continue;
      const controls = world.traffic.byEdge.get(edge) ?? [];
      const crossings = world.traffic.crossingsByEdge.get(edge) ?? [];
      if (controls.some((c) => Math.abs(c.s - along) < 9) || crossings.some((c) => Math.abs(c.s - along) < 8)) continue;
      const waiting = world.edgePoint(edge, along, width / 2 + 0.85, {});
      if (world.blocked(p.x, p.z, 1.2) || world.isWater(p.x, p.z)
          || world.blocked(waiting.x, waiting.z, 0.45) || world.isWater(waiting.x, waiting.z)) continue;
      best = { ...p, waiting, edge, along };
      score = d;
    }
  }
  return best;
}

export function taxiJourney(world, focus) {
  const { addresses, roadNames } = world.meta;
  const label = (a) => `${roadNames[a[2]]} ${a[3]}`;
  const near = [], far = [];
  for (const a of addresses) {
    if (!roadNames[a[2]] || !a[3]) continue;
    const d = Math.hypot(a[0] - focus.x, a[1] - focus.z);
    if (d > 120 && d < 850) near.push(a);
    if (d > 950 && d < 2700) far.push(a);
  }
  const sample = (list) => list.splice(Math.floor(Math.random() * list.length), 1)[0];
  for (let i = 0; near.length && i < 16; i++) {
    const origin = sample(near);
    const pick = curbStop(world, origin[0], origin[1]);
    if (!pick || world.findPath(world.nearestNode(focus.x, focus.z, 250), world.eFrom[pick.edge], 6000) === null) continue;
    for (let k = 0; far.length && k < 18; k++) {
      const address = sample(far);
      const drop = curbStop(world, address[0], address[1]);
      if (!drop || distance(pick, drop) < 800) continue;
      const path = world.findPath(world.eTo[pick.edge], world.eFrom[drop.edge], 9000, pick.edge);
      if (!path) continue;
      let context = 0, from = pick.edge;
      for (const edge of path) { context = world.turnContext(from, edge, context); from = edge; }
      if (world.turnContext(from, drop.edge, context) < 0) continue;
      const len = path.reduce((sum, e) => sum + world.eLen[e], world.eLen[pick.edge] - pick.along + drop.along);
      if (len <= 4400) return { pick, drop, len, name: label(origin), label: label(address) };
    }
  }
  return null;
}
