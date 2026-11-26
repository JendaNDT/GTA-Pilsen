import { devices, expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E13 – měření práce snímku s pevnou kvalitou vykreslování', async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await waitForGame(page);
  expect(await page.evaluate(() => window.__perf.summary().frames)).toBe(0);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.waitForFunction(() => window.__perf.summary().frames >= 4);
  if (await page.evaluate(() => Boolean(window.__game.renderer.backend.disjoint))) {
    await page.waitForFunction(() => window.__perf.summary().gpuSamples > 0);
    expect(await page.evaluate(() => window.__perf.summary().gpuMs.median)).toBeGreaterThan(0);
  }
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
    await page.goto(gameUrl('/?debug&adapt=0'));
    await waitForGame(page);
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

for (const quality of ['medium', 'low']) {
  const description = quality === 'medium' ? 'stejný terén sdílí data mezi samostatnými atributy'
    : 'nízká předvolba ořezává terén každé dlaždice v samostatných datech';

  test(description, async ({ page }) => {
    await page.goto(gameUrl(`/?debug&quality=${quality}&adapt=0`));
    await waitForGame(page);
    const result = await page.evaluate(() => {
      const { chunks } = window.__game;
      const meshes = [...chunks.chunks.values()].flatMap(tile =>
        tile.group.children.filter(mesh => mesh.material === tile.terrainMat && mesh.geometry?.index));
      const groups = Map.groupBy(meshes, mesh => mesh.geometry.index.count);
      const regular = [...groups.values()].reduce((best, items) => items.length > best.length ? items : best, []);
      const attributes = regular.map(mesh => mesh.geometry.index);
      return { tiles: regular.length, unique: new Set(attributes).size,
        arrays: new Set(attributes.map(attr => attr.array)).size };
    });
    expect(result.tiles).toBeGreaterThan(1);
    expect(result.unique).toBe(result.tiles);
    expect(result.arrays).toBe(quality === 'medium' ? 1 : result.tiles);
  });
}
