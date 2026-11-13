// The olive grove (chapter ten): חורשת הזיתים, rebuilt from the user's two videos of the place. Site-local:
// the origin at the grove's centre (1206, 228), +x east, +z south; the box is x -56..56, z -48..48.
//   north-east  the asphalt parking lot with its small roundabout island (red-and-white kerb), parked cars,
//               two green bins and a purple one under tall trees, a hedge behind them;
//   its corner  bare earth, the sign on two metal poles, the big white limestone boulder; the path begins here;
//   the path    grey interlocking pavers between kerb stones, a long slow curve west through the lawn to the
//               gate in the mesh fence at the far end (the white shed, the floodlight mast, reeds behind it);
//   the lawn    about forty-five old olive trees in loose orchard rows, bare patches, strings of coloured bulbs
//               from tree to tree; the football goal and benches by the path;
//   the south   the playground on dark gravel (green A-frame swings, the hooped spring spinner, the blue fish
//               seesaw, the little rocket slide), benches, a brown bin; the low white building behind it;
//   the west    the mesh fence, and beyond it the arched frame of a covered court.
// The neighbours are generic; nothing here is anybody's home. Over this base lies the parallel universe of
// missions 52-54 (grove-layer.js), hidden until grove.dimension(true): then the stretch of path between
// x -44 and 2 hangs in pieces over a rift (dug in layout(), covered by a lid of lawn and paving otherwise).
import * as THREE from 'three';
import { makeSite } from './compound.js';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { trafficCarGeometry, trafficMaterial } from './car.js';
import { fence } from './countryside.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { oliveVariants, oliveMaterials, mergeOlives, clump, finish, seeded } from './olive.js';
import { buildLayer } from './grove-layer.js';

export const C = { x: 1206, z: 228 };
export const BOX = { x0: -56, x1: 56, z0: -48, z1: 48 };
export const RIFT = { x0: -44, x1: 2, z0: -22, z1: -6, depth: 9 };   // the stretch that breaks (site-local)
const LOT = { x0: 20, x1: 56, z0: -48, z1: -14 }, GRAVEL = { x0: -26, x1: 2, z0: 20, z1: 40 };
const PATH_HALF = 1.6;
// the path's centre line inside the rift: a slow arc, so the stones of the broken path line up along it
export const pathZ = (lx) => -14 + 3 * Math.sin(Math.PI * (RIFT.x1 - lx) / (RIFT.x1 - RIFT.x0));
const PATH = [[20.5, -16.6], [17, -16.1], [13, -15.5], [9, -14.9], [5.5, -14.4]];
for (let x = RIFT.x1; x >= RIFT.x0; x -= 2) PATH.push([x, pathZ(x)]);
PATH.push([-46.5, -14.6], [-48.8, -15.8], [-50.6, -17.5], [-51.8, -19.3]);
// the olive trees: [x, z, scale]; the rows along x = 8 and z = 14 and the pair at (10.5, -34.5) carry the layer
const ROW_X = [[8, -22.2], [8.2, -18.4], [7.8, -11.2], [8.3, -4.6], [7.7, 2.4], [8.2, 8.6], [8, 14], [8.3, 21], [7.8, 28], [8.2, 35], [8, 41.6]];
const ROW_Z = [[1, 14.2], [-6, 13.8], [-13, 14.3], [-20, 13.7], [-27, 14.2], [-34, 13.8], [-41, 14.1]];
const GREAT = [[10.5, -39.4, 1.7], [10.5, -29.6, 1.75]];
const RING = [[-37.6, -38], [-33.5, -44.4], [-14, -44.8], [-10.4, -40.2], [-10.8, -29.2], [-36.6, -27.2]];
const LOOSE = [[2.6, -22.6], [13, -22.3], [-2, -43.5], [-2.5, -27.4], [-43.5, -33], [-38, 3], [-27, 6.5], [-8, 6], [1.5, 1.5],
  [-1.5, 22.4], [-31, 21.5], [-37.5, 31], [16, 1], [24.5, 13.5], [31, -5], [41, 5], [18, 26], [33, 25], [44, 30]];
const STRINGS = [[[1, 14.2], [-6, 13.8]], [[-6, 13.8], [-13, 14.3]], [[-13, 14.3], [-20, 13.7]], [[-20, 13.7], [-27, 14.2]], [[8, 14], [1, 14.2]],
  [[8, 14], [8.3, 21]], [[8.3, 21], [7.8, 28]], [[-1.5, 22.4], [1, 14.2]], [[-27, 14.2], [-31, 21.5]], [[-1.5, 22.4], [8.3, 21]]];
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

export function layout(ctx) {
  const { net, baseHeight } = ctx, h = baseHeight(C.x, C.z);
  const pad = (x0, x1, z0, z1, o = {}) => net.addPad({ x: C.x + (x0 + x1) / 2, z: C.z + (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, yaw: 0, h, top: 0.05, blend: 8, name: 'grove', ...o });
  // the ground, in four pieces round the rift; the rift's lid (walked on until the dimension takes it away);
  // and the rift itself, dug wider than it shows so its slopes stay under the lawn
  pad(BOX.x0, BOX.x1, BOX.z0, RIFT.z0); pad(BOX.x0, BOX.x1, RIFT.z1, BOX.z1); pad(BOX.x0, RIFT.x0, RIFT.z0, RIFT.z1); pad(RIFT.x1, BOX.x1, RIFT.z0, RIFT.z1);
  const lid = pad(RIFT.x0, RIFT.x1, RIFT.z0, RIFT.z1, { blend: 0, walkOnly: true, name: 'grove lid' });
  const floor = pad(RIFT.x0 - 6, RIFT.x1 + 6, RIFT.z0 - 6, RIFT.z1 + 6, { h: h - RIFT.depth, blend: 0, name: 'grove rift' });
  ctx.keepOut?.push({ x: C.x, z: C.z, hx: 64, hz: 56 });
  ctx.grove = { y: h + 0.05, lid, floor };
}

// flat pieces with a colour at every corner (the lawn, the paving, kerbs): quad(a, b, c, d) faces up when
// a→b runs along the way and b→c to its right
function quads() {
  const pos = [], col = [], uv = [];
  const v = (p, c, s, t) => { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b); if (t) uv.push(t[0], t[1]); else uv.push(p[0] * s, p[2] * s); };
  return {
    quad(a, b, c, d, ca, s = 0.3, cb = ca, cc = ca, cd = ca, T = []) { v(a, ca, s, T[0]); v(b, cb, s, T[1]); v(c, cc, s, T[2]); v(a, ca, s, T[0]); v(c, cc, s, T[2]); v(d, cd, s, T[3]); },
    get empty() { return !pos.length; },
    geo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g; },
  };
}

