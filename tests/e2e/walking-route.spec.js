import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

for (const [name, start, targets] of [
  ['od muzea na lávku přes Strouhu a zpět', [151, 298.4], [[289.5, -41.65], [151, 298.4]]],
  ['z obytné ulice na zastávku Slovany', [1559.2, 2626.6], [[1609.2, 2601.6]]],
]) {
  test('pěší navigace vede ' + name, async ({ page }) => {
    await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
    await waitForGame(page);
    await page.locator('#btn-play').click();
    const result = await page.evaluate(({ start, targets }) => {
      __freeze(true);
      const g = __game, player = g.player, guide = g.jobs.walking;
      player.place(...start);
      const results = [];
      for (const [x, z] of targets) {
        g.jobs.setWaypoint(x, z);
        let tries = 0;
        do {
          guide.update(g.jobs.waypoint, 'foot', player);
        } while (guide.search && ++tries < 5000);
        if (!guide.path) throw new Error(guide.status);
        for (let i = 2; i < guide.path.length; i += 2) {
          const nextX = guide.path[i], nextZ = guide.path[i + 1];
          for (let step = 0; step < 500; step++) {
            const dx = nextX - player.x, dz = nextZ - player.z, d = Math.hypot(dx, dz);
            if (d < 0.35) break;
            player.update(1 / 60, dx / d, dz / d, false, false);
          }
          if (Math.hypot(nextX - player.x, nextZ - player.z) > 1) {
            throw new Error('Překážka na trase u ' + nextX + ', ' + nextZ + ' z ' + player.x + ', ' + player.z);
          }
        }
        g.jobs.update(0);
        results.push(!g.jobs.waypoint && Math.hypot(player.x - x, player.z - z) < 1);
      }
      return results;
    }, { start, targets });
    expect(result).toEqual(targets.map(() => true));
  });
}
