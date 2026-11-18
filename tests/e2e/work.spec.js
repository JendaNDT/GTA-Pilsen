import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

const SAVE_KEY = 'plzen-naplno-v1';

async function boot(page) {
  await page.goto(gameUrl('/?debug&view=620&shadows=0'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
}

async function freeze(page) {
  await page.evaluate(() => {
    window.__freeze(true);
    const g = window.__game;
    g.vehicles.spawnTimer = g.peds.timer = 100_000;
  });
}

async function panel(page, name) {
  if (!await page.locator('#menu').isVisible()) await page.locator('#btn-menu').click();
  const button = page.getByRole('button', { name, exact: true });
  if (await button.getAttribute('aria-expanded') === 'false') await button.click();
}

test('E10 – taxi, příjem ze zakázek a vlastní auto po obnovení hry', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await boot(page);
  await panel(page, 'Zakázky');
  await page.getByRole('button', { name: 'Vzít taxi jízdu' }).click();
  await expect(page.locator('#job-feedback')).toContainText('nastup');
  await panel(page, 'Garáž');
  await expect(page.getByRole('button', { name: /Koupit malé auto/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Najít garáž na mapě' }).click();
  await expect(page.locator('#bigmap')).toBeVisible();
  await page.getByRole('button', { name: 'Zavřít mapu' }).click();
  await freeze(page);
  const start = await page.evaluate(() => {
    const g = window.__game, car = g.player.lastCar;
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    g.player.place(car.x + 2, car.z);
    g.doAction();
    return { x: car.x, z: car.z, yaw: car.yaw, garage: g.jobs.waypoint };
  });
  const earnings = [];
  for (let i = 0; i < 5; i++) {
    await page.evaluate(({ x, z, yaw }) => {
      const g = window.__game;
      if (g.car) g.car.place(x, z, yaw);
      else g.player.place(x, z);
    }, start);
    await panel(page, 'Zakázky');
    await page.getByRole('button', { name: i < 2 ? 'Vzít taxi jízdu' : 'Vzít rozvoz jídla' }).click();
    await freeze(page);
    const outcome = await page.evaluate((i) => {
      const g = window.__game, j = g.jobs.job, car = g.car, oldMoney = g.money;
      // Přesun k testovacím bodům může objevit památku. Zde měříme jen výplatu zakázky.
      g.jobs.checkTimer = 10;
      const canWait = j.type !== 'taxi' || (j.pick.waiting && !g.world.isWater(j.pick.waiting.x, j.pick.waiting.z));
      for (const t of [j.pick, j.drop]) {
        if (car) car.place(t.x, t.z, Math.atan2(t.tx ?? 0, t.tz ?? 1));
        else g.player.place(t.x, t.z);
        g.jobs.update(0.05);
        if (t === j.pick && j.type === 'taxi' && i === 1) g.onCrash(car, 8, null);
      }
      const amount = g.money - oldMoney;
      g.jobs.update(0.05);
      return { amount, paid: g.jobs.last, unique: g.money - oldMoney === amount, canWait, comfort: j.comfort };
    }, i);
    expect(outcome.paid.state).toBe('paid');
    expect(outcome.amount).toBeGreaterThan(190);
    expect(outcome.amount).toBe(outcome.paid.amount);
    expect(outcome.unique && outcome.canWait).toBe(true);
    earnings.push(outcome);
    if (i === 1) await page.evaluate(() => window.__game.doAction());
  }
  expect(earnings[0].comfort).toBe(90);
  expect(earnings[1].comfort).toBe(66);
  await page.evaluate(({ x, z }) => {
    const g = window.__game;
    g.player.place(x + 10, z);
  }, start.garage);
  await panel(page, 'Garáž');
  const beforePurchase = await page.evaluate(() => window.__game.money);
  expect(await page.evaluate(() => {
    const g = window.__game, money = g.money, setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('test'); };
    try { return g.garage.perform('buy') === g.saveError && g.money === money && !g.garage.owned; }
    finally { Storage.prototype.setItem = setItem; }
  })).toBe(true);
  await page.getByRole('button', { name: /Koupit malé auto/ }).click();
  await expect(page.locator('#garage-car')).toContainText('100 %');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).money, SAVE_KEY)).toBe(beforePurchase - 1350);
  await page.getByRole('button', { name: 'Vyjet s autem' }).click();
  await page.evaluate(() => {
    const g = window.__game;
    if (!g.garage.active) throw new Error('Vlastní vůz nevyjel');
    g.garage.active.health = 92;
  });
  await page.getByRole('button', { name: 'Uložit auto do garáže' }).click();
  await expect(page.locator('#garage-car')).toContainText('92 %');
  await page.getByRole('button', { name: /Opravit vůz.*115 Kč/ }).click();
  await page.getByRole('button', { name: /Lepší brzdy.*325 Kč/ }).click();
  await expect(page.locator('#garage-car')).toContainText('Lepší brzdy');
  const record = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(record.money).toBe(beforePurchase - 1350 - 115 - 325);
  expect(record.stats).toMatchObject({ taxiRides: 2, deliveries: 3 });
  await boot(page);
  await panel(page, 'Garáž');
  await expect(page.locator('#garage-car')).toContainText('Lepší brzdy');
  await page.getByRole('button', { name: 'Vyjet s autem' }).click();
  const after = await page.evaluate(() => {
    const g = window.__game, car = g.garage.active;
    g.player.place(car.x + 2, car.z);
    g.doAction();
    const vx = 15 * Math.sin(car.yaw), vz = 15 * Math.cos(car.yaw);
    car.vx = vx; car.vz = vz;
    g.vehicles.stepDynamic(car, 0.1, -1, 0, false);
    return { money: g.money, brakes: car.upgrades.brakes, own: g.car === car, speed: car.speed };
  });
  expect(after).toMatchObject({ money: record.money, brakes: true, own: true });
  expect(after.speed).toBeLessThan(13);
  expect(errors).toEqual([]);
});

