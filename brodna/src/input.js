const STICK_R = 54;

// One left stick, a context action button, camera drag, keyboard and mouse.
export class Input {
  constructor({ canvas, stickZone, stickBase, stickKnob, actionBtn }) {
    this.mx = 0;
    this.my = 0;
    this.camDX = 0;
    this.camDY = 0;
    this.action = false;
    this.actionPressed = false;
    this.advancePressed = false;
    this.pausePressed = false;
    this.run = false;
    this.keys = new Set();
    this.stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.drag = { id: null, x: 0, y: 0 };
    this._q = { action: false, advance: false, pause: false };
    this._actionPtrs = new Set();
    this._kbAction = false;
    this.actionBtn = actionBtn;
    this.stickBase = stickBase;
    this.stickKnob = stickKnob;

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const c = e.code;
      if ((c === 'KeyE' || c === 'Space' || c === 'Enter') && !e.repeat) {
        this._q.advance = true;
        if (c !== 'Enter') {
          this._kbAction = true;
          this._q.action = true;
        }
      }
      if ((c === 'Escape' || c === 'KeyP') && !e.repeat) this._q.pause = true;
      if (c === 'Space' || c.startsWith('Arrow')) e.preventDefault();
      this.keys.add(c);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyE' || e.code === 'Space') this._kbAction = false;
    });
    window.addEventListener('blur', () => this.reset());

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (this.drag.id !== null) return;
      canvas.setPointerCapture(e.pointerId);
      Object.assign(this.drag, { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 });
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.drag.id) return;
      const dx = e.clientX - this.drag.x;
      const dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      this.camDX += dx;
      this.camDY += dy;
    });
    const dragEnd = (e) => {
      if (e.pointerId !== this.drag.id) return;
      if (this.drag.moved < 8) this._q.advance = true; // a tap advances dialogue
      this.drag.id = null;
    };
    canvas.addEventListener('pointerup', dragEnd);
    canvas.addEventListener('pointercancel', dragEnd);

    actionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      actionBtn.setPointerCapture(e.pointerId);
      this._actionPtrs.add(e.pointerId);
      this._q.action = true;
    });
    const actUp = (e) => this._actionPtrs.delete(e.pointerId);
    actionBtn.addEventListener('pointerup', actUp);
    actionBtn.addEventListener('pointercancel', actUp);
    actionBtn.addEventListener('lostpointercapture', actUp);

    stickZone.addEventListener('pointerdown', (e) => {
      if (this.stick.id !== null) return;
      e.preventDefault();
      stickZone.setPointerCapture(e.pointerId);
      const r = stickZone.getBoundingClientRect();
      Object.assign(this.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0, moved: 0 });
      stickBase.style.left = e.clientX - r.left + 'px';
      stickBase.style.top = e.clientY - r.top + 'px';
      stickBase.classList.add('live');
    });
    stickZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.ox;
      let dy = e.clientY - this.stick.oy;
      const len = Math.hypot(dx, dy);
      this.stick.moved = Math.max(this.stick.moved || 0, len);
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
      if ((this.stick.moved || 0) < 10) this._q.advance = true; // a tap here also advances dialogue
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
    this.stickKnob.style.transform = '';
  }

  reset() {
    this.keys.clear();
    this._kbAction = false;
    this._actionPtrs.clear();
    this._resetStick();
    this.drag.id = null;
    this.camDX = this.camDY = 0;
  }

  poll() {
    let kx = 0;
    let ky = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) kx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) kx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) ky += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) ky -= 1;
    const kl = Math.hypot(kx, ky) || 1;
    const shift = k.has('ShiftLeft') || k.has('ShiftRight');
    const kbScale = kx || ky ? (shift ? 1 : 0.62) : 0;
    this.mx = Math.max(-1, Math.min(1, (kx / kl) * kbScale + this.stick.x));
    this.my = Math.max(-1, Math.min(1, (ky / kl) * kbScale + this.stick.y));
    this.action = this._kbAction || this._actionPtrs.size > 0;
    this.actionPressed = this._q.action;
    this.advancePressed = this._q.advance || this._q.action;
    this.pausePressed = this._q.pause;
    this._q.action = this._q.advance = this._q.pause = false;
    this.lookDX = this.camDX;
    this.lookDY = this.camDY;
    this.camDX = this.camDY = 0;
    this.pollPad();
  }

  // Xbox / PlayStation controller: left stick walks (all the way to run), right stick turns the
  // camera, A acts and advances dialogue, B advances, Start pauses, the d-pad also walks.
  pollPad() {
    this.padStart = false;
    let pad = null;
    try {
      for (const p of navigator.getGamepads ? navigator.getGamepads() : []) if (p && p.connected) pad = pad || p;
    } catch {
      return;
    }
    if (!pad) return;
    const dz = (v) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
    const b = (i) => !!pad.buttons[i]?.pressed;
    let lx = dz(pad.axes[0] || 0);
    let ly = dz(pad.axes[1] || 0);
    if (b(14)) lx = -1;
    if (b(15)) lx = 1;
    if (b(12)) ly = -1;
    if (b(13)) ly = 1;
    if (lx || ly) {
      this.mx = Math.max(-1, Math.min(1, this.mx + lx));
      this.my = Math.max(-1, Math.min(1, this.my - ly));
    }
    this.lookDX += dz(pad.axes[2] || 0) * 9;
    this.lookDY += dz(pad.axes[3] || 0) * 6;
    const a = b(0);
    const back = b(1);
    const start = b(9);
    const last = this._pad || {};
    if (a) this.action = true;
    if (a && !last.a) {
      this.actionPressed = true;
      this.advancePressed = true;
    }
    if (back && !last.back) this.advancePressed = true;
    this.padStart = start && !last.start;
    if (this.padStart) this.pausePressed = true;
    this._pad = { a, back, start };
  }
}
