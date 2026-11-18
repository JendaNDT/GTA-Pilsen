import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDay } from '../src/game/clock.js';
import { pragueOffset, skyProbeDue, solarDirection } from '../src/world/solar.js';

test('východy a západy slunce v Plzni odpovídají tabulce USNO do pěti minut', () => {
  const threshold = Math.sin(-0.833 * Math.PI / 180);
  for (const [date, rise, set] of [
    ['2026-03-20', '06:10', '18:19'], ['2026-06-21', '04:58', '21:18'], ['2026-11-17', '07:21', '16:21'],
  ]) {
    const day = parseDay(date), offset = pragueOffset(day);
    const observed = [];
    let above = false;
    for (let minute = 0; minute < 1440; minute++) {
      const current = solarDirection(day, minute / 60, offset)[1] >= threshold;
      if (above !== current) observed.push(minute);
      above = current;
    }
    assert.equal(observed.length, 2);
    for (const [i, time] of [rise, set].entries()) {
      const [hours, minutes] = time.split(':').map(Number);
      assert.ok(Math.abs(observed[i] - hours * 60 - minutes) <= 5, `${date} ${time}: ${observed[i]} minut`);
    }
  }
});

test('slunce je ráno na východě, v poledne na jihu a večer na západě', () => {
  const day = parseDay('2026-11-17');
  assert.equal(pragueOffset(day), 1);
  assert.equal(pragueOffset(parseDay('2026-06-21')), 2);
  const dawn = solarDirection(day, 7.5), noon = solarDirection(day, 12), dusk = solarDirection(day, 16);
  assert.ok(dawn[0] > 0 && dusk[0] < 0);
  assert.ok(noon[2] > 0.8 && noon[1] > dawn[1]);
  for (const dir of [dawn, noon, dusk]) assert.ok(Math.abs(Math.hypot(...dir) - 1) < 1e-12);
});

test('světlo z oblohy se obnoví po deseti minutách nebo po posunu slunce přes dva stupně', () => {
  assert.equal(skyProbeDue(9, 1), false);
  assert.equal(skyProbeDue(10, 1), true);
  assert.equal(skyProbeDue(-10, 1), true);
  assert.equal(skyProbeDue(2, Math.cos(2.1 * Math.PI / 180)), true);
});
