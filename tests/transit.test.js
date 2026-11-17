import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DAY_SECONDS, GameClock, parseDay } from '../src/game/clock.js';
import { Timetable } from '../src/game/timetable.js';

const data = JSON.parse(await readFile(new URL('../public/data/timetable.json', import.meta.url)));
const meta = JSON.parse(await readFile(new URL('../public/data/meta.json', import.meta.url)));
const timetable = new Timetable(data);
const day = parseDay('2026-11-09');

test('všech 51 linek, jízdní dráhy, zastávky, pořadí a časy mají úplné pokrytí', () => {
  assert.equal(data.version, 2);
  assert.equal(data.source.osm, meta.osmTimestamp);
  assert.equal(data.trips.length, 7481);
  assert.equal(data.patterns.length, 370);
  assert.equal(data.stops.length, 705);
  const lines = new Map();
  for (const [ri, stops, destination, direction] of data.patterns) {
    const route = data.routes[ri];
    if (!lines.has(route.type)) lines.set(route.type, new Set());
    lines.get(route.type).add(route.ref);
    assert.ok(destination.length > 0);
    assert.ok(['0', '1', ''].includes(direction));
    assert.ok(route.length > 0);
    let last = -1;
    for (const [station, index] of stops) {
      assert.ok(station >= 0 && station < data.stops.length);
      const [s, name] = route.stops[index];
      assert.equal(name, data.stops[station][0]);
      assert.ok(s >= last && s <= route.length + 0.03, `${route.ref} ${name}`);
      last = s;
    }
    const { minX, maxX, minZ, maxZ } = meta.bounds;
    for (const [x, z] of route.path) assert.ok(x >= minX && x <= maxX && z >= minZ && z <= maxZ);
  }
  assert.deepEqual(Object.fromEntries([...lines].map(([type, refs]) => [type, refs.size])), { tram: 3, bus: 35, trolleybus: 13 });
  for (const ref of ['19', '49', 'N7']) assert.ok(lines.get('trolleybus').has(ref));
  for (const ref of ['30', 'N1', 'N12', '56']) assert.ok(lines.get('bus').has(ref));
  const literalTime = (value) => value >= 0 ? value : -value - 1;
  for (const [id, service, pattern, values] of data.trips) {
    assert.ok(timetable.byService[service]);
    assert.equal(values.length, data.patterns[pattern][1].length * 2, id);
    assert.ok(values.every((time, i) => Number.isInteger(time) && (!i || literalTime(time) >= literalTime(values[i - 1]))), id);
  }
});

test('čtyři hraniční varianty zachovávají původní cíl a obousměrný průjezd přes okraj', () => {
  const clipped = data.patterns.filter(([, , , , entry, exit]) => entry || exit);
  const routeEdge = (ref, side) => clipped.find(([ri, , , , entry, exit]) => data.routes[ri].ref === ref && (side ? entry : exit));
  for (const [ref, realDestination, lastStop] of [['56', 'Město Touškov', 'Kozolupy, u Jána'], ['N12', 'Stod', 'Líně']]) {
    const [oi, , destination] = routeEdge(ref, false);
    const [ii] = routeEdge(ref, true);
    const outgoing = data.routes[oi], incoming = data.routes[ii];
    assert.equal(destination, realDestination);
    assert.equal(outgoing.stops.at(-1)[1], lastStop);
    assert.equal(incoming.stops[0][1], lastStop);
    assert.ok(outgoing.length - outgoing.stops.at(-1)[0] >= 25);
    assert.ok(incoming.stops[0][0] >= 25);
    assert.ok(Math.abs(outgoing.path.at(-1)[0] - meta.bounds.minX - 42) < 1);
    assert.deepEqual(outgoing.path.at(-1), incoming.path[0]);
  }
  assert.equal(clipped.length, 4);
});

test('tabule přepočítá odjezd podle skutečné polohy a odstraní již obsloužený spoj', () => {
  const station = data.stops.findIndex(([name, , , code]) => name === 'Bory' && code === '26935/5');
  const [service, trip, index] = timetable.stopEntries[station].find(([s, t]) =>
    timetable.profile(day).includes(s) && t.route.ref === '30' && t.times[1] >= 8 * 3600);
  const planned = trip.times[index * 2 + 1];
  const clock = new GameClock(day);
  clock.set(day, (planned - 15) / 3600);
  const at = () => timetable.departuresAt(station, clock, 90 * 60, live).rows;
  const event = { trip, day }, key = `${day}:${trip.id}`;
  const live = new Map([[key, {
    event, visible: true, stopIndex: index, s: trip.stops[index].target[0], wait: 4.8, doorsOpen: true,
  }]]);
  const first = at()[0];
  assert.ok(timetable.profile(day).includes(service));
  assert.equal(first.ref, '30');
  assert.equal(first.boarding, true);
  assert.equal(first.delayed, true);
  assert.ok(first.time > planned + day * DAY_SECONDS);
  live.get(key).stopIndex++;
  assert.ok(at().every((row) => !row.boarding));
  assert.ok(at().every((row) => row.ref !== '30' || row.time !== planned + day * DAY_SECONDS));
});
