import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E21 – střepy se pohnou a zaniknou na aktivním vykreslovači @webgpu', async ({page}, info) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, p = g.particles;
    const {x, y, z} = g.focus;
    const i = p.cursor % p.limit();
    p.emit('glass', x, y + 3, z, 3);
    const sample = async () => {
      g.render();
      if (p.compute) {
        const bytes = await g.renderer.getArrayBufferAsync(p.output.value);
        return Array.from(new Float32Array(bytes).subarray(i * 4, i * 4 + 4));
      }
      return Array.from(p.state.array.subarray(i * 4, i * 4 + 4));
    };
    p.update(0, [], g.focus);
    const first = await sample();
    p.update(0.1, [], g.focus);
    const second = await sample();
    p.update(2, [], g.focus);
    return { first, second, gpu: Boolean(p.compute), expired: !p.mesh.visible, x, y, z };
  });
  expect(result.gpu).toBe(info.project.name === 'webgpu');
  expect(result.expired).toBe(true);
  expect(result.first[0]).toBeCloseTo(result.x, 2);
  expect(result.first[1]).toBeCloseTo(result.y + 3, 2);
  expect(result.second[1]).toBeGreaterThan(result.first[1]);
  expect(result.second[3]).toBeGreaterThan(0);
  expect(result.second[3]).toBeLessThan(result.first[3]);
});
