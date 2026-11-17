import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DAY_SECONDS, GameClock, formatDay, formatTime, parseDay, weekday } from '../src/game/clock.js';
import { Timetable } from '../src/game/timetable.js';

const dataset = JSON.parse(await readFile(new URL('../public/data/timetable.json', import.meta.url)));

test('herní hodiny převádějí neděli a poslední den měsíce bez závislosti na časové zóně', () => {
  const clock = new GameClock(parseDay('2027-01-31'));
  clock.set(clock.day, 23 + 59 / 60);
  assert.equal(weekday(clock.day), 6);
  assert.equal(formatTime(clock.seconds), '23:59');
  clock.tick(60 / 45);
  assert.equal(formatDay(clock.day), '2027-02-01');
  assert.equal(weekday(clock.day), 0);
  assert.equal(formatTime(clock.seconds), '00:00');
  assert.equal(parseDay('2027-02-29'), null);
  assert.equal(parseDay('2028-02-29'), parseDay('2028-03-01') - 1);
  assert.equal(formatTime(DAY_SECONDS + 65), '00:01');
});

test('balík PMDP skutečně používá výjimku a po konci opakuje běžný týden', () => {
  const t = new Timetable(dataset);
  const monday = parseDay('2026-11-16'), holiday = parseDay('2026-11-17'), sunday = parseDay('2026-11-15');
  assert.equal(weekday(t.monday), 0);
  assert.equal(t.profile(holiday), t.profile(sunday));
  assert.notEqual(t.profile(holiday), t.profile(monday));
  assert.equal(t.profile(parseDay('2027-05-17')), t.profile(parseDay('2027-05-10')));
  assert.equal(t.profile(parseDay('2027-05-16')), t.profile(parseDay('2027-05-09')));
  assert.ok(t.events(parseDay('2027-05-10')).length > t.events(parseDay('2027-05-16')).length);
});

test('pozice, vypravení i odjezdy po půlnoci čtou předchozí dopravní den', () => {
  const t = new Timetable(dataset);
  const sunday = parseDay('2026-11-15'), midnight = (sunday + 1) * DAY_SECONDS;
  const after = t.events(sunday + 1).find((e) => e.trip.id === '695549');
  const before = t.events(sunday).find((e) => e.key === after.key);
  assert.equal(after.day, sunday);
  assert.ok(after.start < midnight && after.end > midnight);
  assert.equal(before.end, after.end);
  assert.ok(t.position(after, midnight + 360) > t.position(before, midnight - 60));
  const departure = after.trip.stops.findIndex((_, i) => after.trip.times[i * 2 + 1] > DAY_SECONDS);
  assert.ok(departure >= 0 && departure < after.trip.stops.length - 1);
  const [name, x, z] = t.stops[after.trip.stops[departure].stop];
  const clock = new GameClock(sunday + 1);
  clock.set(clock.day, 0);
  const board = t.departures(x, z, clock);
  assert.equal(board.stop, name);
  assert.ok(board.rows.some((r) => r.time === sunday * DAY_SECONDS + after.trip.times[departure * 2 + 1] && r.ref === '13'));
});
