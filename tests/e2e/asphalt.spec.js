import {expect,test} from '@playwright/test';
import {gameUrl} from './game-url.js';

test('E23 – mokrý povrch vozovky používá provozní profil a samostatné značení @webgpu',async({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{
    if(/shader.*error|error.*shader|validation error|invalid shader module/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(gameUrl('/?debug&quality=medium&adapt=0&view=350&wet=1'));
  await page.waitForFunction(()=>window.__ready);
  const result=await page.evaluate(async()=>{
    const g=__game;
    __freeze(true);
    const active=[...g.chunks.chunks.values()].filter(c=>c.asphalt && c.marks);
    for(const tile of active){
      const geo=tile.asphalt.geometry,layout=geo.getAttribute('roadLayout'),meters=geo.getAttribute('roadMeters');
      for(let i=0;i<layout.count;i++){
        if(layout.getY(i)<=0 || layout.getZ(i)<=0 || Math.abs(meters.getY(i))<0.5) continue;
        const p=geo.getAttribute('position'),x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        __view(x+1,y+3,z+2,x,y,z);
        g.render();
        await g.renderer.backend.device?.queue.onSubmittedWorkDone();
        return {size:layout.count===p.count && meters.count===p.count,wear:layout.getZ(i),lane:layout.getX(i),
          lines:tile.marks.renderOrder>tile.asphalt.renderOrder&&!tile.marks.geometry.hasAttribute('roadLayout'),
          material:!!tile.asphalt.material.roughnessNode&&!!tile.asphalt.material.normalNode};
      }
    }
  });
  expect(result).toMatchObject({size:true,lines:true,material:true});
  expect(result.wear).toBeGreaterThan(0);
  expect(result.lane).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
