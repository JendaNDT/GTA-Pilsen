import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window = {};
globalThis.location = { search: '' };
globalThis.matchMedia = () => ({ matches: false });
const { grassPatch, grassGreenness } = await import('../src/world/grass.js');
const { LC } = await import('../src/config.js');
test('trsy se při návratu nemění a vynechají okraj louky, cestu, vodu i dům', () => {
  const w = {
    l: { cls: [LC.MEADOW] },
    chunkIndex: () => 0,
    landContains: (i, x, z) => x < 15,
    buildingAt: (x, z) => (z > 13 ? 1 : -1),
    isWater: (x, z) => x < 3,
    heightAt: () => 5,
    onCarriageway: (x, z, y, pad, maxClass) => {
      assert.equal(maxClass, 99);
      return z < 3;
    }
  };
  const manager = { world: w, landIndex: { polys: [[0]] } };
  const sample = () => grassPatch(manager, 0, 0, () => null);
  const rows = sample();
  assert.deepEqual(rows, sample());
  assert.ok(rows.length > 40);
  for (let k = 0; k < rows.length; k += 4) {
    assert.ok(rows[k] >= 3 && rows[k] < 15 && rows[k + 2] >= 3 && rows[k + 2] <= 13);
    assert.equal(rows[k + 1], 5);
  }
  assert.ok(grassGreenness(48, 130, 45) > grassGreenness(142, 110, 87));
});
