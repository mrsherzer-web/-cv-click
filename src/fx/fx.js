// Effects for chapter eight: explosions (a fireball, smoke, sparks, debris, a flash of light, the
// camera jolted, a boom), fires that keep burning, columns of smoke. Everything is drawn from two
// pools of point sprites (one additive for fire and sparks, one plain for smoke), a small instanced
// mesh for debris and one point light that the latest blast borrows, so a battle with a dozen
// explosions costs a handful of draw calls. The pools are rings: when they are full the oldest
// particle is reused. Stylised: fire and smoke, no gore, and a blast in play never hurts without the
// warning the mission gives first.
import * as THREE from 'three';

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
  }

  // a blast at (x, y, z): size 1 is a car, 3 a building front; `fire` keeps flames for that many seconds
  explode(x, y, z, { size = 1, light = true, shake = true, sound = true, fire = 0, debris = true } = {}) {
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
  }
}
