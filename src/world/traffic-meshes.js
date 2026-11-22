import * as THREE from 'three/webgpu';
import { makeSurfaceMaterial } from './materials.js';
import { SURFACE } from './material-table.js';
import { trafficFurniture } from './traffic-furniture.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const FACE = new THREE.PlaneGeometry(1, 1);
const BULB = new THREE.CircleGeometry(1, 10);
const PROPS = makeSurfaceMaterial(SURFACE.metal);
const LIGHTS = new THREE.MeshBasicMaterial({ toneMapped: false });
const materials = new Map();
const transform = new THREE.Object3D();
const hiddenScale = new THREE.Vector3(0, 0, 0);
const unitScale = new THREE.Vector3(1, 1, 1);
const bendPosition = new THREE.Vector3();
const bendRotation = new THREE.Quaternion();
const bendMatrix = new THREE.Matrix4();
const instanceMatrix = new THREE.Matrix4();
const steel = new THREE.Color(0x73787a), housing = new THREE.Color(0x25272a);
const poleMaterial = PROPS.clone();
const housingMaterial = PROPS.clone();
poleMaterial.color.copy(steel);
housingMaterial.color.copy(housing);

function signMaterial(kind, speed) {
  const key = kind + (speed ?? '');
  if (materials.has(key)) return materials.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const g = canvas.getContext('2d');
  const path = (pts, fill) => {
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.closePath(); g.fillStyle = fill; g.fill();
  };
  const circle = (radius, color) => {
    g.beginPath(); g.arc(64, 64, radius, 0, Math.PI * 2); g.fillStyle = color; g.fill();
  };
  const text = (s, size, color) => {
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${size}px Arial, sans-serif`;
    g.fillStyle = color; g.fillText(s, 64, 66);
  };
  const red = '#c31c22', white = '#fdfcf5';
  if (kind === 'stop') {
    const octagon = (r) => Array.from({length: 8}, (_, i) => {
      const a = Math.PI * (i + 0.5) / 4;
      return [64 + Math.sin(a) * r, 64 + Math.cos(a) * r];
    });
    path(octagon(64), white); path(octagon(59), red); text('STOP', 33, white);
  } else if (kind === 'yield') {
    path([[3, 19], [125, 19], [64, 123]], red);
    path([[20, 30], [108, 30], [64, 104]], white);
  } else if (kind === 'priority') {
    path([[64, 4], [124, 64], [64, 124], [4, 64]], '#353535');
    path([[64, 8], [120, 64], [64, 120], [8, 64]], white);
    path([[64, 20], [108, 64], [64, 108], [20, 64]], '#efc330');
  } else if (kind === 'oneway') {
    path([[10, 10], [118, 10], [118, 118], [10, 118]], white);
    path([[15, 15], [113, 15], [113, 113], [15, 113]], '#1d57a3');
    path([[64, 23], [92, 59], [74, 59], [74, 102], [54, 102], [54, 59], [36, 59]], white);
  } else {
    circle(62, white); circle(58, red);
    if (kind === 'noEntry') path([[19, 53], [109, 53], [109, 75], [19, 75]], white);
    else circle(44, white);
    if (kind === 'speed') text(String(speed), speed >= 100 ? 34 : 43, '#181818');
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map, alphaTest: 0.45 });
  materials.set(key, mat);
  return mat;
}

function instance(mesh, index, x, y, z, yaw, width, height, depth) {
  transform.position.set(x, y, z);
  transform.rotation.set(0, yaw, 0);
  transform.scale.set(width, height, depth);
  transform.updateMatrix();
  mesh.setMatrixAt(index, transform.matrix);
}

function furnitureInstance(mesh, index, fixture, part) {
  instance(mesh, index, fixture.x + part.x, fixture.y + part.y, fixture.z + part.z,
    part.yaw, part.width, part.height, part.depth);
}

export function trafficFragment(fixture, name) {
  const part = fixture[name];
  const face = name === 'panel' && fixture.type === 'sign';
  const { kind, speed } = fixture.entry;
  const material = face ? signMaterial(kind, speed) : name === 'pole' ? poleMaterial : housingMaterial;
  const mesh = new THREE.Mesh(face ? FACE : BOX, material);
  mesh.scale.set(part.width, part.height, part.depth);
  return mesh;
}

export function buildTrafficMeshes(world, entries) {
  const group = new THREE.Group();
  const poles = new THREE.InstancedMesh(BOX, PROPS, entries.signs.length + entries.heads.length * 2 + (entries.posts?.length ?? 0));
  let pole = 0;
  const bySign = new Map();
  const visuals = [];
  const remember = (fixture, instances) => {
    const { id, x, y, z } = fixture;
    const toOrigin = new THREE.Matrix4().makeTranslation(-x, -y, -z);
    const originals = instances.map(([mesh, i]) => {
      const matrix = new THREE.Matrix4();
      mesh.getMatrixAt(i, matrix);
      return matrix;
    });
    let intact = true;
    const visual = {
      id,
      show(show) {
        if (intact && show) return;
        intact = show;
        const pose = world.breakables.damaged.get(id)?.pose;
        if (pose) {
          bendPosition.set(pose.x, pose.y, pose.z);
          bendRotation.set(pose.qx, pose.qy, pose.qz, pose.qw);
          bendMatrix.compose(bendPosition, bendRotation, unitScale).multiply(toOrigin);
        }
        instances.forEach(([mesh, i], j) => {
          const source = originals[j];
          if (show) mesh.setMatrixAt(i, source);
          else {
            instanceMatrix.copy(source);
            if (pose) instanceMatrix.premultiply(bendMatrix);
            else instanceMatrix.scale(hiddenScale);
            mesh.setMatrixAt(i, instanceMatrix);
          }
          mesh.instanceMatrix.needsUpdate = true;
        });
      },
    };
    world.breakables.attach(visual);
    visuals.push(visual);
  };
  for (const sign of entries.signs) {
    const material = signMaterial(sign.kind, sign.speed);
    if (!bySign.has(material)) bySign.set(material, []);
    bySign.get(material).push(sign);
  }
  const setPole = (fixture) => {
    furnitureInstance(poles, pole, fixture, fixture.pole);
    poles.setColorAt(pole++, steel);
  };
  for (const entry of entries.posts ?? []) {
    const fixture = trafficFurniture(world, entry, 'bollard');
    const i = pole;
    setPole(fixture);
    remember(fixture, [[poles, i]]);
  }
  for (const [mat, signs] of bySign) {
    const faces = new THREE.InstancedMesh(FACE, mat, signs.length);
    signs.forEach((sign, i) => {
      const fixture = trafficFurniture(world, sign, 'sign');
      const from = pole;
      setPole(fixture);
      furnitureInstance(faces, i, fixture, fixture.panel);
      remember(fixture, [[poles, from], [faces, i]]);
    });
    group.add(faces);
  }
  const bulbs = new THREE.InstancedMesh(BULB, LIGHTS, entries.heads.reduce((n, h) => n + (h.kind === 'pedestrian' ? 2 : 3), 0));
  const heads = [];
  let lens = 0;
  for (const head of entries.heads) {
    const { tx, tz, kind } = head;
    const fixture = trafficFurniture(world, head, 'signal');
    const { x, y, z, panel } = fixture;
    const pedestrian = kind === 'pedestrian';
    const lights = pedestrian ? ['red', 'green'] : ['red', 'amber', 'green'];
    const instances = [[poles, pole], [poles, pole + 1]];
    setPole(fixture);
    furnitureInstance(poles, pole, fixture, panel);
    poles.setColorAt(pole++, housing);
    heads.push({ head, from: lens, lights, color: '' });
    for (let j = 0; j < lights.length; j++) {
      const dy = ((lights.length - 1) / 2 - j) * (pedestrian ? 0.25 : 0.28);
      const radius = pedestrian ? 0.086 : 0.105;
      instances.push([bulbs, lens]);
      instance(bulbs, lens++, x - tx * 0.208, y + panel.y + dy, z - tz * 0.208, panel.yaw, radius, radius, 1);
    }
    remember(fixture, instances);
  }
  if (pole) group.add(poles);
  if (lens) group.add(bulbs);
  const colors = { red: new THREE.Color(0xff2926), amber: new THREE.Color(0xffbd1a), green: new THREE.Color(0x27fa61),
    off: new THREE.Color(0x272925) };
  const update = () => {
    let dirty = false;
    for (const entry of heads) {
      const color = world.traffic.light(entry.head);
      if (color === entry.color) continue;
      entry.color = color; dirty = true;
      entry.lights.forEach((light, i) => bulbs.setColorAt(entry.from + i, colors[light === color ? light : 'off']));
    }
    if (dirty) bulbs.instanceColor.needsUpdate = true;
  };
  update();
  return { group, update, dispose: () => {
    for (const visual of visuals) world.breakables.detach(visual);
    for (const mesh of group.children) mesh.dispose();
  } };
}
