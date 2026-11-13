// The people of Katzir lining the road home (chapter ten's last mission): families, children, old people,
// in all kinds of clothes and skin tones, who clap, wave, cheer and hop, some holding up signs, and turn to
// face the gang as they walk by. Invented people.
//
// Cheap enough for a phone: the whole crowd, signs and all, is ONE instanced mesh (one draw call, one
// more in the sun's shadow pass). Every figure is the same small merged body (about 600 triangles: head,
// hair, eyes, a smile, a torso, two arms, legs, shoes, and parts that only some wear: long hair, a skirt, a
// cap, a sign). Per person the instance carries its colours (packed in floats), which optional parts it
// wears, its size (children are smaller), the angles of its two arms, and which sign it holds; the vertex
// shader swings the arms about the shoulders and folds away the parts a person does not wear. The CPU
// work per frame is a few lines of trigonometry per person and one small buffer upload.
//
// No colliders at all: nobody can be blocked, and nobody stands in the walking lane (the lane's half-width
// plus a margin is kept clear). Whoever walks right up to a person (the player, or anyone in `walkers`)
// sees him step back out of the way and return.
//
//   const crowd = new Crowd(game, { along: [{ x, z }, ...], count: 36 });  // both sides of that path
//   crowd.cheer(0.4);           // 0 standing, ~0.3 clapping, ~0.6 waving and calling, 1 jumping, arms up
//   crowd.lookAt(point | null); // everyone turns to face a point (the walkers), or back to the road
//   crowd.dispose();
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// the three signs of the spec, word for word
export const SIGNS = ['תודה שהצלתם אותנו!', 'הגיבורים של קציר!', 'נהוראי והחבורה!'];

// colour slots of the figure's parts
const SKIN = 0, HAIR = 1, TOP = 2, BOTTOM = 3, LEGS = 4, SHOES = 5, DARK = 6, BOARD = 7, CARD = 8, ACCENT = 9;
// limbs (what moves a vertex): the body, the left arm (+x), the right arm (-x), the sign
const BODY = 0, ARM_L = 1, ARM_R = 2, SIGN = 3;
// optional parts (bits of the person's mask)
const LONG = 1, SKIRT = 2, CAP = 4, HOLD = 8;

const SHOULDER_Y = 1.39, SHOULDER_X = 0.215, ARM = 0.6;
const SIGN_W = 1.1, SIGN_H = 0.55, SIGN_Y = 1.92, SIGN_Z = 0.17; // the board's lower edge, held up over the head

