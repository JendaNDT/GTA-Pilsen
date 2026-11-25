import * as THREE from 'three/webgpu';
import { attribute, dFdx, dFdy, texture, uv, vec2 } from 'three/tsl';

const names =
  'plain tile metal brick beseda church cloister market factory modern depot farm barn brewery plaster spire rose door gate-sign beseda-sign tech-sign depo-sign tower-sign amfi-sign pinnacle bell lookout seats townchurch stone planet-sign stage church-front friary-front'.split(
    ' ',
  );
const cells = new Map(names.map((name, i) => [name, [i % 8, 4 - Math.floor(i / 8)]]));
const white = new THREE.Color();
const basis = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export function exteriorMaterial() {
  const map = new THREE.TextureLoader().load(new URL('./povrchy.svg', import.meta.url).href);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const mat = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide, roughness: 0.88 });
  const tile = attribute('aCell', 'vec2');
  const coord = uv().fract().mul(0.98).add(0.01).add(tile).div(vec2(8, 5));
  const unwrapped = uv().mul(0.98).div(vec2(8, 5));
  mat.colorNode = texture(map, coord).grad(dFdx(unwrapped), dFdy(unwrapped)).rgb.mul(attribute('color', 'vec3'));
  mat.map = map;
  return mat;
}

// Osa u sleduje fasádu, kladná hloubka míří vpravo od ní v půdorysu.
export function frame(x, z, base, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (u, d, y) => [x + c * u - s * d, base + y, z + s * u + c * d];
}

export class Exterior {
  constructor() {
    this.points = [];
    this.uv = [];
    this.cells = [];
    this.colors = [];
  }
  tri(pts, surface, coords = basis, tint = 0xffffff) {
    const cell = cells.get(surface);
    white.setHex(tint);
    for (let i = 0; i < 3; i++) {
      this.points.push(...pts[i]);
      this.uv.push(...coords[i]);
      this.cells.push(...cell);
      this.colors.push(white.r, white.g, white.b);
    }
  }
  quad(a, b, c, d, surface, tint, repeat = 1, rows = 1) {
    const u = repeat - 0.0001,
      v = rows - 0.0001;
    this.tri(
      [a, b, c],
      surface,
      [
        [0, 0],
        [u, 0],
        [u, v],
      ],
      tint,
    );
    this.tri(
      [a, c, d],
      surface,
      [
        [0, 0],
        [u, v],
        [0, v],
      ],
      tint,
    );
  }
  panel(p, u, d, y, width, height, surface, tint, repeat = 1, rows = 1) {
    this.quad(
      p(u - width / 2, d, y),
      p(u + width / 2, d, y),
      p(u + width / 2, d, y + height),
      p(u - width / 2, d, y + height),
      surface,
      tint,
      repeat,
      rows,
    );
  }
  block(p, u, d, y, w, depth, h, surface, tint) {
    const l = u - w / 2,
      r = u + w / 2,
      a = d - depth / 2,
      b = d + depth / 2;
    const ring = [
      [l, a],
      [r, a],
      [r, b],
      [l, b],
    ];
    ring.forEach(([x, z], i) => {
      const [nx, nz] = ring[(i + 1) % 4];
      this.quad(p(nx, nz, y), p(x, z, y), p(x, z, y + h), p(nx, nz, y + h), surface, tint);
    });
    this.quad(p(l, b, y + h), p(r, b, y + h), p(r, a, y + h), p(l, a, y + h), surface, tint);
  }
  // Plocha rotačního tělesa včetně horní podesty. Profil může přecházet z válce do báně.
  lathe(p, u, d, profile, surface, tint, sides = 16) {
    for (let i = 0; i < sides; i++) {
      const a = (2 * Math.PI * i) / sides,
        b = (2 * Math.PI * (i + 1)) / sides;
      const at = ([y, r], t) => p(u + r * Math.cos(t), d + r * Math.sin(t), y);
      for (let k = 1; k < profile.length; k++) {
        const lo = profile[k - 1],
          hi = profile[k];
        this.quad(at(lo, b), at(lo, a), at(hi, a), at(hi, b), surface, tint);
      }
      const last = profile.at(-1);
      if (last[1] > 0) this.tri([at(last, b), at(last, a), p(u, d, last[0])], surface, undefined, tint);
    }
  }
  geometry() {
    if (!this.points.length) return null;
    const geo = new THREE.BufferGeometry();
    for (const [key, array, size] of [
      ['position', this.points, 3],
      ['uv', this.uv, 2],
      ['color', this.colors, 3],
      ['aCell', this.cells, 2],
    ]) {
      geo.setAttribute(key, new THREE.Float32BufferAttribute(array, size));
    }
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}
