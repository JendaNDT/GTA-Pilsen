import { RF } from '../config.js';
import { densePath, pathNormal } from '../world/road-profile.js';

const interpolate = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lift = (a, dy) => [a[0], a[1] + dy, a[2]];

// Čtyři spodní rohy zůstávají společné pro vzhled, kolizi i pohled F8.
export function bridgeEdges(world, path, halfWidth, style, add) {
  if (path.n < 2) return;
  const stone = style === 'stone';
  const thickness = stone ? 0.5 : 0.09;
  for (const side of [-1, 1]) {
    let outer, inner;
    for (let k = 0; k < path.n; k++) {
      const normal = pathNormal(path, k);
      const offset = side * Math.min(1.5, normal.scale);
      const point = (width) => [path.x[k] + normal.x * offset * width, path.y[k],
        path.z[k] + normal.z * offset * width];
      const end = point(halfWidth), inside = point(halfWidth - thickness);
      if (outer) {
        const length = Math.hypot(end[0] - outer[0], end[2] - outer[2]);
        const count = Math.ceil(length / 2.5);
        for (let j = 0; j < count; j++) {
          const mid = interpolate(outer, end, (j + 0.5) / count);
          if (!stone && mid[1] - world.heightAt(mid[0], mid[2]) < 1.5) continue;
          const a = interpolate(outer, end, j / count), b = interpolate(outer, end, (j + 1) / count);
          const c = interpolate(inner, inside, (j + 1) / count), d = interpolate(inner, inside, j / count);
          add({ corners: side === 1 ? [a, b, c, d] : [b, a, d, c], style, height: stone ? 1.15 : 1 });
        }
      }
      outer = end; inner = inside;
    }
  }
}

export function railingFaces(edge, quad) {
  const base = edge.corners, top = base.map(p => lift(p, edge.height));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(base[i], base[j], top[j], top[i]);
  }
  quad(...top);
}

export function indexBridgeEdges(world) {
  const tiles = new Map();
  const put = (edge) => {
    const [a, b] = edge.corners;
    const ci = world.chunkIndex((a[0] + b[0]) / 2, (a[2] + b[2]) / 2);
    if (ci < 0) return;
    if (!tiles.has(ci)) tiles.set(ci, []);
    tiles.get(ci).push(edge);
  };
  for (let i = 0; i < world.rCount; i++) {
    const flags = world.r.flags[i], measured = world.rondel?.elevated.has(i);
    if ((flags & RF.SHARED_DECK) || (!(flags & RF.BRIDGE) && !measured)) continue;
    const a = world.rOff[i], b = world.rOff[i + 1] - 1;
    const path = densePath(world.rpx, world.rpz, world.rpy, a, b, a, b, Infinity);
    const style = world.archedBridges.has(i) ? 'stone' : measured || world.gradeRoads.has(i) ? 'open' : 'solid';
    bridgeEdges(world, path, world.deckHalfWidth(i), style, put);
  }
  for (const [i, rail] of world.rails.entries()) {
    if (!rail.y) continue;
    const x = [], z = [];
    for (let k = 0; k < rail.pts.length; k += 2) { x.push(rail.pts[k]); z.push(rail.pts[k + 1]); }
    const b = x.length - 1;
    bridgeEdges(world, densePath(x, z, rail.y, 0, b, 0, b, Infinity),
      rail.cls === 1 ? 2.4 : 1.7, world.gradeRails.has(i) ? 'open' : 'solid', put);
  }
  return tiles;
}
