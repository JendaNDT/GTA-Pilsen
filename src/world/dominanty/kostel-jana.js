// Místní osy sledují zaměřené průčelí na Klatovské a hloubku hlavní lodi.
const plaster = 0xe6d2ae;
const limestone = 0xeee3cd;
const sill = 0xc7bba3;
const plinth = 0xb1a898;
const gold = 0xceaa56;

function faceAt(p, u, d, quarter) {
  const c = [1, 0, -1, 0][quarter],
    s = [0, 1, 0, -1][quarter];
  return (x, depth, y) => p(u + x * c - depth * s, d + x * s + depth * c, y);
}

function cornice(buf, p, y, width, depth) {
  buf.block(p, 0, 0, y, width, depth, 0.16, 'plain', sill);
  buf.block(p, 0, 0, y + 0.16, width + 0.18, depth + 0.18, 0.2, 'plain', limestone);
}

function cross(buf, p, y, height, width, tint) {
  const stem = height * 0.075;
  buf.block(p, 0, 0, y, stem, stem, height, 'plain', tint);
  buf.block(p, 0, 0, y + height * 0.64, width, stem, stem, 'plain', tint);
  buf.block(p, 0, 0, y + height * 0.84, stem * 1.9, stem * 1.4, stem, 'plain', tint);
}

// Každá ze čtyř stěn má skutečný trojúhelný štít. Okraj střechy tak zepředu i
// z boku kopíruje štít a vícestěnná špice vystupuje až za ním.
function tower(buf, p, top) {
  const radius = 4.04,
    eave = 39.3,
    peak = 45.1;
  buf.block(p, 0, 0, -0.35, radius * 2, radius * 2, eave + 0.35, 'plain', plaster);
  for (const [y, w] of [
    [0.05, 8.22],
    [9.6, 8.24],
    [20.8, 8.3],
    [29.95, 8.36],
  ])
    cornice(buf, p, y, w, w);
  for (let side = 0; side < 4; side++) {
    const face = faceAt(p, 0, 0, side),
      front = -radius;
    buf.panel(face, 0, front - 0.06, 0, 7.96, 3.05, 'plain', plinth);
    for (const x of [-3.82, 3.82]) buf.block(face, x, front + 0.035, 1, 0.42, 0.24, eave - 1, 'plain', limestone);
    for (const [y, h] of [
      [9.04, 0.58],
      [20.2, 0.63],
      [29.3, 0.7],
    ])
      buf.panel(face, 0, front - 0.04, y, 7.4, h, 'obloucky', 0xffffff, 9);
    for (const [y, width, height, art] of [
      [12.4, 1.35, 2.94, 'okno-jana'],
      [22.7, 2.12, 4.1, 'dvojokno'],
      [32.12, 3.58, 7.14, 'zvonice'],
    ]) {
      buf.panel(face, 0, front - 0.08, y, width, height, art);
      buf.block(face, 0, front - 0.02, y - 0.1, width + 0.18, 0.26, 0.16, 'plain', sill);
    }
    const corner = face(-radius, front, eave),
      middle = face(0, front, peak),
      end = face(radius, front, eave);
    buf.tri([corner, end, middle], 'plain', undefined, plaster);
    for (const sign of [-1, 1]) {
      const x = sign * radius;
      buf.quad(
        face(x, front - 0.12, eave),
        face(0, front - 0.12, peak),
        face(0, front - 0.12, peak - 0.32),
        face(x, front - 0.12, eave - 0.32),
        'plain',
        limestone,
      );
    }
    for (let j = -3; j <= 3; j++) {
      const h = peak - 1.3 - Math.abs(j) * 1.13;
      buf.panel(face, j * 0.83, front - 0.055, h - 0.6, 0.83, 0.6, 'obloucky');
    }
    // Nad čtveřicí štítů přechází střecha do osmi úzkých ploch.
    const ridge = face(0, -3.12, peak + 2.0),
      l = face(-2.25, -2.25, peak + 2),
      r = face(2.25, -2.25, peak + 2);
    const paintRoof = (points, uv) => buf.tri(points, 'steeple-tiles', uv);
    paintRoof(
      [corner, middle, l],
      [
        [0, 0],
        [2, 1.4],
        [0.8, 2],
      ],
    );
    paintRoof(
      [middle, ridge, l],
      [
        [2, 1.4],
        [2, 2],
        [0.8, 2],
      ],
    );
    paintRoof(
      [middle, end, r],
      [
        [2, 1.4],
        [4, 0],
        [3.2, 2],
      ],
    );
    paintRoof(
      [middle, r, ridge],
      [
        [2, 1.4],
        [3.2, 2],
        [2, 2],
      ],
    );
    const neck = top - 6.45,
      mid = face(0, -0.99, neck),
      left = face(-0.7, -0.7, neck),
      right = face(0.7, -0.7, neck);
    const tip = face(0, 0, top - 2.05);
    for (const [a, b, c, d] of [
      [l, ridge, mid, left],
      [ridge, r, right, mid],
    ]) {
      paintRoof(
        [a, b, c],
        [
          [0, 0],
          [1.2, 0],
          [0.83, 3],
        ],
      );
      paintRoof(
        [a, c, d],
        [
          [0, 0],
          [0.83, 3],
          [0.37, 3],
        ],
      );
      paintRoof(
        [d, c, tip],
        [
          [0.37, 0],
          [0.83, 0],
          [0.6, 1.45],
        ],
      );
    }
    buf.tri(
      [face(-0.23, -1.14, neck - 0.35), face(0.23, -1.14, neck - 0.35), face(0, -1.02, neck + 0.29)],
      'plain',
      undefined,
      0x493e37,
    );
  }
  buf.lathe(
    p,
    0,
    0,
    [
      [top - 2.12, 0.16],
      [top - 1.79, 0.16],
      [top - 1.66, 0.31],
      [top - 1.44, 0.36],
      [top - 1.22, 0.23],
      [top - 1.12, 0.085],
    ],
    'plain',
    gold,
    12,
  );
  cross(buf, p, top - 1.16, 1.55, 0.96, gold);
}

