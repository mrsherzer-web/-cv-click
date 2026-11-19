// The studio ident (src/ui/ident.js): SHERZER PRODUCTION on the first press of a start button in a page load.
// Automated browsers do not get it unless window.__identForce === true is set before the page's scripts, so the
// pages here set it (and one does not). Checked:
//  - a tap on start: the overlay above everything, the game not started and held behind it, its sound started;
//    a tap or a key in its first 0.7 s does not skip it; the canvas drawn, amber on it, changing between samples;
//    the wordmark beat reached, graphite letters under the orb; the picture laid out again for 1920x1080, a phone
//    standing up and a small phone; it ends by itself, hands the click on (the game starts), takes itself out of
//    the page and lets go of its sources; the game takes input again and its own sound is back;
//  - a later tap skips it, and the game starts;
//  - muted, with a save left in the middle of a mission: no sound of its own, "continue" after it resumes the
//    mission at its checkpoint (a key skips it);
//  - back at the main menu (the ending's last button) the start button does not replay it;
//  - the try-out page: a chapter button, the ident, then the game at that chapter (skip() skips it);
//  - without the force flag (every other test): no ident, the game starts at once;
//  - reduced motion: the still version, under a second and a half;
//  - a browser that cannot give it a canvas: no ident, the press goes straight on to the game;
//  - with a base url of a served copy of the published folder: a new game is the ident, then the asset layer's
//    opening film, then the chat's button and the game.
// The timeline is walked with window.__identSpeed (0 holds it) and read from window.__ident; every wait has a
// real-time limit. Screenshots of six moments (844x390), of the lockup at 1920x1080 and standing up, and of the
// still version go to the screenshot dir.
// usage: node tests/ident.test.mjs [url] [base url of the published folder, e.g. http://127.0.0.1:8812] [screenshot dir]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const url = process.argv[2] || new URL('../dist/play.html', import.meta.url).href;
const base = (process.argv[3] || '').replace(/\/$/, '');
const shots = process.argv[4] || new URL('../test-results/ident/', import.meta.url).pathname;
await mkdir(shots, { recursive: true });
const KEY = 'nehorai-game:save:v1', SETTINGS = 'nehorai-game:settings:v1';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
// a page of its own: force (the ident on although the browser is automated), reduced (prefers-reduced-motion),
// chapter (the try-out page that begins there)
async function open({ force = true, reduced = false, chapter = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  ctx.setDefaultTimeout(240000);
  if (force) await ctx.addInitScript(() => { window.__identForce = true; });
  if (chapter) await ctx.addInitScript((c) => { window.__startChapter = c; }, chapter);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return page;
}
const ready = (page) => page.waitForFunction(() => window.__game && [...document.querySelectorAll('#startBtn, #chapterPick button')].some((b) => !b.disabled && !b.hidden), null, { timeout: 240000 });
const wait = (page, ms) => page.waitForTimeout(ms);
// the ident and the game around it, in one call
const look = (page) => page.evaluate(() => {
  const I = window.__ident, el = document.getElementById('ident'), g = window.__game.debug.game, at = (x, y) => !!document.elementFromPoint(x, y)?.closest('#ident');
  const r = el?.getBoundingClientRect();
  return {
    state: I.state, played: I.played, t: +I.t.toFixed(3), phase: I.phase, reduced: I.reduced, frames: I.frames, drawMs: +I.drawMs.toFixed(2), sound: { ...I.sound },
    el: !!el, style: !!document.getElementById('identStyle'), opacity: el ? +(+getComputedStyle(el).opacity).toFixed(2) : 0,
    over: !!el && r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight && at(innerWidth / 2, innerHeight / 2) && at(4, 4) && at(innerWidth - 4, innerHeight - 4),
    started: window.__game.state.started, paused: window.__game.state.paused, hold: !!g.hold, startShown: !document.getElementById('startScreen').hidden,
    game: { ctx: g.sound.ctx ? g.sound.ctx.state : null, waiting: !!g.sound.paused, muted: !!g.sound.muted },
    mission: g.missions.active ? { id: g.missions.active.def.id, step: g.missions.active.stepIndex } : null,
  };
});
const until = async (page, cond, sec, what) => {
  const t0 = Date.now();
  for (;;) { const s = await look(page); if (cond(s)) return s; if (Date.now() - t0 > sec * 1000) { console.log(`  (timed out waiting for ${what}: ${JSON.stringify(s)})`); return null; } await wait(page, 100); }
};
// the timeline brought to t and held there (a frame is at most half a second of it, so it is never passed)
async function seek(page, t, limit = 40) {
  await page.evaluate((t) => {
    window.__identAt = false;
    const tick = () => {
      const I = window.__ident;
      if (I.state !== 'playing' || I.phase === 'out' || I.t >= t - 0.012) { window.__identSpeed = 0; window.__identAt = true; return; }
      window.__identSpeed = Math.max(0.03, Math.min(3, (t - I.t) * 2));
      requestAnimationFrame(tick);
    };
    tick();
  }, t);
  await page.waitForFunction(() => window.__identAt, null, { timeout: limit * 1000 }).catch(() => console.log(`  (timed out bringing the ident to ${t})`));
  await wait(page, 120); // a frame drawn at that time
  return look(page);
}
// what is on the canvas: its size, a sum over a grid of its pixels, how many colours, how much amber, and how
// much graphite in the band under the orb where the wordmark stands
const probe = (page) => page.evaluate(() => {
  const cv = document.querySelector('#ident canvas');
  if (!cv) return null;
  const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data, seen = new Set();
  let sum = 0, amber = 0, dark = 0;
  for (let y = 1; y < H; y += 5) for (let x = 1; x < W; x += 5) {
    const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
    sum = (sum * 31 + r * 3 + g * 5 + b * 7) >>> 0;
    seen.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
    if (r > 225 && g > 105 && g < 215 && b < 150 && r - b > 90) amber++;
    if (r < 105 && g < 105 && b < 115 && y > H * 0.55 && x > W * 0.2 && x < W * 0.8) dark++;
  }
  return { W, H, css: [cv.clientWidth, cv.clientHeight], sum, colours: seen.size, amber, dark };
});
const shot = (page, name) => page.screenshot({ path: `${shots}${name}.png` });
// the page reloaded on an empty browser (or with the given save and settings): leaving a page saves, so the
// game's own save is switched off first
async function fresh(page, { save = null, settings = null } = {}) {
  await page.evaluate(({ save, settings, KEY, SETTINGS }) => {
    const g = window.__game.debug.game;
    g.save = () => true; g.missions.keep = g.missions.forget = () => {};
    localStorage.clear();
    if (save) localStorage.setItem(KEY, JSON.stringify(save));
    if (settings) localStorage.setItem(SETTINGS, JSON.stringify(settings));
  }, { save, settings, KEY, SETTINGS });
  await page.reload();
  await ready(page);
  await page.evaluate(() => { window.__identSpeed = 1; });
}

// ---------- a new game: the whole of it ----------
let page = await open();
await page.goto(url);
await ready(page);
let s = await look(page);
const credit = await page.evaluate(() => { const p = document.getElementById('studioLine'); return p ? { text: p.textContent.trim(), dir: getComputedStyle(p).direction, inSheet: !!p.closest('#startScreen .sheet'), size: parseFloat(getComputedStyle(p).fontSize) } : null; });
check('before the first press: idle, nothing of it in the page', s.state === 'idle' && !s.played && !s.el && !s.style && !s.started, JSON.stringify({ state: s.state, el: s.el }));
check('the start sheet credits SHERZER PRODUCTION in a small line, left to right', credit?.text === 'SHERZER PRODUCTION' && credit.dir === 'ltr' && credit.inSheet && credit.size <= 12, JSON.stringify(credit));
await page.evaluate(() => {
  window.__identSpeed = 0.1; // slow, so that its first 0.7 s last
  window.__identPeak = 0;     // the most sources it had sounding at once (its sounds run on real time, the clock here is held)
  const watch = () => { const I = window.__ident; window.__identPeak = Math.max(window.__identPeak, I.sound.voices); if (I.state !== 'done') requestAnimationFrame(watch); };
  watch();
});
await page.tap('#startBtn');
s = await look(page);
check('a tap on start: the ident is playing, over the whole screen and above everything', s.state === 'playing' && s.played && s.el && s.over, JSON.stringify({ state: s.state, el: s.el, over: s.over, phase: s.phase }));
check('the game has not started: the start screen still under it, the world held', !s.started && s.startShown && s.hold, JSON.stringify({ started: s.started, startShown: s.startShown, hold: s.hold }));
check('its sound started inside the tap, on the game\'s own audio context, the game\'s side of it waiting', s.game.ctx === 'running' && s.game.waiting && !s.game.muted, JSON.stringify(s.game));
// a tap on the start button's place and a key, both early
const btn = await page.evaluate(() => { const r = document.getElementById('startBtn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: Math.min(innerHeight - 6, r.top + r.height / 2) }; });
await page.touchscreen.tap(btn.x, btn.y);
await page.keyboard.press('Enter');
await wait(page, 300);
s = await look(page);
check('a tap and a key in its first 0.7 s do not skip it, and nothing under it reacts', s.state === 'playing' && s.phase !== 'out' && s.t < 0.7 && !s.started && s.el, JSON.stringify({ state: s.state, phase: s.phase, t: s.t, started: s.started }));

s = await seek(page, 0.5);
await shot(page, '1-ribbons-in');
s = await seek(page, 1.2);
const a = await probe(page);
check('the ribbons beat: the whoosh set off (its sources sounding)', s.phase === 'ribbons' && s.sound.started && s.sound.cues.join() === 'whoosh' && (await page.evaluate(() => window.__identPeak)) >= 4, JSON.stringify({ phase: s.phase, sound: s.sound, peak: await page.evaluate(() => window.__identPeak) }));
s = await seek(page, 1.6);
const b = await probe(page);
await shot(page, '2-winding');
check('the canvas is drawn (many colours, amber on a pale stage) and changes between samples', !!a && !!b && a.colours > 12 && a.amber > 20 && b.amber > 20 && a.sum !== b.sum && a.dark === 0, JSON.stringify({ a, b }));
check('the canvas fills the screen, sharp to the device (at most 2x)', !!a && a.css[0] === 844 && a.css[1] === 390 && a.W >= 844 && a.W <= 1688 && a.H >= 390 && a.H <= 780, JSON.stringify(a && { W: a.W, H: a.H, css: a.css }));
s = await seek(page, 2.16);
await shot(page, '3-gathering');
s = await seek(page, 2.3);
await shot(page, '4-bloom');
check('the bloom beat, with its thump', s.phase === 'bloom' && s.sound.cues.join() === 'whoosh,thump', JSON.stringify({ phase: s.phase, cues: s.sound.cues }));
s = await seek(page, 3.1);
await shot(page, '5-wordmark');
const w1 = await probe(page);
check('the wordmark beat is reached: graphite letters come in under the orb, the chord struck', s.phase === 'wordmark' && w1.dark > 10 && s.sound.cues.join() === 'whoosh,thump,chord' && (await page.evaluate(() => window.__identPeak)) >= 15, JSON.stringify({ phase: s.phase, dark: w1.dark, cues: s.sound.cues, peak: await page.evaluate(() => window.__identPeak) }));
s = await seek(page, 4.5);
await shot(page, '6-lockup');
const w2 = await probe(page);
check('the lockup: the whole wordmark under the amber orb', s.phase === 'hold' && w2.dark > w1.dark && w2.amber > 100, JSON.stringify({ phase: s.phase, dark: w2.dark, was: w1.dark, amber: w2.amber }));
check('a frame is light to draw (the mean, on this software renderer)', s.frames > 10 && s.drawMs < 60, `${s.drawMs} ms over ${s.frames} frames`);
// other screens: the picture is laid out again
const sizes = [];
for (const [name, width, height] of [['wide-1920x1080', 1920, 1080], ['portrait-390x844', 390, 844], ['small-667x375', 667, 375]]) {
  await page.setViewportSize({ width, height });
  await wait(page, 500);
  const p = await probe(page), c = await look(page);
  await shot(page, `lockup-${name}`);
  sizes.push({ name, ok: !!p && p.css[0] === width && p.css[1] === height && p.W >= width && p.W * p.H <= 3.0e6 && p.dark > 10 && p.amber > 50 && c.over, p });
}
await page.setViewportSize({ width: 844, height: 390 });
await wait(page, 300);
check('laid out again for 1920x1080, a phone standing up and a small phone (the lockup whole, the screen covered)', sizes.every((z) => z.ok), sizes.map((z) => `${z.name} ${z.ok ? 'ok' : JSON.stringify(z.p)}`).join(' · '));
// and its own end
await page.evaluate(() => { window.__identSpeed = 1; });
s = await until(page, (s) => s.state === 'done', 25, 'its end');
check('it ends by itself, about five seconds on its clock', !!s && s.t > 4.8 && s.t < 6, JSON.stringify(s && { t: s.t, phase: s.phase }));
check('the click was handed on: the game has started, the world let go', !!s && s.started && !s.startShown && !s.hold, JSON.stringify(s && { started: s.started, startShown: s.startShown, hold: s.hold }));
check('it is gone from the page (the overlay and its style)', !!s && !s.el && !s.style, JSON.stringify(s && { el: s.el, style: s.style }));
s = await until(page, (s) => s.sound.voices === 0 && !s.game.waiting, 6, 'its sources let go');
check('its sources are let go, and the game\'s own sound is back', !!s && s.sound.voices === 0 && !s.game.waiting && s.game.ctx === 'running', JSON.stringify(s && { sound: s.sound, game: s.game }));
await wait(page, 300);
await page.tap('#pauseBtn');
s = await until(page, (s) => s.paused, 5, 'the pause');
check('the game takes input again (the pause button pauses)', !!s && s.paused, JSON.stringify(s && { paused: s.paused }));

// ---------- a later tap skips it ----------
await fresh(page);
await page.tap('#startBtn');
s = await seek(page, 1.0);
const before = s;
await page.touchscreen.tap(422, 195);
s = await until(page, (s) => s.state === 'done', 6, 'the skip');
check('a tap after 0.7 s skips it (the clock held meanwhile: the fade runs on its own time)', before.state === 'playing' && !!s && s.t < 2 && !s.el, JSON.stringify({ before: before.t, after: s && s.t }));
check('skipped: the game starts all the same, not paused', !!s && s.started && !s.paused && !s.hold, JSON.stringify(s && { started: s.started, paused: s.paused }));
s = await until(page, (s) => s.sound.voices === 0, 4, 'its sources stopped');
check('its sound stops cleanly on the skip (no source left)', !!s && s.sound.voices === 0, JSON.stringify(s && s.sound));

// ---------- muted, and "continue" in the middle of a mission ----------
const left = await page.evaluate(() => {
  const g = window.__game.debug.game, defs = g.missions.defs;
  const d = defs.find((d) => (d.chapter || 1) === 8 && d.steps.some((s, i) => i > 0 && s.checkpoint)), cp = d.steps.findIndex((s, i) => i > 0 && s.checkpoint);
  const p = g.progressForChapter(8);
  for (const o of defs) { if ((o.chapter || 1) !== 8 || defs.indexOf(o) >= defs.indexOf(d)) continue; p.done.push(o.id); for (const u of o.reward?.unlocks || []) if (!p.unlocks.includes(u)) p.unlocks.push(u); }
  p.resume = { id: d.id, checkpoint: cp }; p.savedAt = Date.now();
  return { id: d.id, cp, save: p };
});
await fresh(page, { save: left.save, settings: { quality: 'medium', muted: true } });
const label = await page.evaluate(() => ({ btn: document.getElementById('startBtn').textContent, note: document.getElementById('startNote').textContent }));
await page.tap('#startBtn');
s = await seek(page, 0.9);
check('muted: the ident plays without a sound of its own (the audio context is made all the same)', s.state === 'playing' && !s.sound.started && s.sound.voices === 0 && s.game.muted && s.game.ctx !== null, JSON.stringify({ state: s.state, sound: s.sound, game: s.game }));
await page.keyboard.press('Space');
s = await until(page, (s) => s.state === 'done' && !!s.mission, 20, 'the mission after the ident');
check(`"continue" with a save left half way: after the ident the mission is back at its checkpoint (${left.id}, ${left.cp}; a key skipped it)`, /להמשיך/.test(label.btn) && /באמצע/.test(label.note) && !!s && s.started && s.mission.id === left.id && s.mission.step === left.cp && s.t < 2,
  JSON.stringify({ label: label.btn, mission: s && s.mission, t: s && s.t }));

// ---------- the main menu after the ending: not again ----------
await page.evaluate(() => window.__game.debug.game.mainMenu());
s = await until(page, (s) => s.startShown && !s.started, 5, 'the main menu');
const menu = await page.evaluate(() => document.getElementById('startBtn').textContent);
await page.tap('#startBtn');
await wait(page, 250);
const after = await look(page);
check('back at the main menu, "להמשיך" goes straight in: the ident does not play again', !!s && /להמשיך/.test(menu) && after.started && !after.startShown && !after.el && after.state === 'done', JSON.stringify({ menu, started: after.started, el: after.el, state: after.state }));
await page.context().close();

// ---------- the try-out page ----------
page = await open({ chapter: 4 });
await page.goto(url);
await ready(page);
await page.evaluate(() => { window.__game.debug.game.save = () => true; });
const pick = await page.evaluate(() => ({ buttons: [...document.querySelectorAll('#chapterPick button')].map((b) => b.dataset.chapter), startHidden: document.getElementById('startBtn').hidden, want: window.__game.debug.game.progressForChapter(4).done.length }));
await page.tap('#chapterPick button[data-chapter="4"]');
s = await seek(page, 0.9);
check('the try-out page: a chapter button brings the ident first', pick.startHidden && pick.buttons[0] === '4' && s.state === 'playing' && s.over && !s.started, JSON.stringify({ pick, state: s.state, started: s.started }));
const skipped = await page.evaluate(() => window.__ident.skip());
s = await until(page, (s) => s.state === 'done' && s.started, 8, 'the game after the ident');
const prog = await page.evaluate(() => ({ done: window.__game.state.progress.done.length, mission: window.__game.state.mission?.id || null, chapter: (window.__game.debug.game.missions.defs.find((d) => d.id === window.__game.state.mission?.id) || {}).chapter || null }));
check('then the game at that chapter (skip() skipped it)', skipped === true && !!s && s.started && !s.el && prog.done === pick.want && (prog.chapter === null || prog.chapter === 4), JSON.stringify({ skipped, prog, want: pick.want }));
await page.context().close();

// ---------- an automated browser without the flag: every other test ----------
page = await open({ force: false });
await page.goto(url);
await ready(page);
await page.evaluate(() => { window.__game.debug.game.save = () => true; });
await page.tap('#startBtn');
s = await look(page);
check('without the force flag (webdriver): no ident, the game starts at once', s.started && !s.el && s.state === 'idle' && !s.played && !s.hold, JSON.stringify({ started: s.started, el: s.el, state: s.state }));
await page.context().close();

// ---------- reduced motion ----------
page = await open({ reduced: true });
await page.goto(url);
await ready(page);
await page.evaluate(() => { window.__game.debug.game.save = () => true; window.__identSpeed = 0.5; });
await page.tap('#startBtn');
await wait(page, 800);
s = await look(page);
const still = await probe(page);
await shot(page, 'reduced-still');
check('reduced motion: the still version (the finished lockup, no ribbons to follow)', s.state === 'playing' && s.reduced && s.phase === 'still' && !!still && still.dark > 10 && still.amber > 100 && s.frames === 0, JSON.stringify({ state: s.state, reduced: s.reduced, phase: s.phase, frames: s.frames, still }));
await page.evaluate(() => { window.__identSpeed = 1; });
s = await until(page, (s) => s.state === 'done', 12, 'its end');
check('and it is short: under 1.5 s on its clock, then the game', !!s && s.t <= 1.5 && s.started && !s.el, JSON.stringify(s && { t: s.t, started: s.started }));
await page.context().close();

// ---------- no canvas to draw on: the press goes on ----------
page = await open();
await page.goto(url);
await ready(page);
await page.evaluate(() => {
  window.__game.debug.game.save = () => true;
  // the first two 2D contexts asked for come back empty: the ident's canvas and the first of its sheets (the
  // game asks for none until it has begun)
  const real = HTMLCanvasElement.prototype.getContext;
  let n = 2;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (type !== '2d' || n <= 0) return real.call(this, type, ...rest);
    if (--n === 0) HTMLCanvasElement.prototype.getContext = real;
    return null;
  };
});
await page.tap('#startBtn');
s = await until(page, (s) => s.started, 5, 'the game');
check('a browser that cannot give it a canvas: no ident, the press goes straight on and the game starts', !!s && s.started && !s.el && !s.style && s.state === 'done' && !s.hold && !s.game.waiting, JSON.stringify(s && { started: s.started, el: s.el, state: s.state, hold: s.hold, game: s.game }));
await page.context().close();

// ---------- the published form: the ident, then the opening film, then the game ----------
if (base) {
  page = await open();
  const failed = [];
  page.on('requestfailed', (r) => { const why = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(why)) failed.push(`${why}: ${r.url()}`); });
  await page.goto(`${base}/play.html`);
  await ready(page);
  await fresh(page);
  const film = () => page.evaluate(() => (window.__hfIntro ? { ...window.__hfIntro.state } : null));
  let f = await film();
  check('published: the asset layer and its opening film are on the page', !!f && f.ready && !f.playing, JSON.stringify(f));
  await page.tap('#startBtn');
  s = await seek(page, 1.0);
  f = await film();
  check('published, a new game: the ident comes first, the film waits', s.state === 'playing' && s.over && !!f && !f.playing && !s.started, JSON.stringify({ state: s.state, film: f, started: s.started }));
  await page.evaluate(() => { window.__identSpeed = 2; });
  s = await until(page, (s) => s.state === 'done', 25, 'the end of the ident');
  f = await film();
  const video = await page.evaluate(() => { const v = document.querySelector('#hfIntro video'); return v ? { muted: v.muted, volume: v.volume } : null; });
  check('then the opening film with its sound, the game still waiting behind the start screen', !!s && !s.el && !!f && f.playing && (f.phase === 'film' || f.phase === 'chat') && !s.started && !s.hold && !!video && !video.muted && video.volume > 0.5, JSON.stringify({ ident: s && s.state, film: f, started: s && s.started, video }));
  await shot(page, 'published-film');
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) { f = await film(); if (f.phase === 'done') break; await wait(page, 300); }
  check('the film reaches the chat\'s button', f.phase === 'done' && f.messages >= 4, JSON.stringify(f));
  await page.tap('#hfIntro .hfi-go button');
  s = await until(page, (s) => s.started, 10, 'the game after the film');
  f = await film();
  check('and that button starts the game, its sound let go by the ident', !!s && s.started && !s.startShown && !f.playing && !s.game.waiting && s.state === 'done', JSON.stringify({ started: s && s.started, film: f, game: s && s.game }));
  check('published: no request failed', failed.length === 0, failed.slice(0, 3).join(' | '));
  await page.context().close();
}

check('no page errors', errors.length === 0, errors.slice(0, 4).join(' | '));
await browser.close();
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
