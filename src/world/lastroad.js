// The last road (chapter ten, "הדרך לגיהינום"): from the safe house to the Shadow's citadel.
//   - the link ("דרך בית המסתור"): out of the safe house's gate, right off the death road's first metres and
//     south-east across the plain onto the iron road just past its barricade, near (862, -56);
//   - the iron road (chapter eight's) to its end at (1000, -24), where Kotzi's truck stood across it: the
//     truck and its barriers are still there for chapters eight and nine; truck.clear() takes them away;
//   - the hills road ("דרך הגבעות") east from there between low hills to a bridge over a new ravine at
//     (1320, 50), and on ("הגישה למצודה") to the citadel's main gate at (1440, 95). The bridge's middle span
//     is its own: bridge.blow() takes it (meshes, parapets, the surface), leaves burning rubble on the two
//     stumps that stops a car, bridge.restore() puts it back;
//   - the service road ("כביש השירות למצודה") leaves the hills road at the fork (1230, 20), goes south-east
//     round the ravine's south end to the service gate at (1440, 235).
// Along the way: side tracks through gaps in the hills where rival cars wait, roadside things a mission
// sets off after a warning, barricades with a gap (down until a mission raises them), a marked stretch for
// dodging, checkpoints, and the shallow bank beside the service road where the armoured car ends on its
// side. The ravine has a low wall along its rim: nobody gets across it but over the bridge. Invented.
//
// ctx.places.lastRoad (world coordinates; a pose is { x, z, y, yaw, s? }: yaw the way a car on it heads, s the
// metres along its road; lanes are LANE = 2 m right of a road's centreline, the way the routes go):
//   roads           { link, hills, east, service, t1, t2, t3, iron } (Road objects: at(s), nearest(x, z), length);
//                   link 'דרך בית המסתור' (680,-175)->(869,-57) onto the iron road; hills 'דרך הגבעות' (1000,-24)->
//                   (1294,50); east 'הגישה למצודה' (1347,50)->(1446,95); service 'כביש השירות למצודה' from the fork
//                   (1230,20) round the ravine's south end to (1446,235); t1 'שביל הרועים', t2 'שביל הבאר', t3
//                   'שביל הוואדי' the earth side tracks; iron is chapter eight's 'כביש הברזל'
//   routes          point lists [{ x, z }] about 3 m apart for an Autopilot (game.drivePath([['points', pts]], cruise)):
//                   link (the yard's gate to the iron road), iron (on to its end at (1000,-24)), main (the hills road,
//                   over the bridge, to the main gate's outside), service (the hills road to the fork, the service
//                   road to the service gate's outside), escape (from where places.citadel.armoured.route ends,
//                   16 m out of the service gate, back along the service road to the rollover bank), direct =
//                   link+iron+main, convoy = link+iron+service. The routes thread the barricades' gaps.
//   lengths         each route's length in metres; lanes { right: 2, left: -2 }
//   start, join, ironEnd   poses: the link's start by the yard's gate, where it meets the iron road, the iron road's end
//   truck           Kotzi's truck and barriers across the iron road's end (chapter eight's, still there): truck.clear()
//                   takes them off the road (do it before a convoy drives routes.iron), truck.restore(); found, cleared
//   fork            pose where the service road leaves the hills road (1230, 20); fork.before (40 m before it);
//                   fork.choices [{ route: 'main', label, at }, { route: 'service', label, at }] (at: 26 m along each)
//   bridge          over the new ravine at (1320, 50), deck y = bridge.y, east-west, x0 1292..x1 1348, width 10:
//                   west / east (approach poses on the roads), westDeck / eastDeck / mid / edge.{west,east} (on the
//                   deck), gap { x0: 1308, x1: 1332 } (the span that goes), floorY (the ravine's floor, 16 m down),
//                   blow({ fx, boom = true }): the span goes (its meshes, parapets and surface), burning rubble on
//                   both stumps stops whoever comes (a car is stopped there, it does not fall; nobody crosses on
//                   foot); with fx (game.fx) also the game's blast (unless boom: false) and fires; the warning
//                   before it is the mission's. restore() puts it back. blown, span, wreck (groups), fires [{x,y,z}],
//                   onDeck(x, z), overGap(x, z)
//   ravine          { x0, x1, z0, z1, floorY, rimY, contains(x, z) } (the cut with its rim wall: x 1293.5..1346.5,
//                   z -68.5..142.5, its floor x 1302..1338, z -60..134)
//   gates           main (1440, 95) and service (1440, 235): { x, z, y, yaw, s, road, outside (7 m out of the wall,
//                   the citadel's own gates.*.outside, where the routes stop), stop (16 m out), far (45 m out),
//                   inside (5 m in: drivable only once the citadel opens its gate) }
//   blasts          [{ x, y, z, s, road, route, side, kind: 'drum'|'shed'|'wreck'|'tank', size }] things 12 m off the
//                   road (2 on the link, 6 on the hills road, 4 on the service road): something stands there and
//                   collides; route is 'link' | 'common' | 'main' | 'service'
//   sideRoads       [{ name, road, x, z, y, yaw (the start pose: a car waits there behind the hill), onto, route, s
//                   (where it joins), side, path }] path: from the start down the track and on along the route
//   barricades      [{ name, road, route, s, x, z, y, yaw, gap: [o0, o1] (the open lane, metres right of the
//                   centreline), width, up, group, before (pose 45 m before), raise(), lower() }] down after the build
//   dodge           the marked stretch on the hills road between the side tracks: { road, route, s0, s1, length,
//                   start, end, lanes, right, left (point lists on each lane) }
//   checkpoints     [{ name, road, route, x, z, y, yaw, s }] link, iron, hills, fork, service, bend: car poses on the lane
//   rollover        the shallow bank beside the service road 292 m out of the service gate where the armoured car
//                   ends on its side: { x, z, y, yaw (the car's heading as it lies), s, side, lean, road (the pose on
//                   the road beside it), out (where Nehorai gets out, facing the citadel), gather [8 spots on the
//                   verge facing the citadel], citadel (the yaw toward it) }
//   hills           the mounds [{ x, z, r, blend, y }]
//   routeAt(x, z)   { route, road, s } or null; pathFrom(route, x, z) the route's points from the nearest on;
//   remaining(route, x, z) metres to its end; reset() the bridge whole, the barricades down, the truck back
//   lamps, emissives, group, tick(camera, dt) (the stumps' flames)
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Road } from './roads.js';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { signAtlas } from './textures.js';
import { smoothstep, rng } from '../core/math.js';

