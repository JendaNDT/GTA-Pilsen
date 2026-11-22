import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { waitForGame } from './ready.js';
import { gameUrl } from './game-url.js';

test('E24 – fotorežim z menu pozastaví čas a stáhne vlastní PNG @webgpu', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (/invalid shader module|validation error|error.*shader|shader.*error/i.test(m.text())) errors.push(m.text());
  });
  await page.setViewportSize({width:400,height:280});
  // Pevné datum: poloha slunce a roční období stromů se mění podle dne.
  await page.goto(gameUrl('/?debug&quality=medium&view=300&adapt=0&weather=clear&date=2026-11-09&hour=12'));
  await waitForGame(page);
  const before = await page.evaluate(() => ({ time: __game.clock.now, pos: __game.camera.position.toArray() }));
  await page.locator('#btn-photo').click();
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('#photo-controls')).toBeVisible();
  await page.keyboard.down('w');
  await page.waitForFunction(pos => __game.camera.position.toArray().some((v,i) => Math.abs(v-pos[i]) > .12), before.pos);
  await page.keyboard.up('w');
  expect(await page.evaluate(() => __game.clock.now)).toBe(before.time);
  expect(await page.evaluate(() => Boolean(__game.postfx?.photoDOF))).toBe(true);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#photo-save').click()]);
  const file = await readFile(await download.path());
  expect(file.subarray(1,4).toString()).toBe('PNG');
  expect(file.length).toBeGreaterThan(2000);
  await page.locator('#photo-exit').click();
  await expect(page.locator('#btn-play')).toBeVisible();
  expect(await page.evaluate(() => __game.camera.position.toArray())).toEqual(before.pos);
  expect(errors).toEqual([]);
});

test('E24 – klávesa fotorežimu v mapě ponechá funkční návrat do hry @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 420, height: 280});
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.keyboard.press('m');
  await expect(page.locator('#bigmap')).toBeVisible({timeout: 30000});
  await page.keyboard.press('o');
  await page.keyboard.press('Escape');
  await expect(page.locator('#bigmap')).toBeHidden({timeout: 30000});
  await expect(page.locator('#photo-controls')).toBeHidden({timeout: 30000});
  await page.keyboard.press('o');
  await expect(page.locator('#photo-controls')).toBeVisible({timeout: 30000});
  await page.locator('#photo-exit').click();
  await expect(page.locator('#hud')).toBeVisible({timeout: 30000});
  expect(errors).toEqual([]);
});

test('E24 – ultra spojuje sluneční paprsky, volitelný odlesk a vektory pohybu @webgpu', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (/invalid shader module|validation error|error.*shader|shader.*error/i.test(m.text())) errors.push(m.text());
  });
  await page.setViewportSize({width:400,height:280});
  // Pevné datum: zkouška míří kamerou do slunce, jehož poloha se mění podle dne.
  await page.goto(gameUrl('/?debug&quality=ultra&view=350&adapt=0&weather=clear&date=2026-11-09&hour=12'));
  await waitForGame(page);
  const state = await page.evaluate(async () => {
    __freeze(true);
    const g = __game;
    const before = g.motionEnabled;
    for (const id of ['sun-flare','motion-blur']) {
      const c = document.getElementById(id); c.checked = true; c.dispatchEvent(new Event('change'));
    }
    const eye = g.camera.position, d = g.env.sunDir;
    __view(eye.x,eye.y,eye.z,eye.x+d.x*100,eye.y+d.y*100,eye.z+d.z*100);
    await g.renderer.backend.device?.queue.onSubmittedWorkDone();
    return { before, rays: Boolean(g.postfx?.rays), flare: g.env.flare?.isLensflareMesh,
      motion: g.postfx?.motion.value, velocity: Boolean(g.postfx?.velocity), temporal: Boolean(g.postfx?.temporal) };
  });
  expect(state.before).toBe(false);
  expect(state.rays && state.flare && state.motion).toBe(true);
  expect(state.velocity).toBe(state.temporal);
  expect(errors).toEqual([]);
});
