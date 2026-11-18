import * as THREE from 'three/webgpu';
import { makeSurfaceMaterial } from './materials.js';
import { SURFACE } from './material-table.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const FACE = new THREE.PlaneGeometry(1, 1);
const BULB = new THREE.CircleGeometry(1, 10);
const PROPS = makeSurfaceMaterial(SURFACE.metal);
const LIGHTS = new THREE.MeshBasicMaterial({ toneMapped: false });
const materials = new Map();
const transform = new THREE.Object3D();

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

export function buildTrafficMeshes(world, entries) {
  const group = new THREE.Group();
  const poles = new THREE.InstancedMesh(BOX, PROPS, entries.signs.length + entries.heads.length * 2);
  let pole = 0;
  const bySign = new Map();
  for (const sign of entries.signs) {
    const material = signMaterial(sign.kind, sign.speed);
    if (!bySign.has(material)) bySign.set(material, []);
    bySign.get(material).push(sign);
  }
  const steel = new THREE.Color(0x73787a), housing = new THREE.Color(0x25272a);
  const setPole = (x, y, z, h) => {
    instance(poles, pole, x, y + h / 2, z, 0, 0.065, h, 0.065);
    poles.setColorAt(pole++, steel);
  };
  for (const [mat, signs] of bySign) {
    const faces = new THREE.InstancedMesh(FACE, mat, signs.length);
    signs.forEach(({ x, z, tx, tz, kind }, i) => {
      const y = world.groundY(x, z), yaw = Math.atan2(-tx, -tz);
      const size = kind === 'stop' ? 0.83 : 0.68;
      setPole(x, y, z, 2.32);
      instance(faces, i, x - tx * 0.045, y + 2.36, z - tz * 0.045, yaw, size, size, 1);
    });
    group.add(faces);
  }
  const bulbs = new THREE.InstancedMesh(BULB, LIGHTS, entries.heads.reduce((n, h) => n + (h.kind === 'pedestrian' ? 2 : 3), 0));
  const heads = [];
  let lens = 0;
  for (const head of entries.heads) {
    const { x, z, tx, tz, kind } = head;
    const y = world.groundY(x, z), yaw = Math.atan2(-tx, -tz);
    const pedestrian = kind === 'pedestrian';
    const height = pedestrian ? 2.45 : 3.3;
    const lights = pedestrian ? ['red', 'green'] : ['red', 'amber', 'green'];
    setPole(x, y, z, height);
    instance(poles, pole, x - tx * 0.11, y + height, z - tz * 0.11, yaw,
      pedestrian ? 0.27 : 0.35, pedestrian ? 0.54 : 0.96, 0.18);
    poles.setColorAt(pole++, housing);
    heads.push({ head, from: lens, lights, color: '' });
    for (let j = 0; j < lights.length; j++) {
      const dy = ((lights.length - 1) / 2 - j) * (pedestrian ? 0.25 : 0.28);
      const radius = pedestrian ? 0.086 : 0.105;
      instance(bulbs, lens++, x - tx * 0.208, y + height + dy, z - tz * 0.208, yaw, radius, radius, 1);
    }
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
    for (const mesh of group.children) mesh.dispose();
  } };
}
