import { Octree } from 'three/addons/math/Octree.js';
import { Triangle, Vector3 } from 'three/webgpu';
import { Exterior } from './mesh.js';
import { breweryGate, gateCenter } from './measured-details.js';

export function gateSite(world) {
  const building = world.buildingAt(...gateCenter);
  if (world.bNames.get(building) !== 'Historická brána Prazdroj') return null;
  const buf = new Exterior(),
    tree = new Octree(),
    triangles = [];
  // Ozdoby leží těsně na kameni. Hlubší strom by stále dělil tytéž překrývající se plochy.
  tree.maxLevel = 3;
  tree.trianglesPerLeaf = 24;
  breweryGate(buf, world);
  for (let i = 0; i < buf.points.length; i += 9) {
    const [a, b, c] = [0, 3, 6].map((offset) => new Vector3().fromArray(buf.points, i + offset));
    const tri = new Triangle(a, b, c);
    if (tri.getArea() < 0.001) continue;
    tree.addTriangle(tri);
    tree.addTriangle(new Triangle(c, b, a));
    triangles.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...c.toArray(), ...b.toArray(), ...a.toArray());
  }
  tree.build();
  return { building, surfaces: [{ tree }], triangles };
}