// the figure: one adult 1.75 m tall facing +z, feet at the origin
function figure() {
  const parts = [];
  const add = (geo, slot, limb = BODY, opt = 0, { x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0 } = {}) => {
    geo.scale(sx, sy, sz);
    if (rx) geo.rotateX(rx);
    geo.translate(x, y, z);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = slot; a[i * 3 + 1] = limb; a[i * 3 + 2] = opt; }
    g.setAttribute('aPart', new THREE.BufferAttribute(a, 3));
    parts.push(g);
  };
  const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r1, r0, h, n, 1, false); // r0 at the bottom
  const sph = (r, w = 10, h = 7) => new THREE.SphereGeometry(r, w, h);
  // legs, shoes, hips
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(0.1, 0.08, 0.25), SHOES, BODY, 0, { x: s * 0.09, y: 0.04, z: 0.035 });
    add(cyl(0.056, 0.066, 0.44, 8), LEGS, BODY, 0, { x: s * 0.09, y: 0.3 });
    add(cyl(0.07, 0.088, 0.42, 8), BOTTOM, BODY, 0, { x: s * 0.09, y: 0.71 });
  }
  add(cyl(0.17, 0.17, 0.16, 12), BOTTOM, BODY, 0, { y: 0.92, sz: 0.7 });
  add(cyl(0.27, 0.17, 0.5, 14), BOTTOM, BODY, SKIRT, { y: 0.74, sz: 0.8 }); // a skirt or a dress's hem
  // the torso and the shoulders
  add(cyl(0.165, 0.2, 0.44, 12), TOP, BODY, 0, { y: 1.2, sz: 0.62 });
  add(new THREE.SphereGeometry(0.2, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), TOP, BODY, 0, { y: 1.42, sy: 0.34, sz: 0.62 });
  add(cyl(0.05, 0.05, 0.1, 8), SKIN, BODY, 0, { y: 1.47 });
  // the head: face, ears, eyes, a smile, hair (short, or long down the back), a cap
  add(sph(0.118, 12, 9), SKIN, BODY, 0, { y: 1.62, sx: 0.9, sy: 1.06 });
  for (const s of [-1, 1]) {
    add(sph(0.026, 6, 4), SKIN, BODY, 0, { x: s * 0.106, y: 1.615, sz: 0.6 });
    add(sph(0.016, 6, 4), DARK, BODY, 0, { x: s * 0.039, y: 1.638, z: 0.106, sz: 0.5 });
  }
  add(new THREE.SphereGeometry(0.03, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), DARK, BODY, 0, { y: 1.585, z: 0.108, sy: 0.55, sz: 0.4 }); // the lower half of a ball: a smile
  add(new THREE.SphereGeometry(0.127, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), HAIR, BODY, 0, { y: 1.64, z: -0.02, sx: 0.92, sy: 1.1 }); // set back: the hairline above the eyes
  add(new THREE.CylinderGeometry(0.115, 0.135, 0.3, 10, 1, true, Math.PI * 0.55, Math.PI * 0.9), HAIR, BODY, LONG, { y: 1.5, z: -0.02, sz: 0.85 }); // open to the front
  add(new THREE.SphereGeometry(0.135, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), ACCENT, BODY, CAP, { y: 1.69, sx: 0.92, sy: 0.75 });
  add(new THREE.BoxGeometry(0.2, 0.014, 0.1), ACCENT, BODY, CAP, { y: 1.695, z: 0.13 });
  // the arms hang from the shoulders: a short sleeve, the forearm, the hand
  for (const [s, limb] of [[1, ARM_L], [-1, ARM_R]]) {
    add(cyl(0.056, 0.066, 0.27, 8), TOP, limb, 0, { x: s * SHOULDER_X, y: SHOULDER_Y - 0.125 });
    add(cyl(0.04, 0.05, 0.32, 8), SKIN, limb, 0, { x: s * SHOULDER_X, y: SHOULDER_Y - 0.4 });
    add(sph(0.047, 8, 6), SKIN, limb, 0, { x: s * SHOULDER_X, y: SHOULDER_Y - ARM, sz: 0.8 });
  }
  // the sign, held up over the head in both hands: the painted front (uv into the sign's row of the
  // texture) and the cardboard back
  add(new THREE.PlaneGeometry(SIGN_W, SIGN_H), BOARD, SIGN, HOLD, { y: SIGN_Y + SIGN_H / 2, z: SIGN_Z + 0.006 });
  const back = new THREE.PlaneGeometry(SIGN_W, SIGN_H); back.rotateY(Math.PI);
  add(back, CARD, SIGN, HOLD, { y: SIGN_Y + SIGN_H / 2, z: SIGN_Z - 0.006 });
  const geo = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return geo;
}

// the signs painted on one canvas, a row each: big, bold, right to left, two lines when one would be small
function paintSigns(texts) {
  const W = 640, H = 320, ROWS = 3, c = document.createElement('canvas');
  c.width = W; c.height = H * ROWS;
  const g = c.getContext('2d');
  const looks = [
    { bg: '#fbf8ee', ink: '#1d4fc4', rim: '#2a6ad8' },
    { bg: '#ffeea6', ink: '#c3201f', rim: '#e0a21a' },
    { bg: '#e2f2e4', ink: '#17603a', rim: '#3e9c62' },
  ];
  const font = (px) => `900 ${px}px system-ui, -apple-system, "Segoe UI", "Noto Sans Hebrew", "Arial Hebrew", Arial, sans-serif`;
  for (let i = 0; i < ROWS; i++) {
    const text = texts[i % texts.length], L = looks[i % looks.length], y0 = i * H;
    g.fillStyle = L.bg; g.fillRect(0, y0, W, H);
    g.strokeStyle = L.rim; g.lineWidth = 14; g.strokeRect(10, y0 + 10, W - 20, H - 20);
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = L.ink;
    // one line if it can be big, else two lines split at the space nearest the middle
    let lines = [text], px = 132;
    g.font = font(px);
    if (g.measureText(text).width > W * 0.86 * (px / 110)) {
      const words = text.split(' ');
      let best = null;
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
        const w = Math.max(g.measureText(a).width, g.measureText(b).width);
        if (!best || w < best.w) best = { lines: [a, b], w };
      }
      if (best) lines = best.lines;
    }
    const widest = Math.max(...lines.map((l) => g.measureText(l).width));
    px = Math.min(lines.length > 1 ? 118 : 132, Math.floor(px * (W * 0.86) / Math.max(1, widest)));
    g.font = font(px);
    const step = px * 1.08, top = y0 + H / 2 - (step * (lines.length - 1)) / 2;
    lines.forEach((l, k) => g.fillText(l, W / 2, top + k * step));
  }
  c.dataset.signs = JSON.stringify(texts); // the texts as painted, row by row (read back by the tests)
  return c;
}

