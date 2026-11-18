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

function gpuFrameTimer(device) {
  if (!device?.features.has('timestamp-query')) return null;
  const queries = device.createQuerySet({ type: 'timestamp', count: 2 });
  const timestamps = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const result = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const view = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT }).createView();

  // Změř interval ve frontě od prvního do posledního průchodu. Časy
  // vnořených průchodů ze three.js se přes sebe mohou překrývat.
  const marker = (index) => {
    const encoder = device.createCommandEncoder();
    encoder.beginRenderPass({
      colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store', clearValue: [index, 0, 0, 1] }],
      timestampWrites: { querySet: queries, endOfPassWriteIndex: index },
    }).end();
    if (index === 1) {
      encoder.resolveQuerySet(queries, 0, 2, timestamps, 0);
      encoder.copyBufferToBuffer(timestamps, 0, result, 0, 16);
    }
    device.queue.submit([encoder.finish()]);
  };

  return {
    start: () => marker(0),
    async finish() {
      marker(1);
      await result.mapAsync(GPUMapMode.READ);
      try {
        const [first, last] = new BigUint64Array(result.getMappedRange());
        return Number(last - first) / 1e6;
      } finally {
        result.unmap();
      }
    },
  };
}

export function createFrameProfiler(game, { sampleEvery = 1 } = {}) {
  const { renderer } = game;
  const { backend } = renderer;
  let timer = gpuFrameTimer(backend.isWebGPUBackend ? backend.device : null);
  backend.trackTimestamp = false;
  let resolving = false;
  let frameNumber = 0;
  let samples = [], first = 0, startedAt = null;

  async function measureGpu(sample) {
    resolving = true;
    try {
      const ms = await timer.finish();
      if (Number.isFinite(ms) && ms > 0) sample.gpuMs = ms;
    } catch (error) {
      timer = null;
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
    const timed = timer && !resolving && frameNumber++ % sampleEvery === 0;
    if (timed) timer.start();
    const renderStart = performance.now();
    game.render();
    const renderMs = performance.now() - renderStart;
    const sample = {
      at, updateMs: updatedAt - at, renderMs,
      gpuMs: null, ...readRenderStats(renderer),
    };
    if (timed) void measureGpu(sample);
    samples.push(sample);
    while (samples[first].at < at - WINDOW_MS) first++;
    if (first >= 1024) {
      samples = samples.slice(first);
      first = 0;
    }
  }

  function summary(windowMs = WINDOW_MS) {
    const last = samples.at(-1);
    const frames = samples.slice(first).filter((frame) => last.at - frame.at <= windowMs);
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
