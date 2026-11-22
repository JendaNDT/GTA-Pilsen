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

test('kontrola průjezdu respektuje výšku podjezdu, šířku i podélný sklon', async () => {
  const { Triangle, Vector3 } = await import('three/webgpu');
  const { corridor, intersectsCorridor } = await import('../tools/audit_structures.mjs');
  const c = corridor('zkouška',0,0,1,10,0,3,1.5,3);
  const triangle = (x,y,z) => new Triangle(new Vector3(x,y,z),new Vector3(x,y+1,z),new Vector3(x+0.4,y,z+0.1));
  assert.ok(intersectsCorridor(triangle(5,2.5,1.4),c));
  assert.ok(!intersectsCorridor(triangle(5,6,0),c));
  assert.ok(!intersectsCorridor(triangle(5,-1,0),c));
  assert.ok(!intersectsCorridor(triangle(5,3,2),c));
});

test('základní model sdílí vrcholy s kolizí a přežije chybějící detail i pozdní odpověď', async t => {
  const { readFile } = await import('node:fs/promises');
  const { Group, MeshBasicMaterial } = await import('three/webgpu');
  const { loadStructureCore } = await import('../src/data.js');
  const { Structures } = await import('../src/world/structures.js');
  const directory = new URL('../public/detail/structures/', import.meta.url);
  let fetchDetail, corrupt = false;
  const request = t.mock.method(globalThis, 'fetch', async url => {
    const file = url.split('/').at(-1);
    if (file === 'core.bin' && corrupt) return new Response('neplatná data');
    if (file === 'index.json' || file === 'core.bin') return new Response(await readFile(new URL(file, directory)));
    return new Promise(resolve => { fetchDetail = resolve; });
  });
  assert.equal(await loadStructureCore('?structures=0'), null);
  assert.equal(request.mock.callCount(), 0);
  const layer = await loadStructureCore('');
  const tile = layer.index.tiles[0], cols = 100, ci = tile.cz * cols + tile.cx;
  const models = new Structures(layer, cols, 100);
  const group = new Group(), material = new MeshBasicMaterial();
  const item = models.build(ci, group, material);
  assert.deepEqual(item.mesh.geometry.attributes.position.array, models.positionsFor(ci));
  models.setNear(item, true);
  fetchDetail(new Response(null, {status:404}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(item.mesh.geometry, item.core);
  models.setNear(item, false);
  models.setNear(item, true);
  const late = fetchDetail;
  models.dispose(item);
  late(new Response(await readFile(new URL(tile.file, directory))));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(item.mesh.geometry, item.core);
  assert.equal(group.children.length, 0);
  corrupt = true;
  assert.equal(await loadStructureCore(''), null);
  material.dispose();
});

test('příčné řezy členitého půdorysu zachovají plochu i vnitřní volný prostor', async () => {
  const {footprintStrips} = await import('../tools/calibrate_bridge.mjs');
  const ring = [[0,0],[8,0],[8,1],[2,1],[2,3],[8,3],[8,4],[0,4]];
  const strips = footprintStrips(ring);
  const area = strips.reduce((a,[u,lo,hi,v,endLo,endHi]) => a + (v-u)*(hi-lo+endHi-endLo)/2, 0);
  assert.equal(area,20);
  assert.ok(strips.every(([u,lo,hi,v]) => v-u <= 2.5 && (v <= 2 || lo >= 3 || hi <= 1)));
});

test('kalibrovaný průřez zachovává šířku chodníků a výšku horních městských ploch', async () => {
  const {readFile} = await import('node:fs/promises');
  const {parsePack} = await import('../src/data.js');
  const index = JSON.parse(await readFile(new URL('../public/detail/structures/index.json', import.meta.url)));
  const bridge = index.bridges.find(b => b.road === 19);
  const bytes = await readFile(new URL('../public/data/roads.bin', import.meta.url));
  const r = parsePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const k = r.start[bridge.road], h = r.bridgeOff[bridge.road];
  const length = Math.hypot(r.dx[k], r.dz[k])*0.1;
  const levels = [-2.025,-2.045,-2.045,-2.069,-2.101];
  const axis = (-r.dz[k]*bridge.shiftX + r.dx[k]*bridge.shiftZ)*0.1/length;
  assert.ok(axis > 0.5 && axis < 0.65);
  for (const [i,t] of [0.2,0.35,0.5,0.65,0.8].entries()) {
    const u = length*t;
    const bands = bridge.strips.filter(s => s[0] <= u && s[3] > u).map(([a,lo,hi,b,elo,ehi]) => {
      const f = (u-a)/(b-a);
      return [lo+(elo-lo)*f,hi+(ehi-hi)*f];
    }).sort((a,b) => a[0]-b[0]);
    assert.equal(bands.length,2);
    assert.ok(Math.abs(bands[1][0]-bands[0][1]-15) < 0.1);
    const height = bridge.lift + 0.02*(r.bridgeY[h]*(1-t) + r.bridgeY[h+1]*t);
    assert.ok(Math.abs(height-levels[i]) < 0.1);
  }
  assert.equal(bridge.railHeight,1.15);
  // Měřený střed pilíře i oba konce městské desky leží uvnitř uličního úseku.
  for (const [i, expected] of [0.043,0.504,0.961].entries()) {
    assert.ok(Math.abs(bridge.archStops[i]-expected)*length < 0.1);
  }
});

test('detail dalších dlaždic počká na volnou kapacitu i při zrušení přenosu', async t => {
  const {Structures} = await import('../src/world/structures.js');
  const {Group, MeshBasicMaterial} = await import('three/webgpu');
  const pending = [];
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => pending.push(resolve)));
  const tiles = [0,1,2].map(cx => ({cx, cz:0, file:cx+'_0.bin', objects:[{start:0,count:3}]}));
  const models = new Structures({positions:new Float32Array(9), index:{tiles}}, 3, 1);
  const group = new Group(), material = new MeshBasicMaterial();
  const items = tiles.map(({cx}) => models.build(cx,group,material));
  for (const item of items) models.setNear(item,true,2);
  assert.equal(models.loading,2);
  assert.equal(items[2].controller,null);
  models.setNear(items[0],false);
  models.setNear(items[2],true,2);
  assert.equal(pending.length,2);
  pending[0](new Response(null,{status:404}));
  await new Promise(resolve => setImmediate(resolve));
  models.setNear(items[2],true,1);
  assert.equal(items[2].controller,null);
  models.setNear(items[2],true,2);
  assert.equal(pending.length,3);
  for (const resolve of pending.slice(1)) resolve(new Response(null,{status:404}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(models.loading,0);
  for (const item of items) models.dispose(item);
  material.dispose();
});

test('základ načte i první verzi a odmítne index trojúhelníku mimo vrcholy', async t => {
  const {mkdtemp, readFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {writePack} = await import('../tools/write_pack.mjs');
  const {loadStructureCore, assetFingerprint} = await import('../src/data.js');
  const dir = await mkdtemp(join(tmpdir(),'vrcholy-'));
  t.after(() => rm(dir,{recursive:true,force:true}));
  const file = join(dir,'core.bin');
  const p = Float32Array.of(0,1,0, 1,1,0, 0,1,1);
  let version = 1;
  let manifestHash;
  const verifyFixture = (_,bytes) => assetFingerprint(bytes) === manifestHash;
  const tile = {cx:0, cz:0, file:'0_0.bin', objects:[{start:0,dStart:0,count:3,dCount:3}]};
  t.mock.method(globalThis,'fetch',async url => {
    const bytes = await readFile(file);
    if (url.endsWith('core.bin')) return new Response(bytes);
    const encoded = new TextEncoder().encode(JSON.stringify({version,tiles:[tile],hash:assetFingerprint(bytes)}));
    manifestHash = assetFingerprint(encoded);
    return new Response(encoded);
  });
  writePack(file,{version},{p:['f4',p]});
  assert.deepEqual((await loadStructureCore('', verifyFixture)).positions,p);
  version = 2;
  for (const [index,valid] of [[2,true],[3,false]]) {
    writePack(file,{version},{p:['f4',p],i:['u2',Uint16Array.of(0,1,index)]});
    const layer = await loadStructureCore('', verifyFixture);
    if (valid) assert.deepEqual(layer.positions,p);
    else assert.equal(layer,null);
  }
});

test('u vodního dílu změří podíl vzorků ve vodě a výšku každého vrcholu nad místním terénem', async () => {
  const {sampleWaterPart} = await import('../tools/review_water_structures.mjs');
  const part = {faces:[floor(0,4,0,2,2),floor(0,4,0,2,2)]};
  const world = {
    landContains: (i,x) => i === 9 && x >= 1,
    buildingAt: (x,z) => x === 0 && z === 0 ? 0 : -1,
    heightAt: x => 3+x
  };
  const result = sampleWaterPart(part,world,[9],[[1,5]]);
  assert.deepEqual(result,{samples:5,wet:3,buildings:1,min:-1,max:1,nearest:4});
});

test('při kontrole samostatného zábradlí odliší pata terén, mostovku a již přítomný okraj', async () => {
  const {railingSupport, reviewRailings} = await import('../tools/review_railings.mjs');
  const panel = {id:'zkusebni',status:'čeká na ověření',
    faces:[['Zabradli',[0,0,0, 3,0,0, 3,1,0, 0,1,0]]]};
  const world = {
    chunkIndex: x => x < 0 ? 0 : 1, heightAt: () => -3,
    deckAt: x => x === 0 ? 0.25 : -1e9,
    bridgeEdges: new Map([[0,[{id:'maketa',corners:[[0,0,2],[3,0,2],[3,0,0.8],[0,0,0.8]]}]]])
  };
  assert.deepEqual(railingSupport(panel,world),{samples:2,supported:1,decks:1,edges:1});
  const reports = new Map([['zkusebni',{categories:['pěší cesta']}]]);
  assert.match(reviewRailings([panel],reports,new Set(),world).reasons.get('zkusebni'),/herní trasy/);
  assert.deepEqual(reviewRailings([panel],reports,new Set(['zkusebni']),world).rows,[]);
});

test('řez u přístupu porovná výšku v místě sklonu a rozpozná chybějící městský konec', async () => {
  const {approachSection} = await import('../tools/bridge_approaches.mjs');
  const {structureSurface} = await import('../tools/build_structures.mjs');
  const triangles = structureSurface(floor(0,3,-2,10,4)).triangles.map(t=>t.tri);
  const cut = approachSection([0,2,0],[10,4,0],triangles);
  assert.ok(Math.abs(cut.lift-0.95) < 1e-6);
  assert.equal(cut.width,4);
  assert.equal(approachSection([-2,2,0],[8,4,0],triangles),null);
});
