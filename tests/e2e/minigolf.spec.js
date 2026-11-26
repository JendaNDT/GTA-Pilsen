import { expect, test } from '@playwright/test';
import { ACTIVITY_SITES } from '../../src/game/activity-sites.js';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const [site] = ACTIVITY_SITES;
const saveId = 'skodaland-minigolf-kolo';
const panelFor = page => page.getByRole('region', { name: /^Minigolf/ });

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
  const panel = panelFor(page);
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

  await expect(panel.getByRole('button', { name: /Přejít k další jamce/ })).toBeVisible();
  expect(await page.evaluate(() => __game.stats.minigolfBest)).toBeUndefined();
  await panel.getByRole('button', { name: 'Odejít' }).click();
  await page.evaluate(() => __step(0.16));
  await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60));
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
  await panel.getByRole('button', { name: /Přejít k další jamce/ }).click();
  await expect(panel.getByRole('status')).toContainText('Dojdi ke značce u jamky 2');
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
    const panel = panelFor(page);
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
    await page.evaluate(() => {
      const key = 'plzen-naplno-v1';
      const save = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify({ ...save, activity: 'skodaland-minigolf-prvni-jamka' }));
    });
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


async function goToTee(page, holeNo, touch = false) {
  const panel = panelFor(page);
  await expect(panel.getByRole('heading')).toHaveText(`Minigolf · jamka ${holeNo}/3`);
  const approach = await page.evaluate(() => {
    const g = __game, { player, activities } = g;
    const point = activities.golf.nextEntry;
    const initial = Math.hypot(point.x - player.x, point.z - player.z);
    const hintAtStart = activities.choice();
    const targetShown = activities.beacon.visible &&
      activities.beacon.position.x === point.x && activities.beacon.position.z === point.z;
    __setInput(0, 1);
    for (let i = 0; i < 600; i++) {
      if (Math.hypot(point.x - player.x, point.z - player.z) < 1.1) break;
      g.camYaw = Math.atan2(point.x - player.x, point.z - player.z);
      g.lookIdle = 0;
      g.update(1 / 60);
    }
    __setInput(undefined, undefined);
    __step(0.16);
    return {
      initial, hintAtStart, targetShown,
      destination: Math.hypot(point.x - player.x, point.z - player.z),
      road: g.world.onCarriageway(player.x, player.z, player.y),
      water: player.swimming,
    };
  });
  expect(approach.initial).toBeGreaterThan(2);
  expect(approach.destination, JSON.stringify(approach)).toBeLessThan(1.55);
  expect(approach).toMatchObject({ hintAtStart: null, targetShown: true, road: false, water: false });
  const label = `Hrát jamku ${holeNo}`;
  await expect(page.locator('#prompt')).toContainText(label);
  if (touch) await page.getByRole('button', { name: label }).tap();
  else {
    await expect(panel.getByRole('status')).toBeFocused();
    await page.keyboard.press('Enter');
  }
  await page.evaluate(() => __step(1 / 60));
  await expect(panel.locator('#golf-count')).toHaveText('0 / 7 úderů');
}

async function shoot(page, aim, power, touch = false) {
  const panel = panelFor(page);
  for (const [id, value] of [['golf-aim', aim], ['golf-power', power]]) {
    await panel.locator(`#${id}`).evaluate((field, value) => {
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }
  const hit = panel.getByRole('button', { name: /^Odpálit/ });
  if (touch) await hit.tap();
  else await hit.click();
  await page.evaluate(() => __step(1 / 60, 240));
}

test('E54 – pěšky mezi třemi jamkami, skóre celé partie, opakování uložení a nová partie', async ({ page }) => {
  await approach(page);
  await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60));
  const panel = panelFor(page);
  await shoot(page, 0, 75);
  await expect(panel.getByRole('status')).toHaveText('Míček je v jamce.');
  await panel.getByRole('button', { name: /Přejít k další jamce/ }).click();
  await page.evaluate(() => __step(1 / 60));
  await goToTee(page, 2);
  await shoot(page, -25, 84);
  await expect(panel.getByRole('status')).toHaveText('Míček je v jamce.');
  await expect(panel.locator('#golf-round')).toHaveText('Celkem 2 · jamky 1 + 1');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1')).stats.minigolfBest)).toBeUndefined();

  await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60));
  await goToTee(page, 3);
  await shoot(page, -36, 95);
  await expect(panel.locator('#golf-count')).toHaveText('1 / 7 úderů');
  await page.evaluate(() => {
    const setItem = Storage.prototype.setItem;
    window.restoreGolfSaving = () => { Storage.prototype.setItem = setItem; };
    Storage.prototype.setItem = function(key, value) {
      if (key === 'plzen-naplno-v1' && JSON.parse(value).stats?.minigolfBest) throw new Error('Zkušební chyba uložení');
      return setItem.call(this, key, value);
    };
  });
  await shoot(page, 16, 30);
  await expect(panel.getByRole('status')).toHaveText('Partie dokončena. Výsledek se nepodařilo uložit.');
  await expect(panel.locator('#golf-round')).toHaveText('Celkem 4 · jamky 1 + 1 + 2');
  expect(await page.evaluate(() => __game.stats.minigolfBest)).toBeUndefined();
  await page.evaluate(() => window.restoreGolfSaving());
  await panel.getByRole('button', { name: 'Znovu uložit výsledek' }).click();
  await expect(panel.getByRole('status')).toHaveText('Partie dokončena. Nový osobní rekord.');
  await expect(panel.locator('#golf-record')).toHaveText('Osobní rekord 4');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1')))).toMatchObject({
    activity: null, stats: { minigolfBest: 4 },
  });

  await panel.getByRole('button', { name: 'Nová partie' }).click();
  await page.evaluate(() => __step(1 / 60));
  await goToTee(page, 1);
  await expect(panel.locator('#golf-round')).toHaveText('Celkem 0');
  await expect(panel.locator('#golf-record')).toHaveText('Osobní rekord 4');
  await panel.getByRole('button', { name: 'Odejít' }).click();
  await page.reload();
  await waitForGame(page);
  expect(await page.evaluate(() => ({
    record: __game.stats.minigolfBest, active: __game.activities.active,
  }))).toEqual({ record: 4, active: null });
});


test('E54 – po dotykovém dohrání jamky se vrátí páčka a jde rozehrát další jamku', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await approach(page, true);
    await page.getByRole('button', { name: 'Zahrát minigolf' }).tap();
    await page.evaluate(() => __step(1 / 60));
    const panel = panelFor(page);
    await shoot(page, 0, 75, true);
    await panel.getByRole('button', { name: 'Přejít k další jamce' }).tap();
    await page.evaluate(() => __step(1 / 60));
    await expect(page.locator('#stick')).toBeVisible();
    await goToTee(page, 2, true);
    await expect(page.locator('#stick')).toBeHidden();
    await expect(panel.getByRole('status')).toHaveText('Zkus odraz od levého mantinelu.');
  } finally {
    await context.close();
  }
});
