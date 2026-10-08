// Procedural canvas textures, modelled on what's in the commune videos:
// glossy beige floor tiles, the DIMONA DEMONS mural, the OSB board with
// "קומונה דימונה", the yellow bus timetable, Israeli flags in the boys' room, etc.
import * as THREE from 'three';
import { mulberry32 } from './util.js';

const cache = new Map();
let maxAniso = 4;
export function setMaxAnisotropy(a) { maxAniso = a; }

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function toTexture(canvas, { repeat = 1, srgb = true, wrap = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  const r = Array.isArray(repeat) ? repeat : [repeat, repeat];
  t.repeat.set(1 / r[0], 1 / r[1]); // UVs are in metres: repeat = metres per tile
  t.anisotropy = maxAniso;
  t.needsUpdate = true;
  return t;
}

function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function noise(ctx, w, h, amount, seed = 1, size = 1) {
  const rnd = mulberry32(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y += size) {
    for (let x = 0; x < w; x += size) {
      const n = (rnd() - 0.5) * amount;
      for (let yy = 0; yy < size && y + yy < h; yy++) {
        for (let xx = 0; xx < size && x + xx < w; xx++) {
          const i = ((y + yy) * w + (x + xx)) * 4;
          d[i] += n; d[i + 1] += n; d[i + 2] += n;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx, w, h, count, color, rMin, rMax, alpha, seed) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const x = rnd() * w, y = rnd() * h, r = rMin + rnd() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', String(alpha * (0.4 + rnd() * 0.6))));
    g.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// ---------- surfaces ----------

export const floorTile = () => cached('floorTile', () => {
  // 2x2 tiles of 60cm -> texture covers 1.2m
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#d9cfbf'; x.fillRect(0, 0, S, S);
  blotches(x, S, S, 60, 'rgba(160,140,115,A)', 10, 60, 0.18, 3);
  blotches(x, S, S, 40, 'rgba(255,250,240,A)', 10, 50, 0.15, 4);
  noise(x, S, S, 14, 5);
  x.strokeStyle = '#9b9183'; x.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    x.beginPath(); x.moveTo(i * S / 2, 0); x.lineTo(i * S / 2, S); x.stroke();
    x.beginPath(); x.moveTo(0, i * S / 2); x.lineTo(S, i * S / 2); x.stroke();
  }
  const bump = makeCanvas(256, 256), b = bump.getContext('2d');
  b.fillStyle = '#fff'; b.fillRect(0, 0, 256, 256);
  b.strokeStyle = '#000'; b.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    b.beginPath(); b.moveTo(i * 128, 0); b.lineTo(i * 128, 256); b.stroke();
    b.beginPath(); b.moveTo(0, i * 128); b.lineTo(256, i * 128); b.stroke();
  }
  return { map: toTexture(c, { repeat: 1.2 }), bump: toTexture(bump, { repeat: 1.2, srgb: false }) };
});

export const wallPaint = (tint = '#e6e2da', seed = 7) => cached('wall' + tint + seed, () => {
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = tint; x.fillRect(0, 0, S, S);
  blotches(x, S, S, 30, 'rgba(120,110,95,A)', 30, 120, 0.06, seed);
  blotches(x, S, S, 12, 'rgba(70,60,50,A)', 4, 16, 0.12, seed + 1);
  noise(x, S, S, 8, seed + 2);
  return toTexture(c, { repeat: 2.0 });
});

export const ceilingTex = () => cached('ceil', () => {
  const S = 256, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#d8d5ce'; x.fillRect(0, 0, S, S);
  blotches(x, S, S, 10, 'rgba(90,80,60,A)', 20, 80, 0.08, 11);
  noise(x, S, S, 6, 12);
  return toTexture(c, { repeat: 2.5 });
});

export const bathWallTile = () => cached('bathWall', () => {
  // light grey/white tiles with the soft diamond pattern seen in the bathroom video
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#e9e9ea'; x.fillRect(0, 0, S, S);
  const tw = 128, th = 85;
  for (let ty = 0; ty < S; ty += th) {
    for (let tx = 0; tx < S; tx += tw) {
      x.fillStyle = 'rgba(160,165,175,0.18)';
      x.beginPath();
      x.moveTo(tx + tw / 2, ty + 12); x.lineTo(tx + tw - 18, ty + th / 2);
      x.lineTo(tx + tw / 2, ty + th - 12); x.lineTo(tx + 18, ty + th / 2); x.closePath(); x.fill();
      x.strokeStyle = '#b9bcc2'; x.lineWidth = 2; x.strokeRect(tx, ty, tw, th);
    }
  }
  noise(x, S, S, 6, 21);
  return toTexture(c, { repeat: 1.0 });
});

export const marbleFloor = () => cached('marble', () => {
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#b8b9bb'; x.fillRect(0, 0, S, S);
  const rnd = mulberry32(33);
  for (let i = 0; i < 40; i++) {
    x.strokeStyle = `rgba(${rnd() > 0.5 ? '250,250,250' : '90,92,96'},${0.1 + rnd() * 0.25})`;
    x.lineWidth = 1 + rnd() * 3;
    x.beginPath();
    let px = rnd() * S, py = rnd() * S; x.moveTo(px, py);
    for (let k = 0; k < 6; k++) { px += (rnd() - 0.5) * 140; py += (rnd() - 0.3) * 90; x.lineTo(px, py); }
    x.stroke();
  }
  noise(x, S, S, 10, 34);
  x.strokeStyle = '#8f9196'; x.lineWidth = 3; x.strokeRect(0, 0, S, S);
  return toTexture(c, { repeat: 0.8 });
});

export const terraceTile = () => cached('terrace', () => {
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#c9bca6'; x.fillRect(0, 0, S, S);
  blotches(x, S, S, 80, 'rgba(90,75,55,A)', 8, 70, 0.22, 41);
  noise(x, S, S, 22, 42, 2);
  x.strokeStyle = '#8c7f6b'; x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    x.beginPath(); x.moveTo(i * S / 4, 0); x.lineTo(i * S / 4, S); x.stroke();
    x.beginPath(); x.moveTo(0, i * S / 4); x.lineTo(S, i * S / 4); x.stroke();
  }
  return toTexture(c, { repeat: 1.6 });
});

export const concreteTex = () => cached('concrete', () => {
  const S = 256, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#9d968a'; x.fillRect(0, 0, S, S);
  blotches(x, S, S, 40, 'rgba(60,50,40,A)', 6, 40, 0.25, 51);
  noise(x, S, S, 26, 52, 2);
  return toTexture(c, { repeat: 1.5 });
});

export const woodTex = (base = '#3a2a22', line = '#24180f', seed = 61, size = 1.0) => cached('wood' + base + seed, () => {
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, S, S);
  const rnd = mulberry32(seed);
  for (let i = 0; i < 90; i++) {
    x.strokeStyle = line; x.globalAlpha = 0.08 + rnd() * 0.18; x.lineWidth = 1 + rnd() * 3;
    const y0 = rnd() * S;
    x.beginPath(); x.moveTo(0, y0);
    for (let px = 0; px <= S; px += 32) x.lineTo(px, y0 + Math.sin(px * 0.01 + i) * 6 + (rnd() - 0.5) * 3);
    x.stroke();
  }
  x.globalAlpha = 1;
  noise(x, S, S, 10, seed + 1);
  return toTexture(c, { repeat: size });
});

export const osbTex = () => cached('osb', () => {
  const S = 512, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#c99a5b'; x.fillRect(0, 0, S, S);
  const rnd = mulberry32(71);
  const cols = ['#b07d3e', '#d8ad6a', '#a06a2c', '#e2bd80', '#8e5d28', '#c48d4a'];
  for (let i = 0; i < 1400; i++) {
    x.fillStyle = cols[Math.floor(rnd() * cols.length)];
    x.globalAlpha = 0.6 + rnd() * 0.4;
    x.save(); x.translate(rnd() * S, rnd() * S); x.rotate(rnd() * Math.PI);
    x.fillRect(-14 - rnd() * 18, -4 - rnd() * 4, 28 + rnd() * 36, 8 + rnd() * 8); x.restore();
  }
  x.globalAlpha = 1; noise(x, S, S, 12, 72);
  return toTexture(c, { repeat: 1.0 });
});

export const metalDoorTex = () => cached('metalDoor', () => {
  // the beaten grey entrance door with peeling paint (video 3)
  const W = 256, H = 512, c = makeCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#7e8287'; x.fillRect(0, 0, W, H);
  blotches(x, W, H, 50, 'rgba(40,40,45,A)', 6, 50, 0.25, 81);
  const rnd = mulberry32(82);
  for (let i = 0; i < 26; i++) { // peeling patches
    x.fillStyle = rnd() > 0.5 ? '#9a6a3f' : '#b9b3a6';
    x.beginPath();
    const px = rnd() * W, py = rnd() * H;
    x.moveTo(px, py);
    for (let k = 0; k < 7; k++) x.lineTo(px + (rnd() - 0.5) * 50, py + (rnd() - 0.5) * 60);
    x.fill();
  }
  for (let i = 0; i < 120; i++) { // scratches
    x.strokeStyle = `rgba(${rnd() > 0.5 ? '220,220,220' : '30,30,30'},${0.15 + rnd() * 0.3})`;
    x.lineWidth = 1; x.beginPath();
    const px = rnd() * W, py = rnd() * H; x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 30, py + rnd() * 40); x.stroke();
  }
  noise(x, W, H, 20, 83);
  // wheelchair sign
  x.fillStyle = '#1d4fa8'; x.fillRect(W / 2 - 28, 60, 56, 56);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 5;
  x.beginPath(); x.arc(W / 2 - 4, 70, 5, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.moveTo(W / 2 - 4, 78); x.lineTo(W / 2 - 4, 96); x.lineTo(W / 2 + 12, 96); x.lineTo(W / 2 + 16, 108); x.stroke();
  x.beginPath(); x.arc(W / 2 - 6, 100, 11, 0.3, Math.PI * 1.6); x.stroke();
  return toTexture(c, { wrap: false });
});

export const whiteDoorTex = (seed = 91) => cached('whiteDoor' + seed, () => {
  const W = 256, H = 512, c = makeCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#ece9e3'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(0,0,0,0.08)'; x.lineWidth = 4;
  x.strokeRect(24, 30, W - 48, H / 2 - 50); x.strokeRect(24, H / 2 + 10, W - 48, H / 2 - 50);
  blotches(x, W, H, 14, 'rgba(90,80,60,A)', 8, 40, 0.1, seed);
  noise(x, W, H, 8, seed + 1);
  return toTexture(c, { wrap: false });
});

// ---------- murals & signs ----------

export const muralTex = () => cached('mural', () => {
  // "DIMONA DEMONS" in fire-gradient letters with the horned devil, as on the dining wall
  const W = 2048, H = 512, c = makeCanvas(W, H), x = c.getContext('2d');
  x.clearRect(0, 0, W, H);
  x.font = '900 230px Impact, "Arial Black", sans-serif';
  x.textBaseline = 'middle';
  const text = 'DIMONA DEMONS';
  const tw = x.measureText(text).width;
  const sx = (W - tw) / 2 + 60;
  const g = x.createLinearGradient(0, 140, 0, 380);
  g.addColorStop(0, '#2a1a12'); g.addColorStop(0.25, '#f5c400'); g.addColorStop(0.55, '#f07c00');
  g.addColorStop(0.8, '#d4141a'); g.addColorStop(1, '#5a0505');
  x.lineJoin = 'round';
  x.lineWidth = 22; x.strokeStyle = '#111'; x.strokeText(text, sx, 270);
  x.fillStyle = g; x.fillText(text, sx, 270);
  // flame licks on top of the letters
  const rnd = mulberry32(101);
  x.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 160; i++) {
    const fx = sx + rnd() * tw, fy = 170 + rnd() * 40;
    x.fillStyle = rnd() > 0.5 ? 'rgba(20,10,5,0.85)' : 'rgba(255,220,40,0.7)';
    x.beginPath(); x.moveTo(fx - 8, fy + 20); x.quadraticCurveTo(fx, fy - 30 - rnd() * 30, fx + 8, fy + 20); x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  // devil horn + head on the left (like the big pink horn in the photo)
  x.save(); x.translate(sx - 110, 250);
  x.fillStyle = '#e88a9a'; x.strokeStyle = '#111'; x.lineWidth = 10;
  x.beginPath(); x.moveTo(-40, 40); x.quadraticCurveTo(-90, -120, 10, -200); x.quadraticCurveTo(-10, -90, 40, 30); x.closePath(); x.fill(); x.stroke();
  x.restore();
  return toTexture(c, { wrap: false });
});

// Red glowing eyes painted into the mural (only visible on night 4)
export const muralEyesTex = () => cached('muralEyes', () => {
  const W = 256, H = 128, c = makeCanvas(W, H), x = c.getContext('2d');
  for (const ex of [80, 176]) {
    const g = x.createRadialGradient(ex, 64, 0, ex, 64, 50);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.15, 'rgba(255,40,20,1)'); g.addColorStop(1, 'rgba(255,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  return toTexture(c, { wrap: false });
});

export const communeLettersTex = () => cached('communeLetters', () => {
  const W = 1024, H = 512, c = makeCanvas(W, H), x = c.getContext('2d');
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const cols = ['#7b3fa0', '#e5332a', '#f2c300', '#2f9e44', '#1f6fd1', '#ef7d1a', '#d6336c'];
  const draw = (word, y) => {
    x.font = '900 170px "Secular One", "Rubik", "Arial Black", sans-serif';
    const chars = [...word];
    const total = x.measureText(word).width;
    let px = W / 2 + total / 2;
    chars.forEach((ch, i) => {
      const w = x.measureText(ch).width;
      x.save(); x.translate(px - w / 2, y); x.rotate((i % 2 ? 1 : -1) * 0.06);
      x.lineWidth = 10; x.strokeStyle = 'rgba(0,0,0,0.35)'; x.strokeText(ch, 0, 4);
      x.fillStyle = cols[i % cols.length]; x.fillText(ch, 0, 0);
      x.restore(); px -= w;
    });
  };
  draw('קומונה', 140); draw('דימונה', 360);
  return toTexture(c, { wrap: false });
});

export const busScheduleTex = () => cached('bus', () => {
  // Yellow timetable on the cork/OSB board (night 3 code clue: line to Dimona = 55)
  const W = 512, H = 640, c = makeCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#f3e33b'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, 90);
  x.fillStyle = '#111'; x.font = '700 40px "Heebo", "Rubik", Arial, sans-serif';
  x.direction = 'rtl'; x.textAlign = 'right'; x.textBaseline = 'middle';
  x.fillText('תחנה מרכזית באר שבע', W - 24, 46);
  const rows = [['אצטדיון', '7'], ['בית עלמין', '7'], ['דימונה', '55'], ['מצפה רמון', '60'], ['ירוחם', '150']];
  rows.forEach(([dest, line], i) => {
    const y = 140 + i * 102;
    x.strokeStyle = '#2b2b2b'; x.lineWidth = 3; x.strokeRect(14, y - 46, W - 28, 92);
    x.fillStyle = '#111'; x.textAlign = 'right'; x.font = '700 46px "Heebo", "Rubik", Arial, sans-serif';
    x.fillText(dest, W - 30, y);
    x.textAlign = 'left'; x.font = '900 62px "Heebo", "Rubik", Arial, sans-serif';
    x.fillText(line, 40, y + 2);
    x.fillStyle = '#2f9e44'; x.fillRect(W - 210, y - 34, 0, 0);
  });
  x.fillStyle = '#2f9e44'; x.font = '900 60px Arial'; x.textAlign = 'left'; x.fillText('✕', 20, 46);
  noise(x, W, H, 10, 111);
  return toTexture(c, { wrap: false });
});

export const israelFlagTex = () => cached('flag', () => {
  const W = 512, H = 768, c = makeCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#1b3fa6';
  // flags hang sideways on the bunk beds: stripes run vertically
  x.fillRect(50, 0, 60, H); x.fillRect(W - 110, 0, 60, H);
  x.strokeStyle = '#1b3fa6'; x.lineWidth = 18; x.lineJoin = 'miter';
  const cx = W / 2, cy = H / 2, r = 110;
  for (const rot of [0, Math.PI]) {
    x.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = rot - Math.PI / 2 + k * (Math.PI * 2 / 3);
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      k ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath(); x.stroke();
  }
  blotches(x, W, H, 20, 'rgba(80,80,70,A)', 20, 80, 0.12, 121);
  return toTexture(c, { wrap: false });
});

export const graffitiTex = (text = 'בנים', color = '#55e04a') => cached('graf' + text + color, () => {
  const W = 512, H = 256, c = makeCanvas(W, H), x = c.getContext('2d');
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 140px "Secular One", "Rubik", "Arial Black", sans-serif';
  x.shadowColor = color; x.shadowBlur = 18;
  x.lineWidth = 16; x.strokeStyle = color; x.strokeText(text, W / 2, H / 2);
  x.shadowBlur = 0; x.fillStyle = '#1a3d14'; x.fillText(text, W / 2, H / 2);
  const rnd = mulberry32(131);
  x.fillStyle = color;
  for (let i = 0; i < 300; i++) { x.globalAlpha = rnd() * 0.6; x.fillRect(W / 2 + (rnd() - 0.5) * 420, H / 2 + (rnd() - 0.5) * 200, 2, 2); }
  for (let i = 0; i < 6; i++) { x.globalAlpha = 0.8; x.fillRect(120 + rnd() * 280, 170, 4, 30 + rnd() * 60); }
  x.globalAlpha = 1;
  return toTexture(c, { wrap: false });
});

export const signTex = (lines, { w = 512, h = 256, bg = 'rgba(0,0,0,0)', color = '#f2c300', font = '"Secular One", "Rubik", sans-serif', size = 90 } = {}) =>
  cached('sign' + lines.join('|') + bg + color + size, () => {
    const c = makeCanvas(w, h), x = c.getContext('2d');
    if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
    x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `900 ${size}px ${font}`; x.fillStyle = color;
    lines.forEach((l, i) => x.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.1));
    return toTexture(c, { wrap: false });
  });

export const paperTex = (lines, { w = 256, h = 320, color = '#f1ead8', ink = '#1d2a6b', size = 26, seed = 141 } = {}) =>
  cached('paper' + lines.join('|') + color + seed, () => {
    const c = makeCanvas(w, h), x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    blotches(x, w, h, 6, 'rgba(120,90,40,A)', 10, 50, 0.15, seed);
    x.strokeStyle = 'rgba(80,120,200,0.25)'; x.lineWidth = 1;
    for (let y = 40; y < h; y += 28) { x.beginPath(); x.moveTo(8, y); x.lineTo(w - 8, y); x.stroke(); }
    x.direction = 'rtl'; x.textAlign = 'right'; x.fillStyle = ink;
    x.font = `700 ${size}px "Amatic SC", "Heebo", cursive`;
    lines.forEach((l, i) => x.fillText(l, w - 16, 34 + i * 28));
    return toTexture(c, { wrap: false });
  });

export const fridgeTex = () => cached('fridge', () => {
  const W = 256, H = 512, c = makeCanvas(W, H), x = c.getContext('2d');
  x.fillStyle = '#eceeef'; x.fillRect(0, 0, W, H);
  const rnd = mulberry32(151);
  const cols = ['#f7d7d7', '#fff3a8', '#cfe8ff', '#d9f2d0', '#ffffff', '#ffd9a8'];
  for (let i = 0; i < 16; i++) {
    x.save(); x.translate(30 + rnd() * (W - 60), 40 + rnd() * (H * 0.65)); x.rotate((rnd() - 0.5) * 0.4);
    x.fillStyle = cols[i % cols.length]; x.fillRect(-22, -28, 44 + rnd() * 20, 56);
    x.fillStyle = 'rgba(40,40,80,0.5)';
    for (let k = 0; k < 4; k++) x.fillRect(-16, -18 + k * 10, 30 + rnd() * 14, 2);
    x.fillStyle = ['#e03131', '#1971c2', '#2f9e44', '#f08c00'][i % 4];
    x.beginPath(); x.arc(0, -28, 5, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  x.fillStyle = '#9aa0a6'; x.fillRect(W - 26, H * 0.08, 8, H * 0.25); x.fillRect(W - 26, H * 0.45, 8, H * 0.2);
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, H * 0.38, W, 3);
  return toTexture(c, { wrap: false });
});

export const minionsTex = () => cached('minions', () => {
  // paper cut-out yellow figures taped to the kitchen door frame
  const W = 128, H = 512, c = makeCanvas(W, H), x = c.getContext('2d');
  for (let i = 0; i < 3; i++) {
    const cy = 90 + i * 160;
    x.fillStyle = '#f5d000'; x.strokeStyle = '#111'; x.lineWidth = 3;
    x.beginPath(); x.ellipse(64, cy, 38, 62, 0, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#2459b8'; x.fillRect(28, cy + 18, 72, 40);
    x.fillStyle = '#888'; x.fillRect(26, cy - 26, 76, 10);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(64, cy - 21, 17, 0, Math.PI * 2); x.fill(); x.stroke();
    x.fillStyle = '#5a3b1c'; x.beginPath(); x.arc(64, cy - 21, 7, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#111'; x.beginPath(); x.arc(64, cy - 21, 3, 0, Math.PI * 2); x.fill();
  }
  return toTexture(c, { wrap: false });
});

// ---------- screens ----------

export function makeTVScreen() {
  const W = 512, H = 288, c = makeCanvas(W, H), x = c.getContext('2d');
  const tex = toTexture(c, { wrap: false });
  const players = [];
  const rnd = mulberry32(161);
  for (let i = 0; i < 18; i++) players.push({ x: rnd() * W, y: 40 + rnd() * (H - 60), vx: 0, vy: 0, team: i % 2 });
  let ball = { x: W / 2, y: H / 2 };
  let mode = 'off', t = 0, acc = 0, faceImg = null;
  function drawPitch() {
    for (let i = 0; i < 10; i++) { x.fillStyle = i % 2 ? '#3d9b3a' : '#45a843'; x.fillRect(i * W / 10, 0, W / 10, H); }
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 2;
    x.strokeRect(16, 30, W - 32, H - 46);
    x.beginPath(); x.moveTo(W / 2, 30); x.lineTo(W / 2, H - 16); x.stroke();
    x.beginPath(); x.arc(W / 2, (H + 14) / 2, 36, 0, Math.PI * 2); x.stroke();
    x.strokeRect(16, H / 2 - 50, 50, 100); x.strokeRect(W - 66, H / 2 - 50, 50, 100);
  }
  function hud(text) {
    x.fillStyle = 'rgba(10,10,30,0.85)'; x.fillRect(10, 6, 190, 22);
    x.fillStyle = '#fff'; x.font = '700 14px Arial'; x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText(text, 18, 17);
  }
  return {
    texture: tex,
    get mode() { return mode; },
    setFace(img) { faceImg = img; },
    setMode(m) { mode = m; acc = 1; this.update(0); },
    update(dt) {
      t += dt; acc += dt;
      if (acc < 1 / 15) return;
      acc = 0;
      if (mode === 'off') { x.fillStyle = '#050505'; x.fillRect(0, 0, W, H); }
      else if (mode === 'face') {
        // static with Noam's face bleeding through
        const img = x.createImageData(W / 4, H / 4);
        for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 200; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
        const tmp = makeCanvas(W / 4, H / 4); tmp.getContext('2d').putImageData(img, 0, 0);
        x.imageSmoothingEnabled = false; x.drawImage(tmp, 0, 0, W, H); x.imageSmoothingEnabled = true;
        if (faceImg && Math.random() < 0.8) {
          x.globalAlpha = 0.5 + Math.random() * 0.4; x.filter = 'grayscale(1) contrast(2.2) brightness(0.8)';
          const fw = H * 0.75 * 1.1, ox = (W - fw) / 2 + (Math.random() - 0.5) * 20;
          x.drawImage(faceImg, ox, -H * 0.05, fw, H * 1.1);
          x.filter = 'none'; x.globalAlpha = 1;
          for (let k = 0; k < 4; k++) { const sy = Math.random() * H; x.drawImage(c, 0, sy, W, 8, (Math.random() - 0.5) * 40, sy, W, 8); }
        }
      }
      else if (mode === 'static') {
        const img = x.createImageData(W / 4, H / 4);
        for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
        const tmp = makeCanvas(W / 4, H / 4); tmp.getContext('2d').putImageData(img, 0, 0);
        x.imageSmoothingEnabled = false; x.drawImage(tmp, 0, 0, W, H);
      } else if (mode === 'menu') {
        const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0b1a4a'); g.addColorStop(1, '#03060f');
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.fillStyle = '#e7f0ff'; x.font = '900 46px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText('FIFA', W / 2, H / 2 - 30);
        x.font = '700 18px Arial'; x.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3);
        x.fillText('PRESS ANY BUTTON', W / 2, H / 2 + 40); x.globalAlpha = 1;
      } else {
        drawPitch();
        ball.x += Math.sin(t * 0.9) * 2.4; ball.y += Math.cos(t * 1.3) * 1.6;
        ball.x = Math.max(30, Math.min(W - 30, ball.x)); ball.y = Math.max(40, Math.min(H - 24, ball.y));
        for (const p of players) {
          p.vx += ((ball.x - p.x) * 0.002 + (Math.random() - 0.5) * 0.6); p.vy += ((ball.y - p.y) * 0.002 + (Math.random() - 0.5) * 0.6);
          p.vx *= 0.9; p.vy *= 0.9; p.x += p.vx; p.y += p.vy;
          x.fillStyle = p.team ? '#d4141a' : '#7cc4ff';
          x.beginPath(); x.arc(p.x, p.y, 5, 0, Math.PI * 2); x.fill();
        }
        x.fillStyle = '#fff'; x.beginPath(); x.arc(ball.x, ball.y, 3, 0, Math.PI * 2); x.fill();
        hud(mode === 'fulltime' ? 'DMN 2 - 1 BSH   FULL TIME' : `DMN 1 - 1 BSH   ${String(60 + Math.floor(t / 2) % 30).padStart(2, '0')}:${String(Math.floor(t * 7) % 60).padStart(2, '0')}`);
        if (mode === 'goal') {
          x.fillStyle = `rgba(255,220,0,${0.6 + 0.4 * Math.sin(t * 12)})`;
          x.font = '900 72px Impact, Arial'; x.textAlign = 'center'; x.fillText('GOAL!!!', W / 2, H / 2);
        }
        if (mode === 'fulltime') {
          x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, H / 2 - 40, W, 80);
          x.fillStyle = '#fff'; x.font = '900 48px Impact, Arial'; x.textAlign = 'center'; x.fillText('FULL TIME', W / 2, H / 2);
        }
      }
      tex.needsUpdate = true;
    },
  };
}

// ---------- characters ----------

export function jerseyTex(kind, side) {
  return cached('jersey' + kind + side, () => {
    const W = 256, H = 256, c = makeCanvas(W, H), x = c.getContext('2d');
    if (kind === 'noam') {
      // red/black stripes like his Bournemouth shirt, SEMENYO 24 on the back
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#111014' : '#c3161c'; x.fillRect(i * W / 8, 0, W / 8, H); }
      x.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 30; i++) x.fillRect(0, i * 9, W, 2);
      if (side === 'back') {
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.font = '900 30px Arial'; x.fillText('SEMENYO', W / 2, 46);
        x.font = '900 120px Arial'; x.fillText('24', W / 2, 140);
      } else if (side === 'front') {
        x.fillStyle = '#d8b56a'; x.font = '900 46px Arial'; x.textAlign = 'center'; x.fillText('24', W / 2, 150);
        x.fillStyle = '#fff'; x.beginPath(); x.arc(W * 0.7, 60, 14, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#c3161c'; x.beginPath(); x.arc(W * 0.7, 60, 9, 0, Math.PI * 2); x.fill();
      }
    } else if (kind === 'ori') {
      x.fillStyle = '#8ec1ec'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#1d2f6b'; x.fillRect(0, 0, 18, H); x.fillRect(W - 18, 0, 18, H);
      x.fillStyle = '#f2f2f2';
      for (const sx of [40, W - 40]) { for (let k = 0; k < 2; k++) { x.beginPath(); x.moveTo(sx - 18, 20 + k * 16); x.lineTo(sx, 32 + k * 16); x.lineTo(sx + 18, 20 + k * 16); x.lineTo(sx + 18, 26 + k * 16); x.lineTo(sx, 38 + k * 16); x.lineTo(sx - 18, 26 + k * 16); x.fill(); } }
      if (side === 'front') {
        x.fillStyle = '#1d2f6b'; x.font = '900 34px Arial'; x.textAlign = 'center'; x.fillText('COVENTRY', W / 2, 150);
        x.beginPath(); x.arc(W * 0.66, 80, 14, 0, Math.PI * 2); x.fill();
      }
    } else if (kind === 'yarin') {
      x.fillStyle = '#f6dc2a'; x.fillRect(0, 0, W, H);
      if (side === 'front') { x.fillStyle = '#244a1d'; x.beginPath(); x.arc(W * 0.66, 70, 16, 0, Math.PI * 2); x.fill(); x.fillRect(W * 0.66 - 40, 94, 80, 8); }
    } else if (kind === 'messenger') {
      x.fillStyle = '#cfcfc8'; x.fillRect(0, 0, W, H);
      // green backpack straps
      x.fillStyle = '#4f6b2a'; x.fillRect(40, 0, 34, H); x.fillRect(W - 74, 0, 34, H);
      x.fillStyle = '#111'; x.fillRect(46, 120, 22, 30); x.fillRect(W - 68, 120, 22, 30);
      if (side === 'back') { x.fillStyle = '#5a7a30'; x.fillRect(30, 20, W - 60, H - 40); }
    } else {
      x.fillStyle = '#3a3f4a'; x.fillRect(0, 0, W, H);
    }
    noise(x, W, H, 10, 171);
    return toTexture(c, { wrap: false });
  });
}

// Feather-masked face texture from a photo (data URL image)
export function faceTexture(img, { possessed = false, eyes = null } = {}) {
  const W = 256, H = 341, c = makeCanvas(W, H), x = c.getContext('2d');
  x.drawImage(img, 0, 0, W, H);
  if (possessed) {
    // darker, desaturated, veins + black eyes with red pupils
    const d = x.getImageData(0, 0, W, H);
    for (let i = 0; i < d.data.length; i += 4) {
      const l = d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11;
      d.data[i] = Math.min(255, l * 0.95 + 18); d.data[i + 1] = l * 0.62; d.data[i + 2] = l * 0.6;
    }
    x.putImageData(d, 0, 0);
    if (eyes) {
      for (const [ex, ey] of eyes) {
        const px = ex * W, py = ey * H;
        x.fillStyle = '#050000';
        x.beginPath(); x.ellipse(px, py, 15, 9, 0, 0, Math.PI * 2); x.fill();
        const g = x.createRadialGradient(px, py, 0, px, py, 8);
        g.addColorStop(0, '#fff2c0'); g.addColorStop(0.4, '#ff2a10'); g.addColorStop(1, 'rgba(120,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(px, py, 8, 0, Math.PI * 2); x.fill();
        // dark streaks under the eyes
        x.strokeStyle = 'rgba(20,0,0,0.55)'; x.lineWidth = 3;
        for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(px + k * 6, py + 8); x.lineTo(px + k * 7 + 2, py + 40 + Math.abs(k) * 6); x.stroke(); }
      }
    }
    const v = x.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.85)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);
  }
  // feathered oval mask
  x.globalCompositeOperation = 'destination-in';
  const m = makeCanvas(W, H), mx = m.getContext('2d');
  const g = mx.createRadialGradient(W / 2, H * 0.5, W * 0.3, W / 2, H * 0.5, W * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  mx.save(); mx.translate(W / 2, H * 0.5); mx.scale(1, H / W); mx.translate(-W / 2, -H * 0.5);
  mx.fillStyle = g; mx.fillRect(0, 0, W, H); mx.restore();
  x.drawImage(m, 0, 0);
  x.globalCompositeOperation = 'source-over';
  return toTexture(c, { wrap: false });
}

// ---------- sky / outdoors ----------

export const skyTex = () => cached('sky', () => {
  const W = 2048, H = 1024, c = makeCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#01020a'); g.addColorStop(0.42, '#060a1c'); g.addColorStop(0.5, '#1d1a26'); g.addColorStop(0.52, '#3a2416'); g.addColorStop(0.56, '#05040a'); g.addColorStop(1, '#020203');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rnd = mulberry32(181);
  for (let i = 0; i < 2600; i++) {
    const y = rnd() * H * 0.5;
    const a = (0.3 + rnd() * 0.7) * (1 - y / (H * 0.5)) ;
    x.fillStyle = `rgba(255,255,255,${a})`;
    const s = rnd() < 0.03 ? 2 : 1;
    x.fillRect(rnd() * W, y, s, s);
  }
  // distant Dimona lights on the horizon
  for (let i = 0; i < 900; i++) {
    const px = rnd() * W, py = H * 0.5 + 2 + rnd() * 26;
    x.fillStyle = rnd() > 0.3 ? `rgba(255,${170 + rnd() * 60},${80 + rnd() * 60},${0.5 + rnd() * 0.5})` : `rgba(220,235,255,${0.6})`;
    x.fillRect(px, py, 1 + (rnd() < 0.2 ? 1 : 0), 1);
  }
  return toTexture(c, { wrap: false });
});

export const moonTex = () => cached('moon', () => {
  const S = 256, c = makeCanvas(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.32, 'rgba(240,235,215,1)'); g.addColorStop(0.36, 'rgba(200,210,255,0.35)'); g.addColorStop(1, 'rgba(120,140,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  blotches(x, S, S, 9, 'rgba(160,150,140,A)', 6, 18, 0.4, 191);
  return toTexture(c, { wrap: false });
});

export const windowTex = () => cached('window', () => {
  // moonlit glass behind half-closed blinds
  const W = 256, H = 256, c = makeCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a3a66'); g.addColorStop(1, '#0d1430');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 14) { x.fillStyle = 'rgba(200,205,215,0.9)'; x.fillRect(0, y, W, 8); }
  x.fillStyle = '#ddd'; x.fillRect(0, 0, W, 6); x.fillRect(0, H - 6, W, 6); x.fillRect(W / 2 - 3, 0, 6, H);
  return toTexture(c, { wrap: false });
});

export const lightCookie = () => cached('cookie', () => {
  const S = 256, c = makeCanvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#fffaf0'); g.addColorStop(0.2, '#fff1d6'); g.addColorStop(0.27, '#d9ccb4');
  g.addColorStop(0.33, '#cfc3ab'); g.addColorStop(0.6, '#5d554a'); g.addColorStop(0.85, '#151311'); g.addColorStop(1, '#000');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  noise(x, S, S, 12, 201);
  return toTexture(c, { wrap: false });
});

export const glowSprite = (color = '255,60,30') => cached('glow' + color, () => {
  const S = 128, c = makeCanvas(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, `rgba(${color},1)`); g.addColorStop(0.3, `rgba(${color},0.4)`); g.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  return toTexture(c, { wrap: false });
});

export const lightShaftTex = () => cached('shaft', () => {
  const W = 64, H = 256, c = makeCanvas(W, H), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(150,170,255,0.35)'); g.addColorStop(1, 'rgba(150,170,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const h = x.createLinearGradient(0, 0, W, 0);
  h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, W, H);
  return toTexture(c, { wrap: false });
});

export const bloodTex = (text) => cached('blood' + text, () => {
  const W = 512, H = 256, c = makeCanvas(W, H), x = c.getContext('2d');
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '900 96px "Secular One", "Rubik", sans-serif';
  x.fillStyle = 'rgba(120,8,8,0.95)';
  x.fillText(text, W / 2, H / 2 - 20);
  const rnd = mulberry32(text.length * 13);
  for (let i = 0; i < 14; i++) { const px = 60 + rnd() * (W - 120); x.fillRect(px, H / 2 + 10, 3 + rnd() * 3, 30 + rnd() * 80); }
  return toTexture(c, { wrap: false });
});
