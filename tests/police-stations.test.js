import test from 'node:test';
import assert from 'node:assert/strict';
import { arrestDestination, BORY_RELEASE, POLICE_STATIONS } from '../src/game/police-stations.js';
import { parseSave } from '../src/game/save-data.js';

test('každá služebna je jedinečným místem návratu a závažný čin vždy vede na Bory', () => {
  assert.equal(new Set(POLICE_STATIONS.map(s => s.name)).size, POLICE_STATIONS.length);
  for (const station of POLICE_STATIONS) {
    assert.equal(arrestDestination(station, false), station);
    assert.equal(arrestDestination(station, true), BORY_RELEASE);
  }
  assert.match(arrestDestination({ x: 15705, z: 600 }, false).name, /Rokycany, radnice/);
  assert.match(arrestDestination({ x: 22284, z: 3542 }, false).name, /Hrádek/);
});

test('starší uložení začne bez pátrání, probíhající si uchová i závažnost', () => {
  const parse = pursuit => parseSave(JSON.stringify({ v: 2, pursuit })).pursuit;
  const serious = { stars: 1, reason: 'Srazil jsi chodce', serious: true };
  assert.deepEqual(parse(serious), serious);
  assert.equal(parse(undefined), null);
  assert.equal(parse({ ...serious, stars: -1 }), null);
  assert.equal(parse({ ...serious, reason: 1 }), null);
});
