// ============================================================================
//  New props for the sequel (built from boxes and cylinders, merged per room)
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import * as T from '../engine/textures.js';
import * as T2 from '../engine/textures2.js';
import { box, cyl, std, mat, M } from './props.js';

const basic = (color, k = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k) });
const texMat = (key, canvasFn, opts = {}) =>
  mat('tm:' + key, () => new THREE.MeshStandardMaterial({ map: T.tex(canvasFn()), roughness: opts.rough ?? 0.8, metalness: opts.metal ?? 0 }));

/** Arcade cabinet with a glowing screen. Returns group with .screen (MeshBasicMaterial) for flicker. */
export function arcadeCabinet(hue = 0, title = 'SNOOKER') {
  const g = new THREE.Group();
  const body = std(new THREE.Color().setHSL(hue, 0.55, 0.16).getHex(), 0.6);
  box(0.72, 1.0, 0.7, body, 0, 0.5, 0, g);
  box(0.72, 0.75, 0.5, body, 0, 1.37, -0.1, g);
  box(0.76, 0.16, 0.56, std(0x0a0a0c, 0.5), 0, 1.82, -0.07, g);
  const panel = box(0.7, 0.06, 0.34, std(0x15151a, 0.4), 0, 1.02, 0.2, g);
  panel.rotation.x = 0.25;
  cyl(0.02, 0.02, 0.1, M.steel, -0.16, 1.1, 0.2, g, 6);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), std(0xb01020, 0.4));
  knob.position.set(-0.16, 1.16, 0.2);
  g.add(knob);
  for (let i = 0; i < 3; i++) cyl(0.028, 0.028, 0.02, std([0xd0a020, 0x2060d0, 0xd02040][i], 0.4), 0.05 + i * 0.1, 1.07, 0.22, g, 8);
  const scr = new THREE.MeshBasicMaterial({ map: T.tex(T2.arcadeScreen(hue, title)) });
  scr.color.multiplyScalar(1.6);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.44), scr);
  s.position.set(0, 1.42, 0.16);
  s.rotation.x = -0.12;
  s.userData.keep = true;
  g.add(s);
  const mq = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.13), new THREE.MeshBasicMaterial({ map: T.tex(T.textTexture([title], { w: 256, h: 64, bg: '#120408', color: '#ffb020', font: '900 40px VT323', rtl: false })) }));
  mq.position.set(0, 1.82, 0.215);
  mq.userData.keep = true;
  g.add(mq);
  g.screen = scr;
  g.footprint = [0.8, 0.8];
  return g;
}

export function locker(n = 3) {
  const g = new THREE.Group();
  const m = std(0x39454a, 0.55, 0.5);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.42;
    box(0.4, 1.85, 0.45, m, x, 0.925, 0, g);
    box(0.34, 0.1, 0.01, std(0x10161a, 0.6), x, 1.55, 0.23, g);
    box(0.03, 0.1, 0.02, M.steel, x + 0.13, 1.0, 0.235, g);
  }
  return g;
}

/** Stack of cardboard boxes */
export function crates(seed = 1, n = 5) {
  const g = new THREE.Group();
  const cm = texMat('card', T.cardboard, { rough: 0.9 });
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 233280 + 49297) % 233280), s / 233280);
  let y = 0;
  let w = 0.75;
  for (let i = 0; i < n; i++) {
    const bw = w * (0.8 + r() * 0.25);
    const bh = 0.35 + r() * 0.25;
    const b = box(bw, bh, bw * (0.8 + r() * 0.3), cm, (r() - 0.5) * 0.2 + (i % 2 ? 0.5 : 0) * (i > 2 ? 0 : 1), 0, (r() - 0.5) * 0.15, g);
    if (i % 2 === 0 || i > 2) {
      b.position.y = y + bh / 2;
      y += bh;
    } else b.position.y = bh / 2;
    b.rotation.y = (r() - 0.5) * 0.5;
    w *= 0.93;
  }
  return g;
}

