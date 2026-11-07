// The car radio (chapter five) and the pub's music. Three stations — hip-hop, Mizrahi pop and house —
// each with its own procedural loop (so the game is complete on its own), replaced by real tracks when
// the optional asset layer sets window.__hfMusic = { hiphop: [...urls], mizrahi: [...], house: [...], pub: [...] }.
// The radio plays only in the car; a pill at the top shows the station and a tap moves to the next
// one (then off). While a mission's music plays (sound.music) the radio is silent and its pill hidden,
// so the two never play over each other; the station comes back when the music ends. The pub plays its
// own track as an ambient source that fades with distance.
// Everything here is written for the game; no recordings of anyone are used.
const STATIONS = [
  { id: 'hiphop', name: 'רדיו 90 · היפ-הופ', bpm: 92 },
  { id: 'mizrahi', name: 'גלגל״צ מזרחית', bpm: 118 },
  { id: 'house', name: 'לילה · האוס', bpm: 124 },
];

export class Radio {
  constructor(game, el) {
    this.game = game;
    this.el = el;                 // the pill
    this.station = -1;            // index into STATIONS, -1 = off
    this.tracks = {};             // id -> [url]
    this.audio = null;            // the <audio> playing a real track
    this.loop = null;             // the procedural loop { stop() }
    this.ambientSrc = null;       // { id, center, radius, audio }
    this.lastKey = '';
    this.volume = 0.55;
    if (el) el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.next(); });
    if (window.__hfMusic) this.setTracks(window.__hfMusic);
  }

  setTracks(map) { this.tracks = { ...this.tracks, ...map }; if (this.station >= 0) this.play(this.station); }

  get on() { return this.station >= 0; }
  get name() { return this.station >= 0 ? STATIONS[this.station].name : 'רדיו כבוי'; }

  // the next station, then off
  next() {
    const n = this.station + 1;
    if (n >= STATIONS.length) this.stop(); else this.play(n);
    this.refresh(true);
  }

  play(i) {
    this.stopSource();
    this.station = i;
    const st = STATIONS[i], urls = this.tracks[st.id];
    if (urls && urls.length) {
      const a = new Audio(urls[Math.floor(Math.random() * urls.length)]);
      a.loop = true; a.volume = this.muted() || this.music() ? 0 : this.volume; a.crossOrigin = 'anonymous';
      a.play().catch(() => {});
      this.audio = a;
    } else if (!this.music()) this.loop = this.procedural(st); // under the mission's music, update() starts it once that ends
  }

  stop() { this.stopSource(); this.station = -1; }
  stopSource() {
    if (this.audio) { this.audio.pause(); this.audio.src = ''; this.audio = null; }
    if (this.loop) { this.loop.stop(); this.loop = null; }
  }
  muted() { const s = this.game.sound; return !s || s.muted || s.paused; }
  // the mission's music is on, or still fading out
  music() { const s = this.game.sound; return !!s && (!!s.musicMode || !!s.fading?.length); }

  // a small procedural loop through the game's sound output: kick, snare/clap, hat and a bass line in the station's style
  procedural(st) {
    const s = this.game.sound; if (!s || !s.ctx) return { stop() {} };
    const ctx = s.ctx, out = ctx.createGain(); out.gain.value = 0.22; out.connect(s.master);
    const beat = 60 / st.bpm; let t = ctx.currentTime + 0.05, bar = 0, alive = true;
    const bass = st.id === 'hiphop' ? [41, 41, 44, 39] : st.id === 'mizrahi' ? [45, 48, 50, 43] : [38, 38, 41, 36];
    const kick = (at) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(120, at); o.frequency.exponentialRampToValueAtTime(40, at + 0.12); g.gain.setValueAtTime(0.9, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.22); o.connect(g); g.connect(out); o.start(at); o.stop(at + 0.25); };
    const snare = (at) => { const n = s.noiseSource(false), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = st.id === 'house' ? 2400 : 1600; g.gain.setValueAtTime(0.5, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.16); n.connect(f); f.connect(g); g.connect(out); n.start(at); n.stop(at + 0.2); };
    const hat = (at, v = 0.18) => { const n = s.noiseSource(false), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.05); n.connect(f); f.connect(g); g.connect(out); n.start(at); n.stop(at + 0.06); };
    const note = (at, midi, len, type = 'sawtooth', v = 0.25) => { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = type; o.frequency.value = 440 * 2 ** ((midi - 69) / 12); f.type = 'lowpass'; f.frequency.value = st.id === 'house' ? 900 : 600; g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.001, at + len); o.connect(f); f.connect(g); g.connect(out); o.start(at); o.stop(at + len + 0.02); };
    const schedule = () => {
      if (!alive) return;
      while (t < ctx.currentTime + 0.6) {
        for (let i = 0; i < 4; i++) {
          const at = t + i * beat;
          if (st.id === 'house' || i === 0 || i === 2) kick(at);
          if (i === 1 || i === 3) snare(at);
          hat(at + beat / 2, st.id === 'hiphop' ? 0.12 : 0.2);
          if (st.id === 'house') hat(at, 0.1);
          note(at, bass[bar % 4] + (st.id === 'mizrahi' && i === 3 ? 2 : 0), beat * 0.9, st.id === 'mizrahi' ? 'triangle' : 'sawtooth');
          if (st.id === 'mizrahi' && (i === 1 || i === 2)) note(at + beat / 2, bass[bar % 4] + 24 + (i === 1 ? 3 : 7), beat * 0.4, 'square', 0.08); // a quick ornament
        }
        t += beat * 4; bar++;
      }
    };
    const timer = setInterval(schedule, 200); schedule();
    return { stop() { alive = false; clearInterval(timer); out.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => out.disconnect(), 400); } };
  }

  // a place's music (the pub): plays while the player is within `radius` of the centre, fading with distance
  ambient(id, center, radius) {
    this.stopAmbient();
    const urls = this.tracks[id];
    const a = urls && urls.length ? new Audio(urls[0]) : null;
    if (a) { a.loop = true; a.volume = 0; a.play().catch(() => {}); }
    this.ambientSrc = { id, center, radius, audio: a, loop: a ? null : null };
    if (!a) this.ambientSrc.loop = this.procedural(STATIONS[0]); // the pub's loop, until a track arrives
  }
  stopAmbient() {
    const s = this.ambientSrc; if (!s) return;
    if (s.audio) { s.audio.pause(); s.audio.src = ''; }
    if (s.loop) s.loop.stop();
    this.ambientSrc = null;
  }

  update() {
    const g = this.game;
    const plays = g.mode === 'car' && !this.music(); // in the car, and no mission music over it
    if (this.audio) this.audio.volume = this.muted() || !plays ? 0 : this.volume;
    if (this.loop && !plays) { this.loop.stop(); this.loop = null; } // the procedural loop stops when you step out (or the music starts)
    if (this.loop === null && plays && this.station >= 0 && !this.audio && !this.tracks[STATIONS[this.station].id]?.length) this.loop = this.procedural(STATIONS[this.station]);
    const s = this.ambientSrc;
    if (s && s.audio) { const d = Math.hypot(g.player.pos.x - s.center.x, g.player.pos.z - s.center.z); s.audio.volume = this.muted() ? 0 : Math.max(0, 1 - d / s.radius) * 0.7; }
    this.refresh();
  }

  refresh(force) {
    if (!this.el) return;
    const show = this.game.mode === 'car' && !this.game.cutscene && !this.music(); // no pill that would play nothing
    const key = `${show}:${this.station}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.el.hidden = !show;
    this.el.textContent = this.name;
    this.el.classList.toggle('off', this.station < 0);
  }
}
