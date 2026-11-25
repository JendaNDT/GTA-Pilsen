import { pavilionCollision } from '../world/pavilion-site.js';
import { columnCollision } from '../world/plague-column-site.js';
import { RoadFurnitureBodies } from './road-furniture.js';
import { Earcut } from 'three/src/extras/Earcut.js';
import { CHUNK } from '../config.js';
import { cornerTriangles, roadSurfaceTriangles, sidewalkTriangles, terrainTriangles } from './terrain.js';
import { RoadStructures } from './structures.js';
import { layers } from './world.js';
import { modernTheatreCollision } from '../world/modern-theatre.js';
import { forgeRoofFaces } from '../world/mill.js';

function roof(emit, a, b, c) {
  if ((b[2] - a[2]) * (c[0] - a[0]) > (b[0] - a[0]) * (c[2] - a[2])) emit(a, b, c);
  else emit(a, c, b);
}

function building(world, i, measured, emit, wallTop=world.bTop[i]) {
  const { bRing, ringStart } = world.b;
  const flat = [], holes = [], top = [], bottom = [];
  for (let r = bRing[i]; r < bRing[i + 1]; r++) {
    const start = top.length;
    if (start) holes.push(start);
    for (let v = ringStart[r]; v < ringStart[r + 1]; v++) {
      const x = world.bvx[v], z = world.bvz[v];
      flat.push(x, z);
      top.push([x, wallTop, z]);
      bottom.push([x, world.bBase[i], z]);
    }
    for (let a = start, b = top.length - 1; a < top.length; b = a++) {
      emit(bottom[a], top[a], bottom[b]);
      emit(top[a], top[b], bottom[b]);
      // Síť musí zastavit auto i při vyjíždění z vnitřního dvora.
      emit(bottom[b], top[a], bottom[a]);
      emit(bottom[b], top[b], top[a]);
    }
  }
  if (measured) return;
  const indices = Earcut.triangulate(flat, holes, 2);
  for (let k = 0; k < indices.length; k += 3) roof(emit, ...indices.slice(k, k + 3).map((id) => top[id]));
}

export function staticMeshBody(physics, triangles, layer = layers.STATIC, triangleIds = null) {
  const { Jolt, bodies } = physics;
  // Zápis do jednoho předem velkého pole vynechá volání do WASM pro každý vrchol.
  const count = triangles.length / 9;
  const list = new Jolt.TriangleList();
  list.resize(Math.max(2, count));
  const address = (i) => Jolt.getPointer(list.at(i).get_mV(0)) / 4;
  const offset = address(0), stride = address(1) - offset;
  const heap = Jolt.HEAPF32;
  for (let i = 0; i < count; i++) heap.set(triangles.subarray(i * 9, i * 9 + 9), offset + stride * i);
  if (triangleIds) for (let i = 0; i < count; i++) list.at(i).mUserData = triangleIds[i];
  list.resize(count);
  const mesh = new Jolt.MeshShapeSettings(list);
  mesh.mPerTriangleUserData = !!triangleIds;
  // Rychlejší stavba stromu zkrátí přípravu dlaždice zhruba na polovinu; dotazy kol na povrch
  // tím podle měření nezpomalí (100 000 paprsků: 285 ms proti 300 ms).
  mesh.mBuildQuality = Jolt.MeshShapeSettings_EBuildQuality_FavorBuildSpeed;
  Jolt.destroy(list);
  const result = mesh.Create();
  try {
    if (result.HasError()) throw new Error('Nepodařilo se vytvořit kolizní síť: ' + result.GetError().c_str());
    const origin = new Jolt.RVec3(0, 0, 0), rotation = new Jolt.Quat(0, 0, 0, 1);
    const bodySettings = new Jolt.BodyCreationSettings(result.Get(), origin, rotation, Jolt.EMotionType_Static, layer);
    bodySettings.mUserData = layer;
    const body = bodies.CreateBody(bodySettings);
    bodies.AddBody(body.GetID(), Jolt.EActivation_DontActivate);
    Jolt.destroy(bodySettings);
    Jolt.destroy(rotation);
    Jolt.destroy(origin);
    return body;
  } finally {
    result.Clear();
    Jolt.destroy(mesh);
  }
}

export class TileColliders {
  constructor(physics, world, data, debug, lamps, trafficFurniture) {
    this.physics = physics;
    this.world = world;
    this.debug = debug;
    this.lamps = lamps;
    this.trafficFurniture = trafficFurniture;
    this.roadFurniture = new RoadFurnitureBodies(physics, world, staticMeshBody, debug);
    this.lampTiles = new Map();
    this.tiles = new Map();
    this.structures = new RoadStructures(world);
    this.roofs = new Map();
    this.replaced = new Set();
    // Pokud chybí odpovídající sada, běžné budovy včetně střech zůstanou fyzicky pevné.
    if (!data.heritage.tiles.length || data.heritage.sha256 !== data.collisionRoofs.source) return;
    const valid = new Map(data.heritage.tiles.map(([x, z, , , ids]) => [world.chunkIndex(x, z), ids]));
    for (const tile of data.collisionRoofs.tiles) {
      const ci = world.chunkIndex(tile[0], tile[1]);
      if (!valid.has(ci)) continue;
      this.roofs.set(ci, tile);
      for (const id of valid.get(ci)) this.replaced.add(id);
    }
  }

