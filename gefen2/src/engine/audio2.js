// ============================================================================
//  Sound additions for the sequel (all synthesised; optional recorded samples)
// ============================================================================
import { AudioEngine, audio } from './audio.js';

const rand = (a, b) => a + Math.random() * (b - a);
const A = AudioEngine.prototype;

A.step = function (vol = 0.3, pan = 0, rate = 1) {
  if (!this.ctx) return;
  const t = this.now;
  const out = this._out('sfx', pan, 0.18);
  const g = this._gain(0, out);
  this._env(g.gain, t, 0.004, vol * rand(0.8, 1), 0.1);
  this._noise(this._filter('lowpass', rand(260, 420) * rate, 1, g), t, 0.12);
  const g2 = this._gain(0, out);
  this._env(g2.gain, t, 0.003, vol * 0.6, 0.08);
  const o = this._osc('sine', 88 * rate, g2, t, 0.1);
  o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
};

A.hiss = function (vol = 0.5, pan = 0) {
  if (!this.ctx) return;
  const t = this.now;
  const out = this._out('sfx', pan, 0.5);
  const g = this._gain(0, out);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  const f = this._filter('bandpass', 3200, 1.5, g);
  f.frequency.exponentialRampToValueAtTime(900, t + 0.9);
  this._noise(f, t, 1.0);
  const g2 = this._gain(0, out);
  this._env(g2.gain, t, 0.02, vol * 0.5, 0.7);
  const ws = this.ctx.createWaveShaper();
  ws.curve = this._distCurve(40);
  ws.connect(this._filter('lowpass', 900, 1, g2));
  const o = this._osc('sawtooth', 70, ws, t, 0.8);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.8);
};

/** Dull thump + rattle inside sheet metal */
A.ventThump = function (pan = 0, vol = 0.5) {
  if (!this.ctx) return;
  if (this.playSample('vent', { vol: vol * 1.4, pan })) return;
  const out = this._out('sfx', pan, 0.7);
  const n = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < n; i++) {
    const t = this.now + i * rand(0.22, 0.38);
    const g = this._gain(0, out);
    this._env(g.gain, t, 0.003, vol * rand(0.7, 1), 0.28);
    const o = this._osc('sine', rand(105, 135), g, t, 0.32);
    o.frequency.exponentialRampToValueAtTime(58, t + 0.28);
    [410, 640, 980, 1530].forEach((f, k) => {
      const gm = this._gain(0, out);
      this._env(gm.gain, t, 0.002, (vol * 0.22) / (k + 1), 0.5);
      this._noise(this._filter('bandpass', f * rand(0.96, 1.04), 30, gm), t, 0.55);
    });
  }
};

/** Electric crackle */
A.zap = function (pan = 0, vol = 0.3) {
  if (!this.ctx) return;
  const out = this._out('sfx', pan, 0.3);
  const t0 = this.now;
  for (let i = 0; i < 6; i++) {
    const t = t0 + i * rand(0.03, 0.09);
    const g = this._gain(0, out);
    this._env(g.gain, t, 0.001, vol * rand(0.4, 1), rand(0.02, 0.07));
    this._noise(this._filter('highpass', rand(1800, 5000), 1, g), t, 0.08);
  }
  const g2 = this._gain(0, out);
  this._env(g2.gain, t0, 0.01, vol * 0.5, 0.45);
  this._osc('sawtooth', 50, this._filter('bandpass', 400, 3, g2), t0, 0.5);
};

A.hum = function (vol = 0.1) {
  this._loop('hum', (g, l) => {
    [50, 100, 150].forEach((f, i) => l.nodes.push(this._osc(i ? 'sine' : 'sawtooth', f, this._gain(i ? 0.25 : 0.5, this._filter('lowpass', 420, 1, g)), this.now)));
  }, vol, 0.5);
};

