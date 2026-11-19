import { expect, test } from '@playwright/test';
import { waitForGame } from './ready.js';
import { gameUrl } from './game-url.js';

test('E24 – vysoká předvolba přeprojektuje čtvrtinový obraz oblaků @webgpu', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (/invalid shader module|validation error|error.*shader|shader.*error/i.test(m.text())) errors.push(m.text());
  });
  await page.setViewportSize({width:400,height:280});
  await page.goto(gameUrl('/?debug&quality=high&view=300&adapt=0&weather=cloudy&hour=12'));
  await waitForGame(page);
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, cloud = g.env.clouds, cam = g.camera;
    __view(0,4,5,5,80,-30);
    g.render();
    const first = cloud.image.value;
    cam.position.x += 1; g.render();
    const reuse = cloud.weight.value;
    const image = cloud.image.value;
    await g.renderer.backend.device?.queue.onSubmittedWorkDone();
    const target = cloud.targets.find(t => t.texture === image);
    const data = await g.renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
    const populated = Array.from(data).some((x,i) => i % 4 === 3 && x > 0);
    cam.position.x += 100; g.render();
    const size = g.renderer.getDrawingBufferSize(cloud.size);
    return {reuse, swapped: first !== image, reset: cloud.weight.value, populated,
      dimensions: target.width === Math.ceil(size.x/4) && target.height === Math.ceil(size.y/4)};
  });
  expect(result.reuse).toBeGreaterThan(0);
  expect(result.reset).toBe(0);
  expect(result.populated && result.swapped && result.dimensions).toBe(true);
  expect(errors).toEqual([]);
});
