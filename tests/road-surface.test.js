import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {};
globalThis.location = {search:''};
globalThis.matchMedia = () => ({matches:false});
const {roadWear,roadStations} = await import('../src/world/road-surface.js');
const {RC} = await import('../src/config.js');

test('týdenní provoz ovlivní stopy pouze na příslušné silnici a podle délky měřených úseků',()=>{
  const world={r:{cls:[RC.RESIDENTIAL,RC.RESIDENTIAL,RC.RESIDENTIAL,RC.FOOTWAY,RC.PRIMARY]},eRoad:[0,0,1],eLen:[3,1,4]};
  const curve=(work,weekend)=>({curve:{weekday:Array(24).fill(work),weekend:Array(24).fill(weekend)}});
  const result=roadWear(world,new Map([[0,curve(1,0.5)],[1,curve(0,0)],[2,curve(0.1,0.1)]]));
  assert.ok(Math.abs(result[0]-(0.42*0.43+0.58*(6/7)*0.75))<1e-6);
  assert.ok(result[0]>result[2] && result[1]<result[2]);
  assert.equal(result[3],0);
  assert.ok(result[4]>result[2]);
});
test('podélné metry záplat pokračují v další dlaždici a začínají od nuly na jiné silnici',()=>{
  const w={rpx:[0,3,9,-100,-100],rpz:[0,4,12,-7,5],rCount:2,rOff:[0,3,5]};
  assert.deepEqual([...roadStations(w)],[0,5,15,0,12]);
});
