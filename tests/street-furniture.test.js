import test from 'node:test';
import assert from 'node:assert/strict';
import { streetFixtures, drawStreetFixture } from '../src/world/street-furniture.js';
import { blocksPassage } from '../tools/street_clearance.mjs';
import { corridor } from '../tools/audit_structures.mjs';

const scene = {heightAt: () => 0, chunkIndex: () => 9};
test('rozestupy fiktivních modelů respektují pěší trasu i rozdílnou výšku', () => {
  const route = corridor('cesta',-8,0,0,8,0,0,1.2,2.1);
  assert.ok(blocksPassage(2,1.8,0,1,1,route));
  assert.ok(!blocksPassage(2,2.3,0,1,1,route));
  assert.ok(!blocksPassage(2,0,4,1,1,route));
  assert.ok(!blocksPassage(12,0,0,1,1,route));
});

test('fiktivní lavička, koš a přístřešek sdílejí stabilní díly při každé předvolbě', () => {
  const make = kind => streetFixtures({id:'zkusebni-'+kind,kind,x:0,z:0,yaw:.4},scene);
  assert.equal(make('bench')[0].impulse,3000);
  assert.equal(make('bin')[0].impulse,800);
  const fixture=make('shelter');
  assert.equal(new Set(fixture.map(part=>part.id)).size,4);
  assert.equal(fixture.filter(part=>Number.isFinite(part.impulse)).length,1);
  for(const part of [...fixture,...make('bench'),...make('rack'),...make('bin')]){
    let faces=0;
    drawStreetFixture({quad(...vertices){ assert.ok(vertices.slice(0,4).flat().every(Number.isFinite)); faces++; }},part);
    assert.ok(faces>=5);
  }
});
