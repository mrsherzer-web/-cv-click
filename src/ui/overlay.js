// Screen layers over the 3D view for chapter nine: the daze after a blast or the sleeping gas (the picture
// blurred, the edges dark, the view swaying a little), eyelids that close and open, the minimap covered
// underground ("מתחת לאדמה"), a white flash for a big blast, and the red of an emergency at the screen's
// edges. Its nodes are made here (one layer over the canvas, under the HUD, and a label in the minimap's
// place) and never take a touch. install(game) makes it once and puts it on game.overlay; fx.update calls
// update(dt) every frame (the easing and the sway follow game time, so they stop when the game holds).
// Chapter ten adds the white of a crossing between worlds (`white`, `whiteOut`, `whiteIn`: over the view,
// and while it is nearly full the HUD but for the captions is hidden under it), a system message in the
// middle of the screen (`notice`: monospace, left to right whatever the page's direction, as a device that
// has lost its signal would print it) and a title card (`card`: big letters on the HUD's own black).
const CSS = `
.ov { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.ov > div { position: absolute; inset: 0; pointer-events: none; }
.ov-alert { opacity: 0; box-shadow: inset 0 0 120px 36px rgba(255, 28, 18, .62); background: radial-gradient(ellipse at 50% 50%, rgba(255, 30, 20, 0) 45%, rgba(255, 30, 20, .16) 100%); }
.ov-daze { opacity: 0; background: radial-gradient(ellipse at 50% 48%, rgba(6, 4, 8, 0) 28%, rgba(6, 4, 8, .5) 64%, rgba(2, 1, 3, .94) 100%); }
.ov-lid { background: #000; height: 56%; opacity: 0; }
.ov-lid.top { inset: 0 -10% auto -10%; border-radius: 0 0 50% 50% / 0 0 34% 34%; transform: translateY(-100%); box-shadow: 0 8px 30px 16px #000; }
.ov-lid.bottom { inset: auto -10% 0 -10%; border-radius: 50% 50% 0 0 / 34% 34% 0 0; transform: translateY(100%); box-shadow: 0 -8px 30px 16px #000; }
.ov-flash { opacity: 0; background: #fff; }
.ov-map {
  width: 110px; height: 110px; border-radius: 50%; display: grid; place-items: center; align-content: center; gap: 2px;
  border: 2px solid rgba(255, 255, 255, .25); background: rgba(12, 15, 22, .78); pointer-events: none;
  color: #f4f1ea; font-weight: 800; font-size: 13px; line-height: 1.15; text-align: center; padding: 10px; direction: rtl;
  background-image: repeating-linear-gradient(45deg, rgba(255, 255, 255, .04) 0 6px, rgba(255, 255, 255, 0) 6px 12px);
}
.ov-map .ov-map-mark { width: 18px; height: 10px; border: 2px solid rgba(244, 241, 234, .8); border-top: 0; border-radius: 0 0 6px 6px; opacity: .8; }
@media (max-height: 420px) { .ov-map { width: 92px; height: 92px; font-size: 12px; } }
.hud.cinematic .ov-map { visibility: hidden; }
.ov-white { opacity: 0; background: #fff; }
.hud.ov-whiteout > *:not(.caption):not(.toast) { visibility: hidden; }
.ov > .ov-notice {
  inset: auto; left: 50%; top: 40%; transform: translate(-50%, -50%); width: max-content; max-width: min(86vw, 560px);
  padding: 12px 18px 12px 16px; border: 1px solid rgba(150, 190, 255, .55); border-radius: 4px;
  background: rgba(6, 9, 20, .86) repeating-linear-gradient(0deg, rgba(140, 180, 255, .07) 0 1px, rgba(0, 0, 0, 0) 1px 3px);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .6), 0 0 26px rgba(90, 120, 255, .28);
  color: #dbe6ff; font: 700 15px/1.45 ui-monospace, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace; letter-spacing: .09em;
  text-align: center; white-space: pre-line; direction: ltr; unicode-bidi: isolate; text-shadow: 0 0 9px rgba(120, 160, 255, .6);
  display: flex; align-items: center; gap: 12px; opacity: 0; transition: opacity .22s ease;
}
.ov > .ov-notice.on { opacity: 1; animation: ov-signal 2.6s steps(1) infinite; }
.ov-notice::before { content: ''; flex: none; width: 9px; height: 9px; background: #ff5a4a; box-shadow: 0 0 8px #ff5a4a; animation: ov-blink 1s steps(1) infinite; }
@keyframes ov-blink { 50% { opacity: .15; } }
@keyframes ov-signal { 0%, 100% { opacity: 1; } 46% { opacity: .82; } 48% { opacity: 1; } 71% { opacity: .9; } 73% { opacity: 1; } }
@media (max-width: 520px) { .ov > .ov-notice { font-size: 13px; letter-spacing: .05em; padding: 10px 12px; } }
@media (prefers-reduced-motion: reduce) { .ov > .ov-notice.on, .ov-notice::before { animation: none; } }
.fade.ov-card .fade-text {
  font-size: clamp(24px, 6.4vw, 58px); font-weight: 900; letter-spacing: .14em; line-height: 1.28; text-align: center;
  white-space: pre-line; padding: 0 22px; text-shadow: 0 0 28px rgba(150, 130, 255, .4); animation: ov-title 1.1s ease-out both;
}
@keyframes ov-title { from { opacity: 0; letter-spacing: .3em; } to { opacity: 1; letter-spacing: .14em; } }
@media (prefers-reduced-motion: reduce) { .fade.ov-card .fade-text { animation: none; } }
`;

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

