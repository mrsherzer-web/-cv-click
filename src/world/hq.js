// Kotzi's headquarters (chapter eight, the last war): the biggest place in the game. A walled compound
// 160 × 130 with the gate on the south side and two towers; the yard with containers and two guard huts;
// across the middle a garage (west, the office with the note) and the server hall (east, behind a keypad
// door, a shelf that hides a door to a long passage north); behind an inner wall the north block: the
// command room, three rooms in a row south of it, the security corridor with two laser gates and two
// cameras, the control room where it ends, and an east hall. The inner wall has three doors — west
// (in the control room), centre (out of the third room) and east (out of the east hall) — the ways out
// when the place is about to go up. Site-local: origin at the centre, +z south. Invented throughout.
import * as THREE from 'three';
import { makeSite } from './compound.js';
import { makeHatchback } from './car.js';

const C = { x: 760, z: 120 }, HX = 80, HZ = 65;
export const SERVER_CODE = '7391';

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const h = baseHeight(C.x, C.z);
  net.addPad({ x: C.x, z: C.z, hx: HX + 4, hz: HZ + 4, yaw: 0, h, top: 0.05, blend: 10, name: 'hq' });
  net.addPad({ x: C.x + 31, z: C.z + HZ + 12, hx: 9, hz: 12, yaw: 0, h, top: 0.05, blend: 8, name: 'hq approach' });
  ctx.keepOut?.push({ x: C.x, z: C.z + 6, hx: HX + 12, hz: HZ + 22 });
  ctx.hq = { y: h + 0.05 };
  ctx.hqY = h + 0.05;
}

