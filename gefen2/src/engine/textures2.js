// ============================================================================
//  Extra procedural textures for the sequel
// ============================================================================
import { rnd } from './textures.js';

const R = (a, b) => a + rnd() * (b - a);
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
const cache = new Map();
const once = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};
function grime(x, w, h, n, color = '0,0,0', maxA = 0.25) {
  for (let i = 0; i < n; i++) {
    const px = R(0, w);
    const py = R(0, h);
    const r = R(w * 0.04, w * 0.3);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, `rgba(${color},${R(0.04, maxA)})`);
    g.addColorStop(1, `rgba(${color},0)`);
    x.fillStyle = g;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  }
}
function speckle(x, w, h, n, colors, a = 0.3) {
  for (let i = 0; i < n; i++) {
    x.globalAlpha = R(0.04, a);
    x.fillStyle = colors[(rnd() * colors.length) | 0];
    const r = R(0.6, 2.2);
    x.fillRect(R(0, w), R(0, h), r, r);
  }
  x.globalAlpha = 1;
}

export const concrete = (tone = 96) =>
  once('concrete' + tone, () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = `rgb(${tone},${tone - 2},${tone - 6})`;
    x.fillRect(0, 0, 512, 512);
    speckle(x, 512, 512, 9000, ['#000', '#fff', '#554'], 0.16);
    grime(x, 512, 512, 60, '10,8,6', 0.3);
    grime(x, 512, 512, 12, '200,200,190', 0.1);
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    for (let i = 0; i < 9; i++) {
      x.lineWidth = R(0.6, 1.8);
      x.beginPath();
      let px = R(0, 512);
      let py = R(0, 512);
      x.moveTo(px, py);
      for (let k = 0; k < 9; k++) {
        px += R(-40, 40);
        py += R(-10, 50);
        x.lineTo(px, py);
      }
      x.stroke();
    }
    // water stains running down
    for (let i = 0; i < 10; i++) {
      const sx = R(0, 512);
      const g = x.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, 'rgba(20,24,18,0.35)');
      g.addColorStop(1, 'rgba(20,24,18,0)');
      x.fillStyle = g;
      x.fillRect(sx, 0, R(4, 26), R(150, 500));
    }
    return c;
  });

export const carpet = (base = '#3a1418', ink = '#521c20') =>
  once('carpet' + base, () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = base;
    x.fillRect(0, 0, 512, 512);
    x.strokeStyle = ink;
    x.lineWidth = 6;
    for (let i = -512; i < 1024; i += 64) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 512, 512);
      x.stroke();
      x.beginPath();
      x.moveTo(i + 512, 0);
      x.lineTo(i, 512);
      x.stroke();
    }
    x.fillStyle = '#6a4a20';
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) x.fillRect(i * 64 - 4, j * 64 - 4, 8, 8);
    speckle(x, 512, 512, 12000, ['#000', '#111', '#754'], 0.3);
    grime(x, 512, 512, 46, '0,0,0', 0.42);
    return c;
  });

export const checker = (a = '#191919', b = '#b9b4a6') =>
  once('checker' + a + b, () => {
    const [c, x] = canvas(512, 512);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        x.fillStyle = (i + j) % 2 ? a : b;
        x.fillRect(i * 64, j * 64, 64, 64);
      }
    speckle(x, 512, 512, 7000, ['#000', '#333'], 0.22);
    grime(x, 512, 512, 50, '12,10,6', 0.4);
    return c;
  });

export const ventMetal = () =>
  once('ventmetal', () => {
    const [c, x] = canvas(512, 256);
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#7f8a8e');
    g.addColorStop(0.5, '#5c676b');
    g.addColorStop(1, '#727d81');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 400; i++) {
      x.globalAlpha = R(0.03, 0.14);
      x.fillStyle = rnd() > 0.5 ? '#fff' : '#000';
      x.fillRect(0, R(0, 256), 512, R(0.5, 1.6));
    }
    x.globalAlpha = 1;
    // panel seams and rivets
    x.fillStyle = 'rgba(0,0,0,0.55)';
    for (let i = 0; i <= 4; i++) x.fillRect(i * 128 - 2, 0, 4, 256);
    x.fillStyle = 'rgba(210,220,224,0.6)';
    for (let i = 0; i <= 4; i++) for (let j = 0; j < 5; j++) {
      x.beginPath();
      x.arc(i * 128 + 10, 20 + j * 54, 3, 0, 7);
      x.fill();
    }
    grime(x, 512, 256, 34, '30,18,8', 0.4);
    return c;
  });

