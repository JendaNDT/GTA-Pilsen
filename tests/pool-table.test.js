import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadJolt } from '../src/physics/jolt.js';
import { PoolTable, BALL_STARTS } from '../src/physics/pool-table.js';

test('tréninkový strk potopí barevnou, bílá se po pádu vrátí na volné místo a mantinel odráží', async () => {
  const table = new PoolTable(await loadJolt());
  function settle() {
    for (let i = 0; i < 600 && table.rolling; i++) table.world.update(1 / 60);
    assert.equal(table.rolling, false);
  }
  try {
    assert.equal(table.launch(0, .65), true);
    assert.equal(table.launch(20, 1), false);
    settle();
    assert.equal(table.potted, 1);
    assert.equal(table.scratch, false);
    const [cue, , second] = table.balls;
    table.place(second, ...BALL_STARTS[0]);
    table.place(cue, .42, 0);
    table.launch(0, .4);
    settle();
    assert.equal(table.scratch, true);
    assert.equal(table.potted, 1);
    assert.ok(Math.abs(cue.GetPosition().GetZ()) > .1);
    table.reset();
    table.place(cue, .45, .37);
    table.launch(0, .1);
    for (let i = 0; i < 15; i++) table.world.update(1 / 60);
    assert.ok(cue.GetLinearVelocity().GetX() < 0);
    assert.equal(table.potted, 0);
    settle();
    for (const target of table.balls.slice(1)) {
      table.place(target, .2, 0);
      table.place(cue, -.22, 0);
      table.launch(0, .7);
      settle();
    }
    assert.equal(table.complete, true);
    assert.equal(table.launch(0, .7), false);
    table.reset();
    assert.equal(table.potted, 0);
    assert.equal(table.launch(0, .7), true);
  } finally {
    table.dispose();
  }
});