  build(ci) {
    const w = this.world;
    const x = w.minX + (ci % w.cols) * CHUNK, z = w.minZ + Math.floor(ci / w.cols) * CHUNK;
    const triangles = [];
    const emit = (a, b, c) => triangles.push(...a, ...b, ...c);
    for (const {corners:[a,b,c,d]} of w.forecourtWalls.get(ci) ?? []) {
      emit(a,b,c);
      emit(a,c,d);
    }
    terrainTriangles(w, ci, x, z, CHUNK, emit);
    roadSurfaceTriangles(w, ci, emit);
    cornerTriangles(w, ci, emit);
    sidewalkTriangles(w, ci, emit);
    const garden = w.sady?.tiles.get(ci);
    if (garden) triangles.push(...garden.collision);
    for (const site of w.fountainTiles?.get(ci) ?? []) triangles.push(...site.solid);
    const theatre = w.heritage.modernTheatre;
    for (const i of w.bChunks[ci] ?? []) {
      if (i === w.heritage.breweryGate?.building) triangles.push(...w.heritage.breweryGate.triangles);
      else if (i === w.pavilion?.building) pavilionCollision(w.pavilion, emit);
      else if (i === w.bory?.drum) building(w,i,true,emit,w.bWall[i]);
      else if (i === w.plagueColumn?.building) columnCollision(w.plagueColumn, emit);
      else if (!theatre?.collisionSkip.has(i)) building(w, i, this.replaced.has(i) || i === w.heritage.forgeIndex, emit);
    }
    for (const [a,b,c] of w.bory?.collision.get(ci) ?? []) emit(a,b,c);
    if (theatre?.ci === ci) modernTheatreCollision(w, theatre, emit);
    if (ci === w.heritage.forgeChunk) forgeRoofFaces(w, w.heritage.forgeIndex, (a, b, c) => roof(emit, a, b, c));
    const tile = this.roofs.get(ci);
    if (tile) {
      const [cx, cz, points, indices] = tile;
      const vertex = (i) => [cx + points[3 * i] * 0.02, points[3 * i + 1] * 0.02, cz + points[3 * i + 2] * 0.02];
      for (let k = 0; k < indices.length; k += 3) roof(emit, vertex(indices[k]), vertex(indices[k + 1]), vertex(indices[k + 2]));
    }
    this.structures.emit(ci, emit);
    const measured = w.structures?.positionsFor(ci);
    if (measured) for (const coordinate of measured) triangles.push(coordinate);
    const positions = Float32Array.from(triangles);
    const body = staticMeshBody(this.physics, positions);
    const bodies = [body];
    this.tiles.set(ci, bodies);
    if (this.lamps) {
      const lamps = w.lampsInTile(ci);
      this.lampTiles.set(ci, lamps);
      this.lamps.load(lamps);
    }
    this.trafficFurniture?.load(ci);
    this.roadFurniture.load(ci);
    this.debug?.add(ci, positions);
  }

  // U dveří vozidla hledáme jen blízkou oporu, aby výstup nepřeskočil na jiné patro.
  exitHeight(x, z, y) {
    this.update(x, z);
    const { Jolt, system } = this.physics;
    const ray = new Jolt.RRayCast();
    ray.mOrigin.Set(x, y + 0.7, z);
    ray.mDirection.Set(0, -1.7, 0);
    const hit = new Jolt.CastRayClosestHitCollisionCollector();
    const settings = new Jolt.RayCastSettings();
    const filters = [new Jolt.BroadPhaseLayerFilter(), new Jolt.SpecifiedObjectLayerFilter(layers.STATIC),
      new Jolt.BodyFilter(), new Jolt.ShapeFilter()];
    try {
      system.GetNarrowPhaseQuery().CastRay(ray, settings, hit, ...filters);
      return hit.HadHit() ? y + 0.7 - 1.7 * hit.mHit.mFraction : y;
    } finally {
      for (const object of [ray, hit, settings, ...filters]) Jolt.destroy(object);
    }
  }

  update(x, z) {
    const w = this.world, radius = 384;
    const ix = Math.floor((x - w.minX) / CHUNK), iz = Math.floor((z - w.minZ) / CHUNK);
    const nearby = new Set();
    let next = -1, nearest = Infinity;
    for (let j = Math.max(0, iz - 2); j <= Math.min(w.rows - 1, iz + 2); j++) {
      for (let i = Math.max(0, ix - 2); i <= Math.min(w.cols - 1, ix + 2); i++) {
        const dx = Math.abs(w.minX + (i + 0.5) * CHUNK - x);
        const dz = Math.abs(w.minZ + (j + 0.5) * CHUNK - z);
        if (Math.hypot(Math.max(0, dx - CHUNK / 2), Math.max(0, dz - CHUNK / 2)) > radius) continue;
        const ci = j * w.cols + i, distance = i === ix && j === iz ? -1 : dx * dx + dz * dz;
        nearby.add(ci);
        if (!this.tiles.has(ci) && distance < nearest) { nearest = distance; next = ci; }
      }
    }
    for (const [ci, bodies] of this.tiles) if (!nearby.has(ci)) {
      for (const body of bodies) {
        const id = body.GetID();
        this.physics.bodies.RemoveBody(id);
        this.physics.bodies.DestroyBody(id);
      }
      if (this.lamps) {
        this.lamps.unload(this.lampTiles.get(ci));
        this.lampTiles.delete(ci);
      }
      this.trafficFurniture?.unload(ci);
      this.roadFurniture.unload(ci);
      this.tiles.delete(ci);
      this.debug?.remove(ci);
    }
    if (next >= 0) this.build(next);
  }
}
