// Zvuky generované přímo v prohlížeči (Web Audio) – žádné zvukové soubory.
export class GameAudio {
  constructor() { this.ctx = null; this.muted = false; }

  /** Musí se zavolat po kliknutí uživatele (pravidla prohlížečů). */
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(ctx.destination);
    // motor
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 500;
    this.eng1 = ctx.createOscillator(); this.eng1.type = 'sawtooth';
    this.eng2 = ctx.createOscillator(); this.eng2.type = 'square';
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    this.eng1.connect(this.engFilter); this.eng2.connect(g2); g2.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.eng1.start(); this.eng2.start();
    // šum (smyk, vítr, rotor)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const mk = (type, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return { f, g };
    };
    this.skid = mk('bandpass', 1900, 4);
    this.rotor = mk('lowpass', 260, 1);
    // siréna
    this.sirenGain = ctx.createGain(); this.sirenGain.gain.value = 0;
    this.siren = ctx.createOscillator(); this.siren.type = 'triangle'; this.siren.frequency.value = 650;
    this.siren.connect(this.sirenGain); this.sirenGain.connect(this.master); this.siren.start();
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  suspend() { if (this.ctx) this.ctx.suspend(); }
  resume() { if (this.ctx) this.ctx.resume(); }

  /** rpm 0–1, on = motor běží */
  engine(on, rpm, load) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = 42 + rpm * 150;
    this.eng1.frequency.setTargetAtTime(f, t, 0.05);
    this.eng2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(280 + rpm * 1300 + load * 300, t, 0.08);
    this.engGain.gain.setTargetAtTime(on ? 0.07 + load * 0.06 : 0, t, 0.1);
  }

  setSkid(a) { if (this.ctx) this.skid.g.gain.setTargetAtTime(a * 0.16, this.ctx.currentTime, 0.06); }

  setRotor(a) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const chop = 0.6 + 0.4 * Math.sin(t * 38);
    this.rotor.g.gain.setTargetAtTime(a * 0.5 * chop, t, 0.02);
  }

  setSiren(a) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(a * 0.07, t, 0.15);
    this.siren.frequency.setTargetAtTime(Math.floor(t * 1.4) % 2 ? 560 : 760, t, 0.03);
  }

  _blip(type, f0, f1, dur, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type;
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, freq, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }

  crash(power) { const v = Math.min(1, power / 18); this._noise(0.25 + v * 0.3, 500 + v * 900, 0.25 + v * 0.5); this._blip('square', 90, 40, 0.18, 0.12 * v); }
  coin() { this._blip('triangle', 880, 1320, 0.12, 0.2); setTimeout(() => this._blip('triangle', 1320, 1760, 0.16, 0.2), 90); }
  fail() { this._blip('sawtooth', 300, 110, 0.4, 0.18); }
  bell() { this._blip('sine', 1500, 1480, 0.5, 0.16); setTimeout(() => this._blip('sine', 1500, 1480, 0.5, 0.16), 260); }
  horn() { this._blip('square', 410, 405, 0.35, 0.12); this._blip('square', 330, 326, 0.35, 0.1); }
  door() { this._noise(0.09, 700, 0.3); }
  splash() { this._noise(0.7, 1400, 0.5); }
  discover() { [660, 880, 1100].forEach((f, i) => setTimeout(() => this._blip('triangle', f, f * 1.01, 0.22, 0.18), i * 110)); }
}
