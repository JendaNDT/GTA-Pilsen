import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three/webgpu';
import { BodyPose, FixedStep, STEP_SECONDS } from '../src/physics/step.js';

test('při 30 i 144 snímcích za sekundu proběhne 60 stejných kroků', () => {
  for (const fps of [30, 144]) {
    const clock = new FixedStep();
    const steps = [];
    for (let i = 0; i < fps; i++) clock.advance(1 / fps, (dt) => steps.push(dt));
    assert.deepEqual(steps, Array(60).fill(STEP_SECONDS));
  }
});

test('po záseku proběhnou nejvýš čtyři kroky a zůstane jen část dalšího', () => {
  const clock = new FixedStep();
  let steps = 0;
  clock.advance(10.5 * STEP_SECONDS, () => steps++);
  assert.equal(steps, 4);
  assert.ok(Math.abs(clock.alpha - 0.5) < 1e-9);
  clock.advance(STEP_SECONDS / 2, () => steps++);
  assert.equal(steps, 5);
});

test('mezisnímek interpoluje souřadnice i otočení a teleport zahodí původní polohu', () => {
  let x = 1, angle = 0;
  const body = {
    GetPosition: () => ({ GetX: () => x, GetY: () => 0, GetZ: () => 0 }),
    GetRotation: () => ({ GetX: () => 0, GetY: () => Math.sin(angle / 2), GetZ: () => 0, GetW: () => Math.cos(angle / 2) }),
  };
  const pose = new BodyPose(body), pos = new Vector3(), rot = new Quaternion();
  x = 5;
  angle = Math.PI / 2;
  pose.read(body);
  pose.interpolate(0.5, pos, rot);
  assert.equal(pos.x, 3);
  assert.ok(Math.abs(rot.y - Math.sin(Math.PI / 8)) < 1e-8);
  pose.reset(body);
  pose.interpolate(0, pos, rot);
  assert.equal(pos.x, 5);
});
