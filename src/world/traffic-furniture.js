const directions = Array.from({ length: 16 }, (_, i) => {
  const angle = i * Math.PI / 8;
  return [Math.cos(angle), Math.sin(angle)];
});
const layouts = new WeakMap();

function fixtureBase(world, x, z) {
  const y = world.groundY(x, z);
  if (!world.onCarriageway?.(x, z, y, 0.25)) return { x, y, z };
  // Pata může v datech ležet v souběžném jízdním pruhu, zvlášť u děleného přechodu.
  // Najdeme nejbližší místo vedle vozovky a přesuneme tam těleso i jeho zobrazení.
  const reach = Math.max(8, world.maxRoadHalfWidth + 3);
  const freeSpot = (cx, cz) => {
    const cy = world.groundY(cx, cz);
    if (!world.onCarriageway(cx, cz, cy, 0.25) && world.buildingAt(cx, cz) < 0 && !world.isWater(cx, cz)) {
      return { x: cx, y: cy, z: cz };
    }
    return null;
  };
  for (let radius = 0.5; radius <= reach; radius += 0.5) {
    for (const [dx, dz] of directions) {
      const spot = freeSpot(x + radius * dx, z + radius * dz);
      if (spot) return spot;
    }
  }
  // Mezi vozovkou a budovou někdy zbude jen úzký proužek chodníku.
  let best = null, distance2 = reach * reach;
  const extent = Math.floor(reach * 4);
  for (let dx = -extent; dx <= extent; dx++) {
    for (let dz = -extent; dz <= extent; dz++) {
      const candidate = (dx * dx + dz * dz) / 16;
      if (candidate >= distance2) continue;
      const spot = freeSpot(x + dx / 4, z + dz / 4);
      if (spot) {
        best = spot;
        distance2 = candidate;
      }
    }
  }
  return best ?? { x, y, z };
}

// Stejné rozměry používá vykreslení a fyzika. Díly jsou vztažené k patě sloupku.
export function trafficFurniture(world, entry, type) {
  const existing = layouts.get(entry);
  if (existing?.world === world && existing.fixture.type === type) return existing.fixture;
  const { tx, tz, kind, breakableId: id } = entry;
  const base = fixtureBase(world, entry.x, entry.z);
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
  const fixture = { id, type, entry, ...base, pole, panel };
  layouts.set(entry, { world, fixture });
  return fixture;
}
