import { Vector4 } from 'three/webgpu';
import { Fn, If, Loop, float, mix, reflect, renderGroup, smoothstep, uniform, uniformArray, vec2, vec3 } from 'three/tsl';
import { valueNoise } from './material-noise.js';
import { OSTENDE, RADBUZA, WATER_PILOT_FADE } from './water-profile.js';

export const latestWaterRipple = uniform(-10).setGroup(renderGroup);
export const waterRipples = Array.from({ length: 4 }, () => new Vector4(0, 0, -10, 0));
const rings = uniformArray(waterRipples, 'vec4').setGroup(renderGroup);

function areaWeight(point, area) {
  const dx = point.x.sub(area.minX).min(float(area.maxX).sub(point.x));
  const dz = point.y.sub(area.minZ).min(float(area.maxZ).sub(point.y));
  return smoothstep(0, WATER_PILOT_FADE, dx.min(dz));
}

export function riverStreaks(point, field, env) {
  const result = float(0).toVar();
  const flow = field.rg.mul(255).sub(128).div(127).toVar();
  const speed = flow.length().toVar();
  const fade = smoothstep(45, 165, env.cam.xz.sub(point).length()).oneMinus().toVar();
  // Stojatá voda nemá v textuře směrový vektor. Dál od kamery se jemné stopy vytratí.
  If(speed.greaterThan(0.06).and(fade.greaterThan(0.001)), () => {
    const axis = flow.div(speed).toVar();
    const coord = point.mul(0.72).toVar();
    const stretch = axis.mul(0.83);
    // Vzorek zůstává ve světových souřadnicích. Směr proudu ho jen posouvá a protahuje.
    const sample = phase => {
      const p = coord.sub(flow.mul(phase, 6 * 2.0 * 0.72)).toVar();
      return mix(valueNoise(p), valueNoise(p.add(stretch)), 0.46);
    };
    // Dva posunuté cykly přecházejí jeden do druhého, takže stopy nezačínají znovu skokem.
    const first = env.time.div(6).fract().toVar();
    const second = first.add(0.5).fract();
    const streak = mix(sample(first), sample(second), first.mul(2).sub(1).abs());
    const wet = smoothstep(0.015, 0.22, field.b);
    result.assign(smoothstep(0.56, 0.80, streak).mul(wet, fade, smoothstep(0.06, 0.36, speed)));
  });
  return result;
}

export function waterOptics(point, field, env) {
  const river = areaWeight(point, RADBUZA);
  const lake = areaWeight(point, OSTENDE);
  const weight = river.max(lake);
  const flow = field.rg.mul(255).sub(128).div(127);
  const normal = Fn(() => {
    const p = point.sub(flow.mul(env.time)).toVar();
    const sway = valueNoise(p.mul(0.19)).mul(1.8).toVar();
    const broad = p.dot(vec2(0.58, 1.73)).add(sway, env.time.mul(0.62)).sin();
    const fine = p.dot(vec2(-2.2, 1.32)).sub(sway, env.time.mul(0.9)).sin();
    const cross = p.dot(vec2(3.12, 1.85)).add(sway, env.time.mul(1.52)).sin();
    const fade = smoothstep(38, 215, env.cam.xz.sub(point).length()).oneMinus();
    const strength = mix(0.024, 0.072, river).mul(fade);
    return vec3(broad.mul(0.52).add(fine.mul(0.25), cross.mul(0.18)).mul(strength),
      1, broad.mul(0.65).sub(fine.mul(0.25)).add(cross.mul(0.30)).mul(strength)).normalize();
  })();

  const ripple = Fn(() => {
    const result = float(0).toVar();
    If(env.time.sub(latestWaterRipple).lessThan(2.35), () => {
      Loop(waterRipples.length, ({ i }) => {
        const ring = rings.element(i).toVar();
        const age = env.time.sub(ring.z).clamp(0, 4).toVar();
        const distance = point.sub(ring.xy).sub(flow.mul(age, 0.65)).length();
        const radius = age.mul(ring.w.mul(0.85).add(0.70));
        const edge = smoothstep(0.025, 0.19, distance.sub(radius).abs()).oneMinus();
        const life = smoothstep(0.02, 0.17, age).mul(smoothstep(0.48, 2.35, age).oneMinus());
        result.assign(result.max(edge.mul(life, ring.w)));
      });
    });
    return result;
  })();

  const shade = (view, foam) => {
    const fresnel = view.dot(normal).saturate().oneMinus().pow(4.5).mul(0.65).add(0.045);
    const shallows = mix(vec3(0.092, 0.225, 0.270), vec3(0.28, 0.27, 0.16), lake);
    const depth = smoothstep(0.01, 0.82, field.b);
    const bed = mix(shallows, vec3(0.033, 0.132, 0.180), depth);
    // Dvě rozbíhající se pěnové stopy za zaměřeným středním pilířem Wilsonova mostu.
    const downstream = float(450).sub(point.y);
    const center = downstream.mul(0.11).add(202.76);
    const sides = point.x.sub(center).abs().sub(downstream.max(0).mul(0.18).add(1.45)).abs();
    const wake = smoothstep(0.10, 1.4, sides).oneMinus().mul(
      smoothstep(0, 3, downstream), smoothstep(10, 32, downstream).oneMinus());
    const foamStream = smoothstep(0.54, 0.87, valueNoise(point.sub(flow.mul(env.time)).mul(vec2(1.75, 0.67))))
      .mul(river, field.b, wake.mul(0.22).add(0.055));
    const foamTint = vec3(0.62, 0.73, 0.74);
    const tint = mix(mix(bed, env.sky, fresnel), foamTint, foam.max(foamStream).max(ripple.mul(0.50)));
    const glint = reflect(view.negate(), normal).dot(env.sunDir).saturate().pow(105)
      .mul(env.night.oneMinus(), 0.44);
    return { tint, glint };
  };
  return { normal, weight, shade };
}
