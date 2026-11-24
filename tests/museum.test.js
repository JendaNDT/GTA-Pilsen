import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three/webgpu';
import { assetFingerprint, parsePack } from '../src/data.js';
import { museumGeometry, museumTile } from '../src/world/museum.js';

test('muzeum zachová sousedy a měřené kolizní střechy, tři lucerny sedí na osách zaměřených věží', async () => {
  const data = await readFile(new URL('../public/detail/city/'+museumTile,import.meta.url));
  const bytes = data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const pack = parsePack(bytes), shell = new THREE.BufferGeometry();
  const offset = [pack.header.cx,0,pack.header.cz];
  const coords = Float32Array.from(pack.p,(v,i) => offset[i%3]+.02*v);
  shell.setAttribute('position',new THREE.BufferAttribute(coords,3));
  shell.setIndex(new THREE.BufferAttribute(pack.i,1));
  const index = shell.index, roofs = pack.roof.slice();
  assert.equal(museumGeometry(pack,shell),null);
  assert.equal(shell.index,index);
  pack.fileHash = assetFingerprint(bytes);
  const museum = museumGeometry(pack,shell);
  assert.deepEqual([...shell.index.array],[...pack.i.slice(0,432),...pack.i.slice(2121)]);
  assert.deepEqual(pack.roof,roofs);
  const pos = museum.getAttribute('position');
  assert.ok(museum.getAttribute('uv').array.every(v => v>=0 && v<=1));
  assert.ok(pos.count/3<2300);
  for (const [x,z,tip] of [[118.58,280.68,44.32],[115.2,290.2,33],[128.75,279.69,33]]) {
    let highest = -Infinity;
    for (let i=0; i<pos.count; i++) {
      if (Math.hypot(pos.getX(i)-x,pos.getZ(i)-z)<.02) highest = Math.max(highest,pos.getY(i));
    }
    assert.ok(Math.abs(highest-tip)<.01);
  }
});
