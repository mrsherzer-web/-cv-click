// Katzir, fictional and compressed: a hilltop neighborhood with one winding main street from the
// entrance gate (east) to a lookout over the coastal plain (west), and a side street to the south
// where Avraham's (fictional) house stands. Nothing here reproduces real addresses or houses.
import * as THREE from 'three';
import { smoothstep } from '../core/math.js';
import { Road } from './roads.js';
import { mat4 } from './batch.js';
import { tint } from './materials.js';
import { addHouse } from './houses.js';
import { makeHatchback } from './car.js';
import { Tex } from './textures.js';
import * as P from './props.js';

const MAIN_POINTS = [[172, 30], [132, 22], [96, 4], [60, -6], [24, 2], [-12, 18], [-46, 14], [-74, 2], [-94, 0]];
const HOME_S = 54;      // where Nehorai's house sits along the main street
const GARDEN_S = 174;
const BUS_S = 125;
const SIDE_S = 150;     // where the side street (Rimon street) leaves the main street, south side
const WALLS = ['#f1eee7', '#ece3d0', '#e6d8bf', '#efe0cf', '#e9ecec', '#f2e6d8', '#e8ded6'];
export const yawFacing = (dx, dz) => Math.atan2(dx, dz);

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  const main = net.add(new Road(MAIN_POINTS, { name: 'דרך הגבעה', width: 7, sidewalk: 2.2, curb: 0.14, spacing: 1.2, baseHeight }));
  places.mainRoad = main;
  const j = main.at(SIDE_S);
  // the side street leaves at a right angle toward the south, ends in a turning circle
  const P0 = [j.x, j.z], dir = [-j.nx, -j.nz];
  const side = net.add(new Road([P0, [P0[0] + dir[0] * 16, P0[1] + dir[1] * 16], [36, 62], [34, 96], [22, 124]],
    { name: 'רחוב הרימון', width: 6.5, sidewalk: 2.0, curb: 0.14, spacing: 1.2, baseHeight, startH: j.h }));
  places.sideRoad = side;
  const endP = side.at(side.length);
  places.turn = net.addPad({ x: endP.x + endP.tx * 6, z: endP.z + endP.tz * 6, r: 10, h: endP.h, top: 0.02, blend: 10, name: 'turning circle' });

  const end = main.at(main.length);
  const plaza = { x: end.x + end.tx * 7, z: end.z + end.tz * 7, h: end.h, r: 12.5, dx: end.tx, dz: end.tz };
  net.addPad({ x: plaza.x, z: plaza.z, r: plaza.r, h: plaza.h, top: main.curb, blend: 7, name: 'lookout' });
  places.plaza = plaza;

  // lawns in the yards along Katzir's streets
  ctx.yardWeight = (x, z) => {
    if (x < -150 || x > 200 || z < -70 || z > 175) return 0;
    const n = net.nearest(x, z, 28, (r) => r === main || r === side);
    return n ? 1 - smoothstep(18, 28, n.d) : 0;
  };
}

