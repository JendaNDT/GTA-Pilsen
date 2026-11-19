import { attachRoadFurniture } from './road-furniture.js';
import { prazdrojThickness } from './prazdroj-bridge.js';
import { BRIDGE_THICKNESS, densePath, pathNormal } from './road-profile.js';
// Stavba 3D geometrie po dlaždicích: budovy, silnice, koleje, stromy.
import * as THREE from 'three/webgpu';
import { hash } from './hash.js';
import { railingFaces } from '../physics/railings.js';
import { terrainGridStep } from '../physics/terrain.js';
import { Earcut } from 'three/src/extras/Earcut.js';
import { CHUNK, QUALITY, PARAMS, BK, BF, RC, RF, LC, DRIVABLE_MAX } from '../config.js';
import { makeBuildingMaterial, makeDecalMaterial, makeSurfaceMaterial, makeTerrainMaterial, getPoolMaterial, env } from './materials.js';
import { SURFACE } from './material-table.js';
import { Parts, getDetailMaterial } from '../entities/models.js';
import { SURF } from './world.js';
import { TUNNEL_HEIGHT } from './tunnels.js';
import { buildTrafficMeshes } from './traffic-meshes.js';
import { detailRequestLimit, Heritage, pavingChunk } from './heritage.js';
import { FORGE, forgeXZ } from './mill.js';
import { Districts } from './districts.js';
import { Orthophoto, orthophotoTile } from './orthophoto.js';

const _c = new THREE.Color();
function lin(hex) { _c.setHex(hex); return [_c.r, _c.g, _c.b]; }

function pick(arr, r) { return arr[Math.min(arr.length - 1, Math.floor(r * arr.length))]; }

// ---------------------------------------------------------------- barvy ----
const PAL = {
  house: [0xe8dcc0, 0xf0e6cf, 0xe6d3a8, 0xd9c7a3, 0xe9cfb5, 0xdfe3d0, 0xf2efe6, 0xd6dbe0, 0xe7c9a9, 0xcfd8c2].map(lin),
  houseRoof: [0x9c4a36, 0x8a3f2f, 0xa5553c, 0x6f4a3c, 0x55504e, 0x7c3b30, 0x4a4a4f].map(lin),
  tenement: [0xe3cf9b, 0xd9b98a, 0xe6d9b8, 0xcfd6c0, 0xe4c4a8, 0xd8c9b0, 0xc9d0d6, 0xe8dfc8, 0xd3b89c, 0xbfc9b3, 0xe0b9a0].map(lin),
  historic: [0xf0d98a, 0xe9b98f, 0xcfe0b8, 0xf2e3b5, 0xe8c9c0, 0xd9e2e8, 0xf0c780, 0xe6d5a9, 0xd4c2a1, 0xb9d0c0].map(lin),
  panel: [0xd9d6cc, 0xe3dcc5, 0xd0d8dc, 0xe6d6b8, 0xcfd9c4, 0xe2c9b3, 0xc8ccd0, 0xead9a8, 0xd8e0e6].map(lin),
  commercial: [0xdfe3e6, 0xcbd3d9, 0xe9e6de, 0xb9c6d1, 0xd9d2c4].map(lin),
  industrial: [0xa9b0b5, 0x9aa3a8, 0xb9b4a6, 0x8f9aa3, 0xc2c5c2, 0xa39d90].map(lin),
  civic: [0xe6d8b5, 0xddcfae, 0xe9e0c9, 0xd6c6a3, 0xe3d3bd].map(lin),
  garage: [0xb8b2a5, 0xa9a59c, 0xc4bdb0, 0x9d978c, 0xb0a48f].map(lin),
  flatRoof: [0x5d6166, 0x6a6e73, 0x54585c, 0x73777a, 0x676260].map(lin),
  lightRoof: [0xa7acb0, 0xb7bbbd, 0x9aa0a4, 0xc0c2bf].map(lin),
  stone: [0xb9ad98, 0xc4b8a2, 0xaaa08e].map(lin),
  copper: lin(0x5f8f7b),
};

const PLZEN = {
  // Obvod × druh zástavby. Zachovává barvy, které jsou uvedené přímo u budovy v OSM.
  stucco: [
    [0xcfc8b3, 0xe1d9c8, 0xd2c2a7, 0xd9d6cb], // sever
    [0xe0caaf, 0xd7c7a6, 0xdfd3bd, 0xd2c5b6], // Slovany
    [0xe5d4b5, 0xd4bca2, 0xdbd3bf, 0xd3cbbb], // střed a západ
    [0xddd0b6, 0xcaad94, 0xd5c6b5, 0xd5d6c7], // Doubravka
    [0xe4d4b5, 0xded5c4, 0xd8c5a8, 0xd0cbbb], // okrajové obvody
  ].map((zone) => zone.map(lin)),
  estates: [0xd0cfbf, 0xc7c6b4, 0xdad2bf, 0xd3c7b1, 0xc4c7c2, 0xd6d1c7].map(lin),
  brick: [0x9b6452, 0xaa7f67, 0xa06f63, 0x987764].map(lin),
  metal: [0x818985, 0x899497, 0x9fa39d, 0x8f8e86].map(lin),
  tiles: [0x804f43, 0x8c4e3a, 0x98624c, 0x685754, 0x9b6754, 0x6d5551].map(lin),
};

/** Vzhled budovy: barva zdi a střechy, styl oken, rozteč oken a výška patra. */
function styleFor(world, i, district) {
  const B = world.b;
  const kind = B.kind[i];
  // výška zdí (bez šikmé střechy) – podle ní se pozná panelák od činžáku
  const h = world.bWall[i] - world.bGround[i];
  const r = hash(i), r2 = hash(i, 1), r3 = hash(i, 2);
  const cx = (world.bMinX[i] + world.bMaxX[i]) / 2, cz = (world.bMinZ[i] + world.bMaxZ[i]) / 2;
  const footprint = (world.bMaxX[i] - world.bMinX[i]) * (world.bMaxZ[i] - world.bMinZ[i]);
  const dist = Math.hypot(cx, cz);
  let wall, roof, style = 1, bay = 3.0, floorH = 3.0;
  switch (kind) {
    case BK.GARAGE:
      wall = pick(PAL.garage, r); roof = pick(PAL.flatRoof, r2); style = 0; break;
    case BK.ROOF:
      wall = pick(PAL.lightRoof, r); roof = pick(PAL.lightRoof, r2); style = 0; break;
    case BK.INDUSTRIAL: case BK.FARM:
      wall = pick(PAL.industrial, r); roof = pick(PAL.lightRoof, r2); style = h > 5 ? 5 : 0; bay = 5.5; floorH = Math.max(4, h); break;
    case BK.COMMERCIAL: case BK.TRANSPORT:
      wall = pick(PAL.commercial, r); roof = pick(PAL.flatRoof, r2); style = 4; bay = 4; floorH = 3.6; break;
    case BK.CIVIC:
      wall = pick(PAL.civic, r); roof = h < 22 && r3 < 0.5 ? pick(PAL.houseRoof, r2) : pick(PAL.flatRoof, r2); style = 3; bay = 3.2; floorH = 3.8; break;
    case BK.RELIGIOUS:
      wall = pick(PAL.stone, r); roof = r2 < 0.4 ? PAL.copper : pick(PAL.houseRoof, r2); style = 6; bay = 5.5; floorH = Math.max(7, Math.min(h, 18)); break;
    case BK.TOWER:
      wall = pick(PAL.stone, r); roof = pick(PAL.flatRoof, r2); style = 0; break;
    default: {
      const low = h < 11.5 && footprint < 700;
      if (kind === BK.HOUSE || (kind === BK.GENERIC && low)) {
        if (footprint < 45 && h < 4.2) { wall = pick(PAL.garage, r); roof = pick(PAL.flatRoof, r2); style = 0; break; }
        wall = pick(PAL.house, r); roof = pick(PAL.houseRoof, r2); style = 1; bay = 3.4; floorH = 2.9;
      } else if (h >= 21 || (kind === BK.APARTMENTS && h >= 15)) {
        wall = pick(PAL.panel, r); roof = pick(PAL.flatRoof, r2); style = 2; bay = 3.0; floorH = 2.8;
      } else if (dist < 430) {
        wall = pick(PAL.historic, r); roof = pick(PAL.houseRoof, r2 * 0.6); style = 3; bay = 2.5; floorH = 3.6;
      } else {
        wall = pick(PAL.tenement, r); roof = dist < 2300 && r3 < 0.7 ? pick(PAL.houseRoof, r2) : pick(PAL.flatRoof, r2);
        style = dist < 2300 ? 3 : 1; bay = 2.7; floorH = 3.3;
      }
    }
  }
  if (Math.hypot(cx - (FORGE.x - 39.5), cz - (FORGE.z + 13.3)) < 105 && (kind === BK.HOUSE || kind === BK.GENERIC)) {
    wall = pick(PAL.house, r * 0.6);
    roof = pick(PAL.houseRoof, 0.27 + r2 * 0.72);
    if (h < 4.5 && footprint < 85) { wall = lin(0x82705e); style = 0; }
  }
  if (district) {
    const historic = dist < 1800 || district === 2 && dist < 2900;
    if (kind === BK.INDUSTRIAL || kind === BK.FARM) {
      wall = pick(r < 0.36 ? PLZEN.brick : PLZEN.metal, r2);
      roof = pick(PLZEN.metal, r3);
    } else if (style === 2) {
      wall = pick(PLZEN.estates, r);
    } else if (style === 1 || style === 3) {
      wall = pick(PLZEN.stucco[Math.min(district, 5) - 1], r);
      if (B.flags[i] & (BF.GABLE | BF.RIDGE | BF.INSET | BF.PYRAMID)) roof = pick(PLZEN.tiles, r2);
      else if (dist >= 430) roof = pick(PAL.flatRoof, r2);
      if (style === 3 && !historic && kind !== BK.CIVIC) { style = 1; floorH = 3.05; }
    }
  }
  let wallSurface = SURFACE.plaster;
  if (style === 2) wallSurface = SURFACE.panel;
  else if (kind === BK.RELIGIOUS || kind === BK.TOWER) wallSurface = SURFACE.stone;
  else if (PLZEN.brick.includes(wall)) wallSurface = SURFACE.brick;
  else if (PLZEN.metal.includes(wall)) wallSurface = SURFACE.sheet;
  else if (kind === BK.INDUSTRIAL || kind === BK.FARM || kind === BK.GARAGE) wallSurface = SURFACE.concrete;
  let roofSurface = SURFACE.tile;
  if (roof === PAL.copper) roofSurface = SURFACE.copper;
  else if (PAL.flatRoof.includes(roof)) roofSurface = SURFACE.felt;
  else if (PAL.lightRoof.includes(roof) || PLZEN.metal.includes(roof)) roofSurface = SURFACE.sheet;
  const col = B.colour[i];
  if (col) { _c.setHex(col & 0xffffff); wall = [_c.r, _c.g, _c.b]; }
  const rcol = B.roofColour ? B.roofColour[i] : 0;
  if (rcol) { _c.setHex(rcol & 0xffffff); roof = [_c.r, _c.g, _c.b]; }
  // jemná odchylka jasu, ať nejsou sousední domy stejné
  const k = 0.9 + r3 * 0.18;
  return { wall: [wall[0] * k, wall[1] * k, wall[2] * k], roof, wallSurface, roofSurface, style, bay, floorH };
}

// ------------------------------------------------------------ pomocníci ----
class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.w = []; this.s = []; this.i = []; this.vc = 0; }
  v(x, y, z, nx, ny, nz, col, k, wu, wv, ws) {
    this.p.push(x, y, z);
    this.n.push(nx * 127, ny * 127, nz * 127);
    this.c.push(col[0] * k * 255, col[1] * k * 255, col[2] * k * 255);
    this.w.push(wu, wv, ws);
    this.s.push(Math.round(this.surface.roughness * 255), Math.round(this.surface.metalness * 255));
    return this.vc++;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  /** Trojúhelník s automatickou orientací podle očekávané normály. */
  face(ax, ay, az, bx, by, bz, cx, cy, cz, ex, ey, ez, col, k) {
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
    let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
    let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const flip = nx * ex + ny * ey + nz * ez < 0;
    if (flip) { nx = -nx; ny = -ny; nz = -nz; }
    const a = this.v(ax, ay, az, nx, ny, nz, col, k, 0, 0, 0);
    const b = this.v(bx, by, bz, nx, ny, nz, col, k, 0, 0, 0);
    const c = this.v(cx, cy, cz, nx, ny, nz, col, k, 0, 0, 0);
    if (flip) this.tri(a, c, b); else this.tri(a, b, c);
  }
  geometry() {
    if (!this.vc) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(this.n), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(this.c.map((v) => Math.min(255, v))), 3, true));
    g.setAttribute('aWin', new THREE.BufferAttribute(new Float32Array(this.w), 3));
    g.setAttribute('aSurface', new THREE.BufferAttribute(new Uint8Array(this.s), 2, true));
    g.setIndex(this.vc > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.i), 1) : new THREE.BufferAttribute(new Uint16Array(this.i), 1));
    g.computeBoundingSphere();
    return g;
  }
}

