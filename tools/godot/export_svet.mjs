#!/usr/bin/env node
// Převod mapy Plzně z původní hry (public/) do dat pro Godot (godot/data/svet/).
//
// Postaví původní herní svět (třída World) se všemi úpravami terénu, mostů a silnic a z původní
// stavby dlaždic převezme výšky terénu, kreslicí příkazy silnic, mosty, budovy, stromy a lampy.
// Výsledek je po dlaždicích 256 × 256 m v binárním formátu Godotu (bytes_to_var), každá dlaždice
// zvlášť komprimovaná (zlib). Spuštění z kořene repozitáře:
//
//   node tools/godot/export_svet.mjs            celá mapa
//   node tools/godot/export_svet.mjs --oblast -1500,-1000,1500,1500   jen výřez (x0,z0,x1,z1 v metrech)

import { register } from 'node:module';
import { readFile, writeFile, mkdir, rename, copyFile, readdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { installShim } from './node-shim.mjs';
import { encodeVariant, Vec3Array, ColorArray } from './godot-variant.mjs';
import { fillRings, strokeLine } from './raster.mjs';

installShim();
register(new URL('./export-hooks.mjs', import.meta.url).href, import.meta.url);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'godot/data/svet');
const FORMAT = 1;
const GROUND_PX = 256;          // pixelů povrchu na dlaždici (1 m na pixel)

const args = process.argv.slice(2);
const areaArg = args.includes('--oblast') ? args[args.indexOf('--oblast') + 1].split(',').map(Number) : null;
// --jen-seznamy: převede jen místa, zastávky a názvy ulic (rychlé, dlaždice zůstanou beze změny)
const onlyLists = args.includes('--jen-seznamy');

const cfg = await import(path.join(ROOT, 'src/config.js'));
// Nízká předvolba = základní geometrie bez přídavných atributů pro shadery vykreslovače three.js.
cfg.applyQualityProfile('low');
cfg.QUALITY.treesPerForestChunk = 210;
const { CHUNK, RC, RF, LC, BF, BK, DRIVABLE_MAX } = cfg;
// Data se načítají stejnou funkcí loadAll jako v prohlížeči (src/data.js), včetně kontrol otisků,
// zaměřených konstrukcí (kalibrace mostovek), úseků ulic a městského modelu. Místo sítě čte soubory z public/.
globalThis.fetch = async (url) => {
  const file = path.join(ROOT, 'public', String(url).replace(/^\/+/, '').split('?')[0]);
  try { return new Response(await readFile(file)); } catch { return new Response(null, { status: 404 }); }
};
const { loadAll, loadCityTile } = await import(path.join(ROOT, 'src/data.js'));
async function readJson(file) { return JSON.parse(await readFile(path.join(ROOT, 'public', file), 'utf8')); }

const t0 = performance.now();
const data = await loadAll(() => {});
const heritageManifest = data.heritage;
console.log(`Načtena data: konstrukce ${data.structures ? 'ano' : 'NE'}, úseky ulic ${data.streetDetails ? 'ano' : 'NE'}, ` +
  `městský model ${heritageManifest.tiles.length} dlaždic, mimoúrovňová křížení ${data.gradeSeparations ? 'ano' : 'NE'}`);

const { World, SURF } = await import(path.join(ROOT, 'src/world/world.js'));
const world = new World(data);
const ch = await import(path.join(ROOT, 'src/world/chunks.js'));
const { Districts } = await import(path.join(ROOT, 'src/world/districts.js'));
const { hash } = await import(path.join(ROOT, 'src/world/hash.js'));
const { Earcut } = await import('three/src/extras/Earcut.js');
const { LANDMARK_INFO } = await import(path.join(ROOT, 'src/game/landmarks.js'));
console.log(`Svět postaven za ${((performance.now() - t0) / 1000).toFixed(1)} s: ${world.cols} × ${world.rows} dlaždic`);

const districts = new Districts(heritageManifest.districts);
// Stejné přiřazení zaměřených budov k dlaždicím jako v src/world/heritage.js
const heritageCells = new Map();
const buildingLists = new Map();
const replaced = new Set();
for (const [x, z, name, bounds, replacements] of heritageManifest.tiles) {
  const ci = world.chunkIndex(x, z);
  if (ci >= 0) heritageCells.set(ci, { name, replacements });
  for (const i of replacements) replaced.add(i);
}
{
  const moved = new Map();
  const override = (ci) => {
    if (!buildingLists.has(ci)) buildingLists.set(ci, new Set(world.bChunks[ci]));
    return buildingLists.get(ci);
  };
  for (const [ci, { replacements }] of heritageCells) for (const i of replacements) {
    const old = world.chunkIndex((world.bMinX[i] + world.bMaxX[i]) / 2, (world.bMinZ[i] + world.bMaxZ[i]) / 2);
    if (old >= 0 && old !== ci) {
      override(old).delete(i);
      if (!moved.has(ci)) moved.set(ci, []);
      moved.get(ci).push(i);
    }
  }
  for (const [ci, list] of moved) { const group = override(ci); for (const i of list) group.add(i); }
}
const buildingsIn = (ci) => buildingLists.get(ci) ?? world.bChunks[ci] ?? [];

// Okraje chodníků jako v ChunkManager
const roadVerge = new Uint8Array(world.rCount);
for (let i = 0; i < world.rCount; i++) {
  if (world.r.cls[i] < RC.PRIMARY || world.r.cls[i] > RC.LIVING) continue;
  const mid = (world.rOff[i] + world.rOff[i + 1]) >> 1;
  roadVerge[i] = ch.surfaceContext(world, districts, world.rpx[mid], world.rpz[mid]);
}
const manager = { roadVerge, roadStations: null, roadWear: new Uint8Array(world.rCount) };
const landIndex = ch.buildLandIndex(world, districts);

// ------------------------------------------------------------------ pomocníci
const f32 = (a) => Float32Array.from(a);
const rgb8 = (col, k = 1) => col.map((v) => Math.max(0, Math.min(255, Math.round(v * k * 255))));

