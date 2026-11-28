import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';
import { testTimeout } from './test-timeout.js';

// Klávesové osy řídí postavu i kolo. Polohu mění při cestě pouze fyzika hry.
function follow(points) {
  const g = window.__game, p = g.player, dt = 1 / 60;
  const riding = g.mode === 'bike';
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i], z = points[i + 1];
    let steps = 0, closest = Infinity;
    while (Math.hypot(x - p.x, z - p.z) > (riding ? 1.35 : .85)) {
      const remaining = Math.hypot(x - p.x, z - p.z);
      if (remaining < closest - .5) { closest = remaining; steps = 0; }
      if (++steps > 1000 || (g.mode === 'bike') !== riding) {
        throw new Error(`Překážka na cestě do ${x}, ${z} z ${p.x}, ${p.z} (${g.mode})`);
      }
      const heading = Math.atan2(x - p.x, z - p.z);
      if (riding) {
        const turn = heading - p.yaw, angle = Math.atan2(Math.sin(turn), Math.cos(turn));
        const distance = Math.hypot(x - p.x, z - p.z);
        const speed = Math.min(distance * .85, Math.abs(angle) > .6 ? 1.35 : 4.9);
        __setInput(Math.max(-1, Math.min(1, -angle * 2.8)), g.bikes.speed > speed + .35 ? -.7 : 1);
      } else {
        g.camYaw = heading;
        __setInput(0, 1);
      }
      g.update(dt);
    }
  }
  __setInput(0, riding ? -1 : 0);
  __step(dt, riding ? 90 : 15);
  __setInput(undefined, undefined);
}

const deliveries = [
  { town: 'Plzeň', base: 100, total: 140 },
  { town: 'Rokycany', shopName: 'Pizza Italia & Doner Kebab', address: 'Palackého 175 · Rokycany – Střed', length: '171 m', base: 100, total: 140 },
  { town: 'Starý Plzenec → Sedlec', shopName: 'Plzenecká pizzerie', address: 'Smetanova 145 · Sedlec', length: '950 m', base: 135, total: 190 },
];
for (const { town, shopName, address, length, base, total } of deliveries) {
  test(`Rozvoz pizzy · ${town} · dotykem vyzvednout, projet trasu a vyplatit jediné předání`, async ({ browser }, info) => {
    test.setTimeout(testTimeout(120000));
    const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 740, height: 390 } });
    try {
      const page = await context.newPage();
      await page.goto(gameUrl('/?debug&quality=low&hour=10&view=350'));
      await waitForGame(page);
      await page.locator('#btn-jobs').tap();
      if (town === 'Starý Plzenec → Sedlec') {
        await page.getByRole('radio', { name: 'Podle adresy' }).check();
        await page.getByRole('searchbox', { name: 'Hledat adresu' }).fill('145 sedlec smetanova');
      }
      if (shopName) {
        const shop = page.locator('#pizza-shop option').filter({ hasText: shopName });
        await page.getByRole('combobox', { name: 'Výdej', exact: true }).selectOption({ label: await shop.textContent() });
        await page.getByRole('combobox', { name: 'Doručení', exact: true }).selectOption({ label: address });
        await expect(page.locator('#pizza-pay')).toContainText(length);
      }
      await page.getByRole('button', { name: 'Rozvézt pizzu na kole' }).tap();
      await page.evaluate(() => {
        __freeze(true);
        const g = __game, { x, z } = g.jobs.job.pick;
        g.vehicles.spawnTimer = g.peds.timer = 100000;
        g.player.place(x, z);
        for (let i = 0; i < 25; i++) g.colliders.update(x, z);
        __step(1 / 60, 20);
      });
      const action = async name => {
        await page.getByRole('button', { name, exact: true }).tap();
        await page.evaluate(() => __step(1 / 60, 16));
      };
      await action('Vyzvednout pizzu');
      const bike = await page.evaluate(() => [__game.bikes.rental.x, __game.bikes.rental.z]);
      await page.evaluate(follow, bike);
      await action('Nasednout na kurýrní kolo');
      await expect.poll(() => page.evaluate(() => {
        __step(1 / 60, 8);
        return __game.jobs.cycling.status;
      }), { timeout: 15000, intervals: [50, 100, 200] }).toBe('Cyklistická trasa');
      const path = await page.evaluate(() => __game.jobs.displayedBike);
      await page.evaluate(follow, path);
      expect(await page.evaluate(() => [__game.mode, __game.jobs.job.phase, __game.jobs.job.ridden > 130])).toEqual(['bike', 'cycle', true]);
      await action('Sesednout z kurýrního kola');
      expect(await page.evaluate(() => __game.jobs.job.phase)).toBe('door');
      const door = await page.evaluate(() => [__game.jobs.job.drop.x, __game.jobs.job.drop.z]);
      expect(await page.evaluate(() => __game.jobs.pizzaChoice())).toBeNull();
      await page.evaluate(follow, door);
      const before = await page.evaluate(() => [__game.money, __game.stats.deliveries || 0]);
      const late = info.project.name === 'webgl2';
      if (late) {
        await page.evaluate(() => {
          const g = __game;
          g.jobs.job.time = .1;
          __step(1 / 60, 10);
          const write = g._writeSave;
          g._writeSave = function () { this._writeSave = write; return false; };
        });
      }
      await action('Předat pizzu');
      if (late) {
        expect(await page.evaluate(() => [__game.money, __game.stats.deliveries || 0])).toEqual(before);
        await page.evaluate(() => __freeze(false));
        await page.locator('#btn-menu').tap();
        await page.locator('#btn-jobs').tap();
        await page.locator('#job-retry').tap();
      }
      await page.evaluate(() => { __game.doAction(); __game.jobs.pay(); });
      const paid = await page.evaluate(() => {
        const g = __game;
        return [g.money, g.stats.deliveries, g.jobs.last.amount, g.jobs.job, g.bikes.rental];
      });
      const reward = late ? base : total;
      expect(paid).toEqual([before[0] + reward, before[1] + 1, reward, null, null]);
      await page.reload();
      await waitForGame(page);
      expect(await page.evaluate(() => [__game.money, __game.jobs.last.amount])).toEqual([paid[0], reward]);
    } finally { await context.close(); }
  });

}

