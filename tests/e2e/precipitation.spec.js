import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E24 – déšť na náměstí v 18:09 a lednové vločky používají jeden buffer @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (/invalid shader module|validation error|error.*shader|shader.*error/i.test(m.text())) errors.push(m.text());
  });
  await page.setViewportSize({width:400,height:280});
  await page.goto(gameUrl('/?debug&quality=medium&view=300&adapt=0&weather=rain'));
  await waitForGame(page);
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game;
    const fx = g.precipitation, geo = fx.mesh.geometry;
    const draw = async () => {
      g.render();
      await g.renderer.backend.device?.queue.onSubmittedWorkDone();
      return { on: fx.mesh.visible, count: geo.instanceCount, flakes: fx.flakes.value, wet: g.weather.wet, snow: g.weather.snow };
    };
    __setClock('2026-11-17', 18 + 9 / 60);
    __view(-32,7,108,1,25,4);
    const rain = await draw();
    g.weather = new g.weather.constructor('snow');
    __setClock('2027-01-15', 11);
    const snow = await draw();
    g.setWeatherMode('clear');
    const clear = await draw();
    return {rain, snow, clear, same: fx.mesh.geometry === geo};
  });
  expect(result.rain.on && result.snow.on && result.same).toBe(true);
  expect(result.rain.count).toBeGreaterThan(0);
  expect(result.snow.flakes).toBe(1);
  expect(result.rain.wet).toBe(1);
  expect(result.snow.snow).toBe(1);
  expect(result.clear.on).toBe(false);
  expect(errors).toEqual([]);
});
