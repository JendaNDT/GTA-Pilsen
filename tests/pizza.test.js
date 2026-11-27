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

test('nabídky pokrývají různé části mapy a používají skutečné adresy u přístupového bodu', async () => {
  const { PIZZERIAS, pizzaOrder } = await import('../src/game/pizza-offers.js');
  const { readFile } = await import('node:fs/promises');
  const meta = JSON.parse(await readFile(new URL('../public/data/meta.json', import.meta.url)));
  const addresses = new Map();
  for (const [x,z,street,number] of meta.addresses) {
    const label = meta.roadNames[street] + ' ' + number;
    if (!addresses.has(label)) addresses.set(label, []);
    addresses.get(label).push([x,z]);
  }
  const doors = new Map();
  for (const shop of PIZZERIAS) {
    assert.ok(shop.orders.length >= 3, shop.name);
    for (const order of shop.orders) {
      const address = order.label.split(' · ')[0];
      assert.ok(addresses.get(address)?.some(([x,z]) => Math.hypot(order.drop.x-x, order.drop.z-z) <= 20.1), order.label);
      const task = pizzaOrder(shop, order);
      assert.equal(task.pick, shop.pick);
      assert.equal(task.drop.label, order.label);
      assert.ok(task.metres >= 120);
      assert.ok(Math.hypot(task.drop.x-task.park.x, task.drop.z-task.park.z) >= 3);
      doors.set(task.drop.x + '/' + task.drop.z, task.drop);
    }
  }
  const all = [...doors.values()];
  assert.ok(all.length > 100 && PIZZERIAS.length > 10);
  for (const near of [p => p.x < -7500, p => p.x > 23000, p => p.z < -9500, p => p.z > 8000]) {
    assert.ok(all.some(near));
  }
  const pilot = PIZZERIAS[0];
  const short = pizzaOrder(pilot, pilot.orders[0]);
  assert.deepEqual([short.label, short.reward, short.bonus, short.limit], ['Prokopova 25', 100, 40, 120]);
  const far = pizzaOrder(pilot, pilot.orders.at(-1));
  assert.ok(far.metres > 10000 && far.limit > short.limit && far.reward > short.reward && far.bonus > short.bonus);
});
