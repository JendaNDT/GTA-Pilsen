import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { Orthophoto, orthophotoBlocks, orthophotoTile } from '../src/world/orthophoto.js';

const grid = { origin: [-256, -512], chunk: 256, cols: 12, rows: 8, fingerprints: { terrain: 'abc', land: 'def' } };
const keys = ['0_0', '1_0', '2_0', '0_1'];
const manifest = {
  version: 1, crs: 'EPSG:5514', origin: grid.origin, metersPerPixel: 2, blockMeters: 1024,
  sources: grid.fingerprints,
  blocks: Object.fromEntries(keys.map((key) => [key, { file: `${key}.webp`, bytes: 256, sha256: '0'.repeat(64) }])),
};

test('výřezy snímků odpovídají společnému počátku a krajům dlaždic', () => {
  assert.deepEqual(orthophotoTile(3 + 7 * grid.cols, grid.cols, 256),
    { key: '0_1', left: 384, top: 384, pixels: 128 });
  assert.deepEqual(orthophotoTile(4 + 4 * grid.cols, grid.cols, 256),
    { key: '1_1', left: 0, top: 0, pixels: 128 });
});

test('chybný katalog nebo rozdílné podklady vypnou letecké snímky', () => {
  assert.equal(orthophotoBlocks(manifest, grid).size, keys.length);
  assert.equal(orthophotoBlocks({ ...manifest, origin: [0, 0] }, grid), null);
  assert.equal(orthophotoBlocks({ ...manifest, sources: { terrain: 'abc', land: 'jiný' } }, grid), null);
  assert.equal(orthophotoBlocks({ ...manifest, blocks: { '9_2': manifest.blocks['0_0'] } }, grid), null);
  assert.equal(orthophotoBlocks(null, grid), null);
});

test('počet požadavků i bitmap je omezený a vzdálené bitmapy se uvolní', async () => {
  const transfers = new Map();
  const closed = [];
  let slots = 0;
  const ortho = new Orthophoto(grid, 2, {
    base: '',
    availableRequests: () => slots,
    fetchFile: (file) => file === 'index.json' ? { ok: true, json: () => manifest } : new Promise((resolve) => {
      transfers.set(file, (ok = true) => resolve({ ok, blob: () => file }));
    }),
    decode: (file) => ({ width: 512, height: 512, close: () => closed.push(file) }),
  });
  await ortho.load();
  ortho.prefetch(keys);
  assert.equal(transfers.size, 0);
  slots = 2;
  ortho.prefetch(keys);
  assert.deepEqual([...transfers.keys()], ['0_0.webp', '1_0.webp']);
  transfers.get('0_0.webp')();
  await setImmediate();
  assert.ok(ortho.get('0_0'));

  ortho.prefetch(['2_0', '0_1']);
  assert.equal(ortho.pending.size, 2);
  assert.deepEqual(closed, ['0_0.webp']);
  transfers.get('1_0.webp')();
  await setImmediate();
  assert.ok(transfers.has('0_1.webp'));
  assert.deepEqual(closed, ['0_0.webp', '1_0.webp']);

  transfers.get('2_0.webp')(false);
  transfers.get('0_1.webp')();
  await setImmediate();
  ortho.prefetch(['2_0', '0_1']);
  assert.equal(ortho.get('2_0'), null);
  assert.ok(ortho.get('0_1'));
  assert.equal(ortho.pending.size, 0);
});