test('E10 – přerušení, pokuta a opakování výplaty po chybě zápisu', async ({ page }) => {
  await boot(page);
  await panel(page, 'Zakázky');
  const accept = page.getByRole('button', { name: 'Vzít rozvoz jídla' });
  await accept.click();
  await panel(page, 'Zakázky');
  await page.getByRole('button', { name: 'Zrušit zakázku' }).click();
  await expect(page.locator('#job-result')).toContainText('Zrušeno hráčem');
  await accept.click();
  await boot(page);
  await panel(page, 'Zakázky');
  await expect(page.locator('#job-result')).toContainText('Přerušeno · Načtení uložené hry');
  await accept.click();
  await freeze(page);
  const beforeFine = await page.evaluate(() => {
    const g = window.__game, money = g.money;
    g._busted();
    return money;
  });
  await panel(page, 'Zakázky');
  await expect(page.locator('#job-result')).toContainText('pokuta 200 Kč');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).money, SAVE_KEY)).toBe(beforeFine - 200);
  await accept.click();
  await freeze(page);
  const failed = await page.evaluate(() => {
    const g = window.__game, j = g.jobs.job, money = g.money, setItem = Storage.prototype.setItem;
    const checkTimer = g.jobs.checkTimer;
    let writes = 0;
    // Dva kroky testují výplatu zakázky bez souběžné odměny za objevenou památku.
    g.jobs.checkTimer = 0.5;
    Storage.prototype.setItem = () => { writes++; throw new Error('test'); };
    try {
      for (const target of [j.pick, j.drop]) {
        g.player.place(target.x, target.z);
        g.jobs.update(0.05);
      }
      return { pending: j.pending.amount, money, writes, unchanged: g.money === money && !g.stats.deliveries };
    } finally {
      g.jobs.checkTimer = checkTimer;
      Storage.prototype.setItem = setItem;
    }
  });
  expect(failed).toMatchObject({ unchanged: true, writes: 1 });
  await panel(page, 'Zakázky');
  await page.getByRole('button', { name: 'Znovu uložit odměnu' }).click();
  await expect(page.locator('#job-result')).toContainText('Dokončeno');
  await boot(page);
  const saved = await page.evaluate(() => ({ money: window.__game.money, stats: window.__game.stats, last: window.__game.jobs.last }));
  expect(saved.money).toBe(failed.money + failed.pending);
  expect(saved.stats).toEqual({ busted: 1, deliveries: 1 });
  expect(saved.last.state).toBe('paid');
});

