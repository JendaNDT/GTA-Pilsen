import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E20 – při odbočení linky 41 z Klatovské do Husovy zůstává dráha v pruhu spojitá', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const jump = await page.evaluate(() => {
    const route = __game.transit.routes.find(r => {
      if (r.ref !== '41') return false;
      const p = r.posAt(4123, 2.5, {});
      return Math.hypot(p.x + 365, p.z - 259) < 5;
    });
    let largest = 0;
    for (const s of route.cum) {
      if (Math.abs(s - 4123) > 10) continue;
      const a = route.posAt(s - 0.01, 2.5, {});
      const b = route.posAt(s + 0.01, 2.5, {});
      largest = Math.max(largest, Math.hypot(a.x - b.x, a.z - b.z));
    }
    return largest;
  });
  expect(jump).toBeGreaterThan(0);
  expect(jump).toBeLessThan(0.05);
});

async function start(page, options = '') {
  await page.goto(gameUrl('/?debug&quality=low' + options));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
}

test('E20 – po vystoupení z převráceného auta zůstane vůz na střeše', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const g = __game, car = g.player.lastCar;
    g._enterCar(car);
    g.update(1 / 60);
    const driver = g.driver;
    driver.quat.Set(0, 0, 1, 0);
    g.physics.bodies.SetRotation(driver.body.GetID(), driver.quat, g.physics.Jolt.EActivation_Activate);
    driver.read();
    g._exitCar();
    g.update(1 / 60);
    return { onFoot: g.mode === 'foot', sameBody: car.physical === driver,
      inverted: Math.cos(car.pitch) * Math.cos(car.roll) < -0.9 };
  });
  expect(result).toEqual({ onFoot: true, sameBody: true, inverted: true });
});

test('E20 – kombi projede kolem odbočující linky 41 na Husově bez střetu', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const g = __game, { world, transit, vehicles } = g;
    const bus = transit.vehicles.find(v => {
      const p = v.route.posAt(4107, 2.5, {});
      return v.route.ref === '41' && Math.hypot(p.x + 360, p.z - 248) < 5;
    });
    const Car = g.player.lastCar.constructor;
    for (const c of [...vehicles.cars]) vehicles.remove(c);
    const edge = 28439, lane = vehicles._laneFor(edge, -1), s = 26.14;
    const p = world.edgePoint(edge, s, lane, {});
    const car = vehicles.add(new Car('kombi', 0x778899));
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    Object.assign(car, { mode: 'ai', edge, s, lane, temper: 1 });
    let from = edge;
    for (const to of [1423, 1421, 12147]) {
      car.exitPlan.push({ from, to, lane: vehicles._laneFor(to, -1), slow: 5 });
      from = to;
    }
    vehicles._pickNext(car);
    // Pozorovatel stojí mimo jízdní pruh linky 41 i mimo křižovatku.
    g.player.place(-380, 242);
    for (let i = 0; i < 25; i++) g.colliders.update(g.player.x, g.player.z);
    g.trafficBodies.selectCars(g);
    const head = world.traffic.controls.find(c => c.id === 3073913700);
    while (world.traffic.light(head) !== 'green') world.traffic.tick(0.1);
    transit.vehicles = [bus];
    transit._show(bus, true);
    bus.followSchedule({ s: 4107, index: bus.stops.findIndex(stop => stop[0] >= 4107), wait: 0 });
    bus.side = bus.lane = 2.5;
    bus.v = 4.1;
    world.traffic.enterJunction(bus, head);
    let closest = Infinity, carPassed = false, busPassed = false;
    for (let i = 0; i < 1800; i++) {
      world.traffic.tick(1 / 60);
      vehicles.obstacles = transit.obstacles;
      g.physics.step(1 / 60);
      const body = bus.footprints[0];
      const gap = axis => {
        const extent = (object, width) => object.halfLen * Math.abs(Math.cos(object.yaw - axis)) +
          width * Math.abs(Math.sin(object.yaw - axis));
        return Math.abs((body.x - car.x) * Math.sin(axis) + (body.z - car.z) * Math.cos(axis)) -
          extent(car, car.type.wid / 2) - extent(body, 1.25);
      };
      closest = Math.min(closest, Math.max(gap(car.yaw), gap(car.yaw + Math.PI / 2),
        gap(body.yaw), gap(body.yaw + Math.PI / 2)));
      carPassed ||= car.edge === 12147 && car.s > 5;
      busPassed ||= bus.s > 4140;
      if (carPassed && busPassed) break;
    }
    return { closest, crashed: !!car.crashed, passed: carPassed && busPassed };
  });
  expect(result, JSON.stringify(result)).toMatchObject({ crashed: false, passed: true });
  expect(result.closest).toBeGreaterThan(0);
});

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
  await start(page, '&date=2026-11-09&hour=7.5');
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

