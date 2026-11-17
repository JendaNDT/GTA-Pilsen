import { expect, test } from '@playwright/test';
import { webgpuFlags } from './browser-flags.js';

test.use({
  launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: webgpuFlags },
});

test('E15 – hra ve výchozím nastavení spustí WebGPU', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) errors.push(message.text());
  });
  await page.goto('/?debug&adapt=0&date=2026-11-17&hour=10');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__game.renderer.backend.isWebGPUBackend)).toBe(true);
  await page.getByRole('button', { name: 'O hře', exact: true }).click();
  await expect(page.locator('#panel-about')).toContainText('Aktuální vykreslování: WebGPU');
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.waitForFunction(() => window.__perf.summary().frames >= 4);
  expect(errors).toEqual([]);
});
