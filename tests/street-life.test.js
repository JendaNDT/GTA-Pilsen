import test from 'node:test';
import assert from 'node:assert/strict';
import { berthOffset, canYieldAtPullout, pulloutGap, stopBerth } from '../src/game/bus-departure.js';
import { followParkTrip, parkTrip } from '../src/entities/pedestrian-walks.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { Traffic } = await import('../src/game/traffic.js');
const { passengerMatches, servicePlatform, stepPassenger } = await import('../src/entities/platform-passengers.js');

test('řidič rozliší kolemjdoucího, čekajícího, pozdní příjezd a obsazenou zebru', () => {
  const traffic = Object.assign(Object.create(Traffic.prototype), { users: new Map(), waitingWalkers: new Map() });
  const crossing = { a: [-4, 0], b: [4, 0], x: 0, z: 0, dx: 1, dz: 0, length: 8 };
  const ped = { y: 1, speed: 1.3 }, car = { x: 0, z: -22, y: 1, vx: 0, vz: 9, speed: 9, halfLen: 2, yaw: 0 };
  const stop = () => traffic.pedestrianDistance(0, car.z, { x: 0, z: 10 }, null, car);
  assert.equal(stop(), Infinity);
  traffic.waitingWalkers.set(ped, crossing);
  assert.equal(stop(), 22);
  assert.equal(traffic.canWalk(crossing, [car], [], ped), false);
  car.z = -5;
  assert.equal(stop(), Infinity);
  assert.equal(traffic.canWalk(crossing, [car], [], ped), false);
  car.speed = car.vz = 0;
  assert.equal(traffic.canWalk(crossing, [car], [], ped), true);
  assert.equal(traffic.canWalk(crossing, [car], [{ ...car, z: 15, vz: -8, yaw: Math.PI }], ped), false);
  traffic.users.set(ped, crossing);
  car.speed = 12;
  assert.equal(stop(), 5);
  traffic.leaveCrossing(ped);
  assert.equal(stop(), Infinity);
});

test('procházka dovede chodce na opačný konec cesty a při návratu se lidé minou', () => {
  const trip = parkTrip(151, 297, 1);
  assert.ok(trip);
  const p = { x: trip.x, z: trip.z, speed: 1.5, trip };
  const end = trip.path.at(-1);
  for (let i = 0; !trip.pause && i < 3000; i++) followParkTrip(p, 0.1);
  assert.ok(trip.pause > 0 && Math.hypot(p.x - end[0], p.z - end[1]) < 0.6);
  const path = [[0, 0], [0, 10]];
  const a = { x: 0, z: 0, speed: 1, trip: { path, index: 1, direction: 1 } };
  const b = { x: 0, z: 10, speed: 1, trip: { path, index: 0, direction: -1 } };
  for (let i = 0; i < 50; i++) { followParkTrip(a, 0.1); followParkTrip(b, 0.1); }
  assert.ok(b.x - a.x >= 0.65);
});

test('cestující vybere svůj spoj na správném stanovišti a nastoupí až u dveří', () => {
  const v = { route: { ref: '12', type: 'trolleybus' }, destination: 'Božkov', stopIndex: 0,
    event: { trip: { stops: [{ stop: 7 }] } }, visible: true, doorsOpen: true, passengerCount: 1 };
  const p = { ticket: { ref: '12', kind: 'trolleybus', station: 7, destination: 'Božkov' },
    x: 2, z: 0, speed: 1, service: v, goal: { x: 0, z: 0 }, state: 'board' };
  assert.ok(passengerMatches(p, v));
  assert.ok(!passengerMatches(p, { ...v, destination: 'Nová Hospoda' }));
  stepPassenger(p, 1);
  assert.equal(v.passengerCount, 1);
  stepPassenger(p, 1);
  assert.equal(v.passengerCount, 2);
  assert.equal(p.state, 'aboard');
});

