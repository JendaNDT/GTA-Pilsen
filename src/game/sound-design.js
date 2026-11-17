const VEHICLES = {
  car: { wave: 'sawtooth', tone: 35, rise: 105, level: 0.044, noise: 0.048 },
  bus: { wave: 'sawtooth', tone: 29, rise: 67, level: 0.066, noise: 0.061 },
  tram: { wave: 'triangle', tone: 79, rise: 185, level: 0.076, noise: 0.105 },
  trolleybus: { wave: 'triangle', tone: 92, rise: 190, level: 0.065, noise: 0.061 },
};

export const effectRange = {
  horn: 150, bell: 110, open: 39, close: 39, door: 31, crash: 83, splash: 66, speech: 41,
};

export function soundChannel(ctx, target) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const panner = ctx.createStereoPanner();
  const gain = ctx.createGain();
  filter.connect(panner).connect(gain).connect(target);
  return {
    input: filter, panner, gain,
    apply(field, t, smooth) {
      if (smooth) {
        panner.pan.setTargetAtTime(field.pan, t, 0.045);
        filter.frequency.setTargetAtTime(field.lowpass, t, 0.05);
        gain.gain.setTargetAtTime(field.gain, t, 0.055);
      } else {
        panner.pan.value = field.pan;
        filter.frequency.value = field.lowpass;
        gain.gain.value = field.gain;
      }
    },
    disconnect() { filter.disconnect(); panner.disconnect(); gain.disconnect(); },
  };
}

export function soundBuffers(ctx) {
  let seed = 291437;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  const make = (seconds, sample) => {
    const buffer = ctx.createBuffer(1, Math.round(seconds * ctx.sampleRate), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = sample(i / ctx.sampleRate);
    return buffer;
  };
  const tau = Math.PI * 2;
  return {
    noise: make(2, random),
    rotor: make(2, (t) => {
      const phase = (t * 24) % 1;
      const pulse = Math.exp(-phase * 11) * (1 - Math.exp(-phase * 90));
      return pulse * (0.55 * Math.sin(tau * 78 * t) + random() * 0.35)
        + 0.12 * Math.sin(tau * 48 * t);
    }),
    forge: make(4, (t) => {
      const phase = (t + 0.2) % 1.25, knock = Math.exp(-phase * 18);
      const gear = t % 0.31;
      const end = Math.min(1, t * 25, (4 - t) * 25);
      return end * (knock * (Math.sin(tau * 87 * t) * 0.64 + Math.sin(tau * 283 * t) * 0.21
        + Math.sin(tau * 489 * t) * 0.11) + Math.exp(-gear * 36) * random() * 0.18);
    }),
  };
}

export class LoopVoice {
  constructor(ctx, master, buffers, kind) {
    this.channel = soundChannel(ctx, master);
    this.nodes = [];
    this.sources = [];
    this.profile = VEHICLES[kind];
    this.kind = kind;
    if (this.profile) {
      this.motor = this.layer(ctx, 'lowpass', this.profile.wave);
      this.rolling = this.layer(ctx, 'bandpass', buffers.noise);
    } else {
      this.bed = this.layer(ctx, kind === 'weir' ? 'bandpass' : 'lowpass', buffers[kind] ?? buffers.noise);
    }
  }

  layer(ctx, filterType, material) {
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = 0.65;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const source = typeof material === 'string' ? ctx.createOscillator() : ctx.createBufferSource();
    if (typeof material === 'string') source.type = material;
    else { source.buffer = material; source.loop = true; }
    this.sources.push(source);
    this.nodes.push(source, filter, gain);
    source.connect(filter).connect(gain).connect(this.channel.input);
    source.start();
    return { source, filter, gain };
  }

  update(state, field, ctx) {
    const t = ctx.currentTime;
    this.channel.apply(field, t, true);
    const target = (parameter, value) => parameter.setTargetAtTime(value, t, 0.075);
    const { speed = 0, power = 0, road, engine, siren, skid = 0 } = state;
    if (this.profile) {
      const p = this.profile;
      const rate = Math.min(1, speed / (this.kind === 'car' ? 27 : 14));
      const electric = this.kind === 'tram' || this.kind === 'trolleybus';
      target(this.motor.source.frequency, p.tone + p.rise * rate + power * (electric ? 18 : 24));
      target(this.motor.filter.frequency, 260 + rate * 1150 + power * 510);
      target(this.motor.gain.gain, engine ? p.level * (electric ? 0.13 + rate * 0.48 + power * 0.45 : 0.4 + rate * 0.42 + power * 0.36) : 0);
      const rough = road === 'loose';
      const rolling = this.kind === 'tram' ? 510 + rate * 1000 : rough ? 900 + rate * 600 : 380 + rate * 1040;
      target(this.rolling.filter.frequency, skid > 0.1 ? 1750 : rolling);
      target(this.rolling.filter.Q, this.kind === 'tram' ? 1.15 : rough ? 0.55 : 0.78);
      target(this.rolling.gain.gain, p.noise * rate * (rough ? 1.65 : 1) + skid * 0.106);
      if (siren && !this.siren) this.siren = this.layer(ctx, 'lowpass', 'triangle');
      if (this.siren) {
        target(this.siren.source.frequency, 665 + 185 * Math.sin(t * 5.8));
        target(this.siren.filter.frequency, 2600);
        target(this.siren.gain.gain, siren ? 0.15 : 0);
      }
    } else {
      const profile = {
        rotor: [620 + power * 195, 0.35, Math.max(0.18, power)],
        water: [1060, 0.13, 0.93],
        weir: [930, 0.24, 0.83],
        forge: [1250, 0.42, 1],
      }[this.kind];
      target(this.bed.filter.frequency, profile[0]);
      target(this.bed.gain.gain, profile[1] * power);
      target(this.bed.source.playbackRate, profile[2]);
    }
  }

  dispose() {
    for (const source of this.sources) source.stop();
    for (const node of this.nodes) node.disconnect();
    this.channel.disconnect();
  }
}

export function tone(ctx, out, time, type, f0, f1, duration, volume) {
  const source = ctx.createOscillator();
  source.type = type;
  source.frequency.setValueAtTime(f0, time);
  source.frequency.exponentialRampToValueAtTime(f1, time + duration);
  return envelope(ctx, source, out, time, duration, volume);
}

function envelope(ctx, source, out, time, duration, volume, filter) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0004, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0005, volume), time + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0004, time + duration);
  source.connect(filter ?? gain);
  if (filter) filter.connect(gain);
  gain.connect(out);
  source.start(time);
  source.stop(time + duration + 0.01);
  source.onended = () => { source.disconnect(); filter?.disconnect(); gain.disconnect(); };
  return source;
}

export function noise(ctx, out, buffer, time, duration, frequency, volume, type = 'lowpass') {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = 0.8;
  return envelope(ctx, source, out, time, duration, volume, filter);
}
