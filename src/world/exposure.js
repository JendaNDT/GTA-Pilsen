import { NodeMaterial, QuadMesh, RenderTarget } from 'three/webgpu';
import { Fn, float, luminance, vec2, vec4 } from 'three/tsl';

export function exposureTarget(brightness) {
  return Math.min(1.72, Math.max(0.66, Math.sqrt(0.29 / Math.max(brightness, 0.015))));
}

export function stepExposure(value, target, dt) {
  const seconds = target > value ? 1.25 : 0.52;
  return value + (target - value) * (1 - Math.exp(-dt / seconds));
}

export class EyeAdaptation {
  constructor(renderer, color) {
    this.renderer = renderer;
    this.target = new RenderTarget(1, 1, { depthBuffer: false });
    this.material = new NodeMaterial({ depthTest: false, depthWrite: false, toneMapped: false });
    this.material.fragmentNode = Fn(() => {
      const sum = float(0).toVar();
      for (const y of [0.2, 0.35, 0.5, 0.65, 0.8]) for (const x of [0.2, 0.35, 0.5, 0.65, 0.8]) {
        sum.addAssign(luminance(color.sample(vec2(x, y)).rgb).clamp(0, 2));
      }
      const mean = sum.div(25);
      return vec4(mean.div(mean.add(1)), 0, 0, 1);
    })();
    this.quad = new QuadMesh(this.material);
    this.quad.name = 'Měření jasu';
    this.value = 1;
    this.desired = 1;
    this.brightness = null;
    this.elapsed = 0;
    this.pending = false;
    this.disposed = false;
  }

  update(dt) {
    if (this.disposed) return;
    this.elapsed += dt;
    this.value = stepExposure(this.value, this.desired, dt);
    this.renderer.toneMappingExposure = this.value;
  }

  sample() {
    if (this.elapsed < 0.19 || this.pending || this.disposed) return;
    this.elapsed = 0;
    const renderer = this.renderer;
    const original = renderer.getRenderTarget(), face = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
    try {
      renderer.setRenderTarget(this.target);
      this.quad.render(renderer);
    } finally {
      renderer.setRenderTarget(original, face, mip);
    }
    this.pending = true;
    void renderer.readRenderTargetPixelsAsync(this.target, 0, 0, 1, 1).then((pixel) => {
      if (this.disposed) return;
      const encoded = pixel[0] / 255;
      this.brightness = encoded / Math.max(0.01, 1 - encoded);
      this.desired = exposureTarget(this.brightness);
    }).catch((error) => {
      if (!this.disposed) console.warn('Jas obrazu se nepodařilo odečíst.', error);
      this.dispose();
    }).finally(() => { this.pending = false; });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.toneMappingExposure = 1;
    this.target.dispose();
    this.material.dispose();
  }
}
