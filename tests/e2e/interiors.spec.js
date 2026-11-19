import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E24 – obsah místnosti za stejným oknem reaguje na změnu úhlu pohledu @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (/shader.*error|error.*shader|validation error|invalid shader module/i.test(m.text()))
      errors.push(m.text());
  });
  await page.setViewportSize({ width: 400, height: 280 });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/textures/facades/interiery.webp', async (route) => {
    // Pomalá odpověď atlasu má do hry dorazit i po dvanáctisekundovém limitu startu.
    await Promise.all([gate, new Promise(resolve => setTimeout(resolve, 13000))]);
    await route.continue();
  });
  try {
    await page.goto(gameUrl('/?debug&quality=medium&view=300&adapt=0&hour=10'));
    await page.waitForFunction(() => window.__ready);
    await page.evaluate(() => {
      __freeze(true);
      const g = __game;
      const src = [...g.chunks.chunks.values()].find((c) => c.regularBuildings)?.regularBuildings;
      const geo = new src.geometry.constructor();
      const Buf = src.geometry.getAttribute('position').constructor;
      const attr = (name, values, n) => geo.setAttribute(name, new Buf(new Float32Array(values), n));
      attr('position', [-2, 98, 0, 2, 98, 0, 2, 102, 0, -2, 102, 0], 3);
      attr('normal', Array(4).fill([0, 0, 1]).flat(), 3);
      attr('color', Array(4).fill([0.6, 0.5, 0.4]).flat(), 3);
      attr('buildingLayer', [0, 0, 0, 0], 1);
      attr('aSurface', Array(4).fill([0.84, 0]).flat(), 2);
      attr('aWin', [0, 1, 17, 1, 1, 17, 1, 2, 17, 0, 2, 17], 3);
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const mesh = new src.constructor(geo, g.chunks.paintedBuildings);
      g.scene.add(mesh);
      window.__sampleRoom = async (offset) => {
        __view(offset, 100.1, 4, 0, 100.1, 0);
        await new Promise(requestAnimationFrame);
        g.render();
        const target = g.postfx.scenePass.renderTarget;
        const bytes = await g.renderer.readRenderTargetPixelsAsync(
          target,
          Math.floor(target.width / 2) - 8,
          Math.floor(target.height / 2) - 8,
          16,
          16
        );
        const values = new Float16Array(bytes.buffer, bytes.byteOffset, bytes.length);
        return Array.from(values).filter((v, i) => i % 4 !== 3);
      };
    });
    const neutral = await page.evaluate(() => __sampleRoom(0));
    release();
    await page.waitForFunction(() =>
      performance.getEntriesByType('resource').some((r) => r.name.endsWith('/interiery.webp') && r.responseEnd)
    );
    const difference = (a, b) => a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
    let front;
    await expect
      .poll(
        async () => {
          front = await page.evaluate(() => __sampleRoom(0));
          return difference(neutral, front);
        },
        { timeout: 90000 }
      )
      .toBeGreaterThan(0.002);
    const side = await page.evaluate(() => __sampleRoom(2.8));
    expect(difference(front, side)).toBeGreaterThan(0.003);
    expect(errors).toEqual([]);
  } finally {
    release();
  }
});
