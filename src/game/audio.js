import { IS_MOBILE, DRIVABLE_MAX } from '../config.js';
import { forgeXZ } from '../world/mill.js';
import { soundField, soundListener, WaterSound } from './sound-field.js';
import { effectRange, LoopVoice, noise, soundBuffers, soundChannel, tone } from './sound-design.js';

const BASE = `${import.meta.env?.BASE_URL || '/'}audio/`;
const MAX_LOOPS = IS_MOBILE ? 8 : 13;
const MAX_EFFECTS = IS_MOBILE ? 5 : 8;
const MAX_PACKS = IS_MOBILE ? 2 : 4;
const SPEECH_LIFETIME = 1.8;
const ONE_SHOTS = {
  horn: (beep) => [beep('horn', 380, 396, 0.36, 0.17, 0, 0.27), beep('horn', 463, 479, 0.35, 0.13, 0.009, 0.26)],
  bell: (beep) => [beep('sine', 1130, 1120, 0.44, 0.36), beep('sine', 1735, 1729, 0.31, 0.19),
    beep('sine', 1130, 1120, 0.39, 0.29, 0.19), beep('sine', 1735, 1729, 0.28, 0.13, 0.19)],
  open: (beep, air) => [air(0.58, 2080, 0.24, 0, 'bandpass'), beep('triangle', 122, 68, 0.125, 0.19, 0.12)],
  close: (beep, air) => [air(0.43, 1660, 0.20, 0, 'bandpass'), beep('triangle', 106, 50, 0.15, 0.30, 0.26)],
  door: (beep, air) => [air(0.105, 740, 0.28), beep('triangle', 100, 46, 0.11, 0.17)],
  crash: (beep, air, power) => [air(0.19 + power * 0.4, 440 + power * 1100, 0.27 + power * 0.44),
    beep('triangle', 130, 39, 0.15 + power * 0.06, 0.2 * power)],
  metal: (beep, air, power) => [beep('triangle', 710, 230, 0.32, 0.15 + power * 0.15), air(0.12, 1700, 0.24)],
  glass: (beep, air, power) => [air(0.28, 4800, 0.14 + power * 0.28), beep('sine', 2300, 1400, 0.15, 0.13)],
  stone: (beep, air, power) => [air(0.26, 560, 0.21 + power * 0.3), beep('triangle', 110, 48, 0.16, 0.19)],
  splash: (beep, air) => [air(0.72, 1400, 0.65)],
};

