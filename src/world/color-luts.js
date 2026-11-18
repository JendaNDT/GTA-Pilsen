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

export async function loadColorLuts(base) {
  const luts = await Promise.all(LUT_NAMES.map(async (name) => {
    const reply = await fetch(`${base}luts/${name}.cube`);
    if (!reply.ok) throw new Error(`Barevná tabulka ${name} je nedostupná.`);
    return parseColorLut(await reply.text());
  }));
  return luts.map(({ data, size }) => {
    const texture = new Data3DTexture(data, size, size, size);
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  });
}
