// Porovná skutečný přenos dvou sestavených vydání do prvního zobrazení nabídky.
import { resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const directories = process.argv.slice(2);
if (directories.length !== 2) throw new Error('Zadej adresář sestavení E12 a adresář nového sestavení.');
const browser = await chromium.launch();
async function measure(directory) {
  const server = await preview({ configFile: false, build: { outDir: resolve(directory) },
    preview: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/?debug&adapt=0&quality=low&renderer=webgl');
    await page.waitForFunction(() => window.__ready, null, { timeout: 120_000 });
    return await page.evaluate(() => {
      const requests = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')]
        .map((item) => ({ path: new URL(item.name).pathname, bytes: item.encodedBodySize }));
      const sum = (items) => items.reduce((total, item) => total + item.bytes, 0);
      const core = requests.filter(({ path }) => path === '/' || path.startsWith('/assets/') || path.startsWith('/data/') || path.endsWith('/index.json'));
      return { bytes: sum(requests), coreBytes: sum(core), requests };
    });
  } finally {
    await context.close();
    await server.close();
  }
}
try {
  const baseline = await measure(directories[0]);
  const candidate = await measure(directories[1]);
  console.log(JSON.stringify({ baseline, candidate, difference: candidate.bytes - baseline.bytes, coreDifference: candidate.coreBytes - baseline.coreBytes }, null, 2));
} finally {
  await browser.close();
}