// a seeded random (the crowd looks the same every time it is built)
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SKINS = ['#f3d6bd', '#ebc4a0', '#dcae84', '#c99366', '#b07a50', '#8f5c3a', '#6e432a', '#54321f'];
const HAIRS = ['#16110d', '#2a1c13', '#3f2a1c', '#5e4129', '#8a6238', '#c49a5c', '#7a3a1e', '#1e1a18'];
const GREYS = ['#9a9a98', '#c9c8c4', '#e4e2dc'];
const TOPS = ['#e04848', '#3a7bd5', '#f2c230', '#2fa36b', '#f6f4ef', '#22262e', '#9b59b6', '#ff8c42', '#3fbfb3', '#e85d9c', '#7d8c99', '#264653', '#f4a261', '#5b7cfa', '#b5d334', '#c0392b'];
const BOTTOMS = ['#2d3a55', '#3b4c6b', '#1d1e21', '#6b5b45', '#a59378', '#4a4a4a', '#e9e4d4', '#2f4f4f'];
const SKIRTS = ['#7b2d3a', '#2d3a55', '#3a6b5b', '#d9a441', '#5a3f7a', '#1d1e21', '#c2546a'];
const SHOES_C = ['#f2f2ef', '#1e1f22', '#8b5a3c', '#d94848', '#3a5a8c', '#6b6b6b'];
const ACCENTS = ['#d94848', '#2a62c9', '#f2c230', '#1d1e21', '#f6f4ef', '#2fa36b', '#ff8c42'];
const pack = (hex) => parseInt(hex.slice(1), 16); // 0xRRGGBB as a float (exact below 2^24)

// how a person moves: 'clap', 'wave' (one arm high, waving), 'cheer' (both arms up), 'sign' (holds one)
function people(count, signs, seed) {
  const R = rng(0x5ca1ab1e + count * 7 + seed), pick = (a) => a[Math.floor(R() * a.length)];
  const kinds = [];
  // families and neighbours: adults with children between them, teenagers, a few grandparents
  const pattern = ['man', 'woman', 'girl', 'man', 'boy', 'woman', 'teen', 'man', 'woman', 'elder', 'boy', 'woman', 'man', 'girl', 'teen', 'woman', 'man', 'elder'];
  for (let i = 0; i < count; i++) kinds.push(pattern[(i * 7 + Math.floor(i / pattern.length)) % pattern.length]);
  const out = [];
  // who holds a sign: about one in four of the grown-ups and teenagers, the three texts in turn
  const wanted = Math.max(Math.min(signs.length, count), Math.round(count * 0.25));
  const holders = new Set(), H = rng(0xb0a7d + seed), order = [...Array(count).keys()].map((k) => [k, H()]).sort((a, b) => a[1] - b[1]);
  for (const [k] of order) if (holders.size < wanted && kinds[k] !== 'boy' && kinds[k] !== 'girl') holders.add(k);
  for (let i = 0; i < count; i++) {
    const kind = kinds[i], child = kind === 'boy' || kind === 'girl', female = kind === 'woman' || kind === 'girl' || (kind === 'teen' && R() < 0.5) || (kind === 'elder' && R() < 0.5);
    const h = child ? 0.56 + R() * 0.14 : kind === 'teen' ? 0.88 + R() * 0.06 : kind === 'elder' ? 0.93 + R() * 0.04 : (female ? 0.94 : 0.99) + R() * 0.08;
    const wide = 0.94 + R() * (kind === 'elder' ? 0.2 : 0.14);
    let mask = 0;
    if (female && R() < 0.75) mask |= LONG;
    if (female && R() < (child ? 0.5 : 0.4)) mask |= SKIRT;
    if (!female && R() < 0.28) mask |= CAP;
    const skirt = !!(mask & SKIRT);
    const skin = pick(SKINS), shorts = !skirt && R() < 0.25;
    const style = holders.has(i) ? 'sign' : child ? (R() < 0.5 ? 'cheer' : 'wave') : pick(['clap', 'clap', 'wave', 'cheer', 'clap']);
    if (style === 'sign') mask |= HOLD;
    out.push({
      kind, child, h, wide, mask, style,
      sign: 0,                         // which of the texts (the crowd hands them out round each side of the road)
      colors: [skin, kind === 'elder' ? pick(GREYS) : pick(HAIRS), pick(TOPS), skirt ? pick(SKIRTS) : pick(BOTTOMS), skirt || shorts ? skin : null, pick(SHOES_C), pick(ACCENTS)],
      jumper: child || R() < 0.3,
      left: R() < 0.3,                 // waves with the left hand
      rate: 2 + R() * 0.9,             // claps a second
      phase: R() * 10,
      lag: R() * 0.5,                  // how late he turns to look
    });
  }
  for (const p of out) if (!p.colors[4]) p.colors[4] = p.colors[3];
  return out;
}

