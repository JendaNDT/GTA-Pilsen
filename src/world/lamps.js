import { DRIVABLE_MAX, RC, RF } from '../config.js';
import { breakableId } from '../physics/breakables.js';
import { hash } from './hash.js';

// Vlastníkem je dlaždice zdrojového úseku. Pata lampy může přesahovat k sousedům.
export function streetLamps(world, ci) {
  const pieces = world.rPieces[ci];
  if (!pieces) return [];
  const R = world.r, px = world.rpx, pz = world.rpz;
  const lamps = [];
  const road = {};
  for (let q = 0; q < pieces.length; q += 3) {
    const i = pieces[q], s = pieces[q + 1], e = pieces[q + 2];
    const cls = R.cls[i], flags = R.flags[i];
    if (cls < RC.PRIMARY || cls > RC.LIVING || cls === RC.PRIMARY_LINK || cls === RC.SECONDARY_LINK || cls === RC.TERTIARY_LINK) continue;
    if (flags & (RF.TUNNEL | RF.PRIVATE | RF.BRIDGE)) continue;
    const hw = R.w[i] / 2, tall = cls <= RC.SECONDARY;
    const spacing = tall ? 40 : 34;
    let acc = hash(i, 9) * spacing;
    let side = hash(i, 11) < 0.5 ? 1 : -1;
    for (let k = s; k < e; k++) {
      const x1 = px[k], z1 = pz[k];
      let dx = px[k + 1] - x1, dz = pz[k + 1] - z1;
      const len = Math.hypot(dx, dz);
      if (len < 1e-3) continue;
      dx /= len; dz /= len;
      let candidate = 0;
      while (acc < len) {
        const index = candidate++;
        const off = hw + 1.3;
        const x = x1 + dx * acc - dz * side * off, z = z1 + dz * acc + dx * side * off;
        acc += spacing;
        if (!tall) side = -side;
        const gy = world.heightAt(x, z);
        if (world.buildingAt(x, z) >= 0 || world.collideCircle(x, z, 0.5, gy + 0.3, gy + 3, true) || world.isWater(x, z)) continue;
        const rd = world.nearestRoad(x, z, 6, DRIVABLE_MAX, 0, road);
        if (rd && rd.road !== i && rd.dist < R.w[rd.road] / 2 + 0.4) continue;
        const h = tall ? 9 : 6.2;
        lamps.push({ id: breakableId('lamp', ci, [i, s, k, index].join('.')),
          x, y: gy, z, height: h, head: tall ? 0.7 : 0.5,
          lightX: x + dz * side * (tall ? 3 : 1.6), lightZ: z - dx * side * (tall ? 3 : 1.6),
          radius: tall ? 14 : 10 });
        if (lamps.length === 90) return lamps;
      }
      acc -= len;
    }
  }
  return lamps;
}
