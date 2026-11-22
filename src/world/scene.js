import { windowSchedule } from './night-lights.js';
import { updateTreeSeason } from './vegetation.js';
// Obloha, světla, stíny a denní doba. (Terén a povrch země kreslí chunks.js.)
import { makeSunFlare } from './sun-flare.js';
import { CloudLayer, cloudShadow } from './cloud-layer.js';
import { cloudCover, weatherFog } from './weather-surfaces.js';
import * as THREE from 'three/webgpu';
import { CSMShadowNode } from 'three/addons/csm/CSMShadowNode.js';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import {
  Fn, If, float, Loop, mix, positionLocal, renderGroup, screenUV, smoothstep, step, uniform, vec2, vec4,
} from 'three/tsl';
import { QUALITY, PARAMS } from '../config.js';
import { env, getPoolMaterial, makeSurfaceMaterial, setFacadeEnvironment } from './materials.js';
import { SURFACE } from './material-table.js';
import { hash21, valueNoise } from './material-noise.js';
import { pragueOffset, solarDirection } from './solar.js';
import { SkyLight } from './sky-light.js';
import { lutWeights } from './color-luts.js';
import { daylight, pageLook } from './daylight.js';

const LOOK = pageLook();
const stopColor = new THREE.Color();

// Přechod barev z daylight(): první barva a dvojice [barva, podíl] míchané jako Color.lerp.
function blendStops(target, [first, ...stops]) {
  target.setHex(first);
  for (const [hex, amount] of stops) target.lerp(stopColor.setHex(hex), amount);
  return target;
}

export const GROUND_HEX = 0x9aa873;

const MOON_DIR = new THREE.Vector3(-0.4, 0.75, 0.3).normalize();
const DEFAULT_DAY = Date.UTC(2026, 10, 17) / 86400000;

