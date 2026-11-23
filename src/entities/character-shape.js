// Stylizovaná postava (hráč i chodci): zaoblené tělo z vlastních tvarů místo kvádrů. Každý díl
// leží ve stejném kvádru jako díl fyzikální postavy (physics/ragdoll.js), takže pády a nárazy
// pracují beze změny. Díl se staví kolem svého středu (0, 0, 0); předek postavy míří na +z.
// Původní kvádrovou postavu vrátí adresa ?postava=puvodni.

const search = globalThis.location?.search ?? '';
export const ORIGINAL_CHARACTER = new URLSearchParams(search).get('postava') === 'puvodni';
// Jemné zastínění v barvách postavy (podpaží, rozkrok, pod bradou); vypne ho ?zastineni=0.
export const CHARACTER_SHADING = new URLSearchParams(search).get('zastineni') !== '0';

export const HAIR_STYLES = ['krátké', 'dlouhé', 'drdol', 'nakrátko'];

/**
 * Plášť kolem svislé osy: prstence { y, rx, rz, rzb, x, z } zdola nahoru, seg úseků po obvodu.
 * rz je hloubka vpředu, rzb vzadu (výchozí rz), takže záda a hruď mohou mít jiný tvar; x a z
 * posunou střed prstence.
 * Normály jsou hladké (zaoblený vzhled), volitelná dna uzavřou tvar.
 */
export function loft(p, rings, seg, color, { bottom = false, top = false } = {}) {
  const depth = (ring, a) => (Math.sin(a) < 0 ? ring.rzb ?? ring.rz : ring.rz);
  const at = (ring, a) => [(ring.x ?? 0) + Math.cos(a) * ring.rx, ring.y, (ring.z ?? 0) + Math.sin(a) * depth(ring, a)];
  const normal = (k, a) => {
    const ring = rings[k], below = rings[Math.max(0, k - 1)], above = rings[Math.min(rings.length - 1, k + 1)];
    const dy = above.y - below.y || 1e-6;
    const dr = ((above.rx + depth(above, a)) - (below.rx + depth(below, a))) / 2;
    let nx = Math.cos(a) / Math.max(ring.rx, 1e-4), nz = Math.sin(a) / Math.max(depth(ring, a), 1e-4);
    const len = Math.hypot(nx, nz) || 1;
    nx /= len; nz /= len;
    const ny = -dr / dy;
    const n = Math.hypot(nx, ny, nz) || 1;
    return [nx / n, ny / n, nz / n];
  };
  for (let k = 0; k < rings.length - 1; k++) {
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      const v00 = at(rings[k], a0), v01 = at(rings[k], a1), v10 = at(rings[k + 1], a0), v11 = at(rings[k + 1], a1);
      const n00 = normal(k, a0), n01 = normal(k, a1), n10 = normal(k + 1, a0), n11 = normal(k + 1, a1);
      // pořadí proti směru hodinových ručiček zvenku
      for (const [v, n] of [[v00, n00], [v10, n10], [v11, n11], [v00, n00], [v11, n11], [v01, n01]]) {
        p.vertex(v[0], v[1], v[2], n[0], n[1], n[2], color);
      }
    }
  }
  const cap = (ring, up) => {
    const centre = [ring.x ?? 0, ring.y, ring.z ?? 0];
    for (let s = 0; s < seg; s++) {
      const a0 = (s / seg) * Math.PI * 2, a1 = ((s + 1) / seg) * Math.PI * 2;
      const tri = up ? [centre, at(ring, a1), at(ring, a0)] : [centre, at(ring, a0), at(ring, a1)];
      for (const v of tri) p.vertex(v[0], v[1], v[2], 0, up ? 1 : -1, 0, color);
    }
  };
  if (bottom) cap(rings[0], false);
  if (top) cap(rings[rings.length - 1], true);
  return p;
}

