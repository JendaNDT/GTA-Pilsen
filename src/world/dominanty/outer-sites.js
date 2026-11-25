import { ShapeUtils, Vector2 } from 'three/webgpu';
import { frame } from './mesh.js';

const groups = [
  {
    name: 'TechTower a Světovar',
    ids: [9100, 9101, 9112, 9116, 9121],
    anchor: [2313, 2087],
    key: 9112,
    build: svetovar,
  },
  { name: 'Lochotínský amfiteátr', ids: [3579, 96466], anchor: [-1179, -1343], key: 3579, build: amphitheatre },
  {
    name: 'Statek U Matoušů',
    ids: [29797, 29716, 29820, 29832, 29842, 29818, 29757],
    anchor: [22, -3180],
    key: 29797,
    build: farm,
  },
  { name: 'Rozhledna Chlum', ids: [38566], anchor: [3809, -2208], key: 38566, build: lookout },
];

export function outerTiles(w) {
  const tiles = new Map();
  for (const site of groups) {
    const [x, z] = site.anchor,
      i = site.key;
    if (!(x >= w.bMinX[i] && x <= w.bMaxX[i] && z >= w.bMinZ[i] && z <= w.bMaxZ[i])) continue;
    for (const id of site.ids) {
      const ci = w.chunkIndex((w.bMinX[id] + w.bMaxX[id]) / 2, (w.bMinZ[id] + w.bMaxZ[id]) / 2);
      if (!tiles.has(ci)) tiles.set(ci, []);
      tiles.get(ci).push({ site, id });
    }
  }
  return tiles;
}

// Každá stěna má celá okenní pole. Hřeben střechy dělí půdorys přesně v ose,
// takže i nepravidelné a zkosené rohy mají správný obrys při pohledu shora.
function house(buf, w, id, wall, roof, rise, bay, floor) {
  const { b } = w,
    r = b.bRing[id],
    ring = [];
  for (let k = b.ringStart[r]; k < b.ringStart[r + 1]; k++) ring.push(new Vector2(w.bvx[k], w.bvz[k]));
  let longest = 0,
    dir = new Vector2(1, 0);
  for (let i = 0; i < ring.length; i++) {
    const edge = ring[(i + 1) % ring.length].clone().sub(ring[i]);
    if (edge.length() > longest) {
      longest = edge.length();
      dir = edge.normalize();
    }
  }
  const cross = new Vector2(-dir.y, dir.x);
  const distances = ring.map((p) => p.dot(cross)),
    low = Math.min(...distances),
    high = Math.max(...distances),
    mid = (low + high) / 2;
  const top = w.bTop[id],
    eave = top - rise,
    base = w.bBase[id];
  const ridge = (p) => top - (rise * Math.abs(p.dot(cross) - mid)) / Math.max(0.1, (high - low) / 2);
  const at = (p, y) => [p.x, y, p.y];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    buf.quad(
      at(a, base),
      at(b, base),
      at(b, eave),
      at(a, eave),
      wall,
      0xffffff,
      Math.max(1, Math.round(a.distanceTo(b) / bay)),
      Math.max(1, Math.round((eave - base) / floor)),
    );
    if (rise) {
      const section = [a],
        da = a.dot(cross) - mid,
        db = b.dot(cross) - mid;
      if (da * db < 0) section.push(a.clone().lerp(b, da / (da - db)));
      section.push(b);
      for (let k = 1; k < section.length; k++) {
        const l = section[k - 1],
          r = section[k];
        buf.quad(
          at(l, eave),
          at(r, eave),
          at(r, ridge(r)),
          at(l, ridge(l)),
          'plain',
          wall === 'farm' ? 0xf0eadb : 0xc3b6a3,
        );
      }
    }
  }
  const tris = ShapeUtils.triangulateShape(ring, []);
  for (const tri of tris) {
    const corners = tri.map((i) => ring[i]);
    for (const sign of rise ? [1, -1] : [1]) {
      const clipped = [];
      for (let k = 0; k < 3; k++) {
        const a = corners[k],
          b = corners[(k + 1) % 3],
          da = sign * (a.dot(cross) - mid),
          db = sign * (b.dot(cross) - mid);
        if (!rise || da >= 0) clipped.push(a);
        if (rise && da * db < 0) clipped.push(a.clone().lerp(b, da / (da - db)));
      }
      for (let k = 1; k + 1 < clipped.length; k++) {
        const pts = [clipped[0], clipped[k], clipped[k + 1]];
        buf.tri(
          pts.map((p) => at(p, ridge(p))),
          roof,
          pts.map((p) => [p.dot(dir) / 4, p.dot(cross) / 4]),
        );
      }
    }
  }
}

