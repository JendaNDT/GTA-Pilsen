import { expect, test } from '@playwright/test';

async function boot(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?debug&view=620&shadows=0');
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.waitForFunction(() => window.__game.audio.ctx?.state === 'running');
  await page.evaluate(() => {
    window.__freeze(true);
    const g = window.__game;
    g.vehicles.spawnTimer = 100_000;
    g.peds.timer = 100_000;
    g.audio.resetWorld();
  });
  return errors;
}

async function action(page, code) {
  await page.evaluate((code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.__step(1 / 60);
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }, code);
}

test('E09 – stereo tramvaje a vlastní hlášení dvou sousedních vozů', async ({ page }, info) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__game, table = g.transit.timetable;
    const event = table.events(g.clock.day).find((event) => event.trip.id === '686547');
    const { trip } = event;
    const index = trip.stops.findIndex(({ target }) => target[1] === 'U Práce');
    const point = trip.route.posAt(trip.stops[index].target[0], 0, {});
    g.player.place(point.x, point.z);
    window.__setClock(null, trip.times[index * 2] / 3600);
    const first = g.transit.active.get(event.key);
    const second = g.transit.vehicles.find((v) => v !== first && v.route.type === 'trolleybus'
      && v.stops.some(([, name]) => name === 'Mrakodrap'));
    for (const v of g.transit.vehicles) if (v !== first && v !== second) g.transit._dispose(v);
    g.transit.vehicles = [first];
    g.vehicles.spawnTimer = g.peds.timer = 100_000;
    for (const car of [...g.vehicles.cars]) g.vehicles.remove(car);
    g.camYaw = 0;
    first.v = 7;
    g.player.place(first.x - 11, first.z, first.y);
    g.audio.update(0.1, 0);
    const voice = g.audio.loops.get(first);
    const splitter = g.audio.ctx.createChannelSplitter(2);
    voice.channel.gain.connect(splitter);
    const sink = g.audio.ctx.createGain();
    sink.gain.value = 0;
    sink.connect(g.audio.ctx.destination);
    const meters = [0, 1].map((channel) => {
      const analyser = g.audio.ctx.createAnalyser();
      splitter.connect(analyser, channel);
      analyser.connect(sink);
      return analyser;
    });
    window.soundCheck = {
      first, second, index, meters,
      energy() {
        return meters.map((analyser) => {
          const data = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(data);
          return Math.sqrt(data.reduce((sum, n) => sum + n * n, 0) / data.length);
        });
      },
    };
  });
  await expect.poll(() => page.evaluate(() => {
    const [left, right] = window.soundCheck.energy();
    return left - right * 2.5;
  })).toBeGreaterThan(0.0007);
  const leftEnergy = await page.evaluate(() => window.soundCheck.energy());
  await page.evaluate(() => {
    const g = window.__game, { first } = window.soundCheck;
    g.player.place(first.x + 11, first.z, first.y);
    g.audio.update(0.1, 0);
  });
  await expect.poll(() => page.evaluate(() => {
    const [left, right] = window.soundCheck.energy();
    return right - left * 2.5;
  })).toBeGreaterThan(0.0007);
  const rightEnergy = await page.evaluate(() => window.soundCheck.energy());
  await info.attach('energie levého a pravého kanálu', {
    body: JSON.stringify({ leftEnergy, rightEnergy }), contentType: 'application/json',
  });

  await page.evaluate(() => {
    const g = window.__game, { first, second, index } = window.soundCheck;
    // Čelo stojí těsně před předepsaným bodem. Zastavení a dveře obslouží běžný krok MHD.
    Object.assign(first, { s: first.stops[index][0] - 0.15, stopIndex: index, v: 0.15, wait: 0,
      doorsOpen: false, stopTarget: null });
    g.transit.update(1 / 60, g.player, [], false, g.clock);
    second.stopTarget = second.stops.find(([, name]) => name === 'Mrakodrap');
    Object.assign(second, { x: g.player.x - 5, y: g.player.y, z: g.player.z + 3, visible: true, doorsOpen: true });
    g.audio.transitDoors(second, true, second.stopTarget[1]);
  });
  await expect.poll(() => page.evaluate(() => {
    const g = window.__game, { first, second } = window.soundCheck;
    return [...g.audio.effects].filter((effect) => effect.kind === 'speech').map((effect) => ({
      stop: effect.stop, vehicle: effect.source === first ? 'tramvaj' : effect.source === second ? 'trolejbus' : '?',
    })).sort((a, b) => a.stop.localeCompare(b.stop));
  })).toEqual([{ stop: 'Mrakodrap', vehicle: 'trolejbus' }, { stop: 'U Práce', vehicle: 'tramvaj' }]);
  const stopped = await page.evaluate(() => {
    const g = window.__game, { first, second } = window.soundCheck;
    const hadDoor = first.doorsOpen && first.stopTarget?.[1] === 'U Práce';
    first.wait = 0.01;
    g.transit.update(1 / 60, g.player, [], false, g.clock);
    const departureBell = [...g.audio.effects].some((effect) => effect.kind === 'bell' && effect.source === first);
    g.transit._dispose(first);
    g.audio.remove(second);
    return { hadDoor, departureBell, sourcesLeft: [...g.audio.effects].some(({ source }) => source === first || source === second) };
  });
  expect(stopped).toEqual({ hadDoor: true, departureBell: true, sourcesLeft: false });
  expect(errors).toEqual([]);
});

