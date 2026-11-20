// The Iron Base (chapter eight): Kotzi's new compound at the end of the old road. A walled yard with two
// watchtowers, containers and crates for cover, an equipment shed, a generator room behind a keypad,
// and the main building on three floors: a lobby and two store rooms on the ground, offices and a long
// walkway on the first floor, the control room on the second; stairs between the floors (the main
// flight east, a stairwell west, the back stairs east of the control room), three shutters for the
// lockdown, and a hidden door behind a shelf in the control room. Site-local: origin at the centre,
// +z south. Invented from the ground up; nothing here is a real place or how one is got into.
import * as THREE from 'three';
import { makeSite } from './compound.js';

const C = { x: 1120, z: -290 }, HX = 50, HZ = 40;
const F1 = 3.6, F2 = 7.2, BH = 10.8;            // floor heights; the building's walls
const B = { x0: -24, x1: 12, z0: -24, z1: -2 };   // the main building
export const GEN_CODE = '2580';

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const h = baseHeight(C.x, C.z);
  net.addPad({ x: C.x, z: C.z, hx: HX + 4, hz: HZ + 4, yaw: 0, h, top: 0.05, blend: 10, name: 'iron base' });
  net.addPad({ x: C.x - 3, z: C.z + HZ + 20, hx: 7, hz: 20, yaw: 0, h, top: 0.05, blend: 8, name: 'iron base approach' });
  ctx.keepOut?.push({ x: C.x, z: C.z + 10, hx: HX + 12, hz: HZ + 30 });
  ctx.ironBase = { y: h + 0.05 };
}

