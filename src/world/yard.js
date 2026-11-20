// The container yard at the south end of Hadera's beach (chapter six): where "the Cipher" — a rival
// invented for the game — keeps his people, and where Dolev is held in the lit office container in
// the middle. Two rows of shipping containers make lanes to fight through (paint, as always), a metal
// fence with a gate faces the beach car park to the north, pole lamps light it at night. The office
// container is walkable: thin walls with colliders, a doorway, a roof that hides when the camera is
// inside. No real place. Yard-local axes: the origin is the yard centre, +z runs south (away from the
// car park), yaw 0.
import * as THREE from 'three';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';

const CX = -1413, CZ = 220;                 // the yard centre (world); the beach car park ends at z = 188
const HX = 17, HZ = 23;                     // the fenced yard
const OFFICE = { x: 0, z: 9, w: 6, d: 2.6, h: 2.6 };
const CONTAINERS = [ // [lx, lz, yaw, color, stacked]
  [-11, -12, 0, '#a7452c', 1], [-11, -5.5, 0, '#2f5e8f', 0], [-11, 1, 0, '#4f7a3d', 1],
  [11, -12, 0, '#2f5e8f', 0], [11, -5.5, 0, '#8a8f95', 1], [11, 1, 0, '#a7452c', 0],
  [-4, -14, Math.PI / 2, '#8a8f95', 0], [4, -14, Math.PI / 2, '#4f7a3d', 1],
  [-5.5, -2, 0, '#a7452c', 0], [5.5, -2, 0, '#2f5e8f', 0],
  [-10, 15, Math.PI / 2, '#4f7a3d', 0], [10, 15, Math.PI / 2, '#8a8f95', 1], [0, 18, Math.PI / 2, '#a7452c', 0],
];
let site = null;

export function layout(ctx) {
  const { net, places } = ctx;
  const H = places.hadera;                    // set by hadera.layout(): the city's base height and kerb
  const top = H.y + H.KERB;
  net.addPad({ x: CX, z: CZ, hx: HX + 3, hz: HZ + 3, yaw: 0, h: H.y, top: H.KERB, blend: 8, name: 'container yard' });
  // the strip between the car park and the gate, so the walk in is level
  net.addPad({ x: CX, z: CZ - HZ - 4, hx: 8, hz: 5, yaw: 0, h: H.y, top: H.KERB, blend: 6, name: 'yard approach' });
  ctx.keepOut?.push({ x: CX, z: CZ, hx: HX + 6, hz: HZ + 10 });
  site = { top };
}

