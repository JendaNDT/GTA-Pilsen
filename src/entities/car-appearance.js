// Společné materiály čtou stav právě vykreslovaného vozu.
import { MeshPhysicalNodeMaterial, Vector4 } from 'three/webgpu';
import { attribute, materialColor, mix, positionLocal, smoothstep, uniform, vec3, vertexColor } from 'three/tsl';
import { makeBatchedSurfaceMaterial } from '../world/materials.js';

const neutral = new Vector4();
const signals = uniform(neutral).onObjectUpdate(({ object }) => object.userData.carSignals ?? neutral);
const dirt = uniform(0).onObjectUpdate(({ object }) => object.userData.dirt ?? 0);
const paint = new Map();
let lamps;

export function carPaint(hex) {
  if (paint.has(hex)) return paint.get(hex);
  const p = positionLocal;
  const mud = dirt.mul(smoothstep(0.05, 0.95, p.y.add(p.z.mul(4).sin().mul(0.07))).oneMinus());
  const stripe = smoothstep(0.76, 0.93, p.z.mul(21).add(p.y.mul(58)).sin());
  const scratch = stripe.mul(attribute('aScratch', 'float'));
  const metalness = [0xf2f2ef, 0xdfe3e6, 0xe0b020, 0xc8922e].includes(hex) ? 0.16 : 0.69;
  const mat = new MeshPhysicalNodeMaterial({
    color: hex, clearcoat: 1, clearcoatRoughness: 0.14,
    colorNode: mix(mix(materialColor.rgb, vec3(0.29, 0.3, 0.3), scratch), vec3(0.16, 0.105, 0.06), mud),
    metalnessNode: mud.oneMinus().mul(metalness), roughnessNode: mud.mul(0.62).add(0.24),
    clearcoatNode: mud.oneMinus().mul(scratch.oneMinus())
  });
  paint.set(hex, mat);
  return mat;
}

export function carLenses() {
  if (lamps) return lamps;
  const id = attribute('aLens', 'float');
  const gain = id.equal(1).select(signals.x, id.equal(2).select(signals.y, id.equal(3).select(signals.z, 0)));
  lamps = makeBatchedSurfaceMaterial({ emissiveNode: vertexColor().rgb.mul(gain) });
  return lamps;
}

export function dirtLevel(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function trackCarDirt(car, world) {
  const distance = Math.hypot(car.x - car.dirtX, car.z - car.dirtZ);
  if (distance < 1) return;
  car.dirtX = car.x;
  car.dirtZ = car.z;
  if (distance < 30 && !car.air && car.dirt < 1 && world.isSoft(car.x, car.z) &&
      !world.onRoad(car.x, car.z, 1) && !world.isWater(car.x, car.z)) {
    car.dirt = dirtLevel(car.dirt + distance / 850);
  }
}
