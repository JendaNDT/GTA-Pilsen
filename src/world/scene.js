// Statické části scény: obloha, světla, zem, plochy a voda + denní doba.
import * as THREE from 'three';
import { Earcut } from 'three/src/extras/Earcut.js';
import { LC, QUALITY } from '../config.js';
import { env, patchGroundMaterial, getPoolMaterial } from './materials.js';

const _c = new THREE.Color();
const lin = (hex) => { _c.setHex(hex); return [_c.r, _c.g, _c.b]; };

const LAND_COL = {
  [LC.FARMLAND]: lin(0xb5b47a), [LC.MEADOW]: lin(0x9bb36a), [LC.GRASS]: lin(0x8fb25e),
  [LC.RESIDENTIAL]: lin(0xa9a89d), [LC.COMMERCIAL]: lin(0xa9a6a3), [LC.INDUSTRIAL]: lin(0x9b9995),
  [LC.RAILWAY]: lin(0x857f76), [LC.ALLOTMENTS]: lin(0x8faa6a), [LC.CEMETERY]: lin(0x7f9f6a),
  [LC.FOREST]: lin(0x4e7a46), [LC.SCRUB]: lin(0x6f9353), [LC.PARK]: lin(0x86b560),
  [LC.PITCH]: lin(0x6fae62), [LC.PARKING]: lin(0x62656a), [LC.PLAZA]: lin(0xb7b0a2),
  [LC.WATER]: lin(0x3f7fa6), [LC.SAND]: lin(0xd9c998), [LC.CONSTRUCTION]: lin(0xa59a84),
  [LC.GARDEN]: lin(0x83ad62), [LC.PLAYGROUND]: lin(0xc9b98a),
};
const LAND_GROUP = {
  [LC.FARMLAND]: 0, [LC.MEADOW]: 0, [LC.RESIDENTIAL]: 0, [LC.COMMERCIAL]: 0, [LC.INDUSTRIAL]: 0,
  [LC.RAILWAY]: 0, [LC.CONSTRUCTION]: 0,
  [LC.FOREST]: 1, [LC.SCRUB]: 1, [LC.GRASS]: 1, [LC.PARK]: 1, [LC.ALLOTMENTS]: 1, [LC.CEMETERY]: 1, [LC.GARDEN]: 1,
  [LC.PITCH]: 2, [LC.PLAYGROUND]: 2, [LC.PARKING]: 2, [LC.PLAZA]: 2, [LC.SAND]: 2,
  [LC.WATER]: 3,
};
export const GROUND_HEX = 0x9aa873;

function pointInRing(x, z, L, v0, v1) {
  let inside = false;
  let j = v1 - 1;
  for (let v = v0; v < v1; j = v++) {
    const z1 = L.vz[j], z2 = L.vz[v];
    if ((z1 > z) !== (z2 > z) && x < (L.vx[v] - L.vx[j]) * (z - z1) / (z2 - z1) + L.vx[j]) inside = !inside;
  }
  return inside;
}

