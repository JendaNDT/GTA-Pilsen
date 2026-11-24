import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E30 – lidé u předních dveří nechají vystoupit cestujícího a pak nastoupí na svůj spoj', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    __freeze(true);
    const g = __game, transit = g.transit, day = g.clock.day;
    const event = transit.timetable.events(day).find(e => e.trip.id === '692183' && e.day === day);
    const trip = event.trip;
    const index = trip.stops.findIndex(stop => stop.target[1] === 'Hlavní nádraží');
    const s = trip.stops[index].target[0], spot = trip.route.posAt(s, 5, {});
    g.player.place(spot.x, spot.z);
    __setClock('2026-11-09', trip.times[index * 2] / 3600);
    const v = transit.active.get(event.key);
    while (g.peds.peds.length) g.peds.remove(0);
    const stop = trip.stops[index].stop, states = [];
    if (!v.visible) transit._show(v, true);
    v.stopIndex = index; v.s = s; v.v = 0; v.passengerCount = 1;
    transit._arrive(v, index);
    transit._pose(v, 1);
    const door = transit.exitPoint(v, {});
    const p = g.peds.spawnAt(door.x, door.z, v.yaw);
    Object.assign(p, { state: 'platform', timer: 90, goal: { ...door, tx: 0, tz: 1 },
      ticket: { station: stop, ref: v.route.ref, kind: v.route.type, destination: v.destination } });
    const other = g.peds.spawnAt(door.x, door.z, v.yaw);
    Object.assign(other, { state: 'platform', timer: 90, goal: p.goal, ticket: { ...p.ticket, ref: 'jiná' } });
    g.peds.timer = 0;
    for (let tick = 0; tick < 240; tick++) {
      g.peds.update(0.05, g.player, null, []);
      for (const ped of g.peds.peds) {
        if (ped.service === v && states.at(-1) !== ped.state) states.push(ped.state);
      }
      v.wait -= 0.05;
      if (v.wait <= 0 || !g.peds.peds.includes(p)) break;
    }
    return { states, boarded: !g.peds.peds.includes(p), missed: other.state, count: v.passengerCount };
  });
  expect(result).toEqual({ states: ['alight', 'board'], boarded: true, missed: 'platform', count: 1 });
});

test('E30 – řidič na neřízeném přechodu pustí pěšího a po přejití pokračuje', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    __freeze(true);
    const g = __game, w = g.world, t = w.traffic, car = g.player.lastCar;
    const [edge, entries] = [...t.crossingsByEdge].find(([e, list]) => !t.byEdge.has(e) &&
      list.some(({ crossing, s }) => !crossing.group && s > 35 && w.eLen[e] - s > 20));
    const { crossing, s } = entries.find(entry => !entry.crossing.group && entry.s > 35 && w.eLen[edge] - entry.s > 20);
    const lane = g.vehicles._laneFor(edge), start = w.edgePoint(edge, s - 24, lane, {});
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    while (g.peds.peds.length) g.peds.remove(0);
    car.place(start.x, start.z, Math.atan2(start.tx, start.tz));
    Object.assign(car, { edge, s: s - 24, lane, speed: 9, mode: 'ai', temper: 1,
      vx: start.tx * 9, vz: start.tz * 9 });
    g.vehicles._pickNext(car);
    g.vehicles.obstacles.length = 0;
    const p = g.peds.spawnAt(...crossing.a, 0);
    p.state = 'crossApproach'; p.speed = 1.4;
    p.crossing = { from: crossing.a, to: crossing.b, s, crossing };
    let entered = false, early = false, resumed = false, approachSpeed, atEntry;
    for (let i = 0; i < 1200; i++) {
      if (p.crossing) g.peds._stepCrossing(p, 1 / 60, [car]);
      if (!entered && p.state === 'crossing') {
        entered = true;
        approachSpeed = car.speed;
        atEntry = { crossing: crossing.id, speed: car.speed, distance: s - car.s };
      }
      g.vehicles.stepAI(car, 1 / 60);
      if (p.crossing && car.s + car.halfLen > s + 0.8) early = true;
      if (!p.crossing && car.s > s + 5) { resumed = true; break; }
    }
    return { entered, early, resumed, approachSpeed, atEntry };
  });
  expect(result, JSON.stringify(result)).toMatchObject({ entered: true, early: false, resumed: true });
  expect(result.approachSpeed, JSON.stringify(result.atEntry)).toBeLessThan(3);
});

