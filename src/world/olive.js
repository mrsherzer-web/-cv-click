// Old olive trees (the grove of chapter ten): thick grey boles that lean, twist and fork low into two or three
// heavy stems, deeply furrowed bark, and airy silver-green crowns of clustered leaf clumps with sky showing
// through. A few seeded variants are built once; each tree in the grove is a variant turned, scaled and
// leaned, and all of them are merged into two meshes (bark, leaves): two draw calls for the whole grove.
// Nothing here is the game's generic tree: the trunks are lofted along bent spines with a fluted, twisting
// section, a flare at the roots and knots, a bark map of winding furrows; the stems fork again; the leaves
// sit on the branch ends as soft clumps cut by a leaf map (alpha-tested), so the crowns are ragged and light.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BARK = new THREE.Color('#a8a59c'), FURROW = new THREE.Color('#57524b'), MOSS = new THREE.Color('#90907c');
const OLIVE = [new THREE.Color('#d2d8cb'), new THREE.Color('#a3ac9a'), new THREE.Color('#77816f')]; // silver-green: top, middle, underside
export const seeded = rng;

// a tube lofted along `spine` (Vector3s) with a radius at each point: a fluted section whose furrows wind
// round it as it climbs. Pushes into the arrays of `out` ({ pos, col, uv, idx }); the ring is closed by a
// repeated seam vertex so the bark map wraps cleanly.
function loft(out, spine, radii, { seg = 9, flute = 0.16, lobes = 5, twist = 0.9, phase = 0, cap = false, u0 = 0 }) {
  const base = out.pos.length / 3, n = spine.length, t = V(0, 0, 0), u = V(1, 0, 0), v = V(0, 0, 0), c = new THREE.Color(), S = seg + 1;
  let run = 0;
  for (let i = 0; i < n; i++) {
    t.subVectors(spine[Math.min(n - 1, i + 1)], spine[Math.max(0, i - 1)]).normalize();
    u.addScaledVector(t, -u.dot(t)); if (u.lengthSq() < 1e-6) u.set(0, 0, 1).addScaledVector(t, -t.z); u.normalize(); // the frame carried along
    v.crossVectors(t, u);
    if (i) run += spine[i].distanceTo(spine[i - 1]);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2, f = Math.sin(lobes * a + phase + twist * run), g = Math.sin((lobes * 2 + 1) * a + 1.7 + phase - twist * 0.6 * run);
      const r = radii[i] * (1 + flute * f + flute * 0.45 * g), cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      out.pos.push(spine[i].x + u.x * cx + v.x * cz, spine[i].y + u.y * cx + v.y * cz, spine[i].z + u.z * cx + v.z * cz);
      c.copy(FURROW).lerp(BARK, 0.35 + 0.65 * (0.5 + 0.5 * f)).lerp(MOSS, 0.2 * (0.5 + 0.5 * g));
      out.col.push(c.r, c.g, c.b);
      // the map winds with the furrows: u round the stem (twice), v up it
      out.uv.push(u0 + (j / seg) * 2 + twist * run * 0.12, run * 0.55);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = base + i * S + j, b = a + 1, d = a + S, e = b + S;
    out.idx.push(a, b, d, b, e, d);
  }
  if (cap) { // close the top
    const k = out.pos.length / 3, p = spine[n - 1];
    out.pos.push(p.x, p.y + radii[n - 1] * 0.25, p.z); out.col.push(BARK.r * 0.8, BARK.g * 0.8, BARK.b * 0.8); out.uv.push(0.5, run * 0.55 + 0.1);
    for (let j = 0; j < seg; j++) out.idx.push(base + (n - 1) * S + j, base + (n - 1) * S + j + 1, k);
  }
}