/** Trojúhelníky všech ploch, rozdělené do vrstev a čtverců kvůli ořezu pohledem. */
function buildLand(world, mats) {
  const L = world.l;
  const T = 4;
  const bufs = [];
  const get = (group, tile) => {
    const k = group * 100 + tile;
    return bufs[k] || (bufs[k] = { p: [], c: [], group });
  };
  const spanX = world.maxX - world.minX, spanZ = world.maxZ - world.minZ;
  for (let i = 0; i < world.lCount; i++) {
    const cls = L.cls[i];
    const group = LAND_GROUP[cls];
    if (group === undefined) continue;
    const r0 = L.pRing[i], r1 = L.pRing[i + 1];
    const nr = r1 - r0;
    // úroveň vnoření prstenců: sudá = obrys, lichá = díra
    const outers = [];
    if (nr === 1) outers.push({ rg: r0, holes: [] });
    else {
      const depth = new Array(nr).fill(0), parent = new Array(nr).fill(-1);
      for (let a = 0; a < nr; a++) {
        const va = L.ringStart[r0 + a];
        for (let b = 0; b < nr; b++) {
          if (a === b) continue;
          if (pointInRing(L.vx[va], L.vz[va], L, L.ringStart[r0 + b], L.ringStart[r0 + b + 1])) { depth[a]++; parent[a] = b; }
        }
      }
      const map = new Map();
      for (let a = 0; a < nr; a++) if (depth[a] % 2 === 0) { const o = { rg: r0 + a, holes: [] }; map.set(a, o); outers.push(o); }
      for (let a = 0; a < nr; a++) {
        if (depth[a] % 2 === 1) {
          // najdi obrys, který díru bezprostředně obsahuje
          let best = null;
          const va = L.ringStart[r0 + a];
          for (const [b, o] of map) {
            if (depth[b] === depth[a] - 1 && pointInRing(L.vx[va], L.vz[va], L, L.ringStart[r0 + b], L.ringStart[r0 + b + 1])) { best = o; break; }
          }
          if (best) best.holes.push(r0 + a);
        }
      }
    }
    const base = LAND_COL[cls];
    const s = Math.sin(i * 91.7) * 43758.5453;
    const k = 0.94 + (s - Math.floor(s)) * 0.12;
    const col = [base[0] * k * 255, base[1] * k * 255, base[2] * k * 255];
    for (const o of outers) {
      const flat = [], holes = [];
      let sx = 0, sz = 0, cnt = 0;
      for (const rg of [o.rg, ...o.holes]) {
        if (rg !== o.rg) holes.push(flat.length / 2);
        for (let v = L.ringStart[rg], ve = L.ringStart[rg + 1]; v < ve; v++) {
          const x = L.vx[v] * 0.1, z = L.vz[v] * 0.1;
          flat.push(x, z);
          if (rg === o.rg) { sx += x; sz += z; cnt++; }
        }
      }
      if (cnt < 3) continue;
      const tx = Math.min(T - 1, Math.max(0, Math.floor(((sx / cnt) - world.minX) / spanX * T)));
      const tz = Math.min(T - 1, Math.max(0, Math.floor(((sz / cnt) - world.minZ) / spanZ * T)));
      const buf = get(group, tz * T + tx);
      const tris = Earcut.triangulate(flat, holes, 2);
      for (let t = 0; t < tris.length; t += 3) {
        const a = tris[t] * 2;
        let b = tris[t + 1] * 2, c = tris[t + 2] * 2;
        // trojúhelník musí být přivrácený nahoru
        const ny = (flat[b + 1] - flat[a + 1]) * (flat[c] - flat[a]) - (flat[b] - flat[a]) * (flat[c + 1] - flat[a + 1]);
        if (ny < 0) { const q = b; b = c; c = q; }
        buf.p.push(flat[a], -0.03, flat[a + 1], flat[b], -0.03, flat[b + 1], flat[c], -0.03, flat[c + 1]);
        buf.c.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
      }
    }
  }
  // potoky a říčky jako úzké pásy
  const wbuf = get(3, 99);
  const wcol = LAND_COL[LC.WATER].map((v) => v * 255);
  for (let i = 0; i < L.header.lineCount; i++) {
    const cls = L.lCls[i];
    if (cls > 3) continue;
    const hw = cls === 0 ? 4 : cls === 1 ? 2.5 : cls === 2 ? 1.1 : 0.6;
    for (let v = L.lStart[i], ve = L.lStart[i + 1] - 1; v < ve; v++) {
      const x1 = L.lx[v] * 0.1, z1 = L.lz[v] * 0.1, x2 = L.lx[v + 1] * 0.1, z2 = L.lz[v + 1] * 0.1;
      let dx = x2 - x1, dz = z2 - z1;
      const l = Math.hypot(dx, dz);
      if (l < 0.01) continue;
      dx /= l; dz /= l;
      const nx = -dz * hw, nz = dx * hw;
      const ex = dx * hw * 0.5, ez = dz * hw * 0.5;
      wbuf.p.push(x1 - nx - ex, -0.03, z1 - nz - ez, x2 + nx + ex, -0.03, z2 + nz + ez, x1 + nx - ex, -0.03, z1 + nz - ez,
        x1 - nx - ex, -0.03, z1 - nz - ez, x2 - nx + ex, -0.03, z2 - nz + ez, x2 + nx + ex, -0.03, z2 + nz + ez);
      for (let q = 0; q < 6; q++) wbuf.c.push(wcol[0], wcol[1], wcol[2]);
    }
  }
  const group = new THREE.Group();
  for (const buf of bufs) {
    if (!buf || !buf.p.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf.p), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Uint8Array(buf.c), 3, true));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, buf.group === 3 ? mats.water : mats.decal);
    m.renderOrder = 6 + buf.group;
    m.matrixAutoUpdate = false;
    group.add(m);
  }
  return group;
}

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
  constructor(scene, world, decalMat, waterMat) {
    this.scene = scene;
    this.decalMat = decalMat;
    this.waterMat = waterMat;
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

    // základní zem (jen za hranicí mapy)
    const half = 14000;
    const gg = new THREE.PlaneGeometry(half * 2, half * 2);
    gg.rotateX(-Math.PI / 2);
    gg.translate(0, -1, 0);
    this.groundMat = new THREE.MeshLambertMaterial({ color: GROUND_HEX, depthWrite: false });
    const ground = new THREE.Mesh(gg, this.groundMat);
    ground.renderOrder = 5;
    ground.frustumCulled = false;
    scene.add(ground);

    // podklad města: kde je hustá zástavba, je zem „dlážděná“, jinde zelená
    const S = 1024;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const g2 = cv.getContext('2d');
    g2.fillStyle = '#9aa873';
    g2.fillRect(0, 0, S, S);
    g2.fillStyle = '#a9a69c';
    const kx = S / (world.maxX - world.minX), kz = S / (world.maxZ - world.minZ);
    for (let i = 0; i < world.bCount; i++) {
      const w = world.bMaxX[i] - world.bMinX[i], d = world.bMaxZ[i] - world.bMinZ[i];
      const area = w * d;
      if (area < 40) continue;
      g2.globalAlpha = Math.min(0.5, 0.1 + area / 3000);
      g2.beginPath();
      g2.arc(((world.bMinX[i] + world.bMaxX[i]) / 2 - world.minX) * kx, ((world.bMinZ[i] + world.bMaxZ[i]) / 2 - world.minZ) * kz,
        (26 + Math.sqrt(area) * 0.6) * kx, 0, Math.PI * 2);
      g2.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // jemné dělení kvůli přesnosti hloubky (obří trojúhelníky by „prosvítaly“ přes boty a kola)
    const cg = new THREE.PlaneGeometry(world.maxX - world.minX, world.maxZ - world.minZ, 48, 48);
    cg.rotateX(-Math.PI / 2);
    cg.translate((world.minX + world.maxX) / 2, -0.05, (world.minZ + world.maxZ) / 2);
    this.cityMat = patchGroundMaterial(new THREE.MeshLambertMaterial({ map: tex, depthWrite: false }), false);
    const city = new THREE.Mesh(cg, this.cityMat);
    city.renderOrder = 5.5;
    city.frustumCulled = false;
    city.receiveShadow = true;
    scene.add(city);

    const land = buildLand(world, { decal: decalMat, water: waterMat });
    land.traverse((o) => { if (o.isMesh && o.material === decalMat) o.receiveShadow = true; });
    scene.add(land);
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
    this.hemi.color.copy(new THREE.Color(0xcfe2ff).lerp(new THREE.Color(0x6f83c0), 1 - day));
    this.hemi.groundColor.copy(new THREE.Color(0x9a927c).lerp(new THREE.Color(0x343a52), 1 - day));
    this.hemi.intensity = 0.95 + 0.6 * day;

    // voda a světla lamp nejsou osvětlené scénou – řídí se odstínem podle denní doby
    const k = 0.2 + 0.8 * day;
    this.tint.setRGB(k * (1 + dusk * 0.12), k, k * (1 - dusk * 0.1 + (1 - day) * 0.25));
    this.waterMat.color.copy(this.tint);
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
    _tgt.set(f.x, 0, f.z);
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
