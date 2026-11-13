// The end of the game (chapter ten's last mission): the cards on black, NAHORAI FARHI / THE END / LEGENDS
// NEVER FIGHT ALONE; then the credits, a roll in Hebrew over short live moments of all ten chapters (the
// game's own camera flying over each chapter's place, its name and a line), the gang as the story's
// characters, and THANK YOU FOR PLAYING. with a button back to the main menu. 'דלג' skips to the thanks at
// any moment. This module makes its own DOM and <style>.
//
//   await endingCards(game);   // on black; the world is held underneath
//   await credits(game);       // resolves when THANK YOU FOR PLAYING. is on screen (the button stays up)
//
// While the ending runs the HUD is hidden, the controls are off and the game is either held (on black) or
// running as a cutscene (under the live moments and the thanks), so the world below never moves on its own
// and a mission waiting on these promises carries on as usual. The ending's clock stops while the pause
// menu is open. The button calls game.mainMenu() (main.js) or, failing that, saves and reloads the page.
import * as THREE from 'three';
import { ROSTER, CAST_ORDER } from '../characters/roster.js';

export const CARDS = ['NAHORAI FARHI', 'THE END', 'LEGENDS NEVER FIGHT ALONE'];
export const THANKS = 'THANK YOU FOR PLAYING.';
export const MENU_LABEL = 'חזרה לתפריט הראשי';
export const SKIP_LABEL = 'דלג';
export const CAST_TITLE = 'דמויות בדיוניות';

// speed > 1 runs the whole ending faster (tests); 0 stops its clock where it is. phase and log tell where
// it is and what has been shown, in order: the cards' texts, 'moment:<chapter>' for each live moment,
// 'cast', and THANKS; moment is the chapter whose live shot is on screen (null between shots)
export const ENDING = { speed: 1, phase: null, log: [], skipped: false, moment: null };

// the ten chapters: a title, a line, and the places the camera flies over (world.places keys; a place
// that does not exist is left out, and a chapter with none of its places is left out)
export const MOMENTS = [
  { chapter: 1, title: 'פרק 1 · קציר', line: 'הרנו הלבנה, המכון ליד השער, וחבורה אחת שמתחילה הכול.', shots: [{ at: 'plaza', r: 60, h: 34 }, { at: 'gymLot', r: 42, h: 22 }] },
  { chapter: 2, title: 'פרק 2 · חדרה', line: 'הדר מגיע מניו יורק, ובשדרה לא מתקפלים.', shots: [{ at: 'kiosk', r: 48, h: 24 }, { at: 'hadera', r: 150, h: 85 }] },
  { chapter: 3, title: 'פרק 3 · ערב אגרוף', line: 'זירה במגרש, פעמון, ונהוראי בפינה של הדר.', shots: [{ at: 'courtRing', r: 30, h: 16 }, { at: 'court', r: 40, h: 20 }] },
  { chapter: 4, title: 'פרק 4 · בנק קוצי', line: 'עידו מצטרף, ובשתיים בלילה הכסף חוזר לכולם.', shots: [{ at: 'bank', r: 55, h: 30 }] },
  { chapter: 5, title: 'פרק 5 · הפאב והווילה', line: 'ערב בפאב של קציר, ולילה ארוך בווילה של יניב.', shots: [{ at: 'pub', r: 40, h: 22 }, { at: 'villa', r: 55, h: 30 }] },
  { chapter: 6, title: 'פרק 6 · הצופן', line: 'דולב נלקח, וכל החבורה יוצאת לחצר המכולות להחזיר אותו.', shots: [{ at: 'yard', r: 60, h: 32 }] },
  { chapter: 7, title: 'פרק 7 · ערב בתצפית', line: 'נהוראי נלקח, וארז והחבורה לא עוצרים עד שהוא חוזר הביתה.', shots: [{ at: 'fort', r: 70, h: 38 }] },
  { chapter: 8, title: 'פרק 8 · מבצע סופת אש', line: 'בסיס הברזל, המטה של קוצי, וכולם נלחמים כתף אל כתף.', shots: [{ at: 'ironBase', r: 90, h: 48 }, { at: 'hq', r: 70, h: 40 }] },
  { chapter: 9, title: 'פרק 9 · מבצע אלמוות', line: 'הנמל והמגדל, ואגרופים כשהכול נלקח מהם.', shots: [{ at: 'port', r: 110, h: 55 }, { at: 'tower', r: 75, h: 55, up: 25 }] },
  { chapter: 10, title: 'פרק 10 · סוף העולם', line: 'המצודה, חורשת הזיתים ביקום אחר, והניצחון האחרון — ביחד.', shots: [{ at: 'citadel', r: 190, h: 95 }, { at: 'grove', r: 70, h: 34 }] },
];

