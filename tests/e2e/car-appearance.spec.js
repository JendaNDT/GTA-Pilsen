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
  // Pevné datum: déšť, mlha a sníh se losují podle dne a mění, které efekty se v noci vykreslí.
  await page.goto(gameUrl('/?debug&quality=medium&view=300&adapt=0&date=2026-11-09&hour=22'));
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

test('Fabia ukazuje rejd na místě i odvalování při jízdě a couvání @webgpu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=12'));
  await waitForGame(page);
  const result = await page.evaluate(() => {
    window.__freeze(true);
    const g = window.__game, car = g.player.lastCar;
    car.place(-23, 43, 0.4);
    g._enterCar(car);
    g.paused = false;
    const wheels = car.mesh.userData.wheels;
    const matrix = car.mesh.matrix.clone();
    const read = () => Array.from({ length: 4 }, (_, i) => {
      wheels.getMatrixAt(i, matrix);
      const side = i % 2 ? -1 : 1;
      return { steer: Math.atan2(-side * matrix.elements[2], side * matrix.elements[0]),
        roll: Math.atan2(matrix.elements[9] * -side, matrix.elements[5]) };
    });
    const step = (steer, gas, count) => {
      window.__setInput(steer, gas);
      for (let i = 0; i < count; i++) g.update(1 / 60);
      return read();
    };
    const right = step(1, 0, 60);
    const left = step(-1, 0, 60);
    step(0, 1, 60);
    const spin = () => {
      const previous = read();
      g.update(1 / 60);
      return read().map((wheel, i) => {
        const difference = wheel.roll - previous[i].roll;
        return Math.atan2(Math.sin(difference), Math.cos(difference));
      });
    };
    const forward = spin();
    step(0, -1, 175);
    return { name: car.type.name, right, left, forward, reverse: spin(), speed: car.speed };
  });
  expect(result.name).toContain('Fabia');
  for (let i = 0; i < 4; i++) {
    if (i < 2) {
      expect(result.right[i].steer).toBeLessThan(-0.3);
      expect(result.left[i].steer).toBeGreaterThan(0.3);
    } else {
      expect(Math.abs(result.left[i].steer)).toBeLessThan(0.001);
      expect(Math.abs(result.right[i].steer)).toBeLessThan(0.001);
    }
    expect(result.forward[i]).toBeGreaterThan(0.01);
    expect(result.reverse[i]).toBeLessThan(-0.01);
  }
  expect(result.speed).toBeLessThan(-0.5);
});

test('ostatní karoserie lze na nízkou kvalitu řídit s pohyblivými koly @webgpu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=12'));
  await waitForGame(page);
  const results = await page.evaluate(() => {
    window.__freeze(true);
    const g = window.__game, Car = g.player.lastCar.constructor;
    g.paused = false;
    return ['sedan','kombi','suv','van','sport','pickup','taxi','police'].map((id, i) => {
      const car = g.vehicles.add(new Car(id, 0x698499));
      car.place(-36 + 4*i, 43, 0.2);
      g._enterCar(car);
      window.__setInput(0.5, 1);
      for (let tick = 0; tick < 35; tick++) g.update(1/60);
      const matrix = car.mesh.matrix.clone(), wheels = car.mesh.userData.wheels;
      wheels.getMatrixAt(0, matrix);
      const result = { id, speed: car.speed, steer: Math.abs(matrix.elements[2]), count: wheels.count };
      window.__setInput(0,0);
      g._exitCar();
      return result;
    });
  });
  for (const car of results) {
    expect(car.count, car.id).toBe(4);
    expect(car.steer, car.id).toBeGreaterThan(0.05);
    expect(car.speed, car.id).toBeGreaterThan(0.1);
  }
});
