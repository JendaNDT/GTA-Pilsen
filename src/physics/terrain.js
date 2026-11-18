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
  const vertex = (x, z) => [x, world.heightAt(x, z) - (bed ? bed(x, z) : 0), z];
  const triangle = holes.length ? (a, b, c) => {
    let pieces = [[a, b, c]];
    for (const planes of holes) pieces = pieces.flatMap((p) => subtract(p, planes));
    for (const poly of pieces) for (let i = 2; i < poly.length; i++) emit(poly[0], poly[i - 1], poly[i]);
  } : emit;
  const row = [];
  for (let x = x0; x <= x0 + size; x += step) row.push(vertex(x, z0));
  for (let z = z0 + step; z <= z0 + size; z += step) {
    let lowerLeft = vertex(x0, z);
    for (let i = 0; i + 1 < row.length; i++) {
      const lowerRight = vertex(x0 + (i + 1) * step, z);
      triangle(row[i], lowerLeft, row[i + 1]);
      triangle(row[i + 1], lowerLeft, lowerRight);
      row[i] = lowerLeft;
      lowerLeft = lowerRight;
    }
    row[row.length - 1] = lowerLeft;
  }
}