function tileOrigin(ci) {
  const cx = ci % world.cols, cz = Math.floor(ci / world.cols);
  return [world.minX + cx * CHUNK, world.minZ + cz * CHUNK];
}

// ------------------------------------------------------------------ terén
function exportTerrain(ci, x0, z0) {
  const geo = ch.buildTerrain(world, ci, x0, z0);
  const pos = geo.attributes.position.array;
  const count = pos.length / 3, n = Math.round(Math.sqrt(count));
  const step = CHUNK / (n - 1);
  const cm = new Int32Array(count);
  for (let k = 0; k < count; k++) cm[k] = Math.round(pos[k * 3 + 1] * 100);
  const deltas = new Int16Array(count);
  for (let k = 1; k < count; k++) {
    const d = cm[k] - cm[k - 1];
    if (d > 32767 || d < -32768) throw new Error(`Rozdíl výšek mimo rozsah v dlaždici ${ci}`);
    deltas[k] = d;
  }
  const out = { g: step, n, y0: cm[0], d: deltas };
  const idx = geo.index.array;
  // Výjimečná dlaždice s místním dělením sítě (napojení mostovky na břeh)
  if (ci === world.bankTerrainTile) out.idx = Int32Array.from(idx);
  return out;
}

// ------------------------------------------------------------------ povrch země (paleta barev)
const palette = ['#000000'];          // 0 = voda
const paletteIndex = new Map([['water', 0]]);
function colorIndex(hex) {
  const key = hex.toLowerCase().slice(0, 7);
  if (!paletteIndex.has(key)) { paletteIndex.set(key, palette.length); palette.push(key); }
  return paletteIndex.get(key);
}
// Hustota zástavby jako podklad (zjednodušená obdoba buildDensity, buňky 32 m)
const DENSITY_CELL = 32;
const dCols = Math.ceil((world.maxX - world.minX) / DENSITY_CELL), dRows = Math.ceil((world.maxZ - world.minZ) / DENSITY_CELL);
const density = new Float32Array(dCols * dRows);
for (let i = 0; i < world.bCount; i++) {
  const w = world.bMaxX[i] - world.bMinX[i], d = world.bMaxZ[i] - world.bMinZ[i];
  const area = w * d;
  if (area < 40) continue;
  const work = world.b.kind[i] === BK.INDUSTRIAL || world.b.kind[i] === BK.COMMERCIAL;
  const alpha = Math.min(work ? 0.46 : 0.23, 0.08 + area / 3200);
  const cx = (world.bMinX[i] + world.bMaxX[i]) / 2, cz = (world.bMinZ[i] + world.bMaxZ[i]) / 2;
  const r = 26 + Math.sqrt(area) * 0.6;
  const a0 = Math.max(0, Math.floor((cx - r - world.minX) / DENSITY_CELL)), a1 = Math.min(dCols - 1, Math.floor((cx + r - world.minX) / DENSITY_CELL));
  const b0 = Math.max(0, Math.floor((cz - r - world.minZ) / DENSITY_CELL)), b1 = Math.min(dRows - 1, Math.floor((cz + r - world.minZ) / DENSITY_CELL));
  for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) {
    const px = world.minX + (a + 0.5) * DENSITY_CELL, pz = world.minZ + (b + 0.5) * DENSITY_CELL;
    if ((px - cx) ** 2 + (pz - cz) ** 2 > r * r) continue;
    const k = b * dCols + a;
    density[k] += (1 - density[k]) * alpha;
  }
}
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
const ORTHO_LAND = new Set([LC.FARMLAND, LC.MEADOW, LC.GRASS, LC.SCRUB]);
const DENSITY_LEVELS = [0, 1, 2, 3, 4, 5].map((l) => colorIndex(mixHex('#9aa873', '#aca78d', l / 5)));

