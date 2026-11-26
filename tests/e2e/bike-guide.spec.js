import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const stops = { 43: 'Západočeské muzeum', 57: 'DEPO 2015' };

async function startAt(page, id, touch = false) {
  await page.goto(gameUrl('/?debug&quality=low&view=650&weather=clear&date=2026-11-09&hour=02'));
  await waitForGame(page);
  const play = page.getByRole('button', { name: 'Hrát', exact: true });
  if (touch) await play.tap(); else await play.click();
  await page.evaluate(id => {
    __freeze(true);
    const g = __game, station = g.bikes.stations.find(p => p.id === id);
    g.vehicles.spawnTimer = g.peds.timer = 100_000;
    g.player.place(station.x, station.z, station.y);
    for (let i = 0; i < 25; i++) g.colliders.update(station.x, station.z);
    __step(1 / 60, 10);
  }, id);
  await expect(page.locator('#prompt')).toContainText('Půjčit elektrokolo');
  if (touch) await page.getByRole('button', { name: 'Půjčit elektrokolo' }).tap();
  else await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60, 3));
  expect(await page.evaluate(() => __game.mode)).toBe('bike');
}

async function openMap(page, touch = false) {
  await page.evaluate(() => __freeze(false));
  const map = page.locator('#minimap');
  if (touch) await map.tap(); else await map.click();
  await expect(page.locator('#bigmap')).toBeVisible();
  await page.evaluate(() => __freeze(true));
}

async function targetStation(page, id, touch = false) {
  await openMap(page, touch);
  const name = stops[id];
  await page.getByRole('searchbox').fill('Pilsen Bike ' + name);
  const result = page.getByRole('button', { name: name + ' · Pilsen Bike', exact: true });
  const go = page.getByRole('button', { name: 'Navigovat sem' });
  if (touch) { await result.tap(); await go.tap(); }
  else { await result.click(); await go.click(); }
  await expect.poll(() => page.evaluate(() => {
    __step(1 / 60, 4);
    return __game.jobs.cycling.status;
  }), { timeout: 15000 }).toBe('Cyklistická trasa');
}

for (const [from, to] of [['43', '57'], ['57', '43']]) {
  test(`E56 – průjezd podle navigace z místa ${stops[from]} do cíle ${stops[to]}`, async ({ page }) => {
    test.setTimeout(120000);
    await startAt(page, from);
    await targetStation(page, to);
    const ride = await page.evaluate(() => {
      const g = __game, player = g.player, initial = g.jobs.displayedBike;
      const target = g.jobs.waypoint, points = [];
      for (let i = 2; i < initial.length; i += 2) {
        const x = initial[i - 2], z = initial[i - 1], dx = initial[i] - x, dz = initial[i + 1] - z;
        const n = Math.ceil(Math.hypot(dx, dz) / 10);
        for (let j = 1; j <= n; j++) points.push([x + dx * j / n, z + dz * j / n]);
      }
      let index = 0, idle = 0, travelled = 0, replanned = false;
      let x0 = player.x, z0 = player.z;
      for (let i = 0; i < 32000 && g.mode === 'bike' && index < points.length; i++) {
        const [x, z] = points[index];
        const distance = Math.hypot(x - player.x, z - player.z);
        if (distance < (index === points.length - 1 ? 1.2 : 1.45)) {
          index++;
          idle = 0;
          continue;
        }
        const turn = Math.atan2(x - player.x, z - player.z) - player.yaw;
        const angle = Math.atan2(Math.sin(turn), Math.cos(turn));
        const speed = Math.min(distance * .85, Math.abs(angle) > .6 ? 1.35 : 4.9);
        __setInput(Math.max(-1, Math.min(1, -angle * 2.8)), g.bikes.speed > speed + .35 ? -.7 : 1);
        g.update(1 / 60);
        travelled += Math.hypot(player.x - x0, player.z - z0);
        x0 = player.x; z0 = player.z;
        replanned ||= g.jobs.displayedBike !== null && g.jobs.displayedBike !== initial;
        if (++idle > 1050) break;
      }
      __setInput(0, -1);
      __step(1 / 60, 90);
      __setInput(undefined, undefined);
      return {
        recalculated: replanned, arrived: index === points.length, travelled,
        target: g.jobs.waypoint?.bikeStation, goalOffset: [target.x - initial.at(-2), target.z - initial.at(-1)],
        prompt: g.bikes.rideLabel(), remaining: Math.hypot(target.x - player.x, target.z - player.z),
      };
    });
    expect(ride).toMatchObject({ arrived: true, recalculated: true, target: to, goalOffset: [0, 0], prompt: 'Vrátit elektrokolo' });
    expect(ride.travelled).toBeGreaterThan(900);
    expect(ride.remaining).toBeLessThan(1.5);
    await page.keyboard.press('f');
    await page.evaluate(() => __step(1 / 60, 6));
    expect(await page.evaluate(([from, to]) => {
      const g = __game;
      return [g.mode, g.bikes.stock[from], g.bikes.stock[to], g.jobs.displayedBike, g.jobs.waypoint];
    }, [from, to])).toEqual(['foot', 0, 2, null, null]);
  });
}

