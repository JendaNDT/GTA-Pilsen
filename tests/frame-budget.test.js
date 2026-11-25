import assert from 'node:assert/strict';
import test from 'node:test';
import { frameBudgets } from '../src/game/frame-budget.js';

test('rozpočet odliší překročení, chybějící a řídké časování GPU', () => {
  const summary = { physicsMs:{p95:3}, physicsSamples:320, logicMs:{p95:2.1}, logicSamples:320,
    renderMs:{p95:4}, renderSamples:320, gpuMs:{p95:9}, gpuSamples:20 };
  const results = frameBudgets(summary,10);
  assert.equal(results.physics.status,'splněno');
  assert.equal(results.logic.status,'překročeno');
  assert.equal(results.gpu.status,'neprůkazné');
  assert.equal(frameBudgets({},10).render.status,'neprůkazné');
  assert.equal(frameBudgets({...summary,gpuSamples:30},10).gpu.status,'splněno');
});
