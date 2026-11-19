// Kontrola průchozího objemu herních tras před zařazením zaměřeného modelu.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Box3, Triangle, Vector3 } from 'three/webgpu';
import { assetFingerprint, parsePack } from '../src/data.js';
import { structureSurface } from './build_structures.mjs';

const local = new Triangle(),
  cellSize = 32;

export function corridor(kind, x, z, y, bx, bz, by, width, height, road = -1) {
  const length = Math.hypot(bx - x, bz - z);
  if (length < 0.001) return null;
  return {
    kind,
    x,
    z,
    y,
    bx,
    bz,
    length,
    dx: (bx - x) / length,
    dz: (bz - z) / length,
    grade: (by - y) / length,
    width,
    height,
    road,
    localBox: new Box3(new Vector3(0, 0.12, -width), new Vector3(length, height, width))
  };
}

export function intersectsCorridor(triangle, c) {
  for (const key of ['a', 'b', 'c']) {
    const p = triangle[key],
      x = p.x - c.x,
      z = p.z - c.z,
      along = x * c.dx + z * c.dz;
    local[key].set(along, p.y - c.y - c.grade * along, z * c.dx - x * c.dz);
  }
  return c.localBox.intersectsTriangle(local);
}

function gridCells(minX, minZ, maxX, maxZ, visit) {
  for (let iz = Math.floor(minZ / cellSize); iz <= Math.floor(maxZ / cellSize); iz++) {
    for (let ix = Math.floor(minX / cellSize); ix <= Math.floor(maxX / cellSize); ix++) visit(ix + ',' + iz);
  }
}

export async function loadStructureMap(dir, bridges) {
  globalThis.window ??= {};
  globalThis.location ??= { search: '' };
  globalThis.matchMedia ??= () => ({ matches: false });
  const { World } = await import('../src/world/world.js');
  // Maska pozemků je textura prohlížeče. Pro průchozí objemy stačí síť terénu a dopravní profily.
  class GeometryWorld extends World {
    _initLand() {}
  }
  const json = async (name) => JSON.parse(await readFile(path.join(dir, name), 'utf8'));
  const data = { meta: await json('meta.json') },
    sources = {};
  for (const name of ['terrain', 'landscape', 'roads', 'rails', 'buildings', 'trees']) {
    const bytes = new Uint8Array(await readFile(path.join(dir, name + '.bin'))).buffer;
    data[name] = parsePack(bytes);
    sources[name] = assetFingerprint(bytes);
  }
  const grades = await readFile(path.join(dir, 'grade-separations.json'));
  data.gradeSeparations = JSON.parse(grades);
  sources['grade-separations'] = assetFingerprint(Uint8Array.from(grades).buffer);
  for (const [key, fingerprint] of Object.entries(data.gradeSeparations.sources)) {
    if (sources[key] !== fingerprint) throw Error('Výškové profily neodpovídají vrstvě ' + key);
  }
  if (bridges) data.structures = {index:{tiles:[], bridges}, positions:new Float32Array()};
  return { world: new GeometryWorld(data), sources, stops: (await json('timetable.json')).stops };
}

