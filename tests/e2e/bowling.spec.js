import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

async function arrive(page, mobile = false) {
  await page.goto(gameUrl('/?debug&quality=low&weather=clear&hour=10'));
  await waitForGame(page);
  const play = page.getByRole('button', { name: 'Hrát', exact: true });
  if (mobile) await play.tap(); else await play.click();
  const approached = await page.evaluate(() => {
    __freeze(true);
    const g = __game, p = g.player, w = g.world;
    const x = 634.7, z = 1220.2;
    p.place(x, z, w.groundY(x, z));
    for (let i = 0; i < 25; i++) g.colliders.update(x, z);
    let road = false;
    for (let i = 0; i < 180; i++) {
      const dx = 638 - p.x, dz = 1217 - p.z, distance = Math.hypot(dx, dz);
      if (distance < .65) break;
      p.update(1 / 60, dx / distance, dz / distance, false, false);
      road ||= w.onCarriageway(p.x, p.z, p.y);
    }
    __step(1 / 60, 15);
    return { road, metres: Math.hypot(p.x - x, p.z - z), grounded: p.grounded };
  });
  expect(approached).toMatchObject({ road: false, grounded: true });
  expect(approached.metres).toBeGreaterThan(3);
  await expect(page.locator('#prompt')).toContainText('Zahrát bowling');
}

async function enter(page, mobile = false) {
  if (mobile) await page.getByRole('button', { name: 'Zahrát bowling', exact: true }).tap();
  else await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60, 5));
  await expect(page.locator('#bowling-panel')).toBeVisible();
}

async function aim(page, direction) {
  await page.locator('#bowl-aim').evaluate((field, value) => {
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }, direction);
}

