import { expect, test } from '@playwright/test';
import { openReferenceGame, reference, renderReferenceView } from '../../tools/reference_views.mjs';
import { gameUrl } from './game-url.js';

test.use({ viewport: reference.viewport, deviceScaleFactor: 1 });

test('E15 – všech osm referenčních pohledů se vykreslí bez chyb', { tag: '@webgpu' }, async ({ page, baseURL }, info) => {
  test.setTimeout(Math.max(info.timeout, 180_000));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  // Snímky se porovnávají s nástrojem tools/reference_views.mjs, proto stejné počasí podle pevného data.
  await openReferenceGame(page, gameUrl(baseURL, { weather: null }));
  expect(await page.evaluate(() => window.__game.renderer.backend.isWebGPUBackend === true))
    .toBe(info.project.name === 'webgpu');
  const stats = {};
  for (const view of reference.views) {
    await test.step(view.name, async () => {
      stats[view.id] = await renderReferenceView(page, view);
      expect(stats[view.id].calls).toBeGreaterThan(0);
      expect(stats[view.id].triangles).toBeGreaterThan(0);
    });
  }
  await info.attach('počty ve všech referenčních pohledech', {
    body: JSON.stringify(stats, null, 2), contentType: 'application/json',
  });
  expect(errors).toEqual([]);
});
