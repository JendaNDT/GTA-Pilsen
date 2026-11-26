import { devices, expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const url = '/?debug&quality=low&view=620&shadows=0&date=2026-11-09&hour=10';
const saveKey = 'plzen-naplno-v1';

async function jobsPanel(page) {
  if (!await page.locator('#menu').isVisible()) await page.locator('#btn-menu').click();
  const button = page.getByRole('button', { name: 'Zakázky', exact: true });
  if (await button.getAttribute('aria-expanded') === 'false') await button.click();
}

async function enterTaxi(page) {
  await page.goto(gameUrl(url));
  await waitForGame(page);
  return page.evaluate(() => {
    __freeze(true);
    const g = __game;
    const car = g.player.lastCar;
    g._enterCar(car);
    g.jobs.checkTimer = 100_000;
    return { x: car.x, z: car.z, yaw: car.yaw };
  });
}

test('E53 – tři taxi jízdy, správný obrubník, bonusy a bezpečné opakování výplaty', async ({ page }) => {
  const start = await enterTaxi(page);
  const summaries = [];
  for (const [ride, origin, destination] of [
    ['Běžná jízda', 'Husova 301/4', 'Papírnická 14'],
    ['Spěch na nádraží', 'Prokopova 21', 'Hlavní nádraží'],
    ['Klidná jízda', 'Štruncovy sady 3', 'Husova 56'],
  ]) {
    await page.evaluate(({ x, z, yaw }) => __game.car.place(x, z, yaw), start);
    await jobsPanel(page);
    const card = page.locator('.taxi-card').filter({ has: page.getByRole('heading', { name: ride, exact: true }) });
    await expect(card).toContainText(origin);
    await expect(card).toContainText(destination);
    await expect(card).toContainText(/výplata|výplaty/i);
    await card.getByRole('button').click();
    const result = await page.evaluate((ride) => {
      __freeze(true);
      const g = __game, { car, jobs, world } = g;
      const j = jobs.job, money = g.money, stats = g.stats.taxiRides ?? 0;
      const at = (t, dx = 0, dz = 0, yaw = Math.atan2(t.tx, t.tz)) => {
        car.place(t.x + dx, t.z + dz, yaw);
        jobs.update(0.05);
      };
      at(j.pick, 0, 0, Math.atan2(j.pick.tx, j.pick.tz) + Math.PI);
      const wrongDirection = j.phase;
      at(j.pick, j.pick.tz * 3, -j.pick.tx * 3);
      const wrongSide = j.phase;
      at(j.pick);
      const boarded = j.phase;
      const route = [...jobs.route];
      at(j.pick, -j.pick.tz * 1.35, j.pick.tx * 1.35, Math.atan2(j.pick.tx, j.pick.tz) + Math.PI);
      jobs.routeTimer = 0;
      jobs.update(0.05);
      const rerouted = jobs.route?.length > 2 && JSON.stringify(jobs.route) !== JSON.stringify(route);
      let walking = true;
      if (ride === 'Spěch na nádraží') {
        const { waiting } = j.drop;
        const end = { x: 725, z: 483 };
        const player = g.player;
        player.place(waiting.x, waiting.z);
        for (let i = 0; i < 240 && Math.hypot(player.x - end.x, player.z - end.z) > 1; i++) {
          const dx = end.x - player.x, dz = end.z - player.z, d = Math.hypot(dx, dz);
          player.update(0.05, dx / d, dz / d, false, false);
        }
        walking = Math.hypot(player.x - end.x, player.z - end.z) <= 1 && !world.isWater(end.x, end.z);
        jobs.update(j.time + j.limit / 6);
      }
      if (ride === 'Klidná jízda') {
        for (const speed of [16, 15, 14, 14, 13, 12]) {
          car.vx = speed;
          jobs.update(0.1);
        }
        g.onCrash(car, 8, null);
      }
      const setItem = Storage.prototype.setItem;
      const failWrite = ride === 'Klidná jízda';
      let writes = 0;
      if (failWrite) Storage.prototype.setItem = () => { writes++; throw new Error('test zápisu'); };
      let stationMetres = 0;
      try {
        if (ride !== 'Spěch na nádraží') at(j.drop);
        else {
          const path = world.findPath(world.eTo[j.pick.edge], world.eFrom[j.drop.edge], 9000, j.pick.edge, 0, j.drop.edge);
          const approach = path.at(-1), points = [];
          for (const [edge, from, to] of [[approach, 15, world.eLen[approach]], [j.drop.edge, 0, j.drop.along]]) {
            for (let s = from; s < to; s += 0.5) {
              const side = edge === j.drop.edge ? Math.min(1.2, 0.25 + s * 0.095) : 0.25;
              points.push(world.edgePoint(edge, s, side, {}));
            }
          }
          points.push(j.drop);
          const first = points[0];
          car.place(first.x, first.z, Math.atan2(first.tx, first.tz));
          g.vehicles.spawnTimer = g.peds.timer = 100_000;
          for (const other of [...g.vehicles.cars]) if (other !== car) g.vehicles.remove(other);
          for (let i = 0; i < 40; i++) g.colliders.update(first.x, first.z);
          // Od začátku příjezdového úseku až k vysazení pohání vůz skutečná fyzika.
          let cursor = 0, lastX = car.x, lastZ = car.z;
          const distance = (p) => Math.hypot(car.x - p.x, car.z - p.z);
          for (let i = 0; i < 1500 && jobs.job; i++) {
            while (cursor + 1 < points.length && distance(points[cursor + 1]) < distance(points[cursor])) cursor++;
            const next = points[Math.min(cursor + 8, points.length - 1)];
            const angle = Math.atan2(next.x - car.x, next.z - car.z) - car.yaw;
            const steer = Math.atan2(Math.sin(angle), Math.cos(angle));
            const remaining = (points.length - 1 - cursor) * 0.5;
            const targetSpeed = remaining > 13 ? 4.5 : Math.max(0.6, Math.min(3, remaining * 0.42));
            const throttle = car.speed > targetSpeed + 0.25 ? -0.25 : Math.min(0.5, Math.max(0, (targetSpeed - car.speed) * 0.28));
            __setInput(Math.max(-1, Math.min(1, -steer * 1.75)), throttle);
            g.update(1 / 60);
            stationMetres += Math.hypot(car.x - lastX, car.z - lastZ);
            lastX = car.x;
            lastZ = car.z;
          }
          __setInput(0, 0);
        }
      }
      finally { Storage.prototype.setItem = setItem; }
      return {
        boarded, wrongSide, wrongDirection, walking, rerouted, stationMetres, money, stats, writes, amount: j.pending?.amount,
        reward: j.reward, pending: !!jobs.job?.pending, changed: g.money - money, result: j.pending,
      };
    }, ride);
    expect(result).toMatchObject({ wrongSide: 'pickup', wrongDirection: 'pickup', boarded: 'drop', walking: true });
    if (ride === 'Běžná jízda') {
      expect(result.rerouted).toBe(true);
      expect(result.changed).toBe(result.reward);
    }
    if (ride === 'Spěch na nádraží') {
      expect(result.stationMetres).toBeGreaterThan(60);
      expect(result.result?.note).toContain('po termínu');
      expect(result.amount - result.reward).toBeGreaterThan(0);
      expect(result.amount - result.reward).toBeLessThan(120);
    }
    if (ride === 'Klidná jízda') {
      expect(result).toMatchObject({ pending: true, writes: 1, changed: 0 });
      expect(result.result.note).toContain('prudké brzdění 2×, nárazy 1×');
      expect(result.amount - result.reward).toBe(35);
      await jobsPanel(page);
      await page.getByRole('button', { name: 'Znovu uložit odměnu' }).click();
      await expect(page.locator('#job-result')).toContainText('Dokončeno');
    }
    const saved = await page.evaluate((key) => {
      __game.jobs.pay();
      return JSON.parse(localStorage.getItem(key));
    }, saveKey);
    expect(saved.money).toBe(result.money + result.amount);
    expect(saved.stats.taxiRides).toBe(result.stats + 1);
    expect(saved.job.active).toBeNull();
    summaries.push(saved.job.last.variant);
  }
  expect(summaries).toEqual(['Běžná jízda', 'Spěch na nádraží', 'Klidná jízda']);
  await page.reload();
  await waitForGame(page);
  await jobsPanel(page);
  await expect(page.locator('#job-result')).toContainText('Klidná jízda');
});

test('E53 – nabídka na dotyku, zmeškaný nástup, vystoupení a nepojízdné auto', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  try {
    const page = await context.newPage();
    const start = await enterTaxi(page);
    const open = async (name) => {
      await page.evaluate(({ x, z, yaw }) => __game.car.place(x, z, yaw), start);
      await jobsPanel(page);
      await page.getByRole('button', { name: `Přijmout · ${name}` }).tap();
    };
    await open('Spěch na nádraží');
    const expired = await page.evaluate(() => {
      __game.jobs.update(__game.jobs.job.time + 1);
      return __game.jobs.last;
    });
    expect(expired).toMatchObject({ state: 'expired', amount: 0 });
    await open('Klidná jízda');
    const broken = await page.evaluate(() => {
      __game.car.health = 0;
      __game.jobs.update(0.05);
      __game.car.health = 100;
      return __game.jobs.last;
    });
    expect(broken).toMatchObject({ state: 'interrupted', note: 'Vůz přestal být pojízdný', amount: 0 });
    await open('Běžná jízda');
    const exited = await page.evaluate(() => {
      __game._exitCar();
      return __game.jobs.last;
    });
    expect(exited).toMatchObject({ state: 'interrupted', note: 'Vystoupil jsi z auta', amount: 0 });
    await page.evaluate(() => {
      const g = __game, car = g.player.lastCar;
      g._enterCar(car);
      car.place(0, -8000, 0);
    });
    await jobsPanel(page);
    await expect(page.locator('#taxi-cards button')).toHaveCount(0);
    await expect(page.locator('#taxi-feedback')).toContainText('žádný cestující');
  } finally {
    await context.close();
  }
});
