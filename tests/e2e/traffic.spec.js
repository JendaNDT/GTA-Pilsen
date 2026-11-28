import { waitForGame } from './ready.js';
import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function boot(page, options = '') {
  await page.goto(gameUrl(`/?debug&view=620&shadows=0${options}`));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
}

test('E04 – stopka na Doudlevecké a směrová pravidla v navigaci', async ({ page }, info) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, t = w.traffic;
    const control = t.controls.find((c) => c.kind === 'stop' && c.id === 11969048194 && c.mark === 4248);
    const car = g.player.lastCar;
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    g.vehicles.obstacles.length = 0;
    const { edge, s } = control;
    const position = {};
    const start = s - 17, lane = w.r.w[control.road] / 4;
    w.edgePoint(edge, start, lane, position);
    car.place(position.x, position.z, Math.atan2(position.tx, position.tz));
    Object.assign(car, { edge, s: start, lane, speed: 8, temper: 1, dead: false });
    g.vehicles._pickNext(car);
    let stopped = 0, stopFront = null, passed = false;
    for (let tick = 0; tick < 1500; tick++) {
      t.tick(1 / 60);
      g.vehicles.stepAI(car, 1 / 60);
      if (car.speed < 0.04 && car.edge === edge) {
        stopped += 1 / 60;
        stopFront = s - car.s - car.halfLen;
      }
      if (car.edge !== edge || car.s > s + 2) { passed = true; break; }
    }

    // Přímo u čáry stojí jiné auto, které vyčkává po dřívějším příjezdu z vedlejší.
    const n = w.eTo[edge], nx = w.nodeX[n], nz = w.nodeZ[n];
    const major = { x: nx + 12 * control.tz, z: nz - 12 * control.tx,
      vx: -7 * control.tz, vz: 7 * control.tx, y: car.y, edge: -1 };
    car.edge = edge; car.speed = 0; car.trafficStop = { rule: control, ready: 1, held: 1 };
    const waitsForPriority = t.drivingRule(car, control, 0, 1 / 60, 2, [major]) === 0;
    const proceedsAfterPriority = t.drivingRule(car, control, 0, 1 / 60, 2, []) === 2;

    const rokycany = w.meta.traffic.signs.find((s) => s.id === 30043956 && s.kind === 'oneway');
    const dobriv = w.meta.traffic.signs.find((s) => s.id === 182070668 && s.kind === 'oneway');
    const enforced = [rokycany, dobriv].map((sign) => {
      const e = w.eRoad.indexOf(sign.road);
      const [from, to] = [w.eFrom[e], w.eTo[e]];
      const reversePath = w.findPath(to, from);
      return w.reverseEdge(e) === -1 && w.findPath(from, to)?.includes(e) && !reversePath?.includes(e);
    });

    const forbidden = [...w.turns.direct].find(([incoming, rules]) => {
      const rule = rules.find((r) => !r.only);
      return rule && [...rule.targets].some((e) => w.eRoad[e] !== w.eRoad[incoming]);
    });
    const [incoming, rules] = forbidden;
    const outgoing = [...rules.find((r) => !r.only).targets][0];
    const arrivedAt = w.eTo[incoming], goal = w.eTo[outgoing];
    const route = w.findPath(arrivedAt, goal, 14000, incoming);
    const obeysTurn = w.turnContext(incoming, outgoing) < 0 && route?.[0] !== outgoing;
    const closedStreet = w.meta.traffic.signs.find((s) => s.id === 4546393962 && s.kind === 'closed');
    const closedEntry = closedStreet && w.roadNames[w.r.name[closedStreet.road]];
    const forbiddenForCars = !w.nearestRoad(15759.16, 517.2, 1.1, 13);
    const speedSigns = w.meta.traffic.signs.filter((s) => s.kind === 'speed' && s.source === 'osm');
    const thirty = speedSigns.find((s) => s.speed === 30), fifty = speedSigns.find((s) => s.speed === 50);
    const displayed = [thirty, fifty].map((sign) => w.roadSpeed(sign.road, sign.direction === 1));
    return { stopped, stopFront, passed, waitsForPriority, proceedsAfterPriority, enforced, obeysTurn,
      closedEntry, forbiddenForCars, displayed };
  });
  await info.attach('stopka, přednost a směry', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.stopped).toBeGreaterThanOrEqual(0.6);
  expect(result.stopFront).toBeGreaterThan(0.35);
  expect(result.stopFront).toBeLessThan(1.2);
  expect(result.passed && result.waitsForPriority && result.proceedsAfterPriority).toBe(true);
  expect(result.enforced).toEqual([true, true]);
  expect(result.obeysTurn).toBe(true);
  expect(result.closedEntry).toBe('náměstí Josefa Urbana');
  expect(result.forbiddenForCars).toBe(true);
  expect(result.displayed).toEqual([30, 50]);
  for (const speed of [30, 50]) {
    await page.evaluate((speed) => {
      const g = __game, w = g.world, car = g.player.lastCar;
      const sign = w.meta.traffic.signs.find((sign) => sign.source === 'osm' && sign.kind === 'speed' && sign.speed === speed);
      const direction = sign.direction > 0;
      const edge = w.eRoad.findIndex((r, e) => r === sign.road && (w.eA[e] < w.eB[e]) === direction && w.eLen[e] > 8);
      const p = {};
      w.edgePoint(edge, w.eLen[edge] / 2, 0, p);
      car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      if (g.mode !== 'car') g._enterCar(car);
      g.placeTimer = 0;
      g._updateHud(0);
    }, speed);
    await expect(page.locator('#speedlimit')).toBeVisible();
    await expect(page.locator('#speedlimit')).toHaveText(String(speed));
  }
});

