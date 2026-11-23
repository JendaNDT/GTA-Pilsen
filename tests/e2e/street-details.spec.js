import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E25 – v pilotním úseku Americké se vykreslí jediná přízemní vrstva @webgpu', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => {
    if (/THREE\.TSL:|invalid shader module|validation error|error.*shader|shader.*error/i.test(m.text())) errors.push(m.text());
  });
  await page.setViewportSize({width:480,height:320});
  await page.goto(gameUrl('/?debug&quality=medium&view=340&adapt=0&hour=10'));
  await waitForGame(page);
  const observed = await page.evaluate(async () => {
    const g = __game;
    __freeze(true);
    g.player.place(118,458);
    const heritage = g.chunks.heritage;
    const start = performance.now();
    for (;;) {
      g.chunks.update(118,458,340,40,g.player.y);
      const section = [...g.chunks.chunks.values()].find(ch =>
        ch.heritage?.base.some(mesh => mesh.geometry.hasAttribute('aStreet')));
      if (section) {
        heritage.update(section.heritage,118,458,g.player.y);
        const facade = section.heritage.base.find(mesh => mesh.geometry.hasAttribute('aStreet'));
        __view(124,g.player.y+1.7,453,129,g.player.y+2,438);
        g.render();
        await g.renderer.backend.device?.queue.onSubmittedWorkDone();
        return {material:facade.material === heritage.streetClose,
          entrance:facade.geometry.getAttribute('aEntrance').array.some(width => width > 0),
          measured:facade.geometry.getAttribute('aStreet').array.some((v,i) => i%4 === 2 && v > 0)};
      }
      if (performance.now()-start > 120000) throw Error('Chybí detail pilotu na Americké.');
      await new Promise(resolve => setTimeout(resolve,10));
    }
  });
  expect(observed).toEqual({material:true, entrance:true, measured:true});
  expect(errors).toEqual([]);
});

for (const quality of ['low','high']) {
  test('E25 – chůze ve třech úsecích a vybavení za dne, soumraku i noci (' + quality + ') @webgpu', async ({page}) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({width:480,height:320});
    await page.goto(gameUrl('/?debug&weather=clear&view=340&adapt=0&quality='+quality));
    await waitForGame(page);
    const results = await page.evaluate(async () => {
      const g=__game, w=g.world;
      __freeze(true);
      const results=[];
      for(const [id,x,z] of [['americka',118,458],['drevena',109,43],['nadrazi',710,341]]) {
        g.player.place(x,z);
        for(let i=0;i<25;i++)g.colliders.update(x,z);
        const start=performance.now();
        const sectionReady = () => [...g.chunks.heritage.streetSections].some(([key,parts]) =>
          key.startsWith(id+'/') && parts.some(f => id !== 'nadrazi' || f.piece === 'sklo'));
        while (!sectionReady()) {
          g.chunks.update(x,z,340,40,g.player.y);
          await new Promise(r=>setTimeout(r,10));
          if(performance.now()-start>120000)throw Error('Nedostavěný úsek '+id);
        }
        const visible=[...g.chunks.heritage.streetSections].filter(([k])=>k.startsWith(id+'/')).flatMap(([,v])=>v);
        const from=[g.player.x,g.player.z];
        for(let i=0;i<50;i++)g.player.update(1/60,1,0,false,false);
        for(const hour of [10,18.15,22]){
          __setClock('2026-11-17',hour);
          __view(x,g.player.y+1.7,z,x+8,g.player.y+2,z-5);
          await g.renderer.backend.device?.queue.onSubmittedWorkDone();
        }
        results.push({id, walked:Math.hypot(g.player.x-from[0],g.player.z-from[1]), pieces:visible.length,
          glass:visible.some(f=>f.piece==='sklo'), paved:w.streetPaving.size});
      }
      return results;
    });
    for(const r of results) {
      expect(r.walked,r.id).toBeGreaterThan(.45);
      expect(r.pieces,r.id).toBeGreaterThan(0);
      expect(r.paved,r.id).toBeGreaterThan(0);
    }
    expect(results[2].glass).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Hlavní nádraží – od veřejných vstupů ke dvěma stanovištím bez minimapy', async ({page}) => {
  await page.setViewportSize({width:480,height:320});
  await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0&hour=10'));
  await waitForGame(page);
  await page.getByRole('button', {name:'Hrát', exact:true}).click();
  await page.addStyleTag({content:'#minimap { display: none; }'});
  await expect(page.locator('#minimap')).toBeHidden();
  const route = await page.evaluate(async () => {
    const g = window.__game;
    window.__freeze(true);
    // Veřejný vstup na jižním konci ostrůvku je v OSM uzel 9737859382.
    g.player.place(609.02, 335.5);
    const deadline = performance.now() + 45000;
    let signs;
    do {
      g.chunks.update(g.player.x, g.player.z, 340, 40, g.player.y);
      await new Promise(resolve => setTimeout(resolve, 10));
      signs = [...g.chunks.heritage.streetSections.values()].flat().filter(f => f.kind === 'platformSign');
      if (performance.now() > deadline) throw Error('Čtyři označníky se nenačetly.');
    } while (signs.length < 4);
    const walkTo = (x, z, range) => {
      for (let i = 0; i < 2400; i++) {
        const dx = x - g.player.x, dz = z - g.player.z;
        const distance = Math.hypot(dx, dz);
        if (distance < range) return true;
        g.colliders.update(g.player.x, g.player.z);
        g.player.update(1 / 60, dx / distance, dz / distance, false, false);
      }
      return false;
    };
    const tram = signs.find(sign => sign.number === 3);
    const reachedTram = walkTo(tram.x, tram.z, 2);
    // Druhá trasa začíná před veřejnými dveřmi OSM 12707369913 na straně terminálu.
    g.player.place(658.52, 389.9);
    const busStop = g.transit.timetable.stops.find(([name, , , code]) =>
      name === 'Hlavní nádraží' && code === '53408/1');
    const reachedBus = [[657.5,382], [673.6,374.1], [685,363.7], [698,353], [busStop[1],busStop[2]]]
      .every(([x,z]) => walkTo(x, z, 1));
    return {numbers:signs.map(sign => sign.number).sort(), reachedTram, reachedBus};
  });
  expect(route).toEqual({numbers:[1,2,3,4], reachedTram:true, reachedBus:true});
  await expect(page.locator('#minimap')).toBeHidden();
});
