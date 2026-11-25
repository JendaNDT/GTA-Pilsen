import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

for (const response of ['výpadek', 'neplatný JSON', 'chybný tvar', 'platné jezy']) {
  test('vstup do hry s vrstvou zvuků míst · ' + response, async ({ page }) => {
    await page.route('**/data/sound-places.json', async route => {
      if (response === 'výpadek') return route.abort();
      if (response === 'neplatný JSON') return route.fulfill({ body: '{', contentType: 'application/json' });
      if (response === 'chybný tvar') return route.fulfill({ json: { weirs: {} } });
      return route.continue();
    });
    await page.goto(gameUrl('/?debug&quality=low&adapt=0&view=250'));
    await waitForGame(page);
    await page.locator('#btn-play').click();
    await expect(page.locator('#menu')).toBeHidden();
    expect(await page.evaluate(() => __game.soundPlaces.length > 0)).toBe(response === 'platné jezy');
  });
}
