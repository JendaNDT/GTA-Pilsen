import { DataTexture, LinearFilter } from 'three/webgpu';
import { Fn, getViewPosition, isBackgroundDepth, mix, smoothstep, texture, uniform, uv, vec2, vec4 } from 'three/tsl';
import { env } from './materials.js';

const MIN_WATER_Y = -128;
const WATER_HEIGHT_RANGE = 640;

export function waterFogMap(world, size = 256) {
  const pixels = new Uint8Array(size * size * 4);
  const step = world.maskS / size;
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    let water = -1;
    for (let j = 0; j < step && water < 0; j++) for (let i = 0; i < step; i++) {
      const index = (z * step + j) * world.maskS + x * step + i;
      if (world.mask[index] & 4) { water = index; break; }
    }
    if (water < 0) continue;
    const wx = world.minX + (water % world.maskS + 0.5) / world.maskSX;
    const wz = world.minZ + (Math.floor(water / world.maskS) + 0.5) / world.maskSZ;
    const level = Math.round(Math.max(0, Math.min(1, (world.heightAt(wx, wz) - MIN_WATER_Y) / WATER_HEIGHT_RANGE)) * 255);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const mx = x + dx, mz = z + dz;
      if (mx < 0 || mx >= size || mz < 0 || mz >= size) continue;
      const offset = (mz * size + mx) * 4;
      const strength = Math.round(255 * Math.exp(-(dx * dx + dz * dz) / 2.5));
      if (strength <= pixels[offset]) continue;
      pixels[offset] = strength;
      pixels[offset + 1] = level;
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

export function makeAirPerspective(camera, world, view) {
  const size = 256;
  const field = new DataTexture(waterFogMap(world, size), size, size);
  field.magFilter = LinearFilter;
  field.minFilter = LinearFilter;
  field.needsUpdate = true;
  const start = vec2(world.minX, world.minZ);
  const width = vec2(world.maxX - world.minX, world.maxZ - world.minZ);
  const inverse = uniform(camera.projectionMatrixInverse);
  const cameraWorld = uniform(camera.matrixWorld);
  const cameraLocal = uniform(camera.position);

  const color = (image, depth) => Fn(() => {
    const distanceDepth = depth.sample(uv()).r.toVar();
    const local = getViewPosition(uv(), distanceDepth, inverse).toVar();
    const worldPosition = cameraWorld.mul(vec4(local, 1)).xyz.toVar();
    const distance = local.length();
    const airHeight = mix(cameraLocal.y, worldPosition.y, 0.7).add(15).max(0);
    const haze = smoothstep(view * 0.32, view * 1.27, distance).mul(airHeight.div(-190).exp().mul(0.7).add(0.3));
    const coordinate = worldPosition.xz.sub(start).div(width);
    const water = texture(field, coordinate).rg.toVar();
    const waterY = water.y.mul(WATER_HEIGHT_RANGE).add(MIN_WATER_Y);
    const lowAir = worldPosition.y.sub(waterY).max(0).div(-18).exp();
    const riverMist = water.x.mul(lowAir, env.morningFog, smoothstep(15, 470, distance), 0.72);
    const amount = isBackgroundDepth(distanceDepth).select(0, haze.max(riverMist));
    return vec4(mix(image.rgb, env.sky, amount), image.a);
  })();
  return { color, field };
}
