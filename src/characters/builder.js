// Builds a character from a written spec (see roster.js). The parts are modeled in code, then baked into
// one skinned mesh with one material (vertex colors plus a small texture for the face and the shirt
// print), so each person costs one draw call. Every character shares one skeleton; walking, running,
// fighting and the other poses are animated in code (poses.js).
// The model faces local +z; the origin is at the feet. The character's left side is +x.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildHead } from './head.js';
import { printTexture } from './paint.js';
import { POSES, ACTIONS } from './poses.js';

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const V = (x, y) => new THREE.Vector2(Math.max(1e-4, x), y);

// a rounded limb hanging from a joint: radius r0 around the joint (y = 0) and r1 around the next one (y = -len).
// Both ends are rounded, so the limbs meet cleanly at the elbows and knees however they bend.
function limb(r0, r1, len, n = 14) {
  const pts = [];
  for (let k = 0; k <= 4; k++) { const a = (k / 4 - 1) * (Math.PI / 2); pts.push(V(r1 * Math.cos(a), -len + r1 * Math.sin(a))); }
  for (let k = 0; k <= 4; k++) { const a = (k / 4) * (Math.PI / 2); pts.push(V(r0 * Math.cos(a), r0 * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, n);
}

// a sleeve or a shorts leg: rounded over the joint, open at the hem around a limb of radius `inner`
function tube(r0, r1, len, inner, n = 14) {
  const pts = [V(inner, -len), V(r1 - 0.004, -len), V(r1, -len + 0.005)];
  for (let k = 0; k <= 5; k++) { const a = (k / 5) * (Math.PI / 2); pts.push(V(r0 * Math.cos(a), r0 * Math.sin(a) * 0.85)); }
  return new THREE.LatheGeometry(pts, n);
}

// keep only the vertices an index uses (the hair and beard layers drop most of theirs)
function compact(g) {
  const idx = g.index.array, n0 = g.getAttribute('position').count, map = new Int32Array(n0).fill(-1);
  let n = 0;
  for (let i = 0; i < idx.length; i++) if (map[idx[i]] < 0) map[idx[i]] = n++;
  if (n === n0) return g;
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) {
    const k = a.itemSize, arr = new a.array.constructor(n * k);
    for (let i = 0; i < n0; i++) if (map[i] >= 0) for (let c = 0; c < k; c++) arr[map[i] * k + c] = a.array[i * k + c];
    out.setAttribute(name, new THREE.BufferAttribute(arr, k, a.normalized));
  }
  out.setIndex(Array.from(idx, (i) => map[i]));
  return out;
}

// The texture shared by the whole body: the painted head in the top half, the shirt print in a corner,
// white everywhere else (parts without a texture sample white and keep their vertex color).
const WHITE_UV = [0.75, 0.25];
function atlas(faceCanvas, print, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, size, size);
  g.drawImage(faceCanvas, 0, 0, size, size / 2);
  if (print) {
    const q = size / 8;
    g.fillStyle = print.bg;
    g.fillRect(0, size - q, q, q);
    g.drawImage(print.canvas, 0, size - q, q, q);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}

// every mesh under the skeleton becomes part of one skinned geometry, bound rigidly to its joint
function bake(root, bones, texture) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), m = new THREE.Matrix4();
  const parts = [], meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    let bone = o.parent;
    while (bone && !bone.isBone) bone = bone.parent;
    const bi = bones.indexOf(bone);
    const g = o.geometry.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    const n = g.getAttribute('position').count;
    if (!g.index) g.setIndex(Array.from({ length: n }, (_, i) => i));
    const uv = g.getAttribute('uv') || new THREE.BufferAttribute(new Float32Array(n * 2), 2);
    const color = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const c = o.userData.textured ? { r: 1, g: 1, b: 1 } : o.material.color;
    for (let i = 0; i < n; i++) {
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
      si[i * 4] = bi; sw[i * 4] = 1;
      if (o.userData.textured === 'face') uv.setXY(i, uv.getX(i), 0.5 + uv.getY(i) * 0.5);
      else if (o.userData.textured === 'print') uv.setXY(i, uv.getX(i) / 8, uv.getY(i) / 8);
      else uv.setXY(i, WHITE_UV[0], WHITE_UV[1]);
    }
    g.setAttribute('uv', uv);
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(compact(g));
    o.parent.remove(o);
    o.geometry.dispose();
  }
  const material = new THREE.MeshStandardMaterial({ map: texture, vertexColors: true, roughness: 0.78 });
  const mesh = new THREE.SkinnedMesh(mergeGeometries(parts), material);
  mesh.castShadow = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.3); // generous, so no per-pose recompute
  mesh.name = `${root.name}-body`;
  root.add(mesh);
  mesh.add(bones[0]);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  return mesh;
}

