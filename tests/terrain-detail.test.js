import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window={};
globalThis.location={search:''};
globalThis.matchMedia=()=>({matches:false});
const {LC} = await import('../src/config.js');
const {terrainClassMask} = await import('../src/world/terrain-classes.js');
const box=(x,z,xx,zz)=>[[x,z],[xx,z],[xx,zz],[x,zz]];
function mock(polygons){
  const l={cls:[],pRing:[0],ringStart:[0],vx:[],vz:[]};
  for(const [cls,...rings] of polygons){
    l.cls.push(cls);
    for(const r of rings){for(const [x,z] of r){l.vx.push(x*10);l.vz.push(z*10);}l.ringStart.push(l.vx.length);}
    l.pRing.push(l.ringStart.length-1);
  }
  return l;
}
test('maska terénu zachová otvor, břeh a přednost lesa před polem i na hraně dlaždice',()=>{
  const l=mock([[LC.FARMLAND,box(0,0,8,4)],[LC.FOREST,box(1,0,7,4),box(3,1,5,3)],[LC.WATER,box(5,0,8,2)]]);
  const groups={[LC.FARMLAND]:0,[LC.FOREST]:1};
  const west=terrainClassMask(l,[2,0,1],groups,0,0,4,4);
  const east=terrainClassMask(l,[2,0,1],groups,4,0,4,4);
  assert.deepEqual([...west],[4,6,6,6,4,6,6,4,4,6,6,4,4,6,6,6]);
  assert.deepEqual([...east],[6,0,0,0,4,0,0,0,4,6,6,4,6,6,6,4]);
  assert.equal(terrainClassMask(l,[2],groups,0,0,4,4),null);
});
