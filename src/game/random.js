const UINT32_RANGE = 2 ** 32;
const EFFECTS_SEED_MASK = 0xa511e9b3;

function next(state) {
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}

export function parseSeed(value) {
  if (typeof value !== 'string' || !/^[+-]?\d+$/.test(value)) return null;
  const seed = Number(value);
  return Number.isSafeInteger(seed) ? seed >>> 0 : null;
}

export function createRandom(initialSeed) {
  let seed, simulation, effects;

  function reseed(value) {
    seed = value >>> 0;
    simulation = seed;
    effects = seed ^ EFFECTS_SEED_MASK;
  }

  reseed(initialSeed);
  return {
    get seed() { return seed; },
    reseed,
    simulationRandom() {
      simulation = next(simulation);
      return simulation / UINT32_RANGE;
    },
    effectsRandom() {
      effects = next(effects);
      return effects / UINT32_RANGE;
    },
  };
}

const random = createRandom(0);

export function initializeRandom(value) {
  random.reseed(parseSeed(value) ?? crypto.getRandomValues(new Uint32Array(1))[0]);
}

export const getRandomSeed = () => random.seed;
export const simulationRandom = random.simulationRandom;
export const effectsRandom = random.effectsRandom;
