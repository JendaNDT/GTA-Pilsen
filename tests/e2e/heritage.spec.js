import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E05 – pilotní památky se vykreslí, přepnou detail a uvolní dlaždici', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()); });
  const response = page.waitForResponse('**/detail/city/index.json');
  await page.goto(gameUrl('/?debug&view=620&wet=1'));
  const data = await (await response).json();
  expect(data.sha256).toBe("825dc3e395044b1f5a47e27c812cc4189829e9134cc027865ffc8fcb3e7bb9ac");
  expect(data.buildings).toBe(5697);
  expect(data.tiles).toHaveLength(93);
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
  await page.waitForFunction(() => {
    const g = window.__game;
    g.chunks.update(5, 5, 620, 8);
    return [...g.chunks.chunks.values()].some((ch) => ch.heritage?.city && ch.heritage.detail.length);
  });
  const city = await page.evaluate(() => {
    const g = window.__game, heritage = g.chunks.heritage;
    const index = [...heritage.cells.keys()].find((i) => g.chunks.chunks.get(i)?.heritage?.detail.length);
    const ch = g.chunks.chunks.get(index);
    const detail = ch.heritage.detail[0], base = ch.heritage.base[0];
    const near = detail.visible && base.material === heritage.cityClose;
    g.chunks.update(5, 5, 620, 0, 450);
    const fromHigh = !detail.visible && base.material === heritage.cityFar;
    g.chunks.update(5, 5, 620, 0, 0);
    g.env.setHour(17.95);
    window.__view(-63, 4, 64, -8, 36, 0);
    g.env.setHour(21.8);
    window.__view(-63, 4, 64, -8, 36, 0);
    return { near, fromHigh, night: g.env.night, roof: g.world.roofAt(-22.8, -9.7) };
  });
  expect(city.near).toBe(true);
  expect(city.fromHigh).toBe(true);
  expect(city.roof).toBeGreaterThan(60);
  expect(city.night).toBe(1);

  const forge = await page.evaluate(() => {
    const g = window.__game, w = g.world, heritage = g.chunks.heritage;
    const x = 22660.55, z = 3099.7;
    for (let i = 0; i < 5; i++) g.chunks.update(x, z, 620, 150);
    const key = w.chunkIndex(x, z), ch = g.chunks.chunks.get(key);
    const model = ch.heritage;
    const roof = w.roofAt(x, z);
    const normalRoof = w.bTop[heritage.forgeIndex];
    const clear = !w.collideCircle(x, z, 0.3, roof + 0.05, roof + 1.7);
    const stop = w.blocked(x, z, 0.3);
    g.focus = { x, z, y: w.heightAt(x, z) };
    g.env.setHour(22);
    g.chunks.update(x, z, 620, 0);
    window.__view(22681, 115.7, 3120, x, 113.1, z);
    const night = model.night.every((m) => m.visible);
    const nearWheels = model.wheels.every((m) => m.visible);
    let disposed = false;
    model.base[0].geometry.addEventListener('dispose', () => { disposed = true; });
    g.chunks.update(0, 0, 620, 0);
    return { roof, normalRoof, clear, stop, night, nearWheels, disposed, wheels: model.wheels.length };
  });
  expect(forge.roof).toBeGreaterThan(forge.normalRoof + 1);
  expect(forge.clear && forge.stop).toBe(true);
  expect(forge.wheels).toBe(4);
  expect(forge.nearWheels && forge.night && forge.disposed).toBe(true);
  expect(errors).toEqual([]);
});

test('měřené budovy se stahují podle polohy a po selhání zůstane vidět původní zástavba', async ({ page }) => {
  const file = '**/detail/city/128--128.bin';
  let fail = true, attempts = 0, requests = 0;
  page.on('request', (r) => { if (/\/detail\/city\/.*\.bin$/.test(r.url())) requests++; });
  await page.route(file, (route) => {
    attempts++;
    return fail ? route.abort() : route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('plzen-naplno-v1', JSON.stringify({ v: 1, x: -1100, z: -2650, hour: 10 }));
  });
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
  await page.waitForFunction(() => window.__ready);
  expect(requests).toBe(0);
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
  await page.waitForFunction(() => {
    const g = window.__game;
    g.chunks.update(128, -128, 620, 12);
    const ch = g.chunks.chunks.get(g.world.chunkIndex(128, -128));
    return ch?.cityRequest && ch.stage >= 2 && ch.regularBuildings?.visible && !ch.heritage;
  });
  expect(attempts).toBe(1);
  await page.evaluate(() => window.__game.chunks.update(-1100, -2650, 620, 0));
  fail = false;
  await page.waitForFunction(() => {
    const g = window.__game;
    g.chunks.update(128, -128, 620, 12);
    return g.chunks.chunks.get(g.world.chunkIndex(128, -128))?.heritage?.city;
  });
  expect(attempts).toBe(2);
  const installed = await page.evaluate(() => {
    const g = window.__game, ci = g.world.chunkIndex(128, -128);
    const { heritage, chunks } = g.chunks;
    const tile = chunks.get(ci).heritage;
    const matched = heritage.cells.get(ci).replacements;
    let disposed = false;
    tile.base[0].geometry.addEventListener('dispose', () => { disposed = true; });
    const active = matched.filter((i) => heritage.replaced.has(i)).length;
    g.chunks.update(-1100, -2650, 620, 0);
    return { active, released: matched.every((i) => !heritage.replaced.has(i)), disposed };
  });
  expect(installed.active).toBeGreaterThan(0);
  expect(installed.released && installed.disposed).toBe(true);
});
