import { expect, test, devices } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function boot(page) {
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
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
  page.on('requestfailed', (request) => {
    // Rychlé přesuny odstraňují dlaždice a záměrně přerušují jejich načítání.
    if (request.failure()?.errorText === 'net::ERR_ABORTED' && new URL(request.url()).pathname.includes('/detail/city/')) return;
    failed.push(request.url());
  });
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
    const { vehicles, car, world } = window.__game;
    // Pro zkoušku rozjezdu uvolni vozovku.
    for (const other of [...vehicles.cars]) if (other !== car) vehicles.remove(other);
    const road = world.nearestRoad(2399, 7425, 20, 0, 0, {});
    car.place(road.x - road.dz * 1.8, road.z + road.dx * 1.8, Math.atan2(road.dx, road.dz));
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
    const day = g.clock.day;
    const event = g.transit.timetable.events(day).find(({ trip }) => trip.route.type === 'tram'
      && trip.route.ref === '4' && trip.start > 8 * 3600 && trip.start < 9 * 3600
      && trip.stops.slice(1, -1).some(({ target }) => target[1] === 'U Práce'));
    const { trip } = event;
    const stop = trip.stops.findIndex(({ target }) => target[1] === 'U Práce');
    const p = {};
    trip.route.posAt(trip.stops[stop].target[0] - 14.1, 0, p);
    g.player.place(p.x, p.z);
    window.__setClock(null, trip.times[stop * 2] / 3600);
    const v = g.transit.vehicles.find((v) => v.event.key === event.key);
    g.transit.exitPoint(v, p);
    g.player.place(p.x, p.z, v.y);
    // U nástupiště ověřujeme nastoupení do spoje, nikoli do zaparkovaného auta.
    for (const car of [...g.vehicles.cars]) g.vehicles.remove(car);
  });
  await action(page, 'KeyF');
  expect(await page.evaluate(() => __game.mode)).toBe('transit');
  const s = await page.evaluate(() => __game.ride.s);
  await page.evaluate(() => { __step(1 / 30, 260); });
  expect(await page.evaluate(() => __game.ride.s)).toBeGreaterThan(s);
  await page.evaluate(() => __setClock(null, __game.hour + 0.1));
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
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  const restored = await page.evaluate(() => {
    const g = window.__game;
    return { x: g.player.x, z: g.player.z, hour: g.hour, money: g.money, stats: g.stats,
      found: g.jobs.landmarks.filter((landmark) => landmark.found).map((landmark) => landmark.name) };
  });
  expect(restored).toEqual(save);
  expect(await page.evaluate(() => new Date(__game.clock.day * 86_400_000).toISOString().slice(0, 10))).toBe('2026-11-09');

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

