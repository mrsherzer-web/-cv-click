// Kotzi's road (chapter eight, the second chase): from the bridge's east end south through an
// industrial strip (containers, sheds, a gantry, two trucks half across the road), west along a wide
// highway with two ramps that throw a fast car into the air, and through an abandoned compound (broken
// walls, rubble, a ruined gate arch) to the headquarters' gate. Kotzi's car follows `path`. Invented.
import * as THREE from 'three';
import { Road } from './roads.js';
import { roadPath } from '../vehicle/autopilot.js';

const K1 = [[1062, 150], [1082, 158], [1094, 180], [1097, 210], [1097, 240], [1095, 268], [1084, 290], [1064, 301]];
const K2 = [[1064, 301], [1030, 302], [990, 301], [950, 300], [912, 300], [880, 298]];
const K3 = [[880, 298], [858, 290], [843, 272], [836, 251], [826, 232], [808, 214], [792, 200]];

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  const opt = { kind: 'highway', sidewalk: 0, curb: 0, spacing: 2, baseHeight, maxGrade: 0.06 };
  const k1 = net.add(new Road(K1, { ...opt, name: 'דרך התעשייה', width: 8, shoulder: 3, startH: ctx.bridge?.y != null ? ctx.bridge.y - 0.05 : null }));
  const k2 = net.add(new Road(K2, { ...opt, name: 'הכביש המהיר', width: 11, shoulder: 4, startH: k1.h[k1.n - 1] }));
  const k3 = net.add(new Road(K3, { ...opt, name: 'דרך המתחם', width: 8, shoulder: 3, startH: k2.h[k2.n - 1], endH: ctx.hqY ?? null }));
  places.kotziRoads = [k1, k2, k3];
  ctx.keepOut?.push({ x: 1097, z: 225, hx: 30, hz: 60 }, { x: 840, z: 260, hx: 26, hz: 30 });
  // the two ramps on the highway: walking surfaces (the car rides them), set out here so the terrain is not shaped by them
  ctx.kotziRoad = { k1, k2, k3, ramps: [] };
  for (const s0 of [70, 140]) {
    const p0 = k2.at(s0), yaw = Math.atan2(p0.tx, p0.tz), n = 7, run = 8, rise = 1.2, lane = -2.4; // on the left lane, heading west
    for (let k = 1; k <= n; k++) { const sk = s0 + (k - 0.5) * run / n, p = k2.at(sk); net.addPad({ x: p.x + p.nx * lane, z: p.z + p.nz * lane, hx: 2.4, hz: run / n / 2 + 0.02, yaw, h: p.h + rise * k / n - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'ramp' }); }
    ctx.kotziRoad.ramps.push({ s: s0, run, rise, lane, yaw });
  }
}

