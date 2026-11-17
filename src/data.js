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
  ['buildings', 'data/buildings.bin', 6_104_000],
  ['roads', 'data/roads.bin', 2_100_000],
  ['land', 'data/land.bin', 3_215_000],
  ['terrain', 'data/terrain.bin', 10_475_000],
  ['rails', 'data/rails.bin', 96_000],
  ['trees', 'data/trees.bin', 161_000],
  ['meta', 'data/meta.json', 2_082_000],
  ['timetable', 'data/timetable.json', 974_368],
  ['trafficProfiles', 'data/traffic-profiles.json', 212_000],
  ['landscape', 'data/landscape.bin', 1_354_000],
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

export async function loadAll(onProgress) {
  const totalSize = FILES.reduce((s, f) => s + f[2], 0);
  let loaded = 0;
  const bump = (n) => { loaded += n; onProgress(Math.min(1, loaded / totalSize)); };
  const base = import.meta.env?.BASE_URL || '/';
  const results = await Promise.all(FILES.map(([name, url]) => {
    const request = fetchBuffer(base + url, bump);
    return name === 'landscape' ? request.catch(() => null) : request;
  }));
  const out = {};
  FILES.forEach(([name, url], i) => {
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
  return out;
}