// one clump of leaves: a lumpy blob, paler on top, with soft (round) normals and a leaf-map projection.
// `pal`: [top, middle, underside] colours. Writes pos, col, nor, uv into `out`.
export function clump(out, cx, cy, cz, r, squash, R, pal = OLIVE) {
  const g = clump.base || (clump.base = new THREE.DodecahedronGeometry(1, 0).toNonIndexed()), p = g.getAttribute('position'), c = new THREE.Color();
  const nor = out.nor || (out.nor = []), uv = out.uv || (out.uv = []);
  const sx = r * (0.85 + R() * 0.4), sz = r * (0.85 + R() * 0.4), sy = r * squash, ph = R() * 9, light = 0.9 + R() * 0.2, ou = R() * 4, ov = R() * 4, q = clump.q || (clump.q = new Float32Array(9));
  for (let i = 0; i < p.count; i += 3) {
    for (let j = 0; j < 3; j++) {
      const x = p.getX(i + j), y = p.getY(i + j), z = p.getZ(i + j), k = 1 + 0.2 * Math.sin(x * 4.1 + ph) * Math.cos(z * 3.7 - ph) + 0.12 * Math.sin(y * 5.3 + ph * 2);
      q[j * 3] = x * sx * k; q[j * 3 + 1] = y * sy * k; q[j * 3 + 2] = z * sz * k;
      out.pos.push(cx + q[j * 3], cy + q[j * 3 + 1], cz + q[j * 3 + 2]);
      const nx = x / sx, ny = y / sy * 1.15 + 0.35 / r, nz = z / sz, l = Math.hypot(nx, ny, nz) || 1; // round, a little lit from above
      nor.push(nx / l, ny / l, nz / l);
      if (y > 0) c.copy(pal[1]).lerp(pal[0], Math.min(1, y * 1.3)); else c.copy(pal[1]).lerp(pal[2], Math.min(1, -y * 1.5));
      out.col.push(c.r * light, c.g * light, c.b * light);
    }
    // the leaf map laid flat on each face, on the plane it faces most (no stretching)
    const ax = q[3] - q[0], ay = q[4] - q[1], az = q[5] - q[2], bx = q[6] - q[0], by = q[7] - q[1], bz = q[8] - q[2];
    const fx = Math.abs(ay * bz - az * by), fy = Math.abs(az * bx - ax * bz), fz = Math.abs(ax * by - ay * bx);
    const [U, W] = fx >= fy && fx >= fz ? [2, 1] : fy >= fz ? [0, 2] : [0, 1];
    for (let j = 0; j < 3; j++) uv.push(ou + q[j * 3 + U] * 0.45, ov + q[j * 3 + W] * 0.45);
  }
}

export const finish = (o, indexed) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  if (o.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  if (indexed) g.setIndex(o.idx);
  if (o.nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3)); else g.computeVertexNormals();
  return g;
};

// One variant: { trunk, crown (geometries, the foot at the origin, about 5.5 m tall), spine (the bole's
// points, for things that climb it), r (the bole's radius at knee height), top, forkAt }.
export function oliveVariant(seed) {
  const R = rng(seed * 7919 + 13), T = { pos: [], col: [], uv: [], idx: [] }, L = { pos: [], col: [], idx: [] };
  const r0 = 0.34 + R() * 0.12, H = 0.85 + R() * 0.55, lean = (R() - 0.5) * 0.7, leanZ = (R() - 0.5) * 0.5, wob = 0.12 + R() * 0.12, ph = R() * 6;
  const knot = 0.35 + R() * 0.35, knot2 = 0.75 + R() * 0.3;
  // the bole: a wide flare at the roots, a knot or two, bent and leaning
  const spine = [], radii = [], N = 8;
  for (let i = 0; i < N; i++) {
    const h = -0.2 + (H + 0.2) * (i / (N - 1)), hh = Math.max(0, h);
    spine.push(V(lean * hh + wob * Math.sin(hh * 2.6 + ph), h, leanZ * hh + wob * Math.cos(hh * 2.1 + ph)));
    radii.push(r0 * (1 + 0.65 * Math.exp(-hh / 0.25) + 0.25 * Math.exp(-(((hh - knot) / 0.15) ** 2)) + 0.18 * Math.exp(-(((hh - knot2) / 0.13) ** 2)) + 0.2 * (i === N - 1 ? 1 : 0)));
  }
  loft(T, spine, radii, { seg: 11, flute: 0.3, lobes: 5 + (seed % 2), twist: 1.4 + R() * 1.0, phase: ph });
  // the stems: two or three heavy ones from the low fork, twisting out and up; each forks again into limbs
  // that carry the leaves on their ends and along them
  const top = spine[N - 1], stems = 2 + (R() < 0.55 ? 1 : 0), a0 = R() * 6.28, leaves = [];
  for (let k = 0; k < stems; k++) {
    const az = a0 + (k / stems) * 6.28 + (R() - 0.5) * 0.7, out = 0.35 + R() * 0.35, len = 2.1 + R() * 0.9, dx = Math.cos(az), dz = Math.sin(az), bend = (R() - 0.5) * 1.1;
    const pts = [], rr = [];
    for (let i = 0; i < 6; i++) {
      const s = i / 5, up = len * (0.78 * s + 0.22 * s * s), o = len * out * (s + 0.25 * Math.sin(s * 3.1)) + 0.12;
      pts.push(V(top.x + dx * o - dz * bend * s * s * 0.6 + 0.08 * Math.sin(s * 7 + k), top.y - 0.25 + up, top.z + dz * o + dx * bend * s * s * 0.6));
      rr.push(r0 * (0.86 - 0.52 * s) * (k === 0 ? 1.08 : 1));
    }
    loft(T, pts, rr, { seg: 9, flute: 0.26, lobes: 4, twist: 1.8, phase: ph + k, u0: k * 0.37 });
    const e = pts[5];
    for (let b = 0; b < 3; b++) {
      const bz = az + (b - 1) * 0.95 + (R() - 0.5) * 0.5, bl = 1.2 + R() * 0.8, rise = b === 1 ? 0.85 : 0.45, src = b === 1 ? e : pts[3 + (b ? 1 : 0)];
      const bp = [src.clone(), V(src.x + Math.cos(bz) * bl * 0.5, src.y + bl * rise * 0.6, src.z + Math.sin(bz) * bl * 0.5), V(src.x + Math.cos(bz) * bl, src.y + bl * rise, src.z + Math.sin(bz) * bl)];
      loft(T, bp, [r0 * 0.3, r0 * 0.19, r0 * 0.07], { seg: 5, flute: 0.12, lobes: 3, twist: 1, phase: b });
      leaves.push([bp[2], 0.95 + R() * 0.3]); if (b === 1) leaves.push([bp[1], 0.7 + R() * 0.2]);
    }
    leaves.push([e, 0.9 + R() * 0.25], [pts[3], 0.65 + R() * 0.2]);
  }
  // the crown: clumps on the branch ends and along the limbs, a few over the middle and hanging at the rim
  let hi = 0;
  for (const [e, r] of leaves) { clump(L, e.x + (R() - 0.5) * 0.6, e.y + 0.1 + R() * 0.35, e.z + (R() - 0.5) * 0.6, r, 0.62 + R() * 0.2, R); hi = Math.max(hi, e.y); }
  for (let k = 0; k < 3; k++) { const a = R() * 6.28, d = R() * 0.8; clump(L, top.x + Math.cos(a) * d, hi + 0.15 + R() * 0.45, top.z + Math.sin(a) * d, 1.0 + R() * 0.35, 0.62, R); }
  return { trunk: finish(T, true), crown: finish(L, false), spine, radii, r: r0 * 1.15, top: hi + 1.4, forkAt: H };
}

