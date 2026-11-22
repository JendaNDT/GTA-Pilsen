import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parts } from '../src/physics/ragdoll.js';

globalThis.window = {};
globalThis.location = { search: '?quality=medium' };
globalThis.matchMedia = () => ({ matches: false });
const { makePedMesh, makeFallenMesh, animatePed } = await import('../src/entities/models.js');

test('chůze a pád používají stejné díly a oblečení, každý chodec má vlastní kosti', () => {
  const walker = makePedMesh(2), other = makePedMesh(2);
  assert.equal(walker.geometry, other.geometry);
  assert.notEqual(walker.skeleton, other.skeleton);
  assert.deepEqual(walker.skeleton.bones.map(b => b.name), parts.map(p => p.name));
  const fall = makeFallenMesh(walker);
  assert.equal(fall.children.length, parts.length);
  assert.equal(walker.geometry.attributes.position.count,
    fall.children.reduce((n, limb) => n + limb.geometry.attributes.position.count, 0));
  animatePed(walker, Math.PI / 2, 1);
  assert.ok(walker.skeleton.getBoneByName('lytko-1').rotation.x > 0.4);
  assert.equal(other.skeleton.getBoneByName('lytko-1').rotation.x, 0);
  assert.notEqual(makePedMesh(3).geometry.attributes.position.count, makePedMesh(0).geometry.attributes.position.count);
});
