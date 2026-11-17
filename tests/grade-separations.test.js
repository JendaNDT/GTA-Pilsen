import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('všech 110 křížení z auditu má oddělené jízdní povrchy', () => {
  const cwd = new URL('../', import.meta.url);
  const run = (...options) => JSON.parse(execFileSync(process.execPath,
    ['tools/audit_grade_separations.mjs', '--json', ...options], { cwd, maxBuffer: 4 * 1024 * 1024 }));
  const before = run('--baseline'), after = run();
  const key = ({ a, b, x, z }) => `${a}:${b}:${x}:${z}`;
  const byCrossing = new Map(after.crossings.map((c) => [key(c), c]));
  const findings = before.crossings.filter(({ a, b, delta }) => {
    const top = before.features[a], bottom = before.features[b];
    return top.drivable && bottom.drivable && (top.flags & 2) && !(bottom.flags & 4) && delta < 3;
  });
  assert.equal(findings.length, 110);
  assert.equal(after.summary.roadRoadOrRail, 409);
  for (const crossing of findings) {
    assert.ok(byCrossing.get(key(crossing))?.delta >= 3, `Křížení u ${crossing.x}, ${crossing.z}`);
  }
  assert.equal(after.summary.severeRoadRoadOrRail, 0);
});
