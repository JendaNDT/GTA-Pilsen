import { test, expect } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const SAVE_KEY = 'plzen-naplno-v1';
const SAVED_GAME = JSON.stringify({
  v: 2, money: 4321, fullscreenEnabled: false, found: ['Katedrála sv. Bartoloměje'],
});
const SCREEN = '#crash';

async function openGame(page, params = 'debug') {
  await page.addInitScript(({ key, save }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, save);
  }, { key: SAVE_KEY, save: SAVED_GAME });
  await page.goto(gameUrl(`/?${params}&quality=low&hour=10&adapt=0`));
  await waitForGame(page);
}

function consoleErrors(page, text) {
  const messages = [];
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes(text)) messages.push(message.text());
  });
  return messages;
}

test('jednorázová chyba v prvním snímku nechá běžet simulaci i obraz', async ({ page }) => {
  const errors = consoleErrors(page, 'Zkušební jednorázová chyba');
  await openGame(page, 'debug&chyba=jednorazova');
  await page.evaluate(() => {
    const game = window.__game;
    const render = game.render.bind(game);
    window.renderedFrames = 0;
    game.render = () => { render(); window.renderedFrames++; };
  });
  await page.locator('#btn-play').click();
  await expect.poll(() => errors.length).toBe(1);
  await page.waitForFunction(() => window.__game.time > 0.2 && window.renderedFrames > 3);
  expect(errors).toHaveLength(1);
  await expect(page.locator(SCREEN)).toBeHidden();
});

test('po chybě po nastoupení se stejný stisk F znovu nepoužije', async ({ page }) => {
  const errors = consoleErrors(page, 'Zkušební chyba po nastoupení');
  await openGame(page);
  await page.locator('#btn-play').click();
  await page.evaluate(() => {
    const game = window.__game;
    const car = game.player.lastCar;
    game.player.place(car.x, car.z);
    const doAction = game.doAction.bind(game);
    const updateJobs = game.jobs.update;
    window.actionCalls = 0;
    window.actionFrameTime = game.time;
    game.doAction = () => { window.actionCalls++; doAction(); };
    game.jobs.update = function (...args) {
      if (window.actionCalls === 0) return updateJobs.apply(this, args);
      this.update = updateJobs;
      throw new Error('Zkušební chyba po nastoupení');
    };
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }));
  });
  await expect.poll(() => errors.length).toBe(1);
  await page.waitForFunction(() => window.__game.time > window.actionFrameTime + 0.2);
  expect(await page.evaluate(() => ({ calls: window.actionCalls, mode: window.__game.mode })))
    .toEqual({ calls: 1, mode: 'car' });
  await expect(page.locator(SCREEN)).toBeHidden();
});

test('trvalá chyba zastaví snímky a po odchodu i načtení zachová postup', async ({ page, context }) => {
  const errors = consoleErrors(page, 'Zkušební trvalá chyba');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openGame(page, 'debug&chyba=trvala');
  await page.evaluate(() => {
    const game = window.__game;
    const save = game.save.bind(game);
    window.saveCalls = 0;
    game.save = () => { window.saveCalls++; return save(); };
    document.querySelector('#btn-play').addEventListener('click', () => {
      window.clickedPlayAt = performance.now();
    }, { once: true });
    const logError = console.error.bind(console);
    console.error = (...args) => {
      if (String(args[0]).includes('Zkušební trvalá chyba')) window.firstErrorAt ??= performance.now();
      logError(...args);
    };
    new MutationObserver(() => {
      if (document.querySelector('#crash').open) window.crashOpenedAt = performance.now();
    }).observe(document.querySelector('#crash'), { attributeFilter: ['open'] });
  });
  await page.locator('#btn-play').click();
  await page.evaluate(() => { window.__game.money = 8765; });
  const dialog = page.locator(SCREEN);
  // Přepínač čeká 3 s a k zastavení pak potřebuje tři chybné snímky.
  await expect(dialog).toBeVisible({ timeout: 6500 });
  expect(errors).toHaveLength(3);
  const result = await page.evaluate(async key => {
    const game = window.__game;
    const time = game.time;
    for (let i = 0; i < 5; i++) await new Promise(resolve => requestAnimationFrame(resolve));
    dispatchEvent(new PageTransitionEvent('pagehide'));
    return {
      untilFirstError: window.firstErrorAt - window.clickedPlayAt,
      untilStop: window.crashOpenedAt - window.firstErrorAt,
      time, later: game.time, pausedAudio: game.audio.paused,
      savingEnabled: game.saveEnabled, saveCalls: window.saveCalls, raw: localStorage.getItem(key),
    };
  }, SAVE_KEY);
  expect(result.untilFirstError).toBeGreaterThanOrEqual(2900);
  expect(result.untilStop).toBeGreaterThanOrEqual(0);
  expect(result.untilStop).toBeLessThan(2000);
  expect(result.time).toBeGreaterThan(0);
  expect(result.later).toBe(result.time);
  expect(result.pausedAudio).toBe(true);
  expect(result.savingEnabled).toBe(false);
  expect(result.saveCalls).toBe(0);
  expect(result.raw).toBe(SAVED_GAME);

  await dialog.getByText('Podrobnosti', { exact: true }).click();
  const details = dialog.locator('pre');
  await expect(details).toHaveText(/Zkušební trvalá chyba[\s\S]+\n\s+at /);
  await dialog.getByRole('button', { name: 'Zkopírovat' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Zkopírováno.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await details.innerText());
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  await Promise.all([page.waitForEvent('load'), dialog.getByRole('button', { name: 'Načíst znovu' }).click()]);
  await waitForGame(page);
  await expect(page.getByRole('button', { name: 'Pokračovat' })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.__game.money)).toBe(4321);
});

