import { expect, test } from '@playwright/test';
import { ACTIVITY_SITES } from '../../src/game/activity-sites.js';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const [site] = ACTIVITY_SITES;
const match = 'Škodaland · zkušební trasa';

test('E52 – Škodaland se dá najít názvem, adresou, typem i klepnutím na značku', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => { __freeze(true); __game.toggleMap(true); });
  const query = page.getByRole('searchbox', { name: 'Vyhledat v mapě' });
  for (const text of ['skodaland', 'V Lukách 34', 'minigolf']) {
    await query.fill(text);
    await page.getByRole('button', { name: match }).click();
    await expect(page.locator('#map-name')).toHaveText(match);
    await expect(page.locator('#map-access')).toContainText('U Přehrady');
  }
  const position = await page.evaluate(({ x, z }) => {
    const [screenX, screenY] = __game.areaMap.view.screen(x, z);
    __game.areaMap.clearPreview();
    return { x: screenX + 4, y: screenY };
  }, site);
  await page.locator('#bigmap-canvas').click({ position });
  await expect(page.locator('#map-name')).toHaveText(match);
  await page.getByRole('button', { name: 'Navigovat sem' }).click();
  await expect(page.locator('#bigmap')).toBeHidden();
  expect(await page.evaluate(() => __game.jobs.waypoint)).toMatchObject({ x: site.x, z: site.z, name: site.name });
});

async function bootTrial(page, hour) {
  await page.goto(gameUrl(`/?debug&quality=low&view=620&date=2026-11-09&hour=${hour}`));
  await waitForGame(page);
}

test('E52 – pěšky od autobusu, stejná výzva vedle auta, dokončení a další pokus', async ({ page }) => {
  await bootTrial(page, 10);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => {
    __freeze(true);
    const g = __game;
    const [, x, z] = g.transit.timetable.stops.find((stop) => stop[3] === '47346/1');
    g.player.place(x, z);
    g.vehicles.spawnTimer = g.peds.timer = 100_000;
    g.toggleMap(true);
  });
  await page.getByRole('searchbox').fill('V Lukách 34');
  await page.getByRole('button', { name: match }).click();
  await page.getByRole('button', { name: 'Navigovat sem' }).click();
  const approach = await page.evaluate(() => {
    const g = __game, { player, jobs, colliders, world } = g;
    for (let i = 0; i < 25; i++) colliders.update(player.x, player.z);
    for (let i = 0; i < 400 && !jobs.walking.path; i++) jobs.walking.update(jobs.waypoint, 'foot', player);
    const path = jobs.walking.path;
    if (!path) return { status: jobs.walking.status };
    let length = 0;
    for (let i = 2; i < path.length; i += 2) {
      const x = path[i], z = path[i + 1];
      length += Math.hypot(x - path[i - 2], z - path[i - 1]);
      for (let step = 0; step < 270; step++) {
        const dx = x - player.x, dz = z - player.z, distance = Math.hypot(dx, dz);
        if (distance < 0.9) break;
        if (step % 6 === 0) colliders.update(player.x, player.z);
        player.update(0.04, dx / distance, dz / distance, false, false);
      }
    }
    g.promptTimer = 0;
    g.placeTimer = 0;
    __step(0.02);
    return { length, x: player.x, z: player.z, y: player.y, water: world.isWater(player.x, player.z), lane: world.onCarriageway(player.x, player.z, player.y) };
  });
  expect(approach.length, JSON.stringify(approach)).toBeGreaterThan(150);
  expect(Math.hypot(approach.x - site.x, approach.z - site.z), JSON.stringify(approach)).toBeLessThan(3);
  expect(approach).toMatchObject({ water: false, lane: false });
  await expect(page.locator('#prompt')).toContainText(site.startLabel);

  const nearCar = await page.evaluate(({ x, z }) => {
    const g = __game, car = g.player.lastCar;
    car.place(x + 2, z, 0);
    g.jobs.setWaypoint(x + 45, z + 15, 'Vlastní cíl', true);
    return g.vehicles.nearestEnterable(g.player.x, g.player.z, g.player.y) === car;
  }, site);
  expect(nearCar).toBe(true);
  const startOnRoad = await page.evaluate(() => {
    const g = __game;
    const { player } = g;
    const { x, y, z } = player;
    player.place(-1598, 3585.5);
    const lane = g.world.onCarriageway(player.x, player.z, player.y);
    const start = g.activities.choice();
    player.place(x, z, y);
    return { lane, start };
  });
  expect(startOnRoad).toEqual({ lane: true, start: null });
  await page.keyboard.press('f');
  const started = await page.evaluate(() => {
    __step(0.02);
    const g = __game, setClock = __setClock;
    const before = g.activities.active?.elapsed;
    setClock('2026-11-09', 22);
    const afterClock = g.activities.active?.elapsed;
    return { id: g.activities.active?.site.id, mode: g.mode, waypoint: g.jobs.waypoint.name,
      menuConflict: g.jobs.start('food'), shiftConflict: g.shifts.start(null),
      walk: g.jobs.displayedWalk, before, afterClock };
  });
  expect(started).toMatchObject({ id: site.id, mode: 'foot', waypoint: 'Vlastní cíl', walk: site.trial.path });
  expect(started.menuConflict).toContain('zkušební trasu');
  expect(started.shiftConflict).toContain('zkušební trasu');
  expect(started.afterClock).toBe(started.before);
  await page.locator('#btn-menu').click();
  await expect(page.locator('#menu-objective')).toHaveText(match);
  expect(await page.evaluate(() => {
    const g = __game, time = g.activities.active.elapsed;
    g.update(1);
    return g.activities.active.elapsed === time;
  })).toBe(true);
  await page.getByRole('button', { name: 'Zpět do hry' }).click();
  await page.evaluate(() => { __freeze(true); });

  await page.keyboard.press('f');
  await page.evaluate(() => __step(0.16));
  await expect(page.locator('#mission')).toBeHidden();
  await expect(page.locator('#toast')).toContainText('Zkušební trasa ukončena');
  expect(await page.evaluate(() => __game.jobs.waypoint.name)).toBe('Vlastní cíl');

  await page.keyboard.press('e');
  await page.evaluate(() => __step(0.02));
  await expect(page.locator('#mission')).toContainText('Dojdi k fialové značce');
  const walked = await page.evaluate(({ x, z }) => {
    const g = __game, { player } = g;
    const start = { x: player.x, z: player.z };
    for (let i = 0; i < 420; i++) {
      const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz);
      if (d < 1.5) break;
      player.update(0.04, dx / d, dz / d, false, false);
    }
    __step(0.16);
    return Math.hypot(player.x - start.x, player.z - start.z);
  }, site.trial.target);
  expect(walked).toBeGreaterThan(16);
  await expect(page.locator('#prompt')).toContainText('Dokončit zkušební trasu');
  await page.keyboard.press('f');
  await page.evaluate(() => __step(0.16));
  await expect(page.locator('#toast')).toContainText('Zkušební trasa dokončena');
  const final = await page.evaluate(() => {
    const g = __game;
    return { active: g.activities.active, beacon: [g.activities.beacon.position.x, g.activities.beacon.position.z], mode: g.mode,
      waypoint: g.jobs.waypoint.name, saved: JSON.parse(localStorage.getItem('plzen-naplno-v1')).activity };
  });
  expect(final).toEqual({ active: null, beacon: [site.x, site.z], mode: 'foot', waypoint: 'Vlastní cíl', saved: null });
});

