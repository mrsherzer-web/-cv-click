// All the game's sound, made on the spot with the Web Audio API: no recordings, nothing borrowed. The
// Renault's engine follows speed and gas, tires squeal in a slide, punches thump, crashes crunch, the
// phone rings, a short chime closes a mission, and a soft wind (or the hum of the city) sits underneath.
// Starts on the first tap (browsers require a gesture) and can be muted from the screen.
// Chapter nine adds the atmosphere: rain (`rain(k)`), the mission's own music (`music('action' | 'calm' |
// null)`: an original loop written here, its notes scheduled a moment ahead by a lookahead timer), the
// hiss of sleeping gas (`gas(seconds)`) and a muffled heartbeat (`heartbeat(on)`). Each has its own gain
// under the master, so the mute button silences them all; each is let go when it ends (sources stopped,
// nodes disconnected), and `voices` counts the sources they still hold.
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
    this.timer = null;        // the lookahead timer (only while music or a heartbeat runs)
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
    if (this.timer && !this.song && !this.fading.length && !this.beat) { clearInterval(this.timer); this.timer = null; }
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
    this.sleep();
  }

  // the mission's music: 'action' (drums, a bass line, a pad), 'calm' (a soft pad) or null (silence),
  // crossfaded over `fade` seconds; as loud as musicVolume, under the master and the mute
  music(mode = null, { fade = 1.6 } = {}) {
    if (mode !== 'action' && mode !== 'calm') mode = null;
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
      const song = mode === 'action' ? this.actionSong() : this.calmSong();
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

  // all of the atmosphere off at once (a mission's cleanup)
  quiet() { this.music(null, { fade: 0.6 }); this.rain(0); this.heartbeat(false); }
  // what is playing, for missions and tests
  get atmosphere() { return { music: this.song?.mode ?? null, rain: !!this.rainNode, heartbeat: !!this.beat, voices: this.voices, timer: !!this.timer }; }
}
