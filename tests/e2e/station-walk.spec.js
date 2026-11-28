import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E73 – vystupující z linky 49 dojde od předních dveří přes Mikulášskou k nádražní budově', async ({ page }) => {
  await page.setViewportSize({ width: 720, height: 400 });
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&hour=9.8'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const result = await page.evaluate(async () => {
    __freeze(true);
    const g = __game, { player, world, peds, transit, clock } = g;
    const event = transit.timetable.events(clock.day).find(e => e.day === clock.day && e.trip.id === '692216');
    const index = event.trip.stops.length - 1;
    player.place(745, 344);
    __setClock('2026-11-09', event.trip.times[index * 2] / 3600);
    const vehicle = transit.active.get(event.key);
    const loaded = () => [...g.chunks.heritage.streetSections.values()].flat().some(f => f.id.includes('8118968785'));
    const deadline = performance.now() + 45_000;
    while (!loaded()) {
      if (performance.now() > deadline) throw Error('U vstupu chybí vybavení přednádraží.');
      g.chunks.update(700, 420, 340, 60, player.y);
      await new Promise(resolve => setTimeout(resolve, 15));
    }
    const focus = { x: player.x, z: player.z };
    let walker, exit, doorDistance, distance = 0, maxStep = 0, blocked = 0, roadEntry = null, viaMikulasska = false;
    for (let i = 0; i < 4600; i++) {
      if (i < 150) transit.update(0.1, focus, [], false, clock);
      const x = walker?.x, z = walker?.z;
      peds.update(0.1, focus, null, []);
      if (!walker) {
        walker = peds.peds.find(p => p.state === 'alight' && p.service === vehicle);
        if (walker) {
          const door = transit.exitPoint(vehicle, {});
          doorDistance = Math.hypot(walker.x - door.x, walker.z - door.z);
        }
      } else {
        const step = Math.hypot(walker.x - x, walker.z - z);
        distance += step;
        maxStep = Math.max(maxStep, step);
        if (walker.state === 'walk') {
          const y = world.walkY(walker.x, walker.z, walker.y);
          if (!roadEntry && world.onCarriageway(walker.x, walker.z, y)) roadEntry = [walker.x, walker.z];
          if (world.collideCircle(walker.x, walker.z, 0.31, y + 0.24, y + 1.6)) blocked++;
        }
        viaMikulasska ||= Math.hypot(walker.x - 618.1, walker.z - 461) < 1;
        if (!peds.peds.includes(walker)) { exit = [walker.x, walker.z]; break; }
      }
    }
    return { exit, doorDistance, distance, maxStep, blocked, roadEntry, viaMikulasska };
  });
  expect(result, JSON.stringify(result)).toMatchObject({ blocked: 0, roadEntry: null, viaMikulasska: true });
  expect(result.doorDistance).toBeLessThan(4);
  expect(result.distance).toBeGreaterThan(300);
  expect(result.maxStep).toBeLessThan(0.18);
  expect(Math.hypot(result.exit[0] - 727.01, result.exit[1] - 481.92)).toBeLessThan(1);
});