export const rustWall = () =>
  once('rustwall', () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = '#4c5150';
    x.fillRect(0, 0, 512, 512);
    speckle(x, 512, 512, 9000, ['#000', '#665', '#888'], 0.2);
    grime(x, 512, 512, 70, '92,40,12', 0.4);
    grime(x, 512, 512, 30, '0,0,0', 0.35);
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.fillRect(0, 380, 512, 5);
    // hazard stripe band
    for (let i = -40; i < 560; i += 40) {
      x.fillStyle = 'rgba(190,150,20,0.5)';
      x.beginPath();
      x.moveTo(i, 400);
      x.lineTo(i + 20, 400);
      x.lineTo(i, 430);
      x.lineTo(i - 20, 430);
      x.fill();
    }
    return c;
  });

export const asphalt = () =>
  once('asphalt', () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = '#1c1d1f';
    x.fillRect(0, 0, 512, 512);
    speckle(x, 512, 512, 16000, ['#000', '#555', '#333'], 0.35);
    grime(x, 512, 512, 30, '0,0,0', 0.4);
    return c;
  });

export function arcadeScreen(hue = 0, title = 'SNOOKER') {
  const [c, x] = canvas(256, 200);
  x.fillStyle = '#04060a';
  x.fillRect(0, 0, 256, 200);
  const col = `hsl(${hue * 360},90%,60%)`;
  x.fillStyle = col;
  x.font = '900 30px VT323, monospace';
  x.textAlign = 'center';
  x.fillText(title, 128, 44);
  x.font = '400 20px VT323, monospace';
  x.fillStyle = '#e8e8e8';
  x.fillText('INSERT COIN', 128, 172);
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `hsl(${(hue * 360 + i * 37) % 360},85%,${40 + (i % 4) * 10}%)`;
    x.fillRect(20 + ((i * 53) % 210), 64 + ((i * 29) % 80), 8, 8);
  }
  x.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < 200; y += 3) x.fillRect(0, y, 256, 1);
  return c;
}

export const dirtyMirror = () =>
  once('mirror', () => {
    const [c, x] = canvas(512, 256);
    const g = x.createLinearGradient(0, 0, 512, 256);
    g.addColorStop(0, '#39474a');
    g.addColorStop(1, '#141a1c');
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 256);
    grime(x, 512, 256, 60, '0,0,0', 0.45);
    grime(x, 512, 256, 20, '180,190,190', 0.12);
    x.strokeStyle = 'rgba(200,210,210,0.35)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(350, 0);
    x.lineTo(310, 90);
    x.lineTo(360, 150);
    x.lineTo(330, 256);
    x.moveTo(310, 90);
    x.lineTo(240, 120);
    x.stroke();
    return c;
  });

export function warningSign(text) {
  const [c, x] = canvas(512, 200);
  x.fillStyle = '#d6b21a';
  x.fillRect(0, 0, 512, 200);
  x.fillStyle = '#111';
  for (let i = -200; i < 712; i += 60) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 30, 0);
    x.lineTo(i - 10, 34);
    x.lineTo(i - 40, 34);
    x.fill();
    x.beginPath();
    x.moveTo(i, 166);
    x.lineTo(i + 30, 166);
    x.lineTo(i - 10, 200);
    x.lineTo(i - 40, 200);
    x.fill();
  }
  x.direction = 'rtl';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '900 64px Heebo, sans-serif';
  x.fillText(text, 256, 102);
  grime(x, 512, 200, 14, '40,20,0', 0.35);
  return c;
}

export function note(text) {
  const [c, x] = canvas(300, 380);
  x.fillStyle = '#d9cfae';
  x.fillRect(0, 0, 300, 380);
  grime(x, 300, 380, 14, '80,50,10', 0.28);
  x.fillStyle = '#231a12';
  x.direction = 'rtl';
  x.textAlign = 'center';
  x.font = '700 30px Heebo, sans-serif';
  const lines = String(text).split('\n');
  lines.forEach((l, i) => x.fillText(l, 150, 90 + i * 52));
  return c;
}

