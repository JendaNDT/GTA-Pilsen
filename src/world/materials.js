// Materiály světa. Fasády domů mají okna kreslená přímo v shaderu.
import * as THREE from 'three';

export const env = {
  night: { value: 0 },      // 0 = den, 1 = noc
  time: { value: 0 },
};

export function makeBuildingMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = env.night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWin;\nvarying vec3 vWin;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWin = aWin;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWin;
uniform float uNight;
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float litWin = 0.0;
{
  float style = floor(vWin.z + 0.5);
  if (style > 0.5) {
    vec2 cell = vWin.xy;
    vec2 f = fract(cell);
    vec2 id = floor(cell);
    vec4 r = vec4(0.3, 0.7, 0.3, 0.75);                   // x0, x1, y0, y1
    float ground = step(id.y, 0.5);
    if (style < 1.5) r = vec4(0.30, 0.70, 0.32, 0.74);
    else if (style < 2.5) r = vec4(0.16, 0.84, 0.34, 0.78);
    else if (style < 3.5) r = mix(vec4(0.30, 0.70, 0.24, 0.82), vec4(0.08, 0.92, 0.10, 0.80), ground);
    else if (style < 4.5) r = vec4(0.03, 0.97, 0.30, 0.86);
    else if (style < 5.5) r = vec4(0.18, 0.82, 0.58, 0.86);
    else r = vec4(0.36, 0.64, 0.12, 0.92);
    vec2 fw = fwidth(cell) * 0.75 + 1e-4;
    float wx = smoothstep(r.x - fw.x, r.x + fw.x, f.x) - smoothstep(r.y - fw.x, r.y + fw.x, f.x);
    float wy = smoothstep(r.z - fw.y, r.z + fw.y, f.y) - smoothstep(r.w - fw.y, r.w + fw.y, f.y);
    float win = clamp(wx * wy, 0.0, 1.0);
    float cover = (r.y - r.x) * (r.w - r.z);
    float detail = 1.0 - smoothstep(0.30, 0.85, max(fw.x, fw.y));
    win = mix(cover, win, detail);
    float h = hash21(id + floor(vWin.xy * 0.0) + 7.0);
    vec3 glass = mix(vec3(0.13, 0.19, 0.27), vec3(0.34, 0.47, 0.60), h);
    float lit = step(1.0 - 0.55 * uNight, hash21(id * 1.7 + 3.1)) * uNight;
    lit *= mix(1.0, 0.25, step(4.5, style) * step(style, 5.5));
    glass = mix(glass, vec3(1.0, 0.80, 0.46), lit);
    // patra: jemná vodorovná linka mezi podlažími
    float band = 1.0 - 0.07 * detail * (1.0 - smoothstep(0.0, 0.05, f.y));
    diffuseColor.rgb = mix(diffuseColor.rgb * band, glass, win);
    litWin = lit * win;
  }
}
`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.78, 0.42) * litWin * 0.85;
`);
  };
  return mat;
}

/** Ploché „nálepky“ na zemi (silnice, plochy) – kreslí se v pevném pořadí bez zápisu hloubky. */
export function makeDecalMaterial(opts = {}) {
  return new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false, ...opts });
}

export function makeWaterMaterial() {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWp;\nuniform float uTime;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float w = sin(vWp.x * 0.35 + uTime * 0.8) * sin(vWp.y * 0.31 - uTime * 0.6)
          + 0.5 * sin((vWp.x + vWp.y) * 0.9 + uTime * 1.7);
  diffuseColor.rgb += vec3(0.05, 0.07, 0.08) * w;
}
`);
  };
  return mat;
}
