import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { PlayerVehicle } from '../src/physics/vehicle.js';
import { riverBed, Water } from '../src/physics/water.js';

test('odhad dna navazuje na břeh a ostrov, uprostřed široké plochy má omezenou hloubku', () => {
  const polygon = { water: [{ i: 0, x0: 0, z0: 0, x1: 160, z1: 160 }],
    l: { pRing: [0, 2], ringStart: [0, 4, 8], vx: [0, 1600, 1600, 0, 700, 700, 900, 900],
      vz: [0, 0, 1600, 1600, 700, 900, 900, 700] } };
  const depth = riverBed(polygon, -10, -10, 180);
  assert.equal(depth(-5, 50), 0);
  assert.equal(depth(0, 50), 0);
  assert.equal(depth(80, 80), 0);
  assert.ok(Math.abs(depth(80, 68) - 0.24) < 0.001);
  assert.ok(depth(20, 40) > depth(10, 40));
  assert.ok(Math.abs(depth(30, 40) - 1.51) < 0.001);
  const lake = { water: [{ i: 0, x0: 0, x1: 200, z0: 0, z1: 200 }],
    l: { pRing: [0, 1], ringStart: [0, 4], vx: [0, 2000, 2000, 0], vz: [0, 0, 2000, 2000] } };
  assert.ok(Math.abs(riverBed(lake, 0, 0, 200)(100, 100) - 2.4) < 0.001);
  assert.equal(riverBed(polygon, -200, -200, 20), null);
});

test('auto se po pádu do vody udrží na hladině a potopí se za 6 až 12 sekund', async () => {
  const physics = new PhysicsWorld(await loadJolt());
  const car = { type: { id: 'hatch', len: 3.9, wid: 1.7, h: 1.45, mass: 1, maxSpeed: 46, accel: 6.2 },
    x: 0, y: 0.8, z: 0, yaw: 0, mode: 'player', health: 100, steer: 0, speed: 0 };
  const vehicle = new PlayerVehicle(physics, car), water = new Water(physics);
  const world = { isWater: () => true, heightAt: () => 0 };
  let splashes = 0, afloat = 0;
  try {
    for (let i = 0; i < 840 && !water.sunk.size; i++) {
      if (water.step(vehicle, world, 1 / 60)) splashes++;
      physics.engine.Step(1 / 60, 1);
      vehicle.read();
      if (car.floodTime > 2 && car.floodTime < 4 && car.y < 0 && car.y + car.type.h > 0) afloat++;
    }
    assert.equal(splashes, 1);
    assert.ok(afloat > 100, 'Doba plavání ' + afloat / 60);
    assert.ok(water.sunk.has(car) && car.floodTime >= 6 && car.floodTime <= 12, 'Doba nabírání vody ' + car.floodTime);
    assert.ok(car.y + car.type.h < 0);
  } finally { water.dispose(); vehicle.dispose(); physics.dispose(); }
});
