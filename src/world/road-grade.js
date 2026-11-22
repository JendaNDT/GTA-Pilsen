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
export const CROSS_TERRAIN = 0.04;      // největší příčný sklon podle svahu (4 %)
export const CROSS_BANK = 0.06;         // největší klopení v zatáčce (6 %)
export const CROSS_MAX = 0.07;          // největší příčný sklon celkem (7 %)
export const BANK_FACTOR = 10;          // klopení = křivost · tento součinitel (m), odpovídá ~40 km/h
export const BANK_CLEAR = 15;           // klopení u křižovatek a konců plynule mizí (m)
const CROSS_STEP = 8;                   // svah vedle silnice se měří po 8 m
export const BANK_BUILT = 6;            // dům blíž než tolik za okrajem silnice: zatáčka se neklopí (m)
export const SHORE_WATER = 8;           // nábřeží: voda nejvýš tolik za okrajem vozovky (m)
export const SHORE_FADE = 4;            // … a dál se zvednutí plynule ztrácí (m)
export const SHORE_REACH = 8;           // terasa nad nábřežní zdí nejvýš tolik za okrajem (jedna buňka modelu, m)
export const SHORE_PLATEAU = 6;         // za terasou terén aspoň tolik dál nestoupá (m)
export const SHORE_BACK = 3;            // strmý břeh se hledá i tolik od osy směrem k vodě (m)
export const SHORE_FILL = 0.3;          // od tohoto zvednutí se terén dosype i za okrajem vozovky (m)

function smoothStep(value, from, to) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * O kolik zvednout vzorek profilu silnice, která vede podél břehu (m, ≥ 0).
 * land[i] = výška terénu po 1 m napříč silnicí, i = SHORE_BACK je osa, menší i leží směrem k vodě,
 * větší směrem od vody až do osy + reach + SHORE_PLATEAU; reach = poloviční šířka + SHORE_REACH.
 * Výškový model po 8 m rozmaže nábřežní zeď do svahu přes celou vozovku, takže osa silnice leží
 * v půli svahu nebo u paty zdi místo na ulici nad ní. Silnice se zvedne na nejvyšší místo terasy
 * do reach, jen když u osy nebo mezi osou a terasou je strmý břeh (rozmazaná zeď, krok přes
 * 25–50 % na metr) a za terasou terén už nestoupá. Na úbočí kopce u řeky zůstává výška v ose.
 */
export function shoreLift(land, reach, back = SHORE_BACK) {
  const axis = land[back], n = Math.min(land.length - 1, back + Math.round(reach));
  let top = axis, at = back;
  for (let i = back + 1; i <= n; i++) if (land[i] > top) { top = land[i]; at = i; }
  if (top - axis < 0.05) return 0;
  let beyond = -Infinity;
  for (let i = n; i < land.length; i++) if (land[i] > beyond) beyond = land[i];
  let steep = 0;
  for (let i = 0; i < at; i++) steep = Math.max(steep, land[i + 1] - land[i]);
  return (top - axis) * smoothStep(steep, 0.25, 0.5) * (1 - smoothStep(beyond - top, 0.2, 0.6));
}

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
  let b = new Float64Array(n);
  for (let p = 0; p < passes; p++) {
    let sum = 0;
    for (let j = -half; j <= half; j++) sum += at(a, j);
    for (let i = 0; i < n; i++) {
      b[i] = sum / (2 * half + 1);
      sum += at(a, i + half + 1) - at(a, i - half);
    }
    [a, b] = [b, a];
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
  pinRange(out, 0, out.length, step, constraints, reach);
  return out;
}

/** Totéž jako pinProfile, ale na místě v úseku pole arr[off … off + n). */
function pinRange(arr, off, n, step, constraints, reach = PIN_REACH) {
  if (!constraints.length) return;
  const value = (s) => {
    const f = Math.max(0, Math.min(n - 1, s / step)), i = Math.min(n - 2, Math.floor(f));
    return n < 2 ? arr[off] : arr[off + i] + (arr[off + i + 1] - arr[off + i]) * (f - i);
  };
  const pins = constraints.map(([s, y]) => [s, y - value(s)]).sort((a, b) => a[0] - b[0]);
  const fade = (d) => {
    const t = Math.max(0, Math.min(1, 1 - d / reach));
    return t * t * (3 - 2 * t);
  };
  let k = 0;
  for (let i = 0; i < n; i++) {
    const s = i * step;
    let delta;
    if (s <= pins[0][0]) delta = pins[0][1] * fade(pins[0][0] - s);
    else if (s >= pins.at(-1)[0]) delta = pins.at(-1)[1] * fade(s - pins.at(-1)[0]);
    else {
      while (pins[k + 1][0] < s) k++;
      const [s0, d0] = pins[k], [s1, d1] = pins[k + 1];
      delta = s1 > s0 ? d0 + (d1 - d0) * (s - s0) / (s1 - s0) : d0;
    }
    arr[off + i] += delta;
  }
}

