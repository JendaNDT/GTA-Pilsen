import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E26 – poškozená barevná tabulka a nedostupné textury dovolí pokračovat ve hře @webgpu', async ({page}) => {
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  const failed=new Set();
  await page.route('**/luts/den.cube',async route=>{
    const original=await route.fetch(), bytes=await original.body();
    bytes[12]^=1;
    failed.add('barvy');
    await route.fulfill({response:original,body:bytes});
  });
  await page.route('**/textures/facades/interiery.webp',async route=>{
    failed.add('interiery');
    await route.fulfill({status:404,body:''});
  });
  await page.setViewportSize({width:400,height:280});
  await page.goto(gameUrl('/?debug&quality=medium&adapt=0&view=300&hour=10'));
  await waitForGame(page);
  await page.getByRole('button',{name:'Hrát',exact:true}).click();
  const state=await page.evaluate(async()=>{
    const g=window.__game;
    __freeze(true);
    g.update(1/60);
    g.render();
    await g.renderer.backend.device?.queue.onSubmittedWorkDone();
    return {playing:!g.paused, grade:Boolean(g.postfx?.grade), calls:__perf.renderStats().calls};
  });
  expect([...failed].sort()).toEqual(['barvy','interiery']);
  expect(state.playing).toBe(true);
  expect(state.grade).toBe(false);
  expect(state.calls).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

for (const failure of ['404','otisk']) {
  test('E26 – při poruše katalogů zůstane původní město a terén (' + failure + ') @webgpu', async ({page}) => {
    const visited = new Set(), errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.route(/\/detail\/(city|streets|structures|orthophoto)\/index\.json$/, async route => {
      const path = new URL(route.request().url()).pathname.split('/');
      visited.add(path.at(-2));
      if (failure === '404') return route.fulfill({status:404,body:''});
      // Mezera ponechá JSON i všechny jeho hodnoty platné, změní pouze otisk.
      const original = await route.fetch();
      await route.fulfill({response:original,body:Buffer.concat([await original.body(),Buffer.from(' ')])});
    });
    await page.setViewportSize({width:420,height:280});
    await page.goto(gameUrl('/?debug&quality=low&view=320&adapt=0&orthophoto=1'));
    await waitForGame(page);
    await page.getByRole('button',{name:'Hrát',exact:true}).click();
    const state = await page.evaluate(async () => {
      const g = window.__game;
      window.__freeze(true);
      const ortho = g.chunks.orthophoto;
      while (ortho.loading) await new Promise(resolve=>setTimeout(resolve,10));
      g.update(1/60);
      g.render();
      return {playing:!g.paused, buildings:g.world.bCount, chunks:g.chunks.chunks.size,
        measured:g.chunks.heritage.cells.size, streets:!!g.world.streetDetails,
        structures:!!g.world.structures, photo:!!ortho.blocks};
    });
    expect([...visited].sort()).toEqual(['city','orthophoto','streets','structures']);
    expect(state).toMatchObject({playing:true,measured:0,streets:false,structures:false,photo:false});
    expect(state.buildings).toBeGreaterThan(0);
    expect(state.chunks).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}

test('E26 – odjezd během stahování ulice a návrat po pomalé odpovědi @webgpu', async ({page}) => {
  let release, requested = false;
  const held = new Promise(resolve=>{release=resolve;});
  await page.route('**/detail/streets/nadrazi.bin',async route=>{
    requested = true;
    await held;
    await route.continue().catch(()=>{}); // Může mezitím vypršet časový limit nepovinného detailu.
  });
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.setViewportSize({width:400,height:280});
  try {
    await page.goto(gameUrl('/?debug&quality=low&adapt=0&view=320'));
    await waitForGame(page);
    const visit=async (x,z)=>page.evaluate(async ({x,z})=>{
      const g=window.__game;
      window.__freeze(true);
      g.player.place(x,z);
      for(let i=0;i<4;i++) {
        g.chunks.update(x,z,320,20,g.player.y);
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      return [...g.chunks.heritage.streetSections.keys()].some(key=>key.startsWith('nadrazi/'));
    },{x,z});
    await expect.poll(async()=>{await visit(710,341);return requested;},{timeout:180000}).toBe(true);
    expect(await visit(15000,900)).toBe(false);
    release();
    await expect.poll(async()=>{await visit(15000,900);return page.evaluate(()=>window.__game.chunks.heritage.fetching);},
      {timeout:180000}).toBe(0);
    expect(await visit(15000,900)).toBe(false);
    await expect.poll(()=>visit(710,341),{timeout:180000}).toBe(true);
    expect(errors).toEqual([]);
  } finally {release();}
});
