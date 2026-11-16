// Stavba 3D geometrie po dlaždicích: budovy, silnice, koleje, stromy.
import * as THREE from 'three';
import { Earcut } from 'three/src/extras/Earcut.js';
import { CHUNK, QUALITY, BK, BF, RC, RF, DRIVABLE_MAX } from '../config.js';
import { makeBuildingMaterial } from './materials.js';

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
  const h = world.bTop[i] - world.bBase[i];
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
      wall = pick(PAL.stone, r); roof = r2 < 0.4 ? PAL.copper : pick(PAL.houseRoof, r2); style = 6; bay = 4.5; floorH = Math.max(6, Math.min(h, 16)); break;
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
  v(x, z, col) {
    this.p.push(x, 0, z);
    this.c.push(col[0] * 255, col[1] * 255, col[2] * 255);
    return this.vc++;
  }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  disc(x, z, r, col, seg = 8) {
    const c0 = this.v(x, z, col);
    let first = -1, prev = -1;
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const v = this.v(x + Math.cos(a) * r, z + Math.sin(a) * r, col);
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

// --------------------------------------------------------------- budovy ----
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
    let wallTop = gable ? world.bWall[i] : top;
    let base = world.bBase[i];
    if (kind === BK.ROOF) base = Math.max(base, top - 0.35);
    const r0 = B.bRing[i], r1 = B.bRing[i + 1];
    const floors = Math.max(1, Math.round((wallTop - base) / st.floorH));
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
        if (style && len >= 1.8 && wallTop - base > 2.2) {
          nb = Math.max(1, Math.round(len / st.bay));
          off = Math.floor(hash(v, 3) * 50) * 4;
        } else style = 0;
        const a = buf.v(x1, base, z1, nx, 0, nz, st.wall, 0.78, off, 0, style);
        const b = buf.v(x2, base, z2, nx, 0, nz, st.wall, 0.78, off + nb, 0, style);
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
  asphalt: lin(0x3b3e43), asphaltMinor: lin(0x45484c), service: lin(0x4d5053), sidewalk: lin(0x8d9094),
  pedestrian: lin(0xb3ab9c), footway: lin(0xa39f95), path: lin(0x8a7a5e), track: lin(0x7f7257),
  cycleway: lin(0x8c5b52), steps: lin(0x8a8a8a), mark: lin(0xdcdcd4), markYellow: lin(0xd8b740),
  ballast: lin(0x5f5850), rail: lin(0x9aa0a6), tramBed: lin(0x34373b), bridge: lin(0x55585d),
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

/** Pás podél lomené čáry (body k0..k1 v polích px, pz); a, b jsou meze celé silnice kvůli navázání. */
function ribbon(buf, px, pz, k0, k1, a, b, hw, col, lateral = 0, capStart = false, capEnd = false) {
  let prevL = -1, prevR = -1;
  for (let k = k0; k <= k1; k++) {
    let nx = 0, nz = 0, scale = 1;
    let d0x = 0, d0z = 0, d1x = 0, d1z = 0, has0 = false, has1 = false;
    if (k > a) { d0x = px[k] - px[k - 1]; d0z = pz[k] - pz[k - 1]; const l = Math.hypot(d0x, d0z) || 1; d0x /= l; d0z /= l; has0 = true; }
    if (k < b) { d1x = px[k + 1] - px[k]; d1z = pz[k + 1] - pz[k]; const l = Math.hypot(d1x, d1z) || 1; d1x /= l; d1z /= l; has1 = true; }
    if (has0 && has1) {
      nx = -(d0z + d1z); nz = d0x + d1x;
      const l = Math.hypot(nx, nz);
      if (l < 1e-4) { nx = -d1z; nz = d1x; } else { nx /= l; nz /= l; }
      const dot = nx * -d1z + nz * d1x;
      scale = 1 / Math.max(0.55, dot);
      if (dot < 0.93) buf.disc(px[k] + nx * lateral, pz[k] + nz * lateral, hw, col, 8);
    } else if (has1) { nx = -d1z; nz = d1x; } else { nx = -d0z; nz = d0x; }
    const cx = px[k] + nx * lateral * scale, cz = pz[k] + nz * lateral * scale;
    const L = buf.v(cx - nx * hw * scale, cz - nz * hw * scale, col);
    const R = buf.v(cx + nx * hw * scale, cz + nz * hw * scale, col);
    if (prevL >= 0) buf.quad(prevL, prevR, R, L);
    prevL = L; prevR = R;
    if ((k === a && capStart) || (k === b && capEnd)) buf.disc(cx, cz, hw, col, 8);
  }
}

function dashes(buf, px, pz, k0, k1, hw, col, dash, gap, lateral = 0) {
  let acc = 0;
  const period = dash + gap;
  for (let k = k0; k < k1; k++) {
    const x1 = px[k], z1 = pz[k];
    let dx = px[k + 1] - x1, dz = pz[k + 1] - z1;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) continue;
    dx /= len; dz /= len;
    const nx = -dz, nz = dx;
    let s = -acc;
    while (s < len) {
      const s0 = Math.max(0, s), s1 = Math.min(len, s + dash);
      if (s1 - s0 > 0.3) {
        const ax = x1 + dx * s0 + nx * lateral, az = z1 + dz * s0 + nz * lateral;
        const bx = x1 + dx * s1 + nx * lateral, bz = z1 + dz * s1 + nz * lateral;
        const a = buf.v(ax - nx * hw, az - nz * hw, col), b = buf.v(ax + nx * hw, az + nz * hw, col);
        const c = buf.v(bx + nx * hw, bz + nz * hw, col), d = buf.v(bx - nx * hw, bz - nz * hw, col);
        buf.quad(a, b, c, d);
      }
      s += period;
    }
    acc = (acc + len) % period;
  }
}

