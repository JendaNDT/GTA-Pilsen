// Zabalí prověřené objekty. Jízdní povrch dál určuje herní profil silnice.
import fs from 'node:fs';
import path from 'node:path';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { Vector3 } from 'three/webgpu';
import { bridgeApproaches } from './bridge_approaches.mjs';
import { reviewRailings } from './review_railings.mjs';
import { reviewWaterParts } from './review_water_structures.mjs';
import { selectDistricts } from './district_structures.mjs';
import { indexTriangles } from './static_structures.mjs';
import { loadStructureMap } from './audit_structures.mjs';
import { checkPlanEdges, planCalibration, railCalibration, surveyBridges } from './survey_bridges.mjs';
import { calibrateBridge } from './calibrate_bridge.mjs';
import { assetFingerprint, parsePack } from '../src/data.js';
import { structureSurface } from './build_structures.mjs';
import { writePack } from './write_pack.mjs';

const [dir = 'data-raw/structures', output = 'data-raw/kandidat/detail/structures'] = process.argv.slice(2);
const json = file => JSON.parse(fs.readFileSync(file));
const {parts, source} = json(path.join(dir, 'dily.json'));
const {sources, reports} = json(path.join(dir, 'kontroly.json'));
const {parts: overrides, bridges: choices, footbridges = [], roadBridges = [], railBridges = [], pending = {}, districts = [], waterParts = {}} = json('tools/structure-overrides.json');
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
const roadBytes = fs.readFileSync('public/data/roads.bin');
if (assetFingerprint(roadBytes) !== sources.roads) throw Error('Kalibrace a inventura používají různé silnice.');
const roads = parsePack(roadBytes.buffer.slice(roadBytes.byteOffset, roadBytes.byteOffset + roadBytes.byteLength));
const byId = new Map(parts.map(part => [part.id, part]));
for (const [id,reason] of Object.entries(pending)) {
  if (byId.get(id)?.status !== 'čeká na ověření' || !reason) throw Error('Neznámý odložený díl ' + id);
}
const calibrationReasons = new Map();
const bridges = choices.map(choice => {
  for (const id of choice.rails) {
    if (reportsById.get(id)?.categories.length !== 0) throw Error('Nevyřešený průnik pěšího okraje ' + id);
  }
  for (const id of [choice.deck, ...choice.rails]) calibrationReasons.set(id, choice.reason);
  return calibrateBridge(choice, byId, roads);
});
const planChoices = [...footbridges,...roadBridges];
const railDecks = [];
const {world} = await loadStructureMap('public/data');
const rowsByBridge = await surveyBridges(parts,world);
if (planChoices.length || railBridges.length) {
  for (const choice of planChoices) {
    bridges.push(planCalibration(choice,rowsByBridge,world));
    calibrationReasons.set(choice.deck,choice.reason);
  }
  for (const choice of railBridges) {
    railDecks.push(railCalibration(choice,rowsByBridge,world));
    calibrationReasons.set(choice.deck,choice.reason);
  }
}
const {world: calibrated} = await loadStructureMap('public/data',bridges,railDecks);
await checkPlanEdges(bridges,'public/data',railDecks,calibrated);
const excluded = new Set([...accepted,...calibrationReasons.keys()]);
const railings = reviewRailings(parts,reportsById,excluded,calibrated);
const water = await reviewWaterParts(parts,reportsById,waterParts,'public/data',world);
const districtData = await selectDistricts(parts, reportsById, {size:chunk,x:minX,z:minZ},
  json('public/detail/city/index.json').districts, districts, excluded, 'public/data', bridges, railDecks, water.decisions);
const districtReasons = districtData.reasons;
for (const part of districtData.accepted) {
  for (const tile of part.meshes) {
    const key = tile.cx + '_' + tile.cz;
    if (!tiles.has(key)) tiles.set(key,{cx:tile.cx,cz:tile.cz,parts:[]});
    tiles.get(key).parts.push({id:part.id,role:part.role,core:tile.shells.flat(),detail:tile.detail});
  }
  accepted.add(part.id);
  districtReasons.set(part.id, (water.decisions.get(part.id)?.reason ?? ('Obvod ' + part.district + '.')) + ' Městské plochy i kolizní obaly prošly kontrolou herních tras.');
}
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
writePack(file,{version:2},indexTriangles(all));
const bytes = fs.readFileSync(file);
if (bytes.length > 2 * 1024 * 1024) throw Error('Základní balík přesahuje 2 MiB.');
const index = {version:2, bridges, railDecks, source, sources, hash:assetFingerprint(bytes), tiles:entries};
fs.writeFileSync(path.join(output,'index.json'), JSON.stringify(index) + '\n');
const bridgeReasons = new Map(rowsByBridge.map(({id,matches}) => {
  if (!matches.length) return [id,'Městský díl nemá pět společných řezů s jedinou vyvýšenou herní osou.'];
  if (matches.length > 1) return [id,'Městské řezy protínají více herních tras. Rozdělit nebo přiřadit společnou desku před změnou profilu.'];
  const m = matches[0];
  const coverage = Math.round(100 * m.span / m.routeLength);
  return [id,'Pět společných řezů s trasou ' + m.id + ', pokrytí délky trasy ' + coverage +
    ' %. Ověřit změny obrysu a napojení před převzetím profilu.'];
}));
const rows = [['díl', 'zdrojové ID', 'ploch v SHP', 'unikátních ploch', 'stav', 'důvod']];
for (const part of parts) {
  const chosen = accepted.has(part.id) || calibrationReasons.has(part.id);
  rows.push([part.id, part.uid, part.records, part.faces.length,
    chosen ? 'začleněn' : (water.decisions.get(part.id)?.status ?? part.status), districtReasons.get(part.id) ?? calibrationReasons.get(part.id) ?? overrides[part.id]?.reason ?? pending[part.id] ?? water.decisions.get(part.id)?.reason ?? railings.reasons.get(part.id) ?? bridgeReasons.get(part.id) ?? part.reason]);
}
const approachRows = bridgeApproaches(byId,[...planChoices,...railBridges],world);
fs.writeFileSync(path.join(dir, 'pristupy-mostu.tsv'), approachRows.map(row => row.join('\t')).join('\n') + '\n');
const railingRows = [['díl','střet s trasou','vzorky paty','vzorky s oporou do 0,5 m','vzorky nad mostovkou','blízké herní dílce','posouzení'], ...railings.rows];
fs.writeFileSync(path.join(dir, 'samostatna-zabradli.tsv'), railingRows.map(row => row.join('\t')).join('\n') + '\n');
const waterRows = [['díl','druh','vzorky','vzorky ve vodě','vzorky v budovách','nejnižší vrchol vůči povrchu (m)','nejvyšší vrchol vůči povrchu (m)','vzdálenost ke zvuku jezu (m)','střet s trasou','posouzení'], ...water.rows];
fs.writeFileSync(path.join(dir, 'vodni-objekty.tsv'), waterRows.map(row => row.join('\t')).join('\n') + '\n');
fs.writeFileSync(path.join(dir, 'inventura.tsv'), rows.map(row => row.join('\t')).join('\n') + '\n');
console.log(accepted.size + ' objektů, ' + bytes.length + ' bajtů v základní vrstvě.');
