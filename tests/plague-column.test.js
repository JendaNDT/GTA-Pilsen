import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three/webgpu';
import { buildColumn } from '../src/world/plague-column.js';
import { columnCenter, columnCollision, columnContact, columnPoint, columnRay, columnSteps,
  columnSurface, createColumnSite } from '../src/world/plague-column-site.js';
import { Breakables } from '../src/physics/breakables.js';

const world = { buildingAt:()=>7, bNames:new Map([[7,'morový sloup']]), chunkIndex:()=>5536,
  heightAt:()=>-.34, breakables:new Breakables() };
const site = createColumnSite(world);

test('morový sloup přebírá jen vlastní půdorys a šesti stupňům odpovídá povrch i stěny pro fyziku',()=>{
  assert.equal(createColumnSite({...world,bNames:new Map([[7,'jiná budova']])}),null);
  const tops = new Set();
  columnCollision(site,(a,b,c)=>{
    if (a[1]===b[1] && a[1]===c[1]) {
      const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
      assert.ok(ny>0);
      tops.add(a[1]);
    }
  });
  for (const step of columnSteps) {
    const [x,,z]=columnPoint(step.w-.06,0,0,site.ground);
    assert.equal(columnSurface(site,x,z,Infinity),site.ground+step.top);
    assert.ok(tops.has(step.top+site.ground));
  }
  const [x,,z]=columnPoint(3,0,1,site.ground);
  assert.equal(columnContact(site,{x,z,depth:0},.2,site.ground+2,site.ground+3),false);
  const {x:cx,z:cz}=columnCenter;
  assert.equal(columnSurface(site,cx,cz,Infinity),site.ground+15.36);
  assert.ok(columnContact(site,{x:cx,z:cz,depth:0},.2,site.ground+7,site.ground+8));
  assert.ok(columnRay(site,cx-4,cz,cx+4,cz,site.ground+7)<.5);
  assert.equal(columnRay(site,cx-4,cz+2,cx+4,cz+2,site.ground+7),1);
});

test('sloup má úspornou vzdálenou siluetu a rozbití jednoho pole uvolní jen příslušný kus ohrazení',()=>{
  const owner={disposables:[]}, mat=new THREE.MeshBasicNodeMaterial();
  const model=buildColumn(world,site,mat,false,owner);
  assert.equal(model.levels.length,2);
  const far=model.levels[1].object.children[0].geometry;
  assert.ok(far.attributes.position.count/3<=160);
  assert.equal(new Set(site.fixtures.map(f=>f.id)).size,25);
  const fence=site.fixtures.find(f=>f.kind==='columnFence');
  const near=model.levels[0].object.children[0].geometry;
  const positions=near.attributes.position, old=positions.array.slice();
  world.breakables.damage(fence.id,'broken',0);
  assert.notDeepEqual(positions.array,old);
  assert.equal(far.attributes.position.version,0);
  world.breakables.repairDue(2*86400);
  assert.deepEqual(positions.array,old);
  for (const visual of owner.columnRails) world.breakables.detach(visual);
  for (const asset of owner.disposables) asset.dispose();
  mat.dispose();
});
