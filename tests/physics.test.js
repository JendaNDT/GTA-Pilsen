import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadJolt } from '../src/physics/jolt.js';
import { layers, PhysicsWorld } from '../src/physics/world.js';

test('těleso padá, narazí do podložky a zůstane na ní stát', async () => {
  const Jolt = await loadJolt();
  const world = new PhysicsWorld(Jolt);
  const contacts = [];
  world.onImpact = (a, b, impulse) => contacts.push(impulse);
  const createBox = (height, dynamic) => {
    const half = new Jolt.Vec3(0.5, 0.5, 0.5);
    const shape = new Jolt.BoxShape(half);
    const pos = new Jolt.RVec3(0, height, 0);
    const rotation = new Jolt.Quat(0, 0, 0, 1);
    const settings = new Jolt.BodyCreationSettings(shape, pos, rotation,
      dynamic ? Jolt.EMotionType_Dynamic : Jolt.EMotionType_Static,
      dynamic ? layers.VEHICLE : layers.STATIC);
    const body = world.bodies.CreateBody(settings);
    world.bodies.AddBody(body.GetID(), dynamic ? Jolt.EActivation_Activate : Jolt.EActivation_DontActivate);
    for (const value of [settings, pos, rotation, half]) Jolt.destroy(value);
    return body;
  };
  const floor = createBox(0, false);
  const box = createBox(4, true);
  try {
    for (let i = 0; i < 20; i++) world.engine.Step(1 / 60, 1);
    assert.ok(box.GetPosition().GetY() < 3.6);
    for (let i = 0; i < 220; i++) world.engine.Step(1 / 60, 1);
    assert.ok(Math.abs(box.GetPosition().GetY() - 1) < 0.025);
    assert.ok(Math.abs(box.GetLinearVelocity().GetY()) < 0.01);
    assert.ok(contacts.some((impulse) => impulse > 0));
  } finally {
    for (const body of [box, floor]) {
      const id = body.GetID();
      world.bodies.RemoveBody(id);
      world.bodies.DestroyBody(id);
    }
    world.dispose();
  }
});
