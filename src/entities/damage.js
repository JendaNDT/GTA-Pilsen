// Vlastní geometrii dostane až poškozený vůz. Původní tvar zůstává společný.
import { Box3, BufferAttribute, BufferGeometry, Mesh, Vector3 } from 'three/webgpu';

const names = ['hood', 'frontBumper', 'rearBumper', 'leftDoor', 'rightDoor'];
const vertex = new Vector3(), delta = new Vector3(), center = new Vector3();
const bounds = new Box3();

export function panelLevels(saved) {
  const levels = {};
  for (const name of names) {
    if (Number.isFinite(saved?.[name]) && saved[name] > 0) levels[name] = Math.min(1, saved[name]);
  }
  return levels;
}

export const enginePower = car => Math.min(1, Math.max(0, (car.health ?? 100) / 60));
export function steeringPull(car) {
  const side = (car.damage?.leftDoor ?? 0) - (car.damage?.rightDoor ?? 0);
  return side * 0.35 * Math.max(0, 1 - (car.health ?? 100) / 40);
}

function source(mesh) {
  return mesh.userData.undamaged ?? mesh.geometry;
}

function writable(mesh) {
  if (!mesh.userData.undamaged) {
    mesh.userData.undamaged = mesh.geometry;
    mesh.geometry = mesh.geometry.clone();
  }
  return mesh.geometry;
}

function panelBox(batches, range) {
  const positions = source(batches[range.batch]).attributes.position;
  bounds.makeEmpty();
  for (let i = range.start; i < range.start + range.count; i++) {
    bounds.expandByPoint(vertex.fromBufferAttribute(positions, i));
  }
  return bounds;
}

function deform(car, name, point, normal, amount, spawn) {
  const { panels, batches } = car.mesh.userData;
  const range = panels[name], mesh = batches[range.batch];
  for (const [batch, target] of Object.entries(batches)) {
    const geom = writable(target), positions = geom.attributes.position;
    const original = source(target).attributes.position;
    const hidden = Object.entries(panels).filter(([key, part]) =>
      part.batch === batch && car.damage[key] === 1 && key !== name);
    // Kola jsou v druhé části detailů a drží si vlastní tvar.
    const end = batch === 'detail' ? panels.rearBumper.start + panels.rearBumper.count : positions.count;
    for (let i = 0; i < end; i++) {
      if (hidden.some(([, part]) => i >= part.start && i < part.start + part.count)) continue;
      vertex.fromBufferAttribute(original, i);
      const falloff = 1 - point.distanceTo(vertex) / 2.1;
      if (falloff <= 0) continue;
      delta.fromBufferAttribute(positions, i).sub(vertex).addScaledVector(normal, amount * falloff);
      vertex.add(delta.clampLength(0, 0.25));
      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    positions.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
  }
  const geom = mesh.geometry, positions = geom.attributes.position;
  if (car.damage[name] === 1) {
    if (spawn) {
      const loose = new BufferGeometry();
      for (const [key, attr] of Object.entries(geom.attributes)) {
        const start = range.start * attr.itemSize, end = (range.start + range.count) * attr.itemSize;
        loose.setAttribute(key, new BufferAttribute(attr.array.slice(start, end), attr.itemSize, attr.normalized));
      }
      loose.computeBoundingBox();
      loose.boundingBox.getCenter(center);
      const localCenter = center.clone();
      loose.translate(-center.x, -center.y, -center.z);
      spawn(car, new Mesh(loose, mesh.material), localCenter);
    }
    for (let i = range.start; i < range.start + range.count; i++) positions.setXYZ(i, 0, 0, 0);
    positions.needsUpdate = true;
    geom.computeBoundingSphere();
  }
}

export function dentCar(car, speed, point, normal, spawn) {
  if (!car.mesh?.userData.panels || speed <= 3) return;
  const { panels, batches } = car.mesh.userData;
  let nearest, distance = Infinity;
  for (const [name, part] of Object.entries(panels)) {
    if (car.damage?.[name] === 1) continue;
    const d = panelBox(batches, part).distanceToPoint(point);
    if (d < distance) { nearest = name; distance = d; }
  }
  if (!nearest || distance > 1.25) return;
  car.damage ??= {};
  const amount = (speed - 3) / 24;
  car.damage[nearest] = Math.min(1, (car.damage[nearest] ?? 0) + amount);
  deform(car, nearest, point, normal, Math.min(0.45, amount * 0.5), spawn);
}

export function restorePanels(car, saved) {
  releasePanels(car);
  car.damage = {};
  const { panels, batches } = car.mesh.userData;
  for (const [name, level] of Object.entries(panelLevels(saved))) {
    car.damage[name] = level;
    const point = panelBox(batches, panels[name]).getCenter(new Vector3());
    const inward = new Vector3(-point.x, 0.6 - point.y, -point.z).normalize();
    deform(car, name, point, inward, level * 0.4);
  }
}

export function releasePanels(car) {
  for (const mesh of Object.values(car.mesh.userData.batches)) {
    if (!mesh.userData.undamaged) continue;
    mesh.geometry.dispose();
    mesh.geometry = mesh.userData.undamaged;
    delete mesh.userData.undamaged;
  }
}
