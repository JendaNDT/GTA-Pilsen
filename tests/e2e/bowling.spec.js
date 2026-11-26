import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

async function arrive(page, mobile = false) {
  await page.goto(gameUrl('/?debug&quality=low&weather=clear&hour=10'));
  await waitForGame(page);
  const play = page.getByRole('button', { name: 'Hrát', exact: true });
  if (mobile) await play.tap(); else await play.click();
  const approached = await page.evaluate(() => {
    __freeze(true);
    const g = __game, p = g.player, w = g.world;
    const x = 634.7, z = 1220.2;
    p.place(x, z, w.groundY(x, z));
    for (let i = 0; i < 25; i++) g.colliders.update(x, z);
    let road = false;
    for (let i = 0; i < 180; i++) {
      const dx = 638 - p.x, dz = 1217 - p.z, distance = Math.hypot(dx, dz);
      if (distance < .65) break;
      p.update(1 / 60, dx / distance, dz / distance, false, false);
      road ||= w.onCarriageway(p.x, p.z, p.y);
    }
    __step(1 / 60, 15);
    return { road, metres: Math.hypot(p.x - x, p.z - z), grounded: p.grounded };
  });
  expect(approached).toMatchObject({ road: false, grounded: true });
  expect(approached.metres).toBeGreaterThan(3);
  await expect(page.locator('#prompt')).toContainText('Zahrát bowling');
}

async function enter(page, mobile = false) {
  if (mobile) await page.getByRole('button', { name: 'Zahrát bowling', exact: true }).tap();
  else await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60, 5));
  await expect(page.locator('#bowling-panel')).toBeVisible();
}

async function aim(page, direction) {
  await page.locator('#bowl-aim').evaluate((field, value) => {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, direction);
}

test('E57 – vstup z mapy, celá partie, uložení skóre a návrat před budovu', async ({ page }) => {
  test.setTimeout(90000);
  await arrive(page);
  await page.keyboard.press('m');
  await page.evaluate(() => __step(1 / 60));
  await page.getByRole('searchbox').fill('Bowling U Papírny');
  await page.getByRole('button', { name: 'Bowling U Papírny', exact: true }).click();
  await expect(page.locator('#map-access')).toContainText('Papírnická 3');
  await page.getByRole('button', { name: 'Navigovat sem' }).click();
  expect(await page.evaluate(() => [__game.jobs.waypoint.name, __game.jobs.waypoint.x, __game.jobs.waypoint.z]))
    .toEqual(['Bowling U Papírny', 638, 1217]);

  await enter(page);
  const entry = await page.evaluate(() => {
    const g = __game;
    return { time: g.clock.now, x: g.player.x, z: g.player.z, money: g.money };
  });
  await aim(page, '-1');
  await page.keyboard.press('Enter');
  await page.evaluate(() => __step(1 / 60, 52));
  expect(await page.evaluate(() => __game.activities.bowling.lane.ball.GetPosition().GetZ())).toBeGreaterThan(2);
  await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60, 415));
  await expect(page.locator('#bowl-status')).toContainText('Strike');
  await expect(page.locator('#bowl-frames li').first().locator('b')).toHaveText('X');

  await aim(page, '22');
  const result = await page.evaluate(() => {
    const { bowling } = __game.activities;
    const setItem = Storage.prototype.setItem;
    try {
      for (let i = 0; i < 18; i++) {
        if (bowling.phase !== 'aim') throw new Error('Před dalším hodem hra čeká na dokončení předchozího.');
        if (i === 17) {
          Storage.prototype.setItem = () => { throw new Error('Zkušební chyba uložení'); };
        }
        __game.doAction();
        __step(1 / 60, 450);
      }
    } finally {
      Storage.prototype.setItem = setItem;
    }
    const g = __game, saved = JSON.parse(localStorage.getItem('plzen-naplno-v1'));
    return {
      complete: bowling.round.complete, frames: bowling.round.frames, points: bowling.round.total,
      time: g.clock.now, x: g.player.x, z: g.player.z, money: g.money,
      best: saved.stats.bowlingBest, pending: saved.activity,
    };
  });
  expect(result).toMatchObject({ ...entry, complete: true, points: 10, best: undefined, pending: 'papirny-bowling' });
  expect(result.frames).toEqual([[10], ...Array.from({ length: 9 }, () => [0, 0])]);
  await expect(page.locator('#bowl-status')).toContainText('Výsledek se nepodařilo uložit.');
  await page.getByRole('button', { name: 'Znovu uložit výsledek' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1'))))
    .toMatchObject({ activity: null, stats: { bowlingBest: 10 } });
  await expect(page.locator('#bowl-record')).toHaveText('Rekord 10');
  await page.getByRole('button', { name: 'Nová partie' }).click();
  await expect(page.locator('#bowl-total')).toHaveText('0 bodů');
  await page.getByRole('button', { name: 'Odejít', exact: true }).click();
  await expect(page.locator('#bowling-panel')).toBeHidden();
  await page.evaluate(() => __step(1 / 60, 10));
  await expect(page.locator('#prompt')).toContainText('Zahrát bowling');
  await page.reload();
  await waitForGame(page);
  expect(await page.evaluate(() => __game.stats.bowlingBest)).toBe(10);
});

test('E57 – dotykový hod na nízkou předvolbu a návrat po přerušené partii', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await arrive(page, true);
    await enter(page, true);
    const shown = await page.evaluate(() => {
      const bowl = __game.activities.bowling;
      const ball = bowl.room.ball.position.clone().project(bowl.room.camera);
      const top = document.querySelector('.bowl-console').getBoundingClientRect().top;
      return ball.y > -1 && (1 - ball.y) * innerHeight / 2 < top - 12;
    });
    expect(shown).toBe(true);
    const range = page.locator('#bowl-power');
    const track = await range.boundingBox();
    await page.touchscreen.tap(track.x + track.width * .48, track.y + track.height / 2);
    await expect(page.locator('#bowl-power-value')).not.toHaveText('75 %');
    await page.getByRole('button', { name: 'Hodit', exact: true }).tap();
    await page.evaluate(() => __step(1 / 60, 450));
    expect(await page.evaluate(() => __game.activities.bowling.round.frames.flat().length)).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1')).activity)).toBe('papirny-bowling');
    await page.reload();
    await waitForGame(page);
    await page.getByRole('button', { name: 'Pokračovat', exact: true }).tap();
    await expect(page.locator('#toast')).toContainText('Bowling byl při načtení přerušen.');
    await expect(page.locator('#bowling-panel')).toBeHidden();
    await expect(page.locator('#prompt')).toContainText('Zahrát bowling');
    expect(await page.evaluate(() => __game.stats.bowlingBest)).toBeUndefined();
  } finally { await context.close(); }
});
