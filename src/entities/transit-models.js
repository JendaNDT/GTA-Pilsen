// Ručně modelované karoserie podle plzeňských vozů. Souřadnice jsou v metrech, +z je vpřed.
import * as THREE from 'three/webgpu';
import { Parts } from './models.js';
import { transitMaterial as shellMat } from './transit-material.js';
import { makeSurfaceMaterial } from '../world/materials.js';
import { SURFACE } from '../world/material-table.js';
import { smoothNormals } from './car-body.js';
import { pageLook } from '../world/daylight.js';

// Nový vzhled: oblé čelo a zaoblené přechody bez viditelných plošek, ostré hrany zůstávají.
const shade = (geometry) => (pageLook() === 'novy' ? smoothNormals(geometry, 28) : geometry);

const color = (hex) => new THREE.Color(hex).toArray();
const YELLOW = color(0xf2be25), RED = color(0xc4222a), WHITE = color(0xe5e3db);
const DARK = color(0x1e2328), RUBBER = color(0x23252a), METAL = color(0x7e8689);
const TRAM_GLASS = color(0x304652), BUS_GLASS = color(0x354c56), REFLECTION = color(0x47606c);
const DOOR_INTERIOR = color(0x45494a);
const HEAD = color(0xffedcb), TAIL = color(0xf12827), MARKER = color(0xf4a232);

export const TRAM_SECTIONS = [
  { length: 9.4, doors: [2.36, -3.25], wheels: [0.47], front: true },
  { length: 10.34, doors: [0], wheels: [2.79, -2.79] },
  { length: 9.4, doors: [3.25, -2.36], wheels: [-0.47], rear: true },
];
export const BUS_SECTION = {
  length: 12, doors: [4.69, -0.63, -4.23], wheels: [3.3, -2.6], front: true, rear: true,
};
export const TROLLEY_SECTION = {
  length: 11.8, doors: [3.9, -1.5], wheels: [2.52, -3.36], front: true, rear: true,
};
const TATRA_LENGTH = 15.1;
const TATRA_DOORS = [6.02, 0.09, -5.96];
const TATRA_STEPS = [0.78, 0.36, 0.78];
const TATRA_CAR = { length: 16.2, doors: TATRA_DOORS, axle: 3.2 };
export const TATRA_SECTIONS = [TATRA_CAR, TATRA_CAR];
const TATRA_WIDTH = 2.48;
const TATRA_DOOR_WIDTH = 1.2;
const TATRA_DOOR_TOP = 2.74;
const TATRA_GREY = color(0x4e606b);
const TATRA_ROOF = color(0xc3c6c5);
const TRAM = {
  halfWidth: 1.25, bottom: 0.26, stripe: 1.03, sill: 1.12, top: 2.84, roof: 3.4,
  paint: YELLOW, trim: WHITE, glass: TRAM_GLASS, doorWidth: 1.30, doorBottom: 0.36, doorTop: 2.55,
};
const BUS = {
  halfWidth: 1.275, bottom: 0.28, stripe: 0.48, sill: 1.07, top: 2.73, roof: 2.995,
  paint: RED, trim: WHITE, glass: BUS_GLASS, doorWidth: 1.20, doorBottom: 0.34, doorTop: 2.48,
};

const TROLLEY = { ...BUS, paint: color(0x238453), stripe: 0.59 };
const transitSurfaces = new Map([
  [TRAM_GLASS, SURFACE.glass], [BUS_GLASS, SURFACE.glass], [REFLECTION, SURFACE.glass],
  [METAL, SURFACE.transitMetal], [RUBBER, SURFACE.rubber], [DARK, SURFACE.rubber],
]);
const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const geometry = new Map();
const leafGeometry = new Map();
const doorMatrix = new THREE.Matrix4();
const foldingLeaf = new THREE.Object3D();

