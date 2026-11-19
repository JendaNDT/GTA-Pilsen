// Souvislý průjezd hráčova vozu po trasách E12. Pro opakovatelný test povrchu
// jede vůz sám. Řidič smí používat pouze volant, plyn, brzdu a zpátečku.
import { chromium } from '@playwright/test';
import { webgpuFlags } from '../tests/e2e/browser-flags.js';
import { appendFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const loops = process.argv.includes('--okruhy');
const log = process.argv.find(arg => arg.startsWith('--zaznam='))?.slice(9);

const target = new URL(process.argv[2] ?? 'http://127.0.0.1:4173/');
for (const [key, value] of Object.entries({ debug: '', quality: 'low', adapt: '0', date: '2026-11-17', hour: '10', weather: 'clear' })) target.searchParams.set(key, value);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  ...(process.argv.includes('--software-webgpu') && { channel: 'chromium', args: webgpuFlags }) });
try {
  const page = await browser.newPage(loops ? { viewport: { width: 320, height: 192 } } : {});
  page.setDefaultTimeout(300000);
  if (loops) await page.exposeFunction('recordDrive', async entry => {
    const line = JSON.stringify(entry) + '\n';
    if (log) await appendFile(log, line);
    else process.stdout.write(line);
  });
  await page.goto(target.href);
  await page.waitForFunction(() => window.__ready);
  const report = await page.evaluate(async ({reverse,loops}) => {
    const game = window.__game, world = game.world, car = game.player.lastCar;
    const locations = [[game.player.x, game.player.z], world.meta.places.find((p) => p[2] === 'Klabava'),
      world.meta.landmarks.find((p) => p[2] === 'Masarykovo náměstí (Rokycany)'),
      world.meta.places.find((p) => p[2] === 'Hrádek'), world.meta.walkingApproaches['Vodní hamr Dobřív']];
    if (reverse) locations.reverse();
    const nodes = locations.map(([x, z]) => world.nearestNode(x, z, 250));
    const ends = [], samples = [];
    if (loops) {
      const round = [...nodes, ...nodes.slice(0, -1).reverse()];
      nodes.length = 0;
      nodes.push(round[0]);
      for (let lap = 0; lap < 4; lap++) nodes.push(...round.slice(1));
      window.__freeze(true);
    }
    const points = [];
    for (let leg = 1; leg < nodes.length; leg++) {
      for (const edge of world.findPath(nodes[leg - 1], nodes[leg], 12000)) {
        for (let d = 0; d < world.eLen[edge]; d += 2) {
          const p = world.edgePoint(edge, d, 0, {});
          if (!points.length || Math.hypot(p.x - points.at(-1).x, p.z - points.at(-1).z) > 0.8) points.push(p);
        }
      }
      if (loops && leg % (2 * (locations.length - 1)) === 0) ends.push(points.length - 1);
    }
    if (points.length < 2) throw new Error('Plánovač nenašel trasu pro zkušební jízdu.');
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
    let recoveryStart = 0, repeatedAttempts = 0;
    for (let tick = 0; tick < (loops ? 8 * 300000 : 300000); tick++) {
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
      // Po vyjetí ze středu směruj před vůz po trase, aby se neotáčel k bodu za sebou.
      if (loops && best > 2.5) {
        aim = index;
        let ahead = 0;
        while (aim + 1 < points.length && ahead < look) {
          ahead += Math.hypot(points[aim + 1].x - points[aim].x, points[aim + 1].z - points[aim].z);
          aim++;
        }
      }
      const dx = points[aim].x - car.x, dz = points[aim].z - car.z;
      const relativeAngle = (yaw) => Math.atan2(Math.sin(yaw - car.yaw), Math.cos(yaw - car.yaw));
      const angle = relativeAngle(Math.atan2(dx, dz));
      const limit = Math.min(1, 0.13 + 32 / (32 + car.speed ** 2));
      let steer = input(-Math.atan2(2 * vehicle.spec.wheelbase * Math.sin(angle), Math.hypot(dx, dz)) / (0.62 * limit));
      const ahead = points[Math.min(points.length - 1, index + 8)];
      const bend = Math.abs(relativeAngle(Math.atan2(ahead.tx, ahead.tz)));
      const speed = Math.min(points[index].safeSpeed, 14 / (1 + 3 * bend), loops && best > 2.5 ? 3.5 : Infinity);
      let throttle = input((speed - car.speed) * 0.6);
      if (!reverseTurn && Math.abs(angle) > 2.55) reverseTurn = Math.sign(angle);
      if (reverseTurn && Math.abs(angle) < 1.65) reverseTurn = 0;
      if (reverseTurn && best < 7) { steer = reverseTurn; throttle = input((-2.5 - car.speed) * 0.85); }
      if (tick - lastAdvance > 100 && Math.abs(car.speed) < 0.45 && !backing) {
        backing = 100; lastAdvance = tick; attempts++;
        if (index - recoveryStart > 20) { recoveryStart = index; repeatedAttempts = 0; }
        repeatedAttempts++;
      }
      // Rozjetí vzad potřebuje několik kroků i s volantem blízko přímého směru.
      if (backing && best < 7 && (loops || Math.abs(angle) > 0.35)) {
        backing--;
        throttle = input((-3.5 - car.speed) * 0.8);
        steer = loops ? input(angle) : Math.sign(angle);
      } else backing = 0;

      const { x, z } = car;
      if (loops) {
        window.__setInput(steer, throttle);
        game.update(1 / 60);
        if (tick % 300 === 0) {
          game.render();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      } else {
        game.colliders.update(x, z);
        vehicle.drive(1 / 60, throttle, steer, false, true, game.tireSurface);
        game.physics.engine.Step(1 / 60, 1);
        vehicle.read();
        if (vehicle.impactSpeed > 0) game.onCrash(car, vehicle.applyImpact(), null);
      }
      maxDrop = Math.max(maxDrop, world.groundY(car.x, car.z, car.y + 1) - car.y);
      distance += Math.hypot(car.x - x, car.z - z);
      const seconds = (tick + 1) / 60;
      if (game.car !== car || tick - lastAdvance > 360 || (loops ? repeatedAttempts : attempts) > 25 || best > 12 || maxDrop > 1) {
        throw new Error(JSON.stringify({ seconds, distance, maxDrop, x: car.x, z: car.z, best, attempts, index, aim, angle, speed: car.speed, desired: speed, steer, health: car.health, target: [points[aim].x, points[aim].z] }));
      }
      if (loops && tick % 3600 === 0) {
        await window.recordDrive({ kind: 'prujezd', seconds, distance, maxDrop, index, attempts });
      }
      if (loops && index >= ends[samples.length] - 2) {
        game.render();
        await game.renderer.backend.device?.queue.onSubmittedWorkDone();
        const { textures, geometries } = window.__perf.renderStats();
        const sample = {
          kind: 'navrat', lap: samples.length + 1, seconds, distance, maxDrop, textures, geometries,
          bodies: game.physics.system.GetNumBodies(), debris: game.physics.debris.items.size,
        };
        samples.push(sample);
        await window.recordDrive(sample);
      }
      if (index >= points.length - 2 && Math.hypot(car.x - end.x, car.z - end.z) < 4) {
        return { reverse, seconds, distance, maxDrop, health: car.health, attempts, ...(loops && {samples}) };
      }
    }
    throw new Error('Řidič nedojel do cíle ve stanoveném čase.');
  }, { reverse: process.argv.includes('--zpet'), loops });
  console.log(JSON.stringify(report, null, 2));
  if (loops) {
    const samples = report.samples;
    assert.equal(samples.length, 4, 'Chybí návrat do výchozího místa.');
    for (const key of ['textures', 'geometries', 'bodies', 'debris']) {
      assert.ok(samples[3][key] <= samples[2][key],
        `Mezi třetím a čtvrtým návratem vzrostl počet ${key} z ${samples[2][key]} na ${samples[3][key]}.`);
    }
  }
  assert.ok(report.seconds >= 1800 && report.distance >= 24000, 'Zkušební jízda byla příliš krátká.');
} finally {
  await browser.close();
}
