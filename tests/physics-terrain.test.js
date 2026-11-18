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

test('Jolt protne Wilsonův most, Rondel i vozovky a stropy Valíku ve výšce profilu', async () => {
  const { RoadStructures } = await import('../src/physics/structures.js');
  const { TUNNEL_HEIGHT } = await import('../src/world/tunnels.js');
  const data = {};
  for (const name of ['buildings', 'roads', 'land', 'terrain', 'rails', 'trees', 'landscape']) data[name] = await pack(name + '.bin');
  const json = async (file) => JSON.parse(await readFile(new URL('../public/data/' + file, import.meta.url)));
  data.meta = await json('meta.json');
  data.gradeSeparations = await json('grade-separations.json');
  // Barevná mapa podkladu potřebuje plátno, výškové profily se načítají samostatně.
  class ProfileWorld extends World { _initLand() {} }
  const w = new ProfileWorld(data), structures = new RoadStructures(w);
  const Jolt = await loadJolt(), physics = new PhysicsWorld(Jolt);
  const loaded = new Set();
  const deviations = [];
  let label;
  const check = (x, z, expected, down = true) => {
    const ci = w.chunkIndex(x, z);
    for (const di of [-1, 0, 1]) for (const dj of [-1, 0, 1]) {
      const neighbor = ci + di + dj * w.cols;
      if (loaded.has(neighbor)) continue;
      const triangles = [];
      structures.emit(neighbor, (a, b, c) => triangles.push(...a, ...b, ...c));
      if (triangles.length) staticMeshBody(physics, Float32Array.from(triangles));
      loaded.add(neighbor);
    }
    const direction = down ? -1 : 1;
    const origin = new Jolt.RVec3(x, expected - direction * 0.25, z);
    const vec = new Jolt.Vec3(0, direction * 0.5, 0);
    const ray = new Jolt.RRayCast(origin, vec), result = new Jolt.CastRayClosestHitCollisionCollector();
    const settings = new Jolt.RayCastSettings();
    const filters = [new Jolt.BroadPhaseLayerFilter(), new Jolt.ObjectLayerFilter(), new Jolt.BodyFilter(), new Jolt.ShapeFilter()];
    physics.system.GetNarrowPhaseQuery().CastRay(ray, settings, result, ...filters);
    try {
      const error = result.HadHit() ? direction * (result.mHit.mFraction - 0.5) * 0.5 : Infinity;
      if (Math.abs(error) >= 0.05) deviations.push({ label, x, z, expected, error });
    } finally {
      for (const value of [result, ray, vec, origin, settings, ...filters]) Jolt.destroy(value);
    }
  };
  try {
    const wilson = [...w.archedBridges.keys()].find((i) => w.roadNames[w.r.name[i]] === 'Wilsonův most');
    assert.ok(Number.isInteger(wilson));
    for (const road of [wilson, ...w.rondel.elevated.keys(), ...w.gradeRoads]) {
      label = [road, w.roadNames[w.r.name[road]], w.r.flags[road]];
      const k = Math.floor((w.rOff[road] + w.rOff[road + 1] - 2) / 2);
      check((w.rpx[k] + w.rpx[k + 1]) / 2, (w.rpz[k] + w.rpz[k + 1]) / 2, (w.rpy[k] + w.rpy[k + 1]) / 2);
    }
    // Město Plzeň, objekt 00000002023003269. Měření protíná osu jízdního pruhu U Prazdroje.
    label = 'U Prazdroje, horní plocha a podhled';
    const deck = 316.615 - w.baseElevation;
    check(657, 162, deck);
    check(657, 162, 315.96 - w.baseElevation, false);
    assert.ok(Math.abs(deck - w.deckAt(657, 162, Infinity, 3)) < 0.05);
    const road = w.nearestRoad(657, 162, 5, 13, 0, {});
    const carriageway = w.roadSurfaceY(road.road, road.seg, road.t, road.x, road.z);
    assert.ok(Math.abs((315.96 - w.baseElevation - carriageway) - 6.05) < 0.05);
    assert.equal(w.tunnels.length, 2);
    for (const tunnel of w.tunnels) {
      label = [tunnel.road, 'Valík'];
      const k = Math.floor(tunnel.points.length / 2);
      const a = tunnel.points[k - 1], b = tunnel.points[k];
      const x = (a.x + b.x) / 2, z = (a.z + b.z) / 2, y = (a.y + b.y) / 2;
      check(x, z, y);
      check(x, z, y + TUNNEL_HEIGHT, false);
    }
    assert.deepEqual(deviations, []);
  } finally {
    physics.dispose();
  }
});
