// ============================================================================
//  הסנוקר של גפן — boot + scene director + main loop
// ============================================================================
import { Gfx } from './engine/gfx.js';
import { audio } from './engine/audio.js';
import { loadAssets } from './engine/assets.js';
import { buildRooms } from './world/rooms.js';
import { Office } from './world/office.js';
import { Corridor } from './world/corridor.js';
import { Character } from './world/character.js';
import { SplashScene, MenuScene, VideoScene, DemonScene, DuoScene } from './scenes/intro.js';
import { EscapeScene } from './scenes/escape.js';
import { NightScene } from './scenes/night.js';
import { NightIntroScene, Night2StoryScene, SixAmScene, GameOverScene, EndingScene } from './scenes/story.js';
import { DEV } from './config.js';
import { UI as TXT } from './story.js';
import { save } from './game/save.js';
import { flash } from './ui/dom.js';

const SCENES = {
  splash: SplashScene,
  menu: MenuScene,
  video: VideoScene,
  demon: DemonScene,
  duo: DuoScene,
  escape: EscapeScene,
  nightIntro: NightIntroScene,
  night2story: Night2StoryScene,
  night: NightScene,
  sixam: SixAmScene,
  gameover: GameOverScene,
  ending: EndingScene,
};

// scenes that need a landscape screen on phones
const LANDSCAPE = new Set(['escape', 'night', 'duo', 'night2story']);

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
    const fx = this.G.gfx.fx;
    fx.faceAmt = 0;
    fx.glitch = 0;
    fx.staticAmt = 0;
    fx.flash = 0;
    this.G.jsActive = null;
    this.name = name;
    this.cur = new Scene(this.G, params);
    window.__scene = name;
    checkOrientation();
    Promise.resolve(this.cur.enter?.()).catch((e) => console.error(e));
  }
}

const G = (window.__game = {});

async function boot() {
  const $load = document.getElementById('loading');
  const $bar = $load.querySelector('.load-bar i');
  const $pct = $load.querySelector('.load-pct');
  window.__settings = save.data.settings;
  let gfx;
  try {
    gfx = new Gfx(document.getElementById('gl'));
  } catch (e) {
    $pct.textContent = 'הדפדפן שלך לא תומך ב-WebGL 😢';
    throw e;
  }
  G.gfx = gfx;
  G.audio = audio;
  G.save = save;
  const A = await loadAssets((p) => {
    $bar.style.width = Math.round(p * 85) + '%';
    $pct.textContent = Math.round(p * 85) + '%';
  });
  G.A = A;
  G.rooms = buildRooms(A);
  G.office = new Office(A);
  G.corridor = new Corridor(A);
  G.chars = {
    gefen: new Character('char_gefen', A.tex.charGefen, A.tex.glowGefen),
    cap: new Character('char_cap', A.tex.charCap, A.tex.glowCap),
    smiler: new Character('char_smiler', A.tex.charSmiler, A.tex.glowSmiler),
  };
  G.jsTex = { gefen: A.tex.jsGefen, cap: A.tex.jsCap, smiler: A.tex.jsSmiler };
  G.director = new Director(G);
  G.startNight = (n) => (n === 2 ? G.director.go('night2story') : G.director.go('nightIntro', { night: n }));
  G.jumpscare = jumpscare;

  // pre-compile every scene so the first camera switch never stutters
  const places = [...Object.values(G.rooms).map((r) => [r.scene, r.camera]), [G.office.scene, G.office.camera], [G.corridor.scene, G.corridor.camera]];
  // put the characters somewhere so their shader gets compiled too
  G.chars.gefen.place(G.rooms.main, G.rooms.main.spots.gefen0);
  G.chars.cap.place(G.rooms.bar, G.rooms.bar.spots.cap);
  G.chars.smiler.place(G.office, G.office.doorSpot('right', 'char_smiler', true));
  let i = 0;
  for (const [s, c] of places) {
    await gfx.warm(s, c);
    i++;
    const p = 85 + Math.round((i / places.length) * 15);
    $bar.style.width = p + '%';
    $pct.textContent = p + '%';
  }
  Object.values(G.chars).forEach((c) => c.remove());

  $load.classList.add('done');
  setTimeout(() => $load.remove(), 700);

  // dev shortcuts: ?scene=night&night=3
  if (DEV.scene) {
    const unlockOnce = () => {
      audio.unlock();
      removeEventListener('pointerdown', unlockOnce);
      removeEventListener('keydown', unlockOnce);
    };
    addEventListener('pointerdown', unlockOnce);
    addEventListener('keydown', unlockOnce);
    G.director.go(DEV.scene, { night: DEV.night || 1 });
  } else G.director.go('splash');

  let last = performance.now();
  const minFrame = DEV.capFps ? 1000 / DEV.capFps - 2 : 0;
  const loop = (now) => {
    if (minFrame && now - last < minFrame) return requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    const s = G.director.cur;
    try {
      s?.update?.(dt, t);
      updateJumpscare(dt, t);
      if (s?.render) s.render(t);
      else if (G.jsActive) gfx.render(null, G.office.camera, 'office', t);
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- jump-scare
function jumpscare(who, then) {
  const fx = G.gfx.fx;
  G.gfx.setFace(G.jsTex[who] || G.jsTex.gefen);
  G.jsActive = { t: 0, then, done: false };
  fx.faceAmt = 1;
  fx.faceScale = 0.5;
  audio.scream(1);
  flash('#ffffff', 160, 0.6);
}
function updateJumpscare(dt, t) {
  const J = G.jsActive;
  if (!J) return;
  const fx = G.gfx.fx;
  J.t += dt;
  const k = J.t;
  fx.faceScale = 0.55 + Math.min(1, k / 0.18) * 0.75 + Math.sin(k * 40) * 0.015;
  fx.faceX = (Math.random() - 0.5) * 0.03;
  fx.faceY = -0.06 + (Math.random() - 0.5) * 0.03;
  fx.glitch = 0.35 + Math.random() * 0.4;
  fx.redPulse = 0.4;
  fx.flash = k < 0.08 ? 0.5 : 0;
  if (k > 1.25) {
    fx.staticAmt = Math.min(1, (k - 1.25) * 5);
  }
  if (k > 1.5 && !J.done) {
    J.done = true;
    fx.faceAmt = 0;
    fx.glitch = 0;
    fx.redPulse = 0;
    fx.staticAmt = 0;
    G.jsActive = null;
    J.then?.();
  }
}

// ---------------------------------------------------------------- orientation (phones)
let ignoreRotate = false;
function checkOrientation() {
  const el = document.getElementById('rotate');
  const need = LANDSCAPE.has(G.director?.name) && matchMedia('(pointer: coarse)').matches && innerHeight > innerWidth && !ignoreRotate;
  el.hidden = !need;
}
document.querySelector('#rotate p').textContent = TXT.rotate;
document.getElementById('rotate-ignore').addEventListener('click', () => {
  ignoreRotate = true;
  checkOrientation();
});
addEventListener('resize', checkOrientation);
addEventListener('orientationchange', () => setTimeout(checkOrientation, 300));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.director?.cur?.pause && G.director.name === 'night') G.director.cur.pause(true);
});

// installable app + offline play (only when served from a real web address)
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.__EMBED) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
