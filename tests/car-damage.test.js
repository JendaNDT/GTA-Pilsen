import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Quaternion, Vector3, Scene } from 'three/webgpu';
import { dentCar, enginePower, panelLevels, restorePanels, steeringPull } from '../src/entities/damage.js';
import { loadJolt } from '../src/physics/jolt.js';
import { layers, PhysicsWorld } from '../src/physics/world.js';
import { DebrisBudget } from '../src/physics/debris.js';
import { CarFragments } from '../src/physics/car-fragments.js';

globalThis.window = {};
globalThis.location = { search: '?quality=low' };
globalThis.matchMedia = () => ({ matches: false });
const { Car } = await import('../src/entities/vehicles.js');
const { Garage } = await import('../src/game/garage.js');
const car = () => new Car('hatch', 0x508080);
const side = new Vector3(-0.84, 0.6, 0), inward = new Vector3(1, 0, 0);

test('promáčknutí patří jedinému vozu a každý vrchol ustoupí nejvýše o čtvrt metru', () => {
  const a = car(), b = car();
  const body = a.mesh.userData.batches.body, original = b.mesh.userData.batches.body.geometry;
  assert.equal(body.geometry, original);
  dentCar(a, 15, side, inward);
  assert.ok(a.damage.leftDoor > 0);
  assert.notEqual(body.geometry, original);
  const before = original.attributes.position, after = body.geometry.attributes.position;
  const p = new Vector3(), q = new Vector3();
  let max = 0;
  for (let i = 0; i < before.count; i++) max = Math.max(max,
    p.fromBufferAttribute(before, i).distanceTo(q.fromBufferAttribute(after, i)));
  assert.ok(max > 0.03 && max <= 0.250001);
  restorePanels(a, {});
  assert.equal(body.geometry, original);
});

test('odpojené dveře žijí jako samostatný fyzikální díl i po opravě původního auta', async () => {
  const a = car(), physics = new PhysicsWorld(await loadJolt());
  physics.debris = new DebrisBudget(() => 1, () => false);
  const fragments = new CarFragments(physics, new Scene());
  try {
    const pose = { position: new Vector3(5, 3, 7),
      rotation: new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2) };
    const height = 0.7;
    a.mesh.position.copy(pose.position);
    a.mesh.quaternion.copy(pose.rotation);
    a.mesh.translateY(-height);
    dentCar(a, 31, side, inward, (car, mesh, center) => {
      const expected = a.mesh.localToWorld(center.clone());
      fragments.queue(car, mesh, center, pose, height);
      assert.ok(mesh.position.distanceTo(expected) < 1e-6);
      assert.ok(mesh.quaternion.angleTo(pose.rotation) < 1e-6);
    });
    assert.equal(a.damage.leftDoor, 1);
    const { leftDoor } = a.mesh.userData.panels;
    const pos = a.mesh.userData.batches.body.geometry.attributes.position;
    assert.ok(pos.array.slice(leftDoor.start * 3, (leftDoor.start + leftDoor.count) * 3).every(v => v === 0));
    fragments.step(0, a);
    assert.equal(fragments.active.size, 0);
    fragments.step(1, a);
    assert.equal(fragments.active.size, 1);
    const [body] = fragments.active.keys();
    assert.equal(body.GetObjectLayer(), layers.DEBRIS);
    restorePanels(a, {});
    physics.engine.Step(1 / 60, 1);
    fragments.step(1, a);
    assert.equal(physics.debris.items.size, 1);
    fragments.step(1, { x: 500, z: 0 });
    assert.equal(physics.debris.items.size, 0);
  } finally { fragments.dispose(); physics.dispose(); }
});

test('garáž načte staré uložení, oddělí kopii úrovní a omezí hodnoty dílů', () => {
  const garage = new Garage({});
  garage.load({model: 'hatch', health: 79});
  assert.deepEqual(garage.snapshot().damage, {});
  const a = car();
  garage.active = a;
  restorePanels(a, { leftDoor: 2, hood: 0.4, rearBumper: -1, unknown: 1 });
  const saved = garage.snapshot();
  assert.deepEqual(saved.damage, { leftDoor: 1, hood: 0.4 });
  restorePanels(a, {});
  assert.deepEqual(panelLevels(saved.damage), { leftDoor: 1, hood: 0.4 });
});

test('poškozený motor ztrácí výkon a řízení táhne ke zničeným dveřím', () => {
  assert.equal(enginePower({health: 61}), 1);
  assert.equal(enginePower({health: 30}), 0.5);
  assert.equal(enginePower({health: 0}), 0);
  const a = {health: 40, damage: {leftDoor: 1}};
  assert.equal(steeringPull(a), 0);
  a.health = 15;
  assert.ok(steeringPull(a) > 0);
  a.damage = {rightDoor: 1};
  assert.ok(steeringPull(a) < 0);
});
