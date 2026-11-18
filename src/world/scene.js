// Obloha, světla, stíny a denní doba. (Terén a povrch země kreslí chunks.js.)
import * as THREE from 'three/webgpu';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import {
  Fn, float, Loop, mix, positionLocal, renderGroup, smoothstep, step, uniform, vec2, vec4,
} from 'three/tsl';
import { QUALITY, PARAMS } from '../config.js';
import { env, getPoolMaterial, makeSurfaceMaterial } from './materials.js';
import { SURFACE } from './material-table.js';
import { hash21, valueNoise } from './material-noise.js';
import { pragueOffset, solarDirection } from './solar.js';
import { SkyLight } from './sky-light.js';
import { lutWeights } from './color-luts.js';

export const GROUND_HEX = 0x9aa873;

const MOON_DIR = new THREE.Vector3(-0.4, 0.75, 0.3).normalize();
const DEFAULT_DAY = Date.UTC(2026, 10, 17) / 86400000;

function makeSky(colors, atmosphere) {
  const mesh = new SkyMesh();
  mesh.cloudCoverage.value = 0;
  const mat = mesh.material;
  const scattering = mat.colorNode;
  mat.depthTest = false;
  mat.colorNode = Fn(() => {
    const d = positionLocal.normalize().toVar();
    const t = d.y.clamp(0, 1).sqrt();
    const sunlight = d.dot(env.sunDir).max(0).toVar();
    const glow = sunlight.pow(700).mul(5).add(sunlight.pow(14).mul(0.22), sunlight.pow(3).mul(0.06));
    const gradient = mix(env.sky, colors.top, t).add(colors.sun.mul(glow));
    const sky = atmosphere
      ? mix(gradient, scattering.rgb.mul(0.82), colors.atmosphere.mul(smoothstep(-0.10, 0.10, d.y)))
      : gradient;

    const starCell = d.xz.div(d.y.abs().add(0.4)).mul(180).floor();
    const star = step(0.9987, hash21(starCell)).mul(env.night, smoothstep(0.07, 0.35, d.y), 0.45);
    const moon = smoothstep(0.99992, 0.99997, d.dot(MOON_DIR)).mul(env.night, 0.72);

    // Vrstva mraků se promítá podle směru pohledu.
    const p = d.xz.div(d.y.add(0.16)).mul(1.15).add(vec2(env.time.mul(0.004), env.time.mul(0.0015))).toVar();
    const weight = float(0.5).toVar();
    const cloud = float(0).toVar();
    Loop(QUALITY.clouds, () => {
      cloud.addAssign(weight.mul(valueNoise(p)));
      p.assign(p.mul(2.03).add(17));
      weight.mulAssign(0.5);
    });
    const cover = smoothstep(0.50, 0.74, cloud).mul(smoothstep(0.02, 0.22, d.y), 0.92);
    const thick = smoothstep(0.55, 0.9, cloud).mul(0.75);
    const cloudColor = mix(colors.cloud, colors.shade, thick).add(colors.sun.mul(sunlight.pow(6), 0.25));
    return vec4(mix(sky.add(star, moon), cloudColor, cover), 1);
  })();
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    const atmosphere = PARAMS.get('sky') !== '0';
    this.skyColors = {
      top: uniform(new THREE.Color()).setGroup(renderGroup),
      sun: uniform(new THREE.Color()).setGroup(renderGroup),
      cloud: uniform(new THREE.Color()).setGroup(renderGroup),
      shade: uniform(new THREE.Color()).setGroup(renderGroup),
      atmosphere: uniform(0).setGroup(renderGroup),
    };
    this.sky = makeSky(this.skyColors, atmosphere);
    this.skyLight = atmosphere ? new SkyLight(renderer, scene) : null;
    scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x777766, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.moon = new THREE.DirectionalLight(0x9fb2e6, 0);
    this.moon.position.copy(MOON_DIR);
    scene.add(this.moon);
    scene.fog = new THREE.Fog(0xbcd9ee, QUALITY.view * 0.4, QUALITY.view);
    this.shadows = QUALITY.shadows;
    this.csm = null;
    if (this.shadows) {
      const sh = this.sun.shadow;
      this.sun.castShadow = true;
      sh.mapSize.set(QUALITY.shadowSize, QUALITY.shadowSize);
      sh.camera.near = 1; sh.camera.far = QUALITY.shadowFar + 250;
      sh.bias = -0.00025; sh.normalBias = 0.16;
      this.csm = new CSMShadowNode(this.sun, { cascades: QUALITY.shadowCascades, maxFar: QUALITY.shadowFar, lightMargin: 170 });
      this.csm.fade = true;
      sh.shadowNode = this.csm;
    }

    // vzdálená zem za hranicí mapy (hluboko pod terénem)
    const half = 16000;
    const gg = new THREE.PlaneGeometry(half * 2, half * 2);
    gg.rotateX(-Math.PI / 2);
    gg.translate(0, -80, 0);
    this.groundMat = makeSurfaceMaterial(SURFACE.soil, { color: GROUND_HEX });
    const ground = new THREE.Mesh(gg, this.groundMat);
    ground.frustumCulled = false;
    scene.add(ground);
    this.poolMat = getPoolMaterial();
    this.hour = 10;
    this.tint = new THREE.Color();
    this.sunDir = new THREE.Vector3(0, 1, 0);
    env.wetPaving.value = QUALITY.heritageDetail && PARAMS.get("wet") === "1" ? 1 : 0;
    this.setHour(this.hour, DEFAULT_DAY);
  }

  /** Nastaví osvětlení podle hodiny (0–24). */
  setHour(h, date) {
    this.hour = h;
    if (this.date !== date) this.utcOffset = pragueOffset(date);
    this.date = date;
    const dir = this.sunDir.fromArray(solarDirection(date, h, this.utcOffset));
    const elev = dir.y;
    const day = THREE.MathUtils.smoothstep(elev, -0.16, 0.19);
    const dusk = 1 - THREE.MathUtils.smoothstep(Math.abs(elev + 0.025), 0.035, 0.24);
    const night = 1 - THREE.MathUtils.smoothstep(elev, -0.17, 0.04);
    env.night.value = night;
    env.colorGrade.value.fromArray(lutWeights(elev));

    const hor = new THREE.Color(0xc3dcee).lerp(new THREE.Color(0xf0a060), dusk * 0.85).lerp(new THREE.Color(0x121a2c), 1 - day);
    const { top, sun, cloud, shade } = this.skyColors;
    this.sky.sunPosition.value.copy(dir).multiplyScalar(450000);
    this.sky.showSunDisc.value = elev > -0.015 ? 1 : 0;
    this.skyColors.atmosphere.value = THREE.MathUtils.smoothstep(elev, -0.13, 0.02) * 0.58;
    top.value.setHex(0x3a7fd0).lerp(new THREE.Color(0x050915), 1 - day);
    sun.value.setHex(0xfff4e0).lerp(new THREE.Color(0xff9a4a), dusk).multiplyScalar(elev > -0.05 ? 1 : 0.22);
    cloud.value.setHex(0xffffff).lerp(new THREE.Color(0xffc089), dusk * 0.8).lerp(new THREE.Color(0x1b2338), 1 - day);
    shade.value.setHex(0xaab6c6).lerp(new THREE.Color(0x8f6f6a), dusk * 0.7).lerp(new THREE.Color(0x0c1120), 1 - day);
    this.scene.fog.color.copy(hor);
    env.sky.value.copy(hor);
    env.sunDir.value.copy(dir);

    this.sun.color.setHex(0xfff0d8).lerp(new THREE.Color(0xffa05a), dusk);
    this.sun.intensity = 1.85 * THREE.MathUtils.smoothstep(elev, -0.06, 0.19);
    this.sun.position.copy(dir).multiplyScalar(700);
    this.moon.intensity = 0.62 * night;
    const shadowIntensity = 0.43 + 0.48 * day * (1 - dusk * 0.50);
    this.sun.shadow.intensity = shadowIntensity;
    for (const { shadow } of this.csm?.lights ?? []) {
      shadow.intensity = shadowIntensity;
      shadow.autoUpdate = this.sun.intensity > 0;
    }
    this.hemi.color.copy(new THREE.Color(0xffe9d5).lerp(new THREE.Color(0x6f83c0), 1 - day));
    this.hemi.groundColor.copy(new THREE.Color(0x9a927c).lerp(new THREE.Color(0x343a52), 1 - day));
    this.hemi.intensity = 0.95 + 1.18 * day;
    this.scene.environmentIntensity = 0.22 * day;

    // světla lamp nejsou osvětlená scénou – sílí s nocí
    this.poolMat.visible = night > 0.03;
    this.day = day;
    this.night = night;
  }

  updateSkyLight() {
    if (!this.skyLight) return;
    try {
      this.skyLight.update(this.sunDir, this.date * 1440 + this.hour * 60);
    } catch (error) {
      this.scene.environment = null;
      this.skyLight.dispose();
      this.skyLight = null;
      console.warn('Světlo z oblohy se nepodařilo připravit.', error);
    }
  }

  async prepareSkyLight() {
    // První mapu světla dokonči ještě při načítání, před přípravou materiálů světa.
    while (this.skyLight && !this.scene.environment) {
      await new Promise(requestAnimationFrame);
      this.updateSkyLight();
    }
  }

  update(cam) {
    this.sky.position.copy(cam.position);
    this.sky.scale.setScalar(cam.far * 0.9);
    env.cam.value.copy(cam.position);
  }

  setShadows(on) {
    if (!this.shadows) return;
    this.sun.castShadow = on;
  }
}
