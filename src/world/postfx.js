import * as THREE from 'three/webgpu';
import { Fn, If, float, uniform, int, smoothstep, convertToTexture, materialReference, mix, mrt, normalView, output, pass, renderOutput, texture3D, vec3, vec4, velocity } from 'three/tsl';
import { godrays } from 'three/addons/tsl/display/GodraysNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import { motionBlur } from 'three/addons/tsl/display/MotionBlur.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { lut3D } from 'three/addons/tsl/display/Lut3DNode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { sharpen } from 'three/addons/tsl/display/SharpenNode.js';
import { PARAMS, QUALITY } from '../config.js';
import { env } from './materials.js';
import { blendLutData, loadColorLuts, lutTexture } from './color-luts.js';
import { makeAirPerspective } from './air-perspective.js';
import { EyeAdaptation } from './exposure.js';
import { temporalSharpness } from './image-quality.js';

function buffers(waterReflections) {
  // Průhledné lampy a značky se přimíchají pouze do barvy. Normála a pohyb
  // mají odpovídat ploše, která zapsala do hloubky.
  const alpha = materialReference('depthWrite', 'bool').select(1, 0);
  const water = waterReflections ? Fn(builder => builder.material.waterField
    ? smoothstep(0.35, 0.65, materialReference('map', 'texture').a).oneMinus() : float(0))() : 0;
  const targets = mrt({ output, normal: vec4(normalView.mul(alpha), alpha), velocity: vec4(velocity.mul(alpha), water, alpha) });
  const retainSurface = new THREE.BlendMode(THREE.NormalBlending);
  targets.setBlendMode('normal', retainSurface);
  targets.setBlendMode('velocity', retainSurface);
  return targets;
}

export class PostFX {
  constructor(renderer, scene, camera, world, independentBlending, environment) {
    this.renderer = renderer;
    this.camera = camera;
    this.renderNumber = 0;
    this.motion = uniform(false, 'bool');
    this.photoFocus = uniform(32);
    this.environment = environment;
    this.scene = scene;
    this.scenePass = pass(scene, camera, { samples: 0 });
    this.scenePass.name = 'Obraz hry';
    this.oncePerDraw(this.scenePass);
    this.color = this.scenePass.getTextureNode();
    this.exposure = QUALITY.shadowCascades > 0 && PARAMS.get('exposure') !== '0' ? new EyeAdaptation(renderer, this.color) : null;
    this.depth = this.scenePass.getTextureNode('depth');
    this.pipeline = new THREE.RenderPipeline(renderer);
    this.pipeline.outputColorTransform = false;
    this.effects = [];
    this.temporal = null;
    this.ambientOcclusion = null;
    this.glow = null;
    this.luts = [];
    this.grade = null;
    this.lastGrade = new THREE.Vector3(-1, -1, -1);
    this.air = PARAMS.get('fog') !== '0' ? makeAirPerspective(camera, world, QUALITY.view) : null;
    if (this.air) scene.fog = null;
    this.lastPosition = new THREE.Vector3();
    this.lastRotation = new THREE.Quaternion();
    this.hasPreviousCamera = false;

    let image = this.color;
    if (QUALITY.shadowCascades >= 3 && independentBlending) {
      const reflectWater = QUALITY.name === 'ultra' && PARAMS.get('ssr') !== '0';
      this.scenePass.setMRT(buffers(reflectWater));
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
        lit = vec4(this.color.rgb.mul(indirect), this.color.a);
        this.effects.push(occlusion);
      }
      if (reflectWater) {
        const mask = this.velocity.b;
        const reflection = ssr(this.color, this.depth, this.normal, {camera, metalnessNode: mask});
        reflection.resolutionScale = 0.5;
        reflection.maxDistance.value = 85;
        reflection.thickness.value = 0.8;
        reflection.intensity.value = 0.55;
        this.waterReflection = reflection;
        this.effects.push(reflection);
        lit = vec4(lit.rgb.add(reflection.rgb.mul(mask)), lit.a);
      }
      if (this.air) lit = this.air.color(lit, this.depth);
      if (lit !== this.color) {
        lit = convertToTexture(lit);
        this.effects.push(lit);
      }
      this.temporal = traa(lit, this.depth, this.velocity, camera);
      this.effects.push(this.temporal);
      const resolved = this.temporal.getTextureNode();
      image = Fn(() => {
        const color = resolved.toVar();
        If(this.motion, () => {
          color.assign(motionBlur(resolved, this.velocity.xy.mul(.55), int(7)));
        });
        return color;
      })();
    } else if (this.air) {
      image = this.air.color(image, this.depth);
    }

    if (QUALITY.shadowCascades > 0 && PARAMS.get('bloom') !== '0') {
      this.glow = bloom(image, mix(0.10, 0.48, env.night), 0.32, mix(1.60, 0.30, env.night));
      this.glow.smoothWidth.value = 0.14;
      this.effects.push(this.glow);
      image = vec4(image.rgb.add(this.glow.rgb), image.a);
    }

