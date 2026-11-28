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

for (const { title, quality, minRegular, maxRegular, minExtra, maxTotal, minPeds } of [
  { title: 'E30 – ranní Klatovská se na střední kvalitu zaplní auty i chodci', quality: 'medium',
    minRegular: 29, maxRegular: 32, minExtra: 12, maxTotal: 54, minPeds: 14 },
  { title: 'E83 – ranní provoz na Klatovské má menší posilu při nízké kvalitě', quality: 'low',
    minRegular: 12, maxRegular: 14, minExtra: 4, maxTotal: 24, minPeds: 6 },
]) {
  test(title, async ({ page }) => {
    await page.goto(gameUrl(`/?debug&quality=${quality}&adapt=0&date=2026-11-09&hour=7.5`));
    await waitForGame(page);
    const counts = await page.evaluate(() => {
      __freeze(true);
      __play();
      const g = __game;
      const [edge] = [...g.trafficRhythm.measured].find(([, entry]) =>
        entry.curve.id === 'klatovska-jih' && entry.distance === 0);
      const point = g.world.edgePoint(edge, 58, 0, {});
      g.player.place(point.x - point.tz * 10, point.z + point.tx * 10);
      let seed = 42;
      const random = Math.random;
      try {
        Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
        for (let frame = 0; frame < 1800; frame++) {
          g.camYaw += Math.PI / 900;
          g.update(1 / 30);
        }
        const cars = g.vehicles.cars.filter(car => car.mode === 'ai');
        const extra = cars.filter(car => car.arterialTrip).length;
        return { cars: cars.length, regular: cars.length - extra, extra, peds: g.peds.peds.length };
      } finally { Math.random = random; }
    });
    expect(counts.regular).toBeGreaterThanOrEqual(minRegular);
    expect(counts.regular).toBeLessThanOrEqual(maxRegular);
    expect(counts.extra).toBeGreaterThanOrEqual(minExtra);
    expect(counts.cars).toBeLessThanOrEqual(maxTotal);
    expect(counts.peds).toBeGreaterThanOrEqual(minPeds);
  });
}

test('E80 – chodec v Radobyčicích počká při návratu linky 32 ze zálivu do pruhu', async ({ page }, info) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=7.5'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, t = g.transit, traffic = g.world.traffic;
    const event = t.timetable.events(g.clock.day).find(e => e.day === g.clock.day && e.trip.id === '688585');
    const i = event.trip.stops.findIndex(st => t.timetable.stops[st.stop][3] === '47081/1');
    const s = event.trip.stops[i].target[0], anchor = event.trip.route.posAt(s, 0, {});
    const c = traffic.crossings.find(crossing => crossing.id === 39345);
    g.player.place(anchor.x, anchor.z);
    __setClock('2026-11-09', event.trip.times[2 * i] / 3600);
    const bus = t.active.get(event.key);
    t.vehicles = [bus];
    Object.assign(bus, { s, stopIndex: i, wait: 4, v: 0, doorsOpen: true, berthIndex: -1, berth: null });
    const tick = () => t.update(1 / 60, g.player, [], false, g.clock);
    for (let n = 0; n < 80; n++) tick();
    const inBay = bus.side - bus.lane;
    bus.wait = 0.01;
    for (let n = 0; n < 600 && bus.s < s + 12.02; n++) tick();

    const walker = g.peds.spawnAt(...c.a, Math.atan2(c.dx, c.dz));
    Object.assign(walker, { speed: 1.4, state: 'crossApproach', crossing: { crossing: c, from: c.a, to: c.b, s: 0 } });
    g.peds.timer = Infinity;
    for (let n = 0; n < 45; n++) g.peds.update(1 / 60, g.player, null, []);
    const waited = walker.state === 'crossWait' && !traffic.users.has(walker);
    for (let n = 0; n < 45; n++) {
      g.chunks.update(c.x, c.z, 340, 60, walker.y);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    document.getElementById('hud').style.display = 'none';
    const { tx, tz } = bus.route.posAt(bus.s, bus.side, {});
    __view(c.x - 9 * c.dx + tx * 8, walker.y + 13, c.z - 9 * c.dz + tz * 8,
      c.x - tx * 5, walker.y, c.z - tz * 5);
    // Od tohoto okamžiku postupují řidič i chodec současně.
    let entered = traffic.users.get(walker) === c;
    for (let n = 0; n < 1800 && (bus.s < s + 50 || !entered || traffic.users.has(walker)); n++) {
      tick();
      g.peds.update(1 / 60, g.player, null, []);
      if (traffic.users.get(walker) === c) entered = true;
    }
    return { inBay, waited, cleared: bus.s >= s + 50, entered,
      crossed: !traffic.users.has(walker) && Math.hypot(walker.x - c.b[0], walker.z - c.b[1]) < 0.1,
      settled: !bus.footprints[0].pulloutBerth && Math.abs(bus.side - bus.lane) < 0.05 };
  });
  await page.screenshot({ path: info.outputPath('vyjezd.jpg'), quality: 87 });
  expect(result.inBay).toBeGreaterThan(2);
  expect(result).toMatchObject({ waited: true, cleared: true, settled: true, entered: true, crossed: true });
});

