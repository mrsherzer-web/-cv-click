import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { U, SUN_DIR, store } from './shared.js';
import { City } from './city.js';
import { Traffic } from './traffic.js';
import { Hero, SUITS } from './hero.js';
import { Player, FOOT, anchorRise } from './player.js';
import { CameraRig, CAMERA_MODES } from './camera.js';
import { Rings } from './rings.js';
import { Particles } from './particles.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { Cropper, fileToCanvas, dataURLToCanvas, canvasToDataURL, skinTone, defaultFace } from './face.js';

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches;

const CAMERA_LABELS = { chase: 'מאחור', pov: 'עיני הגיבור', selfie: 'סלפי' };
const QUALITY = {
  high: { post: true, maxPR: 2, label: 'גבוהה' },
  medium: { post: true, maxPR: 1.5, label: 'בינונית' },
  low: { post: false, maxPR: 1.2, label: 'חסכונית' },
};
const QUALITY_ORDER = ['high', 'medium', 'low'];

// ---------- renderer

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  $('loading').textContent = 'הדפדפן הזה לא מריץ WebGL, ולכן המשחק לא יכול לעלות. נסו בכרום או בספארי מעודכנים.';
  throw err;
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 12000);
scene.add(camera);

const sunLight = new THREE.DirectionalLight(new THREE.Color('#ffc48c'), Math.PI * 3.1);
sunLight.position.copy(SUN_DIR).multiplyScalar(100);
scene.add(sunLight);
scene.add(new THREE.HemisphereLight(new THREE.Color().setRGB(0.3, 0.37, 0.55), new THREE.Color().setRGB(0.16, 0.13, 0.12), Math.PI));

const city = new City(scene);
const traffic = new Traffic(scene);
const hero = new Hero(scene);
camera.add(hero.vm);
const player = new Player(city);
const rig = new CameraRig(camera, city);
const rings = new Rings(scene, city);
const particles = new Particles(scene);
const sfx = new Sfx();
const input = new Input({
  canvas: $('game'),
  stickZone: $('stickZone'),
  stickBase: $('stickBase'),
  stickKnob: $('stickKnob'),
  webBtn: $('webBtn'),
  boostBtn: $('boostBtn'),
});

// Web line: a thin cylinder stretched from the hand to the anchor.
const webMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0),
  new THREE.MeshBasicMaterial({ color: new THREE.Color(1.35, 1.35, 1.4) })
);
webMesh.frustumCulled = false;
webMesh.visible = false;
scene.add(webMesh);

// Soft blob shadow under the hero.
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 64;
{
  const g = shadowCanvas.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
}
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
);
scene.add(shadow);

// ---------- post-processing

const FXShader = {
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uFlash: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSpeed;
    uniform float uTime;
    uniform float uAspect;
    uniform float uFlash;
    varying vec2 vUv;
    float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
    void main() {
      vec2 d = vUv - 0.5;
      float r = length(d * vec2(uAspect, 1.0));
      float amt = uSpeed * 0.05 * smoothstep(0.12, 0.7, r);
      vec3 c = vec3(0.0);
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        c += texture2D(tDiffuse, vUv - d * amt * t).rgb;
      }
      c /= 8.0;
      float ang = atan(d.y, d.x * uAspect);
      float idx = floor((ang / 6.2831 + 0.5) * 300.0);
      float rnd = h11(idx * 1.7 + floor(uTime * 18.0) * 13.1);
      float streak = step(0.94, rnd) * smoothstep(0.38, 0.8, r) * uSpeed;
      c += vec3(1.0, 0.94, 0.86) * streak * 0.55;
      c += vec3(1.0, 0.75, 0.45) * uFlash;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = max(mix(vec3(l), c, 1.12), 0.0);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

let qualityKey = store.get('quality', isTouch ? 'medium' : 'high');
if (!QUALITY[qualityKey]) qualityKey = 'medium';
let pr = Math.min(window.devicePixelRatio || 1, QUALITY[qualityKey].maxPR);
let composer = null;
let fxPass = null;

function buildPost() {
  if (composer) {
    composer.dispose();
    composer = null;
    fxPass = null;
  }
  if (!QUALITY[qualityKey].post) return;
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 1.05));
  fxPass = new ShaderPass(FXShader);
  composer.addPass(fxPass);
  composer.addPass(new OutputPass());
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  if (composer) {
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const aspect = w / h;
  rig.portrait = aspect < 0.85;
  rig.baseFov = aspect < 0.8 ? 80 : aspect < 1.2 ? 74 : 66;
  if (fxPass) fxPass.uniforms.uAspect.value = aspect;
}

