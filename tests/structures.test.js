import assert from 'node:assert/strict';
import test from 'node:test';
import { inventory } from '../tools/build_structures.mjs';

function floor(x, y, z, w, d) {
  return ['Most', [x,y,z, x+w,y,z, x+w,y,z+d, x,y,z+d]];
}
const source = (...faces) => ({objects: [['A', 1, faces]]});

test('inventarizace změří vzdálenost k ploše a oddělí různé výškové úrovně', () => {
  const ground = floor(0,0,0,10,10), ledge = floor(4,0.49,4,0.5,0.5), other = floor(1,1.2,1,1,1);
  const parts = inventory(source(ground, ledge, other));
  assert.deepEqual(parts.map(p => p.records).sort(), [1,2]);
  assert.equal(parts[0].status, 'čeká na ověření');
  const repeated = inventory(source(other, ledge, ground));
  assert.deepEqual(repeated, parts);
});

test('souvislé díly sdílejí identitu i při otočení obvodu, dvě totožná ID mají jediného vlastníka', () => {
  const a = floor(0,0,0,1,2);
  const b = ['Most', [1,0,0, 0,0,0, 0,0,2, 1,0,2]];
  const parts = inventory({objects: [['B', 1, [b]], ['A', 2, [a,b]]]});
  assert.equal(parts.length, 2);
  assert.equal(parts[0].records, 2);
  assert.equal(parts[0].faces.length, 1);
  assert.equal(parts[0].digest, parts[1].digest);
  assert.equal(parts[1].reason, parts[0].id);
});

test('svislá stěna protínající vnitřek vodorovné plochy tvoří jeden díl', () => {
  const wall = ['Zed_OpernaZed', [2,-1,3, 3,-1,3, 3,1,3, 2,1,3]];
  assert.equal(inventory(source(floor(0,0,0,6,6),wall)).length, 1);
});
