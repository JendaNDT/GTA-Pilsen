// Rozdělení měřených ploch podle skutečné vzdálenosti v prostoru včetně svislých stěn.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Box3, Color, Ray, Triangle, Vector3 } from 'three/webgpu';
import { HeritageMesh } from '../src/world/heritage-geometry.js';

const gap = 0.5, threshold = gap * gap + 1e-9;
const white = new Color(0xffffff);
const near = new Vector3(), direction = new Vector3(), ray = new Ray();
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function ringKey(ring) {
  const vertices = [];
  for (let i = 0; i < ring.length; i += 3) vertices.push(ring.slice(i, i + 3).join(','));
  const first = vertices.reduce((a, b) => a < b ? a : b);
  const candidates = [];
  for (const sequence of [vertices, [...vertices].reverse()]) {
    for (let i = 0; i < sequence.length; i++) if (sequence[i] === first) {
      candidates.push([...sequence.slice(i), ...sequence.slice(0, i)].join(';'));
    }
  }
  return candidates.sort()[0];
}

export function structureSurface(face) {
  const [, ...rings] = face;
  const mesh = new HeritageMesh();
  if (rings.length) mesh.polygon(rings, white);
  const vertices = [];
  for (let i = 0; i < mesh.p.length; i += 3) vertices.push(new Vector3().fromArray(mesh.p, i));
  const triangles = [];
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const tri = new Triangle(...mesh.indices.slice(i, i + 3).map(index => vertices[index]));
    triangles.push({ tri, box: new Box3().setFromPoints([tri.a, tri.b, tri.c]) });
  }
  const keys = rings.map(ringKey);
  return { face, vertices, triangles, box: new Box3().setFromPoints(vertices),
    key: JSON.stringify([keys[0], ...keys.slice(1).sort()]) };
}

function nearbyBounds(a, b) {
  return a.min.x <= b.max.x + gap && b.min.x <= a.max.x + gap
    && a.min.y <= b.max.y + gap && b.min.y <= a.max.y + gap
    && a.min.z <= b.max.z + gap && b.min.z <= a.max.z + gap;
}

function nearTriangles(a, b) {
  for (const [first, second] of [[a, b], [b, a]]) {
    const edges = [first.a, first.b, first.c], other = [second.a, second.b, second.c];
    for (let i = 0; i < 3; i++) {
      const start = edges[i], end = edges[(i + 1) % 3];
      if (second.closestPointToPoint(start, near).distanceToSquared(start) <= threshold) return true;
      const length = direction.subVectors(end, start).length();
      if (!length) continue;
      ray.set(start, direction.multiplyScalar(1 / length));
      if (ray.intersectTriangle(second.a, second.b, second.c, false, near)
          && near.distanceToSquared(start) <= length * length) return true;
      for (let j = 0; j < 3; j++) {
        const d = ray.distanceSqToSegment(other[j], other[(j + 1) % 3], near);
        if (d <= threshold && near.distanceToSquared(start) <= length * length + 1e-9) return true;
      }
    }
  }
  return false;
}

function nearFaces(a, b) {
  if (!nearbyBounds(a.box, b.box)) return false;
  for (const p of a.triangles) for (const q of b.triangles) {
    if (nearbyBounds(p.box, q.box) && nearTriangles(p.tri, q.tri)) return true;
  }
  return false;
}

function components(faces) {
  const parent = faces.map((_, i) => i);
  function root(i) {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  }
  // Společný vrchol spojuje většinu ploch městského modelu přesně.
  const vertexOwner = new Map();
  faces.forEach((face, i) => {
    for (const v of face.vertices) {
      const key = v.toArray().join(',');
      if (vertexOwner.has(key)) parent[root(i)] = root(vertexOwner.get(key));
      else vertexOwner.set(key, i);
    }
  });
  const sorted = faces.map((face, i) => ({face, i})).sort((a, b) => a.face.box.min.x - b.face.box.min.x);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b.face.box.min.x > a.face.box.max.x + gap) break;
      if (root(a.i) !== root(b.i) && nearFaces(a.face, b.face)) parent[root(b.i)] = root(a.i);
    }
  }
  const groups = new Map();
  faces.forEach((face, i) => {
    const key = root(i);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(face);
  });
  return [...groups.values()];
}

export function inventory(source) {
  const parts = [], seen = new Map();
  for (const [uid, , records] of [...source.objects].sort((a, b) => compare(a[0], b[0]))) {
    const unique = new Map();
    for (const face of records) {
      const entry = structureSurface(face);
      const existing = unique.get(entry.key);
      if (existing) {
        existing.records++;
        if (compare(face[0], existing.face[0]) < 0) existing.face = face;
      } else unique.set(entry.key, {...entry, records: 1});
    }
    for (const group of components([...unique.values()])) {
      group.sort((a, b) => compare(a.key, b.key));
      const digest = createHash('sha256').update(JSON.stringify(group.map(f => f.key))).digest('hex');
      const id = uid + '-' + digest.slice(0, 16);
      const duplicate = seen.get(digest);
      seen.set(digest, duplicate ?? id);
      const valid = group.some(f => f.triangles.length);
      parts.push({id, uid, digest, records: group.reduce((n, f) => n + f.records, 0),
        status: duplicate ? 'sloučen jako totožná geometrie' : valid ? 'čeká na ověření' : 'nevhodný',
        reason: duplicate ?? (valid ? 'Čeká na kontrolu průchodu a výšky.' : 'Plocha nemá platný trojúhelník.'),
        faces: group.map(f => f.face)});
    }
  }
  return parts.sort((a, b) => compare(a.id, b.id));
}

async function main() {
  const [input = 'data-raw/structures/plochy.json', dir = 'data-raw/structures'] = process.argv.slice(2);
  const source = JSON.parse(await readFile(input, 'utf8'));
  const parts = inventory(source);
  const rows = [['díl', 'zdrojové ID', 'ploch v SHP', 'unikátních ploch', 'stav', 'důvod'],
    ...parts.map(p => [p.id, p.uid, p.records, p.faces.length, p.status, p.reason])];
  await mkdir(dir, {recursive: true});
  await writeFile(path.join(dir, 'inventura.tsv'), rows.map(row => row.join('\t')).join('\n') + '\n');
  await writeFile(path.join(dir, 'dily.json'), JSON.stringify({source: source.sha256, parts}) + '\n');
  console.log(parts.length + ' souvislých dílů');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
