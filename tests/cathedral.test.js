import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three/webgpu';
import { assetFingerprint,parsePack } from '../src/data.js';
import { cathedralGeometry,cathedralHands,cathedralTile } from '../src/world/cathedral.js';

test('katedrála přebírá zaměřenou stavbu a ponechá okolní domy i kolizní střechy',async () => {
  const data = await readFile(new URL('../public/detail/city/'+cathedralTile,import.meta.url));
  const bytes = data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const pack = parsePack(bytes), shell = new THREE.BufferGeometry();
  const position = Float32Array.from(pack.p,(v,i) => v*.02+[pack.header.cx,0,pack.header.cz][i%3]);
  shell.setAttribute('position',new THREE.BufferAttribute(position,3));
  shell.setIndex(new THREE.BufferAttribute(pack.i,1));
  const index = shell.index, roofs = pack.roof.slice();
  assert.equal(cathedralGeometry(pack,shell),null);
  assert.equal(shell.index,index);
  pack.fileHash = assetFingerprint(bytes);
  const stone = cathedralGeometry(pack,shell);
  assert.deepEqual(shell.index.array,pack.i.slice(3351));
  assert.deepEqual(pack.roof,roofs);
  assert.ok(stone.attributes.uv.array.every(v => Number.isFinite(v) && v>=0 && v<=1));
  stone.computeBoundingBox();
  assert.ok(stone.boundingBox.max.y>100 && stone.boundingBox.max.y<102);
  assert.equal(pack.di.length,1248);
  for (const i of pack.di) {
    const x = pack.header.cx+pack.dp[i*3]*.02, z = pack.header.cz+pack.dp[i*3+2]*.02;
    assert.ok(Math.abs(x)<36 && Math.abs(z)<30);
  }
});

test('na čtyřech stranách hlavní věže ukazuje delší ručička minuty a kratší hodiny',() => {
  const hands = cathedralHands(), p = hands.geometry.attributes.position;
  const original = p.array.slice(), version = p.version;
  hands.setTime(.2/60);
  assert.equal(p.version,version);
  hands.setTime(3.5);
  for (let i=0;i<4;i++) {
    const start = 12*i;
    assert.ok(Math.abs(p.getY(start+8)-51.77)<.01);
    assert.ok(Math.abs(p.getY(start+2)-(53.38+1.09*Math.cos(3.5*Math.PI/6)))<.01);
  }
  hands.setTime(0);
  assert.deepEqual(p.array,original);
});
