// Měří běžnou smyčku hry v Chromiu. Jízda a let mají pevné výchozí body.
import { chromium } from '@playwright/test';

const url = new URL(process.argv[2] || 'http://127.0.0.1:4173/');
url.searchParams.set('debug', '');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
const report = { browser: browser.version(), viewport: '1920 × 1080', coldStartMs: [] };

try {
  for (const mode of ['car', 'heli', null]) {
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
      report[mode] = await page.evaluate(async (mode) => {
        const game = window.__game, world = game.world;
        if (mode === 'car') {
          const road = world.nearestRoad(90, 530, 70, 13, 0, {});
          const car = game.player.lastCar;
          car.place(road.x - road.dz * 1.8, road.z + road.dx * 1.8, Math.atan2(road.dx, road.dz));
          game._enterCar(car);
        } else {
          const heli = game.helis[3];
          heli.x = world.playMaxX - 900;
          heli.z = 0;
          heli.y = world.heightAt(heli.x, heli.z) + 90;
          heli.yaw = Math.PI / 2;
          heli.rotor = 30;
          game._enterHeli(heli);
        }

        const focus = game.focus;
        const start = [focus.x, focus.z];
        window.__setInput(0, mode === 'car' ? 0.55 : 1);
        const frames = [];
        let previous = await new Promise(requestAnimationFrame);
        const until = previous + 10_000;
        while (previous < until) {
          const now = await new Promise(requestAnimationFrame);
          frames.push(now - previous);
          previous = now;
        }
        window.__setInput(0, 0);
        const elapsed = frames.reduce((sum, value) => sum + value, 0);
        frames.sort((a, b) => a - b);
        return {
          metres: Math.round(Math.hypot(focus.x - start[0], focus.z - start[1])),
          fps: +(1000 * frames.length / elapsed).toFixed(1),
          p95FrameMs: +frames[Math.ceil(frames.length * 0.95) - 1].toFixed(1),
          maxFrameMs: +frames.at(-1).toFixed(1),
        };
      }, mode);
    }
    await context.close();
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
