// Chapter nine's atmosphere in headless Chromium: rain (streaks, splashes, the darker and bluer light, its
// sound) on and off, red alert in an area on and off, the mission music ('action', 'calm', none), the gas
// hiss and the heartbeat, the daze, the eyelids, the covered minimap and the flash, and Nehorai's slow
// walk (speedScale). Every one of them is switched on and off ten times and must leave nothing behind (no
// new scene objects, no audio sources still running, no timer), rain must stay inside the phone's draw-call
// budget, and the page must report no errors. The loop is held and stepped here (game.hold, game.update)
// so game time is exact at 1-2 frames a second.
// usage: node tests/atmosphere.test.mjs [url] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const shots = process.argv[3] || new URL('../test-results/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
ctx.setDefaultTimeout(240000);
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
// every audio node the page makes is counted, so a leak (or a node made every frame) shows
await page.addInitScript(() => {
  window.__audioMade = 0;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  for (const k of ['createOscillator', 'createBufferSource', 'createGain', 'createBiquadFilter']) {
    const f = AC.prototype[k];
    AC.prototype[k] = function (...a) { window.__audioMade++; return f.apply(this, a); };
  }
});
const G = (fn, arg) => page.evaluate(fn, arg);
const snap = (name) => page.screenshot({ path: `${shots}/${name}.png` });
// real time, for the audio (its clock and its clean-up timers run in real time): poll until true
async function poll(fn, ms, arg) { const end = Date.now() + ms; for (;;) { const v = await G(fn, arg); if (v || Date.now() > end) return v; await page.waitForTimeout(150); } }

await page.goto(url);
await page.waitForFunction(() => window.__game && !document.getElementById('startBtn').disabled, null, { timeout: 180000 });
await page.tap('#startBtn');
await page.waitForFunction(() => window.__game.state.started, null, { timeout: 60000 });
await G(() => {
  const W = window.__game, g = W.debug.game;
  g.missions.stop(); g.cutscene = false; g.setPopulation({ traffic: 0, people: 0 });
  g.hold = true; // the loop stops; the test steps the game itself
  // n steps of 1/30 s of game time (the world, the light, the effects), then one picture
  window.__step = (n = 1, render = true) => {
    const W = window.__game, g = W.debug.game, d = g.daylight;
    for (let i = 0; i < n; i++) { g.update(1 / 30); d.update(1 / 30); }
    if (render) { d.sky.follow(W.debug.camera, g.nehorai.root.position); W.debug.world.tick(W.debug.camera, 1 / 30); W.debug.renderer.render(W.debug.scene, W.debug.camera); }
    return W.debug.renderer.info.render.calls;
  };
  window.__count = () => { let n = 0; W.debug.scene.traverse(() => n++); return { children: W.debug.scene.children.length, objects: n }; };
});
const audio = await G(() => { const s = window.__game.debug.game.sound; return { ctx: !!s.ctx, state: s.ctx?.state }; });
check('the game starts, sound running', audio.ctx && audio.state === 'running', audio.state);
check('the overlay is on the game (game.overlay) and takes no touch', await G(() => { const o = window.__game.debug.game.overlay, el = document.elementFromPoint(150, 290); return !!o && !!document.getElementById('overlay') && getComputedStyle(document.getElementById('overlay')).pointerEvents === 'none' && !el.closest('#overlay'); }));
const baseVoices = await G(() => window.__game.debug.game.sound.voices);