test('E20 – dodávka udrží vozovku při ostrém odbočení na Americkou i na Železniční', async ({ page }) => {
  await start(page);
  const runs = await page.evaluate(() => {
    const g = __game, w = g.world, vm = g.vehicles, Car = g.player.lastCar.constructor;
    for (const other of [...vm.cars]) vm.remove(other);
    const results = [];
    for (const [edge, next] of [[28371, 19522], [28768, 20738]]) {
      const car = vm.add(new Car('van', 0x557799));
      const start = Math.max(0, w.eLen[edge] - 38), lane = w.r.w[w.eRoad[edge]] / 4;
      const p = w.edgePoint(edge, start, lane, {});
      car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(car, { mode: 'ai', edge, s: start, lane, speed: 8, vx: p.tx * 8, vz: p.tz * 8 });
      car.exitPlan.push({ from: edge, to: next, lane: w.r.w[w.eRoad[next]] / 4, slow: 3.8 });
      vm._pickNext(car);
      g.player.place(p.x + p.tz * 12, p.z - p.tx * 12);
      for (let i = 0; i < 25; i++) g.colliders.update(car.x, car.z);
      g.trafficBodies.selectCars(g);
      let departed = false, arrived = false;
      for (let i = 0; i < 90 * 60 && !arrived; i++) {
        w.traffic.tick(1 / 60);
        vm.stepAI(car, 1 / 60, car.physical);
        g.physics.engine.Step(1 / 60, 1);
        car.physical.read();
        departed ||= !w.onCarriageway(car.x, car.z, car.y);
        arrived = car.edge === next && car.s >= 16;
      }
      results.push({ edge, arrived, departed, lastEdge: car.edge, distance: car.s,
        x: car.x, z: car.z, speed: car.speed, targetSpeed: car.physical.input?.targetSpeed,
        rule: car.trafficStop?.rule.id, next: car.next });
      vm.remove(car);
    }
    return results;
  });
  for (const run of runs) {
    expect(run.arrived, JSON.stringify(run)).toBe(true);
    expect(run.departed, JSON.stringify(run)).toBe(false);
  }
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

test('E20 – provoz vybírá průjezdnou ulici a při parkování nechá vozovku volnou', async ({ page }) => {
  await start(page);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, vm = g.vehicles;
    const end = w.edgePoint(990, w.eLen[990], 0, {});
    const through = w.edgePoint(34497, 15, 0, {});
    const samples = [];
    for (let i = 0; i < 1000 && samples.length < 15; i++) {
      const car = vm.spawnParked(through.x, through.z, null);
      if (!car) continue;
      const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
      let overlaps = w.blocksTramTrack(car.x, car.z, car.y, car.yaw, car.type.len, car.type.wid);
      for (const along of [-car.halfLen, 0, car.halfLen]) for (const side of [-1, 1]) {
        const offset = side * car.type.wid / 2;
        overlaps ||= w.onCarriageway(car.x + along * fx + offset * fz, car.z + along * fz - offset * fx, car.y);
      }
      samples.push(overlaps);
    }
    const besideTram = w.blocksTramTrack(-377.7, 361.7, w.heightAt(-377.7, 361.7), 1.3, 4.4, 1.8);
    const onCorner = w.blocksStreetCorner(56968, -153.5, 451, 1.333, 4, 1.8);
    return { through: vm._throughRoad(34497, 0), blind: vm._throughRoad(990, 0), samples, besideTram, onCorner,
      endpoints: [end, through].every(p => w.onCarriageway(p.x, p.z, w.heightAt(p.x, p.z))) };
  });
  expect(result.through && result.endpoints).toBe(true);
  expect(result.blind).toBe(false);
  expect(result.besideTram).toBe(true);
  expect(result.onCorner).toBe(true);
  expect(result.samples).toHaveLength(15);
  expect(result.samples.every(overlap => !overlap)).toBe(true);
});

