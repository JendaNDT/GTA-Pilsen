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
  expect((await bakePilot(page)).ready).toBeGreaterThan(0);
  expect((await bakePilot(page)).applied).toBe(0);
  expect(requests).toEqual([]);
});
