import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three/webgpu';
import { assetFingerprint, parsePack } from '../src/data.js';
import { townHallClock, townHallGeometry, townHallTile } from '../src/world/town-hall.js';

test('radnice nahradí jen ověřené průčelí, štíty a věžičku v městském listu', async () => {
  const data = await readFile(new URL('../public/detail/city/'+townHallTile,import.meta.url));
  const bytes = data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const pack = parsePack(bytes), shell = new THREE.BufferGeometry();
  const position = Float32Array.from(pack.p,(v,i) => v*.02+[pack.header.cx,0,pack.header.cz][i%3]);
  shell.setAttribute('position',new THREE.BufferAttribute(position,3));
  shell.setIndex(new THREE.BufferAttribute(pack.i,1));
  const original = shell.index, roofs = pack.roof.slice();
  assert.equal(townHallGeometry(pack,shell),null);
  assert.equal(shell.index,original);
  pack.fileHash = assetFingerprint(bytes);
  const facade = townHallGeometry(pack,shell);
  assert.deepEqual([...shell.index.array],[...pack.i.slice(42,336),...pack.i.slice(552,642),
    ...pack.i.slice(657,732),...pack.i.slice(792)]);
  assert.deepEqual(pack.roof,roofs);
  assert.ok(facade.attributes.uv.array.every(v => Number.isFinite(v) && v>=0 && v<=1));
  facade.computeBoundingBox();
  assert.ok(Math.abs(facade.boundingBox.max.y-36.52)<.05);
});

test('ručičky radnice sledují čas hry, včetně půlnoci a zlomku hodiny', () => {
  const clock = townHallClock(new THREE.MeshBasicMaterial());
  const [hours,minutes] = clock.children;
  for (const [time,hourTurns,minuteTurns] of [[0,0,0],[3.5,3.5/12,.5],[23.75,11.75/12,.75]]) {
    clock.setTime(time);
    const turns = hand => (-hand.rotation.z/(2*Math.PI))%1;
    assert.ok(Math.abs(turns(hours)-hourTurns)<1e-8);
    assert.ok(Math.abs(turns(minutes)-minuteTurns)<1e-8);
  }
});
