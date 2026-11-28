import assert from 'node:assert/strict';
import test from 'node:test';
import { createCrashGuard } from '../src/game/crash-guard.js';

function failFrame() {
  throw new Error('Zkušební chyba');
}

test('úspěšný snímek předá čas a nic nezaznamená', () => {
  const guard = createCrashGuard();
  let frameTime;
  assert.equal(guard.run(time => { frameTime = time; }, 140), true);
  assert.equal(frameTime, 140);
  assert.equal(guard.fatal, false);
  assert.deepEqual(guard.errors, []);
});

test('jedna chyba zachová podrobnosti a další snímek pokračuje', () => {
  const guard = createCrashGuard({ now: () => 250 });
  assert.equal(guard.run(failFrame), false);
  assert.equal(guard.run(() => {}), true);
  assert.equal(guard.fatal, false);
  assert.equal(guard.errors[0].time, 250);
  assert.equal(guard.errors[0].message, 'Zkušební chyba');
  assert.match(guard.errors[0].stack, /failFrame/);
});

test('tři chyby do dvou sekund zastaví i další připravený snímek', () => {
  let time = 0;
  const guard = createCrashGuard({ now: () => time });
  guard.run(failFrame);
  time = 1000;
  guard.run(failFrame);
  assert.equal(guard.fatal, false);
  time = 2000;
  guard.run(failFrame);
  assert.equal(guard.fatal, true);
  assert.equal(guard.run(() => assert.fail('Hra měla zůstat zastavená.')), false);
  assert.equal(guard.errors.length, 3);
});

test('staré chyby vypadnou z časového okna, úspěšný snímek okno nezkrátí', () => {
  let time = 0;
  const guard = createCrashGuard({ now: () => time });
  for (const frameTime of [0, 1500, 2200]) {
    time = frameTime;
    assert.equal(guard.run(failFrame), false);
    assert.equal(guard.run(() => {}), true);
    assert.equal(guard.fatal, false);
  }
  time = 2400;
  guard.run(failFrame);
  assert.equal(guard.fatal, true);
});

test('zprávy mimo snímky hru nezastaví a historie drží posledních deset', () => {
  let time = 0;
  const guard = createCrashGuard({ now: () => time++ });
  for (let i = 0; i < 12; i++) guard.record('Zpráva ' + i);
  assert.equal(guard.fatal, false);
  assert.equal(guard.errors.length, 10);
  assert.equal(guard.errors[0].message, 'Zpráva 2');
  assert.equal(guard.errors.at(-1).time, 11);
  assert.equal(guard.record(Object.create(null)).message, 'Neznámá chyba');
  assert.equal(guard.run(failFrame), false);
  assert.equal(guard.fatal, false);
  assert.equal(guard.errors.length, 10);
});
