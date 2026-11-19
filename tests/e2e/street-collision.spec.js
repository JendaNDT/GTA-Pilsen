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
