import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E73 – vystupující z linky 49 dojde od předních dveří přes Mikulášskou k nádražní budově', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 400 });
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=9.8'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, { player, world, peds, transit, clock } = g;
    const event = transit.timetable.events(clock.day).find(e => e.day === clock.day && e.trip.id === '692216');
    const index = event.trip.stops.length - 1;
    player.place(745, 344);
    __setClock('2026-11-09', event.trip.times[index * 2] / 3600);
    const vehicle = transit.active.get(event.key);
    const loaded = () => [...g.chunks.heritage.streetSections.values()].flat().some(f => f.id.includes('8118968785'));
    const deadline = performance.now() + 45_000;
    while (!loaded()) {
      if (performance.now() > deadline) throw Error('U vstupu chybí vybavení přednádraží.');
      g.chunks.update(700, 420, 340, 60, player.y);
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    const focus = { x: player.x, z: player.z };
    let walker, exit, doorDistance, distance = 0, maxStep = 0, blocked = 0, roadEntry = null, viaMikulasska = false;
    for (let i = 0; i < 4600; i++) {
      if (i < 150) transit.update(0.1, focus, [], false, clock);
      const x = walker?.x, z = walker?.z;
      peds.update(0.1, focus, null, []);
      if (!walker) {
        walker = peds.peds.find(p => p.state === 'alight' && p.service === vehicle);
        if (walker) {
          const door = transit.exitPoint(vehicle, {});
          doorDistance = Math.hypot(walker.x - door.x, walker.z - door.z);
        }
      } else {
        const step = Math.hypot(walker.x - x, walker.z - z);
        distance += step;
        maxStep = Math.max(maxStep, step);
        if (walker.state === 'walk') {
          const y = world.walkY(walker.x, walker.z, walker.y);
          if (!roadEntry && world.onCarriageway(walker.x, walker.z, y)) roadEntry = [walker.x, walker.z];
          if (world.collideCircle(walker.x, walker.z, 0.31, y + 0.24, y + 1.6)) blocked++;
        }
        viaMikulasska ||= Math.hypot(walker.x - 618.1, walker.z - 461) < 1;
        if (!peds.peds.includes(walker)) { exit = [walker.x, walker.z]; break; }
      }
    }
    return { exit, doorDistance, distance, maxStep, blocked, roadEntry, viaMikulasska };
  });
  expect(result, JSON.stringify(result)).toMatchObject({ blocked: 0, roadEntry: null, viaMikulasska: true });
  expect(result.doorDistance).toBeLessThan(4);
  expect(result.distance).toBeGreaterThan(300);
  expect(result.maxStep).toBeLessThan(0.18);
  expect(Math.hypot(result.exit[0] - 727.01, result.exit[1] - 481.92)).toBeLessThan(1);
});

test('E74 – od nádražních dveří přes Šumavskou až do odjezdové 49', async ({ page }, info) => {
  await page.setViewportSize({ width: 960, height: 600 });
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=8.32'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, { transit, peds, player, world, clock } = g;
    player.place(725, 483);
    __setClock('2026-11-09', 8 + 20 / 60);
    for (let i = 0; i < 50; i++) {
      g.chunks.update(700, 420, 340, 60, player.y);
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    let p, origin, entry, vehicle, before, waits = 0, boardTime, remaining;
    let roadOutside = null, obstacle = null, waitedOnPlatform = false;
    const dt = 0.2;
    for (let i = 0; i < 2300; i++) {
      clock.tick(dt);
      transit.update(dt, player, [], false, clock);
      const traffic = [];
      if (p?.state === 'crossWait' && waits < 10) {
        const c = p.crossing.crossing;
        traffic.push({ x: c.x, z: c.z, y: p.y, yaw: 0, speed: 0 });
        waits++;
      }
      peds.update(dt, player, null, traffic);
      if (!p) {
        p = peds.peds.find(walker => walker.ticket?.eventKey);
        if (p) origin = [p.x, p.z];
        continue;
      }
      if (traffic.length && p.state !== 'crossWait') throw Error('Chodec vstoupil před vozidlo.');
      if (p.state === 'platform') waitedOnPlatform = true;
      if (p.state === 'walk' || p.crossing || p.state === 'platform') {
        const y = world.walkY(p.x, p.z, p.y);
        if (!obstacle && world.collideCircle(p.x, p.z, 0.31, y + 0.24, y + 1.6)) obstacle = [p.x, p.z];
        if (!p.crossing && !roadOutside && world.onCarriageway(p.x, p.z, y)) roadOutside = [p.x, p.z];
      }
      if (p.state === 'board' && !entry) {
        vehicle = p.service;
        before = vehicle.passengerCount;
        entry = [vehicle.event.trip.id, vehicle.route.ref, vehicle.destination, vehicle.doorsOpen, vehicle.doorFraction];
        boardTime = clock.seconds;
        document.getElementById('hud').style.display = 'none';
        __view(693, world.walkY(693, 339, 7) + 2.6, 337, 707, vehicle.y + 1.3, 337);
      }
      if (!peds.peds.includes(p)) {
        remaining = peds.peds.filter(q => q.ticket?.eventKey === p.ticket.eventKey).length;
        break;
      }
    }
    return { origin, entry, waits, waitedOnPlatform, roadOutside, obstacle, boardTime, remaining,
      boarded: p?.state === 'aboard', count: vehicle?.passengerCount - before,
      position: p && [p.x, p.z, p.state, p.ticket?.eventKey, p.stationWaypoint] };
  });
  expect(result, JSON.stringify(result)).toMatchObject({ boarded: true, waits: 10, remaining: 0,
    waitedOnPlatform: true, roadOutside: null, obstacle: null, count: 1 });
  expect(Math.hypot(result.origin[0] - 727.01, result.origin[1] - 481.92)).toBeLessThan(2);
  expect(result.entry.slice(0, 4)).toEqual(['692185', '49', 'Karlov', true]);
  expect(result.entry[4]).toBeGreaterThanOrEqual(0.85);
  await page.screenshot({ path: info.outputPath('nastup.jpg'), quality: 85 });
});

test('E74 – při běžném parkování zůstane místo pro odjezdovou 49 a cestující nastoupí', async ({ page }) => {
  await page.addInitScript(() => {
    let state = 74;
    Math.random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  });
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=8.3'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game;
    g.player.place(720, 482);
    __setClock('2026-11-09', 8 + 20 / 60);
    const key = g.clock.day + ':692185';
    let person, service, queued = false, traffic = false;
    for (let second = 0; second < 480; second++) {
      for (let i = 0; i < 30; i++) {
        g.update(1 / 30);
        person ??= g.peds.peds.find(p => p.ticket?.eventKey === key);
        queued ||= person?.state === 'platform';
        if (person?.state === 'board') service = person.service.event.key;
        if (person?.state === 'aboard') return { queued, traffic, correct: service === key, boarded: true };
      }
      traffic ||= g.vehicles.cars.some(c => c.mode === 'ai');
      if (second % 15 === 0) await new Promise(resolve => setTimeout(resolve, 2));
    }
    const v = g.transit.active.get(key);
    return { queued, traffic, boarded: false, state: person?.state, blocked: v?.waitingForSpace };
  });
  expect(result, JSON.stringify(result)).toEqual({ queued: true, traffic: true, correct: true, boarded: true });
});
