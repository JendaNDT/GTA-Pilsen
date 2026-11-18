// Měřené městské dlaždice a vlastní model vodního hamru.
import * as THREE from 'three/webgpu';
import { CHUNK, QUALITY } from '../config.js';
import { loadCityTile } from '../data.js';
import { HeritageRoofs } from './heritage-geometry.js';
import { env, makeBuildingMaterial, makeMillraceMaterial, makeSurfaceMaterial } from './materials.js';
import { SURFACE } from './material-table.js';
import { FORGE, buildForge, forgeRoofHeight } from './mill.js';

export const DETAIL_REQUEST_LIMIT = QUALITY.groundTex === 256 ? 2 : 4;

function cityMesh(pack, prefix) {
  const src = pack[prefix + 'p'];
  if (!src?.length) return null;
  const { cx, cz } = pack.header;
  const points = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    points[i] = cx + src[i] * 0.02;
    points[i + 1] = src[i + 1] * 0.02;
    points[i + 2] = cz + src[i + 2] * 0.02;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(pack[prefix + 'n'], 3, true));
  geometry.setAttribute('color', new THREE.BufferAttribute(pack[prefix + 'c'], 3, true));
  if (!prefix) {
    const win = Float32Array.from(pack.win, (v, i) => i % 3 === 2 ? v : v / 32);
    geometry.setAttribute('aWin', new THREE.BufferAttribute(win, 3));
  }
  geometry.setIndex(new THREE.BufferAttribute(pack[prefix + 'i'], 1));
  return geometry;
}

export class Heritage {
  constructor(world, manifest) {
    this.world = world;
    world.heritage = this;
    this.cells = new Map();
    this.roofCells = new Map();
    this.replaced = new Set();
    this.buildingLists = new Map();
    this.fetching = 0;
    for (const [x, z, name, bounds, replacements] of manifest.tiles) {
      const ci = world.chunkIndex(x, z);
      if (ci >= 0) this.cells.set(ci, { name, x, z, bounds, replacements });
    }
    // Zastoupení budovy OSM a odpovídající zaměřené plochy mají stejného vlastníka i na hraně dlaždic.
    const moved = new Map();
    const override = (ci) => {
      if (!this.buildingLists.has(ci)) this.buildingLists.set(ci, new Set(world.bChunks[ci]));
      return this.buildingLists.get(ci);
    };
    for (const [ci, { replacements }] of this.cells) for (const i of replacements) {
      const old = world.chunkIndex((world.bMinX[i] + world.bMaxX[i]) / 2, (world.bMinZ[i] + world.bMaxZ[i]) / 2);
      if (old >= 0 && old !== ci) {
        override(old).delete(i);
        if (!moved.has(ci)) moved.set(ci, []);
        moved.get(ci).push(i);
      }
    }
    for (const [ci, buildings] of moved) {
      const group = override(ci);
      for (const i of buildings) group.add(i);
    }
    const forge = world.buildingAt(FORGE.x, FORGE.z);
    this.forgeIndex = forge;
    this.forgeWorking = false;
    this.forgeAngle = 0;
    if (forge >= 0) this.replaced.add(forge);
    this.forgeChunk = world.chunkIndex(FORGE.x, FORGE.z);
    this.close = makeBuildingMaterial({ textures: QUALITY.heritageDetail, heritage: true });
    this.far = makeSurfaceMaterial(SURFACE.timber, { vertexColors: true });
    this.cityClose = makeBuildingMaterial({ textures: QUALITY.heritageDetail, heritage: true });
    this.cityClose.side = THREE.DoubleSide;
    this.cityFar = makeSurfaceMaterial(SURFACE.plaster, { vertexColors: true, side: THREE.DoubleSide });
    this.water = makeMillraceMaterial(QUALITY.heritageDetail);
  }

  buildings(ci) {
    return this.buildingLists.get(ci) ?? this.world.bChunks[ci];
  }

  prefetch(candidates, otherRequests = 0) {
    const limit = DETAIL_REQUEST_LIMIT - otherRequests;
    if (this.fetching >= limit) return;
    candidates.sort((a, b) => a.dist - b.dist);
    for (const ch of candidates) {
      if (this.fetching >= limit) break;
      const controller = new AbortController();
      ch.cityRequest = controller;
      this.fetching++;
      const tile = this.cells.get(ch.ci);
      loadCityTile(tile.name, controller.signal).then((pack) => {
        if (controller.signal.aborted) return;
        const { version, cx, cz } = pack.header;
        const n = pack.p?.length;
        if (version === 1 && cx === tile.x && cz === tile.z && n && n % 3 === 0
            && pack.n?.length === n && pack.c?.length === n && pack.win?.length === n
            && pack.i?.length && pack.i.length % 3 === 0 && pack.roof?.length % 3 === 0) ch.cityData = pack;
      }).catch(() => {
        // Při chybě zůstane na místě původní zástavba. Znovu se zkusí při návratu do dlaždice.
      }).finally(() => {
        this.fetching--;
      });
    }
  }

