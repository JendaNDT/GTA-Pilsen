// Vzdálenost k nejbližšímu bodu dlaždice zahrne i úzký výsek na okraji kruhu.
export const START_RADIUS = 1000;

export function inStartArea(x, z, centerX, centerZ, size) {
  const dx = Math.max(0, Math.abs(centerX - x) - size / 2);
  const dz = Math.max(0, Math.abs(centerZ - z) - size / 2);
  return dx * dx + dz * dz <= START_RADIUS * START_RADIUS;
}
