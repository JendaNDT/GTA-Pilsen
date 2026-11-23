// Stylizovaná postava (hráč i chodci): zaoblené tělo z vlastních tvarů místo kvádrů. Každý díl
// leží ve stejném kvádru jako díl fyzikální postavy (physics/ragdoll.js), takže pády a nárazy
// pracují beze změny. Díl se staví kolem svého středu (0, 0, 0); předek postavy míří na +z.
// Původní kvádrovou postavu vrátí adresa ?postava=puvodni.

const search = globalThis.location?.search ?? '';
export const ORIGINAL_CHARACTER = new URLSearchParams(search).get('postava') === 'puvodni';

export const HAIR_STYLES = ['krátké', 'dlouhé', 'drdol', 'nakrátko'];

/**
 * Plášť kolem svislé osy: prstence { y, rx, rz, z } zdola nahoru, seg úseků po obvodu.
 * Normály jsou hladké (zaoblený vzhled), volitelná dna uzavřou tvar.
 */
export function loft(p, rings, seg, color, { bottom = false, top = false } = {}) {
  const at = (ring, a) => [Math.cos(a) * ring.rx, ring.y, (ring.z ?? 0) + Math.sin(a) * ring.rz];
  const normal = (k, a) => {
    const ring = rings[k], below = rings[Math.max(0, k - 1)], above = rings[Math.min(rings.length - 1, k + 1)];
    const dy = above.y - below.y || 1e-6;
    const dr = ((above.rx + above.rz) - (below.rx + below.rz)) / 2;
    let nx = Math.cos(a) / Math.max(ring.rx, 1e-4), nz = Math.sin(a) / Math.max(ring.rz, 1e-4);
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
    const centre = [0, ring.y, ring.z ?? 0];
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
  // posun do strany: plášť se staví kolem osy x = 0, proto se body posunou dodatečně
  const start = p.p.length;
  loft(p, rings, seg, color, { bottom: from > -1, top: to < 1 });
  const cos = Math.cos(tilt), sin = Math.sin(tilt);
  for (let i = start; i < p.p.length; i += 3) {
    p.p[i] += cx;
    if (!tilt) continue;
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

/**
 * Přidá do p geometrii jednoho dílu stylizované postavy. part = díl z physics/ragdoll.js,
 * look = { skin, hair, shirt, pants, shoes, sole, hairStyle, style } (barvy v lineárním RGB),
 * style: 0 krátký rukáv, 1 košile s légou, 2 batoh, 3 kšiltovka.
 */
// Ramena fyzikální postavy jsou 0,3 m od osy těla, paže se proto kreslí o něco blíž k trupu,
// aby mezi nimi nezůstala mezera. Kloub, kolem kterého se paže otáčí, se nemění.
export const ARM_INSET = 0.045;

export function stylizedPart(p, part, look) {
  const name = part.name, h = part.size[1] / 2;
  const inward = -Math.sign(part.x) * ARM_INSET;   // posun paže a předloktí k tělu
  const { skin, hair, shirt, pants, shoes, sole, hairStyle, style } = look;
  if (name === 'panev') {
    // pánev s páskem; spodní okraj navazuje na stehna
    loft(p, [{ y: -h, rx: 0.165, rz: 0.104 }, { y: -0.02, rx: 0.178, rz: 0.114 }, { y: 0.05, rx: 0.17, rz: 0.108 }], 12, pants, { bottom: true });
    loft(p, [{ y: 0.05, rx: 0.174, rz: 0.111 }, { y: h, rx: 0.168, rz: 0.107 }], 12, shade(pants, 0.45), { top: true });
    p.box(0.045, 0.03, 0.01, 0, 0.07, 0.112, [0.55, 0.5, 0.35]);   // přezka
  } else if (name === 'hrudnik') {
    // trup: pas, hrudník, široká ramena a svažující se ramena ke krku
    loft(p, [
      { y: -h, rx: 0.165, rz: 0.108 }, { y: -0.12, rx: 0.172, rz: 0.114 }, { y: 0.02, rx: 0.195, rz: 0.13, z: 0.008 },
      { y: 0.12, rx: 0.212, rz: 0.124 }, { y: 0.18, rx: 0.2, rz: 0.11 }, { y: h, rx: 0.11, rz: 0.08 },
    ], 12, shirt, { top: true });
    for (const side of [1, -1]) ellipsoid(p, side * 0.185, 0.125, 0, 0.06, 0.06, 0.064, shirt, 6, -0.6, 0.9);
    loft(p, [{ y: h - 0.03, rx: 0.065, rz: 0.06 }, { y: h + 0.012, rx: 0.07, rz: 0.064 }], 10, shade(shirt, 0.85), { top: true });
    if (style === 1) p.box(0.045, 0.36, 0.012, 0, -0.02, 0.128, shade(shirt, 0.82));   // léga košile
    if (style === 2) {
      p.box(0.32, 0.34, 0.12, 0, -0.01, -0.165, [0.12, 0.18, 0.2], 0.94, 0.9);        // batoh
      for (const side of [1, -1]) p.box(0.035, 0.34, 0.015, side * 0.11, 0.02, 0.118, [0.1, 0.14, 0.16]);
    }
  } else if (name === 'hlava') {
    const cy = 0.04, rx = 0.104, ry = 0.13, rz = 0.118;
    limb(p, -h, -0.05, 0.05, 0.047, skin, 8);                          // krk
    ellipsoid(p, 0, cy, 0.004, rx, ry, rz, skin, 12);                  // hlava
    // obličej: oči, obočí, nos, ústa, uši
    for (const side of [1, -1]) {
      p.box(0.022, 0.026, 0.012, side * 0.038, cy + 0.018, rz * 0.93, [0.04, 0.04, 0.05]);
      p.box(0.034, 0.01, 0.012, side * 0.039, cy + 0.048, rz * 0.9, shade(hair, 0.9));
      p.box(0.014, 0.04, 0.028, side * rx * 0.98, cy + 0.005, -0.004, shade(skin, 0.93));
    }
    p.box(0.022, 0.034, 0.028, 0, cy - 0.006, rz * 0.98, shade(skin, 0.94), 0.8, 1, 0.008);
    p.box(0.036, 0.008, 0.01, 0, cy - 0.05, rz * 0.86, [0.42, 0.16, 0.14]);
    // vlasy
    // vlasy: čepička nakloněná dozadu, takže čelo zůstane volné a týl je zakrytý
    if (hairStyle === 3) ellipsoid(p, 0, cy + 0.004, -0.004, rx * 1.03, ry * 1.02, rz * 1.03, shade(hair, 1.05), 12, 0.3, 1, 0.45);
    else {
      ellipsoid(p, 0, cy + 0.006, -0.006, rx * 1.08, ry * 1.06, rz * 1.08, hair, 12, 0.05, 1, 0.55);
      if (hairStyle === 1) {
        p.box(rx * 1.9, 0.2, 0.05, 0, cy - 0.07, -rz * 0.86, hair, 1.06, 1);    // dlouhé vlasy na záda
        for (const side of [1, -1]) p.box(0.026, 0.15, 0.1, side * rx * 1.0, cy - 0.04, -0.045, hair);
      }
      if (hairStyle === 2) ellipsoid(p, 0, cy + 0.075, -rz * 1.02, 0.048, 0.048, 0.048, hair, 6);   // drdol
    }
    if (style === 3) {
      ellipsoid(p, 0, cy + 0.03, -0.004, rx * 1.12, ry * 0.95, rz * 1.1, shirt, 12, 0.3, 1);
      p.box(0.17, 0.014, 0.1, 0, cy + 0.055, rz * 1.18, shade(shirt, 0.8));          // kšilt
    }
  } else if (name.startsWith('paze')) {
    // paže od ramene k lokti; u krátkého rukávu je dolní část holá
    const start = p.p.length;
    if (style === 0) {
      limb(p, 0.0, h, 0.06, 0.066, shirt, 8, 1.05, 0, { top: true });
      limb(p, -h, 0.0, 0.047, 0.052, skin, 8, 1.05, 0, { bottom: true });
    } else limb(p, -h, h, 0.052, 0.066, shirt, 8, 1.05, 0, { top: true, bottom: true });
    shiftX(p, start, inward);
  } else if (name.startsWith('predlokti')) {
    // předloktí od lokte k zápěstí, kloub lokte a dlaň
    const start = p.p.length, sleeve = style === 0 ? skin : shirt;
    limb(p, -0.1, h, 0.039, 0.05, sleeve, 8, 1.05, 0, { bottom: true, top: true });
    ellipsoid(p, 0, h, 0, 0.05, 0.05, 0.052, sleeve, 6);                              // loket
    if (style !== 0) limb(p, -0.115, -0.085, 0.043, 0.043, shade(shirt, 0.85), 8);  // manžeta
    p.box(0.035, 0.09, 0.07, 0, -0.155, 0.006, skin, 0.85, 0.85);
    p.box(0.03, 0.04, 0.03, 0, -0.125, 0.045, skin);                                // palec
    shiftX(p, start, inward);
  } else if (name.startsWith('stehno')) {
    limb(p, -h, h, 0.068, 0.092, pants, 8, 1.06, 0, { top: true });
  } else if (name.startsWith('lytko')) {
    ellipsoid(p, 0, h, 0, 0.068, 0.062, 0.072, pants, 6);                            // koleno
    loft(p, [{ y: -0.14, rx: 0.05, rz: 0.054 }, { y: 0.06, rx: 0.065, rz: 0.071, z: -0.008 }, { y: h, rx: 0.069, rz: 0.072 }], 8, pants, { top: true });
    // bota: svršek a podrážka, špička dopředu
    p.box(0.1, 0.075, 0.25, 0, -0.185, 0.045, shoes, 0.9, 0.72, -0.03);
    p.box(0.106, 0.022, 0.262, 0, -0.226, 0.045, sole);
  }
  return p;
}
