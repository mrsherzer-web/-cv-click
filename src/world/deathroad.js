// The death road (chapter nine, mission 35): כביש המוות. From the safe house's yard north-east across
// the plain (a long straight where a truck can come head-on in the lane), round a bend and east along
// the foot of the northern hills to a fork with three ways to the port:
//   - straight on, the highway: two ramps on its left lane, a truck parked in the right lane, and a
//     place where the Order can close it (a truck across, barriers out to the gallery and the track);
//   - left, the tunnel road: a barricade with a gap, then a long covered gallery at the foot of the hill
//     (a wall on the hill side, columns and a parapet on the other, lamps under the roof);
//   - right, the dirt track: a washed-out crossing, a ramp to jump the ditch, the far bank.
// The three meet again before the last bend into the Black Port's west gate. Side roads where rival
// cars wait, barrels and sheds by the road that a mission sets off after a warning, barricades. Every
// route has its ordered points for the autopilot and for rivals. Invented roads and places.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Road } from './roads.js';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { signAtlas } from './textures.js';
import { smoothstep } from '../core/math.js';

const YARD = { x: 680, z: -175 };      // the safe house's yard, where the road begins
const MAIN = [[676, -175], [698, -178], [716, -190], [728, -205], [790, -282], [850, -357], [878, -392], [898, -415], [924, -427], [955, -429.5],
  [1000, -430], [1100, -429.5], [1200, -429], [1300, -429], [1400, -428.5], [1460, -427.5], [1492, -419], [1512, -402], [1522, -381], [1528, -363], [1538, -352], [1546, -350.5]]; // ends a few metres inside the port's west gate
const FORK = { x: 1000, z: -430 };     // where the tunnel road and the dirt track leave the highway
// the first and last points of a branch are put on the highway's centreline in layout()
const TUNNEL = [[1022, -435], [1048, -445], [1080, -451], [1110, -452], [1200, -452], [1300, -452], [1340, -451], [1372, -446], [1400, -438], [1424, -431.5]];
const TUNNEL_OUT = { x: 1442, z: -428 };
const DIRT = [[1018, -424], [1040, -411], [1068, -398], [1100, -390], [1160, -386], [1240, -385], [1310, -386], [1360, -391], [1398, -402], [1426, -415], [1448, -423.5]];
const DIRT_OUT = { x: 1466, z: -426.5 };
const GALLERY = { x0: 1112, x1: 1298 }; // the covered stretch of the tunnel road
const DITCH = { x: 1242, half: 4, across: 26, depth: 2.4 }; // the washed-out crossing on the dirt track
const LANE = { main: 2.4, tunnel: 2.0, dirt: 1.0, spur: 1.5 }; // the right-hand lane of each (metres right of the centreline)

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  // the start meets the safe house's yard at its own height (its pad is laid out just before this)
  const yardPad = net.pads.filter((p) => !p.walkOnly && p.sd(YARD.x - 4, YARD.z) <= 0.5).sort((a, b) => (b.h + b.top) - (a.h + a.top))[0];
  const startH = yardPad ? yardPad.h + yardPad.top - 0.02 : baseHeight(650, -175);
  const endH = baseHeight(1685, -345); // the port's yard (port.js can read ctx.deathRoad.gate to match)
  const opt = { kind: 'highway', sidewalk: 0, curb: 0, spacing: 2, baseHeight, maxGrade: 0.05 };
  const main = net.add(new Road(MAIN, { ...opt, name: 'כביש המוות', width: 10, shoulder: 3, startH, endH }));
  const on = (q) => { const n = main.nearest(q.x, q.z); return { x: n.qx, z: n.qz, h: n.h, s: n.s }; };
  const f = on(FORK), tOut = on(TUNNEL_OUT), dOut = on(DIRT_OUT);
  const tunnel = net.add(new Road([[f.x, f.z], ...TUNNEL, [tOut.x, tOut.z]], { ...opt, name: 'דרך המנהרות', width: 8, shoulder: 3, startH: f.h, endH: tOut.h }));
  const dirt = net.add(new Road([[f.x, f.z], ...DIRT, [dOut.x, dOut.z]], { ...opt, name: 'דרך העפר', width: 6, shoulder: 2, startH: f.h, endH: dOut.h }));
  // side roads the rival cars come out of (each ends inside the road it joins, at that road's height)
  const at = (road, s, o, a = 0) => { const p = road.at(s); return [p.x + p.nx * o + p.tx * a, p.z + p.nz * o + p.tz * a]; };
  const spurOpt = { ...opt, width: 6, shoulder: 2, maxGrade: 0.06 };
  // slip roads: from a shed off in the field, curving in to meet the road heading the way the chase goes
  const slip = (road, s, side) => [at(road, s, side * 46, -34), at(road, s, side * 22, -14), at(road, s, side * 8, -4), at(road, s, side * 2.2, 6)];
  const sJ1 = 75, sJ2 = 205, sJ4 = main.nearest(1522, -381).s, sJ5 = dirt.nearest(1336, -387).s;
  const j1 = net.add(new Road(slip(main, sJ1, 1), { ...spurOpt, name: 'שביל החווה', endH: main.at(sJ1 + 6).h }));
  const j2 = net.add(new Road(slip(main, sJ2, -1), { ...spurOpt, name: 'דרך המחסנים', endH: main.at(sJ2 + 6).h }));
  const c0 = dirt.nearest(1300, -386), sJ3 = main.nearest(1326, -429).s, c1 = main.at(sJ3);
  const j3 = net.add(new Road([[c0.qx, c0.qz], [1302, -398], [1305, -413], [1313, -423], [c1.x + c1.nx * 2.2, c1.z + c1.nz * 2.2]], { ...spurOpt, name: 'דרך החיבור', startH: c0.h, endH: c1.h }));
  const j4 = net.add(new Road(slip(main, sJ4, 1), { ...spurOpt, name: 'דרך השירות', endH: main.at(sJ4 + 6).h }));
  const j5 = net.add(new Road(slip(dirt, sJ5, 1), { ...spurOpt, name: 'שביל השדות', endH: dirt.at(sJ5 + 6).h }));
  places.deathRoads = [main, tunnel, j1, j2, j3, j4]; // world.js paves these; the dirt track and the field track are drawn here

  // ramps that throw a fast car into the air: walking surfaces in steps (as on Kotzi's highway)
  const ramps = [];
  const ramp = (key, road, s0, { run = 8, rise = 1.2, lane = -2.4, hx = 2.4, n = 7 } = {}) => {
    for (let k = 1; k <= n; k++) {
      const sk = s0 + (k - 0.5) * run / n, p = road.at(sk);
      const pd = net.addPad({ x: p.x + p.nx * lane, z: p.z + p.nz * lane, hx, hz: run / n / 2 + 0.02, yaw: Math.atan2(p.tx, p.tz), h: p.h + rise * k / n - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'ramp' });
      pd.launch = true; pd.slope = rise / run;
    }
    ramps.push({ road: key, s: s0, run, rise, lane, hx });
  };
  ramp('main', main, main.nearest(1050, -430).s);
  ramp('main', main, main.nearest(1325, -429).s);
  // the ditch: a dry wash across the track where the crossing was washed away; a dug pad (the floor),
  // the ramp ends at its near lip
  const sD = dirt.nearest(DITCH.x, -385).s, pD = dirt.at(sD);
  const floorY = pD.h - DITCH.depth;
  const ditchPad = net.addPad({ x: pD.x, z: pD.z, hx: DITCH.across, hz: DITCH.half, yaw: Math.atan2(pD.tx, pD.tz), h: floorY - 0.05, top: 0.05, blend: 4, name: 'ditch' });
  ramp('dirt', dirt, sD - DITCH.half - 9, { run: 9, rise: 1.4, lane: 0, hx: 3.1, n: 8 });

  ctx.keepOut?.push({ x: (GALLERY.x0 + GALLERY.x1) / 2, z: -452, hx: (GALLERY.x1 - GALLERY.x0) / 2 + 14, hz: 14 }, { x: pD.x, z: pD.z, hx: 10, hz: DITCH.across + 6 }, { x: FORK.x, z: FORK.z, hx: 30, hz: 30 });
  const gate = main.nearest(1541, -351);
  ctx.deathRoad = {
    roads: { main, tunnel, dirt, j1, j2, j3, j4, j5 }, ramps,
    ditch: { s: sD, floorY, roadY: pD.h, pad: ditchPad },
    s: { fork: f.s, tunnelOut: tOut.s, dirtOut: dOut.s, j1: sJ1 + 6, j2: sJ2 + 6, j3: sJ3, j3dirt: c0.s, j4: sJ4 + 6, j5: sJ5 + 6, gate: gate.s, end: main.nearest(1533, -352.5).s },
    startH, endH, gate: { x: gate.qx, z: gate.qz, y: gate.h }, // the port's west gate is where the road crosses x = 1540
  };
}

