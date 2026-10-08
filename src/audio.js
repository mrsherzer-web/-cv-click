// Fully procedural audio (Web Audio API): no sound files are needed.
// Menu theme = detuned music-box lullaby + choir pad + drones + whispers.
// In game: room tone, wind, jackals, snoring, footsteps, doors, heartbeat,
// stingers, chase music, walkie-talkie static and the jumpscare scream.
import { clamp, lerp, rand, pick } from './util.js';

const A4 = 440;
const mtof = (m) => A4 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.volume = 0.9;
    this.fear = 0;
    this._fearTarget = 0;
    this.outdoor = 0;
    this._loops = {};
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.25;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.12;
    this.master.connect(comp).connect(limiter).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(3.4, 2.6);
    this.reverbOut = ctx.createGain(); this.reverbOut.gain.value = 0.8;
    this.reverb.connect(this.reverbOut).connect(this.master);

    const bus = (g, wet) => {
      const n = ctx.createGain(); n.gain.value = g; n.connect(this.master);
      const s = ctx.createGain(); s.gain.value = wet; n.connect(s); s.connect(this.reverb);
      return n;
    };
    this.music = bus(0.8, 0.45);
    this.sfx = bus(1.0, 0.18);
    this.amb = bus(1.25, 0.1);
    this.ui = bus(0.6, 0.05);
    this.voice = bus(1.0, 0.25);

    this._noise = {
      white: this._noiseBuf('white'),
      pink: this._noiseBuf('pink'),
      brown: this._noiseBuf('brown'),
    };
    this._shaper = this._distCurve(40);
    this.ready = true;
  }

  async resume() {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state !== 'running') { try { await this.ctx.resume(); } catch (e) { /* ignore */ } }
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // ---------- building blocks ----------
  _noiseBuf(kind) {
    const ctx = this.ctx, len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    return buf;
  }

  _impulse(seconds, decay) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _distCurve(k) {
    const n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x)); }
    return curve;
  }

  noise(kind = 'white', t = this.now, dur = 1, loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this._noise[kind]; s.loop = loop;
    s.start(t, Math.random() * 3);
    if (dur != null) s.stop(t + dur);
    return s;
  }

  osc(type, freq, t = this.now, dur = 1) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    o.start(t); if (dur != null) o.stop(t + dur);
    return o;
  }

  gain(v = 0) { const g = this.ctx.createGain(); g.gain.value = v; return g; }

  filter(type, freq, Q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = Q; return f;
  }

  env(param, t, a, peak, d, end = 0.0001) {
    param.cancelScheduledValues(t);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    param.exponentialRampToValueAtTime(Math.max(end, 0.0001), t + a + d);
  }

  // Spatial emitter: input -> lowpass (occlusion) -> panner -> bus
  emitter(x = 0, y = 1, z = 0, { bus = this.sfx, ref = 1.2, max = 40, roll = 1.15 } = {}) {
    const ctx = this.ctx;
    const input = ctx.createGain();
    const lp = this.filter('lowpass', 20000, 0.5);
    const p = ctx.createPanner();
    p.panningModel = this.lowCpu ? 'equalpower' : 'HRTF';
    p.distanceModel = 'inverse'; p.refDistance = ref; p.maxDistance = max; p.rolloffFactor = roll;
    input.connect(lp).connect(p).connect(bus);
    const em = {
      input, panner: p, lp,
      setPos(nx, ny, nz) {
        if (p.positionX) { p.positionX.value = nx; p.positionY.value = ny; p.positionZ.value = nz; }
        else p.setPosition(nx, ny, nz);
      },
      setOcclusion(o) {
        lp.frequency.setTargetAtTime(lerp(20000, 650, o), ctx.currentTime, 0.08);
        input.gain.setTargetAtTime(lerp(1, 0.55, o), ctx.currentTime, 0.08);
      },
      dispose(after = 0) { setTimeout(() => { try { input.disconnect(); p.disconnect(); } catch (e) { /* */ } }, after * 1000); },
    };
    em.setPos(x, y, z);
    return em;
  }

  // one-shot spatial helper
  at(pos, fn, life = 4, opts) {
    if (!this.ready) return;
    const em = this.emitter(pos.x, pos.y ?? 1, pos.z, opts);
    fn(em.input);
    em.dispose(life);
  }

  setListener(cam) {
    if (!this.ready) return;
    const l = this.ctx.listener;
    const p = cam.position;
    const f = cam.getWorldDirection(this._tmpF || (this._tmpF = cam.position.clone()));
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setValueAtTime(p.x, t); l.positionY.setValueAtTime(p.y, t); l.positionZ.setValueAtTime(p.z, t);
      l.forwardX.setValueAtTime(f.x, t); l.forwardY.setValueAtTime(f.y, t); l.forwardZ.setValueAtTime(f.z, t);
      l.upX.setValueAtTime(0, t); l.upY.setValueAtTime(1, t); l.upZ.setValueAtTime(0, t);
    } else {
      l.setPosition(p.x, p.y, p.z); l.setOrientation(f.x, f.y, f.z, 0, 1, 0);
    }
  }

  // ---------- MENU MUSIC ----------
  startMenuMusic() {
    if (!this.ready || this._menu) return;
    const ctx = this.ctx, t0 = ctx.currentTime + 0.1;
    const out = this.gain(0); out.connect(this.music);
    out.gain.setValueAtTime(0.0001, t0); out.gain.exponentialRampToValueAtTime(0.9, t0 + 4);
    const nodes = [];
    // drone A1 + fifth + a dissonant minor second, through a breathing lowpass
    const lp = this.filter('lowpass', 260, 2); lp.connect(out);
    const lfo = this.osc('sine', 0.05, t0, null); const lfoG = this.gain(150); lfo.connect(lfoG).connect(lp.frequency);
    nodes.push(lfo);
    for (const [f, g] of [[55, 0.16], [55.4, 0.12], [82.4, 0.08], [58.3, 0.05], [27.5, 0.18]]) {
      const o = this.osc('sawtooth', f, t0, null); const og = this.gain(g); o.connect(og).connect(lp); nodes.push(o);
    }
    // high, thin "glass" tone that slowly beats against itself
    const hi = this.gain(0.012); hi.connect(out);
    for (const f of [1760, 1763.5]) { const o = this.osc('sine', f, t0, null); o.connect(hi); nodes.push(o); }
    this._menu = { out, nodes, step: 0, next: t0 + 2.5, bar: 0, timer: null, evt: t0 + 9, slow: 1 };
    this._menu.timer = setInterval(() => this._menuTick(), 60);
  }

  _menuTick() {
    const m = this._menu; if (!m) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // creepy lullaby in A minor (music box), slowing down at the end of each cycle
    const mel = [69, 72, 76, 81, 80, 76, 71, 76, 77, 76, 74, 72, 71, 68, 64, null,
      69, 72, 76, 77, 76, 74, 72, 71, 72, 71, 69, 68, 69, null, null, null];
    const chords = [[57, 60, 64], [56, 59, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]];
    while (m.next < now + 0.3) {
      const i = m.step % mel.length;
      const cycle = Math.floor(m.step / mel.length);
      const winding = i >= 24 ? 1 + (i - 23) * 0.18 : 1;
      const beat = 0.52 * winding * m.slow;
      if (i % 4 === 0) this._choir(chords[(i / 4) % chords.length], m.next, beat * 4.2, m.out);
      let note = mel[i];
      if (note != null) {
        if (cycle % 2 === 1 && (i === 6 || i === 21)) note += 6; // wrong, tritone notes on the 2nd pass
        const detune = (i >= 24 ? -(i - 23) * 14 : 0) + rand(-6, 6);
        this._musicBox(mtof(note), m.next, m.out, detune);
        if (i % 8 === 0) this._musicBox(mtof(note - 24), m.next, m.out, detune, 0.5);
      }
      m.next += beat;
      m.step++;
      if (m.step % mel.length === 0) m.next += 3.5; // silence between cycles
    }
    if (now > m.evt) {
      m.evt = now + rand(9, 17);
      const r = Math.random();
      if (r < 0.4) this._swellBoom(now + 0.1, m.out);
      else if (r < 0.75) this.whisper(now, this.music, rand(-0.9, 0.9));
      else this._screech(now, m.out);
    }
  }

  stopMenuMusic(fade = 1.5) {
    const m = this._menu; if (!m) return;
    this._menu = null;
    clearInterval(m.timer);
    const t = this.now;
    m.out.gain.cancelScheduledValues(t);
    m.out.gain.setValueAtTime(m.out.gain.value, t);
    m.out.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { m.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* */ } }); m.out.disconnect(); }, fade * 1000 + 200);
  }

  _musicBox(f, t, dest, detuneCents = 0, vol = 1) {
    const g = this.gain(0); g.connect(dest);
    const wob = this.osc('sine', 5.5, t, 2.4); const wg = this.gain(f * 0.004); wob.connect(wg);
    for (const [mul, amp, dec] of [[1, 0.16, 1.9], [2, 0.05, 0.9], [4.17, 0.025, 0.35], [6.3, 0.01, 0.2]]) {
      const o = this.osc(mul === 1 ? 'triangle' : 'sine', f * mul, t, dec + 0.1);
      o.detune.value = detuneCents; wg.connect(o.frequency);
      const og = this.gain(0); this.env(og.gain, t, 0.004, amp * vol, dec);
      o.connect(og).connect(g);
    }
    g.gain.value = 1;
  }

  _choir(notes, t, dur, dest) {
    const out = this.gain(0); out.connect(dest);
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.45);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.15);
    const formants = [[650, 6, 1], [1100, 8, 0.6], [2700, 10, 0.25]];
    const pre = this.gain(1);
    for (const [ff, q, a] of formants) { const bp = this.filter('bandpass', ff, q); const bg = this.gain(a * 3); pre.connect(bp).connect(bg).connect(out); }
    for (const n of notes) {
      for (const d of [-9, 0, 8]) {
        const o = this.osc('sawtooth', mtof(n), t, dur * 1.2); o.detune.value = d;
        const vib = this.osc('sine', 4.6 + Math.random(), t, dur * 1.2); const vg = this.gain(3); vib.connect(vg).connect(o.detune);
        o.connect(pre);
      }
    }
  }

  _swellBoom(t, dest) {
    const n = this.noise('white', t, 3.2); const hp = this.filter('highpass', 400, 0.7); const g = this.gain(0);
    hp.frequency.setValueAtTime(400, t); hp.frequency.exponentialRampToValueAtTime(6000, t + 2.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 2.8); g.gain.linearRampToValueAtTime(0, t + 2.9);
    n.connect(hp).connect(g).connect(dest);
    this.boom(t + 2.85, dest, 0.9);
  }

  _screech(t, dest) {
    const g = this.gain(0); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 1.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
    for (const f of [1318, 1396, 1480]) {
      const o = this.osc('sawtooth', f, t, 4.1);
      const v = this.osc('sine', 6 + Math.random() * 2, t, 4.1); const vg = this.gain(18); v.connect(vg).connect(o.frequency);
      const bp = this.filter('bandpass', f * 1.5, 3);
      o.connect(bp).connect(g);
    }
  }

  boom(t = this.now, dest = this.sfx, vol = 1) {
    const o = this.osc('sine', 70, t, 2.2);
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.8);
    const g = this.gain(0); this.env(g.gain, t, 0.01, 0.9 * vol, 2);
    o.connect(g).connect(dest);
    const n = this.noise('brown', t, 1.2); const ng = this.gain(0); this.env(ng.gain, t, 0.005, 0.5 * vol, 1.1);
    const lp = this.filter('lowpass', 300); n.connect(lp).connect(ng).connect(dest);
  }

  whisper(t = this.now, dest = this.sfx, pan = 0, dur = 2.6, vol = 1) {
    const n = this.noise('white', t, dur + 0.2);
    const bp = this.filter('bandpass', 2600, 1.4);
    const bp2 = this.filter('peaking', 900, 2); bp2.gain.value = 8;
    const g = this.gain(0);
    // syllable-like amplitude bursts
    let tt = t;
    g.gain.setValueAtTime(0, t);
    while (tt < t + dur) {
      const l = rand(0.08, 0.22);
      g.gain.linearRampToValueAtTime(rand(0.04, 0.12) * vol, tt + l * 0.3);
      g.gain.linearRampToValueAtTime(0.002, tt + l);
      bp.frequency.setValueAtTime(rand(1800, 4200), tt);
      tt += l + rand(0.02, 0.12);
    }
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    let chain = n.connect(bp).connect(bp2).connect(g);
    if (p) { p.pan.value = pan; chain = chain.connect(p); }
    chain.connect(dest);
  }

  // ---------- AMBIENCE ----------
  startAmbience() {
    if (!this.ready || this._amb) return;
    const t = this.now;
    const a = (this._amb = {});
    // room tone
    const rt = this.noise('brown', t, null); const rtl = this.filter('lowpass', 180); const rtg = this.gain(0.07);
    rt.connect(rtl).connect(rtg).connect(this.amb);
    // wind (louder outdoors)
    const w = this.noise('pink', t, null); const wbp = this.filter('bandpass', 500, 0.8); const wg = this.gain(0.03);
    const wl = this.osc('sine', 0.07, t, null); const wlg = this.gain(250); wl.connect(wlg).connect(wbp.frequency);
    w.connect(wbp).connect(wg).connect(this.amb);
    a.windGain = wg;
    // fear drone
    const fd = this.gain(0); const fl = this.filter('lowpass', 160, 3);
    for (const f of [41.2, 43.65, 61.7]) { const o = this.osc('sawtooth', f, t, null); o.connect(fl); a['o' + f] = o; }
    fl.connect(fd).connect(this.amb);
    a.fearGain = fd;
    const ring = this.osc('sine', 2900, t, null); const rg = this.gain(0); ring.connect(rg).connect(this.amb);
    a.ringGain = rg;
    a.nodes = [rt, w, wl, ring, ...Object.keys(a).filter((k) => k.startsWith('o')).map((k) => a[k])];
    a.nextBeat = t + 1; a.nextHowl = t + rand(20, 40); a.nextTick = t + 1;
    a.timer = setInterval(() => this._ambTick(), 50);
  }

  stopAmbience() {
    const a = this._amb; if (!a) return;
    this._amb = null; clearInterval(a.timer);
    a.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* */ } });
    try { a.fearGain.disconnect(); a.windGain.disconnect(); a.ringGain.disconnect(); } catch (e) { /* */ }
    this.stopAllLoops();
  }

  setFear(f) { this._fearTarget = clamp(f, 0, 1); }

  _ambTick() {
    const a = this._amb; if (!a) return;
    const now = this.now;
    this.fear = lerp(this.fear, this._fearTarget, 0.08);
    a.fearGain.gain.setTargetAtTime(this.fear * 0.28, now, 0.3);
    a.ringGain.gain.setTargetAtTime(this.fear > 0.8 ? (this.fear - 0.8) * 0.03 : 0, now, 0.5);
    a.windGain.gain.setTargetAtTime(0.025 + this.outdoor * 0.12, now, 0.5);
    if (this.fear > 0.3 && now > a.nextBeat) {
      const interval = lerp(1.05, 0.38, (this.fear - 0.3) / 0.7);
      this.heartbeat(now + 0.02, clamp(this.fear * 1.2, 0.3, 1));
      a.nextBeat = now + interval;
    }
    if (now > a.nextHowl) {
      a.nextHowl = now + rand(35, 80);
      if (this.onHowl) this.onHowl();
    }
  }

  heartbeat(t = this.now, vol = 1) {
    for (const [dt, f, v] of [[0, 62, 1], [0.17, 52, 0.7]]) {
      const o = this.osc('sine', f, t + dt, 0.3);
      o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dt + 0.15);
      const g = this.gain(0); this.env(g.gain, t + dt, 0.008, 0.55 * v * vol, 0.18);
      o.connect(g).connect(this.ui);
    }
  }

  // jackals howling far away in the desert night
  howl(dest) {
    const t = this.now;
    const n = Math.floor(rand(2, 5));
    for (let k = 0; k < n; k++) {
      const st = t + k * rand(0.3, 0.9), dur = rand(1.2, 2.4), base = rand(520, 760);
      const o = this.osc('sine', base, st, dur + 0.1);
      o.frequency.setValueAtTime(base * 0.8, st);
      o.frequency.exponentialRampToValueAtTime(base * 1.25, st + dur * 0.35);
      o.frequency.exponentialRampToValueAtTime(base * 0.7, st + dur);
      const v = this.osc('sine', rand(5, 8), st, dur + 0.1); const vg = this.gain(base * 0.03); v.connect(vg).connect(o.frequency);
      const h = this.osc('triangle', base * 2, st, dur + 0.1);
      h.frequency.setValueAtTime(base * 1.6, st);
      h.frequency.exponentialRampToValueAtTime(base * 2.5, st + dur * 0.35);
      h.frequency.exponentialRampToValueAtTime(base * 1.4, st + dur);
      const g = this.gain(0);
      g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.05, st + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, st + dur);
      const hg = this.gain(0.15);
      o.connect(g); h.connect(hg).connect(g); g.connect(dest);
    }
  }

  // ---------- loops (snore, tv, shower, chase) ----------
  stopLoop(name, fade = 0.4) {
    const l = this._loops[name]; if (!l) return;
    delete this._loops[name];
    if (l.timer) clearInterval(l.timer);
    const t = this.now;
    l.out.gain.cancelScheduledValues(t); l.out.gain.setValueAtTime(l.out.gain.value, t);
    l.out.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(() => { (l.nodes || []).forEach((n) => { try { n.stop(); } catch (e) { /* */ } }); try { l.out.disconnect(); } catch (e) { /* */ } }, fade * 1000 + 100);
  }
  stopAllLoops() { Object.keys(this._loops).forEach((k) => this.stopLoop(k, 0.2)); }
  hasLoop(n) { return !!this._loops[n]; }

  snoreLoop(dest) {
    if (!this.ready) return;
    this.stopLoop('snore', 0.05);
    const out = this.gain(1); out.connect(dest);
    const l = (this._loops.snore = { out, nodes: [], next: this.now + 0.3 });
    l.timer = setInterval(() => {
      const now = this.now;
      if (l.next > now + 0.5) return;
      const t = l.next;
      const inh = rand(1.1, 1.5), exh = rand(1.2, 1.6);
      // inhale: rattling soft palate
      const buzz = this.osc('sawtooth', rand(28, 36), t, inh + 0.1);
      const am = this.noise('brown', t, inh + 0.1); const amg = this.gain(0.6); am.connect(amg);
      const bg = this.gain(0.5); amg.connect(bg.gain);
      const bp = this.filter('bandpass', 300, 1.6); const lp = this.filter('lowpass', 900);
      const g = this.gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + inh * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + inh);
      buzz.connect(bg).connect(bp).connect(lp).connect(g).connect(out);
      const n = this.noise('pink', t, inh); const nb = this.filter('bandpass', 700, 1); const ng = this.gain(0);
      ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.18, t + inh * 0.8); ng.gain.exponentialRampToValueAtTime(0.0001, t + inh);
      n.connect(nb).connect(ng).connect(out);
      // exhale: breathy whistle
      const e = this.noise('pink', t + inh + 0.15, exh); const eb = this.filter('bandpass', 480, 1.2); const eg = this.gain(0);
      eg.gain.setValueAtTime(0.0001, t + inh + 0.15); eg.gain.exponentialRampToValueAtTime(0.22, t + inh + 0.4); eg.gain.exponentialRampToValueAtTime(0.0001, t + inh + exh);
      e.connect(eb).connect(eg).connect(out);
      l.next = t + inh + exh + rand(0.6, 1.2);
    }, 100);
  }

  tvLoop(dest, loud = false) {
    if (!this.ready) return;
    this.stopLoop('tv', 0.05);
    const t = this.now;
    const out = this.gain(loud ? 1.6 : 0.25); out.connect(dest);
    const crowd = this.noise('pink', t, null); const bp = this.filter('bandpass', 900, 0.6); const cg = this.gain(0.6);
    const lfo = this.osc('sine', 0.13, t, null); const lg = this.gain(0.25); lfo.connect(lg).connect(cg.gain);
    crowd.connect(bp).connect(cg).connect(out);
    const hum = this.osc('sawtooth', 50, t, null); const hl = this.filter('lowpass', 200); const hg = this.gain(0.04);
    hum.connect(hl).connect(hg).connect(out);
    this._loops.tv = { out, nodes: [crowd, lfo, hum] };
  }

  goalRoar(dest) {
    const t = this.now;
    const n = this.noise('pink', t, 5); const bp = this.filter('bandpass', 1100, 0.5); const g = this.gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(2.2, t + 0.6); g.gain.exponentialRampToValueAtTime(0.3, t + 5);
    n.connect(bp).connect(g).connect(dest);
    for (const f of [233, 293, 349]) {
      const o = this.osc('sawtooth', f, t + 0.3, 1.8); const og = this.gain(0); this.env(og.gain, t + 0.3, 0.05, 0.12, 1.6);
      o.connect(og).connect(dest);
    }
    for (let k = 0; k < 3; k++) {
      const o = this.osc('sine', 3100, t + 1.2 + k * 0.35, 0.3); const v = this.osc('sine', 28, t + 1.2 + k * 0.35, 0.3); const vg = this.gain(250); v.connect(vg).connect(o.frequency);
      const og = this.gain(0); this.env(og.gain, t + 1.2 + k * 0.35, 0.01, 0.25, 0.25); o.connect(og).connect(dest);
    }
  }

  showerLoop(dest) {
    if (!this.ready) return;
    this.stopLoop('shower', 0.05);
    const t = this.now; const out = this.gain(0.5); out.connect(dest);
    const n = this.noise('white', t, null); const hp = this.filter('highpass', 1200); const lp = this.filter('lowpass', 7000);
    n.connect(hp).connect(lp).connect(out);
    this._loops.shower = { out, nodes: [n] };
  }

  fireLoop(dest) {
    this.stopLoop('fire', 0.05);
    const t = this.now; const out = this.gain(0.6); out.connect(dest);
    const n = this.noise('brown', t, null); const lp = this.filter('lowpass', 500); n.connect(lp).connect(out);
    const l = (this._loops.fire = { out, nodes: [n] });
    l.timer = setInterval(() => { for (let i = 0; i < 3; i++) if (Math.random() < 0.5) this.click(this.now + Math.random() * 0.1, out, rand(0.1, 0.4), rand(2000, 5000)); }, 90);
  }

  chaseMusic(on) {
    if (!this.ready) return;
    if (!on) { this.stopLoop('chase', 2.5); return; }
    if (this._loops.chase) return;
    const out = this.gain(0); out.connect(this.music);
    out.gain.setValueAtTime(0, this.now); out.gain.linearRampToValueAtTime(0.85, this.now + 0.6);
    const l = (this._loops.chase = { out, nodes: [], next: this.now + 0.05, step: 0 });
    const tempo = 0.1; // 16ths at 150bpm
    l.timer = setInterval(() => {
      while (l.next < this.now + 0.25) {
        const t = l.next, s = l.step;
        const bar = Math.floor(s / 16) % 4;
        const root = [38, 39, 38, 37][bar];
        if (s % 16 !== 3 && s % 16 !== 11) {
          const f = mtof(root - 12 + (s % 4 === 0 ? 0 : 12));
          const o = this.osc('sawtooth', f, t, 0.13); const lp = this.filter('lowpass', s % 4 === 0 ? 900 : 500, 4);
          const g = this.gain(0); this.env(g.gain, t, 0.004, s % 4 === 0 ? 0.24 : 0.12, 0.11);
          o.connect(lp).connect(g).connect(out);
        }
        if (s % 8 === 0) { // timpani
          const o = this.osc('sine', 80, t, 0.6); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
          const g = this.gain(0); this.env(g.gain, t, 0.005, 0.7, 0.5); o.connect(g).connect(out);
          const n = this.noise('brown', t, 0.2); const ng = this.gain(0); this.env(ng.gain, t, 0.003, 0.4, 0.15); n.connect(ng).connect(out);
        }
        if (s % 32 === 0) { // tremolo strings swell
          for (const m of [root + 24, root + 25, root + 31]) {
            const o = this.osc('sawtooth', mtof(m), t, 3.3); const trem = this.osc('square', 13, t, 3.3); const tg = this.gain(0.5);
            const g = this.gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 2.8); g.gain.linearRampToValueAtTime(0, t + 3.2);
            trem.connect(tg).connect(g.gain);
            const bp = this.filter('bandpass', mtof(m) * 2, 1.5); o.connect(bp).connect(g).connect(out);
          }
        }
        l.next += tempo; l.step++;
      }
    }, 40);
  }

  // ---------- one-shots ----------
  click(t = this.now, dest = this.sfx, vol = 0.3, f = 3000) {
    const n = this.noise('white', t, 0.03, false); const hp = this.filter('bandpass', f, 2); const g = this.gain(0);
    this.env(g.gain, t, 0.001, vol, 0.025); n.connect(hp).connect(g).connect(dest);
  }

  footstep(dest = this.sfx, { heavy = false, vol = 1, surface = 'tile' } = {}) {
    if (!this.ready) return;
    const t = this.now;
    const n = this.noise('white', t, 0.12, false);
    const bp = this.filter('bandpass', heavy ? rand(500, 700) : rand(1400, 2400), heavy ? 1.2 : 1.6);
    const g = this.gain(0); this.env(g.gain, t, 0.003, (heavy ? 0.5 : 0.16) * vol, heavy ? 0.12 : 0.07);
    n.connect(bp).connect(g).connect(dest);
    const o = this.osc('sine', heavy ? 70 : 110, t, 0.12); o.frequency.exponentialRampToValueAtTime(heavy ? 40 : 70, t + 0.08);
    const og = this.gain(0); this.env(og.gain, t, 0.002, (heavy ? 0.7 : 0.18) * vol, 0.09);
    o.connect(og).connect(dest);
    if (surface === 'outdoor') { const s = this.noise('pink', t, 0.15, false); const sb = this.filter('highpass', 2500); const sg = this.gain(0); this.env(sg.gain, t, 0.01, 0.06 * vol, 0.12); s.connect(sb).connect(sg).connect(dest); }
  }

  doorCreak(dest, dur = 1.1, vol = 1) {
    const t = this.now;
    const o = this.osc('sawtooth', 110, t, dur + 0.1);
    let tt = t;
    while (tt < t + dur) { o.frequency.setValueAtTime(rand(70, 190), tt); tt += rand(0.03, 0.09); }
    const am = this.gain(0);
    tt = t;
    am.gain.setValueAtTime(0, t);
    while (tt < t + dur) { am.gain.setValueAtTime(Math.random() < 0.7 ? rand(0.3, 1) : 0, tt); tt += rand(0.01, 0.04); }
    am.gain.setValueAtTime(0, t + dur);
    const bp = this.filter('bandpass', 900, 3); const pk = this.filter('peaking', 1800, 4); pk.gain.value = 10;
    const g = this.gain(0.09 * vol);
    o.connect(am).connect(bp).connect(pk).connect(g).connect(dest);
  }

  doorThud(dest, vol = 1) {
    const t = this.now;
    const o = this.osc('sine', 90, t, 0.4); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = this.gain(0); this.env(g.gain, t, 0.003, 0.7 * vol, 0.3); o.connect(g).connect(dest);
    this.click(t, dest, 0.35 * vol, 1800);
    this.click(t + 0.05, dest, 0.15 * vol, 4200);
  }

  doorSlam(dest) {
    this.doorThud(dest, 1.8);
    const t = this.now;
    const n = this.noise('brown', t, 0.6); const lp = this.filter('lowpass', 700); const g = this.gain(0); this.env(g.gain, t, 0.002, 0.9, 0.5);
    n.connect(lp).connect(g).connect(dest);
    for (let i = 0; i < 4; i++) this.click(t + 0.08 + i * 0.045, dest, 0.2, 2500 + i * 300);
  }

  lockedRattle(dest) {
    const t = this.now;
    for (let i = 0; i < 5; i++) {
      const st = t + i * rand(0.06, 0.1);
      this.click(st, dest, 0.35, rand(1500, 3200));
      const o = this.osc('sine', rand(1800, 2600), st, 0.08); const g = this.gain(0); this.env(g.gain, st, 0.001, 0.06, 0.07); o.connect(g).connect(dest);
    }
    const o = this.osc('sine', 90, t, 0.2); const g = this.gain(0); this.env(g.gain, t, 0.002, 0.25, 0.15); o.connect(g).connect(dest);
  }

  knock(dest, count = 3, vol = 1) {
    const t = this.now;
    for (let i = 0; i < count; i++) {
      const st = t + i * 0.42;
      const o = this.osc('sine', 160, st, 0.2); o.frequency.exponentialRampToValueAtTime(90, st + 0.1);
      const g = this.gain(0); this.env(g.gain, st, 0.002, 0.8 * vol, 0.14); o.connect(g).connect(dest);
      const n = this.noise('pink', st, 0.08, false); const lp = this.filter('lowpass', 1200); const ng = this.gain(0); this.env(ng.gain, st, 0.001, 0.5 * vol, 0.06);
      n.connect(lp).connect(ng).connect(dest);
    }
  }

  pickup(dest = this.ui) {
    const t = this.now;
    this.click(t, dest, 0.25, 2600);
    const o = this.osc('sine', 520, t, 0.25); o.frequency.exponentialRampToValueAtTime(780, t + 0.1);
    const g = this.gain(0); this.env(g.gain, t, 0.005, 0.09, 0.2); o.connect(g).connect(dest);
  }

  paper(dest = this.ui) {
    const t = this.now;
    const n = this.noise('white', t, 0.5, false); const hp = this.filter('highpass', 2500); const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 10; k++) g.gain.setValueAtTime(rand(0, 0.12), t + k * 0.04);
    g.gain.linearRampToValueAtTime(0, t + 0.45);
    n.connect(hp).connect(g).connect(dest);
  }

  uiHover() { if (!this.ready) return; const t = this.now; const o = this.osc('sine', 220, t, 0.08); const g = this.gain(0); this.env(g.gain, t, 0.003, 0.05, 0.06); o.connect(g).connect(this.ui); }
  uiSelect() { if (!this.ready) return; const t = this.now; this.boom(t, this.ui, 0.3); const o = this.osc('triangle', 110, t, 0.4); const g = this.gain(0); this.env(g.gain, t, 0.005, 0.2, 0.35); o.connect(g).connect(this.ui); }

  beep(ok = true) {
    const t = this.now;
    const o = this.osc('square', ok ? 1250 : 260, t, ok ? 0.08 : 0.3);
    const g = this.gain(0); this.env(g.gain, t, 0.002, 0.06, ok ? 0.07 : 0.28); o.connect(g).connect(this.ui);
  }

  unlock(dest = this.sfx) {
    const t = this.now;
    this.click(t, dest, 0.5, 1500); this.click(t + 0.12, dest, 0.4, 2200);
    const o = this.osc('sine', 140, t + 0.12, 0.3); o.frequency.exponentialRampToValueAtTime(70, t + 0.3);
    const g = this.gain(0); this.env(g.gain, t + 0.12, 0.003, 0.4, 0.2); o.connect(g).connect(dest);
  }

  potsCrash(dest) {
    const t = this.now;
    for (let i = 0; i < 6; i++) {
      const st = t + rand(0, 0.7), base = rand(260, 620);
      for (const [r, a] of [[1, 0.3], [2.76, 0.2], [5.4, 0.12], [8.93, 0.06]]) {
        const o = this.osc('sine', base * r, st, 1.3); const g = this.gain(0); this.env(g.gain, st, 0.002, a, rand(0.4, 1.2)); o.connect(g).connect(dest);
      }
      this.click(st, dest, 0.6, rand(2000, 5000));
    }
  }

  zap(dest) {
    const t = this.now;
    const n = this.noise('white', t, 0.6); const bp = this.filter('bandpass', 3000, 0.8); const g = this.gain(0);
    g.gain.setValueAtTime(0, t);
    for (let k = 0; k < 14; k++) g.gain.setValueAtTime(Math.random() < 0.6 ? rand(0.1, 0.5) : 0, t + k * 0.035);
    g.gain.setValueAtTime(0, t + 0.55);
    n.connect(bp).connect(g).connect(dest);
    const o = this.osc('sawtooth', 100, t, 0.8); const lp = this.filter('lowpass', 800); const og = this.gain(0); this.env(og.gain, t, 0.02, 0.15, 0.7); o.connect(lp).connect(og).connect(dest);
  }

  powerUp() {
    const t = this.now;
    this.boom(t, this.sfx, 0.8);
    const o = this.osc('sawtooth', 60, t, 2); o.frequency.exponentialRampToValueAtTime(120, t + 1.2);
    const lp = this.filter('lowpass', 400); const g = this.gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    o.connect(lp).connect(g).connect(this.sfx);
  }

  powerDown() {
    const t = this.now;
    const o = this.osc('sawtooth', 120, t, 1.6); o.frequency.exponentialRampToValueAtTime(30, t + 1.4);
    const lp = this.filter('lowpass', 500); const g = this.gain(0); this.env(g.gain, t, 0.01, 0.2, 1.5);
    o.connect(lp).connect(g).connect(this.sfx);
    this.click(t, this.sfx, 0.5, 1200);
  }

  stinger(vol = 1) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.gain(vol); out.connect(this.music);
    const lp = this.filter('lowpass', 6000, 1); lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(700, t + 1.6);
    lp.connect(out);
    for (const m of [50, 51, 57, 62, 63]) {
      for (const d of [-12, 12]) { const o = this.osc('sawtooth', mtof(m), t, 2.2); o.detune.value = d; const g = this.gain(0); this.env(g.gain, t, 0.01, 0.06, 2); o.connect(g).connect(lp); }
    }
    const n = this.noise('white', t, 0.6); const ng = this.gain(0); this.env(ng.gain, t, 0.002, 0.35, 0.5); n.connect(ng).connect(lp);
    for (const f of [1760, 1865]) {
      const o = this.osc('sawtooth', f, t, 1.4); const v = this.osc('sine', 7, t, 1.4); const vg = this.gain(30); v.connect(vg).connect(o.frequency);
      const bp = this.filter('bandpass', f * 1.3, 2); const g = this.gain(0); this.env(g.gain, t, 0.02, 0.05, 1.3);
      o.connect(bp).connect(g).connect(out);
    }
    this.boom(t, out, 0.8);
  }

  scream(vol = 1) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.gain(vol * 0.5); out.connect(this.master);
    const ws = this.ctx.createWaveShaper(); ws.curve = this._shaper; ws.oversample = '2x';
    const pre = this.gain(0.9); pre.connect(ws);
    const formant = this.filter('bandpass', 1300, 1.5); ws.connect(formant).connect(out);
    const lpass = this.filter('lowpass', 5000); ws.connect(lpass).connect(out);
    for (const [f, d] of [[420, 0], [445, 15], [610, -20], [880, 9]]) {
      const o = this.osc('sawtooth', f, t, 1.8); o.detune.value = d;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.25); o.frequency.exponentialRampToValueAtTime(f * 1.4, t + 1.7);
      const v = this.osc('sine', rand(24, 34), t, 1.8); const vg = this.gain(f * 0.08); v.connect(vg).connect(o.frequency);
      const g = this.gain(0); this.env(g.gain, t, 0.01, 0.3, 1.7);
      o.connect(g).connect(pre);
    }
    const n = this.noise('white', t, 1.6); const hp = this.filter('highpass', 900); const ng = this.gain(0); this.env(ng.gain, t, 0.005, 0.8, 1.5);
    n.connect(hp).connect(ng).connect(out);
    this.boom(t, out, 0.9);
  }

  growl(dest, dur = 1.4, vol = 1) {
    if (!this.ready) return;
    const t = this.now;
    const ws = this.ctx.createWaveShaper(); ws.curve = this._shaper;
    const lp = this.filter('lowpass', 700, 1); const f1 = this.filter('peaking', 380, 3); f1.gain.value = 12;
    const g = this.gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6 * vol, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    ws.connect(lp).connect(f1).connect(g).connect(dest);
    for (const f of [62, 66.5, 93]) {
      const o = this.osc('sawtooth', f, t, dur + 0.1); o.frequency.setValueAtTime(f * 1.15, t); o.frequency.exponentialRampToValueAtTime(f * 0.85, t + dur);
      const am = this.noise('brown', t, dur + 0.1); const ag = this.gain(0.8); const og = this.gain(0.4); am.connect(ag).connect(og.gain);
      o.connect(og).connect(ws);
    }
  }

  // Distorted demonic murmur that plays under Noam's possessed lines
  demonVoice(dest, dur = 2) {
    if (!this.ready) return;
    const t = this.now;
    let tt = t;
    while (tt < t + dur) {
      const l = rand(0.12, 0.28);
      const f = rand(70, 105);
      const o = this.osc('sawtooth', f, tt, l + 0.05); o.frequency.exponentialRampToValueAtTime(f * 0.8, tt + l);
      const bp = this.filter('bandpass', rand(350, 800), 4); const g = this.gain(0); this.env(g.gain, tt, 0.02, 0.5, l);
      const ws = this.ctx.createWaveShaper(); ws.curve = this._shaper;
      o.connect(ws).connect(bp).connect(g).connect(dest);
      tt += l + rand(0.02, 0.1);
    }
    this.growl(dest, dur, 0.3);
  }

  laugh(dest) {
    if (!this.ready) return;
    const t = this.now;
    for (let i = 0; i < 6; i++) {
      const st = t + i * 0.24, f = 120 - i * 7;
      const o = this.osc('sawtooth', f, st, 0.2); o.frequency.exponentialRampToValueAtTime(f * 0.75, st + 0.18);
      const ws = this.ctx.createWaveShaper(); ws.curve = this._shaper;
      const bp = this.filter('bandpass', 700, 2.5); const g = this.gain(0); this.env(g.gain, st, 0.015, 0.45, 0.17);
      const n = this.noise('white', st, 0.18, false); const nb = this.filter('bandpass', 1600, 1); const ng = this.gain(0); this.env(ng.gain, st, 0.01, 0.12, 0.15);
      o.connect(ws).connect(bp).connect(g).connect(dest); n.connect(nb).connect(ng).connect(dest);
    }
  }

  mumble(dest) {
    const t = this.now;
    for (const [dt, f, l] of [[0, 110, 0.5], [0.6, 95, 0.7]]) {
      const o = this.osc('sawtooth', f, t + dt, l + 0.1); o.frequency.linearRampToValueAtTime(f * 0.85, t + dt + l);
      const lp = this.filter('lowpass', 420, 2); const g = this.gain(0); this.env(g.gain, t + dt, 0.08, 0.3, l);
      o.connect(lp).connect(g).connect(dest);
    }
  }

  bedCreak(dest) {
    const t = this.now;
    const o = this.osc('sawtooth', 70, t, 1.0);
    let tt = t; while (tt < t + 0.9) { o.frequency.setValueAtTime(rand(50, 140), tt); tt += rand(0.02, 0.06); }
    const bp = this.filter('bandpass', 420, 4); const g = this.gain(0); this.env(g.gain, t, 0.05, 0.25, 0.85);
    o.connect(bp).connect(g).connect(dest);
    this.doorThud(dest, 0.4);
  }

  squelch(dest = this.voice) {
    if (!this.ready) return;
    const t = this.now;
    const n = this.noise('white', t, 0.22, false); const bp = this.filter('bandpass', 1900, 0.9); const g = this.gain(0);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.01); g.gain.setValueAtTime(0.22, t + 0.16); g.gain.linearRampToValueAtTime(0, t + 0.2);
    n.connect(bp).connect(g).connect(dest);
    this.click(t + 0.2, dest, 0.2, 2500);
  }

  staticBed(dur, dest = this.voice) {
    if (!this.ready) return;
    const t = this.now;
    const n = this.noise('white', t, dur); const bp = this.filter('bandpass', 2400, 0.7); const g = this.gain(0);
    g.gain.setValueAtTime(0.03, t);
    for (let k = 0; k < dur * 12; k++) g.gain.setValueAtTime(Math.random() < 0.15 ? rand(0.06, 0.12) : rand(0.015, 0.035), t + k / 12);
    g.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp).connect(g).connect(dest);
  }

  // short murmur under spoken (non-walkie) dialogue lines
  murmur(dest, dur, pitch = 1) {
    if (!this.ready) return;
    const t = this.now;
    let tt = t;
    while (tt < t + dur) {
      const l = rand(0.07, 0.16);
      const o = this.osc('triangle', rand(130, 190) * pitch, tt, l + 0.05);
      const bp = this.filter('bandpass', rand(500, 1400), 3);
      const g = this.gain(0); this.env(g.gain, tt, 0.015, 0.05, l);
      o.connect(bp).connect(g).connect(dest);
      tt += l + rand(0.01, 0.07);
      if (Math.random() < 0.12) tt += 0.2;
    }
  }

  breath(dest = this.ui, vol = 1) {
    const t = this.now;
    for (const [dt, l, f, a] of [[0, 1.0, 900, 0.07], [1.15, 1.3, 600, 0.05]]) {
      const n = this.noise('pink', t + dt, l); const bp = this.filter('bandpass', f, 0.9); const g = this.gain(0);
      g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(a * vol, t + dt + l * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + l);
      n.connect(bp).connect(g).connect(dest);
    }
  }

  gasp(dest = this.ui) {
    const t = this.now;
    const n = this.noise('pink', t, 0.5); const bp = this.filter('bandpass', 1300, 1.2); const g = this.gain(0); this.env(g.gain, t, 0.03, 0.35, 0.45);
    n.connect(bp).connect(g).connect(dest);
  }

  drip(dest) {
    const t = this.now;
    const f = rand(1200, 2200);
    const o = this.osc('sine', f, t, 0.15); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.05);
    const g = this.gain(0); this.env(g.gain, t, 0.002, 0.12, 0.1); o.connect(g).connect(dest);
  }

  whoosh(dest = this.sfx) {
    const t = this.now;
    const n = this.noise('pink', t, 1.5); const lp = this.filter('lowpass', 200); lp.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
    const g = this.gain(0); this.env(g.gain, t, 0.3, 0.6, 1.1);
    n.connect(lp).connect(g).connect(dest);
  }

  birds(dest = this.amb) {
    const t = this.now;
    for (let i = 0; i < 7; i++) {
      const st = t + i * rand(0.12, 0.5);
      const o = this.osc('sine', 3000, st, 0.15); o.frequency.setValueAtTime(rand(2600, 3400), st); o.frequency.exponentialRampToValueAtTime(rand(4000, 5200), st + 0.08);
      const g = this.gain(0); this.env(g.gain, st, 0.005, 0.04, 0.1); o.connect(g).connect(dest);
    }
  }

  // warm major-key version of the lullaby for the ending
  endingMusic() {
    if (!this.ready) return;
    this.stopLoop('ending', 0.05);
    const out = this.gain(0.7); out.connect(this.music);
    const mel = [72, 76, 79, 84, 83, 79, 74, 79, 77, 76, 74, 72, 71, 74, 79, null, 72, 76, 79, 81, 79, 77, 76, 74, 76, 74, 72, 71, 72, null, null, null];
    const chords = [[60, 64, 67], [55, 59, 62], [53, 57, 60], [55, 59, 62], [60, 64, 67], [53, 57, 60], [55, 59, 62], [60, 64, 67]];
    const l = (this._loops.ending = { out, nodes: [], next: this.now + 0.5, step: 0 });
    l.timer = setInterval(() => {
      while (l.next < this.now + 0.3) {
        const i = l.step % mel.length;
        if (i % 4 === 0) this._choir(chords[(i / 4) % chords.length], l.next, 0.6 * 4.2, out);
        if (mel[i] != null) this._musicBox(mtof(mel[i]), l.next, out, 0);
        l.next += 0.6; l.step++;
      }
    }, 60);
  }
}

export const audio = new AudioEngine();