/** Vyhlazení úseku pole na místě jako smoothProfile (tmp = pomocné pole délky aspoň n). */
function smoothRange(arr, off, n, width, passes, tmp) {
  const half = Math.floor(width / 2);
  if (n < 3 || half < 1) return;
  const at = (i) => {
    if (i < 0) return 2 * tmp[0] - tmp[Math.min(n - 1, -i)];
    if (i >= n) return 2 * tmp[n - 1] - tmp[Math.max(0, 2 * n - 2 - i)];
    return tmp[i];
  };
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) tmp[i] = arr[off + i];
    let sum = 0;
    for (let j = -half; j <= half; j++) sum += at(j);
    for (let i = 0; i < n; i++) {
      arr[off + i] = sum / (2 * half + 1);
      sum += at(i + half + 1) - at(i - half);
    }
  }
}

/**
 * Příčný sklon všech silnic s profilem v jednom poli (indexy jako heights): svah vedle silnice
 * měřený po CROSS_STEP m (nejvýš CROSS_TERRAIN), klopení podle křivosti (nejvýš CROSS_BANK, mizí
 * u křižovatek a volných konců), celkem nejvýš CROSS_MAX. Navazující silnice mají ve společném
 * bodě stejný sklon, na mostovku se silnice napojí bez sklonu.
 */
