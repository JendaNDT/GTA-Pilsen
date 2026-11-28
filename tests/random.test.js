import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createRandom, parseSeed } from '../src/game/random.js';

const samples = (random) => Array.from({ length: 5 }, random);

test('stejné semínko dává posloupnost dosavadního generátoru', () => {
  const first = createRandom(1);
  const second = createRandom(1);
  assert.deepEqual(
    [first.simulationRandom(), first.simulationRandom(), first.simulationRandom()],
    [1015568748, 1586005467, 2165703038].map(value => value / 2 ** 32),
  );
  first.reseed(1);
  assert.deepEqual(samples(first.simulationRandom), samples(second.simulationRandom));
  assert.deepEqual(samples(first.effectsRandom), samples(second.effectsRandom));
});

test('různá semínka dávají různé posloupnosti', () => {
  const first = createRandom(0);
  const second = createRandom(42);
  assert.notDeepEqual(samples(first.simulationRandom), samples(second.simulationRandom));
  assert.notDeepEqual(samples(first.effectsRandom), samples(second.effectsRandom));
});

test('odběr náhody pro efekty nemění simulaci a naopak', () => {
  const reference = createRandom(12);
  const mixed = createRandom(12);
  const simulation = [], effects = [];
  for (let i = 0; i < 5; i++) {
    effects.push(mixed.effectsRandom());
    simulation.push(mixed.simulationRandom());
  }
  assert.deepEqual(simulation, samples(reference.simulationRandom));
  assert.deepEqual(effects, samples(reference.effectsRandom));
  assert.notDeepEqual(effects, simulation);
});

test('semínko přijímá celá desetinná čísla včetně nuly a ignoruje neplatné hodnoty', () => {
  assert.equal(parseSeed('0'), 0);
  assert.equal(parseSeed('42'), 42);
  assert.equal(parseSeed('-1'), 4294967295);
  for (const invalid of [null, '', ' ', '1.5', '1e3', '0xF', 'NaN', '9007199254740992']) {
    assert.equal(parseSeed(invalid), null);
  }
});

test('herní moduly nepoužívají společný generátor prohlížeče', () => {
  const source = fileURLToPath(new URL('../src/', import.meta.url));
  const offenders = readdirSync(source, { recursive: true })
    .filter(file => file.endsWith('.js'))
    .filter(file => /\bMath\s*\.\s*random\s*\(/.test(readFileSync(join(source, file), 'utf8')));
  assert.deepEqual(offenders, []);
});
