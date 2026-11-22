import { attribute, normalLocal, positionLocal, smoothstep, step, vec3, vertexColor } from 'three/tsl';
import { env, makeBatchedSurfaceMaterial } from '../world/materials.js';

// Spodní okraj prosklení, opěradla a sloupky zůstávají tmavší než stropní osvětlení.
const p = positionLocal;
const surface = attribute('aSurface', 'vec2');
const glass = surface.x.sub(0.21).abs().lessThan(0.004);
const pane = p.z.add(0.75).mod(1.5).abs();
const seat = smoothstep(1.54, 1.67, p.y).max(smoothstep(0.19, 0.25, pane));
const cabin = vec3(1, 0.79, 0.53).mul(env.night).mul(0.68)
  .mul(seat.mul(0.75).add(0.25)).mul(smoothstep(0.6, 0.9, normalLocal.x.abs()));
const color = vertexColor().rgb;
const lamps = color.mul(step(0.9, color.r)).mul(env.night.mul(0.9).add(0.24));
export const transitMaterial = makeBatchedSurfaceMaterial({ emissiveNode: glass.select(cabin, lamps) });
