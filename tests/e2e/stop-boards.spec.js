import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('Označníky všech stanovišť a odjezdy u fyzického označníku', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0&hour=10'));
  await waitForGame(page);
  const report = await page.evaluate(async () => {
    const g = window.__game,
      stops = g.world.transitStops,
      table = g.transit.timetable;
    const missed = table.stops.filter(
      (row, i) => !stops.signs.some((s) => s.index === i && s.code === row[3] && s.name === row[0])
    );
    const bad = stops.signs.filter((s) => !s.lines.length || stops.nearest(s.x, s.z) !== s.index);
    const sign = stops.signs.find((s) => s.code === '53408/4');
    const tile = g.world.chunkIndex(sign.x, sign.z);
    g.player.place(sign.x, sign.z);
    for (let i = 0; i < 60; i++) {
      g.chunks.update(sign.x, sign.z, 340, 40, g.player.y);
      if (g.chunks.chunks.get(tile)?.stopBoards?.length) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    g.updateDepartures();
    const all = [...stops.tiles.values()].flat();
    return {
      missed: missed.length,
      bad: bad.map((s) => s.code),
      codes: new Set(stops.signs.map((s) => s.code)).size,
      expected: table.stops.length,
      shelter: all.some((f) => f.kind === 'shelter'),
      bench: all.some((f) => f.kind === 'bench'),
      boards: g.chunks.chunks.get(tile)?.stopBoards?.length,
      assigned: table.stops[stops.nearest(sign.x, sign.z)][3]
    };
  });
  expect(report.missed).toBe(0);
  expect(report.bad).toEqual([]);
  expect(report.codes).toBe(report.expected);
  expect(report.assigned).toBe('53408/4');
  expect(report.boards).toBeGreaterThan(0);
  expect(report.bench && report.shelter).toBe(true);
  await expect(page.locator('#stop-name')).toHaveText('Hlavní nádraží · stan. 4');
});

test('Bez doplňkových údajů OSM mají zastávky dál názvy a linky', async ({ page }) => {
  await page.route('**/data/stop-survey.json', (route) => route.abort());
  await page.goto(gameUrl('/?debug&quality=low&view=300&adapt=0&hour=10'));
  await waitForGame(page);
  expect(
    await page.evaluate(() => {
      const { world, transit } = window.__game;
      return (
        world.transitStops.signs.length === transit.timetable.stops.length &&
        world.transitStops.signs.every((s) => s.name && s.lines.length) &&
        [...world.transitStops.tiles.values()].flat().every((s) => s.kind === 'stopBoard')
      );
    })
  ).toBe(true);
});
