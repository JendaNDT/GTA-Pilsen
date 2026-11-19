import fs from 'node:fs';

export function writePack(file, fields, arrays) {
  const arrayInfo = {};
  const payload = [];
  let offset = 0;
  for (const [name, [dtype, array]] of Object.entries(arrays)) {
    const pad = (4 - offset % 4) % 4;
    if (pad) { payload.push(Buffer.alloc(pad)); offset += pad; }
    arrayInfo[name] = { dtype, offset, length: array.length };
    payload.push(Buffer.from(array.buffer, array.byteOffset, array.byteLength));
    offset += array.byteLength;
  }
  const header = Buffer.from(JSON.stringify({ ...fields, arrays: arrayInfo }));
  const length = (header.length + 3) & ~3;
  const prefix = Buffer.alloc(8 + length, 32);
  prefix.write('PLZ1');
  prefix.writeUInt32LE(length, 4);
  header.copy(prefix, 8);
  fs.writeFileSync(file, Buffer.concat([prefix, ...payload]));
}