class DecalBuf {
  constructor() { this.p = []; this.c = []; this.i = []; this.vc = 0; }
  v(x, y, z, col) {
    this.p.push(x, y, z);
    this.c.push(col[0] * 255, col[1] * 255, col[2] * 255);
    return this.vc++;
  }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  /** Kruhová výplň (spoje a konce pásů); yFn(x, z) vrací výšku bodu. */
  disc(x, z, r, col, yFn, seg = 8) {
    const c0 = this.v(x, yFn(x, z), z, col);
    let first = -1, prev = -1;
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const vx = x + Math.cos(a) * r, vz = z + Math.sin(a) * r;
      const v = this.v(vx, yFn(vx, vz), vz, col);
      if (s === 0) first = v; else this.i.push(c0, v, prev);
      prev = v;
    }
    this.i.push(c0, first, prev);
  }
  geometry() {
    if (!this.vc) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(this.c), 3, true));
    g.setIndex(this.vc > 65535 ? new THREE.BufferAttribute(new Uint32Array(this.i), 1) : new THREE.BufferAttribute(new Uint16Array(this.i), 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Jednoduché plné díly s barvou po ploškách (mostovky, pilíře). */
class SolidBuf {
  constructor() { this.p = []; this.n = []; this.c = []; }
  quad(a, b, c, d, col, k = 1) {
    let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const q of [a, b, c, a, c, d]) {
      this.p.push(q[0], q[1], q[2]); this.n.push(nx, ny, nz); this.c.push(col[0] * k, col[1] * k, col[2] * k);
    }
  }
  box(x, y0, y1, z, hw, col) {
    const a = [x - hw, y0, z - hw], b = [x + hw, y0, z - hw], c = [x + hw, y0, z + hw], d = [x - hw, y0, z + hw];
    const e = [x - hw, y1, z - hw], f = [x + hw, y1, z - hw], g = [x + hw, y1, z + hw], h = [x - hw, y1, z + hw];
    this.quad(a, e, f, b, col, 0.8); this.quad(b, f, g, c, col, 0.9); this.quad(c, g, h, d, col, 0.8); this.quad(d, h, e, a, col, 0.9);
  }
  geometry() {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// --------------------------------------------------------------- budovy ----
/** Obrys odsazený dovnitř o d metrů (pro šikmé střechy). Vrací pole [x, z, …], nebo null, když to nejde. */
function insetRing(vx, vz, s, n, d) {
  for (let attempt = 0; attempt < 3; attempt++, d *= 0.6) {
    if (d < 0.7) break;
    const out = new Array(n * 2);
    for (let i = 0; i < n; i++) {
      const p = s + (i + n - 1) % n, c = s + i, q = s + (i + 1) % n;
      let e0x = vx[c] - vx[p], e0z = vz[c] - vz[p];
      let e1x = vx[q] - vx[c], e1z = vz[q] - vz[c];
      const l0 = Math.hypot(e0x, e0z) || 1, l1 = Math.hypot(e1x, e1z) || 1;
      e0x /= l0; e0z /= l0; e1x /= l1; e1z /= l1;
      // normály dovnitř (obrys má kladnou orientaci, ven míří (ez, -ex))
      let mx = -e0z - e1z, mz = e0x + e1x;
      const ml = Math.hypot(mx, mz);
      if (ml < 1e-3) { mx = -e1z; mz = e1x; } else { mx /= ml; mz /= ml; }
      const len = d / Math.max(0.42, mx * -e1z + mz * e1x);
      out[i * 2] = vx[c] + mx * len; out[i * 2 + 1] = vz[c] + mz * len;
    }
    let ok = true, area = 0;
    for (let i = 0; i < n && ok; i++) {
      const j = (i + 1) % n;
      const ox = vx[s + j] - vx[s + i], oz = vz[s + j] - vz[s + i];
      const ix = out[j * 2] - out[i * 2], iz = out[j * 2 + 1] - out[i * 2 + 1];
      if (ox * ix + oz * iz < -1e-4) ok = false;                  // hrana se převrátila
      area += out[i * 2] * out[j * 2 + 1] - out[j * 2] * out[i * 2 + 1];
      // odsazený bod musí zůstat uvnitř půdorysu
      const x = out[i * 2], z = out[i * 2 + 1];
      let inside = false;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const z1 = vz[s + b], z2 = vz[s + a];
        if ((z1 > z) !== (z2 > z) && x < (vx[s + a] - vx[s + b]) * (z - z1) / (z2 - z1) + vx[s + b]) inside = !inside;
      }
      if (!inside) ok = false;
    }
    if (ok && area > 3) return out;
  }
  return null;
}

function buildBuildings(world, list, replaced, district) {
  const B = world.b, vx = world.bvx, vz = world.bvz;
  const buf = new Buf();
  for (const i of list) {
    const flags = B.flags[i];
    if ((flags & BF.HAS_PARTS) || replaced.has(i)) continue;
    const st = styleFor(world, i, district);
    const kind = B.kind[i];
    const top = world.bTop[i];
    const gable = (flags & BF.GABLE) !== 0;
    const nOuter0 = B.ringStart[B.bRing[i] + 1] - B.ringStart[B.bRing[i]];
    const ridge = (flags & BF.RIDGE) !== 0 && B.bRing[i + 1] - B.bRing[i] === 1 && nOuter0 >= 3;
    const inset = (flags & BF.INSET) && B.roofInset && B.bRing[i + 1] - B.bRing[i] === 1 && nOuter0 >= 3
      ? insetRing(vx, vz, B.ringStart[B.bRing[i]], nOuter0, B.roofInset[i] * 0.1) : null;
    let wallTop = gable || ridge || inset ? world.bWall[i] : top;
    let base = world.bBase[i];
    if (kind === BK.ROOF) base = Math.max(base, top - 0.35);
    const r0 = B.bRing[i], r1 = B.bRing[i + 1];
    // patra se počítají od průměrné výšky terénu; zeď pod ní (ve svahu) je sokl bez oken
    const ground = kind === BK.ROOF || B.hMin[i] > 0 ? base : world.bGround[i];
    const floors = Math.max(1, Math.round((wallTop - ground) / st.floorH));
    const vBase = ((base - ground) / Math.max(0.5, wallTop - ground)) * floors;
    // zdi
    buf.surface = st.wallSurface;
    for (let rg = r0; rg < r1; rg++) {
      const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
      let j = v1 - 1;
      for (let v = v0; v < v1; j = v++) {
        const x1 = vx[j], z1 = vz[j], x2 = vx[v], z2 = vz[v];
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        const nx = dz / len, nz = -dx / len;
        let style = st.style, nb = 0, off = 0;
        if (style && len >= 1.8 && wallTop - ground > 2.2) {
          nb = Math.max(1, Math.round(len / st.bay));
          off = Math.floor(hash(v, 3) * 50) * 4;
          style += 8 * Math.min(floors, 60);       // shader potřebuje znát počet pater (římsa pod střechou)
        } else style = 0;
        const a = buf.v(x1, base, z1, nx, 0, nz, st.wall, 0.78, off, vBase, style);
        const b = buf.v(x2, base, z2, nx, 0, nz, st.wall, 0.78, off + nb, vBase, style);
        const c = buf.v(x2, wallTop, z2, nx, 0, nz, st.wall, 1, off + nb, floors, style);
        const d = buf.v(x1, wallTop, z1, nx, 0, nz, st.wall, 1, off, floors, style);
        buf.tri(a, c, b); buf.tri(a, d, c);
      }
    }
    // střecha
    buf.surface = st.roofSurface;
    const nOuter = B.ringStart[r0 + 1] - B.ringStart[r0];
    if (gable && nOuter === 4 && r1 - r0 === 1) {
      const s = B.ringStart[r0];
      const X = [vx[s], vx[s + 1], vx[s + 2], vx[s + 3]], Z = [vz[s], vz[s + 1], vz[s + 2], vz[s + 3]];
      const l0 = Math.hypot(X[1] - X[0], Z[1] - Z[0]), l1 = Math.hypot(X[2] - X[1], Z[2] - Z[1]);
      const o = l0 >= l1 ? 0 : 1;   // hřeben rovnoběžně s delší stranou
      const A = o, Bq = (o + 1) % 4, Cq = (o + 2) % 4, D = (o + 3) % 4;
      const m1x = (X[Bq] + X[Cq]) / 2, m1z = (Z[Bq] + Z[Cq]) / 2;
      const m2x = (X[D] + X[A]) / 2, m2z = (Z[D] + Z[A]) / 2;
      const y = wallTop;
      // dvě střešní roviny
      buf.face(X[A], y, Z[A], X[Bq], y, Z[Bq], m1x, top, m1z, 0, 1, 0, st.roof, 1);
      buf.face(X[A], y, Z[A], m1x, top, m1z, m2x, top, m2z, 0, 1, 0, st.roof, 1);
      buf.face(X[Cq], y, Z[Cq], X[D], y, Z[D], m2x, top, m2z, 0, 1, 0, st.roof, 0.86);
      buf.face(X[Cq], y, Z[Cq], m2x, top, m2z, m1x, top, m1z, 0, 1, 0, st.roof, 0.86);
      // štíty
      buf.surface = st.wallSurface;
      const cxm = (X[0] + X[1] + X[2] + X[3]) / 4, czm = (Z[0] + Z[1] + Z[2] + Z[3]) / 4;
      buf.face(X[Bq], y, Z[Bq], X[Cq], y, Z[Cq], m1x, top, m1z, m1x - cxm, 0, m1z - czm, st.wall, 1);
      buf.face(X[D], y, Z[D], X[A], y, Z[A], m2x, top, m2z, m2x - cxm, 0, m2z - czm, st.wall, 1);
    } else if (ridge) {
      // hřebenová střecha: hřeben v delší ose nejmenšího opsaného obdélníku
      const s = B.ringStart[r0], n = nOuter;
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
      const uc = (u0 + u1) / 2, wc = (w0 + w1) / 2;
      const proj = (x, z) => {
        let u = x * ux + z * uz;
        if (u < uc - half) u = uc - half; else if (u > uc + half) u = uc + half;
        // zpět do světových souřadnic: bod (u, wc)
        return [u * ux - wc * uz, u * uz + wc * ux];
      };
      const y = wallTop;
      const shade = (nx) => 0.86 + 0.14 * Math.max(0, nx);
      for (let a = 0; a < n; a++) {
        const b = (a + 1) % n;
        const ax = vx[s + a], az = vz[s + a], bx = vx[s + b], bz = vz[s + b];
        const ra = proj(ax, az), rb = proj(bx, bz);
        const ex = bz - az, ez = -(bx - ax);
        const el = Math.hypot(ex, ez) || 1;
        const k = shade((ex / el) * 0.6 + (ez / el) * 0.4);
        buf.face(ax, y, az, bx, y, bz, rb[0], top, rb[1], ex / el * 0.3, 1, ez / el * 0.3, st.roof, k);
        if (Math.hypot(ra[0] - rb[0], ra[1] - rb[1]) > 0.05) {
          buf.face(ax, y, az, rb[0], top, rb[1], ra[0], top, ra[1], ex / el * 0.3, 1, ez / el * 0.3, st.roof, k);
        }
      }
    } else if (inset) {
      // šikmá střecha: od okapu na obvodu stoupá k odsazenému obrysu ve výšce hřebene
      const s = B.ringStart[r0], n = nOuter;
      const y = wallTop;
      for (let a = 0; a < n; a++) {
        const b = (a + 1) % n;
        const ax = vx[s + a], az = vz[s + a], bx = vx[s + b], bz = vz[s + b];
        const ex = bz - az, ez = -(bx - ax);
        const el = Math.hypot(ex, ez) || 1;
        buf.face(ax, y, az, bx, y, bz, inset[b * 2], top, inset[b * 2 + 1], ex / el * 0.4, 1, ez / el * 0.4, st.roof, 1);
        buf.face(ax, y, az, inset[b * 2], top, inset[b * 2 + 1], inset[a * 2], top, inset[a * 2 + 1], ex / el * 0.4, 1, ez / el * 0.4, st.roof, 1);
      }
      const idx0 = buf.vc;
      for (let a = 0; a < n; a++) buf.v(inset[a * 2], top, inset[a * 2 + 1], 0, 1, 0, st.roof, 0.9, 0, 0, 0);
      const tris = Earcut.triangulate(inset, null, 2);
      for (let t = 0; t < tris.length; t += 3) {
        const a = tris[t], b = tris[t + 1], c = tris[t + 2];
        const ny = (inset[b * 2 + 1] - inset[a * 2 + 1]) * (inset[c * 2] - inset[a * 2]) - (inset[b * 2] - inset[a * 2]) * (inset[c * 2 + 1] - inset[a * 2 + 1]);
        if (ny >= 0) buf.tri(idx0 + a, idx0 + b, idx0 + c); else buf.tri(idx0 + a, idx0 + c, idx0 + b);
      }
    } else {
      const flat = [];
      const holes = [];
      const idx0 = buf.vc;
      for (let rg = r0; rg < r1; rg++) {
        if (rg > r0) holes.push(flat.length / 2);
        for (let v = B.ringStart[rg], ve = B.ringStart[rg + 1]; v < ve; v++) {
          flat.push(vx[v], vz[v]);
          buf.v(vx[v], top, vz[v], 0, 1, 0, st.roof, 1, 0, 0, 0);
        }
      }
      const tris = Earcut.triangulate(flat, holes, 2);
      for (let t = 0; t < tris.length; t += 3) {
        const a = tris[t], b = tris[t + 1], c = tris[t + 2];
        const ny = (flat[b * 2 + 1] - flat[a * 2 + 1]) * (flat[c * 2] - flat[a * 2]) - (flat[b * 2] - flat[a * 2]) * (flat[c * 2 + 1] - flat[a * 2 + 1]);
        if (ny >= 0) buf.tri(idx0 + a, idx0 + b, idx0 + c); else buf.tri(idx0 + a, idx0 + c, idx0 + b);
      }
    }
  }
  return buf.geometry();
}

// -------------------------------------------------------------- silnice ----
const COL = {
  asphalt: lin(0x4b4e54), asphaltMinor: lin(0x55585d), service: lin(0x5e6164), sidewalk: lin(0x9a9da1),
  pedestrian: lin(0xb3ab9c), footway: lin(0xa39f95), path: lin(0x8a7a5e), track: lin(0x7f7257),
  cycleway: lin(0x8c5b52), steps: lin(0x8a8a8a), mark: lin(0xdcdcd4), markYellow: lin(0xd8b740),
  ballast: lin(0x6a6259), rail: lin(0xa6acb2), tramBed: lin(0x43464b), bridge: lin(0x62656a),
  concrete: lin(0x9b9a94), railing: lin(0x8d949b), bridgeStone: lin(0xa69b87),
};
// tytéž barvy pro kreslení do textury země
const HEX = {
  asphalt: '#4b4e54', asphaltMinor: '#55585d', service: '#5e6164', sidewalk: '#9a9da1', pedestrian: '#b3ab9c',
  footway: '#a39f95', path: '#8a7a5e', track: '#7f7257', cycleway: '#8c5b52', steps: '#8a8a8a', ballast: '#6a6259',
  stream: '#577982',
};
const LAND_HEX = {
  [LC.FARMLAND]: '#b5b47a', [LC.MEADOW]: '#9bb36a', [LC.GRASS]: '#8fb25e', [LC.RESIDENTIAL]: '#a9a89d',
  [LC.COMMERCIAL]: '#a9a6a3', [LC.INDUSTRIAL]: '#9b9995', [LC.RAILWAY]: '#857f76', [LC.ALLOTMENTS]: '#8faa6a',
  [LC.CEMETERY]: '#7f9f6a', [LC.FOREST]: '#4e7a46', [LC.SCRUB]: '#6f9353', [LC.PARK]: '#86b560',
  [LC.PITCH]: '#6fae62', [LC.PARKING]: '#62656a', [LC.PLAZA]: '#b7b0a2', [LC.SAND]: '#d9c998',
  [LC.CONSTRUCTION]: '#a59a84', [LC.GARDEN]: '#83ad62', [LC.PLAYGROUND]: '#c9b98a',
};
const LAND_GROUP = {
  [LC.FARMLAND]: 0, [LC.MEADOW]: 0, [LC.RESIDENTIAL]: 0, [LC.COMMERCIAL]: 0, [LC.INDUSTRIAL]: 0,
  [LC.RAILWAY]: 0, [LC.CONSTRUCTION]: 0,
  [LC.FOREST]: 1, [LC.SCRUB]: 1, [LC.GRASS]: 1, [LC.PARK]: 1, [LC.ALLOTMENTS]: 1, [LC.CEMETERY]: 1, [LC.GARDEN]: 1,
  [LC.PITCH]: 2, [LC.PLAYGROUND]: 2, [LC.PARKING]: 2, [LC.PLAZA]: 2, [LC.SAND]: 2,
};
const ORTHOPHOTO_LAND = new Set([LC.FARMLAND, LC.MEADOW, LC.GRASS, LC.SCRUB]);
const FIELD_COLORS = ['#b7ae78', '#aba774', '#b8aa81', '#9fa975', '#bdb47e', '#a69d79', '#adb383', '#aeb078'];
const MEADOW_COLORS = ['#9bad74', '#8da16c', '#9dab77', '#9ca465', '#a5b581'];
const FOREST_COLORS = ['#56744e', '#507050', '#5a784d', '#4a684b', '#55764e'];

function roadColor(cls) {
  if (cls <= RC.TERTIARY_LINK) return COL.asphalt;
  if (cls <= RC.LIVING) return COL.asphaltMinor;
  if (cls === RC.SERVICE) return COL.service;
  if (cls === RC.PEDESTRIAN) return COL.pedestrian;
  if (cls === RC.TRACK) return COL.track;
  if (cls === RC.FOOTWAY) return COL.footway;
  if (cls === RC.PATH) return COL.path;
  if (cls === RC.CYCLEWAY) return COL.cycleway;
  return COL.steps;
}
function roadHex(cls) {
  if (cls <= RC.TERTIARY_LINK) return HEX.asphalt;
  if (cls <= RC.LIVING) return HEX.asphaltMinor;
  if (cls === RC.SERVICE) return HEX.service;
  if (cls === RC.PEDESTRIAN) return HEX.pedestrian;
  if (cls === RC.TRACK) return HEX.track;
  if (cls === RC.FOOTWAY) return HEX.footway;
  if (cls === RC.PATH) return HEX.path;
  if (cls === RC.CYCLEWAY) return HEX.cycleway;
  return HEX.steps;
}

const LIFT_MARK = 0.02, LIFT_RAIL = 0.035;

/** Vozovku u portálu tvoří samostatný pás s přesným podélným profilem. */
function trimApproach(D, start, end) {
  const outside = (p, x, z) => (x - p.outside.x) * p.dx + (z - p.outside.z) * p.dz <= 0;
  if (start) {
    const i = D.x.findIndex((x, k) => outside(start, x, D.z[k]));
    if (i < 0) return false;
    D.x.splice(0, i, start.outside.x); D.z.splice(0, i, start.outside.z);
    D.px = start.x; D.pz = start.z;
  }
  if (end) {
    const i = D.x.findLastIndex((x, k) => outside(end, x, D.z[k]));
    if (i < 0) return false;
    D.x.splice(i + 1, D.x.length, end.outside.x); D.z.splice(i + 1, D.z.length, end.outside.z);
    D.nx = end.x; D.nz = end.z;
  }
  D.n = D.x.length;
  return D.n >= 2;
}



/** Pás položený na terén (nebo na mostovku). center = přidat středovou řadu bodů (lépe kopíruje terén). */
function ribbon(world, buf, D, hw, col, lateral, lift, capStart, capEnd, center) {
  const n = D.n;
  let pL = -1, pC = -1, pR = -1;
  for (let k = 0; k < n; k++) {
    const yFn = D.y ? () => D.y[k] + lift : (x, z) => world.heightAt(x, z) + SURF + lift;
    const nr = pathNormal(D, k);
    const nx = nr.x, nz = nr.z, sc = nr.scale;
    if (nr.dot < 0.93) buf.disc(D.x[k] + nx * lateral, D.z[k] + nz * lateral, hw, col, yFn);
    const cx = D.x[k] + nx * lateral * sc, cz = D.z[k] + nz * lateral * sc;
    const lx = cx - nx * hw * sc, lz = cz - nz * hw * sc, rx = cx + nx * hw * sc, rz = cz + nz * hw * sc;
    const L = buf.v(lx, yFn(lx, lz), lz, col), R = buf.v(rx, yFn(rx, rz), rz, col);
    let C = -1;
    if (center) C = buf.v(cx, yFn(cx, cz), cz, col);
    if (pL >= 0) {
      if (center) { buf.quad(pL, pC, C, L); buf.quad(pC, pR, R, C); } else buf.quad(pL, pR, R, L);
    }
    pL = L; pC = C; pR = R;
    if ((k === 0 && capStart) || (k === n - 1 && capEnd)) buf.disc(cx, cz, hw, col, yFn);
  }
}

/** Přerušovaná čára. */
function dashes(world, buf, D, hw, col, dash, gap, lateral, lift) {
  let acc = 0;
  const period = dash + gap;
  for (let k = 0; k < D.n - 1; k++) {
    const x1 = D.x[k], z1 = D.z[k];
    let dx = D.x[k + 1] - x1, dz = D.z[k + 1] - z1;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    dx /= len; dz /= len;
    const nx = -dz, nz = dx;
    const yAt = (x, z, t) => (D.y ? D.y[k] + (D.y[k + 1] - D.y[k]) * t : world.heightAt(x, z) + SURF) + lift;
    let s = -acc;
    while (s < len) {
      const s0 = Math.max(0, s), s1 = Math.min(len, s + dash);
      if (s1 - s0 > 0.3) {
        const ax = x1 + dx * s0 + nx * lateral, az = z1 + dz * s0 + nz * lateral;
        const bx = x1 + dx * s1 + nx * lateral, bz = z1 + dz * s1 + nz * lateral;
        const ya = yAt(ax, az, s0 / len), yb = yAt(bx, bz, s1 / len);
        const a = buf.v(ax - nx * hw, ya, az - nz * hw, col), b = buf.v(ax + nx * hw, ya, az + nz * hw, col);
        const c = buf.v(bx + nx * hw, yb, bz + nz * hw, col), d = buf.v(bx - nx * hw, yb, bz - nz * hw, col);
        buf.quad(a, b, c, d);
      }
      s += period;
    }
    acc = (acc + len) % period;
  }
}

/** Těleso mostu: deska pod vozovkou, zábradlí a pilíře až na terén. */
function bridgeSlab(world, solid, D, hw, topCol, supports = true, depth = BRIDGE_THICKNESS) {
  const n = D.n;
  if (n < 2 || !D.y) return;
  const T = depth - 0.04;
  const L = [], R = [];
  for (let k = 0; k < n; k++) {
    const nr = pathNormal(D, k);
    const sc = Math.min(nr.scale, 1.5);
    L.push([D.x[k] - nr.x * hw * sc, D.z[k] - nr.z * hw * sc]);
    R.push([D.x[k] + nr.x * hw * sc, D.z[k] + nr.z * hw * sc]);
  }
  let acc = 13;
  for (let k = 0; k < n - 1; k++) {
    const y0 = D.y[k] - 0.04, y1 = D.y[k + 1] - 0.04;
    const l0 = L[k], l1 = L[k + 1], r0 = R[k], r1 = R[k + 1];
    solid.quad([l0[0], y0, l0[1]], [l1[0], y1, l1[1]], [r1[0], y1, r1[1]], [r0[0], y0, r0[1]], topCol);               // vršek
    solid.quad([l0[0], y0 - T, l0[1]], [r0[0], y0 - T, r0[1]], [r1[0], y1 - T, r1[1]], [l1[0], y1 - T, l1[1]], COL.concrete, 0.55);  // spodek
    solid.quad([l0[0], y0 - T, l0[1]], [l1[0], y1 - T, l1[1]], [l1[0], y1, l1[1]], [l0[0], y0, l0[1]], COL.concrete, 0.85);
    solid.quad([r0[0], y0, r0[1]], [r1[0], y1, r1[1]], [r1[0], y1 - T, r1[1]], [r0[0], y0 - T, r0[1]], COL.concrete, 0.85);
    // pilíře po ~26 m, kde je pod mostem dost místa
    if (!supports) continue;
    const len = Math.hypot(D.x[k + 1] - D.x[k], D.z[k + 1] - D.z[k]);
    acc += len;
    while (acc >= 26 && len > 0) {
      acc -= 26;
      const t = Math.min(1, Math.max(0, 1 - acc / len));
      const x = D.x[k] + (D.x[k + 1] - D.x[k]) * t, z = D.z[k] + (D.z[k + 1] - D.z[k]) * t;
      const yb = y0 + (y1 - y0) * t - T, g = world.heightAt(x, z);
      if (yb - g > 2.5 && world.bridgeSupportAllowed(x, z)) {
        solid.box(x, g - 0.6, yb, z, Math.min(0.9, hw * 0.35), COL.concrete);
      }
    }
  }
}

function railAbutments(world, solid, path, halfWidth) {
  for (const [end, next] of [[0, 1], [path.n - 1, path.n - 2]]) {
    const x = path.x[end], z = path.z[end], y = path.y[end] - 0.09;
    const dx = x - path.x[next], dz = z - path.z[next], length = Math.hypot(dx, dz);
    if (length < 0.01) continue;
    // Ve směru ven z mostu sahá opěra pod navazující násep.
    const corner = (along, across) => [x + (dx * along - dz * across) / length, y,
      z + (dz * along + dx * across) / length];
    const a = corner(-0.28, -halfWidth), b = corner(-0.28, halfWidth);
    const c = corner(2.8, halfWidth + 0.65), d = corner(2.8, -halfWidth - 0.65);
    const foot = ([u, , v]) => [u, Math.min(y - 0.2, world.heightAt(u, v) - 0.35), v];
    solid.quad(a, d, c, b, COL.concrete);
    for (const [p, q] of [[a, b], [b, c], [c, d], [d, a]]) {
      solid.quad(q, p, foot(p), foot(q), COL.concrete, 0.86);
    }
  }
}

function buildTrackUnderpass(world, solid, [x, z, endX, endZ, halfWidth, clearance]) {
  const length = Math.hypot(endX - x, endZ - z);
  if (length < 0.01) return;
  const dx = (endX - x) / length, dz = (endZ - z) / length;
  const floor = [world.heightAt(x, z), world.heightAt(endX, endZ)];
  const outer = halfWidth + 0.42, roof = clearance + 0.52;
  const point = (end, side, h) => [x + end * dx * length - dz * side,
    floor[end] + h, z + end * dz * length + dx * side];
  solid.quad(point(0, -outer, roof), point(1, -outer, roof), point(1, outer, roof), point(0, outer, roof), COL.concrete);
  solid.quad(point(0, -halfWidth, clearance), point(0, halfWidth, clearance),
    point(1, halfWidth, clearance), point(1, -halfWidth, clearance), COL.concrete, 0.62);
  for (const direction of [-1, 1]) {
    const side = direction * halfWidth;
    solid.quad(point(0, side, -0.6), point(1, side, -0.6),
      point(1, side, clearance), point(0, side, clearance), COL.concrete, 0.86);
    solid.quad(point(0, direction * outer, -0.6), point(0, direction * outer, roof),
      point(1, direction * outer, roof), point(1, direction * outer, -0.6), COL.concrete);
    for (const end of [0, 1]) {
      solid.quad(point(end, side, -0.6), point(end, direction * outer, -0.6),
        point(end, direction * outer, roof), point(end, side, roof), COL.concrete);
    }
  }
  for (const end of [0, 1]) {
    solid.quad(point(end, -outer, clearance), point(end, outer, clearance),
      point(end, outer, roof), point(end, -outer, roof), COL.concrete);
  }
}

function rondelMarkings(world, marks, path, laneWidth, surfaceWidth, lanes) {
  if (lanes === 2) {
    dashes(world, marks, path, 0.06, COL.mark, 2.6, 3.4, 0, LIFT_MARK);
    return;
  }
  const outerLine = laneWidth - 0.12;
  const innerLine = -surfaceWidth + 0.24;
  ribbon(world, marks, path, 0.064, COL.mark, outerLine, LIFT_MARK);
  ribbon(world, marks, path, 0.064, COL.mark, -outerLine, LIFT_MARK);
  ribbon(world, marks, path, 0.064, COL.mark, innerLine, LIFT_MARK);
  let spacing = 1.5;
  for (let k = 1; k < path.n; k++) {
    const x = path.x[k - 1], z = path.z[k - 1];
    const dx = path.x[k] - x, dz = path.z[k] - z, length = Math.hypot(dx, dz);
    if (length < 0.001) continue;
    const tx = dx / length, tz = dz / length;
    const y = path.y[k - 1] + LIFT_MARK, slope = (path.y[k] - path.y[k - 1]) / length;
    const vertex = (along, across) => marks.v(x + tx * along - tz * across,
      y + slope * along, z + tz * along + tx * across, COL.mark);
    while (spacing + 0.85 < length) {
      marks.quad(vertex(spacing, innerLine), vertex(spacing + 0.63, -outerLine),
        vertex(spacing + 0.85, -outerLine), vertex(spacing + 0.22, innerLine));
      spacing += 2.1;
    }
    spacing = Math.max(0.35, spacing - length);
  }
}

function rondelAbutments(world, solid, ci) {
  for (const [a, b, top] of world.rondel?.walls.get(ci) ?? []) {
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3);
    const vertex = (t) => {
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      return { x, z, floor: world.heightAt(x, z) - 0.22 };
    };
    for (let i = 1; i <= steps; i++) {
      const p = vertex((i - 1) / steps), q = vertex(i / steps);
      if (Math.min(p.floor, q.floor) > top - 0.20) continue;
      solid.quad([p.x, Math.min(p.floor, top), p.z], [q.x, Math.min(q.floor, top), q.z],
        [q.x, top, q.z], [p.x, top, p.z], COL.concrete);
    }
  }
}

function stoneBridge(world, solid, D, hw, arches) {
  const a = [D.x[0], D.z[0]], b = [D.x.at(-1), D.z.at(-1)];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = (a[1] - b[1]) / length, nz = (b[0] - a[0]) / length;
  const stone = lin(0xa69b87);
  const deck = (t) => D.y[0] * (1 - t) + D.y.at(-1) * t;
  const point = (t, side, y) => [a[0] + (b[0] - a[0]) * t + nx * side, y, a[1] + (b[1] - a[1]) * t + nz * side];
  const bed = Math.min(world.heightAt(...a), world.heightAt(...b),
    world.heightAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) - 1.1;
  const segments = arches * 24;
  const soffit = (t) => {
    const local = (t * arches) % 1;
    const span = Math.max(0, 1 - ((local - 0.5) / 0.44) ** 2);
    return bed + Math.sqrt(span) * Math.max(0.2, deck(t) - bed - 0.85);
  };
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments, t1 = (i + 1) / segments;
    const y0 = deck(t0) - 0.04, y1 = deck(t1) - 0.04;
    const u0 = soffit(t0), u1 = soffit(t1);
    solid.quad(point(t0, -hw, y0), point(t1, -hw, y1), point(t1, hw, y1), point(t0, hw, y0), COL.sidewalk);
    solid.quad(point(t0, -hw, u0), point(t0, hw, u0), point(t1, hw, u1), point(t1, -hw, u1), stone, 0.66);
    for (const side of [-hw, hw]) {
      solid.quad(point(t0, side, u0), point(t1, side, u1), point(t1, side, deck(t1)), point(t0, side, deck(t0)), stone);
    }
  }
}

