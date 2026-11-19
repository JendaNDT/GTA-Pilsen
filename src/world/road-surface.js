// Opotřebení používá týdenní průměr provozu. Změna hodin tak nepřekreslí stopy kol.
import { RC } from '../config.js';

export function roadWear(world, measured) {
  const use = new Map();
  for (const [edge, {curve}] of measured) {
    const road = world.eRoad[edge];
    const weekday = curve.weekday.reduce((a,b) => a+b, 0) / 24;
    const weekend = curve.weekend.reduce((a,b) => a+b, 0) / 24;
    const weight = world.eLen[edge];
    const entry = use.get(road) ?? {sum:0, length:0};
    entry.sum += weight * (5*weekday + 2*weekend)/7;
    entry.length += weight;
    use.set(road,entry);
  }
  return Float32Array.from(world.r.cls, (cls,road) => {
    if (cls > RC.SERVICE) return 0;
    const base = cls <= RC.TRUNK_LINK ? 0.9 : cls <= RC.SECONDARY_LINK ? 0.72 :
      cls <= RC.TERTIARY_LINK ? 0.58 : cls <= RC.RESIDENTIAL ? 0.43 : 0.25;
    const entry = use.get(road);
    return entry?.length ? 0.42*base + 0.58*Math.min(1,entry.sum/entry.length) : base;
  });
}

export function roadStations(world) {
  const distance = new Float32Array(world.rpx.length);
  for (let road=0; road<world.rCount; road++) {
    for (let p=world.rOff[road]+1; p<world.rOff[road+1]; p++) {
      distance[p] = distance[p-1] + Math.hypot(world.rpx[p]-world.rpx[p-1],world.rpz[p]-world.rpz[p-1]);
    }
  }
  return distance;
}
