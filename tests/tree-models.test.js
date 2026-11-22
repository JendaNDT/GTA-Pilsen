import test from 'node:test';
import assert from 'node:assert/strict';
import { treeType, treeSeason, treeModel } from '../src/world/tree-models.js';
import { readFileSync } from 'node:fs';

test('olistění z OSM má přednost a chybějící druh odpovídá ploše', () => {
  assert.equal(treeType(1, 'forest', 0), 0);
  assert.equal(treeType(2, 'garden', 0), 1);
  assert.equal(treeType(undefined, 'garden', 0.8), 3);
  assert.equal(treeType(undefined, 'scrub', 0.8), 2);
  assert.equal(treeType(undefined, 'forest', 0.1), 1);
  assert.equal(treeType(undefined, 'forest', 0.9), 0);
  const map = JSON.parse(readFileSync(new URL('../public/data/tree-types.json', import.meta.url)));
  assert.ok(map.trees.length > 6000 && map.land.length > 50);
});
test('čtyři období se mění podle kalendáře a opadavé modely zachovávají větve', () => {
  for (const [month, expected] of [
    [1, 3],
    [3, 0],
    [7, 1],
    [10, 2],
    [12, 3]
  ]) {
    assert.equal(treeSeason(Date.UTC(2026, month - 1, 15) / 86400000), expected);
  }
  for (let type = 0; type < 4; type++) {
    const model = treeModel(type),
      leaf = model.attributes.foliage;
    assert.ok(leaf.count > 0 && leaf.count / 3 <= 230);
    const woody = Array.from(leaf.array).filter((x) => !x).length;
    assert.ok(woody > 0 && woody < leaf.count);
    assert.equal(leaf.count, model.attributes.position.count);
    model.dispose();
  }
});
test('koruny mají oblé normály mířící od středu, kmen zůstává beze změny', () => {
  const model = treeModel(0);
  const { position, normal, foliage } = model.attributes;
  let outward = 0, leaves = 0;
  for (let k = 0; k < position.count; k++) {
    if (!foliage.getX(k)) continue;
    leaves++;
    const length = Math.hypot(normal.getX(k), normal.getY(k), normal.getZ(k));
    assert.ok(Math.abs(length - 1) < 1e-4, 'normála má jednotkovou délku');
    // listy leží nad kmenem, normála od středu koruny míří ven z modelu
    const outwardDot = normal.getX(k) * position.getX(k) + normal.getY(k) * (position.getY(k) - 5) + normal.getZ(k) * position.getZ(k);
    if (outwardDot > 0) outward++;
  }
  assert.ok(outward / leaves > 0.8, 'většina normál koruny míří ven');
  // sousední plochy sdílejí vrchol se stejnou normálou → stínování bez hran
  const byPoint = new Map();
  let shared = 0, smooth = 0;
  for (let k = 0; k < position.count; k++) {
    if (!foliage.getX(k)) continue;
    const key = [position.getX(k), position.getY(k), position.getZ(k)].map((v) => v.toFixed(4)).join();
    const n = [normal.getX(k), normal.getY(k), normal.getZ(k)];
    if (byPoint.has(key)) {
      shared++;
      const m = byPoint.get(key);
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 0.9) smooth++;
    } else byPoint.set(key, n);
  }
  assert.ok(shared > 0 && smooth / shared > 0.9, 'sdílené vrcholy mají téměř stejnou normálu');
  model.dispose();
});
