// The gym (fictional): a hall at the back of the commercial lot outside Katzir's gate, with a wide open
// door, punching bags, a low sparring ring, benches and a mirror wall. The roof lifts away while the
// camera is inside, so the hall can be played in from a third-person view.
import * as THREE from 'three';
import { mat4 } from './batch.js';
import { tint } from './materials.js';
import { Tex } from './textures.js';

const W = 24, D = 12, H = 5;            // hall: along the lot, depth, wall height
const OUT = 11.2;                        // hall center: this far from the lot center, away from the road
const DOOR = 7;                          // width of the open front
const RING = { x: 6.2, z: -0.8, half: 2.6, h: 0.32 };

export function layout(ctx) {
  const { net, places } = ctx;
  const lot = places.lot, lr = lot.road;
  // local frame of the hall: x along the lot, z toward the road (the open front)
  const c = { x: lot.x + lr.nx * OUT, z: lot.z + lr.nz * OUT };
  const yaw = Math.atan2(-lr.nx, -lr.nz);   // local +z points toward the road
  const floorY = lot.h + lot.top;
  const toWorld = (lx, lz) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    return { x: c.x + lx * cs + lz * sn, z: c.z - lx * sn + lz * cs };
  };
  const toLocal = (x, z) => {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), dx = x - c.x, dz = z - c.z;
    return { x: dx * cs - dz * sn, z: dx * sn + dz * cs };
  };
  const gym = { c, yaw, floorY: floorY + 0.06, toWorld, toLocal, ring: RING };
  // standing on the ring's canvas (inside the ropes)
  gym.inRing = (x, z, margin = 0.2) => { const l = toLocal(x, z); return Math.abs(l.x - RING.x) < RING.half - margin && Math.abs(l.z - RING.z) < RING.half - margin; };
  places.gym = gym;
  net.addPad({ x: c.x, z: c.z, hx: W / 2 - 0.3, hz: D / 2 - 0.3, yaw, h: floorY, top: 0.06, blend: 0, name: 'gym floor' });
  const rc = toWorld(RING.x, RING.z);
  net.addPad({ x: rc.x, z: rc.z, hx: RING.half, hz: RING.half, yaw, h: floorY, top: 0.06 + RING.h, blend: 0, name: 'ring' });
}

