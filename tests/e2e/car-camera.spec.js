import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('Kamera při rozjezdu sleduje vykreslené auto i mezi kroky fyziky', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    window.__freeze(true);
    const game = window.__game;
    const car = game.player.lastCar ?? game.vehicles.cars.find(c => c.mode === 'parked');
    game._enterCar(car);
    window.__setInput(0, 1);
    const toTarget = game.camera.position.clone();
    const direction = toTarget.clone();
    let maxError = 0, betweenSteps = 0;
    for (let i = 0; i < 360; i++) {
      const oldX = car.x, oldZ = car.z;
      game.update(1 / 120);
      if (car.speed < 1 || oldX !== car.x || oldZ !== car.z) continue;
      betweenSteps++;
      toTarget.copy(car.mesh.position);
      toTarget.x += 1.5 * Math.sin(game.camYaw);
      toTarget.y += 1.45;
      toTarget.z += 1.5 * Math.cos(game.camYaw);
      toTarget.sub(game.camera.position);
      game.camera.getWorldDirection(direction);
      maxError = Math.max(maxError, direction.cross(toTarget).length());
    }
    return { betweenSteps, maxError };
  });
  expect(result.betweenSteps).toBeGreaterThan(30);
  expect(result.maxError).toBeLessThan(0.0001);
});
