// Detail průčelí patří pouze k přesné verzi dlaždice měřených budov.
import { assetFingerprint, parsePack } from '../data.js';

export function applyFronts(section, name, hash, count, previous = null, entrances = null) {
  const tile = section.header.tiles.find(entry => entry.name === name);
  if (!tile || tile.hash !== hash || !Number.isSafeInteger(tile.start) || !Number.isSafeInteger(tile.count) ||
      tile.start < 0 || tile.count <= 0 || tile.start + tile.count > section.vertex.length ||
      section.front.length !== section.vertex.length * 4) return previous;
  const indices = section.vertex.subarray(tile.start, tile.start + tile.count);
  if (!indices.every(index => index < count)) return previous;
  const attribute = previous ?? new Float32Array(count * 4);
  for (let i = 0; i < indices.length; i++) {
    const offset = (tile.start + i) * 4;
    if (entrances) entrances[indices[i]] = section.entrance?.[tile.start + i] ?? 0;
    attribute.set(section.front.subarray(offset, offset + 4), indices[i] * 4);
  }
  return attribute;
}

export class StreetDetails {
  constructor(manifest) {
    this.tiles = new Map();
    this.cache = new Map();
    for (const section of manifest.sections) {
      for (const tile of section.tiles) {
        if (!this.tiles.has(tile)) this.tiles.set(tile, []);
        this.tiles.get(tile).push(section);
      }
    }
  }

  async load(section) {
    const response = await fetch((import.meta.env?.BASE_URL || '/') + 'detail/streets/' + section.name,
      {signal: AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('Chybí úsek ' + section.id);
    const bytes = await response.arrayBuffer();
    if (assetFingerprint(bytes) !== section.hash) throw Error('Odlišný otisk úseku ' + section.id);
    const pack = parsePack(bytes);
    if (pack.header.version !== 1 || !Array.isArray(pack.header.tiles) ||
        !(pack.vertex instanceof Uint32Array) || !(pack.front instanceof Float32Array) ||
        (pack.entrance && (!(pack.entrance instanceof Float32Array) || pack.entrance.length !== pack.vertex.length ||
          !pack.entrance.every(v => Number.isFinite(v) && v >= 0))) || !pack.front.every(Number.isFinite)) throw Error('Neplatná data úseku ' + section.id);
    return pack;
  }

  async forTile(name, hash, count, scenery, entrances) {
    let attribute = null;
    for (const section of this.tiles.get(name) ?? []) {
      if (!this.cache.has(section.id)) {
        this.cache.set(section.id, this.load(section).catch(() => {
          this.cache.delete(section.id);
          return null;
        }));
      }
      const pack = await this.cache.get(section.id);
      if (pack) {
        const tile = pack.header.tiles.find(t => t.name === name && t.hash === hash);
        if (!tile) continue;
        const next = applyFronts(pack, name, hash, count, attribute, entrances);
        if (next && scenery) scenery.push({ id: section.id + '/' + name,
          items: tile.furniture ?? [], paving: tile.paving ?? [] });
        attribute = next;
      }
    }
    return attribute;
  }
}
