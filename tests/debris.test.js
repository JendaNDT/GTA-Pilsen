import assert from 'node:assert/strict';
import test from 'node:test';
import { DebrisBudget } from '../src/physics/debris.js';

test('při přeplnění zmizí nejdřív nejstarší spící úlomky mimo záběr', () => {
  let limit = 5;
  const removed = [], pool = new DebrisBudget(() => limit, b => b.visible);
  for (const [id, active, visible] of [[1,true,true], [2,false,true], [3,false,false], [4,true,false], [5,false,false]]) {
    const body = { IsActive: () => active, visible };
    pool.add(body, () => removed.push(id));
  }
  assert.equal(pool.room(2), false);
  assert.equal(pool.step(20), 18);
  assert.deepEqual(removed, [3,5]);
  assert.equal(pool.room(2), true);
  limit = 1;
  assert.equal(pool.step(1), 0);
  assert.equal(pool.step(20), 19);
  assert.deepEqual(removed, [3,5,2,4]);
});