test('E68 – převzít zakázku přímo u výdeje, vyprostit kolo a odmítnout předání bez jízdy', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&view=350&hour=10'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => {
    __freeze(true);
    const g = __game;
    g.player.place(104.7, 434);
    for (let i = 0; i < 25; i++) g.colliders.update(g.player.x, g.player.z);
    __step(1 / 60, 20);
  });
  async function key(code) {
    await page.keyboard.press(code);
    await page.evaluate(() => __step(1 / 60, 16));
  }
  await key('f');
  const start = await page.evaluate(() => {
    const { bikes, jobs } = __game;
    return { bike: [bikes.rental.x, bikes.rental.z], stock: bikes.snapshot().stock, phase: jobs.job.phase };
  });
  expect(start.phase).toBe('cycle');
  await page.evaluate(follow, start.bike);
  await key('f');
  await key('r');
  expect(await page.evaluate(() => [__game.mode, __game.bikes.rental.x, __game.bikes.rental.z])).toEqual(['foot', ...start.bike]);
  const result = await page.evaluate(() => {
    const g = __game, j = g.jobs.job;
    g.player.place(j.drop.x, j.drop.z);
    __step(1 / 60, 10);
    const handover = g.jobs.pizzaChoice()?.label || null;
    g.jobs.end('cancelled', 'Zrušeno hráčem');
    return [handover, g.jobs.last.amount, g.bikes.rental, g.bikes.stock];
  });
  expect(result).toEqual([null, 0, null, start.stock]);
});

test('E72 – na telefonu hledat pizzerii i společnou adresu, změnit výdej a obnovit nabídku', async ({ browser }, info) => {
  const context = await browser.newContext({ isMobile: true, hasTouch: true, viewport: { width: 740, height: 390 } });
  try {
    const page = await context.newPage();
    await page.goto(gameUrl('/?debug&quality=low&view=350&hour=10'));
    await waitForGame(page);
    await page.locator('#btn-jobs').tap();
    const shop = page.getByRole('combobox', { name: 'Výdej', exact: true });
    const address = page.getByRole('combobox', { name: 'Doručení', exact: true });
    const pay = page.locator('#pizza-pay');
    const accept = page.getByRole('button', { name: 'Rozvézt pizzu na kole' });
    await page.getByRole('searchbox', { name: 'Hledat pizzerii' }).fill('plzenecka');
    await expect(shop.locator('option')).toHaveCount(1);
    await address.selectOption({ label: 'Smetanova 145 · Sedlec' });
    await expect(pay).toContainText('950 m na kole · 135 Kč');
    await page.getByRole('radio', { name: 'Podle adresy' }).check();
    await expect(address).toHaveValue('Smetanova 145 · Sedlec');
    const search = page.getByRole('searchbox', { name: 'Hledat adresu' });
    await search.fill('stahlavy');
    await address.selectOption({ label: 'Dr. Beneše 664 · Šťáhlavy' });
    await expect(shop.locator('option')).toHaveCount(1);
    await expect(shop).toHaveValue('Rud’s Pizza · Prokopova');
    await search.fill('664 benese');
    await expect(address).toHaveValue('Dr. Beneše 664 · Šťáhlavy');
    await expect(pay).toContainText('15 km');
    await search.press('Enter');
    await expect(search).not.toBeFocused();
    await expect(accept).toBeVisible();
    await search.fill('zzz');
    await expect(accept).toBeDisabled();
    await expect(shop).toBeDisabled();
    await expect(address).toBeDisabled();
    await expect(pay).toContainText('Žádná adresa');
    await search.fill('');
    await expect(address.locator('option')).toHaveCount(546);
    await search.fill('dalmatinkou 22');
    await expect(shop.locator('option')).toHaveCount(2);
    await shop.selectOption({ label: 'Aqua Restaurace · náměstí Generála Píky nb · Slovany' });
    await expect(pay).toContainText('215 Kč');
    await shop.selectOption({ label: 'Pizzáno · Masarykova · Doubravka' });
    await expect(pay).toContainText('210 Kč');
    await search.press('Enter');
    await accept.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('nabidka.jpg'), type: 'jpeg' });
    await accept.tap();
    expect(await page.evaluate(() => {
      const j = __game.jobs.job;
      return [j.name, j.label, j.reward];
    })).toEqual(['Pizzáno · Masarykova · Doubravka', 'Nad Dalmatinkou 22 · Lobzy', 210]);
  } finally { await context.close(); }
});
