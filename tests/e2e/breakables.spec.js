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

test('E21 – při poškození a opravě značky a semaforu se společně skryjí a vrátí všechny díly @webgpu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=22'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    __freeze(true);
    const { chunks, world, focus, clock } = __game, registry = world.breakables;
    for (let i = 0; i < 18; i++) chunks.update(focus.x, focus.z, 620, 100);
    const check = (type, select) => {
      const fixture = [...world.traffic.chunks.entries()].find(([ci, entries]) =>
        chunks.chunks.get(ci)?.traffic && select(entries));
      if (!fixture) throw new Error('V okolí chybí vybavení typu ' + type);
      const [ci, entries] = fixture, id = select(entries).breakableId;
      const meshes = chunks.chunks.get(ci).traffic.group.children;
      const snapshot = () => meshes.map(mesh => Array.from(mesh.instanceMatrix.array));
      const before = snapshot();
      registry.damage(id, 'broken', clock.now);
      const damaged = snapshot();
      let hidden = 0, moved = 0;
      for (const [i, shown] of before.entries()) {
        for (let offset = 0; offset < shown.length; offset += 16) {
          const a = shown.slice(offset, offset + 16), b = damaged[i].slice(offset, offset + 16);
          if (a.every((n, j) => n === b[j])) continue;
          if (b.slice(0, 12).every(n => n === 0)) hidden++;
          if (b.slice(12).some((n, j) => n !== a[12 + j])) moved++;
        }
      }
      registry.repairDue(clock.now + 30 * 3600);
      const restored = snapshot().every((matrices, i) => matrices.every((n, j) => n === before[i][j]));
      return { hidden, moved, restored };
    };
    return {
      sign: check('značka', entries => entries.signs[0]),
      signal: check('semafor', entries => entries.heads.find(head => head.kind === 'signal')),
    };
  });
  expect(result).toEqual({
    sign: { hidden: 2, moved: 0, restored: true },
    signal: { hidden: 5, moved: 0, restored: true },
  });
});

test('E21 – náraz ohne značku, vyřadí řízení semaforů a v noci se vybavení vrátí @webgpu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=22'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    __freeze(true);
    const g = __game, { world, focus, colliders, trafficFurniture: furniture, physics } = g;
    const { Jolt, bodies } = physics;
    for (let i = 0; i < 28; i++) colliders.update(focus.x, focus.z);
    for (let i = 0; i < 18; i++) g.chunks.update(focus.x, focus.z, 620, 100);
    while (furniture.pending.size) furniture.step(g.clock.now);
    for (const car of [...g.vehicles.cars]) g.vehicles.remove(car);
    const fixtures = [...furniture.nearby.values()];
    const find = type => fixtures.find(fixture => fixture.type === type &&
      (type !== 'signal' || fixture.entry.group.fixtures?.includes(fixture.id)) &&
      world.breakables.visuals.has(fixture.id) &&
      [0, 0.26, 0.52].every(distance =>
        !world.collideCircle(fixture.x, fixture.z - distance, 0.31, fixture.y + 0.6, fixture.y + 1.4, true)) &&
      fixtures.every(other => other === fixture || Math.hypot(other.x - fixture.x, other.z - fixture.z) > 1.5));
    const sign = find('sign'), signal = find('signal');
    if (!sign || !signal) throw new Error('V okolí chybí samostatná značka nebo semafor.');
    const advance = ticks => {
      for (let i = 0; i < ticks; i++) physics.step(1 / 60);
    };
    const collide = (fixture, speed) => {
      const position = new Jolt.RVec3(fixture.x, fixture.y + 1, fixture.z - 0.52);
      const rotation = new Jolt.Quat(0, 0, 0, 1);
      const half = new Jolt.Vec3(0.18, 0.21, 0.22);
      const velocity = new Jolt.Vec3(0, 0, speed);
      const setup = new Jolt.BodyCreationSettings(new Jolt.BoxShape(half), position, rotation, Jolt.EMotionType_Dynamic, 1);
      setup.mOverrideMassProperties = Jolt.EOverrideMassProperties_CalculateInertia;
      setup.mMassPropertiesOverride.mMass = 1000;
      const body = bodies.CreateBody(setup), id = body.GetID();
      bodies.AddBody(id, Jolt.EActivation_Activate);
      bodies.SetLinearVelocity(id, velocity);
      try {
        for (let i = 0; i < 18; i++) {
          advance(1);
          if (world.breakables.state(fixture.id) !== 'intact') break;
        }
      } finally {
        bodies.RemoveBody(id);
        bodies.DestroyBody(id);
        for (const value of [position, rotation, half, velocity, setup]) Jolt.destroy(value);
      }
    };
    const before = world.traffic.light(signal.entry);
    collide(sign, 5.7);
    advance(360);
    const signTilt = world.breakables.damaged.get(sign.id)?.pose?.qx ?? 0;
    const settled = furniture.records.get(sign.id).body.IsStatic();
    collide(signal, 21);
    const blackout = world.traffic.light(signal.entry);
    const parts = furniture.records.get(signal.id).pieces?.length ?? 0;
    g.setClock('2026-11-10', 4);
    furniture.step(g.clock.now);
    return { ready: before !== 'off', signTilt, settled, blackout, parts,
      restored: world.traffic.light(signal.entry) !== 'off',
      standing: [sign, signal].every(f => furniture.records.get(f.id).state === 'intact') };
  });
  expect(result).toMatchObject({ ready: true, settled: true, blackout: 'off', parts: 2, restored: true, standing: true });
  expect(result.signTilt).toBeGreaterThan(0.1);
});

test('E21 – semafor pro chodce u Americké má patu vedle jízdního pruhu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await page.waitForFunction(() => window.__ready);
  const result = await page.evaluate(() => {
    const g = __game, { world, colliders, trafficFurniture } = g;
    __freeze(true);
    for (let i = 0; i < 25; i++) colliders.update(-358.16, 364.15);
    while (trafficFurniture.pending.size) trafficFurniture.step(g.clock.now);
    const fixture = trafficFurniture.nearby.get('signal/5797/20');
    const { x, y, z, entry } = fixture;
    g.chunks.update(x, z, 620, 100);
    return { oldInRoad: world.onCarriageway(entry.x, entry.z, world.groundY(entry.x, entry.z)),
      obstructsRoad: world.onCarriageway(x, z, y, 0.25), distance: Math.hypot(x - entry.x, z - entry.z),
      physical: trafficFurniture.records.get(fixture.id).body.IsStatic() };
  });
  expect(result).toMatchObject({ oldInRoad: true, obstructsRoad: false, physical: true });
  expect(result.distance).toBeGreaterThan(0);
  expect(result.distance).toBeLessThan(5);
});
