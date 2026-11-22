import {expect,test} from '@playwright/test';
import {gameUrl} from './game-url.js';

for (const quality of ['low','medium']) {
  test('E23 – blízký terén v předvolbě '+quality+' @webgpu',async({page})=>{
    const errors=[],maps=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',msg=>{
      if (/(shader.*error|error.*shader|validation error|invalid shader module)/i.test(msg.text())) errors.push(msg.text());
    });
    page.on('response',response=>{
      if (response.url().includes('/textures/terrain/')) maps.push([new URL(response.url()).pathname.split('/').pop(),response.status()]);
    });
    // Pevné datum a hodina: noc, mlha a srážky podle dne mění, které efekty se vykreslí a jejichž chyby zkouška hlídá.
    await page.goto(gameUrl('/?debug&adapt=0&quality='+quality+'&view=350&date=2026-11-09&hour=10'));
    await page.waitForFunction(()=>window.__ready);
    const sample = await page.evaluate(async()=>{
      const g=__game,w=g.world;
      __freeze(true);
      let chosen;
      for(const tile of g.chunks.chunks.values()){
        const mask=tile.terrainMat?.terrainClasses;
        if(!mask) continue;
        const {width,data}=mask.image;
        const i=data.findIndex(v=>v>0);
        if(i<0) continue;
        const x=tile.cx-128+(i%width+0.5)*256/width;
        const z=tile.cz-128+(Math.floor(i/width)+0.5)*256/width;
        chosen={x,z,normal:!!tile.terrainMat.normalNode,layer:data[i]};
        break;
      }
      if(chosen){
        const {x,z}=chosen,y=w.heightAt(x,z);
        __view(x,y+1.8,z+3,x,y,z);
        g.render();
        await g.renderer.backend.device?.queue.onSubmittedWorkDone();
      }
      return chosen ?? null;
    });
    if(quality==='low'){
      expect(sample).toBeNull();
      expect(maps).toEqual([]);
    } else {
      expect(sample?.normal).toBe(true);
      expect(sample.layer).toBeGreaterThanOrEqual(1);
      await expect.poll(()=>maps.length).toBe(2);
      expect(maps.sort()).toEqual([['barva.webp',200],['normaly.webp',200]]);
    }
    expect(errors).toEqual([]);
  });
}