test('silniční trasy spojují Plzeň, Rokycany, Hrádek a Dobřív v obou směrech', async ({ page }, testInfo) => {
  test.setTimeout(210_000);
  await boot(page);
  await action(page, 'KeyM');
  const query = page.getByRole('searchbox', { name: 'Najít obec, památku nebo zastávku' });
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

  await action(page, 'KeyM');
  await query.fill('hradek');
  await expect(page.getByRole('button', { name: 'Hrádek', exact: true })).toBeVisible();
  await query.fill('dobriv');
  await expect(page.getByRole('button', { name: 'Dobřív', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Vodní hamr Dobřív', exact: true }).click();
  await page.evaluate(() => window.__step(1 / 60));
  expect(await page.evaluate(() => __game.jobs.route.at(-2))).toBeCloseTo(22692.9, 0);

  const results = await page.evaluate(() => {
    const g = window.__game, w = g.world, car = g.player.lastCar;
    // Průjezd simuluje jen tento vůz, takže ostatní vozidla nesmějí zůstat stát v trase.
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    g.vehicles.obstacles.length = 0;
    car.temper = 1;
    const plzen = w.nearestNode(g.player.x, g.player.z, 250);
    const klabava = w.nearestNode(...w.meta.places.find((p) => p[2] === 'Klabava').slice(0, 2), 250);
    const square = w.nearestNode(...w.meta.landmarks.find((p) => p[2] === 'Masarykovo náměstí (Rokycany)').slice(0, 2), 250);
    const hradek = w.nearestNode(...w.meta.places.find((p) => p[2] === 'Hrádek').slice(0, 2), 250);
    const hamr = w.nearestNode(g.jobs.walkRoute[0], g.jobs.walkRoute[1], 250);
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
      ['Z Plzně přes Klabavu, Rokycany a Hrádek k hamru',
        [...path(plzen, klabava), ...path(klabava, square), ...path(square, hradek), ...path(hradek, hamr)], 18188],
      ['Od hamru přes Hrádek, Rokycany a Klabavu do Plzně',
        [...path(hamr, hradek), ...path(hradek, square), ...path(square, klabava), ...path(klabava, plzen)], 18188],
    ];
    const drive = (edges, seam) => {
      const first = edges[0], destination = w.eTo[edges.at(-1)];
      const position = {};
      w.edgePoint(first, 0, 0, position);
      car.place(position.x, position.z, Math.atan2(position.tx, position.tz));
      Object.assign(car, { edge: first, s: 0, lane: 0, blocked: 0, dead: false });
      let next = 1, maxOffRoad = 0, seamStep = 0, crossed = false;
      const pickNext = g.vehicles._pickNext;
      g.vehicles._pickNext = () => {
        car.next = edges[next++] ?? -1;
        car.nextLane = 0;
        car.turnSlow = 3;
      };
      try {
        g.vehicles._pickNext(car);
        for (let tick = 0; tick < 100_000 && !car.dead; tick++) {
          const x = car.x, y = car.y;
          w.traffic.tick(0.05);
          g.vehicles.stepAI(car, 0.05);
          if ((x <= seam && car.x > seam) || (x >= seam && car.x < seam)) {
            crossed = true;
            seamStep = Math.max(seamStep, Math.abs(car.y - y));
          }
          if (tick % 30 === 0) {
            const road = w.nearestRoad(car.x, car.z, 100, 13, 0, {});
            maxOffRoad = Math.max(maxOffRoad, road?.dist ?? 100);
          }
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
        seamStep, maxOffRoad, crossed,
      };
    };
    g._enterCar(car);
    return cases.map(([name, edges, seam = 7769]) => ({ name, ...drive(edges, seam) }));
  });

  await testInfo.attach('kontrolní průjezdy E02 a E03', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  for (const result of results) {
    expect(result.completed, result.name).toBe(true);
    expect(result.metres, result.name).toBeGreaterThan(15_000);
    expect(result.distanceToEnd, result.name).toBeLessThan(15);
    expect(result.maxOffRoad, result.name).toBeLessThan(12);
    expect(result.crossed, result.name).toBe(true);
    expect(result.seamStep, result.name).toBeLessThan(0.5);
  }
  expect(results.slice(0, 2).map((result) => result.motorwayMetres)).toEqual([0, 0]);
  for (const result of results.slice(2, 4)) expect(result.motorwayMetres, result.name).toBeGreaterThan(3000);
  for (const result of results.slice(4)) expect(result.metres, result.name).toBeGreaterThan(24_000);
});

test('E03 – pěší přístup k hamru, mosty a hranice pro chůzi, jízdu a let', async ({ page }, testInfo) => {
  await boot(page);
  await action(page, 'KeyM');
  await page.getByRole('searchbox').fill('vodni hamr');
  await page.getByRole('button', { name: 'Vodní hamr Dobřív', exact: true }).click();

  const result = await page.evaluate(() => {
    const g = __game, { world: w, player, jobs } = g;
    const walk = jobs.walkRoute;
    for (let i = 0; i < 5; i++) g.chunks.update(walk[0], walk[1], 620, 100);
    player.place(walk[0], walk[1]);
    let swimming = false;
    for (let i = 2; i < walk.length; i += 2) {
      for (let j = 0; j < 2500; j++) {
        const dx = walk[i] - player.x, dz = walk[i + 1] - player.z, d = Math.hypot(dx, dz);
        if (d < 0.35) break;
        player.update(1 / 60, dx / d, dz / d, false, false);
        swimming ||= player.swimming;
      }
    }
    const footGap = Math.hypot(walk.at(-2) - player.x, walk.at(-1) - player.z);
    jobs.update(1);
    const arrived = !jobs.waypoint && jobs.landmarks.find((l) => l.name === 'Vodní hamr Dobřív').found;

    const car = player.lastCar;
    const bridges = [...w.archedBridges].map(([road, arches]) => {
      const a = w.rOff[road], b = w.rOff[road + 1] - 1, x = (w.rpx[a] + w.rpx[b]) / 2, z = (w.rpz[a] + w.rpz[b]) / 2;
      const floor = w.heightAt(x, z);
      const clearance = w.groundY(x, z) - w.groundY(x, z, floor);
      const gaps = [[a, b], [b, a]].map(([start, end]) => {
        const x = w.rpx[end], z = w.rpz[end];
        player.place(w.rpx[start], w.rpz[start], w.rpy[start]);
        for (let i = 0; i < 1800; i++) {
          const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz);
          if (d < 0.4) break;
          player.update(1 / 60, dx / d, dz / d, false, false);
        }
        return Math.hypot(x - player.x, z - player.z);
      });
      const drives = arches === 2 ? [[a, b], [b, a]].map(([start, end]) => {
        const dx = w.rpx[end] - w.rpx[start], dz = w.rpz[end] - w.rpz[start];
        const length = Math.hypot(dx, dz), tx = dx / length, tz = dz / length;
        car.place(w.rpx[start] - tx * 6 - tz * 1.6, w.rpz[start] - tz * 6 + tx * 1.6, Math.atan2(tx, tz));
        let crossed = false, maxStep = 0;
        for (let i = 0; i < 1200 && !crossed; i++) {
          const oldY = car.y;
          g.vehicles.stepDynamic(car, 1 / 60, 0.55, 0, false);
          maxStep = Math.max(maxStep, Math.abs(car.y - oldY));
          crossed = (car.x - w.rpx[end]) * tx + (car.z - w.rpz[end]) * tz > 4;
        }
        return { crossed, maxStep };
      }) : [];
      return { arches, clearance, gaps, drives };
    });

    const [cx, cz, tx, tz] = w.roadClosures.find(([x, z]) => x > w.playMaxX - 50 && z > 2400 && z < 2500);
    car.place(cx - tx * 12, cz - tz * 12, Math.atan2(tx, tz));
    const startDistance = Math.hypot(car.x - cx, car.z - cz);
    let closest = startDistance, escaped = false;
    for (let i = 0; i < 420; i++) {
      g.vehicles.stepDynamic(car, 1 / 60, 0.7, 0, false);
      const distance = Math.hypot(car.x - cx, car.z - cz);
      closest = Math.min(closest, distance);
      escaped ||= (car.x - cx) * tx + (car.z - cz) * tz > 0;
    }

    player.place(w.playMaxX - 29, 2100);
    for (let i = 0; i < 180; i++) player.update(1 / 60, 1, 0, true, false);
    const footMargin = w.playMaxX - player.x;
    const heli = g.helis[3];
    heli.occupied = true; heli.rotor = 30; heli.yaw = Math.PI / 2;
    heli.z = 3100; heli.x = 18138; heli.y = w.heightAt(heli.x, heli.z) + 140;
    for (let i = 0; i < 520; i++) {
      heli.update(1 / 60, 1, 0, 0);
      if (i % 15 === 0) g.chunks.update(heli.x, heli.z, 620, 4);
    }
    const heliCrossed = heli.x > 18238 && heli.y - w.heightAt(heli.x, heli.z) > 80;
    heli.x = w.playMaxX - 85; heli.y = w.heightAt(heli.x, heli.z) + 140;
    for (let i = 0; i < 300; i++) heli.update(1 / 60, 1, 0, 0);
    return { footGap, swimming, arrived, bridges, closest, escaped, footMargin, heliCrossed, heliMargin: w.playMaxX - heli.x };
  });
  await testInfo.attach('chůze, jízda u závory a let', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.footGap).toBeLessThan(0.5);
  expect(result.swimming).toBe(false);
  expect(result.arrived).toBe(true);
  expect(result.bridges).toHaveLength(2);
  for (const bridge of result.bridges) expect(Math.max(...bridge.gaps)).toBeLessThan(0.5);
  const wilson = result.bridges.find((b) => b.arches === 2);
  expect(wilson.clearance).toBeGreaterThan(6);
  for (const drive of wilson.drives) {
    expect(drive.crossed).toBe(true);
    expect(drive.maxStep).toBeLessThan(0.3);
  }
  expect(result.closest).toBeLessThan(5);
  expect(result.escaped).toBe(false);
  expect(result.footMargin).toBeCloseTo(20);
  expect(result.heliCrossed).toBe(true);
  expect(result.heliMargin).toBeCloseTo(40);
});

test('jemný terén u Klabavy má v grafice i při chůzi stejný povrch', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const game = window.__game, w = game.world;
    const [targetX, targetZ] = w.meta.places.find((place) => place[2] === 'Klabava');
    let chosen, distance = Infinity;
    for (const id of w.terrainDetail.keys()) {
      const x0 = w.minX + (id % w.cols) * 256, z0 = w.minZ + Math.floor(id / w.cols) * 256;
      const d = Math.hypot(x0 + 128 - targetX, z0 + 128 - targetZ);
      if (d < distance) { chosen = { id, x0, z0 }; distance = d; }
    }
    const { id, x0, z0 } = chosen;
    const offsets = w.terrainDetail.get(id), width = w.tDetailWidth;
    let peak = width + 1;
    for (let j = 1; j < width - 1; j++) for (let i = 1; i < width - 1; i++) {
      const point = j * width + i;
      if (Math.abs(offsets[point]) > Math.abs(offsets[peak])) peak = point;
    }
    const fx = 0.26, fz = 0.34;
    const x = x0 + ((peak % width) + fx) * w.tDetailG, z = z0 + (Math.floor(peak / width) + fz) * w.tDetailG;
    game.chunks.update(x, z, 620, 160);
    const geometry = game.chunks.chunks.get(id).group.children[0].geometry;
    const positions = geometry.getAttribute('position');
    const y = positions.getY(peak);
    const surface = y + (positions.getY(peak + 1) - y) * fx + (positions.getY(peak + width) - y) * fz;
    const ground = w.heightAt(x, z);
    game.player.place(x, z, ground + 0.05);
    for (let i = 0; i < 20; i++) game.player.update(1 / 60, 0, 0, false, false);
    return { distance, vertices: positions.count, surface, ground, bodyY: game.player.y,
      change: Math.abs(y - w.baseHeightAt(positions.getX(peak), positions.getZ(peak))) };
  });
  expect(result.distance).toBeLessThan(850);
  expect(result.vertices).toBe(65 ** 2);
  expect(result.change).toBeGreaterThan(0.4);
  expect(result.surface).toBeCloseTo(result.ground, 4);
  expect(result.bodyY).toBeCloseTo(result.ground + 0.05, 4);
});

