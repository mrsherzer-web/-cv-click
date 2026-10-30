// The head: one sphere bent into skull, jaw and face, with eyes, nose and mouth set into that surface.
// Hair and beard are layers grown out of the same surface along the painted hairline, so they hug the
// head instead of sitting on it like a cap.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { facialHair, hairline, headTexture } from './paint.js';

const RX = 0.0972, RY = 0.1188, RZ = 0.108; // half width, height and depth
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bump = (d, w) => Math.exp(-(d * d) / (w * w));

// width of the head at height ny (-1 chin … 1 crown): the jaw narrows, the cheekbones widen a little
const widthAt = (ny) => 1 - 0.2 * smooth(0.15, -0.95, ny) + 0.025 * bump(ny + 0.05, 0.25);

// a point of the unit sphere moved onto the head
function shape(nx, ny, nz) {
  let z = nz;
  if (nz > 0) {
    const ax = Math.abs(nx);
    z *= 1 - 0.07 * nz ** 4;                                                               // a flatter face
    z -= 0.07 * nz * bump(ax - 0.37, 0.15) * bump(ny - 0.15, 0.11);                       // eye sockets
    z += 0.04 * nz * bump(ny - 0.33, 0.08) * (1 - smooth(0.3, 0.75, ax));                 // brow ridge
    z += 0.06 * smooth(0, 0.25, nz) * bump(ny + 0.8, 0.16) * (1 - smooth(0.1, 0.45, ax)); // chin
  } else {
    z *= 1 - 0.12 * smooth(0.15, -0.95, ny);                                              // the back narrows into the neck
  }
  return [nx * RX * widthAt(ny), ny * RY, z * RZ];
}

// depth of the face surface in front of (x, y), for setting features into it
function faceZ(x, y) {
  const ny = y / RY, nx = x / (RX * widthAt(ny));
  return shape(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)))[2];
}

