'use strict';
/* =====================================================================
   STARRY NIGHTS · art.js
   every texture is painted on a canvas at load · friends' faces → masks
   ===================================================================== */

const ART = { faceBase: {}, faceURL: {}, mask: {}, maskTex: {}, scareURL: {}, raw: {}, before: {} };
let ANISO = 4;
const FONT_D = 'Karantina, Rubik, Arial, sans-serif';
const FONT_U = 'Rubik, Arial, sans-serif';
const FONT_M = '"Share Tech Mono", ui-monospace, monospace';
const FONT_H = '"Amatic SC", Rubik, cursive';

function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function c2(c) { return c.getContext('2d'); }
function mkTex(c, clampEdges) {
  const t = new THREE.CanvasTexture(c);
  if (clampEdges) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; } else { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO; return t;
}
function grainFx(x, w, h, amt) { const d = x.getImageData(0, 0, w, h), a = d.data; for (let i = 0; i < a.length; i += 4) { const n = (Math.random() - 0.5) * amt; a[i] += n; a[i + 1] += n; a[i + 2] += n; } x.putImageData(d, 0, 0); }
function blot(x, w, h, n, rgb, r0, r1, al) { for (let i = 0; i < n; i++) { const px = Math.random() * w, py = Math.random() * h, r = rand(r0, r1); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${rgb},${al})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } }
function cracks(x, w, h, n, col) { x.strokeStyle = col; x.lineWidth = 1; for (let k = 0; k < n; k++) { x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for (let s = 0; s < 9; s++) { px += rand(-20, 20); py += rand(-20, 20); x.lineTo(px, py); } x.stroke(); } }
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt; return `rgb(${clamp(r, 0, 255)},${clamp(g, 0, 255)},${clamp(b, 0, 255)})`; }
function txt(x, s, px, py, font, color, align = 'center') { x.font = font; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle'; try { x.direction = /[֐-׿]/.test(s) ? 'rtl' : 'ltr'; } catch (e) { } x.fillText(s, px, py); }

/* ---------------- floors ---------------- */
function fConcrete() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#44474c'; x.fillRect(0, 0, 256, 256); blot(x, 256, 256, 22, '0,0,0', 18, 70, 0.22); blot(x, 256, 256, 8, '140,120,95', 12, 40, 0.1); cracks(x, 256, 256, 3, 'rgba(10,10,12,.5)'); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, 0, 256, 3); x.fillRect(0, 0, 3, 256); grainFx(x, 256, 256, 26); return c; }
function fTiles(n, a, b) { const c = cv(256, 256), x = c2(c), s = 256 / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * s, j * s, s, s); } x.strokeStyle = 'rgba(40,36,30,.85)'; x.lineWidth = 3; for (let k = 0; k <= n; k++) { x.beginPath(); x.moveTo(k * s, 0); x.lineTo(k * s, 256); x.moveTo(0, k * s); x.lineTo(256, k * s); x.stroke(); } blot(x, 256, 256, 18, '30,25,15', 14, 60, 0.28); grainFx(x, 256, 256, 18); return c; }
function fLino() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#4b5852'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 1400; i++) { x.fillStyle = pick(['#62706a', '#3a4540', '#7b857e', '#2f3733']); x.fillRect(rand(256), rand(256), rand(1, 3), rand(1, 3)); } blot(x, 256, 256, 10, '0,0,0', 20, 70, 0.2); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 256, 2); return c; }
function fMetal() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#4a4f57'; x.fillRect(0, 0, 256, 256); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) { x.save(); x.translate(i * 16 + (j % 2) * 8 + 8, j * 16 + 8); x.rotate((i + j) % 2 ? 0.78 : -0.78); x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(-5, -1.5, 10, 3); x.fillStyle = 'rgba(0,0,0,.32)'; x.fillRect(-5, 1.5, 10, 1.5); x.restore(); } blot(x, 256, 256, 14, '70,38,18', 14, 50, 0.28); grainFx(x, 256, 256, 20); return c; }
function fCarpet() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#262a38'; x.fillRect(0, 0, 256, 256); x.strokeStyle = 'rgba(255,181,71,.07)'; x.lineWidth = 2; for (let i = 0; i < 256; i += 32) { x.strokeRect(i + 5, 5, 22, 246); } grainFx(x, 256, 256, 30); blot(x, 256, 256, 12, '0,0,0', 20, 60, 0.25); return c; }
function fWood() { const c = cv(256, 256), x = c2(c), h = 32; for (let r = 0; r < 8; r++) { const off = (r % 2) * 64; for (let s = -1; s < 3; s++) { const tone = randi(0, 30); x.fillStyle = `rgb(${88 + tone},${56 + tone * 0.6 | 0},${36 + tone * 0.4 | 0})`; x.fillRect(off + s * 128, r * h, 128, h); x.strokeStyle = 'rgba(28,16,8,.7)'; x.lineWidth = 1.5; x.strokeRect(off + s * 128 + 0.5, r * h + 0.5, 128, h); } for (let g = 0; g < 5; g++) { x.strokeStyle = 'rgba(40,24,12,.25)'; x.lineWidth = 1; x.beginPath(); const yy = r * h + rand(4, h - 4); x.moveTo(0, yy); x.bezierCurveTo(80, yy + rand(-3, 3), 170, yy + rand(-3, 3), 256, yy); x.stroke(); } } grainFx(x, 256, 256, 14); return c; }

