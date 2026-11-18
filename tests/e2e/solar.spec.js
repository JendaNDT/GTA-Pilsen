import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E17 – hra rozloží světlo z oblohy a po západu svítí měsíc', { tag: '@webgpu' }, async ({ page, baseURL }) => {
  const address = new URL(gameUrl(baseURL));
  address.searchParams.set('debug', '');
  address.searchParams.set('quality', 'low');
  address.searchParams.set('date', '2026-10-19');
  address.searchParams.set('hour', 10);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(address.href);
  await page.waitForFunction(() => window.__ready);

  const result = await page.evaluate(() => {
    const { __game: game, __setClock: setClock } = window;
    const { env, scene } = game;
    const ready = Boolean(scene.environment);
    const minute = env.skyLight.lastMinute;
    setClock('2026-10-19', 10 + 2 / 60);
    game.render();
    const firstMinute = env.skyLight.lastMinute;
    const resting = env.skyLight.face;
    setClock('2026-10-19', 10 + 12 / 60);
    const states = [];
    for (let i = 0; i < 7; i++) {
      game.render();
      states.push(env.skyLight.lastMinute !== minute);
    }
    setClock('2026-10-19', 18 + 9 / 60);
    const dusk = env.day;
    setClock('2026-10-19', 22);
    return { ready, states, minute, firstMinute, resting, dusk,
      sky: env.sky.isSkyMesh, sun: env.sun.intensity, moon: env.moon.intensity };
  });

  expect(result.sky).toBe(true);
  expect(result.ready).toBe(true);
  expect(result.states).toEqual([false, false, false, false, false, false, true]);
  expect(result.firstMinute).toBe(result.minute);
  expect(result.resting).toBe(-1);
  expect(result.dusk).toBeGreaterThan(0.12);
  expect(result.dusk).toBeLessThan(0.75);
  expect(result.sun).toBe(0);
  expect(result.moon).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});
