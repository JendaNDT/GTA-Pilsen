// Vybere statické zdi a sloupy jednoho obvodu a prověří jejich skutečný kolizní obal.
import { Box3, Vector3 } from 'three/webgpu';
import { Districts } from '../src/world/districts.js';
import { structureSurface } from './build_structures.mjs';
import { audit } from './audit_structures.mjs';
import { districtMeshes } from './static_structures.mjs';

const roles = new Map([
  ['Zed_OpernaZed', 'wall'],
  ['ProtihlukovaStena', 'screen'],
  ['Pilir_Sloup', 'pillar']
]);

async function blockedMeshes(candidates, mapDir, bridges, railDecks) {
  const checks = [];
  for (const part of candidates)
    for (const tile of part.meshes) {
      for (const [index, shell] of tile.shells.entries()) {
        const faces = [];
        for (let i = 0; i < shell.length; i += 9) faces.push(['Obal', shell.slice(i, i + 9)]);
        checks.push({ id: part.id + '/' + tile.cx + '_' + tile.cz + '/' + index, faces, convex: true });
      }
    }
  if (!checks.length) return new Map();
  const { reports } = await audit(checks, mapDir, bridges, railDecks);
  const blocked = new Map();
  for (const report of reports)
    if (report.categories.length) {
      const id = report.id.split('/')[0];
      if (!blocked.has(id)) blocked.set(id, new Set());
      for (const kind of report.categories) blocked.get(id).add(kind);
    }
  return blocked;
}

export async function selectDistricts(parts, reports, grid, districts, enabled, excluded, mapDir, bridges, railDecks) {
  const boundaries = new Districts(districts);
  const candidates = [],
    reasons = new Map();
  for (const part of parts) {
    if (
      excluded.has(part.id) ||
      part.status !== 'čeká na ověření' ||
      !part.faces.every((face) => roles.has(face[0]))
    )
      continue;
    const surfaces = part.faces.map(structureSurface);
    const bounds = new Box3();
    for (const surface of surfaces) bounds.union(surface.box);
    const center = bounds.getCenter(new Vector3()),
      district = boundaries.at(center.x, center.z);
    if (!enabled.includes(district)) continue;
    const report = reports.get(part.id);
    if (!report) throw Error('Chybí kontrola dílu ' + part.id);
    if (report.categories.length) {
      reasons.set(part.id, 'Městské plochy zasahují do herní trasy: ' + report.categories.join(', ') + '.');
      continue;
    }
    if (part.faces.every((face) => face[0] === 'Pilir_Sloup') && report.levels.length) {
      const base = report.levels.reduce((low, next) => (next.min < low.min ? next : low));
      if (base.min - base.terrain > 0.5) {
        reasons.set(part.id, 'Pata sloupu je v herním modelu nad terénem. Prověřit navazující konstrukci.');
        continue;
      }
    }
    const meshes = districtMeshes(surfaces, grid);
    if (!meshes.length || meshes.some((m) => !m.shells.length)) {
      reasons.set(part.id, 'Po oříznutí chybí kolizní objem.');
      continue;
    }
    candidates.push({ id: part.id, role: roles.get(part.faces[0][0]), district, meshes, surfaces });
  }
  const blocked = await blockedMeshes(candidates, mapDir, bridges, railDecks);
  const refined = candidates.filter((p) => blocked.has(p.id));
  for (const part of refined) {
    part.meshes = districtMeshes(part.surfaces, grid, true);
    if (!part.meshes.length || part.meshes.some((tile) => !tile.shells.length))
      reasons.set(part.id, 'Po zpřesnění chybí kolizní objem.');
  }
  const stillBlocked = await blockedMeshes(refined, mapDir, bridges, railDecks);
  for (const [id, kinds] of stillBlocked)
    reasons.set(id, 'Také těsný kolizní obal zasahuje do herní trasy: ' + [...kinds].sort().join(', ') + '.');
  return { accepted: candidates.filter((p) => !reasons.has(p.id)), reasons };
}
