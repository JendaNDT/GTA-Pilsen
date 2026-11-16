// Offline tessellation, footprint matching and asset packing for all four city sheets.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assetFingerprint, parsePack } from '../src/data.js';
import { HeritageMesh } from '../src/world/heritage-geometry.js';
import { addCityBuilding } from './city_surfaces.mjs';

const [, , surfacesPath, districtsPath, output = 'public/detail/city', mapData = 'public/data'] = process.argv;
if (!surfacesPath || !districtsPath) throw new Error('node tools/build_city.mjs PLOCHY.json MESTSKE_CASTI.geojson [VÝSTUP] [HERNÍ_DATA]');
const source = JSON.parse(fs.readFileSync(surfacesPath));
const districtsBytes = fs.readFileSync(districtsPath);
const { origin, bounds } = JSON.parse(fs.readFileSync(path.join(mapData, 'meta.json')));
const raw = (name) => Uint8Array.from(fs.readFileSync(path.join(mapData, name))).buffer;
const osm = raw('buildings.bin');

// World bez grafiky a dopravy stačí pro stejnou mřížku, výšky a půdorysy jako při hraní.
globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { World } = await import('../src/world/world.js');
const { CHUNK, COLL_CELL, BF, BK } = await import('../src/config.js');
const world = Object.create(World.prototype);
world.minX = Math.floor(bounds.minX / CHUNK) * CHUNK;
world.minZ = Math.floor(bounds.minZ / CHUNK) * CHUNK;
world.cols = Math.ceil((bounds.maxX - world.minX) / CHUNK);
world.rows = Math.ceil((bounds.maxZ - world.minZ) / CHUNK);
world.gcols = world.cols * CHUNK / COLL_CELL + 1;
world.grows = world.rows * CHUNK / COLL_CELL + 1;
world._initTerrain(parsePack(raw('terrain.bin')));
world._initBuildings(parsePack(osm));
world._initRoads(parsePack(raw('roads.bin')));

const key = (x, z) => x * 4096 + z;
const GRID = 32;
const pointInRing = (ring, x, z) => {
  let hit = false;
  for (let i = 0, j = ring.length - 3; i < ring.length; j = i, i += 3) {
    const a = ring[i + 2], b = ring[j + 2];
    if ((a > z) !== (b > z) && x < ring[i] + (ring[j] - ring[i]) * (z - a) / (b - a)) hit = !hit;
  }
  return hit;
};

function extents(faces) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [, ...rings] of faces) for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 3) {
      minX = Math.min(minX, ring[i]); maxX = Math.max(maxX, ring[i]);
      minZ = Math.min(minZ, ring[i + 2]); maxZ = Math.max(maxZ, ring[i + 2]);
    }
  }
  return [minX, minZ, maxX, maxZ];
}

const records = source.buildings.map(([id, faces], index) => {
  const found = faces.filter(([type]) => type === 0);
  const foundations = (found.length ? found : faces.filter(([type]) => type === 2 || type === 3)).map(([, ...rings]) => rings);
  const area = extents(faces);
  const [x0, z0, x1, z1] = area;
  return { index, id, faces, foundations, area, owner: world.chunkIndex((x0 + x1) / 2, (z0 + z1) / 2), parent: index, best: -1, votes: 0 };
});
const grid = new Map();
for (const rec of records) {
  const [x0, z0, x1, z1] = rec.area;
  for (let z = Math.floor(z0 / GRID); z <= Math.floor(z1 / GRID); z++) {
    for (let x = Math.floor(x0 / GRID); x <= Math.floor(x1 / GRID); x++) {
      const cell = key(x, z);
      if (!grid.has(cell)) grid.set(cell, []);
      grid.get(cell).push(rec);
    }
  }
}

function parent(index) {
  while (records[index].parent !== index) {
    records[index].parent = records[records[index].parent].parent;
    index = records[index].parent;
  }
  return index;
}

