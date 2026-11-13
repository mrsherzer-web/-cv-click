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


// ---------- chapter ten: gear outside the baked body ----------
// Parts that hang on the skeleton but stay their own mesh, so they can be put on and taken off: meshes
// placed under the joints are merged into one more skinned mesh on the body's skeleton (one draw call)
function bakeParts(root, bones, body, meshes, material) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), m = new THREE.Matrix4(), parts = [];
  for (const o of meshes) {
    let bone = o.parent;
    while (bone && !bone.isBone) bone = bone.parent;
    const bi = bones.indexOf(bone);
    const g = o.geometry.clone().applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    const n = g.getAttribute('position').count, c = o.material.color;
    if (!g.index) g.setIndex(Array.from({ length: n }, (_, i) => i));
    const color = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b; si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    parts.push(g);
    o.parent.remove(o);
    o.geometry.dispose();
  }
  const mesh = new THREE.SkinnedMesh(mergeGeometries(parts), material);
  for (const p of parts) p.dispose();
  mesh.castShadow = true;
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.4);
  root.add(mesh);
  mesh.bind(body.skeleton, body.bindMatrix);
  return mesh;
}

// spec.armor { color, glow, visor, helmet, on }: plates over the clothes (chest and back, shoulders, forearms,
// thighs, shins, a helmet with a visor). With `glow` the plates carry strips of light and a core on the
// chest (the Shadow's energy suit); without it they are plain padding (a heavy). Two meshes at most: the
// plates and the light. `on: false` builds it taken off (model.setArmor(true) puts it on)
function buildArmor(spec, b, { root, bones, body, chest, head, headBox, arms, legs, hips }) {
  const A = spec.armor, plate = new THREE.MeshBasicMaterial({ color: A.color || '#15161c' }), trim = new THREE.MeshBasicMaterial({ color: shade(A.color || '#15161c', 1.9) });
  const light = A.glow ? new THREE.MeshBasicMaterial({ color: A.glow }) : null, visor = new THREE.MeshBasicMaterial({ color: A.visor || A.glow || '#2a2d36' });
  const plates = [], lights = [];
  const put = (list, parent, geo, material, x = 0, y = 0, z = 0, rx = 0, rz = 0) => { const o = new THREE.Mesh(geo, material); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); parent.add(o); list.push(o); return o; };
  const cyl = (r0, r1, h, n = 14, t0 = 0, tl = Math.PI * 2) => new THREE.CylinderGeometry(r0, r1, h, n, 1, true, t0, tl);
  const bulk = spec.top.type === 'oversized' ? 1.1 : spec.top.type === 'zip' ? 1.06 : 1, S = b.shoulders, ra = b.arms, rl = b.legs;
  const rTop = 0.205 * S * bulk * 1.12, rMid = 0.19 * bulk * 1.12;
  // chest and back: two curved shells with a gap at the sides, a collar ring
  put(plates, chest, cyl(rTop, rMid, 0.3, 12, -1.15, 2.3).scale(1, 1, 0.7), plate, 0, 0.33, 0);
  put(plates, chest, cyl(rTop, rMid, 0.3, 12, Math.PI - 1.0, 2.0).scale(1, 1, 0.7), plate, 0, 0.33, 0);
  put(plates, chest, cyl(rMid * 0.98, 0.178 * bulk * 1.1, 0.14, 12, -0.9, 1.8).scale(1, 1, 0.7), trim, 0, 0.11, 0); // the belly plate
  put(plates, hips, cyl(0.185 * rl, 0.185 * rl, 0.06, 14).scale(1, 1, 0.66), trim, 0, 0.07, 0);                    // belt
  for (const A2 of arms) {
    const s = A2.side;
    put(plates, A2.shoulder, new THREE.SphereGeometry(0.098 * ra, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1.1, 0.8, 1.15), plate, s * 0.014, 0.02, 0, 0, -s * 0.25);
    put(plates, A2.elbow, cyl(0.066 * ra, 0.056 * ra, 0.17, 12), plate, 0, -0.125, 0);
    if (light) put(lights, A2.elbow, cyl(0.068 * ra, 0.066 * ra, 0.018, 12), light, 0, -0.06, 0);
    if (light) put(lights, A2.shoulder, new THREE.BoxGeometry(0.014, 0.012, 0.13), light, s * 0.05, 0.085 * ra, 0);
  }
  for (const L of legs) {
    const s = L.side;
    put(plates, L.hip, new THREE.BoxGeometry(0.03, 0.2, 0.13), plate, s * 0.085 * rl, -0.2, 0.01);
    put(plates, L.knee, cyl(0.079 * rl, 0.069 * rl, 0.27, 12, -1.25, 2.5), plate, 0, -0.2, 0.004);
    put(plates, L.knee, new THREE.SphereGeometry(0.075 * rl, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.7, 1), trim, 0, -0.01, 0.03, Math.PI / 2 - 0.2); // knee cap
    if (light) put(lights, L.knee, new THREE.BoxGeometry(0.012, 0.2, 0.008), light, 0, -0.2, 0.079 * rl * 0.98);
  }
  if (light) {
    const zf = rTop * 0.7 + 0.004; // the front of the chest plate
    put(lights, chest, new THREE.CircleGeometry(0.036, 14), light, 0, 0.36, zf + 0.003);
    put(lights, chest, new THREE.RingGeometry(0.05, 0.058, 16), light, 0, 0.36, zf + 0.002);
    for (const s of [-1, 1]) put(lights, chest, new THREE.BoxGeometry(0.012, 0.2, 0.006), light, s * 0.1 * S, 0.33, zf - 0.02 * S, 0, s * 0.18);
    put(lights, chest, new THREE.BoxGeometry(0.012, 0.24, 0.006), light, 0, 0.33, -zf - 0.002); // the spine
  }
  if (A.helmet !== false) {
    // over the masked head: a shell down to the ears and a band of visor across the eyes
    const c = headBox.getCenter(new THREE.Vector3()), sz = headBox.getSize(new THREE.Vector3());
    head.worldToLocal(c);
    const hx = sz.x * 0.56, hy = sz.y * 0.56, hz = sz.z * 0.57;
    put(plates, head, new THREE.SphereGeometry(1, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.6).scale(hx, hy, hz), plate, c.x, c.y + sz.y * 0.02, c.z - sz.z * 0.02);
    put(plates, head, new THREE.SphereGeometry(1, 14, 5, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.58, Math.PI * 0.22).scale(hx, hy, hz), plate, c.x, c.y + sz.y * 0.02, c.z - sz.z * 0.02); // the back and the sides, lower
    put(light ? lights : plates, head, new THREE.SphereGeometry(1, 14, 4, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.4, Math.PI * 0.17).scale(hx * 1.03, hy * 1.03, hz * 1.04), visor, c.x, c.y + sz.y * 0.02, c.z - sz.z * 0.02);
    put(plates, head, new THREE.BoxGeometry(0.012, 0.03, sz.z * 0.9), trim, c.x, c.y + hy + 0.006, c.z - sz.z * 0.05); // a ridge over the top
  }
  const gear = {
    plates: bakeParts(root, bones, body, plates, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.55, side: THREE.DoubleSide, emissive: A.glow || '#000000', emissiveIntensity: A.glow ? 0.04 : 0 })),
    glow: lights.length ? bakeParts(root, bones, body, lights, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false })) : null,
  };
  if (gear.glow) gear.glow.castShadow = false;
  for (const m of [plate, trim, light, visor]) m?.dispose();
  gear.plates.name = `${spec.id}-armor`;
  gear.plates.visible = A.on !== false;
  if (gear.glow) gear.glow.visible = A.on !== false;
  return gear;
}