function drawClosure(world, solid, [x, z, dx, dz, width]) {
  const white = lin(0xf5ede0), red = lin(0xc92320), base = lin(0x545357);
  const count = Math.ceil((width + 0.5) / 0.65);
  const point = (side, ahead, lift) => {
    const px = x - dz * side + dx * ahead, pz = z + dx * side + dz * ahead;
    return [px, world.heightAt(px, pz) + lift, pz];
  };
  for (let i = 0; i < count; i++) {
    const a = (width + 0.5) * (i / count - 0.5), b = (width + 0.5) * ((i + 1) / count - 0.5);
    for (const end of [-0.24, 0.24]) {
      solid.quad(point(a, end, 0.28), point(b, end, 0.28), point(b, end, 0.88), point(a, end, 0.88), i % 2 ? white : red);
    }
    solid.quad(point(a, -0.24, 0.88), point(b, -0.24, 0.88), point(b, 0.24, 0.88), point(a, 0.24, 0.88), white);
  }
  for (const side of [-width / 2, width / 2, 0]) {
    const [px, y, pz] = point(side, 0, 0);
    solid.box(px, y - 0.15, y + 0.67, pz, 0.18, base);
  }
}

function buildTunnel(world, tunnel) {
  const solid = new SolidBuf(), lights = new SolidBuf();
  const concrete = lin(0x696963), ceiling = lin(0x33343a), road = lin(0x41454d);
  const white = lin(0xcfd3d7), amber = lin(0xffe4b3);
  const { points, halfWidth: hw } = tunnel;
  const D = densePath(points.map((p) => p.x), points.map((p) => p.z), points.map((p) => p.y),
    0, points.length - 1, 0, points.length - 1, 4);
  const sections = Array.from({ length: D.n }, (_, k) => {
    const { x, z, scale } = pathNormal(D, k);
    return (side, h) => [D.x[k] + x * side * scale, D.y[k] + h, D.z[k] + z * side * scale];
  });
  const [start, end] = tunnel.portals;
  const beyond = (p, k) => (D.x[k] - p.x) * p.dx + (D.z[k] - p.z) * p.dz;
  const wallTop = (at, side) => {
    const [x, y, z] = at(side, 0);
    return Math.max(0.03, world.heightAt(x, z) - y + 0.12);
  };
  const H = TUNNEL_HEIGHT;
  for (let k = 0; k < D.n - 1; k++) {
    const a = sections[k], b = sections[k + 1];
    const inside = beyond(start, k) >= -0.01 && beyond(end, k + 1) >= -0.01;
    // Nad stropem Valíku leží terén, který do mapy stínů nekreslíme.
    const daylight = inside ? 0.11 + 0.89 * Math.exp(-Math.min(beyond(start, k + 1), beyond(end, k)) / 2.8) : 1;
    solid.quad(a(-hw, 0), b(-hw, 0), b(hw, 0), a(hw, 0), road, daylight);
    for (const side of [-hw, hw]) {
      const h0 = inside ? H : wallTop(a, side), h1 = inside ? H : wallTop(b, side);
      solid.quad(a(side, -0.2), b(side, -0.2), b(side, h1), a(side, h0), concrete, daylight);
      const line = side - Math.sign(side) * 0.85;
      lights.quad(a(line - 0.06, 0.014), b(line - 0.06, 0.014), b(line + 0.06, 0.014), a(line + 0.06, 0.014), white);
    }
    if (k % 3 !== 0) lights.quad(a(-0.07, 0.014), b(-0.07, 0.014), b(0.07, 0.014), a(0.07, 0.014), white);
    if (!inside) continue;
    solid.quad(a(-hw, H), a(hw, H), b(hw, H), b(-hw, H), ceiling, daylight);
    if (k % 5 === 0) {
      for (const side of [-hw + 0.32, hw - 0.32]) {
        lights.quad(a(side - 0.12, H - 0.05), a(side + 0.12, H - 0.05), b(side + 0.12, H - 0.05), b(side - 0.12, H - 0.05), amber);
      }
    }
  }
  for (const p of tunnel.portals) {
    const point = (side, height) => [p.x - p.dz * side, p.y + height, p.z + p.dx * side];
    const outer = hw + 0.65;
    solid.quad(point(-outer, H), point(outer, H), point(outer, H + 0.9), point(-outer, H + 0.9), concrete);
    for (const side of [-1, 1]) {
      solid.quad(point(side * hw, 0), point(side * outer, 0), point(side * outer, H), point(side * hw, H), concrete);
    }
  }
  return { solid: solid.geometry(), lights: lights.geometry() };
}

