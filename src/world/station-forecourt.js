// Vchod OSM 4293191657. Podélná osa vede od dveří k Mikulášské, příčná k jižnímu přístřešku.
const length = Math.hypot(-0.915, 0.403);
const along = [-0.915 / length, 0.403 / length];
const across = [along[1], -along[0]];

export const stationPaving = {
  origin: [727.01, 481.92], axisX: along, axisZ: across,
  center: [15.25, 0], half: [16.75, 19.5], edge: 0.65,
  scale: [3, 5], color: [0.45, 0.44, 0.43],
};

// Obal spodního předprostoru včetně přechodu do okolí a pod čelo budovy.
export const forecourtBounds = [678, 457, 745, 523];

export function stationForecourtOffsets(world) {
  const step = world.gradeStep;
  if (!step) return [];
  const [minX, minZ, maxX, maxZ] = forecourtBounds;
  const [ox, oz] = stationPaving.origin;
  const offsets = [];
  for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
    for (let z = Math.ceil(minZ / step) * step; z <= maxZ; z += step) {
      const u = (x - ox) * along[0] + (z - oz) * along[1];
      const v = (x - ox) * across[0] + (z - oz) * across[1];
      const t = Math.min(1, (u + 6) / 4, (42 - u) / 10, (23.5 - Math.abs(v)) / 3.5);
      if (t <= 0) continue;
      // DMR na volné střední ose: 316,2 m u dveří a 315,7 m ve vzdálenosti 28 m.
      // Pod bočními střechami raster interpoluje mezi přízemím a vyšším kolejištěm.
      const floor = 316.2 - 0.018 * u - world.baseElevation;
      const delta = Math.round(100 * t * t * (3 - 2 * t) * (floor - world.terrainHeightAt(x, z)));
      if (delta) offsets.push([x, z, delta]);
    }
  }
  return offsets;
}

// Hrany horních nástupišť nad bočními přístřešky (OSM 874767805 a 1259768628).
// Stejné líce a horní plocha uzavírají svah ve vykreslování i v kolizi.
export function stationRetainingWalls(world) {
  const tiles = new Map();
  if (!world.gradeStep) return tiles;
  for (const [a, b, side] of [
    [[713.93,466.28], [689.92,476.67], -1],
    [[729.68,501.79], [705.95,512.31], 1],
  ]) {
    const point = (end, outward) => [end[0] + across[0] * side * outward, end[1] + across[1] * side * outward];
    const section = end => {
      const [x, z] = end, [bx, bz] = point(end, 4.8);
      const top = world.heightAt(bx, bz) + .04;
      const floor = world.heightAt(x, z) - .15;
      return [[x,floor,z], [x,floor+.85,z], [x,top-.16,z], [x,top,z], [bx,top,bz], [bx,floor,bz]];
    };
    const start = section(a), end = section(b);
    const put = (corners, color) => {
      if (side < 0) corners.reverse();
      const tile = world.chunkIndex(corners.reduce((s,p) => s+p[0], 0)/4, corners.reduce((s,p) => s+p[2], 0)/4);
      if (!tiles.has(tile)) tiles.set(tile, []);
      tiles.get(tile).push({corners, color});
    };
    const stone = [.34,.33,.30], wall = [.53,.50,.43], cap = [.42,.41,.38];
    for (const [i,color] of [stone,wall,cap,cap].entries())
      put([start[i], end[i], end[i+1], start[i+1]], color);
    put([start[0],start[3],start[4],start[5]], stone);
    put([end[5],end[4],end[3],end[0]], stone);
  }
  return tiles;
}
