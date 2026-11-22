import {
  Fn,
  If,
  attribute,
  float,
  mix,
  normalWorldGeometry,
  positionWorld,
  select,
  smoothstep,
  struct,
  texture,
  transformNormalToView,
  vec2,
  vec3
} from 'three/tsl';
import { layerAtlas } from './layer-atlas.js';
const surface = struct({ gain: 'vec3', normal: 'vec3', rough: 'float' });
let maps;

export function facadeDetail(code, cell, camera, heritage, glass) {
  maps ??= layerAtlas(
    { directory: 'facades', columns: 4, rows: 3, layers: 12, sourceSide: 1024 },
    { barva: [128, 128, 128], povrch: [128, 128, 211] }
  );
  const sample = Fn(() => {
    const n = normalWorldGeometry.toVar(),
      p = positionWorld.toVar();
    const near = smoothstep(65, 135, camera.sub(p).length()).oneMinus().mul(glass.oneMinus());
    const gain = vec3(1).toVar(),
      normal = vec3(n).toVar(),
      rough = float(0.84).toVar();
    If(near.greaterThan(0.001), () => {
      const roof = n.y.greaterThan(0.45).and(code.lessThanEqual(0));
      const cathedralRoof = p.xz.length().lessThan(42).and(code.equal(-1));
      const copper = cathedralRoof.and(p.y.greaterThan(54));
      const layer = heritage
        ? select(
            copper,
            9,
            select(
              code.equal(-4),
              6,
              select(
                code.equal(-2),
                4,
                select(roof, select(cathedralRoof, 11, 7), select(code.mod(8).equal(2), 3, 0))
              )
            )
          )
        : attribute('buildingLayer', 'float');
      const wallAxis = vec3(n.z, 0, n.x.negate());
      const tangent = select(roof, vec3(1, 0, 0).sub(n.mul(n.x)), wallAxis).normalize();
      const vertical = n.cross(tangent).normalize();
      const mapped = vec2(p.dot(tangent), p.dot(vertical)).mul(0.47);
      const coords = select(roof.not().and(code.greaterThan(0)), cell.mul(vec2(1.1, 1.4)), mapped);
      const index = layer.round().clamp(0, 11).toInt();
      const rgb = texture(maps.barva, coords).depth(index).rgb;
      const params = texture(maps.povrch, coords).depth(index);
      const delta = params.rg.mul(2).sub(1);
      const plinth = smoothstep(0.1, 0.22, cell.y).oneMinus().mul(code.greaterThan(0).toFloat());
      gain.assign(mix(vec3(1), rgb.mul(2).mul(plinth.mul(-0.12).add(1)), near));
      rough.assign(mix(0.84, params.b, near));
      normal.assign(n.add(tangent.mul(delta.x, near, 0.6), vertical.mul(delta.y, near, 0.6)).normalize());
    });
    return surface(gain, normal, rough);
  })();
  return {
    gain: sample.get('gain'),
    normal: transformNormalToView(sample.get('normal')),
    rough: sample.get('rough')
  };
}