function indexRoutes(world, stops, area, RC, RF, drivable) {
  const cells = new Map(),
    bridges = [];
  const nearby = (x, z, bx, bz, r) =>
    Math.max(x, bx) + r >= area.min.x &&
    Math.min(x, bx) - r <= area.max.x &&
    Math.max(z, bz) + r >= area.min.z &&
    Math.min(z, bz) - r <= area.max.z;
  function add(c) {
    if (!c || !nearby(c.x, c.z, c.bx, c.bz, c.width + 2)) return;
    gridCells(
      Math.min(c.x, c.bx) - c.width,
      Math.min(c.z, c.bz) - c.width,
      Math.max(c.x, c.bx) + c.width,
      Math.max(c.z, c.bz) + c.width,
      (key) => {
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(c);
      }
    );
  }
  for (let road = 0; road < world.rCount; road++) {
    const cls = world.r.cls[road],
      flags = world.r.flags[road];
    const width = world.r.w[road] / 2,
      bridge = Boolean(flags & RF.BRIDGE);
    const park =
      !bridge &&
      !(flags & (RF.ROUNDABOUT | RF.TUNNEL)) &&
      ([RC.UNCLASSIFIED, RC.RESIDENTIAL, RC.LIVING, RC.TERTIARY].includes(cls) || flags & RF.AISLE);
    for (let i = world.rOff[road]; i + 1 < world.rOff[road + 1]; i++) {
      const ax = world.rpx[i],
        az = world.rpz[i],
        dx = world.rpx[i + 1] - ax,
        dz = world.rpz[i + 1] - az;
      if (!nearby(ax, az, ax + dx, az + dz, width + 16)) continue;
      const pieces = Math.ceil(Math.hypot(dx, dz) / 4);
      for (let j = 0; j < pieces; j++) {
        const a = j / pieces,
          b = (j + 1) / pieces,
          x = ax + a * dx,
          z = az + a * dz,
          bx = ax + b * dx,
          bz = az + b * dz;
        const y = world.roadSurfaceY(road, i, a, x, z),
          by = world.roadSurfaceY(road, i, b, bx, bz);
        const c = corridor(
          cls <= drivable ? 'vozovka' : 'pěší cesta',
          x,
          z,
          y,
          bx,
          bz,
          by,
          width,
          cls <= drivable ? 4.2 : 2.1,
          road
        );
        if (!c) continue;
        add(c);
        if (bridge) bridges.push(c);
        if (park)
          for (const side of [-1, 1]) {
            const across = side * (width + 1.35),
              ox = -c.dz * across,
              oz = c.dx * across;
            add(
              corridor(
                'parkování provozu',
                x + ox,
                z + oz,
                world.heightAt(x + ox, z + oz),
                bx + ox,
                bz + oz,
                world.heightAt(bx + ox, bz + oz),
                flags & RF.AISLE ? 2.65 : 1.05,
                2.25
              )
            );
          }
      }
    }
  }
  for (const r of world.rails)
    for (let i = 2; i < r.pts.length; i += 2) {
      const [x, z, bx, bz] = r.pts.slice(i - 2, i + 2);
      if (!nearby(x, z, bx, bz, 2)) continue;
      const ay = r.y?.[i / 2 - 1],
        by = r.y?.[i / 2],
        n = Math.ceil(Math.hypot(bx - x, bz - z) / 4);
      for (let j = 0; j < n; j++) {
        const a = j / n,
          b = (j + 1) / n,
          x0 = x + (bx - x) * a,
          z0 = z + (bz - z) * a,
          x1 = x + (bx - x) * b,
          z1 = z + (bz - z) * b;
        add(
          corridor(
            'koleje',
            x0,
            z0,
            ay === undefined ? world.heightAt(x0, z0) : ay + (by - ay) * a,
            x1,
            z1,
            ay === undefined ? world.heightAt(x1, z1) : ay + (by - ay) * b,
            1.7,
            4.5
          )
        );
      }
    }
  const point = (kind, x, z, r, h) => {
    if (!nearby(x, z, x, z, r)) return;
    const y = world.groundY(x, z);
    add(corridor(kind, x - r, z, y, x + r, z, y, r, h));
  };
  for (const [, x, z] of stops) point('zastávka', x, z, 1.2, 2.1);
  for (const [x, z] of [...world.meta.addresses, ...world.meta.landmarks, ...world.meta.food])
    point('cíl zakázky nebo památka', x, z, 0.8, 2.1);
  for (const [x, z] of world.meta.crossings) point('přechod', x, z, 1, 2.1);
  for (const { a, b } of world.meta.traffic.crossings)
    add(corridor('přechod', ...a, world.groundY(...a), ...b, world.groundY(...b), 1.2, 2.1));
  for (const [x, z] of [
    [106, -1596],
    [984, -396],
    [-266, 1314],
    [48, 52]
  ])
    point('heliport', x, z, 6, 4);
  point('začátek hry', -42, 52, 2, 2.1);
  point('výjezd z garáže', 833, 254, 2.8, 2.3);
  return { cells, bridges };
}

function bridgeLevel(p, segments) {
  let nearest = 15.01,
    match;
  for (const s of segments) {
    const t = Math.max(0, Math.min(s.length, (p.x - s.x) * s.dx + (p.z - s.z) * s.dz));
    const distance = Math.hypot(p.x - s.x - s.dx * t, p.z - s.z - s.dz * t);
    if (distance >= nearest) continue;
    nearest = distance;
    match = { road: s.road, level: s.y + t * s.grade };
  }
  return match;
}

// U konvexního kolizního obalu může celý krátký průchozí objem ležet uvnitř.
export function hullContainsCorridorCenter(triangles, inside, c) {
  const mid = c.length/2;
  const point = new Vector3(c.x+c.dx*mid, c.y+c.grade*mid+(c.localBox.min.y+c.localBox.max.y)/2, c.z+c.dz*mid);
  const normal = new Vector3(), delta = new Vector3();
  for (const face of triangles) {
    face.getNormal(normal);
    const sign = Math.sign(normal.dot(delta.subVectors(inside,face.a)));
    if (sign && sign * normal.dot(delta.subVectors(point,face.a)) < -1e-6) return false;
  }
  return true;
}

