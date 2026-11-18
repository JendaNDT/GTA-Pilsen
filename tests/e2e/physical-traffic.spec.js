import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function start(page) {
  await page.goto(gameUrl('/?debug&quality=low'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
}

test('E20 – fyzikální auto zastaví na Doudlevecké a po přednosti pokračuje', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, traffic = w.traffic, manager = g.vehicles;
    const car = g.player.lastCar;
    for (const other of [...manager.cars]) if (other !== car) manager.remove(other);
    manager.obstacles.length = 0;
    const rule = traffic.controls.find((c) => c.kind === 'stop' && c.id === 11969048194 && c.mark === 4248);
    const lane = w.r.w[rule.road] / 4, start = rule.s - 17;
    const p = w.edgePoint(rule.edge, start, lane, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    Object.assign(car, { mode: 'ai', edge: rule.edge, lane, s: start, temper: 1, speed: 8, vx: p.tx * 8, vz: p.tz * 8 });
    manager._pickNext(car);
    g.player.place(car.x + 10, car.z + 10);
    for (let i = 0; i < 20; i++) g.colliders.update(g.player.x, g.player.z);
    g.trafficBodies.update(g, 1 / 60);
    let stopped = 0, front = null;
    for (let tick = 0; tick < 1500; tick++) {
      traffic.tick(1 / 60);
      g.physics.step(1 / 60);
      if (car.edge !== rule.edge || car.s > rule.s + 2) break;
      if (Math.abs(car.speed) < 0.1) {
        stopped += 1 / 60;
        front = rule.s - car.s - car.halfLen;
      }
    }
    return { physical: !!car.physical, stopped, front, passed: car.edge !== rule.edge || car.s > rule.s + 2 };
  });
  expect(result.physical).toBe(true);
  expect(result.stopped, JSON.stringify(result)).toBeGreaterThan(0.3);
  expect(result.front).toBeGreaterThanOrEqual(0);
  expect(result.front).toBeLessThanOrEqual(1);
  expect(result.passed).toBe(true);
});

test('E20 – zaparkované auto spí a po střetu s jedoucím autem se rozjede', async ({ page }) => {
  await start(page);
  const sample = await page.evaluate(() => {
    const g = __game, car = g.player.lastCar;
    for (const c of [...g.vehicles.cars]) if (c !== car) g.vehicles.remove(c);
    car.place(-42, 20, 0);
    g._enterCar(car);
    const parked = g.vehicles.add(new car.constructor('sedan', 0x888888));
    parked.place(-42, 35, 0);
    for (let i = 0; i < 20; i++) g.colliders.update(car.x, car.z);
    g.paused = false;
    g.vehicles.spawnTimer = Infinity;
    g.update(1 / 60);
    const asleep = parked.physical.body.IsDynamic() && !parked.physical.body.IsActive();
    car.vz = car.speed = 15;
    g.driver.teleport();
    let peak = 0, before = 0, after = 0;
    for (let i = 0; i < 160; i++) {
      const previous = car.speed;
      g.physics.step(1 / 60);
      if (!before && parked.speed > 1) { before = previous; after = car.speed; }
      peak = Math.max(peak, parked.speed);
    }
    return { asleep, moved: parked.z - 35, peak, before, after, damage: 100 - parked.health };
  });
  expect(sample.asleep).toBe(true);
  expect(sample.moved, JSON.stringify(sample)).toBeGreaterThan(1);
  expect(sample.peak).toBeGreaterThan(2);
  expect(sample.before - sample.after).toBeGreaterThan(2);
  expect(sample.damage).toBeGreaterThan(0);
});

