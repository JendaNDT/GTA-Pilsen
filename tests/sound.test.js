import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import { soundField, soundListener, WaterSound } from '../src/game/sound-field.js';

const world = { raycast: () => 1, tunnelAt: () => null, heightAt: () => 0 };
const focus = { x: 0, y: 0, z: 0 };
const source = (x, z, y = 0) => ({ x, y, z });

test('stereo sleduje stranu zdroje, natočení posluchače a vzdálenost', () => {
  const game = { world, focus, camYaw: 0, mode: 'foot' };
  const listener = soundListener(game);
  const left = soundField(world, listener, source(8, 1), 120);
  const right = soundField(world, listener, source(-8, 1), 120);
  assert.ok(left.pan < -0.9 && right.pan > 0.9);
  assert.ok(Math.abs(left.gain - right.gain) < 0.001);
  assert.ok(soundField(world, listener, source(35, 1), 120).gain < left.gain);
  assert.equal(soundField(world, listener, source(124, 0), 120), null);
  game.camYaw = Math.PI;
  assert.ok(soundField(world, soundListener(game), source(8, 1), 120).pan > 0.9);
});

test('budova, oddělený tunel a zavřená kabina tlumí vnější zvuk', () => {
  const game = { world, focus, camYaw: 0, mode: 'foot' };
  const car = source(-12, 0);
  const clear = soundField(world, soundListener(game), car, 110);
  const wall = soundField({ ...world, raycast: () => 0.5 }, soundListener(game), car, 110);
  assert.ok(wall.gain < clear.gain * 0.5 && wall.lowpass < 1400);
  const tunnel = { tunnel: {} };
  const tunnelWorld = { ...world, tunnelAt: (x) => x > -1 ? tunnel : null };
  const portal = soundField(tunnelWorld, soundListener({ ...game, world: tunnelWorld }), car, 110);
  assert.ok(portal.gain < wall.gain && portal.lowpass < wall.lowpass);
  const open = soundField(world, soundListener({ ...game, mode: 'transit', focus: { ...focus, doorsOpen: true } }), car, 110);
  const closed = soundField(world, soundListener({ ...game, mode: 'transit' }), car, 110);
  assert.ok(closed.lowpass < open.lowpass && closed.gain < open.gain);
  assert.equal(soundField(world, soundListener({ ...game, mode: 'car' }), focus, 110).pan, 0);
});

test('řeka a jez sledují mapovou geometrii a nad vysokým břehem či z dálky utichnou', () => {
  const land = { header: { lineCount: 2 }, lStart: [0, 2, 4],
    lCls: [0, 9], lx: [0, 1000, 500, 500], lz: [0, 0, 200, 250] };
  const sound = new WaterSound({ ...world, l: land }, null, [[50, 0]]);
  const near = [];
  sound.nearby(source(55, 14, 1.5), (position, kind) => near.push([Math.round(position.x), position.z, kind]));
  assert.deepEqual(near, [[55, 0, 'water'], [50, 0, 'weir']]);
  const far = [];
  sound.nearby(source(55, 170, 1), (_, kind) => far.push(kind));
  sound.nearby(source(55, 2, 80), (_, kind) => far.push(kind));
  assert.deepEqual(far, []);
});

test('každý název stanoviště má v distribuovaném balíku vlastní klip', async () => {
  const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
  const { stops } = await read('../public/data/timetable.json');
  const { version, clips } = await read('../public/audio/stops.json');
  const places = await read('../public/data/sound-places.json');
  const meta = await read('../public/data/meta.json');
  assert.equal(version, 1);
  assert.equal(places.osm, meta.osmTimestamp);
  assert.ok(places.weirs.length > 60);
  assert.deepEqual(new Set(Object.keys(clips)), new Set(stops.map(([name]) => name)));
  const endings = new Map();
  for (const [file, offset, duration] of Object.values(clips)) {
    assert.match(file, /^hlasky-\d\d\.mp3$/);
    assert.ok(offset >= (endings.get(file) ?? 0) && duration > 0.25 && duration < 6);
    endings.set(file, offset + duration);
  }
  for (const file of endings.keys()) {
    assert.ok((await stat(new URL('../public/audio/' + file, import.meta.url))).size > 1000);
  }
});
