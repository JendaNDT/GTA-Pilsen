// Procedurální nízkopolygonové modely aut, MHD, postav a vrtulníku.
import * as THREE from 'three/webgpu';
import { step, vertexColor } from 'three/tsl';
import { env, getPoolMaterial, makeBatchedSurfaceMaterial, makeSurfaceMaterial } from '../world/materials.js';
import { SURFACE } from '../world/material-table.js';
import { QUALITY } from '../config.js';

const _c = new THREE.Color();
const lin = (hex) => { _c.setHex(hex); return [_c.r, _c.g, _c.b]; };

const RIM = [0.42, 0.44, 0.47];

export class Parts {
  constructor(surface = null, surfaces = null) {
    this.p = []; this.n = []; this.c = [];
    this.surface = surface;
    this.surfaces = surfaces;
    this.s = surface ? [] : null;
  }
  vertex(x, y, z, nx, ny, nz, color, surface = this.surfaces?.get(color) ?? this.surface) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    this.c.push(...color);
    if (this.s) this.s.push(Math.round(surface.roughness * 255), Math.round(surface.metalness * 255));
  }
  /** Kvádr se středem (x, y, z); volitelně zúžený nahoře (tx, tz = poměr horní podstavy). */
  box(w, h, l, x, y, z, col, tx = 1, tz = 1, zShiftTop = 0) {
    const hw = w / 2, hh = h / 2, hl = l / 2;
    const v = [
      [-hw, -hh, -hl], [hw, -hh, -hl], [hw, -hh, hl], [-hw, -hh, hl],
      [-hw * tx, hh, -hl * tz + zShiftTop], [hw * tx, hh, -hl * tz + zShiftTop], [hw * tx, hh, hl * tz + zShiftTop], [-hw * tx, hh, hl * tz + zShiftTop],
    ];
    const faces = [[0, 1, 2, 3], [7, 6, 5, 4], [3, 2, 6, 7], [1, 0, 4, 5], [2, 1, 5, 6], [0, 3, 7, 4]];
    for (const f of faces) {
      const a = v[f[0]], b = v[f[1]], c = v[f[2]], d = v[f[3]];
      let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
      let ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      let nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      // orientace ven od středu kvádru
      const mx = (a[0] + c[0]) / 2, my = (a[1] + c[1]) / 2, mz = (a[2] + c[2]) / 2;
      const out = nx * mx + ny * my + nz * mz >= 0;
      const order = out ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
      if (!out) { nx = -nx; ny = -ny; nz = -nz; }
      for (const q of order) {
        this.vertex(q[0] + x, q[1] + y, q[2] + z, nx, ny, nz, col);
      }
    }
    return this;
  }
  /** Válec s osou podél x (kolo). */
  wheel(r, w, x, y, z, col, seg = 10) {
    const sideColor = col.map((shade) => shade * 1.6 + 0.02);
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      const y0 = Math.cos(a0) * r, z0 = Math.sin(a0) * r, y1 = Math.cos(a1) * r, z1 = Math.sin(a1) * r;
      const quad = [[-w / 2, y0, z0], [w / 2, y0, z0], [w / 2, y1, z1], [-w / 2, y0, z0], [w / 2, y1, z1], [-w / 2, y1, z1]];
      const ny = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2);
      for (const q of quad) this.vertex(q[0] + x, q[1] + y, q[2] + z, 0, ny, nz, col, SURFACE.rubber);
      for (const side of [-1, 1]) {
        const tri = side < 0 ? [[0, 0, 0], [0, y1, z1], [0, y0, z0]] : [[0, 0, 0], [0, y0, z0], [0, y1, z1]];
        for (const q of tri) {
          this.vertex(q[0] + x + side * w / 2, q[1] + y, q[2] + z, side, 0, 0, sideColor, SURFACE.rubber);
        }
        // disk kola (světlejší střed)
        for (const q of tri) {
          this.vertex(q[0] + x + side * (w / 2 + 0.012), q[1] * 0.62 + y, q[2] * 0.62 + z, side, 0, 0, RIM, SURFACE.metal);
        }
      }
    }
    return this;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    if (this.s) g.setAttribute('aSurface', new THREE.BufferAttribute(new Uint8Array(this.s), 2, true));
    g.computeBoundingSphere();
    return g;
  }
}

