import { expect, test } from '@playwright/test';
import { action, approach, boot } from './transit-steps.js';

const rides = [
  { id: '685940', ref: '2', from: 'Karla Steinera', via: 'Macháčkova', to: 'Terezie Brzkové', section: 1, steps: 46 },
  { id: '686541', ref: '4', from: 'Borský park', via: 'Dvořákova', to: 'Náměstí Míru', section: 0, steps: 38 },
  { id: '688257', ref: '30', from: 'Borský park', via: 'Sídliště Bory', to: 'Šimerova', section: 0, steps: 60 },
  { id: '691485', ref: '16', from: 'Habrmannovo nám.', via: 'Poliklinika Doubravka', to: 'Opavská', section: 0, steps: 58 },
];

for (const ride of rides) test('E62 – nástup z ulice a dvě zastávky na lince ' + ride.ref, async ({ page }) => {
  await boot(page, 'quality=low');
  expect(await approach(page, ride.id, ride.from)).toEqual({ ref: ride.ref, doorOpen: true, boardable: true });
  const entry = await page.evaluate(({ id, section }) => {
    const g = __game, v = g.transit.vehicles.find(v => v.event.trip.id === id);
    const z = v.sections[section].doors[0];
    const point = g.transit.exitPoint(v, {}, z, section);
    g.player.place(point.x, point.z, point.y);
    __step(1 / 60);
    return { wrongLevel: g.transit.boardable(point.x, point.z, point.y + 6) === v, z,
      parts: v.meshes[section].children.length };
  }, ride);
  expect(entry.wrongLevel).toBe(false);
  await action(page);
  expect(await page.evaluate(() => [__game.ride?.event.trip.id, __game.cabin?.section])).toEqual([ride.id, ride.section]);

  expect(await page.evaluate(i => __game.ride.meshes[i].children.length, ride.section)).toBeGreaterThan(entry.parts);

  async function walk(key, steps) {
    await page.keyboard.down(key);
    await page.evaluate(n => __step(1 / 60, n), steps);
    await page.keyboard.up(key);
  }
  async function travel(stop) {
    return page.evaluate(stop => {
      const v = __game.ride, start = v.s;
      for (let i = 0; i < 8000; i++) {
        __advanceTransit();
        if (v.stopTarget?.[1] === stop && v.canAlight && v.doorFraction >= 0.85) {
          __step(0);
          return v.s - start;
        }
      }
      throw new Error('Spoj nedojel do zastávky ' + stop);
    }, stop);
  }
  await walk('d', 28);
  await walk('w', ride.steps);
  await action(page);
  expect(await page.evaluate(() => __game.cabin?.action)).toBe('Vstát');
  expect(await travel(ride.via)).toBeGreaterThan(50);
  expect(await page.evaluate(() => __game.cabin?.action)).toBe('Vstát');
  await action(page);
  await walk('s', ride.steps);
  await walk('a', 28);
  expect(await page.evaluate(() => __game.cabin?.door)).toBe(entry.z);
  expect(await travel(ride.to)).toBeGreaterThan(50);
  await action(page);
  expect(await page.evaluate(() => [__game.mode, __game._platformClear(__game.player)])).toEqual(['foot', true]);
  expect(await page.evaluate(({ id, section }) =>
    __game.transit.vehicles.find(v => v.event.trip.id === id).meshes[section].children.length, ride)).toBe(entry.parts);
});
