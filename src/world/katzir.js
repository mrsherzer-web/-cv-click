// Builds the playable street: a fictional, compressed hilltop neighborhood inspired by Katzir.
// One winding street from the entrance gate (east) to a lookout over the coastal plain (west).
// Nothing here reproduces real addresses, houses or exact geography.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, lerp, smoothstep, rng } from '../core/math.js';
import { Terrain } from './terrain.js';
import { Road } from './road.js';
import { CollisionWorld } from './colliders.js';
import { Batch, mat4 } from './batch.js';
import { materials, tint } from './materials.js';
import { addHouse } from './houses.js';
import { buildVegetation } from './vegetation.js';
import { makeHatchback } from './car.js';
import { Tex } from './textures.js';
import * as P from './props.js';

const ROAD_POINTS = [[172, 30], [132, 22], [96, 4], [60, -6], [24, 2], [-12, 18], [-46, 14], [-74, 2], [-94, 0]];
const HOME_S = 54;      // where Nehorai's house sits along the street
const GARDEN_S = 174;
const BUS_S = 125;
const WALLS = ['#f1eee7', '#ece3d0', '#e6d8bf', '#efe0cf', '#e9ecec', '#f2e6d8', '#e8ded6'];

function baseHeight(x, z) {
  let h = 4.0 * Math.sin(x * 0.012 + 0.8) * Math.cos(z * 0.01 - 0.3)
    + 2.2 * Math.sin((x - z) * 0.018 + 1.3)
    + 1.0 * Math.sin(x * 0.045) * Math.sin(z * 0.04);
  const west = smoothstep(-80, -170, x); // the ridge falls toward the coastal plain
  h -= west * west * 48;
  h -= smoothstep(95, 190, Math.abs(z)) * 16;
  h -= smoothstep(150, 200, x) * 6;
  return h;
}

