import { test, expect } from '@playwright/test';
import { waitForGame } from './ready.js';
import { gameUrl } from './game-url.js';

for (const saved of [false, true]) {
  test('Kilometr před vstupem do hry ' + (saved ? 'v Rokycanech po načtení' : 'u nové postavy'), async ({ page }) => {
    if (saved) await page.addInitScript(() => localStorage.setItem('plzen-naplno-v1',
      JSON.stringify({ v: 2, x: 15703, z: 598, money: 777 })));
    await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
    await waitForGame(page);
    const result = await page.evaluate(() => {
      const g = window.__game, m = g.chunks, w = g.world, { x, z } = g.focus;
      const original = new Map(m.chunks);
      let missing = 0, hidden = 0;
      for (let cz = 0; cz < w.rows; cz++) for (let cx = 0; cx < w.cols; cx++) {
        const left = w.minX + cx * 256, top = w.minZ + cz * 256;
        if (Math.hypot(Math.max(left-x, x-left-256, 0), Math.max(top-z, z-top-256, 0)) > 1000) continue;
        const ch = original.get(cz * w.cols + cx);
        if (!ch || ch.stage !== 4 || !ch.tex) missing++;
        if (ch && !ch.group.visible) hidden++;
      }
      g.update(1/60);
      const retained = [...original].every(([id,ch]) => m.chunks.get(id) === ch);
      m.update(x + 4000, z, 620, 1);
      const oldLeft = [...original.keys()].some(id => m.chunks.has(id));
      return { x, missing, hidden, retained, oldLeft };
    });
    expect(result.missing).toBe(0);
    expect(result.hidden).toBeGreaterThan(0);
    expect(result.retained).toBe(true);
    expect(result.oldLeft).toBe(false);
    expect(Math.abs(result.x - (saved ? 15703 : -42))).toBeLessThan(25);
    await expect(page.locator('#btn-play')).toBeVisible();
  });
}

test('rozpracovaná vozovka po dokončení odpovídá jednorázovému sestavení', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0'));
  await waitForGame(page);
  const result = await page.evaluate(() => {
    const g = __game, manager = g.chunks, { x, z } = g.focus;
    const id = g.world.chunkIndex(x, z);
    const fingerprint = ch => {
      const geo = ch.asphalt.geometry;
      let sum = 0;
      for (const value of geo.getAttribute('position').array) sum += value;
      return [sum, geo.index.count, ch.marks.geometry.index.count];
    };
    const first = fingerprint(manager.chunks.get(id));
    manager.update(x + 4000, z, 0, 0);
    manager.update(x, z, 0, 1);
    manager.update(x, z, 0, 1);
    const ch = manager.chunks.get(id);
    manager._step(id, ch, x, z, -Infinity);
    const partial = ch.stage === 2 && Boolean(ch.roadWork) && !ch.asphalt;
    for (let i = 0; i < 500 && ch.stage < 4; i++) manager.update(x, z, 0, 1);
    return { first, second: fingerprint(ch), partial, finished: ch.stage === 4 && !ch.roadWork };
  });
  expect(result.partial).toBe(true);
  expect(result.finished).toBe(true);
  expect(result.second).toEqual(result.first);
});
