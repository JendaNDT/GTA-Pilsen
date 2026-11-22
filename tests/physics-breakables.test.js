import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene } from 'three/webgpu';
import { Breakables } from '../src/physics/breakables.js';
import { LampBodies } from '../src/physics/lamp-bodies.js';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld, layers } from '../src/physics/world.js';

const Jolt = await loadJolt();

for (const [kmh, expected] of [[10, 'intact'], [30, 'broken']]) {
  test(`malé auto při ${kmh} km/h narazí do skutečného tělesa pouliční lampy`, () => {
    const physics = new PhysicsWorld(Jolt), registry = new Breakables();
    const lamps = new LampBodies(physics, registry, new Scene());
    const lamp = { id: 'lamp/0/0', height: 6.2, head: 0.5, x: 0, y: 0, z: 0 };
    lamps.load([lamp]);
    lamps.step(0);
    const half = new Jolt.Vec3(0.85, 0.6, 1.7), pos = new Jolt.RVec3(0, 1.5, -2.3);
    const rotation = new Jolt.Quat(0, 0, 0, 1);
    const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), pos, rotation,
      Jolt.EMotionType_Dynamic, layers.VEHICLE);
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = 1000;
    const car = physics.bodies.CreateBody(settings);
    physics.bodies.AddBody(car.GetID(), Jolt.EActivation_Activate);
    const v = new Jolt.Vec3(0, 0, kmh / 3.6);
    physics.bodies.SetLinearVelocity(car.GetID(), v);
    let contacts = 0;
    physics.onImpact = (a, b, impulse) => { contacts++; lamps.contact(a, b, impulse); };
    for (let i = 0; i < 45; i++) {
      physics.engine.Step(1 / 60, 1);
      lamps.step(i / 60);
    }
    assert.ok(contacts > 0);
    assert.equal(registry.state(lamp.id), expected);
    assert.equal(lamps.bodies.has(lamp.id), expected === 'intact');
    assert.equal(lamps.debris.get(lamp.id)?.length ?? 0, expected === 'intact' ? 0 : 2);
    lamps.unload([lamp]);
    lamps.step(1);
    for (const object of [settings, half, pos, rotation, v]) Jolt.destroy(object);
    lamps.dispose();
    physics.dispose();
  });
}