/* ---------------- walls (canvas bottom = floor) ---------------- */
function drips(x, n, col) { for (let i = 0; i < n; i++) { const px = rand(256), len = rand(30, 130), y0 = rand(0, 70); const g = x.createLinearGradient(0, y0, 0, y0 + len); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px, y0, rand(2, 5), len); } }
function wConcrete() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#7a7c78'; x.fillRect(0, 0, 256, 256); blot(x, 256, 256, 16, '0,0,0', 20, 60, 0.15); drips(x, 14, 'rgba(45,32,20,.35)'); const b = 168; x.fillStyle = '#20403d'; x.fillRect(0, b, 256, 88); x.fillStyle = '#c9a227'; x.fillRect(0, b - 5, 256, 5); blot(x, 256, 256, 8, '0,0,0', 10, 40, 0.2); grainFx(x, 256, 256, 22); return c; }
function wTile() { const c = cv(256, 256), x = c2(c), s = 32; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { x.fillStyle = j === 5 ? '#2c4f86' : (Math.random() < 0.08 ? '#cfcabd' : '#dcd7ca'); x.fillRect(i * s, j * s, s, s); } x.strokeStyle = 'rgba(70,64,55,.8)'; x.lineWidth = 2; for (let k = 0; k <= 8; k++) { x.beginPath(); x.moveTo(k * s, 0); x.lineTo(k * s, 256); x.moveTo(0, k * s); x.lineTo(256, k * s); x.stroke(); } const g = x.createLinearGradient(0, 150, 0, 256); g.addColorStop(0, 'rgba(60,45,25,0)'); g.addColorStop(1, 'rgba(60,45,25,.5)'); x.fillStyle = g; x.fillRect(0, 150, 256, 106); drips(x, 8, 'rgba(90,60,30,.3)'); grainFx(x, 256, 256, 14); return c; }
function wPaint() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#5c6a60'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#37433b'; x.fillRect(0, 176, 256, 80); x.fillStyle = '#8c8f7f'; x.fillRect(0, 172, 256, 4); blot(x, 256, 256, 14, '0,0,0', 16, 60, 0.18); drips(x, 10, 'rgba(30,25,15,.3)'); grainFx(x, 256, 256, 18); return c; }
function wBrick() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#2a1f1c'; x.fillRect(0, 0, 256, 256); const bh = 16, bw = 48; for (let r = 0; r < 16; r++) { const off = (r % 2) * 24; for (let i = -1; i < 6; i++) { const t = randi(-14, 14); x.fillStyle = `rgb(${96 + t},${44 + t / 2 | 0},${36 + t / 3 | 0})`; x.fillRect(off + i * bw + 2, r * bh + 2, bw - 4, bh - 4); } } blot(x, 256, 256, 18, '0,0,0', 20, 60, 0.3); drips(x, 6, 'rgba(0,0,0,.4)'); grainFx(x, 256, 256, 18); return c; }
function wWallpaper() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#4e1a1f'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 256; i += 32) { x.fillStyle = '#5e2228'; x.fillRect(i, 0, 16, 256); x.fillStyle = 'rgba(214,170,90,.35)'; x.fillRect(i + 15, 0, 2, 256); } for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(214,170,90,.18)'; const px = (i % 8) * 32 + 8, py = Math.floor(i / 8) * 36 + 10; x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill(); } x.fillStyle = '#3a271b'; x.fillRect(0, 180, 256, 76); x.fillStyle = '#5a3e29'; x.fillRect(0, 180, 256, 5); blot(x, 256, 256, 10, '0,0,0', 20, 60, 0.3); for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(160,150,120,.5)'; x.beginPath(); const px = rand(256), py = rand(20, 150); x.ellipse(px, py, rand(6, 14), rand(10, 22), rand(3), 0, 7); x.fill(); } grainFx(x, 256, 256, 16); return c; }
function wSteel() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#7e8a95'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) { const g = x.createLinearGradient(i * 64, 0, i * 64 + 64, 0); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(0.5, 'rgba(0,0,0,.06)'); g.addColorStop(1, 'rgba(255,255,255,.04)'); x.fillStyle = g; x.fillRect(i * 64, 0, 64, 256); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(i * 64, 0, 2, 256); for (let r = 0; r < 6; r++) { x.fillStyle = 'rgba(30,30,30,.6)'; x.beginPath(); x.arc(i * 64 + 7, 20 + r * 44, 2.4, 0, 7); x.fill(); } } blot(x, 256, 256, 22, '220,235,255', 10, 40, 0.18); grainFx(x, 256, 256, 14); return c; }
function cCeiling() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#2c2e33'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 1000; i++) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(rand(256), rand(256), 1.5, 1.5); } x.strokeStyle = '#17181b'; x.lineWidth = 4; for (let k = 0; k <= 256; k += 128) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, 256); x.moveTo(0, k); x.lineTo(256, k); x.stroke(); } blot(x, 256, 256, 6, '70,50,20', 20, 50, 0.3); return c; }

