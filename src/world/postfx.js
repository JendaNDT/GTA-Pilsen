import * as THREE from 'three/webgpu';
import { convertToTexture, materialReference, mrt, normalView, output, pass, renderOutput, vec4, velocity } from 'three/tsl';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { PARAMS, QUALITY } from '../config.js';

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
    this.lastPosition = new THREE.Vector3();
    this.lastRotation = new THREE.Quaternion();
    this.hasPreviousCamera = false;

    if (QUALITY.shadowCascades >= 3 && independentBlending) {
      this.scenePass.setMRT(buffers());
      this.normal = this.scenePass.getTextureNode('normal');
      this.velocity = this.scenePass.getTextureNode('velocity');
      this.temporal = traa(this.color, this.depth, this.velocity, camera);
      this.effects.push(this.temporal);
      this.pipeline.outputNode = renderOutput(this.temporal);
      this.antialias = 'traa';
    } else {
      const display = convertToTexture(renderOutput(this.color));
      this.effects.push(display);
      const smoothing = QUALITY.shadowCascades === 0 ? fxaa(display) : smaa(display);
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
