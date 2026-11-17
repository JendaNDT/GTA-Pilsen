// Obloha, světla, stíny a denní doba. (Terén a povrch země kreslí chunks.js.)
import * as THREE from 'three/webgpu';
import {
  Fn, float, Loop, mix, modelViewProjection, positionLocal, renderGroup, smoothstep, step, uniform, vec2, vec4,
} from 'three/tsl';
import { QUALITY, PARAMS } from '../config.js';
import { env, getPoolMaterial } from './materials.js';
import { hash21, valueNoise } from './material-noise.js';

export const GROUND_HEX = 0x9aa873;

function makeSky(colors) {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.MeshBasicNodeMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
  const clip = modelViewProjection;
  mat.vertexNode = vec4(clip.xy, clip.w, clip.w);
  mat.colorNode = Fn(() => {
    const d = positionLocal.normalize().toVar();
    const t = d.y.clamp(0, 1).sqrt();
    const sunlight = d.dot(env.sunDir).max(0).toVar();
    const glow = sunlight.pow(700).mul(5).add(sunlight.pow(14).mul(0.22), sunlight.pow(3).mul(0.06));
    const sky = mix(env.sky, colors.top, t).add(colors.sun.mul(glow));

    const starCell = d.xz.div(d.y.abs().add(0.4)).mul(180).floor();
    const star = step(0.9987, hash21(starCell)).mul(env.night, smoothstep(0.07, 0.35, d.y), 0.45);

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
    return vec4(mix(sky.add(star), cloudColor, cover), 1);
  })();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

const MOON_DIR = new THREE.Vector3(-0.4, 0.75, 0.3).normalize();
const _right = new THREE.Vector3(), _upv = new THREE.Vector3(), _tgt = new THREE.Vector3();

export class Environment {
  constructor(scene, world) {
    this.scene = scene;
    this.skyColors = {
      top: uniform(new THREE.Color()).setGroup(renderGroup),
      sun: uniform(new THREE.Color()).setGroup(renderGroup),
      cloud: uniform(new THREE.Color()).setGroup(renderGroup),
      shade: uniform(new THREE.Color()).setGroup(renderGroup),
    };
    this.sky = makeSky(this.skyColors);
    scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x777766, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.fog = new THREE.Fog(0xbcd9ee, QUALITY.view * 0.4, QUALITY.view);
    this.shadows = QUALITY.shadows;
    if (this.shadows) {
      const sh = this.sun.shadow;
      this.sun.castShadow = true;
      sh.mapSize.set(QUALITY.shadowSize, QUALITY.shadowSize);
      sh.camera.near = 10; sh.camera.far = 1400;
      sh.bias = -0.0006; sh.normalBias = 0.35;
      this.shadowR = 0;
    }

    // vzdálená zem za hranicí mapy (hluboko pod terénem)
    const half = 16000;
    const gg = new THREE.PlaneGeometry(half * 2, half * 2);
    gg.rotateX(-Math.PI / 2);
    gg.translate(0, -80, 0);
    this.groundMat = new THREE.MeshLambertMaterial({ color: GROUND_HEX });
    const ground = new THREE.Mesh(gg, this.groundMat);
    ground.frustumCulled = false;
    scene.add(ground);
    this.poolMat = getPoolMaterial();
    this.hour = 10;
    this.tint = new THREE.Color();
    this.sunDir = new THREE.Vector3(0, 1, 0);
    env.wetPaving.value = QUALITY.heritageDetail && PARAMS.get("wet") === "1" ? 1 : 0;
    this.setHour(this.hour);
  }

  /** Nastaví osvětlení podle hodiny (0–24). */
  setHour(h) {
    this.hour = h;
    const ang = ((h - 6) / 12) * Math.PI;           // 6:00 východ, 18:00 západ
    const elev = Math.sin(ang);
    const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.22);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.32) * (elev > -0.2 ? 1 : 0);
    const night = 1 - THREE.MathUtils.smoothstep(elev, -0.18, 0.08);
    env.night.value = night;

    const dir = this.sunDir.set(Math.cos(ang) * 0.75, Math.max(0.16, elev * 0.95), 0.5).normalize();
    dir.lerp(MOON_DIR, 1 - THREE.MathUtils.smoothstep(elev, -0.24, -0.035)).normalize();
    const hor = new THREE.Color(0xc3dcee).lerp(new THREE.Color(0xf0a060), dusk * 0.85).lerp(new THREE.Color(0x121a2c), 1 - day);
    const { top, sun, cloud, shade } = this.skyColors;
    top.value.setHex(0x3a7fd0).lerp(new THREE.Color(0x050915), 1 - day);
    sun.value.setHex(0xfff4e0).lerp(new THREE.Color(0xff9a4a), dusk).multiplyScalar(elev > -0.05 ? 1 : 0.22);
    cloud.value.setHex(0xffffff).lerp(new THREE.Color(0xffc089), dusk * 0.8).lerp(new THREE.Color(0x1b2338), 1 - day);
    shade.value.setHex(0xaab6c6).lerp(new THREE.Color(0x8f6f6a), dusk * 0.7).lerp(new THREE.Color(0x0c1120), 1 - day);
    this.scene.fog.color.copy(hor);
    env.sky.value.copy(hor);
    env.sunDir.value.copy(dir);

    this.sun.color.copy(new THREE.Color(0xfff0d8).lerp(new THREE.Color(0xffa05a), dusk)).lerp(new THREE.Color(0x9fb2e6), 1 - day);
    this.sun.intensity = 0.62 + 1.45 * day;
    this.sun.shadow.intensity = 0.43 + 0.48 * day * (1 - dusk * 0.50);
    this.hemi.color.copy(new THREE.Color(0xe2ebf7).lerp(new THREE.Color(0x6f83c0), 1 - day));
    this.hemi.groundColor.copy(new THREE.Color(0x9a927c).lerp(new THREE.Color(0x343a52), 1 - day));
    this.hemi.intensity = 0.95 + 0.6 * day;

    // světla lamp nejsou osvětlená scénou – sílí s nocí
    this.poolMat.visible = night > 0.03;
    this.day = day;
    this.night = night;
  }

  /** focus = bod, kolem kterého se počítají stíny (hráč). */
  update(cam, focus) {
    this.sky.position.copy(cam.position);
    this.sky.scale.setScalar(cam.far * 0.9);
    env.cam.value.copy(cam.position);
    const f = focus || cam.position;
    _tgt.set(f.x, f.y || 0, f.z);
    if (this.shadows && this.sun.castShadow) {
      // oblast stínů roste s výškou kamery; střed se přichytává na rastr, aby stíny neblikaly
      const sc = this.sun.shadow.camera;
      const R = Math.min(520, 150 + Math.max(0, cam.position.y - 12) * 1.6);
      const Rq = Math.ceil(R / 20) * 20;
      if (Rq !== this.shadowR) {
        this.shadowR = Rq;
        sc.left = -Rq; sc.right = Rq; sc.top = Rq; sc.bottom = -Rq;
        sc.updateProjectionMatrix();
      }
      const texel = (2 * Rq) / this.sun.shadow.mapSize.x;
      _right.set(0, 1, 0).cross(this.sunDir).normalize();
      _upv.copy(this.sunDir).cross(_right).normalize();
      const rx = _tgt.dot(_right), ry = _tgt.dot(_upv);
      _tgt.addScaledVector(_right, Math.round(rx / texel) * texel - rx).addScaledVector(_upv, Math.round(ry / texel) * texel - ry);
    }
    this.sun.position.copy(_tgt).addScaledVector(this.sunDir, 700);
    this.sun.target.position.copy(_tgt);
    this.sun.target.updateMatrixWorld();
  }

  setShadows(on) {
    if (!this.shadows) return;
    this.sun.castShadow = on;
  }
}