test('E10 – rozvoz autem vyžaduje průjezd Lochotínem a Bolevcem a pěší předání', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T08:00:00Z'));
  await page.addInitScript(() => {
    let seed = 1729;
    Math.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / (2 ** 32));
  });
  await boot(page);
  await panel(page, 'Zakázky');
  await page.getByRole('button', { name: 'Rozvézt autem' }).click();
  await freeze(page);
  const road = await page.evaluate(() => {
    const g = window.__game, j = g.jobs.job, w = g.world, car = g.player.lastCar;
    const drop = { x: 1465.5, z: -2584.6 };
    g.player.place(j.pick.x, j.pick.z);
    g.jobs.update(0.05);
    g.player.place(drop.x, drop.z);
    g.jobs.update(0.05);
    const guarded = g.jobs.job === j && j.index === 0;
    g.player.place(car.x + 2, car.z);
    g.doAction();
    const distance = [], route = [j.pick.edge];
    let context = 0;
    for (const next of j.steps) {
      const last = route.at(-1);
      const path = w.findPath(w.eTo[last], next.edge === undefined ? w.nearestNode(next.x, next.z, 150) : w.eFrom[next.edge],
        18_000, last, context);
      if (!path) throw new Error(`Nedostupný úsek ${next.label}`);
      distance.push(path.reduce((sum, edge) => sum + w.eLen[edge], 0));
      if (next.edge !== undefined) path.push(next.edge);
      for (const edge of path) {
        context = w.turnContext(route.at(-1), edge, context);
        if (context < 0) throw new Error(`Zakázané odbočení na úseku ${next.label}`);
        route.push(edge);
      }
    }
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    const { pick } = j, park = j.steps.at(-1), vehicles = g.vehicles;
    let routeIndex = 0, braking = false;
    const pickNext = vehicles._pickNext, planJunction = vehicles._planJunctionExit;
    const drivingLimit = w.traffic.drivingLimit;
    // Průjezd zakázky měříme na volné silnici. Čekání u značek testuje traffic.spec.js.
    w.traffic.drivingLimit = (vehicle, dt, limit) => limit;
    vehicles._pickNext = (c) => {
      if (c.edge !== route[routeIndex]) routeIndex++;
      c.next = route[routeIndex + 1] ?? -1;
      c.nextLane = c.next < 0 ? 0 : vehicles._laneFor(c.next);
      c.turnSlow = 4;
    };
    vehicles._planJunctionExit = () => {};
    car.place(pick.x, pick.z, Math.atan2(pick.tx, pick.tz));
    car.edge = pick.edge;
    car.s = pick.along;
    car.lane = vehicles._laneFor(pick.edge);
    car.temper = 0.85;
    vehicles._pickNext(car);
    try {
      const dt = 0.1;
      for (let i = 0; i < 13_500 && j.phase === 'drive' && g.jobs.job; i++) {
        w.traffic.tick(dt, null);
        if (routeIndex === route.length - 1 && car.s >= park.along - 5) braking = true;
        if (braking) vehicles.stepDynamic(car, dt, car.speed > 1 ? -1 : 0, 0, false);
        else vehicles.stepAI(car, dt);
        g.jobs.update(dt);
      }
    } finally {
      vehicles._pickNext = pickNext;
      vehicles._planJunctionExit = planJunction;
      w.traffic.drivingLimit = drivingLimit;
    }
    const endedInCar = j.phase;
    const arrivalDistance = Math.hypot(park.x - car.x, park.z - car.z);
    g.doAction();
    for (let i = 0; i < 400 && g.jobs.job; i++) {
      const dx = drop.x - g.player.x, dz = drop.z - g.player.z, d = Math.hypot(dx, dz) || 1;
      g.player.update(0.05, dx / d, dz / d, false, false);
      g.jobs.update(0.05);
    }
    return { guarded, endedInCar, paid: g.jobs.last, distance, remaining: j.time, arrivalDistance,
      routeIndex, edgeCount: route.length, index: j.index, braking, car: [car.x, car.z, car.speed] };
  });
  expect(road.guarded).toBe(true);
  expect(road.endedInCar, JSON.stringify(road)).toBe('walk');
  expect(road.routeIndex).toBe(road.edgeCount - 1);
  expect(road.arrivalDistance).toBeLessThan(9);
  expect(road.paid).toMatchObject({ type: 'car', state: 'paid' });
  expect(road.remaining).toBeGreaterThan(100);
  expect(road.distance.every((length) => length > 700)).toBe(true);
});

