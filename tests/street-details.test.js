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
