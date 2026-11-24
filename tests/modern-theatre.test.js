import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three/webgpu';
import { assetFingerprint, parsePack } from '../src/data.js';
import { modernTheatreGeometry, modernTheatreSite, modernTheatreTile, screenFaces, theatrePoint } from '../src/world/modern-theatre.js';

test('Nové divadlo má průhledné otvory, průchozí portál a pevné ostění',()=>{
  const coords=[];
  screenFaces(triangle=>coords.push(...triangle.flat()));
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const hits=(v,h)=>{
    const origin=new THREE.Vector3(...theatrePoint(-2,v,h));
    const direction=new THREE.Vector3(...theatrePoint(2,v,h)).sub(origin).normalize();
    return new THREE.Raycaster(origin,direction).intersectObject(mesh).map(hit=>hit.distance);
  };
  assert.equal(hits(-.16,2.7).length,0);
  assert.equal(hits(-9,14).length,0);
  const pier=hits(-1.84,2.7);
  assert.equal(pier.length,2);
  assert.ok(Math.abs(pier[1]-pier[0]-.52)<.01);
});

test('Nové divadlo přebarví pouze své zaměřené plochy a chrání cizí revize',async()=>{
  const file=await readFile(new URL('../public/detail/city/'+modernTheatreTile,import.meta.url));
  const bytes=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const pack=parsePack(bytes), shell=new THREE.BufferGeometry();
  const coords=Float32Array.from(pack.p,(v,i)=>v*.02+[pack.header.cx,0,pack.header.cz][i%3]);
  shell.setAttribute('position',new THREE.BufferAttribute(coords,3));
  shell.setIndex(new THREE.BufferAttribute(pack.i,1));
  const site={bridges:[],ground:1.8}, world={bBase:{103127:5}}, original=shell.index;
  assert.equal(modernTheatreGeometry(pack,shell,world,site),null);
  assert.equal(shell.index,original);
  assert.equal(modernTheatreSite(world,{}),null);
  pack.fileHash=assetFingerprint(bytes);
  const painted=modernTheatreGeometry(pack,shell,world,site);
  assert.deepEqual([...shell.index.array],[...pack.i.slice(0,8091),...pack.i.slice(8826)]);
  assert.ok(painted.attributes.uv.array.every(v=>Number.isFinite(v) && v>=0 && v<=1));
  painted.computeBoundingBox();
  assert.ok(Math.abs(painted.boundingBox.max.y-27.02)<.03);
});
