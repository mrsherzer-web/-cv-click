import type { BeatPattern, Instrument } from "../data/site";

// מנוע אודיו קטן ב-Web Audio: סינתזה של תופים, 808 וכלים מלודיים,
// עם scheduler מדויק (lookahead) כדי שהגרוב לא ירעד.

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export type Sequence = {
  id: string;
  bpm: number;
  totalSteps: number;
  swing: number;
  schedule: (step: number, time: number, e: Engine) => void;
};

type State = { playingId: string | null; isPlaying: boolean };

export class Engine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  private master!: GainNode;
  private drums!: GainNode;
  private bassBus!: GainNode;
  private music!: GainNode;
  private reverbSend!: GainNode;
  private delaySend!: GainNode;
  private delay!: DelayNode;
  private noise!: AudioBuffer;
  private last808: { osc: OscillatorNode; gain: GainNode; note: number } | null = null;

  private seq: Sequence | null = null;
  private timer: number | null = null;
  private raf = 0;
  private nextTime = 0;
  private stepIndex = 0;
  private queue: { step: number; time: number }[] = [];
  private file: HTMLAudioElement | null = null;

  step = -1;
  state: State = { playingId: null, isPlaying: false };
  private listeners = new Set<() => void>();
  private stepListeners = new Set<(step: number) => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getState = () => this.state;
  onStep(fn: (step: number) => void) {
    this.stepListeners.add(fn);
    return () => {
      this.stepListeners.delete(fn);
    };
  }
  private setState(s: State) {
    this.state = s;
    this.listeners.forEach((l) => l());
  }

  get progress() {
    if (this.file) return this.file.duration ? this.file.currentTime / this.file.duration : 0;
    if (!this.seq || this.step < 0) return 0;
    return (this.step + 1) / this.seq.totalSteps;
  }
  get totalSteps() {
    return this.seq?.totalSteps ?? 0;
  }

  private ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC({ latencyHint: "interactive" });
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 6;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.78;
    // הקומפרסור מוסיף makeup gain, אז מורידים אחריו כדי לא לקלפ
    const post = ctx.createGain();
    post.gain.value = 0.95;
    this.master.connect(comp).connect(post).connect(this.analyser).connect(ctx.destination);

    this.drums = ctx.createGain();
    this.drums.gain.value = 0.9;
    this.drums.connect(this.master);
    this.bassBus = ctx.createGain();
    this.bassBus.gain.value = 0.75;
    this.bassBus.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.music.connect(this.master);

    // reverb: תגובת אימפולס מסונתזת
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    conv.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.32;
    const revOut = ctx.createGain();
    revOut.gain.value = 0.6;
    this.reverbSend.connect(conv).connect(revOut).connect(this.master);

    // delay עם פידבק מסונן
    this.delay = ctx.createDelay(2);
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter();
    dlp.type = "lowpass";
    dlp.frequency.value = 2600;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.22;
    this.delaySend.connect(this.delay);
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    dlp.connect(this.master);

    const nlen = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;

    return ctx;
  }

  // ───────────── transport ─────────────

  play(seq: Sequence) {
    const ctx = this.ensure();
    this.stopInternal();
    this.seq = seq;
    this.stepIndex = 0;
    this.step = -1;
    this.queue = [];
    this.nextTime = ctx.currentTime + 0.06;
    this.delay.delayTime.setValueAtTime((60 / seq.bpm) * 0.75, ctx.currentTime);
    this.timer = window.setInterval(this.tick, 25);
    this.tick();
    this.raf = requestAnimationFrame(this.frame);
    this.setState({ playingId: seq.id, isPlaying: true });
  }

  playFile(id: string, url: string) {
    const ctx = this.ensure();
    this.stopInternal();
    const el = new Audio(url);
    el.crossOrigin = "anonymous";
    el.loop = true;
    ctx.createMediaElementSource(el).connect(this.master);
    void el.play();
    this.file = el;
    this.raf = requestAnimationFrame(this.frame);
    this.setState({ playingId: id, isPlaying: true });
  }

  stop() {
    this.stopInternal();
    this.setState({ playingId: null, isPlaying: false });
  }

  private stopInternal() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    cancelAnimationFrame(this.raf);
    if (this.file) {
      this.file.pause();
      this.file = null;
    }
    if (this.last808 && this.ctx) {
      const t = this.ctx.currentTime;
      this.last808.gain.gain.cancelScheduledValues(t);
      this.last808.gain.gain.setTargetAtTime(0, t, 0.02);
      this.last808 = null;
    }
    this.seq = null;
    this.step = -1;
    this.stepListeners.forEach((l) => l(-1));
  }

  private tick = () => {
    const ctx = this.ctx;
    const seq = this.seq;
    if (!ctx || !seq) return;
    const stepDur = 60 / seq.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const s = this.stepIndex % seq.totalSteps;
      const t = this.nextTime + (s % 2 === 1 ? seq.swing * stepDur : 0);
      seq.schedule(s, t, this);
      this.queue.push({ step: s, time: t });
      this.nextTime += stepDur;
      this.stepIndex++;
    }
  };

  private frame = () => {
    const ctx = this.ctx;
    if (ctx) {
      let changed = false;
      while (this.queue.length && this.queue[0].time <= ctx.currentTime) {
        this.step = this.queue.shift()!.step;
        changed = true;
      }
      if (changed) this.stepListeners.forEach((l) => l(this.step));
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  // ───────────── instruments ─────────────

  kick(t: number, vel = 1) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.4);
    this.noiseHit(t, 0.012, "highpass", 3000, 0.25 * vel, this.drums);
  }

  clap(t: number, vel = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1500;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    [0, 0.011, 0.022].forEach((o) => {
      g.gain.setValueAtTime(0.85 * vel, t + o);
      g.gain.exponentialRampToValueAtTime(0.12 * vel, t + o + 0.009);
    });
    g.gain.setValueAtTime(0.7 * vel, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    src.connect(bp).connect(g);
    g.connect(this.drums);
    g.connect(this.reverbSend);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.26);
  }

  hat(t: number, vel = 1, open = false) {
    this.noiseHit(t, open ? 0.26 : 0.045, "highpass", 7600, (open ? 0.22 : 0.3) * vel, this.drums);
  }

  rim(t: number, vel = 1) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(1700, t);
    g.gain.setValueAtTime(0.28 * vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g).connect(this.drums);
    o.start(t);
    o.stop(t + 0.06);
  }

  private noiseHit(t: number, dur: number, type: BiquadFilterType, freq: number, amp: number, dest: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  bass808(t: number, note: number, dur: number, glide = false) {
    const ctx = this.ctx!;
    const prev = this.last808;
    if (prev) {
      prev.gain.gain.cancelScheduledValues(t);
      prev.gain.gain.setTargetAtTime(0, t, 0.012);
      prev.osc.stop(t + 0.1);
    }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      curve[i] = Math.tanh(x * 2.2);
    }
    shaper.curve = curve;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const f = mtof(note);
    if (glide && prev) {
      o.frequency.setValueAtTime(mtof(prev.note), t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.09);
    } else {
      o.frequency.setValueAtTime(f * 1.9, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85, t + 0.006);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.55, dur * 0.22);
    o.connect(shaper).connect(lp).connect(g).connect(this.bassBus);
    o.start(t);
    o.stop(t + dur * 1.6 + 0.3);
    this.last808 = { osc: o, gain: g, note };
  }

  lead(kind: Instrument, t: number, note: number, dur: number, vel = 1) {
    const ctx = this.ctx!;
    const f = mtof(note);
    const out = ctx.createGain();
    out.connect(this.music);
    out.connect(this.delaySend);
    out.connect(this.reverbSend);

    if (kind === "bell" || kind === "keys") {
      const ratio = kind === "bell" ? 3.5 : 1;
      const car = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const mg = ctx.createGain();
      car.frequency.value = f;
      mod.frequency.value = f * ratio;
      const idx = kind === "bell" ? f * 2.2 : f * 1.4;
      mg.gain.setValueAtTime(idx, t);
      mg.gain.exponentialRampToValueAtTime(idx * 0.05, t + (kind === "bell" ? 0.9 : 0.5));
      mod.connect(mg).connect(car.frequency);
      const decay = kind === "bell" ? 1.5 : Math.max(0.5, dur * 1.4);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.005);
      out.gain.exponentialRampToValueAtTime(0.0008, t + decay);
      car.connect(out);
      car.start(t);
      mod.start(t);
      car.stop(t + decay + 0.05);
      mod.stop(t + decay + 0.05);
      return;
    }

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.connect(out);
    const oscs = [-8, 8].map((cents) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      return o;
    });
    if (kind === "pluck") {
      lp.Q.value = 4;
      lp.frequency.setValueAtTime(4200, t);
      lp.frequency.exponentialRampToValueAtTime(420, t + 0.22);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.16 * vel, t + 0.004);
      out.gain.exponentialRampToValueAtTime(0.0008, t + 0.42);
      oscs.forEach((o) => (o.start(t), o.stop(t + 0.46)));
    } else {
      // pad / choir
      lp.frequency.value = 1500;
      lp.Q.value = 0.6;
      const end = t + dur;
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.08 * vel, t + 0.09);
      out.gain.setValueAtTime(0.08 * vel, end);
      out.gain.exponentialRampToValueAtTime(0.0008, end + 0.45);
      oscs.forEach((o) => (o.start(t), o.stop(end + 0.5)));
    }
  }

  pad(t: number, notes: number[], dur: number) {
    const ctx = this.ctx!;
    const out = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.connect(out);
    out.connect(this.music);
    out.connect(this.reverbSend);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.05, t + 0.5);
    out.gain.setValueAtTime(0.05, t + dur - 0.1);
    out.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.6);
    notes.forEach((n) => {
      [-10, 10].forEach((c) => {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(n);
        o.detune.value = c;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.7);
      });
    });
  }
}

