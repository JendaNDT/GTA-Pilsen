import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E24 – obloha na nízké předvolbě zachová výhled a nepřekreslí ulice @webgpu', async ({page}) => {
  await page.setViewportSize({width:400,height:280});
  // Pevné datum: poloha slunce a roční období stromů mění barvy oblohy i ulic.
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&weather=clear&date=2026-11-09&hour=10&view=340'));
  await waitForGame(page);
  const stats = await page.evaluate(async () => {
    const g = window.__game, renderer = g.renderer, sky = g.env.sky;
    window.__freeze(true);
    window.__view(-32,7,108,1,25,4);
    const target = new g.postfx.scenePass.renderTarget.constructor(320,200);
    const previous = renderer.getRenderTarget();
    const capture = async () => {
      renderer.setRenderTarget(target);
      renderer.render(g.scene,g.camera);
      return renderer.readRenderTargetPixelsAsync(target,0,0,320,200);
    };
    const order = sky.renderOrder, depthTest = sky.material.depthTest;
    try {
      const after = await capture();
      sky.renderOrder = -10;
      sky.material.depthTest = false;
      sky.material.needsUpdate = true;
      const before = await capture();
      let changed = 0;
      const colors = new Set();
      for (let i=0;i<before.length;i+=4) {
        colors.add(before[i]*65536+before[i+1]*256+before[i+2]);
        if (Math.max(...[0,1,2].map(c=>Math.abs(before[i+c]-after[i+c]))) > 4) changed++;
      }
      return {colors:colors.size, changed:changed/(320*200), order, depthTest};
    } finally {
      renderer.setRenderTarget(previous);
      sky.material.depthTest = depthTest;
      sky.renderOrder = order;
      sky.material.needsUpdate = true;
      target.dispose();
    }
  });
  expect(stats.depthTest).toBe(true);
  expect(stats.order).toBeGreaterThan(0);
  expect(stats.colors).toBeGreaterThan(32);
  expect(stats.changed).toBeLessThan(.005);
});
