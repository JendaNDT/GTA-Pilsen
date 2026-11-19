import assert from 'node:assert/strict';
import test from 'node:test';
import { trafficFurniture } from '../src/world/traffic-furniture.js';

const world = { groundY: (x, z) => x - z };

test('sloupek a štít značky mají společnou polohu i na svahu', () => {
  const entry = { x: 10, z: 3, tx: -1, tz: 0, kind: 'stop', breakableId: 'sign/5/2' };
  const sign = trafficFurniture(world, entry, 'sign');
  assert.equal(sign.id, 'sign/5/2');
  assert.equal(sign.y, 7);
  assert.equal(sign.pole.y - sign.pole.height / 2, 0);
  assert.equal(sign.panel.x, 0.045);
  assert.equal(sign.panel.yaw, Math.PI / 2);
  assert.equal(sign.panel.width, 0.83);
  assert.ok(sign.panel.y - sign.panel.height / 2 < sign.pole.height);
});

test('semafor pro chodce a pro auta mají odlišnou výšku i velikost tělesa', () => {
  const head = { x: 2, z: -3, tx: 0, tz: 1, kind: 'signal', breakableId: 'signal/1/1' };
  const vehicle = trafficFurniture(world, head, 'signal');
  const pedestrian = trafficFurniture(world, { ...head, kind: 'pedestrian' }, 'signal');
  assert.equal(vehicle.panel.z, -0.11);
  assert.equal(vehicle.panel.y, 3.3);
  assert.equal(vehicle.panel.height, 0.96);
  assert.equal(pedestrian.panel.y, 2.45);
  assert.equal(pedestrian.panel.height, 0.54);
  assert.equal(vehicle.panel.depth, pedestrian.panel.depth);
});