export function bottle(color = 0x2a5c2e, lying = false) {
  const g = new THREE.Group();
  const m = std(color, 0.15, 0.1, { transparent: false });
  cyl(0.035, 0.035, 0.18, m, 0, 0.09, 0, g, 8).castShadow = false;
  cyl(0.012, 0.03, 0.08, m, 0, 0.22, 0, g, 8).castShadow = false;
  if (lying) {
    g.children.forEach((c) => {
      c.rotation.z = Math.PI / 2;
      c.position.set(c.position.y - 0.09, 0.035, 0);
    });
  }
  return g;
}

/** Toilet stall block: n stalls, each 0.95 wide */
export function stalls(n = 3) {
  const g = new THREE.Group();
  const wm = std(0x4d5a55, 0.6);
  const dm = std(0x5c6a64, 0.55);
  const w = 0.95;
  for (let i = 0; i <= n; i++) box(0.04, 1.9, 1.4, wm, i * w, 1.05, 0, g);
  for (let i = 0; i < n; i++) {
    const d = box(w - 0.1, 1.7, 0.035, dm, i * w + w / 2, 1.05, 0.7, g);
    if (i === 1) {
      d.rotation.y = 0.9;
      d.position.x -= 0.2;
      d.position.z += 0.3;
    }
    // bowl
    cyl(0.19, 0.15, 0.38, M.white, i * w + w / 2, 0.19, -0.3, g, 12);
    box(0.36, 0.34, 0.16, M.white, i * w + w / 2, 0.52, -0.6, g);
  }
  g.size = [n * w, 1.4];
  return g;
}

export function sinks(n = 2) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = i * 0.85;
    box(0.6, 0.14, 0.45, M.white, x, 0.82, 0, g);
    cyl(0.03, 0.03, 0.75, M.steel, x, 0.4, -0.08, g, 6);
    cyl(0.012, 0.012, 0.16, M.steel, x, 0.97, -0.16, g, 6);
  }
  // long dirty mirror
  const mm = new THREE.Mesh(
    new THREE.PlaneGeometry(n * 0.85, 0.75),
    new THREE.MeshStandardMaterial({ map: T.tex(T2.dirtyMirror()), roughness: 0.18, metalness: 0.85 }),
  );
  mm.position.set(((n - 1) * 0.85) / 2, 1.5, -0.2);
  g.add(mm);
  return g;
}

/** Wall mounted breaker panel with three switches and a big lever. */
export function breakerPanel() {
  const g = new THREE.Group();
  box(0.9, 1.2, 0.16, std(0x4b5357, 0.5, 0.6), 0, 0, 0, g);
  box(0.8, 1.1, 0.02, std(0x23282b, 0.6, 0.4), 0, 0, 0.085, g);
  g.switches = [];
  g.leds = [];
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.22;
    box(0.12, 0.26, 0.03, std(0x101214, 0.5), x, 0.2, 0.1, g);
    const sw = box(0.06, 0.12, 0.05, std(0xd8d8d0, 0.4), x, 0.14, 0.13, g);
    sw.userData.keep = true;
    g.switches.push(sw);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), basic(0xff2010, 2.5));
    led.position.set(x, 0.42, 0.097);
    led.userData.keep = true;
    g.add(led);
    g.leds.push(led);
  }
  const lever = new THREE.Group();
  box(0.05, 0.34, 0.05, std(0xb81414, 0.4), 0, 0.17, 0, lever);
  const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std(0x111111, 0.4));
  k.position.y = 0.34;
  lever.add(k);
  lever.position.set(0.28, -0.42, 0.11);
  lever.rotation.x = 0.9;
  lever.traverse((o) => (o.userData.keep = true));
  g.add(lever);
  g.lever = lever;
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshStandardMaterial({ map: T.tex(T2.warningSign('סכנה · מתח גבוה')), roughness: 0.6 }));
  warn.position.set(-0.1, -0.36, 0.098);
  g.add(warn);
  return g;
}

