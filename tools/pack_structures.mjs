// Zabalí prověřené objekty. Jízdní povrch dál určuje herní profil silnice.
import fs from 'node:fs';
import path from 'node:path';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { Vector3 } from 'three/webgpu';
import { calibrateBridge } from './calibrate_bridge.mjs';
import { assetFingerprint, parsePack } from '../src/data.js';
import { structureSurface } from './build_structures.mjs';
import { writePack } from './write_pack.mjs';

const [dir = 'data-raw/structures', output = 'data-raw/kandidat/detail/structures'] = process.argv.slice(2);
const json = file => JSON.parse(fs.readFileSync(file));
const {parts, source} = json(path.join(dir, 'dily.json'));
const {sources, reports} = json(path.join(dir, 'kontroly.json'));
const {parts: overrides, bridges: choices} = json('tools/structure-overrides.json');
const meta = json('public/data/meta.json');
const tiles = new Map(), chunk = 256;
const minX = Math.floor(meta.bounds.minX / chunk) * chunk, minZ = Math.floor(meta.bounds.minZ / chunk) * chunk;
const reportsById = new Map(reports.map(report => [report.id, report]));
const accepted = new Set();
for (const part of parts) {
  const choice = overrides[part.id];
  if (!choice) continue;
  const report = reportsById.get(part.id);
  if (part.status !== 'čeká na ověření' || !report || report.categories.length || !choice.reason) {
    throw Error('Díl nemá uzavřenou kontrolu ' + part.id);
  }
  const faces = part.faces.map(structureSurface);
  const detail = [], vertices = new Map();
  for (const f of faces) for (const {tri} of f.triangles) for (const v of [tri.a,tri.b,tri.c]) {
    const coords = v.toArray();
    detail.push(...coords);
    vertices.set(coords.join(','), v);
  }
  if (vertices.size < 4) throw Error('Chybí uzavřený objem ' + part.id);
  const hull = new ConvexGeometry([...vertices.values()]);
  const core = [...hull.attributes.position.array];
  hull.computeBoundingBox();
  const center = hull.boundingBox.getCenter(new Vector3());
  const cx = Math.floor((center.x - minX) / chunk), cz = Math.floor((center.z - minZ) / chunk);
  const key = cx + '_' + cz;
  if (!tiles.has(key)) tiles.set(key, {cx, cz, parts: []});
  tiles.get(key).parts.push({id: part.id, role: choice.role, core, detail});
  hull.dispose();
  accepted.add(part.id);
}
if (accepted.size !== Object.keys(overrides).length) throw Error('Identita některého z vybraných dílů se změnila.');
fs.mkdirSync(output, {recursive: true});
const all = [], entries = [];
for (const [key, tile] of tiles) {
  const detail = [];
  const objects = tile.parts.map(part => {
    const start = all.length / 3, dStart = detail.length / 3;
    for (const value of part.core) all.push(value);
    for (const value of part.detail) detail.push(value);
    return {id:part.id, role:part.role, start, count:part.core.length / 3, dStart, dCount:part.detail.length / 3};
  });
  const name = key + '.bin', file = path.join(output, name);
  writePack(file, {version:1}, {p:['f4',Float32Array.from(detail)]});
  entries.push({cx: tile.cx, cz: tile.cz, file: name, hash: assetFingerprint(fs.readFileSync(file)), objects});
}
const file = path.join(output,'core.bin');
writePack(file,{version:1},{p:['f4',Float32Array.from(all)]});
const bytes = fs.readFileSync(file);
if (bytes.length > 2 * 1024 * 1024) throw Error('Základní balík přesahuje 2 MiB.');
const roadBytes = fs.readFileSync('public/data/roads.bin');
if (assetFingerprint(roadBytes) !== sources.roads) throw Error('Kalibrace a inventura používají různé silnice.');
const roads = parsePack(roadBytes.buffer.slice(roadBytes.byteOffset, roadBytes.byteOffset + roadBytes.byteLength));
const byId = new Map(parts.map(part => [part.id, part]));
const calibrationReasons = new Map();
const bridges = choices.map(choice => {
  for (const id of choice.rails) {
    if (reportsById.get(id)?.categories.length !== 0) throw Error('Nevyřešený průnik pěšího okraje ' + id);
  }
  for (const id of [choice.deck, ...choice.rails]) calibrationReasons.set(id, choice.reason);
  return calibrateBridge(choice, byId, roads);
});
const index = {version:1, bridges, source, sources, hash:assetFingerprint(bytes), tiles:entries};
fs.writeFileSync(path.join(output,'index.json'), JSON.stringify(index) + '\n');
const rows = [['díl', 'zdrojové ID', 'ploch v SHP', 'unikátních ploch', 'stav', 'důvod']];
for (const part of parts) {
  const chosen = accepted.has(part.id) || calibrationReasons.has(part.id);
  rows.push([part.id, part.uid, part.records, part.faces.length,
    chosen ? 'začleněn' : part.status, calibrationReasons.get(part.id) ?? overrides[part.id]?.reason ?? part.reason]);
}
fs.writeFileSync(path.join(dir, 'inventura.tsv'), rows.map(row => row.join('\t')).join('\n') + '\n');
console.log(accepted.size + ' objektů, ' + bytes.length + ' bajtů v základní vrstvě.');
