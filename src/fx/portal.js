// Portals and the other dimension (chapter ten). Four things live here:
//
// Portal: a gate of turning violet-blue arms round a dark core, with lightning along its rim, motes drawn
// into it, a light and a hum. It opens with a crack, grows, closes, pulls bodies toward its middle and
// tells when one is inside it. Three draw calls (the disc, the motes, the lightning) and one point light;
// the disc and the motes are animated by their shaders, the lightning is a few dozen quads redrawn a
// dozen times a second in buffers made once, the sparks come out of game.fx's pool.
//
// makeOrb: the ball of black-violet energy in the Shadow's hands. It spins, crackles with blue lightning,
// grows, bends the air around it (rings that ripple outward on a quad that faces the camera), follows the
// hands that hold it, flies along an arc when thrown and turns into a Portal where it lands.
//
// Rift (game.rift): the other dimension's rules. game.dimension(name) lays its look (world/daylight.js:
// a violet sky with two moons, motes in the air, fog at 80 m, violet light), covers the minimap with
// "ממד לא ידוע", silences the car radio and the phone, raises the `static` flag missions read for the
// walkie-talkie, and tells the place (world.places[name].dimension(true)) to show its own layer;
// game.dimension(null) puts all of it back exactly as it was. It also ticks every live portal and orb.
//
// crossing: the passage between two places (and two worlds) under a white screen: the view goes white,
// the bodies are moved, the dimension is switched, the camera comes round behind the player, the white
// lifts and control comes back. Nothing else is touched: the squad, the markers, the ammunition, health
// and progress stay as they are.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const smooth = (k) => k * k * (3 - 2 * k);
const backOut = (k) => { const c = 1.7, q = k - 1; return 1 + (c + 1) * q * q * q + c * q * q; }; // past its size, then settling
const UNKNOWN = 'ממד לא ידוע';
const NO_SIGNAL = 'אין קליטה · ממד לא ידוע';

// ---------- lightning: jagged ribbons that face the camera, redrawn in place ----------

const BOLT_VERT = /* glsl */`
attribute vec3 aOther; attribute vec3 aSide;
uniform float uWidth; varying float vA, vS;
void main() {
  vec4 a = modelViewMatrix * vec4(position, 1.0), b = modelViewMatrix * vec4(aOther, 1.0);
  vec3 dir = (b.xyz - a.xyz) * aSide.y;
  vec3 side = cross(dir, a.xyz);
  float l = length(side);
  side = l > 1e-6 ? side / l : vec3(1.0, 0.0, 0.0);
  // as wide as asked, never thinner than a pixel and a half however far it is
  a.xyz += side * aSide.x * max(uWidth * (0.4 + 0.6 * aSide.z), -a.z * 0.0022);
  vA = aSide.z; vS = aSide.x;
  gl_Position = projectionMatrix * a;
}`;
const BOLT_FRAG = /* glsl */`
uniform vec3 uColor; varying float vA, vS;
void main() {
  float c = 1.0 - abs(vS);
  gl_FragColor = vec4(mix(uColor, vec3(1.0), c * c) * vA * (0.35 + 0.65 * c), 1.0);
  #include <colorspace_fragment>
}`;

class Bolts {
  constructor(count, segs, { color = '#6fb0ff', width = 0.05 } = {}) {
    this.count = count; this.segs = segs;
    const quads = count * segs, verts = quads * 4;
    this.pos = new Float32Array(verts * 3); this.other = new Float32Array(verts * 3); this.side = new Float32Array(verts * 3);
    const index = new Uint16Array(quads * 6);
    for (let q = 0; q < quads; q++) {
      const v = q * 4, j = q * 6;
      index[j] = v; index[j + 1] = v + 1; index[j + 2] = v + 2; index[j + 3] = v + 2; index[j + 4] = v + 1; index[j + 5] = v + 3;
      // the corners: the two sides of the segment's start, then of its end (which looks back along it)
      for (let c = 0; c < 4; c++) { this.side[(v + c) * 3] = c % 2 ? 1 : -1; this.side[(v + c) * 3 + 1] = c < 2 ? 1 : -1; }
    }
    const geo = (this.geo = new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aOther', new THREE.BufferAttribute(this.other, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSide', new THREE.BufferAttribute(this.side, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uWidth: { value: width } },
      vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 14; this.mesh.name = 'bolts';
    this.mesh.raycast = () => {};
    this.path = new Float32Array((segs + 1) * 3);
    this.wait = new Float32Array(count);  // seconds until each bolt is struck again
    this.lit = new Uint8Array(count);
    this.dirty = false;
  }
  // bolt i redrawn as a jagged line from a to b (the parent's own space); `jag`: how far it wanders
  strike(i, ax, ay, az, bx, by, bz, jag, bright = 1) {
    const n = this.segs, P = this.path, pos = this.pos, other = this.other, side = this.side;
    for (let j = 0; j <= n; j++) {
      const t = j / n, k = Math.sin(Math.PI * t) * jag;
      P[j * 3] = ax + (bx - ax) * t + (Math.random() * 2 - 1) * k;
      P[j * 3 + 1] = ay + (by - ay) * t + (Math.random() * 2 - 1) * k;
      P[j * 3 + 2] = az + (bz - az) * t + (Math.random() * 2 - 1) * k;
    }
    const base = i * n * 4;
    for (let j = 0; j < n; j++) {
      const p = j * 3, q = p + 3;
      for (let c = 0; c < 4; c++) {
        const o = (base + j * 4 + c) * 3, me = c < 2 ? p : q, it = c < 2 ? q : p;
        pos[o] = P[me]; pos[o + 1] = P[me + 1]; pos[o + 2] = P[me + 2];
        other[o] = P[it]; other[o + 1] = P[it + 1]; other[o + 2] = P[it + 2];
        side[o + 2] = bright;
      }
    }
    this.lit[i] = 1;
    this.dirty = true;
  }
  hide(i) {
    if (!this.lit[i]) return;
    const n = this.segs, base = i * n * 4;
    for (let v = 0; v < n * 4; v++) this.side[(base + v) * 3 + 2] = 0;
    this.lit[i] = 0;
    this.dirty = true;
  }
  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const a = this.geo.attributes;
    a.position.needsUpdate = true; a.aOther.needsUpdate = true; a.aSide.needsUpdate = true;
  }
  dispose() { this.mesh.removeFromParent(); this.geo.dispose(); this.mat.dispose(); }
}

