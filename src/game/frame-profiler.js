const WINDOW_MS = 60_000;

export function readRenderStats(renderer) {
  const { render, memory } = renderer.info;
  return {
    calls: render.drawCalls, triangles: render.triangles,
    geometries: memory.geometries, textures: memory.textures,
  };
}

function percentiles(values) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const at = (p) => values[Math.ceil(values.length * p) - 1];
  return { median: at(0.5), p95: at(0.95), p99: at(0.99) };
}

export function createFrameProfiler(game) {
  const { renderer } = game;
  const { backend } = renderer;
  let trackGpu = backend.trackTimestamp && backend.hasTimestamp;
  let resolving = false;
  let samples = [], first = 0, startedAt = null;

  async function measureGpu(sample, frameId) {
    resolving = true;
    try {
      const ms = await renderer.resolveTimestampsAsync('render');
      // Při chybě vrací knihovna poslední platný čas. Ten nesmí skončit u jiného snímku.
      if (backend.getTimestampFrames('render').at(-1) === frameId && Number.isFinite(ms) && ms > 0) {
        sample.gpuMs = ms;
      }
    } catch (error) {
      trackGpu = false;
      console.warn('Čas GPU se nepodařilo změřit.', error);
    } finally {
      resolving = false;
    }
  }

  function frame(dt) {
    const at = performance.now();
    startedAt ??= at;
    game.update(dt);
    const updatedAt = performance.now();
    const renderStart = performance.now();
    game.render();
    const renderMs = performance.now() - renderStart;
    const sample = {
      at, updateMs: updatedAt - at, renderMs,
      gpuMs: null, ...readRenderStats(renderer),
    };
    if (trackGpu && !resolving) void measureGpu(sample, renderer.info.frame);
    samples.push(sample);
    while (samples[first].at < at - WINDOW_MS) first++;
    if (first >= 1024) {
      samples = samples.slice(first);
      first = 0;
    }
  }

  function summary() {
    const frames = samples.slice(first);
    const last = frames.at(-1);
    const gpu = frames.flatMap((frame) => frame.gpuMs === null ? [] : [frame.gpuMs]);
    return {
      durationMs: last ? Math.min(WINDOW_MS, last.at - startedAt) : 0,
      frames: frames.length,
      updateMs: percentiles(frames.map((f) => f.updateMs)),
      renderMs: percentiles(frames.map((f) => f.renderMs)),
      workMs: percentiles(frames.map((f) => f.updateMs + f.renderMs)),
      gpuMs: percentiles(gpu),
      gpuSamples: gpu.length,
      renderStats: last
        ? { calls: last.calls, triangles: last.triangles, geometries: last.geometries, textures: last.textures }
        : null,
      pixelRatio: renderer.getPixelRatio(),
      shadows: renderer.shadowMap.enabled && game.env.sun.castShadow,
    };
  }

  function reset() {
    samples = [];
    first = 0;
    startedAt = null;
  }

  return { frame, summary, reset, renderStats: () => readRenderStats(renderer) };
}
