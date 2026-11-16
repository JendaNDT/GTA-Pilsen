// Stavba 3D geometrie po dlaždicích: budovy, silnice, koleje, stromy.
import * as THREE from 'three';
import { Earcut } from 'three/src/extras/Earcut.js';
import { CHUNK, QUALITY, BK, BF, RC, RF, LC, DRIVABLE_MAX } from '../config.js';
import { makeBuildingMaterial, makeDecalMaterial, makeTerrainMaterial, getPoolMaterial, env } from './materials.js';
import { Parts, getDetailMaterial } from '../entities/models.js';
import { SURF } from './world.js';

const _c = new THREE.Color();
function lin(hex) { _c.setHex(hex); return [_c.r, _c.g, _c.b]; }
function hash(i, salt = 0) {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
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

/** Vzhled budovy: barva zdi a střechy, styl oken, rozteč oken a výška patra. */
function styleFor(world, i) {
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
  const col = B.colour[i];
  if (col) { _c.setHex(col & 0xffffff); wall = [_c.r, _c.g, _c.b]; }
  const rcol = B.roofColour ? B.roofColour[i] : 0;
  if (rcol) { _c.setHex(rcol & 0xffffff); roof = [_c.r, _c.g, _c.b]; }
  // jemná odchylka jasu, ať nejsou sousední domy stejné
  const k = 0.9 + r3 * 0.18;
  return { wall: [wall[0] * k, wall[1] * k, wall[2] * k], roof, style, bay, floorH };
}

// ------------------------------------------------------------ pomocníci ----
class Buf {
  constructor() { this.p = []; this.n = []; this.c = []; this.w = []; this.i = []; this.vc = 0; }
  v(x, y, z, nx, ny, nz, col, k, wu, wv, ws) {
    this.p.push(x, y, z);
    this.n.push(nx * 127, ny * 127, nz * 127);
    this.c.push(col[0] * k * 255, col[1] * k * 255, col[2] * k * 255);
    this.w.push(wu, wv, ws);
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

function buildBuildings(world, list) {
  const B = world.b, vx = world.bvx, vz = world.bvz;
  const buf = new Buf();
  for (const i of list) {
    const flags = B.flags[i];
    if (flags & BF.HAS_PARTS) continue;
    const st = styleFor(world, i);
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
  concrete: lin(0x9b9a94), railing: lin(0x8d949b),
};
// tytéž barvy pro kreslení do textury země
const HEX = {
  asphalt: '#4b4e54', asphaltMinor: '#55585d', service: '#5e6164', sidewalk: '#9a9da1', pedestrian: '#b3ab9c',
  footway: '#a39f95', path: '#8a7a5e', track: '#7f7257', cycleway: '#8c5b52', steps: '#8a8a8a', ballast: '#6a6259',
  stream: '#4f86a8',
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

/**
 * Zahuštěná lomená čára: body s až e pole (xs, zs), u mostů i výšky mostovky (ys).
 * a, b = meze celé linie – sousední body mimo úsek slouží k plynulému navázání.
 */
function densePath(xs, zs, ys, s, e, a, b, step) {
  const X = [xs[s]], Z = [zs[s]], Y = ys ? [ys[s]] : null;
  for (let k = s; k < e; k++) {
    const dx = xs[k + 1] - xs[k], dz = zs[k + 1] - zs[k];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / step));
    for (let q = 1; q <= n; q++) {
      const t = q / n;
      X.push(xs[k] + dx * t); Z.push(zs[k] + dz * t);
      if (Y) Y.push(ys[k] + (ys[k + 1] - ys[k]) * t);
    }
  }
  return {
    x: X, z: Z, y: Y, n: X.length,
    px: s > a ? xs[s - 1] : NaN, pz: s > a ? zs[s - 1] : NaN,
    nx: e < b ? xs[e + 1] : NaN, nz: e < b ? zs[e + 1] : NaN,
  };
}

/** Směr kolmý na čáru v bodě k (průměr sousedních úseků) + měřítko pro ostré lomy. */
const _nrm = { x: 0, z: 0, scale: 1, dot: 1 };
function pathNormal(D, k) {
  const X = D.x, Z = D.z, n = D.n;
  const ax = k > 0 ? X[k - 1] : D.px, az = k > 0 ? Z[k - 1] : D.pz;
  const bx = k < n - 1 ? X[k + 1] : D.nx, bz = k < n - 1 ? Z[k + 1] : D.nz;
  let d0x = 0, d0z = 0, d1x = 0, d1z = 0;
  const has0 = ax === ax, has1 = bx === bx;
  if (has0) { d0x = X[k] - ax; d0z = Z[k] - az; const l = Math.hypot(d0x, d0z) || 1; d0x /= l; d0z /= l; }
  if (has1) { d1x = bx - X[k]; d1z = bz - Z[k]; const l = Math.hypot(d1x, d1z) || 1; d1x /= l; d1z /= l; }
  let nx, nz, scale = 1, dot = 1;
  if (has0 && has1) {
    nx = -(d0z + d1z); nz = d0x + d1x;
    const l = Math.hypot(nx, nz);
    if (l < 1e-4) { nx = -d1z; nz = d1x; } else { nx /= l; nz /= l; }
    dot = nx * -d1z + nz * d1x;
    scale = 1 / Math.max(0.55, dot);
  } else if (has1) { nx = -d1z; nz = d1x; } else { nx = -d0z; nz = d0x; }
  _nrm.x = nx; _nrm.z = nz; _nrm.scale = scale; _nrm.dot = dot;
  return _nrm;
}

/** Pás položený na terén (nebo na mostovku). center = přidat středovou řadu bodů (lépe kopíruje terén). */
function ribbon(world, buf, D, hw, col, lateral, lift, capStart, capEnd, center) {
  const n = D.n;
  let pL = -1, pC = -1, pR = -1;
  for (let k = 0; k < n; k++) {
    const yFn = D.y ? ((kk) => () => D.y[kk] + lift)(k) : (x, z) => world.heightAt(x, z) + SURF + lift;
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
function bridgeSlab(world, solid, D, hw, railings, topCol) {
  const n = D.n;
  if (n < 2 || !D.y) return;
  const T = 0.9;
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
    if (railings) {
      const h = 0.95;
      solid.quad([l0[0], y0, l0[1]], [l1[0], y1, l1[1]], [l1[0], y1 + h, l1[1]], [l0[0], y0 + h, l0[1]], COL.railing);
      solid.quad([r0[0], y0, r0[1]], [r1[0], y1, r1[1]], [r1[0], y1 + h, r1[1]], [r0[0], y0 + h, r0[1]], COL.railing);
    }
    // pilíře po ~26 m, kde je pod mostem dost místa
    const len = Math.hypot(D.x[k + 1] - D.x[k], D.z[k + 1] - D.z[k]);
    acc += len;
    while (acc >= 26 && len > 0) {
      acc -= 26;
      const t = Math.min(1, Math.max(0, 1 - acc / len));
      const x = D.x[k] + (D.x[k + 1] - D.x[k]) * t, z = D.z[k] + (D.z[k + 1] - D.z[k]) * t;
      const yb = y0 + (y1 - y0) * t - T, g = world.heightAt(x, z);
      if (yb - g > 2.5) solid.box(x, g - 0.6, yb, z, Math.min(0.9, hw * 0.35), COL.concrete);
    }
  }
}

function buildRoads(world, ci) {
  const pieces = world.rPieces[ci];
  const R = world.r, px = world.rpx, pz = world.rpz, py = world.rpy, off = world.rOff;
  const asphalt = new DecalBuf(), marks = new DecalBuf(), solid = new SolidBuf();
  if (pieces) {
    for (let q = 0; q < pieces.length; q += 3) {
      const i = pieces[q], s = pieces[q + 1], e = pieces[q + 2];
      const a = off[i], b = off[i + 1] - 1;
      const cls = R.cls[i], w = R.w[i], flags = R.flags[i];
      const bridge = (flags & RF.BRIDGE) !== 0;
      const paved = cls <= DRIVABLE_MAX || cls === RC.PEDESTRIAN;
      if (!paved && !bridge) continue;            // pěšiny a chodníky jsou nakreslené v textuře země
      const hw = w / 2;
      const D = densePath(px, pz, bridge ? py : null, s, e, a, b, bridge ? 1e9 : 4);
      const col = bridge && cls <= DRIVABLE_MAX ? COL.bridge : roadColor(cls);
      ribbon(world, asphalt, D, hw, col, 0, 0, s === a, e === b, hw > 2.2 && !bridge);
      if (bridge) bridgeSlab(world, solid, D, world.deckHalfWidth(i), true, cls <= RC.LIVING ? COL.sidewalk : COL.concrete);
      // vodorovné značení
      if (cls <= RC.UNCLASSIFIED && !(flags & RF.ROUNDABOUT)) {
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
  // koleje
  const rails = world.railChunks[ci];
  if (rails) {
    for (const ri of rails) {
      const rail = world.rails[ri];
      const n = rail.pts.length / 2;
      const rx = new Float32Array(n), rz = new Float32Array(n);
      for (let k = 0; k < n; k++) { rx[k] = rail.pts[k * 2]; rz[k] = rail.pts[k * 2 + 1]; }
      const D = densePath(rx, rz, rail.y, 0, n - 1, 0, n - 1, rail.y ? 1e9 : 4);
      if (rail.cls === 0) ribbon(world, asphalt, D, 1.25, COL.tramBed, 0, 0.004);
      else if (rail.y) ribbon(world, asphalt, D, 1.7, COL.ballast, 0, 0.004);
      ribbon(world, marks, D, 0.07, COL.rail, 0.7175, LIFT_RAIL);
      ribbon(world, marks, D, 0.07, COL.rail, -0.7175, LIFT_RAIL);
      if (rail.y) bridgeSlab(world, solid, D, rail.cls === 1 ? 2.4 : 1.7, true, COL.concrete);
    }
  }
  return { asphalt: asphalt.geometry(), marks: marks.geometry(), solid: solid.geometry() };
}

// ---------------------------------------------------------------- terén ----
let terrainIndex = null;

/** Síť terénu jedné dlaždice (sdílí uzly se sousedy, takže na sebe navazuje beze spár). */
function buildTerrain(world, cx0, cz0) {
  const G = world.tG, N = CHUNK / G, n1 = N + 1;
  const pos = new Float32Array(n1 * n1 * 3), nor = new Float32Array(n1 * n1 * 3), uv = new Float32Array(n1 * n1 * 2);
  const gi0 = Math.round((cx0 - world.tX0) / G), gj0 = Math.round((cz0 - world.tZ0) / G);
  const th = world.th, tc = world.tCols, tr = world.tRows;
  const H = (i, j) => th[Math.min(tr - 1, Math.max(0, j)) * tc + Math.min(tc - 1, Math.max(0, i))];
  let o = 0, u = 0;
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const gi = gi0 + i, gj = gj0 + j;
      pos[o] = cx0 + i * G; pos[o + 1] = H(gi, gj); pos[o + 2] = cz0 + j * G;
      const hx = (H(gi + 1, gj) - H(gi - 1, gj)) / (2 * G), hz = (H(gi, gj + 1) - H(gi, gj - 1)) / (2 * G);
      const l = Math.hypot(hx, 1, hz);
      nor[o] = -hx / l; nor[o + 1] = 1 / l; nor[o + 2] = -hz / l;
      uv[u] = i / N; uv[u + 1] = j / N;
      o += 3; u += 2;
    }
  }
  if (!terrainIndex) {
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const v00 = j * n1 + i, v10 = v00 + 1, v01 = v00 + n1, v11 = v01 + 1;
      idx.push(v00, v01, v10, v10, v01, v11);      // úhlopříčka 10–01, stejně jako world.heightAt
    }
    terrainIndex = new THREE.BufferAttribute(new Uint16Array(idx), 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(terrainIndex);
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
  g.fillStyle = '#a9a69c';
  const kx = S / (world.maxX - world.minX), kz = S / (world.maxZ - world.minZ);
  for (let i = 0; i < world.bCount; i++) {
    const w = world.bMaxX[i] - world.bMinX[i], d = world.bMaxZ[i] - world.bMinZ[i];
    const area = w * d;
    if (area < 40) continue;
    g.globalAlpha = Math.min(0.5, 0.1 + area / 3000);
    g.beginPath();
    g.arc(((world.bMinX[i] + world.bMaxX[i]) / 2 - world.minX) * kx, ((world.bMinZ[i] + world.bMaxZ[i]) / 2 - world.minZ) * kz,
      (26 + Math.sqrt(area) * 0.6) * kx, 0, Math.PI * 2);
    g.fill();
  }
  return cv;
}

/** Seznam ploch a vodních toků zasahujících do každé dlaždice. */
function buildLandIndex(world) {
  const L = world.l;
  const polys = new Array(world.cols * world.rows), lines = new Array(world.cols * world.rows);
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
    put(polys, x0, x1, z0, z1, i);
  }
  for (let i = 0; i < L.header.lineCount; i++) {
    if (L.lCls[i] > 3) continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let v = L.lStart[i], ve = L.lStart[i + 1]; v < ve; v++) {
      const x = L.lx[v] * 0.1, z = L.lz[v] * 0.1;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
    put(lines, x0 - 5, x1 + 5, z0 - 5, z1 + 5, i);
  }
  return { polys, lines };
}

/** Nakreslí povrch země jedné dlaždice (plochy, chodníky, pěšiny, podklad silnic, vodu jako průhlednost). */
function drawGround(mgr, ci, S) {
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

  const polyPath = (i) => {
    g.beginPath();
    for (let rg = L.pRing[i], r1 = L.pRing[i + 1]; rg < r1; rg++) {
      const v0 = L.ringStart[rg], v1 = L.ringStart[rg + 1];
      for (let v = v0; v < v1; v++) {
        if (v === v0) g.moveTo(L.vx[v] * 0.1, L.vz[v] * 0.1); else g.lineTo(L.vx[v] * 0.1, L.vz[v] * 0.1);
      }
      g.closePath();
    }
  };
  const polys = mgr.landIndex.polys[ci];
  if (polys) {
    for (let group = 0; group < 3; group++) {
      for (const i of polys) {
        const cls = L.cls[i];
        if (LAND_GROUP[cls] !== group) continue;
        polyPath(i);
        g.fillStyle = LAND_HEX[cls];
        g.fill('evenodd');
      }
    }
  }
  // potoky
  const lines = mgr.landIndex.lines[ci];
  if (lines) {
    g.strokeStyle = HEX.stream;
    for (const i of lines) {
      const cls = L.lCls[i];
      g.lineWidth = cls === 0 ? 8 : cls === 1 ? 5 : cls === 2 ? 2.2 : 1.2;
      g.beginPath();
      for (let v = L.lStart[i], ve = L.lStart[i + 1]; v < ve; v++) {
        if (v === L.lStart[i]) g.moveTo(L.lx[v] * 0.1, L.lz[v] * 0.1); else g.lineTo(L.lx[v] * 0.1, L.lz[v] * 0.1);
      }
      g.stroke();
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
        if (flags & RF.BRIDGE) continue;
        let width, style;
        if (pass === 0) {           // chodníky podél ulic
          if (cls < RC.PRIMARY || cls > RC.LIVING || cls === RC.PRIMARY_LINK || cls === RC.SECONDARY_LINK || (flags & RF.TUNNEL)) continue;
          width = R.w[i] + 4; style = HEX.sidewalk;
        } else if (pass === 1) {    // pěšiny, cyklostezky, polní cesty
          if (cls <= RC.PEDESTRIAN) continue;
          width = R.w[i]; style = roadHex(cls);
        } else {                    // podklad vozovek (přesnou geometrii kreslí síť silnic)
          if (cls > RC.PEDESTRIAN) continue;
          width = R.w[i] + 0.3; style = roadHex(cls);
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
  treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

function buildTrees(world, ci, cx0, cz0) {
  treeAssets();
  const A = [], Bc = [];
  const obstacles = [];
  const list = world.treeChunks[ci];
  const T = world.trees;
  if (list) {
    for (const t of list) {
      const x = T.x[t] * 0.1, z = T.z[t] * 0.1;
      if (world.buildingAt(x, z) >= 0 || world.isWater(x, z)) continue;
      A.push(x, z, 0.8 + hash(t, 5) * 0.6, hash(t, 6));
      obstacles.push(x, z, 0.28);
    }
  }
  // lesy: náhodný rozptyl podle masky
  let seed = ci * 7919 + 13;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const N = QUALITY.treesPerForestChunk;
  if (world.isForest(cx0 + CHUNK / 2, cz0 + CHUNK / 2) || world.isForest(cx0 + 20, cz0 + 20) || world.isForest(cx0 + CHUNK - 20, cz0 + CHUNK - 20)
    || world.isForest(cx0 + 20, cz0 + CHUNK - 20) || world.isForest(cx0 + CHUNK - 20, cz0 + 20)) {
    const tmp = {};
    for (let k = 0; k < N; k++) {
      const x = cx0 + rnd() * CHUNK, z = cz0 + rnd() * CHUNK;
      const s = 0.9 + rnd() * 0.9, r = rnd(), conifer = rnd() < 0.6;
      if (!world.isForest(x, z)) continue;
      const road = world.nearestRoad(x, z, 6, 99, 0, tmp);
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
const LAMP_POLE = lin(0x3a3f45), LAMP_HEAD = [1.0, 0.93, 0.72];
const _lr = {};

/** Pouliční lampy podél ulic + světelné kužely na zemi (viditelné v noci). */
function buildLamps(world, ci) {
  const pieces = world.rPieces[ci];
  if (!pieces) return null;
  const R = world.r, px = world.rpx, pz = world.rpz;
  const parts = new Parts();
  const pp = [], pu = [], pi = [];
  const obstacles = [];
  let count = 0;
  for (let q = 0; q < pieces.length && count < 90; q += 3) {
    const i = pieces[q], s = pieces[q + 1], e = pieces[q + 2];
    const cls = R.cls[i], flags = R.flags[i];
    if (cls < RC.PRIMARY || cls > RC.LIVING || cls === RC.PRIMARY_LINK || cls === RC.SECONDARY_LINK || cls === RC.TERTIARY_LINK) continue;
    if (flags & (RF.TUNNEL | RF.PRIVATE | RF.BRIDGE)) continue;
    const hw = R.w[i] / 2, tall = cls <= RC.SECONDARY;
    const spacing = tall ? 40 : 34;
    let acc = hash(i, 9) * spacing;
    let side = hash(i, 11) < 0.5 ? 1 : -1;
    for (let k = s; k < e; k++) {
      const x1 = px[k], z1 = pz[k];
      let dx = px[k + 1] - x1, dz = pz[k + 1] - z1;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      dx /= len; dz /= len;
      while (acc < len) {
        const off = hw + 1.3;
        const x = x1 + dx * acc - dz * side * off, z = z1 + dz * acc + dx * side * off;
        acc += spacing;
        if (!tall) side = -side;
        const gy = world.heightAt(x, z);
        if (world.buildingAt(x, z) >= 0 || world.collideCircle(x, z, 0.5, gy + 0.3, gy + 3) || world.isWater(x, z)) continue;
        const rd = world.nearestRoad(x, z, 6, DRIVABLE_MAX, 0, _lr);
        if (rd && rd.road !== i && rd.dist < R.w[rd.road] / 2 + 0.4) continue;
        const h = tall ? 9 : 6.2;
        parts.box(0.16, h + 0.5, 0.16, x, gy + h / 2 - 0.25, z, LAMP_POLE);
        parts.box(tall ? 0.7 : 0.5, 0.14, tall ? 0.7 : 0.5, x, gy + h + 0.07, z, LAMP_HEAD);
        obstacles.push(x, z, 0.14);
        // světlo na zemi (síť 3 × 3 kopíruje terén), posunuté směrem k vozovce
        const r = tall ? 14 : 10;
        const shift = tall ? 3 : 1.6;
        const cx = x + dz * side * shift, cz = z - dx * side * shift;
        const b = pp.length / 3;
        for (let v = 0; v <= 3; v++) for (let u = 0; u <= 3; u++) {
          const vx = cx + (u / 3 * 2 - 1) * r, vz = cz + (v / 3 * 2 - 1) * r;
          pp.push(vx, world.heightAt(vx, vz) + SURF + 0.07, vz);
          pu.push(u / 3, v / 3);
        }
        for (let v = 0; v < 3; v++) for (let u = 0; u < 3; u++) {
          const a0 = b + v * 4 + u;
          pi.push(a0, a0 + 4, a0 + 1, a0 + 1, a0 + 4, a0 + 5);
        }
        count++;
      }
      acc -= len;
    }
  }
  if (!count) return null;
  const poles = new THREE.Mesh(parts.geometry(), getDetailMaterial());
  poles.matrixAutoUpdate = false;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));
  pg.setAttribute('uv', new THREE.Float32BufferAttribute(pu, 2));
  pg.setIndex(pi);
  pg.computeBoundingSphere();
  const pools = new THREE.Mesh(pg, getPoolMaterial());
  pools.renderOrder = 18; pools.matrixAutoUpdate = false;
  return { poles, pools, obstacles };
}

// ------------------------------------------------------------- správce ----
const STAGES = 4;       // 0 terén, 1 budovy, 2 silnice a mosty, 3 stromy a lampy

export class ChunkManager {
  constructor(scene, world, renderer) {
    this.scene = scene;
    this.world = world;
    this.renderer = renderer;
    this.chunks = new Map();
    this.buildingMat = makeBuildingMaterial();
    this.asphaltMat = makeDecalMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
    this.marksMat = makeDecalMaterial({ polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 });
    this.solidMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.density = buildDensity(world);
    this.landIndex = buildLandIndex(world);
    this.scratch = new Map();
    this.aniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    this.texNear = QUALITY.groundTex; this.texFar = QUALITY.groundTexFar;
    this.lastCenter = -1;
    this.pending = 0;
  }

  _texture(ci, S) {
    const cv = drawGround(this, ci, S);
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;
    tex.premultiplyAlpha = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.aniso;
    this.renderer.initTexture(tex);     // nahraje se hned, sdílené plátno pak slouží další dlaždici
    return tex;
  }

  /** Provede další krok stavby dlaždice. */
  _step(ci, ch) {
    const w = this.world;
    const cx = ci % w.cols, cz = Math.floor(ci / w.cols);
    const x0 = w.minX + cx * CHUNK, z0 = w.minZ + cz * CHUNK;
    const add = (mesh, geo) => { mesh.matrixAutoUpdate = false; ch.group.add(mesh); if (geo) ch.disposables.push(geo); };
    if (ch.stage === 0) {
      const geo = buildTerrain(w, x0, z0);
      ch.texSize = ch.dist < 420 ? this.texNear : this.texFar;
      ch.tex = this._texture(ci, ch.texSize);
      ch.terrainMat = makeTerrainMaterial(ch.tex);
      const m = new THREE.Mesh(geo, ch.terrainMat);
      m.receiveShadow = true; m.renderOrder = 5;
      add(m, geo);
    } else if (ch.stage === 1) {
      const list = w.bChunks[ci];
      const geo = list ? buildBuildings(w, list) : null;
      if (geo) { const m = new THREE.Mesh(geo, this.buildingMat); m.castShadow = true; m.receiveShadow = true; add(m, geo); }
    } else if (ch.stage === 2) {
      const roads = buildRoads(w, ci);
      if (roads.solid) { const m = new THREE.Mesh(roads.solid, this.solidMat); m.castShadow = true; m.receiveShadow = true; add(m, roads.solid); }
      if (roads.asphalt) { const m = new THREE.Mesh(roads.asphalt, this.asphaltMat); m.renderOrder = 14; m.receiveShadow = true; add(m, roads.asphalt); ch.asphalt = m; }
      if (roads.marks) { const m = new THREE.Mesh(roads.marks, this.marksMat); m.renderOrder = 16; m.receiveShadow = true; add(m, roads.marks); ch.marks = m; }
    } else {
      const trees = buildTrees(w, ci, x0, z0);
      for (const m of trees.meshes) { m.matrixAutoUpdate = false; ch.group.add(m); }
      ch.trees = trees.meshes;
      ch.obstacles = trees.obstacles;
      const lamps = buildLamps(w, ci);
      if (lamps) {
        ch.group.add(lamps.poles, lamps.pools);
        ch.disposables.push(lamps.poles.geometry, lamps.pools.geometry);
        for (const o of lamps.obstacles) ch.obstacles.push(o);
        ch.lamps = lamps;
      }
      w.addObstacles(ch.obstacles);
    }
    ch.stage++;
  }

  _dispose(ch) {
    this.scene.remove(ch.group);
    for (const g of ch.disposables) g.dispose();
    for (const m of ch.trees) m.dispose();
    if (ch.tex) ch.tex.dispose();
    if (ch.terrainMat) ch.terrainMat.dispose();
    this.world.removeObstacles(ch.obstacles);
  }

  /** Udržuje načtené dlaždice kolem bodu; za jedno volání provede nejvýš `budget` kroků stavby. */
  update(x, z, view, budget = 1) {
    const w = this.world;
    const ccx = Math.floor((x - w.minX) / CHUNK), ccz = Math.floor((z - w.minZ) / CHUNK);
    const center = ccz * 4096 + ccx;
    if (center !== this.lastCenter || this._view !== view) {
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
          this.chunks.set(ci, {
            group, disposables: [], obstacles: [], trees: [], lamps: null, asphalt: null, marks: null,
            stage: 0, tex: null, terrainMat: null, texSize: 0, dist: 0,
            cx: w.minX + (cx + 0.5) * CHUNK, cz: w.minZ + (cz + 0.5) * CHUNK,
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
    const todo = [];
    for (const [ci, ch] of this.chunks) {
      const d = Math.hypot(ch.cx - x, ch.cz - z);
      ch.dist = d;
      if (ch.lamps) { ch.lamps.poles.visible = d < 560; ch.lamps.pools.visible = night && d < 1100; }
      // v dálce stačí silnice nakreslené v textuře země; přesná síť a čáry jen poblíž
      if (ch.asphalt) ch.asphalt.visible = d < 800;
      if (ch.marks) ch.marks.visible = d < 480;
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
    let done = 0;
    if (todo.length) {
      todo.sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < todo.length && done < budget; k++) {
        const ch = todo[k][2];
        this._step(todo[k][1], ch); done++;
        if (ch.stage >= STAGES) pending--;
        if (ch.stage === 1 || ch.dist < 520) pendingStart--;
      }
    } else if (rebake && budget > 0) {
      const ch = rebake[2];
      const tex = this._texture(rebake[1], rebake[3]);
      ch.tex.dispose();
      ch.tex = tex; ch.texSize = rebake[3];
      ch.terrainMat.map = tex;
    }
    this.pending = pending;
    this.pendingStart = Math.max(0, pendingStart);    // kolik kroků zbývá, než jde hrát (terén všude + okolí hotové)
    return done;
  }
}
