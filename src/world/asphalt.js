import { snowColor } from './weather-surfaces.js';
import { puddleNode } from './puddles.js';
import {attribute, float, Fn, mix, normalWorldGeometry, positionWorld, smoothstep, struct, transformNormalToView, vec2, vec3, vec4} from 'three/tsl';
import {hash21,valueNoise} from './material-noise.js';
import { detailFadeRange } from './image-quality.js';

// Buňky zrna v metrech; druhé pole je původní mizení pro ?obraz=puvodni (hrubé zrno tam nebylo).
export const STONE_FADE = detailFadeRange(1 / 32, [0.018, 0.10]);
export const COARSE_FADE = detailFadeRange(1 / 8, [-2, -1]);
export const SLOT_FADE = detailFadeRange(1 / 13, [0.018, 0.10]);

const sampleType = struct({gain:'float', roughness:'float', normal:'vec3', snow:'float'});

export function asphaltNodes(color, wet, camera) {
  const uv = attribute('roadMeters','vec2');
  const layout = attribute('roadLayout','vec3');
  const sample = Fn(() => {
    const p = positionWorld.xz.toVar(), distance = camera.sub(positionWorld).length();
    const near = smoothstep(34,90,distance).oneMinus().mul(layout.z.greaterThan(0).toFloat()).toVar();
    const lane = layout.x.max(0.5), width = layout.y.abs();
    const cross = uv.y.add(width).div(lane).fract().sub(0.5).abs().mul(lane);
    const track = smoothstep(0.12,0.42,cross.sub(lane.mul(0.24)).abs()).oneMinus().mul(layout.z).toVar();
    // Opakované metry podél osy drží spáry oprav i mříže na místě na hranicích dlaždic.
    const cell = vec2(uv.x.div(9),uv.y.add(width).div(lane));
    const seed = hash21(cell.floor());
    const rect = cell.fract().sub(0.5).abs();
    const patch = smoothstep(0.23,0.27,rect.x).oneMinus().mul(smoothstep(0.33,0.37,rect.y).oneMinus(),
      smoothstep(float(0.95).sub(layout.z.mul(0.22)),1,seed)).toVar();
    const curb = width.sub(uv.y.abs()).sub(0.29).abs();
    const end = uv.x.add(7).mod(31).sub(15.5).abs();
    const grate = smoothstep(0.18,0.22,curb).oneMinus().mul(smoothstep(0.36,0.40,end).oneMinus(),
      layout.y.greaterThan(0).toFloat()).toVar();
    const px = p.x.fwidth().max(p.y.fwidth());
    // Jemné zrno (buňka 3 cm) mizí dřív, než jeho buňka zabere méně než dva pixely, jinak za jízdy bliká.
    // Hrubší zrno (buňka 12,5 cm) drží strukturu asfaltu dál od kamery.
    const fine = smoothstep(...STONE_FADE,px).oneMinus().toVar();
    const coarse = smoothstep(...COARSE_FADE,px).oneMinus().mul(fine.oneMinus(),0.6).toVar();
    const stone = valueNoise(p.mod(32).mul(32)).sub(0.5).mul(fine)
      .add(valueNoise(p.mod(32).mul(8).add(vec2(1.7,3.1))).sub(0.5).mul(coarse)).toVar();
    const pores = valueNoise(p.mod(32).mul(32).add(vec2(4.3,8.7))).sub(0.5).mul(fine)
      .add(valueNoise(p.mod(32).mul(8).add(vec2(6.1,2.3))).sub(0.5).mul(coarse));
    const slots = smoothstep(0.32,0.56,uv.x.mul(13).fract()).mul(smoothstep(...SLOT_FADE,px).oneMinus());
    const dry = float(1).add(stone.mul(0.32),track.mul(-0.16),patch.mul(-0.21));
    const gain = mix(1,dry.mul(mix(1,0.77,wet)),near).mul(mix(1,float(0.52).sub(slots.mul(0.28)),grate.mul(near)));
    const rough = float(0.94).add(stone.mul(0.10),track.mul(-0.18),patch.mul(-0.12));
    const pool = puddleNode(p, wet, normalWorldGeometry.y).mul(near);
    const roughness = mix(mix(0.96,mix(rough,rough.mul(0.40),wet),near), 0.09, pool);
    const bump = near.mul(float(1).sub(track.mul(0.44)),float(1).sub(wet.mul(0.55)));
    const normal = vec3(stone.mul(bump,0.26),1,pores.mul(bump,0.26)).normalize();
    return sampleType(gain.mul(float(1).sub(pool.mul(0.16))),roughness,normal,track.mul(-.85).add(1));
  })();
  return {colorNode:vec4(snowColor(color.rgb.mul(sample.get('gain')), sample.get('snow')), 1),roughnessNode:sample.get('roughness'),
    normalNode:transformNormalToView(sample.get('normal'))};
}
