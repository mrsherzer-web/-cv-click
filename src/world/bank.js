// "Kotzi's bank" (chapter four), invented for the game: a squat building at the south end of the
// industrial zone that Kotzi (a character invented for the game) set up with money he collected from
// everyone. A lobby with counters behind a locked front door; at the back, through the loading bay,
// a storage room, the office and the vault room with a round door into a small vault, where the bags
// are. The roof lifts away while the camera is inside, like the gym's. Nothing here is a real place
// and nothing shows how any real building is got into: the way in is a bay door left open.
import * as THREE from 'three';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';

const W = 40, D = 18, H = 5.4;       // the hall: width (x), depth (z), wall height; +z is the front
const CELL = { x: -13, w: 6, d: 4 }; // the vault cell, bumped out behind the back wall
const BAY = { x: 12, w: 6, h: 3.6 }; // the loading bay opening in the back wall

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2a4a'; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#f2c230'; g.fillRect(0, 232, 1024, 24);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillStyle = '#f7d35b'; g.font = 'bold 150px system-ui, sans-serif';
  g.fillText('בנק קוצי', 560, 118);
  g.fillStyle = '#f2c230'; g.beginPath(); g.arc(110, 118, 64, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1b2a4a'; g.font = 'bold 86px system-ui, sans-serif'; g.fillText('₪', 110, 122);
  g.fillStyle = '#c9d2dd'; g.font = '34px system-ui, sans-serif'; g.fillText('פתוח 24 שעות · בבעלות קוצי', 560, 208);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// a black duffel of cash (the thing the story is about), with a yellow tag
export function makeMoneyBag() {
  const g = new THREE.Group();
  g.name = 'money-bag';
  const cloth = new THREE.MeshStandardMaterial({ color: '#1c1d22', roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.36, 4, 10).rotateZ(Math.PI / 2), cloth);
  body.position.y = 0.17;
  g.add(body);
  for (const sx of [-0.12, 0.12]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 14, Math.PI), cloth);
    h.position.set(sx, 0.33, 0);
    g.add(h);
  }
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.01), new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.5 }));
  tag.position.set(0.2, 0.2, 0.17);
  g.add(tag);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildBank(ctx, b, { Y, top }) {
  const { group, M, cols, places } = ctx;
  const cx = b.cx, cz = b.cz + 27; // the south half of the block; the front on the south street
  const toWorld = (lx, lz) => ({ x: cx + lx, z: cz + lz });
  const toLocal = (x, z) => ({ x: x - cx, z: z - cz });
  const batch = new Batch();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const at = (lx, ly, lz, ry = 0) => mat4(cx + lx, top + ly, cz + lz, ry);
  const wall = tint('#d8d3c6'), dark = tint('#2a2f38'), trim = tint('#1b2a4a');
  // a wall piece from (x0, z0) to (x1, z1), solid to walk into
  const seg = (x0, z0, x1, z1, h = H, y = 0, thick = 0.3) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    batch.add('plaster', M.plaster, box(thick, h, len), at((x0 + x1) / 2, y + h / 2, (z0 + z1) / 2, yaw), { color: wall, uv: 'world', uvScale: 0.3 });
    if (y === 0) cols.addSegment(cx + x0, cz + z0, cx + x1, cz + z1, thick, Y - 1, top + h);
  };
  const hw = W / 2, hd = D / 2;

  // ---------- the shell: walls with the front doorway and the bay at the back ----------
  seg(-hw, hd, -1.6, hd); seg(1.6, hd, hw, hd);            // front, either side of the doors
  seg(-1.6, hd, 1.6, hd, H - 3.1, 3.1);                    // over the doors
  seg(-hw, -hd, CELL.x - CELL.w / 2 + 0.4, -hd);           // back: up to the vault cell
  seg(CELL.x + CELL.w / 2 - 0.4, -hd, BAY.x - BAY.w / 2, -hd); // ...to the bay
  seg(BAY.x + BAY.w / 2, -hd, hw, -hd);                    // ...past the bay
  seg(BAY.x - BAY.w / 2, -hd, BAY.x + BAY.w / 2, -hd, H - BAY.h, BAY.h); // the lintel over the bay
  seg(-hw, -hd, -hw, hd); seg(hw, -hd, hw, hd);            // the sides
  // the rolled-up bay door, and its rails
  batch.add('paint', M.paint, box(BAY.w + 0.3, 0.6, 0.5), at(BAY.x, BAY.h + 0.1, -hd), { color: tint('#5d636b') });
  for (const sx of [-1, 1]) batch.add('paint', M.paint, box(0.12, BAY.h, 0.36), at(BAY.x + sx * BAY.w / 2, BAY.h / 2, -hd), { color: tint('#5d636b') });
  // the vault cell behind the back wall
  const cl = CELL.x - CELL.w / 2, cr = CELL.x + CELL.w / 2, cb = -hd - CELL.d;
  seg(cl, -hd, cl, cb); seg(cr, -hd, cr, cb); seg(cl, cb, cr, cb);
  // the front doors: glass, locked; a step and two planters
  const doors = new THREE.Mesh(box(3.2, 3.0, 0.08), M.glass);
  doors.position.set(cx, top + 1.5, cz + hd);
  group.add(doors);
  cols.addBox(cx, cz + hd, 1.6, 0.1, 0, Y - 1, top + 3);
  batch.add('paint', M.paint, box(0.08, 3.0, 0.1), at(0, 1.5, hd), { color: dark });
  batch.add('pavers', M.pavers, box(10, 0.14, 3), at(0, 0.07, hd + 1.5), { uv: 'world', uvScale: 0.25 });
  for (const sx of [-3.6, 3.6]) {
    batch.add('paint', M.paint, box(1.2, 0.7, 1.2), at(sx, 0.35, hd + 1.6), { color: tint('#6b6f75') });
    cols.addBox(cx + sx, cz + hd + 1.6, 0.6, 0.6, 0, Y - 1, top + 0.8);
    ctx.veg.push({ kind: 'olive', x: cx + sx, y: top + 0.6, z: cz + hd + 1.6, s: 0.4 });
  }
  // a band of dark windows along the front and the sides, high up, and a trim line
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) {
    const x = sx * (3.6 + k * 2.6);
    batch.add('paint', M.paint, box(1.7, 1.1, 0.1), at(x, 3.7, hd + 0.12), { color: dark });
  }
  batch.add('paint', M.paint, box(W + 0.4, 0.3, D + 0.4), at(0, H + 0.02, 0), { color: trim });
  // the sign over the doors: its own mesh, so it can glow at night
  const signTex = signTexture();
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissive: '#ffffff', emissiveMap: signTex, emissiveIntensity: 0, roughness: 0.6 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), signMat);
  sign.position.set(cx, top + H - 0.3, cz + hd + 0.2);
  group.add(sign);

  // ---------- inside: the lobby, and the three rooms behind it ----------
  seg(-hw, -1, -1, -1); seg(1, -1, 12, -1); seg(14, -1, hw, -1); // the back rooms' wall, two doorways
  seg(6, -hd, 6, -1);                                             // storage, on the east
  seg(-6, -hd, -6, -3);                                           // the vault room, on the west (its doorway by the lobby wall)
  seg(-1, -1, 1, -1, H - 2.4, 2.4); seg(12, -1, 14, -1, H - 2.4, 2.4); seg(-6, -3, -6, -1, H - 2.4, 2.4); // lintels
  // the lobby: three counters, a rope line, a bench
  for (const x of [-9, 0, 9]) {
    batch.add('paint', M.paint, box(3.2, 1.05, 0.9), at(x, 0.52, 3), { color: tint('#4b5566') });
    batch.add('paint', M.paint, box(3.4, 0.06, 1.1), at(x, 1.08, 3), { color: tint('#d9d6cf') });
    cols.addBox(cx + x, cz + 3, 1.6, 0.45, 0, Y - 1, top + 1.2);
  }
  for (const x of [-5, 5]) { batch.add('paint', M.paint, box(0.08, 1.0, 0.08), at(x, 0.5, 6), { color: tint('#b9a04a') }); cols.addCircle(cx + x, cz + 6, 0.1, Y - 1, top + 1); }
  batch.add('paint', M.paint, box(9.6, 0.04, 0.03), at(0, 0.95, 6), { color: tint('#c8352d') });
  batch.add('paint', M.paint, box(3, 0.08, 0.5), at(-14, 0.45, 6.5), { color: tint('#8a6440') });
  cols.addBox(cx - 14, cz + 6.5, 1.5, 0.25, 0, Y - 1, top + 0.5);
  // storage: crates and a shelf
  for (const [x, z, w, h, d] of [[16.5, -6, 1.2, 1.1, 1.2], [15.2, -6.2, 1.0, 0.9, 1.0], [16.8, -4.6, 1.1, 1.0, 1.1], [9, -7.6, 3.6, 2.2, 0.6]]) {
    batch.add('paint', M.paint, box(w, h, d), at(x, h / 2, z), { color: tint(w > 3 ? '#5d636b' : '#8a6440') });
    cols.addBox(cx + x, cz + z, w / 2, d / 2, 0, Y - 1, top + h);
  }
  // Kotzi's office in the middle: a desk, a chair, a safe-looking cabinet (just decoration)
  batch.add('paint', M.paint, box(2.2, 0.08, 1), at(0, 0.76, -5.5), { color: tint('#3a2b23') });
  for (const [x, z] of [[-1, -5], [1, -5], [-1, -6], [1, -6]]) batch.add('paint', M.paint, box(0.06, 0.74, 0.06), at(x, 0.37, z), { color: tint('#1c1d20') });
  cols.addBox(cx, cz - 5.5, 1.1, 0.5, 0, Y - 1, top + 0.9);
  batch.add('paint', M.paint, box(1.0, 1.6, 0.6), at(4.5, 0.8, -8.3), { color: tint('#1b2a4a') });
  cols.addBox(cx + 4.5, cz - 8.3, 0.5, 0.3, 0, Y - 1, top + 1.7);
  // ceiling: light panels under the roof
  const panelMat = new THREE.MeshBasicMaterial({ color: '#fff3d6' });
  for (const [x, z] of [[-13, 4], [0, 4], [13, 4], [-13, -5], [0, -5], [13, -5]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2).rotateX(Math.PI / 2), panelMat);
    p.position.set(cx + x, top + H - 0.12, cz + z);
    group.add(p);
  }
  // the vault door: a round steel door in the back wall, hung on the cell's west side, with a wheel
  const steel = new THREE.MeshStandardMaterial({ color: '#8f98a3', roughness: 0.35, metalness: 0.75 });
  const hinge = new THREE.Group();
  hinge.position.set(cx + CELL.x - 1.15, top + 1.35, cz - hd);
  const door = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.34, 28).rotateX(Math.PI / 2), steel);
  door.position.set(1.15, 0, 0);
  door.castShadow = true;
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 8, 20), steel);
  wheel.position.set(1.15, 0, 0.28);
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.84, 6).rotateZ(a), steel); s.position.set(1.15, 0, 0.28); hinge.add(s); }
  hinge.add(door, wheel);
  group.add(hinge);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 8, 28), steel);
  frame.position.set(cx + CELL.x, top + 1.35, cz - hd);
  group.add(frame);
  const doorBlock = cols.addDynamicBox(null, 1.25, 0.25);
  doorBlock.cx = cx + CELL.x; doorBlock.cz = cz - hd; doorBlock.c = 1; doorBlock.s = 0; doorBlock.y0 = Y - 1; doorBlock.y1 = top + 3;
  doorBlock.enabled = true;
  // the bags of cash, in the cell
  const bags = [];
  for (const [x, z, ry] of [[-14.4, -11.4, 0.3], [-12.5, -11.9, -0.4], [-13.4, -10.3, 1.2]]) {
    const bag = makeMoneyBag();
    bag.position.set(cx + x, top, cz + z);
    bag.rotation.y = ry;
    group.add(bag);
    bags.push(bag);
  }

  // ---------- the roof: hidden while the camera is inside ----------
  const roofMat = new THREE.MeshStandardMaterial({ color: '#8a9096', roughness: 0.85 });
  const roof = new THREE.Group();
  const slab = new THREE.Mesh(box(W + 0.6, 0.3, D + 0.6), roofMat);
  slab.position.set(cx, top + H + 0.15, cz);
  const cellRoof = new THREE.Mesh(box(CELL.w + 0.6, 0.3, CELL.d + 0.6), roofMat);
  cellRoof.position.set(cx + CELL.x, top + H + 0.15, cz - hd - CELL.d / 2);
  roof.add(slab, cellRoof);
  for (const [x, z] of [[-12, 0], [10, 2]]) { const u = new THREE.Mesh(box(2.2, 1.0, 1.4), roofMat); u.position.set(cx + x, top + H + 0.8, cz + z); roof.add(u); } // air units
  roof.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(roof);

  batch.build(group, { plaster: { cast: true }, paint: { cast: true }, pavers: { cast: false } });

  // a small square of asphalt behind, where a car can wait by the bay
  const yardMesh = new THREE.Mesh(box(16, 0.1, 12), M.asphalt);
  yardMesh.position.set(cx + BAY.x + 1, top - 0.03, cz - hd - 7);
  yardMesh.receiveShadow = true;
  group.add(yardMesh);

  const L = (lx, lz) => toWorld(lx, lz);
  places.bank = {
    x: cx, z: cz, y: top, W, D, H, toWorld, toLocal, roof, signMat, vaultDoor: { hinge, block: doorBlock, open: false }, bags,
    inside: (x, z) => { const l = toLocal(x, z); return (Math.abs(l.x) < W / 2 + 0.3 && Math.abs(l.z) < D / 2 + 0.3) || (Math.abs(l.x - CELL.x) < CELL.w / 2 + 0.3 && l.z < -hd && l.z > -hd - CELL.d - 0.3); },
    front: { ...L(0, hd + 3), yaw: 0 },
    bay: { ...L(BAY.x, -hd - 1.2), yaw: Math.PI },         // just outside the bay, facing in
    bayInside: L(BAY.x, -hd + 2),
    yard: { ...L(BAY.x + 1, -hd - 7.5), yaw: 0 },         // the Renault, trunk toward the bay
    cell: L(CELL.x, -hd - CELL.d / 2),
    vaultFront: L(CELL.x, -hd + 2.2),
    office: L(0, -5),
    lobby: L(0, 5),
    patrols: {
      storage: [L(9, -3), L(17, -3), L(17, -7.2), L(9, -7.2)],
      lobbyE: [L(14, 1), L(14, 7.5), L(4, 7.5), L(4, 1)],
      lobbyW: [L(-4, 1), L(-4, 7.5), L(-15, 7.5), L(-15, 1)],
      office: [L(3, -3), L(4, -7.5), L(-4, -7.5), L(-3, -3)],
      vault: [L(-8, -3), L(-17, -3), L(-17, -7.5), L(-8, -7.5)],
      front: [L(-7, hd + 2.6), L(7, hd + 2.6)],
    },
    // night lamps: over the doors, at the bay, and inside under the ceiling panels (the lobby, the three
    // rooms behind it and the cell), so the rooms read at two in the morning
    lamps: [
      { x: cx, y: top + 4.6, z: cz + hd + 1.8 }, { x: cx + BAY.x, y: top + 4.2, z: cz - hd - 1.5 },
      { x: cx, y: top + H - 0.5, z: cz + 4, inside: true }, { x: cx, y: top + H - 0.5, z: cz - 5, inside: true },
      { x: cx + 13, y: top + H - 0.5, z: cz - 5, inside: true }, { x: cx - 13, y: top + H - 0.5, z: cz - 5, inside: true },
      { x: cx + CELL.x, y: top + 2.7, z: cz - hd - CELL.d / 2, inside: true },
    ],
    // the vault door swings open (or shut) over a moment
    setVault(open) { this.vaultDoor.open = open; this.vaultDoor.block.enabled = !open; },
  };
}

// each frame: the roof lifts away while the camera is inside, and the vault door swings
export function tickBank(bank, camera, dt) {
  const l = bank.toLocal(camera.position.x, camera.position.z);
  const inside = camera.position.y < bank.y + bank.H + 1.2 && ((Math.abs(l.x) < W / 2 + 1 && Math.abs(l.z) < D / 2 + 1) || (Math.abs(l.x - CELL.x) < CELL.w / 2 + 1 && l.z < -D / 2 && l.z > -D / 2 - CELL.d - 1));
  bank.roof.visible = !inside;
  const v = bank.vaultDoor, want = v.open ? -1.9 : 0;
  if (Math.abs(v.hinge.rotation.y - want) > 1e-3) v.hinge.rotation.y += (want - v.hinge.rotation.y) * Math.min(1, dt * 2.2);
}
