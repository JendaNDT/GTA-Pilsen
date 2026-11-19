// Výšku městského konce porovnáváme s herním mostem a cestami, které mají vrchol na stejném místě.
import { Vector3 } from 'three/webgpu';
import { structureSurface } from './build_structures.mjs';
import { deckSection } from './survey_bridges.mjs';

export function approachSection(end, inside, faces) {
  const dx = inside[0] - end[0],
    dz = inside[2] - end[2];
  const length = Math.hypot(dx, dz);
  if (!length) return null;
  // Řez těsně uvnitř mostu má nenulovou plochu i na svislé hraně modelu.
  const t = Math.min(0.25 / length, 0.5);
  return (
    deckSection(
      faces,
      end[0] + t * dx,
      end[1] + t * (inside[1] - end[1]),
      end[2] + t * dz,
      dx / length,
      dz / length
    ) ?? null
  );
}

function roadVertex(w, i) {
  return [w.rpx[i], w.rpy[i], w.rpz[i]];
}
function railVertex(w, r, i) {
  const x = r.pts[2 * i],
    z = r.pts[2 * i + 1];
  return [x, r.y?.[i] ?? w.heightAt(x, z), z];
}

function attached(w, end, target, train) {
  const found = [];
  function consider(id, x, z, level) {
    if (Math.abs(x - end[0]) <= 0.2 && Math.hypot(x - end[0], z - end[2]) <= 0.2)
      found.push({ id, delta: level() - end[1] });
  }
  if (train) {
    for (const [id, rail] of w.rails.entries()) {
      if (id === target || rail.cls !== w.rails[target].cls) continue;
      for (let i = 0; i < rail.pts.length / 2; i++)
        consider(id, rail.pts[2 * i], rail.pts[2 * i + 1], () => railVertex(w, rail, i)[1]);
    }
  } else {
    for (let id = 0; id < w.rCount; id++) {
      if (id === target) continue;
      for (let i = w.rOff[id]; i < w.rOff[id + 1]; i++) consider(id, w.rpx[i], w.rpz[i], () => w.rpy[i]);
    }
  }
  return found.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || a.id - b.id);
}

export function bridgeApproaches(byId, choices, w) {
  const rows = [
    [
      'díl',
      'druh',
      'herní cesta',
      'konec',
      'městský řez nad herním profilem (m)',
      'navazující trasy do 0,2 m',
      'nejbližší návazná výška vůči profilu (m)'
    ]
  ];
  for (const choice of choices) {
    const train = choice.rail !== undefined,
      id = train ? choice.rail : choice.road;
    const faces = byId
      .get(choice.deck)
      .faces.filter(([kind]) => kind === 'Most')
      .flatMap((face) =>
        structureSurface(face)
          .triangles.map((item) => item.tri)
          .filter((tri) => Math.abs(tri.getNormal(new Vector3()).y) > 0.75)
      );
    const coord = train ? (i) => railVertex(w, w.rails[id], i) : (i) => roadVertex(w, w.rOff[id] + i);
    const last = train ? w.rails[id].pts.length / 2 - 1 : w.rOff[id + 1] - w.rOff[id] - 1;
    for (const [side, index, neighbor] of [
      ['začátek', 0, 1],
      ['konec', last, last - 1]
    ]) {
      const end = coord(index),
        cut = approachSection(end, coord(neighbor), faces);
      const routes = attached(w, end, id, train);
      rows.push([
        choice.deck,
        train ? 'koleje' : choice.type,
        id,
        side,
        cut?.lift.toFixed(3) ?? '',
        [...new Set(routes.map((r) => r.id))].join(', '),
        routes[0]?.delta.toFixed(3) ?? ''
      ]);
    }
  }
  return rows;
}
