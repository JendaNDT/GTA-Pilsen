import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function start(page) {
  await page.goto(gameUrl('/?debug&quality=low'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
}

test('E20 – fyzikální auto zastaví na Doudlevecké a po přednosti pokračuje', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, traffic = w.traffic, manager = g.vehicles;
    const car = g.player.lastCar;
    for (const other of [...manager.cars]) if (other !== car) manager.remove(other);
    manager.obstacles.length = 0;
    const rule = traffic.controls.find((c) => c.kind === 'stop' && c.id === 11969048194 && c.mark === 4248);
    const lane = w.r.w[rule.road] / 4, start = rule.s - 17;
    const p = w.edgePoint(rule.edge, start, lane, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    Object.assign(car, { mode: 'ai', edge: rule.edge, lane, s: start, temper: 1, speed: 8, vx: p.tx * 8, vz: p.tz * 8 });
    manager._pickNext(car);
    g.player.place(car.x + 10, car.z + 10);
    for (let i = 0; i < 20; i++) g.colliders.update(g.player.x, g.player.z);
    g.trafficBodies.update(g, 1 / 60);
    let stopped = 0, front = null;
    for (let tick = 0; tick < 1500; tick++) {
      traffic.tick(1 / 60);
      g.physics.step(1 / 60);
      if (car.edge !== rule.edge || car.s > rule.s + 2) break;
      if (Math.abs(car.speed) < 0.1) {
        stopped += 1 / 60;
        front = rule.s - car.s - car.halfLen;
      }
    }
    return { physical: !!car.physical, stopped, front, passed: car.edge !== rule.edge || car.s > rule.s + 2 };
  });
  expect(result.physical).toBe(true);
  expect(result.stopped, JSON.stringify(result)).toBeGreaterThan(0.3);
  expect(result.front).toBeGreaterThanOrEqual(0);
  expect(result.front).toBeLessThanOrEqual(1);
  expect(result.passed).toBe(true);
});

test('E20 – zaparkované auto spí a po střetu s jedoucím autem se rozjede', async ({ page }) => {
  await start(page);
  const sample = await page.evaluate(() => {
    const g = __game, car = g.player.lastCar;
    for (const c of [...g.vehicles.cars]) if (c !== car) g.vehicles.remove(c);
    car.place(-42, 20, 0);
    g._enterCar(car);
    const parked = g.vehicles.add(new car.constructor('sedan', 0x888888));
    parked.place(-42, 35, 0);
    for (let i = 0; i < 20; i++) g.colliders.update(car.x, car.z);
    g.paused = false;
    g.vehicles.spawnTimer = Infinity;
    g.update(1 / 60);
    const asleep = parked.physical.body.IsDynamic() && !parked.physical.body.IsActive();
    car.vz = car.speed = 15;
    g.driver.teleport();
    let peak = 0, before = 0, after = 0;
    for (let i = 0; i < 160; i++) {
      const previous = car.speed;
      g.physics.step(1 / 60);
      if (!before && parked.speed > 1) { before = previous; after = car.speed; }
      peak = Math.max(peak, parked.speed);
    }
    return { asleep, moved: parked.z - 35, peak, before, after, damage: 100 - parked.health };
  });
  expect(sample.asleep).toBe(true);
  expect(sample.moved, JSON.stringify(sample)).toBeGreaterThan(1);
  expect(sample.peak).toBeGreaterThan(2);
  expect(sample.before - sample.after).toBeGreaterThan(2);
  expect(sample.damage).toBeGreaterThan(0);
});

test('E20 – fyzikální policejní vůz dojede k chodci a zastaví před ním', async ({ page }) => {
  await start(page);
  const sample = await page.evaluate(() => {
    const g = __game, Car = g.player.lastCar.constructor;
    for (const c of [...g.vehicles.cars]) g.vehicles.remove(c);
    const patrol = g.vehicles.add(new Car('police', 0xffffff));
    g.player.place(-42, 52);
    patrol.place(-42, 20, 0);
    patrol.mode = 'police';
    g.wanted = 1;
    g.vehicles.obstacles.length = 0;
    for (let i = 0; i < 20; i++) g.colliders.update(g.player.x, g.player.z);
    g.trafficBodies.update(g, 1 / 60);
    let peak = 0, closest = Infinity;
    for (let i = 0; i < 900; i++) {
      g.physics.step(1 / 60);
      peak = Math.max(peak, patrol.speed);
      closest = Math.min(closest, Math.hypot(patrol.x - g.player.x, patrol.z - g.player.z));
    }
    return { physical: !!patrol.physical, peak, closest, distance: patrol.policeDist, speed: patrol.speed };
  });
  expect(sample.physical).toBe(true);
  expect(sample.peak, JSON.stringify(sample)).toBeGreaterThan(3);
  expect(sample.closest).toBeGreaterThan(3);
  expect(sample.distance).toBeLessThan(9);
  expect(Math.abs(sample.speed)).toBeLessThan(0.25);
});