// Rovinný polygon s normálou ven, společná geometrie pro celou karoserii.
function face(parts, points, paint, outward) {
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[0], b = points[i], c = points[i + 1];
    const u = b.map((p, k) => p - a[k]), v = c.map((p, k) => p - a[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const size = Math.hypot(...n);
    if (size < 1e-8) continue;
    const sign = n.reduce((dot, p, k) => dot + p * outward[k], 0) < 0 ? -1 : 1;
    for (const q of sign > 0 ? [a, b, c] : [a, c, b]) {
      parts.vertex(...q, ...n.map((p) => p * sign / size), paint);
    }
  }
}

function panel(parts, x, lo, hi, y0, y1, paint, side) {
  if (hi <= lo || y1 <= y0) return;
  face(parts, [[x, y0, lo], [x, y0, hi], [x, y1, hi], [x, y1, lo]], paint, [side, 0, 0]);
}

function sideBody(parts, style, section, lo, hi, tram) {
  const { halfWidth: w, bottom, stripe, sill, top, paint, trim, glass, doorWidth, doorBottom, doorTop } = style;
  for (const side of [-1, 1]) {
    const x = side * w, surface = x + side * 0.003;
    const gaps = section.doors.map((z) => ({ z, r: doorWidth / 2, door: true }));
    if (!tram) for (const z of section.wheels) gaps.push({ z, r: 0.54, door: false });
    const cuts = [lo, hi, ...gaps.flatMap(({ z, r }) => [z - r, z + r])].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1], b = cuts[i], center = (a + b) / 2;
      const door = side === -1 && gaps.some((g) => g.door && Math.abs(g.z - center) < g.r);
      const arch = gaps.some((g) => !g.door && Math.abs(g.z - center) < g.r);
      const y0 = arch ? 0.98 : bottom;
      panel(parts, x, a, b, Math.max(y0, door ? doorTop : 0), top, DARK, side);
      if (!door) {
        panel(parts, surface, a, b, y0, stripe, paint, side);
        panel(parts, surface, a, b, Math.max(y0, stripe), sill, trim, side);
      } else if (y0 < doorBottom) {
        panel(parts, surface, a, b, y0, doorBottom, paint, side);
      }
    }
    // Okna mají vlastní výplně, sloupky i jemný odraz, nikoli jeden nepřerušený pás.
    const openings = section.doors.map((z) => [z - doorWidth / 2, z + doorWidth / 2]);
    const windows = side === -1 || tram ? openings.sort((a, b) => a[0] - b[0]) : [];
    let from = lo;
    for (const [a, b] of [...windows, [hi, hi]]) {
      const n = Math.max(1, Math.round((a - from) / (tram ? 1.63 : 1.55)));
      const dz = (a - from) / n;
      for (let k = 0; k < n && dz > 0.22; k++) {
        const z0 = from + dz * k + 0.042, z1 = z0 + dz - 0.084;
        panel(parts, surface, z0, z1, sill + 0.052, top - 0.27, glass, side);
        panel(parts, surface + side * 0.002, z0 + 0.04, z1 - 0.04, top - 0.39, top - 0.31, REFLECTION, side);
      }
      from = b;
    }
    if (style === TROLLEY) {
      const skin = surface + side * 0.002;
      for (const axle of section.wheels) {
        // Horní půlkruh lemuje kolo a doplňuje lak do rohů obdélníkového výřezu.
        for (let i = 0; i < 12; i++) {
          const point = (j) => {
            const angle = j * Math.PI / 12;
            return [skin, 0.485 + 0.515 * Math.sin(angle), axle + 0.54 * Math.cos(angle)];
          };
          const a = point(i), b = point(i + 1);
          face(parts, [a, b, [skin, 1.01, b[2]], [skin, 1.01, a[2]]], trim, [side, 0, 0]);
        }
      }
      const cove = [[lo, 0.66], [lo + 0.47, 0.66], [lo + 1.21, 1.03], [lo, 1.03]];
      face(parts, cove.map(([z, y]) => [skin, y, z]), paint, [side, 0, 0]);
      for (let i = 0; i < 4; i++) panel(parts, skin + side * 0.003, lo + 0.12, lo + 0.48,
        0.70 + i * 0.064, 0.724 + i * 0.064, DARK, side);
    }
    for (const z of section.doors) {
      if (side < 0) {
        // Za skutečným otvorem v boku je podlaha, ostění a madlo.
        const a = z - doorWidth / 2, b = z + doorWidth / 2;
        panel(parts, -0.30, a - 0.12, b + 0.12, doorBottom, doorTop, DOOR_INTERIOR, side);
        parts.box(w - 0.25, 0.045, doorWidth, -(w + 0.25) / 2, doorBottom - 0.024, z, METAL);
        for (const edge of [a, b]) parts.box(w - 0.25, doorTop - doorBottom, 0.035, -(w + 0.25) / 2, (doorTop + doorBottom) / 2, edge, DARK);
        parts.box(0.042, 1.58, 0.042, -0.88, 1.17, z + doorWidth * 0.39, YELLOW);
      } else if (tram) {
        for (const dz of [-1, 1]) doorLeaf(parts, style, 1, z + dz * doorWidth / 4);
      }
    }
  }
  // Horní boční rádius a zaoblený přechod na střechu.
  const length = hi - lo;
  parts.box(w * 2, style.roof - top, length, 0, (style.roof + top) / 2, (lo + hi) / 2, style.paint, 0.86);
  if (!tram) parts.box(w * 1.69, 0.015, length - 0.06, 0, style.roof, (lo + hi) / 2, WHITE, 0.99);
  parts.box(w * 1.54, 0.12, length, 0, bottom + 0.04, (lo + hi) / 2, DARK);
}

