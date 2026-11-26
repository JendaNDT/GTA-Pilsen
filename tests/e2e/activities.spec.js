import { expect, test } from '@playwright/test';
import { ACTIVITY_SITES } from '../../src/game/activity-sites.js';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const [site] = ACTIVITY_SITES;
const match = 'Škodaland · zkušební trasa';

test('E52 – Škodaland se dá najít názvem, adresou, typem i klepnutím na značku', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await waitForGame(page);
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  await page.evaluate(() => { __freeze(true); __game.toggleMap(true); });
  const query = page.getByRole('searchbox', { name: 'Vyhledat v mapě' });
  for (const text of ['skodaland', 'V Lukách 34', 'minigolf']) {
    await query.fill(text);
    await page.getByRole('button', { name: match }).click();
    await expect(page.locator('#map-name')).toHaveText(match);
    await expect(page.locator('#map-access')).toContainText('U Přehrady');
  }
  const position = await page.evaluate(({ x, z }) => {
    const [screenX, screenY] = __game.areaMap.view.screen(x, z);
    __game.areaMap.clearPreview();
    return { x: screenX + 4, y: screenY };
  }, site);
  await page.locator('#bigmap-canvas').click({ position });
  await expect(page.locator('#map-name')).toHaveText(match);
  await page.getByRole('button', { name: 'Navigovat sem' }).click();
  await expect(page.locator('#bigmap')).toBeHidden();
  expect(await page.evaluate(() => __game.jobs.waypoint)).toMatchObject({ x: site.x, z: site.z, name: site.name });
});
