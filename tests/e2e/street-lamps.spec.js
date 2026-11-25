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

test('pod oběma konci mostu Generála Pattona zůstanou lampy celé pod deskou', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&view=300&hour=22'));
  await page.waitForFunction(() => window.__ready);
  const lamps = await page.evaluate(() => {
    const g = window.__game, w = g.world;
    const pole = (x, z) => {
      const tile = w.chunkIndex(x, z);
      const found = w.lampsInTile(tile).find(l => Math.hypot(x - l.x, z - l.z) < 0.25);
      if (!found) return null;
      const { height, y, lightX, lightZ } = found;
      const level = Math.min(w.deckAt(x, z, Infinity, 0), w.deckAt(lightX, lightZ, Infinity, 0));
      g.colliders.update(x, z);
      while (g.lampBodies.pending.size) g.lampBodies.step(g.clock.now);
      const body = g.lampBodies.bodies.get(found.id);
      return { height, gap: level - 0.94 - (y + height + 0.14 * height / 6.2),
        collisionHeight: body && 2 * (body.GetPosition().GetY() - y) };
    };
    return [pole(-215.98, -315.72), pole(-193.78, -460.47)];
  });
  for (const lamp of lamps) {
    expect(lamp).not.toBeNull();
    expect(lamp.height).toBeGreaterThanOrEqual(4.5);
    expect(lamp.gap).toBeGreaterThan(0.08);
    expect(lamp.collisionHeight).toBeCloseTo(lamp.height, 4);
  }
});
