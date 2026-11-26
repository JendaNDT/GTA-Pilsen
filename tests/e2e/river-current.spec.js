import { expect, test } from '@playwright/test';
import { openReferenceGame, renderReferenceView } from '../../tools/reference_views.mjs';
import { gameUrl } from './game-url.js';

test.use({ viewport: { width: 640, height: 420 }, deviceScaleFactor: 1 });

test('E51 – pěnové stopy na nízkou kvalitu tečou po Radbuze a na Boleváku nemají směr proudu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openReferenceGame(page, gameUrl('/?quality=low&exposure=0'));
  const river = await measure({ name: 'Radbuza shora', focus: [201, 490],
    camera: [201, 12.75, 490.10], target: [201, -12.25, 490], hour: 10 });
  const pond = await measure({ name: 'Bolevák shora', focus: [1395, -3190],
    camera: [1395, 23.2, -3189.9], target: [1395, -1.8, -3190], hour: 10 });
  expect(river.downstream, JSON.stringify(river)).toBeGreaterThan(0.50);
  expect(river.downstream - Math.max(river.still, river.upstream), JSON.stringify(river)).toBeGreaterThan(0.12);
  expect(pond.downstream - pond.still, JSON.stringify(pond)).toBeLessThan(0.07);
  expect(river.contrast, JSON.stringify({ river, pond })).toBeGreaterThan(2 * pond.contrast);
  expect(errors).toEqual([]);

  async function measure(view) {
    await renderReferenceView(page, view);
    return page.evaluate(async ({ camera, target }) => {
      const g = window.__game;
      const { renderer } = g;
      const width = 352, height = 304;
      const Target = g.postfx.scenePass.renderTarget.constructor;
      const output = new Target(renderer.domElement.width, renderer.domElement.height);
      const previous = renderer.getRenderTarget();
      const wasVisible = g.player.mesh.visible;
      g.player.mesh.visible = false;
      g.paused = false;
      const capture = async (time) => {
        g.time = time;
        g.update(0);
        window.__view(...camera, ...target);
        renderer.setRenderTarget(output);
        g.render();
        const rgba = await renderer.readRenderTargetPixelsAsync(output, 144, 58, width, height);
        renderer.setRenderTarget(previous);
        const light = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
          const row = renderer.backend.isWebGPUBackend ? y : height - y - 1;
          for (let x = 0; x < width; x++) {
            const i = (row * width + x) * 4;
            light[y * width + x] = 0.21 * rgba[i] + 0.72 * rgba[i + 1] + 0.07 * rgba[i + 2];
          }
        }
        return light;
      };
      try {
        const first = await capture(1);
        const second = await capture(2);
        // Při pohledu shora odpovídá mírnému posunu vpravo a nahoru směr Radbuzy v tomto úseku.
        const similarity = (dx, dy) => {
          let product = 0, squareA = 0, squareB = 0;
          for (let y = 27; y < 277; y += 3) for (let x = 26; x < 326; x += 3) {
            const i = y * width + x, j = (y + dy) * width + x + dx;
            const a = first[i + 5] - first[i - 5], b = second[j + 5] - second[j - 5];
            product += a * b;
            squareA += a * a;
            squareB += b * b;
          }
          return { score: product / Math.sqrt(squareA * squareB), contrast: Math.sqrt(squareA) };
        };
        const downstream = similarity(4, -15);
        return { downstream: downstream.score, contrast: downstream.contrast,
          still: similarity(0, 0).score, upstream: similarity(-4, 15).score };
      } finally {
        renderer.setRenderTarget(previous);
        output.dispose();
        g.player.mesh.visible = wasVisible;
        g.paused = true;
      }
    }, view);
  }
});
