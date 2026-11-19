import { graphicAsset } from './graphic-asset.js';
import { Data3DTexture, LinearFilter } from 'three/webgpu';

export const LUT_NAMES = ['den', 'soumrak', 'noc'];

const smooth = (x, a, b) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Váhy podle výšky slunce, které sečtené dávají jedna i při rozednění. */
export function lutWeights(elevation) {
  const day = smooth(elevation, -0.045, 0.22);
  const night = 1 - smooth(elevation, -0.17, -0.045);
  return [day, 1 - day - night, night];
}

export function parseColorLut(text) {
  const rows = text.split(/\r?\n/).map((row) => row.trim())
    .filter((row) => row && !row.startsWith('#') && !row.startsWith('TITLE '));
  const size = Number(rows.shift()?.match(/^LUT_3D_SIZE (\d+)$/)?.[1]);
  if (!Number.isInteger(size) || size < 2 || size > 64 || rows.length !== size ** 3) {
    throw new Error('Barevná tabulka má chybný rozměr.');
  }
  const data = new Uint8Array(rows.length * 4);
  for (const [index, row] of rows.entries()) {
    const rgb = row.split(/\s+/).map(Number);
    if (rgb.length !== 3 || rgb.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
      throw new Error('Barevná tabulka obsahuje neplatnou barvu.');
    }
    for (let channel = 0; channel < 3; channel++) data[index * 4 + channel] = Math.round(rgb[channel] * 255);
    data[index * 4 + 3] = 255;
  }
  return { data, size };
}

export function lutTexture(data, size) {
  const texture = new Data3DTexture(data, size, size, size);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function blendLutData(target, tables, weights) {
  const [day, dusk, night] = tables;
  const [a, b, c] = weights;
  for (let i = 0; i < target.length; i++) target[i] = Math.round(day[i] * a + dusk[i] * b + night[i] * c);
}

export async function loadColorLuts(base) {
  // Na tabulky čeká start hry. Atlasy načítané do běžící scény se mohou doplnit později.
  const signal = AbortSignal.timeout(12000);
  const luts = await Promise.all(LUT_NAMES.map(async (name) => {
    const blob = await graphicAsset('luts/' + name + '.cube', base, signal);
    return parseColorLut(await blob.text());
  }));
  if (luts.some(({ size }) => size !== luts[0].size)) throw new Error('Barevné tabulky mají různé rozměry.');
  return luts;
}
