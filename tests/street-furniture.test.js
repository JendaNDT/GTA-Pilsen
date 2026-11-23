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

test('nízká předvolba kreslí jednodušší lavičku a koš při stejných kolizích', () => {
  for (const kind of ['bench','bin']) {
    const [fixture] = streetFixtures({id:'vzorek',kind,x:0,z:0,yaw:0},scene);
    const faces = detailed => {
      let count = 0;
      drawStreetFixture({quad(){count++;}},fixture,detailed);
      return count;
    };
    assert.ok(faces(false) > 0 && faces(false) < faces(true));
  }
});

test('čtyři čísla stanovišť jsou čitelná z obou stran i na nízké předvolbě', () => {
  const shapes = new Set();
  for (const number of [1, 2, 3, 4]) {
    const [sign] = streetFixtures({kind:'platformSign', id:'zkouska', number, x:0, z:0, yaw:0}, scene);
    const strokes = detailed => {
      const faces = [];
      drawStreetFixture({quad(a,b,c,d,color) {
        if (color[0] === .98) faces.push([a,b,c,d]);
      }}, sign, detailed);
      return faces;
    };
    const digits = strokes(false);
    assert.deepEqual(digits, strokes(true));
    const front = digits.filter(face => face[0][2] > 0);
    const back = digits.filter(face => face[0][2] < 0);
    assert.ok(front.length > 0);
    assert.deepEqual(back.map(face => face.map(([x,y,z]) => [0-x,y,-z])), front);
    shapes.add(JSON.stringify(front));
    assert.ok(Number.isFinite(sign.impulse));
  }
  assert.equal(shapes.size, 4);
});

test('rozcestník ukazuje na obou stranách stejné číslo ke stejnému konci tabule', () => {
  const [guide] = streetFixtures({kind:'platformGuide', id:'rozcesti', x:0, z:0, yaw:0,
    left:[3,4], right:[1,2]}, scene);
  const groups = new Map();
  drawStreetFixture({quad(a,b,c,d,color) {
    if (color[2] !== .14) return;
    const face = a[2] > 0 ? 'zepředu' : 'zezadu';
    const end = a[0] > 0 ? 'východ' : 'západ';
    const key = face + '/' + end;
    const centers = groups.get(key) ?? [];
    centers.push((a[0]+b[0]+c[0]+d[0])/4);
    groups.set(key, centers);
  }}, guide, false);
  for (const end of ['východ','západ']) {
    const ordered = side => {
      const coords = groups.get(side + '/' + end);
      const divide = end === 'východ' ? .52 : -.52;
      return [coords.filter(x => x < divide).length, coords.filter(x => x > divide).length];
    };
    assert.deepEqual(ordered('zepředu'), end === 'východ' ? [2,5] : [4,3]);
    assert.deepEqual(ordered('zezadu').reverse(), ordered('zepředu'));
  }
});
