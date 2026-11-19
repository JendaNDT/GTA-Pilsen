import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld, layers } from '../src/physics/world.js';
import { PlayerVehicle, vehicleSpec } from '../src/physics/vehicle.js';

globalThis.window = {};
globalThis.location = { search: '' };
globalThis.matchMedia = () => ({ matches: false });
const { CAR_TYPES } = await import('../src/entities/models.js');
const { VehicleManager } = await import('../src/entities/vehicles.js');
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

test('fyzický náraz poškodí karoserii, lehký dotyk stěny ji nepoškodí', () => {
  for (const speed of [2, 15]) {
    const { car, vehicle, tick, addBox, close } = track('hatch');
    try {
      vehicle.physics.onImpact = (...args) => vehicle.recordImpact(...args);
      addBox(0, 2, 3, [3, 2, 0.1]);
      car.speed = car.vz = speed;
      vehicle.teleport();
      for (let i = 0; i < 120; i++) {
        tick();
        if (vehicle.impactSpeed) vehicle.applyImpact();
      }
      if (speed === 2) assert.equal(car.health, 100);
      else assert.ok(car.health < 90 && car.health > 65, 'Stav karoserie ' + car.health);
    } finally { close(); }
  }
});

test('malé auto drží na suchém padesátimetrovém kruhu boční zrychlení 0,85 až 0,95 g', () => {
  const { car, vehicle, tick, close } = track('hatch');
  try {
    const radius = 50, targetSpeed = 21;
    car.vz = car.speed = targetSpeed;
    vehicle.teleport();
    let total = 0, samples = 0, largestError = 0;
    for (let i = 0; i < 24 * 60; i++) {
      const angle = Math.atan2(car.z, radius - car.x) + 8 / radius;
      const dx = radius * (1 - Math.cos(angle)) - car.x, dz = radius * Math.sin(angle) - car.z;
      const direction = Math.atan2(dx, dz) - car.yaw;
      const wheelAngle = Math.atan2(2 * vehicle.spec.wheelbase * Math.sin(direction), Math.hypot(dx, dz));
      const steeringLimit = Math.min(1, 0.13 + 32 / (32 + car.speed ** 2));
      const vx = car.vx, vz = car.vz;
      const clampInput = (value) => Math.max(-1, Math.min(1, value));
      tick(clampInput((targetSpeed - car.speed) * 0.8), clampInput(-wheelAngle / (0.62 * steeringLimit)), false, false);
      if (i < 12 * 60) continue;
      const distance = Math.hypot(car.x - radius, car.z);
      largestError = Math.max(largestError, Math.abs(distance - radius));
      total += ((vx - car.vx) * (car.x - radius) + (vz - car.vz) * car.z) * 60 / (distance * 9.81);
      samples++;
    }
    assert.ok(largestError < 0.5, 'Odchylka od kružnice ' + largestError + ' m');
    assert.ok(total / samples >= 0.85 && total / samples <= 0.95, 'Boční zrychlení ' + total / samples + ' g');
  } finally { close(); }
});

const { driveRoute } = await import('../src/game/ai-driver.js');

for (const route of ['rovina', 'zatáčka', 'stop čára']) {
  test('řidič AI na fyzikálním voze – ' + route, (t) => {
    const { car, vehicle, close } = track('hatch');
    const radius = 15, line = 46, dt = 1 / 60;
    const startSpeed = route === 'stop čára' ? 50 / 3.6 : 5;
    car.speed = car.vz = startSpeed;
    vehicle.teleport();
    let state, distance = 0, maxError = 0;
    try {
      for (let i = 0; i < 24 * 60; i++) {
        const angle = Math.atan2(car.z, radius - car.x);
        const sample = (look) => route === 'zatáčka'
          ? { x: radius * (1 - Math.cos(angle + look / radius)), z: radius * Math.sin(angle + look / radius) }
          : { x: 0, z: car.z + look };
        const gap = route === 'stop čára' ? line - car.z - car.type.len / 2 : Infinity;
        state = driveRoute(car, sample, startSpeed, gap, state, dt);
        assert.ok(state.throttle >= 0 && state.throttle <= 1 && state.brake >= 0 && state.brake <= 1);
        assert.ok(Math.abs(state.steer) <= 1 && state.throttle * state.brake === 0);
        vehicle.controller.SetDriverInput(state.throttle, state.steer, state.brake, 0);
        vehicle.physics.engine.Step(dt, 1);
        vehicle.read();
        distance += car.speed * dt;
        if (route === 'zatáčka') maxError = Math.max(maxError, Math.abs(Math.hypot(car.x - radius, car.z) - radius));
        if (route === 'rovina') maxError = Math.max(maxError, Math.abs(car.x));
        if (route === 'stop čára') assert.ok(car.z + car.type.len / 2 <= line);
      }
      if (route === 'stop čára') {
        t.diagnostic('Příď zastavila ' + (line - car.z - car.type.len / 2).toFixed(2) + ' m před čárou.');
        assert.ok(line - car.z - car.type.len / 2 < 1, 'Vzdálenost před čárou ' + (line - car.z - car.type.len / 2));
        assert.ok(Math.abs(car.speed) < 0.05);
      } else {
        t.diagnostic('Ujetá dráha ' + distance.toFixed(1) + ' m, největší odchylka ' + maxError.toFixed(2) + ' m.');
        assert.ok(distance > 2 * Math.PI * radius);
        assert.ok(maxError < 0.5, 'Největší odchylka ' + maxError);
      }
    } finally { close(); }
  });
}

