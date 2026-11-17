import { expect, test } from '@playwright/test';
import { PCFShadowMap } from 'three/webgpu';

test('E15 – hra ukazuje vynucené vykreslování přes WebGL 2 v menu i v měření', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto('/?debug&quality=low&renderer=webgl');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'O hře', exact: true }).click();
  await expect(page.locator('#panel-about')).toContainText('Aktuální vykreslování: WebGL 2');
  expect(await page.evaluate(() => window.__game.renderer.backend.isWebGLBackend)).toBe(true);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.keyboard.press('F9');
  await expect(page.getByRole('textbox', { name: 'Výsledky měření výkonu' })).toHaveValue(/Vykreslování WebGL 2/);
});

test('E15 – hra bez WebGPU automaticky spustí WebGL 2', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/?debug&quality=low');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__game.renderer.backend.isWebGLBackend)).toBe(true);
  await page.getByRole('button', { name: 'O hře', exact: true }).click();
  await expect(page.locator('#panel-about')).toContainText('Aktuální vykreslování: WebGL 2');
});

test('E14 – start a minuta hraní ve dne i v noci bez varování vykreslovače', async ({ page }) => {
  test.setTimeout(150_000);
  const messages = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) messages.push(message.text());
  });
  page.on('pageerror', (error) => messages.push(error.message));
  await page.goto('/?debug&adapt=0&date=2026-11-17&hour=10&renderer=webgl');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  expect(messages).toEqual([]);
  expect(await page.evaluate(() => window.__game.renderer.shadowMap.type)).toBe(PCFShadowMap);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.keyboard.down('w');
  // Kritérium přijetí požaduje skutečnou minutu běžící hry, nelze ji nahradit kroky __step.
  await page.waitForTimeout(30_000);
  await page.keyboard.up('w');
  await page.evaluate(() => window.__setClock(null, 22));
  await page.waitForTimeout(30_000);
  expect(await page.evaluate(() => window.__perf.summary().frames)).toBeGreaterThan(30);
  expect(messages).toEqual([]);
});