test('E04 – sdílené fáze pro chodce, auta a MHD', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  // V pondělí v 7.30 podle jízdního řádu jedou oba sledované spoje.
  await boot(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, t = w.traffic;
    const head = t.controls.find((c) => c.kind === 'signal' && c.id === 3073913683);
    const group = head.group, cross = group.crossings[0];
    const phaseTime = (group, value) => {
      for (let time = 0; time < 200; time += 0.25) if (t.phase(group, time) === value) return time;
      throw new Error(`Chybí fáze ${value} na křižovatce ${group.id}.`);
    };
    const green = phaseTime(group, 'green' + head.axis);
    const pedestrian = g.peds.spawnAt(...cross.a, 0);
    pedestrian.speed = 1.3;
    pedestrian.crossing = { crossing: cross, from: cross.a, to: cross.b, s: 0 };
    pedestrian.state = 'crossWait';
    g.player.place(...cross.a);
    g.peds.timer = 999;
    t.time = green;
    for (let i = 0; i < 80; i++) g.peds.update(1 / 60, g.player, null, []);
    const waited = pedestrian.state === 'crossWait' && Math.hypot(pedestrian.x - cross.a[0], pedestrian.z - cross.a[1]) < 0.01;
    t.time = phaseTime(group, 'walk');
    for (let i = 0; i < 130; i++) g.peds.update(1 / 60, g.player, null, []);
    const greenWalk = pedestrian.state === 'crossing' && t.users.has(pedestrian);
    t.time = green;
    const allRedWhileCrossing = t.controls.filter((c) => c.group === group).every((c) => t.light(c) === 'red');
    const ahead = { x: cross.x - cross.dz * 8, z: cross.z + cross.dx * 8 };
    const turn = { x: cross.x + cross.dz * 6, z: cross.z - cross.dx * 6 };
    const mustYieldOnTurn = Number.isFinite(t.pedestrianDistance(ahead.x + cross.dx * 7, ahead.z + cross.dz * 7, ahead, turn));
    const until = Math.ceil(cross.length / pedestrian.speed * 60) + 20;
    for (let i = 0; i < until && pedestrian.crossing; i++) g.peds.update(1 / 60, g.player, null, []);
    const completed = !pedestrian.crossing && !t.users.has(pedestrian)
      && Math.hypot(pedestrian.x - cross.b[0], pedestrian.z - cross.b[1]) < 0.05 && t.light(head) === 'green';

    // Trolejbus linky 10 na Americké a tramvaj linky 4 na Klatovské.
    const transit = [];
    const vehicles = g.transit.vehicles;
    const samples = [['trolleybus', '10', 'Tylova', 283.8], ['tram', '4', 'Univerzita', 3532]];
    for (const [type, ref, from, start] of samples) {
      const v = vehicles.find((v) => v.route.type === type && v.route.ref === ref && v.route.from === from);
      v.route.posAt(start, v.side, ahead);
      const signal = t.controlAhead(ahead.x, ahead.z, ahead.tx, ahead.tz, 30);
      if (!signal || signal.control.kind !== 'signal') throw new Error(`Pilotní návěstidlo pro ${type} chybí.`);
      const target = start + signal.distance;
      const redTime = phaseTime(signal.control.group, 'red');
      const greenTime = phaseTime(signal.control.group, 'green' + signal.control.axis);
      g.transit.vehicles = [v];
      Object.assign(v, { s: start, v: 5, wait: 0, doorsOpen: false, stopTarget: null });
      const observer = { x: ahead.x, z: ahead.z };
      t.time = redTime;
      for (let i = 0; i < 650; i++) g.transit.update(1 / 60, observer, [], false);
      const redS = v.s, redSpeed = v.v;
      t.time = greenTime;
      for (let i = 0; i < 360; i++) g.transit.update(1 / 60, observer, [], false);
      transit.push({ type, ref, target, redS, redSpeed, greenS: v.s });
    }
    g.transit.vehicles = vehicles;
    for (let i = 0; i < 4; i++) g.chunks.update(group.x, group.z, 620, 100);
    __view(group.x + 20, w.heightAt(group.x, group.z) + 15, group.z + 25, group.x, w.heightAt(group.x, group.z), group.z);
    return { waited, greenWalk, allRedWhileCrossing, completed, mustYieldOnTurn, transit };
  });
  await info.attach('cyklus, přechod a MHD', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.waited && result.greenWalk && result.allRedWhileCrossing && result.completed).toBe(true);
  expect(result.mustYieldOnTurn).toBe(true);
  for (const vehicle of result.transit) {
    expect(vehicle.redSpeed, vehicle.type).toBeLessThan(0.02);
    expect(vehicle.redS, vehicle.type).toBeLessThan(vehicle.target + 0.8);
    expect(vehicle.greenS, vehicle.type).toBeGreaterThan(vehicle.redS + 4);
  }
  expect(errors).toEqual([]);
});

