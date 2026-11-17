import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { patchShader } from '../src/world/shader-patches.js';

globalThis.matchMedia = () => ({ matches: false });
globalThis.window = {};
globalThis.location = { search: '?debug' };
const materials = await import('../src/world/materials.js');
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

test('všechny varianty materiálů najdou řetězce ve skutečném shaderu nainstalované knihovny', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const cases = [];
  for (const textures of [false, true]) for (const heritage of [false, true]) {
    cases.push([`budovy ${textures}/${heritage}`, materials.makeBuildingMaterial({ textures, heritage }), 'litWin']);
  }
  for (const normal of [false, true]) {
    cases.push([`země ${normal}`, materials.patchGroundMaterial(new THREE.MeshLambertMaterial(), normal), 'vGp']);
  }
  for (const detail of [false, true]) {
    cases.push([`náhon ${detail}`, materials.makeMillraceMaterial(detail), 'vFlow']);
    for (const paving of [0, 1, 2]) for (const count of [0, 1, 2]) {
      const portals = Array.from({ length: count }, (_, x) => ({ x, z: 0, dx: 1, dz: 0, y: 0, slope: 0.1, width: 6 }));
      cases.push([`terén ${detail}/${paving}/${count}`,
        materials.makeTerrainMaterial(new THREE.Texture(), portals, paving, detail), count ? 'uPortalAxis' : 'float land =']);
    }
  }
  cases.push(['vozidla', getDetailMaterial(), 'step(0.9, vColor.r)']);
  for (const [label, material, marker] of cases) {
    const shader = lambertShader();
    material.onBeforeCompile(shader);
    assert.ok(shader.fragmentShader.includes(marker), label);
    assert.equal(warning.mock.calls.length, 0, label);
    material.dispose();
    material.map?.dispose();
  }
});

test('ztracená část terénu ohlásí i navazující chybějící výřez portálu', (t) => {
  const warning = t.mock.method(console, 'warn', () => {});
  const mat = materials.makeTerrainMaterial(new THREE.Texture(), [
    { x: 0, z: 0, dx: 1, dz: 0, y: 0, slope: 0, width: 6 },
  ]);
  const shader = lambertShader();
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '');
  mat.onBeforeCompile(shader);
  const messages = warning.mock.calls.map(({ arguments: args }) => args[0]);
  assert.equal(messages.length, 2);
  assert.match(messages[0], /terén · barva.*<map_fragment>/);
  assert.match(messages[1], /portály tunelu · barva.*float land =/);
  mat.dispose();
  mat.map.dispose();
});