const GLASS = lin(0x2a3947), TIRE = lin(0x17181a), HEAD = [1.0, 0.93, 0.72], TAIL = [0.95, 0.06, 0.05];
const DARK = lin(0x24272b), CHROME = lin(0x8d949b), WHITE = [1, 1, 1], PLATE = lin(0xd8d8d0);
const carSurfaces = new Map([[GLASS, SURFACE.glass], [CHROME, SURFACE.metal], [HEAD, SURFACE.lamp], [TAIL, SURFACE.lamp]]);

// materiál detailů: světla (jasné barvy) v noci svítí
let detailMat = null;
export function getDetailMaterial() {
  if (detailMat) return detailMat;
  const color = vertexColor().rgb;
  const brightness = step(0.9, color.r).mul(env.night.mul(0.9).add(0.35));
  detailMat = makeBatchedSurfaceMaterial({ emissiveNode: color.mul(brightness) });
  return detailMat;
}

const bodyMats = new Map();
export function getBodyMaterial(hex) {
  let m = bodyMats.get(hex);
  if (!m) { m = makeSurfaceMaterial(SURFACE.carPaint, { color: hex, vertexColors: true }); bodyMats.set(hex, m); }
  return m;
}

/** Parametry typů aut. Rozměry v metrech, rychlost v m/s. */
export const CAR_TYPES = {
  hatch: { name: 'Malé auto', len: 3.9, wid: 1.7, h: 1.45, hood: 0.9, trunk: 0.25, maxSpeed: 40, accel: 6.2, grip: 8.5, mass: 1.0 },
  sedan: { name: 'Sedan', len: 4.6, wid: 1.8, h: 1.42, hood: 1.15, trunk: 0.95, maxSpeed: 46, accel: 6.8, grip: 8.5, mass: 1.2 },
  kombi: { name: 'Kombi', len: 4.7, wid: 1.8, h: 1.48, hood: 1.15, trunk: 0.2, maxSpeed: 44, accel: 6.4, grip: 8.5, mass: 1.25 },
  suv: { name: 'SUV', len: 4.6, wid: 1.92, h: 1.72, hood: 1.1, trunk: 0.25, maxSpeed: 44, accel: 6.2, grip: 8.0, mass: 1.6, ride: 0.12 },
  van: { name: 'Dodávka', len: 5.3, wid: 2.0, h: 2.25, hood: 0.7, trunk: 0.05, maxSpeed: 36, accel: 4.6, grip: 7.0, mass: 2.0, ride: 0.08 },
  sport: { name: 'Sporťák', len: 4.35, wid: 1.86, h: 1.22, hood: 1.3, trunk: 0.7, maxSpeed: 68, accel: 10.5, grip: 10.5, mass: 1.1, ride: -0.05 },
  pickup: { name: 'Pick-up', len: 5.2, wid: 1.95, h: 1.75, hood: 1.2, trunk: 1.7, maxSpeed: 42, accel: 5.8, grip: 7.6, mass: 1.8, ride: 0.14, bed: true },
  taxi: { name: 'Taxi', base: 'sedan', sign: true },
  police: { name: 'Policejní vůz', base: 'kombi', police: true, maxSpeed: 58, accel: 9.5, grip: 10 },
};
for (const [k, t] of Object.entries(CAR_TYPES)) {
  if (t.base) CAR_TYPES[k] = { ...CAR_TYPES[t.base], ...t };
  CAR_TYPES[k].id = k;
}

export const CAR_COLORS = [0xd9dadb, 0x9da3a8, 0x2b2e33, 0x1f3a5f, 0x8f1d1d, 0xb8b0a0, 0x3d6b4f, 0x5b7fa6, 0xc8922e, 0x6b4a2f, 0xf2f2ef, 0x4a4d52];