test('E56 – dotyková navigace na obou mapách, přepočet po odbočení a zrušení', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await startAt(page, '43', true);
    await targetStation(page, '57', true);
    const countRoute = selector => {
      const canvas = document.querySelector(selector);
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0x55 && data[i + 1] === 0xef && data[i + 2] === 0xae) count++;
      }
      return count;
    };
    await page.evaluate(() => __step(1 / 60, 12));
    await expect.poll(() => page.evaluate(countRoute, '#minimap')).toBeGreaterThan(4);
    await openMap(page, true);
    await expect(page.locator('#map-route-status')).toHaveText('Cyklistická trasa');
    await expect(page.locator('#map-key-cycling')).toBeVisible();
    await expect.poll(() => page.evaluate(countRoute, '#bigmap-canvas')).toBeGreaterThan(10);
    await page.getByRole('button', { name: 'Zavřít mapu' }).tap();
    const departure = await page.evaluate(() => {
      const { world, player, colliders } = __game;
      const x = 111.5, z = 570.3;
      for (let i = 0; i < 25; i++) colliders.update(x, z);
      player.place(x, z, world.groundY(x, z));
      return [x, z];
    });
    await expect.poll(() => page.evaluate(([x, z]) => {
      __step(1 / 60, 4);
      const { displayedBike, cycling } = __game.jobs;
      if (!displayedBike || displayedBike[0] !== cycling.start.x || displayedBike[1] !== cycling.start.z) return 1e6;
      return Math.hypot(displayedBike[0] - x, displayedBike[1] - z);
    }, departure)).toBeLessThan(.015);
    await openMap(page, true);
    await page.getByRole('button', { name: 'Zrušit cíl' }).tap();
    await expect(page.locator('#map-route-status')).toBeEmpty();
    expect(await page.evaluate(() => __game.jobs.displayedBike)).toBeNull();
  } finally { await context.close(); }
});

test('E56 – chybějící síť ponechá vybrané stanoviště a ukáže stav', async ({ page }) => {
  await page.route('**/data/cycle-network.bin', route => route.fulfill({ status: 503 }));
  await startAt(page, '43');
  await openMap(page);
  await page.getByRole('searchbox').fill('Pilsen Bike DEPO 2015');
  await page.getByRole('button', { name: 'DEPO 2015 · Pilsen Bike', exact: true }).click();
  await page.getByRole('button', { name: 'Navigovat sem' }).click();
  await expect.poll(() => page.evaluate(() => {
    __step(1 / 60, 4);
    return __game.jobs.cycling.status;
  })).toBe('Cyklistickou síť se nepodařilo načíst.');
  await openMap(page);
  await expect(page.locator('#map-route-status')).toHaveText('Cyklistickou síť se nepodařilo načíst.');
  expect(await page.evaluate(() => [__game.jobs.waypoint?.bikeStation, __game.jobs.displayedBike])).toEqual(['57', null]);
});
