// ============================================================================
//  Procedural textures drawn on <canvas> (no texture files needed)
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';

let seed = 1337;
export const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const R = (a, b) => a + rnd() * (b - a);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

export function tex(c, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = aniso;
  return t;
}

function speckle(ctx, w, h, n, colors, rmin = 0.5, rmax = 1.5, alpha = 0.3) {
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = R(0.05, alpha);
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
    const r = R(rmin, rmax);
    ctx.fillRect(R(0, w), R(0, h), r, r);
  }
  ctx.globalAlpha = 1;
}

function grime(ctx, w, h, n = 30, color = '0,0,0', maxA = 0.25) {
  for (let i = 0; i < n; i++) {
    const x = R(0, w);
    const y = R(0, h);
    const r = R(w * 0.03, w * 0.25);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${R(0.05, maxA)})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

const cache = new Map();
const once = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

// ----------------------------------------------------------------- surfaces
export const woodFloor = (dark = false) =>
  once('wood' + dark, () => {
    const [c, x] = canvas(1024, 1024);
    const plankH = 64;
    for (let y = 0; y < 1024; y += plankH) {
      let px = -R(0, 400);
      while (px < 1024) {
        const len = R(300, 700);
        const base = dark ? [R(38, 55), R(22, 32), R(14, 20)] : [R(92, 120), R(55, 72), R(32, 44)];
        x.fillStyle = `rgb(${base.map((v) => v | 0).join(',')})`;
        x.fillRect(px, y, len, plankH);
        // grain
        for (let g = 0; g < 26; g++) {
          x.strokeStyle = `rgba(${dark ? '10,5,2' : '40,22,10'},${R(0.08, 0.3)})`;
          x.lineWidth = R(0.5, 2);
          x.beginPath();
          const gy = y + R(2, plankH - 2);
          x.moveTo(px, gy);
          for (let s = px; s < px + len; s += 40) x.lineTo(s, gy + Math.sin(s * 0.01 + g) * R(0.5, 3));
          x.stroke();
        }
        x.fillStyle = 'rgba(0,0,0,0.65)';
        x.fillRect(px, y, 2, plankH);
        px += len;
      }
      x.fillStyle = 'rgba(0,0,0,0.7)';
      x.fillRect(0, y, 1024, 2);
    }
    grime(x, 1024, 1024, 40, '0,0,0', 0.3);
    speckle(x, 1024, 1024, 3000, ['#000', '#2a1a10', '#6b4a30'], 0.5, 2, 0.25);
    return c;
  });

export const felt = (color = '#1d7a3a') =>
  once('felt' + color, () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = color;
    x.fillRect(0, 0, 512, 512);
    speckle(x, 512, 512, 14000, ['#000', '#fff', '#0a3a18'], 0.5, 1.2, 0.08);
    grime(x, 512, 512, 12, '0,0,0', 0.12);
    return c;
  });

export const ceilingTiles = (broken = false) =>
  once('ceil' + broken, () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = '#b9b4a6';
    x.fillRect(0, 0, 512, 512);
    speckle(x, 512, 512, 9000, ['#5a564d', '#8a8579', '#d8d3c4'], 0.6, 2.2, 0.45);
    grime(x, 512, 512, 18, '60,45,20', 0.25);
    x.strokeStyle = '#6e6a60';
    x.lineWidth = 6;
    for (let i = 0; i <= 512; i += 256) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, 512);
      x.moveTo(0, i);
      x.lineTo(512, i);
      x.stroke();
    }
    if (broken) {
      // water stains + a hole
      grime(x, 512, 512, 8, '90,60,20', 0.45);
      x.fillStyle = '#0b0a09';
      x.beginPath();
      x.moveTo(300, 290);
      for (let a = 0; a < Math.PI * 2; a += 0.4) x.lineTo(360 + Math.cos(a) * R(30, 70), 350 + Math.sin(a) * R(30, 60));
      x.fill();
    }
    return c;
  });

