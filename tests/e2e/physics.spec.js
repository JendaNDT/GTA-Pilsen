import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E18 – spuštěná hra má svět fyziky a uvádí jeho licenci', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await page.waitForFunction(() => window.__ready);
  expect(await page.evaluate(() => window.__game.physics.system.GetGravity().GetY())).toBeCloseTo(-9.81);
  await page.getByRole('button', { name: 'O hře', exact: true }).click();
  await expect(page.locator('#panel-about')).toContainText('Jolt Physics 1.1.1');
});

test('E18 – chyba při stažení fyziky vysvětlí, jak obnovit hru', async ({ page }) => {
  await page.route('**/jolt-physics.wasm-compat-*.js', (route) => route.abort());
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await expect(page.locator('#loadtext')).toContainText('Nepodařilo se načíst fyziku vozidel', { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Hrát', exact: true })).toBeHidden();
});

test('E18 – hra rozděluje čas jízdy na pevné kroky a v pauze fyziku neposouvá', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await page.waitForFunction(() => window.__ready);
  const steps = await page.evaluate(() => {
    const game = window.__game;
    const clock = game.physics.clock;
    const original = game.physics.step;
    const values = [];
    game.physics.step = (dt) => { values.push(dt); original(dt); };
    game.paused = true;
    game.update(1 / 60);
    const paused = values.length;
    game.paused = false;
    clock.remainder = 0;
    game.update(1 / 30);
    game.physics.step = original;
    return { paused, values };
  });
  expect(steps.paused).toBe(0);
  expect(steps.values).toEqual([1 / 60, 1 / 60]);
});

test('E18 – dlaždice pod hráčem má přednost a F8 ukáže její skutečné kolize', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await page.waitForFunction(() => window.__ready);
  const observed = await page.evaluate(() => {
    const { colliders, focus, world } = window.__game;
    colliders.update(focus.x, focus.z);
    const first = world.chunkIndex(focus.x, focus.z);
    const firstCount = colliders.tiles.size;
    const coversPlayer = colliders.tiles.has(first);
    colliders.update(focus.x + 1800, focus.z);
    return { firstCount, coversPlayer, retained: colliders.tiles.has(first), visible: colliders.debug.group.visible };
  });
  expect(observed).toEqual({ firstCount: 1, coversPlayer: true, retained: false, visible: false });
  await page.keyboard.press('F8');
  expect(await page.evaluate(() => window.__game.colliders.debug.group.visible)).toBe(true);
});

test('E18 – volba řízení se uloží a skutečný motor rozjede hráčovo auto', { tag: '@webgpu' }, async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.getByRole('combobox', { name: 'Řízení', exact: true }).selectOption('realistic');
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const g = window.__game;
    const car = g.player.lastCar ?? g.vehicles.cars.find((c) => c.mode === 'parked');
    g._enterCar(car);
    g.paused = false;
    window.__setInput(0, 1);
    window.__step(1 / 60, 140);
    return { driving: g.driver?.car === car, steering: g.steering, rpm: car.rpm, speed: car.speed, gear: car.gear };
  });
  expect(result.driving).toBe(true);
  expect(result.steering).toBe('realistic');

  expect(result.speed).toBeGreaterThan(1);
  expect(result.rpm).toBeGreaterThan(1000);
  expect(result.gear).toBeGreaterThan(0);
});

test('E18 – vlastní auto po návratu na silnici a načtení zachová místo, stav a úpravy', async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low&date=2026-11-17&hour=10'));
  await page.waitForFunction(() => window.__ready);
  const saved = await page.evaluate(() => {
    const g = window.__game;
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    g.player.place(841, 254);
    g.money = 5000;
    for (const action of ['buy', 'brakes', 'tires', 'retrieve']) g.garage.perform(action);
    const car = g.garage.active;
    g._enterCar(car);
    g.paused = false;
    g.update(1 / 60);
    car.health = 73;
    const road = g.world.nearestRoad(car.x, car.z, 400, 12, 0, {}, car.y);
    const parked = g.vehicles.add(new car.constructor('sedan', 0x326b87));
    parked.place(road.x, road.z, Math.atan2(road.dx, road.dz));
    g.unstuck();
    const clearance = Math.hypot(parked.x - car.x, parked.z - car.z);
    if (clearance < parked.halfLen + car.halfLen) throw new Error('Návrat umístil vůz do obsazeného místa.');
    g.update(1 / 60);
    if (!g.save()) throw new Error('Uložení auta selhalo');
    return { x: car.x, z: car.z, yaw: car.yaw, speed: car.speed };
  });
  expect(Math.abs(saved.speed)).toBeLessThan(0.5);
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  const loaded = await page.evaluate(() => {
    const g = window.__game;
    g.paused = false;
    g.vehicles.spawnTimer = g.peds.timer = Infinity;
    const atLoad = { x: g.car.x, z: g.car.z, yaw: g.car.yaw };
    g.update(1 / 60);
    const car = g.car;
    const result = { atLoad, x: car.x, z: car.z, yaw: car.yaw, health: car.health, owned: car === g.garage.active,
      upgrades: car.upgrades, speed: car.speed, driving: g.driver?.car === car };
    g._exitCar();
    g.update(1 / 60);
    return { ...result, exited: g.mode === 'foot' && !g.driver };
  });
  expect(loaded).toMatchObject({ health: 73, owned: true, upgrades: { brakes: true, tires: true }, driving: true, exited: true });
  expect(loaded.atLoad).toEqual({ x: saved.x, z: saved.z, yaw: saved.yaw });
  expect(Math.hypot(loaded.x - saved.x, loaded.z - saved.z), JSON.stringify({ loaded, saved })).toBeLessThan(0.1);
  expect(loaded.yaw).toBeCloseTo(saved.yaw, 2);
  expect(Math.abs(loaded.speed)).toBeLessThan(0.5);
});

test('E18 – panel měření ukazuje čas kroku, počet těles a při jízdě otáčky motoru', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=10'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => window.__game._enterCar(window.__game.player.lastCar));
  await page.keyboard.press('F9');
  const output = page.getByRole('textbox', { name: 'Výsledky měření výkonu' });
  await expect(output).toHaveValue(/Krok fyziky [\d,]+ ms · tělesa \d+/);
  await expect(output).toHaveValue(/Motor \d+ ot\/min · stupeň -?\d+ · podélný prokluz kol/);
});
