// Zápis hodnot v binárním formátu Godotu 4 (stejný, jaký čte bytes_to_var()).
// Podporuje jen typy, které převod mapy potřebuje. Formát ověřuje test tests/godot-export.test.js.

const T = {
  NIL: 0, BOOL: 1, INT: 2, FLOAT: 3, STRING: 4, DICTIONARY: 27, ARRAY: 28,
  BYTES: 29, INT32: 30, FLOAT32: 32, VECTOR3: 36, COLOR: 37,
};
const FLAG_64 = 1 << 16;

/** Označí pole čísel, která se mají zapsat jako PackedVector3Array (trojice x, y, z). */
export class Vec3Array {
  constructor(values) { this.values = values; }
}

/** Barvy RGB (0–1) po trojicích, zapíší se jako PackedColorArray s alfou 1. */
export class ColorArray {
  constructor(values) { this.values = values; }
}

class Writer {
  constructor() { this.buf = Buffer.alloc(1 << 16); this.len = 0; }
  ensure(n) {
    if (this.len + n <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = Buffer.alloc(size);
    this.buf.copy(next, 0, 0, this.len);
    this.buf = next;
  }
  u32(v) { this.ensure(4); this.buf.writeUInt32LE(v >>> 0, this.len); this.len += 4; }
  i32(v) { this.ensure(4); this.buf.writeInt32LE(v, this.len); this.len += 4; }
  bytes(b) { this.ensure(b.length); Buffer.from(b.buffer, b.byteOffset, b.byteLength).copy(this.buf, this.len); this.len += b.length; }
  pad() { while (this.len % 4) { this.ensure(1); this.buf[this.len++] = 0; } }
  result() { return this.buf.subarray(0, this.len); }
}

function write(w, value) {
  if (value === null || value === undefined) { w.u32(T.NIL); return; }
  if (typeof value === 'boolean') { w.u32(T.BOOL); w.u32(value ? 1 : 0); return; }
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) { w.u32(T.INT); w.i32(value); return; }
    if (Number.isInteger(value)) {
      w.u32(T.INT | FLAG_64); w.ensure(8); w.buf.writeBigInt64LE(BigInt(value), w.len); w.len += 8; return;
    }
    // Godot ukládá číslo jako 32bitové, pokud se tím nezmění jeho hodnota.
    if (Math.fround(value) === value) { w.u32(T.FLOAT); w.ensure(4); w.buf.writeFloatLE(value, w.len); w.len += 4; return; }
    w.u32(T.FLOAT | FLAG_64); w.ensure(8); w.buf.writeDoubleLE(value, w.len); w.len += 8; return;
  }
  if (typeof value === 'string') {
    const b = Buffer.from(value, 'utf8');
    w.u32(T.STRING); w.u32(b.length); w.bytes(b); w.pad(); return;
  }
  if (value instanceof Vec3Array) {
    const f = Float32Array.from(value.values);
    if (f.length % 3) throw new Error('Vec3Array musí mít násobek tří hodnot');
    w.u32(T.VECTOR3); w.u32(f.length / 3); w.bytes(new Uint8Array(f.buffer)); return;
  }
  if (value instanceof ColorArray) {
    const v = value.values, n = v.length / 3;
    if (v.length % 3) throw new Error('ColorArray musí mít násobek tří hodnot');
    const f = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) { f[k * 4] = v[k * 3]; f[k * 4 + 1] = v[k * 3 + 1]; f[k * 4 + 2] = v[k * 3 + 2]; f[k * 4 + 3] = 1; }
    w.u32(T.COLOR); w.u32(n); w.bytes(new Uint8Array(f.buffer)); return;
  }
  if (value instanceof Uint8Array || value instanceof Int8Array || value instanceof Uint8ClampedArray) {
    w.u32(T.BYTES); w.u32(value.length); w.bytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)); w.pad(); return;
  }
  if (value instanceof Int16Array || value instanceof Uint16Array) {
    // Godot nemá 16bitové pole – ukládá se jako bajty a čte decode_s16 / decode_u16.
    w.u32(T.BYTES); w.u32(value.byteLength); w.bytes(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)); w.pad(); return;
  }
  if (value instanceof Int32Array || value instanceof Uint32Array) {
    const v = value instanceof Int32Array ? value : Int32Array.from(value);
    w.u32(T.INT32); w.u32(v.length); w.bytes(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)); return;
  }
  if (value instanceof Float32Array || value instanceof Float64Array) {
    const f = value instanceof Float32Array ? value : Float32Array.from(value);
    w.u32(T.FLOAT32); w.u32(f.length); w.bytes(new Uint8Array(f.buffer, f.byteOffset, f.byteLength)); return;
  }
  if (Array.isArray(value)) {
    w.u32(T.ARRAY); w.u32(value.length);
    for (const item of value) write(w, item);
    return;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    w.u32(T.DICTIONARY); w.u32(entries.length);
    for (const [k, v] of entries) { write(w, k); write(w, v); }
    return;
  }
  throw new Error('Nepodporovaný typ pro Godot: ' + typeof value);
}

/** Vrátí Buffer s hodnotou v binárním formátu Godotu. */
export function encodeVariant(value) {
  const w = new Writer();
  write(w, value);
  return Buffer.from(w.result());
}
