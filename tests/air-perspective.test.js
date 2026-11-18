import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { waterFogMap } = await import('../src/world/air-perspective.js');

test('mapa říční mlhy vychází z vody, zohledňuje výšku a směrem od břehu slábne', () => {
  const mask = new Uint8Array(16 ** 2);
  mask[1] = 3;
  mask[8 * 16 + 8] = 4;
  const world = { mask, maskS: 16, maskSX: 1, maskSZ: 1, minX: -8, minZ: -8,
    heightAt(x, z) { assert.deepEqual([x, z], [0.5, 0.5]); return 32; } };
  const values = waterFogMap(world, 8);
  const at = (x, z) => [...values.slice((z * 8 + x) * 4, (z * 8 + x) * 4 + 2)];
  const [river, level] = at(4, 4);
  assert.equal(river, 255);
  assert.ok(Math.abs(level / 255 * 640 - 128 - 32) < 2);
  assert.deepEqual(at(3, 4), at(5, 4));
  assert.ok(at(6, 4)[0] < at(5, 4)[0]);
  assert.equal(at(6, 4)[1], level);
  assert.deepEqual(at(0, 0), [0, 0]);
});
