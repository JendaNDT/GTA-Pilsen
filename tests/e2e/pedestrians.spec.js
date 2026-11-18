import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E19 – skutečný náraz hráčova auta do chodce ohlásí jedinou nehodu', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const g = window.__game, car = g.player.lastCar;
    g.peds.timer = g.vehicles.spawnTimer = Infinity;
    car.place(-20, 5, 0);
    g._enterCar(car);
    car.vz = car.speed = 10;
    const ped = g.peds.spawnAt(-20, 12, 0);
    ped.fx = ped.fz = 0;
    let hits = 0;
    const onHit = g.onPedHit.bind(g);
    g.onPedHit = (...args) => { hits++; onHit(...args); };
    g.paused = false;
    for (let i = 0; i < 80; i++) g.update(1 / 60);
    return { state: ped.state, hits, wanted: g.wanted, north: ped.z - 12 };
  });
  expect(result.state, JSON.stringify(result)).toBe('down');
  expect(result.hits).toBe(1);
  expect(result.wanted).toBe(1);
  expect(result.north).toBeGreaterThan(0.2);
});

test('E19 – jedoucí auto srazí pěšího hráče', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const g = window.__game, p = g.player, car = p.lastCar;
    g.peds.timer = g.vehicles.spawnTimer = Infinity;
    const { x, z, dx, dz } = g.world.nearestRoad(657, 162, 5, 13, 0, {});
    car.place(x - 6 * dx, z - 6 * dz, Math.atan2(dx, dz));
    car.mode = 'loose'; car.speed = 10; car.vx = dx * 10; car.vz = dz * 10;
    p.place(x, z);
    g.paused = false;
    let injuries = 0, health = p.health;
    for (let i = 0; i < 75; i++) {
      g.update(1 / 60);
      if (p.health < health - 1) injuries++;
      health = p.health;
    }
    return { injuries, health, carZ: car.z, playerZ: p.z };
  });
  expect(result.injuries, JSON.stringify(result)).toBe(1);
  expect(result.health).toBeLessThan(95);
});