const carGeo = new Map();
function carGeometry(type) {
  let g = carGeo.get(type.id);
  if (g) return g;
  const { len, wid, h, hood, trunk } = type;
  const ride = 0.3 + (type.ride || 0);
  const bodyH = Math.min(0.62, h * 0.42);
  const body = new Parts(), det = new Parts(SURFACE.rubber, carSurfaces);
  const wheelR = type.id === 'van' || type.ride > 0.1 ? 0.37 : 0.32;
  // karoserie
  body.box(wid, bodyH, len, 0, ride + bodyH / 2, 0, WHITE, 0.96, 0.985);
  const cabL = len - hood - trunk - 0.25;
  const cabZ = (trunk - hood) / 2 * -1 + 0;      // posun kabiny: kapota vpředu (+z)
  const cabY = ride + bodyH;
  const cabH = h - cabY;
  const zc = -(hood - trunk) / 2;
  det.box(wid * 0.9, cabH - 0.06, cabL, 0, cabY + (cabH - 0.06) / 2, zc, GLASS, 0.82, 0.74, -0.08);
  body.box(wid * 0.9 * 0.84, 0.07, cabL * 0.76, 0, cabY + cabH - 0.035, zc - 0.08, WHITE);
  // střední sloupky, prahy, kliky a značky
  body.box(wid * 0.905, cabH - 0.1, 0.1, 0, cabY + (cabH - 0.1) / 2, zc - 0.04, WHITE, 0.83, 1);
  det.box(wid * 1.005, 0.1, len * 0.9, 0, ride + 0.05, 0, DARK);
  det.box(0.52, 0.12, 0.03, 0, ride + bodyH * 0.34, len / 2 * 0.995, PLATE);
  det.box(0.52, 0.12, 0.03, 0, ride + bodyH * 0.40, -len / 2 * 0.995, PLATE);
  for (const sx of [-1, 1]) {
    det.box(0.05, 0.11, 0.2, sx * (wid / 2 + 0.06), cabY + 0.1, zc + cabL * 0.3, DARK);       // zrcátka
    det.box(0.02, 0.04, 0.16, sx * wid * 0.482, ride + bodyH * 0.78, zc - 0.25, CHROME);       // klika
  }
  if (type.bed) {
    // korba pick-upu
    body.box(wid * 0.96, 0.32, trunk - 0.1, 0, cabY + 0.16, -len / 2 + trunk / 2 + 0.05, WHITE);
    det.box(wid * 0.8, 0.02, trunk - 0.3, 0, cabY + 0.33, -len / 2 + trunk / 2 + 0.05, DARK);
  }
  // světla, nárazníky, kola
  const fz = len / 2, lz = -len / 2;
  det.box(0.34, 0.14, 0.06, wid * 0.33, ride + bodyH * 0.72, fz * 0.985, HEAD);
  det.box(0.34, 0.14, 0.06, -wid * 0.33, ride + bodyH * 0.72, fz * 0.985, HEAD);
  det.box(0.32, 0.13, 0.06, wid * 0.34, ride + bodyH * 0.74, lz * 0.985, TAIL);
  det.box(0.32, 0.13, 0.06, -wid * 0.34, ride + bodyH * 0.74, lz * 0.985, TAIL);
  det.box(wid * 0.98, 0.14, 0.1, 0, ride + 0.09, fz * 0.99, DARK);
  det.box(wid * 0.98, 0.14, 0.1, 0, ride + 0.09, lz * 0.99, DARK);
  det.box(wid * 0.5, 0.12, 0.05, 0, ride + bodyH * 0.45, fz * 0.99, DARK);
  const wx = wid / 2 - 0.12, wz = len / 2 - 0.82;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) det.wheel(wheelR, 0.24, sx * wx, wheelR, sz * wz, TIRE);
  if (type.sign) det.box(0.5, 0.16, 0.22, 0, h + 0.06, zc, lin(0xf2c230));
  if (type.police) {
    det.box(wid * 0.55, 0.1, 0.26, 0, h + 0.04, zc, DARK);
    det.box(wid * 1.005, 0.16, len * 0.62, 0, ride + bodyH * 0.55, 0, lin(0x1e56b3));
    det.box(wid * 1.01, 0.05, len * 0.62, 0, ride + bodyH * 0.55, 0, lin(0xd8d820));
  }
  g = { body: body.geometry(), detail: det.geometry(), wheelR };
  carGeo.set(type.id, g);
  return g;
}

let beaconGeo = null, lightGeo = null;
export function addCarLight(group, type) {
  if (group.userData.light) return;
  if (!lightGeo) { lightGeo = new THREE.PlaneGeometry(1, 1); lightGeo.rotateX(-Math.PI / 2); }
  const light = new THREE.Mesh(lightGeo, getPoolMaterial());
  light.position.set(0, 0.04, type.len / 2 + 5.5);
  light.scale.set(7, 1, 13);
  light.renderOrder = 19;
  light.visible = false;
  group.add(light);
  group.userData.light = light;
}

