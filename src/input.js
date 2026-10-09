const STICK_R = 56;

// Keyboard, mouse and multi-touch folded into one stick + three buttons.
export class Input {
  constructor({ canvas, stickZone, stickBase, stickKnob, webBtn, boostBtn }) {
    this.sx = 0;
    this.sy = 0;
    this.web = false;
    this.webPressed = false;
    this.webReleased = false;
    this.boostPressed = false;
    this.camPressed = false;
    this.pausePressed = false;
    this.keys = new Set();
    this._q = { press: false, release: false, boost: false, cam: false, pause: false };
    this._kbWeb = false;
    this._mouseWeb = false;
    this._webPtrs = new Set();
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.webBtn = webBtn;
    this.stickZone = stickZone;
    this.stickBase = stickBase;
    this.stickKnob = stickKnob;

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const c = e.code;
      if (c === 'Space' || c === 'KeyJ') {
        this._kbWeb = true;
        this._sync();
        e.preventDefault();
      } else if ((c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyK' || c === 'KeyE') && !e.repeat) this._q.boost = true;
      else if (c === 'KeyC' && !e.repeat) this._q.cam = true;
      else if ((c === 'Escape' || c === 'KeyP') && !e.repeat) this._q.pause = true;
      if (c.startsWith('Arrow')) e.preventDefault();
      this.keys.add(c);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space' || e.code === 'KeyJ') {
        this._kbWeb = false;
        this._sync();
      }
    });
    window.addEventListener('blur', () => this.reset());

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this._mouseWeb = true;
        else if (e.button === 2) this._q.boost = true;
      } else {
        // On touch screens the whole right half also works as the web button.
        if (e.clientX < window.innerWidth * 0.5) return;
        canvas.setPointerCapture(e.pointerId);
        this._webPtrs.add(e.pointerId);
      }
      this._sync();
    });
    const canvasUp = (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button === 0) this._mouseWeb = false;
      } else this._webPtrs.delete(e.pointerId);
      this._sync();
    };
    canvas.addEventListener('pointerup', canvasUp);
    canvas.addEventListener('pointercancel', canvasUp);

    webBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      webBtn.setPointerCapture(e.pointerId);
      this._webPtrs.add(e.pointerId);
      this._sync();
    });
    const webUp = (e) => {
      this._webPtrs.delete(e.pointerId);
      this._sync();
    };
    webBtn.addEventListener('pointerup', webUp);
    webBtn.addEventListener('pointercancel', webUp);
    webBtn.addEventListener('lostpointercapture', webUp);
    boostBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this._q.boost = true;
    });

    stickZone.addEventListener('pointerdown', (e) => {
      if (this.stick.id !== null) return;
      e.preventDefault();
      stickZone.setPointerCapture(e.pointerId);
      const r = stickZone.getBoundingClientRect();
      Object.assign(this.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
      stickBase.style.left = e.clientX - r.left + 'px';
      stickBase.style.top = e.clientY - r.top + 'px';
      stickBase.classList.add('live');
      stickKnob.style.transform = 'translate(0px, 0px)';
    });
    stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.ox;
      let dy = e.clientY - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) {
        dx *= STICK_R / len;
        dy *= STICK_R / len;
      }
      this.stick.x = dx / STICK_R;
      this.stick.y = -dy / STICK_R;
      stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const stickUp = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this._resetStick();
    };
    stickZone.addEventListener('pointerup', stickUp);
    stickZone.addEventListener('pointercancel', stickUp);
  }

  _resetStick() {
    Object.assign(this.stick, { id: null, x: 0, y: 0 });
    this.stickBase.style.left = '';
    this.stickBase.style.top = '';
    this.stickBase.classList.remove('live');
    this.stickKnob.style.transform = 'translate(0px, 0px)';
  }

  _sync() {
    const now = this._kbWeb || this._mouseWeb || this._webPtrs.size > 0;
    if (now && !this.web) this._q.press = true;
    if (!now && this.web) this._q.release = true;
    this.web = now;
    this.webBtn.classList.toggle('down', now);
  }

  reset() {
    this.keys.clear();
    this._kbWeb = false;
    this._mouseWeb = false;
    this._webPtrs.clear();
    this._resetStick();
    this._sync();
  }

  poll() {
    let kx = 0;
    let ky = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) kx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) kx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) ky += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) ky -= 1;
    this.sx = Math.max(-1, Math.min(1, kx + this.stick.x));
    this.sy = Math.max(-1, Math.min(1, ky + this.stick.y));
    this.webPressed = this._q.press;
    this.webReleased = this._q.release;
    this.boostPressed = this._q.boost;
    this.camPressed = this._q.cam;
    this.pausePressed = this._q.pause;
    this._q.press = this._q.release = this._q.boost = this._q.cam = this._q.pause = false;
  }
}
