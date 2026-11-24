import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three/webgpu';
import {assetFingerprint,parsePack} from '../src/data.js';
import {synagogueSurface} from '../src/world/synagogue.js';
import {alignTheatreTerrace,theatreSurfaces,theatreTile} from '../src/world/theatre.js';

test('divadlo respektuje odebrané stěny synagogy, měřené střechy a stabilní úseky zábradlí',async()=>{
  const file=await readFile(new URL('../public/detail/city/'+theatreTile,import.meta.url));
  const bytes=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const pack=parsePack(bytes), shell=new THREE.BufferGeometry();
  const coords=Float32Array.from(pack.p,(v,i)=>v*.02+[pack.header.cx,0,pack.header.cz][i%3]);
  shell.setAttribute('position',new THREE.BufferAttribute(coords,3));
  shell.setIndex(new THREE.BufferAttribute(pack.i,1));
  const roof=pack.roof.slice(),city={chunkIndex:()=>111},original=shell.index;
  assert.equal(theatreSurfaces(pack,shell,city),null);
  assert.equal(shell.index,original);
  pack.fileHash=assetFingerprint(bytes);
  const synagogue=synagogueSurface(pack,shell);
  const before=new Set(shell.index.array), indexCount=shell.index.count;
  const {geometry,fixtures}=theatreSurfaces(pack,shell,city);
  assert.ok(synagogue && geometry);
  assert.ok(shell.index.array.every(i=>before.has(i)));
  assert.ok(shell.index.count < indexCount);
  assert.deepEqual(pack.roof,roof);
  const uv=geometry.attributes.uv.array;
  assert.ok(uv.every(x=>Number.isFinite(x) && x>=0 && x<=1));
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox.max.y>41 && geometry.boundingBox.max.y<43);
  assert.ok(fixtures.some(f=>f.kind==='balustrade') && fixtures.some(f=>f.kind==='theatreGlass'));
  assert.equal(new Set(fixtures.map(f=>f.id)).size,fixtures.length);
  assert.ok(fixtures.every(f=>f.id.startsWith('street/111/') && f.corners.length===4 && Number.isFinite(f.impulse)));
});

test('jen odpovídající půdorys terasy převezme výšku sousedního měření',()=>{
  const city={buildingAt:()=>0,b:{bRing:[0,1],ringStart:[0,18]},bTop:[14],bWall:[14]};
  assert.equal(alignTheatreTerrace(city),undefined);
  assert.equal(city.bTop[0],14);
  city.b.ringStart[1]=19;
  assert.equal(alignTheatreTerrace(city),0);
  assert.equal(city.bTop[0],7.1);
  assert.equal(city.bWall[0],7.1);
});
