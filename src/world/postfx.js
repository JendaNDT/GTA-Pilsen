import * as THREE from 'three/webgpu';
import { convertToTexture, materialReference, mix, mrt, normalView, output, pass, renderOutput, vec4, velocity } from 'three/tsl';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { PARAMS, QUALITY } from '../config.js';
import { env } from './materials.js';

function buffers() {
  // Průhledné lampy a značky se přimíchají pouze do barvy. Normála a pohyb
  // mají odpovídat ploše, která zapsala do hloubky.
  const alpha = materialReference('depthWrite', 'bool').select(1, 0);
  const targets = mrt({ output, normal: vec4(normalView.mul(alpha), alpha), velocity: vec4(velocity.mul(alpha), 0, alpha) });
  const retainSurface = new THREE.BlendMode(THREE.NormalBlending);
  targets.setBlendMode('normal', retainSurface);
  targets.setBlendMode('velocity', retainSurface);
  return targets;
}

export class PostFX {
  constructor(renderer, scene, camera, independentBlending) {
    this.renderer = renderer;
    this.camera = camera;
    this.renderNumber = 0;
    this.scenePass = pass(scene, camera, { samples: 0 });
    this.scenePass.name = 'Obraz hry';
    this.oncePerDraw(this.scenePass);
    this.color = this.scenePass.getTextureNode();
    this.depth = this.scenePass.getTextureNode('depth');
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputColorTransform = false;
    this.effects = [];
    this.temporal = null;
    this.ambientOcclusion = null;
    this.glow = null;
    this.lastPosition = new THREE.Vector3();
    this.lastRotation = new THREE.Quaternion();
    this.hasPreviousCamera = false;

    let image = this.color;
    if (QUALITY.shadowCascades >= 3 && independentBlending) {
      this.scenePass.setMRT(buffers());
      this.normal = this.scenePass.getTextureNode('normal');
      this.velocity = this.scenePass.getTextureNode('velocity');
      let lit = this.color;
      if (PARAMS.get('ao') !== '0') {
        const occlusion = ao(this.depth, this.normal, camera);
        occlusion.resolutionScale = 0.5;
        occlusion.radius.value = 1.8;
        occlusion.thickness.value = 1.4;
        occlusion.samples.value = QUALITY.shadowCascades === 4 ? 16 : 12;
        occlusion.useTemporalFiltering = true;
        this.ambientOcclusion = occlusion;
        const indirect = mix(1, occlusion.getTextureNode().r, 0.55);
        lit = convertToTexture(vec4(this.color.rgb.mul(indirect), this.color.a));
        this.effects.push(occlusion, lit);
      }
      this.temporal = traa(lit, this.depth, this.velocity, camera);
      this.effects.push(this.temporal);
      image = this.temporal.getTextureNode();
    }

    if (QUALITY.shadowCascades > 0 && PARAMS.get('bloom') !== '0') {
      this.glow = bloom(image, mix(0.10, 0.48, env.night), 0.32, mix(1.60, 0.30, env.night));
      this.glow.smoothWidth.value = 0.14;
      this.effects.push(this.glow);
      image = vec4(image.rgb.add(this.glow.rgb), image.a);
    }

    const display = renderOutput(image);
    if (this.temporal) {
      this.pipeline.outputNode = display;
      this.antialias = 'traa';
    } else {
      const displayTexture = convertToTexture(display);
      this.effects.push(displayTexture);
      const smoothing = QUALITY.shadowCascades === 0 ? fxaa(displayTexture) : smaa(displayTexture);
      this.effects.push(smoothing);
      this.pipeline.outputNode = smoothing;
      this.antialias = QUALITY.shadowCascades === 0 ? 'fxaa' : 'smaa';
    }
    for (const effect of this.effects) this.oncePerDraw(effect);
  }

  oncePerDraw(node) {
    // Normála, barva a hloubka sdílejí jeden průchod. Samostatná volání
    // Game.render() musí mít čerstvý obraz i během stejné obnovy prohlížeče.
    node.updateBeforeType = THREE.NodeUpdateType.RENDER;
    const update = node.updateBefore.bind(node);
    let lastDraw = -1;
    node.updateBefore = (frame) => {
      if (lastDraw === this.renderNumber) return;
      lastDraw = this.renderNumber;
      update(frame);
    };
  }

  async prepare() {
    await this.scenePass.compileAsync(this.renderer);
  }

  resetHistory() {
    this.temporal?.setSize(1, 1);
    this.hasPreviousCamera = false;
  }

  render() {
    const { position, quaternion } = this.camera;
    if (this.temporal) {
      if (this.hasPreviousCamera && (position.distanceToSquared(this.lastPosition) > 25 ** 2
        || Math.abs(quaternion.dot(this.lastRotation)) < Math.cos(Math.PI / 8))) this.resetHistory();
      this.lastPosition.copy(position);
      this.lastRotation.copy(quaternion);
      this.hasPreviousCamera = true;
    }
    this.renderNumber++;
    this.pipeline.render();
  }

  dispose() {
    this.pipeline.dispose();
    for (const effect of this.effects) effect.dispose();
    this.scenePass.dispose();
  }
}

export function createPostFX(renderer, scene, camera) {
  if (PARAMS.get('postfx') === '0') return null;
  const webgpu = renderer.backend.isWebGPUBackend;
  const gl = webgpu ? null : renderer.backend.getContext();
  if (gl && !gl.getExtension('EXT_color_buffer_float')) return null;
  const independentBlending = webgpu ? !renderer.backend.compatibilityMode : Boolean(gl.getExtension('OES_draw_buffers_indexed'));
  return new PostFX(renderer, scene, camera, independentBlending);
}
