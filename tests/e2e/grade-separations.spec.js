import { expect, test } from '@playwright/test';

test('v Bolevci i u Wenzigovy drží auto správnou úroveň křížení', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?debug&view=620&shadows=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();

  const result = await page.evaluate(() => {
    window.__freeze(true);
    const game = window.__game, world = game.world, car = game.player.lastCar;
    game._enterCar(car);
    for (const other of [...game.vehicles.cars]) if (other !== car) game.vehicles.remove(other);

    function drive({ x, z, road, bridgeKind, upper, lead, tail }) {
      const point = world.nearestRoad(x, z, 4, 13, 0, {},
        upper ? world.deckAt(x, z, Infinity, bridgeKind) : world.heightAt(x, z), true);
      const start = [point.x - lead * point.dx, point.z - lead * point.dz];
      const yaw = Math.atan2(point.dx, point.dz);
      const deck = world.deckAt(x, z, Infinity, bridgeKind);
      car.place(...start, yaw, upper ? Infinity : world.heightAt(...start));
      let closest = Infinity, height, largestStep = 0;
      for (let tick = 0; tick < 900; tick++) {
        const previousY = car.y;
        game.vehicles.stepDynamic(car, 1 / 60, car.speed < 5 ? 0.38 : 0, 0, false);
        largestStep = Math.max(largestStep, Math.abs(car.y - previousY));
        const distance = Math.hypot(car.x - x, car.z - z);
        if (distance < closest) { closest = distance; height = car.y; }
        if ((car.x - x) * point.dx + (car.z - z) * point.dz > tail) break;
      }
      return { road: world.roadNames[world.r.name[point.road]], expectedRoad: road,
        closest, largestStep, deckGap: deck - height,
        progress: (car.x - x) * point.dx + (car.z - z) * point.dz };
    }

    const passes = [
      drive({ x: 587.09, z: -3150.72, road: 'U Velkého rybníka', bridgeKind: 2, upper: false, lead: 11, tail: 9 }),
      drive({ x: 978.57, z: 227.78, road: 'Wenzigova', bridgeKind: 0, upper: false, lead: 14, tail: 6 }),
      drive({ x: 978.57, z: 227.78, road: 'most Nad Nádražím', bridgeKind: 0, upper: true, lead: 18, tail: 14 }),
    ];
    const [x, z] = [970.94, 233.65];
    return { passes, cyclewayGap: world.deckAt(x, z, Infinity, 3) - world.heightAt(x, z) };
  });

  for (const pass of result.passes) {
    expect(pass.road).toBe(pass.expectedRoad);
    expect(pass.closest).toBeLessThan(0.45);
    expect(pass.progress).toBeGreaterThan(5.9);
    expect(pass.largestStep).toBeLessThan(0.25);
  }
  expect(result.passes[0].deckGap).toBeCloseTo(4.4, 0);
  expect(result.passes[1].deckGap).toBeCloseTo(7.4, 0);
  expect(Math.abs(result.passes[2].deckGap)).toBeLessThan(0.25);
  expect(result.cyclewayGap).toBeGreaterThan(6);
  expect(errors).toEqual([]);
});

test('D5 navazuje u Šlovic a má volný prostor pod mosty v Černicích, Ejpovicích a Liticích', async ({ page }) => {
  await page.goto('/?debug&view=620&shadows=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    window.__freeze(true);
    const game = window.__game, world = game.world, car = game.player.lastCar;
    game._enterCar(car);
    for (const other of [...game.vehicles.cars]) if (other !== car) game.vehicles.remove(other);

    function approachGrade(from, to) {
      let previousY, maxGrade = 0;
      for (let distance = -24; distance <= 32; distance++) {
        const edge = distance < 0 ? from : to;
        const d = distance < 0 ? world.eLen[from] + distance : distance;
        const { x, z, seg, t } = world.edgePoint(edge, d, 0, {});
        const surface = world.roadSurfaceY(world.eRoad[edge], seg, t, x, z);
        const y = world.groundY(x, z, surface);
        if (previousY !== undefined) maxGrade = Math.max(maxGrade, Math.abs(y - previousY));
        previousY = y;
      }
      return maxGrade;
    }

    const [portal] = [...world.trackUnderpasses.values()].flat();
    const [x, z, endX, endZ, , clearance] = portal;
    const length = Math.hypot(endX - x, endZ - z);
    const dx = (endX - x) / length, dz = (endZ - z) / length;
    const start = [x - dx * 8, z - dz * 8];
    car.place(...start, Math.atan2(dx, dz), world.heightAt(...start));
    let travelled = 0, airTicks = 0;
    for (let tick = 0; tick < 1300 && travelled < length + 5; tick++) {
      game.vehicles.stepDynamic(car, 1 / 60, car.speed < 5 ? 0.38 : 0, 0, false);
      travelled = (car.x - x) * dx + (car.z - z) * dz;
      airTicks += Number(car.air);
    }
    function deckGap(x, z) {
      return world.deckAt(x, z, Infinity, 0) - world.heightAt(x, z);
    }
    return {
      grades: [approachGrade(8011, 8012), approachGrade(27406, 8010)],
      cernice: [deckGap(4261.28, 4545.70), deckGap(4273.03, 4550.68)],
      ejpovice: [deckGap(9496.03, 1290.33), deckGap(9485.69, 1282.94)],
      litice: [deckGap(-1152.25, 6925.86), deckGap(-1145.4, 6948.32)],
      clearance, airTicks, beyondPortal: travelled - length, health: car.health,
    };
  });

  expect(Math.max(...result.grades)).toBeLessThan(0.12);
  expect(Math.min(...result.cernice)).toBeGreaterThan(8.7);
  expect(Math.min(...result.ejpovice)).toBeGreaterThan(7.9);
  expect(Math.min(...result.litice)).toBeGreaterThan(6);
  expect(result.clearance).toBeGreaterThan(4);
  expect(result.beyondPortal).toBeGreaterThan(4);
  expect(result.airTicks).toBe(0);
  expect(result.health).toBe(100);
});
