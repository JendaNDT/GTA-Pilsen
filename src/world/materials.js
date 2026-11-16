// Materiály světa. Fasády domů, povrch země i voda se dokreslují přímo v shaderu.
import * as THREE from 'three';
import { TUNNEL_HEIGHT, TUNNEL_PORTAL_CUT } from './tunnels.js';

export const env = {
  night: { value: 0 },                       // 0 = den, 1 = noc
  time: { value: 0 },
  sky: { value: new THREE.Color(0xbdd9ee) }, // barva oblohy u obzoru (odrazy ve vodě)
  sunDir: { value: new THREE.Vector3(0, 1, 0) },
  cam: { value: new THREE.Vector3() },
  wetPaving: { value: 0 },
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
export function makeBuildingMaterial({ textures = false, heritage = false } = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.customProgramCacheKey = () => heritage
    ? (textures ? 'heritage-painted' : 'heritage-basic')
    : (textures ? 'painted-buildings' : 'buildings');
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = env.night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWin;\nvarying vec3 vWin;\nvarying vec3 vFacade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWin = aWin;\nvFacade = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWin;
varying vec3 vFacade;
uniform float uNight;
${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float litWin = 0.0;
{
  float code = floor(vWin.z + 0.5);
  float style = mod(code, 8.0);
  float floors = floor(code / 8.0);
  if (code > 0.0 && style > 0.5) {
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
    } else if (style > 6.5) {                       // radnice: renesanční osy, sgrafitová barevnost
      r = vec4(0.25, 0.75, 0.20, 0.78); mullV = 1.0; mullH = 1.0;
      if (ground > 0.5) { r = vec4(0.23, 0.77, 0.05, 0.68); sill = 0.0; }
      float band = aaRect(f.y, 0.09, 0.15, fw.y) + 0.75 * aaRect(f.y, 0.86, 0.91, fw.y);
      float pilaster = aaRect(f.x, 0.06, 0.13, fw.x) + aaRect(f.x, 0.87, 0.94, fw.x);
      wall *= 1.0 + (0.38 * band + 0.26 * pilaster) * detail;
      trim = mix(trim, wall * 1.25, 0.68);
    } else {                                        // kostel: úzká lomená okna, opěráky
      r = vec4(0.40, 0.60, 0.20, 0.80); sill = 0.0;
      wall *= 1.0 - 0.16 * (1.0 - aaRect(f.x, 0.08, 0.92, fw.x)) * detail;
    }
    // sokl a hlavní římsa pod střechou
    wall *= 1.0 - 0.26 * (1.0 - smoothstep(0.14, 0.17 + fw.y, cell.y)) * step(style, 3.5);
    float above = step(0.0, cell.y);      // pod úrovní terénu (ve svahu) je jen holá zeď
    float topD = floors - cell.y;
    float cornice = (1.0 - smoothstep(0.07, 0.09 + fw.y, topD)) * step(style, 3.5);
    float corniceShade = (1.0 - smoothstep(0.09, 0.15, topD)) * (1.0 - cornice) * step(style, 3.5);

    float yTop = r.w;
    if (style > 5.5 && style < 6.5) yTop -= abs(f.x - 0.5) * 0.9;  // lomený oblouk
    float wx = aaRect(f.x, r.x, r.y, fw.x), wy = aaRect(f.y, r.z, yTop, fw.y);
    float win = clamp(wx * wy, 0.0, 1.0) * above;
    float frame = above * clamp(aaRect(f.x, r.x - frameW, r.y + frameW, fw.x) * aaRect(f.y, r.z - frameW, yTop + frameW, fw.y) - win, 0.0, 1.0) * step(0.001, frameW);
    float sillM = aaRect(f.x, r.x - 0.06, r.y + 0.06, fw.x) * aaRect(f.y, r.z - 0.075, r.z - 0.035, fw.y) * sill * above;

    // sklo: odraz oblohy nahoře, občas záclony
    float gy = clamp((f.y - r.z) / max(0.05, yTop - r.z), 0.0, 1.0);
    vec3 glass = mix(vec3(0.06, 0.091, 0.125), vec3(0.24, 0.34, 0.45), h1 * 0.6 + gy * 0.4);
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
    float lgM = aaRect(f.x, 0.07, 0.93, fw.x) * aaRect(f.y, 0.05, 0.95, fw.y) * loggia * above;
    float rail = aaRect(f.y, 0.05, 0.40, fw.y) * lgM;
    vec3 railCol = mix(wall * 0.80, vec3(0.45, 0.52, 0.58), 0.25 + 0.35 * hash21(vec2(floor(id.x * 0.25), 2.0)));

    // výloha s vývěsním štítem
    float signM = aaRect(f.x, 0.05, 0.95, fw.x) * aaRect(f.y, 0.75, 0.93, fw.y) * shop * step(0.3, h2) * above;
    vec3 signCol = mix(wall * 0.7, 0.25 + 0.19 * cos(6.2831 * (h1 + vec3(0.0, 0.33, 0.67))), ${heritage ? '0.46' : '0.62'});

    vec3 col = wall;
    col = mix(col, wall * 0.52, lgM * detail);
    col = mix(col, railCol, rail * detail);
    col = mix(col, trim, frame * detail);
    col = mix(col, trim, sillM * detail);
    col = mix(col, signCol, signM * detail);
    float cover = (r.y - r.x) * (yTop - r.z);
    col = mix(col, glass, mix(cover * above, win, detail));
    col = mix(wall * 0.78, col, above);
    col = mix(col, trim, cornice);
    col *= 1.0 - 0.22 * corniceShade * detail;
    diffuseColor.rgb = col;
    litWin = lit * above * mix(cover, win * (1.0 - bar * detail), detail) * (0.55 + 0.45 * h1);
  }
  ${textures ? `
  vec2 uv = vWin.xy;
  float px = max(fwidth(vFacade.x), max(fwidth(vFacade.y), fwidth(vFacade.z)));
  float nearDetail = 1.0 - smoothstep(0.10, 0.48, px);
  float brush = vnoise((vFacade.xz + vFacade.yy * 0.49) * vec2(1.12, 1.71));
  float grain = vnoise((vFacade.xz + vFacade.yy * 0.71) * 7.1);
  diffuseColor.rgb *= 0.97 + 0.08 * brush + 0.075 * (grain - 0.5) * nearDetail;
  if (code == -1.0 || code == -2.0) {
    // Tašky a šindel mají úzké překryvy. Na zdivu jsou spáry širší a nepravidelné.
    vec2 blocks = uv * (code == -1.0 ? vec2(3.1, 3.55) : vec2(1.34, 2.35));
    blocks.x += mod(floor(blocks.y), 2.0) * 0.5;
    vec2 f = fract(blocks);
    float seam = 1.0 - smoothstep(0.016, 0.057, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    diffuseColor.rgb *= 1.0 + nearDetail * ((hash21(floor(blocks)) - 0.5) * 0.16 - 0.20 * seam);
  }
  if (code == -4.0) {
    float plank = uv.x * 6.2;
    diffuseColor.rgb *= 1.0 + (hash21(vec2(floor(plank), 4.0)) - 0.5) * 0.19
      - (1.0 - smoothstep(0.02, 0.10, fract(plank))) * nearDetail * 0.14;
  }
  ` : ''}
}
`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.78, 0.42) * litWin * 0.9;
${heritage ? `
if (vWin.z < -4.5) totalEmissiveRadiance += vec3(0.43, 0.23, 0.09) * uNight * 0.36;
if (vWin.z < -1.5 && vWin.z > -2.5 && length(vFacade.xz) < 39.0) {
  float litStone = 1.0 - smoothstep(3.0, 42.0, vFacade.y);
  totalEmissiveRadiance += vec3(0.18, 0.115, 0.065) * litStone * uNight;
}
` : ''}
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
export function makeDecalMaterial(opts = {}) {
  return patchGroundMaterial(new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false, ...opts }));
}

/** Společná úprava shaderu terénu (jedna funkce = jeden sdílený program pro všechny dlaždice). */
function pavingGLSL(profile, detail) {
  if (!profile) return '';
  const area = profile === 1 ? `
  vec2 square = vec2(dot(gp, vec2(0.967, -0.255)), dot(gp, vec2(0.255, 0.967)));
  float paved = 1.0 - smoothstep(0.0, 1.4, max(abs(square.x + 0.6) - 55.0, abs(square.y - 0.5) - 54.5));
  vec2 brick = square * vec2(4.8, 7.0);
  vec3 tint = vec3(0.46, 0.423, 0.365);` : `
  vec2 offset = gp - vec2(22660.55, 3099.7);
  vec2 local = vec2(dot(offset, vec2(0.902, 0.432)), dot(offset, vec2(-0.432, 0.902)));
  float paved = 1.0 - smoothstep(0.0, 0.85, max(abs(local.x + 0.2) - 6.1, abs(local.y - 20.4) - 4.1));
  vec2 brick = local * vec2(3.6, 5.3);
  vec3 tint = vec3(0.37, 0.316, 0.233);
  pavingGlow = (1.0 - smoothstep(0.4, 4.7, length(local - vec2(-2.6, 18.25)))) * uNight;`;
  return `
  ${area}
  if (paved > 0.0) {
    ${detail ? `
    brick.x += 0.5 * mod(floor(brick.y), 2.0) + 0.08 * sin(floor(brick.y) * 1.71);
    vec2 f = fract(brick);
    float joint = 1.0 - smoothstep(0.028, 0.086, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    float sharp = 1.0 - smoothstep(0.033, 0.20, px);
    tint *= 1.0 + sharp * (0.25 * (hash21(floor(brick)) - 0.5) - 0.29 * joint);
    ` : ''}
    tint *= 1.0 + 0.14 * mid + 0.09 * big;
    ${detail ? `
    // Volitelná mokrá dlažba má tlumený odraz oblohy při pohledu po povrchu.
    float glancing = 1.0 - abs(normalize(uCam - vTp).y);
    vec3 wet = tint * 0.68 + uSky * glancing * glancing * 0.12;
    tint = mix(tint, wet, uWetPaving);
    ` : ''}
    landCol = mix(landCol, tint, paved);
  }`;
}

function terrainCompile(shader, paving, detail) {
  shader.uniforms.uTime = env.time;
  shader.uniforms.uSky = env.sky;
  shader.uniforms.uSunDir = env.sunDir;
  shader.uniforms.uWetPaving = env.wetPaving;
  shader.uniforms.uCam = env.cam;
  shader.uniforms.uNight = env.night;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vTp;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTp = (modelMatrix * vec4(position, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec3 vTp;
uniform float uTime; uniform vec3 uSky; uniform vec3 uSunDir; uniform vec3 uCam; uniform float uNight; uniform float uWetPaving;
float waterSpec = 0.0;
float pavingGlow = 0.0;
${NOISE_GLSL}`)
    .replace('#include <map_fragment>', `
{
  // textura země: průhledná místa jsou voda
  vec4 tx = texture2D(map, vMapUv);
  float land = clamp(tx.a, 0.0, 1.0);
  vec3 landCol = tx.rgb / max(land, 0.06);
  vec2 gp = vTp.xz;
  float px = max(fwidth(gp.x), fwidth(gp.y));
  float fine = (vnoise(gp * 2.6) - 0.5) * (1.0 - smoothstep(0.15, 0.7, px));
  float mid = (vnoise(gp * 0.33) - 0.5) * (1.0 - smoothstep(1.2, 5.0, px));
  float big = vnoise(gp * 0.021) - 0.5;
  landCol *= 1.0 + 0.13 * fine + 0.10 * mid + 0.07 * big;
  ${pavingGLSL(paving, detail)}
  float wmask = 1.0 - smoothstep(0.35, 0.65, land);
  vec3 col = landCol;
  if (wmask > 0.001) {
    vec3 V = normalize(uCam - vTp);
    float d = length(uCam.xz - gp);
    float fade = 1.0 - smoothstep(60.0, 400.0, d);
    vec2 p = gp * 0.22;
    float w1 = vnoise(p + vec2(uTime * 0.22, uTime * 0.13)) - 0.5;
    float w2 = ${detail ? 'vnoise(p * 2.7 - vec2(uTime * 0.31, uTime * 0.19)) - 0.5' : '0.0'};
    vec3 N = normalize(vec3((w1 + w2 * 0.6) * 0.55 * fade, 1.0, (w2 - w1 * 0.6) * 0.55 * fade));
    float fres = pow(1.0 - max(dot(V, N), 0.0), 3.0);
    vec3 water = mix(vec3(0.07, 0.19, 0.27), uSky * 0.9, 0.14 + 0.70 * fres) + (w1 + w2) * 0.03 * fade;
    ${detail ? `
    vec3 R = reflect(-V, N);
    waterSpec = pow(max(dot(R, uSunDir), 0.0), 220.0) * (1.0 - uNight) * fade * wmask;
    ` : ''}
    col = mix(landCol, water, wmask);
  }
  diffuseColor.rgb *= col;
}
`)
    .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.94, 0.80) * waterSpec * 1.4
  + vec3(0.27, 0.16, 0.080) * pavingGlow;
