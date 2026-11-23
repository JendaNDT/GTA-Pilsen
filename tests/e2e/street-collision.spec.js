import { expect, test } from '@playwright/test';
import { streetFixtures } from '../../src/world/street-furniture.js';
import { layers } from '../../src/physics/world.js';
import { gameUrl } from './game-url.js';
import { waitForGame } from './ready.js';

test('E25 – herní auto na fiktivní zkušební ploše převrhne lavičku a rozbije sklo @webgpu', async ({page}) => {
  await page.setViewportSize({width:400,height:280});
  await page.goto(gameUrl('/?debug&quality=low&adapt=0&view=320'));
  await waitForGame(page);
  const plane = {heightAt:()=>0, chunkIndex:()=>0};
  const samples = ['bench','shelter'].map(kind=>streetFixtures({id:'zkusebni-vzorek',kind,x:0,z:0,yaw:0},plane));
  const results = await page.evaluate(({samples,floorLayer})=>{
    const g=window.__game, Jolt=g.physics.Jolt;
    window.__freeze(true);
    g._enterCar(g.player.lastCar);
    g.paused=false;
    g.update(1/60);
    return samples.map(fixtures=>{
      const physics = new g.physics.constructor(Jolt);
      const registry = new g.world.breakables.constructor();
      const world = {breakables:registry, heightAt:()=>0, bridgeEdges:new Map(), closureChunks:new Map(),
        streetFixtures:new Map([[0,fixtures]])};
      const source = g.colliders.roadFurniture;
      const manager = new source.constructor(physics,world,source.meshBody);
      physics.onImpact=()=>{};
      physics.onRailingHit=(...args)=>manager.contact(...args);
      const floor=source.meshBody(physics,Float32Array.of(-20,0,-30,-20,0,30,20,0,-30,20,0,-30,-20,0,30,20,0,30),floorLayer);
      const car={type:g.car.type,x:0,y:0,z:-15,gPitch:0,yaw:0,vx:0,vy:0,vz:0,speed:0,steer:0,health:100};
      const vehicle=new g.driver.constructor(physics,car);
      try {
        manager.load(0);
        for(let tick=0;tick<900 && car.z<3;tick++){
          vehicle.drive(1/60,tick<90?0:.72,0,tick<90,true,()=>1);
          physics.engine.Step(1/60,1);
          vehicle.read();
          manager.step(tick/60);
        }
        const states=fixtures.map(f=>[f.piece,registry.state(f.id)]);
        manager.unload(0);
        manager.step(16);
        manager.load(0);
        const restored=fixtures.every((f,i)=>registry.state(f.id)===states[i][1]);
        manager.repair(registry.repairDue(28*3600));
        manager.step(28*3600);
        return {states,restored, repaired:fixtures.every(f=>registry.state(f.id)==='intact'),passed:car.z>0};
      } finally {
        vehicle.dispose();
        manager.unload(0);
        manager.step(29*3600);
        manager.destroyBody(floor);
        for(const value of [manager.position,manager.vector,manager.rotation]) Jolt.destroy(value);
        physics.dispose();
      }
    });
  },{samples,floorLayer:layers.STATIC});
  expect(results[0].states).toEqual([['bench','broken']]);
  expect(results[1].states).toEqual([['stojka-l','intact'],['stojka-p','intact'],['strecha','intact'],['sklo','broken']]);
  expect(results.every(r=>r.passed && r.restored && r.repaired)).toBe(true);
});

test('Otevřené přístřešky v Plzni pustí chodce pod střechu a udrží ho na střeše', async ({page}) => {
  await page.setViewportSize({width:640,height:384});
  await page.goto(gameUrl('/?debug&quality=low&view=340&adapt=0&hour=10'));
  await waitForGame(page);
  await page.getByRole('button', {name:'Hrát', exact:true}).click();
  const routes = [
    ['Jíkalka u domu', -618.22, 63.99, -609.92, 65.50],
    ['Petrohrad', 909.71, 108.57, 935.49, 102.33],
    ['Bezovka', -731.89, 813.65, -750.91, 809.75],
    ['Jíkalka napříč', -907.03, -28.98, -933.77, -16.72],
    ['Pod Záhorskem', -334.98, -1154.74, -354.52, -1139.36],
    ['Karlov', -1441.24, 907.71, -1444.26, 945.49],
    ['Roudná u domu', 1422.33, -389.54, 1417.07, -391.86],
  ];
  const result = await page.evaluate(async routes => {
    window.__freeze(true);
    const g = window.__game, p = g.player;
    const remaining = [];
    for (const [, x, z, endX, endZ] of routes) {
      g.colliders.update(x, z);
      p.place(x, z);
      for (let i = 0; i < 150; i++) {
        g.chunks.update(x, z, 340, 40, p.y);
        if (!g.chunks.pending && !g.chunks.heritage.fetching) break;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      for (let i = 0; i < 1400; i++) {
        const dx = endX - p.x, dz = endZ - p.z, d = Math.hypot(dx, dz);
        if (d < .45) break;
        p.update(1/60, dx/d, dz/d, false, false);
      }
      remaining.push(Math.hypot(endX - p.x, endZ - p.z));
    }
    // Na Karlově je v ose průchodu rovná mapová střecha. Postava na ni dopadne shora.
    const x = -1442.75, z = 926.60, top = g.world.bTop[93192];
    g.colliders.update(x, z);
    p.place(x, z, top + 1);
    for (let i = 0; i < 120; i++) p.update(1/60, 0, 0, false, false);
    return {remaining, landing: Math.abs(p.y - top)};
  }, routes);
  for (const [i, distance] of result.remaining.entries()) {
    expect(distance, routes[i][0]).toBeLessThan(.45);
  }
  expect(result.landing).toBeLessThan(.08);
});
