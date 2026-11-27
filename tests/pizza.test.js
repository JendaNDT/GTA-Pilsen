import assert from 'node:assert/strict';
import test from 'node:test';
import { atPizzaDoor, PIZZA, pizzaResult } from '../src/game/pizza.js';

test('předání vyžaduje chodník u vchodu ve stejné výšce', () => {
  const world = { groundY: () => 3, onCarriageway: x => x > PIZZA.drop.x + 1 };
  const foot = { ...PIZZA.drop, y: 3.1 };
  assert.ok(atPizzaDoor(foot, PIZZA.drop, world));
  for (const change of [{ y: 6 }, { x: foot.x + 1.5 }, { z: foot.z - 4 }, { swimming: true }]) {
    assert.equal(atPizzaDoor({ ...foot, ...change }, PIZZA.drop, world), false);
  }
});

test('rozvoz po termínu vyplatí základ, včasný přidá časový bonus', () => {
  assert.equal(pizzaResult({ ...PIZZA, time: 10 }).amount, 140);
  assert.equal(pizzaResult({ ...PIZZA, time: -1 }).amount, 100);
});

test('výdej a předání leží u správných objektů v distribuované mapě', async () => {
  const { readFile } = await import('node:fs/promises');
  const map = JSON.parse(await readFile(new URL('../public/data/meta.json', import.meta.url), 'utf8'));
  const near = ([x, z], point, metres) => Math.hypot(x - point.x, z - point.z) < metres;
  assert.ok(map.food.some(p => p[3] === "Rud's Pizza" && near(p, PIZZA.pick, 5)));
  assert.ok(map.addresses.some(p => map.roadNames[p[2]] === 'Prokopova' && p[3] === '25' && near(p, PIZZA.drop, 11)));
});