const CSS = `
.ending { position: absolute; inset: 0; overflow: hidden; color: #f4f1ea; font-family: var(--f-ui, system-ui, sans-serif); pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; }
.ending-black { position: absolute; inset: 0; background: #000; opacity: 0; transition: opacity 1s ease; }
.ending-bars::before, .ending-bars::after { content: ''; position: absolute; left: 0; right: 0; height: 11vh; background: #000; }
.ending-bars::before { top: 0; } .ending-bars::after { bottom: 0; }
.ending-bars { position: absolute; inset: 0; opacity: 0; transition: opacity .8s ease; pointer-events: none; }
.ending-card { position: absolute; inset: 0; display: grid; place-items: center; padding: 0 6vw; text-align: center; direction: ltr; unicode-bidi: isolate;
  font-weight: 800; letter-spacing: .22em; font-size: clamp(30px, min(9vw, 16vh), 96px); line-height: 1.15; opacity: 0; transition: opacity 1s ease; }
.ending-card.long { letter-spacing: .12em; font-size: clamp(15px, min(4vw, 10vh), 54px); white-space: nowrap; }
.ending-moment { position: absolute; right: calc(28px + var(--safe-r, 0px)); bottom: calc(11vh + 14px); max-width: min(78vw, 640px); text-align: right; opacity: 0; transition: opacity .7s ease;
  text-shadow: 0 2px 12px rgba(0, 0, 0, .75), 0 0 2px rgba(0, 0, 0, .9); }
.ending-ch { font-size: clamp(18px, 5.4vh, 30px); font-weight: 800; letter-spacing: .01em; }
.ending-line { margin-top: 4px; font-size: clamp(13px, 3.9vh, 20px); font-weight: 500; opacity: .95; }
.ending-roll { position: absolute; left: 0; right: 0; top: 11vh; bottom: 11vh; overflow: hidden; opacity: 0; transition: opacity .8s ease;
  -webkit-mask-image: linear-gradient(transparent, #000 14%, #000 86%, transparent); mask-image: linear-gradient(transparent, #000 14%, #000 86%, transparent); }
.ending-roll-in { position: absolute; left: 0; right: 0; top: 0; display: grid; justify-items: center; gap: 10px; text-align: center; text-shadow: 0 2px 10px rgba(0, 0, 0, .8); will-change: transform; }
.ending-roll-in h3 { margin: 0 0 8px; font-size: clamp(17px, 5vh, 26px); font-weight: 800; letter-spacing: .04em; color: #ffd38a; }
.ending-roll-in .name { font-size: clamp(16px, 4.6vh, 24px); font-weight: 700; }
.ending-roll-in .note { margin-top: 18px; font-size: clamp(12px, 3.4vh, 16px); opacity: .85; max-width: 80vw; }
.ending-thanks { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: clamp(14px, 5vh, 30px); padding: 0 6vw;
  background: radial-gradient(ellipse at 50% 45%, rgba(0, 0, 0, .55), rgba(0, 0, 0, .86)); opacity: 0; transition: opacity 1.4s ease; pointer-events: none; }
.ending-thanks.on { pointer-events: auto; }
.ending-thanks-text { direction: ltr; unicode-bidi: isolate; text-align: center; font-weight: 800; letter-spacing: .14em; font-size: clamp(16px, min(4.4vw, 11vh), 64px); white-space: nowrap; }
.ending-menu { min-width: 220px; padding: 0 26px; opacity: 0; transition: opacity .8s ease; }
.ending-menu.on { opacity: 1; }
.ending-skip { position: absolute; top: calc(10px + var(--safe-t, 0px)); left: calc(12px + var(--safe-l, 0px)); min-height: 38px; padding: 0 18px; border-radius: 19px;
  border: 1px solid rgba(255, 255, 255, .28); background: rgba(10, 12, 16, .55); color: #f4f1ea; font: 700 15px var(--f-ui, system-ui, sans-serif); cursor: pointer; }
`;

