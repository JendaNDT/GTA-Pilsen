// Chodníky s obrubníkem podél městských ulic. Dřív byl chodník jen barva v textuře země ve výšce
// asfaltu. Teď ho tvoří samostatná plocha: u vozovky žulový obrubník 10 cm nad asfaltem, odtud se
// chodník svažuje k terénu u domů, takže vchody zůstávají ve své výšce. Stejné úseky používá
// vykreslení i fyzika; výšku pro chodce vrací World.sidewalkY().
import { pathNormal } from './road-profile.js';

// Třídy a příznaky silnic z config.js (modul ho nenačítá, aby šel použít i ve fyzice bez prohlížeče;
// shodu hlídá test).
export const SIDEWALK_CLASSES = { PRIMARY: 4, PRIMARY_LINK: 5, SECONDARY_LINK: 7, TERTIARY_LINK: 9, RESIDENTIAL: 11 };
export const SIDEWALK_RAISED = 2 | 4 | 128;   // most, tunel, společná deska

/** Výška asfaltu nad terénem; shodná se SURF ve world.js (hlídá test). */
export const SIDEWALK_SURF = 0.05;
export const TRAM_BED_HALF_WIDTH = 1.25;

export const CURB_HEIGHT = 0.10;        // obrubník nad asfaltem (m)
export const CURB_WIDTH = 0.15;         // šířka žulového obrubníku (m)
export const CURB_DEPTH = 0.08;         // líc obrubníku sahá pod asfalt, aby pod ním nebyla mezera (m)
export const CURB_SLOPE = 0.06;         // líc je zkosený, auto přes obrubník přejede bez zaseknutí (m)
export const SIDEWALK_STEP = 8;         // nejdelší rozteč příčných řezů podél silnice (m)
export const MIN_SIDEWALK = 0.6;        // užší zbytek chodníku u domu se nekreslí (m)
export const SIDEWALK_MIN_RUN = 3;      // kratší souvislý kus chodníku (zbytek v ostrůvku) se nekreslí (m)
const TRAM_CLEARANCE = TRAM_BED_HALF_WIDTH + 0.1;
export const MAX_TRAM_SIDEWALK_SHIFT = 4;
const TRAM_SIDEWALK_STEP = 2;
const MAX_RISE = 0.08, MAX_FALL = 0.06; // největší příčný sklon chodníku nahoru a dolů

/**
 * Šířka chodníku podle třídy silnice a okolí (0 = bez chodníku). context: 2 = měřené čtvrti
 * s dlažbou, 1 = hustá zástavba, 0 = volná krajina (krajnice bez chodníku).
 */
export function sidewalkWidth(cls, flags, context) {
  const C = SIDEWALK_CLASSES;
  if (!context || cls < C.PRIMARY || cls > C.RESIDENTIAL) return 0;
  if (cls === C.PRIMARY_LINK || cls === C.SECONDARY_LINK || cls === C.TERTIARY_LINK) return 0;
  if (flags & SIDEWALK_RAISED) return 0;
  return context === 2 ? 2.5 : 2.0;
}

/**
 * Výšky příčného řezu: road = povrch asfaltu u obrubníku, terrain = terén na vnějším okraji
 * chodníku široké width. Vrací výšku obrubníku, vnějšího okraje chodníku a zda je pod okrajem
 * potřeba sokl dolů k nižšímu terénu.
 */
export function sidewalkProfile(road, terrain, width) {
  const curb = road + CURB_HEIGHT;
  const span = Math.max(0, width - CURB_WIDTH);
  const outer = Math.min(curb + MAX_RISE * span, Math.max(curb - MAX_FALL * span, terrain));
  return { curb, outer, skirt: terrain < outer - 0.02 };
}

/** Výška chodníku ve vzdálenosti d od obrubníku (0 = líc obrubníku). */
export function sidewalkHeight(profile, width, d) {
  if (d <= CURB_WIDTH) return profile.curb;
  const span = Math.max(1e-6, width - CURB_WIDTH);
  return profile.curb + (profile.outer - profile.curb) * Math.min(1, (d - CURB_WIDTH) / span);
}

/**
 * Body osy silnice mezi body s a e po nejvýš step metrech i s úsekem a polohou na něm,
 * ve stejném tvaru jako densePath (pro pathNormal). cuts = [{ k, t }] přidá body navíc
 * (konce chodníku u zaoblených rohů).
 */
