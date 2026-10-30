// Small math / helper utilities shared across the game.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

// Shortest signed angle difference a->b (radians)
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Deterministic PRNG so textures look the same on every load.
export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Phone/tablet controls only when there is no mouse or touchpad at all.
// (Many Windows laptops have a touchscreen too — they must still get mouse controls.)
export const isPhoneLike = () => {
  const mm = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  if (mm('(any-pointer: fine)')) return false;
  return mm('(pointer: coarse)') || navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
};

export function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