test('E07 – kolona na Tylově nechá volný přechod a tramvajové koleje', async ({ page }, info) => {
  await boot(page, '&date=2026-11-09&hour=7.5');
  const result = await page.evaluate(() => {
    const game = __game, world = game.world, traffic = world.traffic, vehicles = game.vehicles;
    const signal = traffic.controls.find((head) => head.kind === 'signal' && head.id === 10274015039);
    const group = signal.group;
    const splitCrossing = [3073913687, 3073913690].map(id => traffic.crossings.find(c => c.id === id));
    const phaseTime = (phase) => {
      for (let time = 0; time < 200; time += 0.25) if (traffic.phase(group, time) === phase) return time;
      throw new Error(`Chybí fáze ${phase}.`);
    };
    const roadName = (edge) => world.roadNames[world.r.name[world.eRoad[edge]]];
    const exits = (edge) => {
      const node = world.eTo[edge];
      return Array.from(world.outEdges.slice(world.outStart[node], world.outStart[node + 1]));
    };
    const connector = exits(signal.edge).find((edge) => edge !== world.reverseEdge(signal.edge) && roadName(edge) === 'Americká');
    const secondConnector = exits(connector).find((edge) => edge !== world.reverseEdge(connector) && roadName(edge) === 'Americká');
    const exit = exits(secondConnector).find((edge) => roadName(edge) === 'Tylova');
    const car = game.player.lastCar;
    for (const other of [...vehicles.cars]) if (other !== car) vehicles.remove(other);
    vehicles.obstacles.length = 0;
    const lane = world.r.w[signal.road] / 4, start = signal.s - 18;
    const position = {};
    world.edgePoint(signal.edge, start, lane, position);
    car.place(position.x, position.z, Math.atan2(position.tx, position.tz));
    Object.assign(car, { edge: signal.edge, s: start, lane, speed: 8, next: connector,
      nextLane: world.r.w[world.eRoad[connector]] / 4, turnSlow: 6, temper: 1 });
    const green = phaseTime(`green${signal.axis}`), dt = 1 / 60;
    const random = Math.random;
    traffic.time = green;
    try {
      Math.random = () => 0;
      vehicles.stepAI(car, dt);
    } finally {
      Math.random = random;
    }
    const exitMove = car.exitPlan.find((move) => move.to === exit);
    if (!exitMove) throw new Error('Autu chybí plán průjezdu do Tylovy.');
    const blocker = vehicles.add(new car.constructor(car.typeId, 0x6e4640));
    world.edgePoint(exit, 12, exitMove.lane, position);
    blocker.place(position.x, position.z, Math.atan2(position.tx, position.tz));

    const stepCar = (ticks) => {
      for (let i = 0; i < ticks; i++) vehicles.stepAI(car, dt);
    };
    stepCar(850);
    const stop = { s: car.s, speed: car.speed, edge: car.edge, beforeLine: signal.s - car.s - car.halfLen };

    // Na příčnou zelenou projede existující tramvaj linky 4 po Klatovské.
    const tram = game.transit.vehicles.find((vehicle) => vehicle.route.type === 'tram' &&
      vehicle.route.ref === '4' && vehicle.route.from === 'Univerzita');
    // Vzdálenost po kolejích v bodě, kde trať protíná spojky Americké a Tylovy.
    const tramLine = 3463.13, tramStart = tramLine - 14;
    tram.route.posAt(tramStart, tram.side, position);
    traffic.time = phaseTime(`green${1 - signal.axis}`);
    game.transit.vehicles = [tram];
    Object.assign(tram, { s: tramStart, v: 5, wait: 0, doorsOpen: false, stopTarget: null });
    const observer = { ...position };
    for (let i = 0; i < 480; i++) game.transit.update(dt, observer, vehicles.cars, false);

    vehicles.remove(blocker);
    stepCar(90);
    const heldOnRed = car.edge === signal.edge && Math.abs(car.s - stop.s) < 0.05;
    traffic.time = green;
    stepCar(480);
    return { stop, approach: signal.edge, connectorLength: world.eLen[connector], heldOnRed,
      sharedCrossingPhase: splitCrossing.every(c => c?.group === group),
      tramCrosses: tram.s - tram.len > tramLine,
      clearsAfterGreen: car.edge !== signal.edge || car.s > signal.s + 3 };
  });
  await info.attach('kolona, tramvaj a rozjezd', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.connectorLength).toBeLessThan(8);
  expect(result.stop.edge).toBe(result.approach);
  expect(result.stop.speed).toBeLessThan(0.01);
  expect(result.stop.beforeLine).toBeGreaterThan(0.35);
  expect(result.stop.beforeLine).toBeLessThan(1);
  expect(result.heldOnRed).toBe(true);
  expect(result.sharedCrossingPhase).toBe(true);
  expect(result.tramCrosses).toBe(true);
  expect(result.clearsAfterGreen).toBe(true);
});

test('E07 – stejný směr Klatovské má jiný provoz ve špičce a o víkendu', async ({ page, baseURL }, info) => {
  await page.clock.setFixedTime(new Date('2026-11-09T08:00:00Z'));
  const remote = [];
  const local = new URL(baseURL).origin;
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (new URL(url).origin === local) return route.continue();
    remote.push(url);
    return route.abort();
  });
  await boot(page, '&quality=high&adapt=0');
  const result = await page.evaluate(() => {
    const game = __game, w = game.world, t = w.traffic, vm = game.vehicles;
    const measured = [...game.trafficRhythm.measured];
    const city = measured.filter(([, { curve }]) => curve.id.startsWith('plzen-'));
    const cityProfiles = new Set(city.map(([, { curve }]) => curve.id));
    const cityStreets = new Set(city.map(([edge]) => w.roadNames[w.r.name[w.eRoad[edge]]]));
    const [edge] = measured.find(([, { curve, distance }]) => curve.id === 'klatovska-jih' && distance === 0);
    const point = w.edgePoint(edge, 58, 0, {});
    const focus = { x: point.x - point.tz * 8, z: point.z + point.tx * 8, y: w.groundY(point.x, point.z) };
    const camera = { ...focus, fx: point.tx, fz: point.tz };
    const dt = 1 / 30;
    const samples = [];
    const random = Math.random;
    try {
      for (const [day, hour] of [['2026-11-09', 7.5], ['2026-11-09', 12.5], ['2026-11-09', 16.5],
        ['2026-11-09', 21.5], ['2026-11-14', 7.5]]) {
        game.setClock(day, hour);
        const runs = [];
        const weight = game.trafficRhythm.carWeight(edge, game.clock);
        for (let seed of [2026, 2049, 57, 1290]) {
          for (const car of [...vm.cars]) vm.remove(car);
          vm.obstacles.length = 0;
          vm.spawnTimer = 0;
          t.time = 0;
          t.users.clear();
          Math.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / (2 ** 32));
          const crossed = new Set(), positions = new Map();
          let population = 0;
          for (let tick = 0; tick < 10_800; tick++) {
            t.tick(dt);
            vm.update(dt, focus, camera, []);
            if (tick < 900) continue;
            for (const car of vm.cars) {
              if (car.mode !== 'ai') continue;
              const dx = car.x - point.x, dz = car.z - point.z;
              const along = dx * point.tx + dz * point.tz;
              if (positions.get(car) < 0 && along >= 0 && Math.abs(dx * point.tz - dz * point.tx) < 6) crossed.add(car);
              positions.set(car, along);
              population++;
            }
          }
          runs.push({ passed: crossed.size, population: +(population / 9900).toFixed(1) });
        }
        samples.push({ day, hour, weight, runs });
      }
    } finally {
      Math.random = random;
    }
    game.setClock('2026-11-09', 4.5);
    const before = game.trafficRhythm.carWeight(edge, game.clock);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN' }));
    window.__step(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyN' }));
    return { cityProfiles: cityProfiles.size, cityStreets: [...cityStreets], samples,
      timeJump: { hour: game.hour, before, after: game.trafficRhythm.carWeight(edge, game.clock) } };
  });
  await info.attach('porovnání intenzity na Klatovské', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  const [morning, noon, afternoon, evening, saturday] = result.samples;
  const passed = (sample) => sample.runs.reduce((sum, run) => sum + run.passed, 0);
  expect(remote).toEqual([]);
  expect(result.cityProfiles).toBeGreaterThanOrEqual(250);
  expect(result.cityStreets).toEqual(expect.arrayContaining(['Karlovarská', 'Nepomucká', 'Domažlická', 'Rokycanská']));
  expect(noon.weight).toBeLessThan(afternoon.weight);
  expect(morning.weight).toBeGreaterThan(afternoon.weight);
  expect(evening.weight).toBeLessThan(noon.weight);
  expect(saturday.weight).toBeLessThan(morning.weight / 2);
  expect(passed(morning)).toBeGreaterThan(Math.max(passed(evening), passed(saturday)));
  expect(morning.runs.every((run, i) => run.population > saturday.runs[i].population * 2)).toBe(true);
  expect(result.timeJump.hour).toBeCloseTo(7.5, 2);
  expect(result.timeJump.after).toBeGreaterThan(result.timeJump.before * 2);
});

