import assert from 'node:assert/strict';
import test from 'node:test';
import { testTimeout } from './e2e/test-timeout.js';

test('prohlížečové zkoušky mají na GitHubu nejméně pět minut', (t) => {
  const previous = process.env.CI;
  t.after(() => {
    if (previous === undefined) delete process.env.CI;
    else process.env.CI = previous;
  });

  delete process.env.CI;
  assert.equal(testTimeout(), 90_000);
  assert.equal(testTimeout(150_000), 150_000);

  process.env.CI = 'true';
  assert.equal(testTimeout(), 300_000);
  assert.equal(testTimeout(150_000), 300_000);
  assert.equal(testTimeout(400_000), 400_000);
});