export function build(ctx) {
  const { places, M, cols } = ctx;
  const { y } = ctx.hq;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'hq' });
  const { L, wall, slab, door, crate, barrel, lampPost, ceilingLamp, sign, mesh, std, box, solid, tower, camera, toWorld, group } = S;
  const P = (lx, lz, yaw) => ({ ...toWorld(lx, lz), y, ...(yaw != null ? { yaw } : {}) });
  const outer = { h: 4.6, t: 0.6, color: '#8a8580', key: 'stone', mat: M.stone, scale: 0.4 };
  const tall = { h: 4.4, t: 0.35, color: '#c2bdb2' };
  const low = { h: 3.6, t: 0.25, color: '#d8d3c6' };
  // ---------- the outer wall, the gate, the towers ----------
  wall(-HX, HZ, HX, HZ, [{ at: HX + 30, w: 5.8, h: 4.2 }], outer);
  wall(HX, -HZ, HX, HZ, [], outer); wall(HX, -HZ, -HX, -HZ, [], outer); wall(-HX, -HZ, -HX, HZ, [], outer);
  slab(0, -0.01, 0, HX * 2 - 1, 0.06, HZ * 2 - 1, { key: 'asphalt', mat: M.asphalt, color: '#73716b', scale: 0.1 });
  const gate = door(30, HZ, 0, 5.6, { locked: true, color: '#1c1f26', h: 4.0 });
  sign('המפקדה · קוצי', 30, 5.2, HZ + 0.4, 0, 4.4, 0.7, { bg: '#1c1f26', fg: '#ff9180' });
  const towers = [tower(-72, 58, 7), tower(72, 58, 7)];
  // ---------- the yard (z 15 .. 65): containers, crates, two huts ----------
  const cont = (lx, lz, yaw, color) => { mesh(box(2.5, 2.6, 6.1), std({ color, roughness: 0.6, metalness: 0.3 }), lx, 1.3, lz, yaw); solid(lx, lz, 1.25, 3.05, 2.6, yaw); S.cover.push({ ...toWorld(lx, lz), w: 2.5, d: 6.1 }); };
  cont(-30, 46, 0, '#2b6a8f'); cont(-10, 52, Math.PI / 2, '#8a4b2e'); cont(10, 28, 0.2, '#2f7a4a'); cont(48, 50, 0, '#7a2b2b'); cont(-58, 26, Math.PI / 2, '#6b6f75'); cont(62, 22, 0, '#c8a23a');
  for (const [lx, lz] of [[-40, 58], [0, 40], [20, 52], [-18, 30], [40, 30], [-68, 44], [68, 40]]) crate(lx, lz, 1.6, 1.6, 1.3);
  for (const [lx, lz] of [[-4, 58], [-3.3, 58.6], [14, 40], [36, 46], [-50, 52]]) barrel(lx, lz, '#c8352d');
  const hut = (hx, hz) => { wall(hx - 4, hz - 3, hx + 4, hz - 3, [], low); wall(hx + 4, hz - 3, hx + 4, hz + 3, [], low); wall(hx + 4, hz + 3, hx - 4, hz + 3, [{ at: 4, w: 1.6, h: 2.3 }], low); wall(hx - 4, hz + 3, hx - 4, hz - 3, [], low); slab(hx, 3.65, hz, 8.4, 0.1, 6.4, { color: '#7a7d82' }); ceilingLamp(hx, hz, 3.6, { range: 8, intensity: 14 }); };
  hut(-45, 38); hut(50, 38);
  // ---------- the middle band (z -15 .. 15): the garage west, the server hall east ----------
  // the garage: a wide opening south, a side door east, the office in its north-west corner
  wall(-78, -12, -52, -12, [], tall); wall(-52, -12, -52, 12, [{ at: 12, w: 1.4, h: 2.3 }], tall); wall(-52, 12, -78, 12, [{ at: 13, w: 6.2, h: 4.0 }], tall); wall(-78, 12, -78, -12, [], tall);
  slab(-65, 4.45, 0, 26.4, 0.1, 24.4, { color: '#6b6f75' });
  wall(-68, -12, -68, -4, [{ at: 4, w: 1.2, h: 2.2 }], low); wall(-78, -4, -68, -4, [], low);
  mesh(box(1.6, 0.75, 0.8), std({ color: '#7a5a3a' }), -74, 0.38, -9.4); solid(-74, -9.4, 0.8, 0.4, 0.78);
  mesh(box(0.3, 0.02, 0.2), std({ color: '#f1efe6' }), -73.6, 0.79, -9.3); // the note
  for (const [lx, lz, yaw, col] of [[-62, 4, 0.1, '#121417'], [-58, -6, -0.2, '#6b6f75']]) { const m = makeHatchback({ color: col, plates: false }); const p = toWorld(lx, lz); m.position.set(p.x, y, p.z); m.rotation.y = yaw; group.add(m); cols.addBox(p.x, p.z, 0.95, 2.1, yaw, y - 1, y + 1.5); S.cover.push({ ...p, w: 1.9, d: 4.2 }); }
  for (const [lx, lz] of [[-72, 8], [-54, 8]]) crate(lx, lz, 1.4, 1.4, 1.1, '#6b6f75');
  for (const [lx, lz] of [[-65, -2], [-72, -8]]) ceilingLamp(lx, lz, 4.4, { range: 12, intensity: 20 });
  sign('מוסך', -65, 3.8, 12.3, 0, 2, 0.5, { bg: '#2b2f36' });
  // the server hall: its door (a keypad) on the west wall, racks in rows, the shelf on the north wall
  wall(40, -12, 74, -12, [{ at: 16, w: 1.2, h: 2.2 }], tall); wall(74, -12, 74, 12, [], tall); wall(74, 12, 40, 12, [], tall); wall(40, 12, 40, -12, [{ at: 12, w: 1.4, h: 2.3 }], tall);
  slab(57, 4.45, 0, 34.4, 0.1, 24.4, { color: '#6b6f75' });
  const serverDoor = door(40, 0, Math.PI / 2, 1.4, { locked: true, color: '#2a2d33' });
  const rack = (x0, x1, lz) => { mesh(box(x1 - x0, 2.2, 0.9), std({ color: '#1c1f26', metalness: 0.3 }), (x0 + x1) / 2, 1.1, lz); solid((x0 + x1) / 2, lz, (x1 - x0) / 2, 0.45, 2.2); for (let x = x0 + 0.6; x < x1; x += 1.2) mesh(new THREE.PlaneGeometry(0.5, 0.08), std({ color: '#2fd27a', emissive: '#2fd27a', emissiveIntensity: 0.8 }), x, 1.6, lz + 0.46); S.cover.push({ ...toWorld((x0 + x1) / 2, lz), w: x1 - x0, d: 0.9 }); };
  rack(44, 52, -6); rack(60, 71, -6); rack(44, 54, 5); rack(58, 71, 5);
  const hiddenDoor = door(56, -12, 0, 1.2, { locked: true, color: '#5d636b' });
  const shelf = mesh(box(2.0, 2.2, 0.6), std({ color: '#6b5a44', roughness: 0.8 }), 56, 1.1, -11.4);
  const shelfBody = cols.addBox(C.x + 56, C.z - 11.4, 1.0, 0.3, 0, y - 1, y + 2.2);
  for (const [lx, lz] of [[48, 0], [64, 0]]) ceilingLamp(lx, lz, 4.4, { range: 12, intensity: 20 });
  sign('שרתים', 40.3, 3.0, 0, Math.PI / 2, 1.8, 0.45, { bg: '#1c1f26', fg: '#59c7ff' });
  // the strip between the server hall and the inner wall is closed at both ends: it is reached only by the hidden door
  wall(40, -15, 40, -12, [], tall); wall(74, -15, 74, -12, [], tall);
  for (const [lx, lz] of [[-30, 2], [-20, -6], [0, 6], [14, -4], [24, 8], [-40, -8]]) crate(lx, lz, 1.6, 1.6, 1.3);
  for (const [lx, lz] of [[6, -8], [6.7, -8.6], [-12, 10]]) barrel(lx, lz, '#3a4b8f');
  // ---------- the inner wall at z = -15 with its doors: west (x -30), centre (x 0), east (x 30), the passage (x 56) ----------
  const innerW = { h: 4.6, t: 0.5, color: '#a39b8c', key: 'stone', mat: M.stone, scale: 0.4 };
  wall(-HX, -15, HX, -15, [{ at: 50, w: 1.6, h: 2.4 }, { at: 80, w: 1.6, h: 2.4 }, { at: 110, w: 1.6, h: 2.4 }, { at: 136, w: 2.4, h: 2.6 }], innerW);
  const doorW = door(-30, -15, 0, 1.6, { locked: true, color: '#3a3d44', h: 2.4 });
  const doorC = door(0, -15, 0, 1.6, { locked: true, color: '#3a3d44', h: 2.4 });
  const doorE = door(30, -15, 0, 1.6, { locked: true, color: '#3a3d44', h: 2.4 });
  // ---------- the passage: north from the hidden door, then west to the command room's back door ----------
  wall(54.6, -15, 54.6, -53, [], low); wall(57.4, -15, 57.4, -56, [], low);
  wall(12, -53, 54.6, -53, [], low); wall(12, -56, 57.4, -56, [], low);
  for (const lz of [-24, -36, -48]) ceilingLamp(56, lz, 3.6, { range: 8, intensity: 12 });
  for (const lx of [22, 36, 48]) ceilingLamp(lx, -54.5, 3.6, { range: 8, intensity: 12 });
  // ---------- the command room (x -12 .. 12, z -62 .. -46) ----------
  wall(-12, -62, 12, -62, [], tall); wall(12, -62, 12, -46, [{ at: 7.5, w: 1.2, h: 2.2 }], tall); wall(12, -46, -12, -46, [{ at: 12, w: 1.6, h: 2.4 }], tall); wall(-12, -46, -12, -62, [], tall);
  slab(0, 4.45, -54, 24.4, 0.1, 16.4, { color: '#5d5f63' });
  const backDoor = door(12, -54.5, Math.PI / 2, 1.2, { locked: true, color: '#3a3d44' });
  const frontDoor = door(0, -46, 0, 1.6, { locked: false, color: '#3a3d44', h: 2.4 });
  mesh(box(3.6, 0.85, 1.2), std({ color: '#3a2a1e', roughness: 0.6 }), 0, 0.43, -57); solid(0, -57, 1.8, 0.6, 0.86); // Kotzi's desk
  const bigScreenMat = std({ color: '#0b1220', emissive: '#ff4a4a', emissiveIntensity: 0.3 });
  mesh(new THREE.PlaneGeometry(9, 2.6), bigScreenMat, 0, 2.4, -61.7, 0);
  for (const [lx, lz] of [[-9, -50], [9, -50]]) { mesh(box(1.6, 1.0, 1.6), std({ color: '#3a3f47' }), lx, 0.5, lz); solid(lx, lz, 0.8, 0.8, 1.0); S.cover.push({ ...toWorld(lx, lz), w: 1.6, d: 1.6 }); }
  for (const lx of [-6, 6]) ceilingLamp(lx, -54, 4.4, { range: 12, intensity: 20 });
  sign('חדר הפיקוד', 0, 3.2, -45.7, 0, 2.6, 0.5, { bg: '#1c1f26', fg: '#ff9180' });
  // ---------- three rooms in a row south of it (x -8 .. 8): z -46..-36, -36..-26, -26..-15 ----------
  wall(-8, -46, -8, -15, [{ at: 25.5, w: 1.6, h: 2.4 }], tall);          // west: room three's door to the security corridor at z = -20.5
  wall(8, -46, 8, -15, [{ at: 15, w: 1.6, h: 2.4 }], tall);              // east: room two's door to the east hall at z = -31
  wall(-8, -36, 8, -36, [{ at: 8, w: 1.6, h: 2.4 }], tall); wall(-8, -26, 8, -26, [{ at: 8, w: 1.6, h: 2.4 }], tall);
  const d12 = door(0, -36, 0, 1.6, { color: '#4a4e55', h: 2.4 }), d23 = door(0, -26, 0, 1.6, { color: '#4a4e55', h: 2.4 });
  const r3w = door(-8, -20.5, Math.PI / 2, 1.6, { color: '#4a4e55', h: 2.4 });
  const r2e = door(8, -31, Math.PI / 2, 1.6, { color: '#4a4e55', h: 2.4 });
  for (const [lx, lz] of [[-5, -42], [5, -32], [-5, -22], [5, -18]]) crate(lx, lz, 1.4, 1.4, 1.1);
  for (const lz of [-41, -31, -20.5]) ceilingLamp(0, lz, 4.4, { range: 10, intensity: 18 });
  slab(0, 4.45, -30.5, 16.4, 0.1, 31.4, { color: '#6b6f75' });
  // ---------- the security corridor (x -20 .. -8, z -23.5 .. -17.5): two laser gates, two cameras ----------
  wall(-20, -23.5, -8, -23.5, [], low); wall(-20, -17.5, -8, -17.5, [], low);
  slab(-14, 3.65, -20.5, 12.4, 0.1, 6.4, { color: '#5d5f63' });
  const laserMat = std({ color: '#ff2a2a', emissive: '#ff2a2a', emissiveIntensity: 1.2, transparent: true, opacity: 0.55 });
  const laser = (lx) => { const d = door(lx, -20.5, Math.PI / 2, 5.8, { locked: true, color: '#ff2a2a', h: 2.4 }); d.leaf.material = laserMat; return d; };
  const gate1 = laser(-11), gate2 = laser(-16);
  for (const [lx, lz] of [[-13.5, -22.4], [-18.2, -18.6]]) { mesh(box(1.2, 1.1, 1.2), std({ color: '#3a3f47' }), lx, 0.55, lz); solid(lx, lz, 0.6, 0.6, 1.1); S.cover.push({ ...toWorld(lx, lz), w: 1.2, d: 1.2 }); }
  const cams = [camera(-19.6, 2.8, -22.6, Math.PI / 2 - 0.25, { range: 14, half: 0.45 }), camera(-8.6, 2.8, -18.4, -Math.PI / 2 - 0.25, { range: 14, half: 0.45 })];
  for (const c of cams) c.setOn(false);
  ceilingLamp(-14, -20.5, 3.6, { range: 9, intensity: 14 });
  // the three breakers: in room three, between the gates, by the control room's door
  const breakers = [P(-6.7, -24.2, Math.PI / 2), P(-13.5, -18.4, 0), P(-19.0, -19.0, Math.PI / 2)];
  for (const [lx, lz, yaw] of [[-7.7, -24.2, Math.PI / 2], [-13.5, -17.75, 0], [-19.75, -19.0, Math.PI / 2]]) mesh(box(0.4, 0.6, 0.12), std({ color: '#6b6f75', metalness: 0.4 }), lx, 1.4, lz, yaw);
  // ---------- the control room (x -40 .. -20, z -36 .. -15): where it ends ----------
  wall(-40, -36, -20, -36, [], tall); wall(-20, -36, -20, -15, [{ at: 15.5, w: 1.6, h: 2.4 }], tall); wall(-40, -15, -40, -36, [], tall);
  slab(-30, 4.45, -25.5, 20.4, 0.1, 21.4, { color: '#5d5f63' });
  const controlDoor = door(-20, -20.5, Math.PI / 2, 1.6, { color: '#4a4e55', h: 2.4 });
  mesh(box(16, 0.9, 0.8), std({ color: '#3a3f47' }), -30, 0.45, -35.2); solid(-30, -35.2, 8, 0.4, 0.9);
  const ctrlScreenMat = std({ color: '#0b1220', emissive: '#59c7ff', emissiveIntensity: 0.5 });
  for (const dx of [-36, -30, -24]) mesh(box(2.2, 1.2, 0.06), ctrlScreenMat, dx, 1.8, -35.7);
  for (const [lx, lz] of [[-30, -26], [-36, -20]]) ceilingLamp(lx, lz, 4.4, { range: 12, intensity: 20 });
  sign('חדר הבקרה', -30, 3.4, -15.3, 0, 2.4, 0.5, { bg: '#1c1f26', fg: '#59c7ff' });
  // ---------- the east hall (x 8 .. 54.6, z -46 .. -15): bunks, crates ----------
  wall(8, -46, 54.6, -46, [], tall);
  for (const [lx, lz] of [[16, -40], [26, -40], [36, -40], [46, -40]]) { mesh(box(2.0, 0.6, 0.9), std({ color: '#8a93a6' }), lx, 0.3, lz); solid(lx, lz, 1.0, 0.45, 0.6); }
  for (const [lx, lz] of [[20, -26], [34, -30], [44, -22]]) crate(lx, lz, 1.6, 1.6, 1.3);
  for (const lx of [18, 32, 46]) ceilingLamp(lx, -30, 4.4, { range: 12, intensity: 18 });
  slab(31.3, 4.45, -30.5, 46.6, 0.1, 31.4, { color: '#6b6f75' });
  // ---------- lamps outside ----------
  for (const [lx, lz] of [[-60, 60], [-20, 60], [20, 60], [60, 60], [-74, 20], [74, 20], [-30, 20], [30, 20], [0, -10]]) lampPost(lx, lz, 6);
  // the Renault waits outside the gate
  S.finish();
  for (const d of [d12, d23, r3w, r2e, controlDoor, frontDoor]) { d.unlock(); d.setOpen(true); }
  places.hq = {
    x: C.x, z: C.z, y, toWorld, code: SERVER_CODE,
    gate, gateOutside: P(30, HZ + 5, Math.PI), gateInside: P(30, HZ - 4.5, Math.PI), approach: P(31, HZ + 16, Math.PI), car: P(34, HZ + 12, 0),
    towers, cover: S.cover,
    garage: { opening: P(-65, 13.5, Math.PI), inside: P(-65, 6, Math.PI), office: P(-73, -7, Math.PI), note: { ...toWorld(-73.6, -9.3), y: y + 0.8 }, desk: P(-73.6, -8.4) },
    server: { door: serverDoor, keypadAt: P(38.6, 0, Math.PI / 2), inside: P(47, 0, Math.PI / 2), shelf, shelfBody, shelfAt: P(56, -10.2, Math.PI), hidden: { door: hiddenDoor, at: P(56, -10.2, Math.PI), strip: P(56, -13.5, Math.PI) } },
    passage: { south: P(56, -18, Math.PI), north: P(56, -54.5, -Math.PI / 2), west: P(14, -54.5, -Math.PI / 2) },
    inner: { doorW, doorC, doorE, W: P(-30, -15), C: P(0, -15), E: P(30, -15), Wout: P(-30, -12.5), Cout: P(0, -12.5), Eout: P(30, -12.5), Win: P(-30, -17.5), Cin: P(0, -17.5), Ein: P(30, -17.5) },
    command: { front: frontDoor, back: backDoor, backAt: P(13.6, -54.5, -Math.PI / 2), inside: P(4, -52, Math.PI), desk: P(0, -58.6, 0), kotzi: P(0, -59.2, 0), screenMat: bigScreenMat, frontAt: P(0, -44.6, 0) },
    rooms: [{ inside: P(0, -41), door: frontDoor, doorAt: P(0, -46.8) }, { inside: P(0, -31), door: d12, doorAt: P(0, -36.8) }, { inside: P(0, -20.5), door: d23, doorAt: P(0, -26.8) }],
    r3w, r2e, r3wAt: P(-7.0, -20.5, -Math.PI / 2), r2eAt: P(7.0, -31, Math.PI / 2),
    security: { gates: [gate1, gate2], gateAt: [P(-10.2, -20.5, -Math.PI / 2), P(-15.2, -20.5, -Math.PI / 2)], cameras: cams, breakers, corridor: P(-14, -20.5), laserMat },
    control: { door: controlDoor, doorAt: P(-19.0, -20.5, -Math.PI / 2), inside: P(-30, -25, Math.PI), arena: P(-30, -26), kotzi: P(-30, -29, 0), screenMat: ctrlScreenMat },
    eastHall: P(30, -30),
    // the escape: the alternatives, where the beams come down, where Dolev is pinned
    escape: {
      startAt: P(-30, -24, Math.PI),
      beamsW: { from: { ...toWorld(-30, -13), y: y + 4.4 }, to: { ...toWorld(-30, -13), y: y + 0.35 }, len: 6, yaw: Math.PI / 2 },
      beamsC: { from: { ...toWorld(0, -17.2), y: y + 4.2 }, to: { ...toWorld(0, -17.2), y: y + 0.35 }, len: 5, yaw: Math.PI / 2 },
      pinned: P(22, 2, Math.PI / 2), yard: P(30, 30), gate: P(30, HZ - 2),
      blasts: [P(-26, -30), P(-12, -21), P(-4, -30), P(20, -36), P(40, -24), P(10, 6), P(-10, 40), P(50, 20)],
    },
    patrols: {
      t1: [{ ...towers[0], yaw: Math.PI - 0.5 }], t2: [{ ...towers[1], yaw: Math.PI + 0.5 }],
      yardW: [P(-62, 40), P(-34, 56)], yardE: [P(56, 58), P(56, 30)], yardMid: [P(8, 42), P(-8, 34)], gateIn: [P(26, 58), P(35, 58)], hutW: [P(-45, 33)], hutE: [P(50, 33)],
      g1: [P(-70, 3), P(-58, 3)], g2: [P(-62, -8)], g3: [P(-55, 6)],
      s1: [P(47, -2), P(47, 2.5)], s2: [P(58, 0), P(70, 0)], s3: [P(67, -9.5)],
      r1: [P(-4, -41), P(4, -41)], r2: [P(-4, -30), P(4, -30)], r3: [P(-3, -21), P(3, -21)],
      eh: [P(18, -32), P(44, -32)], pass: [P(56, -36)],
      e1: [P(-24, 34)], e2: [P(18, 24)], e3: [P(44, 46)],
    },
    lamps: S.lamps, emissives: [...S.emissives, bigScreenMat, ctrlScreenMat, laserMat],
    inControl: (x, z) => x > C.x - 40 && x < C.x - 20 && z > C.z - 36 && z < C.z - 15,
    inCommand: (x, z) => Math.abs(x - C.x) < 12 && z > C.z - 62 && z < C.z - 46,
    inRoom: (k, x, z) => Math.abs(x - C.x) < 8 && z > C.z + [-46, -36, -26][k] && z < C.z + [-36, -26, -15][k],
    inside: (x, z) => Math.abs(x - C.x) < HX && Math.abs(z - C.z) < HZ,
  };
}
