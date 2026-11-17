import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, FrontSide, Texture } from 'three/webgpu';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { makeBuildingMaterial, makeDecalMaterial, makeTerrainMaterial } = await import('../src/world/materials.js');

test('fasády sdílejí uzly podle detailu a druhu, ale lze měnit stranu jednotlivých materiálů', () => {
  const variants = new Set();
  for (const textures of [false, true]) for (const heritage of [false, true]) {
    const first = makeBuildingMaterial({ textures, heritage });
    const second = makeBuildingMaterial({ textures, heritage });
    assert.notEqual(first, second);
    assert.equal(first.colorNode, second.colorNode);
    assert.equal(first.emissiveNode, second.emissiveNode);
    first.side = DoubleSide;
    assert.equal(second.side, FrontSide);
    variants.add(first.colorNode);
  }
  assert.equal(variants.size, 4);
});

test('silnice a čáry sdílejí povrch a mají odlišné odsazení hloubky', () => {
  const road = makeDecalMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  const lines = makeDecalMaterial({ polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 });
  assert.equal(road.colorNode, lines.colorNode);
  for (const mat of [road, lines]) {
    assert.equal(mat.depthWrite, false);
    assert.equal(mat.vertexColors, true);
    assert.equal(mat.polygonOffset, true);
  }
  assert.ok(lines.polygonOffsetFactor < road.polygonOffsetFactor);
  assert.ok(lines.polygonOffsetUnits < road.polygonOffsetUnits);
});

test('dlaždice sdílejí variantu terénních uzlů a mají vlastní texturu i souřadnice portálů', () => {
  const texA = new Texture(), texB = new Texture();
  const variants = new Set();
  for (const detail of [false, true]) for (const paving of [0, 1, 2]) for (const count of [0, 1, 2]) {
    const cuts = Array.from({ length: count }, (_, i) => ({ x: i + 7, z: 3, dx: 0, dz: 1, y: 2, slope: 0.1, width: 6 }));
    const a = makeTerrainMaterial(texA, cuts, paving, detail);
    const b = makeTerrainMaterial(texB, cuts.map((cut) => ({ ...cut, z: 4 })), paving, detail);
    assert.equal(a.colorNode, b.colorNode);
    assert.equal(a.emissiveNode, b.emissiveNode);
    variants.add(a.colorNode);
    assert.equal(a.map, texA);
    assert.equal(b.map, texB);
    assert.deepEqual(a.portalAxes?.map((axis) => axis.toArray()) ?? [], cuts.map((p) => [p.x, 3, 0, 1]));
    assert.deepEqual(b.portalAxes?.map((axis) => axis.toArray()) ?? [], cuts.map((p) => [p.x, 4, 0, 1]));
    assert.deepEqual(a.portalProfiles?.map((profile) => profile.toArray()) ?? [], cuts.map(() => [2, 0.1, 6]));
    a.dispose();
    b.dispose();
  }
  assert.equal(variants.size, 18);
  texA.dispose();
  texB.dispose();
});