/**
 * Elipsoid (koule protažená v osách) jako plášť z prstenců, volitelně jen jeho část od from
 * do to (−1 = dno, 1 = vrchol) a nakloněný o tilt radiánů kolem osy x (kladný = vrchol dozadu).
 */
export function ellipsoid(p, cx, cy, cz, rx, ry, rz, color, seg = 10, from = -1, to = 1, tilt = 0) {
  // malé koule (klouby, drdol) stačí s méně prstenci
  const all = seg <= 6 ? [-1, -0.55, 0, 0.55, 1] : [-1, -0.82, -0.5, -0.12, 0.28, 0.62, 0.86, 1];
  const steps = all.filter((t) => t >= from - 1e-9 && t <= to + 1e-9);
  if (steps[0] > from) steps.unshift(from);
  if (steps[steps.length - 1] < to) steps.push(to);
  const rings = steps.map((t) => {
    const r = Math.sqrt(Math.max(0, 1 - t * t));
    return { y: cy + ry * t, rx: Math.max(1e-4, rx * r), rz: Math.max(1e-4, rz * r), z: cz };
  });
  for (const ring of rings) ring.x = cx;
  const start = p.p.length;
  loft(p, rings, seg, color, { bottom: from > -1, top: to < 1 });
  if (!tilt) return p;
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  for (let i = start; i < p.p.length; i += 3) {
    // náklon kolem osy x procházející středem elipsoidu: kladný úhel posune vrchol dozadu (−z)
    const y = p.p[i + 1] - cy, z = p.p[i + 2] - cz;
    p.p[i + 1] = cy + y * cos + z * sin; p.p[i + 2] = cz - y * sin + z * cos;
    const ny = p.n[i + 1], nz = p.n[i + 2];
    p.n[i + 1] = ny * cos + nz * sin; p.n[i + 2] = -ny * sin + nz * cos;
  }
  return p;
}

/** Svislý kužel nebo válec od y0 do y1 (poloměry r0 a r1, eliptický průřez se zploštěním flat). */
function limb(p, y0, y1, r0, r1, color, seg = 8, flat = 1, z = 0, caps = {}) {
  return loft(p, [{ y: y0, rx: r0, rz: r0 * flat, z }, { y: (y0 + y1) / 2, rx: (r0 + r1) / 2 * 1.04, rz: (r0 + r1) / 2 * 1.04 * flat, z },
    { y: y1, rx: r1, rz: r1 * flat, z }], seg, color, caps);
}

const shade = (color, k) => color.map((c) => Math.min(1, c * k));

/** Posune body přidané od indexu start o dx v ose x. */
function shiftX(p, start, dx) {
  for (let i = start; i < p.p.length; i += 3) p.p[i] += dx;
}

// Ramena fyzikální postavy jsou 0,3 m od osy těla (u člověka asi 0,2 m), paže se proto kreslí
// blíž k trupu, aby ramena nebyla příliš široká. Kloub, kolem kterého se paže otáčí, se nemění.
export const ARM_INSET = 0.07;

/**
 * Přidá do p geometrii jednoho dílu stylizované postavy. part = díl z physics/ragdoll.js,
 * look = { skin, hair, shirt, pants, shoes, sole, hairStyle, style, shading } (barvy v lineárním
 * RGB), style: 0 krátký rukáv, 1 košile s légou, 2 batoh, 3 kšiltovka; shading: false vynechá
 * zastínění (výchozí podle ?zastineni).
 */