// the link after it leaves the death road, before it slips onto the iron road
const LINK = [[687, -173.6], [694, -168], [701, -160], [713, -151.5], [740, -137], [775, -121], [806, -107]];
const JOIN = { x: 862, z: -56 };       // where the link meets the iron road (just past its barricade)
// the hills road after the iron road's end, to the bridge's west end
const HILLS = [[1030, -21], [1070, -15], [1110, -7], [1150, 1], [1192, 10.5], [1230, 20], [1250, 26.5], [1266, 37], [1278, 46], [1286, 49.6]];
const FORK = { x: 1230, z: 20 };
const SERVICE = [[1241, 28], [1249, 41], [1255, 60], [1261, 88], [1268, 116], [1277, 140], [1290, 158], [1310, 170], [1335, 178], [1362, 193], [1390, 215], [1414, 229], [1432, 234.5], [1446, 235]];
const EAST = [[1356, 50], [1370, 52.5], [1386, 62], [1402, 78], [1416, 90], [1428, 94.5], [1446, 95]]; // after the bridge's east end
const GATES = { main: { x: 1440, z: 95 }, service: { x: 1440, z: 235 } }; // in the citadel's west wall
const CITADEL = { x: 1610, z: 155 };   // its yard's height is the land's at its centre (as every site's)
const BR = { x: 1320, z: 50, x0: 1292, x1: 1348, gap0: 1308, gap1: 1332, half: 5.5 }; // the deck runs east–west; gap0..gap1 is the span that goes
const RAVINE = { x: 1320, z: 37, hx: 18, hz: 97, depth: 16, blend: 8 }; // x 1302..1338, z -60..134
const RIM = { x0: RAVINE.x - RAVINE.hx - RAVINE.blend - 0.5, x1: RAVINE.x + RAVINE.hx + RAVINE.blend + 0.5, z0: RAVINE.z - RAVINE.hz - RAVINE.blend - 0.5, z1: RAVINE.z + RAVINE.hz + RAVINE.blend + 0.5 };
const LANE = 2;                         // the right-hand lane (metres right of the centreline)
const OUT = 7;                          // the gates' outside: metres out of the citadel's west wall (x 1433)
// low hills either side of the hills road and round the service road: [x, z, height, top radius, foot]
const MOUNDS = [
  [1030, -76, 10, 5, 36], [1128, -70, 13, 6, 34], [1182, -50, 9, 5, 30], [1236, -42, 12, 6, 36], [1270, -8, 7, 4, 24], [1150, -125, 16, 8, 48],
  [1062, -60, 10, 5, 30], [1092, -52, 8, 4, 24], [1165, -40, 9, 5, 26], [1205, -32, 9, 5, 24],
  [1100, 60, 10, 5, 36], [1205, 75, 11, 6, 34], [1182, 120, 10, 5, 30],
  [1112, 36, 8, 4, 22], [1145, 92, 11, 6, 30],
  [1392, 22, 11, 5, 29], [1388, 135, 10, 6, 32], [1338, 238, 9, 5, 28], [1298, 212, 9, 5, 26],
];
// the other sites of chapter ten, laid out after this: no hill reaches into them
const OTHERS = [{ x0: 1150, x1: 1262, z0: 180, z1: 276 }, { x0: 1440, x1: 1780, z0: 30, z1: 280 }];

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  const iron = ctx.ironRoad?.main, death = ctx.deathRoad?.roads.main;
  if (!iron || !death) return;
  const opt = { kind: 'highway', sidewalk: 0, curb: 0, spacing: 2, baseHeight, maxGrade: 0.05, width: 8, shoulder: 3 };
  const off = (road, s, o = 0) => { const p = road.at(s); return [p.x + p.nx * o, p.z + p.nz * o]; };
  const gateH = baseHeight(CITADEL.x, CITADEL.z) + 0.03;
  // the link: it starts on the death road just outside the yard's gate and ends inside the iron road
  const d0 = death.at(4), sJ = iron.nearest(JOIN.x, JOIN.z).s;
  const link = net.add(new Road([[d0.x, d0.z], ...LINK, off(iron, sJ - 38, -28), off(iron, sJ - 20, -15.5), off(iron, sJ - 6, -7), off(iron, sJ + 6, -1.8)],
    { ...opt, name: 'דרך בית המסתור', startH: d0.h, endH: iron.at(sJ + 6).h }));
  // the hills road, from the iron road's end to the bridge; the deck takes the height the road arrives at
  const e0 = iron.at(iron.length);
  const hills = net.add(new Road([[e0.x, e0.z], ...HILLS, [BR.x0 + 1.5, BR.z]], { ...opt, name: 'דרך הגבעות', startH: e0.h }));
  const deckY = hills.at(hills.length).h + 0.02;
  const east = net.add(new Road([[BR.x1 - 1.5, BR.z], ...EAST], { ...opt, name: 'הגישה למצודה', startH: deckY - 0.02, endH: gateH }));
  const f = hills.nearest(FORK.x, FORK.z);
  const service = net.add(new Road([[f.qx, f.qz], ...SERVICE], { ...opt, name: 'כביש השירות למצודה', startH: f.h, endH: gateH }));
  // side tracks the rival cars come out of: from behind a hill, curving in to meet the road the way the chase goes
  const spur = { ...opt, width: 6, shoulder: 2, maxGrade: 0.06 };
  const slip = (road, s, side) => [off(road, s - 34, side * 46), off(road, s - 14, side * 22), off(road, s - 4, side * 8), off(road, s + 6, side * 2.2)];
  const sT = { t1: 104, t2: 200, t3: 150 };
  const t1 = net.add(new Road(slip(hills, sT.t1, -1), { ...spur, name: 'שביל הרועים', endH: hills.at(sT.t1 + 6).h }));
  const t2 = net.add(new Road(slip(hills, sT.t2, 1), { ...spur, name: 'שביל הבאר', endH: hills.at(sT.t2 + 6).h }));
  const t3 = net.add(new Road(slip(service, sT.t3, 1), { ...spur, name: 'שביל הוואדי', endH: service.at(sT.t3 + 6).h }));
  places.lastRoads = [link, hills, east, service]; // world.js paves these; the side tracks are earth, drawn here

  // the ravine and the bridge: the deck is three surfaces at the road's height, the middle one can go
  const floorY = deckY - RAVINE.depth;
  net.addPad({ x: RAVINE.x, z: RAVINE.z, hx: RAVINE.hx, hz: RAVINE.hz, yaw: 0, h: floorY - 0.05, top: 0.05, blend: RAVINE.blend, name: 'last ravine' });
  const deck = (x0, x1, name) => net.addPad({ x: (x0 + x1) / 2, z: BR.z, hx: (x1 - x0) / 2, hz: BR.half, yaw: 0, h: deckY - 0.05, top: 0.05, blend: 0, walkOnly: true, name });
  const pads = { west: deck(BR.x0, BR.gap0, 'last bridge west'), mid: deck(BR.gap0, BR.gap1, 'last bridge span'), east: deck(BR.gap1, BR.x1, 'last bridge east') };
  ctx.keepOut?.push({ x: RAVINE.x, z: RAVINE.z, hx: RAVINE.hx + 14, hz: RAVINE.hz + 14 });

  // the bank where the armoured car ends on its side: a shallow hollow beside the service road, about 300 m out of the gate
  const sGate = service.nearest(GATES.service.x, GATES.service.z).s, sRoll = Math.max(26, sGate - 292);
  const rq = service.at(sRoll), roll = { x: rq.x + rq.nx * 9.5, z: rq.z + rq.nz * 9.5, s: sRoll };
  net.addPad({ x: roll.x, z: roll.z, r: 2.6, h: rq.h - 0.75, top: 0, blend: 6, covered: false, name: 'rollover bank' });

  // the hills: mounds of land, each kept clear of every road (a flat verge beside the asphalt), of every paved
  // place already laid out and of the citadel's and the grove's boxes; a hill with no room left is not made
  const mounds = [];
  for (const [x, z, height, r, foot] of MOUNDS) {
    let blend = foot;
    for (const road of net.roads) { const n = road.nearest(x, z); if (n) blend = Math.min(blend, n.d - r - road.halfSurface - 9); }
    for (const p of net.pads) if (!mounds.includes(p)) blend = Math.min(blend, p.sd(x, z) - r - p.blend - 2); // hills may run into each other (a ridge)
    for (const b of OTHERS) blend = Math.min(blend, Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1)) - r - 14);
    if (blend < 12) continue;
    const h = baseHeight(x, z) + height * Math.min(1, blend / foot + 0.15);
    mounds.push(net.addPad({ x, z, r, h, top: 0, blend, covered: false, name: 'hill' }));
  }

  ctx.lastRoad = {
    roads: { link, hills, east, service, t1, t2, t3 }, iron, death, pads, mounds: mounds.map((m) => ({ x: m.x, z: m.z, r: m.r, blend: m.blend, y: m.h })), deckY, floorY, gateH, roll,
    s: { join: sJ, fork: f.s, gateService: sGate, gateMain: east.nearest(GATES.main.x, GATES.main.z).s, ...sT },
    // the citadel reads these to put its gates at the roads' height
    gates: { main: { ...GATES.main, y: gateH }, service: { ...GATES.service, y: gateH } },
  };
}

