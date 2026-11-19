import assert from 'node:assert/strict';
import test from 'node:test';
import {Triangle,Vector3} from 'three/webgpu';
import {deckSection,planCalibration} from '../tools/survey_bridges.mjs';

function deck(low,high,y) {
  const a = new Vector3(-4,y,low), b = new Vector3(4,y,low);
  const c = new Vector3(4,y,high), d = new Vector3(-4,y,high);
  return [new Triangle(a,b,c),new Triangle(a,c,d)];
}

test('řez používá vyšší líc desky a nezapočítá vedlejší oddělenou plošinu', () => {
  const surfaces = [...deck(-3,2,0),...deck(-3,2,-0.6),...deck(3,6,4)];
  assert.deepEqual(deckSection(surfaces,0,-0.2,0,1,0),{width:5,offset:-0.5,lift:0.2});
  assert.equal(deckSection(surfaces,0,0,2.5,1,0),undefined);
});

test('půdorys vyžaduje shodu jednoho mostu, pěti řezů a průběžné šířky', () => {
  const choice = {road:0,deck:'zkouška',type:'lávka',reason:'Změřená šířka.'};
  const match = {id:0,type:'lávka',from:0,to:19,routeLength:20,width:3.8,offset:0.1,shiftX:0,shiftZ:0.1,
    samples:Array.from({length:5},()=>({width:3.8,offset:0.1}))};
  const rows=[{id:'zkouška',matches:[match]}];
  const world={rOff:[0,2],gradeRoads:new Set()};
  assert.deepEqual(planCalibration(choice,rows,world),{kind:'plan',road:0,halfWidth:1.9,shiftX:0,shiftZ:0.1,lift:0});
  match.samples[2].offset=0.6;
  assert.throws(()=>planCalibration(choice,rows,world),/celému půdorysu/);
  match.samples[2].offset=0.1;
  rows[0].matches.push({...match,id:1});
  assert.throws(()=>planCalibration(choice,rows,world),/Nejednoznačný/);
});