// ---------- the portal ----------

const HALO = 1.7; // the disc's quad reaches this many gate radii out: the glow past the rim
const DISC_VERT = /* glsl */`
varying vec2 vP;
void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// colour goes out as light added to the picture, alpha as how much of what is behind is hidden
// (premultiplied), so one quad draws both the glowing arms and the dark core
const DISC_FRAG = /* glsl */`
uniform float uTime, uOpen, uSeed, uShock, uFlare;
uniform vec3 uColA, uColB, uColC;
varying vec2 vP;
void main() {
  float r = length(vP);
  if (r > ${HALO.toFixed(1)}) discard;
  float a = atan(vP.y, vP.x);
  float tw = log(max(r, 0.03));
  // three arms, wound tighter toward the core and turning; finer strands turn against them
  float arms = sin(a * 3.0 + tw * 6.5 - uTime * 2.4 + uSeed);
  float fine = sin(a * 8.0 - tw * 11.0 + uTime * 3.7 + uSeed * 2.0);
  float arm = smoothstep(-0.25, 0.95, arms);
  float strand = smoothstep(0.5, 1.0, fine);
  float band = smoothstep(0.30, 0.44, r) * (1.0 - smoothstep(0.84, 1.03, r));
  float rim = exp(-pow((r - 0.99) / 0.055, 2.0));
  float lip = exp(-pow((r - 0.37) / 0.045, 2.0));
  float halo = (1.0 - smoothstep(0.95, ${HALO.toFixed(1)}, r)) * smoothstep(0.9, 1.0, r);
  float core = 1.0 - smoothstep(0.29, 0.38, r);
  vec3 col = mix(uColA, uColB, clamp(arm * 0.8 + (0.9 - r) * 0.5, 0.0, 1.0)) * (0.16 + 1.2 * arm) * band;
  col += uColC * strand * band * (0.3 + 0.5 * arm);
  // far down in the core something still turns, almost black
  float deep = 0.5 + 0.5 * sin(a * 2.0 - uTime * 1.1 + r * 16.0);
  col = mix(col, uColA * 0.07 * deep * smoothstep(0.02, 0.3, r), core);
  col += uColB * rim * (1.25 + 0.45 * sin(a * 5.0 + uTime * 6.0)) + uColC * lip * 1.4 + uColA * halo * halo * 0.32;
  // tearing open: a ring of light runs outward
  if (uShock > 0.0) col += uColC * exp(-pow((r - (0.2 + 1.5 * uShock)) / 0.07, 2.0)) * (1.0 - uShock) * 2.6;
  col *= 1.0 + uFlare;
  float alpha = max(core * 0.97, band * (0.3 + 0.45 * arm));
  gl_FragColor = vec4(col * uOpen, alpha * uOpen);
  #include <colorspace_fragment>
}`;
// motes drawn in: each winds inward from a couple of radii out, on either face of the gate, and is gone
// at the core; `position` holds (a size, which face, how far out it starts), aSeed (angle, radius, phase, pace)
const DRAWN = 150;
const DRAWN_VERT = /* glsl */`
attribute vec4 aSeed;
uniform float uTime, uOpen, uScale, uR;
varying float vA, vHot;
void main() {
  float t = fract(aSeed.z + uTime * (0.16 + 0.22 * aSeed.w));
  float e = t * t;
  float rad = mix(1.25 + aSeed.y * 1.5, 0.1, e);
  float ang = aSeed.x + e * 8.0 * (0.6 + 0.4 * aSeed.w) + uTime * 0.5;
  float away = (1.0 - e) * (0.25 + 1.6 * position.z) * position.y;
  vec4 mv = modelViewMatrix * vec4(cos(ang) * rad, sin(ang) * rad, away, 1.0);
  vA = uOpen * smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.92, 1.0, t));
  vHot = e;
  gl_PointSize = (0.05 + 0.09 * position.x) * (1.0 + 1.2 * e) * uR * uScale / max(0.6, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const DRAWN_FRAG = /* glsl */`
uniform vec3 uColA, uColC; varying float vA, vHot;
void main() {
  float d = 1.0 - min(1.0, length(gl_PointCoord - 0.5) * 2.0);
  float a = d * d * vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(mix(uColA, uColC, vHot) * a * (1.0 + 2.0 * pow(d, 5.0)), 1.0);
  #include <colorspace_fragment>
}`;

const size2 = new THREE.Vector2();
const pointScale = (renderer, camera) => { renderer.getDrawingBufferSize(size2); return size2.y * 0.5 / Math.tan(((camera.fov || 60) * Math.PI) / 360); };

export class Portal {
  // at { x, z, y }: the spot it stands over (y: that spot's floor; the ground there when left out). The
  // gate hangs with its lower edge 0.3 m over the floor and grows upward (or its middle `height` m up when
  // that is given). r: its radius in metres. yaw: the way its face looks (toward the player when left out);
  // tilt: leaned back by this much (π/2 lies it flat, face up). light, sound: its point light and its hum
  // (and the crack when it opens). rumble: how much it shakes the camera near it (0 for none). auto: the
  // game ticks it (game.rift); with auto false the owner calls update(dt)
  constructor(game, { at = null, r = 2.4, yaw = null, tilt = 0, height = null, color = '#8a4dff', color2 = '#3f9dff', light = true, sound = true, rumble = 1, auto = true } = {}) {
    this.game = game;
    const p = at || game.player.pos, me = game.player.pos;
    this.floor = at && Number.isFinite(at.y) ? at.y : game.world.groundHeight(p.x, p.z, at ? null : p.y);
    this.height = Number.isFinite(height) ? height : null;
    this.r = Math.max(0.3, r); this.rTo = this.r; this.rRate = 0;
    this.k = 0; this.kTo = 0; this.kRate = 1;
    this.state = 'closed';
    this.yaw = Number.isFinite(yaw) ? yaw : Math.atan2(me.x - p.x, me.z - p.z);
    this.tilt = tilt;
    this.pos = new THREE.Vector3(p.x, this.floor + (this.height ?? this.r + 0.3), p.z); // the gate's middle
    this.scale = 0;
    this.rumble = rumble;
    this.t = Math.random() * 20; this.dt = 1 / 60;
    this.shock = -1; this.flare = 0;
    this.manual = 0;
    this.disposed = false;
    this.waits = [];          // { what, resolve }: promises of open(), close() and grow()
    this.grips = new Map();   // body -> 0..1: how much of the pull it holds out against
    this.tmp = new THREE.Vector3();
    this.zapWait = 0; this.sparkAcc = 0;

    const A = new THREE.Color(color), B = new THREE.Color(color2), C = new THREE.Color('#cfe4ff');
    this.group = new THREE.Group();
    this.group.name = 'portal';
    this.group.rotation.order = 'YXZ';
    this.discMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uSeed: { value: Math.random() * TAU }, uShock: { value: 0 }, uFlare: { value: 0 }, uColA: { value: A }, uColB: { value: B }, uColC: { value: C } },
      vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, fog: false,
    });
    this.disc = new THREE.Mesh(new THREE.PlaneGeometry(HALO * 2, HALO * 2), this.discMat);
    this.disc.renderOrder = 13; this.disc.frustumCulled = false; this.disc.raycast = () => {};
    const seed = new Float32Array(DRAWN * 3), extra = new Float32Array(DRAWN * 4);
    for (let i = 0; i < DRAWN; i++) {
      seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random() < 0.75 ? 1 : -1; seed[i * 3 + 2] = Math.random(); // most of them on the face
      extra[i * 4] = Math.random() * TAU; extra[i * 4 + 1] = Math.random(); extra[i * 4 + 2] = Math.random(); extra[i * 4 + 3] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(seed, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(extra, 4));
    this.drawnMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uScale: { value: 300 }, uR: { value: 1 }, uColA: { value: A }, uColC: { value: C } },
      vertexShader: DRAWN_VERT, fragmentShader: DRAWN_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, fog: false,
    });
    this.drawn = new THREE.Points(dg, this.drawnMat);
    this.drawn.frustumCulled = false; this.drawn.renderOrder = 14; this.drawn.raycast = () => {};
    this.drawn.onBeforeRender = (renderer, scene, camera) => { this.drawnMat.uniforms.uScale.value = pointScale(renderer, camera); };
    this.bolts = new Bolts(6, 9, { color: '#69a8ff', width: 0.05 });
    this.group.add(this.disc, this.drawn, this.bolts.mesh);
    this.light = light ? new THREE.PointLight('#8f7cff', 0, 20, 1.5) : null;
    if (this.light) { this.light.castShadow = false; this.light.name = 'portal-light'; }
    this.wantSound = !!sound;
    this.hum = null;
    this.sparkOpt = { life: 0.5, size: 0.2, grow: -0.1, color: [0.6, 0.7, 1], alpha: 1, grav: 0, drag: 1.2 };
    this.auto = auto !== false;
    if (this.auto) game.rift?.things.add(this);
    this.apply();
  }

  get isOpen() { return this.state === 'open'; }
  // where the gate's face looks (a unit vector on the ground, when it stands upright)
  get facing() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  wait(what) { return new Promise((resolve) => this.waits.push({ what, resolve })); }
  settle(what) {
    if (!this.waits.length) return;
    const rest = [];
    for (const w of this.waits) { if (what === null || w.what === what) w.resolve(this); else rest.push(w); }
    this.waits = rest;
  }

  // it tears open over `seconds` (0: it is simply there); the promise resolves once it is fully open.
  // From closed it opens with a crack: thunder, a ring of light, sparks, the camera jolted
  open(seconds = 1.2) {
    if (this.disposed) return Promise.resolve(this);
    const g = this.game;
    if (!this.group.parent) g.scene.add(this.group);
    if (this.light && !this.light.parent) g.scene.add(this.light);
    if (this.state === 'closed') {
      this.shock = 0;
      const d = this.camDist();
      if (this.wantSound) g.sound?.thunder?.(Math.max(0.15, Math.min(1.2, 1.3 - d / 60)));
      if (this.rumble > 0) { const k = Math.max(0, 0.5 * this.rumble * (1 - d / 40)); if (k > 0.02) { g.follow?.shake(k); g.carCam?.shake?.(k); } }
      if (d < 30) g.overlay?.flash('#cfd4ff', 320, 0.45 * (1 - d / 30));
      this.burst(26);
    }
    if (this.wantSound && !this.hum) this.hum = g.sound?.portalHum?.({ level: 0.15 }) || null;
    this.settle('closed');
    this.kTo = 1; this.kRate = seconds > 0 ? 1 / seconds : Infinity;
    this.state = 'opening';
    if (!(seconds > 0)) { this.k = 1; this.state = 'open'; this.apply(); return Promise.resolve(this); }
    this.apply();
    return this.wait('open');
  }
  // to another radius over `seconds`; the promise resolves when it has it
  grow(r, seconds = 1) {
    if (this.disposed) return Promise.resolve(this);
    this.rTo = Math.max(0.3, r);
    if (!(seconds > 0) || this.rTo === this.r) { this.r = this.rTo; this.apply(); this.settle('size'); return Promise.resolve(this); }
    this.rRate = Math.abs(this.rTo - this.r) / seconds;
    this.flare = Math.max(this.flare, 0.6);
    return this.wait('size');
  }
  // it shuts over `seconds` and is gone from the scene (open() brings it back); resolves when shut
  close(seconds = 0.8) {
    if (this.disposed || this.state === 'closed') return Promise.resolve(this);
    this.settle('open');
    this.kTo = 0; this.kRate = seconds > 0 ? 1 / seconds : Infinity;
    this.state = 'closing';
    this.hum?.stop(Math.max(0.1, seconds)); this.hum = null;
    if (!(seconds > 0)) { this.k = 0; this.shut(); return Promise.resolve(this); }
    return this.wait('closed');
  }
  shut() {
    this.state = 'closed';
    this.k = 0; this.shock = -1; this.flare = 0;
    this.group.removeFromParent();
    if (this.light) { this.light.intensity = 0; this.light.removeFromParent(); }
    for (let i = 0; i < this.bolts.count; i++) this.bolts.hide(i);
    this.bolts.flush();
    this.settle('closed');
  }
  // moved to another spot (and turned), as the constructor's `at` and `yaw`
  place(at, yaw = this.yaw) {
    this.floor = Number.isFinite(at.y) ? at.y : this.game.world.groundHeight(at.x, at.z);
    this.pos.x = at.x; this.pos.z = at.z;
    this.yaw = yaw;
    this.apply();
  }

  camDist() { const c = this.game.camera?.position; return c ? Math.hypot(c.x - this.pos.x, c.y - this.pos.y, c.z - this.pos.z) : 0; }
  // sparks thrown off the rim (from the game's own pool)
  burst(n) {
    const fx = this.game.fx; if (!fx?.fire) return;
    const o = this.sparkOpt, v = this.tmp;
    this.group.updateMatrixWorld(true);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, c = Math.cos(a), sn = Math.sin(a);
      v.set(c, sn, 0); this.group.localToWorld(v); // on the rim as wide as it is now (from its middle while it is still a point)
      const px = v.x, py = v.y, pz = v.z;
      v.set(c, sn, rnd(-0.4, 0.4)).transformDirection(this.group.matrixWorld);
      const sp = rnd(2.5, 7);
      o.life = rnd(0.35, 0.9); o.size = rnd(0.14, 0.3); o.grow = -0.12; o.alpha = 1; o.grav = 3; o.drag = 1.4;
      o.color[0] = rnd(0.45, 0.75); o.color[1] = rnd(0.55, 0.8); o.color[2] = 1;
      fx.fire.spawn(px, py, pz, v.x * sp, v.y * sp, v.z * sp, o);
    }
  }

  // the game calls tick every frame for a portal it ticks; update is for the owner of one made with
  // auto: false (called on a ticked one, it takes the ticking over for as long as it keeps being called)
  update(dt) { this.manual = 0.25; this.tick(dt); }
  tick(dt) {
    if (this.disposed) return;
    this.dt = dt; this.t += dt;
    if (this.k !== this.kTo) {
      const step = this.kRate * dt;
      this.k = this.k < this.kTo ? Math.min(this.kTo, this.k + step) : Math.max(this.kTo, this.k - step);
      if (this.k === this.kTo) { if (this.kTo > 0) { this.state = 'open'; this.settle('open'); } else { this.shut(); return; } }
    }
    if (this.state === 'closed') return;
    if (this.r !== this.rTo) {
      const step = this.rRate * dt;
      this.r = this.r < this.rTo ? Math.min(this.rTo, this.r + step) : Math.max(this.rTo, this.r - step);
      if (this.r === this.rTo) this.settle('size');
    }
    if (this.shock >= 0) { this.shock += dt / 0.7; if (this.shock >= 1) this.shock = -1; }
    if (this.flare > 0) this.flare = Math.max(0, this.flare - dt * 0.8);
    this.apply();
    const g = this.game, k = this.k, B = this.bolts;
    // lightning: along the rim, across the arms, and now and then out into the room
    for (let i = 0; i < B.count; i++) {
      if ((B.wait[i] -= dt) > 0) continue;
      if (B.lit[i] && Math.random() < 0.45) { B.hide(i); B.wait[i] = rnd(0.04, 0.4) / Math.max(0.3, k); continue; }
      const a = Math.random() * TAU;
      if (i < 2) { // out from the rim
        const b = a + rnd(-0.5, 0.5), far = rnd(1.4, 2.1);
        B.strike(i, Math.cos(a), Math.sin(a), 0, Math.cos(b) * far, Math.sin(b) * far, rnd(-0.7, 0.7), 0.16, k);
      } else if (i < 4) { // a chord across the arms
        const b = a + rnd(1.2, 2.6), ra = rnd(0.5, 0.95), rb = rnd(0.42, 0.9);
        B.strike(i, Math.cos(a) * ra, Math.sin(a) * ra, 0.02, Math.cos(b) * rb, Math.sin(b) * rb, 0.02, 0.1, k);
      } else { // crawling along the rim
        const b = a + rnd(0.5, 1.3) * (Math.random() < 0.5 ? -1 : 1);
        B.strike(i, Math.cos(a), Math.sin(a), 0, Math.cos(b), Math.sin(b), 0, 0.13, k);
      }
      B.wait[i] = rnd(0.05, 0.14);
      if (i < 2 && this.wantSound && (this.zapWait -= 1) <= 0) { // the ones that leap out are heard, not every one
        this.zapWait = 3 + Math.floor(Math.random() * 4);
        const d = this.camDist();
        if (d < 45) g.sound?.zap?.(0.3 * k * (1 - d / 45), rnd(0.7, 1.4));
      }
    }
    B.flush();
    // sparks off the rim
    this.sparkAcc += dt * 5 * k;
    if (this.sparkAcc >= 1) { this.sparkAcc = 0; this.burst(1); }
    if (this.light) {
      const L = this.light, f = Math.sin(this.yaw) * Math.cos(this.tilt), u = Math.sin(this.tilt), w = Math.cos(this.yaw) * Math.cos(this.tilt);
      L.position.set(this.pos.x + f * 0.9, this.pos.y + u * 0.9, this.pos.z + w * 0.9);
      L.distance = 10 + 7 * this.r;
      L.intensity = (26 + 20 * this.r) * k * (0.78 + 0.14 * Math.sin(this.t * 23) + 0.08 * Math.sin(this.t * 61)) * (1 + this.flare);
    }
    this.hum?.set(k * Math.min(1.5, 0.55 + this.r * 0.2), Math.max(0.6, 1.25 - this.r * 0.08));
    if (this.rumble > 0 && k > 0.2) { // the ground hums under whoever stands near
      const reach = 6 + 5 * this.r, d = this.camDist();
      if (d < reach) { const s = 0.035 * this.rumble * k * (1 - d / reach) * (1 + 2 * this.flare); if (g.mode === 'car') g.carCam?.shake?.(s); else g.follow?.shake(s); }
    }
  }
  // the gate's place, size and shaders for this moment
  apply() {
    const k = this.k, s = this.r * (k < 1 ? Math.max(0, backOut(k)) : 1);
    this.scale = s;
    this.pos.y = this.floor + (this.height ?? this.r + 0.3);
    const G = this.group;
    G.position.copy(this.pos);
    G.rotation.set(-this.tilt, this.yaw, 0);
    G.scale.setScalar(Math.max(0.001, s));
    G.updateMatrixWorld(true);
    const u = this.discMat.uniforms, open = Math.min(1, k * 1.6);
    u.uTime.value = this.t * (1 + 1.5 * (1 - k)); // faster while it opens
    u.uOpen.value = open; u.uShock.value = Math.max(0, this.shock); u.uFlare.value = this.flare;
    const m = this.drawnMat.uniforms;
    m.uTime.value = this.t; m.uOpen.value = k; m.uR.value = s;
    this.bolts.mat.uniforms.uWidth.value = 0.03 + 0.012 * this.r;
  }

  // is this point (a body's feet: its middle is taken 0.9 m up; with no y, the gate's own height) inside
  // the gate? Within nine tenths of its radius across the face and a metre through it; never while shut
  contains(pos) {
    if (!pos || this.k < 0.5 || this.state === 'closed' || this.state === 'closing') return false;
    const v = this.tmp.set(pos.x, Number.isFinite(pos.y) ? pos.y + 0.9 : this.pos.y, pos.z);
    this.group.worldToLocal(v);
    const across = Math.hypot(v.x, v.y) / 0.92, through = Math.abs(v.z) * this.scale;
    return across * across + through * through <= 1;
  }
  // the body is dragged toward the gate's middle at `strength` metres a second (along the ground; walls
  // still stop the player) for a frame of `dt` seconds; less by whatever the body holds out against
  // (hold). Call it every frame for as long as the pull lasts. Returns true once the body is inside
  pull(body, strength = 3, dt = this.dt) {
    const p = body?.pos;
    if (!p || this.k < 0.05) return false;
    const g = this.game;
    if (body === g.player && g.mode !== 'foot') return false;
    const dx = this.pos.x - p.x, dz = this.pos.z - p.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, Math.max(0, strength) * this.k * (1 - (this.grips.get(body) ?? 0)) * dt);
    if (step > 1e-5 && d > 1e-4) {
      const mx = (dx / d) * step, mz = (dz / d) * step;
      if (typeof body.push === 'function') body.push(mx, mz);
      else {
        p.x += mx; p.z += mz;
        g.world.cols.resolve(p, 0.33, p.y, body);
        if (body.floorY == null) p.y = g.world.groundHeight(p.x, p.z, p.y);
        body.sync?.();
      }
    }
    return this.contains(p);
  }
  // the body holds on (to a pillar, to a friend's hand): `grip` 1 keeps it where it is, 0.5 halves the
  // pull, 0 lets go. The mission weakens it as the seconds pass
  hold(body, grip = 1) { const k = clamp01(grip); if (k > 0) this.grips.set(body, k); else this.grips.delete(body); return k; }
  holding(body) { return this.grips.get(body) ?? 0; }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.state = 'closed'; this.k = 0;
    this.hum?.stop(0.15); this.hum = null;
    this.group.removeFromParent();
    this.disc.geometry.dispose(); this.discMat.dispose();
    this.drawn.geometry.dispose(); this.drawnMat.dispose();
    this.bolts.dispose();
    if (this.light) { this.light.removeFromParent(); this.light.dispose(); }
    this.grips.clear();
    this.game.rift?.things.delete(this);
    this.settle(null);
  }
}

