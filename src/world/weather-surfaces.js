import { mix, normalWorldGeometry, renderGroup, smoothstep, uniform, vec3 } from 'three/tsl';

export const snowDepth = uniform(0).setGroup(renderGroup);
export const weatherFog = uniform(0).setGroup(renderGroup);
export const cloudCover = uniform(.41).setGroup(renderGroup);

export function snowColor(color, exposure = 1) {
  const coverage = smoothstep(.17, .88, normalWorldGeometry.y).mul(snowDepth, exposure);
  return mix(color, vec3(.79, .85, .9), coverage);
}
