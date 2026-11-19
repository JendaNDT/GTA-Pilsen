import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function driveIntoRiver(page, bank) {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
  return page.evaluate(({ x, z, vx }) => {
    const g = __game, w = g.world, p = g.player, car = p.lastCar;
    car.place(x, z, Math.sign(vx) * Math.PI / 2);
    g._enterCar(car);
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    for (let i = 0; i < 25; i++) g.colliders.update(x, z);
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    car.vx = vx;
    car.speed = Math.abs(vx);
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
        p.update(1 / 60, -Math.sign(vx), 0, false, false);
        if (!p.swimming && !w.isWater(p.x, p.z) && p.grounded) { reachedBank = true; break; }
      }
    }
    const onBottom = car.physical?.wheels.every(wheel => wheel.HasContact()) ?? false;
    let leftRadius, returned, heightChange;
    if (onBottom && removed === undefined) {
      const y = car.y;
      p.place(x - 300, z);
      for (let i = 0; i < 6; i++) g.update(1 / 60);
      leftRadius = !car.physical && g.vehicles.cars.includes(car);
      const awayHeight = car.y;
      p.place(x, z);
      for (let i = 0; i < 6; i++) g.update(1 / 60);
      returned = !!car.physical;
      heightChange = Math.max(Math.abs(car.y - y), Math.abs(awayHeight - y));
    }
    return { dryStart: !w.isWater(x, z), entry, splash, afloat, escaped, surfaced, keptBody, reachedBank,
      removed: removed !== undefined, onBottom, leftRadius, returned, heightChange,
      seconds: removed === undefined ? null : (removed - entry) / 60,
      roof: highestPoint() - w.heightAt(car.x, car.z), x: car.x, y: car.y, z: car.z };
  }, bank);
}

async function checkEscape(result) {
  await writeFile(test.info().outputPath('prujezd.json'), JSON.stringify(result, null, 2));
  expect(result.dryStart).toBe(true);
  expect(result.entry, JSON.stringify(result)).toBeGreaterThan(3);
  expect(result.splash).toBe(1);
  expect(result.afloat, JSON.stringify(result)).toBeGreaterThan(30);
  expect(result.escaped && result.surfaced && result.keptBody, JSON.stringify(result)).toBe(true);
  expect(result.reachedBank, JSON.stringify(result)).toBe(true);
}

test('E20 – na mělčině u Wilsonova mostu zůstane střecha nad vodou a hráč doplave na břeh', { tag: '@webgpu' }, async ({ page }) => {
  const result = await driveIntoRiver(page, { x: 164, z: 438, vx: 23 });
  await checkEscape(result);
  expect(result.removed).toBe(false);
  expect(result.onBottom).toBe(true);
  expect(result.leftRadius && result.returned).toBe(true);
  expect(result.heightChange).toBeLessThan(0.05);
  expect(result.roof).toBeGreaterThan(0);
});

test('E20 – na Radbuze v nádrži České údolí zmizí vůz až po úplném ponoření', { tag: '@webgpu' }, async ({ page }) => {
  const result = await driveIntoRiver(page, { x: -1396, z: 3139, vx: -38 });
  await checkEscape(result);
  expect(result.removed).toBe(true);
  expect(result.seconds, JSON.stringify(result)).toBeGreaterThanOrEqual(6);
  expect(result.seconds).toBeLessThanOrEqual(12);
  expect(result.roof).toBeLessThan(0);
});
