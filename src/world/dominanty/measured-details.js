import { frame } from './mesh.js';

const stone = 0xbba57c,
  trim = 0xe0cba2,
  dark = 0x605b50;
export const gateCenter = [696.9, 81.8];
export function breweryGate(buf, world) {
  const p = frame(...gateCenter, 307.14 - world.baseElevation, Math.atan2(0.45, 0.89));
  for (const u of [-6.15, 0, 6.15]) {
    buf.block(p, u, 0, -0.45, 1.75, 2.65, 1.05, 'stone');
    buf.block(p, u, 0, 0.6, 1.55, 2.32, 6.1, 'stone');
    buf.block(p, u, 0, 6.7, 1.94, 2.7, 0.46, 'plain', trim);
  }
  for (const u of [-3.075, 3.075]) {
    const arch = (i, r, d) => {
      const a = (Math.PI * i) / 18;
      return p(u + Math.cos(a) * r, d, 7.12 + Math.sin(a) * r);
    };
    for (const d of [-1.13, 1.13]) {
      buf.block(p, u, d, 7.1, 4.5, 0.055, 0.075, 'plain', dark);
      for (let k = 1; k < 10; k++) {
        const angle = (Math.PI * k) / 10,
          dx = Math.cos(angle),
          dy = Math.sin(angle);
        buf.quad(
          p(u - 0.027 * dy, d, 7.13 + 0.027 * dx),
          p(u + 0.027 * dy, d, 7.13 - 0.027 * dx),
          p(u + 2.2 * dx + 0.027 * dy, d, 7.13 + 2.2 * dy - 0.027 * dx),
          p(u + 2.2 * dx - 0.027 * dy, d, 7.13 + 2.2 * dy + 0.027 * dx),
          'plain',
          dark,
        );
      }
    }
    for (let j = 0; j < 18; j++) {
      for (const d of [-1.09, 1.09]) {
        const a = arch(j, 2.27, d),
          b = arch(j + 1, 2.27, d);
        buf.quad(a, b, arch(j + 1, 2.78, d), arch(j, 2.78, d), 'plain', j % 2 ? stone : trim);
        const c = arch(j, 2.78, d),
          e = arch(j + 1, 2.78, d);
        buf.quad(c, e, [e[0], p(0, 0, 10.25)[1], e[2]], [c[0], p(0, 0, 10.25)[1], c[2]], 'stone');
      }
      buf.quad(
        arch(j, 2.27, -1.09),
        arch(j, 2.27, 1.09),
        arch(j + 1, 2.27, 1.09),
        arch(j + 1, 2.27, -1.09),
        'plain',
        stone,
      );
    }
  }
  for (const [y, w, h] of [
    [9.97, 14.65, 0.35],
    [10.3, 14.12, 1.47],
    [11.77, 14.7, 0.32],
  ])
    buf.block(p, 0, 0, y, w, 2.6, h, 'plain', trim);
  for (const d of [-1.31, 1.31]) buf.panel(p, 0, d, 10.35, Math.sign(d) * 11.8, 1.36, 'gate-sign');
  for (const d of [-1.09, 1.09]) {
    buf.tri([p(-1.3, d, 12.1), p(1.3, d, 12.1), p(0, d, 13.6)], 'plain', undefined, trim);
  }
  for (const u of [-6.25, 6.25, 0])
    buf.lathe(
      p,
      u,
      0,
      [
        [12.1, 0.48],
        [12.4, 0.33],
        [12.75, 0.59],
        [13.12, 0.38],
        [13.42, 0.22],
        [13.55, 0.02],
      ],
      'plain',
      dark,
      10,
    );
}

