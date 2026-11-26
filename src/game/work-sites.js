import { CHUNK, RC, RF } from '../config.js';

export const DEMO_NAME = 'Rozvoz k Boleváku';
export const DEMO_ADDRESS = 'U Velkého rybníka 2315/3';
export const DEMO_DROP = { x: 1465.5, z: -2584.6 };
export const DEMO_STOPS = [
  { type: 'tram', line: '1', from: '54717/1', to: '57061/1', direction: 'směr Bolevec',
    walk: [94.1, 39.6, 65, 39, 59, 22, 63, -20, 66, -39, 78, -48, 90, -48, 118.9, -55.7] },
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
export function curbStop(world, x, z, radius = 58, { minWidth = 4, serviceEdge, accept } = {}) {
  const center = { x, z };
  const edges = new Set();
  if (serviceEdge >= 0) edges.add(serviceEdge);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const i = world.chunkIndex(x + dx * CHUNK, z + dz * CHUNK);
    for (const e of world.trafficEdges[i] ?? []) edges.add(e);
  }
  let best = null, score = radius;
  for (const edge of edges) {
    const road = world.eRoad[edge], len = world.eLen[edge], width = world.r.w[road];
    if (world.r.cls[road] < RC.TERTIARY || world.r.flags[road] & badRoad || len < 24 || width < minWidth) continue;
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
      const stop = { ...p, waiting, edge, along };
      if (accept && !accept(stop)) continue;
      best = stop;
      score = d;
    }
  }
  return best;
}
