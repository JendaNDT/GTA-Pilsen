import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E19 – vystoupení na mostě, v tunelu a po přistání na střeše', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  await page.waitForFunction(() => window.__ready);
  const results = await page.evaluate(() => {
    const g = window.__game, w = g.world, player = g.player, car = player.lastCar;
    const walk = (dx, dz) => {
      const x = player.x, z = player.z, y = player.y;
      for (let i = 0; i < 70; i++) player.update(1 / 60, dx, dz, false, false);
      return { distance: Math.hypot(player.x - x, player.z - z), heightChange: player.y - y,
        grounded: player.grounded, height: player.y, mode: g.mode };
    };
    const road = [...w.archedBridges.keys()].find(i => w.roadNames[w.r.name[i]] === 'Wilsonův most');
    const k = w.rOff[road], end = w.rOff[road + 1] - 1;
    const bridge = { x: (w.rpx[k] + w.rpx[end]) / 2, z: (w.rpz[k] + w.rpz[end]) / 2,
      y: (w.rpy[k] + w.rpy[end]) / 2 };
    const tube = w.tunnels[0], mid = Math.floor(tube.points.length / 2);
    const results = [];
    for (const [spot, dx, dz] of [
      [bridge, w.rpx[end] - w.rpx[k], w.rpz[end] - w.rpz[k]],
      [tube.points[mid], tube.points[mid + 1].x - tube.points[mid].x, tube.points[mid + 1].z - tube.points[mid].z],
    ]) {
      const length = Math.hypot(dx, dz);
      car.place(spot.x, spot.z, Math.atan2(dx, dz), spot.y);
      g._enterCar(car);
      const seated = !player.character;
      g.doAction();
      results.push({ seated, expected: spot.y, ...walk(dx / length, dz / length) });
    }

    // Mimo měřený střed zvolíme velkou plochou střechu se stejnou výškou
    // pod vrtulníkem, vedle dveří i na konci krátké pěší trasy.
    for (let i = 0; i < w.bCount; i++) {
      const x = (w.bMinX[i] + w.bMaxX[i]) / 2, z = (w.bMinZ[i] + w.bMaxZ[i]) / 2;
      if (w.bTop[i] - w.heightAt(x, z) < 6 || g.colliders.replaced.has(i)) continue;
      if (![0, 2.2, 5.2].every(offset => w.buildingAt(x + offset, z) === i)) continue;
      const h = g.helis[0];
      g._enterHeli(h);
      const seated = !player.character;
      h.x = x; h.z = z; h.y = w.bTop[i] + 0.3; h.yaw = 0; h.vy = -1;
      for (let j = 0; j < 120 && (j === 0 || !h.landed); j++) h.update(1 / 60, 0, 0, -1);
      g.doAction();
      results.push({ seated, landed: h.landed, expected: w.bTop[i], ...walk(1, 0) });
      break;
    }
    return results;
  });
  expect(results).toHaveLength(3);
  expect(results[2].landed).toBe(true);
  for (const sample of results) {
    expect(sample.seated).toBe(true);
    expect(sample.mode).toBe('foot');
    expect(sample.grounded, JSON.stringify(sample)).toBe(true);
    expect(sample.distance).toBeGreaterThan(2);
    expect(Math.abs(sample.height - sample.expected), JSON.stringify(sample)).toBeLessThan(0.35);
  }
});
