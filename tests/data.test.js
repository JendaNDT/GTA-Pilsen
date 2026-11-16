import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parsePack } from '../src/data.js';

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
