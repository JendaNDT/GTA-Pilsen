import { mapWaterCurrent } from './water-current.js';

// Pilotní úseky ve světových souřadnicích. Rychlost Radbuzy je herní odhad.
export const RADBUZA = { minX: 145, maxX: 300, minZ: 338, maxZ: 534, speed: 0.55, elevation: 300.95 };
export const OSTENDE = { minX: 1040, maxX: 1710, minZ: -3440, maxZ: -2980, speed: 0, elevation: 311.4 };
export const WATER_PILOT_FADE = 28;
const pilots = [RADBUZA, OSTENDE];
const BANK_WIDTH = 8;
const BANK_SLOPE = 0.12;
const CHANNEL_SLOPE = 0.025;
const MAX_DEPTH = 2.4;
export const BANK_RANGE = BANK_WIDTH + (MAX_DEPTH - BANK_WIDTH * BANK_SLOPE) / CHANNEL_SLOPE;

const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = x => x * x * (3 - 2 * x);

export function waterPilotAt(x, z) {
  return pilots.find(p => x > p.minX && x < p.maxX && z > p.minZ && z < p.maxZ);
}

export function waterPilotTile(x, z, size) {
  return pilots.some(p => x < p.maxX && x + size > p.minX && z < p.maxZ && z + size > p.minZ);
}

export function waterPilotWeight(pilot, x, z) {
  return smooth(clamp01(Math.min(x - pilot.minX, pilot.maxX - x, z - pilot.minZ, pilot.maxZ - z) / WATER_PILOT_FADE));
}

export function waterDepthFromShore(distance) {
  return Math.min(MAX_DEPTH, Math.min(distance, BANK_WIDTH) * BANK_SLOPE +
    Math.max(0, distance - BANK_WIDTH) * CHANNEL_SLOPE);
}

// Směr Radbuzy podle bodů osy toku v podkladech OpenStreetMap.
const axis = [[210.7, 577.1], [202.4, 501.6], [209.9, 469.3], [216.5, 375.3], [246.5, 318]];

export function waterCurrent(pilot, x, z, distance, out) {
  out.vx = out.vz = 0;
  if (pilot !== RADBUZA) return;
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

function levelAt(world, pilot, x, z, terrain, distance) {
  if (!pilot || !Number.isFinite(world.baseElevation)) return terrain;
  // U břehu výška plynule navazuje na terén a na konci úseku na původní hladinu.
  const weight = waterPilotWeight(pilot, x, z) * smooth(clamp01(distance / 4));
  return terrain + (pilot.elevation - world.baseElevation - terrain) * weight;
}

export function waterLevelAt(world, x, z, terrain) {
  const pilot = world.improvedWater && waterPilotAt(x, z);
  if (!pilot) return terrain;
  const distance = world.nearestShore(x, z, 4, world.waterAreaAt?.(x, z))?.[2] ?? 4;
  return levelAt(world, pilot, x, z, terrain, distance);
}

export function sampleWater(world, x, z, out) {
  const improved = world.improvedWater;
  const pilot = improved ? waterPilotAt(x, z) : null;
  const area = improved ? world.waterAreaAt?.(x, z) : -1;
  const distance = improved ? world.nearestShore(x, z, BANK_RANGE, area)?.[2] ?? BANK_RANGE : 0;
  out.level = levelAt(world, pilot, x, z, world.heightAt(x, z), distance);
  out.depth = waterDepthFromShore(distance);
  mapWaterCurrent(world, area, x, z, distance, out);
  if (pilot) {
    const vx = out.vx, vz = out.vz;
    const baseWeight = 1 - waterPilotWeight(pilot, x, z);
    waterCurrent(pilot, x, z, distance, out);
    out.vx += vx * baseWeight;
    out.vz += vz * baseWeight;
  }
  return out;
}

export function waterWalking(depth, submerged, swimming) {
  if (depth >= (swimming ? 0.95 : 1.13)) return 1;
  return Math.min(0.88, smooth(clamp01((submerged - 0.08) / 1.15)));
}