/** Vytvoří 3D objekt auta. */
export function makeCarMesh(typeId, colorHex) {
  const type = CAR_TYPES[typeId];
  const g = carGeometry(type);
  const group = new THREE.Group();
  const body = new THREE.Mesh(g.body, getBodyMaterial(type.police ? 0xdfe3e6 : type.sign ? 0xe0b020 : colorHex));
  const detail = new THREE.Mesh(g.detail, getDetailMaterial());
  body.castShadow = true; detail.castShadow = true;
  group.add(body, detail);
  if (QUALITY.carLights) addCarLight(group, type);
  if (type.police) {
    if (!beaconGeo) beaconGeo = new THREE.BoxGeometry(0.34, 0.12, 0.24);
    const zc = -(type.hood - type.trunk) / 2;
    const l = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0x1144ff }));
    const r = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color: 0xff2211 }));
    l.position.set(0.3, type.h + 0.14, zc); r.position.set(-0.3, type.h + 0.14, zc);
    group.add(l, r);
    group.userData.beacons = [l, r];
  }
  return group;
}

// ------------------------------------------------------------ trolejbus ----
const TRANSIT_GLASS = lin(0x3b4d5f), TROLLEY_GREEN = lin(0x2f9a57), TROLLEY_GREY = lin(0xdedfdc);
const trolleySurfaces = new Map([[TRANSIT_GLASS, SURFACE.glass], [DARK, SURFACE.transitMetal], [HEAD, SURFACE.lamp], [TAIL, SURFACE.lamp]]);
let trolleyGeo;
export const TROLLEY_LEN = 11.8;
export function makeTrolleybus() {
  if (!trolleyGeo) {
    const p = new Parts(SURFACE.transitPaint, trolleySurfaces);
    const L = TROLLEY_LEN, W = 2.5;
    p.box(W, 1.0, L, 0, 0.85, 0, TROLLEY_GREEN, 1, 0.995);
    p.box(W * 0.985, 1.2, L * 0.985, 0, 1.95, 0, TRANSIT_GLASS, 0.95, 0.99);
    p.box(W * 0.94, 0.42, L * 0.99, 0, 2.76, 0, TROLLEY_GREY, 0.92, 0.98);
    for (const sx of [-1, 1]) {
      p.box(0.3, 0.14, 0.06, sx * 0.8, 0.95, L / 2, HEAD);
      p.box(0.3, 0.14, 0.06, sx * 0.8, 0.95, -L / 2, TAIL);
      for (const z of [L / 2 - 2.4, -L / 2 + 3]) p.wheel(0.48, 0.3, sx * 1.1, 0.48, z, TIRE);
      p.box(0.06, 0.06, 6.2, sx * 0.35, 3.75, -L / 2 + 2.2, DARK);
    }
    p.box(0.9, 0.5, 0.5, 0, 3.2, 1.2, DARK);
    trolleyGeo = p.geometry();
  }
  const mesh = new THREE.Mesh(trolleyGeo, getDetailMaterial());
  mesh.castShadow = true;
  return mesh;
}

// -------------------------------------------------------------- postavy ----
const SKIN = [lin(0xe8b98f), lin(0xd9a577), lin(0xc68a5c), lin(0xf0c9a5)];
const SHIRTS = [0x3d6fb0, 0xb23a2e, 0x4f8a4b, 0xe6c84a, 0x8c8c8c, 0xf2f2f2, 0x7a5234, 0x6b3fa0, 0x222a33, 0xd9822b].map(lin);
const PANTS = [0x2b3a55, 0x3a3a3a, 0x5a4a3a, 0x1f2933, 0x6a6f75].map(lin);
let pedMat = null;
const pedGeoCache = new Map();

