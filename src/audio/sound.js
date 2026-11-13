// All the game's sound, made on the spot with the Web Audio API: no recordings, nothing borrowed. The
// Renault's engine follows speed and gas, tires squeal in a slide, punches thump, crashes crunch, the
// phone rings, a short chime closes a mission, and a soft wind (or the hum of the city) sits underneath.
// Starts on the first tap (browsers require a gesture) and can be muted from the screen.
// Chapter nine adds the atmosphere: rain (`rain(k)`), the mission's own music (`music('action' | 'calm' |
// null)`: an original loop written here, its notes scheduled a moment ahead by a lookahead timer), the
// hiss of sleeping gas (`gas(seconds)`) and a muffled heartbeat (`heartbeat(on)`). Each has its own gain
// under the master, so the mute button silences them all; each is let go when it ends (sources stopped,
// nodes disconnected), and `voices` counts the sources they still hold.
// Chapter ten adds the portal's sounds (`portalHum()`: a handle to set and stop; `thunder()`: the crack of
// one opening; `zap()`: an energy bolt), the static of a radio with nobody on it (`radioStatic(on)`), a
// crowd cheering and clapping (`crowd(on, { intensity })`) and two more loops for `music()`, written here
// like the first two: 'epic' (the return and the last stand) and 'home' (the walk back and the ending).
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// 'action': 126 beats a minute in D minor, four bars round: Dm, B♭, Gm, A (the A pulls back to Dm)
const ACTION = {
  bpm: 126,
  chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], // the pad, below middle C
  roots: [38, 34, 31, 33],                                          // the bass, low
  // [sixteenth, semitones over the root, length in sixteenths]
  bass: [[0, 0, 2], [2, 0, 1], [3, 12, 1], [4, 0, 2], [6, 0, 1], [7, 7, 1], [8, 0, 2], [10, 0, 1], [11, 12, 1], [12, 0, 1], [13, 3, 1], [14, 7, 1], [15, 12, 1]],
  kick: [0, 4, 8, 10, 12],
  snare: [4, 12],
  // a figure up high on the off-beats: [sixteenth, which chord tone], an octave up
  lead: [[2, 2], [6, 1], [10, 2], [14, 0]],
};
// 'calm': slow chords that breathe, a soft low note under each, a bell now and then
const CALM = {
  bpm: 66,
  chords: [[50, 53, 57, 64], [46, 50, 53, 57], [43, 46, 50, 57], [45, 50, 52, 55]], // Dm9, B♭maj7, Gm9, A7sus4
  roots: [38, 34, 31, 33],
};
// 'epic': 132 beats a minute in E minor, eight bars round: Em, C, G, D, Em, C, Am, B (the B pulls back to
// Em). A galloping bass, a string figure in sixteenths and a brass theme that climbs bar by bar to its top
// in the fifth
const EPIC = {
  bpm: 132,
  chords: [[52, 55, 59], [48, 52, 55], [50, 55, 59], [50, 54, 57], [52, 55, 59], [48, 52, 55], [48, 52, 57], [47, 51, 54]],
  roots: [40, 36, 43, 38, 40, 36, 33, 35],
  // [sixteenth, semitones over the root, length in sixteenths]: the gallop, a leap at the bar's end
  bass: [[0, 0, 2], [2, 0, 1], [3, 0, 1], [4, 0, 2], [6, 0, 1], [7, 0, 1], [8, 0, 2], [10, 0, 1], [11, 0, 1], [12, 0, 2], [14, 7, 1], [15, 12, 1]],
  // the theme, bar by bar: [sixteenth, note, length in sixteenths]
  lead: [
    [[0, 64, 6], [6, 67, 2], [8, 71, 8]],
    [[0, 72, 6], [6, 71, 2], [8, 67, 8]],
    [[0, 67, 4], [4, 71, 4], [8, 74, 8]],
    [[0, 74, 6], [6, 76, 2], [8, 78, 8]],
    [[0, 79, 8], [8, 76, 4], [12, 71, 4]],
    [[0, 72, 4], [4, 76, 4], [8, 79, 8]],
    [[0, 81, 6], [6, 79, 2], [8, 76, 8]],
    [[0, 78, 4], [4, 75, 4], [8, 71, 4], [12, 75, 2], [14, 78, 2]],
  ],
  figure: [0, 1, 2, 1], // the strings: which chord tone on each sixteenth of a beat, an octave up
};
// 'home': 72 beats a minute in G major, eight bars round: G, D/F♯, Em, C, G/B, C, Am7, D. A warm pad, a low
// note under it and a plucked tune in eighths that keeps reaching up and settles on the way back to G
const HOME = {
  bpm: 72,
  chords: [[55, 59, 62], [54, 57, 62], [52, 55, 59], [52, 55, 60], [50, 55, 59], [52, 55, 60], [52, 55, 57, 60], [50, 54, 57]],
  roots: [43, 42, 40, 36, 47, 36, 45, 38],
  // the tune, bar by bar: [eighth, note]
  tune: [
    [[0, 74], [2, 71], [3, 74], [4, 79]],
    [[0, 78], [2, 74], [4, 69], [7, 71]],
    [[0, 76], [2, 71], [3, 76], [4, 79]],
    [[0, 76], [2, 72], [4, 67], [7, 69]],
    [[0, 71], [2, 74], [3, 79], [4, 83]],
    [[0, 81], [2, 79], [4, 76], [7, 74]],
    [[0, 72], [2, 76], [4, 81], [6, 79]],
    [[0, 78], [4, 74], [6, 69]],
  ],
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engine = null;
    this.voices = 0;          // sources the atmosphere has started and not yet heard end
    this.musicVolume = 0.32;
    this.musicMode = null;    // 'action' | 'calm' | null: what music() last asked for
    this.song = null;         // the music playing: { mode, bus, live, play(step, at), ... }
    this.fading = [];         // songs on their way out
    this.rainLevel = 0;       // what rain() last asked for
    this.rainMuffled = false;
    this.rainNode = null;     // the rain's graph while it plays
    this.beat = null;         // the heartbeat while it beats
    this.beatWanted = null;
    this.loose = new Set();   // rain, gas and heartbeat sources still running
    this.timer = null;        // the lookahead timer (only while music, a heartbeat or the crowd runs)
    this.staticNode = null;   // the radio's static while it hisses
    this.staticWanted = null;
    this.crowdNode = null;    // the crowd while it cheers
    this.crowdWanted = null;
    this.applause = null;     // two seconds of clapping hands, made once
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
    // asked for before there was sound: they start now
    if (this.rainLevel > 0) this.rain(this.rainLevel, { muffled: this.rainMuffled });
    if (this.musicMode) { const m = this.musicMode; this.musicMode = null; this.music(m); }
    if (this.beatWanted) this.heartbeat(true, this.beatWanted);
    if (this.staticWanted) this.radioStatic(true, this.staticWanted);
    if (this.crowdWanted) this.crowd(true, this.crowdWanted);
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

  // a blast: a low thump and a rolling rumble (chapter eight's explosions)
  boom(strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, k = Math.max(0.05, Math.min(1.5, strength));
    const n = this.noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(70, t + 1.1);
    g.gain.setValueAtTime(0.8 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t, Math.random() * 0.3, 1.4);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(74, t); o.frequency.exponentialRampToValueAtTime(26, t + 0.8);
    og.gain.setValueAtTime(0.7 * k, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(og); og.connect(this.master); o.start(t); o.stop(t + 1.0);
  }
  // an engine somewhere outside, once: it comes up, revs and dies away. Its own oscillators, not the
  // Renault's engine graph, whose gain update() holds at zero while nobody drives
  rev(seconds = 2.6, level = 0.12) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, peak = t + seconds * 0.55, end = t + seconds;
    const a = ctx.createOscillator(), b = ctx.createOscillator(), bg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    a.type = 'sawtooth'; b.type = 'square';
    a.frequency.setValueAtTime(30, t); a.frequency.linearRampToValueAtTime(90, peak); a.frequency.linearRampToValueAtTime(40, end);
    b.frequency.setValueAtTime(15, t); b.frequency.linearRampToValueAtTime(45, peak); b.frequency.linearRampToValueAtTime(20, end);
    f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(260, t); f.frequency.linearRampToValueAtTime(720, peak); f.frequency.linearRampToValueAtTime(300, end);
    bg.gain.value = 0.45;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + seconds * 0.3); g.gain.setValueAtTime(level, peak); g.gain.linearRampToValueAtTime(0, end);
    a.connect(f); b.connect(bg); bg.connect(f); f.connect(g); g.connect(this.master);
    a.start(t); b.start(t); a.stop(end + 0.05); b.stop(end + 0.05);
  }
  // an alarm: two tones, back and forth, for a while; returns a function that stops it
  siren(seconds = 6, level = 0.09) {
    if (!this.ctx) return () => {};
    const ctx = this.ctx, t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    for (let k = 0; k * 0.42 < seconds; k++) o.frequency.setValueAtTime(k % 2 ? 470 : 640, t + k * 0.42);
    g.gain.setValueAtTime(level, t); g.gain.setValueAtTime(level, t + seconds - 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + seconds + 0.05);
    return () => { try { g.gain.cancelScheduledValues(ctx.currentTime); g.gain.setValueAtTime(0.0001, ctx.currentTime); o.stop(ctx.currentTime + 0.02); } catch (e) { /* already stopped */ } };
  }
  // short blips: a countdown, a warning before a blast
  beep(times = 1, pitch = 880, gap = 0.2) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let k = 0; k < times; k++) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = pitch; g.gain.setValueAtTime(0.12, t + k * gap); g.gain.exponentialRampToValueAtTime(0.001, t + k * gap + 0.09); o.connect(g); g.connect(this.master); o.start(t + k * gap); o.stop(t + k * gap + 0.1); }
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

  // a paintball marker: a short puff of air with a soft knock
  shot() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, n = this.noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t, Math.random() * 0.5, 0.12);
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.07);
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.1);
  }

  // paint landing: a wet slap
  splat() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, n = this.noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(2200, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    g.gain.setValueAtTime(0.34, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t, Math.random() * 0.5, 0.2);
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

  // ---------- chapter nine: the atmosphere ----------

  // a source that counts in `voices` (and in `set`) until it ends; then it and `after` are let go
  // (`after`: nodes to disconnect, or functions to call)
  voice(src, set, ...after) {
    this.voices++;
    set.add(src);
    src.onended = () => {
      this.voices--; set.delete(src); src.disconnect();
      for (const n of after) typeof n === 'function' ? n() : n.disconnect();
    };
    return src;
  }
  // a node several voices share: disconnected when the last of them ends
  shared(node, count) { return () => { if (--count === 0) node.disconnect(); }; }

  // the lookahead timer: every 50 ms, whatever falls in the next quarter second is scheduled
  wake() {
    if (this.timer || !this.ctx) return;
    this.timer = setInterval(() => this.schedule(), 50);
    this.schedule();
  }
  sleep() {
    if (this.timer && !this.song && !this.fading.length && !this.beat && !this.crowdNode) { clearInterval(this.timer); this.timer = null; }
  }
  schedule() {
    const ctx = this.ctx; if (!ctx) return;
    const now = ctx.currentTime, ahead = now + 0.25;
    for (const song of [this.song, ...this.fading]) {
      if (!song || song.stopped) continue;
      if (song.next < now - 0.1) song.next = now + 0.05; // a stall (a busy frame, a hidden tab): go on from now, never a burst
      if (this.paused) { song.next = Math.max(song.next, now + 0.05); continue; }
      while (song.next < ahead) { song.play(song.step, song.next); song.next += song.dt; song.step++; }
    }
    const b = this.beat;
    if (b) {
      if (b.next < now - 0.1) b.next = now + 0.05;
      if (this.paused) b.next = Math.max(b.next, now + 0.05);
      else while (b.next < ahead) { this.thump(b, b.next, 1); this.thump(b, b.next + 0.21, 0.65); b.next += 60 / b.bpm; }
    }
    const c = this.crowdNode;
    if (c) { // the voices that rise over the crowd: a few a second at most, more the louder it is
      if (c.next < now - 0.1) c.next = now + 0.05;
      if (this.paused) c.next = Math.max(c.next, now + 0.05);
      else while (c.next < ahead) { this.whoop(c, c.next); c.next += (0.3 + Math.random() * 1.3) / (0.35 + c.intensity); }
    }
    this.sleep();
  }

  // the mission's music: 'action' (drums, a bass line, a pad), 'calm' (a soft pad), 'epic' (driving and
  // heroic: drums, a galloping bass, strings, a brass theme that climbs), 'home' (warm and slow: a pad and a
  // plucked tune) or null (silence), crossfaded over `fade` seconds; as loud as musicVolume, under the
  // master and the mute
  music(mode = null, { fade = 1.6 } = {}) {
    if (mode !== 'action' && mode !== 'calm' && mode !== 'epic' && mode !== 'home') mode = null;
    if (this.ctx && mode === this.musicMode && (this.song?.mode ?? null) === mode) return;
    this.musicMode = mode;
    if (!this.ctx) return; // remembered: it starts with the sound
    const ctx = this.ctx, t = ctx.currentTime, f = Math.max(0.05, fade);
    if (this.song) { // the old song fades and is let go
      const old = this.song; this.song = null;
      old.bus.gain.cancelScheduledValues(t); old.bus.gain.setValueAtTime(old.bus.gain.value, t); old.bus.gain.linearRampToValueAtTime(0.0001, t + f);
      this.fading.push(old);
      old.timeout = setTimeout(() => this.endSong(old), (f + 0.3) * 1000);
    }
    if (mode) {
      const song = mode === 'action' ? this.actionSong() : mode === 'epic' ? this.epicSong() : mode === 'home' ? this.homeSong() : this.calmSong();
      song.bus.gain.setValueAtTime(0.0001, t); song.bus.gain.linearRampToValueAtTime(this.musicVolume, t + f);
      song.next = t + 0.08; song.step = 0;
      this.song = song;
      this.wake();
    }
  }
  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, Number(v) || 0));
    if (!this.song || !this.ctx) return;
    // music()'s fade-in ramp is still scheduled: drop it, or it ends at the old volume
    const p = this.song.bus.gain, t = this.ctx.currentTime;
    p.cancelScheduledValues(t); p.setValueAtTime(Math.max(0.0001, p.value), t);
    p.setTargetAtTime(Math.max(0.0001, this.musicVolume), t, 0.2);
  }
  endSong(song) {
    if (song.stopped) return;
    song.stopped = true;
    clearTimeout(song.timeout);
    const now = this.ctx.currentTime;
    for (const src of [...song.live]) { try { src.stop(now); } catch (e) { /* never started */ } } // silent by now: the bus faded
    setTimeout(() => { for (const n of song.nodes) n.disconnect(); }, 300);
    this.fading = this.fading.filter((s) => s !== song);
    this.sleep();
  }

  // a song's bus (its own gain into the master) and the filters its voices share
  songBus(mode, dt) {
    const bus = this.ctx.createGain(); bus.connect(this.master);
    return { mode, dt, bus, nodes: [bus], live: new Set(), stopped: false, next: 0, step: 0 };
  }
  actionSong() {
    const ctx = this.ctx, A = ACTION, dt = 60 / A.bpm / 4, S = this.songBus('action', dt), L = S.live;
    const filter = (type, f, q, to) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.connect(to); S.nodes.push(n); return n; };
    const drums = ctx.createGain(); drums.gain.value = 0.9; drums.connect(S.bus); S.nodes.push(drums);
    const hatF = filter('highpass', 7200, 0.7, drums), snareF = filter('bandpass', 1900, 0.9, drums);
    const bassF = filter('lowpass', 420, 6, S.bus), padF = filter('lowpass', 1300, 0.5, S.bus), leadF = filter('lowpass', 2600, 0.8, S.bus);
    const kick = (at, v) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(130, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.11);
      g.gain.setValueAtTime(0.85 * v, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.24);
      o.connect(g); g.connect(drums); this.voice(o, L, g); o.start(at); o.stop(at + 0.26);
    };
    const snare = (at, v) => {
      const n = this.noiseSource(), g = ctx.createGain();
      g.gain.setValueAtTime(0.42 * v, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.15);
      n.connect(g); g.connect(snareF); this.voice(n, L, g); n.start(at, Math.random() * 0.7, 0.17);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(220, at); o.frequency.exponentialRampToValueAtTime(150, at + 0.06);
      og.gain.setValueAtTime(0.18 * v, at); og.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
      o.connect(og); og.connect(drums); this.voice(o, L, og); o.start(at); o.stop(at + 0.1);
    };
    const hat = (at, v) => {
      const n = this.noiseSource(), g = ctx.createGain();
      g.gain.setValueAtTime(0.16 * v, at); g.gain.exponentialRampToValueAtTime(0.001, at + (v > 1 ? 0.12 : 0.04));
      n.connect(g); g.connect(hatF); this.voice(n, L, g); n.start(at, Math.random() * 0.8, 0.14);
    };
    const bass = (at, midi, len) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(midi);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.3, at + 0.008); g.gain.setValueAtTime(0.3, at + len * 0.7); g.gain.exponentialRampToValueAtTime(0.001, at + len);
      // a pluck on the shared filter: the line plays one note at a time
      bassF.frequency.setValueAtTime(1100, at); bassF.frequency.exponentialRampToValueAtTime(260, at + Math.min(0.18, len));
      o.connect(g); g.connect(bassF); this.voice(o, L, g); o.start(at); o.stop(at + len + 0.02);
    };
    const pad = (at, chord, len) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.045, at + 0.35); g.gain.setValueAtTime(0.045, at + len - 0.3); g.gain.linearRampToValueAtTime(0.0001, at + len + 0.25);
      g.connect(padF);
      const done = this.shared(g, chord.length * 2);
      for (const m of chord) for (const det of [-7, 7]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
        o.connect(g); this.voice(o, L, done); o.start(at); o.stop(at + len + 0.3);
      }
    };
    const lead = (at, midi) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = hz(midi);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.03, at + 0.01); g.gain.exponentialRampToValueAtTime(0.001, at + dt * 1.6);
      o.connect(g); g.connect(leadF); this.voice(o, L, g); o.start(at); o.stop(at + dt * 1.7);
    };
    S.play = (step, at) => {
      const i = step % 16, bar = Math.floor(step / 16) % 4, intro = step < 32; // two bars of drums and bass, then the rest comes in
      if (A.kick.includes(i) && !(bar === 3 && i === 10)) kick(at, i % 4 ? 0.7 : 1);
      if (A.snare.includes(i)) snare(at, 1);
      if (bar === 3 && i >= 13) snare(at, 0.45 + (i - 13) * 0.2); // the turnaround: a short roll back to the top
      if (i % 2 === 0) hat(at, i % 4 === 2 ? 1.4 : 0.8);
      for (const [s, semi, len] of A.bass) if (s === i) bass(at, A.roots[bar] + semi, len * dt * 0.95);
      if (!intro && i === 0) pad(at, A.chords[bar], dt * 16);
      if (!intro) for (const [s, k] of A.lead) if (s === i) lead(at, A.chords[bar][k] + 12);
    };
    return S;
  }
  calmSong() {
    const ctx = this.ctx, C = CALM, beat = 60 / C.bpm, S = this.songBus('calm', beat), L = S.live;
    const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 900; padF.Q.value = 0.4; padF.connect(S.bus); S.nodes.push(padF);
    // the pad opens and closes slowly: one oscillator for the whole song, stopped when it ends
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 300;
    lfo.connect(lg); lg.connect(padF.frequency); this.voice(lfo, L, lg); lfo.start();
    const chord = (at, notes, root, len) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.085, at + 1.6); g.gain.setValueAtTime(0.085, at + len - 0.4); g.gain.linearRampToValueAtTime(0.0001, at + len + 1.8);
      g.connect(padF);
      const all = [...notes.map((m) => [m, 'triangle', 0.5]), [root, 'sine', 0.8]], done = this.shared(g, all.length * 2);
      for (const [m, type, amp] of all) for (const det of [-5, 5]) {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = hz(m); o.detune.value = det; og.gain.value = amp;
        o.connect(og); og.connect(g); this.voice(o, L, og, done); o.start(at); o.stop(at + len + 2);
      }
    };
    const bell = (at, midi) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = hz(midi);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.04, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, at + 2.2);
      o.connect(g); g.connect(S.bus); this.voice(o, L, g); o.start(at); o.stop(at + 2.3);
    };
    S.play = (step, at) => {
      const i = step % 8, k = Math.floor(step / 8) % 4; // a chord every two bars
      if (i === 0) chord(at, C.chords[k], C.roots[k], beat * 8);
      if ((i === 3 || i === 6) && Math.random() < 0.7) bell(at, C.chords[k][Math.floor(Math.random() * C.chords[k].length)] + 24);
    };
    return S;
  }
  // 'epic': a kick on every beat, the snare on two and four, toms rolling into every fourth bar, a drum
  // that booms at the top of each half, a galloping bass, strings in sixteenths, and the brass theme
  epicSong() {
    const ctx = this.ctx, E = EPIC, dt = 60 / E.bpm / 4, S = this.songBus('epic', dt), L = S.live;
    const filter = (type, f, q, to) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.connect(to); S.nodes.push(n); return n; };
    const drums = ctx.createGain(); drums.gain.value = 0.9; drums.connect(S.bus); S.nodes.push(drums);
    const hatF = filter('highpass', 7600, 0.7, drums), snareF = filter('bandpass', 1700, 0.8, drums), crashF = filter('highpass', 4200, 0.5, drums);
    const bassF = filter('lowpass', 460, 5, S.bus), padF = filter('lowpass', 1500, 0.5, S.bus), figF = filter('lowpass', 2300, 0.9, S.bus), leadF = filter('lowpass', 2100, 1.4, S.bus);
    const tone = (at, from, to, drop, level, len, type = 'sine') => { // a drum made of a falling tone
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(from, at); o.frequency.exponentialRampToValueAtTime(to, at + drop);
      g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(0.001, at + len);
      o.connect(g); g.connect(drums); this.voice(o, L, g); o.start(at); o.stop(at + len + 0.02);
    };
    const hiss = (at, level, len, to) => { // ...and one made of noise
      const n = this.noiseSource(len > 0.25), g = ctx.createGain();
      g.gain.setValueAtTime(level, at); g.gain.exponentialRampToValueAtTime(0.001, at + len);
      n.connect(g); g.connect(to); this.voice(n, L, g); n.start(at, Math.random() * 0.7, len + 0.03);
    };
    const bass = (at, midi, len) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(midi);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.3, at + 0.006); g.gain.setValueAtTime(0.3, at + len * 0.6); g.gain.exponentialRampToValueAtTime(0.001, at + len);
      bassF.frequency.setValueAtTime(1300, at); bassF.frequency.exponentialRampToValueAtTime(300, at + Math.min(0.14, len));
      o.connect(g); g.connect(bassF); this.voice(o, L, g); o.start(at); o.stop(at + len + 0.02);
    };
    const pad = (at, chord, len) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.04, at + 0.3); g.gain.setValueAtTime(0.04, at + len - 0.25); g.gain.linearRampToValueAtTime(0.0001, at + len + 0.2);
      g.connect(padF);
      const done = this.shared(g, chord.length * 2);
      for (const m of chord) for (const det of [-8, 8]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
        o.connect(g); this.voice(o, L, done); o.start(at); o.stop(at + len + 0.25);
      }
    };
    const fig = (at, midi, v) => { // the strings: short bows
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = hz(midi);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.022 * v, at + 0.012); g.gain.exponentialRampToValueAtTime(0.001, at + dt * 0.95);
      o.connect(g); g.connect(figF); this.voice(o, L, g); o.start(at); o.stop(at + dt);
    };
    const lead = (at, midi, len) => { // the brass: two saws a little apart, the filter opening as the note speaks
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.05, at + 0.035); g.gain.setValueAtTime(0.045, at + Math.max(0.05, len - 0.08)); g.gain.linearRampToValueAtTime(0.0001, at + len + 0.04);
      g.connect(leadF);
      leadF.frequency.setValueAtTime(900, at); leadF.frequency.linearRampToValueAtTime(2600, at + 0.09);
      const done = this.shared(g, 3);
      for (const [det, type, oct] of [[-6, 'sawtooth', 0], [6, 'sawtooth', 0], [0, 'square', -12]]) {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = hz(midi + oct); o.detune.value = det; og.gain.value = oct ? 0.35 : 1;
        o.connect(og); og.connect(g); this.voice(o, L, og, done); o.start(at); o.stop(at + len + 0.06);
      }
    };
    S.play = (step, at) => {
      const i = step % 16, bar = Math.floor(step / 16) % 8, intro = step < 32; // two bars of drums and bass, then the rest comes in
      const roll = bar % 4 === 3 && i >= 12;
      if (i % 4 === 0 && !roll) tone(at, 140, 44, 0.1, i ? 0.7 : 0.9, 0.25);                     // the kick
      if ((i === 4 || i === 12) && !roll) { hiss(at, 0.4, 0.16, snareF); tone(at, 230, 160, 0.05, 0.16, 0.09, 'triangle'); } // the snare
      if (roll) tone(at, 210 - (i - 12) * 30, 90 - (i - 12) * 10, 0.16, 0.5 + (i - 12) * 0.08, 0.3);     // toms, coming down
      if (i === 0 && bar % 4 === 0) { tone(at, 92, 52, 0.5, 0.75, 1.3); if (!intro || bar === 0) hiss(at, 0.13, 1.1, crashF); } // the great drum, a cymbal over it
      if (i % 2 === 0) hiss(at, i % 4 === 2 ? 0.2 : 0.11, i % 4 === 2 ? 0.09 : 0.035, hatF);
      for (const [s, semi, len] of E.bass) if (s === i) bass(at, E.roots[bar] + semi, len * dt * 0.92);
      if (intro) return;
      if (i === 0) pad(at, E.chords[bar], dt * 16);
      fig(at, E.chords[bar][E.figure[i % 4]] + 12, i % 4 ? 0.75 : 1.15);
      for (const [s, midi, len] of E.lead[bar]) if (s === i) lead(at, midi, len * dt * 0.94);
    };
    return S;
  }
  // 'home': the pad breathes a chord a bar with a low note under it, a second voice ticks through the chord
  // on the off-beats, and the plucked tune rings over them through a soft echo
  homeSong() {
    const ctx = this.ctx, H = HOME, dt = 60 / H.bpm / 2, S = this.songBus('home', dt), L = S.live;
    const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 1050; padF.Q.value = 0.4; padF.connect(S.bus); S.nodes.push(padF);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 260;
    lfo.connect(lg); lg.connect(padF.frequency); this.voice(lfo, L, lg); lfo.start();
    // the plucks go straight out and into an echo three eighths long that feeds back a little
    const pluckF = ctx.createBiquadFilter(); pluckF.type = 'lowpass'; pluckF.frequency.value = 2600; pluckF.Q.value = 0.6;
    const echo = ctx.createDelay(1.5), back = ctx.createGain(), wet = ctx.createGain();
    echo.delayTime.value = dt * 3; back.gain.value = 0.3; wet.gain.value = 0.34;
    pluckF.connect(S.bus); pluckF.connect(echo); echo.connect(back); back.connect(echo); echo.connect(wet); wet.connect(S.bus);
    S.nodes.push(pluckF, echo, back, wet);
    const chord = (at, notes, root, len) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.075, at + 1.1); g.gain.setValueAtTime(0.075, at + len - 0.3); g.gain.linearRampToValueAtTime(0.0001, at + len + 1.3);
      g.connect(padF);
      const all = [...notes.map((m) => [m, 'triangle', 0.5]), [root, 'sine', 0.85], [root + 12, 'sine', 0.3]], done = this.shared(g, all.length * 2);
      for (const [m, type, amp] of all) for (const det of [-5, 5]) {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = hz(m); o.detune.value = det; og.gain.value = amp;
        o.connect(og); og.connect(g); this.voice(o, L, og, done); o.start(at); o.stop(at + len + 1.5);
      }
    };
    const pluck = (at, midi, level, ring) => { // a string plucked: a bright start that dies away
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(level, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0004, at + ring);
      g.connect(pluckF);
      const done = this.shared(g, 2);
      for (const [type, oct, amp] of [['triangle', 0, 1], ['sine', 12, 0.28]]) {
        const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = hz(midi + oct); og.gain.value = amp;
        o.connect(og); og.connect(g); this.voice(o, L, og, done); o.start(at); o.stop(at + ring + 0.05);
      }
    };
    S.play = (step, at) => {
      const i = step % 8, bar = Math.floor(step / 8) % 8, intro = step < 8; // the first bar is the pad alone
      if (i === 0) chord(at, H.chords[bar], H.roots[bar], dt * 8);
      if (i % 2 === 1) pluck(at, H.chords[bar][((i - 1) / 2) % H.chords[bar].length] + 12, 0.022, 0.7);
      if (intro) return;
      for (const [s, midi] of H.tune[bar]) if (s === i) pluck(at, midi, 0.085, 1.7);
    };
    return S;
  }

  // rain: a hiss of fine drops over a low rumble, `k` 0..1 (0 fades it out and lets it go); `muffled`
  // under a roof: the hiss closes down to a drumming overhead; `seconds` to come or go (0: at once;
  // by default 1.2 in, 0.9 out)
  rain(k = 1, { muffled = false, seconds } = {}) {
    k = Math.max(0, Math.min(1.5, Number(k) || 0));
    this.rainLevel = k; this.rainMuffled = !!muffled;
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    let R = this.rainNode;
    if (k > 0 && !R) {
      const out = ctx.createGain(); out.gain.value = 0.0001; out.connect(this.master);
      const hiss = ctx.createBiquadFilter(); hiss.type = 'highpass'; hiss.frequency.value = 900;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 6500;
      const hg = ctx.createGain(); hg.gain.value = 0.55;
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 420;
      const lg = ctx.createGain(); lg.gain.value = 0.7;
      // two copies of the noise at slightly different speeds, so the one-second loop never repeats audibly
      const a = this.noiseSource(true), b = this.noiseSource(true); b.playbackRate.value = 0.913;
      a.connect(hiss); hiss.connect(tone); tone.connect(hg); hg.connect(out);
      b.connect(low); low.connect(lg); lg.connect(out);
      this.voice(a, this.loose); this.voice(b, this.loose);
      a.start(); b.start(t, Math.random());
      R = this.rainNode = { out, tone, sources: [a, b], nodes: [out, hiss, tone, hg, low, lg], end: null };
    }
    if (!R) return;
    clearTimeout(R.end); R.end = null;
    const dur = Number.isFinite(seconds) ? Math.max(0, seconds) : k > 0 ? 1.2 : 0.9, level = k > 0 ? 0.05 + 0.1 * Math.min(1, k) : 0.0001;
    R.out.gain.cancelScheduledValues(t);
    if (dur > 0) { R.out.gain.setValueAtTime(Math.max(0.0001, R.out.gain.value), t); R.out.gain.linearRampToValueAtTime(level, t + dur); } else R.out.gain.setValueAtTime(level, t);
    R.tone.frequency.cancelScheduledValues(t);
    if (dur > 0) R.tone.frequency.setTargetAtTime(muffled ? 900 : 6500, t, 0.3); else R.tone.frequency.setValueAtTime(muffled ? 900 : 6500, t);
    if (k === 0) R.end = setTimeout(() => {
      for (const s of R.sources) { try { s.stop(); } catch (e) { /* stopped */ } }
      setTimeout(() => { for (const n of R.nodes) n.disconnect(); }, 100);
      if (this.rainNode === R) this.rainNode = null;
    }, (dur + 0.1) * 1000); // let go once silent
  }

  // sleeping gas from a vent: a hiss that swells, holds and dies away; returns a function that stops it early
  gas(seconds = 5, level = 0.12) {
    if (!this.ctx) return () => {};
    const ctx = this.ctx, t = ctx.currentTime, n = this.noiseSource(true), hp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 2400;
    pk.type = 'peaking'; pk.frequency.value = 5200; pk.gain.value = 6; pk.Q.value = 1.2;
    const end = t + Math.max(0.6, seconds);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(level, t + 0.35); g.gain.setValueAtTime(level, end - 0.5); g.gain.linearRampToValueAtTime(0.0001, end);
    n.connect(hp); hp.connect(pk); pk.connect(g); g.connect(this.master);
    this.voice(n, this.loose, hp, pk, g);
    n.start(t, Math.random()); n.stop(end + 0.05);
    return () => {
      try { const now = ctx.currentTime; g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now); g.gain.linearRampToValueAtTime(0.0001, now + 0.15); n.stop(now + 0.2); } catch (e) { /* already stopped */ }
    };
  }

  // a heartbeat heard from inside: two dull thumps a beat, low-passed; `bpm` sets the pace (again with
  // on = true changes it), false fades it out
  heartbeat(on = true, { bpm = 62, level = 0.5 } = {}) {
    this.beatWanted = on ? { bpm, level } : null;
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    if (on) {
      if (this.beat) { // the fade-in ramp dropped first, or it would end at the old level
        const p = this.beat.bus.gain; this.beat.bpm = bpm;
        p.cancelScheduledValues(t); p.setValueAtTime(Math.max(0.0001, p.value), t); p.setTargetAtTime(Math.max(0.0001, level), t, 0.3);
        return;
      }
      const bus = ctx.createGain(), f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 140; f.Q.value = 0.9;
      bus.gain.setValueAtTime(0.0001, t); bus.gain.linearRampToValueAtTime(level, t + 0.6);
      f.connect(bus); bus.connect(this.master);
      this.beat = { bus, f, bpm, next: t + 0.1 };
      this.wake();
    } else if (this.beat) {
      const b = this.beat; this.beat = null;
      b.bus.gain.cancelScheduledValues(t); b.bus.gain.setValueAtTime(Math.max(0.0001, b.bus.gain.value), t); b.bus.gain.linearRampToValueAtTime(0.0001, t + 0.5);
      setTimeout(() => { b.f.disconnect(); b.bus.disconnect(); }, 900);
      this.sleep();
    }
  }
  thump(b, at, v) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(64, at); o.frequency.exponentialRampToValueAtTime(38, at + 0.12);
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.9 * v, at + 0.012); g.gain.exponentialRampToValueAtTime(0.001, at + 0.17);
    o.connect(g); g.connect(b.f); this.voice(o, this.loose, g); o.start(at); o.stop(at + 0.19);
  }

  // ---------- chapter ten: portals, static, a crowd ----------

  // sources started together that count in `voices` until they end; `nodes` are let go with the last of them
  bundle(sources, nodes) {
    const done = this.shared({ disconnect() { for (const n of nodes) n.disconnect(); } }, sources.length);
    for (const s of sources) this.voice(s, this.loose, done);
  }

  // the hum of an open portal (or, higher and thinner, of the orb): two low saws that beat against each
  // other, a note an octave under them, and air being drawn in. Returns a handle: set(k, pitch) follows the
  // portal's size (k 0..1.5 of `level`), stop(seconds) fades it out and lets it go. Silent handle before
  // the sound has started
  portalHum({ level = 0.15, pitch = 1 } = {}) {
    if (!this.ctx) return { live: false, set() {}, stop() {} };
    const ctx = this.ctx, t = ctx.currentTime, out = ctx.createGain(), f = ctx.createBiquadFilter();
    out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(level, t + 0.5);
    f.type = 'lowpass'; f.frequency.value = 430 * pitch; f.Q.value = 5;
    f.connect(out); out.connect(this.master);
    const osc = (type, freq) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; return o; };
    const a = osc('sawtooth', 55 * pitch), b = osc('sawtooth', 55.8 * pitch), sub = osc('sine', 27.5 * pitch), sg = ctx.createGain();
    sg.gain.value = 0.4; a.connect(f); b.connect(f); sub.connect(sg); sg.connect(out);
    const sweep = osc('sine', 0.37), sw = ctx.createGain(); sw.gain.value = 170 * pitch; sweep.connect(sw); sw.connect(f.frequency);
    const air = this.noiseSource(true), bp = ctx.createBiquadFilter(), ag = ctx.createGain(), breath = osc('sine', 0.23), bg = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 950 * pitch; bp.Q.value = 1.3; ag.gain.value = 0.16; bg.gain.value = 0.1;
    air.connect(bp); bp.connect(ag); ag.connect(out); breath.connect(bg); bg.connect(ag.gain);
    const sources = [a, b, sub, sweep, air, breath];
    this.bundle(sources, [out, f, sg, sw, bp, ag, bg]);
    for (const s of sources) s.start(t);
    let stopped = false;
    return {
      live: true,
      set: (k = 1, p = pitch) => {
        if (stopped) return;
        const now = ctx.currentTime;
        out.gain.cancelScheduledValues(now); out.gain.setTargetAtTime(Math.max(0.0001, level * Math.max(0, Math.min(1.5, k))), now, 0.12);
        a.frequency.setTargetAtTime(55 * p, now, 0.2); b.frequency.setTargetAtTime(55.8 * p, now, 0.2); sub.frequency.setTargetAtTime(27.5 * p, now, 0.2);
      },
      stop: (seconds = 0.6) => {
        if (stopped) return;
        stopped = true;
        const now = ctx.currentTime, end = now + Math.max(0.05, seconds);
        out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now); out.gain.linearRampToValueAtTime(0.0001, end);
        for (const s of sources) { try { s.stop(end + 0.05); } catch (e) { /* already stopped */ } }
      },
    };
  }

  // a portal tearing open: an electric rip, a hard crack and the thunder rolling away under it
  thunder(strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, k = Math.max(0.1, Math.min(1.5, strength));
    const rip = ctx.createOscillator(), rg = ctx.createGain(); // the rip: a tone torn upward
    rip.type = 'sawtooth'; rip.frequency.setValueAtTime(160, t); rip.frequency.exponentialRampToValueAtTime(2100, t + 0.11);
    rg.gain.setValueAtTime(0.0001, t); rg.gain.linearRampToValueAtTime(0.07 * k, t + 0.09); rg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    rip.connect(rg); rg.connect(this.master);
    const hp = ctx.createBiquadFilter(), cg = ctx.createGain(), crack = this.noiseSource(); // the crack, and two echoes of it
    hp.type = 'highpass'; hp.frequency.value = 1700;
    cg.gain.setValueAtTime(0.0001, t);
    for (const [at, v] of [[0.1, 0.42], [0.16, 0.2], [0.23, 0.27]]) { cg.gain.setValueAtTime(v * k, t + at); cg.gain.exponentialRampToValueAtTime(0.004, t + at + 0.05); }
    cg.gain.exponentialRampToValueAtTime(0.0005, t + 0.5);
    crack.connect(hp); hp.connect(cg); cg.connect(this.master);
    const lp = ctx.createBiquadFilter(), bg = ctx.createGain(), body = this.noiseSource(true); // the roll
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(950, t + 0.1); lp.frequency.exponentialRampToValueAtTime(80, t + 2.0);
    bg.gain.setValueAtTime(0.0001, t); bg.gain.setValueAtTime(0.4 * k, t + 0.1); bg.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    body.connect(lp); lp.connect(bg); bg.connect(this.master);
    const sub = ctx.createOscillator(), sg = ctx.createGain();
    sub.type = 'sine'; sub.frequency.setValueAtTime(68, t + 0.1); sub.frequency.exponentialRampToValueAtTime(27, t + 1.1);
    sg.gain.setValueAtTime(0.0001, t); sg.gain.setValueAtTime(0.36 * k, t + 0.1); sg.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    sub.connect(sg); sg.connect(this.master);
    this.bundle([rip, crack, body, sub], [rg, hp, cg, lp, bg, sg]);
    rip.start(t); rip.stop(t + 0.18); crack.start(t + 0.1, Math.random() * 0.4, 0.5); body.start(t + 0.1, Math.random() * 0.3, 2.2); sub.start(t + 0.1); sub.stop(t + 1.4);
  }

  // an energy bolt: a buzzing tone that drops fast, a spit of sparks over it; `pitch` sets how high
  zap(strength = 1, pitch = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, k = Math.max(0.05, Math.min(1.5, strength));
    const o = ctx.createOscillator(), buzz = ctx.createOscillator(), depth = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(1500 * pitch, t); o.frequency.exponentialRampToValueAtTime(170 * pitch, t + 0.2);
    buzz.type = 'sawtooth'; buzz.frequency.value = 93; depth.gain.value = 320 * pitch; buzz.connect(depth); depth.connect(o.frequency);
    f.type = 'bandpass'; f.frequency.setValueAtTime(2400 * pitch, t); f.frequency.exponentialRampToValueAtTime(500 * pitch, t + 0.2); f.Q.value = 1.1;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * k, t + 0.006); g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(f); f.connect(g); g.connect(this.master);
    const n = this.noiseSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 3200;
    ng.gain.setValueAtTime(0.16 * k, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.connect(hp); hp.connect(ng); ng.connect(this.master);
    this.bundle([o, buzz, n], [depth, f, g, hp, ng]);
    o.start(t); o.stop(t + 0.26); buzz.start(t); buzz.stop(t + 0.26); n.start(t, Math.random() * 0.8, 0.09);
  }

  // a radio with nobody on it: a hiss that flutters and crackles, a thin whine under it; false fades it out
  // and lets it go
  radioStatic(on = true, { level = 0.12, seconds = 0.25 } = {}) {
    this.staticWanted = on ? { level, seconds } : null;
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    let N = this.staticNode;
    if (on && !N) {
      const out = ctx.createGain(); out.gain.value = 0.0001; out.connect(this.master);
      const hiss = this.noiseSource(true), bp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), amp = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7; hp.type = 'highpass'; hp.frequency.value = 520; amp.gain.value = 0.55;
      hiss.connect(bp); bp.connect(hp); hp.connect(amp); amp.connect(out);
      // the flutter: slow noise moves the hiss's loudness
      const slow = this.noiseSource(true), sf = ctx.createBiquadFilter(), sd = ctx.createGain();
      slow.playbackRate.value = 0.37; sf.type = 'lowpass'; sf.frequency.value = 13; sd.gain.value = 16;
      slow.connect(sf); sf.connect(sd); sd.connect(amp.gain);
      // the crackle: only the noise's highest peaks get through, as ticks
      const peaks = ctx.createWaveShaper(), curve = new Float32Array(2048), tg = ctx.createGain();
      curve[0] = -1; curve[2047] = 1; peaks.curve = curve; tg.gain.value = 0.9;
      hiss.connect(peaks); peaks.connect(tg); tg.connect(out);
      const whine = ctx.createOscillator(), wg = ctx.createGain(); whine.type = 'sine'; whine.frequency.value = 2870; wg.gain.value = 0.05;
      whine.connect(wg); wg.connect(out);
      const sources = [hiss, slow, whine];
      this.bundle(sources, [out, bp, hp, amp, sf, sd, peaks, tg, wg]);
      hiss.start(t); slow.start(t, Math.random()); whine.start(t);
      N = this.staticNode = { out, sources, end: null };
    }
    if (!N) return;
    clearTimeout(N.end); N.end = null;
    const dur = Math.max(0.02, seconds);
    N.out.gain.cancelScheduledValues(t); N.out.gain.setValueAtTime(Math.max(0.0001, N.out.gain.value), t);
    N.out.gain.linearRampToValueAtTime(on ? Math.max(0.0001, level) : 0.0001, t + dur);
    if (!on) {
      this.staticNode = null; // a new one may start while this one fades
      N.end = setTimeout(() => { for (const s of N.sources) { try { s.stop(); } catch (e) { /* stopped */ } } }, (dur + 0.05) * 1000);
    }
  }

  // two seconds of many hands clapping, made once: a few hundred claps, each a short burst of noise with
  // its own loudness, scattered over the loop (it is played twice at two speeds, so it never repeats audibly)
  clapping() {
    if (this.applause) return this.applause;
    const ctx = this.ctx, rate = ctx.sampleRate, n = rate * 2, buf = ctx.createBuffer(1, n, rate), d = buf.getChannelData(0);
    for (let c = 0; c < 420; c++) {
      const at = Math.floor(Math.random() * n), len = Math.floor(rate * (0.012 + Math.random() * 0.02)), amp = 0.25 + Math.random() * 0.75, fall = 5 + Math.random() * 4;
      for (let i = 0; i < len; i++) d[(at + i) % n] += (Math.random() * 2 - 1) * amp * Math.exp(-fall * i / len);
    }
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
    if (peak > 0) for (let i = 0; i < n; i++) d[i] /= peak;
    return (this.applause = buf);
  }
  // a crowd cheering and clapping: the roar of many voices, hands clapping, and now and then a voice or a
  // whistle that rises over them. `intensity` 0..1 (again with on = true changes it); false fades it out
  // over `seconds` and lets it go
  crowd(on = true, { intensity = 0.7, seconds = 1.5 } = {}) {
    intensity = Math.max(0, Math.min(1, Number(intensity) || 0));
    this.crowdWanted = on ? { intensity, seconds } : null;
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    let C = this.crowdNode;
    if (on && !C) {
      const out = ctx.createGain(); out.gain.value = 0.0001; out.connect(this.master);
      // the roar: noise through two wide bands where voices sit, each swelling on its own slow wave
      const band = (freq, q, rate, lfoHz, level) => {
        const n = this.noiseSource(true), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
        n.playbackRate.value = rate; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = level; l.frequency.value = lfoHz; lg.gain.value = level * 0.45;
        n.connect(f); f.connect(g); g.connect(out); l.connect(lg); lg.connect(g.gain);
        return { sources: [n, l], nodes: [f, g, lg] };
      };
      const lo = band(620, 0.6, 1, 0.13, 0.5), hi = band(1450, 0.8, 0.83, 0.29, 0.3);
      // the hands
      const claps = ctx.createGain(), cf = ctx.createBiquadFilter(); cf.type = 'bandpass'; cf.frequency.value = 2100; cf.Q.value = 0.5; cf.connect(claps); claps.connect(out);
      const a = ctx.createBufferSource(), b = ctx.createBufferSource();
      a.buffer = b.buffer = this.clapping(); a.loop = b.loop = true; b.playbackRate.value = 0.87;
      a.connect(cf); b.connect(cf);
      const voices = ctx.createBiquadFilter(); voices.type = 'bandpass'; voices.frequency.value = 1250; voices.Q.value = 0.9; voices.connect(out);
      const sources = [...lo.sources, ...hi.sources, a, b];
      this.bundle(sources, [out, ...lo.nodes, ...hi.nodes, claps, cf, voices]);
      for (const s of sources) s.start(t, 0);
      C = this.crowdNode = { out, claps, voices, sources, intensity, next: t + 0.2, end: null };
      this.wake();
    }
    if (!C) return;
    const dur = Math.max(0.05, seconds);
    C.out.gain.cancelScheduledValues(t); C.out.gain.setValueAtTime(Math.max(0.0001, C.out.gain.value), t);
    if (on) {
      C.intensity = intensity;
      C.out.gain.linearRampToValueAtTime(0.06 + 0.24 * intensity, t + dur);
      C.claps.gain.setTargetAtTime(0.25 + 0.9 * intensity, t, 0.3);
    } else {
      this.crowdNode = null; // a new one may start while this one fades
      C.out.gain.linearRampToValueAtTime(0.0001, t + dur);
      C.end = setTimeout(() => { for (const s of C.sources) { try { s.stop(); } catch (e) { /* stopped */ } } }, (dur + 0.1) * 1000);
      this.sleep();
    }
  }
  // one voice over the crowd: a cheer that slides up, or a whistle
  whoop(c, at) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain(), whistle = Math.random() < 0.3, v = (0.5 + 0.5 * Math.random()) * (0.4 + 0.6 * c.intensity);
    if (whistle) {
      const f0 = 1500 + Math.random() * 500;
      o.type = 'sine'; o.frequency.setValueAtTime(f0, at); o.frequency.linearRampToValueAtTime(f0 * 1.5, at + 0.12); o.frequency.linearRampToValueAtTime(f0 * 1.25, at + 0.3);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.045 * v, at + 0.03); g.gain.exponentialRampToValueAtTime(0.0005, at + 0.32);
      o.connect(g); g.connect(c.out);
      this.voice(o, this.loose, g); o.start(at); o.stop(at + 0.34);
    } else {
      const f0 = 240 + Math.random() * 190, len = 0.35 + Math.random() * 0.4;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, at); o.frequency.linearRampToValueAtTime(f0 * (1.5 + Math.random() * 0.4), at + len * 0.6); o.frequency.linearRampToValueAtTime(f0 * 1.3, at + len);
      g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.5 * v, at + 0.06); g.gain.setValueAtTime(0.5 * v, at + len * 0.6); g.gain.exponentialRampToValueAtTime(0.0005, at + len);
      o.connect(g); g.connect(c.voices);
      this.voice(o, this.loose, g); o.start(at); o.stop(at + len + 0.02);
    }
  }

  // all of the atmosphere off at once (a mission's cleanup)
  quiet() { this.music(null, { fade: 0.6 }); this.rain(0); this.heartbeat(false); this.radioStatic(false); this.crowd(false, { seconds: 0.6 }); }
  // what is playing, for missions and tests
  get atmosphere() { return { music: this.song?.mode ?? null, rain: !!this.rainNode, heartbeat: !!this.beat, voices: this.voices, timer: !!this.timer, static: !!this.staticNode, crowd: this.crowdNode ? this.crowdNode.intensity : 0 }; }
}