test('E20 – tramvaj počká se zařazením na trasu, dokud její místo zabírá auto', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const g = __game, t = g.transit, car = g.player.lastCar;
    const tram = t.vehicles.find(v => v.route.ref === '4' && v.route.from === 'Univerzita');
    t._show(tram, false);
    t.vehicles = [tram];
    tram.s = 3430;
    const p = tram.route.posAt(tram.s - tram.halfLen, tram.side, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    t.update(1 / 60, car, [car], false);
    const held = !tram.visible && tram.waitingForSpace;
    t.update(1 / 60, car, [], false);
    return { held, released: tram.visible && !tram.waitingForSpace };
  });
  expect(result).toEqual({ held: true, released: true });
});

test('E20 – protijedoucí trolejbusy 12 a 16 se v Tylově minou ve svých pruzích', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const { transit, world } = __game;
    const observer = { x: -382, z: 365 };
    const approaches = [['16', 'Doubravka', 4840.4], ['12', 'Nová Hospoda', 4980.9]];
    const vehicles = approaches.map(([ref, from, crossing]) => {
      const v = transit.vehicles.find(v => {
        if (v.route.ref !== ref || v.route.from !== from) return false;
        const p = v.route.posAt(crossing, 0, {});
        return Math.hypot(p.x + 382, p.z - 356) < 4;
      });
      Object.assign(v, { s: crossing - 23, v: 5, wait: 0, doorsOpen: false, stopTarget: null });
      return v;
    });
    transit.vehicles = vehicles;
    let closest = Infinity;
    for (let i = 0; i < 110 * 60; i++) {
      world.traffic.tick(1 / 60);
      transit.update(1 / 60, observer, [], false);
      const [a, b] = vehicles;
      closest = Math.min(closest, Math.hypot(a.x - b.x, a.z - b.z));
      if (vehicles.every((v, i) => v.s > approaches[i][2] + 20)) break;
    }
    return { beyond: vehicles.map((v, i) => v.s - approaches[i][2]), closest };
  });
  expect(Math.min(...result.beyond), JSON.stringify(result)).toBeGreaterThan(20);
  expect(result.closest).toBeGreaterThan(2.5);
});

test('E20 – tramvaj 4 na středovém pásu Klatovské zastaví před Americkou', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const { world, transit } = __game, traffic = world.traffic;
    const signal = traffic.controls.find(c => c.id === 10274015040 && c.kind === 'signal');
    const entry = 4697, approach = entry - 18;
    const tram = transit.vehicles.find(v => {
      const p = v.route.posAt(entry, 0, {});
      return v.route.ref === '4' && v.route.from === 'Košutka' && Math.hypot(p.x - signal.x, p.z - signal.z) < 7;
    });
    transit.vehicles = [tram];
    const p = tram.route.posAt(approach, 0, {});
    Object.assign(tram, { s: approach, v: 7, wait: 0, doorsOpen: false, stopTarget: null });
    const run = (phase, ticks) => {
      traffic.time = 0;
      while (traffic.time < 180 && traffic.phase(signal.group) !== phase) traffic.time += 0.25;
      if (traffic.phase(signal.group) !== phase) throw new Error('Semafor před Americkou neukázal ' + phase);
      for (let i = 0; i < ticks; i++) transit.update(1 / 60, p, [], false);
    };
    run('green' + (1 - signal.axis), 600);
    const front = tram.route.posAt(tram.s, 0, {});
    const gap = (signal.x - front.x) * front.tx + (signal.z - front.z) * front.tz;
    const stopped = tram.v < 0.05;
    run('green' + signal.axis, 600);
    return { gap, stopped, advance: tram.s - entry };
  });
  expect(result.stopped).toBe(true);
  expect(result.gap).toBeGreaterThan(0);
  expect(result.gap).toBeLessThan(1);
  expect(result.advance).toBeGreaterThan(12);
});