`);
}

/** V náhonu proudí voda podél koryta. Vzdálený a dotykový profil používá levnější vlnění. */
export function makeMillraceMaterial(detail) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.customProgramCacheKey = () => detail ? 'millrace-detail' : 'millrace-basic';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.uniforms.uSky = env.sky;
    shader.uniforms.uCam = env.cam;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRace;\nvarying vec2 vFlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRace = (modelMatrix * vec4(position, 1.0)).xyz; vFlow = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vRace; varying vec2 vFlow;
uniform float uTime; uniform vec3 uSky; uniform vec3 uCam;
${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec2 current = vec2(vFlow.x * 1.7, (vFlow.y - uTime * 1.8) * 0.44);
float wave = ${detail ? 'vnoise(current) * 0.72 + 0.28 * vnoise(current * 2.5)' : '0.5 + 0.23 * sin(current.y * 4.0 + current.x)'};
float glancing = 1.0 - abs(normalize(uCam - vRace).y);
float ripple = smoothstep(0.58, 0.83, wave);
diffuseColor.rgb = mix(diffuseColor.rgb * (0.88 + 0.27 * wave), uSky, 0.12 + glancing * glancing * (0.28 + 0.20 * ripple));
`);
  };
  return mat;
}

/** Materiál terénu jedné dlaždice (textura země s vodou v průhlednosti). */
export function makeTerrainMaterial(tex, portals = [], paving = 0, detail = false) {
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  mat.customProgramCacheKey = () => `terrain-${portals.length}-${paving}-${detail ? 1 : 0}`;
  mat.onBeforeCompile = (shader) => terrainCompile(shader, paving, detail);
  if (portals.length) {
    const axes = portals.map((p) => new THREE.Vector4(p.x, p.z, p.dx, p.dz));
    const profiles = portals.map((p) => new THREE.Vector3(p.y, p.slope, p.width));
    const count = portals.length;
    mat.onBeforeCompile = (shader) => {
      terrainCompile(shader, paving, detail);
      shader.uniforms.uPortalAxis = { value: axes };
      shader.uniforms.uPortalProfile = { value: profiles };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
uniform vec4 uPortalAxis[${count}];
uniform vec3 uPortalProfile[${count}];`)
        .replace('float land =', `
  for (int i = 0; i < ${count}; i++) {
    vec4 axis = uPortalAxis[i];
    vec3 profile = uPortalProfile[i];
    vec2 offset = vTp.xz - axis.xy;
    float along = dot(offset, axis.zw);
    float across = abs(dot(offset, vec2(-axis.w, axis.z)));
    if (across < profile.z && along >= -${TUNNEL_PORTAL_CUT.approach}.0
        && along < ${TUNNEL_PORTAL_CUT.depth}.0
        && (along < 0.0 || vTp.y < profile.x + along * profile.y + ${TUNNEL_HEIGHT + 0.5})) discard;
  }
  float land =`);
    };
  }
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
    depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -20,
  });
  poolMat.visible = false;
  return poolMat;
}
