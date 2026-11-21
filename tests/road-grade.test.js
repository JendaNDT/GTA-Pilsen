import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRoadGrades, corridorWeight, gradeBlend, gradeHeight, gradeSurface, pinProfile, profileAt, smoothProfile } from '../src/world/road-grade.js';

test('vyhlazení odstraní schody po 8 m a zachová rovnoměrné stoupání', () => {
  // svah 6 % se zuby terénu po 8 m (vzorky po 2 m)
  const raw = Array.from({ length: 200 }, (_, i) => 0.06 * 2 * i + (Math.floor(i / 4) % 2 ? 0.12 : -0.12));
  const smooth = smoothProfile(raw);
  let worst = 0;
  for (let i = 20; i < 180; i++) worst = Math.max(worst, Math.abs(smooth[i - 1] - 2 * smooth[i] + smooth[i + 1]));
  let rough = 0;
  for (let i = 20; i < 180; i++) rough = Math.max(rough, Math.abs(raw[i - 1] - 2 * raw[i] + raw[i + 1]));
  assert.ok(worst < rough / 10, `zlom sklonu ${worst} proti ${rough}`);
  // stoupání zůstane
  assert.ok(Math.abs((smooth[150] - smooth[50]) / 200 - 0.06) < 0.002);
  // přímka zůstane přímkou i na koncích
  const line = smoothProfile(Array.from({ length: 50 }, (_, i) => 3 + 0.1 * i));
  for (let i = 0; i < 50; i++) assert.ok(Math.abs(line[i] - (3 + 0.1 * i)) < 1e-9, `přímka u konce ${i}`);
});

test('ukotvení: profil v křižovatce trefí cílovou výšku a dál se oprava ztrácí', () => {
  const flat = new Float64Array(101).fill(10);
  const pinned = pinProfile(flat, 2, [[100, 10.4]]);
  assert.ok(Math.abs(profileAt(pinned, 0, 101, 100) - 10.4) < 1e-9);
  assert.equal(pinned[0], 10);                       // 100 m daleko už beze změny
  assert.ok(pinned[40] > 10 && pinned[40] < 10.4);  // plynulý přechod
  const two = pinProfile(flat, 2, [[20, 11], [180, 9]]);
  assert.ok(Math.abs(profileAt(two, 0, 101, 100) - 10) < 1e-9);   // mezi body lineárně
});

test('pás kolem silnice: plná váha na vozovce a krajnici, potom k nule', () => {
  assert.equal(corridorWeight(2, 3), 1);
  assert.equal(corridorWeight(3.5, 3), 1);
  assert.ok(corridorWeight(5, 3) > 0 && corridorWeight(5, 3) < 1);
  assert.equal(corridorWeight(20, 3), 0);
});

test('profily dvou navazujících silnic mají ve společném bodě stejnou výšku', () => {
  // silnice A z (0,0) do (100,0), silnice B z (100,0) do (100,100); terén se zuby
  const world = {
    rCount: 3,
    rOff: Int32Array.from([0, 2, 4, 6]),
    rpx: Float32Array.from([0, 100, 100, 100, 100, 160]),
    rpz: Float32Array.from([0, 0, 0, 100, 100, 100]),
    rpy: Float32Array.from([0, 0, 0, 0, 7.2, 7.2]),
  };
  const terrain = (x, z) => 0.02 * x + 0.05 * z + (Math.floor((x + z) / 8) % 2 ? 0.1 : -0.1);
  // silnice 2 je most (pevná výška 7,2 m) napojený na konec B
  const grades = buildRoadGrades(world, (road) => road < 2, (road) => road === 2, terrain);
  const endA = profileAt(grades.heights, grades.start[0], grades.count[0], 100);
  const startB = profileAt(grades.heights, grades.start[1], grades.count[1], 0);
  assert.ok(Math.abs(endA - startB) < 1e-6, `${endA} proti ${startB}`);
  // napojení na most 0,2 m nad terénem (terén tam má 7 m) se srovná na výšku mostovky
  const endB = profileAt(grades.heights, grades.start[1], grades.count[1], 100);
  assert.ok(Math.abs(endB - 7.2) < 1e-6, `${endB}`);
  assert.equal(grades.start[2], -1);
});

