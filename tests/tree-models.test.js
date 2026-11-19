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
