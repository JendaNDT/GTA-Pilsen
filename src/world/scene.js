// Obloha, světla, stíny a denní doba. (Terén a povrch země kreslí chunks.js.)
import * as THREE from 'three/webgpu';
import { QUALITY, PARAMS } from '../config.js';
import { env, getPoolMaterial } from './materials.js';

export const GROUND_HEX = 0x9aa873;

function makeSky() {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
  });
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
    this.sky = makeSky();
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
    this.sky.material.color.copy(hor);
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
    this.poolMat.opacity = night * 0.75;
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
