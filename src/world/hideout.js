// The hideout (chapter eight, "מבצע סופת אש"): a long warehouse on the plain east of Kotzi's fort where
// the gang lay low after the rescue. A hall 44 × 28 with a table for eight at the west end, shelves and
// crates, an office in the north-west corner, a mezzanine along the north wall (3.2 m up) with stairs at
// both ends and a rubble ramp in the middle, a partition under the mezzanine, the main door in the south
// wall (where Kotzi's blast comes in) and the exit door in the east wall that opens with a wheel, into a
// yard where the Renault waits. The escape is laid out here: where the beams come down, where the
// blasts go off, where the fires burn. Site-local: origin at the hall's centre, +z south. Invented.
import * as THREE from 'three';
import { makeSite } from './compound.js';

const C = { x: 640, z: -60 }, HX = 22, HZ = 14, H = 6, MEZZ = 3.2;

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const h = baseHeight(C.x + 8, C.z);
  net.addPad({ x: C.x + 8, z: C.z, hx: HX + 26, hz: HZ + 8, yaw: 0, h, top: 0.05, blend: 10, name: 'hideout' }); // the hall and the yard east of it
  ctx.keepOut?.push({ x: C.x + 8, z: C.z, hx: HX + 34, hz: HZ + 16 });
  ctx.hideout = { y: h + 0.05 };
}

