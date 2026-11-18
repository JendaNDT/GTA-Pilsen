import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E18 – spuštěná hra má svět fyziky a uvádí jeho licenci', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await page.waitForFunction(() => window.__ready);
  expect(await page.evaluate(() => window.__game.physics.system.GetGravity().GetY())).toBeCloseTo(-9.81);
  await page.getByRole('button', { name: 'O hře', exact: true }).click();
  await expect(page.locator('#panel-about')).toContainText('Jolt Physics 1.1.1');
});

test('E18 – chyba při stažení fyziky vysvětlí, jak obnovit hru', async ({ page }) => {
  await page.route('**/jolt-physics.wasm-compat-*.js', (route) => route.abort());
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await expect(page.locator('#loadtext')).toContainText('Nepodařilo se načíst fyziku vozidel', { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Hrát', exact: true })).toBeHidden();
});

test('E18 – hra rozděluje čas jízdy na pevné kroky a v pauze fyziku neposouvá', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await page.waitForFunction(() => window.__ready);
  const steps = await page.evaluate(() => {
    const game = window.__game;
    const clock = game.physics.clock;
    const original = game.physics.step;
    const values = [];
    game.physics.step = (dt) => { values.push(dt); original(dt); };
    game.paused = true;
    game.update(1 / 60);
    const paused = values.length;
    game.paused = false;
    clock.remainder = 0;
    game.update(1 / 30);
    game.physics.step = original;
    return { paused, values };
  });
  expect(steps.paused).toBe(0);
  expect(steps.values).toEqual([1 / 60, 1 / 60]);
});