let cached = null;
export function oliveVariants(n = 6) { return cached || (cached = [...Array(n).keys()].map((k) => oliveVariant(k + 1))); }

const canvasTex = (w, h, draw) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
};

// The bark (winding dark furrows over grey ridges, times the vertex colours) and the leaves (small narrow
// leaves, light and dark, with gaps between them: alpha-tested, both sides, soft normals).
export function oliveMaterials() {
  const R = rng(4242);
  const barkMap = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 140; k++) { // ridges and furrows running up the stem, wavering
      const v = R() < 0.55 ? 70 + R() * 60 : 200 + R() * 55, wd = 1 + R() * (v < 140 ? 4 : 3), pts = [[R() * w, -10]];
      while (pts[pts.length - 1][1] < h + 10) { const [x, y] = pts[pts.length - 1]; pts.push([x + (R() - 0.5) * 7, y + 8 + R() * 14]); }
      g.strokeStyle = `rgb(${v | 0},${(v * 0.97) | 0},${(v * 0.92) | 0})`; g.lineWidth = wd;
      for (const o of [-w, 0, w]) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + o, y) : g.moveTo(x + o, y))); g.stroke(); } // wraps round
    }
    for (let k = 0; k < 260; k++) { const v = 90 + R() * 140 | 0; g.fillStyle = `rgba(${v},${v},${v - 6},0.5)`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 2); } // flakes and lichen
  });
  const leafMap = canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let s = 0; s < 120; s++) { // sprigs: a few narrow leaves round a twig, gaps between the sprigs
      const sx = R() * w, sy = R() * h, n = 6 + (R() * 5 | 0), a0 = R() * 6.28;
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * 6.28 + (R() - 0.5) * 0.6, d = 3 + R() * 4, x = sx + Math.cos(a) * d, y = sy + Math.sin(a) * d, l = 3.5 + R() * 3, v = R();
        const c = v < 0.3 ? [140, 152, 130] : v < 0.75 ? [205, 212, 196] : [250, 252, 244];
        g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) { g.beginPath(); g.ellipse(x + ox, y + oy, l, 1.2 + R() * 0.6, a, 0, Math.PI * 2); g.fill(); }
      }
    }
  });
  leafMap.anisotropy = 1;
  return {
    bark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: barkMap }),
    leaf: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, map: leafMap, alphaTest: 0.42, side: THREE.DoubleSide }),
  };
}

// trees: [{ x, y, z, v (variant index), yaw, s (scale), sy }] → { trunks, crowns } merged geometries in
// world space (the variants' clones are disposed as they go).
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