test('výjezd MHD vyžaduje souběžný pruh a bezpečnou mezeru za autobusem', () => {
  const lane = { x: 0, z: 20, tx: 0, tz: 1 };
  const route = { posAt: (s, side) => ({ ...lane, x: -side, z: s }) };
  const service = { route, lane: 1.7, stopIndex: 0, event: { trip: { stops: [{ stop: 0, target: [10, 'Radobyčice'] }] } } };
  const berth = stopBerth(service, { stops: [['Radobyčice', -8, 10, '47081/1']] });
  assert.equal(berthOffset(berth, 10), 3.2);
  assert.equal(berthOffset(berth, 27), 0);
  assert.equal(stopBerth(service, { stops: [['Zastávka v pruhu', -8, 10, 'jiná']] }), null);
  const bus = { x: -3, z: 0, y: 0, halfLen: 6 };
  const car = { x: 0, z: -23, y: 0, yaw: 0, halfLen: 2 };
  const gap = pulloutGap(bus, lane, car);
  assert.ok(canYieldAtPullout(gap, 8));
  assert.ok(!canYieldAtPullout(gap, 14));
  assert.ok(!canYieldAtPullout(pulloutGap(bus, lane, { ...car, z: 0 }), 0));
  assert.equal(pulloutGap(bus, lane, { ...car, yaw: Math.PI }), Infinity);
});

test('k přijíždějícímu spoji zamíří chodec na straně nástupiště a obsazené dveře prodlouží pobyt', () => {
  const route = { ref: '23', type: 'bus', posAt: (s, side) => ({ x: -side, z: s, tx: 0, tz: 1 }) };
  const v = { visible: true, s: 74, side: 2, y: 0, stopIndex: 0, route, destination: 'Slovany',
    sections: [{ length: 12, doors: [4] }], stops: [[100], [180]], passengerCount: 0,
    event: { trip: { stops: [{ stop: 23 }, { stop: 34 }], times: [0, 10, 40, 40] } } };
  const walker = { x: -5.8, z: 95, y: 0, speed: 1.4, state: 'walk', edge: 8 };
  const opposite = { ...walker, x: 2 };
  const manager = { peds: [opposite, walker], world: { blocked: () => false, isWater: () => false } };
  const focus = { x: 0, z: 98 };
  servicePlatform(manager, v, focus, 2);
  assert.equal(walker.state, 'platform');
  assert.equal(opposite.state, 'walk');
  assert.ok(passengerMatches(walker, v));
  Object.assign(v, { s: 100, doorsOpen: true, doorFraction: 1, wait: 0.4, canBoard: true });
  servicePlatform(manager, v, focus, 2);
  assert.equal(walker.state, 'board');
  assert.ok(v.wait > 2);
  stepPassenger(walker, v.wait);
  assert.equal(walker.state, 'aboard');
});

test('ke spodnímu vchodu míří jen cestující z příjezdové 49 na dvojce', async () => {
  const { walksToStation, stepStationWalk } = await import('../src/entities/station-walk.js');
  const car = { route: { type: 'trolleybus', ref: '49' }, stopIndex: 1, stops: [0, 1] };
  assert.equal(walksToStation(car, '53408/2'), true);
  assert.equal(walksToStation(car, '53408/1'), false);
  assert.equal(walksToStation({ ...car, stopIndex: 0 }, '53408/2'), false);
  assert.equal(walksToStation({ ...car, route: { type: 'bus', ref: '33' } }, '53408/2'), false);
  const p = { x: 747.7, z: 338.5, speed: 1.4, stationWaypoint: 0 };
  let done = false, distance = 0;
  for (let i = 0; i < 3500 && !done; i++) {
    const { x, z } = p;
    done = stepStationWalk(p, 0.1);
    const step = Math.hypot(p.x - x, p.z - z);
    assert.ok(step <= 0.141);
    distance += step;
  }
  assert.ok(done && distance > 300);
  assert.ok(Math.hypot(p.x - 727.01, p.z - 481.92) < 1);
});

test('cesta z nádraží vybere nejbližší včas dosažitelnou 49 a cestující pozná přesný spoj', async () => {
  const { stationTicket } = await import('../src/entities/station-walk.js');
  const { DAY_SECONDS } = await import('../src/game/clock.js');
  const station = 2, day = 8, clock = { day, now: day * DAY_SECONDS + 3600 };
  const trip = (id, ref, time, service = 1) => [service, {
    id, route: { ref, type: 'trolleybus' }, destination: 'Karlov', times: [time, time],
  }, 0];
  const timetable = { profile: () => [1], maxOffset: 1, stopEntries: [[], [], [
    trip('brzy', '49', 3800), trip('pozdě', '49', 4080), trip('jiná linka', '12', 3910),
    trip('nejede', '49', 3906, 2), trip('druhý', '49', 3990), trip('první', '49', 3960),
  ]] };
  const ticket = stationTicket(timetable, station, clock);
  assert.equal(ticket.eventKey, '8:první');
  const v = { route: { ref: '49', type: 'trolleybus' }, destination: 'Karlov', stopIndex: 0,
    event: { key: ticket.eventKey, trip: { stops: [{ stop: station }] } } };
  assert.ok(passengerMatches({ ticket }, v));
  assert.equal(passengerMatches({ ticket }, { ...v, event: { ...v.event, key: '8:druhý' } }), false);
  assert.equal(passengerMatches({ ticket }, { ...v, destination: 'Areál FN' }), false);
  assert.equal(stationTicket(timetable, -1, clock), null);
  timetable.stopEntries[station] = [trip('po půlnoci', '49', 180)];
  assert.equal(stationTicket(timetable, station, { day, now: (day + 1) * DAY_SECONDS - 180 }).eventKey, '9:po půlnoci');
});

