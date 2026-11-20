// The way into Kotzi's fort (chapter seven): a covered passage from a shed at the end of the quarry
// road, down and along to the fort's west wall. Kotzi laid it with traps: a corridor of pressure
// plates, a door that locks behind you (Ido finds the side way), a room whose shutter comes down on a
// clock, a switch puzzle, and a pair of valves that must be turned together. Invented; nothing here
// shows how any real place is got into. Local: origin at the shed, +z south, yaw 0.
import * as THREE from 'three';
import { makeSite } from './compound.js';

const C = { x: 331, z: 122 };     // the shed door; the passage runs south, then east to the fort

export function layout(ctx) {
  const { net, places } = ctx;
  const road = places.eastRoad; if (!road) return;
  const e = road.at(road.length);
  net.addPad({ x: C.x, z: C.z + 22, hx: 10, hz: 28, yaw: 0, h: e.h, top: 0.05, blend: 8, name: 'passage south' });
  net.addPad({ x: C.x + 22, z: C.z + 44, hx: 26, hz: 8, yaw: 0, h: e.h, top: 0.05, blend: 8, name: 'passage east' });
  net.addPad({ x: C.x, z: C.z - 6, hx: 10, hz: 8, yaw: 0, h: e.h, top: 0.05, blend: 6, name: 'shed' });
  ctx.keepOut?.push({ x: C.x + 10, z: C.z + 24, hx: 36, hz: 40 });
  ctx.traps = { y: e.h + 0.05, end: e };
}

