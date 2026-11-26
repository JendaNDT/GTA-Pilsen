import { stationPaving } from './station-forecourt.js';
// Materiály světa. Fasády domů, povrch země i voda se dokreslují přímo v shaderu.
import * as THREE from 'three/webgpu';
import {
  attribute, Discard, Fn, If, Loop, float, materialColor, materialReference, mix, normalViewGeometry, positionLocal, positionWorld, reflect, renderGroup,
  smoothstep, struct, transformNormalToView, uniform, vec2, vec3, vec4, vertexColor,
} from 'three/tsl';
import { snowColor } from './weather-surfaces.js';
import { asphaltNodes } from './asphalt.js';
import { terrainDetailNodes } from './terrain-detail.js';
import { buildingNodes } from './building-nodes.js';
import { SURFACE } from './material-table.js';
import { hash21, valueNoise } from './material-noise.js';
import { detailFadeRange } from './image-quality.js';
import { TUNNEL_HEIGHT, TUNNEL_PORTAL_CUT } from './tunnels.js';
import { waterOptics } from './water-optics.js';

export const env = {
  windows: uniform(new THREE.Vector4()).setGroup(renderGroup),
  night: uniform(0).setGroup(renderGroup), // 0 = den, 1 = noc
  time: uniform(0).setGroup(renderGroup),
  sky: uniform(new THREE.Color(0xbdd9ee)).setGroup(renderGroup), // obzor a odrazy ve vodě
  sunDir: uniform(new THREE.Vector3(0, 1, 0)).setGroup(renderGroup),
  cam: uniform(new THREE.Vector3()).setGroup(renderGroup),
  wetPaving: uniform(0).setGroup(renderGroup),
  colorGrade: uniform(new THREE.Vector3(1, 0, 0)).setGroup(renderGroup),
  morningFog: uniform(0).setGroup(renderGroup),
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
export function makeBuildingMaterial({ textures = false, heritage = false, street = false } = {}) {
  const key = `${textures}/${heritage}/${street}`;
  if (!facadeNodes.has(key)) facadeNodes.set(key, buildingNodes(env.night, env.windows, env.cam, env.sky, textures, heritage, street));
  const material = makeSurfaceMaterial(SURFACE.plaster, facadeNodes.get(key));
  facadeMaterials.add(material);
  material.addEventListener('dispose', () => facadeMaterials.delete(material));
  applyFacadeEnvironment(material);
  return material;
}

// Fasády odrážejí oblohu slaběji než zbytek scény. V ulici by ji zakrývaly protější domy;
// plný odraz oblohy na drsné omítce dával při pohledu podél ulice mléčný závoj.
const facadeMaterials = new Set();
const facadeEnvironment = { texture: null, intensity: 1 };

function applyFacadeEnvironment(material) {
  if (!facadeEnvironment.texture) return;
  if (material.envMap !== facadeEnvironment.texture) {
    material.envMap = facadeEnvironment.texture;
    material.needsUpdate = true;
  }
  material.envMapIntensity = facadeEnvironment.intensity;
}

/** Vlastní mapa a síla odrazu oblohy pro fasády. Bez mapy fasády používají prostředí scény. */
export function setFacadeEnvironment(texture, intensity) {
  facadeEnvironment.texture = texture;
  facadeEnvironment.intensity = intensity;
  for (const material of facadeMaterials) applyFacadeEnvironment(material);
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

export function makeAsphaltMaterial(detail) {
  const material = makeDecalMaterial({polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-6});
  if (detail) Object.assign(material, asphaltNodes(decalColor,env.wetPaving,env.cam));
  else material.colorNode = vec4(snowColor(decalColor.rgb), 1);
  return material;
}

// Zrnitost slábne s velikostí promítnutého pixelu (buňky 0,38 m a 3 m, viz image-quality.js).
export const GROUND_FINE_FADE = detailFadeRange(1 / 2.6, [0.15, 0.7]);
export const GROUND_MID_FADE = detailFadeRange(1 / 0.33, [1.2, 5]);
export const PAVING_FADE = (scale) => detailFadeRange(1 / Math.max(...scale), [0.033, 0.20]);

function groundNoise(point) {
  const px = point.x.fwidth().max(point.y.fwidth()).toVar();
  const fine = float(0).toVar(), mid = float(0).toVar();
  // Pokud promítnutý pixel překročí celou šířku přechodu, váha vrstvy už je nula.
  If(px.lessThan(GROUND_FINE_FADE[1]), () => {
    fine.assign(valueNoise(point.mul(2.6)).sub(0.5).mul(smoothstep(...GROUND_FINE_FADE, px).oneMinus()));
  });
  If(px.lessThan(GROUND_MID_FADE[1]), () => {
    mid.assign(valueNoise(point.mul(0.33)).sub(0.5).mul(smoothstep(...GROUND_MID_FADE, px).oneMinus()));
  });
  const big = valueNoise(point.mul(0.021)).sub(0.5).toVar();
  return { px, mid, big, gain: fine.mul(0.13).add(mid.mul(0.10), big.mul(0.07), 1) };
}

const PAVING = {
  3: stationPaving,
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
      const sharp = smoothstep(...PAVING_FADE(profile.scale), noise.px).oneMinus();
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
function getTerrainNodes(paving, detail, portalCount, terrainDetail, waterDetail, pilot) {
  const key = `${paving}/${detail}/${portalCount}/${terrainDetail}/${waterDetail}/${pilot}`;
  const cached = terrainNodes.get(key);
  if (cached) return cached;

  const map = materialReference('map', 'texture');
  const portalAxes = materialReference('portalAxes', 'vec4');
  const portalProfiles = materialReference('portalProfiles', 'vec3');
  const portalBounds = materialReference('portalBounds', 'vec3');
  const profile = PAVING[paving];
  const close = terrainDetail ? terrainDetailNodes(env.cam) : null;
  const field = waterDetail ? materialReference('waterField', 'texture') : null;
  const optics = pilot && field ? waterOptics(positionWorld.xz, field, env) : null;
  const wave = waterDetail ? Fn(() => {
    const flow = field.rg.mul(255).sub(128).div(127).toVar();
    const drift = flow.mul(env.time).toVar();
    const point = positionWorld.xz;
    const broad = point.sub(drift.mul(0.72)).dot(vec2(0.64, 1.48)).sin();
    const fine = point.sub(drift.mul(0.44)).dot(vec2(-2.31, 1.16)).sin();
    const fade = smoothstep(65, 360, env.cam.xz.sub(point).length()).oneMinus();
    const strength = flow.length().min(1).mul(0.12).add(0.018).mul(fade);
    return vec3(broad.mul(0.64).sub(fine.mul(0.49)).mul(strength), 1,
      broad.add(fine.mul(0.31)).mul(strength)).normalize();
  })() : null;
  const surface = Fn(() => {
    const point = positionWorld.xz.toVar();
    const sample = vec4(map).toVar();
    const land = sample.a.clamp(0, 1).toVar();
    const noise = groundNoise(point);
    const landColor = sample.rgb.div(land.max(0.06)).mul(noise.gain).toVar();
    if (close) landColor.mulAssign(close.gain);
    const earth = landColor.r.sub(landColor.g).mul(4).saturate();
    const roughness = mix(SURFACE.grass.roughness, SURFACE.soil.roughness, earth).toVar();
    if (profile) {
      const coverage = addPaving(landColor, profile, pavingLocal(point, profile), positionWorld, noise, detail);
      roughness.assign(mix(roughness, mix(SURFACE.paving.roughness, 0.34, env.wetPaving), coverage));
    }
    landColor.assign(snowColor(landColor.mul(env.wetPaving.mul(-.14).add(1))));
    roughness.mulAssign(env.wetPaving.mul(-.38).add(1));
    const waterMask = smoothstep(0.35, 0.65, land).oneMinus().toVar();
    roughness.assign(mix(roughness, SURFACE.water.roughness, waterMask));
    const color = landColor.toVar();
    const sunGlint = float(0).toVar();
    If(waterMask.greaterThan(0.001), () => {
      const view = env.cam.sub(positionWorld).normalize().toVar();
      const fade = smoothstep(60, 400, env.cam.xz.sub(point).length()).oneMinus().toVar();
      if (field) {
        const fresnel = view.dot(wave).saturate().oneMinus().pow(5);
        const bed = mix(vec3(0.115, 0.24, 0.235), vec3(0.038, 0.13, 0.20), field.b);
        const ripple = valueNoise(point.mul(1.6).sub(env.time.mul(0.65)));
        const foam = smoothstep(0.12, 0.72, field.a).mul(smoothstep(0.28, 0.68, ripple));
        const tint = mix(mix(bed, env.sky, fresnel.mul(0.58)), vec3(0.67, 0.77, 0.78), foam);
        color.assign(mix(landColor, tint, waterMask));
        if (optics) {
          const weight = optics.weight.mul(waterMask).toVar();
          If(weight.greaterThan(0.001), () => {
            const improved = optics.shade(view, foam);
            color.assign(mix(color, improved.tint, weight));
            sunGlint.assign(improved.glint.mul(weight, fade));
          });
        }
        roughness.assign(mix(roughness, mix(0.16, 0.62, foam), waterMask));
      } else {
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
      }
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
        const bounds = vec3(portalBounds.element(i)).toVar();
        const below = positionWorld.y.lessThan(portal.x.add(along.mul(portal.y), bounds.z.abs()));
        Discard(across.lessThan(portal.z)
          .and(along.greaterThanEqual(bounds.x), along.lessThan(bounds.y))
          .and(bounds.z.lessThan(0).and(along.lessThan(0)).or(below)));
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
  if (wave) {
    const coverage = smoothstep(0.35, 0.65, map.a).oneMinus();
    const normal = optics ? Fn(() => {
      const result = wave.toVar();
      If(coverage.mul(optics.weight).greaterThan(0.001), () => {
        result.assign(mix(wave, optics.normal, optics.weight).normalize());
      });
      return result;
    })() : wave;
    nodes.normalNode = mix(close?.normal ?? normalViewGeometry, transformNormalToView(normal), coverage).normalize();
  } else if (close) nodes.normalNode = close.normal;
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
export function makeTerrainMaterial(tex, portals = [], paving = 0, detail = false, mask = null, water = null, pilot = false) {
  const mat = makeSurfaceMaterial(SURFACE.grass, {
    map: tex, ...getTerrainNodes(paving, detail, portals.length, Boolean(mask), Boolean(water), Boolean(pilot && water)),
  });
  if (mask) mat.terrainClasses = mask;
  if (water) mat.waterField = water;
  if (portals.length) {
    mat.portalBounds = portals.map(p => new THREE.Vector3(p.start ?? -TUNNEL_PORTAL_CUT.approach,
      p.end ?? TUNNEL_PORTAL_CUT.depth, p.clearance ?? -(TUNNEL_HEIGHT + 0.5)));
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
