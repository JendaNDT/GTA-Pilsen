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

/** Celý svět z distribuovaných dat (bez barevné mapy podkladu, která potřebuje plátno). */
async function profileWorld() {
  const data = {};
  for (const name of ['buildings', 'roads', 'land', 'terrain', 'rails', 'trees', 'landscape']) data[name] = await pack(name + '.bin');
  const json = async (file) => JSON.parse(await readFile(new URL('../public/data/' + file, import.meta.url)));
  data.meta = await json('meta.json');
  data.gradeSeparations = await json('grade-separations.json');
  // vodní plochy a břehy ano (fyzika řeky, nábřeží), hrubou masku povrchů z plátna ne
  class ProfileWorld extends World { _initLand(land) { this._initWater(land); } }
  return new ProfileWorld(data);
}

/** Výška sítě terénu fyziky v bodě (nejvyšší trojúhelník nad ním, NaN mimo síť). */
function physicsTerrainHeight(w, cache, x, z) {
  const ci = w.chunkIndex(x, z);
  if (!cache.has(ci)) {
    const list = [];
    terrainTriangles(w, ci, w.minX + ci % w.cols * 256, w.minZ + Math.floor(ci / w.cols) * 256, 256, (a, b, c) => list.push([a, b, c]));
    cache.set(ci, list);
  }
  let best = NaN;
  for (const [a, b, c] of cache.get(ci)) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) continue;
    const l1 = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const l2 = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (l1 < -1e-7 || l2 < -1e-7 || l1 + l2 > 1 + 1e-7) continue;
    const y = l1 * a[1] + l2 * b[1] + (1 - l1 - l2) * c[1];
    if (!(y <= best)) best = y;
  }
  return best;
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

test('Jolt protne Wilsonův most, Rondel, Valík a nádražní rampu ve výšce profilu', async () => {
  const { RoadStructures } = await import('../src/physics/structures.js');
  const { TUNNEL_HEIGHT } = await import('../src/world/tunnels.js');
  const w = await profileWorld(), structures = new RoadStructures(w);
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
    const apron = w.roadApproach;
    assert.ok(apron, 'Chybí napojení vozovky na měřený horní pás.');
    const path = apron.path;
    for (let i = 0; i < path.n - 1; i++) {
      label = ['napojení horní vozovky', i];
      // Paprsky míří do plochy trojúhelníku, včetně bezprostředního okolí spoje.
      for (const fraction of [0.02, 0.5, 0.98]) {
        const mix = values => values[i] + fraction * (values[i + 1] - values[i]);
        const t = 1 - (1 - apron.startT) * (i + fraction) / (path.n - 1);
        assert.ok(w.roadSurfaceY(apron.road, apron.seg, t, mix(path.x), mix(path.z)) >= mix(path.y) - 0.05);
        check(mix(path.x), mix(path.z), mix(path.y));
      }
    }
    assert.ok(w.heightAt(path.x.at(-1), path.z.at(-1)) >= path.y.at(-1));
    // Příčný sklon břehu dříve nechával pravá kola za koncem mostu bez opory.
    const bridgeEnd = w.rOff[2706], landEnd = w.rOff[33140] - 1;
    const x0 = w.rpx[bridgeEnd], z0 = w.rpz[bridgeEnd], y0 = w.rpy[bridgeEnd];
    assert.equal(w.rpx[landEnd], x0);
    assert.equal(w.rpz[landEnd], z0);
    const dx = w.rpx[landEnd - 1] - x0, dz = w.rpz[landEnd - 1] - z0;
    const length = Math.hypot(dx, dz);
    for (const side of [-2, 0, 2]) {
      let previous = y0;
      for (let d = 0; d <= 8; d += 0.25) {
        const x = x0 + (dx * d - dz * side) / length, z = z0 + (dz * d + dx * side) / length;
        const y = w.heightAt(x, z);
        assert.ok(Math.abs(y - previous) < 0.15, 'Kola potřebují souvislý povrch při přechodu na břeh.');
        previous = y;
      }
    }
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
    // Kola na obou stranách nádražní rampy mají oporu ve stejné vrstvě terénu.
    const ramp = w.edgePoint(519, 30, 0, {}), tile = w.chunkIndex(ramp.x, ramp.z);
    const tileX = w.minX + tile % w.cols * 256, tileZ = w.minZ + Math.floor(tile / w.cols) * 256;
    const surface = [];
    terrainTriangles(w, tile, tileX, tileZ, 256, (a, b, c) => surface.push(...a, ...b, ...c));
    staticMeshBody(physics, Float32Array.from(surface));
    for (let s = 8; s <= 48; s += 2) {
      label = ['příčný sklon nádražní rampy', s];
      const left = w.edgePoint(519, s, -1, {}), right = w.edgePoint(519, s, 1, {});
      const yl = w.heightAt(left.x, left.z), yr = w.heightAt(right.x, right.z);
      assert.ok(Math.abs(yl - yr) < 0.16, label + ': ' + (yl - yr));
      check(left.x, left.z, yl);
      check(right.x, right.z, yr);
    }
    assert.deepEqual(deviations, []);
  } finally {
    physics.dispose();
  }
});

