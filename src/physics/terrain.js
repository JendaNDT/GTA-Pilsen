import { TUNNEL_HEIGHT, TUNNEL_PORTAL_CUT } from '../world/tunnels.js';

import { riverBed } from './water.js';

export function terrainGridStep(world, ci) {
  if (world.gradeTerrain.has(ci)) return world.gradeStep;
  return world.terrainDetail.has(ci) ? world.tDetailG : world.tG;
}

// Rozdělí mnohoúhelník rovinou. Kladná polovina leží v otvoru portálu.
function split(polygon, distance) {
  const inside = [], outside = [];
  let previous = polygon.at(-1), previousDistance = distance(previous);
  for (const point of polygon) {
    const d = distance(point);
    if ((d >= 0) !== (previousDistance >= 0)) {
      const t = previousDistance / (previousDistance - d);
      const intersection = previous.map((v, i) => v + t * (point[i] - v));
      inside.push(intersection);
      outside.push(intersection);
    }
    (d >= 0 ? inside : outside).push(point);
    previous = point;
    previousDistance = d;
  }
  return { inside, outside };
}

function subtract(polygon, planes) {
  let inside = polygon;
  const pieces = [];
  for (const plane of planes) {
    const parts = split(inside, plane);
    if (parts.outside.length >= 3) pieces.push(parts.outside);
    inside = parts.inside;
    if (inside.length < 3) break;
  }
  return pieces;
}

function portalPlanes(p) {
  const along = ([x, , z]) => (x - p.x) * p.dx + (z - p.z) * p.dz;
  const across = ([x, , z]) => -(x - p.x) * p.dz + (z - p.z) * p.dx;
  const sides = [(v) => p.width - across(v), (v) => p.width + across(v)];
  return [
    [...sides, (v) => along(v) + TUNNEL_PORTAL_CUT.approach, (v) => -along(v)],
    [...sides, along, (v) => TUNNEL_PORTAL_CUT.depth - along(v),
      (v) => p.y + along(v) * p.slope + TUNNEL_HEIGHT + 0.5 - v[1]],
  ];
}

export function terrainTriangles(world, ci, x0, z0, size, emit) {
  const bed = riverBed(world, x0, z0, size);
  const step = Math.min(terrainGridStep(world, ci), bed ? 4 : Infinity);
  const holes = world.tunnels.flatMap((t) => t.portalCuts(x0, z0, size)).flatMap(portalPlanes);
  const vertex = (x, z) => {
    const depth = bed ? bed(x, z) : 0;
    const p = [x, world.heightAt(x, z) - depth, z];
    p.wet = depth > 0;
    return p;
  };
  const triangle = holes.length ? (a, b, c) => {
    let pieces = [[a, b, c]];
    for (const planes of holes) pieces = pieces.flatMap((p) => subtract(p, planes));
    for (const poly of pieces) for (let i = 2; i < poly.length; i++) emit(poly[0], poly[i - 1], poly[i]);
  } : emit;
  // Na rozhraní vody a souše musí mít oba povrchy společnou hranu.
  // Jinak se pokles nejbližšího podvodního vrcholu přenese i pod suchou vozovku.
  const shore = (dry, wet) => {
    let lo = 0, hi = 1;
    const dx = wet[0] - dry[0], dz = wet[2] - dry[2];
    for (let i = 0; i < 12; i++) {
      const t = (lo + hi) / 2;
      if (bed(dry[0] + t * dx, dry[2] + t * dz) > 0) hi = t;
      else lo = t;
    }
    const x = dry[0] + lo * dx, z = dry[2] + lo * dz;
    return [x, world.heightAt(x, z), z];
  };
  const surface = (a, b, c) => {
    if (a.wet === b.wet && a.wet === c.wet) return triangle(a, b, c);
    // První vrchol leží sám na jedné straně břehu. Zachováme pořadí vrcholů.
    if (a.wet === b.wet) [a, b, c] = [c, a, b];
    else if (a.wet === c.wet) [a, b, c] = [b, c, a];
    const p = a.wet ? shore(b, a) : shore(a, b);
    const q = a.wet ? shore(c, a) : shore(a, c);
    triangle(a, p, q);
    triangle(p, b, c);
    triangle(p, c, q);
  };
  const row = [];
  for (let x = x0; x <= x0 + size; x += step) row.push(vertex(x, z0));
  for (let z = z0 + step; z <= z0 + size; z += step) {
    let lowerLeft = vertex(x0, z);
    for (let i = 0; i + 1 < row.length; i++) {
      const lowerRight = vertex(x0 + (i + 1) * step, z);
      surface(row[i], lowerLeft, row[i + 1]);
      surface(row[i + 1], lowerLeft, lowerRight);
      row[i] = lowerLeft;
      lowerLeft = lowerRight;
    }
    row[row.length - 1] = lowerLeft;
  }
}
