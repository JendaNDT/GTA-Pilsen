import { Box3, Plane, Vector3 } from 'three/webgpu';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

// Oříznutí trojúhelníku zachovává orientaci i světové souřadnice na společné hraně dlaždic.
function clip(vertices, axis, bound, sign) {
  const clipped = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length];
    const da = (a[axis] - bound) * sign,
      db = (b[axis] - bound) * sign;
    if (da >= 0) clipped.push(a);
    if (da * db < 0) {
      const point = a.clone().lerp(b, da / (da - db));
      point[axis] = bound;
      clipped.push(point);
    }
  }
  return clipped;
}

export function tileTriangles(triangles, grid) {
  const groups = new Map();
  const col = (x) => Math.floor((x - grid.x) / grid.size),
    row = (z) => Math.floor((z - grid.z) / grid.size);
  const cross = new Vector3(),
    temp = new Vector3();
  for (const tri of triangles) {
    const points = [tri.a, tri.b, tri.c];
    const bounds = new Box3().setFromPoints(points);
    for (let iz = row(bounds.min.z); iz <= row(bounds.max.z); iz++)
      for (let ix = col(bounds.min.x); ix <= col(bounds.max.x); ix++) {
        let poly = clip(points, 'x', grid.x + ix * grid.size, 1);
        poly = clip(poly, 'x', grid.x + (ix + 1) * grid.size, -1);
        poly = clip(poly, 'z', grid.z + iz * grid.size, 1);
        poly = clip(poly, 'z', grid.z + (iz + 1) * grid.size, -1);
        for (let j = 1; j + 1 < poly.length; j++) {
          cross.subVectors(poly[j], poly[0]).cross(temp.subVectors(poly[j + 1], poly[0]));
          if (cross.lengthSq() < 1e-12) continue;
          const key = ix + '_' + iz;
          if (!groups.has(key)) groups.set(key, { cx: ix, cz: iz, points: [] });
          groups.get(key).points.push(poly[0], poly[j], poly[j + 1]);
        }
      }
  }
  return [...groups.values()];
}

export function convexShell(points) {
  const unique = [...new Map(points.map((p) => [p.toArray().join(','), p])).values()];
  if (unique.length < 3) return null;
  const a = unique[0],
    b = unique.reduce((best, p) => (p.distanceToSquared(a) > best.distanceToSquared(a) ? p : best));
  const dir = b.clone().sub(a).normalize(),
    tmp = new Vector3();
  let dist = 0,
    c;
  for (const p of unique) {
    const d = tmp.subVectors(p, a).cross(dir).lengthSq();
    if (d > dist) {
      dist = d;
      c = p;
    }
  }
  if (dist < 1e-10) return null;
  const plane = new Plane().setFromCoplanarPoints(a, b, c);
  // Město některé zdi dodává jen jako svislou plochu, Jolt potřebuje obal s objemem.
  const flat = unique.every((p) => Math.abs(plane.distanceToPoint(p)) < 0.015);
  const vertices = flat
    ? unique.flatMap((p) => [-0.015, 0.015].map((d) => p.clone().addScaledVector(plane.normal, d)))
    : unique;
  const geometry = new ConvexGeometry(vertices);
  const core = [...geometry.attributes.position.array];
  geometry.dispose();
  return core.length && core.every(Number.isFinite) ? core : null;
}

function nearSurface(core, triangles) {
  const center = new Vector3(),
    a = new Vector3(),
    b = new Vector3(),
    c = new Vector3(),
    near = new Vector3();
  for (let i = 0; i < core.length; i += 9) {
    a.fromArray(core, i);
    b.fromArray(core, i + 3);
    c.fromArray(core, i + 6);
    // Těžiště a středy hran odhalí i obal, který by vyklenul městskou zeď přes dvůr.
    for (const sample of [
      center
        .copy(a)
        .add(b)
        .add(c)
        .multiplyScalar(1 / 3)
        .clone(),
      a.clone().lerp(b, 0.5),
      b.clone().lerp(c, 0.5),
      c.clone().lerp(a, 0.5)
    ]) {
      if (!triangles.some((t) => t.closestPointToPoint(sample, near).distanceToSquared(sample) <= 0.35 ** 2))
        return false;
    }
  }
  return true;
}

export function districtMeshes(surfaces, grid, precise = false) {
  const triangles = surfaces.flatMap((surface) => surface.triangles.map((item) => item.tri));
  const tiles = tileTriangles(triangles, grid);
  const byTile = new Map();
  for (const tile of tiles) {
    const mesh = { cx: tile.cx, cz: tile.cz, detail: tile.points.flatMap((p) => p.toArray()), shells: [] };
    const core = precise ? null : convexShell(tile.points);
    if (core && nearSurface(core, triangles)) mesh.shells.push(core);
    byTile.set(tile.cx + '_' + tile.cz, mesh);
  }
  const refine = new Set([...byTile.values()].filter((m) => !m.shells.length));
  if (refine.size)
    for (const face of surfaces) {
      const faceTriangles = face.triangles.map((item) => item.tri);
      for (const tile of tileTriangles(faceTriangles, grid)) {
        const mesh = byTile.get(tile.cx + '_' + tile.cz);
        if (!refine.has(mesh)) continue;
        const core = convexShell(tile.points);
        if (core && nearSurface(core, faceTriangles)) mesh.shells.push(core);
        else
          for (let i = 0; i < tile.points.length; i += 3) {
            const prism = convexShell(tile.points.slice(i, i + 3));
            if (prism) mesh.shells.push(prism);
          }
      }
    }
  return [...byTile.values()];
}
// Každý přesně shodný vrchol se uloží do základní vrstvy jednou.
export function indexTriangles(coordinates) {
  const points = [],
    indices = [],
    known = new Map();
  for (let i = 0; i < coordinates.length; i += 3) {
    const x = Math.fround(coordinates[i]),
      y = Math.fround(coordinates[i + 1]),
      z = Math.fround(coordinates[i + 2]);
    const key = x + ',' + y + ',' + z;
    let index = known.get(key);
    if (index === undefined) {
      index = points.length / 3;
      known.set(key, index);
      points.push(x, y, z);
    }
    indices.push(index);
  }
  const Index = points.length / 3 <= 65536 ? Uint16Array : Uint32Array;
  return {
    p: ['f4', Float32Array.from(points)],
    i: [Index === Uint16Array ? 'u2' : 'u4', Index.from(indices)]
  };
}
