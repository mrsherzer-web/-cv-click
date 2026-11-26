// ============================================================================
//  Asset loading.  Everything is listed in src/generated/manifest.js (written
//  by tools/build_assets.py).  A missing sprite falls back to a drawn
//  silhouette so the game always runs.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { MANIFEST } from '../generated/manifest.js';
import { audio } from './audio2.js';
import { VOICE_FILES } from '../story.js';

/** path relative to assets/ -> URL (single-file builds embed data URIs in window.__EMBED) */
export const url = (p) => (window.__EMBED && window.__EMBED[p]) || 'assets/' + p;

const NAMES = { gefen: 'גפן', ido: 'עידו', dolev: 'דולב', yahali: 'יהלי', maayan: 'מעיין', cap: 'כובע', smiler: 'חייכן' };
const EYES = { gefen: '#ff2010', ido: '#ffb020', dolev: '#40a8ff' };

function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function texFrom(img, srgb = true) {
  const t = new THREE.Texture(img);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Drawn stand-in for a missing cut-out */
function placeholder(id, pose) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = pose === 'crawl' ? 200 : 560;
  const x = c.getContext('2d');
  const g = document.createElement('canvas');
  g.width = c.width;
  g.height = c.height;
  const gx = g.getContext('2d');
  gx.fillStyle = '#000';
  gx.fillRect(0, 0, g.width, g.height);
  const body = { gefen: '#c9c4b8', ido: '#5d6a4a', dolev: '#1b1b1d', yahali: '#17171a', maayan: '#222226', cap: '#d8d5cc', smiler: '#d9d2bd' }[id] || '#888';
  const skin = '#b98e6e';
  if (pose === 'crawl') {
    x.fillStyle = body;
    x.beginPath();
    x.ellipse(128, 130, 110, 60, 0, 0, 7);
    x.fill();
    x.fillStyle = skin;
    x.beginPath();
    x.ellipse(128, 86, 44, 52, 0, 0, 7);
    x.fill();
    x.fillRect(20, 150, 46, 44);
    x.fillRect(190, 150, 46, 44);
    gx.fillStyle = '#f00';
    gx.beginPath();
    gx.arc(110, 80, 7, 0, 7);
    gx.arc(146, 80, 7, 0, 7);
    gx.fill();
  } else {
    x.fillStyle = skin;
    x.beginPath();
    x.ellipse(128, 62, 36, 46, 0, 0, 7);
    x.fill();
    x.fillRect(112, 100, 32, 26);
    x.fillStyle = body;
    x.beginPath();
    x.roundRect(52, 120, 152, 220, 26);
    x.fill();
    x.fillStyle = skin;
    x.fillRect(40, 150, 22, 150);
    x.fillRect(194, 150, 22, 150);
    x.fillStyle = '#2a2d33';
    x.fillRect(74, 330, 46, 220);
    x.fillRect(136, 330, 46, 220);
    if (pose === 'back') {
      x.fillStyle = '#3a2c20';
      x.beginPath();
      x.ellipse(128, 56, 37, 44, 0, 0, 7);
      x.fill();
    } else {
      gx.fillStyle = '#f00';
      gx.beginPath();
      gx.arc(114, 58, 6, 0, 7);
      gx.arc(142, 58, 6, 0, 7);
      gx.fill();
      x.fillStyle = '#111';
      x.beginPath();
      x.arc(114, 58, 5, 0, 7);
      x.arc(142, 58, 5, 0, 7);
      x.fill();
    }
    x.fillStyle = '#fff';
    x.font = '900 34px Heebo, sans-serif';
    x.textAlign = 'center';
    x.fillText(NAMES[id] || id, 128, 240);
  }
  void EYES;
  return { map: texFrom(c), glow: pose === 'back' ? null : texFrom(g, false), aspect: c.width / c.height, h: pose === 'crawl' ? 0.72 : 1.78, placeholder: true };
}

