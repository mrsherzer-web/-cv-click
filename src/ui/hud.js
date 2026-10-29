// The DOM layer over the 3D view: objective, toasts, captions, the context button, start and pause screens.
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      hud: $('hud'), objective: $('objective'), objText: $('objText'), objDist: $('objDist'), objArrow: $('objArrow'), objMeters: $('objMeters'),
      toast: $('toast'), caption: $('caption'), interact: $('btnInteract'), interactLabel: $('interactLabel'),
      start: $('startScreen'), startBtn: $('startBtn'), startNote: $('startNote'),
      pause: $('pauseMenu'), pauseBtn: $('pauseBtn'), resume: $('resumeBtn'), home: $('homeBtn'), fullscreen: $('fullscreenBtn'),
      fps: $('fpsText'), quality: [...document.querySelectorAll('[data-quality]')],
    };
    this.toastTimer = 0;
    this.captionTimer = 0;
    this.frames = 0;
    this.fpsTime = 0;
  }

  ready(onStart) {
    const b = this.el.startBtn;
    b.disabled = false;
    b.textContent = 'להתחיל';
    b.addEventListener('click', onStart, { once: true });
  }

  fail(message) {
    this.el.startBtn.textContent = 'לא ניתן להפעיל';
    this.el.startNote.textContent = message;
  }

  showGame() {
    this.el.start.hidden = true;
    this.el.hud.hidden = false;
  }

  setObjective(text) {
    this.el.objective.hidden = !text;
    this.el.objText.textContent = text || '';
  }

  // meters to the target and its bearing relative to the camera (radians, 0 = straight ahead)
  setDistance(meters, bearing) {
    if (meters == null) { this.el.objDist.hidden = true; return; }
    this.el.objDist.hidden = false;
    this.el.objMeters.textContent = `${Math.round(meters)} מ׳`;
    this.el.objArrow.style.transform = `rotate(${bearing}rad)`;
  }

  toast(text, ms = 2600) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  caption(text, ms) {
    const c = this.el.caption;
    c.hidden = !text;
    c.textContent = text || '';
    clearTimeout(this.captionTimer);
    if (text && ms) this.captionTimer = setTimeout(() => { c.hidden = true; }, ms);
  }

  setInteract(label) {
    this.el.interact.hidden = !label;
    if (label) {
      this.el.interactLabel.textContent = label;
      this.el.interact.setAttribute('aria-label', label);
    }
  }

  bindPause({ onPause, onResume, onHome, onQuality, quality }) {
    const e = this.el;
    e.pauseBtn.addEventListener('click', onPause);
    e.resume.addEventListener('click', onResume);
    e.home.addEventListener('click', onHome);
    for (const b of e.quality) b.addEventListener('click', () => { onQuality(b.dataset.quality); this.markQuality(b.dataset.quality); });
    this.markQuality(quality);
    const root = document.documentElement;
    if (document.fullscreenEnabled && root.requestFullscreen) {
      e.fullscreen.hidden = false;
      e.fullscreen.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else root.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {});
      });
      document.addEventListener('fullscreenchange', () => { e.fullscreen.textContent = document.fullscreenElement ? 'יציאה ממסך מלא' : 'מסך מלא'; });
    }
  }

  markQuality(q) {
    for (const b of this.el.quality) b.setAttribute('aria-pressed', String(b.dataset.quality === q));
  }

  setPaused(on) {
    this.el.pause.hidden = !on;
    if (on) this.el.resume.focus({ preventScroll: true });
  }

  tick(dt) {
    this.frames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.fps = Math.round(this.frames / this.fpsTime);
      this.el.fps.textContent = `FPS: ${this.fps}`;
      this.frames = 0;
      this.fpsTime = 0;
    }
  }
}
