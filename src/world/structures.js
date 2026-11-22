import { BufferAttribute, BufferGeometry, Color, Mesh } from 'three/webgpu';
import { loadStructureDetail } from '../data.js';

const concrete = new Color(0x938c82);

function geometry(positions) {
  const result = new BufferGeometry();
  result.setAttribute('position', new BufferAttribute(positions, 3));
  result.computeVertexNormals();
  const colors = new Float32Array(positions.length);
  for (let i = 0; i < colors.length; i += 3) concrete.toArray(colors, i);
  result.setAttribute('color', new BufferAttribute(colors, 3));
  return result;
}

export class Structures {
  constructor(layer, cols, rows) {
    this.tiles = new Map();
    this.positions = layer.positions;
    this.loading = 0;
    for (const tile of layer.index.tiles) {
      if (tile.cx >= cols || tile.cz >= rows) {
        this.tiles.clear();
        return;
      }
      this.tiles.set(tile.cz * cols + tile.cx, tile);
    }
  }

  positionsFor(ci) {
    const tile = this.tiles.get(ci);
    if (!tile) return null;
    const first = tile.objects[0], last = tile.objects.at(-1);
    return this.positions.subarray(first.start * 3, (last.start + last.count) * 3);
  }

  build(ci, parent, material) {
    const positions = this.positionsFor(ci);
    if (!positions) return null;
    const core = geometry(positions), mesh = new Mesh(core, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return { tile: this.tiles.get(ci), mesh, core, controller: null };
  }

  setNear(item, near, available = 2) {
    if (!near) {
      item.controller?.abort();
      item.controller = null;
      if (item.mesh.geometry !== item.core) {
        item.mesh.geometry.dispose();
        item.mesh.geometry = item.core;
      }
      return;
    }
    if (item.controller || this.loading >= available) return;
    const controller = new AbortController();
    item.controller = controller;
    this.loading++;
    loadStructureDetail(item.tile, controller.signal).then(positions => {
      if (item.controller === controller && positions) item.mesh.geometry = geometry(positions);
    }).finally(() => { this.loading--; });
  }

  dispose(item) {
    this.setNear(item, false);
    item.mesh.removeFromParent();
    item.core.dispose();
  }
}
