import * as THREE from 'three/webgpu';
import { makeSurfaceMaterial } from '../world/materials.js';
import { SURFACE } from '../world/material-table.js';

const displayGeometry = new THREE.PlaneGeometry(2.1, 0.5);
const recessGeometry = new THREE.PlaneGeometry(1.16, 2.06);
const panelGeometry = new THREE.PlaneGeometry(0.54, 2.0);
const recessMaterial = new THREE.MeshBasicMaterial({ color: 0x131b24 });
const panelMaterial = makeSurfaceMaterial(SURFACE.transitMetal, { color: 0x566f7e });

export function addTransitDisplay(mesh, length, ref, destination) {
  const sign = mesh.userData.sign;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 120;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#11191d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = sign?.color ?? '#ffc56d';
  ctx.font = '700 64px Arial';
  ctx.fillText(ref, 18, 83, 108);
  ctx.font = '700 36px Arial';
  ctx.fillText(destination, 139, 74, 355);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const display = new THREE.Mesh(displayGeometry, material);
  if (sign) {
    display.position.set(0, sign.y, sign.z);
    display.rotation.x = sign.tilt;
    display.scale.setScalar(sign.width / 2.1);
    if (sign.sideX) {
      for (const side of [-1, 1]) {
        const board = new THREE.Mesh(displayGeometry, material);
        board.position.set(side * sign.sideX, sign.sideY, sign.sideZ);
        board.rotation.y = side * Math.PI / 2;
        board.scale.set(0.52, 0.38, 1);
        mesh.add(board);
      }
    }
  } else display.position.set(0, 2.54, length / 2 + 0.015);
  mesh.add(display);
  return material;
}

export function addTransitDoors(mesh, centers) {
  return centers.map((z) => {
    const door = new THREE.Group();
    door.rotation.y = -Math.PI / 2;
    door.position.set(-1.265, 1.35, z);
    const recess = new THREE.Mesh(recessGeometry, recessMaterial);
    const left = new THREE.Mesh(panelGeometry, panelMaterial);
    const right = new THREE.Mesh(panelGeometry, panelMaterial);
    left.position.set(-0.28, 0, 0.012);
    right.position.set(0.28, 0, 0.012);
    door.add(recess, left, right);
    mesh.add(door);
    return [left, right];
  });
}

export function setTransitDoors(doors, fraction) {
  const gap = 0.28 + fraction * 0.52;
  for (const [left, right] of doors) {
    left.position.x = -gap;
    right.position.x = gap;
  }
}

const indicatorGeometry = new THREE.BoxGeometry(0.14, 0.16, 0.12);
const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xffb41a });

export function addDepartureIndicator(body, length) {
  const group = new THREE.Group();
  for (const end of [-1, 1]) {
    const light = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    light.position.set(1.13, 0.93, end * (length / 2 - 0.03));
    group.add(light);
  }
  group.visible = false;
  body.add(group);
  return group;
}
