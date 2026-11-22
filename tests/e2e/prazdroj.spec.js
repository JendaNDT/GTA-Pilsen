import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E18 – auto projede ulicí U Prazdroje pod měřenou lávkou v obou směrech', async ({ page }) => {
  // Pevné datum: sníh nebo mokrá vozovka podle dne mění přilnavost kol a MHD jezdí podle dne v týdnu.
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  const runs = await page.evaluate(() => {
    const g = window.__game, w = g.world, car = g.player.lastCar;
    const road = w.nearestRoad(657, 162, 5, 13, 0, {});
    const { x, z, dx, dz } = road;
    g._enterCar(car);
    g.vehicles.spawnTimer = g.peds.timer = 100000;
    g.paused = false;
    window.__setInput(0, 1);
    return [1, -1].map((sign) => {
      const tx = dx * sign, tz = dz * sign;
      car.place(x - 14 * tx - tz * 1.3, z - 14 * tz + tx * 1.3, Math.atan2(tx, tz));
      let along = -14, maxVerticalError = 0;
      for (let i = 0; i < 360 && along < 14; i++) {
        g.update(1 / 60);
        along = (car.x - x) * tx + (car.z - z) * tz;
        maxVerticalError = Math.max(maxVerticalError, Math.abs(car.y - w.heightAt(car.x, car.z)));
      }
      return { along, health: car.health, maxVerticalError };
    });
  });
  for (const run of runs) {
    expect(run.along).toBeGreaterThanOrEqual(14);
    expect(run.health).toBe(100);
    expect(run.maxVerticalError).toBeLessThan(0.5);
  }
});
