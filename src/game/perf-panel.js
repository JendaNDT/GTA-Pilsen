const number = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });

function formatTimes(label, times) {
  if (!times) return `${label} — nedostupné`;
  return `${label} — ${[times.median, times.p95, times.p99].map((n) => number.format(n)).join(' / ')} ms`;
}

export function initPerfPanel(perf, canOpen) {
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'perf-toggle';
  toggle.textContent = 'Měření';
  toggle.title = 'Měření výkonu (F9)';
  toggle.setAttribute('aria-controls', 'perf-panel');
  toggle.setAttribute('aria-expanded', 'false');
  document.getElementById('topleft').append(toggle);

  const panel = document.createElement('section');
  panel.id = 'perf-panel';
  panel.className = 'hidden';
  panel.setAttribute('aria-label', 'Měření výkonu');
  panel.innerHTML = `
    <p id="perf-progress"></p>
    <textarea rows="6" readonly aria-label="Výsledky měření výkonu"></textarea>
    <button type="button" data-perf-reset>Začít znovu</button>
    <button type="button" data-perf-close>Zavřít měření</button>
  `;
  document.getElementById('hud').append(panel);
  const progress = panel.querySelector('#perf-progress');
  const output = panel.querySelector('textarea');
  let timer;

  function showResults() {
    const { frames, durationMs, workMs, updateMs, renderMs, gpuMs, gpuSamples,
      pixelRatio, shadows, renderStats } = perf.summary();
    const seconds = Math.floor(durationMs / 1000);
    progress.textContent = seconds < 60 ? `Změřeno ${seconds} z 60 sekund` : 'Výsledek za posledních 60 sekund';
    // Během označování výsledku uživateli neměň vybraný text.
    if (document.activeElement === output) return;
    output.value = [
      `${frames} snímků za ${seconds} s · medián / p95 / p99`,
      formatTimes('Práce snímku', workMs),
      formatTimes('Výpočet hry', updateMs),
      formatTimes('Příprava vykreslení', renderMs),
      formatTimes(gpuSamples ? `GPU (${gpuSamples} vzorků)` : 'GPU', gpuMs),
      `Měřítko obrazu ${number.format(pixelRatio)} · stíny ${shadows ? 'zapnuté' : 'vypnuté'}`,
      ...(renderStats ? [
        `Volání ${renderStats.calls} · trojúhelníky ${renderStats.triangles}`,
        `Geometrie ${renderStats.geometries} · textury ${renderStats.textures}`,
      ] : []),
    ].join('\n');
  }

  function close() {
    clearInterval(timer);
    panel.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (!panel.classList.contains('hidden')) {
      close();
    } else if (canOpen()) {
      panel.classList.remove('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      showResults();
      timer = setInterval(showResults, 1000);
    }
  }

  toggle.addEventListener('click', togglePanel);
  panel.querySelector('[data-perf-close]').addEventListener('click', () => {
    close();
    toggle.focus();
  });
  panel.querySelector('[data-perf-reset]').addEventListener('click', () => {
    perf.reset();
    showResults();
  });
  addEventListener('keydown', (event) => {
    if (event.code === 'F9' && !event.repeat && canOpen()) {
      event.preventDefault();
      togglePanel();
    }
  });
  return { close };
}