export function build(ctx) {
  const { places, M, cols, group, batch, terrain, net } = ctx;
  const D = ctx.lastRoad;
  if (!D) return;
  const { link, hills, east, service, t1, t2, t3 } = D.roads, { iron, deckY, floorY } = D, S = D.s;
  const G = new THREE.Group(); G.name = 'last road'; group.add(G);
  const yawAt = (p) => Math.atan2(p.tx, p.tz);
  const off = (road, s, o = 0) => { const p = road.at(s); return { x: p.x + p.nx * o, z: p.z + p.nz * o, y: p.h, h: p.h, yaw: yawAt(p), p }; };
  const pose = (road, s, o = LANE) => { const q = off(road, s, o); return { x: q.x, z: q.z, y: q.h, yaw: q.yaw, s }; };
  const ground = (x, z) => net.surface(x, z) ?? terrain.heightAt(x, z);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);
  const put = (key, mat, geo, x, y, z, yaw = 0, color = '#ffffff', { pitch = 0, roll = 0, scale = 0.3, into = batch } = {}) =>
    into.add(key, mat, geo, mat4(x, y, z, yaw, 1, 1, 1, pitch, roll), { color: tint(color), uv: key === 'paint' ? 'keep' : 'world', uvScale: scale });
  const lamps = [], emissives = [];
  const bulb = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0, roughness: 0.4 }); bulb.userData.night = 1.6; emissives.push(bulb);
  const own = new Batch();
  const CONCRETE = '#c3bdb0', RUST = '#8a4b2e', EARTH = '#9a7650';

  // ---------- the side tracks: earth ----------
  for (const t of [t1, t2, t3]) {
    batch.add('ground', M.ground, t.ribbon(-3, 3, 0.05, 1 / 6), null, { color: tint(EARTH) });
    for (const sd of [1, -1]) batch.add('ground', M.ground, t.ribbon(sd * 3, sd * 4.2, 0.02, 1 / 6), null, { color: tint('#b39b72') });
  }

  // ---------- the lanes: the routes thread the barricades' gaps whether they are up or not ----------
  const sB = { b1: 72, b2: 220, b3: 212 };
  const hillsLane = laneFn(LANE, [{ s: sB.b1, half: 8, ease: 18, lane: 0 }]);
  const serviceLane = laneFn(LANE, [{ s: sB.b3, half: 8, ease: 18, lane: 0 }]);
  const serviceBack = laneFn(-LANE, [{ s: sB.b3, half: 8, ease: 18, lane: 0 }]); // out of the citadel, the other way

  // ---------- barricades: jersey blocks across a road with a gap, hidden until a mission raises them ----------
  const barricade = (name, key, road, route, s, gap) => {
    const g = new THREE.Group(); g.name = `last road barricade ${name}`; g.visible = false; G.add(g);
    const bb = new Batch(), segs = [];
    const run = (o0, o1) => {
      const a = off(road, s, o0), b = off(road, s, o1), len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z), y = Math.max(a.h, b.h);
      put('stone', M.stone, box(0.6, 1.0, len), (a.x + b.x) / 2, y + 0.5, (a.z + b.z) / 2, yaw, CONCRETE, { into: bb });
      for (let t = 0.5; t < len; t += 2) put('paint', M.paint, box(0.62, 0.18, 1.0), a.x + (b.x - a.x) * t / len, y + 0.85, a.z + (b.z - a.z) * t / len, yaw, Math.round(t) % 4 < 2 ? '#d8352a' : '#f2efe6', { into: bb });
      segs.push([a.x, a.z, b.x, b.z, 0.6, Math.min(a.h, b.h) - 1, y + 1.2]);
    };
    run(-7.6, gap[0]); run(gap[1], 7.6);
    for (const o of gap) { const q = off(road, s - 1.3, o + Math.sign(o - (gap[0] + gap[1]) / 2) * 0.5); put('paint', M.paint, box(0.25, 1.6, 0.25), q.x, q.h + 0.8, q.z, 0, '#ff7a2e', { into: bb }); }
    bb.build(g, { cast: false, receive: false });
    const q = off(road, s, (gap[0] + gap[1]) / 2);
    let bodies = null;
    const b = {
      name, road: key, route, s, x: q.x, z: q.z, y: q.h, yaw: q.yaw, gap, width: gap[1] - gap[0], up: false, group: g,
      before: pose(road, s - 45, LANE),
      raise() { if (!bodies) { bodies = segs.map((sg) => cols.addSegment(...sg)); g.visible = true; b.up = true; } return b; },
      lower() { if (bodies) { for (const it of bodies) cols.remove(it); bodies = null; } g.visible = false; b.up = false; return b; },
    };
    return b;
  };
  const barricades = [
    barricade('hills 1', 'hills', hills, 'common', sB.b1, [-2.5, 2.5]),
    barricade('hills 2', 'hills', hills, 'common', sB.b2, [-0.5, 4.5]),
    barricade('service', 'service', service, 'service', sB.b3, [-2.5, 2.5]),
  ];

  // ---------- roadside things that go up as the cars pass (a mission sets them off, after a warning) ----------
  const blasts = [];
  const thing = (key, road, route, s, o, kind) => {
    const q = off(road, s, o);
    if (kind === 'drum') { for (let k = 0; k < 3; k++) put('paint', M.paint, cyl(0.35, 0.35, 1.0), q.x + (k - 1) * 0.8, q.h + 0.5, q.z + (k % 2) * 0.6, 0, '#c8352d'); cols.addCircle(q.x, q.z + 0.3, 1.25, q.h - 1, q.h + 1); }
    else if (kind === 'shed') { put('plaster', M.plaster, box(4, 2.6, 3), q.x, q.h + 1.3, q.z, q.yaw, '#7d6b52'); put('metal', M.metal, box(4.4, 0.15, 3.4), q.x, q.h + 2.7, q.z, q.yaw, RUST); cols.addBox(q.x, q.z, 2.0, 1.5, q.yaw, q.h - 1, q.h + 2.7); }
    else if (kind === 'tank') { put('paint', M.paint, cyl(1.0, 1.0, 4.4, 14), q.x, q.h + 1.5, q.z, q.yaw + Math.PI / 2, '#d9d4c7', { roll: Math.PI / 2 }); for (const a of [-1.4, 1.4]) put('paint', M.paint, box(1.6, 0.6, 0.3), q.x + Math.sin(q.yaw) * a, q.h + 0.3, q.z + Math.cos(q.yaw) * a, q.yaw, '#4a4d52'); cols.addBox(q.x, q.z, 2.3, 1.05, q.yaw + Math.PI / 2, q.h - 1, q.h + 2.5); }
    else { put('metal', M.metal, box(1.8, 1.0, 4), q.x, q.h + 0.6, q.z, q.yaw + 0.5, RUST); put('metal', M.metal, box(1.6, 0.6, 2), q.x, q.h + 1.3, q.z, q.yaw + 0.5, RUST); cols.addBox(q.x, q.z, 0.95, 2.05, q.yaw + 0.5, q.h - 1, q.h + 1.6); }
    blasts.push({ x: q.x, y: q.h, z: q.z, s, road: key, route, side: Math.sign(o), kind, size: kind === 'drum' ? 1.6 : kind === 'tank' ? 2.4 : kind === 'shed' ? 2.2 : 1.9 });
  };
  for (const [s, o, kind] of [[85, 12, 'drum'], [150, -12, 'wreck']]) thing('link', link, 'link', s, o, kind);
  for (const [s, o, kind] of [[30, -12, 'drum'], [52, 12, 'shed'], [128, -12, 'wreck'], [150, 12, 'drum'], [178, -12, 'tank']]) thing('hills', hills, 'common', s, o, kind);
  thing('hills', hills, 'main', S.fork + 28, -12, 'drum');
  for (const [s, o, kind] of [[62, -12, 'drum'], [100, 12, 'shed'], [240, -12, 'wreck'], [282, 12, 'drum']]) thing('service', service, 'service', s, o, kind);

  // ---------- the stretch for dodging: the straight between the two side tracks, posts along both edges ----------
  const dodge = (() => {
    const s0 = S.t1 + 12, s1 = S.t2 - 12;
    for (let s = s0; s <= s1 + 0.01; s += 9) for (const o of [-5.4, 5.4]) {
      const q = off(hills, s, o);
      put('paint', M.paint, box(0.12, 1.0, 0.12), q.x, q.h + 0.5, q.z, q.yaw, '#f2efe6');
      put('paint', M.paint, box(0.13, 0.2, 0.13), q.x, q.h + 0.8, q.z, q.yaw, '#ff7a2e');
    }
    return { road: 'hills', route: 'common', s0, s1, length: s1 - s0, lanes: { right: LANE, left: -LANE }, start: pose(hills, s0), end: pose(hills, s1),
      right: lanePath(hills, s0, s1, LANE), left: lanePath(hills, s0, s1, -LANE) };
  })();

  // ---------- the ravine: a low wall of field stones along its rim (the bridge's ends are the only openings) ----------
  const rim = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 8)), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let k = 0; k < n; k++) {
      const ax = x0 + (x1 - x0) * k / n, az = z0 + (z1 - z0) * k / n, bx = x0 + (x1 - x0) * (k + 1) / n, bz = z0 + (z1 - z0) * (k + 1) / n;
      const y = Math.min(terrain.heightAt(ax, az), terrain.heightAt(bx, bz), terrain.heightAt((ax + bx) / 2, (az + bz) / 2));
      put('stone', M.stone, box(0.55, 1.3, len / n + 0.1), (ax + bx) / 2, y + 0.3, (az + bz) / 2, yaw, k % 2 ? '#a69d8b' : '#b0a794', { scale: 0.45 });
    }
    cols.addSegment(x0, z0, x1, z1, 0.55, deckY - 6, deckY + 1.6);
  };
  const zA = BR.z - BR.half, zB = BR.z + BR.half;
  for (const x of [RIM.x0, RIM.x1]) { rim(x, RIM.z0, x, zA); rim(x, zB, x, RIM.z1); }
  rim(RIM.x0, RIM.z0, RIM.x1, RIM.z0); rim(RIM.x0, RIM.z1, RIM.x1, RIM.z1);
  for (const [dx, dz, s] of [[-7, -60, 2.2], [5, -22, 1.7], [-9, 14, 2.6], [8, 30, 1.6], [-4, 88, 2.0], [9, 116, 2.4]]) put('stone', M.stone, new THREE.DodecahedronGeometry(s, 0), RAVINE.x + dx, floorY + s * 0.35, RAVINE.z + dz, dx, '#8f887b'); // rocks on its floor

  // ---------- the bridge: two fixed stumps, the middle span of its own ----------
  const deckTop = deckY - 0.01, DARK = '#5f5d58';
  const slab = (x0, x1, into) => {
    const cx = (x0 + x1) / 2, len = x1 - x0;
    put('stone', M.stone, box(len, 1.0, BR.half * 2), cx, deckTop - 0.56, BR.z, 0, CONCRETE, { into, scale: 0.35 });
    put('asphalt', M.asphalt, box(len, 0.06, BR.half * 2 - 1.0), cx, deckTop - 0.03, BR.z, 0, DARK, { into, scale: 0.14 });
    for (const sz of [-1, 1]) {
      put('stone', M.stone, box(len, 1.0, 0.4), cx, deckTop + 0.5, BR.z + sz * (BR.half - 0.2), 0, CONCRETE, { into, scale: 0.35 });
      put('paint', M.paint, box(len, 0.012, 0.12), cx, deckTop + 0.012, BR.z + sz * 3.75, 0, '#ecebe5', { into });
    }
    for (let x = x0 + 2; x < x1 - 2; x += 9) put('paint', M.paint, box(3, 0.012, 0.14), x + 1.5, deckTop + 0.012, BR.z, 0, '#ecebe5', { into });
  };
  const rails = (x0, x1) => [-1, 1].map((sz) => cols.addSegment(x0, BR.z + sz * (BR.half - 0.2), x1, BR.z + sz * (BR.half - 0.2), 0.4, deckY - 1, deckY + 1.1));
  slab(BR.x0, BR.gap0, batch); slab(BR.gap1, BR.x1, batch);
  rails(BR.x0, BR.gap0); rails(BR.gap1, BR.x1);
  for (const [x, w] of [[BR.gap0 - 2.5, 3.4], [BR.gap1 + 2.5, 3.4]]) put('stone', M.stone, box(w, RAVINE.depth, BR.half * 2 - 1.6), x, deckTop - 1.0 - RAVINE.depth / 2, BR.z, 0, '#b3ad9f', { scale: 0.35 }); // the piers
  for (const x of [BR.x0 + 5, BR.x1 - 5]) put('stone', M.stone, box(10, 10, BR.half * 2 + 0.6), x, deckTop - 1.0 - 5, BR.z, 0, '#b3ad9f', { scale: 0.35 });                                       // the abutments
  for (const [x, sz] of [[BR.x0 + 3, -1], [BR.gap0 - 4, 1], [BR.gap1 + 4, -1], [BR.x1 - 3, 1]]) {
    const z = BR.z + sz * (BR.half - 0.2);
    put('paint', M.paint, cyl(0.07, 0.09, 5.2, 8), x, deckTop + 3.6, z, 0, '#3a3d44');
    own.add('bulb', bulb, new THREE.SphereGeometry(0.22, 8, 6), mat4(x, deckTop + 6.3, z));
    lamps.push({ x, y: deckTop + 6.2, z, inside: false, range: 24, intensity: 42 });
  }
  const spanGroup = new THREE.Group(); spanGroup.name = 'last bridge span'; G.add(spanGroup);
  { const sb = new Batch(); slab(BR.gap0, BR.gap1, sb);
    for (const sz of [-3.2, 3.2]) put('stone', M.stone, box(BR.gap1 - BR.gap0, 1.3, 0.9), BR.x, deckTop - 1.7, BR.z + sz, 0, '#a8a294', { into: sb, scale: 0.35 }); // the girders
    sb.build(spanGroup, { cast: false, receive: true }); }
  let spanRails = rails(BR.gap0, BR.gap1);
  // what is left when the span has gone: broken ends hanging, rubble across both stumps, the span's pieces on the ravine floor, fire
  const blownGroup = new THREE.Group(); blownGroup.name = 'last bridge blown'; blownGroup.visible = false; G.add(blownGroup);
  const fires = [], flames = [];
  { const wb = new Batch(), r = rng(410), CHAR = '#3b3833';
    for (const [x, dir] of [[BR.gap0, 1], [BR.gap1, -1]]) {
      put('stone', M.stone, box(4.2, 0.9, BR.half * 2 - 1.2), x + dir * 1.5, deckTop - 1.5, BR.z, 0, '#8d877b', { into: wb, roll: -dir * 0.72 });          // the broken end, hanging into the gap
      put('asphalt', M.asphalt, box(3.0, 0.02, BR.half * 2 - 1.0), x - dir * 1.6, deckTop + 0.012, BR.z, 0, CHAR, { into: wb });                           // scorched deck
      for (let k = 0; k < 9; k++) { const s = 0.5 + r() * 0.55, z = BR.z - BR.half + 0.9 + k * (BR.half * 2 - 1.8) / 8; put('stone', M.stone, box(s * 1.5, s, s * 1.3), x - dir * (0.9 + r() * 0.5), deckTop + s / 2 - 0.05, z, r() * 3, k % 3 ? '#7d776c' : CHAR, { into: wb, pitch: (r() - 0.5) * 0.5 }); } // rubble across the end
      for (let k = 0; k < 6; k++) put('metal', M.metal, cyl(0.04, 0.04, 1.8, 5), x + dir * 0.5, deckTop - 0.3 - r() * 0.5, BR.z - 4 + k * 1.6, 0, '#5a3a2a', { into: wb, roll: dir * (1.0 + r() * 0.5), pitch: (r() - 0.5) * 0.6 }); // bent rods
      for (const dz of [-2.6, 2.4]) fires.push({ x: x - dir * 1.1, y: deckTop + 0.5, z: BR.z + dz });
    }
    for (const [dx, dz, yaw, roll] of [[-6, -1.5, 0.3, 0.25], [3, 2, -0.5, -0.4], [9, -2.5, 1.2, 0.15]]) put('stone', M.stone, box(7, 1.0, 9), BR.x + dx, floorY + 1.0, BR.z + dz, yaw, '#8d877b', { into: wb, roll });   // the span, in pieces below
    wb.build(blownGroup, { cast: false, receive: true });
    const flameMat = new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (const side of [0, 1]) {
      const parts = fires.slice(side * 2, side * 2 + 2).flatMap((f, k) => [[0, 0, 1.0], [0.5, 0.4, 0.7], [-0.45, -0.5, 0.8]].map(([dx, dz, s]) => new THREE.ConeGeometry(0.55 * s, 2.0 * s, 6).translate(dx + k * 0.1, s, dz)).map((g) => g.translate(f.x, 0, f.z)));
      const geo = mergeGeometries(parts); for (const g of parts) g.dispose();
      geo.translate(-fires[side * 2].x, 0, -BR.z);
      const m = new THREE.Mesh(geo, flameMat); m.position.set(fires[side * 2].x, deckTop + 0.2, BR.z); m.renderOrder = 2; blownGroup.add(m); flames.push(m);
    }
  }
  const P3 = (x, z, yaw) => ({ x, z, y: deckY, yaw });
  let stumps = null, tFire = 0;
  const bridge = {
    x: BR.x, z: BR.z, y: deckY, yaw: Math.PI / 2, x0: BR.x0, x1: BR.x1, width: BR.half * 2 - 1.0, length: BR.x1 - BR.x0, gap: { x0: BR.gap0, x1: BR.gap1 }, floorY,
    west: pose(hills, hills.length - 16), east: pose(east, 14), westDeck: P3(BR.x0 + 6, BR.z + LANE, Math.PI / 2), eastDeck: P3(BR.x1 - 6, BR.z + LANE, Math.PI / 2),
    edge: { west: P3(BR.gap0 - 3.4, BR.z, Math.PI / 2), east: P3(BR.gap1 + 3.4, BR.z, -Math.PI / 2) },
    mid: P3(BR.x, BR.z, Math.PI / 2), fires, burns: [], blown: false, span: spanGroup, wreck: blownGroup,
    onDeck: (x, z) => Math.abs(z - BR.z) < BR.half && x > BR.x0 && x < BR.x1,
    overGap: (x, z) => Math.abs(z - BR.z) < BR.half && x > BR.gap0 && x < BR.gap1,
    // the middle span goes: its meshes, its parapets and its surface; rubble burns on both stumps and stops
    // whoever comes (a car is stopped, it does not fall). With `fx` (game.fx) the blast and the flames are the
    // game's own as well; the warning before it is the mission's
    blow({ fx = null, boom = true } = {}) {
      if (!bridge.blown) {
        bridge.blown = true;
        net.removePad(D.pads.mid);
        if (spanRails) for (const b of spanRails) cols.remove(b);
        spanRails = null;
        stumps = [BR.gap0 - 1.1, BR.gap1 + 1.1].map((x) => cols.addSegment(x, BR.z - BR.half, x, BR.z + BR.half, 1.3, deckY - 1, deckY + 1.2));
        spanGroup.visible = false; blownGroup.visible = true;
      }
      if (fx) {
        if (boom) fx.explode(BR.x, deckY + 0.5, BR.z, { size: 3.4, flash: true });
        for (const b of bridge.burns) b.stop?.();
        bridge.burns = fires.map((f) => fx.burn(f.x, f.y, f.z, { r: 1.2, strength: 1.3, seconds: 900 }));
      }
      return bridge;
    },
    restore() {
      for (const b of bridge.burns) b.stop?.();
      bridge.burns = [];
      if (!bridge.blown) return bridge;
      bridge.blown = false;
      net.restorePad(D.pads.mid);
      if (stumps) for (const b of stumps) cols.remove(b);
      stumps = null;
      if (!spanRails) spanRails = rails(BR.gap0, BR.gap1);
      spanGroup.visible = true; blownGroup.visible = false;
      return bridge;
    },
  };

  // ---------- Kotzi's truck across the iron road (chapter eight's, built by ironroad.js): found here by where
  // it stands, so that this chapter can take it and its two lines of barriers off the road and put them back ----------
  const truck = (() => {
    const I = places.ironRoad, b = I?.blocked;
    const t = { x: b?.x ?? null, z: b?.z ?? null, found: false, cleared: false, clear() { return t; }, restore() { return t; } };
    if (!b || !I.group) return t;
    const d = (x, z) => Math.hypot(x - b.x, z - b.z);
    const meshes = I.group.children.filter((o) => o.isMesh && (d(o.position.x, o.position.z) < 8.6 || (o.geometry?.parameters?.depth > 30 && d(o.position.x, o.position.z) < 30)));
    let bodies = [...cols.gather(b.x, b.z, 34)].filter((it) => !it.owner && !it.circle && d(it.cx, it.cz) < 30
      && ((Math.abs(it.hx - 7.6) < 0.01 && Math.abs(it.hz - 1.5) < 0.01) || (Math.abs(it.hz - 0.3) < 0.01 && it.hx > 15 && it.hx < 19)));
    const saved = bodies.map((it) => [it.cx, it.cz, it.hx, it.hz, Math.atan2(it.s, it.c), it.y0, it.y1]);
    t.found = meshes.length >= 6 && bodies.length === 3;
    t.clear = () => { if (!t.cleared) { for (const m of meshes) m.visible = false; for (const it of bodies) cols.remove(it); bodies = []; t.cleared = true; } return t; };
    t.restore = () => { if (t.cleared) { for (const m of meshes) m.visible = true; bodies = saved.map((a) => cols.addBox(...a)); t.cleared = false; } return t; };
    return t;
  })();

  // ---------- signs: the link's start, the fork, the bridge ----------
  const atlas = signAtlas('last road signs', [{ text: 'כביש הברזל →', bg: '#1d4f91' }, { text: 'המצודה ↑', bg: '#2b2f36' }, { text: 'כביש השירות →', bg: '#6b4a2b' }, { text: 'גשר הגבעות', bg: '#1d4f91' }], { cellW: 512, cellH: 128, cols: 4, size: 56 });
  const plates = [];
  const plate = (i, x, y, z, yaw, w = 2.8, h = 0.7) => { const g = new THREE.PlaneGeometry(w, h), [u0, v0, u1, v1] = atlas.uv[i]; g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v1, u1, v1, u0, v0, u1, v0], 2)); g.applyMatrix4(mat4(x, y, z, yaw)); plates.push(g); };
  const post = (road, s, o, list) => {
    const q = off(road, s, o);
    put('paint', M.paint, cyl(0.06, 0.06, 2.2 + list.length * 0.8, 6), q.x, q.h + 1.1 + list.length * 0.4, q.z, 0, '#5d6066');
    cols.addCircle(q.x, q.z, 0.12, q.h - 1, q.h + 3);
    list.forEach((i, k) => plate(i, q.x - q.p.tx * 0.08, q.h + 2.0 + k * 0.8, q.z - q.p.tz * 0.08, q.yaw + Math.PI));
  };
  post(link, 34, 6.6, [0]); post(hills, S.fork - 42, 6.6, [2, 1]); post(hills, hills.length - 22, 6.6, [3]);
  const signMesh = new THREE.Mesh(mergeGeometries(plates), new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.7 }));
  for (const g of plates) g.dispose();
  signMesh.name = 'last road signs'; G.add(signMesh);
  own.build(G, { bulb: { cast: false, receive: false } });

  // ---------- a few trees and bushes on the hills (none by the road) ----------
  { const r = rng(1048);
    for (const m of D.mounds) for (let k = 0; k < 4; k++) {
      const a = r() * Math.PI * 2, d = m.r * 0.4 + r() * (m.r + m.blend * 0.45), x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d, kind = k === 3 ? 'bush' : r() < 0.6 ? 'pine' : 'olive';
      const y = terrain.heightAt(x, z);
      ctx.veg.push({ kind, x, y: y - 0.2, z, s: 0.85 + r() * 0.4 });
      if (kind !== 'bush') cols.addCircle(x, z, 0.35, y - 1, y + 3);
    } }

  // ---------- where rival cars come from: each side track with a spot to wait and a way onto the route ----------
  const sideRoads = [];
  const side = (name, road, onto, ontoKey, route, sJoin, path) => {
    const a = off(road, 4.5, 1.5), b = off(road, 6.5, 1.5);
    sideRoads.push({ name, road: road.name, x: a.x, z: a.z, y: a.h, yaw: Math.atan2(b.x - a.x, b.z - a.z), onto: ontoKey, route, s: sJoin, side: Math.sign(off(onto, sJoin, 1).x * 0 + ((a.x - onto.at(sJoin - 34).x) * onto.at(sJoin - 34).nx + (a.z - onto.at(sJoin - 34).z) * onto.at(sJoin - 34).nz)), path });
  };
  const spurPath = (road) => lanePath(road, 4.5, road.length - 2, 1.5);
  side('t1', t1, hills, 'hills', 'common', S.t1 + 6, chain(spurPath(t1), lanePath(hills, S.t1 + 10, S.fork - 6, hillsLane)));
  side('t2', t2, hills, 'hills', 'common', S.t2 + 6, chain(spurPath(t2), lanePath(hills, S.t2 + 10, S.fork - 6, hillsLane), lanePath(service, 5, service.length - 6, serviceLane)));
  side('t3', t3, service, 'service', 'service', S.t3 + 6, chain(spurPath(t3), lanePath(service, S.t3 + 10, service.length - 6, serviceLane)));

  // ---------- the routes, in order, for the autopilot and for rivals ----------
  // the routes stop at the gates' outside (the citadel's own `gates.*.outside`, 7 m out of the wall: its gates
  // are shut until a mission opens them); the escape starts where the armoured car's way out of the
  // citadel ends (16 m out of the service gate) and goes back along the service road to the rollover bank
  const sEnd = { main: S.gateMain - OUT, service: S.gateService - OUT, escape: S.gateService - 16 };
  const deckLine = [{ x: BR.x0 + 3, z: BR.z + LANE }, { x: BR.x1 - 3, z: BR.z + LANE }];
  const routes = {
    link: chain(lanePath(link, 3, link.length - 1.5, LANE), lanePath(iron, S.join + 12, S.join + 26, LANE)),
    iron: lanePath(iron, S.join + 26, iron.length - 1, LANE),
    main: chain(lanePath(hills, 1, hills.length - 1, hillsLane), deckLine, lanePath(east, 1, sEnd.main, LANE)),
    service: chain(lanePath(hills, 1, S.fork - 5, hillsLane), lanePath(service, 5, sEnd.service, serviceLane)),
    escape: lanePath(service, sEnd.escape, D.roll.s, serviceBack),
  };
  routes.direct = chain(routes.link, routes.iron, routes.main);    // the whole way over the bridge to the main gate
  routes.convoy = chain(routes.link, routes.iron, routes.service); // the whole way by the service road to the service gate
  const cum = Object.fromEntries(Object.entries(routes).map(([k, pts]) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z)); return [k, c]; }));
  const nearestIndex = (pts, x, z) => { let best = 0, bd = Infinity; for (let i = 0; i < pts.length; i++) { const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } } return { i: best, d: Math.sqrt(bd) }; };
  const keyOf = { [link.name]: 'link', [iron.name]: 'iron', [hills.name]: 'hills', [east.name]: 'east', [service.name]: 'service' };

  // ---------- the bank where the armoured car ends on its side, and where everyone stands after ----------
  const rollover = (() => {
    const q = off(service, D.roll.s, 0), y = terrain.heightAt(D.roll.x, D.roll.z), away = q.yaw + Math.PI; // `away`: the way a car out of the citadel is heading
    const at = (o, a, yaw) => { const x = q.x + q.p.nx * o + q.p.tx * a, z = q.z + q.p.nz * o + q.p.tz * a; return { x, z, y: ground(x, z), yaw }; };
    const toCitadel = (p) => Math.atan2(CITADEL.x - p.x, CITADEL.z - p.z);
    const gather = [-4.2, -2.8, -1.4, 0, 1.4, 2.8, 4.2, 5.6].map((a) => { const p = at(4.6, a + 2, 0); return { ...p, yaw: toCitadel(p) }; }); // a row on the verge, looking back at the citadel
    const out = at(7.2, 1.2, 0);
    return { x: D.roll.x, z: D.roll.z, y, yaw: away + 0.5, s: D.roll.s, side: 1, lean: 1, road: { x: q.x, z: q.z, y: q.h, yaw: away, s: D.roll.s }, out: { ...out, yaw: toCitadel(out) }, gather, citadel: toCitadel(D.roll) };
  })();

  const gate = (road, key, sG, g) => { const q = off(road, sG, 0); return { x: g.x, z: g.z, y: q.h, yaw: Math.PI / 2, s: sG, road: key, outside: pose(road, sG - OUT), stop: pose(road, sG - 16), far: pose(road, sG - 45), inside: pose(road, Math.min(road.length, sG + 5)) }; };
  const cp = (name, key, road, route, s, lane = LANE) => ({ name, road: key, route, ...pose(road, s, typeof lane === 'function' ? lane(s) : lane) });
  places.lastRoad = {
    roads: { ...D.roads, iron }, routes, lengths: Object.fromEntries(Object.entries(cum).map(([k, c]) => [k, c[c.length - 1]])), lanes: { right: LANE, left: -LANE },
    start: pose(link, 6), join: { ...pose(iron, S.join + 6, 0), linkS: link.length }, ironEnd: pose(iron, iron.length - 1, 0),
    fork: { ...pose(hills, S.fork, 0), before: pose(hills, S.fork - 40), choices: [
      { route: 'main', label: 'המצודה', side: 0, at: pose(hills, S.fork + 26) },
      { route: 'service', label: 'כביש השירות', side: 1, at: pose(service, 26) } ] },
    bridge, ravine: { x0: RIM.x0, x1: RIM.x1, z0: RIM.z0, z1: RIM.z1, floorY, rimY: deckY, contains: (x, z) => x > RIM.x0 && x < RIM.x1 && z > RIM.z0 && z < RIM.z1 },
    gates: { main: gate(east, 'east', S.gateMain, GATES.main), service: gate(service, 'service', S.gateService, GATES.service) },
    truck, barricades, blasts, sideRoads, dodge, rollover, hills: D.mounds,
    checkpoints: [
      cp('link', 'link', link, 'link', 40), cp('iron', 'iron', iron, 'iron', S.join + 40), cp('hills', 'hills', hills, 'common', 12, hillsLane),
      cp('fork', 'hills', hills, 'common', S.t2 - 14, hillsLane), cp('service', 'service', service, 'service', 16, serviceLane), cp('bend', 'service', service, 'service', S.t3 + 22, serviceLane),
    ],
    // which way a point is on: 'link', 'iron', 'common' (the hills road before the fork), 'main' (after it, the
    // bridge and the way to the main gate) or 'service'; null off these roads
    routeAt(x, z) {
      if (bridge.onDeck(x, z)) return { route: 'main', road: 'bridge', s: x - BR.x0 };
      let u = net.under(x, z);
      if (!u || !(u.road.name in keyOf)) u = net.nearest(x, z, 12, (r) => r.name in keyOf);
      if (!u) return null;
      const road = keyOf[u.road.name];
      return { route: road === 'hills' ? (u.s < S.fork ? 'common' : 'main') : road === 'east' ? 'main' : road, road, s: u.s };
    },
    // a route's points from the one nearest (x, z) on (for a rival that joins it, or a friend's car)
    pathFrom(route, x, z) { const pts = routes[route]; return pts.slice(nearestIndex(pts, x, z).i); },
    // metres left along a route from (x, z) to its end
    remaining(route, x, z) { const pts = routes[route], c = cum[route], n = nearestIndex(pts, x, z); return c[c.length - 1] - c[n.i] + n.d; },
    // everything as it is after the build: the bridge whole, the barricades down, the truck back on the iron road
    reset() { bridge.restore(); for (const b of barricades) b.lower(); truck.restore(); },
    tick(camera, dt) {
      if (!bridge.blown) return;
      const c = camera.position;
      if (Math.abs(c.x - BR.x) > 260 || Math.abs(c.z - BR.z) > 260) return;
      tFire += dt;
      for (let i = 0; i < flames.length; i++) { const m = flames[i], a = tFire * (9 + i * 2.3) + i * 1.7; m.scale.set(1 + 0.08 * Math.sin(a * 1.3), 1 + 0.22 * Math.sin(a) + 0.1 * Math.sin(a * 2.7), 1 + 0.08 * Math.cos(a * 1.1)); m.rotation.y = 0.15 * Math.sin(a * 0.4); }
    },
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