// SphereGeometry repeats vertices along its seam and at the poles; repeats share one normal so no seam shows
function weldNormals(g) {
  const p = g.getAttribute('position'), n = g.getAttribute('normal'), sum = new Map();
  const key = (i) => `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
  for (let i = 0; i < p.count; i++) {
    const k = key(i), s = sum.get(k) || [0, 0, 0];
    s[0] += n.getX(i); s[1] += n.getY(i); s[2] += n.getZ(i);
    sum.set(k, s);
  }
  for (let i = 0; i < p.count; i++) {
    const s = sum.get(key(i)), l = Math.hypot(s[0], s[1], s[2]) || 1;
    n.setXYZ(i, s[0] / l, s[1] / l, s[2] / l);
  }
}

function headGeometry(w = 48, h = 32) {
  const g = new THREE.SphereGeometry(1, w, h);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setXYZ(i, ...shape(p.getX(i), p.getY(i), p.getZ(i)));
  g.computeVertexNormals();
  weldNormals(g);
  return g;
}

// A layer grown out of the head: depth(u, v) in meters, with v measured from the crown. Where the depth
// is zero the layer sinks just under the skin; triangles that are entirely under it are dropped.
function shell(base, depth) {
  const g = base.clone(), p = g.getAttribute('position'), n = g.getAttribute('normal'), uv = g.getAttribute('uv');
  const out = new Uint8Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const t = depth(uv.getX(i), 1 - uv.getY(i));
    out[i] = t > 0 ? 1 : 0;
    const d = t > 0 ? t : -0.0025;
    p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
  }
  const idx = g.index.array, keep = [];
  for (let i = 0; i < idx.length; i += 3) if (out[idx[i]] | out[idx[i + 1]] | out[idx[i + 2]]) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  g.setIndex(keep);
  g.computeVertexNormals();
  weldNormals(g);
  return g;
}

// hair thickness over the crown and extra thickness at the fringe, in meters
// [thickness over the crown, extra at the fringe, where the thickness starts to taper (0 crown … 1 hairline), unevenness]
const HAIR = {
  buzz: [0.0035, 0, 0.5, 0.2],
  crop: [0.013, 0.007, 0.5, 0.2],
  fluffy: [0.03, 0.014, 0.72, 0.35],
  curly: [0.012, 0.004, 0.5, 0.2],
  textured: [0.024, 0.013, 0.46, 0.5],
  fringe: [0.017, 0.017, 0.5, 0.3],
  messy: [0.023, 0.015, 0.46, 0.5],
};

function hairDepth(style) {
  const [crown, fringe, taper, uneven] = HAIR[style];
  return (u, v) => {
    const { solid, face } = hairline(style, u);
    const t = v / solid; // 0 at the crown, 1 at the hairline
    if (t >= 1) return 0;
    const strands = 1 + uneven * Math.sin(u * Math.PI * 22 + t * 6) * Math.sin(u * Math.PI * 14 - t * 4 + 1) * Math.sin(Math.PI * t);
    return crown * (1 - smooth(taper, 1, t)) * strands + fringe * face * face * smooth(0.5, 0.88, t) * (1 - smooth(0.9, 1, t));
  };
}

function beardDepth(fh) {
  return (u, v) => {
    const [beard, mustache] = facialHair(fh, u, v);
    const chin = bump(u - 0.25, 0.09) * smooth(0.68, 0.84, v); // fuller at the chin
    return beard * (0.004 + 0.0045 * chin) + mustache * 0.0022;
  };
}

// a nose shaped from one sphere: a narrow bridge widening to the nostrils, deepest at the tip
function noseGeometry() {
  const g = new THREE.SphereGeometry(1, 16, 14);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = (1 - y) / 2; // t: 0 at the bridge, 1 under the tip
    const w = 0.006 + 0.016 * t ** 1.4, d = 0.003 + 0.0155 * smooth(0, 0.8, t);
    p.setXYZ(i, x * w, y * 0.027, z > 0 ? z * d : z * 0.004);
  }
  g.computeVertexNormals();
  weldNormals(g);
  return g;
}

// curls on top of the hair layer
function hairLumps() {
  const rnd = (i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const lumps = [];
  for (let i = 0; i < 80; i++) {
    const a = rnd(i) * Math.PI * 2, th = rnd(i + 7) * 0.9, r = 0.124 + rnd(i + 11) * 0.012;
    lumps.push([Math.sin(a) * Math.sin(th) * r * 0.92, 0.008 + Math.cos(th) * r * 1.02, Math.cos(a) * Math.sin(th) * r + 0.006, 0.017 + rnd(i + 5) * 0.008]);
  }
  for (const x of [-0.048, -0.024, 0, 0.024, 0.048]) lumps.push([x, 0.088, 0.085, 0.017]); // curls at the hairline
  return mergeGeometries(lumps.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z)));
}

// soft, messy clumps on a textured top, swept up and a little forward; the faded sides stay short
function hairTufts() {
  const rnd = (i) => Math.abs(Math.sin(i * 78.233) * 43758.5453) % 1;
  const tufts = [];
  for (let i = 0; i < 56; i++) {
    const a = (rnd(i) - 0.5) * 2.3, th = 0.05 + rnd(i + 3) * 0.6, r = 0.122 + rnd(i + 9) * 0.01;
    const x = Math.sin(a) * Math.sin(th) * r * 0.88, y = 0.014 + Math.cos(th) * r, z = Math.cos(a) * Math.sin(th) * r * 0.95 + 0.008;
    const g = new THREE.IcosahedronGeometry(0.013 + rnd(i + 5) * 0.006, 1).scale(0.8, 0.62 + rnd(i + 1) * 0.3, 1.5);
    g.rotateX(-0.5 - th * 0.5); // lying along the scalp, the ends lifting toward the front
    g.rotateY(a * 0.9);
    tufts.push(g.translate(x, y, z));
  }
  return mergeGeometries(tufts);
}

// detail: 'high' for the main cast, 'low' for passers-by (a coarser head and hair)
export function buildHead(spec, { detail = 'high' } = {}) {
  const head = new THREE.Group();
  const std = (color, roughness, extra) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const skin = new THREE.Color(spec.skin);
  const hairColor = spec.hair.color, facialColor = spec.facial?.color || hairColor;
  const faceTex = headTexture(spec);
  const mat = {
    // the head and the hair and beard layers show the painted head texture (skin, hair, fade, beard)
    face: std('#ffffff', 0.72, { map: faceTex }),
    skin: std(spec.skin, 0.72),
    hair: std(hairColor, 0.8),
    brow: std(facialColor, 0.85),
    white: std('#dcd5ca', 0.35),
    iris: std(spec.eyes || '#3a2517', 0.3),
    dark: std('#140e0c', 0.5),
    lid: std(skin.clone().multiplyScalar(0.86), 0.75),
    lip: std(skin.clone().lerp(new THREE.Color('#9a5044'), 0.32).multiplyScalar(0.9), 0.55),
  };
  const add = (geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, material);
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    o.castShadow = true;
    head.add(o);
    return o;
  };
  const sph = (r, w = 12, h = 8) => new THREE.SphereGeometry(r, w, h);

  const low = detail === 'low';
  add(headGeometry(low ? 32 : 48, low ? 22 : 32), mat.face);
  const fine = headGeometry(low ? 64 : 96, low ? 42 : 64); // shells keep only the triangles they cover, so detail here is cheap
  add(shell(fine, hairDepth(spec.hair.style)), mat.face);
  if (spec.hair.style === 'curly') add(hairLumps(), mat.hair);
  if (spec.hair.style === 'textured' && !low) add(hairTufts(), std(new THREE.Color(hairColor).offsetHSL(0, 0.04, 0.07), 0.8)); // sun-lightened ends
  if (spec.facial?.beard === 'short') add(shell(fine, beardDepth(spec.facial)), mat.brow); // one even color, edges and all

  for (const s of [-1, 1]) {
    // eye: an eyeball set into the socket, the upper lid over it and a dark lash line along the lid
    const x = s * 0.036, y = 0.02, z = faceZ(x, y) - 0.003, front = z + 0.0118 * 0.6;
    add(sph(0.0118, 16, 12).scale(1.25, 0.7, 0.6), mat.white, x, y, z, 0, s * 0.2);
    add(new THREE.CircleGeometry(0.0064, 20), mat.iris, x, y - 0.0006, front + 0.0002);
    add(new THREE.CircleGeometry(0.0026, 14), mat.dark, x, y - 0.0006, front + 0.0004);
    add(new THREE.SphereGeometry(0.0128, 16, 6, 0, Math.PI * 2, 0, Math.PI * 0.32).scale(1.25, 0.7, 0.62), mat.lid, x, y, z, 0, s * 0.2);
    add(new THREE.SphereGeometry(0.0131, 16, 1, 0, Math.PI * 2, Math.PI * 0.29, Math.PI * 0.04).scale(1.25, 0.7, 0.62), mat.dark, x, y, z, 0, s * 0.2);
    // brow, following the curve of the forehead, the inner end a little lower
    const bx = s * 0.037, by = 0.047;
    add(sph(0.011, 12, 6).scale(2.0, 0.4 * (spec.brows || 1), 0.42), mat.brow, bx, by, faceZ(bx, by) - 0.0005, 0, s * 0.28, s * 0.07);
    // ear
    add(sph(0.028, 12, 8).scale(0.42, 1, 0.72), mat.skin, s * RX * widthAt(0.03) * 0.98, 0.004, -0.008, 0, s * 0.35);
  }
  add(noseGeometry(), mat.skin, 0, -0.002, faceZ(0, -0.002) - 0.0025);
  // mouth: the lips as one soft shape and the line where they meet
  const my = -0.0485, mz = faceZ(0, my);
  add(sph(0.021, 16, 8).scale(1, 0.4, 0.3), mat.lip, 0, my - 0.0006, mz - 0.0035);
  add(new THREE.BoxGeometry(0.03, 0.0015, 0.003), mat.dark, 0, my, mz + 0.0012);
  head.userData.faceTexture = faceTex;
  return head;
}
