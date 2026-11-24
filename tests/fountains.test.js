import test from 'node:test';
import assert from 'node:assert/strict';
import { createFountainSites, fountainContact, fountainRay, fountainSurface } from '../src/world/fountain-site.js';
import { fountainPoint, isFountainPool, streamPoint, waterHeight } from '../src/world/fountain-shapes.js';
import { fountainGeometry } from '../src/world/fountains.js';

const sites=createFountainSites({chunkIndex:()=>0,heightAt:()=>7}).get(0);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} ≠ ${b}`);

test('tři chrliče mají různou siluetu a každý proud končí nad dnem své mísy',()=>{
  assert.deepEqual(sites.map(s=>s.name),['Anděl','Chrtice','Velbloud']);
  const heights=[4.9,3.7,4.1];
  for (const [i,s] of sites.entries()) {
    near(s.tree.bounds.max.y-s.ground,heights[i]);
    for (const [j,m] of s.mouths.entries()) {
      const bowl=s.bowls[j];
      assert.ok(Math.abs(m.target-bowl.u)<bowl.ru);
      const [x,y,z]=streamPoint(s,m,1);
      near(y,s.ground+waterHeight);
      assert.ok(fountainSurface([s],x,z,y)<y && fountainSurface([s],x,z,y)>s.ground);
      assert.ok(streamPoint(s,m,0)[1]>s.ground+m.low && streamPoint(s,m,0)[1]<s.ground+m.high);
      const [cx,,cz]=fountainPoint(s,bowl.u,0,0);
      assert.ok(isFountainPool(cx-1.4,cz-1.4,cx+1.4,cz+1.4));
    }
  }
  assert.equal(isFountainPool(10,10,14,14),false);
  assert.equal(isFountainPool(0,0,42,197),false);
});

test('pod Velbloudem je průchod, jeho nohy i okraj nádrže jsou pevné',()=>{
  const s=sites[2];
  const cross=u=>{
    const [x,y,z]=fountainPoint(s,u,1,-2),[xx,,zz]=fountainPoint(s,u,1,2);
    return fountainRay([s],x,z,xx,zz,y);
  };
  assert.equal(cross(-5.4),1);
  assert.ok(cross(-6.8)<.5);
  const [x,,z]=fountainPoint(s,-6.8,1,-s.depth/2-.14);
  const hit={x,z,depth:0};
  assert.ok(fountainContact([s],hit,.3,s.ground+.3,s.ground+1.8));
  assert.ok(hit.depth>.08);
  near(fountainSurface([s],s.x,s.z,Infinity),s.ground+.26);
});

test('vzdálené modely jsou úspornější a vypnutý proud ponechá hladinu',()=>{
  for (const s of sites) {
    const high=fountainGeometry(s,true,true),far=fountainGeometry(s,false,true),dry=fountainGeometry(s,true,false);
    assert.ok(far.attributes.position.count<high.attributes.position.count);
    assert.ok(high.attributes.finish.array.includes(4));
    assert.equal(Math.max(...dry.attributes.finish.array),3);
    assert.equal(high.attributes.position.count,high.attributes.waterUV.count);
    high.dispose(); far.dispose(); dry.dispose();
  }
});
