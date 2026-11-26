import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePack } from '../src/data.js';
import { CycleNetwork } from '../src/world/cycle-network.js';

const finish = iterator => {
  let step;
  do { step = iterator.next(); } while (!step.done);
  return step.value;
};
const point = (x, z) => ({ x, z });

function network(nodes, segments, kinds, directions, restrictions = []) {
  const graph = new CycleNetwork({
    header: { restrictions },
    x: nodes.map(p => p[0] * 10), z: nodes.map(p => p[1] * 10),
    a: segments.map(p => p[0]), b: segments.map(p => p[1]), way: segments.map(p => p[2]),
    direction: directions, kind: kinds, level: kinds.map(() => 0),
  });
  finish(graph.prepare());
  return (a, b, connect) => finish(graph.route(a, b, connect));
}

test('cyklistická trasa respektuje jednosměrku i na prostředku stejného úseku', () => {
  const route = network([[0, 0], [100, 0]], [[0, 1, 0]], [11], [1]);
  assert.deepEqual(route(point(20, 0), point(70, 0)), [20, 0, 70, 0]);
  assert.equal(route(point(70, 0), point(20, 0)), null);
  assert.equal(route(point(20, 0), point(70, 0), (_a, b) => b.x < 60), null);
});

test('cyklistická trasa upřednostní použitelnou cyklostezku před hlavní silnicí', () => {
  const route = network([[-100, 0], [0, 0], [60, 45], [120, 0], [220, 0]],
    [[0, 1, 0], [1, 3, 1], [1, 2, 2], [2, 3, 2], [3, 4, 3]], [11, 4, 18, 11], [3, 3, 3, 3]);
  const line = route(point(-50, 0), point(170, 0));
  assert.deepEqual(line, [-50, 0, 0, 0, 60, 45, 120, 0, 170, 0]);
});

test('zákaz odbočení přesměruje cyklistu na legální cestu', () => {
  const route = network([[-140, 0], [0, 0], [0, 120], [100, 0], [100, 120]],
    [[0, 1, 0], [1, 2, 1], [1, 3, 2], [3, 4, 3], [4, 2, 4]], [11, 11, 11, 11, 11], [3, 3, 3, 3, 3],
    [{ from: [0], to: [1], at: [0, 0], node: 1, kind: 'no_right_turn' }]);
  assert.deepEqual(route(point(-60, 0), point(0, 80)), [-60, 0, 0, 0, 100, 0, 100, 120, 0, 120, 0, 80]);
});

test('dvě cesty se stejnými souřadnicemi bez společného uzlu se nespojí', () => {
  const route = network([[-100, 0], [0, 0], [100, 0], [0, -100], [0, 0], [0, 100]],
    [[0, 1, 0], [1, 2, 0], [3, 4, 1], [4, 5, 1]], [11, 18], [3, 3]);
  assert.equal(route(point(-70, 0), point(0, 70)), null);
});

test('distribuovaná cyklistická síť používá stejnou revizi OSM jako herní mapa', () => {
  const bytes = readFileSync(new URL('../public/data/cycle-network.bin', import.meta.url));
  const p = parsePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const meta = JSON.parse(readFileSync(new URL('../public/data/meta.json', import.meta.url), 'utf8'));
  assert.equal(p.header.osmTimestamp, meta.osmTimestamp);
  assert.ok(p.a.length > 50_000);
  assert.equal(p.a.length, p.b.length);
  assert.equal(p.a.length, p.way.length);
  assert.ok(p.b.every((b, i) => p.a[i] < p.x.length && b < p.x.length && p.way[i] < p.direction.length));
});
