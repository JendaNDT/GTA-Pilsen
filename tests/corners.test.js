import assert from 'node:assert/strict';
import test from 'node:test';
import { armCut, cornerClear, cornerFillet, cornerOverlap, cornerPolygon, cornerRadius, findCorners, insidePolygon, shrinkPolygon } from '../src/world/corners.js';
import { stationPath } from '../src/world/sidewalks.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('pravoúhlý roh: oblouk se dotýká okrajů obou vozovek', () => {
  // rameno a na východ, rameno b na „sever“ (+z), obě vozovky 6 m široké
  const a = { dx: 1, dz: 0, hw: 3, room: 40 }, b = { dx: 0, dz: 1, hw: 3, room: 40 };
  const f = cornerFillet(0, 0, a, b, 6);
  assert.ok(close(f.apex[0], 3) && close(f.apex[1], 3));
  assert.ok(close(f.ta[0], 9) && close(f.ta[1], 3));
  assert.ok(close(f.tb[0], 3) && close(f.tb[1], 9));
  assert.ok(close(f.center[0], 9) && close(f.center[1], 9));
  for (const [x, z] of f.arc) assert.ok(close(Math.hypot(x - 9, z - 9), 6, 1e-6));
  assert.ok(close(f.sa, 9) && close(f.sb, 9));
  // plocha asfaltu: roh zůstane uvnitř, střed oblouku a vozovky venku
  const polygon = shrinkPolygon(cornerPolygon(f), 0.05);
  assert.ok(insidePolygon(polygon, 3.5, 3.5));
  assert.equal(insidePolygon(polygon, 9, 9), false);
  assert.equal(insidePolygon(polygon, 5, 0), false);
});

test('oblouk se zmenší, aby se vešel na krátké rameno; ostré a rovné úhly se nezaoblují', () => {
  const a = { dx: 1, dz: 0, hw: 3, room: 6 }, b = { dx: 0, dz: 1, hw: 3, room: 40 };
  const f = cornerFillet(0, 0, a, b, 8);
  assert.ok(f.radius < 8 && f.sa <= 6 + 1e-9);
  const straight = cornerFillet(0, 0, { dx: 1, dz: 0, hw: 3, room: 40 }, { dx: -1, dz: 0.05, hw: 3, room: 40 }, 6);
  assert.equal(straight, null);
  const sharp = cornerFillet(0, 0, { dx: 1, dz: 0, hw: 3, room: 40 }, { dx: Math.cos(0.3), dz: Math.sin(0.3), hw: 3, room: 40 }, 6);
  assert.equal(sharp, null);
  assert.ok(cornerRadius(3, 3) > cornerRadius(2, 2));
  assert.equal(cornerRadius(10, 10), 12);
});

test('krátké mapové úseky u křižovatky se pro oblouk sloučí', () => {
  // silnice 0 do křižovatky přes úseky 2 m, 2 m a 30 m; silnice 1 kolmo
  const world = {
    rCount: 2,
    rOff: Int32Array.from([0, 4, 6]),
    rpx: Float32Array.from([0, 2, 4, 34, 0, 0]),
    rpz: Float32Array.from([0, 0, 0, 0, 0, 40]),
    r: { w: Float32Array.from([6, 6]) },
  };
  const corners = findCorners(world, () => true);
  const [corner] = corners.filter((c) => close(c.node[0], 0) && close(c.node[1], 0));
  assert.ok(corner && close(corner.radius, cornerRadius(3, 3)));
});

test('rohy v síti: křižovatka má čtyři, rovné pokračování žádný, ohyb jeden vnitřní', () => {
  // kříž: silnice 0 z (−50,0) do (50,0) a silnice 1 z (0,−50) do (0,50); ohyb: silnice 2 do pravého úhlu
  const world = {
    rCount: 4,
    rOff: Int32Array.from([0, 3, 6, 9, 11]),
    rpx: Float32Array.from([-50, 0, 50, 0, 0, 0, 200, 250, 250, 300, 350]),
    rpz: Float32Array.from([0, 0, 0, -50, 0, 50, 0, 0, 50, 200, 200]),
    r: { w: Float32Array.from([6, 6, 6, 6]) },
  };
  const corners = findCorners(world, () => true);
  const at = (x, z) => corners.filter((c) => close(c.node[0], x) && close(c.node[1], z));
  assert.equal(at(0, 0).length, 4);
  assert.equal(at(250, 0).length, 1);              // ohyb silnice 2: jen vnitřní strana
  assert.equal(at(300, 200).length, 0);            // konec silnice
  // ohyb: oblouk leží uvnitř pravého úhlu (směrem k bodu (200, 50))
  const [bend] = at(250, 0);
  assert.ok(bend.center[0] < 250 && bend.center[1] > 0);
});

