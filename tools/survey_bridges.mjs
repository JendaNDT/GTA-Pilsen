// Průběh herní osy a výška trasy se vyhodnocují zvlášť pro každou úroveň křížení.
import { Vector3 } from 'three/webgpu';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { structureSurface } from './build_structures.mjs';
import { audit, loadStructureMap } from './audit_structures.mjs';
import { validRailSections } from '../src/world/rail-deck.js';
const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];

async function elevatedRoutes(world) {
  const { RF, DRIVABLE_MAX } = await import('../src/config.js');
  const routes = [];
  for (let i = 0; i < world.rCount; i++)
    if (world.r.flags[i] & RF.BRIDGE) {
      const path = [];
      for (let k = world.rOff[i]; k < world.rOff[i + 1]; k++) path.push([world.rpx[k], world.rpy[k], world.rpz[k]]);
      routes.push({
        id: i,
        type: world.r.cls[i] > DRIVABLE_MAX ? 'lávka' : 'silnice',
        width: 2 * world.deckHalfWidth(i),
        path
      });
    }
  for (const [i, r] of world.rails.entries())
    if (r.y) {
      const path = Array.from(r.y, (y, k) => [r.pts[k * 2], y, r.pts[k * 2 + 1]]);
      routes.push({ id: i, type: 'koleje', width: 2 * (r.cls === 1 ? 2.4 : 1.7), path });
    }

  return routes;
}

export function deckSection(surface, x, y, z, dx, dz) {
  const spans = [];
  for (const tri of surface) {
    const pts = [tri.a, tri.b, tri.c].map((p) => [
      (p.x - x) * dx + (p.z - z) * dz,
      (p.z - z) * dx - (p.x - x) * dz,
      p.y
    ]);
    const cut = [];
    for (let i = 0; i < 3; i++) {
      const a = pts[i],
        b = pts[(i + 1) % 3];
      if (a[0] < 0 === b[0] < 0) continue;
      const t = a[0] / (a[0] - b[0]);
      cut.push([a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])]);
    }
    if (cut.length !== 2) continue;
    cut.sort((a, b) => a[0] - b[0]);
    if (cut[1][0] - cut[0][0] > 0.001) spans.push(cut);
  }
  const intervals = [];
  for (const [a, b] of spans.toSorted((a, b) => a[0][0] - b[0][0])) {
    const last = intervals.at(-1);
    if (last && a[0] <= last[1] + 0.035) last[1] = Math.max(last[1], b[0]);
    else intervals.push([a[0], b[0]]);
  }
  const containing = intervals.filter(([lo, hi]) => lo <= 0 && hi >= 0);
  if (containing.length !== 1) return;
  const [lo, hi] = containing[0],
    top = Math.max(
      ...spans
        .filter(([l, r]) => l[0] <= 0 && r[0] >= 0)
        .map(([l, r]) => l[1] + ((r[1] - l[1]) * l[0]) / (l[0] - r[0]))
    );
  if (!Number.isFinite(top)) return;
  return { width: hi - lo, offset: (hi + lo) / 2, lift: top - y };
}
function compare(route, faces, points, cx, cz) {
  const segments = [];
  let at = 0;
  for (let i = 1; i < route.path.length; i++) {
    const [x, y, z] = route.path[i - 1],
      [bx, by, bz] = route.path[i],
      len = Math.hypot(bx - x, bz - z);
    if (len < 0.001) continue;
    segments.push({ x, y, z, dx: (bx - x) / len, dz: (bz - z) / len, grade: (by - y) / len, at, len });
    at += len;
  }
  function station(px, pz) {
    let best = Infinity,
      project = 0;
    for (const s of segments) {
      const a = Math.max(0, Math.min(s.len, (px - s.x) * s.dx + (pz - s.z) * s.dz));
      const dist = Math.hypot(px - s.x - s.dx * a, pz - s.z - s.dz * a);
      if (dist < best) {
        best = dist;
        project = s.at + a;
      }
    }
    return [best, project];
  }
  if (station(cx, cz)[0] > 24) return;
  const stations = points.map((p) => station(p.x, p.z)[1]),
    a = Math.min(...stations),
    b = Math.max(...stations);
  if (b - a < 2) return;
  const samples = [];
  let sampleDirection;
  for (const f of [0.2, 0.35, 0.5, 0.65, 0.8]) {
    const dist = a + (b - a) * f,
      s = segments.find((s) => s.at + s.len >= dist),
      u = dist - s.at;
    const cut = deckSection(faces, s.x + s.dx * u, s.y + s.grade * u, s.z + s.dz * u, s.dx, s.dz);
    if (!cut) return;
    samples.push(cut);
    if (f === 0.5) sampleDirection = s;
  }
  const rounded = (v) => Math.round(v * 1000) / 1000;
  const values = (key) => samples.map((p) => p[key]);
  return {
    id: route.id,
    type: route.type,
    from: rounded(a),
    to: rounded(b),
    routeLength: rounded(at),
    span: rounded(b - a),
    gameWidth: rounded(route.width),
    samples: samples.map((s, i) => ({
      u: rounded(a + (b - a) * [0.2, 0.35, 0.5, 0.65, 0.8][i]),
      width: rounded(s.width),
      offset: rounded(s.offset),
      lift: rounded(s.lift)
    })),
    width: rounded(median(values('width'))),
    offset: rounded(median(values('offset'))),
    lift: rounded(median(values('lift'))),
    shiftX: rounded(-sampleDirection.dz * median(values('offset'))),
    shiftZ: rounded(sampleDirection.dx * median(values('offset'))),
    maxLiftDeviation: rounded(Math.max(...values('lift').map((l) => Math.abs(l - median(values('lift'))))))
  };
}

