import * as THREE from 'three/webgpu';
import { BALL_RADIUS, LANE_END, LANE_HALF, PIN_PROFILE } from '../physics/bowling-lane.js';

import { createPoolModel } from './pool-table.js';

function bowlingWood() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 1024;
  const paint = canvas.getContext('2d');
  const colors = ['#c5905d', '#e2b37d', '#d8a36e', '#bb8656', '#d4a06c'];
  for (let j = 0; j < 18; j++) {
    const x = j * 14, offset = (j * 97) % 161;
    paint.fillStyle = colors[j % colors.length];
    paint.fillRect(x, 0, 14, 1024);
    paint.fillStyle = '#52383421';
    paint.fillRect(x, 0, 1, 1024);
    for (let y = offset; y < 1024; y += 161) {
      paint.fillRect(x, y, 14, 2);
      paint.fillRect(x + 4 + j % 6, y + 9, 1, 97);
      paint.fillRect(x + 9, y + 47, 1, 106);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function wallSign(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 160;
  const paint = canvas.getContext('2d');
  paint.fillStyle = '#162524';
  paint.fillRect(0, 0, 640, 160);
  paint.fillStyle = '#bd9160';
  paint.fillRect(40, 35, 560, 2);
  paint.fillRect(40, 123, 560, 2);
  paint.textAlign = 'center';
  paint.textBaseline = 'middle';
  paint.fillStyle = '#f4ddaa';
  paint.font = '700 58px Georgia, serif';
  paint.fillText('U PAPÍRNY', 320, 82);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(3.25, .81), new THREE.MeshBasicMaterial({ map }));
  plate.position.set(0, 1.43, LANE_END + .41);
  plate.rotation.y = Math.PI;
  scene.add(plate);
}

export function createBowlingRoom() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c2524);
  const ambient = new THREE.HemisphereLight(0xffe8c6, 0x78978b, 2.05);
  scene.add(ambient);
  const light = new THREE.DirectionalLight(0xffe4bf, 2.25);
  light.position.set(-2.5, 6, 3.8);
  scene.add(light);
  const pinLight = new THREE.DirectionalLight(0xc7ecff, 1.25);
  pinLight.position.set(1.7, 3, 17);
  pinLight.target.position.set(0, 0, 19);
  scene.add(pinLight, pinLight.target);
  const material = (color, roughness = .82) => new THREE.MeshStandardMaterial({ color, roughness });
  const wall = material(0x24423c), panel = material(0x426557);
  const ceiling = new THREE.MeshBasicMaterial({ color: 0x22332e });
  const floor = material(0x7c573c), timber = material(0x755d48, .54), trough = material(0x223238, .42);
  const black = material(0x1a2728), spot = material(0x3b270e);
  const lamps = new THREE.MeshBasicMaterial({ color: 0xffdcaa });
  const cube = (material, width, height, length, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_HALF * 2, LANE_END + 4.5),
    new THREE.MeshStandardMaterial({ map: bowlingWood(), roughness: .34 }));
  lane.rotation.x = -Math.PI / 2;
  lane.position.z = (LANE_END - 4.5) / 2;
  scene.add(lane);
  cube(floor, 7.4, .2, 29, 0, -.29, 8.6);
  cube(ceiling, 7.5, .15, 29, 0, 3.25, 8.6);
  cube(wall, 7.5, 3.4, .15, 0, 1.55, 21.4);
  cube(black, 1.75, .7, .19, 0, .26, LANE_END);
  wallSign(scene);
  for (const side of [-1, 1]) {
    cube(wall, .16, 3.4, 29, side * 3.72, 1.55, 8.6);
    cube(panel, .06, .84, 29, side * 3.60, .38, 8.6);
    cube(timber, 2.85, .15, 29, side * 2.28, -.1, 8.6);
    cube(trough, .26, .08, LANE_END, side * (LANE_HALF + .13), -.19, LANE_END / 2);
    cube(black, .05, .29, LANE_END, side * (LANE_HALF + .29), -.024, LANE_END / 2);
    for (const z of [1, 7, 13, 18.5]) {
      cube(panel, .18, 3.2, .16, side * 3.53, 1.53, z);
      cube(lamps, .065, .08, 2.45, side * 1.44, 3.16, z);
    }
  }
  cube(spot, 1.06, .005, .035, 0, .003, .21);
  for (let i = -3; i <= 3; i++) {
    cube(spot, .025, .004, .105, i * .137, .003, 4.4 + .24 * Math.abs(i));
  }
  const rack = material(0x234d51, .5);
  cube(rack, .44, .58, 1.25, 1.15, .28, -1.12);
  cube(black, .51, .12, 1.3, 1.15, .61, -1.12);
  for (const [i, color] of [0x3b685f, 0x8f4029, 0x2f4169].entries()) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.102, 16, 12), material(color, .28));
    ball.position.set(1.15, .74, -.78 - .26 * i);
    scene.add(ball);
  }

  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16), material(0x176d70, .24)));
  const holes = new THREE.SphereGeometry(.011, 9, 6);
  for (const [x, y, z] of [[-.026, .033, -.099], [.024, .039, -.098], [-.01, .070, -.081]]) {
    const hole = new THREE.Mesh(holes, black);
    hole.position.set(x, y, z);
    ball.add(hole);
  }
  scene.add(ball);
  const outline = new THREE.LatheGeometry(PIN_PROFILE.map(([radius, y]) => new THREE.Vector2(radius, y)), 16);
  const radiusAt = height => {
    const i = PIN_PROFILE.findIndex(([, y]) => y >= height);
    const [inner, a] = PIN_PROFILE[i - 1], [outer, b] = PIN_PROFILE[i];
    return inner + (outer - inner) * (height - a) / (b - a) + .0006;
  };
  const collars = [[.223, .234], [.245, .256]].map(positions =>
    new THREE.LatheGeometry(positions.map(y => new THREE.Vector2(radiusAt(y), y)), 16));
  const ivory = material(0xf9efdb, .33), stripe = material(0xa73527, .45);
  const pins = Array.from({ length: 10 }, () => {
    const pin = new THREE.Group();
    pin.add(new THREE.Mesh(outline, ivory), ...collars.map(geometry => new THREE.Mesh(geometry, stripe)));
    scene.add(pin);
    return pin;
  });
  const guide = new THREE.Group();
  const direction = new THREE.MeshBasicMaterial({ color: 0xffd98f });
  for (const [width, length, z] of [[.015, .58, .57], [.014, .6, 1.41], [.014, .62, 2.25], [.11, .17, 2.7]]) {
    const piece = new THREE.Mesh(width > .1 ? new THREE.ConeGeometry(width / 2, length, 4) :
      new THREE.BoxGeometry(width, .004, length), direction);
    if (width > .1) piece.rotation.x = Math.PI / 2;
    piece.position.set(0, .011, z);
    guide.add(piece);
  }
  scene.add(guide);
  const pool = createPoolModel();
  scene.add(pool.group);
  return { scene, ball, pins, guide, pool, camera: new THREE.PerspectiveCamera(48, 1, .08, 45) };
}