function makeSky(colors, atmosphere, volume) {
  const mesh = new SkyMesh();
  mesh.cloudCoverage.value = 0;
  const mat = mesh.material;
  const scattering = mat.colorNode;
  // SkyMesh posílá oblohu do největší hloubky. Na nízké předvolbě už domy
  // a terén vyplnily hloubku, takže mraky počítáme jen pro viditelné pozadí.
  const skyLast = QUALITY.shadowCascades === 0;
  mat.depthTest = skyLast;
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

    const color = sky.add(star, moon).toVar();
    const procedural = () => {
      // Pod horizontem má procedurální vrstva nulové krytí i při zatažené obloze.
      If(d.y.greaterThan(.02), () => {
        // Vrstva mraků se promítá podle směru pohledu.
        const p = d.xz.div(d.y.add(0.16)).mul(1.15).add(vec2(env.time.mul(0.004), env.time.mul(0.0015))).toVar();
        const weight = float(0.5).toVar();
        const cloud = float(0).toVar();
        Loop(QUALITY.clouds, () => {
          cloud.addAssign(weight.mul(valueNoise(p)));
          p.assign(p.mul(2.03).add(17));
          weight.mulAssign(0.5);
        });
        const cover = smoothstep(0.50, 0.74, cloud.add(cloudCover.sub(.41).mul(.58))).mul(smoothstep(0.02, 0.22, d.y), 0.92);
        const thick = smoothstep(0.55, 0.9, cloud).mul(0.75);
        const cloudColor = mix(colors.cloud, colors.shade, thick).add(colors.sun.mul(sunlight.pow(6), 0.25));
        color.assign(mix(color, cloudColor, cover));
      });
    };
    if (volume) {
      If(volume.enabled, () => {
        const sample = volume.image.sample(screenUV).level(0);
        color.assign(mix(color, sample.rgb, sample.a));
      }).Else(procedural);
    } else {
      procedural();
    }
    return vec4(color, 1);
  })();
  mesh.renderOrder = skyLast ? 10 : -10;
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
    this.clouds = QUALITY.shadowCascades >= 3 && PARAMS.get('clouds') !== '0' ? new CloudLayer(renderer) : null;
    this.sky = makeSky(this.skyColors, atmosphere, this.clouds);
    this.skyLight = atmosphere ? new SkyLight(renderer, scene, { ground: LOOK === 'novy' }) : null;
    this.facadeEnvironment = null;
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
      sh.shadowNode = this.clouds ? cloudShadow(this.csm, this.clouds.enabled) : this.csm;
    }

    // vzdálená zem za hranicí mapy (hluboko pod terénem)
    const half = 16000;
    const gg = new THREE.PlaneGeometry(half * 2, half * 2);
    gg.rotateX(-Math.PI / 2);
    gg.translate(0, -80, 0);
    this.groundMat = makeSurfaceMaterial(SURFACE.soil, { color: GROUND_HEX });
    this.ground = new THREE.Mesh(gg, this.groundMat);
    this.ground.frustumCulled = false;
    scene.add(this.ground);
    this.poolMat = getPoolMaterial();
    this.hour = 10;
    this.tint = new THREE.Color();
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.setHour(this.hour);
  }

  /** Nastaví osvětlení podle hodiny (0–24) a případně změní datum. */
  setHour(h, date = this.date ?? DEFAULT_DAY) {
    this.hour = h;
    if (this.date !== date) this.utcOffset = pragueOffset(date);
    this.date = date;
    updateTreeSeason(date);
    env.windows.value.set(...windowSchedule(h), QUALITY.pointLights ? 1 : 0);
    const dir = this.sunDir.fromArray(solarDirection(date, h, this.utcOffset));
    const elev = dir.y;
    const day = THREE.MathUtils.smoothstep(elev, -0.16, 0.19);
    const dusk = 1 - THREE.MathUtils.smoothstep(Math.abs(elev + 0.025), 0.035, 0.24);
    const night = 1 - THREE.MathUtils.smoothstep(elev, -0.17, 0.04);
    env.night.value = night;
    env.colorGrade.value.fromArray(lutWeights(elev));
    env.morningFog.value = THREE.MathUtils.smoothstep(h, 4, 7) * (1 - THREE.MathUtils.smoothstep(h, 8, 10.5));

    const hor = new THREE.Color(0xc3dcee).lerp(new THREE.Color(0xf0a060), dusk * 0.85).lerp(new THREE.Color(0x121a2c), 1 - day);
    const { top, sun, cloud, shade } = this.skyColors;
    this.sky.sunPosition.value.copy(dir).multiplyScalar(450000);
    this.sky.showSunDisc.value = elev > -0.015 ? 1 : 0;
    this.skyColors.atmosphere.value = THREE.MathUtils.smoothstep(elev, -0.13, 0.02) * 0.58;
    top.value.setHex(0x3a7fd0).lerp(new THREE.Color(0x050915), 1 - day);
    sun.value.setHex(0xfff4e0).lerp(new THREE.Color(0xff9a4a), dusk).multiplyScalar(elev > -0.05 ? 1 : 0.22);
    cloud.value.setHex(0xffffff).lerp(new THREE.Color(0xffc089), dusk * 0.8).lerp(new THREE.Color(0x1b2338), 1 - day);
    shade.value.setHex(0xaab6c6).lerp(new THREE.Color(0x8f6f6a), dusk * 0.7).lerp(new THREE.Color(0x0c1120), 1 - day);
    const overcast = Math.max(0, cloudCover.value - .41);
    hor.lerp(new THREE.Color(day > .5 ? 0x9babb3 : 0x202733), overcast * .72);
    if (this.scene.fog) {
      this.scene.fog.color.copy(hor);
      this.scene.fog.near = QUALITY.view * .4 * (1 - .96 * weatherFog.value);
      this.scene.fog.far = QUALITY.view * (1 - .83 * weatherFog.value);
    }
    env.sky.value.copy(hor);
    env.sunDir.value.copy(dir);

    const light = daylight({ elevation: elev, day, dusk, overcast }, LOOK);
    blendStops(this.sun.color, light.sunColor);
    this.sun.intensity = light.sun;
    this.sun.position.copy(dir).multiplyScalar(700);
    this.moon.intensity = 0.62 * night;
    this.sun.shadow.intensity = light.shadow;
    for (const { shadow } of this.csm?.lights ?? []) {
      shadow.intensity = light.shadow;
      shadow.autoUpdate = this.sun.intensity > 0;
    }
    blendStops(this.hemi.color, light.hemiSky);
    blendStops(this.hemi.groundColor, light.hemiGround);
    this.hemi.intensity = light.hemi;
    this.scene.environmentIntensity = light.environment;
    this.facadeEnvironment = light.facadeEnvironment;
    if (this.skyLight?.ground) blendStops(this.skyLight.ground.value, light.groundRadiance.color).multiplyScalar(light.groundRadiance.scale);

    // světla lamp nejsou osvětlená scénou – sílí s nocí
    this.poolMat.visible = night > 0.03;
    this.day = day;
    this.night = night;
  }

  updateSkyLight() {
    if (!this.skyLight) return;
    try {
      this.skyLight.update(this.sunDir, this.date * 1440 + this.hour * 60);
      if (this.facadeEnvironment !== null && this.scene.environment) {
        setFacadeEnvironment(this.scene.environment, this.facadeEnvironment);
      }
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

  setFlare(enabled) {
    if (enabled && !this.flare) {
      this.flare = makeSunFlare();
      this.scene.add(this.flare);
    }
    this.showFlare = enabled;
    if (this.flare) this.flare.visible = enabled && this.sunDir.y > .02;
  }

  update(cam) {
    if (this.flare) {
      this.flare.visible = this.showFlare && this.sunDir.y > .02;
      this.flare.position.copy(cam.position).addScaledVector(this.sunDir, cam.far * .85);
    }
    this.sky.position.copy(cam.position);
    this.sky.scale.setScalar(cam.far * 0.9);
    env.cam.value.copy(cam.position);
  }

  dispose() {
    this.scene.remove(this.sky, this.hemi, this.sun, this.sun.target, this.moon, this.ground);
    this.scene.environment = null;
    if (this.flare) {
      this.flare.removeFromParent();
      this.flare.dispose();
    }
    this.clouds?.dispose();
    this.skyLight?.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.ground.geometry.dispose();
    this.groundMat.dispose();
    for (const { shadow } of this.csm?.lights ?? []) shadow.dispose();
    this.csm?.dispose();
    this.sun.shadow.dispose();
  }
}
