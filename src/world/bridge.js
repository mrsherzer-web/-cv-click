// The great bridge (chapter eight, the battle): a deck 80 m long and 16 wide across a ravine 18 m deep
// that runs north–south on the plain. Parapets on both sides, abandoned cars at angles for cover,
// drums that go up, piers down to the ravine floor, Kotzi's armoured car at the east end with a turret
// that watches the deck and three sensors on its body, and a span in the middle of the east half that
// can fall (its walking surface, its floor for the lines of sight, its slab and its parapets are its
// own, so the mission can drop them and put them back). Invented, like the rest.
import * as THREE from 'three';
import { makeSite } from './compound.js';
import { makeHatchback } from './car.js';

const C = { x: 1020, z: 150 };
const DECK = { x0: -40, x1: 40, z0: -8, z1: 8 };     // site-local
const SPAN = { x0: 10, x1: 24 };                     // the span that falls
const RAVINE = { x: 1020, z: 155, hx: 22, hz: 115, depth: 18 };

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const h = baseHeight(C.x, C.z);
  net.addPad({ x: RAVINE.x, z: RAVINE.z, hx: RAVINE.hx, hz: RAVINE.hz, yaw: 0, h: h - RAVINE.depth, top: 0.05, blend: 10, name: 'ravine' });
  net.addPad({ x: C.x - 64, z: C.z, hx: 24, hz: 14, yaw: 0, h, top: 0.05, blend: 8, name: 'bridge west' });
  net.addPad({ x: C.x + 54, z: C.z, hx: 22, hz: 14, yaw: 0, h, top: 0.05, blend: 8, name: 'bridge east' });
  ctx.keepOut?.push({ x: RAVINE.x, z: RAVINE.z, hx: RAVINE.hx + 14, hz: RAVINE.hz + 12 });
  ctx.bridge = { y: h + 0.05 };
}

