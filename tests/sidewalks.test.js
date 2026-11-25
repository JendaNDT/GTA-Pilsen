import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { RC, RF } = await import('../src/config.js');
const {
  CURB_HEIGHT, CURB_WIDTH, SIDEWALK_CLASSES, SIDEWALK_RAISED, SIDEWALK_SURF, sidewalkFacing, sidewalkHeight, sidewalkProfile, sidewalkQuads,
  sidewalkSections, sidewalkWidth, wallDistance,
} = await import('../src/world/sidewalks.js');
const { SURF } = await import('../src/world/world.js');

test('chodník mají městské ulice, ne rampy, mosty, obytné zóny ani volná krajina', () => {
  assert.equal(sidewalkWidth(RC.RESIDENTIAL, 0, 1), 2);
  assert.equal(sidewalkWidth(RC.SECONDARY, 0, 2), 2.5);
  assert.equal(sidewalkWidth(RC.RESIDENTIAL, 0, 0), 0);
  assert.equal(sidewalkWidth(RC.LIVING, 0, 2), 0);
  assert.equal(sidewalkWidth(RC.MOTORWAY, 0, 2), 0);
  assert.equal(sidewalkWidth(RC.PRIMARY_LINK, 0, 2), 0);
  assert.equal(sidewalkWidth(RC.TERTIARY, RF.BRIDGE, 2), 0);
  assert.equal(SIDEWALK_SURF, SURF);
  for (const [name, value] of Object.entries(SIDEWALK_CLASSES)) assert.equal(value, RC[name], name);
  assert.equal(SIDEWALK_RAISED, RF.BRIDGE | RF.TUNNEL | RF.SHARED_DECK);
});

test('obrubník je 10 cm nad asfaltem a chodník se svažuje k terénu jen v mezích', () => {
  const level = sidewalkProfile(10, 10.15, 2);
  assert.ok(Math.abs(level.curb - (10 + CURB_HEIGHT)) < 1e-9);
  assert.ok(Math.abs(level.outer - 10.15) < 1e-9);
  assert.equal(level.skirt, false);
  // terén u domu o metr výš: chodník stoupá nejvýš 8 %, dál pokračuje svah terénu
  const uphill = sidewalkProfile(10, 11, 2);
  assert.ok(uphill.outer < 10.3 && uphill.outer > level.curb);
  // terén o metr níž: chodník klesá nejvýš 6 % a pod okrajem je sokl
  const downhill = sidewalkProfile(10, 9, 2);
  assert.ok(downhill.outer > 9.9 && downhill.skirt);
  assert.ok(Math.abs(sidewalkHeight(level, 2, 0.1) - level.curb) < 1e-9);
  assert.ok(Math.abs(sidewalkHeight(level, 2, 2) - level.outer) < 1e-9);
});

test('chodník končí u stěny domu', () => {
  // stěna 1,4 m od obrubníku ve směru +x
  const walls = (x0, z0, x1, z1, visit) => visit(1.4, -5, 1.4, 5);
  assert.ok(Math.abs(wallDistance(0, 0, 1, 0, 2.5, walls) - 1.4) < 1e-9);
  assert.equal(wallDistance(0, 0, -1, 0, 2.5, walls), 2.5);
});

test('plochy chodníku: líc, obrubník a chodník mezi řezy, čela na koncích, mezera v ústí ulice', () => {
  const section = (x, valid) => ({ valid, cx: x, cz: 0, ox: 0, oz: 1, width: 2, road: 5, terrain: 5.1, profile: sidewalkProfile(5, 5.1, 2) });
  const parts = [];
  sidewalkQuads([section(0, true), section(4, true), section(8, false), section(12, true), section(16, true)],
    (a, b, c, d, part) => parts.push(part));
  const count = (part) => parts.filter((p) => p === part).length;
  assert.equal(count('face'), 2);
  assert.equal(count('curb'), 2);
  assert.equal(count('walk'), 2);
  assert.equal(count('cap'), 8);   // dva úseky, každý se dvěma konci, čelo má dvě plochy
  // osamocený řez a kus kratší než 3 m (zbytky v ostrůvku) se nekreslí
  const lone = [];
  sidewalkQuads([section(0, true), section(4, false), section(8, true), section(10, true), section(14, false)],
    (a, b, c, d, part) => lone.push(part));
  assert.deepEqual(lone, []);
  // líc obrubníku je svislý a sahá pod asfalt
  sidewalkQuads([section(0, true), section(4, true)], (a, b, c, d, part) => {
    if (part !== 'face') return;
    assert.equal(a[0], d[0]);
    assert.ok(a[1] < 5 && d[1] > 5.09);
  });
});

test('natočení ploch pro fyziku', () => {
  const s = { ox: 0, oz: 1 };
  assert.deepEqual(sidewalkFacing('walk', s), [[0, 1, 0]]);
  assert.deepEqual(sidewalkFacing('face', s), [[-0, 0, -1]]);
  assert.equal(sidewalkFacing('cap', s).length, 2);
});

test('řezy chodníku: obě strany, konec u domu a mezera v ústí jiné silnice', () => {
  // přímá ulice podél osy x, šířka 6 m; v x = 40 ústí ulice z jihu; dům 1,2 m od obrubníku na severu mezi x 60–80
  const world = {
    rCount: 2,
    rOff: Int32Array.from([0, 2, 4]),
    rpx: Float32Array.from([0, 100, 40, 40]),
    rpz: Float32Array.from([0, 0, 0, 50]),
    r: { w: Float32Array.from([6, 6]), cls: Uint8Array.from([RC.RESIDENTIAL, RC.RESIDENTIAL]), flags: new Uint8Array(2) },
    sidewalks: Float32Array.from([2, 0]),
    roadSurfaceY: () => 10.05,
    heightAt: () => 10.1,
    forWalls: (x0, z0, x1, z1, visit) => visit(60, -4.2, 80, -4.2),
    sidewalkExcluded: () => false,
    insideOtherCarriageway: (road, x, z, pad) => road === 0 && Math.abs(x - 40) <= 3 + pad && z > 0,
    insideSidewalkOf: () => false,
    isWater: () => false,
  };
  const [left, right] = sidewalkSections(world, 0, 0, 1);
  const low = { ...world, sidewalks: null };
  assert.equal(sidewalkSections(low, 0, 0, 1), null);
  assert.deepEqual(sidewalkSections(low, 0, 0, 1, world.sidewalks), [left, right]);
  assert.equal(left.length, right.length);
  assert.ok(left.length >= 13);                      // řezy nejvýš po 8 m
  const at = (list, x) => list.reduce((best, s) => (Math.abs(s.cx - x) < Math.abs(best.cx - x) ? s : best));
  // levá strana (z < 0) u domu: chodník jen do stěny
  assert.ok(Math.abs(at(left, 72).width - 1.2) < 1e-6);
  assert.equal(at(left, 20).width, 2);
  // pravá strana (z > 0) v ústí ulice nemá chodník, jinde ano
  assert.equal(at(right, 40).valid, false);
  assert.equal(at(right, 20).valid, true);
  assert.equal(at(left, 40).valid, true);
  assert.ok(Math.abs(at(right, 20).profile.curb - (10.05 + CURB_HEIGHT)) < 1e-9);
  assert.ok(at(right, 20).cz > 2.99);
  assert.ok(CURB_WIDTH < at(right, 20).width);
});
