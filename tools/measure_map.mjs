// Měří běžnou smyčku hry v Chromiu. Jízda a let mají pevné výchozí body.
import { CABIN_SERVICES, PILOT_TRIP } from '../src/game/tram-cabin.js';
import { frameBudgets } from '../src/game/frame-budget.js';
import { chromium } from '@playwright/test';
import { webgpuFlags } from '../tests/e2e/browser-flags.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const centerFlight = args.includes('--center-flight');
const release = args.includes('--release');
const rush = args.includes('--rush');
const cabinArg = args.find(arg => arg.startsWith('--cabin-trip='));
const cabin = !!cabinArg || args.includes('--tram-cabin');
const cabinTrip = cabinArg?.slice('--cabin-trip='.length) ??
  args.find(arg => arg.startsWith('--tram-trip='))?.slice('--tram-trip='.length) ?? PILOT_TRIP;
const service = CABIN_SERVICES.find(item => item.trip === cabinTrip);
if (cabin && !service) throw new Error('Neznámý průchozí spoj ' + cabinTrip);
const work = cabin || rush || args.includes('--work');
const pilot = !cabin && !rush && (release || centerFlight || args.includes('--pilot'));
if (cabin && (rush || release)) throw new Error('Jízdu v MHD měř samostatně.');
if (rush && release) throw new Error('Špičku a vydání měř samostatně.');
const url = new URL(args.find((arg) => !arg.startsWith('--')) || 'http://127.0.0.1:4173/');
url.searchParams.set('debug', '');
if (work) {
  url.searchParams.set('adapt', args.includes('--adaptive') ? '1' : '0');
  if (rush) url.searchParams.set('quality', 'high');
  if (!url.searchParams.has('date')) url.searchParams.set('date', rush || cabin ? '2026-11-09' : '2026-11-17');
  if (!url.searchParams.has('hour')) url.searchParams.set('hour', rush ? '7.5' : '10');
}
const workFlags = args.includes('--paced') ? [] : ['--disable-gpu-vsync', '--disable-frame-rate-limit'];
if (args.includes('--software-webgpu')) workFlags.push(...webgpuFlags);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  // Plná verze Chromia může používat skutečný GPU i bez viditelného okna.
  ...(work && { channel: 'chromium', args: workFlags }),
});
const report = { browser: browser.version(), viewport: '1920 × 1080', pilot, centerFlight, coldStartMs: [] };
const scenarios = cabin ? [{ name: service.type, mode: 'cabin' }] : rush ? [{ name: 'rush', mode: 'traffic', site: 'Klatovská třída' }] : release ? [
  { name: 'car', mode: 'car', site: 'Plzeň' },
  { name: 'heli', mode: 'heli', site: 'Dobřív' },
  { name: 'carEast', mode: 'car', site: 'Hrádek' },
  { name: 'heliCenter', mode: 'heli', site: 'Plzeň' },
] : [{ name: 'car', mode: 'car' }, { name: 'heli', mode: 'heli', site: centerFlight ? 'Plzeň' : undefined }];
if (cabin) report.trip = cabinTrip;
if (release || work) report.quality = url.searchParams.get('quality') ?? 'high';
if (work) {
  report.work = { date: url.searchParams.get('date'), hour: +url.searchParams.get('hour'),
    adaptive: url.searchParams.get('adapt') !== '0', durationMs: 10_000, chromiumFlags: workFlags };
}