test('okruh provozu drží rozpočet, rychlost a pořadí i mezi oběma hranicemi', async () => {
  const { TrafficBodies } = await import('../src/physics/traffic-bodies.js');
  const { applyQualityProfile, QUALITY } = await import('../src/config.js');
  const physics = new PhysicsWorld(Jolt);
  const traffic = new TrafficBodies(physics, QUALITY);
  const cars = Array.from({ length: 42 }, (_, n) => ({ ...{ x: 0, y: 0, z: n * 2, yaw: 0.3,
    vx: 2, vy: 0.1, vz: 6, speed: 6.32, health: 100 }, mode: 'ai', edge: 1, s: n * 2, type: CAR_TYPES.sedan }));
  const game = { focus: { x: 0, z: 0 }, world: { chunkIndex: () => 1 }, colliders: { tiles: new Set([1]) }, vehicles: { cars } };
  try {
    for (const [preset, limit] of [['ultra', 40], ['high', 40], ['medium', 20], ['low', 10]]) {
      applyQualityProfile(preset);
      traffic.selectCars(game);
      assert.equal(traffic.dynamic.size, limit);
    }
    const car = cars[0], vehicle = car.physical;
    vehicle.read();
    assert.ok(Math.abs(car.yaw - 0.3) < 0.0001 && Math.abs(car.vz - 6) < 0.001 && Math.abs(car.vx - 2) < 0.001);
    for (const x of [150, 219, 220]) {
      game.focus.x = x;
      traffic.selectCars(game);
      assert.equal(car.physical, vehicle);
    }
    game.focus.x = 221;
    traffic.selectCars(game);
    assert.equal(traffic.dynamic.size, 0);
    assert.equal(car.s, 0);
    assert.ok(Math.abs(car.x) < 0.001 && Math.abs(car.z) < 0.001 && Math.abs(car.vy - 0.1) < 0.001);
  } finally {
    for (const car of cars) traffic.removeCar(car);
    applyQualityProfile('high');
    physics.dispose();
  }
});

test('řidič se nepokusí rozjet auto, které po nehodě leží na střeše', () => {
  const { car, vehicle, tick, close } = track('hatch');
  try {
    car.physical = vehicle;
    car.y = 1.5;
    car.gRoll = Math.PI;
    vehicle.teleport();
    for (let i = 0; i < 180; i++) tick();
    assert.ok(Math.cos(car.roll) * Math.cos(car.pitch) < 0);
    assert.ok(vehicle.wheels.every((wheel) => !wheel.HasContact()));
    assert.equal(VehicleManager.prototype._resumeAI.call({}, car), false);
  } finally { close(); }
});

test('odklizení nabouraného auta vyžaduje celou minutu stání a celý vůz mimo záběr', async () => {
  const { PerspectiveCamera, Scene } = await import('three/webgpu');
  const camera = new PerspectiveCamera(60, 1, 0.1, 250);
  camera.position.set(0, 1, 0);
  camera.lookAt(0, 1, -20);
  const game = { camera, player: {}, garage: {} };
  const manager = new VehicleManager(new Scene(), {}, game);
  const wreck = { mode: 'parked', crashed: true, x: 0, y: 0, z: 20, vx: 0, vy: 0, vz: 0,
    type: CAR_TYPES.sedan, halfLen: CAR_TYPES.sedan.len / 2 };
  assert.equal(manager.clearWreck(wreck, 59.9), false);
  wreck.vx = 1;
  assert.equal(manager.clearWreck(wreck, 0.1), false);
  wreck.vx = 0;
  assert.equal(manager.clearWreck(wreck, 59), false);
  wreck.z = -20;
  assert.equal(manager.clearWreck(wreck, 1), false);
  wreck.x = 12; // Střed je za pravým okrajem, část karoserie je stále v záběru.
  assert.equal(manager.clearWreck(wreck, 10), false);
  wreck.z = 20;
  game.player.lastCar = wreck;
  assert.equal(manager.clearWreck(wreck, 1), false);
  game.player.lastCar = null;
  game.garage.active = wreck;
  assert.equal(manager.clearWreck(wreck, 1), false);
  game.garage.active = null;
  game.car = wreck;
  assert.equal(manager.clearWreck(wreck, 1), false);
  game.car = null;
  assert.equal(manager.clearWreck(wreck, 1), true);
  wreck.crashed = false;
  assert.equal(manager.clearWreck(wreck, 100), false);
});