export function fuseBox() {
  const g = new THREE.Group();
  box(0.5, 0.65, 0.14, std(0x55605c, 0.5, 0.6), 0, 0, 0, g);
  box(0.42, 0.57, 0.02, std(0x1c2224, 0.6), 0, 0, 0.075, g);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), basic(0xff2010, 2.5));
  led.position.set(0.14, 0.2, 0.09);
  led.userData.keep = true;
  g.add(led);
  g.led = led;
  for (let i = 0; i < 4; i++) box(0.05, 0.16, 0.03, std(0xc8c8c0, 0.5), -0.14 + i * 0.07, -0.08, 0.09, g);
  return g;
}

export function generator() {
  const g = new THREE.Group();
  const bm = std(0x3d4a2c, 0.6, 0.4);
  box(2.2, 1.1, 1.1, bm, 0, 0.75, 0, g);
  box(2.4, 0.2, 1.3, std(0x1a1c1c, 0.7), 0, 0.1, 0, g);
  cyl(0.28, 0.28, 0.9, std(0x2a2d2e, 0.5, 0.6), -0.55, 1.45, 0, g, 12).rotation.z = Math.PI / 2;
  cyl(0.06, 0.06, 1.3, std(0x15171a, 0.6, 0.5), 0.8, 1.9, -0.2, g, 8);
  box(0.5, 0.4, 0.04, std(0x111214, 0.5), 0.55, 0.9, 0.57, g);
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), basic(0xff2010, 2.5));
  led.position.set(0.55, 0.98, 0.595);
  led.userData.keep = true;
  g.add(led);
  g.led = led;
  for (let i = 0; i < 6; i++) box(0.02, 0.5, 0.02, std(0x0c0d0e, 0.6), -0.9 + i * 0.12, 0.75, 0.56, g);
  return g;
}

export function receptionDesk() {
  const g = new THREE.Group();
  box(2.8, 1.05, 0.7, M.darkWood, 0, 0.525, 0, g);
  box(3.0, 0.06, 0.85, M.mahogany, 0, 1.08, 0, g);
  box(0.7, 1.05, 1.6, M.darkWood, 1.05, 0.525, -1.1, g);
  box(0.85, 0.06, 1.7, M.mahogany, 1.05, 1.08, -1.1, g);
  // old monitor + bell
  box(0.45, 0.36, 0.38, std(0xb9b39f, 0.6), -0.6, 1.3, -0.05, g);
  box(0.36, 0.27, 0.02, std(0x050607, 0.2), -0.6, 1.31, 0.15, g);
  cyl(0.06, 0.07, 0.05, M.brass, 0.35, 1.13, 0.15, g, 10);
  return g;
}

/** Glass double door leaf pair in a metal frame (closed). Returns group with .leaves */
export function glassDoors(w = 2.0, h = 2.4) {
  const g = new THREE.Group();
  const fm = std(0x1b1e20, 0.4, 0.7);
  const gm = new THREE.MeshStandardMaterial({ color: 0x8fb0b8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false });
  g.leaves = [];
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    const lw = w / 2;
    box(lw, 0.07, 0.05, fm, (s * lw) / 2, 0.035, 0, leaf);
    box(lw, 0.07, 0.05, fm, (s * lw) / 2, h - 0.035, 0, leaf);
    box(0.07, h, 0.05, fm, s * 0.035, h / 2, 0, leaf);
    box(0.07, h, 0.05, fm, s * (lw - 0.035), h / 2, 0, leaf);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.12, h - 0.12), gm);
    pane.position.set((s * lw) / 2, h / 2, 0);
    pane.material.side = THREE.DoubleSide;
    leaf.add(pane);
    box(0.03, 0.4, 0.07, M.steel, s * 0.1, 1.05, 0, leaf);
    leaf.position.x = -s * lw;
    leaf.traverse((o) => (o.userData.keep = true));
    g.add(leaf);
    g.leaves.push(leaf);
  }
  return g;
}