function exportGround(ci, x0, z0) {
  const S = GROUND_PX, k = S / CHUNK;
  const px = new Uint8Array(S * S);
  // podklad podle hustoty zástavby
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const wx = x0 + (i + 0.5) / k, wz = z0 + (j + 0.5) / k;
    const a = Math.min(dCols - 1, Math.max(0, Math.floor((wx - world.minX) / DENSITY_CELL)));
    const b = Math.min(dRows - 1, Math.max(0, Math.floor((wz - world.minZ) / DENSITY_CELL)));
    px[j * S + i] = DENSITY_LEVELS[Math.min(5, Math.round(density[b * dCols + a] * 5))];
  }
  const L = world.l;
  const toPx = (x, z) => [(x - x0) * k, (z - z0) * k];
  const rings = (i) => {
    const out = [];
    for (let rg = L.pRing[i], r1 = L.pRing[i + 1]; rg < r1; rg++) {
      const ring = [];
      for (let v = L.ringStart[rg]; v < L.ringStart[rg + 1]; v++) ring.push(...toPx(L.vx[v] * 0.1, L.vz[v] * 0.1));
      out.push(ring);
    }
    return out;
  };
  const polys = landIndex.polys[ci];
  if (polys) {
    for (let group = 0; group < 3; group++) {
      for (const i of polys) {
        const cls = L.cls[i];
        if (ch.LAND_GROUP[cls] !== group) continue;
        const context = landIndex.polyContext[i];
        const field = landIndex.fields.get(i);
        let color = ch.LAND_HEX[cls];
        if (field) color = field.color;
        else if (cls === LC.MEADOW) color = ch.pick(ch.MEADOW_COLORS, hash(i, 20));
        else if (cls === LC.FOREST) color = ch.pick(ch.FOREST_COLORS, hash(i, 20));
        else if (cls === LC.PLAZA && context === 2) color = '#b9ae9c';
        else if (cls === LC.RESIDENTIAL && context < 2) color = context ? '#a6aa92' : '#a2ae85';
        // Otevřená krajina (pole, louky, tráva, křoviny) dostane příznak 0x80: ve hře se na ni
        // kreslí letecký snímek (ORTHOPHOTO_LAND a drawGround v předloze, jen uvnitř hrací plochy).
        const ortho = ORTHO_LAND.has(cls) && x0 + CHUNK > world.playMinX && x0 < world.playMaxX &&
          z0 + CHUNK > world.playMinZ && z0 < world.playMaxZ;
        fillRings(px, S, S, rings(i), colorIndex(color) | (ortho ? 0x80 : 0));
      }
    }
    // břehy vod
    for (const i of polys) {
      if (L.cls[i] !== LC.WATER) continue;
      const urban = landIndex.polyContext[i] === 2;
      const value = colorIndex(urban ? '#8e8776' : '#657c43');
      for (const ring of rings(i)) strokeLine(px, S, S, [...ring, ring[0], ring[1]], 3 * k, value);
    }
  }
  // potoky
  const lines = landIndex.lines[ci];
  if (lines) {
    for (const i of lines) {
      const cls = L.lCls[i];
      const width = cls === 0 ? 8 : cls === 1 ? 5 : cls === 2 ? 2.2 : 1.2;
      const pts = [];
      for (let v = L.lStart[i]; v < L.lStart[i + 1]; v++) pts.push(...toPx(L.lx[v] * 0.1, L.lz[v] * 0.1));
      strokeLine(px, S, S, pts, (width + 4) * k, colorIndex(landIndex.lineContext[i] === 2 ? '#818071' : '#607344'));
      strokeLine(px, S, S, pts, width * k, colorIndex(ch.HEX.stream));
    }
  }
  const cxi = ci % world.cols, czi = Math.floor(ci / world.cols);
  const near = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const a = cxi + dx, b = czi + dz;
    if (a >= 0 && b >= 0 && a < world.cols && b < world.rows) near.push(b * world.cols + a);
  }
  // štěrkové lože železnice
  const ballast = colorIndex(ch.HEX.ballast);
  for (const c of near) for (const ri of world.railChunks[c] ?? []) {
    const r = world.rails[ri];
    if (r.cls !== 1 || r.y) continue;
    const pts = [];
    for (let q = 0; q < r.pts.length; q += 2) pts.push(...toPx(r.pts[q], r.pts[q + 1]));
    strokeLine(px, S, S, pts, 3.4 * k, ballast);
  }
  const R = world.r, rpx = world.rpx, rpz = world.rpz;
  for (let pass = 0; pass < 3; pass++) {
    for (const c of near) {
      const pieces = world.rPieces[c];
      if (!pieces) continue;
      for (let q = 0; q < pieces.length; q += 3) {
        const i = pieces[q], cls = R.cls[i], flags = R.flags[i];
        if ((flags & RF.BRIDGE) || world.tunnelRoads.has(i)) continue;
        let width, style;
        if (pass === 0) {
          if (cls < RC.PRIMARY || cls > RC.LIVING || cls === RC.PRIMARY_LINK || cls === RC.SECONDARY_LINK || (flags & RF.TUNNEL)) continue;
          const verge = roadVerge[i];
          width = R.w[i] + (verge ? 4 : 3);
          style = verge === 2 ? '#a8a399' : verge ? ch.HEX.sidewalk : '#92947b';
        } else if (pass === 1) {
          if (cls <= RC.PEDESTRIAN) continue;
          width = R.w[i]; style = ch.roadHex(cls);
        } else {
          if (cls > RC.PEDESTRIAN) continue;
          width = Math.max(1.5, R.w[i] - 1.2); style = ch.roadHex(cls);
        }
        const pts = [];
        for (let p = pieces[q + 1]; p <= pieces[q + 2]; p++) pts.push(...toPx(rpx[p], rpz[p]));
        strokeLine(px, S, S, pts, width * k, colorIndex(style));
      }
    }
  }
  // voda
  if (polys) for (const i of polys) if (L.cls[i] === LC.WATER) fillRings(px, S, S, rings(i), 0);
  return { s: S, px };
}

// ------------------------------------------------------------------ silnice a mosty
class Recorder {
  constructor() { this.rib = []; this.dash = []; this.x = []; this.z = []; this.y = []; }
  _path(D) {
    const start = this.x.length;
    for (let k = 0; k < D.n; k++) { this.x.push(D.x[k]); this.z.push(D.z[k]); this.y.push(D.y ? D.y[k] : 0); }
    return start;
  }
  ribbon(buf, D, hw, col, lateral = 0, lift = 0, capStart = false, capEnd = false, center = false) {
    if (!D.n) return;
    const start = this._path(D);
    const flags = (capStart ? 1 : 0) | (capEnd ? 2 : 0) | (center ? 4 : 0) | (D.y ? 8 : 0);
    const nan = (v) => (v === v ? v : 1e30);
    this.rib.push(buf.__layer === 'marks' ? 1 : 0, hw, col[0], col[1], col[2], lateral, lift, flags,
      nan(D.px), nan(D.pz), nan(D.nx), nan(D.nz), start, D.n, 0, 0);
  }
  dashes(buf, D, hw, col, dash, gap, lateral, lift) {
    if (!D.n) return;
    const start = this._path(D);
    this.dash.push(buf.__layer === 'marks' ? 1 : 0, hw, col[0], col[1], col[2], dash, gap, lateral, lift,
      D.y ? 1 : 0, start, D.n, 0, 0, 0, 0);
  }
}

// Godot má přední stěnu trojúhelníku po směru hodinových ručiček, three.js proti směru.
function flipIndices(index) {
  const out = Int32Array.from(index);
  for (let k = 0; k + 2 < out.length; k += 3) { const t = out[k + 1]; out[k + 1] = out[k + 2]; out[k + 2] = t; }
  return out;
}
function flipTriangles(values, stride) {
  const out = Float32Array.from(values);
  for (let t = 0; t + 3 * stride <= out.length; t += 3 * stride) {
    for (let c = 0; c < stride; c++) {
      const a = out[t + stride + c]; out[t + stride + c] = out[t + 2 * stride + c]; out[t + 2 * stride + c] = a;
    }
  }
  return out;
}

