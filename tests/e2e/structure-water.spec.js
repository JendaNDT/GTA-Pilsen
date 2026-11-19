import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E22 – čtyři měřené díly jezů se vykreslí u hladiny @webgpu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const samples = await page.evaluate(async () => {
    const { world, chunks } = __game;
    const result = [];
    for (const [ci, tile] of world.structures.tiles) {
      const parts = tile.objects.filter((o) => o.role === 'weir');
      if (!parts.length) continue;
      const first = parts[0].start * 3,
        coarse = world.structures.positions;
      const x = coarse[first],
        z = coarse[first + 2];
      let item;
      do {
        chunks.update(x, z, 300, 20, world.heightAt(x, z) + 6);
        item = chunks.chunks.get(ci)?.structure;
        if (item && item.mesh.geometry !== item.core) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      } while (true);
      const vertices = item.mesh.geometry.getAttribute('position');
      for (const part of parts) {
        let max = -Infinity,
          min = Infinity,
          wet = false;
        for (let i = part.dStart; i < part.dStart + part.dCount; i++) {
          const vx = vertices.getX(i),
            vz = vertices.getZ(i);
          const above = vertices.getY(i) - world.heightAt(vx, vz);
          max = Math.max(max, above);
          min = Math.min(min, above);
          wet ||= world.isWater(vx, vz);
        }
        result.push({ id: part.id, wet, min, max, visible: item.mesh.visible && !!item.mesh.parent });
      }
    }
    return result;
  });
  expect(new Set(samples.map((p) => p.id)).size).toBe(4);
  for (const sample of samples) {
    expect(sample.visible).toBe(true);
    expect(sample.wet).toBe(true);
    expect(sample.min).toBeLessThan(-0.5);
    expect(sample.max).toBeGreaterThan(0.25);
  }
});