let S = null; // the ending on screen now

const speedNow = () => (Number.isFinite(ENDING.speed) ? Math.max(0, ENDING.speed) : 1) * (S?.speed ?? 1);
const pausedNow = () => { const p = document.getElementById('pauseMenu'); return !!p && !p.hidden; };

function make(game) {
  if (S && S.root.isConnected) return S;
  if (!document.getElementById('endingStyle')) {
    const st = document.createElement('style');
    st.id = 'endingStyle'; st.textContent = CSS;
    document.head.append(st);
  }
  const root = document.createElement('div');
  root.className = 'ending'; root.id = 'ending'; root.dir = 'rtl';
  root.innerHTML = `
    <div class="ending-black"></div>
    <div class="ending-bars"></div>
    <div class="ending-moment"><div class="ending-ch"></div><div class="ending-line"></div></div>
    <div class="ending-roll"><div class="ending-roll-in"></div></div>
    <div class="ending-card" dir="ltr"></div>
    <div class="ending-thanks"><div class="ending-thanks-text" dir="ltr"></div><button class="primary ending-menu" type="button" hidden></button></div>
    <button class="ending-skip" type="button"></button>`;
  const $ = (c) => root.querySelector(c);
  const el = { black: $('.ending-black'), bars: $('.ending-bars'), moment: $('.ending-moment'), ch: $('.ending-ch'), line: $('.ending-line'), roll: $('.ending-roll'), rollIn: $('.ending-roll-in'), card: $('.ending-card'), thanks: $('.ending-thanks'), thanksText: $('.ending-thanks-text'), menu: $('.ending-menu'), skip: $('.ending-skip') };
  el.skip.textContent = SKIP_LABEL;
  el.menu.textContent = MENU_LABEL;
  el.thanksText.textContent = THANKS;
  // the overlay's own touches never reach the game's controls under it
  for (const ev of ['pointerdown', 'touchstart']) root.addEventListener(ev, (e) => e.stopPropagation());
  const host = document.getElementById('game') || document.body, before = document.getElementById('failMenu');
  if (before && before.parentNode === host) host.insertBefore(root, before); else host.append(root); // under the pause menu
  const hudEl = game.hud?.el?.hud;
  S = {
    game, root, el, clock: 0, last: null, raf: 0, waits: [], shot: null, roll: null, speed: 1, onClose: [],
    skipped: false, thanks: false, thanksShown: null, ov: { from: new THREE.Vector3(), look: new THREE.Vector3(), left: 1e9 },
    hudHidden: hudEl ? hudEl.hidden : true, controls: game.controls ? game.controls.enabled : false,
  };
  ENDING.log = []; ENDING.skipped = false; ENDING.phase = 'open'; ENDING.moment = null;
  if (hudEl) hudEl.hidden = true;
  if (game.controls) { game.controls.enabled = false; game.controls.reset?.(); }
  const press = (b, fn) => b.addEventListener('pointerdown', (e) => { if (e.button > 0) return; e.preventDefault(); fn(); });
  press(el.skip, () => skip());
  el.skip.addEventListener('click', (e) => { if (e.detail === 0) skip(); });
  const menu = () => { if (S?.thanks && !el.menu.hidden) toMenu(game); };
  press(el.menu, menu);
  el.menu.addEventListener('click', (e) => { if (e.detail === 0) menu(); });
  const loop = (now) => {
    if (!S || S.root !== root) return;
    S.raf = requestAnimationFrame(loop);
    const dt = S.last === null ? 0 : Math.min(0.1, (now - S.last) / 1000);
    S.last = now;
    if (pausedNow()) return; // the pause menu is up: the ending waits for it
    S.clock += dt * speedNow();
    for (let i = S.waits.length - 1; i >= 0; i--) if (S.clock >= S.waits[i].at) { const w = S.waits[i]; S.waits.splice(i, 1); w.done(); }
    frameShot();
    frameRoll();
  };
  S.raf = requestAnimationFrame(loop);
  return S;
}

