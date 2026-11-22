import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E23 – les u Dobříva střídá modely a vzdálené pohledy a zachová kolize v zimě @webgpu', async ({
  page
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (/shader.*error|error.*shader|validation error|invalid shader module/i.test(m.text()))
      errors.push(m.text());
  });
  await page.setViewportSize({ width: 480, height: 320 });
  await page.goto(gameUrl('/?debug&quality=medium&view=420&adapt=0&date=2026-10-20'));
  await page.waitForFunction(() => window.__ready);
  const sample = await page.evaluate(async () => {
    __freeze(true);
    const g = __game,
      w = g.world;
    let selected,
      closest = Infinity;
    for (const [ci, polys] of g.chunks.landIndex.polys.entries()) {
      if (!polys?.some((id) => w.l.cls[id] === 10)) continue;
      const x = w.minX + ((ci % w.cols) + 0.5) * 256,
        z = w.minZ + (Math.floor(ci / w.cols) + 0.5) * 256;
      const d = Math.hypot(x - 26000, z - 4300);
      if (d < closest && w.isForest(x, z)) {
        selected = { ci, x, z };
        closest = d;
      }
    }
    const { ci, x, z } = selected;
    for (let i = 0; i < 12; i++) g.chunks.update(x, z, 420, 36);
    const tile = g.chunks.chunks.get(ci);
    const far = tile.vegetation.meshes.at(-1);
    // Počkáme na přenos atlasu před kontrolou vzdáleného lesa.
    for (let i = 0; i < 100; i++) {
      tile.vegetation.update(x + 430, z, 430);
      if (far.visible) break;
      await new Promise((r) => setTimeout(r, 40));
    }
    const distant = far.geometry.instanceCount;
    tile.vegetation.update(x, z, 0);
    const near = tile.vegetation.meshes.slice(0, -1).reduce((n, m) => n + m.count, 0);
    const closeFar = far.geometry.instanceCount;
    const original = tile.obstacles.slice();
    __view(x + 28, w.heightAt(x, z) + 23, z + 15, x, w.heightAt(x, z) + 3, z);
    __setClock('2027-01-15', 11);
    g.render();
    await g.renderer.backend.device?.queue.onSubmittedWorkDone();
    return {
      distant,
      near,
      closeFar,
      matched: original.length > 0 && original.every((v, i) => tile.obstacles[i] === v),
      tags: w.treeTypes.size,
      faces: far.geometry.index.count / 3
    };
  });
  expect(sample.near).toBeGreaterThan(0);
  expect(sample.distant).toBe(sample.closeFar + sample.near);
  expect(sample.faces).toBe(2);
  expect(sample.matched).toBe(true);
  expect(sample.tags).toBeGreaterThan(6000);
  expect(errors).toEqual([]);
});
