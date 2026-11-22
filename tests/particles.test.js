import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three/webgpu';
import { Particles } from '../src/fx/particles.js';

test('částice sdílejí rozpočet, pohybují se, zanikají a při vypnutí zůstanou skryté', () => {
  let limit = 4;
  const particles = new Particles(new Scene(), {backend: {}}, () => limit, 8);
  for (const kind of ['glass', 'sparks', 'smoke', 'dust']) particles.emit(kind, 5, 8, 12, 3);
  particles.update(0.1, [], {});
  assert.equal(particles.mesh.geometry.instanceCount, 4);
  assert.ok(particles.state.getY(0) > 8 && particles.state.getW(0) > 0);
  limit = 2;
  particles.update(0.1, [], {});
  assert.equal(particles.mesh.geometry.instanceCount, 2);
  particles.update(3, [], {});
  assert.equal(particles.mesh.visible, false);
  const car = {health: 19, yaw: 0, type: {len: 4, h: 1.4}, x: 0, y: 0, z: 0};
  particles.update(0.2, [car], car);
  assert.equal(particles.mesh.visible, true);
  particles.enabled = false;
  const cursor = particles.cursor;
  particles.update(0.2, [car], car);
  assert.equal(particles.cursor, cursor);
  assert.equal(particles.mesh.visible, false);
});