const minX = Math.min(...records.map((r) => r.area[0])), minZ = Math.min(...records.map((r) => r.area[1]));
const maxX = Math.max(...records.map((r) => r.area[2])), maxZ = Math.max(...records.map((r) => r.area[3]));
const agreements = [];
for (let i = 0; i < world.bCount; i++) {
  const x0 = world.bMinX[i], x1 = world.bMaxX[i], z0 = world.bMinZ[i], z1 = world.bMaxZ[i];
  if (x0 > maxX || x1 < minX || z0 > maxZ || z1 < minZ) continue;
  const hits = new Map();
  let samples = 0, covered = 0;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
    const x = x0 + (x1 - x0) * (col + 0.5) / 7, z = z0 + (z1 - z0) * (row + 0.5) / 7;
    const nearby = grid.get(key(Math.floor(x / GRID), Math.floor(z / GRID)));
    if (!world._pointInBuilding(i, x, z)) continue;
    samples++;
    if (!nearby) continue;
    let hit = false;
    for (const rec of nearby) {
      const [ax, az, bx, bz] = rec.area;
      if (x < ax || z < az || x > bx || z > bz) continue;
      if (!rec.foundations.some(([outer, ...holes]) => pointInRing(outer, x, z) && !holes.some((h) => pointInRing(h, x, z)))) continue;
      hits.set(rec, (hits.get(rec) || 0) + 1);
      hit = true;
    }
    if (hit) covered++;
  }
  if (!samples || covered / samples < 0.66) continue;
  // Stavební části vedené na různých parcelách dostanou společný životní cyklus.
  const ordered = [...hits].sort((a, b) => b[1] - a[1] || a[0].index - b[0].index);
  const anchor = ordered[0][0];
  for (const [rec, votes] of ordered) {
    if (votes < samples * 0.09 && rec !== anchor) continue;
    if (votes > rec.votes && !(world.b.flags[i] & BF.PART)) { rec.best = i; rec.votes = votes; }
    const root = parent(anchor.index), other = parent(rec.index);
    if (root !== other) records[other].parent = root;
  }
  agreements.push([i, anchor.index, (x1 - x0) * (z1 - z0)]);
}

const groupOwner = new Map();
for (const [i, index, area] of agreements) {
  const root = parent(index);
  const prev = groupOwner.get(root);
  if (!prev || area > prev.area) {
    const ci = world.chunkIndex((world.bMinX[i] + world.bMaxX[i]) / 2, (world.bMinZ[i] + world.bMaxZ[i]) / 2);
    groupOwner.set(root, { ci, area });
  }
}

const tiles = new Map();
for (const rec of records) {
  const ci = groupOwner.get(parent(rec.index))?.ci ?? rec.owner;
  if (!tiles.has(ci)) tiles.set(ci, { uploads: [], replaced: [] });
  tiles.get(ci).uploads.push(rec);
  rec.owner = ci;
}
for (const [i, index] of agreements) tiles.get(records[index].owner).replaced.push(i);

function writePack(file, fields, arrays) {
  const arrayInfo = {};
  const payload = [];
  let offset = 0;
  for (const [name, [dtype, array]] of Object.entries(arrays)) {
    const pad = (4 - offset % 4) % 4;
    if (pad) { payload.push(Buffer.alloc(pad)); offset += pad; }
    arrayInfo[name] = { dtype, offset, length: array.length };
    payload.push(Buffer.from(array.buffer));
    offset += array.byteLength;
  }
  const header = Buffer.from(JSON.stringify({ ...fields, arrays: arrayInfo }));
  const length = (header.length + 3) & ~3;
  const prefix = Buffer.alloc(8 + length, 32);
  prefix.write('PLZ1');
  prefix.writeUInt32LE(length, 4);
  header.copy(prefix, 8);
  fs.writeFileSync(file, Buffer.concat([prefix, ...payload]));
}

function packMesh(mesh, cx, cz, prefix = '') {
  const index = mesh.p.length / 3 <= 65535 ? Uint16Array : Uint32Array;
  const coord = Int16Array.from(mesh.p, (p, i) => {
    const v = Math.round((p - (i % 3 === 0 ? cx : i % 3 === 2 ? cz : 0)) * 50);
    if (v < -32768 || v > 32767) throw new Error(`Vrchol ${p} [${i % 3}] mimo rozsah dlaždice ${cx}, ${cz}`);
    return v;
  });
  const arrays = {
    p: ['i2', coord], n: ['i1', Int8Array.from(mesh.n, (v) => Math.round(127 * v))],
    c: ['u1', Uint8Array.from(mesh.c, (v) => Math.min(255, Math.round(v * 255)))],
    i: [index === Uint16Array ? 'u2' : 'u4', index.from(mesh.indices)],
  };
  if (!prefix) arrays.win = ['i2', Int16Array.from(mesh.uv, (v, i) => Math.round(v * (i % 3 === 2 ? 1 : 32)))];
  return Object.fromEntries(Object.entries(arrays).map(([name, value]) => [prefix + name, value]));
}

