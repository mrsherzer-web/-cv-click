// Kotzi's depot (chapter seven, the first base): a fenced yard off the quarry road with a guard house
// at the gate, a warehouse with a locked office and a hidden passage behind the shelves, two cameras
// over the yard, and the back way out that leads on toward the fort. Invented, like everything of
// Kotzi's. Depot-local: origin at the centre, +z south (away from the road), yaw 0.
import * as THREE from 'three';
import { makeSite } from './compound.js';

const C = { x: 200, z: 165 }, HX = 24, HZ = 18;

export function layout(ctx) {
  const { net, places } = ctx;
  const road = places.eastRoad; if (!road) return;
  const p = road.nearest(C.x, C.z - 40);
  net.addPad({ x: C.x, z: C.z, hx: HX + 3, hz: HZ + 3, yaw: 0, h: p.h, top: 0.05, blend: 8, name: 'depot' });
  net.addPad({ x: C.x, z: C.z - HZ - 12, hx: 8, hz: 12, yaw: 0, h: p.h, top: 0.05, blend: 6, name: 'depot approach' });
  ctx.keepOut?.push({ x: C.x, z: C.z, hx: HX + 8, hz: HZ + 20 });
  ctx.depot = { y: p.h + 0.05, road };
}

export function build(ctx) {
  const { places, M } = ctx;
  const { y, road } = ctx.depot;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'depot' });
  const { L, wall, slab, crate, barrel, lampPost, ceilingLamp, sign, door, camera, mesh, std, box, solid } = S;
  const metal = { h: 2.4, t: 0.08, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 };
  // the fence with the gate (north) and the back gap (east, behind the warehouse)
  wall(-HX, -HZ, HX, -HZ, [{ at: HX, w: 4.4, h: 2.4 }], metal);
  wall(HX, -HZ, HX, HZ, [{ at: HZ + 12, w: 2.0, h: 2.4 }], metal);
  wall(HX, HZ, -HX, HZ, [], metal); wall(-HX, HZ, -HX, -HZ, [], metal);
  for (const sx of [-2.2, 2.2]) S.batch.add('paint', M.paint, box(0.2, 2.8, 0.2), S.at(sx, 1.4, -HZ), { color: new THREE.Color('#2a2d33') });
  slab(0, -0.01, 0, HX * 2, 0.06, HZ * 2, { key: 'asphalt', mat: M.asphalt, color: '#9c9a93', scale: 0.1 });
  // the guard house by the gate: two rooms, a door to the yard, a window to the gate
  const G = { x: -12, z: -11, w: 10, d: 7 };
  wall(G.x - 5, G.z - 3.5, G.x + 5, G.z - 3.5, [], { h: 3 });
  wall(G.x + 5, G.z - 3.5, G.x + 5, G.z + 3.5, [], { h: 3 });
  wall(G.x + 5, G.z + 3.5, G.x - 5, G.z + 3.5, [{ at: 2.5, w: 1.2, h: 2.2 }], { h: 3 }); // door on the south side, east end
  wall(G.x - 5, G.z + 3.5, G.x - 5, G.z - 3.5, [], { h: 3 });
  wall(G.x, G.z - 3.5, G.x, G.z + 3.5, [{ at: 3.5, w: 1.0, h: 2.1 }], { h: 3, t: 0.14 }); // the inner wall
  slab(G.x, 3.05, G.z, 10.4, 0.1, 7.4, { color: '#c9c4b7' });
  mesh(box(1.4, 0.05, 0.7), std({ color: '#7a5a3a' }), G.x + 2.5, 0.75, G.z - 1.5); solid(G.x + 2.5, G.z - 1.5, 0.7, 0.35, 0.8);
  mesh(box(0.5, 0.35, 0.05), std({ color: '#0b1220', emissive: '#59c7ff', emissiveIntensity: 0.5 }), G.x + 2.5, 1.0, G.z - 1.7); // the monitor
  ceilingLamp(G.x - 2.5, G.z, 3); ceilingLamp(G.x + 2.5, G.z, 3);
  // the warehouse: a hall, the locked office in its north-east corner, shelves along the east wall
  const W = { x: 8, z: 4, w: 26, d: 18 };
  const wx0 = W.x - W.w / 2, wx1 = W.x + W.w / 2, wz0 = W.z - W.d / 2, wz1 = W.z + W.d / 2;
  wall(wx0, wz0, wx1, wz0, [{ at: 6, w: 2.4, h: 2.6 }], { h: 5 });           // north: the main door
  wall(wx1, wz0, wx1, wz1, [{ at: W.d - 3, w: 1.0, h: 2.1 }], { h: 5 });     // east: the hidden way out, behind the shelves
  wall(wx1, wz1, wx0, wz1, [], { h: 5 }); wall(wx0, wz1, wx0, wz0, [], { h: 5 });
  slab(W.x, 5.05, W.z, W.w + 0.4, 0.1, W.d + 0.4, { color: '#7a7d82' });
  slab(W.x, -0.005, W.z, W.w - 0.2, 0.02, W.d - 0.2, { key: 'plaster', mat: M.plaster, color: '#bfbab0', scale: 0.5 });
  // the office: 7 x 6 in the north-east corner, door on its west side
  const O = { x0: wx1 - 7, z0: wz0, x1: wx1, z1: wz0 + 6 };
  wall(O.x0, O.z0, O.x0, O.z1, [{ at: 3, w: 1.1, h: 2.2 }], { h: 3, t: 0.14 });
  wall(O.x0, O.z1, O.x1, O.z1, [], { h: 3, t: 0.14 });
  slab((O.x0 + O.x1) / 2, 3.05, (O.z0 + O.z1) / 2, 7.2, 0.1, 6.2, { color: '#c9c4b7' });
  const officeDoor = door(O.x0, O.z0 + 3, Math.PI / 2, 1.1, { locked: true });
  mesh(box(1.6, 0.05, 0.8), std({ color: '#7a5a3a' }), O.x1 - 2, 0.75, O.z1 - 1.5); solid(O.x1 - 2, O.z1 - 1.5, 0.8, 0.4, 0.8);
  mesh(box(0.34, 0.02, 0.24), std({ color: '#2a2d33' }), O.x1 - 2, 0.78, O.z1 - 1.5); // the laptop with the lists
  mesh(box(0.6, 1.8, 0.5), std({ color: '#3a3f47', metalness: 0.4 }), O.x1 - 0.4, 0.9, O.z0 + 1); solid(O.x1 - 0.4, O.z0 + 1, 0.3, 0.25, 1.8);
  ceilingLamp((O.x0 + O.x1) / 2, (O.z0 + O.z1) / 2, 3);
  // shelves along the east wall, south of the office: the hidden door is behind the last one
  for (let k = 0; k < 3; k++) { const z = O.z1 + 1.5 + k * 3.2; mesh(box(0.6, 2.4, 2.8), std({ color: '#6b6f75', metalness: 0.3 }), wx1 - 0.5, 1.2, z); if (k < 2) solid(wx1 - 0.5, z, 0.3, 1.4, 2.4); S.cover.push({ ...S.toWorld(wx1 - 0.5, z), w: 0.6, d: 2.8 }); }
  const hidden = door(wx1, wz0 + W.d - 3, 0, 1.0, { locked: true, color: '#8f949a' }); // the way out, east
  // crates and pallets in the hall, cover for the fight
  for (const [lx, lz] of [[wx0 + 4, wz0 + 5], [wx0 + 9, wz0 + 9], [W.x, W.z + 3], [wx0 + 15, wz1 - 4], [wx0 + 6, wz1 - 3]]) crate(lx, lz, 1.6, 1.6, 1.2);
  for (const [lx, lz] of [[wx0 + 12, wz0 + 4], [wx0 + 12.7, wz0 + 4.5]]) barrel(lx, lz);
  for (const [lx, lz] of [[wx0 + 7, wz0 + 6], [W.x, wz0 + 6], [wx1 - 9, wz0 + 10], [wx0 + 7, wz1 - 6], [W.x + 3, wz1 - 6]]) ceilingLamp(lx, lz, 5, { range: 14, intensity: 30 });
  // the yard: crates, two cameras, lamps
  for (const [lx, lz] of [[-18, 2], [-14, 8], [-4, 14], [4, 15]]) crate(lx, lz, 1.4, 1.4, 1.1);
  const cams = [camera(-HX + 0.3, 3.2, 6, Math.PI / 2 + 0.3), camera(wx0 - 0.3, 4.6, wz0, -Math.PI / 2 - 0.4)];
  for (const [lx, lz] of [[-20, -16], [20, -16], [-20, 16], [20, 16]]) lampPost(lx, lz, 5.5);
  sign('קוצי בע״מ · מחסן 1', 0, 3.0, -HZ - 0.1, Math.PI, 3.6, 0.55, { bg: '#2f5e8f' });
  S.finish();
  const p = road.at(road.nearest(C.x, C.z - 40).s);
  places.depot = {
    x: C.x, z: C.z, y, toWorld: S.toWorld,
    parking: { x: p.x + p.nx * 4.5, z: p.z + p.nz * 4.5, yaw: Math.atan2(p.tx, p.tz), y: p.h, r: 6 },
    gate: L(0, -HZ - 3, 0), gateInside: L(0, -HZ + 3, 0),
    guardHouse: { door: L(G.x + 2.5, G.z + 4.6, Math.PI), inside: L(G.x + 2.5, G.z + 1, 0), monitor: { ...S.toWorld(G.x + 2.5, G.z - 1.5), y: y + 1 } },
    warehouse: { door: L(wx0 + 6, wz0 - 1.5, 0), inside: L(wx0 + 6, wz0 + 3, 0), center: L(W.x, W.z) },
    office: { door: officeDoor, at: L(O.x0 - 1.2, O.z0 + 3, Math.PI / 2), inside: L(O.x0 + 3.5, O.z0 + 3, 0), laptop: { ...S.toWorld(O.x1 - 2, O.z1 - 1.5), y: y + 0.8 } },
    hidden: { door: hidden, at: L(wx1 - 1.4, wz0 + W.d - 3, Math.PI / 2), out: L(wx1 + 2.5, wz0 + W.d - 3, Math.PI / 2), shelf: L(wx1 - 1.4, O.z1 + 1.5 + 2 * 3.2, Math.PI / 2) },
    back: L(HX + 3, HZ - 6, Math.PI / 2),
    cameras: cams,
    patrols: {
      gate: [L(-4, -14), L(4, -14), L(4, -10), L(-4, -10)],
      yard: [L(-16, 12), L(16, 12), L(16, 8)],
      house: [L(G.x - 2.5, G.z - 1), L(G.x - 2.5, G.z + 2)],
      hallN: [L(wx0 + 4, wz0 + 3), L(wx1 - 9, wz0 + 3), L(wx1 - 9, wz0 + 8)],
      hallS: [L(wx0 + 4, wz1 - 3), L(W.x + 4, wz1 - 3), L(W.x + 4, wz1 - 8)],
      office: [L(O.x0 + 2, O.z0 + 4), L(O.x1 - 1.5, O.z0 + 4.5)],
    },
    cover: S.cover, lamps: S.lamps, emissives: S.emissives,
  };
}
