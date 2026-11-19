import * as THREE from 'three/webgpu';
import { attribute, cameraPosition, mix, positionGeometry, smoothstep, vec3 } from 'three/tsl';
import { CHUNK, LC } from '../config.js';
import { hash } from './hash.js';
import { env, makeSurfaceMaterial } from './materials.js';
import { SURFACE } from './material-table.js';

const CELL = 16,
  SIDE = 7;
const density = new Map([
  [LC.MEADOW, 1],
  [LC.GRASS, 0.74],
  [LC.PARK, 0.48]
]);
const pixels = new WeakMap();

function thumbnail(bitmap) {
  if (pixels.has(bitmap)) return pixels.get(bitmap);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, 128, 128);
  const image = ctx.getImageData(0, 0, 128, 128).data;
  pixels.set(bitmap, image);
  return image;
}
export function grassGreenness(red, green, blue) {
  return Math.max(0.2, Math.min(1, (green - red * 0.73 - blue * 0.18) / 55 + 0.38));
}
export function grassPatch(manager, cx, cz, bitmap) {
  const w = manager.world,
    x0 = cx * CELL,
    z0 = cz * CELL,
    result = [];
  // Dlaždice mají počátek nezávislý na mřížce porostu. Buňka může přesahovat na sousední.
  const vegetation = new Map();
  for (let j = 0; j < SIDE; j++)
    for (let i = 0; i < SIDE; i++) {
      const key = (cx * SIDE + i) * 8191 + cz * SIDE + j;
      const x = x0 + ((i + 0.15 + 0.7 * hash(key, 1)) * CELL) / SIDE,
        z = z0 + ((j + 0.15 + 0.7 * hash(key, 2)) * CELL) / SIDE;
      const ci = w.chunkIndex(x, z);
      if (ci < 0) continue;
      if (!vegetation.has(ci))
        vegetation.set(
          ci,
          (manager.landIndex.polys[ci] ?? []).filter((id) => density.has(w.l.cls[id]))
        );
      const area = vegetation.get(ci).findLast((id) => w.landContains(id, x, z));
      if (area === undefined || w.isWater(x, z) || w.buildingAt(x, z) >= 0) continue;
      let green = 1;
      const block = bitmap(x, z, ci);
      if (block) {
        const bx = Math.floor((x - w.minX) / (4 * CHUNK)),
          bz = Math.floor((z - w.minZ) / (4 * CHUNK));
        const px = Math.floor((x - w.minX - bx * 4 * CHUNK) / 8),
          pz = Math.floor((z - w.minZ - bz * 4 * CHUNK) / 8);
        const offset = (pz * 128 + px) * 4,
          rgb = thumbnail(block);
        green = grassGreenness(rgb[offset], rgb[offset + 1], rgb[offset + 2]);
      }
      if (hash(key, 3) > density.get(w.l.cls[area]) * green) continue;
      const y = w.heightAt(x, z);
      if (w.onCarriageway(x, z, y, 0.3, 99)) continue;
      result.push(x, y, z, 0.68 + 0.58 * hash(key, 4));
    }
  return result;
}

