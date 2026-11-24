import { expect, test } from '@playwright/test';
import { gameUrl } from './game-url.js';

test('Mapa u muzea dovolí prohlédnout pěší lávku, hranici území a potvrdit cíl', async ({page}) => {
  await page.goto(gameUrl('/?debug&quality=low'));
  await page.waitForFunction(()=>window.__ready);
  await page.getByRole('button',{name:'Hrát',exact:true}).click();
  await page.evaluate(()=>{
    __freeze(true); __game.player.place(122,281);
    __game.jobs.setWaypoint(0,80,'Původní cíl',true);
    __game.toggleMap(true);
  });
  const map = page.locator('#bigmap-canvas');
  const start = await page.evaluate(()=>__game.areaMap.view.scale);
  await map.hover({position:{x:185,y:95}});
  await page.mouse.wheel(0,-220);
  await expect.poll(()=>page.evaluate(()=>__game.areaMap.view.scale)).toBeGreaterThan(start);
  const canvas = await map.boundingBox();
  await page.mouse.move(canvas.x+210,canvas.y+100);
  await page.mouse.down(); await page.mouse.move(canvas.x+255,canvas.y+125,{steps:3}); await page.mouse.up();
  await expect(page.locator('#map-selection')).toBeHidden();
  await page.getByRole('button',{name:'Celá oblast'}).click();
  await map.click({position:{x:4,y:5}});
  await expect(page.locator('#map-name')).toHaveText('Mimo herní oblast');
  await expect(page.locator('#map-go')).toBeHidden();
  await page.getByRole('button',{name:'Moje poloha'}).click();
  await expect(page.locator('#map-selection')).toBeHidden();
  expect(await page.evaluate(()=>__game.areaMap.view.x)).toBeCloseTo(122);
  await page.getByRole('searchbox').fill('lavka pres strouhu');
  await page.getByRole('button',{name:'Dřevěná lávka přes Strouhu'}).click();
  await expect(page.locator('#map-name')).toHaveText('Dřevěná lávka přes Strouhu');
  expect(await page.evaluate(()=>__game.jobs.waypoint)).toEqual({x:0,z:80});
  await page.getByRole('button',{name:'Navigovat sem'}).click();
  await expect(map).toBeHidden();
  expect(await page.evaluate(()=>__game.jobs.waypoint.walk.at(-2))).toBeCloseTo(289.5);
  const area = await page.evaluate(()=>{
    const g = __game, road = g.world.nearestRoad(122,281,160,11);
    const car = g.player.lastCar;
    car.place(road.x,road.z,0);
    g.player.place(car.x+2,car.z); g.doAction(); g.toggleMap(true);
    return g.areaMap.view.area.minX-g.world.playMinX;
  });
  await expect(page.locator('#map-mode')).toHaveText('Autem');
  expect(area).toBe(30);
});

test('Dvěma prsty lze na telefonu přiblížit a posunout mapu bez změny cíle', async ({browser,baseURL}) => {
  const ctx = await browser.newContext({ viewport:{width:390,height:780},isMobile:true,hasTouch:true });
  try {
    const page = await ctx.newPage();
    await page.goto(gameUrl(baseURL+'/?debug&quality=low'));
    await page.waitForFunction(()=>window.__ready);
    await page.getByRole('button',{name:'Hrát',exact:true}).tap();
    await page.evaluate(()=>{__freeze(true); __game.toggleMap(true);});
    const box = await page.locator('#bigmap-canvas').boundingBox();
    const x=box.x+box.width*.4, y=box.y+box.height*.5;
    const session = await ctx.newCDPSession(page);
    const touch = (type, points) => session.send('Input.dispatchTouchEvent',{type,
      touchPoints:points.map(([px,py],id)=>({x:px,y:py,id:id+1}))});
    const state = () => page.evaluate(()=>({x:__game.areaMap.view.x,scale:__game.areaMap.view.scale}));
    const initial = await state();
    await touch('touchStart',[[x-25,y],[x+25,y]]);
    await touch('touchMove',[[x-30,y],[x+85,y+6]]);
    await touch('touchEnd',[]);
    await expect.poll(async()=>(await state()).scale).toBeGreaterThan(initial.scale*1.8);
    const enlarged = await state();
    await touch('touchStart',[[x,y]]); await touch('touchMove',[[x+55,y]]); await touch('touchEnd',[]);
    await expect.poll(async()=>(await state()).x).toBeLessThan(enlarged.x);
    await expect(page.locator('#map-selection')).toBeHidden();
    await page.getByRole('button',{name:'Moje poloha'}).tap();
    expect((await state()).scale).toBeCloseTo(initial.scale);
  } finally { await ctx.close(); }
});
