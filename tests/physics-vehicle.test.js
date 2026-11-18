import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld, layers } from '../src/physics/world.js';
import { PlayerVehicle, vehicleSpec } from '../src/physics/vehicle.js';

globalThis.window = {};
globalThis.location = { search: '' };
globalThis.matchMedia = () => ({ matches: false });
const { CAR_TYPES } = await import('../src/entities/models.js');
const Jolt = await loadJolt();
const asphalt = () => 1;

function track(type, angle = 0) {
  const physics = new PhysicsWorld(Jolt);
  const addBox = (x, y, z, halfSizes, tilt = 0) => {
    const half = new Jolt.Vec3(...halfSizes), pos = new Jolt.RVec3(x, y, z);
    const rotation = new Jolt.Quat(Math.sin(tilt / 2), 0, 0, Math.cos(tilt / 2));
    const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), pos, rotation, Jolt.EMotionType_Static, layers.STATIC);
    physics.bodies.CreateAndAddBody(settings, Jolt.EActivation_DontActivate);
    for (const value of [half, pos, rotation, settings]) Jolt.destroy(value);
  };
  addBox(0, -1 / Math.cos(angle), 0, [2000, 1, 6000], angle);
  const car = { type: CAR_TYPES[type], x: 0, y: 0, z: 0, gPitch: angle, yaw: 0,
    vx: 0, vy: 0, vz: 0, speed: 0, steer: 0, health: 100 };
  const vehicle = new PlayerVehicle(physics, car);
  const tick = (throttle = 0, steer = 0, brake = false, arcade = true) => {
    vehicle.drive(1 / 60, throttle, steer, brake, arcade, asphalt);
    physics.engine.Step(1 / 60, 1);
    vehicle.read();
  };
  for (let i = 0; i < 120; i++) tick(0, 0, true);
  return { car, vehicle, tick, addBox, close() { vehicle.dispose(); physics.dispose(); } };
}

test('poháněné nápravy a rychlost na omezovači odpovídají typu auta', () => {
  for (const type of Object.values(CAR_TYPES)) {
    const s = vehicleSpec(type);
    const speed = s.rpm * Math.PI * s.radius / (30 * s.finalRatio * s.gears.at(-1));
    assert.ok(Math.abs(speed - type.maxSpeed) < 0.01);
    const expected = ['pickup', 'police', 'suv'].includes(type.id) ? [0, 2] : ['sport', 'van'].includes(type.id) ? [2] : [0];
    assert.deepEqual(s.driven, expected);
  }
});

for (const [type, from, to] of [['hatch', 11, 14], ['sport', 4, 6]]) {
  test(type + ' splní zrychlení na 100 km/h i brzdnou dráhu s ABS', () => {
    const { car, tick, close } = track(type);
    try {
      let steps = 0;
      while (car.speed * 3.6 < 100 && steps < 1200) { tick(1); steps++; }
      assert.ok(steps / 60 >= from && steps / 60 <= to && car.speed * 3.6 >= 100, 'Zrychlení za ' + steps / 60 + ' s');
      const start = car.z;
      // Brzda až do zastavení. Přeskočení nuly už znamená začátek couvání.
      for (let i = 0; i < 600 && car.speed > 0; i++) tick(-1);
      const distance = car.z - start;
      assert.ok(car.speed <= 0);
      assert.ok(distance >= 36 && distance <= 45, 'Brzdná dráha ' + distance + ' m');
    } finally { close(); }
  });
}

test('ruční brzda udrží vůz na patnáctiprocentním svahu', () => {
  const { car, tick, close } = track('hatch', Math.atan(0.15));
  try {
    const start = car.z;
    for (let i = 0; i < 600; i++) tick(0, 0, true);
    assert.ok(Math.abs(car.z - start) < 0.1);
  } finally { close(); }
});

test('při 250 km/h zůstane vůz na nájezdové straně stěny tlusté 20 cm', () => {
  const { car, vehicle, tick, addBox, close } = track('sport');
  try {
    addBox(0, 2, 5, [10, 2, 0.1]);
    car.vz = car.speed = 250 / 3.6;
    vehicle.teleport();
    for (let i = 0; i < 60; i++) { tick(); assert.ok(car.z < 5); }
  } finally { close(); }
});
