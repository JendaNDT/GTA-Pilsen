import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { action, approach, boot } from './transit-steps.js';
import { BUS_TRIP, TROLLEY_TRIP } from '../../src/game/tram-cabin.js';
import { testTimeout } from './test-timeout.js';

const rides = [
  { title: 'jízda autobusem 33 ze stanoviště 4 přes Goethovu a výstup zadními dveřmi', trip: BUS_TRIP,
    button: '33 Autobus SOR Směr Hlavní nádraží', hour: 8 + 20 / 60, seatSteps: 60, doorSteps: 246,
    firstStop: 'Goethova', secondStop: 'Pařížská', exitDoor: -4.23 },
  { title: 'jízda trolejbusem 49 od nádraží přes Pařížskou k Mrakodrapu', trip: TROLLEY_TRIP,
    button: '49 Trolejbus Směr Karlov', hour: 8 + 26 / 60, seatSteps: 58, doorSteps: 127,
    firstStop: 'Pařížská', secondStop: 'Mrakodrap', exitDoor: -1.5 },
];

for (const ride of rides) test('E60 – ' + ride.title, async ({ page }, info) => {
  test.setTimeout(testTimeout(150_000));
  await page.goto(gameUrl('/?debug&quality=low&kolony=1&adapt=0&date=2026-11-09&hour=' + ride.hour, { seed: 1729 }));
  await page.getByRole('button', { name: 'Svézt se MHD' }).click();
  const start = page.getByRole('button', { name: ride.button });
  await page.waitForFunction(() => window.__ready);
  await start.evaluate(button => button.addEventListener('click', () => __freeze(true), { once: true }));
  await start.click();
  const id = await page.evaluate(() => {
    __freeze(true);
    return __game.ride.event.trip.id;
  });
  expect(id).toBe(ride.trip);
  const screenshot = async name => page.screenshot({ path: info.outputPath(name + '.jpg'), style: '#toast { visibility:hidden }' });
  await screenshot('nastup');
  async function walk(key, steps) {
    await page.keyboard.down(key);
    await page.evaluate(n => __step(1 / 60, n), steps);
    await page.keyboard.up(key);
  }
  async function travel(name) {
    return page.evaluate(async name => {
      const g = __game, v = g.ride, start = v.s;
      for (let i = 0; i < 8500; i++) {
        g.update(1 / 30);
        if (i % 90 === 89) await new Promise(resolve => setTimeout(resolve, 0));
        if (v.stopTarget?.[1] === name && v.canAlight && v.doorFraction >= 0.85) {
          await g.chunks.prepareStart(g.focus, 340);
          __step(0);
          return { metres: v.s - start, seated: !!g.cabin.seat };
        }
      }
      throw new Error('Vůz nedojel do zastávky ' + name + ', ujel ' + (v.s - start).toFixed(1) + ' m. ' + JSON.stringify({ chain: g.trafficWaits.chain(v), lane: v.departureLane, next: v.stops[v.stopIndex], wait: v.wait }));
    }, name);
  }
  await walk('w', ride.seatSteps);
  await action(page);
  expect(await page.evaluate(() => __game.cabin.action)).toBe('Vstát');
  const first = await travel(ride.firstStop);
  expect(first.seated).toBe(true);
  expect(first.metres).toBeGreaterThan(100);
  await screenshot(ride.firstStop);
  await action(page);
  await walk('w', ride.doorSteps);
  await walk('a', 20);
  expect(await page.evaluate(() => __game.cabin.door)).toBe(ride.exitDoor);
  await page.evaluate(() => {
    const g = __game;
    for (let i = 0; i < 12000 && g.ride.doorsOpen; i++) g.update(1 / 30);
    if (g.ride.doorsOpen) throw new Error('Vůz neodjel z první zastávky.');
  });
  await action(page);
  expect(await page.evaluate(() => __game.mode)).toBe('transit');
  const second = await travel(ride.secondStop);
  expect(second.metres).toBeGreaterThan(100);
  const target = await page.evaluate(() => __game.transit.exitPoint(__game.ride, {}, __game.cabin.door));
  await action(page);
  const landed = await page.evaluate(() => {
    const g = __game;
    return { mode: g.mode, x: g.player.x, z: g.player.z, clear: g._platformClear(g.player) };
  });
  expect(landed).toMatchObject({ mode: 'foot', clear: true });
  expect(Math.hypot(landed.x - target.x, landed.z - target.z)).toBeLessThan(0.5);
  await screenshot('vystup');
  await info.attach(ride.title, { body: JSON.stringify({ id, first, second, landed }), contentType: 'application/json' });
});

test.describe('dotykový autobus', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  test('E60 – vyhledat autobus a nastoupit prostředními dveřmi ze správné strany', async ({ page }) => {
    await boot(page, 'quality=low');
    await action(page, 'KeyM');
    await page.getByRole('searchbox').fill(BUS_TRIP);
    await page.getByRole('button', { name: 'Průchozí autobus · linka 33' }).tap();
    await expect(page.locator('#map-access')).toContainText('8:20 ze stanoviště 4');
    await page.locator('#bigmap-close').tap();
    expect((await approach(page, BUS_TRIP, 'Náměstí Republiky')).boardable).toBe(true);
    const door = await page.evaluate(() => {
      const g = __game, v = g.transit.boardable(g.player.x, g.player.z, g.player.y);
      const z = v.sections[0].doors[1];
      const opposite = v.meshes[0].localToWorld(g.camera.position.clone().set(2.6, 0, z));
      const point = g.transit.exitPoint(v, {}, z);
      g.player.place(point.x, point.z, v.y);
      g.promptTimer = 0;
      __step(1 / 60);
      return { wrongSide: g.transit.boardable(opposite.x, opposite.z, opposite.y) === v, z };
    });
    expect(door.wrongSide).toBe(false);
    const tap = async () => { await page.locator('#tb-act').tap(); await page.evaluate(() => __step(1 / 60)); };
    await tap();
    expect(await page.evaluate(() => __game.cabin?.door)).toBe(door.z);
    await tap();
    expect(await page.evaluate(() => __game.mode)).toBe('foot');
  });
});