function buildRoads(world, ci) {
  const pieces = world.rPieces[ci];
  const R = world.r, px = world.rpx, pz = world.rpz, py = world.rpy, off = world.rOff;
  const asphalt = new DecalBuf(), marks = new DecalBuf(), solid = new SolidBuf();
  const surfaceStep = world.gradeTerrain.has(ci) ? world.gradeStep : 4;
  if (pieces) {
    for (let q = 0; q < pieces.length; q += 3) {
      const i = pieces[q], s = pieces[q + 1], e = pieces[q + 2];
      const a = off[i], b = off[i + 1] - 1;
      const cls = R.cls[i], w = R.w[i], flags = R.flags[i];
      if (world.tunnelRoads.has(i) || (flags & RF.SHARED_DECK) || world.rondel?.trackAccess.has(i)) continue;
      const bridge = (flags & RF.BRIDGE) !== 0;
      const paved = cls <= DRIVABLE_MAX || cls === RC.PEDESTRIAN;
      const measured = world.rondel?.elevated.get(i);
      const ring = world.rondel?.ring.has(i);
      if (!paved && !bridge && measured === undefined) continue; // běžné chodníky jsou v textuře země
      const hw = w / 2;
      const raised = bridge || measured !== undefined;
      const D = densePath(px, pz, raised ? py : null, s, e, a, b, bridge ? 1e9 : surfaceStep);
      const approach = world.tunnelApproaches.get(i);
      const start = s === a && approach?.start, end = e === b && approach?.end;
      if ((start || end) && !trimApproach(D, start, end)) continue;
      const col = ring ? COL.asphalt : bridge && cls <= DRIVABLE_MAX ? COL.bridge : roadColor(cls);
      const surfaceWidth = measured === undefined ? hw : measured - (ring ? 0.16 : 0.12);
      ribbon(world, asphalt, D, surfaceWidth, col, 0, 0, s === a && !start, e === b && !end, hw > 2.2 && !raised);
      if (bridge) {
        const arches = world.archedBridges.get(i);
        if (arches) stoneBridge(world, solid, D, world.deckHalfWidth(i), arches);
        else bridgeSlab(world, solid, D, world.deckHalfWidth(i),
          cls <= RC.LIVING ? COL.sidewalk : COL.concrete, measured === undefined && i !== world.prazdrojRoad,
          i === world.prazdrojRoad ? prazdrojThickness : undefined);
      } else if (measured !== undefined && D.y.some((y, k) => y - world.heightAt(D.x[k], D.z[k]) > 0.75)) {
        bridgeSlab(world, solid, D, measured, COL.concrete, false);
      }
      // vodorovné značení
      if (ring) rondelMarkings(world, marks, D, hw, surfaceWidth, R.lanes[i]);
      else if (cls <= RC.UNCLASSIFIED && !(flags & RF.ROUNDABOUT)) {
        const lanes = R.lanes[i];
        if (!(flags & RF.ONEWAY)) {
          if (lanes >= 4) {
            ribbon(world, marks, D, 0.09, COL.mark, 0.16, LIFT_MARK);
            ribbon(world, marks, D, 0.09, COL.mark, -0.16, LIFT_MARK);
            dashes(world, marks, D, 0.07, COL.mark, 3, 6, w / 4, LIFT_MARK);
            dashes(world, marks, D, 0.07, COL.mark, 3, 6, -w / 4, LIFT_MARK);
          } else if (w >= 5.6) {
            dashes(world, marks, D, 0.07, COL.mark, 3, 6, 0, LIFT_MARK);
          }
        } else if (lanes >= 2) {
          for (let l = 1; l < lanes; l++) dashes(world, marks, D, 0.07, COL.mark, 3, 6, -hw + (w / lanes) * l, LIFT_MARK);
        }
        if (cls <= RC.TRUNK_LINK) {
          ribbon(world, marks, D, 0.08, COL.mark, hw - 0.3, LIFT_MARK);
          ribbon(world, marks, D, 0.08, COL.mark, -hw + 0.3, LIFT_MARK);
        }
      }
    }
  }
  const furniture = [];
  for (const edge of world.bridgeEdges.get(ci) ?? []) {
    const start = solid.p.length;
    if (edge.style === 'stone') {
      railingFaces(edge, (a, b, c, d) => solid.quad(a, b, c, d, COL.bridgeStone));
    } else {
      const [a, b] = edge.corners;
      const band = (lo, hi, color) => solid.quad([a[0], a[1] + lo, a[2]], [b[0], b[1] + lo, b[2]],
        [b[0], b[1] + hi, b[2]], [a[0], a[1] + hi, a[2]], color);
      if (edge.style === 'open') {
        band(0, 0.16, COL.concrete);
        band(0.48, 0.54, COL.railing);
        band(0.92, edge.height, COL.railing);
        solid.box(a[0], a[1], a[1] + edge.height, a[2], 0.045, COL.railing);
      } else band(0, edge.height, COL.railing);
    }
    furniture.push({ fixture: edge, start, end: solid.p.length });
  }
  rondelAbutments(world, solid, ci);
  for (const underpass of world.trackUnderpasses.get(ci) ?? []) buildTrackUnderpass(world, solid, underpass);
  // koleje
  const rails = world.railChunks[ci];
  if (rails) {
    for (const ri of rails) {
      const rail = world.rails[ri];
      const n = rail.pts.length / 2;
      const rx = new Float32Array(n), rz = new Float32Array(n);
      for (let k = 0; k < n; k++) { rx[k] = rail.pts[k * 2]; rz[k] = rail.pts[k * 2 + 1]; }
      const D = densePath(rx, rz, rail.y, 0, n - 1, 0, n - 1, rail.y ? 1e9 : surfaceStep);
      if (rail.cls === 0) ribbon(world, asphalt, D, 1.25, COL.tramBed, 0, 0.004);
      else if (rail.y) ribbon(world, asphalt, D, 1.7, COL.ballast, 0, 0.004);
      ribbon(world, marks, D, 0.07, COL.rail, 0.7175, LIFT_RAIL);
      ribbon(world, marks, D, 0.07, COL.rail, -0.7175, LIFT_RAIL);
      if (rail.y) {
        const halfWidth = rail.cls === 1 ? 2.4 : 1.7;
        bridgeSlab(world, solid, D, halfWidth, COL.concrete);
        if (world.gradeRailAbutments.has(ri)) railAbutments(world, solid, D, halfWidth);
      }
    }
  }
  for (const fixture of world.closureChunks.get(ci) ?? []) {
    const start = solid.p.length;
    drawClosure(world, solid, fixture.closure);
    furniture.push({ fixture, start, end: solid.p.length });
  }
  const traffic = world.traffic.chunks.get(ci);
  if (traffic) drawTrafficMarkings(world, marks, traffic);
  return { asphalt: asphalt.geometry(), marks: marks.geometry(), solid: solid.geometry(), furniture };
}

