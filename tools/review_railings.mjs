// Samostatné modely mohou být okrasnou částí mostu. Ověřuje se opora v herním světě a souběh s už vykresleným okrajem.
import { structureSurface } from './build_structures.mjs';

export function railingSupport(part, world) {
  const columns = new Map();
  let top = -Infinity;
  for (const face of part.faces) {
    for (const v of structureSurface(face).vertices) {
      const key = v.x + ',' + v.z,
        old = columns.get(key);
      if (!old || v.y < old.y) columns.set(key, v);
      top = Math.max(top, v.y);
    }
  }
  const vertices = [...columns.values()];
  const low = Math.min(...vertices.map((v) => v.y));
  // Vzorky spodní části neobsahují špičky ozdob ani horní hranu madla.
  const foot = vertices.filter((v) => v.y <= low + Math.min(0.45, (top - low) / 3));
  const near = new Set();
  let supported = 0,
    decks = 0;
  for (const v of foot) {
    const ground = world.heightAt(v.x, v.z),
      deck = world.deckAt(v.x, v.z, v.y + 0.5);
    if (deck > ground + 0.3) decks++;
    if (Math.abs(v.y - Math.max(ground, deck)) <= 0.5) supported++;
    const tiles = new Set();
    for (const dx of [-4, 0, 4]) for (const dz of [-4, 0, 4]) tiles.add(world.chunkIndex(v.x + dx, v.z + dz));
    for (const tile of tiles) {
      for (const edge of world.bridgeEdges.get(tile) ?? []) {
        const [a, b, c, d] = edge.corners;
        // Vzdálenost od všech stran je důležitá i u širokého kamenného okraje.
        for (const [p, q] of [
          [a, b],
          [b, c],
          [c, d],
          [d, a]
        ]) {
          const dx = q[0] - p[0],
            dz = q[2] - p[2],
            length = dx * dx + dz * dz;
          const t = length ? Math.max(0, Math.min(1, ((v.x - p[0]) * dx + (v.z - p[2]) * dz) / length)) : 0;
          if (
            Math.hypot(v.x - p[0] - dx * t, v.z - p[2] - dz * t) <= 1.5 &&
            Math.abs(v.y - p[1] - (q[1] - p[1]) * t) <= 1.2
          ) {
            near.add(edge.id);
            break;
          }
        }
      }
    }
  }
  return { samples: foot.length, supported, decks, edges: near.size };
}

export function reviewRailings(parts, reports, assigned, world) {
  const rows = [],
    reasons = new Map();
  for (const part of parts) {
    if (
      assigned.has(part.id) ||
      part.status !== 'čeká na ověření' ||
      !part.faces.every(([layer]) => layer === 'Zabradli')
    )
      continue;
    const routes = reports.get(part.id)?.categories;
    if (!routes) throw Error('Chybí kontrola tras pro zábradlí ' + part.id);
    const s = railingSupport(part, world);
    let reason;
    if (routes.length) reason = 'Měřené plochy zasahují do herní trasy. Posoudit s příslušnou mostovkou.';
    else if (s.edges)
      reason = 'V blízkosti je již herní ohrazení. Posoudit náhradu společně s navazující mostovkou.';
    else if (s.supported < s.samples)
      reason = 'Herní povrch nepodpírá celý spodek modelu. Prověřit napojení na konstrukci.';
    else reason = 'Ověřit souvislou oporu mezi vzorky a návaznost obou konců modelu.';
    rows.push([part.id, routes.join(', '), s.samples, s.supported, s.decks, s.edges, reason]);
    reasons.set(part.id, reason);
  }
  return { rows, reasons };
}
