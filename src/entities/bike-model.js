import * as THREE from 'three/webgpu';
import { Parts } from './models.js';
import { BIKE_RADIUS } from '../physics/bike-motion.js';

const color = hex => new THREE.Color(hex).toArray();
const enamel = color(0x559847), rubber = color(0x24282a), steel = color(0x929d9e), black = color(0x1c2521);
let parts;

function tube(shape, from, to, radius, shade) {
  const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  const axis = end.clone().sub(start);
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  const geometry = new THREE.CylinderGeometry(radius, radius, axis.length(), 7).toNonIndexed();
  geometry.applyQuaternion(rotation);
  const center = start.lerp(end, .5);
  geometry.translate(center.x, center.y, center.z);
  shape.mesh(geometry, shade);
}

function geometry() {
  const frame = new Parts(), wheel = new Parts(), crank = new Parts(), fork = new Parts(), rack = new Parts();
  const back = [0, .33, -.56], bottom = [0, .31, -.08], seat = [0, .92, -.29], head = [0, .86, .4];
  for (const [a, b, r] of [
    [back, bottom, .021], [back, seat, .022], [bottom, seat, .024],
    [bottom, head, .048], [[0, .55, -.195], [0, .75, .39], .031],
  ]) tube(frame, a, b, r, enamel);
  frame.box(.18, .053, .245, 0, .927, -.29, black);
  frame.box(.09, .13, .31, 0, .47, .02, black);
  frame.box(.16, .038, .26, 0, .69, -.56, steel);
  frame.box(.061, .03, .028, 0, .72, -.70, color(0xe64d36));
  const tire = new THREE.TorusGeometry(BIKE_RADIUS - .026, .024, 6, 24).toNonIndexed();
  tire.rotateY(Math.PI / 2);
  wheel.mesh(tire, rubber);
  for (const side of [-1, 1]) wheel.ring(.275, .292, side * .013, 0, 0, side, steel, 24);
  for (let i = 0; i < 10; i++) {
    const a = i * Math.PI / 5;
    tube(wheel, [0, 0, 0], [0, .282 * Math.cos(a), .282 * Math.sin(a)], .0032, steel);
  }
  for (const side of [-1, 1]) {
    tube(fork, [side * .045, 0, .16], [side * .065, -.53, .16], .018, enamel);
    tube(crank, [side * .08, 0, 0], [side * .129, side * .14, 0], .013, steel);
    crank.box(.078, .028, .108, side * .166, side * .14, 0, black);
  }
  tube(fork, [0, -.04, .16], [0, .31, -.01], .023, steel);
  tube(fork, [-.28, .31, -.01], [.28, .31, -.01], .016, black);
  fork.box(.055, .045, .044, 0, .044, .15, color(0xf4e6ac));
  rack.box(.09, 1.04, .09, 0, .52, 0, steel);
  rack.box(.38, .3, .052, 0, 1.1, 0, enamel);
  const symbol = color(0xf0f4e5);
  for (const face of [-1, 1]) {
    const z = face * .03, hubs = [-.10, .10];
    for (const x of hubs) {
      const rim = new THREE.TorusGeometry(.052, .006, 4, 14).toNonIndexed();
      rack.mesh(rim.translate(x, 1.07, z), symbol);
    }
    for (const [from, to] of [
      [[-.10, 1.07, z], [-.04, 1.145, z]],
      [[-.04, 1.145, z], [.10, 1.07, z]],
      [[-.10, 1.07, z], [.015, 1.07, z]],
      [[.015, 1.07, z], [-.037, 1.16, z]],
      [[.10, 1.07, z], [.06, 1.16, z]],
      [[.06, 1.16, z], [.09, 1.16, z]],
    ]) tube(rack, from, to, .006, symbol);
  }
  return {
    frame: frame.geometry(), wheel: wheel.geometry(), crank: crank.geometry(), fork: fork.geometry(),
    rack: rack.geometry(), material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .77 }),
  };
}

export function makeBikeMesh() {
  parts ??= geometry();
  const model = new THREE.Group(), steering = new THREE.Group();
  const mesh = part => new THREE.Mesh(parts[part], parts.material);
  const solid = mesh('frame'), rear = mesh('wheel'), front = mesh('wheel'), crank = mesh('crank');
  rear.position.set(0, BIKE_RADIUS, -.56);
  steering.position.set(0, .86, .40);
  front.position.set(0, BIKE_RADIUS - .86, .16);
  crank.position.set(0, .31, -.08);
  steering.add(mesh('fork'), front);
  model.add(solid, rear, steering, crank);
  solid.castShadow = rear.castShadow = front.castShadow = true;
  model.userData = { rear, front, crank, steering };
  return model;
}

export function makeBikeStationPost() {
  parts ??= geometry();
  return new THREE.Mesh(parts.rack, parts.material);
}


function bendLimb(upper, lower, dy, dz, a, b, direction, parent = 0) {
  const distance = Math.max(Math.abs(a - b) + .001, Math.min(Math.hypot(dy, dz), a + b - .001));
  const angle = Math.atan2(-dz, -dy);
  upper.rotation.x = angle - parent - direction * Math.acos((a * a + distance * distance - b * b) / (2 * a * distance));
  lower.rotation.x = direction * (Math.PI - Math.acos((a * a + b * b - distance * distance) / (2 * a * b)));
}

export function poseBikeRider(rider, crank) {
  const chestTilt = .58;
  const shoulderY = 1.105 + .42 * Math.cos(chestTilt), shoulderZ = -.29 + .42 * Math.sin(chestTilt);
  rider.get('panev').position.y = .91;
  rider.get('hrudnik').rotation.x = chestTilt;
  rider.get('hlava').rotation.x = -.45;
  for (const side of [1, -1]) {
    const y = .37 + side * .14 * Math.cos(crank), z = -.08 + side * .14 * Math.sin(crank);
    bendLimb(rider.get('stehno' + side), rider.get('lytko' + side), y - .945, z + .29, .4, .36, 1);
    bendLimb(rider.get('paze' + side), rider.get('predlokti' + side),
      1.17 - shoulderY, .39 - shoulderZ, .275, .29, -1, chestTilt);
  }
}
