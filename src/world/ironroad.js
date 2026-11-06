// The iron road (chapter eight, the first chase): from the hideout's yard east across the plain to a
// fork; straight on Kotzi's truck closes the road (barriers run out into the fields on both sides),
// the old road bears left, north-east, through a long covered tunnel and on to the Iron Base. On the way:
// an overpass, a barricade with a gap, roadside things that go up as the Renault passes (a fuel drum, a
// shed, a wreck), and at the tunnel's far end a fall of rubble that closes it once the gang is through.
// Invented roads and places.
import * as THREE from 'three';
import { Road } from './roads.js';

const MAIN = [[676, -56], [705, -50], [745, -46], [790, -58], [840, -62], [885, -50], [925, -36], [962, -28], [1000, -24]];
const BRANCH = [[925, -36], [933, -58], [952, -88], [985, -114], [1025, -138], [1066, -160], [1096, -184], [1112, -214]];

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  const main = net.add(new Road(MAIN, { name: 'כביש הברזל', kind: 'highway', width: 8, sidewalk: 0, curb: 0, shoulder: 3, spacing: 2, baseHeight, maxGrade: 0.06 }));
  const fork = main.nearest(925, -36);
  const branch = net.add(new Road(BRANCH, { name: 'הדרך הישנה', kind: 'highway', width: 8, sidewalk: 0, curb: 0, shoulder: 3, spacing: 2, baseHeight, maxGrade: 0.06, startH: fork.h }));
  places.ironRoadMain = main; places.ironRoadBranch = branch;
  ctx.keepOut?.push({ x: 1010, z: -130, hx: 40, hz: 30 }); // the tunnel: no trees through its roof
  ctx.ironRoad = { main, branch, forkS: fork.s };
}

