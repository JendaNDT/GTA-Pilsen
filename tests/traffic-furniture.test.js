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

test('sloupek uvnitř vozovky dostane nejbližší místo mimo vozovku a budovy', () => {
  const street = {
    groundY: () => 0,
    onCarriageway: (_x, z, _y, padding) => Math.abs(z) <= 2 + padding,
    buildingAt: (_x, z) => z > 2 ? 0 : -1,
    isWater: () => false,
    maxRoadHalfWidth: 4,
  };
  const head = { x: 0, z: 1.5, tx: 0, tz: -1, kind: 'pedestrian', breakableId: 'signal/3/14' };
  const moved = trafficFurniture(street, head, 'signal');
  assert.equal(moved.id, head.breakableId);
  assert.ok(moved.z < -2.25 && moved.z >= -2.5);
  assert.equal(trafficFurniture(street, head, 'signal'), moved);
  assert.equal(head.z, 1.5);
});

test('mezi překážkami se najde i úzké místo mimo vozovku', () => {
  const street = {
    groundY: () => 0,
    onCarriageway: (x, z) => Math.abs(x + 1.25) > 0.1 || Math.abs(z - 6) > 0.1,
    buildingAt: () => -1,
    isWater: () => false,
    maxRoadHalfWidth: 8.55,
  };
  const entry = { x: 0, z: 0, tx: 0, tz: -1, kind: 'noEntry', breakableId: 'sign/3/2' };
  const fixture = trafficFurniture(street, entry, 'sign');
  assert.deepEqual([fixture.x, fixture.z], [-1.25, 6]);
});