export async function surveyBridges(parts, world) {
  const routes = await elevatedRoutes(world);
  const results = [];
  for (const part of parts) {
    const faces = part.faces.filter((f) => f[0] === 'Most');
    if (!faces.length) continue;
    const triangles = faces
      .flatMap((f) => structureSurface(f).triangles.map((t) => t.tri))
      .filter((t) => Math.abs(t.getNormal(new Vector3()).y) > 0.75);
    const points = triangles.flatMap((t) => [t.a, t.b, t.c]);
    if (!points.length) {
      results.push({ id: part.id, matches: [] });
      continue;
    }
    const mid = (k) => (Math.min(...points.map((p) => p[k])) + Math.max(...points.map((p) => p[k]))) / 2;
    const cx = mid('x'),
      cz = mid('z');
    const matches = routes
      .map((r) => compare(r, triangles, points, cx, cz))
      .filter(Boolean)
      .sort((a, b) => Math.abs(a.lift) - Math.abs(b.lift) || Math.abs(a.offset) - Math.abs(b.offset));
    results.push({ id: part.id, matches });
  }

  return results;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const dir = process.argv[2] ?? 'data-raw/structures';
  const { parts } = JSON.parse(await readFile(path.join(dir, 'dily.json'), 'utf8'));
  const { world } = await loadStructureMap('public/data');
  const rows = await surveyBridges(parts, world);
  await writeFile(path.join(dir, 'mostni-rezy.json'), JSON.stringify(rows, null, 2) + '\n');
  const table = [
    [
      'díl',
      'druh',
      'herní osa',
      'měřená šířka (m)',
      'herní šířka (m)',
      'posun osy (m)',
      'výška vůči profilu (m)',
      'možných tras'
    ]
  ];
  for (const row of rows) {
    if (!row.matches.length) table.push([row.id, 'bez pěti společných řezů', '', '', '', '', '', 0]);
    for (const m of row.matches)
      table.push([row.id, m.type, m.id, m.width, m.gameWidth, m.offset, m.lift, row.matches.length]);
  }
  await writeFile(path.join(dir, 'mostni-rezy.tsv'), table.map((r) => r.join('\t')).join('\n') + '\n');
}

// Chodník zaznamenaný jako druhá cesta musí skutečně ležet na zvolené silniční desce.
function sameDeck(world, road, walkway, m) {
  const a = world.rOff[road],
    b = world.rOff[road + 1] - 1;
  const dx = world.rpx[b] - world.rpx[a],
    dz = world.rpz[b] - world.rpz[a];
  const length = Math.hypot(dx, dz);
  for (let k = world.rOff[walkway]; k < world.rOff[walkway + 1]; k++) {
    const x = world.rpx[k] - world.rpx[a],
      z = world.rpz[k] - world.rpz[a];
    const t = (x * dx + z * dz) / (length * length);
    const offset = (z * dx - x * dz) / length - m.offset;
    const y = world.rpy[a] + t * (world.rpy[b] - world.rpy[a]);
    if (
      t < 0 ||
      t > 1 ||
      Math.abs(offset) + world.r.w[walkway] / 2 > m.width / 2 ||
      Math.abs(world.rpy[k] - y) > 0.1
    )
      return false;
  }
  return true;
}

