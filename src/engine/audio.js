// ============================================================================
//  Procedural audio engine — every sound in the game is synthesized here with
//  the Web Audio API, so the game needs no sound files.
// ============================================================================

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const rand = (a, b) => a + Math.random() * (b - a);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.volume = 0.85;
    this.loops = new Map();
    this.menuNodes = new Set();
  }

  // Must be called from a user gesture (click / tap)
  unlock() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = this._gain(1, this.master);
    this.ambBus = this._gain(1, this.master);
    this.musicBus = this._gain(1, this.master);
    // reverb
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.8, 2.6);
    this.reverbSend = this._gain(0.6, this.reverb);
    this.reverb.connect(this.master);
    // noise buffers
    this.white = this._noiseBuffer('white', 3);
    this.brown = this._noiseBuffer('brown', 4);
    // silent buffer kick for iOS
    const b = ctx.createBufferSource();
    b.buffer = ctx.createBuffer(1, 1, 22050);
    b.connect(ctx.destination);
    b.start(0);
    if (ctx.state !== 'running') ctx.resume();
  }

  get ready() {
    return !!this.ctx;
  }
  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.now, 0.05);
  }

  duck(amount = 0.35, time = 0.4) {
    if (!this.ctx) return;
    const g = this.ambBus.gain;
    g.cancelScheduledValues(this.now);
    g.setTargetAtTime(amount, this.now, time / 3);
  }
  unduck(time = 0.8) {
    if (!this.ctx) return;
    this.ambBus.gain.setTargetAtTime(1, this.now, time / 3);
  }

  // ---------------------------------------------------------------- helpers
  _gain(v, dest) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  }
  _pan(p, dest) {
    if (!this.ctx.createStereoPanner) return dest;
    const s = this.ctx.createStereoPanner();
    s.pan.value = Math.max(-1, Math.min(1, p || 0));
    s.connect(dest);
    return s;
  }
  _filter(type, freq, q = 1, dest) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (dest) f.connect(dest);
    return f;
  }
  _noiseBuffer(kind, seconds) {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * seconds, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }
  _impulse(seconds, decay) {
    const sr = this.ctx.sampleRate;
    const len = sr * seconds;
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  _distCurve(k = 20) {
    const n = 2048;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return c;
  }
  _noise(dest, t, dur, { buffer, rate = 1, loop = false } = {}) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer || this.white;
    s.playbackRate.value = rate;
    s.loop = loop || dur > s.buffer.duration;
    s.loopStart = Math.random() * 0.5;
    s.connect(dest);
    s.start(t, Math.random() * 1.5);
    if (dur != null) s.stop(t + dur + 0.05);
    return s;
  }
  _osc(type, freq, dest, t, dur) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.connect(dest);
    o.start(t);
    if (dur != null) o.stop(t + dur + 0.05);
    return o;
  }
  _env(param, t, a, peak, d, end = 0.0001) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.exponentialRampToValueAtTime(Math.max(end, 0.0001), t + a + d);
  }
  _out(bus = 'sfx', pan = 0, reverb = 0) {
    const g = this._gain(1, this._pan(pan, bus === 'amb' ? this.ambBus : bus === 'music' ? this.musicBus : this.sfxBus));
    if (reverb > 0) g.connect(this._gain(reverb, this.reverbSend));
    return g;
  }

  // ---------------------------------------------------------------- one-shots
  click(vol = 0.25) {
    if (!this.ctx) return;
    const t = this.now;
    const out = this._out();
    const g = this._gain(0, out);
    this._env(g.gain, t, 0.001, vol, 0.04);
    this._noise(this._filter('highpass', 2500, 0.7, g), t, 0.06);
    const g2 = this._gain(0, out);
    this._env(g2.gain, t, 0.001, vol * 0.8, 0.05);
    this._osc('square', 1800, g2, t, 0.05);
  }

  blip(pitch = 1, vol = 0.05) {
    if (!this.ctx) return;
    const t = this.now;
    const g = this._gain(0, this._out());
    this._env(g.gain, t, 0.002, vol, 0.05);
    this._osc('triangle', 520 * pitch * rand(0.97, 1.03), g, t, 0.06);
  }

  doorSlam(pan = 0) {
    if (!this.ctx) return;
    const t = this.now;
    const out = this._out('sfx', pan, 0.25);
    const g = this._gain(0, out);
    this._env(g.gain, t, 0.004, 1.0, 0.45);
    const o = this._osc('sine', 70, g, t, 0.5);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.4);
    const gn = this._gain(0, out);
    this._env(gn.gain, t, 0.002, 0.7, 0.3);
    this._noise(this._filter('lowpass', 900, 0.8, gn), t, 0.35);
    [310, 467, 893, 1270].forEach((f, i) => {
      const gm = this._gain(0, out);
      this._env(gm.gain, t + 0.01, 0.002, 0.08 / (i + 1), 0.9);
      this._osc('triangle', f * rand(0.98, 1.02), this._filter('bandpass', f, 12, gm), t, 1.0);
    });
  }

  doorOpen(pan = 0) {
    if (!this.ctx) return;
    const t = this.now;
    const out = this._out('sfx', pan, 0.15);
    const g = this._gain(0, out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.55);
    const f = this._filter('bandpass', 400, 3, g);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
    this._noise(f, t, 0.6);
    const g2 = this._gain(0, out);
    this._env(g2.gain, t + 0.52, 0.003, 0.4, 0.2);
    this._osc('sine', 90, g2, t + 0.52, 0.25);
  }

  whoosh(up = true, vol = 0.25, dur = 0.3) {
    if (!this.ctx) return;
    const t = this.now;
    const g = this._gain(0, this._out());
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = this._filter('bandpass', up ? 300 : 2500, 1.2, g);
    f.frequency.exponentialRampToValueAtTime(up ? 2600 : 300, t + dur);
    this._noise(f, t, dur);
  }

  camOpen() {
    this.whoosh(true, 0.22, 0.25);
    this.click(0.15);
  }
  camClose() {
    this.whoosh(false, 0.18, 0.22);
  }

  staticBurst(dur = 0.2, vol = 0.22) {
    if (!this.ctx) return;
    const t = this.now;
    const g = this._gain(0, this._out());
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this._noise(this._filter('highpass', 900, 0.5, g), t, dur);
  }

  camSwitch() {
    this.staticBurst(0.16, 0.2);
    this.click(0.12);
  }

  footsteps(pan = 0, count = 4, vol = 0.5, interval = 0.42, delay = 0) {
    if (!this.ctx) return;
    const out = this._out('sfx', pan, 0.3);
    for (let i = 0; i < count; i++) {
      const t = this.now + delay + i * interval * rand(0.92, 1.08);
      const v = vol * rand(0.75, 1);
      const g = this._gain(0, out);
      this._env(g.gain, t, 0.004, v, 0.12);
      this._noise(this._filter('lowpass', rand(300, 520), 1, g), t, 0.15);
      const g2 = this._gain(0, out);
      this._env(g2.gain, t, 0.003, v * 0.8, 0.09);
      const o = this._osc('sine', 95, g2, t, 0.12);
      o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
    }
  }

  running(pan = 0, dur = 2.5, vol = 0.6) {
    // fast heavy steps getting louder
    if (!this.ctx) return;
    const n = Math.floor(dur / 0.21);
    const out = this._out('sfx', pan, 0.25);
    for (let i = 0; i < n; i++) {
      const t = this.now + i * 0.21 + rand(-0.015, 0.015);
      const v = vol * (0.25 + 0.75 * (i / n));
      const g = this._gain(0, out);
      this._env(g.gain, t, 0.003, v, 0.1);
      this._noise(this._filter('lowpass', 420, 1, g), t, 0.12);
      const g2 = this._gain(0, out);
      this._env(g2.gain, t, 0.002, v, 0.08);
      const o = this._osc('sine', 110, g2, t, 0.1);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    }
  }

  knock(count = 3) {
    if (!this.ctx) return;
    const out = this._out('sfx', 0, 0.35);
    for (let i = 0; i < count; i++) {
      const t = this.now + i * 0.28;
      const g = this._gain(0, out);
      this._env(g.gain, t, 0.002, 0.8, 0.12);
      this._noise(this._filter('bandpass', 260, 2, g), t, 0.14);
      const g2 = this._gain(0, out);
      this._env(g2.gain, t, 0.002, 0.6, 0.1);
      const o = this._osc('sine', 150, g2, t, 0.12);
      o.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    }
  }

  bang(pan = 0, power = 1) {
    // something heavy smashing into a steel door
    if (!this.ctx) return;
    const t = this.now;
    const out = this._out('sfx', pan, 0.4);
    const g = this._gain(0, out);
    this._env(g.gain, t, 0.002, 1.1 * power, 0.6);
    const o = this._osc('sine', 75, g, t, 0.7);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.6);
    const gn = this._gain(0, out);
    this._env(gn.gain, t, 0.001, 0.9 * power, 0.25);
    this._noise(this._filter('lowpass', 700, 0.7, gn), t, 0.3);
    [196, 317, 523, 811].forEach((f, i) => {
      const gm = this._gain(0, out);
      this._env(gm.gain, t, 0.002, (0.25 * power) / (i + 1), 1.4);
      this._noise(this._filter('bandpass', f, 25, gm), t, 1.5);
    });
  }

  laugh(vol = 0.7, pan = 0, base = 92) {
    // demonic "ha-ha-ha": formant synthesis + an octave-down layer
    if (!this.ctx) return;
    const t0 = this.now + 0.02;
    const out = this._out('sfx', pan, 0.9);
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._distCurve(6);
    const pre = this._gain(0.9, shaper);
    shaper.connect(out);
    const formants = [
      [760, 7, 1],
      [1150, 9, 0.55],
      [2500, 12, 0.25],
    ];
    const bank = formants.map(([f, q, gn]) => {
      const fl = this._filter('bandpass', f, q, this._gain(gn * 4, pre));
      return fl;
    });
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 0.205 * rand(0.95, 1.05);
      const f0 = base * (1.12 - i * 0.045) * rand(0.97, 1.03);
      // breathy "h"
      const gh = this._gain(0, null);
      bank.forEach((b) => gh.connect(b));
      this._env(gh.gain, t, 0.01, vol * 0.25, 0.06);
      this._noise(gh, t, 0.08);
      // voiced "a"
      for (const mult of [1, 0.5]) {
        const gv = this._gain(0, null);
        bank.forEach((b) => gv.connect(b));
        gv.gain.setValueAtTime(0.0001, t + 0.04);
        gv.gain.linearRampToValueAtTime(vol * (mult === 1 ? 0.5 : 0.4), t + 0.07);
        gv.gain.setValueAtTime(vol * (mult === 1 ? 0.5 : 0.4), t + 0.13);
        gv.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        const o = this._osc('sawtooth', f0 * mult, gv, t + 0.03, 0.2);
        o.frequency.setValueAtTime(f0 * mult * 1.08, t + 0.04);
        o.frequency.exponentialRampToValueAtTime(f0 * mult * 0.86, t + 0.2);
      }
    }
  }

  scream(vol = 1) {
    // jump-scare screech
    if (!this.ctx) return;
    const t = this.now;
    const dur = 1.35;
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._distCurve(60);
    const env = this._gain(0, this._filter('lowpass', 7500, 0.5, this._filter('highpass', 180, 0.7, this.sfxBus)));
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol * 0.55, t + 0.015);
    env.gain.setValueAtTime(vol * 0.55, t + dur - 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    shaper.connect(env);
    const pre = this._gain(0.35, shaper);
    [370, 523, 698, 1046, 1396].forEach((f) => {
      const o = this._osc('sawtooth', f * rand(0.97, 1.03), pre, t, dur);
      const lfo = this._osc('square', rand(21, 37), this._gain(f * 0.12, o.frequency), t, dur);
      lfo.detune.value = rand(-50, 50);
      o.frequency.setValueAtTime(f * 1.3, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.9, t + dur);
    });
    const gn = this._gain(0.8, pre);
    this._noise(this._filter('bandpass', 2600, 0.8, gn), t, dur);
    // body hit
    const g = this._gain(0, this.sfxBus);
    this._env(g.gain, t, 0.003, vol, 0.8);
    const o = this._osc('sine', 60, g, t, 0.9);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.8);
  }

  sting(vol = 0.55) {
    // "someone is at the door" stinger
    if (!this.ctx) return;
    const t = this.now;
    const out = this._out('sfx', 0, 0.6);
    [220, 233, 311, 466, 1864].forEach((f, i) => {
      const g = this._gain(0, out);
      this._env(g.gain, t, 0.004, (vol * (i === 4 ? 0.12 : 0.3)) / 1.5, 1.2 + i * 0.1);
      this._osc(i === 4 ? 'square' : 'sawtooth', f, this._filter('lowpass', 3000, 0.5, g), t, 1.6);
    });
    const gn = this._gain(0, out);
    this._env(gn.gain, t, 0.002, vol * 0.4, 0.4);
    this._noise(this._filter('highpass', 2000, 0.5, gn), t, 0.5);
  }

  braam(vol = 0.9) {
    if (!this.ctx) return;
    const t = this.now;
    const out = this._out('sfx', 0, 0.8);
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this._distCurve(8);
    const g = this._gain(0, out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    const lp = this._filter('lowpass', 200, 2, g);
    lp.frequency.setValueAtTime(200, t);
    lp.frequency.linearRampToValueAtTime(1600, t + 0.15);
    lp.frequency.exponentialRampToValueAtTime(120, t + 3);
    shaper.connect(lp);
    const pre = this._gain(0.4, shaper);
    [43.65, 43.9, 65.4, 87.3, 87.6].forEach((f) => this._osc('sawtooth', f, pre, t, 3.3));
    const gs = this._gain(0, out);
    this._env(gs.gain, t, 0.01, vol * 0.9, 1.6);
    const o = this._osc('sine', 55, gs, t, 1.8);
    o.frequency.exponentialRampToValueAtTime(25, t + 1.6);
  }

  riser(dur = 3, vol = 0.4) {
    if (!this.ctx) return;
    const t = this.now;
    const out = this._out('sfx', 0, 0.5);
    const g = this._gain(0, out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
    const f = this._filter('bandpass', 200, 2, g);
    f.frequency.exponentialRampToValueAtTime(4000, t + dur);
    this._noise(f, t, dur + 0.1);
    const gs = this._gain(0.18, g);
    const o = this._osc('sawtooth', 80, gs, t, dur + 0.1);
    o.frequency.exponentialRampToValueAtTime(640, t + dur);
  }

  glitch(dur = 0.4, vol = 0.25) {
    if (!this.ctx) return;
    const out = this._out();
    let t = this.now;
    const end = t + dur;
    while (t < end) {
      const d = rand(0.015, 0.06);
      const g = this._gain(0, out);
      g.gain.setValueAtTime(vol * rand(0.4, 1), t);
      g.gain.setValueAtTime(0.0001, t + d);
      if (Math.random() < 0.5) this._osc('square', rand(150, 2500), g, t, d);
      else this._noise(this._filter('bandpass', rand(400, 5000), 2, g), t, d);
      t += d + rand(0, 0.03);
    }
  }

  powerDown() {
    if (!this.ctx) return;
    const t = this.now;
    const out = this._out('sfx', 0, 0.5);
    const g = this._gain(0, out);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    const lp = this._filter('lowpass', 2000, 4, g);
    lp.frequency.exponentialRampToValueAtTime(60, t + 2);
    const o = this._osc('sawtooth', 240, lp, t, 2.3);
    o.frequency.exponentialRampToValueAtTime(18, t + 2.1);
    this.doorSlam(-0.6);
    setTimeout(() => this.doorSlam(0.6), 120);
  }

  radioBeep() {
    if (!this.ctx) return;
    const out = this._out();
    [0, 0.12].forEach((d) => {
      const t = this.now + d;
      const g = this._gain(0, out);
      this._env(g.gain, t, 0.003, 0.12, 0.08);
      this._osc('square', 1250, this._filter('bandpass', 1250, 3, g), t, 0.09);
    });
    this.staticBurst(0.35, 0.12);
  }

  bell(freq, t, vol = 0.3, dur = 3, out = null) {
    out = out || this._out('sfx', 0, 0.6);
    const g = this._gain(0, out);
    this._env(g.gain, t, 0.002, vol, dur);
    const car = this._osc('sine', freq, g, t, dur + 0.1);
    const modGain = this._gain(0, car.frequency);
    modGain.gain.setValueAtTime(freq * 2.2, t);
    modGain.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur * 0.7);
    this._osc('sine', freq * 1.41, modGain, t, dur + 0.1);
    const g2 = this._gain(0, out);
    this._env(g2.gain, t, 0.002, vol * 0.25, dur * 0.4);
    this._osc('sine', freq * 2.76, g2, t, dur * 0.5);
  }

  chime6() {
    if (!this.ctx) return;
    const t = this.now + 0.05;
    // "you made it" clock chime
    [76, 72, 74, 67, 67, 74, 76, 72].forEach((m, i) => this.bell(midi(m), t + i * 0.55, 0.28, 2.5));
    [60, 64, 67, 72].forEach((m) => this.bell(midi(m), t + 8 * 0.55 + 0.2, 0.18, 5));
    setTimeout(() => this.applause(4.5), 1300);
  }

  applause(dur = 4) {
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(2, Math.floor(sr * dur), sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      const claps = Math.floor(dur * 55);
      for (let k = 0; k < claps; k++) {
        const pos = Math.random();
        const dens = Math.min(1, pos * 6) * Math.min(1, (1 - pos) * 2.2);
        if (Math.random() > dens) continue;
        const start = Math.floor(pos * (d.length - sr * 0.03));
        const amp = rand(0.15, 0.5);
        const decay = rand(0.003, 0.008) * sr;
        let lp = 0;
        for (let i = 0; i < sr * 0.03; i++) {
          lp += 0.55 * (Math.random() * 2 - 1 - lp);
          d[start + i] += lp * amp * Math.exp(-i / decay);
        }
      }
    }
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const g = this._gain(0.9, this._filter('bandpass', 1700, 0.6, this._out('sfx', 0, 0.35)));
    s.connect(g);
    s.start();
  }

  // ---------------------------------------------------------------- loops
  stopLoop(name, fade = 0.4) {
    const l = this.loops.get(name);
    if (!l) return;
    this.loops.delete(name);
    const t = this.now;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(l.gain.gain.value, t);
    l.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => {
      l.nodes.forEach((n) => {
        try {
          n.stop();
        } catch (e) {}
      });
      if (l.timer) clearInterval(l.timer);
      l.gain.disconnect();
    }, fade * 1000 + 100);
  }

  setLoopGain(name, v, time = 0.2) {
    const l = this.loops.get(name);
    if (l) l.gain.gain.setTargetAtTime(v, this.now, time / 3);
  }

  hasLoop(name) {
    return this.loops.has(name);
  }

  _loop(name, build, gain = 1, fade = 1, bus = 'amb') {
    if (!this.ctx) return;
    if (this.loops.has(name)) return;
    const g = this._gain(0, bus === 'sfx' ? this.sfxBus : bus === 'music' ? this.musicBus : this.ambBus);
    g.gain.linearRampToValueAtTime(gain, this.now + fade);
    const l = { gain: g, nodes: [], timer: null };
    build(g, l);
    this.loops.set(name, l);
    return l;
  }

  drone(intensity = 1) {
    this._loop(
      'drone',
      (g, l) => {
        const lp = this._filter('lowpass', 150, 1.5, g);
        const lfo = this._osc('sine', 0.07, this._gain(60, lp.frequency), this.now);
        l.nodes.push(lfo);
        [41.2, 41.45, 61.7, 82.6].forEach((f) => {
          const o = this._osc('sawtooth', f, this._gain(0.22, lp), this.now);
          l.nodes.push(o);
        });
        const air = this._gain(0.25, this._filter('lowpass', 500, 0.5, g));
        l.nodes.push(this._noise(air, this.now, null, { buffer: this.brown, loop: true }));
        // a high whine that comes and goes
        const wg = this._gain(0, g);
        const whine = this._osc('sine', 1975, wg, this.now);
        const wl = this._osc('sine', 0.05, this._gain(0.012, wg.gain), this.now);
        l.nodes.push(whine, wl);
      },
      0.32 * intensity,
      2.5,
    );
  }

  fan() {
    this._loop(
      'fan',
      (g, l) => {
        const am = this._gain(0.7, this._filter('lowpass', 650, 0.6, g));
        const lfo = this._osc('sine', 13, this._gain(0.25, am.gain), this.now);
        l.nodes.push(lfo, this._noise(am, this.now, null, { buffer: this.brown, loop: true }));
        const hum = this._gain(0.05, g);
        l.nodes.push(this._osc('sine', 100, hum, this.now), this._osc('sine', 200, this._gain(0.4, hum), this.now));
      },
      0.22,
      1.5,
    );
  }

  lightBuzz(side) {
    this._loop(
      'light-' + side,
      (g, l) => {
        const p = this._pan(side === 'left' ? -0.7 : 0.7, g);
        const bp = this._filter('bandpass', 240, 2, p);
        l.nodes.push(this._osc('sawtooth', 60, this._gain(0.5, bp), this.now));
        l.nodes.push(this._osc('sawtooth', 120.5, this._gain(0.3, bp), this.now));
        const cr = this._gain(0.08, this._filter('highpass', 5000, 0.5, p));
        l.nodes.push(this._noise(cr, this.now, null, { loop: true }));
      },
      0.12,
      0.03,
      'sfx',
    );
  }

  camStatic() {
    this._loop(
      'camstatic',
      (g, l) => {
        l.nodes.push(this._noise(this._filter('bandpass', 3000, 0.4, g), this.now, null, { loop: true }));
      },
      0.035,
      0.1,
      'sfx',
    );
  }

  breathing(vol = 0.5) {
    this._loop(
      'breath',
      (g, l) => {
        const bp = this._filter('bandpass', 900, 1.2, g);
        const ng = this._gain(0, bp);
        l.nodes.push(this._noise(ng, this.now, null, { loop: true }));
        let i = 0;
        const step = () => {
          const t = this.now;
          const inhale = i++ % 2 === 0;
          const d = inhale ? 0.32 : 0.42;
          ng.gain.cancelScheduledValues(t);
          ng.gain.setValueAtTime(0.0001, t);
          ng.gain.linearRampToValueAtTime(inhale ? 0.5 : 0.8, t + d * 0.4);
          ng.gain.linearRampToValueAtTime(0.0001, t + d);
          bp.frequency.setValueAtTime(inhale ? 1300 : 800, t);
        };
        step();
        l.timer = setInterval(step, 470);
      },
      vol,
      0.3,
      'sfx',
    );
  }

  heartbeat(bpm = 90, vol = 0.6) {
    const l = this.loops.get('heart');
    if (l) {
      l.bpm = bpm;
      l.gain.gain.setTargetAtTime(vol, this.now, 0.2);
      return;
    }
    const nl = this._loop(
      'heart',
      (g, lo) => {
        lo.bpm = bpm;
        lo.next = this.now + 0.05;
        const beat = (t, v) => {
          const gg = this._gain(0, this._filter('lowpass', 120, 1, g));
          this._env(gg.gain, t, 0.01, v, 0.16);
          const o = this._osc('sine', 58, gg, t, 0.2);
          o.frequency.exponentialRampToValueAtTime(38, t + 0.15);
        };
        lo.timer = setInterval(() => {
          while (lo.next < this.now + 0.25) {
            beat(lo.next, 1);
            beat(lo.next + 0.16, 0.65);
            lo.next += 60 / lo.bpm;
          }
        }, 60);
      },
      vol,
      0.3,
      'sfx',
    );
    return nl;
  }

  musicBox(vol = 0.5) {
    // Gefen's lullaby (plays when the power is out)
    this._loop(
      'musicbox',
      (g, l) => {
        const out = this._gain(1, g);
        out.connect(this._gain(0.7, this.reverbSend));
        const mel = [
          [76, 1], [81, 1], [84, 1], [83, 2], [81, 1], [80, 1], [76, 1], [77, 1], [76, 3],
          [74, 1], [77, 1], [81, 1], [80, 2], [77, 1], [76, 1], [72, 1], [71, 1], [69, 3],
        ];
        const bass = [57, 52, 52, 57, 50, 52, 52, 45];
        const beat = 60 / 150;
        let idx = 0;
        let bar = 0;
        let beatInBar = 0;
        l.next = this.now + 0.1;
        l.timer = setInterval(() => {
          while (l.next < this.now + 0.3) {
            const [m, len] = mel[idx % mel.length];
            const wob = 1 + Math.sin(this.now * 0.7) * 0.012 + rand(-0.006, 0.006);
            this.bell(midi(m) * wob, l.next, 0.22, 1.6, out);
            if (beatInBar === 0) this.bell(midi(bass[bar % bass.length] - 12) * wob, l.next, 0.12, 2.2, out);
            beatInBar += len;
            while (beatInBar >= 3) {
              beatInBar -= 3;
              bar++;
            }
            l.next += len * beat;
            idx++;
          }
        }, 80);
      },
      vol,
      0.5,
      'music',
    );
  }

  menuMusic() {
    // a cosy lounge loop for Gefen's friendly intro (before it all goes wrong)
    this._loop(
      'menu',
      (g, l) => {
        const out = this._gain(1, g);
        out.connect(this._gain(0.25, this.reverbSend));
        const chords = [
          [50, 53, 57, 60, 64],
          [43, 53, 59, 64, 69],
          [48, 52, 55, 59, 62],
          [45, 55, 61, 64, 70],
        ];
        const bassLines = [
          [38, 41, 45, 48],
          [43, 47, 50, 41],
          [36, 40, 43, 47],
          [45, 49, 52, 46],
        ];
        const spb = 60 / 84;
        let step = 0;
        l.next = this.now + 0.15;
        const track = (n) => {
          this.menuNodes.add(n);
          n.onended = () => this.menuNodes.delete(n);
          return n;
        };
        const ep = (m, t, v, dur) => {
          const f = midi(m);
          const gg = this._gain(0, out);
          gg.gain.setValueAtTime(0.0001, t);
          gg.gain.linearRampToValueAtTime(v, t + 0.01);
          gg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          const c = track(this._osc('sine', f, gg, t, dur));
          const mg = this._gain(0, c.frequency);
          mg.gain.setValueAtTime(f * 1.6, t);
          mg.gain.exponentialRampToValueAtTime(f * 0.15, t + 0.6);
          track(this._osc('sine', f, mg, t, dur));
        };
        const hat = (t, v) => {
          const gg = this._gain(0, out);
          this._env(gg.gain, t, 0.002, v, 0.06);
          this._noise(this._filter('highpass', 7000, 0.7, gg), t, 0.08);
        };
        l.timer = setInterval(() => {
          while (l.next < this.now + 0.3) {
            const bar = Math.floor(step / 8) % 4;
            const e = step % 8; // eighth notes
            const swing = e % 2 === 1 ? spb * 0.16 : 0;
            const t = l.next + swing;
            if (e === 0 || e === 5) chords[bar].forEach((m, i) => ep(m + 12, t + i * 0.012, 0.05, e === 0 ? 2.6 : 1.2));
            if (e % 2 === 0) {
              const bm = bassLines[bar][e / 2];
              const gg = this._gain(0, out);
              this._env(gg.gain, t, 0.01, 0.22, spb * 0.95);
              track(this._osc('triangle', midi(bm), this._filter('lowpass', 500, 1, gg), t, spb));
            }
            hat(t, e % 2 === 0 ? 0.025 : 0.015);
            if (e === 2 || e === 6) {
              const gg = this._gain(0, out);
              this._env(gg.gain, t, 0.02, 0.03, 0.25);
              this._noise(this._filter('bandpass', 3500, 0.6, gg), t, 0.3);
            }
            l.next += spb / 2;
            step++;
          }
        }, 70);
      },
      0.85,
      1.5,
      'music',
    );
  }

  tapeStop(dur = 1.6) {
    // the friendly music dies (pitch drops to nothing)
    const l = this.loops.get('menu');
    if (!l) return;
    clearInterval(l.timer);
    l.timer = null;
    const t = this.now;
    this.menuNodes.forEach((o) => {
      try {
        o.detune.cancelScheduledValues(t);
        o.detune.setValueAtTime(0, t);
        o.detune.linearRampToValueAtTime(-3000, t + dur);
      } catch (e) {}
    });
    const ld = this.loops.get('menu');
    ld.gain.gain.setTargetAtTime(0.0001, t + dur * 0.4, dur / 4);
    // a dying turntable groan
    const g = this._gain(0, this.sfxBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const o = this._osc('sawtooth', 180, this._filter('lowpass', 900, 1, g), t, dur);
    o.frequency.exponentialRampToValueAtTime(20, t + dur);
    setTimeout(() => this.stopLoop('menu', 0.1), dur * 1000 + 200);
  }

  stopAll(fade = 0.5) {
    [...this.loops.keys()].forEach((k) => this.stopLoop(k, fade));
  }

  // random creepy one-offs during nights
  ambientEvent() {
    if (!this.ctx) return;
    const r = Math.random();
    const pan = rand(-1, 1);
    const out = this._out('amb', pan, 1.2);
    const t = this.now;
    if (r < 0.35) {
      // two snooker balls clacking somewhere far away
      [0, rand(0.12, 0.3)].forEach((d) => {
        const g = this._gain(0, out);
        this._env(g.gain, t + d, 0.001, 0.12, 0.05);
        this._osc('sine', rand(2400, 3200), g, t + d, 0.06);
      });
    } else if (r < 0.6) {
      // a creak
      const g = this._gain(0, out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.4);
      const o = this._osc('sawtooth', rand(90, 160), this._filter('bandpass', 700, 6, g), t, 1.5);
      o.frequency.linearRampToValueAtTime(rand(60, 200), t + 1.4);
    } else if (r < 0.8) {
      // whisper-ish breath
      const g = this._gain(0, out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
      const f = this._filter('bandpass', 2400, 4, g);
      f.frequency.linearRampToValueAtTime(1400, t + 1.6);
      this._noise(f, t, 1.7);
    } else {
      // a ball rolling and dropping into a pocket
      const g = this._gain(0, out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.8);
      this._noise(this._filter('lowpass', 300, 1, g), t, 1.9, { buffer: this.brown });
      const g2 = this._gain(0, out);
      this._env(g2.gain, t + 1.85, 0.002, 0.12, 0.25);
      this._osc('sine', 240, g2, t + 1.85, 0.3);
    }
  }
}

export const audio = new AudioEngine();
