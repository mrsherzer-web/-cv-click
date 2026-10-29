// Street furniture: lamps, municipal bins, signs, a bus stop, benches, railings, the entrance gate,
// the lookout telescope and speed bumps. Static parts go into the shared batch; signs are their own meshes.
import * as THREE from 'three';
import { mat4 } from './batch.js';
import { tint } from './materials.js';
import { Tex } from './textures.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 8) => new THREE.CylinderGeometry(r0, r1, h, n);

function frame(x, y, z, yaw) {
  const base = mat4(x, y, z, yaw);
  return (lx, ly, lz, ry = 0, sx = 1, sy = 1, sz = 1, pitch = 0) => base.clone().multiply(mat4(lx, ly, lz, ry, sx, sy, sz, pitch));
}
const local = (x, z, yaw, lx, lz) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)];

// street lamp; the arm reaches toward local +z (over the street)
export function addLamp(batch, M, cols, x, y, z, yaw) {
  const at = frame(x, y, z, yaw);
  const c = tint('#5c6168');
  batch.add('paint', M.paint, cyl(0.07, 0.1, 6.2), at(0, 3.1, 0), { color: c });
  batch.add('paint', M.paint, box(0.08, 0.08, 1.5), at(0, 6.1, 0.7), { color: c });
  batch.add('paint', M.paint, box(0.28, 0.12, 0.6), at(0, 6.02, 1.45), { color: tint('#3d4147') });
  cols.addCircle(x, z, 0.15, y - 1, y + 6.5);
}

// the green municipal wheelie bin
export function addBin(batch, M, cols, x, y, z, yaw) {
  const at = frame(x, y, z, yaw);
  const g = tint('#2e6b3c');
  batch.add('paint', M.paint, box(0.6, 0.95, 0.68), at(0, 0.48, 0), { color: g });
  batch.add('paint', M.paint, box(0.64, 0.07, 0.74), at(0, 0.99, 0.02), { color: tint('#285c33') });
  cols.addCircle(x, z, 0.42, y - 1, y + 1.1);
}

// a plate on a pole; the plate faces local +z and shows the text on both sides
export function addSign(parent, batch, M, cols, x, y, z, yaw, text, { bg, fg, height = 2.4, w = 1.3, h = 0.32, size } = {}) {
  const at = frame(x, y, z, yaw);
  batch.add('paint', M.paint, cyl(0.04, 0.04, height + h / 2), at(0, (height + h / 2) / 2, 0), { color: tint('#8a8f96') });
  const mat = new THREE.MeshStandardMaterial({ map: Tex.sign(text, { bg, fg, size }), roughness: 0.6, side: THREE.DoubleSide });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plate.position.set(x, y + height, z);
  plate.rotation.y = yaw;
  plate.castShadow = true;
  parent.add(plate);
  cols.addCircle(x, z, 0.1, y - 1, y + height);
  return plate;
}

export function addBench(batch, M, cols, x, y, z, yaw) {
  const at = frame(x, y, z, yaw);
  const wood = tint('#8a6440'), metal = tint('#3d4147');
  for (let i = 0; i < 3; i++) batch.add('paint', M.paint, box(1.8, 0.05, 0.13), at(0, 0.45, -0.16 + i * 0.16), { color: wood });
  for (let i = 0; i < 2; i++) batch.add('paint', M.paint, box(1.8, 0.12, 0.04), at(0, 0.62 + i * 0.17, -0.26, 0, 1, 1, 1, -0.2), { color: wood });
  for (const lx of [-0.75, 0.75]) batch.add('paint', M.paint, box(0.06, 0.45, 0.5), at(lx, 0.22, -0.05), { color: metal });
  cols.addBox(x, z, 0.9, 0.3, yaw, y - 1, y + 1);
}