function rose(buf, p, u, d, y, radius) {
  // Vystouplé ostění má vlastní boční stěnu. UV zůstává kruhové i při pohledu z boku.
  const front = d - 0.18;
  for (let i = 0; i < 48; i++) {
    const rim = (k) => {
      const a = (k * Math.PI) / 24;
      return [Math.cos(a), Math.sin(a)];
    };
    const a = rim(i),
      b = rim(i + 1);
    const at = (v, depth) => p(u + v[0] * radius, depth, y + v[1] * radius);
    const uv = (v) => [0.5 + 0.487 * v[0], 0.5 + 0.487 * v[1]];
    buf.quad(at(a, d + 0.02), at(b, d + 0.02), at(b, front), at(a, front), 'plain', sill);
    buf.tri([p(u, front, y), at(a, front), at(b, front)], 'rozeta-jana', [[0.5, 0.5], uv(a), uv(b)]);
  }
}

function frontGable(buf, p, street) {
  const front = -1.9,
    half = 7.36,
    shoulder = 20.25,
    peak = 27.9;
  buf.block(p, 0, front + 0.18, -0.3, half * 2, 0.36, shoulder + 0.3, 'plain', plaster);
  buf.tri([p(-half, front, shoulder), p(half, front, shoulder), p(0, front, peak)], 'plain', undefined, plaster);
  for (const sign of [-1, 1]) {
    buf.block(p, sign * (half - 0.38), front + 0.02, 0, 0.72, 0.32, shoulder, 'plain', limestone);
    buf.quad(
      p(sign * half, front - 0.14, shoulder),
      p(0, front - 0.14, peak),
      p(0, front - 0.14, peak - 0.37),
      p(sign * half, front - 0.14, shoulder - 0.37),
      'plain',
      limestone,
    );
  }
  for (let j = -5; j <= 5; j++)
    buf.panel(p, j * 1.05, front - 0.025, peak - 2.55 - Math.abs(j) * 1.09, 1.05, 0.83, 'obloucky');
  buf.block(p, 0, front, 8.6, 14.95, 0.61, 0.27, 'plain', limestone);
  buf.panel(p, 0, front - 0.045, 7.65, 13.05, 0.81, 'obloucky', 0xffffff, 13);
  for (const u of [-4.05, 0, 4.05]) {
    const w = u === 0 ? 4.28 : 3.45,
      h = u === 0 ? 6.12 : 5.46;
    const height = h - 0.67,
      threshold = street + 0.36;
    buf.panel(p, u, front - 0.064, threshold, w, height, 'portal-jana');
    // Vnější archivolta předstupuje před ostění a vrhá stín do vstupu.
    const radius = w * 0.53,
      spring = threshold + height - radius;
    for (let k = 0; k < 18; k++) {
      const arch = (j, r, d) => p(u + r * Math.cos((j * Math.PI) / 18), d, spring + r * Math.sin((j * Math.PI) / 18));
      const a = front - 0.51,
        b = front - 0.067;
      buf.quad(
        arch(k, radius, a),
        arch(k + 1, radius, a),
        arch(k + 1, radius - 0.22, a),
        arch(k, radius - 0.22, a),
        'plain',
        limestone,
      );
      buf.quad(
        arch(k, radius - 0.22, a),
        arch(k + 1, radius - 0.22, a),
        arch(k + 1, radius - 0.22, b),
        arch(k, radius - 0.22, b),
        'plain',
        sill,
      );
      buf.quad(
        arch(k, radius, a),
        arch(k + 1, radius, a),
        arch(k + 1, radius, b),
        arch(k, radius, b),
        'plain',
        limestone,
      );
    }
    for (const sign of [-1, 1]) {
      buf.block(
        p,
        u + sign * (radius - 0.11),
        front - 0.28,
        threshold,
        0.22,
        0.45,
        height - radius,
        'plain',
        limestone,
      );
      buf.block(p, u + sign * (radius - 0.11), front - 0.28, spring - 0.13, 0.32, 0.52, 0.18, 'plain', sill);
    }
  }
  for (let j = 0; j < 3; j++)
    buf.block(p, 0, front - 0.49 - j * 0.38, street - 0.15, 13.25, 0.69, 0.55 - j * 0.15, 'plain', plinth);
  rose(buf, p, 0, front - 0.08, 15.9, 3.74);
  for (const u of [-0.64, 0, 0.64]) buf.panel(p, u, front - 0.045, 21.55, 0.58, 1.24, 'okno-jana');
  cross(buf, faceAt(p, 0, front, 0), peak - 0.15, 1.36, 1.04, limestone);
}

