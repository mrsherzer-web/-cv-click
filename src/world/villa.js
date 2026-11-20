// Yaniv's villa (chapter five), on a new street east of Katzir's side road: a one-floor house on a
// walled lot, a parking strip by the street, and the three-floor building opposite whose roof is
// Muller's overwatch post. Yaniv is invented for the game; the place is invented too — no real address.
// Inside: an entrance hall, the salon to the west, the kitchen and the study to the east (the study is
// where the two bags are). Walls carry colliders, the doorways are gaps, the roof hides when the camera
// is inside (like the bank). Lamps and glowing materials are published for the night.
// Villa-local axes: the origin is the house centre at floor level; +z faces the street (south).
import * as THREE from 'three';
import { Batch, mat4 } from './batch.js';
import { Road } from './roads.js';
import { Tex } from './textures.js';
import { tint } from './materials.js';
import { addHouse } from './houses.js';

const W = 24, D = 18, H = 3.2, T = 0.3;         // the house
const LOT = { hx: 20, hz: 16 };                 // the walled lot
const PARK = { z: 20.5, hx: 7, hz: 3.2 };       // the parking strip between the wall and the street
const BLD = { x: 95, z: 55, w: 14, d: 10, floors: 3 }; // the building opposite
const CX = 95, CZ = 95;                         // the house centre (world)
const STREET = [[26, 123], [58, 117], [92, 113], [124, 110]];
let site = null;

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  const road = net.add(new Road(STREET, { name: 'דרך הכרמים', width: 6.5, sidewalk: 1.8, curb: 0.14, spacing: 1.2, baseHeight }));
  places.villaRoad = road;
  const q = road.nearest(CX, CZ + PARK.z);
  const h = q.h + road.curb;                    // the lot sits level with the sidewalk at the gate
  net.addPad({ x: CX, z: CZ, hx: LOT.hx + 1.2, hz: LOT.hz + 1.2, yaw: 0, h: q.h, top: road.curb, blend: 7, name: 'villa' });
  net.addPad({ x: CX, z: CZ + PARK.z, hx: PARK.hx + 1, hz: PARK.hz + 1, yaw: 0, h: q.h, top: road.curb, blend: 4, name: 'villa parking' });
  const bh = baseHeight(BLD.x, BLD.z);
  net.addPad({ x: BLD.x, z: BLD.z, hx: BLD.w / 2 + 2.5, hz: BLD.d / 2 + 2.5, yaw: 0, h: bh, top: 0.05, blend: 6, name: 'overwatch building' });
  ctx.keepOut.push({ x: CX, z: CZ, hx: LOT.hx + 3, hz: LOT.hz + 3 }, { x: CX, z: CZ + PARK.z, hx: PARK.hx + 3, hz: PARK.hz + 3 }, { x: BLD.x, z: BLD.z, hx: BLD.w / 2 + 4, hz: BLD.d / 2 + 4 });
  site = { h, bh, road };
}

