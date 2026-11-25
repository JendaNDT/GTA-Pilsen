import test from 'node:test';
import assert from 'node:assert/strict';
import { inStartArea } from '../src/world/start-area.js';

test('kilometr zasahuje až po skutečný okraj dlaždice ve všech směrech', () => {
  for (const sign of [-1, 1]) {
    assert.ok(inStartArea(-37, 80, -37 + sign * 1128, 80, 256));
    assert.ok(inStartArea(-37, 80, -37, 80 + sign * 1128, 256));
    assert.equal(inStartArea(-37, 80, -37 + sign * 1129, 80, 256), false);
  }
  assert.ok(inStartArea(0, 0, 928, 728, 256));
  assert.equal(inStartArea(0, 0, 929, 728, 256), false);
});
