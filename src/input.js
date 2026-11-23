/* Input: keyboard + mouse (desktop), twin virtual sticks (touch). All coordinates are in logical 1280x720 space. */
const Input = {
  keys: new Set(),
  mouse: { x: 640, y: 400, down: false },
  touchMode: false,
  sticks: { move: null, aim: null },   // {id, ox, oy, x, y}
  touchButtons: { dash: false, special: false },
  pressed: new Set(),                  // edge-triggered keys this frame
  stage: null, scale: 1,
  BTN: { dash: { x: 1190, y: 660 }, special: { x: 1190, y: 570 }, r: 38, hit: 58 }, // drawn by G.drawTouch, hit-tested here

  init(stage, canvas) {
    this.stage = stage;
    // phones/tablets start in touch mode; a real mouse or a touch switches it on the fly
    this.touchMode = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
    window.addEventListener('pointerdown', e => { this.touchMode = e.pointerType === 'touch'; }, true);
    window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) this.touchMode = false; });
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      const onButton = e.target instanceof HTMLButtonElement;
      if ((e.code === 'Enter' || e.code === 'NumpadEnter') && onButton) return; // the button's own click handles it
      const k = this.norm(e);
      this.keys.add(k); this.pressed.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !(e.code === 'Space' && onButton && G.state !== 'playing')) e.preventDefault(); // Space still presses menu buttons
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
      // the pause button and the cards must also work while another finger holds a stick: browsers send no click for a multi-touch tap
      const tap = e.target.closest && e.target.closest('#btnPause, .card');
      if (tap) {
        if (e.type === 'touchend') {
          const r = tap.getBoundingClientRect();
          for (const t0 of e.changedTouches) if (t0.clientX >= r.left && t0.clientX <= r.right && t0.clientY >= r.top && t0.clientY <= r.bottom) { if (e.cancelable) e.preventDefault(); tap.click(); break; }
        }
        return;
      }
      if (e.target.closest && e.target.closest('button, .screen:not([hidden])')) return; // menus keep their native click
      this.touchMode = true;
      for (const tch of e.changedTouches) {
        const p = toLogical(tch.clientX, tch.clientY);
        if (e.type === 'touchstart') {
          // dash / Big Laugh buttons (circles, same geometry as drawn)
          const B = this.BTN, dd = Math.hypot(p.x - B.dash.x, p.y - B.dash.y), ds = Math.hypot(p.x - B.special.x, p.y - B.special.y);
          if (Math.min(dd, ds) < B.hit) { this.pressed.add(dd <= ds ? 'Space' : 'special'); continue; }
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
    // listen on the whole document so thumbs resting in the letterbox bars still drive the sticks
    for (const ty of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) document.addEventListener(ty, onTouch, { passive: false });
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
