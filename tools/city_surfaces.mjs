import * as THREE from 'three';

const CATHEDRAL = '00000000000100681';
const TOWN_HALL = '00000000000100682';
const NORTH_FACADES = {
  '00000000000100682': 0x8c817a,
  '00000000000100683': 0xeacba6,
  '00000000000100684': 0xdac9a9,
  '00000000000100690': 0xe6d9bc,
  '00000000000100702': 0xded4bc,
  '00000000000100705': 0xe2ded0,
  '00000000000100706': 0xcdbca0,
};
const CLAY = [0x864a3e, 0x955341, 0x9e604a, 0xa46a52, 0x804e43];
const STONE = new THREE.Color(0xb3a58a);
const SLATE = new THREE.Color(0x545353);
const SPIRE = new THREE.Color(0x627f72);
const _color = new THREE.Color();
function wrapFace(rings, offset) {
  return rings.map((ring) => ring.map((p, i) => i % 3 === 1 ? p - offset : p));
}

function wallSpan(ring) {
  let lo = Infinity, hi = -Infinity, a = 0, b = 0, length = 0;
  for (let i = 0; i < ring.length; i += 3) {
    lo = Math.min(lo, ring[i + 1]);
    hi = Math.max(hi, ring[i + 1]);
    for (let j = i + 3; j < ring.length; j += 3) {
      const d = Math.hypot(ring[j] - ring[i], ring[j + 2] - ring[i + 2]);
      if (d > length) { a = i; b = j; length = d; }
    }
  }
  return { lo, hi, x: ring[a], z: ring[a + 2], length,
    dx: length ? (ring[b] - ring[a]) / length : 0, dz: length ? (ring[b + 2] - ring[a + 2]) / length : 0 };
}

// Indexy zaměřených líců lodí, presbytáře a věže v souboru města 2024.
const SOUTH_NAVE = new Set([13, 15, 17, 19, 22, 62, 353]);
const NORTH_NAVE = new Set([31, 33, 38, 40, 43, 67, 78]);
const CHOIR = new Set([48, 51, 54, 57, 60, 341, 344, 347]);
const TOWER = new Set([329, 332, 335, 338]);

function cathedralWindow(mesh, ring, span, index) {
  const south = SOUTH_NAVE.has(index), north = NORTH_NAVE.has(index), choir = CHOIR.has(index), tower = TOWER.has(index);
  if (!south && !north && !choir && !tower) return;
  const { lo, hi, x, z, length, dx, dz } = span;
  const y = tower ? 43 : choir ? Math.max(lo + 1.15, 1.1) : 1.7;
  const h = tower ? 8.4 : Math.min(hi - y - 2.25, choir ? 17.2 : 21);
  const half = Math.min(tower ? 1.18 : choir ? 0.75 : 1.57, length * 0.36);
  const mid = length / 2;
  // Normála plochy je dána orientací městského záznamu.
  const n = new THREE.Vector3();
  for (let i = 0; i < ring.length; i += 3) {
    const j = (i + 3) % ring.length;
    n.y += (ring[i + 2] - ring[j + 2]) * (ring[i] + ring[j]);
    n.x += (ring[i + 1] - ring[j + 1]) * (ring[i + 2] + ring[j + 2]);
    n.z += (ring[i] - ring[j]) * (ring[i + 1] + ring[j + 1]);
  }
  n.normalize();
  const gx = x + mid * dx, gz = z + mid * dz;
  const toward = south ? n.z : north ? -n.z : choir ? n.x * (gx - 16) + n.z * (gz - 7) : n.x * (gx + 22) + n.z * (gz + 10);
  if (toward < 0) n.negate();
  const arch = (w, base, h, lift, col) => {
    const profile = [[-1, 0], [1, 0], [1, 0.69], [0.76, 0.84], [0, 1], [-0.76, 0.84], [-1, 0.69]];
    const points = profile.flatMap(([u, v]) =>
      [x + (mid + u * w) * dx + n.x * lift, base + v * h, z + (mid + u * w) * dz + n.z * lift]);
    mesh.polygon([points], _color.setHex(col), undefined, n);
  };
  arch(half, y, h, 0.071, 0x8d7e68);
  arch(half * 0.83, y + 0.15, h - 0.35, 0.096, 0x343637);
  for (const bar of [-0.29, 0, 0.29]) {
    const w = half * 0.035, u = mid + half * bar;
    const pts = [[u - w, y + 0.15], [u + w, y + 0.15], [u + w, y + h * 0.83], [u - w, y + h * 0.83]];
    mesh.polygon([pts.flatMap(([p, v]) => [x + dx * p + n.x * 0.123, v, z + dz * p + n.z * 0.123])],
      _color.setHex(0x9c917b), undefined, n);
  }
}