// ---------- rain at night, on the open ground by the Iron Base ----------
await G(() => { const W = window.__game, g = W.debug.game; W.teleport(1120, -200); g.daylight.set(1, 0); W.setCamera(0.6, 0.15); });
const dry = await G(() => window.__step(10));
const hemiDry = await G(() => { const s = window.__game.debug.game.daylight.sky; return { hemi: s.hemi.intensity, color: s.hemi.color.getHexString(), fog: window.__game.debug.scene.fog.color.getHexString() }; });
await G(() => window.__game.debug.game.fx.rain(true, { strength: 1 }));
let rainy = await G(() => window.__step(100)); // over three seconds of game time: the rain and the light have come in
const rs = await G(() => { const g = window.__game.debug.game, F = g.fx.rainFx, s = g.daylight.sky; return { level: g.fx.rainLevel, inScene: !!F.mesh.parent, drops: F.geo.drawRange.count / 6, splashes: F.splash.n, wet: g.daylight.wet, hemi: s.hemi.intensity, color: s.hemi.color.getHexString(), fog: window.__game.debug.scene.fog.color.getHexString(), sound: !!g.sound.rainNode }; });
check('rain on: streaks around the camera (a few thousand at most) and splashes on the ground', rs.level === 1 && rs.inScene && rs.drops > 1000 && rs.drops <= 3000 && rs.splashes > 10, `${rs.drops} drops, ${rs.splashes} splashes`);
check('rain on: the light darker and bluer, the sound of rain', rs.wet === 1 && rs.hemi < hemiDry.hemi * 0.8 && rs.color !== hemiDry.color && rs.sound, `hemi ${hemiDry.hemi.toFixed(2)} → ${rs.hemi.toFixed(2)}, #${hemiDry.color} → #${rs.color}, fog #${hemiDry.fog} → #${rs.fog}`);
check('rain costs at most two draw calls and stays inside the phone budget', rainy - dry <= 2 && rainy < 150, `${dry} → ${rainy} calls`);
await snap('atm1-rain-night');
// a frame-time check: the CPU side of rain (fx.update) and the draw itself, rain on against off
const cost = await G(() => {
  const W = window.__game, g = W.debug.game, R = W.debug.renderer, sc = W.debug.scene, cam = W.debug.camera, T = () => performance.now();
  const time = (n, f) => { const a = T(); for (let i = 0; i < n; i++) f(); return (T() - a) / n; };
  const fxOn = time(30, () => g.fx.update(1 / 30, cam));
  const drawOn = time(4, () => R.render(sc, cam));
  const F = g.fx.rainFx; F.mesh.visible = false; F.splash.points.visible = false;
  const drawOff = time(4, () => R.render(sc, cam));
  F.mesh.visible = true;
  return { fxOn, drawOn, drawOff };
});
check('rain is cheap: well under a millisecond of CPU a frame, a few milliseconds more to draw even in software rendering', cost.fxOn < 1 && cost.drawOn < cost.drawOff * 1.2 + 5, `fx.update ${cost.fxOn.toFixed(3)} ms; draw ${cost.drawOff.toFixed(1)} → ${cost.drawOn.toFixed(1)} ms`);
// under a roof: no streaks, the sound muffled
await G(() => window.__game.debug.game.fx.rain(true, { strength: 1, under: () => true }));
await G(() => window.__step(60, false));
const roof = await G(() => { const g = window.__game.debug.game; return { level: g.fx.rainLevel, visible: g.fx.rainFx.mesh.visible, muffled: g.sound.rainMuffled, sound: !!g.sound.rainNode }; });
check('rain under a roof: no streaks drawn, the rain heard muffled overhead', roof.level === 0 && !roof.visible && roof.muffled && roof.sound);
await G(() => window.__game.debug.game.fx.rain(true, { strength: 1, under: null }));
await G(() => window.__game.debug.game.fx.rain(false));
await G(() => window.__step(100, false));
const off = await G(() => { const g = window.__game.debug.game, s = g.daylight.sky; return { level: g.fx.rainLevel, inScene: !!g.fx.rainFx.mesh.parent, wet: g.daylight.wet, color: s.hemi.color.getHexString(), hemi: s.hemi.intensity }; });
check('rain off: the streaks leave the scene and the light comes back', off.level === 0 && !off.inScene && off.wet === 0 && off.color === hemiDry.color && Math.abs(off.hemi - hemiDry.hemi) < 1e-6);
check('rain off: its sound fades and is let go', !!(await poll(() => !window.__game.debug.game.sound.rainNode, 5000)));

