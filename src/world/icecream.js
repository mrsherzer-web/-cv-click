// The ice-cream stand by the Gan Shmuel gate (chapter six): a small kiosk with a parasol, a freezer
// counter, a picnic table under string lights, where the night ends. Nothing here is a real business;
// the sign is the game's own. Built off the end of the short road up to the kibbutz gate.
import * as THREE from 'three';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { Tex } from './textures.js';

let site = null;

export function layout(ctx) {
  const { net, places } = ctx;
  const kr = places.kibbutzRoad; if (!kr) return;
  const e = kr.at(kr.length);
  // to the right of the gate (the side with the stone sign), a few metres back from the gate line
  const cx = e.x + e.nx * 15 - e.tx * 9, cz = e.z + e.nz * 15 - e.tz * 9;
  const yaw = Math.atan2(-e.nx, -e.nz);        // local +z faces the road
  const cs = Math.cos(yaw), sn = Math.sin(yaw);
  const toWorld = (lx, lz) => ({ x: cx + lx * cs + lz * sn, z: cz - lx * sn + lz * cs });
  net.addPad({ x: cx, z: cz, hx: 8, hz: 7, yaw, h: e.h, top: 0.05, blend: 7, name: 'ice cream' });
  ctx.keepOut?.push({ x: cx, z: cz, hx: 12, hz: 11 });
  site = { cx, cz, yaw, cs, sn, toWorld, y: e.h + 0.05, e };
}

