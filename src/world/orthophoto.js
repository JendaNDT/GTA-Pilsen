// Mapové bloky se slaďují se stejným počátkem a stejnými podklady jako terén.
const CHUNKS_PER_BLOCK = 4;
const METERS_PER_PIXEL = 2;
const REQUEST_LIMIT = 2;
const SHA256 = /^[a-f0-9]{64}$/;

export function orthophotoTile(index, cols, chunk) {
  const x = index % cols, z = Math.floor(index / cols);
  const bx = Math.floor(x / CHUNKS_PER_BLOCK), bz = Math.floor(z / CHUNKS_PER_BLOCK);
  const pixels = chunk / METERS_PER_PIXEL;
  return {
    key: `${bx}_${bz}`,
    left: (x % CHUNKS_PER_BLOCK) * pixels,
    top: (z % CHUNKS_PER_BLOCK) * pixels,
    pixels,
  };
}

export function orthophotoBlocks(manifest, { origin, chunk, cols, rows, fingerprints }) {
  const { version, crs, metersPerPixel, blockMeters, sources, blocks } = manifest ?? {};
  if (version !== 1 || crs !== 'EPSG:5514' || metersPerPixel !== METERS_PER_PIXEL ||
      blockMeters !== chunk * CHUNKS_PER_BLOCK || !Array.isArray(manifest.origin) ||
      manifest.origin.length !== 2 || !origin.every((value, i) => value === manifest.origin[i]) ||
      !['terrain', 'land'].every((name) => fingerprints[name] && fingerprints[name] === sources?.[name]) ||
      !blocks || typeof blocks !== 'object' || Array.isArray(blocks)) return null;
  const result = new Map();
  for (const [key, info] of Object.entries(blocks)) {
    const [bx, bz] = key.split('_').map(Number);
    if (!/^\d+_\d+$/.test(key) || bx * CHUNKS_PER_BLOCK >= cols || bz * CHUNKS_PER_BLOCK >= rows ||
        info?.file !== `${key}.webp` || !SHA256.test(info.sha256) || !Number.isSafeInteger(info.bytes) ||
        info.bytes <= 0) return null;
    result.set(key, info.file);
  }
  return result;
}

export class Orthophoto {
  constructor(grid, capacity, {
    base = `${import.meta.env?.BASE_URL || '/'}detail/orthophoto/`,
    fetchFile = (url, options) => fetch(url, options),
    decode = (blob) => createImageBitmap(blob),
    availableRequests = () => REQUEST_LIMIT,
  } = {}) {
    this.grid = grid;
    this.capacity = capacity;
    this.base = base;
    this.fetchFile = fetchFile;
    this.decode = decode;
    this.availableRequests = availableRequests;
    this.dimension = grid.chunk * CHUNKS_PER_BLOCK / METERS_PER_PIXEL;
    this.blocks = null;
    this.cache = new Map();
    this.pending = new Set();
    this.failed = new Set();
    this.wanted = new Set();
    this.loading = false;
  }

  get requests() {
    return this.pending.size + Number(this.loading);
  }

  async load() {
    this.loading = true;
    try {
      const response = await this.fetchFile(`${this.base}index.json`, {
        signal: AbortSignal.timeout(8000), cache: 'no-cache',
      });
      if (response.ok) this.blocks = orthophotoBlocks(await response.json(), this.grid);
    } catch {
      // Původní povrch zůstane k dispozici i bez katalogu.
    } finally {
      this.loading = false;
    }
  }

  get(key) {
    const bitmap = this.cache.get(key);
    if (!bitmap) return null;
    this.cache.delete(key);
    this.cache.set(key, bitmap);
    return bitmap;
  }

  prefetch(priorities) {
    if (!this.blocks) return;
    const wanted = new Set();
    for (const key of priorities) {
      if (this.blocks.has(key)) wanted.add(key);
      if (wanted.size >= this.capacity) break;
    }
    this.wanted = wanted;
    for (const [key, bitmap] of this.cache) {
      if (wanted.has(key)) continue;
      bitmap.close();
      this.cache.delete(key);
    }
    for (const key of this.failed) {
      if (!wanted.has(key)) this.failed.delete(key);
    }
    this.pump();
  }

  pump() {
    for (const key of this.wanted) {
      if (this.requests >= Math.min(REQUEST_LIMIT, this.availableRequests())) break;
      if (this.cache.has(key) || this.pending.has(key) || this.failed.has(key)) continue;
      this.pending.add(key);
      void this.fetchBitmap(key);
    }
  }

  async fetchBitmap(key) {
    try {
      const response = await this.fetchFile(this.base + this.blocks.get(key), {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Ortofoto ${response.status}`);
      const bitmap = await this.decode(await response.blob());
      if (bitmap.width !== this.dimension || bitmap.height !== this.dimension) {
        bitmap.close();
        throw new Error('Nesouhlasí rozměry bloku ortofota');
      }
      if (!this.wanted.has(key)) {
        bitmap.close();
        return;
      }
      this.cache.set(key, bitmap);
      if (this.cache.size > this.capacity) {
        const [oldest, unused] = this.cache.entries().next().value;
        unused.close();
        this.cache.delete(oldest);
      }
    } catch {
      if (this.wanted.has(key)) this.failed.add(key);
    } finally {
      this.pending.delete(key);
      this.pump();
    }
  }
}
