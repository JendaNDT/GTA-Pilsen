import { expect, test } from '@playwright/test';

test('HTML otevřené z disku ukazuje spouštěč místo rozbitého menu', async ({ page }) => {
  for (const entry of ['index.html', 'dist/index.html']) {
    await page.goto(new URL(`../../${entry}`, import.meta.url).href);
    await expect(page.getByText('Spustit hru.command', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Otevřít běžící hru' })).toHaveAttribute('href', 'http://localhost:5173/');
    await expect(page.getByText('Načítám město…')).toHaveCount(0);
  }
});
