// Kotzi's fort (chapter seven, the main compound): a walled yard with a gate to the north and two
// watchtowers, the passage's hatch in the west wall, a generator shed, a long main building of three
// halls, a control room up on a mound behind it (the ramp is the way up), a covered tunnel from the
// main building east to the holding block — an antechamber and, behind a door with a code, the cell
// where Nehorai is kept. Invented from the ground up; no real place, and nothing about how a real
// building is got into. Fort-local: origin at the centre, +z south, yaw 0.
import * as THREE from 'three';
import { makeSite } from './compound.js';

const C = { x: 420, z: 200 }, HX = 50, HZ = 45;
export const CODE = '4719';

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  // the fort stands on a plateau at the height the passage arrives at (the land falls away to the south-east)
  const h = ctx.traps?.y != null ? ctx.traps.y - 0.05 : baseHeight(C.x, C.z);
  net.addPad({ x: C.x, z: C.z, hx: HX + 4, hz: HZ + 4, yaw: 0, h, top: 0.05, blend: 10, name: 'fort' });
  net.addPad({ x: C.x, z: C.z - HZ - 14, hx: 12, hz: 14, yaw: 0, h, top: 0.05, blend: 8, name: 'fort approach' });
  net.addPad({ x: C.x, z: C.z + 30, hx: 9, hz: 7, yaw: 0, h: h + 3.5, top: 0.05, blend: 9, name: 'control mound' }); // the mound: its slopes are the ramp
  ctx.keepOut?.push({ x: C.x, z: C.z, hx: HX + 12, hz: HZ + 24 });
  ctx.fort = { y: h + 0.05 };
}

