import test from 'node:test';
import assert from 'node:assert/strict';
import { WalkingNetwork } from '../src/world/walking-network.js';

function finish(search) {
  let result;
  do { result = search.next(); } while (!result.done);
  return result.value;
}

test('pěší síť překročí řeku po lávce a nespojí silnici pod ní', () => {
  const clear = (a,b) => Math.hypot(a.x-b.x,a.z-b.z,a.y-b.y) < 1;
  const n = new WalkingNetwork(clear);
  const west = n.vertex(-30,0,0), east = n.vertex(30,0,0);
  const left = n.vertex(-30,45,4), right = n.vertex(30,45,4);
  n.segment(west,left);
  n.segment(left,right);
  n.segment(right,east);
  const low = n.vertex(0,45,-2), road = n.vertex(0,75,-2);
  n.segment(low,road);
  const path = finish(n.route(west,east));
  assert.ok(path.includes(45));
  assert.deepEqual(path.slice(-2), [east.x,east.z]);
  assert.deepEqual(finish(n.route(east,west)).slice(-2), [west.x,west.z]);
  assert.equal(finish(n.route(west,road)), null);
});

test('cíl za neporušeným plotem se nepřipojí vzdušnou čarou', async () => {
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.window = {};
  globalThis.location = { search: '' };
  const { canJoin } = await import('../src/world/walking-map.js');
  const rail = { id: 'plot', x: 12, y: 0, z: 10, height: 1.2,
    corners: [[11.9, 0, 8], [12.1, 0, 8], [12.1, 0, 12], [11.9, 0, 12]] };
  let state = 'intact';
  const world = { minX: 0, minZ: 0, cols: 1, rows: 1, bridgeEdges: new Map(),
    streetFixtures: new Map([[0, [rail]]]), breakables: { state: () => state },
    isWater: () => false, groundY: () => 0, collideCircle: () => false };
  const network = new WalkingNetwork((a, b) => canJoin(world, a, b));
  const start = network.vertex(2, 10, 0);
  network.segment(start, network.vertex(10, 10, 0));
  const target = { x: 14, y: 0, z: 10 };
  assert.equal(finish(network.route(start, target)), null);
  state = 'broken';
  assert.deepEqual(finish(network.route(start, target)).slice(-2), [14, 10]);
});
