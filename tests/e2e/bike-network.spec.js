import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';
import { testTimeout } from './test-timeout.js';

test('E55 – ke všem stanovištím jde dojít, odjet na kole a výpůjčku u stejného místa vrátit', async ({ page }) => {
  test.setTimeout(testTimeout(180_000));
  await page.goto(gameUrl('/?debug&quality=low&hour=10'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    __freeze(true);
    const game = __game, { player, world, colliders, bikes } = game;
    const dt = 1 / 60;
    const straight = { moveX: 0, moveY: .6, handbrake: false };
    const brake = { moveX: 0, moveY: 0, handbrake: true };
    const failed = [];
    const arrived = (station, metres) => Math.hypot(player.x - station.x, player.z - station.z) < metres;
    for (const station of bikes.stations) {
      const { x, z, y, yaw } = station;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const ax = x + fx * 4.5, az = z + fz * 4.5;
      for (let i = 0; i < 25; i++) colliders.update(x, z);
      const approachY = colliders.exitHeight(ax, az, world.groundY(ax, az, y + .8));
      try {
        player.place(ax, az, approachY);
        for (let i = 0; i < 185 && !arrived(station, .6); i++) {
          const dx = x - player.x, dz = z - player.z, length = Math.hypot(dx, dz);
          player.update(dt, dx / length, dz / length, false, false);
        }
        if (!arrived(station, .6)) throw new Error('pěší příchod');
        game.doAction();
        if (game.mode !== 'bike' || bikes.rental?.origin !== station.id) throw new Error('výpůjčka');
        for (let i = 0; i < 260 && arrived(station, 4.2) && game.mode === 'bike'; i++) bikes.step(dt, straight);
        if (game.mode !== 'bike' || arrived(station, 4.2)) throw new Error('výjezd');
        // Nastavení směru na konci ověřeného úseku simuluje příjezd z opačného směru.
        player.place(ax, az, approachY);
        player.yaw = yaw + Math.PI;
        bikes.speed = 0;
        for (let i = 0; i < 260 && !arrived(station, 1.15) && game.mode === 'bike'; i++) bikes.step(dt, straight);
        if (game.mode !== 'bike' || !arrived(station, 1.15)) throw new Error('příjezd');
        for (let i = 0; i < 60 && game.mode === 'bike'; i++) bikes.step(dt, brake);
        game.doAction();
        if (game.mode !== 'foot' || bikes.rental || bikes.stock[station.id] !== 1) throw new Error('vrácení');
      } catch (error) {
        failed.push([station.id, station.name, error.message, Number(Math.hypot(player.x - x, player.z - z).toFixed(2)),
          Number(player.y.toFixed(2)), player.grounded]);
        bikes.interrupt();
        game.mode = 'foot';
      }
    }
    return { count: bikes.stations.length, failed };
  });
  expect(result.count).toBe(152);
  expect(result.failed).toEqual([]);
});