test('dům v rohu oblouk zmenší', () => {
  const a = { dx: 1, dz: 0, hw: 3, room: 40 }, b = { dx: 0, dz: 1, hw: 3, room: 40 };
  const f = cornerFillet(0, 0, a, b, 10);
  // stěna těsně za rohem vozovek přetne velký oblouk
  const walls = (x0, z0, x1, z1, visit) => visit(4, 6, 6, 4);
  assert.equal(cornerClear(f, walls), false);
  const world = {
    rCount: 2, rOff: Int32Array.from([0, 2, 4]),
    rpx: Float32Array.from([0, 60, 0, 0]), rpz: Float32Array.from([0, 0, 0, 60]),
    r: { w: Float32Array.from([6, 6]) },
  };
  const [corner] = findCorners(world, () => true, walls);
  assert.ok(corner && corner.radius < cornerRadius(3, 3));
  assert.ok(cornerClear(corner, walls));
});

test('chodník končí přesně v bodě dotyku oblouku', () => {
  const world = { rpx: Float32Array.from([0, 100]), rpz: Float32Array.from([0, 0]) };
  // rameno ve směru silnice, roh vlevo: řez na 0,09 úseku a na levé straně
  assert.deepEqual(armCut(world, { segs: [0], dir: 1 }, 9, 1), { k: 0, t: 0.09, side: 1 });
  // rameno proti směru silnice (uzel na konci úseku)
  const cut = armCut(world, { segs: [0], dir: -1 }, 9, 1);
  assert.ok(close(cut.t, 0.91) && cut.side === -1);
  // rameno přes víc krátkých úseků
  const short = { rpx: Float32Array.from([0, 2, 4, 30]), rpz: new Float32Array(4) };
  assert.deepEqual(armCut(short, { segs: [0, 1, 2], dir: 1 }, 9, -1), { k: 2, t: 5 / 26, side: -1 });
  const path = stationPath(world.rpx, world.rpz, 0, 1, 0, 1, 8, [{ k: 0, t: 0.09 }]);
  assert.ok(path.x.some((x) => close(x, 9, 1e-4)));
});

test('oblouk se zmenší, když by zasáhl vozovku třetí silnice (ostrůvek)', () => {
  const world = {
    rCount: 2, rOff: Int32Array.from([0, 2, 4]),
    rpx: Float32Array.from([0, 60, 0, 0]), rpz: Float32Array.from([0, 0, 0, 60]),
    r: { w: Float32Array.from([6, 6]) },
  };
  // třetí silnice vede šikmo přes roh ve vzdálenosti ~8 m od středu křižovatky
  const third = (x, z) => Math.abs(x + z - 13) < 2;
  const [corner] = findCorners(world, () => true, null, null, (x, z) => third(x, z));
  assert.ok(!corner || (corner.radius < cornerRadius(3, 3) && ![corner.center, ...corner.arc].some(([x, z]) => third(x, z))));
});

test('vykreslený asfalt oblouku zasahuje o kus pod obě vozovky', () => {
  const a = { dx: 1, dz: 0, hw: 3, room: 40 }, b = { dx: 0, dz: 1, hw: 3, room: 40 };
  const f = cornerFillet(0, 0, a, b, 6);
  const drawn = cornerOverlap(f, 0.3);
  // roh a body dotyku leží 0,3 m uvnitř vozovek, oblouk zůstává
  const [apex, ta] = drawn, tb = drawn.at(-1);
  assert.ok(close(apex[0], 2.7) && close(apex[1], 2.7) && apex[2] === true);
  assert.ok(close(ta[0], 9) && close(ta[1], 2.7) && ta[2] === true);
  assert.ok(close(tb[0], 2.7) && close(tb[1], 9) && tb[2] === true);
  assert.equal(drawn.length, f.arc.length + 3);
  assert.ok(drawn.slice(2, -1).every(([x, z, under], i) => close(x, f.arc[i][0]) && close(z, f.arc[i][1]) && under === false));
  // celý původní oblouk je uvnitř vykreslené plochy
  const outline = drawn.map(([x, z]) => [x, z]);
  assert.ok(insidePolygon(outline, 3.2, 3.2) && insidePolygon(outline, 2.85, 5));
});
