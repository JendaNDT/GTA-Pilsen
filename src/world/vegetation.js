import * as THREE from 'three/webgpu';
import {
  attribute,
  cameraPosition,
  float,
  mix,
  positionGeometry,
  positionLocal,
  texture,
  transformNormalToView,
  uniform,
  uv,
  vertexColor,
  varying,
  vec2,
  vec3,
  vec4
} from 'three/tsl';
import { SEASON_TINT, TREE_FRAME, TREE_PIVOT, TREE_TYPES, treeModel, treeSeason } from './tree-models.js';
import { snowColor, snowDepth } from './weather-surfaces.js';
import { env, makeSurfaceMaterial } from './materials.js';
import { SURFACE } from './material-table.js';

const season = uniform(1),
  seasonTint = uniform(new THREE.Vector3(1, 1, 1));
let currentDay, assets;
export function updateTreeSeason(day) {
  if (currentDay === day) return;
  currentDay = day;
  const value = treeSeason(day);
  season.value = value;
  seasonTint.value.fromArray(SEASON_TINT[value]);
}
function wind(point, height) {
  const phase = point.x.mul(0.19).add(point.z.mul(0.27), env.time.mul(1.45));
  return vec3(phase.sin(), 0, phase.mul(0.71).sin().mul(0.55)).mul(height.max(0).pow2(), 0.0025);
}
function resources() {
  if (assets) return assets;
  const leaf = attribute('foliage', 'float');
  const position = positionLocal.add(wind(positionLocal, positionGeometry.y));
  const green = makeSurfaceMaterial(SURFACE.grass, { colorNode: vec4(snowColor(vertexColor().rgb), 1), positionNode: position });
  const deciduous = makeSurfaceMaterial(SURFACE.grass, {
    positionNode: position,
    colorNode: vec4(snowColor(vertexColor().rgb.mul(mix(vec3(1), seasonTint, leaf))), 1),
    opacityNode: season.equal(3).select(leaf.oneMinus(), 1),
    alphaTest: 0.5
  });
  const atlas = new THREE.TextureLoader().load(
    import.meta.env.BASE_URL + 'models/vegetation/stromy.png',
    () => {
      assets.ready = true;
    }
  );
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.minFilter = THREE.LinearMipMapLinearFilter;
  const root = attribute('treeRoot', 'vec4'),
    layout = attribute('treeLayout', 'vec3');
  const center = root.xyz.add(vec3(0, layout.y.mul(TREE_PIVOT), 0));
  const az = layout.x,
    cs = az.cos(),
    sn = az.sin();
  const dir = cameraPosition.sub(center);
  const local = vec3(dir.x.mul(cs).sub(dir.z.mul(sn)), dir.y.max(0), dir.x.mul(sn).add(dir.z.mul(cs)));
  const sum = local.abs().dot(vec3(1)).max(0.001);
  const frame = vec2(local.x.add(local.z), local.x.sub(local.z)).div(sum).add(1).mul(2).round().clamp(0, 4);
  // Rozložení horní poloviny osmistěnu je shodné s převodníkem atlasu.
  const encoded = frame.div(2).sub(1);
  const fx = encoded.x.add(encoded.y).mul(0.5),
    fz = encoded.x.sub(encoded.y).mul(0.5);
  const facing = vec3(fx, float(1).sub(fx.abs(), fz.abs()), fz).normalize();
  const right = facing.y
    .greaterThan(0.999)
    .select(vec3(1, 0, 0), vec3(facing.z, 0, facing.x.negate()).normalize());
  const top = facing.cross(right);
  const offset = right.mul(positionGeometry.x).add(top.mul(positionGeometry.y)).mul(TREE_FRAME);
  const point = center.add(
    vec3(
      offset.x.mul(cs).add(offset.z.mul(sn)).mul(root.w),
      offset.y.mul(layout.y),
      offset.z.mul(cs).sub(offset.x.mul(sn)).mul(root.w)
    )
  );
  const atlasCell = varying(vec2(layout.z.mul(5).add(frame.x), season.mul(5).add(frame.y)));
  const sample = texture(
    atlas,
    atlasCell
      .add(
        uv()
          .mul(63 / 64)
          .add(0.5 / 64)
      )
      .div(20)
  );
  const far = makeSurfaceMaterial(SURFACE.grass, {
    positionNode: point,
    normalNode: transformNormalToView(vec3(0, 1, 0)),
    colorNode: vec4(mix(sample.rgb, vec3(.78,.83,.87), snowDepth.mul(uv().y, .74)), sample.a),
    alphaTest: 0.4,
    side: THREE.DoubleSide
  });
  assets = { ready: false, geometries: TREE_TYPES.map((_, i) => treeModel(i)), green, deciduous, far };
  return assets;
}