function doorLeaf(parts, style, side, z) {
  const { halfWidth, doorWidth, doorBottom, doorTop, paint, trim, stripe, glass, sill } = style;
  const w = doorWidth / 2 - 0.024, lo = z - w / 2, hi = z + w / 2;
  const x = side * (halfWidth + 0.021);
  panel(parts, x, lo, hi, doorBottom, doorTop, RUBBER, side);
  const surface = x + side * 0.004;
  if (style === TROLLEY) {
    panel(parts, surface, lo + 0.045, hi - 0.045, doorBottom + 0.18, doorTop - 0.075, glass, side);
    panel(parts, surface + side * 0.002, lo + 0.045, hi - 0.045, 1.18, 1.22, METAL, side);
    panel(parts, surface + side * 0.002, lo + 0.08, hi - 0.08, doorTop - 0.24, doorTop - 0.20, REFLECTION, side);
    return;
  }
  panel(parts, surface, lo + 0.022, hi - 0.022, doorBottom + 0.035, doorTop - 0.025, paint, side);
  if (style === BUS) panel(parts, surface + side * 0.002, lo + 0.045, hi - 0.045, stripe, sill, trim, side);
  panel(parts, surface + side * 0.004, lo + 0.061, hi - 0.061, style === TRAM ? 0.81 : sill, doorTop - 0.10, glass, side);
  panel(parts, surface + side * 0.006, lo + 0.095, hi - 0.095, doorTop - 0.22, doorTop - 0.17, REFLECTION, side);
}

// Řezy čelem: výška, podíl šířky, vzdálenost čela od konce, zaoblení rohů.
const TRAM_NOSE = [
  [0.26, 0.87, 0.2, 0.45], [0.55, 0.92, 0.07, 0.49], [1.03, 0.98, 0, 0.54],
  [1.12, 0.99, 0.01, 0.55], [1.44, 1, 0.07, 0.60], [2.46, 1, 0.37, 0.48],
  [2.84, 1, 0.51, 0.39], [3.23, 0.96, 0.62, 0.31], [3.4, 0.86, 0.79, 0.22],
];
const BUS_NOSE = [
  [0.28, 0.91, 0.12, 0.23], [0.48, 1, 0.015, 0.28], [1.07, 1, 0, 0.34],
  [1.26, 1, 0.06, 0.34], [2.52, 1, 0.16, 0.28], [2.73, 1, 0.21, 0.23],
  [2.995, 0.86, 0.36, 0.17],
];
const BUS_REAR = [
  [0.28, 0.92, 0.08, 0.20], [0.48, 1, 0.015, 0.22], [1.07, 1, 0, 0.22],
  [1.48, 1, 0.01, 0.22], [2.52, 1, 0.055, 0.25], [2.73, 1, 0.1, 0.22],
  [2.995, 0.86, 0.2, 0.13],
];
const FACETS = [-1, -0.89, -0.67, 0, 0.67, 0.89, 1];
const halfCab = (style, side) => style === TRAM ? 1.59 : side > 0 ? 0.67 : 0.38;

const edge = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);

// Světla a grafika kopírují skutečné plošky čela i přes jejich ohyby.
function onCab(parts, facets, outline, paint, side, offset) {
  for (const [a, b, c] of facets) {
    let poly = outline;
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const clipped = [];
      for (let i = 0; i < poly.length; i++) {
        const prev = poly[(i + poly.length - 1) % poly.length], p = poly[i];
        const d0 = edge(from, to, prev), d1 = edge(from, to, p);
        if ((d0 < 0) !== (d1 < 0)) {
          const t = d0 / (d0 - d1);
          clipped.push([THREE.MathUtils.lerp(prev[0], p[0], t), THREE.MathUtils.lerp(prev[1], p[1], t)]);
        }
        if (d1 >= 0) clipped.push(p);
      }
      poly = clipped;
      if (poly.length < 3) break;
    }
    if (poly.length < 3) continue;
    const area = edge(a, b, c);
    const surface = poly.map((p) => [p[0], p[1],
      (a[2] * edge(b, c, p) + b[2] * edge(c, a, p) + c[2] * edge(a, b, p)) / area + side * offset]);
    face(parts, surface, paint, [0, 0, side]);
  }
}