test('E20 – po vjezdu na zelenou auto uvolní Klatovskou přes značku uvnitř křižovatky', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, t = w.traffic, vm = g.vehicles;
    const car = g.player.lastCar;
    for (const other of [...vm.cars]) if (other !== car) vm.remove(other);
    vm.obstacles.length = 0;
    const signal = t.controls.find(c => c.id === 10274015040 && c.directedHead);
    const sign = t.controls.find(c => c.id === 23586 && c.kind === 'stop');
    const lane = vm._laneFor(signal.edge, 1), s = signal.s - 15;
    const p = w.edgePoint(signal.edge, s, lane, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    Object.assign(car, { mode: 'ai', edge: signal.edge, s, lane, speed: 4, temper: 1 });
    car.exitPlan.push({ from: signal.edge, to: sign.edge, lane: vm._laneFor(sign.edge, 1), slow: 99 });
    vm._pickNext(car);
    let green = 0;
    while (t.phase(signal.group, green) !== 'green' + signal.axis) green += 0.25;
    t.time = green;
    let slowest = Infinity, cleared = false;
    for (let tick = 0; tick < 900; tick++) {
      vm.stepAI(car, 1 / 60);
      if (car.edge !== sign.edge) continue;
      if (car.s < sign.s + 2) slowest = Math.min(slowest, car.speed);
      if (car.s > sign.s + 10) { cleared = true; break; }
    }
    return { cleared, slowest, entry: car.enteredSignal?.id,
      separateStop: t.passedEntry(car, t.controls.find(c => c.id === 11969048194)) === true };
  });
  expect(result.entry).toBe(10274015040);
  expect(result.separateStop).toBe(false);
  expect(result.cleared).toBe(true);
  expect(result.slowest).toBeGreaterThan(1);
});

for (const side of [1, -1]) test('E20 – protější fronty v Husově odbočí vlevo z obou stran, plánovaný pruh ' + (side > 0 ? 'vnější' : 'vnitřní'), async ({ page }) => {
  await boot(page);
  const results = await page.evaluate(side => {
    const g = __game, w = g.world, vm = g.vehicles, Car = g.player.lastCar.constructor;
    for (const car of [...vm.cars]) vm.remove(car);
    vm.obstacles.length = 0;
    const place = (edge, s, exits) => {
      const car = vm.add(new Car('sedan', 0x838383)), lane = vm._laneFor(edge, 1);
      const p = w.edgePoint(edge, s, lane, {});
      car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(car, { mode: 'ai', edge, s, lane, temper: 1 });
      for (const to of exits) {
        car.exitPlan.push({ from: edge, to, lane: vm._laneFor(to, to === 19355 || to === 12147 ? side : 1), slow: to === 19355 || to === 12147 ? 4 : 8 });
        edge = to;
      }
      vm._pickNext(car);
      return car;
    };
    const entries = [
      [1423, 6, [1421, 12147]], [1420, 5.8, [1422, 19355]],
      [34501, w.eLen[34501] - 1, [1423, 1421, 12147]],
      [11884, w.eLen[11884] - 1, [1420, 1422, 34502]],
    ];
    const cars = entries.map(([edge, s, exits]) => place(edge, s, exits));
    // V pozorované frontě už oba páry přejely svou vstupní čáru na zelenou.
    for (const [i, car] of cars.entries()) {
      const id = i % 2 === 0 ? 10274015046 : 10274015045;
      w.traffic.enterJunction(car, w.traffic.controls.find(c => c.id === id && c.directedHead));
    }
    const passed = cars.map(() => false);
    for (let tick = 0; tick < 30 * 60; tick++) {
      w.traffic.tick(1 / 60);
      for (const [i, car] of cars.entries()) {
        vm.stepAI(car, 1 / 60);
        passed[i] ||= car.edge === entries[i][2].at(-1) && car.s > 10;
      }
      if (passed.every(Boolean)) break;
    }
    return passed;
  }, side);
  expect(results).toEqual([true, true, true, true]);
});

test('E20 – dvě protijedoucí auta odbočí z Americké vlevo bez dotyku', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const { world, vehicles, player } = __game, Car = player.lastCar.constructor;
    for (const car of [...vehicles.cars]) vehicles.remove(car);
    vehicles.obstacles.length = 0;
    const place = (edge, s, next, exit) => {
      const car = vehicles.add(new Car('taxi', 0xeeaa22)), lane = vehicles._laneFor(edge, 1);
      const p = world.edgePoint(edge, s, lane, {});
      car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(car, { mode: 'ai', edge, s, lane, temper: 1 });
      car.exitPlan.push({ from: edge, to: next, lane: vehicles._laneFor(next, -1), slow: 4 },
        { from: next, to: exit, lane: vehicles._laneFor(exit, 1), slow: 8 });
      vehicles._pickNext(car);
      return car;
    };
    const a = place(27738, 149, 56972, 976), b = place(56968, 6.6, 56970, 975);
    const gap = angle => {
      const extent = c => c.halfLen * Math.abs(Math.cos(c.yaw - angle)) +
        c.type.wid / 2 * Math.abs(Math.sin(c.yaw - angle));
      return Math.abs((b.x - a.x) * Math.sin(angle) + (b.z - a.z) * Math.cos(angle)) - extent(a) - extent(b);
    };
    let first = false, second = false, closest = Infinity;
    for (let i = 0; i < 30 * 60; i++) {
      world.traffic.tick(1 / 60);
      vehicles.stepAI(a, 1 / 60);
      vehicles.stepAI(b, 1 / 60);
      closest = Math.min(closest, Math.max(gap(a.yaw), gap(a.yaw + Math.PI / 2),
        gap(b.yaw), gap(b.yaw + Math.PI / 2)));
      first ||= a.edge === 56972 && a.s > 6;
      second ||= b.edge === 56970 && b.s > 6;
      if (first && second) break;
    }
    return { first, second, closest };
  });
  expect(result).toMatchObject({ first: true, second: true });
  expect(result.closest).toBeGreaterThan(0);
});

