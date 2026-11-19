import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Weather, weatherBlock } from '../src/world/weather.js';

const at = date => Date.parse(date + 'T00:00:00Z') / 1000;
test('předpověď sleduje měsíc a přechody mají 10 až 30 herních minut', () => {
  const kinds = new Set();
  for (let i = 0; i < 365 * 8; i++) {
    const id = Math.floor(at('2026-01-01') / 10800) + i;
    const block = weatherBlock(id);
    assert.deepEqual(block, weatherBlock(id));
    assert.ok(block.transition >= 600 && block.transition <= 1800);
    if (block.kind === 'snow') assert.ok(block.temperature < 1);
    if (block.kind === 'storm') assert.ok(block.temperature > 15);
    kinds.add(block.kind);
  }
  assert.equal(kinds.size, 7);
});
test('skok v kalendáři zachová mokro a sníh stejně jako průběžný čas', () => {
  const a = new Weather(), b = new Weather(), midnight = at('2026-01-13');
  a.update(midnight - 1);
  const wet = a.wet, snow = a.snow;
  a.update(midnight + 1);
  assert.ok(Math.abs(a.wet - wet) < .002 && Math.abs(a.snow - snow) < .002);
  b.update(midnight + 1);
  assert.equal(a.wet, b.wet);
  assert.equal(a.snow, b.snow);
  const rain = new Weather('rain'), winter = new Weather('snow');
  rain.update(midnight); winter.update(midnight);
  assert.equal(rain.surfaceGrip(0, 0), .7);
  assert.equal(winter.surfaceGrip(0, 0), .35);
  winter.mode = 'clear'; winter.update(midnight);
  assert.equal(winter.surfaceGrip(0, 0), 1);
});