export function build(ctx) {
  const { places, M } = ctx;
  const { y } = ctx.ironBase;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'iron base' });
  const { L, wall, slab, door, crate, barrel, lampPost, ceilingLamp, sign, mesh, std, box, solid, tower, camera, level, stairs, toWorld } = S;
  const W = (lx, lz, ly = 0) => ({ ...toWorld(lx, lz), y: y + ly });
  const P = (lx, lz, ly = 0, yaw) => ({ ...toWorld(lx, lz), y: y + ly, ...(yaw != null ? { yaw } : {}) });
  const steel = { h: 4.2, t: 0.5, color: '#7b7f86', key: 'metal', mat: M.metal, scale: 0.4 };
  // ---------- the outer wall, the gate south, two towers ----------
  wall(-HX, HZ, HX, HZ, [{ at: HX, w: 5.6, h: 3.9 }], steel);
  wall(HX, -HZ, HX, HZ, [], steel); wall(HX, -HZ, -HX, -HZ, [], steel); wall(-HX, -HZ, -HX, HZ, [], steel);
  slab(0, -0.01, 0, HX * 2 - 1, 0.06, HZ * 2 - 1, { key: 'asphalt', mat: M.asphalt, color: '#7a7873', scale: 0.1 });
  const gate = door(0, HZ, 0, 5.4, { locked: true, color: '#2a2d33', h: 3.8 });
  sign('בסיס הברזל · כניסה אסורה', 0, 4.6, HZ + 0.3, 0, 4.6, 0.6, { bg: '#1c1f26', fg: '#ff9180' });
  const towers = [tower(-44, 34, 6.5), tower(44, 34, 6.5)];
  // ---------- the yard ----------
  const cont = (lx, lz, yaw, color) => { mesh(box(2.5, 2.6, 6.1), std({ color, roughness: 0.6, metalness: 0.3 }), lx, 1.3, lz, yaw); solid(lx, lz, 1.25, 3.05, 2.6, yaw); S.cover.push({ ...toWorld(lx, lz), w: 2.5, d: 6.1 }); };
  cont(-30, 26, 0, '#2b6a8f'); cont(-18, 18, Math.PI / 2, '#8a4b2e'); cont(20, 26, 0, '#2f7a4a'); cont(30, 12, Math.PI / 2, '#7a2b2b'); cont(-38, 6, 0, '#6b6f75');
  for (const [lx, lz] of [[-8, 26], [8, 30], [-26, 34], [26, 34], [-12, 8], [14, 6], [0, 16]]) crate(lx, lz, 1.6, 1.6, 1.3);
  for (const [lx, lz] of [[-6, 18], [-5.3, 18.6], [12, 18], [24, 2], [-40, -10], [40, 18]]) barrel(lx, lz, '#c8352d');
  // the equipment shed, east (open on its west side)
  const shedWall = { h: 3.4, t: 0.25, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 };
  wall(32, -10, 46, -10, [], shedWall); wall(46, -10, 46, 6, [], shedWall); wall(46, 6, 32, 6, [], shedWall); wall(32, 6, 32, -10, [{ at: 8, w: 3, h: 2.6 }], shedWall);
  slab(39, 3.45, -2, 14.4, 0.1, 16.4, { color: '#6b6f75' });
  for (const [lx, lz] of [[42, -7], [42, 3]]) crate(lx, lz, 2.2, 1.6, 1.2, '#6b6f75');
  ceilingLamp(39, -2, 3.4, { range: 9, intensity: 14 });
  // the generator room, north-east corner, behind a keypad
  const genWall = { h: 3.6, t: 0.3, color: '#9a9ea4' };
  wall(30, -38, 48, -38, [], genWall); wall(48, -38, 48, -24, [], genWall); wall(48, -24, 30, -24, [{ at: 9, w: 1.4, h: 2.2 }], genWall); wall(30, -24, 30, -38, [], genWall);
  slab(39, 3.65, -31, 18.4, 0.1, 14.4, { color: '#7a7d82' });
  const genDoor = door(39, -24, 0, 1.4, { locked: true, color: '#2a2d33' });
  mesh(box(3.4, 1.8, 1.8), std({ color: '#c8352d', metalness: 0.3 }), 39, 0.9, -33.5); solid(39, -33.5, 1.7, 0.9, 1.8);
  const genLamp = mesh(new THREE.SphereGeometry(0.1, 8, 6), S.redMat, 40.2, 1.95, -32.5);
  // the three levers on the north wall, and the order on a sign by the door
  const levers = [];
  for (const [i, lx] of [33.5, 36, 42].entries()) { const col = ['#2fd27a', '#e2574c', '#59c7ff'][i]; const m = mesh(box(0.16, 0.5, 0.16), std({ color: col, emissive: col, emissiveIntensity: 0.3 }), lx, 1.3, -37.7); levers.push({ i, color: ['ירוק', 'אדום', 'כחול'][i], ...toWorld(lx, -37), y: y + 1.3, mesh: m }); }
  sign('ירוק · כחול · אדום', 39, 2.6, -24.35, Math.PI, 3, 0.5, { bg: '#1c1f26', fg: '#ffd9a0' });
  sign('גנרטור', 39, 3.0, -23.65, 0, 1.6, 0.4, { bg: '#a7452c' });
  ceilingLamp(39, -31, 3.6, { range: 10, intensity: 16 });
  // ---------- the main building: three floors ----------
  const ext = { h: BH, t: 0.4, color: '#c2bdb2', key: 'plaster', mat: M.plaster, scale: 0.3 };
  wall(B.x0, B.z1, B.x1, B.z1, [{ at: 18, w: 2.4, h: 2.8 }], ext);   // south: the main door at x = -6
  wall(B.x1, B.z0, B.x1, B.z1, [], ext); wall(B.x1, B.z0, B.x0, B.z0, [], ext); wall(B.x0, B.z0, B.x0, B.z1, [], ext);
  const roof = mesh(box(B.x1 - B.x0 + 0.8, 0.25, B.z1 - B.z0 + 0.8), std({ color: '#5d5f63', roughness: 0.8 }), (B.x0 + B.x1) / 2, BH + 0.12, (B.z0 + B.z1) / 2);
  slab((B.x0 + B.x1) / 2, -0.004, (B.z0 + B.z1) / 2, B.x1 - B.x0 - 0.4, 0.02, B.z1 - B.z0 - 0.4, { key: 'plaster', mat: M.plaster, color: '#bfbab0', scale: 0.5 });
  sign('בסיס הברזל', -6, 3.4, B.z1 + 0.25, 0, 3.4, 0.6, { bg: '#2b2f36', fg: '#ff9180' });
  for (const lx of [-18, -8, 4]) for (const ly of [F1 + 1.6, F2 + 1.6]) mesh(new THREE.PlaneGeometry(2.4, 1.0), std({ color: '#1a2330', emissive: '#ffd9a0', emissiveIntensity: 0.1 }), lx, ly, B.z1 + 0.22, 0);
  // ground floor: the lobby west, two store rooms north, the corridor east with the main stairs
  const inner = (floor, h = 3.5) => ({ h, t: 0.2, floor, color: '#d8d3c6' });
  wall(-4, B.z0, -4, B.z1, [{ at: 16, w: 2.4, h: 2.6 }], inner(0));      // lobby | corridor: shutter 1 at z = -8
  wall(B.x0, -14, -4, -14, [{ at: 6, w: 1.2, h: 2.2 }, { at: 16, w: 1.4, h: 2.2 }], inner(0)); // store rooms A (x -24..-12) and B
  wall(-12, B.z0, -12, -14, [], inner(0));
  const shutter1 = door(-4, -8, Math.PI / 2, 2.4, { color: '#4a4e55', h: 2.6 });
  const lockDoor = door(-18, -14, 0, 1.2, { color: '#5d636b' });
  for (const [lx, lz] of [[-20, -20], [-16, -22], [-9, -20]]) crate(lx, lz, 1.4, 1.4, 1.1);
  mesh(box(3, 0.9, 0.8), std({ color: '#3a3f47' }), -14, 0.45, -5); solid(-14, -5, 1.5, 0.4, 0.9); S.cover.push({ ...toWorld(-14, -5), w: 3, d: 0.8 }); // the lobby counter
  for (const [lx, lz] of [[2, -23], [-2.6, -13]]) crate(lx, lz, 1.5, 1.5, 1.2);
  const s1 = stairs(8, -3.4, Math.PI, { rise: F1, run: 6.6, width: 2.2, steps: 12, color: '#9a948a' });
  for (const [lx, lz] of [[-14, -8], [-14, -19], [4, -8], [4, -19]]) ceilingLamp(lx, lz, F1 - 0.1, { range: 10, intensity: 18 });
  // first floor: two slabs round the stairwell, a rail at its edge, the walkway, an office (breaker B), the west stairwell
  level(-8.7, -13, 15.3, 11, F1, { name: 'iron base 1' });                 // x -24 .. 6.6
  level(9.3, -17, 2.7, 7, F1, { name: 'iron base 1 east' });              // x 6.6 .. 12, z -24 .. -10
  const rail1 = { h: 1.1, t: 0.12, floor: F1, color: '#3a3d44', key: 'paint', mat: M.paint, scale: 0.5 };
  wall(6.6, -10, 6.6, -2.2, [], rail1); wall(9.2, -10, 11.8, -10, [], rail1);
  wall(-17.4, -14, -17.4, -4, [], inner(F1, 3.4)); wall(B.x0, -4, -17.4, -4, [{ at: 3.3, w: 2.2, h: 2.4 }], inner(F1, 3.4)); wall(B.x0, -14, -17.4, -14, [], inner(F1, 3.4));
  const shutter2 = door(-20.7, -4, 0, 2.2, { color: '#4a4e55', h: 2.4, floor: F1 });
  const s2 = stairs(-20.7, -5, Math.PI, { rise: F2 - F1, run: 6.6, width: 2.2, steps: 12, floor: F1, color: '#9a948a' });
  wall(-4, B.z0, -4, -16, [], inner(F1, 3.4)); wall(4, B.z0, 4, -16, [], inner(F1, 3.4)); wall(-4, -16, 4, -16, [{ at: 4, w: 1.4, h: 2.2 }], inner(F1, 3.4));
  const breakerB = { ...W(3.5, -20, F1 + 1.3), lx: 3.5, lz: -20 };
  mesh(box(0.12, 0.6, 0.4), std({ color: '#6b6f75', metalness: 0.4 }), 3.8, F1 + 1.3, -20, Math.PI / 2);
  mesh(box(1.4, 0.75, 0.7), std({ color: '#7a5a3a' }), -1, F1 + 0.38, -22.5); solid(-1, -22.5, 0.7, 0.35, 0.78);
  for (const [lx, lz] of [[-10, -12], [-6, -20], [0, -5.4]]) { mesh(box(1.4, 1.1, 1.4), std({ color: '#b8955e' }), lx, F1 + 0.55, lz); ctx.cols.addBox(C.x + lx, C.z + lz, 0.7, 0.7, 0, y + F1 - 0.3, y + F1 + 1.1); S.cover.push({ ...toWorld(lx, lz), w: 1.4, d: 1.4, y: y + F1 }); }
  // the crawl behind the shelf on the first floor's east side is the back stairs, up to the control room's far side
  const s3 = stairs(10, -13.4, Math.PI, { rise: F2 - F1, run: 6.6, width: 2.2, steps: 12, floor: F1, color: '#8f887b' });
  for (const [lx, lz] of [[-12, -9], [0, -10], [-2, -20], [9, -20]]) ceilingLamp(lx, lz, F2 - 0.1, { range: 10, intensity: 16 });
  // second floor: the slabs round the two stairwells, the hallway, the control room
  level(-4.4, -13, 13, 11, F2, { name: 'iron base 2' });                  // x -17.4 .. 8.6
  level(-20.7, -17.8, 3.3, 6.2, F2, { name: 'iron base 2 west' });        // x -24 .. -17.4, z -24 .. -11.6
  level(10.3, -22, 1.7, 2, F2, { name: 'iron base 2 east' });             // x 8.6 .. 12, z -24 .. -20
  level(10.3, -7.7, 1.7, 5.7, F2, { name: 'iron base 2 south' });         // x 8.6 .. 12, z -13.4 .. -2
  const rail2 = { ...rail1, floor: F2 };
  wall(-17.4, -11.6, -17.4, -2.2, [], rail2); wall(B.x0 + 0.2, -11.6, -21.9, -11.6, [], rail2); wall(-19.5, -11.6, -17.4, -11.6, [], rail2);
  wall(8.6, -20, 8.6, -13.4, [], rail2); wall(8.6, -13.4, 11.8, -13.4, [], rail2);
  const room = inner(F2, 3.4);
  wall(-14, B.z0, -14, -12, [{ at: 6, w: 1.6, h: 2.3 }], room);           // west: the control room's door at z = -18
  wall(-14, -12, 4, -12, [], room);
  wall(4, B.z0, 4, -12, [{ at: 3, w: 1.2, h: 2.2 }], room);               // east: the hidden door at z = -21
  const controlDoor = door(-14, -18, Math.PI / 2, 1.6, { color: '#4a4e55', h: 2.3, floor: F2 });
  const hiddenDoor = door(4, -21, Math.PI / 2, 1.2, { locked: true, color: '#7a5a3a', floor: F2 });
  // the shelf in front of the hidden door (Erez moves it)
  const shelf = mesh(box(0.6, 2.2, 2.0), std({ color: '#6b5a44', roughness: 0.8 }), 3.4, F2 + 1.1, -21);
  const shelfBody = ctx.cols.addBox(C.x + 3.4, C.z - 21, 0.3, 1.0, 0, y + F2 - 0.3, y + F2 + 2.2);
  // consoles, the big screen, the desk with the note
  mesh(box(10, 0.9, 0.8), std({ color: '#3a3f47' }), -5, F2 + 0.45, -23.2); ctx.cols.addBox(C.x - 5, C.z - 23.2, 5, 0.4, 0, y + F2 - 0.3, y + F2 + 0.9);
  const screenMat = std({ color: '#0b1220', emissive: '#59c7ff', emissiveIntensity: 0.15 });
  const screen = mesh(new THREE.PlaneGeometry(7, 2.4), screenMat, -5, F2 + 2.2, -23.75, 0);
  for (const dx of [-8, -2, 2]) mesh(box(1.4, 0.8, 0.06), std({ color: '#0b1220', emissive: '#59c7ff', emissiveIntensity: 0.4 }), dx, F2 + 1.4, -23.5);
  mesh(box(1.6, 0.06, 0.8), std({ color: '#7a5a3a' }), -9, F2 + 0.8, -15); ctx.cols.addBox(C.x - 9, C.z - 15, 0.8, 0.4, 0, y + F2 - 0.3, y + F2 + 0.8);
  mesh(box(0.3, 0.02, 0.2), std({ color: '#f1efe6' }), -8.6, F2 + 0.84, -15.1); // the note
  sign('חדר בקרה', -15, F2 + 2.6, -18, -Math.PI / 2, 1.8, 0.4, { bg: '#1c1f26', fg: '#59c7ff' });
  for (const [lx, lz] of [[-5, -18], [-12, -5], [6, -18], [6, -6], [-20.7, -20]]) ceilingLamp(lx, lz, BH - 0.1, { range: 10, intensity: 18 });
  // ---------- the yard's lamps and cameras ----------
  for (const [lx, lz] of [[-30, 38], [30, 38], [-46, 10], [46, 10], [-30, -36], [20, -36], [0, 2]]) lampPost(lx, lz, 6);
  const cams = [camera(-HX + 0.6, 3.6, 20, Math.PI / 2 + 0.2, { range: 13 }), camera(HX - 0.6, 3.6, 20, -Math.PI / 2 - 0.2, { range: 13 })];
  for (const c of cams) c.setOn(false); // not part of the plan here: the guards are
  // an emergency light (red) in the control room, for the blackout
  S.finish();
  const shutters = [shutter1, shutter2, controlDoor];
  for (const d of [shutter1, shutter2, controlDoor, lockDoor]) { d.unlock(); d.setOpen(true); }
  places.ironBase = {
    x: C.x, z: C.z, y, toWorld, roof, F1, F2,
    gate, gateOutside: P(0, HZ + 4.5, 0, Math.PI), gateInside: P(0, HZ - 4, 0, Math.PI), approach: P(-3, HZ + 30, 0, Math.PI),
    towers, cover: S.cover, cameras: cams,
    store: { inside: P(39, -2) },
    generator: { door: genDoor, keypadAt: P(39, -22.6, 0, Math.PI), inside: P(39, -29, 0, Math.PI), machine: P(39, -31.4, 0, Math.PI), lamp: genLamp, levers, code: GEN_CODE, lampOn: (on) => { genLamp.material = on ? S.greenMat : S.redMat; } },
    main: { door: P(-6, -0.4, 0, Math.PI), lobby: P(-14, -9, 0, Math.PI), corridor: P(2, -8, 0, Math.PI), s1, s2, s3, f1: P(-6, -8, F1, Math.PI), f1office: P(0, -19, F1), breakerB, stairwell: P(-20.7, -9, F1, Math.PI), f2: P(-10, -6, F2, Math.PI), hall2: P(-15.8, -18, F2, Math.PI / 2), east2: P(6.5, -21, F2), building: B },
    shutters, shutterAt: [P(-4, -8), P(-20.7, -4, F1), P(-14, -18, F2)],
    control: { door: controlDoor, inside: P(-6, -17, F2, Math.PI), desk: P(-8.8, -14.2, F2), note: W(-8.6, -15.1, F2 + 0.84), screen, screenMat, consoles: P(-5, -22, F2) },
    hidden: { door: hiddenDoor, shelf, shelfBody, at: P(2.6, -21, F2, Math.PI / 2), out: P(6.4, -21, F2, Math.PI / 2) },
    lockRoom: { door: lockDoor, inside: P(-18, -19), spots: [P(-20, -17), P(-17, -18), P(-15, -20)], outside: P(-18, -11) },
    // where a guard stands or walks (y on an upper floor)
    patrols: {
      t1: [{ ...towers[0], yaw: Math.PI - 0.5 }], t2: [{ ...towers[1], yaw: Math.PI + 0.5 }],
      yardW: [P(-36, 30), P(-36, 14), P(-22, 12)], yardE: [P(36, 30), P(36, 16), P(22, 16)], yardN: [P(-10, 4), P(10, 4)], yardS: [P(-18, 32), P(16, 32)],
      gateIn: [P(-4, 34), P(4, 34)], store: [P(38, 0), P(38, -6)], yardMid: [P(0, 12), P(-6, 22)], shedEast: [P(26, -14), P(26, -30)],
      lobby1: [P(-20, -6), P(-8, -6)], lobby2: [P(-15, -12), P(-21, -12)], corr1: [P(0, -12), P(0, -4)], corr2: [P(6, -20), P(-1, -20)],
      f1walk: [P(-14, -8, F1), P(2, -8, F1)], f1office: [P(-2, -19, F1), P(2, -19, F1)], f1east: [P(7, -22, F1), P(5.4, -12, F1)],
      f2hall: [P(-16, -21, F2), P(-16, -13.5, F2)], f2south: [P(-10, -6, F2), P(4, -6, F2)],
    },
    lamps: S.lamps, emissives: [...S.emissives, screenMat],
    insideBuilding: (x, z) => x > C.x + B.x0 && x < C.x + B.x1 && z > C.z + B.z0 && z < C.z + B.z1,
    inControl: (x, z, yy) => yy > y + F2 - 0.5 && x > C.x - 14 && x < C.x + 4 && z > C.z - 24 && z < C.z - 12,
    tick(camera) { const lx = camera.position.x - C.x, lz = camera.position.z - C.z; roof.visible = !(camera.position.y < y + BH + 1 && lx > B.x0 - 1 && lx < B.x1 + 1 && lz > B.z0 - 1 && lz < B.z1 + 1); },
  };
}
