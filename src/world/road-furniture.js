// Pevná a uvolněná část používají stejné vrcholy a materiál. Samostatná síť
// vzniká až po nárazu, takže celé zábradlí nepřidává volání vykreslovače.
import { BufferGeometry, Float32BufferAttribute, Mesh } from 'three/webgpu';

export function attachRoadFurniture(registry, group, geometry, material, ranges) {
  return ranges.map(({ fixture, start, end }) => {
    const attribute = geometry.getAttribute('position');
    let original, fragment;
    const clear = () => {
      if (!fragment) return;
      fragment.removeFromParent();
      fragment.geometry.dispose();
      fragment = null;
    };
    const visual = {
      id: fixture.id,
      show(intact) {
        if (intact && !original) return;
        if (!original) {
          original = attribute.array.slice(start, end);
          for (let i = start; i < end; i += 3) attribute.array.set(original.subarray(0, 3), i);
          attribute.addUpdateRange(start, end - start);
          attribute.needsUpdate = true;
        }
        const pose = registry.damaged.get(fixture.id)?.pose;
        if (pose && !intact) {
          if (!fragment) {
            const geo = new BufferGeometry();
            geo.setAttribute('position', new Float32BufferAttribute(original, 3));
            for (const name of ['normal', 'color']) {
              geo.setAttribute(name, new Float32BufferAttribute(geometry.getAttribute(name).array.slice(start, end), 3));
            }
            const uv = geometry.getAttribute('uv');
            if (uv) geo.setAttribute('uv', new Float32BufferAttribute(uv.array.slice(start/3*2,end/3*2),2));
            geo.translate(-fixture.x, -fixture.y, -fixture.z);
            fragment = new Mesh(geo, material);
            fragment.castShadow = fragment.receiveShadow = true;
            group.add(fragment);
          }
          fragment.position.set(pose.x, pose.y, pose.z);
          fragment.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
        } else {
          clear();
          if (intact) {
            attribute.array.set(original, start);
            attribute.addUpdateRange(start, end - start);
            attribute.needsUpdate = true;
            original = null;
          }
        }
      },
      remove: clear,
    };
    registry.attach(visual);
    return visual;
  });
}
