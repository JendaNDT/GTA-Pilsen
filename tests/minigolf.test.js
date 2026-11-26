import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_HOLE, GolfScore, MINIGOLF_RADIUS, golfBallResult, golfWorldPoint } from '../src/game/minigolf-rules.js';
import { GolfBall } from '../src/physics/golf-ball.js';
import { loadJolt } from '../src/physics/jolt.js';
import { STEP_SECONDS } from '../src/physics/step.js';
import { PhysicsWorld } from '../src/physics/world.js';

test('jamka zachytí pomalý míček uprostřed a propustí rychlý nebo vysoký míček', () => {
  const { cup, x, z } = FIRST_HOLE;
  assert.deepEqual(golfWorldPoint(FIRST_HOLE, 0, 3), { x: x + 3, z });
  assert.equal(golfBallResult(FIRST_HOLE, 0, MINIGOLF_RADIUS, cup, 1), 'holed');
  assert.equal(golfBallResult(FIRST_HOLE, 0, MINIGOLF_RADIUS, cup, 1.5), null);
  assert.equal(golfBallResult(FIRST_HOLE, 0, 0.2, cup, 0.5), null);
  assert.equal(golfBallResult(FIRST_HOLE, 0.2, MINIGOLF_RADIUS, cup, 0.5), null);
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
  } finally {
    golf.dispose();
    world.dispose();
  }
});
