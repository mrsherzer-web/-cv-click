import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const dampAngle = (a, b, k, dt) => a + angleDiff(a, b) * (1 - Math.exp(-k * dt));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// localStorage can be missing or throw (private mode, previews): never rely on it.
export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('brodna.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('brodna.' + key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  },
};

export function canvasTexture(w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// ---------- game-time scheduling for story scripts

export class Abort extends Error {}

// A Run owns every wait a script is blocked on, so a chapter can be cancelled cleanly.
export class Run {
  constructor(clock) {
    this.clock = clock;
    this.killed = false;
  }
  wait(s) {
    if (this.killed) return Promise.reject(new Abort());
    return new Promise((res, rej) => this.clock.waits.push({ run: this, at: this.clock.t + s, res, rej }));
  }
  until(fn) {
    if (this.killed) return Promise.reject(new Abort());
    return new Promise((res, rej) => this.clock.waits.push({ run: this, fn, res, rej }));
  }
  kill() {
    this.killed = true;
  }
}

export class Clock {
  constructor() {
    this.t = 0;
    this.waits = [];
  }
  tick(dt) {
    this.t += dt;
    const list = this.waits;
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      if (w.run.killed) {
        list.splice(i, 1);
        w.rej(new Abort());
      } else if (w.fn ? w.fn() : this.t >= w.at) {
        list.splice(i, 1);
        w.res();
      }
    }
  }
}