function cab(parts, lamps, style, end, side) {
  const tram = style === TRAM;
  const rows = tram ? TRAM_NOSE : side > 0 ? BUS_NOSE : BUS_REAR;
  const depth = halfCab(style, side);
  const facets = [];
  const corner = (x) => Math.abs(x) === 1 ? 1 : Math.abs(x) > 0.88 ? 0.28 : 0;
  const point = ([y, w, inset, round], x, bias) => [
    x * w * style.halfWidth, y, side * (end - inset - round * corner(x) + bias),
  ];
  for (let row = 1; row < rows.length; row++) {
    const a = rows[row - 1], b = rows[row];
    for (let f = 1; f < FACETS.length; f++) {
      const lo = FACETS[f - 1], hi = FACETS[f];
      const outer = Math.max(Math.abs(lo), Math.abs(hi));
      const paint = tram
        ? row <= 2 ? YELLOW : row === 3 ? WHITE : row === 8 && outer === 1 ? YELLOW
          : row === 5 ? TRAM_GLASS : DARK
        : row <= 2 ? style.paint : row === 4 && Math.min(Math.abs(lo), Math.abs(hi)) < 0.9
          ? BUS_GLASS : row === 6 && outer === 1 ? style.paint : DARK;
      const [p, q, r, s] = [point(a, lo, 0), point(a, hi, 0), point(b, hi, 0), point(b, lo, 0)];
      facets.push([p, q, r], [p, r, s]);
      face(parts, [p, q, r, s], paint, [0, 0, side]);
    }
    for (const s of [-1, 1]) {
      const paint = b[0] <= style.stripe ? style.paint : b[0] <= style.sill ? style.trim : b[0] > style.top ? style.paint : style.glass;
      const seam = ([y]) => [s * style.halfWidth * (1 - 0.14 * Math.max(0, y - style.top) / (style.roof - style.top)), y, side * (end - depth)];
      face(parts, [seam(a), point(a, s, 0), point(b, s, 0), seam(b)], paint, [s, 0, 0]);
    }
  }
  const top = rows.at(-1), roofZ = side * (end - depth);
  for (let f = 1; f < FACETS.length; f++) {
    const a = point(top, FACETS[f - 1], 0), b = point(top, FACETS[f], 0);
    face(parts, [a, b, [b[0], b[1], roofZ], [a[0], a[1], roofZ]], style.paint, [0, 1, 0]);
  }

  const details = (target, outline, paint, offset = 0.01) => onCab(target, facets, outline, paint, side, offset);
  const badge = (target, x, y, w, h, paint, offset) => details(target, [
    [x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2],
  ], paint, offset);
  const lamp = (x, y, r, paint) => details(lamps, Array.from({ length: 10 }, (_, i) => [
    x + Math.cos(i * Math.PI / 5) * r, y + Math.sin(i * Math.PI / 5) * r,
  ]), paint, 0.035);

  if (style === TROLLEY && side > 0) {
    // Světlá maska spojuje oba světlomety pod dolní hranou panoramatického skla.
    details(parts, [[-1.20, 1.16], [1.20, 1.16], [1.13, 0.76], [0.72, 0.71],
      [0.50, 0.84], [-0.50, 0.84], [-0.72, 0.71], [-1.13, 0.76]], WHITE);
    for (const s of [-1, 1]) {
      details(parts, [[s*0.60, 0.97], [s*1.13, 1.06], [s*1.10, 0.81], [s*0.75, 0.78]], DARK, 0.021);
      details(lamps, [[s*0.69, 0.945], [s*1.06, 1.01], [s*1.05, 0.96], [s*0.76, 0.90]], HEAD, 0.031);
      lamp(s*0.93, 0.865, 0.049, HEAD);
    }
    badge(parts, 0, 0.57, 0.46, 0.105, WHITE);
  } else if (!tram && side > 0) {
    for (const s of [-1, 1]) {
      details(parts, [[0, 0.93], [s * 0.69, 1.06], [s * 1.05, 1.17], [s * 0.99, 1.07], [s * 0.70, 0.97], [0, 0.84]], WHITE);
      details(parts, [[s * 0.63, 0.65], [s * 0.95, 0.52], [s * 1.12, 0.72], [s * 1.10, 1.04], [s * 0.74, 0.89]], METAL);
      for (const [x, y] of [[0.78, 0.78], [0.91, 0.76]]) lamp(s * x, y, 0.060, HEAD);
      for (let k = 0; k < 4; k++) lamp(s * (0.78 + k * 0.07), 0.88 + k * 0.026, 0.017, HEAD);
    }
    badge(parts, 0, 0.48, 0.49, 0.13, DARK);
    badge(parts, 0, 0.48, 0.36, 0.088, WHITE, 0.025);
    badge(parts, 0, 1.07, 0.18, 0.035, METAL, 0.025);
  } else {
    for (const s of [-1, 1]) {
      if (tram) {
        lamp(s * 0.75, 1.30, 0.073, side > 0 ? HEAD : TAIL);
        lamp(s * 0.75, 1.17, 0.033, side > 0 ? HEAD : TAIL);
        lamp(s * 0.86, 0.88, 0.031, MARKER);
      } else {
        badge(parts, s * 0.98, 0.89, 0.15, 0.72, DARK);
        for (const y of [0.67, 0.87, 1.02]) lamp(s * 0.98, y, 0.052, y === 1.02 ? MARKER : TAIL);
      }
    }
    if (!tram) {
      badge(parts, 0, 0.61, 0.35, 0.095, WHITE);
      for (let i = 0; i < 3; i++) badge(parts, 0, 1.10 - i * 0.065, 0.75, 0.026, DARK);
    }
  }
  if (tram || side > 0) {
    for (const s of [-1, 1]) {
      details(parts, [[s * 0.16, 1.48], [s * 0.18, 1.48], [s * 0.56, 1.85], [s * 0.54, 1.85]], DARK, 0.028);
      parts.box(0.21, 0.065, 0.10, s * (style.halfWidth + 0.03), 2.38, side * (end - 0.76), DARK);
      parts.box(0.12, tram ? 0.29 : 0.42, 0.15, s * (style.halfWidth + 0.13), 2.23, side * (end - 0.73), DARK, 0.89, 0.80);
    }
  }
}