function setQuality(key) {
  qualityKey = key;
  store.set('quality', key);
  pr = Math.min(window.devicePixelRatio || 1, QUALITY[key].maxPR);
  buildPost();
  resize();
}

buildPost();
resize();
window.addEventListener('resize', resize);

// ---------- hero customisation

const ui = {
  menu: $('menu'),
  hud: $('hud'),
  pause: $('pause'),
  finish: $('finish'),
  fade: $('fade'),
  toast: $('toast'),
  reticle: $('reticle'),
  marker: $('ringMarker'),
  markerDist: $('ringDist'),
  speed: $('hudSpeed'),
  ringCount: $('ringCount'),
  raceTime: $('raceTime'),
  camLabel: $('camLabel'),
};

const cropper = new Cropper({ modal: $('crop'), canvas: $('cropCanvas'), zoom: $('cropZoom'), ok: $('cropOk'), cancel: $('cropCancel') });

let heroName = store.get('name', 'הגיבור');
let suitIndex = store.get('suit', 0);
if (!SUITS[suitIndex]) suitIndex = 0;
let hatOn = store.get('hat', true);
let faceURL = null;

function showFace(url) {
  faceURL = url;
  const css = url ? `url("${url}")` : '';
  for (const id of ['faceThumb', 'hudFace']) $(id).style.backgroundImage = css;
  $('faceCta').textContent = url ? 'החלפת תמונה' : 'בחירת תמונה';
  $('facePick').classList.toggle('has-face', !!url);
}

function applyFace(crop) {
  hero.setFace(crop, skinTone(crop));
  const url = canvasToDataURL(crop);
  showFace(url);
  store.set('face', url);
}

function applyName(name) {
  heroName = name.trim() || 'הגיבור';
  hero.setName(heroName);
  $('menuHeroName').textContent = heroName;
  $('hudName').textContent = heroName;
  store.set('name', heroName);
}

function applySuit(i) {
  suitIndex = i;
  hero.setSuit(SUITS[i]);
  document.querySelectorAll('.swatch').forEach((el, k) => el.setAttribute('aria-checked', String(k === i)));
  store.set('suit', i);
}

function applyHat(on) {
  hatOn = on;
  hero.setHat(on);
  $('hatToggle').checked = on;
  store.set('hat', on);
}

const swatches = $('suits');
SUITS.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', s.label);
  b.title = s.label;
  b.style.setProperty('--a', s.base);
  b.style.setProperty('--b', s.accent);
  b.addEventListener('click', () => applySuit(i));
  swatches.appendChild(b);
});

$('heroName').value = heroName;
$('heroName').addEventListener('input', (e) => applyName(e.target.value));
$('hatToggle').addEventListener('change', (e) => applyHat(e.target.checked));
$('facePick').addEventListener('click', () => $('faceFile').click());
$('faceFile').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const src = await fileToCanvas(file);
    const crop = await cropper.open(src);
    if (crop) applyFace(crop);
  } catch {
    toast('לא הצלחתי לפתוח את התמונה. נסו קובץ JPG או PNG.');
  }
});

applyName(heroName);
applySuit(suitIndex);
applyHat(hatOn);
showFace(null);
{
  const saved = store.get('face', null);
  if (saved) {
    dataURLToCanvas(saved)
      .then((c) => {
        hero.setFace(c, skinTone(c));
        showFace(saved);
      })
      .catch(() => hero.setFace(defaultFace(), null));
  }
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => hero.setName(heroName));

$('controlsHint').textContent = isTouch
  ? 'מחזיקים את כפתור הרשת כדי להתנדנד ומשחררים כדי לעוף. הג׳ויסטיק בצד שמאל מכוון, וזינוק מקפיץ קדימה.'
  : 'רווח (להחזיק): רשת · Shift: זינוק · חצים או WASD: כיוון · C: מצלמה · Esc: הפסקה';
document.body.classList.toggle('touch', isTouch);

// ---------- game state

let state = 'title';
const spawn = city.spawnPoint();
const ring1 = rings.items[0].pos;
const raceHeading = Math.atan2(ring1.x - spawn.x, ring1.z - spawn.z);
const sunHeading = Math.atan2(SUN_DIR.x, SUN_DIR.z);
player.spawn(spawn.x, spawn.y, spawn.z, sunHeading);
rings.setVisible(false);

