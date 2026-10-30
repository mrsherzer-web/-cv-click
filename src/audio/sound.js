// All the game's sound, made on the spot with the Web Audio API: no recordings, nothing borrowed. The
// Renault's engine follows speed and gas, tires squeal in a slide, punches thump, crashes crunch, the
// phone rings, a short chime closes a mission, and a soft wind (or the hum of the city) sits underneath.
// Starts on the first tap (browsers require a gesture) and can be muted from the screen.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engine = null;
  }

  // call from a tap: browsers only let sound start inside a user gesture
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted || this.paused ? 0 : 0.8;
    this.master.connect(ctx.destination);
    // one second of noise, shared by wind, skids and hits
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    this.makeEngine();
    this.makeAmbience();
  }

  setMuted(on) {
    this.muted = on;
    this.level();
  }

  // quiet while the game is paused, without forgetting the mute setting
  setPaused(on) {
    this.paused = on;
    this.level();
  }

  level() {
    if (this.master) this.master.gain.setTargetAtTime(this.muted || this.paused ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  noiseSource(loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  makeEngine() {
    const ctx = this.ctx, a = ctx.createOscillator(), b = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    a.type = 'sawtooth'; b.type = 'square';
    a.frequency.value = 38; b.frequency.value = 19;
    f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 2;
    g.gain.value = 0;
    const bg = ctx.createGain();
    bg.gain.value = 0.45;
    a.connect(f); b.connect(bg); bg.connect(f); f.connect(g); g.connect(this.master);
    a.start(); b.start();
    // tire squeal: band-passed noise, silent until the car slides
    const sq = this.noiseSource(true), sf = ctx.createBiquadFilter(), sg = ctx.createGain();
    sf.type = 'bandpass'; sf.frequency.value = 1900; sf.Q.value = 6;
    sg.gain.value = 0;
    sq.connect(sf); sf.connect(sg); sg.connect(this.master);
    sq.start();
    this.engine = { a, b, f, g, sg };
  }

  makeAmbience() {
    const ctx = this.ctx, n = this.noiseSource(true), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 380;
    g.gain.value = 0.05;
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start();
    this.amb = { f, g };
  }

  // once a frame: engine pitch and loudness, squeal, and the background for where Nehorai is
  update({ driving, speed = 0, throttle = 0, slip = 0, city = false }) {
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime, e = this.engine, v = Math.abs(speed);
    const rev = 38 + v * 3.1 + throttle * 14 - Math.floor(v / 9) * 18; // a gear change every so often
    e.a.frequency.setTargetAtTime(Math.max(30, rev), t, 0.08);
    e.b.frequency.setTargetAtTime(Math.max(15, rev / 2), t, 0.08);
    e.f.frequency.setTargetAtTime(300 + v * 26 + throttle * 300, t, 0.1);
    e.g.gain.setTargetAtTime(driving ? 0.05 + throttle * 0.07 + Math.min(v, 30) * 0.002 : 0, t, 0.12);
    e.sg.gain.setTargetAtTime(driving && Math.abs(slip) > 0.22 && v > 6 ? Math.min(0.09, Math.abs(slip) * 0.2) : 0, t, 0.05);
    this.amb.f.frequency.setTargetAtTime(city ? 240 : 520, t, 1);
    this.amb.g.gain.setTargetAtTime(city ? 0.07 : 0.045, t, 1);
  }

  // short sounds
  hit(kind = 'punch', strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (kind === 'punch' || kind === 'block' || kind === 'bag') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(kind === 'bag' ? 120 : kind === 'block' ? 210 : 95, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.35 * strength, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.18);
    }
    const n = this.noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = kind === 'crash' ? 'lowpass' : 'highpass';
    f.frequency.value = kind === 'crash' ? 900 : kind === 'block' ? 2500 : 1400;
    const len = kind === 'crash' ? 0.35 : 0.06;
    g.gain.setValueAtTime((kind === 'crash' ? 0.5 : 0.18) * strength, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t, Math.random() * 0.5, len + 0.05);
  }

  // two tones, twice: the phone
  ring() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let k = 0; k < 2; k++) {
      for (const [hz, at] of [[880, 0], [660, 0.12]]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), s = t + k * 0.5 + at;
        o.type = 'triangle';
        o.frequency.value = hz;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.12, s + 0.01);
        g.gain.setValueAtTime(0.12, s + 0.09);
        g.gain.linearRampToValueAtTime(0, s + 0.11);
        o.connect(g); g.connect(this.master);
        o.start(s); o.stop(s + 0.12);
      }
    }
  }

  // the boxing bell: a bright metal strike with long partials, `times` in a row
  bell(times = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let k = 0; k < times; k++) {
      const s = t + k * 0.32;
      for (const [hz, amp, len] of [[1180, 0.14, 1.6], [2650, 0.06, 0.9], [3970, 0.03, 0.5], [590, 0.05, 1.2]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = hz;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(amp, s + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0008, s + len);
        o.connect(g); g.connect(this.master);
        o.start(s); o.stop(s + len + 0.05);
      }
    }
  }

  // a small crowd going up: a swell of filtered noise
  cheer(strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, n = this.noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.7;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 * strength, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t, Math.random() * 0.5, 1.9);
  }

  // a mission done: three rising notes; failed: two falling
  chime(good = true) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, notes = good ? [523.25, 659.25, 783.99] : [392, 311.13];
    notes.forEach((hz, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.13;
      o.type = 'triangle';
      o.frequency.value = hz;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.16, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.5);
      o.connect(g); g.connect(this.master);
      o.start(s); o.stop(s + 0.55);
    });
  }
}
