// Hladký podélný profil silnic. Dřív silnice kopírovala trojúhelníky terénu po 8 m,
// takže auto i vykreslená vozovka dostávaly v každém zlomu terénu ráz a terén
// místy prorůstal asfaltem. Profil vzniká z výšek terénu v ose silnice, vyhlazuje se
// po trase a v křižovatkách a u mostů navazuje na společnou výšku.
// Všechny výpočty jsou čisté funkce nad poli, testovatelné v Node.

export const GRADE_STEP = 2;            // rozteč vzorků profilu po trase (m)
export const GRADE_SMOOTH = 7;          // šířka klouzavého průměru ve vzorcích (3 průchody ≈ σ 7 m)
export const CORRIDOR_MARGIN = 0.5;     // pás za okrajem vozovky, který leží přesně na profilu (m)
export const CORRIDOR_FALLOFF = 3.5;    // plynulý přechod do původního terénu (m)
export const PIN_REACH = 40;            // jak daleko od křižovatky sahá oprava výšky (m)
export const GRADE_TAPER = 15;          // přechod profilu do původního terénu u chráněných míst a volných konců (m)
export const KEEP_MARGIN = 10;          // kolik silnice za ručně doladěným místem zůstane také beze změny (m)
export const STRIP_LIFT = 0.05;         // pás jízdního povrchu leží jako vykreslený asfalt nad terénem (m)
export const STRIP_RAMP = 6;            // na začátku pásu se zvedá z terénu plynule (m)

/**
 * Klouzavý průměr; tři průchody dají téměř Gaussovo vyhlazení. Za konci se profil prodlužuje
 * se stejným sklonem (středová souměrnost), takže stoupání u křižovatky se nezploští.
 */
export function smoothProfile(values, width = GRADE_SMOOTH, passes = 3) {
  let a = Float64Array.from(values);
  const n = a.length, half = Math.floor(width / 2);
  if (n < 3 || half < 1) return a;
  const at = (arr, i) => {
    if (i < 0) return 2 * arr[0] - arr[Math.min(n - 1, -i)];
    if (i >= n) return 2 * arr[n - 1] - arr[Math.max(0, 2 * n - 2 - i)];
    return arr[i];
  };
  for (let p = 0; p < passes; p++) {
    const b = new Float64Array(n);
    let sum = 0;
    for (let j = -half; j <= half; j++) sum += at(a, j);
    for (let i = 0; i < n; i++) {
      b[i] = sum / (2 * half + 1);
      sum += at(a, i + half + 1) - at(a, i - half);
    }
    a = b;
  }
  return a;
}

/**
 * Doladí profil, aby v daných staničeních měl zadanou výšku (křižovatky, mosty).
 * Mezi dvěma body se oprava mění lineárně, za krajními body plynule odezní.
 * constraints = [[staničení, cílová výška], ...]
 */
export function pinProfile(heights, step, constraints, reach = PIN_REACH) {
  if (!constraints.length) return heights;
  const out = Float64Array.from(heights);
  const n = out.length;
  const value = (s) => {
    const f = Math.max(0, Math.min(n - 1, s / step)), i = Math.min(n - 2, Math.floor(f));
    return n < 2 ? heights[0] : heights[i] + (heights[i + 1] - heights[i]) * (f - i);
  };
  const pins = constraints.map(([s, y]) => [s, y - value(s)]).sort((a, b) => a[0] - b[0]);
  const fade = (d) => {
    const t = Math.max(0, Math.min(1, 1 - d / reach));
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < n; i++) {
    const s = i * step;
    let delta;
    if (s <= pins[0][0]) delta = pins[0][1] * fade(pins[0][0] - s);
    else if (s >= pins.at(-1)[0]) delta = pins.at(-1)[1] * fade(s - pins.at(-1)[0]);
    else {
      let k = 0;
      while (pins[k + 1][0] < s) k++;
      const [s0, d0] = pins[k], [s1, d1] = pins[k + 1];
      delta = s1 > s0 ? d0 + (d1 - d0) * (s - s0) / (s1 - s0) : d0;
    }
    out[i] += delta;
  }
  return out;
}

/** Výška profilu v daném staničení (lineárně mezi vzorky po GRADE_STEP m). */
export function profileAt(heights, start, count, station, step = GRADE_STEP) {
  const f = Math.max(0, Math.min(count - 1, station / step));
  const i = Math.min(count - 2, Math.floor(f));
  if (count < 2) return heights[start];
  const a = heights[start + i], b = heights[start + i + 1];
  return a + (b - a) * (f - i);
}