export function ventGrate(w = 0.9, h = 0.8) {
  const g = new THREE.Group();
  const fm = std(0x6c7478, 0.45, 0.8);
  box(w + 0.1, 0.05, 0.04, fm, 0, h / 2, 0, g);
  box(w + 0.1, 0.05, 0.04, fm, 0, -h / 2, 0, g);
  box(0.05, h, 0.04, fm, -w / 2, 0, 0, g);
  box(0.05, h, 0.04, fm, w / 2, 0, 0, g);
  for (let i = 1; i < 8; i++) box(w, 0.018, 0.05, fm, 0, -h / 2 + (i * h) / 8, 0, g).rotation.x = 0.5;
  return g;
}

/** The security desk: wide, with a gap in the middle so the corridor stays visible. */
export function securityDesk() {
  const g = new THREE.Group();
  const top = M.darkWood;
  box(3.4, 0.06, 0.85, top, 0, 0.74, 0, g);
  box(0.08, 0.74, 0.8, top, -1.62, 0.37, 0, g);
  box(0.08, 0.74, 0.8, top, 1.62, 0.37, 0, g);
  box(3.2, 0.45, 0.04, top, 0, 0.5, -0.38, g);
  // drawers
  box(0.6, 0.6, 0.7, std(0x1d120b, 0.7), 1.25, 0.37, 0, g);
  // papers, mug, keyboard
  box(0.45, 0.02, 0.16, std(0x1a1a1c, 0.6), 0, 0.78, 0.2, g);
  cyl(0.045, 0.04, 0.1, std(0xb0a090, 0.5), 0.5, 0.82, 0.22, g, 10);
  box(0.3, 0.01, 0.22, std(0xcfc8b6, 0.9), -0.45, 0.775, 0.2, g).rotation.y = 0.3;
  return g;
}

/** Old CRT security monitor. Returns group with .screen material (map can be swapped). */
export function crt(w = 0.62) {
  const g = new THREE.Group();
  const h = w * 0.8;
  box(w, h, w * 0.85, std(0x4a4842, 0.6), 0, h / 2, 0, g);
  box(w * 0.92, h * 0.86, 0.03, std(0x15171a, 0.4), 0, h / 2, w * 0.43, g);
  const sm = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.72), sm);
  s.position.set(0, h / 2, w * 0.45);
  s.userData.keep = true;
  g.add(s);
  g.screen = sm;
  return g;
}

export function gamingChair(color = 0xa01018) {
  const g = new THREE.Group();
  const lm = std(color, 0.5);
  const bm = std(0x0c0c0e, 0.5);
  box(0.52, 0.1, 0.5, bm, 0, 0.5, 0, g);
  box(0.5, 0.95, 0.1, bm, 0, 1.02, -0.24, g).rotation.x = -0.08;
  box(0.1, 0.9, 0.11, lm, -0.2, 1.02, -0.235, g).rotation.x = -0.08;
  box(0.1, 0.9, 0.11, lm, 0.2, 1.02, -0.235, g).rotation.x = -0.08;
  box(0.3, 0.16, 0.12, lm, 0, 1.48, -0.26, g);
  cyl(0.035, 0.035, 0.42, M.steel, 0, 0.26, 0, g, 8);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const leg = box(0.3, 0.035, 0.05, bm, Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15, g);
    leg.rotation.y = -a;
  }
  box(0.06, 0.03, 0.3, bm, -0.29, 0.72, 0, g);
  box(0.06, 0.03, 0.3, bm, 0.29, 0.72, 0, g);
  return g;
}

/** Big wall lever (kill switch). g.lever rotates. */
export function killSwitch() {
  const g = new THREE.Group();
  box(0.36, 0.56, 0.1, std(0x53595c, 0.5, 0.6), 0, 0, 0, g);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshStandardMaterial({ map: T.tex(T2.warningSign('ניתוק חשמל')), roughness: 0.6 }));
  pl.position.set(0, 0.2, 0.052);
  g.add(pl);
  const lever = new THREE.Group();
  box(0.05, 0.3, 0.05, std(0xc21818, 0.4), 0, 0.15, 0.03, lever);
  box(0.16, 0.05, 0.06, std(0x121212, 0.4), 0, 0.3, 0.03, lever);
  lever.position.set(0, -0.14, 0.06);
  lever.rotation.x = -0.7;
  lever.traverse((o) => (o.userData.keep = true));
  g.add(lever);
  g.lever = lever;
  return g;
}

