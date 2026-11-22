import assert from 'node:assert/strict';
import test from 'node:test';
import { measuredRailDeck } from '../src/world/rail-deck.js';

test('měřené řezy kolejí zachovají původní lom trati, výšku a oba konce', () => {
  const rail = { pts: Float32Array.of(0, 0, 10, 0, 10, 10), y: Float32Array.of(4, 6, 8) };
  const path = measuredRailDeck(rail, [
    [0, 4, 0],
    [0.25, 5, 0.5],
    [0.75, 6, 0.2],
    [1, 4, 0]
  ]);
  const stops = [4, 5, 6, 7, 8].map((height) => path.y.indexOf(height));
  assert.ok(stops.every((k) => k >= 0));
  assert.deepEqual(
    stops.map((k) => path.widths[k]),
    [2, 2.5, 2.75, 3, 2]
  );
  assert.ok(path.y.slice(1).every((v, i) => v - path.y[i] <= 0.8));
  assert.deepEqual([path.x[0], path.z[0], path.x.at(-1), path.z.at(-1)], [0, 0, 10, 10]);
  assert.deepEqual([path.x[stops[1]], path.z[stops[1]]], [5, 0.5]);
  assert.ok(Math.abs(path.x[stops[3]] - 9.8) < 1e-8 && path.z[stops[3]] === 5);
  assert.deepEqual([...rail.pts], [0, 0, 10, 0, 10, 10]);
});

test('šířka herního dotazu se mění mezi řezy a neplatné pořadí řezů se odmítne', async () => {
  const { segmentHalfWidth, validRailSections } = await import('../src/world/rail-deck.js');
  const world = { bridgeSeg: Float32Array.of(0, 0, 0, 1, 0, 0, 2, 2), bridgeEndWidths: new Map([[0, 4]]) };
  assert.equal(segmentHalfWidth(world, 0, 0.25), 2.5);
  assert.equal(
    validRailSections([
      [0, 4, 0],
      [0.5, 6, 0.3],
      [1, 4, 0]
    ]),
    true
  );
  for (const bad of [
    [
      [0, 4, 0],
      [0, 4, 0],
      [1, 4, 0]
    ],
    [
      [0, 4, 0],
      [1, 0, 0]
    ],
    [
      [0, 2, 2],
      [1, 2, 0]
    ]
  ])
    assert.equal(validRailSections(bad), false);
});
