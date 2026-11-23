import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

const state = (page) => page.evaluate(() => ({
  fullscreen: Boolean(document.fullscreenElement),
  pressed: document.getElementById('btn-fullscreen').getAttribute('aria-pressed'),
  saved: JSON.parse(localStorage.getItem('plzen-naplno-v1') || 'null')?.fullscreenEnabled,
}));

test('po kliknutí na Hrát běží hra přes celou obrazovku a tlačítko ⛶ ji přepíná', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // starší uložená hra bez volby celé obrazovky
  await page.addInitScript(() => {
    if (!localStorage.getItem('plzen-naplno-v1')) {
      localStorage.setItem('plzen-naplno-v1', JSON.stringify({ v: 2, money: 640, hour: 10 }));
    }
  });
  await page.goto(gameUrl('/?debug&adapt=0&quality=low&view=350&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  await expect(page.locator('#fullscreen-play')).toBeChecked();
  await page.locator('#btn-play').click();
  await expect.poll(async () => (await state(page)).fullscreen).toBe(true);
  expect((await state(page)).pressed).toBe('true');
  await page.locator('#btn-fullscreen').click();
  await expect.poll(async () => (await state(page)).fullscreen).toBe(false);
  expect((await state(page)).pressed).toBe('false');
  await page.locator('#btn-fullscreen').click();
  await expect.poll(async () => (await state(page)).fullscreen).toBe(true);
  // uložená hra se načetla (u katedrály hráč hned objeví první památku a dostane odměnu)
  const loaded = await page.evaluate(() => ({ save: window.__game.hasSave, money: window.__game.money }));
  expect(loaded.save).toBe(true);
  expect(loaded.money).toBeGreaterThanOrEqual(640);
  expect(errors).toEqual([]);
});

test('vypnutá volba v nastavení se uloží a Hrát pak celou obrazovku nezapne', async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low&view=350&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.locator('#fullscreen-play').uncheck();
  expect((await state(page)).saved).toBe(false);
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await expect(page.locator('#fullscreen-play')).not.toBeChecked();
  await page.locator('#btn-play').click();
  await page.waitForTimeout(500);
  expect((await state(page)).fullscreen).toBe(false);
});