test('E30 – procházka od muzea dojde přes místa k přecházení až za lávku u Strouhy', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  await waitForGame(page);
  const result = await page.evaluate(() => {
    __freeze(true);
    const g = __game;
    const manager = g.peds;
    const random = Math.random;
    try {
      Math.random = () => 0;
      manager.spawn(116, 298.4, null);
    } finally { Math.random = random; }
    const p = manager.peds.at(-1);
    if (!p?.trip) return { spawned: false };
    p.speed = 1.5;
    manager.timer = Infinity;
    g.transit.obstacles.length = 0;
    let crossings = 0, wasCrossing = false;
    for (let tick = 0; tick < 6000 && p.trip.direction > 0; tick++) {
      manager.update(0.1, p, null, []);
      if (!wasCrossing && p.state === 'crossing') crossings++;
      wasCrossing = p.state === 'crossing';
    }
    return { crossings, finished: p.trip.direction < 0, x: p.x, z: p.z, index: p.trip.index };
  });
  expect(result, JSON.stringify(result)).toMatchObject({ crossings: 4, finished: true });
  expect(Math.hypot(result.x - 281.9, result.z + 46.4)).toBeLessThan(1);
});

test('E30 – linka v Radobyčicích počká na auto vedle zálivu a vrátí se do pruhu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  await waitForGame(page);
  const result = await page.evaluate(() => {
    __freeze(true);
    const g = __game, t = g.transit;
    const station = t.timetable.stops.findIndex(s => s[3] === '47081/1');
    const event = t.timetable.events(g.clock.day).find(e => e.day === g.clock.day &&
      e.trip.stops.slice(1, -1).some(stop => stop.stop === station));
    const index = event.trip.stops.findIndex(stop => stop.stop === station);
    const s = event.trip.stops[index].target[0], anchor = event.trip.route.posAt(s, 0, {});
    g.player.place(anchor.x, anchor.z);
    __setClock('2026-11-09', event.trip.times[index * 2] / 3600);
    const bus = t.active.get(event.key);
    bus.s = s; bus.stopIndex = index; bus.wait = 4; bus.v = 0; bus.doorsOpen = true;
    bus.berthIndex = -1; bus.berth = null;
    for (let i = 0; i < 80; i++) t.update(1 / 60, g.player, [], false, g.clock);
    const inBay = bus.side - bus.lane;
    const lane = bus.route.posAt(s - bus.halfLen, bus.lane, {});
    const other = { ...lane, halfLen: 2, radius: 1, vx: 0, vz: 0, speed: 0,
      yaw: Math.atan2(lane.tx, lane.tz), y: bus.y, mode: 'ai' };
    bus.wait = 0.01;
    g.world.traffic.time = 0.1;
    for (let i = 0; i < 60; i++) t.update(1 / 60, g.player, [other], false, g.clock);
    const waited = bus.s === s && bus.v === 0 && bus.indicator.visible;
    const rear = bus.route.posAt(s - bus.len - 9, bus.lane, {});
    Object.assign(other, { x: rear.x, z: rear.z, speed: 3 });
    for (let i = 0; i < 600 && bus.s < s + 21; i++) t.update(1 / 60, g.player, [other], false, g.clock);
    return { inBay, waited, advance: bus.s - s, offset: bus.side - bus.lane, signal: bus.indicator.visible };
  });
  expect(result.inBay).toBeGreaterThan(2);
  expect(result, JSON.stringify(result)).toMatchObject({ waited: true, signal: false });
  expect(result.advance).toBeGreaterThan(17);
  expect(Math.abs(result.offset)).toBeLessThan(0.3);
});
