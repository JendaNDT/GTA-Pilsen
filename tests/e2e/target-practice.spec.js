import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

const title = 'Sportovní terče v Lobzích';
for (const touch of [false, true]) {
  test('E58 – vyhledat trénink, dojít, zasáhnout a vrátit se · ' + (touch ? 'dotyk' : 'myš'), async ({ browser }) => {
    const context = await browser.newContext(touch ? { isMobile: true, hasTouch: true, viewport: { width: 375, height: 667 } } : {});
    try {
      const page = await context.newPage();
      await page.goto(gameUrl('/?debug&quality=low&view=350&hour=12'));
      await waitForGame(page);
      await page.getByRole('button', { name: 'Hrát', exact: true }).click();
      await page.evaluate(() => {
        __freeze(true);
        const g = __game;
        g.player.place(2838, 1117);
        g.vehicles.spawnTimer = g.peds.timer = 100000;
        for (let i = 0; i < 25; i++) g.colliders.update(g.player.x, g.player.z);
        __step(1/60, 12);
        g.toggleMap(true);
      });
      await page.getByRole('searchbox').fill('terče');
      await page.getByRole('button', { name: title, exact: true }).click();
      await page.getByRole('button', { name: 'Navigovat sem' }).click();
      const approach = await page.evaluate(() => {
        const g = __game, p = g.player, site = g.jobs.waypoint;
        const start = { x: p.x, z: p.z };
        for (let i = 0; i < 1800; i++) {
          const dx = site.x - p.x, dz = site.z - p.z;
          if (Math.hypot(dx,dz) < 1.5) break;
          g.camYaw = Math.atan2(dx,dz);
          __setInput(0, 1);
          g.update(1/60);
        }
        __setInput(0, 0);
        __step(1/60, 16);
        __setInput(undefined, undefined);
        return { walked: Math.hypot(start.x-p.x,start.z-p.z), lane: g.world.onCarriageway(p.x,p.z,p.y), x:p.x, z:p.z };
      });
      expect(approach.walked).toBeGreaterThan(40);
      expect(approach.lane).toBe(false);
      const open = async () => {
        if (touch) await page.getByRole('button', { name: 'Spustit trénink', exact: true }).tap();
        else await page.keyboard.press('f');
        await page.evaluate(() => __step(.016));
        await expect(page.getByRole('dialog', { name: 'Volný trénink' })).toBeVisible();
      };
      await open();
      const disc = page.locator('#target-disc'), field = page.locator('#target-field');
      const first = await disc.boundingBox();
      await page.evaluate(() => __step(1/60, 60));
      const next = await disc.boundingBox();
      expect(Math.abs(first.x-next.x)).toBeGreaterThan(20);
      const miss = { position: { x: 12, y: 12 } };
      if (touch) {
        await field.tap(miss);
        await expect(page.locator('#target-attempts')).toHaveText('0');
        await page.getByRole('button', { name: 'Zasáhnout', exact: true }).tap();
        await page.touchscreen.tap(next.x + next.width/2, next.y + next.height/2);
        await page.getByRole('button', { name: 'Zasáhnout', exact: true }).tap();
      } else {
        await field.click(miss);
        await page.mouse.click(next.x + next.width/2, next.y + next.height/2);
      }
      await expect(page.locator('#target-hits')).toHaveText('1');
      await expect(page.locator('#target-attempts')).toHaveText('2');
      await expect(disc).toBeHidden();
      await page.getByRole('button', { name: 'Zasáhnout', exact: true }).click();
      await expect(page.locator('#target-attempts')).toHaveText('2');
      await page.evaluate(() => __step(.02, 40));
      await expect(disc).toBeVisible();
      if (touch) await page.getByRole('button', { name: 'Zpět do města' }).tap();
      else {
        await field.focus();
        const cursor = page.locator('#target-cursor');
        const before = await cursor.boundingBox();
        await page.keyboard.press('ArrowLeft');
        expect((await cursor.boundingBox()).x).toBeLessThan(before.x);
        await page.keyboard.press('Space');
        await expect(page.locator('#target-attempts')).toHaveText('3');
        await page.keyboard.press('Escape');
      }
      await expect(page.locator('#targets')).toBeHidden();
      expect(await page.evaluate(() => [__game.player.x,__game.player.z,__game.activities.active])).toEqual([approach.x,approach.z,null]);
      await page.evaluate(() => __step(.02, 12));
      await open();
      await expect(page.locator('#target-hits')).toHaveText('0');
      if (touch) {
        await page.reload();
        await waitForGame(page);
        expect(await page.evaluate(() => [__game.activities.active,Math.hypot(__game.player.x-2874,__game.player.z-1142)<3])).toEqual([null,true]);
      }
    } finally { await context.close(); }
  });
}
