import * as THREE from 'three/webgpu';
import { BALL_RADIUS, BALL_STARTS, CUSHIONS, HALF_LENGTH, HALF_WIDTH, POCKET_RADIUS, POCKETS } from '../physics/pool-table.js';

// Jemný vzor sukna kreslíme jednou pro celou hernu, bez externí textury.
function baize() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#287c66';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    for (let x = y % 4; x < 256; x += 4) {
      const shade = (x * 17 + y * 31 + (x ^ y)) % 9;
      ctx.fillStyle = shade < 5 ? '#ffffff10' : '#001c1916';
      ctx.fillRect(x, y, 2, 1);
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 8);
  map.anisotropy = 4;
  return map;
}

export function createPoolModel() {
  const group = new THREE.Group();
  group.position.set(2.27, .81, 1.8);
  const material = (color, roughness = .65) => new THREE.MeshStandardMaterial({ color, roughness });
  const wood = material(0x663c28), felt = new THREE.MeshStandardMaterial({ map: baize(), roughness: .97 }), rubber = material(0x125644);
  const brass = material(0xc29960, .3), dark = material(0x171c19), ivory = material(0xece1bd);
  function part(geometry, finish, x, y, z, parent = group) {
    const mesh = new THREE.Mesh(geometry, finish);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  function box(finish, w, h, l, x, y, z) {
    return part(new THREE.BoxGeometry(w, h, l), finish, x, y, z);
  }
  box(wood, 1.39, .17, 2.55, 0, -.105, 0);
  box(felt, 1.30, .03, 2.44, 0, -.015, 0);
  for (const dx of [-.47, .47]) for (const dz of [-.96, .96]) {
    box(wood, .13, .75, .13, dx, -.48, dz);
    box(brass, .14, .035, .14, dx, -.79, dz);
  }
  for (const { x, z, hx, hz } of CUSHIONS) {
    box(rubber, hx * 2, .038, hz * 2, x, .014, z);
    const long = x !== 0;
    box(wood, long ? .065 : hx * 2, .052, long ? hz * 2 : .065,
      x + Math.sign(x) * (long ? .057 : 0), .008, z + (long ? 0 : Math.sign(z) * .057));
  }
  for (const { x, z } of POCKETS) {
    part(new THREE.CylinderGeometry(POCKET_RADIUS + .012, POCKET_RADIUS + .012, .011, 24), brass, x, .009, z);
    part(new THREE.CylinderGeometry(POCKET_RADIUS, POCKET_RADIUS, .012, 24), dark, x, .016, z);
  }
  const chalk = new THREE.MeshBasicMaterial({ color: 0x80a690, transparent: true, opacity: .5 });
  box(chalk, HALF_WIDTH * 2, .001, .003, 0, .001, -.55);
  const inlay = new THREE.BoxGeometry(.013, .004, .013);
  for (const side of [-1, 1]) {
    for (const n of [-3, -2, -1, 1, 2, 3]) {
      part(inlay, ivory, side * (HALF_WIDTH + .095), .036, n * HALF_LENGTH / 4).rotation.y = Math.PI / 4;
    }
    for (const n of [-1, 0, 1]) {
      part(inlay, ivory, n * HALF_WIDTH / 2, .036, side * (HALF_LENGTH + .095)).rotation.y = Math.PI / 4;
    }
  }
  const sphere = new THREE.SphereGeometry(BALL_RADIUS, 18, 12);
  const shadow = new THREE.MeshBasicMaterial({ color: 0x0c4a38, transparent: true, opacity: .42, depthWrite: false });
  const shadowDisc = new THREE.CircleGeometry(BALL_RADIUS * 1.04, 20);
  const colors = [0xfff7e7, 0xe8a82d, 0x2558a2, 0xb63131];
  const balls = BALL_STARTS.map(([x, z], i) => {
    const ball = part(sphere, material(colors[i], .22), x, BALL_RADIUS, z);
    const contact = part(shadowDisc, shadow, .003, -BALL_RADIUS + .002, .002, ball);
    contact.rotation.x = -Math.PI / 2;
    if (i) {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff2d8';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#202925';
      ctx.font = 'bold 54px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(i), 32, 51);
      const map = new THREE.CanvasTexture(canvas);
      map.colorSpace = THREE.SRGBColorSpace;
      const number = part(new THREE.CircleGeometry(.014, 20), new THREE.MeshBasicMaterial({ map }), 0, BALL_RADIUS, 0, ball);
      number.rotation.x = -Math.PI / 2;
    }
    return ball;
  });
  const cue = new THREE.Group();
  group.add(cue);
  const shaft = part(new THREE.CylinderGeometry(.005, .012, .7, 12), material(0xd5aa6f), -.42, 0, 0, cue);
  shaft.rotation.z = -Math.PI / 2;
  const grip = part(new THREE.CylinderGeometry(.012, .014, .20, 12), wood, -.87, 0, 0, cue);
  grip.rotation.z = -Math.PI / 2;
  const tip = part(new THREE.CylinderGeometry(.005, .005, .008, 10), material(0x83bac0), -.069, 0, 0, cue);
  tip.rotation.z = -Math.PI / 2;
  for (const d of [.10, .17, .24]) part(new THREE.BoxGeometry(.031, .002, .005), ivory, d, -.026, 0, cue);
  cue.visible = false;
  return { group, balls, cue };
}