export function build(ctx) {
  const { group: parent, M, cols, places } = ctx;
  const Y = site.top;
  const group = new THREE.Group();
  group.name = 'yard';
  parent.add(group);
  const batch = new Batch();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const at = (lx, ly, lz, ry = 0) => mat4(CX + lx, Y + ly, CZ + lz, ry);
  const toWorld = (lx, lz) => ({ x: CX + lx, z: CZ + lz });
  const toLocal = (x, z) => ({ x: x - CX, z: z - CZ });
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const bulbMat = std({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0 });
  const screenMat = std({ color: '#0b1220', emissive: '#59c7ff', emissiveIntensity: 0, roughness: 0.3 });
  const floodMat = std({ color: '#eef4ff', emissive: '#dbe9ff', emissiveIntensity: 0 });
  bulbMat.userData.night = 1.6; screenMat.userData.night = 1.4; floodMat.userData.night = 1.2;
  const dark = tint('#2a2d33');

  // ---------- the ground: concrete slab, a sandy edge ----------
  batch.add('asphalt', M.asphalt, box(HX * 2, 0.06, HZ * 2), at(0, -0.01, 0), { uv: 'world', uvScale: 0.1, color: tint('#9c9a93') });
  batch.add('paint', M.paint, box(0.12, 0.07, HZ * 2 - 4), at(0, 0.03, 0), { color: tint('#e8e6de') }); // a faded lane line

  // ---------- the fence: corrugated panels on posts, the gate to the car park ----------
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    batch.add('metal', M.metal, box(0.06, 2.2, len), at((x0 + x1) / 2, 1.1, (z0 + z1) / 2, yaw), { color: tint('#8f949a'), uv: 'world', uvScale: 0.5 });
    cols.addSegment(CX + x0, CZ + z0, CX + x1, CZ + z1, 0.1, Y - 1, Y + 2.2);
    for (let s = 0; s <= len; s += 3) batch.add('paint', M.paint, box(0.1, 2.4, 0.1), at(x0 + Math.sin(yaw) * s, 1.2, z0 + Math.cos(yaw) * s), { color: dark });
  };
  fence(-HX, -HZ, -2.2, -HZ); fence(2.2, -HZ, HX, -HZ);        // north: the gate in the middle
  fence(-HX, HZ, HX, HZ); fence(-HX, -HZ, -HX, HZ); fence(HX, -HZ, HX, HZ);
  for (const sx of [-2.2, 2.2]) batch.add('paint', M.paint, box(0.2, 2.6, 0.2), at(sx, 1.3, -HZ), { color: dark });
  batch.add('paint', M.paint, box(4.6, 0.16, 0.2), at(0, 2.6, -HZ), { color: dark });
  // the gate leaf, swung open inward
  batch.add('metal', M.metal, box(0.06, 2.0, 2.0), at(2.2, 1.0, -HZ + 1.0, 0), { color: tint('#8f949a'), uv: 'world', uvScale: 0.5 });
  cols.addSegment(CX + 2.2, CZ - HZ, CX + 2.2, CZ - HZ + 2.0, 0.1, Y - 1, Y + 2);

  // ---------- containers ----------
  const cover = [];
  const container = (lx, lz, yaw, color, stacked) => {
    const w = 6, h = 2.6, d = 2.44;
    batch.add('metal', M.metal, box(w, h, d), at(lx, h / 2, lz, yaw), { color: tint(color), uv: 'world', uvScale: 0.5 });
    for (const sx of [-w / 2 + 0.05, w / 2 - 0.05]) batch.add('paint', M.paint, box(0.1, h, d + 0.04), at(lx + sx * Math.cos(yaw), h / 2, lz - sx * Math.sin(yaw), yaw), { color: dark });
    if (stacked) {
      batch.add('metal', M.metal, box(w, h, d), at(lx, h * 1.5 + 0.05, lz, yaw), { color: tint(color === '#a7452c' ? '#2f5e8f' : '#a7452c'), uv: 'world', uvScale: 0.5 });
    }
    cols.addBox(CX + lx, CZ + lz, w / 2, d / 2, yaw, Y - 1, Y + h * (stacked ? 2 : 1));
    cover.push({ ...toWorld(lx, lz), yaw, w, d });
  };
  for (const c of CONTAINERS) container(...c);
  // a few barrels and a pallet stack for extra cover
  for (const [lx, lz] of [[-7, 6], [-6.3, 6.4], [7, 7], [0, -8]]) { batch.add('paint', M.paint, new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), at(lx, 0.45, lz), { color: tint('#3a4b8f') }); cols.addCircle(CX + lx, CZ + lz, 0.32, Y - 1, Y + 0.9); }
  batch.add('wood', M.plaster, box(1.2, 0.9, 1.0), at(6, 0.45, -8), { color: tint('#b8955e') }); cols.addBox(CX + 6, CZ - 8, 0.6, 0.5, 0, Y - 1, Y + 0.9);
  cover.push({ ...toWorld(6, -8), yaw: 0, w: 1.2, d: 1 });

  // ---------- the office container: walls with a doorway, a window, the inside ----------
  const O = OFFICE, hw = O.w / 2, hd = O.d / 2;
  const seg = (x0, z0, x1, z1, hh = O.h, y = 0) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    batch.add('metal', M.metal, box(0.08, hh, len), at((x0 + x1) / 2, y + hh / 2, (z0 + z1) / 2, yaw), { color: tint('#d8d3c6'), uv: 'world', uvScale: 0.5 });
    if (y === 0) cols.addSegment(CX + x0, CZ + z0, CX + x1, CZ + z1, 0.1, Y - 1, Y + hh);
  };
  const oz0 = O.z - hd, oz1 = O.z + hd;
  seg(-hw, oz0, -0.6, oz0); seg(0.6, oz0, hw, oz0); seg(-0.6, oz0, 0.6, oz0, O.h - 2.0, 2.0); // the door faces the gate (north)
  seg(-hw, oz1, hw, oz1); seg(-hw, oz0, -hw, oz1); seg(hw, oz0, hw, oz1);
  batch.add('paint', M.paint, box(O.w + 0.1, 0.06, O.d + 0.1), at(O.x, 0.03, O.z), { color: tint('#4a4d52') });
  const roof = new THREE.Mesh(box(O.w + 0.1, 0.1, O.d + 0.1), std({ color: '#c9c4b7', roughness: 0.8 })); roof.position.set(CX + O.x, Y + O.h + 0.05, CZ + O.z); group.add(roof);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), std({ color: '#cfe0ee', emissive: '#ffd9a0', emissiveIntensity: 0, transparent: true, opacity: 0.8 })); win.position.set(CX + 1.8, Y + 1.6, CZ + oz0 - 0.03); win.rotation.y = Math.PI; group.add(win);
  win.material.userData.night = 0.9;
  // inside: a table with the laptop, a chair for Dolev, a lamp, a crate
  const mesh = (geo, mat, lx, ly, lz, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(CX + lx, Y + ly, CZ + lz); m.rotation.y = ry; group.add(m); return m; };
  mesh(box(1.4, 0.05, 0.7), std({ color: '#7a5a3a', roughness: 0.7 }), -1.2, 0.75, O.z); for (const [dx, dz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) mesh(box(0.05, 0.75, 0.05), std({ color: '#2a2d33' }), -1.2 + dx, 0.37, O.z + dz);
  cols.addBox(CX - 1.2, CZ + O.z, 0.7, 0.35, 0, Y - 1, Y + 0.8);
  const laptop = mesh(box(0.34, 0.02, 0.24), std({ color: '#2a2d33' }), -1.2, 0.79, O.z); const screen = mesh(new THREE.PlaneGeometry(0.33, 0.22), screenMat, -1.2, 0.92, O.z - 0.12, 0); screen.rotation.x = -0.25;
  mesh(box(0.45, 0.05, 0.45), std({ color: '#3a3f47' }), 1.6, 0.45, O.z + 0.3); for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) mesh(box(0.04, 0.45, 0.04), std({ color: '#2a2d33' }), 1.6 + dx, 0.22, O.z + 0.3 + dz);
  mesh(box(0.8, 0.7, 0.8), std({ color: '#8a6a3a', roughness: 0.9 }), 2.4, 0.35, O.z - 0.6); cols.addBox(CX + 2.4, CZ + O.z - 0.6, 0.4, 0.4, 0, Y - 1, Y + 0.7);
  mesh(new THREE.SphereGeometry(0.12, 10, 8), bulbMat, 0, O.h - 0.3, O.z);
  // a floodlight over the office door, and pole lamps around the yard
  mesh(box(0.4, 0.2, 0.2), floodMat, 0, O.h - 0.2, oz0 - 0.15);
  const poles = [[-14, -18], [14, -18], [-14, 19], [14, 19], [0, 4]];
  for (const [lx, lz] of poles) { mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 8), std({ color: '#3a3d44' }), lx, 2.5, lz); mesh(new THREE.SphereGeometry(0.2, 10, 8), bulbMat, lx, 5.1, lz); }

  batch.build(group, { cast: false, receive: true });
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // ---------- what the game points at ----------
  const L = (lx, lz, yaw = 0) => ({ ...toWorld(lx, lz), yaw });
  const yard = {
    x: CX, z: CZ, y: Y, yaw: 0, toWorld, toLocal, roof, floorY: Y,
    inside: (x, z) => Math.abs(x - CX) < HX && Math.abs(z - CZ) < HZ,
    inOffice: (x, z) => { const l = toLocal(x, z); return Math.abs(l.x - O.x) < hw + 0.3 && Math.abs(l.z - O.z) < hd + 0.3; },
    gate: L(0, -HZ - 2.5, 0),                       // outside the gate, facing in (south)
    gateInside: L(0, -HZ + 2.5, 0),
    office: {
      door: L(0, oz0 - 1.4, 0), inside: L(0, O.z, 0),
      dolev: L(1.6, O.z + 0.3, Math.PI),           // on the chair, facing the door
      cipher: L(-1.2, O.z + 1.0, Math.PI),         // behind the table
      laptop: { ...toWorld(-1.2, O.z), y: Y + 0.8 },
    },
    patrols: {
      lane1: [L(-8, -17), L(-8, 5)], lane2: [L(8, 5), L(8, -17)],
      north: [L(-3, -19), L(3, -19), L(3, -16), L(-3, -16)],
      mid: [L(-2.5, -9), L(2.5, -9), L(2.5, -4), L(-2.5, -4)],
      south: [L(-6, 13), L(6, 13), L(6, 11), L(-6, 11)],
      west: [L(-14, 10), L(-14, -2)], east: [L(14, -2), L(14, 10)],
      door: [L(-2.5, O.z - 3), L(2.5, O.z - 3)],
    },
    cover,
    lamps: [
      ...poles.map(([lx, lz]) => ({ ...toWorld(lx, lz), y: Y + 5.0, inside: false, range: 24, intensity: 46 })),
      { ...toWorld(0, O.z), y: Y + O.h - 0.4, inside: true, range: 8, intensity: 18 },
      { ...toWorld(0, oz0 - 0.6), y: Y + O.h - 0.3, inside: false, range: 12, intensity: 26, color: '#dbe9ff' },
    ],
    emissives: [bulbMat, screenMat, floodMat, win.material],
    screenMat,
    tick(camera) {
      const l = toLocal(camera.position.x, camera.position.z);
      roof.visible = !(camera.position.y < Y + O.h + 0.8 && Math.abs(l.x - O.x) < hw + 0.8 && Math.abs(l.z - O.z) < hd + 0.8);
    },
  };
  places.yard = yard;
  return yard;
}
