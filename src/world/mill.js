// Hořejší lub. Lokální x míří k náhonu, z k hlavnímu vstupu.
import * as THREE from 'three';
import { Parts } from '../entities/models.js';
import { HeritageMesh } from './heritage-geometry.js';

export const FORGE = { x: 22660.55, z: 3099.7, yaw: -Math.atan2(0.432, 0.902) };
export function forgeXZ(x, z) {
  const cs = Math.cos(FORGE.yaw), sn = Math.sin(FORGE.yaw);
  return [FORGE.x + cs * x + sn * z, FORGE.z - sn * x + cs * z];
}

const C = Math.cos(FORGE.yaw), S = Math.sin(FORGE.yaw);
const HALF_WIDTH = 5.06, SOUTH = 16.5, NORTH = -16.25, EAVE = 4.55, RIDGE = 9.05;
const LOFT_LENGTH = 25.6, LOFT_WIDTH = 1.9, LOFT_EAVE = 9.03, LOFT_RIDGE = 10.92;

export function forgeRoofHeight(world, index, x, z) {
  if (index < 0) return -Infinity;
  const dx = x - FORGE.x, dz = z - FORGE.z;
  const along = S * dx + C * dz, across = Math.abs(C * dx - S * dz);
  const base = world.bGround[index] - 1.25;
  if (across <= LOFT_WIDTH * 1.12 && Math.abs(along) <= LOFT_LENGTH / 2 + 0.26) {
    return base + THREE.MathUtils.lerp(LOFT_RIDGE, LOFT_EAVE, across / (LOFT_WIDTH * 1.12));
  }
  if (across <= HALF_WIDTH * 1.055 && along >= NORTH - 0.42 && along <= SOUTH + 0.42) {
    return base + THREE.MathUtils.lerp(RIDGE, EAVE - 0.26, across / (HALF_WIDTH * 1.055));
  }
  return -Infinity;
}

const WHITE = new THREE.Color(0xe1dacc), TIMBER = new THREE.Color(0x4f3d30);
const SHINGLE = new THREE.Color(0x553f39), STONE = new THREE.Color(0x9b8970);
const BLACK = new THREE.Color(0x292e2d), FRAME = new THREE.Color(0x79604b);
const WATER = new THREE.Color(0x476067);
const FRONT = new THREE.Vector3(0, 0, 1), SIDE = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0), BACK = new THREE.Vector3(0, 0, -1);
const LEFT = new THREE.Vector3(-1, 0, 0);
const PANEL = new THREE.Color(0x6a5845);
const GLOW = new THREE.Color(0xe5b46c);
const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const pane = (x, y, z) => [x, y, -5];
const wood = (x, y, z) => [x + z, y, -4];
const roof = (x, y, z) => [z, y, -1];
const stone = (x, y, z) => [x + z, y, -2];

