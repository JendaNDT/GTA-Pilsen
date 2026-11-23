import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as THREE from 'three/webgpu';
import {assetFingerprint, parsePack} from '../src/data.js';
import {canopyTile, stationSurfaces, stationTile} from '../src/world/station-building.js';

async function loadTile(name) {
  const file = await readFile(new URL('../public/detail/city/'+name, import.meta.url));
  const bytes = file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const pack = parsePack(bytes);
  pack.fileHash = assetFingerprint(bytes);
  const shell = new THREE.BufferGeometry();
  const points = Float32Array.from(pack.p, (value, i) => value*.02 + [pack.header.cx,0,pack.header.cz][i%3]);
  shell.setAttribute('position',new THREE.BufferAttribute(points,3));
  shell.setAttribute('color',new THREE.BufferAttribute(pack.c,3,true));
  shell.setAttribute('aWin',new THREE.Float32BufferAttribute(pack.win,3));
  shell.setIndex(new THREE.BufferAttribute(pack.i,1));
  return {pack,shell};
}

test('průčelí se připojí jen ke správnému měření, fyzické plochy střech si zachovají vrcholy', async () => {
  const {pack,shell} = await loadTile(stationTile);
  const original = shell.index, roof = pack.roof.slice(), positions = shell.attributes.position.array.slice();
  assert.equal(stationSurfaces({...pack,fileHash:'jiná revize'},shell),null);
  assert.equal(shell.index,original);
  const {front,copper} = stationSurfaces(pack,shell);
  assert.ok(shell.index.count < original.count);
  for (const geometry of [front,copper]) {
    assert.ok(geometry.attributes.position.count > 100);
    assert.equal(geometry.attributes.position.count,geometry.attributes.uv.count);
    assert.ok(geometry.attributes.uv.array.every(Number.isFinite));
  }
  const xs = front.attributes.uv.array.filter((_, i) => i%2===0);
  assert.ok(xs.every(u=>u>=0 && u<=1));
  assert.deepEqual(pack.roof,roof);
  assert.deepEqual(shell.attributes.position.array,positions);
});

test('sousední dlaždice obsahuje jen společný kovový lem bez druhého průčelí', async () => {
  const {pack,shell} = await loadTile(canopyTile);
  const original = shell.index, before = pack.c.slice();
  assert.equal(stationSurfaces(pack,shell),null);
  assert.equal(shell.index,original);
  const changed = before.reduce((count,v,i)=>count+Number(pack.c[i]!==v),0);
  assert.ok(changed>0 && changed<120);
});
