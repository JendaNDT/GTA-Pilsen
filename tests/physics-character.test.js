import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadJolt } from '../src/physics/jolt.js';
import { layers, PhysicsWorld } from '../src/physics/world.js';
import { WalkingCharacter } from '../src/physics/character.js';
globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { staticMeshBody } = await import('../src/physics/colliders.js');

async function walk(profile, initial, frames, controls = () => false) {
  const physics = new PhysicsWorld(await loadJolt());
  const triangles = [];
  for (let i = 1; i < profile.length; i++) {
    const [x, y] = profile[i - 1], [u, v] = profile[i];
    triangles.push(x, y, -5, x, y, 5, u, v, -5, u, v, -5, x, y, 5, u, v, 5);
  }
  const body = staticMeshBody(physics, Float32Array.from(triangles));
  const player = { x: -2, y: 0, z: 0, grounded: true, vx: 2.4, vy: 0, vz: 0, fallStart: 0, ...initial };
  const walker = new WalkingCharacter(physics, player);
  let damage = 0, peak = player.y;
  try {
    for (let frame = 0; frame < frames; frame++) {
      damage += walker.move(1 / 60, player, controls(frame));
      physics.engine.Step(1 / 60, 1);
      peak = Math.max(peak, player.y);
    }
    return { ...player, damage, peak };
  } finally {
    walker.dispose();
    const id = body.GetID();
    physics.bodies.RemoveBody(id);
    physics.bodies.DestroyBody(id);
    physics.dispose();
  }
}

test('postava vyjde schod 30 cm a zastaví se před schodem 50 cm', async () => {
  const step = (h) => walk([[-10, 0], [0, 0], [0, h], [10, h]], {}, 120);
  const low = await step(0.3);
  assert.ok(low.x > 2 && Math.abs(low.y - 0.3) < 0.04, JSON.stringify(low));
  const high = await step(0.5);
  assert.ok(high.x < 0 && high.y < 0.04, JSON.stringify(high));
});

test('postava vyjde třicetistupňový svah a nevyjde strmou rampu', async () => {
  const ramp = (degrees) => walk([[-10, 0], [0, 0], [10, 10 * Math.tan(degrees * Math.PI / 180)]], {}, 120);
  const gentle = await ramp(30);
  assert.ok(gentle.grounded && gentle.x > 1 && gentle.y > 0.6, JSON.stringify(gentle));
  const steep = await ramp(60);
  assert.ok(steep.x < 0.4, JSON.stringify(steep));
});

test('skok zachová výšku a vyšší pád způsobí zranění jen při dopadu', async () => {
  const floor = [[-10, 0], [10, 0]];
  const jump = await walk(floor, { vx: 0 }, 100, (frame) => frame === 15);
  assert.ok(jump.peak > 0.6 && jump.peak < 0.8 && jump.grounded, JSON.stringify(jump));
  assert.equal(jump.damage, 0);
  const fall = await walk(floor, { y: 9, vx: 0 }, 180);
  assert.ok(fall.grounded && Math.abs(fall.damage - 24) < 0.3, JSON.stringify(fall));
});

test('chodec odsune lehký předmět a neodtlačí zabrzděné auto', async () => {
  const Jolt = await loadJolt();
  function push(mass, layer) {
    const physics = new PhysicsWorld(Jolt);
    const floor = staticMeshBody(physics, Float32Array.from([-10, 0, -5, -10, 0, 5, 10, 0, -5,
      10, 0, -5, -10, 0, 5, 10, 0, 5]));
    const half = new Jolt.Vec3(0.5, 0.5, 0.5), pos = new Jolt.RVec3(0, 0.5, 0);
    const rotation = new Jolt.Quat(0, 0, 0, 1);
    const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), pos, rotation, Jolt.EMotionType_Dynamic, layer);
    settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
    settings.mMassPropertiesOverride.mMass = mass;
    settings.mFriction = 1;
    const body = physics.bodies.CreateBody(settings);
    physics.bodies.AddBody(body.GetID(), Jolt.EActivation_Activate);
    for (const value of [settings, rotation, pos, half]) Jolt.destroy(value);
    const player = { x: -2, y: 0, z: 0, grounded: true, vx: 2.4, vy: 0, vz: 0, fallStart: 0 };
    const walker = new WalkingCharacter(physics, player);
    try {
      for (let i = 0; i < 120; i++) {
        walker.move(1 / 60, player, false);
        physics.engine.Step(1 / 60, 1);
      }
      return body.GetPosition().GetX();
    } finally {
      walker.dispose();
      for (const item of [body, floor]) {
        const id = item.GetID();
        physics.bodies.RemoveBody(id);
        physics.bodies.DestroyBody(id);
      }
      physics.dispose();
    }
  }
  const light = push(8, layers.DEBRIS), heavy = push(1200, layers.VEHICLE);
  assert.ok(light > 0.5 && Math.abs(heavy) < 0.02, JSON.stringify({ light, heavy }));
});

