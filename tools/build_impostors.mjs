// Ortografické pohledy na čtyři vlastní modely přes horní polovinu osmistěnu.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { Vector3, Color } from 'three/webgpu';
import { TREE_FRAME, TREE_PIVOT, TREE_TYPES, SEASON_TINT, treeModel } from '../src/world/tree-models.js';

const tile = 64,
  grid = 5,
  width = grid * tile * TREE_TYPES.length,
  height = grid * tile * 4;
const pixels = Buffer.alloc(height * (width * 4 + 1));
const up = new Vector3(0, 1, 0),
  c = new Color();
const edge = (a, b, x, y) => (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
function bake(geo, type, season, ix, iy) {
  const u = (2 * ix) / (grid - 1) - 1,
    v = (2 * iy) / (grid - 1) - 1;
  const x = (u + v) * 0.5,
    z = (u - v) * 0.5;
  const dir = new Vector3(x, 1 - Math.abs(x) - Math.abs(z), z).normalize();
  const right = dir.y > 0.999 ? new Vector3(1, 0, 0) : up.clone().cross(dir).normalize();
  const top = dir.clone().cross(right);
  const depth = new Float32Array(tile * tile).fill(-Infinity);
  const { position, normal, color, foliage } = geo.attributes;
  const bounds = new Vector3(),
    points = [];
  for (let k = 0; k < position.count; k++) {
    bounds.fromBufferAttribute(position, k);
    bounds.y -= TREE_PIVOT;
    points.push({
      x: tile * (0.5 + right.dot(bounds) / TREE_FRAME),
      y: tile * (0.5 + top.dot(bounds) / TREE_FRAME),
      d: dir.dot(bounds)
    });
  }
  for (let i = 0; i < points.length; i += 3) {
    const leaf = foliage.getX(i) === 1 && type !== 1;
    if (leaf && season === 3) continue;
    const a = points[i],
      b = points[i + 1],
      d = points[i + 2],
      area = edge(a, b, d.x, d.y);
    if (area < 1e-5) continue;
    const shade = 0.74 + 0.26 * Math.max(0, normal.getY(i) * 0.8 + normal.getX(i) * 0.35);
    const tint = leaf ? SEASON_TINT[season] : SEASON_TINT[1];
    c.setRGB(
      color.getX(i) * shade * tint[0],
      color.getY(i) * shade * tint[1],
      color.getZ(i) * shade * tint[2]
    ).convertLinearToSRGB();
    const rgba = [Math.round(255 * c.r), Math.round(255 * c.g), Math.round(255 * c.b), 255];
    for (
      let row = Math.max(0, Math.floor(Math.min(a.y, b.y, d.y)));
      row < Math.min(tile, Math.ceil(Math.max(a.y, b.y, d.y)));
      row++
    ) {
      for (
        let col = Math.max(0, Math.floor(Math.min(a.x, b.x, d.x)));
        col < Math.min(tile, Math.ceil(Math.max(a.x, b.x, d.x)));
        col++
      ) {
        const w = edge(b, d, col + 0.5, row + 0.5) / area,
          h = edge(d, a, col + 0.5, row + 0.5) / area;
        if (w < 0 || h < 0 || w + h > 1) continue;
        const distance = w * a.d + h * b.d + (1 - w - h) * d.d,
          k = row * tile + col;
        if (distance < depth[k]) continue;
        depth[k] = distance;
        const atlasRow = height - 1 - ((season * grid + iy) * tile + row);
        pixels.set(rgba, atlasRow * (width * 4 + 1) + 1 + 4 * ((type * grid + ix) * tile + col));
      }
    }
  }
}
for (let type = 0; type < TREE_TYPES.length; type++) {
  const geo = treeModel(type);
  for (let season = 0; season < 4; season++)
    for (let iy = 0; iy < grid; iy++) for (let ix = 0; ix < grid; ix++) bake(geo, type, season, ix, iy);
  geo.dispose();
}
function chunk(name, data) {
  const payload = Buffer.concat([Buffer.from(name), data]),
    length = Buffer.alloc(4),
    sum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, sum]);
}
const output = process.argv[2];
if (!output) throw Error('Zadejte cestu k výslednému atlasu PNG.');
const hdr = Buffer.alloc(13);
hdr.writeUInt32BE(width);
hdr.writeUInt32BE(height, 4);
hdr[8] = 8;
hdr[9] = 6;
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', hdr),
    chunk('IDAT', deflateSync(pixels, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
);
