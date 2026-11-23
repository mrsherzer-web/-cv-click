/* Procedural audio: a lo-fi hip-hop loop that intensifies with the waves, plus synth SFX. No samples. */
const AudioSys = {
  ctx: null, master: null, musicBus: null, sfxBus: null,
  enabled: true, musicOn: false,
  bpm: 84, step: 0, nextTime: 0, timer: null, intensity: 0, bossMode: false,
  // Dm9 → Gm7 → Bbmaj7 → A7(b9)   (midi notes)
  chords: [
    { bass: 38, keys: [62, 65, 69, 72, 76] },
    { bass: 43, keys: [62, 65, 70, 74] },
    { bass: 46, keys: [62, 65, 69, 70] },
    { bass: 45, keys: [61, 64, 67, 70] },
  ],
  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const c = this.ctx = new AC();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master = c.createGain(); this.master.gain.value = 0.9;
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.42;
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.7;
    // lo-fi character: gentle lowpass on music
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.5;
    this.musicBus.connect(lp); lp.connect(comp);
    this.sfxBus.connect(comp);
    comp.connect(this.master); this.master.connect(c.destination);
    // noise buffer shared by drums/sfx
    const len = c.sampleRate * 1.5, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggle() { this.enabled = !this.enabled; if (this.master) this.master.gain.value = this.enabled ? 0.9 : 0; return this.enabled; },
  setMusicVolume(v) { if (this.musicBus) this.musicBus.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3); },

  /* ---------- music ---------- */
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true; this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 25);
  },
  stopMusic() { this.musicOn = false; if (this.timer) clearInterval(this.timer); this.timer = null; },
  setIntensity(n, boss) { this.intensity = n; this.bossMode = !!boss; this.bpm = boss ? 96 : 84; },
  schedule() {
    const c = this.ctx; const spb = 60 / this.bpm / 4; // 16th
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime);
      // swing: delay odd 16ths slightly
      this.nextTime += spb * (this.step % 2 === 0 ? 1.12 : 0.88);
      this.step = (this.step + 1) % 64;
    }
  },
  playStep(s, t) {
    const bar = Math.floor(s / 16), st = s % 16, I = this.intensity, ch = this.chords[bar % 4];
    // drums
    if (st === 0 || st === 8 || (I >= 2 && st === 11) || (I >= 3 && st === 6)) this.kick(t);
    if (st === 4 || st === 12) this.snare(t, I >= 1 ? 1 : 0.7);
    if (I >= 1 && st % 2 === 0) this.hat(t, st % 4 === 0 ? 0.35 : 0.22, false);
    if (I >= 2 && st === 14) this.hat(t, 0.3, true);
    if (I === 0 && st % 4 === 2) this.hat(t, 0.15, false);
    // bass
    if (st === 0 || st === 10 || (I >= 2 && st === 7)) this.bass(this.mtof(ch.bass), t, st === 0 ? 0.55 : 0.3);
    if (I >= 1 && st === 14) this.bass(this.mtof(ch.bass + 7), t, 0.22);
    // keys
    if (st === 0 || (I >= 1 && st === 9)) this.keys(ch.keys, t, st === 0 ? 1.4 : 0.7);
    // arp (high intensity)
    if (I >= 3 && st % 2 === 1) this.pluck(this.mtof(ch.keys[(st >> 1) % ch.keys.length] + 12), t, 0.12);
    if (this.bossMode && st % 4 === 0) this.pluck(this.mtof(ch.bass + 24 + (st === 8 ? 1 : 0)), t, 0.25, 'sawtooth');
  },
  env(g, t, a, d, peak, sustain, r, end) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + end);
  },
  kick(t) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(1.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.35);
  },
  snare(t, v) {
    const c = this.ctx, n = c.createBufferSource(); n.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = c.createGain(); g.gain.setValueAtTime(0.6 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    n.connect(f); f.connect(g); g.connect(this.musicBus); n.start(t); n.stop(t + 0.2);
    const o = c.createOscillator(), g2 = c.createGain(); o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    g2.gain.setValueAtTime(0.35 * v, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g2); g2.connect(this.musicBus); o.start(t); o.stop(t + 0.12);
  },
  hat(t, v, open) {
    const c = this.ctx, n = c.createBufferSource(); n.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.25 : 0.05));
    n.connect(f); f.connect(g); g.connect(this.musicBus); n.start(t); n.stop(t + 0.3);
  },
  bass(freq, t, dur) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = freq; o2.frequency.value = freq * 0.5;
    f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(220, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  },
  keys(notes, t, dur) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(700, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    // slow tremolo
    const trem = c.createOscillator(), tg = c.createGain(); trem.frequency.value = 5.5; tg.gain.value = 0.05; trem.connect(tg); tg.connect(g.gain); trem.start(t); trem.stop(t + dur);
    notes.forEach((m, i) => {
      for (let k = -1; k <= 1; k += 2) {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = this.mtof(m); o.detune.value = k * 7 + (i % 2 ? 3 : -3);
        o.connect(f); o.start(t + i * 0.012); o.stop(t + dur + 0.05);
      }
    });
    f.connect(g); g.connect(this.musicBus);
  },
  pluck(freq, t, dur, type) {
    const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(400, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.005); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + dur + 0.02);
  },

  /* ---------- SFX ---------- */
  tone(freq0, freq1, dur, type, vol, when) {
    const c = this.ctx; if (!c) return; const t = when || c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, type, freq, q, when) {
    const c = this.ctx; if (!c) return; const t = when || c.currentTime;
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq || 1500; f.Q.value = q || 0.7;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(this.sfxBus); n.start(t); n.stop(t + dur + 0.02);
  },
  lastSfx: {},
  sfx(name) {
    if (!this.ctx || !this.enabled) return;
    const now = this.ctx.currentTime;
    // rate-limit spammy sounds
    const minGap = { shoot: 0.045, hit: 0.03, kill: 0.04, pickup: 0.03 }[name] || 0;
    if (minGap && this.lastSfx[name] && now - this.lastSfx[name] < minGap) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'shoot': this.noise(0.08, 0.25, 'bandpass', 2400, 1.2); this.tone(520, 180, 0.07, 'sine', 0.12); break;
      case 'boomer': this.tone(300, 900, 0.12, 'triangle', 0.15); break;
      case 'fire': this.noise(0.15, 0.3, 'lowpass', 1200); this.tone(200, 60, 0.15, 'sawtooth', 0.12); break;
      case 'hit': this.noise(0.05, 0.3, 'bandpass', 900, 1); break;
      case 'crit': this.noise(0.08, 0.4, 'bandpass', 1400, 1); this.tone(900, 300, 0.1, 'square', 0.12); break;
      case 'kill': this.tone(320, 50, 0.14, 'sine', 0.35); this.noise(0.1, 0.25, 'lowpass', 800); break;
      case 'explode': this.noise(0.45, 0.8, 'lowpass', 500); this.tone(120, 30, 0.4, 'sine', 0.5); break;
      case 'pickup': this.tone(880, 1320, 0.07, 'sine', 0.18); break;
      case 'heal': [523, 659, 784].forEach((f, i) => this.tone(f, f, 0.18, 'triangle', 0.2, now + i * 0.07)); break;
      case 'hurt': this.tone(220, 70, 0.22, 'sawtooth', 0.35); this.noise(0.2, 0.4, 'lowpass', 600); break;
      case 'dash': this.noise(0.22, 0.35, 'highpass', 1800); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.3, 'square', 0.12, now + i * 0.08)); break;
      case 'wave': this.tone(196, 196, 0.5, 'sawtooth', 0.2); this.tone(392, 392, 0.5, 'triangle', 0.15, now + 0.1); break;
      case 'boss': for (let i = 0; i < 4; i++) { this.tone(70, 55, 0.5, 'sawtooth', 0.4, now + i * 0.45); this.noise(0.4, 0.3, 'lowpass', 300, 1, now + i * 0.45); } break;
      case 'bossdie': this.noise(1.2, 1, 'lowpass', 900); this.tone(200, 20, 1.1, 'sawtooth', 0.6); [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.4, 'square', 0.14, now + 0.5 + i * 0.1)); break;
      case 'laugh': for (let i = 0; i < 7; i++) { const t = now + i * 0.11; this.tone(460 - i * 22, 330 - i * 18, 0.09, 'sawtooth', 0.22, t); this.noise(0.08, 0.25, 'bandpass', 1100, 2, t); } break;
      case 'eshoot': this.tone(700, 250, 0.1, 'square', 0.1); break;
      case 'click': this.tone(600, 900, 0.05, 'sine', 0.15); break;
      case 'select': [660, 990].forEach((f, i) => this.tone(f, f, 0.12, 'triangle', 0.18, now + i * 0.06)); break;
      case 'warn': this.tone(880, 880, 0.08, 'square', 0.15); this.tone(880, 880, 0.08, 'square', 0.15, now + 0.12); break;
      case 'gameover': [392, 349, 311, 261].forEach((f, i) => this.tone(f, f * 0.98, 0.5, 'sawtooth', 0.22, now + i * 0.35)); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.35, 'square', 0.14, now + i * 0.13)); break;
    }
  },
};
