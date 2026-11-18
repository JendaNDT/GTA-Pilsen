// Ze stejných měřených střech vytvoří malý podklad fyziky nezávislý na grafických dlaždicích.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parsePack } from '../src/data.js';

const source = 'public/detail/city';
const output = process.argv[2];
if (!output) throw new Error('Zadej cestu k výstupnímu souboru.');
const manifest = JSON.parse(await readFile(join(source, 'index.json'), 'utf8'));
const tiles = [];
for (const [cx, cz, name] of manifest.tiles) {
  const bytes = await readFile(join(source, name));
  const pack = parsePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const vertices = [], indices = [], seen = new Map();
  for (const id of pack.roof) {
    const point = pack.p.subarray(id * 3, id * 3 + 3);
    const key = point.join(',');
    if (!seen.has(key)) {
      seen.set(key, vertices.length / 3);
      vertices.push(...point);
    }
    indices.push(seen.get(key));
  }
  tiles.push([cx, cz, vertices, indices]);
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ source: manifest.sha256, tiles }));
