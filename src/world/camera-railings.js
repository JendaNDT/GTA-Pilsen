import {Ray, Vector3} from 'three/webgpu';
import {CHUNK} from '../config.js';

const ray = new Ray(), hit = new Vector3();
const corners = Array.from({length:8}, () => new Vector3());
const faces = [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7],[3,2,1,0]];

// Kamera sleduje viditelný tvar včetně sklonu. Skrytý díl po odlomení výhled neomezuje.
export function cameraRailFraction(world, x, y, z, bx, by, bz) {
  ray.origin.set(x,y,z);
  ray.direction.set(bx-x,by-y,bz-z);
  const length = ray.direction.length();
  if (length < 0.001) return 1;
  ray.direction.divideScalar(length);
  const minX = Math.min(x,bx), maxX = Math.max(x,bx), minZ = Math.min(z,bz), maxZ = Math.max(z,bz);
  const minY = Math.min(y,by), maxY = Math.max(y,by);
  // Úseky mohou svým koncem ležet v jiné dlaždici než těžiště.
  let closest = length;
  const col = v => Math.floor((v-world.minX)/CHUNK), row = v => Math.floor((v-world.minZ)/CHUNK);
  const endCol = Math.min(world.cols-1,col(maxX+4)), endRow = Math.min(world.rows-1,row(maxZ+4));
  for (let iz = Math.max(0,row(minZ-4)); iz <= endRow; iz++) {
    for (let ix = Math.max(0,col(minX-4)); ix <= endCol; ix++) {
      const edges = world.bridgeEdges.get(iz*world.cols+ix);
      if (!edges) continue;
      for (const edge of edges) {
        if (edge.x < minX-4 || edge.x > maxX+4 || edge.z < minZ-4 || edge.z > maxZ+4 ||
            edge.y < minY-3 || edge.y > maxY+3 || world.breakables.state(edge.id) !== 'intact') continue;
        for (let i = 0; i < 4; i++) {
          corners[i].fromArray(edge.corners[i]);
          corners[i+4].copy(corners[i]).y += edge.height;
        }
        for (const [a,b,c,d] of faces) {
          if (ray.intersectTriangle(corners[a],corners[b],corners[c],false,hit) ||
              ray.intersectTriangle(corners[a],corners[c],corners[d],false,hit)) {
            closest = Math.min(closest, ray.origin.distanceTo(hit));
          }
        }
      }
    }
  }
  return closest/length;
}