function waterTower(buf, w) {
  const x = 971.3,
    z = -439.5,
    base = 316.96 - w.baseElevation;
  const p = frame(x, z, base);
  buf.lathe(
    p,
    0,
    0,
    [
      [0, 4.15],
      [1.2, 4.18],
      [1.5, 3.88],
    ],
    'stone',
    0xc5b49e,
    24,
  );
  for (let row = 0; row < 8; row++) {
    const r = 3.88 - row * 0.055;
    buf.lathe(
      p,
      0,
      0,
      [
        [1.5 + row * 4, r],
        [5.5 + row * 4, r - 0.055],
      ],
      'brick',
      0xa48479,
      24,
    );
  }
  buf.lathe(
    p,
    0,
    0,
    [
      [33.5, 3.44],
      [33.8, 4],
      [34.3, 3.92],
      [37.7, 3.92],
      [38.1, 4.22],
      [38.8, 4.42],
      [39.6, 5.12],
      [40.2, 5.57],
      [45.2, 5.57],
      [45.7, 5.95],
      [46.1, 6.35],
    ],
    'plain',
    0xe5d9bb,
    24,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const wall = frame(x + 5.58 * Math.cos(a), z + 5.58 * Math.sin(a), base, a - Math.PI / 2);
    buf.panel(wall, 0, 0.04, 41.7, 0.7, 1.6, 'lookout');
    buf.block(wall, 0, -0.1, 39.0, 0.39, 0.38, 1.0, 'plain', 0xc9ba9b);
  }
  buf.lathe(
    p,
    0,
    0,
    [
      [46.1, 6.35],
      [46.6, 6.48],
      [47, 5.7],
      [48, 5.08],
      [49.9, 3.6],
      [50.6, 2.42],
      [51, 1.15],
      [51.6, 0.96],
      [52.2, 0.64],
      [52.7, 0.42],
      [54, 0.04],
    ],
    'spire',
    0xc0c3b2,
    24,
  );
}

export function stadium(buf, world) {
  const p = frame(545, -278, 0, Math.atan2(0.97, 0.242));
  function field(u, d, dy = 0.1) {
    const [x, , z] = p(u, d, 0);
    return [x, world.heightAt(x, z) + dy, z];
  }
  const white = 0xf5f2df;
  for (const side of [-1, 1]) {
    const end = side * 52.5;
    const [x, y, z] = field(end, 0);
    const goal = frame(x, z, y, Math.atan2(0.97, 0.242));
    for (const d of [-3.66, 3.66]) buf.block(goal, 0, d, 0, 0.12, 0.12, 2.44, 'plain', white);
    buf.block(goal, 0, 0, 2.38, 0.12, 7.44, 0.12, 'plain', white);
  }
  for (let row = 0; row < 10; row++) {
    for (const sign of [-1, 1])
      for (const end of [false, true]) {
        const offset = (end ? 55.7 : 36.8) + row * 0.85,
          width = end ? 33 : 52;
        for (let bay = 0; bay < 8; bay++) {
          const a = -width + (2 * width * bay) / 8 + 0.62,
            b = -width + (2 * width * (bay + 1)) / 8 - 0.62;
          const seat = (s, d, h) =>
            end ? field(sign * d, s, 0.6 + row * 0.53 + h) : field(s, sign * d, 0.6 + row * 0.53 + h);
          const col = (bay + (row > 5 ? 1 : 0)) % 3 === 0 ? 0x9e383b : 0x345882;
          buf.quad(
            seat(a, offset, 0),
            seat(b, offset, 0),
            seat(b, offset + 0.65, 0.15),
            seat(a, offset + 0.65, 0.15),
            'seats',
            col,
            2,
          );
          buf.quad(
            seat(a, offset + 0.65, 0.15),
            seat(b, offset + 0.65, 0.15),
            seat(b, offset + 0.65, 0.52),
            seat(a, offset + 0.65, 0.52),
            'seats',
            col,
            2,
          );
        }
      }
  }
}

function beseda(buf, w) {
  const p = frame(-69.46, 331.05, 312.81 - w.baseElevation, -0.075);
  for (const u of [-13.9, -8.8, 8.8, 13.9]) {
    buf.block(p, u, -0.29, 0.3, 0.6, 0.48, 18.2, 'plain', 0xe0d3aa);
    buf.block(p, u, -0.29, 17.9, 1.1, 0.69, 0.65, 'pinnacle');
  }
  for (const y of [5.4, 11.3, 18.7]) buf.block(p, 0, -0.25, y, 30.5, 0.7, 0.32, 'plain', trim);
  for (const u of [-10.8, 10.8]) {
    buf.block(p, u, -0.3, 19, 4.4, 0.84, 0.7, 'pinnacle');
    buf.lathe(
      p,
      u,
      -0.3,
      [
        [19.7, 0.9],
        [20.1, 0.72],
        [21, 0.28],
        [21.35, 0.03],
      ],
      'plain',
      trim,
      6,
    );
  }
  for (const u of [-3.5, 0, 3.5]) buf.panel(p, u, -0.64, 0.1, 2.54, 4.7, 'door');
  buf.panel(p, 0, -0.65, 5.82, -10, 1.15, 'beseda-sign');
  const crown = frame(-69.22, 335.15, 337.38 - w.baseElevation);
  buf.lathe(
    crown,
    0,
    0,
    [
      [0, 3.28],
      [0.52, 3.52],
      [1.8, 3.2],
      [2.95, 2.53],
      [3.7, 1.6],
      [4.05, 1.1],
    ],
    'spire',
    0xfbfae9,
    20,
  );
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * i) / 4;
    buf.lathe(
      crown,
      Math.cos(a) * 0.83,
      Math.sin(a) * 0.83,
      [
        [4.05, 0.14],
        [5.6, 0.14],
      ],
      'plain',
      dark,
      6,
    );
  }
  buf.lathe(
    crown,
    0,
    0,
    [
      [5.6, 1.16],
      [5.92, 1.06],
      [6.47, 0.58],
      [6.8, 0.2],
      [8.55, 0.035],
    ],
    'spire',
    0xffffff,
    12,
  );
}