test('E20 – tramvaj po vjezdu na zelenou uvolní Husovu i při změně světel', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const { transit, world } = __game, traffic = world.traffic;
    const entry = traffic.controls.find(c => c.id === 3073913700 && c.directedHead);
    const tram = transit.vehicles.find(v => v.route.ref === '4' && v.route.from === 'Košutka' &&
      Math.abs(v.route.posAt(4630, 0, {}).z - 275) < 3);
    const approach = 4576;
    const p = tram.route.posAt(approach, 0, {});
    Object.assign(tram, { s: approach, v: 7, wait: 0, doorsOpen: false, stopTarget: null });
    transit.vehicles = [tram];
    const setLight = (axis) => {
      for (let t = 0; t < 180; t += 0.25) {
        if (traffic.phase(entry.group, t) === 'green' + axis) { traffic.time = t; return; }
      }
      throw new Error('Na křižovatce Husovy chybí zelená.');
    };
    const run = (ticks) => {
      for (let i = 0; i < ticks; i++) transit.update(1 / 60, p, [], false);
    };
    setLight(1 - entry.axis);
    run(600);
    const front = tram.route.posAt(tram.s, 0, {});
    const gap = (entry.x - front.x) * front.tx + (entry.z - front.z) * front.tz;
    const stopSpeed = tram.v;
    setLight(entry.axis);
    for (let i = 0; i < 900 && tram.s < 4601; i++) run(1);
    const entered = tram.s >= 4601;
    setLight(1 - entry.axis);
    const crossing = entry.group.crossings.find(c => c.id === 10274015043);
    const pedestrian = {};
    traffic.users.set(pedestrian, crossing);
    run(720);
    const nose = tram.route.posAt(tram.s, 0, {});
    const pedestrianGap = (crossing.x - nose.x) * nose.tx + (crossing.z - nose.z) * nose.tz;
    const pedestrianStop = tram.v;
    traffic.users.delete(pedestrian);
    run(720);
    const rear = tram.route.posAt(tram.s - tram.len, 0, {});
    return { stopSpeed, gap, entered, pedestrianGap, pedestrianStop, rearZ: rear.z };
  });
  expect(result.stopSpeed, JSON.stringify(result)).toBeLessThan(0.01);
  expect(result.gap).toBeGreaterThan(0);
  expect(result.gap).toBeLessThan(1);
  expect(result.entered).toBe(true);
  expect(result.pedestrianStop).toBeLessThan(0.01);
  expect(result.pedestrianGap).toBeGreaterThan(0);
  expect(result.pedestrianGap).toBeLessThan(2);
  // Husova protíná koleje kolem z = 261; i zadní článek musí opustit šířku vozovky.
  expect(result.rearZ).toBeGreaterThan(265);
});

test('E20 – levé odbočení přes protisměr na Klatovské nechá projet auto z Husovy', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, manager = g.vehicles, Car = g.player.lastCar.constructor;
    for (const other of [...manager.cars]) manager.remove(other);
    const place = (edge, s, exits) => {
      const c = manager.add(new Car('sedan', 0x666666)), lane = w.r.w[w.eRoad[edge]] / 4;
      const p = w.edgePoint(edge, s, lane, {});
      c.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(c, { edge, s, lane, mode: 'ai', temper: 1 });
      let from = edge;
      for (const to of exits) {
        c.exitPlan.push({ from, to, lane: w.r.w[w.eRoad[to]] / 4, slow: from === 1422 ? 4 : 8 });
        from = to;
      }
      manager._pickNext(c);
      return c;
    };
    const through = place(34501, 21, [1423, 1421, 12147]);
    const turning = place(1422, 3.5, [19355, 19410]);
    g.player.place(-395, 249);
    for (let i = 0; i < 25; i++) g.colliders.update(through.x, through.z);
    g.trafficBodies.selectCars(g);
    let passed = false, completed = false, waited = false, impact = 0;
    for (let i = 0; i < 18 * 60; i++) {
      w.traffic.tick(1 / 60);
      for (const c of [through, turning]) manager.stepAI(c, 1 / 60, c.physical);
      g.physics.engine.Step(1 / 60, 1);
      for (const c of [through, turning]) {
        c.physical.read();
        impact = Math.max(impact, c.physical.impactSpeed);
      }
      waited ||= through.speed > 1 && turning.edge === 1422 && turning.speed < 0.3;
      passed ||= through.edge === 12147 && through.s > 2;
      completed ||= turning.edge === 19355 && turning.s > 10;
      if (passed && completed) break;
    }
    return { waited, passed, completed, impact };
  });
  expect(result).toEqual({ waited: true, passed: true, completed: true, impact: 0 });
});