export function stationPath(xs, zs, s, e, a, b, step = SIDEWALK_STEP, cuts = null) {
  const X = [xs[s]], Z = [zs[s]], K = [s], T = [0];
  for (let k = s; k < e; k++) {
    const dx = xs[k + 1] - xs[k], dz = zs[k + 1] - zs[k];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / step));
    const ts = [];
    for (let q = 1; q <= n; q++) ts.push(q / n);
    for (const cut of cuts ?? []) if (cut.k === k && cut.t > 1e-3 && cut.t < 1 - 1e-3) ts.push(cut.t);
    ts.sort((p, q) => p - q);
    for (const t of ts) {
      X.push(xs[k] + dx * t); Z.push(zs[k] + dz * t);
      // poslední bod úseku patří do konce úseku k (t = 1)
      K.push(k); T.push(t);
    }
  }
  return {
    x: X, z: Z, k: K, t: T, n: X.length,
    px: s > a ? xs[s - 1] : NaN, pz: s > a ? zs[s - 1] : NaN,
    nx: e < b ? xs[e + 1] : NaN, nz: e < b ? zs[e + 1] : NaN,
  };
}

/**
 * Vzdálenost od bodu (x, z) ve směru (ox, oz) k nejbližší stěně budovy, nejvýš max.
 * walls(x0, z0, x1, z1, visit) projde hrany stěn v obdélníku; visit(ax, az, bx, bz).
 */
export function wallDistance(x, z, ox, oz, max, walls) {
  let best = max;
  const ex = ox * max, ez = oz * max;
  walls(Math.min(x, x + ex), Math.min(z, z + ez), Math.max(x, x + ex), Math.max(z, z + ez), (ax, az, bx, bz) => {
    const fx = bx - ax, fz = bz - az;
    const den = ex * fz - ez * fx;
    if (Math.abs(den) < 1e-9) return;
    const u = ((ax - x) * fz - (az - z) * fx) / den;    // podél chodníku 0..1
    const v = ((ax - x) * ez - (az - z) * ex) / den;    // podél stěny 0..1
    if (u >= 0 && u <= 1 && v >= 0 && v <= 1) best = Math.min(best, u * max);
  });
  return best;
}

function tramTrackNear(track, x0, z0, x1, z1) {
  const { rail, minX, minZ, maxX, maxZ } = track;
  return !rail.y && !(rail.flags & SIDEWALK_RAISED) &&
    maxX + TRAM_CLEARANCE >= x0 && minX - TRAM_CLEARANCE <= x1 &&
    maxZ + TRAM_CLEARANCE >= z0 && minZ - TRAM_CLEARANCE <= z1;
}

/** Rozsah řezu chodníku od původního obrubníku. Při překryvu začíná až za tramvajovým pásem. */
export function sidewalkTramRange(tracks, x, z, ox, oz, width) {
  let start = 0, nextTrack = Infinity;
  const reach = width + MAX_TRAM_SIDEWALK_SHIFT;
  const x1 = x + ox * reach, z1 = z + oz * reach;
  const minX = Math.min(x, x1), maxX = Math.max(x, x1), minZ = Math.min(z, z1), maxZ = Math.max(z, z1);
  for (const track of tracks ?? []) {
    if (!tramTrackNear(track, minX, minZ, maxX, maxZ)) continue;
    const p = track.rail.pts;
    for (let k = 2; k < p.length; k += 2) {
      // V souřadnicích řezu je chodník na vodorovné ose a pás je úsečka rozšířená o lože.
      const ax = (p[k - 2] - x) * ox + (p[k - 1] - z) * oz;
      const az = (p[k - 1] - z) * ox - (p[k - 2] - x) * oz;
      const bx = (p[k] - x) * ox + (p[k + 1] - z) * oz;
      const bz = (p[k + 1] - z) * ox - (p[k] - x) * oz;
      if (Math.min(az, bz) > TRAM_CLEARANCE || Math.max(az, bz) < -TRAM_CLEARANCE) continue;
      let lo = Infinity, hi = -Infinity;
      for (const [px, pz] of [[ax, az], [bx, bz]]) {
        if (Math.abs(pz) > TRAM_CLEARANCE) continue;
        const r = Math.sqrt(TRAM_CLEARANCE ** 2 - pz ** 2);
        lo = Math.min(lo, px - r);
        hi = Math.max(hi, px + r);
      }
      const dz = bz - az, dx = bx - ax;
      if (Math.abs(dz) > 1e-8) {
        const scale = TRAM_CLEARANCE / Math.hypot(dx, dz);
        for (const side of [-1, 1]) {
          const t = -(az + side * dx * scale) / dz;
          if (t < 0 || t > 1) continue;
          const edge = ax + dx * t - side * dz * scale;
          lo = Math.min(lo, edge);
          hi = Math.max(hi, edge);
        }
      }
      if (hi > 0 && lo < width) start = Math.max(start, hi);
      else if (lo >= width) nextTrack = Math.min(nextTrack, lo);
    }
  }
  // Při šikmém křížení nebo souběhu více kolejí může na obrubník zbýt příliš málo místa.
  if (start > MAX_TRAM_SIDEWALK_SHIFT) return { start: 0, width: 0 };
  return { start, width: Math.max(0, Math.min(width, nextTrack - start)) };
}