try {
  const session = await browser.newBrowserCDPSession();
  const { gpu } = await session.send('SystemInfo.getInfo');
  await session.detach();
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
    // I pomalý první start je výsledek měření. Doba přípravy nepatří do desetisekundového vzorku jízdy.
    await page.waitForFunction(() => window.readyAt, null, { timeout: 300_000 });
    const startup = await page.evaluate(async () => {
      const webgpu = window.__game.renderer.backend?.isWebGPUBackend === true;
      const adapter = webgpu ? await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }) : null;
      const info = adapter?.info;
      const label = info?.description || [info?.vendor, info?.architecture].filter(Boolean).join(' / ');
      return { ms: Math.round(window.readyAt), renderer: webgpu ? 'WebGPU' : 'WebGL 2', adapter: label || null };
    });
    report.coldStartMs.push(startup.ms);
    report.renderer = startup.renderer;
    report.gpu = startup.adapter || gpu.auxAttributes?.glRenderer || null;
    if (mode) {
      await page.getByRole('button', { name: 'Hrát', exact: true }).click();
      report[name] = await page.evaluate(async ({ mode, pilot, site, work, pilotTrip }) => {
        const game = window.__game, world = game.world;
        if (mode === 'cabin') {
          window.__freeze(true);
          const error = game.startCabinRide(pilotTrip);
          if (error || !game.cabin) throw new Error(error || 'Při měření chybí cestující v interiéru.');
          const v = game.ride;
          site = v.stopTarget[1];
          for (let i = 0; i < 1800 && v.v < 1; i++) game.update(1 / 60);
          if (v.v < 1) throw new Error('Měření vyžaduje jedoucí vůz.');
        } else if (mode === 'traffic') {
          window.__freeze(true);
          const [edge] = [...game.trafficRhythm.measured].find(([, entry]) =>
            entry.curve.id === 'klatovska-jih' && entry.distance === 0);
          const p = world.edgePoint(edge, 58, 0, {});
          game.player.place(p.x - p.tz * 10, p.z + p.tx * 10);
        } else if (mode === 'car') {
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
        if (work) {
          window.__freeze(true);
          window.__setInput(0, 0);
          let previousState, lastProgress = performance.now();
          let built;
          do {
            built = game.chunks.update(focus.x, focus.z, game.camera.far / 1.35, 40, focus.y);
            const state = [game.chunks.pending, game.chunks.heritage.fetching, game.chunks.orthophoto?.revision,
              game.chunks.orthophoto?.requests, game.chunks.orthophotoPending, game.world.structures?.loading].join('/');
            if (built || state !== previousState) lastProgress = performance.now();
            previousState = state;
            if (performance.now() - lastProgress > 90_000) throw new Error('Stavba okolí měření se zastavila: ' + state);
            // Příprava dlaždic nepotřebuje pro každý krok vykreslit město ve Full HD.
            await new Promise(resolve => setTimeout(resolve, 0));
          } while (built || game.chunks.pending || game.chunks.heritage.fetching || game.chunks.orthophotoPending || game.world.structures?.loading);
          window.__step(1 / 60);
          if (mode === 'traffic') {
            // Po načtení okolí necháme přijet běžný ranní provoz. Měření začne při plném počtu aut.
            for (let i = 0; i < 10 * 60 * 30 && game.trafficBodies.dynamic.size < 40; i++) {
              game.update(1 / 30);
              if ((i + 1) % 300 === 0) await new Promise(requestAnimationFrame);
            }
            if (game.trafficBodies.dynamic.size !== 40) throw new Error('Na Klatovské se během deseti herních minut nesešlo 40 fyzikálních aut.');
          }
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          window.__freeze(false);
        } else if (pilot) {
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
        // Na stejné trase musí pilot i s převodovkou Jolt projet do další dlaždice.
        const pedal = game.driver ? 0.38 : 0.27;
        window.__setInput(0, mode === 'traffic' || mode === 'cabin' ? 0 : mode === 'car' ? (pilot ? pedal : 0.55) : 1);
        const physicsTimes = [];
        const obstacleSearch = { calls:0, candidates:0, ms:0 };
        const vehicles = game.vehicles, originalLimit = vehicles._obstacleLimit;
        if (mode === 'traffic') vehicles._obstacleLimit = function(car,limit,ignore,pointAt) {
          const start = performance.now();
          const result = originalLimit.call(this,car,limit,ignore,pointAt);
          obstacleSearch.ms += performance.now() - start;
          obstacleSearch.calls++;
          obstacleSearch.candidates += this.cars.length - 1 + this.obstacles.length -
            Number(ignore && (this.cars.includes(ignore) || this.obstacles.includes(ignore)) || false);
          return result;
        };
        let peakCars = 0, peakDriven = 0;
        const physics = game.physics;
        const originalStep = physics?.step;
        if (work && physics) physics.step = (dt) => {
          const start = performance.now();
          originalStep(dt);
          physicsTimes.push(performance.now() - start);
        };
        const frames = [], chunks = new Set([world.chunkIndex(...start)]);
        const ahead = {};
        let maxPending = 0;
        let previous = await new Promise(requestAnimationFrame);
        if (work) window.__perf.reset();
        const until = previous + 10_000;
        while (previous < until) {
          const now = await new Promise(requestAnimationFrame);
          frames.push(now - previous);
          chunks.add(world.chunkIndex(focus.x, focus.z));
          maxPending = Math.max(maxPending, game.chunks.pending);
          if (mode === 'traffic') {
            peakCars = Math.max(peakCars, game.trafficBodies.dynamic.size);
            let driven = 0;
            for (const c of game.trafficBodies.dynamic.keys()) if (c.mode === 'ai' || c.mode === 'police') driven++;
            peakDriven = Math.max(peakDriven, driven);
          }
          if (pilot && mode === 'car') {
            const x = focus.x + Math.sin(focus.yaw) * 7, z = focus.z + Math.cos(focus.yaw) * 7;
            const rd = world.nearestRoad(x, z, 8, 13, 0, ahead);
            if (rd) {
              const yaw = Math.atan2(rd.x - rd.dz * 1.3 - focus.x, rd.z + rd.dx * 1.3 - focus.z);
              const angle = Math.atan2(Math.sin(focus.yaw - yaw), Math.cos(focus.yaw - yaw));
              window.__setInput(Math.max(-0.48, Math.min(0.48, angle * 1.5)), pedal);
            }
          }
          previous = now;
        }
        if (work && physics) physics.step = originalStep;
        if (mode === 'traffic') vehicles._obstacleLimit = originalLimit;
        physicsTimes.sort((a, b) => a - b);
        const measurement = work ? window.__perf.summary() : null;
        if (work && !measurement.workMs) throw new Error('Měření práce snímku nezískalo žádné vzorky.');
        window.__setInput(0, 0);
        const elapsed = frames.reduce((sum, value) => sum + value, 0);
        frames.sort((a, b) => a - b);
        return {
          ...(mode === 'cabin' && { site }),
          metres: Math.round(Math.hypot(focus.x - start[0], focus.z - start[1])),
          start: start.map(Math.round), end: [Math.round(focus.x), Math.round(focus.z)],
          chunks: chunks.size, maxPending, shadowEnabled: game.env.sun.castShadow,
          drawingBuffer: [game.renderer.domElement.width, game.renderer.domElement.height],
          cityTiles: [...game.chunks.chunks.values()].filter((c) => c.heritage?.city).length,
          fps: +(1000 * frames.length / elapsed).toFixed(1),
          p95FrameMs: +frames[Math.ceil(frames.length * 0.95) - 1].toFixed(1),
          maxFrameMs: +frames.at(-1).toFixed(1),
          framesOver50Ms: frames.filter((value) => value > 50).length,
          ...(work && { measurement }),
          ...(mode === 'traffic' && { peakCars, peakDriven, obstacleSearch }),
          ...(physicsTimes.length > 0 && { physicsSteps: physicsTimes.length,
            physicsP95Ms: physicsTimes[Math.ceil(physicsTimes.length * 0.95) - 1] }),
        };
      }, { mode, pilot, site, work, pilotTrip: cabinTrip });
      if (work) report[name].budgets = frameBudgets(report[name].measurement, report.work.durationMs / 1000);
      if (site) report[name].site = site;
    }
    await context.close();
  }
  const json = JSON.stringify(report, null, 2) + '\n';
  if (work) {
    const cabinOutput = cabinTrip === PILOT_TRIP ? 'data-raw/e59/jizda.json'
      : service?.type === 'trolleybus' ? 'data-raw/e60/trolejbus/jizda.json'
      : service?.type === 'bus' ? 'data-raw/e60/bus/jizda.json' : 'data-raw/e60/jizda.json';
    const output = args.find((arg) => arg.startsWith('--output='))?.slice('--output='.length)
      ?? (cabin ? cabinOutput : rush ? 'data-raw/e20/vykon-spicka.json' : 'data-raw/e13/measure-work.json');
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, json);
  }
  process.stdout.write(json);
  if (work && scenarios.some(({ name }) =>
      Object.values(report[name].budgets).some(budget => budget.status !== 'splněno'))) process.exitCode = 1;
  if (rush && (report.rush.physicsP95Ms > 4 || !report.rush.physicsSteps ||
      report.rush.peakCars !== 40 || !report.rush.peakDriven)) process.exitCode = 1;
  if (release && (report.carEast.metres < 25 || report.heliCenter.chunks < 2 || !report.heliCenter.cityTiles)) process.exitCode = 1;
  if (pilot && ([report.car, report.heli].some(({ chunks }) => chunks < 2) || !report.car.cityTiles
      || centerFlight && !report.heli.cityTiles)) process.exitCode = 1;
} finally {
  await browser.close();
}
