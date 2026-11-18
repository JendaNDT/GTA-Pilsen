import assert from 'node:assert/strict';
import test from 'node:test';
import { DoubleSide, FrontSide, Texture } from 'three/webgpu';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '?quality=low' };
const { makeBuildingMaterial, makeDecalMaterial, makeMillraceMaterial, makeTerrainMaterial } = await import('../src/world/materials.js');
const { SURFACE } = await import('../src/world/material-table.js');
const { makeCarMesh } = await import('../src/entities/models.js');
const { makeSorBus, makeTatraCar, makeTramJoint } = await import('../src/entities/transit-models.js');

test('povrchy mají fyzikální vlastnosti podle druhu a sdílejí původní barvy', () => {
  for (const { roughness, metalness } of Object.values(SURFACE)) {
    assert.ok(roughness > 0 && roughness <= 1);
    assert.ok(metalness >= 0 && metalness <= 1);
  }
  assert.ok(SURFACE.glass.roughness < SURFACE.carPaint.roughness);
  assert.ok(SURFACE.carPaint.roughness < SURFACE.asphalt.roughness);
  assert.ok(SURFACE.transitMetal.metalness > SURFACE.transitPaint.metalness);

  const car = makeCarMesh('hatch', 0x123456);
  assert.equal(car.children[0].material.color.getHex(), 0x123456);
  assert.equal(car.children[0].material.roughness, SURFACE.carPaint.roughness);
  const expectedGlass = Math.round(SURFACE.glass.roughness * 255);
  const expectedMetal = Math.round(SURFACE.transitMetal.metalness * 255);
  const checkGeometry = ({ material, geometry }) => {
    assert.equal(material.isMeshStandardNodeMaterial, true);
    const surface = geometry.getAttribute('aSurface');
    assert.equal(surface.count, geometry.getAttribute('color').count);
    assert.equal(surface.normalized, true);
    return surface.array;
  };
  assert.ok(checkGeometry(car.children[1]).includes(expectedGlass));
  for (const vehicle of [makeSorBus(), makeTatraCar()]) {
    const properties = checkGeometry(vehicle.children[0]);
    assert.ok(properties.some((value, i) => i % 2 === 1 && value === expectedMetal));
    assert.ok(checkGeometry(vehicle.userData.doors.mesh).includes(expectedGlass));
  }
  checkGeometry(makeTramJoint());
  assert.equal(makeMillraceMaterial(false).roughness, SURFACE.water.roughness);
});

test('fasády sdílejí uzly podle detailu a druhu, ale lze měnit stranu jednotlivých materiálů', () => {
  const variants = new Set();
  for (const textures of [false, true]) for (const heritage of [false, true]) {
    const first = makeBuildingMaterial({ textures, heritage });
    const second = makeBuildingMaterial({ textures, heritage });
    assert.notEqual(first, second);
    assert.equal(first.colorNode, second.colorNode);
    assert.equal(first.emissiveNode, second.emissiveNode);
    assert.equal(first.isMeshStandardNodeMaterial, true);
    assert.equal(first.roughnessNode, second.roughnessNode);
    first.side = DoubleSide;
    assert.equal(second.side, FrontSide);
    variants.add(first.colorNode);
  }
  assert.equal(variants.size, 4);
});

test('silnice a čáry sdílejí povrch a mají odlišné odsazení hloubky', () => {
  const road = makeDecalMaterial({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 });
  const lines = makeDecalMaterial({ polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -14 }, SURFACE.roadPaint);
  assert.equal(road.colorNode, lines.colorNode);
  for (const mat of [road, lines]) {
    assert.equal(mat.isMeshStandardNodeMaterial, true);
    assert.equal(mat.depthWrite, false);
    assert.equal(mat.vertexColors, true);
    assert.equal(mat.polygonOffset, true);
  }
  assert.ok(lines.polygonOffsetFactor < road.polygonOffsetFactor);
  assert.ok(lines.polygonOffsetUnits < road.polygonOffsetUnits);
  assert.ok(lines.roughness < road.roughness);
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
    assert.equal(a.isMeshStandardNodeMaterial, true);
    assert.equal(a.roughnessNode, b.roughnessNode);
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
