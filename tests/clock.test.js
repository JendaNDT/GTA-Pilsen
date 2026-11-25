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
  clock.tick(59);
  assert.equal(formatTime(clock.seconds), '23:59');
  clock.tick(1);
  assert.equal(formatDay(clock.day), '2027-02-01');
  assert.equal(weekday(clock.day), 0);
  assert.equal(formatTime(clock.seconds), '00:00');
  assert.equal(parseDay('2027-02-29'), null);
  assert.equal(parseDay('2028-02-29'), parseDay('2028-03-01') - 1);
  assert.equal(formatTime(DAY_SECONDS + 65), '00:01');
});

test('plzeňské hodiny používají datum v Plzni a zohlední letní čas', () => {
  const clock = new GameClock();
  clock.setPrague(Date.parse('2026-11-18T23:04:15.250Z'));
  assert.equal(formatDay(clock.day), '2026-11-19');
  assert.equal(clock.seconds, 255.25);
  assert.equal(clock.followsPrague, true);
  clock.setPrague(Date.parse('2026-03-29T00:59:59.250Z'));
  assert.equal(formatTime(clock.seconds), '01:59');
  clock.setPrague(Date.parse('2026-03-29T01:00:00.250Z'));
  assert.equal(clock.seconds, 10800.25);
  clock.setTime(clock.day * DAY_SECONDS + 18 * 3600 + 30 * 60);
  clock.tick(5 * 60);
  assert.equal(clock.followsPrague, false);
  assert.equal(formatTime(clock.seconds), '18:35');
});

test('balík PMDP skutečně používá výjimku a po konci opakuje běžný týden', () => {
  const t = new Timetable(dataset);
  const { days, weekly, profiles } = dataset.calendar;
  assert.deepEqual(t.profile(t.startDay), profiles[days[0]]);
  assert.deepEqual(t.profile(t.endDay), profiles[days.at(-1)]);
  for (const day of [t.startDay - 1, t.endDay + 1]) {
    assert.deepEqual(t.profile(day), profiles[weekly[weekday(day)]]);
    assert.ok(t.events(day).length > 0);
  }
  const monday = parseDay('2026-11-16'), holiday = parseDay('2026-11-17'), sunday = parseDay('2026-11-15');
  assert.equal(weekday(t.monday), 0);
  assert.equal(t.profile(holiday), t.profile(sunday));
  assert.notEqual(t.profile(holiday), t.profile(monday));
  assert.equal(t.profile(parseDay('2027-05-17')), t.profile(parseDay('2027-05-10')));
  assert.equal(t.profile(parseDay('2027-05-16')), t.profile(parseDay('2027-05-09')));
  assert.ok(t.events(parseDay('2027-05-10')).length > t.events(parseDay('2027-05-16')).length);
});

test('vypravení a pobyt na zastávce používají skutečné sekundy', () => {
  const timetable = new Timetable(dataset);
  const day = parseDay('2026-11-09');
  const event = timetable.events(day).find(({ trip }) => trip.id === '692183');
  const departure = day * DAY_SECONDS + event.trip.times[1];
  assert.equal(departure - event.start, 5);
  assert.equal(timetable.state(event, departure - 4).wait, 4);
  assert.equal(timetable.state(event, departure).wait, 0);
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
