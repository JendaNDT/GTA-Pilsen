import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { PlayerVehicle } from '../src/physics/vehicle.js';
import { riverBed, Water } from '../src/physics/water.js';
import { terrainTriangles } from '../src/physics/terrain.js';
import { sampleWater, waterWalking } from '../src/world/water-profile.js';

test('dno na kraji řeky navazuje na suchou vozovku v původní výšce', () => {
  const world = { water: [{ i: 0, x0: 2, z0: -4, x1: 18, z1: 12 }],
    l: { pRing: [0, 1], ringStart: [0, 4], vx: [20, 180, 180, 20], vz: [-40, -40, 120, 120] },
    tG: 4, terrainDetail: new Map(), gradeTerrain: new Map(), tunnels: [], heightAt: () => 7 };
  let bankVertices = 0, bottom = 7;
  terrainTriangles(world, 0, 0, 0, 8, (...vertices) => {
    if (vertices.some(p => p[0] < 1.999)) {
      for (const p of vertices) assert.equal(p[1], 7);
    }
    for (const [x, y] of vertices) {
      if (Math.abs(x - 2) < 0.002) { assert.equal(y, 7); bankVertices++; }
      bottom = Math.min(bottom, y);
    }
  });
  assert.ok(bankVertices > 0);
  assert.ok(bottom < 6.5);
});

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

test('proud u Wilsonova mostu míří po toku a břeh jej zpomalí', () => {
  const world = { improvedWater: true, heightAt: () => 1, nearestShore: () => [0, 0, 20] };
  const center = sampleWater(world, 201, 495, {});
  assert.ok(center.vz < -0.5);
  assert.ok(Math.abs(center.vx) < 0.2);
  const bank = sampleWater({ ...world, nearestShore: () => [0, 0, 3] }, 201, 495, {});
  assert.ok(bank.vz > center.vz * 0.25 && bank.vz < 0);
  assert.equal(sampleWater(world, 1350, -3200, {}).vz, 0);
  assert.equal(sampleWater({ ...world, improvedWater: false }, 201, 495, {}).vz, 0);
});

test('brodění plynule zpomaluje chůzi a plavání nepřepíná v každém kroku', () => {
  assert.equal(waterWalking(0.2, 0.02, false), 0);
  assert.ok(waterWalking(0.7, 0.7, false) > waterWalking(0.3, 0.3, false));
  assert.ok(waterWalking(1.02, 1.02, false) < 1);
  assert.equal(waterWalking(1.02, 0.02, true), 1);
  assert.ok(waterWalking(0.85, 0, true) < 1);
});

test('Jolt unáší plovoucí auto po řece a stojatá voda jej nechá na místě', async () => {
  const physics = new PhysicsWorld(await loadJolt());
  const water = new Water(physics);
  const world = { improvedWater: true, isWater: () => true, heightAt: () => 0, nearestShore: () => [0, 0, 30] };
  const type = { id: 'hatch', len: 3.9, wid: 1.7, h: 1.45, mass: 1, maxSpeed: 46, accel: 6.2 };
  const make = (x, z) => new PlayerVehicle(physics, { x, y: 0.15, z, type, yaw: 0, mode: 'player',
    health: 100, steer: 0, speed: 0 });
  const river = make(201, 495), pond = make(1350, -3200);
  try {
    for (let i = 0; i < 180; i++) {
      for (const vehicle of [river, pond]) water.step(vehicle, world, 1 / 60);
      physics.engine.Step(1 / 60, 1);
      river.read();
      pond.read();
    }
    assert.ok(river.car.floodTime > 2 && pond.car.floodTime > 2);
    assert.ok(river.car.z < 494.6, `Poloha po proudu ${river.car.z}`);
    assert.ok(Math.abs(pond.car.z + 3200) < 0.05);
  } finally { water.dispose(); river.dispose(); pond.dispose(); physics.dispose(); }
});
