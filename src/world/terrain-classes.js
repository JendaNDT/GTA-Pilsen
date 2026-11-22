// Nula zachová podklad města nebo vody. Další čísla odpovídají řádkům v atlasu terénu.
import { LC } from '../config.js';

const types = new Map([
  [LC.GRASS, 1],
  [LC.MEADOW, 1],
  [LC.PARK, 1],
  [LC.GARDEN, 1],
  [LC.PITCH, 1],
  [LC.CEMETERY, 1],
  [LC.SCRUB, 1],
  [LC.CONSTRUCTION, 2],
  [LC.ALLOTMENTS, 2],
  [LC.RAILWAY, 3],
  [LC.FARMLAND, 4],
  [LC.SAND, 5],
  [LC.FOREST, 6]
]);

export function terrainClassMask(land, polygons, groups, x, z, size, pixels = 64) {
  if (!polygons?.some((i) => types.has(land.cls[i]))) return null;
  const mask = new Uint8Array(pixels * pixels),
    step = size / pixels;
  for (let order = 0; order <= 3; order++)
    for (const id of polygons) {
      const cls = land.cls[id];
      if ((cls === LC.WATER ? 3 : groups[cls]) !== order) continue;
      fillLandPolygon(land, id, x, z, step, pixels, mask, types.get(cls) ?? 0);
    }
  return mask.some(Boolean) ? mask : null;
}

export function fillLandPolygon(land, id, x, z, step, pixels, mask, value) {
  const rows = new Map();
  for (let ring = land.pRing[id]; ring < land.pRing[id + 1]; ring++) {
    const first = land.ringStart[ring],
      end = land.ringStart[ring + 1];
    for (let v = first, last = end - 1; v < end; last = v++) {
      const ax = land.vx[last] * 0.1,
        az = land.vz[last] * 0.1,
        bx = land.vx[v] * 0.1,
        bz = land.vz[v] * 0.1;
      const start = Math.max(0, Math.ceil((Math.min(az, bz) - z) / step - 0.5));
      const stop = Math.min(pixels, Math.ceil((Math.max(az, bz) - z) / step - 0.5));
      for (let row = start; row < stop; row++) {
        if (!rows.has(row)) rows.set(row, []);
        rows.get(row).push(ax + ((bx - ax) * (z + (row + 0.5) * step - az)) / (bz - az));
      }
    }
  }
  for (const [row, cuts] of rows) {
    cuts.sort((a, b) => a - b);
    for (let p = 0; p + 1 < cuts.length; p += 2) {
      const start = Math.max(0, Math.ceil((cuts[p] - x) / step - 0.5));
      const stop = Math.min(pixels, Math.ceil((cuts[p + 1] - x) / step - 0.5));
      if (stop > start) mask.fill(value, row * pixels + start, row * pixels + stop);
    }
  }
}