// ---------- red alert in the hideout's hall (chapter eight) ----------
await G(() => { const W = window.__game, g = W.debug.game; W.teleport(640, -60); W.setCamera(0.3, 0.2); });
await G(() => window.__step(5));
const calm = await G(() => window.__game.debug.game.daylight.sky.hemi.color.getHexString());
await G(() => window.__game.debug.game.fx.redAlert(true, { at: { x: 640, z: -60 }, r: 24 }));
const flashes = [];
for (let i = 0; i < 6; i++) flashes.push(await G(() => { window.__step(4, false); return window.__game.debug.game.fx.alertLights[0].intensity; }));
await G(() => window.__step(1));
const ra = await G(() => { const g = window.__game.debug.game; return { lamps: g.fx.alertLights.filter((l) => l.parent).length, red: g.daylight.alert, edge: g.overlay.state.alert, color: g.daylight.sky.hemi.color }; });
check('red alert: two pooled red lamps flash in the area', ra.lamps === 2 && Math.max(...flashes) > 30 && Math.min(...flashes) < Math.max(...flashes) * 0.5, `lamp intensity ${flashes.map((v) => v.toFixed(0)).join(' ')}`);
check('red alert: inside it the light and the screen\'s edges go red', ra.red > 0.5 && ra.edge > 0.1 && ra.color.r > ra.color.b * 1.5, `ambient red ${ra.red.toFixed(2)}, edges ${ra.edge.toFixed(2)}`);
await snap('atm2-red-alert');
await G(() => { window.__game.teleport(760, -60); }); // well outside it
await G(() => window.__step(40, false));
check('red alert: outside the area the ambient light and the edges are clear again', await G(() => { const g = window.__game.debug.game; return g.daylight.alert < 0.02 && g.overlay.state.alert < 0.02; }));
await G(() => window.__game.debug.game.fx.redAlert(false));
await G(() => window.__step(60, false));
check('red alert off: the lamps leave the scene, the light as it was', await G((calm) => { const g = window.__game.debug.game; return g.fx.alertLights.every((l) => !l.parent) && g.daylight.alert === 0 && g.overlay.state.alert === 0 && g.daylight.sky.hemi.color.getHexString() === calm; }, calm));

