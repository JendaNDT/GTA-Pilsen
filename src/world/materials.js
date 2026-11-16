// Materiály světa. Fasády domů, povrch země i voda se dokreslují přímo v shaderu.
import * as THREE from 'three';

export const env = {
  night: { value: 0 },                       // 0 = den, 1 = noc
  time: { value: 0 },
  sky: { value: new THREE.Color(0xbdd9ee) }, // barva oblohy u obzoru (odrazy ve vodě)
  sunDir: { value: new THREE.Vector3(0, 1, 0) },
  cam: { value: new THREE.Vector3() },
};

const NOISE_GLSL = `
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float aaRect(float v, float a, float b, float w) { return smoothstep(a - w, a + w, v) - smoothstep(b - w, b + w, v); }
`;

/**
 * Fasády: atribut aWin = (pozice v polích oken, pozice v patrech, styl + 8 × počet pater).
 * Styly: 1 rodinný dům, 2 panelový dům, 3 činžovní dům s obchody, 4 kanceláře, 5 hala, 6 kostel.
 */
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
${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float litWin = 0.0;
{
  float code = floor(vWin.z + 0.5);
  float style = mod(code, 8.0);
  float floors = floor(code / 8.0);
  if (style > 0.5) {
    vec2 cell = vWin.xy;
    vec2 f = fract(cell);
    vec2 id = floor(cell);
    vec2 fw = fwidth(cell) * 0.75 + 1e-4;
    float detail = 1.0 - smoothstep(0.25, 0.8, max(fw.x, fw.y));
    float ground = step(id.y, 0.5);
    float h1 = hash21(id + 7.0), h2 = hash21(id * 1.7 + 3.1), hc = hash21(vec2(id.x, 5.0));
    vec3 wall = diffuseColor.rgb;
    // omítka: jemné skvrny a sokl u země
    wall *= 0.95 + 0.10 * vnoise(cell * vec2(2.3, 1.7)) * detail;
    vec3 trim = mix(wall * 1.28, vec3(0.86, 0.85, 0.80), 0.45);
    vec4 r = vec4(0.3, 0.7, 0.3, 0.75);            // okno: x0, x1, y0, y1
    float frameW = 0.035, mullV = 0.0, mullH = 0.0, sill = 1.0, door = 0.0, shop = 0.0, loggia = 0.0;

    if (style < 1.5) {                              // rodinný dům
      r = vec4(0.30, 0.70, 0.30, 0.74); mullV = 1.0;
      if (ground > 0.5 && hc > 0.72) { r = vec4(0.36, 0.64, 0.0, 0.72); door = 1.0; sill = 0.0; }
    } else if (style < 2.5) {                       // panelový dům
      r = vec4(0.20, 0.80, 0.36, 0.78); mullV = 1.0;
      if (hc > 0.6 && ground < 0.5) { loggia = 1.0; r = vec4(0.22, 0.78, 0.44, 0.88); sill = 0.0; }
      // spáry mezi panely
      float joint = max(1.0 - smoothstep(0.0, 0.014 + fw.x, f.x), 1.0 - smoothstep(0.0, 0.018 + fw.y, f.y));
      wall *= 1.0 - 0.14 * joint * detail;
    } else if (style < 3.5) {                       // činžovní dům
      r = vec4(0.30, 0.70, 0.22, 0.80); mullV = 1.0; mullH = 1.0;
      if (ground > 0.5) {
        if (hc > 0.8) { r = vec4(0.32, 0.68, 0.0, 0.76); door = 1.0; }
        else { r = vec4(0.07, 0.93, 0.10, 0.70); shop = 1.0; mullV = 0.0; mullH = 0.0; }
        sill = 0.0;
      }
      // římsa mezi patry a lizény mezi okny
      wall *= 1.0 + 0.13 * (1.0 - smoothstep(0.03, 0.05 + fw.y, f.y)) * detail * (1.0 - ground);
      wall *= 1.0 + 0.06 * (1.0 - aaRect(f.x, 0.05, 0.95, fw.x)) * detail;
    } else if (style < 4.5) {                       // kanceláře: pásová okna
      r = vec4(0.0, 1.0, 0.30, 0.84); frameW = 0.0; sill = 0.0;
    } else if (style < 5.5) {                       // hala
      r = vec4(0.14, 0.86, 0.60, 0.86); sill = 0.0;
    } else {                                        // kostel: úzká lomená okna, opěráky
      r = vec4(0.40, 0.60, 0.20, 0.80); sill = 0.0;
      wall *= 1.0 - 0.16 * (1.0 - aaRect(f.x, 0.08, 0.92, fw.x)) * detail;
    }
    // sokl a hlavní římsa pod střechou
    wall *= 1.0 - 0.26 * (1.0 - smoothstep(0.14, 0.17 + fw.y, cell.y)) * step(style, 3.5);
    float topD = floors - cell.y;
    float cornice = (1.0 - smoothstep(0.07, 0.09 + fw.y, topD)) * step(style, 3.5);
    float corniceShade = (1.0 - smoothstep(0.09, 0.15, topD)) * (1.0 - cornice) * step(style, 3.5);

    float yTop = r.w;
    if (style > 5.5) yTop -= abs(f.x - 0.5) * 0.9;  // lomený oblouk
    float wx = aaRect(f.x, r.x, r.y, fw.x), wy = aaRect(f.y, r.z, yTop, fw.y);
    float win = clamp(wx * wy, 0.0, 1.0);
    float frame = clamp(aaRect(f.x, r.x - frameW, r.y + frameW, fw.x) * aaRect(f.y, r.z - frameW, yTop + frameW, fw.y) - win, 0.0, 1.0) * step(0.001, frameW);
    float sillM = aaRect(f.x, r.x - 0.06, r.y + 0.06, fw.x) * aaRect(f.y, r.z - 0.075, r.z - 0.035, fw.y) * sill;

    // sklo: odraz oblohy nahoře, občas záclony
    float gy = clamp((f.y - r.z) / max(0.05, yTop - r.z), 0.0, 1.0);
    vec3 glass = mix(vec3(0.10, 0.15, 0.22), vec3(0.30, 0.43, 0.56), h1 * 0.6 + gy * 0.4);
    glass = mix(glass, vec3(0.62, 0.60, 0.55), step(0.72, h2) * 0.4 * (1.0 - shop));
    if (style > 3.5 && style < 4.5) {               // kancelářská okna dělená sloupky
      float bars = 1.0 - aaRect(fract(f.x * 3.0), 0.035, 0.965, fw.x * 3.0);
      glass = mix(glass, wall * 0.7, bars * detail);
    }
    if (style > 4.5 && style < 5.5) {               // tabulky v halových oknech
      float gx2 = 1.0 - aaRect(fract(f.x * 5.0), 0.06, 0.94, fw.x * 5.0);
      glass = mix(glass, wall * 0.6, gx2 * detail);
    }
    // noční svícení (některá okna teple, některá studeně – televize)
    float lit = step(1.0 - 0.5 * uNight, h2) * uNight;
    lit = max(lit, shop * step(0.35, h1) * uNight);
    lit *= mix(1.0, 0.2, step(4.5, style) * step(style, 5.5)) * (1.0 - door);
    vec3 litCol = mix(vec3(1.0, 0.78, 0.44), vec3(0.70, 0.82, 1.0), step(0.86, h1)) * (0.62 + 0.38 * h1) * (0.8 + 0.2 * gy);
    glass = mix(glass, litCol, lit);
    // příčky v okně
    float cx = (r.x + r.y) * 0.5;
    float bar = (1.0 - smoothstep(0.008, 0.012 + fw.x, abs(f.x - cx))) * mullV;
    bar = max(bar, (1.0 - smoothstep(0.008, 0.012 + fw.y, abs(f.y - mix(r.z, yTop, 0.68)))) * mullH);
    glass = mix(glass, trim, bar * detail);
    if (door > 0.5) glass = mix(vec3(0.20, 0.13, 0.09), vec3(0.30, 0.20, 0.13), h1) * (0.85 + 0.3 * gy);

    // lodžie panelových domů: zapuštěný výklenek se zábradlím
    float lgM = aaRect(f.x, 0.07, 0.93, fw.x) * aaRect(f.y, 0.05, 0.95, fw.y) * loggia;
    float rail = aaRect(f.y, 0.05, 0.40, fw.y) * lgM;
    vec3 railCol = mix(wall * 0.80, vec3(0.45, 0.52, 0.58), 0.25 + 0.35 * hash21(vec2(floor(id.x * 0.25), 2.0)));

    // výloha s vývěsním štítem
    float signM = aaRect(f.x, 0.05, 0.95, fw.x) * aaRect(f.y, 0.75, 0.93, fw.y) * shop * step(0.3, h2);
    vec3 signCol = mix(wall * 0.7, 0.34 + 0.30 * cos(6.2831 * (h1 + vec3(0.0, 0.33, 0.67))), 0.62);

    vec3 col = wall;
    col = mix(col, wall * 0.52, lgM * detail);
    col = mix(col, railCol, rail * detail);
    col = mix(col, trim, frame * detail);
    col = mix(col, trim, sillM * detail);
    col = mix(col, signCol, signM * detail);
    float cover = (r.y - r.x) * (yTop - r.z);
    col = mix(col, glass, mix(cover, win, detail));
    col = mix(col, trim, cornice);
    col *= 1.0 - 0.22 * corniceShade * detail;
    diffuseColor.rgb = col;
    litWin = lit * mix(cover, win * (1.0 - bar * detail), detail) * (0.55 + 0.45 * h1);
  }
}
`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.78, 0.42) * litWin * 0.9;
`);
  };
  return mat;
}

