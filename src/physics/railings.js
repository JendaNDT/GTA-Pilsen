import { breakableId } from './breakables.js';
import { prazdrojThickness } from '../world/prazdroj-bridge.js';
import { COLL_CELL, RF } from '../config.js';
import { BRIDGE_THICKNESS, densePath, pathNormal } from '../world/road-profile.js';

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

// Určí část úsečky uvnitř půdorysu druhé mostovky ve stejné výškové úrovni.
function overlapInterval(a, b, deck, thickness) {
  let start = 0, end = 1;
  function clip(left, right) {
    if (left < 0 && right < 0) return false;
    if (left < 0) start = Math.max(start, left / (left - right));
    if (right < 0) end = Math.min(end, left / (left - right));
    return end > start;
  }
  for (let k = 0; k < 4; k++) {
    const p = deck.corners[k], q = deck.corners[(k + 1) % 4];
    const cross = v => (q[0] - p[0]) * (v[2] - p[2]) - (q[2] - p[2]) * (v[0] - p[0]);
    if (!clip(cross(a), cross(b))) return null;
  }
  const diff = p => p[1] - deck.y - (p[0] - deck.x) * deck.slopeX - (p[2] - deck.z) * deck.slopeZ;
  const h = diff(a), j = diff(b);
  // Mostovky jsou spojené tam, kde se jejich skutečné desky dotýkají i ve výšce.
  const otherThickness = deck.entry.thickness ?? BRIDGE_THICKNESS;
  if (!clip(thickness - h, thickness - j) || !clip(otherThickness + h, otherThickness + j)) return null;
  return [start, end];
}

function eachCell(points, visit) {
  const xs = points.map(p => p[0]), zs = points.map(p => p[2]);
  for (let x = Math.floor(Math.min(...xs) / COLL_CELL); x <= Math.floor(Math.max(...xs) / COLL_CELL); x++) {
    for (let z = Math.floor(Math.min(...zs) / COLL_CELL); z <= Math.floor(Math.max(...zs) / COLL_CELL); z++) {
      visit(x * 8192 + z);
    }
  }
}

export function exteriorBridgeEdges(world, paths) {
  const tiles = new Map(), cells = new Map();
  for (const [order, entry] of paths.entries()) {
    const { path, width } = entry;
    let left, right;
    for (let k = 0; k < path.n; k++) {
      const n = pathNormal(path, k), offset = width * Math.min(1.5, n.scale);
      const x = path.x[k], y = path.y[k], z = path.z[k];
      const lo = [x - n.x * offset, y, z - n.z * offset], hi = [x + n.x * offset, y, z + n.z * offset];
      if (k) {
        const dx = x - path.x[k - 1], dz = z - path.z[k - 1], length2 = dx * dx + dz * dz;
        if (length2 > 1e-8) {
          const slope = (y - path.y[k - 1]) / length2;
          const deck = { corners: [left, lo, hi, right], x, y, z, slopeX: dx * slope, slopeZ: dz * slope, entry, order };
          eachCell(deck.corners, key => {
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key).push(deck);
          });
        }
      }
      left = lo; right = hi;
    }
  }
  function put(edge) {
    const [a, b] = edge.corners;
    const ci = world.chunkIndex((a[0] + b[0]) / 2, (a[2] + b[2]) / 2);
    if (ci < 0) return;
    if (!tiles.has(ci)) tiles.set(ci, []);
    const entries = tiles.get(ci);
    const center = edge.corners.reduce((sum, p) => sum.map((v, i) => v + p[i] / 4), [0, 0, 0]);
    Object.assign(edge, { id: breakableId('railing', ci, entries.length), tile: ci,
      x: center[0], y: center[1] + edge.height / 2, z: center[2] });
    entries.push(edge);
  }
  for (const [index, entry] of paths.entries()) {
    bridgeEdges(world, entry.path, entry.width, entry.style, edge => {
      if (edge.style === 'stone') { put(edge); return; }
      const [a, b, c, d] = edge.corners, covered = [];
      const candidates = new Set();
      eachCell([a, b], key => { for (const deck of cells.get(key) ?? []) candidates.add(deck); });
      const thickness = entry.thickness ?? BRIDGE_THICKNESS;
      // Dva nepatrně odsazené řezy rozliší společnou hranu od vnitřku sousední desky.
      const offset = (p, inside, scale) => p.map((v, i) => v + (v - inside[i]) * scale);
      const outerA = offset(a, d, 1e-5), outerB = offset(b, c, 1e-5);
      const innerA = offset(a, d, -1e-5), innerB = offset(b, c, -1e-5);
      for (const deck of candidates) {
        if (deck.entry === entry) continue;
        const interval = overlapInterval(outerA, outerB, deck, thickness);
        if (interval) covered.push(interval);
        if (deck.order < index || deck.entry.style === 'stone') {
          const coincident = overlapInterval(innerA, innerB, deck, thickness);
          if (coincident) covered.push(coincident);
        }
      }
      if (!covered.length) { put(edge); return; }
      const emit = (lo, hi) => {
        if (hi - lo < 0.0001) return;
        put({ ...edge, corners: [interpolate(a, b, lo), interpolate(a, b, hi),
          interpolate(d, c, hi), interpolate(d, c, lo)] });
      };
      covered.sort((first, second) => first[0] - second[0]);
      let cursor = 0;
      for (const [lo, hi] of covered) { emit(cursor, lo); cursor = Math.max(cursor, hi); }
      emit(cursor, 1);
    });
  }
  return tiles;
}

export function indexBridgeEdges(world) {
  const paths = [];
  for (let i = 0; i < world.rCount; i++) {
    const flags = world.r.flags[i], measured = world.rondel?.elevated.has(i);
    if ((flags & RF.SHARED_DECK) || (!(flags & RF.BRIDGE) && !measured)) continue;
    const a = world.rOff[i], b = world.rOff[i + 1] - 1;
    const path = densePath(world.rpx, world.rpz, world.rpy, a, b, a, b, Infinity);
    const style = world.archedBridges.has(i) ? 'stone' : measured || world.gradeRoads.has(i) ? 'open' : 'solid';
    paths.push({ path, width: world.deckHalfWidth(i), style, thickness: i === world.prazdrojRoad ? prazdrojThickness : BRIDGE_THICKNESS });
  }
  for (const [i, rail] of world.rails.entries()) {
    if (!rail.y) continue;
    const x = [], z = [];
    for (let k = 0; k < rail.pts.length; k += 2) { x.push(rail.pts[k]); z.push(rail.pts[k + 1]); }
    const b = x.length - 1;
    paths.push({ path: densePath(x, z, rail.y, 0, b, 0, b, Infinity),
      width: rail.cls === 1 ? 2.4 : 1.7, style: world.gradeRails.has(i) ? 'open' : 'solid' });
  }
  return exteriorBridgeEdges(world, paths);
}