// ---------- the orb ----------

const BALL_VERT = /* glsl */`
varying vec3 vN, vL;
void main() { vN = normalize(normalMatrix * normal); vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BALL_FRAG = /* glsl */`
uniform float uTime; uniform vec3 uColA, uColB; varying vec3 vN, vL;
void main() {
  float f = pow(1.0 - abs(normalize(vN).z), 2.0);                                   // its edge glows
  float swirl = sin(vL.y * 7.0 + atan(vL.z, vL.x) * 3.0 - uTime * 4.0) * 0.5 + 0.5;  // veins of violet turn round it
  vec3 col = uColA * (0.025 + 0.32 * pow(swirl, 4.0)) + mix(uColA, uColB, f) * f * 1.9;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
// the air bent around it: a quad that always faces the camera, rings rippling outward over it; between the
// rings the picture behind is a little darker, which reads as the air being pulled out of shape
const BEND = 3.2; // the quad's half-size in orb radii
const BEND_VERT = /* glsl */`
uniform float uSize; varying vec2 vP;
void main() { vP = position.xy; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); mv.xy += position.xy * uSize; gl_Position = projectionMatrix * mv; }`;
const BEND_FRAG = /* glsl */`
uniform float uTime, uInner; uniform vec3 uColA, uColB; varying vec2 vP;
void main() {
  float r = length(vP);
  if (r > 1.0 || r < uInner * 0.8) discard;
  float a = atan(vP.y, vP.x);
  float wob = sin(a * 5.0 + uTime * 2.3) * 0.035 + sin(a * 9.0 - uTime * 3.1) * 0.02;
  float ring = smoothstep(0.7, 1.0, sin((r + wob - uTime * 0.22) * 46.0) * 0.5 + 0.5);
  float fall = pow(1.0 - smoothstep(uInner, 1.0, r), 1.5);
  float glow = exp(-max(r - uInner, 0.0) * 9.0);
  vec3 col = mix(uColA, uColB, ring) * (ring * 0.5 + glow * 0.9) * fall;
  gl_FragColor = vec4(col, (1.0 - ring) * fall * 0.22 + glow * 0.25);
  #include <colorspace_fragment>
}`;

class Orb {
  constructor(game, { at = null, r = 0.35, hold = null, color = '#7a3cff', color2 = '#4fa8ff', light = true, sound = true, auto = true } = {}) {
    this.game = game;
    const p = at || game.player.pos;
    this.pos = new THREE.Vector3(p.x, Number.isFinite(p.y) ? p.y : game.world.groundHeight(p.x, p.z) + 1.2, p.z);
    this.r = Math.max(0.05, r); this.rTo = this.r; this.rRate = 0;
    this.spin = 2.6;         // radians a second
    this.held = hold;        // { npc, forward, up, side }: carried in front of someone
    this.flight = null;      // { from, to, t, seconds, arc, resolve }
    this.t = Math.random() * 20;
    this.manual = 0;
    this.disposed = false;
    this.zapWait = 0;
    const A = new THREE.Color(color), B = new THREE.Color(color2);
    this.group = new THREE.Group();
    this.group.name = 'orb';
    this.ballMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uColA: { value: A }, uColB: { value: B } }, vertexShader: BALL_VERT, fragmentShader: BALL_FRAG, fog: false });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.ballMat);
    this.ball.raycast = () => {};
    this.bendMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSize: { value: 1 }, uInner: { value: 1 / BEND }, uColA: { value: A }, uColB: { value: B } },
      vertexShader: BEND_VERT, fragmentShader: BEND_FRAG, transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: true, fog: false,
    });
    this.bend = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.bendMat);
    this.bend.frustumCulled = false; this.bend.renderOrder = 13; this.bend.raycast = () => {};
    this.bolts = new Bolts(5, 7, { color: '#6fb0ff', width: 0.03 });
    this.group.add(this.ball, this.bend, this.bolts.mesh);
    this.light = light ? new THREE.PointLight('#7d6bff', 0, 8, 1.6) : null;
    if (this.light) { this.light.castShadow = false; this.light.name = 'orb-light'; game.scene.add(this.light); }
    game.scene.add(this.group);
    this.hum = sound ? game.sound?.portalHum?.({ level: 0.05, pitch: 2.6 }) || null : null;
    this.wantSound = !!sound;
    this.sparkOpt = { life: 0.4, size: 0.12, grow: -0.1, color: [0.6, 0.7, 1], alpha: 1, grav: 4, drag: 1 };
    this.auto = auto !== false;
    if (this.auto) game.rift?.things.add(this);
    this.carry();
    this.apply();
  }
  get flying() { return !!this.flight; }

  // to another radius over `seconds` (0: at once)
  setSize(r, seconds = 0.6) {
    this.rTo = Math.max(0.05, r);
    if (!(seconds > 0)) this.r = this.rTo; else this.rRate = Math.abs(this.rTo - this.r) / seconds;
    this.apply();
    return this;
  }
  // carried: `npc` (anyone with pos and yaw) holds it `forward` m in front, `up` m over his feet, `side` m
  // to his right; null lets it hang where it is
  holdBy(npc, { forward = 0.45, up = 1.25, side = 0 } = {}) { this.held = npc ? { npc, forward, up, side } : null; this.carry(); return this; }
  carry() {
    const h = this.held; if (!h || this.flight || !h.npc?.pos) return;
    const n = h.npc, yaw = n.yaw || 0, f = h.forward ?? 0.45, s = h.side ?? 0;
    this.pos.set(n.pos.x + Math.sin(yaw) * f + Math.cos(yaw) * s, n.pos.y + (h.up ?? 1.25), n.pos.z + Math.cos(yaw) * f - Math.sin(yaw) * s);
  }
  // thrown: it leaves the hands and flies to `target` { x, z, y } (y: the height it arrives at; 1.2 m over
  // the ground there when left out) in `seconds`, rising `arc` m over the straight line on the way. The
  // promise resolves when it gets there (it stays, crackling, until toPortal or dispose)
  throwTo(target, seconds = 1.1, { arc = 1.6 } = {}) {
    if (this.disposed || !target) return Promise.resolve(this);
    this.held = null;
    if (this.flight) this.flight.resolve(this);
    const to = new THREE.Vector3(target.x, Number.isFinite(target.y) ? target.y : this.game.world.groundHeight(target.x, target.z) + 1.2, target.z);
    if (this.wantSound) this.game.sound?.zap?.(0.5, 0.6);
    if (!(seconds > 0)) { this.pos.copy(to); this.apply(); return Promise.resolve(this); }
    return new Promise((resolve) => { this.flight = { from: this.pos.clone(), to, t: 0, seconds, arc, resolve }; });
  }
  // where it is, it becomes a portal: a new Portal over the ground under it (opts as the Portal's: r, yaw,
  // tilt, height...), opening over `seconds`; the orb is gone. Returns the portal
  toPortal({ seconds = 1.4, ...opts } = {}) {
    const g = this.game, at = opts.at || { x: this.pos.x, z: this.pos.z, y: g.world.groundHeight(this.pos.x, this.pos.z, this.pos.y) };
    const portal = new Portal(g, { ...opts, at });
    this.dispose();
    portal.open(seconds);
    return portal;
  }

  update(dt) { this.manual = 0.25; this.tick(dt); }
  tick(dt) {
    if (this.disposed) return;
    this.t += dt;
    if (this.r !== this.rTo) { const step = this.rRate * dt; this.r = this.r < this.rTo ? Math.min(this.rTo, this.r + step) : Math.max(this.rTo, this.r - step); }
    const F = this.flight;
    if (F) {
      F.t = Math.min(1, F.t + dt / F.seconds);
      this.pos.lerpVectors(F.from, F.to, F.t);
      this.pos.y += F.arc * 4 * F.t * (1 - F.t);
      if (F.t >= 1) { this.flight = null; this.sparks(14); if (this.wantSound) this.game.sound?.zap?.(0.6, 0.5); F.resolve(this); if (this.disposed) return; }
    } else this.carry();
    this.ball.rotation.y += this.spin * dt;
    this.ball.rotation.x = Math.sin(this.t * 1.7) * 0.5;
    this.apply();
    // lightning over its skin, and a tongue of it out into the air now and then
    const B = this.bolts, R = this.r;
    for (let i = 0; i < B.count; i++) {
      if ((B.wait[i] -= dt) > 0) continue;
      if (B.lit[i] && Math.random() < 0.4) { B.hide(i); B.wait[i] = rnd(0.03, 0.25); continue; }
      const a = Math.random() * TAU, e = rnd(-1.2, 1.2), ax = Math.cos(a) * Math.cos(e), ay = Math.sin(e), az = Math.sin(a) * Math.cos(e);
      if (i === 0) { // out into the air
        const far = rnd(1.8, 2.8);
        B.strike(i, ax * R, ay * R, az * R, (ax + rnd(-0.4, 0.4)) * R * far, (ay + rnd(-0.4, 0.4)) * R * far, (az + rnd(-0.4, 0.4)) * R * far, R * 0.3);
        if (this.wantSound && (this.zapWait -= 1) <= 0) { this.zapWait = 4 + Math.floor(Math.random() * 5); const d = this.camDist(); if (d < 30) this.game.sound?.zap?.(0.16 * (1 - d / 30), rnd(1.4, 2.2)); }
      } else { // over the skin, standing a little off it
        const b = a + rnd(0.7, 2.2), e2 = rnd(-1.2, 1.2), q = 1.12;
        B.strike(i, ax * R * q, ay * R * q, az * R * q, Math.cos(b) * Math.cos(e2) * R * q, Math.sin(e2) * R * q, Math.sin(b) * Math.cos(e2) * R * q, R * 0.3);
      }
      B.wait[i] = rnd(0.04, 0.12);
    }
    B.flush();
    if (this.light) { this.light.position.copy(this.pos); this.light.distance = 5 + 9 * R; this.light.intensity = (8 + 34 * R) * (0.8 + 0.2 * Math.sin(this.t * 31)); }
    this.hum?.set(Math.min(1.5, 0.5 + R), Math.max(1.2, 2.8 - R * 0.9));
  }
  apply() {
    this.group.position.copy(this.pos);
    this.ball.scale.setScalar(this.r);
    this.ballMat.uniforms.uTime.value = this.t;
    const u = this.bendMat.uniforms;
    u.uTime.value = this.t; u.uSize.value = this.r * BEND;
    this.bolts.mat.uniforms.uWidth.value = 0.012 + 0.03 * this.r;
  }
  camDist() { const c = this.game.camera?.position; return c ? Math.hypot(c.x - this.pos.x, c.y - this.pos.y, c.z - this.pos.z) : 0; }
  sparks(n) {
    const fx = this.game.fx; if (!fx?.fire) return;
    const o = this.sparkOpt;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = rnd(-1, 1), sp = rnd(2, 6);
      o.life = rnd(0.3, 0.7); o.size = rnd(0.1, 0.22);
      o.color[0] = rnd(0.45, 0.75); o.color[1] = rnd(0.5, 0.8); o.color[2] = 1;
      fx.fire.spawn(this.pos.x, this.pos.y, this.pos.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1, Math.sin(a) * Math.cos(e) * sp, o);
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.hum?.stop(0.15); this.hum = null;
    this.group.removeFromParent();
    this.ball.geometry.dispose(); this.ballMat.dispose();
    this.bend.geometry.dispose(); this.bendMat.dispose();
    this.bolts.dispose();
    if (this.light) { this.light.removeFromParent(); this.light.dispose(); }
    this.game.rift?.things.delete(this);
    if (this.flight) { const F = this.flight; this.flight = null; F.resolve(this); }
  }
}

