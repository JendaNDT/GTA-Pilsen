import { RC } from '../config.js';
import { puddleAt } from '../world/puddles.js';

export function wheelTrail(world, x, z, y, wet, out = {}) {
  const near = world.nearestRoad(x, z, 16, 99, 0, out, y);
  if (near && near.dist <= world.r.w[near.road] * 0.5) {
    if (world.r.cls[near.road] === RC.TRACK) return wet < 0.35 ? 'dust' : null;
    if (!wet || world.r.cls[near.road] > RC.SERVICE) return null;
    const grade =
      Math.hypot(
        world.heightAt(x + 1, z) - world.heightAt(x - 1, z),
        world.heightAt(x, z + 1) - world.heightAt(x, z - 1)
      ) * 0.5;
    return puddleAt(x, z, wet, grade) > 0.3 ? 'spray' : null;
  }
  return wet < 0.35 && world.isSoft(x, z) && !world.isWater(x, z) ? 'dust' : null;
}