test('E20 – fyzikální policejní vůz dojede k chodci a zastaví před ním', async ({ page }) => {
  await start(page);
  const sample = await page.evaluate(() => {
    const g = __game, Car = g.player.lastCar.constructor;
    for (const c of [...g.vehicles.cars]) g.vehicles.remove(c);
    const patrol = g.vehicles.add(new Car('police', 0xffffff));
    g.player.place(-42, 52);
    patrol.place(-42, 20, 0);
    patrol.mode = 'police';
    g.wanted = 1;
    g.vehicles.obstacles.length = 0;
    for (let i = 0; i < 20; i++) g.colliders.update(g.player.x, g.player.z);
    g.trafficBodies.update(g, 1 / 60);
    let peak = 0, closest = Infinity;
    for (let i = 0; i < 900; i++) {
      g.physics.step(1 / 60);
      peak = Math.max(peak, patrol.speed);
      closest = Math.min(closest, Math.hypot(patrol.x - g.player.x, patrol.z - g.player.z));
    }
    return { physical: !!patrol.physical, peak, closest, distance: patrol.policeDist, speed: patrol.speed };
  });
  expect(sample.physical).toBe(true);
  expect(sample.peak, JSON.stringify(sample)).toBeGreaterThan(3);
  expect(sample.closest).toBeGreaterThan(3);
  expect(sample.distance).toBeLessThan(9);
  expect(Math.abs(sample.speed)).toBeLessThan(0.25);
});

test('E20 – tramvaj brzdí a při náhlé překážce odstrčí auto na kolejích', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const g = __game, { transit, transitBodies, physics } = g;
    const tram = transit.vehicles.find((v) => v.route.ref === '4' && v.route.from === 'Univerzita');
    const car = g.player.lastCar;
    for (const c of [...g.vehicles.cars]) if (c !== car) g.vehicles.remove(c);
    const start = 3430, p = tram.route.posAt(start + 5, tram.side, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz) + Math.PI / 2);
    g.player.place(p.x + p.tz * 16, p.z - p.tx * 16);
    for (let i = 0; i < 20; i++) g.colliders.update(p.x, p.z);
    g.trafficBodies.update(g, 1 / 60);
    transit.vehicles = [tram];
    Object.assign(tram, { s: start, v: 11, wait: 0, doorsOpen: false, stopTarget: null, y: car.y });
    transit._show(tram, true);
    transit._pose(tram, 0);
    transitBodies.update([tram], g.focus, 1 / 60);
    const sections = transitBodies.sections.size;
    let peak = 0, braked = false, firstMovement = Infinity;
    for (let i = 0; i < 120; i++) {
      transit.update(1 / 60, g.focus, [car], true);
      transitBodies.update([tram], g.focus, 1 / 60);
      physics.engine.Step(1 / 60, 1);
      g.trafficBodies.read(g);
      const speed = Math.hypot(car.vx, car.vz);
      peak = Math.max(peak, speed);
      if (speed > 1) firstMovement = Math.min(firstMovement, i);
      if (i < firstMovement && tram.v < 10.9) braked = true;
    }
    const distance = Math.hypot(car.x - p.x, car.z - p.z);
    // Skok v jízdním řádu přemístí těleso bez průjezdu celou vynechanou ulicí.
    const mesh = tram.meshes[0], oldId = transitBodies.sections.get(mesh).body.GetID().GetIndexAndSequenceNumber();
    mesh.position.x += 30;
    transitBodies.update([tram], g.focus, 1 / 60);
    const body = transitBodies.sections.get(mesh).body;
    const reset = body.GetID().GetIndexAndSequenceNumber() !== oldId && body.GetLinearVelocity().Length() < 0.1;
    transitBodies.update([], g.focus, 1 / 60);
    return { sections, expected: tram.sections.length, reset, removed: !transitBodies.sections.size,
      peak, distance, braked, advance: tram.s - start };
  });
  expect(result.sections).toBe(result.expected);
  expect(result.sections).toBeGreaterThan(1);
  expect(result.braked, JSON.stringify(result)).toBe(true);
  expect(result.peak).toBeGreaterThan(2);
  expect(result.distance).toBeGreaterThan(2);
  expect(result.advance).toBeGreaterThan(5);
  expect(result.removed && result.reset).toBe(true);
});

