// Zaoblené rohy křižovatek a ohybů silnic. Mapová data mají silnice jako lomené čáry, takže
// se vozovky v křižovatce potkávaly v ostrém rohu a obrubník chodníku tam tvořil pravý úhel.
// Teď každý roh mezi dvěma rameny (silnicemi vycházejícími ze společného bodu, nebo dvěma
// úseky jedné silnice v ostrém ohybu) vyplní asfaltový oblouk. Obrubník a chodník ho obejdou.
// Výpočty jsou čisté funkce, testovatelné v Node.

export const CORNER_MIN_ANGLE = 25 * Math.PI / 180;    // ostřejší úhly (nájezdy) se nezaoblují
export const CORNER_MAX_ANGLE = 155 * Math.PI / 180;   // téměř rovné pokračování nepotřebuje oblouk
export const CORNER_MIN_RADIUS = 1.5;                  // menší oblouk nemá smysl (m)
const ARC_STEP = 1.5;                                   // délka úseku oblouku (m)

/** Poloměr oblouku podle šířky obou vozovek (širší ulice = větší oblouk). */
export function cornerRadius(halfWidthA, halfWidthB) {
  return Math.max(4, Math.min(12, 1.3 * (halfWidthA + halfWidthB)));
}

/**
 * Oblouk v rohu mezi dvěma rameny ze společného bodu (x, z). Rameno: směr (dx, dz) jednotkový,
 * hw poloviční šířka vozovky, room dostupná délka ramene. Roh leží proti směru hodinových
 * ručiček od ramene a k ramenu b. Vrací null, když roh nejde zaoblit.
 * Výsledek: apex (průsečík okrajů vozovek), ta, tb (body dotyku), center, radius, arc (body
 * oblouku od ta k tb), sa, sb (vzdálenost dotyku od společného bodu podél ramen).
 */
export function cornerFillet(x, z, a, b, radius) {
  const cross = a.dx * b.dz - a.dz * b.dx, dot = a.dx * b.dx + a.dz * b.dz;
  let angle = Math.atan2(cross, dot);                     // od a k b proti směru hodinových ručiček
  if (angle < 0) angle += 2 * Math.PI;
  if (angle < CORNER_MIN_ANGLE || angle > CORNER_MAX_ANGLE) return null;
  // okraj ramene a na straně rohu (vlevo od a) a okraj ramene b (vpravo od b)
  const na = [-a.dz, a.dx], nb = [b.dz, -b.dx];
  const ax = x + na[0] * a.hw, az = z + na[1] * a.hw, bx = x + nb[0] * b.hw, bz = z + nb[1] * b.hw;
  // průsečík přímek ax + s·a a bx + u·b
  const den = a.dx * b.dz - a.dz * b.dx;
  if (Math.abs(den) < 1e-6) return null;
  const s = ((bx - ax) * b.dz - (bz - az) * b.dx) / den;
  const u = ((bx - ax) * a.dz - (bz - az) * a.dx) / den;
  const px = ax + a.dx * s, pz = az + a.dz * s;
  const half = angle / 2;
  // vzdálenost bodu dotyku od rohu; oblouk se zmenší, aby se vešel na obě ramena
  let r = radius;
  const fit = (room, along) => (room - along) * Math.tan(half);
  r = Math.min(r, fit(a.room, s), fit(b.room, u));
  if (!(r >= CORNER_MIN_RADIUS)) return null;
  const tangent = r / Math.tan(half);
  const ta = [px + a.dx * tangent, pz + a.dz * tangent], tb = [px + b.dx * tangent, pz + b.dz * tangent];
  let bisx = a.dx + b.dx, bisz = a.dz + b.dz;
  const bl = Math.hypot(bisx, bisz);
  bisx /= bl; bisz /= bl;
  const reach = r / Math.sin(half);
  const center = [px + bisx * reach, pz + bisz * reach];
  // oblouk z ta do tb kolem středu, kratší cestou (úhel π − angle)
  const start = Math.atan2(ta[1] - center[1], ta[0] - center[0]);
  let sweep = Math.atan2(tb[1] - center[1], tb[0] - center[0]) - start;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const steps = Math.max(3, Math.ceil(Math.abs(sweep) * r / ARC_STEP));
  const arc = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + sweep * i / steps;
    arc.push([center[0] + Math.cos(t) * r, center[1] + Math.sin(t) * r]);
  }
  arc[0] = ta; arc[steps] = tb;
  return { apex: [px, pz], ta, tb, center, radius: r, arc, sa: s + tangent, sb: u + tangent, angle };
}

/** Plocha asfaltu v rohu: vějíř z rohu přes oblouk (mnohoúhelník apex, ta … tb). */
export function cornerPolygon(fillet) {
  return [fillet.apex, ...fillet.arc];
}

