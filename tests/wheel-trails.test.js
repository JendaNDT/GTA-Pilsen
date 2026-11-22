import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.window = {};
globalThis.location = { search: '' };
globalThis.matchMedia = () => ({ matches: false });
const { puddleAt } = await import('../src/world/puddles.js');
const { wheelTrail } = await import('../src/fx/wheel-trails.js');
const { RC } = await import('../src/config.js');
test('prach vzniká na suché polní cestě a v trávě, odstřik na mokré rovině uvnitř kaluže', () => {
  const road = { road: 0, dist: 0 },
    world = {
      r: { cls: [RC.TRACK], w: [6] },
      heightAt: () => 2,
      isSoft: () => true,
      isWater: () => false,
      nearestRoad: () => road
    };
  assert.equal(wheelTrail(world, 6, 0, 2, 0), 'dust');
  assert.equal(wheelTrail(world, 6, 0, 2, 1), null);
  world.r.cls[0] = RC.PRIMARY;
  assert.ok(puddleAt(6, 0, 1) > 0.5);
  assert.equal(wheelTrail(world, 6, 0, 2, 1), 'spray');
  assert.equal(wheelTrail(world, 6, 0, 2, 0), null);
  assert.equal(wheelTrail(world, -6, 0, 2, 1), null);
  world.heightAt = (x) => 2 + x * 0.2;
  assert.equal(wheelTrail(world, 6, 0, 2, 1), null);
  world.nearestRoad = () => null;
  assert.equal(wheelTrail(world, 6, 0, 2, 0), 'dust');
  world.isWater = () => true;
  assert.equal(wheelTrail(world, 6, 0, 2, 0), null);
});
