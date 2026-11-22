import { graphicAsset } from './graphic-asset.js';
import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from 'three/webgpu';

// Každá vrstva má vlastní mipmapy a opakuje se bez prosakování sousední knihovní textury.
export function layerAtlas({ directory, columns, rows, layers, sourceSide, side = sourceSide }, channels) {
  const maps = {};
  for (const [name, neutral] of Object.entries(channels)) {
    const bytes = new Uint8Array(4 * layers);
    for (let i = 0; i < layers; i++) bytes.set([...neutral, 255], i * 4);
    const tex = new DataArrayTexture(bytes, 1, 1, layers);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    maps[name] = tex;
  }
  async function read(name) {
    const bitmap = await createImageBitmap(await graphicAsset('textures/' + directory + '/' + name + '.webp'));
    try {
      if (bitmap.width !== columns * sourceSide || bitmap.height !== rows * sourceSide)
        throw Error('Neplatný rozměr atlasu ' + directory);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = side;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const data = new Uint8Array(layers * side * side * 4);
      for (let i = 0; i < layers; i++) {
        ctx.drawImage(
          bitmap,
          (i % columns) * sourceSide,
          Math.floor(i / columns) * sourceSide,
          sourceSide,
          sourceSide,
          0,
          0,
          side,
          side
        );
        data.set(ctx.getImageData(0, 0, side, side).data, i * side * side * 4);
      }
      return data;
    } finally {
      bitmap.close();
    }
  }
  const names = Object.keys(channels);
  Promise.all(names.map(read))
    .then((arrays) => {
      for (let i = 0; i < arrays.length; i++) {
        const tex = maps[names[i]];
        tex.dispose();
        tex.image = { data: arrays[i], width: side, height: side, depth: layers };
        tex.needsUpdate = true;
      }
    })
    .catch(() => {}); // Při výpadku zůstávají použitelné neutrální vrstvy.
  return maps;
}