/**
 * Mnohoúhelník asfaltu oblouku pro vykreslení: u obou vozovek zasahuje o d pod jejich pás
 * (stejnolehlost se středem oblouku posune roh a body dotyku o d dovnitř vozovek), aby mezi
 * obloukem a vozovkou nezůstala světlá spára. Vrací [[x, z, pod pásem vozovky], …].
 */
export function cornerOverlap(fillet, d) {
  const [cx, cz] = fillet.center, k = (fillet.radius + d) / fillet.radius;
  const inside = ([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k, true];
  return [inside(fillet.apex), inside(fillet.ta), ...fillet.arc.map(([x, z]) => [x, z, false]), inside(fillet.tb)];
}

/** Leží bod uvnitř mnohoúhelníku (pole [x, z])? Body na hraně se nepočítají přesně. */
export function insidePolygon(points, x, z) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [x1, z1] = points[j], [x2, z2] = points[i];
    if ((z1 > z) !== (z2 > z) && x < (x2 - x1) * (z - z1) / (z2 - z1) + x1) inside = !inside;
  }
  return inside;
}

/** Zmenší mnohoúhelník k jeho těžišti o d metrů (pro testy „uvnitř“ s rezervou na hranách). */
export function shrinkPolygon(points, d) {
  let cx = 0, cz = 0;
  for (const [x, z] of points) { cx += x; cz += z; }
  cx /= points.length; cz /= points.length;
  return points.map(([x, z]) => {
    const l = Math.hypot(x - cx, z - cz) || 1;
    const k = Math.max(0, l - d) / l;
    return [cx + (x - cx) * k, cz + (z - cz) * k];
  });
}

/** Protíná úsečka p–q úsečku a–b? */
function segmentsCross(px, pz, qx, qz, ax, az, bx, bz) {
  const d1 = (bx - ax) * (pz - az) - (bz - az) * (px - ax);
  const d2 = (bx - ax) * (qz - az) - (bz - az) * (qx - ax);
  const d3 = (qx - px) * (az - pz) - (qz - pz) * (ax - px);
  const d4 = (qx - px) * (bz - pz) - (qz - pz) * (bx - px);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/**
 * Najde rohy ve všech uzlech silniční sítě. world: rCount, rOff, rpx, rpz, r.w;
 * usable(road) → bool (které silnice se zaoblují), walls(x0, z0, x1, z1, visit) hrany stěn domů,
 * skip(x, z) → bool (místa s ruční úpravou), roads(x, z, a, b) → bool (bod leží na vozovce jiné
 * silnice než a, b; oblouk se pak zmenší, třeba v malém ostrůvku mezi třemi silnicemi). Vrací pole rohů s ramenem a i b:
 * { node: [x, z], a: arm, b: arm, ...cornerFillet }. Rameno: road, p = bod uzlu, dir = +1 ve směru
 * silnice, −1 proti ní, segs = úseky silnice od uzlu, dx, dz = směr, hw.
 */
export function findCorners(world, usable, walls = null, skip = null, roads = null) {
  const { rCount, rOff, rpx, rpz } = world;
  const nodes = new Map();
  const key = (p) => `${Math.round(rpx[p] * 10)},${Math.round(rpz[p] * 10)}`;
  for (let road = 0; road < rCount; road++) {
    if (!usable(road)) continue;
    const first = rOff[road], last = rOff[road + 1] - 1;
    for (let p = first; p <= last; p++) {
      const id = key(p);
      if (!nodes.has(id)) nodes.set(id, { x: rpx[p], z: rpz[p], arms: [], roads: new Set() });
      const node = nodes.get(id);
      node.roads.add(road);
      if (p < last) node.arms.push({ road, p, dir: +1 });
      if (p > first) node.arms.push({ road, p, dir: -1 });
    }
  }
  // křižovatka = uzel s více silnicemi nebo s více než dvěma rameny
  const junction = (id) => { const node = nodes.get(id); return node && (node.roads.size > 1 || node.arms.length > 2); };
  const corners = [];
  for (const node of nodes.values()) {
    if (node.arms.length < 2) continue;
    if (skip?.(node.x, node.z)) continue;
    const arms = [];
    for (const arm of node.arms) {
      const measured = measureArm(world, arm, junction, key);
      if (measured) arms.push(measured);
    }
    arms.sort((p, q) => p.angle - q.angle);
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i], b = arms[(i + 1) % arms.length];
      if (arms.length < 2 || a === b) continue;
      let radius = cornerRadius(a.hw, b.hw), fillet = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        fillet = cornerFillet(node.x, node.z, a, b, radius);
        if (!fillet) break;
        const free = !roads || ![fillet.center, ...fillet.arc].some(([x, z]) => roads(x, z, a.road, b.road));
        if (free && (!walls || cornerClear(fillet, walls))) break;
        radius = fillet.radius * 0.65;
        fillet = null;
      }
      if (!fillet) continue;
      const arm = (q) => ({ road: q.road, p: q.p, dir: q.dir, segs: q.segs, dx: q.dx, dz: q.dz, hw: q.hw });
      corners.push({ node: [node.x, node.z], a: arm(a), b: arm(b), ...fillet });
    }
  }
  return corners;
}

