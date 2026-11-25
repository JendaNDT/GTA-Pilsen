import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

async function start(page) {
  await page.goto(gameUrl('/?debug&quality=low&view=300&adapt=0&hour=10'));
  await waitForGame(page);
}

test('úvod, pauza za volantem, pojmenovaný cíl a návrat klávesou Esc', async ({ page }) => {
  await start(page);
  await expect(page.locator('#btn-play')).toHaveText('Hrát');
  await expect(page.locator('#btn-map')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#btn-play').click();
  await page.evaluate(() => {
    const g = __game, car = g.player.lastCar;
    g.player.place(car.x + 2, car.z);
    g.doAction();
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-title')).toHaveText('Pauza');
  const snapshot = () => page.evaluate(() => [__game.clock.now, __game.focus.x, __game.focus.z, __game.mode]);
  const frozen = await snapshot();
  expect(frozen[3]).toBe('car');
  await page.locator('#btn-settings').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-settings')).toBeFocused();
  await page.locator('#btn-map').click();
  await page.getByRole('searchbox').fill('Dřevěná lávka přes Strouhu');
  await page.getByRole('button', {name:'Dřevěná lávka přes Strouhu'}).click();
  await page.locator('#map-go').click();
  await expect(page.locator('#menu-objective')).toContainText('Dřevěná lávka přes Strouhu');
  expect(await snapshot()).toEqual(frozen);
  await page.locator('#btn-map').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-map')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => __game.paused)).toBe(false);
});

test('dotykem z rozvozu na mapu a zpátky, uložená poloha po obnovení', async ({ browser }) => {
  const context = await browser.newContext({ viewport:{width:780,height:390}, hasTouch:true, isMobile:true });
  try {
    const page = await context.newPage();
    await start(page);
    await page.locator('#btn-jobs').tap();
    await page.locator('[data-job="car"]').tap();
    await page.locator('#btn-menu').tap();
    await expect(page.locator('#menu-objective')).toContainText('Dhaba Beas');
    await page.locator('#btn-map').tap();
    await page.locator('#bigmap-close').tap();
    await expect(page.locator('#menu-title')).toHaveText('Pauza');
    await page.locator('#btn-play').tap();
    await expect(page.locator('#hud')).toBeVisible();
    await page.reload();
    await waitForGame(page);
    await expect(page.locator('#btn-play')).toHaveText('Pokračovat');
    await expect(page.locator('#menu-location')).toContainText('Poslední poloha');
    await expect(page.locator('#menu-objective')).toBeHidden();
  } finally { await context.close(); }
});
