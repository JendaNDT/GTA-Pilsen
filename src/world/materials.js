// Materiály světa. Fasády domů, povrch země i voda se dokreslují přímo v shaderu.
import * as THREE from 'three/webgpu';
import {
  attribute, Discard, Fn, If, Loop, float, materialColor, materialReference, mix, positionLocal, positionWorld, reflect, renderGroup,
  smoothstep, struct, transformNormalToView, uniform, vec2, vec3, vec4, vertexColor,
} from 'three/tsl';
import { buildingNodes } from './building-nodes.js';
import { SURFACE } from './material-table.js';
import { hash21, valueNoise } from './material-noise.js';
import { TUNNEL_HEIGHT, TUNNEL_PORTAL_CUT } from './tunnels.js';

export const env = {
  night: uniform(0).setGroup(renderGroup), // 0 = den, 1 = noc
  time: uniform(0).setGroup(renderGroup),
  sky: uniform(new THREE.Color(0xbdd9ee)).setGroup(renderGroup), // obzor a odrazy ve vodě
  sunDir: uniform(new THREE.Vector3(0, 1, 0)).setGroup(renderGroup),
  cam: uniform(new THREE.Vector3()).setGroup(renderGroup),
  wetPaving: uniform(0).setGroup(renderGroup),
};

const facadeNodes = new Map();
const surfaceProperties = attribute('aSurface', 'vec2');

export function makeSurfaceMaterial(surface, opts = {}) {
  return new THREE.MeshStandardNodeMaterial({ ...surface, ...opts });
}

export function makeBatchedSurfaceMaterial(opts = {}) {
  return makeSurfaceMaterial(SURFACE.plaster, {
    vertexColors: true, roughnessNode: surfaceProperties.x, metalnessNode: surfaceProperties.y, ...opts,
  });
}

/**
 * Fasády: atribut aWin = (pozice v polích oken, pozice v patrech, styl + 8 × počet pater).
 * Styly: 1 rodinný dům, 2 panelový dům, 3 činžovní dům s obchody, 4 kanceláře, 5 hala, 6 kostel.
 */
export function makeBuildingMaterial({ textures = false, heritage = false } = {}) {
  const key = `${textures}/${heritage}`;
  if (!facadeNodes.has(key)) facadeNodes.set(key, buildingNodes(env.night, textures, heritage));
  return makeSurfaceMaterial(SURFACE.plaster, facadeNodes.get(key));
}

const decalColor = Fn(() => {
  const { gain } = groundNoise(positionWorld.xz);
  return materialColor.mul(vec4(vec3(gain), 1));
})();

/** Ploché povrchy na zemi (silnice, plochy) se kreslí v pevném pořadí bez zápisu hloubky. */
export function makeDecalMaterial(opts = {}, surface = SURFACE.asphalt) {
  return makeSurfaceMaterial(surface, {
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
  return coverage;
}

// Sdílená síť uzlů pro každou kombinaci dlažby, detailu a počtu portálů.
// Texturu i souřadnice portálů síť bere z právě vykreslované dlaždice.
const terrainNodes = new Map();
const terrainSurface = struct({ color: 'vec3', glint: 'float', roughness: 'float' });
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
    const earth = landColor.r.sub(landColor.g).mul(4).saturate();
    const roughness = mix(SURFACE.grass.roughness, SURFACE.soil.roughness, earth).toVar();
    if (profile) {
      const coverage = addPaving(landColor, profile, pavingLocal(point, profile), positionWorld, noise, detail);
      roughness.assign(mix(roughness, mix(SURFACE.paving.roughness, 0.34, env.wetPaving), coverage));
    }
    const waterMask = smoothstep(0.35, 0.65, land).oneMinus().toVar();
    roughness.assign(mix(roughness, SURFACE.water.roughness, waterMask));
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
    return terrainSurface(color, sunGlint, roughness);
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
    return vec4(surface.get('color'), 1);
  })();
  const emissiveNode = Fn(() => {
    const spec = detail ? vec3(1, 0.94, 0.80).mul(surface.get('glint'), 1.4) : vec3(0);
    if (paving !== 2) return spec;
    const distance = pavingLocal(positionWorld.xz, profile).sub(vec2(-2.6, 18.25)).length();
    const lampGlow = smoothstep(0.4, 4.7, distance).oneMinus().mul(env.night);
    return spec.add(vec3(0.27, 0.16, 0.080).mul(lampGlow));
  })();
  const nodes = { colorNode, emissiveNode, roughnessNode: surface.get('roughness') };
  terrainNodes.set(key, nodes);
  return nodes;
}

/** V náhonu proudí voda podél koryta. Vzdálený a dotykový profil používá levnější vlnění. */
export function makeMillraceMaterial(detail) {
  const colorNode = Fn(() => {
    const local = positionLocal.xz;
    const current = vec2(local.x.mul(1.7), local.y.sub(env.time.mul(1.8)).mul(0.44)).toVar();
    const wave = detail
      ? valueNoise(current).mul(0.72).add(valueNoise(current.mul(2.5)).mul(0.28)).toVar()
      : current.y.mul(4).add(current.x).sin().mul(0.23).add(0.5).toVar();
    const glancing = env.cam.sub(positionWorld).normalize().y.abs().oneMinus();
    const ripple = smoothstep(0.58, 0.83, wave);
    const water = vertexColor().rgb.mul(wave.mul(0.27).add(0.88));
    const reflection = glancing.pow2().mul(ripple.mul(0.20).add(0.28)).add(0.12);
    return vec4(mix(water, env.sky, reflection), 1);
  })();
  return makeSurfaceMaterial(SURFACE.water, { colorNode });
}

/** Materiál terénu jedné dlaždice (textura země s vodou v průhlednosti). */
export function makeTerrainMaterial(tex, portals = [], paving = 0, detail = false) {
  const mat = makeSurfaceMaterial(SURFACE.grass, { map: tex, ...getTerrainNodes(paving, detail, portals.length) });
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
  poolMat = new THREE.MeshBasicNodeMaterial({
    map: tex, color: 0xffd6a0, transparent: true, opacityNode: env.night.mul(0.75), blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -20,
  });
  poolMat.visible = false;
  return poolMat;
}
