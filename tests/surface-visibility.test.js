import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BufferGeometry, Float32BufferAttribute, Mesh, PerspectiveCamera } from 'three/webgpu';
import { trimSurfaceToCamera } from '../src/world/surface-visibility.js';

test('povrch při otáčení kamery zachová pořadí viditelných trojúhelníků a vrátí skryté bloky', () => {
  const geometry = new BufferGeometry(), positions = [], indices = [];
  for (const x of [-10, 50, 10]) {
    const start = positions.length / 3;
    positions.push(x - 1, 0, -20, x, 1, -20, x + 1, 0, -20);
    for (let i = 0; i < 48; i++) indices.push(start, start + 1, start + 2);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  const mesh = new Mesh(geometry), camera = new PerspectiveCamera(80, 1, 0.1, 100);
  trimSurfaceToCamera(mesh);
  function visible(x) {
    camera.position.x = x;
    camera.updateMatrixWorld();
    mesh.onBeforeRender(null, null, camera);
    return Array.from(geometry.index.array.subarray(0, geometry.drawRange.count));
  }
  assert.deepEqual(visible(0), [...indices.slice(0, 144), ...indices.slice(288)]);
  assert.deepEqual(visible(50), indices.slice(144, 288));
  assert.deepEqual(visible(200), []);
  mesh.position.x = 200;
  mesh.updateMatrixWorld();
  assert.deepEqual(visible(200), [...indices.slice(0, 144), ...indices.slice(288)]);
});
