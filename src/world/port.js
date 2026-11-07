// The Black Port (chapter nine): הנמל השחור, where the death road ends. A walled yard on the plain round a
// water basin dug into it: quays on four sides, two ships docked at the north and south quays with their
// gangways down, three gantry cranes over them, rows of containers (some stacked) for cover and lanes,
// two warehouses on the south side (the west one has the office where the access card lies), the
// control tower in the south-west with stairs round its core up to a glass room with the alarm panel,
// floodlights on masts and two search lights that sweep the yard, guard posts, the west gate where the
// road comes in, and in the south-east corner, behind a wall of stacked containers, the industrial
// elevator: reached only through one container whose back opens. Site-local: origin at the yard's
// centre, +z south. Invented from the ground up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSite } from './compound.js';
import { mat4 } from './batch.js';
import { tint } from './materials.js';
import { Tex } from './textures.js';

const C = { x: 1685, z: -345 };
const YARD = { x0: -145, x1: 145, z0: -95, z1: 95 };    // the walls (world x 1540..1830, z -440..-250)
const BASIN = { x0: -85, x1: 115, z0: -75, z1: 25 };    // the water (world x 1600..1800, z -420..-320)
const WATER = 2.2, DEPTH = 9, DECK = 2.4;                // below the quay; the ships' decks above it
const T = { x: -100, z: 45 }, TF = 12;                   // the control tower and its top room's floor
const GATE = { x: YARD.x0, z: -5, w: 7.6 };              // the west gate (world 1540, -350)

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const h = baseHeight(C.x + GATE.x, C.z + GATE.z); // the gate's own ground: the road comes in level
  const pad = (x0, x1, z0, z1, name) => net.addPad({ x: C.x + (x0 + x1) / 2, z: C.z + (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, yaw: 0, h, top: 0.05, blend: 10, name });
  const E = 6; // ground outside the walls
  pad(YARD.x0 - E, BASIN.x0, YARD.z0 - E, YARD.z1 + E, 'port west');
  pad(BASIN.x1, YARD.x1 + E, YARD.z0 - E, YARD.z1 + E, 'port east');
  pad(BASIN.x0 - 0.5, BASIN.x1 + 0.5, YARD.z0 - E, BASIN.z0, 'port north quay');   // (overlapping their neighbours: no seam to fall through)
  pad(BASIN.x0 - 0.5, BASIN.x1 + 0.5, BASIN.z1, YARD.z1 + E, 'port south');
  // the basin last, so its floor wins over the quays' blends: a hard edge under the quay walls
  ctx.portBasin = net.addPad({ x: C.x + (BASIN.x0 + BASIN.x1) / 2, z: C.z + (BASIN.z0 + BASIN.z1) / 2, hx: (BASIN.x1 - BASIN.x0) / 2, hz: (BASIN.z1 - BASIN.z0) / 2, yaw: 0, h: h - DEPTH, top: 0, blend: 0, covered: false, name: 'port basin' });
  ctx.keepOut?.push({ x: C.x, z: C.z, hx: YARD.x1 + 18, hz: YARD.z1 + 18 });
  ctx.port = { y: h + 0.05 };
}

