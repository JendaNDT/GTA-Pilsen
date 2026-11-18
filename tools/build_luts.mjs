import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const profiles = {
  den: { saturation: 0.98, gain: [1.023, 1, 0.982], lift: [0.006, 0.004, 0.002] },
  soumrak: { saturation: 0.97, gain: [1.048, 0.999, 0.974], lift: [0.016, 0.010, 0.021] },
  noc: { saturation: 0.98, gain: [1.042, 1.015, 1.032], lift: [0.006, 0.008, 0.016] },
};

export function makeColorLut(name, size = 17) {
  const { saturation, gain, lift } = profiles[name];
  const lines = [`# Vlastni barevne ladeni hry Plzen naplno`, `TITLE "${name}"`, `LUT_3D_SIZE ${size}`];
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const rgb = [r, g, b].map((channel) => channel / (size - 1));
    const brightness = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    const middle = 4 * brightness * (1 - brightness);
    const colors = rgb.map((channel, index) => {
      const value = (brightness + (channel - brightness) * saturation) * gain[index] + lift[index] * middle;
      return Math.max(0, Math.min(1, value)).toFixed(5);
    });
    lines.push(colors.join(' '));
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const output = process.argv[2] ?? 'data-raw/kandidat/luts';
  await mkdir(output, { recursive: true });
  for (const name of Object.keys(profiles)) await writeFile(join(output, `${name}.cube`), makeColorLut(name));
}
