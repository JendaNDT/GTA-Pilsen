import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('E12 – Krkavec, policejní pokuta a nákup s nízkým zůstatkem přímo u garáže', async ({ page }, info) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Hrát', exact: true }).click();
  const krkavec = await page.evaluate(() => {
    window.__freeze(true);
    const g = window.__game;
    const tower = g.jobs.landmarks.find((landmark) => landmark.name === 'Rozhledna Krkavec');
    const p = g._clearSpot(tower.x, tower.z, 0.6);
    g.player.place(p.x, p.z);
    g.jobs.checkTimer = 0;
    g.jobs.update(0);
    const nearest = Math.min(...g.world.meta.food.map(([x, z]) => Math.hypot(x - p.x, z - p.z)));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ' }));
    window.__step(0.01);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyJ' }));
    return { nearest, found: tower.found, active: g.jobs.job?.type ?? null };
  });
  expect(krkavec.found).toBe(true);
  expect(krkavec.nearest).toBeGreaterThan(1400);
  expect(krkavec.active).toBeNull();
  await expect(page.locator('#toast')).toContainText('V okolí není dostupný rozvoz');

  const police = await page.evaluate(() => {
    const g = window.__game;
    g.player.place(-42, 52);
    // Použij stejnou továrnu na hlídky jako hra a ověř skutečný práh zatčení.
    let patrol;
    for (let i = 0; i < 60 && !patrol; i++) patrol = g.vehicles.spawnPolice(g.player, null);
    if (!patrol) throw new Error('V centru se nepodařilo vypravit hlídku.');
    patrol.place(g.player.x + 5, g.player.z + 1, 0);
    const before = g.money;
    g.addWanted(1, 'Zkušební pátrání');
    for (let i = 0; i < 40; i++) g._updateWanted(0.05);
    const beforeThreshold = g.wanted === 1 && g.money === before && !g.stats.busted;
    for (let i = 0; i < 12; i++) g._updateWanted(0.05);
    const destination = [g.player.x, g.player.z];
    g.vehicles.remove(patrol);
    return { beforeThreshold, fine: before - g.money, arrests: g.stats.busted, wanted: g.wanted, destination };
  });
  expect(police).toMatchObject({ beforeThreshold: true, fine: 200, arrests: 1, wanted: 0 });
  await expect(page.locator('#toast')).toContainText('Zatčen! Pokuta 200 Kč');

  await page.evaluate(() => {
    const g = window.__game;
    g.garage.navigate();
    const { x, z } = g.jobs.waypoint;
    g.player.place(x + 8, z);
  });
  await page.locator('#btn-menu').click();
  await page.getByRole('button', { name: 'Garáž', exact: true }).click();
  await expect(page.getByRole('button', { name: /Koupit malé auto/ })).toBeDisabled();
  const garage = await page.evaluate(() => {
    const g = window.__game, before = localStorage.getItem('plzen-naplno-v1');
    const message = g.garage.perform('buy');
    return { near: g.garage.near, money: g.money, message, owned: g.garage.owned,
      unchanged: localStorage.getItem('plzen-naplno-v1') === before };
  });
  expect(garage).toMatchObject({ near: true, message: 'Na nákup nemáš dost peněz.', owned: null, unchanged: true });
  expect(garage.money).toBeLessThan(1350);
  await info.attach('kontrolní scénáře', { body: JSON.stringify({ krkavec, police, garage }), contentType: 'application/json' });
});