export function build(ctx) {
  const { places, M } = ctx;
  const { y, end } = ctx.traps;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'passage' });
  const { L, wall, slab, door, plate, ceilingLamp, sign, mesh, std, box, solid, crate, barrel } = S;
  const W = 6, H = 3.2; // the passage is six wide
  const grey = { h: H, color: '#9a9ea4', key: 'plaster', mat: M.plaster, scale: 0.3 };
  // the shed over the hatch
  wall(-4, -5, 4, -5, [], grey); wall(4, -5, 4, 1, [], grey); wall(4, 1, -4, 1, [{ at: 4, w: 1.6, h: 2.3 }], grey); wall(-4, 1, -4, -5, [], grey);
  slab(0, H + 0.05, -2, 8.4, 0.1, 6.4, { color: '#7a7d82' });
  sign('מחסן כלים · קוצי', 0, 2.6, 1.1, 0, 2.8, 0.5, { bg: '#2f5e8f' });
  ceilingLamp(0, -2, H);
  // ---------- leg 1: south, z 1 .. 44: the plates (z 6..22), the locking door (z 24), the side way, the clock room (z 30..42) ----------
  wall(-W / 2, 1, -W / 2, 44, [{ at: 20, w: 1.2, h: 2.2 }, { at: 26, w: 1.2, h: 2.2 }], grey); // west wall: the side way in at z = 21 (before the door), back in at z = 27 (past it)
  wall(W / 2, 1, W / 2, 44, [], grey);
  slab(0, H + 0.05, 22.5, W + 0.6, 0.1, 43, { color: '#7a7d82' });
  slab(0, -0.005, 22.5, W - 0.2, 0.02, 43, { key: 'plaster', mat: M.plaster, color: '#bfbab0', scale: 0.5 });
  // the plates: a 3 x 5 field; the safe ones are the mission's secret
  const plates = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) plates.push({ r, c, ...plate(-1.9 + c * 1.9, 7 + r * 2.4, 1.6, 1.8) });
  for (let r = 0; r < 5; r++) mesh(box(0.1, 0.05, 1.0), std({ color: '#9aa3ad', roughness: 0.5 }), 1.9 + 0.62, 0.045, 7 + r * 2.4); // the small mark Ido saw: a pale stripe beside the safe column (east, the player's left going south)
  sign('זהירות · רצפה', 0, 2.5, 4.2, Math.PI, 2.4, 0.45, { bg: '#a7452c' });
  // the door that locks behind you, at z = 24; the side passage from the west door around to z = 30
  const trapDoor = door(0, 24, 0, W - 0.2, { locked: false, color: '#5d636b' });
  trapDoor.setOpen(true);
  wall(-W / 2 - 6, 19, -W / 2 - 6, 29, [], grey); wall(-W / 2 - 6, 19, -W / 2, 19, [], grey); wall(-W / 2 - 6, 29, -W / 2, 29, [], grey);
  slab(-W / 2 - 3, H + 0.05, 24, 6.4, 0.1, 10.6, { color: '#7a7d82' });
  const sideIn = door(-W / 2, 21, Math.PI / 2, 1.2, { locked: true, color: '#8f949a' });     // from the plates' side, Ido's
  const sideOut = door(-W / 2, 27, Math.PI / 2, 1.2, { locked: false, color: '#8f949a' });   // back into the passage, past the locked door
  sideOut.setOpen(true);
  // the clock room: z 32..42, the shutter at z 42 comes down on the clock
  const shutter = door(0, 42, 0, W - 0.2, { locked: false, color: '#a7452c' });
  for (const [lx, lz] of [[-1.5, 34], [1.6, 37], [-1.2, 40]]) crate(lx, lz, 1.4, 1.4, 1.0);
  sign('30', 0, 2.6, 41.8, Math.PI, 1.0, 0.6, { bg: '#1c1f26', fg: '#ff6a6a', size: 180 });
  for (const z of [8, 14, 20, 27, 35, 41]) ceilingLamp(0, z, H);
  // ---------- the turn east: z 44..50, x -3..3, then leg 2 east: x 3 .. 46 at z 44..50 ----------
  wall(-W / 2, 44, -W / 2, 50, [], grey); wall(-W / 2, 50, 46, 50, [], grey); wall(W / 2, 44, 46, 44, [], grey);
  slab(23, H + 0.05, 47, 46 + W + 0.6, 0.1, W + 0.6, { color: '#7a7d82' });
  slab(23, -0.005, 47, 46 + W - 0.2, 0.02, W - 0.2, { key: 'plaster', mat: M.plaster, color: '#bfbab0', scale: 0.5 });
  // the switch room: x 10..24; three panels on the north wall, the order on a sign on the south wall; the door at x = 24
  const panels = [];
  for (const [i, lx] of [12, 17, 22].entries()) { mesh(box(0.6, 0.8, 0.12), std({ color: ['#e2574c', '#2fd27a', '#59c7ff'][i], roughness: 0.4 }), lx, 1.3, 44.08); panels.push({ i, color: ['אדום', 'ירוק', 'כחול'][i], ...S.toWorld(lx, 44.6), y: y + 1.3 }); }
  sign('ירוק · כחול · אדום', 17, 1.9, 49.9, Math.PI, 3.2, 0.5, { bg: '#1c1f26', fg: '#f3efe6' });
  const puzzleDoor = door(24, 47, Math.PI / 2, W - 0.2, { locked: true, color: '#5d636b' });
  // the valves room: x 26..44; the two valves on opposite walls, far apart, the exit door at x = 46 into the fort
  const valves = [{ ...S.toWorld(28, 44.6), y: y + 1.2, lx: 28, lz: 44.6 }, { ...S.toWorld(43, 49.4), y: y + 1.2, lx: 43, lz: 49.4 }];
  for (const v of valves) { mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 20), std({ color: '#c8352d', metalness: 0.4 }), v.lx, 1.2, v.lz); mesh(box(0.1, 0.1, 0.5), std({ color: '#6b6f75', metalness: 0.5 }), v.lx, 1.2, v.lz + (v.lz < 47 ? 0.25 : -0.25)); }
  for (const [lx, lz] of [[32, 46], [36, 48.5], [40, 45.5]]) barrel(lx, lz, '#3a4b8f');
  const exitDoor = door(46, 47, Math.PI / 2, W - 0.2, { locked: true, color: '#2a2d33' });
  sign('שסתומים · לסובב יחד', 35, 2.5, 49.9, Math.PI, 3.2, 0.5, { bg: '#1c1f26', fg: '#ffd9a0' });
  for (const x of [6, 14, 22, 30, 38, 44]) ceilingLamp(x, 47, H);
  S.finish();
  places.passage = {
    x: C.x, z: C.z, y, toWorld: S.toWorld,
    parking: { x: end.x + end.nx * 4.5 - end.tx * 6, z: end.z + end.nz * 4.5 - end.tz * 6, yaw: Math.atan2(end.tx, end.tz), y: end.h, r: 6 },
    shed: { door: L(0, 2.5, 0), inside: L(0, -2, 0) },
    plates, platesStart: L(0, 4, 0), platesEnd: L(0, 23, 0),
    trapDoor, sideIn, sideOut, sideAt: L(-W / 2 + 1.2, 21, -Math.PI / 2), sideRoom: L(-W / 2 - 3, 24, 0), sideInAt: L(-W / 2 - 0.9, 21, 0), sideOutAt: L(-W / 2 - 0.9, 27, 0), afterDoor: L(0, 27.5, 0), beforeDoor: L(0, 22.5, 0),
    clock: { start: L(0, 32, 0), end: L(0, 43.5, 0), shutter },
    turn: L(0, 47, Math.PI / 2),
    panels, puzzleDoor, puzzleAt: L(17, 47, 0), afterPuzzle: L(25.5, 47, Math.PI / 2),
    valves, exitDoor, exitAt: L(44.5, 47, Math.PI / 2), out: L(48, 47, Math.PI / 2),
    cover: S.cover, lamps: S.lamps, emissives: S.emissives,
  };
}