test('E10 – jízda tramvají 1, přestup na autobus 30 a doručení od rybníka pěšky', async ({ page }, info) => {
  await boot(page);
  await panel(page, 'Zakázky');
  await page.getByRole('button', { name: 'Rozvézt MHD' }).click();
  await freeze(page);
  const trip = await page.evaluate(() => {
    const g = window.__game, { player, jobs, transit, world } = g, j = jobs.job;
    for (const car of [...g.vehicles.cars]) g.vehicles.remove(car);
    g.player.place(j.pick.x, j.pick.z);
    // Pondělní tramvaj v 18:00 navazuje v Bolevci na autobus v 18:13.
    window.__setClock('2026-11-09', 17 + 57.5 / 60);
    jobs.update(0.05);
    const dt = 0.1, rideChecks = [];
    const tick = () => {
      g.clock.tick(dt);
      const onFoot = g.mode === 'foot';
      world.traffic.tick(dt, onFoot ? player : null);
      transit.update(dt, g.focus, [], onFoot, g.clock);
      jobs.update(dt);
    };
    const until = (condition, seconds) => {
      for (let elapsed = 0; elapsed < seconds; elapsed += dt) {
        if (condition()) return true;
        tick();
      }
      return false;
    };
    for (const leg of j.legs) {
      const toPlatform = jobs.walkRoute;
      for (let i = 0; i < toPlatform.length; i += 2) {
        const x = toPlatform[i], z = toPlatform[i + 1];
        const walkedTo = until(() => {
          const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz);
          if (d < 1.4) return true;
          player.update(dt, dx / d, dz / d, false, false);
          return false;
        }, 60);
        if (!walkedTo) return { failure: 'nedostupné stanoviště pěšky', line: leg.line, position: [player.x, player.z], rideChecks };
      }
      let chosen;
      const found = until(() => {
        chosen = [...transit.active.values()].find((v) => v.canBoard && v.visible && v.route.ref === leg.line
          && v.event.trip.stops[v.stopIndex].stop === leg.from.i
          && v.event.trip.stops.slice(v.stopIndex + 1).some((s) => s.stop === leg.to.i));
        return chosen;
      }, 250);
      if (!found) return { failure: 'nenalezen nástup', line: leg.line, rideChecks };
      const door = transit.exitPoint(chosen, {});
      const clear = g._clearSpot(door.x, door.z, 0.4);
      player.place(clear.x, clear.z, chosen.y);
      g.doAction();
      if (jobs.job?.phase !== 'ride') return { failure: 'nenastoupeno', line: leg.line, mode: g.mode, rideChecks };
      const start = chosen.s;
      const { trip, start: dispatch } = chosen.event;
      const target = trip.stops.findIndex(({ stop }, i) => i > chosen.stopIndex && stop === leg.to.i);
      const scheduledArrival = dispatch - trip.start + trip.times[target * 2];
      const arrived = until(() => chosen.canAlight && trip.stops[chosen.stopIndex]?.stop === leg.to.i,
        Math.max(0, scheduledArrival - g.clock.now) + 120);
      if (!arrived) return { failure: 'nedojelo do cíle', line: leg.line, travelled: chosen.s - start, rideChecks };
      g.doAction();
      rideChecks.push({ line: leg.line, distance: chosen.s - start, phase: j.phase });
    }
    const walk = jobs.walkRoute;
    const start = [player.x, player.z];
    for (let i = 2; i < walk.length && jobs.job; i += 2) {
      const x = walk[i], z = walk[i + 1];
      for (let ticks = 0; ticks < 550 && Math.hypot(x - player.x, z - player.z) > 2; ticks++) {
        const dx = x - player.x, dz = z - player.z, d = Math.hypot(dx, dz);
        player.update(dt, dx / d, dz / d, false, false);
        tick();
        if (!jobs.job) break;
      }
    }
    return { rideChecks, start, end: [player.x, player.z], paid: jobs.last, remaining: j.time };
  });
  await info.attach('průjezd skutečných spojů', { body: JSON.stringify(trip), contentType: 'application/json' });
  expect(trip.failure).toBeUndefined();
  expect(trip.rideChecks).toMatchObject([{ line: '1', phase: 'board' }, { line: '30', phase: 'walk' }]);
  expect(trip.rideChecks[0].distance).toBeGreaterThan(3000);
  expect(trip.rideChecks[1].distance).toBeGreaterThan(1200);
  expect(trip.paid).toMatchObject({ type: 'transit', state: 'paid' });
  expect(trip.remaining).toBeGreaterThan(100);
});