  roofHeight(x, z) {
    if (Math.abs(x - FORGE.x) < 15 && Math.abs(z - FORGE.z) < 19) return forgeRoofHeight(this.world, this.forgeIndex, x, z);
    const indexes = this.roofCells.get(this.world.chunkIndex(x, z));
    let top = -Infinity;
    if (indexes) for (const roofs of indexes) top = Math.max(top, roofs.heightAt(x, z));
    return top;
  }

  build(ci, owner) {
    const entry = this.cells.get(ci);
    const city = !!(entry && owner.cityData);
    if (!city && ci !== this.forgeChunk) return null;
    const group = new THREE.Group();
    group.name = city ? 'Měřené budovy Plzně' : 'Vodní hamr Dobřív';
    const base = [], detail = [], wheels = [], night = [], roofChunks = [];
    let roofs = null;
    const add = (geo, mat, layer) => {
      if (!geo) return null;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = mat !== this.water;
      mesh.receiveShadow = true;
      group.add(mesh);
      if (layer) layer.push(mesh);
      owner.disposables.push(geo);
      return mesh;
    };
    if (city) {
      const pack = owner.cityData;
      const geometry = cityMesh(pack, '');
      add(geometry, this.cityClose, base);
      add(cityMesh(pack, 'd'), this.cityFar, detail);
      roofs = new HeritageRoofs();
      roofs.add({ p: geometry.attributes.position.array, indices: pack.roof }, 0);
      const [x0, z0, x1, z1] = entry.bounds;
      for (let z = Math.floor(z0 / CHUNK) * CHUNK; z <= z1; z += CHUNK) {
        for (let x = Math.floor(x0 / CHUNK) * CHUNK; x <= x1; x += CHUNK) {
          const key = this.world.chunkIndex(x, z);
          if (key < 0) continue;
          if (!this.roofCells.has(key)) this.roofCells.set(key, new Set());
          this.roofCells.get(key).add(roofs);
          roofChunks.push(key);
        }
      }
      for (const i of entry.replacements) this.replaced.add(i);
      owner.cityData = null;
    } else {
      buildForge(this.world, this.forgeIndex, this.close, this.far, this.water, add, { base, detail, wheels, night, group, disposables: owner.disposables });
    }
    owner.group.add(group);
    const x = city ? entry.x : FORGE.x, z = city ? entry.z : FORGE.z;
    return { group, base, detail, wheels, night, city, roofs, roofChunks, x, z, y: this.world.heightAt(x, z) };
  }

  dispose(ch) {
    ch.cityRequest?.abort();
    if (!ch.heritage?.city) return;
    for (const key of ch.heritage.roofChunks) {
      const cell = this.roofCells.get(key);
      cell.delete(ch.heritage.roofs);
      if (!cell.size) this.roofCells.delete(key);
    }
    for (const i of this.cells.get(ch.ci).replacements) this.replaced.delete(i);
  }

  updateForge(hour, dt) {
    this.forgeWorking = this.forgeIndex >= 0 && hour >= 9 && hour < 17;
    if (this.forgeWorking) this.forgeAngle = (this.forgeAngle + dt * 0.72) % (Math.PI * 2);
  }

  update(chunk, x, z, y = chunk.y) {
    const distance = Math.hypot(Math.max(0, Math.abs(chunk.x - x) - (chunk.city ? CHUNK * 0.5 : 0)),
      Math.max(0, Math.abs(chunk.z - z) - (chunk.city ? CHUNK * 0.5 : 0)), chunk.y - y);
    const near = distance < (QUALITY.heritageDetail ? 260 : 175);
    const mat = chunk.city ? (near ? this.cityClose : this.cityFar) : (near ? this.close : this.far);
    for (const mesh of chunk.base) {
      mesh.material = mat;
      if (chunk.city) mesh.castShadow = distance < 560;
    }
    for (const mesh of chunk.detail) mesh.visible = near;
    for (const wheel of chunk.wheels) {
      wheel.visible = near;
      if (near) wheel.rotation.x = this.forgeAngle;
    }
    for (const mesh of chunk.night) mesh.visible = near && env.night.value > 0.18;
  }
}

// Dlažba jako součást stejné plochy terénu, bez kolizní hrany.
export function pavingChunk(x, z) {
  if (x < 75 && x + CHUNK > -66 && z < 68 && z + CHUNK > -60) return 1;
  if (x < FORGE.x + 19 && x + CHUNK > FORGE.x - 24 && z < FORGE.z + 45 && z + CHUNK > FORGE.z) return 2;
  return 0;
}
