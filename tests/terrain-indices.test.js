import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localGradeIndices } from '../src/world/terrain-indices.js';

test('jemný pás u nájezdu zachová výšku každé plošky i společné hrany', () => {
  const n = 16, step = 4, stride = n + 1;
  const offsets = new Int16Array(stride ** 2);
  offsets[5 * stride + 5] = -43;
  offsets[8 * stride + 8] = 72; // vrchol společný čtyřem hrubým buňkám
  offsets[0] = 15;
  const indices = localGradeIndices(n, step, offsets);
  assert.ok(indices.length < 6 * n * n);
  const coarseY = (x, z) => ((5 * x + 7 * z) % 11) * 0.25;
  const vertexY = (x, z) => {
    const i = Math.floor(x / step), j = Math.floor(z / step);
    const u = x / step - i, v = z / step - j;
    const a = coarseY(i, j), b = coarseY(i + 1, j), c = coarseY(i, j + 1), d = coarseY(i + 1, j + 1);
    return offsets[z * stride + x] / 100 + (u + v <= 1
      ? a + u * (b - a) + v * (c - a) : d + (1 - u) * (c - d) + (1 - v) * (b - d));
  };
  const edges = new Map(), seen = new Set();
  for (let k = 0; k < indices.length; k += 3) {
    const face = indices.subarray(k, k + 3);
    const [a, b, c] = Array.from(face, id => ({ x: id % stride, z: Math.floor(id / stride) }));
    const cross = (p, q, x, z) => (q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x);
    const area = cross(a, b, c.x, c.z);
    assert.ok(area < 0, 'Plocha musí mířit nahoru.');
    for (let j = 0; j < 3; j++) {
      const p = face[j], q = face[(j + 1) % 3];
      const key = Math.min(p, q) * stride ** 2 + Math.max(p, q);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
    for (let z = Math.min(a.z, b.z, c.z); z < Math.max(a.z, b.z, c.z); z++) {
      for (let x = Math.min(a.x, b.x, c.x); x < Math.max(a.x, b.x, c.x); x++) {
        for (const upper of [false, true]) {
          const u = upper ? 0.68 : 0.21, v = upper ? 0.78 : 0.36;
          const w1 = cross(b, c, x + u, z + v) / area, w2 = cross(c, a, x + u, z + v) / area;
          const w3 = 1 - w1 - w2;
          if (Math.min(w1, w2, w3) < 0) continue;
          const id = 2 * (z * n + x) + Number(upper);
          assert.ok(!seen.has(id), 'Překrývající se plochy.');
          seen.add(id);
          const height = w1 * vertexY(a.x, a.z) + w2 * vertexY(b.x, b.z) + w3 * vertexY(c.x, c.z);
          const expected = upper
            ? (u + v - 1) * vertexY(x + 1, z + 1) + (1 - v) * vertexY(x + 1, z) + (1 - u) * vertexY(x, z + 1)
            : (1 - u - v) * vertexY(x, z) + u * vertexY(x + 1, z) + v * vertexY(x, z + 1);
          assert.ok(Math.abs(height - expected) < 1e-9);
        }
      }
    }
  }
  assert.equal(seen.size, 2 * n * n);
  for (const [key, count] of edges) {
    const a = Math.floor(key / stride ** 2), b = key % stride ** 2;
    const boundary = [0, n].some(edge => (a % stride === edge && b % stride === edge) ||
      (Math.floor(a / stride) === edge && Math.floor(b / stride) === edge));
    assert.equal(count, boundary ? 1 : 2, 'Každá vnitřní hrana musí mít souseda.');
  }
});
