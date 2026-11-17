import { devices, expect, test } from '@playwright/test';

test('E13 – měření práce snímku s pevnou kvalitou vykreslování', async ({ page }) => {
  await page.goto('/?debug&adapt=0&quality=low');
  await page.waitForFunction(() => window.__ready);
  expect(await page.evaluate(() => window.__perf.summary().frames)).toBe(0);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.waitForFunction(() => window.__perf.summary().frames >= 4);
  const { before, after } = await page.evaluate(() => {
    const before = window.__perf.summary();
    for (let i = 0; i < 120; i++) window.__game.adapt(0.05);
    const after = window.__perf.summary();
    return { before, after };
  });
  expect(after.pixelRatio).toBe(before.pixelRatio);
  expect(after.shadows).toBe(before.shadows);
  expect(after.workMs.p99).toBeGreaterThan(0);
  expect(after.workMs.p99).toBeGreaterThanOrEqual(after.updateMs.p99);
  expect(after.workMs.p99).toBeGreaterThanOrEqual(after.renderMs.p99);
  expect(after.renderStats.calls).toBeGreaterThan(0);
  expect(after.renderStats.triangles).toBeGreaterThan(0);
  expect(after.renderStats.geometries).toBeGreaterThan(0);
  expect(after.renderStats.textures).toBeGreaterThan(0);
  await page.keyboard.press('F9');
  const panel = page.getByRole('region', { name: 'Měření výkonu' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('textbox')).toHaveValue(/Práce snímku — .* ms/);
  await page.keyboard.press('F9');
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => {
    window.__perf.reset();
    return window.__perf.summary().frames;
  })).toBe(0);
});

test('E13 – panel měření lze otevřít a zavřít na dotykové obrazovce', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 }, baseURL });
  try {
    const page = await context.newPage();
    await page.goto('/?debug&adapt=0');
    await page.waitForFunction(() => window.__ready);
    await page.getByRole('button', { name: 'Hrát', exact: true }).tap();
    await page.getByRole('button', { name: 'Měření', exact: true }).tap();
    const panel = page.getByRole('region', { name: 'Měření výkonu' });
    await expect(panel.getByRole('textbox')).toHaveValue(/stíny vypnuté/);
    await panel.getByRole('button', { name: 'Začít znovu' }).tap();
    await expect(panel.getByText(/Změřeno \d+ z 60 sekund/)).toBeVisible();
    await panel.getByRole('button', { name: 'Zavřít měření' }).tap();
    await expect(panel).toBeHidden();
  } finally {
    await context.close();
  }
});