test('dialog se vejde na telefon a tlačítko reaguje na dotyk', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await openGame(page, 'debug&chyba=trvala');
    await page.locator('#btn-play').tap();
    const dialog = page.locator(SCREEN);
    await expect(dialog).toBeVisible({ timeout: 6500 });
    const reload = dialog.getByRole('button', { name: 'Načíst znovu' });
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 740 });
      const box = await dialog.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await expect(dialog).toBeInViewport({ ratio: 1 });
      const button = await reload.boundingBox();
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
    }
    await dialog.getByText('Podrobnosti', { exact: true }).tap();
    const copy = await dialog.getByRole('button', { name: 'Zkopírovat' }).boundingBox();
    expect(copy.width).toBeGreaterThanOrEqual(44);
    expect(copy.height).toBeGreaterThanOrEqual(44);
    await Promise.all([page.waitForEvent('load'), reload.tap()]);
    await waitForGame(page);
    await expect(page.getByRole('button', { name: 'Pokračovat' })).toBeVisible();
    await expect(dialog).toBeHidden();
  } finally {
    await context.close();
  }
});

test('trvalé chyby vykreslení ve fotorežimu také zastaví hru', async ({ page }) => {
  const errors = consoleErrors(page, 'Zkušební chyba fotorežimu');
  await openGame(page);
  await page.locator('#btn-photo').click();
  await expect(page.locator('#photo-controls')).toBeVisible();
  await page.evaluate(() => {
    window.__game.render = () => { throw new Error('Zkušební chyba fotorežimu'); };
  });
  await expect(page.locator(SCREEN)).toBeVisible();
  expect(errors).toHaveLength(3);
  await page.keyboard.press('Escape');
  await expect(page.locator(SCREEN)).toBeVisible();
});

test('chyby mimo snímek se zapisují do konzole i podrobností a hra běží dál', async ({ page }) => {
  const outsideErrors = consoleErrors(page, 'Zkušební chyba mimo snímek');
  await openGame(page);
  await page.locator('#btn-play').click();
  const before = await page.evaluate(() => {
    const error = new Error('Zkušební chyba mimo snímek');
    dispatchEvent(new ErrorEvent('error', { error }));
    for (let i = 0; i < 3; i++) Promise.reject(error);
    return window.__game.time;
  });
  await expect.poll(() => outsideErrors.length).toBe(4);
  await page.waitForFunction(time => window.__game.time > time + 0.2, before, { timeout: 15000 });
  const dialog = page.locator(SCREEN);
  await expect(dialog).toBeHidden();
  await page.evaluate(() => {
    window.__game.jobs.update = () => { throw new Error('Zkušební chyba snímku'); };
  });
  await expect(dialog).toBeVisible();
  await dialog.getByText('Podrobnosti', { exact: true }).click();
  await expect(dialog.locator('pre')).toContainText('Zkušební chyba mimo snímek');
  await expect(dialog.locator('pre')).toContainText('Zkušební chyba snímku');
});

test('neošetřená chyba při startu zůstane vidět na načítací obrazovce', async ({ page }) => {
  await page.route('**/data/roads.bin', async route => {
    await page.evaluate(() => {
      setTimeout(() => { throw new Error('Zkušební chyba při startu'); }, 0);
    });
    await expect(page.locator('#loadtext')).toContainText('Zkušební chyba při startu');
    await route.continue();
  });
  await page.goto(gameUrl('/?debug&quality=low&hour=10&adapt=0'));
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#loadtext')).toHaveText('Hru se nepodařilo spustit: Zkušební chyba při startu');
  await expect(page.locator('#btn-play')).toBeHidden();
  await expect(page.locator(SCREEN)).toBeHidden();
});

test('bez ladění přepínač chyby nevyvolá a po skutečné chybě skryje podrobnosti', async ({ page }) => {
  await openGame(page, 'chyba=trvala');
  await page.evaluate(() => {
    const draw = WebGL2RenderingContext.prototype.drawElements;
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      if (window.failRender) throw new Error('Zkušební chyba běžného vykreslení');
      window.lastRenderAt = performance.now();
      return draw.apply(this, args);
    };
    if (window.GPUQueue) {
      const submit = GPUQueue.prototype.submit;
      GPUQueue.prototype.submit = function (...args) {
        if (window.failRender) throw new Error('Zkušební chyba běžného vykreslení');
        window.lastRenderAt = performance.now();
        return submit.apply(this, args);
      };
    }
    document.querySelector('#btn-play').addEventListener('click', () => {
      window.clickedPlayAt = performance.now();
    }, { once: true });
  });
  await page.locator('#btn-play').click();
  await page.waitForFunction(() => window.lastRenderAt - window.clickedPlayAt > 3500, null, { timeout: 15000 });
  const dialog = page.locator(SCREEN);
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.__game)).toBeUndefined();
  await page.evaluate(() => { window.failRender = true; });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Podrobnosti')).toBeHidden();
  await expect(dialog.getByRole('button', { name: 'Načíst znovu' })).toBeVisible();
});
