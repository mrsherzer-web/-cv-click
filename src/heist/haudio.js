/* HAudio — procedural WebAudio for chapter 2, "THE BIG SCORE".
 *
 * Built on AudioSys (src/audio.js). Every sound is routed into AudioSys.sfxBus or AudioSys.musicBus,
 * so the global mute, the compressor, the brick-wall limiter and suspend/resume keep working.
 * No samples: the flat-12 engine, tyres, sirens, the rainy night city, stings and three
 * synthwave scores are all synthesized.
 *
 * Every public function is a safe no-op until AudioSys.init() has run (from a user gesture),
 * and while AudioSys.live() is false. Continuous voices (engine, skid, siren) fade out on their own
 * if the game stops calling them for ~0.35 s, so a paused or crashed frame loop never leaves a stuck drone.
 */
var HAudio = (typeof HAudio === 'object' && HAudio && HAudio.__isHAudio) ? HAudio : (function () {
  'use strict';

  /* ================================================================ basics */
  var S = null;            // per-AudioContext state (rebuilt if AudioSys.ctx changes)
  var timer = null;        // housekeeping + music scheduler (setInterval 25 ms)
  var manual = false;      // test hook: tick() is driven by hand (OfflineAudioContext renders)
  var lastSfx = {};
  var pendingI = 0;        // music intensity requested before the context existed
  var TAU = Math.PI * 2;
  // mix levels (calibrated against chapter 1's score/SFX through AudioSys's compressor + limiter)
  var LV = { engine: 0.28, road: 0.55, siren: 0.6 };
  // per-SFX trims (measured peak targets: UI ~-16 dBFS, gameplay ~-8, big stings ~-3 after the limiter)
  var TRIM = { beep: 2.6, hackOk: 3.2, hackFail: 1.4, checkpoint: 2.8, ui: 3, type: 7, coin: 4, whoosh: 4, riser: 3.2, starDown: 2.8,
    horn: 2.4, scrape: 2.2, cash: 1.8, bigCash: 1.7, busted: 0.75, wasted: 0.75, heistComplete: 0.78, missionComplete: 0.78 };

  function AS() { return (typeof AudioSys !== 'undefined') ? AudioSys : null; }
  function num(x, d) { x = +x; return (x === x && isFinite(x)) ? x : d; }      // NaN/undefined safe
  function clamp(x, a, b) { x = num(x, a); return x < a ? a : x > b ? b : x; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function seeded(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  // smooth parameter move; ignores non-finite targets (setTargetAtTime throws on them)
  function glide(p, v, t, tc) { if (isFinite(v)) p.setTargetAtTime(v, t, tc > 0.0005 ? tc : 0.0005); }
  // freeze a param at its current value so new automation can start at t (works without cancelAndHoldAtTime)
  function holdAt(p, t) {
    if (p.cancelAndHoldAtTime) { try { p.cancelAndHoldAtTime(t); return; } catch (e) {} }
    var v = p.value; p.cancelScheduledValues(t); p.setValueAtTime(v, t);
  }

  function enabled() { var a = AS(); return !!(a && a.enabled); }
  function ready() {
    var a = AS();
    if (!a || !a.ctx || !a.sfxBus || !a.musicBus) return false;
    if (!a.live()) return false;
    if (!S || S.ctx !== a.ctx) build(a);
    return !!S;
  }
  function now() { return S.ctx.currentTime; }

  /* ---------------------------------------------------------------- buffers & waves */
  function noiseBuf(c, secs, kind, chans) {
    var len = Math.floor(c.sampleRate * secs), b = c.createBuffer(chans, len, c.sampleRate);
    for (var ch = 0; ch < chans; ch++) {
      var d = b.getChannelData(ch), b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0, peak = 0, i, w;
      for (i = 0; i < len; i++) {
        w = Math.random() * 2 - 1;
        if (kind === 'pink') {          // Paul Kellet's pink filter
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926;
        } else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last; }
        else d[i] = w;
        if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]);
      }
      var k = 0.95 / (peak || 1); for (i = 0; i < len; i++) d[i] *= k;
      // seamless loop: crossfade the last 20 ms into the start
      var xf = Math.floor(c.sampleRate * 0.02);
      for (i = 0; i < xf; i++) { var u = i / xf; d[len - xf + i] = d[len - xf + i] * (1 - u) + d[i] * u; }
    }
    return b;
  }
  // band-limited, perfectly periodic random wobble (1..30 Hz) for engine jitter / squeal flutter.
  // computed at 1 kHz (phasor recurrence, no per-sample trig) and linearly interpolated: ~2 ms instead of ~200
  function smoothBuf(c) {
    var secs = 4, len = Math.floor(c.sampleRate * secs), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0), r = seeded(99);
    var CP = 4000, cp = new Float32Array(CP + 1), k, i, peak = 0;
    for (k = 4; k <= 120; k += 1 + ((r() * 2) | 0)) {
      var amp = 1 / Math.sqrt(k), ph = r() * TAU, cr = Math.cos(ph), ci = Math.sin(ph), wr = Math.cos(TAU * k / CP), wi = Math.sin(TAU * k / CP);
      for (i = 0; i < CP; i++) { cp[i] += amp * ci; var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; }
    }
    cp[CP] = cp[0];
    for (i = 0; i < CP; i++) if (Math.abs(cp[i]) > peak) peak = Math.abs(cp[i]);
    var step = CP / len;
    for (i = 0; i < len; i++) { var x = i * step, j = x | 0, u = x - j; d[i] = (cp[j] * (1 - u) + cp[j + 1] * u) / peak; }
    return b;
  }
  // stereo impulse response: early reflections + exponentially decaying, darkening noise tail
  function irBuf(c, secs, rt60, pre, bright) {
    var sr = c.sampleRate, len = Math.floor(sr * secs), b = c.createBuffer(2, len, sr), p0 = Math.floor(sr * pre);
    var dec = Math.exp(-6.9 / (rt60 * sr)), dk = Math.exp(-2.2 / sr), fade = Math.floor(sr * 0.05);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), lp = 0, r = seeded(17 + ch * 31), env = 1, kk = bright;
      for (var i = p0; i < len; i++) {
        lp += ((r() * 2 - 1) - lp) * (kk + 0.04);          // gets darker as it decays
        d[i] = lp * env * (i > len - fade ? (len - i) / fade : 1);
        env *= dec; kk *= dk;
      }
      for (var e = 0; e < 7; e++) { var at = p0 + Math.floor(sr * (0.006 + r() * 0.07)); if (at < len) d[at] += (r() < 0.5 ? -1 : 1) * (0.5 - e * 0.05); }
    }
    return b;
  }
  // one engine cycle (720 deg of crank) of a flat-12: 12 exhaust pulses, two banks that differ a little,
  // per-cylinder variation -> energy at the half-firing order gives the V8-ish growl on top of the smooth wail
  function engineWave(c) {
    var N = 2048, H = 200, x = new Float32Array(N), r = seeded(1234), cyl = 12, wid = 0.30 / cyl, k, i, h;
    for (k = 0; k < cyl; k++) {
      var amp = ((k & 1) ? 0.74 : 1) * (0.86 + 0.28 * r()), pos = (k + (r() - 0.5) * 0.12) / cyl;
      var i0 = Math.floor(pos * N), span = Math.ceil(wid * 2.4 * N) + 2;
      for (var q = 0; q < span; q++) {
        i = (i0 + q) % N;
        var dd = i / N - pos; dd -= Math.floor(dd); var u = dd / wid;
        if (u < 1) { var sn = Math.sin(Math.PI * Math.pow(u, 0.6)); x[i] += amp * sn * sn; }
        else if (u < 2.4) x[i] -= amp * 0.3 * Math.sin(Math.PI * (u - 1) / 1.4);
      }
    }
    var re = new Float32Array(H + 1), im = new Float32Array(H + 1);
    for (h = 1; h <= H; h++) {      // DFT bin h via phasor recurrence
      var sr = 0, si = 0, cr = 1, ci = 0, wr = Math.cos(TAU * h / N), wi = Math.sin(TAU * h / N);
      for (i = 0; i < N; i++) { sr += x[i] * cr; si += x[i] * ci; var nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; }
      re[h] = 2 * sr / N; im[h] = 2 * si / N;
    }
    return c.createPeriodicWave(re, im);
  }
  function oddWave(c, n, even, roll) {      // square-ish: siren speakers, alarms
    var re = new Float32Array(n + 1), im = new Float32Array(n + 1);
    for (var k = 1; k <= n; k++) im[k] = (k & 1) ? 1 / Math.pow(k, roll) : even / k;
    return c.createPeriodicWave(re, im);
  }
  function shapeCurve(drive, asym) {
    var n = 1024, cv = new Float32Array(n), norm = Math.tanh(drive);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; cv[i] = (Math.tanh(drive * (x + asym)) - Math.tanh(drive * asym)) / norm; }
    return cv;
  }

  /* ---------------------------------------------------------------- graph */
  function build(a) {
    hardReset();
    var c = a.ctx;
    S = { ctx: c, pn: 0, on: 0, voices: {}, tracks: [], cur: null, musI: pendingI, duck: false, reap: [], mfx: null, sfxVerb: null, echo: null, step: { ph: 0, last: -1, lr: 1 } };
    S.sfxOut = c.createGain(); S.sfxOut.connect(a.sfxBus);
    S.musOut = c.createGain();
    // AudioSys runs music through a 5.2 kHz lowpass (lo-fi for chapter 1); a shelf restores some synthwave air
    var shelf = c.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 3600; shelf.gain.value = 6;
    S.musOut.connect(shelf); shelf.connect(a.musicBus);
    S.contBus = c.createGain(); S.contBus.connect(S.sfxOut);
    S.pn = 4;
    newGen();
    S.white = noiseBuf(c, 2, 'white', 1);
    S.pink = noiseBuf(c, 3, 'pink', 2);
    S.brown = noiseBuf(c, 3, 'brown', 2);
    S.smooth = smoothBuf(c);
    S.wSiren = oddWave(c, 15, 0.12, 1.15);
    S.wSoft = oddWave(c, 9, 0.3, 1.6);
    S.cSoft = shapeCurve(1.6, 0.06);
    S.cHard = shapeCurve(4, 0.12);
    S.hasPan = typeof c.createStereoPanner === 'function';
  }
  // one-shot "generation": stopAll swaps it so already-scheduled future notes go silent
  function newGen() {
    var c = S.ctx, g = { dry: c.createGain(), verb: c.createGain() };
    g.dry.connect(S.sfxOut); g.verb.gain.value = 1; g.verb.connect(sfxVerbIn());
    S.gen = g; S.pn += 2;
  }
  function sfxVerbIn() {
    if (S.sfxVerb) return S.sfxVerb.input;
    var c = S.ctx, v = S.sfxVerb = {};
    v.input = c.createGain();
    v.conv = c.createConvolver(); v.conv.buffer = S.irSfx || (S.irSfx = irBuf(c, 1.1, 0.95, 0.012, 0.55));
    v.ret = c.createGain(); v.ret.gain.value = 0.5;
    v.input.connect(v.conv); v.conv.connect(v.ret); v.ret.connect(S.sfxOut);
    S.pn += 3;
    return v.input;
  }
  // street slap-back for sirens / horns bouncing between the hotels
  function echoIn() {
    if (S.echo) return S.echo.input;
    var c = S.ctx, e = S.echo = {};
    e.input = c.createGain(); e.d = c.createDelay(1); e.d.delayTime.value = 0.14; e.fb = c.createGain(); e.fb.gain.value = 0.32;
    e.lp = c.createBiquadFilter(); e.lp.type = 'lowpass'; e.lp.frequency.value = 2200;
    e.out = c.createGain(); e.out.gain.value = 0.55;
    e.input.connect(e.d); e.d.connect(e.lp); e.lp.connect(e.fb); e.fb.connect(e.d); e.lp.connect(e.out); e.out.connect(S.sfxOut);
    S.pn += 5;
    return e.input;
  }
  function mkPan(c, p) {
    if (S.hasPan) { var n = c.createStereoPanner(); n.pan.value = clamp(p, -1, 1); return n; }
    var g = c.createGain(); g.pan = { value: 0, setTargetAtTime: function () {}, setValueAtTime: function () {}, linearRampToValueAtTime: function () {}, cancelScheduledValues: function () {} }; return g;
  }

  /* ---------------------------------------------------------------- one-shot primitives (counted, self-cleaning) */
  var OS_CAP = 72;
  function room(prio) { return S.on < (prio ? OS_CAP : OS_CAP * 0.55); }
  function finish(src, nodes) {
    var st = S, n = nodes.length; st.on += n;
    src.onended = function () { st.on -= n; for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) {} } };
  }
  function route(out, o, nodes) {
    var c = S.ctx, dest = o.dest || S.gen.dry, node = out;
    if (o.pan != null && o.pan !== 0) { var p = mkPan(c, o.pan); node.connect(p); node = p; nodes.push(p); }
    node.connect(dest);
    if (o.verb) { var s = c.createGain(); s.gain.value = o.verb; node.connect(s); s.connect(o.verbDest || S.gen.verb); nodes.push(s); }
    if (o.echo) { var e = c.createGain(); e.gain.value = o.echo; node.connect(e); e.connect(echoIn()); nodes.push(e); }
  }
  // envelope: linear attack a, optional hold, exponential decay over d
  function envelope(g, t, a, hold, d, v) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (hold) g.gain.setValueAtTime(v, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0005, t + a + hold + d);
    g.gain.linearRampToValueAtTime(0, t + a + hold + d + 0.01);
    return t + a + hold + d + 0.03;
  }
  function filt(c, f) {
    var n = c.createBiquadFilter(); n.type = f.type || 'lowpass'; n.frequency.value = f.f; n.Q.value = f.q != null ? f.q : 0.7;
    if (f.g != null) n.gain.value = f.g;
    return n;
  }
  // o: t, f, f1, sweep, type|wave, det, a, hold, d, v, flt{type,f,f1,q,dur}, dest, pan, verb, echo
  function tone(o) {
    var c = S.ctx, t = o.t != null ? o.t : now(), src = c.createOscillator(), g = c.createGain(), nodes = [src, g], head = src;
    if (o.wave) src.setPeriodicWave(o.wave); else src.type = o.type || 'sine';
    src.frequency.setValueAtTime(o.f, t);
    if (o.f1 != null && o.f1 !== o.f) {
      if (o.lin) src.frequency.linearRampToValueAtTime(o.f1, t + (o.sweep || o.d));
      else src.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + (o.sweep || o.d));
    }
    if (o.det) src.detune.value = o.det;
    if (o.flt) {
      var f = filt(c, o.flt); nodes.push(f);
      if (o.flt.f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.flt.f1), t + (o.flt.dur || o.d));
      src.connect(f); head = f;
    }
    head.connect(g);
    var end = envelope(g, t, o.a || 0.004, o.hold || 0, o.d || 0.2, o.v);
    route(g, o, nodes);
    src.start(t); src.stop(end); finish(src, nodes);
    return g;
  }
  // o: t, buf, rate, rate1, a, hold, d, v, flt{...}, flt2{...}, dest, pan, verb, echo
  function noise(o) {
    var c = S.ctx, t = o.t != null ? o.t : now(), src = c.createBufferSource(), g = c.createGain(), nodes = [src, g], head = src;
    src.buffer = o.buf || S.white; src.loop = true;
    src.playbackRate.setValueAtTime(o.rate || 1, t);
    if (o.rate1) src.playbackRate.exponentialRampToValueAtTime(o.rate1, t + (o.d || 0.2));
    var fl = [o.flt, o.flt2];
    for (var i = 0; i < 2; i++) {
      if (!fl[i]) continue;
      var f = filt(c, fl[i]); nodes.push(f);
      if (fl[i].f1 != null) {
        if (fl[i].lin) f.frequency.linearRampToValueAtTime(fl[i].f1, t + (fl[i].dur || o.d));
        else f.frequency.exponentialRampToValueAtTime(Math.max(20, fl[i].f1), t + (fl[i].dur || o.d));
      }
      head.connect(f); head = f;
    }
    head.connect(g);
    var end = envelope(g, t, o.a || 0.002, o.hold || 0, o.d || 0.2, o.v);
    route(g, o, nodes);
    src.start(t, Math.random() * 1.5); src.stop(end); finish(src, nodes);
    return g;
  }
  // inharmonic struck metal / bell: a few sine partials
  function bell(t, f, partials, d, v, o) {
    o = o || {};
    for (var i = 0; i < partials.length; i++) {
      var p = partials[i];
      tone({ t: t, f: f * p[0], d: d * p[2], a: 0.002, v: v * p[1], dest: o.dest, pan: o.pan, verb: o.verb, echo: o.echo });
    }
  }
  // short polyphonic synth-brass chord for stings: detuned saws through an opening lowpass
  function brass(t, notes, dur, v, o) {
    o = o || {};
    var c = S.ctx, lp = c.createBiquadFilter(), g = c.createGain(), nodes = [lp, g], srcs = [];
    lp.type = 'lowpass'; lp.Q.value = o.q || 1.2;
    var f0 = o.cut0 || 500, f1 = o.cut1 || 3200;
    lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(f1, t + (o.open || 0.08));
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, o.cutEnd || f0 * 1.4), t + dur);
    notes.forEach(function (m, i) {
      for (var k = -1; k <= 1; k += 2) {
        var s = c.createOscillator(); s.type = o.type || 'sawtooth'; s.frequency.value = mtof(m); s.detune.value = k * (o.spread || 9) + (i - 1.5) * 2;
        if (o.bend) s.detune.linearRampToValueAtTime(s.detune.value + o.bend, t + dur);
        s.connect(lp); srcs.push(s); nodes.push(s);
      }
    });
    lp.connect(g);
    var end = envelope(g, t, o.a || 0.012, o.hold != null ? o.hold : dur * 0.35, dur * 0.65, v / Math.sqrt(notes.length * 2));
    route(g, o, nodes);
    srcs.forEach(function (s) { s.start(t); s.stop(end); });
    finish(srcs[0], nodes);
  }

  /* ================================================================ continuous voices */
  function V(name) {
    var v = { name: name, nodes: [], srcs: [], dead: false, seen: now(), killAt: 0 };
    S.voices[name] = v; wake(); return v;
  }
  function vn(v, node) { v.nodes.push(node); S.pn++; return node; }
  function vg(v, val, dest) { var g = vn(v, S.ctx.createGain()); g.gain.value = val; if (dest) g.connect(dest); return g; }
  function vf(v, type, f, q, dest) { var n = vn(v, S.ctx.createBiquadFilter()); n.type = type; n.frequency.value = f; n.Q.value = q; if (dest) n.connect(dest); return n; }
  function vo(v, type, f, dest) {
    var o = vn(v, S.ctx.createOscillator()); if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.value = f; if (dest) o.connect(dest); v.srcs.push(o); return o;
  }
  function vnoise(v, buf, rate, dest) {
    var s = vn(v, S.ctx.createBufferSource()); s.buffer = buf; s.loop = true; s.playbackRate.value = rate || 1;
    if (dest) s.connect(dest); s._off = Math.random() * (buf.duration - 0.1); v.srcs.push(s); return s;
  }
  function vstart(v, t) { v.srcs.forEach(function (s) { s.start(t, s._off || 0); }); }
  function vkill(v) {
    if (!v || v.dead) return;
    v.dead = true;
    v.srcs.forEach(function (s) { try { s.stop(); } catch (e) {} });
    v.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
    S.pn -= v.nodes.length; v.nodes = []; v.srcs = [];
    if (S.voices[v.name] === v) delete S.voices[v.name];
  }
  // fade a voice's master gain to 0 and tear it down if it stays silent
  function vrelease(v, t, tc, after) { glide(v.out.gain, 0, t, tc); if (v.road) glide(v.road.gain, 0, t, tc); v.on = false; if (!v.killAt) v.killAt = t + (after || 1.2); }

  /* ---------------------------------------------------------------- engine */
  function engineBuild() {
    var v = V('engine'), c = S.ctx;
    v.out = vg(v, 0, S.contBus);               // on/off fade (to LV.engine)
    v.shift = vg(v, 1, v.out);                 // ignition-cut dips on upshift, rev limiter
    // exhaust core: pulse-train oscillator -> drive -> soft clip -> roughness AM -> tracking lowpass -> pipe resonances
    if (!S.wEngine) S.wEngine = engineWave(c);
    v.osc = vo(v, S.wEngine, 800 / 120);
    v.drive = vg(v, 1); v.osc.connect(v.drive);
    v.shaper = vn(v, c.createWaveShaper()); v.shaper.curve = S.cSoft; v.shaper.oversample = '2x'; v.drive.connect(v.shaper);
    v.am = vg(v, 1); v.shaper.connect(v.am);
    v.lp = vf(v, 'lowpass', 1200, 0.8); v.am.connect(v.lp);
    v.pk1 = vf(v, 'peaking', 150, 0.9); v.pk1.gain.value = 5; v.lp.connect(v.pk1);
    v.pk2 = vf(v, 'peaking', 560, 1.6); v.pk2.gain.value = 4; v.pk1.connect(v.pk2);
    v.ex = vg(v, 0.3, v.shift); v.pk2.connect(v.ex);
    // second exhaust bank, an octave of growl below the firing order
    v.sub = vo(v, 'triangle', 40); v.subG = vg(v, 0.2, v.shift); v.sub.connect(v.subG);
    // combustion jitter (pitch + amplitude), periodic band-limited random
    v.jit = vnoise(v, S.smooth, 1); v.jitP = vg(v, 12); v.jit.connect(v.jitP); v.jitP.connect(v.osc.detune); v.jitP.connect(v.sub.detune);
    v.jitA = vg(v, 0.1); v.jit.connect(v.jitA); v.jitA.connect(v.am.gain);
    // induction roar: pink noise through a resonant band that tracks rpm
    v.nz = vnoise(v, S.pink, 1);
    v.inBp = vf(v, 'bandpass', 600, 3.5); v.nz.connect(v.inBp); v.inG = vg(v, 0, v.shift); v.inBp.connect(v.inG);
    // road: tyre rumble, wet-asphalt spray hiss and wind - independent of the engine being on
    v.road = vg(v, LV.road, S.contBus);
    v.tyBp = vf(v, 'bandpass', 300, 1.1); v.nz.connect(v.tyBp); v.tyG = vg(v, 0, v.road); v.tyBp.connect(v.tyG);
    v.wetHp = vf(v, 'highpass', 2400, 0.6); v.nz.connect(v.wetHp); v.wetG = vg(v, 0, v.road); v.wetHp.connect(v.wetG);
    v.wBp = vf(v, 'bandpass', 700, 0.5); v.nz.connect(v.wBp); v.wG = vg(v, 0, v.road); v.wBp.connect(v.wG);
    vstart(v, now());
    v.gear = null; v.thr = 0; v.rpm = 800; v.on = false; v.override = 0; v.popT = 0;
    return v;
  }
  function enginePop(t, big) {
    noise({ t: t, d: big ? 0.07 : 0.04, a: 0.001, v: big ? 0.5 : rnd(0.18, 0.34), flt: { type: 'bandpass', f: rnd(700, 1800), q: 0.9 }, verb: 0.15, echo: 0.2 });
    tone({ t: t, f: rnd(80, 120), f1: 40, d: 0.06, a: 0.001, v: big ? 0.45 : 0.25 });
  }
  function gearClunk(t, v) {      // gated-shifter clack + driveline thunk
    noise({ t: t, d: 0.018, a: 0.001, v: 0.12 * v, flt: { type: 'bandpass', f: 2400, q: 3 } });
    tone({ t: t + 0.004, f: 120, f1: 70, d: 0.06, a: 0.002, v: 0.22 * v });
  }
  function engine(p) {
    if (!ready()) return;
    p = p || {};
    var v = S.voices.engine, t = now();
    var on = !!p.on && enabled(), rpm = clamp(p.rpm != null ? p.rpm : 800, 300, 9000), thr = clamp(p.throttle, 0, 1), spd = Math.abs(num(p.speed, 0));
    var gear = p.gear != null ? (p.gear | 0) : null;
    if (!v) { if (!on && spd < 0.5) return; v = engineBuild(); }
    v.seen = t;
    if (on || (spd >= 0.5 && enabled())) v.killAt = 0; else if (!v.killAt) v.killAt = t + 1.5;
    if (t < v.override) { v.on = on; v.rpm = rpm; v.thr = thr; v.gear = gear; return; }
    var r = rpm / 7500;
    // road noise (rainy streets) even when coasting with the engine off
    var sp = Math.min(1, spd / 40);
    glide(v.tyBp.frequency, 180 + spd * 9, t, 0.08);
    glide(v.road.gain, LV.road, t, 0.05);
    glide(v.tyG.gain, enabled() ? sp * 0.22 : 0, t, 0.08);
    glide(v.wetHp.frequency, 2000 + spd * 25, t, 0.1);
    glide(v.wetG.gain, enabled() ? Math.min(1, spd / 25) * 0.075 : 0, t, 0.1);
    glide(v.wBp.frequency, 500 + spd * 14, t, 0.15);
    glide(v.wG.gain, enabled() ? Math.min(0.32, Math.pow(spd / 60, 2) * 0.22) : 0, t, 0.15);
    if (!on) {
      if (v.on) { // shut down: revs sag as it dies
        glide(v.osc.frequency, 260 / 120, t, 0.25); glide(v.sub.frequency, 260 / 20, t, 0.25);
      }
      v.on = false;
      glide(v.out.gain, 0, t, 0.12);
      return;
    }
    if (!v.on) glide(v.out.gain, LV.engine, t, 0.05);
    v.on = true;
    var tc = rpm >= v.rpm ? 0.03 : 0.07;     // revs fall a bit slower than they climb (flywheel inertia)
    glide(v.osc.frequency, rpm / 120, t, tc);
    glide(v.sub.frequency, rpm / 20, t, tc);
    glide(v.drive.gain, 0.9 + thr * 2.6 + r * 0.8, t, 0.05);
    glide(v.am.gain, 1, t, 0.05);
    glide(v.jitP.gain, 4 + 20 * (1 - Math.min(1, r)) * (0.6 + 0.4 * thr), t, 0.1);
    glide(v.jitA.gain, 0.06 + 0.22 * thr, t, 0.1);
    glide(v.lp.frequency, 380 + rpm * 0.42 + thr * (500 + rpm * 0.38), t, 0.05);
    glide(v.ex.gain, 0.16 + 0.26 * thr + 0.12 * Math.min(1, r), t, 0.04);
    glide(v.subG.gain, (0.16 + 0.12 * thr) * Math.max(0.25, 1 - r * 0.8), t, 0.05);
    glide(v.inBp.frequency, Math.min(5000, rpm / 10 * 2.4 + 200), t, 0.04);
    glide(v.inG.gain, thr * (0.05 + 0.1 * Math.min(1, r)), t, 0.05);
    // rev limiter bounce
    if (rpm > 7350 && thr > 0.7) glide(v.shift.gain, (Math.floor(t * 15) & 1) ? 0.45 : 1, t, 0.006);
    else if (t > v.shiftUntil || !v.shiftUntil) glide(v.shift.gain, 1, t, 0.02);
    // gear change: ignition cut on upshift, burble on downshift
    if (gear != null && v.gear != null && gear !== v.gear && gear > 0 && v.gear > 0) {
      if (gear > v.gear) {
        v.shift.gain.cancelScheduledValues(t);
        glide(v.shift.gain, 0.3, t, 0.008); glide(v.shift.gain, 1, t + 0.08, 0.035); v.shiftUntil = t + 0.2;
        if (thr > 0.4 && Math.random() < 0.7) enginePop(t + 0.03, true);
      } else { for (var i = 0; i < 3; i++) enginePop(t + 0.04 + i * rnd(0.05, 0.09), false); }
      gearClunk(t, 0.6);
    }
    v.gear = gear;
    // overrun crackle: lift off the throttle at high revs
    if (v.thr > 0.55 && thr < 0.2 && rpm > 3200 && room()) {
      var n = 2 + ((Math.random() * 4) | 0), tt = t + 0.05;
      for (var k = 0; k < n; k++) { tt += rnd(0.04, 0.14); enginePop(tt, false); }
    } else if (thr < 0.15 && rpm > 4200 && t > v.popT && Math.random() < 0.03 && room()) { enginePop(t, false); v.popT = t + 0.08; }
    v.thr = thr; v.rpm = rpm;
  }
  function engineStart() {
    var v = S.voices.engine || engineBuild(), t = now();
    // starter motor: geared whirr, chopped by the compression strokes
    var c = S.ctx, st = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), am = c.createOscillator(), amg = c.createGain();
    st.type = 'sawtooth'; st.frequency.setValueAtTime(70, t); st.frequency.linearRampToValueAtTime(110, t + 0.5);
    lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 2;
    am.type = 'square'; am.frequency.setValueAtTime(8, t); am.frequency.linearRampToValueAtTime(13, t + 0.5); amg.gain.value = 0.11;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.13, t + 0.03); g.gain.setValueAtTime(0.13, t + 0.5); g.gain.linearRampToValueAtTime(0, t + 0.62);
    am.connect(amg); amg.connect(g.gain); st.connect(lp); lp.connect(g); g.connect(S.gen.dry);
    st.start(t); am.start(t); st.stop(t + 0.65); am.stop(t + 0.65); finish(st, [st, lp, g, am, amg]);
    // catch: the flat-12 barks to 4000 rpm and settles to idle
    var tc = t + 0.55, o = v.osc.frequency, s = v.sub.frequency;
    [o, s, v.out.gain, v.lp.frequency, v.drive.gain, v.ex.gain, v.shift.gain].forEach(function (p) { holdAt(p, t); });
    v.out.gain.linearRampToValueAtTime(0, t + 0.03); v.out.gain.setValueAtTime(0, tc - 0.01); v.out.gain.linearRampToValueAtTime(LV.engine, tc + 0.02);
    v.shift.gain.linearRampToValueAtTime(1, t + 0.03);
    o.setValueAtTime(350 / 120, tc); o.exponentialRampToValueAtTime(4200 / 120, tc + 0.2); o.setTargetAtTime(950 / 120, tc + 0.22, 0.28);
    s.setValueAtTime(350 / 20, tc); s.exponentialRampToValueAtTime(4200 / 20, tc + 0.2); s.setTargetAtTime(950 / 20, tc + 0.22, 0.28);
    v.lp.frequency.setValueAtTime(900, tc); v.lp.frequency.linearRampToValueAtTime(3800, tc + 0.2); v.lp.frequency.setTargetAtTime(900, tc + 0.22, 0.3);
    v.drive.gain.setValueAtTime(3.5, tc); v.drive.gain.setTargetAtTime(1.2, tc + 0.25, 0.3);
    v.ex.gain.setValueAtTime(0.42, tc); v.ex.gain.setTargetAtTime(0.2, tc + 0.25, 0.3);
    enginePop(tc + 0.21, true);
    v.override = tc + 1.1; v.on = true; v.killAt = 0; v.seen = tc + 1.1; v.thr = 0; v.rpm = 950;
  }

  /* ---------------------------------------------------------------- tyre screech */
  function skidBuild() {
    var v = V('skid');
    v.out = vg(v, 0, S.contBus);
    v.flut = vg(v, 1, v.out);                                         // stick-slip flutter (AM target)
    // the squeal: two rubber "voices" whose pitch wobbles fast, through a resonant band
    v.sq = vo(v, 'sawtooth', 1050); v.sq2 = vo(v, 'sawtooth', 1050 * 1.49);
    v.sqBp = vf(v, 'bandpass', 1900, 2.2); v.sq.connect(v.sqBp); v.sq2G = vg(v, 0.5, v.sqBp); v.sq2.connect(v.sq2G);
    v.sqG = vg(v, 0.42, v.flut); v.sqBp.connect(v.sqG);
    // rubber-on-asphalt hiss
    v.nz = vnoise(v, S.white, 1);
    v.bp1 = vf(v, 'bandpass', 1500, 5); v.nz.connect(v.bp1); v.g1 = vg(v, 0.7, v.flut); v.bp1.connect(v.g1);
    v.wob = vnoise(v, S.smooth, 7); v.wobP = vg(v, 120); v.wob.connect(v.wobP); v.wobP.connect(v.sq.detune); v.wobP.connect(v.sq2.detune);
    v.wobA = vg(v, 0.4); v.wob.connect(v.wobA); v.wobA.connect(v.flut.gain);
    vstart(v, now());
    return v;
  }
  function skid(amount) {
    if (!ready()) return;
    var a = enabled() ? clamp(amount, 0, 1) : 0, v = S.voices.skid, t = now();
    if (!v) { if (a < 0.02) return; v = skidBuild(); }
    v.seen = t;
    if (a < 0.02) { if (!v.killAt) vrelease(v, t, 0.05, 1.5); return; }
    v.killAt = 0;
    glide(v.out.gain, Math.pow(a, 1.1) * 0.5, t, 0.035);
    glide(v.sq.frequency, 880 + a * 420, t, 0.06); glide(v.sq2.frequency, (880 + a * 420) * 1.49, t, 0.06);
    glide(v.sqBp.frequency, 1500 + a * 900, t, 0.06);
    glide(v.bp1.frequency, 1200 + a * 600, t, 0.06);
  }

  /* ---------------------------------------------------------------- police siren (US wail / yelp) */
  function sirenBuild() {
    var v = V('siren'), c = S.ctx;
    v.out = vg(v, 0); v.pan = vn(v, mkPan(c, 0)); v.out.connect(v.pan); v.pan.connect(S.contBus);
    v.lp = vf(v, 'lowpass', 4000, 0.7, v.out);
    v.horn = vf(v, 'peaking', 1400, 1.2, v.lp); v.horn.gain.value = 5;
    v.shape = vn(v, c.createWaveShaper()); v.shape.curve = S.cSoft; v.shape.connect(v.horn);
    v.o1 = vo(v, S.wSiren, 700); v.g1 = vg(v, 0.55, v.shape); v.o1.connect(v.g1);
    v.o2 = vo(v, S.wSiren, 700 * 1.012); v.g2 = vg(v, 0.3, v.shape); v.o2.connect(v.g2);
    v.echo = vg(v, 0.3); v.out.connect(v.echo); v.echo.connect(echoIn());
    v.next = now() + 0.02; v.mode = 'wail'; v.left = 2; v.lo = 640; v.hi = 1460;
    v.o1.frequency.setValueAtTime(v.lo, v.next); v.o2.frequency.setValueAtTime(v.lo * 1.012, v.next);
    vstart(v, now());
    return v;
  }
  function sirenSchedule(t) {
    var v = S.voices.siren; if (!v || v.dead || v.killAt) return;
    while (v.next < t + 0.3) {
      if (v.left <= 0) {
        if (v.force) v.mode = v.force;
        else if (v.mode === 'wail') v.mode = Math.random() < 0.75 ? 'yelp' : 'wail';
        else v.mode = Math.random() < 0.8 ? 'wail' : 'yelp';
        v.left = v.mode === 'wail' ? 1 + ((Math.random() * 2) | 0) : 10 + ((Math.random() * 10) | 0);
      }
      var up = v.mode === 'wail' ? 1.75 : 0.12, dn = v.mode === 'wail' ? 2.35 : 0.16, t0 = v.next;
      [[v.o1, 1], [v.o2, 1.012]].forEach(function (oo) {
        var f = oo[0].frequency;
        f.setValueAtTime(v.lo * oo[1], t0);
        f.exponentialRampToValueAtTime(v.hi * oo[1], t0 + up);
        f.linearRampToValueAtTime(v.lo * oo[1], t0 + up + dn);
      });
      v.next = t0 + up + dn; v.left--;
    }
  }
  function siren(level, pan, pitch, opts) {
    if (!ready()) return;
    var l = enabled() ? clamp(level, 0, 1) : 0, v = S.voices.siren, t = now();
    if (!v) { if (l < 0.01) return; v = sirenBuild(); }
    v.seen = t;
    v.force = opts && (opts.mode === 'wail' || opts.mode === 'yelp') ? opts.mode : null;
    if (l < 0.01) { if (!v.killAt) vrelease(v, t, 0.15, 2); return; }
    if (v.killAt) {                     // revived while fading: resync the sweep pattern
      v.killAt = 0;
      if (v.next < t) { [v.o1, v.o2].forEach(function (o) { holdAt(o.frequency, t); }); v.next = t + 0.01; v.left = 0; }
    }
    var pt = clamp(pitch != null ? pitch : 1, 0.5, 2), cents = 1200 * Math.log(pt) / Math.LN2;
    glide(v.out.gain, (l * l * 0.36 + l * 0.04) * LV.siren, t, 0.05);
    glide(v.pan.pan, clamp(pan, -1, 1) * 0.85, t, 0.05);
    glide(v.o1.detune, cents, t, 0.05); glide(v.o2.detune, cents, t, 0.05);
    glide(v.lp.frequency, 1600 + l * l * 6000, t, 0.08);                  // distance: air soaks up the highs
    glide(v.echo.gain, 0.18 + (1 - l) * 0.5, t, 0.1);                       // ...and more of it is reflections
  }

  /* ---------------------------------------------------------------- night city ambience */
  function ambBuild() {
    var v = V('amb');
    v.out = vg(v, 0, S.contBus);
    v.nb = vnoise(v, S.brown, 0.9);
    v.tBp = vf(v, 'bandpass', 230, 0.7); v.nb.connect(v.tBp); v.tG = vg(v, 0.32, v.out); v.tBp.connect(v.tG);       // distant traffic wash
    v.np = vnoise(v, S.pink, 1);
    v.rHp = vf(v, 'highpass', 3200, 0.5); v.np.connect(v.rHp); v.rG = vg(v, 0.15, v.out); v.rHp.connect(v.rG);     // light rain hiss
    v.wBp = vf(v, 'bandpass', 520, 0.9); v.np.connect(v.wBp); v.wG = vg(v, 0.06, v.out); v.wBp.connect(v.wG);      // wind between the towers
    v.lfo = vo(v, 'sine', 0.07); v.lfoF = vg(v, 260); v.lfo.connect(v.lfoF); v.lfoF.connect(v.wBp.frequency);
    v.lfoA = vg(v, 0.1); v.lfo.connect(v.lfoA); v.lfoA.connect(v.tG.gain);
    vstart(v, now());
    v.level = 0; v.rain = 1; v.club = 0; v.next = now() + rnd(2, 4); v.drip = now() + 0.3; v.beat = 0; v.bs = 0;
    return v;
  }
  // level 0..1; opts: { rain 0..1 (default 1), wind 0..1 (0.6), club 0..1 (0: a muffled beat from a hotel party) }
  function ambience(level, opts) {
    if (!ready()) return;
    var l = enabled() ? clamp(level, 0, 1) : 0, v = S.voices.amb, t = now();
    if (!v) { if (l < 0.01) return; v = ambBuild(); }
    v.seen = t;
    if (l < 0.01) { if (!v.killAt) vrelease(v, t, 0.4, 3); v.level = 0; return; }
    v.killAt = 0; v.level = l;
    opts = opts || {};
    v.rain = clamp(opts.rain != null ? opts.rain : 1, 0, 1);
    v.club = clamp(opts.club, 0, 1);
    var wind = clamp(opts.wind != null ? opts.wind : 0.6, 0, 1);
    glide(v.out.gain, l * 0.6, t, 0.4);
    glide(v.rG.gain, 0.03 + v.rain * 0.2, t, 0.5);
    glide(v.wG.gain, 0.02 + wind * 0.09, t, 0.5);
  }
  // sparse life in the distance: horns, a far siren, a car hissing past, thunder; rain ticking on metal; a party bassline
  function ambEvents(t) {
    var v = S.voices.amb; if (!v || v.dead || v.level < 0.01 || !enabled()) return;
    var L = v.level;
    if (v.drip < t - 0.5) v.drip = t;
    while (v.drip < t + 0.1) {
      if (v.rain > 0.05 && room()) {
        if (Math.random() < 0.7) tone({ t: v.drip, f: rnd(2400, 5600), f1: rnd(1500, 2100), d: 0.02, a: 0.001, v: rnd(0.01, 0.035) * L * v.rain, pan: rnd(-0.9, 0.9) });
        else tone({ t: v.drip, f: rnd(1100, 1900), d: rnd(0.05, 0.12), a: 0.001, v: rnd(0.008, 0.02) * L * v.rain, pan: rnd(-0.9, 0.9), verb: 0.3 });   // plink on a car roof
      }
      v.drip += rnd(0.05, 0.3) / Math.max(0.2, v.rain);
    }
    if (v.club > 0.01) {                       // four-on-the-floor through three walls, 122 bpm
      var bt = 60 / 122;
      if (v.beat < t - 0.3) v.beat = t + 0.05;
      while (v.beat < t + 0.12) {
        tone({ t: v.beat, f: 95, f1: 45, d: 0.22, a: 0.003, v: 0.22 * v.club * L, flt: { type: 'lowpass', f: 170 } });
        var bn = [33, 33, 40, 38][(v.bs >> 2) & 3];
        tone({ t: v.beat + bt / 2, type: 'triangle', f: mtof(bn + 12), d: bt * 0.45, a: 0.01, v: 0.12 * v.club * L, flt: { type: 'lowpass', f: 240 } });
        v.beat += bt; v.bs++;
      }
    }
    if (t < v.next) return;
    v.next = t + rnd(4, 10);
    if (!room()) return;
    var e = Math.random(), p = rnd(-0.8, 0.8);
    if (e < 0.28) {                // distant honk, bouncing off the hotels
      var f = rnd(330, 440), n = 1 + ((Math.random() * 2) | 0);
      for (var i = 0; i < n; i++) {
        var tt = t + i * rnd(0.3, 0.45);
        tone({ t: tt, wave: S.wSoft, f: f, d: 0.2, hold: 0.14, a: 0.02, v: 0.05 * L, flt: { type: 'lowpass', f: 1200 }, pan: p, verb: 0.9, echo: 0.3 });
        tone({ t: tt, wave: S.wSoft, f: f * 1.26, d: 0.2, hold: 0.14, a: 0.02, v: 0.035 * L, flt: { type: 'lowpass', f: 1200 }, pan: p, verb: 0.9 });
      }
    } else if (e < 0.5) {          // a far-off siren wail
      tone({ t: t, wave: S.wSiren, f: 640, f1: 1350, sweep: 1.7, d: 2.4, a: 0.5, v: 0.03 * L, flt: { type: 'lowpass', f: 1600 }, pan: p, verb: 1, echo: 0.4 });
    } else if (e < 0.85) {         // a car hissing by on the wet road
      noise({ t: t, buf: S.pink, d: 1.5, a: 1.0, v: 0.16 * L, flt: { type: 'bandpass', f: 500, f1: 2200, q: 0.8, dur: 1 }, flt2: { type: 'lowpass', f: 4000 }, pan: p, verb: 0.3 });
      tone({ t: t + 0.4, f: rnd(70, 95), f1: rnd(50, 60), d: 1.3, a: 0.5, v: 0.06 * L, pan: p });
    } else if (v.rain > 0.3) {     // thunder rolling in over the bay
      noise({ t: t, buf: S.brown, d: 3.5, a: 0.3, v: 0.45 * L, flt: { type: 'lowpass', f: 260, f1: 90, dur: 3 }, verb: 0.6 });
      noise({ t: t + 0.12, buf: S.brown, d: 1.2, a: 0.05, v: 0.3 * L, flt: { type: 'lowpass', f: 600 }, verb: 0.6, pan: p });
    }
  }

  /* ---------------------------------------------------------------- vault alarm loop */
  function alarmStart(level) {
    var v = S.voices.alarm, c = S.ctx, t = now();
    if (v && !v.dead) { v.killAt = 0; glide(v.out.gain, level * 0.2, t, 0.05); return; }
    v = V('alarm');
    v.out = vg(v, 0, S.contBus);
    v.bp = vf(v, 'bandpass', 1300, 0.9, v.out);
    v.sh = vn(v, c.createWaveShaper()); v.sh.curve = S.cHard; v.sh.connect(v.bp);
    v.amp = vg(v, 0, v.sh);
    v.o = vo(v, 'square', 860, v.amp);
    // one sawtooth LFO drives the rising "whoop" sweep (560 -> 1160 Hz) and, through a shaper, the gap at each reset
    v.lfo = vo(v, 'sawtooth', 1.3); v.lfoG = vg(v, 300); v.lfo.connect(v.lfoG); v.lfoG.connect(v.o.frequency);
    var n = 256, cv = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; cv[i] = Math.min(1, (x + 1) / 0.12) * Math.min(1, (1 - x) / 0.08); }
    v.gate = vn(v, c.createWaveShaper()); v.gate.curve = cv; v.lfo.connect(v.gate); v.gate.connect(v.amp.gain);
    v.send = vg(v, 0.35); v.out.connect(v.send); v.send.connect(sfxVerbIn());
    vstart(v, t);
    glide(v.out.gain, clamp(level, 0, 1) * 0.2, t, 0.03);
    v.seen = t;
  }

  /* ---------------------------------------------------------------- footsteps */
  function step(o) {
    if (!ready() || !enabled()) return;
    o = o || {};
    if (!room()) return;
    var t = now(), sf = o.surface || 'wet', vol = clamp(o.vol != null ? o.vol : 1, 0, 2) * 1.6, st = S.step, p = (st.lr = -st.lr) * 0.12, k = rnd(0.9, 1.1);
    if (sf === 'carpet') {
      noise({ t: t, d: 0.07, a: 0.004, v: 0.16 * vol, flt: { type: 'lowpass', f: 700 * k }, pan: p });
      return;
    }
    var heel = { wet: 2300, marble: 3300, metal: 1900, concrete: 2600 }[sf] || 2300;
    tone({ t: t, f: 150 * k, f1: 70, d: 0.045, a: 0.002, v: 0.22 * vol, pan: p });                                       // weight
    noise({ t: t, d: sf === 'marble' ? 0.03 : 0.04, a: 0.001, v: 0.2 * vol, flt: { type: 'bandpass', f: heel * k, q: sf === 'metal' ? 5 : 1.4 }, pan: p, verb: sf === 'marble' ? 0.5 : sf === 'metal' ? 0.35 : 0.08 });
    if (sf === 'wet') noise({ t: t + 0.012, d: 0.09, a: 0.006, v: 0.05 * vol, flt: { type: 'highpass', f: 3200 * k }, pan: p });     // splash
    if (sf === 'metal') tone({ t: t, f: 620 * k, d: 0.14, a: 0.001, v: 0.04 * vol, pan: p, verb: 0.3 });
    if (sf !== 'wet') noise({ t: t + 0.09, d: 0.025, a: 0.001, v: 0.07 * vol, flt: { type: 'bandpass', f: heel * 1.3 * k, q: 2 }, pan: p });   // toe
  }
  // speed01: 0..1 walk->run. trigger === true plays a step now (animation-synced);
  // pass a boolean every frame to use only animation triggers, or leave it undefined to use the built-in cadence
  function footsteps(speed01, trigger, surface) {
    if (!ready()) return;
    var st = S.step, t = now(), s = clamp(speed01, 0, 1), dt = st.last < 0 ? 0 : Math.min(0.1, Math.max(0, t - st.last));
    st.last = t;
    var o = { surface: surface, vol: 0.55 + s * 0.6 };
    if (typeof trigger === 'boolean') { if (trigger) step(o); return; }
    if (s < 0.05) { st.ph = 0.9; return; }       // next step lands right away when walking starts
    st.ph += dt * (1.7 + 1.6 * s);
    if (st.ph >= 1) { st.ph -= Math.floor(st.ph); step(o); }
  }

  /* ================================================================ one-shot SFX */
  var GAP = { door: 0.15, engineStart: 0.8, crash: 0.09, scrape: 0.12, cash: 0.05, bigCash: 0.15, beep: 0.04, hackOk: 0.1, hackFail: 0.1,
    accessGranted: 0.3, star: 0.25, starDown: 0.25, busted: 1, wasted: 1, heistComplete: 1, missionComplete: 1, checkpoint: 0.15,
    horn: 0.12, whoosh: 0.1, splash: 0.2, land: 0.15, ui: 0.03, type: 0.03, pop: 0.03, coin: 0.03, shift: 0.08, vaultOpen: 1, riser: 0.5, impact: 0.12 };
  var LOWPRIO = { beep: 1, ui: 1, type: 1, coin: 1, pop: 1, whoosh: 1, scrape: 1 };

  function sfx(name, o) {
    if (!ready()) return;
    o = o || {};
    var t = now(), gap = GAP[name] || 0;
    // the alarm is a state, not a one-shot: start/stop it even while muted so unmuting stays consistent
    if (name === 'alarm') { alarmStart(o.level != null ? clamp(o.level, 0, 1) : 0.8); return; }
    if (name === 'alarmStop') { var al = S.voices.alarm; if (al) vrelease(al, t, 0.08, 0.6); return; }
    if (!enabled()) return;
    if (name === 'engineStart') { if (lastSfx[name] && t - lastSfx[name] < gap) return; lastSfx[name] = t; engineStart(); return; }
    var inten = clamp(o.intensity != null ? o.intensity : 0.7, 0, 1);
    if (gap && lastSfx[name] != null && t - lastSfx[name] < gap && t >= lastSfx[name]) {
      if (!(name === 'crash' && inten > (lastSfx._crashI || 0) + 0.25)) return;
    }
    if (!room(!LOWPRIO[name])) return;
    lastSfx[name] = t;
    if (name === 'crash') lastSfx._crashI = inten;
    var fn = SFX[name];
    if (fn) fn(t, o, inten, o.pan != null ? clamp(o.pan, -1, 1) : 0, (o.vol != null ? clamp(o.vol, 0, 2) : 1) * (TRIM[name] || 1));
  }

  var SFX = {
    door: function (t, o, I, p, vol) {
      if (o.open) {
        noise({ t: t, d: 0.03, a: 0.001, v: 0.3 * vol, flt: { type: 'bandpass', f: 2600, q: 2 }, pan: p });
        noise({ t: t + 0.05, d: 0.05, a: 0.001, v: 0.2 * vol, flt: { type: 'bandpass', f: 1500, q: 2 }, pan: p });
        tone({ t: t + 0.05, f: 140, f1: 90, d: 0.08, v: 0.25 * vol, pan: p });
        return;
      }
      noise({ t: t, d: 0.012, a: 0.001, v: 0.25 * vol, flt: { type: 'highpass', f: 2500 }, pan: p });            // latch
      tone({ t: t + 0.008, f: 95, f1: 52, d: 0.16, a: 0.002, v: 0.85 * vol, pan: p });                          // panel thump
      noise({ t: t + 0.008, d: 0.12, a: 0.002, v: 0.55 * vol, flt: { type: 'lowpass', f: 900 }, pan: p, verb: 0.15 });
      tone({ t: t + 0.01, f: 410, d: 0.14, a: 0.001, v: 0.06 * vol, pan: p });                                   // sheet-metal ring
      tone({ t: t + 0.01, f: 1130, d: 0.08, a: 0.001, v: 0.03 * vol, pan: p });
      noise({ t: t + 0.035, d: 0.02, a: 0.001, v: 0.18 * vol, flt: { type: 'bandpass', f: 3200, q: 3 }, pan: p }); // lock catch
    },
    crash: function (t, o, I, p, vol) {
      var v = (0.45 + 0.55 * I) * vol;
      tone({ t: t, f: 90, f1: 32, d: 0.25 + 0.4 * I, a: 0.002, v: 0.9 * v, pan: p * 0.5 });                       // body blow
      noise({ t: t, d: 0.18 + 0.4 * I, a: 0.002, v: 0.75 * v, flt: { type: 'lowpass', f: 1800 + 2500 * I, f1: 300, dur: 0.4 }, pan: p, verb: 0.3 }); // crunch
      noise({ t: t + 0.005, d: 0.08, a: 0.001, v: 0.5 * v, flt: { type: 'bandpass', f: 1200, q: 1.5 }, pan: p });
      for (var i = 0; i < 2 + Math.round(I * 2); i++)                                                          // bent metal resonances
        tone({ t: t + rnd(0, 0.03), f: rnd(280, 2400), d: rnd(0.15, 0.4) * (0.6 + I), a: 0.001, v: rnd(0.04, 0.09) * v, pan: p });
      if (I > 0.45) {                                                                                            // glass
        noise({ t: t + 0.02, d: 0.25 + 0.3 * I, a: 0.002, v: 0.2 * v, flt: { type: 'highpass', f: 4500 }, pan: p, verb: 0.25 });
        for (var k = 0; k < Math.round(I * 6); k++) tone({ t: t + 0.04 + rnd(0, 0.45) * I, f: rnd(2800, 6500), d: rnd(0.04, 0.16), a: 0.001, v: rnd(0.025, 0.07) * v });
      }
      if (I > 0.6) noise({ t: t + 0.06, d: 0.5, a: 0.02, v: 0.18 * v, flt: { type: 'bandpass', f: 600, q: 2 }, pan: p, verb: 0.3 }); // debris
    },
    scrape: function (t, o, I, p, vol) {
      var d = o.duration || (0.3 + 0.5 * I), v = (0.25 + 0.3 * I) * vol;
      var c = S.ctx, src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), lfo = c.createBufferSource(), lg = c.createGain(), nodes = [src, bp, g, lfo, lg];
      src.buffer = S.white; src.loop = true; lfo.buffer = S.smooth; lfo.loop = true; lfo.playbackRate.value = 14;
      bp.type = 'bandpass'; bp.Q.value = 6; bp.frequency.value = rnd(1600, 2600); lg.gain.value = 600;
      lfo.connect(lg); lg.connect(bp.frequency); src.connect(bp); bp.connect(g);
      var end = envelope(g, t, 0.01, d * 0.6, d * 0.4, v); route(g, { pan: p, verb: 0.2 }, nodes);
      src.start(t); lfo.start(t, Math.random() * 3); src.stop(end); lfo.stop(end); finish(src, nodes);
      tone({ t: t, f: rnd(700, 1100), d: d, a: 0.02, v: 0.04 * v, pan: p, flt: { type: 'bandpass', f: 1500, q: 4 } });
    },
    cash: function (t, o, I, p, vol) {
      // "cha": drawer ratchet ... "ching": register bell
      for (var i = 0; i < 3; i++) noise({ t: t + i * 0.022, d: 0.02, a: 0.001, v: 0.22 * vol, flt: { type: 'bandpass', f: 3400 - i * 300, q: 3 }, pan: p });
      noise({ t: t + 0.07, d: 0.06, a: 0.002, v: 0.12 * vol, flt: { type: 'highpass', f: 5000 }, pan: p });
      bell(t + 0.085, 2093, [[1, 1, 1], [2.76, 0.45, 0.6], [5.4, 0.25, 0.35], [1.003, 0.6, 0.9]], 0.75, 0.13 * vol, { pan: p, verb: 0.3 });
      bell(t + 0.085, 2637, [[1, 0.6, 1], [2.76, 0.2, 0.5]], 0.6, 0.1 * vol, { pan: p, verb: 0.3 });
      for (var k = 0; k < 4; k++) tone({ t: t + 0.12 + k * rnd(0.03, 0.07), f: rnd(4200, 7400), d: 0.07, a: 0.001, v: 0.035 * vol, pan: p + rnd(-0.3, 0.3) });
    },
    bigCash: function (t, o, I, p, vol) {
      SFX.cash(t, o, I, p, vol);
      tone({ t: t, f: 110, f1: 55, d: 0.4, a: 0.004, v: 0.5 * vol });                                              // whomp
      [69, 73, 76, 81, 85, 88].forEach(function (m, i) { tone({ t: t + 0.12 + i * 0.06, type: 'triangle', f: mtof(m + 12), d: 0.35, a: 0.003, v: 0.07 * vol, verb: 0.5, pan: (i - 2.5) * 0.15 }); });
      for (var k = 0; k < 12; k++) tone({ t: t + 0.15 + k * rnd(0.03, 0.08), f: rnd(3600, 8000), d: rnd(0.05, 0.12), a: 0.001, v: 0.03 * vol, pan: rnd(-0.7, 0.7) });
      bell(t + 0.5, 3136, [[1, 1, 1], [2.76, 0.4, 0.5]], 0.9, 0.08 * vol, { verb: 0.5 });
    },
    coin: function (t, o, I, p, vol) { var f = rnd(2500, 3100); bell(t, f, [[1, 1, 1], [2.4, 0.5, 0.6]], 0.12, 0.05 * vol, { pan: p }); bell(t + 0.045, f * 1.33, [[1, 1, 1], [2.4, 0.4, 0.6]], 0.16, 0.045 * vol, { pan: p }); },
    beep: function (t, o, I, p, vol) {
      var f = o.pitch ? 1320 * o.pitch : 1320;
      tone({ t: t, wave: S.wSoft, f: f, d: 0.03, hold: 0.04, a: 0.002, v: 0.08 * vol, flt: { type: 'lowpass', f: 4000 }, pan: p });
    },
    type: function (t, o, I, p, vol) {
      noise({ t: t, d: 0.012, a: 0.001, v: rnd(0.08, 0.14) * vol, flt: { type: 'bandpass', f: rnd(2600, 4200), q: 2 }, pan: p });
      noise({ t: t + 0.004, d: 0.03, a: 0.001, v: 0.07 * vol, flt: { type: 'bandpass', f: rnd(450, 700), q: 2 }, pan: p });
    },
    hackOk: function (t, o, I, p, vol) {
      [84, 88, 91, 96].forEach(function (m, i) { tone({ t: t + i * 0.055, wave: S.wSoft, f: mtof(m), d: 0.06, a: 0.002, v: 0.075 * vol, flt: { type: 'lowpass', f: 5000 }, pan: p, verb: 0.15 }); });
      tone({ t: t + 0.22, f: 1500, f1: 3200, d: 0.12, a: 0.002, v: 0.04 * vol, pan: p });
    },
    hackFail: function (t, o, I, p, vol) {
      [0, 0.2].forEach(function (dt) { tone({ t: t + dt, type: 'sawtooth', f: 155, d: 0.04, hold: 0.11, a: 0.004, v: 0.17 * vol, flt: { type: 'lowpass', f: 1400 }, pan: p }); tone({ t: t + dt, type: 'square', f: 158, d: 0.04, hold: 0.11, a: 0.004, v: 0.08 * vol, flt: { type: 'lowpass', f: 900 }, pan: p }); });
    },
    accessGranted: function (t, o, I, p, vol) {
      [79, 84, 88].forEach(function (m, i) { bell(t + i * 0.09, mtof(m), [[1, 1, 1], [2, 0.25, 0.5], [3.01, 0.1, 0.3]], 0.7, 0.08 * vol, { pan: p, verb: 0.35 }); });
      tone({ t: t + 0.32, f: 90, f1: 45, d: 0.25, a: 0.002, v: 0.6 * vol, pan: p });                                // bolts retract
      noise({ t: t + 0.32, d: 0.06, a: 0.001, v: 0.35 * vol, flt: { type: 'bandpass', f: 1100, q: 2 }, pan: p, verb: 0.3 });
      noise({ t: t + 0.4, d: 0.7, a: 0.05, v: 0.09 * vol, flt: { type: 'highpass', f: 3500 }, pan: p });              // hydraulic hiss
    },
    vaultOpen: function (t, o, I, p, vol) {
      tone({ t: t, type: 'sawtooth', f: 42, f1: 38, d: 2.2, a: 0.3, v: 0.25 * vol, flt: { type: 'bandpass', f: 220, f1: 480, q: 5, dur: 2.2 }, verb: 0.4 });
      tone({ t: t, type: 'sawtooth', f: 63, f1: 57, d: 2.2, a: 0.4, v: 0.12 * vol, flt: { type: 'bandpass', f: 340, f1: 720, q: 7, dur: 2.2 }, verb: 0.4 });
      noise({ t: t, d: 1.8, a: 0.3, v: 0.06 * vol, flt: { type: 'highpass', f: 2500 } });
      tone({ t: t + 2.3, f: 80, f1: 38, d: 0.6, a: 0.002, v: 0.9 * vol, verb: 0.6 });
      noise({ t: t + 2.3, d: 0.2, a: 0.001, v: 0.5 * vol, flt: { type: 'lowpass', f: 1200 }, verb: 0.6 });
      tone({ t: t + 2.3, f: 520, d: 0.7, a: 0.001, v: 0.05 * vol, verb: 0.6 });
    },
    alarm: null, alarmStop: null, engineStart: null,
    star: function (t, o, I, p, vol) {
      tone({ t: t, wave: S.wSiren, f: 600, f1: 1500, sweep: 0.2, d: 0.32, a: 0.01, v: 0.12 * vol, flt: { type: 'lowpass', f: 4000 }, echo: 0.3 });   // "whoop"
      brass(t + 0.02, [45, 52, 57, 60], 0.55, 0.32 * vol, { cut0: 300, cut1: 2400, open: 0.04, verb: 0.35 });
      tone({ t: t, f: 70, f1: 40, d: 0.3, v: 0.5 * vol });
      noise({ t: t, d: 0.25, a: 0.003, v: 0.12 * vol, flt: { type: 'highpass', f: 6000 } });
    },
    starDown: function (t, o, I, p, vol) {
      [76, 72, 69].forEach(function (m, i) { tone({ t: t + i * 0.13, type: 'triangle', f: mtof(m), d: 0.5, a: 0.01, v: 0.1 * vol, verb: 0.5 }); });
      noise({ t: t, d: 0.6, a: 0.25, v: 0.05 * vol, flt: { type: 'bandpass', f: 2500, f1: 600, q: 1 } });
    },
    busted: function (t, o, I, p, vol) {
      for (var i = 0; i < 2; i++) tone({ t: t + i * 0.28, wave: S.wSiren, f: 650, f1: 1450, sweep: 0.12, d: 0.26, a: 0.01, v: 0.1 * vol, flt: { type: 'lowpass', f: 3500 }, echo: 0.4 });
      var h = t + 0.6;
      impact(h, 0.9 * vol);
      brass(h, [46, 49, 53, 58], 1.6, 0.42 * vol, { cut0: 400, cut1: 2800, cutEnd: 300, bend: -700, hold: 0.25, verb: 0.5 });
      brass(h, [34, 46], 1.8, 0.3 * vol, { cut0: 200, cut1: 900, cutEnd: 120, bend: -500, hold: 0.3 });
    },
    wasted: function (t, o, I, p, vol) {
      impact(t, 1.0 * vol);
      tone({ t: t, f: 75, f1: 24, sweep: 2.2, d: 2.6, a: 0.01, v: 0.6 * vol });
      brass(t + 0.05, [40, 46, 52], 2.8, 0.35 * vol, { cut0: 900, cut1: 1500, cutEnd: 150, bend: -500, hold: 0.6, open: 0.3, verb: 0.6, spread: 14 });
      bell(t + 0.35, mtof(64), [[1, 1, 1], [2.4, 0.5, 0.6], [3.9, 0.3, 0.4], [5.3, 0.2, 0.3]], 2.4, 0.11 * vol, { verb: 0.8 });
      [1.0, 1.25, 1.9, 2.2].forEach(function (dt, i) { tone({ t: t + dt, f: 60, f1: 38, d: 0.18, v: (i % 2 ? 0.25 : 0.4) * vol }); });   // fading heartbeat
    },
    heistComplete: function (t, o, I, p, vol) {
      // bVI - bVII - I in A: the getaway victory cadence
      var hits = [[0, [53, 57, 60, 65]], [0.36, [55, 59, 62, 67]], [0.72, [57, 61, 64, 69]]];
      hits.forEach(function (h, i) {
        var last = i === 2, tt = t + h[0];
        brass(tt, h[1], last ? 2.4 : 0.34, (last ? 0.5 : 0.42) * vol, { cut0: 600, cut1: last ? 4200 : 3000, open: 0.05, hold: last ? 0.9 : 0.12, verb: 0.45 });
        brass(tt, [h[1][0] - 12], last ? 2.2 : 0.3, 0.3 * vol, { cut0: 300, cut1: 1000, hold: last ? 0.8 : 0.1 });
        tone({ t: tt, f: 120, f1: 45, d: 0.25, a: 0.002, v: 0.7 * vol });
        gatedSnare(tt, 0.32 * vol);
      });
      noise({ t: t + 0.72, d: 2.2, a: 0.004, v: 0.12 * vol, flt: { type: 'highpass', f: 5500 }, verb: 0.4 });                      // crash cymbal
      [81, 85, 88, 93, 97, 100].forEach(function (m, i) { tone({ t: t + 0.8 + i * 0.07, type: 'triangle', f: mtof(m), d: 0.6, a: 0.003, v: 0.06 * vol, verb: 0.5, pan: (i - 2.5) * 0.2 }); });
      SFX.cash(t + 1.25, o, I, 0, 0.8 * vol);
    },
    missionComplete: function (t, o, I, p, vol) {
      riser(t, 0.42, 0.5 * vol);
      var h = t + 0.42, s16 = 60 / 112 / 4;
      [[0, 40], [2, 52], [3, 50], [5, 52], [6, 55], [7, 57]].forEach(function (n) {
        tone({ t: h + n[0] * s16, type: 'sawtooth', f: mtof(n[1]), d: s16 * 1.4, a: 0.004, v: 0.22 * vol, flt: { type: 'lowpass', f: 1600, f1: 400, q: 3, dur: s16 * 1.4 } });
      });
      tone({ t: h, f: 120, f1: 45, d: 0.25, v: 0.7 * vol }); gatedSnare(h + 4 * s16, 0.3 * vol);
      var e = h + 8 * s16;
      brass(e, [52, 55, 59, 62, 66], 0.3, 0.4 * vol, { cut0: 800, cut1: 3500, hold: 0.1, verb: 0.4 });
      brass(e + 3 * s16, [48, 52, 55, 59, 62], 0.3, 0.4 * vol, { cut0: 800, cut1: 3500, hold: 0.1, verb: 0.4 });
      var f = e + 6 * s16;
      brass(f, [40, 52, 56, 59, 63, 66], 2.4, 0.55 * vol, { cut0: 700, cut1: 4500, open: 0.06, hold: 0.8, verb: 0.55, spread: 11 });
      tone({ t: f, f: 120, f1: 40, d: 0.4, v: 0.8 * vol }); gatedSnare(f, 0.35 * vol);
      noise({ t: f, d: 2.4, a: 0.004, v: 0.1 * vol, flt: { type: 'highpass', f: 5500 }, verb: 0.4 });
      [76, 80, 83, 87, 88, 92].forEach(function (m, i) { tone({ t: f + 0.08 + i * 0.075, type: 'triangle', f: mtof(m), d: 0.7, a: 0.003, v: 0.055 * vol, verb: 0.55, pan: (i - 2.5) * 0.25 }); });
    },
    checkpoint: function (t, o, I, p, vol) {
      tone({ t: t, type: 'triangle', f: mtof(88), d: 0.25, a: 0.003, v: 0.12 * vol, verb: 0.35 });
      tone({ t: t + 0.08, type: 'triangle', f: mtof(95), d: 0.45, a: 0.003, v: 0.12 * vol, verb: 0.35 });
      noise({ t: t, d: 0.25, a: 0.1, v: 0.06 * vol, flt: { type: 'bandpass', f: 1500, f1: 6000, q: 1.5 } });
    },
    horn: function (t, o, I, p, vol) {
      var d = clamp(o.duration != null ? o.duration : 0.42, 0.08, 3);
      [415, 523].forEach(function (f, i) {
        tone({ t: t, type: 'sawtooth', f: f, d: 0.06, hold: d, a: 0.012, v: (i ? 0.1 : 0.13) * vol, flt: { type: 'bandpass', f: 1000, q: 0.8 }, pan: p, echo: 0.35, verb: 0.15 });
      });
    },
    whoosh: function (t, o, I, p, vol) {
      var d = o.duration || 0.6, c = S.ctx;
      var g = noise({ t: t, buf: S.pink, d: d * 0.55, a: d * 0.45, v: 0.32 * vol, flt: { type: 'bandpass', f: 400, f1: 2600, q: 1.4, dur: d * 0.45 }, flt2: { type: 'lowpass', f: 6000 } });
      if (S.hasPan) { var pn = c.createStereoPanner(); g.disconnect(); g.connect(pn); pn.connect(S.gen.dry); pn.pan.setValueAtTime(-0.8 * (p || 1), t); pn.pan.linearRampToValueAtTime(0.8 * (p || 1), t + d); }
    },
    splash: function (t, o, I, p, vol) {
      noise({ t: t, d: 0.9, a: 0.01, v: 0.5 * vol, flt: { type: 'lowpass', f: 4000, f1: 500, dur: 0.8 }, pan: p, verb: 0.3 });
      tone({ t: t, f: 70, f1: 35, d: 0.3, v: 0.5 * vol, pan: p });
      for (var i = 0; i < 8; i++) tone({ t: t + 0.1 + rnd(0, 0.7), f: rnd(300, 700), f1: rnd(900, 1600), d: 0.05, a: 0.003, v: 0.05 * vol, pan: p + rnd(-0.4, 0.4) });
    },
    land: function (t, o, I, p, vol) {
      var v = (0.4 + 0.6 * I) * vol;
      tone({ t: t, f: 65, f1: 32, d: 0.3, a: 0.002, v: 0.9 * v, pan: p });
      noise({ t: t, d: 0.16, a: 0.002, v: 0.5 * v, flt: { type: 'lowpass', f: 500 }, pan: p });
      tone({ t: t + 0.03, f: 230, f1: 150, d: 0.18, a: 0.002, v: 0.12 * v, flt: { type: 'bandpass', f: 230, q: 3 }, pan: p });     // suspension
      if (I > 0.4) noise({ t: t + 0.02, d: 0.12, a: 0.005, v: 0.12 * v, flt: { type: 'bandpass', f: 1800, q: 6 }, pan: p });      // tyre chirp
    },
    ui: function (t, o, I, p, vol) { tone({ t: t, f: 1900, f1: 1300, d: 0.03, a: 0.001, v: 0.09 * vol }); },
    pop: function (t) { enginePop(t, Math.random() < 0.3); },
    shift: function (t, o, I, p, vol) { gearClunk(t, vol); },
    riser: function (t, o, I, p, vol) { riser(t, o.duration || 1.4, vol); },
    impact: function (t, o, I, p, vol) { impact(t, (0.5 + 0.5 * I) * vol); }
  };
  function impact(t, v) {
    tone({ t: t, f: 110, f1: 30, d: 1.2, a: 0.002, v: 0.95 * v });
    noise({ t: t, d: 0.9, a: 0.002, v: 0.45 * v, flt: { type: 'lowpass', f: 1500, f1: 120, dur: 0.8 }, verb: 0.5 });
  }
  function riser(t, d, v) {
    noise({ t: t, buf: S.pink, d: 0.04, hold: 0, a: d, v: 0.22 * v, flt: { type: 'bandpass', f: 300, f1: 5000, q: 2, dur: d }, verb: 0.3 });
    tone({ t: t, type: 'sawtooth', f: 110, f1: 440, sweep: d, d: 0.04, a: d, v: 0.07 * v, flt: { type: 'lowpass', f: 400, f1: 4000, dur: d } });
  }
  function gatedSnare(t, v) {      // stings: 80s gated-reverb snare, tone body + noise held flat then chopped
    tone({ t: t, f: 220, f1: 165, d: 0.08, a: 0.001, v: 0.45 * v });
    noise({ t: t, d: 0.03, hold: 0.16, a: 0.001, v: 0.5 * v, flt: { type: 'bandpass', f: 1700, q: 0.6 }, flt2: { type: 'highpass', f: 300 }, verb: 0.35 });
    noise({ t: t, d: 0.06, a: 0.001, v: 0.35 * v, flt: { type: 'highpass', f: 4500 } });
  }

  /* ---------------------------------------------------------------- chapter 3 "THE CREW": bombs, the trap, nitro, slow motion,
     the crew switch, the gun-store till and the vault's money burst. Same primitives and level targets as above. */
  GAP.explosion = 0.07; GAP.bombDrop = 0.15; GAP.bombBeep = 0.03; GAP.thermalBeep = 0.03; GAP.nitro = 0.4; GAP.slowIn = 0.3; GAP.slowOut = 0.3;
  GAP.switchUp = 0.12; GAP.switchDown = 0.12; GAP.purchase = 0.15; GAP.moneyBurst = 0.4;
  LOWPRIO.bombBeep = 1; LOWPRIO.thermalBeep = 1; LOWPRIO.switchUp = 1;
  TRIM.explosion = 0.8; TRIM.bombDrop = 1.3; TRIM.bombBeep = 2.6; TRIM.thermalBeep = 3.2; TRIM.slowIn = 0.85; TRIM.slowOut = 2.2;
  TRIM.switchUp = 3.5; TRIM.switchDown = 0.7; TRIM.purchase = 0.9; TRIM.moneyBurst = 1.6;
  // o.far (0..1, distance: duller + wetter), o.mega (the gas trap: a second, deeper fireball), o.pitch (beeps), o.duration (whooshes), o.stamp (purchase)
  SFX.explosion = function (t, o, I, p, vol) {
    var far = clamp(o.far != null ? o.far : 0, 0, 1), v = (0.5 + 0.5 * I) * vol, nf = 1 - far * 0.8, big = !!o.mega;
    // 1. the pressure crack (bright, a few ms) - distance eats it first
    noise({ t: t, d: 0.05 + 0.05 * I, a: 0.0008, v: 1.0 * v * nf, flt: { type: 'highpass', f: 700 }, flt2: { type: 'lowpass', f: 9000 - far * 7000 }, pan: p });
    tone({ t: t, type: 'triangle', f: 1900, f1: 220, d: 0.045, a: 0.0006, v: 0.22 * v * nf });
    // 2. the boom: sub drop + chest-thump body + the fireball's low roar
    tone({ t: t + 0.004, f: 76, f1: 25, sweep: 0.8 + 0.7 * I, d: 1.0 + 1.3 * I, a: 0.004, v: 0.85 * v });
    tone({ t: t + 0.004, type: 'triangle', f: 160, f1: 46, sweep: 0.3, d: 0.4 + 0.4 * I, a: 0.003, v: 0.36 * v });
    noise({ t: t + 0.006, buf: S.brown, d: 1.4 + 1.6 * I, a: 0.006, v: 0.95 * v, flt: { type: 'lowpass', f: 400 + 2200 * nf, f1: 100, dur: 1.2 + I }, pan: p * 0.5, verb: 0.4 + far * 0.4 });
    noise({ t: t + 0.01, buf: S.pink, d: 0.7 + 0.7 * I, a: 0.004, v: 1.05 * v * (0.4 + 0.6 * nf), flt: { type: 'bandpass', f: 1100, f1: 220, q: 0.6, dur: 1.0 }, verb: 0.35 }); // the fireball's roar
    noise({ t: t + 0.003, d: 0.28 + 0.2 * I, a: 0.002, v: 0.42 * v * nf, flt: { type: 'bandpass', f: 2400, f1: 520, q: 0.7, dur: 0.3 }, verb: 0.25, pan: p * 0.6 }); // the air tearing (small speakers hear this)
    // 3. the rumble rolling off the buildings
    noise({ t: t + 0.07, buf: S.brown, d: 1.8 + 2.2 * I, a: 0.22, v: 0.34 * v, flt: { type: 'lowpass', f: 300, f1: 85, dur: 3 }, verb: 0.65 });
    // 4. debris: chunks, glass and sheet metal raining down
    var n = Math.max(1, 1 + Math.round(I * 3) - Math.round(far * 2));
    for (var i = 0; i < n; i++) noise({ t: t + 0.12 + rnd(0, 0.8) * (0.6 + I), d: rnd(0.03, 0.08), a: 0.001, v: rnd(0.24, 0.4) * v * nf, flt: { type: 'bandpass', f: rnd(700, 3400), q: rnd(1.5, 4) }, verb: 0.25 });
    for (var k = 0; k < Math.round(I * 2 * nf); k++) tone({ t: t + 0.2 + rnd(0, 1.0), f: rnd(900, 3400), d: rnd(0.08, 0.22), a: 0.001, v: rnd(0.02, 0.045) * v, pan: clamp(p + rnd(-0.6, 0.6), -1, 1) });
    if (big) {
      tone({ t: t + 0.13, f: 62, f1: 21, sweep: 1.7, d: 2.6, a: 0.01, v: 0.8 * v });
      noise({ t: t + 0.13, buf: S.brown, d: 2.8, a: 0.03, v: 0.65 * v, flt: { type: 'lowpass', f: 1300, f1: 75, dur: 2.6 }, verb: 0.6 });
      for (var c = 0; c < 4; c++) noise({ t: t + 0.4 + rnd(0, 1.6), d: rnd(0.01, 0.025), a: 0.0005, v: rnd(0.06, 0.12) * v * nf, flt: { type: 'bandpass', f: rnd(1500, 4200), q: 2 } }); // fire crackle
    }
  };
  SFX.bombDrop = function (t, o, I, p, vol) {
    // the canister hits the asphalt: body thump + clank, a short skitter, then the arming chirp
    tone({ t: t, f: 150, f1: 82, d: 0.09, a: 0.001, v: 0.55 * vol, pan: p });
    noise({ t: t, d: 0.035, a: 0.0008, v: 0.4 * vol, flt: { type: 'bandpass', f: 2600, q: 2.5 }, pan: p });
    bell(t, 1180, [[1, 1, 1], [2.71, 0.5, 0.55], [4.13, 0.3, 0.35]], 0.22, 0.09 * vol, { pan: p, verb: 0.15 });
    noise({ t: t + 0.075, d: 0.02, a: 0.001, v: 0.2 * vol, flt: { type: 'bandpass', f: 3400, q: 3 }, pan: p });
    noise({ t: t + 0.13, d: 0.015, a: 0.001, v: 0.12 * vol, flt: { type: 'bandpass', f: 3000, q: 3 }, pan: p });
    tone({ t: t + 0.24, wave: S.wSoft, f: 1870, d: 0.03, hold: 0.025, a: 0.002, v: 0.07 * vol, flt: { type: 'lowpass', f: 5000 }, pan: p });
    tone({ t: t + 0.31, wave: S.wSoft, f: 2490, d: 0.03, hold: 0.025, a: 0.002, v: 0.07 * vol, flt: { type: 'lowpass', f: 5000 }, pan: p });
  };
  SFX.bombBeep = function (t, o, I, p, vol) {
    var f = 2650 * clamp(o.pitch != null ? o.pitch : 1, 0.5, 2);
    tone({ t: t, wave: S.wSoft, f: f, d: 0.025, hold: 0.03, a: 0.001, v: 0.075 * vol, flt: { type: 'lowpass', f: 6000 }, pan: p });
    tone({ t: t, f: f * 0.5, d: 0.04, a: 0.001, v: 0.03 * vol, pan: p });
  };
  SFX.thermalBeep = function (t, o, I, p, vol) {
    // the vault charge: a harsher two-step chirp over the sizzle of the thermite cell.
    // o.intensity = how far the fuse has burnt (0..1): higher, tighter and hotter toward the blast; o.pitch overrides the pitch
    var u = o.intensity != null ? I : 0, k = clamp(o.pitch != null ? o.pitch : 1 + 0.4 * u, 0.5, 2), gap = 0.07 - 0.025 * u, lv = vol * (0.85 + 0.3 * u);
    tone({ t: t, type: 'square', f: 1480 * k, d: 0.02, hold: 0.035 - 0.01 * u, a: 0.001, v: 0.045 * lv, flt: { type: 'lowpass', f: 3800 }, pan: p });
    tone({ t: t + gap, type: 'square', f: 1975 * k, d: 0.02, hold: 0.03 - 0.008 * u, a: 0.001, v: 0.04 * lv, flt: { type: 'lowpass', f: 4200 }, pan: p });
    noise({ t: t, d: 0.09 + 0.06 * u, a: 0.004, v: (0.03 + 0.03 * u) * lv, flt: { type: 'highpass', f: 6000 - 2000 * u }, pan: p });
  };
  SFX.nitro = function (t, o, I, p, vol) {
    // valve "pssht", a whoosh into the jet roar, a kick in the back
    noise({ t: t, d: 0.12, a: 0.004, v: 0.35 * vol, flt: { type: 'highpass', f: 3500 }, pan: p });
    noise({ t: t + 0.02, buf: S.pink, d: 0.7, a: 0.12, v: 0.45 * vol, flt: { type: 'bandpass', f: 500, f1: 2800, q: 1.1, dur: 0.3 }, flt2: { type: 'lowpass', f: 7000 }, verb: 0.2 });
    tone({ t: t + 0.04, type: 'sawtooth', f: 48, f1: 66, sweep: 0.5, d: 0.9, hold: 0.2, a: 0.06, v: 0.22 * vol, flt: { type: 'lowpass', f: 300, f1: 1100, dur: 0.5 } });
    tone({ t: t + 0.03, f: 90, f1: 40, d: 0.35, a: 0.004, v: 0.6 * vol });
    noise({ t: t + 0.08, d: 1.3, a: 0.15, v: 0.12 * vol, flt: { type: 'bandpass', f: 5200, q: 0.9 }, verb: 0.15 });
  };
  SFX.slowIn = function (t, o, I, p, vol) {
    // time drags: a falling "vwoom", the air closing in, one slow heartbeat
    tone({ t: t, type: 'triangle', f: 520, f1: 60, sweep: 0.75, d: 0.85, a: 0.02, v: 0.18 * vol, flt: { type: 'lowpass', f: 2400, f1: 300, dur: 0.75 } });
    noise({ t: t, buf: S.pink, d: 0.8, a: 0.05, v: 0.3 * vol, flt: { type: 'lowpass', f: 5000, f1: 260, dur: 0.7 }, verb: 0.5 });
    tone({ t: t + 0.05, f: 70, f1: 34, d: 0.9, a: 0.01, v: 0.6 * vol, verb: 0.3 });
  };
  SFX.slowOut = function (t, o, I, p, vol) {
    noise({ t: t, buf: S.pink, d: 0.12, a: 0.35, v: 0.28 * vol, flt: { type: 'bandpass', f: 250, f1: 3800, q: 1, dur: 0.4 }, verb: 0.3 });
    tone({ t: t, type: 'triangle', f: 70, f1: 480, sweep: 0.4, d: 0.12, a: 0.32, v: 0.14 * vol, flt: { type: 'lowpass', f: 400, f1: 3000, dur: 0.4 } });
  };
  SFX.switchUp = function (t, o, I, p, vol) {
    // the sky cam lifting off: a rising whoosh with a thin airy shimmer
    var d = clamp(o.duration != null ? o.duration : 0.55, 0.2, 2);
    noise({ t: t, buf: S.pink, d: d * 0.5, a: d * 0.5, v: 0.34 * vol, flt: { type: 'bandpass', f: 350, f1: 3200, q: 1.3, dur: d * 0.55 }, flt2: { type: 'lowpass', f: 7000 }, verb: 0.35, pan: p });
    tone({ t: t + d * 0.1, type: 'triangle', f: 660, f1: 1320, sweep: d * 0.6, d: d * 0.5, a: d * 0.35, v: 0.035 * vol, verb: 0.5 });
  };
  SFX.switchDown = function (t, o, I, p, vol) {
    // dropping into the next character: air rushing down, then a heavy thump
    noise({ t: t, buf: S.pink, d: 0.08, a: 0.16, v: 0.22 * vol, flt: { type: 'bandpass', f: 2600, f1: 500, q: 1.2, dur: 0.18 } });
    var h = t + 0.17;
    tone({ t: h, f: 110, f1: 34, d: 0.55, a: 0.002, v: 0.95 * vol });
    tone({ t: h, type: 'triangle', f: 220, f1: 90, d: 0.12, a: 0.001, v: 0.25 * vol });
    noise({ t: h, buf: S.brown, d: 0.5, a: 0.002, v: 0.6 * vol, flt: { type: 'lowpass', f: 1100, f1: 90, dur: 0.45 }, verb: 0.45 });
  };
  SFX.purchase = function (t, o, I, p, vol) {
    // the till (drawer ratchet + bell), then the PURCHASED stamp
    SFX.cash(t, o, I, p, 1.6 * vol);
    var s = t + clamp(o.stamp != null ? o.stamp : 0.32, 0, 2);
    tone({ t: s, f: 170, f1: 62, d: 0.16, a: 0.001, v: 0.75 * vol, pan: p });
    noise({ t: s, d: 0.07, a: 0.0008, v: 0.45 * vol, flt: { type: 'lowpass', f: 1500 }, verb: 0.25 });
    noise({ t: s, d: 0.025, a: 0.0005, v: 0.2 * vol, flt: { type: 'highpass', f: 3500 } });
  };
  SFX.moneyBurst = function (t, o, I, p, vol) {
    // a fwump, then the air full of banknotes (dense at first, thinning out) and a glint
    var d = clamp(o.duration != null ? o.duration : 1.4, 0.4, 4);
    tone({ t: t, f: 120, f1: 50, d: 0.3, a: 0.003, v: 0.45 * vol });
    noise({ t: t, buf: S.pink, d: d * 0.75, a: 0.03, v: 0.4 * vol, flt: { type: 'bandpass', f: 900, f1: 2600, q: 0.9, dur: d * 0.5 }, verb: 0.3 });
    for (var i = 0; i < 10; i++) noise({ t: t + Math.pow(Math.random(), 1.6) * d, d: rnd(0.02, 0.05), a: 0.002, v: rnd(0.18, 0.3) * vol, flt: { type: 'bandpass', f: rnd(1400, 4200), q: rnd(1.2, 2.5) } });
    bell(t + 0.15, 3520, [[1, 1, 1], [2.76, 0.3, 0.5]], 0.5, 0.035 * vol, { verb: 0.5 });
  };

  /* ================================================================ music */
  // shared music FX: dry, Juno-style stereo chorus, ping-pong delay, hall reverb
  function musFX() {
    if (S.mfx) return S.mfx;
    var c = S.ctx, f = S.mfx = { nodes: [], srcs: [], dead: false };
    var m = function (n) { f.nodes.push(n); S.pn++; return n; };
    f.dry = m(c.createGain()); f.dry.connect(S.musOut);
    f.verbIn = m(c.createGain());
    var conv = m(c.createConvolver()); conv.buffer = S.irMus || (S.irMus = irBuf(c, 2.0, 1.9, 0.02, 0.5));
    f.verbRet = m(c.createGain()); f.verbRet.gain.value = 0.6;
    f.verbIn.connect(conv); conv.connect(f.verbRet); f.verbRet.connect(S.musOut);
    f.choIn = m(c.createGain()); f.choIn.connect(f.dry);
    var cl = m(c.createDelay(0.05)), cr = m(c.createDelay(0.05)), lfo = m(c.createOscillator()), dl = m(c.createGain()), dr = m(c.createGain()), cm = m(c.createChannelMerger(2));
    cl.delayTime.value = 0.011; cr.delayTime.value = 0.016; lfo.frequency.value = 0.5; dl.gain.value = 0.0032; dr.gain.value = -0.0032;
    lfo.connect(dl); lfo.connect(dr); dl.connect(cl.delayTime); dr.connect(cr.delayTime);
    f.choIn.connect(cl); f.choIn.connect(cr); cl.connect(cm, 0, 0); cr.connect(cm, 0, 1);
    f.choRet = m(c.createGain()); f.choRet.gain.value = 0.75; cm.connect(f.choRet); f.choRet.connect(S.musOut);
    f.srcs.push(lfo);
    f.dlyIn = m(c.createGain());
    var mono = m(c.createBiquadFilter()); mono.type = 'lowpass'; mono.frequency.value = 3800; mono.channelCount = 1; mono.channelCountMode = 'explicit';
    f.dL = m(c.createDelay(2)); f.dR = m(c.createDelay(2));
    var fb = m(c.createGain()), pm = m(c.createChannelMerger(2)); fb.gain.value = 0.42;
    f.dlyIn.connect(mono); mono.connect(f.dL); f.dL.connect(f.dR); f.dR.connect(fb); fb.connect(f.dL);
    f.dL.connect(pm, 0, 0); f.dR.connect(pm, 0, 1);
    f.dlyRet = m(c.createGain()); f.dlyRet.gain.value = 0.5; pm.connect(f.dlyRet); f.dlyRet.connect(S.musOut);
    var dv = m(c.createGain()); dv.gain.value = 0.25; f.dlyRet.connect(dv); dv.connect(f.verbIn);
    lfo.start();
    return f;
  }
  function killFX() {
    var f = S.mfx; if (!f) return;
    f.srcs.forEach(function (s) { try { s.stop(); } catch (e) {} });
    f.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
    S.pn -= f.nodes.length; S.mfx = null;
  }

  function tn(tr, n) { tr.nodes.push(n); S.pn++; return n; }
  function tgain(tr, val, dest) { var g = tn(tr, S.ctx.createGain()); g.gain.value = val; if (dest) g.connect(dest); return g; }
  function sendTo(tr, node, dests) {
    dests.forEach(function (d) { if (d[1] === 1) node.connect(d[0]); else { var g = tgain(tr, d[1], d[0]); node.connect(g); } });
  }
  // monophonic synth voice, persistent: oscillators run, notes are envelopes (no per-note nodes)
  function Mono(tr, o) {
    var c = S.ctx, v = { oscs: [] };
    v.lp = tn(tr, c.createBiquadFilter()); v.lp.type = 'lowpass'; v.lp.frequency.value = o.cut; v.lp.Q.value = o.q || 0.8;
    v.amp = tgain(tr, 0); v.lp.connect(v.amp);
    o.osc.forEach(function (d) {      // [type, octave, detune, level]
      var s = tn(tr, c.createOscillator()); if (typeof d[0] === 'string') s.type = d[0]; else s.setPeriodicWave(d[0]);
      s.detune.value = d[2] || 0; tr.srcs.push(s);
      if (d[3] != null && d[3] !== 1) { var g = tgain(tr, d[3], v.lp); s.connect(g); } else s.connect(v.lp);
      v.oscs.push([s, d[1] || 0]);
    });
    if (o.vib) {
      var l = tn(tr, c.createOscillator()); l.frequency.value = 5.4; tr.srcs.push(l);
      v.vib = tgain(tr, 0); l.connect(v.vib); v.oscs.forEach(function (x) { v.vib.connect(x[0].detune); });
      v.vibDepth = o.vib;
    }
    sendTo(tr, v.amp, o.dest);
    v.cut = o.cut; v.lvl = o.lvl || 1;
    // n: {glide, fenv (multiplier), fdec, atk, dec, sus, rel}
    v.note = function (m, t, dur, vel, n) {
      n = n || {};
      v.oscs.forEach(function (x) {
        var p = x[0].frequency, f = mtof(m + x[1]); p.cancelScheduledValues(t);
        if (n.glide) p.setTargetAtTime(f, t, n.glide); else p.setValueAtTime(f, t);
      });
      var a = v.amp.gain, pk = vel * v.lvl, atk = n.atk || 0.004, sus = n.sus != null ? n.sus : 0.6;
      a.cancelScheduledValues(t);
      a.setTargetAtTime(pk, t, atk / 3);
      a.setTargetAtTime(pk * sus, t + atk, (n.dec || 0.12) / 3);
      a.setTargetAtTime(0, t + Math.max(dur, atk + 0.01), (n.rel || 0.04) / 3);
      var fq = v.lp.frequency, base = n.cut || v.cut;
      fq.cancelScheduledValues(t);
      if (n.fenv) { fq.setTargetAtTime(Math.min(16000, base * n.fenv), t, 0.002); fq.setTargetAtTime(base, t + 0.006, (n.fdec || 0.12) / 3); }
      else fq.setTargetAtTime(base, t, 0.01);
      if (v.vib) { var vb = v.vib.gain; vb.cancelScheduledValues(t); vb.setTargetAtTime(0, t, 0.01); if (n.vib && dur > 0.25) vb.setTargetAtTime(v.vibDepth, t + 0.18, 0.15); }
    };
    return v;
  }
  // polyphonic pad: n oscillators retuned per chord, one filter, one gate (pump / swell)
  function Pad(tr, o) {
    var c = S.ctx, v = { oscs: [] }, det = [-9, 7, -4, 11, -12, 5];
    v.lp = tn(tr, c.createBiquadFilter()); v.lp.type = 'lowpass'; v.lp.frequency.value = o.cut; v.lp.Q.value = o.q || 0.7;
    v.gate = tgain(tr, 0); v.lp.connect(v.gate);
    for (var i = 0; i < o.n; i++) {
      var s = tn(tr, c.createOscillator()); s.type = o.type || 'sawtooth'; s.detune.value = det[i] * (o.spread || 1);
      s.connect(v.lp); tr.srcs.push(s); v.oscs.push(s);
    }
    sendTo(tr, v.gate, o.dest);
    v.lvl = o.lvl;
    v.chord = function (notes, t) { v.oscs.forEach(function (s, i) { var p = s.frequency; p.cancelScheduledValues(t); p.setTargetAtTime(mtof(notes[i % notes.length]), t, 0.006); }); };
    v.pump = function (t, beat, depth) { var g = v.gate.gain; g.cancelScheduledValues(t); g.setTargetAtTime(v.lvl * (1 - depth), t, 0.004); g.setTargetAtTime(v.lvl, t + 0.025, beat * 0.25); };
    v.swell = function (t, up, hold, down, lvl) { var g = v.gate.gain; g.cancelScheduledValues(t); g.setTargetAtTime(v.lvl * (lvl || 1), t, up / 3); g.setTargetAtTime(v.lvl * 0.35, t + up + hold, down / 3); };
    v.cutoff = function (f, t, tc) { glide(v.lp.frequency, f, t, tc || 0.3); };
    return v;
  }
  // persistent drum kit per track: one noise source + one kick oscillator, hits are envelopes (no per-hit nodes)
  function Kit(tr) {
    var c = S.ctx, k = {};
    k.nz = tn(tr, c.createBufferSource()); k.nz.buffer = S.white; k.nz.loop = true; tr.srcs.push(k.nz);
    k.ko = tn(tr, c.createOscillator()); k.ko.frequency.value = 46; tr.srcs.push(k.ko);
    k.kg = tgain(tr, 0, tr.drums); k.ko.connect(k.kg);
    k.sbp = tn(tr, c.createBiquadFilter()); k.sbp.type = 'bandpass'; k.sbp.frequency.value = 1700; k.sbp.Q.value = 0.6; k.nz.connect(k.sbp);
    k.sg = tgain(tr, 0, tr.drums); k.sbp.connect(k.sg); var sv = tgain(tr, 0.7, tr.verbDr); k.sg.connect(sv);
    k.so = tn(tr, c.createOscillator()); k.so.type = 'triangle'; k.so.frequency.value = 190; tr.srcs.push(k.so);
    k.sog = tgain(tr, 0, tr.drums); k.so.connect(k.sog);
    k.hp = tn(tr, c.createBiquadFilter()); k.hp.type = 'highpass'; k.hp.frequency.value = 5200; k.hp.Q.value = 0.7; k.nz.connect(k.hp);
    k.hg = tgain(tr, 0, tr.drums); k.hp.connect(k.hg);
    return k;
  }
  function hit(p, t, v, atk, at, tc) { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, atk); p.setTargetAtTime(0, t + at, tc); }
  function kick(tr, t, v) {
    var k = tr.kit, f = k.ko.frequency;
    f.cancelScheduledValues(t); f.setValueAtTime(420, t); f.setTargetAtTime(130, t, 0.004); f.setTargetAtTime(46, t + 0.012, 0.035);
    hit(k.kg.gain, t, 0.95 * v, 0.0006, 0.014, 0.085);
  }
  function hat(tr, t, v, open) { hit(tr.kit.hg.gain, t, v * 0.9, 0.0004, 0.002, open ? 0.07 : 0.011); }
  function shaker(tr, t, v) { hit(tr.kit.hg.gain, t, v * 0.9, 0.005, 0.016, 0.014); }
  // mode: 'gated' (80s gated reverb), 'clap', 'both'
  function snare(tr, t, v, mode) {
    var k = tr.kit, g = k.sg.gain, f = k.sbp.frequency;
    f.cancelScheduledValues(t); f.setValueAtTime(mode === 'clap' ? 1250 : 1700, t);
    g.cancelScheduledValues(t);
    if (mode !== 'gated') {          // three quick hand-claps
      g.setTargetAtTime(0.8 * v, t, 0.0005); g.setTargetAtTime(0.06 * v, t + 0.004, 0.003);
      g.setTargetAtTime(0.8 * v, t + 0.011, 0.0005); g.setTargetAtTime(0.06 * v, t + 0.015, 0.003);
      t += 0.022;
    }
    g.setTargetAtTime(v, t, 0.0006);
    if (mode === 'clap') g.setTargetAtTime(0, t + 0.006, 0.045);
    else { g.setTargetAtTime(v * 0.42, t + 0.006, 0.025); g.setTargetAtTime(v * 0.36, t + 0.06, 0.25); g.setTargetAtTime(0, t + 0.2, 0.008); }
    if (mode !== 'clap') {
      var o = k.so.frequency; o.cancelScheduledValues(t); o.setValueAtTime(240, t); o.setTargetAtTime(175, t, 0.02);
      hit(k.sog.gain, t, 0.7 * v, 0.0006, 0.004, 0.03);
    }
  }
  function tom(tr, t, f, v) { tone({ t: t, f: f * 1.5, f1: f, sweep: 0.06, d: 0.28, a: 0.002, v: 0.55 * v, dest: tr.drums, verb: 0.5, verbDest: tr.verbDr }); }
  function crash(tr, t, v) { noise({ t: t, d: 1.6, a: 0.003, v: 0.22 * v, flt: { type: 'highpass', f: 5000 }, flt2: { type: 'peaking', f: 8000, q: 1, g: 4 }, dest: tr.drums, verb: 0.4, verbDest: tr.verbDr }); }
  function clk(tr, t, v, hi) { noise({ t: t, d: 0.018, a: 0.0005, v: v, flt: { type: 'bandpass', f: hi ? 3600 : 2500, q: 7 }, dest: tr.drums, verb: 0.4, verbDest: tr.verbDr }); }

  var TRACKS = {
    /* ---- outrun night drive: A minor, i-VI-III-VII, 16th-note bass, pumping pads, gated snare ---- */
    drive: {
      bpm: 104,
      ch: [{ b: 45, p: [57, 60, 64, 67] }, { b: 41, p: [53, 57, 60, 64] }, { b: 48, p: [55, 60, 64, 67] }, { b: 43, p: [55, 59, 62, 67] }],
      lead: [
        [[0, 76, 3], [3, 74, 1], [4, 76, 4], [8, 79, 4], [12, 76, 4]],
        [[0, 77, 3], [3, 76, 1], [4, 72, 4], [8, 77, 2], [10, 76, 2], [12, 72, 4]],
        [[0, 79, 6], [6, 76, 2], [8, 72, 4], [12, 74, 4]],
        [[0, 74, 3], [3, 72, 1], [4, 71, 8], [12, 67, 2], [14, 69, 2]]],
      lead2: [[[0, 69, 6], [6, 72, 2], [8, 76, 8]], [[0, 77, 8], [8, 76, 4], [12, 72, 4]], [[0, 76, 6], [6, 72, 2], [8, 67, 8]], [[0, 71, 8], [8, 74, 4], [12, 71, 4]]],
      build: function (tr) {
        tr.pad = Pad(tr, { n: 4, cut: 1600, q: 1, lvl: 0.068, dest: [[tr.cho, 1], [tr.verb, 0.35]] });
        tr.bass = Mono(tr, { osc: [['sawtooth', 0, -4, 1], ['square', -12, 3, 0.3]], cut: 480, q: 5, lvl: 0.24, dest: [[tr.out, 1]] });
        tr.arp = Mono(tr, { osc: [['square', 12, 0, 1]], cut: 2200, q: 3, lvl: 0.085, dest: [[tr.out, 1], [tr.dly, 0.7], [tr.verb, 0.25]] });
        tr.lead = Mono(tr, { osc: [['sawtooth', 0, -7, 1], ['sawtooth', 0, 8, 1]], cut: 2600, q: 1.6, vib: 14, lvl: 0.075, dest: [[tr.cho, 1], [tr.dly, 0.45], [tr.verb, 0.5]] });
      },
      step: function (tr, s, t, sp) {
        var bar = (s >> 4) & 7, st = s & 15, I = tr.I, ch = this.ch[bar & 3], beat = sp * 4;
        if (st === 0) {
          tr.pad.chord(ch.p, t);
          tr.pad.cutoff(1400 + I * 550 + (bar >= 4 ? 350 : 0), t, 0.6);
          if ((I >= 3 && (bar & 3) === 0) || (I >= 1 && bar === 0)) crash(tr, t, I >= 3 ? 0.9 : 0.6);
        }
        if ((st & 3) === 0) tr.pad.pump(t, beat, I >= 1 ? 0.72 : 0.55);
        if (tr.late) return;
        if (st === 0 || st === 8 || (I >= 2 && (st === 4 || st === 12)) || (I >= 1 && (bar & 3) === 3 && st === 10) || (I >= 3 && (bar & 1) && st === 14)) kick(tr, t, 1);
        if (st === 4 || st === 12) snare(tr, t, I >= 1 ? 0.8 : 0.6, I >= 2 ? 'both' : 'gated');
        if (I === 0) { if ((st & 3) === 2) hat(tr, t, 0.32); }
        else if (I === 1) { if ((st & 1) === 0) hat(tr, t, (st & 3) === 2 ? 0.34 : 0.18); if (st === 14 && (bar & 1)) hat(tr, t, 0.22, true); }
        else { hat(tr, t, (st & 3) === 2 ? 0.34 : (st & 1) ? 0.12 : 0.2); if (st === 14) hat(tr, t, 0.22, true); }
        // driving bass: straight 16ths, octave pops, accents
        var acc = [1, 0.55, 0.85, 0.6][st & 3], oct = (st & 3) === 2 ? 12 : 0, root = ch.b;
        if ((bar & 3) === 3 && st >= 14) root = this.ch[0].b - (st === 14 ? 3 : 1);
        if (I >= 1 || (st & 1) === 0) tr.bass.note(root + oct, t, sp * 0.6, acc, { fenv: 3 + acc * 3, fdec: 0.1, sus: 0.5, rel: 0.03, cut: 420 + I * 110 });
        if (I >= 1) {
          var seq = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 1, 3, 2, 4, 3, 1], idx = seq[st], m = idx === 4 ? ch.p[0] + 12 : ch.p[idx];
          tr.arp.note(m, t, sp * 0.55, (st & 3) === 0 ? 1 : 0.7, { fenv: 2.4, fdec: 0.09, sus: 0.3, rel: 0.05, cut: 1500 + I * 400 });
        }
        if (I >= 2) {
          var ph = bar >= 4 ? this.lead[bar - 4] : (I >= 3 ? this.lead2[bar] : null);
          if (ph) for (var i = 0; i < ph.length; i++) if (ph[i][0] === st) tr.lead.note(ph[i][1], t, ph[i][2] * sp * 0.9, 1, { glide: 0.02, fenv: 1.7, fdec: 0.3, sus: 0.75, atk: 0.01, rel: 0.12, vib: true });
        }
        if (I >= 3 && bar === 7 && st >= 12) tom(tr, t, [196, 165, 147, 110][st - 12], 0.8);
      }
    },
    /* ---- stealth: D minor, ticking clock, heartbeat, half-step ostinato, cold bells ---- */
    stealth: {
      bpm: 88,
      ch: [{ b: 38, p: [62, 65, 69] }, { b: 38, p: [62, 65, 70] }, { b: 38, p: [62, 67, 70] }, { b: 33, p: [61, 64, 69] }],
      bells: [81, 77, 74, 84, 86, 79],
      build: function (tr) {
        tr.pad = Pad(tr, { n: 3, type: 'sawtooth', cut: 900, q: 2, lvl: 0.085, spread: 0.7, dest: [[tr.cho, 1], [tr.verb, 0.6]] });
        tr.bass = Mono(tr, { osc: [['sawtooth', 0, 0, 1], ['sine', 0, 0, 0.45]], cut: 380, q: 3, lvl: 0.11, dest: [[tr.out, 1]] });
        tr.ost = Mono(tr, { osc: [[S.wSoft, 0, 0, 1]], cut: 1000, q: 4, lvl: 0.17, dest: [[tr.out, 1], [tr.dly, 0.35]] });
        tr.bell = Mono(tr, { osc: [['sine', 0, 0, 1], ['sine', 12, 3, 0.25]], cut: 6000, q: 0.5, lvl: 0.11, dest: [[tr.out, 0.7], [tr.dly, 0.8], [tr.verb, 0.9]] });
        tr.glass = Mono(tr, { osc: [['triangle', 0, 0, 1], ['sine', 7, 4, 0.4]], cut: 5000, q: 0.5, vib: 9, lvl: 0.045, dest: [[tr.cho, 1], [tr.verb, 0.9]] });
      },
      step: function (tr, s, t, sp) {
        var bar = (s >> 4) & 7, st = s & 15, I = tr.I, ch = this.ch[bar & 3], beat = sp * 4;
        if (st === 0) {
          tr.pad.chord(ch.p, t);
          tr.pad.swell(t, beat * 1.5, beat * 1, beat * 1.5, 0.8 + I * 0.15);
          tr.pad.cutoff(750 + I * 220 + ((bar & 3) === 3 ? 500 : 0), t, 1.2);
          tr.bass.note(ch.b, t, beat * 3.6, 1, { atk: 0.25, dec: 1, sus: 0.7, rel: 0.6, cut: 320 + I * 60 });
          if ((bar & 1) === 0) tr.glass.note([86, 81, 89, 85][(bar >> 1) & 3], t + beat, beat * 6, 1, { atk: 1.2, dec: 2, sus: 0.8, rel: 1.5, vib: true });
        }
        if (tr.late) return;
        // the clock
        if ((st & 1) === 0 && (I >= 1 || (st & 3) === 0)) clk(tr, t, (st & 3) === 0 ? 0.16 : 0.1, (st & 7) === 0);
        if (I >= 3 && (st & 1)) clk(tr, t, 0.05, false);
        // heartbeat
        if ((I >= 1 || (bar & 1) === 0) && (st === 0 || st === 3)) kick(tr, t, st === 0 ? 0.55 : 0.4);
        if (I >= 2 && st === 8) kick(tr, t, 0.35);
        if (I >= 3 && st === 8) snare(tr, t, 0.35, 'gated');
        if (I >= 2 && (st & 1) === 0) shaker(tr, t, (st & 3) === 2 ? 0.09 : 0.05);
        // half-step ostinato
        if (I >= 1 && (st & 1) === 0) {
          var o = [0, 0, 0, 0, 1, 0, 0, 0][st >> 1], base = (bar & 3) === 3 ? 45 : 50;
          tr.ost.note(base + o, t, sp * 1.2, (st & 3) === 0 ? 1 : 0.7, { fenv: 2.5, fdec: 0.1, sus: 0.3, rel: 0.05, cut: 600 + I * 200 });
        }
        // cold bells
        if ((st === 6 && (bar & 1)) || (I >= 2 && st === 14 && bar === 2)) tr.bell.note(pick(this.bells), t, sp * 2, 1, { atk: 0.002, dec: 0.6, sus: 0.15, rel: 0.4 });
        if (I >= 2 && (bar & 3) === 3 && st === 0) riserTr(tr, t, beat * 4);
      }
    },
    /* ---- free roam at sunset: F - G - Em - Am, lazy groove, singing lead ---- */
    free: {
      bpm: 94, swing: 0.06,
      ch: [{ b: 41, p: [53, 57, 60, 64] }, { b: 43, p: [55, 59, 62, 64] }, { b: 40, p: [52, 55, 59, 62] }, { b: 45, p: [55, 59, 60, 64] }],
      lead: [
        [[0, 72, 6], [6, 69, 2], [8, 72, 4], [12, 76, 4]],
        [[0, 74, 8], [8, 71, 4], [12, 67, 4]],
        [[0, 71, 6], [6, 67, 2], [8, 71, 4], [12, 74, 4]],
        [[0, 72, 10], [12, 76, 2], [14, 79, 2]],
        [[0, 81, 6], [6, 79, 2], [8, 76, 4], [12, 72, 4]],
        [[0, 74, 6], [6, 76, 2], [8, 79, 8]],
        [[0, 76, 4], [4, 74, 4], [8, 71, 4], [12, 67, 4]],
        [[0, 69, 12], [12, 71, 2], [14, 72, 2]]],
      build: function (tr) {
        tr.pad = Pad(tr, { n: 4, cut: 2000, q: 0.6, lvl: 0.06, spread: 1.2, dest: [[tr.cho, 1], [tr.verb, 0.5]] });
        tr.bass = Mono(tr, { osc: [['sawtooth', 0, 0, 1], ['triangle', -12, 0, 0.6]], cut: 700, q: 1.5, lvl: 0.24, dest: [[tr.out, 1]] });
        tr.lead = Mono(tr, { osc: [['triangle', 0, -5, 1], ['sawtooth', 0, 6, 0.45]], cut: 1900, q: 1, vib: 16, lvl: 0.12, dest: [[tr.cho, 1], [tr.dly, 0.5], [tr.verb, 0.6]] });
        tr.arp = Mono(tr, { osc: [['triangle', 12, 0, 1]], cut: 3000, q: 1, lvl: 0.1, dest: [[tr.out, 0.6], [tr.dly, 0.8], [tr.verb, 0.4]] });
      },
      step: function (tr, s, t, sp) {
        var bar = (s >> 4) & 7, st = s & 15, I = tr.I, ch = this.ch[bar & 3], beat = sp * 4;
        if (st === 0) {
          tr.pad.chord(ch.p, t); tr.pad.cutoff(1700 + I * 400, t, 0.8);
          tr.pad.swell(t, 0.08, beat * 3.2, beat * 0.8, 1);
          if (bar === 0 && I >= 1) crash(tr, t, 0.45);
        }
        if (tr.late) return;
        if (st === 0 || st === 8 || (I >= 1 && st === 10 && (bar & 1)) || (I >= 3 && (st === 4 || st === 12))) kick(tr, t, 0.85);
        if (st === 4 || st === 12) snare(tr, t, I >= 2 ? 0.5 : 0.42, I >= 2 ? 'both' : 'clap');
        if ((st & 1) === 0) hat(tr, t, (st & 3) === 2 ? 0.2 : 0.11);
        if (I >= 1 && (st & 1)) shaker(tr, t, 0.06);
        if (I >= 2 && (st === 6 || st === 14)) hat(tr, t, 0.15, true);
        var pat = [[0, 0, 3], [3, 0, 1], [6, 12, 2], [8, 0, 2], [10, 7, 2], [12, 12, 1], [14, 0, 2]];
        for (var i = 0; i < pat.length; i++) if (pat[i][0] === st) tr.bass.note(ch.b + pat[i][1], t, pat[i][2] * sp * 0.85, st === 0 ? 1 : 0.8, { glide: 0.012, fenv: 2.2, fdec: 0.16, sus: 0.6, rel: 0.05 });
        // the melody sings every other phrase at rest, always once things heat up
        if (I >= 1 || (s >> 7) % 2 === 1) {
          var ph = this.lead[bar];
          for (var k = 0; k < ph.length; k++) if (ph[k][0] === st) tr.lead.note(ph[k][1], t, ph[k][2] * sp * 0.92, 1, { glide: 0.03, atk: 0.02, dec: 0.4, sus: 0.8, rel: 0.25, fenv: 1.4, fdec: 0.4, vib: true });
        }
        if (I >= 2 && (st & 1) === 0) {
          var seq = [0, 1, 2, 3, 2, 1, 2, 3];
          tr.arp.note(ch.p[seq[st >> 1]] + 12, t, sp * 0.9, 0.8, { atk: 0.003, dec: 0.2, sus: 0.2, rel: 0.1 });
        }
      }
    }
  };
  function riserTr(tr, t, d) {
    noise({ t: t, buf: S.pink, d: 0.05, a: d, v: 0.12, flt: { type: 'bandpass', f: 300, f1: 4500, q: 2.5, dur: d }, dest: tr.drums, verb: 0.5, verbDest: tr.verbDr });
  }

  function Track(name, t0) {
    var def = TRACKS[name], f = musFX(), c = S.ctx;
    f.idleAt = 0;
    glide(f.verbRet.gain, 0.6, t0, 0.03); glide(f.dlyRet.gain, 0.5, t0, 0.03); glide(f.choRet.gain, 0.75, t0, 0.03);
    var tr = { name: name, def: def, nodes: [], srcs: [], s: 0, next: t0, I: S.musI, stopAt: 0, lateAt: 0, late: false, dead: false };
    tr.out = tgain(tr, 0, f.dry); tr.cho = tgain(tr, 0, f.choIn); tr.verb = tgain(tr, 0, f.verbIn); tr.dly = tgain(tr, 0, f.dlyIn);
    tr.faders = [tr.out, tr.cho, tr.verb, tr.dly];
    tr.drums = tgain(tr, 0.8, tr.out);
    tr.verbDr = tgain(tr, 0.5, tr.verb);
    tr.kit = Kit(tr);
    def.build(tr);
    tr.srcs.forEach(function (s) { s.start(t0); });
    var sp = 60 / def.bpm / 4, dly = sp * 3;                    // dotted-8th echoes
    f.dL.delayTime.setTargetAtTime(dly, t0, 0.05); f.dR.delayTime.setTargetAtTime(dly, t0, 0.05);
    return tr;
  }
  // equal-power fades on all of a track's faders (piecewise-linear, so it can be interrupted safely)
  function fadeTrack(tr, to, t, dur) {
    var from = tr.faders[0].gain.value, n = 8;
    if (!(from >= 0 && from <= 1.5)) from = to > 0.5 ? 0 : 1;
    dur = Math.max(0.02, dur);
    tr.faders.forEach(function (g) {
      var p = g.gain; holdAt(p, t);
      for (var i = 1; i <= n; i++) {
        var u = i / n, v = to > from ? from + (to - from) * Math.sin(u * Math.PI / 2) : to + (from - to) * Math.cos(u * Math.PI / 2);
        p.linearRampToValueAtTime(v, t + dur * u);
      }
    });
  }
  function killTrack(tr) {
    if (tr.dead) return; tr.dead = true;
    tr.srcs.forEach(function (s) { try { s.stop(); } catch (e) {} });
    tr.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
    S.pn -= tr.nodes.length; tr.nodes = []; tr.srcs = [];
  }
  function retire(tr, t, fade) {
    if (tr.stopAt && tr.stopAt <= t + fade + 0.05) return;
    fadeTrack(tr, 0, t, fade);
    tr.stopAt = t + fade + 0.05;
    tr.lateAt = t + fade * 0.45;            // drums and leads drop out half-way, pads/bass carry the fade
  }
  function musicSchedule(t) {
    if (!S.tracks.length) return;
    var on = enabled();
    for (var i = 0; i < S.tracks.length; i++) {
      var tr = S.tracks[i]; if (tr.dead) continue;
      var sp = 60 / tr.def.bpm / 4, sw = tr.def.swing || 0;
      if (tr.next < t - 0.2) tr.next = t + 0.02;          // fell behind (throttled timer): skip, don't burst
      while (tr.next < t + 0.12 && (!tr.stopAt || tr.next < tr.stopAt)) {
        if ((tr.s & 3) === 0) { if (S.musI > tr.I && !tr.stopAt && on && tr.name !== 'stealth') crash(tr, tr.next, 0.55); tr.I = S.musI; }
        tr.late = tr.lateAt && tr.next > tr.lateAt;
        if (on) tr.def.step(tr, tr.s, tr.next, sp);
        tr.next += sp * ((tr.s & 1) ? 1 - sw : 1 + sw);
        tr.s++;
      }
      if (tr.stopAt && t > tr.stopAt) killTrack(tr);
    }
    S.tracks = S.tracks.filter(function (x) { return !x.dead; });
  }
  function music(track, opts) {
    if (!ready()) return;
    var name = track && TRACKS[track] ? track : null, t = now(), fade = clamp(opts && opts.fade != null ? opts.fade : 2.2, 0.05, 8);
    if (S.cur && !S.cur.dead && !S.cur.stopAt && S.cur.name === name) return;
    if (!S.cur && !name) return;
    var a = AS(); if (name && a.musicOn && a.stopMusic) a.stopMusic();   // never two scores at once
    if (S.cur) retire(S.cur, t, fade);
    S.cur = null;
    if (name) {
      var tr = Track(name, t + 0.05);
      fadeTrack(tr, 1, t + 0.05, S.tracks.length ? fade * 0.6 : 0.4);
      S.tracks.push(tr); S.cur = tr;
    }
    wake();
  }
  function musicIntensity(n) { pendingI = clamp(Math.round(num(n, 0)), 0, 3); if (S) S.musI = pendingI; }

  /* ================================================================ housekeeping */
  function wake() { if (manual || timer) return; timer = setInterval(tick, 25); }
  function stopTimer() { if (timer) clearInterval(timer); timer = null; }
  function tick() {
    var a = AS();
    if (!S || !a || a.ctx !== S.ctx) { stopTimer(); return; }
    if (!a.live()) return;
    var t = now();
    musicSchedule(t);
    sirenSchedule(t);
    ambEvents(t);
    for (var k in S.voices) {
      var v = S.voices[k];
      // watchdog: a moving-object voice the game stopped feeding fades out by itself
      if ((k === 'engine' || k === 'skid' || k === 'siren') && !v.killAt && t - v.seen > 0.35 && t > (v.override || 0)) vrelease(v, t, 0.1, 1);
      if (v.killAt && t > v.killAt) vkill(v);
    }
    for (var i = S.reap.length - 1; i >= 0; i--) if (t > S.reap[i].at) { S.reap[i].fn(); S.reap.splice(i, 1); }
    if (S.mfx && !S.tracks.length && !S.mfx.idleAt) S.mfx.idleAt = t + 3;
    if (S.mfx && S.tracks.length) S.mfx.idleAt = 0;
    if (S.mfx && S.mfx.idleAt && t > S.mfx.idleAt) killFX();
    var busy = S.tracks.length || S.reap.length || S.mfx; for (k in S.voices) { busy = true; break; }
    if (!busy) stopTimer();
  }
  function hardReset() {
    stopTimer();
    S = null; lastSfx = {};
  }

  /* ================================================================ public */
  function stopAll() {
    if (!S) return;
    var a = AS(); if (!a || a.ctx !== S.ctx) { hardReset(); return; }
    var t = now();
    for (var k in S.voices) { var v = S.voices[k]; holdAt(v.out.gain, t); glide(v.out.gain, 0, t, 0.05); if (v.road) { holdAt(v.road.gain, t); glide(v.road.gain, 0, t, 0.05); } v.killAt = t + 0.35; v.override = 0; v.seen = t; v.on = false; }
    S.tracks.forEach(function (tr) { retire(tr, t, 0.25); });
    S.cur = null;
    if (S.mfx) { var f = S.mfx; [f.verbRet, f.dlyRet, f.choRet].forEach(function (g) { glide(g.gain, 0, t, 0.06); }); f.idleAt = t + 0.6; }
    // silence anything already scheduled ahead (stings, pops) and the sfx reverb tail
    var old = S.gen; glide(old.dry.gain, 0, t, 0.03); glide(old.verb.gain, 0, t, 0.03);
    S.reap.push({ at: t + 0.4, fn: function () { try { old.dry.disconnect(); old.verb.disconnect(); } catch (e) {} S.pn -= 2; } });
    if (S.sfxVerb) { var r = S.sfxVerb.ret.gain; glide(r, 0, t, 0.06); r.setTargetAtTime(0.5, t + 1.6, 0.05); }
    if (S.echo) { var eo = S.echo.out.gain; glide(eo, 0, t, 0.04); S.echo.fb.gain.setTargetAtTime(0, t, 0.02); eo.setTargetAtTime(0.55, t + 1.6, 0.05); S.echo.fb.gain.setTargetAtTime(0.32, t + 1.6, 0.05); }
    newGen();
    S.step.ph = 0; S.step.last = -1;
    S.musI = pendingI = 0;            // a fresh chapter starts calm
    duck(false);
    wake();
  }
  function duck(on) {
    if (!S) return;
    var a = AS(); if (!a || a.ctx !== S.ctx) return;
    on = !!on; S.duck = on;
    var t = now();
    glide(S.musOut.gain, on ? 0.16 : 1, t, on ? 0.12 : 0.35);
    glide(S.sfxOut.gain, on ? 0.22 : 1, t, on ? 0.1 : 0.3);
  }
  // call once when the chapter loads (after AudioSys.init): pre-computes the engine wave and reverb
  // impulse responses so the first engine()/music() call never hitches a frame
  function init() {
    if (!ready()) return false;
    var c = S.ctx;
    if (!S.wEngine) S.wEngine = engineWave(c);
    if (!S.irMus) S.irMus = irBuf(c, 2.0, 1.9, 0.02, 0.5);
    if (!S.irSfx) S.irSfx = irBuf(c, 1.1, 0.95, 0.012, 0.55);
    return true;
  }
  function stats() {
    if (!S) return { ready: false };
    var vs = []; for (var k in S.voices) vs.push(k);
    return { ready: true, persistentNodes: S.pn, oneShotNodes: S.on, voices: vs, track: S.cur ? S.cur.name : null,
      tracks: S.tracks.map(function (x) { return x.name + (x.stopAt ? '(out)' : ''); }), intensity: S.musI, ducked: S.duck, timer: !!timer };
  }

  return {
    __isHAudio: true,
    init: init,
    engine: engine,
    skid: skid,
    siren: siren,
    ambience: ambience,
    footsteps: footsteps,
    step: step,
    sfx: sfx,
    music: music,
    musicIntensity: musicIntensity,
    stopAll: stopAll,
    duck: duck,
    stats: stats,
    tracks: ['drive', 'stealth', 'free'],
    sfxNames: Object.keys(GAP).concat(['alarm', 'alarmStop']).filter(function (n, i, arr) { return arr.indexOf(n) === i; }),
    // test hooks: drive housekeeping by hand (OfflineAudioContext renders)
    _test: { manual: function (on) { manual = !!on; if (manual) stopTimer(); }, tick: tick, reset: hardReset }
  };
})();
