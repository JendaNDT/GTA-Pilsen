import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roadContinuations } from '../src/world/road-continuation.js';
import { measure, surveyWorld } from '../tools/audit_road_ride.mjs';

test('vyhlazení sleduje přímé pokračování přes vnitřní uzel i při opačném pořadí bodů', () => {
  const world = { rOff: [0, 2, 5, 7], rpx: [0, 10, 20, 10, 0, 10, 10], rpz: [0, 0, 0, 0, 0, 0, 20],
    r: { name: [3, 3, 4], cls: [4, 4, 8] } };
  const links = roadContinuations(world, [true, true, true], [0, 10, 0, 10, 20, 0, 20]);
  assert.deepEqual(links.get(1), { road: 1, from: 10, sign: -1 });
  assert.equal(links.get(5), undefined);
});

test('před Rondelem nepřekročí tři jízdní stopy v obou směrech 1,2 cm na 4 m a 4,5 cm na 12 m', () => {
  const world = surveyWorld();
  for (const road of [53, 2846, 54]) {
    const { worst } = measure(world, road);
    assert.ok(worst[0] < 0.012 && worst[1] < 0.045, road + ' ' + worst);
  }
});

test('krátká spojka ve Vinohradské plynule navazuje na most i na ulici', () => {
  const world = surveyWorld(), roads = world.r.cls.map(cls => Number(cls <= 13));
  const links = roadContinuations(world, roads, world.roadGrade.station);
  const { worst, joins } = measure(world, 25961, links);
  assert.ok(worst[0] < 0.03 && joins.worst[0] < 0.03, 'čtyřmetrová nerovnost ' + [worst[0], joins.worst[0]]);
  assert.ok(joins.samples[1] > 0 && joins.worst[1] < 0.15, 'dvanáctimetrové napojení ' + joins.worst[1]);
});
