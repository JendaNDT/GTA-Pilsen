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
 * Vrací { start (Int32Array, −1 = bez profilu), count (Int32Array), heights (Float32Array), step }.
 */
export function buildRoadGrades(world, include, pinned, baseHeight, step = GRADE_STEP, keep = null) {
  const { rCount, rOff, rpx, rpz, rpy } = world;
  const start = new Int32Array(rCount).fill(-1), count = new Int32Array(rCount);
  const station = new Float64Array(rpx.length);
  const raw = [];
  const keptSamples = new Map();
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
    if (keep) {
      const kept = [];
      p = a;
      for (let i = 0; i < n; i++) {
        const s = Math.min(length, i * step);
        while (p < b - 2 && station[p + 1] < s) p++;
        const seg = station[p + 1] - station[p];
        const t = seg > 0 ? (s - station[p]) / seg : 0;
        if (keep(rpx[p] + (rpx[p + 1] - rpx[p]) * t, rpz[p] + (rpz[p + 1] - rpz[p]) * t)) kept.push([s, samples[i]]);
      }
      if (kept.length) keptSamples.set(road, kept);
    }
    start[road] = total; count[road] = n; total += n;
  }
  // Společné body (křižovatky, napojení na mosty): stejná výška pro všechny silnice.
  const key = (p) => `${Math.round(rpx[p] * 10)},${Math.round(rpz[p] * 10)}`;
  const nodes = new Map();
  for (let road = 0; road < rCount; road++) {
    const a = rOff[road], b = rOff[road + 1];
    const isPinned = pinned(road);
    if (!raw[road] && !isPinned) continue;
    for (let p = a; p < b; p++) {
      // u mostů a tunelů rozhoduje jen výška jejich konců
      if (isPinned && p !== a && p !== b - 1) continue;
      const k = key(p);
      if (!nodes.has(k)) nodes.set(k, []);
      nodes.get(k).push([road, p]);
    }
  }
  const constraints = new Map();
  for (const members of nodes.values()) {
    if (members.length < 2) continue;
    const fixed = members.filter(([road]) => pinned(road));
    let target;
    if (fixed.length) target = Math.max(...fixed.map(([, p]) => rpy[p]));
    else {
      target = 0;
      for (const [road, p] of members) target += profileAt(raw[road], 0, raw[road].length, station[p], step);
      target /= members.length;
    }
    for (const [road, p] of members) {
      if (!raw[road]) continue;
      const here = profileAt(raw[road], 0, raw[road].length, station[p], step);
      // neobvyklý skok (rampa k mostu, jiná úroveň): silnice zůstane na terénu
      if (Math.abs(target - here) > (fixed.length ? 0.4 : 2)) continue;
      if (!constraints.has(road)) constraints.set(road, []);
      constraints.get(road).push([station[p], target]);
    }
  }
  const heights = new Float32Array(total);
  for (let road = 0; road < rCount; road++) {
    if (!raw[road]) continue;
    const pins = [...(constraints.get(road) ?? []), ...(keptSamples.get(road) ?? [])];
    const pinnedProfile = pinProfile(raw[road], step, pins);
    heights.set(pinnedProfile, start[road]);
  }
  return { start, count, heights, step, station };
}