// seconds on the ending's clock (sped up for tests, stopped while paused); a skip wakes every wait at once
function wait(sec) {
  const s = S;
  if (!s || s.skipped) return Promise.resolve();
  return new Promise((done) => s.waits.push({ at: s.clock + Math.max(0, sec), done }));
}
// a CSS fade lasting `sec` of the ending's clock
function fade(node, to, sec) {
  const k = speedNow();
  node.style.transitionDuration = `${k > 0 ? Math.max(0.05, sec / k) : sec}s`;
  node.style.opacity = String(to);
}

// the world under the black: held (nothing moves, nothing is drawn); under a live moment: running as a cutscene
function hold(game, on) {
  game.hold = !!on;
  game.cutscene = true;
}

// ---------- the cards ----------
// onClose (here and in credits): called once when the ending's overlay goes (the button, or closeEnding),
// before the main menu comes: the place to let the crowd go, say
export async function endingCards(game, { speed = 1, onClose = null } = {}) {
  const s = make(game);
  s.speed = speed;
  if (typeof onClose === 'function') s.onClose.push(onClose);
  if (s.thanks) return { skipped: s.skipped };
  ENDING.phase = 'cards';
  game.sound?.music?.('home', { fade: 2.5 });
  fade(s.el.black, 1, 1.4);
  await wait(1.5);
  if (!s.skipped) hold(game, true); // black now: the world below is held
  for (const text of CARDS) {
    if (s.skipped) break;
    s.el.card.textContent = text;
    s.el.card.classList.toggle('long', text.length > 16);
    s.el.card.dataset.index = String(CARDS.indexOf(text));
    ENDING.log.push(text);
    fade(s.el.card, 1, 1.1);
    await wait(3.2);
    if (s.skipped) break;
    fade(s.el.card, 0, 0.9);
    await wait(1.1);
  }
  if (!s.skipped) { s.el.card.textContent = ''; ENDING.phase = 'cards-done'; }
  return { skipped: s.skipped };
}

// ---------- the credits ----------
// a world.places entry as a point on the map (null when the place is not there)
function placeAt(world, key) {
  const p = world?.places?.[key];
  if (!p || typeof p !== 'object') return null;
  if (Number.isFinite(p.x) && Number.isFinite(p.z)) return { x: p.x, z: p.z };
  const B = p.CITY || p.box || p.bounds;
  if (B && [B.x0, B.x1, B.z0, B.z1].every(Number.isFinite)) return { x: (B.x0 + B.x1) / 2, z: (B.z0 + B.z1) / 2 };
  if (p.center && Number.isFinite(p.center.x) && Number.isFinite(p.center.z)) return { x: p.center.x, z: p.center.z };
  return null;
}

// the camera flies round a place: a slow arc, coming a little closer and lower, always above the ground
function setShot(game, shot, dur, i) {
  const w = game.world, p = shot.pos, cy = w.groundHeight(p.x, p.z);
  S.shot = { x: p.x, z: p.z, cy, r: shot.r || 50, h: shot.h || 28, up: shot.up ?? 2, a0: shot.a0 ?? (0.6 + i * 1.9), sweep: shot.sweep ?? 0.45, t0: S.clock, dur: Math.max(0.1, dur) };
  frameShot(true);
  w.lod?.update?.(game.camera, 0, true); // a cut far across the map: everything there in view at once
}
function frameShot(cut = false) {
  const sh = S?.shot, g = S?.game;
  if (!sh || !g?.camera) return;
  const u = Math.min(1, Math.max(0, (S.clock - sh.t0) / sh.dur)), e = u * u * (3 - 2 * u) * 0.5 + u * 0.5;
  const a = sh.a0 + sh.sweep * e, r = sh.r * (1.08 - 0.14 * e), h = sh.h * (1.08 - 0.16 * e);
  const x = sh.x + Math.sin(a) * r, z = sh.z + Math.cos(a) * r;
  const y = Math.max(sh.cy + h, g.world.groundHeight(x, z) + 7);
  const ov = S.ov, cam = g.camera;
  ov.from.set(x, y, z); ov.look.set(sh.x, sh.cy + sh.up, sh.z); ov.left = 1e9;
  cam.position.copy(ov.from);
  cam.lookAt(ov.look);
  if (g.follow) g.follow.override = ov;
  if (cut) cam.updateMatrixWorld();
}

