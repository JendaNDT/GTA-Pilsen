import assert from 'node:assert/strict';
import { test } from 'node:test';
import { densePath } from '../src/world/road-profile.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { exteriorBridgeEdges } = await import('../src/physics/railings.js');

const world = { heightAt: () => -8, chunkIndex: () => 0 };
function deck(start, end, z, width, y = 0, style = 'solid') {
  return { path: densePath([start, end], [z, z], [y, y], 0, 1, 0, 1, Infinity), width, style };
}

function crossSection(paths, x) {
  const edges = exteriorBridgeEdges(world, paths).get(0) ?? [];
  return edges.flatMap(edge => {
    const [a, b] = edge.corners;
    return Math.min(a[0], b[0]) <= x && x < Math.max(a[0], b[0]) ? [a[2]] : [];
  }).sort((a, b) => a - b);
}

test('společný vnější obvod se mění přesně v místě začátku a konce chodníku', () => {
  const paths = [deck(0, 25, 0, 5), deck(3.7, 19.3, 5, 1.4, 0.24)];
  for (const x of [3.68, 19.32]) assert.deepEqual(crossSection(paths, x), [-5, 5]);
  for (const x of [3.72, 10, 19.28]) assert.deepEqual(crossSection(paths, x), [-5, 6.4]);
});

test('dotýkající se mostovky mají společný okraj, oddělená patra vlastní a kámen má přednost', () => {
  assert.deepEqual(crossSection([deck(0, 20, 0, 4), deck(0, 20, 5, 1)], 10), [-4, 6]);
  assert.deepEqual(crossSection([deck(0, 20, 0, 4), deck(0, 20, 0, 4)], 10), [-4, 4]);
  assert.deepEqual(crossSection([deck(0, 20, 0, 4), deck(0, 20, 5, 2, 5)], 10), [-4, 3, 4, 7]);
  assert.deepEqual(crossSection([deck(0, 20, 0, 4), deck(0, 20, 5, 2, 0.7)], 10), [-4, 7]);
  const thinDeck = { ...deck(0, 20, 5, 2, 0.7), thickness: 0.65 };
  assert.deepEqual(crossSection([deck(0, 20, 0, 4), thinDeck], 10), [-4, 3, 4, 7]);
  for (const paths of [[deck(0, 20, 0, 4), deck(0, 20, 0, 4, 0, 'stone')],
    [deck(0, 20, 0, 4, 0, 'stone'), deck(0, 20, 0, 4)]]) {
    const edges = exteriorBridgeEdges(world, paths).get(0);
    assert.ok(edges.every(edge => edge.style === 'stone'));
  }
});