export function build(ctx) {
  const { group: parent, M, cols, places } = ctx;
  const { h: Y, bh } = site;
  const group = new THREE.Group();
  group.name = 'villa';
  parent.add(group);
  const batch = new Batch();
  const box = (w, hh, d) => new THREE.BoxGeometry(w, hh, d);
  const at = (lx, ly, lz, ry = 0) => mat4(CX + lx, Y + ly, CZ + lz, ry);
  const toWorld = (lx, lz) => ({ x: CX + lx, z: CZ + lz });
  const toLocal = (x, z) => ({ x: x - CX, z: z - CZ });
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const IM = { // interior materials, published for the asset layer
    floor: std({ map: Tex.tiles(), roughness: 0.3, metalness: 0.04 }),
    wall: std({ map: Tex.plaster(), roughness: 0.95, color: '#f1ede4' }),
    wood: std({ map: Tex.wood(), roughness: 0.6 }),
    fabric: std({ map: Tex.fabric(), roughness: 1, color: '#8a93a6' }),
    counter: std({ map: Tex.plaster(), roughness: 0.25, metalness: 0.06, color: '#d9d5cc' }),
    dark: std({ color: '#2a2d33', roughness: 0.6 }),
  };
  const bulbMat = std({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0 });
  const windowMat = std({ color: '#cfe0ee', emissive: '#ffd9a0', emissiveIntensity: 0, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 });
  bulbMat.userData.night = 1.6; windowMat.userData.night = 0.9;
  const hw = W / 2, hd = D / 2;
  const wallTint = tint('#efe7d8'), stone = tint('#cfc6b4'), dark = tint('#2a2d33');

  // ---------- the lot: a low stone wall with a gate to the street, planters and a lawn ----------
  const lot = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    batch.add('stone', M.stone, box(0.35, 1.7, len), at((x0 + x1) / 2, 0.85, (z0 + z1) / 2, yaw), { color: stone, uv: 'world', uvScale: 0.4 });
    cols.addSegment(CX + x0, CZ + z0, CX + x1, CZ + z1, 0.35, Y - 1, Y + 1.7);
  };
  lot(-LOT.hx, -LOT.hz, LOT.hx, -LOT.hz); lot(-LOT.hx, LOT.hz, -1.6, LOT.hz); lot(1.6, LOT.hz, LOT.hx, LOT.hz);
  lot(-LOT.hx, -LOT.hz, -LOT.hx, LOT.hz); lot(LOT.hx, -LOT.hz, LOT.hx, LOT.hz);
  for (const sx of [-1.6, 1.6]) batch.add('plaster', M.plaster, box(0.5, 2.2, 0.5), at(sx, 1.1, LOT.hz), { color: wallTint, uv: 'world' });
  batch.add('paint', M.paint, box(3.2, 0.12, 0.3), at(0, 2.3, LOT.hz), { color: dark }); // the lintel over the gate
  // the lawn and the path from the gate to the door
  batch.add('ground', M.ground, box(LOT.hx * 2 - 0.4, 0.05, LOT.hz * 2 - 0.4), at(0, -0.03, 0), { color: tint('#7a9a4e'), uv: 'world', uvScale: 0.12 });
  batch.add('pavers', M.pavers, box(2.4, 0.08, LOT.hz - hd), at(0, -0.02, hd + (LOT.hz - hd) / 2), { uv: 'world', uvScale: 0.25 });
  batch.add('pavers', M.pavers, box(W + 4, 0.08, 2.2), at(0, -0.02, hd + 1.1), { uv: 'world', uvScale: 0.25 }); // the terrace along the front
  // planters in the yard: cover for whoever comes in through the gate, and along the back
  const cover = [];
  const planter = (lx, lz, w, d) => {
    batch.add('plaster', M.plaster, box(w, 0.9, d), at(lx, 0.45, lz), { color: tint('#9a9c98'), uv: 'world' });
    batch.add('ground', M.ground, box(w - 0.2, 0.1, d - 0.2), at(lx, 0.92, lz), { color: tint('#5f7a3a'), uv: 'world', uvScale: 0.2 });
    cols.addBox(CX + lx, CZ + lz, w / 2, d / 2, 0, Y - 1, Y + 0.95);
    cover.push({ ...toWorld(lx, lz), w, d });
  };
  planter(-7, 13, 4, 1.2); planter(7, 13, 4, 1.2); planter(-15, 3, 1.2, 5); planter(15, -3, 1.2, 5); planter(0, -13.5, 6, 1.2);
  // the parking strip by the street
  batch.add('asphalt', M.asphalt, box(PARK.hx * 2, 0.06, PARK.hz * 2), at(0, -0.01, PARK.z), { uv: 'world', uvScale: 0.1 });
  for (const sx of [-3.5, 0, 3.5]) batch.add('paint', M.paint, box(0.12, 0.07, PARK.hz * 2 - 0.6), at(sx, 0.025, PARK.z), { color: tint('#e8e6de') });

  // ---------- the house: walls with doorways, windows, a flat roof with a parapet ----------
  const seg = (x0, z0, x1, z1, hh = H, y = 0, thick = T) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    batch.add('plaster', M.plaster, box(thick, hh, len), at((x0 + x1) / 2, y + hh / 2, (z0 + z1) / 2, yaw), { color: wallTint, uv: 'world', uvScale: 0.3 });
    if (y === 0) cols.addSegment(CX + x0, CZ + z0, CX + x1, CZ + z1, thick, Y - 1, Y + hh);
  };
  // outer walls: the front doorway at x = 0 (1.8 wide)
  seg(-hw, hd, -0.9, hd); seg(0.9, hd, hw, hd); seg(-0.9, hd, 0.9, hd, H - 2.2, 2.2);
  seg(-hw, -hd, hw, -hd); seg(-hw, -hd, -hw, hd); seg(hw, -hd, hw, hd);
  // inner walls (thin): x = -3 salon | hall with a door at z 2.6..4.4 (the salon wraps behind the hall);
  // z = 0 the hall's back wall; x = 3 hall | kitchen with a door at z 4.4..6.2, solid below z = 0 against the study;
  // z = 0 kitchen | study with a door at x 6.2..8
  const IT = 0.14;
  seg(-3, hd, -3, 4.4, H, 0, IT); seg(-3, 2.6, -3, 0, H, 0, IT); seg(-3, 4.4, -3, 2.6, H - 2.1, 2.1, IT);
  seg(-3, 0, 3, 0, H, 0, IT);
  seg(3, hd, 3, 6.2, H, 0, IT); seg(3, 4.4, 3, -hd, H, 0, IT); seg(3, 6.2, 3, 4.4, H - 2.1, 2.1, IT);
  seg(3, 0, 6.2, 0, H, 0, IT); seg(8, 0, hw, 0, H, 0, IT); seg(6.2, 0, 8, 0, H - 2.1, 2.1, IT);
  // the floor slab and the ceiling
  batch.add('tiles', M.tiles, box(W - 0.2, 0.1, D - 0.2), at(0, -0.05, 0), { uv: 'world', uvScale: 0.5 });
  const floorMesh = new THREE.Mesh(box(W - 0.3, 0.02, D - 0.3), IM.floor); floorMesh.position.set(CX, Y + 0.005, CZ); group.add(floorMesh);
  const ceiling = new THREE.Mesh(box(W - 0.3, 0.06, D - 0.3), std({ color: '#f1ede4', emissive: '#57534c', roughness: 1 })); // lit from below, like a ceiling ceiling.position.set(CX, Y + H - 0.03, CZ); group.add(ceiling);
  // the roof: a slab with a parapet, hidden when the camera is inside
  const roof = new THREE.Group();
  const slab = new THREE.Mesh(box(W + 0.3, 0.3, D + 0.3), std({ color: '#8d8a84', roughness: 0.9 })); slab.position.set(CX, Y + H + 0.15, CZ); roof.add(slab);
  for (const [lx, lz, w, d] of [[0, hd, W + 0.3, 0.25], [0, -hd, W + 0.3, 0.25], [hw, 0, 0.25, D + 0.3], [-hw, 0, 0.25, D + 0.3]]) {
    const p = new THREE.Mesh(box(w, 0.9, d), std({ color: '#e9e2d3', roughness: 0.9 })); p.position.set(CX + lx, Y + H + 0.75, CZ + lz); roof.add(p);
  }
  const unit = new THREE.Mesh(box(1.6, 0.9, 1.1), std({ color: '#c9ccd1', roughness: 0.6 })); unit.position.set(CX - 6, Y + H + 0.75, CZ - 3); roof.add(unit); // an air-conditioning unit
  group.add(roof);
  // windows (glowing at night) on the front and the sides
  const win = (lx, lz, ry, w = 1.8, hh = 1.3) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), windowMat); m.position.set(CX + lx, Y + 1.7, CZ + lz); m.rotation.y = ry; group.add(m); };
  win(-7, hd + 0.02, 0, 3); win(7, hd + 0.02, 0, 2.2); win(-hw - 0.02, -3, -Math.PI / 2); win(hw + 0.02, -4, Math.PI / 2); win(-4, -hd - 0.02, Math.PI); win(7, -hd - 0.02, Math.PI);
  // the front door (open at night: a dark gap with a frame) and a step
  batch.add('paint', M.paint, box(0.12, 2.3, 0.12), at(-0.95, 1.15, hd), { color: dark }); batch.add('paint', M.paint, box(0.12, 2.3, 0.12), at(0.95, 1.15, hd), { color: dark });
  batch.add('pavers', M.pavers, box(2.6, 0.12, 0.8), at(0, -0.04, hd + 0.5), { uv: 'world', uvScale: 0.25 });

  // ---------- furniture (simple, textured) ----------
  const mesh = (geo, mat, lx, ly, lz, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(CX + lx, Y + ly, CZ + lz); m.rotation.y = ry; group.add(m); return m; };
  const solid = (lx, lz, hx, hz, top) => cols.addBox(CX + lx, CZ + lz, hx, hz, 0, Y - 1, Y + top);
  // salon: two sofas, a low table, a TV wall, a rug
  mesh(box(3.2, 0.8, 1.0), IM.fabric, -8, 0.5, 3); solid(-8, 3, 1.6, 0.5, 0.9);
  mesh(box(1.0, 0.8, 2.6), IM.fabric, -10.6, 0.5, -0.2); solid(-10.6, -0.2, 0.5, 1.3, 0.9);
  mesh(box(1.4, 0.4, 0.8), IM.wood, -8, 0.3, 0.6); solid(-8, 0.6, 0.7, 0.4, 0.5);
  mesh(box(2.2, 1.25, 0.08), IM.dark, -8, 1.6, -hd + 0.2); // the television
  mesh(box(2.8, 0.5, 0.5), IM.wood, -8, 0.35, -hd + 0.45); solid(-8, -hd + 0.45, 1.4, 0.25, 0.6);
  mesh(box(4.5, 0.02, 3.2), std({ color: '#7a2e2e', roughness: 1 }), -8, 0.02, 1.5);
  // kitchen: a counter along the back of the room and an island
  mesh(box(7, 0.9, 0.6), IM.counter, 7.5, 0.45, hd - 0.5); solid(7.5, hd - 0.5, 3.5, 0.3, 1.0);
  mesh(box(7, 0.6, 0.35), IM.wood, 7.5, 2.0, hd - 0.3); // upper cupboards
  mesh(box(2.4, 0.9, 1.0), IM.counter, 7.5, 0.45, 3); solid(7.5, 3, 1.2, 0.5, 1.0);
  mesh(box(0.8, 1.8, 0.7), std({ color: '#d7d9dc', roughness: 0.3, metalness: 0.4 }), hw - 0.6, 0.9, 1.2); solid(hw - 0.6, 1.2, 0.4, 0.35, 1.9); // the fridge
  // study: a desk, a bookcase, the safe in the corner, and the two bags beside it
  mesh(box(1.8, 0.75, 0.8), IM.wood, 8, 0.6, -5); solid(8, -5, 0.9, 0.4, 0.8);
  mesh(box(0.4, 2.2, 3.0), IM.wood, hw - 0.4, 1.1, -4); solid(hw - 0.4, -4, 0.2, 1.5, 2.2);
  const safe = mesh(box(1.1, 1.3, 0.9), std({ color: '#3a3f47', roughness: 0.5, metalness: 0.5 }), hw - 1.0, 0.65, -hd + 0.8); solid(hw - 1.0, -hd + 0.8, 0.55, 0.45, 1.3);
  mesh(box(0.5, 0.5, 0.04), std({ color: '#9aa1ab', metalness: 0.7, roughness: 0.3 }), hw - 1.0, 0.7, -hd + 1.27);
  // hall: a bench and a mirror
  mesh(box(1.6, 0.45, 0.45), IM.wood, 1.6, 0.23, 6.5); solid(1.6, 6.5, 0.8, 0.22, 0.5);
  // ceiling lamps (bulbs) in each room
  const lampSpots = [[-7, 1.5], [0, 5], [7.5, 4.5], [8, -5]];
  for (const [lx, lz] of lampSpots) { mesh(new THREE.SphereGeometry(0.14, 10, 8), bulbMat, lx, H - 0.35, lz); mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), IM.dark, lx, H - 0.15, lz); }
  // yard lamps on short posts
  const yardLamps = [[-12, 13], [12, 13], [-17, -8], [17, -8]];
  for (const [lx, lz] of yardLamps) { mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.4, 6), IM.dark, lx, 1.2, lz); mesh(new THREE.SphereGeometry(0.16, 10, 8), bulbMat, lx, 2.5, lz); }

  // ---------- the building opposite (Muller's post on its roof) ----------
  addHouse(batch, M, { x: BLD.x, y: bh, z: BLD.z, yaw: Math.PI, w: BLD.w, d: BLD.d, floors: BLD.floors, roof: 'flat', wall: '#e3d9c6', balcony: false, ac: true });
  cols.addBox(BLD.x, BLD.z, BLD.w / 2, BLD.d / 2, 0, bh - 1, bh + BLD.floors * 3.1 + 1);
  const roofY = bh + BLD.floors * 3.1 + 0.02;
  // a stair tower on the roof's back corner, the way up (just a block; the mission puts Muller on the roof)
  batch.add('plaster', M.plaster, box(2.4, 2.4, 2.2), mat4(BLD.x - 4.5, roofY + 1.2, BLD.z - 2.6, 0), { color: tint('#e3d9c6'), uv: 'world' });

  batch.build(group, { cast: false, receive: true });
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // ---------- what the game points at ----------
  const L = (lx, lz, yaw = 0) => ({ ...toWorld(lx, lz), yaw });
  const rect = (x0, z0, x1, z1) => ({ x0, z0, x1, z1 });
  const rooms = { hall: rect(-3, 0, 3, hd), kitchen: rect(3, 0, hw, hd), study: rect(3, -hd, hw, 0), salon: rect(-hw, -hd, -3, hd), nook: rect(-3, -hd, 3, 0) };
  const inRoom = (x, z) => { const l = toLocal(x, z); for (const k in rooms) { const r = rooms[k]; if (l.x >= r.x0 && l.x <= r.x1 && l.z >= r.z0 && l.z <= r.z1) return k === 'nook' ? 'salon' : k; } return null; };
  const villa = {
    x: CX, z: CZ, y: Y, W, D, H, yaw: 0, toWorld, toLocal, roof, floorY: Y + 0.005,
    inside: (x, z) => { const l = toLocal(x, z); return Math.abs(l.x) < hw + 0.3 && Math.abs(l.z) < hd + 0.3; },
    gate: L(0, LOT.hz + 0.6, Math.PI),                 // just outside the gate, facing in
    gateInside: L(0, LOT.hz - 1.6, Math.PI),
    door: L(0, hd + 1.2, Math.PI),                     // on the terrace in front of the door
    doorInside: L(0, hd - 1.2, Math.PI),
    parking: L(0, PARK.z, Math.PI),
    cars: { nehorai: L(-3.5, PARK.z, 0), liam: L(3.5, PARK.z, 0) }, // noses to the street (local +z): yaw 0 faces +z
    safe: L(hw - 1.0, -hd + 0.8),
    bags: [{ ...toWorld(hw - 2.3, -hd + 0.9), y: Y }, { ...toWorld(hw - 2.3, -hd + 1.9), y: Y }],
    patrols: {
      yardS: [L(-14, 13.5), L(-4, 13.5), L(-4, 11), L(-14, 11)],
      yardN: [L(14, -13.5), L(-14, -13.5), L(-14, -11), L(14, -11)],
      yardE: [L(16.5, -12), L(16.5, 12)],
      yardW: [L(-16.5, 12), L(-16.5, -12)],
      salon: [L(-9, -5), L(-5, 5), L(-10, 3)],
      kitchen: [L(5, 2), L(9.5, 6.5), L(6, 6)],
      study: [L(5, -6.5), L(10, -3), L(6, -2)],
    },
    roofSpots: [{ ...L(-9, -6, Math.PI), y: Y + H + 0.3 }, { ...L(9, 6, 0), y: Y + H + 0.3 }],
    cover,
    rooms, inRoom,
    mullerPost: { x: BLD.x, y: roofY, z: BLD.z + BLD.d / 2 - 0.9, foot: { x: BLD.x, z: BLD.z + BLD.d / 2 + 2.5 }, look: { x: CX, z: CZ } },
    building: { x: BLD.x, z: BLD.z, y: bh, roofY },
    lamps: [
      ...yardLamps.map(([lx, lz]) => ({ ...toWorld(lx, lz), y: Y + 2.5, inside: false, range: 20, intensity: 40 })),
      ...lampSpots.map(([lx, lz]) => ({ ...toWorld(lx, lz), y: Y + H - 0.5, inside: true, range: 12, intensity: 26 })),
    ],
    emissives: [bulbMat, windowMat],
    materials: IM,
    tick(camera) {
      const l = toLocal(camera.position.x, camera.position.z);
      roof.visible = !(camera.position.y < Y + H + 1.0 && Math.abs(l.x) < hw + 1 && Math.abs(l.z) < hd + 1);
    },
  };
  places.villa = villa;
  return villa;
}