export function churchOfStJohn(buf, world) {
  const scale = Math.hypot(1, 0.14);
  const p = (u, d, y) => [
    -472 + (d + 0.14 * u) / scale,
    328.8 - world.baseElevation + y,
    1019 + (u - 0.14 * d) / scale,
  ];
  const [x, base, z] = p(1.46, -3.2, 0);
  frontGable(buf, faceAt(p, 1.46, 0, 0), world.heightAt(x, z) - base);
  tower(buf, faceAt(p, -8.44, 5.48, 0), 62.25);
  tower(buf, faceAt(p, 11.28, 5.49, 0), 62.08);
  // Oba štíty příčné lodi mají rozetu; podélné boční lodě mají nižší střechy.
  for (const [u, q, back] of [
    [15.62, 1, 14.55],
    [-12.48, 3, -15.15],
  ]) {
    const face = faceAt(p, u, 24.65, q);
    rose(buf, face, 0, 0, 16.75, 2.48);
    buf.panel(face, 0, -0.055, 0.1, 10.2, 2.88, 'plain', plinth);
    buf.panel(face, 0, -0.015, 9.9, 10.9, 0.7, 'obloucky', 0xffffff, 14);
    for (const x of [-4.95, 4.95]) buf.block(face, x, 0, 0.05, 0.36, 0.27, 20.3, 'plain', limestone);
    for (const d of [11.55, 15.85, 32.65, 37.48]) {
      const wing = faceAt(p, d > 30 ? back : q === 1 ? 14.51 : -11.48, d, q);
      buf.panel(wing, 0, -0.1, 3.1, 1.9, 5.5, 'okno-jana');
    }
    const wall = faceAt(p, q === 1 ? 8.98 : -5.99, 14.44, q);
    buf.panel(wall, 0, -0.04, 13.7, 2.6, 5.35, 'okno-jana');
  }
  // Kolem závěru nejsou stěny kolmé k ose kostela. Okna obíhají půlkruh apsidy.
  for (const angle of [-1.15, -0.58, 0, 0.58, 1.15]) {
    const sn = Math.sin(angle),
      cs = Math.cos(angle);
    const apse = (u, d, y) => p(1.55 + (5.02 - d) * sn + u * cs, 42.6 + (5.02 - d) * cs - u * sn, y);
    buf.panel(apse, 0, -0.13, 8.3, 1.65, 6.45, 'okno-jana');
    buf.block(apse, 0, -0.07, 8.16, 1.85, 0.29, 0.18, 'plain', sill);
  }
  for (const [u, q] of [
    [8.98, 1],
    [-5.98, 3],
  ]) {
    buf.panel(faceAt(p, u, 35.47, q), 0, -0.065, 13.85, 2.4, 5.0, 'okno-jana');
  }
}
