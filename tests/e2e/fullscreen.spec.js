import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function overitCelouObrazovku(page, zapnuta) {
  // Prohlížeč může změnit režim o snímek dříve, než hře doručí fullscreenchange.
  await expect.poll(() => page.evaluate(() => {
    const tlacitko = document.getElementById('btn-fullscreen');
    return {
      celaObrazovka: Boolean(document.fullscreenElement),
      stisknuto: tlacitko.getAttribute('aria-pressed'),
      napoveda: tlacitko.title,
    };
  })).toEqual({
    celaObrazovka: zapnuta,
    stisknuto: String(zapnuta),
    napoveda: zapnuta ? 'Zpět do okna' : 'Celá obrazovka',
  });
}

test('po kliknutí na Hrát běží hra přes celou obrazovku a tlačítko ⛶ ji přepíná', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // starší uložená hra bez volby celé obrazovky
  await page.addInitScript(() => {
    if (!localStorage.getItem('plzen-naplno-v1')) {
      localStorage.setItem('plzen-naplno-v1', JSON.stringify({ v: 2, money: 640, hour: 10 }));
    }
  });
  await page.goto(gameUrl('/?debug&adapt=0&quality=low&view=350&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  await expect(page.locator('#fullscreen-play')).toBeChecked();
  await page.locator('#btn-play').click();
  await overitCelouObrazovku(page, true);
  await page.locator('#btn-fullscreen').click();
  await overitCelouObrazovku(page, false);
  await page.locator('#btn-fullscreen').click();
  await overitCelouObrazovku(page, true);

  // Opuštění režimu mimo tlačítko hry vyvolá stejnou událost pro stránku jako Esc v prohlížeči.
  await page.evaluate(() => document.exitFullscreen());
  await overitCelouObrazovku(page, false);
  await page.locator('#btn-fullscreen').click();
  await overitCelouObrazovku(page, true);
  // uložená hra se načetla (u katedrály hráč hned objeví první památku a dostane odměnu)
  const loaded = await page.evaluate(() => ({ save: window.__game.hasSave, money: window.__game.money }));
  expect(loaded.save).toBe(true);
  expect(loaded.money).toBeGreaterThanOrEqual(640);
  expect(errors).toEqual([]);
});

test('vypnutá volba v nastavení se uloží a Hrát pak celou obrazovku nezapne', async ({ page }) => {
  await page.goto(gameUrl('/?debug&adapt=0&quality=low&view=350&date=2026-11-09&hour=10'));
  await page.waitForFunction(() => window.__ready);
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.locator('#fullscreen-play').uncheck();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1')).fullscreenEnabled)).toBe(false);
  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await expect(page.locator('#fullscreen-play')).not.toBeChecked();
  await page.locator('#btn-play').click();
  await page.waitForTimeout(500);
  await overitCelouObrazovku(page, false);
});
