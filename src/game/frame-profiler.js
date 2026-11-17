const WINDOW_MS = 60_000;
const MAX_GPU_QUERIES = 8;

export function readRenderStats(renderer) {
  const { render, memory } = renderer.info;
  return {
    calls: render.calls, triangles: render.triangles,
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
  const gl = renderer.getContext();
  const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending = [];
  let samples = [], first = 0, startedAt = null;

  function clearQueries() {
    for (const { query } of pending) gl.deleteQuery(query);
    pending.length = 0;
  }

  function pollGpu() {
    if (!extension || !pending.length) return;
    if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
      clearQueries();
      return;
    }
    while (pending.length && gl.getQueryParameter(pending[0].query, gl.QUERY_RESULT_AVAILABLE)) {
      const { query, sample } = pending.shift();
      sample.gpuMs = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(query);
    }
  }

  function frame(dt) {
    pollGpu();
    const at = performance.now();
    startedAt ??= at;
    game.update(dt);
    const updatedAt = performance.now();
    const query = extension && pending.length < MAX_GPU_QUERIES ? gl.createQuery() : null;
    if (query) gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
    const renderStart = performance.now();
    let renderMs;
    try {
      game.render();
      renderMs = performance.now() - renderStart;
    } finally {
      if (query) gl.endQuery(extension.TIME_ELAPSED_EXT);
    }
    const sample = {
      at, updateMs: updatedAt - at, renderMs,
      gpuMs: null, ...readRenderStats(renderer),
    };
    if (query) pending.push({ query, sample });
    samples.push(sample);
    while (samples[first].at < at - WINDOW_MS) first++;
    if (first >= 1024) {
      samples = samples.slice(first);
      first = 0;
    }
  }

  function summary() {
    pollGpu();
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
    clearQueries();
    samples = [];
    first = 0;
    startedAt = null;
  }

  return { frame, summary, reset, renderStats: () => readRenderStats(renderer) };
}