test('E09 – klakson patří řidičovu autu a po odebrání ztichne', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const g = window.__game, car = g.player.lastCar;
    for (const c of [...g.vehicles.cars]) if (c !== car) g.vehicles.remove(c);
    const other = g.vehicles.add(new car.constructor('police', 0x426780));
    other.place(car.x + 14, car.z, 0);
    g._enterCar(car);
    window.otherCar = other;
  });
  await action(page, 'KeyH');
  const result = await page.evaluate(() => {
    const g = window.__game, car = g.car, other = window.otherCar;
    const horns = [...g.audio.effects].filter(({ kind }) => kind === 'horn');
    // Sirénu zapíná právě režim pronásledování daného vozu.
    other.mode = 'police';
    g.wanted = 1;
    g.audio.update(0.1, 0);
    const siren = Boolean(g.audio.loops.get(other)?.siren);
    const silentSource = !g.audio.loops.get(car)?.siren;
    g._exitCar();
    g.vehicles.remove(car);
    const removed = !g.audio.loops.has(car) && ![...g.audio.effects].some((event) => event.source === car);
    g.vehicles.remove(other);

    for (const v of g.transit.vehicles) g.transit._dispose(v);
    g.transit.vehicles = [];
    const h = g.helis[0];
    h.x = g.player.x + 19; h.z = g.player.z; h.y = g.player.y; h.rotor = 17;
    g.audio.update(0.1, 0);
    const rotor = g.audio.loops.get(h)?.kind;
    h.rotor = 0;
    g.audio.update(0.1, 0);
    return { horns: horns.length, ownHorn: horns[0]?.source === car, siren, silentSource,
      removed, rotor, stillSpinning: g.audio.loops.has(h),
      vehicleSources: [...g.audio.loops.values()].filter(({ kind }) => ['car', 'tram', 'trolleybus', 'bus'].includes(kind)).length };
  });
  expect(result).toEqual({ horns: 1, ownHorn: true, siren: true, silentSource: true, removed: true,
    rotor: 'rotor', stillSpinning: false, vehicleSources: 0 });
  expect(errors).toEqual([]);
});

test('E09 – kola hamru a zvuk se zastaví spolu, náhon zůstane slyšet', async ({ page }) => {
  const errors = await boot(page);
  const result = await page.evaluate(() => {
    const g = window.__game, heritage = g.chunks.heritage;
    g.player.place(22674, 3112);
    window.__setClock(null, 16 + 59 / 60);
    g.vehicles.spawnTimer = g.peds.timer = 100_000;
    for (const c of [...g.vehicles.cars]) g.vehicles.remove(c);
    window.__step(1 / 60, 2);
    const playing = g.audio.loops.has(g.audio.forge), angleBefore = heritage.forgeAngle;
    window.__step(1 / 30, 47);
    const stopped = !g.audio.loops.has(g.audio.forge) && !heritage.forgeWorking;
    const angleAfter = heritage.forgeAngle;
    window.__step(1 / 30, 6);
    const still = heritage.forgeAngle === angleAfter && angleAfter > angleBefore;
    const water = [...g.audio.loops.values()].some((voice) => voice.kind === 'water');
    g.toggleMap(true);
    return { playing, stopped, still, water, paused: !g.audio.loops.size && !g.audio.effects.size };
  });
  expect(result).toEqual({ playing: true, stopped: true, still: true, water: true, paused: true });
  await page.getByRole('button', { name: 'Zavřít mapu' }).click();
  await page.locator('#btn-menu').click();
  await page.getByRole('button', { name: 'Nastavení' }).click();
  await page.getByRole('checkbox', { name: 'Zvuk hry' }).uncheck();
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Nastavení' }).click();
  await expect(page.getByRole('checkbox', { name: 'Zvuk hry' })).not.toBeChecked();
  expect(errors).toEqual([]);
});