test('E20 – dodávka na příčném svahu Železniční udrží pruh při stání i rozjezdu', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const runs = await page.evaluate(() => {
    const g = __game, w = g.world, manager = g.vehicles, Car = g.player.lastCar.constructor;
    for (const other of [...manager.cars]) manager.remove(other);
    const edge = 1181, next = 33897, lane = manager._laneFor(edge, 1);
    const signal = w.traffic.byEdge.get(edge).find(c => c.id === 10132233548);
    const phase = (axis) => {
      for (let t = 0; t < 180; t += 0.25) if (w.traffic.phase(signal.group, t) === 'green' + axis) return t;
      throw new Error('Na Železniční chybí zelená.');
    };
    const red = phase(1 - signal.axis), green = phase(signal.axis), results = [];
    for (const startLane of [lane, lane + 0.825]) {
      const p = w.edgePoint(edge, 0, startLane, {});
      const c = manager.add(new Car('van', 0x727272));
      c.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(c, { edge, lane, s: 0, mode: 'ai', speed: 4, vx: 4 * p.tx, vz: 4 * p.tz, temper: 1 });
      c.exitPlan.push({ from: edge, to: next, lane: manager._laneFor(next, 1), slow: 99 });
      manager._pickNext(c);
      g.player.place(p.x + 15, p.z + 15);
      for (let i = 0; i < 25; i++) g.colliders.update(p.x, p.z);
      g.trafficBodies.selectCars(g);
      let outside = false, held = false, arrived = false;
      for (let tick = 0; tick < 75 * 60 && !arrived; tick++) {
        w.traffic.time = tick < 50 * 60 ? red : green;
        manager.stepAI(c, 1 / 60, c.physical);
        g.physics.engine.Step(1 / 60, 1);
        c.physical.read();
        outside ||= !w.onCarriageway(c.x, c.z, c.y);
        if (tick === 50 * 60 - 1) {
          const gap = signal.s - c.s - c.halfLen;
          held = c.edge === edge && gap > 0 && gap <= 1 && Math.hypot(c.vx, c.vz) < 0.15;
        }
        arrived = c.edge === next && c.s >= 8;
      }
      results.push({ startLane, held, outside, arrived });
      manager.remove(c);
    }
    return results;
  });
  for (const run of runs) expect(run, JSON.stringify(run)).toMatchObject({ held: true, outside: false, arrived: true });
});