/* ---------------- props ---------------- */
function tCrate() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#7b5a35'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? '#86633b' : '#714f2d'; x.fillRect(0, i * 43, 256, 41); } x.fillStyle = '#4c341c'; x.fillRect(0, 0, 256, 18); x.fillRect(0, 238, 256, 18); x.fillRect(0, 0, 18, 256); x.fillRect(238, 0, 18, 256); x.save(); x.translate(128, 128); x.rotate(-0.78); x.fillRect(-170, -9, 340, 18); x.restore(); txt(x, 'VANDIA GOGH', 128, 92, `700 34px ${FONT_D}`, 'rgba(25,15,8,.75)'); txt(x, 'שביר · FRAGILE', 128, 176, `700 22px ${FONT_U}`, 'rgba(25,15,8,.65)'); grainFx(x, 256, 256, 20); return c; }
function tLocker(n) { const c = cv(128, 256), x = c2(c); x.fillStyle = '#41566a'; x.fillRect(0, 0, 128, 256); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, 4, 256); x.fillRect(124, 0, 4, 256); for (let i = 0; i < 6; i++) { x.fillStyle = '#18222c'; x.fillRect(34, 22 + i * 9, 60, 4); x.fillRect(34, 200 + (i % 3) * 9, 60, 4); } x.fillStyle = '#c8c2b4'; x.fillRect(46, 92, 36, 18); txt(x, String(n), 64, 101, `700 14px ${FONT_M}`, '#222'); x.fillStyle = '#b9b4a6'; x.fillRect(98, 120, 6, 26); blot(x, 128, 256, 8, '0,0,0', 10, 30, 0.3); grainFx(x, 128, 256, 16); return c; }
function tDoor() { const c = cv(256, 256), x = c2(c); x.fillStyle = '#596068'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, i * 64, 256, 3); } for (let i = -4; i < 12; i++) { x.fillStyle = i % 2 ? '#f0c419' : '#141414'; x.beginPath(); x.moveTo(i * 32, 256); x.lineTo(i * 32 + 32, 256); x.lineTo(i * 32 + 64, 214); x.lineTo(i * 32 + 32, 214); x.fill(); } txt(x, 'אבטחה', 128, 90, `900 46px ${FONT_U}`, 'rgba(240,235,220,.7)'); blot(x, 256, 256, 10, '0,0,0', 10, 40, 0.25); grainFx(x, 256, 256, 16); return c; }
function tGate() { const c = cv(512, 256), x = c2(c); x.fillStyle = '#6d7277'; x.fillRect(0, 0, 512, 256); for (let i = 0; i < 16; i++) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, i * 16, 512, 3); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(0, i * 16 + 3, 512, 2); } for (let i = -4; i < 24; i++) { x.fillStyle = i % 2 ? '#f0c419' : '#111'; x.beginPath(); x.moveTo(i * 28, 256); x.lineTo(i * 28 + 28, 256); x.lineTo(i * 28 + 52, 226); x.lineTo(i * 28 + 24, 226); x.fill(); } txt(x, 'יציאה לרציף · LOADING DOCK', 256, 110, `700 30px ${FONT_U}`, 'rgba(20,20,20,.55)'); blot(x, 512, 256, 14, '60,35,15', 20, 60, 0.3); grainFx(x, 512, 256, 16); return c; }
function tScreen(kind) { const c = cv(256, 192), x = c2(c); x.fillStyle = '#04140b'; x.fillRect(0, 0, 256, 192); for (let i = 0; i < 192; i += 3) { x.fillStyle = 'rgba(80,255,160,.06)'; x.fillRect(0, i, 256, 1); } if (kind === 'cam') { txt(x, 'CAM 01', 40, 18, `16px ${FONT_M}`, '#7dffb0', 'left'); x.strokeStyle = 'rgba(125,255,176,.6)'; x.strokeRect(30, 40, 196, 120); txt(x, '● REC', 216, 18, `16px ${FONT_M}`, '#ff5050', 'right'); } else { txt(x, 'VANDIA', 128, 82, `700 46px ${FONT_D}`, '#f4d54b'); txt(x, 'GOGH · INTRANET', 128, 124, `14px ${FONT_M}`, '#7dffb0'); } return c; }
function tLabel() { const c = cv(512, 64), x = c2(c); x.fillStyle = '#16307a'; x.fillRect(0, 0, 512, 64); for (let i = 0; i < 4; i++) { x.fillStyle = '#e0182f'; x.fillRect(i * 128, 0, 6, 64); txt(x, 'VANDIA GOGH', i * 128 + 66, 34, `700 26px ${FONT_D}`, '#f4d54b'); } grainFx(x, 512, 64, 10); return c; }
function tBall() { const c = cv(128, 64), x = c2(c); x.fillStyle = '#f2efe6'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#16224a'; for (let i = 0; i < 8; i++) { x.beginPath(); const px = (i % 4) * 32 + 16 + (Math.floor(i / 4) * 16), py = Math.floor(i / 4) * 32 + 16; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - 1.57; x.lineTo(px + Math.cos(a) * 8, py + Math.sin(a) * 8); } x.fill(); } return c; }
function tStripes() { const c = cv(64, 64), x = c2(c); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#f3c613' : '#e0182f'; x.fillRect(0, i * 8, 64, 8); } return c; }
function tPaper(title) { const c = cv(128, 160), x = c2(c); x.fillStyle = '#efe6cf'; x.fillRect(0, 0, 128, 160); x.strokeStyle = 'rgba(60,90,160,.35)'; for (let i = 24; i < 160; i += 12) { x.beginPath(); x.moveTo(6, i); x.lineTo(122, i); x.stroke(); } x.strokeStyle = 'rgba(20,20,40,.75)'; x.lineWidth = 2; for (let i = 0; i < 7; i++) { x.beginPath(); let px = 112, py = 34 + i * 14; x.moveTo(px, py); for (let k = 0; k < 9; k++) { px -= rand(6, 13); x.lineTo(px, py + rand(-3, 3)); } x.stroke(); } if (title) txt(x, title, 64, 14, `700 15px ${FONT_U}`, '#7a1020'); return c; }
function tGlow() { const c = cv(64, 64), x = c2(c); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; }
function tBlob(rgb) { const c = cv(128, 128), x = c2(c); for (let i = 0; i < 9; i++) { const px = 64 + rand(-26, 26), py = 64 + rand(-26, 26), r = rand(14, 34); const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(${rgb},.92)`); g.addColorStop(0.75, `rgba(${rgb},.85)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); } return c; }
function tShadow() { const c = cv(64, 64), x = c2(c); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return c; }

/* signage */
function signTex(he, en, o = {}) {
  const c = cv(512, 128), x = c2(c);
  x.fillStyle = o.bg || '#13213a'; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = o.border || 'rgba(239,232,214,.85)'; x.lineWidth = 6; x.strokeRect(9, 9, 494, 110);
  txt(x, he, 256, en ? 50 : 66, `700 ${en ? 52 : 60}px ${FONT_U}`, o.fg || '#f1ead6');
  if (en) { x.globalAlpha = 0.7; txt(x, en, 256, 98, `24px ${FONT_M}`, o.fg || '#f1ead6'); x.globalAlpha = 1; }
  grainFx(x, 512, 128, 10); return mkTex(c, true);
}

/* posters: the sponsor everywhere */
function swirlBG(x, w, h) {
  x.fillStyle = '#0c1d58'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) {
    let px = rand(w), py = rand(h); x.strokeStyle = pick(['#1c3f94', '#2f5fd0', '#5b8be0', '#9cc3ff', '#16307a', '#e8d77a']);
    x.lineWidth = rand(2, 4.5); x.globalAlpha = rand(0.35, 0.85); x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 7; s++) { const a = Math.sin(px * 0.02 + py * 0.013) * 2 + Math.cos(py * 0.021) * 1.6; px += Math.cos(a) * 7; py += Math.sin(a) * 7; x.lineTo(px, py); }
    x.stroke();
  }
  x.globalAlpha = 1;
  for (let i = 0; i < 5; i++) {
    const sx = rand(w), sy = rand(h * 0.5), r = rand(7, 16);
    const g = x.createRadialGradient(sx, sy, 0, sx, sy, r * 2.4); g.addColorStop(0, 'rgba(255,240,150,1)'); g.addColorStop(0.35, 'rgba(244,213,75,.85)'); g.addColorStop(1, 'rgba(244,213,75,0)');
    x.fillStyle = g; x.beginPath(); x.arc(sx, sy, r * 2.4, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,236,140,.7)'; x.lineWidth = 2; for (let k = 1; k < 4; k++) { x.beginPath(); x.arc(sx, sy, r + k * 5, rand(0, 3), rand(3, 6)); x.stroke(); }
  }
}
function drawBottle(x, cx, cy, s) {
  const w = s * 0.32; x.save(); x.translate(cx, cy);
  const g = x.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#5c0612'); g.addColorStop(0.35, '#e0182f'); g.addColorStop(0.6, '#ff5a64'); g.addColorStop(1, '#6a0814');
  x.fillStyle = g; x.beginPath(); x.moveTo(-w / 2, s * 0.5); x.lineTo(-w / 2, -s * 0.05); x.quadraticCurveTo(-w / 2, -s * 0.2, -w * 0.18, -s * 0.28); x.lineTo(-w * 0.16, -s * 0.42); x.lineTo(w * 0.16, -s * 0.42); x.lineTo(w * 0.18, -s * 0.28); x.quadraticCurveTo(w / 2, -s * 0.2, w / 2, -s * 0.05); x.lineTo(w / 2, s * 0.5); x.closePath(); x.fill();
  x.fillStyle = '#d9b45a'; x.fillRect(-w * 0.19, -s * 0.5, w * 0.38, s * 0.09);
  x.fillStyle = '#16307a'; x.fillRect(-w / 2, s * 0.05, w, s * 0.26);
  txt(x, 'VANDIA', 0, s * 0.18, `700 ${s * 0.1 | 0}px ${FONT_D}`, '#f4d54b');
  x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(-w * 0.32, -s * 0.05, w * 0.08, s * 0.5);
  x.restore();
}
function posterVandia() { const c = cv(256, 384), x = c2(c); swirlBG(x, 256, 384); drawBottle(x, 128, 222, 190); txt(x, 'VANDIA GOGH', 128, 52, `700 52px ${FONT_D}`, '#f4d54b'); txt(x, 'BORN UNDER STARRY NIGHTS', 128, 340, `16px ${FONT_M}`, '#f1ead6'); x.fillStyle = '#e0182f'; x.fillRect(78, 352, 100, 22); txt(x, 'TRY IT NOW', 128, 364, `700 14px ${FONT_U}`, '#fff'); grainFx(x, 256, 384, 12); return mkTex(c, true); }
function posterHe() { const c = cv(256, 384), x = c2(c); swirlBG(x, 256, 384); x.fillStyle = 'rgba(8,10,25,.45)'; x.fillRect(0, 250, 256, 134); drawBottle(x, 128, 150, 150); txt(x, 'ונדיה גוך', 128, 290, `900 50px ${FONT_U}`, '#f4d54b'); txt(x, 'נולד תחת לילות מכוכבים', 128, 336, `500 21px ${FONT_U}`, '#f1ead6'); grainFx(x, 256, 384, 12); return mkTex(c, true); }
function posterSafety() { const c = cv(256, 384), x = c2(c); x.fillStyle = '#f0c419'; x.fillRect(0, 0, 256, 384); for (let i = -2; i < 14; i++) { x.fillStyle = '#141414'; x.beginPath(); x.moveTo(i * 28, 0); x.lineTo(i * 28 + 14, 0); x.lineTo(i * 28 - 6, 26); x.lineTo(i * 28 - 20, 26); x.fill(); x.beginPath(); x.moveTo(i * 28, 358); x.lineTo(i * 28 + 14, 358); x.lineTo(i * 28 - 6, 384); x.lineTo(i * 28 - 20, 384); x.fill(); } x.fillStyle = '#141414'; x.beginPath(); x.moveTo(128, 70); x.lineTo(200, 190); x.lineTo(56, 190); x.closePath(); x.fill(); txt(x, '!', 128, 150, `900 80px ${FONT_U}`, '#f0c419'); txt(x, 'אסור לשתות', 128, 240, `900 40px ${FONT_U}`, '#141414'); txt(x, 'מהקו!', 128, 288, `900 40px ${FONT_U}`, '#141414'); txt(x, 'הנהלת המפעל', 128, 332, `500 18px ${FONT_U}`, '#141414'); grainFx(x, 256, 384, 14); return mkTex(c, true); }
function posterMilk() { const c = cv(256, 384), x = c2(c); x.fillStyle = '#e9f1f4'; x.fillRect(0, 0, 256, 384); x.fillStyle = '#1d5fa8'; x.fillRect(0, 0, 256, 70); txt(x, 'זהירות', 128, 36, `900 42px ${FONT_U}`, '#fff'); txt(x, 'רצפה חלקה', 128, 250, `900 36px ${FONT_U}`, '#1d2740'); x.fillStyle = '#fff'; x.strokeStyle = '#1d2740'; x.lineWidth = 6; x.beginPath(); x.moveTo(100, 210); x.lineTo(100, 120); x.lineTo(118, 96); x.lineTo(138, 96); x.lineTo(156, 120); x.lineTo(156, 210); x.closePath(); x.fill(); x.stroke(); txt(x, 'חלב', 128, 165, `700 22px ${FONT_U}`, '#1d2740'); txt(x, 'ולא מנקים במגבת של מישהו אחר', 128, 300, `500 15px ${FONT_U}`, '#1d2740'); grainFx(x, 256, 384, 10); return mkTex(c, true); }
function posterEmployee(id) { const c = cv(256, 320), x = c2(c); x.fillStyle = '#2b1d12'; x.fillRect(0, 0, 256, 320); x.fillStyle = '#d9b45a'; x.fillRect(10, 10, 236, 300); x.fillStyle = '#efe6cf'; x.fillRect(20, 20, 216, 280); txt(x, 'עובד החודש', 128, 46, `900 30px ${FONT_U}`, '#7a1020'); const f = ART.faceBase[id]; if (f) x.drawImage(f, 48, 68, 160, 160); x.strokeStyle = '#2b1d12'; x.lineWidth = 4; x.strokeRect(48, 68, 160, 160); txt(x, castName(id), 128, 252, `700 26px ${FONT_U}`, '#1a1712'); txt(x, 'משמרת לילה', 128, 282, `16px ${FONT_U}`, '#5a5246'); grainFx(x, 256, 320, 12); return mkTex(c, true); }
function bannerTex() { const c = cv(1024, 192), x = c2(c); swirlBG(x, 1024, 192); x.fillStyle = 'rgba(8,10,25,.45)'; x.fillRect(0, 0, 1024, 192); txt(x, 'VANDIA GOGH', 300, 96, `700 110px ${FONT_D}`, '#f4d54b'); txt(x, 'קו ייצור 1 · נולד תחת לילות מכוכבים', 740, 96, `700 40px ${FONT_U}`, '#f1ead6'); grainFx(x, 1024, 192, 10); return mkTex(c, true); }
function whiteboardTex() { const c = cv(512, 256), x = c2(c); x.fillStyle = '#e8ebe8'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#2b2f2e'; x.lineWidth = 10; x.strokeRect(0, 0, 512, 256); txt(x, 'נוסחה 0001', 380, 44, `700 40px ${FONT_H}`, '#16307a'); txt(x, '= ★ + ★★ + ???', 220, 110, `700 44px ${FONT_H}`, '#7a1020'); txt(x, 'לא לטעום!!!', 360, 186, `700 52px ${FONT_H}`, '#7a1020'); x.strokeStyle = '#16307a'; x.lineWidth = 3; x.beginPath(); x.arc(100, 180, 40, 0, 5); x.stroke(); return mkTex(c, true); }

/* ---------------- shirts ---------------- */
function shirtTex(ch, side) {
  const c = cv(256, 256), x = c2(c), col = ch.shirtColor;
  x.fillStyle = col; x.fillRect(0, 0, 256, 256);
  if (ch.shirt === 'hawaii') {
    for (let i = 0; i < 26; i++) { const px = rand(256), py = rand(256), r = rand(10, 18), fc = pick(['#f4d54b', '#f1ead6', '#2fb3a0', '#ff8a5b']); x.fillStyle = fc; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283; x.beginPath(); x.arc(px + Math.cos(a) * r * 0.6, py + Math.sin(a) * r * 0.6, r * 0.45, 0, 7); x.fill(); } x.fillStyle = '#7a2a12'; x.beginPath(); x.arc(px, py, r * 0.25, 0, 7); x.fill(); }
    if (side === 'front') { x.fillStyle = ch.skin; x.beginPath(); x.moveTo(98, 0); x.lineTo(158, 0); x.lineTo(128, 120); x.closePath(); x.fill(); }
  } else if (ch.shirt === 'garin') {
    if (side === 'front') { txt(x, 'גרעין', 128, 100, `900 54px ${FONT_U}`, '#1c3b2a'); txt(x, 'שנת שירות', 128, 146, `700 24px ${FONT_U}`, '#1c3b2a'); }
    for (let i = 0; i < 9; i++) { const px = rand(20, 236), py = rand(0, 120), len = rand(40, 120); x.fillStyle = 'rgba(250,250,245,.9)'; x.fillRect(px, py, rand(5, 11), len); x.beginPath(); x.arc(px + 4, py + len, 6, 0, 7); x.fill(); }
  } else if (ch.shirt === 'hoodie') {
    if (side === 'front') { x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 4; x.strokeRect(58, 150, 140, 74); x.fillStyle = '#d7d2c6'; x.fillRect(110, 8, 5, 70); x.fillRect(141, 8, 5, 64); x.fillStyle = '#e5b21a'; x.beginPath(); x.arc(170, 76, 12, 0, 7); x.fill(); }
    blot(x, 256, 256, 10, '0,0,0', 20, 60, 0.25);
  } else if (ch.shirt === 'stripes') {
    for (let i = 0; i < 256; i += 40) { x.fillStyle = '#16224a'; x.fillRect(i + 20, 0, 20, 256); }
    if (side === 'front') { x.fillStyle = '#f3c613'; x.beginPath(); x.arc(176, 62, 18, 0, 7); x.fill(); x.fillStyle = '#16224a'; x.beginPath(); x.arc(176, 62, 11, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.92)'; x.fillRect(40, 108, 176, 44); txt(x, 'VANDIA', 128, 131, `700 40px ${FONT_D}`, '#e0182f'); }
    else { x.fillStyle = 'rgba(255,255,255,.95)'; x.fillRect(58, 30, 140, 34); txt(x, castName('brodana'), 128, 48, `700 26px ${FONT_U}`, '#16224a'); txt(x, '93', 128, 150, `900 110px ${FONT_U}`, '#ffffff'); }
  } else if (ch.shirt === 'plain') {
    blot(x, 256, 256, 14, '120,100,80', 20, 50, 0.2);
  } else if (ch.shirt === 'emblem') {
    if (side === 'front') {
      x.save(); x.translate(150, 130); x.beginPath(); x.arc(0, 0, 62, 0, 7); x.clip();
      x.fillStyle = '#2f5fd0'; x.fillRect(-62, -62, 62, 62); x.fillStyle = '#2e6a3e'; x.fillRect(0, -62, 62, 62); x.fillStyle = '#9a6a3a'; x.fillRect(-62, 0, 62, 62); x.fillStyle = '#46607e'; x.fillRect(0, 0, 62, 62);
      x.fillStyle = '#eee'; x.fillRect(-62, -10, 124, 20); x.restore();
    }
    blot(x, 256, 256, 18, '30,20,10', 14, 50, 0.45); blot(x, 256, 256, 6, '140,10,25', 10, 30, 0.5);
    x.fillStyle = '#0b0b0b'; for (let i = 0; i < 5; i++) { x.beginPath(); const px = rand(256), py = rand(256); x.ellipse(px, py, rand(6, 16), rand(3, 7), rand(3), 0, 7); x.fill(); }
  }
  grainFx(x, 256, 256, 16); return mkTex(c, true);
}

/* ---------------- faces ---------------- */
function loadImg(src) { return new Promise(res => { if (!src) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
function coverDraw(x, img, S) { const r = Math.max(S / img.width, S / img.height), w = img.width * r, h = img.height * r; x.drawImage(img, (S - w) / 2, (S - h) / 2, w, h); }

function drawProcFace(x, ch, S) {
  x.fillStyle = '#100d0c'; x.fillRect(0, 0, S, S);
  const skin = ch.skin;
  x.fillStyle = shade(skin, -40); x.fillRect(S * 0.36, S * 0.74, S * 0.28, S * 0.3);
  const g = x.createRadialGradient(S * 0.44, S * 0.4, S * 0.04, S * 0.5, S * 0.52, S * 0.42); g.addColorStop(0, shade(skin, 26)); g.addColorStop(1, shade(skin, -42));
  x.fillStyle = g; x.beginPath(); x.ellipse(S * 0.5, S * 0.52, S * 0.29, S * 0.37, 0, 0, 7); x.fill();
  x.fillStyle = shade(skin, -20); x.beginPath(); x.ellipse(S * 0.2, S * 0.5, S * 0.04, S * 0.07, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(S * 0.8, S * 0.5, S * 0.04, S * 0.07, 0, 0, 7); x.fill();
  x.fillStyle = ch.hair;
  if (ch.hairStyle === 'curly') { for (let i = 0; i < 46; i++) { const a = rand(Math.PI * 1.02, Math.PI * 1.98), r = S * rand(0.25, 0.37); x.beginPath(); x.arc(S * 0.5 + Math.cos(a) * r, S * 0.36 + Math.sin(a) * r * 0.72, S * rand(0.035, 0.06), 0, 7); x.fill(); } }
  else if (ch.hairStyle === 'buzz') { x.globalAlpha = 0.85; x.beginPath(); x.ellipse(S * 0.5, S * 0.3, S * 0.29, S * 0.17, 0, Math.PI, 0); x.fill(); x.globalAlpha = 1; }
  else { x.beginPath(); x.ellipse(S * 0.5, S * 0.28, S * 0.31, S * 0.17, 0, Math.PI, 0); x.fill(); x.beginPath(); x.moveTo(S * 0.2, S * 0.3); x.quadraticCurveTo(S * 0.42, S * 0.36, S * 0.66, S * 0.27); x.lineTo(S * 0.8, S * 0.3); x.lineTo(S * 0.8, S * 0.22); x.lineTo(S * 0.2, S * 0.22); x.fill(); }
  // brows (angled in: angry)
  x.strokeStyle = ch.hair; x.lineCap = 'round'; x.lineWidth = S * 0.032;
  x.beginPath(); x.moveTo(S * 0.27, S * 0.355); x.lineTo(S * 0.44, S * 0.385); x.stroke(); x.beginPath(); x.moveTo(S * 0.73, S * 0.355); x.lineTo(S * 0.56, S * 0.385); x.stroke();
  // nose
  x.strokeStyle = shade(skin, -55); x.lineWidth = S * 0.012; x.beginPath(); x.moveTo(S * 0.5, S * 0.46); x.quadraticCurveTo(S * 0.47, S * 0.58, S * 0.52, S * 0.6); x.stroke();
  if (ch.mustache) { x.fillStyle = ch.hair; x.beginPath(); x.ellipse(S * 0.5, S * 0.655, S * 0.11, S * 0.025, 0, 0, 7); x.fill(); }
  if (ch.beard) { x.fillStyle = 'rgba(25,18,14,.55)'; for (let i = 0; i < 260; i++) { const a = rand(0.2, Math.PI - 0.2), r = S * rand(0.22, 0.36); x.fillRect(S * 0.5 + Math.cos(a) * r * 0.85, S * 0.52 + Math.sin(a) * r, 2, 2); } }
  // stitched grin
  x.strokeStyle = '#2a0c0c'; x.lineWidth = S * 0.018; x.beginPath(); x.moveTo(S * 0.33, S * 0.7); x.quadraticCurveTo(S * 0.5, S * 0.79, S * 0.67, S * 0.7); x.stroke();
  x.lineWidth = S * 0.008; for (let i = 0; i < 7; i++) { const t = i / 6, px = lerp(S * 0.35, S * 0.65, t), py = S * 0.7 + Math.sin(t * Math.PI) * S * 0.07; x.beginPath(); x.moveTo(px, py - S * 0.025); x.lineTo(px, py + S * 0.025); x.stroke(); }
  // animatronic seams + bolts
  x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 2; x.beginPath(); x.arc(S * 0.5, S * 0.55, S * 0.3, 0.35, Math.PI - 0.35); x.stroke();
  x.fillStyle = '#8a8f96'; [[0.24, 0.45], [0.76, 0.45]].forEach(([a, b]) => { x.beginPath(); x.arc(S * a, S * b, S * 0.018, 0, 7); x.fill(); });
  const hl = x.createLinearGradient(0, 0, S, S); hl.addColorStop(0, 'rgba(255,255,255,.12)'); hl.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = hl; x.fillRect(0, 0, S, S);
  grainFx(x, S, S, 14);
}

function makeMask(base, eyes, ch) {
  const S = 256, c = cv(S, S), x = c2(c); x.drawImage(base, 0, 0, S, S);
  const d = x.getImageData(0, 0, S, S), a = d.data;
  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    const px = p % S, py = (p / S) | 0; let r = a[i], g = a[i + 1], b = a[i + 2]; const l = 0.3 * r + 0.59 * g + 0.11 * b;
    r = lerp(r, l, 0.45); g = lerp(g, l, 0.45); b = lerp(b, l, 0.35);
    r = (r - 128) * 1.2 + 128; g = (g - 128) * 1.2 + 128; b = (b - 128) * 1.2 + 128; g *= 1.03; r *= 0.97;
    const dx = px / S - 0.5, dy = py / S - 0.5, v = 1 - clamp((dx * dx + dy * dy) * 2.2, 0, 0.8);
    a[i] = r * v; a[i + 1] = g * v; a[i + 2] = b * v;
  }
  x.putImageData(d, 0, 0);
  if (ch.sockets !== false) {
    for (const [ex, ey] of eyes) { const g = x.createRadialGradient(ex * S, ey * S, 0, ex * S, ey * S, S * 0.085); g.addColorStop(0, 'rgba(0,0,0,.97)'); g.addColorStop(0.65, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(ex * S, ey * S, S * 0.085, S * 0.065, 0, 0, 7); x.fill(); }
  }
  x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, S * 0.18); x.quadraticCurveTo(S * 0.5, S * 0.1, S, S * 0.18); x.stroke();
  x.fillStyle = '#7c838c'; [[0.06, 0.2], [0.94, 0.2], [0.06, 0.82], [0.94, 0.82]].forEach(([u, v]) => { x.beginPath(); x.arc(S * u, S * v, 4, 0, 7); x.fill(); });
  return c;
}
function makeScare(base, eyes, ch) {
  const S = 512, c = cv(S, S), x = c2(c); x.drawImage(base, 0, 0, S, S);
  const d = x.getImageData(0, 0, S, S), a = d.data;
  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    const px = p % S, py = (p / S) | 0; const l = 0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]; let v = (l - 128) * 1.6 + 128;
    const dx = px / S - 0.5, dy = py / S - 0.5, vg = 1 - clamp((dx * dx + dy * dy) * 2.6, 0, 0.95);
    a[i] = clamp(v * 1.25, 0, 255) * vg; a[i + 1] = clamp(v * 0.72, 0, 255) * vg; a[i + 2] = clamp(v * 0.68, 0, 255) * vg;
  }
  x.putImageData(d, 0, 0);
  for (const [ex, ey] of eyes) {
    if (ch.sockets !== false) { x.fillStyle = 'rgba(0,0,0,.96)'; x.beginPath(); x.ellipse(ex * S, ey * S, S * 0.09, S * 0.07, 0, 0, 7); x.fill(); }
    const g = x.createRadialGradient(ex * S, ey * S, 0, ex * S, ey * S, S * 0.05); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,60,40,.95)'); g.addColorStop(1, 'rgba(255,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(ex * S, ey * S, S * 0.05, 0, 7); x.fill();
  }
  grainFx(x, S, S, 40);
  return c;
}
async function buildFace(id) {
  const ch = castDef(id); const src = castPhoto(id); const img = await loadImg(src);
  const base = cv(256, 256), bx = c2(base);
  if (img) coverDraw(bx, img, 256); else drawProcFace(bx, ch, 256);
  ART.faceBase[id] = base;
  const eyes = castEyes(id);
  ART.mask[id] = makeMask(base, eyes, ch);
  ART.scareURL[id] = makeScare(base, eyes, ch).toDataURL('image/jpeg', 0.85);
  // the card shows the human before the factory changed them
  let shown = base;
  if (!(CASTDATA[id] && CASTDATA[id].photo) && ch.before) { const b = await loadImg(ch.before); if (b) { shown = cv(256, 256); coverDraw(c2(shown), b, 256); } }
  ART.faceURL[id] = shown.toDataURL('image/jpeg', 0.86);
  if (ART.maskTex[id]) { ART.maskTex[id].image = ART.mask[id]; ART.maskTex[id].needsUpdate = true; }
}
async function buildAllFaces() { for (const c of CAST) await buildFace(c.id); }
function maskTexture(id) { if (!ART.maskTex[id]) ART.maskTex[id] = mkTex(ART.mask[id], true); return ART.maskTex[id]; }

/* small collectible card for the 3D world */
function cardTex(id) {
  const ch = castDef(id), c = cv(192, 288), x = c2(c);
  const g = x.createLinearGradient(0, 0, 192, 288); g.addColorStop(0, '#f6e08a'); g.addColorStop(0.5, '#b8862e'); g.addColorStop(1, '#f6e08a');
  x.fillStyle = g; x.beginPath(); x.moveTo(20, 0); x.lineTo(172, 0); x.lineTo(192, 24); x.lineTo(192, 250); x.lineTo(96, 288); x.lineTo(0, 250); x.lineTo(0, 24); x.closePath(); x.fill();
  x.fillStyle = '#0c1d58'; x.fillRect(10, 12, 172, 236);
  if (ART.faceBase[id]) x.drawImage(ART.faceBase[id], 46, 30, 130, 130);
  txt(x, String(ch.ovr), 30, 44, `700 34px ${FONT_D}`, '#f4d54b'); txt(x, ch.pos, 30, 74, `16px ${FONT_M}`, '#f1ead6');
  txt(x, castName(id), 96, 186, `700 22px ${FONT_U}`, '#f1ead6');
  txt(x, 'STARRY NIGHTS', 96, 222, `12px ${FONT_M}`, '#f4d54b');
  return mkTex(c, true);
}
