import assert from 'node:assert/strict';
import test from 'node:test';
import { streetFixtures } from '../src/world/street-furniture.js';
import { WalkingCharacter } from '../src/physics/character.js';
import { Breakables } from '../src/physics/breakables.js';
import { PhysicsWorld, layers } from '../src/physics/world.js';
import { loadJolt } from '../src/physics/jolt.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { RoadFurnitureBodies } = await import('../src/physics/road-furniture.js');
const { staticMeshBody } = await import('../src/physics/colliders.js');
const Jolt = await loadJolt();

for (const [style, speed, broken] of [['stone', 50, false], ['open', 60, true], ['solid', 10, false], ['closure', 20, true],
  ['bench', 18, true], ['bin', 14, true], ['shelter', 18, true]]) {
  test(`překážka ${style} při herním nárazu ${speed} km/h`, () => {
    const physics = new PhysicsWorld(Jolt), registry = new Breakables();
    const rail = (x, id) => ({ id: 'railing/0/' + id, style, tile: 0, x, y: 0.5, z: 0.05, height: 1,
      corners: [[x-1.25,0,0], [x+1.25,0,0], [x+1.25,0,0.1], [x-1.25,0,0.1]] });
    const closure = { id: 'closure/0/0', tile: 0, x: 0, y: 0.44, z: 0, closure: [0,0,0,1,4], obstacles: [0,0,0.66] };
    const isClosure = style === 'closure', isStreet = ['bench','bin','shelter'].includes(style);
    const street = streetFixtures({id:'fiktivni-vzorek',kind:style,x:0,z:0,yaw:0},
      {heightAt:() => 0, chunkIndex:() => 0});
    const target = isStreet ? street.find(f => Number.isFinite(f.impulse)) : isClosure ? closure : rail(0,0);
    const edge = rail(2.5, 1), obstacles = new Set([closure.obstacles]);
    const world = { breakables: registry, heightAt: () => 0,
      bridgeEdges: new Map([[0, isClosure || isStreet ? [] : [target, edge]]]),
      streetFixtures: new Map([[0,street]]),
      closureChunks: new Map([[0, isClosure ? [closure] : []]]),
      addObstacles: list => obstacles.add(list), removeObstacles: list => obstacles.delete(list) };
    const manager = new RoadFurnitureBodies(physics, world, staticMeshBody);
    physics.onImpact = () => {};
    physics.onRailingHit = (...args) => manager.contact(...args);
    manager.load(0);
    manager.step(0);
    const floor = staticMeshBody(physics, Float32Array.from([-20,0,-20,-20,0,20,20,0,-20,20,0,-20,-20,0,20,20,0,20]));
    const half = new Jolt.Vec3(0.7, 0.38, 1.35), pos = new Jolt.RVec3(0, 0.55, -2), rot = new Jolt.Quat(0,0,0,1);
    const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), pos, rot, Jolt.EMotionType_Dynamic, layers.VEHICLE);
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = 1000;
    const car = physics.bodies.CreateBody(settings);
    physics.bodies.AddBody(car.GetID(), Jolt.EActivation_Activate);
    half.Set(0,0,speed/3.6);
    physics.bodies.SetLinearVelocity(car.GetID(), half);
    try {
      for (let i=0; i<75; i++) {
        physics.engine.Step(1/60, 1);
        manager.step(i/60);
      }
      assert.equal(registry.state(target.id), broken ? isClosure ? 'moved' : 'broken' : 'intact');
      assert.equal(registry.state(edge.id), 'intact');
      for (const frame of street.filter(f => !Number.isFinite(f.impulse))) assert.equal(registry.state(frame.id),'intact');
      if (broken) assert.ok(car.GetPosition().GetZ() > 0);
      if (isClosure) assert.ok(!obstacles.has(closure.obstacles));
      manager.unload(0);
      manager.step(2);
      manager.load(0);
      manager.step(3);
      assert.equal(registry.state(target.id) === 'intact', !broken);
      if (broken && !isClosure && !isStreet) {
        const player = { x: 0, y: 0, z: -2, vx: 0, vy: 0, vz: 4, grounded: true, fallStart: 0 };
        const walker = new WalkingCharacter(physics, player);
        try {
          for (let i = 0; i < 90; i++) walker.move(1/60, player, false);
          assert.ok(player.grounded && player.z > -0.6 && player.z < 0, JSON.stringify(player));
        } finally { walker.dispose(); }
      }
      manager.repair(registry.repairDue(28*3600));
      manager.step(28*3600);
      assert.equal(registry.state(target.id), 'intact');
      if (isClosure) assert.deepEqual([...obstacles], [closure.obstacles]);
    } finally {
      manager.unload(0);
      manager.step(29*3600);
      manager.destroyBody(car);
      manager.destroyBody(floor);
      for (const item of [settings, half, pos, rot, manager.position, manager.vector, manager.rotation]) Jolt.destroy(item);
      physics.dispose();
    }
  });
}