export function buildForge(world, index, close, far, water, add, { base, detail, wheels, night, group, disposables }) {
  if (index < 0) return;
  const shell = new HeritageMesh();
  const structures = new Parts(), fittings = new Parts();
  const halfWidth = HALF_WIDTH, south = SOUTH, north = NORTH, eave = EAVE, ridge = RIDGE;
  const baseY = world.bGround[index] - 1.25;
  const terrain = (x, z) => world.heightAt(...forgeXZ(x, z)) - baseY;
  const position = (m) => {
    if (m) { m.position.set(FORGE.x, baseY, FORGE.z); m.rotation.y = FORGE.yaw; }
    return m;
  };
  const shape = (mesh, pts, col, tex, normal) => mesh.polygon([pts.flat()], col, tex, normal);
  for (const [side, normal] of [[-1, LEFT], [1, SIDE]]) {
    const x = side * halfWidth;
    shape(shell, [[x, -1, north], [x, -1, south], [x, eave, south], [x, eave, north]], WHITE, undefined, normal);
    shape(shell, [[x * 1.055, eave - 0.26, north - 0.42], [x * 1.055, eave - 0.26, south + 0.42], [0, ridge, south + 0.42], [0, ridge, north - 0.42]],
      SHINGLE, roof, UP);
    structures.box(0.20, 0.18, south - north + 0.7, x, eave - 0.015, 0, TIMBER.toArray());
  }
  for (const [z, normal] of [[south, FRONT], [north, BACK]]) {
    shape(shell, [[-halfWidth, -1, z], [halfWidth, -1, z], [halfWidth, eave, z],
      [0, ridge, z], [-halfWidth, eave, z]], WHITE, undefined, normal);
    structures.box(10.18, 0.14, 0.20, 0, eave - 0.17, z, STONE.toArray());
  }
  // Podélná dřevěná nástavba se samostatnou šindelovou střechou.
  const length = LOFT_LENGTH, top = LOFT_RIDGE, w = LOFT_WIDTH;
  for (const [x, normal] of [[w, SIDE], [-w, LEFT]]) {
    const a = -length / 2, b = length / 2;
    shape(shell, [[x, 7.05, a], [x, 7.05, b], [x, LOFT_EAVE + 0.22, b], [x, LOFT_EAVE + 0.22, a]], TIMBER, wood, normal);
    shape(shell, [[x * 1.12, LOFT_EAVE, a - 0.26], [x * 1.12, LOFT_EAVE, b + 0.26],
      [0, top, b + 0.26], [0, top, a - 0.26]], SHINGLE, roof, UP);
  }
  for (const [z, normal] of [[length / 2, FRONT], [-length / 2, BACK]]) {
    shape(shell, [[-w, 7.05, z], [w, 7.05, z], [w, LOFT_EAVE + 0.22, z], [0, top, z], [-w, LOFT_EAVE + 0.22, z]], TIMBER, wood, normal);
  }
  // Vikýře na straně náhonu.
  for (const z of [-8.9, -3.1, 3.4]) {
    const a = z - 0.79, b = z + 0.79, y = 6.55, x = 3.8;
    shape(shell, [[x, y - 1.1, a], [x, y - 1.1, b], [x, y + 0.14, b], [x, y + 0.82, z], [x, y + 0.14, a]],
      TIMBER, wood, SIDE);
    for (const [end, norm] of [[a, BACK], [b, FRONT]]) {
      shape(shell, [[x, y - 1.1, end], [2.0, y + 0.14, end], [x, y + 0.14, end]], TIMBER, wood, norm);
      shape(shell, [[x + 0.18, y + 0.12, end], [2.0, y + 0.82, end], [2.0, y + 1.42, z],
        [x + 0.18, y + 0.82, z]], SHINGLE, roof, UP);
    }
    fittings.box(0.06, 1.06, 0.86, x + 0.02, y - 0.48, z, FRAME.toArray());
    fittings.box(0.07, 0.91, 0.72, x + 0.06, y - 0.48, z, BLACK.toArray());
    fittings.box(0.08, 0.035, 0.72, x + 0.075, y - 0.48, z, PANEL.toArray());
    fittings.box(0.08, 0.91, 0.035, x + 0.075, y - 0.48, z, PANEL.toArray());
  }
  structures.box(0.73, 1.0, 0.65, 3.2, 7.1, -6.0, WHITE.toArray());
  structures.box(0.18, 2.7, 0.18, 3.2, 8.95, -6.0, BLACK.toArray());
  structures.box(0.30, 0.07, 0.30, 3.2, 10.34, -6.0, BLACK.toArray());
  for (let n = 0; n < 7; n++) {
    // Okenice nástavby a nestejně široká okna nad náhonem.
    const z = -11.25 + n * 3.65;
    fittings.box(0.06, 1.0, 0.80, w + 0.025, 8.46, z, BLACK.toArray());
    fittings.box(0.08, 0.65, 0.77, halfWidth + 0.015, 3.55, z + 0.35, FRAME.toArray());
    fittings.box(0.10, 0.51, 0.61, halfWidth + 0.04, 3.55, z + 0.35, BLACK.toArray());
  }

  // Jižní štít, kamenný portál a dělené okno.
  const entry = terrain(0, south + 0.15) - 0.05;
  const arch = (mesh, width, height, z, color) => {
    const pts = [[-width, entry, z], [width, entry, z]];
    for (let i = 0; i <= 10; i++) {
      const a = i * Math.PI / 10;
      pts.push([Math.cos(a) * width, entry + height - 0.72 + Math.sin(a) * 0.72, z]);
    }
    shape(mesh, pts, color, stone, FRONT);
  };
  arch(shell, 1.18, 2.62, south + 0.032, STONE);
  arch(shell, 0.9, 2.36, south + 0.041, BLACK);
  structures.box(1.65, 1.27, 0.15, 0, 6.07, south + 0.045, FRAME.toArray());
  shape(shell, [[-0.73, 5.53, south + 0.126], [0.73, 5.53, south + 0.126], [0.73, 6.61, south + 0.126],
    [-0.73, 6.61, south + 0.126]], BLACK, pane, FRONT);
  for (const x of [-0.37, 0, 0.37]) fittings.box(0.03, 1.09, 0.17, x, 6.07, south + 0.061, FRAME.toArray());
  for (const y of [5.8, 6.07, 6.35]) fittings.box(1.49, 0.028, 0.17, 0, y, south + 0.061, FRAME.toArray());
  fittings.box(0.26, 0.38, 0.095, 1.9, entry + 2.2, south + 0.035, PANEL.toArray());

  // Zídka pod svahem přiléhá k portálu, takže vstup ze stezky zůstává volný.
  for (let z = 15.7; z < 22.6; z += 1.4) {
    const x = -5.15, h = terrain(x, z), h2 = terrain(x, z + 1.4);
    const t = Math.max(h, h2) + 1.06 - (z - 15.7) * 0.075;
    shape(shell, [[x, h - 0.45, z], [x, h2 - 0.45, z + 1.4], [x, t, z + 1.4], [x, t, z]], STONE, stone, SIDE);
    shape(shell, [[x, t, z], [x, t, z + 1.4], [x - 0.35, t, z + 1.4], [x - 0.35, t, z]], STONE, stone, UP);
  }

  // Koryto sleduje terén. Nízké kamenné obruby a zvýšené vantroky vymezují břehy.
  const flow = new HeritageMesh();
  const us = [5.2, 8.95];
  const points = [];
  for (let z = -20; z <= 20; z += 2) {
    const xOff = z < -15 ? (-15 - z) * 0.30 : 0;
    const y = Math.max(terrain(us[0] + xOff, z), terrain(us[1] + xOff, z), terrain(7 + xOff, z)) + 0.10;
    points.push([z, y, xOff]);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const [z, y, dx] = points[i], [next, ny, ndx] = points[i + 1];
    const [a, b] = us;
    shape(flow, [[a + dx, y, z], [a + ndx, ny, next], [b + ndx, ny, next], [b + dx, y, z]], WATER, undefined, UP);
    for (const x of [a, b]) {
      const inner = x === a ? SIDE : LEFT, outer = x === a ? LEFT : SIDE;
      const inset = x === a ? -0.26 : 0.26;
      shape(shell, [[x + dx, y - 0.55, z], [x + ndx, ny - 0.55, next], [x + ndx, ny + 0.52, next],
        [x + dx, y + 0.52, z]], STONE, stone, inner);
      shape(shell, [[x + dx, y + 0.52, z], [x + ndx, ny + 0.52, next], [x + inset + ndx, ny + 0.55, next],
        [x + inset + dx, y + 0.55, z]], STONE, stone, UP);
      shape(shell, [[x + inset + dx, y + 0.55, z], [x + inset + ndx, ny + 0.55, next],
        [x + inset + ndx, ny - 0.55, next], [x + inset + dx, y - 0.55, z]], STONE, stone, outer);
    }
  }
  const trough = 3.1;
  structures.box(0.87, 0.13, 32, 6.04, trough, -1.3, TIMBER.toArray());
  for (const x of [5.65, 6.43]) structures.box(0.14, 0.39, 32, x, trough + 0.19, -1.3, PANEL.toArray());
  for (const z of [-14.4, -7.4, 0, 7.4, 13.9]) {
    const foot = terrain(6.55, z) - 0.24;
    structures.box(0.15, trough - foot, 0.19, 6.55, (trough + foot) / 2, z, TIMBER.toArray());
    structures.box(1.6, 0.13, 0.24, 5.46, trough - 0.04, z, TIMBER.toArray());
  }
  for (let z = -17; z <= 17; z += 3.3) {
    const h = terrain(9.53, z);
    fittings.box(0.055, 1.18, 0.06, 9.55, h + 0.59, z, BLACK.toArray());
    fittings.box(0.055, 0.045, 3.32, 9.55, h + 1.13, z + 1.65, BLACK.toArray());
  }
  for (const [x, z] of [[-2.6, south + 0.16], [9.55, 15.25]]) {
    const y = terrain(x, z) + 1.73;
    structures.box(0.13, 0.27, 0.17, x, y, z, BLACK.toArray());
    for (const [axis, normal] of [[x - 0.065, LEFT], [x + 0.065, SIDE]]) {
      shape(shell, [[axis, y - 0.065, z - 0.085], [axis, y - 0.065, z + 0.085], [axis, y + 0.047, z + 0.085],
        [axis, y + 0.047, z - 0.085]], GLOW, pane, normal);
    }
    const glow = new Parts();
    glow.box(0.10, 0.11, 0.18, x, y - 0.015, z + 0.075, GLOW.toArray());
    const mesh = position(add(glow.geometry(), lampMat, night));
    mesh.castShadow = false;
  }
  position(add(shell.geometry(), close, base));
  position(add(structures.geometry(), far, null));
  position(add(fittings.geometry(), far, detail));
  position(add(flow.geometry(), water, null));
  // Čtyři lopatková kola, s viditelnými paprsky. Každé sdílí jednu geometrii v rámci dlaždice.
  const r = 1.23, wheel = new Parts(), dark = TIMBER.toArray(), light = PANEL.toArray();
  wheel.wheel(0.17, 0.95, 0, 0, 0, dark, 8);
  const radial = new HeritageMesh();
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8, b = a + Math.PI / 8;
    const p = (x, radius, angle) => [x, Math.cos(angle) * radius, Math.sin(angle) * radius];
    for (const side of [-0.28, 0.28]) {
      shape(radial, [p(side, r, a), p(side, r, b), p(side, r - 0.12, b), p(side, r - 0.12, a)],
        PANEL, undefined, side > 0 ? SIDE : LEFT);
      if (i % 2 === 0) shape(radial, [p(side, 0.14, a - 0.25), p(side, r, a - 0.035),
        p(side, r, a + 0.035), p(side, 0.14, a + 0.25)], TIMBER, undefined, side > 0 ? SIDE : LEFT);
    }
    const pos = p(0, r - 0.08, a);
    wheel.box(0.54, 0.095, 0.13, ...pos, light);
  }
  const rim = radial.geometry(), paddles = wheel.geometry();
  disposables.push(rim, paddles);
  const rotorRoot = position(new THREE.Group());
  group.add(rotorRoot);
  for (const z of [-11.4, -4.1, 3.4, 10.8]) {
    const pivot = new THREE.Group();
    pivot.position.set(5.8, Math.max(terrain(5.8, z) + 1.02, 1.46), z);
    pivot.add(new THREE.Mesh(rim, far), new THREE.Mesh(paddles, far));
    for (const m of pivot.children) { m.castShadow = true; m.receiveShadow = true; }
    rotorRoot.add(pivot);
    wheels.push(pivot);
  }
}