// detail: 'high' for the main cast, 'low' for passers-by
export function makeCharacter(spec, { detail = 'high' } = {}) {
  const b = { shoulders: 1, arms: 1, legs: 1, ...spec.build };
  const m = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const mat = {
    skin: m(spec.skin, 0.72),
    top: m(spec.top.color, 0.9), topCuff: m(shade(spec.top.color, 0.78), 0.9), bottom: m(spec.bottom.color, 0.9), cuff: m(shade(spec.bottom.color, 0.8), 0.9),
    shoe: m(spec.shoes.color, 0.7), sole: m(spec.shoes.sole, 0.8), accent: m(spec.shoes.accent || spec.shoes.sole, 0.6),
    metal: m('#c9ccd1', 0.25, { metalness: 0.9 }), watch: m('#18191b', 0.5),
  };
  const mesh = (geo, material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    o.castShadow = true;
    return o;
  };
  const pivot = (x, y, z) => { const g = new THREE.Bone(); g.position.set(x, y, z); return g; };
  const cyl = (r0, r1, h, n = 12, open = false) => new THREE.CylinderGeometry(r0, r1, h, n, 1, open);
  const sph = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);

  const root = new THREE.Group();
  root.name = spec.id;
  const hips = pivot(0, 0.96, 0);
  root.add(hips);
  // pelvis: rounded underneath so it blends into the tops of the legs
  const pelvis = [[0, -0.125], [0.075, -0.117], [0.13, -0.09], [0.16, -0.045], [0.17, 0.02], [0.172, 0.1], [0, 0.1]];
  hips.add(mesh(new THREE.LatheGeometry(pelvis.map(([x, y]) => V(x * b.legs, y)), 16).scale(1, 1, 0.62), mat.bottom));

  // ---------- torso ----------
  const chest = pivot(0, 0.06, 0);
  hips.add(chest);
  const top = spec.top.type;
  const bulk = top === 'oversized' ? 1.1 : top === 'zip' ? 1.06 : 1;
  const torsoH = (top === 'oversized' ? 0.58 : 0.5) + 0.03; // the hem hangs a little over the waistband
  const torso = cyl(0.205 * b.shoulders * bulk, 0.178 * bulk, torsoH, 16).scale(1, 1, 0.62);
  chest.add(mesh(torso, mat.top, 0, 0.5 - torsoH / 2, 0));
  chest.add(mesh(new THREE.SphereGeometry(0.205 * b.shoulders * bulk, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(top === 'tank' ? 0.62 : 1, 0.32, 0.62), mat.top, 0, 0.5, 0));
  if (top === 'tank') chest.add(mesh(new THREE.SphereGeometry(0.205 * b.shoulders, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.3, 0.6), mat.skin, 0, 0.495, 0));
  if (top === 'zip') {
    chest.add(mesh(cyl(0.078, 0.084, 0.07), mat.top, 0, 0.55, 0.004));                       // collar
    chest.add(mesh(new THREE.BoxGeometry(0.008, 0.46, 0.004), m('#d7dadf', 0.4, { metalness: 0.6 }), 0, 0.27, 0.129)); // zipper
  }
  const printTex = spec.top.print ? printTexture(spec.top.print, spec.top.printColor || '#f2efe8') : null;
  if (printTex) {
    const p = mesh(new THREE.PlaneGeometry(0.075, 0.075), mat.top, 0.085, 0.38, 0.128 * bulk);
    p.userData.textured = 'print';
    chest.add(p);
  }
  chest.add(mesh(cyl(0.052, 0.058, 0.1, 10), mat.skin, 0, 0.57, 0.005));
  if (spec.chain) {
    const chain = mesh(new THREE.TorusGeometry(0.068, 0.0035, 6, 28).scale(1, 1.25, 1), mat.metal, 0, 0.535, 0.03);
    chain.rotation.x = Math.PI / 2 - 0.5;
    chest.add(chain, mesh(sph(0.009, 8, 6), mat.metal, 0, 0.47, 0.115));
  }

  // ---------- head ----------
  const head = pivot(0, 0.67, 0.01);
  chest.add(head);
  const headParts = buildHead(spec, { detail });
  head.add(headParts);
  headParts.traverse((o) => { if (o.isMesh && o.material.map) o.userData.textured = 'face'; });

  // ---------- arms ----------
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = pivot(s * 0.225 * b.shoulders, 0.44, 0);
    chest.add(shoulder);
    const ra = b.arms;
    shoulder.add(mesh(limb((top === 'tank' ? 0.062 : 0.047) * ra, 0.043 * ra, 0.29), mat.skin));
    if (top === 'zip') {
      shoulder.add(mesh(tube(0.072 * ra, 0.062 * ra, 0.3, 0.046 * ra), mat.top));
    } else if (top !== 'tank') {
      const len = top === 'oversized' ? 0.24 : 0.17, wide = top === 'oversized' ? 1.18 : 1;
      shoulder.add(mesh(tube(0.074 * ra * wide, 0.066 * ra * wide, len, 0.049 * ra), mat.top));
    }
    const elbow = pivot(0, -0.29, 0);
    shoulder.add(elbow);
    elbow.add(mesh(limb(0.043 * ra, 0.036 * ra, 0.25), mat.skin));
    if (top === 'zip') {
      elbow.add(mesh(tube(0.06 * ra, 0.052 * ra, 0.215, 0.04 * ra), mat.top));
      elbow.add(mesh(cyl(0.05 * ra, 0.047 * ra, 0.035, 14, true), mat.topCuff, 0, -0.232, 0));
    }
    // hand: palm turned toward the thigh, fingers curled a little, thumb in front
    elbow.add(mesh(sph(0.034, 12, 8).scale(0.46, 1.05, 0.85), mat.skin, -s * 0.002, -0.285, 0));
    elbow.add(mesh(sph(0.03, 12, 8).scale(0.5, 0.9, 0.85), mat.skin, -s * 0.008, -0.322, 0.004));
    elbow.add(mesh(new THREE.CapsuleGeometry(0.0085, 0.022, 2, 8).rotateX(0.45), mat.skin, -s * 0.004, -0.284, 0.026));
    if (spec.watch && s > 0) elbow.add(mesh(cyl(0.041, 0.041, 0.03, 14), mat.watch, 0, -0.215, 0));
    shoulder.rotation.z = s * 0.06;
    arms.push({ shoulder, elbow, side: s });
  }

  // ---------- legs ----------
  const legs = [];
  const bottom = spec.bottom.type, shoes = spec.shoes.type, rl = b.legs;
  for (const s of [-1, 1]) {
    const hip = pivot(s * 0.095 * rl, -0.04, 0);
    hips.add(hip);
    const knee = pivot(0, -0.44, 0);
    hip.add(knee);
    if (bottom === 'shorts') {
      hip.add(mesh(limb(0.074 * rl, 0.058 * rl, 0.44), mat.skin));
      hip.add(mesh(tube(0.095 * rl, 0.09 * rl, 0.3, 0.068 * rl), mat.bottom));
      knee.add(mesh(limb(0.056 * rl, 0.042 * rl, 0.42), mat.skin));
    } else {
      hip.add(mesh(limb(0.086 * rl, 0.066 * rl, 0.44), mat.bottom));
      knee.add(mesh(limb(0.064 * rl, (bottom === 'pants' ? 0.058 : 0.05) * rl, 0.42), mat.bottom));
      if (bottom === 'joggers') knee.add(mesh(cyl(0.056 * rl, 0.054 * rl, 0.05, 14, true), mat.cuff, 0, -0.39, 0));
    }
    const ankle = pivot(0, -0.42, 0);
    knee.add(ankle);
    if (shoes === 'slides') {
      ankle.add(mesh(new THREE.BoxGeometry(0.09, 0.05, 0.24), mat.skin, 0, -0.01, 0.045));
      ankle.add(mesh(new THREE.BoxGeometry(0.11, 0.03, 0.27), mat.sole, 0, -0.045, 0.045));
      ankle.add(mesh(new THREE.BoxGeometry(0.112, 0.04, 0.11), mat.shoe, 0, 0.0, 0.085));
    } else if (shoes === 'boots') {
      ankle.add(mesh(new THREE.BoxGeometry(0.11, 0.14, 0.27), mat.shoe, 0, 0.03, 0.04));
      ankle.add(mesh(new THREE.BoxGeometry(0.115, 0.025, 0.28), mat.sole, 0, -0.045, 0.04));
    } else {
      ankle.add(mesh(new THREE.BoxGeometry(0.105, 0.075, 0.27), mat.shoe, 0, 0.0, 0.045));
      ankle.add(mesh(new THREE.BoxGeometry(0.11, 0.025, 0.28), mat.sole, 0, -0.045, 0.045));
      ankle.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.012), mat.accent, 0, 0.03, -0.092));
    }
    legs.push({ hip, knee, ankle, side: s });
  }
  const bones = [];
  hips.traverse((o) => { if (o.isBone) bones.push(o); });
  const texture = atlas(headParts.userData.faceTexture.image, printTex && { canvas: printTex.image, bg: `#${mat.top.color.getHexString(THREE.SRGBColorSpace)}` }, detail === 'low' ? 256 : 512);
  headParts.userData.faceTexture.dispose();
  const body = bake(root, bones, texture);
  root.scale.setScalar(spec.height || 1);
  const J = { hips, chest, head, shL: arms[1].shoulder, elL: arms[1].elbow, shR: arms[0].shoulder, elR: arms[0].elbow, hipL: legs[1].hip, kneeL: legs[1].knee, ankL: legs[1].ankle, hipR: legs[0].hip, kneeR: legs[0].knee, ankR: legs[0].ankle };

  // ---------- procedural walk / run / idle, with held poses and one-shot actions on top ----------
  let phase = 0, t = 0, blend = 0;
  let pose = null, shownPose = null, poseW = 0, action = null;
  const apply = (p, w) => {
    for (const k in p) {
      const v = p[k], dot = k.indexOf('.'), bone = J[k.slice(0, dot)], ch = k.slice(dot + 1);
      if (ch === 'y') bone.position.y += v * w;
      else { const axis = ch[1]; bone.rotation[axis] += (v - bone.rotation[axis]) * w; }
    }
  };
  // rises to full weight at `peak`, falls back to nothing at the end
  const envelope = (u, peak) => (u < peak ? smooth(u / peak) : 1 - smooth((u - peak) / (1 - peak)));
  const smooth = (x) => x * x * (3 - 2 * x);

  function animate(dt, speed, maxSpeed) {
    t += dt;
    const k = Math.min(1, speed / 2.4);                 // 0 standing … 1 walking
    const run = Math.max(0, Math.min(1, (speed - 2.6) / (maxSpeed - 2.6)));
    blend += (k - blend) * Math.min(1, dt * 10);
    const stride = 1.35 + run * 1.0;                   // meters per full step cycle
    phase += (speed / stride) * Math.PI * 2 * dt;
    const sw = Math.sin(phase);
    const legAmp = (0.42 + run * 0.45) * blend, armAmp = (0.34 + run * 0.5) * blend;
    for (const L of legs) {
      L.hip.rotation.x = -(L.side > 0 ? sw : -sw) * legAmp;
      const lift = Math.max(0, Math.sin(phase + (L.side > 0 ? 0 : Math.PI) - 1.1));
      L.knee.rotation.x = (0.08 + lift * (0.55 + run * 0.8)) * blend + 0.04 * (1 - blend);
      L.ankle.rotation.x = -L.knee.rotation.x * 0.35;
    }
    for (const A of arms) {
      A.shoulder.rotation.x = -(A.side > 0 ? -sw : sw) * armAmp;
      A.elbow.rotation.x = -(0.2 + run * 0.9) * blend - 0.08;
      A.shoulder.rotation.z = A.side * (0.06 + 0.02 * Math.sin(t * 1.6) * (1 - blend));
    }
    hips.position.y = 0.96 - Math.abs(Math.cos(phase)) * (0.025 + run * 0.035) * blend;
    chest.rotation.x = (0.03 + run * 0.16) * blend;
    chest.rotation.y = sw * 0.06 * blend;
    chest.scale.y = 1 + Math.sin(t * 2.2) * 0.008 * (1 - blend);  // breathing when idle
    head.rotation.x = -chest.rotation.x * 0.6;
    chest.rotation.z = head.rotation.y = head.rotation.z = 0;
    for (const A of arms) A.shoulder.rotation.y = A.elbow.rotation.z = 0;
    for (const L of legs) L.hip.rotation.z = 0;

    poseW += ((pose ? 1 : 0) - poseW) * Math.min(1, dt * 9);
    if (pose) shownPose = pose;
    if (shownPose && poseW > 0.002) apply(POSES[shownPose], poseW);
    if (action) {
      const a = ACTIONS[action.name];
      action.t += dt * action.speed;
      const u = Math.min(1, action.t / a.dur);
      apply(a.pose, envelope(u, a.peak));
      if (a.wobble) J[a.wobble[0].split('.')[0]].rotation[a.wobble[0].split('.')[1][1]] += Math.sin(action.t * a.wobble[2]) * a.wobble[1] * envelope(u, a.peak);
      if (a.hit !== undefined && !action.landed && u >= a.hit) { action.landed = true; action.onHit?.(); }
      if (u >= 1) { const done = action.onDone; action = null; done?.(); }
    }
    if (flash > 0) {
      flash = Math.max(0, flash - dt * 4);
      body.material.emissive.setRGB(flash * 0.6, flash * 0.6, flash * 0.6);
    }
  }

  let flash = 0;
  return {
    root, spec, body, bones: J, animate,
    // a held pose ('guard', 'sit', 'down', ...) or null to go back to plain standing and walking
    setPose(name) { pose = name && POSES[name] ? name : null; },
    get pose() { return pose; },
    // a one-shot action ('jab', 'cross', 'hit', ...); onHit fires when a punch lands, onDone at the end
    play(name, { onHit, onDone, speed = 1, at = 0 } = {}) {
      if (!ACTIONS[name]) return false;
      action = { name, t: at * ACTIONS[name].dur, speed, onHit, onDone, landed: false };
      return true;
    },
    get action() { return action?.name || null; },
    flash(amount = 1) { flash = amount; },
    // where the right hand is, for carrying things (in the elbow's space)
    handR: { bone: arms[0].elbow, offset: new THREE.Vector3(0, -0.3, 0.02) },
    dispose() { body.geometry.dispose(); body.material.map.dispose(); body.material.dispose(); },
  };
}
