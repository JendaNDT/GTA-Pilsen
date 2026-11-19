import {expect, test} from '@playwright/test';
import {gameUrl} from './game-url.js';
import {saveStructurePhoto} from './structure-photo.js';

// Stejné místo slouží k ověření kolize i fotografie městského modelu.
const examples = [
  {district:1, id:'00000002021000318-5660e9634c409441'},
  {district:2, id:'00000000000002376-10459c601ca284c1'}
];

for (const {district, id} of examples) {
  test('E22 – statický model a kolize v obvodu ' + district + ' @webgpu', async ({page}, info) => {
    await page.goto(gameUrl('/?debug&quality=low&adapt=0&date=2026-11-09&hour=11'));
    await page.waitForFunction(() => window.__ready);
    const sample = await page.evaluate(async id => {
      const g = __game, w = g.world, chunks = g.chunks;
      const [ci,tile] = [...w.structures.tiles].find(([,t]) => t.objects.some(o => o.id === id));
      const part = tile.objects.find(o => o.id === id);
      const points = w.structures.positions.subarray(part.start*3, (part.start+part.count)*3);
      const xs = [], ys = [], zs = [];
      let top = -Infinity, hitX, hitZ;
      for (let i = 0; i < points.length; i += 9) {
        const [ax,ay,az,bx,by,bz,cx,cy,cz] = points.subarray(i,i+9);
        xs.push(ax,bx,cx); ys.push(ay,by,cy); zs.push(az,bz,cz);
        const y = (ay+by+cy)/3;
        if ((bz-az)*(cx-ax) - (bx-ax)*(cz-az) <= 0.01 || y <= top) continue;
        top = y; hitX = (ax+bx+cx)/3; hitZ = (az+bz+cz)/3;
      }
      if (!Number.isFinite(top)) throw Error('Chybí ověřitelná horní plocha.');
      g.colliders.update(hitX,hitZ);
      const elevation = g.colliders.exitHeight(hitX,hitZ,top-0.55);
      const mid = values => (Math.min(...values)+Math.max(...values))/2;
      const x = mid(xs), z = mid(zs), y = Math.max(mid(ys), w.heightAt(x,z)+0.5);
      let length = 0, nx = 0, nz = 0;
      for (let a = 0; a < xs.length; a++) for (let b = 0; b < a; b++) {
        const dx = xs[a]-xs[b], dz = zs[a]-zs[b], distance = Math.hypot(dx,dz);
        if (distance > length) { length = distance; nx = -dz/distance; nz = dx/distance; }
      }
      let distance = Math.min(30,Math.max(6,0.95*length));
      const clearance = sign => w.raycast(x,z,x+nx*distance*sign,z+nz*distance*sign,y+1.6);
      const sign = clearance(-1) > clearance(1) ? -1 : 1;
      distance *= Math.max(0.3,clearance(sign));
      const camX = x+nx*distance*sign, camZ = z+nz*distance*sign;
      const camY = Math.max(y+distance*0.24,w.heightAt(camX,camZ)+1.6);
      for (;;) {
        const built = chunks.update(x,z,430,30,camY);
        const item = chunks.chunks.get(ci)?.structure;
        if (!built && !chunks.pending && !chunks.heritage.fetching && !chunks.orthophotoPending &&
            item && item.core !== item.mesh.geometry && !w.structures.loading) break;
        await new Promise(resolve => setTimeout(resolve,10));
      }
      __view(camX,camY,camZ,x,y,z);
      return {deviation:Math.abs(elevation-top),core:part.count,detail:part.dCount};
    }, id);
    expect(sample.deviation).toBeLessThan(0.04);
    expect(sample.core).toBeGreaterThan(0);
    expect(sample.detail).toBeGreaterThan(0);
    const photo = info.outputPath('obvod-' + district + '.jpg');
    await saveStructurePhoto(page,photo);
    await info.attach('Pohled na měřený objekt', {path:photo, contentType:'image/jpeg'});
  });
}
