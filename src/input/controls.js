// Touch first, keyboard and mouse as a fallback for testing on a computer.
// Left thumb: a floating joystick (walking, or steering in the car). Right side: drag to look.
// Buttons handle their own touches: taps act at once, held buttons (pedals, block) stay down until lifted.
const STICK_RADIUS = 56;

// Buttons act when the finger goes down. Browsers turn only the first finger's taps into clicks, so
// with the left thumb on the stick a click handler never hears the right thumb. Keyboard clicks still work.
export function onPress(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    fn(e);
  });
  el.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });
}

export class Controls {
  constructor(root, els) {
    this.root = root;
    this.els = els;                 // { stick, knob, run, interact, gas, brake, handbrake, exit, ... }
    this.move = { x: 0, y: 0 };
    this.run = false;
    this.lookDX = 0;
    this.lookDY = 0;
    this.enabled = false;
    this.mode = 'foot';             // 'foot' or 'car'
    this.hold = {};                 // held buttons: gas, brake, handbrake, block
    this.onInteract = null;
    this.onPause = null;
    this.onExit = null;
    this.stickId = null;
    this.lookId = null;
    this.stickOrigin = { x: 0, y: 0 };
    this.lookLast = { x: 0, y: 0 };
    this.keys = new Set();
    this.keyRun = false;

    root.addEventListener('pointerdown', (e) => this.down(e));
    root.addEventListener('pointermove', (e) => this.moveEvt(e));
    root.addEventListener('pointerup', (e) => this.up(e));
    root.addEventListener('pointercancel', (e) => this.up(e));
    // stop the page itself from scrolling, zooming or opening a context menu while playing
    root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());

    onPress(els.run, () => this.setRun(!this.run));
    onPress(els.interact, () => this.onInteract?.());
    if (els.exit) onPress(els.exit, () => this.onExit?.());
    for (const k of ['gas', 'brake', 'handbrake']) if (els[k]) this.bindHold(els[k], k);
    addEventListener('keydown', (e) => this.key(e, true));
    addEventListener('keyup', (e) => this.key(e, false));
    addEventListener('blur', () => this.reset());
  }

  // a button that counts as pressed while a finger is on it
  bindHold(el, name) {
    const set = (on) => { this.hold[name] = on; el.setAttribute('aria-pressed', String(on)); };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture?.(e.pointerId);
      set(true);
    });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, () => set(false));
  }

  setRun(on) {
    this.run = on;
    this.els.run.setAttribute('aria-pressed', String(on));
  }

  reset() {
    this.stickId = this.lookId = null;
    this.move.x = this.move.y = 0;
    this.keys.clear();
    this.keyRun = false;
    for (const k of Object.keys(this.hold)) { this.hold[k] = false; this.els[k]?.setAttribute('aria-pressed', 'false'); }
    this.els.stick.classList.remove('active');
    this.els.knob.style.transform = '';
    this.els.stick.style.left = this.els.stick.style.top = '';
  }

  down(e) {
    if (!this.enabled || e.target.closest('button')) return;
    const leftZone = e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.25;
    if (leftZone && this.stickId === null) {
      this.stickId = e.pointerId;
      const x = Math.max(70, Math.min(innerWidth * 0.45, e.clientX)), y = Math.max(80, Math.min(innerHeight - 70, e.clientY));
      this.stickOrigin = { x, y };
      this.els.stick.style.left = `${x}px`;
      this.els.stick.style.top = `${y}px`;
      this.els.stick.classList.add('active');
      this.stickMove(e.clientX, e.clientY);
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
    } else return;
    this.root.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  moveEvt(e) {
    if (e.pointerId === this.stickId) this.stickMove(e.clientX, e.clientY);
    else if (e.pointerId === this.lookId) {
      this.lookDX += e.clientX - this.lookLast.x;
      this.lookDY += e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
    }
  }

  up(e) {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.move.x = this.move.y = 0;
      this.els.knob.style.transform = '';
      this.els.stick.classList.remove('active');
      this.els.stick.style.left = this.els.stick.style.top = '';
    }
    if (e.pointerId === this.lookId) this.lookId = null;
  }

  stickMove(cx, cy) {
    let dx = cx - this.stickOrigin.x, dy = cy - this.stickOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_RADIUS) { dx *= STICK_RADIUS / d; dy *= STICK_RADIUS / d; }
    this.els.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.move.x = dx / STICK_RADIUS;
    this.move.y = -dy / STICK_RADIUS;   // screen up = forward
  }

  key(e, down) {
    const k = e.key.toLowerCase();
    if (down && (k === 'escape' || k === 'p')) { this.onPause?.(); return; }
    if (!this.enabled) return;
    if (down && (k === 'e' || k === 'enter') && !this.els.interact.hidden) { this.onInteract?.(); return; }
    if (down && k === 'f' && this.mode === 'car') { this.onExit?.(); return; }
    if (down && k === 'f' && this.mode === 'foot' && !this.els.interact.hidden) { this.onInteract?.(); return; }
    if (k === 'shift') this.keyRun = down;
    if (k === ' ') { this.hold.handbrakeKey = down; e.preventDefault(); }
    const map = { w: 'f', arrowup: 'f', s: 'b', arrowdown: 'b', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };
    if (map[k]) { down ? this.keys.add(map[k]) : this.keys.delete(map[k]); e.preventDefault(); }
  }

  // called once per frame: merges keyboard into the stick and hands out the look delta
  sample() {
    if (this.stickId === null && this.keys.size) {
      this.move.x = (this.keys.has('r') ? 1 : 0) - (this.keys.has('l') ? 1 : 0);
      this.move.y = (this.keys.has('f') ? 1 : 0) - (this.keys.has('b') ? 1 : 0);
    } else if (this.stickId === null) {
      this.move.x = this.move.y = 0;
    }
    // in the car the stick steers; pushing it up or down also works as gas and brake
    const y = this.move.y, H = this.hold;
    const out = {
      move: this.move, run: this.run || this.keyRun, lookDX: this.lookDX, lookDY: this.lookDY,
      steer: this.move.x,
      throttle: Math.max(H.gas ? 1 : 0, y > 0.3 ? (y - 0.3) / 0.7 : 0),
      brake: Math.max(H.brake ? 1 : 0, y < -0.3 ? (-y - 0.3) / 0.7 : 0),
      handbrake: !!(H.handbrake || H.handbrakeKey),
    };
    this.lookDX = this.lookDY = 0;
    return out;
  }
}