export class Grass {
  constructor(manager, radius) {
    this.manager = manager;
    this.radius = radius;
    this.cells = new Map();
    this.queue = [];
    this.center = '';
    const geo = new THREE.InstancedBufferGeometry();
    // Čtyři stébla trsu se sklánějí různými směry. Pata zůstává v zemi.
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          -0.15, 0, -0.05, -0.09, 0, -0.08, -0.23, 0.32, -0.13, 0.08, 0, 0.02, 0.14, 0, -0.01, 0.18, 0.26, 0.07,
          0, 0, 0.13, 0.05, 0, 0.14, 0.01, 0.38, 0.22, -0.02, 0, -0.14, 0.03, 0, -0.15, 0.05, 0.25, -0.23
        ],
        3
      )
    );
    geo.computeVertexNormals();
    const capacity = (2 * Math.ceil(radius / CELL) + 3) ** 2 * SIDE ** 2;
    this.roots = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(
      THREE.DynamicDrawUsage
    );
    geo.setAttribute('grassRoot', this.roots);
    geo.instanceCount = 0;
    const root = attribute('grassRoot', 'vec4'),
      local = positionGeometry,
      tip = local.y;
    const fade = smoothstep(radius - 6, radius, cameraPosition.sub(root.xyz).length()).oneMinus();
    const angle = root.w.mul(9),
      cs = angle.cos(),
      sn = angle.sin();
    const pos = vec3(local.x.mul(cs).add(local.z.mul(sn)), tip, local.z.mul(cs).sub(local.x.mul(sn)));
    const wave = root.x.mul(0.45).add(root.z.mul(0.31), env.time.mul(1.8)).sin().mul(tip.pow2());
    const material = makeSurfaceMaterial(SURFACE.grass, {
      side: THREE.DoubleSide,
      positionNode: root.xyz.add(pos.add(vec3(wave, 0, wave.mul(0.27))).mul(root.w, fade)),
      colorNode: mix(vec3(0.055, 0.103, 0.023), vec3(0.25, 0.38, 0.095), tip.mul(2.3).min(1))
    });
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.receiveShadow = true;
    manager.scene.add(this.mesh);
  }
  update(x, z, y, budget) {
    const manager = this.manager,
      w = manager.world;
    if (y !== undefined && y - w.heightAt(x, z) > this.radius) {
      this.mesh.visible = false;
      return;
    }
    const cx = Math.floor(x / CELL),
      cz = Math.floor(z / CELL),
      range = Math.ceil(this.radius / CELL);
    const marker = [cx, cz, manager.orthophotoEnabled, manager.orthophoto?.revision].join('/');
    let changed = false;
    if (marker !== this.center) {
      this.center = marker;
      const wanted = new Set(),
        queue = [];
      for (let b = cz - range; b <= cz + range; b++)
        for (let a = cx - range; a <= cx + range; a++) {
          const dx = a - cx,
            dz = b - cz;
          if (
            Math.hypot(Math.max(0, Math.abs(dx) - 1) * CELL, Math.max(0, Math.abs(dz) - 1) * CELL) > this.radius
          )
            continue;
          const key = a + ',' + b;
          wanted.add(key);
          const photos = [];
          for (const px of [a * CELL, (a + 1) * CELL - 0.001])
            for (const pz of [b * CELL, (b + 1) * CELL - 0.001]) photos.push(this.photo(px, pz));
          const old = this.cells.get(key);
          if (!old || photos.some((p, i) => p !== old.photos[i]))
            queue.push({ a, b, key, photos, priority: dx * dx + dz * dz });
        }
      for (const key of this.cells.keys())
        if (!wanted.has(key)) {
          this.cells.delete(key);
          changed = true;
        }
      this.queue = queue.sort((a, b) => a.priority - b.priority);
    }
    for (let n = 0; n < Math.min(4, budget) && this.queue.length; n++) {
      const cell = this.queue.shift();
      this.cells.set(cell.key, {
        photos: cell.photos,
        data: grassPatch(manager, cell.a, cell.b, (px, pz) => this.photo(px, pz))
      });
      changed = true;
    }
    if (changed) {
      let index = 0;
      for (const { data } of this.cells.values()) {
        this.roots.array.set(data, index);
        index += data.length;
      }
      this.roots.needsUpdate = true;
      this.mesh.geometry.instanceCount = index / 4;
    }
    this.mesh.visible = this.mesh.geometry.instanceCount > 0;
  }
  photo(x, z) {
    const m = this.manager,
      w = m.world;
    if (!m.orthophotoEnabled) return null;
    return (
      m.orthophoto?.cache.get(
        Math.floor((x - w.minX) / (4 * CHUNK)) + '_' + Math.floor((z - w.minZ) / (4 * CHUNK))
      ) ?? null
    );
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.material.dispose();
    this.mesh.geometry.dispose();
    this.cells.clear();
  }
}