export function build(ctx) {
  const { places, M, cols, group, batch, terrain } = ctx;
  const D = ctx.deathRoad, { main, tunnel, dirt, j1, j2, j3, j4, j5 } = D.roads, S = D.s;
  const G = new THREE.Group(); G.name = 'death road'; group.add(G);
  const yawAt = (p) => Math.atan2(p.tx, p.tz);
  const off = (road, s, o = 0) => { const p = road.at(s); return { x: p.x + p.nx * o, z: p.z + p.nz * o, y: p.h, h: p.h, yaw: yawAt(p), p }; };
  const ground = (x, z) => ctx.net.surface(x, z) ?? terrain.heightAt(x, z);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);
  // a static piece merged into the world's batch (one mesh per material and map chunk)
  const put = (key, mat, geo, x, y, z, yaw = 0, color = '#ffffff', { pitch = 0, roll = 0, scale = 0.3, into = batch } = {}) =>
    into.add(key, mat, geo, mat4(x, y, z, yaw, 1, 1, 1, pitch, roll), { color: tint(color), uv: key === 'paint' ? 'keep' : 'world', uvScale: scale });
  const own = new Batch();             // pieces with this road's own materials (the bulbs): one mesh each
  const lamps = [], emissives = [];
  const bulb = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0, roughness: 0.4 }); bulb.userData.night = 1.6; emissives.push(bulb);
  const tunnelBulb = new THREE.MeshStandardMaterial({ color: '#fff0cc', emissive: '#ffd58a', emissiveIntensity: 1.3, roughness: 0.4 }); // tunnel lights burn day and night
  const CONCRETE = '#cfc9bb', DARK = '#23262c', RUST = '#8a4b2e';

  // ---------- the dirt track and the field track: earth, not asphalt ----------
  for (const [a, b] of [[0, D.ditch.s - DITCH.half], [D.ditch.s + DITCH.half, dirt.length]]) {
    batch.add('ground', M.ground, dirt.ribbon(-3, 3, 0.05, 1 / 6, a, b), null, { color: tint('#9a7650') });
    for (const sd of [1, -1]) batch.add('ground', M.ground, dirt.ribbon(sd * 3, sd * 4.2, 0.02, 1 / 6, a, b), null, { color: tint('#b39b72') });
  }
  batch.add('ground', M.ground, j5.ribbon(-3, 3, 0.05, 1 / 6), null, { color: tint('#9a7650') });

  // ---------- road lights along the highway ----------
  const lampPost = (q) => {
    put('paint', M.paint, cyl(0.07, 0.09, 6.6, 8), q.x, q.h + 3.3, q.z, 0, '#3a3d44');
    own.add('bulb', bulb, new THREE.SphereGeometry(0.22, 8, 6), mat4(q.x, q.h + 6.7, q.z));
    lamps.push({ x: q.x, y: q.h + 6.6, z: q.z, inside: false, range: 24, intensity: 42 });
    cols.addCircle(q.x, q.z, 0.16, q.h - 1, q.h + 6.6);
  };
  // clear of every other road of this place (the branches, the side roads) by `m` metres
  const others = Object.values(D.roads);
  const clearOf = (x, z, m, except) => others.every((r) => r === except || (r.nearest(x, z)?.d ?? Infinity) > r.halfSurface + m);
  for (let s = 24, k = 0; s < main.length - 20; s += 55, k++) { const q = off(main, s, k % 2 ? -8.8 : 8.8); if (clearOf(q.x, q.z, 3, main)) lampPost(q); }

  // ---------- barriers: jersey blocks in a line across a road (o0..o1 from the centreline) ----------
  const barrier = (road, s, o0, o1, into = batch, live = true) => {
    const a = off(road, s, o0), b = off(road, s, o1), len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z), y = Math.max(a.h, b.h);
    put('stone', M.stone, box(0.6, 1.0, len), (a.x + b.x) / 2, y + 0.5, (a.z + b.z) / 2, yaw, CONCRETE, { into });
    for (let t = 0.5; t < len; t += 2) put('paint', M.paint, box(0.62, 0.18, 1.0), a.x + (b.x - a.x) * t / len, y + 0.85, a.z + (b.z - a.z) * t / len, yaw, Math.round(t) % 4 < 2 ? '#d8352a' : '#f2efe6', { into });
    const seg = [a.x, a.z, b.x, b.z, 0.6, Math.min(a.h, b.h) - 1, y + 1.2];
    return live ? cols.addSegment(...seg) : seg;
  };
  // a long line of barriers across open ground (into the fields)
  const fenceLine = (x0, z0, x1, z1, into = batch) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 6)), segs = [];
    for (let k = 0; k < n; k++) {
      const ax = x0 + (x1 - x0) * k / n, az = z0 + (z1 - z0) * k / n, bx = x0 + (x1 - x0) * (k + 1) / n, bz = z0 + (z1 - z0) * (k + 1) / n;
      const y = ground((ax + bx) / 2, (az + bz) / 2), l = Math.hypot(bx - ax, bz - az);
      put('stone', M.stone, box(0.6, 1.0, l + 0.05), (ax + bx) / 2, y + 0.45, (az + bz) / 2, Math.atan2(bx - ax, bz - az), CONCRETE, { into });
      segs.push([ax, az, bx, bz, 0.6, y - 3, y + 1.4]);
    }
    return segs;
  };
  // a lorry: a box body and a cab, wheels; `yaw` is the way it faces
  const lorry = (x, y, z, yaw, { color = DARK, cab = '#1c1f26', into = batch } = {}) => {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    put('paint', M.paint, box(2.6, 3.0, 7.4), x - fx * 1.2, y + 2.0, z - fz * 1.2, yaw, color, { into });
    put('paint', M.paint, box(2.5, 2.4, 2.4), x + fx * 3.7, y + 1.6, z + fz * 3.7, yaw, cab, { into });
    put('paint', M.paint, box(2.3, 0.9, 0.1), x + fx * 4.92, y + 2.2, z + fz * 4.92, yaw, '#4c6a80', { into }); // the windscreen
    for (const a of [-3.8, -2.4, 3.6]) for (const sd of [-1, 1]) put('paint', M.paint, cyl(0.5, 0.5, 0.4, 12), x + fx * a + rx * sd * 1.15, y + 0.5, z + fz * a + rz * sd * 1.15, yaw, '#111111', { roll: Math.PI / 2, into });
  };

  // ---------- the roadblocks a mission can count on ----------
  const roadblocks = [];
  // 1. on the straight out of the yard: two blocks of barriers, a gap in the middle
  { const s = 105; barrier(main, s, -8.2, -2.7); barrier(main, s, 2.7, 8.2);
    for (const o of [-5.4, 5.4]) { const q = off(main, s - 1.4, o); put('paint', M.paint, box(0.25, 1.6, 0.25), q.x, q.h + 0.8, q.z, 0, '#ff7a2e'); }
    roadblocks.push({ kind: 'barriers', road: 'main', route: 'common', s, ...off(main, s), gap: [-2.7, 2.7] }); }
  // 2. on the tunnel road before the gallery: the same, narrower
  const sTB = tunnel.nearest(1078, -451).s;
  { barrier(tunnel, sTB, -7, -2.5); barrier(tunnel, sTB, 2.5, 7); roadblocks.push({ kind: 'barriers', road: 'tunnel', route: 'tunnel', s: sTB, ...off(tunnel, sTB), gap: [-2.5, 2.5] }); }
  // 3. a lorry parked in the highway's right lane after the fork (the left lane is free)
  const sPT = main.nearest(1122, -429).s;
  { const q = off(main, sPT, 3.6), yaw = q.yaw + 0.06; lorry(q.x, q.h, q.z, yaw, { color: '#5a3b2a' });
    cols.addBox(q.x, q.z, 1.35, 4.95, yaw, q.h - 1, q.h + 3.6);
    roadblocks.push({ kind: 'truck', road: 'main', route: 'main', s: sPT, ...q, yaw, gap: [-5, 2.0] }); }
  // 4. the closure: the Order shuts the highway (a lorry across it, barriers out to the gallery wall on
  //    the north and to the dirt track on the south). Open until a mission calls close().
  const sC = main.nearest(1182, -429).s;
  const closeGroup = new THREE.Group(); closeGroup.name = 'death road closure'; closeGroup.visible = false; G.add(closeGroup);
  const cb = new Batch();
  const closure = (() => {
    const q = off(main, sC, 0), yaw = q.yaw + Math.PI / 2;
    lorry(q.x - q.p.nx * 1.2, q.h, q.z - q.p.nz * 1.2, yaw, { color: '#15171b', into: cb });
    barrier(main, sC + 2.2, 3.9, 8.6, cb, false); barrier(main, sC + 2.2, -8.6, -6.3, cb, false); // the ends the lorry leaves
    const segs = [];
    const north = off(main, sC, -8.4), south = off(main, sC, 8.4);
    const tq = tunnel.nearest(north.x, north.z), dq = dirt.nearest(south.x, south.z);
    const toWall = { x: tq.qx + (north.x - tq.qx) * (7.4 / Math.max(1, tq.d)), z: tq.qz + (north.z - tq.qz) * (7.4 / Math.max(1, tq.d)) }; // into the gallery's parapet
    const toTrack = { x: dq.qx + (south.x - dq.qx) * (5.4 / Math.max(1, dq.d)), z: dq.qz + (south.z - dq.qz) * (5.4 / Math.max(1, dq.d)) }; // to the track's shoulder
    segs.push(...fenceLine(north.x, north.z, toWall.x, toWall.z, cb), ...fenceLine(south.x, south.z, toTrack.x, toTrack.z, cb));
    cb.build(closeGroup);
    const truckBox = [q.x, q.z, 8.6, 1.5, q.yaw, q.h - 1, q.h + 3.6];
    let bodies = null;
    return {
      kind: 'closure', road: 'main', route: 'main', s: sC, ...q, closed: false,
      before: { ...off(main, sC - 40, LANE.main), s: sC - 40 },  // where a car sees it in time
      close() { if (bodies) return; closeGroup.visible = true; bodies = [cols.addBox(...truckBox), ...segs.map((g) => cols.addSegment(...g))]; this.closed = true; },
      open() { closeGroup.visible = false; if (bodies) for (const b of bodies) cols.remove(b); bodies = null; this.closed = false; },
    };
  })();
  roadblocks.push(closure);

  // ---------- the tunnel road's covered gallery ----------
  const g0 = tunnel.nearest(GALLERY.x0, -452).s, g1 = tunnel.nearest(GALLERY.x1, -452).s, HALF = 7.3, H = 5.6;
  for (let s = g0; s < g1 - 0.01; s += 4) {
    const s1 = Math.min(g1, s + 4), a = tunnel.at(s), b = tunnel.at(s1), mid = tunnel.at((s + s1) / 2), len = Math.hypot(b.x - a.x, b.z - a.z) + 0.05, yaw = Math.atan2(b.x - a.x, b.z - a.z);
    const side = (o) => ({ ax: a.x + a.nx * o, az: a.z + a.nz * o, bx: b.x + b.nx * o, bz: b.z + b.nz * o });
    { const w = side(-HALF); put('stone', M.stone, box(0.8, H + 0.4, len), (w.ax + w.bx) / 2, mid.h + H / 2 - 0.2, (w.az + w.bz) / 2, yaw, '#9a958d', { scale: 0.35 }); cols.addSegment(w.ax, w.az, w.bx, w.bz, 0.8, mid.h - 2, mid.h + H); } // the hill side
    { const w = side(HALF); put('stone', M.stone, box(0.5, 1.1, len), (w.ax + w.bx) / 2, mid.h + 0.55, (w.az + w.bz) / 2, yaw, '#a8a39a', { scale: 0.35 }); cols.addSegment(w.ax, w.az, w.bx, w.bz, 0.5, mid.h - 2, mid.h + 1.2); } // the parapet
    if (Math.round((s - g0) / 4) % 2 === 0) { const c = off(tunnel, s, HALF); put('stone', M.stone, box(0.8, H, 0.8), c.x, c.h + H / 2, c.z, yaw, '#a8a39a', { scale: 0.35 }); cols.addBox(c.x, c.z, 0.4, 0.4, yaw, c.h - 1, c.h + H); }
    put('stone', M.stone, box(HALF * 2 + 1.2, 0.6, len), mid.x, mid.h + H + 0.3, mid.z, yaw, '#8a857e', { scale: 0.3 });
  }
  for (const s of [g0, g1]) { const p = off(tunnel, s, 0); put('stone', M.stone, box(HALF * 2 + 2, 1.4, 0.9), p.x, p.h + H + 1.0, p.z, p.yaw, CONCRETE); for (const o of [-HALF - 0.4, HALF + 0.4]) { const c = off(tunnel, s, o); put('stone', M.stone, box(1.4, H + 0.6, 1.0), c.x, c.h + H / 2, c.z, p.yaw, CONCRETE); cols.addBox(c.x, c.z, 0.7, 0.5, p.yaw, c.h - 1, c.h + H); } }
  // the roof, for the camera and the lines of sight: it stays under it inside (the gallery runs east-west)
  { const xs = [], zs = []; let top = -Infinity; for (let s = g0; s <= g1; s += 4) { const p = tunnel.at(s); xs.push(p.x); zs.push(p.z); top = Math.max(top, p.h); } cols.addFloor(Math.min(...xs), Math.min(...zs) - HALF + 0.4, Math.max(...xs), Math.max(...zs) + HALF - 0.4, top + H + 0.05); }
  const galleryLamps = [];
  for (let s = g0 + 6; s < g1 - 2; s += 15) {
    const p = off(tunnel, s, 0);
    put('paint', M.paint, box(0.5, 0.12, 1.2), p.x, p.h + H - 0.06, p.z, p.yaw, '#3a3d44');
    own.add('tbulb', tunnelBulb, box(0.36, 0.08, 1.0), mat4(p.x, p.h + H - 0.16, p.z, p.yaw));
    const l = { x: p.x, y: p.h + H - 0.5, z: p.z, inside: true, range: 16, intensity: 26, color: '#ffd9a0' };
    lamps.push(l); galleryLamps.push(l);
  }
  const gallery = { road: 'tunnel', route: 'tunnel', s0: g0, s1: g1, halfWidth: HALF, height: H, start: { ...off(tunnel, g0), s: g0 }, end: { ...off(tunnel, g1), s: g1 }, mid: { ...off(tunnel, (g0 + g1) / 2), s: (g0 + g1) / 2 }, lamps: galleryLamps };

  // ---------- the ramps: the highway's (a yellow steel plate on the left lane), the dirt track's (planks) ----------
  const rampOut = [];
  for (const r of D.ramps) {
    const road = r.road === 'main' ? main : dirt, b = off(road, r.s + r.run, r.lane), mid = off(road, r.s + r.run / 2, r.lane);
    const col = r.road === 'main' ? '#c8a23a' : '#8a6a44', w = r.hx * 2, pitch = -Math.atan2(r.rise, r.run);
    put('paint', M.paint, box(w, 0.3, Math.hypot(r.run, r.rise)), mid.x, mid.h + r.rise / 2 - 0.12, mid.z, mid.yaw, col, { pitch });
    put('paint', M.paint, box(w, r.rise, 0.3), b.x, b.h + r.rise / 2, b.z, b.yaw, col);
    for (const o of [-r.hx + 0.25, r.hx - 0.25]) { const q = off(road, r.s + 0.6, r.lane + o); put('paint', M.paint, box(0.2, 0.9, 0.2), q.x, q.h + 0.45, q.z, 0, '#ff7a2e'); }
    const a = off(road, r.s, r.lane);
    rampOut.push({ ...r, route: r.road, x: a.x, z: a.z, y: a.h, yaw: a.yaw, end: { x: b.x, z: b.z, y: b.h + r.rise }, path: lanePath(road, Math.max(2, r.s - 70), Math.min(road.length - 2, r.s + r.run + 40), r.lane) });
  }

  // ---------- the ditch: the floor, the broken abutments either side (solid: a car down there cannot climb them) ----------
  const dd = D.ditch, pD = off(dirt, dd.s, 0);
  put('ground', M.ground, box(DITCH.across * 2, 0.2, DITCH.half * 2 + 1), pD.x, dd.floorY - 0.1, pD.z, pD.yaw, '#6e5238', { scale: 0.2 });
  for (const sg of [-1, 1]) {
    const c = off(dirt, dd.s + sg * (DITCH.half + 2), 0), top = dd.roadY - 0.02, h = top - (dd.floorY - 0.3);
    put('stone', M.stone, box(10, h, 4), c.x, top - h / 2, c.z, c.yaw, '#a49e92', { scale: 0.35 });
    cols.addBox(c.x, c.z, 5, 2, c.yaw, dd.floorY - 1, dd.roadY - 0.5);
  }
  { const c = off(dirt, dd.s, -4); put('stone', M.stone, cyl(0.8, 0.8, 3.2, 12), c.x, dd.floorY + 0.6, c.z, c.yaw, '#8f8a82', { roll: Math.PI / 2 }); } // a broken culvert pipe
  for (let k = 0; k < 8; k++) { const c = off(dirt, dd.s + ((k * 37) % 7 - 3), -20 + k * 5.5), s = 0.4 + ((k * 13) % 5) * 0.12; put('stone', M.stone, box(s * 2, s, s * 1.5), c.x, dd.floorY + s / 2, c.z, k * 0.7, '#8c8478'); }
  const ditch = { road: 'dirt', route: 'dirt', s: dd.s, x: pD.x, z: pD.z, y: dd.floorY, top: dd.roadY, half: DITCH.half, across: DITCH.across, yaw: pD.yaw,
    near: { ...off(dirt, dd.s - DITCH.half - 9.5), s: dd.s - DITCH.half - 9.5 }, far: { ...off(dirt, dd.s + DITCH.half + 3), s: dd.s + DITCH.half + 3 }, ramp: rampOut.find((r) => r.road === 'dirt') };

  // ---------- roadside things that go up as the cars pass (the mission sets them off, after a warning) ----------
  const blasts = [];
  const thing = (roadKey, road, route, s, o, kind) => {
    const q = off(road, s, o);
    if (kind === 'drum') { for (let k = 0; k < 3; k++) put('paint', M.paint, cyl(0.35, 0.35, 1.0), q.x + (k - 1) * 0.8, q.h + 0.5, q.z + (k % 2) * 0.6, 0, '#c8352d'); cols.addCircle(q.x, q.z + 0.3, 1.25, q.h - 1, q.h + 1); }
    else if (kind === 'shed') { put('plaster', M.plaster, box(4, 2.6, 3), q.x, q.h + 1.3, q.z, q.yaw, '#7d6b52'); put('metal', M.metal, box(4.4, 0.15, 3.4), q.x, q.h + 2.7, q.z, q.yaw, RUST); cols.addBox(q.x, q.z, 2.0, 1.5, q.yaw, q.h - 1, q.h + 2.7); }
    else if (kind === 'tank') { put('paint', M.paint, cyl(1.0, 1.0, 4.4, 14), q.x, q.h + 1.5, q.z, q.yaw + Math.PI / 2, '#d9d4c7', { roll: Math.PI / 2 }); for (const a of [-1.4, 1.4]) put('paint', M.paint, box(1.6, 0.6, 0.3), q.x + Math.sin(q.yaw) * a, q.h + 0.3, q.z + Math.cos(q.yaw) * a, q.yaw, '#4a4d52'); cols.addBox(q.x, q.z, 2.3, 1.05, q.yaw + Math.PI / 2, q.h - 1, q.h + 2.5); } // a fuel tank on two saddles, along the road
    else { put('metal', M.metal, box(1.8, 1.0, 4), q.x, q.h + 0.6, q.z, q.yaw + 0.5, RUST); put('metal', M.metal, box(1.6, 0.6, 2), q.x, q.h + 1.3, q.z, q.yaw + 0.5, RUST); cols.addBox(q.x, q.z, 0.95, 2.05, q.yaw + 0.5, q.h - 1, q.h + 1.6); }
    blasts.push({ x: q.x, y: q.h, z: q.z, s, road: roadKey, route, side: Math.sign(o), kind, size: kind === 'drum' ? 1.6 : kind === 'tank' ? 2.4 : kind === 'shed' ? 2.2 : 1.9 });
  };
  for (const [s, o, kind] of [[30, -12, 'drum'], [140, 12, 'shed'], [182, -12, 'drum'], [250, -13, 'wreck'], [330, 13, 'tank'], [S.fork - 30, 12, 'drum']]) thing('main', main, 'common', s, o, kind);
  for (const [x, o, kind] of [[1085, 12, 'drum'], [1150, -11, 'wreck'], [1262, 12, 'shed'], [1372, 12, 'drum']]) thing('main', main, 'main', main.nearest(x, -429).s, o, kind);
  for (const [x, o, kind] of [[1060, -11.5, 'drum'], [1335, -10, 'tank'], [1388, -11.5, 'drum']]) thing('tunnel', tunnel, 'tunnel', tunnel.nearest(x, -450).s, o, kind); // the hill side: the highway is close on the other
  for (const [x, o, kind] of [[1092, 10, 'drum'], [1165, -10, 'shed'], [1290, 10, 'wreck'], [1395, -10, 'drum']]) thing('dirt', dirt, 'dirt', dirt.nearest(x, -387).s, o, kind);
  thing('main', main, 'common', main.nearest(1476, -424).s, -12, 'tank');

  // ---------- signs: the fork (one gantry, three ways), the gallery's name, the ditch, the port ----------
  const signs = [
    { text: 'המנהרות ←', bg: '#1d4f91' }, { text: 'כביש המוות ↑', bg: '#1d4f91' }, { text: 'דרך העפר →', bg: '#6b4a2b' },
    { text: 'מנהרת הצוק', bg: '#2b2f36' }, { text: 'סכנה · הגשר נסחף', bg: '#b3261e' }, { text: 'הנמל ↑', bg: '#1d4f91' }, { text: 'הנמל ←', bg: '#1d4f91' },
  ];
  const atlas = signAtlas('death road signs', signs, { cellW: 512, cellH: 128, cols: 4, size: 56 });
  const plates = [];
  const plate = (i, x, y, z, yaw, w = 3.4, h = 0.85) => { const g = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = atlas.uv[i]; g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2)); g.applyMatrix4(mat4(x, y, z, yaw)); plates.push(g); };
  { const s = S.fork - 48, q = off(main, s, 0), back = q.yaw + Math.PI; // facing the driver coming from the west
    for (const o of [-8.6, 8.6]) { const c = off(main, s, o); put('paint', M.paint, cyl(0.16, 0.18, 7, 8), c.x, c.h + 3.5, c.z, 0, '#5d6066'); cols.addCircle(c.x, c.z, 0.2, c.h - 1, c.h + 7); }
    { const a = off(main, s, -8.6), b = off(main, s, 8.6); put('paint', M.paint, box(0.3, 0.3, 17.2), (a.x + b.x) / 2, q.h + 6.6, (a.z + b.z) / 2, Math.atan2(b.x - a.x, b.z - a.z), '#5d6066'); }
    [-5, 0, 5].forEach((o, i) => { const c = off(main, s - 0.2, o); plate(i, c.x, q.h + 5.9, c.z, back, 4.2, 1.05); }); }
  { const p = off(tunnel, g0 - 0.5, 0); plate(3, p.x, p.h + H + 1.0, p.z, p.yaw + Math.PI, 5, 1.0); }
  { const p = off(dirt, dd.s - 30, 4.6); put('paint', M.paint, cyl(0.06, 0.06, 2.4, 6), p.x, p.h + 1.2, p.z, 0, '#5d6066'); plate(4, p.x, p.h + 2.2, p.z, p.yaw + Math.PI, 2.6, 0.65); }
  { const p = off(main, 40, 7.4); put('paint', M.paint, cyl(0.06, 0.06, 2.6, 6), p.x, p.h + 1.3, p.z, 0, '#5d6066'); plate(5, p.x, p.h + 2.4, p.z, p.yaw + Math.PI, 2.4, 0.6); }
  { const p = off(main, S.end - 40, 7.4); put('paint', M.paint, cyl(0.06, 0.06, 2.6, 6), p.x, p.h + 1.3, p.z, 0, '#5d6066'); plate(6, p.x, p.h + 2.4, p.z, p.yaw + Math.PI, 2.4, 0.6); }
  const signMesh = new THREE.Mesh(mergeGeometries(plates), new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.7 }));
  for (const g of plates) g.dispose();
  signMesh.name = 'death road signs'; G.add(signMesh);
  own.build(G, { bulb: { cast: false, receive: false }, tbulb: { cast: false, receive: false } });

  // ---------- where rival cars come from: side roads, each with a spot to wait and a way onto the route ----------
  const spurPath = (road, s0, s1) => lanePath(road, s0, s1, LANE.spur);
  const mainLane = laneFn(LANE.main, [{ s: 105, half: 10, ease: 20, lane: 0 }, { s: sPT, half: 12, ease: 20, lane: -2.4 }]);
  const tunnelLane = laneFn(LANE.tunnel, [{ s: sTB, half: 8, ease: 18, lane: 0 }]);
  const dirtLane = laneFn(LANE.dirt, []);
  const joins = [];
  const join = (name, road, s0, onto, route, path) => { const a = off(road, s0, LANE.spur), b = off(road, s0 + 2, LANE.spur); joins.push({ name, road: road.name, x: a.x, z: a.z, y: a.h, yaw: Math.atan2(b.x - a.x, b.z - a.z), onto, route, s: S[name] ?? null, path }); };
  // an open shed at the far end of a side road, where a rival car waits out of sight (open toward the road)
  const shed = (road) => {
    const c = off(road, 4.5, 0), back = off(road, 0.6, 0), y = c.h, wood = '#6b5a44';
    for (const [sa, o] of [[0.8, -4.2], [0.8, 4.2], [8.2, -4.2], [8.2, 4.2]]) { const q = off(road, sa, o); put('paint', M.paint, box(0.25, 3.6, 0.25), q.x, y + 1.8, q.z, c.yaw, wood); cols.addCircle(q.x, q.z, 0.18, y - 1, y + 3.6); }
    put('metal', M.metal, box(9.4, 0.18, 8.6), c.x, y + 3.7, c.z, c.yaw, '#7a6f62');
    { const a = off(road, 0.6, -4.2), b = off(road, 0.6, 4.2); put('plaster', M.plaster, box(0.2, 3.4, 8.4), back.x, y + 1.7, back.z, Math.atan2(b.x - a.x, b.z - a.z), '#8c7a62'); cols.addSegment(a.x, a.z, b.x, b.z, 0.25, y - 1, y + 3.6); }
  };
  for (const r of [j1, j2, j4, j5]) shed(r);
  join('j1', j1, 4.5, 'main', 'common', chain(spurPath(j1, 4.5, j1.length - 2), lanePath(main, S.j1 + 4, S.j1 + 160, mainLane)));
  join('j2', j2, 4.5, 'main', 'common', chain(spurPath(j2, 4.5, j2.length - 2), lanePath(main, S.j2 + 4, S.j2 + 160, mainLane)));
  join('j3', j3, j3.length * 0.4, 'main', 'main', chain(spurPath(j3, j3.length * 0.4, j3.length - 2), lanePath(main, S.j3 + 4, S.j3 + 140, mainLane)));
  join('j4', j4, 4.5, 'main', 'common', chain(spurPath(j4, 4.5, j4.length - 2), lanePath(main, S.j4 + 4, S.end, mainLane)));
  join('j5', j5, 4.5, 'dirt', 'dirt', chain(spurPath(j5, 4.5, j5.length - 2), lanePath(dirt, S.j5 + 4, dirt.length - 4, dirtLane), lanePath(main, S.dirtOut + 5, S.end, mainLane)));

  // ---------- the routes, in order, for the autopilot and for rivals ----------
  const routes = {
    main: lanePath(main, 4, S.end, mainLane),
    tunnel: chain(lanePath(main, 4, S.fork - 4, mainLane), lanePath(tunnel, 5, tunnel.length - 4, tunnelLane), lanePath(main, S.tunnelOut + 5, S.end, mainLane)),
    dirt: chain(lanePath(main, 4, S.fork - 4, mainLane), lanePath(dirt, 5, dirt.length - 4, dirtLane), lanePath(main, S.dirtOut + 5, S.end, mainLane)),
  };
  const cum = Object.fromEntries(Object.entries(routes).map(([k, pts]) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)); return [k, c]; }));
  const nearestIndex = (pts, x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } return { i: best, d: Math.sqrt(bd) }; };

  // ---------- the lorry that comes head-on: down the straight in the lane the gang drives in ----------
  const truckRun = (s0, s1, route) => {
    const a = off(main, s0, LANE.main), b = off(main, s1, LANE.main);
    return { road: 'main', route, s0, s1, lane: LANE.main, dir: -1, dodge: -LANE.main, start: { x: a.x, z: a.z, y: a.h, yaw: a.yaw + Math.PI }, end: { x: b.x, z: b.z, y: b.h }, path: lanePath(main, s0, s1, LANE.main) };
  };
  const truckRuns = [truckRun(292, 128, 'common'), truckRun(main.nearest(1430, -428.5).s, main.nearest(1215, -429).s, 'main')];

  const at = (road, s, o = LANE.main) => { const q = off(road, s, o); return { x: q.x, z: q.z, y: q.h, yaw: q.yaw, s }; };
  const endQ = at(main, S.end, 0);
  const routeOf = { [main.name]: 'main', [tunnel.name]: 'tunnel', [dirt.name]: 'dirt' };
  places.deathRoad = {
    roads: D.roads, routes, lengths: Object.fromEntries(Object.entries(cum).map(([k, c]) => [k, c[c.length - 1]])),
    yard: { ...YARD, y: D.startH }, start: at(main, 6), end: { ...endQ, r: 9 }, gate: { ...D.gate, s: S.gate, yaw: endQ.yaw },
    fork: { ...at(main, S.fork, 0), choices: [
      { route: 'main', label: 'כביש המוות', side: 0, at: at(main, S.fork + 30) },
      { route: 'tunnel', label: 'המנהרות', side: -1, at: at(tunnel, 30, LANE.tunnel) },
      { route: 'dirt', label: 'דרך העפר', side: 1, at: at(dirt, 30, LANE.dirt) } ] },
    rejoins: { tunnel: at(main, S.tunnelOut, 0), dirt: at(main, S.dirtOut, 0) },
    rejoin: at(main, Math.max(S.tunnelOut, S.dirtOut) + 8),
    tunnels: [gallery], gallery, ramps: rampOut, ditch, roadblocks, closure, blasts, joins, lanes: { ...LANE },
    truckRun: truckRuns[0], truckRuns,
    checkpoints: [{ name: 'start', road: 'main', ...at(main, 6) }, { name: 'fork', road: 'main', ...at(main, S.fork - 70) }, { name: 'rejoin', road: 'main', ...at(main, Math.max(S.tunnelOut, S.dirtOut) + 12) }],
    // which way a point is on: 'common' before the fork and after the routes meet, else the route's name
    routeAt(x, z) {
      let u = ctx.net.under(x, z);
      if (!u || !(u.road.name in routeOf)) u = ctx.net.nearest(x, z, 12, (r) => r.name in routeOf);
      if (!u) return null;
      const r = routeOf[u.road.name];
      return { route: r === 'main' && (u.s < S.fork || u.s > Math.max(S.tunnelOut, S.dirtOut)) ? 'common' : r, road: r, s: u.s };
    },
    // a route's points from the one nearest (x, z) on (for a rival that joins it, or a friend's car)
    pathFrom(route, x, z) { const pts = routes[route]; return pts.slice(nearestIndex(pts, x, z).i); },
    // metres left along a route from (x, z) to the end at the port
    remaining(route, x, z) { const pts = routes[route], c = cum[route], n = nearestIndex(pts, x, z); return c[c.length - 1] - c[n.i] + n.d; },
    lamps, emissives, group: G,
  };
}

