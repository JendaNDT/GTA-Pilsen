export const SAVE_KEY = 'plzen-naplno-v1';

const high = { pointLights: 128, headLights: 8, grassRadius: 50, particles: 384, debris: 200, ragdolls: 4, view: 1600, pixelRatio: 2, traffic: 42, peds: 26, parked: 70, treesPerForestChunk: 320,
  shadowCascades: 3, shadowSize: 2048, shadowFar: 750, clouds: 5,
  carLights: true, groundTex: 512, groundTexFar: 256, heritageDetail: true, terrainDetail: true, roadDetail: true, waterDetail: true, treeDetail: true };

export const PROFILES = {
  ultra: { ...high, pointLights: 256, grassRadius: 80, particles: 512, shadowCascades: 4, shadowFar: 900, clouds: 6 },
  high,
  medium: { pointLights: 48, headLights: 0, grassRadius: 30, particles: 192, debris: 100, ragdolls: 2, view: 1100, pixelRatio: 1.5, traffic: 26, peds: 16, parked: 46, treesPerForestChunk: 210,
    shadowCascades: 2, shadowSize: 1024, shadowFar: 600, clouds: 4,
    carLights: true, groundTex: 512, groundTexFar: 256, heritageDetail: true, terrainDetail: true, roadDetail: true, waterDetail: true, treeDetail: true },
  low: { pointLights: 0, headLights: 0, grassRadius: 0, particles: 64, debris: 40, ragdolls: 1, view: 620, pixelRatio: 0.75, traffic: 12, peds: 8, parked: 26, treesPerForestChunk: 110,
    shadowCascades: 0, shadowSize: 0, shadowFar: 0, clouds: 3,
    carLights: false, groundTex: 256, groundTexFar: 256, heritageDetail: false, terrainDetail: false, roadDetail: false, waterDetail: false, treeDetail: false },
};

export function graphicsPreferences(saved) {
  const choice = saved?.choice;
  return {
    choice: Object.hasOwn(PROFILES, choice) ? choice : 'auto',
    automatic: Object.hasOwn(PROFILES, saved?.automatic) ? saved.automatic : null,
  };
}

export function automaticQuality(mobile, cpu, gpu) {
  if (cpu > 8 || (gpu ?? 0) > 13) return 'low';
  if (mobile || cpu > 6 || gpu === null || gpu > 10) return 'medium';
  if (cpu <= 3 && gpu <= 5) return 'ultra';
  return 'high';
}

export function resolutionScale(current, cpu, gpu) {
  if (gpu > 12 || (gpu === null && cpu > 9)) return Math.max(0.6, current * 0.88);
  if (cpu < 6 && (gpu === null || gpu < 9)) return Math.min(1, current * 1.06);
  return current;
}
