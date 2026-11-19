// Porovná vrcholy městských ploch s povrchem a vodními polygony používanými ve hře.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Box3, Vector3 } from 'three/webgpu';
import { parsePack } from '../src/data.js';
import { structureSurface } from './build_structures.mjs';

const kinds = new Set(['Ostatni', 'Nadrz', 'Jez']);

export function sampleWaterPart(part, world, water, weirs) {
  const box = new Box3(),
    vertices = new Map();
  for (const face of part.faces) {
    const surface = structureSurface(face);
    box.union(surface.box);
    for (const v of surface.vertices) vertices.set(v.toArray().join(','), v);
  }
  const center = box.getCenter(new Vector3());
  const samples = [center, ...vertices.values()];
  const wet = samples.filter((v) => water.some((i) => world.landContains(i, v.x, v.z))).length;
  const buildings = samples.filter((v) => world.buildingAt(v.x, v.z) >= 0).length;
  const offsets = [...vertices.values()].map((v) => v.y - world.heightAt(v.x, v.z));
  const nearest = Math.min(...weirs.map(([x, z]) => Math.hypot(center.x - x, center.z - z)));
  return {
    samples: samples.length,
    wet,
    buildings,
    min: Math.min(...offsets),
    max: Math.max(...offsets),
    nearest
  };
}

export async function reviewWaterParts(parts, reports, choices, mapDir, world) {
  const { LC } = await import('../src/config.js');
  const land = await readFile(path.join(mapDir, 'land.bin'));
  world.l = parsePack(land.buffer.slice(land.byteOffset, land.byteOffset + land.byteLength));
  const water = [];
  for (let i = 0; i < world.l.cls.length; i++) if (world.l.cls[i] === LC.WATER) water.push(i);
  const sounds = JSON.parse(await readFile(path.join(mapDir, 'sound-places.json'), 'utf8'));
  const weirs = sounds.osm === world.meta.osmTimestamp ? sounds.weirs : [];
  const rows = [],
    decisions = new Map();
  for (const part of parts) {
    if (part.status !== 'čeká na ověření' || !part.faces.some(([kind]) => kinds.has(kind))) continue;
    const choice = choices[part.id],
      routes = reports.get(part.id)?.categories;
    if (!choice?.reason || !routes) throw Error('Chybí posouzení vodního nebo ostatního dílu ' + part.id);
    const s = sampleWaterPart(part, world, water, weirs);
    if (
      choice.role &&
      (choice.role !== 'weir' ||
        !part.faces.every(([kind]) => kind === 'Jez') ||
        routes.length ||
        s.buildings ||
        !s.wet ||
        s.max <= 0 ||
        s.nearest > 20)
    ) {
      throw Error('Měřený jez nesouhlasí s mapou nebo s herní trasou ' + part.id);
    }
    decisions.set(part.id, choice);
    const layers = [...new Set(part.faces.map(([kind]) => kind))].join('/');
    rows.push([
      part.id,
      layers,
      s.samples,
      s.wet,
      s.buildings,
      s.min.toFixed(2),
      s.max.toFixed(2),
      Number.isFinite(s.nearest) ? Math.round(s.nearest) : '',
      routes.join(', '),
      choice.reason
    ]);
  }
  if (decisions.size !== Object.keys(choices).length) throw Error('Seznam posouzených dílů se liší od zdroje.');
  return { decisions, rows };
}
