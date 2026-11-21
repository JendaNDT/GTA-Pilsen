import { TUNNEL_HEIGHT, TUNNEL_PORTAL_CUT } from '../world/tunnels.js';

import { riverBed } from './water.js';
import { densePath, pathNormal } from '../world/road-profile.js';
import { gradeBlend, stripLift } from '../world/road-grade.js';

const ROAD_STEP = 4;                   // rozteč jemné sítě terénu podél vozovek (m)
const JUNCTION_PARTS = 4;              // na kolik dílů se pás napříč dělí v křižovatce

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
  // Pod silnicemi je terén srovnaný do jejich profilu po 4 m; fyzika ho podél vozovek sleduje
  // stejně jemně, aby nevystupoval nad pás vozovky. Jinde zůstává původní síť.
  const roads = world.roadTerrain && world.hasRoadTerrain(ci) ? ROAD_STEP : Infinity;
  const base = Math.min(terrainGridStep(world, ci), bed ? 4 : Infinity);
  const near = roads < Infinity && base > ROAD_STEP && size === 256 ? world.roadNearTile(ci) : null;
  const step = near ? base : Math.min(base, roads);
  const holes = world.tunnels.flatMap((t) => t.portalCuts(x0, z0, size)).flatMap(portalPlanes);
  const vertex = (x, z) => {
    const depth = bed ? bed(x, z) : 0;
    let y = world.heightAt(x, z);
    const road = roads < Infinity ? world.roadClampAt(x, z, y) : NaN;
    if (road < y) y = road;
    const p = [x, y - depth, z];
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
  if (near) return refinedGrid(near, base, x0, z0, size, vertex, surface);
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

/**
 * Síť terénu s buňkami `base`, z nichž buňky u vozovek (a jejich sousedé) mají jemnou síť
 * po ROAD_STEP. Uprostřed hran mezi jemnou a hrubou buňkou leží bod přesně na hrubé hraně,
 * takže síť nemá díry. Úhlopříčky mají stejný směr jako dotaz na výšku terénu.
 */
function refinedGrid(near, base, x0, z0, size, vertex, surface) {
  const N = Math.round(size / base), r = Math.round(base / ROAD_STEP), stride = Math.round(size / ROAD_STEP) + 1;
  const mask = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    for (let b = 0; b <= r && !mask[j * N + i]; b++) for (let a = 0; a <= r; a++) {
      if (near[(j * r + b) * stride + i * r + a]) { mask[j * N + i] = 1; break; }
    }
  }
  const fine = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!mask[j * N + i]) continue;
    for (let b = Math.max(0, j - 1); b <= Math.min(N - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(N - 1, i + 1); a++) fine[b * N + a] = 1;
  }
  const nodes = new Map();
  const node = (fi, fj) => {
    const key = fj * stride + fi;
    let p = nodes.get(key);
    if (p) return p;
    const ci = Math.min(N - 1, Math.floor(fi / r)), cj = Math.min(N - 1, Math.floor(fj / r));
    // bod na hraně jemné buňky s hrubou sousední: na přímce mezi rohy hrubé hrany
    const onX = fi % r !== 0, onZ = fj % r !== 0;
    let coarse = false;
    if (onX !== onZ) {
      const ai = onX ? ci : fi / r, aj = onZ ? cj : fj / r;
      const left = onX ? [ai, aj - 1] : [ai - 1, aj], right = onX ? [ai, aj] : [ai, aj];
      const fineAt = ([i, j]) => i >= 0 && j >= 0 && i < N && j < N && fine[j * N + i];
      coarse = !(fineAt(left) && fineAt(right)) && (fineAt(left) || fineAt(right)) &&
        left[0] >= 0 && left[1] >= 0 && right[0] < N && right[1] < N;
    }
    if (coarse) {
      const a = onX ? node(fi - (fi % r), fj) : node(fi, fj - (fj % r));
      const b = onX ? node(fi - (fi % r) + r, fj) : node(fi, fj - (fj % r) + r);
      const t = onX ? (fi % r) / r : (fj % r) / r;
      p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
      p.wet = a.wet && b.wet;
    } else p = vertex(x0 + fi * ROAD_STEP, z0 + fj * ROAD_STEP);
    nodes.set(key, p);
    return p;
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!fine[j * N + i]) {
      const ul = node(i * r, j * r), ur = node(i * r + r, j * r), ll = node(i * r, j * r + r), lr = node(i * r + r, j * r + r);
      surface(ul, ll, ur);
      surface(ur, ll, lr);
      continue;
    }
    for (let b = 0; b < r; b++) for (let a = 0; a < r; a++) {
      const fi = i * r + a, fj = j * r + b;
      const ul = node(fi, fj), ur = node(fi + 1, fj), ll = node(fi, fj + 1), lr = node(fi + 1, fj + 1);
      surface(ul, ll, ur);
      surface(ur, ll, lr);
    }
  }
}

