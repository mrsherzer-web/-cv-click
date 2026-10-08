// Keyboard/mouse (pointer lock) + touch (virtual joystick, drag-to-look, buttons).
import { isTouchDevice, clamp } from './util.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyE: 'interact', Enter: 'interact', KeyF: 'flashlight', KeyC: 'crouch', ControlLeft: 'crouch',
  Space: 'breath', Escape: 'pause', KeyP: 'pause', KeyQ: 'objectives', Tab: 'objectives',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressedQ = new Set();
    this.lookX = 0; this.lookY = 0;
    this.moveX = 0; this.moveY = 0;
    this.sensitivity = 1;
    this.touch = isTouchDevice();
    this.locked = false;
    this.enabled = false;
    this._bindKeyboard();
    this._bindMouse();
    if (this.touch) this._bindTouch();
  }

  press(a) { this.pressedQ.add(a); }
  consume(a) { if (this.pressedQ.has(a)) { this.pressedQ.delete(a); return true; } return false; }
  isHeld(a) { return this.held.has(a); }
  clearPresses() { this.pressedQ.clear(); }

  _bindKeyboard() {
    addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.held.has(a)) this.press(a);
      this.held.add(a);
    });
    addEventListener('keyup', (e) => { const a = KEYMAP[e.code]; if (a) this.held.delete(a); });
    addEventListener('blur', () => this.held.clear());
  }

  _bindMouse() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.enabled && this.onUnlock) this.onUnlock();
    });
    // if pointer lock is refused (e.g. inside an embedded viewer), dragging with the mouse looks around
    document.addEventListener('pointerlockerror', () => { if (performance.now() - (this._gestureT || -1e9) < 1500) this.lockFailed = true; });
    addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.lookX += e.movementX * 0.0022 * this.sensitivity;
        this.lookY += e.movementY * 0.0022 * this.sensitivity;
      } else if (this.dragging && this.enabled) {
        this.lookX += e.movementX * 0.0045 * this.sensitivity;
        this.lookY += e.movementY * 0.0045 * this.sensitivity;
      }
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.touch) return;
      if (!this.locked && this.enabled && !this.lockFailed) { this.requestLock(true); return; }
      if (!this.locked) this.dragging = true;
      if (e.button === 0) { this.press('interact'); this.held.add('interact'); }
      if (e.button === 2) { this.press('flashlight'); }
    });
    addEventListener('mouseup', (e) => { this.dragging = false; if (e.button === 0) this.held.delete('interact'); });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  requestLock(fromGesture = false) {
    if (this.touch || this.lockFailed) return;
    if (fromGesture) this._gestureT = performance.now();
    const fail = () => { if (fromGesture) this.lockFailed = true; };
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => { try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(fail); } catch (e) { fail(); } });
    } catch (e) { try { this.canvas.requestPointerLock(); } catch (e2) { fail(); } }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  _bindTouch() {
    const root = document.getElementById('touch');
    root.classList.add('on');
    const stick = document.getElementById('stick');
    const knob = document.getElementById('stickKnob');
    let moveId = null, lookId = null, sx = 0, sy = 0, lx = 0, ly = 0;
    const zone = document.getElementById('touchZone');
    zone.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && moveId === null) {
          moveId = t.identifier; sx = t.clientX; sy = t.clientY;
          stick.style.left = sx + 'px'; stick.style.top = sy + 'px'; stick.classList.add('on');
        } else if (lookId === null) { lookId = t.identifier; lx = t.clientX; ly = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) {
          const dx = t.clientX - sx, dy = t.clientY - sy;
          const r = 55, d = Math.hypot(dx, dy), k = d > r ? r / d : 1;
          knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
          this.moveX = clamp(dx / r, -1, 1); this.moveY = clamp(-dy / r, -1, 1);
          if (d > r * 1.35) this.held.add('run'); else this.held.delete('run');
        } else if (t.identifier === lookId) {
          this.lookX += (t.clientX - lx) * 0.0055 * this.sensitivity;
          this.lookY += (t.clientY - ly) * 0.0055 * this.sensitivity;
          lx = t.clientX; ly = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === moveId) { moveId = null; this.moveX = this.moveY = 0; knob.style.transform = ''; stick.classList.remove('on'); this.held.delete('run'); }
        if (t.identifier === lookId) lookId = null;
      }
    };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    const btn = (id, action, hold = false) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.press(action); if (hold) this.held.add(action); b.classList.add('down'); }, { passive: false });
      const up = (e) => { e.preventDefault(); if (hold) this.held.delete(action); b.classList.remove('down'); };
      b.addEventListener('touchend', up); b.addEventListener('touchcancel', up);
    };
    btn('btnUse', 'interact', true);
    btn('btnLight', 'flashlight');
    btn('btnCrouch', 'crouch');
    btn('btnBreath', 'breath', true);
    btn('btnPause', 'pause');
  }

  // movement vector (x = strafe right, y = forward)
  move() {
    let x = this.moveX, y = this.moveY;
    if (this.held.has('up')) y += 1;
    if (this.held.has('down')) y -= 1;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  takeLook() { const r = { x: this.lookX, y: this.lookY }; this.lookX = this.lookY = 0; return r; }
}
