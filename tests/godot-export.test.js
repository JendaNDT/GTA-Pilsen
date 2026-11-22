// Převod mapy do Godotu: binární formát hodnot a rastrování povrchu.
import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeVariant, Vec3Array, ColorArray } from '../tools/godot/godot-variant.mjs';
import { fillRings, strokeLine } from '../tools/godot/raster.mjs';

// Očekávané bajty vytvořil Godot 4.7.2 funkcí var_to_bytes().
const GODOT = [
  [{ a: 1 }, '1b000000010000000400000001000000610000000200000001000000'],
  [[1, 2.5], '1c0000000200000002000000010000000300000000002040'],
  [3000000000, '02000100005ed0b200000000'],
  [0.1, '030001009a9999999999b93f'],
  ['Plzeň', '0400000006000000506c7a65c5880000'],
  [new Uint8Array([1, 2, 3]), '1d0000000300000001020300'],
  [new Int32Array([1, -2]), '1e0000000200000001000000feffffff'],
  [new Float32Array([1.5]), '20000000010000000000c03f'],
  [new Vec3Array([1, 2, 3]), '24000000010000000000803f0000004000004040'],
  [new ColorArray([1, 0, 0]), '25000000010000000000803f00000000000000000000803f'],
  [true, '0100000001000000'],
  [null, '00000000'],
];

test('kodér zapisuje hodnoty stejně jako var_to_bytes() v Godotu 4.7', () => {
  for (const [value, hex] of GODOT) assert.equal(encodeVariant(value).toString('hex'), hex, JSON.stringify(value));
});

test('16bitová pole se ukládají jako bajty se zarovnáním na 4', () => {
  assert.equal(encodeVariant(new Int16Array([-1])).toString('hex'), '1d00000002000000ffff0000');
});

test('rastrování vyplní čtverec a vynechá díru podle pravidla sudá–lichá', () => {
  const W = 10, px = new Uint8Array(W * W);
  fillRings(px, W, W, [[1, 1, 9, 1, 9, 9, 1, 9], [3, 3, 7, 3, 7, 7, 3, 7]], 5);
  assert.equal(px[2 * W + 2], 5);
  assert.equal(px[5 * W + 5], 0, 'díra zůstane prázdná');
  assert.equal(px[0], 0);
  strokeLine(px, W, W, [0, 0.5, 10, 0.5], 1, 7);
  assert.equal(px[3], 7);
  assert.equal(px[W + 3], 5, 'tah nepřesáhne svou šířku');
});