export class Overlay {
  constructor(doc = document) {
    this.doc = doc;
    const style = (this.style = doc.createElement('style'));
    style.id = 'overlayStyle';
    style.textContent = CSS;
    doc.head.append(style);
    const root = (this.root = doc.createElement('div'));
    root.className = 'ov';
    root.id = 'overlay';
    root.setAttribute('aria-hidden', 'true');
    const layer = (cls) => { const d = doc.createElement('div'); d.className = cls; root.append(d); return d; };
    this.alertEl = layer('ov-alert');
    this.dazeEl = layer('ov-daze');
    this.lidTop = layer('ov-lid top');
    this.lidBottom = layer('ov-lid bottom');
    this.flashEl = layer('ov-flash');
    this.whiteEl = layer('ov-white');
    this.noticeEl = layer('ov-notice');
    this.noticeEl.setAttribute('dir', 'ltr'); // English system text keeps its order on the right-to-left page
    this.hud = doc.getElementById('hud');
    this.game = null;         // set by install(): the title card borrows the HUD's black
    this.wh = { v: 0, to: 0, rate: Infinity, waiting: [] }; // the white of a crossing
    this.note = null;         // the system message on screen: { text, left, done }
    this.titled = null;       // the title card on screen: { text, timers, done }
    // over the canvas and under the HUD: the HUD stays sharp and its buttons stay on top
    this.view = doc.getElementById('view');
    if (this.view?.parentNode) this.view.after(root); else (doc.getElementById('game') || doc.body).append(root);
    const S = globalThis.CSS?.supports?.bind(globalThis.CSS);
    this.backdrop = !!S && (S('backdrop-filter', 'blur(2px)') || S('-webkit-backdrop-filter', 'blur(2px)'));
    this.still = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; // no sway for those who asked for less motion
    this.dz = { v: 0, to: 0, rate: Infinity, blur: -1 };
    this.lids = { v: 0, to: 0, rate: Infinity };
    this.alertK = 0;
    this.t = 0;
    this.map = null; // the label in the minimap's place while it is covered
  }

  // dazed: 0 clear, 1 badly (blurred, dark edges, the view swaying); eased over `seconds`
  daze(amount = 1, seconds = 0.8) {
    this.dz.to = clamp01(amount);
    this.dz.rate = seconds > 0 ? 1 / seconds : Infinity;
    if (!(seconds > 0)) this.dz.v = this.dz.to;
    this.drawDaze();
  }
  // the eyes: 0 open, 1 shut (both lids down); eased over `seconds`
  eyes(closed = 1, seconds = 0.8) {
    this.lids.to = clamp01(closed);
    this.lids.rate = seconds > 0 ? 1 / seconds : Infinity;
    if (!(seconds > 0)) this.lids.v = this.lids.to;
    this.drawLids();
  }
  // the minimap covered by a label (underground there is nothing to show); off brings the map back
  mapHidden(on = true, text = 'מתחת לאדמה') {
    const mini = this.doc.getElementById('minimap');
    if (on) {
      if (!this.map) {
        const el = this.doc.createElement('div'), mark = this.doc.createElement('span'), label = this.doc.createElement('span');
        el.className = 'ov-map'; el.id = 'mapCover'; el.setAttribute('role', 'img');
        mark.className = 'ov-map-mark';
        el.append(label, mark);
        this.map = { el, label };
        if (mini?.parentNode) mini.after(el); else this.root.append(el);
      }
      this.map.label.textContent = text;
      this.map.el.setAttribute('aria-label', text);
      if (mini) mini.style.display = 'none'; // the label takes the map's place in the corner
    } else if (this.map) {
      this.map.el.remove();
      this.map = null;
      if (mini) mini.style.display = '';
    }
  }
  // a flash over the whole view (a big blast close by): `color` at `strength`, gone in `ms`
  flash(color = '#ffffff', ms = 420, strength = 0.85) {
    const el = this.flashEl;
    el.style.transition = 'none';
    el.style.background = color;
    el.style.opacity = String(clamp01(strength));
    void el.offsetWidth; // the start value lands before the fade begins
    el.style.transition = `opacity ${Math.max(60, ms)}ms ease-out`;
    el.style.opacity = '0';
  }
  // the red of an emergency at the screen's edges, 0..1 (fx.redAlert sets it every frame while it runs)
  alert(k) {
    k = clamp01(k);
    if (Math.abs(k - this.alertK) < 0.01 && (k > 0 || this.alertK === 0)) return;
    this.alertK = k;
    this.alertEl.style.opacity = k.toFixed(3);
  }

