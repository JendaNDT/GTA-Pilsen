import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parsePack, assetFingerprint } from '../src/data.js';

const buffer = async (name) => {
  const data = await readFile(new URL(`../public/data/${name}.bin`, import.meta.url));
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
};

test('všechny distribuované balíčky lze dekódovat a mají úplné indexy geometrie', async () => {
  for (const name of ['buildings', 'roads', 'land', 'rails', 'trees', 'terrain']) {
    const pack = parsePack(await buffer(name));
    for (const [key, spec] of Object.entries(pack.header.arrays)) {
      assert.equal(pack[key].length, spec.length, `${name}.${key}`);
    }
    if (name === 'buildings') {
      assert.equal(pack.bRing.length, pack.header.count + 1);
      assert.equal(pack.bRing.at(-1), pack.ringStart.length - 1);
      assert.equal(pack.ringStart.at(-1), pack.vdx.length);
      assert.equal(pack.vdx.length, pack.vdz.length);
    } else if (name === 'roads' || name === 'rails') {
      assert.equal(pack.start.length, pack.header.count + 1);
      assert.equal(pack.start.at(-1), pack.dx.length);
      assert.equal(pack.dx.length, pack.dz.length);
      for (let i = 0; i < pack.header.count; i++) {
        const off = pack.bridgeOff[i];
        if (off !== 0xffffffff) {
          assert.ok(off + pack.start[i + 1] - pack.start[i] + 1 <= pack.bridgeY.length);
        }
      }
    } else if (name === 'land') {
      assert.equal(pack.pRing.length, pack.header.count + 1);
      assert.equal(pack.pRing.at(-1), pack.ringStart.length - 1);
      assert.equal(pack.ringStart.at(-1), pack.vx.length);
      assert.equal(pack.vx.length, pack.vz.length);
    } else if (name === 'trees') {
      assert.equal(pack.x.length, pack.header.count);
      assert.equal(pack.z.length, pack.header.count);
    } else {
      assert.equal(pack.rowStart.length, pack.header.rows);
      assert.equal(pack.d.length, pack.header.rows * (pack.header.cols - 1));
    }
  }
});

test('neznámý formát balíčku se odmítne', () => {
  assert.throws(() => parsePack(new ArrayBuffer(8)), /Neznámý formát dat/);
});

test('jemný terén odpovídá podkladům a všechny hrany dlaždic navazují', async () => {
  const pack = parsePack(await buffer('landscape'));
  const terrain = parsePack(await buffer('terrain')).header;
  const { g, cols, sources } = pack.header;
  const steps = 256 / g, width = steps + 1, size = width ** 2;
  const rows = (terrain.rows - 1) * terrain.g / 256;
  assert.equal(g, terrain.g / 2);
  assert.equal(cols, (terrain.cols - 1) * terrain.g / 256);
  assert.equal(pack.offsets.length, pack.tiles.length * size);
  assert.ok(pack.tiles.length > 150);
  for (const name of ['terrain', 'roads', 'rails', 'buildings', 'land']) {
    assert.equal(sources[name], assetFingerprint(await buffer(name)), name);
  }
  const tiles = new Map(Array.from(pack.tiles, (id, i) => [id, pack.offsets.subarray(i * size, (i + 1) * size)]));
  assert.equal(tiles.size, pack.tiles.length);
  for (const [id, data] of tiles) {
    const col = id % cols, row = Math.floor(id / cols);
    assert.ok(row < rows);
    const west = col > 0 ? tiles.get(id - 1) : null;
    const east = col + 1 < cols ? tiles.get(id + 1) : null;
    const north = row > 0 ? tiles.get(id - cols) : null;
    const south = row + 1 < rows ? tiles.get(id + cols) : null;
    for (let i = 0; i < width; i++) {
      assert.equal(data[i * width], west?.[i * width + steps] ?? 0);
      assert.equal(data[i * width + steps], east?.[i * width] ?? 0);
      assert.equal(data[i], north?.[steps * width + i] ?? 0);
      assert.equal(data[steps * width + i], south?.[i] ?? 0);
    }
  }
});

test('metadata obsahují datum OSM s doloženým zdrojem nebo výslovně neznámé historické datum', async () => {
  const meta = JSON.parse(await readFile(new URL('../public/data/meta.json', import.meta.url)));
  if (meta.osmTimestampSource === 'unknown-legacy') {
    assert.equal(meta.osmTimestamp, null);
  } else {
    assert.equal(meta.osmTimestampSource, 'pbf-header');
    assert.match(meta.osmTimestamp, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.ok(Number.isFinite(Date.parse(meta.osmTimestamp)));
  }
});

test('všechny balíčky měřeného centra mají platné indexy a jednoho vlastníka náhrady OSM', async () => {
  const root = new URL('../public/detail/city/', import.meta.url);
  const index = JSON.parse(await readFile(new URL('index.json', root)));
  const osm = await buffer('buildings'), terrain = await buffer('terrain');
  assert.equal(index.osm, assetFingerprint(osm));
  assert.equal(index.terrain, assetFingerprint(terrain));
  assert.equal(new Set(index.districts.map(([id]) => id)).size, 10);
  const b = parsePack(osm), replacements = new Set();
  const blobs = await Promise.all(index.tiles.map(async ([x, z, name, , matched]) => ({
    x, z, name, matched, bytes: await readFile(new URL(name, root)),
  })));
  let records = 0;
  for (const { x, z, name, matched, bytes } of blobs) {
    const pack = parsePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.equal(pack.header.cx, x);
    assert.equal(pack.header.cz, z);
    records += pack.header.count;
    for (const i of matched) {
      assert.ok(i >= 0 && i < b.header.count && !replacements.has(i), `${name} #${i}`);
      replacements.add(i);
    }
    const size = pack.p.length;
    assert.equal(size % 3, 0);
    for (const key of ['n', 'c', 'win']) assert.equal(pack[key].length, size);
    for (const key of ['i', 'roof']) {
      assert.equal(pack[key].length % 3, 0);
      assert.ok(pack[key].every((i) => i < size / 3), `${name}.${key}`);
    }
  }
  assert.equal(records, index.buildings);
});
