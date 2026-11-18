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

test('Dodávka na Americké může zatočit podél zaparkovaného auta mimo jízdní pruh', () => {
  const path = [
    [-157.84, 446.84], [-153.95, 447.78], [-150.04, 447.50], [-147.22, 444.78],
    [-146.49, 440.87], [-146.14, 436.89], [-145.79, 432.90],
  ].map(([x, z]) => ({ x, z }));
  const parked = { x: -155.9, z: 450.5, yaw: 1.333, halfLen: 2.175, radius: 1.042 };
  const gap = pathClearance(-161.7, 445.8, 1.316, 2.65, 1, parked, path);
  assert.equal(gap, Infinity);
  const inLane = pathClearance(-161.7, 445.8, 1.316, 2.65, 1, { ...parked, z: 447.1 }, path);
  assert.ok(inLane > 0 && inLane < 2);
});
