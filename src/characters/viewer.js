// Character room: shows each cast member on a small stage so their looks can be reviewed on a phone.
import * as THREE from 'three';
import { makeCharacter } from './builder.js';
import { ROSTER, CAST_ORDER } from './roster.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const BG = new THREE.Color('#1b212b');
scene.background = BG;
scene.fog = new THREE.Fog(BG, 9, 30);
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 100);

// studio floor: a soft pool of light fading into the background
{
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grd.addColorStop(0, '#5a6372');
  grd.addColorStop(0.55, '#2d3440');
  grd.addColorStop(1, '#1b212b');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  floor.receiveShadow = true;
  scene.add(floor);
}
scene.add(new THREE.HemisphereLight('#dfe7ff', '#3b3128', 1.2));
const key = new THREE.DirectionalLight('#fff1dc', 2.5);
key.position.set(3, 6, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 4, bottom: -2, near: 1, far: 20 });
key.shadow.bias = -0.0005;
const rim = new THREE.DirectionalLight('#b9d0ff', 1.3);
rim.position.set(-4, 3, -5);
scene.add(key, rim);

const cast = CAST_ORDER.map((id) => {
  const c = makeCharacter(ROSTER[id]);
  scene.add(c.root);
  return c;
});

// ---------- selection, framing and orbit ----------
let selected = 'nehorai', speed = 0, yaw = 0, idle = 0, dragging = null, zoom = false;
const target = new THREE.Vector3();
let distance = 4;

// frame the subject inside the screen band left free by the card and the buttons
function fit(subjectH, subjectW, centerY) {
  const top = document.querySelector('.cv-top').getBoundingClientRect().bottom;
  const card = document.getElementById('card').getBoundingClientRect();
  const controls = document.querySelector('.cv-controls').getBoundingClientRect();
  const note = document.querySelector('.cv-note').getBoundingClientRect().top;
  const coversCenter = (r) => r.left < innerWidth / 2 + 90 && r.right > innerWidth / 2 - 90;
  const bandTop = Math.max(top, coversCenter(card) ? card.bottom : top) + 8;
  const bandBottom = (coversCenter(controls) ? controls.top : note) - 8; // in landscape the buttons sit at the side
  const bandH = Math.max(120, bandBottom - bandTop);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const worldH = Math.max((subjectH * innerHeight) / bandH, (subjectW * innerHeight) / (innerWidth * 0.92));
  distance = worldH / (2 * tanV);
  target.y = centerY + (((bandTop + bandBottom) / 2 - innerHeight / 2) * worldH) / innerHeight;
}

function layout() {
  const portrait = innerWidth < innerHeight;
  if (selected === 'all') {
    const cols = portrait ? 3 : cast.length;
    cast.forEach((c, i) => {
      const row = Math.floor(i / cols), col = i % cols, n = Math.min(cols, cast.length - row * cols);
      c.root.position.set((col - (n - 1) / 2) * 1.05, 0, -row * 1.6);
      c.root.visible = true;
    });
    const rows = Math.ceil(cast.length / cols);
    target.set(0, 0, -(rows - 1) * 0.8);
    fit(2.2 + (rows - 1) * 0.7, cols * 1.05 + 0.5, 0.95 + (rows - 1) * 0.3);
  } else {
    cast.forEach((c) => { c.root.position.set(0, 0, 0); c.root.visible = c.spec.id === selected; });
    target.set(0, 0, 0);
    if (zoom) fit(0.48, 0.48, 1.67); else fit(2.15, 1.2, 0.95);
  }
}

function select(id) {
  selected = id;
  if (id === 'all' && zoom) { zoom = false; document.getElementById('zoomBtn').setAttribute('aria-pressed', 'false'); }
  yaw = 0;
  idle = 0;
  for (const b of document.querySelectorAll('#cast button')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
  const spec = ROSTER[id];
  document.getElementById('cvName').textContent = spec ? spec.name : 'כל החבורה';
  document.getElementById('cvLook').textContent = spec ? spec.look : 'נהוראי, אברהם, יונתי, ארז, מולר ודולב, זה לצד זה.';
  layout(); // after the card text, since the card's height decides the free space
}

const castEl = document.getElementById('cast');
for (const id of [...CAST_ORDER, 'all']) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.id = id;
  b.textContent = id === 'all' ? 'כולם' : ROSTER[id].name.split(' ')[0];
  b.addEventListener('click', () => select(id));
  castEl.appendChild(b);
}
const zoomBtn = document.getElementById('zoomBtn');
zoomBtn.addEventListener('click', () => {
  zoom = !zoom;
  zoomBtn.setAttribute('aria-pressed', String(zoom));
  if (zoom && selected === 'all') select('nehorai'); else layout();
});
for (const b of document.querySelectorAll('[data-move]')) {
  b.addEventListener('click', () => {
    speed = Number(b.dataset.move);
    for (const o of document.querySelectorAll('[data-move]')) o.setAttribute('aria-pressed', String(o === b));
  });
}

canvas.addEventListener('pointerdown', (e) => { dragging = { id: e.pointerId, x: e.clientX }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging || e.pointerId !== dragging.id) return;
  yaw -= (e.clientX - dragging.x) * 0.01;
  dragging.x = e.clientX;
  idle = 0;
});
const release = (e) => { if (dragging && e.pointerId === dragging.id) dragging = null; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
document.addEventListener('touchmove', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  layout();
}
addEventListener('resize', resize);

// where the visible characters land on screen (CSS px from the top), for checking that nothing covers them
const box = new THREE.Box3(), corner = new THREE.Vector3();
function screenBounds() {
  box.makeEmpty();
  for (const c of cast) if (c.root.visible) box.expandByObject(c.root);
  let top = Infinity, bottom = -Infinity;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    const y = ((1 - corner.y) / 2) * innerHeight;
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return { top, bottom };
}

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  idle += dt;
  if (!dragging && idle > 2.5) yaw += dt * 0.35; // slow turntable when untouched
  for (const c of cast) if (c.root.visible) c.animate(dt, speed, 6.2);
  camera.position.set(target.x + Math.sin(yaw) * distance, target.y + 0.1, target.z + Math.cos(yaw) * distance);
  camera.lookAt(target);
  renderer.render(scene, camera);
}

resize();
select('nehorai');
frame();
window.__viewer = {
  select,
  turn(a) { yaw = a; idle = 0; },
  get state() { return { selected, speed, zoom, yaw, visible: cast.filter((c) => c.root.visible).map((c) => c.spec.id), bounds: screenBounds() }; },
};
