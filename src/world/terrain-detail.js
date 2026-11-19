import { layerAtlas } from './layer-atlas.js';
import * as THREE from 'three/webgpu';
import {
  Fn,
  If,
  materialReference,
  mix,
  normalWorldGeometry,
  positionWorld,
  smoothstep,
  struct,
  texture,
  transformNormalToView,
  vec2,
  vec3
} from 'three/tsl';

const layers = 6;
let atlases;
function textures() {
  if (!atlases) {
    const maps = layerAtlas({directory:'terrain',columns:3,rows:2,layers,sourceSide:512},
      {barva:[128,128,128],normaly:[128,128,255]});
    atlases = {color:maps.barva,normal:maps.normaly};
  }
  return atlases;
}

const sampleType = struct({ gain: 'vec3', normal: 'vec3' });

export function terrainDetailNodes(camera) {
  const maps = textures();
  const mask = materialReference('terrainClasses', 'texture');
  const sample = Fn(() => {
    const gain = vec3(1).toVar(),
      n = normalWorldGeometry.toVar(),
      surfaceNormal = vec3(n).toVar();
    const code = mask.r.mul(255).round().toVar();
    const dist = camera.sub(positionWorld).length();
    const fade = smoothstep(80, 120, dist).oneMinus().toVar();
    If(code.greaterThan(0).and(fade.greaterThan(0)), () => {
      const layer = code
          .sub(1)
          .clamp(0, layers - 1)
          .toInt(),
        p = positionWorld.mul(0.36).toVar();
      const plane = (map, uv) => texture(map, uv).depth(layer).rgb;
      const yUv = vec2(p.x, p.z.negate()),
        cy = plane(maps.color, yUv),
        ny = plane(maps.normal, yUv).xy.mul(2).sub(1);
      const tint = cy.toVar(),
        delta = vec3(ny.x, 0, ny.y.negate()).toVar();
      If(n.y.lessThan(Math.cos((35 * Math.PI) / 180)), () => {
        const weights = n.abs().pow(4).toVar();
        weights.divAssign(weights.x.add(weights.y, weights.z).max(0.001));
        const sx = n.x.sign(),
          sz = n.z.sign();
        const xUv = vec2(p.z.mul(sx.negate()), p.y),
          zUv = vec2(p.x.mul(sz), p.y);
        const nx = plane(maps.normal, xUv).xy.mul(2).sub(1),
          nz = plane(maps.normal, zUv).xy.mul(2).sub(1);
        tint.assign(
          cy.mul(weights.y).add(plane(maps.color, xUv).mul(weights.x), plane(maps.color, zUv).mul(weights.z))
        );
        delta.assign(
          delta
            .mul(weights.y)
            .add(
              vec3(0, nx.y, nx.x.mul(sx.negate())).mul(weights.x),
              vec3(nz.x.mul(sz), nz.y, 0).mul(weights.z)
            )
        );
      });
      gain.assign(mix(vec3(1), tint.mul(2), fade.mul(0.85)));
      surfaceNormal.assign(n.add(delta.mul(fade, 0.48)).normalize());
    });
    return sampleType(gain, surfaceNormal);
  })();
  return { gain: sample.get('gain'), normal: transformNormalToView(sample.get('normal')) };
}

export function terrainMaskTexture(data) {
  const size = Math.sqrt(data.length);
  const mask = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  mask.needsUpdate = true;
  return mask;
}