const dummy = new THREE.Object3D();
const color = new THREE.Color();
export function vegetationBatch(rows) {
  if (!rows.length) return null;
  const shared = resources(),
    counts = [0, 0, 0, 0],
    bounds = new THREE.Box3(),
    pt = new THREE.Vector3();
  for (const tree of rows) {
    counts[tree.type]++;
    bounds.expandByPoint(pt.set(tree.x, tree.y, tree.z));
  }
  bounds.expandByScalar(18);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const near = counts.map((count, type) => {
    if (!count) return null;
    const m = new THREE.InstancedMesh(
      shared.geometries[type],
      type === 1 ? shared.green : shared.deciduous,
      count
    );
    m.castShadow = true;
    m.boundingSphere = sphere;
    return m;
  });
  const geometry = new THREE.InstancedBufferGeometry().copy(new THREE.PlaneGeometry(1, 1));
  const roots = new THREE.InstancedBufferAttribute(new Float32Array(rows.length * 4), 4);
  const layout = new THREE.InstancedBufferAttribute(new Float32Array(rows.length * 3), 3);
  geometry.setAttribute('treeRoot', roots);
  geometry.setAttribute('treeLayout', layout);
  geometry.boundingSphere = sphere;
  const far = new THREE.Mesh(geometry, shared.far);
  const meshes = [...near.filter(Boolean), far];
  let lastX = Infinity,
    lastZ = Infinity,
    zone,
    hadAtlas;
  function update(x, z, tileDistance) {
    const band = tileDistance > 332 ? 'far' : tileDistance < 24 ? 'center' : 'border';
    if (hadAtlas === shared.ready && zone === band && (band === 'far' || Math.hypot(x - lastX, z - lastZ) < 6))
      return;
    lastX = x;
    lastZ = z;
    zone = band;
    hadAtlas = shared.ready;
    for (const m of near) if (m) m.count = 0;
    let n = 0;
    for (const t of rows) {
      const sy = t.size * (0.9 + t.rotation * 0.3),
        angle = t.rotation * 2 * Math.PI;
      if (shared.ready && (band === 'far' || (t.x - x) ** 2 + (t.z - z) ** 2 > 150 ** 2)) {
        roots.setXYZW(n, t.x, t.y, t.z, t.size);
        layout.setXYZ(n++, angle, sy, t.type);
      } else {
        const m = near[t.type],
          i = m.count++;
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.y = angle;
        dummy.scale.set(t.size, sy, t.size);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        const g = 0.82 + t.rotation * 0.36;
        m.setColorAt(i, color.setRGB(g * (0.9 + t.rotation * 0.25), g, g * 0.85));
      }
    }
    geometry.instanceCount = n;
    far.visible = n > 0;
    roots.needsUpdate = layout.needsUpdate = true;
    for (const m of near)
      if (m) {
        m.visible = m.count > 0;
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      }
  }
  return {
    meshes,
    update,
    dispose() {
      for (const m of near) m?.dispose();
      geometry.dispose();
    }
  };
}
