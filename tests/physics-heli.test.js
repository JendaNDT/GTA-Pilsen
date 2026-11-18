import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { HelicopterBody } from '../src/physics/heli.js';

test('vrtulník má 2500 kg a asistence při nulovém vstupu udrží náklon i výšku', async () => {
  const physics = new PhysicsWorld(await loadJolt());
  const h = { world: { heightAt: () => 0, playMinX: -2000, playMaxX: 2000, playMinZ: -2000, playMaxZ: 2000 },
    x: 0, y: 75, z: 0, vx: 0, vy: -0.6, vz: 0, yaw: 0.3, pitch: 0.08, roll: -0.06,
    occupied: true, landed: false, speed: 0, rotor: 30, sync() {} };
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
