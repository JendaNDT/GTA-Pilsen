import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

async function openPilot(page, options = '') {
  await page.goto(gameUrl(`/?debug&quality=low&adapt=0&view=450${options}`));
  await page.waitForFunction(() => window.__ready);
}

async function bakePilot(page) {
  return page.evaluate(() => {
    const { chunks } = window.__game;
    for (let i = 0; i < 8; i++) chunks.update(15975, -915, 450, 40);
    const tile = [...chunks.chunks.values()].find((ch) => ch.orthoBitmap);
    return {
      applied: [...chunks.chunks.values()].filter((ch) => ch.orthoBitmap).length,
      ready: [...chunks.chunks.values()].filter((ch) => ch.tex).length,
      pending: chunks.orthophoto?.pending.size ?? 0,
      failures: chunks.orthophoto?.failed.size ?? 0,
      version: tile?.tex.version ?? 0,
    };
  });
}

test('pozdě načtené letecké snímky se doplní do již postaveného terénu', { tag: '@webgpu' }, async ({ page }) => {
  let release;
  const hold = new Promise((resolve) => { release = resolve; });
  await page.route('**/orthophoto/*.webp', async (route) => {
    await hold;
    await route.continue();
  });
  try {
    await openPilot(page);
    await expect.poll(async () => (await bakePilot(page)).pending).toBeGreaterThan(0);
    const before = await bakePilot(page);
    expect(before.applied).toBe(0);
    expect(before.ready).toBeGreaterThan(0);
  } finally {
    release();
  }
  await expect.poll(async () => (await bakePilot(page)).version).toBeGreaterThan(1);
});

test('nedostupné letecké snímky nechají původní povrch a hra pokračuje', async ({ page }) => {
  await page.route('**/orthophoto/*.webp', (route) => route.fulfill({ status: 404 }));
  await openPilot(page);
  await expect.poll(async () => (await bakePilot(page)).failures).toBeGreaterThan(0);
  expect((await bakePilot(page)).ready).toBeGreaterThan(0);
  expect((await bakePilot(page)).applied).toBe(0);
});

test('parametr orthophoto vypne katalog i požadavky na snímky', async ({ page }) => {
  const requests = [];
  page.on('request', (request) => {
    if (request.url().includes('/orthophoto/')) requests.push(request.url());
  });
  await openPilot(page, '&orthophoto=0');
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Letecké snímky krajiny' })).toBeDisabled();
  expect((await bakePilot(page)).ready).toBeGreaterThan(0);
  expect((await bakePilot(page)).applied).toBe(0);
  expect(requests).toEqual([]);
});

test('nastavení leteckých snímků funguje a uloží se i se starším postupem', async ({ page }) => {
  await page.addInitScript(() => {
    const key = 'plzen-naplno-v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ v: 2, x: 15975, z: -915, money: 1234 }));
  });
  await openPilot(page);
  const settings = page.getByRole('button', { name: 'Nastavení', exact: true });
  const checkbox = page.getByRole('checkbox', { name: 'Letecké snímky krajiny' });
  await settings.click();
  await expect(checkbox).toBeChecked();
  await expect.poll(async () => (await bakePilot(page)).applied).toBeGreaterThan(0);
  await checkbox.uncheck();
  await expect.poll(async () => (await bakePilot(page)).applied).toBe(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1'))))
    .toMatchObject({ money: 1234, orthophotoEnabled: false });

  await page.reload();
  await page.waitForFunction(() => window.__ready);
  await settings.click();
  await expect(checkbox).not.toBeChecked();
  expect((await bakePilot(page)).applied).toBe(0);
  await checkbox.check();
  await expect.poll(async () => (await bakePilot(page)).applied).toBeGreaterThan(0);
});