// spec.shield { color, stripe }: a riot shield held up in front of the chest: a tall curved plate with a
// stripe and a small window (one mesh; model.setShield(false) puts it away)
function buildShield(spec, chest) {
  const S = spec.shield, col = (g, hex) => { const c = new THREE.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; };
  const R = 0.62, arc = (h, t, y, r = R) => new THREE.CylinderGeometry(r, r, h, 10, 1, true, -t / 2, t).translate(0, y, -R);
  const geo = mergeGeometries([
    col(arc(1.06, 0.92, 0), S.color || '#1b1d22'),
    col(arc(0.07, 0.94, 0.14, R + 0.004), S.stripe || '#6e1a1e'),
    col(arc(0.1, 0.5, 0.36, R + 0.004), '#9fb4c4'),            // the window
    col(arc(0.03, 0.94, 0.53, R + 0.003), '#0c0d10'), col(arc(0.03, 0.94, -0.53, R + 0.003), '#0c0d10'), // rims
  ]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }));
  mesh.name = `${spec.id}-shield`;
  mesh.castShadow = true;
  mesh.position.set(0.07, 0.1, 0.4);
  mesh.rotation.set(-0.06, 0.12, 0);
  chest.add(mesh);
  return mesh;
}

// spec.energy { color, rim, core }: a being of energy, not a person (chapter ten's "שומר הסף"). A tall body
// of light that tapers to a wisp over the ground, wide shoulders of light, a faceless head with a ring
// over it, a bright core in the chest, two long blades floating where arms would be and shards circling
// its waist. It drifts: nothing of it walks. One translucent material for the body (a glowing rim, bands
// of light climbing it), five draw calls. The same handles as a person's model, so an Npc can carry it:
// setPose('aim' | 'guard': blades forward; 'down': collapsed and dim), play(name, { onHit, onDone }) runs
// a surge of light with the same callbacks, flash(), setOpacity(), dispose().
const ENERGY_VERT = `
varying vec3 vN; varying vec3 vV; varying float vY;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix * mv; }`;
const ENERGY_FRAG = `
uniform vec3 uColor; uniform vec3 uRim; uniform float uOpacity; uniform float uTime; uniform float uFlash; uniform float uDim;
varying vec3 vN; varying vec3 vV; varying float vY;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(f, 1.6);
  float band = 0.5 + 0.5 * sin(vY * 9.0 - uTime * 3.2);
  vec3 c = uColor * (0.55 + 0.35 * band) + uRim * (rim * 1.5 + band * 0.12) + vec3(uFlash);
  float a = uOpacity * uDim * clamp(0.34 + 0.75 * rim + 0.1 * band, 0.0, 1.0);
  gl_FragColor = vec4(c * uDim, a);
}`;
function makeEnergyBeing(spec) {
  const E = { color: '#5a48ff', rim: '#b7a6ff', core: '#e4f6ff', ...spec.energy };
  const uniforms = { uColor: { value: new THREE.Color(E.color) }, uRim: { value: new THREE.Color(E.rim) }, uOpacity: { value: 1 }, uTime: { value: 0 }, uFlash: { value: 0 }, uDim: { value: 1 } };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: ENERGY_VERT, fragmentShader: ENERGY_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const coreMat = new THREE.MeshBasicMaterial({ color: E.core, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const root = new THREE.Group();
  root.name = spec.id;
  const float = new THREE.Group(); // everything bobs together
  root.add(float);
  const mk = (geo, material = mat) => { const o = new THREE.Mesh(geo, material); o.frustumCulled = false; o.renderOrder = 3; return o; };
  // the body: a wisp near the ground, wide at the hips of the robe, a waist, shoulders, a neck
  const prof = [[0.02, 0.0], [0.07, 0.25], [0.3, 0.75], [0.4, 1.15], [0.3, 1.6], [0.25, 1.85], [0.5, 2.15], [0.46, 2.28], [0.14, 2.44], [0.1, 2.52], [0.0, 2.54]];
  const bodyGeo = mergeGeometries([
    new THREE.LatheGeometry(prof.map(([x, y]) => V(x, y)), 20).scale(1, 1, 0.62),
    new THREE.OctahedronGeometry(0.2, 1).scale(0.8, 1.35, 0.85).translate(0, 2.84, 0),               // the head: no face
    new THREE.TorusGeometry(0.3, 0.018, 6, 28).rotateX(Math.PI / 2 - 0.25).translate(0, 3.12, -0.06), // the ring over it
  ].map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
  const body = mk(bodyGeo);
  body.name = `${spec.id}-body`;
  float.add(body);
  const core = mk(new THREE.SphereGeometry(0.13, 12, 8), coreMat);
  core.position.set(0, 2.02, 0.04);
  float.add(core);
  const blade = () => new THREE.OctahedronGeometry(0.11, 0).scale(0.7, 6.2, 0.45).translate(0, -0.62, 0);
  const armL = mk(blade()), armR = mk(blade());
  armL.position.set(0.72, 2.2, 0); armR.position.set(-0.72, 2.2, 0);
  float.add(armL, armR);
  const shardGeo = mergeGeometries(Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2; return new THREE.OctahedronGeometry(0.07, 0).scale(0.6, 2.4 + (i % 2) * 0.9, 0.6).rotateZ(0.3).translate(Math.cos(a) * 0.72, (i % 3) * 0.16, Math.sin(a) * 0.72); }).map((g) => { g.deleteAttribute('uv'); return g; }));
  const shards = mk(shardGeo);
  shards.position.y = 1.35;
  float.add(shards);
  const chest = new THREE.Group(); chest.position.set(0, 2.0, 0); float.add(chest); // for anything laid on it
  root.scale.setScalar(spec.height || 1);

  let t = 0, pose = null, raise = 0, sink = 0, flash = 0, action = null, lean = 0;
  function animate(dt, speed = 0) {
    t += dt;
    uniforms.uTime.value = t;
    raise += ((pose === 'aim' || pose === 'guard' || pose === 'block' ? 1 : 0) - raise) * Math.min(1, dt * 6);
    sink += ((pose === 'down' || pose === 'floored' ? 1 : 0) - sink) * Math.min(1, dt * 3);
    lean += (Math.min(1, speed / 3) - lean) * Math.min(1, dt * 4);
    let surge = 0;
    if (action) {
      action.t += dt * action.speed;
      const u = Math.min(1, action.t / action.dur);
      surge = Math.sin(u * Math.PI);
      if (!action.landed && u >= 0.45) { action.landed = true; action.onHit?.(); }
      if (u >= 1) { const done = action.onDone; action = null; done?.(); }
    }
    float.position.y = 0.22 + Math.sin(t * 1.3) * 0.08 - sink * 0.2;
    float.scale.set(1 + sink * 0.25, 1 - sink * 0.62, 1 + sink * 0.25);
    float.rotation.x = lean * 0.16 + surge * 0.1;
    const sway = Math.sin(t * 0.9) * 0.12;
    armL.rotation.set(-raise * 1.35 - surge * 0.5, 0, 0.16 + sway * 0.5 + raise * 0.1);
    armR.rotation.set(-raise * 1.35 - surge * 0.5, 0, -0.16 + sway * 0.5 - raise * 0.1);
    armL.position.y = armR.position.y = 2.2 + Math.sin(t * 1.7) * 0.05;
    shards.rotation.y = t * (0.7 + raise * 1.2 + surge * 3);
    core.scale.setScalar(1 + 0.16 * Math.sin(t * 4.2) + surge * 0.6 + flash * 0.5);
    uniforms.uDim.value = 1 - sink * 0.55;
    if (flash > 0) flash = Math.max(0, flash - dt * 4);
    uniforms.uFlash.value = flash * 0.7 + surge * 0.18;
  }
  animate(0);
  return {
    root, spec, body, energy: true, bones: { chest, head: chest, hips: float }, animate,
    setPose(name) { pose = name || null; },
    get pose() { return pose; },
    play(name, { onHit, onDone, speed = 1 } = {}) { action = { name, t: 0, dur: 0.6, speed, onHit, onDone, landed: false }; return true; },
    get action() { return action?.name || null; },
    flash(amount = 1) { flash = amount; },
    setOpacity(a) { uniforms.uOpacity.value = a; coreMat.opacity = 0.95 * a; },
    get opacity() { return uniforms.uOpacity.value; },
    setShadow() {}, setArmor() {}, setShield() {},
    handR: { bone: armR, offset: new THREE.Vector3(0, -1.2, 0) },
    dispose() { bodyGeo.dispose(); shardGeo.dispose(); armL.geometry.dispose(); armR.geometry.dispose(); core.geometry.dispose(); mat.dispose(); coreMat.dispose(); },
  };
}

// detail: 'high' for the main cast, 'low' for passers-by
// Optional parts beyond the clothes (chapter nine's people use them; any spec may):
//   mask: { color }    a balaclava over the head and neck with an eye slit (head.js)
//   gloves: { color }  the hands in gloves
//   band: { color, arm: 'left' | 'right' | 'both' }  a band round the upper arm, over the sleeve
//   vest: { color }    a tactical vest over the top, with three pouches in front
// Chapter ten (their own meshes, so they can be put on and taken off):
//   armor: { color, glow, visor, helmet, on }  plates over the clothes (see buildArmor); model.setArmor(on)
//   shield: { color, stripe }                  a riot shield held in front of the chest; model.setShield(on)
//   energy: { color, rim, core }               not a person at all: a being of light (see makeEnergyBeing)
export function makeCharacter(spec, { detail = 'high' } = {}) {
  if (spec.energy) return makeEnergyBeing(spec);
  const b = { shoulders: 1, arms: 1, legs: 1, ...spec.build };
  const m = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
  const mat = {
    skin: m(spec.skin, 0.72),
    top: m(spec.top.color, 0.9), topCuff: m(shade(spec.top.color, 0.78), 0.9), bottom: m(spec.bottom.color, 0.9), cuff: m(shade(spec.bottom.color, 0.8), 0.9),
    shoe: m(spec.shoes.color, 0.7), sole: m(spec.shoes.sole, 0.8), accent: m(spec.shoes.accent || spec.shoes.sole, 0.6),
    metal: m('#c9ccd1', 0.25, { metalness: 0.9 }), watch: m('#18191b', 0.5),
    neck: spec.mask ? m(spec.mask.color || '#111114', 0.95) : null,
    hand: spec.gloves ? m(spec.gloves.color || '#141416', 0.7) : null,
    band: spec.band ? m(spec.band.color || '#6e1a1e', 0.85) : null,
    vest: spec.vest ? m(spec.vest.color || '#1c1e22', 0.8) : null,
  };
  mat.neck ||= mat.skin;
  mat.hand ||= mat.skin;
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
  chest.add(mesh(spec.mask ? cyl(0.056, 0.062, 0.1, 10) : cyl(0.052, 0.058, 0.1, 10), mat.neck, 0, 0.57, 0.005)); // a mask covers the neck too
  if (spec.vest) {
    // the torso's radius at a height y (0.5 at the shoulders), the vest a little outside it
    const rAt = (y) => (0.178 + (0.205 * b.shoulders - 0.178) * Math.min(1, Math.max(0, (y - (0.5 - torsoH)) / torsoH))) * bulk;
    const y0 = 0.15, y1 = 0.46, out = 1.075, d = 0.66;
    chest.add(mesh(cyl(rAt(y1) * out, rAt(y0) * out, y1 - y0, 16).scale(1, 1, d), mat.vest, 0, (y0 + y1) / 2, 0));
    const front = rAt(0.24) * out * d;
    for (const x of [-0.065, 0, 0.065]) chest.add(mesh(new THREE.BoxGeometry(0.052, 0.07, 0.026), mat.vest, x, 0.24, front + 0.006));
    for (const s of [-1, 1]) chest.add(mesh(new THREE.BoxGeometry(0.05, 0.02, 0.2 * b.shoulders), mat.vest, s * 0.11 * b.shoulders, 0.495, 0)); // straps over the shoulders
  }
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
  if (spec.earbud) { // a white wireless earbud in the right ear (the ear is the head's widest point)
    const bb = new THREE.Box3().setFromObject(headParts), white = m('#f2f2f0', 0.4);
    const bud = mesh(cyl(0.0105, 0.0105, 0.016, 8), white, bb.min.x + 0.004, 0.002, -0.006);
    bud.rotation.z = Math.PI / 2;
    const stem = mesh(cyl(0.0042, 0.0042, 0.026, 6), white, bb.min.x + 0.003, -0.016, -0.002);
    stem.rotation.z = 0.22;
    headParts.add(bud, stem);
  }

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
    // a band round the upper arm, over the sleeve (or the bare arm of a tank top); s > 0 is the left arm
    if (spec.band && (spec.band.arm === 'both' || (spec.band.arm === 'right' ? s < 0 : s > 0))) {
      const r = top === 'tank' ? 0.058 : top === 'zip' ? 0.073 : top === 'oversized' ? 0.088 : 0.074;
      shoulder.add(mesh(cyl(r * ra, r * ra * 0.985, 0.062, 14, true), mat.band, 0, -0.115, 0));
    }
    const elbow = pivot(0, -0.29, 0);
    shoulder.add(elbow);
    elbow.add(mesh(limb(0.043 * ra, 0.036 * ra, 0.25), mat.skin));
    if (top === 'zip') {
      elbow.add(mesh(tube(0.06 * ra, 0.052 * ra, 0.215, 0.04 * ra), mat.top));
      elbow.add(mesh(cyl(0.05 * ra, 0.047 * ra, 0.035, 14, true), mat.topCuff, 0, -0.232, 0));
    }
    // hand: palm turned toward the thigh, fingers curled a little, thumb in front (gloved: a little fuller, with a cuff)
    const gl = spec.gloves ? 1.08 : 1;
    elbow.add(mesh(sph(0.034 * gl, 12, 8).scale(0.46, 1.05, 0.85), mat.hand, -s * 0.002, -0.285, 0));
    elbow.add(mesh(sph(0.03 * gl, 12, 8).scale(0.5, 0.9, 0.85), mat.hand, -s * 0.008, -0.322, 0.004));
    elbow.add(mesh(new THREE.CapsuleGeometry(0.0085 * gl, 0.022, 2, 8).rotateX(0.45), mat.hand, -s * 0.004, -0.284, 0.026));
    if (spec.gloves) elbow.add(mesh(cyl(0.039 * ra, 0.037 * ra, 0.03, 12, true), mat.hand, 0, -0.252, 0));
    if (spec.watch && s > 0) elbow.add(mesh(cyl(0.041, 0.041, 0.03, 14), mat.watch, 0, -0.215, 0));
    if (spec.beads && s > 0) { // a bracelet of small dark beads
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; elbow.add(mesh(sph(0.0075, 6, 4), mat.watch, Math.cos(a) * 0.04, -0.222, Math.sin(a) * 0.036)); }
    }
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
      const loose = bottom === 'cargo' ? 1.1 : 1;
      hip.add(mesh(limb(0.086 * rl * loose, 0.066 * rl * loose, 0.44), mat.bottom));
      knee.add(mesh(limb(0.064 * rl * loose, (bottom === 'pants' || bottom === 'cargo' ? 0.058 : 0.05) * rl * loose, 0.42), mat.bottom));
      if (bottom === 'joggers') knee.add(mesh(cyl(0.056 * rl, 0.054 * rl, 0.05, 14, true), mat.cuff, 0, -0.39, 0));
      // cargo: a flap pocket on the outside of each thigh
      if (bottom === 'cargo') hip.add(mesh(new THREE.BoxGeometry(0.035, 0.15, 0.12), mat.cuff, s * 0.083 * rl, -0.27, 0.005));
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
  const headBox = spec.armor ? (root.updateMatrixWorld(true), new THREE.Box3().setFromObject(headParts)) : null;
  const body = bake(root, bones, texture);
  const gear = spec.armor ? buildArmor(spec, b, { root, bones, body, chest, head, headBox, arms, legs, hips }) : null;
  const shield = spec.shield ? buildShield(spec, chest) : null;
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
    if (gear?.glow?.visible) { const k = 0.82 + 0.22 * Math.sin(t * 3.1); gear.glow.material.color.setRGB(k, k, k); } // the suit's light breathes
  }

  let flash = 0, opacity = 1;
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
    // chapter ten: the plates (spec.armor) put on or taken off; the riot shield (spec.shield) up or put away
    setArmor(on) { if (gear) { gear.plates.visible = !!on; if (gear.glow) gear.glow.visible = !!on; } },
    get armor() { return !!gear?.plates.visible; },
    setShield(on) { if (shield) shield.visible = !!on; },
    get shield() { return !!shield?.visible; },
    // the whole figure faded (an energy foe that goes and comes back): 1 is solid as always
    setOpacity(a) {
      opacity = a;
      for (const m of [body.material, gear?.plates.material, gear?.glow?.material, shield?.material]) if (m) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a >= 1; }
    },
    get opacity() { return opacity; },
    // no shadow on the ground (a copy made of light)
    setShadow(on) { body.castShadow = !!on; if (gear) gear.plates.castShadow = !!on; if (shield) shield.castShadow = !!on; },
    dispose() {
      body.geometry.dispose(); body.material.map.dispose(); body.material.dispose();
      if (gear) { gear.plates.geometry.dispose(); gear.plates.material.dispose(); gear.glow?.geometry.dispose(); gear.glow?.material.dispose(); }
      if (shield) { shield.geometry.dispose(); shield.material.dispose(); }
    },
  };
}