export function build(ctx) {
  const { places, M, cols } = ctx, { y, lid, floor } = ctx.grove;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'grove' });
  const { batch, box, group, lamps, emissives } = S;
  const P = (lx, lz, ly = 0, yaw) => ({ x: C.x + lx, z: C.z + lz, y: y + ly, ...(yaw != null ? { yaw } : {}) });
  const R = seeded(1010);
  // the ground stays whatever the distance (it hides the rift); everything else is the site's group
  const base = new THREE.Group(); base.name = 'grove ground'; ctx.group.add(base);
  const lidGroup = new THREE.Group(); lidGroup.name = 'grove lid'; base.add(lidGroup);
  const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  const piece = (B, key, mat, w, h, d, lx, ly, lz, { yaw = 0, color = '#ffffff', scale = 0.4, uv = 'world', pitch = 0, roll = 0 } = {}) =>
    B.add(key, mat, box(w, h, d), mat4(C.x + lx, y + ly, C.z + lz, yaw, 1, 1, 1, pitch, roll), { color: tint(color), uv, uvScale: scale });
  const paint = (w, h, d, lx, ly, lz, color, o = {}) => piece(batch, 'paint', M.paint, w, h, d, lx, ly, lz, { ...o, color, uv: 'keep' });
  // a round bar between two site-local points [x, y, z]
  const UP = new THREE.Vector3(0, 1, 0), va = new THREE.Vector3(), vb = new THREE.Vector3(), vq = new THREE.Quaternion(), vm = new THREE.Matrix4(), vs = new THREE.Vector3();
  const bar = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true), bar8 = new THREE.CylinderGeometry(1, 1, 1, 9);
  const rod = (a, b, r, color, { B = batch, geo = bar, key = 'paint', mat = M.paint } = {}) => {
    va.set(C.x + a[0], y + a[1], C.z + a[2]); vb.set(C.x + b[0], y + b[1], C.z + b[2]);
    const len = va.distanceTo(vb); vq.setFromUnitVectors(UP, vs.subVectors(vb, va).normalize());
    vm.compose(va.add(vb).multiplyScalar(0.5), vq, vs.set(r, len, r)); B.add(key, mat, geo, vm, { color: tint(color) });
  };
  const arc = (n, f, r, color, o) => { let p = f(0); for (let i = 1; i <= n; i++) { const q = f(i / n); rod(p, q, r, color, o); p = q; } };
  // the grove's own surfaces: light asphalt and dark gravel (one speckled map), grey interlocking pavers
  const canvasTex = (n, draw) => { const cv = document.createElement('canvas'); cv.width = cv.height = n; draw(cv.getContext('2d'), n); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  const flatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: canvasTex(128, (g, n) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, n, n); for (let k = 0; k < 2600; k++) { const v = 150 + R() * 105 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(R() * n, R() * n, 1 + R() * 2, 1 + R() * 2); } }) });
  const paverMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, map: canvasTex(256, (g, n) => { // one metre of running bond: bricks 20 by 10
    g.fillStyle = '#8f8d88'; g.fillRect(0, 0, n, n);
    for (let row = 0; row < 10; row++) for (let k = -1; k < 5; k++) { const v = 176 + R() * 44 | 0, x = (k + (row % 2) * 0.5) * n / 5; g.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g.fillRect(x + 1.2, row * n / 10 + 1.2, n / 5 - 2.4, n / 10 - 2.4); }
  }) });
  const circle = (lx, lz, r, top = 2) => cols.addCircle(C.x + lx, C.z + lz, r, y - 1, y + top);
  const solid = (lx, lz, hx, hz, top, yaw = 0) => cols.addBox(C.x + lx, C.z + lz, hx, hz, yaw, y - 1, y + top);

  // ---------- the lawn: green with patches of bare earth; the cells over the rift are the lid ----------
  const G1 = tint('#88a552'), G2 = tint('#64823a'), EARTH = tint('#9a8562'), DIRT = tint('#b3a183');
  const lawnColor = (x, z) => {
    const n1 = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.23) * 2.1) * Math.cos(z * 0.27 - x * 0.11);
    const n2 = 0.5 + 0.5 * Math.sin(x * 0.83 + 1.3 + Math.sin(z * 0.37) * 1.9) * Math.sin(z * 0.71 + Math.sin(x * 0.19) * 1.7);
    const c = G1.clone().lerp(G2, n1);
    let bare = 0.85 * smooth(0.62, 0.86, n2 * 0.75 + n1 * 0.25);
    bare = Math.max(bare, 0.75 * smooth(3.4, 1.2, Math.hypot(x + 18, z + 0.6)));                                   // the goal mouth
    const gx = Math.max(GRAVEL.x0 - x, 0, x - GRAVEL.x1), gz = Math.max(GRAVEL.z0 - z, 0, z - GRAVEL.z1);
    bare = Math.max(bare, 0.6 * smooth(2.4, 0.4, Math.hypot(gx, gz)));                                              // trodden round the playground
    c.lerp(EARTH, bare);
    return c.lerp(DIRT, smooth(8.5, 3.5, Math.hypot(x - 18.5, z + 11.5)));                                          // the dirt corner by the sign
  };
  const lawn = quads(), lawnLid = quads();
  for (let x = BOX.x0; x < BOX.x1; x += 2) for (let z = BOX.z0; z < BOX.z1; z += 2) {
    const mx = x + 1, mz = z + 1; if (inRect(LOT, mx, mz) || inRect(GRAVEL, mx, mz)) continue;
    const q = inRect(RIFT, mx, mz) ? lawnLid : lawn, W = (lx, lz) => [C.x + lx, y, C.z + lz];
    q.quad(W(x, z), W(x, z + 2), W(x + 2, z + 2), W(x + 2, z), lawnColor(x, z), 0.22, lawnColor(x, z + 2), lawnColor(x + 2, z + 2), lawnColor(x + 2, z));
  }
  const flat = (q, mat, parent, name) => { if (q.empty) return null; const m = new THREE.Mesh(q.geo(), mat); m.name = name; m.receiveShadow = true; m.matrixAutoUpdate = false; parent.add(m); return m; };
  flat(lawn, M.ground, base, 'grove lawn'); flat(lawnLid, M.ground, lidGroup, 'grove lawn lid');

  // ---------- the path: pavers between kerb stones; the stretch over the rift belongs to the lid ----------
  const pave = quads(), paveLid = quads(), kerb = quads(), kerbLid = quads();
  const kerbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  const PAVER = tint('#ffffff'), KERB = tint('#b3b0a8'), KERB2 = tint('#a29f97');
  const side = PATH.map((p, i) => { const a = PATH[Math.max(0, i - 1)], b = PATH[Math.min(PATH.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]; }); // to the right of the way
  const at = (i, o, h) => [C.x + PATH[i][0] + side[i][0] * o, y + h, C.z + PATH[i][1] + side[i][1] * o];
  let run = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const run0 = run; run += Math.hypot(PATH[i + 1][0] - PATH[i][0], PATH[i + 1][1] - PATH[i][1]);
    const over = inRect(RIFT, (PATH[i][0] + PATH[i + 1][0]) / 2, -14), pv = over ? paveLid : pave, kb = over ? kerbLid : kerb, H = PATH_HALF;
    pv.quad(at(i, -H, 0.03), at(i + 1, -H, 0.03), at(i + 1, H, 0.03), at(i, H, 0.03), PAVER, 1, PAVER, PAVER, PAVER, [[-H, run0], [-H, run], [H, run], [H, run0]]);
    for (const s of [-1, 1]) {
      const a = s * H, b = s * (H + 0.17), c = i % 2 ? KERB : KERB2;
      kb.quad(at(i, Math.min(a, b), 0.09), at(i + 1, Math.min(a, b), 0.09), at(i + 1, Math.max(a, b), 0.09), at(i, Math.max(a, b), 0.09), c);
      kb.quad(at(i, a, 0.09), at(i + 1, a, 0.09), at(i + 1, a, 0), at(i, a, 0), KERB2); kb.quad(at(i, b, 0.09), at(i + 1, b, 0.09), at(i + 1, b, 0), at(i, b, 0), KERB2);
    }
  }
  flat(pave, paverMat, base, 'grove path'); flat(paveLid, paverMat, lidGroup, 'grove path lid');
  flat(kerb, kerbMat, base, 'grove kerbs'); flat(kerbLid, kerbMat, lidGroup, 'grove kerbs lid');

  // ---------- the old olive trees (olive.js): merged trunks and crowns, a soft shade under each ----------
  const vars = oliveVariants(), trees = [];
  for (const [lx, lz, s] of [...ROW_X, ...ROW_Z, ...GREAT, ...RING, ...LOOSE]) {
    const v = trees.length % vars.length, sc = s || 0.92 + R() * 0.32;
    trees.push({ lx, lz, x: C.x + lx, y, z: C.z + lz, v, yaw: R() * 6.28, s: sc, sy: 0.92 + R() * 0.2, r: vars[v].r * sc * 1.25, great: !!s });
  }
  for (const t of trees) cols.addCircle(t.x, t.z, t.r, y - 1, y + 2.4);
  const treeAt = (lx, lz) => trees.find((t) => Math.abs(t.lx - lx) < 0.01 && Math.abs(t.lz - lz) < 0.01);
  const olives = mergeOlives(trees), OM = oliveMaterials();
  // other green in the same leaf mesh: the hedge and the tall trees behind the lot, bushes, trees past the fence
  const green = { pos: [], col: [] }, DARK = [tint('#7f9a52'), tint('#4f6b3a'), tint('#324a2a')], PINE = [tint('#5f7f4a'), tint('#3c5a36'), tint('#27402a')], SUN = [tint('#93a85a'), tint('#5f7d40'), tint('#3a5230')];
  const blob = (lx, ly, lz, r, sq, pal) => clump(green, C.x + lx, y + ly, C.z + lz, r, sq, R, pal);
  for (let z = -46.4; z < -19; z += 1.9) blob(18.5 + (R() - 0.5) * 0.4, 1.15, z, 1.45, 0.95, DARK);               // the hedge west of the lot
  solid(18.5, -32.9, 1.25, 14.5, 2.6);
  const tall = (lx, lz, h, pal = SUN) => { rod([lx, 0, lz], [lx + 0.2, h * 0.62, lz], 0.2, '#5d5346', { geo: bar8 }); for (let k = 0; k < 4; k++) blob(lx + (R() - 0.5) * 2.2, h * (0.55 + 0.13 * k), lz + (R() - 0.5) * 2.2, 2.3 - k * 0.3, 0.8, pal); };
  tall(18.3, -44.5, 9); tall(18.6, -37, 10.5); tall(18.2, -29.5, 8.5); tall(18.7, -23.5, 9.5);
  tall(-54.3, -42, 9, DARK); tall(-54.2, -9.5, 8, DARK);
  for (let k = 0; k < 4; k++) blob(-54.4, 1.2 + k * 1.5, -26, 1.7 - k * 0.38, 1.1, PINE);                          // a conifer by the mast
  rod([-54.4, 0, -26], [-54.4, 3, -26], 0.14, '#5d5346');
  blob(-49.4, 0.55, -30.5, 0.95, 0.75, DARK); blob(46.5, 0.5, 44, 1.0, 0.7, DARK);                                 // bushes
  const greenGeo = finish(green, false);
  for (const mesh of [new THREE.Mesh(olives.trunks, OM.bark), new THREE.Mesh(mergeGeometries([olives.crowns, greenGeo], false), OM.leaf)]) { mesh.matrixAutoUpdate = false; mesh.name = 'grove olives'; group.add(mesh); }
  olives.crowns.dispose(); greenGeo.dispose();
  { // shade: one soft dark disc under every crown
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const discs = trees.map((t) => new THREE.CircleGeometry(3.1 * t.s, 10).rotateX(-Math.PI / 2).translate(t.x, y + 0.05, t.z));
    const m = new THREE.Mesh(mergeGeometries(discs, false), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    for (const d of discs) d.dispose(); m.matrixAutoUpdate = false; m.name = 'grove shade'; m.renderOrder = 1; group.add(m);
  }

  // ---------- strings of coloured bulbs from tree to tree: one mesh, lit at dusk ----------
  const bulbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0 }); bulbMat.userData.night = 2.6;
  bulbMat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif'); };
  emissives.push(bulbMat);
  const bulbs = (() => {
    const ico = new THREE.IcosahedronGeometry(0.075, 0), ip = ico.getAttribute('position'), pos = [], col = [], nor = [], wire = [], hues = ['#ff3b30', '#ffd23a', '#35d65a', '#3a8bff'].map(tint);
    let k = 0;
    for (const [a, b] of STRINGS) {
      const ta = treeAt(...a), tb = treeAt(...b), len = Math.hypot(tb.lx - ta.lx, tb.lz - ta.lz), n = Math.max(4, Math.round(len / 0.8)), sag = 0.3 + len * 0.035;
      let px = 0, py = 0, pz = 0;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = ta.x + (tb.x - ta.x) * t, z = ta.z + (tb.z - ta.z) * t, h = y + 3.0 - sag * 4 * t * (1 - t);
        if (i) wire.push(px, py, pz, x, h, z); px = x; py = h; pz = z;
        if (!i || i === n) continue;
        const c = hues[k++ % 4];
        for (let j = 0; j < ip.count; j++) { pos.push(x + ip.getX(j), h - 0.09 + ip.getY(j) * 1.3, z + ip.getZ(j)); nor.push(ip.getX(j) / 0.075, ip.getY(j) / 0.075, ip.getZ(j) / 0.075); col.push(c.r, c.g, c.b); }
      }
    }
    ico.dispose();
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, bulbMat); m.matrixAutoUpdate = false; m.name = 'grove bulbs'; group.add(m);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    const w = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#1c1c1c' })); w.matrixAutoUpdate = false; group.add(w);
    return m;
  })();
  for (const [lx, lz] of [[-9.5, 14], [4.5, 14.1], [8.1, 24.5], [-23.5, 14]]) lamps.push({ ...P(lx, lz, 2.7), inside: false, range: 15, intensity: 16, color: '#ffc27a' });

  // ---------- the parking lot: asphalt, bays, the roundabout island, parked cars, the bins ----------
  S.slab((LOT.x0 + LOT.x1) / 2, -0.03, (LOT.z0 + LOT.z1) / 2, LOT.x1 - LOT.x0, 0.1, LOT.z1 - LOT.z0, { key: 'groveFlat', mat: flatMat, color: '#a3a29e', scale: 0.5 });
  for (let x = 22.1; x < 52; x += 2.8) paint(0.1, 0.012, 4.8, x, 0.03, -45.3, '#d9d6cc');
  for (let x = 41.2; x < 53; x += 2.8) paint(0.1, 0.012, 4.8, x, 0.03, -16.6, '#d9d6cc');
  const ISLAND = { x: 37, z: -30, r: 4.2 };
  for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2; paint(1.24, 0.17, 0.24, ISLAND.x + Math.sin(a) * ISLAND.r, 0.085, ISLAND.z + Math.cos(a) * ISLAND.r, k % 2 ? '#c8372f' : '#ecebe5', { yaw: a }); }
  batch.add('grovePaver', paverMat, new THREE.CylinderGeometry(ISLAND.r - 0.1, ISLAND.r - 0.1, 0.13, 22), mat4(C.x + ISLAND.x, y + 0.065, C.z + ISLAND.z), { color: tint('#b98f8c'), uv: 'world', uvScale: 1 });
  S.lampPost(ISLAND.x, ISLAND.z, 6.5, { range: 30, intensity: 44 }); circle(ISLAND.x, ISLAND.z, 0.2, 3);
  // kerbs: red and white in front of the hedge and along the north, grey along the south
  for (let z = LOT.z0 + 0.6; z < -19; z += 1.2) paint(0.22, 0.16, 1.18, LOT.x0 + 0.12, 0.08, z, Math.round(z / 1.2) % 2 ? '#c8372f' : '#ecebe5');
  for (let x = LOT.x0 + 0.8; x < LOT.x1; x += 1.2) paint(1.18, 0.16, 0.22, x, 0.08, LOT.z0 + 0.12, Math.round(x / 1.2) % 2 ? '#c8372f' : '#ecebe5');
  piece(batch, 'stone', M.stone, LOT.x1 - 25, 0.15, 0.2, (LOT.x1 + 25) / 2, 0.075, LOT.z1 + 0.1, { color: '#b9b6ae' });
  const CARS = [[23.5, -45.2, 0, '#8e949c'], [26.3, -45.2, 0, '#eeeeec'], [29.1, -45.3, 0, '#3f4650'], [34.7, -45.2, 0, '#f3f3f1'], [40.3, -45.2, 0, '#7a8088'], [45.9, -45.3, 0, '#2f4a78'], [51.5, -45.2, 0, '#dcdcda'], [42.6, -16.7, Math.PI, '#5d646c'], [48.2, -16.6, Math.PI, '#ececea']];
  const cars = new THREE.InstancedMesh(trafficCarGeometry(), trafficMaterial(), CARS.length); cars.name = 'grove cars';
  CARS.forEach(([lx, lz, yaw, color], i) => { cars.setMatrixAt(i, mat4(C.x + lx, y + 0.02, C.z + lz, yaw)); cars.setColorAt(i, tint(color)); solid(lx, lz, 0.95, 2.2, 1.5, yaw); });
  cars.instanceMatrix.needsUpdate = true; cars.instanceColor.needsUpdate = true; cars.computeBoundingSphere(); group.add(cars);
  // two green bins and a purple one at the lot's west edge, under the tall trees
  for (const [lz, color] of [[-38.9, '#3e7a48'], [-36.3, '#3a7244']]) { paint(1.25, 1.0, 1.7, 21.5, 0.55, lz, color); paint(1.33, 0.1, 1.8, 21.5, 1.1, lz, '#2f5d38', { roll: 0.12 }); solid(21.5, lz, 0.66, 0.9, 1.2); }
  batch.add('paint', M.paint, new THREE.CylinderGeometry(0.62, 0.72, 1.35, 10), mat4(C.x + 21.5, y + 0.68, C.z - 42), { color: tint('#8a5fb4') });
  batch.add('paint', M.paint, new THREE.SphereGeometry(0.62, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat4(C.x + 21.5, y + 1.35, C.z - 42), { color: tint('#7c52a6') });
  circle(21.5, -42, 0.74, 1.8);

  // ---------- the dirt corner: the sign on two metal poles, the white limestone boulder ----------
  const SIGN = { x: 19.2, z: -11.8, yaw: Math.PI * 0.75 }, sx = Math.cos(SIGN.yaw), sz = -Math.sin(SIGN.yaw);
  for (const s of [-1.05, 1.05]) { rod([SIGN.x + sx * s, 0, SIGN.z + sz * s], [SIGN.x + sx * s, 3.0, SIGN.z + sz * s], 0.055, '#9aa0a6', { geo: bar8 }); circle(SIGN.x + sx * s, SIGN.z + sz * s, 0.09, 3); }
  paint(2.5, 1.3, 0.05, SIGN.x, 2.3, SIGN.z, '#cfd2d4', { yaw: SIGN.yaw });
  S.sign('חורשת הזיתים', SIGN.x + Math.sin(SIGN.yaw) * 0.035, 2.3, SIGN.z + Math.cos(SIGN.yaw) * 0.035, SIGN.yaw, 2.4, 1.2, { bg: '#e9e6dc', fg: '#3d5a34', size: 150 });
  const BOULDER = { x: 16.9, z: -10.3, r: 1.5 };
  { // the boulder: a big pale block of limestone lying on the dirt, two small ones by it
    const g = new THREE.SphereGeometry(1, 14, 9), p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), yy = p.getY(i), z = p.getZ(i), k = 1 + 0.13 * Math.sin(x * 3.1 + z * 2.3) + 0.09 * Math.cos(yy * 4.7 + x * 1.9) + 0.06 * Math.sin(z * 6.1); p.setXYZ(i, x * 1.5 * k, Math.max(-0.3, yy * 0.72 * k), z * 0.98 * k); }
    g.computeVertexNormals();
    batch.add('paint', M.paint, g, mat4(C.x + BOULDER.x, y + 0.3, C.z + BOULDER.z, 0.5), { color: tint('#eeeadf') }); g.dispose();
    solid(BOULDER.x, BOULDER.z, 1.45, 0.92, 1.0, 0.5);
    for (const [lx, lz, r] of [[19.9, -9.2, 0.3], [14.6, -12.4, 0.24]]) batch.add('paint', M.paint, new THREE.DodecahedronGeometry(r, 1), mat4(C.x + lx, y + r * 0.4, C.z + lz, lx), { color: tint('#e6e1d5') });
  }

  // ---------- benches (wooden slats, black iron frames), the brown bin, the football goal ----------
  const benches = [];
  const bench = (lx, lz, yaw) => { // it faces along (sin yaw, cos yaw)
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), Q = (a, f, h) => [lx + rx * a + fx * f, h, lz + rz * a + fz * f];
    for (const f of [-0.02, 0.13, 0.28]) paint(1.8, 0.035, 0.12, ...Q(0, f, 0.46), '#6d4d33', { yaw });
    for (const [h, f] of [[0.68, -0.2], [0.86, -0.25]]) paint(1.8, 0.13, 0.035, ...Q(0, f, h), '#644630', { yaw, pitch: -0.22 });
    for (const a of [-0.82, 0.82]) { rod(Q(a, 0.32, 0), Q(a, 0.3, 0.44), 0.025, '#17181a'); rod(Q(a, -0.16, 0), Q(a, -0.27, 0.95), 0.025, '#17181a'); rod(Q(a, -0.14, 0.44), Q(a, 0.34, 0.44), 0.025, '#17181a'); rod(Q(a, -0.2, 0.66), Q(a, 0.3, 0.62), 0.02, '#17181a'); rod(Q(a, 0.3, 0.62), Q(a, 0.32, 0.44), 0.02, '#17181a'); }
    solid(lx + fx * 0.05, lz + fz * 0.05, 0.92, 0.3, 0.9, yaw);
    benches.push({ ...P(lx, lz, 0, yaw), sit: P(lx + fx * 0.12, lz + fz * 0.12, 0.46, yaw), front: P(lx + fx * 0.95, lz + fz * 0.95, 0, yaw) });
  };
  bench(-13, 18.6, 0); bench(-3.6, 18.6, 0); bench(3.7, 29.5, -Math.PI / 2); bench(-8, -3.5, Math.PI); bench(-31, -3.5, Math.PI); bench(11.6, -10.4, Math.PI);
  batch.add('paint', M.paint, new THREE.CylinderGeometry(0.24, 0.2, 0.62, 9), mat4(C.x - 24.6, y + 0.62, C.z + 18.9), { color: tint('#7a4a2c') });
  rod([-24.6, 0, 18.9], [-24.6, 0.4, 18.9], 0.04, '#2a2a2c'); circle(-24.6, 18.9, 0.3, 1);
  const GOAL = { x: -18, z: -2.4, w: 3 };
  { const g = '#b9bdc2', x0 = GOAL.x - GOAL.w / 2, x1 = GOAL.x + GOAL.w / 2, z = GOAL.z, zb = z - 1.1, r = 0.04; // the mouth faces south, onto the lawn
    for (const x of [x0, x1]) { rod([x, 0, z], [x, 2, z], r, g, { geo: bar8 }); rod([x, 2, z], [x, 0, zb], r * 0.8, g); rod([x, 0.02, z], [x, 0.02, zb], r * 0.8, g); circle(x, z, 0.09, 2); circle(x, zb, 0.08, 0.5); }
    rod([x0, 2, z], [x1, 2, z], r, g, { geo: bar8 }); rod([x0, 0.02, zb], [x1, 0.02, zb], r * 0.8, g);
  }

  // ---------- the playground on dark gravel ----------
  const GX = (GRAVEL.x0 + GRAVEL.x1) / 2, GZ = (GRAVEL.z0 + GRAVEL.z1) / 2;
  S.slab(GX, 0, GZ, GRAVEL.x1 - GRAVEL.x0, 0.06, GRAVEL.z1 - GRAVEL.z0, { key: 'groveFlat', mat: flatMat, color: '#5f5f64', scale: 0.9 });
  for (const [w, d, lx, lz] of [[28.2, 0.12, GX, GRAVEL.z0], [28.2, 0.12, GX, GRAVEL.z1], [0.12, 20.2, GRAVEL.x0, GZ], [0.12, 20.2, GRAVEL.x1, GZ]]) paint(w, 0.1, d, lx, 0.05, lz, '#7d6a52');
  const SWING = { x: -17, z: 27 };
  { const gr = '#2f6b3e', h = 2.3; // the green A-frame with two swings
    for (const a of [-1.85, 1.85]) for (const s of [-1.15, 1.15]) rod([SWING.x + a, h, SWING.z], [SWING.x + a * 1.03, 0, SWING.z + s], 0.045, gr, { geo: bar8 });
    rod([SWING.x - 1.9, h, SWING.z], [SWING.x + 1.9, h, SWING.z], 0.05, gr, { geo: bar8 });
    for (const a of [-0.85, 0.85]) { for (const c of [-0.22, 0.22]) rod([SWING.x + a + c, h, SWING.z], [SWING.x + a + c, 0.52, SWING.z], 0.012, '#3a3d42'); paint(0.5, 0.04, 0.2, SWING.x + a, 0.5, SWING.z, '#23252a'); }
    solid(SWING.x, SWING.z, 2.0, 0.32, 2.3); for (const a of [-1.9, 1.9]) for (const s of [-1.15, 1.15]) circle(SWING.x + a, SWING.z + s, 0.1, 1);
  }
  const SPIN = { x: -8, z: 25.5 };
  { const m = '#aeb3b8'; // the round spring spinner under its hoops
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.78, 0.78, 0.07, 14), mat4(C.x + SPIN.x, y + 0.46, C.z + SPIN.z), { color: tint('#d9d4c4') });
    batch.add('paint', M.paint, new THREE.TorusGeometry(0.78, 0.035, 5, 16).rotateX(Math.PI / 2), mat4(C.x + SPIN.x, y + 0.47, C.z + SPIN.z), { color: tint('#3a3d42') });
    for (const a of [0.4, 2.5, 4.6]) rod([SPIN.x + Math.cos(a) * 0.4, 0, SPIN.z + Math.sin(a) * 0.4], [SPIN.x + Math.cos(a) * 0.4, 0.44, SPIN.z + Math.sin(a) * 0.4], 0.07, '#2a2c30', { geo: bar8 });
    for (const a of [0, Math.PI / 2]) arc(8, (t) => { const u = (t - 0.5) * 2 * 0.78, hh = 0.48 + Math.sqrt(Math.max(0, 1 - (u / 0.78) ** 2)) * 0.85; return [SPIN.x + Math.cos(a) * u, hh, SPIN.z + Math.sin(a) * u]; }, 0.022, m);
    circle(SPIN.x, SPIN.z, 0.85, 1.4);
  }
  const FISH = { x: -5.5, z: 34 };
  { const b = '#2d6fc4'; // the blue fish seesaw on its spring
    paint(2.7, 0.1, 0.34, FISH.x, 0.56, FISH.z, b); paint(0.5, 0.36, 0.06, FISH.x - 1.5, 0.6, FISH.z, b, { roll: 0.5 }); paint(0.5, 0.36, 0.06, FISH.x + 1.5, 0.6, FISH.z, '#3b86e0', { roll: -0.5 });
    paint(0.34, 0.24, 0.07, FISH.x - 0.95, 0.72, FISH.z, '#3b86e0'); paint(0.34, 0.24, 0.07, FISH.x + 0.95, 0.72, FISH.z, '#3b86e0');
    for (const a of [-0.62, 0.62]) { rod([FISH.x + a, 0.6, FISH.z - 0.17], [FISH.x + a, 0.88, FISH.z - 0.17], 0.018, '#d43a2e'); rod([FISH.x + a, 0.6, FISH.z + 0.17], [FISH.x + a, 0.88, FISH.z + 0.17], 0.018, '#d43a2e'); rod([FISH.x + a, 0.88, FISH.z - 0.17], [FISH.x + a, 0.88, FISH.z + 0.17], 0.018, '#f2c230'); }
    rod([FISH.x, 0, FISH.z], [FISH.x, 0.5, FISH.z], 0.09, '#2a2c30', { geo: bar8 }); solid(FISH.x, FISH.z, 1.5, 0.3, 1);
  }
  const ROCKET = { x: -20, z: 34.5 };
  { // the little rocket slide: blue below, white above, a yellow nose and window, the chute to the east
    const cyl = (r0, r1, h, hy, color, n = 10) => batch.add('paint', M.paint, new THREE.CylinderGeometry(r0, r1, h, n), mat4(C.x + ROCKET.x, y + hy, C.z + ROCKET.z), { color: tint(color) });
    cyl(0.72, 0.78, 1.25, 0.625, '#2f72c9'); cyl(0.66, 0.72, 0.9, 1.7, '#f1f1ee'); cyl(0.05, 0.66, 1.0, 2.65, '#f1f1ee'); cyl(0.0, 0.16, 0.34, 3.26, '#f2c230', 8);
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.27, 0.27, 0.06, 12).rotateX(Math.PI / 2), mat4(C.x + ROCKET.x, y + 1.72, C.z + ROCKET.z + 0.69), { color: tint('#f2c230') });
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.19, 0.19, 0.07, 12).rotateX(Math.PI / 2), mat4(C.x + ROCKET.x, y + 1.72, C.z + ROCKET.z + 0.7), { color: tint('#243a5a') });
    for (const a of [0.8, 2.9, 5.0]) paint(0.5, 0.7, 0.05, ROCKET.x + Math.cos(a) * 0.86, 0.36, ROCKET.z + Math.sin(a) * 0.86, '#f2c230', { yaw: -a });
    paint(2.5, 0.05, 0.56, ROCKET.x + 1.75, 0.66, ROCKET.z, '#f2c230', { roll: -0.5 });
    for (const s of [-0.3, 0.3]) paint(2.5, 0.2, 0.04, ROCKET.x + 1.75, 0.76, ROCKET.z + s, '#2f72c9', { roll: -0.5 });
    circle(ROCKET.x, ROCKET.z, 0.85, 3); solid(ROCKET.x + 1.75, ROCKET.z, 1.15, 0.34, 1.2);
  }

  // ---------- the far end: the mesh fence and its gate, the sandy bed with the white shed, the mast, reeds ----------
  const groundAt = () => y;
  const FX = -52, FX2 = -46, GATE = { z0: -21.2, z1: -17.8 };
  fence(batch, M, cols, C.x + FX, C.z + BOX.z0, C.x + FX, C.z + GATE.z0, groundAt, 2.1); fence(batch, M, cols, C.x + FX, C.z + GATE.z1, C.x + FX, C.z + RIFT.z1, groundAt, 2.1);
  fence(batch, M, cols, C.x + FX, C.z + RIFT.z1, C.x + FX2, C.z + RIFT.z1, groundAt, 2.1); fence(batch, M, cols, C.x + FX2, C.z + RIFT.z1, C.x + FX2, C.z + BOX.z1, groundAt, 2.1);
  { const g = '#8d9399', hz = GATE.z0, a = 1.25, lx = FX - Math.sin(a) * 3.2, lz = hz + Math.cos(a) * 3.2; // the gate leaf, standing open into the strip behind the fence
    for (const [p, q] of [[[FX, 0.05, hz], [FX, 2.3, hz]], [[lx, 0.05, lz], [lx, 2.3, lz]], [[FX, 2.3, hz], [lx, 2.3, lz]], [[FX, 0.25, hz], [lx, 0.25, lz]], [[FX, 1.2, hz], [lx, 1.2, lz]]]) rod(p, q, 0.035, g);
    batch.add('fence', M.fence, new THREE.PlaneGeometry(3.2, 2.0), mat4(C.x + (FX + lx) / 2, y + 1.25, C.z + (hz + lz) / 2, Math.atan2(lx - FX, lz - hz) + Math.PI / 2), { uv: 'keep' });
    rod([FX, 0, GATE.z1], [FX, 2.4, GATE.z1], 0.05, g); cols.addSegment(C.x + FX, C.z + hz, C.x + lx, C.z + lz, 0.12, y - 1, y + 2.2);
  }
  S.slab(-49.75, 0.02, -34, 4.5, 0.06, 24, { key: 'sand', mat: M.sand, color: '#e6dcc0', scale: 0.3 });
  for (const [w, d, lx, lz] of [[0.2, 24.2, -47.5, -34], [4.7, 0.2, -49.75, -22]]) piece(batch, 'stone', M.stone, w, 0.16, d, lx, 0.08, lz, { color: '#bdbab2' });
  const SHED = { x: -50, z: -41, w: 2.7, d: 2.1, h: 2.3 };
  piece(batch, 'plaster', M.plaster, SHED.w, SHED.h, SHED.d, SHED.x, SHED.h / 2, SHED.z, { color: '#f2f1ec' }); paint(SHED.w + 0.2, 0.08, SHED.d + 0.2, SHED.x, SHED.h + 0.04, SHED.z, '#d9d8d2');
  for (const s of [-0.62, 0.62]) { paint(1.1, 1.9, 0.04, SHED.x + s, 1.0, SHED.z + SHED.d / 2 + 0.02, '#e3e2dc'); for (let k = 0; k < 9; k++) paint(0.95, 0.03, 0.05, SHED.x + s, 0.3 + k * 0.18, SHED.z + SHED.d / 2 + 0.04, '#b9b8b2'); }
  solid(SHED.x, SHED.z, SHED.w / 2, SHED.d / 2, SHED.h);
  const MAST = { x: -54, z: -31, h: 14 };
  rod([MAST.x, 0, MAST.z], [MAST.x, MAST.h, MAST.z], 0.13, '#b4b8bc', { geo: bar8 }); paint(1.5, 0.08, 0.08, MAST.x, MAST.h, MAST.z, '#b4b8bc');
  for (const s of [-0.55, 0, 0.55]) S.mesh(box(0.42, 0.3, 0.2), S.bulbMat, MAST.x + s, MAST.h - 0.2, MAST.z + 0.14, 0).rotation.x = 0.5;
  lamps.push({ ...P(MAST.x + 4, MAST.z + 4, MAST.h - 1.5), inside: false, range: 46, intensity: 70, color: '#eef3ff' });
  for (let k = 0; k < 70; k++) { const lx = -55.4 + R() * 2.6, lz = -17 + R() * 9, h = 2.2 + R() * 1.5; batch.add('paint', M.paint, new THREE.ConeGeometry(0.06, h, 3), mat4(C.x + lx, y + h / 2, C.z + lz, R() * 3, 1, 1, 1, (R() - 0.5) * 0.3, (R() - 0.5) * 0.3), { color: tint(k % 3 ? '#7f9a4c' : '#a3ad5a') }); } // reeds

  // ---------- the neighbours: the low white building behind the playground, the arched frame of the court ----------
  const HALL = { x0: -36, x1: 4, z0: 43.5, z1: 47.6, h: 3.5 };
  piece(batch, 'plaster', M.plaster, HALL.x1 - HALL.x0, HALL.h, HALL.z1 - HALL.z0, (HALL.x0 + HALL.x1) / 2, HALL.h / 2, (HALL.z0 + HALL.z1) / 2, { color: '#f0efe9' });
  paint(HALL.x1 - HALL.x0 + 0.5, 0.14, HALL.z1 - HALL.z0 + 0.5, (HALL.x0 + HALL.x1) / 2, HALL.h + 0.07, (HALL.z0 + HALL.z1) / 2, '#d2d0c8');
  for (let x = HALL.x0 + 3; x < HALL.x1 - 2; x += 5) { paint(2.4, 1.1, 0.06, x, 2.05, HALL.z0 - 0.02, '#3d4852'); paint(2.5, 0.07, 0.1, x, 1.46, HALL.z0 - 0.04, '#dddbd3'); }
  solid((HALL.x0 + HALL.x1) / 2, (HALL.z0 + HALL.z1) / 2, (HALL.x1 - HALL.x0) / 2, (HALL.z1 - HALL.z0) / 2, HALL.h);
  for (const x of [-55.2, -51.6, -48]) { // three ribs spanning north-south, two chords with webs between
    const rib = (rise, off) => (t) => { const a = Math.PI * t; return [x, Math.sin(a) * rise + off, 24 - Math.cos(a) * 20]; };
    arc(14, rib(9.2, 0), 0.07, '#c4c8cc'); arc(14, rib(8.5, 0), 0.05, '#c4c8cc');
    for (let k = 1; k < 14; k++) rod(rib(9.2, 0)(k / 14), rib(8.5, 0)((k + (k % 2 ? 0.5 : -0.5)) / 14), 0.025, '#c4c8cc');
  }
  for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) { const a = Math.PI * t; rod([-55.2, Math.sin(a) * 9.2, 24 - Math.cos(a) * 20], [-48, Math.sin(a) * 9.2, 24 - Math.cos(a) * 20], 0.04, '#c4c8cc'); }

  S.finish();
  // ---------- the parallel universe over it all ----------
  const layer = buildLayer(ctx, { S, C, y, P, BOX, RIFT, pathZ, PATH_HALF, trees, treeAt, ROW_X, ROW_Z, GREAT, lid, floor, lidGroup, bulbs, bulbMat, quads, paverMat });
  const tick = (camera, dt) => {
    const dx = camera.position.x - C.x, dz = camera.position.z - C.z, near = dx * dx + dz * dz < 360 * 360;
    if (group.visible !== near) group.visible = near;
    if (near) layer.tick(dt);
  };

  places.grove = {
    x: C.x, z: C.z, y, toWorld: S.toWorld, box: { x0: C.x + BOX.x0, x1: C.x + BOX.x1, z0: C.z + BOX.z0, z1: C.z + BOX.z1 },
    // the ordinary park
    lot: { x0: C.x + LOT.x0, x1: C.x + LOT.x1, z0: C.z + LOT.z0, z1: C.z + LOT.z1, centre: P(38, -24), entrance: P(54, -30, 0, -Math.PI / 2), island: P(ISLAND.x, ISLAND.z), park: [P(32, -45.2, 0, 0), P(37.5, -45.2, 0, 0), P(45.4, -16.7, 0, Math.PI)] },
    sign: P(SIGN.x, SIGN.z, 0, SIGN.yaw), boulder: { ...P(BOULDER.x, BOULDER.z), r: BOULDER.r },
    pathStart: P(18.5, -16.3, 0, -Math.PI / 2), pathEnd: P(-50.4, -17.4, 0, -Math.PI / 2), path: PATH.map(([lx, lz]) => P(lx, lz)), gate: P(-52, -19.5, 0, -Math.PI / 2),
    lawn: P(24, 6), goal: { ...P(GOAL.x, GOAL.z, 0, 0), front: P(GOAL.x, GOAL.z + 3) },
    playground: { centre: P(GX, GZ), x0: C.x + GRAVEL.x0, x1: C.x + GRAVEL.x1, z0: C.z + GRAVEL.z0, z1: C.z + GRAVEL.z1, swings: P(SWING.x, SWING.z + 2), spinner: P(SPIN.x, SPIN.z + 1.8), seesaw: P(FISH.x, FISH.z + 1.6), slide: P(ROCKET.x + 4, ROCKET.z) },
    benches, shed: P(SHED.x, SHED.z + 2.2), hall: P(-16, 42), trees: trees.map((t) => ({ x: t.x, z: t.z, r: t.r, great: t.great })),
    // the parallel universe (grove-layer.js)
    ...layer.api,
    lamps, emissives, tick, group, ground: base, materials: { bulb: bulbMat },
  };
}
