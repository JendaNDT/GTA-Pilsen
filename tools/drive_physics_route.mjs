// Souvislý průjezd hráčova vozu po trasách E12. Pro opakovatelný test povrchu
// jede vůz sám. Řidič smí používat pouze volant, plyn, brzdu a zpátečku.
import { chromium } from '@playwright/test';

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:4173/');
for (const [key, value] of Object.entries({ debug: '', quality: 'low', adapt: '0', hour: '10' })) target.searchParams.set(key, value);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
try {
  const page = await browser.newPage();
  await page.goto(target.href);
  await page.waitForFunction(() => window.__ready);
  const report = await page.evaluate((reverse) => {
    const game = window.__game, world = game.world, car = game.player.lastCar;
    const locations = [[game.player.x, game.player.z], world.meta.places.find((p) => p[2] === 'Klabava'),
      world.meta.landmarks.find((p) => p[2] === 'Masarykovo náměstí (Rokycany)'),
      world.meta.places.find((p) => p[2] === 'Hrádek'), world.meta.walkingApproaches['Vodní hamr Dobřív']];
    if (reverse) locations.reverse();
    const nodes = locations.map(([x, z]) => world.nearestNode(x, z, 250));
    const points = [];
    for (let leg = 1; leg < nodes.length; leg++) {
      for (const edge of world.findPath(nodes[leg - 1], nodes[leg], 12000)) {
        for (let d = 0; d < world.eLen[edge]; d += 2) {
          const p = world.edgePoint(edge, d, 0, {});
          if (!points.length || Math.hypot(p.x - points.at(-1).x, p.z - points.at(-1).z) > 0.8) points.push(p);
        }
      }
    }
    const end = points.at(-1);
    end.safeSpeed = 0;
    for (let i = points.length - 2; i >= 0; i--) {
      const p = points[i], next = points[i + 1];
      const length = Math.hypot(p.x - next.x, p.z - next.z);
      const turn = Math.acos(Math.max(-1, Math.min(1, p.tx * next.tx + p.tz * next.tz)));
      p.safeSpeed = Math.min(14, Math.sqrt(next.safeSpeed ** 2 + 5 * length),
        Math.sqrt(2.5 * Math.max(0.4, length) / Math.max(0.001, turn)));
    }

    const start = points[0];
    car.place(start.x, start.z, Math.atan2(start.tx, start.tz));
    game._enterCar(car);
    game.vehicles.spawnTimer = game.peds.timer = Infinity;
    game.paused = false;
    game.update(1 / 60);
    // První běžný snímek založí vůz a fyziku kolem něj.
    for (const other of [...game.vehicles.cars]) if (other !== car) game.vehicles.remove(other);
    game.trafficBodies.update(game, 1 / 60);
    const vehicle = game.driver;
    const input = (value) => Math.max(-1, Math.min(1, value));
    let index = 0, distance = 0, maxDrop = 0, lastAdvance = 0, reverseTurn = 0, backing = 0, attempts = 0;
    for (let tick = 0; tick < 300000; tick++) {
      let nearest = index, best = Infinity;
      for (let k = index; k < Math.min(index + 16, points.length); k++) {
        const d = Math.hypot(points[k].x - car.x, points[k].z - car.z);
        if (d < best) { best = d; nearest = k; }
      }
      if (nearest !== index) lastAdvance = tick;
      index = nearest;
      let aim = index;
      const look = 3.5 + Math.max(0, car.speed) * 0.32;
      while (aim + 1 < points.length && Math.hypot(points[aim].x - car.x, points[aim].z - car.z) < look) aim++;
      const dx = points[aim].x - car.x, dz = points[aim].z - car.z;
      const relativeAngle = (yaw) => Math.atan2(Math.sin(yaw - car.yaw), Math.cos(yaw - car.yaw));
      const angle = relativeAngle(Math.atan2(dx, dz));
      const limit = Math.min(1, 0.13 + 32 / (32 + car.speed ** 2));
      let steer = input(-Math.atan2(2 * vehicle.spec.wheelbase * Math.sin(angle), Math.hypot(dx, dz)) / (0.62 * limit));
      const ahead = points[Math.min(points.length - 1, index + 8)];
      const bend = Math.abs(relativeAngle(Math.atan2(ahead.tx, ahead.tz)));
      const speed = Math.min(points[index].safeSpeed, 14 / (1 + 3 * bend));
      let throttle = input((speed - car.speed) * 0.6);
      if (!reverseTurn && Math.abs(angle) > 2.55) reverseTurn = Math.sign(angle);
      if (reverseTurn && Math.abs(angle) < 1.65) reverseTurn = 0;
      if (reverseTurn && best < 7) { steer = reverseTurn; throttle = input((-2.5 - car.speed) * 0.85); }
      if (tick - lastAdvance > 100 && Math.abs(car.speed) < 0.45 && !backing) {
        backing = 100; lastAdvance = tick; attempts++;
      }
      if (backing && best < 7 && Math.abs(angle) > 0.35) {
        backing--; throttle = input((-3.5 - car.speed) * 0.8); steer = Math.sign(angle);
      } else backing = 0;

      const { x, z } = car;
      game.colliders.update(x, z);
      vehicle.drive(1 / 60, throttle, steer, false, true, game.tireSurface);
      game.physics.engine.Step(1 / 60, 1);
      vehicle.read();
      if (vehicle.impactSpeed > 0) game.onCrash(car, vehicle.applyImpact(), null);
      maxDrop = Math.max(maxDrop, world.groundY(car.x, car.z, car.y + 1) - car.y);
      distance += Math.hypot(car.x - x, car.z - z);
      const seconds = (tick + 1) / 60;
      if (game.car !== car || tick - lastAdvance > 360 || attempts > 25 || best > 12 || maxDrop > 1) {
        throw new Error(JSON.stringify({ seconds, distance, maxDrop, x: car.x, z: car.z, best, attempts }));
      }
      if (index >= points.length - 2 && Math.hypot(car.x - end.x, car.z - end.z) < 4) {
        return { reverse, seconds, distance, maxDrop, health: car.health, attempts };
      }
    }
    throw new Error('Řidič nedojel do cíle ve stanoveném čase.');
  }, process.argv.includes('--zpet'));
  console.log(JSON.stringify(report, null, 2));
  if (report.seconds < 1800 || report.distance < 24000) process.exitCode = 1;
} finally {
  await browser.close();
}
