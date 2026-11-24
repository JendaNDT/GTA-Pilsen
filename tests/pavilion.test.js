import test from 'node:test';
import assert from 'node:assert/strict';
import { pavilionGeometry } from '../src/world/pavilion.js';
import { createPavilionSite, pavilionCollision, pavilionContact, pavilionParts, pavilionPoint,
  pavilionRay, pavilionSurface, terrace } from '../src/world/pavilion-site.js';

const world={buildingAt:()=>4,bNames:new Map([[4,'Lochotínský pavilonek']]),bGround:{4:13.61},chunkIndex:()=>12};
const site=createPavilionSite(world);

test('pavilonek patří jen ke svému obrysu a úsporná kresba má platné souřadnice',()=>{
  assert.equal(createPavilionSite({...world,bNames:new Map()}),null);
  assert.equal(new Set(site.rails.map(f=>f.id)).size,14);
  const geometry=pavilionGeometry(site);
  assert.ok(geometry.attributes.uv.array.every(x=>x>=0 && x<=1));
  assert.ok(geometry.attributes.position.count/3<1900);
});

test('pěší povrch a horní trojúhelníky Jolt souhlasí na valbách, křídlech i terase',()=>{
  const heights=[];
  pavilionCollision(site,(a,b,c)=>{
    const ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
    if (ny>0.001) heights.push(a[1],b[1],c[1]);
  });
  for (const p of [...pavilionParts,terrace]) {
    const [x,,z]=pavilionPoint(site,p.u,0,p.v);
    const peak=site.ground+p.top;
    assert.ok(Math.abs(pavilionSurface(site,x,z,Infinity)-peak)<1e-8);
    assert.ok(heights.some(y=>Math.abs(y-peak)<1e-8));
    assert.ok(pavilionSurface(site,x,z,peak-.02)<peak);
  }
  const [x,,z]=pavilionPoint(site,-13.4,0,1.7);
  assert.ok(Math.abs(pavilionSurface(site,x,z,Infinity)-site.ground-(3.15+4.68)/2)<1e-8);
});

test('kamera a postava narazí do sálu a ve stejné výšce minou nižší křídlo',()=>{
  for (const [u,blocked] of [[0,true],[-13.4,false]]) {
    const [x0,,z0]=pavilionPoint(site,u,0,14), [x,,z]=pavilionPoint(site,u,0,0);
    const h=site.ground+5.1;
    assert.equal(pavilionRay(site,x0,z0,x,z,h)<1,blocked);
    assert.equal(pavilionContact(site,{x,z,depth:0},.3,h,h+1),blocked);
  }
});
