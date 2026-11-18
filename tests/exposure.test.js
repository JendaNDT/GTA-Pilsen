import assert from 'node:assert/strict';
import test from 'node:test';
import { exposureTarget, stepExposure } from '../src/world/exposure.js';

test('tmavší scéna zvýší expozici ve vymezeném rozsahu', () => {
  assert.equal(exposureTarget(0), 1.72);
  assert.equal(exposureTarget(2), 0.66);
  assert.equal(exposureTarget(0.29), 1);
  assert.ok(exposureTarget(0.15) > exposureTarget(0.30));
});

test('oko se přizpůsobí plynule a při oslnění zareaguje rychleji', () => {
  const dark = stepExposure(0.8, 1.6, 0.4);
  const bright = stepExposure(1.6, 0.8, 0.4);
  assert.ok(dark > 0.8 && dark < 1.6);
  assert.ok(bright > 0.8 && bright < 1.6);
  assert.ok(1.6 - bright > dark - 0.8);
  assert.ok(stepExposure(dark, 1.6, 0.4) > dark);
});
