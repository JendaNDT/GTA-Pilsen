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