let toastTimer = 0;
let lastToast = '';
let lastToastAt = -10;
let time = 0;

function toast(text) {
  if (text === lastToast && time - lastToastAt < 2.5) return;
  lastToast = text;
  lastToastAt = time;
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  toastTimer = 2.2;
}

function setCameraMode(mode) {
  rig.mode = mode;
  ui.camLabel.textContent = CAMERA_LABELS[mode];
  $('pauseCam').textContent = 'מצלמה: ' + CAMERA_LABELS[mode];
  store.set('camera', mode);
  hero.vm.visible = mode === 'pov' && state !== 'title';
  hero.root.visible = mode !== 'pov' || state === 'title';
  rig.reset(player);
}

function cycleCamera() {
  const i = CAMERA_MODES.indexOf(rig.mode);
  setCameraMode(CAMERA_MODES[(i + 1) % CAMERA_MODES.length]);
}

function startGame(fromSpawn = true) {
  sfx.init();
  sfx.resume();
  ui.menu.hidden = true;
  ui.pause.hidden = true;
  ui.finish.hidden = true;
  ui.hud.hidden = false;
  if (fromSpawn) {
    player.spawn(spawn.x, spawn.y, spawn.z, raceHeading);
    rings.reset();
  }
  rings.setVisible(true);
  state = 'play';
  input.reset();
  setCameraMode(store.get('camera', 'chase'));
  if (fromSpawn) rig.reset(player);
  toast(rings.finished ? 'מעוף חופשי' : 'עקבו אחרי עמוד האור אל הטבעת הראשונה');
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'paused';
  input.reset();
  ui.pause.hidden = false;
  $('pauseQuality').textContent = 'גרפיקה: ' + QUALITY[qualityKey].label;
  $('pauseSound').textContent = 'צליל: ' + (sfx.enabled ? 'פועל' : 'כבוי');
}

function resumeGame() {
  ui.pause.hidden = true;
  state = 'play';
  sfx.resume();
}

function backToMenu() {
  state = 'title';
  ui.pause.hidden = true;
  ui.finish.hidden = true;
  ui.hud.hidden = true;
  ui.menu.hidden = false;
  rings.setVisible(false);
  webMesh.visible = false;
  player.spawn(spawn.x, spawn.y, spawn.z, sunHeading);
  hero.vm.visible = false;
  hero.root.visible = true;
  sfx.wind(0);
}

$('playBtn').addEventListener('click', () => startGame(true));
$('pauseBtn').addEventListener('click', pauseGame);
$('camBtn').addEventListener('click', cycleCamera);
$('pauseResume').addEventListener('click', resumeGame);
$('pauseRestart').addEventListener('click', () => startGame(true));
$('pauseMenu').addEventListener('click', backToMenu);
$('pauseCam').addEventListener('click', cycleCamera);
$('pauseQuality').addEventListener('click', () => {
  const next = QUALITY_ORDER[(QUALITY_ORDER.indexOf(qualityKey) + 1) % QUALITY_ORDER.length];
  setQuality(next);
  $('pauseQuality').textContent = 'גרפיקה: ' + QUALITY[next].label;
});
$('pauseSound').addEventListener('click', () => {
  sfx.setEnabled(!sfx.enabled);
  store.set('sound', sfx.enabled);
  $('pauseSound').textContent = 'צליל: ' + (sfx.enabled ? 'פועל' : 'כבוי');
});
$('finishAgain').addEventListener('click', () => startGame(true));
$('finishFree').addEventListener('click', () => {
  ui.finish.hidden = true;
  state = 'play';
  toast('מעוף חופשי. העיר כולה שלכם.');
});
sfx.enabled = store.get('sound', true);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}

// ---------- per-frame helpers

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const camFwd = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
let webShot = 1;
let flash = 0;
let respawnT = -1;
let finishT = -1;
let anchorCheckAt = 0;
let predicted = null;
const predictedPos = new THREE.Vector3();