test('E57 – vstup z mapy, celá partie, uložení skóre a návrat před budovu', async ({ page }) => {
  test.setTimeout(90000);
  await arrive(page);
  await page.keyboard.press('m');
  await page.evaluate(() => __step(1 / 60));
  await page.getByRole('searchbox').fill('Bowling U Papírny');
  await page.getByRole('button', { name: 'Bowling U Papírny', exact: true }).click();
  await expect(page.locator('#map-access')).toContainText('Papírnická 3');
  await page.getByRole('button', { name: 'Navigovat sem' }).click();
  expect(await page.evaluate(() => [__game.jobs.waypoint.name, __game.jobs.waypoint.x, __game.jobs.waypoint.z]))
    .toEqual(['Bowling U Papírny', 638, 1217]);

  await enter(page);
  const entry = await page.evaluate(() => {
    const g = __game;
    return { time: g.clock.now, x: g.player.x, z: g.player.z, money: g.money };
  });
  await aim(page, '-1');
  await page.keyboard.press('Enter');
  await page.evaluate(() => __step(1 / 60, 52));
  expect(await page.evaluate(() => __game.activities.bowling.lane.ball.GetPosition().GetZ())).toBeGreaterThan(2);
  await page.keyboard.press('f');
  await page.evaluate(() => __step(1 / 60, 415));
  await expect(page.locator('#bowl-status')).toContainText('Strike');
  await expect(page.locator('#bowl-frames li').first().locator('b')).toHaveText('X');

  await aim(page, '22');
  const result = await page.evaluate(() => {
    const { bowling } = __game.activities;
    const setItem = Storage.prototype.setItem;
    try {
      for (let i = 0; i < 18; i++) {
        if (bowling.phase !== 'aim') throw new Error('Před dalším hodem hra čeká na dokončení předchozího.');
        if (i === 17) {
          Storage.prototype.setItem = () => { throw new Error('Zkušební chyba uložení'); };
        }
        __game.doAction();
        __step(1 / 60, 450);
      }
    } finally {
      Storage.prototype.setItem = setItem;
    }
    const g = __game, saved = JSON.parse(localStorage.getItem('plzen-naplno-v1'));
    return {
      complete: bowling.round.complete, frames: bowling.round.frames, points: bowling.round.total,
      time: g.clock.now, x: g.player.x, z: g.player.z, money: g.money,
      best: saved.stats.bowlingBest, pending: saved.activity,
    };
  });
  expect(result).toMatchObject({ ...entry, complete: true, points: 10, best: undefined, pending: 'papirny-bowling' });
  expect(result.frames).toEqual([[10], ...Array.from({ length: 9 }, () => [0, 0])]);
  await expect(page.locator('#bowl-status')).toContainText('Výsledek se nepodařilo uložit.');
  await page.getByRole('button', { name: 'Znovu uložit výsledek' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1'))))
    .toMatchObject({ activity: null, stats: { bowlingBest: 10 } });
  await expect(page.locator('#bowl-record')).toHaveText('Rekord 10');
  await page.getByRole('button', { name: 'Nová partie' }).click();
  await expect(page.locator('#bowl-total')).toHaveText('0 bodů');
  await page.getByRole('button', { name: 'Odejít', exact: true }).click();
  await expect(page.locator('#bowling-panel')).toBeHidden();
  await page.evaluate(() => __step(1 / 60, 10));
  await expect(page.locator('#prompt')).toContainText('Zahrát bowling');
  await page.reload();
  await waitForGame(page);
  expect(await page.evaluate(() => __game.stats.bowlingBest)).toBe(10);
});

test('E57 – dotykový hod na nízkou předvolbu a návrat po přerušené partii', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await arrive(page, true);
    await enter(page, true);
    const shown = await page.evaluate(() => {
      const bowl = __game.activities.bowling;
      const ball = bowl.room.ball.position.clone().project(bowl.room.camera);
      const top = document.querySelector('.bowl-console').getBoundingClientRect().top;
      return ball.y > -1 && (1 - ball.y) * innerHeight / 2 < top - 12;
    });
    expect(shown).toBe(true);
    const range = page.locator('#bowl-power');
    const track = await range.boundingBox();
    await page.touchscreen.tap(track.x + track.width * .48, track.y + track.height / 2);
    await expect(page.locator('#bowl-power-value')).not.toHaveText('75 %');
    await page.getByRole('button', { name: 'Hodit', exact: true }).tap();
    await page.evaluate(() => __step(1 / 60, 450));
    expect(await page.evaluate(() => __game.activities.bowling.round.frames.flat().length)).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plzen-naplno-v1')).activity)).toBe('papirny-bowling');
    await page.reload();
    await waitForGame(page);
    await page.getByRole('button', { name: 'Pokračovat', exact: true }).tap();
    await expect(page.locator('#toast')).toContainText('Bowling byl při načtení přerušen.');
    await expect(page.locator('#bowling-panel')).toBeHidden();
    await expect(page.locator('#prompt')).toContainText('Zahrát bowling');
    expect(await page.evaluate(() => __game.stats.bowlingBest)).toBeUndefined();
  } finally { await context.close(); }
});