export function build(ctx) {
  const { places, M } = ctx;
  const { y } = ctx.hideout;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'hideout' });
  const { L, wall, slab, door, crate, barrel, ceilingLamp, lampPost, sign, mesh, std, box, solid, level, stairs, ramp, toWorld } = S;
  const brick = { h: H, t: 0.4, color: '#9c8f80', key: 'stone', mat: M.stone, scale: 0.35 };
  // ---------- the hall ----------
  wall(-HX, HZ, HX, HZ, [{ at: HX - 8, w: 4.2, h: 4.0 }], brick);                 // south: the main door at x = -8
  wall(HX, -HZ, HX, HZ, [{ at: HZ + 4, w: 2.2, h: 2.5 }], brick);                 // east: the exit door at z = 4
  wall(HX, -HZ, -HX, -HZ, [], brick); wall(-HX, -HZ, -HX, HZ, [], brick);
  slab(0, -0.005, 0, HX * 2 - 0.4, 0.02, HZ * 2 - 0.4, { key: 'asphalt', mat: M.asphalt, color: '#6f6c66', scale: 0.12 });
  const roof = mesh(box(HX * 2 + 0.8, 0.2, HZ * 2 + 0.8), std({ color: '#5d5f63', roughness: 0.8 }), 0, H + 0.1, 0);
  // high windows (they shatter in the blast)
  const windowMat = std({ color: '#1a2330', emissive: '#ffd9a0', emissiveIntensity: 0, roughness: 0.3 }); windowMat.userData.night = 0.9;
  const windows = [];
  for (const lx of [-15, -5, 5, 15]) { mesh(new THREE.PlaneGeometry(3.2, 1.2), windowMat, lx, 4.6, HZ - 0.22, Math.PI); windows.push({ ...toWorld(lx, HZ - 0.3), y: y + 4.6 }); }
  for (const lx of [-15, -5, 5, 15]) { mesh(new THREE.PlaneGeometry(3.2, 1.2), windowMat, lx, 4.6, -HZ + 0.22, 0); windows.push({ ...toWorld(lx, -HZ + 0.3), y: y + 4.6 }); }
  sign('מחסן 7', HX + 0.25, 3.4, -3, Math.PI / 2, 2.2, 0.5, { bg: '#2b2f36' });
  // ---------- the table for eight, west ----------
  mesh(box(1.6, 0.08, 7), std({ color: '#7a5a3a', roughness: 0.7 }), -15, 0.78, 0); solid(-15, 0, 0.8, 3.5, 0.82);
  for (const sz of [-3, 3]) for (const sx of [-0.65, 0.65]) mesh(box(0.08, 0.74, 0.08), std({ color: '#3a3d44' }), -15 + sx, 0.37, sz);
  const seats = [];
  for (const [k, sz] of [-2.6, -0.9, 0.9, 2.6].entries()) for (const side of [-1, 1]) {
    const sx = -15 + side * 1.35;
    mesh(box(0.5, 0.45, 0.5), std({ color: '#3a3d44', roughness: 0.6 }), sx, 0.22, sz);
    seats.push({ ...L(sx, sz, side < 0 ? Math.PI / 2 : -Math.PI / 2), k: seats.length });
  }
  mesh(box(0.5, 0.3, 0.4), std({ color: '#c8352d' }), -15.2, 0.97, -1.2); // a box of pizza
  // ---------- the mezzanine along the north wall: 3.2 m up, z -14 .. -7 ----------
  const mezz = level(0, -10.5, HX - 0.2, 3.5, MEZZ, { key: 'paint', mat: M.paint, color: '#5c5e62', name: 'hideout mezzanine' });
  const rail = { h: 1.1, t: 0.12, color: '#3a3d44', key: 'paint', mat: M.paint, scale: 0.5, floor: MEZZ };
  wall(-HX + 0.2, -7, -19.2, -7, [], rail); wall(-16.8, -7, 7.8, -7, [], rail); wall(10.2, -7, 16.8, -7, [], rail); wall(19.2, -7, HX - 0.2, -7, [], rail);
  for (const lx of [-12, -4, 6, 14]) { mesh(box(0.3, MEZZ, 0.3), std({ color: '#3a3d44', metalness: 0.4 }), lx, MEZZ / 2, -7.25); solid(lx, -7.25, 0.15, 0.15, MEZZ - 0.2); }
  const stairsW = stairs(-18, -1, Math.PI, { rise: MEZZ, run: 6, width: 2.2, steps: 11, color: '#8f887b' });
  const stairsE = stairs(18, -1, Math.PI, { rise: MEZZ, run: 6, width: 2.2, steps: 11, color: '#8f887b' });
  // the partition under the mezzanine at x = 2 (shelving, floor to mezzanine): under it there is no way east
  wall(2, -HZ + 0.2, 2, -7.3, [], { h: MEZZ - 0.15, t: 0.3, color: '#6b6f75', key: 'metal', mat: M.metal, scale: 0.5 });
  // ---------- the office, north-west, under the mezzanine ----------
  wall(-14, -HZ + 0.2, -14, -7.6, [{ at: 3.2, w: 1.2, h: 2.2 }], { h: MEZZ - 0.15, t: 0.15 });
  wall(-HX + 0.2, -7.6, -14, -7.6, [], { h: MEZZ - 0.15, t: 0.15 });
  const officeDoor = door(-14, -10.6, Math.PI / 2, 1.2, { locked: false, color: '#5d636b' });
  mesh(box(1.4, 0.75, 0.7), std({ color: '#7a5a3a' }), -18, 0.38, -12.2); solid(-18, -12.2, 0.7, 0.35, 0.78);
  const kit = mesh(box(0.4, 0.25, 0.3), std({ color: '#e8e4dc', emissive: '#ff4a4a', emissiveIntensity: 0.25 }), -18, 0.9, -12.2);
  ceilingLamp(-18, -10.5, MEZZ, { range: 8, intensity: 14 });
  // ---------- shelves, crates, barrels: the hall's clutter (two-metre passages everywhere) ----------
  for (const [lx, lz] of [[-6, -4], [-6, 8], [8, 10], [12, -2], [16, 10], [-10, 11], [4, 5]]) crate(lx, lz, 1.6, 1.6, 1.3);
  for (const [lx, lz] of [[-2, 12], [-1.3, 12.5], [10, 12.6], [20.6, 12.4], [6, -9.5]]) barrel(lx, lz, '#8f2b24');
  for (const lz of [-11, -9]) { mesh(box(5, 2.4, 0.6), std({ color: '#6b6f75', metalness: 0.3 }), 10, 1.2, lz); solid(10, lz, 2.5, 0.3, 2.4); } // racks under the mezzanine, east
  mesh(box(1.6, 1.2, 0.9), std({ color: '#c8352d', metalness: 0.3 }), -20.5, 0.6, 9); solid(-20.5, 9, 0.8, 0.45, 1.2); // the generator
  // ---------- the rubble ramp from the mezzanine down to the east half (east of the first beam) ----------
  const rubble = ramp(9, -1, Math.PI, { rise: MEZZ, run: 6, width: 2.4, color: '#7d766a' });
  for (const [lx, lz, s] of [[10.6, -2, 0.5], [7.4, -3.4, 0.4], [10.8, -5, 0.6]]) mesh(box(s * 2, s, s * 1.6), std({ color: '#6f6a62', roughness: 0.95 }), lx, s / 2, lz, lx);
  // ---------- the exit door, east, and the wheel that opens it ----------
  const exitDoor = door(HX, 4, Math.PI / 2, 2.2, { locked: true, color: '#3a3d44', h: 2.5 });
  const wheel = mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 18), std({ color: '#c8352d', metalness: 0.4 }), HX - 0.35, 1.3, 6.4, Math.PI / 2);
  sign('יציאה', HX - 0.25, 2.9, 4, -Math.PI / 2, 1.2, 0.35, { bg: '#2fa055' });
  // ---------- lamps ----------
  for (const [lx, lz] of [[-15, 0], [-4, 2], [8, 2], [18, 4]]) ceilingLamp(lx, lz, H, { range: 14, intensity: 26 });
  for (const lx of [-12, 0, 12]) ceilingLamp(lx, -10.5, H, { range: 9, intensity: 14 });
  // ---------- the yard, east: the Renault ----------
  slab(34, -0.004, 0, 24, 0.02, 24, { key: 'asphalt', mat: M.asphalt, color: '#5f5d58', scale: 0.1 });
  for (const [lx, lz] of [[30, -10], [42, 10]]) lampPost(lx, lz, 6);
  for (const [lx, lz] of [[27, 11], [28.4, 11.3]]) barrel(lx, lz, '#3a4b8f');
  S.finish();
  const W = (lx, lz, ly = 0) => ({ ...toWorld(lx, lz), y: y + ly });
  places.hideout = {
    x: C.x, z: C.z, y, toWorld, roof, windows, windowMat,
    hall: L(0, 0), mainDoor: W(-8, HZ - 1.5), mainDoorOpening: { ...toWorld(-8, HZ), w: 4.2 },
    table: L(-15, 0), seats,
    mezz: { y: y + MEZZ, west: W(-15, -10.5, MEZZ), mid: W(-2, -10.5, MEZZ), east: W(15, -10.5, MEZZ) },
    stairsW, stairsE, rubble, officeDoor, office: W(-18, -10.5), kit: { ...toWorld(-18, -12.2), y: y + 0.9, mesh: kit },
    exitDoor, exitAt: { ...L(20.4, 1.8, Math.PI / 2), y }, wheel: { ...toWorld(HX - 0.9, 6.4), y: y + 1.3, mesh: wheel }, coverAt: { ...L(15, 8, Math.PI / 2), y },
    outside: { ...L(HX + 3, 4, Math.PI / 2), y }, yard: { ...L(30, 0, Math.PI / 2), y }, car: { ...L(32, 4, Math.PI / 2), y },
    // the way through: the first beam closes the ground east of x = 2, the second the mezzanine east of x = 12
    beams: [
      { from: W(2, 3.5, H - 0.4), to: W(2, 3.5, 0.3), len: 21.4, yaw: 0, w: 0.6, h: 0.6, trigger: { lx: -9, ground: true } },
      { from: W(12, -10.5, H - 0.4), to: W(12, -10.5, MEZZ + 0.3), len: 7.2, yaw: 0, w: 0.5, h: 0.5, trigger: { lx: 3, mezz: true } },
    ],
    // where the blasts go off on the way (each with its warning), and the fires that burn along the walls
    blasts: [
      { ...W(-7, 5), size: 1.0, trigger: { lx: -11, ground: true } },
      { ...W(-8, -10.5, MEZZ), size: 0.9, trigger: { lx: -13, mezz: true } },
      { ...W(4, -12.6, MEZZ), size: 0.9, trigger: { lx: -1, mezz: true } },
      { ...W(15, 0), size: 1.0, trigger: { lx: 11, ground: true, east: true } },
    ],
    fires: [W(-14, 12.6), W(-3, 12.6), W(-21, 4), W(0, -13), W(9, 12.8), W(-8, HZ - 0.6), W(-6.6, HZ - 0.8)],
    patrols: {},
    lamps: S.lamps, emissives: [...S.emissives, windowMat],
    inside: (x, z) => Math.abs(x - C.x) < HX && Math.abs(z - C.z) < HZ,
    tick(camera) { const l = { x: camera.position.x - C.x, z: camera.position.z - C.z }; roof.visible = !(camera.position.y < y + H + 1 && Math.abs(l.x) < HX + 1 && Math.abs(l.z) < HZ + 1); },
  };
}