export function build(ctx) {
  const { places, M } = ctx;
  const { y } = ctx.fort;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'fort' });
  const { L, wall, slab, door, camera, tower, crate, barrel, lampPost, ceilingLamp, sign, mesh, std, box, solid } = S;
  const stone = { h: 4.5, t: 0.6, color: '#b5ad9c', key: 'stone', mat: M.stone, scale: 0.4 };
  // ---------- the outer wall: the gate north, the hatch west ----------
  wall(-HX, -HZ, HX, -HZ, [{ at: HX, w: 5.5, h: 4.0 }], stone);
  wall(HX, -HZ, HX, HZ, [], stone); wall(HX, HZ, -HX, HZ, [], stone);
  wall(-HX, HZ, -HX, -HZ, [{ at: HZ + 31, w: 6.4, h: 3.2 }], stone); // at z = -31: where the passage comes through
  slab(0, -0.01, 0, HX * 2 - 1, 0.06, HZ * 2 - 1, { key: 'asphalt', mat: M.asphalt, color: '#8e8c86', scale: 0.1 });
  const gate = door(0, -HZ, 0, 5.4, { locked: true, color: '#2a2d33', h: 3.8 });
  for (const sx of [-2.9, 2.9]) S.batch.add('stone', M.stone, box(1.0, 5.2, 1.0), S.at(sx, 2.6, -HZ), { uv: 'world', uvScale: 0.4 });
  sign('קוצי · אזור סגור', 0, 4.6, -HZ - 0.55, Math.PI, 4.4, 0.6, { bg: '#1c1f26', fg: '#ffd9a0' });
  const towers = [tower(-44, -38, 6.5), tower(44, -38, 6.5)];
  // ---------- the yard: cover, a dark car, cameras, lamps ----------
  for (const [lx, lz] of [[-30, -30], [-26, -24], [-12, -36], [8, -30], [20, -22], [32, -34], [-34, 0], [34, -4], [-18, 30], [18, 32]]) crate(lx, lz, 1.6, 1.6, 1.2);
  for (const [lx, lz] of [[-8, -24], [-7.2, -23.4], [26, -12]]) barrel(lx, lz);
  S.batch.add('paint', M.paint, box(4.2, 1.3, 1.9), S.at(14, 0.75, -38, 0.2), { color: new THREE.Color('#1c1f26') }); solid(14, -38, 2.1, 1.0, 1.4, 0.2); S.cover.push({ ...S.toWorld(14, -38), w: 4.2, d: 1.9 });
  const cams = [camera(-HX + 0.6, 3.4, -20, Math.PI / 2 + 0.2, { range: 13 }), camera(HX - 0.6, 3.4, -20, -Math.PI / 2 - 0.2, { range: 13 }), camera(0, 3.6, -6.2, Math.PI, { range: 12 })];
  for (const [lx, lz] of [[-30, -42], [30, -42], [-46, 20], [46, 20], [-30, 42], [30, 42], [0, 20]]) lampPost(lx, lz, 6);
  // ---------- the generator shed (west): the switch for the cameras ----------
  const G = { x: -40, z: 18 };
  wall(G.x - 3, G.z - 2.5, G.x + 3, G.z - 2.5, [], { h: 2.8, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 });
  wall(G.x + 3, G.z - 2.5, G.x + 3, G.z + 2.5, [{ at: 2.5, w: 1.2, h: 2.2 }], { h: 2.8, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 });
  wall(G.x + 3, G.z + 2.5, G.x - 3, G.z + 2.5, [], { h: 2.8, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 });
  wall(G.x - 3, G.z + 2.5, G.x - 3, G.z - 2.5, [], { h: 2.8, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 });
  slab(G.x, 2.85, G.z, 6.4, 0.1, 5.4, { color: '#7a7d82' });
  mesh(box(1.6, 1.2, 0.9), std({ color: '#c8352d', metalness: 0.3 }), G.x - 1.5, 0.6, G.z); solid(G.x - 1.5, G.z, 0.8, 0.45, 1.2);
  const breaker = mesh(box(0.4, 0.6, 0.12), std({ color: '#6b6f75', metalness: 0.4 }), G.x - 2.9, 1.4, G.z - 1.5, Math.PI / 2);
  const breakerLamp = mesh(new THREE.SphereGeometry(0.06, 8, 6), S.greenMat, G.x - 2.8, 1.75, G.z - 1.5);
  ceilingLamp(G.x, G.z, 2.8);
  sign('גנרטור', G.x + 3.1, 2.3, G.z - 0.5, Math.PI / 2, 1.6, 0.4, { bg: '#a7452c' });
  // ---------- the main building: three halls in a row, doors between, the main door north ----------
  const B = { x0: -22, x1: 22, z0: -6, z1: 16 }, BH = 5;
  wall(B.x0, B.z0, B.x1, B.z0, [{ at: 22, w: 2.6, h: 2.8 }], { h: BH });                  // north: the main door
  wall(B.x1, B.z0, B.x1, B.z1, [{ at: 14, w: 2.0, h: 2.4 }], { h: BH });                  // east: the tunnel's mouth at z = 8
  wall(B.x1, B.z1, B.x0, B.z1, [], { h: BH }); wall(B.x0, B.z1, B.x0, B.z0, [], { h: BH });
  wall(-8, B.z0, -8, B.z1, [{ at: 11, w: 1.6, h: 2.4 }], { h: BH, t: 0.2 });                // west hall | centre, door at z = 5
  wall(8, B.z0, 8, B.z1, [{ at: 11, w: 1.6, h: 2.4 }], { h: BH, t: 0.2 });                 // centre | east hall
  slab(0, BH + 0.05, 5, 44.6, 0.1, 22.6, { color: '#7a7d82' });
  slab(0, -0.005, 5, 43.6, 0.02, 21.6, { key: 'plaster', mat: M.plaster, color: '#bfbab0', scale: 0.5 });
  const westDoor = door(-8, 5, Math.PI / 2, 1.6, { locked: true }), eastDoor = door(8, 5, Math.PI / 2, 1.6, { locked: true });
  // shelves and crates in the side halls, a counter in the centre
  for (const [lx, lz] of [[-18, 0], [-13, 10], [-16, 13], [13, -1], [18, 9], [12, 12]]) crate(lx, lz, 1.8, 1.8, 1.3);
  for (const k of [0, 1]) { mesh(box(0.6, 2.6, 4), std({ color: '#6b6f75', metalness: 0.3 }), -20.5, 1.3, 5 + k * 6); solid(-20.5, 5 + k * 6, 0.3, 2, 2.6); }
  mesh(box(5, 0.9, 0.8), std({ color: '#d9d5cc' }), 0, 0.45, 12); solid(0, 12, 2.5, 0.4, 0.9); S.cover.push({ ...S.toWorld(0, 12), w: 5, d: 0.8 });
  for (const [lx, lz] of [[-15, 0], [-15, 10], [0, 0], [0, 10], [15, 0], [15, 10]]) ceilingLamp(lx, lz, BH, { range: 14, intensity: 30 });
  sign('קוצי בע״מ · המחסן המרכזי', 0, 3.6, B.z0 - 0.1, Math.PI, 4.4, 0.6, { bg: '#2f5e8f' });
  // ---------- the control room on the mound (z 23..37), its door to the north (down the ramp) ----------
  const R = { x0: -7, x1: 7, z0: 24, z1: 36 }, RY = 3.5;
  for (const [a, b, c, d, op] of [[R.x0, R.z0, R.x1, R.z0, [{ at: 7, w: 1.4, h: 2.2 }]], [R.x1, R.z0, R.x1, R.z1, []], [R.x1, R.z1, R.x0, R.z1, []], [R.x0, R.z1, R.x0, R.z0, []]]) {
    // walls on the mound: drawn at the mound's height, colliders too
    const len = Math.hypot(c - a, d - b), yaw = Math.atan2(c - a, d - b);
    let s = 0;
    const piece = (s0, s1, h0, h1) => { if (s1 - s0 < 0.01 || h1 - h0 < 0.01) return; const mx = a + Math.sin(yaw) * (s0 + s1) / 2, mz = b + Math.cos(yaw) * (s0 + s1) / 2; S.batch.add('plaster', M.plaster, box(0.3, h1 - h0, s1 - s0), S.at(mx, RY + (h0 + h1) / 2, mz, yaw), { color: new THREE.Color('#d8d3c6'), uv: 'world', uvScale: 0.3 }); if (h0 === 0) ctx.cols.addSegment(C.x + a + Math.sin(yaw) * s0, C.z + b + Math.cos(yaw) * s0, C.x + a + Math.sin(yaw) * s1, C.z + b + Math.cos(yaw) * s1, 0.3, y + RY - 1, y + RY + 3); };
    for (const o of op) { piece(s, o.at - o.w / 2, 0, 3); piece(o.at - o.w / 2, o.at + o.w / 2, o.h, 3); s = o.at + o.w / 2; }
    piece(s, len, 0, 3);
  }
  slab(0, RY + 3.05, 30, 14.6, 0.1, 12.6, { color: '#7a7d82' });
  slab(0, RY - 0.005, 30, 13.6, 0.02, 11.6, { key: 'plaster', mat: M.plaster, color: '#bfbab0', scale: 0.5 });
  // consoles, screens, the note with the code on the desk
  mesh(box(6, 0.9, 0.7), std({ color: '#3a3f47' }), 0, RY + 0.45, 34.5); ctx.cols.addBox(C.x, C.z + 34.5, 3, 0.35, 0, y + RY - 1, y + RY + 0.9);
  for (const dx of [-2, 0, 2]) mesh(box(1.4, 0.8, 0.06), std({ color: '#0b1220', emissive: '#59c7ff', emissiveIntensity: 0.5 }), dx, RY + 1.6, 35.3);
  mesh(box(0.3, 0.02, 0.2), std({ color: '#f1efe6' }), 1.2, RY + 0.92, 34.3); // the note
  mesh(box(1.4, 0.05, 0.7), std({ color: '#7a5a3a' }), -4.5, RY + 0.75, 27); ctx.cols.addBox(C.x - 4.5, C.z + 27, 0.7, 0.35, 0, y + RY - 1, y + RY + 0.8);
  S.lamps.push({ ...S.toWorld(0, 30), y: y + RY + 2.6, inside: true, range: 12, intensity: 26 }); mesh(new THREE.SphereGeometry(0.13, 10, 8), S.bulbMat, 0, RY + 2.7, 30);
  sign('חדר בקרה', 0, RY + 2.5, R.z0 - 0.2, Math.PI, 2.0, 0.45, { bg: '#1c1f26', fg: '#59c7ff' });
  // ---------- the tunnel: covered, from the main building east to the holding block ----------
  wall(B.x1, 5, 30, 5, [], { h: 3, color: '#8a8580', key: 'stone', mat: M.stone, scale: 0.4 });
  wall(B.x1, 11, 30, 11, [], { h: 3, color: '#8a8580', key: 'stone', mat: M.stone, scale: 0.4 });
  slab(26, 3.05, 8, 8.6, 0.1, 6.6, { key: 'stone', mat: M.stone, color: '#6f6a64', scale: 0.4 });
  for (const x of [24, 28]) ceilingLamp(x, 8, 3, { range: 9, intensity: 18 });
  sign('המנהרה', B.x1 + 0.4, 2.6, 8, -Math.PI / 2, 1.4, 0.4, { bg: '#1c1f26', fg: '#ffd9a0' });
  // ---------- the holding block: antechamber (x 36..46) and the cell (x 46..54), the code door between ----------
  const K = { x0: 30, x1: 48, z0: 0, z1: 16 };
  wall(K.x0, K.z0, K.x1, K.z0, [], { h: 4 }); wall(K.x1, K.z0, K.x1, K.z1, [], { h: 4 }); wall(K.x1, K.z1, K.x0, K.z1, [], { h: 4 });
  wall(K.x0, K.z1, K.x0, K.z0, [{ at: 8, w: 2.0, h: 2.4 }], { h: 4 }); // from the tunnel, at z = 8
  wall(40, K.z0, 40, K.z1, [{ at: 8, w: 1.4, h: 2.3 }], { h: 4, t: 0.3 });
  slab(39, 4.05, 8, 18.6, 0.1, 16.6, { color: '#7a7d82' });
  slab(39, -0.005, 8, 17.6, 0.02, 15.6, { key: 'plaster', mat: M.plaster, color: '#b4b6ba', scale: 0.5 });
  const cellDoor = door(40, 8, Math.PI / 2, 1.4, { locked: true, color: '#2a2d33' });
  mesh(box(0.3, 0.4, 0.1), std({ color: '#1c1f26' }), 39.8, 1.3, 9.2, Math.PI / 2); mesh(box(0.18, 0.24, 0.02), std({ color: '#0b1220', emissive: '#59c7ff', emissiveIntensity: 0.6 }), 39.72, 1.32, 9.2, Math.PI / 2); // the keypad
  for (const [lx, lz] of [[32, 3], [37, 13], [33, 12]]) crate(lx, lz, 1.5, 1.5, 1.1);
  mesh(box(3, 0.9, 0.9), std({ color: '#3a3f47' }), 35, 0.45, 2); solid(35, 2, 1.5, 0.45, 0.9); S.cover.push({ ...S.toWorld(35, 2), w: 3, d: 0.9 });
  // the cell: a bed, a chair, a small window high up
  mesh(box(2.0, 0.5, 0.9), std({ color: '#8a93a6' }), 46, 0.3, 3); solid(46, 3, 1.0, 0.45, 0.6);
  mesh(box(0.5, 0.5, 0.5), std({ color: '#7a5a3a' }), 44, 0.25, 11); solid(44, 11, 0.25, 0.25, 0.5);
  mesh(new THREE.PlaneGeometry(1.0, 0.6), std({ color: '#cfe0ee', emissive: '#ffd9a0', emissiveIntensity: 0, transparent: true, opacity: 0.8 }), 47.98, 3.0, 8, -Math.PI / 2);
  for (const [lx, lz] of [[35, 8], [44, 8]]) ceilingLamp(lx, lz, 4, { range: 10, intensity: 24 });
  sign('בלי כניסה', 39.9, 2.6, 6.5, -Math.PI / 2, 1.2, 0.4, { bg: '#a7452c' });
  S.finish();
  places.fort = {
    x: C.x, z: C.z, y, toWorld: S.toWorld, code: CODE,
    gate, gateOutside: L(0, -HZ - 4, 0), gateInside: L(0, -HZ + 4, 0),
    hatch: L(-HX + 3, -31, Math.PI / 2), hatchOutside: L(-HX - 3, -31, Math.PI / 2),
    towers, cameras: cams,
    generator: { door: L(G.x + 4.5, G.z, -Math.PI / 2), inside: L(G.x, G.z, 0), breaker: { ...S.toWorld(G.x - 2.6, G.z - 1.5), y: y + 1.4 }, lamp: breakerLamp },
    main: { door: L(0, B.z0 - 1.6, 0), inside: L(0, B.z0 + 3, 0), centre: L(0, 5, 0), west: L(-15, 5, 0), east: L(15, 5, 0), westDoor, eastDoor, westDoorAt: L(-9.4, 5, Math.PI / 2), eastDoorAt: L(6.6, 5, -Math.PI / 2), tunnelMouth: L(B.x1 - 1.5, 8, Math.PI / 2) },
    control: { foot: L(0, 21, Math.PI), door: L(0, 22.6, Math.PI), inside: L(0, 30, 0), note: { ...S.toWorld(1.2, 34.3), y: y + RY + 0.9 }, y: y + RY },
    tunnel: { start: L(23, 8, Math.PI / 2), end: L(29, 8, Math.PI / 2) },
    holding: { door: L(K.x0 - 1.5, 8, Math.PI / 2), inside: L(34, 8, Math.PI / 2), cellDoor, keypadAt: L(38.6, 8, Math.PI / 2), cell: L(44, 8, 0), nehorai: L(46, 4.2, Math.PI), kotzi: L(37, 6, -Math.PI / 2), bed: L(46, 3) },
    patrols: {
      t1: [{ ...towers[0], yaw: 0.6 }], t2: [{ ...towers[1], yaw: -0.6 }],
      yardW: [L(-36, -36), L(-36, -8), L(-20, -8)], yardE: [L(36, -36), L(36, -8), L(20, -8)], yardN: [L(-12, -40), L(12, -40), L(12, -28)], yardS: [L(-20, 36), L(20, 36), L(20, 24)],
      gate: [L(-3, -40), L(3, -40)], gen: [L(-34, 10), L(-34, 26)],
      hallW: [L(-18, 2), L(-11, 12)], hallC: [L(-4, 0), L(4, 10)], hallE: [L(12, 2), L(19, 12)], tunnel: [L(24, 8), L(28.5, 8)],
      hold1: [L(32, 4), L(38, 4)], hold2: [L(32, 12), L(38, 12)], hold3: [L(34, 7), L(34, 9)],
    },
    cover: S.cover, lamps: S.lamps, emissives: S.emissives,
  };
}