function decalArrays(geo) {
  if (!geo) return null;
  return { p: new Vec3Array(geo.attributes.position.array),
    c: new ColorArray(Float32Array.from(geo.attributes.color.array, (v) => v / 255)),
    i: flipIndices(geo.index.array) };
}

function exportRoads(ci) {
  const rec = new Recorder();
  globalThis.__plzRecorder = rec;
  let roads;
  try { roads = ch.buildRoads(world, ci, manager); } finally { globalThis.__plzRecorder = null; }
  const out = {};
  if (rec.rib.length || rec.dash.length) {
    out.rib = f32(rec.rib); out.dash = f32(rec.dash);
    out.x = f32(rec.x); out.z = f32(rec.z); out.y = f32(rec.y);
  }
  const marks = decalArrays(roads.marks), asphalt = decalArrays(roads.asphalt);
  if (marks) { out.mp = marks.p; out.mc = marks.c; out.mi = marks.i; }
  if (asphalt) { out.ap = asphalt.p; out.ac = asphalt.c; out.ai = asphalt.i; }
  if (roads.solid) {
    out.sp = new Vec3Array(flipTriangles(roads.solid.attributes.position.array, 3));
    out.sc = new ColorArray(flipTriangles(Float32Array.from(roads.solid.attributes.color.array, (v) => Math.min(1, v)), 3));
  }
  return Object.keys(out).length ? out : null;
}

// ------------------------------------------------------------------ budovy
const ROOF = { FLAT: 0, GABLE: 1, RIDGE: 2, INSET: 3 };
const TREE_SPLIT = 220;       // listnatý strom 276 vrcholů, jehličnan 162

function ridgeParams(vx, vz, s, n, flags) {
  let bestA = 1e18, ux = 1, uz = 0, u0 = 0, u1 = 0, w0 = 0, w1 = 0;
  for (let a = 0; a < n; a++) {
    const b = (a + 1) % n;
    let dx = vx[s + b] - vx[s + a], dz = vz[s + b] - vz[s + a];
    const l = Math.hypot(dx, dz);
    if (l < 0.3) continue;
    dx /= l; dz /= l;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let q = 0; q < n; q++) {
      const u = vx[s + q] * dx + vz[s + q] * dz, w = -vx[s + q] * dz + vz[s + q] * dx;
      if (u < a0) a0 = u; if (u > a1) a1 = u; if (w < b0) b0 = w; if (w > b1) b1 = w;
    }
    const area = (a1 - a0) * (b1 - b0);
    if (area < bestA) {
      bestA = area;
      if (a1 - a0 >= b1 - b0) { ux = dx; uz = dz; u0 = a0; u1 = a1; w0 = b0; w1 = b1; }
      else { ux = -dz; uz = dx; u0 = b0; u1 = b1; w0 = -a1; w1 = -a0; }
    }
  }
  const len = u1 - u0, wid = w1 - w0;
  const hip = (flags & BF.PYRAMID) ? 1e9 : (flags & BF.NO_HIP) ? 0.02 : 0.5;
  const half = Math.max(0, len / 2 - Math.min(len / 2, wid * hip));
  return [ux, uz, (u0 + u1) / 2, (w0 + w1) / 2, half];
}

function exportBuildings(ci, includeReplaced) {
  const B = world.b, vx = world.bvx, vz = world.bvz;
  const nums = [], ints = [], X = [], Z = [], off = [], extra = [], tris = [];
  for (const i of buildingsIn(ci)) {
    const flags = B.flags[i];
    if (flags & BF.HAS_PARTS) continue;
    const isReplaced = replaced.has(i);
    if (isReplaced && !includeReplaced) continue;
    const st = ch.styleFor(world, i, districts.at((world.bMinX[i] + world.bMaxX[i]) / 2, (world.bMinZ[i] + world.bMaxZ[i]) / 2));
    const kind = B.kind[i];
    const top = world.bTop[i];
    const gable = (flags & BF.GABLE) !== 0;
    const r0 = B.bRing[i], r1 = B.bRing[i + 1];
    const s0 = B.ringStart[r0];
    const nOuter = B.ringStart[r0 + 1] - s0;
    const ridge = (flags & BF.RIDGE) !== 0 && r1 - r0 === 1 && nOuter >= 3;
    const inset = (flags & BF.INSET) && B.roofInset && r1 - r0 === 1 && nOuter >= 3
      ? ch.insetRing(vx, vz, s0, nOuter, B.roofInset[i] * 0.1) : null;
    const wallTop = gable || ridge || inset ? world.bWall[i] : top;
    let base = world.bBase[i];
    if (kind === BK.ROOF) base = Math.max(base, top - 0.35);
    const ground = kind === BK.ROOF || B.hMin[i] > 0 ? base : world.bGround[i];
    let roof = ROOF.FLAT;
    if (gable && nOuter === 4 && r1 - r0 === 1) roof = ROOF.GABLE;
    else if (ridge) roof = ROOF.RIDGE;
    else if (inset) roof = ROOF.INSET;
    const vStart = X.length;
    const ringSizes = [];
    for (let rg = r0; rg < r1; rg++) {
      const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
      ringSizes.push(v1 - v0);
      for (let v = v0; v < v1; v++) { X.push(vx[v]); Z.push(vz[v]); off.push(Math.floor(hash(v, 3) * 50)); }
    }
    const exStart = extra.length;
    if (roof === ROOF.RIDGE) extra.push(...ridgeParams(vx, vz, s0, nOuter, flags));
    const triStart = tris.length;
    if (roof === ROOF.INSET) {
      extra.push(...inset);
      const t = Earcut.triangulate(inset, null, 2);
      for (let q = 0; q < t.length; q += 3) {
        const a = t[q], b = t[q + 1], c = t[q + 2];
        const ny = (inset[b * 2 + 1] - inset[a * 2 + 1]) * (inset[c * 2] - inset[a * 2]) - (inset[b * 2] - inset[a * 2]) * (inset[c * 2 + 1] - inset[a * 2 + 1]);
        if (ny >= 0) tris.push(a, b, c); else tris.push(a, c, b);
      }
    } else if (roof === ROOF.FLAT) {
      const flat = [], holes = [];
      let count = 0;
      for (const size of ringSizes) { if (count) holes.push(count); count += size; }
      for (let v = vStart; v < X.length; v++) flat.push(X[v], Z[v]);
      const t = Earcut.triangulate(flat, holes, 2);
      for (let q = 0; q < t.length; q += 3) {
        const a = t[q], b = t[q + 1], c = t[q + 2];
        const ny = (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]) - (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]);
        if (ny >= 0) tris.push(a, b, c); else tris.push(a, c, b);
      }
    }
    nums.push(base, wallTop, top, ground, st.wall[0], st.wall[1], st.wall[2], st.roof[0], st.roof[1], st.roof[2], st.floorH, st.bay);
    // [počet kruhů, první vrchol, styl oken, druh, příznaky, střecha, první doplněk, první trojúhelník, počet indexů, číslo budovy, nahrazená]
    ints.push(r1 - r0, vStart, st.style, kind, flags, roof, exStart, triStart, tris.length - triStart, i, isReplaced ? 1 : 0);
    for (const size of ringSizes) ints.push(size);
  }
  if (!nums.length) return null;
  return { b: f32(nums), bi: Int32Array.from(ints), x: f32(X), z: f32(Z), off: Uint8Array.from(off),
    ex: f32(extra), t: Int32Array.from(tris) };
}

