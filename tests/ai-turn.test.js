import assert from 'node:assert/strict';
import test from 'node:test';
import { pathClearance } from '../src/game/ai-turn.js';

test('Řidič před zatáčkou brzdí před autem ve výjezdovém pruhu', () => {
  const path = [{ x: 0, z: 4 }, { x: 3, z: 7 }, { x: 7, z: 7 }, { x: 11, z: 7 }];
  const parked = { x: 7, z: 7, yaw: Math.PI / 2, halfLen: 2, radius: 0.9 };
  const gap = pathClearance(0, 0, 0, 2, 0.9, parked, path);
  assert.ok(Math.abs(gap - (4 + Math.hypot(3, 3))) < 0.001);
  // Stojící auto v přímém prodloužení příjezdu po odbočení nepřekáží.
  assert.equal(pathClearance(0, 0, 0, 2, 0.9, { ...parked, x: 0, z: 14 }, path), Infinity);
});

test('Dodávka na Americké může zatočit podél zaparkovaného auta mimo jízdní pruh', () => {
  const path = [
    [-157.84, 446.84], [-153.95, 447.78], [-150.04, 447.50], [-147.22, 444.78],
    [-146.49, 440.87], [-146.14, 436.89], [-145.79, 432.90],
  ].map(([x, z]) => ({ x, z }));
  const parked = { x: -155.9, z: 450.5, yaw: 1.333, halfLen: 2.175, radius: 1.042 };
  const gap = pathClearance(-161.7, 445.8, 1.316, 2.65, 1, parked, path);
  assert.equal(gap, Infinity);
  const inLane = pathClearance(-161.7, 445.8, 1.316, 2.65, 1, { ...parked, z: 447.1 }, path);
  assert.ok(inLane > 0 && inLane < 2);
});

test('v zaobleném rohu odbočuje auto vpravo po oblouku soustředném s obrubníkem', async () => {
  const { laneTurn } = await import('../src/game/ai-turn.js');
  // hrana 0 na východ do křižovatky (0, 0), hrana 1 z ní na jih; obě silnice 6 m široké
  const edges = [{ x: -50, z: 0, tx: 1, tz: 0 }, { x: 0, z: 0, tx: 0, tz: 1 }];
  const corner = { node: [0, 0], radius: 7.8, center: [-10.8, 10.8], a: { dx: -1, dz: 0 }, b: { dx: 0, dz: 1 } };
  const world = {
    eLen: [50, 50], eRoad: [0, 1], r: { w: [6, 6] },
    edgePoint(e, d, side, out) {
      const { x, z, tx, tz } = edges[e];
      return Object.assign(out, { x: x + tx * d - tz * side, z: z + tz * d + tx * side, tx, tz });
    },
    cornerBetween: (x, z, ax, az, bx, bz) => (ax === -1 && bz === 1 ? corner : null),
  };
  const car = { edge: 0, next: 1, lane: 1.5, nextLane: 1.5, type: { len: 4.5, wid: 1.8 } };
  const wide = laneTurn(world, car);
  assert.ok(Math.abs(wide.radius - 9.3) < 1e-6, `${wide.radius}`);
  assert.ok(Math.hypot(wide.cx + 10.8, wide.cz - 10.8) < 1e-6);
  assert.equal(wide.entryLane, 1.5);
  assert.equal(wide.exitLane, 1.5);
  // bez rohu zatáčí ostřeji a do zatáčky si najíždí blíž ke středu silnice
  const sharp = laneTurn({ ...world, cornerBetween: () => null }, car);
  assert.ok(sharp.radius < 6 && sharp.radius < wide.radius);
  // roh těsně u dráhy (malý poloměr ulice, velký oblouk dráhy by na obrubník najel): zůstane ostré zatočení
  const tight = laneTurn({ ...world, cornerBetween: () => ({ ...corner, center: [-6, 6] }) }, car);
  assert.ok(tight.radius < 6);
  // vnitřní bok by cestou opustil asfalt (silnice se před rohem stáčí): zůstane ostré zatočení
  const ground = { heightAt: () => 0 };
  const paved = laneTurn({ ...world, ...ground, onCarriageway: () => true }, car);
  assert.ok(Math.abs(paved.radius - 9.3) < 1e-6);
  const gap = laneTurn({ ...world, ...ground, onCarriageway: (x, z) => Math.hypot(x + 5.07, z - 5.07) > 0.8 }, car);
  assert.ok(gap.radius < 6);
  // rameno rohu měřené dál od křižovatky míří jinam než silnice u ní (silnice se stáčí)
  const bent = laneTurn({ ...world, cornerBetween: () => ({ ...corner, a: { dx: -0.98, dz: 0.2 } }) }, car);
  assert.ok(bent.radius < 6);
});
