import { waitForGame } from './ready.js';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E24 – dvě světla hráče sledují karoserii a přepnutí dálkových světel @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', m => {
    if (/error.*shader|shader.*error|invalid shader module|validation error/i.test(m.text())) errors.push(m.text());
  });
  await page.setViewportSize({ width: 400, height: 280 });
  await page.goto(gameUrl('/?debug&quality=medium&view=300&adapt=0&hour=22'));
  await waitForGame(page);
  const state = await page.evaluate(async () => {
    __freeze(true);
    const g = __game;
    const car = g.vehicles.cars.find(c => c.mode === 'parked');
    g._enterCar(car);
    g.render();
    const beams = g.nightLights.playerBeams;
    const low = beams[0].distance;
    const spacing = beams[0].position.distanceTo(beams[1].position);
    car.highBeam = true;
    g.render();
    await g.renderer.backend.device?.queue.onSubmittedWorkDone();
    const visible = beams.filter(l => l.visible && l.isSpotLight && l.intensity > 0).length;
    const { body, detail } = car.mesh.userData.batches;
    return { visible, spacing, low, high: beams[0].distance, physical: !!body.material.isMeshPhysicalNodeMaterial,
      eyes: new Set(detail.geometry.attributes.aLens.array).size, clustered: g.renderer.lighting === g.nightLights.clustered };
  });
  expect(state.visible).toBe(2);
  expect(state.spacing).toBeGreaterThan(1);
  expect(state.high).toBeGreaterThan(state.low);
  expect(state.physical && state.clustered).toBe(true);
  expect(state.eyes).toBe(4);
  expect(errors).toEqual([]);
});