for (const mobile of [false, true]) test('E63 – strk do kapsy a návrat ke dráze ' + (mobile ? 'dotykem' : 'na klávesnici'), async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 780 } :
    { width: 1100, height: 700 }, hasTouch: mobile, isMobile: mobile });
  try {
    const page = await context.newPage();
    await arrive(page, mobile);
    await enter(page, mobile);
    const step = n => page.evaluate(n => __step(1 / 60, n), n);
    const visit = page.getByRole('button', { name: 'Ke kulečníku' });
    if (mobile) await visit.tap(); else { await visit.focus(); await page.keyboard.press('Enter'); }
    await step(50);
    await expect(page.getByRole('heading', { name: 'Kulečník U Papírny' })).toBeVisible();
    const visible = await page.evaluate(() => {
      const { pool, room } = __game.activities.bowling;
      const lower = document.getElementById('pool-console').getBoundingClientRect().top;
      const upper = document.querySelector('#pool-panel header').getBoundingClientRect().bottom;
      return [-.68, .68].every(x => [-1.27, 1.27].every(z => {
        const v = room.pool.group.position.clone();
        v.x += x; v.z += z;
        v.project(pool.camera);
        const y = (1 - v.y) * innerHeight / 2;
        return Math.abs(v.x) < 1 && y > upper && y < lower;
      }));
    });
    expect(visible).toBe(true);
    const spot = await page.evaluate(() => {
      const { pool, room } = __game.activities.bowling;
      return [2, 1].map(i => {
        const v = room.pool.balls[i].position.clone();
        room.pool.group.localToWorld(v).project(pool.camera);
        return { x: (1 + v.x) * innerWidth / 2, y: (1 - v.y) * innerHeight / 2 };
      });
    });
    if (mobile) {
      await page.touchscreen.tap(spot[0].x, spot[0].y);
    } else {
      await page.mouse.move(spot[1].x, spot[1].y);
      await page.mouse.down();
      await page.mouse.move(spot[0].x, spot[0].y, { steps: 5 });
      await page.mouse.up();
    }
    const aim = page.locator('#pool-angle-value');
    expect(parseFloat(await aim.textContent())).toBeCloseTo(80, -1);
    await step(1);
    await expect(page.locator('#pool-status')).toHaveText('V kapsách 0 ze 3');
    await expect(page.locator('#pool-hit')).toBeEnabled();
    if (mobile) await page.touchscreen.tap(spot[1].x, spot[1].y);
    else await page.mouse.click(spot[1].x, spot[1].y);
    expect(Math.abs(parseFloat(await aim.textContent()))).toBeLessThan(2);
    await step(1);
    const guide = await page.evaluate(() => __game.activities.bowling.room.pool.guide.scale.x);
    expect(guide).toBeCloseTo(.44 - 3 * .029, 2);
    await page.screenshot({ path: info.outputPath('stul.jpg') });
    if (mobile) {
      const track = await page.locator('#pool-power').boundingBox();
      await page.touchscreen.tap(track.x + track.width * .72, track.y + track.height / 2);
      await expect(page.locator('#pool-power-value')).not.toHaveText('65 %');
      await page.locator('#pool-hit').tap();
    } else {
      await page.keyboard.down('ArrowRight'); await step(12); await page.keyboard.up('ArrowRight');
      await expect(page.locator('#pool-angle-value')).not.toHaveText('0°');
      await page.keyboard.down('ArrowLeft'); await step(12); await page.keyboard.up('ArrowLeft');
      await page.keyboard.press('f');
    }
    await step(1);
    await expect(page.locator('#pool-hit')).toBeDisabled();
    await step(360);
    await expect(page.locator('#pool-status')).toHaveText('V kapsách 1 ze 3');
    await page.locator('#pool-reset').click();
    await expect(page.locator('#pool-status')).toHaveText('V kapsách 0 ze 3');
    await page.locator('#pool-back').click();
    await expect(page.locator('#bowl-total')).toHaveText('0 bodů');
    await page.locator('#bowl-hit').click();
    await step(450);
    expect(await page.evaluate(() => __game.activities.bowling.round.frames.flat().length)).toBe(1);
    await visit.click();
    await page.locator('#pool-back').click();
    expect(await page.evaluate(() => __game.activities.bowling.round.frames.flat().length)).toBe(1);
    await page.locator('#bowl-leave').click();
    await expect(page.locator('#bowling-panel')).toBeHidden();
  } finally { await context.close(); }
});