function drawTrafficMarkings(world, buf, traffic) {
  const color = lin(0xf4f2dc);
  const strip = (a, b, halfWidth) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < 0.05) return;
    const nx = -dz / length * halfWidth, nz = dx / length * halfWidth;
    const v = (x, z) => buf.v(x, world.groundY(x, z) + 0.075, z, color);
    buf.quad(v(a[0] - nx, a[1] - nz), v(a[0] + nx, a[1] + nz),
      v(b[0] + nx, b[1] + nz), v(b[0] - nx, b[1] - nz));
  };
  for (const { a, b } of traffic.lines) strip(a, b, 0.21);
  for (const crossing of traffic.crossings) {
    const { a, dx, dz, length } = crossing;
    const count = Math.max(2, Math.round((length - 0.8) / 0.95));
    for (let i = 0; i < count; i++) {
      const d = 0.4 + (i + 0.5) * (length - 0.8) / count;
      const x = a[0] + dx * d, z = a[1] + dz * d;
      strip([x - dz * 1.45, z + dx * 1.45], [x + dz * 1.45, z - dx * 1.45], 0.23);
    }
  }
}

// ---------------------------------------------------------------- terén ----
const terrainIndices = new Map();

/** Síť terénu jedné dlaždice (sdílí uzly se sousedy, takže na sebe navazuje beze spár). */
function buildTerrain(world, ci, cx0, cz0) {
  const grade = world.gradeTerrain.has(ci);
  const detail = world.terrainDetail.has(ci) || grade;
  const G = terrainGridStep(world, ci);
  const N = CHUNK / G, n1 = N + 1;
  const pos = new Float32Array(n1 * n1 * 3), nor = new Float32Array(n1 * n1 * 3), uv = new Float32Array(n1 * n1 * 2);
  const gi0 = Math.round((cx0 - world.tX0) / G), gj0 = Math.round((cz0 - world.tZ0) / G);
  const th = world.th, tc = world.tCols, tr = world.tRows;
  const H = (i, j) => th[Math.min(tr - 1, Math.max(0, j)) * tc + Math.min(tc - 1, Math.max(0, i))];
  let o = 0, u = 0;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const gi = gi0 + i, gj = gj0 + j;
      const x = cx0 + i * G, z = cz0 + j * G;
      pos[o] = x; pos[o + 1] = detail ? world.heightAt(x, z) : H(gi, gj); pos[o + 2] = z;
      let hx, hz;
      if (detail || world.terrainDetail.size && (i === 0 || i === N || j === 0 || j === N)) {
        const step = grade ? world.gradeStep : world.tDetailG;
        hx = (world.heightAt(x + step, z) - world.heightAt(x - step, z)) / (2 * step);
        hz = (world.heightAt(x, z + step) - world.heightAt(x, z - step)) / (2 * step);
      } else {
        hx = (H(gi + 1, gj) - H(gi - 1, gj)) / (2 * G);
        hz = (H(gi, gj + 1) - H(gi, gj - 1)) / (2 * G);
      }
      const l = Math.hypot(hx, 1, hz);
      nor[o] = -hx / l; nor[o + 1] = 1 / l; nor[o + 2] = -hz / l;
      uv[u] = i / N; uv[u + 1] = j / N;
      o += 3; u += 2;
    }
  }
  if (!terrainIndices.has(N)) {
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const v00 = j * n1 + i, v10 = v00 + 1, v01 = v00 + n1, v11 = v01 + 1;
      idx.push(v00, v01, v10, v10, v01, v11);      // úhlopříčka 10–01, stejně jako world.heightAt
    }
    terrainIndices.set(N, new Uint16Array(idx));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  // Dlaždice sdílejí čísla vrcholů v paměti. Každá ale uvolňuje vlastní atribut ve vykreslovači.
  g.setIndex(new THREE.BufferAttribute(terrainIndices.get(N), 1));
  g.computeBoundingSphere();
  return g;
}

/** Podklad: hustá zástavba = „dlážděná“ šedá, jinde zelená (hrubá mapa celého města). */
function buildDensity(world) {
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#9aa873';
  g.fillRect(0, 0, S, S);
  const kx = S / (world.maxX - world.minX), kz = S / (world.maxZ - world.minZ);
  for (let i = 0; i < world.bCount; i++) {
    const w = world.bMaxX[i] - world.bMinX[i], d = world.bMaxZ[i] - world.bMinZ[i];
    const area = w * d;
    if (area < 40) continue;
    const work = world.b.kind[i] === BK.INDUSTRIAL || world.b.kind[i] === BK.COMMERCIAL;
    g.fillStyle = work ? '#a5a096' : '#aca78d';
    g.globalAlpha = Math.min(work ? 0.46 : 0.23, 0.08 + area / 3200);
    g.beginPath();
    g.arc(((world.bMinX[i] + world.bMaxX[i]) / 2 - world.minX) * kx, ((world.bMinZ[i] + world.bMaxZ[i]) / 2 - world.minZ) * kz,
      (26 + Math.sqrt(area) * 0.6) * kx, 0, Math.PI * 2);
    g.fill();
  }
  return cv;
}

/** Seznam ploch a vodních toků zasahujících do každé dlaždice. */
function surfaceContext(world, districts, x, z) {
  if (districts.at(x, z)) return 2;
  return Number((world.bChunks[world.chunkIndex(x, z)]?.length ?? 0) >= 44);
}

