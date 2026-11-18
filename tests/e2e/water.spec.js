import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E20 – auto sjede z břehu do Radbuzy, hráč vyplave a vůz zmizí až pod hladinou', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, p = g.player, car = p.lastCar;
    // Západní břeh asi 20 metrů po proudu od Wilsonova mostu.
    const x = 164, z = 438;
    car.place(x, z, Math.PI / 2);
    g._enterCar(car);
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    for (let i = 0; i < 25; i++) g.colliders.update(x, z);
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    car.vx = car.speed = 23;
    let entry, removed, splash = 0, surfaced = false, afloat = 0, escaped = false, keptBody = false;
    const original = g.audio.splash.bind(g.audio);
    g.audio.splash = (source) => { if (source === car) splash++; original(source); };
    const highestPoint = () => {
      // Skutečné vrcholy zobrazené karoserie, včetně převráceného auta.
      let top = -Infinity;
      car.mesh.updateMatrixWorld(true);
      for (const part of car.mesh.children) {
        const vertices = part.geometry?.getAttribute('position');
        if (!part.visible || !vertices) continue;
        const m = part.matrixWorld.elements;
        for (let i = 0; i < vertices.count; i++) {
          const y = m[1] * vertices.getX(i) + m[5] * vertices.getY(i) + m[9] * vertices.getZ(i) + m[13];
          top = Math.max(top, y);
        }
      }
      return top;
    };
    let chassis;
    for (let tick = 0; tick < 1100; tick++) {
      g.update(1 / 60);
      chassis ??= g.driver?.body;
      if (!entry && car.floodTime) entry = tick;
      if (car.air && car.floodTime > 1 && car.floodTime < 4 && car.y < w.heightAt(car.x, car.z) &&
          highestPoint() > w.heightAt(car.x, car.z)) afloat++;
      if (g.mode === 'foot') {
        escaped = true;
        surfaced ||= p.swimming && Math.abs(p.y - w.heightAt(p.x, p.z)) < 0.25;
        keptBody ||= car.physical?.body === chassis;
      }
      if (!g.vehicles.cars.includes(car)) { removed = tick; break; }
    }
    let reachedBank = false;
    if (surfaced) {
      for (let i = 0; i < 2400; i++) {
        p.update(1 / 60, -1, 0, false, false);
        if (!p.swimming && !w.isWater(p.x, p.z) && p.grounded) { reachedBank = true; break; }
      }
    }
    return { dryStart: !w.isWater(x, z), entry, splash, afloat, escaped, surfaced, keptBody, reachedBank,
      seconds: (removed - entry) / 60, roof: highestPoint() - w.heightAt(car.x, car.z), x: car.x, y: car.y, z: car.z };
  });
  await writeFile(test.info().outputPath('prujezd.json'), JSON.stringify(result, null, 2));
  expect(result.dryStart).toBe(true);
  expect(result.entry, JSON.stringify(result)).toBeGreaterThan(3);
  expect(result.splash).toBe(1);
  expect(result.afloat, JSON.stringify(result)).toBeGreaterThan(30);
  expect(result.escaped && result.surfaced && result.keptBody, JSON.stringify(result)).toBe(true);
  expect(result.seconds, JSON.stringify(result)).toBeGreaterThanOrEqual(6);
  expect(result.seconds).toBeLessThanOrEqual(12);
  expect(result.roof).toBeLessThan(0);
  expect(result.reachedBank, JSON.stringify(result)).toBe(true);
});
