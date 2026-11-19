import test from 'node:test';
import assert from 'node:assert/strict';
import { buildingLayers } from '../src/world/facade-surfaces.js';
import { SURFACE } from '../src/world/material-table.js';
test('fotomateriál odpovídá typu zdi a střechy a doložené značky dostanou přednost', () => {
  assert.deepEqual(buildingLayers(2, 1, SURFACE.panel, SURFACE.felt, 0), { wallLayer: 3, roofLayer: 10 });
  assert.deepEqual(buildingLayers(1, 4, SURFACE.plaster, SURFACE.tile, 0x15f8f7b), {
    wallLayer: 1,
    roofLayer: 9
  });
  assert.deepEqual(buildingLayers(1, 4, SURFACE.brick, SURFACE.tile, 0, [6, 11]), {
    wallLayer: 6,
    roofLayer: 11
  });
  assert.deepEqual(buildingLayers(3, 1, SURFACE.brick, SURFACE.sheet, 0), { wallLayer: 2, roofLayer: 8 });
});
