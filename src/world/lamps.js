import { DRIVABLE_MAX, RC, RF } from '../config.js';
import { breakableId } from '../physics/breakables.js';
import { hash } from './hash.js';

export function indexLampSurvey(world, rows) {
  const tiles = new Map();
  for (const [id, x, z] of rows) {
    const tile = world.chunkIndex(x, z);
    if (tile < 0) continue;
    if (!tiles.has(tile)) tiles.set(tile, []);
    tiles.get(tile).push({ id: breakableId('lamp', tile, 'osm-' + id), x, z });
  }
  return tiles;
}

// Poloměry jsou menší než dlaždice. I dotaz na její hraně navštíví každý seznam jen jednou.
function nearItem(world, tiles, x, z, radius, matches) {
  if (!tiles?.size) return false;
  const first = world.chunkIndex(x - radius, z - radius);
  const last = world.chunkIndex(x + radius, z + radius);
  if (first === last && first >= 0) return tiles.get(first)?.some(matches) ?? false;
  const nearby = new Set([first, last, world.chunkIndex(x - radius, z + radius), world.chunkIndex(x + radius, z - radius)]);
  for (const tile of nearby) if (tiles.get(tile)?.some(matches)) return true;
  return false;
}

function poleGround(world, x, z) {
  if (world.buildingAt(x, z) >= 0 || world.isWater(x, z) || world.insideOtherCarriageway(-1, x, z, 0.15)) return null;
  if (nearItem(world, world.transitStops?.tiles, x, z, 3, item => {
    const clearance = item.kind === 'shelter' ? 2.4 : 1.5;
    return (item.x - x) ** 2 + (item.z - z) ** 2 < clearance ** 2;
  })) return null;
  const y = world.heightAt(x, z);
  if (world.collideCircle(x, z, 0.5, y + 0.3, y + 3, true) ||
      world.blocksTramTrack(x, z, y, 0, 0.65, 0.65)) return null;
  return y;
}

function lampAt(id, x, y, z, tall, dx, dz) {
  const reach = dx || dz ? (tall ? 3 : 1.6) : 0;
  return { id, x, y, z, height: tall ? 9 : 6.2, head: tall ? 0.7 : 0.5, reach,
    lightX: x + dx * reach, lightZ: z + dz * reach, radius: tall ? 14 : 10 };
}

function surveyedLamp(world, entry) {
  if (entry.lamp !== undefined) return entry.lamp;
  let { x, z } = entry;
  let y = poleGround(world, x, z);
  const road = world.nearestRoad(x, z, 18, DRIVABLE_MAX);
  if (y === null && road && !(world.r.flags[road.road] & (RF.BRIDGE | RF.TUNNEL))) {
    // Herní vozovka má vlastní šířku. Sloup z jejího okraje posuneme nanejvýš o šest metrů.
    const side = (x - road.x) * -road.dz + (z - road.z) * road.dx >= 0 ? 1 : -1;
    const offset = side * (world.r.w[road.road] / 2 + 1);
    for (const along of [0, -2, 2, -4, 4]) {
      x = road.x - road.dz * offset + road.dx * along;
      z = road.z + road.dx * offset + road.dz * along;
      if (Math.hypot(x - entry.x, z - entry.z) > 6) continue;
      y = poleGround(world, x, z);
      if (y !== null) break;
    }
  }
  if (y === null) return entry.lamp = null;
  const paved = road && road.dist < world.r.w[road.road] / 2 + 6 &&
    !(world.r.flags[road.road] & (RF.TUNNEL | RF.BRIDGE));
  const dx = paved ? road.x - x : 0, dz = paved ? road.z - z : 0;
  const len = Math.hypot(dx, dz) || 1;
  return entry.lamp = lampAt(entry.id, x, y, z, paved && world.r.cls[road.road] <= RC.SECONDARY, dx / len, dz / len);
}

function nearSurvey(world, x, z) {
  // Dosah dotazu zahrnuje i možný posun od původní souřadnice.
  return nearItem(world, world.lampSurvey, x, z, 30, entry => {
    if (Math.abs(entry.x - x) > 30 || Math.abs(entry.z - z) > 30) return false;
    const lamp = surveyedLamp(world, entry);
    return lamp && (lamp.x - x) ** 2 + (lamp.z - z) ** 2 < 24 ** 2;
  });
}

// Vlastníkem je dlaždice zdrojového úseku. Pata lampy může přesahovat k sousedům.
export function streetLamps(world, ci) {
  const pieces = world.rPieces[ci] ?? [];
  const R = world.r, px = world.rpx, pz = world.rpz;
  const lamps = [];
  for (const entry of world.lampSurvey?.get(ci) ?? []) {
    const lamp = surveyedLamp(world, entry);
    if (lamp) lamps.push({ ...lamp });
  }
  const mappedCount = lamps.length;
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
        const inwardX = dz * side, inwardZ = -dx * side;
        acc += spacing;
        if (!tall) side = -side;
        if (nearSurvey(world, x, z)) continue;
        const y = poleGround(world, x, z);
        if (y === null) continue;
        const id = breakableId('lamp', ci, [i, s, k, index].join('.'));
        lamps.push(lampAt(id, x, y, z, tall, inwardX, inwardZ));
        if (lamps.length - mappedCount === 90) return lamps;
      }
      acc -= len;
    }
  }
  return lamps;
}
