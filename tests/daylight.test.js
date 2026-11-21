import assert from 'node:assert/strict';
import test from 'node:test';
import { daylight, lookFromParams, wallLift } from '../src/world/daylight.js';

const noon = { elevation: 0.8, day: 1, dusk: 0, overcast: 0 };
const night = { elevation: -0.5, day: 0, dusk: 0, overcast: 0 };

test('původní vzhled zachovává dřívější hodnoty světla', () => {
  const light = daylight(noon, 'puvodni');
  assert.equal(light.sun, 1.85);
  assert.ok(Math.abs(light.hemi - 2.13) < 1e-9);
  assert.equal(light.environment, 0.22);
  assert.ok(Math.abs(light.shadow - 0.91) < 1e-9);
  assert.deepEqual(light.hemiSky, [0xffe9d5, [0x6f83c0, 0]]);
});

test('nový vzhled: za jasného dne slunce převládá a stíny jsou plné', () => {
  const light = daylight(noon);
  assert.ok(light.sun / light.hemi > 1.3, 'slunce má být víc než 1,3× silnější než obloha');
  assert.equal(light.environment, daylight(noon, 'puvodni').environment, 'voda a auta odrážejí oblohu jako dřív');
  assert.ok(light.facadeEnvironment < light.environment / 10, 'fasády odrážejí oblohu jen nepatrně');
  assert.ok(light.groundRadiance.scale > 0, 'zem pod obzorem má vlastní jas');
  assert.equal(light.shadow, 1);
  assert.equal(daylight(noon, 'puvodni').facadeEnvironment, null);
  const old = daylight(noon, 'puvodni');
  assert.ok(light.sun / light.hemi > 1.5 * (old.sun / old.hemi), 'kontrast je výrazně vyšší než dřív');
});

test('nový vzhled: noc se nemění', () => {
  const light = daylight(night), old = daylight(night, 'puvodni');
  assert.equal(light.sun, 0);
  assert.equal(light.hemi, old.hemi);
  assert.equal(light.environment, 0);
  assert.equal(light.shadow, old.shadow);
  assert.equal(light.hemiSky.at(-1)[0], old.hemiSky.at(-1)[0]);
});

test('nový vzhled: zatažená obloha ubere slunce a přidá světlo oblohy', () => {
  const clear = daylight(noon);
  const cloudy = daylight({ ...noon, overcast: 0.59 });
  assert.ok(cloudy.sun < clear.sun * 0.35);
  assert.ok(cloudy.hemi > clear.hemi * 1.15);
});

test('omítky: tmavé se zesvětlí víc než světlé a nikdy neztmavnou', () => {
  assert.ok(wallLift(0.1) > wallLift(0.4));
  assert.ok(wallLift(0.4) > wallLift(0.8));
  assert.ok(Math.abs(wallLift(0.1) - 1.45) < 1e-9);
  assert.ok(Math.abs(wallLift(0.9) - 1.12) < 1e-9);
  for (const l of [0, 0.3, 0.6, 1]) assert.ok(wallLift(l) >= 1);
});

test('vzhled se volí adresou a neznámá hodnota vrátí nový vzhled', () => {
  assert.equal(lookFromParams(new URLSearchParams('')), 'novy');
  assert.equal(lookFromParams(new URLSearchParams('vzhled=puvodni')), 'puvodni');
  assert.equal(lookFromParams(new URLSearchParams('vzhled=cokoli')), 'novy');
  assert.equal(lookFromParams(null), 'novy');
});

test('vzhled stránky se čte z adresy a v Node je nový', async () => {
  const { pageLook } = await import('../src/world/daylight.js');
  assert.equal(pageLook(), 'novy');
  globalThis.location = { search: '?debug&vzhled=puvodni' };
  try {
    assert.equal(pageLook(), 'puvodni');
  } finally {
    delete globalThis.location;
  }
});

test('nový vzhled: světlo oblohy je ve dne teplé, aby dlažba ve stínu neztratila barvu', () => {
  const [first] = daylight(noon).hemiSky;
  const red = first >> 16, blue = first & 255;
  assert.ok(red - blue > 30);
});
