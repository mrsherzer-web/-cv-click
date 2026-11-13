// Old olive trees (the grove of chapter ten): thick boles that lean, twist and fork low, furrowed bark, and
// airy silver-green crowns of clustered leaf clumps. A few seeded variants are built once; each tree in the
// grove is a variant turned, scaled and leaned, and all of them are merged into two meshes (bark, leaves).
// Nothing here is the game's generic tree: the trunks are lofted along bent spines with a fluted, twisting
// section, a flare at the roots and knots; the limbs fork again; the leaves sit on the branch ends.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BARK = new THREE.Color('#8a8072'), FURROW = new THREE.Color('#4b4338'), MOSS = new THREE.Color('#77745c');
const OLIVE = [new THREE.Color('#aab8a0'), new THREE.Color('#7d9078'), new THREE.Color('#566751')]; // silver-green: top, middle, underside
export const seeded = rng;

// a tube lofted along `spine` (Vector3s) with a radius at each point: a fluted section whose furrows wind
// round it as it climbs. Pushes into the arrays of `out` ({ pos, col, idx }).
function loft(out, spine, radii, { seg = 9, flute = 0.16, lobes = 5, twist = 0.9, phase = 0, cap = false }) {
  const base = out.pos.length / 3, n = spine.length, t = V(0, 0, 0), u = V(1, 0, 0), v = V(0, 0, 0), c = new THREE.Color();
  let run = 0;
  for (let i = 0; i < n; i++) {
    t.subVectors(spine[Math.min(n - 1, i + 1)], spine[Math.max(0, i - 1)]).normalize();
    u.addScaledVector(t, -u.dot(t)); if (u.lengthSq() < 1e-6) u.set(0, 0, 1).addScaledVector(t, -t.z); u.normalize(); // the frame carried along
    v.crossVectors(t, u);
    if (i) run += spine[i].distanceTo(spine[i - 1]);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2, f = Math.sin(lobes * a + phase + twist * run), g = Math.sin((lobes * 2 + 1) * a + 1.7 + phase - twist * 0.6 * run);
      const r = radii[i] * (1 + flute * f + flute * 0.4 * g), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      out.pos.push(spine[i].x + u.x * cx + v.x * cz, spine[i].y + u.y * cx + v.y * cz, spine[i].z + u.z * cx + v.z * cz);
      c.copy(FURROW).lerp(BARK, 0.5 + 0.5 * f).lerp(MOSS, 0.18 * (0.5 + 0.5 * g));
      out.col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = base + i * seg + j, b = base + i * seg + (j + 1) % seg, d = a + seg, e = b + seg;
    out.idx.push(a, b, d, b, e, d);
  }
  if (cap) { // close the top
    const k = out.pos.length / 3, p = spine[n - 1];
    out.pos.push(p.x, p.y + radii[n - 1] * 0.25, p.z); out.col.push(BARK.r * 0.8, BARK.g * 0.8, BARK.b * 0.8);
    for (let j = 0; j < seg; j++) out.idx.push(base + (n - 1) * seg + j, base + (n - 1) * seg + (j + 1) % seg, k);
  }
}

// one clump of leaves: a lumpy faceted blob, paler on top. `pal`: [top, middle, underside] colours.
export function clump(out, cx, cy, cz, r, squash, R, pal = OLIVE) {
  const g = clump.base || (clump.base = new THREE.DodecahedronGeometry(1, 0).toNonIndexed()), p = g.getAttribute('position'), c = new THREE.Color();
  const sx = r * (0.85 + R() * 0.4), sz = r * (0.85 + R() * 0.4), sy = r * squash, ph = R() * 9, light = 0.88 + R() * 0.24;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.2 * Math.sin(x * 4.1 + ph) * Math.cos(z * 3.7 - ph) + 0.12 * Math.sin(y * 5.3 + ph * 2);
    out.pos.push(cx + x * sx * k, cy + y * sy * k, cz + z * sz * k);
    if (y > 0) c.copy(pal[1]).lerp(pal[0], Math.min(1, y * 1.3)); else c.copy(pal[1]).lerp(pal[2], Math.min(1, -y * 1.5));
    out.col.push(c.r * light, c.g * light, c.b * light);
  }
}

export const finish = (o, indexed) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  if (indexed) g.setIndex(o.idx);
  g.computeVertexNormals();
  return g;
};

