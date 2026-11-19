import { pathNormal } from './road-profile.js';

// Měřené řezy mění půdorys konstrukce. Kolejnice i výška jízdní dráhy vycházejí z původních bodů.
export function measuredRailDeck(rail, sections) {
  const stations = [0];
  for (let k = 2; k < rail.pts.length; k += 2) {
    stations.push(stations.at(-1) + Math.hypot(rail.pts[k] - rail.pts[k - 2], rail.pts[k + 1] - rail.pts[k - 1]));
  }
  const length = stations.at(-1);
  if (!length) return null;
  const boundaries = [...new Set([...stations, ...sections.map((s) => s[0] * length)])].sort((a, b) => a - b);
  const stops = [0];
  for (let i = 1; i < boundaries.length; i++) {
    const a = boundaries[i - 1],
      b = boundaries[i],
      pieces = Math.ceil((b - a) / 4);
    for (let k = 1; k <= pieces; k++) stops.push(k === pieces ? b : a + ((b - a) * k) / pieces);
  }
  const path = { x: [], y: [], z: [], widths: [], n: stops.length, px: NaN, pz: NaN, nx: NaN, nz: NaN };
  const offsets = [];
  let i = 0,
    j = 0;
  for (const distance of stops) {
    while (i + 2 < stations.length && stations[i + 1] <= distance) i++;
    const span = stations[i + 1] - stations[i],
      t = span ? (distance - stations[i]) / span : 0;
    path.x.push(rail.pts[2 * i] + t * (rail.pts[2 * i + 2] - rail.pts[2 * i]));
    path.z.push(rail.pts[2 * i + 1] + t * (rail.pts[2 * i + 3] - rail.pts[2 * i + 1]));
    path.y.push(rail.y[i] + t * (rail.y[i + 1] - rail.y[i]));
    const u = distance / length;
    while (j + 2 < sections.length && sections[j + 1][0] <= u) j++;
    const [a, wa, oa] = sections[j],
      [b, wb, ob] = sections[j + 1],
      f = (u - a) / (b - a);
    path.widths.push((wa + (wb - wa) * f) / 2);
    offsets.push(oa + (ob - oa) * f);
  }
  // Všechny normály pocházejí z původní osy, včetně obou stran lomu.
  const shifted = path.x.map((x, k) => {
    const normal = pathNormal(path, k);
    return [x + offsets[k] * normal.x, path.z[k] + offsets[k] * normal.z];
  });
  for (const [k, [x, z]] of shifted.entries()) {
    path.x[k] = x;
    path.z[k] = z;
  }
  return path;
}

export function validRailSections(sections) {
  return (
    Array.isArray(sections) &&
    sections.length >= 2 &&
    sections[0]?.[0] === 0 &&
    sections.at(-1)?.[0] === 1 &&
    sections.every(
      (s, i) =>
        Array.isArray(s) &&
        s.length === 3 &&
        s.every(Number.isFinite) &&
        (!i || s[0] > sections[i - 1][0]) &&
        s[1] > 0 &&
        Math.abs(s[2]) < s[1] / 2
    )
  );
}

export function segmentHalfWidth(world, index, t) {
  const width = world.bridgeSeg[index + 6],
    end = world.bridgeEndWidths?.get(index);
  return end === undefined ? width : width + (end - width) * t;
}
