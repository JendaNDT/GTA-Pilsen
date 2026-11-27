import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EightBall } from '../src/game/eight-ball.js';
import { choosePoolShot, planTableShot } from '../src/game/pool-opponent.js';
import { PoolTable } from '../src/physics/pool-table.js';
import { loadJolt } from '../src/physics/jolt.js';

const ball = (number, x, z) => ({ number, x, z });

test('počítač míří na svou skupinu a na černou přejde až po jejím dohrání', () => {
  const match = new EightBall(2);
  match.breakShot = false;
  match.groups[2] = 'plné';
  const balls = [ball(0, 0, 0), ball(1, .25, 0), ball(8, -.2, 0), ball(10, -.3, .6)];
  assert.equal(choosePoolShot(balls, match).degrees, 0);
  match.remaining.plné = 0;
  assert.equal(Math.abs(choosePoolShot(balls.filter(b => b.number !== 1), match).degrees), 180);
});

test('při zakrytém cíli zkouší soupeř odraz přes mantinel', () => {
  const match = new EightBall();
  match.breakShot = false;
  match.groups[1] = 'plné';
  const balls = [ball(0, -.35, -.3), ball(1, .35, -.3), ball(11, 0, -.3)];
  const shot = choosePoolShot(balls, match);
  assert.ok(Math.abs(shot.degrees) > 10);
  assert.equal(shot.power, 1);
});

test('soupeř po faulu položí bílou na volné místo a legálně potopí rozhodující černou', async () => {
  const table = new PoolTable(await loadJolt(), true);
  try {
    for (const [n, b] of table.balls.entries()) {
      if (n && n !== 8 && n !== 12) table.world.bodies.RemoveBody(b.GetID());
    }
    table.match.breakShot = false;
    table.match.player = 2;
    table.match.groups[2] = 'plné';
    table.match.remaining.plné = 0;
    table.match.inHand = true;
    table.place(table.balls[8], .16, 0);
    table.place(table.balls[12], -.05, .5);
    const shot = planTableShot(table);
    assert.ok(shot.placement);
    assert.ok(table.placeWhite(shot.placement.x, shot.placement.z));
    table.match.inHand = false;
    assert.ok(table.launch(shot.degrees, shot.power));
    for (let step = 0; step < 600 && table.rolling; step++) table.step(1 / 60);
    assert.equal(table.match.winner, 2);
    assert.equal(table.shot.first, 8);
    assert.equal(table.shot.scratch, false);
  } finally { table.dispose(); }
});

test('celá partie od rozstřelu do čisté výhry používá polohu koulí a fyziku obou hráčů', async () => {
  const table = new PoolTable(await loadJolt(), true);
  try {
    for (let i = 0; i < 100 && !table.complete; i++) {
      const shot = planTableShot(table);
      if (shot.placement) assert.ok(table.match.inHand && table.placeWhite(shot.placement.x, shot.placement.z));
      table.match.inHand = false;
      assert.ok(table.launch(shot.degrees, shot.power));
      for (let step = 0; step < 600 && table.rolling; step++) table.step(1 / 60);
      assert.equal(table.rolling, false);
    }
    assert.ok(table.complete);
    assert.equal(table.match.message, 'Černá je v kapse.');
  } finally { table.dispose(); }
});
