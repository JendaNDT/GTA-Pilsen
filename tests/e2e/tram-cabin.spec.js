import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { action, approach, boot } from './transit-steps.js';
import { waitForGame } from './ready.js';

test('E59 – první vůz Tatry přes Hlavní poštu do zastávky Pod Záhorskem', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    let state = 1729;
    Math.random = () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2 ** 32);
  });
  await boot(page, 'quality=low&adapt=0&date=2026-11-09&hour=10.1', true);
  expect(await approach(page, '685462', 'Náměstí Republiky')).toEqual({ ref: '1', doorOpen: true, boardable: true });
  await action(page);
  expect(await page.evaluate(() => [__game.ride.event.trip.id, __game.cabin.door])).toEqual(['685462', 6.02]);

  // Čas běží po malých krocích. Po nástupu nepřesouváme vůz ani cestujícího.
  async function travel(until) {
    return page.evaluate(async until => {
      const g = __game, v = g.ride, mesh = v.meshes[0], start = v.s, yaw = mesh.rotation.y;
      let turn = 0, braking = false;
      for (let i = 0; i < 8500; i++) {
        const speed = v.v;
        g.update(1 / 30);
        if (i % 90 === 89) await new Promise(resolve => setTimeout(resolve, 0));
        braking ||= speed > 1 && v.v < speed;
        turn = Math.max(turn, Math.abs(Math.atan2(Math.sin(mesh.rotation.y - yaw), Math.cos(mesh.rotation.y - yaw))));
        if (until === 'rozjezd' ? v.v > 1 : v.stopTarget?.[1] === until && v.canAlight && v.doorFraction >= 0.85) break;
      }
      g.promptTimer = 0;
      window.__step(0);
      return { stop: v.stopTarget?.[1], metres: v.s - start, speed: v.v, turn, braking };
    }, until);
  }
  async function walk(key, steps) {
    await page.keyboard.down(key);
    await page.evaluate(n => window.__step(1 / 60, n), steps);
    await page.keyboard.up(key);
  }
  async function view(name) {
    await page.evaluate(async () => {
      const g = __game;
      await g.chunks.prepareStart(g.focus, 340);
      window.__step(0);
    });
    const path = info.outputPath(name + '.jpg');
    await page.screenshot({ path, style: '#toast { visibility: hidden }' });
    await info.attach(name, { path, contentType: 'image/jpeg' });
    return page.evaluate(() => {
      const g = __game, mesh = g.ride.meshes[0], eye = g.camera.position.clone();
      return { eye: eye.toArray(), local: mesh.worldToLocal(eye).toArray(), seat: g.cabin.seat };
    });
  }
  expect((await travel('rozjezd')).speed).toBeGreaterThan(1);
  await action(page);
  expect(await page.evaluate(() => __game.mode)).toBe('transit');
  await walk('d', 28);
  await walk('w', 46);
  expect(await page.evaluate(() => __game.cabin.action)).toBe('Sednout si');
  await page.screenshot({ path: info.outputPath('ulicka.jpg'), style: '#toast { visibility: hidden }' });
  await action(page);
  expect(await page.evaluate(() => __game.cabin.action)).toBe('Vstát');
  const first = await view('Výhled po odjezdu z náměstí');
  const post = await travel('Hlavní pošta');
  expect(post.stop).toBe('Hlavní pošta');
  expect(post.braking).toBe(true);
  const second = await view('Výhled u Hlavní pošty');
  expect(second.seat).toEqual(first.seat);
  expect(Math.hypot(...first.eye.map((v, i) => v - second.eye[i]))).toBeGreaterThan(100);
  for (let i = 0; i < 3; i++) expect(first.local[i]).toBeCloseTo(second.local[i], 4);
  expect(second.local[0]).toBeCloseTo(second.seat.x, 4);
  expect(second.local[1]).toBeCloseTo(1.93, 4);
  await action(page);
  await walk('w', 157);
  await walk('a', 25);
  const door = await page.evaluate(() => __game.cabin.door);
  expect(door).toBe(0.09);
  const end = await travel('Pod Záhorskem');
  expect(end.stop).toBe('Pod Záhorskem');
  expect(end.braking).toBe(true);
  expect(Math.max(post.turn, end.turn)).toBeGreaterThan(0.45);
  const target = await page.evaluate(z => __game.transit.exitPoint(__game.ride, {}, z), door);
  await action(page);
  const landed = await page.evaluate(() => {
    const g = __game, p = g.player;
    return { mode: g.mode, x: p.x, z: p.z, clear: g._platformClear(p), visible: p.mesh.visible };
  });
  expect(landed).toMatchObject({mode:'foot', clear:true, visible:true});
  expect(Math.hypot(landed.x - target.x, landed.z - target.z)).toBeLessThan(0.5);
  const path = info.outputPath('jizda.json');
  await writeFile(path, JSON.stringify({ first, second, post, end, landed }, null, 2));
  await info.attach('Průběh jízdy', { path, contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('E59 – přerušení jízdy vrací cestujícího na poslední nástupiště', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, 'quality=low');
  for (const interruption of ['čas', 'načtení']) {
    expect((await approach(page, '685462', 'Náměstí Republiky')).boardable).toBe(true);
    await action(page);
    const platform = await page.evaluate(() => {
      const g = __game, v = g.ride;
      for (let i = 0; i < 2000 && v.s < v.stops[g.cabin.stop][0] + 50; i++) window.__advanceTransit();
      if (v.v <= 0 || !g.save()) throw new Error('Ověření vyžaduje uložení za jízdy.');
      return g.cabin.platform;
    });
    if (interruption === 'čas') await action(page, 'KeyN');
    else { await page.reload(); await waitForGame(page); }
    const pos = await page.evaluate(() => ({ mode: __game.mode, x: __game.player.x, z: __game.player.z }));
    expect(pos.mode).toBe('foot');
    expect(Math.hypot(pos.x - platform.x, pos.z - platform.z)).toBeLessThan(0.6);
  }
});

