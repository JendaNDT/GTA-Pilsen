import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
test('E23 – stébla v parku respektují cestu a mizí vysoko nad zemí @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (/shader.*error|error.*shader|validation error|invalid shader module/i.test(m.text()))
      errors.push(m.text());
  });
  await page.setViewportSize({ width: 480, height: 320 });
  await page.goto(gameUrl('/?debug&quality=medium&view=350&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(async () => {
    __freeze(true);
    const { world: w, chunks } = __game;
    let closest = Infinity,
      point;
    for (let x = -480; x <= 480; x += 16)
      for (let z = -480; z <= 480; z += 16) {
        const dist = x * x + z * z;
        if (dist >= closest || w.buildingAt(x, z) >= 0 || w.onRoad(x, z, 3)) continue;
        const polys = chunks.landIndex.polys[w.chunkIndex(x, z)] ?? [];
        if (polys.some((id) => [2, 3, 12].includes(w.l.cls[id]) && w.landContains(id, x, z))) {
          point = { x, z };
          closest = dist;
        }
      }
    const { x, z } = point,
      y = w.heightAt(x, z);
    const grass = chunks.grass;
    for (let i = 0; i < 40; i++) grass.update(x, z, y, 6);
    __view(x + 2, y + 1.1, z + 2, x, y + 0.15, z);
    __game.render();
    await __game.renderer.backend.device?.queue.onSubmittedWorkDone();
    const count = grass.mesh.geometry.instanceCount,
      p = grass.roots;
    let intrusion = false;
    for (let i = 0; i < count; i++)
      intrusion ||=
        w.onCarriageway(p.getX(i), p.getZ(i), p.getY(i), 0.29, 99) || w.buildingAt(p.getX(i), p.getZ(i)) >= 0;
    grass.update(x, z, y + 100, 1);
    return { count, intrusion, hidden: !grass.mesh.visible, radius: grass.radius };
  });
  expect(result.count).toBeGreaterThan(0);
  expect(result).toMatchObject({ intrusion: false, hidden: true, radius: 30 });
  expect(errors).toEqual([]);
});
