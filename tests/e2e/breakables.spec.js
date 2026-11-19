import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E21 – auto ulomí lampu, po návratu chybí i světlo a ve čtyři se opraví @webgpu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=23'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => __freeze(true));
  const result = await page.evaluate(() => {
    const g = __game, w = g.world, manager = g.lampBodies, car = g.player.lastCar;
    const load = (x, z) => {
      for (let i = 0; i < 28; i++) g.colliders.update(x, z);
      for (let i = 0; i < 8; i++) g.chunks.update(x, z, 620, 100);
      while (manager.pending.size) manager.step(g.clock.now);
    };
    load(car.x, car.z);
    const candidates = [...manager.nearby.values()].sort((a, b) =>
      Math.hypot(a.x - car.x, a.z - car.z) - Math.hypot(b.x - car.x, b.z - car.z));
    const lamp = candidates.find(l => w.breakables.visuals.has(l.id) && Math.hypot(l.x - l.lightX, l.z - l.lightZ) > 2);
    if (!lamp) throw new Error('U výchozího místa chybí lampa u hlavní ulice.');
    const road = w.nearestRoad(lamp.x, lamp.z, 20, undefined, 0, {});
    const d = Math.hypot(lamp.x - road.x, lamp.z - road.z);
    const dx = (lamp.x - road.x) / d, dz = (lamp.z - road.z) / d;
    const drawState = () => {
      const tile = g.chunks.chunks.get(Number(lamp.id.split('/')[1]));
      const index = tile.lamps.visuals.findIndex(v => v.id === lamp.id);
      const pool = tile.lamps.pools.geometry.index.array.subarray(index * 54, (index + 1) * 54);
      const visible = tile.lamps.poles.children.some(mesh => {
        const matrices = mesh.instanceMatrix.array;
        for (let i = 0; i < mesh.count * 16; i += 16) {
          if (matrices[i] > 0 && Math.abs(matrices[i + 12] - lamp.x) < 0.001 &&
              Math.abs(matrices[i + 14] - lamp.z) < 0.001) return true;
        }
        return false;
      });
      return { light: new Set(pool).size > 1, visible, pole: manager.bodies.has(lamp.id), state: w.breakables.state(lamp.id) };
    };
    const before = drawState();
    car.place(lamp.x - dx * 6, lamp.z - dz * 6, Math.atan2(dx, dz));
    g._enterCar(car);
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    car.speed = 30 / 3.6;
    car.vx = dx * car.speed;
    car.vz = dz * car.speed;
    for (let i = 0; i < 120; i++) g.update(1 / 60);
    const broken = drawState(), pieces = manager.debris.get(lamp.id)?.length ?? 0;
    load(lamp.x + 2200, lamp.z);
    const unloaded = !manager.nearby.has(lamp.id) && !w.breakables.visuals.has(lamp.id);
    load(lamp.x, lamp.z);
    const returned = drawState();
    g.setClock('2026-11-10', 3.99);
    const early = drawState();
    g.setClock('2026-11-10', 4);
    manager.step(g.clock.now);
    return { before, broken, pieces, unloaded, returned, early, repaired: drawState() };
  });
  const intact = { light: true, visible: true, pole: true, state: 'intact' };
  const broken = { light: false, visible: false, pole: false, state: 'broken' };
  expect(result).toEqual({ before: intact, broken, pieces: 2, unloaded: true, returned: broken,
    early: broken, repaired: intact });
});
