import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const output = process.argv[2];
if (!output) throw new Error('Použití: node tools/audit_landscape.mjs VÝSTUP [ADRESA_HRY]');
const url = new URL(process.argv[3] || 'http://127.0.0.1:4175/');
url.searchParams.set('debug', '');
url.searchParams.set('view', '960');
await mkdir(output, { recursive: true });

// Stejné body, kamera a denní doba pro základní a upravenou mapu.
const views = [
  ['zapad-pole', -6540, 3010, -280, 200, -170],
  ['sever-tremosna', 1360, -7550, 200, 235, 290],
  ['sever-chrast', 8370, -4870, -140, 210, -300],
  ['bolevecke-rybniky', 835, -3640, 140, 180, -230],
  ['stred-plzen', 30, 105, -165, 220, 140],
  ['jih-valik', 2200, 7540, -260, 220, 160],
  ['jih-vychod', 17700, 7400, -270, 265, -120],
  ['vychodni-okraj', 23200, -6000, 230, 260, -160],
  ['klabava-udoli', 11645, -690, -150, 145, 190],
  ['rokycany-centrum', 15634, 520, 92, 92, 95],
  ['hradek-udoli', 19590, 4115, -170, 134, 180],
  ['dobriv-hamr', 22660, 3104, -26, 12, 27],
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    let seed = 1729;
    Math.random = () => (seed = (Math.imul(1664525, seed) + 1013904223) >>> 0) / 2 ** 32;
  });
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
  await page.addStyleTag({ content: '#hud,#toast {visibility:hidden}' });
  const roads = await page.evaluate(() => {
    const { world } = window.__game;
    let maxChange = 0;
    for (let i = 0; i < world.rpx.length; i++) {
      const x = world.rpx[i], z = world.rpz[i];
      maxChange = Math.max(maxChange, Math.abs(world.heightAt(x, z) - (world.baseHeightAt?.(x, z) ?? world.heightAt(x, z))));
    }
    return { vertices: world.rpx.length, maxChange };
  });
  const report = {};
  for (const [name, x, z, dx, dy, dz] of views) {
    report[name] = await page.evaluate(async ({ x, z, dx, dy, dz }) => {
      const game = window.__game, world = game.world;
      game.setClock('2026-11-09', 13.5);
      game.player.place(x, z);
      const y = world.heightAt(x, z);
      const base = world.baseHeightAt?.(x, z) ?? y;
      for (let i = 0; i < 8; i++) {
        game.chunks.update(x, z, 960, 100, base + dy);
        await new Promise(requestAnimationFrame);
      }
      window.__view(x + dx, base + dy, z + dz, x, base + 0.8, z);
      const chunk = game.chunks.chunks.get(world.chunkIndex(x, z));
      return { x, z, elevation: +(y + world.baseElevation).toFixed(2), stage: chunk?.stage,
        triangles: game.renderer.info.render.triangles,
        detailTiles: [...game.chunks.chunks.keys()].filter((id) => world.terrainDetail?.has(id)).length };
    }, { x, z, dx, dy, dz });
    await page.screenshot({ path: join(output, `${name}.png`) });
  }
  await writeFile(join(output, 'mereni.json'), JSON.stringify({ browser: browser.version(), roads, report, errors }, null, 2) + '\n');
  if (errors.length || roads.maxChange > 0.05 || Object.values(report).some((view) => view.stage !== 4)) process.exitCode = 1;
} finally {
  await browser.close();
}
