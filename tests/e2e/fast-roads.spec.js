import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('při rychlé jízdě po Karlovarské a dálnici zůstanou všechna čtyři kola na vozovce', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  const rides = await page.evaluate(() => {
    const game = window.__game, world = game.world, car = game.player.lastCar;
    game._enterCar(car);
    game.paused = false;
    game.vehicles.spawnTimer = game.peds.timer = 1e5;
    game.transit._dispatch = () => {};
    for (const v of game.transit.vehicles) game.transit._dispose(v);
    game.transit.vehicles.length = 0;
    game.transit.active.clear();
    for (const other of [...game.vehicles.cars]) if (other !== car) game.vehicles.remove(other);

    return [[53, 25, 4, 450, 315], [2846, 25, 4, 320, 130], [97, 33.3, 100, 700, 575]].map(([road, speed, start, end, checkAt]) => {
      const first = world.rOff[road], last = world.rOff[road + 1] - 1, stations = world.roadGrade.station;
      function target(distance) {
        let k = first;
        while (k + 1 < last && stations[k + 1] < distance) k++;
        const dx = world.rpx[k + 1] - world.rpx[k], dz = world.rpz[k + 1] - world.rpz[k];
        const length = Math.hypot(dx, dz), t = Math.max(0, Math.min(1, (distance - stations[k]) / length));
        const side = 0.26 * world.r.w[road];
        return { x: world.rpx[k] + dx * t + dz / length * side, z: world.rpz[k] + dz * t - dx / length * side,
          dx: dx / length, dz: dz / length };
      }
      const origin = target(start);
      car.place(origin.x, origin.z, Math.atan2(origin.dx, origin.dz), world.groundY(origin.x, origin.z));
      window.__setInput(0, 0);
      for (let tick = 0; tick < 75; tick++) game.update(1 / 60);
      const driver = game.driver;
      driver.velocity.Set(origin.dx * speed, 0, origin.dz * speed);
      driver.body.SetLinearVelocity(driver.velocity);
      for (const wheel of driver.wheels) wheel.SetAngularVelocity(speed / wheel.GetSettings().mRadius);

      let station = start, samples = 0, lostContact = 0, maxSpeed = 0, fastSamples = 0, maxError = 0;
      let previousVy = null, acceleration = 0, checkSpeed = Infinity;
      for (let tick = 0; tick < 2400 && station < end - 12; tick++) {
        const pt = target(station);
        station += Math.max(0, (car.x - pt.x) * pt.dx + (car.z - pt.z) * pt.dz);
        const ahead = target(station + 15), yaw = Math.atan2(ahead.x - car.x, ahead.z - car.z) - car.yaw;
        const steer = Math.atan2(Math.sin(yaw), Math.cos(yaw));
        window.__setInput(Math.max(-1, Math.min(1, -steer * 2)), Math.max(0, Math.min(1, (speed - car.speed) * 0.7)));
        game.update(1 / 60);
        if (station < start + 31 || station > end - 15) continue;
        samples++;
        const actual = target(station);
        maxError = Math.max(maxError, Math.hypot(actual.x - car.x, actual.z - car.z));
        maxSpeed = Math.max(maxSpeed, car.speed * 3.6);
        if (Math.abs(station - checkAt) < 6) checkSpeed = Math.min(checkSpeed, car.speed * 3.6);
        if (car.speed > speed * 0.92) fastSamples++;
        if (driver.wheels.some(wheel => !wheel.HasContact())) lostContact++;
        if (previousVy !== null) acceleration = Math.max(acceleration, Math.abs(car.vy - previousVy) * 60);
        previousVy = car.vy;
      }
      return { road, station, end, samples, fastSamples, checkSpeed, maxSpeed, lostContact, maxError, acceleration };
    });
  });
  for (const ride of rides) {
    const info = JSON.stringify(ride);
    expect(ride.station, info).toBeGreaterThanOrEqual(ride.end - 12);
    expect(ride.samples, info).toBeGreaterThan(400);
    expect(ride.fastSamples, info).toBeGreaterThan(120);
    expect(Number.isFinite(ride.checkSpeed), info).toBe(true);
    expect(ride.checkSpeed, info).toBeGreaterThan(ride.road === 97 ? 110 : 83);
    expect(ride.lostContact, info).toBe(0);
    expect(ride.maxError, info).toBeLessThan(1.5);
    expect(ride.acceleration, info).toBeLessThan(9);
  }
});
