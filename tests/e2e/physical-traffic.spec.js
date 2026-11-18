import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function start(page) {
  await page.goto(gameUrl('/?debug&quality=low'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
}

test('E20 – fyzikální auto zastaví na Doudlevecké a po přednosti pokračuje', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, traffic = w.traffic, manager = g.vehicles;
    const car = g.player.lastCar;
    for (const other of [...manager.cars]) if (other !== car) manager.remove(other);
    manager.obstacles.length = 0;
    const rule = traffic.controls.find((c) => c.kind === 'stop' && c.id === 11969048194 && c.mark === 4248);
    const lane = w.r.w[rule.road] / 4, start = rule.s - 17;
    const p = w.edgePoint(rule.edge, start, lane, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    Object.assign(car, { mode: 'ai', edge: rule.edge, lane, s: start, temper: 1, speed: 8, vx: p.tx * 8, vz: p.tz * 8 });
    manager._pickNext(car);
    g.player.place(car.x + 10, car.z + 10);
    for (let i = 0; i < 20; i++) g.colliders.update(g.player.x, g.player.z);
    g.trafficBodies.update(g, 1 / 60);
    let stopped = 0, front = null;
    for (let tick = 0; tick < 1500; tick++) {
      traffic.tick(1 / 60);
      g.physics.step(1 / 60);
      if (car.edge !== rule.edge || car.s > rule.s + 2) break;
      if (Math.abs(car.speed) < 0.1) {
        stopped += 1 / 60;
        front = rule.s - car.s - car.halfLen;
      }
    }
    return { physical: !!car.physical, stopped, front, passed: car.edge !== rule.edge || car.s > rule.s + 2 };
  });
  expect(result.physical).toBe(true);
  expect(result.stopped, JSON.stringify(result)).toBeGreaterThan(0.3);
  expect(result.front).toBeGreaterThanOrEqual(0);
  expect(result.front).toBeLessThanOrEqual(1);
  expect(result.passed).toBe(true);
});
