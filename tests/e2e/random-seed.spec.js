import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('ladicí výstupy uvádějí semínko hry', async ({ page }) => {
  await page.goto(gameUrl('/?debug&seed=42&kolony=1&quality=low&hour=10&adapt=0'));
  await waitForGame(page);
  const reportSeed = await page.evaluate(() => {
    window.__game.fullscreenEnabled = false;
    window.__play();
    return window.__kolony(Infinity).seed;
  });
  expect(reportSeed).toBe(42);

  await page.getByRole('button', { name: 'Měření' }).click();
  await expect(page.getByRole('textbox', { name: 'Výsledky měření výkonu' })).toHaveValue(/Semínko 42/);
  await page.evaluate(() => {
    window.__game.jobs.update = () => { throw new Error('Zkušební chyba se semínkem'); };
  });

  const dialog = page.locator('#crash');
  await expect(dialog).toBeVisible();
  await dialog.getByText('Podrobnosti', { exact: true }).click();
  await expect(dialog.locator('pre')).toContainText('Semínko 42');
});