export function build(ctx) {
  const { group, M, cols, batch, places } = ctx;
  const g = places.gym, y0 = g.floorY - 0.06;
  const at = (lx, ly, lz, ry = 0, sx = 1, sy = 1, sz = 1) => { const p = g.toWorld(lx, lz); return mat4(p.x, y0 + ly, p.z, g.yaw + ry, sx, sy, sz); };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const solid = (lx, lz, hx, hz, h = H) => { const p = g.toWorld(lx, lz); cols.addBox(p.x, p.z, hx, hz, g.yaw, y0 - 1, y0 + h); };
  const wall = tint('#e7e1d4'), base = tint('#4a4f57');

  // ---------- shell: walls with the open front, a lintel over the door, the roof ----------
  batch.add('plaster', M.plaster, box(W, H, 0.3), at(0, H / 2, -D / 2), { color: wall, uv: 'world', uvScale: 0.3 });
  solid(0, -D / 2, W / 2, 0.15);
  for (const sx of [-1, 1]) {
    batch.add('plaster', M.plaster, box(0.3, H, D), at(sx * W / 2, H / 2, 0), { color: wall, uv: 'world', uvScale: 0.3 });
    solid(sx * W / 2, 0, 0.15, D / 2);
    const len = (W - DOOR) / 2, mx = sx * (DOOR / 2 + len / 2);
    batch.add('plaster', M.plaster, box(len, H, 0.3), at(mx, H / 2, D / 2), { color: wall, uv: 'world', uvScale: 0.3 });
    solid(mx, D / 2, len / 2, 0.15);
    batch.add('paint', M.paint, box(len, 0.6, 0.32), at(mx, 0.3, D / 2), { color: base });
  }
  batch.add('plaster', M.plaster, box(DOOR, H - 3.3, 0.3), at(0, 3.3 + (H - 3.3) / 2, D / 2), { color: wall, uv: 'world', uvScale: 0.3 });
  batch.add('paint', M.paint, box(DOOR + 0.2, 0.55, 0.45), at(0, 3.05, D / 2), { color: tint('#5d636b') }); // the rolled-up door
  for (const sx of [-1, 1]) batch.add('paint', M.paint, box(0.12, 3.3, 0.36), at(sx * (DOOR / 2), 1.65, D / 2), { color: tint('#5d636b') });
  // high windows along the back
  for (let i = -3; i <= 3; i++) batch.add('shutter', M.shutter, new THREE.PlaneGeometry(1.8, 0.8), at(i * 3.2, 4.0, -D / 2 - 0.16, Math.PI), {});
  const roofMat = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.8 });
  const roof = new THREE.Mesh(box(W + 0.6, 0.3, D + 0.6), roofMat);
  const rp = g.toWorld(0, 0);
  roof.position.set(rp.x, y0 + H + 0.15, rp.z);
  roof.rotation.y = g.yaw;
  roof.castShadow = true;
  group.add(roof);
  // the sign over the door
  {
    const p = g.toWorld(0, D / 2 + 0.17);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0), new THREE.MeshStandardMaterial({ map: Tex.sign('מכון כושר הגבעה', { bg: '#1d2128', fg: '#ffb547', w: 1024, h: 160, size: 96, border: false }), roughness: 0.5 }));
    m.position.set(p.x, y0 + 4.15, p.z);
    m.rotation.y = g.yaw;
    m.userData.sign = true;
    group.add(m);
  }

  // ---------- inside ----------
  batch.add('paint', M.paint, box(W - 0.3, 0.06, D - 0.3), at(0, 0.03, 0), { color: tint('#3a3d42') }); // rubber floor
  // sparring ring: a low platform, corner posts, three ropes; open on the side facing the door
  const R = g.ring, rh = R.h;
  batch.add('paint', M.paint, box(R.half * 2, rh, R.half * 2), at(R.x, 0.06 + rh / 2, R.z), { color: tint('#2f5e8f') });
  batch.add('paint', M.paint, box(R.half * 2 - 0.1, 0.02, R.half * 2 - 0.1), at(R.x, 0.06 + rh + 0.01, R.z), { color: tint('#d9d2c3') });
  const post = (px, pz, color) => {
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.07, 0.07, 1.4, 8), at(R.x + px, 0.06 + rh + 0.7, R.z + pz), { color: tint(color) });
    const w = g.toWorld(R.x + px, R.z + pz);
    cols.addCircle(w.x, w.z, 0.12, y0 - 1, y0 + 2);
  };
  post(-R.half, -R.half, '#c8352d'); post(R.half, R.half, '#2f5e8f'); post(R.half, -R.half, '#ececec'); post(-R.half, R.half, '#ececec');
  for (const hgt of [0.55, 0.85, 1.15]) {
    for (const [px, pz, len, ry] of [[0, -R.half, R.half * 2, Math.PI / 2], [-R.half, 0, R.half * 2, 0], [R.half, 0, R.half * 2, 0]]) {
      batch.add('paint', M.paint, box(0.03, 0.03, len), at(R.x + px, 0.06 + rh + hgt, R.z + pz, ry), { color: tint('#e8e3d6') });
    }
  }
  for (const [px, pz, hx, hz] of [[0, -R.half, R.half, 0.06], [-R.half, 0, 0.06, R.half], [R.half, 0, 0.06, R.half]]) solid(R.x + px, R.z + pz, hx, hz, 1.6);

  // punching bags hanging along the back wall; each is its own object so it can swing when hit
  const bags = [];
  const bagMat = new THREE.MeshStandardMaterial({ color: '#7a2a24', roughness: 0.7 });
  const chainMat = new THREE.MeshStandardMaterial({ color: '#8d9298', roughness: 0.4, metalness: 0.7 });
  for (const lx of [-8.5, -5.5, -2.5]) {
    const p = g.toWorld(lx, -D / 2 + 1.6);
    const pivot = new THREE.Group();
    pivot.position.set(p.x, y0 + 3.4, p.z);
    const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.15, 14), bagMat);
    bag.position.y = -1.9;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 4), chainMat);
    chain.position.y = -0.66;
    pivot.add(bag, chain);
    bag.castShadow = true;
    group.add(pivot);
    cols.addCircle(p.x, p.z, 0.3, y0 - 1, y0 + 2);
    bags.push({ pivot, x: p.x, z: p.z, ax: 0, az: 0, vx: 0, vz: 0, hits: 0 });
  }
  // a mirror along the left wall, benches and a dumbbell rack
  batch.add('paint', M.paint, box(0.04, 2.2, 7), at(-W / 2 + 0.2, 1.4, 0.5), { color: tint('#b9c7d1') });
  for (const lz of [1.2, 3.6]) {
    batch.add('paint', M.paint, box(1.6, 0.45, 0.4), at(-7, 0.28, lz), { color: tint('#26282c') });
    solid(-7, lz, 0.8, 0.2, 0.6);
  }
  batch.add('paint', M.paint, box(2.4, 0.9, 0.5), at(-1.5, 0.5, 2.8), { color: tint('#3b3f45') });
  for (let i = 0; i < 6; i++) batch.add('paint', M.paint, box(0.3, 0.12, 0.12), at(-2.5 + i * 0.4, 1.0, 2.8), { color: tint('#1a1b1e') });
  solid(-1.5, 2.8, 1.2, 0.25, 1);
  // reception counter by the door, a speaker on it
  batch.add('paint', M.paint, box(2.6, 1.05, 0.7), at(-8.6, 0.55, 4.6), { color: tint('#c9b27a') });
  solid(-8.6, 4.6, 1.3, 0.35, 1.2);
  batch.add('paint', M.paint, box(0.45, 0.7, 0.4), at(9.8, 0.4, -4.6), { color: tint('#151618') }); // the empty speaker stand
  // posters
  for (const [lx, color] of [[-4, '#c8352d'], [0.5, '#2f5e8f'], [8, '#f2c230']]) batch.add('paint', M.paint, box(1.2, 1.6, 0.03), at(lx, 2.6, -D / 2 + 0.17), { color: tint(color) });

  // ---------- places the missions use ----------
  const world = (lx, lz, ry = 0) => { const p = g.toWorld(lx, lz); return { x: p.x, z: p.z, y: g.floorY, yaw: g.yaw + ry }; };
  places.gymDoor = world(0, D / 2 + 2.2, Math.PI);       // just outside, facing in
  places.gymInside = { ...world(0, 1.2, Math.PI), r: 4.5 };
  places.gymSpots = {
    erez: world(-5.5, -D / 2 + 2.6, Math.PI),            // at the middle bag
    yonati: world(-10.3, 0.8, Math.PI / 2),              // by the mirror
    muller: world(9.4, -3.6, -2.4),                       // by the empty speaker stand
    avraham: world(-1.4, 3.8, Math.PI * 0.9),
    ring: { ...world(R.x, R.z), y: g.floorY + R.h },
  };
  places.gymBags = bags;
  g.roof = roof;
  g.halfW = W / 2; g.halfD = D / 2; g.height = H;
}

// a punch pushes the bag's bottom along (fx, fz)
export function punchBag(bag, fx, fz, power = 1) {
  bag.vz += fx * 1.6 * power;
  bag.vx -= fz * 1.6 * power;
  bag.hits++;
}

// the roof lifts away while the camera is inside, and bags swing back to rest
export function update(gym, camera, dt, bags = []) {
  for (const b of bags) {
    b.vx += (-b.ax * 9 - b.vx * 1.8) * dt; b.ax += b.vx * dt;
    b.vz += (-b.az * 9 - b.vz * 1.8) * dt; b.az += b.vz * dt;
    b.pivot.rotation.set(b.ax, 0, b.az);
  }
  const cs = Math.cos(gym.yaw), sn = Math.sin(gym.yaw);
  const dx = camera.position.x - gym.c.x, dz = camera.position.z - gym.c.z;
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  gym.roof.visible = !(Math.abs(lx) < gym.halfW + 0.5 && Math.abs(lz) < gym.halfD + 0.5 && camera.position.y < gym.floorY + gym.height + 1.5);
}