// a path's point at arc length s: position, direction, and the normal to its left
function pathOf(points) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-3) continue;
    segs.push({ a, b, s: total, len });
    total += len;
  }
  const at = (s) => {
    let q = segs[segs.length - 1];
    for (const g of segs) if (s <= g.s + g.len) { q = g; break; }
    const k = Math.min(1, Math.max(0, (s - q.s) / q.len)), tx = (q.b.x - q.a.x) / q.len, tz = (q.b.z - q.a.z) / q.len;
    return { x: q.a.x + (q.b.x - q.a.x) * k, z: q.a.z + (q.b.z - q.a.z) * k, tx, tz, nx: tz, nz: -tx };
  };
  // the shortest distance from a point to the path
  const dist = (x, z) => {
    let d = Infinity;
    for (const g of segs) {
      const tx = (g.b.x - g.a.x) / g.len, tz = (g.b.z - g.a.z) / g.len, u = Math.min(g.len, Math.max(0, (x - g.a.x) * tx + (z - g.a.z) * tz));
      d = Math.min(d, Math.hypot(x - g.a.x - tx * u, z - g.a.z - tz * u));
    }
    return d;
  };
  return { length: total, at, dist, ok: segs.length > 0 };
}

const VERT_HEAD = /* glsl */`
attribute vec3 aPart;
attribute vec4 aPalA;
attribute vec4 aPalB;
attribute vec4 aAnim;
attribute vec2 aExtra;
varying vec3 vCrowd;
varying float vSign;
vec3 crowdColor(float c) { return pow(vec3(floor(c / 65536.0), mod(floor(c / 256.0), 256.0), mod(c, 256.0)) / 255.0, vec3(2.2)); }
// the parts this person does not wear fold away; the arms swing about the shoulders (out to the side,
// then forward); the sign rides up and down with the hands
void crowdPose(inout vec3 p, inout vec3 n) {
  float opt = aPart.z;
  if (opt > 0.5 && mod(floor(aPalB.w / opt), 2.0) < 0.5) { p = vec3(0.0); return; }
  float limb = aPart.y;
  if (limb > 0.5 && limb < 2.5) {
    float side = limb < 1.5 ? 1.0 : -1.0;
    vec2 a = limb < 1.5 ? aAnim.xy : aAnim.zw;
    vec3 sh = vec3(${SHOULDER_X.toFixed(3)} * side, ${SHOULDER_Y.toFixed(3)}, 0.0);
    float ab = a.x * side, cz = cos(ab), sz = sin(ab), cx = cos(a.y), sx = sin(a.y);
    vec3 q = p - sh;
    q = vec3(q.x * cz - q.y * sz, q.x * sz + q.y * cz, q.z);
    q = vec3(q.x, q.y * cx - q.z * sx, q.y * sx + q.z * cx);
    n = vec3(n.x * cz - n.y * sz, n.x * sz + n.y * cz, n.z);
    n = vec3(n.x, n.y * cx - n.z * sx, n.y * sx + n.z * cx);
    p = q + sh;
  } else if (limb > 2.5) p.y += aExtra.y;
}
`;