function buildLandIndex(world, districts) {
  const L = world.l;
  const polys = new Array(world.cols * world.rows), lines = new Array(world.cols * world.rows), fields = new Map();
  const polyContext = new Uint8Array(world.lCount), lineContext = new Uint8Array(L.header.lineCount);
  const put = (arr, x0, x1, z0, z1, id) => {
    const a0 = Math.max(0, Math.floor((x0 - world.minX) / CHUNK)), a1 = Math.min(world.cols - 1, Math.floor((x1 - world.minX) / CHUNK));
    const b0 = Math.max(0, Math.floor((z0 - world.minZ) / CHUNK)), b1 = Math.min(world.rows - 1, Math.floor((z1 - world.minZ) / CHUNK));
    for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) (arr[b * world.cols + a] || (arr[b * world.cols + a] = [])).push(id);
  };
  for (let i = 0; i < world.lCount; i++) {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let v = L.ringStart[L.pRing[i]], ve = L.ringStart[L.pRing[i + 1]]; v < ve; v++) {
      const x = L.vx[v] * 0.1, z = L.vz[v] * 0.1;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    const shore = L.cls[i] === LC.WATER ? 6 : 0;
    put(polys, x0 - shore, x1 + shore, z0 - shore, z1 + shore, i);
    polyContext[i] = surfaceContext(world, districts, (x0 + x1) * 0.5, (z0 + z1) * 0.5);
    if (L.cls[i] === LC.FARMLAND) {
      const first = L.ringStart[L.pRing[i]], last = L.ringStart[L.pRing[i] + 1];
      let longest = 0, angle = 0;
      for (let v = first, prev = last - 1; v < last; prev = v++) {
        const dx = L.vx[v] - L.vx[prev], dz = L.vz[v] - L.vz[prev];
        const length = dx * dx + dz * dz;
        if (length > longest) { longest = length; angle = Math.atan2(dz, dx); }
      }
      fields.set(i, { angle, pitch: 5.5 + hash(i, 25) * 4, color: pick(FIELD_COLORS, hash(i, 22)) });
    }
  }
  for (let i = 0; i < L.header.lineCount; i++) {
    if (L.lCls[i] > 3) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let v = L.lStart[i], ve = L.lStart[i + 1]; v < ve; v++) {
      const x = L.lx[v] * 0.1, z = L.lz[v] * 0.1;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    put(lines, x0 - 8, x1 + 8, z0 - 8, z1 + 8, i);
    const mid = (L.lStart[i] + L.lStart[i + 1]) >> 1;
    lineContext[i] = surfaceContext(world, districts, L.lx[mid] * 0.1, L.lz[mid] * 0.1);
  }
  return { polys, lines, fields, polyContext, lineContext };
}

function drawFieldRows(g, field, x0, z0) {
  const { angle, pitch } = field;
  const x = x0 + CHUNK / 2, z = z0 + CHUNK / 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const u = x * cos + z * sin, v = z * cos - x * sin;
  const reach = CHUNK * Math.SQRT1_2 + 2;
  g.save();
  g.clip('evenodd');
  g.rotate(angle);
  for (let row = Math.floor((v - reach) / pitch); row * pitch < v + reach; row++) {
    g.fillStyle = row % 4 === 0 ? '#72694e24' : '#6d654619';
    g.fillRect(u - reach, row * pitch, reach * 2, row % 4 === 0 ? 1.2 : 0.72);
  }
  g.restore();
}

/** Nakreslí povrch země jedné dlaždice (plochy, chodníky, pěšiny, podklad silnic, vodu jako průhlednost). */
function drawGround(mgr, ci, S, tile, bitmap) {
  const world = mgr.world, L = world.l;
  const cxi = ci % world.cols, czi = Math.floor(ci / world.cols);
  const cx0 = world.minX + cxi * CHUNK, cz0 = world.minZ + czi * CHUNK;
  let sc = mgr.scratch.get(S);
  if (!sc) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    sc = { cv, g: cv.getContext('2d') };
    mgr.scratch.set(S, sc);
  }
  const g = sc.g;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, S, S);
  const dk = mgr.density.width / (world.maxX - world.minX), dkz = mgr.density.height / (world.maxZ - world.minZ);
  g.imageSmoothingEnabled = true;
  g.drawImage(mgr.density, (cx0 - world.minX) * dk, (cz0 - world.minZ) * dkz, CHUNK * dk, CHUNK * dkz, 0, 0, S, S);
  const k = S / CHUNK;
  g.setTransform(k, 0, 0, k, -cx0 * k, -cz0 * k);
  g.lineCap = 'round'; g.lineJoin = 'round';

  const polyPath = (i, ctx = g) => {
    ctx.beginPath();
    for (let rg = L.pRing[i], r1 = L.pRing[i + 1]; rg < r1; rg++) {
      const v0 = L.ringStart[rg], v1 = L.ringStart[rg + 1];
      for (let v = v0; v < v1; v++) {
        if (v === v0) ctx.moveTo(L.vx[v] * 0.1, L.vz[v] * 0.1);
        else ctx.lineTo(L.vx[v] * 0.1, L.vz[v] * 0.1);
      }
      ctx.closePath();
    }
  };
  const polys = mgr.landIndex.polys[ci];
  let overlay;
  if (bitmap && polys) {
    overlay = mgr.orthoScratch.get(S);
    if (!overlay) {
      overlay = document.createElement('canvas').getContext('2d');
      overlay.canvas.width = overlay.canvas.height = S;
      mgr.orthoScratch.set(S, overlay);
    }
    overlay.setTransform(k, 0, 0, k, -cx0 * k, -cz0 * k);
    overlay.clearRect(cx0, cz0, CHUNK, CHUNK);
  }
  if (polys) {
    for (let group = 0; group < 3; group++) {
      for (const i of polys) {
        const cls = L.cls[i];
        if (LAND_GROUP[cls] !== group) continue;
        polyPath(i);
        const context = mgr.landIndex.polyContext[i];
        const field = mgr.landIndex.fields.get(i);
        let color = LAND_HEX[cls];
        if (field) color = field.color;
        else if (cls === LC.MEADOW) color = pick(MEADOW_COLORS, hash(i, 20));
        else if (cls === LC.FOREST) color = pick(FOREST_COLORS, hash(i, 20));
        else if (cls === LC.PLAZA && context === 2) color = '#b9ae9c';
        else if (cls === LC.RESIDENTIAL && context < 2) color = context ? '#a6aa92' : '#a2ae85';
        g.fillStyle = color;
        g.fill('evenodd');
        if (field && !overlay && hash(i, 24) > 0.15) drawFieldRows(g, field, cx0, cz0);
        if (overlay) {
          overlay.globalCompositeOperation = ORTHOPHOTO_LAND.has(cls) ? 'source-over' : 'destination-out';
          polyPath(i, overlay);
          overlay.fill('evenodd');
        }
      }
    }
  }
  if (overlay) {
    overlay.globalCompositeOperation = 'source-in';
    overlay.drawImage(bitmap, tile.left, tile.top, tile.pixels, tile.pixels, cx0, cz0, CHUNK, CHUNK);
    g.save();
    g.beginPath();
    g.rect(world.playMinX, world.playMinZ, world.playMaxX - world.playMinX, world.playMaxZ - world.playMinZ);
    g.clip();
    g.globalAlpha = 0.8;
    g.globalCompositeOperation = 'soft-light';
    g.drawImage(overlay.canvas, cx0, cz0, CHUNK, CHUNK);
    g.restore();
  }
  const forgeBasin = cx0 < FORGE.x + 126 && cx0 + CHUNK > FORGE.x - 126 &&
    cz0 < FORGE.z + 126 && cz0 + CHUNK > FORGE.z - 126;
  if (forgeBasin) {
    // Trávníky v areálu hamru. Cesty a vodní plochy se kreslí v dalších průchodech.
    const lawn = g.createRadialGradient(FORGE.x, FORGE.z + 7, 17, FORGE.x, FORGE.z + 7, 125);
    lawn.addColorStop(0, 'rgba(137,147,105,0.91)');
    lawn.addColorStop(0.47, 'rgba(147,159,111,0.70)');
    lawn.addColorStop(1, 'rgba(147,159,111,0)');
    g.fillStyle = lawn;
    g.fillRect(cx0, cz0, CHUNK, CHUNK);
  }
  if (polys) {
    for (const i of polys) {
      if (L.cls[i] !== LC.WATER) continue;
      polyPath(i);
      const urban = mgr.landIndex.polyContext[i] === 2;
      g.strokeStyle = urban ? '#8e877650' : '#657c4350';
      g.lineWidth = 10;
      g.stroke();
      g.strokeStyle = urban ? '#766d6260' : '#69725065';
      g.lineWidth = 3;
      g.stroke();
    }
  }
  // potoky
  const lines = mgr.landIndex.lines[ci];
  if (lines) {
    for (const i of lines) {
      const cls = L.lCls[i];
      const width = cls === 0 ? 8 : cls === 1 ? 5 : cls === 2 ? 2.2 : 1.2;
      if (forgeBasin) {
        g.save();
        g.beginPath();
        g.rect(cx0 - 1, cz0 - 1, CHUNK + 2, CHUNK + 2);
        const bounds = [[4.2, -20], [13.5, -20], [12.5, 20], [4.2, 20]];
        bounds.forEach(([x, z], index) => index ? g.lineTo(...forgeXZ(x, z)) : g.moveTo(...forgeXZ(x, z)));
        g.closePath();
        g.clip('evenodd');
      }
      g.beginPath();
      for (let v = L.lStart[i], ve = L.lStart[i + 1]; v < ve; v++) {
        if (v === L.lStart[i]) g.moveTo(L.lx[v] * 0.1, L.lz[v] * 0.1); else g.lineTo(L.lx[v] * 0.1, L.lz[v] * 0.1);
      }
      g.strokeStyle = mgr.landIndex.lineContext[i] === 2 ? '#81807158' : '#60734472';
      g.lineWidth = width + 4;
      g.stroke();
      g.strokeStyle = HEX.stream;
      g.lineWidth = width;
      g.stroke();
      if (forgeBasin) g.restore();
    }
  }
  // sousední dlaždice (pásy přesahují přes hranu)
  const near = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const a = cxi + dx, b = czi + dz;
    if (a >= 0 && b >= 0 && a < world.cols && b < world.rows) near.push(b * world.cols + a);
  }
  // štěrkové lože železnice
  g.strokeStyle = HEX.ballast; g.lineWidth = 3.4;
  for (const c of near) {
    const rails = world.railChunks[c];
    if (!rails) continue;
    for (const ri of rails) {
      const r = world.rails[ri];
      if (r.cls !== 1 || r.y) continue;
      g.beginPath(); g.moveTo(r.pts[0], r.pts[1]);
      for (let q = 2; q < r.pts.length; q += 2) g.lineTo(r.pts[q], r.pts[q + 1]);
      g.stroke();
    }
  }
  const R = world.r, px = world.rpx, pz = world.rpz;
  const stroke = (pass) => {
    for (const c of near) {
      const pieces = world.rPieces[c];
      if (!pieces) continue;
      for (let q = 0; q < pieces.length; q += 3) {
        const i = pieces[q], cls = R.cls[i], flags = R.flags[i];
        if ((flags & RF.BRIDGE) || world.tunnelRoads.has(i)) continue;
        let width, style;
        if (pass === 0) {           // chodníky podél ulic
          if (cls < RC.PRIMARY || cls > RC.LIVING || cls === RC.PRIMARY_LINK || cls === RC.SECONDARY_LINK || (flags & RF.TUNNEL)) continue;
          const verge = mgr.roadVerge[i];
          width = R.w[i] + (verge ? 4 : 3);
          style = verge === 2 ? '#a8a399' : verge ? HEX.sidewalk : '#92947b';
        } else if (pass === 1) {    // pěšiny, cyklostezky, polní cesty
          if (cls <= RC.PEDESTRIAN) continue;
          width = R.w[i]; style = roadHex(cls);
        } else {                    // podklad vozovek (přesnou geometrii kreslí síť silnic)
          if (cls > RC.PEDESTRIAN) continue;
          width = Math.max(1.5, R.w[i] - 1.2); style = roadHex(cls);      // užší než přesná síť, ať zpod ní nevyčuhuje rozmazaný okraj
        }
        g.strokeStyle = style; g.lineWidth = width;
        g.beginPath();
        g.moveTo(px[pieces[q + 1]], pz[pieces[q + 1]]);
        for (let p = pieces[q + 1] + 1; p <= pieces[q + 2]; p++) g.lineTo(px[p], pz[p]);
        g.stroke();
      }
    }
  };
  stroke(0); stroke(1); stroke(2);
  // voda = průhledná místa (hladinu dokreslí shader terénu)
  if (polys) {
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    for (const i of polys) {
      if (L.cls[i] !== LC.WATER) continue;
      polyPath(i);
      g.fill('evenodd');
    }
    g.globalCompositeOperation = 'source-over';
  }
  return sc.cv;
}

