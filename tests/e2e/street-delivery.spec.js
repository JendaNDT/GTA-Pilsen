import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E25 – rozvoz jídla na skutečnou adresu v každém úseku @webgpu', async ({page}) => {
  await page.setViewportSize({width:480,height:320});
  await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0'));
  await waitForGame(page);
  await page.getByRole('button',{name:'Hrát',exact:true}).click();
  const deliveries = await page.evaluate(async () => {
    const g = window.__game, {addresses, roadNames} = g.world.meta;
    window.__freeze(true);
    const results = [];
    for (const [section, street, number] of [
      ['americka','Americká','46'], ['drevena','Dřevěná','7'], ['nadrazi','Nádražní','22'],
    ]) {
      const index = addresses.findIndex(a => roadNames[a[2]] === street && a[3] === number);
      if (index < 0) throw Error('V mapě chybí adresa ' + street + ' ' + number);
      g.player.place(-750,450);
      // První los vybere nejbližší vhodný podnik, druhý určí cílovou adresu.
      let first = true;
      window.__random.override(() => {
        if (first) { first = false; return 0; }
        return (index + .5) / addresses.length;
      });
      let error;
      try { error = g.jobs.start('food'); } finally { window.__random.restore(); }
      if (error) throw Error(error);
      const {pick,drop,label} = g.jobs.job;
      g.player.place(pick.x,pick.z);
      g.jobs.update(1/60);
      if (g.jobs.job.phase !== 'drop') throw Error('Objednávka nebyla vyzvednuta');
      const road = g.world.nearestRoad(drop.x,drop.z,16,Infinity,0,{});
      if (!road) throw Error('Chybí ulice pro doručení ' + label);
      const x = drop.x - road.dx * 12, z = drop.z - road.dz * 12;
      g.player.place(x,z);
      while (![...g.chunks.heritage.streetSections.keys()].some(key => key.startsWith(section+'/'))) {
        g.chunks.update(x,z,340,40,g.player.y);
        await new Promise(resolve => setTimeout(resolve,10));
      }
      for (let i=0;i<25;i++) g.colliders.update(x,z);
      for (let i=0;i<180 && g.jobs.job;i++) {
        g.player.update(1/60,road.dx,road.dz,false,false);
        g.jobs.update(1/60);
      }
      results.push({label, walked:Math.hypot(g.player.x-x,g.player.z-z),
        paid:!g.jobs.job && g.jobs.last?.state === 'paid'});
    }
    return results;
  });
  expect(deliveries.map(r=>r.label)).toEqual(['Americká 46','Dřevěná 7','Nádražní 22']);
  for (const r of deliveries) {
    expect(r.walked,r.label).toBeGreaterThan(.8);
    expect(r.paid,r.label).toBe(true);
  }
});
