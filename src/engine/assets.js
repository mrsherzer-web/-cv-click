// ============================================================================
//  Asset loading (images -> textures) with a progress callback
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { loadTex } from '../world/character.js';
import * as Tx from './textures.js';

const IMG = 'assets/img/';

export const DOM_IMAGES = {
  gefenNormal: IMG + 'gefen_normal.jpg',
  gefenNormalBlur: IMG + 'gefen_normal_blur.jpg',
  gefenScary: IMG + 'gefen_scary.jpg',
  gefenScaryBlur: IMG + 'gefen_scary_blur.jpg',
  duo: IMG + 'vn_duo.webp',
  duoPossessed: IMG + 'vn_duo_possessed.webp',
  cap: IMG + 'vn_cap.webp',
  smiler: IMG + 'vn_smiler.webp',
  yahali: IMG + 'vn_yahali.webp',
  maayan: IMG + 'vn_maayan.webp',
  gefenCut: IMG + 'vn_gefen_normal.webp',
  gefenScaryCut: IMG + 'vn_gefen_scary.webp',
  jsGefen: IMG + 'js_gefen.webp',
};

const TEXTURES = {
  charGefen: IMG + 'char_gefen.webp',
  charCap: IMG + 'char_cap.webp',
  charSmiler: IMG + 'char_smiler.webp',
  jsGefen: IMG + 'js_gefen.webp',
  jsCap: IMG + 'js_cap.webp',
  jsSmiler: IMG + 'js_smiler.webp',
  posterDuo: IMG + 'tex_poster_duo.jpg',
  gefenPhoto: IMG + 'tex_gefen_photo.jpg',
  gefenScaryPhoto: IMG + 'tex_gefen_scary_photo.jpg',
};
const DATA_TEXTURES = {
  glowGefen: IMG + 'char_gefen_glow.png',
  glowCap: IMG + 'char_cap_glow.png',
  glowSmiler: IMG + 'char_smiler_glow.png',
};

function loadImage(url) {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

function championPoster(photo, scary) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 724;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 724);
  g.addColorStop(0, scary ? '#1a0003' : '#2a1d08');
  g.addColorStop(1, scary ? '#000' : '#0d0904');
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 724);
  x.strokeStyle = scary ? '#7a0010' : '#c9a24a';
  x.lineWidth = 8;
  x.strokeRect(14, 14, 484, 696);
  if (photo) {
    x.save();
    x.beginPath();
    x.rect(76, 150, 360, 420);
    x.clip();
    x.drawImage(photo, 76, 150, 360, 480);
    x.restore();
    x.strokeStyle = scary ? '#5a0008' : '#e6c46a';
    x.lineWidth = 6;
    x.strokeRect(76, 150, 360, 420);
  }
  x.direction = 'rtl';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.shadowColor = scary ? '#ff0000' : '#ffb000';
  x.shadowBlur = 18;
  x.fillStyle = scary ? '#ff2a2a' : '#ffd36a';
  x.font = '400 78px "Rubik Wet Paint"';
  x.fillText(scary ? 'גפן השד' : 'גפן התותח', 256, 82);
  x.shadowBlur = 0;
  x.font = '900 40px Heebo';
  x.fillStyle = scary ? '#d0c0c0' : '#f4e7c8';
  x.fillText(scary ? 'אין לאן לברוח' : 'אלוף המועדון', 256, 622);
  x.font = '700 26px Heebo';
  x.fillStyle = scary ? '#a00' : '#c9a24a';
  x.fillText(scary ? '06:00 לא תגיע' : '★ 147 נקודות בשבירה אחת ★', 256, 672);
  if (scary) {
    x.fillStyle = 'rgba(110,0,6,0.85)';
    for (let i = 0; i < 9; i++) x.fillRect(90 + Math.random() * 330, 560, 4 + Math.random() * 5, 30 + Math.random() * 120);
  }
  return c;
}

export async function loadAssets(onProgress = () => {}) {
  const A = { tex: {}, img: {} };
  const jobs = [];
  let done = 0;
  const total = Object.keys(TEXTURES).length + Object.keys(DATA_TEXTURES).length + Object.keys(DOM_IMAGES).length + 1;
  const tick = () => onProgress(++done / total);

  jobs.push(
    Promise.all([
      document.fonts.load('900 40px Heebo'),
      document.fonts.load('400 40px "Rubik Wet Paint"'),
      document.fonts.load('400 40px "Rubik Glitch"'),
      document.fonts.load('400 40px "Rubik Beastly"'),
      document.fonts.load('400 40px VT323'),
    ])
      .catch(() => {})
      .then(tick),
  );
  for (const [k, url] of Object.entries(TEXTURES)) jobs.push(loadTex(url).then((t) => ((A.tex[k] = t), tick())));
  for (const [k, url] of Object.entries(DATA_TEXTURES)) jobs.push(loadTex(url, false).then((t) => ((A.tex[k] = t), tick())));
  for (const [k, url] of Object.entries(DOM_IMAGES)) jobs.push(loadImage(url).then((im) => ((A.img[k] = im), tick())));
  await Promise.all(jobs);

  const photo = await loadImage(IMG + 'tex_gefen_photo.jpg');
  const scary = await loadImage(IMG + 'tex_gefen_scary_photo.jpg');
  A.tex.champion = Tx.tex(championPoster(photo, false));
  A.tex.championScary = Tx.tex(championPoster(scary, true));
  A.tex.newspaper = Tx.tex(Tx.newspaper());
  for (const t of [A.tex.champion, A.tex.championScary, A.tex.newspaper]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return A;
}