/**
 * Výška profilu silnice ve staničení, nebo NaN, pokud silnice profil nemá nebo úsek leží
 * v ručně doladěném místě (tam dál platí původní terén).
 */
export function gradeHeight(grade, road, station) {
  const start = grade.start[road];
  if (start < 0) return NaN;
  const count = grade.count[road], step = grade.step;
  const f = Math.max(0, Math.min(count - 1, station / step));
  const i = Math.min(count - 2, Math.floor(f));
  if (grade.kept[start + i] || grade.kept[start + i + 1]) return NaN;
  return profileAt(grade.heights, start, count, station, step);
}

/**
 * Váha profilu ve staničení: 1 = silnice leží na profilu, 0 = kopíruje původní terén.
 * Do GRADE_TAPER od chráněného místa nebo od volného konce se úprava terénu podle profilu
 * plynule ztrácí a vozovka tam leží na takto upraveném terénu.
 */
export function gradeBlend(grade, road, station) {
  const t = Math.min(1, gradeReach(grade, road, station) / GRADE_TAPER);
  return t * t * (3 - 2 * t);
}

/** Vzdálenost po silnici k nejbližšímu chráněnému místu nebo nenapojenému konci (m). */
export function gradeReach(grade, road, station) {
  const start = grade.start[road];
  if (start < 0) return 0;
  const count = grade.count[road];
  const f = Math.max(0, Math.min(count - 1, station / grade.step));
  const i = Math.min(count - 2, Math.floor(f));
  const a = grade.reach[start + i], b = grade.reach[start + i + 1];
  return a + (b - a) * (f - i);
}

/**
 * Výška pásu jízdního povrchu nad profilem: STRIP_LIFT, na začátku pásu a u napojení na mostovku
 * plynule od nuly, aby kola nenarazila na schod.
 */
export function stripLift(grade, road, station) {
  const start = grade.start[road];
  if (start < 0) return 0;
  const count = grade.count[road];
  const f = Math.max(0, Math.min(count - 1, station / grade.step));
  const i = Math.min(count - 2, Math.floor(f));
  const rise = grade.rise[start + i] + (grade.rise[start + i + 1] - grade.rise[start + i]) * (f - i);
  return STRIP_LIFT * Math.max(0, Math.min(1, rise / STRIP_RAMP));
}

/** Výška povrchu silnice: profil s plnou vahou, jinak terén ground (přechod nese terén). */
export function gradeSurface(grade, road, station, ground) {
  const y = gradeHeight(grade, road, station);
  if (y !== y) return ground;
  return gradeBlend(grade, road, station) >= 1 ? y : ground;
}

/** Váha pásu kolem osy: 1 na vozovce a krajnici, potom plynule k nule. */
export function corridorWeight(distance, halfWidth, margin = CORRIDOR_MARGIN, falloff = CORRIDOR_FALLOFF) {
  const inner = halfWidth + margin;
  if (distance <= inner) return 1;
  if (distance >= inner + falloff) return 0;
  return 0.5 * (1 + Math.cos(Math.PI * (distance - inner) / falloff));
}

/**
 * Profily všech zahrnutých silnic.
 * world: rCount, rOff, rpx, rpz, rpy; include(road) → bool; pinned(road) → bool (mosty, tunely);
 * baseHeight(x, z) → výška terénu bez úprav silnic.
 * keep(x, z) → 0/1/2: ručně doladěné místo, kde profil kopíruje původní terén a nenapojuje se
 * (2 = i KEEP_MARGIN za ním); foreign(road) → bool: sjízdná silnice bez profilu, ke které
 * navazující silnice přejdou do terénu.
 * Vrací { start (Int32Array, −1 = bez profilu), count (Int32Array), heights (Float32Array),
 * kept (Uint8Array, 1 = vzorek v ručně doladěném místě), reach (Float32Array, vzdálenost
 * k chráněnému místu nebo nenapojenému konci), rise (Float32Array, vzdálenost od začátku pásu
 * nebo od napojení na mostovku), junctions ({ p: bod, roads, dirs: směry silnic z bodu }), step, station }.
 */
