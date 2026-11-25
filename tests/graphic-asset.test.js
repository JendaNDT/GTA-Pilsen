import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { graphicAsset } from '../src/world/graphic-asset.js';
import { loadColorLuts } from '../src/world/color-luts.js';
import { graphicsManifest } from '../tools/freeze_graphics.mjs';

test('manifest textur odpovídá vydání a nesoulad z podsložky se odmítne před dekódováním',async t => {
  assert.deepEqual(graphicsManifest(), JSON.parse(await readFile('public/graphics-manifest.json')));
  const path='luts/den.cube', bytes=await readFile('public/'+path);
  let content=bytes, status=200;
  t.mock.method(globalThis,'fetch',async url => {
    assert.equal(url,'/test/hra/'+path);
    return new Response(content,{status});
  });
  assert.equal(await (await graphicAsset(path,'/test/hra/')).text(),bytes.toString());
  content=Buffer.from(bytes);
  content[24]^=1;
  await assert.rejects(graphicAsset(path,'/test/hra/'),/neodpovídá/);
  status=404;
  await assert.rejects(graphicAsset(path,'/test/hra/'),/Nedostupný/);
});

test('poškozený blok leteckého snímku se nedekóduje a zdravý soused zůstane viditelný', async t => {
  const { Orthophoto } = await import('../src/world/orthophoto.js');
  const catalog = JSON.parse(await readFile('public/detail/orthophoto/index.json'));
  const [broken,other] = Object.keys(catalog.blocks).slice(0,2);
  const decoded = [];
  t.mock.method(globalThis,'fetch',async url => {
    const file = url.split('/').at(-1);
    const bytes = await readFile('public/detail/orthophoto/'+file);
    if (file === catalog.blocks[broken].file) bytes[bytes.length-1] ^= 1;
    return new Response(bytes);
  });
  const {bounds}=JSON.parse(await readFile('public/data/meta.json'));
  const ortho=new Orthophoto({chunk:256, origin:catalog.origin, cols:Math.ceil((bounds.maxX-catalog.origin[0])/256),
    rows:Math.ceil((bounds.maxZ-catalog.origin[1])/256),fingerprints:catalog.sources},2,{
      base:'/hra/detail/orthophoto/', decode:async blob=>{
        decoded.push(blob.size);
        return {width:512,height:512,close(){}};
      },
    });
  await ortho.load();
  assert.ok(ortho.blocks);
  ortho.prefetch([broken,other]);
  while (ortho.pending.size) await new Promise(resolve=>setImmediate(resolve));
  assert.ok(ortho.failed.has(broken));
  assert.equal(ortho.get(broken),null);
  assert.ok(ortho.get(other));
  assert.deepEqual(decoded,[catalog.blocks[other].bytes]);
});

test('výpadek seznamu měřených budov ponechá hratelné původní město, čtvrti a fyziku', async t => {
  const {loadAll} = await import('../src/data.js');
  const {Districts} = await import('../src/world/districts.js');
  t.mock.method(globalThis,'fetch',async url=>{
    if(url.endsWith('/detail/city/index.json')) return new Response(null,{status:404});
    return new Response(await readFile('public'+url));
  });
  const city=await loadAll(()=>{});
  assert.deepEqual(city.heritage,{districts:[],tiles:[]});
  assert.equal(city.streetDetails,undefined);
  assert.ok(city.buildings.header && city.terrain.header);
  assert.doesNotThrow(()=>new Districts(city.heritage.districts).at(0,0));
});

test('na barevné tabulky čeká start s jedním limitem a atlas se může načíst i později', async t => {
  const signals = new Map();
  t.mock.method(globalThis, 'fetch', async (url, { signal }) => {
    const path = url.slice('/hra/'.length);
    signals.set(path, signal);
    return new Response(await readFile('public/' + path));
  });
  const atlas = 'textures/facades/interiery.webp';
  await graphicAsset(atlas, '/hra/');
  assert.equal(signals.get(atlas), undefined);
  assert.equal((await loadColorLuts('/hra/')).length, 3);
  const startup = signals.get('luts/den.cube');
  assert.ok(startup instanceof AbortSignal);
  assert.equal(signals.get('luts/soumrak.cube'), startup);
  assert.equal(signals.get('luts/noc.cube'), startup);
});

test('poškozené volitelné vrstvy se přeskočí jednotlivě a chyba terénu pojmenuje soubor', async t => {
  const { loadAll } = await import('../src/data.js');
  const replacements = new Map();
  t.mock.method(globalThis, 'fetch', async url => new Response(
    replacements.has(url) ? replacements.get(url) : await readFile('public' + url)));
  const meta = JSON.parse(await readFile('public/data/meta.json'));
  const grades = JSON.parse(await readFile('public/data/grade-separations.json'));
  replacements.set('/data/sound-places.json', '{');
  replacements.set('/data/grade-separations.json', JSON.stringify({ ...grades, rails: [null] }));
  const city = await loadAll(() => {});
  assert.deepEqual(city.soundPlaces, []);
  assert.equal(city.gradeSeparations, undefined);
  assert.ok(city.treeTypes.trees.length && city.heritage.tiles.length);
  replacements.clear();
  replacements.set('/data/sound-places.json', JSON.stringify({ osm: meta.osmTimestamp, weirs: [null] }));
  assert.deepEqual((await loadAll(() => {})).soundPlaces, []);
  replacements.clear();
  const healthy = await loadAll(() => {});
  assert.ok(healthy.soundPlaces.length && healthy.buildingMaterials.surfaces.length);
  assert.ok(healthy.gradeSeparations.rails.length && healthy.structures.index);
  replacements.set('/data/terrain.bin', 'neplatný terén');
  await assert.rejects(loadAll(() => {}), /povinných dat data\/terrain\.bin/);
});
