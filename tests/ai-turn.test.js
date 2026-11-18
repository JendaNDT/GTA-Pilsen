import assert from 'node:assert/strict';
import test from 'node:test';
import { pathClearance } from '../src/game/ai-turn.js';

test('Řidič před zatáčkou brzdí před autem ve výjezdovém pruhu', () => {
  const path = [{ x: 0, z: 4 }, { x: 3, z: 7 }, { x: 7, z: 7 }, { x: 11, z: 7 }];
  const parked = { x: 7, z: 7, yaw: Math.PI / 2, halfLen: 2, radius: 0.9 };
  const gap = pathClearance(0, 0, 0, 2, 0.9, parked, path);
  assert.ok(Math.abs(gap - (4 + Math.hypot(3, 3))) < 0.001);
  // Stojící auto v přímém prodloužení příjezdu po odbočení nepřekáží.
  assert.equal(pathClearance(0, 0, 0, 2, 0.9, { ...parked, x: 0, z: 14 }, path), Infinity);
});