function equipment(parts, style, section) {
  const tram = style === TRAM;
  for (const wheel of section.wheels) {
    if (tram) parts.box(1.78, 0.32, 1.77, 0, 0.29, wheel, DARK);
    for (const x of [-1, 1]) {
      for (const z of tram ? [wheel - 0.58, wheel + 0.58] : [wheel]) {
        parts.wheel(tram ? 0.30 : 0.485, tram ? 0.15 : 0.24, x * (tram ? 0.73 : 1.12), tram ? 0.30 : 0.485, z, RUBBER, 12);
      }
    }
  }
  if (tram) {
    for (const z of [-2.31, 2.31]) {
      parts.box(1.48, 0.13, 1.65, 0, 3.465, z, METAL, 0.93, 0.93);
      for (const x of [-0.53, -0.40, 0.40, 0.53]) parts.box(0.04, 0.012, 1.12, x, 3.536, z, DARK);
    }
    if (!section.front && !section.rear) {
      pantograph(parts, 3.4, 0, METAL);
    }
  } else if (style === TROLLEY) {
    trolleyEquipment(parts);
  } else {
    parts.box(1.71, 0.16, 3.16, 0, 2.91, -1.74, WHITE, 0.91, 0.89);
    for (const z of [-2.87, -2.73, -2.59, -2.45, -2.31, -2.17]) {
      parts.box(0.9, 0.01, 0.044, 0, 2.995, z, DARK);
    }
  }
}

// Sběrače, izolátory i stahovací lana patří do jedné sdílené geometrie karoserie.
function trolleyRod(parts, x, y, z, endX, endY, endZ, radius, endRadius, paint) {
  const axis = new THREE.Vector3(endX - x, endY - y, endZ - z);
  const cylinder = new THREE.CylinderGeometry(endRadius, radius, axis.length(), 8);
  cylinder.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()));
  cylinder.translate((x + endX) / 2, (y + endY) / 2, (z + endZ) / 2);
  parts.mesh(cylinder.toNonIndexed(), paint);
  cylinder.dispose();
}

function trolleyEquipment(parts) {
  for (const side of [-1, 1]) for (const axle of TROLLEY_SECTION.wheels) {
    const x = side * 1.259;
    parts.ring(0.165, 0.237, x, 0.485, axle, side, METAL, 16, SURFACE.transitMetal);
    parts.ring(0.095, 0.165, x, 0.485, axle, side, DARK, 16, SURFACE.rubber);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      parts.box(0.014, 0.038, 0.038, x, 0.485 + 0.13 * Math.sin(angle), axle + 0.13 * Math.cos(angle), METAL);
    }
  }
  const roof = TROLLEY.roof;
  parts.box(1.68, 0.33, 2.6, 0, roof + 0.17, 3.02, WHITE, 0.88, 0.9);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      parts.box(0.38, 0.012, 0.077, side * 0.40, roof + 0.342, 2.34 + i * 0.22, METAL);
    }
    const x = side * 0.34, tipX = side * 0.43;
    for (const z of [-0.25, 0.79]) {
      parts.box(0.19, 0.19, 0.19, x, roof + 0.10, z, DARK);
      parts.box(0.27, 0.045, 0.27, x, roof + 0.13, z, WHITE);
    }
    parts.box(0.34, 0.13, 1.46, x, roof + 0.25, 0.25, METAL, 0.91);
    parts.box(0.25, 0.21, 0.42, x, roof + 0.38, 0.52, DARK);
    trolleyRod(parts, x, roof + 0.43, 0.52, tipX, 5.36, -5.84, 0.066, 0.036, METAL);
    trolleyRod(parts, x, roof + 0.31, -0.39, x, roof + 0.85, -0.93, 0.078, 0.052, DARK);
    parts.box(0.095, 0.09, 0.40, tipX, 5.39, -5.91, DARK, 0.78);
    const reelX = side * 0.63;
    parts.box(0.31, 0.36, 0.14, reelX, 1.55, -5.90, METAL, 0.88);
    trolleyRod(parts, tipX, 5.35, -6.04, reelX, 1.64, -5.98, 0.017, 0.017, DARK);
  }
}

function pantograph(parts, base, z, paint) {
  parts.box(1.04, 0.12, 1.03, 0, base + 0.06, z + 0.15, DARK);
  for (const x of [-0.23, 0.23]) {
    for (const [ya, za, yb, zb] of [[0.12, -0.41, 0.91, 0.55], [0.91, 0.55, 1.53, -0.21]]) {
      const arm = new Parts();
      arm.box(0.045, Math.hypot(yb - ya, zb - za), 0.051, 0, 0, 0, paint);
      const angle = Math.atan2(zb - za, yb - ya), cos = Math.cos(angle), sin = Math.sin(angle);
      for (let i = 0; i < arm.p.length; i += 3) {
        parts.vertex(x + arm.p[i], base + (ya + yb) / 2 + arm.p[i + 1] * cos - arm.p[i + 2] * sin,
          z + (za + zb) / 2 + arm.p[i + 1] * sin + arm.p[i + 2] * cos,
          arm.n[i], arm.n[i + 1] * cos - arm.n[i + 2] * sin, arm.n[i + 1] * sin + arm.n[i + 2] * cos, paint);
      }
    }
  }
  parts.box(1.54, 0.04, 0.21, 0, base + 1.54, z - 0.21, DARK, 0.94, 0.9);
}

