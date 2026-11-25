import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

async function start(page) {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low&view=350&hour=10'));
  await waitForGame(page);
}

test('běžec se nakloní dovnitř obou zatáček a na rovince se narovná', async ({ page }) => {
  await start(page);
  const turns = await page.evaluate(() => {
    const p = __game.player, x = p.x, z = p.z;
    return [-1, 1].map(side => {
      p.place(x, z);
      p.yaw = 0;
      for (let i = 0; i < 60; i++) p.update(1 / 60, 0, 1, true, false);
      for (let i = 0; i < 5; i++) p.update(1 / 60, side, 0, true, false);
      const lean = p.mesh.skeleton.bones[0].rotation.z;
      for (let i = 0; i < 90; i++) p.update(1 / 60, side, 0, true, false);
      return { lean: lean * side, straight: p.mesh.skeleton.bones[0].rotation.z };
    });
  });
  for (const turn of turns) {
    expect(turn.lean).toBeLessThan(-0.12);
    expect(Math.abs(turn.straight)).toBeLessThan(0.05);
  }
});

test('volné rozhlížení pěšky se uloží, otáčí kamerou a vrací kurzor mapě i menu', async ({ page }) => {
  await start(page);
  await page.locator('#btn-settings').click();
  await expect(page.locator('#free-look')).not.toBeChecked();
  await page.locator('#fullscreen-play').uncheck();
  await page.locator('#free-look').check();
  await page.reload();
  await waitForGame(page);
  await expect(page.locator('#free-look')).toBeChecked();
  await page.locator('#btn-play').click();
  const canvas = page.locator('#game');
  const locked = () => page.evaluate(() => document.pointerLockElement === document.querySelector('#game'));
  const capture = async () => {
    await canvas.click({ position: { x: 260, y: 240 } });
    await expect.poll(locked).toBe(true);
  };
  await capture();
  const yaw = await page.evaluate(() => __game.camYaw);
  await page.mouse.move(332, 243);
  await expect.poll(() => page.evaluate(() => __game.camYaw)).not.toBe(yaw);
  await page.keyboard.down('s');
  const drift = await page.evaluate(() => {
    const before = __game.camYaw;
    __step(1 / 60, 170);
    return Math.abs(__game.camYaw - before);
  });
  await page.keyboard.up('s');
  expect(drift).toBeLessThan(0.001);
  await page.keyboard.press('m');
  await expect(page.locator('#bigmap')).toBeVisible();
  await expect.poll(locked).toBe(false);
  await page.locator('#bigmap-close').click();
  await capture();
  await page.keyboard.press('Escape');
  await expect.poll(locked).toBe(false);
  await expect(page.locator('#menu')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#btn-play').click();
  await capture();
  await page.keyboard.press('o');
  await expect.poll(locked).toBe(false);
  await page.keyboard.press('o');
  await capture();
  await page.evaluate(() => __game._enterCar(__game.player.lastCar));
  await expect.poll(locked).toBe(false);
  await canvas.click({ position: { x: 260, y: 240 } });
  expect(await locked()).toBe(false);
});

test('při odmítnutí zámku funguje tažení myší až do uvolnění tlačítka', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('Zamítnuto'));
  });
  await start(page);
  await page.locator('#btn-settings').click();
  await page.locator('#free-look').check();
  await page.locator('#btn-play').click();
  const yaw = () => page.evaluate(() => __game.camYaw);
  await page.mouse.move(250, 230);
  const before = await yaw();
  await page.mouse.down();
  await page.mouse.move(310, 230);
  await expect.poll(yaw).not.toBe(before);
  await page.mouse.up();
  const after = await yaw();
  await page.mouse.move(370, 230);
  await page.evaluate(() => __step(1 / 60));
  expect(await yaw()).toBe(after);
});

test.describe('dotykové ovládání', () => {
  test.use({ hasTouch: true });
  test('páčka plynule přidává rychlost i přes původní hranici běhu a po puštění zastaví', async ({ page }) => {
    await start(page);
    await page.locator('#btn-play').click();
    const speeds = await page.evaluate(() => {
      __freeze(true);
      const p = __game.player, stick = document.getElementById('stick'), r = stick.getBoundingClientRect();
      const samples = [];
      for (const [i, amount] of [0.35, 0.70, 0.84, 0.86, 1, 0].entries()) {
        const touch = new Touch({ identifier: 1, target: stick, clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2 * (1 - amount) });
        const type = amount === 0 ? 'touchend' : i === 0 ? 'touchstart' : 'touchmove';
        stick.dispatchEvent(new TouchEvent(type, { changedTouches: [touch], cancelable: true }));
        __step(1 / 60, 65);
        samples.push(p.pose.speed);
      }
      return samples;
    });
    expect(speeds[0]).toBeCloseTo(0.84, 1);
    expect(speeds[1]).toBeCloseTo(1.68, 1);
    expect(speeds[2]).toBeGreaterThan(speeds[1]);
    expect(speeds[3]).toBeGreaterThan(speeds[2]);
    expect(speeds[3] - speeds[2]).toBeLessThan(0.6);
    expect(speeds[4]).toBeCloseTo(6.4, 1);
    expect(speeds[5]).toBeLessThan(0.01);
  });
});