async function checked(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Zvuk ${url} (${response.status})`);
  return response;
}

class Announcements {
  constructor(ctx) {
    this.ctx = ctx;
    this.packs = new Map();
    this.loadManifest();
  }

  loadManifest() {
    this.manifest ??= checked(BASE + 'stops.json').then((response) => response.json()).catch(() => {
      this.manifest = null;
      return null;
    });
    return this.manifest;
  }

  async clip(stop) {
    const manifest = await this.loadManifest();
    if (!manifest || !Object.hasOwn(manifest.clips, stop)) return null;
    const [file, offset, duration] = manifest.clips[stop];
    let pack = this.packs.get(file);
    this.packs.delete(file);
    pack ??= checked(BASE + file).then((response) => response.arrayBuffer())
      .then((bytes) => this.ctx.decodeAudioData(bytes))
      .catch(() => null);
    this.packs.set(file, pack);
    if (this.packs.size > MAX_PACKS) this.packs.delete(this.packs.keys().next().value);
    const buffer = await pack;
    if (!buffer && this.packs.get(file) === pack) this.packs.delete(file);
    return buffer ? { buffer, offset, duration } : null;
  }
}

export class GameAudio {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.muted = false;
    this.paused = true;
    this.mapPaused = false;
    this.loops = new Map();
    this.effects = new Set();
    this.pendingSpeech = new Map();
    this.timer = 0;
    this.roadPosition = {};
  }

  start() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = this.ctx = new AudioContext();
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.64;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -15;
    compressor.ratio.value = 4;
    this.master.connect(compressor).connect(ctx.destination);
    this.buffers = soundBuffers(ctx);
    this.announcements = new Announcements(ctx);
    const [ax, az] = forgeXZ(5.8, -17), [bx, bz] = forgeXZ(5.8, 18);
    const { world } = this.game;
    this.water = new WaterSound(world, [ax, az, bx, bz], this.game.soundPlaces);
    const [x, z] = forgeXZ(4.6, 0);
    this.forge = { x, z, y: world.heightAt(x, z) };
  }

  get available() { return this.ctx && !this.muted && !this.paused && !this.mapPaused; }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.64, this.ctx.currentTime, 0.025);
    if (muted) this.resetWorld();
  }

  setMapPaused(paused) {
    this.mapPaused = paused;
    if (paused) this.resetWorld();
  }

  suspend() {
    this.paused = true;
    this.resetWorld();
    this.ctx?.suspend().catch(() => {});
  }

  resume() {
    this.paused = false;
    this.ctx?.resume().catch(() => {});
  }

  resetWorld() {
    if (this.rainVoice) {
      this.rainVoice.source.stop();
      this.rainVoice.source.disconnect();
      this.rainVoice.filter.disconnect();
      this.rainVoice.gain.disconnect();
      this.rainVoice = null;
    }
    for (const voice of this.loops.values()) voice.dispose();
    this.loops.clear();
    for (const effect of this.effects) this.stopEffect(effect);
    this.pendingSpeech.clear();
    this.timer = 0;
  }

  remove(source) {
    this.loops.get(source)?.dispose();
    this.loops.delete(source);
    for (const effect of this.effects) if (effect.source === source) this.stopEffect(effect);
    this.pendingSpeech.delete(source);
  }

  stopEffect(effect) {
    this.effects.delete(effect);
    if (this.ctx.currentTime < effect.end) for (const node of effect.nodes) node.stop();
    effect.channel.disconnect();
  }

  roadSurface(car) {
    const world = this.game.world;
    const road = world.nearestRoad(car.x, car.z, 9, DRIVABLE_MAX + 3, 0, this.roadPosition, car.y);
    return road && road.dist <= world.r.w[road.road] * 0.5 + 0.8 && world.r.cls[road.road] <= DRIVABLE_MAX ? 'road' : 'loose';
  }

  update(dt) {
    if (!this.available) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const elapsed = Math.max(0.07, 0.075 - this.timer);
    this.timer = 0.075;
    const g = this.game, listener = soundListener(g), t = this.ctx.currentTime;
    const rain = g.weather?.rain ?? 0;
    if (rain > .01 && !this.rainVoice) {
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffers.noise;
      source.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1700;
      filter.Q.value = .45;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.master);
      source.start();
      this.rainVoice = { source, filter, gain };
    }
    if (this.rainVoice) {
      this.rainVoice.gain.gain.setTargetAtTime(rain * (g.tunnelLight?.visible ? .013 : .12), t, .25);
      if (rain === 0 && this.rainVoice.gain.gain.value < .0001) {
        this.rainVoice.source.stop();
        this.rainVoice.source.disconnect();
        this.rainVoice.filter.disconnect();
        this.rainVoice.gain.disconnect();
        this.rainVoice = null;
      }
    }
    const candidates = [];
    const add = (source, kind, range, state, priority = 0) => {
      const distance = Math.hypot(source.x - listener.x, source.y - listener.y, source.z - listener.z);
      if (distance < range) {
        const score = source === listener.focus ? -10 : distance / range - priority - (this.loops.has(source) ? 0.055 : 0);
        candidates.push({ source, kind, range, score, state });
      }
    };
    const vehicleState = (source, speed, engine, siren) => {
      const previous = this.loops.get(source)?.speed ?? speed;
      const change = Math.min(1, Math.max(0, (speed - previous) / (elapsed * 3)));
      return { speed, power: source === g.car ? (source.engineLoad ?? 0) : change, engine, siren };
    };
    for (const car of g.vehicles.cars) {
      const speed = Math.abs(car.speed);
      const engine = car.health > 0 && (car.mode === 'ai' || car.mode === 'police' || car === g.car);
      const siren = car.mode === 'police' && Boolean(g.wanted) && car.health > 0;
      if (!car.dead && (engine || car.mode === 'loose' && speed > 0.45 || siren)) {
        add(car, 'car', siren ? 192 : 105, { ...vehicleState(car, speed, engine, siren), rpm: car.rpm, skid: car === g.car ? car.skid : 0 }, siren ? 0.48 : 0);
      }
    }
    for (const v of g.transit.vehicles) if (v.visible) {
      const engine = v.route.type === 'bus' || v.v > 0.15;
      if (engine) add(v, v.route.type, 120, vehicleState(v, v.v, engine, false), 0.1);
    }
    for (const h of g.helis) if (h.rotor > 0.4) add(h, 'rotor', 260, { power: h.rotor / 30 }, 0.34);
    this.water.nearby(listener, add);
    if (g.chunks.heritage.forgeWorking) add(this.forge, 'forge', 102, { power: 1 }, 0.22);

    const active = new Set();
    candidates.sort((a, b) => a.score - b.score);
    for (const { source, kind, range, state } of candidates) {
      if (active.size >= MAX_LOOPS) break;
      const field = soundField(g.world, listener, source, range);
      if (!field || field.gain < 0.008) continue;
      let voice = this.loops.get(source);
      if (!voice) {
        voice = new LoopVoice(this.ctx, this.master, this.buffers, kind);
        this.loops.set(source, voice);
      }
      if (kind === 'car' || kind === 'bus' || kind === 'trolleybus') state.road = this.roadSurface(source);
      voice.speed = state.speed;
      voice.update(state, field, this.ctx);
      active.add(source);
    }
    for (const [source, voice] of this.loops) {
      if (!active.has(source)) { voice.dispose(); this.loops.delete(source); }
    }
    for (const effect of this.effects) {
      const field = soundField(g.world, listener, effect.source, effectRange[effect.kind]);
      if (!field || effect.end <= t) this.stopEffect(effect);
      else {
        effect.distance = field.distance;
        effect.channel.apply(field, t, true);
      }
    }
  }

  effect(kind, source, strength = 1, clip, stop) {
    if (!this.available || !source) return;
    const { game, ctx } = this;
    const t = ctx.currentTime;
    const field = soundField(game.world, soundListener(game), source, effectRange[kind]);
    if (!field || field.gain < 0.008) return;
    const priority = (source === game.focus ? 4 : 0) + (kind === 'speech' ? 3 : kind === 'horn' || kind === 'bell' ? 2 : 1);
    const compare = (a, b) => a.priority - b.priority || b.distance - a.distance;
    const scored = { priority, distance: field.distance };
    const effects = [...this.effects];
    const speaking = kind === 'speech' ? effects.filter((effect) => effect.kind === 'speech') : [];
    if (speaking.length >= 2 || effects.length >= MAX_EFFECTS) {
      const weakest = (speaking.length >= 2 ? speaking : effects).sort(compare)[0];
      if (!weakest || compare(scored, weakest) < 0) return;
      this.stopEffect(weakest);
    }
    const channel = soundChannel(ctx, this.master);
    channel.apply(field, t, false);
    let nodes, duration = 0;
    if (clip) {
      const speech = ctx.createBufferSource();
      speech.buffer = clip.buffer;
      const input = ctx.createGain();
      input.gain.value = 0.9;
      speech.connect(input).connect(channel.input);
      speech.start(t, clip.offset, clip.duration);
      speech.onended = () => { speech.disconnect(); input.disconnect(); };
      nodes = [speech];
      duration = clip.duration;
    } else {
      const beep = (wave, f0, f1, seconds, level, offset = 0, hold = 0) => {
        duration = Math.max(duration, offset + seconds);
        return tone(ctx, channel.input, t + offset, wave === 'horn' ? this.buffers.hornWave : wave, f0, f1, seconds, level, hold);
      };
      const air = (seconds, freq, level, offset = 0, filter) => {
        duration = Math.max(duration, offset + seconds);
        return noise(ctx, channel.input, this.buffers.noise, t + offset, seconds, freq, level, filter);
      };
      nodes = ONE_SHOTS[kind](beep, air, strength);
    }
    this.effects.add({ source, kind, channel, nodes, stop, ...scored, end: t + duration + 0.015 });
  }

  transitDoors(vehicle, open, stop) {
    this.effect(open ? 'open' : 'close', vehicle);
    if (!open) {
      this.pendingSpeech.delete(vehicle);
      return;
    }
    if (!this.available || !stop) return;
    const field = soundField(this.game.world, soundListener(this.game), vehicle, effectRange.speech);
    if (!field || field.gain < 0.008) return;
    const distance = vehicle === this.game.focus ? -1 : field.distance;
    if (!this.pendingSpeech.has(vehicle) && this.pendingSpeech.size >= 4) {
      const [oldSource, oldRequest] = [...this.pendingSpeech].sort((a, b) => b[1].distance - a[1].distance)[0];
      if (oldRequest.distance <= distance) return;
      this.pendingSpeech.delete(oldSource);
    }
    const request = { time: this.ctx.currentTime, distance };
    this.pendingSpeech.set(vehicle, request);
    this.announcements.clip(stop).then((clip) => {
      if (this.pendingSpeech.get(vehicle) !== request) return;
      this.pendingSpeech.delete(vehicle);
      if (clip && this.ctx.currentTime - request.time < SPEECH_LIFETIME && vehicle.visible && vehicle.doorsOpen
          && vehicle.stopTarget?.[1] === stop) this.effect('speech', vehicle, 1, clip, stop);
    }).catch(() => {
      if (this.pendingSpeech.get(vehicle) === request) this.pendingSpeech.delete(vehicle);
    });
  }

  crash(power, source, material = 'crash') { this.effect(material, source, Math.max(0, Math.min(1, power / 18))); }
  horn(source) { this.effect('horn', source); }
  bell(source) { this.effect('bell', source); }
  door(source) { this.effect('door', source); }
  splash(source) { this.effect('splash', source); }

  ui(notes) {
    if (!this.available) return;
    for (const [wave, f0, f1, duration, level, offset] of notes) {
      tone(this.ctx, this.master, this.ctx.currentTime + offset, wave, f0, f1, duration, level);
    }
  }

  coin() { this.ui([['triangle', 880, 1320, 0.12, 0.2, 0], ['triangle', 1320, 1760, 0.16, 0.2, 0.09]]); }
  fail() { this.ui([['sawtooth', 300, 110, 0.4, 0.18, 0]]); }
  discover() { this.ui([660, 880, 1100].map((f, i) => ['triangle', f, f * 1.01, 0.22, 0.18, i * 0.11])); }
}
