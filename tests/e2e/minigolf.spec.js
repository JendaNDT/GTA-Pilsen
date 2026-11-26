import { expect, test } from '@playwright/test';
import { ACTIVITY_SITES } from '../../src/game/activity-sites.js';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const [site] = ACTIVITY_SITES;
const saveId = 'skodaland-minigolf-prvni-jamka';

async function approach(page, touch = false) {
  await page.goto(gameUrl('/?debug&quality=low&view=620&hour=10'));
  await waitForGame(page);
  const play = page.getByRole('button', { name: 'Hrát', exact: true });
  if (touch) await play.tap(); else await play.click();
  const reached = await page.evaluate(({ start, entry }) => {
    __freeze(true);
    const { colliders, player, world, vehicles, peds } = __game;
    vehicles.spawnTimer = peds.timer = 100_000;
    player.place(start.x, start.z);
    for (let i = 0; i < 25; i++) colliders.update(player.x, player.z);
    for (let i = 0; i < 300; i++) {
      const x = entry.x - player.x, z = entry.z - player.z, distance = Math.hypot(x, z);
      if (distance < 0.75) break;
      player.update(0.035, x / distance, z / distance, false, false);
    }
    __step(0.16);
    return {
      distance: Math.hypot(entry.x - player.x, entry.z - player.z),
      lane: world.onCarriageway(player.x, player.z, player.y),
      water: world.isWater(player.x, player.z),
    };
  }, { start: site.trial.target, entry: site.golf });
  expect(reached.distance, JSON.stringify(reached)).toBeLessThan(1);
  expect(reached).toMatchObject({ lane: false, water: false });
  await expect(page.locator('#prompt')).toContainText('Zahrát minigolf');
}

test('E54 – první jamku lze odehrát klávesnicí i myší a opakovat do limitu', async ({ page }) => {
  await approach(page);
  await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60));
  const panel = page.getByRole('region', { name: 'Minigolf · jamka 1' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('slider', { name: /^Směr/ })).toHaveValue('0');
  const power = panel.getByRole('slider', { name: /^Síla/ });
  await power.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  await expect(power).toHaveValue('75');
  const start = await page.evaluate(() => ({ px: __game.player.x, cx: __game.camera.position.x }));
  await page.keyboard.press('f');
  const state = await page.evaluate(() => {
    __step(1 / 60, 20);
    const { player, camera, activities } = __game;
    return { px: player.x, cx: camera.position.x, attempts: activities.golf.ball.score.strokes };
  });
  expect(state.px).toBe(start.px);
  expect(state.cx).toBeGreaterThan(start.cx + 0.1);
  expect(state.attempts).toBe(1);
  const hit = panel.getByRole('button', { name: 'Odpálit F' });
  await expect(hit).toBeDisabled();
  await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60, 210));
  await expect(panel.getByRole('status')).toHaveText('Míček je v jamce.');
  await expect(panel.locator('#golf-count')).toHaveText('1 / 7 úderů');

  await panel.getByRole('button', { name: 'Zkusit znovu' }).click();
  await expect(panel.locator('#golf-count')).toHaveText('0 / 7 úderů');
  await power.focus();
  await page.keyboard.press('End');
  for (const strokes of [2, 4, 6, 7]) {
    await hit.click();
    await page.evaluate(() => __step(1 / 60, 240));
    await expect(panel.locator('#golf-count')).toHaveText(`${strokes} / 7 úderů`);
    expect(await page.evaluate(() => __game.activities.golf.ball.z)).toBe(0);
  }
  await expect(panel.getByRole('status')).toContainText('Dosažen limit sedmi úderů.');
  await panel.getByRole('button', { name: 'Odejít' }).click();
  await expect(panel).toBeHidden();
  expect(await page.evaluate(() => ({
    active: __game.activities.active, body: __game.activities.golf.ball,
    saved: JSON.parse(localStorage.getItem('plzen-naplno-v1')).activity,
  }))).toEqual({ active: null, body: null, saved: null });
});

test('E54 – dotykem lze zamířit, odpálit a po obnovení pokračovat pěšky', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await approach(page, true);
    await page.getByRole('button', { name: 'Zahrát minigolf' }).tap();
    await page.evaluate(() => __step(1 / 60));
    const panel = page.getByRole('region', { name: 'Minigolf · jamka 1' });
    await expect(panel).toBeVisible();
    const slider = panel.getByRole('slider', { name: /^Směr/ });
    const bounds = await slider.boundingBox();
    await page.touchscreen.tap(bounds.x + bounds.width * 0.56, bounds.y + bounds.height / 2);
    await expect(slider).not.toHaveValue('0');
    const power = panel.getByRole('slider', { name: /^Síla/ });
    const powerBounds = await power.boundingBox();
    await page.touchscreen.tap(powerBounds.x + powerBounds.width * 0.43, powerBounds.y + powerBounds.height / 2);
    await expect(power).not.toHaveValue('70');
    await panel.getByRole('button', { name: 'Odpálit', exact: true }).tap();
    await page.evaluate(() => __step(1 / 60, 20));
    await expect(panel.locator('#golf-count')).toHaveText('1 / 7 úderů');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1')).activity)).toBe(saveId);
    await page.reload();
    await waitForGame(page);
    await page.getByRole('button', { name: 'Pokračovat', exact: true }).tap();
    await expect(panel).toBeHidden();
    await expect(page.locator('#toast')).toContainText('Minigolf byl při načtení přerušen.');
    const player = await page.evaluate(() => ({ x: __game.player.x, z: __game.player.z, mode: __game.mode }));
    expect(player.mode).toBe('foot');
    expect(Math.hypot(player.x - site.returnPoint.x, player.z - site.returnPoint.z)).toBeLessThan(1);
  } finally {
    await context.close();
  }
});