// the colours and the pose go into a Lambert material (and the same pose into the shadow's depth material)
function crowdMaterial(texture) {
  const mat = new THREE.MeshLambertMaterial({ map: texture });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3( normal );\nvec3 crowdP = vec3( position );\ncrowdPose( crowdP, objectNormal );')
      .replace('#include <begin_vertex>', 'vec3 transformed = crowdP;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
  #ifdef USE_MAP
    vMapUv = vec2( uv.x, ( 2.0 - aExtra.x + uv.y ) / 3.0 );
  #endif`)
      .replace('#include <color_vertex>', `#include <color_vertex>
  {
    float slot = aPart.x;
    vec3 c = crowdColor( aPalA.x );
    if ( slot > 0.5 ) c = crowdColor( aPalA.y );
    if ( slot > 1.5 ) c = crowdColor( aPalA.z );
    if ( slot > 2.5 ) c = crowdColor( aPalA.w );
    if ( slot > 3.5 ) c = crowdColor( aPalB.x );
    if ( slot > 4.5 ) c = crowdColor( aPalB.y );
    if ( slot > 5.5 ) c = vec3( 0.025, 0.018, 0.016 );
    if ( slot > 6.5 ) c = vec3( 1.0 );
    if ( slot > 7.5 ) c = vec3( 0.55, 0.42, 0.26 );
    if ( slot > 8.5 ) c = crowdColor( aPalB.z );
    vCrowd = c;
    vSign = slot > 6.5 && slot < 7.5 ? 1.0 : 0.0;
  }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCrowd;\nvarying float vSign;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
    vec4 sampledDiffuseColor = texture2D( map, vMapUv );
    diffuseColor *= mix( vec4( 1.0 ), sampledDiffuseColor, vSign );
  #endif
  diffuseColor.rgb *= vCrowd;`);
  };
  mat.customProgramCacheKey = () => 'crowd-v1';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = vec3( position );\nvec3 crowdN = vec3( 0.0, 1.0, 0.0 );\ncrowdPose( transformed, crowdN );');
  };
  depth.customProgramCacheKey = () => 'crowd-depth-v1';
  return { mat, depth };
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Crowd {
  // at: { x, z, yaw } the middle of the crowd; with no `along`, the walking lane is a straight line through
  //   it in the direction yaw (forward is (sin yaw, cos yaw)), `length` metres long
  // along: [{ x, z }, ...] the walking lane's centre line (the crowd stands on both sides of it), or an
  //   area { x0, x1, z0, z1 } the crowd fills, facing `at` (no lane through it then)
  // count: how many people (at least 30 for the finale); signs: the texts held up (the spec's three)
  // lane: the half-width of the walking lane kept clear (m); depth: how many rows deep each side stands
  // walkers: positions (anything with x and z) people step back from; the player by default
  constructor(game, { at = null, along = null, count = 36, signs = SIGNS, lane = 3.2, depth = 2, length = 60, walkers = null, seed = 0 } = {}) {
    this.game = game;
    this.signTexts = signs.slice(0, 3);
    this.count = Math.max(1, Math.floor(count));
    this.lane = lane;
    this.level = 0; this.target = 0;
    this.look = null;
    this.walkers = walkers || [game.player?.pos].filter(Boolean);
    this.t = 0;
    this.disposed = false;
    const world = game.world, ground = (x, z) => world.groundHeight(x, z);
    const blocked = (x, y, z) => !!world.cols?.blocks?.(x, y + 0.9, z, null);

    // where each one stands, and which way he faces when nobody walks by
    const list = people(this.count, this.signTexts, seed | 0);
    this.people = list;
    let path = null;
    if (Array.isArray(along) && along.length >= 2) path = pathOf(along);
    else if (!along && at) {
      const yaw = at.yaw || 0, fx = Math.sin(yaw), fz = Math.cos(yaw);
      path = pathOf([{ x: at.x - fx * length / 2, z: at.z - fz * length / 2 }, { x: at.x + fx * length / 2, z: at.z + fz * length / 2 }]);
    }
    this.path = path?.ok ? path : null;
    if (this.path) {
      // both sides of the lane: front row children and the short, back rows the tall and the signs
      const P = this.path, sides = [[], []];
      list.forEach((p, i) => sides[i % 2].push(p));
      sides.forEach((side, k) => {
        const s0 = Math.min(3, P.length * 0.1), span = Math.max(1, P.length - 2 * s0), n = side.length, sgn = k === 0 ? 1 : -1;
        side.forEach((p, j) => {
          const s = s0 + ((j + 0.5) / n) * span + (rng(j * 31 + k * 977 + 7)() - 0.5) * Math.min(0.9, span / n * 0.35);
          const rowK = p.child ? 0 : p.style === 'sign' ? Math.min(depth - 1, 1) : (j % depth);
          const base = lane + 0.75 + rowK * 0.85 + rng(j * 17 + k * 131)() * 0.3, q = P.at(s), y0 = ground(q.x, q.z);
          // a spot on open ground near the road's level: stepped further out until nothing solid stands there
          let x = 0, z = 0;
          for (const extra of [0, 0.6, 1.2, 1.9, 2.7, 3.6, -0.3]) {
            const off = Math.max(lane + 0.6, base + extra);
            x = q.x + q.nx * off * sgn; z = q.z + q.nz * off * sgn;
            const y = ground(x, z);
            if (Math.abs(y - y0) < 1.2 && !blocked(x, y, z)) break;
          }
          if (p.style === 'sign') p.sign = (k + side.slice(0, j).filter((o) => o.style === 'sign').length) % this.signTexts.length; // each side shows all the texts in turn
          p.x = x; p.z = z; p.nx = -q.nx * sgn; p.nz = -q.nz * sgn; // the way back to the lane
          p.face = Math.atan2(p.nx, p.nz) + (rng(j * 5 + k)() - 0.5) * 0.5;
        });
      });
    } else {
      // an area: rows across it, everyone facing `at` (or north when there is none)
      const A = along || { x0: (at?.x ?? 0) - 10, x1: (at?.x ?? 0) + 10, z0: (at?.z ?? 0) - 6, z1: (at?.z ?? 0) + 6 };
      const w = A.x1 - A.x0, d = A.z1 - A.z0, cols = Math.max(1, Math.ceil(Math.sqrt(this.count * w / Math.max(1, d)))), rows = Math.ceil(this.count / cols);
      list.forEach((p, i) => {
        const c = i % cols, r = Math.floor(i / cols), R = rng(i * 13 + 5);
        p.x = A.x0 + ((c + 0.5) / cols) * w + (R() - 0.5) * 0.6; p.z = A.z0 + ((r + 0.5) / rows) * d + (R() - 0.5) * 0.6;
        const tx = (at?.x ?? p.x) - p.x, tz = (at?.z ?? p.z + 1) - p.z, l = Math.hypot(tx, tz) || 1;
        p.nx = tx / l; p.nz = tz / l; p.face = Math.atan2(p.nx, p.nz);
      });
      let row = 0;
      for (const p of list) if (p.style === 'sign') p.sign = row++ % this.signTexts.length;
    }
    for (const p of list) { p.y = ground(p.x, p.z); p.yaw = p.face; p.push = 0; p.wait = 0; }

    // the mesh: one instanced figure for everybody
    this.canvas = paintSigns(this.signTexts);
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.geometry = figure();
    const n = list.length;
    const palA = new Float32Array(n * 4), palB = new Float32Array(n * 4);
    this.anim = new Float32Array(n * 4); this.extra = new Float32Array(n * 2);
    list.forEach((p, i) => {
      const c = p.colors;
      palA.set([pack(c[0]), pack(c[1]), pack(c[2]), pack(c[3])], i * 4);
      palB.set([pack(c[4]), pack(c[5]), pack(c[6]), p.mask], i * 4);
      this.extra[i * 2] = p.sign;
    });
    const G = this.geometry;
    G.setAttribute('aPalA', new THREE.InstancedBufferAttribute(palA, 4));
    G.setAttribute('aPalB', new THREE.InstancedBufferAttribute(palB, 4));
    this.animAttr = new THREE.InstancedBufferAttribute(this.anim, 4).setUsage(THREE.DynamicDrawUsage);
    this.extraAttr = new THREE.InstancedBufferAttribute(this.extra, 2).setUsage(THREE.DynamicDrawUsage);
    G.setAttribute('aAnim', this.animAttr);
    G.setAttribute('aExtra', this.extraAttr);
    const { mat, depth: depthMat } = crowdMaterial(this.texture);
    this.material = mat; this.depthMaterial = depthMat;
    this.mesh = new THREE.InstancedMesh(G, mat, n);
    this.mesh.name = 'crowd';
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.customDepthMaterial = depthMat;
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    // bounds that hold everyone however they move (the renderer then culls the crowd as one)
    let cx = 0, cz = 0, cy = 0;
    for (const p of list) { cx += p.x; cz += p.z; cy += p.y; }
    cx /= n; cz /= n; cy /= n;
    let r = 0;
    for (const p of list) r = Math.max(r, Math.hypot(p.x - cx, p.z - cz) + 1.5, Math.abs(p.y - cy) + 3.2);
    this.center = new THREE.Vector3(cx, cy + 1.2, cz);
    this.mesh.boundingSphere = new THREE.Sphere(this.center.clone(), r + 2);
    this.mesh.frustumCulled = true;
    // scratch for the frame (nothing is allocated per frame)
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
    this.write(0);
    game.scene.add(this.mesh);
    // it moves by itself (the game's frame calls it); update(dt) can also be called by hand on a held game
    this.activity = { update: (dt) => this.update(dt) };
    game.activities?.push(this.activity);
    this.sounding = false;
  }

  // 0 standing quietly .. 0.3 clapping .. 0.6 waving and calling .. 1 jumping with the arms up; the level
  // eases in over about a second. The crowd's sound follows (sound.crowd, when the game has it)
  cheer(level = 0.7) {
    this.target = Math.min(1, Math.max(0, Number(level) || 0));
    const s = this.game.sound;
    if (typeof s?.crowd === 'function') {
      if (this.target > 0.02) { s.crowd(true, { intensity: this.target }); this.sounding = true; } else if (this.sounding) { s.crowd(false, { seconds: 1.2 }); this.sounding = false; }
    }
    return this;
  }

  // everyone turns (each a moment after the other) to face a point, never turning his back on the road;
  // null: back to facing the road
  // A live position (game.player.pos, a friend's npc.pos) is followed as it moves
  lookAt(point) {
    if (point && Number.isFinite(point.x) && Number.isFinite(point.z)) {
      if (!this.look) for (const p of this.people) p.wait = p.lag;
      this.look = point;
    } else this.look = null;
    return this;
  }

  // the signs as painted (the spec's texts), and where the people stand (for missions and tests)
  get signs() { return this.signTexts.slice(); }
  get size() { return this.people.length; }
  // how far a point is from the walking lane's centre line (Infinity when the crowd has no lane)
  laneDistance(x, z) { return this.path ? this.path.dist(x, z) : Infinity; }

  update(dt) {
    if (this.disposed || !(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.level += (this.target - this.level) * Math.min(1, dt * 1.6);
    const cam = this.game.camera?.position;
    const far = cam ? Math.hypot(cam.x - this.center.x, cam.z - this.center.z) > 320 : false;
    this.mesh.visible = !far;
    if (far) return;
    for (const p of this.people) {
      // facing: the road, or the point everyone looks at (a little late, within reach of the road)
      let want = p.face;
      if (this.look && (p.wait -= dt) <= 0) {
        const a = Math.atan2(this.look.x - p.x, this.look.z - p.z), d = wrap(a - p.face);
        want = p.face + Math.max(-1.25, Math.min(1.25, d));
      }
      const turn = wrap(want - p.yaw), step = 2.6 * dt;
      p.yaw += Math.abs(turn) < step ? turn : Math.sign(turn) * step;
      // making room: anyone walking right up to him gets space (he steps back from the road, then returns)
      let need = 0;
      for (const w of this.walkers) {
        if (!w) continue;
        const d = Math.hypot(w.x - p.x + p.nx * p.push, w.z - p.z + p.nz * p.push);
        need = Math.max(need, 1.05 - d);
      }
      p.push += (Math.min(0.9, Math.max(0, need * 1.6)) - p.push) * Math.min(1, dt * (need > 0 ? 7 : 1.5));
    }
    this.write(dt);
  }

  // the pose of everyone this frame, into the instance buffers
  write() {
    const L = this.level, t0 = this.t, M = this._m, Q = this._q, V = this._v, S = this._s;
    const clapW = smooth(0.06, 0.32, L), hiW = smooth(0.45, 0.85, L), jumpW = smooth(0.7, 1, L);
    for (let i = 0; i < this.people.length; i++) {
      const p = this.people[i], t = t0 + p.phase, beat = Math.sin(TAU * p.rate * t);
      // the arms: [left abduction, left pitch, right abduction, right pitch]; hanging at rest, swaying a little
      const sway = 0.04 * Math.sin(t * 1.3);
      let la = 0.08 + sway, lp = 0.03, ra = 0.08 - sway, rp = 0.03, lift = 0;
      // clapping in front of the chest
      const ca = -0.33 + 0.38 * (0.5 + 0.5 * beat), cp = -1.22 + 0.06 * beat;
      if (p.style === 'sign') {
        // both hands up on the board, pumping it as the cheering grows
        const pump = 0.1 * Math.sin(TAU * 1.5 * t) * (0.25 + 0.75 * L);
        la = ra = 2.72 + pump; lp = rp = 0.32;
        lift = handY(2.72 + pump, 0.32) - handY(2.72, 0.32);
      } else {
        la += (ca - la) * clapW; lp += (cp - lp) * clapW; ra += (ca - ra) * clapW; rp += (cp - rp) * clapW;
        if (p.style === 'wave' && hiW > 0) {
          const wa = 2.45 + 0.32 * Math.sin(TAU * 1.7 * t), wp = 0.15;
          if (p.left) { la += (wa - la) * hiW; lp += (wp - lp) * hiW; ra += (0.1 - ra) * hiW; rp += (0.03 - rp) * hiW; } else { ra += (wa - ra) * hiW; rp += (wp - rp) * hiW; la += (0.1 - la) * hiW; lp += (0.03 - lp) * hiW; }
        } else if (p.style === 'cheer' && hiW > 0) {
          const ua = 2.55 + 0.18 * Math.sin(TAU * 1.4 * t), up = 0.12;
          la += (ua - la) * hiW; lp += (up - lp) * hiW; ra += (ua - ra) * hiW; rp += (up - rp) * hiW;
        }
      }
      this.anim[i * 4] = la; this.anim[i * 4 + 1] = lp; this.anim[i * 4 + 2] = ra; this.anim[i * 4 + 3] = rp;
      this.extra[i * 2 + 1] = lift;
      // a bounce with the clapping, and a little hop when it is loudest
      let y = 0.012 * clapW * Math.abs(Math.sin(Math.PI * p.rate * t));
      if (p.jumper) y += (p.child ? 0.2 : 0.1) * jumpW * Math.abs(Math.sin(Math.PI * 1.35 * t + p.phase));
      const yaw = p.yaw + 0.07 * Math.sin(t * 0.7) * (0.3 + L);
      V.set(p.x - p.nx * p.push, p.y + y, p.z - p.nz * p.push);
      Q.setFromAxisAngle(this._up, yaw);
      S.set(p.h * p.wide, p.h, p.h * p.wide);
      M.compose(V, Q, S);
      this.mesh.setMatrixAt(i, M);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.animAttr.needsUpdate = true;
    this.extraAttr.needsUpdate = true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const acts = this.game.activities, k = acts ? acts.indexOf(this.activity) : -1;
    if (k >= 0) acts.splice(k, 1);
    if (this.sounding) { this.game.sound?.crowd?.(false, { seconds: 1.2 }); this.sounding = false; }
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.depthMaterial.dispose();
    this.texture.dispose();
    this.people = [];
  }
}

// how high a hand is over the shoulder for an arm held out by `ab` and tipped forward by `pitch` (the
// vertex shader's rotation, for the sign that rides on the hands)
function handY(ab, pitch) { return -ARM * Math.cos(ab) * Math.cos(pitch); }
