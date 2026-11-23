/* Input: keyboard + mouse (desktop), twin virtual sticks (touch). All coordinates are in logical 1280x720 space. */
const Input = {
  keys: new Set(),
  mouse: { x: 640, y: 400, down: false },
  touchMode: false,
  sticks: { move: null, aim: null },   // {id, ox, oy, x, y}
  touchButtons: { dash: false, special: false },
  pressed: new Set(),                  // edge-triggered keys this frame
  stage: null, scale: 1,

  init(stage, canvas) {
    this.stage = stage;
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = this.norm(e);
      this.keys.add(k); this.pressed.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(this.norm(e)));
    window.addEventListener('blur', () => this.keys.clear());
    const toLogical = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      return { x: (cx - r.left) / r.width * 1280, y: (cy - r.top) / r.height * 720 };
    };
    canvas.addEventListener('mousemove', e => { const p = toLogical(e.clientX, e.clientY); this.mouse.x = p.x; this.mouse.y = p.y; });
    canvas.addEventListener('mousedown', e => { this.mouse.down = true; if (e.button === 2) this.pressed.add('special'); });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // touch
    const onTouch = (e) => {
      this.touchMode = true;
      for (const tch of e.changedTouches) {
        const p = toLogical(tch.clientX, tch.clientY);
        if (e.type === 'touchstart') {
          // buttons (bottom-right corner cluster)
          if (p.x > 1040 && p.y > 560) {
            if (p.y > 640) { this.pressed.add('Space'); this.touchButtons.dash = true; }
            else { this.pressed.add('special'); }
            continue;
          }
          const side = p.x < 640 ? 'move' : 'aim';
          if (!this.sticks[side]) this.sticks[side] = { id: tch.identifier, ox: p.x, oy: p.y, x: p.x, y: p.y };
        } else if (e.type === 'touchmove') {
          for (const s of ['move', 'aim']) { const st = this.sticks[s]; if (st && st.id === tch.identifier) { st.x = p.x; st.y = p.y; } }
        } else {
          for (const s of ['move', 'aim']) { const st = this.sticks[s]; if (st && st.id === tch.identifier) this.sticks[s] = null; }
        }
      }
      if (e.cancelable) e.preventDefault();
    };
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('touchend', onTouch, { passive: false });
    canvas.addEventListener('touchcancel', onTouch, { passive: false });
  },
  norm(e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') return 'special';
    return e.code;
  },
  stickVec(name, dead) {
    const s = this.sticks[name]; if (!s) return null;
    let dx = s.x - s.ox, dy = s.y - s.oy; const d = Math.hypot(dx, dy);
    if (d < (dead || 8)) return { x: 0, y: 0, mag: 0 };
    const m = Math.min(1, d / 70);
    return { x: dx / d * m, y: dy / d * m, mag: m };
  },
  moveVec() {
    let x = 0, y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l, mag: 1 }; }
    const st = this.stickVec('move'); if (st) return st;
    return { x: 0, y: 0, mag: 0 };
  },
  aimVec(px, py) {
    const st = this.stickVec('aim', 14);
    if (st && st.mag > 0) return { x: st.x / st.mag, y: st.y / st.mag, manual: true };
    if (this.touchMode) return null; // auto-aim
    const dx = this.mouse.x - px, dy = this.mouse.y - py; const d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d, manual: true };
  },
  wasPressed(k) { return this.pressed.has(k); },
  endFrame() { this.pressed.clear(); },
};