// ------------------------------------------------------------------ stromy a lampy
function exportTrees(ci, x0, z0) {
  const forest = landIndex.polys[ci]?.filter((i) => world.l.cls[i] === LC.FOREST) ?? [];
  const trees = ch.buildTrees(world, ci, x0, z0, forest, []);
  // Na strom 8 bajtů: x a z v centimetrech od rohu dlaždice, velikost, protažení, natočení, druh.
  // Výšku paty dopočítá Godot z terénu (stejně jako původní heightAt).
  const pos = [], attrs = [];
  for (const mesh of trees.meshes) {
    const arr = mesh.instanceMatrix.array;
    const kind = mesh.geometry.attributes.position.count < TREE_SPLIT ? 1 : 0;
    for (let k = 0; k < mesh.count; k++) {
      const e = arr.subarray(k * 16, k * 16 + 16);
      const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]);
      let rot = Math.atan2(-e[8], e[10]);
      if (rot < 0) rot += Math.PI * 2;
      const lx = Math.round((e[12] - x0) * 100), lz = Math.round((e[14] - z0) * 100);
      if (lx < 0 || lz < 0 || lx > 65535 || lz > 65535) continue;
      pos.push(lx, lz);
      attrs.push(Math.round(Math.min(2.55, sx) * 100), Math.round(Math.min(2.55, sy / sx) * 100),
        Math.round(rot / (Math.PI * 2) * 255) % 256, kind);
    }
  }
  return pos.length ? { p: Uint16Array.from(pos), a: Uint8Array.from(attrs) } : null;
}

function exportLamps(ci) {
  const lamps = world.lampsInTile(ci);
  if (!lamps.length) return null;
  const out = [];
  for (const l of lamps) out.push(l.x, l.y, l.z, l.height, l.head, l.lightX, l.lightZ, l.radius);
  return { l: f32(out) };
}

// ------------------------------------------------------------------ osy ulic
// Úseky silnic a cest v dlaždici: číslo silnice, název, třída, šířka, příznaky, pruhy, rychlost
// a body osy (x, z, výška povrchu). Slouží k názvům ulic, navigaci a dopravě.
function exportStreets(ci) {
  const pieces = world.rPieces[ci];
  if (!pieces) return null;
  const R = world.r, ints = [], pts = [];
  for (let q = 0; q < pieces.length; q += 3) {
    const i = pieces[q], s = pieces[q + 1], e = pieces[q + 2];
    ints.push(i, R.name[i], R.cls[i], R.flags[i], R.lanes[i], R.speed[i], R.layer[i], pts.length / 3, e - s + 1);
    for (let k = s; k <= e; k++) {
      const x = world.rpx[k], z = world.rpz[k];
      pts.push(x, world.groundY(x, z, world.rpy[k] + 0.5), z);
    }
  }
  const widths = [];
  for (let q = 0; q < pieces.length; q += 3) widths.push(R.w[pieces[q]]);
  return { u: Int32Array.from(ints), w: f32(widths), p: new Vec3Array(pts) };
}

// ------------------------------------------------------------------ městský model centra
// Zaměřené budovy (data města Plzně 2024) po dlaždicích; heritage.js je kreslí místo budov z OSM.
async function exportCity(ci) {
  const cell = heritageCells.get(ci);
  if (!cell) return null;
  const pack = await loadCityTile(cell.name);
  const { cx, cz } = pack.header;
  const out = {};
  for (const prefix of ['', 'd']) {
    const src = pack[prefix + 'p'];
    if (!src?.length) continue;
    const pos = new Float32Array(src.length);
    for (let i = 0; i < src.length; i += 3) {
      pos[i] = cx + src[i] * 0.02; pos[i + 1] = src[i + 1] * 0.02; pos[i + 2] = cz + src[i + 2] * 0.02;
    }
    const nrm = Float32Array.from(pack[prefix + 'n'], (v) => Math.max(-1, v / 127));
    const col = Float32Array.from(pack[prefix + 'c'], (v) => v / 255);
    out[prefix + 'p'] = new Vec3Array(pos);
    out[prefix + 'n'] = new Vec3Array(nrm);
    out[prefix + 'c'] = new ColorArray(col);
    out[prefix + 'i'] = flipIndices(pack[prefix + 'i']);
    if (!prefix && pack.win) out.win = Float32Array.from(pack.win, (v, i) => (i % 3 === 2 ? v : v / 32));
  }
  return Object.keys(out).length ? out : null;
}