export function build(ctx) {
  const { places, M, cols, group } = ctx;
  const { main, branch, forkS } = ctx.ironRoad;
  const W = new THREE.Group(); W.name = 'iron road'; group.add(W);
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const add = (geo, mat, x, y, z, yaw = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = yaw; W.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const concrete = std({ color: '#b9b4a8', roughness: 0.9 }), dark = std({ color: '#2a2d33', roughness: 0.6, metalness: 0.2 }), rust = std({ color: '#8a4b2e', roughness: 0.85 });
  const yawAt = (p) => Math.atan2(p.tx, p.tz);
  const off = (road, s, o) => { const p = road.at(s); return { x: p.x + p.nx * o, z: p.z + p.nz * o, h: p.h, yaw: yawAt(p), p }; };
  const lamps = [], emissives = [];
  const bulb = std({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0 }); bulb.userData.night = 1.6; emissives.push(bulb);
  // jersey barriers in a line across (o0 .. o1 from the centreline at s), with a collider
  const barrier = (road, s, o0, o1) => {
    const a = off(road, s, o0), b = off(road, s, o1), len = Math.hypot(b.x - a.x, b.z - a.z), yaw = Math.atan2(b.x - a.x, b.z - a.z);
    add(box(0.6, 1.0, len), concrete, (a.x + b.x) / 2, Math.max(a.h, b.h) + 0.5, (a.z + b.z) / 2, yaw);
    cols.addSegment(a.x, a.z, b.x, b.z, 0.6, Math.min(a.h, b.h) - 1, Math.max(a.h, b.h) + 1.2);
  };
  // a long line of barriers beside a road (out into the fields)
  const fence = (x0, z0, x1, z1, h0) => { const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0); add(box(0.6, 1.0, len), concrete, (x0 + x1) / 2, h0 + 0.5, (z0 + z1) / 2, yaw); cols.addSegment(x0, z0, x1, z1, 0.6, h0 - 3, h0 + 1.4); };

  // ---------- the overpass: a deck across the road on two piers ----------
  { const p = off(main, 120, 0), yaw = p.yaw + Math.PI / 2;
    add(box(3, 0.8, 34), concrete, p.x, p.h + 6.2, p.z, yaw);
    for (const o of [-8.5, 8.5]) { const q = off(main, 120, o); add(box(1.2, 6, 2.6), concrete, q.x, q.h + 3, q.z, p.yaw); cols.addBox(q.x, q.z, 0.6, 1.3, p.yaw, q.h - 1, q.h + 6); }
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.8), std({ color: '#2fa055', roughness: 0.6 })); sg.position.set(p.x - p.p.tx * 1.6, p.h + 6.3, p.z - p.p.tz * 1.6); sg.rotation.y = p.yaw + Math.PI; W.add(sg); }

  // ---------- the barricade: two blocks of barriers leaving a gap in the middle ----------
  const barS = main.nearest(840, -62).s;
  barrier(main, barS, -7.5, -2.6); barrier(main, barS, 2.6, 7.5);
  for (const o of [-5, 5]) { const q = off(main, barS - 1.2, o); add(box(0.25, 1.6, 0.25), std({ color: '#ff7a2e' }), q.x, q.h + 0.8, q.z); }

  // ---------- the fork: Kotzi's truck across the straight road, barriers out into the fields ----------
  const truckS = forkS + 48, t = off(main, truckS, 0), tyaw = t.yaw + Math.PI / 2;
  add(box(2.6, 3.2, 10.5), dark, t.x, t.h + 1.9, t.z, tyaw);                           // the box
  { const c = off(main, truckS, 6.4); add(box(2.5, 2.4, 2.6), std({ color: '#1c1f26', roughness: 0.5 }), c.x, c.h + 1.5, c.z, tyaw); } // the cab
  for (const o of [-4, -1.5, 1.5, 4]) { const w = off(main, truckS, o); add(new THREE.CylinderGeometry(0.5, 0.5, 2.7, 12).rotateX(Math.PI / 2), std({ color: '#111' }), w.x, w.h + 0.5, w.z, t.yaw); }
  { const sg = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.1), std({ map: null, color: '#ffd166', roughness: 0.7 })); const q = off(main, truckS - 1.4, 0); sg.position.set(q.x, q.h + 2.6, q.z); sg.rotation.y = t.yaw + Math.PI; W.add(sg); }
  cols.addBox(t.x, t.z, 7.6, 1.5, t.yaw, t.h - 1, t.h + 3.6);                        // the truck and its cab block the whole road
  { const a = off(main, truckS, 7.6), b = off(main, truckS, -7.6), tx = t.p.tx, tz = t.p.tz;
    // barriers from the truck's ends out into the fields: no way round it
    fence(a.x, a.z, a.x + t.p.nx * 34 - tx * 6, a.z + t.p.nz * 34 - tz * 6, a.h);
    fence(b.x, b.z, b.x - t.p.nx * 34 - tx * 6, b.z - t.p.nz * 34 - tz * 6, b.h); }
  const blocked = { ...off(main, truckS, 0), s: truckS };

  // ---------- the tunnel on the old road: walls, a roof, lamps ----------
  const tin = branch.nearest(990, -117).s, tout = branch.nearest(1052, -153).s;
  const wallMat = std({ color: '#8a8580', roughness: 0.95 }), roofMat = std({ color: '#6f6a64', roughness: 0.95 });
  for (let s = tin; s < tout; s += 4) {
    const s1 = Math.min(tout, s + 4), a = branch.at(s), b = branch.at(s1), mid = branch.at((s + s1) / 2), len = Math.hypot(b.x - a.x, b.z - a.z) + 0.05, yaw = Math.atan2(b.x - a.x, b.z - a.z);
    for (const side of [-1, 1]) {
      const o = side * 7.3, ax = a.x + a.nx * o, az = a.z + a.nz * o, bx = b.x + b.nx * o, bz = b.z + b.nz * o;
      add(box(0.8, 5.6, len), wallMat, (ax + bx) / 2, mid.h + 2.6, (az + bz) / 2, yaw);
      cols.addSegment(ax, az, bx, bz, 0.8, mid.h - 2, mid.h + 5.6);
    }
    add(box(15.4, 0.6, len), roofMat, mid.x, mid.h + 5.6, mid.z, yaw);
  }
  for (let s = tin + 8; s < tout; s += 16) { const p = branch.at(s); const lamp = add(new THREE.SphereGeometry(0.16, 8, 6), bulb, p.x, p.h + 5.1, p.z); lamps.push({ x: p.x, y: p.h + 5, z: p.z, inside: true, range: 16, intensity: 26, color: '#ffd9a0' }); void lamp; }
  for (const s of [tin, tout]) { const p = branch.at(s); const face = add(box(17, 1.6, 0.8), concrete, p.x, p.h + 6.4, p.z, yawAt(p)); void face; }
  const tunnel = { in: tin, out: tout, start: { ...off(branch, tin, 0) }, end: { ...off(branch, tout, 0) } };

  // ---------- the fall of rubble that closes the tunnel's far end (shown by the mission) ----------
  const fall = new THREE.Group(); fall.visible = false; W.add(fall);
  { const p = branch.at(tout - 3), yaw = yawAt(p);
    for (let k = 0; k < 14; k++) { const o = -6 + (k % 7) * 2, along = (k < 7 ? 0 : 1.6), s = 0.9 + ((k * 37) % 10) / 10; const m = new THREE.Mesh(box(s * 2.2, s * 1.4, s * 1.8), std({ color: '#6f6a62', roughness: 0.95 })); m.position.set(p.x + p.nx * o - p.tx * along, p.h + s * 0.7 + (k < 7 ? 0 : 1.1), p.z + p.nz * o - p.tz * along); m.rotation.set(k * 0.4, k * 0.9, k * 0.2); fall.add(m); } }
  let fallBody = null;
  const collapse = {
    ...off(branch, tout - 3, 0), s: tout - 3,
    close() { if (fallBody) return; fall.visible = true; const p = branch.at(tout - 3); fallBody = cols.addBox(p.x, p.z, 7.6, 2.4, yawAt(p), p.h - 1, p.h + 6); },
    open() { fall.visible = false; if (fallBody) { cols.remove(fallBody); fallBody = null; } },
  };

  // ---------- the roadside things that go up as the Renault passes (the mission sets them off) ----------
  const blasts = [];
  const things = [[40, 12, 'drum'], [75, -12, 'shed'], [150, 11, 'wreck'], [200, -12, 'drum'], [245, 12, 'shed'], [290, -11, 'wreck'], [325, 12, 'drum']];
  for (const [s, o, kind] of things) {
    if (s > forkS - 25) continue;
    const q = off(main, s, o);
    if (kind === 'drum') for (let k = 0; k < 3; k++) add(new THREE.CylinderGeometry(0.35, 0.35, 1.0, 10), std({ color: '#c8352d', roughness: 0.6 }), q.x + (k - 1) * 0.8, q.h + 0.5, q.z + (k % 2) * 0.6);
    else if (kind === 'shed') { add(box(4, 2.6, 3), std({ color: '#7d6b52', roughness: 0.9 }), q.x, q.h + 1.3, q.z, q.yaw); add(box(4.4, 0.15, 3.4), rust, q.x, q.h + 2.7, q.z, q.yaw); }
    else { add(box(1.8, 1.0, 4), rust, q.x, q.h + 0.6, q.z, q.yaw + 0.5); add(box(1.6, 0.6, 2), rust, q.x, q.h + 1.3, q.z, q.yaw + 0.5); }
    blasts.push({ x: q.x, y: q.h, z: q.z, s, kind, size: kind === 'drum' ? 1.6 : kind === 'shed' ? 2.2 : 1.9 });
  }
  // road lights every 60 m along the main road
  for (let s = 20; s < main.length - 10; s += 60) { const q = off(main, s, 6.2); add(new THREE.CylinderGeometry(0.07, 0.09, 6, 8), dark, q.x, q.h + 3, q.z); add(new THREE.SphereGeometry(0.2, 8, 6), bulb, q.x, q.h + 6.1, q.z); lamps.push({ x: q.x, y: q.h + 6, z: q.z, inside: false, range: 22, intensity: 40 }); }

  const endP = branch.at(branch.length - 2);
  places.ironRoad = {
    main, branch, fork: { s: forkS, ...off(main, forkS, 0), branchS: 0 }, blocked, barricade: { s: barS, ...off(main, barS, 0) },
    tunnel, collapse, blasts,
    start: { ...off(main, 6, -2), s: 6 },
    end: { x: endP.x, z: endP.z, y: endP.h, yaw: yawAt(endP), s: branch.length - 2 },
    lamps, emissives, group: W,
  };
}
