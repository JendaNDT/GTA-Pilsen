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

test('E21 – semafor pro chodce u Americké stojí mimo pruh a jeho výpadek zhasne křižovatku', async ({ page }) => {
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
    const control = world.traffic.controls.find(c => c.kind === 'signal' && c.group === entry.group);
    world.breakables.damage(fixture.id, 'broken', g.clock.now);
    return { light: world.traffic.light(control), oldInRoad: world.onCarriageway(entry.x, entry.z, world.groundY(entry.x, entry.z)),
      obstructsRoad: world.onCarriageway(x, z, y, 0.25), distance: Math.hypot(x - entry.x, z - entry.z),
      physical: trafficFurniture.records.get(fixture.id).body.IsStatic() };
  });
  expect(result).toMatchObject({ oldInRoad: true, obstructsRoad: false, physical: true, light: 'off' });
  expect(result.distance).toBeGreaterThan(0);
  expect(result.distance).toBeLessThan(5);
});

test('E21 – po průrazu kovového zábradlí zůstane mezera až do ranní opravy @webgpu', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=12'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(() => {
    __freeze(true);
    const g = __game, w = g.world, car = g.player.lastCar;
    const load = (x, z) => {
      for (let i = 0; i < 30; i++) g.colliders.update(x, z);
      for (let i = 0; i < 12; i++) g.chunks.update(x, z, 620, 100);
    };
    const edge = [...w.bridgeEdges.values()].flat().find(e => {
      if (e.style === 'stone' || e.y - w.heightAt(e.x,e.z) < 3) return false;
      const [a,b,c,d] = e.corners;
      if (Math.hypot(a[0]-b[0], a[2]-b[2]) < 2.3) return false;
      const dx = d[0]-a[0] + c[0]-b[0], dz = d[2]-a[2] + c[2]-b[2];
      const k = 4 / Math.hypot(dx,dz);
      const x = e.x + dx*k, z = e.z + dz*k;
      const road = w.nearestRoad(x, z, 8, e.y, 0, {});
      if (!road || !(w.r.flags[road.road] & 2) || w.r.w[road.road] < 7 || w.rondel?.elevated.has(road.road)) return false;
      if (Math.abs((road.dx*dx + road.dz*dz) * k / 4) > 0.1) return false;
      return [-1.5, 0, 1.5].every(side => [0.6, 2.2, 4.0, 5.6].every(dist => {
        const px = e.x + k/4 * (dx*dist + dz*side), pz = e.z + k/4 * (dz*dist - dx*side);
        return Math.abs(w.groundY(px, pz, e.y + 0.5) - (e.y - 0.5)) < 0.22
          && !w.collideCircle(px, pz, 0.15, e.y - 0.2, e.y + 0.6);
      }));
    });
    const [a,b,c,d] = edge.corners;
    const ox = a[0]-d[0] + b[0]-c[0], oz = a[2]-d[2] + b[2]-c[2];
    const dx = ox / Math.hypot(ox,oz), dz = oz / Math.hypot(ox,oz);
    g._enterCar(car);
    load(edge.x,edge.z);
    car.place(edge.x - dx*4, edge.z - dz*4, Math.atan2(dx,dz), edge.y - 0.5);
    for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
    car.vx = dx * 18; car.vz = dz * 18; car.speed = 18;
    let passed = false;
    const diag = { id: edge.id, edge: [edge.x,edge.y,edge.z], start: [car.x,car.y,car.z], hits: [], samples: [] };
    const original = g.physics.onImpact;
    g.physics.onImpact = (a,b,impulse,...rest) => {
      if (diag.hits.length < 12 && impulse > 500) diag.hits.push([a.GetObjectLayer(), b.GetObjectLayer(), impulse]);
      return original(a,b,impulse,...rest);
    };
    for (let i = 0; i < 70; i++) {
      g.update(1/60);
      if (i % 10 === 0) diag.samples.push([car.x,car.y,car.z,car.speed]);
      if ((car.x-edge.x)*dx + (car.z-edge.z)*dz > 1) passed = true;
    }
    const broken = w.breakables.state(edge.id);
    if (!passed || broken !== "broken") throw new Error(JSON.stringify(diag));
    const piece = g.colliders.roadFurniture.loose.has(edge.id);
    load(edge.x + 2000, edge.z);
    g.colliders.roadFurniture.step(g.clock.now);
    load(edge.x,edge.z);
    const returned = w.breakables.state(edge.id);
    g.setClock('2026-11-10', 4);
    g.colliders.roadFurniture.step(g.clock.now);
    return { passed, piece, broken, returned, repaired: w.breakables.state(edge.id), visible: w.breakables.visuals.has(edge.id) };
  });
  expect(result).toEqual({ passed: true, piece: true, broken: 'broken', returned: 'broken', repaired: 'intact', visible: true });
});
