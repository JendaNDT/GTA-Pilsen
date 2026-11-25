import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { RC } = await import('../src/config.js');
const { indexLampSurvey, streetLamps } = await import('../src/world/lamps.js');

function street(rows = []) {
  const world = {
    rPieces: [[0, 0, 1]], r: { cls: [RC.RESIDENTIAL], flags: [0], w: [6] },
    rpx: [0, 190], rpz: [0, 0],
    chunkIndex: x => Math.floor(x / 200), heightAt: () => 2, buildingAt: () => -1,
    isWater: () => false, collideCircle: () => false, blocksTramTrack: () => false,
    insideOtherCarriageway: (_, x, z) => Math.abs(z) < 3.15,
    nearestRoad: (x, z) => Math.abs(z) < 18 ? {road: 0, x, z: 0, dx: 1, dz: 0, dist: Math.abs(z)} : null
  };
  world.lampSurvey = indexLampSurvey(world, rows);
  return world;
}

test('světlo obou řad automatických sloupů míří k ose ulice', () => {
  const lamps = streetLamps(street(), 0);
  assert.ok(lamps.some(l => l.z < 0) && lamps.some(l => l.z > 0));
  for (const lamp of lamps) assert.ok(Math.abs(lamp.lightZ) < Math.abs(lamp.z));
});

test('mapovaný sloup má přednost i přes hranici dlaždice a parková lampa svítí pod sebe', () => {
  const world = street([[42, 201, 4], [43, 240, 60]]);
  world.rpx[0] = 20;
  world.rpx[1] = 199;
  const plain = street();
  plain.rpx = world.rpx;
  assert.ok(streetLamps(plain, 0).some(l => Math.hypot(l.x - 201, l.z - 4) < 24));
  const lamps = streetLamps(world, 1);
  assert.deepEqual(lamps.map(l => [l.x, l.z]), [[201, 4], [240, 60]]);
  assert.equal(lamps[1].lightX, lamps[1].x);
  assert.equal(lamps[1].lightZ, lamps[1].z);
  for (const l of streetLamps(world, 0)) assert.ok(Math.hypot(l.x - 201, l.z - 4) >= 24);
  lamps[0].intact = false;
  assert.equal(streetLamps(world, 1)[0].intact, undefined);
});

test('sloup ve vozovce ustoupí za obrubník, vynechá vybavení i nepoužitelný bod', () => {
  const world = street([[10, 38, 1], [11, 110, 50]]);
  world.isWater = (x, z) => z > 40;
  world.transitStops = { tiles: new Map([[0, [{ kind: 'shelter', x: 38, z: 4 }]]]) };
  const lamps = streetLamps(world, 0), corrected = lamps.find(l => l.id.endsWith('osm-10'));
  assert.equal(corrected.z, 4);
  assert.ok(Math.hypot(corrected.x - 38, corrected.z - 4) >= 2.4);
  assert.ok(!lamps.some(l => l.id.endsWith('osm-11')));
  assert.ok(lamps.some(l => !l.id.includes('osm-')));
});
