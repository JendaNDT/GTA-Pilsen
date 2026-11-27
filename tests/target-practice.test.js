import { parseSave } from '../src/game/save-data.js';
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

test('série počítá zásah, minutí i vypršení a po deseti terčích končí', () => {
  const round = new TargetRound(true);
  assert.equal(round.attempt(0, 0, 20), true);
  round.step(.65);
  assert.equal(round.attempt(21, 0, 20), false);
  assert.equal(round.attempt(0, 0, 20), null);
  round.step(.65 + 4.9);
  assert.equal(round.attempts, 2);
  round.step(.11);
  assert.equal(round.attempts, 3);
  round.step(60);
  assert.deepEqual([round.attempts, round.hits, round.finished], [10, 1, true]);
  assert.equal(round.attempt(0, 0, 20), null);
});

test('na desátém terči lze dosáhnout plného počtu bodů', () => {
  const round = new TargetRound(true);
  for (let i = 0; i < 10; i++) {
    assert.equal(round.attempt(0, 0, 20), true);
    round.step(.65);
  }
  assert.equal(round.finished, true);
  assert.equal(round.hits, 10);
});

test('uložená hra zachová i nulový rekord a přijme starší uložení bez rekordu', () => {
  const stats = best => parseSave(JSON.stringify({ v: 1, stats: { targetSeriesBest: best, bowlingBest: 81 } })).stats;
  for (const best of [undefined, -1, 11, 1.5, '3']) assert.deepEqual(stats(best), { bowlingBest: 81 });
  for (const best of [0, 10]) assert.deepEqual(stats(best), { targetSeriesBest: best, bowlingBest: 81 });
});
