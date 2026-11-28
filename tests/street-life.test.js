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