function buildRoads(world, ci) {
  const pieces = world.rPieces[ci];
  const R = world.r, px = world.rpx, pz = world.rpz, off = world.rOff;
  const under = new DecalBuf(), asphalt = new DecalBuf(), marks = new DecalBuf();
  if (pieces) {
    for (let q = 0; q < pieces.length; q += 3) {
      const i = pieces[q], s = pieces[q + 1], e = pieces[q + 2];
      const a = off[i], b = off[i + 1] - 1;
      const cls = R.cls[i], w = R.w[i], flags = R.flags[i];
      const hw = w / 2;
      const col = (flags & RF.BRIDGE) && cls <= DRIVABLE_MAX ? COL.bridge : roadColor(cls);
      if (cls <= DRIVABLE_MAX || cls === RC.PEDESTRIAN) {
        ribbon(asphalt, px, pz, s, e, a, b, hw, col, 0, s === a, e === b);
        // chodníky u městských ulic
        if (cls >= RC.PRIMARY && cls <= RC.LIVING && !(flags & (RF.TUNNEL | RF.BRIDGE)) && cls !== RC.PRIMARY_LINK && cls !== RC.SECONDARY_LINK) {
          ribbon(under, px, pz, s, e, a, b, hw + 2.0, COL.sidewalk, 0, s === a, e === b);
        }
        // vodorovné značení
        if (cls <= RC.UNCLASSIFIED && !(flags & RF.ROUNDABOUT)) {
          const lanes = R.lanes[i];
          if (!(flags & RF.ONEWAY)) {
            if (lanes >= 4) {
              ribbon(marks, px, pz, s, e, a, b, 0.09, COL.mark, 0.16);
              ribbon(marks, px, pz, s, e, a, b, 0.09, COL.mark, -0.16);
              dashes(marks, px, pz, s, e, 0.07, COL.mark, 3, 6, w / 4);
              dashes(marks, px, pz, s, e, 0.07, COL.mark, 3, 6, -w / 4);
            } else if (w >= 5.6) {
              dashes(marks, px, pz, s, e, 0.07, COL.mark, 3, 6, 0);
            }
          } else if (lanes >= 2) {
            for (let l = 1; l < lanes; l++) dashes(marks, px, pz, s, e, 0.07, COL.mark, 3, 6, -hw + (w / lanes) * l);
          }
          if (cls <= RC.TRUNK_LINK) {
            ribbon(marks, px, pz, s, e, a, b, 0.08, COL.mark, hw - 0.3);
            ribbon(marks, px, pz, s, e, a, b, 0.08, COL.mark, -hw + 0.3);
          }
        }
      } else {
        ribbon(under, px, pz, s, e, a, b, hw, col, 0, false, false);
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
      if (rail.cls === 1) {
        ribbon(under, rx, rz, 0, n - 1, 0, n - 1, 1.7, COL.ballast);
        ribbon(marks, rx, rz, 0, n - 1, 0, n - 1, 0.07, COL.rail, 0.7175);
        ribbon(marks, rx, rz, 0, n - 1, 0, n - 1, 0.07, COL.rail, -0.7175);
      } else {
        ribbon(asphalt, rx, rz, 0, n - 1, 0, n - 1, 1.25, COL.tramBed);
        ribbon(marks, rx, rz, 0, n - 1, 0, n - 1, 0.06, COL.rail, 0.7175);
        ribbon(marks, rx, rz, 0, n - 1, 0, n - 1, 0.06, COL.rail, -0.7175);
      }
    }
  }
  return { under: under.geometry(), asphalt: asphalt.geometry(), marks: marks.geometry() };
}

// --------------------------------------------------------------- stromy ----
let treeGeoA = null, treeGeoB = null, treeMat = null;
function treeAssets() {
  if (treeGeoA) return;
  const mk = (crown, trunkH, trunkR, crownY, trunkCol, crownCol) => {
    const trunk = new THREE.CylinderGeometry(trunkR * 0.7, trunkR, trunkH, 5, 1, true);
    trunk.translate(0, trunkH / 2, 0);
    crown.translate(0, crownY, 0);
    const parts = [[trunk, trunkCol], [crown, crownCol]];
    const pos = [], nor = [], col = [];
    for (const [g, c] of parts) {
      const gi = g.index ? g.toNonIndexed() : g;
      const p = gi.attributes.position, n = gi.attributes.normal;
      for (let k = 0; k < p.count; k++) {
        pos.push(p.getX(k), p.getY(k), p.getZ(k));
        nor.push(n.getX(k), n.getY(k), n.getZ(k));
        // spodek koruny tmavší
        const shade = c === crownCol ? 0.72 + 0.28 * Math.min(1, Math.max(0, (p.getY(k) - crownY + 1.5) / 3)) : 1;
        col.push(c[0] * shade, c[1] * shade, c[2] * shade);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  };
  treeGeoA = mk(new THREE.IcosahedronGeometry(2.3, 0), 3.0, 0.22, 4.4, lin(0x5b4a3a), lin(0x5f8f46));
  treeGeoB = mk(new THREE.ConeGeometry(1.7, 6.5, 6), 2.2, 0.2, 5.2, lin(0x4f4034), lin(0x3f6f45));
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
      if (world.buildingAt(x, z) >= 0) continue;
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
      _p.set(arr[k * 4], 0, arr[k * 4 + 1]);
      _q.setFromAxisAngle(_up, arr[k * 4 + 3] * 6.283);
      _s.set(s, s * (0.9 + arr[k * 4 + 3] * 0.3), s);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(k, _m);
      const g = 0.82 + arr[k * 4 + 3] * 0.36;
      mesh.setColorAt(k, _c.setRGB(g * (0.9 + arr[k * 4 + 3] * 0.25), g, g * 0.85));
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
  }
  return { meshes, obstacles };
}

// ------------------------------------------------------------- správce ----
export class ChunkManager {
  constructor(scene, world, decalMaterial) {
    this.scene = scene;
    this.world = world;
    this.chunks = new Map();
    this.buildingMat = makeBuildingMaterial();
    this.decalMat = decalMaterial;
    this.queue = [];
    this.lastCenter = -1;
    this.pending = 0;
  }

  _build(ci) {
    const w = this.world;
    const cx = ci % w.cols, cz = Math.floor(ci / w.cols);
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    const disposables = [];
    const list = w.bChunks[ci];
    if (list) {
      const geo = buildBuildings(w, list);
      if (geo) { const m = new THREE.Mesh(geo, this.buildingMat); m.matrixAutoUpdate = false; group.add(m); disposables.push(geo); }
    }
    const roads = buildRoads(w, ci);
    const layers = [[roads.under, 12], [roads.asphalt, 14], [roads.marks, 16]];
    for (const [geo, order] of layers) {
      if (!geo) continue;
      const m = new THREE.Mesh(geo, this.decalMat);
      m.renderOrder = order; m.matrixAutoUpdate = false;
      group.add(m); disposables.push(geo);
    }
    const trees = buildTrees(w, ci, w.minX + cx * CHUNK, w.minZ + cz * CHUNK);
    for (const m of trees.meshes) { m.matrixAutoUpdate = false; group.add(m); }
    w.addObstacles(trees.obstacles);
    this.scene.add(group);
    return { group, disposables, obstacles: trees.obstacles, trees: trees.meshes };
  }

  _dispose(ch) {
    this.scene.remove(ch.group);
    for (const g of ch.disposables) g.dispose();
    for (const m of ch.trees) m.dispose();
    this.world.removeObstacles(ch.obstacles);
  }

  /** Udržuje načtené dlaždice kolem bodu; staví nejvýš `budget` dlaždic za volání. */
  update(x, z, view, budget = 1) {
    const w = this.world;
    const ccx = Math.floor((x - w.minX) / CHUNK), ccz = Math.floor((z - w.minZ) / CHUNK);
    const center = ccz * 4096 + ccx;
    if (center !== this.lastCenter || this._view !== view) {
      this.lastCenter = center; this._view = view;
      const rad = Math.ceil(view / CHUNK) + 1;
      const want = new Set();
      const queue = [];
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        const cx = ccx + dx, cz = ccz + dz;
        if (cx < 0 || cz < 0 || cx >= w.cols || cz >= w.rows) continue;
        const d = Math.hypot(dx, dz) * CHUNK;
        if (d > view + CHUNK * 0.8) continue;
        const ci = cz * w.cols + cx;
        want.add(ci);
        if (!this.chunks.has(ci)) queue.push([d, ci]);
      }
      queue.sort((a, b) => a[0] - b[0]);
      this.queue = queue.map((q) => q[1]);
      for (const [ci, ch] of this.chunks) {
        if (!want.has(ci)) { this._dispose(ch); this.chunks.delete(ci); }
      }
    }
    let built = 0;
    while (this.queue.length && built < budget) {
      const ci = this.queue.shift();
      if (this.chunks.has(ci)) continue;
      this.chunks.set(ci, this._build(ci));
      built++;
    }
    this.pending = this.queue.length;
    return built;
  }
}
