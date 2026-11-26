import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

async function openPilot(page, mobile = false) {
  await page.goto(gameUrl('/?debug&quality=low&hour=10'));
  await waitForGame(page);
  const play = page.getByRole('button', { name: 'Hrát', exact: true });
  if (mobile) await play.tap(); else await play.click();
  await page.evaluate(() => {
    __freeze(true);
    __game.vehicles.spawnTimer = __game.peds.timer = 100_000;
    const { player, world, colliders, bikes } = __game, a = bikes.stations[0];
    player.place(a.x - 4.5, a.z - 1.5);
    for (let i = 0; i < 25; i++) colliders.update(player.x, player.z);
    for (let i = 0; i < 120; i++) {
      const x = a.x - player.x, z = a.z - player.z, d = Math.hypot(x, z);
      if (d < 1.5) break;
      player.update(.035, x / d, z / d, false, false);
    }
    if (world.onCarriageway(player.x, player.z, player.y)) throw new Error('Pěší příchod zasahuje do vozovky.');
    __step(.16);
  });
  await expect(page.locator('#prompt')).toContainText('Půjčit elektrokolo');
}

test('E55 – obě skutečná stanoviště na mapě, jízda, sesednutí a přesun kola do druhého stanoviště', async ({ page }) => {
  await openPilot(page);
  await page.evaluate(() => __game.toggleMap(true));
  await page.getByRole('searchbox').fill('Pilsen Bike');
  for (const name of ['Západočeské muzeum', 'DEPO 2015']) {
    await page.getByRole('button', { name: `${name} · Pilsen Bike` }).click();
    await expect(page.locator('#map-name')).toHaveText(`${name} · Pilsen Bike`);
    await expect(page.locator('#map-access')).toContainText('ve hře 1 /');
    await page.getByRole('searchbox').fill('Pilsen Bike');
  }
  await page.getByRole('button', { name: 'Zavřít mapu' }).click();
  await page.keyboard.press('f');
  const riding = await page.evaluate(() => {
    __step(1/60);
    const g = __game, p = g.player, old = { x: p.x, z: p.z };
    __setInput(0, 1);
    __step(1/60, 96);
    const speed = g.bikes.speed;
    const moved = Math.hypot(p.x - old.x, p.z - old.z);
    __setInput(.35, -1);
    __step(1/60, 100);
    __setInput(undefined, undefined);
    return { mode: g.mode, speed, moved, grounded: p.grounded, stopped: g.bikes.speed, stock: g.bikes.stock };
  });
  expect(riding).toMatchObject({ mode: 'bike', grounded: true, stopped: 0, stock: { 43: 0, 57: 1 } });
  expect(riding.speed).toBeGreaterThan(2);
  expect(riding.moved).toBeGreaterThan(3.7);
  await page.keyboard.press('f');
  await page.evaluate(() => __step(.16));
  expect(await page.evaluate(() => __game.mode)).toBe('foot');
  await expect(page.locator('#prompt')).toContainText('Nasednout na vypůjčené elektrokolo');
  await page.keyboard.press('f');
  await page.evaluate(() => {
    __step(1/60);
    const g = __game, b = g.bikes.stations[1];
    for(let i = 0; i < 25; i++) g.colliders.update(b.x, b.z);
    g.player.place(b.x, b.z, g.colliders.exitHeight(b.x, b.z, b.y));
    __step(1/60, 60);
  });
  await expect(page.locator('#prompt')).toContainText('Vrátit elektrokolo');
  const failed = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    try {
      Storage.prototype.setItem = () => { throw new Error('Zkušební chyba uložení'); };
      __game.doAction();
      return { mode: __game.mode, count: __game.bikes.stock['57'], origin: __game.bikes.rental?.origin };
    } finally { Storage.prototype.setItem = original; }
  });
  expect(failed).toEqual({ mode: 'bike', count: 1, origin: '43' });
  await page.keyboard.press('f');
  await page.evaluate(() => __step(.16));
  await expect(page.locator('#toast')).toContainText('Elektrokolo vráceno · DEPO 2015');
  expect(await page.evaluate(() => ({ mode: __game.mode, saved: JSON.parse(localStorage.getItem('plzen-naplno-v1')).bikeShare })))
    .toEqual({ mode: 'foot', saved: { stock: { 43: 0, 57: 2 }, origin: null } });
  await page.reload();
  await waitForGame(page);
  expect(await page.evaluate(() => __game.bikes.stock)).toEqual({ 43: 0, 57: 2 });
});

test('E55 – půjčení a brzdění při zatáčení na dotyku, obnovení vrátí rozjeté kolo', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await openPilot(page, true);
    await page.getByRole('button', { name: 'Půjčit elektrokolo' }).tap();
    await page.evaluate(() => __step(1/60, 3));
    const stick = await page.locator('#stick').boundingBox(), brake = await page.getByRole('button', { name: 'Brzdit', exact: true }).boundingBox();
    const session = await context.newCDPSession(page);
    const touch = (type, touchPoints) => session.send('Input.dispatchTouchEvent', { type, touchPoints });
    const ahead = { x: stick.x + stick.width / 2, y: stick.y + stick.height * .1, id: 1 };
    await touch('touchStart', [ahead]);
    const start = await page.evaluate(() => {
      __step(1/60, 105);
      return { speed: __game.bikes.speed, yaw: __game.player.yaw };
    });
    await touch('touchMove', [{ ...ahead, x: stick.x + stick.width * .89 }]);
    await touch('touchStart', [{ ...ahead, x: stick.x + stick.width * .89 }, { x: brake.x + brake.width/2, y: brake.y + brake.height/2, id: 2 }]);
    const end = await page.evaluate(() => {
      __step(1/60, 50);
      return { speed: __game.bikes.speed, yaw: __game.player.yaw };
    });
    await touch('touchEnd', []);
    expect(start.speed).toBeGreaterThan(2.5);
    expect(end.speed).toBeLessThan(start.speed);
    expect(Math.abs(end.yaw - start.yaw)).toBeGreaterThan(.1);
    await page.reload();
    await waitForGame(page);
    await page.getByRole('button', { name: 'Pokračovat', exact: true }).tap();
    await expect(page.locator('#toast')).toContainText('Půjčené elektrokolo se vrátilo na výchozí stanoviště.');
    expect(await page.evaluate(() => ({ mode: __game.mode, stock: __game.bikes.stock, rental: __game.bikes.rental })))
      .toEqual({ mode: 'foot', stock: { 43: 1, 57: 1 }, rental: null });
  } finally { await context.close(); }
});
