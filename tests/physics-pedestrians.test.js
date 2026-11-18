import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadJolt } from '../src/physics/jolt.js';
import { layers, PhysicsWorld } from '../src/physics/world.js';
import { TrafficBodies } from '../src/physics/traffic-bodies.js';

test('kapsle do 80 m zaznamená průjezd auta, v jiném patře střet nenastane', async () => {
  const physics = new PhysicsWorld(await loadJolt()), traffic = new TrafficBodies(physics);
  const ped = { x: 80, y: 0, z: 0, state: 'walk' };
  const car = { isCar: true, x: 80, y: 0, z: -4, yaw: 0, type: { wid: 2, h: 1.5, len: 4 } };
  const game = { focus: { x: 0, z: 0 }, peds: { peds: [ped] }, vehicles: { cars: [car] } };
  let hits = 0;
  physics.onPedContact = (person, vehicle) => {
    assert.equal(person.GetObjectLayer(), layers.CHARACTER);
    assert.equal(traffic.owners.get(person.GetID().GetIndexAndSequenceNumber()), ped);
    assert.equal(traffic.carForBody(vehicle.GetID().GetIndexAndSequenceNumber()), car);
    if (Math.abs(vehicle.GetLinearVelocity().GetZ()) > 9.9) hits++;
  };
  function frame() { traffic.update(game, 1 / 60); physics.update(1 / 60); }
  try {
    frame();
    assert.equal(traffic.active.size, 2);
    for (let i = 0; i < 48; i++) { car.z += 10 / 60; frame(); }
    assert.ok(hits > 0);
    car.y = 5;
    frame();
    hits = 0;
    for (let i = 0; i < 48; i++) { car.z -= 10 / 60; frame(); }
    assert.equal(hits, 0);
    ped.x += 0.1;
    frame();
    assert.equal(traffic.active.has(ped), false);
    game.vehicles.cars.length = 0;
    frame();
    assert.equal(traffic.owners.size, 0);
  } finally {
    physics.Jolt.destroy(traffic.pos); physics.Jolt.destroy(traffic.rotation);
    physics.dispose();
  }
});
