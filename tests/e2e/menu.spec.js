import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

async function start(page) {
  await page.goto(gameUrl('/?debug&quality=low&view=300&adapt=0&hour=10'));
  await waitForGame(page);
}

test('úvod, pauza za volantem, pojmenovaný cíl a návrat klávesou Esc', async ({ page }) => {
  await start(page);
  await expect(page.locator('#btn-play')).toHaveText('Hrát');
  await expect(page.locator('#btn-map')).toBeHidden();
  await expect(page.locator('#btn-reset')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#btn-play').click();
  await page.evaluate(() => {
    const g = __game, car = g.player.lastCar;
    g.player.place(car.x + 2, car.z);
    g.doAction();
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('#menu-title')).toHaveText('Pauza');
  const snapshot = () => page.evaluate(() => [__game.clock.now, __game.focus.x, __game.focus.z, __game.mode]);
  const frozen = await snapshot();
  expect(frozen[3]).toBe('car');
  await page.locator('#btn-settings').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-settings')).toBeFocused();
  await page.locator('#btn-map').click();
  await page.getByRole('searchbox').fill('Dřevěná lávka přes Strouhu');
  await page.getByRole('button', {name:'Dřevěná lávka přes Strouhu'}).click();
  await page.locator('#map-go').click();
  await expect(page.locator('#menu-objective')).toContainText('Dřevěná lávka přes Strouhu');
  expect(await snapshot()).toEqual(frozen);
  await page.locator('#btn-map').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-map')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#hud')).toBeVisible();
  expect(await page.evaluate(() => __game.paused)).toBe(false);
});

test('dotykem z rozvozu na mapu a zpátky, uložená poloha po obnovení', async ({ browser }) => {
  const context = await browser.newContext({ viewport:{width:780,height:390}, hasTouch:true, isMobile:true });
  try {
    const page = await context.newPage();
    await start(page);
    await page.locator('#btn-jobs').tap();
    await page.locator('[data-job="car"]').tap();
    await page.locator('#btn-menu').tap();
    await expect(page.locator('#menu-objective')).toContainText('Dhaba Beas');
    await page.locator('#btn-map').tap();
    await page.locator('#bigmap-close').tap();
    await expect(page.locator('#menu-title')).toHaveText('Pauza');
    await page.locator('#btn-play').tap();
    await expect(page.locator('#hud')).toBeVisible();
    await page.reload();
    await waitForGame(page);
    await expect(page.locator('#btn-play')).toHaveText('Pokračovat');
    await expect(page.locator('#menu-location')).toContainText('Poslední poloha');
    await expect(page.locator('#menu-objective')).toBeHidden();
  } finally { await context.close(); }
});

test('položky všech podnabídek mají čitelný text a vejdou se do telefonu', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await start(page);
  // Kontrast počítáme z barev skutečných prvků včetně nativních tlačítek prohlížeče.
  const unreadableButtons = scope => scope.locator('button:visible').evaluateAll(buttons => {
    function light(css) {
      const channels = css.match(/[\d.]+/g).slice(0, 3).map(value => {
        const s = Number(value) / 255;
        return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
      });
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    }
    return buttons.filter(button => {
      const style = getComputedStyle(button);
      const fg = light(style.color), bg = light(style.backgroundColor);
      return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) < 4.5 ||
        button.scrollWidth > button.clientWidth + 1 || parseFloat(style.fontSize) < 16;
    }).map(button => button.textContent.trim());
  });
  const menu = page.locator('#menu'), card = page.locator('#menu-card'), sheet = page.locator('#menu-sheet');
  for (const viewport of [{width:320,height:568}, {width:780,height:360}]) {
    await page.setViewportSize(viewport);
    expect(await unreadableButtons(menu)).toEqual([]);
    for (const section of ['rides','settings','jobs','garage','shifts','help','about','save']) {
      const trigger = page.locator('#btn-' + section);
      await trigger.click();
      await expect(page.locator('#panel-' + section)).toBeVisible();
      expect(await unreadableButtons(sheet)).toEqual([]);
      if (section === 'shifts') {
        const select = page.locator('#shift-offer');
        const option = select.locator('option').last();
        await select.selectOption(await option.getAttribute('value'));
        const [from, to] = (await option.textContent()).split(' · ')[1].split(' → ');
        await expect(page.locator('#shift-direction')).toContainText(from + ' · konec směny ' + to);
      }
      for (const box of [card,sheet]) {
        expect(await box.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      }
      const last = page.locator('#panel-' + section).locator('button:visible,input:visible,a:visible,td:visible,p:visible').last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      expect((await last.boundingBox()).y).toBeLessThan((await page.locator('#credits').boundingBox()).y);
      await page.locator('#menu-back').click();
      await expect(trigger).toBeFocused();
    }
  }
  await page.locator('#btn-photo').click();
  await expect(page.locator('#photo-controls')).toBeVisible();
  expect(await unreadableButtons(page.locator('#photo-controls'))).toEqual([]);
});

test('E61 – výběr čtyř spojů z úvodu a pauzy podle linky, vozu a směru', async ({ page }) => {
  await start(page);
  const rides = page.getByRole('button', { name: 'Svézt se MHD', exact: true });
  const options = page.locator('#ride-options').getByRole('button');
  await expect(options).toHaveCount(0);
  await rides.click();
  await expect(options).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(options).toHaveCount(0);
  await expect(rides).toBeFocused();
  for (const [name, id, destination] of [
    ['1 Tramvaj Tatra Směr Bolevec', '685462', 'Bolevec'],
    ['1 Článková tramvaj Směr Bolevec', '685463', 'Bolevec'],
    ['33 Autobus SOR Směr Hlavní nádraží', '688856', 'Hlavní nádraží'],
    ['49 Trolejbus Směr Karlov', '692185', 'Karlov'],
  ]) {
    await rides.click();
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('#menu')).toBeHidden();
    expect(await page.evaluate(() => [__game.ride.event.trip.id, __game.ride.destination, !!__game.cabin]))
      .toEqual([id, destination, true]);
    await page.locator('#btn-menu').click();
    await expect(rides).toHaveAttribute('aria-expanded', 'false');
  }
});

test('E61 – rozjetý rozvoz zobrazí důvod v nabídce spojů a zůstane aktivní', async ({ page }) => {
  await start(page);
  await page.locator('#btn-jobs').click();
  await page.locator('[data-job="car"]').click();
  await page.locator('#btn-menu').click();
  await page.getByRole('button', { name: 'Svézt se MHD' }).click();
  await page.getByRole('button', { name: '49 Trolejbus Směr Karlov' }).click();
  await expect(page.locator('#ride-feedback')).toContainText('nejdřív ukonči rozjetou aktivitu');
  await expect(page.locator('#panel-rides')).toBeVisible();
  expect(await page.evaluate(() => !!__game.jobs.job && !__game.cabin)).toBe(true);
});