test('E20 – řidič při volbě výjezdu z Husovy ponechá obsazený sousední pruh volný', async ({ page }) => {
  await boot(page);
  const lanes = await page.evaluate(() => {
    const { world, vehicles, player } = __game, car = player.lastCar;
    for (const other of [...vehicles.cars]) if (other !== car) vehicles.remove(other);
    const edge = 1421, next = 12147;
    const lane = vehicles._laneFor(edge, 1), outer = vehicles._laneFor(next, 1), inner = vehicles._laneFor(next, -1);
    const p = world.edgePoint(edge, 0, lane, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    Object.assign(car, { edge, s: 0, lane, mode: 'ai' });
    const choose = () => {
      car.exitPlan.push({ from: edge, to: next, lane: inner, slow: 4 });
      vehicles._pickNext(car);
      return car.nextLane;
    };
    vehicles.obstacles.length = 0;
    const empty = choose();
    const obstacle = world.edgePoint(next, 7, outer, {});
    vehicles.obstacles.push({ ...obstacle, y: car.y, yaw: Math.atan2(obstacle.tx, obstacle.tz), halfLen: 2.5, radius: 1 });
    return { empty, occupied: choose(), inner, outer };
  });
  expect(lanes.empty).toBe(lanes.outer);
  expect(lanes.occupied).toBe(lanes.inner);
});

test('E20 – protisměr na zelenou vyčká u čáry, dokud dodávka nedokončí levé odbočení přes Husovu', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const { world, vehicles, player } = __game, t = world.traffic, Car = player.lastCar.constructor;
    for (const c of [...vehicles.cars]) vehicles.remove(c);
    vehicles.obstacles.length = 0;
    const west = t.byEdge.get(34501).find(c => c.id === 10274015046);
    const east = t.byEdge.get(11884).find(c => c.id === 10274015045);
    const put = (type, light, exits, gap, speed) => {
      const car = vehicles.add(new Car(type, 0x887766)), lane = vehicles._laneFor(light.edge, 1);
      const s = light.s - car.halfLen - gap;
      const p = world.edgePoint(light.edge, s, lane, {});
      car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(car, { mode: 'ai', edge: light.edge, s, lane, temper: 1, speed });
      let from = light.edge;
      for (const to of exits) {
        car.exitPlan.push({ from, to, lane: vehicles._laneFor(to, to === 12147 || to === 19355 ? -1 : 1), slow: 5 });
        from = to;
      }
      vehicles._pickNext(car);
      return car;
    };
    const van = put('van', west, [1423, 1421, 12147], 4, 4);
    let green = 0;
    while (t.phase(west.group, green) !== 'green' + west.axis) green += 0.25;
    t.time = green;
    for (let i = 0; i < 600 && van.enteredSignal !== west; i++) vehicles.stepAI(van, 1 / 60);
    const entered = van.enteredSignal === west;
    const taxi = put('taxi', east, [1420, 1422, 19355], 0.8, 0);
    let early = false, cleared = false, bothPassed = false;
    for (let i = 0; i < 1800; i++) {
      vehicles.stepAI(van, 1 / 60);
      vehicles.stepAI(taxi, 1 / 60);
      cleared ||= van.edge === 12147 && van.s > van.halfLen + 3;
      if (!cleared && (taxi.edge !== east.edge || taxi.s + taxi.halfLen > east.s)) early = true;
      if (cleared && taxi.edge === 19355 && taxi.s > 8) { bothPassed = true; break; }
    }
    return { entered, bothGreen: t.light(west) === 'green' && t.light(east) === 'green', early, bothPassed };
  });
  expect(result).toEqual({ entered: true, bothGreen: true, early: false, bothPassed: true });
});

test('E20 – řidič ze sadů objede vrak povoleným směrem a před zaplněným výjezdem počká', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const { world, vehicles, player } = __game, Car = player.lastCar.constructor, t = world.traffic;
    vehicles.obstacles.length = 0;
    const run = (crashed, blocked) => {
      for (const car of [...vehicles.cars]) vehicles.remove(car);
      const edge = 28439, signal = t.byEdge.get(edge).find(c => c.id === 3073913700);
      const car = vehicles.add(new Car('suv', 0x334455)), lane = vehicles._laneFor(edge, -1);
      const s = signal.s - car.halfLen - 0.8;
      const p = world.edgePoint(edge, s, lane, {});
      car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(car, { mode: 'ai', edge, s, lane, temper: 1 });
      let from = edge;
      for (const to of [1423, 1421, 12147]) {
        car.exitPlan.push({ from, to, lane: vehicles._laneFor(to, 1), slow: 5 });
        from = to;
      }
      vehicles._pickNext(car);
      const van = vehicles.add(new Car('van', 0x774411));
      van.place(-345.325, 261.951, 2.219);
      van.crashed = crashed;
      const obstructed = t.exitBlocked(car, signal, [van], []);
      if (blocked) {
        const stop = world.edgePoint(edge, world.eLen[edge] - 4, lane, {});
        const second = vehicles.add(new Car('kombi', 0x665544));
        second.place(stop.x, stop.z, Math.atan2(stop.tx, stop.tz));
      }
      t.time = 0;
      while (t.phase(signal.group) !== 'green' + signal.axis) t.tick(0.25);
      let selected = car.next, early = false, cleared = false;
      for (let i = 0; i < 4500 && !cleared; i++) {
        t.tick(1 / 60);
        vehicles.stepAI(car, 1 / 60);
        if (car.edge === edge) selected = car.next;
        else if (blocked || !crashed) early = true;
        cleared = car.edge === 19355 && car.s > car.halfLen;
      }
      return { obstructed, selected, early, cleared };
    };
    return [run(true, false), run(true, true), run(false, false)];
  });
  expect(result[0]).toEqual({ obstructed: true, selected: 19355, early: false, cleared: true });
  for (const waiting of result.slice(1)) {
    expect(waiting).toEqual({ obstructed: true, selected: 1423, early: false, cleared: false });
  }
});

