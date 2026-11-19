// Herní měsíční váhy pro západní Čechy. Nejde o aktuální předpověď.
const months = [
  // průměrná teplota, podíl srážkových, mlhavých a zatažených úseků
  [-1, .26, .16, .32], [0, .23, .12, .31], [4, .20, .10, .28], [9, .22, .06, .23],
  [13, .27, .04, .20], [17, .28, .04, .18], [19, .27, .03, .16], [18, .24, .04, .16],
  [14, .22, .08, .20], [9, .22, .15, .25], [4, .25, .17, .31], [0, .26, .16, .32]
];
export const conditions = {
  clear: [0.08, 0, 0, 0], partly: [0.41, 0, 0, 0], cloudy: [0.9, 0, 0, 0],
  rain: [0.93, 0.78, 0, 0.22], storm: [1, 1, 0, 0.37],
  fog: [0.64, 0, 0, 1], snow: [0.94, 0, 0.9, 0.36]
};
const blockSeconds = 3 * 3600, stepSeconds = 300;
const clamp = value => Math.min(1, Math.max(0, value));
const mix = (a, b, t) => a + (b - a) * t;

function random(id, salt) {
  let h = Math.imul(id ^ salt, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function weatherBlock(id) {
  const day = Math.floor(id / 8);
  const [mean, precip, fog, overcast] = months[new Date(day * 86400000).getUTCMonth()];
  const temperature = mean + (random(day, 671) - 0.5) * 11;
  const roll = random(id, 827);
  let kind;
  if (roll < precip) {
    if (temperature < 1) kind = 'snow';
    else kind = temperature > 15 && random(id, 917) < .21 ? 'storm' : 'rain';
  } else if (roll < precip + fog) kind = 'fog';
  else if (roll < precip + fog + overcast) kind = 'cloudy';
  else kind = random(id, 531) < .49 ? 'clear' : 'partly';
  return { kind, temperature, transition: 600 + 1200 * random(id, 5318) };
}

function atmosphere(time, get) {
  const id = Math.floor(time / blockSeconds), current = get(id), previous = get(id - 1);
  const t = clamp((time - id * blockSeconds) / current.transition);
  const fraction = t * t * (3 - 2 * t);
  const a = conditions[previous.kind], b = conditions[current.kind];
  return { kind: fraction < .5 ? previous.kind : current.kind, cloud: mix(a[0], b[0], fraction),
    rain: mix(a[1], b[1], fraction), flakes: mix(a[2], b[2], fraction), fog: mix(a[3], b[3], fraction),
    temperature: mix(previous.temperature, current.temperature, fraction) };
}

export class Weather {
  constructor(forced = null) {
    this.forced = Object.hasOwn(conditions, forced) ? forced : null;
    this.mode = 'variable';
    this.wet = this.snow = 0;
    this.blocks = new Map();
    this.waterSamples = new Map();
    this.getBlock = id => {
      if (!this.blocks.has(id)) {
        const block = weatherBlock(id);
        if (this.forced) {
          block.kind = this.forced;
          if (this.forced === 'snow') block.temperature = -3;
        }
        this.blocks.set(id, block);
      }
      return this.blocks.get(id);
    };
  }

  // Voda vyschne do šesti hodin. Stopy sněžení lze dohledat do druhého dne.
  surfaceAtStep(step) {
    if (this.waterSamples.has(step)) return this.waterSamples.get(step);
    let wet = 0, snow = 0;
    for (let back = 288; back > 0; back--) {
      const state = atmosphere((step - back + .5) * stepSeconds, this.getBlock);
      wet = clamp(wet + state.rain * .18 - (1 - state.rain) * (.014 + Math.max(0, state.temperature) * .001));
      snow = clamp(snow + state.flakes * .057 - (1 - state.flakes) * (.004 + Math.max(0, state.temperature) * .006));
    }
    const sample = { wet, snow };
    this.waterSamples.set(step, sample);
    return sample;
  }

  update(time) {
    if (this.mode === 'clear') {
      Object.assign(this, { kind: 'clear', cloud: .08, rain: 0, flakes: 0, fog: 0, wet: 0, snow: 0 });
      return;
    }
    if (this.blocks.size > 80) this.blocks.clear();
    if (this.waterSamples.size > 32) this.waterSamples.clear();
    Object.assign(this, atmosphere(time, this.getBlock));
    const step = Math.floor(time / stepSeconds);
    const a = this.surfaceAtStep(step), b = this.surfaceAtStep(step + 1);
    const t = time / stepSeconds - step;
    this.wet = mix(a.wet, b.wet, t);
    this.snow = mix(a.snow, b.snow, t);
  }

  surfaceGrip(x, z) {
    // Místní materiál (asfalt, dlažba, hlína) zůstává součástí dotazu světa.
    return mix(mix(1, .7, this.wet), .35, this.snow);
  }
}