function buildCross(world, grade, baseHeight, options, pairs, bankStops, joints, shore = null) {
  const { rCount, rOff, rpx, rpz } = world;
  const { start, count, station, step, total } = grade;
  const values = new Float64Array(total);
  let tmp = new Float64Array(1024), side = new Float64Array(1024);
  const joined = new Map();          // silnice → staničení konců napojených na pokračující silnici
  for (const pair of pairs) for (const member of pair) {
    if (!joined.has(member.road)) joined.set(member.road, []);
    joined.get(member.road).push(station[member.p]);
  }
  for (let road = 0; road < rCount; road++) {
    const s0 = start[road];
    if (s0 < 0) continue;
    const n = count[road], a = rOff[road], b = rOff[road + 1], length = station[b - 1];
    const m = Math.max(2, Math.round(length / CROSS_STEP) + 1);
    if (tmp.length < Math.max(n, m)) { tmp = new Float64Array(2 * Math.max(n, m)); side = new Float64Array(tmp.length); }
    // svah: terén vlevo a vpravo za okrajem vozovky
    const reachSide = (options.halfWidth?.(road) ?? 3) + 2;
    const banked = options.bank?.(road), built = banked && options.built ? [] : null;
    let p = a;
    for (let j = 0; j < m; j++) {
      const s = length * j / (m - 1);
      while (p < b - 2 && station[p + 1] < s) p++;
      const seg = station[p + 1] - station[p] || 1;
      const t = (s - station[p]) / seg, dx = (rpx[p + 1] - rpx[p]) / seg, dz = (rpz[p + 1] - rpz[p]) / seg;
      const x = rpx[p] + (rpx[p + 1] - rpx[p]) * t, z = rpz[p] + (rpz[p + 1] - rpz[p]) * t;
      side[j] = (baseHeight(x - dz * reachSide, z + dx * reachSide) - baseHeight(x + dz * reachSide, z - dx * reachSide)) / (2 * reachSide);
      // Na nábřeží zvednutém na terasu je „svah“ jen rozmazaná nábřežní zeď: vozovka je napříč rovná.
      if (shore?.[road]) side[j] *= 1 - smoothStep(profileAt(shore[road], 0, shore[road].length, s, step), 0.1, 0.5);
      if (built && options.built(x, z, reachSide + BANK_BUILT)) built.push(s);
    }
    smoothRange(side, 0, m, 3, 3, tmp);
    for (let i = 0; i < n; i++) {
      const f = length > 0 ? Math.min(1, i * step / length) * (m - 1) : 0, j = Math.min(m - 2, Math.floor(f));
      const v = side[j] + (side[j + 1] - side[j]) * (f - j);
      values[s0 + i] = Math.max(-CROSS_TERRAIN, Math.min(CROSS_TERRAIN, v));
    }
    if (banked) {
      // klopení podle křivosti: směr úseků (bez skoku o 2π), vyhlazený podél silnice
      let previous = null, angle = 0, angleSeg = -1;
      p = a;
      for (let i = 0; i < n; i++) {
        const s = Math.min(length, i * step);
        while (p < b - 2 && station[p + 1] < s) p++;
        if (p !== angleSeg) {
          angle = Math.atan2(rpz[p + 1] - rpz[p], rpx[p + 1] - rpx[p]);
          if (previous !== null) angle = previous + Math.atan2(Math.sin(angle - previous), Math.cos(angle - previous));
          previous = angle; angleSeg = p;
        }
        side[i] = angle;
      }
      smoothRange(side, 0, n, 7, 3, tmp);
      // U křižovatek, volných konců a mezi domy klopení mizí, na navazující silnici pokračuje.
      // Úseky bez klopení: [od, do], sloučené a seřazené.
      const ends = joined.get(road) ?? [], half = length / (m - 1) / 2 + 1e-6;
      const spans = [0, length].filter((s) => !ends.some((j) => Math.abs(j - s) < 0.01)).map((s) => [s, s]);
      for (const s of bankStops.get(road) ?? []) spans.push([s, s]);
      for (const s of built ?? []) spans.push([s - half, s + half]);
      spans.sort((x, y) => x[0] - y[0]);
      const stops = [];
      for (const span of spans) {
        const last = stops.at(-1);
        if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
        else stops.push(span);
      }
      let q = 0;
      for (let i = 0; i < n; i++) {
        const s = i * step;
        while (q + 1 < stops.length && stops[q + 1][0] <= s) q++;
        let d = stops.length ? Math.max(0, stops[q][0] - s, s - stops[q][1]) : Infinity;
        if (q + 1 < stops.length) d = Math.min(d, stops[q + 1][0] - s);
        const t = Math.min(1, d / BANK_CLEAR);
        const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
        if (i1 > i0) values[s0 + i] += bankFor((side[i1] - side[i0]) / ((i1 - i0) * step)) * t * t * (3 - 2 * t);
      }
    }
    for (let i = 0; i < n; i++) values[s0 + i] = Math.max(-CROSS_MAX, Math.min(CROSS_MAX, values[s0 + i]));
  }
  const pins = new Map();
  const pin = (road, s, value) => { if (!pins.has(road)) pins.set(road, []); pins.get(road).push([s, value]); };
  for (const [road, stations] of joints) for (const s of stations) pin(road, s, 0);
  // společný sklon ve směru průjezdu z A do B (normála silnice A míří stejně, jen když A končí v uzlu)
  for (const [A, B] of pairs) {
    const crossOf = (member) => profileAt(values, start[member.road], count[member.road], station[member.p], step);
    const through = (crossOf(B) * B.out - crossOf(A) * A.out) / 2;
    pin(A.road, station[A.p], -A.out * through);
    pin(B.road, station[B.p], B.out * through);
  }
  for (const [road, list] of pins) pinRange(values, start[road], count[road], step, list);
  return Float32Array.from(values);
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

/** Příčný sklon silnice ve staničení (m na metr ve směru normály (−dz, dx) silnice), 0 bez profilu. */
export function gradeCross(grade, road, station) {
  const start = grade.start[road];
  if (start < 0 || !grade.cross) return 0;
  const count = grade.count[road];
  const f = Math.max(0, Math.min(count - 1, station / grade.step));
  const i = Math.min(count - 2, Math.floor(f));
  const a = grade.cross[start + i], b = grade.cross[start + i + 1];
  return a + (b - a) * (f - i);
}

/** Zvednutí profilu na nábřeží ve staničení (m, vyhlazené jako profil), 0 bez profilu. */
export function gradeShore(grade, road, station) {
  const start = grade.start[road];
  if (start < 0 || !grade.shore) return 0;
  return profileAt(grade.shore, start, grade.count[road], station, grade.step);
}

/** Klopení podle křivosti (1/m) se znaménkem: vnitřní strana zatáčky níž. */
export function bankFor(curvature) {
  return -Math.max(-CROSS_BANK, Math.min(CROSS_BANK, curvature * BANK_FACTOR));
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
 * nebo od napojení na mostovku), junctions ({ p: bod, roads, dirs: směry silnic z bodu }), cross
 * (Float32Array, příčný sklon), step, station }.
 * options.cross = počítat příčný sklon podle terénu, options.bank(road) = klopit v zatáčkách,
 * options.built(x, z, r) = je do vzdálenosti r dům (v zástavbě se zatáčky neklopí),
 * options.halfWidth(road) = poloviční šířka vozovky (pro odečet svahu vedle silnice).
 */