export function build(ctx) {
  const { places, M, cols, net } = ctx;
  const { y } = ctx.port;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'port' });
  const { wall, seg, slab, door, crate, sign, mesh, std, box, solid, level, toWorld, batch, group } = S;
  const P = (lx, lz, ly = 0, yaw) => ({ ...toWorld(lx, lz), y: y + ly, ...(yaw != null ? { yaw } : {}) });
  const add = (key, mat, geo, lx, ly, lz, ry, color, uvScale = 0.3) => batch.add(key, mat, geo, mat4(C.x + lx, y + ly, C.z + lz, ry), { color: tint(color), uv: 'world', uvScale });
  const paint = (geo, lx, ly, lz, ry, color) => batch.add('paint', M.paint, geo, mat4(C.x + lx, y + ly, C.z + lz, ry), { color: tint(color) });
  const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
  // a straight bar between two site-local points (struts, stays, cables, rails)
  const bar = (key, mat, a, b, t, color) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz), hl = Math.hypot(dx, dz);
    batch.add(key, mat, box(t, t, len), mat4(C.x + (a[0] + b[0]) / 2, y + (a[1] + b[1]) / 2, C.z + (a[2] + b[2]) / 2, Math.atan2(dx, dz), 1, 1, 1, -Math.atan2(dy, hl)), { color: tint(color) });
  };
  const bulb = (geo, lx, ly, lz, ry = 0, pitch = 0) => batch.add('bulb', S.bulbMat, geo, mat4(C.x + lx, y + ly, C.z + lz, ry, 1, 1, 1, pitch), {});
  const red = (lx, ly, lz) => batch.add('red', S.redMat, new THREE.SphereGeometry(0.22, 8, 6), mat4(C.x + lx, y + ly, C.z + lz), {});
  const winMat = std({ color: '#1a2330', emissive: '#ffd9a0', emissiveIntensity: 0, roughness: 0.3 }); winMat.userData.night = 0.9;
  const win = (geo, lx, ly, lz, ry = 0) => batch.add('win', winMat, geo, mat4(C.x + lx, y + ly, C.z + lz, ry), {});
  const screenMat = std({ color: '#0b1220', emissive: '#59c7ff', emissiveIntensity: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9fb4c4', roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const glass = (geo, lx, ly, lz, ry = 0) => batch.add('glass', glassMat, geo, mat4(C.x + lx, y + ly, C.z + lz, ry), {});
  // the yard is wet: asphalt that shines under the floodlights
  const wetMat = new THREE.MeshStandardMaterial({ map: Tex.asphalt(), roughness: 0.42, metalness: 0.0, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const lamp = (lx, lz, ly, o = {}) => S.lamps.push({ ...toWorld(lx, lz), y: y + ly, inside: false, ...o });
  // a lamp under a ceiling `h` up (one mesh for all the bulbs, unlike the site's own)
  const ceilingLamp = (lx, lz, h, o = {}) => { bulb(new THREE.SphereGeometry(0.13, 10, 8), lx, h - 0.3, lz); lamp(lx, lz, h - 0.4, { inside: true, range: 10, intensity: 22, ...o }); };
  const post = (lx, lz, h = 6, o = {}) => { paint(new THREE.CylinderGeometry(0.07, 0.09, h, 8), lx, h / 2, lz, 0, '#3a3d44'); bulb(new THREE.SphereGeometry(0.2, 10, 8), lx, h + 0.1, lz); cols.addCircle(C.x + lx, C.z + lz, 0.12, y - 1, y + h); lamp(lx, lz, h, { range: 24, intensity: 46, ...o }); };
  const drum = (lx, lz, color = '#3a4b8f') => { paint(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), lx, 0.45, lz, 0, color); cols.addCircle(C.x + lx, C.z + lz, 0.32, y - 1, y + 0.9); S.cover.push({ ...toWorld(lx, lz), w: 0.6, d: 0.6 }); };

  // ---------- the ground, the quays, the basin ----------
  const ground = (x0, x1, z0, z1) => slab((x0 + x1) / 2, -0.01, (z0 + z1) / 2, x1 - x0, 0.06, z1 - z0, { key: 'wet', mat: wetMat, color: '#8a8884', scale: 0.1 });
  ground(YARD.x0, BASIN.x0, YARD.z0, YARD.z1); ground(BASIN.x1, YARD.x1, YARD.z0, YARD.z1);
  ground(BASIN.x0, BASIN.x1, YARD.z0, BASIN.z0); ground(BASIN.x0, BASIN.x1, BASIN.z1, YARD.z1);
  const concrete = '#9a978f';
  const gangA = { x: -48 }, gangB = { x: 44 };
  {
    const B = BASIN, W = B.x1 - B.x0, D = B.z1 - B.z0, mx = (B.x0 + B.x1) / 2, mz = (B.z0 + B.z1) / 2;
    // quay walls down to the basin floor (their faces on the edge hide the cut in the ground behind them)
    for (const [lx, lz, w, d] of [[B.x0 - 0.5, mz, 1, D + 2], [B.x1 + 0.5, mz, 1, D + 2], [mx, B.z0 - 0.5, W, 1], [mx, B.z1 + 0.5, W, 1]]) slab(lx, -DEPTH / 2 + 0.02, lz, w, DEPTH + 0.1, d, { key: 'stone', mat: M.stone, color: '#6f6c66', scale: 0.25 });
    // the coping along the edge, a yellow line behind it, bollards
    for (const [lx, lz, w, d] of [[B.x0 - 0.7, mz, 1.4, D + 2.8], [B.x1 + 0.7, mz, 1.4, D + 2.8], [mx, B.z0 - 0.7, W, 1.4], [mx, B.z1 + 0.7, W, 1.4]]) slab(lx, 0.035, lz, w, 0.07, d, { key: 'stone', mat: M.stone, color: concrete, scale: 0.4 });
    for (const [lx, lz, w, d] of [[B.x0 - 1.9, mz, 0.15, D + 5.2], [B.x1 + 1.9, mz, 0.15, D + 5.2], [mx, B.z0 - 1.9, W + 3.8, 0.15], [mx, B.z1 + 1.9, W + 3.8, 0.15]]) slab(lx, 0.045, lz, w, 0.02, d, { key: 'paint', mat: M.paint, color: '#d9b43a' });
    const bollard = (lx, lz) => paint(new THREE.CylinderGeometry(0.22, 0.28, 0.6, 10), lx, 0.42, lz, 0, '#2a2d33');
    for (let lz = B.z0 + 6; lz < B.z1 - 2; lz += 9) { bollard(B.x0 - 0.6, lz); bollard(B.x1 + 0.6, lz); }
    for (let lx = B.x0 + 6; lx < B.x1 - 2; lx += 9) { if (Math.abs(lx - gangA.x) > 2.5) bollard(lx, B.z0 - 0.6); if (Math.abs(lx - gangB.x) > 2.5) bollard(lx, B.z1 + 0.6); }
    // black rubber fenders on the quay faces
    for (let lx = B.x0 + 4; lx < B.x1; lx += 7) for (const lz of [B.z0 + 0.12, B.z1 - 0.12]) paint(new THREE.CylinderGeometry(0.35, 0.35, 1.6, 10), lx, -1.3, lz, 0, '#141518');
    // nobody walks off a quay: the edge stops people and cars (low, so paint and looks go over the water)
    const edge = (x0, z0, x1, z1) => cols.addSegment(C.x + x0, C.z + z0, C.x + x1, C.z + z1, 0.3, y - 1, y + 0.6);
    edge(B.x0 - 0.15, B.z0, B.x0 - 0.15, B.z1); edge(B.x1 + 0.15, B.z0, B.x1 + 0.15, B.z1);
    edge(B.x0, B.z0 - 0.15, gangA.x - 1.25, B.z0 - 0.15); edge(gangA.x + 1.25, B.z0 - 0.15, B.x1, B.z0 - 0.15);
    edge(B.x0, B.z1 + 0.15, gangB.x - 1.25, B.z1 + 0.15); edge(gangB.x + 1.25, B.z1 + 0.15, B.x1, B.z1 + 0.15);
  }
  // the water, and the rain's puddles on the yard (one mesh; the sea's drifting texture)
  let waterMesh = null;
  const waterMat = M.water.clone(); waterMat.color.set('#4d7385'); waterMat.emissive.set('#06141c'); waterMat.opacity = 0.95; waterMat.polygonOffset = true; waterMat.polygonOffsetFactor = -4; waterMat.polygonOffsetUnits = -4;
  {
    const plane = (w, d, lx, ly, lz, k) => { const g = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2); const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * k, uv.getY(i) * d * k); return g.translate(C.x + lx, y + ly, C.z + lz); };
    const geos = [plane(BASIN.x1 - BASIN.x0, BASIN.z1 - BASIN.z0, (BASIN.x0 + BASIN.x1) / 2, -WATER, (BASIN.z0 + BASIN.z1) / 2, 0.06)];
    for (const [lx, lz, w, d] of [[-133, -6, 3.2, 1.6], [-112, 26, 2.2, 3], [-96, -20, 4, 2], [-60, 48, 3, 1.4], [-10, 46, 2.4, 2.4], [30, 66, 3.6, 1.8], [80, 86, 2, 3], [128, -40, 3, 2], [126, 52, 2.6, 1.6], [-30, -86, 3.4, 1.8], [60, -84, 2.2, 1.4], [-140, 60, 2, 2.8]]) geos.push(plane(w, d, lx, 0.035, lz, 0.25));
    const water = new THREE.Mesh(mergeGeometries(geos), waterMat);
    water.name = 'port water'; water.receiveShadow = true; group.add(water); waterMesh = water;
    for (const g of geos) g.dispose();
  }

  // ---------- the outer wall, the west gate, the guard posts ----------
  const outer = { h: 3.6, t: 0.5, color: '#7d7a73', key: 'stone', mat: M.stone, scale: 0.35 };
  wall(YARD.x0, YARD.z0, YARD.x0, YARD.z1, [{ at: GATE.z - YARD.z0, w: GATE.w + 0.2, h: 5 }], outer);
  wall(YARD.x0, YARD.z0, YARD.x1, YARD.z0, [], outer); wall(YARD.x1, YARD.z0, YARD.x1, YARD.z1, [], outer); wall(YARD.x1, YARD.z1, YARD.x0, YARD.z1, [], outer);
  for (const [a, b] of [[[YARD.x0, YARD.z0], [YARD.x0, GATE.z - GATE.w / 2 - 0.1]], [[YARD.x0, GATE.z + GATE.w / 2 + 0.1], [YARD.x0, YARD.z1]], [[YARD.x0, YARD.z0], [YARD.x1, YARD.z0]], [[YARD.x1, YARD.z0], [YARD.x1, YARD.z1]], [[YARD.x1, YARD.z1], [YARD.x0, YARD.z1]]]) seg(a[0], a[1], b[0], b[1], { h: 1.1, y0: 3.6, t: 0.05, key: 'fence', mat: M.fence, color: '#c9ced4', scale: 1 }); // wire on top
  const gate = door(GATE.x, GATE.z, Math.PI / 2, GATE.w, { locked: true, color: '#1c1f26', h: 4.0 });
  for (const sz of [-1, 1]) { slab(GATE.x, 2.5, GATE.z + sz * (GATE.w / 2 + 0.45), 0.9, 5, 0.9, { key: 'stone', mat: M.stone, color: '#5d5a54' }); solid(GATE.x, GATE.z + sz * (GATE.w / 2 + 0.45), 0.45, 0.45, 5); }
  sign('הנמל השחור · כניסה בהיתר בלבד', GATE.x - 0.27, 2.6, GATE.z - 9, -Math.PI / 2, 5.2, 0.7, { bg: '#1c1f26', fg: '#ff9180' });
  red(GATE.x - 0.3, 5.15, GATE.z - GATE.w / 2 - 0.45); red(GATE.x - 0.3, 5.15, GATE.z + GATE.w / 2 + 0.45);
  // a guard post: a booth with windows and an open doorway, a lamp inside
  const booth = (x0, z0, x1, z1, opening) => {
    const o = { h: 2.8, t: 0.2, color: '#c9c4b7' }, sides = { n: [x0, z0, x1, z0], e: [x1, z0, x1, z1], s: [x1, z1, x0, z1], w: [x0, z1, x0, z0] };
    for (const [k, [a, b, c, d]] of Object.entries(sides)) wall(a, b, c, d, k === opening ? [{ at: Math.hypot(c - a, d - b) / 2, w: 1.2, h: 2.2 }] : [], o);
    slab((x0 + x1) / 2, 2.9, (z0 + z1) / 2, x1 - x0 + 0.6, 0.2, z1 - z0 + 0.6, { color: '#5d5f63' });
    for (const [k, [a, b, c, d]] of Object.entries(sides)) if (k !== opening) { const yaw = Math.atan2(c - a, d - b); win(new THREE.PlaneGeometry(Math.hypot(c - a, d - b) - 0.8, 0.7), (a + c) / 2 + Math.cos(yaw) * 0.12, 1.75, (b + d) / 2 - Math.sin(yaw) * 0.12, yaw + Math.PI / 2); }
    ceilingLamp((x0 + x1) / 2, (z0 + z1) / 2, 2.8, { range: 8, intensity: 12 });
    return P((x0 + x1) / 2, (z0 + z1) / 2);
  };
  const gateHouse = booth(-137, -25, -130, -19, 's');
  const eastBooth = booth(136, -34, 140, -29, 'w');

  // ---------- containers ----------
  const COLS = ['#7a2b2b', '#2b4f7a', '#2f6a4a', '#8a6a2b', '#5d636b', '#8a4b2e', '#3a3f6b', '#6b2b4a', '#2b6a6a', '#9a8a6a', '#4a5560', '#7a5a2b'];
  let ci = 0;
  const pick = () => COLS[(ci++ * 5 + 3) % COLS.length];
  // one container (a 40-footer unless short), `tiers` high; `hollow` leaves the bottom one to be built open
  const cont = (lx, lz, yaw, { long = true, tiers = 1, hollow = false, colors = null } = {}) => {
    const len = long ? 12.19 : 6.06, cs = [];
    for (let k = 0; k < tiers; k++) {
      const c = colors?.[k] ?? pick(); cs.push(c);
      if (!(hollow && k === 0)) add('metal', M.metal, box(2.44, 2.59, len), lx, 1.3 + k * 2.6, lz, yaw, c, 0.25);
      if (!(hollow && k === 0)) for (const e of [1, -1]) paint(box(2.3, 2.42, 0.04), lx + Math.sin(yaw) * e * (len / 2 + 0.02), 1.3 + k * 2.6, lz + Math.cos(yaw) * e * (len / 2 + 0.02), yaw, shade(c, 0.7));
    }
    if (!hollow) { solid(lx, lz, 1.22, len / 2, 2.6 * tiers, yaw); S.cover.push({ ...toWorld(lx, lz), w: 2.44, d: len, yaw, h: 2.6 * tiers }); }
    else if (tiers > 1) cols.addBox(C.x + lx, C.z + lz, 1.22, len / 2, yaw, y + 2.6, y + 2.6 * tiers);
    return cs;
  };
  // a block of containers lying east–west, side by side southward from lz0 (tiers per container)
  const rowEW = (lx, lz0, tiers, long = true) => tiers.forEach((t, i) => { if (t) cont(lx, lz0 + 1.25 + i * 2.5, Math.PI / 2, { long, tiers: t }); });
  // the west yard, north of the gate lane: two columns of blocks, lanes between
  const colA = -133.4, colB = -114.9;  // block centres (x -139.5..-127.3 and -121..-108.8)
  rowEW(colA, -91, [2, 2, 1, 2]); rowEW(colB, -91, [1, 2, 2, 0]);
  rowEW(colA, -74, [1, 1, 2, 2]); rowEW(colB, -74, [2, 0, 1, 1]);
  rowEW(colA, -57, [2, 2, 2, 1]); rowEW(colB, -57, [1, 1, 0, 2]);
  rowEW(colA, -40, [1, 2, 1, 1]); rowEW(colB, -40, [2, 2, 1, 0]);
  // south of the lane
  rowEW(colA, 10, [1, 2, 2, 1]); rowEW(colB, 10, [2, 1, 0, 1]);
  rowEW(colA, 30, [2, 2, 1, 0]); rowEW(colA, 50, [1, 1, 2, 2]);
  rowEW(colA, 70, [2, 1, 1, 2]); rowEW(colB, 66, [1, 2, 2, 1]);
  // loose ones on the quays and the east side
  cont(-62, 35.5, Math.PI / 2, { tiers: 1 }); cont(-28, 38, 0.15, { long: false, tiers: 1 }); cont(-4, 34, Math.PI / 2, { long: false, tiers: 2 });
  cont(10, -85, Math.PI / 2, { tiers: 1 }); cont(42, -84, Math.PI / 2, { tiers: 2 }); cont(74, -86, Math.PI / 2, { long: false, tiers: 1 }); cont(100, -84.5, Math.PI / 2, { tiers: 2 });
  cont(139, -72, 0, { tiers: 2 }); cont(139, -50, 0, { long: false, tiers: 1 }); cont(138.5, 2, 0, { tiers: 1 }); cont(121, -12, 0.1, { long: false, tiers: 1 }); cont(138.5, 24, 0, { long: false, tiers: 2 });
  // the storage area east of the warehouses: four columns, two rows, a lane between
  for (const [k, lx] of [36.1, 54.1, 72.1, 90.1].entries()) { rowEW(lx, 55, [[1, 2, 2, 1], [2, 1, 2, 0], [1, 2, 0, 2], [2, 2, 1, 1]][k]); rowEW(lx, 72, [[2, 1, 1, 2], [1, 0, 2, 2], [2, 2, 1, 1], [0, 1, 2, 2]][k]); }
  for (const [lx, lz] of [[-126, 0], [-104, -20], [-70, -88], [-12, 44], [110, 30], [64, 92], [-10, 92]]) crate(lx, lz, 1.4, 1.4, 1.1);
  for (const [lx, lz] of [[-142, -30], [-141.3, -29.4], [-90, 20], [20.5, 50.4], [21.2, 51], [124, -60], [108, 90]]) drum(lx, lz, lz > 0 ? '#c8352d' : '#3a4b8f');
  // trucks with containers on their trailers, parked in the west yard
  const truck = (lx, lz, yaw) => {
    const f = (d) => [lx + Math.sin(yaw) * d, lz + Math.cos(yaw) * d];
    paint(box(2.4, 2.4, 2.4), ...((p) => [p[0], 1.9, p[1]])(f(7.6)), yaw, '#2a2d33');
    win(new THREE.PlaneGeometry(2.0, 0.8), ...((p) => [p[0], 2.5, p[1]])(f(8.82)), yaw);
    paint(box(2.4, 0.4, 13), lx, 1.0, lz, yaw, '#1c1d20');
    for (const d of [-5, -3.6, 4, 7.6]) for (const s of [-1, 1]) paint(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12).rotateZ(Math.PI / 2), lx + Math.sin(yaw) * d + Math.cos(yaw) * s, 0.5, lz + Math.cos(yaw) * d - Math.sin(yaw) * s, yaw, '#141518');
    add('metal', M.metal, box(2.44, 2.59, 12.19), lx + Math.sin(yaw) * -0.4, 2.5, lz + Math.cos(yaw) * -0.4, yaw, pick(), 0.25);
    cols.addBox(C.x + lx + Math.sin(yaw) * 1.5, C.z + lz + Math.cos(yaw) * 1.5, 1.25, 8.1, yaw, y - 1, y + 3.8);
    S.cover.push({ ...toWorld(lx, lz), w: 2.5, d: 16, yaw, h: 3.8 });
  };
  truck(-118, 34, 0); truck(-118, 58, Math.PI);

  // ---------- the ships ----------
  const ships = [];
  const ship = ({ x0, x1, z0, z1, bow, hull, house, quay }) => {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, Lh = x1 - x0, B = z1 - z0, top = DECK - 0.1, bot = -6;
    paint(box(Lh, top - bot, B), mx, (top + bot) / 2, mz, 0, hull);
    paint(box(Lh + 0.08, 0.6, B + 0.08), mx, -WATER + 0.1, mz, 0, '#6a2420');                       // the red at the waterline
    const bx = bow < 0 ? x0 : x1, d = B / Math.SQRT2;
    paint(box(d, top + 1.2 - bot, d), bx, (top + 1.2 + bot) / 2, mz, Math.PI / 4, hull);              // the bow, raised a step
    paint(box(d * 0.98, 0.2, d * 0.98), bx, top + 1.3, mz, Math.PI / 4, '#4a3b30');
    paint(new THREE.CylinderGeometry(0.1, 0.1, 6, 6), bx + bow * 2, top + 1.2 + 3, mz, 0, '#2a2d33'); red(bx + bow * 2, top + 4.3, mz);
    cols.addBox(C.x + mx, C.z + mz, Lh / 2, B / 2, 0, y - 7, y + DECK - 0.15);                          // the hull (lines of sight too)
    cols.addBox(C.x + bx, C.z + mz, d / 2, d / 2, Math.PI / 4, y - 7, y + DECK + 1.2);                   // the bow, raised a step
    const deck = level(mx, mz, Lh / 2, B / 2, DECK, { key: 'paint', mat: M.paint, color: '#4a3b30', thick: 0.2, name: 'ship deck' });
    // bulwarks round the deck, open where the gangway comes aboard
    const bw = { h: 1.1, t: 0.25, floor: DECK, color: shade(hull, 1.3), key: 'paint', mat: M.paint };
    const gx = quay < 0 ? gangA.x : gangB.x, gz = quay < 0 ? z0 : z1;
    wall(x0, gz, x1, gz, [{ at: gx - x0, w: 2.4, h: 2.2 }], bw);
    wall(x0, quay < 0 ? z1 : z0, x1, quay < 0 ? z1 : z0, [], bw);
    wall(bow < 0 ? x1 : x0, z0, bow < 0 ? x1 : x0, z1, [], bw);                                       // the stern
    // the gangway: from the quay up onto the deck, railed both sides
    const run = 5.6, steps = 10, gyaw = quay < 0 ? 0 : Math.PI, sz = Math.cos(gyaw), lz0 = gz - sz * (run - 0.2), dd = run / steps;
    for (let k = 1; k <= steps; k++) net.addPad({ x: C.x + gx, z: C.z + lz0 + sz * (k - 0.5) * dd, hx: 0.9, hz: dd / 2, yaw: gyaw, h: y + DECK * k / steps - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'gangway' });
    bar('metal', M.metal, [gx, 0.05, lz0], [gx, DECK - 0.02, lz0 + sz * run], 0.1, '#6b6f75');
    batch.add('metal', M.metal, box(1.8, 0.1, Math.hypot(run, DECK)), mat4(C.x + gx, y + DECK / 2, C.z + lz0 + sz * run / 2, gyaw, 1, 1, 1, -Math.atan2(DECK, run)), { color: tint('#6b6f75'), uv: 'world', uvScale: 0.5 });
    for (const s of [-1, 1]) {
      bar('paint', M.paint, [gx + s * 0.95, 1.0, lz0], [gx + s * 0.95, DECK + 1.0, lz0 + sz * run], 0.05, '#d9b43a');
      for (const f of [0, 0.5, 1]) bar('paint', M.paint, [gx + s * 0.95, DECK * f, lz0 + sz * run * f], [gx + s * 0.95, DECK * f + 1.0, lz0 + sz * run * f], 0.05, '#d9b43a');
      cols.addSegment(C.x + gx + s * 0.95, C.z + lz0, C.x + gx + s * 0.95, C.z + lz0 + sz * run, 0.1, y - 1, y + DECK + 1.1);
    }
    // the deckhouse at the stern: a cabin on the deck (a door toward the bow), the bridge over it
    const hx0 = bow < 0 ? x1 - 13 : x0 + 2, hx1 = hx0 + 11, hz0 = z0 + 2.2, hz1 = z1 - 2.2, hm = (hz0 + hz1) / 2, front = bow < 0 ? hx0 : hx1;
    const cw = { h: 3, t: 0.25, floor: DECK, color: house };
    wall(hx0, hz0, hx1, hz0, [], cw); wall(hx0, hz1, hx1, hz1, [], cw);
    wall(front, hz0, front, hz1, [{ at: hm - hz0, w: 1.3, h: 2.2 }], cw); wall(bow < 0 ? hx1 : hx0, hz0, bow < 0 ? hx1 : hx0, hz1, [], cw);
    const cabinDoor = door(front, hm, bow < 0 ? Math.PI / 2 : -Math.PI / 2, 1.2, { floor: DECK, color: '#4a4e55' });
    slab((hx0 + hx1) / 2, DECK + 3.1, hm, hx1 - hx0 + 0.4, 0.2, hz1 - hz0 + 0.4, { color: shade(house, 0.85) });
    cols.addFloor(C.x + hx0, C.z + hz0, C.x + hx1, C.z + hz1, y + DECK + 3.0);
    const bx0 = hx0 + 1.5, bx1 = hx1 - 0.5;
    slab((bx0 + bx1) / 2, DECK + 3.2 + 2.3, hm, bx1 - bx0, 4.6, hz1 - hz0 - 1, { color: house });
    cols.addBox(C.x + (bx0 + bx1) / 2, C.z + hm, (bx1 - bx0) / 2, (hz1 - hz0 - 1) / 2, 0, y + DECK + 3.2, y + DECK + 7.8);
    for (const sz2 of [-1, 1]) win(new THREE.PlaneGeometry(bx1 - bx0 - 1, 0.9), (bx0 + bx1) / 2, DECK + 6.6, hm + sz2 * ((hz1 - hz0 - 1) / 2 + 0.02), sz2 > 0 ? 0 : Math.PI);
    win(new THREE.PlaneGeometry(hz1 - hz0 - 2, 0.9), bow < 0 ? bx0 - 0.02 : bx1 + 0.02, DECK + 6.6, hm, bow < 0 ? -Math.PI / 2 : Math.PI / 2);
    win(new THREE.PlaneGeometry(1.4, 0.8), front + (bow < 0 ? -0.14 : 0.14), DECK + 1.7, hm + 2.3, bow < 0 ? -Math.PI / 2 : Math.PI / 2);
    paint(new THREE.CylinderGeometry(1.1, 1.3, 4.5, 12), (bx0 + bx1) / 2 + (bow < 0 ? 2.5 : -2.5), DECK + 7.8 + 2.2, hm, 0, '#1c1d20');   // the funnel
    paint(new THREE.CylinderGeometry(0.08, 0.08, 7, 6), (bx0 + bx1) / 2, DECK + 7.8 + 3.5, hm, 0, '#2a2d33'); red((bx0 + bx1) / 2, DECK + 11.4, hm);
    const inside = P((hx0 + hx1) / 2 + (bow < 0 ? 1.5 : -1.5), hm - 1, DECK, bow < 0 ? -Math.PI / 2 : Math.PI / 2);
    paint(box(2.6, 0.9, 0.7), (hx0 + hx1) / 2, DECK + 0.45, hz0 + 0.6, 0, '#3a3f47'); cols.addBox(C.x + (hx0 + hx1) / 2, C.z + hz0 + 0.6, 1.3, 0.35, 0, y + DECK - 0.3, y + DECK + 0.9);
    batch.add('screen', screenMat, new THREE.PlaneGeometry(1.8, 0.5), mat4(C.x + (hx0 + hx1) / 2, y + DECK + 1.3, C.z + hz0 + 0.27), {});
    ceilingLamp((hx0 + hx1) / 2, hm, DECK + 3, { range: 9, intensity: 14 });
    // cargo on the foredeck: hatch covers and containers, walkways along both sides
    const fx0 = bow < 0 ? x0 + 3 : hx1 + 2, fx1 = bow < 0 ? hx0 - 2 : x1 - 3;
    for (let k = 0, n = Math.floor((fx1 - fx0) / 13); k < n; k++) {
      const cx2 = fx0 + 6.5 + k * 13;
      paint(box(11, 0.8, B - 5), cx2, DECK + 0.4, mz, 0, '#3f4a3a'); cols.addBox(C.x + cx2, C.z + mz, 5.5, (B - 5) / 2, 0, y + DECK - 0.3, y + DECK + 0.8);
      if (k % 2 === 0) for (const s of [-1.25, 1.25]) { const t = k === 0 ? 2 : 1; for (let j = 0; j < t; j++) add('metal', M.metal, box(2.44, 2.59, 6.06), cx2, DECK + 0.8 + 1.3 + j * 2.6, mz + s, Math.PI / 2, pick(), 0.25); cols.addBox(C.x + cx2, C.z + mz + s, 3.03, 1.22, 0, y + DECK + 0.8, y + DECK + 0.8 + 2.6 * t); }
      S.cover.push({ ...toWorld(cx2, mz), w: 11, d: B - 5, h: 0.8, y: y + DECK });
    }
    const lpz = mz + (B / 2 - 0.5) * (quay < 0 ? 1 : -1), lpx = bow < 0 ? x0 + 16 : x1 - 16;   // a deck lamp on the far side
    lamp(lpx, lpz, DECK + 4, { range: 22, intensity: 30, color: '#ffd9a0' });
    bulb(new THREE.SphereGeometry(0.16, 8, 6), lpx, DECK + 4.05, lpz);
    paint(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), lpx, DECK + 2, lpz, 0, '#2a2d33');
    const rec = {
      deck: P(mx, quay < 0 ? z0 + 1.3 : z1 - 1.3, DECK), fore: P(bow < 0 ? x0 + 8 : x1 - 8, quay < 0 ? z0 + 1.3 : z1 - 1.3, DECK), stern: P(bow < 0 ? x1 - 1.0 : x0 + 1.0, quay < 0 ? z0 + 1.3 : z1 - 1.3, DECK),
      gangway: { bottom: P(gx, lz0 - sz * 0.8, 0, gyaw), top: P(gx, gz + sz * 1.0, DECK, gyaw) },
      cabin: { door: cabinDoor, doorAt: P(front + (bow < 0 ? -1.2 : 1.2), hm, DECK, bow < 0 ? Math.PI / 2 : -Math.PI / 2), inside },
      hull: { x0: C.x + x0, x1: C.x + x1, z0: C.z + z0, z1: C.z + z1 }, deckLevel: deck,
    };
    ships.push(rec);
    return rec;
  };
  ship({ x0: -64, x1: -8, z0: BASIN.z0 + 1.5, z1: BASIN.z0 + 13.5, bow: -1, hull: '#23262c', house: '#c9c4b7', quay: -1 });   // at the north quay
  ship({ x0: 12, x1: 68, z0: BASIN.z1 - 13.5, z1: BASIN.z1 - 1.5, bow: 1, hull: '#2b3a4a', house: '#d8d3c6', quay: 1 });     // at the south quay

  // ---------- the gantry cranes ----------
  const cranes = [];
  const crane = (cx0, za, zb, zBack, zTip, zTrolley, color) => {
    const H = 26, HB = 30, xs = [cx0 - 7, cx0 + 7], sea = Math.sign(zTip - zBack), land = sea < 0 ? zb : za;
    for (const lx of xs) for (const lz of [za, zb]) { paint(box(1.1, H, 1.1), lx, H / 2 + 0.6, lz, 0, color); paint(box(1.8, 1.2, 2.4), lx, 0.6, lz, 0, '#2a2d33'); solid(lx, lz, 0.9, 1.2, H); }
    for (const lx of xs) paint(box(1.0, 1.6, zb - za + 1.1), lx, H + 1.4, (za + zb) / 2, 0, color);
    for (const lz of [za, zb]) { paint(box(15.1, 1.6, 1.0), cx0, H + 1.4, lz, 0, color); paint(box(14, 0.7, 0.7), cx0, 11, lz, 0, color); }
    for (const lx of xs) bar('paint', M.paint, [lx, 4.5, za], [lx, 11, zb], 0.4, color);   // a brace, over the heads of those under it
    // the boom, the A-frame over the landside legs, the stays out to the tip
    paint(box(2.4, 2.6, Math.abs(zTip - zBack)), cx0, HB + 1.3, (zBack + zTip) / 2, 0, color);
    const apex = [cx0, HB + 16, land - sea * 2];
    for (const lx of xs) { bar('paint', M.paint, [lx, H + 2, land], [cx0 + (lx - cx0) * 0.15, apex[1], apex[2]], 0.6, color); bar('paint', M.paint, [lx, H + 2, land + sea * (zb - za)], [cx0 + (lx - cx0) * 0.15, apex[1], apex[2]], 0.5, color); }
    for (const f of [0.45, 1]) bar('paint', M.paint, [cx0, apex[1], apex[2]], [cx0, HB + 2.6, zBack + (zTip - zBack) * f], 0.25, '#3a3d44');
    bar('paint', M.paint, [cx0, apex[1], apex[2]], [cx0, HB + 2.6, zBack + sea * 1], 0.25, '#3a3d44');
    paint(box(5, 3.6, 8), cx0, HB + 2.6 + 1.8, zBack + sea * 4.5, 0, shade(color, 0.8));                        // the machinery house
    // the trolley over the ship, its cables and the spreader; the driver's cab under the boom
    paint(box(3.2, 1.2, 3.6), cx0, HB - 0.6, zTrolley, 0, '#3a3d44');
    const hs = DECK + 6.5;
    for (const [sx, sz2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bar('paint', M.paint, [cx0 + sx * 1.1, HB - 1.2, zTrolley + sz2 * 1.4], [cx0 + sx * 4.6, hs + 0.2, zTrolley + sz2 * 1.0], 0.05, '#1c1d20');
    paint(box(12.2, 0.4, 2.6), cx0, hs, zTrolley, 0, '#d9b43a');
    paint(box(2.6, 2.4, 3), cx0 + 1.8, HB - 1.6, land + sea * (zb - za) * 0.2 + sea * 6, 0, '#d8d3c6');
    win(new THREE.PlaneGeometry(2.2, 1.0), cx0 + 1.8, HB - 1.4, land + sea * (zb - za) * 0.2 + sea * 6 + sea * 1.52, sea > 0 ? 0 : Math.PI);
    red(cx0, apex[1] + 0.4, apex[2]); red(cx0, HB + 2.9, zTip - sea * 0.5); red(cx0, HB + 6.6, zBack + sea * 4.5);
    lamp(cx0, (za + zb) / 2, 11.2, { range: 30, intensity: 150, color: '#ffd9a0' });   // under the portal's lower beams
    for (const lz of [za, zb]) for (const dx of [-3, 3]) bulb(box(0.6, 0.25, 0.4), cx0 + dx, 10.55, lz, 0, 0);
    S.cover.push(...[za, zb].flatMap((lz) => xs.map((lx) => ({ ...toWorld(lx, lz), w: 1.8, d: 2.4 }))));
    const c = { ...toWorld(cx0, (za + zb) / 2), y, legs: [za, zb].flatMap((lz) => xs.map((lx) => P(lx, lz))), tip: P(cx0, zTip, HB), cab: P(cx0 + 1.8, land + sea * 6, HB - 2.8) };
    cranes.push(c);
    return c;
  };
  crane(-32, -92, -78, -96, -40, -67, '#a8442f');
  crane(25, 28, 42, 48, -12, 17.5, '#a8442f');
  crane(60, 28, 42, 48, -12, 17.5, '#b8862f');
  for (const lz of [-92, -78, 28, 42]) paint(box(BASIN.x1 - BASIN.x0, 0.05, 0.22), (BASIN.x0 + BASIN.x1) / 2, 0.03, lz, 0, '#3a3d44'); // the crane rails

  // ---------- the warehouses (south): the west one has the office with the access card ----------
  const shedWall = { h: 8, t: 0.3, color: '#5f656d', key: 'metal', mat: M.metal, scale: 0.35 };
  const shed = (x0, x1, z0, z1, { n = [], e = [], s = [], w = [] }, label) => {
    wall(x0, z0, x1, z0, n, shedWall); wall(x1, z0, x1, z1, e, shedWall); wall(x1, z1, x0, z1, s, shedWall); wall(x0, z1, x0, z0, w, shedWall);
    slab((x0 + x1) / 2, 8.15, (z0 + z1) / 2, x1 - x0 + 0.8, 0.3, z1 - z0 + 0.8, { key: 'metal', mat: M.metal, color: '#41454c', scale: 0.25 });
    cols.addFloor(C.x + x0, C.z + z0, C.x + x1, C.z + z1, y + 8.0);
    slab((x0 + x1) / 2, 0.03, (z0 + z1) / 2, x1 - x0 - 0.3, 0.04, z1 - z0 - 0.3, { key: 'stone', mat: M.stone, color: '#8f8c85', scale: 0.2 });
    for (const o of n) { paint(box(o.w + 0.4, 0.7, 0.7), x0 + o.at, (o.h ?? 2.2) + 0.4, z0 - 0.2, 0, '#3a3d44'); bulb(box(0.5, 0.15, 0.3), x0 + o.at, (o.h ?? 2.2) + 1.0, z0 - 0.5); lamp(x0 + o.at, z0 - 1.2, (o.h ?? 2.2) + 1.0, { range: 16, intensity: 26 }); }
    sign(label, (x0 + x1) / 2 + 9, 6.4, z0 - 0.2, Math.PI, 5, 1.0, { bg: '#2b2f36', fg: '#f3efe6', size: 110 });
  };
  const WA = { x0: -78, x1: -38, z0: 52, z1: 88 }, WB = { x0: -22, x1: 18, z0: 52, z1: 88 };
  shed(WA.x0, WA.x1, WA.z0, WA.z1, { n: [{ at: 18, w: 6, h: 5 }], w: [{ at: 18, w: 1.4, h: 2.2 }] }, 'מחסן 3');
  shed(WB.x0, WB.x1, WB.z0, WB.z1, { n: [{ at: 20, w: 6, h: 5 }], e: [{ at: 18, w: 1.4, h: 2.2 }] }, 'מחסן 4');
  // inside the west warehouse: pallet racks in rows, the office in the south-east corner
  // (racks carry pallets drawn as boxes, not crates with their own colliders: one collider per rack)
  const pallet = (lx, ly, lz) => add('wood', M.plaster, box(1.2, 1.0, 1.0), lx, ly + 0.5, lz, 0, '#b8955e', 0.5);
  const rackRow = (x0, x1, lz) => {
    for (const lx of [x0, (x0 + x1) / 2, x1]) paint(box(0.12, 4.2, 1.2), lx, 2.1, lz, 0, '#d9862f');
    for (const ly of [0.15, 1.5, 2.9]) paint(box(x1 - x0, 0.1, 1.2), (x0 + x1) / 2, ly, lz, 0, '#2f5e8f');
    let k = 0; for (let lx = x0 + 0.9; lx < x1 - 0.6; lx += 1.5) for (const ly of [0.2, 1.55, 2.95]) if ((k++ * 7) % 5 !== 2) pallet(lx, ly, lz);
    solid((x0 + x1) / 2, lz, (x1 - x0) / 2, 0.6, 4.2); S.cover.push({ ...toWorld((x0 + x1) / 2, lz), w: x1 - x0, d: 1.2, h: 4.2 });
  };
  rackRow(-74, -54, 66); rackRow(-74, -54, 72.5); rackRow(-74, -54, 79);
  for (const [lx, lz] of [[-60, 58], [-44, 58], [-52, 84]]) crate(lx, lz, 1.4, 1.4, 1.1);
  for (const [lx, lz] of [[-66, 59], [-50, 70]]) ceilingLamp(lx, lz, 8, { range: 16, intensity: 26 });
  const OF = { x0: -48, x1: WA.x1 - 0.15, z0: 76, z1: WA.z1 - 0.15 };   // the office
  const ow = { h: 3, t: 0.15, color: '#d8d3c6' };
  wall(OF.x0, OF.z0, OF.x1, OF.z0, [{ at: 5, w: 1.2, h: 2.2 }], ow); wall(OF.x0, OF.z0, OF.x0, OF.z1, [], ow);
  const officeDoor = door(OF.x0 + 5, OF.z0, 0, 1.2, { color: '#5d636b' });
  win(new THREE.PlaneGeometry(2.4, 0.9), OF.x0 + 2, 1.6, OF.z0 - 0.09, Math.PI);
  sign('משרד · ביטחון', OF.x0 + 5, 2.55, OF.z0 - 0.09, Math.PI, 1.6, 0.35, { bg: '#2b2f36' });
  const desk = { lx: OF.x0 + 6.5, lz: OF.z0 + 7.5 };
  paint(box(1.8, 0.06, 0.9), desk.lx, 0.76, desk.lz, 0, '#6b4e33'); paint(box(1.7, 0.72, 0.8), desk.lx, 0.37, desk.lz, 0, '#4a3624'); solid(desk.lx, desk.lz, 0.9, 0.45, 0.8);
  batch.add('screen', screenMat, new THREE.PlaneGeometry(0.6, 0.38), mat4(C.x + desk.lx + 0.4, y + 1.12, C.z + desk.lz + 0.25, Math.PI), {});
  paint(box(0.62, 0.4, 0.05), desk.lx + 0.4, 1.12, desk.lz + 0.28, 0, '#1c1d20');
  paint(box(0.5, 0.45, 0.5), desk.lx, 0.23, desk.lz - 0.9, 0, '#2a2d33');                                  // the chair
  paint(box(0.6, 1.5, 0.55), OF.x1 - 0.5, 0.75, OF.z0 + 1.2, 0, '#5d636b'); solid(OF.x1 - 0.5, OF.z0 + 1.2, 0.3, 0.28, 1.5); // a cabinet
  const cardMat = std({ color: '#f1efe6', emissive: '#2fd27a', emissiveIntensity: 0.25, roughness: 0.4 }); cardMat.userData.night = 0.6;
  const cardMesh = mesh(box(0.16, 0.012, 0.1), cardMat, desk.lx - 0.4, 0.8, desk.lz - 0.1, 0.3);
  ceilingLamp(desk.lx - 1.5, desk.lz - 2, 3, { range: 9, intensity: 14 });
  // inside the east warehouse: stacks of crates, a forklift
  for (const [lx, lz, n] of [[-16, 60, 2], [-12, 60, 1], [-16, 66, 3], [-4, 76, 2], [2, 76, 1], [10, 62, 2], [10, 70, 2], [-14, 82, 1]]) {
    for (let k = 0; k < n; k++) add('wood', M.plaster, box(1.6, 1.2, 1.6), lx, 0.6 + k * 1.2, lz, 0.1 * k, '#a8865a', 0.5);
    solid(lx, lz, 0.85, 0.85, 1.2 * n); S.cover.push({ ...toWorld(lx, lz), w: 1.6, d: 1.6, h: 1.2 * n });
  }
  const forklift = (lx, lz, yaw) => {
    paint(box(1.3, 1.2, 2.2), lx, 0.9, lz, yaw, '#d9b43a'); paint(box(1.2, 0.08, 1.2), lx + Math.sin(yaw) * 1.4, 1.8, lz + Math.cos(yaw) * 1.4, yaw, '#2a2d33');
    paint(box(1.0, 2.6, 0.12), lx + Math.sin(yaw) * 1.15, 1.3, lz + Math.cos(yaw) * 1.15, yaw, '#2a2d33');
    paint(box(1.2, 0.06, 1.4), lx, 2.4, lz - Math.cos(yaw) * 0.1, yaw, '#2a2d33');
    for (const [a, b] of [[-0.6, 0.7], [0.6, 0.7], [-0.6, -0.7], [0.6, -0.7]]) paint(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 10).rotateZ(Math.PI / 2), lx + Math.cos(yaw) * a + Math.sin(yaw) * b, 0.3, lz - Math.sin(yaw) * a + Math.cos(yaw) * b, yaw, '#141518');
    cols.addBox(C.x + lx + Math.sin(yaw) * 0.4, C.z + lz + Math.cos(yaw) * 0.4, 0.7, 1.6, yaw, y - 1, y + 2.4);
    S.cover.push({ ...toWorld(lx, lz), w: 1.4, d: 3, yaw, h: 2.4 });
  };
  forklift(-2, 64, 0.4); forklift(-70, 44, -1.2);
  for (const [lx, lz] of [[-8, 64], [4, 82]]) ceilingLamp(lx, lz, 8, { range: 16, intensity: 26 });

  // ---------- the control tower: a concrete core, stairs round it, the glass room on top ----------
  const tw = (lx, lz) => [T.x + lx, T.z + lz];
  slab(T.x, 5.85, T.z, 8, 11.7, 8, { key: 'stone', mat: M.stone, color: '#8f8a80', scale: 0.3 });
  solid(T.x, T.z, 4, 4, 11.8);
  sign('מגדל הפיקוח', T.x - 4.06, 8, T.z, -Math.PI / 2, 3.4, 0.6, { bg: '#1c1f26', fg: '#ffd9a0' });
  const flight = (lx, lz, yaw, floor, rise = 3, run = 8, width = 2.2, steps = 12) => {
    const d = run / steps, sx = Math.sin(yaw), sz = Math.cos(yaw);
    for (let k = 1; k <= steps; k++) {
      const sk = (k - 0.5) * d, hk = rise * k / steps;
      net.addPad({ x: C.x + lx + sx * sk, z: C.z + lz + sz * sk, hx: width / 2, hz: d / 2, yaw, h: y + floor + hk - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'port tower stairs' });
      add('metal', M.metal, box(width, 0.08, d + 0.03), lx + sx * sk, floor + hk - 0.04, lz + sz * sk, yaw, '#6b6f75', 0.6);
    }
    for (const s of [-1, 1]) bar('paint', M.paint, [lx + Math.cos(yaw) * s * (width / 2 + 0.05), floor - 0.15, lz - Math.sin(yaw) * s * (width / 2 + 0.05)], [lx + sx * run + Math.cos(yaw) * s * (width / 2 + 0.05), floor + rise - 0.15, lz + sz * run - Math.sin(yaw) * s * (width / 2 + 0.05)], 0.22, '#2a2d33');
    return { bottom: P(lx - sx * 0.8, lz - sz * 0.8, floor, yaw), top: P(lx + sx * run, lz + sz * run, floor + rise, yaw), yaw, rise, run };
  };
  // a railing from a to b (site-local), rising from floor fa to fb: a rail you see and an edge you cannot pass
  const railing = (a, b, fa, fb) => {
    bar('paint', M.paint, [a[0], fa + 1.05, a[1]], [b[0], fb + 1.05, b[1]], 0.06, '#d9b43a');
    bar('paint', M.paint, [a[0], fa + 0.55, a[1]], [b[0], fb + 0.55, b[1]], 0.04, '#d9b43a');
    for (const f of [0, 0.5, 1]) { const px = a[0] + (b[0] - a[0]) * f, pz = a[1] + (b[1] - a[1]) * f, pf = fa + (fb - fa) * f; paint(box(0.06, 1.05, 0.06), px, pf + 0.52, pz, 0, '#d9b43a'); }
    cols.addSegment(C.x + a[0], C.z + a[1], C.x + b[0], C.z + b[1], 0.1, y + Math.min(fa, fb) - 0.3, y + Math.max(fa, fb) + 1.1);
  };
  const r = 6.2, q = 4, LH = 1.2;   // the landings overlap the flights by a little: no seam to fall through
  const f1 = flight(...tw(5.1, q), Math.PI, 0), l1 = level(...tw(5.1, -5.1), LH, LH, 3, { key: 'metal', mat: M.metal, color: '#6b6f75', name: 'tower landing' });
  const f2 = flight(...tw(q, -5.1), -Math.PI / 2, 3), l2 = level(...tw(-5.1, -5.1), LH, LH, 6, { key: 'metal', mat: M.metal, color: '#6b6f75', name: 'tower landing' });
  const f3 = flight(...tw(-5.1, -q), 0, 6), l3 = level(...tw(-5.1, 5.1), LH, LH, 9, { key: 'metal', mat: M.metal, color: '#6b6f75', name: 'tower landing' });
  const f4 = flight(...tw(-q, 5.1), Math.PI / 2, 9), l4 = level(...tw(5.1, 5.1), LH, LH, TF, { key: 'metal', mat: M.metal, color: '#6b6f75', name: 'tower landing' });
  railing(tw(r, q), tw(r, -q), 0, 3); railing(tw(r, -q), tw(r, -r), 3, 3); railing(tw(r, -r), tw(q, -r), 3, 3);
  railing(tw(q, -r), tw(-q, -r), 3, 6); railing(tw(-q, -r), tw(-r, -r), 6, 6); railing(tw(-r, -r), tw(-r, -q), 6, 6);
  railing(tw(-r, -q), tw(-r, q), 6, 9); railing(tw(-r, q), tw(-r, r), 9, 9); railing(tw(-r, r), tw(-q, r), 9, 9);
  railing(tw(-q, r), tw(q, r), 9, TF); railing(tw(q, r), tw(r, r), TF, TF); railing(tw(r, r), tw(r, q), TF, TF);
  // the room: windows all round over a sill, the door from the top landing, the roof
  const room = level(T.x, T.z - 1.05, r, 5.15, TF, { key: 'plaster', mat: M.plaster, color: '#6b6f75', name: 'tower room' });
  const sill = { h: 1.05, t: 0.2, floor: TF, color: '#c2bdb2' }, head = { h: 0.75, y0: 2.25, t: 0.2, floor: TF, color: '#c2bdb2' };
  for (const [a, b] of [[[-r, -r], [r, -r]], [[r, -r], [r, q]], [[-r, q], [-r, -r]]]) {
    seg(...tw(...a), ...tw(...b), sill); seg(...tw(...a), ...tw(...b), head);
    const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]), len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const [gx2, gz2] = tw((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    glass(new THREE.PlaneGeometry(len - 0.3, 1.2), gx2, TF + 1.65, gz2, yaw + Math.PI / 2);
  }
  for (const [a, b] of [[-r, -r], [r, -r], [r, q], [-r, q]]) seg(...tw(a - 0.1, b), ...tw(a + 0.1, b), { h: 3, t: 0.2, floor: TF, color: '#3a3d44' });
  wall(...tw(-r, q), ...tw(r, q), [{ at: 11.3, w: 1.4, h: 2.2 }], { h: 3, t: 0.2, floor: TF, color: '#c2bdb2' });
  const towerDoor = door(...tw(5.1, q), Math.PI, 1.4, { floor: TF, color: '#4a4e55' });
  slab(T.x, TF + 3.1, T.z - 1.1, 2 * r + 0.8, 0.25, 10.2 + 0.8, { color: '#3a3d44' });
  cols.addFloor(C.x + T.x - r, C.z + T.z - r, C.x + T.x + r, C.z + T.z + q, y + TF + 3.0);
  paint(new THREE.CylinderGeometry(0.05, 0.05, 6, 6), T.x + 4, TF + 6.2, T.z - 4, 0, '#2a2d33'); red(T.x + 4, TF + 9.3, T.z - 4);
  // the consoles along the north windows, the alarm panel on them
  paint(box(7, 0.9, 0.7), T.x, TF + 0.45, T.z - r + 0.55, 0, '#3a3f47'); cols.addBox(C.x + T.x, C.z + T.z - r + 0.55, 3.5, 0.35, 0, y + TF - 0.3, y + TF + 0.9);
  for (const dx of [-2.6, -1.4, 1.4, 2.6]) batch.add('screen', screenMat, new THREE.PlaneGeometry(0.9, 0.5), mat4(C.x + T.x + dx, y + TF + 1.25, C.z + T.z - r + 0.62, 0, 1, 1, 1, -0.35), {});
  const panelMat = std({ color: '#2a0d0d', emissive: '#ff3a2a', emissiveIntensity: 0.9, roughness: 0.4 });
  paint(box(1.1, 0.75, 0.12), T.x, TF + 1.3, T.z - r + 0.62, 0, '#1c1d20');
  const panelFace = mesh(new THREE.PlaneGeometry(0.95, 0.6), panelMat, T.x, TF + 1.3, T.z - r + 0.69, 0);
  const alarmLamp = mesh(new THREE.SphereGeometry(0.08, 10, 8), S.redMat, T.x + 0.4, TF + 1.78, T.z - r + 0.62);
  sign('אזעקה', T.x, TF + 0.62, T.z - r + 0.92, 0, 0.9, 0.22, { bg: '#1c1d20', fg: '#ff9180', size: 70 });
  paint(box(0.5, 0.45, 0.5), T.x - 1.8, TF + 0.23, T.z - 3.8, 0, '#2a2d33');
  ceilingLamp(T.x, T.z - 1, TF + 3, { range: 10, intensity: 16 });
  const alarm = { on: true, at: P(T.x, T.z - 4.7, TF, Math.PI), panel: panelFace, lamp: alarmLamp,
    setOn(o) { alarm.on = o; alarmLamp.material = o ? S.redMat : S.greenMat; panelMat.emissive.set(o ? '#ff3a2a' : '#2fd27a'); } };

  // ---------- the search lights: a beam that sweeps; searchSees(x, z) asks whether a point is in one ----------
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const spotMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const headGeo = new THREE.CylinderGeometry(0.45, 0.32, 0.9, 12).rotateX(Math.PI / 2);
  const searchLights = [];
  const searchLight = (lx, ly, lz, { yaw, amp, d0, d1, w, phase = 0, radius = 4.5 }) => {
    const pos = new THREE.Vector3(C.x + lx, y + ly, C.z + lz), target = new THREE.Vector3(), dir = new THREE.Vector3();
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.35, radius, 1, 20, 1, true).translate(0, -0.5, 0), beamMat); cone.renderOrder = 3; cone.frustumCulled = false;
    const spot = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.15, 28).rotateX(-Math.PI / 2), spotMat); spot.renderOrder = 3;
    const head = new THREE.Mesh(headGeo, std({ color: '#2a2d33', metalness: 0.5, roughness: 0.4 }));
    head.position.copy(pos); cone.position.copy(pos); group.add(cone, spot, head);
    const s = { pos: { x: pos.x, y: pos.y, z: pos.z }, target: { x: 0, z: 0 }, radius, on: true, cone, spot, head,
      setOn(o) { s.on = o; cone.visible = spot.visible = o; },
      // where the beam lands at time t (a slow sweep left and right, in and out)
      aim(t) { const a = yaw + amp * Math.sin(t * w + phase), dd = d0 + d1 * Math.sin(t * w * 0.63 + phase * 1.7 + 1); s.target.x = pos.x + Math.sin(a) * dd; s.target.z = pos.z + Math.cos(a) * dd; },
      update(t) {
        s.aim(t);
        target.set(s.target.x, y + 0.05, s.target.z); dir.subVectors(target, pos); const L = dir.length();
        cone.quaternion.setFromUnitVectors(DOWN, dir.divideScalar(L)); cone.scale.set(1, L, 1);
        spot.position.copy(target); head.lookAt(target);
      } };
    s.update(0);
    searchLights.push(s);
    return s;
  };
  const DOWN = new THREE.Vector3(0, -1, 0);
  // one on the tower's roof over the gate lane and the west yard, one on a mast over the storage rows
  paint(box(0.3, 0.3, 1.0), T.x - r - 0.2, TF + 3.3, T.z - r - 0.2, Math.PI / 4, '#2a2d33');
  searchLight(T.x - r - 0.5, TF + 3.7, T.z - r - 0.5, { yaw: -2.6, amp: 0.45, d0: 36, d1: 12, w: 0.32 });
  const SL2 = { x: 112, z: 44, h: 16 };
  paint(new THREE.CylinderGeometry(0.18, 0.26, SL2.h, 8), SL2.x, SL2.h / 2, SL2.z, 0, '#3a3d44'); cols.addCircle(C.x + SL2.x, C.z + SL2.z, 0.3, y - 1, y + SL2.h);
  paint(box(1.2, 0.2, 1.2), SL2.x, SL2.h - 0.1, SL2.z, 0, '#2a2d33');
  searchLight(SL2.x, SL2.h + 0.5, SL2.z, { yaw: -0.85, amp: 0.75, d0: 32, d1: 14, w: 0.27, phase: 2.1 });
  const searchSees = (x, z, yy = y) => {
    for (const s of searchLights) {
      if (!s.on || Math.hypot(x - s.target.x, z - s.target.z) > s.radius) continue;
      if (cols.raycast(s.pos.x, s.pos.y, s.pos.z, x, yy + 1.2, z) === null) return true;
    }
    return false;
  };

  // ---------- floodlights on masts ----------
  const flood = (lx, lz, aim, H = 15) => {
    paint(new THREE.CylinderGeometry(0.16, 0.26, H, 8), lx, H / 2, lz, 0, '#3a3d44'); cols.addCircle(C.x + lx, C.z + lz, 0.32, y - 1, y + H);
    paint(box(2.6, 0.16, 0.16), lx, H, lz, aim, '#2a2d33');
    for (const k of [-0.85, 0, 0.85]) bulb(box(0.62, 0.36, 0.14), lx + Math.cos(aim) * k + Math.sin(aim) * 0.2, H - 0.12, lz - Math.sin(aim) * k + Math.cos(aim) * 0.2, aim, 0.6);
    lamp(lx + Math.sin(aim) * 4, lz + Math.cos(aim) * 4, H - 0.6, { range: 56, intensity: 420, color: '#e4ecff' });
  };
  flood(-140, -60, Math.PI / 2 + 0.4); flood(-140, 24, Math.PI / 2 - 0.3); flood(-90, -30, Math.PI / 2); flood(-84, 92, Math.PI - 0.6);
  flood(-30, 50.4, Math.PI); flood(4, -92, 0); flood(72, -92, 0); flood(104, 92, -Math.PI / 2 - 0.3); flood(141, -88, -Math.PI / 2 - 0.4); flood(141, -6, -Math.PI / 2);
  // over the water from the basin's corners and the middle of the south quay (the ships and the quay edges in light)
  flood(BASIN.x0 - 3, BASIN.z0 - 3, 0.8, 13); flood(BASIN.x1 + 3, BASIN.z0 - 3, -0.8, 13); flood(BASIN.x1 + 3, BASIN.z1 + 3.5, -2.4, 13); flood(BASIN.x0 - 3, BASIN.z1 + 3.5, 2.4, 13); flood(86, BASIN.z1 + 6, Math.PI, 13);
  for (const [lx, lz] of [[-130, -10.5], [-110, 8.6], [60, 50.2], [102, 68.5], [140, 52]]) post(lx, lz, 6);

  // ---------- the south-east corner: a wall of stacked containers, the passage, the elevator ----------
  // the north row: fourteen 40-footers lying north–south, side by side, two high (x 110..145, z 61.8..74);
  // the west row: eight lying east–west (x 109.9..122.1, z 74..94). One in the north row is the passage.
  const NROW = { x0: 110, z: 67.9 }, PASS = 7, pc = NROW.x0 + 1.25 + PASS * 2.5;   // the passage container's centre x (128.75)
  let passColor = null;
  for (let i = 0; i < 14; i++) {
    const lx = NROW.x0 + 1.25 + i * 2.5;
    if (i === PASS) { passColor = cont(lx, NROW.z, 0, { tiers: 2, hollow: true, colors: ['#2b4f7a', '#7a2b2b'] })[0]; continue; }
    cont(lx, NROW.z, 0, { tiers: 2 });
  }
  for (let j = 0; j < 8; j++) cont(116, 74 + 1.25 + j * 2.5, Math.PI / 2, { tiers: 2 });
  slab(116, 1.5, 94.35, 12.2, 3, 0.7, { key: 'stone', mat: M.stone, color: '#7d7a73' }); solid(116, 94.35, 6.1, 0.4, 3); // the gap to the yard wall
  // the passage: an open container — its doors stand open to the yard, its back opens into the corner
  const pz0 = NROW.z - 6.095, pz1 = NROW.z + 6.095;
  for (const s of [-1, 1]) { add('metal', M.metal, box(0.06, 2.59, 12.19), pc + s * 1.19, 1.3, NROW.z, 0, passColor, 0.25); cols.addSegment(C.x + pc + s * 1.15, C.z + pz0, C.x + pc + s * 1.15, C.z + pz1, 0.1, y - 1, y + 2.6); }
  add('metal', M.metal, box(2.44, 0.06, 12.19), pc, 2.57, NROW.z, 0, passColor, 0.25);
  slab(pc, 0.06, NROW.z, 2.3, 0.08, 12.1, { key: 'wood', mat: M.plaster, color: '#6b4e33', scale: 0.5 });
  cols.addFloor(C.x + pc - 1.22, C.z + pz0, C.x + pc + 1.22, C.z + pz1, y + 2.55);
  for (const s of [-1, 1]) { paint(box(0.05, 2.4, 1.18), pc + s * 1.2, 1.25, pz0 - 0.6, 0, shade(passColor, 0.7)); cols.addSegment(C.x + pc + s * 1.2, C.z + pz0, C.x + pc + s * 1.2, C.z + pz0 - 1.18, 0.08, y - 1, y + 2.4); }
  const passDoor = door(pc, pz1 - 0.06, 0, 2.2, { locked: true, color: passColor, h: 2.45 });
  ceilingLamp(pc, NROW.z + 2, 2.55, { range: 7, intensity: 6 });
  // the corner behind it (x 122.1..144.7, z 74..94.7): the elevator's cage, its headframe, the winch house
  const EL = { x0: 134, x1: 140, z0: 85, z1: 89.6 }, ex = (EL.x0 + EL.x1) / 2, ez = (EL.z0 + EL.z1) / 2;
  const fence = { h: 3, t: 0.06, key: 'fence', mat: M.fence, color: '#c9ced4', scale: 1 };
  wall(EL.x0, EL.z0, EL.x1, EL.z0, [{ at: ex - EL.x0, w: 3.0, h: 2.6 }], fence);
  wall(EL.x1, EL.z0, EL.x1, EL.z1, [], fence); wall(EL.x1, EL.z1, EL.x0, EL.z1, [], fence); wall(EL.x0, EL.z1, EL.x0, EL.z0, [], fence);
  add('metal', M.metal, box(EL.x1 - EL.x0 - 0.1, 0.06, EL.z1 - EL.z0 - 0.1), ex, 0.03, ez, 0, '#4a4e55', 0.8);   // the cage's floor plate and its roof
  paint(box(EL.x1 - EL.x0 + 0.2, 0.16, EL.z1 - EL.z0 + 0.2), ex, 3.1, ez, 0, '#3a3d44');
  for (const [lx, lz] of [[EL.x0, EL.z0], [EL.x1, EL.z0], [EL.x0, EL.z1], [EL.x1, EL.z1]]) { paint(box(0.35, 22, 0.35), lx, 11, lz, 0, '#5d636b'); solid(lx, lz, 0.18, 0.18, 22); }
  for (const lh of [8, 15, 21.8]) { for (const lz of [EL.z0, EL.z1]) paint(box(EL.x1 - EL.x0 + 0.35, 0.3, 0.3), ex, lh, lz, 0, '#5d636b'); for (const lx of [EL.x0, EL.x1]) paint(box(0.3, 0.3, EL.z1 - EL.z0), lx, lh, ez, 0, '#5d636b'); }
  paint(new THREE.TorusGeometry(2.0, 0.16, 6, 22), ex, 23.6, ez, Math.PI / 2, '#2a2d33'); paint(box(0.3, 2, 0.3), ex, 22.6, ez, 0, '#2a2d33');
  for (const s of [-0.8, 0.8]) bar('paint', M.paint, [ex + s, 23.2, ez], [ex + s, 3.2, ez], 0.05, '#1c1d20');
  red(ex, 25.8, ez); red(EL.x0, 22.2, EL.z0); red(EL.x1, 22.2, EL.z1);
  const elevatorDoor = door(ex, EL.z0, Math.PI, 3.0, { color: '#3a3d44', h: 2.6 });
  const elevLamp = mesh(new THREE.SphereGeometry(0.1, 10, 8), S.greenMat, EL.x0 - 0.3, 2.5, EL.z0 - 0.15);
  ceilingLamp(ex, ez, 3.05, { range: 9, intensity: 16 });
  sign('מעלית משא · 10 איש', ex, 3.5, EL.z0 - 0.12, Math.PI, 2.6, 0.45, { bg: '#d9b43a', fg: '#1c1d20', size: 90 });
  wall(124, 89, 130, 89, [], { h: 3.4, t: 0.25, color: '#9a9ea4' }); wall(130, 89, 130, 94.5, [], { h: 3.4, t: 0.25, color: '#9a9ea4' }); wall(124, 89, 124, 94.5, [], { h: 3.4, t: 0.25, color: '#9a9ea4' });
  slab(127, 3.5, 91.8, 6.4, 0.2, 5.9, { color: '#5d5f63' }); solid(127, 91.8, 2.9, 2.6, 3.4);
  post(142.5, 76, 5, { range: 18, intensity: 30 });
  const spots = [];
  for (const lz of [EL.z0 + 1.4, EL.z0 + 3.3]) for (let i = 0; i < 5; i++) spots.push(P(EL.x0 + 0.7 + i * 1.15, lz, 0, Math.PI));
  const elevator = {
    door: elevatorDoor, doorAt: P(ex, EL.z0 - 1.4, 0, 0), inside: P(ex, ez, 0, Math.PI), spots, lamp: elevLamp,
    cage: { x0: C.x + EL.x0, x1: C.x + EL.x1, z0: C.z + EL.z0, z1: C.z + EL.z1 }, headframe: P(ex, ez, 23.6),
    contains: (x, z) => x > C.x + EL.x0 && x < C.x + EL.x1 && z > C.z + EL.z0 && z < C.z + EL.z1,
    setLamp(ok) { elevLamp.material = ok ? S.greenMat : S.redMat; },
  };

  let clock = 0;
  S.finish();
  for (const d of [towerDoor, officeDoor, elevatorDoor, ...ships.map((s) => s.cabin.door)]) { d.unlock(); d.setOpen(true); }

  // ---------- where people stand and walk ----------
  const towerPlace = {
    x: C.x + T.x, z: C.z + T.z, foot: f1.bottom, stairs: [f1, f2, f3, f4], landings: [l1, l2, l3, l4].map((l) => ({ x: l.x, z: l.z, y: l.y })),
    top: P(T.x + 5.1, T.z + 5.1, TF, Math.PI), door: towerDoor, doorAt: P(T.x + 5.1, T.z + 5.4, TF, Math.PI), room: P(T.x, T.z - 1, TF, Math.PI), roomLevel: room,
    alarmAt: alarm.at, alarm, view: P(T.x + 4.6, T.z - 2, TF, Math.PI / 2), floor: y + TF,
    inRoom: (x, z, yy) => yy > y + TF - 0.5 && Math.abs(x - (C.x + T.x)) < r && z > C.z + T.z - r && z < C.z + T.z + q,
  };
  places.port = {
    x: C.x, z: C.z, y, toWorld, DECK, bounds: { x0: C.x + YARD.x0, x1: C.x + YARD.x1, z0: C.z + YARD.z0, z1: C.z + YARD.z1 },
    basin: { x0: C.x + BASIN.x0, x1: C.x + BASIN.x1, z0: C.z + BASIN.z0, z1: C.z + BASIN.z1, water: y - WATER, mesh: waterMesh },
    inBasin: (x, z) => x > C.x + BASIN.x0 && x < C.x + BASIN.x1 && z > C.z + BASIN.z0 && z < C.z + BASIN.z1,
    inside: (x, z) => x > C.x + YARD.x0 && x < C.x + YARD.x1 && z > C.z + YARD.z0 && z < C.z + YARD.z1,
    // the west gate, where the death road arrives
    gate, gateOutside: P(GATE.x - 5, GATE.z, 0, Math.PI / 2), gateInside: P(GATE.x + 5, GATE.z, 0, Math.PI / 2),
    gateSpots: [...[-1.8, 0, 1.8, 3.6, -3.6].map((dz) => P(GATE.x - 6.5, GATE.z + dz, 0, Math.PI / 2)), ...[-2.7, -0.9, 0.9, 2.7, 4.5].map((dz) => P(GATE.x - 8.3, GATE.z + dz, 0, Math.PI / 2))],
    parking: [{ ...toWorld(GATE.x - 12, GATE.z - 9), yaw: Math.PI / 2 }, { ...toWorld(GATE.x - 12, GATE.z + 9), yaw: Math.PI / 2 }, { ...toWorld(GATE.x - 20, GATE.z - 9), yaw: Math.PI / 2 }],
    posts: { gate: gateHouse, east: eastBooth },
    tower: towerPlace, alarmAt: alarm.at, alarm,
    // the access card on the office desk
    card: { ...toWorld(desk.lx - 0.4, desk.lz - 0.1), y: y + 0.81, mesh: cardMesh, taken: false, take() { this.taken = true; cardMesh.visible = false; }, put() { this.taken = false; cardMesh.visible = true; } },
    cardOffice: { door: officeDoor, doorAt: P(OF.x0 + 5, OF.z0 - 1.3, 0, 0), inside: P(OF.x0 + 5, OF.z0 + 2.5, 0, 0), desk: P(desk.lx - 0.4, desk.lz - 1.2, 0, 0) },
    warehouses: [
      { x0: C.x + WA.x0, x1: C.x + WA.x1, z0: C.z + WA.z0, z1: C.z + WA.z1, opening: P(WA.x0 + 18, WA.z0 - 1.5, 0, 0), side: P(WA.x0 - 1.5, WA.z0 + 18, 0, Math.PI / 2), inside: P(-60, 60, 0, 0) },
      { x0: C.x + WB.x0, x1: C.x + WB.x1, z0: C.z + WB.z0, z1: C.z + WB.z1, opening: P(WB.x0 + 20, WB.z0 - 1.5, 0, 0), side: P(WB.x1 + 1.5, WB.z0 + 18, 0, -Math.PI / 2), inside: P(-2, 70, 0, 0) },
    ],
    ships, cranes,
    searchLights, searchSees, setSearch(on) { for (const s of searchLights) s.setOn(on); },
    // the false back of a container in the stacked wall, and the corner it opens into
    passage: { door: passDoor, front: P(pc, pz0 - 2.5, 0, 0), mouth: P(pc, pz0 + 0.6, 0, 0), inside: P(pc, NROW.z, 0, 0), back: P(pc, pz1 - 1.0, 0, 0), out: P(pc, pz1 + 2.0, 0, 0), container: { ...toWorld(pc, NROW.z), yaw: 0 } },
    entrance: P(131, 79.5, 0, Math.PI / 2),
    entranceSpots: [...[78, 80, 82, 84, 86].map((lz) => P(124.6, lz, 0, Math.PI / 2)), ...[79, 81, 83, 85, 87].map((lz) => P(126.6, lz, 0, Math.PI / 2))],
    elevator,
    inCorner: (x, z) => x > C.x + 122.1 && x < C.x + YARD.x1 && z > C.z + 74 && z < C.z + YARD.z1,
    // the quiet way from the gate to the passage, for an arrow or a test
    route: [P(GATE.x + 5, GATE.z), P(-124, 4), P(-100, 4), P(-90, 30), P(-90, 58), P(-81, 70), P(-75, 70), P(-50, 69), P(OF.x0 + 5, OF.z0 - 1.3), P(-50, 58), P(-60, 50.5), P(-60, 47.5), P(20, 47.5), P(100, 47.5), P(118, 56), P(pc, pz0 - 2.5)],
    patrols: {
      gate: [P(-138, -13, 0, -Math.PI / 2)], gateLane: [P(-128, 5), P(-100, 5)], westRows: [P(-124.2, -88), P(-124.2, -33)], westQuay: [P(-92, -70), P(-92, 30)],
      towerFoot: [P(-90, 55.5, 0, -2.4)], towerTop: [P(T.x - 3, T.z - 2, TF, Math.PI / 2)],
      northQuay: [P(-75, -85), P(-2, -85)], shipA: [P(-58, BASIN.z0 + 2.8, DECK), P(-24, BASIN.z0 + 2.8, DECK)],
      southQuay: [P(-70, 47.5), P(104, 47.5)], office: [P(-45.5, 73, 0, Math.PI)], storage: [P(45, 68.5), P(95, 68.5)], eastQuay: [P(128, -80), P(128, 30)],
    },
    // standing places behind cover along the quiet way (facing the cover)
    coverSpots: [P(-133.4, 8.2, 0, 0), P(-114.9, 8.2, 0, 0), P(-110.5, 15, 0, -Math.PI / 2), P(-120, 27, 0, 0), P(-125.5, 61.5, 0, -Math.PI / 2), P(-64, 33.3, 0, 0), P(-28, 40.6, 0, Math.PI), P(-4, 31.4, 0, 0),
      P(28, 60, 0, Math.PI / 2), P(63, 68.5, 0, 0), P(99.5, 75, 0, -Math.PI / 2), P(108.5, 64, 0, Math.PI / 2), P(-121, -10.2, 0, 0)],
    cover: S.cover, lamps: S.lamps, emissives: [...S.emissives, winMat, screenMat, panelMat, cardMat],
    tick(camera, dt) {
      const p = camera.position, far = Math.max(Math.abs(p.x - C.x) - YARD.x1, Math.abs(p.z - C.z) - YARD.z1) > 650;
      group.visible = !far;
      if (far) return;
      clock += dt;
      const glow = Math.min(1, S.bulbMat.emissiveIntensity / 1.6);   // the night, as the lamps have it
      beamMat.opacity = 0.11 * glow; spotMat.opacity = 0.32 * glow;
      for (const s of searchLights) s.update(clock);
    },
  };
}
