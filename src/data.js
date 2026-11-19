import {validRailSections} from './world/rail-deck.js';
// Načítání herních dat (binární balíčky vyrobené skriptem tools/build_data.py).

const TYPES = {
  i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array,
  i4: Int32Array, u4: Uint32Array, f4: Float32Array,
};

async function fetchBuffer(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nepodařilo se načíst ${url} (${res.status})`);
  if (!res.body || !onBytes) return res.arrayBuffer();
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out.buffer;
}

export function parsePack(buf) {
  const dv = new DataView(buf);
  const magic = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (magic !== 'PLZ1') throw new Error('Neznámý formát dat');
  const hlen = dv.getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hlen)));
  const base = 8 + hlen;
  const out = { header };
  for (const [name, a] of Object.entries(header.arrays)) {
    out[name] = new TYPES[a.dtype](buf, base + a.offset, a.length);
  }
  return out;
}

// přibližné velikosti souborů (bajty) pro ukazatel průběhu
const FILES = [
  ['collisionRoofs', 'data/collision-roofs.json', 2_335_000],
  ['buildings', 'data/buildings.bin', 6_104_000],
  ['roads', 'data/roads.bin', 2_100_000],
  ['land', 'data/land.bin', 3_215_000],
  ['terrain', 'data/terrain.bin', 10_475_000],
  ['rails', 'data/rails.bin', 96_000],
  ['trees', 'data/trees.bin', 161_000],
  ['buildingMaterials', 'data/building-materials.json', 2_000],
  ['treeTypes', 'data/tree-types.json', 108_000],
  ['meta', 'data/meta.json', 2_082_000],
  ['timetable', 'data/timetable.json', 3_513_000],
  ['trafficProfiles', 'data/traffic-profiles.json', 212_000],
  ['landscape', 'data/landscape.bin', 1_354_000],
  ['gradeSeparations', 'data/grade-separations.json', 460_000],
  ['soundPlaces', 'data/sound-places.json', 2_000],
  ['heritage', 'detail/city/index.json', 75_000],
];

export function assetFingerprint(buffer) {
  let hash = 2166136261;
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function loadCityTile(file, signal) {
  const base = import.meta.env?.BASE_URL || '/';
  const response = await fetch(`${base}detail/city/${file}`, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`Dlaždice centra ${file} (${response.status})`);
  return parsePack(await response.arrayBuffer());
}

const structuresPath = (import.meta.env?.BASE_URL || '/') + 'detail/structures/';

function checkedPositions(buffer, hash, version = 1) {
  if (assetFingerprint(buffer) !== hash) return null;
  const {header, p, i:indices} = parsePack(buffer);
  if (header.version !== version || !(p instanceof Float32Array) || p.length % 3 || !p.every(Number.isFinite)) return null;
  if (version === 1) return p.length % 9 === 0 ? p : null;
  if (!(indices instanceof Uint16Array || indices instanceof Uint32Array) || indices.length % 3 ||
      !indices.every(i => i < p.length/3)) return null;
  const positions = new Float32Array(indices.length*3);
  for (let i = 0; i < indices.length; i++) {
    const j = indices[i]*3;
    positions[3*i] = p[j];
    positions[3*i+1] = p[j+1];
    positions[3*i+2] = p[j+2];
  }
  return positions;
}

export async function loadStructureDetail(tile, signal) {
  try {
    const response = await fetch(structuresPath + tile.file, {signal});
    if (!response.ok) return null;
    const positions = checkedPositions(await response.arrayBuffer(), tile.hash);
    const last = tile.objects.at(-1);
    return positions?.length === 3 * (last.dStart + last.dCount) ? positions : null;
  } catch { return null; }
}

export async function loadStructureCore(search = globalThis.location?.search) {
  if (new URLSearchParams(search).get('structures') === '0') return null;
  try {
    const signal = AbortSignal.timeout(12000);
    const [manifest, core] = await Promise.all(['index.json', 'core.bin'].map(file =>
      fetch(structuresPath + file, { signal })));
    if (!manifest.ok || !core.ok) return null;
    const index = await manifest.json(), buffer = await core.arrayBuffer();
    if (![1,2].includes(index.version) || buffer.byteLength > 2 * 1024 * 1024 || !Array.isArray(index.tiles)) return null;
    const rails = new Set();
    for (const model of index.railDecks ?? []) {
      if (!Number.isSafeInteger(model.rail) || model.rail < 0 || rails.has(model.rail) ||
          !validRailSections(model.sections)) return null;
      rails.add(model.rail);
    }
    const roads = new Set();
    for (const bridge of index.bridges ?? []) {
      if (!Number.isSafeInteger(bridge.road) || bridge.road < 0 || roads.has(bridge.road) ||
          !Number.isFinite(bridge.halfWidth) || bridge.halfWidth <= 0 ||
          ![bridge.shiftX, bridge.shiftZ, bridge.lift].every(Number.isFinite)) return null;
      roads.add(bridge.road);
      if (bridge.kind === 'plan') {
        if (bridge.lift !== 0 || bridge.strips !== undefined || bridge.archStops !== undefined) return null;
        continue;
      }
      if (bridge.kind !== undefined || !Number.isFinite(bridge.railHeight) || bridge.railHeight <= 0 ||
          !Array.isArray(bridge.archStops) || bridge.archStops.length !== 3 ||
          !bridge.archStops.every((v,i,a) => Number.isFinite(v) && v >= 0 && v <= 1 && (!i || v > a[i-1])) ||
          !Array.isArray(bridge.strips) || !bridge.strips.length ||
          !bridge.strips.every(s => Array.isArray(s) && s.length === 6 && s.every(Number.isFinite) &&
            s[3] > s[0] && s[2] >= s[1] && s[5] >= s[4])) return null;
    }
    const positions = checkedPositions(buffer, index.hash, index.version);
    if (!positions) return null;
    const visited = new Set();
    let end = 0;
    for (const tile of index.tiles) {
      if (![tile.cx, tile.cz].every(v => Number.isSafeInteger(v) && v >= 0) ||
          tile.file !== tile.cx + '_' + tile.cz + '.bin' || visited.has(tile.file) ||
          !Array.isArray(tile.objects) || !tile.objects.length) return null;
      visited.add(tile.file);
      let detailEnd = 0;
      for (const part of tile.objects) {
        if (part.start !== end || part.dStart !== detailEnd ||
          ![part.count, part.dCount].every(v => Number.isSafeInteger(v) && v > 0 && v % 3 === 0)) return null;
        end += part.count;
        detailEnd += part.dCount;
      }
    }
    return end * 3 === positions.length ? {index, positions} : null;
  } catch { return null; }
}

export async function loadAll(onProgress) {
  const totalSize = FILES.reduce((s, f) => s + f[2], 0);
  let loaded = 0;
  const bump = (n) => { loaded += n; onProgress(Math.min(1, loaded / totalSize)); };
  const base = import.meta.env?.BASE_URL || '/';
  const structureRequest = loadStructureCore();
  const results = await Promise.all(FILES.map(([name, url]) => {
    const request = fetchBuffer(base + url, bump);
    return ['landscape', 'soundPlaces', 'gradeSeparations', 'treeTypes', 'buildingMaterials'].includes(name) ? request.catch(() => null) : request;
  }));
  const out = {};
  FILES.forEach(([name, url], i) => {
    if ((['soundPlaces','gradeSeparations','treeTypes','buildingMaterials'].includes(name)) && !results[i]) return;
    if (name === 'landscape') {
      if (results[i]?.byteLength > 8) {
        try { out.landscape = parsePack(results[i]); } catch { /* základní síť stačí k hraní */ }
      }
      return;
    }
    out[name] = url.endsWith('.json')
      ? JSON.parse(new TextDecoder().decode(new Uint8Array(results[i])))
      : parsePack(results[i]);
  });
  const fingerprints = new Map();
  const fingerprint = (name) => {
    if (!fingerprints.has(name)) fingerprints.set(name, assetFingerprint(results[FILES.findIndex(([key]) => key === name)]));
    return fingerprints.get(name);
  };
  if (fingerprint('buildings') !== out.heritage.osm || fingerprint('terrain') !== out.heritage.terrain) out.heritage.tiles = [];
  if (out.landscape && !['terrain', 'roads', 'rails', 'buildings', 'land'].every((name) =>
    out.landscape.header.sources?.[name] === fingerprint(name))) delete out.landscape;
  if (out.gradeSeparations && (!out.landscape || !['terrain', 'roads', 'rails', 'landscape'].every((name) =>
    out.gradeSeparations.sources?.[name] === fingerprint(name)))) delete out.gradeSeparations;
  if (out.treeTypes && (out.treeTypes.osm !== out.meta.osmTimestamp ||
    !['trees','land'].every(name => out.treeTypes.sources?.[name] === fingerprint(name)))) delete out.treeTypes;
  if (out.buildingMaterials && (out.buildingMaterials.osm !== out.meta.osmTimestamp ||
    out.buildingMaterials.buildings !== fingerprint('buildings'))) delete out.buildingMaterials;
  const structures = await structureRequest;
  if (structures && out.gradeSeparations && out.landscape &&
    ['terrain', 'roads', 'rails', 'landscape', 'buildings', 'trees', 'grade-separations'].every(key =>
      structures.index.sources?.[key] === fingerprint(key === 'grade-separations' ? 'gradeSeparations' : key))) {
    out.structures = structures;
  }
  out.orthophotoSources = { terrain: fingerprint('terrain'), land: fingerprint('land') };
  out.soundPlaces = out.soundPlaces && out.soundPlaces.osm === out.meta.osmTimestamp ? out.soundPlaces.weirs : [];
  return out;
}