/** Doplní do materiálu země jemnou zrnitost a nastaví normálu nahoru (geometrie ji neobsahuje). */
export function patchGroundMaterial(mat, fixedNormal = true) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGp = (modelMatrix * vec4(position, 1.0)).xz;');
    if (fixedNormal) shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vGp;\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float px = max(fwidth(vGp.x), fwidth(vGp.y));
  float fine = (vnoise(vGp * 2.6) - 0.5) * (1.0 - smoothstep(0.15, 0.7, px));
  float mid = (vnoise(vGp * 0.33) - 0.5) * (1.0 - smoothstep(1.2, 5.0, px));
  float big = vnoise(vGp * 0.021) - 0.5;
  diffuseColor.rgb *= 1.0 + 0.13 * fine + 0.10 * mid + 0.07 * big;
}
`);
  };
  return mat;
}

/** Ploché povrchy na zemi (silnice, plochy) – kreslí se v pevném pořadí bez zápisu hloubky. */
export function makeDecalMaterial() {
  return patchGroundMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false }));
}

export function makeWaterMaterial() {
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.uniforms.uSky = env.sky;
    shader.uniforms.uSunDir = env.sunDir;
    shader.uniforms.uCam = env.cam;
    shader.uniforms.uNight = env.night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWp = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vWp;
uniform float uTime; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uCam; uniform float uNight;
${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 V = normalize(uCam - vec3(vWp.x, 0.0, vWp.y));
  float d = length(uCam.xz - vWp);
  float fade = 1.0 - smoothstep(60.0, 400.0, d);
  vec2 p = vWp * 0.22;
  float w1 = vnoise(p + vec2(uTime * 0.22, uTime * 0.13)) - 0.5;
  float w2 = vnoise(p * 2.7 - vec2(uTime * 0.31, uTime * 0.19)) - 0.5;
  vec3 N = normalize(vec3((w1 + w2 * 0.6) * 0.55 * fade, 1.0, (w2 - w1 * 0.6) * 0.55 * fade));
  float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
  vec3 deep = diffuseColor.rgb * 0.62;
  vec3 col = mix(deep, uSky, 0.12 + 0.72 * fres);
  vec3 R = reflect(-V, N);
  float spec = pow(max(dot(R, uSunDir), 0.0), 220.0) * (1.0 - uNight) * fade;
  col += vec3(1.0, 0.94, 0.80) * spec * 1.6;
  col += (w1 + w2) * 0.035 * fade;
  diffuseColor.rgb = col;
}
`);
  };
  return mat;
}

let poolMat = null;
/** Světelný kužel na zemi (lampy, reflektory aut) – přičítá se k podkladu, síla podle noci. */
export function getPoolMaterial() {
  if (poolMat) return poolMat;
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgb(255,255,255)');
  gr.addColorStop(0.25, 'rgb(150,150,150)');
  gr.addColorStop(0.6, 'rgb(45,45,45)');
  gr.addColorStop(1, 'rgb(0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  poolMat = new THREE.MeshBasicMaterial({
    map: tex, color: 0xffd6a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  poolMat.visible = false;
  return poolMat;
}
