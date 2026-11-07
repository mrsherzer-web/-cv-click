// Effects for chapter eight: explosions (a fireball, smoke, sparks, debris, a flash of light, the
// camera jolted, a boom), fires that keep burning, columns of smoke. Everything is drawn from two
// pools of point sprites (one additive for fire and sparks, one plain for smoke), a small instanced
// mesh for debris and one point light that the latest blast borrows, so a battle with a dozen
// explosions costs a handful of draw calls. The pools are rings: when they are full the oldest
// particle is reused. Stylised: fire and smoke, no gore, and a blast in play never hurts without the
// warning the mission gives first.
// Chapter nine's weather and emergencies live here too: rain (streaks drawn around the camera by one
// shader-driven mesh, splashes from a small sprite pool, the light darker and bluer, its sound) and red
// alert (two pooled red lamps that flash in an area, the ambient light and the screen's edges tinted red).
// Both are made on first use, taken out of the scene when off, and cost two draw calls at most.
import * as THREE from 'three';
import { install as installOverlay } from '../ui/overlay.js';

const UP = new THREE.Vector3(0, 1, 0);

function discTexture(soft = true) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(soft ? 0.35 : 0.6, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = `
attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
varying vec3 vC; varying float vA; uniform float uScale;
void main() { vC = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / max(0.6, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG = `
uniform sampler2D uTex; varying vec3 vC; varying float vA;
void main() { vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.01) discard; }`;

// a ring of point sprites with a velocity, a life, a size that grows, and a colour that fades
class Pool {
  constructor(scene, cap, { additive, texture }) {
    this.cap = cap; this.n = 0; this.head = 0;
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap); this.alpha = new Float32Array(cap);
    this.life = new Float32Array(cap); this.max = new Float32Array(cap); this.grow = new Float32Array(cap);
    this.grav = new Float32Array(cap); this.drag = new Float32Array(cap); this.a0 = new Float32Array(cap); this.size0 = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uTex: { value: texture }, uScale: { value: 300 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 12 : 11;
    scene.add(this.points);
    this.geo = geo;
  }
  spawn(x, y, z, vx, vy, vz, { life = 1, size = 1, grow = 0, color = [1, 1, 1], alpha = 1, grav = 0, drag = 0 }) {
    const i = this.head; this.head = (this.head + 1) % this.cap; if (this.n < this.cap) this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = color[0]; this.col[i * 3 + 1] = color[1]; this.col[i * 3 + 2] = color[2];
    this.size[i] = size; this.size0[i] = size; this.alpha[i] = alpha; this.a0[i] = alpha;
    this.life[i] = life; this.max[i] = life; this.grow[i] = grow; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]); // 1 at birth, 0 at death
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 2] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.alpha[i] = this.a0[i] * (k < 0.3 ? k / 0.3 : 1) * (k > 0.9 ? (1 - k) / 0.1 + 0.4 : 1);
      if (this.life[i] > 0) alive++;
    }
    this.geo.setDrawRange(0, this.n);
    for (const a of ['position', 'aColor', 'aSize', 'aAlpha']) this.geo.getAttribute(a).needsUpdate = true;
    return alive;
  }
  clear() { this.n = 0; this.head = 0; this.life.fill(0); this.alpha.fill(0); this.geo.setDrawRange(0, 0); }
}

// bits that fly out of a blast and tumble down
class Debris {
  constructor(scene, cap) {
    this.cap = cap; this.head = 0;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.18, 0.28), new THREE.MeshStandardMaterial({ color: '#3a3632', roughness: 0.9 }), cap);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    scene.add(this.mesh);
    this.pos = new Float32Array(cap * 3); this.vel = new Float32Array(cap * 3); this.rot = new Float32Array(cap * 3); this.spin = new Float32Array(cap * 3); this.life = new Float32Array(cap); this.scale = new Float32Array(cap);
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    for (let i = 0; i < cap; i++) this.hide(i);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  hide(i) { this.life[i] = 0; this.s.set(0.001, 0.001, 0.001); this.m.compose(this.v.set(0, -100, 0), this.q.identity(), this.s); this.mesh.setMatrixAt(i, this.m); }
  spawn(x, y, z, vx, vy, vz, scale = 1) {
    const i = this.head; this.head = (this.head + 1) % this.cap;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.rot.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3); this.spin.set([(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12], i * 3);
    this.life[i] = 2.2 + Math.random(); this.scale[i] = scale;
  }
  update(dt, groundAt) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= 14 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const g = groundAt(this.pos[i * 3], this.pos[i * 3 + 2]);
      if (this.pos[i * 3 + 1] < g + 0.08) { this.pos[i * 3 + 1] = g + 0.08; this.vel[i * 3 + 1] *= -0.25; this.vel[i * 3] *= 0.6; this.vel[i * 3 + 2] *= 0.6; this.spin[i * 3] *= 0.5; this.spin[i * 3 + 2] *= 0.5; }
      this.rot[i * 3] += this.spin[i * 3] * dt; this.rot[i * 3 + 1] += this.spin[i * 3 + 1] * dt; this.rot[i * 3 + 2] += this.spin[i * 3 + 2] * dt;
      if (this.life[i] <= 0) { this.hide(i); continue; }
      const s = this.scale[i] * Math.min(1, this.life[i] * 2);
      this.e.set(this.rot[i * 3], this.rot[i * 3 + 1], this.rot[i * 3 + 2]); this.q.setFromEuler(this.e);
      this.m.compose(this.v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]), this.q, this.s.set(s, s, s));
      this.mesh.setMatrixAt(i, this.m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);
const dir = () => { const u = Math.random() * 2 - 1, p = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); return [r * Math.cos(p), u, r * Math.sin(p)]; };

// rain: every drop is a thin quad between its head and its tail, placed by the shader from a seed, the
// time and the camera, so the CPU only sets a few uniforms a frame. The drops stay put in the world while
// the box they wrap in follows the camera; they fade toward the box's edges and right in front of the lens.
const RAIN_VERT = `
attribute vec3 aSeed; attribute vec3 aCorner;
uniform vec3 uBox, uShift, uCam, uVel; uniform vec2 uRes; uniform float uLen, uPx, uFloor, uAlpha;
varying float vA;
void main() {
  vec3 local = mod(aSeed * uBox + uShift, uBox) - 0.5 * uBox;
  vec3 head = uCam + local;
  vec3 tail = head - uVel * uLen * (0.6 + 0.8 * aCorner.z);
  vec4 hv = viewMatrix * vec4(head, 1.0), tv = viewMatrix * vec4(tail, 1.0);
  float near = min(-hv.z, -tv.z);
  vec4 hc = projectionMatrix * hv, tc = projectionMatrix * tv;
  vec2 d = (tc.xy / max(tc.w, 0.01) - hc.xy / max(hc.w, 0.01)) * uRes;
  float l = length(d);
  vec2 n = l > 0.001 ? vec2(-d.y, d.x) / l : vec2(1.0, 0.0);
  vec4 c = aCorner.y > 0.5 ? tc : hc;
  c.xy += n * aCorner.x * uPx / uRes * c.w;
  gl_Position = near < 0.3 ? vec4(2.0, 2.0, 2.0, 1.0) : c;
  float r = length(local.xz) / (0.5 * uBox.x);
  vA = uAlpha * (1.0 - smoothstep(0.6, 1.0, r)) * smoothstep(0.3, 1.8, near) * step(uFloor, head.y) * (0.55 + 0.45 * aCorner.z) * (1.0 - 0.8 * aCorner.y);
}`;
const RAIN_FRAG = `
uniform vec3 uColor; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(uColor, vA); }`;
const RAIN_DROPS = 2600;          // at strength 1; a lighter rain draws fewer
const RAIN_BOX = [28, 18, 28];    // metres around the camera

class Rain {
  constructor(tex) {
    const N = RAIN_DROPS, seed = new Float32Array(N * 12), corner = new Float32Array(N * 12), index = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) {
      const sx = Math.random(), sy = Math.random(), sz = Math.random(), r = Math.random();
      for (let k = 0; k < 4; k++) {
        const v = i * 4 + k;
        seed.set([sx, sy, sz], v * 3);
        corner.set([k % 2 ? 1 : -1, k < 2 ? 0 : 1, r], v * 3);
      }
      index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 12), 3)); // unused: the shader places the drops
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
    geo.setAttribute('aCorner', new THREE.BufferAttribute(corner, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.setDrawRange(0, 0);
    this.u = {
      uBox: { value: new THREE.Vector3(...RAIN_BOX) }, uShift: { value: new THREE.Vector3() }, uCam: { value: new THREE.Vector3() },
      uVel: { value: new THREE.Vector3(1.2, -11, 0.6) }, uRes: { value: new THREE.Vector2(1, 1) },
      uLen: { value: 0.07 }, uPx: { value: 1.6 }, uFloor: { value: -1e4 }, uAlpha: { value: 0.3 }, uColor: { value: new THREE.Color('#c9d3e0') },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.u, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, depthTest: true });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 10; this.mesh.name = 'rain';
    this.geo = geo;
    this.t = 0;
    this.px = 1;
    const box = this.u.uBox.value, size = new THREE.Vector2();
    // just before the draw: the box around whichever camera draws (the main view or the video call's)
    this.mesh.onBeforeRender = (renderer, scene, camera) => {
      renderer.getDrawingBufferSize(size); this.u.uRes.value.copy(size);
      this.u.uPx.value = 1.5 * this.px;
      const c = this.u.uCam.value.set(camera.position.x, camera.position.y + box.y * 0.2, camera.position.z), v = this.u.uVel.value;
      const wrap = (a, b) => ((a % b) + b) % b;
      this.u.uShift.value.set(wrap(v.x * this.t - c.x + box.x / 2, box.x), wrap(v.y * this.t - c.y + box.y / 2, box.y), wrap(v.z * this.t - c.z + box.z / 2, box.z));
    };
    // splashes on the ground near the player: a puff and a couple of drops thrown up
    this.splash = new Pool({ add() {} }, 220, { additive: false, texture: tex });
    this.splash.points.name = 'rain-splash';
    this.acc = 0;
  }
  dispose() { this.geo.dispose(); this.mat.dispose(); this.splash.geo.dispose(); this.splash.mat.dispose(); }
}

export class Fx {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.tex = discTexture(true);
    this.fire = new Pool(scene, 520, { additive: true, texture: this.tex });
    this.smoke = new Pool(scene, 420, { additive: false, texture: this.tex });
    this.debris = new Debris(scene, 48);
    this.flash = new THREE.PointLight('#ffb070', 0, 46, 1.5);
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashT = 0;
    this.burning = [];      // { x, y, z, r, strength, left, acc, smokeAcc }
    this.pixelRatio = 1;
    this.active = 0;
    this.booms = 0;
    this.rainFx = null;     // made on the first rain: { mesh, splash, ... }
    this.rainOn = { target: 0, level: 0, rate: 1, strength: 1, under: null, sheltered: false, inScene: false, sent: null, light: null };
    this.alerts = new Map(); // id -> an area in red alert
    this.alertLights = [];  // the two red lamps the areas share (made on first use)
    this.alertIn = 0;       // how far the player is inside an alert, eased
    this.alertT = 0;
    installOverlay(game);   // game.overlay: the daze, the lids, the covered map, the flash, the red edges
  }

  // ---------- rain ----------

  // rain around the camera: on/off, `strength` 0.2..1.5 (drops, streak length and the sound follow it),
  // `wind` { x, z } in m/s, `under(x, z, y)` → true where there is a roof (no streaks there, the sound
  // muffled), `seconds` to come and go. The light turns darker and bluer while it rains.
  rain(on = true, { strength = 1, wind = null, under, seconds = 1.5 } = {}) {
    const R = this.rainOn;
    if (on && !this.rainFx) this.rainFx = new Rain(this.tex);
    R.target = on ? Math.max(0.05, Math.min(1.5, strength)) : 0;
    R.rate = seconds > 0 ? 1 / seconds : Infinity;
    if (under !== undefined) R.under = typeof under === 'function' ? under : null;
    if (!on && !(seconds > 0)) R.level = 0;
    if (on) {
      const F = this.rainFx, k = Math.min(1, R.target);
      F.u.uVel.value.set(wind?.x ?? 1.2, -(9.5 + 2.5 * k), wind?.z ?? 0.6);
      F.u.uLen.value = 0.05 + 0.03 * R.target;
    }
    this.rainSync(true);
    if (!on && R.level === 0) this.rainScene(false);
    return R.target;
  }
  get raining() { return this.rainOn.target > 0; }
  get rainLevel() { return this.rainOn.level; }
  // the scene graph, the light and the sound follow the rain's state
  rainScene(want) {
    const R = this.rainOn, F = this.rainFx;
    if (!F || R.inScene === want) return;
    R.inScene = want;
    if (want) this.game.scene.add(F.mesh, F.splash.points);
    else { this.game.scene.remove(F.mesh, F.splash.points); F.splash.clear(); F.geo.setDrawRange(0, 0); }
  }
  rainSync(force = false) {
    const R = this.rainOn, g = this.game;
    const light = R.target > 0 ? Math.min(1, R.target) : 0;
    if (g.daylight && (force || R.light !== light)) { R.light = light; g.daylight.setWeather(light, light > 0 ? 3 : 2); }
    const sound = `${R.target}:${R.sheltered}`;
    if (g.sound && (force || R.sent !== sound)) { R.sent = sound; g.sound.rain(R.target, { muffled: R.sheltered }); }
  }
  updateRain(dt) {
    const R = this.rainOn, F = this.rainFx, g = this.game;
    if (!F || (R.target === 0 && R.level === 0)) return;
    const p = g.pos;
    R.sheltered = !!R.under && !!R.under(p.x, p.z, p.y);
    const want = R.sheltered ? 0 : R.target;
    if (R.level !== want) { const s = R.rate * dt; R.level = R.level < want ? Math.min(want, R.level + s) : Math.max(want, R.level - s); }
    this.rainSync();
    if (R.level <= 0 && R.target === 0) { this.rainScene(false); return; }
    this.rainScene(true);
    const k = Math.min(1, R.level), night = g.daylight?.night ?? 0;
    F.t += dt; F.px = this.pixelRatio;
    F.geo.setDrawRange(0, Math.round(RAIN_DROPS * k) * 6);
    F.mesh.visible = k > 0.002; // under a roof: no draw at all
    F.u.uAlpha.value = (0.22 + 0.12 * Math.min(1.5, R.level)) * (night > 0.5 ? 0.85 : 1);
    F.u.uColor.value.setRGB(0.79 - 0.24 * night, 0.83 - 0.22 * night, 0.88 - 0.16 * night);
    F.u.uFloor.value = p.y - 0.4; // nothing falls through the floor he stands on
    // splashes ahead of him, where the camera looks
    const cam = g.camera.position, fx0 = p.x - cam.x, fz0 = p.z - cam.z, fl = Math.hypot(fx0, fz0) || 1, ax = p.x + (fx0 / fl) * 4, az = p.z + (fz0 / fl) * 4;
    F.acc += dt * 120 * k;
    let tries = 0;
    while (F.acc >= 1 && tries++ < 12) {
      F.acc -= 1;
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 9, x = ax + Math.cos(a) * rr, z = az + Math.sin(a) * rr;
      const y = g.world.groundHeight(x, z, p.y + 0.6);
      if (!(Math.abs(y - p.y) < 2.5) || (R.under && R.under(x, z, y))) continue;
      const c = 0.78 - 0.25 * night;
      F.splash.spawn(x, y + 0.03, z, 0, 0, 0, { life: rnd(0.2, 0.32), size: rnd(0.1, 0.16), grow: 0.9, color: [c, c + 0.04, c + 0.1], alpha: 0.5, grav: 0, drag: 0 });
      if (Math.random() < 0.5) for (let j = 0; j < 2; j++) F.splash.spawn(x, y + 0.04, z, rnd(-0.6, 0.6), rnd(0.9, 1.6), rnd(-0.6, 0.6), { life: rnd(0.18, 0.28), size: 0.045, grow: 0, color: [c, c + 0.04, c + 0.1], alpha: 0.7, grav: 9, drag: 0 });
    }
    if (F.acc > 4) F.acc = 0;
    F.splash.points.visible = F.splash.update(dt) > 0;
  }

  // a flash of lightning far off (in the rain at night): the screen goes pale for a moment, thunder follows
  lightning({ delay = 1.4, strength = 0.5 } = {}) {
    this.game.overlay?.flash('#dfe7ff', 520, 0.28 * strength + 0.1);
    setTimeout(() => this.game.sound?.boom?.(0.25 + 0.35 * strength), delay * 1000);
  }

  // ---------- red alert ----------

  // an area in emergency light: a red lamp that flashes (two lamps in all, shared by every area, the ones
  // nearest the player), and while he is inside it the ambient light and the screen's edges go red.
  // `at` { x, z, y? } the centre, `r` its reach; `points` [{ x, z, y? }] where the lamps hang (default two,
  // either side of the centre, flashing in turn); `mats` materials whose glow flashes with them (lamp
  // meshes); `id` names the area (another call with the same id moves it). redAlert(false) ends them all,
  // redAlert(false, { id }) one.
  redAlert(on = true, { at, r = 26, id = 'alert', points, mats, color = '#ff2414', rate = 1.2, intensity = 70, height = 3.2 } = {}) {
    if (!on) {
      const only = arguments[1]?.id; // off with an id: that area; off alone: all of them
      for (const [k, A] of this.alerts) if (only === undefined || k === only) { for (const m of A.mats) m.mat.emissiveIntensity = m.base; this.alerts.delete(k); }
      if (!this.alerts.size) this.alertLamps(false);
      return null;
    }
    const g = this.game, c = at || g.pos, y = c.y ?? g.world.groundHeight(c.x, c.z);
    const old = this.alerts.get(id);
    if (old) for (const m of old.mats) m.mat.emissiveIntensity = m.base;
    const beacons = (points?.length ? points : [{ x: c.x - r * 0.3, z: c.z }, { x: c.x + r * 0.3, z: c.z }])
      .map((q, i) => ({ x: q.x, z: q.z, y: (q.y ?? y) + (q.y === undefined ? height : 0), phase: i % 2 ? Math.PI : 0 }));
    const A = { id, x: c.x, z: c.z, y, r, beacons, color: new THREE.Color(color), rate, intensity, mats: (mats || []).filter(Boolean).map((mat) => ({ mat, base: mat.emissiveIntensity ?? 1 })) };
    this.alerts.set(id, A);
    this.alertLamps(true);
    return A;
  }
  get redAlertOn() { return this.alerts.size > 0; }
  alertLamps(want) {
    const scene = this.game.scene;
    if (want && !this.alertLights.length) for (let i = 0; i < 2; i++) { const l = new THREE.PointLight('#ff2414', 0, 30, 1.3); l.castShadow = false; l.name = 'red-alert'; this.alertLights.push(l); }
    for (const l of this.alertLights) { if (want && !l.parent) scene.add(l); if (!want && l.parent) { l.intensity = 0; scene.remove(l); } }
  }
  updateAlert(dt) {
    const g = this.game;
    if (!this.alerts.size && this.alertIn === 0) return;
    this.alertT += dt;
    const p = g.pos, t = this.alertT, flash = (A, ph) => Math.pow(0.5 + 0.5 * Math.sin(Math.PI * 2 * A.rate * t + ph), 3);
    let inside = 0, near = null, best = Infinity;
    const cands = [];
    for (const A of this.alerts.values()) {
      const d = Math.hypot(p.x - A.x, p.z - A.z);
      inside = Math.max(inside, Math.min(1, Math.max(0, (A.r + 3 - d) / 6)));
      if (d < best) { best = d; near = A; }
      for (const b of A.beacons) cands.push({ b, A, d: Math.hypot(p.x - b.x, p.z - b.z) + Math.abs(p.y - b.y) });
      const f = flash(A, 0);
      for (const m of A.mats) m.mat.emissiveIntensity = m.base * (0.2 + 1.8 * f);
    }
    cands.sort((a, b) => a.d - b.d);
    this.alertLights.forEach((l, i) => {
      const q = cands[i];
      if (!q) { l.intensity = 0; return; }
      l.position.set(q.b.x, q.b.y, q.b.z);
      l.color.copy(q.A.color);
      l.distance = Math.max(16, q.A.r * 1.15);
      l.intensity = q.A.intensity * (0.06 + 0.94 * flash(q.A, q.b.phase));
    });
    const k = this.alerts.size ? inside : 0;
    this.alertIn += (k - this.alertIn) * Math.min(1, dt * 4);
    if (Math.abs(this.alertIn - k) < 0.005) this.alertIn = k;
    g.daylight?.setAlert(this.alertIn * 0.85);
    g.overlay?.alert(this.alertIn * (near ? 0.3 + 0.7 * flash(near, 0) : 0.3));
  }

  // everything chapter nine lays over a scene, off at once (a mission's cleanup): rain, red alert, the
  // screen layers, the music, the heartbeat, Nehorai's slow walk
  resetAtmosphere() {
    this.rain(false, { seconds: 0 });
    this.redAlert(false);
    this.alertIn = 0;
    this.game.daylight?.setAlert(0);
    this.game.daylight?.setWeather(0, 0);
    this.game.overlay?.clear();
    this.game.sound?.quiet?.();
    if (this.game.player) this.game.player.speedScale = 1;
  }

  // a blast at (x, y, z): size 1 is a car, 3 a building front; `fire` keeps flames for that many seconds
  // `flash`: true (or a colour) also flashes the screen when Nehorai is close (a big blast)
  explode(x, y, z, { size = 1, light = true, shake = true, sound = true, fire = 0, debris = true, flash = false } = {}) {
    const s = Math.max(0.3, size), g = this.game;
    const sq = Math.sqrt(s);
    for (let i = 0; i < Math.round(30 * sq); i++) { const d = dir(), v = rnd(3, 9) * sq; this.fire.spawn(x + d[0] * 0.4 * s, y + 0.3 + Math.abs(d[1]) * 0.4, z + d[2] * 0.4 * s, d[0] * v, Math.abs(d[1]) * v * 0.9 + 2.5, d[2] * v, { life: rnd(0.45, 1.0), size: rnd(1.2, 2.2) * s, grow: 2.4 * s, color: [1, rnd(0.55, 0.85), rnd(0.15, 0.4)], alpha: 0.95, grav: -1.5, drag: 2.2 }); }
    for (let i = 0; i < Math.round(22 * sq); i++) { const d = dir(), v = rnd(1.5, 4) * sq; const c = rnd(0.16, 0.36); this.smoke.spawn(x + d[0] * 0.6 * s, y + 0.8 + Math.abs(d[1]), z + d[2] * 0.6 * s, d[0] * v, Math.abs(d[1]) * v * 0.6 + rnd(1.5, 3), d[2] * v, { life: rnd(1.8, 3.6), size: rnd(1.6, 2.6) * s, grow: 1.6 * s, color: [c, c, c], alpha: 0.55, grav: -0.5, drag: 1.3 }); }
    for (let i = 0; i < Math.round(18 * sq); i++) { const d = dir(), v = rnd(8, 18) * sq; this.fire.spawn(x, y + 0.6, z, d[0] * v, Math.abs(d[1]) * v + 3, d[2] * v, { life: rnd(0.5, 1.3), size: rnd(0.22, 0.36), grow: -0.1, color: [1, rnd(0.6, 0.85), 0.3], alpha: 1, grav: 12, drag: 0.6 }); }
    if (debris) for (let i = 0; i < Math.round(8 * sq); i++) { const d = dir(), v = rnd(5, 12) * sq; this.debris.spawn(x, y + 0.5, z, d[0] * v, Math.abs(d[1]) * v + 4, d[2] * v, rnd(0.6, 1.4) * sq); }
    if (light) { this.flash.position.set(x, y + 1.2 + s * 0.6, z); this.flash.intensity = 60 * s; this.flash.distance = 30 + 16 * s; this.flash.visible = true; this.flashT = 0; }
    if (fire > 0) this.burn(x, y, z, { r: 0.8 * s, strength: Math.min(2, s), seconds: fire });
    const cam = g.camera.position, d = Math.hypot(cam.x - x, cam.y - y, cam.z - z);
    if (shake) { const k = Math.max(0, Math.min(1.4, 1.5 * s * (1 - d / 70))); if (k > 0.02) { g.follow?.shake(k); g.carCam?.shake(k); } }
    if (sound) g.sound?.boom?.(Math.max(0.08, Math.min(1.4, s * (1 - d / 220))));
    if (flash) { const k = Math.min(0.9, (1.1 - d / 70) * (0.5 + 0.2 * s)); if (k > 0.05) g.overlay?.flash(typeof flash === 'string' ? flash : '#fff3dc', 260 + 140 * s, k); }
    this.booms++;
    return { x, y, z, size: s };
  }

  // flames that keep burning for a while (a wrecked car, a doorway, a drum)
  burn(x, y, z, { r = 1.0, strength = 1, seconds = 20 } = {}) {
    const b = { x, y, z, r, strength, left: seconds, acc: 0, smokeAcc: 0, on: true, stop() { this.on = false; this.left = 0; } };
    this.burning.push(b);
    return b;
  }
  // a column of smoke without flames (a vent, a chimney after a blast)
  smokeColumn(x, y, z, { r = 0.8, strength = 1, seconds = 20 } = {}) {
    const b = this.burn(x, y, z, { r, strength, seconds }); b.smokeOnly = true; return b;
  }
  // a short shower of sparks (a cut cable, a hit panel)
  sparks(x, y, z, n = 14) { for (let i = 0; i < n; i++) { const d = dir(), v = rnd(2, 6); this.fire.spawn(x, y, z, d[0] * v, Math.abs(d[1]) * v + 1, d[2] * v, { life: rnd(0.3, 0.8), size: 0.16, grow: -0.08, color: [1, 0.85, 0.45], alpha: 1, grav: 9, drag: 0.5 }); } }
  // a puff of dust where something lands (a beam, rubble)
  dust(x, y, z, size = 1) { for (let i = 0; i < 12 * size; i++) { const d = dir(), v = rnd(1, 3) * size; const c = rnd(0.5, 0.68); this.smoke.spawn(x + d[0] * 0.6 * size, y + 0.2, z + d[2] * 0.6 * size, d[0] * v, Math.abs(d[1]) * 1.2 + 0.6, d[2] * v, { life: rnd(0.8, 1.6), size: rnd(0.8, 1.4) * size, grow: 1.4, color: [c, c * 0.95, c * 0.85], alpha: 0.5, grav: 0.2, drag: 2 }); } }
  // a warning ring on the ground (where a blast is about to go off)
  ring(x, y, z, r = 5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(Math.max(0.3, r - 0.35), r, 40), new THREE.MeshBasicMaterial({ color: '#ff3b3b', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 3;
    this.game.scene.add(m);
    return m;
  }
  clear() { this.fire.clear(); this.smoke.clear(); this.burning = []; this.flash.visible = false; }

  update(dt, camera) {
    const fov = camera?.fov ?? 60, h = (typeof innerHeight === 'number' ? innerHeight : 390) * this.pixelRatio;
    const scale = h * 0.5 / Math.tan((fov * Math.PI) / 360);
    this.fire.mat.uniforms.uScale.value = scale; this.smoke.mat.uniforms.uScale.value = scale;
    for (let i = this.burning.length - 1; i >= 0; i--) {
      const b = this.burning[i];
      b.left -= dt; if (b.left <= 0 || !b.on) { this.burning.splice(i, 1); continue; }
      const fade = Math.min(1, b.left / 3);
      if (!b.smokeOnly) { b.acc += dt * 16 * b.strength * fade; while (b.acc >= 1) { b.acc -= 1; const a = Math.random() * Math.PI * 2, rr = Math.random() * b.r; this.fire.spawn(b.x + Math.cos(a) * rr, b.y + 0.1, b.z + Math.sin(a) * rr, rnd(-0.4, 0.4), rnd(1.4, 2.8), rnd(-0.4, 0.4), { life: rnd(0.5, 0.9), size: rnd(0.7, 1.3) * Math.max(0.5, b.strength), grow: 0.6, color: [1, rnd(0.45, 0.75), rnd(0.1, 0.3)], alpha: 0.9, grav: -2.5, drag: 1.5 }); } }
      b.smokeAcc += dt * (b.smokeOnly ? 9 : 6) * b.strength * fade; while (b.smokeAcc >= 1) { b.smokeAcc -= 1; const a = Math.random() * Math.PI * 2, rr = Math.random() * b.r, c = rnd(0.2, 0.4); this.smoke.spawn(b.x + Math.cos(a) * rr, b.y + (b.smokeOnly ? 0.3 : 1.2), b.z + Math.sin(a) * rr, rnd(-0.5, 0.5), rnd(1.6, 2.6), rnd(-0.5, 0.5), { life: rnd(2, 3.5), size: rnd(1, 1.6), grow: 1.1, color: [c, c, c], alpha: 0.45, grav: -0.4, drag: 0.8 }); }
    }
    this.active = this.fire.update(dt) + this.smoke.update(dt);
    this.debris.update(dt, (x, z) => this.game.world.groundHeight(x, z));
    if (this.flash.visible) { this.flashT += dt; this.flash.intensity *= Math.exp(-5.5 * dt); if (this.flashT > 1.2 || this.flash.intensity < 0.5) this.flash.visible = false; }
    if (this.rainFx) { this.rainFx.splash.mat.uniforms.uScale.value = scale; this.updateRain(dt); }
    this.updateAlert(dt);
    this.game.overlay?.update(dt);
  }

  // the pooled things this made, let go (a page that tears the game down)
  dispose() {
    this.resetAtmosphere();
    this.rainScene(false);
    this.rainFx?.dispose(); this.rainFx = null;
    this.alertLamps(false); for (const l of this.alertLights) l.dispose(); this.alertLights = [];
    for (const p of [this.fire, this.smoke]) { p.points.removeFromParent(); p.geo.dispose(); p.mat.dispose(); }
    this.debris.mesh.removeFromParent(); this.debris.mesh.geometry.dispose(); this.debris.mesh.material.dispose(); this.debris.mesh.dispose();
    this.flash.removeFromParent(); this.tex.dispose();
    this.game.overlay?.dispose(); this.game.overlay = null;
  }
}
