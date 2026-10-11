import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Clock, store } from './util.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { UI } from './ui.js';
import { CamRig } from './camera.js';
import { Person } from './people.js';
import { CAST, portraitOf } from './cast.js';
import { Story, CHAPTERS } from './story.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', isTouch);
// the downloadable PC version runs inside Electron
const isDesktopApp = /Electron\//.test(navigator.userAgent);
document.body.classList.toggle('desktop-app', isDesktopApp);

// ---------- assets: face scans and clips live in a private module that is not committed
async function loadAssets() {
  const assets = { faces: {}, portraits: {}, clips: {} };
  try {
    const mod = await import('../private/faces.js');
    assets.faces = mod.default || {};
  } catch {
    /* no scans: cartoon faces */
  }
  try {
    const mod = await import('../private/media.js');
    Object.assign(assets.portraits, mod.portraits || {});
    // H.264 where the browser has it, WebM (VP9) where it does not
    const h264 = document.createElement('video').canPlayType('video/mp4; codecs="avc1.42E01F"');
    Object.assign(assets.clips, (h264 || !mod.clipsWebm ? mod.clips : mod.clipsWebm) || {});
  } catch {
    /* no extra media */
  }
  return assets;
}

// msaa: samples for the post-processing target; ao: ambient occlusion; grade: grain and vignette
const QUALITY = {
  ultra: { pr: 2, bloom: true, shadows: true, msaa: 4, ao: true, grade: true, shadowSize: 2048 },
  high: { pr: 2, bloom: true, shadows: true, msaa: 4, ao: false, grade: true, shadowSize: 1024 },
  medium: { pr: 1.5, bloom: true, shadows: true, msaa: 0, ao: false, grade: false, shadowSize: 1024 },
  low: { pr: 1, bloom: false, shadows: false, msaa: 0, ao: false, grade: false, shadowSize: 512 },
};
const Q_ORDER = ['ultra', 'high', 'medium', 'low'];
const Q_LABEL = { ultra: 'אולטרה', high: 'גבוהה', medium: 'בינונית', low: 'חסכונית' };