test('E20 – v Barrandově se při odbočení do úzké ulice minou sedan, kombi a linka 12', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, vm = g.vehicles, t = g.transit, Car = g.player.lastCar.constructor;
    const bus = t.vehicles.find(v => v.route.ref === '12' && v.route.from === 'Božkov' &&
      Math.hypot(v.route.posAt(3098, 1.5, {}).x - 818.5, v.route.posAt(3098, 1.5, {}).z - 694.6) < 2);
    for (const car of [...vm.cars]) vm.remove(car);
    const place = (type, edge, s, speed, exits) => {
      const car = vm.add(new Car(type, 0x777777)), lane = vm._laneFor(edge, 1);
      const p = w.edgePoint(edge, s, lane, {});
      car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(car, { mode: 'ai', edge, s, lane, speed, vx: speed * p.tx, vz: speed * p.tz, temper: 1 });
      for (const to of exits) {
        car.exitPlan.push({ from: edge, to, lane: vm._laneFor(to, 1), slow: to === 1178 ? 99 : 4 });
        edge = to;
      }
      vm._pickNext(car);
      return car;
    };
    const sedan = place('sedan', 19166, w.eLen[19166] - 14, 6, [1176, 1178]);
    g.player.place(800, 690);
    for (let i = 0; i < 25; i++) g.colliders.update(815, 700);
    g.trafficBodies.selectCars(g);
    // Na hranici fyzikálního okruhu používají auta obě provedení řidiče.
    const kombi = place('kombi', 1177, 13, 2, [1245]);
    t.vehicles = [bus];
    t._show(bus, true);
    bus.followSchedule({ s: 3078, index: 0, wait: 0 });
    bus.side = bus.lane = 1.5;
    bus.v = 3;
    let sedanPassed = false, kombiPassed = false, busPassed = false, closest = Infinity;
    for (let tick = 0; tick < 40 * 60; tick++) {
      w.traffic.tick(1 / 60);
      t.update(1 / 60, g.player, vm.cars, false);
      vm.obstacles = t.obstacles;
      vm.stepAI(sedan, 1 / 60, sedan.physical);
      vm.stepAI(kombi, 1 / 60);
      g.physics.engine.Step(1 / 60, 1);
      sedan.physical.read();
      // Kladná mezera alespoň na jedné z os obou karoserií vylučuje průnik.
      const gap = (angle) => {
        const tx = Math.sin(angle), tz = Math.cos(angle);
        const extent = c => c.halfLen * Math.abs(Math.cos(c.yaw - angle)) +
          c.type.wid / 2 * Math.abs(Math.sin(c.yaw - angle));
        return Math.abs((kombi.x - sedan.x) * tx + (kombi.z - sedan.z) * tz) - extent(sedan) - extent(kombi);
      };
      closest = Math.min(closest, Math.max(gap(sedan.yaw), gap(sedan.yaw + Math.PI / 2),
        gap(kombi.yaw), gap(kombi.yaw + Math.PI / 2)));
      sedanPassed ||= sedan.edge === 1178;
      kombiPassed ||= kombi.edge === 1245 && kombi.s > 10;
      busPassed ||= bus.s > 3120;
      if (sedanPassed && kombiPassed && busPassed) break;
    }
    return { sedanPassed, kombiPassed, busPassed, closest };
  });
  expect(result).toMatchObject({ sedanPassed: true, kombiPassed: true, busPassed: true });
  expect(result.closest).toBeGreaterThan(0);
});

test('E20 – trolejbus 12 respektuje vlastní semafor v Tylově a uvolní výjezd do Americké', async ({ page }) => {
  await start(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const { transit, world } = __game, t = world.traffic;
    const signal = t.controls.find(c => c.id === 10274015037 && c.transitOnly);
    const bus = transit.vehicles.find(v => {
      const p = v.route.posAt(5008, 2, {});
      return v.route.ref === '12' && v.route.from === 'Nová Hospoda' && Math.hypot(p.x + 358, p.z - 366) < 5;
    });
    const p = bus.route.posAt(4955, 1.5, {});
    const light = axis => {
      for (let time = 0; time < 180; time += 0.25) {
        if (t.phase(signal.group, time) === 'green' + axis) { t.time = time; return; }
      }
      throw new Error('V Tylově chybí zelená.');
    };
    transit.vehicles = [bus];
    transit._show(bus, true);
    bus.followSchedule({ s: 4955, index: 0, wait: 0 });
    bus.v = 4;
    const tick = () => transit.update(1 / 60, p, [], false);
    light(1 - signal.axis);
    for (let i = 0; i < 900; i++) tick();
    const nose = bus.route.posAt(bus.s, bus.side, {});
    const gap = (signal.x - nose.x) * nose.tx + (signal.z - nose.z) * nose.tz;
    const stopped = bus.v < 0.01 && gap > 0 && gap < 1;
    light(signal.axis);
    for (let i = 0; i < 600 && bus.enteredSignal !== signal; i++) tick();
    const entered = bus.enteredSignal === signal;
    light(1 - signal.axis);
    for (let i = 0; i < 960; i++) tick();
    return { stopped, entered, rear: bus.s - bus.len, mark: signal.mark, carRule: t.byEdge.get(signal.edge)?.includes(signal) ?? false };
  });
  expect(result).toMatchObject({ stopped: true, entered: true, mark: 3843, carRule: false });
  expect(result.rear).toBeGreaterThan(5009);
});