function frameRoll() {
  const R = S?.roll;
  if (!R) return;
  const u = Math.min(1, Math.max(0, (S.clock - R.t0) / R.dur)), box = S.el.roll.clientHeight, inner = S.el.rollIn.scrollHeight;
  S.el.rollIn.style.transform = `translateY(${(box - u * (box + inner)).toFixed(1)}px)`;
}

// the moments that can be shown in this world: each with the shots whose places exist
export function creditMoments(game, moments = MOMENTS) {
  return moments.map((m) => ({ ...m, shots: (m.shots || []).map((s) => {
    const pos = s.pos || (typeof s.at === 'string' ? placeAt(game.world, s.at) : s.at);
    return pos && Number.isFinite(pos.x) && Number.isFinite(pos.z) ? { ...s, pos } : null;
  }).filter(Boolean) })).filter((m) => m.shots.length);
}

// where the thanks look down on: Katzir's way in (the first point of its main street), else Katzir itself
function homeShot(game) {
  const m = game.world?.places?.mainRoad;
  const pos = m && Array.isArray(m.x) && Number.isFinite(m.x[0]) ? { x: m.x[0], z: m.z[0] } : placeAt(game.world, 'plaza') || { x: 40, z: 5 };
  return { pos, r: 85, h: 42, up: 3, a0: 2.2, sweep: 0.5 };
}

export async function credits(game, { moments = MOMENTS, speed = 1, momentSeconds = 6.5, onClose = null } = {}) {
  const s = make(game);
  s.speed = speed;
  if (typeof onClose === 'function') s.onClose.push(onClose);
  if (s.thanks || s.skipped) { showThanks(game); return s.thanksShown; }
  ENDING.phase = 'credits';
  game.sound?.music?.('home', { fade: 2.5 });
  s.el.card.style.opacity = '0';
  fade(s.el.black, 1, 0.4);
  const list = creditMoments(game, moments);
  let first = true;
  for (const [i, m] of list.entries()) {
    if (s.skipped) break;
    ENDING.log.push(`moment:${m.chapter ?? i + 1}`);
    s.el.ch.textContent = m.title || '';
    s.el.line.textContent = m.line || '';
    s.el.moment.dataset.chapter = String(m.chapter ?? i + 1);
    const per = momentSeconds / m.shots.length;
    for (const [k, shot] of m.shots.entries()) {
      if (s.skipped) break;
      ENDING.moment = null;
      if (!first) { fade(s.el.black, 1, 0.35); await wait(0.4); if (s.skipped) break; }
      setShot(game, shot, per, i * 2 + k);
      hold(game, false); // a live moment: the world runs (as a cutscene) under the camera
      if (first) { fade(s.el.bars, 1, 0.8); first = false; }
      await wait(0.15);
      fade(s.el.black, 0, 0.6);
      if (k === 0) fade(s.el.moment, 1, 0.8);
      ENDING.moment = m.chapter ?? i + 1;
      await wait(Math.max(0.2, per - (k === m.shots.length - 1 ? 0.9 : 0.55)));
    }
    if (s.skipped) break;
    ENDING.moment = null;
    fade(s.el.moment, 0, 0.6);
    await wait(0.5);
  }
  ENDING.moment = null;
  // the gang, the story's characters, rolling up over Katzir
  if (!s.skipped) {
    fade(s.el.black, 1, 0.4); await wait(0.45);
    if (!s.skipped) {
      ENDING.log.push('cast');
      ENDING.phase = 'cast';
      const names = CAST_ORDER.map((id) => ROSTER[id]?.name).filter(Boolean);
      s.el.rollIn.replaceChildren();
      const h = document.createElement('h3'); h.textContent = CAST_TITLE; s.el.rollIn.append(h);
      for (const n of names) { const d = document.createElement('div'); d.className = 'name'; d.textContent = n; s.el.rollIn.append(d); }
      const note = document.createElement('div'); note.className = 'note'; note.textContent = 'כל הדמויות, המקומות והאירועים במשחק בדיוניים.'; s.el.rollIn.append(note);
      const dur = 4 + names.length * 1.15;
      setShot(game, { ...homeShot(game), r: 120, h: 70, sweep: 0.35 }, dur, 0);
      hold(game, false);
      s.roll = { t0: s.clock, dur };
      frameRoll();
      fade(s.el.roll, 1, 0.6);
      fade(s.el.black, 0, 0.8);
      await wait(dur);
      fade(s.el.roll, 0, 0.5);
    }
  }
  showThanks(game);
  return s.thanksShown;
}

