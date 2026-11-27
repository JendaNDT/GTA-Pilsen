import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { atTaxiStop, scoreTaxiMotion, taxiBonus, taxiRoute } = await import('../src/game/taxi.js');

test('taxi očekává zastavení u správného obrubníku, ve směru jízdy a na stejné úrovni', () => {
  const stop = { x: -2, z: 10, y: 4, tx: 0, tz: 1 };
  const car = { x: -2.3, z: 12, y: 4.5, yaw: 0.1 };
  assert.ok(atTaxiStop(car, stop, 0.2));
  assert.ok(!atTaxiStop({ ...car, x: 2 }, stop, 0));
  assert.ok(!atTaxiStop({ ...car, x: 0 }, stop, 0));
  assert.ok(!atTaxiStop({ ...car, yaw: Math.PI }, stop, 0));
  assert.ok(!atTaxiStop({ ...car, y: 7 }, stop, 0));
  assert.ok(!atTaxiStop(car, stop, 3));
});

test('časový bonus slábne po termínu, běžná jízda má pevné jízdné', () => {
  assert.equal(taxiBonus({ id: 'regular' }), 0);
  assert.equal(taxiBonus({ id: 'train', limit: 180, time: 20 }), 120);
  assert.equal(taxiBonus({ id: 'train', limit: 180, time: 0 }), 120);
  assert.equal(taxiBonus({ id: 'train', limit: 180, time: -30 }), 60);
  assert.equal(taxiBonus({ id: 'train', limit: 180, time: -90 }), 0);
});

test('dlouhé prudké brzdění stojí jeden odpočet a další odpočet až nový manévr', () => {
  const job = { id: 'quiet', speed: 19, comfort: 90, braking: 0, hardBrakes: 0 };
  for (const speed of [18, 17, 16, 15, 14, 13]) scoreTaxiMotion(job, 0.1, speed);
  assert.equal(taxiBonus(job), 75);
  scoreTaxiMotion(job, 0.1, 13);
  for (const speed of [12, 11, 10]) scoreTaxiMotion(job, 0.1, speed);
  assert.equal(taxiBonus(job), 60);
  scoreTaxiMotion(job, 0.1, 10);
  scoreTaxiMotion(job, 0.1, 9.6);
  assert.equal(taxiBonus(job), 60);
  assert.equal(job.hardBrakes, 2);
});

test('odhad času používá směrové limity a při zastávce na stejné hraně jen zbývající úsek', () => {
  const world = {
    eTo: [3, 4, 5], eFrom: [2, 3, 4], eA: [0, 2, 10], eB: [2, 5, 7],
    eRoad: [0, 1, 2], eLen: [50, 30, 80],
    roadSpeed: (_, forward) => forward ? 36 : 18,
    findPath(...args) { assert.deepEqual(args, [3, 4, 9000, 0, 0, 2]); return [1]; },
  };
  const start = { edge: 0, along: 20 };
  assert.deepEqual(taxiRoute(world, start, { edge: 0, along: 30 }),
    { path: [], sameEdge: true, len: 10, seconds: 1 });
  assert.deepEqual(taxiRoute(world, start, { edge: 2, along: 20 }),
    { path: [1], sameEdge: false, len: 80, seconds: 10 });
});

test('regionální stanoviště pokrývají města a okraje mapy a mají odlišná nástupní místa', async () => {
  const { TAXI_STANDS, regionalOffer } = await import('../src/game/regional-taxi.js');
  const names = TAXI_STANDS.map(s => s.area);
  for (const area of ['Plzeň','Rokycany','Starý Plzenec','Dobřív','Nynice','Líně','Lhota pod Radčem']) assert.ok(names.includes(area),area);
  assert.equal(new Set(TAXI_STANDS.map(s => s.edge + '/' + s.along)).size, TAXI_STANDS.length);
  assert.equal(regionalOffer({}, { stand: TAXI_STANDS[0] }, TAXI_STANDS[0]),null);
  assert.equal(regionalOffer({},null,TAXI_STANDS[0]),null);
});
