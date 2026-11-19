import * as THREE from 'three/webgpu';

/** Jednoduché plné díly s barvou po ploškách (mostovky, pilíře). */
export class SolidBuf {
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