// THANK YOU FOR PLAYING. over Katzir at dusk, then the button back to the main menu
function showThanks(game) {
  const s = S;
  if (!s) return;
  if (s.thanks) return;
  s.thanks = true;
  s.thanksShown = Promise.resolve({ skipped: s.skipped });
  ENDING.phase = 'thanks';
  ENDING.moment = null;
  ENDING.log.push(THANKS);
  s.roll = null;
  s.el.skip.hidden = true;
  for (const n of [s.el.card, s.el.moment, s.el.roll]) fade(n, 0, 0.4);
  setShot(game, homeShot(game), 60, 0);
  hold(game, false);
  fade(s.el.bars, 0, 0.8);
  fade(s.el.black, 0, 1.2);
  s.el.thanks.classList.add('on');
  fade(s.el.thanks, 1, 1.4);
  game.sound?.music?.('home', { fade: 2.5 });
  const showButton = () => { if (S !== s) return; s.el.menu.hidden = false; requestAnimationFrame(() => s.el.menu.classList.add('on')); s.el.menu.focus?.({ preventScroll: true }); };
  // the button after a breath (the ending's clock; at once after a skip, since a skip has woken every wait)
  if (s.skipped) setTimeout(showButton, 300); else wait(1.4).then(showButton);
}

// 'דלג': straight to the thanks, from any moment; everything that was running stops where it is
export function skipEnding() { skip(); }
function skip() {
  const s = S;
  if (!s || s.thanks) return;
  s.skipped = true; ENDING.skipped = true;
  const waits = s.waits.splice(0);
  showThanks(s.game);
  for (const w of waits) w.done();
}

// the overlay gone and the game given back: not held, no cutscene, the follow camera behind Nehorai.
// restore: the HUD and the controls as they were (a mission stopped half way); false when the main menu
// takes over. A mission's cleanup calls closeEnding(game) only when it is left before its end (if !m.done)
export function closeEnding(game, { restore = true } = {}) {
  const s = S;
  if (!s) return;
  S = null;
  cancelAnimationFrame(s.raf);
  for (const w of s.waits.splice(0)) w.done();
  s.root.remove();
  const g = game || s.game;
  for (const fn of s.onClose.splice(0)) { try { fn(); } catch (err) { console.warn(err); } }
  g.hold = false;
  g.cutscene = false;
  if (g.follow?.override === s.ov) g.follow.override = null;
  if (g.player && g.follow?.snapBehind) g.follow.snapBehind(g.player.yaw);
  if (restore) {
    const hudEl = g.hud?.el?.hud;
    if (hudEl) hudEl.hidden = s.hudHidden;
    if (g.controls) g.controls.enabled = s.controls;
  }
  ENDING.phase = restore ? 'closed' : 'menu';
}

// the button: the overlay goes and the start screen comes (game.mainMenu from main.js), else a clean reload
function toMenu(game) {
  closeEnding(game, { restore: false });
  if (typeof game.mainMenu === 'function') game.mainMenu();
  else { game.save?.(); location.reload(); }
}

export const endingOpen = () => !!S;