/** Postava ze čtyř dílů (tělo s hlavou a rukama, dvě nohy) – nohy se při chůzi kývou. */
export function makePedMesh(variant, hero = false) {
  pedMat = pedMat || new THREE.MeshLambertMaterial({ vertexColors: true });
  const key = hero ? 'hero' : variant % 40;
  let geo = pedGeoCache.get(key);
  if (!geo) {
    const shirt = hero ? lin(0xf2b632) : SHIRTS[variant % SHIRTS.length];
    const pants = hero ? lin(0x26323c) : PANTS[(variant >> 2) % PANTS.length];
    const skin = SKIN[variant % SKIN.length];
    const hair = hero ? lin(0x3a2a1e) : [lin(0x2a2018), lin(0x6b4a2f), lin(0xb8a070), lin(0x8a8a8a)][(variant >> 1) % 4];
    const body = new Parts();
    body.box(0.46, 0.62, 0.26, 0, 1.14, 0, shirt, 0.95, 1);
    body.box(0.24, 0.26, 0.24, 0, 1.6, 0, skin);
    body.box(0.26, 0.09, 0.26, 0, 1.76, -0.01, hair);
    const arm = new Parts();
    arm.box(0.12, 0.56, 0.14, 0, -0.26, 0, shirt);
    arm.box(0.1, 0.1, 0.12, 0, -0.58, 0, skin);
    const leg = new Parts();
    leg.box(0.17, 0.78, 0.19, 0, -0.39, 0, pants);
    leg.box(0.17, 0.08, 0.26, 0, -0.8, 0.04, lin(0x1a1a1a));
    geo = { body: body.geometry(), arm: arm.geometry(), leg: leg.geometry() };
    pedGeoCache.set(key, geo);
  }
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo.body, pedMat);
  const legL = new THREE.Mesh(geo.leg, pedMat), legR = new THREE.Mesh(geo.leg, pedMat);
  legL.position.set(0.12, 0.84, 0); legR.position.set(-0.12, 0.84, 0);
  const armL = new THREE.Mesh(geo.arm, pedMat), armR = new THREE.Mesh(geo.arm, pedMat);
  armL.position.set(0.3, 1.42, 0); armR.position.set(-0.3, 1.42, 0);
  g.add(body, legL, legR, armL, armR);
  for (const m of g.children) m.castShadow = true;
  g.userData = { legL, legR, armL, armR, body };
  return g;
}

export function animatePed(mesh, phase, amount) {
  const u = mesh.userData;
  const s = Math.sin(phase) * amount;
  u.legL.rotation.x = s * 0.75; u.legR.rotation.x = -s * 0.75;
  u.armL.rotation.x = -s * 0.6; u.armR.rotation.x = s * 0.6;
}

// ------------------------------------------------------------- vrtulník ----
export function makeHeliMesh() {
  const p = new Parts(SURFACE.carPaint, carSurfaces);
  const white = lin(0xf1f1ee), amber = lin(0xf2b632), dark = lin(0x22262b);
  p.box(1.7, 1.5, 3.6, 0, 1.45, 0.3, white, 0.8, 0.8);
  p.box(1.5, 0.9, 1.5, 0, 1.55, 1.75, GLASS, 0.7, 0.5, -0.3);
  p.box(1.72, 0.3, 3.0, 0, 1.0, 0.2, amber);
  p.box(0.3, 0.34, 4.2, 0, 1.9, -3.4, white, 0.7, 1);
  p.box(0.1, 1.2, 0.7, 0, 2.5, -5.3, amber, 1, 0.6);
  p.box(0.5, 0.35, 0.9, 0, 2.35, 0.1, dark);
  for (const sx of [-1, 1]) {
    p.box(0.1, 0.1, 3.4, sx * 0.95, 0.12, 0.3, dark);
    p.box(0.07, 0.7, 0.07, sx * 0.9, 0.5, 1.2, dark);
    p.box(0.07, 0.7, 0.07, sx * 0.9, 0.5, -0.6, dark);
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(p.geometry(), getDetailMaterial()));
  const rp = new Parts(SURFACE.metal);
  rp.box(0.24, 0.05, 10.4, 0, 0, 0, dark);
  rp.box(10.4, 0.05, 0.24, 0, 0, 0, dark);
  const rotor = new THREE.Mesh(rp.geometry(), getDetailMaterial());
  rotor.position.set(0, 2.62, 0.1);
  const tp = new Parts(SURFACE.metal);
  tp.box(0.04, 1.7, 0.14, 0, 0, 0, dark);
  const tail = new THREE.Mesh(tp.geometry(), getDetailMaterial());
  tail.position.set(0.16, 2.5, -5.3);
  g.add(rotor, tail);
  g.children[0].castShadow = true;
  g.userData = { rotor, tail };
  return g;
}

// --------------------------------------------------------------- značky ----
/** Světelný sloup označující cíl. */
export function makeBeacon(colorHex) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide, fog: false }),
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.2, 28),
    new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.renderOrder = 20;
  g.add(beam, ring);
  g.userData = { beam, ring };
  return g;
}