function handleEvents() {
  for (const e of player.events) {
    switch (e.type) {
      case 'web':
        sfx.thwip();
        webShot = 0;
        break;
      case 'release':
        sfx.release();
        break;
      case 'jump':
        sfx.jump();
        break;
      case 'land':
        if (e.impact > 10) {
          const k = Math.min(1, e.impact / 45);
          sfx.land(k);
          rig.kick(k * 0.6);
          tmpV.copy(player.pos);
          tmpV.y -= FOOT - 0.1;
          particles.burst(tmpV, Math.round(10 + 30 * k), 6 + 8 * k, [0.55, 0.5, 0.45], 0.7, 0.5, 2, 3, 2);
        }
        break;
      case 'boost':
        sfx.boost();
        webShot = 0;
        flash = Math.max(flash, 0.08);
        break;
      case 'miss':
        sfx.miss();
        toast(
          city.topAt(player.pos.x, player.pos.z) + 40 < player.pos.y
            ? 'גבוה מדי בשביל הרשת. צללו למטה, אל בין הבניינים.'
            : 'אין בניין בטווח. התקרבו לבניינים או לחצו זינוק.'
        );
        break;
      case 'splash':
        sfx.splash();
        tmpV.set(e.x, -1, e.z);
        particles.burst(tmpV, 60, 14, [0.75, 0.85, 0.95], 1.2, 0.8, 22, 0.5, 12);
        ui.fade.classList.add('on');
        respawnT = 0.8;
        toast('שפלאש! חוזרים לגג הקרוב');
        break;
    }
  }
  player.events.length = 0;
}

function updateWeb(dt) {
  let target = null;
  if (state !== 'title') {
    if (player.state === 'swing') target = player.anchor;
    else if (player.boostTime < 0.22) target = player.zipTarget;
  }
  if (!target) {
    webMesh.visible = false;
    return;
  }
  const pov = rig.mode === 'pov';
  const origin = hero.webOrigin(tmpV, pov);
  webShot += dt;
  const f = Math.min(1, webShot / 0.07);
  const dir = tmpV2.subVectors(target, origin);
  const len = dir.length();
  webMesh.position.copy(origin);
  webMesh.quaternion.setFromUnitVectors(Y_AXIS, dir.divideScalar(len || 1));
  const r = pov ? 0.014 : 0.045;
  webMesh.scale.set(r, len * f, r);
  webMesh.visible = true;
}

function updateShadow() {
  const p = player.pos;
  const ground = city.surfaceBelow(p.x, p.z, p.y - FOOT + 0.2);
  const h = p.y - FOOT - ground;
  if (ground < -1 || h > 30 || player.state === 'dead') {
    shadow.visible = false;
    return;
  }
  shadow.visible = true;
  shadow.position.set(p.x, ground + 0.04, p.z);
  shadow.scale.setScalar(1 + h * 0.03);
  shadow.material.opacity = Math.max(0, 1 - h / 30);
}

function placeOnScreen(world, out) {
  out.copy(world).project(camera);
  return out;
}

function updateOverlay() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Where the next web would land.
  if (state === 'play' && player.state === 'air') {
    if (time - anchorCheckAt > 0.1) {
      anchorCheckAt = time;
      const a = city.findAnchor(player.pos, player.fwdH(tmpV2), player.side, Math.hypot(player.vel.x, player.vel.z), anchorRise(player.pos.y));
      predicted = a ? predictedPos.copy(a) : null;
    }
  } else predicted = null;
  if (predicted && rig.mode !== 'selfie') {
    const s = placeOnScreen(predicted, tmpV);
    if (s.z < 1 && Math.abs(s.x) < 1 && Math.abs(s.y) < 1) {
      ui.reticle.hidden = false;
      ui.reticle.style.transform = `translate(${(s.x * 0.5 + 0.5) * w}px, ${(-s.y * 0.5 + 0.5) * h}px)`;
    } else ui.reticle.hidden = true;
  } else ui.reticle.hidden = true;

  // Next ring: marker on screen, or an arrow on the edge pointing to it.
  const rp = state === 'play' ? rings.nextPos : null;
  if (!rp) {
    ui.marker.hidden = true;
    return;
  }
  ui.marker.hidden = false;
  const s = placeOnScreen(rp, tmpV);
  let x = s.x;
  let y = s.y;
  const behind = s.z > 1;
  if (behind) {
    x = -x;
    y = -y;
  }
  const onScreen = !behind && Math.abs(x) < 0.88 && Math.abs(y) < 0.8;
  if (!onScreen) {
    const ang = Math.atan2(y, x);
    x = Math.cos(ang) * 0.86;
    // Keep clear of the on-screen buttons at the bottom of phones.
    y = Math.max(Math.sin(ang) * 0.78, isTouch ? -0.45 : -0.78);
    ui.marker.classList.add('edge');
    ui.marker.style.setProperty('--rot', `${-ang}rad`);
  } else ui.marker.classList.remove('edge');
  ui.marker.style.transform = `translate(${(x * 0.5 + 0.5) * w}px, ${(-y * 0.5 + 0.5) * h}px)`;
  ui.markerDist.textContent = Math.round(player.pos.distanceTo(rp)) + ' מ׳';
}