A.phoneRing = function () {
  this._loop('ring', (g, l) => {
    const ng = this._gain(0, g);
    l.nodes.push(this._osc('square', 1180, this._filter('bandpass', 1500, 2, ng), this.now));
    l.nodes.push(this._osc('square', 1480, this._filter('bandpass', 1500, 2, ng), this.now));
    let i = 0;
    const step = () => {
      const t = this.now;
      const on = i++ % 6 < 3;
      ng.gain.setTargetAtTime(on ? 0.12 : 0, t, 0.008);
    };
    step();
    l.timer = setInterval(step, 160);
  }, 0.7, 0.05, 'sfx');
};

A.msgPing = function (vol = 0.2) {
  if (!this.ctx) return;
  const out = this._out('sfx', 0, 0.2);
  [0, 0.12].forEach((d, i) => {
    const g = this._gain(0, out);
    this._env(g.gain, this.now + d, 0.004, vol, 0.25);
    this._osc('sine', i ? 1320 : 990, g, this.now + d, 0.3);
  });
};

A.errorBeep = function (vol = 0.15) {
  if (!this.ctx) return;
  const out = this._out('sfx');
  [0, 0.16].forEach((d) => {
    const g = this._gain(0, out);
    this._env(g.gain, this.now + d, 0.004, vol, 0.1);
    this._osc('square', 310, this._filter('lowpass', 1400, 1, g), this.now + d, 0.12);
  });
};

A.okBeep = function (vol = 0.14) {
  if (!this.ctx) return;
  const out = this._out('sfx');
  [660, 880, 1320].forEach((f, i) => {
    const g = this._gain(0, out);
    this._env(g.gain, this.now + i * 0.07, 0.004, vol, 0.12);
    this._osc('triangle', f, g, this.now + i * 0.07, 0.14);
  });
};

A.switchClack = function (vol = 0.4, pan = 0) {
  if (!this.ctx) return;
  const t = this.now;
  const out = this._out('sfx', pan, 0.3);
  const g = this._gain(0, out);
  this._env(g.gain, t, 0.001, vol, 0.06);
  this._noise(this._filter('bandpass', 1900, 2, g), t, 0.07);
  const g2 = this._gain(0, out);
  this._env(g2.gain, t, 0.002, vol * 0.7, 0.12);
  this._osc('sine', 140, g2, t, 0.14);
};

/** Ball dropping into a pocket */
A.pot = function (vol = 0.5) {
  if (!this.ctx) return;
  const t = this.now;
  const out = this._out('sfx', 0, 0.6);
  const c = this._gain(0, out);
  this._env(c.gain, t, 0.001, vol, 0.05);
  this._osc('sine', 2700, c, t, 0.06);
  const g = this._gain(0, out);
  g.gain.setValueAtTime(0.0001, t + 0.1);
  g.gain.linearRampToValueAtTime(vol * 0.4, t + 0.3);
  g.gain.linearRampToValueAtTime(0.0001, t + 0.9);
  this._noise(this._filter('lowpass', 320, 1, g), t + 0.1, 0.9, { buffer: this.brown });
  const g2 = this._gain(0, out);
  this._env(g2.gain, t + 0.95, 0.002, vol * 0.9, 0.35);
  const o = this._osc('sine', 210, g2, t + 0.95, 0.4);
  o.frequency.exponentialRampToValueAtTime(90, t + 1.3);
};

A.ballBounce = function (pan = 0, vol = 0.4) {
  if (!this.ctx) return;
  const out = this._out('sfx', pan, 0.5);
  let t = this.now;
  let v = vol;
  let gap = 0.34;
  for (let i = 0; i < 6; i++) {
    const g = this._gain(0, out);
    this._env(g.gain, t, 0.001, v, 0.06);
    this._osc('sine', rand(1500, 1900), g, t, 0.07);
    const g2 = this._gain(0, out);
    this._env(g2.gain, t, 0.001, v * 0.5, 0.05);
    this._osc('sine', 210, g2, t, 0.06);
    t += gap;
    gap *= 0.68;
    v *= 0.7;
  }
};

