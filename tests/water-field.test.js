import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {};
globalThis.location = { search: '' };
globalThis.matchMedia = () => ({ matches: false });
const { waterField } = await import('../src/world/water.js');
const { LC } = await import('../src/config.js');

test('vodní pole zachová směr toku, klid vedlejšího rybníka, mělčinu a hranici dlaždice', () => {
  const land = {
    cls: [LC.WATER, LC.WATER],
    pRing: [0, 1, 2],
    ringStart: [0, 4, 8],
    vx: [-400, 1200, 1200, -400, -400, 1200, 1200, -400],
    vz: [0, 0, 320, 320, 350, 350, 600, 600],
    lCls: [0],
    lStart: [0, 2],
    lx: [-400, 1200],
    lz: [160, 160]
  };
  const field = (x) => waterField(land, [0, 1], [0], [[31.5, 15.5]], x, 0, 64, 64);
  const pixel = (tile, x, z) => [...tile.subarray((z * 64 + x) * 4, (z * 64 + x) * 4 + 4)];
  const west = field(0),
    east = field(32);
  assert.deepEqual(pixel(west, 33, 16), pixel(east, 1, 16));
  assert.deepEqual(pixel(west, 31, 15), [255, 128, 255, 255]);
  assert.deepEqual(pixel(west, 31, 40).slice(0, 2), [128, 128]);
  assert.deepEqual(pixel(west, 31, 33), [128, 128, 0, 0]);
  assert.ok(pixel(west, 31, 1)[2] < pixel(west, 31, 10)[2]);
  land.lx.reverse();
  assert.deepEqual(pixel(field(0), 31, 15).slice(0, 2), [1, 128]);
});
