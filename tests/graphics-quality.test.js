import assert from 'node:assert/strict';
import test from 'node:test';
import { automaticQuality, graphicsPreferences, PROFILES, resolutionScale } from '../src/game/graphics-quality.js';

test('staré a neplatné uložené nastavení použije automatiku', () => {
  assert.deepEqual(graphicsPreferences(undefined), { choice: 'auto', automatic: null });
  assert.deepEqual(graphicsPreferences({ choice: '__proto__', automatic: 'unknown' }), { choice: 'auto', automatic: null });
  assert.deepEqual(graphicsPreferences({ choice: 'auto', automatic: 'medium' }), { choice: 'auto', automatic: 'medium' });
  assert.ok(PROFILES.low.view < PROFILES.medium.view);
  assert.ok(PROFILES.medium.view < PROFILES.high.view);
});

test('automatika používá naměřenou práci snímku a zohlední telefon', () => {
  assert.equal(automaticQuality(false, 2, 4), 'ultra');
  assert.equal(automaticQuality(false, 4, 7), 'high');
  assert.equal(automaticQuality(false, 4, null), 'medium');
  assert.equal(automaticQuality(true, 2, 4), 'medium');
  assert.equal(automaticQuality(false, 9, 4), 'low');
  assert.equal(automaticQuality(true, 4, 14), 'low');
});

test('dynamické rozlišení po krocích sníží náročnost a nepřekročí meze', () => {
  assert.ok(resolutionScale(1, 4, 14) < 1);
  assert.equal(resolutionScale(0.62, 4, 14), 0.6);
  assert.equal(resolutionScale(0.99, 2, 6), 1);
  assert.equal(resolutionScale(0.8, 6, 11), 0.8);
});

test('předvolby omezují počet současně padajících postav', () => {
  assert.deepEqual(['ultra', 'high', 'medium', 'low'].map(name => PROFILES[name].ragdolls), [4, 4, 2, 1]);
});
