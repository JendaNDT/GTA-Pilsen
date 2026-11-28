import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {};
globalThis.location = { search: '' };
globalThis.matchMedia = () => ({ matches: false });
const { VehicleManager } = await import('../src/entities/vehicles.js');

test('při volbě směru se řidič vyhne frontě ve svém pruhu, pokud má povolenou alternativu', () => {
  const moving = { mode: 'ai', edge: 2, lane: 2, s: 20, blocked: 0 };
  const lead = { ...moving, blocked: 5 };
  const behind = { ...lead, s: 12 };
  const manager = Object.assign(Object.create(VehicleManager.prototype), {
    world: { eFrom: [0, 1, 2, 3], eTo: [1, 2, 3, 4], eLen: [30, 30, 30, 30],
      eRoad: [0, 1, 2, 3], r: { name: [0, 1, 2, 3] } },
    cars: [lead, behind], _laneFor: () => 2,
    _movesFrom: () => [{ edge: 2, fits: true, wt: 1, cos: 1 }, { edge: 3, fits: true, wt: 1, cos: 1 }],
    _moveTo: (_e, _l, c) => c.edge,
  });
  assert.equal(manager._queueAhead(2, 2), true);
  assert.equal(manager._queueAhead(2, -2), false);
  assert.equal(manager._queueAhead(2, 2, 10), true);
  assert.equal(manager._queueAhead(2, 2, 16), false);
  assert.equal(manager._nextMove(1, 0, 2), 3);
  manager._movesFrom = () => [{ edge: 2, fits: true, wt: 1, cos: 1 }, { edge: 3, fits: false, wt: 1, cos: 1 }];
  assert.equal(manager._nextMove(1, 0, 2), 2);
  manager.cars = [lead, moving];
  assert.equal(manager._queueAhead(2, 2), false);
});

test('řidič vidí konec fronty na přímém pokračování ulice a rozlišuje její směr a vzdálenost', () => {
  const lead = { mode: 'ai', edge: 1, lane: 2, s: 9, blocked: 5 };
  const manager = Object.assign(Object.create(VehicleManager.prototype), {
    world: { eFrom: [0, 1, 1, 1, 4], eTo: [1, 2, 3, 0, 5], eLen: [27],
      eRoad: [0, 1, 2, 0, 1], r: { name: [3, 3, 3] } },
    _edgeTangent: edge => edge === 2 ? { tx: 1, tz: 0 } : { tx: 0, tz: 1 },
    cars: [{ ...lead, edge: 0 }, lead],
  });
  assert.equal(manager._queueAhead(0, 2), true);
  for (const edge of [2, 3, 4]) {
    lead.edge = edge;
    assert.equal(manager._queueAhead(0, 2), false);
  }
  Object.assign(lead, { edge: 1, s: 90 });
  assert.equal(manager._queueAhead(0, 2), false);
});

test('dodatečný provoz se zařazuje jen na hlavní tah, vedlejší ulice ho při nedostatku místa nepřebírá', () => {
  const world = { chunkIndex: () => 0, arterialEdges: [[1]], trafficEdges: [[0]],
    eLen: [80, 80], eRoad: [0, 1], r: { cls: [11, 4] } };
  const manager = Object.assign(Object.create(VehicleManager.prototype), {
    world, game: { trafficRhythm: { measuredByChunk: new Map([[0, [0]]]) } },
  });
  const edge = arterialOnly => manager._randomEdgeNear(0, 0, 110, 300, true, arterialOnly);
  assert.equal(edge(true), 1);
  assert.equal(edge(false), 0);
  world.arterialEdges[0] = [];
  assert.equal(edge(true), -1);
});
