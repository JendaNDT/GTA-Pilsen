// Porovná přenos a čekání na ovládání nad dvěma sestaveními na témže stroji.
import { resolve } from 'node:path';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const directories = args.filter(arg => !arg.startsWith('--'));
if (directories.length !== 2) throw new Error('Zadej adresář původního a nového sestavení.');
const browser = await chromium.launch({ channel: 'chromium' });

async function measure(directory, limited) {
  const server = await preview({ configFile: false, build: { outDir: resolve(directory) },
    preview: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
  try {
    const page = await context.newPage();
    const url = 'http://127.0.0.1:' + server.httpServer.address().port + '/?debug&adapt=0&quality=low&renderer=webgl&weather=clear';
    if (limited) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline:false, latency:60,
        downloadThroughput:1_250_000, uploadThroughput:600_000 });
    }
    const runs = [];
    for (const cache of ['studená', 'zahřátá']) {
      await page.goto(url);
      await page.waitForFunction(() => window.__ready, null, { timeout:180_000 });
      const info = await page.evaluate(() => {
        const entries = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')];
        const requests = entries.map(item => ({ path:new URL(item.name).pathname, bytes:item.encodedBodySize, transfer:item.transferSize }));
        const sum = (items, key) => items.reduce((n,item) => n+item[key],0);
        const core = requests.filter(({path}) => path === '/' || path.startsWith('/assets/') || path.startsWith('/data/') || path.endsWith('/index.json'));
        return { menuMs: Math.round(performance.now()), bytes:sum(requests,'bytes'), coreBytes:sum(core,'bytes'),
          transferBytes:sum(requests,'transfer'), requests };
      });
      await page.locator('#btn-play').click();
      await page.waitForFunction(() => !window.__game.paused && document.getElementById('menu').classList.contains('hidden'));
      const controllableMs = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(Math.round(performance.now())))));
      runs.push({cache,...info,controllableMs});
    }
    return {...runs[0],warm:runs[1]};
  } finally {
    await context.close();
    await server.close();
  }
}

try {
  const limited = args.includes('--limited');
  const baseline = await measure(directories[0],limited);
  const candidate = await measure(directories[1],limited);
  console.log(JSON.stringify({ limited, baseline, candidate, difference:candidate.bytes-baseline.bytes,
    coreDifference:candidate.coreBytes-baseline.coreBytes },null,2));
} finally {
  await browser.close();
}
