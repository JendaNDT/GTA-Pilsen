import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

const SAVE_KEY = 'plzen-naplno-v1';

async function boot(page) {
  await page.goto(gameUrl('/?debug&quality=low'));
  await page.waitForFunction(() => window.__ready, null, { timeout: 60_000 });
}

async function panel(page) {
  if (!await page.locator('#menu').isVisible()) await page.locator('#btn-menu').click();
  const button = page.getByRole('button', { name: 'Směny MHD', exact: true });
  if (await button.getAttribute('aria-expanded') === 'false') await button.click();
}

async function start(page, id) {
  await panel(page);
  await page.locator('#shift-offer').selectOption(id);
  await expect(page.locator('#shift-direction')).toContainText('odjezd');
  await page.getByRole('button', { name: 'Nastoupit do směny' }).click();
  await expect(page.locator('#menu')).toBeHidden();
  await page.evaluate(() => window.__freeze(true));
}

test('změna herního času přeruší směnu až po potvrzení', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-09T08:00:00Z'));
  await boot(page);
  await start(page, 'tram/1/53408/3');
  await page.locator('#btn-menu').click();
  await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
  await page.locator('#game-time').fill('18:30');
  const submit = page.getByRole('button', { name: 'Nastavit čas', exact: true });
  page.once('dialog', (dialog) => dialog.dismiss());
  await submit.click();
  expect(await page.evaluate(() => Boolean(window.__game.shifts.active))).toBe(true);
  page.once('dialog', (dialog) => dialog.accept());
  await submit.click();
  expect(await page.evaluate(() => {
    const g = window.__game;
    return { mode: g.mode, hour: g.hour, shift: g.shifts.last.state };
  })).toEqual({ mode: 'foot', hour: 18.5, shift: 'interrupted' });
});

async function drive(page, failWrite) {
  return page.evaluate((failWrite) => {
    const g = window.__game, { shifts, transit, world, clock } = g, run = shifts.active, v = run.vehicle;
    const traffic = world.traffic, before = g.money, dt = 0.05;
    // Samostatné průjezdy ověřují řízení a skutečné semafory bez náhodné kolony.
    transit.vehicles = [v];
    transit.active.clear();
    transit.active.set(v.event.key, v);
    transit._dispatch = () => {};
    const controls = { moveY: 1, handbrake: false };
    const tick = () => {
      clock.tick(dt);
      traffic.tick(dt);
      transit.update(dt, g.focus, [], false, clock, controls);
    };
    const first = v.s;
    for (let i = 0; i < 40; i++) tick();
    const locked = v.s === first && v.v === 0 && v.doorsOpen;
    g.doAction();
    const earlyCloseBlocked = v.doorsOpen;
    let attempts = 0;
    const visited = new Set();
    for (let i = 0; i < 30_000 && shifts.active && !run.pending; i++) {
      const stop = shifts.stop;
      if (v.doorsOpen) {
        controls.moveY = 0;
        if (run.dwell >= 5.01 && (clock.now >= stop.depart || run.index === run.stops.length - 1)) {
          visited.add(stop.i);
          if (failWrite && run.index === run.stops.length - 1) {
            const setItem = Storage.prototype.setItem;
            Storage.prototype.setItem = () => { throw new Error('Zkušební chyba uložení'); };
            try { g.doAction(); } finally { Storage.prototype.setItem = setItem; }
          } else g.doAction();
        }
      } else {
        const distance = stop.s - v.s;
        const p = v.route.posAt(v.s, v.side, {});
        let wanted = Math.min((v.isTram ? 40 / 3.6 : v.roadLimit || 10) - 0.35, Math.sqrt(3.4 * Math.max(0, distance - 0.85)));
        const next = traffic.controlAhead(p.x, p.z, p.tx, p.tz, 42);
        if (next && !run.passed.has(next.control)) {
          const { control, distance: approach } = next;
          const stopSign = control.kind === 'stop' && (run.rule !== control || run.held < 0.7);
          const red = control.kind === 'signal' && traffic.light(control) === 'red';
          if (stopSign || red) wanted = Math.min(wanted, Math.sqrt(3.4 * Math.max(0, approach - 0.9)));
        }
        controls.moveY = v.v > wanted + 0.12 || wanted < 0.12 ? -1 : v.v < wanted - 0.12 ? 1 : 0;
        if (Math.abs(distance) < 1.75 && v.v < 0.22) { g.doAction(); attempts++; }
      }
      if (shifts.active && !run.pending) tick();
    }
    return { locked, earlyCloseBlocked, before, money: g.money, result: shifts.last, pending: run.pending,
      visited: [...visited], attempts, active: !!shifts.active, ride: g.mode, index: run.index, distance: v.s - first,
      target: shifts.stop && shifts.stop.s - v.s, progress: run.served };
  }, failWrite);
}

