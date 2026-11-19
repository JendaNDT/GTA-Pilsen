import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';
test('E23 – kola zvednou prach a vodu ve společném rozpočtu částic @webgpu', async ({ page }, info) => {
  await page.goto(gameUrl('/?debug&quality=medium&view=300&adapt=0&wet=1'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(async () => {
    __freeze(true);
    const p = __game.particles,
      { x, y, z } = __game.focus;
    const car = { x, y, z, air: false, health: 100, speed: 9, yaw: 0, type: { len: 4, wid: 2 } };
    p.weirs = [];
    p.wheelSurface = (px) => (px < x ? 'dust' : 'spray');
    const start = p.cursor;
    p.update(0.14, [car], car, true);
    const emitted = p.cursor - start;
    const i = start % p.limit(),
      expected = p.origin.slice(i * 4, i * 4 + 3);
    car.air = true;
    p.update(0.16, [car], car, true);
    let values;
    if (p.compute) {
      const buffer = await __game.renderer.getArrayBufferAsync(p.output.value);
      values = new Float32Array(buffer);
    } else values = p.state.array;
    const age = 0.16;
    const finalX = expected[0] + p.velocity[i * 4] * age + p.shape[i * 4 + 2] * age * age;
    return {
      emitted,
      noAir: p.cursor === start + emitted,
      positive: values[i * 4 + 3] > 0,
      driftError: Math.abs(values[i * 4] - finalX),
      count: p.mesh.geometry.instanceCount,
      limit: p.limit(),
      gpu: !!p.compute
    };
  });
  expect(result.emitted).toBeGreaterThanOrEqual(2);
  expect(result).toMatchObject({ noAir: true, positive: true, gpu: info.project.name === 'webgpu' });
  expect(result.driftError).toBeLessThan(0.001);
  expect(result.count).toBeLessThanOrEqual(result.limit);
});
