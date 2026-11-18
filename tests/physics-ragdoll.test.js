import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { Ragdoll } from '../src/physics/ragdoll.js';

test('jedenáct částí postavy po nárazu 10 m/s dopadne a uklidní se do pěti sekund', async () => {
  const physics = new PhysicsWorld(await loadJolt());
  const { Jolt, bodies } = physics;
  const half = new Jolt.Vec3(40, 0.5, 40), pos = new Jolt.RVec3(0, -0.5, 0), rot = new Jolt.Quat(0, 0, 0, 1);
  const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), pos, rot, Jolt.EMotionType_Static, 0);
  const floor = bodies.CreateAndAddBody(settings, Jolt.EActivation_DontActivate);
  for (const object of [settings, half, pos, rot]) Jolt.destroy(object);
  try {
    for (const direction of [1, -1]) {
      const doll = new Ragdoll(physics, { x: 0, y: -0.2, z: 0, yaw: Math.PI / 4 }, 10 * direction, 1.8, 0, () => 0);
      try {
        assert.equal(doll.links.length, 11);
        assert.equal(doll.doll.GetConstraintCount(), 10);
        for (let i = 0; i < 300; i++) { physics.update(1 / 60); doll.update(1 / 60); }
        const p = doll.links[0].GetPosition();
        assert.ok(p.GetX() * direction > 1 && p.GetY() > 0 && p.GetY() < 0.7);
        assert.ok(doll.rest > 0.2, 'Na konci páté sekundy musí být v klidu všechny části.');
      } finally { doll.dispose(); }
    }
  } finally { bodies.RemoveBody(floor); bodies.DestroyBody(floor); physics.dispose(); }
});
