import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { HelicopterBody } from '../src/physics/heli.js';

function helicopter(values) {
  return { world: { heightAt: () => 0, playMinX: -2000, playMaxX: 2000, playMinZ: -2000, playMaxZ: 2000 },
    x: 0, y: 75, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, roll: 0,
    occupied: true, landed: false, speed: 0, rotor: 30, sync() {}, ...values };
}

test('vrtulník má 2500 kg a asistence při nulovém vstupu udrží náklon i výšku', async () => {
  const physics = new PhysicsWorld(await loadJolt());
  const h = helicopter({ vy: -0.6, yaw: 0.3, pitch: 0.08, roll: -0.06 });
  const flight = new HelicopterBody(physics, h);
  let largest = 0;
  try {
    assert.ok(Math.abs(1 / flight.body.GetMotionProperties().GetInverseMass() - 2500) < 0.01);
    for (let i = 0; i < 1200; i++) {
      flight.drive(1 / 60, 0, 0, 0, true);
      physics.engine.Step(1 / 60, 1);
      flight.read();
      largest = Math.max(largest, Math.abs(h.y - 75));
    }
    assert.ok(largest <= 0.5, 'Největší odchylka výšky ' + largest);
    assert.ok(Math.abs(h.pitch) < 0.005 && Math.abs(h.roll) < 0.005 && Math.abs(h.vy) < 0.05);
  } finally { flight.dispose(); physics.dispose(); }
});

test('vrtulník omezí šikmý let na 300 km/h ve vodorovné rovině a zachová stoupání', async () => {
  const physics = new PhysicsWorld(await loadJolt());
  const h = helicopter({ vx: -60, vz: 80, vy: 7 });
  const flight = new HelicopterBody(physics, h);
  try {
    flight.read();
    const v = flight.body.GetLinearVelocity();
    assert.ok(Math.abs(Math.hypot(v.GetX(), v.GetZ()) * 3.6 - 300) < 0.001);
    assert.ok(Math.abs(h.speed * 3.6 - 300) < 0.001);
    assert.ok(Math.abs(v.GetX() / v.GetZ() + 0.75) < 0.0001);
    assert.equal(v.GetY(), 7);
  } finally { flight.dispose(); physics.dispose(); }
});

test('asistence nakloní vrtulník dovnitř levé i pravé zatáčky', async () => {
  const physics = new PhysicsWorld(await loadJolt());
  try {
    for (const yaw of [0, Math.PI / 2]) {
      const x = Math.cos(yaw), z = -Math.sin(yaw);
      for (const turn of [-1, 1]) {
        const h = helicopter({ yaw, speed: 18, vx: -18 * z, vz: 18 * x });
        const flight = new HelicopterBody(physics, h);
        try {
          for (let i = 0; i < 60; i++) {
            flight.drive(1 / 60, 0, turn, 0, true);
            physics.engine.Step(1 / 60, 1);
            flight.read();
          }
          assert.ok(Math.sin(h.yaw - yaw) * turn < 0);
          assert.ok((h.vx * x + h.vz * z) * turn < 0);
          assert.ok((h.x * x + h.z * z) * turn < 0);
        } finally { flight.dispose(); }
      }
    }
  } finally { physics.dispose(); }
});
