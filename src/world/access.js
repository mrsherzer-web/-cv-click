// Outside Katzir's gate: a small commercial center with parking (the gym, the kiosk), and the access
// road that winds around the hill and down to the coastal plain. Fictional and compressed.
import * as THREE from 'three';
import { Road } from './roads.js';
import { mat4 } from './batch.js';
import { tint } from './materials.js';
import { Tex } from './textures.js';
import * as P from './props.js';
import { yawFacing } from './katzir.js';

const ACCESS = [[172, 30], [212, 38], [246, 34], [274, 18], [296, -10], [307, -52], [302, -100], [280, -146], [240, -188], [182, -224],
  [110, -250], [30, -264], [-60, -270], [-150, -264], [-240, -248], [-330, -220], [-420, -186], [-500, -158], [-560, -142]];
const LOT_S = 54; // where the commercial center's parking lot meets the road

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  const main = places.mainRoad, g = main.at(0);
  const road = net.add(new Road(ACCESS, { name: 'כביש הגישה', kind: 'highway', width: 7.5, sidewalk: 0, curb: 0, shoulder: 3.5, spacing: 2, baseHeight, startH: g.h, maxGrade: 0.075 }));
  places.accessRoad = road;
  // the parking lot of the commercial center, on the south side of the road (its left, driving out)
  const p = road.at(LOT_S), yaw = yawFacing(p.tx, p.tz), depth = 36;
  const off = road.width / 2 + depth / 2 + 0.6;
  places.lot = net.addPad({ x: p.x + p.nx * off, z: p.z + p.nz * off, hx: depth / 2, hz: 25, yaw, h: p.h, top: 0.03, blend: 9, name: 'commercial lot' });
  places.lot.road = { s: LOT_S, nx: p.nx, nz: p.nz, tx: p.tx, tz: p.tz, yaw }; // n points from the road into the lot
}

export function build(ctx) {
  const { group, M, r, cols, batch, veg, terrain, places, net } = ctx;
  const road = places.accessRoad, W2 = road.width / 2, L = road.length;
  const along = (s, sd, d) => {
    const p = road.at(s);
    return { x: p.x + p.nx * sd * d, z: p.z + p.nz * sd * d, h: p.h, tx: p.tx, tz: p.tz, nx: p.nx * sd, nz: p.nz * sd };
  };

  // ---------- the road: asphalt, white lines, dusty shoulders ----------
  batch.add('asphalt', M.asphalt, road.ribbon(-W2, W2, 0.02, 1 / 7), null, {});
  for (const sd of [1, -1]) batch.add('asphalt', M.asphalt, road.ribbon(sd * W2, sd * (W2 + 1.4), 0.0, 1 / 7), null, { color: tint('#c9bfae') });
  for (const g of road.line(0, 0.14, 0.035, 3, 6)) batch.add('paint', M.paint, g, null, { color: tint('#ecebe5') });
  for (const sd of [1, -1]) batch.add('paint', M.paint, road.line(sd * (W2 - 0.25), 0.12, 0.035), null, { color: tint('#ecebe5') });

  // guardrails wherever the land falls away beside the road
  for (const sd of [1, -1]) {
    let run = null;
    const flush = () => {
      if (run && run[1] - run[0] > 8) guardrail(batch, M, cols, road, sd, W2 + 1.6, run[0], run[1]);
      run = null;
    };
    for (let s = 6; s < L - 4; s += 4) {
      const q = along(s, sd, W2 + 9), drop = road.at(s).h - terrain.heightAt(q.x, q.z);
      if (drop > 2.2 && !net.padAt(q.x, q.z)) run = run ? [run[0], s] : [s, s];
      else flush();
    }
    flush();
  }

  // pines and olives on the hillside, eucalyptus lower down
  for (let i = 0; i < 520; i++) {
    const s = r() * L, sd = r() < 0.5 ? 1 : -1, t = along(s, sd, W2 + 9 + r() * 60);
    const n = net.nearest(t.x, t.z, 40);
    if ((n && n.d < n.road.halfSurface + 7) || net.padAt(t.x, t.z)) continue;
    const y = terrain.heightAt(t.x, t.z), low = y < -38;
    veg.push({ kind: low ? (r() < 0.6 ? 'eucalyptus' : 'olive') : r() < 0.75 ? 'pine' : 'olive', x: t.x, y: y - 0.2, z: t.z, s: 0.8 + r() * 0.5 });
    cols.addCircle(t.x, t.z, 0.4, y - 1, y + 5);
  }

  // signs: leaving Katzir, and the curve warnings on the way down
  // a sign faces the drivers who read it: those driving toward increasing s, or back toward Katzir
  const sign = (s, sd, lines, { back = false } = {}) => {
    const t = along(s, sd, W2 + 2.2), f = back ? 1 : -1;
    directionSign(group, batch, M, cols, t.x, road.at(s).h, t.z, yawFacing(f * t.tx, f * t.tz), lines);
  };
  sign(30, -1, ['חדרה ←', 'גן שמואל ←']);
  sign(L - 40, 1, ['קציר →'], { back: true });

  // ---------- commercial center: parking lot and the kiosk (the gym is built with its interior) ----------
  const lot = places.lot, lr = lot.road;
  const lotAt = (along, out) => ({ x: lot.x + lr.tx * along + lr.nx * out, z: lot.z + lr.tz * along + lr.nz * out });
  batch.add('asphalt', M.asphalt, new THREE.BoxGeometry(lot.hx * 2, 0.1, lot.hz * 2), mat4(lot.x, lot.h + lot.top - 0.05, lot.z, lot.yaw), { uv: 'world', uvScale: 1 / 7 });
  for (let i = -4; i <= 4; i++) { // parking bays in front of the gym
    const p = lotAt(i * 2.6 - 1.3, 0.5);
    batch.add('paint', M.paint, new THREE.BoxGeometry(5, 0.02, 0.12), mat4(p.x, lot.h + lot.top + 0.012, p.z, lot.yaw), { color: tint('#ecebe5') });
  }
  places.gymParking = { ...lotAt(0, 0.5), y: lot.h + lot.top, yaw: Math.atan2(lr.nx, lr.nz), r: 4.5 };
  places.gymLot = { x: lot.x, z: lot.z, y: lot.h + lot.top, yaw: lot.yaw, along: lr, at: lotAt };
  // kiosk at the east end of the lot
  {
    const k = lotAt(18, 9), y = lot.h + lot.top, yaw = Math.atan2(-lr.nx, -lr.nz);
    batch.add('plaster', M.plaster, new THREE.BoxGeometry(7, 3.2, 6), mat4(k.x, y + 1.6, k.z, yaw), { color: tint('#f1e6d2'), uv: 'world', uvScale: 0.3 });
    batch.add('paint', M.paint, new THREE.BoxGeometry(7.8, 0.15, 2.2), mat4(k.x - lr.nx * 4, y + 2.7, k.z - lr.nz * 4, yaw), { color: tint('#c8352d') });
    batch.add('shutter', M.shutter, new THREE.PlaneGeometry(4.2, 1.6), mat4(k.x - lr.nx * 3.02, y + 1.4, k.z - lr.nz * 3.02, yaw), {});
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 0.7), new THREE.MeshStandardMaterial({ map: Tex.sign('קיוסק הגבעה', { bg: '#f2c230', fg: '#2a2116', w: 768, h: 128, size: 70, border: false }), roughness: 0.6 }));
    m.position.set(k.x - lr.nx * 3.03, y + 3.35, k.z - lr.nz * 3.03);
    m.rotation.y = yaw;
    group.add(m);
    cols.addBox(k.x, k.z, 3.5, 3, yaw, y - 1, y + 3.4);
  }
  for (const a of [-22, 22]) { // lamp posts at the lot's corners
    const p = lotAt(a, -lot.hx + 1.2);
    P.addLamp(batch, M, cols, p.x, lot.h + lot.top, p.z, Math.atan2(-lr.nx, -lr.nz));
  }
}