// ---------- music, gas, heartbeat ----------
await G(() => window.__game.debug.game.sound.music('action'));
const act = await poll(() => { const s = window.__game.debug.game.sound; return s.song?.mode === 'action' && s.voices > 3 && s.timer ? s.voices : 0; }, 4000);
const made0 = await G(() => window.__audioMade);
await page.waitForTimeout(2000);
const made1 = await G(() => window.__audioMade);
check('music "action": drums, bass and pad scheduled ahead (nodes made per note, not per frame)', !!act && made1 - made0 < 400, `${act} voices playing; ${made1 - made0} nodes in 2 s`);
await G(() => window.__game.debug.game.sound.music('calm'));
const cm = await G(() => { const s = window.__game.debug.game.sound; return { mode: s.song?.mode, fading: s.fading.map((f) => f.mode) }; });
check('music "calm": the action fades out under the new pad', cm.mode === 'calm' && cm.fading.includes('action'));
check('the action song is let go once faded', !!(await poll(() => window.__game.debug.game.sound.fading.length === 0, 5000)));
await G(() => window.__game.debug.game.sound.music(null));
check('music off: the song fades, its voices end, the timer stops', !!(await poll((b) => { const s = window.__game.debug.game.sound; return !s.song && !s.fading.length && !s.timer && s.voices === b; }, 6000, baseVoices)));
check('music under the master mute', await G(() => { const s = window.__game.debug.game.sound; s.music('action'); const bus = s.song.bus, ok = !!bus && s.musicMode === 'action'; s.setMuted(true); const muted = s.muted; s.setMuted(false); s.music(null, { fade: 0.1 }); return ok && muted; }));
// what they sound like: each rendered offline through the same code, loud enough and never clipping
const levels = await G(async () => {
  const Sound = window.__game.debug.game.sound.constructor, out = {};
  const make = (sec) => {
    const ctx = new OfflineAudioContext(1, 44100 * sec, 44100), s = new Sound();
    s.ctx = ctx; s.master = ctx.createGain(); s.master.gain.value = 0.8; s.master.connect(ctx.destination);
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; s.noise = buf;
    return { ctx, s };
  };
  const measure = async (ctx, from) => { const b = await ctx.startRendering(), d = b.getChannelData(0); let peak = 0, sum = 0, n = 0; for (let i = Math.floor(from * 44100); i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; n++; } return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) }; };
  for (const mode of ['action', 'calm']) {
    const { ctx, s } = make(mode === 'action' ? 10 : 16), song = mode === 'action' ? s.actionSong() : s.calmSong();
    song.bus.gain.value = s.musicVolume;
    for (let st = 0, t = 0.05; t < ctx.length / 44100 - 0.5; st++, t += song.dt) song.play(st, t);
    out[mode] = await measure(ctx, mode === 'action' ? 4 : 2);
  }
  { const { ctx, s } = make(4); s.rain(1); out.rain = await measure(ctx, 1.5); }
  { const { ctx, s } = make(3); s.gas(2); out.gas = await measure(ctx, 0.5); }
  { const { ctx, s } = make(3); const b = { f: ctx.createBiquadFilter(), bus: ctx.createGain() }; b.f.type = 'lowpass'; b.f.frequency.value = 140; b.bus.gain.value = 0.5; b.f.connect(b.bus); b.bus.connect(s.master); for (let t = 0.1; t < 2.6; t += 60 / 70) { s.thump(b, t, 1); s.thump(b, t + 0.21, 0.65); } out.heartbeat = await measure(ctx, 0); }
  return out;
});
for (const [k, v] of Object.entries(levels)) check(`${k}: heard (rendered offline) and never clipping`, v.rms > 0.004 && v.peak < 0.98, `peak ${v.peak}, rms ${v.rms}`);
await G(() => { const s = window.__game.debug.game.sound; s.gas(1); s.heartbeat(true, { bpm: 80 }); });
const hb = await poll(() => { const s = window.__game.debug.game.sound; return s.beat && s.voices > 1 ? s.voices : 0; }, 3000);
check('the gas hiss and a muffled heartbeat play', !!hb, `${hb} voices`);
await G(() => window.__game.debug.game.sound.heartbeat(false));
check('heartbeat off and the gas ended: nothing left running', !!(await poll((b) => { const s = window.__game.debug.game.sound; return !s.beat && !s.timer && s.voices === b; }, 6000, baseVoices)));

