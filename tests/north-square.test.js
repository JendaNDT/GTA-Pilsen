import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three/webgpu';
import { assetFingerprint, parsePack } from '../src/data.js';
import { northSquareGeometry } from '../src/world/north-square.js';
import { townHallGeometry } from '../src/world/town-hall.js';

for (const [file, expectedHouses] of [['-128--128.bin',[0,1]],['128--128.bin',[2,3,4,5]]]) {
  test('severní řada zachová měřené střechy, sousedy a jednodušší model v listu '+file,async ()=>{
    const bytes=await readFile(new URL('../public/detail/city/'+file,import.meta.url));
    const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    const pack=parsePack(buffer);
    const position=new THREE.Float32BufferAttribute(Float32Array.from(pack.p,(v,i)=>
      v*.02+[pack.header.cx,0,pack.header.cz][i%3]),3);
    const shell=new THREE.BufferGeometry();
    shell.setAttribute('position',position);
    shell.setIndex(new THREE.BufferAttribute(pack.i,1));
    const original=shell.index;
    assert.equal(northSquareGeometry(file,pack,shell,true),null);
    assert.equal(shell.index,original);
    pack.fileHash=assetFingerprint(buffer);
    const roof=pack.roof.slice();
    if (file==='128--128.bin') townHallGeometry(pack,shell);
    const prior=shell.index;
    const low=northSquareGeometry(file,pack,shell,false);
    assert.equal(shell.index.count+low.attributes.position.count,prior.count);
    const keep=Array.from(shell.index.array);
    shell.setIndex(prior);
    const high=northSquareGeometry(file,pack,shell,true);
    assert.deepEqual(Array.from(shell.index.array),keep);
    assert.ok(keep.length>prior.count*.98);
    assert.deepEqual(pack.roof,roof);
    assert.ok(high.attributes.position.count>low.attributes.position.count);
    const cells=new Set(), uv=low.attributes.uv;
    for (let i=0;i<uv.count;i++) {
      const x=uv.getX(i), y=uv.getY(i);
      assert.ok(x>=0 && x<=1 && y>=0 && y<=1);
      if (x<.75) cells.add(Math.floor(x*4)+3*Math.floor((1-y)*2));
    }
    assert.deepEqual([...cells].sort(),expectedHouses);
    high.dispose(); low.dispose(); shell.dispose();
  });
}
