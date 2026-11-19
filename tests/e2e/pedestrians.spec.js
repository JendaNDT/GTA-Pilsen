import { expect, test } from '@playwright/test';
import { prepareCollisionLab } from './collision-lab.js';
import { gameUrl } from './game-url.js';

test('E19 – skutečný náraz hráčova auta do chodce ohlásí jedinou nehodu', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await prepareCollisionLab(page);
  const result = await page.evaluate(() => {
    const g = window.__game, car = g.player.lastCar;
    g.peds.timer = g.vehicles.spawnTimer = Infinity;
    const x = 0, z = 0, dx = 0, dz = 1;
    car.place(x - 6 * dx, z - 6 * dz, Math.atan2(dx, dz));
    g._enterCar(car);
    car.speed = 10; car.vx = dx * 10; car.vz = dz * 10;
    const ped = g.peds.spawnAt(x, z, 0);
    ped.fx = ped.fz = 0;
    let hits = 0;
    const onHit = g.onPedHit.bind(g);
    g.onPedHit = (...args) => { hits++; onHit(...args); };
    g.paused = false;
    for (let i = 0; i < 80; i++) g.update(1 / 60);
    return { state: ped.state, hits, wanted: g.wanted, distance: (ped.x - x) * dx + (ped.z - z) * dz };
  });
  expect(result.state, JSON.stringify(result)).toBe('down');
  expect(result.hits).toBe(1);
  expect(result.wanted).toBe(1);
  expect(result.distance).toBeGreaterThan(0.2);
});

test('E19 – jedoucí auto srazí pěšího hráče', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await prepareCollisionLab(page);
  const result = await page.evaluate(() => {
    const g = window.__game, p = g.player, car = p.lastCar;
    g.peds.timer = g.vehicles.spawnTimer = Infinity;
    const x = 0, z = 0, dx = 0, dz = 1;
    car.place(x - 6 * dx, z - 6 * dz, Math.atan2(dx, dz));
    car.mode = 'loose'; car.speed = 10; car.vx = dx * 10; car.vz = dz * 10;
    p.place(x, z);
    g.paused = false;
    let injuries = 0, health = p.health, downFrames = 0, sides = 0, followed = false;
    for (let i = 0; i < 320; i++) {
      g.update(1 / 60);
      if (p.health < health - 1) injuries++;
      health = p.health;
      const fall = g.falls.active.get(p);
      if (fall) {
        downFrames++;
        sides = fall.mesh.children.length;
        followed ||= g.focus === p && Math.hypot(p.x - x, p.z - z) > 0.5;
        g.doAction();
        if (p.character || g.mode !== 'foot') throw new Error('Hráč se předčasně zvedl.');
      }
    }
    return { injuries, health, downFrames, sides, followed, stoodUp: !!p.character && p.mesh.visible };
  });
  expect(result.injuries, JSON.stringify(result)).toBe(1);
  expect(result.health).toBeLessThan(95);
  expect(result.downFrames).toBeGreaterThanOrEqual(120);
  expect(result.downFrames).toBeLessThanOrEqual(241);
  expect(result.sides).toBe(11);
  expect(result.followed).toBe(true);
  expect(result.stoodUp).toBe(true);
});

test('E19 – pád z výšky zraní jednou a omezení počtu uklidí nejstarší postavu', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await prepareCollisionLab(page);
  const result = await page.evaluate(() => {
    const g = __game, p = g.player;
    g.peds.timer = g.vehicles.spawnTimer = Infinity;
    g.paused = false;
    const x = 0, z = 0;
    const y = g.world.heightAt(x, z);
    p.place(x, z, y);
    const first = g.peds.spawnAt(x + 14, z, 0);
    first.y = y + 6;
    g.update(1 / 60);
    const before = g.falls.active.has(first);
    const second = g.peds.spawnAt(x + 17, z, 0);
    second.y = y + 6;
    g.update(1 / 60);
    const oldestGone = !g.falls.active.has(first) && g.falls.active.has(second);
    let quiet = 0, recovered = false;
    for (let i = 0; i < 600; i++) {
      const fall = g.falls.active.get(second);
      if (fall) quiet = Math.max(quiet, fall.doll.rest);
      g.update(1 / 60);
      if (fall && !g.falls.active.has(second)) { recovered = second.mesh.visible && second.state === 'flee'; break; }
    }
    p.place(x + 15, z, g.world.heightAt(x + 15, z) + 9);
    let seen = false, damage = 0, injuries = 0;
    for (let i = 0; i < 320; i++) {
      const hp = p.health;
      g.update(1 / 60);
      if (hp - p.health > 1) { injuries++; damage += hp - p.health; }
      seen ||= g.falls.active.has(p);
    }
    return { before, oldestGone, quiet, recovered, seen, injuries, damage, walking: !!p.character };
  });
  expect(result.before, JSON.stringify(result)).toBe(true);
  expect(result.oldestGone).toBe(true);
  expect(result.quiet).toBeGreaterThanOrEqual(2.98);
  expect(result.recovered).toBe(true);
  expect(result.seen).toBe(true);
  expect(result.injuries).toBe(1);
  expect(result.damage).toBeGreaterThan(20);
  expect(result.damage).toBeLessThan(28);
  expect(result.walking).toBe(true);
});

test('E19 – vypnutí fyzikálních pádů se zachová po novém načtení hry', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  const enabled = page.getByRole('checkbox', { name: 'Fyzikální pády postav' });
  await expect(enabled).toBeChecked();
  await enabled.uncheck();
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await expect(enabled).not.toBeChecked();
  expect(await page.evaluate(() => __game.falls.enabled)).toBe(false);
});
