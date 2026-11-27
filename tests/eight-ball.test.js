import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EightBall } from '../src/game/eight-ball.js';
import { PoolTable } from '../src/physics/pool-table.js';
import { loadJolt } from '../src/physics/jolt.js';

function shot(game, first, pocketed = [], extra = {}) {
  return game.settle({ first, pocketed, railAfterContact: true, scratch: false, ...extra });
}

test('rozstřel nechá stůl otevřený, první potopená pak přidělí skupiny a vlastní koule udrží tah', () => {
  const game = new EightBall();
  shot(game, 1, [2]);
  assert.deepEqual(game.groups, [null, null, null]);
  assert.equal(game.player, 1);
  shot(game, 11, [11, 3]);
  assert.deepEqual(game.groups, [null, 'půlené', 'plné']);
  assert.deepEqual(game.remaining, { plné: 5, půlené: 6 });
  shot(game, 10, [4]);
  assert.equal(game.player, 2);
  shot(game, 9, [9]);
  assert.equal(game.inHand, true);
  assert.equal(game.player, 1);
});

test('minutí, chybějící mantinel a pád bílé předají bílou do ruky, faul nepřidělí skupiny', () => {
  for (const [first, pocketed, extra] of [[null, [], {}], [2, [], { railAfterContact: false }],
    [3, [3], { scratch: true }], [8, [], {}]]) {
    const game = new EightBall();
    shot(game, 1);
    shot(game, first, pocketed, extra);
    assert.equal(game.player, 1);
    assert.equal(game.inHand, true);
    assert.equal(game.groups[1], null);
  }
});

test('černá rozhodne podle stavu na začátku strku, černá při rozstřelu vrátí trojúhelník', () => {
  for (const scratch of [false, true]) {
    assert.deepEqual(shot(new EightBall(), 1, [8], { scratch }), { rerack: true, starter: scratch ? 2 : 1 });
  }
  for (const outcome of ['brzy', 's poslední', 'čistě', 's bílou']) {
    const game = new EightBall();
    shot(game, 1);
    shot(game, 1, [1, 2, 3, 4, 5, 6]);
    if (outcome === 'čistě' || outcome === 's bílou') shot(game, 7, [7]);
    shot(game, outcome === 's poslední' ? 7 : 8, outcome === 's poslední' ? [7, 8] : [8],
      { scratch: outcome === 's bílou' });
    assert.equal(game.winner, outcome === 'čistě' ? 2 : 1);
  }
});

test('Jolt ohlásí první zasaženou kouli, rozbije trojúhelník a odliší faul od platného strku', async () => {
  const table = new PoolTable(await loadJolt(), true);
  function play(degrees, power) {
    assert.equal(table.launch(degrees, power), true);
    for (let i = 0; i < 650 && table.rolling; i++) table.world.update(1 / 60);
    assert.equal(table.rolling, false);
  }
  try {
    assert.equal(table.balls.length, 16);
    play(90, 1);
    assert.equal(table.shot.first, 1);
    assert.equal(table.match.breakShot, false);
    assert.equal(table.match.inHand, false);
    table.place(table.balls[0], .35, -.72);
    play(180, .1);
    assert.equal(table.match.inHand, true);
    assert.equal(table.launch(90, 1), false);
    const target = table.balls[1].GetPosition();
    assert.equal(table.placeWhite(target.GetX(), target.GetZ()), false);
    assert.equal(table.placeWhite(0, 7), false);
    assert.equal(table.placeWhite(.1, -.7), true);
  } finally { table.dispose(); }
});

test('hráč po rozstřelu postupně potopí sedm plných a černou samostatným strkem', async () => {
  const table = new PoolTable(await loadJolt(), true);
  function play(degrees, power) {
    assert.equal(table.launch(degrees, power), true);
    for (let i = 0; i < 650 && table.rolling; i++) table.step(1 / 60);
    assert.equal(table.rolling, false);
  }
  try {
    play(90, 1);
    assert.equal(table.match.player, 2);
    // Mezi strky postav vždy tutéž přímou zkoušku do prostřední kapsy.
    for (let n = 1; n <= 8; n++) {
      table.place(table.balls[0], -.28, 0);
      table.place(table.balls[n], .16, 0);
      play(0, .65);
      assert.equal(table.shot.first, n);
      assert.deepEqual(table.shot.pocketed, [n]);
      assert.equal(table.match.player, 2);
      assert.equal(table.complete, n === 8);
    }
    assert.equal(table.match.winner, 2);
    assert.equal(table.launch(0, 1), false);
  } finally { table.dispose(); }
});

test('symbol odpovídá hráči na tahu, po sedmi koulích přejde na černou a po výhře zmizí', () => {
  const game = new EightBall();
  assert.equal(game.targetBall, null);
  shot(game, 1, [1]);
  assert.equal(game.targetBall, null);
  shot(game, 9, [9]);
  assert.equal(game.targetBall, 'půlené');
  shot(game, 10);
  assert.equal(game.targetBall, 'plné');
  shot(game, 2, [2, 3, 4, 5, 6, 7]);
  assert.equal(game.targetBall, 'černá');
  assert.match(game.status, /na řadě je černá/);
  shot(game, 8, [8]);
  assert.equal(game.targetBall, null);
});