// a lane that moves aside around obstacles: `avoid` = [{ s, half, ease, lane }]; offsets are in the road's
// own frame (metres right of the centreline, for someone driving toward increasing s)
function laneFn(base, avoid) {
  return (s) => { let o = base; for (const a of avoid) o += (a.lane - o) * (1 - smoothstep(a.half, a.half + a.ease, Math.abs(s - a.s))); return o; };
}

// legs of points joined into one list, with points put in where one leg ends far from the next
function chain(...legs) {
  const out = [];
  for (const leg of legs) for (const p of leg) {
    const q = out[out.length - 1];
    if (q) { const l = Math.hypot(p.x - q.x, p.z - q.z); if (l < 0.5) continue; if (l > 3.5) for (let k = 1, n = Math.ceil(l / 3); k < n; k++) out.push({ x: q.x + (p.x - q.x) * k / n, z: q.z + (p.z - q.z) * k / n }); }
    out.push(p);
  }
  return out;
}

// points along a road from s0 to s1 every `step` metres on a lane (a number or a function of s), in the
// road's own frame: the same offset whichever way the path runs
function lanePath(road, s0, s1, lane, step = 3) {
  const L = typeof lane === 'function' ? lane : () => lane, out = [], dir = s1 >= s0 ? 1 : -1;
  const push = (s) => { const p = road.at(s), o = L(s); out.push({ x: p.x + p.nx * o, z: p.z + p.nz * o }); };
  for (let s = s0; dir > 0 ? s < s1 - 0.5 : s > s1 + 0.5; s += step * dir) push(s);
  push(s1);
  return out;
}