test('nájezd na Wilsonův most má fyziku terénu ve výšce vozovky i vedle strmého Anglického nábřeží', async () => {
  // Americká vede na most přes křižovatku s Anglickým nábřežím, které od ní prudce klesá k řece.
  // Posledních 8 m před mostovkou leží silnice přímo na kalibrovaném terénu bez pásu fyziky.
  // Terén pod okrajem nábřeží se dřív srovnával podle jeho vlastního profilu a příčného sklonu,
  // ne podle společné výšky křižovatky. Fyzika terénu tak v ose nájezdu ležela až o 35 cm
  // a u severního okraje až o 57 cm níž než vykreslená vozovka.
  const w = await profileWorld();
  const wilson = [...w.archedBridges.keys()].find((i) => w.roadNames[w.r.name[i]] === 'Wilsonův most');
  const a = w.rOff[wilson], x0 = w.rpx[a], z0 = w.rpz[a];
  const length = Math.hypot(w.rpx[a + 1] - x0, w.rpz[a + 1] - z0);
  const ux = (x0 - w.rpx[a + 1]) / length, uz = (z0 - w.rpz[a + 1]) / length;   // od mostovky ven
  const near = [...w.roadGrade.junctions].some(({ roads }) => roads.some((road) => w.roadNames[w.r.name[road]] === 'Anglické nábřeží') &&
    roads.some((road) => w.roadNames[w.r.name[road]] === 'Americká'));
  assert.ok(near, 'Chybí křižovatka Americké s Anglickým nábřežím.');
  const cache = new Map();
  let worst = 0, place = null;
  for (let along = 0.25; along <= 8; along += 0.25) for (let side = -3; side <= 3; side += 0.5) {
    const x = x0 + ux * along - uz * side, z = z0 + uz * along + ux * side;
    const error = Math.abs(physicsTerrainHeight(w, cache, x, z) - w.heightAt(x, z));
    if (!(error <= worst)) { worst = error; place = [x.toFixed(2), z.toFixed(2)]; }
  }
  assert.ok(worst < 0.02, `Fyzika terénu se na nájezdu liší od vozovky o ${worst.toFixed(3)} m v bodě ${place}.`);
});

test('Anglické nábřeží jižně od Wilsonova mostu leží na ulici nad nábřežní zdí, ne v půli svahu k Radbuze', async () => {
  // Výškový model po 8 m rozmazal nábřežní zeď Radbuzy do svahu přes celou vozovku. Profil
  // silnice z výšek v ose proto klesal až na −9,06 m a asfalt ležel až 2,4 m pod terénem u okraje
  // (a 6 m pod ulicí za ním), fyzika terénu u okraje prorůstala nad pás až o 2,2 m.
  const w = await profileWorld();
  const road = w.r.name.findIndex((name, i) => w.roadNames[name] === 'Anglické nábřeží' && w.r.w[i] === 6 &&
    Math.abs(w.rpx[w.rOff[i]] - 168.1) < 0.2 && Math.abs(w.rpz[w.rOff[i]] - 519) < 0.2);
  assert.ok(road >= 0, 'Chybí úsek Anglického nábřeží mezi z 519 a 457.');
  const hw = w.r.w[road] / 2, cache = new Map();
  let below = 0, belowAt = null, poke = -Infinity, pokeAt = null;
  for (let z = 470; z <= 515; z += 0.5) {
    let k = w.rOff[road];
    while (k + 2 < w.rOff[road + 1] && w.rpz[k + 1] > z) k++;
    const t = (w.rpz[k] - z) / (w.rpz[k] - w.rpz[k + 1]), x = w.rpx[k] + (w.rpx[k + 1] - w.rpx[k]) * t;
    const l = Math.hypot(w.rpx[k + 1] - w.rpx[k], w.rpz[k + 1] - w.rpz[k]);
    const nx = -(w.rpz[k + 1] - w.rpz[k]) / l, nz = (w.rpx[k + 1] - w.rpx[k]) / l;
    for (const side of [-1, 1]) {
      const asphalt = w.roadSurfaceY(road, k, t, x + nx * hw * side, z + nz * hw * side);
      // okolní terén: u okraje vozovky, 1,5 m za ním a na ulici 5 m za okrajem (původní model i upravený terén)
      for (const out of [0, 1.5, 5]) {
        const px = x + nx * (hw + out) * side, pz = z + nz * (hw + out) * side;
        const ground = Math.max(w.terrainHeightAt(px, pz), w.heightAt(px, pz));
        if (ground - asphalt > below) { below = ground - asphalt; belowAt = [px.toFixed(1), pz.toFixed(1)]; }
      }
    }
    for (let u = -hw; u <= hw; u += 0.25) {
      const px = x + nx * u, pz = z + nz * u;
      const error = physicsTerrainHeight(w, cache, px, pz) - w.roadSurfaceY(road, k, t, px, pz);
      if (error > poke) { poke = error; pokeAt = [px.toFixed(2), pz.toFixed(2)]; }
    }
  }
  assert.ok(below < 0.3, `Asfalt leží ${below.toFixed(2)} m pod okolním terénem v bodě ${belowAt}.`);
  assert.ok(poke < 0.02, `Fyzika terénu prorůstá nad pás vozovky o ${poke.toFixed(3)} m v bodě ${pokeAt}.`);
  // Ulice je po celé délce rovná napříč i podélně jako skutečné nábřeží (dřív klesala o 7 m a zase stoupala).
  let low = Infinity, high = -Infinity;
  for (let s = 0; s <= w.roadGrade.station[w.rOff[road + 1] - 1]; s += 2) {
    const y = w.roadGradeAt(road, s);
    low = Math.min(low, y); high = Math.max(high, y);
  }
  assert.ok(high - low < 1.6, `Profil kolísá o ${(high - low).toFixed(2)} m.`);
});