let hudAt = 0;
function updateHud() {
  if (time - hudAt < 0.1) return;
  hudAt = time;
  ui.speed.textContent = String(Math.round(player.vel.length() * 3.6));
  ui.ringCount.textContent = `${rings.next}/${rings.count}`;
  ui.raceTime.textContent = fmtTime(rings.time);
}

// Lower the resolution when frames get slow, raise it again when there is headroom.
let perfAcc = 0;
let perfFrames = 0;
function adaptResolution(dt) {
  perfAcc += dt;
  perfFrames++;
  if (perfAcc < 2) return;
  const avg = perfAcc / perfFrames;
  perfAcc = 0;
  perfFrames = 0;
  const maxPR = Math.min(window.devicePixelRatio || 1, QUALITY[qualityKey].maxPR);
  let next = pr;
  if (avg > 1 / 40 && pr > 0.7) next = Math.max(0.7, pr - 0.15);
  else if (avg < 1 / 56 && pr < maxPR) next = Math.min(maxPR, pr + 0.1);
  if (next !== pr) {
    pr = next;
    resize();
  }
}

// ---------- loop

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 0.1);
  const sim = Math.min(dt, 0.05);
  time += dt;
  U.uTime.value = time;
  input.poll();

  if (state === 'play') {
    if (input.pausePressed) pauseGame();
    if (input.camPressed) cycleCamera();
    camera.getWorldDirection(camFwd);
    player.update(sim, input, rig.yaw, camFwd);
    handleEvents();
    const ev = rings.update(sim, player, time);
    if (ev) {
      sfx.ring(ev.index);
      particles.burst(ev.pos, 50, 16, [2.4, 1.5, 0.5], 0.9, 0.9, 0, 2);
      flash = 0.18;
      if (ev.type === 'finish') {
        sfx.finish();
        const best = store.get('best', null);
        const isBest = best === null || ev.time < best;
        if (isBest) store.set('best', ev.time);
        $('finishTime').textContent = fmtTime(ev.time);
        $('finishBest').textContent = isBest ? 'שיא חדש!' : 'השיא שלך: ' + fmtTime(best);
        finishT = 0.9;
      } else toast(`טבעת ${ev.index + 1} מתוך ${rings.count}`);
    }
    if (respawnT > 0) {
      respawnT -= dt;
      if (respawnT <= 0) {
        const s = city.respawnNear(player.pos.x, player.pos.z);
        player.spawn(s.x, s.y, s.z, player.heading);
        rig.snap(player);
        ui.fade.classList.remove('on');
      }
    }
    if (finishT > 0) {
      finishT -= dt;
      if (finishT <= 0) {
        state = 'finish';
        ui.finish.hidden = false;
      }
    }
  }

  traffic.update(sim);
  particles.update(sim);
  city.update(time, camera);

  if (state === 'title') {
    hero.update(dt, player, 'title', camera, time);
    rig.updateTitle(dt, player);
  } else {
    hero.update(sim, player, rig.mode, camera, time);
    rig.update(dt, player, hero);
  }
  camera.updateMatrixWorld();
  hero.updateViewmodel(dt, player, camera);
  updateWeb(dt);
  updateShadow();
  sfx.wind(state === 'play' ? player.vel.length() : 0);
  if (state !== 'title') {
    updateOverlay();
    updateHud();
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) ui.toast.classList.remove('show');
  }

  flash *= Math.exp(-6 * dt);
  particles.setScale((renderer.domElement.height * 0.5) / Math.tan((camera.fov * Math.PI) / 360));
  if (composer) {
    const sp = state === 'play' ? THREE.MathUtils.smoothstep(player.vel.length(), 28, 80) : 0;
    fxPass.uniforms.uSpeed.value += (sp - fxPass.uniforms.uSpeed.value) * (1 - Math.exp(-4 * dt));
    fxPass.uniforms.uTime.value = time;
    fxPass.uniforms.uFlash.value = flash;
    composer.render(dt);
  } else renderer.render(scene, camera);
  adaptResolution(dt);

  if (!booted) {
    booted = true;
    $('loading').hidden = true;
    ui.menu.hidden = false;
  }
}
let booted = false;
requestAnimationFrame(frame);

// Test hook: lets automated checks read the game state.
window.__goldenHour = { player, rings, rig, city, startGame, setCameraMode, get state() { return state; } };
