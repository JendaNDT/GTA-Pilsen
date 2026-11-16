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

function parsePack(buf) {
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
  ['buildings', 'data/buildings.bin', 4_350_000],
  ['roads', 'data/roads.bin', 1_510_000],
  ['land', 'data/land.bin', 2_190_000],
  ['terrain', 'data/terrain.bin', 5_280_000],
  ['rails', 'data/rails.bin', 74_000],
  ['trees', 'data/trees.bin', 130_000],
  ['meta', 'data/meta.json', 441_000],
];

export async function loadAll(onProgress) {
  const totalSize = FILES.reduce((s, f) => s + f[2], 0);
  let loaded = 0;
  const bump = (n) => { loaded += n; onProgress(Math.min(1, loaded / totalSize)); };
  const base = import.meta.env.BASE_URL || '/';
  const results = await Promise.all(FILES.map(([, url]) => fetchBuffer(base + url, bump)));
  const out = {};
  FILES.forEach(([name], i) => {
    out[name] = name === 'meta'
      ? JSON.parse(new TextDecoder().decode(new Uint8Array(results[i])))
      : parsePack(results[i]);
  });
  return out;
}
