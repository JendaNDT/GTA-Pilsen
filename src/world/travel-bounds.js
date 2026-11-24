// Odstup pohybu od okraje světových dat v metrech.
export const EDGE_MARGIN = { foot: 20, car: 30, heli: 40, transit: 0 };

export function travelBounds(world, mode) {
  const margin = EDGE_MARGIN[mode] ?? 0;
  return { minX: world.playMinX + margin, maxX: world.playMaxX - margin,
    minZ: world.playMinZ + margin, maxZ: world.playMaxZ - margin };
}
