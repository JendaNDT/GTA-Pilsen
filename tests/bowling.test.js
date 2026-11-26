import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BowlingRound, validBowlingRecord } from '../src/game/bowling-rules.js';
import { BowlingLane } from '../src/physics/bowling-lane.js';
import { loadJolt } from '../src/physics/jolt.js';
import { STEP_SECONDS } from '../src/physics/step.js';
import { parseSave } from '../src/game/save-data.js';

const scores = (round, rolls) => rolls.forEach(pins => assert.equal(round.roll(pins), true));

test('strike čeká na dva další hody a spare na jeden, otevřené kolo počítá hned', () => {
  const round = new BowlingRound();
  scores(round, [10, 4]);
  assert.equal(round.total, 0);
  scores(round, [6]);
  assert.equal(round.sheet[0].score, 20);
  assert.deepEqual(round.sheet[1], { marks: ['4', '/'], score: null });
  scores(round, [3, 4]);
  assert.equal(round.total, 40);
  assert.deepEqual(round.sheet[2], { marks: ['3', '4'], score: 40 });
});

test('desáté kolo rozdělí bonusové hody a zachová stojící kuželky', () => {
  const round = new BowlingRound();
  scores(round, Array(18).fill(0));
  assert.equal(round.last, true);
  scores(round, [10]);
  assert.equal(round.freshRack, true);
  scores(round, [7]);
  assert.equal(round.freshRack, false);
  assert.equal(round.available, 3);
  assert.equal(round.roll(4), false);
  scores(round, [3]);
  assert.equal(round.complete, true);
  assert.equal(round.roll(0), false);
  assert.deepEqual(round.sheet.at(-1), { marks: ['X', '7', '/'], score: 20 });
});

test('dvanáct strike dává 300 a deset spare s pěti kuželkami dává 150', () => {
  const perfect = new BowlingRound(), spares = new BowlingRound(), open = new BowlingRound();
  scores(perfect, Array(12).fill(10));
  scores(spares, Array(21).fill(5));
  scores(open, Array(20).fill(0));
  assert.equal(perfect.total, 300);
  assert.equal(spares.total, 150);
  assert.equal(open.total, 0);
  assert.ok([perfect, spares, open].every(round => round.complete));
  assert.ok(validBowlingRecord(0));
  assert.ok(validBowlingRecord(300));
  assert.ok(!validBowlingRecord(301) && !validBowlingRecord('200'));
});

test('koule v Jolt shodí celou sestavu, zvládne dohrávku i sklouzne do žlábku', async () => {
  const lane = new BowlingLane(await loadJolt());
  const roll = (aim, power) => {
    assert.equal(lane.launch(aim, power), true);
    assert.equal(lane.launch(aim, power), false);
    for (let i = 0; i < 450 && lane.rolling; i++) lane.step(STEP_SECONDS);
    assert.equal(lane.rolling, false);
    return lane.result;
  };
  try {
    assert.deepEqual(roll(-1, .75), { knocked: 10, gutter: false });
    lane.prepare(true);
    assert.deepEqual(roll(22, .75), { knocked: 0, gutter: true });
    lane.prepare(true);
    assert.deepEqual(roll(3, .25), { knocked: 9, gutter: false });
    lane.prepare(false);
    assert.equal(lane.pins.filter(pin => pin.standing).length, 1);
    assert.equal(lane.pins.filter(pin => lane.world.bodies.IsAdded(pin.body.GetID())).length, 1);
    assert.deepEqual(roll(-9, .85), { knocked: 1, gutter: false });
  } finally {
    lane.dispose();
  }
});

test('starší uložení zůstane čitelné a bowlingový rekord má rozsah 0 až 300', () => {
  const get = stats => parseSave(JSON.stringify({ v: 2, stats })).stats;
  assert.deepEqual(get({}), {});
  assert.deepEqual(get({ bowlingBest: 0, minigolfBest: 8 }), { bowlingBest: 0, minigolfBest: 8 });
  assert.deepEqual(get({ bowlingBest: 300 }), { bowlingBest: 300 });
  assert.deepEqual(get({ bowlingBest: 301, minigolfBest: 8 }), { minigolfBest: 8 });
});
