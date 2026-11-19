import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

for (const quality of ['medium', 'ultra']) {
  test(`E23 – proud, pěna a odrazy u nejbližšího jezu (${quality}) @webgpu`, async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 320 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (
        /shader.*error|error.*shader|validation error|invalid shader module|is not a function/i.test(m.text())
      )
        errors.push(m.text());
    });
    await page.goto(gameUrl('/?debug&adapt=0&view=350&quality=' + quality));
    await page.waitForFunction(() => window.__ready);
    const result = await page.evaluate(async () => {
      __freeze(true);
      const g = __game;
      const [x, z] = [...g.soundPlaces].sort((a, b) => Math.hypot(...a) - Math.hypot(...b))[0];
      const y = g.world.heightAt(x, z);
      const ci = g.world.chunkIndex(x, z);
      for (let i = 0; i < 10; i++) g.chunks.update(x, z, 300, 20, y + 5);
      const field = g.chunks.chunks.get(ci).terrainMat.waterField.image.data;
      __view(x + 8, y + 7, z + 6, x, y, z);
      const before = g.particles.cursor;
      g.particles.update(0.16, [], { x, z }, true);
      g.render();
      await g.renderer.backend.device?.queue.onSubmittedWorkDone();
      const supportsMRT = !!g.postfx?.velocity;
      let reflectivePixels = null;
      if (g.postfx?.waterReflection && g.renderer.backend.isWebGPUBackend) {
        const target = g.postfx.scenePass.renderTarget;
        const index = target.textures.findIndex(t => t.name === 'velocity');
        const bytes = await g.renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height, index);
        const values = new Float16Array(bytes.buffer, bytes.byteOffset, bytes.length);
        reflectivePixels = 0;
        for (let i = 2; i < values.length; i += 4) if (values[i] > 0.5) reflectivePixels++;
      }
      return {
        reflectivePixels, flow: field.some((v, i) => i % 4 < 2 && v !== 128),
        foam: field.some((v, i) => i % 4 === 3 && v > 0),
        spray: g.particles.cursor > before,
        sky: !!g.scene.environment,
        ssr: !!g.postfx?.waterReflection,
        supportsMRT
      };
    });
    expect(result).toMatchObject({
      flow: true,
      foam: true,
      spray: true,
      sky: true,
      ssr: quality === 'ultra' && result.supportsMRT
    });
    if (result.reflectivePixels !== null) expect(result.reflectivePixels).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });
}
