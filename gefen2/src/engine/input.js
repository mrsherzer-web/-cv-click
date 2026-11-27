// ============================================================================
//  One input layer for keyboard + mouse and for touch (stick + look drag).
//  Game code asks for actions: light, mask, tablet, interact, sprint, throw,
//  kill, phone, pause.  HUD buttons feed the same actions.
// ============================================================================
import { VIEW, px, delta } from './view.js';

const KEYMAP = {
  KeyF: 'light', ControlLeft: 'light', ControlRight: 'light',
  KeyM: 'mask', KeyQ: 'mask',
  Space: 'tablet', KeyC: 'tablet',
  KeyE: 'interact', Enter: 'interact', NumpadEnter: 'interact',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyG: 'throw',
  KeyK: 'kill', KeyX: 'kill',
  KeyP: 'phone', KeyT: 'phone',
  Escape: 'pause',
  Digit1: 'tab1', Digit2: 'tab2', Digit3: 'tab3',
};
const MOVE = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.down = new Set(); // held actions
    this.hit = new Set(); // actions pressed since the last endFrame()
    this.look = { x: 0, y: 0 }; // accumulated look delta in pixels
    this.pointer = { x: 0.5, y: 0.5, inside: false };
    this.stick = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookTouch = { id: -1, x: 0, y: 0 };
    this.mode = 'ui'; // 'ui' | 'seat' | 'walk'
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.locked = false;
    this.enabled = true;
    this.sens = 1;
    this._bind();
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'walk' && document.pointerLockElement) document.exitPointerLock?.();
    this.stick.active = false;
    this.stick.x = this.stick.y = 0;
    this.look.x = this.look.y = 0;
  }

  press(action) {
    this.hit.add(action);
  }
  hold(action, on) {
    if (on) {
      if (!this.down.has(action)) this.hit.add(action);
      this.down.add(action);
    } else this.down.delete(action);
  }
  took(action) {
    if (this.hit.has(action)) {
      this.hit.delete(action);
      return true;
    }
    return false;
  }
  held(action) {
    return this.down.has(action);
  }
  endFrame() {
    this.hit.clear();
  }

  /** movement axis: x = strafe right, y = forward. Length <= 1 */
  axis() {
    let x = this.stick.x;
    let y = this.stick.y;
    for (const k of this.keys) {
      const m = MOVE[k];
      if (m) {
        x += m[0];
        y += m[1];
      }
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return [x, y];
  }

  consumeLook() {
    const x = this.look.x;
    const y = this.look.y;
    this.look.x = this.look.y = 0;
    return [x * this.sens, y * this.sens];
  }

  _bind() {
    const c = this.canvas;
    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.repeat) {
        if (KEYMAP[e.code] || MOVE[e.code]) e.preventDefault();
        return;
      }
      this.keys.add(e.code);
      const a = KEYMAP[e.code];
      if (a) {
        this.hold(a, true);
        e.preventDefault();
      } else if (MOVE[e.code]) e.preventDefault();
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const a = KEYMAP[e.code];
      if (a) this.hold(a, false);
    });
    addEventListener('blur', () => {
      this.keys.clear();
      this.down.clear();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    // ---- mouse
    c.addEventListener('mousedown', (e) => {
      if (this.touch && e.sourceCapabilities?.firesTouchEvents) return;
      if (this.mode === 'walk') {
        if (!this.locked && c.requestPointerLock) {
          try {
            const p = c.requestPointerLock();
            p?.catch?.(() => {});
          } catch (err) {}
        }
        if (e.button === 0) this.hold('interact', true);
        if (e.button === 2) this.press('light');
      } else if (this.mode === 'seat') {
        if (e.button === 2) this.hold('light', true);
      }
      this._drag = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.hold('interact', false);
      if (e.button === 2 && this.mode === 'seat') this.hold('light', false);
      this._drag = false;
    });
    addEventListener('mousemove', (e) => {
      const [mx, my] = px(e.clientX, e.clientY);
      this.pointer.x = mx / VIEW.w;
      this.pointer.y = my / VIEW.h;
      this.pointer.inside = true;
      if (this.mode === 'walk' && (this.locked || this._drag)) {
        // some browsers report one huge jump right after the pointer is locked: ignore it
        if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
        const [dx, dy] = delta(e.movementX || 0, e.movementY || 0);
        this.look.x += dx;
        this.look.y += dy;
      }
    });

    // ---- touch: left half = stick (walk mode), anything else = look drag
    const opt = { passive: false };
    c.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          const [tx, ty] = px(t.clientX, t.clientY);
          if (this.mode === 'walk' && tx < VIEW.w * 0.42 && !this.stick.active) {
            Object.assign(this.stick, { active: true, id: t.identifier, ox: tx, oy: ty, x: 0, y: 0 });
          } else if (this.lookTouch.id === -1) {
            this.lookTouch = { id: t.identifier, x: tx, y: ty };
          }
        }
      },
      opt,
    );
    c.addEventListener(
      'touchmove',
      (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) {
          const [tx, ty] = px(t.clientX, t.clientY);
          if (t.identifier === this.stick.id) {
            const R = Math.min(VIEW.w, VIEW.h) * 0.16;
            let dx = (tx - this.stick.ox) / R;
            let dy = (ty - this.stick.oy) / R;
            const l = Math.hypot(dx, dy);
            if (l > 1) {
              dx /= l;
              dy /= l;
            }
            this.stick.x = dx;
            this.stick.y = -dy;
          } else if (t.identifier === this.lookTouch.id) {
            this.look.x += (tx - this.lookTouch.x) * 1.6;
            this.look.y += (ty - this.lookTouch.y) * 1.6;
            this.lookTouch.x = tx;
            this.lookTouch.y = ty;
          }
        }
      },
      opt,
    );
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.stick.id) {
          this.stick.active = false;
          this.stick.id = -1;
          this.stick.x = this.stick.y = 0;
        }
        if (t.identifier === this.lookTouch.id) this.lookTouch.id = -1;
      }
    };
    c.addEventListener('touchend', end, opt);
    c.addEventListener('touchcancel', end, opt);
  }
}
