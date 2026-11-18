import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { makeColorLut } from '../tools/build_luts.mjs';
import { lutWeights, LUT_NAMES, parseColorLut } from '../src/world/color-luts.js';
import { parseDay } from '../src/game/clock.js';
import { solarDirection } from '../src/world/solar.js';

test('vlastní barevné tabulky jsou reprodukovatelné a zachovají černou a světlé tóny', () => {
  const midtones = [];
  for (const name of LUT_NAMES) {
    const text = readFileSync(new URL(`../public/luts/${name}.cube`, import.meta.url), 'utf8');
    assert.equal(text, makeColorLut(name));
    const { size, data } = parseColorLut(text);
    assert.equal(size, 17);
    assert.equal(data.length, 17 ** 3 * 4);
    assert.deepEqual([...data.slice(0, 4)], [0, 0, 0, 255]);
    assert.ok(data.slice(-4).every((value) => value > 244));
    const middle = (17 ** 3 - 1) * 2;
    midtones.push([...data.slice(middle, middle + 3)]);
  }
  assert.equal(new Set(midtones.map(String)).size, 3);
  assert.throws(() => parseColorLut('LUT_3D_SIZE 17\n0 0 0'), /rozměr/);
});

test('barevné ladění plynule přechází přes den, soumrak a noc', () => {
  const date = parseDay('2026-10-19');
  const read = (hour) => lutWeights(solarDirection(date, hour)[1]);
  assert.deepEqual(read(10), [1, 0, 0]);
  assert.ok(read(18 + 9 / 60)[1] > 0.9);
  assert.deepEqual(read(22), [0, 0, 1]);
  let previous = read(16);
  for (let minute = 16 * 60 + 1; minute < 20 * 60; minute++) {
    const weights = read(minute / 60);
    assert.ok(Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-12);
    assert.ok(weights.every((weight, i) => Math.abs(weight - previous[i]) < 0.07));
    previous = weights;
  }
});