export function buildRoadGrades(world, include, pinned, baseHeight, step = GRADE_STEP, keep = null, foreign = null) {
  const { rCount, rOff, rpx, rpz, rpy } = world;
  const start = new Int32Array(rCount).fill(-1), count = new Int32Array(rCount);
  const station = new Float64Array(rpx.length);
  const raw = [];
  const keptSamples = new Map(), keptIndices = new Map(), keptFlags = new Map();
  let total = 0;
  for (let road = 0; road < rCount; road++) {
    const a = rOff[road], b = rOff[road + 1];
    for (let p = a + 1; p < b; p++) station[p] = station[p - 1] + Math.hypot(rpx[p] - rpx[p - 1], rpz[p] - rpz[p - 1]);
    if (a < b) station[a] = 0;
    if (!include(road) || b - a < 2) continue;
    const length = station[b - 1];
    const n = Math.max(2, Math.round(length / step) + 1);
    const samples = new Float64Array(n);
    let p = a;
    for (let i = 0; i < n; i++) {
      const s = Math.min(length, i * step);
      while (p < b - 2 && station[p + 1] < s) p++;
      const seg = station[p + 1] - station[p];
      const t = seg > 0 ? (s - station[p]) / seg : 0;
      samples[i] = baseHeight(rpx[p] + (rpx[p + 1] - rpx[p]) * t, rpz[p] + (rpz[p + 1] - rpz[p]) * t);
    }
    raw[road] = smoothProfile(samples);
    // Ručně doladěný terén (podjezdy, nájezdy, rampy) zůstává beze změny.
    // Ještě KEEP_MARGIN za ním silnice kopíruje terén, teprve potom začíná přechod.
    if (keep) {
      const flags = new Uint8Array(n);
      let any = false;
      p = a;
      for (let i = 0; i < n; i++) {
        const s = Math.min(length, i * step);
        while (p < b - 2 && station[p + 1] < s) p++;
        const seg = station[p + 1] - station[p];
        const t = seg > 0 ? (s - station[p]) / seg : 0;
        flags[i] = keep(rpx[p] + (rpx[p + 1] - rpx[p]) * t, rpz[p] + (rpz[p + 1] - rpz[p]) * t);
        if (flags[i]) any = true;
      }
      if (any) {
        const margin = Math.round(KEEP_MARGIN / step), grown = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
          if (!flags[i]) continue;
          const reach = flags[i] > 1 ? margin : 0;
          for (let j = Math.max(0, i - reach); j <= Math.min(n - 1, i + reach); j++) grown[j] = 1;
        }
        const kept = [], indices = [];
        for (let i = 0; i < n; i++) if (grown[i]) { kept.push([Math.min(length, i * step), samples[i]]); indices.push(i); }
        keptSamples.set(road, kept); keptIndices.set(road, indices); keptFlags.set(road, grown);
      }
    }
    start[road] = total; count[road] = n; total += n;
  }
  // Společné body (křižovatky, napojení na mosty): stejná výška pro všechny silnice.
  const key = (p) => `${Math.round(rpx[p] * 10)},${Math.round(rpz[p] * 10)}`;
  const nodes = new Map();
  for (let road = 0; road < rCount; road++) {
    const a = rOff[road], b = rOff[road + 1];
    const isPinned = pinned(road);
    if (!raw[road] && !isPinned && !foreign?.(road)) continue;
    for (let p = a; p < b; p++) {
      // u mostů a tunelů rozhoduje jen výška jejich konců
      if (isPinned && p !== a && p !== b - 1) continue;
      const k = key(p);
      if (!nodes.has(k)) nodes.set(k, []);
      nodes.get(k).push([road, p]);
    }
  }
  const constraints = new Map();
  // Konec, který se nedá napojit (jiná výška, silnice bez profilu), přejde plynule do terénu.
  const startFree = new Uint8Array(rCount), endFree = new Uint8Array(rCount);
  const joints = new Map();          // silnice → staničení napojení na mostovku
  // Křižovatky (ne pouhé pokračování jedné silnice druhou): [bod, silnice…] pro společnou výšku.
  const junctions = [];
  const heading = (road, p) => {
    const q = p === rOff[road] ? p + 1 : p - 1;
    const dx = rpx[q] - rpx[p], dz = rpz[q] - rpz[p], l = Math.hypot(dx, dz) || 1;
    return [dx / l, dz / l];
  };
  const free = (road, p) => {
    if (p === rOff[road]) startFree[road] = 1;
    if (p === rOff[road + 1] - 1) endFree[road] = 1;
  };
  for (const members of nodes.values()) {
    if (members.length < 2) continue;
    // V ručně doladěném místě (konec mostu, podjezd) a těsně za ním zůstává původní napojení.
    if (keep && keep(rpx[members[0][1]], rpz[members[0][1]])) continue;
    if (members.some(([road, p]) => keptFlags.get(road)?.[Math.min(count[road] - 1, Math.round(station[p] / step))])) continue;
    if (foreign && members.some(([road]) => !raw[road] && !pinned(road))) {
      for (const [road, p] of members) if (raw[road]) free(road, p);
      continue;
    }
    const fixed = members.filter(([road]) => pinned(road));
    let target;
    if (fixed.length) target = Math.max(...fixed.map(([, p]) => rpy[p]));
    else {
      target = 0;
      for (const [road, p] of members) target += profileAt(raw[road], 0, raw[road].length, station[p], step);
      target /= members.length;
    }
    const linked = [];
    for (const [road, p] of members) {
      if (!raw[road]) continue;
      const here = profileAt(raw[road], 0, raw[road].length, station[p], step);
      // neobvyklý skok (rampa k mostu, jiná úroveň): silnice zůstane na terénu
      if (Math.abs(target - here) > (fixed.length ? 0.4 : 2)) { free(road, p); continue; }
      linked.push([road, p]);
      if (!constraints.has(road)) constraints.set(road, []);
      constraints.get(road).push([station[p], target]);
      if (fixed.length) {
        if (!joints.has(road)) joints.set(road, []);
        joints.get(road).push(station[p]);
      }
    }
    if (!fixed.length && linked.length >= 2) {
      const ends = linked.every(([road, p]) => p === rOff[road] || p === rOff[road + 1] - 1);
      let through = false;
      if (linked.length === 2 && ends) {
        // dvě silnice na sebe navazují téměř v přímce: to není křižovatka
        const [a, b] = linked.map(([road, p]) => heading(road, p));
        through = a[0] * b[0] + a[1] * b[1] < -0.9;
      }
      if (!through) junctions.push({ p: linked[0][1], roads: linked.map(([road]) => road), dirs: linked.map(([road, p]) => heading(road, p)) });
    }
  }
  const heights = new Float32Array(total), kept = new Uint8Array(total), reach = new Float32Array(total);
  const rise = new Float32Array(total);
  for (let road = 0; road < rCount; road++) {
    if (!raw[road]) continue;
    const pins = [...(constraints.get(road) ?? []), ...(keptSamples.get(road) ?? [])];
    const pinnedProfile = pinProfile(raw[road], step, pins);
    heights.set(pinnedProfile, start[road]);
    // Vzdálenost k nejbližšímu chráněnému vzorku nebo nenapojenému konci určí váhu profilu.
    // Slepý konec se nenapojuje na nic a zůstává na profilu.
    const n = count[road], distance = new Float64Array(n).fill(Infinity);
    for (const i of keptIndices.get(road) ?? []) { kept[start[road] + i] = 1; distance[i] = 0; }
    if (startFree[road]) distance[0] = 0;
    if (endFree[road]) distance[n - 1] = 0;
    for (let i = 1; i < n; i++) distance[i] = Math.min(distance[i], distance[i - 1] + step);
    for (let i = n - 2; i >= 0; i--) distance[i] = Math.min(distance[i], distance[i + 1] + step);
    for (let i = 0; i < n; i++) reach[start[road] + i] = Math.min(1e4, distance[i]);
    // Pás začíná za přechodem (reach = GRADE_TAPER) a u mostovky; odtud se zvedá.
    const up = new Float64Array(n).fill(Infinity);
    for (const s of joints.get(road) ?? []) up[Math.max(0, Math.min(n - 1, Math.round(s / step)))] = 0;
    for (let i = 1; i < n; i++) up[i] = Math.min(up[i], up[i - 1] + step);
    for (let i = n - 2; i >= 0; i--) up[i] = Math.min(up[i], up[i + 1] + step);
    for (let i = 0; i < n; i++) rise[start[road] + i] = Math.min(1e4, up[i], Math.max(0, distance[i] - GRADE_TAPER));
  }
  return { start, count, heights, kept, reach, rise, junctions, step, station };
}
