import { expect, test } from '@playwright/test';
import { waitForGame } from './ready.js';
import { gameUrl } from './game-url.js';
import { POLICE_STATIONS, BORY_RELEASE } from '../../src/game/police-stations.js';

test('místa návratu leží na volné pěší ploše a služebnu v Rokycanech lze najít na mapě', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await waitForGame(page);
  const blocked = await page.evaluate(points => {
    window.__freeze(true);
    const g = window.__game, w = g.world;
    return points.filter(({ x, z }) => {
      g.chunks.update(x, z, 300, 40, w.groundY(x, z));
      g.colliders.update(x, z);
      const road = w.nearestRoad(x, z, 20, 13);
      return !w.inBounds(x, z, 20) || w.blocked(x, z, 0.9) || w.buildingAt(x, z) >= 0 ||
        w.isWater(x, z) || (road && road.dist < w.r.w[road.road] / 2 + 0.9) ||
        w.blocksTramTrack(x, z, w.groundY(x, z), 0, 2, 2);
    }).map(point => point.name);
  }, [...POLICE_STATIONS, BORY_RELEASE]);
  expect(blocked).toEqual([]);
  await page.click('#btn-play');
  await page.keyboard.press('m');
  await page.locator('#bigmap-query').fill('služebna Rokycany');
  await page.getByRole('button', { name: 'Policie ČR – Rokycany', exact: true }).click();
  await expect(page.locator('#map-name')).toHaveText('Policie ČR – Rokycany');
});

test('zatčení po srážce při prodlevě mezi hvězdami vede na Bory i po načtení hry', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await waitForGame(page);
  await page.click('#btn-play');
  await page.evaluate(() => {
    window.__freeze(true);
    const g = window.__game;
    const car = g.vehicles.cars.find(c => c.mode === 'parked');
    g._enterCar(car);
    g.addWanted(2, 'Poškození veřejného majetku');
    const ped = g.peds.spawnAt(car.x, car.z + 2, 0);
    g.applyPedHit(ped, { car, vx: 0, vz: 10, speed: 10 });
    g.addWanted(1, 'Nebezpečná jízda', { separateEvent: true });
    g.cool = 100;
    g._updateWanted(0.01);
    g.save();
  });
  await page.reload();
  await waitForGame(page);
  const result = await page.evaluate(() => {
    window.__freeze(true);
    const g = window.__game;
    const serious = g.pursuitOffence.serious;
    let patrol;
    for (let i = 0; i < 60 && !patrol; i++) patrol = g.vehicles.spawnPolice(g.focus, null);
    patrol.place(g.focus.x + 5, g.focus.z, 0);
    for (let i = 0; i < 50 && g.wanted; i++) g._updateWanted(0.05);
    const prison = [g.player.x, g.player.z, g.mode, g.wanted, g.pursuitOffence];
    const message = document.querySelector('#toast').textContent;
    g.player.place(15705, 600);
    g.addWanted(1, 'Poškození veřejného majetku');
    g._busted();
    return { serious, prison, message, station: [g.player.x, g.player.z], arrests: g.stats.busted };
  });
  expect(result.serious).toBe(true);
  expect(result.prison).toEqual([BORY_RELEASE.x, BORY_RELEASE.z, 'foot', 0, null]);
  expect(result.message).toContain('Věznice Bory');
  expect(result.message).toContain('Srazil jsi chodce');
  const station = POLICE_STATIONS.find(s => s.name.includes('Rokycany, radnice'));
  expect(result.station).toEqual([station.x, station.z]);
  expect(result.arrests).toBe(2);
});

test('po úniku nebo ošetření začíná nové pátrání bez předchozí srážky', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await waitForGame(page);
  const result = await page.evaluate(() => {
    const g = window.__game;
    for (const car of [...g.vehicles.cars]) if (car.mode === 'police') g.vehicles.remove(car);
    g.addWanted(1, 'Srazil jsi chodce', { serious: true });
    g.cool = 100;
    g._updateWanted(0.01);
    const escaped = g.wanted === 0 && g.pursuitOffence === null;
    g.addWanted(1, 'Srazil jsi chodce', { serious: true });
    g._hospital();
    const treated = g.wanted === 0 && g.pursuitOffence === null;
    g.onPedHit(g.player, g.vehicles.cars[0], 10);
    const bystander = g.pursuitOffence === null;
    g.addWanted(1, 'Poškození veřejného majetku');
    return [escaped, treated, bystander, g.pursuitOffence.serious];
  });
  expect(result).toEqual([true, true, true, false]);
});
