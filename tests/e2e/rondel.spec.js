import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('Rondel má průjezdný okruh i obě úrovně u mostů', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    window.__freeze(true);
    const game = window.__game, world = game.world, car = game.player.lastCar;
    const { rOff, rpx, rpz, r } = world;
    game._enterCar(car);
    for (const other of [...game.vehicles.cars]) if (other !== car) game.vehicles.remove(other);

    const point = (node) => [rpx[node], rpz[node]];
    const roadPath = (road) => Array.from({ length: rOff[road + 1] - rOff[road] },
      (_, i) => point(rOff[road] + i));
    const key = ([x, z]) => `${x}:${z}`;
    const ring = Array.from(world.rondel.ring, roadPath);
    const next = new Map(ring.map((path) => [key(path[0]), path]));
    const first = ring.find(([p]) => p[0] < -180 && p[1] > -815);
    const loop = [...first];
    let path = first;
    for (let i = 0; i < ring.length; i++) {
      path = next.get(key(path.at(-1)));
      if (path === first || !path) break;
      loop.push(...path.slice(1));
    }

    function drive(points, upper) {
      const [a, b] = points;
      car.place(...a, Math.atan2(b[0] - a[0], b[1] - a[1]), upper ? Infinity : world.heightAt(...a));
      let index = 1, min = car.y, max = car.y, step = 0;
      let crossingPosition;
      const crossings = new Set();
      let selectedLevel = true;
      for (let tick = 0; tick < 3900 && index < points.length; tick++) {
        const [x, z] = points[index];
        const dx = x - car.x, dz = z - car.z;
        if (Math.hypot(dx, dz) < 3.4) { index++; continue; }
        const target = Math.atan2(dx, dz);
        const diff = Math.atan2(Math.sin(car.yaw - target), Math.cos(car.yaw - target));
        const oldY = car.y;
        const throttle = car.speed > 8 ? 0 : 0.48;
        game.vehicles.stepDynamic(car, 1 / 60, throttle, Math.max(-1, Math.min(1, diff * 1.6)), false);
        step = Math.max(step, Math.abs(oldY - car.y));
        min = Math.min(min, car.y);
        max = Math.max(max, car.y);
        const deck = world.deckAt(car.x, car.z, Infinity, 0);
        if (deck - world.heightAt(car.x, car.z) < 4.5 || (!upper && deck - car.y < 4.5)) continue;
        crossings.add(car.z < -790 ? 'north' : 'south');
        crossingPosition ??= { x: car.x, y: car.y, z: car.z, yaw: car.yaw };
        const road = world.nearestRoad(car.x, car.z, 9, 13, 0, {}, car.y, true);
        selectedLevel &&= Boolean(road) && world.rondel.ring.has(road.road) === upper;
      }
      if (crossingPosition) {
        const { x, y, z, yaw } = crossingPosition;
        car.place(x, z, yaw, y);
        game.unstuck();
        selectedLevel &&= Math.abs(car.y - y) < 0.85;
      }
      return { completed: index === points.length, step, heightRange: max - min,
        crossings: crossings.size, selectedLevel };
    }

    const lower = world.nearestRoad(-137, -707, 6, 13, 0, {}, world.heightAt(-137, -707), true);
    const through = roadPath(lower.road).filter(([, z]) => z < -700 && z > -885);
    return { sections: ring.length, closed: path === first, upper: drive(loop, true), lower: drive(through, false),
      street: world.roadNames[r.name[lower.road]] };
  });
  expect(result.sections).toBeGreaterThanOrEqual(9);
  expect(result.closed).toBe(true);
  expect(result.street).toBe('Karlovarská');
  for (const pass of [result.upper, result.lower]) {
    expect(pass.completed, JSON.stringify(result)).toBe(true);
    expect(pass.crossings, JSON.stringify(result)).toBe(2);
    expect(pass.selectedLevel).toBe(true);
    expect(pass.step).toBeLessThan(0.25);
  }
  expect(result.upper.heightRange).toBeLessThan(1);
  expect(errors).toEqual([]);
});
