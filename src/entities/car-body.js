// Tvar karoserie podrobných aut: bokorys spodku a kabiny, podběhy kol a vytažení do šířky
// se zaoblenými hranami. Výpočty bokorysu jsou čisté funkce testovatelné v Node.
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape } from 'three/webgpu';

/** Rozměry kola a výška podvozku stejné jako u dosavadních aut (fyzika se nemění). */
export function carChassis(type) {
  const ride = 0.3 + (type.ride || 0);
  const wheelR = type.id === 'van' || type.ride > 0.1 ? 0.37 : 0.32;
  const bodyH = Math.min(0.62, type.h * 0.42);
  return { ride, wheelR, belt: ride + bodyH, wheelZ: type.len / 2 - 0.82, wheelX: type.wid / 2 - 0.12 };
}

/** Tvar kabiny podle typu: kde začíná a končí sklo a jak strmá jsou okna. */
function cabinShape(type, belt) {
  const { len, h, hood, trunk, id } = type;
  const fz = len / 2, rz = -len / 2, rise = h - belt;
  const base = fz - hood;
  if (id === 'van') return { front: base, roofFront: base - 0.55, roofRear: rz + 0.12, rear: rz + 0.06 };
  if (id === 'pickup') return { front: base, roofFront: base - rise * 1.05, roofRear: base - 1.75, rear: base - 1.85 };
  if (id === 'sport') return { front: base, roofFront: base - rise * 1.9, roofRear: rz + trunk + rise * 1.2, rear: rz + trunk - 0.15 };
  if (trunk >= 0.6) return { front: base, roofFront: base - rise * 1.25, roofRear: rz + trunk + rise * 0.95, rear: rz + trunk };
  if (id === 'hatch') return { front: base, roofFront: base - rise * 1.2, roofRear: rz + 0.1 + rise * 0.85, rear: rz + 0.1 };
  return { front: base, roofFront: base - rise * 1.2, roofRear: rz + 0.1 + rise * 0.22, rear: rz + 0.07 };
}

/**
 * Bokorys auta v rovině (z vpřed, y nahoru). Spodek obsahuje podběhy kol,
 * kabina je samostatný obrys od paty předního skla po patu zadního.
 */
export function carProfile(type) {
  const chassis = carChassis(type);
  const { ride, wheelR, belt, wheelZ } = chassis;
  const { len, h, trunk, id } = type;
  const fz = len / 2, rz = -len / 2;
  const cab = cabinShape(type, belt);
  const arch = wheelR + 0.07;
  const lower = [];
  // přední nárazník a čelo (zdola nahoru)
  const blunt = id === 'van';
  lower.push([fz - 0.06, ride], [fz, ride + 0.16], [fz, belt - (blunt ? 0.2 : 0.24)], [fz - 0.07, belt - (blunt ? 0.07 : 0.13)]);
  // kapota se svažuje k předku a stoupá k čelnímu sklu
  lower.push([fz - 0.4, belt - (blunt ? 0.02 : 0.05)], [cab.front, belt + 0.03]);
  // zadní část: kufr sedanu, korba pick-upu nebo svislá záď
  if (id === 'pickup') {
    lower.push([cab.rear, belt + 0.03], [rz + 0.05, belt + 0.06], [rz, belt - 0.05]);
  } else if (trunk >= 0.6) {
    lower.push([cab.rear, belt + 0.03], [rz + 0.18, belt + 0.02], [rz + 0.02, belt - 0.07]);
  } else {
    lower.push([cab.rear, belt + 0.02], [rz + 0.02, belt - 0.05]);
  }
  lower.push([rz, ride + 0.16], [rz + 0.06, ride]);
  // spodní hrana se zadním a předním podběhem (zezadu dopředu)
  for (const wz of [-wheelZ, wheelZ]) {
    const start = Math.asin(Math.max(-1, Math.min(1, (ride - wheelR) / arch)));
    for (let i = 0; i <= 8; i++) {
      const angle = Math.PI - start - (Math.PI - 2 * start) * (i / 8);
      lower.push([wz + Math.cos(angle) * arch, wheelR + Math.sin(angle) * arch]);
    }
  }
  const roofMid = (cab.roofFront + cab.roofRear) / 2;
  const cabin = [
    [cab.front, belt], [cab.roofFront, h - 0.035], [roofMid, h], [cab.roofRear, h - 0.035], [cab.rear, belt],
  ];
  return { ...chassis, lower: lower.reverse(), cabin, cab, front: fz, rear: rz, hood: [[fz - 0.4, belt - (blunt ? 0.02 : 0.05)], [cab.front, belt + 0.03]] };
}

