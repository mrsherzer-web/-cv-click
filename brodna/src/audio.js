// Every sound is synthesised with Web Audio: no audio files to load.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.amb = null;
    this.ambKind = null;
    this.timers = { chirp: 0, drip: 0, bird: 0, murmur: 0 };
    this.ringing = null;
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
    this.master.gain.value = this.enabled ? 0.85 : 0;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // car engine: two saws through a lowpass
    this.engG = ctx.createGain();
    this.engG.gain.value = 0;
    this.engF = ctx.createBiquadFilter();
    this.engF.type = 'lowpass';
    this.engF.frequency.value = 400;
    this.engO1 = ctx.createOscillator();
    this.engO2 = ctx.createOscillator();
    this.engO1.type = 'sawtooth';
    this.engO2.type = 'sawtooth';
    this.engO1.frequency.value = 45;
    this.engO2.frequency.value = 45.7;
    this.engO1.connect(this.engF);
    this.engO2.connect(this.engF);
    this.engF.connect(this.engG).connect(this.master);
    this.engO1.start();
    this.engO2.start();
    // suspense pulse
    this.pulseG = ctx.createGain();
    this.pulseG.gain.value = 0;
    this.pulseG.connect(this.master);
    this.pulseLevel = 0;
    this.pulseT = 0;
    if (this.ambKind) this.ambience(this.ambKind, true);
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.05);
  }

  _noiseSrc(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = loop;
    return s;
  }

  // Continuous background bed for a place.
  ambience(kind, force = false) {
    if (kind === this.ambKind && !force) return;
    this.ambKind = kind;
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.amb) {
      const old = this.amb;
      old.gain.gain.setTargetAtTime(0, t, 0.6);
      setTimeout(() => old.nodes.forEach((n) => n.stop && n.stop()), 3000);
    }
    if (!kind) {
      this.amb = null;
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);
    const nodes = [];
    const bed = (type, freq, q, vol) => {
      const s = this._noiseSrc();
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = vol;
      s.connect(f).connect(g).connect(gain);
      s.start(t, Math.random());
      nodes.push(s);
    };
    const drone = (freq, type, vol, lp = 300) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(f).connect(g).connect(gain);
      o.start();
      nodes.push(o);
    };
    if (kind === 'mall') {
      bed('bandpass', 650, 0.5, 0.22);
      bed('lowpass', 250, 0.7, 0.18);
      drone(130.8, 'triangle', 0.025, 900);
      drone(196, 'triangle', 0.018, 900);
    } else if (kind === 'road') {
      bed('lowpass', 380, 0.6, 0.14);
    } else if (kind === 'night') {
      bed('lowpass', 300, 0.5, 0.1);
      bed('highpass', 5000, 0.3, 0.012);
    } else if (kind === 'bunker') {
      drone(55, 'sawtooth', 0.09, 180);
      drone(55.6, 'sawtooth', 0.07, 160);
      bed('bandpass', 120, 1.2, 0.2);
    } else if (kind === 'dawn') {
      bed('lowpass', 500, 0.4, 0.08);
    }
    gain.gain.setTargetAtTime(1, t, 0.8);
    this.amb = { gain, nodes };
  }

  // Random one-shots that bring a place alive.
  update(dt) {
    if (!this.ctx) return;
    const T = this.timers;
    if (this.ambKind === 'night') {
      T.chirp -= dt;
      if (T.chirp <= 0) {
        T.chirp = 0.25 + Math.random() * 0.9;
        const f = 3800 + Math.random() * 900;
        for (let i = 0; i < 3; i++) this._tone(f, 0.04, 0.012, 'sine', i * 0.07);
      }
    } else if (this.ambKind === 'bunker') {
      T.drip -= dt;
      if (T.drip <= 0) {
        T.drip = 1.5 + Math.random() * 4;
        this._tone(1200 + Math.random() * 600, 0.12, 0.05, 'sine', 0, 300);
      }
    } else if (this.ambKind === 'dawn') {
      T.bird -= dt;
      if (T.bird <= 0) {
        T.bird = 0.6 + Math.random() * 2.2;
        const f = 2200 + Math.random() * 1600;
        this._tone(f, 0.09, 0.03, 'sine', 0, f * 1.4);
        this._tone(f * 1.2, 0.08, 0.025, 'sine', 0.12, f * 0.9);
      }
    } else if (this.ambKind === 'mall') {
      T.murmur -= dt;
      if (T.murmur <= 0) {
        T.murmur = 2 + Math.random() * 5;
        this._noise(0.4, 'bandpass', 900 + Math.random() * 600, 700, 3, 0.05, 0.1);
      }
    }
    // suspense heartbeat
    if (this.pulseLevel > 0.02) {
      this.pulseT -= dt * (0.9 + this.pulseLevel * 1.6);
      if (this.pulseT <= 0) {
        this.pulseT = 1;
        const v = 0.05 + this.pulseLevel * 0.25;
        this._tone(55, 0.16, v, 'sine', 0, 40);
        this._tone(52, 0.14, v * 0.7, 'sine', 0.18, 38);
      }
    }
  }

  suspense(level) {
    this.pulseLevel = level;
  }

  engine(on, speed = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const k = Math.min(1, Math.abs(speed) / 22);
    this.engG.gain.setTargetAtTime(on ? 0.05 + k * 0.07 : 0, t, 0.15);
    this.engO1.frequency.setTargetAtTime(38 + k * 70, t, 0.12);
    this.engO2.frequency.setTargetAtTime(38.7 + k * 71, t, 0.12);
    this.engF.frequency.setTargetAtTime(260 + k * 900, t, 0.15);
  }

  _noise(dur, type, f0, f1, q, vol, attack = 0.005, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = this._noiseSrc(false);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
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

  step(surface = 'hard', soft = false) {
    const v = soft ? 0.03 : 0.07;
    if (surface === 'grass') this._noise(0.09, 'lowpass', 1800, 500, 0.7, v * 0.8);
    else if (surface === 'gravel') this._noise(0.11, 'bandpass', 2600, 900, 0.8, v);
    else this._noise(0.07, 'bandpass', 1500, 400, 1.2, v);
  }

  blip(pitch = 1) {
    this._tone(380 * pitch + Math.random() * 30, 0.04, 0.03, 'triangle');
  }

  startRing() {
    if (!this.ctx || this.ringing) return;
    const play = () => {
      const notes = [1046.5, 1318.5, 1568, 1318.5, 1046.5, 1568, 2093];
      notes.forEach((f, i) => this._tone(f, 0.16, 0.08, 'sine', i * 0.13));
    };
    play();
    this.ringing = setInterval(play, 1600);
  }

  stopRing() {
    if (this.ringing) clearInterval(this.ringing);
    this.ringing = null;
  }

  sting(kind) {
    if (!this.ctx) return;
    switch (kind) {
      case 'key':
        [0, 4, 7, 12].forEach((s, i) => this._tone(880 * Math.pow(2, s / 12), 0.3, 0.07, 'triangle', i * 0.06));
        break;
      case 'door':
        this._noise(0.6, 'lowpass', 900, 120, 1, 0.25, 0.01);
        this._tone(90, 0.5, 0.12, 'sawtooth', 0, 60);
        break;
      case 'lock':
        this._noise(0.08, 'bandpass', 3000, 1500, 4, 0.2);
        this._noise(0.1, 'bandpass', 2000, 800, 4, 0.18, 0.005, 0.12);
        break;
      case 'caught':
        [0, 1, 6].forEach((s) => this._tone(110 * Math.pow(2, s / 12), 1.1, 0.12, 'sawtooth'));
        this._noise(0.8, 'lowpass', 600, 100, 0.8, 0.3, 0.01);
        break;
      case 'reveal':
        [0, 3, 6, 10].forEach((s, i) => this._tone(220 * Math.pow(2, s / 12), 1.4, 0.08, 'sawtooth', i * 0.05));
        break;
      case 'success':
        [0, 4, 7, 12, 16].forEach((s, i) => this._tone(523.25 * Math.pow(2, s / 12), 0.6, 0.09, 'triangle', i * 0.11));
        break;
      case 'objective':
        this._tone(660, 0.18, 0.06, 'triangle');
        this._tone(990, 0.25, 0.05, 'triangle', 0.1);
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) this._noise(0.06, 'bandpass', 400 + Math.random() * 3000, 300, 2, 0.15, 0.002, i * 0.07);
        break;
      case 'hangup':
        this._tone(480, 0.25, 0.08, 'sine');
        this._tone(480, 0.25, 0.08, 'sine', 0.4);
        this._tone(480, 0.25, 0.08, 'sine', 0.8);
        break;
      case 'dial':
        this._tone(425, 0.9, 0.06, 'sine');
        this._tone(425, 0.9, 0.06, 'sine', 1.6);
        break;
      case 'alarm':
        for (let i = 0; i < 4; i++) this._tone(880, 0.25, 0.1, 'square', i * 0.5, 600);
        break;
      case 'shout':
        this._noise(0.5, 'bandpass', 500, 300, 1.5, 0.2, 0.02);
        break;
      case 'grab':
        this._noise(0.3, 'lowpass', 800, 150, 1, 0.3, 0.01);
        this._tone(70, 0.4, 0.2, 'sine', 0, 40);
        break;
      case 'hold':
        this._tone(520, 0.08, 0.04, 'triangle');
        break;
      case 'free':
        this._noise(0.25, 'highpass', 2000, 4000, 1, 0.12);
        this._tone(784, 0.3, 0.07, 'triangle', 0.05);
        break;
      case 'horn':
        this._tone(392, 0.35, 0.09, 'square');
        this._tone(494, 0.35, 0.07, 'square');
        break;
      case 'slam':
        this._noise(0.5, 'lowpass', 400, 60, 1, 0.5, 0.005);
        this._tone(60, 0.5, 0.3, 'sine', 0, 35);
        break;
    }
  }
}
