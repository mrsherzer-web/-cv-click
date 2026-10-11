/* Katzir FC — audio: WebAudio SFX + loops, ElevenLabs voice clips, Hebrew speech fallback. */
window.KFC = window.KFC || {};

KFC.Audio = (function () {
  'use strict';
  const SFX = ['crowd_loop', 'chant_loop', 'roar', 'ooh', 'whistle', 'whistle_long', 'kick', 'net', 'post', 'pack', 'boom', 'tap', 'coin', 'whoosh'];
  let ctx = null, master = null, sfxBus = null, loopBus = null, voiceBus = null;
  const buffers = {};
  const loading = {};
  const loops = {};
  let enabled = true, voiceEnabled = true;
  let heVoice = null;
  let subtitleCb = null;
  let duckTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = enabled ? 1 : 0; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.ratio.value = 4; comp.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    loopBus = ctx.createGain(); loopBus.gain.value = 0.55; loopBus.connect(comp);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.0; voiceBus.connect(comp);
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    SFX.forEach(n => load(n));
  }

  function load(name, url) {
    if (buffers[name] || loading[name]) return loading[name] || Promise.resolve(buffers[name]);
    const c = ensure();
    if (!c) return Promise.resolve(null);
    const src = url || ('assets/audio/' + name + '.mp3');
    loading[name] = fetch(src)
      .then(r => { if (!r.ok) throw new Error(src + ' ' + r.status); return r.arrayBuffer(); })
      .then(ab => new Promise((res, rej) => c.decodeAudioData(ab, res, rej)))
      .then(buf => { buffers[name] = buf; return buf; })
      .catch(err => { console.warn('audio', err); return null; });
    return loading[name];
  }

  function play(name, opts) {
    opts = opts || {};
    const c = ensure();
    if (!c || !enabled) return null;
    const buf = buffers[name];
    if (!buf) { load(name); return null; }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate || 1;
    const g = c.createGain();
    g.gain.value = opts.vol == null ? 1 : opts.vol;
    let node = g;
    if (opts.pan && c.createStereoPanner) {
      const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p); node = p;
    }
    src.connect(g);
    node.connect(opts.bus === 'voice' ? voiceBus : sfxBus);
    src.start(c.currentTime + (opts.delay || 0));
    return src;
  }

  function loop(name, vol, fade) {
    const c = ensure();
    if (!c) return;
    if (loops[name]) { setLoopVol(name, vol, fade); return; }
    const start = buf => {
      if (!buf || loops[name]) return;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const g = c.createGain(); g.gain.value = 0;
      src.connect(g); g.connect(loopBus); src.start();
      loops[name] = { src, g };
      setLoopVol(name, vol, fade == null ? 1.2 : fade);
    };
    if (buffers[name]) start(buffers[name]); else load(name).then(start);
  }

  function setLoopVol(name, vol, fade) {
    const l = loops[name];
    if (!l || !ctx) return;
    const t = ctx.currentTime;
    l.g.gain.cancelScheduledValues(t);
    l.g.gain.setValueAtTime(l.g.gain.value, t);
    l.g.gain.linearRampToValueAtTime(vol, t + (fade || 0.01));
  }

  function stopLoop(name, fade) {
    const l = loops[name];
    if (!l || !ctx) return;
    const t = ctx.currentTime;
    l.g.gain.cancelScheduledValues(t);
    l.g.gain.setValueAtTime(l.g.gain.value, t);
    l.g.gain.linearRampToValueAtTime(0, t + (fade || 0.6));
    const src = l.src;
    setTimeout(() => { try { src.stop(); } catch (e) { /* already stopped */ } }, ((fade || 0.6) + 0.1) * 1000);
    delete loops[name];
  }

  function duck(seconds) {
    if (!ctx || !loopBus) return;
    const t = ctx.currentTime;
    loopBus.gain.cancelScheduledValues(t);
    loopBus.gain.setValueAtTime(loopBus.gain.value, t);
    loopBus.gain.linearRampToValueAtTime(0.25, t + 0.15);
    clearTimeout(duckTimer);
    duckTimer = setTimeout(() => {
      if (!ctx) return;
      const t2 = ctx.currentTime;
      loopBus.gain.cancelScheduledValues(t2);
      loopBus.gain.setValueAtTime(loopBus.gain.value, t2);
      loopBus.gain.linearRampToValueAtTime(0.55, t2 + 0.8);
    }, seconds * 1000);
  }

  // --- Hebrew speech fallback -------------------------------------------------------
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = window.speechSynthesis.getVoices() || [];
    heVoice = vs.find(v => /^he|^iw/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    try { window.speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) { /* old browsers */ }
  }

  function speak(text) {
    if (!enabled || !voiceEnabled || !heVoice || !('speechSynthesis' in window)) return 0;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = heVoice; u.lang = heVoice.lang; u.rate = 1.12; u.pitch = 1.05; u.volume = 1;
      window.speechSynthesis.speak(u);
      return Math.min(5, 0.9 + text.length * 0.065);
    } catch (e) { return 0; }
  }

  // Say a commentary line: recorded clip if we have one, otherwise speech; always subtitle.
  let lastLineAt = 0;
  function line(id, opts) {
    opts = opts || {};
    const L = KFC.DATA.LINES[id];
    if (!L) return;
    const now = performance.now();
    if (!opts.force && now - lastLineAt < 1600) return;
    lastLineAt = now;
    if (subtitleCb) subtitleCb(L.text);
    if (!enabled || !voiceEnabled) return;
    if (L.audio) {
      const name = 'vo:' + id;
      const go = buf => {
        if (!buf) { const d = speak(L.text); if (d) duck(d); return; }
        play(name, { bus: 'voice', vol: 1.15 });
        duck(buf.duration + 0.3);
      };
      if (buffers[name]) go(buffers[name]); else load(name, L.audio).then(go);
    } else {
      const d = speak(L.text);
      if (d) duck(d);
    }
  }

  function preloadLines() {
    Object.keys(KFC.DATA.LINES).forEach(id => {
      const L = KFC.DATA.LINES[id];
      if (L.audio) load('vo:' + id, L.audio);
    });
  }

  return {
    unlock, load, play, loop, stopLoop, setLoopVol, line, preloadLines, duck,
    setEnabled(v) {
      enabled = !!v;
      if (master && ctx) master.gain.setTargetAtTime(enabled ? 1 : 0, ctx.currentTime, 0.05);
      if (!enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    setVoice(v) { voiceEnabled = !!v; if (!v && 'speechSynthesis' in window) window.speechSynthesis.cancel(); },
    onSubtitle(fn) { subtitleCb = fn; },
    hasHebrewVoice: () => !!heVoice,
    get enabled() { return enabled; }
  };
})();
