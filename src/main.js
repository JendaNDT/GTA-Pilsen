import * as THREE from 'three';
import { loadAll } from './data.js';
import { World } from './world/world.js';
import { ChunkManager } from './world/chunks.js';
import { Environment } from './world/scene.js';
import { makeDecalMaterial, makeWaterMaterial, env } from './world/materials.js';
import { QUALITY, PARAMS } from './config.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, QUALITY.view * 1.3);

(async () => {
  const data = await loadAll((p) => { document.querySelector('#bar i').style.width = `${p * 100}%`; });
  const t0 = performance.now();
  const world = new World(data);
  console.log('world init ms', performance.now() - t0, 'nodes', world.nodeCount, 'edges', world.edgeCount);
  const decal = makeDecalMaterial(), water = makeWaterMaterial();
  const environment = new Environment(scene, world, decal, water);
  const chunks = new ChunkManager(scene, world, decal);
  const cx = +(PARAMS.get('x') || 0), cz = +(PARAMS.get('z') || 0), cy = +(PARAMS.get('y') || 120);
  const tx = +(PARAMS.get('tx') || 0), tz = +(PARAMS.get('tz') || 0), ty = +(PARAMS.get('ty') || 0);
  camera.position.set(cx, cy, cz);
  camera.lookAt(tx, ty, tz);
  environment.setHour(+(PARAMS.get('hour') || 10));
  const t1 = performance.now();
  while (chunks.update(tx, tz, QUALITY.view, 8) > 0);
  console.log('chunks ms', performance.now() - t1, chunks.chunks.size);
  document.getElementById('menu').classList.add('hidden');
  window.__ready = true;
  const loop = () => {
    env.time.value = performance.now() / 1000;
    environment.update(camera);
    renderer.render(scene, camera);
    window.__info = renderer.info.render;
    requestAnimationFrame(loop);
  };
  loop();
})().catch((e) => { console.error(e); document.getElementById('loadtext').textContent = 'Chyba: ' + e.message; });
