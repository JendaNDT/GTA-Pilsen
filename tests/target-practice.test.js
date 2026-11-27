import assert from 'node:assert/strict';
import test from 'node:test';
import { TargetRound } from '../src/game/target-practice.js';

test('minutí i zásah se započtou, stejný terč jen jednou', () => {
  const round = new TargetRound();
  assert.equal(round.attempt(15, 16, 21), false);
  assert.equal(round.attempt(12, 16, 20), true);
  assert.equal(round.attempt(0, 0, 20), null);
  assert.deepEqual([round.hits, round.attempts], [1, 2]);
  round.step(.7);
  assert.equal(round.attempt(0, 0, 20), true);
  assert.deepEqual([round.hits, round.attempts], [2, 3]);
});

test('stejný čas určuje polohu dalšího terče při 30 i 120 snímcích za sekundu', () => {
  const at = fps => {
    const round = new TargetRound();
    round.attempt(0, 0, 20);
    for (let i = 0; i < fps * 2; i++) round.step(1 / fps);
    return round.position();
  };
  const slow = at(30), fast = at(120);
  assert.ok(Math.hypot(slow.x-fast.x, slow.y-fast.y) < 1e-10);
});
