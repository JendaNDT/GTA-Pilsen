import assert from 'node:assert/strict';
import test from 'node:test';
import {Triangle, Vector3} from 'three/webgpu';
import {convexShell, indexTriangles, tileTriangles} from '../tools/static_structures.mjs';
import {corridor, hullContainsCorridorCenter} from '../tools/audit_structures.mjs';

test('řez zdi na hranici dlaždice nevytvoří mezeru ani nepřidá plochu', () => {
  const v = (x,y,z) => new Vector3(x,y,z);
  const original = new Triangle(v(-2,0,2),v(4,0,2),v(4,2,2));
  const tiles = tileTriangles([original],{size:8,x:0,z:0});
  assert.deepEqual(tiles.map(t=>t.cx).sort(),[-1,0]);
  let area = 0;
  const edges = [];
  for (const {cx,points} of tiles) {
    assert.ok(points.every(p => p.x >= cx*8 && p.x <= (cx+1)*8));
    edges.push([...new Set(points.filter(p=>p.x===0).map(p=>p.y.toFixed(6)))].sort());
    for (let i=0; i<points.length; i+=3) area += new Triangle(...points.slice(i,i+3)).getArea();
  }
  assert.deepEqual(edges[0],edges[1]);
  assert.ok(Math.abs(area-original.getArea()) < 1e-8);
});

test('i rovinná zeď má dvoustranný konvexní obal a indexovaný balík zachová každý trojúhelník', () => {
  const points = [[0,0,0],[0,1,0],[1,1,0],[1,0,0]].map(p=>new Vector3(...p));
  const shell = convexShell(points);
  const {p:[,vertices],i:[,indices]} = indexTriangles(shell);
  const expanded = [...indices].flatMap(i=>[...vertices.slice(3*i,3*i+3)]);
  assert.deepEqual(expanded,shell);
  const zs = expanded.filter((_,i)=>i%3===2);
  assert.ok(Math.min(...zs)<-0.014 && Math.max(...zs)>0.014);
  assert.ok(vertices.byteLength+indices.byteLength<shell.length*4);
});

test('krátká trasa celá uvnitř tělesa se rozpozná i bez průsečíku s povrchem', () => {
  const points = [];
  for(const x of [-6,6]) for(const y of [-6,6]) for(const z of [-6,6]) points.push(new Vector3(x,y,z));
  const data = convexShell(points), faces=[];
  for(let i=0;i<data.length;i+=9) faces.push(new Triangle(...[0,3,6].map(n=>new Vector3().fromArray(data,i+n))));
  const track = z=>corridor('zkouška',-1,z,0,1,z,0,1,2);
  assert.ok(hullContainsCorridorCenter(faces,new Vector3(),track(0)));
  assert.ok(!hullContainsCorridorCenter(faces,new Vector3(),track(10)));
});
