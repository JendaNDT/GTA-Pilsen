import { RC } from '../config.js';

export function surfaceContext(world, districts, x, z) {
  if (districts.at(x, z)) return 2;
  return Number((world.bChunks[world.chunkIndex(x, z)]?.length ?? 0) >= 44);
}

export function roadVerge(world, districts) {
  const verge = new Uint8Array(world.rCount);
  for (let i = 0; i < world.rCount; i++) {
    if (world.r.cls[i] < RC.PRIMARY || world.r.cls[i] > RC.LIVING) continue;
    const mid = (world.rOff[i] + world.rOff[i + 1]) >> 1;
    verge[i] = surfaceContext(world, districts, world.rpx[mid], world.rpz[mid]);
  }
  return verge;
}
