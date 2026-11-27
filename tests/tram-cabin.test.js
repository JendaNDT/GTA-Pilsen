import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTICULATED_CABIN, BUS_CABIN, TATRA_CABIN, boardingDoor, CABIN_DOORS, TramCabin } from '../src/game/tram-cabin.js';

test('nástup připouští jen pravou stranu a otvor konkrétních dveří', () => {
  for (const z of CABIN_DOORS) {
    assert.equal(boardingDoor(2.6, z), z);
    assert.equal(boardingDoor(-2.6, z), null);
    assert.equal(boardingDoor(2.6, z + 1), null);
  }
});

test('cestující zůstává na podlaze a ulička vede od zadních dveří až ke kabině', () => {
  const cabin = new TramCabin(CABIN_DOORS[2], {});
  const walk = (x, y, steps) => {
    for (let i = 0; i < steps; i++) cabin.walk(1 / 60, x, y);
  };
  walk(0, 1, 180);
  assert.ok(cabin.z < -5.35);
  walk(-1, 0, 28);
  walk(0, 1, 600);
  assert.ok(cabin.z > 6.43 && cabin.z <= 6.48);
  walk(1, 0, 100);
  assert.ok(cabin.x >= -1.04 && cabin.x < -1);
  assert.equal(cabin.action, 'Vystoupit');
});

test('u sedadla lze sedět i vstát na původním místě v uličce', () => {
  const cabin = new TramCabin(2.6, {});
  cabin.x = 0.1;
  assert.equal(cabin.action, 'Sednout si');
  cabin.seat = cabin.nearbySeat();
  assert.deepEqual(cabin.seat, { x: 0.81, z: 2.6 });
  cabin.walk(1 / 60, 1, 1);
  assert.equal(cabin.action, 'Vstát');
  assert.equal(cabin.x, 0.1);
  assert.equal(cabin.z, 2.6);
});

test('ulička spojuje tři články oběma směry a drží cestujícího uvnitř měchu', () => {
  const cabin = new TramCabin(2.36, {}, ARTICULATED_CABIN);
  cabin.x = 0;
  function walk(steps, forward) {
    for (let i = 0; i < steps; i++) cabin.walk(1 / 60, 0, forward);
  }
  walk(270, 1);
  assert.equal(cabin.section, 1);
  assert.ok(cabin.z > 4 && cabin.z < 4.5);
  walk(650, 1);
  assert.equal(cabin.section, 2);
  assert.ok(cabin.z >= -3.05 && cabin.z < -3);
  walk(1100, -1);
  assert.equal(cabin.section, 0);
  assert.ok(cabin.z > 3 && cabin.z <= 3.05);
  cabin.z = -3.8;
  cabin.x = 0.94;
  walk(120, 1);
  assert.equal(cabin.section, 0);
  assert.ok(cabin.z > -4);
});

test('cestující v autobusu projde ke všem třem dveřím a nemůže vkročit do podběhu kola', () => {
  const [section] = BUS_CABIN;
  const cabin = new TramCabin(4.69, {}, BUS_CABIN);
  for (const z of section.doors) {
    assert.equal(boardingDoor(2.6, z, section.doors), z);
    assert.equal(boardingDoor(-2.6, z, section.doors), null);
    cabin.x = 0;
    for (let i = 0; i < 400 && cabin.z > z + 0.03; i++) cabin.walk(1 / 60, 0, 1);
    for (let i = 0; i < 25; i++) cabin.walk(1 / 60, -1, 0);
    assert.equal(cabin.door, z);
  }
  cabin.z = section.wheelWells[0] + 0.59;
  cabin.x = 0;
  for (let i = 0; i < 45; i++) cabin.walk(1 / 60, 1, 0);
  assert.ok(cabin.x > 0.6 && cabin.x <= 0.68);
});

test('každý vůz spřažené Tatry má vlastní uličku zakončenou stěnou', () => {
  const car = { ...TATRA_CABIN[0], length: 16.2 };
  for (const index of [0, 1]) {
    const cabin = new TramCabin(car.doors[0], {}, [car, car], index);
    cabin.x = 0;
    for (const direction of [1, -1]) {
      for (let i = 0; i < 650; i++) cabin.walk(1 / 60, 0, direction);
      assert.equal(cabin.section, index);
      assert.ok(Math.abs(cabin.z - (direction === 1 ? car.min : car.max)) < 0.04);
    }
  }
});
