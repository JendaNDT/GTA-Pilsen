// Statické části scény: obloha, světla, zem, plochy a voda + denní doba.
import * as THREE from 'three';
import { Earcut } from 'three/src/extras/Earcut.js';
import { LC, QUALITY } from '../config.js';
import { env } from './materials.js';

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
      for (let t = 0; t < tris.length; t++) {
        const q = tris[t] * 2;
        buf.p.push(flat[q], 0, flat[q + 1]);
        buf.c.push(col[0], col[1], col[2]);
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
      wbuf.p.push(x1 - nx - ex, 0, z1 - nz - ez, x1 + nx - ex, 0, z1 + nz - ez, x2 + nx + ex, 0, z2 + nz + ez,
        x1 - nx - ex, 0, z1 - nz - ez, x2 + nx + ex, 0, z2 + nz + ez, x2 - nx + ex, 0, z2 - nz + ez);
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
  const geo = new THREE.SphereGeometry(1, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() },
      night: env.night,
    },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; vec4 p = modelViewMatrix * vec4(position, 0.0); gl_Position = projectionMatrix * vec4(p.xyz, 1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night;
      float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      void main() {
        vec3 d = normalize(vDir);
        float t = pow(clamp(d.y, 0.0, 1.0), 0.55);
        vec3 col = mix(horizon, top, t);
        float s = max(dot(d, sunDir), 0.0);
        col += sunCol * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.25);
        vec2 sp = floor(d.xz / (abs(d.y) + 0.4) * 180.0);
        float star = step(0.9975, h21(sp)) * night * smoothstep(0.05, 0.3, d.y);
        col += vec3(star);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

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

    // základní zem
    const half = 14000;
    const gg = new THREE.PlaneGeometry(half * 2, half * 2);
    gg.rotateX(-Math.PI / 2);
    this.groundMat = new THREE.MeshBasicMaterial({ color: GROUND_HEX, depthWrite: false });
    const ground = new THREE.Mesh(gg, this.groundMat);
    ground.renderOrder = 5;
    ground.frustumCulled = false;
    scene.add(ground);
    this.groundBase = new THREE.Color(GROUND_HEX);

    scene.add(buildLand(world, { decal: decalMat, water: waterMat }));
    this.hour = 10;
    this.tint = new THREE.Color();
    this.setHour(this.hour);
  }

  /** Nastaví osvětlení podle hodiny (0–24). */
  setHour(h) {
    this.hour = h;
    const ang = ((h - 6) / 12) * Math.PI;           // 6:00 východ, 18:00 západ
    const elev = Math.sin(ang);
    const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.22);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.32) * (elev > -0.2 ? 1 : 0);
    env.night.value = 1 - THREE.MathUtils.smoothstep(elev, -0.18, 0.08);

    const dir = new THREE.Vector3(Math.cos(ang) * 0.75, Math.max(0.12, elev), 0.45).normalize();
    if (elev < 0) dir.set(-0.4, 0.75, 0.3).normalize();           // měsíc
    this.sunDir = dir;
    const top = _c.clone().setHex(0x3f86d6).lerp(new THREE.Color(0x060a16), 1 - day);
    const hor = new THREE.Color(0xbdd9ee).lerp(new THREE.Color(0xf0a060), dusk * 0.85).lerp(new THREE.Color(0x141c30), 1 - day);
    const sunCol = new THREE.Color(0xfff4e0).lerp(new THREE.Color(0xff9a4a), dusk).multiplyScalar(elev > -0.05 ? 1 : 0.25);
    const u = this.sky.material.uniforms;
    u.top.value.copy(top); u.horizon.value.copy(hor); u.sunDir.value.copy(dir); u.sunCol.value.copy(sunCol);
    this.scene.fog.color.copy(hor);

    this.sun.color.copy(new THREE.Color(0xfff1dc).lerp(new THREE.Color(0xffa25c), dusk)).lerp(new THREE.Color(0x7f93c8), 1 - day);
    this.sun.intensity = 0.35 + 2.0 * day;
    this.hemi.color.copy(new THREE.Color(0xdfeaff).lerp(new THREE.Color(0x3a466e), 1 - day));
    this.hemi.groundColor.copy(new THREE.Color(0x8a8672).lerp(new THREE.Color(0x1a1c26), 1 - day));
    this.hemi.intensity = 0.55 + 0.85 * day;

    // ploché „nálepky“ (silnice, plochy) nemají osvětlení – ztmavují se odstínem
    const k = 0.2 + 0.8 * day;
    this.tint.setRGB(k * (1 + dusk * 0.12), k, k * (1 - dusk * 0.1 + (1 - day) * 0.25));
    this.decalMat.color.copy(this.tint);
    this.waterMat.color.copy(this.tint);
    this.groundMat.color.copy(this.groundBase).multiply(this.tint);
    this.day = day;
  }

  update(cam) {
    this.sky.position.copy(cam.position);
    this.sky.scale.setScalar(cam.far * 0.9);
    this.sun.position.copy(cam.position).addScaledVector(this.sunDir, 500);
    this.sun.target.position.copy(cam.position);
  }
}