export const wallpaper = (base = '#20302a', ink = '#2c4238') =>
  once('wp' + base, () => {
    // lower: dark wood wainscot, upper: damask wallpaper
    const [c, x] = canvas(512, 1024);
    x.fillStyle = base;
    x.fillRect(0, 0, 512, 1024);
    x.fillStyle = ink;
    for (let yy = 0; yy < 700; yy += 96) {
      for (let xx = (yy / 96) % 2 ? 48 : 0; xx < 560; xx += 96) {
        x.beginPath();
        x.ellipse(xx, yy, 18, 30, 0, 0, Math.PI * 2);
        x.fill();
        x.beginPath();
        x.ellipse(xx, yy, 34, 10, 0, 0, Math.PI * 2);
        x.fill();
      }
    }
    // vertical stripes
    x.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = 0; i < 512; i += 32) x.fillRect(i, 0, 4, 700);
    // wainscot
    const wood = x.createLinearGradient(0, 700, 0, 1024);
    wood.addColorStop(0, '#3a2213');
    wood.addColorStop(1, '#22130a');
    x.fillStyle = wood;
    x.fillRect(0, 690, 512, 334);
    x.fillStyle = '#5a3a20';
    x.fillRect(0, 682, 512, 16);
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    x.lineWidth = 3;
    for (let i = 20; i < 512; i += 128) x.strokeRect(i, 730, 100, 250);
    grime(x, 512, 1024, 30, '0,0,0', 0.35);
    speckle(x, 512, 1024, 4000, ['#000', '#3d2a1a'], 0.5, 1.6, 0.2);
    return c;
  });

export const plainWall = (color = '#4a4038') =>
  once('pw' + color, () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = color;
    x.fillRect(0, 0, 512, 512);
    grime(x, 512, 512, 40, '0,0,0', 0.3);
    speckle(x, 512, 512, 6000, ['#000', '#777'], 0.5, 1.5, 0.15);
    // cracks
    x.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 4; k++) {
      x.lineWidth = R(0.6, 1.6);
      x.beginPath();
      let px = R(0, 512);
      let py = R(0, 512);
      x.moveTo(px, py);
      for (let s = 0; s < 12; s++) x.lineTo((px += R(-25, 25)), (py += R(5, 30)));
      x.stroke();
    }
    return c;
  });

export const bathTiles = () =>
  once('bath', () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = '#5d6664';
    x.fillRect(0, 0, 512, 512);
    for (let yy = 0; yy < 512; yy += 64)
      for (let xx = 0; xx < 512; xx += 64) {
        const v = R(170, 205);
        x.fillStyle = `rgb(${v},${v + 4},${v + 2})`;
        x.fillRect(xx + 3, yy + 3, 58, 58);
      }
    grime(x, 512, 512, 30, '70,60,30', 0.35);
    speckle(x, 512, 512, 2500, ['#000', '#4a3a20'], 0.5, 2, 0.3);
    return c;
  });

export const metal = (rust = 0.4) =>
  once('metal' + rust, () => {
    const [c, x] = canvas(512, 512);
    x.fillStyle = '#5d6166';
    x.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 32) {
      const g = x.createLinearGradient(0, y, 0, y + 32);
      g.addColorStop(0, '#8a8f94');
      g.addColorStop(0.5, '#5a5f64');
      g.addColorStop(1, '#2e3135');
      x.fillStyle = g;
      x.fillRect(0, y, 512, 32);
    }
    grime(x, 512, 512, Math.floor(60 * rust), '110,50,15', 0.45);
    speckle(x, 512, 512, 5000, ['#000', '#7a3a10', '#aaa'], 0.5, 2, 0.25);
    return c;
  });

export const cardboard = () =>
  once('card', () => {
    const [c, x] = canvas(256, 256);
    x.fillStyle = '#8a6a42';
    x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 256; i += 6) x.fillRect(i, 0, 2, 256);
    x.fillStyle = '#c9b48a';
    x.fillRect(0, 118, 256, 20);
    grime(x, 256, 256, 10, '40,20,0', 0.3);
    return c;
  });

