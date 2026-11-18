import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrameProfiler } from '../src/game/frame-profiler.js';

test('měření práce snímku přiřadí jen skutečně dokončený vzorek GPU', async () => {
  let finish, measured, markers = 0;
  globalThis.GPUBufferUsage = { QUERY_RESOLVE: 1, COPY_SRC: 2, COPY_DST: 4, MAP_READ: 8 };
  globalThis.GPUTextureUsage = { RENDER_ATTACHMENT: 1 };
  globalThis.GPUMapMode = { READ: 1 };
  const device = {
    features: new Set(['timestamp-query']), createQuerySet: () => ({}),
    createTexture: () => ({ createView: () => ({}) }),
    createBuffer: () => ({
      mapAsync: () => new Promise((resolve) => { finish = resolve; }),
      getMappedRange: () => new BigUint64Array(measured).buffer, unmap() {},
    }),
    createCommandEncoder: () => ({
      beginRenderPass: () => ({ end() { markers++; } }),
      resolveQuerySet() {}, copyBufferToBuffer() {}, finish: () => ({}),
    }),
    queue: { submit() {} },
  };
  const renderer = {
    backend: { trackTimestamp: true, isWebGPUBackend: true, device },
    info: {
      frame: 0,
      render: { calls: 25, drawCalls: 8, triangles: 36 },
      memory: { geometries: 4, textures: 2 },
    },
    shadowMap: { enabled: true },
    getPixelRatio: () => 1,
  };
  const game = {
    renderer, env: { sun: { castShadow: true } },
    update() {}, render() { renderer.info.frame++; },
  };
  const perf = createFrameProfiler(game);
  const completed = () => new Promise((resolve) => setImmediate(resolve));
  perf.frame(1 / 60);
  perf.frame(1 / 60);
  assert.equal(markers, 2);
  measured = [1_000_000n, 5_000_000n];
  finish();
  await completed();
  assert.equal(perf.summary().gpuSamples, 1);
  assert.equal(perf.summary().gpuMs.median, 4);
  assert.equal(perf.summary().renderStats.calls, 8);

  perf.frame(1 / 60);
  measured = [0n, 0n];
  finish();
  await completed();
  assert.equal(perf.summary().gpuSamples, 1);

  perf.frame(1 / 60);
  perf.reset();
  measured = [1_000_000n, 6_000_000n];
  finish();
  await completed();
  assert.equal(perf.summary().frames, 0);
  assert.equal(perf.summary().gpuSamples, 0);
});
