// Procedural textures drawn on canvases at load time, so the game needs no image downloads.
import * as THREE from 'three';
import { rng } from '../core/math.js';

const cache = new Map();
export const SIGN_FONT = '"Noto Sans Hebrew", "Arial Hebrew", Arial, "DejaVu Sans", sans-serif';

function make(key, w, h, draw, { repeat = [1, 1], color = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h, rng(key.length * 7919 + w));
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

// sprinkle light and dark specks over a base color
function speckle(g, w, h, r, count, amount, size = 2) {
  for (let i = 0; i < count; i++) {
    const v = (r() - 0.5) * amount;
    g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
    const s = size * (0.5 + r());
    g.fillRect(r() * w, r() * h, s, s);
  }
}

export const Tex = {
  asphalt: () => make('asphalt', 256, 256, (g, w, h, r) => {
    g.fillStyle = '#4a4b4e';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 5000, 0.35, 2);
    for (let i = 0; i < 6; i++) { // patched repairs
      g.fillStyle = `rgba(30,30,32,${0.15 + r() * 0.15})`;
      g.fillRect(r() * w, r() * h, 30 + r() * 60, 20 + r() * 40);
    }
  }),

  // interlocking pavers, gray with a red band, the usual Israeli sidewalk
  pavers: () => make('pavers', 256, 256, (g, w, h, r) => {
    g.fillStyle = '#7d7a75';
    g.fillRect(0, 0, w, h);
    const bw = 64, bh = 32;
    for (let y = 0; y < h; y += bh) {
      const off = (y / bh) % 2 ? bw / 2 : 0;
      for (let x = -bw; x < w + bw; x += bw) {
        const red = (y / bh) % 8 === 3;
        const l = red ? 38 + r() * 8 : 62 + r() * 12;
        g.fillStyle = red ? `hsl(8, 38%, ${l}%)` : `hsl(35, 6%, ${l}%)`;
        g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
      }
    }
    speckle(g, w, h, r, 1500, 0.2, 1.5);
  }),

  curb: (painted) => make(painted ? 'curbRW' : 'curbGray', 128, 32, (g, w, h, r) => {
    if (painted) { // red and white curb: no stopping
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i % 2 ? '#f1efe9' : '#c8352d';
        g.fillRect((i * w) / 4, 0, w / 4, h);
      }
    } else {
      g.fillStyle = '#b9b5ac';
      g.fillRect(0, 0, w, h);
    }
    speckle(g, w, h, r, 300, 0.25, 1.5);
  }),

  plaster: () => make('plaster', 256, 256, (g, w, h, r) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 4000, 0.12, 2);
    for (let i = 0; i < 10; i++) { // faint rain stains
      const x = r() * w;
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, 'rgba(90,80,60,0.08)');
      grd.addColorStop(1, 'rgba(90,80,60,0)');
      g.fillStyle = grd;
      g.fillRect(x, 0, 6 + r() * 14, h * (0.3 + r() * 0.5));
    }
  }),

  // pale limestone blocks for garden and retaining walls
  stone: () => make('stone', 256, 256, (g, w, h, r) => {
    g.fillStyle = '#9c9282';
    g.fillRect(0, 0, w, h);
    const rows = 6, rh = h / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * 40;
      while (x < w) {
        const bw = 36 + r() * 46;
        const l = 70 + r() * 12;
        g.fillStyle = `hsl(${36 + r() * 8}, ${18 + r() * 14}%, ${l}%)`;
        g.fillRect(x + 2, i * rh + 2, bw - 4, rh - 4);
        x += bw;
      }
    }
    speckle(g, w, h, r, 2500, 0.25, 2);
  }),

  // aluminium roller shutter half down over dark glass, framed
  shutter: () => make('shutter', 128, 128, (g, w, h, r) => {
    g.fillStyle = '#e9e6df';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#26303a';
    g.fillRect(10, 10, w - 20, h - 20);
    const down = 0.35 + r() * 0.3;
    for (let y = 10; y < 10 + (h - 20) * down; y += 5) {
      g.fillStyle = y % 10 ? '#c9ccd0' : '#b3b7bc';
      g.fillRect(10, y, w - 20, 5);
    }
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(14, h * 0.62, w - 28, 4);
  }),

  door: () => make('door', 128, 256, (g, w, h) => {
    g.fillStyle = '#d9d4ca';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a4434';
    g.fillRect(10, 10, w - 20, h - 10);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 3;
    for (let y = 30; y < h - 20; y += 40) g.strokeRect(22, y, w - 44, 28);
    g.fillStyle = '#c9b27a';
    g.fillRect(w - 34, h * 0.55, 12, 5);
  }),

  roofTiles: () => make('roofTiles', 128, 128, (g, w, h, r) => {
    g.fillStyle = '#9b3b26';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) {
        g.fillStyle = `hsl(${10 + r() * 8}, 55%, ${38 + r() * 10}%)`;
        g.beginPath();
        g.ellipse(x + 8, y + 10, 7, 9, 0, 0, Math.PI);
        g.fill();
      }
    }
  }),

  solar: () => make('solar', 128, 128, (g, w, h) => {
    g.fillStyle = '#1b2a3f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(160,190,220,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo((i * w) / 8, 0); g.lineTo((i * w) / 8, h); g.stroke();
    }
    g.strokeRect(1, 1, w - 2, h - 2);
  }),

  // grain for the terrain: dry Mediterranean grass and red soil
  ground: () => make('ground', 256, 256, (g, w, h, r) => {
    g.fillStyle = '#dcdcdc'; // near white: the terrain's vertex colors carry the actual hue
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, r, 9000, 0.5, 2.5);
    for (let i = 0; i < 400; i++) { // grass strokes
      g.strokeStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.08 + r() * 0.1})`;
      g.lineWidth = 1;
      const x = r() * w, y = r() * h;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 4 - r() * 6); g.stroke();
    }
  }),

  // yellow and black speed bump
  bump: () => make('bump', 128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#1c1c1c' : '#f2c230';
      g.fillRect((i * w) / 8, 0, w / 8, h);
    }
  }),

  // soft vertical fade used by the objective beam
  beam: () => make('beam', 4, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, h, 0, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  }),

  // a sign plate with Hebrew text: one line, or several lines given as an array
  sign: (text, { bg = '#1d4f91', fg = '#ffffff', w = 512, h = 128, size = 64, border = true } = {}) =>
    make(`sign:${[].concat(text).join('|')}:${bg}:${w}x${h}`, w, h, (g) => {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      if (border) {
        g.strokeStyle = fg;
        g.lineWidth = 8;
        g.strokeRect(10, 10, w - 20, h - 20);
      }
      g.fillStyle = fg;
      g.direction = 'rtl';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `bold ${size}px ${SIGN_FONT}`;
      const lines = [].concat(text), lh = (h - 20) / lines.length;
      lines.forEach((line, i) => g.fillText(line, w / 2, 10 + lh * (i + 0.5) + size * 0.06));
    }, { repeat: [1, 1] }),
};