const up = new THREE.Vector3(0, 1, 0), roadInfo = {};

export function addCityBuilding(world, uid, faces, shell, accents, roofIndices, use, taggedColor, taggedRoof) {
  const cathedral = uid === CATHEDRAL;
  const tint = Number(uid.slice(-3));
  const fallbackPlaster = [0xe0cdac, 0xd9ceac, 0xe7c7a8, 0xcfceba][tint % 4];
  const plaster = new THREE.Color(NORTH_FACADES[uid] ?? (taggedColor || (use === 5 ? 0x9da3a1 : fallbackPlaster)));
  const clay = new THREE.Color(taggedRoof || CLAY[tint % CLAY.length]);
  for (const [index, [type, ...source]] of faces.entries()) {
    if (type === 0) continue;
    const rings = wrapFace(source, world.baseElevation);
    const span = wallSpan(rings[0]);
    const groundY = world.heightAt(span.x, span.z);
    const facade = type === 1 || type === 4;
    if (facade) {
      const { lo, hi, x, z, dx, dz, length } = span;
      const bottom = Math.min(hi, Math.max(lo, groundY));
      const floors = Math.max(1, Math.round((hi - bottom) / (uid === TOWN_HALL ? 4.15 : use === 2 ? 2.9 : 3.55)));
      const bays = Math.max(1, Math.round(length / (uid === TOWN_HALL ? 3.1 : use === 5 ? 5.1 : 2.65)));
      const visibleWall = type === 1 && length > 1.9 && hi - bottom > 2.5 && hi - bottom < 45;
      let style = uid === TOWN_HALL ? 7 : use;
      if (visibleWall && style === 3) {
        const road = world.nearestRoad(x + dx * length / 2, z + dz * length / 2, 18, 14, 0, roadInfo);
        if (!road || Math.abs(road.dx * dx + road.dz * dz) < 0.72) style = 1;
      }
      const uv = cathedral ? (px, py, pz) => [(px - x) * dx + (pz - z) * dz, py, -2]
        : visibleWall ? (px, py, pz) => [
          13 * (tint % 31) + ((px - x) * dx + (pz - z) * dz) / length * bays,
          (py - bottom) / (hi - bottom) * floors, style + 8 * floors,
        ] : undefined;
      shell.polygon(rings, cathedral ? STONE : plaster, uv);
      if (cathedral && type === 1) cathedralWindow(accents, rings[0], span, index);
    } else {
      const color = cathedral ? (span.lo > 54 ? SPIRE : SLATE) : type === 3 ? SLATE : clay;
      const uv = type === 2 || type === 5 ? (px, py, pz) => [px - span.x + (pz - span.z) * 0.33, py - span.lo + (pz - span.z) * 0.31, -1] : undefined;
      const roof = type === 2 || type === 3 || type === 5;
      const firstIndex = shell.indices.length;
      shell.polygon(rings, type === 6 && !cathedral ? plaster : color, uv, roof ? up : null);
      if (roof) roofIndices.push(...shell.indices.slice(firstIndex));
    }
  }
}
