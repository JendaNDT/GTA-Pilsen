import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

for (const [quality, count, size, range] of [
  ['ultra', 4, 2048, 900], ['high', 3, 2048, 750], ['medium', 2, 1024, 600], ['low', 0, 0, 0],
]) {
  test(`E17 – předvolba ${quality} připraví předepsané mapy stínů`, { tag: '@webgpu' }, async ({ page, baseURL }) => {
    const url = new URL(gameUrl(baseURL));
    url.searchParams.set('debug', '');
    url.searchParams.set('quality', quality);
    url.searchParams.set('date', '2026-11-17');
    url.searchParams.set('hour', 10);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url.href);
    await page.waitForFunction(() => window.__ready);
    const shadows = await page.evaluate(() => {
      const { __game: game, __setClock: setClock } = window;
      const { csm, sun } = game.env;
      const maps = csm?.lights.map(({ shadow }) => ({ size: shadow.mapSize.toArray(), ready: Boolean(shadow.map) })) ?? [];
      setClock('2026-11-17', 22);
      const night = csm?.lights.every(({ shadow }) => !shadow.autoUpdate) ?? true;
      setClock('2026-11-17', 10);
      const day = csm?.lights.every(({ shadow }) => shadow.autoUpdate) ?? true;
      return { maps, range: csm?.maxFar ?? 0, camera: csm?.camera === game.camera, enabled: sun.castShadow, night, day };
    });
    expect(shadows.maps).toEqual(Array.from({ length: count }, () => ({ size: [size, size], ready: true })));
    expect(shadows.range).toBe(range);
    expect(shadows.enabled).toBe(count > 0);
    expect(shadows.camera).toBe(count > 0);
    expect(shadows.night && shadows.day).toBe(true);
    expect(errors).toEqual([]);
  });
}
