import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E25 – v pilotním úseku Americké se vykreslí jediná přízemní vrstva @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (/invalid shader module|validation error|error.*shader|shader.*error/i.test(m.text())) errors.push(m.text());
  });
  await page.setViewportSize({width:480,height:320});
  await page.goto(gameUrl('/?debug&quality=medium&view=340&adapt=0&hour=10'));
  await waitForGame(page);
  const observed = await page.evaluate(async () => {
    const g = __game;
    __freeze(true);
    g.player.place(118,458);
    const heritage = g.chunks.heritage;
    const start = performance.now();
    for (;;) {
      g.chunks.update(118,458,340,40,g.player.y);
      const section = [...g.chunks.chunks.values()].find(ch =>
        ch.heritage?.base.some(mesh => mesh.geometry.hasAttribute('aStreet')));
      if (section) {
        heritage.update(section.heritage,118,458,g.player.y);
        const facade = section.heritage.base.find(mesh => mesh.geometry.hasAttribute('aStreet'));
        __view(124,g.player.y+1.7,453,129,g.player.y+2,438);
        g.render();
        await g.renderer.backend.device?.queue.onSubmittedWorkDone();
        return {material:facade.material === heritage.streetClose,
          measured:facade.geometry.getAttribute('aStreet').array.some((v,i) => i%4 === 2 && v > 0)};
      }
      if (performance.now()-start > 120000) throw Error('Chybí detail pilotu na Americké.');
      await new Promise(resolve => setTimeout(resolve,10));
    }
  });
  expect(observed).toEqual({material:true, measured:true});
  expect(errors).toEqual([]);
});