export function build(ctx) {
  const { group, M, r, cols, batch, veg, terrain, places, net } = ctx;
  const road = places.mainRoad, side = places.sideRoad, plaza = places.plaza;
  const L = road.length;

  // ---------- helpers for placing things relative to a street ----------
  const along = (rd, s, sd, d) => {
    const p = rd.at(s);
    return { x: p.x + p.nx * sd * d, z: p.z + p.nz * sd * d, h: p.h, tx: p.tx, tz: p.tz, nx: p.nx * sd, nz: p.nz * sd };
  };
  const yard = (rd, s) => rd.at(s).h + rd.curb;
  const plate = (text, x, y, z, yaw, w, h, opts) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: Tex.sign(text, opts), roughness: 0.6 }));
    m.position.set(x, y, z);
    m.rotation.y = yaw;
    m.userData.sign = true;
    group.add(m);
    return m;
  };
  // is this spot clear of roads and paved areas (for trees and fences)?
  const clear = (x, z, m = 3) => { const n = net.nearest(x, z, 40); return (!n || n.d > n.road.halfSurface + m) && !net.padAt(x, z); };

  // ---------- streets: asphalt, sidewalks, curbs (with an opening where the side street joins) ----------
  const W2 = road.width / 2, SWo = W2 + road.sidewalk;
  const gapS = [SIDE_S - side.halfSurface - 0.2, SIDE_S + side.halfSurface + 0.2];
  street(batch, M, road, { gaps: { [-1]: [gapS] } });
  street(batch, M, side, { from: road.halfSurface, startAsphalt: W2, to: side.length - 3 });
  // the corners where the side street's sidewalks meet the main street's
  for (const k of [-1, 1]) {
    const a = along(road, SIDE_S + k * (side.halfSurface - side.sidewalk / 2 + 0.1), -1, W2 + road.sidewalk / 2);
    batch.add('pavers', M.pavers, new THREE.BoxGeometry(road.sidewalk + 0.1, 0.1, side.sidewalk + 0.3), mat4(a.x, a.h + road.curb - 0.05, a.z, yawFacing(a.tx, a.tz)), { uv: 'world', uvScale: 0.25 });
  }
  // painted curbs by the bus stop and the garden, a zebra crossing and speed bumps
  for (const [s0, s1, sd] of [[BUS_S - 12, BUS_S + 12, -1], [GARDEN_S - 6, GARDEN_S + 6, 1], [0, 32, 1], [0, 32, -1]]) {
    batch.add('curbPainted', M.curbPainted, road.wall(sd * W2 + sd * 0.01, -0.2, road.curb + 0.005, 1, s0, s1, 0.5), null, {});
  }
  {
    const p = road.at(GARDEN_S - 9), yaw = yawFacing(p.tx, p.tz);
    for (let i = -3; i <= 3; i++) batch.add('paint', M.paint, new THREE.BoxGeometry(0.5, 0.02, 2.6), mat4(p.x + p.nx * i * 0.95, p.h + 0.035, p.z + p.nz * i * 0.95, yaw), { color: tint('#efefe9') });
  }
  P.addSpeedBump(batch, M, road, 95);
  P.addSpeedBump(batch, M, road, 214);
  P.addSpeedBump(batch, M, side, 50);

  // low stone garden wall along a lot frontage, with openings at the given [from, to] ranges
  const frontWall = (rd, s0, s1, sd, gaps) => {
    const d = rd.halfSurface + 0.45;
    const pieces = [];
    let a = s0;
    for (const [g0, g1] of gaps.sort((p, q) => p[0] - q[0])) { if (g0 > a) pieces.push([a, g0]); a = Math.max(a, g1); }
    if (a < s1) pieces.push([a, s1]);
    for (const [p0, p1] of pieces) {
      const steps = Math.max(1, Math.ceil((p1 - p0) / 3.5));
      for (let i = 0; i < steps; i++) {
        const sa = p0 + ((p1 - p0) * i) / steps, sb = p0 + ((p1 - p0) * (i + 1)) / steps;
        const A = along(rd, sa, sd, d), B = along(rd, sb, sd, d);
        const len = Math.hypot(B.x - A.x, B.z - A.z) + 0.02, y = (yard(rd, sa) + yard(rd, sb)) / 2;
        const yaw = Math.atan2(B.x - A.x, B.z - A.z), mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
        batch.add('stone', M.stone, new THREE.BoxGeometry(0.3, 1.4, len), mat4(mx, y + 0.3, mz, yaw), { uv: 'world', uvScale: 0.5 });
        batch.add('stone', M.stone, new THREE.BoxGeometry(0.38, 0.07, len), mat4(mx, y + 1.03, mz, yaw), { color: tint('#efe9dc'), uv: 'world' });
        cols.addSegment(A.x, A.z, B.x, B.z, 0.32, y - 1, y + 1.1);
      }
    }
    for (const [g0, g1] of gaps) for (const gs of [g0, g1]) { // pillars at each opening
      const p = along(rd, gs, sd, d);
      batch.add('stone', M.stone, new THREE.BoxGeometry(0.5, 1.8, 0.5), mat4(p.x, yard(rd, gs) + 0.45, p.z, yawFacing(p.tx, p.tz)), { uv: 'world', uvScale: 0.5 });
      cols.addCircle(p.x, p.z, 0.3, yard(rd, gs) - 1, yard(rd, gs) + 1.4);
    }
  };

  // a row of houses along a street; special(ls, sd) may claim a lot and return its options
  const lots = (rd, { from, to, every = 24, sideOffset = 11, skip = () => false, special = () => null }) => {
    for (let s = from; s < to; s += every) {
      for (const sd of [1, -1]) {
        const ls = s + (sd < 0 ? sideOffset : 0);
        if (ls > to || skip(ls, sd)) continue;
        const sp = special(ls, sd) || {};
        const w = sp.w ?? 9 + r() * 3, d = sp.d ?? 9 + r() * 2.5;
        const setback = sp.setback ?? 5.0;
        const P0 = along(rd, ls, sd, rd.halfSurface + setback + d / 2);
        const yaw = yawFacing(-P0.nx, -P0.nz);
        const corners = [];
        for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const lx = (cx * w) / 2, lz = (cz * d) / 2;
          corners.push(terrain.heightAt(P0.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), P0.z - lx * Math.sin(yaw) + lz * Math.cos(yaw)));
        }
        const y = Math.max(yard(rd, ls) + 0.15, (corners[2] + corners[3]) / 2 + 0.1);
        const floors = sp.floors ?? (r() < 0.7 ? 2 : 1);
        const spec = {
          x: P0.x, y, z: P0.z, yaw, w, d, floors,
          roof: sp.roof ?? (r() < 0.28 ? 'tiles' : 'flat'),
          wall: sp.wall ?? WALLS[Math.floor(r() * WALLS.length)],
          balcony: floors > 1 && (sp.balcony ?? r() < 0.55),
          ac: r() < 0.85,
          sink: y - Math.min(...corners) + 0.6,
        };
        const { H } = addHouse(batch, M, spec);
        cols.addBox(P0.x, P0.z, w / 2 + 0.05, d / 2 + 0.05, yaw, y - 3, y + H + 1);
        const gaps = [[ls - 0.75, ls + 0.75]];
        if (sp.driveway) gaps.push(sp.driveway);
        else if (r() < 0.4) gaps.push([ls + 5.5, ls + 8.5]);
        frontWall(rd, ls - 11.6, ls + 11.6, sd, gaps);
        sp.done?.({ ls, sd, P0, y, yaw, H });
        // yard planting
        const ty = yard(rd, ls);
        if (r() < 0.55) { const t = along(rd, ls - 4 - r() * 3, sd, rd.halfSurface + 2.6); veg.push({ kind: 'olive', x: t.x, y: ty, z: t.z, s: 0.85 + r() * 0.3 }); cols.addCircle(t.x, t.z, 0.35, ty - 1, ty + 2); }
        if (r() < 0.45) { const t = along(rd, ls + 4 + r() * 4, sd, rd.halfSurface + 1.1); veg.push({ kind: 'bush', x: t.x, y: ty, z: t.z, s: 0.8 + r() * 0.4 }); }
        if (r() < 0.3) for (const off of [-1.4, 1.4]) { const t = along(rd, ls + off, sd, rd.halfSurface + 1.2); veg.push({ kind: 'cypress', x: t.x, y: ty, z: t.z, s: 0.8 + r() * 0.2 }); cols.addCircle(t.x, t.z, 0.4, ty - 1, ty + 5); }
        for (let k = 0; k < 2; k++) {
          const t = along(rd, ls + (r() - 0.5) * 16, sd, 22 + r() * 5);
          if (!clear(t.x, t.z, 4)) continue;
          const yy = terrain.heightAt(t.x, t.z);
          veg.push({ kind: 'pine', x: t.x, y: yy, z: t.z, s: 0.85 + r() * 0.35 });
          cols.addCircle(t.x, t.z, 0.35, yy - 1, yy + 4);
        }
        if (r() < 0.45) { const t = along(rd, ls + 2.4, sd, rd.halfSurface - 0.45); P.addBin(batch, M, cols, t.x, ty, t.z, yawFacing(t.tx, t.tz)); }
      }
    }
  };

  // ---------- houses on the main street ----------
  lots(road, {
    from: 30, to: L - 24,
    skip: (ls, sd) => (sd === 1 && Math.abs(ls - GARDEN_S) < 6) || (sd === -1 && Math.abs(ls - SIDE_S) < 15),
    special: (ls, sd) => (sd === 1 && ls === HOME_S ? {
      w: 11, d: 10, setback: 6.6, floors: 2, roof: 'flat', wall: '#f3efe6', balcony: true, driveway: [ls + 3.2, ls + 6.6],
      done: (h) => { places.home = { s: ls, side: sd, house: h.P0, y: h.y, yaw: h.yaw, road }; },
    } : null),
  });
  // ---------- houses on the side street; Avraham's is the last one on the east side ----------
  const AV_S = side.length - 14;
  lots(side, {
    from: 20, to: side.length - 8, sideOffset: 10,
    skip: (ls) => ls < road.halfSurface + 12,
    special: (ls, sd) => (sd === -1 && Math.abs(ls - AV_S) < 12 ? {
      w: 10.5, d: 9.5, setback: 6.2, floors: 2, roof: 'tiles', wall: '#efe0cf', balcony: true, driveway: [ls + 3.0, ls + 6.4],
      done: (h) => { places.avraham = { s: ls, side: sd, house: h.P0, y: h.y, yaw: h.yaw, road: side }; },
    } : null),
  });
  if (!places.avraham) throw new Error('katzir: no lot for Avraham\'s house');

  // Nehorai's home: name plate by the gate and the white hatchback in the driveway
  const home = places.home;
  const gatePost = along(road, home.s - 0.75, 1, SWo + 0.17);
  plate('פרחי', gatePost.x, yard(road, home.s) + 1.25, gatePost.z, yawFacing(-gatePost.nx, -gatePost.nz), 0.5, 0.17, { bg: '#2b2f36', fg: '#f3efe6', w: 384, h: 128, size: 72, border: false });
  const carSpot = along(road, home.s + 4.9, 1, SWo + 3.5);
  places.carSpot = { x: carSpot.x, z: carSpot.z, y: yard(road, home.s), yaw: yawFacing(-carSpot.nx, -carSpot.nz) };
  // Avraham's: the same kind of plate, and the spot by his gate where the car stops
  const av = places.avraham, avPost = along(side, av.s - 0.75, -1, side.halfSurface + 0.62);
  plate('שזגר', avPost.x, yard(side, av.s) + 1.25, avPost.z, yawFacing(-avPost.nx, -avPost.nz), 0.5, 0.17, { bg: '#2b2f36', fg: '#f3efe6', w: 384, h: 128, size: 72, border: false });
  const pick = along(side, av.s - 2, -1, side.width / 4);
  places.avrahamPickup = { x: pick.x, z: pick.z, y: side.at(av.s).h, yaw: yawFacing(-pick.tx, -pick.tz) };
  const door = along(side, av.s, -1, side.halfSurface + 1.2);
  places.avrahamDoor = { x: door.x, z: door.z, y: yard(side, av.s) };

  // ---------- public garden ----------
  {
    for (let i = 0; i < 4; i++) { const t = along(road, GARDEN_S - 8 + i * 5.5, 1, SWo + 5 + r() * 9); veg.push({ kind: i % 2 ? 'olive' : 'pine', x: t.x, y: terrain.heightAt(t.x, t.z), z: t.z, s: 0.9 + r() * 0.3 }); cols.addCircle(t.x, t.z, 0.4, -100, 100); }
    for (let i = 0; i < 5; i++) { const t = along(road, GARDEN_S - 9 + i * 4.5, 1, SWo + 15 + r() * 3); veg.push({ kind: 'bush', x: t.x, y: terrain.heightAt(t.x, t.z), z: t.z, s: 0.9 + r() * 0.5 }); }
    for (const off of [-3, 3]) { const b = along(road, GARDEN_S + off, 1, SWo + 3); P.addBench(batch, M, cols, b.x, terrain.heightAt(b.x, b.z), b.z, yawFacing(-b.nx, -b.nz)); }
    const sg = along(road, GARDEN_S - 6.5, 1, SWo - 0.3);
    P.addSign(group, batch, M, cols, sg.x, yard(road, GARDEN_S), sg.z, yawFacing(sg.tx, sg.tz), 'גן ציבורי', { bg: '#2f6b3c' });
  }

  // ---------- bus stop, street signs, lamps ----------
  const bus = along(road, BUS_S, -1, SWo - 0.95);
  P.addBusStop(group, batch, M, cols, bus.x, yard(road, BUS_S), bus.z, yawFacing(-bus.nx, -bus.nz));
  for (const [s, sd] of [[26, -1], [150 + 9, 1]]) {
    const t = along(road, s, sd, SWo - 0.3);
    P.addSign(group, batch, M, cols, t.x, yard(road, s), t.z, yawFacing(t.tx, t.tz), 'דרך הגבעה');
  }
  {
    const t = along(side, road.halfSurface + 3, 1, side.halfSurface - 0.3);
    P.addSign(group, batch, M, cols, t.x, yard(side, 9), t.z, yawFacing(t.tx, t.tz), 'רחוב הרימון');
  }
  for (const [rd, from, to] of [[road, 18, L - 4], [side, 20, side.length]]) {
    for (let s = from, i = 0; s < to; s += 32, i++) {
      const sd = i % 2 ? 1 : -1;
      if (rd === road && sd === -1 && Math.abs(s - SIDE_S) < 9) continue;
      const t = along(rd, s, sd, rd.halfSurface - 0.35);
      P.addLamp(batch, M, cols, t.x, yard(rd, s), t.z, yawFacing(-t.nx, -t.nz));
    }
  }

  // ---------- entrance: open gate, guard booth, welcome sign, palms ----------
  const gateP = road.at(5);
  P.addGate(group, batch, M, cols, gateP.x, gateP.h, gateP.z, yawFacing(gateP.tx, gateP.tz), road.width);
  {
    const wsP = along(road, 17, 1, SWo + 1.6), y = yard(road, 17), yaw = yawFacing(-wsP.nx, -wsP.nz);
    batch.add('stone', M.stone, new THREE.BoxGeometry(4.6, 1.6, 0.7), mat4(wsP.x, y + 0.6, wsP.z, yaw), { uv: 'world', uvScale: 0.5 });
    plate('ברוכים הבאים לקציר', wsP.x - wsP.nx * 0.36, y + 0.95, wsP.z - wsP.nz * 0.36, yaw, 3.8, 0.6, { bg: '#4a3a2c', fg: '#f3e6cc', w: 1024, h: 160, size: 92, border: false });
    cols.addBox(wsP.x, wsP.z, 2.3, 0.4, yaw, y - 1, y + 1.5);
    for (const [s, sd] of [[9, 1], [15, -1], [22, -1], [26, 1]]) { const t = along(road, s, sd, SWo + 1.4); veg.push({ kind: 'palm', x: t.x, y: yard(road, s), z: t.z, s: 0.9 + r() * 0.2 }); cols.addCircle(t.x, t.z, 0.4, -100, 100); }
  }

  // ---------- back fences behind the yards, with openings for the side street ----------
  const backFence = (rd, sd, from, to, d, holes = []) => {
    for (let s = from; s < to; s += 4) {
      if (holes.some(([a, b]) => s + 4 > a && s < b)) continue;
      const A = along(rd, s, sd, d), B = along(rd, Math.min(to, s + 4), sd, d);
      if (!clear(A.x, A.z, 1) || !clear(B.x, B.z, 1)) continue;
      const ya = terrain.heightAt(A.x, A.z), yb = terrain.heightAt(B.x, B.z), y = Math.min(ya, yb);
      const len = Math.hypot(B.x - A.x, B.z - A.z) + 0.05;
      batch.add('stone', M.stone, new THREE.BoxGeometry(0.35, 2.4 + Math.abs(ya - yb), len), mat4((A.x + B.x) / 2, y + 0.6 + Math.abs(ya - yb) / 2, (A.z + B.z) / 2, Math.atan2(B.x - A.x, B.z - A.z)), { uv: 'world', uvScale: 0.5, color: tint('#e2dccd') });
      cols.addSegment(A.x, A.z, B.x, B.z, 0.35, y - 2, y + 2.6);
    }
  };
  backFence(road, 1, 8, L - 2, 29);
  backFence(road, -1, 8, L - 2, 29, [[SIDE_S - 26, SIDE_S + 26]]);
  for (const sd of [1, -1]) backFence(side, sd, 24, side.length - 4, 27);

  // the hillside beyond the fences, for depth
  for (let i = 0; i < 260; i++) {
    const rd = i % 3 ? road : side, s = r() * rd.length, sd = r() < 0.5 ? 1 : -1, t = along(rd, s, sd, 33 + r() * 55);
    if (!clear(t.x, t.z, 6)) continue;
    veg.push({ kind: r() < 0.7 ? 'pine' : 'olive', x: t.x, y: terrain.heightAt(t.x, t.z) - 0.2, z: t.z, s: 0.8 + r() * 0.5 });
  }

  // ---------- the turning circle at the end of the side street ----------
  {
    const t = places.turn, e = side.at(side.length), entry = Math.atan2(-e.tx, -e.tz), open = 0.62; // no curb where the street comes in
    batch.add('asphalt', M.asphalt, new THREE.CircleGeometry(t.r, 40).rotateX(-Math.PI / 2), mat4(t.x, t.h + 0.025, t.z), { uv: 'world', uvScale: 1 / 7 });
    batch.add('curbGray', M.curbGray, new THREE.CylinderGeometry(t.r, t.r, 0.6, 40, 1, true, entry + open, Math.PI * 2 - open * 2), mat4(t.x, t.h - 0.16, t.z), { uv: 'world', uvScale: 0.5 });
  }

  // ---------- lookout plaza at the end of the main street ----------
  const pz = plaza.h + road.curb;
  batch.add('pavers', M.pavers, new THREE.CircleGeometry(plaza.r, 48).rotateX(-Math.PI / 2), mat4(plaza.x, pz, plaza.z), { uv: 'world', uvScale: 0.25 });
  batch.add('stone', M.stone, new THREE.CylinderGeometry(plaza.r, plaza.r + 0.05, 0.8, 48, 1, true), mat4(plaza.x, pz - 0.4, plaza.z), { uv: 'world', uvScale: 0.5 });
  const viewA = Math.atan2(-plaza.dz, plaza.dx);
  P.addRailingArc(batch, M, cols, plaza.x, pz, plaza.z, plaza.r - 0.3, viewA - 2.55, viewA + 2.55); // open only toward the street
  places.benches = [];
  for (const off of [-0.55, 0.55]) {
    const a = viewA + off, bx = plaza.x + Math.cos(a) * 7.5, bz = plaza.z - Math.sin(a) * 7.5;
    P.addBench(batch, M, cols, bx, pz, bz, yawFacing(plaza.dx, plaza.dz));
    places.benches.push({ x: bx, z: bz, y: pz, yaw: yawFacing(plaza.dx, plaza.dz) });
  }
  const tele = { x: plaza.x + plaza.dx * (plaza.r - 1.4), z: plaza.z + plaza.dz * (plaza.r - 1.4), y: pz };
  group.add(P.makeTelescope(tele.x, tele.y, tele.z, yawFacing(plaza.dx, plaza.dz)));
  cols.addCircle(tele.x, tele.z, 0.25, pz - 1, pz + 1.5);
  places.telescope = { ...tele, dx: plaza.dx, dz: plaza.dz };
  places.lookout = { x: plaza.x, z: plaza.z, y: pz };
  {
    const t = along(road, L - 3, -1, SWo - 0.3);
    P.addSign(group, batch, M, cols, t.x, yard(road, L - 3), t.z, yawFacing(t.tx, t.tz), 'תצפית', { bg: '#7a4a1f' });
  }
  for (const a of [viewA + 2.1, viewA - 2.1, viewA + 2.6]) {
    const x = plaza.x + Math.cos(a) * (plaza.r + 2), z = plaza.z - Math.sin(a) * (plaza.r + 2);
    veg.push({ kind: 'pine', x, y: terrain.heightAt(x, z), z, s: 1.1 });
    cols.addCircle(x, z, 0.4, -100, 100);
  }

  // where a new game starts: on the sidewalk in front of Nehorai's house
  const startP = along(road, home.s, 1, W2 + road.sidewalk * 0.55);
  places.start = { x: startP.x, z: startP.z, yaw: yawFacing(startP.tx, startP.tz) };
}

