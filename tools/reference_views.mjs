// Stejné kamery a příprava okolí pro snímky i test rozpočtu.
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { webgpuFlags } from '../tests/e2e/browser-flags.js';
import { saveStructurePhoto } from '../tests/e2e/structure-photo.js';

export const reference = JSON.parse(await readFile(new URL('./reference-views.json', import.meta.url), 'utf8'));

export async function openReferenceGame(page, address) {
  const url = new URL(address);
  const quality = url.searchParams.get('quality') ?? 'high';
  for (const [key, value] of Object.entries({ debug: '', adapt: '0', quality, date: reference.date, hour: '10' })) {
    url.searchParams.set(key, value);
  }
  if (!url.searchParams.has('seed')) url.searchParams.set('seed', 1729);
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready);
}

export async function renderReferenceView(page, view) {
  return page.evaluate(async ({ view, date }) => {
    const game = window.__game;
    const { chunks } = game;
    const [x, z] = view.focus;
    game.player.place(x, z);
    window.__setClock(date, view.hour);
    let lastProgress = performance.now(), previousState;
    for (;;) {
      const built = chunks.update(x, z, game.camera.far / 1.35, 40, view.camera[1]);
      if (!built && !chunks.pending && !chunks.heritage.fetching && !chunks.orthophotoPending && !game.world?.structures?.loading) break;
      const now = performance.now();
      // Ortofoto se překresluje po jedné dlaždici i potom, co je hotová geometrie.
      const ortho = chunks.orthophoto;
      let unpainted = 0;
      if (ortho && chunks.orthophotoPending) for (const ch of chunks.chunks.values()) {
        if (ch.tex && ch.orthoTile && (ortho.cache.get(ch.orthoTile.key) ?? null) !== ch.orthoBitmap) unpainted++;
      }
      const state = [chunks.pending, chunks.heritage.fetching, ortho?.revision, ortho?.requests, unpainted, game.world?.structures?.loading].join('/');
      if (built || state !== previousState) lastProgress = now;
      previousState = state;
      if (now - lastProgress > 45_000) {
        throw new Error(`${view.name}: okolí se nestihlo dostavět (zbývá ${chunks.pending} kroků, ` +
          `budovy ${chunks.heritage.fetching}, ortofoto ${Boolean(chunks.orthophotoPending)}, nezakresleno ${unpainted}).`);
      }
      // Příprava geometrie a síťové požadavky pokračují i mezi snímky vykreslovače.
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const missing = [...chunks.chunks.values()].find((tile) => tile.cityRequest && !tile.heritage?.city);
    if (missing) throw new Error(`${view.name}: chybí dlaždice měřených budov ${missing.ci}.`);
    window.__view(...view.camera, ...view.target);
    // V režimu zastaveného času musí snímek dokončit rozpracované světlo z oblohy.
    if (game.env.skyLight?.face >= 0) {
      for (let i = 0; i < 6 && game.env.skyLight.face >= 0; i++) {
        await new Promise(requestAnimationFrame);
        // Pootočení sondy potřebuje pouze oblohu. Město se vykreslí až s dokončenou mapou.
        game.env.updateSkyLight();
      }
      // Odečti ustálený pohled po dokončení aktualizace světla.
      game.render();
    }
    return window.__perf.renderStats();
  }, { view, date: reference.date });
}

async function capture(address, output, flags) {
  const software = flags.includes('--software-webgpu');
  const browser = await chromium.launch({
    channel: 'chromium',
    ...(software && { args: webgpuFlags }),
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  try {
    const page = await browser.newPage({ viewport: reference.viewport, deviceScaleFactor: 1 });
    page.setDefaultTimeout(software ? 600_000 : 90_000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openReferenceGame(page, address);
    if (flags.includes('--vzdy-jasno')) await page.evaluate(() => window.__game.setWeatherMode('clear'));
    const useTexture = await page.evaluate(() => Boolean(window.__game.postfx?.scenePass?.renderTarget));
    const backend = await page.evaluate(() => window.__game.renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2');
    console.log(`Vykreslování ${backend}`);
    await page.addStyleTag({ content: '#menu, #hud { visibility: hidden }' });
    await mkdir(output, { recursive: true });
    for (const view of reference.views) {
      const { calls, triangles } = await renderReferenceView(page, view);
      const path = join(output, `${view.id}.jpg`);
      const bytes = useTexture ? await saveStructurePhoto(page, path)
        : (await page.screenshot({ path, type: 'jpeg', quality: 85 })).length;
      if (bytes > 250_000) throw new Error(`${path} překračuje limit 250 kB.`);
      console.log(`${path} (${bytes} B) · ${calls} volání · ${triangles} trojúhelníků`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [, , address = 'http://127.0.0.1:4173/', output = 'docs/E13/reference', ...flags] = process.argv;
  await capture(address, output, flags);
}
