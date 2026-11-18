import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parsePack } from '../src/data.js';
import { loadJolt } from '../src/physics/jolt.js';
import { PhysicsWorld } from '../src/physics/world.js';
import { terrainTriangles } from '../src/physics/terrain.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { World } = await import('../src/world/world.js');
const { staticMeshBody } = await import('../src/physics/colliders.js');

async function pack(name) {
  const bytes = await readFile(new URL('../public/data/' + name, import.meta.url));
  return parsePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

test('síť Jolt odpovídá dotazu na výšku do 5 cm na základním, jemném i upraveném terénu', async () => {
  const Jolt = await loadJolt();
  const physics = new PhysicsWorld(Jolt);
  const w = Object.create(World.prototype);
  const terrain = await pack('terrain.bin');
  w.minX = terrain.header.x0;
  w.minZ = terrain.header.z0;
  w.cols = (terrain.header.cols - 1) * terrain.header.g / 256;
  w.rows = (terrain.header.rows - 1) * terrain.header.g / 256;
  w.tunnels = [];
  w._initTerrain(terrain);
  w._initTerrainDetail(await pack('landscape.bin'));
  w._initGradeTerrain(JSON.parse(await readFile(new URL('../public/data/grade-separations.json', import.meta.url))));
  assert.ok(w.gradeTerrain.size && w.terrainDetail.size);
  const filters = [new Jolt.BroadPhaseLayerFilter(), new Jolt.ObjectLayerFilter(), new Jolt.BodyFilter(), new Jolt.ShapeFilter()];
  const settings = new Jolt.RayCastSettings();
  try {
    for (const ci of [0, w.terrainDetail.keys().next().value, w.gradeTerrain.keys().next().value]) {
      const x0 = w.minX + ci % w.cols * 256, z0 = w.minZ + Math.floor(ci / w.cols) * 256;
      const triangles = [];
      terrainTriangles(w, ci, x0, z0, 256, (a, b, c) => triangles.push(...a, ...b, ...c));
      const body = staticMeshBody(physics, Float32Array.from(triangles));
      for (const [u, v] of [[1.17, 2.48], [57.3, 88.72], [143.6, 51.91], [254.17, 253.92]]) {
        const x = x0 + u, z = z0 + v, y = w.heightAt(x, z);
        const origin = new Jolt.RVec3(x, y + 2, z), down = new Jolt.Vec3(0, -4, 0);
        const ray = new Jolt.RRayCast(origin, down), hit = new Jolt.CastRayClosestHitCollisionCollector();
        physics.system.GetNarrowPhaseQuery().CastRay(ray, settings, hit, ...filters);
        assert.ok(hit.HadHit(), 'Chybí terén pod paprskem');
        assert.ok(Math.abs(2 - 4 * hit.mHit.mFraction) < 0.05);
        for (const value of [hit, ray, down, origin]) Jolt.destroy(value);
      }
      const id = body.GetID();
      physics.bodies.RemoveBody(id);
      physics.bodies.DestroyBody(id);
    }
  } finally {
    for (const value of [settings, ...filters]) Jolt.destroy(value);
    physics.dispose();
  }
});
