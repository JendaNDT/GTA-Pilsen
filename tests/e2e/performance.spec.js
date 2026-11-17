import { expect, test } from '@playwright/test';

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
  expect(await page.evaluate(() => {
    window.__perf.reset();
    return window.__perf.summary().frames;
  })).toBe(0);
});