// the Shadow's energy orb: at { x, y, z } its middle (or hold: { npc, forward, up, side } to carry it in
// front of someone), r its radius in metres. See Orb above for what it does
export function makeOrb(game, opts = {}) { return new Orb(game, opts); }

// ---------- the other dimension, and the ticking ----------

export class Rift {
  constructor(game) {
    this.game = game;
    this.name = null;        // the dimension the game is in, or null in its own world
    this.static = false;     // the walkie-talkie gives only static (missions read it, and clear it when the radio comes back)
    this.things = new Set(); // live portals and orbs
    this.cross = null;       // the crossing in flight
    this.hour = null;        // the day and night as they were on the way in
    this.hooked = false;
    this.Portal = Portal;    // for whoever has the game and not this module: new game.rift.Portal(game, { ... })
  }
  makeOrb(opts) { return makeOrb(this.game, opts); }
  crossing(opts) { return this.startCrossing(opts); }
  get crossingNow() { return !!this.cross; }

  // into the other dimension called `name` (the place of that name shows its own layer:
  // world.places[name].dimension(true)), or with null back out of it. Going in: the sky violet with two
  // moons, motes in the air, fog that hides everything past 80 m, the light violet, the minimap replaced
  // by "ממד לא ידוע", the car radio and the phone dead, `static` raised. Coming out: all of it exactly as
  // it was, the hour of the day included. Safe to call twice. opts: seconds (the look eased in or out; 0
  // by default, as under a crossing's white), moonYaw (where the great moon hangs: 0 is +z, π/2 is +x;
  // the place's own `moonYaw` when it has one)
  dimension(name = null, { seconds = 0, moonYaw = null } = {}) {
    name = name || null;
    const g = this.game, d = g.daylight, places = g.world?.places || {};
    if (name === this.name) { if (name && moonYaw !== null) d?.moons(moonYaw); return this.name; }
    if (this.name) { // out of the one we are in (also on the way from one dimension to another)
      const old = this.name;
      this.name = null;
      places[old]?.dimension?.(false);
      if (!name) {
        this.static = false;
        d?.otherworld(false, { seconds });
        const h = this.hour;
        if (d && h) { d.night = h.night; d.target = h.target; d.rate = h.rate; d.apply(); } // the hour as it was
        this.hour = null;
        g.minimap?.cover(null);
        const r = g.radio;
        if (r) { r.lastKey = ''; r.update?.(); } // the radio finds its station again by itself
      }
    }
    if (name) {
      if (d && !this.hour) this.hour = { night: d.night, target: d.target, rate: d.rate };
      d?.otherworld(true, { seconds, moonYaw: moonYaw ?? places[name]?.moonYaw ?? null });
      g.minimap?.cover(UNKNOWN);
      this.silence();
      this.static = true;
      this.name = name;
      places[name]?.dimension?.(true);
    }
    return this.name;
  }
  // no station reaches here: whatever the car radio plays stops, its pill goes (game.update leaves the
  // radio alone while the dimension is on)
  silence() {
    const r = this.game.radio; if (!r) return;
    if (r.audio) r.audio.volume = 0;
    if (r.loop) { r.loop.stop(); r.loop = null; }
    if (r.ambientSrc?.audio) r.ambientSrc.audio.volume = 0;
    if (r.el) r.el.hidden = true;
    r.lastKey = '';
  }
  // what a call gets in the other dimension (game.call asks): true when there is no line, with a word on screen
  noSignal() {
    if (!this.name) return false;
    this.game.hud?.toast?.(NO_SIGNAL);
    return true;
  }
  // the two moons hung by the great one's yaw; returns the two directions toward them
  moons(yaw) { return this.game.daylight?.moons(yaw) ?? null; }
  // a point `dist` m from the camera toward moon i (0 the great one, 1 the small one): something for a
  // camera shot to look at
  moonPoint(i = 0, dist = 300) {
    const u = this.game.daylight?.sky.dome.material.uniforms, c = this.game.camera.position;
    if (!u) return null;
    const m = (i ? u.moonB : u.moonA).value;
    return { x: c.x + m.x * dist, y: c.y + m.y * dist, z: c.z + m.z * dist };
  }
  // the sky coming apart, 0..1 (cracks of light across it), eased over `seconds`
  crack(k = 1, seconds = 2) { this.game.daylight?.crack(k, seconds); }

