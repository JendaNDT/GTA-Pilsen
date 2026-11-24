import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three/webgpu';
import { assetFingerprint, parsePack } from '../src/data.js';
import { synagogueSurface, synagogueTile } from '../src/world/synagogue.js';

test('synagoga a obě sousední průčelí odpovídají městskému listu a zachovají měření střech', async () => {
  const file = await readFile(new URL('../public/detail/city/'+synagogueTile,import.meta.url));
  const bytes = file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const pack = parsePack(bytes);
  const shell = new THREE.BufferGeometry();
  const points = Float32Array.from(pack.p,(v,i)=>v*.02+[pack.header.cx,0,pack.header.cz][i%3]);
  shell.setAttribute('position',new THREE.BufferAttribute(points,3));
  shell.setIndex(new THREE.BufferAttribute(pack.i,1));
  const original = shell.index, roof = pack.roof.slice();
  assert.equal(synagogueSurface(pack,shell),null);
  assert.equal(shell.index,original);
  pack.fileHash = assetFingerprint(bytes);
  const mesh = synagogueSurface(pack,shell);
  const uv = mesh.attributes.uv, p = mesh.attributes.position;
  assert.equal(uv.count,p.count);
  assert.ok(shell.index.count < original.count);
  assert.deepEqual(pack.roof,roof);
  assert.equal(shell.attributes.position.array,points);
  const bays = new Set(), towers = new Set();
  for (let i=0; i<uv.count; i++) {
    const x = uv.getX(i)*144, y = p.getY(i);
    assert.ok(Number.isFinite(x) && x>=0 && x<=144 && Number.isFinite(uv.getY(i)));
    if (x<38) bays.add('levý dům');
    if (x>41 && x<74) bays.add('synagoga');
    if (x>76 && x<112) bays.add('nároží');
    if (x>122 && x<130 && y<10) bays.add('konec boční ulice');
    if (y>43) towers.add(p.getZ(i)<98 ? 'sever' : 'jih');
  }
  assert.equal(bays.size,4);
  assert.equal(towers.size,2);
  assert.ok(p.count/3 < 3000);
});
