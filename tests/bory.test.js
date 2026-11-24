import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePack } from '../src/data.js';
import { boryGeometry, createBorySite } from '../src/world/bory.js';

async function mapWorld() {
  const bytes=await readFile(new URL('../public/data/buildings.bin',import.meta.url));
  const b=parsePack(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const w={b,bvx:[],bvz:[],bWall:[],bTop:[],bBase:[],bGround:[],bMinX:[],bMaxX:[],bMinZ:[],bMaxZ:[]};
  const near=[];
  for(let i=0;i<b.ax.length;i++) {
    if(Math.abs(b.ax[i]/10+1300)>300 || Math.abs(b.az[i]/10-2750)>300) continue;
    const start=b.ringStart[b.bRing[i]],end=b.ringStart[b.bRing[i]+1],xs=[],zs=[];
    for(let j=start;j<end;j++){
      xs.push(w.bvx[j]=(b.ax[i]+b.vdx[j])/10);
      zs.push(w.bvz[j]=(b.az[i]+b.vdz[j])/10);
    }
    w.bMinX[i]=Math.min(...xs);w.bMaxX[i]=Math.max(...xs);
    w.bMinZ[i]=Math.min(...zs);w.bMaxZ[i]=Math.max(...zs);
    w.bWall[i]=b.hWall[i]/10;w.bTop[i]=b.hTop[i]/10;w.bBase[i]=-.4;w.bGround[i]=0;
    near.push(i);
  }
  w.buildingAt=(x,z)=>near.find(i=>{
    if (x<w.bMinX[i] || x>w.bMaxX[i] || z<w.bMinZ[i] || z>w.bMaxZ[i]) return false;
    let inside=false;
    const start=b.ringStart[b.bRing[i]],end=b.ringStart[b.bRing[i]+1];
    for(let j=start,k=end-1;j<end;k=j++){
      const a=w.bvz[k],c=w.bvz[j];
      if ((a>z)!==(c>z) && x<w.bvx[k]+(w.bvx[j]-w.bvx[k])*(z-a)/(c-a)) inside=!inside;
    }
    return inside;
  })??-1;
  w.chunkIndex=(x,z)=>Math.floor(x/256)+4096*Math.floor(z/256);
  return w;
}

test('Bory rozliší historickou hvězdu, nástupní průčelí a kupoli ve skutečných mapových datech',async()=>{
  const w=await mapWorld(), site=createBorySite(w);
  assert.equal(createBorySite({...w,buildingAt:()=>-1}),null);
  assert.equal(site.wings.size,7);
  assert.deepEqual(site.historic,new Set([site.gate,site.left,site.right,site.hall,site.chapel,site.drum,...site.wings]));
  assert.equal(site.tile,w.chunkIndex(site.cx,site.cz));
  const low=boryGeometry(w,site,false), high=boryGeometry(w,site,true);
  for(const geo of [low,high]) {
    assert.ok(geo.attributes.position.array.every(Number.isFinite));
    assert.ok(geo.attributes.uv.array.every(n=>n>=0 && n<=1));
    assert.ok(geo.boundingSphere.radius>80 && geo.boundingSphere.radius<210);
  }
  assert.ok(high.attributes.position.count>low.attributes.position.count);
  assert.ok(high.attributes.position.count/3<4500);
  assert.ok(site.roofs.heightAt(site.cx,site.cz)>w.bWall[site.drum]+5);
  assert.equal(site.roofs.heightAt(0,0),-Infinity);
  assert.ok([...site.collision.values()].flat().every(([a,b,c])=>
    (b[2]-a[2])*(c[0]-a[0])>(b[0]-a[0])*(c[2]-a[2])));
  low.dispose();high.dispose();
});