// Zaměřené stavební konstrukce (zdi, pilíře, jezy, mosty) jako trojúhelníky.
function exportStructures(ci) {
  const positions = world.structures?.positionsFor(ci);
  return positions?.length ? { p: new Vec3Array(flipTriangles(positions, 3)) } : null;
}

// ------------------------------------------------------------------ mapa celého území
const MAPA_SIRKA = 4096;
const mapaKrok = (world.maxX - world.minX) / MAPA_SIRKA;
const MAPA_VYSKA = Math.ceil((world.maxZ - world.minZ) / mapaKrok);
const mapa = new Uint8Array(MAPA_SIRKA * MAPA_VYSKA * 3);
const paletteRgb = () => palette.map((hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)));
const WATER_RGB = [87, 121, 130];
function mapaZDlazdice(ci, x0, z0, ground) {
  const rgb = paletteRgb();
  const S = ground.s, k = S / CHUNK;
  const m0 = Math.max(0, Math.floor((x0 - world.minX) / mapaKrok)), m1 = Math.min(MAPA_SIRKA - 1, Math.ceil((x0 + CHUNK - world.minX) / mapaKrok));
  const n0 = Math.max(0, Math.floor((z0 - world.minZ) / mapaKrok)), n1 = Math.min(MAPA_VYSKA - 1, Math.ceil((z0 + CHUNK - world.minZ) / mapaKrok));
  for (let n = n0; n <= n1; n++) for (let m = m0; m <= m1; m++) {
    const wx = world.minX + (m + 0.5) * mapaKrok, wz = world.minZ + (n + 0.5) * mapaKrok;
    if (wx < x0 || wx >= x0 + CHUNK || wz < z0 || wz >= z0 + CHUNK) continue;
    let r = 0, g = 0, b = 0, cnt = 0;
    const i0 = Math.floor((wx - x0 - mapaKrok / 2) * k), j0 = Math.floor((wz - z0 - mapaKrok / 2) * k);
    const kroku = Math.max(1, Math.round(mapaKrok * k));
    for (let j = j0; j < j0 + kroku; j += 2) for (let i = i0; i < i0 + kroku; i += 2) {
      if (i < 0 || j < 0 || i >= S || j >= S) continue;
      const v = ground.px[j * S + i] & 0x7f, c = v === 0 ? WATER_RGB : rgb[v];
      r += c[0]; g += c[1]; b += c[2]; cnt++;
    }
    if (!cnt) continue;
    const o = (n * MAPA_SIRKA + m) * 3;
    mapa[o] = r / cnt; mapa[o + 1] = g / cnt; mapa[o + 2] = b / cnt;
  }
}
function pngRgb(w, h, rgb) {
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'ascii'), len = Buffer.alloc(4), c = Buffer.alloc(4);
    len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 1;     // filtr Sub
    for (let x = 0; x < w * 3; x++) {
      const v = rgb[y * w * 3 + x], left = x >= 3 ? rgb[y * w * 3 + x - 3] : 0;
      raw[y * (w * 3 + 1) + 1 + x] = (v - left) & 255;
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ------------------------------------------------------------------ zápis
class Pack {
  constructor(name) { this.name = name; this.blobs = new Array(world.cols * world.rows).fill(null); this.raw = 0; }
  set(ci, value) {
    if (!value) return;
    const bytes = encodeVariant(value);
    this.raw += bytes.length;
    this.blobs[ci] = deflateSync(bytes, { level: 9 });
  }
  async write() {
    const count = this.blobs.length;
    const header = Buffer.alloc(16 + (count + 1) * 4);
    header.write('PLZG', 0, 'ascii');
    header.writeUInt32LE(FORMAT, 4);
    header.writeUInt32LE(count, 8);
    header.writeUInt32LE(0, 12);
    let offset = 0;
    for (let i = 0; i < count; i++) {
      header.writeUInt32LE(offset, 16 + i * 4);
      offset += this.blobs[i]?.length ?? 0;
    }
    header.writeUInt32LE(offset, 16 + count * 4);
    const body = Buffer.concat(this.blobs.filter(Boolean));
    const file = path.join(OUT, this.name + '.pak');
    await writeFile(file + '.tmp', Buffer.concat([header, body]));
    await rename(file + '.tmp', file);
    return { name: this.name, bytes: header.length + body.length, raw: this.raw,
      sha256: createHash('sha256').update(header).update(body).digest('hex') };
  }
}

await mkdir(OUT, { recursive: true });
const packs = { teren: new Pack('teren'), povrch: new Pack('povrch'), silnice: new Pack('silnice'),
  budovy: new Pack('budovy'), stromy: new Pack('stromy'), lampy: new Pack('lampy'), ulice: new Pack('ulice'),
  mesto: new Pack('mesto'), konstrukce: new Pack('konstrukce') };
const tiles = [];
const t1 = performance.now();
for (let ci = 0; ci < (onlyLists ? 0 : world.cols * world.rows); ci++) {
  const [x0, z0] = tileOrigin(ci);
  if (areaArg && (x0 + CHUNK < areaArg[0] || x0 > areaArg[2] || z0 + CHUNK < areaArg[1] || z0 > areaArg[3])) continue;
  tiles.push(ci);
  packs.teren.set(ci, exportTerrain(ci, x0, z0));
  const ground = exportGround(ci, x0, z0);
  packs.povrch.set(ci, ground);
  mapaZDlazdice(ci, x0, z0, ground);
  packs.mesto.set(ci, await exportCity(ci));
  packs.konstrukce.set(ci, exportStructures(ci));
  packs.silnice.set(ci, exportRoads(ci));
  packs.budovy.set(ci, exportBuildings(ci, true));
  packs.stromy.set(ci, exportTrees(ci, x0, z0));
  packs.lampy.set(ci, exportLamps(ci));
  packs.ulice.set(ci, exportStreets(ci));
  if (tiles.length % 500 === 0) console.log(`  ${tiles.length} dlaždic, ${((performance.now() - t1) / 1000).toFixed(0)} s`);
}

let commit = 'neznámý';
try { commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { /* mimo git */ }
const files = [];
if (!onlyLists) {
  for (const pack of Object.values(packs)) files.push(await pack.write());
  await writeFile(path.join(OUT, 'mapa.png'), pngRgb(MAPA_SIRKA, MAPA_VYSKA, mapa));
  // Tunel Valík: tubusy, portály a světla (buildTunnel v předloze), ve světových souřadnicích.
  const tunely = world.tunnels.map((tunnel) => {
    const geo = ch.buildTunnel(world, tunnel);
    const portaly = tunnel.portals.map((pp) => [pp.x, pp.y, pp.z, pp.dx, pp.dz]);
    return { pevne: new Vec3Array(flipTriangles(geo.solid.attributes.position.array, 3)),
      barvy: new ColorArray(flipTriangles(geo.solid.attributes.color.array, 3)),
      svetla: new Vec3Array(flipTriangles(geo.lights.attributes.position.array, 3)),
      portaly, polosirka: tunnel.halfWidth, silnice: tunnel.road };
  });
  await writeFile(path.join(OUT, 'tunely.bin'), deflateSync(encodeVariant(tunely), { level: 9 }));
}

const meta = data.meta;
const svet = {
  format: FORMAT,
  zdroj: { commit, osm: meta.osmTimestamp, popis: 'Převedeno z public/ nástrojem tools/godot/export_svet.mjs' },
  dlazdice: CHUNK, sloupce: world.cols, radky: world.rows, minX: world.minX, minZ: world.minZ,
  hraniceHry: meta.bounds, pocatek: meta.origin, nadmorskaVyska: meta.baseElevation, povrchNad: SURF,
  povrchPx: GROUND_PX, paleta: palette, oblast: areaArg, pocetDlazdic: tiles.length,
  mapa: { soubor: 'mapa.png', sirka: MAPA_SIRKA, vyska: MAPA_VYSKA, krok: mapaKrok, x0: world.minX, z0: world.minZ },
  soubory: files,
};
if (!onlyLists) await writeFile(path.join(OUT, 'svet.json'), JSON.stringify(svet, null, 1) + '\n');
await writeFile(path.join(OUT, 'nazvy-ulic.json'), JSON.stringify(meta.roadNames) + '\n');
// Pojmenovaná místa: obce a čtvrti, památky k objevení, podniky, adresy a služby.
const mista = {
  obce: meta.places.map(([x, z, name, kind]) => ({ x, z, nazev: name, druh: kind })),
  pamatky: meta.landmarks.map(([x, z, name], index) => ({ index, id: 'pamatka-' + index, x, z, nazev: name,
    popis: LANDMARK_INFO[name] ?? '', y: Math.round(world.groundY(x, z) * 100) / 100, smer: 0 })),
  podniky: meta.food.map(([x, z, kind, name, street]) => ({ x, z, druh: kind, nazev: name, ulice: street })),
  sluzby: meta.services.map(([x, z, kind, name]) => ({ x, z, druh: kind, nazev: name })),
  adresy: meta.addresses.map(([x, z, street, number]) => [x, z, street, number]),
  pesiPristupy: meta.walkingApproaches,
};
await writeFile(path.join(OUT, 'mista.json'), JSON.stringify(mista) + '\n');
// Stanoviště MHD z jízdního řádu PMDP (GTFS): číslo, název, poloha a směr nejbližší silnice nebo koleje.
const timetable = await readJson('data/timetable.json');
const zastavky = timetable.stops.map(([name, x, z, id], index) => {
  const road = world.nearestRoad(x, z, 25, DRIVABLE_MAX, 0, {});
  return { index, id, nazev: name, x, z, y: Math.round(world.groundY(x, z) * 100) / 100,
    smer: road ? Math.round(Math.atan2(road.dx, road.dz) * 1000) / 1000 : 0 };
});
await writeFile(path.join(OUT, 'zastavky.json'), JSON.stringify(zastavky, null, 0) + '\n');

// Jízdní řád MHD pro Godot: trasy s výškovým profilem po 10 m (povrch včetně mostů),
// zastávky, vzory zastavení, spoje a kalendář. Formát odpovídá src/game/timetable.js.
const PROFIL_KROK = 10;
const mhdRoutes = timetable.routes.map((r) => {
  const path = r.path, cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const length = cum.at(-1), heights = [];
  let seg = 0, prev = world.heightAt(path[0][0], path[0][1]) + 1;
  for (let sDist = 0; sDist <= length + PROFIL_KROK; sDist += PROFIL_KROK) {
    const q = Math.min(sDist, length);
    while (seg < path.length - 2 && cum[seg + 1] < q) seg++;
    const l = cum[seg + 1] - cum[seg] || 1, t = (q - cum[seg]) / l;
    const x = path[seg][0] + (path[seg + 1][0] - path[seg][0]) * t, z = path[seg][1] + (path[seg + 1][1] - path[seg][1]) * t;
    const y = world.groundY(x, z, prev + 1.5);
    heights.push(Math.round(y * 100));
    prev = y;
  }
  return { typ: r.type, linka: r.ref, odkud: r.from, kam: r.to, delka: r.length,
    body: Float32Array.from(path.flat()), zastavky: r.stops.map(([sDist, name]) => [sDist, name]),
    vysky: Int32Array.from(heights) };
});
const mhd = {
  verze: 1, krok: PROFIL_KROK, kalendar: timetable.calendar, trasy: mhdRoutes,
  stanoviste: timetable.stops.map(([name, x, z, code]) => [name, x, z, code ?? '']),
  vzory: timetable.patterns.map(([ri, stops, destination, direction, entry, exit]) =>
    [ri, Int32Array.from(stops.flat()), destination, String(direction), Boolean(entry), Boolean(exit)]),
  spoje: timetable.trips.map(([id, service, pattern, values]) => [String(id), service, pattern, Int32Array.from(values)]),
  prestupy: timetable.transfers.map((t) => Int32Array.from(t)),
  zdroj: timetable.source,
};
await writeFile(path.join(OUT, 'mhd.bin'), deflateSync(encodeVariant(mhd), { level: 9 }));

// Hlášení zastávek (syntetický hlas Piper, viz public/audio/zdroje.txt) se kopírují beze změny.
const ZVUK = path.join(ROOT, 'godot/data/zvuk');
await mkdir(ZVUK, { recursive: true });
for (const f of await readdir(path.join(ROOT, 'public/audio'))) await copyFile(path.join(ROOT, 'public/audio', f), path.join(ZVUK, f));

// Letecké snímky otevřené krajiny (Ortofoto ČR © ČÚZK, CC BY 4.0): bloky 1 024 m ve 2 m na pixel
// se kopírují beze změny. Soubor .import „keep“ je nechá v exportu jako obyčejné soubory, hra je
// dekóduje sama až u hráče (Image.load_webp_from_buffer).
const ORTO = path.join(ROOT, 'godot/data/ortofoto');
await mkdir(ORTO, { recursive: true });
for (const f of await readdir(path.join(ROOT, 'public/detail/orthophoto'))) {
  await copyFile(path.join(ROOT, 'public/detail/orthophoto', f), path.join(ORTO, f));
  if (f.endsWith('.webp')) await writeFile(path.join(ORTO, f + '.import'), '[remap]\n\nimporter="keep"\n');
}

// Silniční graf pro navigaci, zakázky a dopravu (World._initGraph v předloze):
// uzly, orientované hrany mezi body silnic, výstupní hrany uzlů a vlastnosti silnic.
const R = world.r;
const graf = {
  verze: 1,
  uzelX: Float32Array.from(world.nodeX), uzelZ: Float32Array.from(world.nodeZ),
  hOd: Int32Array.from(world.eFrom), hDo: Int32Array.from(world.eTo),
  hA: Int32Array.from(world.eA), hB: Int32Array.from(world.eB),
  hDelka: Float32Array.from(world.eLen), hSilnice: Int32Array.from(world.eRoad),
  vystupZac: Int32Array.from(world.outStart), vystupHrany: Int32Array.from(world.outEdges),
  bodX: Float32Array.from(world.rpx), bodZ: Float32Array.from(world.rpz), bodY: Float32Array.from(world.rpy),
  silniceZac: Int32Array.from(world.rOff),
  trida: Uint8Array.from(R.cls), priznaky: Uint8Array.from(R.flags), sirka: Float32Array.from(R.w),
  pruhy: Uint8Array.from(R.lanes), nazev: Int32Array.from(R.name),
  rychlostVpred: Uint8Array.from(R.speedForward ?? R.speed), rychlostVzad: Uint8Array.from(R.speedBackward ?? R.speed),
  limitVpred: Uint8Array.from(R.limitForward ?? []), limitVzad: Uint8Array.from(R.limitBackward ?? []),
};
await writeFile(path.join(OUT, 'graf.bin'), deflateSync(encodeVariant(graf), { level: 9 }));

// Řízení dopravy z předlohy (src/game/traffic.js): skupiny semaforů s časováním, pravidla na
// hranách (semafor, stopka, dej přednost), přechody a viditelná návěstidla a značky po dlaždicích.
const T = world.traffic;
const skupinaIndex = new Map(T.groups.map((g, i) => [g, i]));
const DRUH = { signal: 0, stop: 1, yield: 2 };
const pravidla = [];
for (const [edge, controls] of T.byEdge) {
  for (const c of controls) {
    if (!(c.kind in DRUH)) continue;
    pravidla.push(edge, Math.round(c.s * 100), DRUH[c.kind], c.group ? skupinaIndex.get(c.group) : -1, c.axis ?? 0);
  }
}
const prechody = [];
for (const c of T.crossings) prechody.push(c.x, c.z, c.dx, c.dz, c.length, c.group ? skupinaIndex.get(c.group) : -1);
const hlavy = [], znacky = [];
const ZNACKA = { stop: 1, yield: 2, noEntry: 3, oneway: 4, speed: 5 };
for (const entries of T.chunks.values()) {
  for (const h of entries.heads) {
    hlavy.push(h.x, world.groundY(h.x, h.z), h.z, h.tx, h.tz, h.axis ?? 0, h.group ? skupinaIndex.get(h.group) : -1, h.kind === 'pedestrian' ? 1 : 0);
  }
  for (const z of entries.signs) {
    znacky.push(z.x, world.groundY(z.x, z.z), z.z, z.tx ?? 0, z.tz ?? 1, ZNACKA[z.kind] ?? 0);
  }
}
const doprava = {
  verze: 1,
  skupiny: T.groups.map((g) => [g.greenTime, g.hasSecond ? 1 : 0, g.timeOffset, g.clearance, g.crossings.length, g.x, g.z]),
  pravidla: Int32Array.from(pravidla), prechody: f32(prechody), hlavy: f32(hlavy), znacky: f32(znacky),
};
await writeFile(path.join(OUT, 'doprava.bin'), deflateSync(encodeVariant(doprava), { level: 9 }));
console.log(`Doprava: ${T.groups.length} skupin semaforů, ${pravidla.length / 5} pravidel, ${T.crossings.length} přechodů, ${hlavy.length / 8} návěstidel, ${znacky.length / 6} značek`);
console.log(`Hotovo za ${((performance.now() - t0) / 1000).toFixed(0)} s, ${tiles.length} dlaždic`);
for (const f of files) console.log(`  ${f.name}.pak ${(f.bytes / 1e6).toFixed(2)} MB (nekomprimováno ${(f.raw / 1e6).toFixed(1)} MB)`);
