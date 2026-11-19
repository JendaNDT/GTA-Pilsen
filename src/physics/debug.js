import * as THREE from 'three/webgpu';

export class CollisionView {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.tiles = new Map();
    this.material = new THREE.MeshBasicMaterial({ color: 0x43ecca, wireframe: true, depthTest: false });
    addEventListener('keydown', (e) => {
      if (e.code === 'F8' && !e.repeat) {
        e.preventDefault();
        this.group.visible = !this.group.visible;
      }
    });
  }

  add(ci, positions) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.renderOrder = 100;
    if (!this.tiles.has(ci)) this.tiles.set(ci, []);
    this.tiles.get(ci).push(mesh);
    this.group.add(mesh);
    return mesh;
  }

  discard(ci, mesh) {
    const meshes = this.tiles.get(ci);
    if (!mesh || !meshes) return;
    const index = meshes.indexOf(mesh);
    if (index >= 0) meshes.splice(index, 1);
    mesh.removeFromParent();
    mesh.geometry.dispose();
  }

  remove(ci) {
    for (const mesh of this.tiles.get(ci)) {
      this.group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.tiles.delete(ci);
  }
}