test.describe('dotyk v průchozí tramvaji', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  test('E59 – nástup, chůze páčkou, sednutí, vstávání a konečná Bolevec', async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, 'quality=low');
    expect((await approach(page, '685462', 'Okounová')).boardable).toBe(true);
    const tap = async () => {
      await page.locator('#tb-act').tap();
      await page.evaluate(() => window.__step(1 / 60));
    };
    await tap();
    const choice = await page.evaluate(() => {
      const stick = document.getElementById('stick'), r = stick.getBoundingClientRect();
      for (const [dx, dy, n] of [[1, 0, 28], [0, -1, 46]]) {
        const finger = new Touch({ identifier: 1, target: stick, clientX: r.left + (1 + dx) * r.width / 2,
          clientY: r.top + (1 + dy) * r.height / 2 });
        for (const type of ['touchstart', 'touchend']) {
          stick.dispatchEvent(new TouchEvent(type, { changedTouches: [finger], cancelable: true }));
          if (type === 'touchstart') window.__step(1 / 60, n);
        }
      }
      return __game.cabin.action;
    });
    expect(choice).toBe('Sednout si');
    await tap();
    expect(await page.evaluate(() => __game.cabin.action)).toBe('Vstát');
    await tap();
    expect(await page.evaluate(() => __game.cabin.seat)).toBeNull();
    await tap();
    expect(await page.evaluate(() => __game.cabin.action)).toBe('Vstát');
    const result = await page.evaluate(() => {
      const g = __game, v = g.ride;
      let at;
      for (let i = 0; i < 4300 && g.ride; i++) {
        window.__advanceTransit();
        if (v.stopTarget?.[1] === 'Bolevec') at = g.cabin?.platform ?? at;
      }
      return { mode: g.mode, near: at && Math.hypot(at.x - g.player.x, at.z - g.player.z), clear: g._platformClear(g.player) };
    });
    expect(result).toMatchObject({ mode: 'foot', clear: true });
    expect(result.near).toBeLessThan(0.5);
  });
});

test('E59 – hledání spoje a výstup v přestupním uzlu Náměstí Republiky', async ({ page }) => {
  test.setTimeout(150_000);
  await boot(page, 'quality=low');
  await action(page, 'KeyM');
  await page.getByRole('searchbox').fill('685462');
  await page.getByRole('button', {name:'Průchozí tramvaj · linka 1'}).click();
  await expect(page.locator('#map-access')).toContainText('10:06');
  await page.locator('#bigmap-close').click();
  expect((await approach(page, '685462', 'Anglické nábřeží')).boardable).toBe(true);
  const gates = await page.evaluate(() => {
    const g = __game, p = g.player, v = g.transit.boardable(p.x, p.z, p.y);
    const opposite = v.meshes[0].localToWorld(v.meshes[0].position.clone().set(2.6, 0, 6.02));
    const trailer = v.meshes[1].localToWorld(v.meshes[1].position.clone().set(-2.6, 0, 6.02));
    return [opposite, trailer].map(q => g.transit.boardable(q.x, q.z, q.y) === v);
  });
  expect(gates).toEqual([false, false]);
  await action(page);
  const stop = await page.evaluate(() => {
    const v = __game.ride;
    for (let i = 0; i < 3000; i++) {
      window.__advanceTransit();
      if (v.stopTarget?.[1] === 'Náměstí Republiky' && v.canAlight && v.doorFraction >= 0.85) break;
    }
    return v.stopTarget?.[1];
  });
  expect(stop).toBe('Náměstí Republiky');
  await action(page);
  await expect(page.locator('#stop-transfer')).toContainText('Přestup');
  expect(await page.evaluate(() => __game.mode)).toBe('foot');
});