/**
 * Povrch vozovek s hladkým profilem (pásy po 2 m po celé šířce). Terén pod silnicí je srovnaný
 * do stejného profilu a pás leží jako vykreslený asfalt 5 cm nad ním, takže drobné nerovnosti
 * sítě terénu kola necítí. Na začátku pásu (za přechodem u chráněných míst) se zvedá plynule.
 */
export function roadSurfaceTriangles(world, ci, emit) {
  const grade = world.roadGrade, pieces = world.rPieces?.[ci];
  if (!grade || !pieces) return;
  const { rpx, rpz, rOff } = world;
  const up = (a, b, c) => ((b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])) >= 0;
  const tri = (a, b, c) => (up(a, b, c) ? emit(a, b, c) : emit(a, c, b));
  for (let q = 0; q < pieces.length; q += 3) {
    const road = pieces[q], s = pieces[q + 1], e = pieces[q + 2];
    if (grade.start[road] < 0) continue;
    const hw = world.r.w[road] / 2;
    const D = densePath(rpx, rpz, null, s, e, rOff[road], rOff[road + 1] - 1, 2);
    let station = grade.station[s], previous = null;
    for (let k = 0; k < D.n; k++) {
      if (k) station += Math.hypot(D.x[k] - D.x[k - 1], D.z[k] - D.z[k - 1]);
      const n = pathNormal(D, k), scale = Math.min(n.scale, 1.5);
      const y = world.roadGradeAt(road, station);
      // ručně doladěná místa (konce mostů, podjezdy) zůstávají jen na terénu
      if (y !== y) { previous = null; continue; }
      // v přechodu k nim a u nenapojených konců jede auto po plynule upraveném terénu
      if (gradeBlend(grade, road, station) < 1) { previous = null; continue; }
      const lift = stripLift(grade, road, station);
      // V křižovatce leží pás ve společné výšce všech vozovek. Aby se překrývající pásy
      // různých silnic shodovaly, dělí se tam napříč na JUNCTION_PARTS dílů.
      const junction = world.inJunction(D.x[k], D.z[k]) ||
        world.inJunction(D.x[k] - n.x * hw * scale, D.z[k] - n.z * hw * scale) ||
        world.inJunction(D.x[k] + n.x * hw * scale, D.z[k] + n.z * hw * scale);
      const parts = junction ? JUNCTION_PARTS : 1;
      const points = [];
      for (let i = 0; i <= parts; i++) {
        const u = -1 + (2 * i) / parts;
        const x = D.x[k] + n.x * hw * scale * u, z = D.z[k] + n.z * hw * scale * u;
        let h = y;
        if (junction && world.inJunction(x, z)) {
          const shared = world.junctionSurfaceAt(x, z);
          if (shared === shared) h = shared;
        }
        points.push([x, h + lift, z]);
      }
      const section = { points, parts };
      if (previous) {
        // spojení úseků s různým dělením: chybějící body leží na přímce mezi krajními
        const count = Math.max(previous.parts, parts);
        const at = (sec, i) => {
          if (sec.parts === count) return sec.points[i];
          const a = sec.points[0], b = sec.points[sec.parts], t = i / count;
          return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
        };
        for (let i = 0; i < count; i++) {
          const p0 = at(previous, i), p1 = at(previous, i + 1), c0 = at(section, i), c1 = at(section, i + 1);
          tri(p0, p1, c1);
          tri(p0, c1, c0);
        }
      }
      previous = section;
    }
  }
}