test('zábradlí zastaví běžící kapsli při sto různých úhlech náběhu', async () => {
  const { bridgeEdges, railingFaces } = await import('../src/physics/railings.js');
  const { densePath } = await import('../src/world/road-profile.js');
  const physics = new PhysicsWorld(await loadJolt());
  const pairs = physics.engine.GetObjectLayerPairFilter();
  assert.equal(pairs.ShouldCollide(layers.CHARACTER, layers.RAILING), true);
  assert.equal(pairs.ShouldCollide(layers.VEHICLE, layers.RAILING), true);
  const floor = staticMeshBody(physics, Float32Array.from([
    -25, 0, -4, -25, 0, 4, 25, 0, -4, 25, 0, -4, -25, 0, 4, 25, 0, 4,
  ]));
  const path = densePath([-25, 25], [0, 0], [0, 0], 0, 1, 0, 1, Infinity);
  const geometry = (type, ground) => {
    const triangles = [];
    bridgeEdges({ heightAt: () => ground }, path, 4, type, edge =>
      railingFaces(edge, (a, b, c, d) => triangles.push(...a, ...b, ...c, ...a, ...c, ...d)));
    return Float32Array.from(triangles);
  };
  assert.equal(geometry('open', -1).length, 0);
  assert.ok(geometry('stone', -0.4).length > 0);
  for (const type of ['open', 'stone']) {
    const rail = staticMeshBody(physics, geometry(type, -3), layers.RAILING);
    for (let i = 0; i < 50; i++) {
      const index = 2 * i + Number(type === 'stone');
      const angle = (index - 49.5) / 100 * Math.PI * 0.75, side = i % 2 ? 1 : -1;
      const p = { x: 0, y: 0, z: 0, grounded: true, vy: 0, fallStart: 0,
        vx: Math.sin(angle) * 6.4, vz: side * Math.cos(angle) * 6.4 };
      const walker = new WalkingCharacter(physics, p);
      for (let j = 0; j < 150; j++) walker.move(1 / 60, p, false);
      assert.ok(p.grounded && p.z * side > 2.8 && p.z * side < 3.8, JSON.stringify({ type, i, p }));
      walker.dispose();
    }
    physics.bodies.RemoveBody(rail.GetID());
    physics.bodies.DestroyBody(rail.GetID());
  }
  physics.bodies.RemoveBody(floor.GetID());
  physics.bodies.DestroyBody(floor.GetID());
  physics.dispose();
});

test('kamera se zastaví na viditelné zkušební zídce, nad ní a po odebrání má volný výhled', async () => {
  const {cameraRailFraction} = await import('../src/world/camera-railings.js');
  const edge = {id:'zkouska', x:256, y:0.5, z:4, height:1,
    corners:[[255,0,3],[257,0,3],[257,0,5],[255,0,5]]};
  let state = 'intact';
  const world = {minX:0,minZ:0,cols:2,rows:1,bridgeEdges:new Map([[1,[edge]]]),breakables:{state:()=>state}};
  assert.equal(cameraRailFraction(world,250,0.6,4,260,0.6,4),0.5);
  assert.equal(cameraRailFraction(world,250,1.5,4,260,2,4),1);
  assert.equal(cameraRailFraction(world,256,3,4,256,-1,4),0.5);
  state = 'broken';
  assert.equal(cameraRailFraction(world,250,0.6,4,260,0.6,4),1);
});
