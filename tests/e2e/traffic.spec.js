import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function boot(page, options = '') {
  await page.goto(gameUrl(`/?debug&view=620&shadows=0${options}`));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
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
  await boot(page);
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
