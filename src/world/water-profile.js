// Pilotní úseky ve světových souřadnicích. Rychlost Radbuzy je herní odhad.
const radbuza = { minX: 145, maxX: 300, minZ: 322, maxZ: 618, speed: 0.55 };
const ostende = { minX: 1040, maxX: 1710, minZ: -3440, maxZ: -2980, speed: 0 };
const pilots = [radbuza, ostende];
const fade = 28;

const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => x * x * (3 - 2 * x);

export function waterPilotAt(x, z) {
  return pilots.find(p => x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ);
}

export function waterPilotTile(x, z, size) {
  return pilots.some(p => x < p.maxX && x + size > p.minX && z < p.maxZ && z + size > p.minZ);
}

export function waterPilotWeight(pilot, x, z) {
  return smooth(clamp01(Math.min(x - pilot.minX, pilot.maxX - x, z - pilot.minZ, pilot.maxZ - z) / fade));
}

export function waterDepthFromShore(distance) {
  return Math.min(2.4, Math.min(distance, 8) * 0.12 + Math.max(0, distance - 8) * 0.025);
}

// Směr Radbuzy podle bodů osy toku v podkladech OpenStreetMap.
const axis = [[210.7, 577.1], [202.4, 501.6], [209.9, 469.3], [216.5, 375.3], [246.5, 318]];

export function waterCurrent(pilot, x, z, distance, out) {
  out.vx = out.vz = 0;
  if (pilot !== radbuza) return;
  // Průměr delší části osy vyhladí změny směru mezi sousedními mapovými uzly.
  const dx = axisX(z - 20) - axisX(z + 20);
  const speed = pilot.speed * waterPilotWeight(pilot, x, z) * smooth(clamp01(distance / 12));
  const scale = speed / Math.hypot(dx, 40);
  out.vx = dx * scale;
  out.vz = -40 * scale;
}

function axisX(z) {
  let i = 1;
  while (i < axis.length - 1 && z < axis[i][1]) i++;
  const [ax, az] = axis[i - 1], [bx, bz] = axis[i];
  return ax + (bx - ax) * clamp01((z - az) / (bz - az));
}

export function sampleWater(world, x, z, out) {
  const pilot = world.improvedWater ? waterPilotAt(x, z) : null;
  const distance = pilot ? world.nearestShore(x, z, 30)?.[2] ?? 30 : 0;
  const depth = waterDepthFromShore(distance);
  out.level = world.heightAt(x, z);
  out.depth = depth;
  out.pilot = pilot;
  waterCurrent(pilot, x, z, distance, out);
  return out;
}

export function waterWalking(depth, submerged, swimming) {
  if (depth >= (swimming ? 0.95 : 1.13)) return 1;
  return Math.min(0.88, smooth(clamp01((submerged - 0.08) / 1.15)));
}
