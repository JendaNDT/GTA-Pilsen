import assert from 'node:assert/strict';
import test from 'node:test';
import { Breakables } from '../src/physics/breakables.js';
import { loadJolt } from '../src/physics/jolt.js';
import { TrafficFurnitureBodies } from '../src/physics/traffic-furniture.js';
import { PhysicsWorld, layers } from '../src/physics/world.js';

const Jolt = await loadJolt();

function testFurniture(type, run) {
  const id = type + '/0/0';
  const entry = { x: 0, z: 0, tx: 0, tz: 1, kind: type === 'sign' ? 'stop' : 'signal', breakableId: id };
  const registry = new Breakables();
  const physics = new PhysicsWorld(Jolt);
  const world = { breakables: registry, groundY: () => 0, traffic: { chunks: new Map([
    [0, { signs: type === 'sign' ? [entry] : [], heads: type === 'signal' ? [entry] : [], posts: type === 'bollard' ? [entry] : [] }],
  ]) } };
  const furniture = new TrafficFurnitureBodies(physics, world);
  physics.onImpact = (a, b, impulse) => furniture.contact(a, b, impulse);
  furniture.load(0);
  assert.equal(furniture.step(0, 0), 0);
  assert.equal(furniture.records.has(id), false);
  assert.equal(furniture.step(0, 1), 0);

  const advance = ticks => {
    for (let i = 0; i < ticks; i++) {
      physics.step(1 / 60);
      furniture.step(0);
    }
  };
  const hit = (kmh, expected) => {
    const half = new Jolt.Vec3(0.85, 0.5, 1.7), pos = new Jolt.RVec3(0, 0.7, -2.35);
    const rotation = new Jolt.Quat(0, 0, 0, 1);
    const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), pos, rotation,
      Jolt.EMotionType_Dynamic, layers.VEHICLE);
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = 1000;
    const car = physics.bodies.CreateBody(settings), carID = car.GetID();
    physics.bodies.AddBody(carID, Jolt.EActivation_Activate);
    const speed = new Jolt.Vec3(0, 0, kmh / 3.6);
    physics.bodies.SetLinearVelocity(carID, speed);
    try {
      for (let i = 0; i < 36; i++) {
        advance(1);
        if (expected !== 'intact' && registry.state(id) === expected) break;
      }
      assert.equal(registry.state(id), expected);
    } finally {
      physics.bodies.RemoveBody(carID);
      physics.bodies.DestroyBody(carID);
      for (const o of [half, pos, rotation, settings, speed]) Jolt.destroy(o);
    }
  };
  try {
    run({ furniture, id, registry, advance, hit });
  } finally {
    furniture.dispose();
    physics.dispose();
  }
}

test('značka přečká slabý náraz, ohne se na kloubu a po dalším nárazu se rozlomí', () => {
  testFurniture('sign', ({ furniture, id, registry, advance, hit }) => {
    hit(6, 'intact');
    hit(18, 'bent');
    assert.ok(furniture.records.get(id).hinge);
    advance(360);
    const pose = registry.damaged.get(id).pose;
    assert.ok(Math.abs(pose.qx) > 0.1 && pose.qx > 0);
    assert.equal(furniture.records.get(id).body.IsStatic(), true);
    furniture.unload(0);
    advance(1);
    assert.equal(furniture.records.has(id), false);
    furniture.load(0);
    advance(1);
    assert.ok(Math.abs(furniture.records.get(id).body.GetRotation().GetX() - pose.qx) < 1e-6);

    hit(43, 'broken');
    assert.equal(furniture.records.get(id).pieces.length, 2);
    const before = 28 * 3600 - 1;
    furniture.repair(registry.repairDue(before));
    furniture.step(before);
    assert.equal(furniture.records.get(id).state, 'broken');
    furniture.repair(registry.repairDue(before + 1));
    furniture.step(before + 1);
    assert.equal(furniture.records.get(id).state, 'intact');
  });
});

test('semafor odolá 45 km/h a při nárazu 65 km/h z něj spadnou dva samostatné díly', () => {
  testFurniture('signal', ({ furniture, id, hit }) => {
    hit(45, 'intact');
    hit(65, 'broken');
    assert.equal(furniture.records.get(id).pieces.length, 2);
  });
});

test('samostatný sloupek se uvolní jako jediný díl a ráno se znovu ukotví', () => {
  testFurniture('bollard', ({furniture, id, hit, registry}) => {
    hit(10, 'intact');
    hit(40, 'broken');
    assert.equal(furniture.records.get(id).pieces.length, 1);
    furniture.repair(registry.repairDue(28 * 3600));
    furniture.step(28 * 3600);
    assert.ok(furniture.records.get(id).body.IsStatic());
  });
});