test('E64 – dva hráči na telefonu, bílá v ruce, černá a odveta', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await arrive(page, true);
    await enter(page, true);
    await page.getByRole('button', { name: 'Osmička pro dva' }).tap();
    const step = n => page.evaluate(n => __step(1 / 60, n), n);
    const status = page.locator('#pool-status');
    const hit = page.locator('#pool-hit');
    await step(50);
    await expect(status).toContainText('Hráč 1 · Otevřený stůl. Rozstřel.');
    expect(await page.evaluate(() => __game.activities.bowling.room.pool.balls.filter(b => b.visible).length)).toBe(16);
    await page.screenshot({ path: info.outputPath('osmicka-telefon.jpg') });
    await hit.tap();
    await step(400);
    await expect(status).toContainText('Hráč 2');
    // Připrav bílou před prostřední kapsu, faul i výsledek pak rozhodne fyzika.
    async function tapTable(x, z) {
      const point = await page.evaluate(([x, z]) => {
        const { room, pool } = __game.activities.bowling;
        const v = room.pool.group.position.clone();
        v.x += x; v.z += z; v.y += .029; v.project(pool.camera);
        return [(v.x + 1) * innerWidth / 2, (1 - v.y) * innerHeight / 2];
      }, [x, z]);
      await page.touchscreen.tap(...point);
    }
    await page.evaluate(() => {
      const { table } = __game.activities.bowling.pool;
      table.place(table.balls[0], .4, 0);
    });
    await tapTable(.55, 0);
    await hit.tap();
    await step(400);
    await expect(status).toContainText('Hráč 1');
    await expect(status).toContainText('Bílá spadla do kapsy.');
    await tapTable(-.3, 0);
    await page.getByRole('button', { name: 'Položit bílou' }).tap();
    await expect(hit).toContainText('Strčit');
    expect(await page.evaluate(() => __game.activities.bowling.pool.table.balls[0].GetPosition().GetX())).toBeCloseTo(-.3, 2);
    await page.evaluate(() => {
      const { table } = __game.activities.bowling.pool;
      table.place(table.balls[8], .15, 0);
    });
    await tapTable(.15, 0);
    await hit.tap();
    await step(420);
    await expect(status).toContainText('Vyhrává hráč 2');
    await expect(hit).toBeDisabled();
    await page.getByRole('button', { name: 'Odveta' }).tap();
    await expect(status).toContainText('Hráč 2 · Otevřený stůl. Rozstřel.');
    await page.getByRole('button', { name: 'Zpět k bowlingu' }).tap();
    await page.getByRole('button', { name: 'Ke kulečníku' }).tap();
    await step(50);
    await expect(status).toHaveText('V kapsách 0 ze 3');
    expect(await page.evaluate(() => __game.activities.bowling.room.pool.balls.filter(b => b.visible).length)).toBe(4);
  } finally { await context.close(); }
});

test('E65 – celá osmička proti počítači na telefonu a soupeřův rozstřel v odvetě', async ({ browser }, info) => {
  test.setTimeout(150000);
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });
  try {
    const page = await context.newPage();
    await arrive(page, true);
    await enter(page, true);
    await page.getByRole('button', { name: 'Ke kulečníku' }).tap();
    await page.getByRole('button', { name: 'Osmička proti počítači' }).tap();
    const hit = page.locator('#pool-hit'), status = page.locator('#pool-status');
    await expect(status).toContainText('Tvůj tah');
    await hit.tap();
    await page.evaluate(() => {
      const game = __game, pool = game.activities.bowling.pool;
      for (let i = 0; !pool.computerDelay && i < 600; i++) game.update(1 / 60);
      game.render();
    });
    await expect(status).toContainText('Na tahu je počítač');
    await expect(hit).toBeDisabled();
    await page.screenshot({ path: info.outputPath('souper.jpg') });
    await page.keyboard.press('f');
    expect(await page.evaluate(() => __game.activities.bowling.pool.table.rolling)).toBe(false);
    // Soupeř i koule běží jen v běžných krocích hry, člověk zahraje z připraveného směru.
    for (let turn = 0; turn < 60; turn++) {
      const state = await page.evaluate(() => {
        const game = __game, pool = game.activities.bowling.pool;
        for (let i = 0; (pool.table.rolling || pool.computerTurn) && i < 5000; i++) game.update(1 / 60);
        __step(1 / 60);
        return { done: pool.table.complete, hand: pool.table.match.inHand };
      });
      if (state.done) break;
      await expect(status).toContainText('Tvůj tah');
      if (state.hand) await hit.tap();
      await hit.tap();
    }
    await expect(status).toContainText(/Vyhráváš|Vyhrává počítač/);
    await page.getByRole('button', { name: 'Odveta' }).tap();
    await page.evaluate(() => __step(1 / 60, 65));
    await expect(status).toContainText('Strk počítače');
    await page.getByRole('button', { name: 'Zpět k bowlingu' }).tap();
    await page.getByRole('button', { name: 'Osmička pro dva' }).tap();
    await page.evaluate(() => __step(1 / 60, 120));
    await expect(status).toContainText('Hráč 1 · Otevřený stůl. Rozstřel.');
  } finally { await context.close(); }
});
