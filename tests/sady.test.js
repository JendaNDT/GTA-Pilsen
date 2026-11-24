import test from 'node:test';
import assert from 'node:assert/strict';
import { beds, features, inParkFountain, inRusalka, inSady, museumWaterPolygon } from '../src/world/sady-layout.js';
import { easternBenches, easternSites, footbridge, reedBeds } from '../src/world/strouha-layout.js';
import { bankPlants } from '../src/world/strouha-plants.js';
import { Group, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { buildSady, createSady, featureGeometry } from '../src/world/sady-model.js';
import { fountainSurface, fountainRay } from '../src/world/fountain-site.js';

test('Smetanovy sady mají průchozí promenádu, záhony v parku a dvě odlišné kašny',()=>{
  const tiles=(x,z)=>Math.floor((x+2048)/256)+8192*Math.floor((z+2048)/256);
  const world={chunkIndex:tiles,heightAt:(x,z)=>.07*x+.055*z};
  const garden=createSady(world);
  const [rusalka,smetana,leknin]=garden.solids;
  assert.deepEqual(garden.solids.map(s=>s.id),features.map(s=>s.id));
  assert.ok(beds.every(([x,z])=>inSady(x,z)));
  assert.ok(inRusalka(rusalka.x,rusalka.z));
  assert.ok(!inRusalka(leknin.x,leknin.z));
  assert.ok(rusalka.ground > world.heightAt(rusalka.x,rusalka.z)+.2);
  assert.ok(fountainSurface(garden.solids,smetana.x,smetana.z,Infinity)>smetana.ground+4);
  assert.ok(fountainRay(garden.solids,leknin.x-2,leknin.z,leknin.x+2,leknin.z,leknin.ground+.42)<1);
  assert.equal(fountainSurface(garden.solids,-203,286,Infinity),-Infinity);
  assert.ok([...garden.tiles.values()].every(t=>t.collision.length%9===0));
  assert.equal([...garden.tiles.values()].flatMap(t=>t.benches).length,33+easternBenches.length);
  assert.equal(createSady({chunkIndex:()=>-1}),null);
});

test('Všech pět vodních prvků má na nízké i vysoké kvalitě hladinu a vypínatelný proud',()=>{
  for(const spec of features.filter(s=>['rusalka','leknin','corso','matka','muzeum'].includes(s.id))) for(const detail of [false,true]){
    for(const flow of [false,true]) {
      const geo=featureGeometry(spec,detail,flow);
      const wet=geo.attributes.wet.array;
      assert.ok(wet.includes(1));assert.equal(wet.some(type=>type>=2),flow);
      if (spec.id==='muzeum' && flow) assert.ok([3,4,5,6].every(group=>wet.includes(group)));
      assert.ok(geo.attributes.position.array.every(Number.isFinite));
      geo.dispose();
    }
  }
});

test('U muzea nahrazuje oválná nádrž původní vodu a do parkových cest se nepočítá ulice',()=>{
  for (const site of features.filter(site => site.rx || ['leknin','rusalka'].includes(site.id))) {
    assert.ok(inParkFountain(site.x,site.z));
  }
  assert.equal(inParkFountain(75,302.6),false);
  assert.equal(museumWaterPolygon(134,300.9,148.5,314.2),true);
  assert.equal(museumWaterPolygon(134,300,195,355),false);
  assert.ok(inSady(-84,295) && inSady(72,304));
  assert.equal(inSady(15.7,301),false);
});

test('Zelené loubí na nízké kvalitě zachová stejnou délku a zjednoduší listí',()=>{
  const arch=features.find(site=>site.id==='loubi');
  const detailed=featureGeometry(arch,true,false), simple=featureGeometry(arch,false,false);
  detailed.computeBoundingBox();
  simple.computeBoundingBox();
  assert.ok(simple.attributes.position.count < detailed.attributes.position.count / 2);
  assert.ok(Math.abs(simple.boundingBox.min.x - detailed.boundingBox.min.x) < .25);
  assert.ok(Math.abs(simple.boundingBox.max.x - detailed.boundingBox.max.x) < .25);
  detailed.dispose();
  simple.dispose();
});

test('Strouha má pevné molo, dvě samostatná zábradlí, volný průchod a rostliny ze skutečných mokřadů',()=>{
  const world={chunkIndex:()=>0,heightAt:()=>0};
  const garden=createSady(world);
  const bridge=garden.solids.find(site=>site.id==='lavka');
  const tile=garden.tiles.get(0);
  assert.equal(tile.rails.length,12);
  assert.equal(new Set(tile.rails.map(rail=>rail.id)).size,12);
  assert.ok(tile.rails.every(rail=>rail.impulse>0 && Number.isFinite(rail.impulse)));
  assert.ok(fountainSurface([bridge],footbridge.x,footbridge.z,1)>.32);
  assert.equal(fountainRay([bridge],282,-46,298,-36,1),1);
  assert.ok(!inSady(252,-7) && inSady(170,220));
  for (const detail of [true,false]) {
    const plants=bankPlants(world,reedBeds,detail);
    assert.ok(plants.attributes.position.count>100);
    plants.dispose();
    for(const spec of easternSites) {
      const g=featureGeometry(spec,detail,false);
      assert.ok(g.attributes.position.count>0 && g.attributes.position.array.every(Number.isFinite));
      g.dispose();
    }
  }
});

test('Lávka ve vzdáleném pohledu šetří kreslení a zblízka leží na stejném místě jako její kolize',()=>{
  const world={chunkIndex:()=>0,heightAt:()=>12};
  const site=createSady(world).solids.find(s=>s.id==='lavka');
  const tile={sites:[site],beds:[],reeds:[],benches:[],rails:[]};
  const owner={group:new Group(),disposables:[]};
  buildSady(world,tile,owner,undefined,false,false,null);
  owner.group.updateMatrixWorld(true);
  const mesh=owner.group.getObjectByName(site.name);
  const origin=mesh.getWorldPosition(new Vector3());
  assert.ok(origin.distanceTo(new Vector3(site.x,site.ground,site.z))<1e-6);
  const camera=new PerspectiveCamera();
  for(const [distance,visible] of [[4,true],[800,false],[4,true]]) {
    camera.position.set(site.x,site.ground+distance,site.z);
    camera.updateMatrixWorld(true);
    mesh.parent.update(camera);
    assert.equal(mesh.visible,visible);
  }
  for(const item of owner.disposables) item.dispose();
  mesh.material.dispose();
});