for (const [name, type, id] of [
  ['tramvaj 1', 'tram', 'tram/1/53408/3'],
  ['trolejbus 16', 'trolleybus', 'trolleybus/16/53408/1'],
  ['autobus 30', 'bus', 'bus/30/57061/4'],
]) {
  test(`E11 – celá směna: ${name}`, async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await boot(page);
    await start(page, id);
    await expect(page.locator('#mission')).toContainText('Dveře otevřeny');
    const spawn = await page.evaluate(() => {
      const { ride, transit, shifts } = window.__game;
      return { type: ride.route.type, stopCount: shifts.active.stops.length,
        copies: transit.vehicles.filter((v) => v.event.key === ride.event.key).length };
    });
    expect(spawn.type).toBe(type);
    expect(spawn.copies).toBe(1);

    const failWrite = type === 'bus';
    const outcome = await drive(page, failWrite);
    await info.attach('výsledek směny', { body: JSON.stringify(outcome), contentType: 'application/json' });
    expect(outcome.locked && outcome.earlyCloseBlocked).toBe(true);
    expect(outcome.distance).toBeGreaterThan(1000);
    expect(outcome.visited, JSON.stringify(outcome)).toHaveLength(spawn.stopCount);
    const result = failWrite ? outcome.pending : outcome.result;
    expect(result.state).toBe('paid');
    expect(result.score).toBeGreaterThanOrEqual(75);
    if (failWrite) {
      expect(outcome.active).toBe(true);
      expect(outcome.money).toBe(outcome.before);
      await panel(page);
      await page.getByRole('button', { name: 'Znovu uložit výsledek' }).click();
    } else {
      expect(outcome.active).toBe(false);
      expect(outcome.ride).toBe('foot');
      expect(outcome.money).toBe(outcome.before + result.amount);
      await panel(page);
    }
    await expect(page.locator('#shift-score')).toContainText(`zastávky ${spawn.stopCount}/${spawn.stopCount}`);
    await boot(page);
    await panel(page);
    await expect(page.locator('#shift-result')).toContainText(`+${result.amount} Kč`);
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
    expect(saved.stats.shifts).toBe(1);
    expect(saved.money).toBe(outcome.before + result.amount);
    expect(saved.shift.active).toBeNull();
    expect(errors).toEqual([]);
  });
}

test('E11 – zrušení, přerušení při načtení a pokutě nepřipíše výplatu', async ({ page }) => {
  await boot(page);
  const id = 'tram/1/53167/4';
  await start(page, id);
  await panel(page);
  await page.getByRole('button', { name: 'Zrušit směnu' }).click();
  await expect(page.locator('#shift-result')).toContainText('Zrušeno');
  await start(page, id);
  await boot(page);
  await panel(page);
  await expect(page.locator('#shift-result')).toContainText('Přerušeno · Načtení uložené hry');
  await start(page, id);
  const money = await page.evaluate(() => {
    const g = window.__game;
    const before = g.money;
    g._busted();
    return before;
  });
  await panel(page);
  await expect(page.locator('#shift-result')).toContainText('Zatčení a pokuta 200 Kč');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), SAVE_KEY);
  expect(saved.stats).not.toHaveProperty('shifts');
  expect(saved.money).toBe(money - 200);
  expect(saved.shift.active).toBeNull();
});
