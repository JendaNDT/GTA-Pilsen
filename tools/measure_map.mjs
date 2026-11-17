// Měří běžnou smyčku hry v Chromiu. Jízda a let mají pevné výchozí body.
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const centerFlight = args.includes('--center-flight');
const release = args.includes('--release');
const pilot = release || centerFlight || args.includes('--pilot');
const url = new URL(args.find((arg) => !arg.startsWith('--')) || 'http://127.0.0.1:4173/');
url.searchParams.set('debug', '');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
const report = { browser: browser.version(), viewport: '1920 × 1080', pilot, centerFlight, coldStartMs: [] };
const scenarios = release ? [
  { name: 'car', mode: 'car', site: 'Plzeň' },
  { name: 'heli', mode: 'heli', site: 'Dobřív' },
  { name: 'carEast', mode: 'car', site: 'Hrádek' },
  { name: 'heliCenter', mode: 'heli', site: 'Plzeň' },
] : [{ name: 'car', mode: 'car' }, { name: 'heli', mode: 'heli', site: centerFlight ? 'Plzeň' : undefined }];
if (release) report.quality = url.searchParams.get('quality') ?? 'high';

try {
  for (const { name, mode, site } of [...scenarios, { mode: null }]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.addInitScript(() => {
      // Stejná posloupnost náhodných hodnot pro rozložení provozu a okolí.
      let state = 1729;
      Math.random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / (2 ** 32));
      function ready() {
        if (window.__ready) window.readyAt = performance.now();
        else requestAnimationFrame(ready);
      }
      requestAnimationFrame(ready);
    });
    await page.goto(url.href);
    await page.waitForFunction(() => window.readyAt, null, { timeout: 60_000 });
    const startup = await page.evaluate(() => {
      const gl = window.__game.renderer.getContext();
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      return { ms: Math.round(window.readyAt), gpu: gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) };
    });
    report.coldStartMs.push(startup.ms);
    report.gpu = startup.gpu;
    if (mode) {
      await page.getByRole('button', { name: 'Hrát', exact: true }).click();
      report[name] = await page.evaluate(async ({ mode, pilot, site }) => {
        const game = window.__game, world = game.world;
        if (mode === 'car') {
          const [x, z] = site === 'Hrádek' ? [19592, 4145] : pilot ? [45, -48] : [90, 530];
          const road = world.nearestRoad(x, z, 120, 13, 0, {});
          if (!road) throw new Error(`Chybí výchozí silnice u ${site ?? 'Plzně'}.`);
          const car = game.player.lastCar;
          car.place(road.x - road.dz * 1.8, road.z + road.dx * 1.8, Math.atan2(road.dx, road.dz));
          game._enterCar(car);
        } else {
          const centerFlight = site === 'Plzeň';
          const heli = game.helis[3];
          heli.x = centerFlight ? -325 : pilot ? 22495 : world.playMaxX - 900;
          heli.z = centerFlight ? 162 : pilot ? 3101 : 0;
          heli.y = world.heightAt(heli.x, heli.z) + (centerFlight ? 70 : pilot ? 45 : 90);
          heli.yaw = Math.PI / 2;
          heli.rotor = 30;
          game._enterHeli(heli);
        }

        const focus = game.focus;
        if (pilot) {
          // Po přesunu v debug režimu nech vykreslit výchozí oblast, stejně jako při vstupu do hry.
          window.__freeze(true);
          window.__setInput(0, 0);
          for (let i = 0; i < 5; i++) game.chunks.update(focus.x, focus.z, game.camera.far / 1.35, 180);
          window.__step(1 / 60);
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          window.__freeze(false);
        }
        const start = [focus.x, focus.z];
        window.__setInput(0, mode === 'car' ? (pilot ? 0.27 : 0.55) : 1);
        const frames = [], chunks = new Set([world.chunkIndex(...start)]);
        const ahead = {};
        let maxPending = 0;
        let previous = await new Promise(requestAnimationFrame);
        const until = previous + 10_000;
        while (previous < until) {
          const now = await new Promise(requestAnimationFrame);
          frames.push(now - previous);
          chunks.add(world.chunkIndex(focus.x, focus.z));
          maxPending = Math.max(maxPending, game.chunks.pending);
          if (pilot && mode === 'car') {
            const x = focus.x + Math.sin(focus.yaw) * 7, z = focus.z + Math.cos(focus.yaw) * 7;
            const rd = world.nearestRoad(x, z, 8, 13, 0, ahead);
            if (rd) {
              const yaw = Math.atan2(rd.x - rd.dz * 1.3 - focus.x, rd.z + rd.dx * 1.3 - focus.z);
              const angle = Math.atan2(Math.sin(focus.yaw - yaw), Math.cos(focus.yaw - yaw));
              window.__setInput(Math.max(-0.48, Math.min(0.48, angle * 1.5)), 0.27);
            }
          }
          previous = now;
        }
        window.__setInput(0, 0);
        const elapsed = frames.reduce((sum, value) => sum + value, 0);
        frames.sort((a, b) => a - b);
        return {
          metres: Math.round(Math.hypot(focus.x - start[0], focus.z - start[1])),
          start: start.map(Math.round), end: [Math.round(focus.x), Math.round(focus.z)],
          chunks: chunks.size, maxPending, shadowEnabled: game.env.sun.castShadow,
          drawingBuffer: [game.renderer.domElement.width, game.renderer.domElement.height],
          cityTiles: [...game.chunks.chunks.values()].filter((c) => c.heritage?.city).length,
          fps: +(1000 * frames.length / elapsed).toFixed(1),
          p95FrameMs: +frames[Math.ceil(frames.length * 0.95) - 1].toFixed(1),
          maxFrameMs: +frames.at(-1).toFixed(1),
          framesOver50Ms: frames.filter((value) => value > 50).length,
        };
      }, { mode, pilot, site });
      if (site) report[name].site = site;
    }
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
  if (release && (report.carEast.metres < 25 || report.heliCenter.chunks < 2 || !report.heliCenter.cityTiles)) process.exitCode = 1;
  if (pilot && ([report.car, report.heli].some(({ chunks }) => chunks < 2) || !report.car.cityTiles
      || centerFlight && !report.heli.cityTiles)) process.exitCode = 1;
} finally {
  await browser.close();
}