function makeSection(section, style) {
  if (!geometry.has(section)) {
    const body = new Parts(SURFACE.transitPaint, transitSurfaces), lamps = new Parts();
    const half = section.length / 2;
    const lo = -half + (section.rear ? halfCab(style, -1) : 0.26);
    const hi = half - (section.front ? halfCab(style, 1) : 0.26);
    sideBody(body, style, section, lo, hi, style === TRAM);
    for (const [side, hasCab, z] of [[1, section.front, hi], [-1, section.rear, lo]]) {
      if (hasCab) cab(body, lamps, style, half, side);
      else body.box(2.41, 2.95, 0.08, 0, 1.75, z - side * 0.04, RUBBER);
    }
    equipment(body, style, section);
    geometry.set(section, [shade(body.geometry()), lamps.p.length ? lamps.geometry() : null]);
  }
  const [body, lamps] = geometry.get(section);
  const group = new THREE.Group();
  const shell = new THREE.Mesh(body, shellMat);
  shell.castShadow = true;
  group.add(shell);
  if (lamps) group.add(new THREE.Mesh(lamps, lampMat));
  if (section.front) {
    group.userData.sign = style === TRAM
      ? { y: 2.66, z: 4.276, tilt: -0.35, width: 1.58, sideX: 1.259, sideY: 2.65, sideZ: -0.50 }
      : { y: 2.34, z: section.length / 2 - 0.121, tilt: -0.08, width: 1.65, sideX: 1.284, sideY: 2.58, sideZ: 2.00 };
  }

  if (!leafGeometry.has(style)) {
    const leaf = new Parts(SURFACE.transitPaint, transitSurfaces);
    doorLeaf(leaf, style, -1, 0);
    leafGeometry.set(style, leaf.geometry());
  }
  mountDoors(group, leafGeometry.get(style), section.doors, style.doorWidth, 2);
  return group;
}

function mountDoors(group, geometry, centers, width, leaves) {
  const mesh = new THREE.InstancedMesh(geometry, shellMat, centers.length * leaves);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(mesh);
  group.userData.doors = { mesh, centers, width, leaves };
  setModelDoors(group, 0);
  mesh.computeBoundingSphere();
  mesh.boundingSphere.radius += width / 2;
}

export const makeTramSection = (section) => makeSection(section, TRAM);
export const makeTrolleybus = () => makeSection(TROLLEY_SECTION, TROLLEY);
export const makeSorBus = () => makeSection(BUS_SECTION, BUS);