export function build(ctx) {
  const { places, cols, group } = ctx;
  const { k1, k2, k3, ramps } = ctx.kotziRoad;
  const G = new THREE.Group(); G.name = 'kotzi road'; group.add(G);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const add = (geo, mat, x, y, z, yaw = 0, pitch = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(pitch, yaw, 0, 'YXZ'); G.add(m); return m; };
  const off = (road, s, o) => { const p = road.at(s); return { x: p.x + p.nx * o, z: p.z + p.nz * o, h: p.h, yaw: Math.atan2(p.tx, p.tz), p }; };
  const solidAt = (q, hx, hz, top, yaw = q.yaw) => cols.addBox(q.x, q.z, hx, hz, yaw, q.h - 1, q.h + top);
  const lamps = [], emissives = [];
  const bulb = std({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0 }); bulb.userData.night = 1.6; emissives.push(bulb);
  const contColors = ['#2b6a8f', '#8a4b2e', '#2f7a4a', '#7a2b2b', '#6b6f75', '#c8a23a'];
  // ---------- the industrial strip along the first road: containers and sheds either side ----------
  let ci = 0;
  for (let s = 40; s < k1.length - 30; s += 13) for (const side of [-1, 1]) {
    const o = side * (10 + (ci % 3) * 1.5), q = off(k1, s, o), stack = ci % 4 === 0 ? 2 : 1, col = contColors[ci % contColors.length];
    for (let k = 0; k < stack; k++) add(box(2.5, 2.6, 6.1), std({ color: col, roughness: 0.6, metalness: 0.3 }), q.x, q.h + 1.3 + k * 2.62, q.z, q.yaw + (ci % 2 ? 0.08 : -0.05));
    solidAt(q, 1.25, 3.05, 2.6 * stack, q.yaw); ci++;
  }
  { const q = off(k1, 95, 0); add(box(22, 0.8, 1.2), std({ color: '#c8a23a', metalness: 0.4 }), q.x, q.h + 8, q.z, q.yaw + Math.PI / 2); for (const o of [-10.5, 10.5]) { const r = off(k1, 95, o); add(box(0.8, 8, 0.8), std({ color: '#c8a23a', metalness: 0.4 }), r.x, r.h + 4, r.z); cols.addBox(r.x, r.z, 0.45, 0.45, 0, r.h - 1, r.h + 8); } } // the gantry
  // two trucks, each half across the road (a gap of five metres or more beside them)
  const trucks = [];
  for (const [s, o] of [[70, -2.6], [120, 2.6]]) { const q = off(k1, s, o); add(box(3.0, 3.2, 9), std({ color: '#1c1f26', roughness: 0.6 }), q.x, q.h + 1.9, q.z, q.yaw + 0.25); solidAt(q, 1.6, 4.6, 3.4, q.yaw + 0.25); trucks.push({ ...q, s }); }
  for (let s = 20; s < k1.length; s += 40) { const q = off(k1, s, 6.4); add(new THREE.CylinderGeometry(0.07, 0.09, 6, 8), std({ color: '#3a3d44' }), q.x, q.h + 3, q.z); add(new THREE.SphereGeometry(0.2, 8, 6), bulb, q.x, q.h + 6.1, q.z); lamps.push({ x: q.x, y: q.h + 6, z: q.z, inside: false, range: 22, intensity: 40 }); }
  // ---------- the highway: barriers in the middle, the ramps, lights ----------
  for (let s = 10; s < k2.length - 10; s += 12) { const q = off(k2, s, 0.2); add(box(0.5, 0.8, 11), std({ color: '#b9b4a8', roughness: 0.9 }), q.x, q.h + 0.4, q.z, q.yaw); }
  for (let s = 10; s < k2.length - 10; s += 12) { const q = off(k2, s, 0.2); cols.addBox(q.x, q.z, 0.25, 5.5, q.yaw, q.h - 1, q.h + 0.8); }
  const rampMat = std({ color: '#c8a23a', roughness: 0.7 });
  for (const r of ramps) { const a = off(k2, r.s, r.lane), b = off(k2, r.s + r.run, r.lane), mid = off(k2, r.s + r.run / 2, r.lane); const pitch = -Math.atan2(r.rise, r.run); add(box(4.8, 0.3, Math.hypot(r.run, r.rise)), rampMat, mid.x, mid.h + r.rise / 2, mid.z, mid.yaw, pitch); add(box(4.8, r.rise, 0.3), rampMat, b.x, b.h + r.rise / 2, b.z, b.yaw); void a; }
  for (let s = 20; s < k2.length; s += 45) for (const o of [-7.8, 7.8]) { const q = off(k2, s, o); add(new THREE.CylinderGeometry(0.07, 0.09, 7, 8), std({ color: '#3a3d44' }), q.x, q.h + 3.5, q.z); add(new THREE.SphereGeometry(0.2, 8, 6), bulb, q.x, q.h + 7.1, q.z); lamps.push({ x: q.x, y: q.h + 7, z: q.z, inside: false, range: 24, intensity: 42 }); }
  // ---------- the abandoned compound on the last road: broken walls, rubble, the gate arch ----------
  const ruinMat = std({ color: '#9c8f80', roughness: 0.95 });
  for (const [s, o, len, h] of [[20, -9, 14, 3], [32, 9, 10, 2.2], [50, -10, 18, 2.6], [64, 9.5, 12, 3.2], [80, -9, 9, 1.8], [96, 10, 14, 2.4]]) { const q = off(k3, s, o); add(box(0.6, h, len), ruinMat, q.x, q.h + h / 2, q.z, q.yaw); cols.addBox(q.x, q.z, 0.3, len / 2, q.yaw, q.h - 1, q.h + h); }
  for (let k = 0; k < 16; k++) { const s = 15 + k * 7, o = (k % 2 ? 1 : -1) * (6.6 + (k % 3)), q = off(k3, s, o), z = 0.5 + (k % 4) * 0.25; add(box(z * 2, z, z * 1.6), ruinMat, q.x, q.h + z / 2, q.z, k * 0.7); }
  { const q = off(k3, 58, 0); for (const o of [-6.2, 6.2]) { const r = off(k3, 58, o); add(box(1.2, 5, 1.2), ruinMat, r.x, r.h + 2.5, r.z); cols.addBox(r.x, r.z, 0.6, 0.6, 0, r.h - 1, r.h + 5); } add(box(13.6, 1, 1.2), ruinMat, q.x, q.h + 5.4, q.z, q.yaw + Math.PI / 2); }
  // ---------- the roadside things that go up as the cars pass ----------
  const blasts = [];
  for (const [road, name, list] of [[k1, 'k1', [[30, 12], [85, -12], [150, 13]]], [k2, 'k2', [[40, 11], [110, -11], [175, 11]]], [k3, 'k3', [[40, 10], [88, -11]]]]) for (const [s, o] of list) {
    if (s > road.length - 8) continue;
    const q = off(road, s, o);
    for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 10), std({ color: '#c8352d', roughness: 0.6 }), q.x + (k - 1) * 0.8, q.h + 0.5, q.z + (k % 2) * 0.6);
    blasts.push({ x: q.x, y: q.h, z: q.z, s, road: name, size: 1.8 });
  }
  // Kotzi's way: down the three roads, on the middle of each (lane 0), the ramps avoided (they are on the left lane)
  const path = [...roadPath(k1, 4, k1.length - 2, 0), ...roadPath(k2, 2, k2.length - 2, 2.6), ...roadPath(k3, 2, k3.length - 1, 0)];
  const end = k3.at(k3.length - 1);
  places.kotziRoad = {
    k1, k2, k3, roads: { k1, k2, k3 }, trucks, ramps: ramps.map((r) => ({ ...r, ...off(k2, r.s, r.lane), end: off(k2, r.s + r.run, r.lane) })), blasts, path,
    start: { ...off(k1, 3, -2), s: 3 }, kotziStart: { ...off(k1, 22, 1.5), s: 22 },
    checkpoints: [{ road: 'k1', s: 3 }, { road: 'k2', s: 4 }, { road: 'k3', s: 4 }],
    end: { x: end.x, z: end.z, y: end.h, yaw: Math.atan2(end.tx, end.tz) },
    lamps, emissives, group: G,
  };
}
