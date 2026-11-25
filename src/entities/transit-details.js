import * as THREE from 'three/webgpu';

const displayGeometry = new THREE.PlaneGeometry(2.1, 0.5);
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