export function buildRoadGrades(world, include, pinned, baseHeight, step = GRADE_STEP, keep = null, foreign = null, options = {}) {
  const { rCount, rOff, rpx, rpz, rpy } = world;
  const start = new Int32Array(rCount).fill(-1), count = new Int32Array(rCount);
  const station = new Float64Array(rpx.length);
  const raw = [], shoreRaw = [];
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
    // na nábřeží profil leží na terase nad zdí (viz shoreLift), ručně doladěná místa ne
    const lift = options.shore ? new Float64Array(n) : null;
    let p = a;
    for (let i = 0; i < n; i++) {
      const s = Math.min(length, i * step);
      while (p < b - 2 && station[p + 1] < s) p++;
      const seg = station[p + 1] - station[p];
      const t = seg > 0 ? (s - station[p]) / seg : 0;
      const x = rpx[p] + (rpx[p + 1] - rpx[p]) * t, z = rpz[p] + (rpz[p + 1] - rpz[p]) * t;
      samples[i] = baseHeight(x, z);
      if (lift) lift[i] = options.shore(road, x, z, -(rpz[p + 1] - rpz[p]) / (seg || 1), (rpx[p + 1] - rpx[p]) / (seg || 1));
    }
    if (lift && lift.some((v) => v > 0)) {
      const lifted = new Float64Array(n);
      for (let i = 0; i < n; i++) lifted[i] = samples[i] + lift[i];
      raw[road] = smoothProfile(lifted);
      shoreRaw[road] = smoothProfile(lift);
    } else raw[road] = smoothProfile(samples);
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
  const crossPairs = [];             // navazující konce silnic se společným příčným sklonem
  const bankStops = new Map();       // silnice → staničení křižovatek a volných konců (bez klopení)
  const stopBank = (road, s) => { if (!bankStops.has(road)) bankStops.set(road, []); bankStops.get(road).push(s); };
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
      if (!through) for (const [road, p] of linked) stopBank(road, station[p]);
      // Silnice, která pokračuje druhou (i přes křižovatku), na ni naváže stejným příčným sklonem.
      if (options.cross) {
        const ends = linked.filter(([road, p]) => p === rOff[road] || p === rOff[road + 1] - 1)
          .map(([road, p]) => ({ road, p, out: p === rOff[road] ? 1 : -1, dir: heading(road, p) }));
        const used = new Set();
        for (const A of ends) {
          if (used.has(A)) continue;
          let best = null, bestDot = -0.85;
          for (const B of ends) {
            if (B === A || used.has(B)) continue;
            const dot = A.dir[0] * B.dir[0] + A.dir[1] * B.dir[1];
            if (dot < bestDot) { bestDot = dot; best = B; }
          }
          if (!best) continue;
          used.add(A); used.add(best);
          crossPairs.push([A, best]);
        }
      }
    }
  }
  const heights = new Float32Array(total), kept = new Uint8Array(total), reach = new Float32Array(total);
  const rise = new Float32Array(total), shore = options.shore ? new Float32Array(total) : null;
  if (shore) for (let road = 0; road < rCount; road++) if (shoreRaw[road]) shore.set(shoreRaw[road], start[road]);
  const cross = options.cross ? buildCross(world, { start, count, station, step, total }, baseHeight, options, crossPairs, bankStops, joints, shoreRaw) : null;
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
  return { start, count, heights, kept, reach, rise, junctions, cross, shore, step, station };
}
