import { expect, test } from '@playwright/test';
import { PCFShadowMap } from 'three';

test('E14 – start a minuta hraní ve dne i v noci bez varování vykreslovače', async ({ page }) => {
  test.setTimeout(150_000);
  const messages = [];
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type())) messages.push(message.text());
  });
  page.on('pageerror', (error) => messages.push(error.message));
  await page.goto('/?debug&adapt=0&date=2026-11-17&hour=10');
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
