import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { prepareCollisionLab } from './collision-lab.js';
import { terrainTriangles } from '../../src/physics/terrain.js';
import { layers } from '../../src/physics/world.js';

// Dno obou nádrží vzniká z polygonu stejným postupem jako dno vodních ploch v mapě.
async function driveIntoWater(page, { halfWidth, depthScale, speed }) {
  // Pevné datum a hodina: mokro a sníh podle dne mění přilnavost kol na břehu před nádrží.
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await prepareCollisionLab(page);
  const surface = 1028, farBank = 116;
  const pond = { i: 0, x0: 0, x1: farBank, z0: -halfWidth, z1: halfWidth };
  const floor = [];
  terrainTriangles({
    water: [pond], l: { pRing: [0, 1], ringStart: [0, 4], vx: [0, farBank * 10, farBank * 10, 0],
      vz: [-halfWidth, -halfWidth, halfWidth, halfWidth].map(z => z * 10) },
    heightAt: () => surface, landContains: () => false, tunnels: [], tG: 4,
    gradeTerrain: new Map(), terrainDetail: new Map(),
  }, 0, -128, -128, 256, (...triangle) => {
    for (const [x, y, z] of triangle) floor.push(x, surface - (surface - y) * depthScale, z);
  });
  return page.evaluate(({ floor, pond, surface, layer, speed }) => {
    const g = __game, w = g.world, p = g.player, car = p.lastCar;
    const x = -12, z = 0;
    const bed = g.colliders.roadFurniture.meshBody(g.physics, Float32Array.from(floor), layer);
    g.colliders.tiles.get(w.chunkIndex(x, z)).push(bed);
    w.heightAt = w.groundY = w.surfaceAt = () => surface;
    w.isWater = (px, pz) => px > pond.x0 && px < pond.x1 && pz > pond.z0 && pz < pond.z1;
    w.onRoad = () => false;
    car.place(x, z, Math.PI / 2, surface);
    g._enterCar(car);
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    car.vx = speed;
    car.speed = speed;
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
  }, { floor, pond, surface, layer: layers.STATIC, speed });
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

test('E20 – na mělčině zkušební nádrže zůstane střecha nad vodou a hráč doplave na břeh', { tag: '@webgpu' }, async ({ page }) => {
  const result = await driveIntoWater(page, { halfWidth: 13, depthScale: 1, speed: 23 });
  await checkEscape(result);
  expect(result.removed).toBe(false);
  expect(result.onBottom).toBe(true);
  expect(result.leftRadius && result.returned).toBe(true);
  expect(result.heightChange).toBeLessThan(0.05);
  expect(result.roof).toBeGreaterThan(0);
});

test('E20 – v hluboké zkušební nádrži zmizí vůz až po úplném ponoření', { tag: '@webgpu' }, async ({ page }) => {
  const result = await driveIntoWater(page, { halfWidth: 90, depthScale: 2, speed: 38 });
  await checkEscape(result);
  expect(result.removed).toBe(true);
  expect(result.seconds, JSON.stringify(result)).toBeGreaterThanOrEqual(6);
  expect(result.seconds).toBeLessThanOrEqual(12);
  expect(result.roof).toBeLessThan(0);
});

test('E20 – plavec v mapě Radbuzy doplave na suchý břeh', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    window.__freeze(true);
    const { world, player, colliders } = window.__game;
    const x = -1437, z = 3139;
    for (let i = 0; i < 25; i++) colliders.update(x, z);
    player.place(x, z, world.heightAt(x, z));
    let atSurface = false;
    for (let tick = 0; tick < 2400; tick++) {
      player.update(1 / 60, 1, 0, false, false);
      if (player.swimming && Math.abs(player.y - world.heightAt(player.x, player.z)) < 0.25) atSurface = true;
      if (player.grounded && !world.isWater(player.x, player.z) && !player.swimming) break;
    }
    return { startedWet: world.isWater(x, z), atSurface, walked: player.grounded &&
      !player.swimming && !world.isWater(player.x, player.z), distance: player.x - x };
  });
  expect(result).toMatchObject({ startedWet: true, atSurface: true, walked: true });
  expect(result.distance).toBeGreaterThan(1);
});
