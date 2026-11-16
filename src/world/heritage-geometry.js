import * as THREE from 'three';
import { Earcut } from 'three/src/extras/Earcut.js';

const _normal = new THREE.Vector3();
const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3();

export class HeritageMesh {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.indices = []; }

  /** Ucho se řeže v lokální rovině plochy, i pro svislé stěny a otvory. */
  polygon(rings, color, uv = () => [0, 0, 0], expected = null) {
    const outer = rings[0], [x0, y0, z0] = outer;
    _normal.set(0, 0, 0);
    for (let i = 3; i + 2 < outer.length; i += 3) {
      _p1.set(outer[i] - x0, outer[i + 1] - y0, outer[i + 2] - z0);
      const j = i + 3;
      if (j >= outer.length) break;
      _p2.set(outer[j] - x0, outer[j + 1] - y0, outer[j + 2] - z0);
      _normal.add(_p1.cross(_p2));
    }
    if (_normal.lengthSq() < 1e-8) return;
    _normal.normalize();
    if (expected && _normal.dot(expected) < 0) _normal.negate();
    const { x: nx, y: ny, z: nz } = _normal;
    const drop = Math.abs(ny) > Math.max(Math.abs(nx), Math.abs(nz)) ? 1 : Math.abs(nx) > Math.abs(nz) ? 0 : 2;
    const u = (drop + 1) % 3, v = (drop + 2) % 3;
    const axis = [nx, ny, nz][drop];
    const outline = [], holes = [];
    const base = this.p.length / 3;
    for (let r = 0; r < rings.length; r++) {
      if (r) holes.push(outline.length / 2);
      const ring = rings[r];
      for (let i = 0; i < ring.length; i += 3) {
        const [x, y, z] = ring.slice(i, i + 3);
        outline.push(ring[i + u], ring[i + v]);
        this.p.push(x, y, z);
        this.n.push(nx, ny, nz);
        this.c.push(color.r, color.g, color.b);
        this.uv.push(...uv(x, y, z));
      }
    }
    const tri = Earcut.triangulate(outline, holes);
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], c = tri[i + 2];
      const ax = outline[a * 2], ay = outline[a * 2 + 1];
      const cross = (outline[b * 2] - ax) * (outline[c * 2 + 1] - ay) - (outline[b * 2 + 1] - ay) * (outline[c * 2] - ax);
      this.indices.push(base + a, base + (cross * axis > 0 ? b : c), base + (cross * axis > 0 ? c : b));
    }
  }

  geometry() {
    if (!this.indices.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    geo.setAttribute('aWin', new THREE.Float32BufferAttribute(this.uv, 3));
    geo.setIndex(this.indices);
    return geo;
  }
}


/** Výškový dotaz po trojúhelnících stejných ploch, které se zobrazují za letu. */
export class HeritageRoofs {
  constructor() { this.cells = new Map(); }

  add(mesh, firstIndex) {
    const { p, indices } = mesh;
    for (let i = firstIndex; i < indices.length; i += 3) {
      const a = indices[i] * 3, b = indices[i + 1] * 3, c = indices[i + 2] * 3;
      const x = p[a], z = p[a + 2], ux = p[b] - x, uz = p[b + 2] - z, vx = p[c] - x, vz = p[c + 2] - z;
      const det = ux * vz - uz * vx;
      if (Math.abs(det) < 1e-5) continue;
      const tri = [x, z, p[a + 1], ux, uz, vx, vz, p[b + 1] - p[a + 1], p[c + 1] - p[a + 1], 1 / det];
      const left = Math.floor(Math.min(x, p[b], p[c]) / 16), right = Math.floor(Math.max(x, p[b], p[c]) / 16);
      const top = Math.floor(Math.min(z, p[b + 2], p[c + 2]) / 16), bottom = Math.floor(Math.max(z, p[b + 2], p[c + 2]) / 16);
      for (let cz = top; cz <= bottom; cz++) for (let cx = left; cx <= right; cx++) {
        const key = cx * 4096 + cz;
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key).push(tri);
      }
    }
  }

  heightAt(x, z) {
    const triangles = this.cells.get(Math.floor(x / 16) * 4096 + Math.floor(z / 16));
    if (!triangles) return -Infinity;
    let y = -Infinity;
    for (const [ax, az, ay, ux, uz, vx, vz, uy, vy, invDet] of triangles) {
      const dx = x - ax, dz = z - az;
      const u = (dx * vz - dz * vx) * invDet, v = (ux * dz - uz * dx) * invDet;
      if (u >= -1e-5 && v >= -1e-5 && u + v <= 1.00001) y = Math.max(y, ay + uy * u + vy * v);
    }
    return y;
  }
}