export function build(ctx) {
  const { group: parent, M, cols, places } = ctx;
  if (!site) return;
  const { cx, cz, yaw, toWorld, y: Y, e } = site;
  const group = new THREE.Group();
  group.name = 'icecream';
  parent.add(group);
  const batch = new Batch();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r0, r1, h, n = 12) => new THREE.CylinderGeometry(r0, r1, h, n);
  const at = (lx, ly, lz, ry = 0) => { const w = toWorld(lx, lz); return mat4(w.x, Y + ly, w.z, yaw + ry); };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const mesh = (geo, mat, lx, ly, lz, ry = 0) => { const m = new THREE.Mesh(geo, mat); const w = toWorld(lx, lz); m.position.set(w.x, Y + ly, w.z); m.rotation.y = yaw + ry; group.add(m); return m; };
  const solid = (lx, lz, hx, hz, top) => { const w = toWorld(lx, lz); cols.addBox(w.x, w.z, hx, hz, yaw, Y - 1, Y + top); };
  const bulbMat = std({ color: '#fff3d6', emissive: '#ffd27a', emissiveIntensity: 0 }); bulbMat.userData.night = 1.8;
  const neonMat = std({ color: '#ffd1ea', emissive: '#ff6fb0', emissiveIntensity: 0 }); neonMat.userData.night = 1.5;

  // the paved patch
  batch.add('pavers', M.pavers, box(14, 0.06, 12), at(0, 0.0, 0), { uv: 'world', uvScale: 0.25 });
  // the kiosk: a counter with a freezer top, a back wall, a canopy on two posts, the sign
  batch.add('plaster', M.plaster, box(3.6, 1.0, 0.9), at(0, 0.5, -3.2), { color: tint('#f3e6cc'), uv: 'world' }); solid(0, -3.2, 1.8, 0.45, 1.0);
  mesh(box(3.5, 0.06, 0.8), std({ color: '#d7e4ee', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 }), 0, 1.03, -3.2);
  for (const [i, c] of ['#ff8fb1', '#f6e3a0', '#9ad7a8', '#8fc6ff', '#f2b27a', '#e9d2c4'].entries()) mesh(cyl(0.22, 0.22, 0.1, 12), std({ color: c, roughness: 0.9 }), -1.4 + i * 0.56, 1.0, -3.2); // the tubs under the glass
  batch.add('plaster', M.plaster, box(3.8, 2.6, 0.2), at(0, 1.3, -4.3), { color: tint('#f3e6cc'), uv: 'world' }); solid(0, -4.3, 1.9, 0.1, 2.6);
  for (const sx of [-1.7, 1.7]) batch.add('paint', M.paint, box(0.08, 2.6, 0.08), at(sx, 1.3, -2.6), { color: tint('#2a2a2e') });
  batch.add('paint', M.paint, box(4.2, 0.06, 2.2), at(0, 2.6, -3.5), { color: tint('#c8352d') });
  for (let k = 0; k < 7; k++) batch.add('paint', M.paint, box(0.6, 0.06, 2.2), at(-1.8 + k * 0.6, 2.61, -3.5), { color: tint(k % 2 ? '#f6f1e6' : '#c8352d') }); // the striped awning
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), std({ map: Tex.sign('גלידה · גן שמואל', { bg: '#f6f1e6', fg: '#c8352d', w: 1024, h: 192, size: 112 }), roughness: 0.6 }));
  const sw = toWorld(0, -4.18); sign.position.set(sw.x, Y + 2.15, sw.z); sign.rotation.y = yaw; group.add(sign);
  mesh(new THREE.TorusGeometry(0.25, 0.04, 8, 24), neonMat, 1.3, 2.15, -4.17); // a neon ring beside the sign
  // a cone-shaped sign on the roof
  mesh(cyl(0.0, 0.22, 0.7, 12), std({ color: '#d9a441', roughness: 0.8 }), -1.3, 2.95, -3.6); mesh(new THREE.SphereGeometry(0.26, 12, 10), std({ color: '#ff8fb1' }), -1.3, 3.45, -3.6);
  // the picnic table under a parasol, benches either side
  batch.add('wood', M.plaster, box(1.8, 0.06, 0.8), at(0, 0.74, 1.2), { color: tint('#b8955e') }); solid(0, 1.2, 0.9, 0.4, 0.76);
  for (const sz of [-0.7, 0.7]) { batch.add('wood', M.plaster, box(1.8, 0.05, 0.3), at(0, 0.45, 1.2 + sz), { color: tint('#b8955e') }); solid(0, 1.2 + sz, 0.9, 0.15, 0.46); }
  for (const [sx, sz] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) batch.add('wood', M.plaster, box(0.06, 0.74, 0.06), at(sx, 0.37, 1.2 + sz), { color: tint('#8a6a3a') });
  mesh(cyl(0.03, 0.03, 2.6, 8), std({ color: '#d9d4ca' }), 0, 1.3, 1.2);
  mesh(cyl(0.02, 1.7, 0.5, 12), std({ color: '#f6f1e6', side: THREE.DoubleSide, roughness: 0.9 }), 0, 2.45, 1.2); // the parasol
  // string lights from the kiosk to two posts
  for (const sx of [-5, 5]) { mesh(cyl(0.04, 0.05, 2.8, 8), std({ color: '#3a3d44' }), sx, 1.4, 3.5); }
  for (let k = 0; k < 14; k++) { const t = k / 13; mesh(new THREE.SphereGeometry(0.07, 8, 6), bulbMat, -5 + t * 10, 2.75 - Math.sin(t * Math.PI) * 0.35, 3.5 - Math.sin(t * Math.PI) * 0.4); }
  for (let k = 0; k < 10; k++) { const t = k / 9; mesh(new THREE.SphereGeometry(0.07, 8, 6), bulbMat, -5 + (t) * 5 - 0, 2.75 - Math.sin(t * Math.PI) * 0.3, 3.5 - t * 6.0); }
  // a lamp post by the road and a bin
  mesh(cyl(0.05, 0.06, 3.6, 8), std({ color: '#3a3d44' }), 4.5, 1.8, 4.5); mesh(new THREE.SphereGeometry(0.2, 10, 8), bulbMat, 4.5, 3.7, 4.5);
  mesh(cyl(0.25, 0.22, 0.7, 10), std({ color: '#2f5e8f' }), -4.2, 0.35, -2.2); solid(-4.2, -2.2, 0.28, 0.28, 0.7);

  batch.build(group, { cast: false, receive: true });
  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  const L = (lx, lz, ry = 0) => ({ ...toWorld(lx, lz), yaw: yaw + ry });
  // where the Renault stops: the road's shoulder just before the gate, on the stand's side
  const parking = { x: e.x + e.nx * 5.2 - e.tx * 14, z: e.z + e.nz * 5.2 - e.tz * 14, yaw: Math.atan2(e.tx, e.tz), y: e.h, r: 5 };
  places.icecream = {
    x: cx, z: cz, y: Y, yaw, toWorld,
    counter: L(0, -2.2, Math.PI),                              // in front of the counter, facing it
    table: L(0, 1.2),
    spots: [L(-0.6, 0.2, Math.PI), L(0.6, 0.2, Math.PI), L(0, 2.2, 0)], // Nehorai and Erez on the near bench, Dolev opposite
    parking,
    lamps: [
      { ...toWorld(0, 2.0), y: Y + 2.7, inside: false, range: 14, intensity: 30, color: '#ffd27a' },
      { ...toWorld(0, -3.4), y: Y + 2.4, inside: false, range: 10, intensity: 22 },
      { ...toWorld(4.5, 4.5), y: Y + 3.6, inside: false, range: 16, intensity: 30 },
    ],
    emissives: [bulbMat, neonMat],
  };
  return places.icecream;
}
