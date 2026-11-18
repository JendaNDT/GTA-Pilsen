import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function boot(page) {
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => {
    window.__freeze(true);
    const game = window.__game;
    for (const car of [...game.vehicles.cars]) game.vehicles.remove(car);
    game.vehicles.spawnTimer = 100_000;
    game.peds.timer = 100_000;
    // Dlouhé intervaly zrychlíme bez přestavování viditelných dlaždic.
    window.__advanceTransit = () => {
      const dt = 0.05, onFoot = game.mode === 'foot';
      game.clock.tick(dt);
      game.world.traffic.tick(dt, onFoot ? game.player : null);
      game.transit.update(dt, game.focus, game.vehicles.cars, onFoot, game.clock);
      // Chodci musí i při zrychleném čekání dokončit přechod a uvolnit jízdní pruh.
      game.peds.update(dt, game.focus, game.camInfo, game.vehicles.cars);
    };
  });
}

async function action(page, code = 'KeyF') {
  await page.evaluate((code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.__step(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }, code);
}

async function approach(page, id, station, date = '2026-11-09') {
  return page.evaluate(({ id, station, date }) => {
    const g = window.__game, table = g.transit.timetable;
    const day = Date.parse(date) / 86_400_000;
    const event = table.events(day).find(({ trip, day: serviceDay }) => trip.id === id && serviceDay === day);
    const { trip } = event;
    const index = trip.stops.findIndex(({ target }) => target[1] === station);
    const time = index === 0 ? trip.times[1] - 2 : trip.times[index * 2];
    const point = trip.route.posAt(trip.stops[index].target[0], 2.5, {});
    g.player.place(point.x, point.z);
    window.__setClock(date, time / 3600);
    g.vehicles.spawnTimer = 100_000;
    const vehicle = g.transit.active.get(event.key);
    for (let tick = 0; tick < 440 && !vehicle.visible; tick++) window.__advanceTransit();
    const door = g.transit.exitPoint(vehicle, {});
    g.player.place(door.x, door.z, vehicle.y);
    g.promptTimer = 0;
    window.__step(1 / 60, 2);
    g.updateDepartures();
    return { ref: vehicle.route.ref, doorOpen: vehicle.doorsOpen, boardable: g.transit.boardable(door.x, door.z, vehicle.y) === vehicle };
  }, { id, station, date });
}

test('E08 – přestup z tramvaje na autobus po skutečné jízdě a výstupu', async ({ page }, info) => {
  test.setTimeout(150_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  expect(await approach(page, '686547', 'U Práce')).toEqual({ ref: '4', doorOpen: true, boardable: true });
  await expect(page.locator('#stop-departures')).toContainText('Nyní');
  await action(page);
  await expect(page.locator('#vehname')).toContainText('tramvaj 4');
  const ride = await page.evaluate(() => {
    const g = window.__game, v = g.ride, start = v.s;
    let moving = false;
    for (let tick = 0; tick < 3000 && (v.s <= start + 10 || !v.canAlight); tick++) {
      window.__advanceTransit();
      if (v.v > 2) moving = true;
    }
    window.__step(0);
    return { moving, stop: v.stopTarget?.[1], s: v.s - start, open: v.canAlight };
  });
  expect(ride.moving && ride.open).toBe(true);
  expect(ride.stop).toBe('Náměstí Republiky');
  expect(ride.s).toBeGreaterThan(100);
  await action(page);
  await expect(page.locator('#stop-name')).toContainText('Náměstí Republiky');
  await expect(page.locator('#stop-transfer')).toContainText('Přestup');

  await action(page, 'KeyM');
  await page.getByRole('searchbox').fill('namesti republiky stanoviste 4');
  const platform = page.getByRole('button', { name: 'Náměstí Republiky · stanoviště 4', exact: true });
  await expect(platform).toBeVisible();
  await platform.click();
  const transfer = await page.evaluate(() => {
    const g = window.__game, table = g.transit.timetable;
    const station = table.stops.findIndex(([name, , , code]) => name === 'Náměstí Republiky' && code === '54717/4');
    const [, x, z] = table.stops[station];
    const waypoint = g.jobs.waypoint;
    const distance = Math.hypot(x - g.player.x, z - g.player.z);
    window.__setInput(0, 1);
    for (let tick = 0; tick < 650 && Math.hypot(x - g.player.x, z - g.player.z) > 3.5; tick++) {
      g.camYaw = Math.atan2(x - g.player.x, z - g.player.z);
      g.update(0.05);
    }
    window.__setInput(0, 0);
    const walked = Math.hypot(x - g.player.x, z - g.player.z) < 4;
    const connection = table.departuresAt(station, g.clock).rows.find(({ type }) => type === 'bus');
    if (!connection) return { distance, walked, found: false };
    const expectedArrival = connection.time + 120;
    let bus;
    while (g.clock.now < expectedArrival) {
      window.__advanceTransit();
      bus = g.transit.vehicles.find((v) => v.route.type === 'bus' && v.visible && v.canBoard
        && v.event.trip.stops[v.stopIndex].stop === station);
      if (bus) break;
    }
    if (!bus) return { distance, walked, found: false };
    const liveBoard = table.departuresAt(station, g.clock, undefined, g.transit.active);
    const door = g.transit.exitPoint(bus, {});
    g.player.place(door.x, door.z, bus.y);
    g.promptTimer = 0;
    window.__step(1 / 60);
    const display = bus.display?.map.image;
    return { found: true, ref: bus.route.ref, distance, walked, exact: waypoint.x === x && waypoint.z === z,
      boarding: liveBoard.rows.some((row) => row.ref === bus.route.ref && row.boarding), display: display?.width,
      boardable: g.transit.boardable(door.x, door.z, bus.y) === bus };
  });
  await info.attach('návaznost na stanovišti 4', { body: JSON.stringify(transfer), contentType: 'application/json' });
  expect(transfer.found).toBe(true);
  expect(transfer.distance).toBeLessThan(90);
  expect(transfer.exact && transfer.walked && transfer.boarding && transfer.boardable, JSON.stringify(transfer)).toBe(true);
  expect(transfer.display).toBe(512);
  await action(page);
  await expect(page.locator('#vehname')).toContainText(`autobus ${transfer.ref}`);
  expect(errors).toEqual([]);
});

test('E08 – trolejbus 49, výstup v zastávce a použití jízdního řádu', async ({ page }) => {
  await boot(page);
  expect(await approach(page, '692183', 'Hlavní nádraží')).toEqual({ ref: '49', doorOpen: true, boardable: true });
  await action(page);
  await expect(page.locator('#vehname')).toContainText('trolejbus 49 → Areál FN');
  const left = await page.evaluate(() => {
    const g = window.__game, v = g.ride;
    for (let tick = 0; tick < 340 && v.v < 2; tick++) window.__advanceTransit();
    window.__step(0);
    return { moving: v.v >= 2, open: v.canAlight };
  });
  expect(left).toEqual({ moving: true, open: false });
  await action(page);
  expect(await page.evaluate(() => window.__game.mode)).toBe('transit');
  const stop = await page.evaluate(() => {
    const g = window.__game, v = g.ride;
    for (let tick = 0; tick < 2200 && !v.canAlight; tick++) window.__advanceTransit();
    g.promptTimer = 0;
    window.__step(0);
    return v.stopTarget?.[1];
  });
  expect(stop).toBe('Pařížská');
  await expect(page.locator('#prompt')).toContainText('Vystoupit');
  await action(page);
  expect(await page.evaluate(() => window.__game.mode)).toBe('foot');
});

test('E08 – víkendový noční autobus N12 s výstupem před hranicí mapy', async ({ page }, info) => {
  test.setTimeout(110_000);
  await boot(page);
  expect(await approach(page, '689753', 'Mrakodrap', '2026-11-14')).toEqual({ ref: 'N12', doorOpen: true, boardable: true });
  await expect(page.locator('#stop-departures')).toContainText('Stod');
  await expect(page.locator('#stop-departures')).toContainText('Na mapě do Líně');
  await action(page);
  await expect(page.locator('#vehname')).toContainText('autobus N12 → Stod');

  // Přesun zkušebního vozu i hodin těsně před konečnou v Líních.
  const edge = await page.evaluate(() => {
    const g = window.__game, v = g.ride, trip = v.event.trip, route = v.route;
    v.stopIndex = trip.stops.length - 1;
    const arrival = trip.times[v.stopIndex * 2];
    g.clock.setTime(v.event.start - trip.start + (arrival >= 0 ? arrival : -arrival - 1) - 5);
    v.s = trip.lastS - 36;
    v.v = 7;
    v.wait = 0;
    v.doorsOpen = false;
    v.stopTarget = null;
    const point = route.posAt(v.s, v.side, {});
    v.x = point.x;
    v.z = point.z;
    v.y = g.world.heightAt(point.x, point.z);
    for (let tick = 0; tick < 500 && !v.canAlight; tick++) window.__advanceTransit();
    g.promptTimer = 0;
    window.__step(0);
    return { waiting: v.canAlight, end: v.stopTarget?.[1], x: v.x };
  });
  expect(edge.waiting).toBe(true);
  expect(edge.end).toBe('Líně');
  await expect(page.locator('#prompt')).toContainText('poslední zastávka na mapě');
  const after = await page.evaluate(() => {
    const g = window.__game, v = g.ride, last = v.s;
    for (let tick = 0; tick < 1200 && g.transit.active.has(v.event.key); tick++) window.__advanceTransit();
    return { mode: g.mode, exited: !g.transit.active.has(v.event.key), endTravel: v.s - last,
      insideMap: g.world.inBounds(g.player.x, g.player.z, 0), separation: Math.abs(g.player.x - v.x) };
  });
  await info.attach('hraniční výstup v Líních', { body: JSON.stringify(after), contentType: 'application/json' });
  expect(after.mode).toBe('foot');
  expect(after.exited && after.insideMap).toBe(true);
  expect(after.endTravel).toBeGreaterThan(100);
  expect(after.separation).toBeGreaterThan(100);
});
