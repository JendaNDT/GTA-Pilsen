import { expect, test, devices } from '@playwright/test';

async function boot(page) {
  await page.goto('/?debug&view=620&shadows=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
}

// Klávesa i krok hry proběhnou v jedné úloze, aby ji pauznutá RAF smyčka nestihla vymazat.
async function action(page, code) {
  await page.evaluate((code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.__step(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }, code);
}

test('chůze, navigace, auto, vrtulník a dokončení rozvozu', async ({ page }) => {
  const errors = [], failed = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failed.push(request.url()));
  await boot(page);
  const start = await page.evaluate(() => ({ x: __game.player.x, z: __game.player.z }));
  await page.keyboard.down('w');
  await page.evaluate(() => __step(1 / 60, 120));
  await page.keyboard.up('w');
  expect(await page.evaluate((p) => Math.hypot(__game.player.x - p.x, __game.player.z - p.z), start)).toBeGreaterThan(4);
  await action(page, 'KeyM');
  await expect(page.locator('#bigmap')).toBeVisible();
  await page.locator('#bigmap-canvas').click();
  await page.evaluate(() => __step(1 / 60));
  expect(await page.evaluate(() => __game.jobs.waypoint !== null && __game.jobs.route.length > 0)).toBe(true);

  await page.evaluate(() => {
    const g = __game, car = g.player.lastCar;
    g.player.place(car.x + Math.cos(car.yaw) * 2, car.z - Math.sin(car.yaw) * 2);
  });
  await action(page, 'KeyF');
  expect(await page.evaluate(() => __game.mode)).toBe('car');
  await page.keyboard.down('w');
  const speed = await page.evaluate(() => {
    const { vehicles, car } = window.__game;
    // Pro zkoušku rozjezdu uvolni vozovku.
    for (const other of [...vehicles.cars]) if (other !== car) vehicles.remove(other);
    const spawnTimer = vehicles.spawnTimer;
    vehicles.spawnTimer = 3;
    window.__step(1 / 60, 120);
    vehicles.spawnTimer = spawnTimer;
    return car.speed;
  });
  await page.keyboard.up('w');
  expect(speed).toBeGreaterThan(5);
  await page.evaluate(() => { __game.car.vx = __game.car.vz = __game.car.speed = 0; });
  await action(page, 'KeyF');
  expect(await page.evaluate(() => __game.mode)).toBe('foot');

  await page.evaluate(() => { const h = __game.helis[3]; __game.player.place(h.x + 2.5, h.z, h.y); });
  await action(page, 'KeyF');
  expect(await page.evaluate(() => __game.mode)).toBe('heli');
  const y = await page.evaluate(() => __game.heli.y);
  await page.keyboard.down('Space');
  await page.evaluate(() => __step(1 / 60, 240));
  await page.keyboard.up('Space');
  expect(await page.evaluate(() => __game.heli.y)).toBeGreaterThan(y + 5);
  await page.evaluate(() => { const h = __game.heli; h.y = __game.world.surfaceAt(h.x, h.z); h.vy = 0; h.landed = true; });
  await action(page, 'KeyF');

  await action(page, 'KeyJ');
  expect(await page.evaluate(() => __game.jobs.job?.phase)).toBe('pickup');
  await page.evaluate(() => { const p = __game.jobs.job.pick; __game.player.place(p.x, p.z); __step(1 / 60); });
  expect(await page.evaluate(() => __game.jobs.job.phase)).toBe('drop');
  const money = await page.evaluate(() => __game.money);
  await page.evaluate(() => { const p = __game.jobs.job.drop; __game.player.place(p.x, p.z); __step(1 / 60); });
  expect(await page.evaluate(() => __game.jobs.job)).toBeNull();
  expect(await page.evaluate(() => __game.money)).toBeGreaterThan(money);
  expect(await page.evaluate(() => __game.stats.deliveries)).toBe(1);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test('tramvaj lze použít a uložený postup přežije opětovné načtení', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  await page.evaluate(() => {
    const g = __game;
    const v = g.transit.vehicles.find((v) => v.isTram && v.route.stops.some((s) => s[0] > 400 && s[0] < v.route.length - 200));
    const stop = v.route.stops.find((s) => s[0] > 400 && s[0] < v.route.length - 200);
    v.s = stop[0]; v.v = 0; v.wait = 7; v.stopTarget = stop;
    const p = {}; v.route.posAt(v.s - 14.1, 0, p); g.player.place(p.x, p.z); __step(1 / 60);
    g.transit.exitPoint(v, p); g.player.place(p.x, p.z, v.y);
  });
  await action(page, 'KeyF');
  expect(await page.evaluate(() => __game.mode)).toBe('transit');
  const s = await page.evaluate(() => __game.ride.s);
  await page.evaluate(() => { __game.ride.wait = 0; __step(1 / 60, 180); });
  expect(await page.evaluate(() => __game.ride.s)).toBeGreaterThan(s);
  await page.evaluate(() => { __game.ride.v = 0; __game.ride.wait = 7; });
  await action(page, 'KeyF');
  expect(await page.evaluate(() => __game.mode)).toBe('foot');
  const saved = await page.evaluate(() => {
    const g = __game; g.money = 1234; g.stats.deliveries = 3; g.jobs.landmarks[0].found = true; g.save();
    return { x: Math.round(g.player.x), z: Math.round(g.player.z) };
  });
  await page.reload();
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  expect(await page.evaluate(() => ({ money: __game.money, deliveries: __game.stats.deliveries, found: __game.jobs.landmarks[0].found, mode: __game.mode })))
    .toEqual({ money: 1234, deliveries: 3, found: true, mode: 'foot' });
  expect(await page.evaluate((p) => Math.hypot(__game.player.x - p.x, __game.player.z - p.z), saved)).toBeLessThan(60);
  await page.getByRole('button', { name: 'O hře', exact: true }).click();
  await expect(page.locator('#panel-about')).toContainText('Datum mapových dat OpenStreetMap:');
  if (await page.evaluate(() => __game.world.meta.osmTimestamp === null)) {
    await expect(page.locator('#panel-about')).toContainText('u této starší datové sady není doloženo');
  }
  expect(errors).toEqual([]);
});

test('uložení verze 1 a kontrolní trasy E01', async ({ page }) => {
  const save = {
    x: -42, z: 52, hour: 17.5, money: 1460,
    stats: { deliveries: 4 }, found: ['Plzeňský Prazdroj'],
  };
  await page.addInitScript((save) => {
    localStorage.setItem('plzen-naplno-v1', JSON.stringify({ v: 1, ...save }));
  }, save);
  await page.goto('/?debug&view=620&shadows=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  const restored = await page.evaluate(() => {
    const g = window.__game;
    return { x: g.player.x, z: g.player.z, hour: g.hour, money: g.money, stats: g.stats,
      found: g.jobs.landmarks.filter((landmark) => landmark.found).map((landmark) => landmark.name) };
  });
  expect(restored).toEqual(save);

  const gps = await page.evaluate(() => {
    const world = window.__game.world;
    return [[49.7475, 13.3776], [49.74268195, 13.59419935], [49.7196333, 13.6920319]].map(([lat, lon]) => {
      const { x, z } = world.gpsToWorld(lat, lon);
      return { x, z, ...world.worldToGps(x, z) };
    });
  });
  expect(gps).toEqual([
    { lat: 49.7475, lon: 13.3776, x: 0, z: 0 },
    { lat: 49.74268195, lon: 13.59419935, x: expect.closeTo(15609.448757, 6), z: expect.closeTo(535.882793, 6) },
    { lat: 49.7196333, lon: 13.6920319, x: expect.closeTo(22659.849305, 6), z: expect.closeTo(3099.445841, 6) },
  ]);

  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
  for (const destination of [[780.8, 129.8], [-349.6, -5062]]) {
    const routed = await page.evaluate(([x, z]) => {
      const { jobs } = window.__game;
      jobs.setWaypoint(x, z);
      window.__step(1 / 60);
      // Nouzová přímá značka obsahuje jen dvě souřadnice.
      return jobs.route?.length > 2;
    }, destination);
    expect(routed, `Trasa k bodu ${destination}`).toBe(true);
  }
});

test('Rokycany jsou vyhledatelné a průjezdné po D5 i po místních silnicích', async ({ page }, testInfo) => {
  await boot(page);
  await action(page, 'KeyM');
  const query = page.getByRole('searchbox', { name: 'Najít obec nebo památku' });
  await query.pressSequentially('rokycany');
  await expect(page.getByRole('button', { name: 'Rokycany', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nádraží Rokycany', exact: true }).click();
  await expect(query).toBeHidden();
  await page.evaluate(() => window.__step(1 / 60));
  const stationRoute = await page.evaluate(() => window.__game.jobs.route);
  expect(stationRoute.length).toBeGreaterThan(100);
  expect(stationRoute.at(-2)).toBeCloseTo(15467, -1);

  await action(page, 'KeyM');
  await query.fill('masarykovo namesti');
  await query.press('Enter');
  await expect(query).toBeHidden();
  await page.evaluate(() => window.__step(1 / 60));
  expect(await page.evaluate(() => window.__game.jobs.waypoint.x)).toBeCloseTo(15609, -1);

  const results = await page.evaluate(() => {
    const g = window.__game, w = g.world, car = g.player.lastCar;
    // Průjezd simuluje jen tento vůz, takže ostatní vozidla nesmějí zůstat stát v trase.
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    g.vehicles.obstacles.length = 0;
    car.temper = 1;
    const plzen = w.nearestNode(g.player.x, g.player.z, 250);
    const square = w.nearestNode(g.jobs.waypoint.x, g.jobs.waypoint.z, 250);
    const path = (from, to) => {
      const edges = w.findPath(from, to, 12000);
      if (!edges?.length) throw new Error(`Chybí silniční trasa ${from} → ${to}.`);
      return edges;
    };
    const viaD5 = (from, to, checkpoint, direction) => {
      let best = 100, chosen = -1;
      for (let edge = 0; edge < w.edgeCount; edge++) {
        if (w.r.cls[w.eRoad[edge]] !== 0) continue;
        const a = w.eFrom[edge], b = w.eTo[edge];
        if (Math.sign(w.nodeX[b] - w.nodeX[a]) !== direction) continue;
        const distance = Math.hypot(w.nodeX[a] - checkpoint[0], w.nodeZ[a] - checkpoint[1]);
        if (distance < best) { best = distance; chosen = edge; }
      }
      if (chosen < 0) throw new Error('Na kontrolním místě chybí jízdní směr D5.');
      return [...path(from, w.eFrom[chosen]), chosen, ...path(w.eTo[chosen], to)];
    };
    const cases = [
      ['Po místních do Rokycan', path(plzen, square)],
      ['Po místních do Plzně', path(square, plzen)],
      ['Po D5 do Rokycan', viaD5(plzen, square, [12298, 311], 1)],
      ['Po D5 do Plzně', viaD5(square, plzen, [12291, 299], -1)],
    ];
    const drive = (edges) => {
      const first = edges[0], destination = w.eTo[edges.at(-1)];
      const position = {};
      w.edgePoint(first, 0, 0, position);
      car.place(position.x, position.z, Math.atan2(position.tx, position.tz));
      Object.assign(car, { edge: first, s: 0, lane: 0, blocked: 0, dead: false });
      let next = 1, maxOffRoad = 0, seamStep = 0;
      const pickNext = g.vehicles._pickNext;
      g.vehicles._pickNext = () => {
        car.next = edges[next++] ?? -1;
        car.nextLane = 0;
        car.turnSlow = 3;
      };
      try {
        g.vehicles._pickNext(car);
        for (let tick = 0; tick < 60_000 && !car.dead; tick++) {
          const x = car.x, y = car.y;
          g.vehicles.stepAI(car, 0.05);
          if ((x <= 7769 && car.x > 7769) || (x >= 7769 && car.x < 7769)) {
            seamStep = Math.max(seamStep, Math.abs(car.y - y));
          }
          if (tick % 30 === 0) {
            const road = w.nearestRoad(car.x, car.z, 100, 13, 0, {});
            maxOffRoad = Math.max(maxOffRoad, road?.dist ?? 100);
          }
          if (tick % 160 === 0) g.chunks.update(car.x, car.z, 620, 6);
        }
      } finally {
        g.vehicles._pickNext = pickNext;
      }
      g.chunks.update(car.x, car.z, 620, 6);
      car.sync();
      window.__view(car.x - 8, car.y + 4, car.z - 8, car.x, car.y + 1, car.z);
      return {
        metres: Math.round(edges.reduce((sum, edge) => sum + w.eLen[edge], 0)),
        motorwayMetres: Math.round(edges.reduce((sum, edge) =>
          sum + (w.r.cls[w.eRoad[edge]] === 0 ? w.eLen[edge] : 0), 0)),
        distanceToEnd: Math.hypot(car.x - w.nodeX[destination], car.z - w.nodeZ[destination]),
        completed: car.dead && next === edges.length + 1,
        seamStep, maxOffRoad,
      };
    };
    g._enterCar(car);
    return cases.map(([name, edges]) => ({ name, ...drive(edges) }));
  });

  await testInfo.attach('kontrolní průjezdy E02', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  for (const result of results) {
    expect(result.completed, result.name).toBe(true);
    expect(result.metres, result.name).toBeGreaterThan(15_000);
    expect(result.distanceToEnd, result.name).toBeLessThan(15);
    expect(result.maxOffRoad, result.name).toBeLessThan(12);
    expect(result.seamStep, result.name).toBeLessThan(0.5);
  }
  expect(results.slice(0, 2).map((result) => result.motorwayMetres)).toEqual([0, 0]);
  for (const result of results.slice(2)) expect(result.motorwayMetres, result.name).toBeGreaterThan(3000);
});

test('mobilní ovládání pohybuje hráčem a otevírá mapu', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  await expect(page.locator('#stick')).toBeVisible();
  expect(await page.evaluate(() => __game.renderer.shadowMap.enabled)).toBe(false);
  const moved = await page.evaluate(() => {
    const stick = document.querySelector('#stick'), r = stick.getBoundingClientRect();
    const x = __game.player.x, z = __game.player.z;
    const touch = new Touch({ identifier: 1, target: stick, clientX: r.x + r.width / 2, clientY: r.y + 10 });
    stick.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [touch], bubbles: true, cancelable: true }));
    __step(1 / 60, 120);
    stick.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch], bubbles: true }));
    return Math.hypot(__game.player.x - x, __game.player.z - z);
  });
  expect(moved).toBeGreaterThan(3);
  await page.evaluate(() => {
    document.querySelector('#tb-map').dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true }));
    __step(1 / 60);
  });
  await expect(page.locator('#bigmap')).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});