    // Při jízdě vrhá objemový průchod přes auto ostré pásy. Zapíná se jen pro srovnávací snímek.
    if (QUALITY.name === 'ultra' && environment?.csm && PARAMS.get('rays') === '1') {
      this.rayLight = new THREE.DirectionalLight();
      const rays = godrays(this.depth, camera, this.rayLight);
      rays.raymarchSteps.value = 20;
      rays.resolutionScale = .25;
      rays.density.value = .025;
      rays.maxDensity.value = .28;
      this.effects.push(rays);
      this.rays = rays;
      image = vec4(image.rgb.add(vec3(.55,.38,.19).mul(rays.r, env.night.oneMinus())), image.a);
    }
    const toneMapping = PARAMS.get('tone') === 'agx' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
    this.toned = renderOutput(image, toneMapping, THREE.LinearSRGBColorSpace);
    for (const effect of this.effects) this.oncePerDraw(effect);
  }

  setupDisplay(color) {
    const display = renderOutput(color, THREE.NoToneMapping, THREE.SRGBColorSpace);
    if (this.temporal) {
      // Časové vyhlazení skládá snímky přes sebe a za jízdy obraz změkčí; doostření vrací kresbu
      // textur. Vypne ho ?ostreni=0 (a ?obraz=puvodni).
      const sharpness = PARAMS.get('ostreni') === '0' ? null : temporalSharpness();
      if (sharpness === null) this.pipeline.outputNode = display;
      else {
        const displayTexture = convertToTexture(display);
        const sharpened = sharpen(displayTexture, sharpness);
        this.effects.push(displayTexture, sharpened);
        this.oncePerDraw(displayTexture);
        this.oncePerDraw(sharpened);
        this.sharpen = sharpened;
        this.pipeline.outputNode = sharpened;
      }
      this.antialias = 'traa';
    } else {
      const displayTexture = convertToTexture(display);
      this.effects.push(displayTexture);
      const smoothing = QUALITY.shadowCascades === 0 ? fxaa(displayTexture) : smaa(displayTexture);
      this.effects.push(smoothing);
      this.oncePerDraw(displayTexture);
      this.oncePerDraw(smoothing);
      this.pipeline.outputNode = smoothing;
      this.antialias = QUALITY.shadowCascades === 0 ? 'fxaa' : 'smaa';
    }
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
    let color = this.toned;
    if (PARAMS.get('lut') !== '0') {
      try {
        this.luts = await loadColorLuts(import.meta.env.BASE_URL);
        const { size, data } = this.luts[0];
        this.grade = lutTexture(new Uint8Array(data.length), size);
        this.updateGrade();
        color = lut3D(this.toned, texture3D(this.grade), size, 1);
      } catch (error) {
        console.warn('Barevné ladění se nepodařilo načíst.', error);
      }
    }
    this.displayColor = color;
    this.setupDisplay(color);
    await this.scenePass.compileAsync(this.renderer);
    if (this.rayLight) {
      // Mapa stínu vzniká při prvním osvětlení scény. Paprsky sdílejí nejvzdálenější kaskádu.
      this.renderer.render(this.scene, this.camera);
      const cascade = this.environment.csm.lights.at(-1);
      if (cascade) {
        this.rayLight.shadow = cascade.shadow;
        this.rayLight.matrixWorld = cascade.matrixWorld;
      }
    }
  }

  setPhoto(active) {
    if (!active) {
      this.photoPipeline?.dispose();
      this.photoDOF?.dispose();
      this.photoInput?.dispose();
      this.photoPipeline = this.photoDOF = this.photoInput = null;
      this.resetHistory();
      return;
    }
    if (this.photoPipeline) return;
    this.photoInput = convertToTexture(this.displayColor);
    this.photoDOF = dof(this.photoInput, this.scenePass.getViewZNode(), this.photoFocus, .07, 3);
    this.photoPipeline = new THREE.RenderPipeline(this.renderer);
    this.photoPipeline.outputColorTransform = false;
    this.photoPipeline.outputNode = renderOutput(this.photoDOF, THREE.NoToneMapping, THREE.SRGBColorSpace);
    this.oncePerDraw(this.photoInput);
    this.oncePerDraw(this.photoDOF);
  }

  resetHistory() {
    this.temporal?.setSize(1, 1);
    this.hasPreviousCamera = false;
  }

  updateGrade() {
    const weights = env.colorGrade.value;
    if (!this.grade || this.lastGrade.equals(weights)) return;
    this.lastGrade.copy(weights);
    blendLutData(this.grade.image.data, this.luts.map(({ data }) => data), weights.toArray());
    this.grade.needsUpdate = true;
  }

  render() {
    this.updateGrade();
    const { position, quaternion } = this.camera;
    if (this.temporal) {
      if (this.hasPreviousCamera && (position.distanceToSquared(this.lastPosition) > 25 ** 2
        || Math.abs(quaternion.dot(this.lastRotation)) < Math.cos(Math.PI / 8))) this.resetHistory();
      this.lastPosition.copy(position);
      this.lastRotation.copy(quaternion);
      this.hasPreviousCamera = true;
    }
    this.renderNumber++;
    (this.photoPipeline ?? this.pipeline).render();
    this.exposure?.sample();
  }

  dispose() {
    this.setPhoto(false);
    this.pipeline.dispose();
    this.exposure?.dispose();
    for (const effect of this.effects) effect.dispose();
    this.grade?.dispose();
    this.air?.field.dispose();
    this.scenePass.dispose();
  }
}

export function createPostFX(renderer, scene, camera, world, environment) {
  if (PARAMS.get('postfx') === '0') return null;
  const webgpu = renderer.backend.isWebGPUBackend;
  const gl = webgpu ? null : renderer.backend.getContext();
  if (gl && !gl.getExtension('EXT_color_buffer_float')) return null;
  const independentBlending = webgpu ? !renderer.backend.compatibilityMode : Boolean(gl.getExtension('OES_draw_buffers_indexed'));
  return new PostFX(renderer, scene, camera, world, independentBlending, environment);
}