// Simplified bounding polygons retain borough edges to within one metre.
function simplifyRing(ring) {
  const kept = new Set([0, ring.length - 1]);
  const todo = [[0, ring.length - 1]];
  while (todo.length) {
    const [a, b] = todo.pop();
    const [ax, az] = ring[a], [bx, bz] = ring[b], dx = bx - ax, dz = bz - az;
    const len = dx * dx + dz * dz;
    let furthest = -1, best = 1;
    for (let i = a + 1; i < b; i++) {
      const [x, z] = ring[i];
      const t = len ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len)) : 0;
      const d = (x - ax - t * dx) ** 2 + (z - az - t * dz) ** 2;
      if (d > best) { best = d; furthest = i; }
    }
    if (furthest >= 0) { kept.add(furthest); todo.push([a, furthest], [furthest, b]); }
  }
  return [...kept].sort((a, b) => a - b).flatMap((i) => ring[i].map(Math.round));
}
const districts = JSON.parse(districtsBytes).features.filter(({ geometry }) => geometry.type === 'Polygon')
  .map(({ properties, geometry }) => [
    Number(properties.NAZEV.match(/PLZEŇ (\d+)/)[1]),
    geometry.coordinates.map((ring) => simplifyRing(ring.map(([lon, lat]) =>
      [(lon - origin.lon) * origin.kx, (origin.lat - lat) * origin.ky]))),
  ]).sort((a, b) => a[0] - b[0]);
if (new Set(districts.map(([id]) => id)).size !== 10) throw new Error('Chybí městský obvod');

const index = {
  version: 1, sha256: source.sha256, osm: assetFingerprint(osm), terrain: assetFingerprint(raw('terrain.bin')),
  districtsSha256: createHash('sha256').update(districtsBytes).digest('hex'),
  buildings: records.length, surfaces: 0, districts, tiles: [],
};
fs.mkdirSync(output, { recursive: true });
let bytes = 0, triangles = 0;
for (const [ci, tile] of [...tiles].sort((a, b) => a[0] - b[0])) {
  const shell = new HeritageMesh(), detail = new HeritageMesh(), roofs = [];
  const cx = world.minX + ((ci % world.cols) + 0.5) * CHUNK;
  const cz = world.minZ + (Math.floor(ci / world.cols) + 0.5) * CHUNK;
  for (const rec of tile.uploads) {
    const i = rec.best, kind = world.b.kind[i];
    const height = i < 0 ? 0 : world.bWall[i] - world.bGround[i];
    const use = kind === BK.INDUSTRIAL || kind === BK.FARM ? 5 :
      kind === BK.TRANSPORT || kind === BK.COMMERCIAL ? 4 :
      kind === BK.HOUSE ? 1 : height >= 26 ? 2 : height < 5 ? 0 : 3;
    addCityBuilding(world, rec.id, rec.faces, shell, detail, roofs, use, world.b.colour[i], world.b.roofColour[i]);
    index.surfaces += rec.faces.length;
  }
  if (!shell.indices.length) throw new Error(`Dlaždice ${cx}, ${cz} je prázdná`);
  const x0 = Math.floor(Math.min(...tile.uploads.map((rec) => rec.area[0]))), z0 = Math.floor(Math.min(...tile.uploads.map((rec) => rec.area[1])));
  const x1 = Math.ceil(Math.max(...tile.uploads.map((rec) => rec.area[2]))), z1 = Math.ceil(Math.max(...tile.uploads.map((rec) => rec.area[3])));
  const arrays = packMesh(shell, cx, cz);
  if (detail.indices.length) Object.assign(arrays, packMesh(detail, cx, cz, 'd'));
  const idx = arrays.i[1].constructor;
  arrays.roof = [arrays.i[0], idx.from(roofs)];
  const file = `${cx}-${cz}.bin`;
  const stored = path.join(output, file);
  writePack(stored, { version: 1, cx, cz, count: tile.uploads.length }, arrays);
  bytes += fs.statSync(stored).size;
  triangles += shell.indices.length / 3;
  index.tiles.push([cx, cz, file, [x0, z0, x1, z1], tile.replaced]);
}
fs.writeFileSync(path.join(output, 'index.json'), JSON.stringify(index) + '\n');
console.log(`${index.buildings} objektů, ${index.surfaces} ploch, ${triangles} trojúhelníků, ${tiles.size} dlaždic, ${bytes} bajtů, ${agreements.length} nahrazených půdorysů OSM`);