// --------------------------------------------------------------- stromy ----
let treeGeoA = null, treeGeoB = null, treeMat = null;
function treeAssets() {
  if (treeGeoA) return;
  // crowns = seznam [geometrie, x, y, z]; koruna je nahoře světlejší
  const mk = (crowns, trunkH, trunkR, trunkCol, crownCol) => {
    const trunk = new THREE.CylinderGeometry(trunkR * 0.65, trunkR, trunkH + 0.6, 6, 1, true);
    trunk.translate(0, trunkH / 2 - 0.3, 0);
    const pos = [], nor = [], col = [];
    let y0 = 1e9, y1 = -1e9;
    for (const c of crowns) { c[0].translate(c[1], c[2], c[3]); c[0].computeBoundingBox(); y0 = Math.min(y0, c[0].boundingBox.min.y); y1 = Math.max(y1, c[0].boundingBox.max.y); }
    const add = (g, c, crown) => {
      const gi = g.index ? g.toNonIndexed() : g;
      if (crown) gi.computeVertexNormals();
      const p = gi.attributes.position, n = gi.attributes.normal;
      for (let k = 0; k < p.count; k += 3) {
        // jedna barva na plošku: podle výšky a natočení
        const my = (p.getY(k) + p.getY(k + 1) + p.getY(k + 2)) / 3;
        const shade = crown ? 0.66 + 0.42 * (my - y0) / (y1 - y0) + 0.08 * Math.sin(k * 12.9898) : 1;
        for (let q = 0; q < 3; q++) {
          pos.push(p.getX(k + q), p.getY(k + q), p.getZ(k + q));
          nor.push(n.getX(k + q), n.getY(k + q), n.getZ(k + q));
          col.push(c[0] * shade, c[1] * shade, c[2] * shade);
        }
      }
    };
    add(trunk, trunkCol, false);
    for (const c of crowns) add(c[0], crownCol, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  };
  treeGeoA = mk([
    [new THREE.IcosahedronGeometry(2.1, 0), 0, 4.6, 0],
    [new THREE.IcosahedronGeometry(1.6, 0), 1.1, 5.6, 0.4],
    [new THREE.IcosahedronGeometry(1.5, 0), -0.9, 5.2, -0.8],
    [new THREE.IcosahedronGeometry(1.3, 0), -0.2, 6.4, 0.7],
  ], 3.4, 0.24, lin(0x5b4a3a), lin(0x5f9146));
  treeGeoB = mk([
    [new THREE.ConeGeometry(1.9, 3.4, 7), 0, 3.6, 0],
    [new THREE.ConeGeometry(1.5, 3.0, 7), 0, 5.4, 0],
    [new THREE.ConeGeometry(1.0, 2.6, 7), 0, 7.1, 0],
  ], 2.4, 0.2, lin(0x4f4034), lin(0x3d6c44));
  treeMat = makeSurfaceMaterial(SURFACE.grass, { vertexColors: true });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function buildTrees(world, ci, cx0, cz0, forest) {
  treeAssets();
  const A = [], Bc = [];
  const obstacles = [];
  const list = world.treeChunks[ci];
  const T = world.trees;
  const nearby = {};
  if (list) {
    for (const t of list) {
      const x = T.x[t] * 0.1, z = T.z[t] * 0.1;
      if (world.buildingAt(x, z) >= 0 || world.isWater(x, z)) continue;
      const road = world.nearestRoad(x, z, 12, DRIVABLE_MAX, 0, nearby);
      if (road && road.dist < world.r.w[road.road] / 2 - 0.2) continue;
      A.push(x, z, 0.8 + hash(t, 5) * 0.6, hash(t, 6));
      obstacles.push(x, z, 0.28);
    }
  }
  // Rozptyl ve skutečných půdorysech lesa včetně děr a úzkých pásů.
  let seed = ci * 7919 + 13;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const N = QUALITY.treesPerForestChunk;
  if (forest.length) {
    const coniferShare = 0.33 + hash(ci, 61) * 0.47;
    for (let k = 0; k < N; k++) {
      const x = cx0 + rnd() * CHUNK, z = cz0 + rnd() * CHUNK;
      const s = 0.82 + rnd() * 1.15, r = rnd(), conifer = rnd() < coniferShare;
      if (!forest.some((poly) => world.landContains(poly, x, z))) continue;
      if (world.buildingAt(x, z) >= 0 || world.isWater(x, z)) continue;
      const road = world.nearestRoad(x, z, 12, 99, 0, nearby);
      if (road && road.dist < world.r.w[road.road] / 2 + 1.5) continue;
      (conifer ? Bc : A).push(x, z, s, r);
      if (k % 2 === 0) obstacles.push(x, z, 0.3);
    }
  }
  const meshes = [];
  for (const [arr, geo] of [[A, treeGeoA], [Bc, treeGeoB]]) {
    const n = arr.length / 4;
    if (!n) continue;
    const mesh = new THREE.InstancedMesh(geo, treeMat, n);
    for (let k = 0; k < n; k++) {
      const s = arr[k * 4 + 2];
      _p.set(arr[k * 4], world.heightAt(arr[k * 4], arr[k * 4 + 1]), arr[k * 4 + 1]);
      _q.setFromAxisAngle(_up, arr[k * 4 + 3] * 6.283);
      _s.set(s, s * (0.9 + arr[k * 4 + 3] * 0.3), s);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(k, _m);
      const g = 0.82 + arr[k * 4 + 3] * 0.36;
      mesh.setColorAt(k, _c.setRGB(g * (0.9 + arr[k * 4 + 3] * 0.25), g, g * 0.85));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    meshes.push(mesh);
  }
  return { meshes, obstacles };
}

// ---------------------------------------------------------------- lampy ----
const LAMP_POLE = lin(0x3a3f45), LAMP_HEAD = lin(SURFACE.lamp.emissive);
const lampSurfaces = new Map([[LAMP_HEAD, SURFACE.lamp]]);
const lampGeometry = new Map();
const lampMatrix = new THREE.Matrix4();
const hiddenLamp = new THREE.Matrix4().makeScale(0, 0, 0);

function buildLamps(world, ci) {
  const entries = world.lampsInTile(ci);
  if (!entries.length) return null;
  const poles = new THREE.Group();
  const instances = new Map();
  for (const lamp of entries) {
    let batch = instances.get(lamp.height);
    if (!batch) {
      let geometry = lampGeometry.get(lamp.height);
      if (!geometry) {
        const parts = new Parts(SURFACE.metal, lampSurfaces);
        parts.box(0.16, lamp.height + 0.5, 0.16, 0, lamp.height / 2 - 0.25, 0, LAMP_POLE);
        parts.box(lamp.head, 0.14, lamp.head, 0, lamp.height + 0.07, 0, LAMP_HEAD);
        geometry = parts.geometry();
        lampGeometry.set(lamp.height, geometry);
      }
      batch = new THREE.InstancedMesh(geometry, getDetailMaterial(), entries.filter(e => e.height === lamp.height).length);
      batch.count = 0;
      instances.set(lamp.height, batch);
      poles.add(batch);
    }
    lamp.instance = batch.count++;
    batch.setMatrixAt(lamp.instance, lampMatrix.makeTranslation(lamp.x, lamp.y, lamp.z));
  }
  // Pevné meze zahrnují i sloupy, které při návratu do dlaždice čekají na opravu.
  for (const batch of instances.values()) batch.computeBoundingSphere();
  const pp = [], pu = [], pi = [];
  for (const lamp of entries) {
    const b = pp.length / 3;
    for (let v = 0; v <= 3; v++) for (let u = 0; u <= 3; u++) {
      const x = lamp.lightX + (u / 3 * 2 - 1) * lamp.radius;
      const z = lamp.lightZ + (v / 3 * 2 - 1) * lamp.radius;
      pp.push(x, world.heightAt(x, z) + SURF + 0.07, z);
      pu.push(u / 3, v / 3);
    }
    for (let v = 0; v < 3; v++) for (let u = 0; u < 3; u++) {
      const a = b + v * 4 + u;
      pi.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
    }
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  pg.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
  pg.setIndex(pi);
  pg.computeBoundingSphere();
  const pools = new THREE.Mesh(pg, getPoolMaterial());
  pools.renderOrder = 18; pools.matrixAutoUpdate = false;
  const visuals = entries.map((lamp, index) => {
    const obstacle = [lamp.x, lamp.z, 0.14];
    let shown = false;
    return { id: lamp.id, show(intact) {
      const batch = instances.get(lamp.height);
      batch.setMatrixAt(lamp.instance, intact ? lampMatrix.makeTranslation(lamp.x, lamp.y, lamp.z) : hiddenLamp);
      batch.instanceMatrix.needsUpdate = true;
      const start = index * 54;
      for (let i = start; i < start + 54; i++) pg.index.array[i] = intact ? pi[i] : pi[start];
      pg.index.needsUpdate = true;
      if (intact && !shown) world.addObstacles(obstacle);
      if (!intact && shown) world.removeObstacles(obstacle);
      shown = intact;
    }, remove() { if (shown) world.removeObstacles(obstacle); } };
  });
  return { poles, pools, visuals, dispose() {
    for (const batch of instances.values()) batch.dispose();
    pg.dispose();
  } };
}

// ------------------------------------------------------------- správce ----
const STAGES = 4;       // 0 terén, 1 budovy, 2 silnice a mosty, 3 stromy a lampy

export class ChunkManager {
  constructor(scene, world, renderer, heritage, orthophotoSources) {
    this.scene = scene;
    this.world = world;
    this.renderer = renderer;
    this.chunks = new Map();
    if (orthophotoSources && PARAMS.get('orthophoto') !== '0') {
      this.orthophoto = new Orthophoto({
        origin: [world.minX, world.minZ], cols: world.cols, rows: world.rows,
        chunk: CHUNK, fingerprints: orthophotoSources,
      }, QUALITY.groundTex === 256 ? 12 : 24, {
        availableRequests: () => detailRequestLimit() - this.heritage.fetching,
      });
    }
    this.buildingMat = makeBuildingMaterial();
    this.paintedBuildings = QUALITY.heritageDetail ? makeBuildingMaterial({ textures: true }) : this.buildingMat;
    this.districts = new Districts(heritage.districts);
    this.heritage = new Heritage(world, heritage);
    this.asphaltMat = makeDecalMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
    this.marksMat = makeDecalMaterial({ polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 }, SURFACE.roadPaint);
    this.solidMat = makeSurfaceMaterial(SURFACE.concrete, { vertexColors: true, side: THREE.DoubleSide });
    if (world.tunnels.length) {
      const lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      for (const tunnel of world.tunnels) {
        const geo = buildTunnel(world, tunnel);
        const structure = new THREE.Mesh(geo.solid, this.solidMat);
        structure.castShadow = true;
        structure.receiveShadow = true;
        scene.add(structure, new THREE.Mesh(geo.lights, lightMat));
      }
    }
    this.density = buildDensity(world);
    this.landIndex = buildLandIndex(world, this.districts);
    this.roadVerge = new Uint8Array(world.rCount);
    for (let i = 0; i < world.rCount; i++) {
      if (world.r.cls[i] < RC.PRIMARY || world.r.cls[i] > RC.LIVING) continue;
      const mid = (world.rOff[i] + world.rOff[i + 1]) >> 1;
      this.roadVerge[i] = surfaceContext(world, this.districts, world.rpx[mid], world.rpz[mid]);
    }
    this.scratch = new Map();
    this.orthoScratch = new Map();
    this.aniso = Math.min(4, renderer.getMaxAnisotropy());
    this.texNear = QUALITY.groundTex; this.texFar = QUALITY.groundTexFar;
    this.lastCenter = -1;
    this.pending = 0;
    this.orthophotoPrepared = false;
    this.orthophotoDrawnRevision = 0;
  }

  setOrthophotoEnabled(enabled) {
    if (!this.orthophoto) return;
    this.orthophotoEnabled = enabled;
    this.orthophotoPrepared = false;
    if (enabled) void this.orthophoto.load();
    else this.orthophoto.prefetch([]);
  }

  applyQuality() {
    for (const chunk of this.chunks.values()) this._dispose(chunk);
    this.chunks.clear();
    this.lastCenter = -1;
    this.texNear = QUALITY.groundTex;
    this.texFar = QUALITY.groundTexFar;
    this.orthophotoPrepared = false;
    if (this.orthophoto) this.orthophoto.capacity = QUALITY.groundTex === 256 ? 12 : 24;
    if (this.paintedBuildings !== this.buildingMat) this.paintedBuildings.dispose();
    this.paintedBuildings = QUALITY.heritageDetail ? makeBuildingMaterial({ textures: true }) : this.buildingMat;
    this.heritage.applyQuality();
  }

  get orthophotoPending() {
    const orthophoto = this.orthophoto;
    return Boolean(orthophoto && (orthophoto.requests || orthophoto.revision !== this.orthophotoDrawnRevision));
  }

  _texture(ci, ch, S) {
    ch.orthoBitmap = this.orthophoto?.get(ch.orthoTile?.key) ?? null;
    const cv = drawGround(this, ci, S, ch.orthoTile, ch.orthoBitmap);
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;
    tex.premultiplyAlpha = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.aniso;
    this.renderer.initTexture(tex);     // nahraje se hned, sdílené plátno pak slouží další dlaždici
    return tex;
  }

  _buildBuildings(ci, ch) {
    const list = this.heritage.buildings(ci);
    const geo = list ? buildBuildings(this.world, list, this.heritage.replaced, ch.district) : null;
    if (ch.regularBuildings) {
      ch.group.remove(ch.regularBuildings);
      ch.regularBuildings.geometry.dispose();
    }
    ch.regularBuildings = geo ? new THREE.Mesh(geo, ch.dist < 420 ? this.paintedBuildings : this.buildingMat) : null;
    if (ch.regularBuildings) {
      ch.regularBuildings.castShadow = true;
      ch.regularBuildings.receiveShadow = true;
      ch.group.add(ch.regularBuildings);
    }
  }

  /** Provede další krok stavby dlaždice. */
  _step(ci, ch) {
    const w = this.world;
    const cx = ci % w.cols, cz = Math.floor(ci / w.cols);
    const x0 = w.minX + cx * CHUNK, z0 = w.minZ + cz * CHUNK;
    const add = (mesh, geo) => { mesh.matrixAutoUpdate = false; ch.group.add(mesh); if (geo) ch.disposables.push(geo); };
    if (ch.stage === 0) {
      const geo = buildTerrain(w, ci, x0, z0);
      ch.texSize = ch.dist < 420 ? this.texNear : this.texFar;
      ch.tex = this._texture(ci, ch, ch.texSize);
      const portals = w.tunnels.flatMap((tunnel) => tunnel.portalCuts(x0, z0, CHUNK));
      ch.terrainMat = makeTerrainMaterial(ch.tex, portals, pavingChunk(x0, z0), QUALITY.heritageDetail);
      const m = new THREE.Mesh(geo, ch.terrainMat);
      m.receiveShadow = true; m.renderOrder = 5;
      add(m, geo);
    } else if (ch.stage === 1) {
      ch.heritage = this.heritage.build(ci, ch);
      this._buildBuildings(ci, ch);
    } else if (ch.stage === 2) {
      const roads = buildRoads(w, ci);
      if (roads.solid) { const m = new THREE.Mesh(roads.solid, this.solidMat); m.castShadow = true; m.receiveShadow = true; add(m, roads.solid); }
      if (roads.furniture.length) ch.roadFurniture = attachRoadFurniture(w.breakables, ch.group,
        roads.solid, this.solidMat, roads.furniture);
      if (roads.asphalt) { const m = new THREE.Mesh(roads.asphalt, this.asphaltMat); m.renderOrder = 14; m.receiveShadow = true; add(m, roads.asphalt); ch.asphalt = m; }
      if (roads.marks) { const m = new THREE.Mesh(roads.marks, this.marksMat); m.renderOrder = 16; m.receiveShadow = true; add(m, roads.marks); ch.marks = m; }
      const entries = w.traffic.chunks.get(ci);
      if (entries && (entries.signs.length || entries.heads.length || entries.posts?.length)) {
        ch.traffic = buildTrafficMeshes(w, entries);
        add(ch.traffic.group);
      }
    } else {
      const forest = this.landIndex.polys[ci]?.filter((i) => w.l.cls[i] === LC.FOREST) ?? [];
      const trees = buildTrees(w, ci, x0, z0, forest);
      for (const m of trees.meshes) { m.matrixAutoUpdate = false; ch.group.add(m); }
      ch.trees = trees.meshes;
      ch.obstacles = trees.obstacles;
      const lamps = buildLamps(w, ci);
      if (lamps) {
        ch.group.add(lamps.poles, lamps.pools);
        for (const visual of lamps.visuals) w.breakables.attach(visual);
        ch.lamps = lamps;
      }
      w.addObstacles(ch.obstacles);
    }
    ch.stage++;
  }

  _dispose(ch) {
    this.scene.remove(ch.group);
    this.heritage.dispose(ch);
    ch.regularBuildings?.geometry.dispose();
    for (const g of ch.disposables) g.dispose();
    for (const m of ch.trees) m.dispose();
    if (ch.tex) ch.tex.dispose();
    if (ch.terrainMat) ch.terrainMat.dispose();
    ch.traffic?.dispose();
    for (const visual of ch.roadFurniture ?? []) this.world.breakables.detach(visual);
    if (ch.lamps) {
      for (const visual of ch.lamps.visuals) this.world.breakables.detach(visual);
      ch.lamps.dispose();
    }
    this.world.removeObstacles(ch.obstacles);
  }

  /** Udržuje načtené dlaždice kolem bodu; za jedno volání provede nejvýš `budget` kroků stavby. */
  update(x, z, view, budget = 1, y) {
    const w = this.world;
    const ccx = Math.floor((x - w.minX) / CHUNK), ccz = Math.floor((z - w.minZ) / CHUNK);
    const center = ccz * 4096 + ccx;
    const newCenter = center !== this.lastCenter || this._view !== view;
    if (newCenter) {
      this.lastCenter = center; this._view = view;
      const rad = Math.ceil(view / CHUNK) + 1;
      const want = new Set();
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        const cx = ccx + dx, cz = ccz + dz;
        if (cx < 0 || cz < 0 || cx >= w.cols || cz >= w.rows) continue;
        if (Math.hypot(dx, dz) * CHUNK > view + CHUNK * 0.8) continue;
        const ci = cz * w.cols + cx;
        want.add(ci);
        if (!this.chunks.has(ci)) {
          const group = new THREE.Group();
          group.matrixAutoUpdate = false;
          this.scene.add(group);
          const centerX = w.minX + (cx + 0.5) * CHUNK, centerZ = w.minZ + (cz + 0.5) * CHUNK;
          const orthoTile = this.orthophoto && this.landIndex.polys[ci]?.some((i) => ORTHOPHOTO_LAND.has(w.l.cls[i]))
            ? orthophotoTile(ci, w.cols, CHUNK) : null;
          this.chunks.set(ci, {
            ci, group, district: this.districts.at(centerX, centerZ), disposables: [], obstacles: [], trees: [], lamps: null, asphalt: null, marks: null,
            stage: 0, tex: null, terrainMat: null, texSize: 0, dist: 0,
            orthoTile, orthoBitmap: null,
            cx: centerX, cz: centerZ,
          });
        }
      }
      for (const [ci, ch] of this.chunks) {
        if (!want.has(ci)) { this._dispose(ch); this.chunks.delete(ci); }
      }
    }
    // vzdálenosti, viditelnost lamp a výběr práce: nejdřív terén všude, pak detaily od nejbližších
    const night = env.night.value > 0.03;
    let pending = 0, pendingStart = 0, rebake = null;
    const todo = [], cityRequests = [];
    const orthophoto = this.orthophoto;
    const orthoRequests = this.orthophotoEnabled && orthophoto?.blocks &&
      (newCenter || !this.orthophotoPrepared) ? new Map() : null;
    for (const [ci, ch] of this.chunks) {
      const d = Math.hypot(ch.cx - x, ch.cz - z);
      ch.dist = d;
      if (orthoRequests && ch.orthoTile) {
        const key = ch.orthoTile.key;
        if (d < (orthoRequests.get(key) ?? Infinity)) orthoRequests.set(key, d);
      }
      if (!ch.cityRequest && d < 1080 && this.heritage.cells.has(ci)) cityRequests.push(ch);
      if (ch.regularBuildings) {
        ch.regularBuildings.material = d < 420 ? this.paintedBuildings : this.buildingMat;
      }
      if (ch.stage >= 2 && ch.cityData) {
        todo.push([d + 1e6 - 0.01, ci, ch, true]);
        if (d < 520) pendingStart++;
      }
      if (ch.heritage) this.heritage.update(ch.heritage, x, z, y);
      if (ch.lamps) { ch.lamps.poles.visible = d < 560; ch.lamps.pools.visible = night && d < 1100; }
      // v dálce stačí silnice nakreslené v textuře země; přesná síť a čáry jen poblíž
      if (ch.asphalt) ch.asphalt.visible = d < 800;
      if (ch.marks) ch.marks.visible = d < 480;
      if (ch.traffic) {
        ch.traffic.group.visible = d < 400;
        if (ch.traffic.group.visible) ch.traffic.update();
      }
      if (ch.stage < STAGES) {
        pending++;
        if (ch.stage === 0 || d < 520) pendingStart += ch.stage === 0 && d >= 520 ? 1 : STAGES - ch.stage;
        todo.push([ch.stage === 0 ? d : d + 1e6, ci, ch]);
      }
      else if (this.texNear !== this.texFar && ch.tex) {
        // jemnější textura země poblíž, hrubší v dálce (šetří paměť grafické karty)
        if (ch.texSize === this.texFar && d < 380 && (!rebake || d < rebake[0])) rebake = [d, ci, ch, this.texNear];
        else if (ch.texSize === this.texNear && d > 640 && !rebake) rebake = [d, ci, ch, this.texFar];
      }
    }
    this.heritage.prefetch(cityRequests, orthophoto?.requests);
    let orthoRebake;
    if (orthoRequests) {
      orthophoto.prefetch([...orthoRequests].sort((a, b) => a[1] - b[1]).map(([key]) => key));
      this.orthophotoPrepared = true;
    } else if (this.orthophotoEnabled) {
      orthophoto.pump();
    }
    if (orthophoto && orthophoto.revision !== this.orthophotoDrawnRevision && budget > 0) {
      for (const ch of this.chunks.values()) {
        if (!ch.tex || !ch.orthoTile || (orthoRebake && ch.dist >= orthoRebake.dist)) continue;
        const bitmap = orthophoto.cache.get(ch.orthoTile.key) ?? null;
        if (bitmap !== ch.orthoBitmap) orthoRebake = ch;
      }
      if (orthoRebake) {
        const ch = orthoRebake;
        ch.orthoBitmap = orthophoto.get(ch.orthoTile.key);
        drawGround(this, ch.ci, ch.texSize, ch.orthoTile, ch.orthoBitmap);
        ch.tex.needsUpdate = true;
        this.renderer.initTexture(ch.tex);
      } else {
        this.orthophotoDrawnRevision = orthophoto.revision;
      }
    }
    let done = 0;
    if (todo.length) {
      todo.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < todo.length && done < budget; k++) {
        const [, ci, ch, city] = todo[k];
        if (city) {
          ch.heritage = this.heritage.build(ci, ch);
          this._buildBuildings(ci, ch);
          this.heritage.update(ch.heritage, x, z, y);
          if (ch.dist < 520) pendingStart--;
          done++;
          continue;
        }
        this._step(ci, ch); done++;
        if (ch.stage === 2 && ch.heritage) this.heritage.update(ch.heritage, x, z, y);
        if (ch.stage >= STAGES) pending--;
        if (ch.stage === 1 || ch.dist < 520) pendingStart--;
      }
    } else if (rebake && !orthoRebake && budget > 0) {
      const ch = rebake[2];
      const tex = this._texture(rebake[1], ch, rebake[3]);
      ch.tex.dispose();
      ch.tex = tex; ch.texSize = rebake[3];
      ch.terrainMat.map = tex;
    }
    this.pending = pending;
    this.pendingStart = Math.max(0, pendingStart);    // kolik kroků zbývá, než jde hrát (terén všude + okolí hotové)
    return done;
  }
}