// One variant: { trunk, crown (geometries, the foot at the origin, about 5.5 m tall), spine (the bole's
// points, for things that climb it), r (the bole's radius at knee height), top }.
export function oliveVariant(seed) {
  const R = rng(seed * 7919 + 13), T = { pos: [], col: [], idx: [] }, L = { pos: [], col: [], idx: [] };
  const r0 = 0.33 + R() * 0.1, H = 1.15 + R() * 0.55, lean = (R() - 0.5) * 0.5, leanZ = (R() - 0.5) * 0.36, wob = 0.1 + R() * 0.1, ph = R() * 6;
  const knot = 0.45 + R() * 0.5, knot2 = 0.9 + R() * 0.4;
  // the bole: flared at the roots, a knot or two, bent
  const spine = [], radii = [], N = 9;
  for (let i = 0; i < N; i++) {
    const h = -0.18 + (H + 0.18) * (i / (N - 1)), hh = Math.max(0, h);
    spine.push(V(lean * hh + wob * Math.sin(hh * 2.6 + ph), h, leanZ * hh + wob * Math.cos(hh * 2.1 + ph)));
    radii.push(r0 * (1 + 0.8 * Math.exp(-hh / 0.26) + 0.2 * Math.exp(-(((hh - knot) / 0.16) ** 2)) + 0.16 * Math.exp(-(((hh - knot2) / 0.14) ** 2)) + 0.1 * (i === N - 1 ? 1 : 0)));
  }
  loft(T, spine, radii, { seg: 10, flute: 0.2, lobes: 5 + (seed % 2), twist: 1.1 + R() * 0.9, phase: ph, cap: true });
  // the limbs: two or three from the fork, bending out and up; each forks again
  const top = spine[N - 1], limbs = 2 + (R() < 0.6 ? 1 : 0), a0 = R() * 6.28, ends = [];
  for (let k = 0; k < limbs; k++) {
    const az = a0 + (k / limbs) * 6.28 + (R() - 0.5) * 0.7, out = 0.75 + R() * 0.45, len = 1.5 + R() * 0.7, dx = Math.cos(az), dz = Math.sin(az), bend = (R() - 0.5) * 0.7;
    const pts = [], rr = [];
    for (let i = 0; i < 4; i++) {
      const s = i / 3, up = len * (0.55 * s + 0.45 * s * s), o = len * out * (s - 0.35 * s * s);
      pts.push(V(top.x + dx * o - dz * bend * s * s * 0.6, top.y - 0.12 + up, top.z + dz * o + dx * bend * s * s * 0.6));
      rr.push(r0 * (0.62 - 0.3 * s));
    }
    loft(T, pts, rr, { seg: 7, flute: 0.18, lobes: 4, twist: 1.6, phase: ph + k });
    const e = pts[3];
    for (let b = 0; b < 2; b++) {
      const bz = az + (b ? 0.9 : -0.8) + (R() - 0.5) * 0.5, bl = 1.0 + R() * 0.6, bp = [e.clone(), V(e.x + Math.cos(bz) * bl * 0.5, e.y + bl * 0.45, e.z + Math.sin(bz) * bl * 0.5), V(e.x + Math.cos(bz) * bl, e.y + bl * 0.75, e.z + Math.sin(bz) * bl)];
      loft(T, bp, [r0 * 0.3, r0 * 0.2, r0 * 0.07], { seg: 5, flute: 0.1, lobes: 3, twist: 1, phase: b });
      ends.push(bp[2], bp[1]);
    }
    ends.push(e);
  }
  // the crown: clumps on the branch ends, a few over the middle; airy, wider than tall
  let hi = 0;
  for (const e of ends) { clump(L, e.x + (R() - 0.5) * 0.5, e.y + 0.25 + R() * 0.35, e.z + (R() - 0.5) * 0.5, 0.85 + R() * 0.45, 0.6 + R() * 0.15, R); hi = Math.max(hi, e.y); }
  for (let k = 0; k < 2; k++) clump(L, top.x + (R() - 0.5) * 1.2, hi + 0.5 + R() * 0.5, top.z + (R() - 0.5) * 1.2, 1.2 + R() * 0.4, 0.55, R);
  return { trunk: finish(T, true), crown: finish(L, false), spine, r: r0 * 1.15, top: hi + 1.6, forkAt: H };
}

let cached = null;
export function oliveVariants(n = 5) { return cached || (cached = [...Array(n).keys()].map((k) => oliveVariant(k + 1))); }

// The bark and the leaves: plain vertex colours (the furrows and the pale tops are in the geometry).
export function oliveMaterials() {
  return {
    bark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }),
  };
}

// trees: [{ x, y, z, v (variant index), yaw, s (scale) }] → { trunks, crowns } merged geometries in world
// space (dispose the variants' clones as they go).
export function mergeOlives(trees) {
  const vars = oliveVariants(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), A = [], B = [];
  for (const t of trees) {
    const va = vars[t.v % vars.length];
    m.compose(V(t.x, t.y, t.z), q.setFromEuler(e.set(0, t.yaw || 0, 0)), V(t.s, t.s * (t.sy || 1), t.s));
    A.push(va.trunk.clone().applyMatrix4(m)); B.push(va.crown.clone().applyMatrix4(m));
  }
  const trunks = mergeGeometries(A, false), crowns = mergeGeometries(B, false);
  for (const g of A) g.dispose(); for (const g of B) g.dispose();
  return { trunks, crowns };
}
