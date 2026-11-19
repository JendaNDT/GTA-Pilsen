import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowSchedule, nearestLights } from '../src/world/night-lights.js';

test('večer svítí domácnosti, pracovní doba a zavření obchodu ve 20 hodin mají vlastní průběh', () => {
  const noon = windowSchedule(12),
    evening = windowSchedule(21);
  assert.ok(evening[0] > noon[0]);
  assert.ok(noon[1] > evening[1]);
  assert.ok(windowSchedule(19.99)[2] > 0);
  assert.equal(windowSchedule(20)[2], 0);
  assert.deepEqual(windowSchedule(0), windowSchedule(24));
});
test('výběr světel respektuje vzdálenost v prostoru, limit a stav lampy', () => {
  const list = [
    { x: 0, z: 0, intact: false },
    { x: 1, z: 1 },
    { x: 5, z: 0 },
    { x: 2, z: 0, y: 40 },
    { x: 99, z: 0 }
  ];
  assert.deepEqual(nearestLights(list, { x: 0, z: 0, y: 0 }, 2, 35), [list[1], list[2]]);
});
