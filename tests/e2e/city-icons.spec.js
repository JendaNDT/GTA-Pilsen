import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E43 – dvanáct areálů funguje na nízké předvolbě i po výměně dlaždic', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(gameUrl('/?debug&quality=low&view=400&adapt=0&hour=11'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => window.__freeze(true));
  const tour = [
    [697, 82],
    [971, -440],
    [-69, 331],
    [545, -278],
    [-449, 1015],
    [187, 3],
    [-1118, 765],
    [-1089, 897],
    [94, 205],
    [2313, 2087, 'TechTower a Světovar'],
    [310, 1068],
    [-1179, -1343, 'Lochotínský amfiteátr'],
    [22, -3180, 'Statek U Matoušů'],
    [3809, -2208, 'Rozhledna Chlum'],
    [697, 82],
  ];
  for (const [x, z, outer] of tour) {
    await page.waitForFunction(
      ([x, z, outer]) => {
        const g = window.__game,
          w = g.world,
          c = g.chunks;
        c.update(x, z, 450, 80);
        const tile = c.chunks.get(w.chunkIndex(x, z));
        const mesh = tile?.group?.getObjectByName(outer ?? 'Dominanty Plzně');
        if (!mesh?.material.map.image?.width) return false;
        window.__view(x + 28, w.heightAt(x, z) + 42, z + 35, x, w.heightAt(x, z) + 4, z);
        return mesh.geometry.attributes.position.count > 0;
      },
      [x, z, outer],
      { timeout: 18000 },
    );
  }
  const gate = await page.evaluate(() => {
    const w = window.__game.world,
      g = w.heritage.breweryGate;
    if (!g) return null;
    const angle = Math.atan2(0.45, 0.89),
      p = (u, d) => [
        696.9 + Math.cos(angle) * u - Math.sin(angle) * d,
        81.8 + Math.sin(angle) * u + Math.cos(angle) * d,
      ];
    return [-3, 0, 3].map((u) => w.raycast(...p(u, -3), ...p(u, 3), 308.2 - w.baseElevation));
  });
  expect(gate).not.toBeNull();
  expect(gate[0]).toBe(1);
  expect(gate[1]).toBeLessThan(1);
  expect(gate[2]).toBe(1);
  expect(errors).toEqual([]);
});
