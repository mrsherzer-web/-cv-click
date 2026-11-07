// Screen layers over the 3D view for chapter nine: the daze after a blast or the sleeping gas (the picture
// blurred, the edges dark, the view swaying a little), eyelids that close and open, the minimap covered
// underground ("מתחת לאדמה"), a white flash for a big blast, and the red of an emergency at the screen's
// edges. Its nodes are made here (one layer over the canvas, under the HUD, and a label in the minimap's
// place) and never take a touch. install(game) makes it once and puts it on game.overlay; fx.update calls
// update(dt) every frame (the easing and the sway follow game time, so they stop when the game holds).
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

  // once a frame (from fx.update): the easing of the daze and the lids, the sway
  update(dt) {
    this.t += dt;
    const ease = (q) => { if (q.v === q.to) return false; const s = q.rate * dt; q.v = q.v < q.to ? Math.min(q.to, q.v + s) : Math.max(q.to, q.v - s); return true; };
    if (ease(this.dz) || this.dz.v > 0) this.drawDaze();
    if (ease(this.lids)) this.drawLids();
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

  // all of it off at once (a mission's cleanup)
  clear() {
    this.daze(0, 0);
    this.eyes(0, 0);
    this.mapHidden(false);
    this.alert(0);
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '0';
  }
  get state() { return { daze: this.dz.v, dazeTarget: this.dz.to, eyes: this.lids.v, mapHidden: !!this.map, mapText: this.map?.label.textContent ?? null, alert: this.alertK }; }
  dispose() {
    this.clear();
    if (this.view) { this.view.style.transform = ''; this.view.style.filter = ''; }
    this.root.remove();
    this.style.remove();
  }
}

// makes the overlay once and puts it on the game, where missions reach it as game.overlay
export function install(game) {
  if (!game.overlay && typeof document !== 'undefined') game.overlay = new Overlay(document);
  return game.overlay;
}