const ARM_REACH = 20;          // jak daleko od uzlu se měří směr ramene (m)
const ARM_BEND = 0.8;          // větší odchylka silnice od přímky ukončí rovnou část ramene (m)

/**
 * Změří rameno: směr k bodu ARM_REACH po silnici (nebo k další křižovatce, k ohybu, ke konci),
 * dostupnou délku pro oblouk a seznam úseků. Krátké mapové úseky u křižovatek se tak sloučí.
 */
export function measureArm(world, arm, junction = null, key = null) {
  const { rpx, rpz, rOff } = world;
  const first = rOff[arm.road], last = rOff[arm.road + 1] - 1;
  const x0 = rpx[arm.p], z0 = rpz[arm.p];
  const points = [[x0, z0]], segs = [];
  let p = arm.p, length = 0, stop = false, atJunction = false;
  while (!stop) {
    const q = p + arm.dir;
    if (q < first || q > last) break;
    const seg = Math.hypot(rpx[q] - rpx[p], rpz[q] - rpz[p]);
    segs.push(arm.dir > 0 ? p : q);
    let x = rpx[q], z = rpz[q];
    if (length + seg >= ARM_REACH) {
      const t = (ARM_REACH - length) / seg;
      x = rpx[p] + (rpx[q] - rpx[p]) * t; z = rpz[p] + (rpz[q] - rpz[p]) * t;
      stop = true;
    }
    length = Math.min(ARM_REACH, length + seg);
    // rovná část končí, když se silnice od spojnice odchýlí
    const cx = x - x0, cz = z - z0, cl = Math.hypot(cx, cz);
    if (cl > 0.5 && points.some(([px, pz]) => Math.abs((px - x0) * cz - (pz - z0) * cx) / cl > ARM_BEND)) break;
    points.push([x, z]);
    p = q;
    if (!stop && junction && key && junction(key(q))) { atJunction = true; break; }
  }
  const [ex, ez] = points.at(-1);
  const chord = Math.hypot(ex - x0, ez - z0);
  if (chord < 0.5) return null;
  const dx = (ex - x0) / chord, dz = (ez - z0) / chord;
  // u další křižovatky zbude místo i pro její oblouk
  const room = Math.min(40, chord * (atJunction ? 0.45 : 0.85));
  return { road: arm.road, p: arm.p, dir: arm.dir, segs, dx, dz, hw: world.r.w[arm.road] / 2, room, angle: Math.atan2(dz, dx) };
}

/** Nezasahuje plocha oblouku do domu? */
export function cornerClear(fillet, walls) {
  const polygon = cornerPolygon(fillet);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of polygon) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
  let clear = true;
  walls(x0, z0, x1, z1, (ax, az, bx, bz) => {
    if (!clear) return;
    if (insidePolygon(polygon, ax, az) || insidePolygon(polygon, bx, bz)) { clear = false; return; }
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (segmentsCross(polygon[j][0], polygon[j][1], polygon[i][0], polygon[i][1], ax, az, bx, bz)) { clear = false; return; }
    }
  });
  return clear;
}

/**
 * Staničení bodu dotyku na rameni: úsek k a poloha t na něm (0 = začátek úseku ve směru
 * silnice), along = vzdálenost od uzlu po silnici. Strana chodníku silnice: +1 vlevo od směru
 * silnice, −1 vpravo (jako sidewalks.js); roh leží vlevo od ramene a (cornerSide = +1),
 * vpravo od ramene b (cornerSide = −1).
 */
export function armCut(world, arm, along, cornerSide) {
  let rest = along, k = arm.segs[0], t = arm.dir > 0 ? 0 : 1;
  for (const seg of arm.segs) {
    const length = Math.hypot(world.rpx[seg + 1] - world.rpx[seg], world.rpz[seg + 1] - world.rpz[seg]);
    k = seg;
    if (rest <= length || seg === arm.segs.at(-1)) {
      const f = length ? Math.min(1, rest / length) : 0;
      t = arm.dir > 0 ? f : 1 - f;
      break;
    }
    rest -= length;
  }
  return { k, t: Math.max(0, Math.min(1, t)), side: cornerSide * arm.dir };
}
