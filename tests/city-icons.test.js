import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BufferGeometry, BufferAttribute } from 'three/webgpu';
import { assetFingerprint, parsePack } from '../src/data.js';
import { Exterior, frame } from '../src/world/dominanty/mesh.js';
import { dressSurvey, sheets } from '../src/world/dominanty/survey.js';
import { measuredDetails } from '../src/world/dominanty/measured-details.js';
import { gateSite } from '../src/world/dominanty/gate-collision.js';
import { fountainRay } from '../src/world/fountain-site.js';
import { outerTiles, buildOuterSite } from '../src/world/dominanty/outer-sites.js';

const world = { heightAt: () => 0, baseElevation: 308 };
function valid(buf) {
  assert.ok(buf.points.length > 0 && buf.points.length % 9 === 0);
  assert.equal(buf.uv.length * 3, buf.points.length * 2);
  assert.equal(buf.cells.length, buf.uv.length);
  assert.ok([...buf.points, ...buf.uv, ...buf.cells].every(Number.isFinite));
}

for (const [tile, [hash, ranges]] of Object.entries(sheets)) {
  test('zaměřené dominanty zachovají všechny sousedy na listu ' + tile, async () => {
    const bytes = Uint8Array.from(await readFile(new URL('../public/detail/city/' + tile, import.meta.url))).buffer;
    assert.equal(assetFingerprint(bytes), hash);
    const pack = parsePack(bytes),
      geo = new BufferGeometry(),
      buf = new Exterior();
    const offset = [pack.header.cx, 0, pack.header.cz];
    geo.setAttribute(
      'position',
      new BufferAttribute(
        Float32Array.from(pack.p, (v, i) => offset[i % 3] + v * 0.02),
        3,
      ),
    );
    geo.setAttribute('normal', new BufferAttribute(pack.n, 3, true));
    geo.setIndex(new BufferAttribute(pack.i, 1));
    const old = geo.index,
      roof = pack.roof.slice();
    assert.equal(dressSurvey(buf, world, pack, geo, tile), false);
    assert.equal(geo.index, old);
    pack.fileHash = hash;
    assert.equal(dressSurvey(buf, world, pack, geo, tile), true);
    assert.equal(geo.index.count, old.count);
    assert.deepEqual(
      [...geo.index.array.slice(0, geo.drawRange.count)],
      [...pack.i].filter((_, i) => !ranges.some(([a, b]) => i >= a && i < b)),
    );
    assert.deepEqual(pack.roof, roof);
    measuredDetails(buf, world, tile);
    valid(buf);
  });
}

test('Jubilejní brána má dva průjezdy, prostřední pilíř a nad oblouky pevný překlad', () => {
  const w = { ...world, buildingAt: () => 7, bNames: new Map([[7, 'Historická brána Prazdroj']]) };
  assert.equal(gateSite({ ...w, bNames: new Map() }), null);
  const site = gateSite(w),
    p = frame(696.9, 81.8, 307.14 - w.baseElevation, Math.atan2(0.45, 0.89));
  const countNodes = (node) => 1 + node.subTrees.reduce((count, child) => count + countNodes(child), 0);
  assert.ok(countNodes(site.surfaces[0].tree) < 1000, 'kolize jediné brány zůstane malá i s ozdobami');
  for (const [u, y, clear] of [
    [-3, 1, true],
    [3, 1, true],
    [0, 1, false],
    [3, 10.6, false],
  ]) {
    const [x, h, z] = p(u, -4, y),
      [xx, , zz] = p(u, 4, y);
    assert.equal(fountainRay(site.surfaces, x, z, xx, zz, h) === 1, clear);
  }
});

test('čtyři okrajové areály obsadí skutečné půdorysy a mají konečnou geometrii', async () => {
  const pack = parsePack(
    Uint8Array.from(await readFile(new URL('../public/data/buildings.bin', import.meta.url))).buffer,
  );
  const w = {
    ...world,
    b: pack,
    bvx: [],
    bvz: [],
    bMinX: [],
    bMaxX: [],
    bMinZ: [],
    bMaxZ: [],
    bTop: [],
    bBase: [],
    bGround: [],
    chunkIndex: (x, z) => Math.floor(x / 256) * 1000 + Math.floor(z / 256),
  };
  for (const id of [
    9100, 9101, 9112, 9116, 9121, 3579, 96466, 29797, 29716, 29820, 29832, 29842, 29818, 29757, 38566,
  ]) {
    const xx = [],
      zz = [];
    for (let v = pack.ringStart[pack.bRing[id]]; v < pack.ringStart[pack.bRing[id] + 1]; v++) {
      xx.push((w.bvx[v] = (pack.ax[id] + pack.vdx[v]) * 0.1));
      zz.push((w.bvz[v] = (pack.az[id] + pack.vdz[v]) * 0.1));
    }
    w.bMinX[id] = Math.min(...xx);
    w.bMaxX[id] = Math.max(...xx);
    w.bMinZ[id] = Math.min(...zz);
    w.bMaxZ[id] = Math.max(...zz);
    w.bBase[id] = -0.4;
    w.bGround[id] = 0;
    w.bTop[id] = pack.hTop[id] * 0.1;
  }
  const seen = new Set();
  for (const records of outerTiles(w).values()) {
    const buf = new Exterior();
    buildOuterSite(buf, w, records);
    valid(buf);
    for (const { site, id } of records) {
      assert.ok(!seen.has(id));
      seen.add(id);
      assert.ok(site.name);
    }
  }
  assert.equal(seen.size, 15);
});