/** Šířka kabiny se směrem ke střeše zužuje (podíl poloviční šířky v dané výšce). */
export function tumblehome(y, belt, top, narrow = 0.8) {
  const t = Math.max(0, Math.min(1, (y - belt) / Math.max(0.01, top - belt)));
  return 1 - (1 - narrow) * t;
}

// Normály: hladké přes zaoblení a podběhy, ostré mezi bokem a zaoblenou hranou.
function creasedNormals(positions, normals, first, count, crease) {
  const faces = [], byPoint = new Map();
  const key = (i) => `${Math.round(positions[i * 3] * 500)},${Math.round(positions[i * 3 + 1] * 500)},${Math.round(positions[i * 3 + 2] * 500)}`;
  for (let f = first; f < first + count; f += 3) {
    const a = f * 3, b = a + 3, c = a + 6;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const size = Math.hypot(nx, ny, nz) || 1;
    nx /= size; ny /= size; nz /= size;
    faces.push([nx, ny, nz, size]);
    for (let k = 0; k < 3; k++) {
      const id = key(f + k);
      if (!byPoint.has(id)) byPoint.set(id, []);
      byPoint.get(id).push(faces.length - 1);
    }
  }
  for (let f = first, face = 0; f < first + count; f += 3, face++) {
    const own = faces[face];
    for (let k = 0; k < 3; k++) {
      let sx = 0, sy = 0, sz = 0;
      for (const other of byPoint.get(key(f + k))) {
        const n = faces[other];
        if (n[0] * own[0] + n[1] * own[1] + n[2] * own[2] < crease) continue;
        sx += n[0] * n[3]; sy += n[1] * n[3]; sz += n[2] * n[3];
      }
      const size = Math.hypot(sx, sy, sz) || 1;
      normals[(f + k) * 3] = sx / size; normals[(f + k) * 3 + 1] = sy / size; normals[(f + k) * 3 + 2] = sz / size;
    }
  }
}

/**
 * Vytáhne bokorys do šířky `width` se zaoblenými hranami. Výsledek je v souřadnicích auta
 * (x vpravo, y nahoru, z vpřed), střed šířky v x = 0. `shape(x, y)` může x dál upravit.
 */
export function extrudeProfile(points, width, { bevel = 0.06, segments = 3, narrow = null } = {}) {
  const outline = new Shape(points.map(([z, y]) => ({ x: z, y })));
  const depth = Math.max(0.01, width - 2 * bevel);
  const source = new ExtrudeGeometry(outline, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8,
    bevelSegments: segments, curveSegments: 4, steps: 1,
  });
  const plain = source.index ? source.toNonIndexed() : source;
  const p = plain.attributes.position.array;
  const positions = new Float32Array(p.length);
  for (let i = 0; i < p.length; i += 3) {
    // tvar: x = z auta, y = y auta, hloubka = šířka auta
    // otočení (ne zrcadlení), aby trojúhelníky zůstaly natočené ven
    const y = p[i + 1];
    let x = depth / 2 - p[i + 2];
    if (narrow) x *= narrow(y);
    positions[i] = x; positions[i + 1] = y; positions[i + 2] = p[i];
  }
  const normals = new Float32Array(positions.length);
  const groups = plain.groups.length ? plain.groups : [{ start: 0, count: positions.length / 3, materialIndex: 1 }];
  for (const group of groups) {
    // skupina 0 jsou boky (ploché), skupina 1 obvod se zaoblením (hladké přechody)
    creasedNormals(positions, normals, group.start, group.count, group.materialIndex === 0 ? 0.999 : Math.cos(Math.PI / 5));
  }
  if (plain !== source) plain.dispose();
  source.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geometry;
}

/**
 * Vyhladí stínování hotové neindexované geometrie: plošky svírající méně než `angle` stupňů
 * sdílejí normálu (oblé čelo), ostřejší hrany zůstanou ostré. Mění geometrii na místě.
 */
export function smoothNormals(geometry, angle = 30) {
  const positions = geometry.attributes.position.array;
  const normals = geometry.attributes.normal.array;
  creasedNormals(positions, normals, 0, positions.length / 3, Math.cos(angle * Math.PI / 180));
  geometry.attributes.normal.needsUpdate = true;
  return geometry;
}
