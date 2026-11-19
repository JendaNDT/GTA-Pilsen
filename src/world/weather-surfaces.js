import { Fn, If, mix, normalWorldGeometry, renderGroup, smoothstep, uniform, vec3 } from 'three/tsl';

export const snowDepth = uniform(0).setGroup(renderGroup);
export const weatherFog = uniform(0).setGroup(renderGroup);
export const cloudCover = uniform(.41).setGroup(renderGroup);

export function snowColor(color, exposure = 1) {
  return Fn(() => {
    const result = color.toVar();
    // Za sucha se sklon povrchu ani vliv sněhové pokrývky nevyhodnocují.
    If(snowDepth.greaterThan(0), () => {
      const coverage = smoothstep(.17, .88, normalWorldGeometry.y).mul(snowDepth, exposure);
      result.assign(mix(result, vec3(.79, .85, .9), coverage));
    });
    return result;
  })();
}