/** Neon style Hebrew sign on transparent background */
export function neon(text, color = '#ff2a4a', size = 150, w = 1024, h = 256, font = 'Rubik Wet Paint') {
  const [c, x] = canvas(w, h);
  x.direction = 'rtl';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `400 ${size}px "${font}", Heebo, sans-serif`;
  x.shadowColor = color;
  x.shadowBlur = size * 0.35;
  x.fillStyle = color;
  x.fillText(text, w / 2, h / 2);
  x.fillText(text, w / 2, h / 2);
  x.shadowBlur = 0;
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.fillText(text, w / 2, h / 2);
  return c;
}

/** Small door plate */
export function plate(text, bg = '#1a1c1e', color = '#e8e0c8') {
  const [c, x] = canvas(512, 128);
  x.fillStyle = bg;
  x.fillRect(0, 0, 512, 128);
  x.strokeStyle = color;
  x.lineWidth = 5;
  x.strokeRect(8, 8, 496, 112);
  x.direction = 'rtl';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '900 64px Heebo, sans-serif';
  x.fillStyle = color;
  x.fillText(text, 256, 68);
  return c;
}

/** Wall clock face that the game redraws: returns { canvas, draw(hours) } */
export function clockFace() {
  const [c, x] = canvas(256, 256);
  const draw = (hours = 0) => {
    x.fillStyle = '#d8d2c0';
    x.beginPath();
    x.arc(128, 128, 124, 0, 7);
    x.fill();
    x.strokeStyle = '#111';
    x.lineWidth = 8;
    x.stroke();
    x.fillStyle = '#111';
    x.font = '900 30px Heebo, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      x.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
    }
    const hand = (a, len, lw, col) => {
      x.strokeStyle = col;
      x.lineWidth = lw;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(128, 128);
      x.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len);
      x.stroke();
    };
    hand((hours / 12) * Math.PI * 2, 56, 9, '#111');
    hand((hours % 1) * Math.PI * 2, 86, 5, '#111');
    x.fillStyle = '#a00';
    x.beginPath();
    x.arc(128, 128, 7, 0, 7);
    x.fill();
  };
  draw(0);
  return { canvas: c, draw };
}

/** Sky backdrop: night or sunrise */
export function sky(sunrise = false) {
  const [c, x] = canvas(512, 256);
  const g = x.createLinearGradient(0, 0, 0, 256);
  if (sunrise) {
    g.addColorStop(0, '#2b3a66');
    g.addColorStop(0.55, '#e08a5a');
    g.addColorStop(0.8, '#ffd9a0');
    g.addColorStop(1, '#ffe9c4');
  } else {
    g.addColorStop(0, '#02030a');
    g.addColorStop(0.7, '#0a1024');
    g.addColorStop(1, '#141a30');
  }
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 256);
  if (!sunrise) {
    for (let i = 0; i < 140; i++) {
      x.globalAlpha = R(0.2, 0.9);
      x.fillStyle = '#fff';
      x.fillRect(R(0, 512), R(0, 170), 1.2, 1.2);
    }
    x.globalAlpha = 1;
  } else {
    const s = x.createRadialGradient(256, 232, 0, 256, 232, 200);
    s.addColorStop(0, 'rgba(255,250,220,1)');
    s.addColorStop(0.2, 'rgba(255,220,150,0.7)');
    s.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = s;
    x.fillRect(0, 0, 512, 256);
  }
  // skyline
  x.fillStyle = sunrise ? '#1a1412' : '#020204';
  let px = 0;
  while (px < 512) {
    const w = R(18, 60);
    const h = R(14, 60);
    x.fillRect(px, 256 - h, w, h);
    px += w;
  }
  return c;
}

/** Soft round light pool for floors */
export const pool = (color = '255,225,170') =>
  once('pool' + color, () => {
    const [c, x] = canvas(128, 128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${color},0.55)`);
    g.addColorStop(0.45, `rgba(${color},0.18)`);
    g.addColorStop(1, `rgba(${color},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return c;
  });

/** Dust mote sprite */
export const mote = () =>
  once('mote', () => {
    const [c, x] = canvas(32, 32);
    const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 32, 32);
    return c;
  });
