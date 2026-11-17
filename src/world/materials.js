// Materiály světa. Fasády domů, povrch země i voda se dokreslují přímo v shaderu.
import * as THREE from 'three/webgpu';
import {
  Discard, Fn, If, Loop, float, materialColor, materialReference, mix, positionWorld, reflect, renderGroup,
  smoothstep, transformNormalToView, uniform, vec2, vec3, vec4,
} from 'three/tsl';
import { DEBUG } from '../config.js';
import { hash21, valueNoise } from './material-noise.js';
import { patchShader } from './shader-patches.js';
import { TUNNEL_HEIGHT, TUNNEL_PORTAL_CUT } from './tunnels.js';

export const env = {
  night: uniform(0).setGroup(renderGroup), // 0 = den, 1 = noc
  time: uniform(0).setGroup(renderGroup),
  sky: uniform(new THREE.Color(0xbdd9ee)).setGroup(renderGroup), // obzor a odrazy ve vodě
  sunDir: uniform(new THREE.Vector3(0, 1, 0)).setGroup(renderGroup),
  cam: uniform(new THREE.Vector3()).setGroup(renderGroup),
  wetPaving: uniform(0).setGroup(renderGroup),
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
    shader.vertexShader = patchShader(shader.vertexShader, 'budovy · vrcholy', [
      ['#include <common>', '#include <common>\nattribute vec3 aWin;\nvarying vec3 vWin;\nvarying vec3 vFacade;'],
      ['#include <begin_vertex>', '#include <begin_vertex>\nvWin = aWin;\nvFacade = (modelMatrix * vec4(position, 1.0)).xyz;'],
    ], DEBUG);
    shader.fragmentShader = patchShader(shader.fragmentShader, 'budovy · barva', [
      ['#include <common>', `#include <common>
varying vec3 vWin;
varying vec3 vFacade;
uniform float uNight;
${NOISE_GLSL}`],
      ['#include <color_fragment>', `#include <color_fragment>
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
`],
      ['#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += vec3(1.0, 0.78, 0.42) * litWin * 0.9;
${heritage ? `
if (vWin.z < -4.5) totalEmissiveRadiance += vec3(0.43, 0.23, 0.09) * uNight * 0.36;
if (vWin.z < -1.5 && vWin.z > -2.5 && length(vFacade.xz) < 39.0) {
  float litStone = 1.0 - smoothstep(3.0, 42.0, vFacade.y);
  totalEmissiveRadiance += vec3(0.18, 0.115, 0.065) * litStone * uNight;
}
` : ''}
`],
    ], DEBUG);
  };
  return mat;
}

const decalColor = Fn(() => {
  const { gain } = groundNoise(positionWorld.xz);
  return materialColor.mul(vec4(vec3(gain), 1));
})();

/** Ploché povrchy na zemi (silnice, plochy) se kreslí v pevném pořadí bez zápisu hloubky. */
export function makeDecalMaterial(opts = {}) {
  return new THREE.MeshLambertNodeMaterial({
    vertexColors: true, depthWrite: false, ...opts,
    colorNode: decalColor,
    normalNode: transformNormalToView(vec3(0, 1, 0)),
  });
}

// Zrnitost slábne s velikostí promítnutého pixelu.
function groundNoise(point) {
  const px = point.x.fwidth().max(point.y.fwidth()).toVar();
  const fine = valueNoise(point.mul(2.6)).sub(0.5).mul(smoothstep(0.15, 0.7, px).oneMinus());
  const mid = valueNoise(point.mul(0.33)).sub(0.5).mul(smoothstep(1.2, 5, px).oneMinus()).toVar();
  const big = valueNoise(point.mul(0.021)).sub(0.5).toVar();
  return { px, mid, big, gain: fine.mul(0.13).add(mid.mul(0.10), big.mul(0.07), 1) };
}

const PAVING = {
  1: {
    origin: [0, 0], axisX: [0.967, -0.255], axisZ: [0.255, 0.967],
    center: [-0.6, 0.5], half: [55, 54.5], edge: 1.4, scale: [4.8, 7], color: [0.46, 0.423, 0.365],
  },
  2: {
    origin: [22660.55, 3099.7], axisX: [0.902, 0.432], axisZ: [-0.432, 0.902],
    center: [-0.2, 20.4], half: [6.1, 4.1], edge: 0.85, scale: [3.6, 5.3], color: [0.37, 0.316, 0.233],
  },
};

function pavingLocal(point, profile) {
  const offset = point.sub(vec2(...profile.origin));
  return vec2(offset.dot(vec2(...profile.axisX)), offset.dot(vec2(...profile.axisZ))).toVar();
}

function addPaving(landColor, profile, local, worldPosition, noise, detail) {
  const border = local.sub(vec2(...profile.center)).abs().sub(vec2(...profile.half));
  const coverage = smoothstep(0, profile.edge, border.x.max(border.y)).oneMinus().toVar();
  If(coverage.greaterThan(0), () => {
    const tint = vec3(...profile.color).toVar();
    if (detail) {
      const brick = local.mul(vec2(...profile.scale)).toVar();
      const row = brick.y.floor();
      brick.x.addAssign(row.mod(2).mul(0.5).add(row.mul(1.71).sin().mul(0.08)));
      const cell = brick.fract().toVar();
      const edge = cell.x.min(cell.x.oneMinus(), cell.y, cell.y.oneMinus());
      const joint = smoothstep(0.028, 0.086, edge).oneMinus();
      const sharp = smoothstep(0.033, 0.20, noise.px).oneMinus();
      tint.mulAssign(sharp.mul(hash21(brick.floor()).sub(0.5).mul(0.25).sub(joint.mul(0.29))).add(1));
    }
    tint.mulAssign(noise.mid.mul(0.14).add(noise.big.mul(0.09), 1));
    if (detail) {
      const glancing = env.cam.sub(worldPosition).normalize().y.abs().oneMinus();
      const wet = tint.mul(0.68).add(env.sky.mul(glancing.pow2(), 0.12));
      tint.assign(mix(tint, wet, env.wetPaving));
    }
    landColor.assign(mix(landColor, tint, coverage));
  });
}

// Sdílená síť uzlů pro každou kombinaci dlažby, detailu a počtu portálů.
// Texturu i souřadnice portálů síť bere z právě vykreslované dlaždice.
const terrainNodes = new Map();
function getTerrainNodes(paving, detail, portalCount) {
  const key = `${paving}/${detail}/${portalCount}`;
  const cached = terrainNodes.get(key);
  if (cached) return cached;

  const map = materialReference('map', 'texture');
  const portalAxes = materialReference('portalAxes', 'vec4');
  const portalProfiles = materialReference('portalProfiles', 'vec3');
  const profile = PAVING[paving];
  const surface = Fn(() => {
    const point = positionWorld.xz.toVar();
    const sample = vec4(map).toVar();
    const land = sample.a.clamp(0, 1).toVar();
    const noise = groundNoise(point);
    const landColor = sample.rgb.div(land.max(0.06)).mul(noise.gain).toVar();
    if (profile) {
      addPaving(landColor, profile, pavingLocal(point, profile), positionWorld, noise, detail);
    }
    const waterMask = smoothstep(0.35, 0.65, land).oneMinus().toVar();
    const color = landColor.toVar();
    const sunGlint = float(0).toVar();
    If(waterMask.greaterThan(0.001), () => {
      const view = env.cam.sub(positionWorld).normalize().toVar();
      const fade = smoothstep(60, 400, env.cam.xz.sub(point).length()).oneMinus().toVar();
      const p = point.mul(0.22);
      const w1 = valueNoise(p.add(vec2(env.time.mul(0.22), env.time.mul(0.13)))).sub(0.5).toVar();
      const w2 = detail
        ? valueNoise(p.mul(2.7).sub(vec2(env.time.mul(0.31), env.time.mul(0.19)))).sub(0.5).toVar()
        : float(0);
      const normal = vec3(w1.add(w2.mul(0.6)).mul(0.55, fade), 1, w2.sub(w1.mul(0.6)).mul(0.55, fade))
        .normalize().toVar();
      const fresnel = view.dot(normal).max(0).oneMinus().pow(3);
      const water = mix(vec3(0.07, 0.19, 0.27), env.sky.mul(0.9), fresnel.mul(0.70).add(0.14))
        .add(w1.add(w2).mul(0.03, fade));
      if (detail) {
        const spec = reflect(view.negate(), normal).dot(env.sunDir).max(0).pow(220);
        sunGlint.assign(spec.mul(env.night.oneMinus(), fade, waterMask));
      }
      color.assign(mix(landColor, water, waterMask));
    });
    return vec4(color, sunGlint);
  })().toVar();

  const colorNode = Fn(() => {
    if (portalCount) {
      Loop(portalCount, ({ i }) => {
        const axis = vec4(portalAxes.element(i)).toVar();
        const portal = vec3(portalProfiles.element(i)).toVar();
        const offset = positionWorld.xz.sub(axis.xy);
        const along = offset.dot(axis.zw).toVar();
        const across = offset.dot(vec2(axis.w.negate(), axis.z)).abs();
        const below = positionWorld.y.lessThan(portal.x.add(along.mul(portal.y), TUNNEL_HEIGHT + 0.5));
        Discard(across.lessThan(portal.z)
          .and(along.greaterThanEqual(-TUNNEL_PORTAL_CUT.approach), along.lessThan(TUNNEL_PORTAL_CUT.depth))
          .and(along.lessThan(0).or(below)));
      });
    }
    return vec4(surface.rgb, 1);
  })();
  const emissiveNode = Fn(() => {
    const spec = detail ? vec3(1, 0.94, 0.80).mul(surface.a, 1.4) : vec3(0);
    if (paving !== 2) return spec;
    const distance = pavingLocal(positionWorld.xz, profile).sub(vec2(-2.6, 18.25)).length();
    const lampGlow = smoothstep(0.4, 4.7, distance).oneMinus().mul(env.night);
    return spec.add(vec3(0.27, 0.16, 0.080).mul(lampGlow));
  })();
  const nodes = { colorNode, emissiveNode };
  terrainNodes.set(key, nodes);
  return nodes;
}

/** V náhonu proudí voda podél koryta. Vzdálený a dotykový profil používá levnější vlnění. */
export function makeMillraceMaterial(detail) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.customProgramCacheKey = () => detail ? 'millrace-detail' : 'millrace-basic';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = env.time;
    shader.uniforms.uSky = env.sky;
    shader.uniforms.uCam = env.cam;
    shader.vertexShader = patchShader(shader.vertexShader, 'náhon · vrcholy', [
      ['#include <common>', '#include <common>\nvarying vec3 vRace;\nvarying vec2 vFlow;'],
      ['#include <begin_vertex>', '#include <begin_vertex>\nvRace = (modelMatrix * vec4(position, 1.0)).xyz; vFlow = position.xz;'],
    ], DEBUG);
    shader.fragmentShader = patchShader(shader.fragmentShader, 'náhon · barva', [
      ['#include <common>', `#include <common>
varying vec3 vRace; varying vec2 vFlow;
uniform float uTime; uniform vec3 uSky; uniform vec3 uCam;
${NOISE_GLSL}`],
      ['#include <color_fragment>', `#include <color_fragment>
vec2 current = vec2(vFlow.x * 1.7, (vFlow.y - uTime * 1.8) * 0.44);
float wave = ${detail ? 'vnoise(current) * 0.72 + 0.28 * vnoise(current * 2.5)' : '0.5 + 0.23 * sin(current.y * 4.0 + current.x)'};
float glancing = 1.0 - abs(normalize(uCam - vRace).y);
float ripple = smoothstep(0.58, 0.83, wave);
diffuseColor.rgb = mix(diffuseColor.rgb * (0.88 + 0.27 * wave), uSky, 0.12 + glancing * glancing * (0.28 + 0.20 * ripple));
`],
    ], DEBUG);
  };
  return mat;
}

/** Materiál terénu jedné dlaždice (textura země s vodou v průhlednosti). */
export function makeTerrainMaterial(tex, portals = [], paving = 0, detail = false) {
  const mat = new THREE.MeshLambertNodeMaterial({ map: tex, ...getTerrainNodes(paving, detail, portals.length) });
  if (portals.length) {
    mat.portalAxes = portals.map((p) => new THREE.Vector4(p.x, p.z, p.dx, p.dz));
    mat.portalProfiles = portals.map((p) => new THREE.Vector3(p.y, p.slope, p.width));
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