test('E52 – noční příchod, dotyková akce a návrat po obnovení hry', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await bootTrial(page, 22);
    await page.getByRole('button', { name: 'Hrát', exact: true }).tap();
    await page.evaluate(({ x, z }) => {
      __freeze(true);
      const g = __game, { player, colliders } = g;
      player.place(-1586, 3597);
      for (let i = 0; i < 25; i++) colliders.update(player.x, player.z);
      for (let i = 0; i < 250; i++) {
        const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz);
        if (d < 1.5) break;
        player.update(0.04, dx / d, dz / d, false, false);
      }
      __step(0.16);
    }, site);
    await expect(page.locator('#prompt')).toContainText(site.startLabel);
    await page.getByRole('button', { name: site.startLabel }).tap();
    await page.evaluate(() => __step(0.16));
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1')).activity)).toBe(site.id);
    await page.getByRole('button', { name: 'Ukončit zkušební trasu' }).tap();
    await page.evaluate(() => __step(0.16));
    await expect(page.locator('#mission')).toBeHidden();
    await page.getByRole('button', { name: site.startLabel }).tap();
    await page.evaluate(() => __step(0.16));
    await page.reload();
    await waitForGame(page);
    const restored = await page.evaluate(() => {
      const g = __game;
      return { active: g.activities.active, x: g.player.x, z: g.player.z,
        interrupted: g.activities.interrupted?.id, money: g.money, mode: g.mode };
    });
    expect(restored).toMatchObject({ active: null, interrupted: site.id, mode: 'foot' });
    expect(Math.hypot(restored.x - site.returnPoint.x, restored.z - site.returnPoint.z)).toBeLessThan(1);
    await page.getByRole('button', { name: 'Pokračovat' }).tap();
    await expect(page.locator('#toast')).toContainText('Zkušební trasa byla při načtení přerušena');
  } finally { await context.close(); }
});
