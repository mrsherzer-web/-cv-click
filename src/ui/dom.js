// Small DOM helpers
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const UI = () => document.getElementById('ui');

export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function mount(html, root = UI()) {
  const el = typeof html === 'string' ? h(html) : html;
  root.appendChild(el);
  return el;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

let flashTimer = 0;
export function flash(color = '#fff', ms = 120, strength = 1) {
  const f = document.getElementById('flash');
  const reduced = window.__settings && window.__settings.flashing === false;
  f.style.background = color;
  f.style.transition = 'none';
  f.style.opacity = String(reduced ? strength * 0.25 : strength);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    f.style.transition = `opacity ${ms}ms`;
    f.style.opacity = '0';
  }, 30);
}

export function fade(on, ms = 600) {
  const f = document.getElementById('fade');
  f.style.transitionDuration = ms + 'ms';
  f.classList.toggle('on', on);
  return wait(ms);
}

/** Resolve on the first click / tap / key press */
export function anyInput(el = window, keys = true) {
  return new Promise((res) => {
    const done = (e) => {
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      el.removeEventListener('pointerdown', done);
      if (keys) window.removeEventListener('keydown', done);
      res(e);
    };
    el.addEventListener('pointerdown', done);
    if (keys) window.addEventListener('keydown', done);
  });
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches;
