import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('rozvoz kontroluje způsob předání a výškovou úroveň obou adres', async ({ page }) => {
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&view=250'));
  await waitForGame(page);
  const result = await page.evaluate(() => {
    const g = __game;
    g.jobs.start('food');
    g.jobs.checkTimer = 20;
    const j = g.jobs.job, balance = g.money;
    const phases = [];
    for (const target of [j.pick, j.drop]) {
      for (const [mode, height] of [['heli', 100], ['heli', 0], ['foot', -12], ['foot', 0]]) {
        g.mode = mode;
        g.player.place(target.x, target.z, (target.y ?? g.world.groundY(target.x, target.z)) + height);
        g.jobs.update(0.02);
        phases.push(g.jobs.job?.phase ?? 'konec');
      }
    }
    return { phases, earned: g.money - balance, reward: g.jobs.last?.amount, minimum: j.reward };
  });
  expect(result.phases).toEqual(['pickup','pickup','pickup','drop','drop','drop','drop','konec']);
  expect(result.earned).toBe(result.reward);
  expect(result.earned).toBeGreaterThanOrEqual(result.minimum);
});

test('druhý prst řídí výšku nezávisle na páčce vpřed', async ({ browser }) => {
  const context = await browser.newContext({ viewport:{width:850,height:400}, hasTouch:true, isMobile:true });
  try {
    const page = await context.newPage();
    await page.goto(gameUrl('/?debug&quality=low&adapt=0&view=250'));
    await waitForGame(page);
    await page.locator('#btn-play').tap();
    await page.evaluate(() => {
      __freeze(true);
      const g = __game, heli = g.helis[0];
      g._enterHeli(heli);
      g.update(1/30);
      heli.physical.drive = (dt, pitch, turn, lift) => { window.povel = [pitch,lift]; };
      g.update(1/30);
    });
    const box = await page.locator('#stick').boundingBox();
    const stick = {id:1,x:box.x+box.width/2,y:box.y+box.height*.05};
    const session = await context.newCDPSession(page);
    const touch = (type, points) => session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
    const step = () => page.evaluate(() => { __game.update(1/30); return window.povel; });
    for (const [label, lift] of [['Stoupat',1],['Klesat',-1]]) {
      const pedal = await page.locator(lift > 0 ? '#tb-gas' : '#tb-brake').boundingBox();
      const button = {id:2,x:pedal.x+pedal.width/2,y:pedal.y+pedal.height/2};
      await expect(page.locator(lift > 0 ? '#tb-gas' : '#tb-brake')).toHaveAccessibleName(label);
      await touch('touchStart', [stick]);
      const [pitch] = await step();
      expect(pitch).toBeGreaterThan(.8);
      await touch('touchStart', [stick, button]);
      expect(await step()).toEqual([pitch,lift]);
      await touch('touchCancel', []);
      expect(await step()).toEqual([0,0]);
      await touch('touchStart', [button]);
      await touch('touchStart', [button, stick]);
      expect(await step()).toEqual([pitch,lift]);
      await touch('touchEnd', []);
      expect(await step()).toEqual([0,0]);
    }
  } finally { await context.close(); }
});
