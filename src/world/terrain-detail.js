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

const layers = 6,
  side = 512;
let atlases;

function neutralTexture(r, g, b) {
  const bytes = new Uint8Array(4 * layers);
  for (let i = 0; i < layers; i++) bytes.set([r, g, b, 255], i * 4);
  const result = new THREE.DataArrayTexture(bytes, 1, 1, layers);
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.magFilter = THREE.LinearFilter;
  result.minFilter = THREE.LinearMipmapLinearFilter;
  result.generateMipmaps = true;
  result.needsUpdate = true;
  return result;
}

async function readLayers(name) {
  const response = await fetch('textures/terrain/' + name + '.webp');
  if (!response.ok) throw Error('Chybí atlas terénu ' + name);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    if (bitmap.width !== 3 * side || bitmap.height !== 2 * side) throw Error('Neplatný rozměr atlasu terénu.');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = side;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const bytes = new Uint8Array(layers * side * side * 4);
    for (let layer = 0; layer < layers; layer++) {
      ctx.drawImage(bitmap, (layer % 3) * side, Math.floor(layer / 3) * side, side, side, 0, 0, side, side);
      bytes.set(ctx.getImageData(0, 0, side, side).data, layer * side * side * 4);
    }
    return bytes;
  } finally {
    bitmap.close();
  }
}

function textures() {
  if (atlases) return atlases;
  const maps = { color: neutralTexture(128, 128, 128), normal: neutralTexture(128, 128, 255) };
  atlases = maps;
  Promise.all([readLayers('barva'), readLayers('normaly')])
    .then(([color, normal]) => {
      for (const [texture, data] of [
        [maps.color, color],
        [maps.normal, normal]
      ]) {
        // GPU vyžaduje novou alokaci při přechodu z neutrálního texelu na plné rozlišení.
        texture.dispose();
        texture.image = { data, width: side, height: side, depth: layers };
        texture.needsUpdate = true;
      }
    })
    .catch(() => {}); // Při nedostupné sadě dál funguje původní barva i osvětlení.
  return maps;
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