  // ---------- chapter ten: the white of a crossing, a system message, a title card ----------

  // the view gone white, 0..1, at once (a crossing between worlds sets it frame by frame). From 0.6 up
  // the HUD is hidden under it but for the captions, which stay readable on the white
  white(k = 1) {
    const q = this.wh;
    q.v = q.to = clamp01(k);
    q.rate = Infinity;
    this.drawWhite();
    this.settleWhite();
    return q.v;
  }
  // to white over `seconds` of game time; the promise resolves once it is all white (or something else
  // has taken the white over: a clear(), another call)
  whiteOut(seconds = 1) { return this.whiteTo(1, seconds); }
  // ...and back to the picture
  whiteIn(seconds = 1) { return this.whiteTo(0, seconds); }
  whiteTo(k, seconds) {
    const q = this.wh;
    this.settleWhite(); // whoever waited on the last one is not left hanging
    q.to = clamp01(k);
    q.rate = seconds > 0 ? 1 / seconds : Infinity;
    if (!(seconds > 0)) q.v = q.to;
    this.drawWhite();
    if (q.v === q.to) return Promise.resolve();
    return new Promise((resolve) => q.waiting.push(resolve));
  }
  settleWhite() { const w = this.wh.waiting; if (w.length) { this.wh.waiting = []; for (const f of w) f(); } }
  drawWhite() {
    const v = this.wh.v;
    this.whiteEl.style.opacity = v.toFixed(3);
    const cover = v >= 0.6;
    if (cover !== this.whiteCover) { this.whiteCover = cover; this.hud?.classList.toggle('ov-whiteout', cover); }
  }

  // a system message in the middle of the screen, as a device that has lost its signal prints it:
  // monospace, left to right, the text exactly as given ('\n' breaks the line). It stays `seconds` of game
  // time (0 or less: until notice(null)); the promise resolves when it goes
  notice(text = null, seconds = 4) {
    const old = this.note;
    this.note = null;
    if (old) old.done();
    if (text === null || text === undefined || text === '') { this.noticeEl.classList.remove('on'); return Promise.resolve(); }
    this.noticeEl.textContent = String(text);
    this.noticeEl.classList.add('on');
    return new Promise((done) => { this.note = { text: String(text), left: seconds > 0 ? seconds : Infinity, done }; });
  }

  // a title card: big letters on black ('\n' breaks the line). The HUD's own black (the one hud.fade uses)
  // comes in over half a second, `then` runs under it, the title holds for `seconds`, and the picture
  // comes back; with { stay: true } the black stays for the next card (or card(null), which lifts it). A
  // card called while one is up takes its place on the same black. Real time, as hud.fade is. The promise
  // resolves when this card's time is over
  card(text = null, seconds = 3, { then = null, stay = false } = {}) {
    const doc = this.doc, f = doc.getElementById('fade'), t = doc.getElementById('fadeText'), hud = this.game?.hud;
    const old = this.titled;
    this.titled = null;
    if (old) { for (const id of old.timers) clearTimeout(id); old.done(); }
    if (!f || !t) { then?.(); return Promise.resolve(); }
    const lift = () => {
      f.classList.remove('on');
      if (hud) hud.fading = false;
      const id = setTimeout(() => { if (!this.titled) { f.classList.remove('ov-card'); t.removeAttribute('dir'); } }, 560); // once the black has gone
      return id;
    };
    if (text === null || text === undefined) { if (old || f.classList.contains('ov-card')) lift(); return Promise.resolve(); }
    const black = f.classList.contains('on');
    t.textContent = String(text);
    t.setAttribute('dir', /[֐-׿]/.test(String(text)) ? 'rtl' : 'ltr'); // an English title keeps its full stop at its end
    f.classList.remove('ov-card'); void f.offsetWidth; // the title's entrance plays again for each card
    f.classList.add('ov-card', 'on');
    if (hud) hud.fading = true;
    return new Promise((done) => {
      const card = { text: String(text), timers: [], done };
      this.titled = card;
      const wait = black ? 0 : 520, ms = Math.max(0, seconds) * 1000;
      card.timers.push(setTimeout(() => then?.(), wait));
      card.timers.push(setTimeout(() => {
        if (this.titled !== card) return;
        this.titled = null;
        if (!stay) lift();
        done();
      }, wait + ms));
    });
  }

