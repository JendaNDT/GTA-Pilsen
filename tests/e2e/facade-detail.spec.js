import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
test('E24 – detailní povrchy budov se načtou a vykreslí na střední předvolbě @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (/shader.*error|error.*shader|validation error|invalid shader module|GL_INVALID_OPERATION/i.test(m.text()))
      errors.push(m.text());
  });
  await page.setViewportSize({ width: 480, height: 320 });
  // Pevné datum: déšť nebo sníh podle dne přidávají do snímku další efekty.
  await page.goto(gameUrl('/?debug&quality=medium&view=350&date=2026-11-09&hour=10&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await page.waitForFunction(
    () =>
      performance
        .getEntriesByType('resource')
        .filter((r) => /\/textures\/facades\/(barva|povrch)\.webp/.test(r.name) && r.responseEnd).length === 2
  );
  const data = await page.evaluate(async () => {
    const g = __game;
    __freeze(true);
    const map = g.world.buildingMaterials;
    const ch = [...g.chunks.chunks.values()].find((ch) =>
      ch.regularBuildings?.geometry.getAttribute('buildingLayer')
    );
    const geo = ch.regularBuildings.geometry,
      layer = geo.getAttribute('buildingLayer');
    const p = geo.getAttribute('position'),
      n = geo.getAttribute('normal');
    const idx = Array.from(layer.array).findIndex((v, i) => v < 7 && Math.abs(n.getY(i)) < 0.3);
    __view(
      p.getX(idx) + n.getX(idx) * 6,
      p.getY(idx) + 1.5,
      p.getZ(idx) + n.getZ(idx) * 6,
      p.getX(idx),
      p.getY(idx) + 1.5,
      p.getZ(idx)
    );
    for (let i = 0; i < 4; i++) {
      await new Promise(requestAnimationFrame);
      g.render();
    }
    await g.renderer.backend.device?.queue.onSubmittedWorkDone();
    return {
      tagged: map.size,
      positions: p.count,
      layers: layer.count,
      roof: layer.array.some((v) => v >= 7),
      normal: !!g.chunks.paintedBuildings.normalNode
    };
  });
  expect(data.tagged).toBeGreaterThan(0);
  expect(data.positions).toBe(data.layers);
  expect(data).toMatchObject({ roof: true, normal: true });
  expect(errors).toEqual([]);
});
