#!/usr/bin/env node
// Zkouška webového exportu Godotu v Chromiu: načtení hry, postavení města, snímek a pohyb
// dotykovou páčkou jako na telefonu. Předpokládá export v godot/export/web
// (godot --headless --path godot --export-release "Web" export/web/index.html).
//
//   node tools/godot/zkouska_web.mjs [--snimky slozka] [--pocitac]
// V cloudovém prostředí nastav PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium.
//
// Bez --pocitac emuluje telefon na šířku s dotykovou obrazovkou.

import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = path.join(ROOT, 'godot/export/web');
const args = process.argv.slice(2);
const snimky = args.includes('--snimky') ? args[args.indexOf('--snimky') + 1] : null;
const pocitac = args.includes('--pocitac');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.pck': 'application/octet-stream',
  '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const file = path.join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(WEB)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

let chyby = 0;
const over = (ok, popis) => { console.log(`  ${ok ? '✓' : '✗'} ${popis}`); if (!ok) chyby++; };

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext(pocitac
  ? { viewport: { width: 1280, height: 720 } }
  : { viewport: { width: 915, height: 412 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
const log = [];
page.on('console', (m) => log.push(m.text()));
page.on('pageerror', (e) => log.push('CHYBA STRÁNKY: ' + e.message));
console.log(`— Načtení ${url} (${pocitac ? 'počítač' : 'telefon na šířku, dotyk'})`);
const t0 = Date.now();
await page.goto(url);
const stav = () => page.evaluate(() => window.__plzen ?? null);
let s = null;
while (Date.now() - t0 < 600000) {
  s = await stav();
  if (s && s.dlazdice >= 9) break;
  await page.waitForTimeout(2000);
}
over(Boolean(s), `hra se spustila za ${((Date.now() - t0) / 1000).toFixed(0)} s`);
over(s && s.dlazdice >= 9, `postaveno ${s?.dlazdice ?? 0} dlaždic`);
over(s && Math.hypot(s.x + 42, s.z - 52) < 5, `hráč stojí na náměstí Republiky (${s?.x?.toFixed(1)}, ${s?.z?.toFixed(1)})`);
if (!pocitac) over(s?.dotyk === true, 'hra rozpoznala dotykovou obrazovku');
if (snimky) {
  await mkdir(snimky, { recursive: true });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(snimky, pocitac ? 'web-pocitac.png' : 'web-telefon.png') });
}

if (!pocitac && s) {
  console.log('— Pohyb dotykovou páčkou');
  const cdp = await context.newCDPSession(page);
  const x0 = 140, y0 = 412 - 150;
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', x0, y0);
  for (let k = 1; k <= 10; k++) { await touch('touchMove', x0, y0 - k * 7); await page.waitForTimeout(30); }
  const pred = await stav();
  await page.waitForTimeout(6000);
  const po = await stav();
  await touch('touchEnd', x0, y0 - 70);
  const posun = Math.hypot(po.x - pred.x, po.z - pred.z);
  over(posun > 1.5, `hráč ušel ${posun.toFixed(1)} m`);
  if (snimky) await page.screenshot({ path: path.join(snimky, 'web-telefon-po-chuzi.png') });
}
const vazne = log.filter((l) => /CHYBA STRÁNKY|SCRIPT ERROR|ERROR:/.test(l));
over(vazne.length === 0, `bez chyb v konzoli${vazne.length ? ': ' + vazne.slice(0, 3).join(' | ') : ''}`);
await browser.close();
server.close();
console.log('VÝSLEDEK:', chyby ? `SELHALO (${chyby})` : 'PROŠLO');
process.exit(chyby ? 1 : 0);