export const leather = (color = '#5a0d12') =>
  once('leather' + color, () => {
    const [c, x] = canvas(256, 256);
    x.fillStyle = color;
    x.fillRect(0, 0, 256, 256);
    speckle(x, 256, 256, 5000, ['#000', '#fff'], 0.5, 1.5, 0.08);
    grime(x, 256, 256, 10, '0,0,0', 0.4);
    return c;
  });

export const curtain = () =>
  once('curtain', () => {
    const [c, x] = canvas(512, 512);
    for (let i = 0; i < 512; i++) {
      const v = 0.5 + 0.5 * Math.sin(i * 0.11) * Math.sin(i * 0.031 + 1);
      x.fillStyle = `rgb(${(60 + v * 70) | 0},${(4 + v * 8) | 0},${(10 + v * 10) | 0})`;
      x.fillRect(i, 0, 1, 512);
    }
    grime(x, 512, 512, 12, '0,0,0', 0.3);
    return c;
  });

// ----------------------------------------------------------------- signs etc.
export function textTexture(lines, opts = {}) {
  const {
    w = 512, h = 256, bg = '#111', color = '#fff', font = '900 80px Heebo', glow = null,
    align = 'center', rtl = true, border = null, lineGap = 1.15, shadow = null,
  } = opts;
  const [c, x] = canvas(w, h);
  if (bg) {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
  }
  if (border) {
    x.strokeStyle = border;
    x.lineWidth = Math.max(4, w * 0.015);
    x.strokeRect(x.lineWidth, x.lineWidth, w - x.lineWidth * 2, h - x.lineWidth * 2);
  }
  x.direction = rtl ? 'rtl' : 'ltr';
  x.textAlign = align;
  x.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  const fonts = Array.isArray(font) ? font : arr.map(() => font);
  const sizes = fonts.map((f) => parseFloat(f.match(/(\d+)px/)[1]));
  const total = sizes.reduce((a, b) => a + b * lineGap, 0);
  let y = h / 2 - total / 2;
  arr.forEach((line, i) => {
    x.font = fonts[i];
    y += (sizes[i] * lineGap) / 2;
    const cx = align === 'center' ? w / 2 : align === 'right' ? w - 20 : 20;
    if (glow) {
      x.shadowColor = glow;
      x.shadowBlur = sizes[i] * 0.45;
    } else if (shadow) {
      x.shadowColor = shadow;
      x.shadowBlur = 6;
    }
    x.fillStyle = Array.isArray(color) ? color[i] : color;
    x.fillText(line, cx, y);
    if (glow) x.fillText(line, cx, y);
    x.shadowBlur = 0;
    y += (sizes[i] * lineGap) / 2;
  });
  return c;
}

export function imageCanvas(img, w, h, draw) {
  const [c, x] = canvas(w, h);
  if (img) x.drawImage(img, 0, 0, w, h);
  if (draw) draw(x, w, h);
  return c;
}

export const scoreboard = () =>
  once('score', () => {
    const [c, x] = canvas(512, 256);
    x.fillStyle = '#050805';
    x.fillRect(0, 0, 512, 256);
    x.font = 'bold 30px VT323, monospace';
    x.textBaseline = 'middle';
    const rows = [
      ['GEFEN', '147', '6:66'],
      ['P2', '000', '0:13'],
      ['P3', '013', '6:00'],
      ['???', '666', '0:00'],
    ];
    rows.forEach((r, i) => {
      x.fillStyle = i === 0 ? '#ff2a2a' : '#3cff6a';
      x.fillText(r[0], 24, 40 + i * 56);
      x.fillStyle = '#ffd23c';
      x.fillText(r[1], 250, 40 + i * 56);
      x.fillStyle = '#3cff6a';
      x.fillText(r[2], 390, 40 + i * 56);
    });
    x.strokeStyle = '#1e3a22';
    x.lineWidth = 3;
    x.strokeRect(6, 6, 500, 244);
    return c;
  });

