import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E17 – volba v nastavení přepne grafiku ve stejné hře a uloží ji', { tag: '@webgpu' }, async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('plzen-naplno-v1')) {
      localStorage.setItem('plzen-naplno-v1', JSON.stringify({ v: 1, money: 771, hour: 10 }));
    }
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(gameUrl('/?debug&adapt=0&view=620&quality=high'));
  await page.waitForFunction(() => window.__ready);
  await page.evaluate(() => { window.originalGame = window.__game; });
  await page.getByRole('button', { name: 'Nastavení' }).click();
  await page.getByLabel('Kvalita grafiky').selectOption('low');
  await page.waitForFunction(() => !window.__game.graphicsBusy);
  await expect(page.getByLabel('Kvalita grafiky')).toBeEnabled();
  await expect(page.getByLabel('Kvalita grafiky')).toHaveValue('low');
  expect(await page.evaluate(() => {
    const { __game: game } = window;
    const saved = JSON.parse(localStorage.getItem('plzen-naplno-v1'));
    return [game === window.originalGame, game.money, game.postfx.antialias, Boolean(game.env.csm),
      saved.graphics.choice, game.renderer.getPixelRatio()];
    // Nízká předvolba kreslí na počítači v plném rozlišení (dřív 0,75, obraz byl rozmazaný; docs/obraz.md).
  })).toEqual([true, 771, 'fxaa', false, 'low', 1]);
  await page.goto(gameUrl('/?debug&adapt=0&view=620'));
  await page.waitForFunction(() => window.__ready);
  expect(await page.evaluate(() => [window.__game.money, window.__game.postfx.antialias])).toEqual([771, 'fxaa']);
  expect(errors).toEqual([]);
});

test('E17 – automatika vybere a uloží předvolbu po deseti sekundách práce', async ({ page }) => {
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
  await page.waitForFunction(() => window.__ready);
  const initial = await page.evaluate(() => {
    const game = window.__game;
    const measured = () => ({ workMs: { p95: 10 }, gpuMs: { p95: 15 } });
    game.adapt(9, measured);
    const first = game.graphics.automatic;
    game.adapt(1, measured);
    return [first, game.graphics.automatic];
  });
  expect(initial).toEqual([null, 'low']);
  await page.waitForFunction(() => {
    const saved = JSON.parse(localStorage.getItem('plzen-naplno-v1'));
    return saved?.graphics?.automatic === 'low' && !window.__game.graphicsBusy;
  });
  expect(await page.evaluate(() => window.__game.postfx.antialias)).toBe('fxaa');
});