/**
 * Spojí příčné řezy jedné strany chodníku do ploch. Řez: { valid, cx, cz (obrubník), ox, oz
 * (směr ven), width, road, profile, terrain }. quad(a, b, c, d, part) dostane rohy v pořadí
 * kolem plochy; part: 'face' líc obrubníku, 'curb' jeho horní plocha, 'walk' chodník,
 * 'skirt' sokl k nižšímu terénu, 'cap' čelo na konci chodníku; section = řez se směrem ven.
 * Souvislý kus kratší než SIDEWALK_MIN_RUN (zbytky v ostrůvcích složitých křižovatek) se vynechá.
 */
export function sidewalkQuads(sections, quad) {
  const point = (sec, d, y) => [sec.cx + sec.ox * d, y, sec.cz + sec.oz * d];
  const cap = (sec) => {
    const bottom = sec.road - CURB_DEPTH;
    quad(point(sec, 0, bottom), point(sec, CURB_SLOPE, sec.profile.curb), point(sec, CURB_WIDTH, sec.profile.curb),
      point(sec, CURB_WIDTH, bottom), 'cap', sec);
    quad(point(sec, CURB_WIDTH, bottom), point(sec, CURB_WIDTH, sec.profile.curb), point(sec, sec.width, sec.profile.outer),
      point(sec, sec.width, Math.min(sec.terrain, sec.profile.outer) - 0.02), 'cap', sec);
  };
  // délka souvislých kusů podél obrubníku
  const run = new Float64Array(sections.length);
  for (let i = 0; i < sections.length;) {
    if (!sections[i].valid) { i++; continue; }
    let j = i, length = 0;
    while (sections[j + 1]?.valid) { length += Math.hypot(sections[j + 1].cx - sections[j].cx, sections[j + 1].cz - sections[j].cz); j++; }
    for (let k = i; k <= j; k++) run[k] = length;
    i = j + 1;
  }
  for (let i = 0; i < sections.length; i++) {
    const a = sections[i], b = sections[i + 1];
    if (!a.valid || run[i] < SIDEWALK_MIN_RUN) continue;
    const startsRun = i === 0 || !sections[i - 1].valid;
    if (startsRun) cap(a);
    if (!b?.valid) { cap(a); continue; }
    quad(point(a, 0, a.road - CURB_DEPTH), point(b, 0, b.road - CURB_DEPTH),
      point(b, CURB_SLOPE, b.profile.curb), point(a, CURB_SLOPE, a.profile.curb), 'face', a);
    quad(point(a, CURB_SLOPE, a.profile.curb), point(b, CURB_SLOPE, b.profile.curb),
      point(b, CURB_WIDTH, b.profile.curb), point(a, CURB_WIDTH, a.profile.curb), 'curb', a);
    quad(point(a, CURB_WIDTH, a.profile.curb), point(b, CURB_WIDTH, b.profile.curb),
      point(b, b.width, b.profile.outer), point(a, a.width, a.profile.outer), 'walk', a);
    if (a.profile.skirt || b.profile.skirt) {
      quad(point(a, a.width, a.profile.outer), point(b, b.width, b.profile.outer),
        point(b, b.width, Math.min(b.terrain, b.profile.outer) - 0.02), point(a, a.width, Math.min(a.terrain, a.profile.outer) - 0.02), 'skirt', a);
    }
  }
}

/**
 * Příčné řezy chodníku podél části silnice road (body s až e) po obou stranách.
 * Vrací [levá strana, pravá strana] nebo null, když silnice chodník nemá. Řez je neplatný
 * v ústí jiné silnice, v ruční úpravě E25, na vodě a tam, kde je k domu méně než MIN_SIDEWALK.
 */
