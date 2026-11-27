import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { action } from './transit-steps.js';

test('E60 – přejít kloub jedničky v zatáčce a vystoupit dveřmi prostředního článku', async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    let seed = 1729;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  });
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=10.2166667&kolony=1'));
  await page.waitForFunction(() => window.__ready);
  // Od stisku tlačítka běží všechny jízdy stejným krokem, včetně prvního snímku.
  await page.getByRole('button', { name: 'Svézt se MHD' }).click();
  const start = page.getByRole('button', { name: '1 Článková tramvaj Směr Bolevec' });
  await start.evaluate(button => button.addEventListener('click', () => __freeze(true), { once: true }));
  await start.click();
  const trip = await page.evaluate(() => {
    __freeze(true);
    const g = __game, v = g.ride;
    const rear = g.transit.exitPoint(v, {}, v.sections[2].doors[0], 2);
    return { id: v.event.trip.id, section: g.cabin.section, rearDoor: v.cabinDoorAt(rear.x, rear.z, rear.y) };
  });
  expect(trip).toEqual({ id: '685463', section: 0, rearDoor: { index: 2, door: 3.25 } });

  async function walk(key, steps) {
    await page.keyboard.down(key);
    await page.evaluate(n => __step(1 / 60, n), steps);
    await page.keyboard.up(key);
  }
  await walk('w', 240);
  const bend = await page.evaluate(async () => {
    const g = __game, v = g.ride, c = g.cabin;
    for (let i = 0; i < 8500; i++) {
      g.update(1 / 30);
      const angle = v.meshes[0].quaternion.angleTo(v.meshes[1].quaternion);
      if (v.v > 1 && angle > 0.10) return { angle, section: c.section, z: c.z };
      if (i % 90 === 89) await new Promise(resolve => setTimeout(resolve, 0));
    }
  });
  expect(bend?.section).toBe(0);
  expect(bend.z).toBeLessThan(-4.5);
  await page.keyboard.down('w');
  const crossing = await page.evaluate(() => {
    const g = __game, c = g.cabin, v = g.ride;
    for (let i = 0; i < 12; i++) {
      const previous = g.camera.position.clone(), section = c.section;
      __step(1 / 60);
      if (section !== c.section) return { section: c.section, speed: v.v,
        angle: v.meshes[0].quaternion.angleTo(v.meshes[1].quaternion), movement: g.camera.position.distanceTo(previous) };
    }
  });
  await page.keyboard.up('w');
  expect(crossing?.section).toBe(1);
  expect(crossing.angle).toBeGreaterThan(0.08);
  expect(crossing.speed).toBeGreaterThan(1);
  expect(crossing.movement).toBeLessThan(0.35);
  await walk('w', 55);
  await action(page);
  expect(await page.evaluate(() => __game.cabin.action)).toBe('Vstát');
  await page.screenshot({ path: info.outputPath('sedadlo-v-oblouku.jpg'), style: '#toast { visibility: hidden }' });

  const stop = await page.evaluate(async () => {
    const g = __game, v = g.ride, start = v.s;
    const waits = [];
    for (let i = 0; i < 8500; i++) {
      g.update(1 / 30);
      if (i % 450 === 449 && !v.doorsOpen && v.v < 0.4) waits.push(g.trafficWaits.chain(v));
      if (v.stopTarget?.[1] === 'Hlavní pošta' && v.canAlight && v.doorFraction >= 0.85) {
        await g.chunks.prepareStart(g.focus, 340);
        __step(0);
        return { metres: v.s - start, section: g.cabin.section, sitting: !!g.cabin.seat };
      }
      if (i % 90 === 89) await new Promise(resolve => setTimeout(resolve, 0));
    }
    throw new Error('Čekání před Hlavní poštou po ' + (v.s - start).toFixed(1) + ' m: ' + JSON.stringify(waits));
  });
  expect(stop.sitting).toBe(true);
  expect(stop.section).toBe(1);
  expect(stop.metres).toBeGreaterThan(30);
  await page.screenshot({ path: info.outputPath('sedadlo-u-posty.jpg'), style: '#toast { visibility: hidden }' });
  await action(page);
  await walk('w', 120);
  await walk('a', 21);
  expect(await page.evaluate(() => __game.cabin.door)).toBe(0);
  const target = await page.evaluate(() => __game.transit.exitPoint(__game.ride, {}, 0, 1));
  await action(page);
  const player = await page.evaluate(() => ({ mode: __game.mode, x: __game.player.x, z: __game.player.z }));
  expect(player.mode).toBe('foot');
  const exitDistance = Math.hypot(player.x - target.x, player.z - target.z);
  expect(exitDistance).toBeLessThan(0.5);
  await info.attach('Průjezd článkovou tramvají', {
    body: JSON.stringify({ crossing, stop, exitDistance }), contentType: 'application/json',
  });
});

test.describe('dotyk v článkové tramvaji', () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  test('E60 – projít oběma měchy do zadního článku a vrátit se do předního', async ({ page }) => {
    await page.goto(gameUrl('/?debug&quality=low'));
    await page.getByRole('button', { name: 'Svézt se MHD' }).tap();
    await page.getByRole('button', { name: '1 Článková tramvaj Směr Bolevec' }).tap();
    await page.evaluate(() => __freeze(true));
    for (const [direction, expected] of [[-1, 2], [1, 0]]) {
      const section = await page.evaluate(direction => {
        const stick = document.getElementById('stick'), r = stick.getBoundingClientRect();
        const touch = new Touch({ identifier: 1, target: stick, clientX: r.left + r.width / 2,
          clientY: r.top + (1 + direction) * r.height / 2 });
        stick.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [touch], cancelable: true }));
        __step(1 / 60, 970);
        stick.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch], cancelable: true }));
        return __game.cabin.section;
      }, direction);
      expect(section).toBe(expected);
    }
  });
});