test('ručně doladěný terén zůstane v profilu beze změny', () => {
  const world = { rCount: 1, rOff: Int32Array.from([0, 2]), rpx: Float32Array.from([0, 200]), rpz: Float32Array.from([0, 0]), rpy: new Float32Array(2) };
  // podjezd: v úseku 90–110 m je terén o 2 m níž
  const terrain = (x) => (x >= 90 && x <= 110 ? -2 : 0);
  const keep = (x) => x >= 90 && x <= 110;
  const grades = buildRoadGrades(world, () => true, () => false, terrain, 2, keep);
  assert.ok(Math.abs(profileAt(grades.heights, 0, grades.count[0], 100) + 2) < 1e-6);
  const smoothOnly = buildRoadGrades(world, () => true, () => false, terrain);
  assert.ok(profileAt(smoothOnly.heights, 0, smoothOnly.count[0], 100) > -1.9, 'bez ochrany by se podjezd zploštil');
});

test('u konce mostu se profil nenapojuje a platí tam původní terén', () => {
  // silnice A končí u mostu (silnice 1) s mostovkou o 0,3 m výš než terén
  const world = {
    rCount: 2,
    rOff: Int32Array.from([0, 2, 4]),
    rpx: Float32Array.from([0, 100, 100, 140]),
    rpz: Float32Array.from([0, 0, 0, 0]),
    rpy: Float32Array.from([0, 0, 5.3, 5.3]),
  };
  const terrain = (x) => 0.05 * x;
  const nearEnd = (x, z) => Math.hypot(x - 100, z) < 15;
  const kept = buildRoadGrades(world, (road) => road === 0, (road) => road === 1, terrain, 2, nearEnd);
  // bez ochrany by se konec srovnal na mostovku
  const pinned = buildRoadGrades(world, (road) => road === 0, (road) => road === 1, terrain);
  assert.ok(Math.abs(profileAt(pinned.heights, 0, pinned.count[0], 100) - 5.3) < 1e-6);
  // s ochranou zůstane terén (5,0 m) a výška profilu tam není k dispozici
  assert.ok(Math.abs(profileAt(kept.heights, 0, kept.count[0], 100) - 5) < 1e-6);
  assert.ok(Number.isNaN(gradeHeight(kept, 0, 95)));
  assert.ok(Math.abs(gradeHeight(kept, 0, 50) - 2.5) < 1e-6);
  assert.ok(Number.isNaN(gradeHeight(kept, 1, 10)));
});

test('u volného konce a chráněného místa přechází profil plynule do terénu', () => {
  // A (0–100) navazuje na B (100–200); B končí volně, v A je chráněné místo kolem x = 20
  const world = {
    rCount: 2,
    rOff: Int32Array.from([0, 2, 4]),
    rpx: Float32Array.from([0, 100, 100, 200]),
    rpz: Float32Array.from([0, 0, 0, 0]),
    rpy: new Float32Array(4),
  };
  const terrain = (x) => (Math.floor(x / 8) % 2 ? 0.2 : 0);
  const keep = (x) => x < 20;
  const grades = buildRoadGrades(world, () => true, () => false, terrain, 2, keep);
  assert.equal(gradeBlend(grades, 0, 100), 1);            // křižovatka A–B: plně na profilu
  assert.equal(gradeBlend(grades, 1, 0), 1);
  assert.equal(gradeBlend(grades, 1, 100), 0);            // volný konec B: terén
  assert.ok(gradeBlend(grades, 1, 95) > 0 && gradeBlend(grades, 1, 95) < 1);
  assert.equal(gradeBlend(grades, 1, 50), 1);
  assert.ok(Number.isNaN(gradeHeight(grades, 0, 25)));   // 10 m za chráněným místem stále terén
  assert.ok(gradeBlend(grades, 0, 35) > 0 && gradeBlend(grades, 0, 35) < 1);
  assert.equal(gradeBlend(grades, 0, 45), 1);
  // povrch: na profilu jen s plnou vahou, v přechodu a v chráněném místě terén
  assert.equal(gradeSurface(grades, 1, 95, 3), 3);
  assert.equal(gradeSurface(grades, 0, 10, 3), 3);
  assert.equal(gradeSurface(grades, 1, 50, 3), gradeHeight(grades, 1, 50));
});
