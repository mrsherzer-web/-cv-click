// Every sound is synthesised with Web Audio: no audio files to load.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) {
      this.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.windF = ctx.createBiquadFilter();
    this.windF.type = 'lowpass';
    this.windF.frequency.value = 300;
    this.windG = ctx.createGain();
    this.windG.gain.value = 0;
    src.connect(this.windF).connect(this.windG).connect(this.master);
    src.start();
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  wind(speed) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, Math.max(0, (speed - 8) / 70));
    this.windG.gain.setTargetAtTime(k * k * 0.5, t, 0.15);
    this.windF.frequency.setTargetAtTime(250 + k * 1800, t, 0.2);
  }

  _noise(dur, type, f0, f1, q, vol, attack = 0.005) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  _tone(freq, dur, vol, type = 'sine', delay = 0, f1 = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  thwip() {
    this._noise(0.16, 'bandpass', 3200, 700, 3, 0.5);
    this._tone(1400, 0.08, 0.06, 'triangle', 0, 500);
  }

  release() {
    this._noise(0.25, 'bandpass', 600, 1500, 1.2, 0.16);
  }

  jump() {
    this._noise(0.18, 'lowpass', 900, 300, 0.8, 0.22);
  }

  land(k) {
    this._noise(0.35, 'lowpass', 500, 80, 0.9, 0.3 + 0.5 * k);
    this._tone(70, 0.25, 0.25 * k + 0.01, 'sine', 0, 40);
  }

  boost() {
    this._noise(0.4, 'bandpass', 500, 2600, 1.5, 0.45);
    this.thwip();
  }

  ring(i) {
    const base = 523.25 * Math.pow(2, (i % 8) / 12);
    this._tone(base, 0.25, 0.18, 'triangle');
    this._tone(base * 1.5, 0.35, 0.14, 'triangle', 0.07);
  }

  finish() {
    [0, 4, 7, 12].forEach((s, k) => this._tone(523.25 * Math.pow(2, s / 12), 0.55, 0.16, 'triangle', k * 0.11));
  }

  splash() {
    this._noise(1.0, 'lowpass', 2500, 200, 0.7, 0.6, 0.01);
  }

  miss() {
    this._tone(220, 0.15, 0.08, 'square', 0, 160);
  }
}
