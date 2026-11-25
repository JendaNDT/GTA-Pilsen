import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approachHeight, surveyedApproaches } from '../src/world/underpasses.js';

test('výška samostatného nájezdu sleduje délku lomené osy a končí u opěry', () => {
  const world = { baseElevation: 310, rOff: [0, 3], rpx: [0, 3, 3], rpz: [0, 0, 4] };
  const result = surveyedApproaches(world, [[0, 100, 700, [31100, 31250, 31400]]]).get(0);
  const { path } = result.spans[0];
  assert.deepEqual(path.x, [1, 3, 3]);
  assert.deepEqual(path.z, [0, 1, 4]);
  assert.equal(approachHeight(result, 2), 1.5);
  assert.equal(approachHeight(result, 7), 4);
  assert.ok(Number.isNaN(approachHeight(result, 0.99)));
  assert.ok(Number.isNaN(approachHeight(result, 7.02)));
  assert.equal(surveyedApproaches(world, [[0, 0, 0, [31000, 31020]]]).size, 0);
});
