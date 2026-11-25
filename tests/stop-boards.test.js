import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { installTransitStops } = await import('../src/world/transit-stops.js');

test('Dva směry na shodných souřadnicích mají oddělené označníky i bez vrstvy OSM', () => {
  const world = {
    inBounds: () => true,
    chunkIndex: (x) => (x < 0 ? 0 : 1),
    buildingAt: () => -1,
    isWater: () => false,
    nearestRoad: () => ({ x: 0, z: 0, road: 0, dx: 1, dz: 0 }),
    r: { w: [8] },
    terrainHeightAt: () => 10,
    walkY: () => 11,
    blocksTramTrack: () => false,
    insideOtherCarriageway: (_road, _x, z) => Math.abs(z) <= 4
  };
  const stops = [
    ['Sad', 0, 0, '123/1'],
    ['Sad', 0, 0, '123/2']
  ];
  const patterns = [
    [0, [[0, 0]]],
    [1, [[1, 0]]]
  ];
  const routes = [1, -1].map((tx) => ({
    type: 'bus',
    ref: '30',
    stops: [[0, 'Sad']],
    posAt: () => ({ x: 0, z: 0, tx, tz: 0 })
  }));
  const result = installTransitStops(world, { stops, patterns }, routes);
  assert.equal(result.signs.length, 2);
  assert.ok(result.signs[0].z > 4 && result.signs[1].z < -4);
  for (const s of result.signs) {
    assert.deepEqual(s.lines, ['30']);
    assert.equal(result.nearest(s.x, s.z), s.index);
  }
  const parts = result.fixtures(1);
  assert.equal(parts.length, 2);
  assert.equal(result.fixtures(1), parts);
  assert.ok(parts.every((f) => f.y === 11 && f.corners.every((p) => p[1] === 11)));
});

test('Po nárazu si označník ponechá svůj výřez textury a po opravě se vrátí do společné sítě', async () => {
  const { Group, Float32BufferAttribute } = await import('three/webgpu');
  const { Breakables } = await import('../src/physics/breakables.js');
  const { SolidBuf } = await import('../src/world/solid-buffer.js');
  const { attachRoadFurniture } = await import('../src/world/road-furniture.js');
  const group = new Group(),
    registry = new Breakables(),
    solid = new SolidBuf();
  for (const x of [0, 5]) solid.quad([x, 0, 0], [x + 1, 0, 0], [x + 1, 2, 0], [x, 2, 0], [1, 1, 1]);
  const geo = solid.geometry(),
    uv = Float32Array.from({ length: 24 }, (_, i) => i / 24);
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const fixture = { id: 'stop/2', x: 5, y: 0, z: 0 };
  const original = geo.getAttribute('position').array.slice();
  const [visual] = attachRoadFurniture(registry, group, geo, undefined, [{ fixture, start: 18, end: 36 }]);
  registry.damage(fixture.id, 'moved', 0);
  registry.setPose(fixture.id, { x: 6, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 });
  assert.deepEqual(group.children[0].geometry.getAttribute('uv').array, uv.slice(12));
  assert.deepEqual(geo.getAttribute('position').array.slice(0, 18), original.slice(0, 18));
  registry.repairDue(2 * 86400);
  assert.equal(group.children.length, 0);
  assert.deepEqual(geo.getAttribute('position').array, original);
  registry.detach(visual);
  geo.dispose();
});