function svetovar(buf, w, id) {
  const villa = id === 9116 || id === 9121;
  house(
    buf,
    w,
    id,
    villa ? 'brewery' : 'modern',
    villa ? 'tile' : 'metal',
    villa ? 3.5 : 0,
    id === 9112 ? 8.2 : 5,
    villa ? 4.1 : 7.7,
  );
  if (id !== 9112) return;
  const p = frame(2313.2, 2087, w.bTop[id], -0.625);
  buf.block(p, 0, 0, 0, 26, 18, 2, 'depot');
  buf.block(p, 0, 0, 2, 16, 10, 2.4, 'modern');
  buf.block(p, 0, 0, 4.4, 16.6, 10.6, 0.35, 'metal');
  buf.block(p, -13, -8, 0, 5.8, 5.7, 5.5, 'modern');
  buf.block(p, -13, -8, 5.5, 6.3, 6.2, 0.35, 'metal');
  buf.panel(p, 0, 20.95, -19, 12, 1.75, 'tower-sign');
}
function farm(buf, w, id) {
  house(
    buf,
    w,
    id,
    id === 29716 ? 'barn' : 'farm',
    'tile',
    Math.min(4.4, (w.bTop[id] - w.bGround[id]) * 0.51),
    4.9,
    5.2,
  );
  if (id !== 29797) return;
  const p = frame(34.75, -3177.35, w.bGround[id], 1.72);
  buf.panel(p, 0, -0.16, 3.75, 1.6, 1.62, 'barn');
  for (const u of [-1.85, 1.85]) buf.panel(p, u, -0.18, 4.37, 0.38, 0.53, 'plain', 0x4e4941);
  const yard = frame(33, -3162, w.heightAt(33, -3162));
  buf.lathe(
    yard,
    0,
    0,
    [
      [0, 1.13],
      [0.7, 1.13],
      [0.8, 1.23],
      [0.9, 1.23],
    ],
    'plain',
    0xdcd4bd,
    16,
  );
  buf.lathe(
    yard,
    0,
    0,
    [
      [0.905, 1.05],
      [0.93, 1.05],
    ],
    'plain',
    0x51483c,
    16,
  );
}
function lookout(buf, w, id) {
  const p = frame(3809.45, -2207.7, w.bGround[id], -0.101);
  buf.block(p, 0, 0, -0.42, 5.85, 5.85, 1.35, 'stone');
  const levels = [0.93, 5.5, 10, 14.5, 19.3];
  for (let k = 1; k < levels.length; k++)
    buf.block(p, 0, 0, levels[k - 1], 5.57, 5.57, levels[k] - levels[k - 1], 'lookout');
  buf.block(p, 0, 0, 19.3, 6.42, 6.42, 0.54, 'plain', 0x99988c);
  buf.block(p, 0, 0, 19.84, 7.18, 7.18, 0.42, 'plain', 0xc9c5b1);
  for (let i = -3; i <= 3; i++)
    for (const s of [-1, 1]) {
      buf.block(p, i, s * 3.45, 20.25, 0.075, 0.075, 1.16, 'plain', 0x5f6261);
      buf.block(p, s * 3.45, i, 20.25, 0.075, 0.075, 1.16, 'plain', 0x5f6261);
    }
  for (const s of [-1, 1])
    for (const h of [20.7, 21.35]) {
      buf.block(p, 0, s * 3.45, h, 7, 0.085, 0.08, 'plain', 0x555a59);
      buf.block(p, s * 3.45, 0, h, 0.085, 7, 0.08, 'plain', 0x555a59);
    }
  buf.block(p, 0, 0, 20.26, 3.68, 3.68, 3.15, 'plaster');
  buf.block(p, 0, 0, 23.41, 4.25, 4.25, 0.35, 'metal');
  for (const [u, d, h] of [
    [0, 0, 3.9],
    [1.3, -1.2, 2.75],
    [-1.3, 1.2, 2.24],
  ])
    buf.lathe(
      p,
      u,
      d,
      [
        [23.76, 0.07],
        [23.76 + h, 0.035],
      ],
      'plain',
      0x6e716f,
      6,
    );
}
function amphitheatre(buf, w, id) {
  if (id === 96466) {
    house(buf, w, id, 'stage', 'metal', 0.8, 6.2, 7);
    return;
  }
  const p = frame(-1186, -1355, w.heightAt(-1186, -1355), -0.563);
  house(buf, w, id, 'plaster', 'metal', 0.7, 8, 7.2);
  buf.block(p, 0, -0.7, 0, 25, 5, 1.1, 'plain', 0x797771);
  buf.block(p, 0, 0.1, 1.1, 23, 0.7, 9, 'stage');
  buf.panel(p, 0, -0.31, 2.1, 17, 6.5, 'plain', 0xd8d6cc);
  buf.panel(p, 0, -0.32, 9.2, -17, 1.35, 'amfi-sign');
  const point = (angle, r, dy) => {
    const [x, , z] = p(r * Math.sin(angle), -r * Math.cos(angle), 0);
    return [x, w.heightAt(x, z) + dy, z];
  };
  for (let row = 0; row < 22; row++) {
    const radius = 18 + row * 1.85 + (row > 9 ? 3.3 : 0);
    for (let sector = 0; sector < 7; sector++)
      for (let k = 0; k < 3; k++) {
        const span = 2.48 / 7,
          first = -1.24 + span * sector + 0.9 / radius,
          step = (span - 1.8 / radius) / 3;
        const a = first + k * step,
          b = a + step;
        buf.quad(
          point(a, radius, 0.44),
          point(b, radius, 0.44),
          point(b, radius + 0.46, 0.47),
          point(a, radius + 0.46, 0.47),
          'plain',
          0xa4927b,
        );
        buf.quad(
          point(a, radius, 0.44),
          point(a, radius, 0.16),
          point(b, radius, 0.16),
          point(b, radius, 0.44),
          'plain',
          0x75685a,
        );
      }
  }
}

export function buildOuterSite(buf, w, records) {
  for (const { site, id } of records) site.build(buf, w, id);
}