export function buildKatzir(scene, { shadows }) {
  const M = materials();
  const group = new THREE.Group();
  group.name = 'katzir';
  scene.add(group);
  const r = rng(2026);
  const cols = new CollisionWorld();
  const batch = new Batch();
  const veg = [];

  const road = new Road(ROAD_POINTS, { width: 7, sidewalk: 2.2, curb: 0.14, samples: 340, baseHeight });
  const W2 = road.width / 2, SWo = W2 + road.sidewalk, L = road.length;
  const end = road.at(L);
  const plaza = { x: end.x + end.tx * 7, z: end.z + end.tz * 7, h: end.h, r: 12.5, dx: end.tx, dz: end.tz };

  // ---------- terrain shaped around the street and the plaza ----------
  const heightFn = (x, z) => {
    const b = baseHeight(x, z);
    const n = road.nearest(x, z);
    const top = n.h + road.curb;
    let h;
    if (n.d < SWo) h = n.h - 0.25;            // hidden under asphalt and sidewalk
    else if (n.d < SWo + 2.5) h = top;
    else {
      const target = top + clamp(b - top, -3.5, 3.5);
      h = lerp(top, target, smoothstep(SWo + 2.5, 30, n.d));
      if (n.d > 30) h = lerp(target, b, smoothstep(30, 60, n.d));
    }
    const dp = Math.hypot(x - plaza.x, z - plaza.z);
    if (dp < plaza.r + 6) h = lerp(h, dp < plaza.r ? plaza.h - 0.25 : plaza.h + road.curb, smoothstep(plaza.r + 6, plaza.r - 1, dp));
    return h;
  };
  const terrain = new Terrain({ size: CONFIG.world.size, segments: CONFIG.world.segments, heightFn });
  const c = (hex) => new THREE.Color(hex);
  const C = { dry: c('#b9a768'), green: c('#71813f'), lawn: c('#6f8f43'), soil: c('#9b6a47'), rock: c('#a59b89') };
  const colorFn = (x, z, y, slope) => {
    const n = road.nearest(x, z);
    const noise = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(z * 0.07) * 3) * Math.cos(z * 0.09 - x * 0.03);
    let col = C.dry.clone().lerp(C.green, noise * 0.55);
    if (n.d < 28) col.lerp(C.lawn, 0.5 * (1 - smoothstep(18, 28, n.d)));      // watered yards
    col.lerp(C.soil, smoothstep(0.35, 0.8, noise) * 0.25);
    col.lerp(C.rock, smoothstep(0.35, 0.8, slope));
    return [col.r, col.g, col.b];
  };
  const ground = new THREE.Mesh(terrain.buildGeometry(colorFn, 0.22), M.ground);
  ground.receiveShadow = true;
  ground.name = 'terrain';
  group.add(ground);

  // ---------- street, sidewalks, curbs ----------
  batch.add('asphalt', M.asphalt, road.ribbon(-W2, W2, 0.02, 1 / 7), null, {});
  for (const side of [1, -1]) {
    batch.add('pavers', M.pavers, road.ribbon(side * W2, side * SWo, road.curb, 1 / 4), null, {});
    batch.add('stone', M.stone, road.wall(side * SWo, -0.5, road.curb, -1), null, { color: tint('#cfc8ba') });
  }
  const painted = [[0, 32, 1], [0, 32, -1], [BUS_S - 12, BUS_S + 12, -1], [GARDEN_S - 6, GARDEN_S + 6, 1]];
  for (const side of [1, -1]) {
    let s0 = 0;
    const runs = painted.filter((p) => p[2] === side).sort((a, b) => a[0] - b[0]);
    for (const [a, b] of runs) {
      if (a > s0) batch.add('curbGray', M.curbGray, road.wall(side * W2, -0.2, road.curb, 1, s0, a), null, {});
      batch.add('curbPainted', M.curbPainted, road.wall(side * W2, -0.2, road.curb, 1, a, b, 0.5), null, {});
      s0 = b;
    }
    batch.add('curbGray', M.curbGray, road.wall(side * W2, -0.2, road.curb, 1, s0, L), null, {});
  }
  // zebra crossing by the public garden
  {
    const p = road.at(GARDEN_S - 9), yaw = Math.atan2(p.tx, p.tz);
    for (let i = -3; i <= 3; i++) {
      batch.add('paint', M.paint, new THREE.BoxGeometry(0.5, 0.02, 2.6), mat4(p.x + p.nx * i * 0.95, p.h + 0.035, p.z + p.nz * i * 0.95, yaw), { color: tint('#efefe9') });
    }
  }
  P.addSpeedBump(batch, M, road, 95);
  P.addSpeedBump(batch, M, road, 214);

  // ---------- helpers for placing things relative to the street ----------
  const along = (s, side, d) => {
    const p = road.at(s);
    return { x: p.x + p.nx * side * d, z: p.z + p.nz * side * d, h: p.h, tx: p.tx, tz: p.tz, nx: p.nx * side, nz: p.nz * side };
  };
  const yawFacing = (dx, dz) => Math.atan2(dx, dz);
  const yard = (s) => road.at(s).h + road.curb;
  const plate = (text, x, y, z, yaw, w, h, opts) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: Tex.sign(text, opts), roughness: 0.6 }));
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    group.add(m);
    return m;
  };

  // low stone garden wall along a lot frontage, with openings at the given [from, to] arc ranges
  const frontWall = (s0, s1, side, gaps) => {
    const d = SWo + 0.45;
    const pieces = [];
    let a = s0;
    for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) { if (g0 > a) pieces.push([a, g0]); a = Math.max(a, g1); }
    if (a < s1) pieces.push([a, s1]);
    for (const [p0, p1] of pieces) {
      const steps = Math.max(1, Math.ceil((p1 - p0) / 3.5));
      for (let i = 0; i < steps; i++) {
        const sa = p0 + ((p1 - p0) * i) / steps, sb = p0 + ((p1 - p0) * (i + 1)) / steps;
        const A = along(sa, side, d), B = along(sb, side, d);
        const len = Math.hypot(B.x - A.x, B.z - A.z) + 0.02, y = (yard(sa) + yard(sb)) / 2;
        const yaw = Math.atan2(B.x - A.x, B.z - A.z), mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
        batch.add('stone', M.stone, new THREE.BoxGeometry(0.3, 1.4, len), mat4(mx, y + 0.3, mz, yaw), { uv: 'world', uvScale: 0.5 });
        batch.add('stone', M.stone, new THREE.BoxGeometry(0.38, 0.07, len), mat4(mx, y + 1.03, mz, yaw), { color: tint('#efe9dc'), uv: 'world' });
        cols.addSegment(A.x, A.z, B.x, B.z, 0.32, y - 1, y + 1.1);
      }
    }
    for (const [g0, g1] of gaps) for (const gs of [g0, g1]) { // pillars at each opening
      const p = along(gs, side, d);
      batch.add('stone', M.stone, new THREE.BoxGeometry(0.5, 1.8, 0.5), mat4(p.x, yard(gs) + 0.45, p.z, yawFacing(p.tx, p.tz)), { uv: 'world', uvScale: 0.5 });
      cols.addCircle(p.x, p.z, 0.3, yard(gs) - 1, yard(gs) + 1.4);
    }
  };

  // ---------- houses ----------
  let home = null;
  for (let s = 30; s < L - 24; s += 24) {
    for (const side of [1, -1]) {
      const ls = s + (side < 0 ? 11 : 0);
      if (ls > L - 24) continue;
      const isHome = side === 1 && ls === HOME_S;
      if (side === 1 && Math.abs(ls - GARDEN_S) < 6) continue; // the public garden takes this lot
      const w = isHome ? 11 : 9 + r() * 3, d = isHome ? 10 : 9 + r() * 2.5;
      const setback = isHome ? 6.6 : 5.0;
      const P0 = along(ls, side, SWo + setback + d / 2);
      const yaw = yawFacing(-P0.nx, -P0.nz);
      const corners = [];
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const lx = (cx * w) / 2, lz = (cz * d) / 2;
        corners.push(terrain.heightAt(P0.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), P0.z - lx * Math.sin(yaw) + lz * Math.cos(yaw)));
      }
      const y = Math.max(yard(ls) + 0.15, (corners[2] + corners[3]) / 2 + 0.1);
      const floors = isHome ? 2 : r() < 0.7 ? 2 : 1;
      const spec = {
        x: P0.x, y, z: P0.z, yaw, w, d, floors,
        roof: isHome ? 'flat' : r() < 0.28 ? 'tiles' : 'flat',
        wall: isHome ? '#f3efe6' : WALLS[Math.floor(r() * WALLS.length)],
        balcony: floors > 1 && (isHome || r() < 0.55),
        ac: r() < 0.85,
        sink: y - Math.min(...corners) + 0.6,
      };
      const { H } = addHouse(batch, M, spec);
      cols.addBox(P0.x, P0.z, w / 2 + 0.05, d / 2 + 0.05, yaw, y - 3, y + H + 1);
      const gaps = [[ls - 0.75, ls + 0.75]];
      if (isHome) gaps.push([ls + 3.2, ls + 6.6]); // driveway
      else if (r() < 0.4) gaps.push([ls + 5.5, ls + 8.5]);
      frontWall(ls - 11.6, ls + 11.6, side, gaps);
      if (isHome) home = { s: ls, side, house: P0, y, yaw };
      // yard planting
      if (r() < 0.55) { const t = along(ls - 4 - r() * 3, side, SWo + 2.6); veg.push({ kind: 'olive', x: t.x, y: yard(ls), z: t.z, s: 0.85 + r() * 0.3 }); cols.addCircle(t.x, t.z, 0.35, yard(ls) - 1, yard(ls) + 2); }
      if (r() < 0.45) { const t = along(ls + 4 + r() * 4, side, SWo + 1.1); veg.push({ kind: 'bush', x: t.x, y: yard(ls), z: t.z, s: 0.8 + r() * 0.4 }); }
      if (r() < 0.3) for (const off of [-1.4, 1.4]) { const t = along(ls + off, side, SWo + 1.2); veg.push({ kind: 'cypress', x: t.x, y: yard(ls), z: t.z, s: 0.8 + r() * 0.2 }); cols.addCircle(t.x, t.z, 0.4, yard(ls) - 1, yard(ls) + 5); }
      for (let k = 0; k < 2; k++) { const t = along(ls + (r() - 0.5) * 16, side, 22 + r() * 5); const ty = terrain.heightAt(t.x, t.z); veg.push({ kind: 'pine', x: t.x, y: ty, z: t.z, s: 0.85 + r() * 0.35 }); cols.addCircle(t.x, t.z, 0.35, ty - 1, ty + 4); }
      if (r() < 0.45) { const t = along(ls + 2.4, side, SWo - 0.45); P.addBin(batch, M, cols, t.x, yard(ls), t.z, yawFacing(t.tx, t.tz)); }
    }
  }

  // Nehorai's home: name plate by the gate and the white hatchback in the driveway
  const gatePost = along(home.s - 0.75, 1, SWo + 0.17);
  plate('פרחי', gatePost.x, yard(home.s) + 1.25, gatePost.z, yawFacing(-gatePost.nx, -gatePost.nz), 0.5, 0.17, { bg: '#2b2f36', fg: '#f3efe6', w: 384, h: 128, size: 72, border: false });
  const carSpot = along(home.s + 4.9, 1, SWo + 3.5);
  const car = makeHatchback();
  car.position.set(carSpot.x, yard(home.s), carSpot.z);
  car.rotation.y = yawFacing(-carSpot.nx, -carSpot.nz);
  group.add(car);
  cols.addBox(carSpot.x, carSpot.z, car.userData.halfExtents.x, car.userData.halfExtents.z, car.rotation.y, yard(home.s) - 1, yard(home.s) + 1.5);

  // ---------- public garden ----------
  {
    for (let i = 0; i < 4; i++) { const t = along(GARDEN_S - 8 + i * 5.5, 1, SWo + 5 + r() * 9); veg.push({ kind: i % 2 ? 'olive' : 'pine', x: t.x, y: terrain.heightAt(t.x, t.z), z: t.z, s: 0.9 + r() * 0.3 }); cols.addCircle(t.x, t.z, 0.4, -50, 50); }
    for (let i = 0; i < 5; i++) { const t = along(GARDEN_S - 9 + i * 4.5, 1, SWo + 15 + r() * 3); veg.push({ kind: 'bush', x: t.x, y: terrain.heightAt(t.x, t.z), z: t.z, s: 0.9 + r() * 0.5 }); }
    for (const off of [-3, 3]) { const b = along(GARDEN_S + off, 1, SWo + 3); P.addBench(batch, M, cols, b.x, terrain.heightAt(b.x, b.z), b.z, yawFacing(-b.nx, -b.nz)); }
    const sg = along(GARDEN_S - 6.5, 1, SWo - 0.3);
    P.addSign(group, batch, M, cols, sg.x, yard(GARDEN_S), sg.z, yawFacing(sg.tx, sg.tz), 'גן ציבורי', { bg: '#2f6b3c' });
  }

  // ---------- bus stop, signs, lamps ----------
  const bus = along(BUS_S, -1, SWo - 0.95);
  P.addBusStop(group, batch, M, cols, bus.x, yard(BUS_S), bus.z, yawFacing(-bus.nx, -bus.nz));
  for (const [s, side] of [[26, -1], [150, 1]]) {
    const t = along(s, side, SWo - 0.3);
    P.addSign(group, batch, M, cols, t.x, yard(s), t.z, yawFacing(t.tx, t.tz), 'דרך הגבעה');
  }
  for (let s = 18, i = 0; s < L - 4; s += 32, i++) {
    const side = i % 2 ? 1 : -1, t = along(s, side, SWo - 0.35);
    P.addLamp(batch, M, cols, t.x, yard(s), t.z, yawFacing(-t.nx, -t.nz));
  }

  // ---------- entrance: gate, guard booth, welcome sign, palms ----------
  const gateP = road.at(5);
  P.addGate(group, batch, M, cols, gateP.x, gateP.h, gateP.z, yawFacing(gateP.tx, gateP.tz), road.width);
  {
    const wsP = along(17, 1, SWo + 1.6), y = yard(17), yaw = yawFacing(-wsP.nx, -wsP.nz);
    batch.add('stone', M.stone, new THREE.BoxGeometry(4.6, 1.6, 0.7), mat4(wsP.x, y + 0.6, wsP.z, yaw), { uv: 'world', uvScale: 0.5 });
    plate('ברוכים הבאים לקציר', wsP.x - wsP.nx * 0.36, y + 0.95, wsP.z - wsP.nz * 0.36, yaw, 3.8, 0.6, { bg: '#4a3a2c', fg: '#f3e6cc', w: 1024, h: 160, size: 92, border: false });
    cols.addBox(wsP.x, wsP.z, 2.3, 0.4, yaw, y - 1, y + 1.5);
    for (const [s, side] of [[9, 1], [15, -1], [22, -1], [26, 1]]) { const t = along(s, side, SWo + 1.4); veg.push({ kind: 'palm', x: t.x, y: yard(s), z: t.z, s: 0.9 + r() * 0.2 }); cols.addCircle(t.x, t.z, 0.4, -50, 50); }
  }

  // ---------- back fences: the edge of the playable street ----------
  for (const side of [1, -1]) {
    for (let s = 8; s < L - 2; s += 4) {
      const A = along(s, side, 29), B = along(Math.min(L, s + 4), side, 29);
      const ya = terrain.heightAt(A.x, A.z), yb = terrain.heightAt(B.x, B.z), y = Math.min(ya, yb);
      const len = Math.hypot(B.x - A.x, B.z - A.z) + 0.05;
      batch.add('stone', M.stone, new THREE.BoxGeometry(0.35, 2.4 + Math.abs(ya - yb), len), mat4((A.x + B.x) / 2, y + 0.6 + Math.abs(ya - yb) / 2, (A.z + B.z) / 2, Math.atan2(B.x - A.x, B.z - A.z)), { uv: 'world', uvScale: 0.5, color: tint('#e2dccd') });
    }
  }
  // the hillside beyond the fences, for depth
  for (let i = 0; i < 140; i++) {
    const s = r() * L, side = r() < 0.5 ? 1 : -1, t = along(s, side, 33 + r() * 45);
    veg.push({ kind: r() < 0.7 ? 'pine' : 'olive', x: t.x, y: terrain.heightAt(t.x, t.z) - 0.2, z: t.z, s: 0.8 + r() * 0.5 });
  }

  // ---------- lookout plaza at the end of the street ----------
  const pz = plaza.h + road.curb;
  batch.add('pavers', M.pavers, new THREE.CircleGeometry(plaza.r, 48).rotateX(-Math.PI / 2), mat4(plaza.x, pz, plaza.z), { uv: 'world', uvScale: 0.25 });
  batch.add('stone', M.stone, new THREE.CylinderGeometry(plaza.r, plaza.r + 0.05, 0.8, 48, 1, true), mat4(plaza.x, pz - 0.4, plaza.z), { uv: 'world', uvScale: 0.5 });
  const viewA = Math.atan2(-plaza.dz, plaza.dx);
  P.addRailingArc(batch, M, cols, plaza.x, pz, plaza.z, plaza.r - 0.3, viewA - 2.55, viewA + 2.55); // open only toward the street
  for (const off of [-0.55, 0.55]) {
    const a = viewA + off, bx = plaza.x + Math.cos(a) * 7.5, bz = plaza.z - Math.sin(a) * 7.5;
    P.addBench(batch, M, cols, bx, pz, bz, yawFacing(plaza.dx, plaza.dz));
  }
  const tele = { x: plaza.x + plaza.dx * (plaza.r - 1.4), z: plaza.z + plaza.dz * (plaza.r - 1.4), y: pz };
  const telescope = P.makeTelescope(tele.x, tele.y, tele.z, yawFacing(plaza.dx, plaza.dz));
  group.add(telescope);
  cols.addCircle(tele.x, tele.z, 0.25, pz - 1, pz + 1.5);
  {
    const t = along(L - 3, -1, SWo - 0.3);
    P.addSign(group, batch, M, cols, t.x, yard(L - 3), t.z, yawFacing(t.tx, t.tz), 'תצפית', { bg: '#7a4a1f' });
  }
  for (const a of [viewA + 2.1, viewA - 2.1, viewA + 2.6]) {
    const x = plaza.x + Math.cos(a) * (plaza.r + 2), z = plaza.z - Math.sin(a) * (plaza.r + 2);
    veg.push({ kind: 'pine', x, y: terrain.heightAt(x, z), z, s: 1.1 });
    cols.addCircle(x, z, 0.4, -50, 50);
  }

  // ---------- merge everything ----------
  batch.build(group, {
    plaster: { cast: shadows }, stone: { cast: shadows }, tiles: { cast: shadows }, paint: { cast: shadows },
    solar: { cast: false }, shutter: { cast: false }, door: { cast: false },
  });
  buildVegetation(veg, M, group, { shadows });

  // ---------- queries used by the player, camera and missions ----------
  const groundHeight = (x, z) => {
    if (Math.hypot(x - plaza.x, z - plaza.z) < plaza.r) return pz;
    const n = road.nearest(x, z);
    if (n.d < W2) return n.h + 0.02;
    if (n.d < SWo) return n.h + road.curb;
    return terrain.heightAt(x, z);
  };
  const clampToPlayArea = (pos) => {
    const lim = CONFIG.world.playRadius, n = road.nearest(pos.x, pos.z);
    if (n.d > lim) {
      pos.x = n.qx + ((pos.x - n.qx) * lim) / n.d;
      pos.z = n.qz + ((pos.z - n.qz) * lim) / n.d;
    }
  };
  const startP = along(home.s, 1, W2 + road.sidewalk * 0.55);
  const start = { x: startP.x, z: startP.z, yaw: yawFacing(startP.tx, startP.tz) };

  return {
    group, road, terrain, cols, plaza, car, telescope: { ...tele, dx: plaza.dx, dz: plaza.dz },
    start, home, groundHeight, clampToPlayArea,
    lookout: { x: plaza.x, z: plaza.z, y: pz },
  };
}
