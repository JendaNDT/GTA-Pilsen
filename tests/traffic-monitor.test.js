import assert from 'node:assert/strict';
import test from 'node:test';
import { createTrafficWaits } from '../src/game/traffic-waits.js';
import { installTrafficMonitor } from './e2e/traffic-monitor.js';

function monitorScenario() {
  globalThis.window = {};
  installTrafficMonitor();
  const head = { id: 3, directedHead: true, group: {}, x: 0, z: 0, edge: 1 };
  const traffic = { controls: [head], light: () => 'green', enterJunction() {}, time: 0 };
  const transit = { route: { type: 'tram', ref: '1' }, footprints: [{}] };
  const game = { vehicles: { cars: [] }, transit: { vehicles: [transit] }, world: { traffic }, player: { x: 0, z: 0 }, onCrash() {} };
  return { game, head, traffic, transit, waits: createTrafficWaits(game), monitor: window.observeTraffic(game) };
}

test('pozorovatel sleduje řadu přes články MHD, pozná cyklus i nástup cestujících', () => {
  const { game, transit, waits } = monitorScenario();
  const a = { mode: 'ai', speed: 0, blocked: 62 }, b = { mode: 'ai', speed: 0, blocked: 40 };
  game.vehicles.cars.push(a, b);
  game.vehicles.onObstacle(a, b);
  game.vehicles.onObstacle(b, transit.footprints[0]);
  game.transit.onObstacle(transit, a);
  const cycle = waits.chain(a);
  assert.equal(cycle.length, 4);
  assert.equal(cycle[0].id, cycle.at(-1).id);
  assert.equal(cycle.at(-1).reason, 'cyklus');
  assert.equal(cycle[2].line, '1');
  transit.doorsOpen = true;
  assert.equal(waits.chain(a).at(-1).reason, 'pobyt na zastávce');
  assert.deepEqual(waits.queues().map(row => row.seconds), [62]);
  game.world.traffic.time += 1;
  assert.equal(waits.chain(a)[0].reason, 'příčina nezjištěna');
  waits.setEnabled(false);
  assert.equal(waits.chain(a)[0].reason, 'příčina nezjištěna');
});

test('průjezd na zelenou a oboustranné hlášení stejného nárazu se počítají jednou', () => {
  const { game, monitor, traffic, head } = monitorScenario();
  const a = { mode: 'ai', x: 0, z: 0 }, b = { ...a };
  monitor.lights();
  traffic.enterJunction(a, head);
  traffic.enterJunction(a, head);
  traffic.enterJunction(b, head);
  traffic.light = () => 'red';
  monitor.lights();
  traffic.enterJunction(b, head);
  traffic.light = () => 'green';
  monitor.lights();
  traffic.enterJunction(a, head);
  game.onCrash(a, 5, b);
  game.onCrash(b, 5, a);
  traffic.time = 2;
  game.onCrash(a, 6, b);
  const { heads, incidents, damagedVehicles } = monitor.totals();
  assert.deepEqual(heads, [{ id: 3, edge: 1, greens: 2, entries: 3 }]);
  assert.equal(incidents, 2);
  assert.equal(damagedVehicles, 2);
});