test('E21 – řidič před Husovou zná levé odbočení i za druhou krátkou spojkou', async ({ page }) => {
  await boot(page);
  const observed = await page.evaluate(() => {
    const { vehicles, world, player } = __game;
    const car = player.lastCar;
    const light = world.traffic.byEdge.get(34501).find(control => control.directedHead);
    const lane = vehicles._laneFor(light.edge, 1), s = light.s - car.halfLen - 2;
    const point = world.edgePoint(light.edge, s, lane, {});
    car.place(point.x, point.z, Math.atan2(point.tx, point.tz));
    Object.assign(car, { mode: 'ai', edge: light.edge, lane, s, temper: 1 });
    const first = { from: light.edge, to: 1423, lane: vehicles._laneFor(1423, 1), slow: 6 };
    const middle = { from: 1423, to: 1421, lane: vehicles._laneFor(1421, 1), slow: 6 };
    car.exitPlan.push(first, middle);
    vehicles._pickNext(car);
    const partial = world.traffic.junctionMovement(car, light);
    car.trafficStop = { rule: light, held: 0, ready: Infinity, movement: partial };
    // Vůz již zvolil prostřední spojku. Tady zadáme cíl jeho jediné zbývající volby.
    const choose = vehicles._nextMove.bind(vehicles);
    vehicles._nextMove = (edge, context, lane) => edge === 1421
      ? { from: edge, to: 12147, lane: vehicles._laneFor(12147, 1), slow: 5 }
      : choose(edge, context, lane);
    vehicles.stepAI(car, 1 / 60);
    const movement = car.trafficStop?.movement;
    return { partial: partial.edge, kept: car.exitPlan[0] === middle, exit: movement?.edge, left: movement?.left };
  });
  expect(observed).toEqual({ partial: 1421, kept: true, exit: 12147, left: true });
});

test('E21 – řidič u dlouho stojící MHD počká na zelenou a použije volný výjezd', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const { vehicles, world, transit, player, clock } = __game, t = world.traffic;
    const tramEvent = transit.timetable.events(clock.day).find(event => event.trip.route.type === 'tram');
    const tram = transit.placeAtStop(tramEvent, 0);
    const footprintTime = (seconds, doorsOpen, speed) => {
      tram.doorsOpen = doorsOpen;
      tram.v = speed;
      transit._pose(tram, seconds);
      return tram.footprints[0].stoppedInTraffic;
    };
    const waiting = [footprintTime(75, true, 0), footprintTime(30, false, 0),
      footprintTime(30, false, 0), footprintTime(1, false, 1)];
    const car = player.lastCar;
    for (const other of [...vehicles.cars]) if (other !== car) vehicles.remove(other);
    const rule = t.byEdge.get(28439).find(control => control.id === 3073913700);
    const lane = vehicles._laneFor(rule.edge, 1), s = rule.s - car.halfLen - 0.9;
    const p = world.edgePoint(rule.edge, s, lane, {});
    car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
    Object.assign(car, { mode: 'ai', edge: rule.edge, next: 19355, lane, nextLane: lane, s,
      trafficStop: { rule }, blocked: 60 });
    const section = { x: -362.612, z: 262.264, y: car.y, yaw: 1.448, halfLen: 6, radius: 1.4,
      stoppedInTraffic: 20, vx: 0, vz: 0 };
    vehicles.obstacles.splice(0, vehicles.obstacles.length, section);
    const originalBlocked = t.exitBlocked(car, rule, [], [section]);
    const check = color => {
      const deadline = t.time + 180;
      while (t.time < deadline && t.light(rule) !== color) t.tick(0.25);
      if (t.light(rule) !== color) throw new Error('Semafor nepřešel na očekávanou barvu ' + color);
      car.nextDetourCheck = 0;
      vehicles.stepAI(car, 1 / 60);
      return car.next;
    };
    t.users.clear();
    const exits = [check('green')];
    section.stoppedInTraffic = 75;
    exits.push(check('red'));
    const alternative = world.edgePoint(34502, 4, vehicles._laneFor(34502, 1), {});
    vehicles.obstacles.push({ ...section, x: alternative.x, z: alternative.z, yaw: Math.atan2(alternative.tx, alternative.tz) });
    exits.push(check('green'));
    vehicles.obstacles.pop();
    exits.push(check('green'));
    for (let i = 0; i < 1800 && car.edge !== 34502; i++) {
      t.tick(1 / 60);
      vehicles.stepAI(car, 1 / 60);
    }
    return { waiting, originalBlocked, exits, leftOn: car.edge };
  });
  expect(result).toEqual({ waiting: [0, 30, 60, 0], originalBlocked: true,
    exits: [19355, 19355, 19355, 34502], leftOn: 34502 });
});

test('Klatovská u Tylovy – jižní příjezd a přechod mají společný cyklus křižovatky', async ({ page }) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const t = __game.world.traffic;
    const south = t.byEdge.get(28371)?.find(c => c.directedHead && c.id === 3073913680);
    const north = t.controls.find(c => c.id === 10274015040);
    const east = t.controls.find(c => c.id === 10274015039);
    const crossing = t.crossings.find(c => c.id === 10975);
    if (!south || !crossing) return null;
    const phases = new Set();
    for (let i = 0; i < 120; i++) {
      t.tick(1);
      phases.add([t.light(south), t.light(north), t.light(east), t.canWalk(crossing)].join('/'));
    }
    return { mark: south.mark, together: [north, east, crossing].every(c => c.group === south.group),
      phases: [...phases] };
  });
  expect(result?.mark).toBe(10982);
  expect(result.together).toBe(true);
  expect(result.phases).toEqual(expect.arrayContaining(['green/green/red/false', 'red/red/green/false', 'red/red/red/true']));
  expect(result.phases).not.toContain('green/green/green/false');
});

