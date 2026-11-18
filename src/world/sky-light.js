import * as THREE from 'three/webgpu';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { skyProbeDue } from './solar.js';

export class SkyLight {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.source = new THREE.CubeRenderTarget(32, { type: THREE.HalfFloatType, depthBuffer: false });
    this.cameras = new THREE.CubeCamera(0.1, 50, this.source);
    this.cameras.coordinateSystem = renderer.coordinateSystem;
    this.cameras.updateCoordinateSystem();
    this.sky = new SkyMesh();
    this.sky.cloudCoverage.value = 0;
    this.sky.showSunDisc.value = 0;
    this.sky.scale.setScalar(40);
    this.sky.frustumCulled = false;
    this.sky.material.depthTest = false;
    this.capture = new THREE.Scene();
    this.capture.add(this.sky);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.lastDirection = new THREE.Vector3();
    this.lastMinute = Infinity;
    this.capturedDirection = new THREE.Vector3();
    this.capturedMinute = 0;
    this.target = null;
    this.face = -1;
  }

  update(direction, minute) {
    if (this.face >= 0 && skyProbeDue(minute - this.capturedMinute, direction.dot(this.capturedDirection))) {
      this.face = -1;
    }
    if (this.face < 0) {
      if (!skyProbeDue(minute - this.lastMinute, direction.dot(this.lastDirection))) return;
      this.capturedDirection.copy(direction);
      this.capturedMinute = minute;
      this.sky.sunPosition.value.copy(direction).multiplyScalar(450000);
      this.face = 0;
    }
    if (this.face < 6) {
      const renderer = this.renderer;
      const target = renderer.getRenderTarget();
      const face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      try {
        renderer.setRenderTarget(this.source, this.face);
        renderer.render(this.capture, this.cameras.children[this.face]);
      } finally {
        renderer.setRenderTarget(target, face, mip);
      }
      this.face++;
      return;
    }
    // Celou mapu vystav až po vykreslení všech stran se stejnou polohou slunce.
    this.target = this.pmrem.fromCubemap(this.source.texture, this.target);
    this.scene.environment = this.target.texture;
    this.lastDirection.copy(this.capturedDirection);
    this.lastMinute = this.capturedMinute;
    this.face = -1;
  }

  dispose() {
    this.target?.dispose();
    this.source.dispose();
    this.pmrem.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
  }
}
