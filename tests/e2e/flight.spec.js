import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E20 – vrtulník v rovném letu zrychlí na 300 km/h a po uvolnění W zpomalí', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const height = await page.evaluate(() => {
    __freeze(true);
    const g = __game, h = g.helis[3];
    h.y = g.world.heightAt(h.x, h.z) + 250;
    h.yaw = Math.PI / 3;
    h.rotor = 30;
    g._enterHeli(h);
    return h.y;
  });
  await page.keyboard.down('w');
  const cruise = await page.evaluate(async () => {
    const g = __game, h = g.heli;
    let x, z;
    for (let second = 0; second < 65; second++) {
      if (second === 60) { x = h.x; z = h.z; }
      for (let frame = 0; frame < 30; frame++) g.update(1 / 30);
      await new Promise(requestAnimationFrame);
    }
    return { kmh: Math.hypot(h.x - x, h.z - z) / 5 * 3.6, y: h.y };
  });
  await page.keyboard.up('w');
  await expect(page.locator('#kmh')).toHaveText('300');
  expect(cruise.kmh).toBeGreaterThan(299);
  expect(cruise.kmh).toBeLessThanOrEqual(300.1);
  expect(Math.abs(cruise.y - height)).toBeLessThan(0.5);
  const after = await page.evaluate(() => {
    for (let i = 0; i < 300; i++) __game.update(1 / 30);
    return __game.heli.speed * 3.6;
  });
  expect(after).toBeLessThan(90);
});

test('E20 – vrtulník přistane na střeše FN Lochotín i na pozemním heliportu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
  for (const index of [0, 1]) {
    const start = await page.evaluate((index) => {
      const g = __game, h = g.helis[index];
      const surface = g.world.surfaceAt(h.x, h.z);
      h.y = surface + 12; h.rotor = 30; h.landed = false;
      g._enterHeli(h);
      for (let i = 0; i < 20; i++) g.colliders.update(h.x, h.z);
      return { surface, ground: g.world.heightAt(h.x, h.z) };
    }, index);
    if (!index) expect(start.surface - start.ground).toBeGreaterThan(3);
    await page.keyboard.down('Shift');
    const landed = await page.evaluate(() => {
      const g = __game, h = g.heli;
      g.vehicles.spawnTimer = g.peds.timer = Infinity;
      for (let i = 0; i < 720 && !h.landed; i++) g.update(1 / 60);
      for (let i = 0; i < 45; i++) g.update(1 / 60);
      return { physical: !!h.physical, landed: h.landed, y: h.y, speed: h.speed, vy: h.vy, health: g.player.health };
    });
    await page.keyboard.up('Shift');
    expect(landed.physical && landed.landed, JSON.stringify(landed)).toBe(true);
    expect(Math.abs(landed.y - start.surface)).toBeLessThan(0.35);
    expect(landed.speed).toBeLessThan(1);
    expect(Math.abs(landed.vy)).toBeLessThan(0.5);
    expect(landed.health).toBe(100);
    await page.evaluate(() => __game.doAction());
    expect(await page.evaluate(() => __game.mode)).toBe('foot');
  }
});

test('E20 – vypnutí letové asistence se načte z uložené hry', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  const assist = page.getByRole('checkbox', { name: 'Vyrovnání vrtulníku a držení výšky' });
  await expect(assist).toBeChecked();
  await assist.uncheck();
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  expect(await page.evaluate(() => __game.heliAssist)).toBe(false);
});