test('cesta z nádraží respektuje počet postav, zakládá se jednou a po změně hodin se naplánuje znovu', async () => {
  const { PedManager } = await import('../src/entities/player.js');
  const { stationEntrance: [x, z] } = await import('../src/entities/station-walk.js');
  const clock = { day: 0, now: 3600 };
  const timetable = { stops: [['Hlavní nádraží', 708, 337, '53408/1']], profile: () => [1], maxOffset: 0,
    stopEntries: [[[1, { id: '692185', route: { type: 'trolleybus', ref: '49' }, destination: 'Karlov', times: [3960, 3960] }, 0]]] };
  const manager = new PedManager(null, null, { clock, transit: { timetable } });
  const local = { state: 'walk' };
  manager.peds.push(local);
  manager._person = (px, pz) => {
    const p = { x: px, z: pz };
    manager.peds.push(p);
    return p;
  };
  manager.remove = i => manager.peds.splice(i, 1);
  manager._startStationWalk({ x, z }, 1);
  assert.deepEqual(manager.peds, [local]);
  clock.now += 9;
  manager._startStationWalk({ x, z }, 3);
  assert.equal(manager.peds[1].ticket.eventKey, '0:692185');
  clock.now += 9;
  manager._startStationWalk({ x, z }, 3);
  assert.equal(manager.peds.length, 2);
  manager.resetStationDepartures();
  assert.deepEqual(manager.peds, [local]);
  clock.now = 3600;
  manager._startStationWalk({ x: x + 500, z }, 3);
  assert.equal(manager.peds.length, 1);
  manager._startStationWalk({ x, z }, 3);
  assert.equal(manager.peds[1].ticket.eventKey, '0:692185');
});

test('parkování u odjezdové jedničky ponechá volný prostor vozu a zachová protější stranu ulice', async () => {
  const { blocksDeparturePlatform } = await import('../src/entities/station-walk.js');
  const yaw = -1.147;
  assert.ok(blocksDeparturePlatform(713.83, 339.18, yaw, 4.5, 1.8));
  assert.ok(blocksDeparturePlatform(699.3, 345.63, yaw, 4.5, 1.8));
  assert.equal(blocksDeparturePlatform(719.91, 345.9, yaw, 4.5, 1.8), false);
  assert.equal(blocksDeparturePlatform(670, 357, yaw, 4.5, 1.8), false);
});

test('pěší zelená vyžaduje volnou celou zebru včetně místa za zadním článkem MHD', () => {
  const t = Object.assign(Object.create(Traffic.prototype), { phase: () => 'walk' });
  const c = { a: [-4, 0], b: [4, 0], x: 0, z: 0, dx: 1, dz: 0, length: 8, group: {} };
  const p = { y: 0, speed: 1.3 };
  const car = { x: 0, y: 0, z: 3.3, yaw: 0, halfLen: 2, radius: 1, speed: 3, vz: 3 };
  const walk = (cars, transit = []) => t.canWalk(c, cars, transit, p);
  assert.ok(!walk([car]));
  assert.ok(!walk([{ ...car, mode: 'parked' }]));
  assert.ok(walk([{ ...car, z: 3.5 }]));
  assert.ok(walk([{ ...car, y: 5 }]));
  assert.ok(walk([{ ...car, z: -10 }]));
  assert.ok(walk([{ ...car, x: 5.5, z: 3.1, yaw: -Math.PI / 4 }]));
  assert.ok(!walk([{ ...car, x: 4.2, z: 1.2, yaw: -Math.PI / 4 }]));
  const rear = { ...car, halfLen: 6, z: 7.1 }, front = { ...rear, z: 19.1 };
  assert.ok(!walk([], [front, rear]));
  assert.ok(walk([], [front, { ...rear, z: 7.6 }]));
  t.phase = () => 'red';
  assert.ok(!walk([]));
  t.signalsOff = () => true;
  assert.ok(!walk([{ ...car, z: -6 }]));
});