export const engine = new Engine();

// ───────────── pattern → sequence ─────────────

const hit = (s: string, i: number) => s[i % s.length];

export function sequenceFromPattern(id: string, bpm: number, p: BeatPattern): Sequence {
  const bars = p.chords.length;
  const stepDur = 60 / bpm / 4;
  return {
    id,
    bpm,
    swing: p.swing ?? 0,
    totalSteps: bars * 16,
    schedule(step, t, e) {
      const bar = Math.floor(step / 16);
      const i = step % 16;
      const chord = p.chords[bar % bars];
      const lastBar = bar === bars - 1;

      if (hit(p.kick, i) === "x") e.kick(t);
      if (hit(p.clap, i) === "x") e.clap(t, 0.9);
      if (lastBar && i === 15) e.clap(t, 0.5);
      const h = hit(p.hat, i);
      if (h === "r" || (lastBar && i >= 12 && h === "x")) {
        for (let r = 0; r < 3; r++) e.hat(t + (stepDur / 3) * r, 0.55 + r * 0.12);
      } else if (h === "x") e.hat(t, i % 4 === 0 ? 1 : 0.7);
      else if (h === "o") e.hat(t, 0.8, true);

      const b = hit(p.bass, i);
      if (b !== ".") {
        let len = 1;
        while (len < 16 && hit(p.bass, i + len) === ".") len++;
        e.bass808(t, p.root + chord[0] + (b === "h" ? 12 : 0), len * stepDur, b === "g");
      }

      const a = hit(p.arp, i);
      if (a >= "0" && a <= "3") {
        let len = 1;
        while (len < 16 && hit(p.arp, i + len) === "-") len++;
        const note = p.root + 24 + chord[Number(a) % chord.length];
        e.lead(p.lead, t, note, len * stepDur, i % 4 === 0 ? 1 : 0.8);
      }

      if (p.pad && i === 0) e.pad(t, chord.slice(0, 3).map((n) => p.root + 24 + n), 16 * stepDur);
    },
  };
}
