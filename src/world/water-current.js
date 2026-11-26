// Osa z OpenStreetMap dává směr. Rychlosti v m/s jsou herní odhad podle druhu toku.
const speedByKind = [0.55, 0.32, 0.27];
export const WATER_CURRENT_REACH = 48;
const CELL = 96;
const key = (x, z) => x + ':' + z;

export function indexWaterCurrents(land) {
  const cells = new Map();
  const kinds = land.lCls ?? [];
  for (let i = 0; i < kinds.length; i++) {
    const speed = speedByKind[kinds[i]];
    if (!speed) continue;
    for (let j = land.lStart[i] + 1; j < land.lStart[i + 1]; j++) {
      const ax = land.lx[j - 1] * 0.1, az = land.lz[j - 1] * 0.1;
      const bx = land.lx[j] * 0.1, bz = land.lz[j] * 0.1;
      const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
      if (length < 0.01) continue;
      const segment = { ax, az, dx, dz, length2: length * length, vx: speed * dx / length, vz: speed * dz / length };
      for (let z = Math.floor((Math.min(az, bz) - WATER_CURRENT_REACH) / CELL);
        z <= Math.floor((Math.max(az, bz) + WATER_CURRENT_REACH) / CELL); z++) {
        for (let x = Math.floor((Math.min(ax, bx) - WATER_CURRENT_REACH) / CELL);
          x <= Math.floor((Math.max(ax, bx) + WATER_CURRENT_REACH) / CELL); x++) {
          const cell = key(x, z);
          if (!cells.has(cell)) cells.set(cell, []);
          cells.get(cell).push(segment);
        }
      }
    }
  }
  return cells;
}

export function mapWaterCurrent(world, area, x, z, shore, out) {
  out.vx = out.vz = 0;
  if (!(area >= 0)) return;
  const segments = world.waterCurrents?.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
  if (!segments) return;
  let nearest, distance2 = WATER_CURRENT_REACH ** 2;
  for (const s of segments) {
    const along = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.length2;
    const t = Math.max(0, Math.min(1, along));
    const sx = s.ax + s.dx * t, sz = s.az + s.dz * t;
    const d2 = (x - sx) ** 2 + (z - sz) ** 2;
    // Blízká osa za hrází patří jinému polygonu a nemá rozhýbat rybník.
    if (d2 >= distance2 || !world.landContains(area, sx, sz)) continue;
    distance2 = d2;
    nearest = s;
  }
  if (!nearest) return;
  const bank = Math.min(1, shore / 10);
  const reach = Math.min(1, (WATER_CURRENT_REACH - Math.sqrt(distance2)) / 12);
  const weight = bank * bank * (3 - 2 * bank) * reach * reach * (3 - 2 * reach);
  out.vx = nearest.vx * weight;
  out.vz = nearest.vz * weight;
}