test.describe('dotykový přestup v Pařížské', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  test('E60 – z autobusu 33 pěšky k předním dveřím trolejbusu 49', async ({ page }, info) => {
    test.setTimeout(testTimeout(150_000));
    await boot(page, 'quality=low');
    await action(page, 'KeyM');
    await page.getByRole('searchbox').fill(TROLLEY_TRIP);
    await page.getByRole('button', { name: 'Průchozí trolejbus · linka 49' }).tap();
    await expect(page.locator('#map-access')).toContainText('8:26 ze stanoviště 1');
    await page.locator('#bigmap-close').tap();
    expect((await approach(page, BUS_TRIP, 'Goethova')).boardable).toBe(true);
    const tap = async () => { await page.locator('#tb-act').tap(); await page.evaluate(() => __step(1 / 60)); };
    await tap();
    expect(await page.evaluate(() => __game.ride?.event.trip.id)).toBe(BUS_TRIP);
    await page.evaluate(() => {
      const v = __game.ride;
      for (let i = 0; i < 6000; i++) {
        __advanceTransit();
        if (v.stopTarget?.[1] === 'Pařížská' && v.canAlight && v.doorFraction >= 0.85) return;
      }
      throw new Error('Autobus nedojel do Pařížské.');
    });
    await tap();
    expect(await page.evaluate(() => __game.mode)).toBe('foot');
    const transfer = await page.evaluate(trip => {
      const g = __game, table = g.transit.timetable;
      const station = table.stops.findIndex(s => s[3] === '48984/1');
      const [, x, z] = table.stops[station];
      const distance = Math.hypot(x - g.player.x, z - g.player.z);
      function walk(x, z, tolerance) {
        __setInput(0, 1);
        for (let i = 0; i < 800 && Math.hypot(x - g.player.x, z - g.player.z) > tolerance; i++) {
          g.camYaw = Math.atan2(x - g.player.x, z - g.player.z);
          g.update(0.05);
        }
        __setInput(0, 0);
        return Math.hypot(x - g.player.x, z - g.player.z);
      }
      const remaining = walk(x, z, 2);
      for (let i = 0; i < 7000; i++) {
        __advanceTransit();
        const v = g.transit.vehicles.find(v => v.event.trip.id === trip);
        if (!v?.visible || !v.canBoard || v.doorFraction < 0.85 || v.event.trip.stops[v.stopIndex].stop !== station) continue;
        const rear = g.transit.exitPoint(v, {}, v.sections[0].doors[1]);
        const front = g.transit.exitPoint(v, {});
        const rearBoardable = g.transit.boardable(rear.x, rear.z, v.y) === v;
        const doorway = walk(front.x, front.z, 0.35);
        g.promptTimer = 0;
        __step(1 / 60);
        const board = table.departuresAt(station, g.clock, undefined, g.transit.active);
        return { distance, remaining, doorway, rearBoardable,
          boarding: board.rows.some(row => row.ref === v.route.ref && row.boarding) };
      }
      throw new Error('Spoj 49 nepřijel k přestupu. Vzdálenost po chůzi ' + remaining);
    }, TROLLEY_TRIP);
    await info.attach('Pěší přestup v Pařížské', { body: JSON.stringify(transfer), contentType: 'application/json' });
    expect(transfer.remaining, JSON.stringify(transfer)).toBeLessThanOrEqual(2);
    expect(transfer.doorway).toBeLessThanOrEqual(0.35);
    expect(transfer).toMatchObject({ rearBoardable: false, boarding: true });
    await tap();
    expect(await page.evaluate(() => [__game.ride?.event.trip.id, __game.cabin?.door])).toEqual([TROLLEY_TRIP, 3.9]);
  });
});

test('E62 – zadní dveře autobusu 33 v Pařížské zůstanou použitelné po uvolnění nástupiště', async ({ page }) => {
  await boot(page, 'quality=low');
  await approach(page, BUS_TRIP, 'Pařížská');
  const target = await page.evaluate(trip => {
    const g = __game, v = g.transit.vehicles.find(v => v.event.trip.id === trip);
    const door = v.sections[0].doors.at(-1);
    const p = g.transit.exitPoint(v, {}, door);
    g.player.place(p.x, p.z, p.y);
    __step(1 / 60);
    return p;
  }, BUS_TRIP);
  await action(page);
  expect(await page.evaluate(() => __game.cabin?.door)).toBe(-4.23);
  const parked = await page.evaluateHandle(p => {
    const g = __game, Car = g.player.lastCar.constructor;
    const car = g.vehicles.add(new Car('sedan', 0x666666));
    const yaw = g.ride.yaw;
    car.place(p.x + 0.55 * Math.cos(yaw), p.z - 0.55 * Math.sin(yaw), yaw, p.y);
    __step(1 / 60, 2);
    return car;
  }, target);
  await action(page);
  expect(await page.evaluate(() => __game.mode)).toBe('transit');
  await expect(page.locator('#toast')).toContainText('Zkus jiné dveře');
  await parked.evaluate(car => {
    __game.vehicles.remove(car);
    __step(1 / 60, 2);
  });
  await action(page);
  const landed = await page.evaluate(() => ({ mode: __game.mode, x: __game.player.x, z: __game.player.z }));
  expect(landed.mode).toBe('foot');
  expect(Math.hypot(landed.x - target.x, landed.z - target.z)).toBeLessThan(0.5);
});