export function build(ctx) {
  const { places, M, cols, net } = ctx;
  const { y } = ctx.bridge;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'bridge' });
  const { L, wall, slab, barrel, lampPost, sign, mesh, std, box, solid, level, camera, toWorld, group } = S;
  const P = (lx, lz, yaw) => ({ ...toWorld(lx, lz), y, ...(yaw != null ? { yaw } : {}) });
  const concrete = '#b4afa3';
  // ---------- the deck: west part and east part are fixed; the span between them is its own ----------
  level((DECK.x0 + SPAN.x0) / 2, 0, (SPAN.x0 - DECK.x0) / 2, 8, 0, { key: 'asphalt', mat: M.asphalt, color: '#5f5d58', scale: 0.1, name: 'bridge deck west', thick: 1.2 });
  level((SPAN.x1 + DECK.x1) / 2, 0, (DECK.x1 - SPAN.x1) / 2, 8, 0, { key: 'asphalt', mat: M.asphalt, color: '#5f5d58', scale: 0.1, name: 'bridge deck east', thick: 1.2 });
  const spanPad = net.addPad({ x: C.x + (SPAN.x0 + SPAN.x1) / 2, z: C.z, hx: (SPAN.x1 - SPAN.x0) / 2, hz: 8, yaw: 0, h: y - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'bridge span' });
  const spanFloor = { x0: C.x + SPAN.x0, z0: C.z - 8, x1: C.x + SPAN.x1, z1: C.z + 8, y: y - 0.6 }; cols.floors.push(spanFloor);
  const spanGroup = new THREE.Group(); spanGroup.position.set(C.x + (SPAN.x0 + SPAN.x1) / 2, y, C.z); group.add(spanGroup);
  const spanW = SPAN.x1 - SPAN.x0;
  const deckMat = std({ color: '#5f5d58', roughness: 0.9 }), concreteMat = std({ color: concrete, roughness: 0.9 });
  const spanSlab = new THREE.Mesh(box(spanW - 0.05, 1.2, 16), deckMat); spanSlab.position.y = -0.6; spanGroup.add(spanSlab);
  for (const sz of [-8, 8]) { const p = new THREE.Mesh(box(spanW - 0.05, 1.1, 0.4), concreteMat); p.position.set(0, 0.55, sz); spanGroup.add(p); }
  // the span's parapets block like the others, until it falls
  const railsUp = () => [cols.addSegment(C.x + SPAN.x0, C.z - 8, C.x + SPAN.x1, C.z - 8, 0.4, y - 1, y + 1.1), cols.addSegment(C.x + SPAN.x0, C.z + 8, C.x + SPAN.x1, C.z + 8, 0.4, y - 1, y + 1.1)];
  let spanRails = railsUp();
  // the fixed parapets
  const para = { h: 1.1, t: 0.4, color: concrete, key: 'stone', mat: M.stone, scale: 0.4 };
  for (const sz of [-8, 8]) { wall(DECK.x0, sz, SPAN.x0, sz, [], para); wall(SPAN.x1, sz, DECK.x1, sz, [], para); }
  // piers down to the ravine floor, and the abutments
  for (const lx of [-18, -4, 30]) for (const sz of [-5, 5]) mesh(box(2.2, RAVINE.depth, 2.2), concreteMat, lx, -RAVINE.depth / 2 - 1.2, sz);
  for (const lx of [DECK.x0 + 2, DECK.x1 - 2]) mesh(box(4, 6, 17), concreteMat, lx, -4.2, 0);
  for (const lx of [-30, -10, 4, 32]) for (const sz of [-7.4, 7.4]) lampPost(lx, sz, 6);
  sign('הגשר הגדול', DECK.x0 - 2, 3.2, -9, Math.PI / 2, 3.2, 0.6, { bg: '#2f5e8f' });
  // ---------- abandoned cars on the deck, at angles (cover) ----------
  const cars = [];
  const car = (lx, lz, yaw, color) => {
    const m = makeHatchback({ color, plates: false }); const p = toWorld(lx, lz); m.position.set(p.x, y, p.z); m.rotation.y = yaw; group.add(m);
    cols.addBox(p.x, p.z, 0.95, 2.1, yaw, y - 1, y + 1.5); S.cover.push({ ...p, w: 1.9, d: 4.2 }); cars.push({ ...p, y, yaw, mesh: m });
  };
  car(-32, -3, 0.5, '#7a2b2b'); car(-26, 4, -0.3, '#2b6a8f'); car(-16, -4.5, 1.1, '#6b6f75'); car(-8, 3, -0.8, '#2f7a4a'); car(2, -3.5, 0.2, '#c8a23a'); car(6, 4.5, 1.4, '#3a3d44');
  car(30, -4, -0.6, '#8a4b2e');
  const drums = [];
  for (const [lx, lz] of [[-21, 6], [-2, -6.2], [28, 6]]) { barrel(lx, lz, '#c8352d'); barrel(lx + 0.7, lz - 0.3, '#c8352d'); drums.push(P(lx + 0.3, lz)); }
  for (const [lx, lz] of [[-12, 0], [-29, -5.4]]) { mesh(box(1.2, 0.9, 1.2), std({ color: '#b8955e' }), lx, 0.45, lz); solid(lx, lz, 0.6, 0.6, 0.9); S.cover.push({ ...toWorld(lx, lz), w: 1.2, d: 1.2 }); }
  // ---------- Kotzi's armoured car at the east end, facing west down the deck ----------
  const AX = 34, armourMat = std({ color: '#2a2d33', roughness: 0.5, metalness: 0.4 });
  const armour = new THREE.Group(); { const p = toWorld(AX, 0); armour.position.set(p.x, y, p.z); armour.rotation.y = -Math.PI / 2; group.add(armour); }
  const part = (w, h, d, px, py, pz, mat = armourMat) => { const m = new THREE.Mesh(box(w, h, d), mat); m.position.set(px, py, pz); armour.add(m); return m; };
  part(2.6, 1.6, 6.2, 0, 1.2, 0); part(2.3, 0.8, 3, 0, 2.3, -0.6); const turret = part(1.2, 0.6, 1.4, 0, 3.0, -0.4); part(0.22, 0.22, 2, 0, 3.0, 0.9);
  for (const sz of [-2.2, 2.2]) for (const sx of [-1.35, 1.35]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 12).rotateZ(Math.PI / 2), std({ color: '#111' })); w.position.set(sx, 0.6, sz); armour.add(w); }
  cols.addBox(C.x + AX, C.z, 1.3, 3.1, Math.PI / 2, y - 1, y + 3.2);
  // three sensors (they glow): front, and on both sides
  const sensorMat = std({ color: '#ff4a4a', emissive: '#ff2a2a', emissiveIntensity: 0.9 });
  const sensors = [[0, 1.9, 3.15], [1.35, 1.7, 0.6], [-1.35, 1.7, -0.8]].map(([sx, sy, sz]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), sensorMat.clone()); m.position.set(sx, sy, sz); armour.add(m); return m; });
  armour.updateMatrixWorld(true);
  const sensorAt = sensors.map((m) => { const v = new THREE.Vector3(); m.getWorldPosition(v); return { x: v.x, y: v.y, z: v.z, mesh: m }; });
  const gun = camera(AX - 3.6, 3.0, 0, -Math.PI / 2, { range: 26, half: 0.5 }); // just in front of the car's body (the ray must start outside it)
  gun.setOn(false);
  // the ravine floor: rocks
  for (const [lx, lz, s] of [[-6, -20, 2], [4, 30, 2.6], [-12, 60, 1.8], [10, -50, 2.2], [0, 12, 1.6]]) mesh(new THREE.DodecahedronGeometry(s, 0), std({ color: '#8f887b', roughness: 0.95 }), lx, -RAVINE.depth + s * 0.4, lz);
  S.finish();
  const span = {
    pad: spanPad, floor: spanFloor, group: spanGroup, down: false,
    // the fall: the walking surface, the floor and the parapets go; the slab drops into the ravine
    drop() { if (span.down) return; span.down = true; net.removePad(spanPad); cols.floors = cols.floors.filter((f) => f !== spanFloor); for (const r of spanRails) cols.remove(r); span.t = 0; },
    update(dt) { if (!span.down || span.t > 2.4) return; span.t += dt; const k = Math.min(1, span.t / 2.4); spanGroup.position.y = y - k * k * (RAVINE.depth - 1.2); spanGroup.rotation.z = k * 0.35; spanGroup.rotation.x = k * 0.12; },
    restore() { if (!span.down) return; span.down = false; net.restorePad(spanPad); if (!cols.floors.includes(spanFloor)) cols.floors.push(spanFloor); spanRails = railsUp(); spanGroup.position.y = y; spanGroup.rotation.set(0, 0, 0); },
  };
  places.bridge = {
    x: C.x, z: C.z, y, toWorld,
    west: P(DECK.x0 - 6, 0, Math.PI / 2), westDeck: P(DECK.x0 + 3, 0, Math.PI / 2), mid: P(-4, 0, Math.PI / 2), east: P(DECK.x1 + 10, 0, Math.PI / 2), eastDeck: P(DECK.x1 - 3, 0, Math.PI / 2),
    edge: { west: P(SPAN.x0 - 1.2, 0, Math.PI / 2), east: P(SPAN.x1 + 1.0, 0, -Math.PI / 2), erez: P(SPAN.x1 + 0.6, 2.2, -Math.PI / 2) },
    cars, drums, cover: S.cover,
    armour: { x: C.x + AX, z: C.z, y, group: armour, sensors: sensorAt, turret, gun },
    span,
    patrols: {
      w1: [P(-20, -5.6)], w2: [P(-18, 2)], w3: [P(-14, 6.2)], w4: [P(-10, -2)], w5: [P(-22, 0)],
      v1: [P(-2, 6)], v2: [P(0, -1)], v3: [P(4, 1.8)], v4: [P(8, -6)], v5: [P(-4, -1)], v6: [P(8, 1)],
      e1: [P(28, -1)], e2: [P(26, 4)], e3: [P(30, -6)], e4: [P(36, 4.2)], e5: [P(26, -5.6)], e6: [P(37, -4.6)],
    },
    lamps: S.lamps, emissives: [...S.emissives, sensorMat],
    onDeck: (x, z) => Math.abs(z - C.z) < 8 && x > C.x + DECK.x0 && x < C.x + DECK.x1,
  };
}
