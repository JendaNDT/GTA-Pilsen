import { expect, test } from '@playwright/test';
import { waitForGame } from './ready.js';
import { gameUrl } from './game-url.js';

const key = 'plzen-naplno-v1';
const url = () => gameUrl('/?debug&adapt=0&quality=low&view=250');

async function seed(page, record) {
  await page.goto('/data/sound-places.json');
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify(s)), [key, record]);
}

test('vadné pole památek zachová peníze a umožní otevřít nabídku', async ({ page }) => {
  await seed(page, { v: 2, money: 950, found: {} });
  await page.goto(url());
  await waitForGame(page);
  expect(await page.evaluate(() => __game.money)).toBe(950);
  expect(await page.evaluate(() => __game.jobs.landmarks.some(l => l.found))).toBe(false);
});

test('potvrzený nový začátek přežije odchod ze stránky i druhé obnovení', async ({ page }) => {
  await seed(page, { v: 2, money: 2713, found: ['Synagoga'] });
  await page.goto(url());
  await waitForGame(page);
  await page.locator('#btn-save').click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#btn-reset').click();
  expect(await page.evaluate(() => __game.money)).toBe(2713);
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('#btn-reset').click()]);
  await waitForGame(page);
  await page.reload();
  await waitForGame(page);
  await expect(page.locator('#btn-play')).toHaveText('Hrát');
  expect(await page.evaluate(() => [__game.money, __game.garage.owned, __game.jobs.landmarks.filter(l => l.found).length])).toEqual([500, null, 0]);
});

test('odchod z druhé karty zachová poslední výdělek', async ({ page, context }) => {
  await page.goto(url());
  await waitForGame(page);
  const other = await context.newPage();
  await other.goto(url());
  await other.waitForFunction(() => window.__ready || document.getElementById('loadtext')?.textContent.includes('jiné kartě'));
  expect(await page.evaluate(() => __game.commitAccount({ money: 1150 }))).toBe(true);
  await other.goto('about:blank');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).money, key)).toBe(1150);
});

for (const fallback of [false, true]) {
  test('předání mezi kartami načte nejnovější stav přes ' + (fallback ? 'IndexedDB' : 'Web Locks'), async ({ context, page }) => {
    if (fallback) await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
    await page.goto(url());
    await waitForGame(page);
    const other = await context.newPage();
    await other.goto(url());
    await expect(other.locator('#btn-transfer')).toBeVisible();
    expect(await page.evaluate(() => __game.commitAccount({ money: 1150 }))).toBe(true);
    await other.locator('#btn-transfer').click();
    await waitForGame(other);
    expect(await other.evaluate(() => __game.money)).toBe(1150);
    await expect(page.locator('#btn-transfer')).toBeVisible();
    await other.locator('#btn-save').click();
    other.once('dialog', dialog => dialog.accept());
    await other.locator('#btn-reset').click();
    await waitForGame(page);
    expect(await page.evaluate(() => __game.money)).toBe(500);
    await other.close();
    expect(await page.evaluate(k => localStorage.getItem(k), key)).toBeNull();
  });
}

test('pouhé otevření nabídky zachová záznam novější verze', async ({ page }) => {
  const record = { v: 3, money: 999, custom: 'novější verze' };
  await seed(page, record);
  await page.goto(url());
  await waitForGame(page);
  await page.goto('/data/sound-places.json');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)), key)).toEqual(record);
});

test('chyba při smazání zachová postup a dovolí reset zopakovat', async ({ page }) => {
  await seed(page, { v: 2, money: 2713 });
  await page.goto(url());
  await waitForGame(page);
  await page.evaluate(() => {
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key) {
      Storage.prototype.removeItem = remove;
      throw new Error('Zkušební chyba při mazání');
    };
  });
  await page.locator('#btn-save').click();
  const messages = [];
  page.on('dialog', async dialog => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page.locator('#btn-reset').click();
  expect(messages.at(-1)).toContain('nepodařilo smazat');
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k)).money, key)).toBe(2713);
  await Promise.all([page.waitForEvent('domcontentloaded'), page.locator('#btn-reset').click()]);
  await waitForGame(page);
  expect(await page.evaluate(() => __game.money)).toBe(500);
});

test('po nečekaném zavření spojení IndexedDB stará karta nesmí zapsat', async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      const request = open.apply(this,args);
      request.addEventListener('success', () => { window.testConnection = request.result; });
      return request;
    };
  });
  await page.goto(url());
  await waitForGame(page);
  expect(await page.evaluate(() => __game.commitAccount({money:1150}))).toBe(true);
  const result = await page.evaluate(k => {
    testConnection.close();
    testConnection.dispatchEvent(new Event('close'));
    return [__game.commitAccount({money:500}),JSON.parse(localStorage.getItem(k)).money];
  },key);
  expect(result).toEqual([false,1150]);
});
