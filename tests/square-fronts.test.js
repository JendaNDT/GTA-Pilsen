import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three/webgpu';
import { parsePack, assetFingerprint } from '../src/data.js';
import { hasNorthSquare, northSquareGeometry } from '../src/world/north-square.js';
import { squareFrontGeometry } from '../src/world/square-fronts.js';
import { crownLine, facadeY } from '../src/world/square-gables.js';
import houses from '../src/world/square-fronts/houses.json' with { type: 'json' };

test('orientační čísla rozlišují domy, dvojité štíty a moderní průčelí na všech třech stranách',()=>{
  const numbers=Array.from({length:34},(_,i)=>i+6).filter(n=>n!==34);
  assert.deepEqual(houses.map(h=>h.number),numbers);
  for (const h of houses) {
    assert.equal(facadeY(h,h.base),333);
    assert.ok(Math.abs(facadeY(h,h.peak)-24)<1e-8);
    const line=crownLine(h);
    if (['modern','flat','mansard'].includes(h.shape)) { assert.deepEqual(line,[]); continue; }
    assert.equal(line[0][0],0);
    assert.equal(line.at(-1)[0],1);
    assert.ok(line.every(([u,rise])=>u>=0 && u<=1 && rise>=0 && rise<=1));
    assert.equal(line.filter(([,y])=>y===1).length,h.shape==='twin'?2:1);
  }
});

for (const tile of new Set(houses.map(h=>h.tile))) {
  test('průčelí respektují dřívější modely, jednotlivé adresy a střechy v listu '+tile,async()=>{
    const file=tile+'.bin';
    const bytes=await readFile(new URL('../public/detail/city/'+file,import.meta.url));
    const data=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    const pack=parsePack(data);
    const shell=new THREE.BufferGeometry();
    shell.setAttribute('position',new THREE.Float32BufferAttribute(Float32Array.from(pack.p,
      (v,i)=>v*.02+[pack.header.cx,0,pack.header.cz][i%3]),3));
    shell.setIndex(new THREE.BufferAttribute(pack.i,1));
    assert.equal(squareFrontGeometry(file,pack,shell,false),null);
    assert.equal(shell.index.array,pack.i);
    pack.fileHash=assetFingerprint(data);
    const roofs=pack.roof.slice(), selected=new Set();
    const entries=houses.filter(h=>h.tile===tile);
    for(const h of entries) {
      // Výběr musí pokrýt také přízemí. Samotný štít by mohl skrýt chybějící část průčelí.
      const intervals=[];
      const [x,z]=h.left, dx=h.right[0]-x, dz=h.right[1]-z;
      const position=shell.getAttribute('position');
      for (const [start,end] of h.faces) for (let i=start;i<end;i+=3) {
        const ids=Array.from(pack.i.subarray(i,i+3));
        const heights=ids.map(id=>position.getY(id));
        if (Math.min(...heights)>h.base+1 || Math.max(...heights)<h.base+1) continue;
        const u=ids.map(id=>((position.getX(id)-x)*dx+(position.getZ(id)-z)*dz)/(dx*dx+dz*dz));
        intervals.push([Math.min(...u),Math.max(...u)]);
      }
      for (let tenth=1;tenth<10;tenth++) {
        assert.ok(intervals.some(([a,b])=>a<=tenth/10 && b>=tenth/10),'mezera v průčelí č. '+h.number);
      }
      for(const [a,b] of [...h.faces,...h.roof]) {
        assert.ok(a>=0 && b<=pack.i.length && a%3===0 && b%3===0);
        for(let i=a;i<b;i+=3) {
          assert.ok(!selected.has(i),'dvě adresy sdílejí plochu '+i);
          selected.add(i);
        }
      }
    }
    const original=shell.index;
    let counts=[];
    for (const detailed of [false,true]) {
      shell.setIndex(original);
      const north=hasNorthSquare(file)?northSquareGeometry(file,pack,shell,detailed):null;
      const prior=shell.index.count;
      const geo=squareFrontGeometry(file,pack,shell,detailed,north);
      assert.equal(shell.index.count,prior-selected.size*3);
      assert.deepEqual(geo.userData.squareAddresses,entries.map(h=>h.number));
      assert.ok(Array.from(geo.attributes.uv.array).every(v=>v>=0 && v<=1));
      assert.ok(Number.isFinite(geo.boundingSphere.radius));
      assert.deepEqual(pack.roof,roofs);
      counts.push(geo.attributes.position.count);
      geo.dispose();
    }
    assert.ok(counts[1]>counts[0]);
    shell.dispose();
  });
}
