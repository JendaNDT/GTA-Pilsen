import assert from 'node:assert/strict';
import test from 'node:test';
import { EDGE_MARGIN, edgeBound, limitRoadEdges } from '../src/world/road-edge-terrain.js';

// Umělá dlaždice: rovná silnice podél osy z (střed x = 1, polovina šířky 3 m, asfalt 5 cm nad
// terénem pod ní), vedle ní na obou stranách svah stoupající o 50 % od okraje vozovky.
const G = 4, N = 8, n1 = N + 1, X0 = -16, ROAD_X = 1, HW = 3, SURF = 0.05;
function tile() {
  const y = new Float64Array(n1 * n1), edge = new Float64Array(n1 * n1), asphalt = new Float64Array(n1 * n1).fill(NaN);
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
    const k = j * n1 + i, x = X0 + i * G, e = Math.abs(x - ROAD_X) - HW;
    edge[k] = Math.abs(e) > 3 * G ? NaN : e;
    y[k] = e > 0 ? 0.5 * e : 0;
    if (e < 0) asphalt[k] = SURF;
  }
  return { y, edge, asphalt };
}

/** Výška sítě v bodě (x, z) se stejnými trojúhelníky jako buildTerrain (úhlopříčka 10–01). */
function meshHeight(y, x, z) {
  const fx = (x - X0) / G, fz = z / G, i = Math.min(N - 1, Math.floor(fx)), j = Math.min(N - 1, Math.floor(fz));
  const u = fx - i, v = fz - j;
  const h = (di, dj) => y[(j + dj) * n1 + i + di];
  return u + v <= 1 ? h(0, 0) + (h(1, 0) - h(0, 0)) * u + (h(0, 1) - h(0, 0)) * v
    : h(1, 1) + (h(0, 1) - h(1, 1)) * (1 - u) + (h(1, 0) - h(1, 1)) * (1 - v);
}

/** Nejvyšší převýšení terénu nad asfaltem v pásu 0,3 m uvnitř okraje vozovky (vnitřek dlaždice). */
function worstPoke(y) {
  let worst = -Infinity;
  for (let z = G + 0.5; z < (N - 1) * G; z += 0.5) {
    for (const x of [ROAD_X - HW + 0.01, ROAD_X - HW + 0.3, ROAD_X + HW - 0.01, ROAD_X + HW - 0.3]) {
      worst = Math.max(worst, meshHeight(y, x, z) - SURF);
    }
  }
  return worst;
}

test('mez vnějšího uzlu drží terén na okraji vozovky pod asfaltem', () => {
  // uzel Q 1 m uvnitř, uzel P 3 m za okrajem: okraj leží ve čtvrtině úsečky
  const bound = edgeBound(0, SURF, -1, 3);
  assert.ok(Math.abs(0 + (bound - 0) * 0.25 - (SURF - EDGE_MARGIN)) < 1e-12);
  assert.equal(edgeBound(0, SURF, 1, 3), Infinity);      // obě mimo vozovku
  assert.equal(edgeBound(0, SURF, -1, -0.5), Infinity);  // obě na vozovce
  // čím blíž je Q k okraji, tím výš smí P zůstat
  assert.ok(edgeBound(0, SURF, -0.2, 3) > edgeBound(0, SURF, -2, 3));
});

test('svah u silnice už neprorůstá asfaltem a vzdálený terén zůstane beze změny', () => {
  const { y, edge, asphalt } = tile();
  const before = Float64Array.from(y);
  assert.ok(worstPoke(before) > 0.1, 'bez úpravy terén u okraje vystoupí nad asfalt');
  const lowered = limitRoadEdges(n1, y, edge, asphalt);
  assert.ok(lowered > 0);
  assert.ok(worstPoke(y) <= -EDGE_MARGIN + 1e-9, `terén u okraje ${worstPoke(y)} m nad asfaltem`);
  for (let j = 0; j < n1; j++) for (let i = 0; i < n1; i++) {
    const k = j * n1 + i;
    assert.ok(y[k] <= before[k], 'terén se jen snižuje');
    if (edge[k] < 0) assert.equal(y[k], before[k], 'terén pod vozovkou se nemění');
    if (i === 0 || j === 0 || i === N || j === N) assert.equal(y[k], before[k], 'okraj dlaždice navazuje na sousedy');
  }
  // uzel o dvě rozteče za okrajem (nesousedí s vozovkou) zůstane ve své výšce
  const far = 4 * n1 + 1;                 // x = -12, 10 m za okrajem
  assert.equal(y[far], before[far]);
});

test('rovný terén u silnice se nemění', () => {
  const { y, edge, asphalt } = tile();
  y.fill(0);
  assert.equal(limitRoadEdges(n1, y, edge, asphalt), 0);
});
