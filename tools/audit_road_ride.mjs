// Podélné nerovnosti ve třech stopách všech silnic určených pro auta.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { roadContinuations } from '../src/world/road-continuation.js';
import { parsePack } from '../src/data.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '' };
const { World } = await import('../src/world/world.js');
const { DRIVABLE_MAX } = await import('../src/config.js');

export function surveyWorld() {
  const file = name => fs.readFileSync(new URL('../public/' + name, import.meta.url));
  const json = name => JSON.parse(file(name));
  const data = { meta: json('data/meta.json'), gradeSeparations: json('data/grade-separations.json'),
    underpasses: json('data/underpasses.json'), structures: { index: json('detail/structures/index.json') },
    streetDetails: json('detail/streets/index.json') };
  for (const name of ['roads', 'terrain', 'buildings', 'landscape', 'land', 'rails', 'trees']) {
    const bytes = file('data/' + name + '.bin');
    data[name] = parsePack(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  class SurveyWorld extends World { _initLand(land) { this._initWater(land); } }
  return new SurveyWorld(data);
}

export function sampleRoad(w, road, along, fraction) {
  const stations = w.roadGrade.station, first = w.rOff[road], last = w.rOff[road + 1] - 1;
  let k = first, hi = last;
  while (k + 1 < hi) {
    const m = (k + hi) >>> 1;
    if (stations[m] < along) k = m; else hi = m;
  }
  const length = stations[k + 1] - stations[k] || 1, t = Math.min(1, Math.max(0, (along - stations[k]) / length));
  const dx = w.rpx[k + 1] - w.rpx[k], dz = w.rpz[k + 1] - w.rpz[k];
  const offset = fraction * w.r.w[road] / (2 * length);
  const x = w.rpx[k] + t * dx - dz * offset, z = w.rpz[k] + t * dz + dx * offset;
  // U Valíku nahradil poslední desítky metrů asfaltu od portálu samostatný pás tunelu.
  const entry = w.tunnelApproaches.get(road);
  if (entry) for (const portal of [entry.start, entry.end]) {
    if (!portal) continue;
    const d = (x - portal.x) * portal.dx + (z - portal.z) * portal.dz;
    const length = Math.hypot(portal.outside.x - portal.x, portal.outside.z - portal.z);
    if (d <= 0 && d >= -length) return { x, z, y: portal.y + (portal.y - portal.outside.y) * d / length };
  }
  return { x, z, y: w.roadSurfaceY(road, k, t, x, z) };
}

export function measure(w, road, links) {
  const length = w.roadGrade.station[w.rOff[road + 1] - 1], count = Math.max(1, Math.ceil(length / 2));
  const step = length / count, worst = [0, 0], peaks = [0, 0], over = [0, 0];
  for (const fraction of [-0.55, 0, 0.55]) {
    const ys = Array.from({ length: count + 1 }, (_, i) => sampleRoad(w, road, i * step, fraction).y);
    for (const [j, radius] of [2, 6].entries()) {
      const span = radius / step, low = Math.floor(span), t = span - low;
      for (let i = Math.ceil(span); i <= count - Math.ceil(span); i++) {
        const a = ys[i - low] + t * ((ys[Math.max(0, i - low - 1)] ?? 0) - ys[i - low]);
        const b = ys[i + low] + t * ((ys[Math.min(count, i + low + 1)] ?? 0) - ys[i + low]);
        const d = Math.abs(ys[i] - (a + b) / 2);
        if (d > worst[j]) { worst[j] = d; peaks[j] = i * step; }
        if (d > [0.05, 0.15][j]) over[j]++;
      }
    }
  }
  // Samostatné měření přes hranice dílů zahrne i krátké přípojky. Při opačném
  // pořadí uzlů na druhém dílu se strana jízdní stopy obrátí.
  const joins = { samples: [0, 0], worst: [0, 0], over: [0, 0] };
  for (const dir of [-1, 1]) {
    const k = dir < 0 ? w.rOff[road] : w.rOff[road + 1] - 1, link = links?.get(k);
    if (!link) continue;
    const available = link.sign < 0 ? link.from : w.roadGrade.station[w.rOff[link.road + 1] - 1] - link.from;
    for (const [j, span] of [2, 6].entries()) {
      for (let inward = 0; inward < span; inward += 2) {
        if (inward + span > length || span - inward > available) continue;
        for (const side of [-0.55, 0, 0.55]) {
          const at = d => sampleRoad(w, road, dir < 0 ? d : length - d, side).y;
          const other = sampleRoad(w, link.road, link.from + link.sign * (span - inward), side * dir * link.sign);
          const delta = Math.abs(at(inward) - (at(inward + span) + other.y) / 2);
          joins.worst[j] = Math.max(joins.worst[j], delta);
          joins.samples[j]++;
          if (delta > [0.05, 0.15][j]) joins.over[j]++;
        }
      }
    }
  }
  return { road, name: w.roadNames[w.r.name[road]], cls: w.r.cls[road], length, count, worst, peaks, over, joins };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const w = surveyWorld(), results = [], rondel = process.argv.includes('--rondel');
  const links = roadContinuations(w, w.r.cls.map(cls => Number(cls <= DRIVABLE_MAX)), w.roadGrade.station);
  for (let road = 0; road < w.rCount; road++) {
    if (w.r.cls[road] > DRIVABLE_MAX) continue;
    const a = w.rOff[road], b = w.rOff[road + 1];
    if (rondel && !Array.from(w.rpz.subarray(a, b)).some((z, i) => Math.abs(z + 790) < 500 && Math.abs(w.rpx[a + i] + 150) < 170)) continue;
    results.push(measure(w, road, links));
  }
  console.log(JSON.stringify(results));
}
