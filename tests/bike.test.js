import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIKE_STATIONS, loadBikeStock } from '../src/game/bike-stations.js';
import { bikeTurn, pedalSpeed } from '../src/physics/bike-motion.js';

test('seznam Pilsen Bike má jedinečná stanoviště s ověřeným místem uvnitř původní zóny', () => {
  assert.equal(BIKE_STATIONS.length, 152);
  assert.equal(new Set(BIKE_STATIONS.map(station => station.id)).size, BIKE_STATIONS.length);
  assert.equal(BIKE_STATIONS.filter(station => station.dx !== 0 || station.dz !== 0).length, 9);
  for (const { dx, dz, parking, signSide, yaw, radius, capacity, name } of BIKE_STATIONS) {
    assert.ok(name && Number.isFinite(yaw) && Number.isSafeInteger(capacity) && capacity > 0);
    assert.ok(Math.hypot(dx, dz) + 3 <= radius, name);
    assert.ok((parking === 1 || parking === 2) && (signSide === -1 || signSide === 1), name);
  }
});

test('rozšíření sítě zachová stav pilotu a doplní počáteční kolo u nových stanovišť', () => {
  const load = saved => {
    const stock = loadBikeStock(BIKE_STATIONS, saved);
    assert.equal(Object.keys(stock).length, BIKE_STATIONS.length);
    for (const { id } of BIKE_STATIONS) {
      if (id !== '43' && id !== '57') assert.equal(stock[id], 1);
    }
    return { 43: stock[43], 57: stock[57] };
  };
  assert.deepEqual(load(), { 43: 1, 57: 1 });
  assert.deepEqual(load({ stock: { 43: 0, 57: 1 }, origin: '43' }), { 43: 1, 57: 1 });
  assert.deepEqual(load({ stock: { 43: 0, 57: 2 }, origin: null }), { 43: 0, 57: 2 });
  assert.deepEqual(load({ stock: { 43: -1, 57: 99 }, origin: '43' }), { 43: 1, 57: 1 });
  assert.deepEqual(load({ stock: { 43: 10, 57: 5 }, origin: '57' }), { 43: 10, 57: 5 });
  assert.equal(loadBikeStock(BIKE_STATIONS, { stock: { 165: 0 }, origin: '165' })['165'], 1);
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
