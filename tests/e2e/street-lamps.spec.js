import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';

for (const mapped of [true, false]) {
  test('U Prodejny má volný označník ' + (mapped ? 's mapovanými sloupy' : 'i bez mapovaných sloupů'), async ({ page }) => {
    if (!mapped) await page.route('**/data/lamp-survey.json', route => route.abort());
    await page.goto(gameUrl('/?debug&quality=low&view=300&hour=22'));
    await page.waitForFunction(() => window.__ready);
    const result = await page.evaluate(() => {
      const w = __game.world, s = w.transitStops.signs.find(stop => stop.code === '53220/2');
      const ci = w.chunkIndex(s.x, s.z), lamps = [];
      for (let row = -1; row <= 1; row++) for (let col = -1; col <= 1; col++) {
        lamps.push(...w.lampsInTile(ci + row * w.cols + col));
      }
      return {
        imported: w.lampSurvey.size > 0,
        distance: Math.min(...lamps.map(l => Math.hypot(l.x - s.x, l.z - s.z))),
        inRoad: lamps.some(l => w.insideOtherCarriageway(-1, l.x, l.z, 0))
      };
    });
    expect(result.imported).toBe(mapped);
    expect(result.distance).toBeGreaterThanOrEqual(1.5);
    expect(result.distance).toBeLessThan(100);
    expect(result.inRoad).toBe(false);
  });
}
