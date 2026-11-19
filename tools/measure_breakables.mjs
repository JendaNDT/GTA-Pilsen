// Deset souběžných nárazů do zkušebních lamp na oddělené ploše nad herním světem.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { webgpuFlags } from '../tests/e2e/browser-flags.js';

const url = new URL(process.argv[2] ?? 'http://127.0.0.1:4173/');
url.searchParams.set('debug', '');
url.searchParams.set('adapt', '0');
if (!url.searchParams.has('quality')) url.searchParams.set('quality', 'high');
const output = process.argv[3] ?? 'data-raw/e21/deset-lamp.json';
const software = process.argv.includes('--software');
const browser = await chromium.launch({channel: 'chromium', args: software ? webgpuFlags : [],
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
try {
  const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
  await page.goto(url.href);
  await page.waitForFunction(() => window.__ready, null, {timeout: 120_000});
  await page.getByRole('button', {name: 'Hrát', exact: true}).click();
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, {physics, lampBodies} = g, {Jolt, bodies} = physics;
    const device = g.renderer.backend.device;
    if (!device?.queue) throw new Error('Pro úplné měření snímku je potřeba WebGPU.');
    const {x, y, z} = g.focus;
    const fixtures = Array.from({length: 10}, (_, i) => ({
      id: 'test-lamp/' + i, x: x + 3 * (i - 5), y: y + 35, z, height: 4, head: 0.8,
    }));
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    lampBodies.load(fixtures);
    const frame = async () => {
      const start = performance.now();
      g.update(1 / 60);
      g.render();
      const cpu = performance.now() - start;
      await device.queue.onSubmittedWorkDone();
      return { cpu, complete: performance.now() - start };
    };
    for (let i = 0; i < 30; i++) await frame();
    const half = new Jolt.Vec3(0.7, 0.4, 1.4), pos = new Jolt.RVec3(0,0,0);
    const q = new Jolt.Quat(0,0,0,1), v = new Jolt.Vec3(0,0,10);
    const cars = [];
    for (const fixture of fixtures) {
      pos.Set(fixture.x, fixture.y + 0.55, z - 1.75);
      const settings = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), pos, q, Jolt.EMotionType_Dynamic, 1);
      settings.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      settings.mMassPropertiesOverride.mMass = 1200;
      const body = bodies.CreateBody(settings);
      cars.push(body);
      bodies.AddBody(body.GetID(), Jolt.EActivation_Activate);
      body.SetLinearVelocity(v);
      Jolt.destroy(settings);
    }
    for (const value of [half, pos, q, v]) Jolt.destroy(value);
    const frames = [];
    for (let i = 0; i < 30; i++) frames.push(await frame());
    const broken = fixtures.filter(f => g.world.breakables.state(f.id) === 'broken').length;
    for (const car of cars) {
      const id = car.GetID();
      bodies.RemoveBody(id);
      bodies.DestroyBody(id);
    }
    lampBodies.unload(fixtures);
    return { adapter: g.renderer.backend.adapter?.info?.description ?? null, broken, frames,
      maxCpuMs: Math.max(...frames.map(f => f.cpu)), maxCompleteMs: Math.max(...frames.map(f => f.complete)) };
  });
  const report = { ...result, browser: browser.version(), quality: url.searchParams.get('quality'), software,
    viewport: [1920,1080] };
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({file: output, broken: result.broken, maxCompleteMs: result.maxCompleteMs}));
  if (result.broken !== 10) throw new Error('Zátěžová scéna nerozbila všech deset zkušebních lamp.');
} finally { await browser.close(); }
