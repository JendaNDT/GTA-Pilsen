import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parsePack, assetFingerprint } from '../src/data.js';
import { applyFronts, StreetDetails } from '../src/world/street-details.js';
import { faceCoordinates, faceHash, verifiedFronts } from '../tools/build_street_details.mjs';

test('průčelí vyžaduje správnou měřenou stěnu, polohu a výšku', () => {
  const ring = [0,290,0,4,290,0,4,294,0,0,294,0];
  const front = {building:'dům', edge:[[0,0],[4,0]], bottom:290, top:294, sha256:faceHash('dům',[ring])};
  const section = {id:'zkouska', citySha256:'model', fronts:[front]};
  const source = {sha256:'model', buildings:[['dům',[[1,ring]]]]};
  assert.deepEqual(verifiedFronts(section, source), [front]);
  assert.deepEqual(faceCoordinates(2,1,0,front,290), [2,1,4,4]);
  assert.equal(faceCoordinates(2,1,.1,front,290), null);
  assert.throws(() => verifiedFronts(section, {...source, sha256:'nový'}), /verze/);
  assert.throws(() => verifiedFronts(section, {...source, buildings:[]}), /přiřaď/);
  assert.throws(() => verifiedFronts({...section, fronts:[{...front, top:292}]},source), /výška/);
});

test('pilot mění jen přiřazené vrcholy, po změně otisku zůstane běžný dům', async t => {
  const root = new URL('../public/detail/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('streets/index.json',root)));
  const pilot = manifest.sections.find(s => s.id === 'americka');
  const layer = new StreetDetails(manifest);
  const request = t.mock.method(globalThis, 'fetch', async () => new Response(await readFile(new URL('streets/' + pilot.name, root))));
  assert.equal(await layer.forTile('mimo.bin', 'x', 3), null);
  assert.equal(request.mock.callCount(), 0);
  const name = pilot.tiles[0];
  const bytes = Uint8Array.from(await readFile(new URL('city/' + name,root))).buffer;
  const count = parsePack(bytes).p.length / 3;
  const hash = assetFingerprint(bytes);
  const [first, second] = await Promise.all([layer.forTile(name,hash,count),layer.forTile(name,hash,count)]);
  assert.deepEqual(first, second);
  assert.equal(request.mock.callCount(), 1);
  assert.ok(first.some((width,i) => i%4 === 2 && width > 0));
  assert.ok(first.some((width,i) => i%4 === 2 && width === 0));
  assert.equal(await layer.forTile(name,'cizí otisk',count),null);
  const pack = await layer.cache.get(pilot.id);
  assert.equal(applyFronts(pack,name,hash,1),null);
  const corrupt = new StreetDetails({...manifest,sections:[{...pilot,hash:'cizí soubor'}]});
  assert.equal(await corrupt.forTile(name,hash,count),null);
  assert.equal(corrupt.cache.size,0);
});

test('vstupy vybraných stěn odpovídají popisu a přenášejí se jen na označené vrcholy', async () => {
  const root = new URL('../public/detail/', import.meta.url);
  const index = JSON.parse(await readFile(new URL('streets/index.json', root)));
  for (const section of index.sections) {
    const desc = JSON.parse(await readFile(new URL('../tools/street-details/'+section.id+'.json', import.meta.url)));
    const expected = desc.fronts.flatMap(f => f.entrance === undefined ? [] : [Math.round(f.entrance*100)]);
    assert.ok(expected.length > 0);
    const pack = parsePack(Uint8Array.from(await readFile(new URL('streets/'+section.name,root))).buffer);
    const observed = new Set();
    for (const tile of pack.header.tiles) {
      const city = parsePack(Uint8Array.from(await readFile(new URL('city/'+tile.name,root))).buffer);
      const doors = new Float32Array(city.p.length/3);
      const fronts = applyFronts(pack,tile.name,tile.hash,doors.length,null,doors);
      doors.forEach((offset,i) => {
        if (offset === 0) return;
        assert.ok(offset >= .55 && offset <= fronts[4*i+2]-.55);
        observed.add(Math.round(offset*100));
      });
    }
    assert.deepEqual(observed,new Set(expected));
  }
});

test('práh všech 21 vstupů leží na chodníku před měřenou stěnou', async () => {
  const { loadStructureMap } = await import('../tools/audit_structures.mjs');
  const { world } = await loadStructureMap('public/data');
  const detail = new URL('../public/detail/', import.meta.url);
  const readPack = async path => parsePack(Uint8Array.from(await readFile(new URL(path, detail))).buffer);
  const manifest = JSON.parse(await readFile(new URL('streets/index.json', detail)));
  let doors = 0;
  for (const section of manifest.sections) {
    const desc = JSON.parse(await readFile(new URL('../tools/street-details/' + section.id + '.json', import.meta.url)));
    const pack = await readPack('streets/' + section.name);
    const fronts = desc.fronts.filter(front => front.entrance !== undefined);
    const seen = new Set();
    for (const tile of pack.header.tiles) {
      const city = await readPack('city/' + tile.name);
      for (let i = tile.start; i < tile.start + tile.count; i++) {
        if (!pack.entrance[i]) continue;
        const id = pack.vertex[i];
        const x = city.header.cx + city.p[id * 3] * .02;
        const y = city.p[id * 3 + 1] * .02;
        const z = city.header.cz + city.p[id * 3 + 2] * .02;
        const front = fronts.find(f => {
          const uv = faceCoordinates(x, y, z, f, world.baseElevation);
          return uv && Math.abs(f.entrance - pack.entrance[i]) < .001 &&
            Math.abs(uv[0] - pack.front[i * 4]) < .001 && Math.abs(uv[2] - pack.front[i * 4 + 2]) < .001;
        });
        assert.ok(front, section.name + ' – vrchol dveří leží mimo přiřazenou stěnu');
        const [[ax, az], [bx, bz]] = front.edge;
        const ratio = front.entrance / Math.hypot(bx - ax, bz - az);
        const ground = world.heightAt(ax + (bx - ax) * ratio, az + (bz - az) * ratio);
        const sill = y - pack.front[i * 4 + 1];
        assert.ok(Math.abs(sill - ground) < .04, section.id + ' – práh domu ' + front.building);
        seen.add(front);
      }
    }
    assert.equal(seen.size, fronts.length);
    doors += seen.size;
  }
  assert.equal(doors, 21);
});
