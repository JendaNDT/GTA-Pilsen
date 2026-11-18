import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

for (const quality of ['ultra', 'high', 'medium', 'low']) {
  test(`E17 – předvolba ${quality} vyhladí čerstvý obraz hry`, { tag: '@webgpu' }, async ({ page, baseURL }) => {
    const url = new URL(gameUrl(baseURL));
    url.searchParams.set('debug', '');
    url.searchParams.set('quality', quality);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url.href);
    await page.waitForFunction(() => window.__ready);
    const frame = await page.evaluate(() => {
      const { __game: game } = window;
      const { renderer, postfx } = game;
      const supportsTargets = renderer.backend.isWebGPUBackend ? !renderer.backend.compatibilityMode
        : Boolean(renderer.backend.getContext().getExtension('OES_draw_buffers_indexed'));
      const calls = [0, 1].map(() => {
        game.render();
        return window.__perf.renderStats().calls;
      });
      const target = postfx.scenePass.renderTarget;
      const aoTexture = postfx.ambientOcclusion?.getTextureNode().value;
      const ambient = aoTexture ? [aoTexture.image.width, aoTexture.image.height] : null;
      return { method: postfx.antialias, calls, supportsTargets, ambient, size: [target.width, target.height],
        textures: target.textures.map(({ name }) => name), depth: Boolean(target.depthTexture) };
    });
    const temporal = ['ultra', 'high'].includes(quality) && frame.supportsTargets;
    expect(frame.method).toBe(temporal ? 'traa' : quality === 'low' ? 'fxaa' : 'smaa');
    expect(frame.textures).toEqual(temporal ? ['output', 'normal', 'velocity'] : ['output']);
    expect(frame.ambient).toEqual(temporal ? frame.size.map((size) => Math.round(size * 0.5)) : null);
    expect(frame.depth).toBe(true);
    expect(frame.calls[0]).toBeGreaterThan(10);
    expect(frame.calls[1]).toBeGreaterThan(10);
    expect(errors).toEqual([]);
  });
}

test('E17 – pohyb dveří tramvaje se propíše do obrazu pro TRAA', { tag: ['@webgpu', '@jen-webgpu'] }, async ({ page, baseURL }) => {
  const url = new URL(gameUrl(baseURL));
  url.searchParams.set('debug', '');
  url.searchParams.set('quality', 'high');
  url.searchParams.set('shadows', '0');
  url.searchParams.set('date', '2026-11-09');
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(async () => {
    const { __game: game } = window;
    const event = game.transit.timetable.events(game.clock.day).find(({ trip }) => trip.id === '686547');
    const index = event.trip.stops.findIndex(({ target }) => target[1] === 'Náměstí Republiky');
    const group = game.transit.takeShift(event, index).meshes[0];
    const { mesh, centers } = group.userData.doors;
    const point = group.localToWorld(group.position.clone().set(-1.26, 1.5, centers[0]));
    const camera = group.localToWorld(group.position.clone().set(-4, 1.5, centers[0]));
    window.__view(...camera.toArray(), ...point.toArray());
    const target = game.postfx.scenePass.renderTarget;
    const velocityIndex = target.textures.findIndex(({ name }) => name === 'velocity');
    const movingPixels = async () => {
      const samples = await game.renderer.readRenderTargetPixelsAsync(target,
        Math.floor(target.width / 2) - 96, Math.floor(target.height / 2) - 64, 192, 128, velocityIndex);
      const values = new Float16Array(samples.buffer, samples.byteOffset, samples.length);
      let count = 0;
      for (let i = 0; i < values.length; i += 4) {
        // Zanedbej zaokrouhlení a chvění pod dvěma pixely.
        if (Math.abs(values[i]) >= 0.004 || Math.abs(values[i + 1]) >= 0.007) count++;
      }
      return count;
    };
    await new Promise(requestAnimationFrame);
    game.render();
    await new Promise(requestAnimationFrame);
    game.render();
    const still = await movingPixels();
    mesh.instanceMatrix.array[14] += 0.45;
    mesh.instanceMatrix.needsUpdate = true;
    await new Promise(requestAnimationFrame);
    game.render();
    const moving = await movingPixels();
    return { still, moving };
  });
  expect(result.moving).toBeGreaterThan(result.still + 15);
});
