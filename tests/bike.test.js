import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIKE_STATIONS, loadBikeStock } from '../src/game/bike-stations.js';
import { bikeTurn, pedalSpeed } from '../src/physics/bike-motion.js';

test('sdílená kola mají při starém uložení počáteční stav a přerušená výpůjčka se vrátí', () => {
  assert.deepEqual(loadBikeStock(BIKE_STATIONS), { 43: 1, 57: 1 });
  assert.deepEqual(loadBikeStock(BIKE_STATIONS, { stock: { 43: 0, 57: 1 }, origin: '43' }), { 43: 1, 57: 1 });
  assert.deepEqual(loadBikeStock(BIKE_STATIONS, { stock: { 43: 0, 57: 2 }, origin: null }), { 43: 0, 57: 2 });
  assert.deepEqual(loadBikeStock(BIKE_STATIONS, { stock: { 43: -1, 57: 99 }, origin: '43' }), { 43: 1, 57: 1 });
  assert.deepEqual(loadBikeStock(BIKE_STATIONS, { stock: { 43: 10, 57: 5 }, origin: '57' }), { 43: 10, 57: 5 });
});

test('elektrokolo se rozjede v kopci, vypne přípomoc při 25 km/h a při brzdění může zatáčet', () => {
  const step = 1 / 60;
  assert.ok(pedalSpeed(0, 1, 0, .18, step) > 0);
  assert.ok(pedalSpeed(2, 1, 0, .11, step) < pedalSpeed(2, 1, 0, 0, step));
  assert.ok(pedalSpeed(8, 1, 0, 0, step) <= 8);
  const braking = pedalSpeed(3, 0, 1, -.10, step);
  assert.ok(braking < 3);
  assert.ok(bikeTurn(braking, .8) > 0);
  assert.equal(pedalSpeed(.01, 0, 1, -.10, step), 0);
});