class VideoClip {
  constructor(sources) {
    const el = (this.el = document.createElement('video'));
    el.muted = true;
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    for (const s of sources) {
      const so = document.createElement('source');
      so.src = url(s);
      so.type = s.endsWith('.webm') ? 'video/webm' : 'video/mp4';
      el.appendChild(so);
    }
    this.tex = new THREE.VideoTexture(el);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.aspect = 16 / 9;
    el.addEventListener('loadedmetadata', () => {
      if (el.videoWidth) this.aspect = el.videoWidth / el.videoHeight;
    });
    this.failed = false;
    el.addEventListener('error', () => (this.failed = true), true);
  }

  /** iOS: must be touched inside a user gesture once */
  prime() {
    const p = this.el.play();
    if (p && p.then) p.then(() => this.el.pause()).catch(() => {});
  }

  /** Start from the beginning. Resolves true when frames are really coming. */
  play(rate = 1) {
    const el = this.el;
    return new Promise((res) => {
      if (this.failed) return res(false);
      let done = false;
      const fin = (ok) => {
        if (done) return;
        done = true;
        clearTimeout(to);
        res(ok);
      };
      const to = setTimeout(() => fin(el.readyState >= 2 && !el.paused), 2500);
      try {
        el.currentTime = 0;
      } catch (e) {}
      el.playbackRate = rate;
      const p = el.play();
      if (p && p.then) {
        p.then(() => {
          if (el.readyState >= 2) fin(true);
          else el.addEventListener('playing', () => fin(true), { once: true });
        }).catch(() => fin(false));
      } else fin(true);
    });
  }
}

export class Assets {
  constructor() {
    this.sheets = {};
    this.images = {};
    this.videos = {};
    this.worldTex = {};
  }

  async load(onProgress = () => {}) {
    const M = MANIFEST;
    const jobs = [];
    let done = 0;
    const tick = () => onProgress(++done / Math.max(1, jobs.length));
    for (const id of ['gefen', 'ido', 'dolev', 'yahali', 'maayan', 'cap', 'smiler']) {
      this.sheets[id] = {};
      const poses = (M.sprites && M.sprites[id]) || {};
      for (const pose in poses) {
        const p = poses[pose];
        jobs.push(
          (async () => {
            const [im, gl] = await Promise.all([loadImage(url(p.img)), p.glow ? loadImage(url(p.glow)) : null]);
            if (im) this.sheets[id][pose] = { map: texFrom(im), glow: gl ? texFrom(gl, false) : null, aspect: p.aspect || im.width / im.height, h: p.h || 1.78, fade: p.fade || 0, lift: p.lift || 0 };
            tick();
          })(),
        );
      }
    }
    for (const key in M.images || {}) {
      jobs.push(
        loadImage(url(M.images[key])).then((im) => {
          if (im) this.images[key] = im;
          tick();
        }),
      );
    }
    for (const key in M.audio || {}) jobs.push(audio.loadSample(key, url(M.audio[key])).then(tick));
    for (const key in M.voice || {}) {
      VOICE_FILES[key] = url(M.voice[key]);
      jobs.push(audio.loadSample('v_' + key, url(M.voice[key])).then(tick));
    }
    await Promise.all(jobs);
    for (const key in M.videos || {}) this.videos[key] = new VideoClip([].concat(M.videos[key]));
    if (this.images.gefen_photo) this.worldTex.gefenPhoto = texFrom(this.images.gefen_photo);
    // fill the gaps
    const need = { gefen: ['idle', 'back'], ido: ['idle', 'crawl'], dolev: ['idle'], yahali: ['idle'], maayan: ['idle'], cap: ['idle'], smiler: ['idle'] };
    for (const id in need) for (const pose of need[id]) if (!this.sheets[id][pose]) this.sheets[id][pose] = placeholder(id, pose);
    onProgress(1);
  }

  sheet(id) {
    return this.sheets[id];
  }

  video(key) {
    const v = this.videos[key];
    return v && !v.failed ? v : null;
  }

  /** Call inside the first tap so iOS lets us start clips later */
  primeVideos() {
    for (const k in this.videos) this.videos[k].prime();
  }

  faceTexture(key) {
    const im = this.images[key];
    if (!im) return null;
    this._faces = this._faces || {};
    return (this._faces[key] = this._faces[key] || texFrom(im));
  }
}
