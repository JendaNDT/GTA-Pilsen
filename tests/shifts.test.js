import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GameClock, DAY_SECONDS, parseDay } from '../src/game/clock.js';
import { Timetable, STOP_DWELL } from '../src/game/timetable.js';
import { SHIFT_LEAD, shiftOffers, shiftResult, shiftStops } from '../src/game/shift-plans.js';
import { Shifts } from '../src/game/shift.js';

const timetable = new Timetable(JSON.parse(readFileSync(new URL('../public/data/timetable.json', import.meta.url))));

test('E11 nabízí úseky všech tří druhů MHD v obou směrech ve všední den i o víkendu', () => {
  const clock = new GameClock(timetable.monday);
  for (const [day, hour] of [['2026-11-09', 9], ['2026-11-14', 15], ['2026-11-17', 23.99]]) {
    clock.set(parseDay(day), hour);
    const offers = shiftOffers(timetable, clock);
    assert.deepEqual(offers.map(({ type }) => type), ['tram', 'tram', 'trolleybus', 'trolleybus', 'bus', 'bus']);
    for (const offer of offers) {
      assert.ok(offer.departure >= clock.now + SHIFT_LEAD);
      assert.ok(timetable.events(Math.floor(offer.departure / DAY_SECONDS)).some(({ key }) => key === offer.event.key));
      const stops = shiftStops(offer, timetable);
      assert.ok(stops.length >= 4);
      assert.equal(stops[0].depart, offer.departure);
      assert.equal(stops[0].name, offer.from);
      assert.equal(stops.at(-1).name, offer.to);
      for (let i = 1; i < stops.length; i++) {
        const { s, arrive, depart } = stops[i], prev = stops[i - 1];
        assert.ok(s > prev.s && arrive > prev.depart);
        assert.ok(depart - arrive >= STOP_DWELL);
      }
    }
  }
});

test('E11 hodnotí obsluhu, rozpis, dopravní pravidla a plynulost a podmiňuje výplatu dojetím', () => {
  const offer = shiftOffers(timetable, new GameClock(timetable.monday))[0];
  const stops = shiftStops(offer, timetable);
  const run = { offer, stops, served: stops.length, late: 0, early: 0, speeding: 0, harsh: 0,
    red: 0, ignoredStop: 0, yield: 0, safetyStops: 0 };
  const ideal = shiftResult(run, true);
  assert.equal(ideal.score, 100);
  assert.equal(ideal.state, 'paid');
  const rough = shiftResult({ ...run, late: 60, early: 6, speeding: 10, harsh: 2, red: 1, ignoredStop: 1 }, true);
  assert.ok(rough.punctuality < 20 && rough.rules < 25 && rough.comfort < 10 && rough.amount < ideal.amount);
  assert.equal(shiftResult({ ...run, served: stops.length - 2 }, true).amount, 0);
  const missed = shiftResult({ ...run, served: stops.length - 1 }, false);
  assert.equal(missed.state, 'failed');
  assert.equal(missed.amount, 0);
});

test('E11 zaznamená průjezd na červenou právě jednou a uzná zastavení u STOP', () => {
  const shifts = new Shifts({ hud: { toast() {} } });
  const run = { passed: new Set(), red: 0, ignoredStop: 0, yield: 0 };
  const signal = { kind: 'signal', directedHead: true }, sign = { kind: 'stop' };
  const v = { v: 5 }, front = { x: 0, z: 0, tx: 0, tz: 1 };
  let next = { control: signal, distance: 0.4 };
  const crossed = [];
  const traffic = { transitControl: () => next, light: () => 'red', conflict: () => false,
    enterJunction: (_vehicle, control) => crossed.push(control) };
  shifts.checkTraffic(run, traffic, v, front, 0.25, 0.05, [], []);
  assert.equal(run.red, 0);
  shifts.checkTraffic(run, traffic, v, front, 0.45, 0.05, [], []);
  shifts.checkTraffic(run, traffic, v, front, 0.45, 0.05, [], []);
  assert.equal(run.red, 1);
  assert.deepEqual(crossed, [signal]);
  next = { control: sign, distance: 1.2 };
  v.v = 0;
  for (let i = 0; i < 15; i++) shifts.checkTraffic(run, traffic, v, front, 0, 0.05, [], []);
  next.distance = 0.04;
  v.v = 1;
  shifts.checkTraffic(run, traffic, v, front, 0.05, 0.05, [], []);
  assert.equal(run.ignoredStop, 0);
  next.control = { kind: 'stop' };
  shifts.checkTraffic(run, traffic, v, front, 0.05, 0.05, [], []);
  assert.equal(run.ignoredStop, 1);
});

test('směna omezuje ryv při rozjezdu a změně pedálu a nouzově zastaví dříve', async () => {
  const { shiftMotion } = await import('../src/game/shift.js');
  const dt = 1 / 60;
  for (const tram of [false, true]) {
    let motion = { speed: 0, accel: 0 };
    for (let i = 0; i < 180; i++) {
      const next = shiftMotion(motion.speed, motion.accel, 1, false, tram, dt);
      assert.ok(Math.abs(next.accel - motion.accel) <= 2.8 * dt + 1e-10);
      motion = next;
    }
    assert.ok(motion.speed > 3);
    const distances = [false, true].map((emergency) => {
      let v = 10, a = motion.accel, s = 0;
      for (let i = 0; i < 600 && v > 0; i++) {
        const next = shiftMotion(v, a, -1, emergency, tram, dt);
        if (!emergency && tram) assert.ok(next.accel >= -0.24 * 9.81);
        v = next.speed; a = next.accel; s += v * dt;
      }
      assert.equal(v, 0);
      return s;
    });
    assert.ok(distances[1] + 3 < distances[0]);
  }
});
