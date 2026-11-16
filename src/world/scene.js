// Obloha, světla, stíny a denní doba. (Terén a povrch země kreslí chunks.js.)
import * as THREE from 'three';
import { QUALITY } from '../config.js';
import { env, getPoolMaterial } from './materials.js';

export const GROUND_HEX = 0x9aa873;

function makeSky() {
  const geo = new THREE.SphereGeometry(1, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    defines: { OCT: QUALITY.clouds },
    uniforms: {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
      cloudCol: { value: new THREE.Color() }, cloudShade: { value: new THREE.Color() },
      night: env.night, time: env.time,
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; vec4 p = modelViewMatrix * vec4(position, 0.0); gl_Position = projectionMatrix * vec4(p.xyz, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol;
      uniform vec3 cloudCol; uniform vec3 cloudShade; uniform float night; uniform float time;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < OCT; i++) { s += a * vn(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
      void main() {
        vec3 d = normalize(vDir);
        float t = pow(clamp(d.y, 0.0, 1.0), 0.5);
        vec3 col = mix(horizon, top, t);
        float s = max(dot(d, sunDir), 0.0);
        col += sunCol * (pow(s, 700.0) * 5.0 + pow(s, 14.0) * 0.22 + pow(s, 3.0) * 0.06);
        // hvězdy
        vec2 sp = floor(d.xz / (abs(d.y) + 0.4) * 180.0);
        float star = step(0.9975, h21(sp)) * night * smoothstep(0.05, 0.3, d.y);
        // mraky: vrstva ve výšce, promítnutá podle směru pohledu
        vec2 cp = d.xz / (d.y + 0.16) * 1.15 + vec2(time * 0.004, time * 0.0015);
        float c = fbm(cp);
        float cover = smoothstep(0.50, 0.74, c) * smoothstep(0.02, 0.22, d.y);
        float thick = smoothstep(0.55, 0.9, c);
        vec3 cc = mix(cloudCol, cloudShade, thick * 0.75) + sunCol * pow(s, 6.0) * 0.25;
        col = mix(col + vec3(star), cc, cover * 0.92);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

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
    if (elev < -0.02) dir.set(-0.4, 0.75, 0.3).normalize();        // měsíc
    const top = new THREE.Color(0x3a7fd0).lerp(new THREE.Color(0x050915), 1 - day);
    const hor = new THREE.Color(0xc3dcee).lerp(new THREE.Color(0xf0a060), dusk * 0.85).lerp(new THREE.Color(0x121a2c), 1 - day);
    const sunCol = new THREE.Color(0xfff4e0).lerp(new THREE.Color(0xff9a4a), dusk).multiplyScalar(elev > -0.05 ? 1 : 0.22);
    const u = this.sky.material.uniforms;
    u.top.value.copy(top); u.horizon.value.copy(hor); u.sunDir.value.copy(dir); u.sunCol.value.copy(sunCol);
    u.cloudCol.value.copy(new THREE.Color(0xffffff).lerp(new THREE.Color(0xffc089), dusk * 0.8).lerp(new THREE.Color(0x1b2338), 1 - day));
    u.cloudShade.value.copy(new THREE.Color(0xaab6c6).lerp(new THREE.Color(0x8f6f6a), dusk * 0.7).lerp(new THREE.Color(0x0c1120), 1 - day));
    this.scene.fog.color.copy(hor);
    env.sky.value.copy(hor);
    env.sunDir.value.copy(dir);

    this.sun.color.copy(new THREE.Color(0xfff0d8).lerp(new THREE.Color(0xffa05a), dusk)).lerp(new THREE.Color(0x9fb2e6), 1 - day);
    this.sun.intensity = 0.62 + 1.45 * day;
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
