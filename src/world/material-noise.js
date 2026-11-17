import { dot, Fn, mix, vec2 } from 'three/tsl';

export const hash21 = Fn(([point]) => {
  const p = point.mul(vec2(123.34, 456.21)).fract().toVar();
  p.addAssign(dot(p, p.add(45.32)));
  return p.x.mul(p.y).fract();
}).setLayout({ name: 'hash21', type: 'float', inputs: [{ name: 'point', type: 'vec2' }] });

export const valueNoise = Fn(([point]) => {
  const cell = point.floor().toVar();
  const unit = point.fract().toVar();
  const fade = unit.mul(unit, unit.mul(-2).add(3)).toVar();
  const near = mix(hash21(cell), hash21(cell.add(vec2(1, 0))), fade.x);
  const far = mix(hash21(cell.add(vec2(0, 1))), hash21(cell.add(vec2(1, 1))), fade.x);
  return mix(near, far, fade.y);
}).setLayout({ name: 'valueNoise', type: 'float', inputs: [{ name: 'point', type: 'vec2' }] });