export function setModelDoors(group, fraction) {
  const { mesh, centers, width, leaves } = group.userData.doors;
  if (leaves === 4) {
    setFoldingDoors(mesh, fraction);
    return;
  }
  const shift = width / 4 + fraction * width * 0.43;
  let i = 0;
  for (const z of centers) {
    for (const s of [-1, 1]) {
      mesh.setMatrixAt(i++, doorMatrix.makeTranslation(-0.055 * fraction, 0, z + s * shift));
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function setFoldingDoors(mesh, fraction) {
  const angle = fraction * 1.43;
  const width = TATRA_DOOR_WIDTH / 4;
  const depth = width * Math.sin(angle);
  const along = width * Math.cos(angle);
  let instance = 0;
  for (const [i, z] of TATRA_DOORS.entries()) {
    const step = TATRA_STEPS[i];
    foldingLeaf.scale.y = TATRA_DOOR_TOP - step;
    for (const direction of [-1, 1]) {
      const jamb = z - direction * TATRA_DOOR_WIDTH / 2;
      for (let leaf = 0; leaf < 2; leaf++) {
        foldingLeaf.position.set(-TATRA_WIDTH / 2 - 0.012 + depth / 2, step, jamb + direction * along * (leaf + 0.5));
        foldingLeaf.rotation.y = direction * (leaf === 0 ? angle : -angle);
        foldingLeaf.updateMatrix();
        mesh.setMatrixAt(instance++, foldingLeaf.matrix);
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function tatraSide(parts, end) {
  const width = TATRA_WIDTH / 2;
  const halfDoor = TATRA_DOOR_WIDTH / 2;
  const doorEdges = TATRA_DOORS.flatMap((z) => [z - halfDoor, z + halfDoor]);
  const cuts = [-end, end, -4.48, -2.68, -1.62, 1.62, 2.68, 4.48, ...doorEdges].sort((a, b) => a - b);
  // Šedý pás oken a světlá linka klesají společně s podlahou u prostředních dveří.
  const dip = (z) => 0.26 * THREE.MathUtils.clamp((2.68 - Math.abs(z)) / 1.06, 0, 1);
  for (const side of [-1, 1]) {
    const x = side * width;
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1], b = cuts[i], center = (a + b) / 2;
      const door = side < 0 ? TATRA_DOORS.findIndex((z) => Math.abs(z - center) < halfDoor) : -1;
      const opening = door >= 0;
      const stripeA = 0.99 - dip(a), stripeB = 0.99 - dip(b);
      const arch = Math.abs(center) > 2.68 && Math.abs(center) < 4.48;
      const bottom = arch ? 0.84 : 0.50 - dip(center) * 0.78;
      const band = (ay, by, cy, dy, paint) => face(parts,
        [[x, ay, a], [x, by, b], [x, cy, b], [x, dy, a]], paint, [side, 0, 0]);
      if (opening) {
        panel(parts, x, a, b, bottom, Math.max(bottom, TATRA_STEPS[door]), YELLOW, side);
        panel(parts, x, a, b, TATRA_DOOR_TOP, 2.79, TATRA_GREY, side);
      } else {
        band(bottom, bottom, stripeB, stripeA, YELLOW);
        band(stripeA, stripeB, stripeB + 0.105, stripeA + 0.105, WHITE);
        band(stripeA + 0.105, stripeB + 0.105, stripeB + 0.62, stripeA + 0.62, YELLOW);
        band(stripeA + 0.62, stripeB + 0.62, 2.79, 2.79, TATRA_GREY);
      }
    }
    const openings = side < 0 ? [...TATRA_DOORS].sort((a, b) => a - b) : [];
    let start = -end;
    for (const door of [...openings, end + halfDoor]) {
      const limit = door - halfDoor;
      const count = Math.round((limit - start) / 1.6);
      for (let i = 0; i < count; i++) {
        const bay = (limit - start) / count;
        const a = start + i * bay + 0.092, b = a + bay - 0.184;
        const low = 1.72 - dip((a + b) / 2) * 0.55, high = 2.72;
        const corner = 0.063, glassX = x + side * 0.008;
        face(parts, [[glassX, low, a + corner], [glassX, low, b - corner], [glassX, low + corner, b],
          [glassX, high - corner, b], [glassX, high, b - corner], [glassX, high, a + corner],
          [glassX, high - corner, a], [glassX, low + corner, a]], DARK, [side, 0, 0]);
        panel(parts, x + side * 0.013, a + 0.05, b - 0.05, low + 0.043, high - 0.043, TRAM_GLASS, side);
        panel(parts, x + side * 0.018, a + 0.05, b - 0.05, 2.37, 2.40, TATRA_ROOF, side);
      }
      start = door + halfDoor;
    }
  }
  for (const [i, z] of TATRA_DOORS.entries()) {
    const step = TATRA_STEPS[i];
    panel(parts, -0.45, z - halfDoor, z + halfDoor, step, TATRA_DOOR_TOP, DOOR_INTERIOR, -1);
    parts.box(0.77, 0.045, TATRA_DOOR_WIDTH, -0.85, step - 0.02, z, METAL);
    if (i !== 1) parts.box(0.34, 0.045, TATRA_DOOR_WIDTH - 0.09, -1.06, step - 0.16, z, METAL);
    for (const side of [-1, 1]) parts.box(0.77, TATRA_DOOR_TOP - step, 0.035, -0.85,
      (TATRA_DOOR_TOP + step) / 2, z + side * halfDoor, DARK);
    parts.box(0.039, 1.45, 0.039, -0.85, step + 0.75, z + halfDoor - 0.13, YELLOW);
  }
  parts.box(2.04, 0.17, 2 * end, 0, 0.46, 0, DARK);
  parts.box(TATRA_WIDTH, 0.20, 2 * end, 0, 2.89, 0, YELLOW, 0.94);
  parts.box(TATRA_WIDTH * 0.94, 0.195, 2 * end, 0, 3.0875, 0, TATRA_ROOF, 0.76);
}

function tatraEnd(parts, lamps, seam, side) {
  const half = TATRA_LENGTH / 2;
  const width = TATRA_WIDTH / 2;
  const front = side > 0;
  // Řezy charakteristickým vyklenutým čelem T3 od spodku k horní hraně střechy.
  const rows = [[0.50, 0.86, 0.20], [0.99, 1, 0.02], [1.095, 1, 0], [1.62, 1, 0],
    [1.81, 1, 0.03], [2.62, 1, front ? 0.28 : 0.18], [2.79, 1, 0.30],
    [2.99, 0.94, 0.34], [3.185, 0.94 * 0.76, 0.49]];
  const facets = [];
  const point = ([y, w, inset], t) => {
    const curve = Math.min(0.59, half - inset - seam - 0.025);
    return [width * t * w, y, side * (half - inset - curve * t ** 4)];
  };
  const profile = [-1, -0.91, -0.75, -0.51, 0.51, 0.75, 0.91, 1];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    const paint = i === 2 ? WHITE : i === 8 ? TATRA_ROOF : i >= 4 && i <= 6 ? TATRA_GREY : YELLOW;
    for (let j = 1; j < profile.length; j++) {
      const lo = profile[j - 1], hi = profile[j];
      const p = point(a, lo), q = point(a, hi), r = point(b, hi), s = point(b, lo);
      facets.push([p, q, r], [p, r, s]);
      face(parts, [p, q, r, s], paint, [0, 0, side]);
    }
    for (const x of [-1, 1]) {
      const edge = ([y, w]) => [x * width * (y === 0.50 ? 1 : w), y, side * seam];
      face(parts, [edge(a), point(a, x), point(b, x), edge(b)], paint, [x, 0, 0]);
    }
  }
  const top = rows.at(-1);
  for (let j = 1; j < profile.length; j++) {
    const a = point(top, profile[j - 1]), b = point(top, profile[j]);
    face(parts, [a, b, [b[0], b[1], side * seam], [a[0], a[1], side * seam]], TATRA_ROOF, [0, 1, 0]);
  }
  const detail = (outline, paint, inset = 0.013, target = parts) => onCab(target, facets, outline, paint, side, inset);
  detail([[-1.09, 1.83], [1.09, 1.83], [1.02, 2.56], [0.91, 2.65],
    [-0.91, 2.65], [-1.02, 2.56]], DARK);
  detail([[-1.04, 1.88], [1.04, 1.88], [0.97, 2.53], [0.88, 2.61],
    [-0.88, 2.61], [-0.97, 2.53]], TRAM_GLASS, 0.019);
  detail([[-0.89, 2.54], [0.89, 2.54], [0.91, 2.57], [-0.91, 2.57]], REFLECTION, 0.023);
  for (const x of [-1, 1]) {
    const circle = (cx, y, radius, paint, offset, target) => detail(Array.from({ length: 16 }, (_, i) => {
      const angle = i * Math.PI / 8;
      return [cx + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
    }), paint, offset, target);
    circle(x * 0.69, 1.31, 0.143, DARK, 0.021, parts);
    circle(x * 0.69, 1.31, front ? 0.106 : 0.071, front ? HEAD : TAIL, 0.033, lamps);
    if (front) {
      detail([[x * 0.36, 1.87], [x * 0.39, 1.87], [x * 0.75, 2.23], [x * 0.72, 2.23]], DARK, 0.027);
      parts.box(0.22, 0.045, 0.09, x * 1.29, 2.36, 6.82, DARK);
      parts.box(0.11, 0.26, 0.10, x * 1.39, 2.28, 6.83, DARK);
    }
  }
  parts.box(0.25, 0.14, 0.76, 0, 0.62, side * (half + 0.08), METAL);
  parts.box(0.31, 0.17, 0.17, 0, 0.62, side * (half + 0.48), DARK);
}

let tatraShell, tatraLamps, tatraLeaves;
export function makeTatraCar() {
  if (!tatraShell) {
    const body = new Parts(SURFACE.transitPaint, transitSurfaces), lights = new Parts();
    const leaf = new Parts(SURFACE.transitPaint, transitSurfaces);
    tatraSide(body, 6.82);
    tatraEnd(body, lights, 6.82, 1);
    tatraEnd(body, lights, 6.82, -1);
    for (const z of [-TATRA_CAR.axle, TATRA_CAR.axle]) {
      body.box(1.77, 0.28, 1.98, 0, 0.39, z, DARK);
      for (const x of [-0.75, 0.75]) {
        for (const axle of [-0.95, 0.95]) body.wheel(0.345, 0.14, x, 0.345, z + axle, RUBBER, 12);
      }
    }
    pantograph(body, 3.185, 3.21, YELLOW);
    body.box(0.93, 0.14, 0.87, 0, 3.24, 5.55, TATRA_ROOF, 0.88, 0.86);
    body.box(1.04, 0.17, 2.24, 0, 3.245, -2.57, TATRA_ROOF, 0.90, 0.90);
    const leafWidth = TATRA_DOOR_WIDTH / 4;
    leaf.box(0.037, 1, leafWidth - 0.009, 0, 0.5, 0, RUBBER);
    leaf.box(0.045, 0.965, leafWidth - 0.032, 0, 0.5, 0, YELLOW);
    for (const side of [-1, 1]) {
      panel(leaf, side * 0.024, -0.073, 0.073, 0.54, 0.91, TRAM_GLASS, side);
      panel(leaf, side * 0.024, -0.073, 0.073, 0.14, 0.49, TRAM_GLASS, side);
    }
    tatraShell = shade(body.geometry());
    tatraLamps = lights.geometry();
    tatraLeaves = leaf.geometry();
  }
  const group = new THREE.Group();
  const shell = new THREE.Mesh(tatraShell, shellMat);
  shell.castShadow = true;
  group.add(shell, new THREE.Mesh(tatraLamps, lampMat));
  group.userData.sign = { y: 2.91, z: 7.25, tilt: -0.20, width: 1.17, color: '#c9db6a' };
  mountDoors(group, tatraLeaves, TATRA_DOORS, TATRA_DOOR_WIDTH, 4);
  return group;
}

const couplerGeometry = new THREE.BoxGeometry(0.22, 0.13, 1);
const couplerMaterial = makeSurfaceMaterial(SURFACE.transitMetal, { color: 0x383b3a });
export function makeTatraCoupler() {
  return new THREE.Mesh(couplerGeometry, couplerMaterial);
}

let bellows;
export function makeTramJoint() {
  if (!bellows) {
    const p = new Parts(SURFACE.rubber);
    p.box(2.19, 2.71, 1, 0, 0, 0, RUBBER, 0.94);
    for (let i = -3; i <= 3; i++) p.box(2.23, 2.75, 0.044, 0, 0, i * 0.132, DARK, 0.94);
    bellows = p.geometry();
  }
  return new THREE.Mesh(bellows, shellMat);
}