// ---------- the overlay: daze, eyelids, the covered map, the flash ----------
await G(() => { const W = window.__game, g = W.debug.game; g.daylight.set(0, 0); W.teleport(640, -60); g.overlay.daze(0.8, 0.5); });
await G(() => window.__step(30));
const dz = await G(() => { const o = window.__game.debug.game.overlay, v = document.getElementById('view'), el = o.dazeEl; return { daze: o.state.daze, opacity: +getComputedStyle(el).opacity, blur: (el.style.backdropFilter || el.style.webkitBackdropFilter || v.style.filter || ''), sway: v.style.transform }; });
check('daze 0.8: the view blurred, the edges dark, a slight sway', Math.abs(dz.daze - 0.8) < 1e-6 && dz.opacity > 0.7 && /blur/.test(dz.blur) && /rotate/.test(dz.sway), `${dz.blur}; ${dz.sway}`);
// the stick still walks him while dazed: touches go through the layer
const cdp = await ctx.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4, force: 1 })) });
const p0 = await G(() => ({ ...window.__game.debug.game.player.pos }));
await touch('touchStart', [{ x: 150, y: 290 }]); await touch('touchMove', [{ x: 150, y: 250 }]); await touch('touchMove', [{ x: 150, y: 215 }]);
await G(() => window.__step(30, false));
await touch('touchEnd', []);
const p1 = await G(() => ({ ...window.__game.debug.game.player.pos }));
check('dazed, the joystick still works (the layer takes no touch)', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 1, `${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2)} m`);
await G(() => window.__step(1));
await snap('atm3-daze');
await G(() => window.__game.debug.game.overlay.eyes(0.6, 0.3));
await G(() => window.__step(15));
check('the eyelids close', await G(() => window.__game.debug.game.overlay.state.eyes === 0.6));
await snap('atm4-eyes');
await G(() => { const o = window.__game.debug.game.overlay; o.eyes(0, 0.3); o.daze(0, 0.5); });
await G(() => window.__step(30));
const clear = await G(() => { const o = window.__game.debug.game.overlay, v = document.getElementById('view'); return { daze: o.state.daze, eyes: o.state.eyes, opacity: +getComputedStyle(o.dazeEl).opacity, sway: v.style.transform, blur: o.dazeEl.style.backdropFilter || o.dazeEl.style.webkitBackdropFilter || v.style.filter || '' }; });
check('daze 0: the view sharp and still again', clear.daze === 0 && clear.eyes === 0 && clear.opacity === 0 && !clear.sway && !clear.blur);
await G(() => window.__game.debug.game.overlay.mapHidden(true, 'מתחת לאדמה'));
const mh = await G(() => ({ cover: document.getElementById('mapCover')?.textContent, coverShown: !!document.getElementById('mapCover')?.offsetParent, mapShown: !!document.getElementById('minimap').offsetParent }));
check('mapHidden: the minimap covered by "מתחת לאדמה"', mh.cover === 'מתחת לאדמה' && mh.coverShown && !mh.mapShown);
await G(() => window.__step(1));
await snap('atm5-map-hidden');
await G(() => window.__game.debug.game.overlay.mapHidden(false));
check('mapHidden off: the minimap back', await G(() => !document.getElementById('mapCover') && !!document.getElementById('minimap').offsetParent));
await G(() => window.__game.debug.game.overlay.flash('#ffffff', 300));
check('flash: a white flash that fades by itself', await G(() => +window.__game.debug.game.overlay.flashEl.style.opacity === 0 && /opacity 300ms/.test(window.__game.debug.game.overlay.flashEl.style.transition)));
const big = await G(() => { const g = window.__game.debug.game, p = g.player.pos; g.fx.explode(p.x + 6, p.y, p.z, { size: 2.5, flash: true, sound: false, shake: false }); return g.overlay.flashEl.style.transition; });
check('a big blast close by can flash the screen (explode { flash: true })', /opacity/.test(big), big);
await G(() => { window.__game.debug.game.fx.clear(); window.__step(60, false); });

// ---------- speedScale: slower walking, nothing else ----------
const walk = (k, run = false) => G(({ k, run }) => {
  const W = window.__game, g = W.debug.game;
  W.teleport(1120, -200); g.player.yaw = 0; W.setCamera(Math.PI, 0.15); // facing open ground
  g.player.speedScale = k;
  g.botInput = (input) => ({ ...input, move: { x: 0, y: 1 }, run });
  const a = { ...g.player.pos };
  window.__step(60, false); // two seconds
  g.botInput = null;
  const b = g.player.pos;
  window.__step(20, false);
  return Math.hypot(b.x - a.x, b.z - a.z);
}, { k, run });
const w1 = await walk(1), wh = await walk(0.5), r1 = await walk(1, true), rh = await walk(0.5, true);
check('speedScale 0.5: he walks about half as far in the same game time', wh / w1 > 0.4 && wh / w1 < 0.6, `${w1.toFixed(2)} m → ${wh.toFixed(2)} m`);
check('speedScale 0.5: running too', rh / r1 > 0.4 && rh / r1 < 0.6, `${r1.toFixed(2)} m → ${rh.toFixed(2)} m`);
const lo = await walk(0.1);
check('speedScale is held to 0.4..1', lo / w1 > 0.33 && lo / w1 < 0.47, `0.1 → ${(lo / w1).toFixed(2)} of his pace`);
const pushed = await G(() => { const g = window.__game.debug.game; g.player.speedScale = 0.5; const a = { ...g.player.pos }; g.player.push(1, 0); const d = g.player.pos.x - a.x; g.player.speedScale = 1; return d; });
check('speedScale touches nothing else (a shove still moves him its full metre)', Math.abs(pushed - 1) < 0.01, `${pushed.toFixed(3)} m`);
const w2 = await walk(1);
check('speedScale 1: his own pace again', Math.abs(w2 - w1) < 0.05, `${w2.toFixed(2)} m`);