export function sidewalkSections(world, road, s, e, widths = world.sidewalks) {
  const width = widths?.[road] ?? 0;
  if (!width) return null;
  const a = world.rOff[road], b = world.rOff[road + 1] - 1;
  const hw = world.r.w[road] / 2;
  const extent = hw / 0.55 + width + MAX_TRAM_SIDEWALK_SHIFT;
  let x0 = world.rpx[s], x1 = x0, z0 = world.rpz[s], z1 = z0;
  for (let k = s + 1; k <= e; k++) {
    x0 = Math.min(x0, world.rpx[k]); x1 = Math.max(x1, world.rpx[k]);
    z0 = Math.min(z0, world.rpz[k]); z1 = Math.max(z1, world.rpz[k]);
  }
  const tracks = world.tramTracks?.filter(track => tramTrackNear(track, x0 - extent, z0 - extent, x1 + extent, z1 + extent));
  const step = tracks?.length ? TRAM_SIDEWALK_STEP : SIDEWALK_STEP;
  const path = stationPath(world.rpx, world.rpz, s, e, a, b, step, world.sidewalkCuts?.get(road));
  const walls = (x0, z0, x1, z1, visit) => world.forWalls(x0, z0, x1, z1, visit);
  const sides = [[], []];
  for (let i = 0; i < path.n; i++) {
    const n = pathNormal(path, i), nx = n.x, nz = n.z, scale = n.scale;
    for (let q = 0; q < 2; q++) {
      const side = q ? 1 : -1, ox = nx * side, oz = nz * side;
      const x = path.x[i] + ox * hw * scale, z = path.z[i] + oz * hw * scale;
      const tram = tracks?.length ? sidewalkTramRange(tracks, x, z, ox, oz, width) : { start: 0, width };
      const cx = x + tram.start * ox, cz = z + tram.start * oz;
      const w = Math.max(0, wallDistance(x, z, ox, oz, tram.start + tram.width, walls) - tram.start);
      const ex = cx + ox * w, ez = cz + oz * w, mx = cx + ox * w * 0.5, mz = cz + oz * w * 0.5;
      const surface = tram.start
        ? world.heightAt(cx, cz) + SIDEWALK_SURF : world.roadSurfaceY(road, path.k[i], path.t[i], cx, cz);
      const terrain = world.heightAt(ex, ez) + SIDEWALK_SURF;
      const valid = w >= MIN_SIDEWALK && surface === surface &&
        !world.sidewalkExcluded(cx, cz) && !world.sidewalkExcluded(ex, ez) &&
        !world.insideOtherCarriageway(road, cx, cz, 0.3) && !world.insideOtherCarriageway(road, mx, mz, 0) &&
        !world.insideOtherCarriageway(road, ex, ez, 0) &&
        !world.insideSidewalkOf(road, mx, mz, widths) && !world.isWater(mx, mz);
      sides[q].push({ valid, cx, cz, ox, oz, width: w, road: surface, terrain, profile: sidewalkProfile(surface, terrain, w) });
    }
  }
  return sides;
}

/** Pořadí silnic pro překryv chodníků v rohu křižovatky: důležitější silnice má chodník. */
export function sidewalkPriority(world, road) {
  return -(world.r.cls[road] * 100) + world.r.w[road];
}

/**
 * Natočení plochy pro fyziku (Jolt bere u sítě jen přední stranu): vodorovné plochy nahoru,
 * líc obrubníku k vozovce, sokl ven, čela oběma směry. Vrací seznam normál, pro které se má
 * plocha vytvořit.
 */
export function sidewalkFacing(part, section) {
  if (part === 'walk' || part === 'curb') return [[0, 1, 0]];
  if (part === 'face') return [[-section.ox, 0, -section.oz]];
  if (part === 'skirt') return [[section.ox, 0, section.oz]];
  return [[-section.oz, 0, section.ox], [section.oz, 0, -section.ox]];
}

/**
 * Příčné řezy chodníku kolem zaobleného rohu (viz corners.js): obrubník na oblouku, chodník
 * směrem ke středu oblouku. Šířka podle širšího chodníku obou ulic, nejvýš 90 % poloměru.
 * Vrací null, když ani jedna ulice chodník nemá.
 */
export function cornerSidewalkSections(world, corner) {
  const width = Math.min(0.9 * corner.radius, Math.max(world.sidewalks?.[corner.a.road] ?? 0, world.sidewalks?.[corner.b.road] ?? 0));
  if (!(width >= MIN_SIDEWALK)) return null;
  const [cx0, cz0] = corner.center;
  const walls = (x0, z0, x1, z1, visit) => world.forWalls(x0, z0, x1, z1, visit);
  return corner.arc.map(([x, z]) => {
    const l = Math.hypot(cx0 - x, cz0 - z) || 1, ox = (cx0 - x) / l, oz = (cz0 - z) / l;
    const tram = sidewalkTramRange(world.tramTracks, x, z, ox, oz, width);
    const cx = x + tram.start * ox, cz = z + tram.start * oz;
    const w = Math.max(0, wallDistance(x, z, ox, oz, Math.min(width, tram.start + tram.width), walls) - tram.start);
    const ex = cx + ox * w, ez = cz + oz * w, mx = cx + ox * w * 0.5, mz = cz + oz * w * 0.5;
    const surface = tram.start ? world.heightAt(cx, cz) + SIDEWALK_SURF : world.cornerY(corner, cx, cz);
    const terrain = world.heightAt(ex, ez) + SIDEWALK_SURF;
    const valid = w >= MIN_SIDEWALK && surface === surface && !world.sidewalkExcluded(mx, mz) &&
      !world.insideOtherCarriageway(corner.a.road, mx, mz, 0, corner.b.road) && !world.isWater(mx, mz);
    return { valid, cx, cz, ox, oz, width: w, road: surface, terrain, profile: sidewalkProfile(surface, terrain, w) };
  });
}