  // once a frame (from fx.update): the easing of the daze and the lids, the sway, the white, the message's time
  update(dt) {
    this.t += dt;
    const ease = (q) => { if (q.v === q.to) return false; const s = q.rate * dt; q.v = q.v < q.to ? Math.min(q.to, q.v + s) : Math.max(q.to, q.v - s); return true; };
    if (ease(this.dz) || this.dz.v > 0) this.drawDaze();
    if (ease(this.lids)) this.drawLids();
    if (ease(this.wh)) { this.drawWhite(); if (this.wh.v === this.wh.to) this.settleWhite(); }
    if (this.note && (this.note.left -= dt) <= 0) this.notice(null);
  }
  drawDaze() {
    const a = this.dz.v, el = this.dazeEl, view = this.view;
    el.style.opacity = a.toFixed(3);
    const blur = Math.round(a * 7 * 4) / 4; // quarter pixels: the filter is only rewritten when it changes
    if (blur !== this.dz.blur) {
      this.dz.blur = blur;
      const f = blur > 0 ? `blur(${blur}px) saturate(${(1 - a * 0.35).toFixed(2)})` : '';
      if (this.backdrop) { el.style.backdropFilter = f; el.style.webkitBackdropFilter = f; } else if (view) view.style.filter = f;
    }
    if (!view) return;
    if (a <= 0.001 || this.still) { if (view.style.transform) view.style.transform = ''; return; }
    const t = this.t, rot = Math.sin(t * 0.83) * 0.9 * a, tx = Math.sin(t * 0.57) * 0.8 * a, ty = Math.sin(t * 0.71 + 1.3) * 0.6 * a;
    view.style.transform = `scale(${(1 + 0.035 * a).toFixed(4)}) rotate(${rot.toFixed(3)}deg) translate(${tx.toFixed(3)}%, ${ty.toFixed(3)}%)`;
  }
  drawLids() {
    const k = this.lids.v;
    this.lidTop.style.opacity = this.lidBottom.style.opacity = k > 0 ? '1' : '0';
    this.lidTop.style.transform = `translateY(${(-100 + k * 100).toFixed(2)}%)`;
    this.lidBottom.style.transform = `translateY(${(100 - k * 100).toFixed(2)}%)`;
  }

  // all of it off at once (a mission's cleanup). The white and the system message go too; a title card is
  // left to end by itself (a scene is often staged under its black). A crossing in flight lays its white
  // again the same frame
  clear() {
    this.daze(0, 0);
    this.eyes(0, 0);
    this.mapHidden(false);
    this.alert(0);
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '0';
    this.white(0);
    this.notice(null);
    this.onClear?.(); // a crossing in flight that this did not come from is dropped (fx/portal.js)
  }
  get state() { return { daze: this.dz.v, dazeTarget: this.dz.to, eyes: this.lids.v, mapHidden: !!this.map, mapText: this.map?.label.textContent ?? null, alert: this.alertK, white: this.wh.v, whiteTarget: this.wh.to, notice: this.note?.text ?? null, card: this.titled?.text ?? null }; }
  dispose() {
    this.clear();
    this.card(null);
    this.hud?.classList.remove('ov-whiteout');
    if (this.view) { this.view.style.transform = ''; this.view.style.filter = ''; }
    this.root.remove();
    this.style.remove();
  }
}

// makes the overlay once and puts it on the game, where missions reach it as game.overlay
export function install(game) {
  if (!game.overlay && typeof document !== 'undefined') { game.overlay = new Overlay(document); game.overlay.game = game; }
  return game.overlay;
}
