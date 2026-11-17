import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrameProfiler } from '../src/game/frame-profiler.js';

test('měření práce snímku přiřadí jen skutečně dokončený vzorek GPU', async () => {
  let finish, measured;
  const renderer = {
    backend: {
      trackTimestamp: true, hasTimestamp: true,
      getTimestampFrames: () => measured,
    },
    info: {
      frame: 0,
      render: { calls: 25, drawCalls: 8, triangles: 36 },
      memory: { geometries: 4, textures: 2 },
    },
    shadowMap: { enabled: true },
    getPixelRatio: () => 1,
    resolveTimestampsAsync: () => new Promise((resolve) => { finish = resolve; }),
  };
  const game = {
    renderer, env: { sun: { castShadow: true } },
    update() {}, render() { renderer.info.frame++; },
  };
  const perf = createFrameProfiler(game);
  perf.frame(1 / 60);
  perf.frame(1 / 60);
  measured = [1];
  finish(4);
  await Promise.resolve();
  assert.equal(perf.summary().gpuSamples, 1);
  assert.equal(perf.summary().gpuMs.median, 4);
  assert.equal(perf.summary().renderStats.calls, 8);

  perf.frame(1 / 60);
  finish(4); // Knihovna při nedostupném měření vrátila minulý výsledek.
  await Promise.resolve();
  assert.equal(perf.summary().gpuSamples, 1);

  perf.frame(1 / 60);
  perf.reset();
  measured = [4];
  finish(5);
  await Promise.resolve();
  assert.equal(perf.summary().frames, 0);
  assert.equal(perf.summary().gpuSamples, 0);
});