A.generator = function (vol = 0.3) {
  this._loop('generator', (g, l) => {
    const lp = this._filter('lowpass', 260, 2, g);
    const trem = this._gain(0.6, lp);
    const lfo = this._osc('square', 23, this._gain(0.4, trem.gain), this.now);
    l.nodes.push(lfo, this._osc('sawtooth', 46, trem, this.now), this._osc('sawtooth', 69.5, this._gain(0.5, trem), this.now));
    l.nodes.push(this._noise(this._gain(0.25, this._filter('bandpass', 900, 1, g)), this.now, null, { loop: true }));
  }, vol, 1.5);
};

A.rumble = function (vol = 0.6) {
  this._loop('rumble', (g, l) => {
    const lp = this._filter('lowpass', 90, 1, g);
    l.nodes.push(this._noise(lp, this.now, null, { buffer: this.brown, loop: true }));
    const o = this._osc('sine', 33, this._gain(0.6, g), this.now);
    l.nodes.push(o, this._osc('sine', 0.3, this._gain(8, o.frequency), this.now));
  }, vol, 0.8);
};

A.creak = function (pan = 0, vol = 0.2) {
  if (!this.ctx) return;
  const t = this.now;
  const out = this._out('sfx', pan, 0.6);
  const g = this._gain(0, out);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.2);
  g.gain.linearRampToValueAtTime(0.0001, t + 1.1);
  const o = this._osc('sawtooth', rand(110, 150), this._filter('bandpass', 760, 7, g), t, 1.2);
  o.frequency.linearRampToValueAtTime(rand(180, 240), t + 1.0);
};

A.glassKnock = function (count = 4, pan = 0.6) {
  if (!this.ctx) return;
  const out = this._out('sfx', pan, 0.6);
  for (let i = 0; i < count; i++) {
    const t = this.now + i * 0.22;
    const g = this._gain(0, out);
    this._env(g.gain, t, 0.001, 0.4, 0.08);
    this._noise(this._filter('bandpass', 1500, 6, g), t, 0.1);
    const g2 = this._gain(0, out);
    this._env(g2.gain, t, 0.001, 0.25, 0.09);
    this._osc('sine', 420, g2, t, 0.1);
  }
};

/** Whisper bed that gets louder as Ido comes close: setLoopGain('whisper', v) */
A.whisper = function () {
  this._loop('whisper', (g, l) => {
    const f = this._filter('bandpass', 2100, 3, g);
    const ng = this._gain(0.5, f);
    l.nodes.push(this._noise(ng, this.now, null, { loop: true }));
    const lfo = this._osc('sine', 3.1, this._gain(0.45, ng.gain), this.now);
    const lfo2 = this._osc('sine', 0.23, this._gain(700, f.frequency), this.now);
    l.nodes.push(lfo, lfo2);
  }, 0.0001, 0.3, 'sfx');
};

/**
 * Dynamic tension bed: low pulse + dissonant strings. setTension(0..1) every frame.
 */
A.tensionStart = function () {
  this._loop('tension', (g, l) => {
    const pulseG = this._gain(0, g);
    const strG = this._gain(0, g);
    l.pulseG = pulseG;
    l.strG = strG;
    const lp = this._filter('lowpass', 900, 1, strG);
    [233.1, 246.9, 277.2, 466.2, 493.9].forEach((f, i) => {
      const o = this._osc('sawtooth', f, this._gain(0.07, lp), this.now);
      const v = this._osc('sine', 4.3 + i * 0.37, this._gain(f * 0.006, o.frequency), this.now);
      l.nodes.push(o, v);
    });
    l.bpm = 70;
    let next = this.now + 0.1;
    l.timer = setInterval(() => {
      while (next < this.now + 0.25) {
        const gg = this._gain(0, pulseG);
        this._env(gg.gain, next, 0.005, 1, 0.22);
        const o = this._osc('sine', 62, gg, next, 0.3);
        o.frequency.exponentialRampToValueAtTime(38, next + 0.2);
        const gg2 = this._gain(0, pulseG);
        this._env(gg2.gain, next + 0.19, 0.005, 0.6, 0.2);
        const o2 = this._osc('sine', 55, gg2, next + 0.19, 0.3);
        o2.frequency.exponentialRampToValueAtTime(34, next + 0.4);
        next += 60 / l.bpm;
      }
    }, 90);
  }, 1, 0.5, 'music');
};