test('E20 – fyzikální auto odbočí z Kardinála Berana do Husovy a pokračuje svým pruhem', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, car = g.player.lastCar;
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    const edge = 36764, next = 34497;
    const p = w.edgePoint(edge, w.eLen[edge] - 15, 0, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    const lane = w.r.w[w.eRoad[next]] / 4;
    Object.assign(car, { mode: 'ai', edge, s: w.eLen[edge] - 15, lane: 0, next, nextLane: lane,
      turnSlow: 3.8, speed: 5, vx: 5 * p.tx, vz: 5 * p.tz });
    g.player.place(car.x - 8, car.z);
    for (let i = 0; i < 25; i++) g.colliders.update(car.x, car.z);
    g.trafficBodies.update(g, 1 / 60);
    let outside = -Infinity;
    for (let tick = 0; tick < 900; tick++) {
      w.traffic.tick(1 / 60);
      g.physics.step(1 / 60);
      const r = w.nearestRoad(car.x, car.z, 15, 13, 0, {}, car.y);
      outside = Math.max(outside, r ? r.dist - w.r.w[r.road] / 2 : 15);
      if (car.edge === next && car.s > 12) break;
    }
    return { edge: car.edge, next, distance: car.s, outside };
  });
  expect(result.edge, JSON.stringify(result)).toBe(result.next);
  expect(result.distance).toBeGreaterThan(12);
  expect(result.outside).toBeLessThanOrEqual(0);
});

test('E20 – náraz do jedoucího auta provozu změní rychlost obou aut', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, car = g.player.lastCar;
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    const edge = 36764;
    const put = (c, distance, speed) => {
      const p = w.edgePoint(edge, distance, 0, {});
      c.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(c, { speed, vx: p.tx * speed, vz: p.tz * speed });
    };
    const lead = g.vehicles.add(new car.constructor('sedan', 0x888888));
    put(lead, 40, 5);
    Object.assign(lead, { mode: 'ai', edge, s: 40, lane: 0 });
    g.vehicles._pickNext(lead);
    put(car, 28, 22);
    g._enterCar(car);
    g.vehicles.spawnTimer = Infinity;
    for (let i = 0; i < 25; i++) g.colliders.update(car.x, car.z);
    let contact;
    for (let i = 0; i < 120; i++) {
      const before = [car.speed, lead.speed];
      g.update(1 / 60);
      if (lead.crashed && !contact) {
        contact = { before, after: [car.speed, lead.speed], mode: lead.mode, health: [car.health, lead.health] };
        break;
      }
    }
    return contact;
  });
  expect(result).toBeTruthy();
  expect(result.before[1]).toBeGreaterThan(2);
  expect(result.before[0] - result.after[0]).toBeGreaterThan(2);
  expect(result.after[1] - result.before[1]).toBeGreaterThan(2);
  expect(result.mode).toBe('loose');
  expect(Math.max(...result.health)).toBeLessThan(100);
});

test('E20 – hra odklidí stojící cizí vrak až po minutě mimo záběr a zachová oba hráčovy vozy', async ({ page }) => {
  await start(page);
  const states = await page.evaluate(() => {
    const g = __game, vm = g.vehicles, last = g.player.lastCar;
    for (const c of [...vm.cars]) if (c !== last) vm.remove(c);
    const create = (x) => {
      const car = vm.add(new last.constructor('sedan', 0x888888));
      car.place(x, 52, 0);
      car.health = 0;
      car.crashed = true;
      return car;
    };
    const wreck = create(-30), owned = create(-20);
    g.garage.active = owned;
    last.crashed = true;
    vm.spawnTimer = Infinity;
    const tick = () => vm.update(1 / 30, g.player, g.camInfo, []);
    const view = (target) => {
      g.camera.position.set(-30, wreck.y + 3, 65);
      g.camera.lookAt(-30, wreck.y + 1, target);
    };
    view(85);
    for (let i = 0; i < 1799; i++) tick();
    const before = vm.cars.includes(wreck);
    view(52);
    for (let i = 0; i < 90; i++) tick();
    const visible = vm.cars.includes(wreck);
    view(85);
    tick();
    return { before, visible, cleared: !vm.cars.includes(wreck), last: vm.cars.includes(last), garage: vm.cars.includes(owned) };
  });
  expect(states).toEqual({ before: true, visible: true, cleared: true, last: true, garage: true });
});
