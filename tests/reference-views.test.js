import test from 'node:test';
import assert from 'node:assert/strict';
import {renderReferenceView} from '../tools/reference_views.mjs';

test('referenční pohled počká na postupující stavbu a ohlásí zastavenou přípravu', async t => {
  let now = 0, built = true;
  t.mock.method(performance, 'now', () => now);
  const chunks = {chunks:new Map(), pending:5, heritage:{fetching:0}, update() {
    now += 15_000;
    if (built && this.pending) { this.pending--; return 1; }
    return 0;
  }};
  const game = {chunks, player:{place() {}}, camera:{far:100}, env:{}};
  const previousWindow = globalThis.window;
  globalThis.window = {__game:game, __setClock() {}, __view() {}, __perf:{renderStats:() => 'hotovo'}};
  const view = {name:'Zkušební scéna', focus:[0,0], camera:[1,1,1], target:[0,0,0]};
  const page = {evaluate:(fn, value) => fn(value)};
  try {
    assert.equal(await renderReferenceView(page,view), 'hotovo');
    assert.ok(now > 45_000);
    built = false;
    const bitmap = {};
    chunks.orthophoto = {cache:new Map([['blok',bitmap]]), revision:1, requests:0};
    chunks.orthophotoPending = true;
    for (let i=0; i<5; i++) chunks.chunks.set(i,{tex:true,orthoTile:{key:'blok'},orthoBitmap:null});
    const update = chunks.update;
    chunks.update = function() {
      const result = update.call(this);
      const tile = [...this.chunks.values()].find(ch => !ch.orthoBitmap);
      if (tile) tile.orthoBitmap = bitmap;
      else this.orthophotoPending = false;
      return result;
    };
    assert.equal(await renderReferenceView(page,view), 'hotovo');
    chunks.pending = 2;
    await assert.rejects(renderReferenceView(page,view), /zbývá 2 kroků/);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