export function addBusStop(parent, batch, M, cols, x, y, z, yaw) {
  const at = frame(x, y, z, yaw);
  const steel = tint('#b8bdc3'), panel = tint('#2f5e8f');
  batch.add('paint', M.paint, box(3.6, 0.1, 1.6), at(0, 2.5, 0.2), { color: steel });
  batch.add('paint', M.paint, box(3.6, 1.9, 0.06), at(0, 1.45, -0.55), { color: panel });
  for (const lx of [-1.75, 1.75]) batch.add('paint', M.paint, box(0.08, 2.5, 0.08), at(lx, 1.25, -0.55), { color: steel });
  batch.add('paint', M.paint, box(2.6, 0.06, 0.4), at(0, 0.48, -0.3), { color: steel });
  batch.add('paint', M.paint, box(2.6, 0.48, 0.05), at(0, 0.24, -0.45), { color: steel });
  const mat = new THREE.MeshStandardMaterial({ map: Tex.sign('תחנת אוטובוס · קציר מרכז', { bg: '#f2f2ee', fg: '#1d4f91', size: 46, w: 768, h: 128 }), roughness: 0.6 });
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.4), mat);
  plate.position.set(...local3(x, y, z, yaw, 0, 2.24, 0.98));
  plate.rotation.y = yaw;
  parent.add(plate);
  cols.addBox(...local(x, z, yaw, 0, -0.5), 1.85, 0.12, yaw, y - 1, y + 2.6);
  cols.addCircle(...local(x, z, yaw, -1.75, -0.55), 0.1, y - 1, y + 2.6);
  cols.addCircle(...local(x, z, yaw, 1.75, -0.55), 0.1, y - 1, y + 2.6);
}
function local3(x, y, z, yaw, lx, ly, lz) {
  const [wx, wz] = local(x, z, yaw, lx, lz);
  return [wx, y + ly, wz];
}

// railing posts and rails along an arc of the lookout plaza (angles in radians, 0 = +x, counterclockwise from above)
export function addRailingArc(batch, M, cols, cx, y, cz, radius, a0, a1) {
  const c = tint('#4b5157');
  const steps = Math.max(2, Math.round((Math.abs(a1 - a0) * radius) / 1.6));
  let prev = null;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const px = cx + Math.cos(a) * radius, pz = cz - Math.sin(a) * radius;
    batch.add('paint', M.paint, box(0.07, 1.05, 0.07), mat4(px, y + 0.52, pz), { color: c });
    if (prev) {
      const mx = (px + prev[0]) / 2, mz = (pz + prev[1]) / 2, len = Math.hypot(px - prev[0], pz - prev[1]);
      const yaw = Math.atan2(px - prev[0], pz - prev[1]);
      for (const h of [1.02, 0.55]) batch.add('paint', M.paint, box(0.05, 0.05, len), mat4(mx, y + h, mz, yaw), { color: c });
      cols.addSegment(prev[0], prev[1], px, pz, 0.3, y - 1, y + 1.1);
    }
    prev = [px, pz];
  }
}

// the community entrance: a closed yellow barrier and a guard booth
export function addGate(parent, batch, M, cols, x, y, z, yaw, roadWidth) {
  const at = frame(x, y, z, yaw);
  batch.add('paint', M.paint, box(0.3, 1.0, 0.3), at(-roadWidth / 2 - 0.3, 0.5, 0), { color: tint('#3d4147') });
  batch.add('bump', M.bump, box(roadWidth + 0.4, 0.1, 0.1), at(0, 0.95, 0), {});
  batch.add('plaster', M.plaster, box(2.2, 2.6, 2.2), at(roadWidth / 2 + 2.6, 1.3, 0), { color: tint('#efeee9'), uv: 'world' });
  batch.add('paint', M.paint, box(2.5, 0.12, 2.5), at(roadWidth / 2 + 2.6, 2.66, 0), { color: tint('#2f5e8f') });
  batch.add('shutter', M.shutter, new THREE.PlaneGeometry(1.2, 0.9), at(roadWidth / 2 + 1.485, 1.6, 0, -Math.PI / 2), {});
  const [ax, az] = local(x, z, yaw, -roadWidth / 2 - 2.5, 0), [bx, bz] = local(x, z, yaw, roadWidth / 2 + 4, 0);
  cols.addSegment(ax, az, bx, bz, 0.6, y - 2, y + 1.2);
  cols.addBox(...local(x, z, yaw, roadWidth / 2 + 2.6, 0), 1.15, 1.15, yaw, y - 1, y + 2.8);
}

// coin-operated viewer at the lookout; returns its group so the mission can point the camera from it
export function makeTelescope(x, y, z, yaw) {
  const g = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: '#2f5a43', roughness: 0.5, metalness: 0.4 });
  const post = new THREE.Mesh(cyl(0.07, 0.1, 1.1), green);
  post.position.y = 0.55;
  const head = new THREE.Mesh(cyl(0.12, 0.09, 0.6, 12), green);
  head.rotation.x = Math.PI / 2 - 0.15;
  head.position.set(0, 1.25, 0.05);
  const box1 = new THREE.Mesh(box(0.22, 0.24, 0.2), green);
  box1.position.set(0, 1.08, -0.08);
  g.add(post, head, box1);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function addSpeedBump(batch, M, road, s) {
  const p = road.at(s);
  batch.add('bump', M.bump, box(road.width, 0.07, 0.9), mat4(p.x, p.h + 0.04, p.z, Math.atan2(p.tx, p.tz)), {});
}