// asphalt, sidewalks and curbs along a street. gaps: { [side]: [[s0, s1], ...] } leave openings in
// the sidewalk (where another street joins); from/startAsphalt skip the part inside the other street.
export function street(batch, M, rd, { gaps = {}, from = 0, startAsphalt = 0, to = rd.length } = {}) {
  const W2 = rd.width / 2, SWo = W2 + rd.sidewalk, L = to;
  batch.add('asphalt', M.asphalt, rd.ribbon(-W2, W2, 0.02, 1 / 7, startAsphalt), null, {});
  for (const sd of [1, -1]) {
    const runs = [];
    let a = from;
    for (const [g0, g1] of (gaps[sd] || []).slice().sort((p, q) => p[0] - q[0])) { if (g0 > a) runs.push([a, g0]); a = Math.max(a, g1); }
    if (a < L) runs.push([a, L]);
    for (const [s0, s1] of runs) {
      batch.add('pavers', M.pavers, rd.ribbon(sd * W2, sd * SWo, rd.curb, 1 / 4, s0, s1), null, {});
      batch.add('stone', M.stone, rd.wall(sd * SWo, -0.5, rd.curb, -1, s0, s1), null, { color: tint('#cfc8ba') });
      batch.add('curbGray', M.curbGray, rd.wall(sd * W2, -0.2, rd.curb, 1, s0, s1), null, {});
    }
  }
}
