// Herní svět: dekódování dat, prostorové indexy, kolize, silniční graf.
import { CHUNK, COLL_CELL, DRIVABLE_MAX, RF, RC, LC, BF } from '../config.js';

export const SURF = 0.05;    // o kolik nad terénem leží povrch, po kterém se jezdí (kvůli vrstvě asfaltu)
const KEY_OFF = 80000;       // posun, aby byly kvantované souřadnice kladné
const KEY_MUL = 262144;

export class World {
  constructor(data) {
    this.meta = data.meta;
    const b = data.meta.bounds;
    // okraje zarovnané na celé dlaždice
    this.minX = Math.floor(b.minX / CHUNK) * CHUNK; this.maxX = Math.ceil(b.maxX / CHUNK) * CHUNK;
    this.minZ = Math.floor(b.minZ / CHUNK) * CHUNK; this.maxZ = Math.ceil(b.maxZ / CHUNK) * CHUNK;
    this.playMinX = b.minX; this.playMaxX = b.maxX; this.playMinZ = b.minZ; this.playMaxZ = b.maxZ;
    this.cols = Math.ceil((this.maxX - this.minX) / CHUNK);
    this.rows = Math.ceil((this.maxZ - this.minZ) / CHUNK);
    this.gcols = Math.ceil((this.maxX - this.minX) / COLL_CELL) + 1;
    this.grows = Math.ceil((this.maxZ - this.minZ) / COLL_CELL) + 1;
    this.roadNames = data.meta.roadNames;
    this.obstacles = new Map();   // kruhové překážky (stromy, sloupy) podle buněk 16 m
    this._initTerrain(data.terrain);
    this._initBuildings(data.buildings);
    this._initRoads(data.roads);
    this._initGraph();
    this._initLand(data.land);
    this._initRails(data.rails);
    this._initBridges();
    this.trees = data.trees;
    this._initTrees(data.trees);
  }

  chunkIndex(x, z) {
    const cx = Math.floor((x - this.minX) / CHUNK);
    const cz = Math.floor((z - this.minZ) / CHUNK);
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return -1;
    return cz * this.cols + cx;
  }

  cellIndex(x, z) {
    let cx = Math.floor((x - this.minX) / COLL_CELL);
    let cz = Math.floor((z - this.minZ) / COLL_CELL);
    if (cx < 0) cx = 0; else if (cx >= this.gcols) cx = this.gcols - 1;
    if (cz < 0) cz = 0; else if (cz >= this.grows) cz = this.grows - 1;
    return cz * this.gcols + cx;
  }

  inBounds(x, z, margin = 0) {
    return x > this.minX + margin && x < this.maxX - margin && z > this.minZ + margin && z < this.maxZ - margin;
  }

  // ------------------------------------------------------------- terén ----
  _initTerrain(T) {
    const { g, cols, rows, x0, z0, q } = T.header;
    const h = new Float32Array(cols * rows);
    const d = T.d, rs = T.rowStart;
    for (let j = 0; j < rows; j++) {
      let v = rs[j];
      const o = j * cols, od = j * (cols - 1);
      h[o] = v * q;
      for (let i = 1; i < cols; i++) { v += d[od + i - 1]; h[o + i] = v * q; }
    }
    this.th = h; this.tG = g; this.tCols = cols; this.tRows = rows; this.tX0 = x0; this.tZ0 = z0;
    this.baseElevation = T.header.base;
  }

  /** Výška terénu v bodě (metry nad úrovní náměstí Republiky). Přesně odpovídá vykreslené síti. */
  heightAt(x, z) {
    let gx = (x - this.tX0) / this.tG, gz = (z - this.tZ0) / this.tG;
    const mc = this.tCols - 1.001, mr = this.tRows - 1.001;
    if (gx < 0) gx = 0; else if (gx > mc) gx = mc;
    if (gz < 0) gz = 0; else if (gz > mr) gz = mr;
    const i = gx | 0, j = gz | 0;
    const fx = gx - i, fz = gz - j;
    const h = this.th, o = j * this.tCols + i;
    const h10 = h[o + 1], h01 = h[o + this.tCols];
    // čtverec je rozdělen úhlopříčkou mezi body 10 a 01 (stejně jako síť terénu)
    if (fx + fz <= 1) { const h00 = h[o]; return h00 + (h10 - h00) * fx + (h01 - h00) * fz; }
    const h11 = h[o + this.tCols + 1];
    return h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }

  // -------------------------------------------------------------- mosty ----
  _initBridges() {
    const seg = [];     // x1, z1, y1, x2, z2, y2, poloviční šířka, druh (0 silnice, 1 tramvaj, 2 železnice)
    const R = this.r, px = this.rpx, pz = this.rpz, py = this.rpy;
    for (let i = 0; i < this.rCount; i++) {
      if (!(R.flags[i] & RF.BRIDGE)) continue;
      const cls = R.cls[i];
      const hw = this.deckHalfWidth(i);
      for (let k = this.rOff[i], ke = this.rOff[i + 1] - 1; k < ke; k++) seg.push(px[k], pz[k], py[k], px[k + 1], pz[k + 1], py[k + 1], hw, cls <= DRIVABLE_MAX ? 0 : 3);
    }
    for (const rail of this.rails) {
      if (!rail.y) continue;
      const hw = rail.cls === 1 ? 2.4 : 1.7;
      for (let k = 0, n = rail.pts.length / 2 - 1; k < n; k++) {
        seg.push(rail.pts[k * 2], rail.pts[k * 2 + 1], rail.y[k], rail.pts[k * 2 + 2], rail.pts[k * 2 + 3], rail.y[k + 1], hw, rail.cls === 0 ? 1 : 2);
      }
    }
    this.bridgeSeg = Float32Array.from(seg);
    const grid = new Map();
    for (let s = 0; s < seg.length; s += 8) {
      const hw = seg[s + 6];
      const cx0 = Math.floor((Math.min(seg[s], seg[s + 3]) - hw) / COLL_CELL), cx1 = Math.floor((Math.max(seg[s], seg[s + 3]) + hw) / COLL_CELL);
      const cz0 = Math.floor((Math.min(seg[s + 1], seg[s + 4]) - hw) / COLL_CELL), cz1 = Math.floor((Math.max(seg[s + 1], seg[s + 4]) + hw) / COLL_CELL);
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const key = cx * 8192 + cz;
        let a = grid.get(key);
        if (!a) grid.set(key, a = []);
        a.push(s);
      }
    }
    this.bridgeGrid = grid;
  }

  /** Poloviční šířka mostovky silnice (včetně chodníků). */
  deckHalfWidth(road) {
    const cls = this.r.cls[road], hw = this.r.w[road] / 2;
    if (cls <= RC.LIVING) return hw + 2.0;
    if (cls <= DRIVABLE_MAX) return hw + 0.5;
    return Math.max(1.3, hw + 0.4);
  }

  /** Nejvyšší mostovka v bodě, která neleží výš než yMax. Vrací -1e9, když tu žádná není. kind = filtr druhu (volitelně). */
  deckAt(x, z, yMax, kind = -1) {
    const list = this.bridgeGrid.get(Math.floor(x / COLL_CELL) * 8192 + Math.floor(z / COLL_CELL));
    if (!list) return -1e9;
    const sg = this.bridgeSeg;
    let best = -1e9;
    for (let q = 0; q < list.length; q++) {
      const s = list[q];
      if (kind >= 0 && sg[s + 7] !== kind) continue;
      const x1 = sg[s], z1 = sg[s + 1], dx = sg[s + 3] - x1, dz = sg[s + 4] - z1;
      const l2 = dx * dx + dz * dz;
      let t = l2 > 0 ? ((x - x1) * dx + (z - z1) * dz) / l2 : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      const qx = x1 + dx * t - x, qz = z1 + dz * t - z, hw = sg[s + 6];
      if (qx * qx + qz * qz > hw * hw) continue;
      const y = sg[s + 2] + (sg[s + 5] - sg[s + 2]) * t;
      if (y <= yMax && y > best) best = y;
    }
    return best;
  }

  /**
   * Výška povrchu, po kterém se chodí a jezdí: terén, nebo mostovka, na kterou lze z výšky yHint vstoupit.
   * Kdo stojí pod mostem, zůstane na terénu; kdo na most najede, drží se mostovky.
   */
  groundY(x, z, yHint = 1e9) {
    const t = this.heightAt(x, z) + SURF;
    const d = this.deckAt(x, z, yHint + 0.9);
    return d > t ? d : t;
  }

  /** Povrch včetně střech (pro pěšího hráče a vrtulník). */
  surfaceAt(x, z, yMax = 1e9) {
    const g = this.groundY(x, z, yMax);
    const r = this.roofAt(x, z, yMax);
    return r > g ? r : g;
  }

  // ------------------------------------------------------------ budovy ----
  _initBuildings(B) {
    const n = B.header.count;
    this.b = B;
    this.bCount = n;
    const nv = B.vdx.length;
    const vx = new Float32Array(nv), vz = new Float32Array(nv);
    const minX = new Float32Array(n), maxX = new Float32Array(n), minZ = new Float32Array(n), maxZ = new Float32Array(n);
    const hTop = new Float32Array(n), hWall = new Float32Array(n), hMin = new Float32Array(n);
    const bGround = new Float32Array(n), bFoot = new Float32Array(n);
    const chunkLists = new Array(this.cols * this.rows);
    const cellCount = new Uint32Array(this.gcols * this.grows + 1);
    for (let i = 0; i < n; i++) {
      const r0 = B.bRing[i], r1 = B.bRing[i + 1];
      const v0 = B.ringStart[r0], v1 = B.ringStart[r1];
      const axm = B.ax[i], azm = B.az[i];
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, gs = 0, gmin = 1e9;
      for (let v = v0; v < v1; v++) {
        const x = (axm + B.vdx[v]) * 0.1, z = (azm + B.vdz[v]) * 0.1;
        vx[v] = x; vz[v] = z;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
        const g = this.heightAt(x, z);
        gs += g; if (g < gmin) gmin = g;
      }
      minX[i] = x0; maxX[i] = x1; minZ[i] = z0; maxZ[i] = z1;
      // dům stojí na průměrné výšce terénu pod půdorysem; zdi sahají až k nejnižšímu bodu
      const ground = gs / (v1 - v0);
      bGround[i] = ground; bFoot[i] = gmin - 0.4;
      hTop[i] = ground + B.hTop[i] * 0.1; hWall[i] = ground + B.hWall[i] * 0.1;
      hMin[i] = B.hMin[i] > 0 ? ground + B.hMin[i] * 0.1 : gmin - 0.4;
      const ci = this.chunkIndex((x0 + x1) / 2, (z0 + z1) / 2);
      if (ci >= 0) (chunkLists[ci] || (chunkLists[ci] = [])).push(i);
      if (B.flags[i] & (BF.NO_COLLIDE | BF.PART)) continue;
      const cx0 = Math.max(0, Math.floor((x0 - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x1 - this.minX) / COLL_CELL));
      const cz0 = Math.max(0, Math.floor((z0 - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z1 - this.minZ) / COLL_CELL));
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) cellCount[cz * this.gcols + cx + 1]++;
    }
    for (let i = 1; i < cellCount.length; i++) cellCount[i] += cellCount[i - 1];
    const cellItems = new Uint32Array(cellCount[cellCount.length - 1]);
    const fill = new Uint32Array(this.gcols * this.grows);
    for (let i = 0; i < n; i++) {
      if (B.flags[i] & (BF.NO_COLLIDE | BF.PART)) continue;
      const cx0 = Math.max(0, Math.floor((minX[i] - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((maxX[i] - this.minX) / COLL_CELL));
      const cz0 = Math.max(0, Math.floor((minZ[i] - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((maxZ[i] - this.minZ) / COLL_CELL));
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cz * this.gcols + cx;
        cellItems[cellCount[c] + fill[c]++] = i;
      }
    }
    this.bvx = vx; this.bvz = vz;
    this.bMinX = minX; this.bMaxX = maxX; this.bMinZ = minZ; this.bMaxZ = maxZ;
    // výšky jsou absolutní (ve stejné soustavě jako terén)
    this.bTop = hTop; this.bWall = hWall; this.bBase = hMin; this.bGround = bGround; this.bFoot = bFoot;
    this.bChunks = chunkLists;
    this.bCellStart = cellCount; this.bCellItems = cellItems;
    this.bNames = new Map(B.header.names);
  }

  /** Vysune kruh (x, z, r) ve výšce y ven ze zdí budov. Vrací true při kolizi; výsledek v this.hit. */
  collideCircle(x, z, r, y, yTop) {
    const hit = this.hit || (this.hit = { x: 0, z: 0, nx: 0, nz: 0, depth: 0, building: -1 });
    hit.x = x; hit.z = z; hit.nx = 0; hit.nz = 0; hit.depth = 0; hit.building = -1;
    let any = false;
    const B = this.b, vx = this.bvx, vz = this.bvz;
    const cx0 = Math.max(0, Math.floor((x - r - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x + r - this.minX) / COLL_CELL));
    const cz0 = Math.max(0, Math.floor((z - r - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z + r - this.minZ) / COLL_CELL));
    for (let pass = 0; pass < 2; pass++) {
      let moved = false;
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = cz * this.gcols + cx;
        for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
          const i = this.bCellItems[k];
          x = hit.x; z = hit.z;
          if (x + r < this.bMinX[i] || x - r > this.bMaxX[i] || z + r < this.bMinZ[i] || z - r > this.bMaxZ[i]) continue;
          if (y >= this.bTop[i] - 0.25 || yTop <= this.bBase[i]) continue;
          // nejbližší bod na obvodu + test, zda je střed uvnitř
          let best = 1e9, bx = 0, bz = 0, inside = false;
          const r0 = B.bRing[i], r1 = B.bRing[i + 1];
          for (let rg = r0; rg < r1; rg++) {
            const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
            let j = v1 - 1;
            for (let v = v0; v < v1; j = v++) {
              const x1 = vx[j], z1 = vz[j], x2 = vx[v], z2 = vz[v];
              if ((z1 > z) !== (z2 > z) && x < (x2 - x1) * (z - z1) / (z2 - z1) + x1) inside = !inside;
              const dx = x2 - x1, dz = z2 - z1;
              const l2 = dx * dx + dz * dz;
              let t = l2 > 0 ? ((x - x1) * dx + (z - z1) * dz) / l2 : 0;
              if (t < 0) t = 0; else if (t > 1) t = 1;
              const qx = x1 + dx * t, qz = z1 + dz * t;
              const d = (x - qx) * (x - qx) + (z - qz) * (z - qz);
              if (d < best) { best = d; bx = qx; bz = qz; }
            }
          }
          const d = Math.sqrt(best);
          if (!inside && d >= r) continue;
          let nx, nz, push;
          if (inside) {
            if (d > 1e-5) { nx = (bx - x) / d; nz = (bz - z) / d; } else { nx = 1; nz = 0; }
            push = d + r;
          } else {
            if (d > 1e-5) { nx = (x - bx) / d; nz = (z - bz) / d; } else { nx = 1; nz = 0; }
            push = r - d;
          }
          hit.x = x + nx * push; hit.z = z + nz * push;
          hit.nx = nx; hit.nz = nz; hit.depth = Math.max(hit.depth, push); hit.building = i;
          any = true; moved = true;
        }
      }
      if (!moved) break;
    }
    // kruhové překážky (stromy)
    const ox0 = Math.floor((hit.x - r - 1) / 16), ox1 = Math.floor((hit.x + r + 1) / 16);
    const oz0 = Math.floor((hit.z - r - 1) / 16), oz1 = Math.floor((hit.z + r + 1) / 16);
    {
      const yLim = y - 2.5;       // překážky (kmeny, sloupy) sahají 2,5 m nad zem
      for (let oz = oz0; oz <= oz1; oz++) for (let ox = ox0; ox <= ox1; ox++) {
        const list = this.obstacles.get(ox * 4096 + oz);
        if (!list) continue;
        for (let k = 0; k < list.length; k += 3) {
          const dx = hit.x - list[k], dz = hit.z - list[k + 1], rr = r + list[k + 2];
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr && d2 > 1e-8 && this.heightAt(list[k], list[k + 1]) > yLim) {
            const d = Math.sqrt(d2);
            hit.nx = dx / d; hit.nz = dz / d;
            hit.x += hit.nx * (rr - d); hit.z += hit.nz * (rr - d);
            hit.depth = Math.max(hit.depth, rr - d);
            any = true;
          }
        }
      }
    }
    return any;
  }

  /** Je kruh u země zablokovaný zdí nebo překážkou? (výšky lo–hi nad terénem) */
  blocked(x, z, r, lo = 0.2, hi = 1.7) {
    const g = this.heightAt(x, z);
    return this.collideCircle(x, z, r, g + lo, g + hi);
  }

  addObstacles(list) {
    for (let k = 0; k < list.length; k += 3) {
      const key = Math.floor(list[k] / 16) * 4096 + Math.floor(list[k + 1] / 16);
      let arr = this.obstacles.get(key);
      if (!arr) this.obstacles.set(key, arr = []);
      arr.push(list[k], list[k + 1], list[k + 2]);
    }
  }

  removeObstacles(list) {
    for (let k = 0; k < list.length; k += 3) {
      this.obstacles.delete(Math.floor(list[k] / 16) * 4096 + Math.floor(list[k + 1] / 16));
    }
  }

  _pointInBuilding(i, x, z) {
    const B = this.b, vx = this.bvx, vz = this.bvz;
    let inside = false;
    for (let rg = B.bRing[i], r1 = B.bRing[i + 1]; rg < r1; rg++) {
      const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
      let j = v1 - 1;
      for (let v = v0; v < v1; j = v++) {
        const z1 = vz[j], z2 = vz[v];
        if ((z1 > z) !== (z2 > z) && x < (vx[v] - vx[j]) * (z - z1) / (z2 - z1) + vx[j]) inside = !inside;
      }
    }
    return inside;
  }

  /** Výška střechy v bodě (-1e9 = žádná). Bere jen střechy do výšky maxY (aby šlo stát pod převisem). */
  roofAt(x, z, maxY = 1e9) {
    const c = this.cellIndex(x, z);
    let h = -1e9;
    for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
      const i = this.bCellItems[k];
      if (x < this.bMinX[i] || x > this.bMaxX[i] || z < this.bMinZ[i] || z > this.bMaxZ[i]) continue;
      const top = this.bTop[i];
      if (top <= h || top > maxY) continue;
      if (this._pointInBuilding(i, x, z)) h = top;
    }
    return h;
  }

  buildingAt(x, z) {
    const c = this.cellIndex(x, z);
    for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
      const i = this.bCellItems[k];
      if (x < this.bMinX[i] || x > this.bMaxX[i] || z < this.bMinZ[i] || z > this.bMaxZ[i]) continue;
      if (this._pointInBuilding(i, x, z)) return i;
    }
    return -1;
  }

  /** Paprsek v rovině xz proti zdem vyšším než y. Vrací t ∈ (0, 1] prvního zásahu, nebo 1. */
  raycast(x0, z0, x1, z1, y) {
    const B = this.b, vx = this.bvx, vz = this.bvz;
    let tBest = 1;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.max(1, Math.ceil(len / (COLL_CELL * 0.5)));
    let lastCell = -1;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const c = this.cellIndex(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      if (c === lastCell) continue;
      lastCell = c;
      for (let k = this.bCellStart[c], ke = this.bCellStart[c + 1]; k < ke; k++) {
        const i = this.bCellItems[k];
        if (seen.has(i)) continue;
        seen.add(i);
        if (this.bTop[i] <= y) continue;
        if (Math.min(x0, x1) > this.bMaxX[i] || Math.max(x0, x1) < this.bMinX[i] || Math.min(z0, z1) > this.bMaxZ[i] || Math.max(z0, z1) < this.bMinZ[i]) continue;
        for (let rg = B.bRing[i], r1 = B.bRing[i + 1]; rg < r1; rg++) {
          const v0 = B.ringStart[rg], v1 = B.ringStart[rg + 1];
          let j = v1 - 1;
          for (let v = v0; v < v1; j = v++) {
            const ex = vx[v] - vx[j], ez = vz[v] - vz[j];
            const dx = x1 - x0, dz = z1 - z0;
            const den = dx * ez - dz * ex;
            if (Math.abs(den) < 1e-9) continue;
            const t = ((vx[j] - x0) * ez - (vz[j] - z0) * ex) / den;
            const u = ((vx[j] - x0) * dz - (vz[j] - z0) * dx) / den;
            if (t > 0 && t < tBest && u >= 0 && u <= 1) tBest = t;
          }
        }
      }
    }
    return tBest;
  }

  // ----------------------------------------------------------- silnice ----
  _initRoads(R) {
    const n = R.header.count;
    this.r = R;
    this.rCount = n;
    const nPts = R.dx.length + n;
    const px = new Float32Array(nPts), pz = new Float32Array(nPts);
    const pOff = new Uint32Array(n + 1);
    const roadOfPt = new Uint32Array(nPts);
    let o = 0;
    for (let i = 0; i < n; i++) {
      pOff[i] = o;
      let x = R.x0[i], z = R.z0[i];
      px[o] = x * 0.1; pz[o] = z * 0.1; roadOfPt[o] = i; o++;
      for (let k = R.start[i], ke = R.start[i + 1]; k < ke; k++) {
        x += R.dx[k]; z += R.dz[k];
        px[o] = x * 0.1; pz[o] = z * 0.1; roadOfPt[o] = i; o++;
      }
    }
    pOff[n] = o;
    this.rpx = px; this.rpz = pz; this.rOff = pOff; this.roadOfPt = roadOfPt;
    // výška bodů: mostovka u mostů, jinak terén
    const py = new Float32Array(nPts);
    for (let i = 0; i < n; i++) {
      const bo = R.bridgeOff ? R.bridgeOff[i] : 0xFFFFFFFF;
      for (let k = pOff[i], ke = pOff[i + 1]; k < ke; k++) {
        py[k] = bo !== 0xFFFFFFFF ? R.bridgeY[bo + k - pOff[i]] * 0.02 : this.heightAt(px[k], pz[k]) + SURF;
      }
      if (bo === 0xFFFFFFFF && (R.flags[i] & RF.BRIDGE)) R.flags[i] &= ~RF.BRIDGE;
    }
    this.rpy = py;

    // kousky silnic po dlaždicích (pro vykreslování)
    const pieces = new Array(this.cols * this.rows);
    for (let i = 0; i < n; i++) {
      const a = pOff[i], b = pOff[i + 1] - 1;
      let s = a, acc = 0;
      for (let k = a; k < b; k++) {
        acc += Math.hypot(px[k + 1] - px[k], pz[k + 1] - pz[k]);
        if (acc > 160 || k === b - 1) {
          const e = k + 1;
          const mid = (s + e) >> 1;
          const ci = this.chunkIndex(px[mid], pz[mid]);
          if (ci >= 0) (pieces[ci] || (pieces[ci] = [])).push(i, s, e);
          s = e; acc = 0;
        }
      }
    }
    this.rPieces = pieces;

    // mřížka úseků pro hledání nejbližší silnice
    const cnt = new Uint32Array(this.gcols * this.grows + 1);
    const each = (fn) => {
      for (let i = 0; i < n; i++) {
        for (let k = pOff[i], ke = pOff[i + 1] - 1; k < ke; k++) {
          const x0 = Math.min(px[k], px[k + 1]), x1 = Math.max(px[k], px[k + 1]);
          const z0 = Math.min(pz[k], pz[k + 1]), z1 = Math.max(pz[k], pz[k + 1]);
          const cx0 = Math.max(0, Math.floor((x0 - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x1 - this.minX) / COLL_CELL));
          const cz0 = Math.max(0, Math.floor((z0 - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z1 - this.minZ) / COLL_CELL));
          for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) fn(cz * this.gcols + cx, k);
        }
      }
    };
    each((c) => { cnt[c + 1]++; });
    for (let i = 1; i < cnt.length; i++) cnt[i] += cnt[i - 1];
    const items = new Uint32Array(cnt[cnt.length - 1]);
    const fill = new Uint32Array(this.gcols * this.grows);
    each((c, k) => { items[cnt[c] + fill[c]++] = k; });
    this.segCellStart = cnt; this.segCellItems = items;
  }

  /**
   * Nejbližší úsek silnice. maxClass omezuje třídu (např. DRIVABLE_MAX).
   * Vrací objekt {road, seg, t, dist, x, z, dx, dz} nebo null.
   */
  nearestRoad(x, z, maxDist = 60, maxClass = 99, minClass = 0, out) {
    const res = out || {};
    let best = maxDist * maxDist, found = false;
    const R = this.r, px = this.rpx, pz = this.rpz;
    const cx0 = Math.max(0, Math.floor((x - maxDist - this.minX) / COLL_CELL)), cx1 = Math.min(this.gcols - 1, Math.floor((x + maxDist - this.minX) / COLL_CELL));
    const cz0 = Math.max(0, Math.floor((z - maxDist - this.minZ) / COLL_CELL)), cz1 = Math.min(this.grows - 1, Math.floor((z + maxDist - this.minZ) / COLL_CELL));
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const c = cz * this.gcols + cx;
      for (let q = this.segCellStart[c], qe = this.segCellStart[c + 1]; q < qe; q++) {
        const k = this.segCellItems[q];
        const road = this.roadOfPt[k];
        const cls = R.cls[road];
        if (cls > maxClass || cls < minClass) continue;
        const x1 = px[k], z1 = pz[k], dx = px[k + 1] - x1, dz = pz[k + 1] - z1;
        const l2 = dx * dx + dz * dz;
        let t = l2 > 0 ? ((x - x1) * dx + (z - z1) * dz) / l2 : 0;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        const qx = x1 + dx * t, qz = z1 + dz * t;
        const d = (x - qx) * (x - qx) + (z - qz) * (z - qz);
        if (d < best) {
          best = d; found = true;
          res.road = road; res.seg = k; res.t = t; res.x = qx; res.z = qz;
          const l = Math.sqrt(l2) || 1;
          res.dx = dx / l; res.dz = dz / l;
        }
      }
    }
    if (!found) return null;
    res.dist = Math.sqrt(best);
    return res;
  }

  /** Je bod na vozovce / cestě? (s tolerancí) */
  onRoad(x, z, extra = 0.5) {
    const r = this.nearestRoad(x, z, 14, 99, 0, this._tmpRoad || (this._tmpRoad = {}));
    return !!r && r.dist <= this.r.w[r.road] / 2 + extra;
  }

  // -------------------------------------------------------------- graf ----
  _initGraph() {
    const R = this.r, px = this.rpx, pz = this.rpz, pOff = this.rOff;
    const key = (k) => (Math.round(px[k] * 10) + KEY_OFF) * KEY_MUL + (Math.round(pz[k] * 10) + KEY_OFF);
    const uses = new Map();
    const drivable = (i) => R.cls[i] <= DRIVABLE_MAX;
    for (let i = 0; i < this.rCount; i++) {
      if (!drivable(i)) continue;
      const a = pOff[i], b = pOff[i + 1] - 1;
      for (let k = a; k <= b; k++) {
        const kk = key(k);
        uses.set(kk, (uses.get(kk) || 0) + (k === a || k === b ? 2 : 1));
      }
    }
    const nodeId = new Map();
    const nodeX = [], nodeZ = [];
    const getNode = (k) => {
      const kk = key(k);
      let id = nodeId.get(kk);
      if (id === undefined) { id = nodeX.length; nodeId.set(kk, id); nodeX.push(px[k]); nodeZ.push(pz[k]); }
      return id;
    };
    const eFrom = [], eTo = [], eA = [], eB = [], eLen = [], eRoad = [];
    for (let i = 0; i < this.rCount; i++) {
      if (!drivable(i)) continue;
      const a = pOff[i], b = pOff[i + 1] - 1;
      let s = a, len = 0;
      for (let k = a + 1; k <= b; k++) {
        len += Math.hypot(px[k] - px[k - 1], pz[k] - pz[k - 1]);
        if (k === b || uses.get(key(k)) >= 2) {
          if (len > 0.5) {
            const n0 = getNode(s), n1 = getNode(k);
            eFrom.push(n0); eTo.push(n1); eA.push(s); eB.push(k); eLen.push(len); eRoad.push(i);
            if (!(R.flags[i] & RF.ONEWAY)) {
              eFrom.push(n1); eTo.push(n0); eA.push(k); eB.push(s); eLen.push(len); eRoad.push(i);
            }
          }
          s = k; len = 0;
        }
      }
    }
    const nN = nodeX.length, nE = eFrom.length;
    this.nodeX = Float32Array.from(nodeX); this.nodeZ = Float32Array.from(nodeZ);
    this.eFrom = Uint32Array.from(eFrom); this.eTo = Uint32Array.from(eTo);
    this.eA = Uint32Array.from(eA); this.eB = Uint32Array.from(eB);
    this.eLen = Float32Array.from(eLen); this.eRoad = Uint32Array.from(eRoad);
    const outStart = new Uint32Array(nN + 1);
    for (let e = 0; e < nE; e++) outStart[this.eFrom[e] + 1]++;
    for (let i = 1; i <= nN; i++) outStart[i] += outStart[i - 1];
    const outEdges = new Uint32Array(nE);
    const fill = new Uint32Array(nN);
    for (let e = 0; e < nE; e++) { const f = this.eFrom[e]; outEdges[outStart[f] + fill[f]++] = e; }
    this.outStart = outStart; this.outEdges = outEdges;
    this.nodeCount = nN; this.edgeCount = nE;
    this.nodeOfKey = nodeId;

    // hrany vhodné pro běžný provoz, po dlaždicích
    const trafficEdges = new Array(this.cols * this.rows);
    const edgeOfSeg = new Map();
    for (let e = 0; e < nE; e++) {
      const i = this.eRoad[e];
      const lo = Math.min(this.eA[e], this.eB[e]);
      if (!edgeOfSeg.has(lo) || this.eA[e] < this.eB[e]) edgeOfSeg.set(lo, e);
      const cls = R.cls[i];
      if (cls > RC.LIVING || (R.flags[i] & (RF.PRIVATE | RF.TUNNEL))) continue;
      if (this.eLen[e] < 12) continue;
      const mid = (this.eA[e] + this.eB[e]) >> 1;
      const ci = this.chunkIndex(px[mid], pz[mid]);
      if (ci >= 0) (trafficEdges[ci] || (trafficEdges[ci] = [])).push(e);
    }
    this.trafficEdges = trafficEdges;
    this.edgeOfStart = edgeOfSeg;
    // pro každý bod silnice: hrana (v dopředném směru), do které patří
    const edgeOfPt = new Int32Array(px.length).fill(-1);
    for (let e = 0; e < nE; e++) {
      if (this.eA[e] < this.eB[e]) for (let k = this.eA[e]; k < this.eB[e]; k++) edgeOfPt[k] = e;
    }
    this.edgeOfPt = edgeOfPt;
  }

  /** Vrátí id zpětné hrany k dané hraně, nebo -1. */
  reverseEdge(e) {
    const a = this.eFrom[e], b = this.eTo[e], A = this.eA[e], B = this.eB[e];
    for (let q = this.outStart[b], qe = this.outStart[b + 1]; q < qe; q++) {
      const f = this.outEdges[q];
      if (this.eTo[f] === a && this.eA[f] === B && this.eB[f] === A) return f;
    }
    return -1;
  }

  /** Bod na hraně ve vzdálenosti d od jejího začátku (ve směru jízdy), s bočním posunem vpravo. */
  edgePoint(e, d, side, out) {
    const px = this.rpx, pz = this.rpz;
    const A = this.eA[e], B = this.eB[e];
    const step = A < B ? 1 : -1;
    let k = A, x = px[A], z = pz[A], tx = 0, tz = 1;
    for (; k !== B; k += step) {
      const nx = px[k + step], nz = pz[k + step];
      const l = Math.hypot(nx - px[k], nz - pz[k]);
      if (l > 1e-6) { tx = (nx - px[k]) / l; tz = (nz - pz[k]) / l; }
      if (d <= l || k + step === B) {
        const t = l > 0 ? Math.min(d, l) / l : 0;
        x = px[k] + (nx - px[k]) * t; z = pz[k] + (nz - pz[k]) * t;
        break;
      }
      d -= l;
    }
    // pravá strana ve směru jízdy (x východ, z jih): (−tz, tx)
    out.x = x - tz * side; out.z = z + tx * side; out.tx = tx; out.tz = tz;
    return out;
  }

  /** Nejbližší uzel grafu k bodu (přes nejbližší sjízdnou silnici). */
  nearestNode(x, z, maxDist = 150) {
    const r = this.nearestRoad(x, z, maxDist, DRIVABLE_MAX, 0, this._tmpRoad2 || (this._tmpRoad2 = {}));
    if (!r) return -1;
    let e = this.edgeOfPt[r.seg];
    if (e < 0) return -1;
    const dA = Math.hypot(this.nodeX[this.eFrom[e]] - x, this.nodeZ[this.eFrom[e]] - z);
    const dB = Math.hypot(this.nodeX[this.eTo[e]] - x, this.nodeZ[this.eTo[e]] - z);
    return dA < dB ? this.eFrom[e] : this.eTo[e];
  }

  /** A* – vrátí pole hran z uzlu a do uzlu b (nebo null). */
  findPath(a, b, maxExpand = 6000) {
    if (a < 0 || b < 0) return null;
    if (a === b) return [];
    const nN = this.nodeCount;
    if (!this._g) {
      this._g = new Float32Array(nN); this._came = new Int32Array(nN); this._stamp = new Uint32Array(nN);
      this._closed = new Uint32Array(nN); this._tick = 0;
    }
    const g = this._g, came = this._came, stamp = this._stamp, closed = this._closed;
    const tick = ++this._tick;
    const heap = [];        // dvojice (f, uzel)
    const push = (f, n) => {
      let i = heap.length; heap.push(f, n);
      while (i > 0) {
        const p = ((i >> 1) - 1 >> 1) << 1;
        if (heap[p] <= f) break;
        heap[i] = heap[p]; heap[i + 1] = heap[p + 1]; heap[p] = f; heap[p + 1] = n; i = p;
      }
    };
    const pop = () => {
      const n = heap[1];
      const lf = heap[heap.length - 2], ln = heap[heap.length - 1];
      heap.length -= 2;
      if (heap.length) {
        let i = 0; heap[0] = lf; heap[1] = ln;
        for (;;) {
          let l = i * 2 + 2, r = l + 2, m = i;
          if (l < heap.length && heap[l] < heap[m]) m = l;
          if (r < heap.length && heap[r] < heap[m]) m = r;
          if (m === i) break;
          const tf = heap[i], tn = heap[i + 1];
          heap[i] = heap[m]; heap[i + 1] = heap[m + 1]; heap[m] = tf; heap[m + 1] = tn; i = m;
        }
      }
      return n;
    };
    const bx = this.nodeX[b], bz = this.nodeZ[b];
    g[a] = 0; stamp[a] = tick; came[a] = -1;
    push(Math.hypot(this.nodeX[a] - bx, this.nodeZ[a] - bz), a);
    let expanded = 0;
    while (heap.length) {
      const n = pop();
      if (n === b) break;
      if (closed[n] === tick) continue;
      closed[n] = tick;
      if (++expanded > maxExpand) return null;
      for (let q = this.outStart[n], qe = this.outStart[n + 1]; q < qe; q++) {
        const e = this.outEdges[q], m = this.eTo[e];
        const road = this.eRoad[e];
        const cost = this.eLen[e] * (this.r.cls[road] >= RC.SERVICE ? 1.6 : 1);
        const ng = g[n] + cost;
        if (stamp[m] !== tick || ng < g[m]) {
          g[m] = ng; stamp[m] = tick; came[m] = e;
          push(ng + Math.hypot(this.nodeX[m] - bx, this.nodeZ[m] - bz), m);
        }
      }
    }
    if (stamp[b] !== tick) return null;
    const path = [];
    let n = b;
    while (n !== a) {
      const e = came[n];
      if (e < 0) return null;
      path.push(e);
      n = this.eFrom[e];
      if (path.length > 4000) return null;
    }
    path.reverse();
    return path;
  }

  // ------------------------------------------------------------ plochy ----
  _initLand(L) {
    this.l = L;
    const n = L.header.count;
    this.lCount = n;
    // vodní plochy pro přesný test
    const water = [];
    for (let i = 0; i < n; i++) {
      if (L.cls[i] !== LC.WATER) continue;
      const r0 = L.pRing[i], r1 = L.pRing[i + 1];
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let v = L.ringStart[r0], ve = L.ringStart[r0 + 1]; v < ve; v++) {
        const x = L.vx[v] * 0.1, z = L.vz[v] * 0.1;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      water.push({ i, x0, x1, z0, z1 });
    }
    this.water = water;

    // hrubá maska povrchů: bit 1 = les, 2 = měkký povrch (tráva, pole), 4 = voda
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'lighter';
    const sx = S / (this.maxX - this.minX), sz = S / (this.maxZ - this.minZ);
    const soft = new Set([LC.FARMLAND, LC.MEADOW, LC.GRASS, LC.ALLOTMENTS, LC.FOREST, LC.SCRUB, LC.PARK, LC.GARDEN, LC.CEMETERY, LC.PITCH]);
    for (let i = 0; i < n; i++) {
      const c = L.cls[i];
      let col = null;
      if (c === LC.FOREST) col = '#ff0000';
      else if (c === LC.WATER) col = '#0000ff';
      if (soft.has(c)) col = col ? '#ffff00' : '#00ff00';
      if (!col) continue;
      g.beginPath();
      for (let rg = L.pRing[i], r1 = L.pRing[i + 1]; rg < r1; rg++) {
        const v0 = L.ringStart[rg], v1 = L.ringStart[rg + 1];
        for (let v = v0; v < v1; v++) {
          const x = (L.vx[v] * 0.1 - this.minX) * sx, z = (L.vz[v] * 0.1 - this.minZ) * sz;
          if (v === v0) g.moveTo(x, z); else g.lineTo(x, z);
        }
        g.closePath();
      }
      g.fillStyle = col;
      g.fill('evenodd');
    }
    const img = g.getImageData(0, 0, S, S).data;
    const mask = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) {
      mask[i] = (img[i * 4] > 127 ? 1 : 0) | (img[i * 4 + 1] > 127 ? 2 : 0) | (img[i * 4 + 2] > 40 ? 4 : 0);
    }
    this.mask = mask; this.maskS = S; this.maskSX = sx; this.maskSZ = sz;
  }

  maskAt(x, z) {
    const mx = Math.floor((x - this.minX) * this.maskSX), mz = Math.floor((z - this.minZ) * this.maskSZ);
    if (mx < 0 || mz < 0 || mx >= this.maskS || mz >= this.maskS) return 0;
    return this.mask[mz * this.maskS + mx];
  }

  isForest(x, z) { return (this.maskAt(x, z) & 1) !== 0; }
  isSoft(x, z) { return (this.maskAt(x, z) & 2) !== 0; }

  isWater(x, z) {
    // rychlé vyloučení přes hrubou masku (včetně sousedních pixelů)
    const px = 1 / this.maskSX;
    if (!((this.maskAt(x, z) | this.maskAt(x + px, z) | this.maskAt(x - px, z) | this.maskAt(x, z + px) | this.maskAt(x, z - px)) & 4)) return false;
    const L = this.l;
    for (const w of this.water) {
      if (x < w.x0 || x > w.x1 || z < w.z0 || z > w.z1) continue;
      let inside = false;
      for (let rg = L.pRing[w.i], r1 = L.pRing[w.i + 1]; rg < r1; rg++) {
        const v0 = L.ringStart[rg], v1 = L.ringStart[rg + 1];
        let j = v1 - 1;
        for (let v = v0; v < v1; j = v++) {
          const z1 = L.vz[j] * 0.1, z2 = L.vz[v] * 0.1;
          if ((z1 > z) !== (z2 > z)) {
            const x1 = L.vx[j] * 0.1, x2 = L.vx[v] * 0.1;
            if (x < (x2 - x1) * (z - z1) / (z2 - z1) + x1) inside = !inside;
          }
        }
      }
      if (inside) return true;
    }
    return false;
  }

  // ------------------------------------------------------------ koleje ----
  _initRails(R) {
    const n = R.header.count;
    this.rails = [];
    const lists = new Array(this.cols * this.rows);
    for (let i = 0; i < n; i++) {
      const cnt = R.start[i + 1] - R.start[i] + 1;
      const pts = new Float32Array(cnt * 2);
      let x = R.x0[i], z = R.z0[i];
      pts[0] = x * 0.1; pts[1] = z * 0.1;
      let o = 2;
      for (let k = R.start[i], ke = R.start[i + 1]; k < ke; k++) {
        x += R.dx[k]; z += R.dz[k];
        pts[o++] = x * 0.1; pts[o++] = z * 0.1;
      }
      const rail = { cls: R.cls[i], flags: R.flags[i], pts, y: null };
      const bo = R.bridgeOff ? R.bridgeOff[i] : 0xFFFFFFFF;
      if (bo !== 0xFFFFFFFF) {
        rail.y = new Float32Array(cnt);
        for (let k = 0; k < cnt; k++) rail.y[k] = R.bridgeY[bo + k] * 0.02;
      }
      this.rails.push(rail);
      const mid = (cnt >> 1) * 2;
      const ci = this.chunkIndex(pts[mid], pts[mid + 1]);
      if (ci >= 0) (lists[ci] || (lists[ci] = [])).push(i);
    }
    this.railChunks = lists;
  }

  _initTrees(T) {
    const lists = new Array(this.cols * this.rows);
    for (let i = 0; i < T.header.count; i++) {
      const ci = this.chunkIndex(T.x[i] * 0.1, T.z[i] * 0.1);
      if (ci >= 0) (lists[ci] || (lists[ci] = [])).push(i);
    }
    this.treeChunks = lists;
  }

  /** Název nejbližší čtvrti. */
  districtAt(x, z) {
    let best = 1e18, name = '';
    for (const p of this.meta.places) {
      if (p[3] === 'city') continue;
      const w = p[3] === 'suburb' ? 1.0 : 0.75;      // menší části mají přednost, když jsou blízko
      const d = ((p[0] - x) ** 2 + (p[1] - z) ** 2) * w;
      if (d < best) { best = d; name = p[2]; }
    }
    return best < 1500 * 1500 ? name : '';
  }
}