// ---------- ten times on and off: nothing left behind ----------
await G(() => { const W = window.__game, g = W.debug.game; W.teleport(1120, -200); g.daylight.set(1, 0); window.__step(30); }); // the night's lamps near here are in the scene first
const base = await G(() => window.__count());
const made2 = await G(() => window.__audioMade);
for (let i = 0; i < 10; i++) {
  await G(() => {
    const g = window.__game.debug.game, s = g.sound;
    g.fx.rain(true, { strength: 0.8 }); g.fx.redAlert(true, { at: { x: 1120, z: -200 }, r: 20 }); s.music(Math.random() < 0.5 ? 'action' : 'calm', { fade: 0.2 }); s.heartbeat(true);
    g.overlay.daze(0.8, 0.2); g.overlay.mapHidden(true); g.overlay.eyes(0.5, 0.2);
    window.__step(8, false);
    g.fx.rain(false, { seconds: 0.2 }); g.fx.redAlert(false); s.music(null, { fade: 0.2 }); s.heartbeat(false);
    g.overlay.daze(0, 0.2); g.overlay.mapHidden(false); g.overlay.eyes(0, 0.2);
    window.__step(12, false);
  });
}
await G(() => window.__step(30));
const after = await G(() => window.__count());
check('ten times on and off: no new objects in the scene', after.children === base.children && after.objects === base.objects, `children ${base.children} → ${after.children}, objects ${base.objects} → ${after.objects}`);
const settled = await poll((b) => { const s = window.__game.debug.game.sound; return !s.song && !s.fading.length && !s.beat && !s.rainNode && !s.timer && s.voices === b; }, 8000, baseVoices);
const voices = await G(() => window.__game.debug.game.sound.voices);
check('ten times on and off: every audio source has ended and the timer is stopped', !!settled, `${voices} voices (at the start ${baseVoices})`);
const made3 = await G(() => window.__audioMade);
await page.waitForTimeout(1500);
await G(() => window.__step(30, false));
const made4 = await G(() => window.__audioMade);
check('with it all off, no audio nodes are made frame after frame', made4 === made3, `${made3 - made2} nodes over the ten rounds, ${made4 - made3} since`);
check('the overlay is clear after the rounds', await G(() => { const o = window.__game.debug.game.overlay.state; return o.daze === 0 && o.eyes === 0 && !o.mapHidden && o.alert === 0; }));
// resetAtmosphere: everything off in one call (a mission's cleanup)
await G(() => { const g = window.__game.debug.game; g.fx.rain(true); g.fx.redAlert(true); g.sound.music('action'); g.overlay.daze(1, 0); g.player.speedScale = 0.5; window.__step(4, false); g.fx.resetAtmosphere(); window.__step(4, false); });
check('fx.resetAtmosphere: rain, red alert, the overlay, the music and the slow walk off at once', await G(() => { const g = window.__game.debug.game; return !g.fx.raining && g.fx.rainLevel === 0 && !g.fx.redAlertOn && g.overlay.state.daze === 0 && g.player.speedScale === 1 && g.sound.musicMode === null && g.daylight.wet === 0; }));
check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
