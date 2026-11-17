import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { patchShader } from '../src/world/shader-patches.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '?debug' };
const { getDetailMaterial } = await import('../src/entities/models.js');

function lambertShader() {
  return {
    uniforms: {},
    vertexShader: THREE.ShaderLib.lambert.vertexShader,
    fragmentShader: THREE.ShaderLib.lambert.fragmentShader,
  };
}

test('náhrady shaderu zachovají pořadí a mění jen první výskyt stejně jako String.replace', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  assert.equal(patchShader('první první', 'zkouška', [
    ['první', 'druhý'], ['druhý', 'třetí'],
  ], true), 'třetí první');
  assert.equal(warning.mock.calls.length, 0);
});

test('chybějící řetězec v debug režimu označí materiál a další náhrady přesto proběhnou', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  assert.equal(patchShader('původní', 'terén · barva', [
    ['chybí', 'nepoužito'], ['původní', 'nový'],
  ], true), 'nový');
  assert.equal(warning.mock.calls.length, 1);
  const message = warning.mock.calls[0].arguments[0];
  assert.match(message, /terén · barva/);
  assert.match(message, /nenalezen řetězec „chybí“/);
});

test('mimo debug režim zůstane chybějící náhrada bez hlášení', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  assert.equal(patchShader('původní', 'zkouška', [['chybí', 'nový']]), 'původní');
  assert.equal(warning.mock.calls.length, 0);
});

test('materiál světel vozidel najde řetězce ve skutečném shaderu nainstalované knihovny', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const material = getDetailMaterial();
  const shader = lambertShader();
  material.onBeforeCompile(shader);
  assert.ok(shader.fragmentShader.includes('step(0.9, vColor.r)'));
  assert.equal(warning.mock.calls.length, 0);
  material.dispose();
});
