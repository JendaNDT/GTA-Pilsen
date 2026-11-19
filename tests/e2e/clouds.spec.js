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
    const opaque = data instanceof Uint16Array ? 0x3c00 : 1;
    let partial = 0;
    for (let i=3; i<data.length; i+=4) {
      if (data[i] > 0 && data[i] < opaque) partial++;
    }
    // Pod horizontem musí zůstat celá vrstva průhledná.
    __view(101,100,5,101,0,5);
    g.render();
    const groundTarget = cloud.targets.find(t=>t.texture===cloud.image.value);
    const below = await g.renderer.readRenderTargetPixelsAsync(groundTarget,0,0,groundTarget.width,groundTarget.height);
    let belowClouds = 0;
    for (let i=3; i<below.length; i+=4) if (below[i] !== 0) belowClouds++;
    cam.position.x += 100; g.render();
    const size = g.renderer.getDrawingBufferSize(cloud.size);
    const reset = cloud.weight.value, frame = cloud.frame;
    g.setWeatherMode('clear');
    g.render();
    const bypass = !cloud.enabled.value && !cloud.valid && cloud.frame === frame;
    g.setWeatherMode('variable');
    g.render();
    const resumed = cloud.enabled.value && cloud.frame === frame + 1 && cloud.weight.value === 0;
    return {reuse, swapped: first !== image, reset, partial, belowClouds, bypass, resumed,
      dimensions: target.width === Math.ceil(size.x/4) && target.height === Math.ceil(size.y/4)};
  });
  expect(result.reuse).toBeGreaterThan(0);
  expect(result.reset).toBe(0);
  expect(result.bypass && result.resumed).toBe(true);
  expect(result.partial).toBeGreaterThan(0);
  expect(result.belowClouds).toBe(0);
  expect(result.swapped && result.dimensions).toBe(true);
  expect(errors).toEqual([]);
});
