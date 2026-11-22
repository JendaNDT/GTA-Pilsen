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

test('záložní WebGL započítá jen dokončený platný dotaz a uvolní jej i při přerušení', async t => {
  let nextFrame, disjoint = false, available = false;
  const deleted = [];
  const original = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = callback => { nextFrame = callback; };
  t.after(() => {
    if (original) globalThis.requestAnimationFrame = original;
    else delete globalThis.requestAnimationFrame;
  });
  const gl = {
    QUERY_RESULT_AVAILABLE: 1, QUERY_RESULT: 2,
    createQuery: () => ({}), beginQuery() {}, endQuery() {},
    isContextLost: () => false, getParameter: () => disjoint,
    getQueryParameter: (query, key) => key === 1 ? available : 2_500_000,
    deleteQuery: query => deleted.push(query),
  };
  const renderer = {
    backend: { gl, disjoint: { TIME_ELAPSED_EXT: 3, GPU_DISJOINT_EXT: 4 } },
    info: { render: {}, memory: {} }, getPixelRatio: () => 1, shadowMap: { enabled: false },
  };
  const perf = createFrameProfiler({ renderer, update() {}, render() {} });
  const poll = async () => { nextFrame(); await new Promise(resolve => setImmediate(resolve)); };
  perf.frame(1 / 60);
  await poll();
  assert.equal(perf.summary().gpuSamples, 0);
  available = true;
  await poll();
  assert.equal(perf.summary().gpuMs.median, 2.5);
  disjoint = true;
  perf.frame(1 / 60);
  await poll();
  assert.equal(perf.summary().gpuSamples, 1);
  assert.equal(new Set(deleted).size, 2);
});
