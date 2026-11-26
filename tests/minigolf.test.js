import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOLF_HOLES, GolfRound, GolfScore, MINIGOLF_RADIUS, golfBallResult, golfWorldPoint } from '../src/game/minigolf-rules.js';
import { parseSave } from '../src/game/save-data.js';
import { GolfBall } from '../src/physics/golf-ball.js';
import { loadJolt } from '../src/physics/jolt.js';
import { STEP_SECONDS } from '../src/physics/step.js';
import { PhysicsWorld } from '../src/physics/world.js';

const [FIRST_HOLE, SECOND_HOLE, THIRD_HOLE] = GOLF_HOLES;

test('jamka zachytí pomalý míček uprostřed a propustí rychlý nebo vysoký míček', () => {
  const { cupZ, x, z } = FIRST_HOLE;
  assert.deepEqual(golfWorldPoint(FIRST_HOLE, 0, 3), { x: x + 3, z });
  assert.equal(golfBallResult(FIRST_HOLE, 0, MINIGOLF_RADIUS, cupZ, 1), 'holed');
  assert.equal(golfBallResult(FIRST_HOLE, 0, MINIGOLF_RADIUS, cupZ, 1.5), null);
  assert.equal(golfBallResult(FIRST_HOLE, 0, 0.2, cupZ, 0.5), null);
  assert.equal(golfBallResult(FIRST_HOLE, 0.2, MINIGOLF_RADIUS, cupZ, 0.5), null);
});

test('trestný úder i opakované stisknutí respektují limit sedmi úderů', () => {
  const score = new GolfScore();
  for (let i = 0; i < 6; i++) {
    assert.equal(score.strike(), true);
    assert.equal(score.strike(), false);
    score.settle('stopped');
  }
  assert.equal(score.strike(), true);
  score.settle('out');
  assert.equal(score.strokes, 7);
  assert.equal(score.phase, 'limit');
  assert.equal(score.strike(), false);
});

test('Jolt odrazí šikmý úder od lišty, vrátí odpálený míček a umožní dohrát jamku', async () => {
  const world = new PhysicsWorld(await loadJolt());
  const golf = new GolfBall(world, FIRST_HOLE, 5.3);
  let hit = false;
  world.onImpact = () => { hit = true; };
  const settle = () => {
    let edge = 0;
    for (let i = 0; i < 360 && golf.score.phase === 'rolling'; i++) {
      world.step(STEP_SECONDS);
      golf.step(STEP_SECONDS);
      edge = Math.max(edge, Math.abs(golf.x));
    }
    assert.notEqual(golf.score.phase, 'rolling');
    return edge;
  };
  try {
    golf.strike(0.5, 0.56);
    const edge = settle();
    assert.ok(edge > 0.95 && edge < 1.08);
    assert.ok(Math.abs(golf.x) < edge - 0.2);
    assert.equal(golf.score.lastResult, 'stopped');
    assert.equal(hit, false);
    golf.restart();
    golf.strike(0, 1);
    settle();
    assert.equal(golf.score.lastResult, 'out');
    assert.equal(golf.score.strokes, 2);
    assert.equal(golf.z, 0);
    golf.strike(0, 0.75);
    settle();
    assert.equal(golf.score.phase, 'holed');
    assert.equal(golf.score.strokes, 3);
    golf.restart();
    golf.strike(0, 0.5);
    settle();
    const lastStrike = golf.z;
    assert.ok(lastStrike > 3);
    golf.strike(0, 1);
    settle();
    assert.equal(golf.score.lastResult, 'out');
    assert.equal(golf.score.strokes, 3);
    assert.equal(golf.z, lastStrike);
  } finally {
    golf.dispose();
    world.dispose();
  }
});


test('rekord vznikne jen po úplné trojici a nepřepíše lepší nebo shodný výsledek', () => {
  const round = new GolfRound();
  const score = new GolfScore();
  assert.equal(round.finishHole(0, score), false);
  score.strike();
  score.settle('holed');
  assert.equal(round.finishHole(0, score), true);
  assert.equal(round.finishHole(0, score), false);
  assert.equal(round.finishHole(2, score), false);
  assert.equal(round.recordCandidate(), null);
  const limit = new GolfScore();
  while (limit.strike()) limit.settle('out');
  assert.equal(round.finishHole(1, limit), true);
  assert.equal(round.total, 8);
  assert.equal(round.complete, false);
  assert.equal(round.recordCandidate(), null);
  assert.equal(round.finishHole(2, score), true);
  assert.equal(round.complete, true);
  assert.equal(round.total, 9);
  assert.equal(round.recordCandidate(), 9);
  assert.equal(round.recordCandidate(11), 9);
  assert.equal(round.recordCandidate(9), null);
  assert.equal(round.recordCandidate(5), null);
  assert.equal(round.finishHole(3, score), false);
});

test('postup bez rekordu funguje dál a z uloženého rekordu projdou jen možné součty', () => {
  const load = (stats) => parseSave(JSON.stringify({ v: 2, stats })).stats;
  assert.deepEqual(load(undefined), {});
  assert.deepEqual(load({ minigolfBest: 3, taxijizdy: 4 }), { minigolfBest: 3, taxijizdy: 4 });
  assert.deepEqual(load({ minigolfBest: 21 }), { minigolfBest: 21 });
  for (const record of [null, '5', 0, 2, 2.5, 22]) {
    assert.deepEqual(load({ minigolfBest: record, taxijizdy: 4 }), { taxijizdy: 4 });
  }
});

test('druhá jamka má průjezdný odraz od mantinelu a třetí má dvě řešení kolem překážky', async () => {
  const world = new PhysicsWorld(await loadJolt());
  try {
    for (const [hole, strategy] of [
      [SECOND_HOLE, [[-25, 84]]],
      [THIRD_HOLE, [[-36, 95], [16, 30]]],
      [THIRD_HOLE, [[24, 90], [-22, 30]]],
    ]) {
      const golf = new GolfBall(world, hole, 5.4);
      const shoot = (angle, power) => {
        golf.strike(angle * Math.PI / 180, power / 100);
        let edge = 0;
        for (let i = 0; i < 360 && golf.score.phase === 'rolling'; i++) {
          world.step(STEP_SECONDS);
          golf.step(STEP_SECONDS);
          edge = Math.max(edge, Math.abs(golf.x));
        }
        assert.notEqual(golf.score.phase, 'rolling');
        return edge;
      };
      try {
        shoot(0, 75);
        assert.equal(golf.score.lastResult, 'stopped');
        assert.ok(golf.z < 2.3);
        golf.restart();
        assert.ok(shoot(...strategy[0]) > 1);
        if (strategy[1]) {
          assert.equal(golf.score.lastResult, 'stopped');
          assert.ok(golf.z > 4.2);
          assert.ok(golf.x * Math.sign(strategy[0][0]) < -0.4);
          shoot(...strategy[1]);
        }
        assert.equal(golf.score.phase, 'holed');
        assert.equal(golf.score.strokes, strategy.length);
      } finally {
        golf.dispose();
      }
    }
  } finally {
    world.dispose();
  }
});