A.setTension = function (v) {
  const l = this.loops.get('tension');
  if (!l) return;
  const t = this.now;
  l.pulseG.gain.setTargetAtTime(Math.min(0.6, Math.max(0, v - 0.15) * 0.8), t, 0.25);
  l.strG.gain.setTargetAtTime(Math.max(0, v - 0.55) * 0.55, t, 0.4);
  l.bpm = 66 + v * 74;
};

/** Dark menu theme: slow detuned piano-ish notes over a pad */
A.menuTheme = function () {
  this._loop('menu2', (g, l) => {
    const pad = this._filter('lowpass', 520, 1, this._gain(0.5, g));
    [55, 82.4, 110.3, 130.8, 164.8].forEach((f) => l.nodes.push(this._osc('sawtooth', f, this._gain(0.06, pad), this.now)));
    l.nodes.push(this._osc('sine', 0.08, this._gain(140, pad.frequency), this.now));
    const notes = [220, 261.6, 246.9, 196, 220, 329.6, 311.1, 246.9];
    let i = 0;
    const play = () => {
      const f = notes[i++ % notes.length] * (Math.random() < 0.2 ? 0.5 : 1);
      const t = this.now + 0.05;
      const out = this._gain(0, g);
      out.connect(this._gain(0.9, this.reverbSend));
      this._env(out.gain, t, 0.01, 0.2, 2.8);
      this._osc('triangle', f, out, t, 3);
      this._osc('sine', f * 2.01, this._gain(0.3, out), t, 3);
    };
    play();
    l.timer = setInterval(play, 2100);
  }, 0.55, 2, 'music');
};

A.sixAM = function () {
  if (!this.ctx) return;
  const out = this._out('music', 0, 0.8);
  [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => this.bell(f, this.now + i * 0.42, 0.22, 3.2, out));
};

A.dawn = function () {
  this._loop('dawn', (g, l) => {
    const lp = this._filter('lowpass', 1400, 0.7, g);
    [130.8, 196, 261.6, 329.6, 392, 523.2].forEach((f, i) => {
      const o = this._osc(i % 2 ? 'sine' : 'triangle', f, this._gain(0.08, lp), this.now);
      l.nodes.push(o, this._osc('sine', 0.11 + i * 0.03, this._gain(f * 0.004, o.frequency), this.now));
    });
    g.connect(this._gain(0.7, this.reverbSend));
  }, 0.5, 4, 'music');
};

// ------------------------------------------------------------ recorded samples
A.samples = {};
A.loadSample = async function (name, url) {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    this._pending = this._pending || {};
    this._pending[name] = buf;
  } catch (e) {}
};
A.decodePending = async function () {
  if (!this.ctx || !this._pending) return;
  for (const [name, buf] of Object.entries(this._pending)) {
    try {
      this.samples[name] = await this.ctx.decodeAudioData(buf.slice(0));
    } catch (e) {}
  }
  this._pending = null;
};
/** Play a decoded sample. Returns the source node or null when the sample is missing. */
A.playSample = function (name, { vol = 1, pan = 0, rate = 1, reverb = 0.2, bus = 'sfx', filter = null } = {}) {
  if (!this.ctx) return null;
  const b = this.samples[name];
  if (!b) return null;
  let dest = this._out(bus, pan, reverb);
  if (filter === 'radio') dest = this._filter('bandpass', 1500, 0.9, dest);
  if (filter === 'demon') {
    const ws = this.ctx.createWaveShaper();
    ws.curve = this._distCurve(12);
    ws.connect(this._filter('lowpass', 2600, 0.7, dest));
    dest = ws;
  }
  const g = this._gain(vol, dest);
  const s = this.ctx.createBufferSource();
  s.buffer = b;
  s.playbackRate.value = rate;
  s.connect(g);
  s.start();
  return s;
};

export { audio };