function market(buf, w) {
  for (const [x, z, angle] of [
    [203.03, -15.91, 0.733],
    [170.15, 21.57, 0.733 + Math.PI],
  ]) {
    const p = frame(x, z, w.heightAt(x, z), angle);
    buf.panel(p, 0, -0.4, 0, 3.2, 4, 'door');
    for (const [u, y] of [
      [-2.1, 7.4],
      [2.1, 7.4],
      [0, 9.4],
    ])
      buf.panel(p, u, -0.39, y, 0.48, 1.05, 'plain', 0x4c473c);
    for (let i = -4; i <= 4; i++) {
      const y = 7.1 + (4 - Math.abs(i)) * 1.4;
      buf.block(p, i * 1.43, -0.16, 4.5, 1.46, 0.42, y - 4.06, 'plain', 0xf0e7ce);
      buf.block(p, i * 1.43, -0.16, y + 0.44, 0.42, 0.4, 0.55, 'plain', 0xdfd7c1);
    }
  }
}

function depot(buf, w) {
  const p = frame(310.2, 1070.4, 306.55 - w.baseElevation, 0.103);
  for (const u of [-16, 16]) {
    buf.panel(p, u, 0.44, 0.1, 31, 5.1, 'depot', 0xcfc8b1, 4);
    buf.panel(p, u, 0.45, 5.17, 30.8, 1.83, 'plain', 0xd0ac44);
    if (u < 0) buf.panel(p, u, 0.47, 5.3, 13.3, 1.52, 'depo-sign');
    for (let j = 0; j < 24; j++) {
      const arch = (i, drop) => {
        const a = (Math.PI * i) / 24;
        return p(u + 15.5 * Math.cos(a), 0.46, 7.1 + 4.4 * Math.sin(a) - drop);
      };
      const a = arch(j, 0),
        b = arch(j + 1, 0),
        foot = p(0, 0, 7.0)[1];
      buf.quad([a[0], foot, a[2]], [b[0], foot, b[2]], b, a, 'depot');
      buf.quad(arch(j, 0), arch(j + 1, 0), arch(j + 1, 0.2), arch(j, 0.2), 'plain', 0x424a4a);
    }
  }
  buf.lathe(
    p,
    5,
    12,
    [
      [0, 0.99],
      [0.6, 1],
      [11, 0.61],
      [12, 0.75],
      [12.5, 0.68],
    ],
    'plain',
    0x97593b,
    12,
  );
}

export function measuredDetails(buf, w, name) {
  switch (name) {
    case '640-128.bin':
      breweryGate(buf, w);
      break;
    case '896--384.bin':
      waterTower(buf, w);
      break;
    case '-128-384.bin':
      beseda(buf, w);
      break;
    case '640--384.bin':
      stadium(buf, w);
      break;
    case '128-128.bin':
      market(buf, w);
      break;
    case '-1152-640.bin':
      buf.panel(frame(-1111, 818, 326 - w.baseElevation, 0.107), 0, 0, 5, 15, 2.7, 'tech-sign');
      break;
    case '-1152-896.bin':
      buf.panel(frame(-1094, 923, 326.5 - w.baseElevation, 0.08), 0, 0.25, 4, 10, 1.7, 'planet-sign');
      break;
    case '384-1152.bin':
      depot(buf, w);
      break;
  }
}