  // ----- the crossing -----
  startCrossing({ to = null, also = [], dimension, seconds = 2.4, onMid = null, onArrive = null, cutscene = false } = {}) {
    const g = this.game;
    if (this.cross) this.finishCrossing(); // one at a time: the one in flight lands first
    if (!this.hooked && g.overlay) { this.hooked = true; g.overlay.onClear = () => { if (this.cross && !this.cross.busy) this.cancelCrossing(); }; }
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    const total = Math.max(0, seconds);
    const X = this.cross = { to, also: also || [], dimension, onMid, onArrive, cutscene: !!cutscene, t: 0, out: total * 0.35, hold: total * 0.3, back: total * 0.35, moved: false, busy: false, resolve, owner: g.missions?.active || null };
    promise.cancel = () => { if (this.cross === X) this.cancelCrossing(); };
    g.cutscene = true;
    if (!(total > 0)) this.finishCrossing();
    return promise;
  }
  // under the white: everybody moved, the world switched, the camera behind the player
  crossMid(X) {
    const g = this.game;
    X.moved = true;
    if (g.mode === 'car') g.exitCar();
    g.dash = null;
    const to = X.to;
    if (to) {
      g.player.place(to.x, to.z, Number.isFinite(to.yaw) ? to.yaw : g.player.yaw, Number.isFinite(to.y) ? to.y : null);
      g.player.push(0, 0); // out of anything solid that stands on the spot
      g.follow.override = null; g.follow.lockOn = null;
      g.follow.snapBehind(g.player.yaw);
    }
    for (const a of X.also) {
      const n = typeof a?.npc === 'string' ? g.npc(a.npc) : a?.npc, q = a?.at;
      if (!n || !q) continue;
      if (n.inCar) { n.inCar.occupants.delete(n.id); n.inCar = null; }
      n.place(q.x, q.z, Number.isFinite(q.yaw) ? q.yaw : n.yaw, Number.isFinite(q.y) ? q.y : null);
      g.world.cols.resolve(n.pos, 0.33, n.pos.y, n);
      if (n.floorY == null) n.pos.y = g.world.groundHeight(n.pos.x, n.pos.z, n.pos.y);
      n.sync();
      n.show(true);
    }
    if (X.dimension !== undefined) this.dimension(X.dimension);
    if (X.onMid) { X.busy = true; try { X.onMid(g); } finally { X.busy = false; } }
  }
  crossEnd(X) {
    const g = this.game;
    this.cross = null;
    g.overlay?.white(0);
    g.cutscene = X.cutscene;
    if (X.onArrive) X.onArrive(g);
    X.resolve(true);
  }
  // the crossing in flight lands at once
  finishCrossing() {
    const X = this.cross; if (!X) return;
    if (!X.moved) this.crossMid(X);
    if (this.cross === X) this.crossEnd(X);
  }
  // ...or is dropped where it is: nobody is moved any more, the white lifts, its promise resolves false
  cancelCrossing() {
    const X = this.cross; if (!X) return;
    this.cross = null;
    if (this.game.overlay?.state.white > 0) this.game.overlay.white(0);
    this.game.cutscene = X.cutscene;
    X.resolve(false);
  }
  tickCrossing(dt) {
    const X = this.cross, g = this.game;
    if (X.owner && !g.missions?.active) { this.cancelCrossing(); return; } // its mission was left
    X.t += dt;
    g.cutscene = true;
    if (!X.moved && X.t >= X.out) this.crossMid(X);
    if (this.cross !== X) return;
    const t = X.t, k = t < X.out ? t / X.out : t < X.out + X.hold ? 1 : Math.max(0, 1 - (t - X.out - X.hold) / X.back);
    g.overlay?.white(smooth(k));
    if (t >= X.out + X.hold + X.back) this.crossEnd(X);
  }

  // once a frame (game.update): the portals, the orbs, the crossing
  update(dt) {
    for (const th of this.things) { if (th.manual > 0) th.manual -= dt; else th.tick(dt); }
    if (this.cross) this.tickCrossing(dt);
  }
  // everything this holds, let go (a page that tears the game down)
  dispose() {
    this.cancelCrossing();
    this.dimension(null);
    for (const th of [...this.things]) th.dispose();
  }
}

// the passage between two places (and two worlds). to { x, z, yaw, y }: where the player lands (y: that
// spot's floor); also [{ npc, at: { x, z, yaw, y } }]: who comes along and where each lands (npc: an Npc or
// its id); dimension: a name to arrive in that dimension, null to arrive back in the world, left out to
// stay as it is; seconds: the whole of it (a third going white, a third white, a third coming back);
// onMid(game): under the white, everybody already moved and the dimension switched (stage the scene
// here); onArrive(game): the white gone, control back; cutscene: true keeps the scripted moment going
// after arrival (by default the player walks again). Returns a promise that resolves true on arrival
// (false if it was dropped: promise.cancel(), the mission left, or a cleanup's overlay.clear())
export function crossing(game, opts = {}) { return game.rift.startCrossing(opts); }
