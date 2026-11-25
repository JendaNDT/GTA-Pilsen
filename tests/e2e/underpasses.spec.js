import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('auto projede po spodní vozovce v Prokopově a K Valše s koly na zemi', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  const passages = await page.evaluate(() => {
    const g = window.__game, w = g.world, car = g.player.lastCar;
    g._enterCar(car);
    g.paused = false;
    g.vehicles.spawnTimer = g.peds.timer = 100000;
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    const results = [];
    for (const [street, x, z] of [['Prokopova', 141.52, 712.60], ['K Valše', -2960.78, 4341.96]]) {
      const lane = w.nearestRoad(x, z, 8, 13, 0, {}, w.heightAt(x, z), true);
      const { dx, dz } = lane, startX = lane.x - 14 * dx, startZ = lane.z - 14 * dz;
      car.place(startX, startZ, Math.atan2(dx, dz), w.heightAt(startX, startZ));
      let distance = 0, samples = 0, contacts = 0, verticalSpeed = 0;
      for (let tick = 0; tick < 1100 && distance < 28; tick++) {
        const target = Math.min(distance + 4, 30);
        const yaw = Math.atan2(startX + target * dx - car.x, startZ + target * dz - car.z);
        const turn = Math.atan2(Math.sin(yaw - car.yaw), Math.cos(yaw - car.yaw));
        window.__setInput(Math.max(-1, Math.min(1, -turn * 1.4)), car.speed < 6 ? 0.52 : 0);
        g.update(1 / 60);
        distance = (car.x - startX) * dx + (car.z - startZ) * dz;
        if (distance < 10 || distance > 19) continue;
        samples++;
        if (g.driver.wheels.every(wheel => wheel.HasContact())) contacts++;
        verticalSpeed = Math.max(verticalSpeed, Math.abs(car.vy));
      }
      results.push({ street, actual: w.roadNames[w.r.name[lane.road]], distance, samples, contacts, verticalSpeed });
    }
    return results;
  });
  for (const pass of passages) {
    expect(pass.actual).toBe(pass.street);
    expect(pass.distance, pass.street).toBeGreaterThanOrEqual(28);
    expect(pass.samples, pass.street).toBeGreaterThan(30);
    expect(pass.contacts, JSON.stringify(pass)).toBe(pass.samples);
    expect(pass.verticalSpeed, pass.street).toBeLessThan(0.65);
  }
});
