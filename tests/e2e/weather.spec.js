import { waitForGame } from './ready.js';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E24 – zimní povrch a uložení nastavení Vždy jasno @webgpu', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 280 });
  await page.goto(gameUrl('/?debug&quality=low&view=300&adapt=0&date=2027-01-15&weather=snow'));
  await waitForGame(page);
  const grip = () => page.evaluate(() => __game.tireSurface(0, 0));
  expect(await grip()).toBeCloseTo(.9 * .35);
  await page.evaluate(() => {
    const setting = document.getElementById('weather-mode');
    setting.value = 'clear';
    setting.dispatchEvent(new Event('change'));
  });
  expect(await grip()).toBeCloseTo(.9);
  await page.reload();
  await waitForGame(page);
  expect(await page.locator('#weather-mode').inputValue()).toBe('clear');
  expect(await grip()).toBeCloseTo(.9);
});