export function bloodDecal(seedOffset = 0, drips = true) {
  return once('blood' + seedOffset + drips, () => {
    const [c, x] = canvas(256, 256);
    x.fillStyle = 'rgba(70,0,4,0.92)';
    x.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.25) {
      const r = R(40, 80) * (rnd() < 0.15 ? 1.4 : 1);
      x.lineTo(128 + Math.cos(a) * r, 110 + Math.sin(a) * r * 0.8);
    }
    x.fill();
    for (let i = 0; i < 30; i++) {
      const a = R(0, Math.PI * 2);
      const d = R(70, 120);
      x.beginPath();
      x.arc(128 + Math.cos(a) * d, 110 + Math.sin(a) * d * 0.8, R(1, 6), 0, Math.PI * 2);
      x.fill();
    }
    if (drips)
      for (let i = 0; i < 5; i++) {
        const dx = R(80, 176);
        x.fillRect(dx, 110, R(3, 8), R(40, 140));
      }
    return c;
  });
}

export function writing(text, color = 'rgba(120,0,6,0.92)', font = '400 110px "Rubik Wet Paint"') {
  return textTexture([text], { w: 1024, h: 256, bg: null, color, font });
}

export function newspaper() {
  return once('news', () => {
    const [c, x] = canvas(512, 680);
    x.fillStyle = '#d8d0b8';
    x.fillRect(0, 0, 512, 680);
    grime(x, 512, 680, 20, '90,70,20', 0.3);
    x.direction = 'rtl';
    x.textAlign = 'right';
    x.fillStyle = '#111';
    x.font = '900 34px Heebo';
    x.fillText('חדשות השכונה', 490, 50);
    x.fillRect(20, 70, 472, 4);
    x.font = '900 46px Heebo';
    x.fillText('אלוף הסנוקר המקומי', 490, 130);
    x.fillText('"לא יוצא מהמועדון"', 490, 185);
    x.font = '400 22px Heebo';
    const body = [
      'עובדי המועדון מדווחים על קולות',
      'צחוק בשעות הלילה, אורות מהבהבים',
      'וכדורי סנוקר שזזים מעצמם.',
      '"גפן תמיד היה תותח," אמר חבר,',
      '"אבל מאז הכדור השחור... הוא אחר."',
      'המשטרה ממליצה לא להיכנס',
      'למועדון אחרי חצות.',
    ];
    body.forEach((l, i) => x.fillText(l, 490, 240 + i * 34));
    x.fillStyle = '#222';
    x.fillRect(30, 500, 200, 150);
    x.fillStyle = '#d8d0b8';
    x.beginPath();
    x.arc(130, 575, 40, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#111';
    x.beginPath();
    x.arc(130, 575, 34, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#d8d0b8';
    x.font = '900 30px Heebo';
    x.textAlign = 'center';
    x.fillText('8', 130, 586);
    return c;
  });
}

export function noiseCanvas(w = 128, h = 96) {
  const [c, x] = canvas(w, h);
  const id = x.createImageData(w, h);
  const draw = (tint = [180, 255, 200], lines = true) => {
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255;
      d[i] = (v * tint[0]) / 255;
      d[i + 1] = (v * tint[1]) / 255;
      d[i + 2] = (v * tint[2]) / 255;
      d[i + 3] = 255;
    }
    x.putImageData(id, 0, 0);
    if (lines) {
      x.fillStyle = 'rgba(0,0,0,0.35)';
      for (let y = 0; y < h; y += 3) x.fillRect(0, y, w, 1);
    }
  };
  draw();
  return { canvas: c, ctx: x, draw };
}

export function radialGlow(color = '255,220,160') {
  return once('glow' + color, () => {
    const [c, x] = canvas(128, 128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, `rgba(${color},1)`);
    g.addColorStop(0.3, `rgba(${color},0.35)`);
    g.addColorStop(1, `rgba(${color},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return c;
  });
}

export function shadowBlob() {
  return once('shadowblob', () => {
    const [c, x] = canvas(128, 128);
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return c;
  });
}