for (const [title, wait, count, expected] of [
  ['Božkovská – při dlouhé frontě v Železniční zvolí řidič volné odbočení', 64, 1, 29309],
  ['E82 – před dvojicí stojících aut v Železniční řidič zvolí volné odbočení po deseti sekundách', 10, 2, 29309],
  ['E82 – kvůli jedinému stojícímu autu řidič po deseti sekundách směr nemění', 10, 1, 29310],
]) {
  test(title, async ({ page }) => {
    await boot(page);
    const result = await page.evaluate(({ wait, count }) => {
      const { world, vehicles, player } = __game, car = player.lastCar;
      vehicles.obstacles.length = 0;
      for (const other of [...vehicles.cars]) if (car !== other) vehicles.remove(other);
      const edge = 1168, rule = world.traffic.byEdge.get(edge).find(c => c.kind === 'yield');
      const s = rule.s - car.halfLen - 0.8, p = world.edgePoint(edge, s, 0, {});
      car.place(p.x, p.z, Math.atan2(p.tx, p.tz));
      Object.assign(car, { mode: 'ai', edge, s, lane: 0, blocked: wait });
      car.exitPlan = [{ from: edge, to: 29310, lane: vehicles._laneFor(29310), slow: 7 }];
      vehicles._pickNext(car);
      for (let i = 0; i < count; i++) {
        const s = 5 + i * 8, p = world.edgePoint(29310, s, car.nextLane, {});
        vehicles.cars.push({ ...p, mode: 'ai', edge: 29310, s, lane: car.nextLane, y: car.y,
          yaw: Math.atan2(p.tx, p.tz), halfLen: 2.3, radius: 1.07, blocked: 10 });
      }
      car.trafficStop = { rule, ready: 0 };
      const full = world.traffic.exitBlocked(car, rule, vehicles.cars, []);
      vehicles._detourAroundBlockage(car);
      return { full, next: car.next, free: !world.traffic.exitBlocked(car, rule, vehicles.cars, []) };
    }, { wait, count });
    expect(result).toEqual({ full: true, next: expected, free: expected !== 29310 });
  });
}