test('E03 – oba tubusy Valíku mají vlastní vozovku, stěny a kameru pod terénem', { tag: '@webgpu' }, async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  await boot(page);
  const results = await page.evaluate(() => {
    const g = __game, w = g.world, car = g.player.lastCar;
    g._enterCar(car);
    return w.tunnels.map((tube) => {
      const [first, last] = tube.portals;
      const start = { x: first.x - first.dx * 49, z: first.z - first.dz * 49 };
      const end = { x: last.x - last.dx * 49, z: last.z - last.dz * 49 };
      const target = [...tube.points, end];
      car.place(start.x, start.z, Math.atan2(first.dx, first.dz));
      let i = 0, maxStep = 0, totalUnder = 0, maxCover = 0;
      let wall = false, above = false, inCamera = false, safeSave = false;
      for (let tick = 0; tick < 3600 && i < target.length; tick++) {
        const p = target[i], dx = p.x - car.x, dz = p.z - car.z;
        if (Math.hypot(dx, dz) < 5) { i++; continue; }
        const yaw = Math.atan2(dx, dz), diff = Math.atan2(Math.sin(car.yaw - yaw), Math.cos(car.yaw - yaw));
        const oldY = car.y;
        g.vehicles.stepDynamic(car, 1 / 60, 0.66, Math.max(-1, Math.min(1, diff * 1.4)), false);
        maxStep = Math.max(maxStep, Math.abs(oldY - car.y));
        const under = w.tunnelAt(car.x, car.z, car.y);
        const terrain = w.heightAt(car.x, car.z);
        const cover = terrain - car.y;
        if (!under?.inside || cover < 6) continue;
        totalUnder++;
        if (cover > maxCover) maxCover = cover;
        if (inCamera) continue;
        const { floor, x: px, z: pz } = under;
        const sideX = px - Math.cos(car.yaw) * (tube.halfWidth - 0.15);
        const sideZ = pz + Math.sin(car.yaw) * (tube.halfWidth - 0.15);
        wall = w.collideCircle(sideX, sideZ, 0.8, floor + 0.3, floor + 1.5);
        const surfaceRoad = w.nearestRoad(car.x, car.z, 190, 13, 0, {}, terrain);
        const tunnelRoad = w.nearestRoad(car.x, car.z, 190, 13, 0, {}, car.y);
        above = w.groundY(car.x, car.z, terrain + 0.5) > car.y + 5
          && (!surfaceRoad || !w.tunnelRoads.has(surfaceRoad.road)) && tunnelRoad?.road === tube.road;
        g.chunks.update(car.x, car.z, 620, 90);
        g.camYaw = car.yaw;
        g._updateCamera(1);
        g.render();
        inCamera = g.tunnelLight.visible && g.camera.position.y < terrain - 1;
        g.save();
        const saved = JSON.parse(localStorage.getItem('plzen-naplno-v1'));
        safeSave = tube.portals.some(({ outside }) => Math.hypot(outside.x - saved.x, outside.z - saved.z) < 1);
      }
      const completed = i === target.length && Math.hypot(car.x - end.x, car.z - end.z) < 5;
      return { completed, maxStep, totalUnder, maxCover, inCamera, wall, above, safeSave };
    });
  });
  await testInfo.attach('průjezdy tunelem Valík', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  expect(results).toHaveLength(2);
  for (const result of results) {
    expect(result.completed).toBe(true);
    expect(result.totalUnder).toBeGreaterThan(600);
    expect(result.maxCover).toBeGreaterThan(20);
    expect(result.maxStep).toBeLessThan(0.35);
    expect(result.wall && result.above && result.inCamera && result.safeSave).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('mobilní ovládání pohybuje hráčem a otevírá mapu', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 844, height: 390 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  await expect(page.locator('#stick')).toBeVisible();
  expect(await page.evaluate(() => __game.renderer.shadowMap.enabled)).toBe(false);
  expect(await page.evaluate(() => __game.chunks.paintedBuildings === __game.chunks.buildingMat)).toBe(true);
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
