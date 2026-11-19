import { waitForGame } from './ready.js';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E06 – půlnoc, odjezdy, pauza a uložené nastavení hodin', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
  const transition = await page.evaluate(() => {
    const g = window.__game;
    window.__setClock('2026-11-15', 24 - 1 / 3600);
    const v = g.transit.vehicles.find((v) => v.event.trip.id === '695549');
    const before = { hour: g.hour, s: v.s, day: g.clock.day };
    window.__step(1 / 60, 82);
    return { before, day: g.clock.day, hour: g.hour, envHour: g.env.hour, s: v.s, from: v.event.day,
      same: g.transit.vehicles.includes(v) };
  });
  expect(transition.day).toBe(transition.before.day + 1);
  expect(transition.from).toBe(transition.before.day);
  expect(transition.hour).toBeLessThan(1 / 60);
  expect(transition.envHour).toBeLessThan(1 / 60);
  expect(transition.s).toBeGreaterThan(transition.before.s);
  expect(transition.same).toBe(true);
  await expect(page.locator('#clock-time')).toHaveText('00:00');
  await expect(page.locator('#clock-day')).toHaveText('pondělí');

  await page.evaluate(() => {
    const g = window.__game;
    const [name, x, z] = g.transit.timetable.stops.find(([name]) => name === 'Sady Pětatřicátníků');
    g.player.place(x, z);
    window.__setClock('2026-11-15', 22.5);
  });
  const board = page.locator('#stop-board');
  await expect(board).toBeVisible();
  const nightRows = await board.locator('li').allTextContents();
  expect(nightRows.length).toBeGreaterThan(0);
  const jump = await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { code: 'KeyN' });
    window.dispatchEvent(e); window.__step(1 / 60); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyN' }));
    return { day: __game.clock.day, hour: __game.hour };
  });
  expect(jump.day).toBe(transition.day);
  expect(jump.hour).toBeCloseTo(1.5, 2);
  await expect(page.locator('#clock-time')).toHaveText('01:30');
  expect(await board.locator('li').allTextContents()).not.toEqual(nightRows);
  await page.evaluate(() => window.__game.toggleMap(true));
  await expect(page.locator('#bigmap-date')).toBeVisible();
  await expect(page.locator('#bigmap-date time')).toHaveAttribute('datetime', '2026-11-16');
  await page.getByRole('button', { name: 'Zavřít mapu' }).click();

  await page.locator('#btn-menu').click();
  const paused = await page.evaluate(() => {
    const g = window.__game, now = g.clock.now, signal = g.world.traffic.time, positions = g.transit.vehicles.map((v) => v.s);
    window.__step(1 / 60, 120);
    return { paused: g.paused, clock: now === g.clock.now, signal: signal === g.world.traffic.time,
      transit: g.transit.vehicles.every((v, i) => v.s === positions[i]) };
  });
  expect(paused).toEqual({ paused: true, clock: true, signal: true, transit: true });
  await page.getByRole('button', { name: 'Nastavení' }).click();
  const setting = page.getByRole('checkbox', { name: 'Zobrazovat herní hodiny' });
  await setting.uncheck();
  await page.reload();
  await waitForGame(page);
  await page.getByRole('button', { name: 'Nastavení' }).click();
  await expect(setting).not.toBeChecked();
  await page.getByRole('button', { name: 'Pokračovat' }).click();
  await page.evaluate(() => window.__freeze(true));
  await expect(page.locator('#clock')).toBeHidden();
  await page.evaluate(() => window.__game.toggleMap(true));
  await expect(page.locator('#bigmap')).toBeVisible();
  await expect(page.locator('#bigmap-date')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('plzen-naplno-v1'))).toContain('"date":"2026-11-16"');
  expect(errors).toEqual([]);
});

test('hodiny ukážou čas v Plzni, uloží ruční volbu a přepočítají spoje', { tag: '@webgpu' }, async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-18T17:45:00Z'));
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Nastavení' }).click();
  const field = page.locator('#clock-settings').getByLabel('Herní čas', { exact: true });
  await expect(field).toHaveValue('18:45');
  const saveKey = 'plzen-naplno-v1';
  await field.fill('09:15');
  await page.getByRole('button', { name: 'Nastavit čas', exact: true }).click();
  await expect(page.locator('#clock-status')).toHaveText('Ručně nastavený čas');
  expect(await page.evaluate((key) => {
    const { clock, transit, env } = window.__game;
    const expected = transit.timetable.events(clock.day).filter(({ start, end }) => start <= clock.now && end > clock.now);
    return { hour: clock.hour, sky: env.hour, correctVehicles: transit.vehicles.length === expected.length
      && expected.every(({ key }) => transit.active.has(key)), save: JSON.parse(localStorage.getItem(key)).clockMode };
  }, saveKey)).toEqual({ hour: 9.25, sky: 9.25, correctVehicles: true, save: 'manual' });

  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  expect(await page.evaluate(() => {
    const g = window.__game;
    window.__freeze(true);
    const before = g.clock.now;
    g.update(0.05, 0.75);
    return g.clock.now - before;
  })).toBeCloseTo(0.75, 5);
  await page.locator('#btn-menu').click();
  await page.clock.setFixedTime(new Date('2026-11-18T20:34:00Z'));
  await page.reload();
  await waitForGame(page);
  await page.getByRole('button', { name: 'Nastavení' }).click();
  await expect(field).toHaveValue('09:15');
  await page.getByRole('button', { name: 'Použít aktuální čas v Plzni' }).click();
  await expect(field).toHaveValue('21:34');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).clockMode, saveKey)).toBe('prague');
  await page.clock.setFixedTime(new Date('2026-11-18T22:07:00Z'));
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await expect(page.locator('#clock-time')).toHaveText('23:07');
});
