import { Box3, BufferAttribute, Frustum, Matrix4, Vector3 } from 'three/webgpu';

const projection = new Matrix4(), frustum = new Frustum();
const blockSize = 48 * 3;

/** Na slabších zařízeních posílá terén a asfalt v jednom volání jen v dosahu záběru. */
export function trimSurfaceToCamera(mesh) {
  const geometry = mesh.geometry, source = geometry.index.array;
  if (source.length < 2 * blockSize) return;
  const position = geometry.getAttribute('position'), point = new Vector3(), boxes = [];
  for (let start = 0; start < source.length; start += blockSize) {
    const box = new Box3(), end = Math.min(start + blockSize, source.length);
    for (let i = start; i < end; i++) box.expandByPoint(point.fromBufferAttribute(position, source[i]));
    boxes.push(box.expandByScalar(0.1));
  }

  // Pořadí původních trojúhelníků musí zůstat stejné i v překryvu asfaltu a značení.
  const index = new BufferAttribute(source.slice(), 1), visible = new Uint8Array(boxes.length).fill(1);
  geometry.setIndex(index);
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(mesh.matrixWorld);
    frustum.setFromProjectionMatrix(projection, camera.coordinateSystem, camera.reversedDepth);
    let changed = false;
    for (let i = 0; i < boxes.length; i++) {
      const inside = Number(frustum.intersectsBox(boxes[i]));
      if (visible[i] !== inside) changed = true;
      visible[i] = inside;
    }
    if (!changed) return;
    let count = 0;
    for (let i = 0; i < visible.length; i++) {
      if (!visible[i]) continue;
      const start = i * blockSize, end = Math.min(start + blockSize, source.length);
      index.array.set(source.subarray(start, end), count);
      count += end - start;
    }
    geometry.setDrawRange(0, count);
    if (count) {
      index.clearUpdateRanges();
      index.addUpdateRange(0, count);
      index.needsUpdate = true;
    }
  };
}
