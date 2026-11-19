// Stejné rozměry používá vykreslení a fyzika. Díly jsou vztažené k patě sloupku.
export function trafficFurniture(world, entry, type) {
  const { x, z, tx, tz, kind, breakableId: id } = entry;
  const y = world.groundY(x, z);
  const yaw = Math.atan2(-tx, -tz);
  const pedestrian = kind === 'pedestrian';
  const sign = type === 'sign';
  const height = sign ? 2.32 : pedestrian ? 2.45 : 3.3;
  const size = kind === 'stop' ? 0.83 : 0.68;
  const offset = sign ? 0.045 : 0.11;
  const pole = { x: 0, y: height / 2, z: 0, yaw: 0, width: 0.065, height, depth: 0.065 };
  const panel = {
    x: -tx * offset,
    y: sign ? 2.36 : height,
    z: -tz * offset,
    yaw,
    width: sign ? size : pedestrian ? 0.27 : 0.35,
    height: sign ? size : pedestrian ? 0.54 : 0.96,
    depth: sign ? 0.05 : 0.18,
  };
  return { id, type, entry, x, y, z, pole, panel };
}
