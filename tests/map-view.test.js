import assert from 'node:assert/strict';
import test from 'node:test';
import { MapView, insideMap } from '../src/game/map-view.js';
import { travelBounds } from '../src/world/travel-bounds.js';

const world = { playMinX:-3000, playMaxX:6000, playMinZ:-1000, playMaxZ:3300 };
const area = travelBounds(world,'foot');

test('Mapa drží bod pod kurzorem při přiblížení i oddálení až k mezi', () => {
  const view = new MapView(area, 600, 420, 250, 55);
  assert.deepEqual(view.world(300,210), {x:250,z:55});
  const before = view.world(420,180);
  for (const factor of [2, 1e4, .6]) {
    view.zoom(factor,420,180);
    assert.ok(Math.hypot(...view.screen(before.x,before.z).map((v,i)=>v-[420,180][i]))<1e-8);
  }
  view.move(45,-20);
  assert.ok(view.x !== 250);
  view.home(250,55);
  assert.deepEqual(view.screen(250,55), [300,210]);
});

test('Přehled na telefonu ukáže všechny hranice a nechá prostor pro výběr za nimi', () => {
  const view = new MapView(area,320,540,0,0);
  view.overview();
  assert.ok(view.screen(area.minX,area.minZ).every(v=>v>0));
  const [x,y] = view.screen(area.maxX,area.maxZ);
  assert.ok(x<320 && y<540);
  const outside = view.world(1,1);
  assert.equal(insideMap(area,outside.x,outside.z),false);
  const car = travelBounds(world,'car'), heli = travelBounds(world,'heli');
  assert.ok(insideMap(area,area.minX,50));
  assert.ok(!insideMap(car,area.minX,50) && !insideMap(heli,car.minX,50));
  view.move(1e8,-1e8);
  assert.ok(insideMap(area,view.x,view.z));
});