// Film look applied after tone mapping: a soft vignette and fine moving grain.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.22 }, grain: { value: 0.028 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignette;
    uniform float grain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.82);
      c.rgb *= mix(1.0 - vignette, 1.0, smoothstep(0.78, 0.22, length(d)));
      c.rgb += (hash(floor(gl_FragCoord.xy) + fract(time * 7.13) * 311.0) - 0.5) * grain;
      gl_FragColor = c;
    }`,
};

const assets = await loadAssets();
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  $('loading').textContent = 'הדפדפן הזה לא מריץ WebGL, ולכן המשחק לא יכול לעלות. נסו כרום או ספארי מעודכנים.';
  throw err;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

let qualityKey = store.get('quality', isDesktopApp ? 'ultra' : isTouch ? 'medium' : 'high');
if (!QUALITY[qualityKey]) qualityKey = 'medium';
let pr = Math.min(window.devicePixelRatio || 1, QUALITY[qualityKey].pr);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.08, 2000);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const sfx = new Sfx();
sfx.enabled = store.get('sound', true);
const ui = new UI({ sfx, assets });
ui.voice = store.get('voice', false);
const input = new Input({ canvas: $('game'), stickZone: $('stickZone'), stickBase: $('stickBase'), stickKnob: $('stickKnob'), actionBtn: $('actionBtn') });
const rig = new CamRig(camera);
const clock = new Clock();

// The cast is built once (scanned heads are the expensive part) and moved between scenes.
const cast = {};
for (const id of Object.keys(CAST)) {
  const def = { id, ...CAST[id], face: assets.faces[id] || null };
  cast[id] = new Person(def);
  cast[id].group.userData.keep = true;
}

const game = {
  renderer,
  camera,
  rig,
  ui,
  sfx,
  input,
  clock,
  cast,
  assets,
  envTex,
  scene: new THREE.Scene(),
  level: null,
  player: cast.yonati,
  control: 'none',
  car: null,
  interactables: [],
  composer: null,
  paused: false,
  state: 'menu',
  quality: () => QUALITY[qualityKey],
};

// ---------- post-processing
function buildPost() {
  game.composer?.dispose();
  game.composer = null;
  if (!QUALITY[qualityKey].bloom) {
    game.bloom = null;
    game.aoPass = null;
    game.gradePass = null;
    document.body.classList.remove('graded');
    game.applyPost();
    return;
  }
  const Q = QUALITY[qualityKey];
  // a multisampled target keeps edges smooth even though the scene is post-processed
  const target = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: Q.msaa || 0 });
  const c = new EffectComposer(renderer, target);
  c.addPass(new RenderPass(game.scene, camera));
  game.renderPass = c.passes[0];
  game.aoPass = null;
  if (Q.ao) {
    const ao = new GTAOPass(game.scene, camera, innerWidth, innerHeight);
    ao.blendIntensity = 0.85;
    ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.2, thickness: 1.2, scale: 1.0, samples: 16 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    // glass, light cones and glow sprites must not cast ambient occlusion
    ao.overrideVisibility = function () {
      const cache = this._visibilityCache;
      this.scene.traverse((o) => {
        cache.set(o, o.visible);
        const m = o.material;
        if (o.isPoints || o.isLine || o.isSprite || (m && !Array.isArray(m) && m.transparent && !m.vertexColors)) o.visible = false;
      });
    };
    c.addPass(ao);
    game.aoPass = ao;
  }
  game.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.5, 0.92);
  c.addPass(game.bloom);
  c.addPass(new OutputPass());
  game.gradePass = null;
  if (Q.grade) {
    game.gradePass = new ShaderPass(GradeShader);
    c.addPass(game.gradePass);
  }
  document.body.classList.toggle('graded', !!Q.grade);
  game.composer = c;
  c.setPixelRatio(pr);
  c.setSize(innerWidth, innerHeight);
  game.applyPost();
}
// Per-level look: bloom only on what should glow, and exposure (bright mall vs. dark bunker).
game.applyPost = () => {
  const post = { strength: 0.35, radius: 0.5, threshold: 0.92, exposure: 1, ...(game.story?.level?.post || {}) };
  if (game.bloom) {
    game.bloom.strength = post.strength;
    game.bloom.radius = post.radius;
    game.bloom.threshold = post.threshold;
  }
  renderer.toneMappingExposure = post.exposure;
};
// Point the post-processing passes at a newly loaded level.
game.setScene = (scene) => {
  if (game.renderPass) game.renderPass.scene = scene;
  if (game.aoPass) game.aoPass.scene = scene;
};
// Sharper shadows on the higher settings: resize every shadow map in the level.
game.tuneShadows = (scene) => {
  const n = QUALITY[qualityKey].shadowSize || 1024;
  scene.traverse((o) => {
    if (!o.isLight || !o.castShadow || !o.shadow) return;
    if (o.shadow.mapSize.x === n) return;
    o.shadow.mapSize.set(n, n);
    o.shadow.map?.dispose();
    o.shadow.map = null;
  });
};
game.rebuildPost = () => {
  buildPost();
  resize();
};

function resize() {
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight, false);
  game.composer?.setPixelRatio(pr);
  game.composer?.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  rig.baseFov = camera.aspect < 0.8 ? 70 : 58;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
renderer.shadowMap.enabled = QUALITY[qualityKey].shadows;

const story = new Story(game);
game.story = story;

// ---------- menu
const castRow = $('castRow');
const castList = $('castList');
for (const id of ['ido', 'yonati', 'yiftach', 'dolev', 'yahli', 'avraham']) {
  const f = document.createElement('figure');
  f.style.setProperty('--who', CAST[id].color);
  const img = document.createElement('img');
  img.src = portraitOf(id, assets);
  img.alt = CAST[id].full;
  const cap = document.createElement('figcaption');
  cap.textContent = CAST[id].full;
  f.append(img, cap);
  castRow.append(f);
  const row = document.createElement('div');
  row.style.setProperty('--who', CAST[id].color);
  const img2 = img.cloneNode();
  const sp = document.createElement('span');
  const b = document.createElement('b');
  b.textContent = CAST[id].full;
  const sm = document.createElement('small');
  sm.textContent = CAST[id].role;
  sp.append(b, sm);
  row.append(img2, sp);
  castList.append(row);
}

function renderChapterList() {
  const list = $('chapterList');
  list.innerHTML = '';
  const max = store.get('maxChapter', 0);
  CHAPTERS.forEach((ch, i) => {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.type = 'button';
    b.textContent = `${i + 1}. ${ch.title}`;
    b.disabled = i > max;
    b.addEventListener('click', () => startChapter(i));
    list.append(b);
  });
  $('continueBtn').hidden = max === 0;
}

function syncSettings() {
  $('soundBtn').textContent = 'צליל: ' + (sfx.enabled ? 'פועל' : 'כבוי');
  $('pSoundBtn').textContent = 'צליל: ' + (sfx.enabled ? 'פועל' : 'כבוי');
  $('voiceBtn').textContent = 'הקראה: ' + (ui.voice ? 'פועלת' : 'כבויה');
  $('qualityBtn').textContent = 'גרפיקה: ' + Q_LABEL[qualityKey];
  $('pQualityBtn').textContent = 'גרפיקה: ' + Q_LABEL[qualityKey];
  const fs = document.fullscreenElement ? 'יציאה ממסך מלא' : 'מסך מלא';
  $('fsBtn').textContent = fs;
  $('pFsBtn').textContent = fs;
  // fullscreen is not offered where the page cannot have it (some phones, embedded views)
  const canFs = !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;
  $('fsBtn').hidden = !canFs;
  $('pFsBtn').hidden = !canFs;
}

function toggleSound() {
  sfx.setEnabled(!sfx.enabled);
  store.set('sound', sfx.enabled);
  syncSettings();
}
function cycleQuality() {
  qualityKey = Q_ORDER[(Q_ORDER.indexOf(qualityKey) + 1) % Q_ORDER.length];
  store.set('quality', qualityKey);
  pr = Math.min(window.devicePixelRatio || 1, QUALITY[qualityKey].pr);
  renderer.shadowMap.enabled = QUALITY[qualityKey].shadows;
  game.scene.traverse((o) => {
    if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
  });
  game.tuneShadows(game.scene);
  buildPost();
  resize();
  syncSettings();
}
$('soundBtn').addEventListener('click', toggleSound);
$('pSoundBtn').addEventListener('click', toggleSound);
$('voiceBtn').addEventListener('click', () => {
  ui.voice = !ui.voice;
  store.set('voice', ui.voice);
  syncSettings();
});
$('qualityBtn').addEventListener('click', cycleQuality);
$('pQualityBtn').addEventListener('click', cycleQuality);
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
$('fsBtn').addEventListener('click', toggleFullscreen);
$('pFsBtn').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', syncSettings);
$('quitBtn').addEventListener('click', () => window.close());
$('pQuitBtn').addEventListener('click', () => window.close());
$('controlsHint').textContent = isTouch
  ? 'ג׳ויסטיק משמאל: הליכה (דחיפה עד הסוף: ריצה). גרירה בצד ימין: סיבוב מצלמה. הכפתור הצהוב: פעולה.'
  : 'WASD או חצים: תנועה · Shift: ריצה · E או רווח: פעולה · גרירת עכבר: מצלמה · Esc: הפסקה · אפשר גם עם שלט של Xbox או PlayStation';

async function startChapter(i) {
  sfx.init();
  sfx.resume();
  $('menu').hidden = true;
  $('credits').hidden = true;
  $('pause').hidden = true;
  game.paused = false;
  game.state = 'play';
  $('hud').hidden = false;
  await story.start(i);
}
game.showCredits = () => {
  $('hud').hidden = true;
  $('credits').hidden = false;
  game.state = 'credits';
  store.set('maxChapter', CHAPTERS.length - 1);
};
game.toMenu = () => {
  story.stop();
  $('hud').hidden = true;
  $('pause').hidden = true;
  $('credits').hidden = true;
  $('menu').hidden = false;
  game.paused = false;
  game.state = 'menu';
  renderChapterList();
  story.menuScene();
};
$('playBtn').addEventListener('click', () => startChapter(0));
$('continueBtn').addEventListener('click', () => startChapter(store.get('maxChapter', 0)));
$('againBtn').addEventListener('click', () => startChapter(0));
$('pauseBtn').addEventListener('click', () => pause(true));
$('resumeBtn').addEventListener('click', () => pause(false));
$('restartBtn').addEventListener('click', () => {
  pause(false);
  startChapter(story.index);
});
$('menuBtn').addEventListener('click', () => game.toMenu());

function pause(on) {
  if (game.state !== 'play') return;
  game.paused = on;
  $('pause').hidden = !on;
  input.reset();
  if (!on) sfx.resume();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause(true);
});

// ---------- loop
let last = performance.now();
let booted = false;
let perfAcc = 0;
let perfN = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 0.1);
  input.poll();
  if (input.pausePressed && game.state === 'play') pause(!game.paused);
  else if (input.padStart && (game.state === 'menu' || game.state === 'credits')) startChapter(game.state === 'menu' ? store.get('maxChapter', 0) : 0);
  const sim = game.paused ? 0 : Math.min(dt, 0.05);
  if (!game.paused) {
    // game.fast > 1 fast-forwards the simulation (used by the automated play-through)
    for (let k = 0; k < (game.fast || 1); k++) {
      clock.tick(sim);
      story.update(sim);
    }
  }
  ui.update(game.paused ? 0 : dt, game.paused ? { advancePressed: false } : input, camera, game.player.pos);
  sfx.update(sim);
  if (game.gradePass) game.gradePass.uniforms.time.value = now / 1000;
  const renderTarget = game.composer;
  if (renderTarget) renderTarget.render(dt);
  else renderer.render(game.scene, camera);
  // adaptive resolution (off when a recorder steps frames on a fixed clock)
  perfAcc += dt;
  perfN++;
  if (perfAcc > 2.5 && !game.lockResolution) {
    const avg = perfAcc / perfN;
    const max = Math.min(window.devicePixelRatio || 1, QUALITY[qualityKey].pr);
    let next = pr;
    if (avg > 1 / 38 && pr > 0.75) next = Math.max(0.75, pr - 0.15);
    else if (avg < 1 / 55 && pr < max) next = Math.min(max, pr + 0.1);
    if (next !== pr) {
      pr = next;
      resize();
    }
    perfAcc = 0;
    perfN = 0;
  }
  if (!booted) {
    booted = true;
    $('loading').hidden = true;
    $('menu').hidden = false;
  }
}

buildPost();
resize();
syncSettings();
renderChapterList();
story.menuScene();
requestAnimationFrame(frame);

// Test hook for automated checks.
window.__brodna = game;
