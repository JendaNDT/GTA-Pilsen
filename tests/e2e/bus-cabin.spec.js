import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { action, approach, boot } from './transit-steps.js';
import { BUS_TRIP } from '../../src/game/tram-cabin.js';

test('E60 – jízda autobusem 33 ze stanoviště 4 přes Goethovu a výstup zadními dveřmi', async ({ page }, info) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => {
    let seed = 1729;
    Math.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32);
  });
  await page.goto(gameUrl('/?debug&quality=low&kolony=1&adapt=0&date=2026-11-09&hour=8.333333'));
  await page.getByRole('button', { name: 'Nastoupit do průchozího autobusu' }).click();
  const id = await page.evaluate(() => {
    __freeze(true);
    return __game.ride.event.trip.id;
  });
  expect(id).toBe(BUS_TRIP);
  const screenshot = async name => page.screenshot({ path: info.outputPath(name + '.jpg'), style: '#toast { visibility:hidden }' });
  await screenshot('nastup');
  async function walk(key, steps) {
    await page.keyboard.down(key);
    await page.evaluate(n => __step(1 / 60, n), steps);
    await page.keyboard.up(key);
  }
  async function travel(name) {
    return page.evaluate(async name => {
      const g = __game, v = g.ride, start = v.s;
      for (let i = 0; i < 8500; i++) {
        g.update(1 / 30);
        if (i % 90 === 89) await new Promise(resolve => setTimeout(resolve, 0));
        if (v.stopTarget?.[1] === name && v.canAlight && v.doorFraction >= 0.85) {
          await g.chunks.prepareStart(g.focus, 340);
          __step(0);
          return { metres: v.s - start, seated: !!g.cabin.seat };
        }
      }
      throw new Error('Autobus nedojel do zastávky ' + name + ', ujel ' + (v.s - start).toFixed(1) + ' m. ' + JSON.stringify({ chain: g.trafficWaits.chain(v), lane: v.departureLane, next: v.stops[v.stopIndex], wait: v.wait }));
    }, name);
  }
  await walk('w', 60);
  await action(page);
  expect(await page.evaluate(() => __game.cabin.action)).toBe('Vstát');
  const first = await travel('Goethova');
  expect(first.seated).toBe(true);
  expect(first.metres).toBeGreaterThan(100);
  await screenshot('goethova');
  await action(page);
  await walk('w', 246);
  await walk('a', 20);
  expect(await page.evaluate(() => __game.cabin.door)).toBe(-4.23);
  await page.evaluate(() => {
    const g = __game;
    for (let i = 0; i < 12000 && g.ride.doorsOpen; i++) g.update(1 / 30);
    if (g.ride.doorsOpen) throw new Error('Autobus neodjel z Goethovy.');
  });
  await action(page);
  expect(await page.evaluate(() => __game.mode)).toBe('transit');
  const second = await travel('Pařížská');
  expect(second.metres).toBeGreaterThan(100);
  const target = await page.evaluate(() => __game.transit.exitPoint(__game.ride, {}, __game.cabin.door));
  await action(page);
  const landed = await page.evaluate(() => {
    const g = __game;
    return { mode: g.mode, x: g.player.x, z: g.player.z, clear: g._platformClear(g.player) };
  });
  expect(landed).toMatchObject({ mode: 'foot', clear: true });
  expect(Math.hypot(landed.x - target.x, landed.z - target.z)).toBeLessThan(0.5);
  await screenshot('vystup');
  await info.attach('Jízda autobusem 33', { body: JSON.stringify({ id, first, second, landed }), contentType: 'application/json' });
});

test.describe('dotykový autobus', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  test('E60 – vyhledat autobus a nastoupit prostředními dveřmi ze správné strany', async ({ page }) => {
    await boot(page, 'quality=low');
    await action(page, 'KeyM');
    await page.getByRole('searchbox').fill(BUS_TRIP);
    await page.getByRole('button', { name: 'Průchozí autobus · linka 33' }).tap();
    await expect(page.locator('#map-access')).toContainText('8:20 ze stanoviště 4');
    await page.locator('#bigmap-close').tap();
    expect((await approach(page, BUS_TRIP, 'Náměstí Republiky')).boardable).toBe(true);
    const door = await page.evaluate(() => {
      const g = __game, v = g.transit.boardable(g.player.x, g.player.z, g.player.y);
      const z = v.sections[0].doors[1];
      const opposite = v.meshes[0].localToWorld(g.camera.position.clone().set(2.6, 0, z));
      const point = g.transit.exitPoint(v, {}, z);
      g.player.place(point.x, point.z, v.y);
      g.promptTimer = 0;
      __step(1 / 60);
      return { wrongSide: g.transit.boardable(opposite.x, opposite.z, opposite.y) === v, z };
    });
    expect(door.wrongSide).toBe(false);
    const tap = async () => { await page.locator('#tb-act').tap(); await page.evaluate(() => __step(1 / 60)); };
    await tap();
    expect(await page.evaluate(() => __game.cabin?.door)).toBe(door.z);
    await tap();
    expect(await page.evaluate(() => __game.mode)).toBe('foot');
  });
});