test('E81 – linka 32 a auto za ní nechají chodce přejít a pokračují', async ({ page }, info) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=7.5'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.exposeFunction('vyfotitPrechod', async () => {
    await page.screenshot({ path: info.outputPath('prechazeni.jpg'), quality: 87 });
  });
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, t = g.transit, traffic = g.world.traffic;
    const event = t.timetable.events(g.clock.day).find(e => e.day === g.clock.day && e.trip.id === '688585');
    const index = event.trip.stops.findIndex(st => t.timetable.stops[st.stop][3] === '47081/1');
    const s = event.trip.stops[index].target[0], route = event.trip.route;
    const crossing = traffic.crossings.find(c => c.id === 39345);
    const observer = route.posAt(s + 14, -9, {});
    g.player.place(observer.x, observer.z);
    __setClock('2026-11-09', event.trip.times[2 * index] / 3600);
    const bus = t.active.get(event.key), dt = 1 / 60;
    t.vehicles = [bus];
    Object.assign(bus, { s, stopIndex: index, wait: 4, v: 0, doorsOpen: true, berthIndex: -1, berth: null });
    for (let i = 0; i < 80; i++) t.update(dt, g.player, [], true, g.clock);
    const inBay = bus.side - bus.lane;
    const car = g.player.lastCar;
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    while (g.peds.peds.length) g.peds.remove(0);
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    // Po přesunu z výchozí čtvrti vytvoří herní smyčka kola znovu na zdejší vozovce.
    g.trafficBodies.removeCar(car);
    const start = route.posAt(s - bus.len - 15, bus.lane, {});
    car.place(start.x, start.z, Math.atan2(start.tx, start.tz));
    if (!g.vehicles._resumeAI(car)) throw new Error('Auto za autobusem nenašlo jízdní pruh.');
    Object.assign(car, { temper: 1, speed: 6, vx: 6 * start.tx, vz: 6 * start.tz });
    bus.wait = dt;

    // Měření je nezávislé na pravidlech řidičů. Porovnává obrysy obou vozů s bližším okrajem zebry.
    const nx = crossing.dz, nz = -crossing.dx, halfStripe = 1.45;
    const center = v => (v.x - crossing.x) * nx + (v.z - crossing.z) * nz;
    const span = v => v.halfLen * Math.abs(Math.sin(v.yaw) * nx + Math.cos(v.yaw) * nz)
      + v.radius * Math.abs(Math.cos(v.yaw) * nx - Math.sin(v.yaw) * nz);
    let walker, waited = false, entered = false, crossed = false, resumed = false, photo = false;
    let busRoom = Infinity, carRoom = Infinity, gap = Infinity, busSpeed = Infinity, carSpeed = Infinity;
    for (let frame = 0; frame < 1800; frame++) {
      if (!walker && bus.s >= s + 12) {
        walker = g.peds.spawnAt(...crossing.a, Math.atan2(crossing.dx, crossing.dz));
        Object.assign(walker, { speed: 1.4, state: 'crossApproach',
          crossing: { crossing, from: crossing.a, to: crossing.b, s: 0 } });
      }
      g.update(dt);
      const front = bus.footprints[0];
      gap = Math.min(gap, center(front) - span(front) - center(car) - span(car));
      if (traffic.waitingWalkers.get(walker) === crossing) waited = true;
      if (traffic.users.get(walker) === crossing) {
        entered = true;
        busRoom = Math.min(busRoom, -center(front) - span(front) - halfStripe);
        carRoom = Math.min(carRoom, -center(car) - span(car) - halfStripe);
        busSpeed = Math.min(busSpeed, bus.v);
        carSpeed = Math.min(carSpeed, car.speed);
        if (!photo && Math.hypot(walker.x - crossing.x, walker.z - crossing.z) < 0.3) {
          const { x, z } = crossing, { tx, tz } = start;
          document.getElementById('hud').style.display = 'none';
          __view(x - crossing.dx * 19 + tx * 12, walker.y + 19, z - crossing.dz * 19 + tz * 12,
            x - tx * 7, walker.y, z - tz * 7);
          await window.vyfotitPrechod();
          photo = true;
        }
      }
      if (entered && !walker.crossing && Math.hypot(walker.x - crossing.b[0], walker.z - crossing.b[1]) < 0.1) crossed = true;
      if (crossed && center(car) - span(car) > 5 && center(front) - span(front) > 5) {
        resumed = bus.v > 1 && car.speed > 1 && car.mode === 'ai';
        break;
      }
    }
    return { inBay, waited, entered, crossed, resumed, photo, busRoom, carRoom, gap, busSpeed, carSpeed };
  });
  await info.attach('Průjezd v Radobyčicích', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result, JSON.stringify(result)).toMatchObject({ waited: true, entered: true, crossed: true, resumed: true, photo: true });
  expect(result.inBay).toBeGreaterThan(2);
  expect(result.busSpeed).toBeLessThan(0.1);
  expect(result.carSpeed).toBeLessThan(1);
  expect(result.gap).toBeGreaterThan(0);
  expect(result.carRoom).toBeGreaterThan(0);
  expect(result.busRoom).toBeGreaterThan(0);
});