// W-beam guardrail on posts along one side of a road
export function guardrail(batch, M, cols, road, sd, off, s0, s1) {
  const steel = tint('#a9adb2');
  let prev = null;
  for (let s = s0; s <= s1 + 0.01; s += 4) {
    const p = road.at(s), x = p.x + p.nx * sd * off, z = p.z + p.nz * sd * off, y = p.h;
    batch.add('paint', M.paint, new THREE.BoxGeometry(0.1, 0.8, 0.1), mat4(x, y + 0.4, z), { color: tint('#7b8087') });
    if (prev) {
      const len = Math.hypot(x - prev.x, z - prev.z), yaw = Math.atan2(x - prev.x, z - prev.z);
      batch.add('paint', M.paint, new THREE.BoxGeometry(0.06, 0.32, len + 0.05), mat4((x + prev.x) / 2, (y + prev.y) / 2 + 0.6, (z + prev.z) / 2, yaw, 1, 1, 1, -Math.atan2(y - prev.y, len)), { color: steel });
      cols.addSegment(prev.x, prev.z, x, z, 0.3, Math.min(y, prev.y) - 1, Math.max(y, prev.y) + 1);
    }
    prev = { x, y, z };
  }
}

// green direction sign on two posts, one line of text per destination
export function directionSign(parent, batch, M, cols, x, y, z, yaw, lines) {
  const w = 2.6, h = 0.55 * lines.length + 0.2, top = 2.6 + h;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: Tex.sign(lines, { bg: '#1f6b45', fg: '#ffffff', w: 512, h: Math.round((512 * h) / w), size: 64 }), roughness: 0.6 }));
  m.position.set(x, y + top - h / 2, z);
  m.rotation.y = yaw;
  m.userData.sign = true;
  parent.add(m);
  // the back of the sign: plain metal
  batch.add('paint', M.paint, new THREE.PlaneGeometry(w, h).rotateY(Math.PI), mat4(x - Math.sin(yaw) * 0.02, y + top - h / 2, z - Math.cos(yaw) * 0.02, yaw), { color: tint('#7b8087') });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const lx of [-w * 0.35, w * 0.35]) {
    const px = x + lx * c, pz = z - lx * s;
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.05, 0.05, top, 8), mat4(px, y + top / 2, pz), { color: tint('#8a8f96') });
    cols.addCircle(px, pz, 0.1, y - 1, y + top);
  }
}