export async function audit(parts, mapDir, calibrations) {
  const { world, sources, stops } = await loadStructureMap(mapDir, calibrations);
  const { RC, RF, DRIVABLE_MAX } = await import('../src/config.js');
  const area = new Box3(),
    v = new Vector3(),
    vertices = new Map();
  for (const part of parts) {
    const surfaces = part.faces.map(structureSurface);
    vertices.set(part.id, surfaces);
    for (const f of surfaces) area.union(f.box);
  }
  const { cells, bridges } = indexRoutes(world, stops, area, RC, RF, DRIVABLE_MAX);
  const reports = [];
  for (const part of parts) {
    const categories = new Set(),
      levels = [];
    for (const f of vertices.get(part.id)) {
      for (const { tri, box } of f.triangles) {
        const routes = new Set();
        gridCells(box.min.x, box.min.z, box.max.x, box.max.z, (key) => {
          for (const c of cells.get(key) ?? []) routes.add(c);
        });
        for (const c of routes)
          if (!categories.has(c.kind) && intersectsCorridor(tri, c)) categories.add(c.kind);
      }
      if (['Most', 'Pilir_Sloup'].includes(f.face[0]) && !f.box.isEmpty()) {
        const p = f.box.getCenter(v),
          deck = bridgeLevel(p, bridges),
          terrain = world.heightAt(p.x, p.z);
        levels.push({
          kind: f.face[0],
          min: f.box.min.y,
          max: f.box.max.y,
          terrain,
          deck: deck?.level ?? null,
          road: deck?.road ?? null,
          top:
            f.face[0] === 'Most' && f.triangles.some((t) => Math.abs(t.tri.getNormal(new Vector3()).y) > 0.8)
        });
      }
    }
    if (part.convex) {
      const triangles = vertices.get(part.id).flatMap(f => f.triangles.map(t => t.tri));
      const box = new Box3(), inside = new Vector3();
      for (const tri of triangles) for (const p of [tri.a,tri.b,tri.c]) {
        box.expandByPoint(p);
        inside.add(p);
      }
      inside.divideScalar(3*triangles.length);
      const checked = new Set();
      gridCells(box.min.x,box.min.z,box.max.x,box.max.z,key => {
        for (const c of cells.get(key) ?? []) {
          if (categories.has(c.kind) || checked.has(c)) continue;
          checked.add(c);
          if (hullContainsCorridorCenter(triangles,inside,c)) categories.add(c.kind);
        }
      });
    }
    reports.push({ id: part.id, categories: [...categories].sort(), levels });
  }
  return { sources, reports };
}

async function main() {
  const [dir = 'data-raw/structures', mapDir = 'public/data'] = process.argv.slice(2);
  const { parts } = JSON.parse(await readFile(path.join(dir, 'dily.json'), 'utf8'));
  const { sources, reports } = await audit(parts, mapDir);
  const clashes = [['díl', 'herní průchozí objemy']],
    heights = [['díl', 'druh', 'pata vůči terénu (m)', 'vršek vůči mostovce (m)', 'výsledek']];
  for (const r of reports) {
    clashes.push([r.id, r.categories.join(', ') || 'volno']);
    for (const kind of new Set(r.levels.map((p) => p.kind))) {
      const data = r.levels.filter((p) => p.kind === kind),
        low = data.reduce((a, b) => (a.min < b.min ? a : b));
      const tops = kind === 'Most' ? data.filter((p) => p.top) : data;
      const top = tops.reduce((a, b) => (!a || b.max > a.max ? b : a), null);
      const diff = top?.deck == null ? null : top.max - top.deck;
      const base = low.min - low.terrain;
      const check = diff === null || Math.abs(diff) > 0.5 || (kind === 'Pilir_Sloup' && Math.abs(base) > 0.5);
      heights.push([
        r.id,
        kind,
        base.toFixed(2),
        diff?.toFixed(2) ?? 'bez herní mostovky',
        check ? 'ověřit' : 'souhlasí'
      ]);
    }
  }
  for (const [name, rows] of [
    ['strety', clashes],
    ['vysky', heights]
  ]) {
    await writeFile(path.join(dir, name + '.tsv'), rows.map((row) => row.join('\t')).join('\n') + '\n');
  }
  await writeFile(path.join(dir, 'kontroly.json'), JSON.stringify({ sources, reports }) + '\n');
  console.log(
    reports.length +
      ' kontrolovaných dílů, ' +
      reports.filter((r) => r.categories.length).length +
      ' s průnikem.'
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