test('E75 – na zelenou chodec počká na zadní nárazník a po uvolnění zebry vykročí', async ({ page }, info) => {
  await boot(page, '&date=2026-11-09&hour=10&quality=low&adapt=0');
  const result = await page.evaluate(async () => {
    const g = __game, w = g.world, t = w.traffic;
    const c = t.controls.find(head => head.id === 3073913683 && head.kind === 'signal').group.crossings[0];
    for (t.time = 0; t.time < 200 && t.phase(c.group) !== 'walk'; t.time += 0.25) {}
    const green = t.phase(c.group) === 'walk';
    const walker = g.peds.spawnAt(...c.a, Math.atan2(c.dx, c.dz));
    g.player.place(c.a[0] - 18 * c.dx, c.a[1] - 18 * c.dz);
    for (let i = 0; i < 60; i++) {
      g.chunks.update(c.x, c.z, 340, 60, g.player.y);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    g.peds.timer = Infinity;
    walker.state = 'crossWait';
    walker.crossing = { crossing: c, from: c.a, to: c.b, s: 0 };
    g.transit.obstacles.length = 0;
    const car = g.player.lastCar, dx = -c.dz, dz = c.dx;
    const placeCar = tail => car.place(c.x + dx * (car.halfLen + tail), c.z + dz * (car.halfLen + tail), Math.atan2(dx, dz));
    placeCar(0.8);
    car.mode = 'ai';
    car.sync();
    for (let i = 0; i < 90; i++) g.peds.update(1 / 60, g.player, null, [car]);
    const waited = walker.state === 'crossWait' && !t.users.has(walker) &&
      Math.hypot(walker.x - c.a[0], walker.z - c.a[1]) < 0.01;
    document.getElementById('hud').style.display = 'none';
    const y = w.groundY(c.x, c.z, walker.y);
    __view(c.x - c.dx * 9 - dx * 9, y + 6, c.z - c.dz * 9 - dz * 9, c.x, y + 0.5, c.z);
    placeCar(1.7);
    g.peds.update(1 / 60, g.player, null, [car]);
    return { green, waited, entered: walker.state === 'crossing' && t.users.get(walker) === c,
      street: w.roadNames[w.r.name[c.road]], id: c.id };
  });
  await page.screenshot({ path: info.outputPath('zelena.jpg'), quality: 87 });
  expect(result, JSON.stringify(result)).toMatchObject({ green: true, waited: true, entered: true });
});

async function crossingApproach(page, info, weather, speed, gap) {
  await boot(page, `&date=2026-11-09&hour=10&quality=low&adapt=0&weather=${weather}`);
  const result = await page.evaluate(async ({ speed, gap }) => {
    const g = __game, t = g.world.traffic;
    const c = t.crossings.find(crossing => crossing.id === 10975);
    for (t.time = 0; t.time < 200 && t.phase(c.group) !== 'walk'; t.time += 0.25) {}
    const dx = -c.dz, dz = c.dx;
    g.player.place(c.a[0] - 18 * c.dx, c.a[1] - 18 * c.dz);
    for (let i = 0; i < 60; i++) {
      g.chunks.update(c.x, c.z, 340, 60, g.player.y);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const car = g.player.lastCar;
    const walker = g.peds.spawnAt(...c.a, Math.atan2(c.dx, c.dz));
    walker.state = 'crossWait';
    walker.crossing = { crossing: c, from: c.a, to: c.b, s: 0 };
    g.peds.timer = Infinity;
    g.transit.obstacles.length = 0;
    car.mode = 'player';
    const approach = (gap, speed) => {
      const s = gap + car.halfLen + 1.45;
      car.place(c.x - dx * s, c.z - dz * s, Math.atan2(dx, dz));
      car.speed = speed;
      car.vx = dx * speed;
      car.vz = dz * speed;
      car.sync();
      g.peds.update(1 / 60, g.player, null, [car]);
    };
    for (let i = 0; i < 45; i++) approach(gap + (44 - i) * speed / 60, speed);
    const waited = walker.state === 'crossWait' && !t.users.has(walker);
    document.getElementById('hud').style.display = 'none';
    __view(c.x - 18 * c.dx - 5 * dx, walker.y + 9, c.z - 18 * c.dz - 5 * dz,
      c.x - 4 * dx, walker.y, c.z - 4 * dz);
    const crossed = t.users.get(walker) === c;
    approach(gap, 4);
    return { green: t.phase(c.group) === 'walk', waited, crossed, entered: t.users.get(walker) === c };
  }, { speed, gap });
  await page.screenshot({ path: info.outputPath('prijezd.jpg'), quality: 87 });
  return result;
}

test('E76 – chodec na zelenou rozliší rychlé a pomalé auto před zebrou', async ({ page }, info) => {
  const result = await crossingApproach(page, info, 'clear', 15, 8);
  expect(result).toEqual({ green: true, waited: true, crossed: false, entered: true });
});

for (const [weather, surface, waits] of [['clear', 'suchu', false], ['snow', 'sněhu', true]]) {
  test(`E77 – chodec při příjezdu stejného auta na ${surface}`, async ({ page }, info) => {
    const result = await crossingApproach(page, info, weather, 10, 15);
    expect(result).toEqual({ green: true, waited: waits, crossed: !waits, entered: true });
  });
}

async function transitApproach(page, info, scenario, shouldWait = true) {
  await boot(page, '&date=2026-11-09&hour=7.5&quality=low&adapt=0');
  const result = await page.evaluate(async ({ crossingId, trip, end, fast, slow, side }) => {
    const g = __game, t = g.world.traffic, transit = g.transit;
    const c = t.crossings.find(crossing => crossing.id === crossingId);
    const vehicle = transit.vehicles.find(v => trip ? v.event.trip.id === trip :
      v.isTram && v.route.ref === '4' && v.route.from === 'Univerzita');
    for (t.time = 0; t.time < 200 && t.phase(c.group) !== 'walk'; t.time += 0.25) {}
    const walker = g.peds.spawnAt(...c.a, Math.atan2(c.dx, c.dz));
    g.player.place(c.a[0] - 18 * c.dx, c.a[1] - 18 * c.dz);
    for (let i = 0; i < 60; i++) {
      g.chunks.update(c.x, c.z, 340, 60, walker.y);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    walker.state = 'crossWait';
    walker.crossing = { crossing: c, from: c.a, to: c.b, s: 0 };
    g.peds.timer = Infinity;
    vehicle.y = walker.y;
    if (side !== undefined) vehicle.side = side;
    transit._show(vehicle, true);
    const step = (s, speed) => {
      vehicle.s = s;
      vehicle.v = speed;
      transit.obstacles.length = transit.heavy.length = 0;
      transit._pose(vehicle, 1 / 60);
      g.peds.update(1 / 60, g.player, null, []);
    };
    for (let i = 0; i < 60; i++) step(end - (59 - i) * fast / 60, fast);
    const waited = walker.state === 'crossWait' && !t.users.has(walker);
    const crossed = t.users.get(walker) === c;
    document.getElementById('hud').style.display = 'none';
    const { tx, tz } = vehicle.route.posAt(vehicle.s, vehicle.side, {});
    __view(c.x + c.dx * 9 + tx * 8, walker.y + 15, c.z + c.dz * 9 + tz * 8,
      c.x - tx * 9, walker.y, c.z - tz * 9);
    step(vehicle.s, slow);
    return { green: t.phase(c.group) === 'walk', waited, crossed, entered: t.users.get(walker) === c };
  }, scenario);
  await page.screenshot({ path: info.outputPath('prijezd-mhd.jpg'), quality: 87 });
  expect(result).toEqual({ green: true, waited: shouldWait, crossed: !shouldWait, entered: true });
}

test('E78 – chodec na Klatovské vyčká na rozjetou čtyřku a po zpomalení vykročí', async ({ page }, info) => {
  await transitApproach(page, info, { crossingId: 10274015043, end: 3530.75, fast: 10, slow: 4 });
});

test('E79 – na Tylově chodec vyčká na vybočení zádě trolejbusu 49', async ({ page }, info) => {
  await transitApproach(page, info, { crossingId: 3844, trip: '692213', end: 4473.5, fast: 6, slow: 1, side: 2.5 });
});

test('E79 – na Borské chodec vyčká na odbočující autobus 32', async ({ page }, info) => {
  await transitApproach(page, info, { crossingId: 33642, trip: '688666', end: 10376, fast: 6, slow: 1, side: 2.5 });
});

test('E79 – na Tylově může chodec vykročit, když užší stopa trolejbusu mine zebru', async ({ page }, info) => {
  await transitApproach(page, info, { crossingId: 3844, trip: '692213', end: 4473.5, fast: 6, slow: 1, side: 1.7 }, false);
});

test('E79 – na Klatovské běžná stopa autobusu 39 zavede záď nad zebru', async ({ page }) => {
  await boot(page, '&date=2026-11-09&hour=7.5&quality=low&adapt=0');
  const result = await page.evaluate(() => {
    const g = __game, transit = g.transit, t = g.world.traffic;
    const c = t.crossings.find(crossing => crossing.id === 40319);
    const bus = transit.vehicles.find(v => v.event.trip.id === '689189');
    transit.vehicles = [bus];
    const observer = bus.route.posAt(7392, 0, {});
    for (t.time = 0; t.time < 200 && t.phase(c.group) !== 'walk'; t.time += 0.25) {}
    Object.assign(bus, { wait: 0, doorsOpen: false, stopTarget: null });
    let warned = false, firstHit = false, tailAfterWarning = false, cleared = false;
    // Polohu posouvá zkouška, jízdní pruh a natočení vozu vybere běžné řízení linky.
    for (let i = 0; i <= 840; i++) {
      bus.s = 7308 + i / 10;
      bus.v = 6;
      transit.update(1 / 60, observer, [], false);
      if (i < 600) continue;
      const part = bus.footprints[0], person = { y: bus.y };
      const blocked = section => !t.canWalk(c, [], [section], person);
      const hit = blocked({ ...part, brakingDistance: 0 });
      if (!firstHit && !hit && blocked(part)) warned = true;
      if (hit) {
        firstHit = true;
        const third = part.halfLen / 3;
        const front = { ...part, brakingDistance: 0, x: part.x + Math.sin(part.yaw) * third,
          z: part.z + Math.cos(part.yaw) * third, halfLen: part.halfLen - third };
        if (warned && !blocked(front)) tailAfterWarning = true;
      } else if (tailAfterWarning && !blocked(part)) cleared = true;
    }
    return { warned, tailAfterWarning, cleared };
  });
  expect(result).toEqual({ warned: true, tailAfterWarning: true, cleared: true });
});
