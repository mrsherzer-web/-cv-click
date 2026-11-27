// ============================================================================
//  GEFEN 2 – THE DEMON RETURNS · boot, scene director, main loop
// ============================================================================
import { VIEW } from './engine/view.js';
import { Gfx } from './engine/gfx.js';
import { audio } from './engine/audio2.js';
import { voice } from './engine/voice.js';
import { Input } from './engine/input.js';
import { Assets } from './engine/assets.js';
import { DEV } from './config.js';
import { UI } from './story.js';
import { save } from './game/save.js';
import { NightScene } from './game/night.js';
import { SplashScene, MenuScene } from './scenes/menu.js';
import { EndingScene } from './scenes/ending.js';

const SCENES = { splash: SplashScene, menu: MenuScene, night: NightScene, ending: EndingScene };
const LANDSCAPE = new Set(['night', 'ending']);

class Director {
  constructor(G) {
    this.G = G;
    this.cur = null;
    this.name = null;
  }
  go(name, params = {}) {
    const Scene = SCENES[name];
    if (!Scene) throw new Error('unknown scene ' + name);
    try {
      this.cur?.exit?.();
    } catch (e) {
      console.error(e);
    }
    document.getElementById('ui').innerHTML = '';
    const hud = document.getElementById('hud');
    hud.innerHTML = '';
    hud.hidden = true;
    const fx = this.G.gfx.fx;
    Object.assign(fx, { faceAmt: 0, glitch: 0, staticAmt: 0, flash: 0, fade: 0, mask: 0, videoAmt: 0, redPulse: 0, shake: 0 });
    this.G.input.setMode('ui');
    this.name = name;
    window.__scene = name;
    this.cur = new Scene(this.G, params);
    this.G.checkRotate();
  }
}

async function boot() {
  save.load();
  const settings = save.data.settings;
  const canvas = document.getElementById('gl');
  const gfx = new Gfx(canvas);
  if (settings.quality == null) settings.quality = gfx.isMobile ? 1 : 2;
  if (DEV.quality != null) settings.quality = DEV.quality;
  gfx.setQuality(settings.quality);
  const input = new Input(canvas);
  input.sens = settings.sens || 1;
  const assets = new Assets();
  const G = { gfx, audio, voice, input, assets, save, settings, dev: DEV, time: 0 };
  G.director = new Director(G);
  window.__game = G;
  window.__settings = settings;

  G.applySettings = () => {
    audio.setVolume(DEV.mute ? 0 : settings.volume);
    voice.enabled = settings.voice !== false;
    input.sens = settings.sens || 1;
    gfx.setQuality(settings.quality);
    save.write();
  };

  // rotate prompt on phones
  const rot = document.getElementById('rotate');
  let rotIgnored = false;
  rot.querySelector('p').textContent = UI.rotate;
  rot.querySelector('button').textContent = UI.rotateIgnore;
  rot.querySelector('button').addEventListener('click', () => {
    rotIgnored = true;
    rot.hidden = true;
  });
  G.checkRotate = () => {
    // a phone held upright turns the page by itself (engine/view.js), so this prompt is only for ?norot
    const need = LANDSCAPE.has(G.director.name) && input.touch && !VIEW.rot && innerHeight > innerWidth * 1.05 && !rotIgnored;
    rot.hidden = !need;
    G.rotatePaused = need;
  };
  addEventListener('resize', G.checkRotate);

  // fonts first (canvas textures use them)
  try {
    await Promise.all(['400 40px "Rubik Wet Paint"', '900 40px Heebo', '400 40px VT323', '400 40px "Rubik Glitch"'].map((f) => document.fonts.load(f, 'אב12')));
  } catch (e) {}
  const bar = document.querySelector('#loading .load-bar i');
  const pct = document.querySelector('#loading .load-pct');
  await assets.load((p) => {
    bar.style.width = Math.round(p * 100) + '%';
    pct.textContent = Math.round(p * 100) + '%';
  });
  document.getElementById('loading').classList.add('done');
  setTimeout(() => document.getElementById('loading').remove(), 600);
  G.applySettings();

  // first scene
  if (DEV.night) {
    audio.unlock();
    await audio.decodePending?.();
    G.director.go('night', { night: DEV.night, stage: DEV.stage });
  } else if (DEV.scene) {
    audio.unlock();
    await audio.decodePending?.();
    G.director.go(DEV.scene, {});
  } else G.director.go('splash');

  // main loop
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (DEV.capFps) {
      acc += dt;
      if (acc < 1 / DEV.capFps) return;
      dt = acc;
      acc = 0;
    }
    dt = Math.min(dt, 0.1);
    if (document.hidden) return;
    G.time += dt;
    const sc = G.director.cur;
    if (sc && !G.rotatePaused) {
      try {
        sc.update?.(dt);
      } catch (e) {
        console.error(e);
      }
    }
    try {
      sc?.render?.(G.time);
    } catch (e) {
      console.error(e);
    }
    input.endFrame();
    window.__frames = (window.__frames || 0) + 1;
  };
  requestAnimationFrame(frame);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.director.name === 'night' && !G.director.cur.paused) G.director.cur.togglePause?.();
  });
  if ('serviceWorker' in navigator && !window.__EMBED && location.protocol.startsWith('http') && !DEV.on && !DEV.night) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  if (l) l.querySelector('.load-pct').textContent = 'שגיאה בטעינה: ' + e.message;
});