test('body fyziky terénu na břehové čáře řeky leží pod pásem vozovky', async () => {
  // Na rozhraní vody a souše vkládá síť terénu body na břehovou čáru. Dřív ležely ve výšce terénu
  // bez srovnání pod pás vozovky a u Radbuzy pod Tyršovou ulicí prorůstaly pásem až o 19 cm.
  const w = await profileWorld();
  let checked = 0, worst = 0, place = null;
  for (const [x, z] of [[566, 96], [165, 490]]) {
    const ci = w.chunkIndex(x, z), x0 = w.minX + ci % w.cols * 256, z0 = w.minZ + Math.floor(ci / w.cols) * 256;
    terrainTriangles(w, ci, x0, z0, 256, (...triangle) => {
      for (const p of triangle) {
        if (p.wet !== undefined) continue;                    // jen body vložené na břehovou čáru
        checked++;
        const error = p[1] - w.roadClampAt(p[0], p[2], p[1]);
        if (error > worst) { worst = error; place = [p[0].toFixed(1), p[2].toFixed(1)]; }
      }
    });
  }
  assert.ok(checked > 100, 'Chybí body na břehové čáře.');
  assert.ok(worst < 0.005, `Bod na břehu leží ${worst.toFixed(3)} m nad pásem vozovky v bodě ${place}.`);
});

test('kola při přejezdu skutečné hranice dvou dlaždic nedostanou svislý ráz 0,5 m/s', async () => {
  const { PlayerVehicle } = await import('../src/physics/vehicle.js');
  const { CAR_TYPES } = await import('../src/entities/models.js');
  const terrain = await pack('terrain.bin');
  const w = Object.create(World.prototype);
  Object.assign(w, { minX: terrain.header.x0, minZ: terrain.header.z0,
    cols: (terrain.header.cols - 1) * terrain.header.g / 256, rows: (terrain.header.rows - 1) * terrain.header.g / 256,
    tunnels: [] });
  w._initTerrain(terrain);
  w._initTerrainDetail(await pack('landscape.bin'));
  w._initGradeTerrain(JSON.parse(await readFile(new URL('../public/data/grade-separations.json', import.meta.url))));
  const physics = new PhysicsWorld(await loadJolt());
  const x = -40, edge = w.minZ + Math.round(-w.minZ / 256) * 256;
  const car = { type: CAR_TYPES.hatch, x, z: edge - 18, y: w.heightAt(x, edge - 18), yaw: 0,
    vx: 0, vy: 0, vz: 0, speed: 0, steer: 0, health: 100 };
  for (const z0 of [edge - 256, edge]) {
    const ci = w.chunkIndex(x, z0 + 1), x0 = w.minX + ci % w.cols * 256;
    const points = [];
    terrainTriangles(w, ci, x0, z0, 256, (a, b, c) => points.push(...a, ...b, ...c));
    staticMeshBody(physics, Float32Array.from(points));
  }
  const vehicle = new PlayerVehicle(physics, car);
  let peak = 0, contact = true;
  try {
    for (let i = 0; i < 600 && car.z < edge + 6; i++) {
      vehicle.drive(1 / 60, i < 60 ? 0 : 1, 0, i < 60, true, () => 1);
      physics.engine.Step(1 / 60, 1);
      vehicle.read();
      if (Math.abs(car.z - edge) < 2) {
        peak = Math.max(peak, Math.abs(car.vy));
        contact &&= vehicle.wheels.every((wheel) => wheel.HasContact());
      }
    }
    assert.ok(car.z > edge + 5 && contact);
    assert.ok(peak < 0.5, 'Svislá rychlost na hraně ' + peak + ' m/s');
  } finally { vehicle.dispose(); physics.dispose(); }
});