export function keypad() {
  const g = new THREE.Group();
  box(0.2, 0.3, 0.05, std(0x2a2f33, 0.5, 0.5), 0, 0, 0, g);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.05), basic(0xff3020, 1.6));
  scr.position.set(0, 0.1, 0.027);
  scr.userData.keep = true;
  g.add(scr);
  g.led = scr;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) box(0.035, 0.035, 0.012, std(0xb8b8b0, 0.5), (c - 1) * 0.05, 0.03 - r * 0.045, 0.03, g);
  return g;
}

export function snookerBall(color = 0x000000, r = 0.045) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.05, emissive: color, emissiveIntensity: 0.35 }));
  m.userData.keep = true;
  m.castShadow = true;
  return m;
}

export function keyProp() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xd8b040, roughness: 0.3, metalness: 0.9, emissive: 0x5a4008, emissiveIntensity: 0.8 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 14), m);
  g.add(ring);
  const sh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.008), m);
  sh.position.x = 0.06;
  g.add(sh);
  g.traverse((o) => (o.userData.keep = true));
  g.rotation.x = -Math.PI / 2;
  return g;
}

export function notePaper(text = '') {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.38),
    new THREE.MeshStandardMaterial({ map: T.tex(T2.note(text)), roughness: 0.9, emissive: 0x332d20, emissiveIntensity: 0.5 }),
  );
  m.userData.keep = true;
  return m;
}

/** The altar in the basement: an old small snooker side table with the black ball. */
export function altar() {
  const g = new THREE.Group();
  box(1.3, 0.1, 0.8, M.mahogany, 0, 0.82, 0, g);
  box(1.2, 0.04, 0.7, M.felt, 0, 0.885, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.09, 0.78, 0.09, M.darkWood, sx * 0.55, 0.39, sz * 0.3, g);
  // candles (unlit stubs)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    cyl(0.025, 0.03, 0.08 + (i % 3) * 0.03, std(0xd8cfb8, 0.8), Math.cos(a) * 0.42, 0.95, Math.sin(a) * 0.24, g, 8);
  }
  return g;
}

export function pipeRun(len, r = 0.05, color = 0x4a3a2c) {
  const m = cyl(r, r, len, std(color, 0.5, 0.6), 0, 0, 0, null, 8);
  m.rotation.z = Math.PI / 2;
  return m;
}

export function wallPhone() {
  const g = new THREE.Group();
  box(0.16, 0.26, 0.06, std(0x151515, 0.5), 0, 0, 0, g);
  box(0.06, 0.24, 0.05, std(0x0c0c0c, 0.5), 0.0, 0, 0.05, g);
  return g;
}

/** Simple table + two chairs for the bar */
export function barTable() {
  const g = new THREE.Group();
  cyl(0.45, 0.45, 0.04, M.darkWood, 0, 0.74, 0, g, 18);
  cyl(0.04, 0.04, 0.72, M.black, 0, 0.36, 0, g, 8);
  cyl(0.25, 0.25, 0.03, M.black, 0, 0.015, 0, g, 12);
  return g;
}

export function chair() {
  const g = new THREE.Group();
  box(0.42, 0.04, 0.42, M.darkWood, 0, 0.46, 0, g);
  box(0.42, 0.5, 0.04, M.darkWood, 0, 0.72, -0.2, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.46, 0.04, M.darkWood, sx * 0.18, 0.23, sz * 0.18, g);
  return g;
}

export function trashBag() {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), std(0x0a0a0b, 0.35));
  m.scale.set(1, 0.75, 0.9);
  m.position.y = 0.2;
  m.castShadow = true;
  return m;
}