export function stylizedPart(p, part, look) {
  const first = p.p.length;
  const name = part.name, h = part.size[1] / 2;
  const side = Math.sign(part.x) || 1;
  const inward = -side * ARM_INSET;   // posun paže a předloktí k tělu
  const { skin, hair, shirt, pants, shoes, sole, hairStyle, style } = look;
  if (name === 'panev') {
    // boky jsou nejširší dole u kyčlí, aby na ně plynule navázala stehna; vzadu hýždě
    loft(p, [
      { y: -h, rx: 0.198, rz: 0.116, rzb: 0.126 }, { y: -0.03, rx: 0.19, rz: 0.114, rzb: 0.124 },
      { y: 0.05, rx: 0.175, rz: 0.108, rzb: 0.108 },
    ], 12, pants, { bottom: true });
    loft(p, [{ y: 0.05, rx: 0.178, rz: 0.112 }, { y: h, rx: 0.172, rz: 0.108 }], 12, shade(pants, 0.45), { top: true });
    p.box(0.042, 0.022, 0.01, 0, 0.065, 0.113, [0.55, 0.5, 0.35]);   // přezka
  } else if (name === 'hrudnik') {
    // trup: lem trička přes pásek, pas, hruď, lopatky a ramena svažující se ke krku
    loft(p, [
      { y: -0.235, rx: 0.18, rz: 0.12, rzb: 0.115 }, { y: -0.2, rx: 0.168, rz: 0.113, rzb: 0.104 },
      { y: -0.1, rx: 0.174, rz: 0.116, rzb: 0.106 }, { y: 0, rx: 0.188, rz: 0.126, rzb: 0.116, z: 0.006 },
      { y: 0.1, rx: 0.192, rz: 0.122, rzb: 0.126 }, { y: 0.155, rx: 0.18, rz: 0.11, rzb: 0.116 },
      { y: 0.19, rx: 0.155, rz: 0.096, rzb: 0.1 }, { y: 0.222, rx: 0.11, rz: 0.08 },
      { y: 0.25, rx: 0.068, rz: 0.062 },
    ], 12, shirt, { top: true });
    loft(p, [{ y: 0.232, rx: 0.078, rz: 0.07 }, { y: 0.262, rx: 0.068, rz: 0.063 }], 10, shade(shirt, 0.85), { top: true });
    if (style === 1) p.box(0.04, 0.3, 0.012, 0, 0.0, 0.121, shade(shirt, 0.82), 1, 1, 0.008);   // léga košile
    if (style === 2) {
      p.box(0.32, 0.34, 0.12, 0, -0.01, -0.172, [0.12, 0.18, 0.2], 0.94, 0.9);        // batoh
      for (const s of [1, -1]) p.box(0.035, 0.3, 0.015, s * 0.1, 0.02, 0.114, [0.1, 0.14, 0.16]);
    }
  } else if (name === 'hlava') {
    const cy = 0.04, rx = 0.104, ry = 0.13, rz = 0.118;
    limb(p, -h, -0.05, 0.057, 0.05, skin, 8);                          // krk
    ellipsoid(p, 0, cy, 0.004, rx, ry, rz, skin, 12);                  // hlava
    // obličej: oči, obočí, nos, ústa, uši
    for (const s of [1, -1]) {
      p.box(0.022, 0.026, 0.012, s * 0.038, cy + 0.018, rz * 0.93, [0.04, 0.04, 0.05]);
      p.box(0.034, 0.01, 0.012, s * 0.039, cy + 0.048, rz * 0.9, shade(hair, 0.9));
      p.box(0.014, 0.04, 0.028, s * rx * 0.98, cy + 0.005, -0.004, shade(skin, 0.93));
    }
    p.box(0.022, 0.034, 0.028, 0, cy - 0.006, rz * 0.98, shade(skin, 0.94), 0.8, 1, 0.008);
    p.box(0.036, 0.008, 0.01, 0, cy - 0.05, rz * 0.86, [0.42, 0.16, 0.14]);
    // vlasy: čepička nakloněná dozadu, takže čelo zůstane volné a týl je zakrytý
    if (hairStyle === 3) ellipsoid(p, 0, cy + 0.004, -0.004, rx * 1.03, ry * 1.02, rz * 1.03, shade(hair, 1.05), 12, 0.3, 1, 0.45);
    else {
      ellipsoid(p, 0, cy + 0.006, -0.006, rx * 1.08, ry * 1.06, rz * 1.08, hair, 12, 0.05, 1, 0.66);
      if (hairStyle === 1) {
        p.box(rx * 1.9, 0.2, 0.05, 0, cy - 0.07, -rz * 0.86, hair, 1.06, 1);    // dlouhé vlasy na záda
        for (const s of [1, -1]) p.box(0.026, 0.15, 0.1, s * rx * 1.0, cy - 0.04, -0.045, hair);
      }
      if (hairStyle === 2) ellipsoid(p, 0, cy + 0.075, -rz * 1.02, 0.048, 0.048, 0.048, hair, 6);   // drdol
    }
    if (style === 3) {
      ellipsoid(p, 0, cy + 0.03, -0.004, rx * 1.12, ry * 0.95, rz * 1.1, shirt, 12, 0.3, 1);
      p.box(0.17, 0.014, 0.1, 0, cy + 0.055, rz * 1.18, shade(shirt, 0.8));          // kšilt
    }
  } else if (name.startsWith('paze')) {
    // paže od lokte k rameni: nahoře oblý ramenní sval, jehož vršek leží těsně pod kloubem
    // ramene, takže paže při švihu nevyčnívá nad rameno
    const start = p.p.length;
    // vršek ramenního svalu leží blíž k tělu než osa paže, takže rameno plynule klesá ven
    const shoulder = [
      { y: 0.02, rx: 0.058, rz: 0.063 }, { y: 0.065, rx: 0.062, rz: 0.067, x: -side * 0.006 },
      { y: 0.095, rx: 0.054, rz: 0.06, x: -side * 0.014 }, { y: 0.113, rx: 0.036, rz: 0.042, x: -side * 0.022 },
      { y: 0.123, rx: 0.012, rz: 0.014, x: -side * 0.028 },
    ];
    if (style === 0) {
      // krátký rukáv: holá paže zasahuje do rukávu, který je o něco širší
      loft(p, [{ y: -h, rx: 0.047, rz: 0.05 }, { y: 0.02, rx: 0.056, rz: 0.06 }], 8, skin, { bottom: true });
      loft(p, [{ y: -0.015, rx: 0.065, rz: 0.069 }, ...shoulder], 8, shirt, { top: true });
    } else loft(p, [{ y: -h, rx: 0.049, rz: 0.052 }, ...shoulder], 8, shirt, { bottom: true, top: true });
    shiftX(p, start, inward);
  } else if (name.startsWith('predlokti')) {
    // předloktí od lokte k zápěstí, kloub lokte, dlaň s prsty a palcem (dlaň míří k tělu)
    const start = p.p.length, sleeve = style === 0 ? skin : shirt, palm = -side;
    loft(p, [{ y: -0.1, rx: 0.032, rz: 0.04 }, { y: -0.02, rx: 0.039, rz: 0.046 }, { y: 0.08, rx: 0.046, rz: 0.051 },
      { y: h, rx: 0.046, rz: 0.05 }], 8, sleeve, { bottom: true, top: true });
    ellipsoid(p, 0, h, 0, 0.048, 0.048, 0.05, sleeve, 6);                              // loket
    if (style !== 0) loft(p, [{ y: -0.108, rx: 0.039, rz: 0.047 }, { y: -0.078, rx: 0.039, rz: 0.047 }], 8, shade(shirt, 0.85), { bottom: true });   // manžeta
    p.box(0.03, 0.085, 0.072, 0, -0.145, 0.004, skin, 0.92, 0.85);                    // dlaň
    p.box(0.026, 0.055, 0.066, palm * 0.004, -0.215, 0.004, shade(skin, 0.96), 1.1, 1.05);   // prsty
    p.box(0.022, 0.05, 0.024, palm * 0.009, -0.135, 0.044, skin);                     // palec
    shiftX(p, start, inward);
  } else if (name.startsWith('stehno')) {
    // stehno se zužuje ke koleni, nahoře navazuje na boky
    loft(p, [{ y: -h, rx: 0.06, rz: 0.064 }, { y: -0.08, rx: 0.068, rz: 0.074 }, { y: 0.08, rx: 0.079, rz: 0.088 },
      { y: h, rx: 0.081, rz: 0.09 }], 8, pants, { top: true });
  } else if (name.startsWith('lytko')) {
    ellipsoid(p, 0, h, 0, 0.063, 0.058, 0.068, pants, 6);                            // koleno
    loft(p, [{ y: -0.14, rx: 0.047, rz: 0.05 }, { y: 0.06, rx: 0.058, rz: 0.062, rzb: 0.072 }, { y: h, rx: 0.061, rz: 0.066 }], 8, pants, { top: true });
    // bota: svršek a podrážka, špička dopředu
    p.box(0.1, 0.075, 0.25, 0, -0.185, 0.045, shoes, 0.9, 0.72, -0.03);
    p.box(0.106, 0.022, 0.262, 0, -0.226, 0.045, sole);
  }
  if (look.shading ?? CHARACTER_SHADING) bakeOcclusion(p, first, part);
  return p;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const bump = (v, a, peak, b) => (v < peak ? smooth(a, peak, v) : 1 - smooth(peak, b, v));

/**
 * Zastínění bodu postavy ve stoje (1 = plné světlo, méně = tmavší): kam málo dosvítí obloha,
 * protože je zakrývá jiná část těla. name = díl, x, y, z = bod na těle (x do strany od osy těla,
 * y výška nad zemí, z dopředu), nx, ny, nz = normála.
 */
export function characterOcclusion(name, x, y, z, nx, ny, nz) {
  const side = Math.sign(x) || 1;
  const towardBody = Math.max(0, -nx * side);     // plocha míří k ose těla
  const outward = Math.max(0, nx * side);
  // k zemi a na plochách obrácených dolů tmavší, nahoru mírně světlejší
  let k = (0.72 + 0.28 * smooth(0.05, 1.35, y)) * (1 + 0.16 * ny);
  if (name === 'hrudnik') {
    // boky trupu zakrývají paže, nejvíc v podpaží
    k *= 1 - 0.3 * outward * outward * bump(y, 1.0, 1.28, 1.42);
    k *= 1 - 0.3 * outward * smooth(0.12, 0.19, Math.abs(x)) * bump(y, 1.08, 1.3, 1.4);
    // spodní okraj lemu trička
    k *= 1 - 0.3 * Math.max(0, -ny) * smooth(1.05, 0.99, y);
  } else if (name.startsWith('paze') || name.startsWith('predlokti')) {
    k *= 1 - 0.45 * towardBody * smooth(0.95, 1.3, y);
  } else if (name.startsWith('stehno')) {
    k *= 1 - 0.45 * towardBody * smooth(0.5, 0.82, y);
  } else if (name === 'panev') {
    k *= 1 - 0.4 * bump(y, 0.9, 0.955, 0.975);      // stín lemu trička nad páskem
    k *= 1 - 0.4 * Math.max(0, -ny);                 // rozkrok
  } else if (name === 'hlava') {
    if (Math.hypot(x, z) < 0.062) k *= 1 - 0.5 * smooth(1.47, 1.56, y);   // krk pod bradou a vlasy
  }
  return Math.min(1.1, Math.max(0.4, k));
}

/** Ztmaví barvy bodů dílu od indexu first podle characterOcclusion v klidové poloze. */
function bakeOcclusion(p, first, part) {
  for (let i = first; i < p.p.length; i += 3) {
    const k = characterOcclusion(part.name, part.x + p.p[i], part.y + p.p[i + 1], p.p[i + 2], p.n[i], p.n[i + 1], p.n[i + 2]);
    for (let c = 0; c < 3; c++) p.c[i + c] = Math.min(1, p.c[i + c] * k);
  }
}
