import assert from 'node:assert/strict';
import test from 'node:test';

// World používá konfiguraci prohlížeče, tyto testy nepotřebují renderer ani DOM.
globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { World, SURF } = await import('../src/world/world.js');
const { RC, RF } = await import('../src/config.js');

function emptyWorld() {
  return Object.assign(Object.create(World.prototype), {
    minX: -256, maxX: 256, minZ: -256, maxZ: 256, cols: 2, rows: 2, gcols: 9, grows: 9,
    obstacles: new Map(), b: {}, bCellStart: new Uint32Array(82), bCellItems: new Uint32Array(),
    th: new Float32Array(4), tX0: 0, tZ0: 0, tCols: 2, tRows: 2, tG: 8,
    bridgeSeg: new Float32Array(), bridgeGrid: new Map(),
  });
}

test('odebrání dlaždice zachová kolize ostatních překážek ve sdílené buňce', () => {
  const world = emptyWorld();
  world.addObstacles([1, 1, 0.2]);
  world.addObstacles([2, 2, 0.3]);
  world.removeObstacles([1, 1, 0.2]);
  assert.equal(world.collideCircle(1.05, 1, 0.1, 0.2, 1.7), false);
  assert.equal(world.collideCircle(2.1, 2, 0.35, 0.2, 1.7), true);
  assert.ok(Math.abs(world.hit.x - 2.65) < 1e-6);
  world.removeObstacles([2, 2, 0.3]);
  assert.equal(world.obstacles.size, 0);
});

test('překážky se stejnými souřadnicemi se odebírají jednotlivě včetně poloměru', () => {
  const world = emptyWorld();
  world.addObstacles([-1, -1, 0.2, -1, -1, 0.2]);
  world.addObstacles([-1, -1, 0.3]);
  world.removeObstacles([-1, -1, 0.2]);
  assert.deepEqual([...world.obstacles.values()], [[-1, -1, 0.2, -1, -1, 0.3]]);
  world.removeObstacles([-1, -1, 0.7, 50, 50, 1]);
  assert.equal(world.collideCircle(-1.1, -1, 0.1, 0.2, 1.7), true);
  world.removeObstacles([-1, -1, 0.2, -1, -1, 0.3]);
  assert.equal(world.obstacles.size, 0);
});

test('výška terénu odpovídá oběma trojúhelníkům vykreslené sítě', () => {
  const world = emptyWorld();
  world.th.set([0, 0, 0, 8]);
  assert.equal(world.heightAt(2, 2), 0);
  assert.equal(world.heightAt(6, 6), 4);
  assert.equal(world.heightAt(4, 4), 0);
  assert.equal(world.heightAt(-20, -20), 0);
});

test('pod mostem zůstává hráč na terénu, na mostě se drží mostovky', () => {
  const world = emptyWorld();
  world.bridgeSeg = Float32Array.from([0, 0, 8, 16, 0, 8, 2, 0]);
  world.bridgeGrid.set(0, [0]);
  assert.equal(world.groundY(8, 0, 0), SURF);
  assert.equal(world.groundY(8, 0, 8), 8);
  assert.equal(world.groundY(8, 4, 8), SURF);
});

test('navigace respektuje jednosměrku a nezařazuje pěšiny do silničního grafu', () => {
  const world = emptyWorld();
  world._initRoads({
    header: { count: 4 },
    x0: [-1000, 0, 0, 0], z0: [0, 0, 0, 0],
    dx: [1000, 1000, 0, 0], dz: [0, 0, -1000, 1000], start: [0, 1, 2, 3, 4],
    cls: [RC.RESIDENTIAL, RC.RESIDENTIAL, RC.PATH, RC.SERVICE],
    flags: [RF.ONEWAY, 0, 0, 0], w: [6, 6, 2, 4],
  });
  world._initGraph();
  const west = world.nearestNode(-100, 0, 10), east = world.nearestNode(100, 0, 10);
  const path = world.findPath(west, east);
  assert.equal(path.length, 2);
  assert.equal(path.reduce((sum, edge) => sum + world.eLen[edge], 0), 200);
  assert.equal(world.findPath(east, west), null);
  assert.equal(world.nearestNode(0, -100, 10), -1);
  assert.deepEqual(world.findPath(east, east), []);
  assert.equal(world.findPath(-1, east), null);
});