// Jednotný posun a šířka patří jen přímé mostovce s konzistentními řezy napříč rozpětím.
export function planCalibration(choice, rows, world) {
  const { road, deck, type, reason } = choice;
  const matches = rows.find((row) => row.id === deck)?.matches;
  const m = matches?.find((s) => s.id === road && s.type === type);
  if (
    !m ||
    !reason ||
    m.samples.length !== 5 ||
    matches.length !== (choice.walkway === undefined ? 1 : 2) ||
    (choice.walkway !== undefined &&
      (type !== 'silnice' ||
        !matches.some((s) => s.type === 'lávka' && s.id === choice.walkway) ||
        !sameDeck(world, road, choice.walkway, m))) ||
    m.from > m.routeLength * 0.1 ||
    m.to < m.routeLength * 0.9
  )
    throw Error('Nejednoznačný půdorys ' + deck);
  if (
    world.rOff[road + 1] - world.rOff[road] !== 2 ||
    world.gradeRoads.has(road) ||
    world.rondel?.elevated.has(road) ||
    road === world.prazdrojRoad ||
    m.samples.some((s) => Math.abs(s.width - m.width) > 0.1 || Math.abs(s.offset - m.offset) > 0.12)
  )
    throw Error('Jednotná oprava neodpovídá celému půdorysu ' + deck);
  return { kind: 'plan', road, halfWidth: m.width / 2, shiftX: m.shiftX, shiftZ: m.shiftZ, lift: 0 };
}

export async function checkPlanEdges(models, directory, railDecks) {
  const { world } = await loadStructureMap(directory, models, railDecks);
  const { indexBridgeEdges, railingFaces } = await import('../src/physics/railings.js');
  const roads = new Set(models.filter((m) => m.kind === 'plan').map((m) => m.road));
  const rails = new Set(railDecks.map((m) => m.rail));
  const shells = [];
  // Kontrolují se přesně díly vykreslené hrou po oříznutí na společných mostovkách.
  indexBridgeEdges(world, (owner, edge) => {
    if (!roads.has(owner.road) && !rails.has(owner.rail)) return;
    const faces = [['Okraj', edge.corners.flat()]];
    railingFaces(edge, (...quad) => faces.push(['Okraj', quad.flat()]));
    const id = owner.road === undefined ? 'kolej-' + owner.rail : 'silnice-' + owner.road;
    shells.push({ id: id + '/' + shells.length, faces, convex: true });
  });
  if (!shells.length) return;
  const { reports } = await audit(shells, directory, models, railDecks);
  const blocked = reports
    .filter((r) => r.categories.length)
    .map((r) => r.id + ' (' + r.categories.join(', ') + ')');
  if (blocked.length) throw Error('Posunuté okraje kříží herní trasy: ' + blocked.join(', '));
}

export function railCalibration(choice, rows, world) {
  const matches = rows.find((row) => row.id === choice.deck)?.matches;
  const m = matches?.find((m) => m.type === 'koleje' && m.id === choice.rail);
  const rail = world.rails[choice.rail];
  if (
    !m ||
    matches.length !== 1 ||
    !choice.reason ||
    !rail?.y ||
    world.gradeRails.has(choice.rail) ||
    (m.to - m.from) / m.routeLength < 0.75 ||
    m.samples.some((s) => s.width / 2 - Math.abs(s.offset) < 1.7)
  )
    throw Error('Nejednoznačná nebo překrytá železniční konstrukce ' + choice.deck);
  const base = rail.cls === 1 ? 4.8 : 3.4,
    sections = [[0, base, 0]];
  const fraction = (u) => Math.round((u / m.routeLength) * 1e6) / 1e6;
  // Mimo srovnaný díl navazuje běžná šířka, na vjezdu a výjezdu zůstává osa koleje.
  if (fraction(m.from) > 0) sections.push([fraction(m.from), base, 0]);
  for (const s of m.samples) sections.push([fraction(s.u), s.width, s.offset]);
  if (fraction(m.to) < 1) sections.push([fraction(m.to), base, 0]);
  sections.push([1, base, 0]);
  if (!validRailSections(sections)) throw Error('Neplatné řezy kolejí ' + choice.deck);
  return { rail: choice.rail, sections };
}
