import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ACTIVITY_SITES, atActivityPoint } from '../src/game/activity-sites.js';

test('přístup do aktivity vyžaduje blízkost na stejné úrovni a pevnou zem', () => {
  const [site] = ACTIVITY_SITES;
  assert.ok(atActivityPoint(site, site));
  assert.ok(!atActivityPoint({ ...site, y: site.y + 2 }, site));
  assert.ok(!atActivityPoint({ ...site, x: site.x + 4 }, site));
  assert.ok(!atActivityPoint({ ...site, swimming: true }, site));
});

test('Škodaland odkazuje na skutečnou adresu a pěší cesta končí u zkušebního bodu', () => {
  const [site] = ACTIVITY_SITES;
  const meta = JSON.parse(readFileSync(new URL('../public/data/meta.json', import.meta.url)));
  const address = meta.addresses.find(([x, z, street, number]) =>
    meta.roadNames[street].replaceAll('\u00a0', ' ') === 'V Lukách' && number === '34'
      && Math.hypot(site.x - x, site.z - z) < 15);
  assert.ok(address);
  assert.deepEqual(site.trial.path.slice(0, 2), [site.x, site.z]);
  assert.deepEqual(site.trial.path.slice(-2), [site.trial.target.x, site.trial.target.z]);
});

test('referenční spoj 1 do Bolevce jede přes tři navazující stanoviště', () => {
  const timetable = JSON.parse(readFileSync(new URL('../public/data/timetable.json', import.meta.url)));
  const [id, service, pattern, times] = timetable.trips.find(([id]) => id === '685462');
  const [route, stops, direction] = timetable.patterns[pattern];
  const start = stops.findIndex(([stop]) => timetable.stops[stop][3] === '54717/1');
  assert.equal(Number(id) % 2, 0);
  assert.equal(timetable.routes[route].ref, '1');
  assert.equal(direction, 'Bolevec');
  assert.ok(timetable.calendar.profiles[timetable.calendar.days[0]].includes(service));
  assert.deepEqual(stops.slice(start, start + 3).map(([stop]) => timetable.stops[stop][3]),
    ['54717/1', '57154/1', '57135/1']);
  assert.deepEqual(times.slice(start * 2, start * 2 + 6), [36360, 36360, 36480, 36480, 36660, 36660]);
});
