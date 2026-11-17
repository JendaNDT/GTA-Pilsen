// Stejné kamery a příprava okolí pro snímky i test rozpočtu.
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

export const reference = JSON.parse(await readFile(new URL('./reference-views.json', import.meta.url), 'utf8'));

export async function openReferenceGame(page, address) {
  const url = new URL(address);
  for (const [key, value] of Object.entries({ debug: '', adapt: '0', quality: 'high', date: reference.date, hour: '10' })) {
    url.searchParams.set(key, value);
  }
  await page.addInitScript(() => {
    let seed = 1729;
    Math.random = () => ((seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32);
  });
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
}

export async function renderReferenceView(page, view) {
  return page.evaluate(async ({ view, date }) => {
    const game = window.__game;
    const { chunks } = game;
    const [x, z] = view.focus;
    game.player.place(x, z);
    window.__setClock(date, view.hour);
    const deadline = performance.now() + 45_000;
    for (;;) {
      const built = chunks.update(x, z, game.camera.far / 1.35, 40, view.camera[1]);
      const orthophoto = chunks.orthophoto;
      const waitingForImages = orthophoto?.requests || orthophoto?.cache.size &&
        [...chunks.chunks.values()].some((tile) => tile.tex && tile.orthoTile &&
          (orthophoto.cache.get(tile.orthoTile.key) ?? null) !== tile.orthoBitmap);
      if (!built && !chunks.pending && !chunks.heritage.fetching && !waitingForImages) break;
      if (performance.now() > deadline) throw new Error(`${view.name}: okolí se nestihlo dostavět.`);
      await new Promise(requestAnimationFrame);
    }
    const missing = [...chunks.chunks.values()].find((tile) => tile.cityRequest && !tile.heritage?.city);
    if (missing) throw new Error(`${view.name}: chybí dlaždice měřených budov ${missing.ci}.`);
    window.__view(...view.camera, ...view.target);
    return window.__perf.renderStats();
  }, { view, date: reference.date });
}

async function capture(address, output) {
  const browser = await chromium.launch({
    channel: 'chromium',
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
  try {
    const page = await browser.newPage({ viewport: reference.viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await openReferenceGame(page, address);
    const backend = await page.evaluate(() => window.__game.renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2');
    console.log(`Vykreslování ${backend}`);
    await page.addStyleTag({ content: '#menu, #hud { visibility: hidden }' });
    await mkdir(output, { recursive: true });
    for (const view of reference.views) {
      const { calls, triangles } = await renderReferenceView(page, view);
      const path = join(output, `${view.id}.jpg`);
      const jpeg = await page.screenshot({ path, type: 'jpeg', quality: 85 });
      if (jpeg.length > 250_000) throw new Error(`${path} překračuje limit 250 kB.`);
      console.log(`${path} (${jpeg.length} B) · ${calls} volání · ${triangles} trojúhelníků`);
    }
    if (errors.length) throw new Error(errors.join('\n'));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [, , address = 'http://127.0.0.1:4173/', output = 'docs/E13/reference'] = process.argv;
  await capture(address, output);
}
