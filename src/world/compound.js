// Building blocks for the places chapter seven is fought through (the quarry, Kotzi's depot, the
// trap corridor, the fort): walls with doorways and colliders, doors that open and lock (a collider
// that switches off), pressure plates, cameras with a field of view, lamps, crates, towers. All of it
// is the game's own geometry on the world's shared materials; the places are invented.
import * as THREE from 'three';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { CollisionWorld } from './colliders.js';
import { Tex } from './textures.js';

export function makeSite(ctx, { cx, cz, y, name = 'site' }) {
  const { group: parent, M, cols } = ctx;
  const group = new THREE.Group();
  group.name = name;
  parent.add(group);
  const batch = new Batch();
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const at = (lx, ly, lz, ry = 0) => mat4(cx + lx, y + ly, cz + lz, ry);
  const toWorld = (lx, lz) => ({ x: cx + lx, z: cz + lz });
  const toLocal = (x, z) => ({ x: x - cx, z: z - cz });
  const L = (lx, lz, yaw = 0) => ({ ...toWorld(lx, lz), yaw });
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const bulbMat = std({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0 }); bulbMat.userData.night = 1.6;
  const redMat = std({ color: '#ff8a8a', emissive: '#ff2a2a', emissiveIntensity: 0.6 });
  const greenMat = std({ color: '#9affb0', emissive: '#2fd27a', emissiveIntensity: 0.6 });
  const mesh = (geo, mat, lx, ly, lz, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(cx + lx, y + ly, cz + lz); m.rotation.y = ry; group.add(m); return m; };
  const lamps = [], emissives = [bulbMat], cover = [];

  // a wall piece along a segment; a collider when it stands on the ground
  const seg = (x0, z0, x1, z1, { h = 3, y0 = 0, t = 0.3, color = '#d8d3c6', key = 'plaster', mat = M.plaster, scale = 0.3 } = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    if (len < 0.01) return;
    batch.add(key, mat, box(t, h, len), at((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2, yaw), { color: tint(color), uv: 'world', uvScale: scale });
    if (y0 === 0) cols.addSegment(cx + x0, cz + z0, cx + x1, cz + z1, t, y - 1, y + h);
  };
  // a wall with doorways: openings = [{ at (distance from (x0,z0) along the wall), w, h }]
  const wall = (x0, z0, x1, z1, openings = [], opts = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, H = opts.h ?? 3;
    const P = (s) => [x0 + ux * s, z0 + uz * s];
    let s = 0;
    for (const o of [...openings].sort((a, b) => a.at - b.at)) {
      const a = o.at - o.w / 2, b = o.at + o.w / 2;
      seg(...P(s), ...P(a), opts);
      seg(...P(a), ...P(b), { ...opts, h: H - (o.h ?? 2.2), y0: o.h ?? 2.2 });
      s = b;
    }
    seg(...P(s), ...P(len), opts);
  };
  // a flat slab (floor, roof): no collider
  const slab = (lx, ly, lz, w, h, d, { key = 'plaster', mat = M.plaster, color = '#9c9a93', scale = 0.3 } = {}) =>
    batch.add(key, mat, box(w, h, d), at(lx, ly, lz), { color: tint(color), uv: 'world', uvScale: scale });
  const solid = (lx, lz, hx, hz, top, yaw = 0) => cols.addBox(cx + lx, cz + lz, hx, hz, yaw, y - 1, y + top);
  const crate = (lx, lz, w = 1.2, d = 1.2, h = 1.0, color = '#b8955e') => {
    batch.add('wood', M.plaster, box(w, h, d), at(lx, h / 2, lz), { color: tint(color), uv: 'world', uvScale: 0.5 });
    solid(lx, lz, w / 2, d / 2, h);
    cover.push({ ...toWorld(lx, lz), w, d });
  };
  const barrel = (lx, lz, color = '#3a4b8f') => { mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), std({ color, roughness: 0.6 }), lx, 0.45, lz); cols.addCircle(cx + lx, cz + lz, 0.32, y - 1, y + 0.9); cover.push({ ...toWorld(lx, lz), w: 0.6, d: 0.6 }); };
  const lampPost = (lx, lz, h = 5, { color = '#ffd9a0', range = 24, intensity = 46 } = {}) => {
    mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 8), std({ color: '#3a3d44' }), lx, h / 2, lz);
    mesh(new THREE.SphereGeometry(0.2, 10, 8), bulbMat, lx, h + 0.1, lz);
    lamps.push({ ...toWorld(lx, lz), y: y + h, inside: false, range, intensity, color });
  };
  const ceilingLamp = (lx, lz, h, { range = 10, intensity = 22 } = {}) => {
    mesh(new THREE.SphereGeometry(0.13, 10, 8), bulbMat, lx, h - 0.3, lz);
    lamps.push({ ...toWorld(lx, lz), y: y + h - 0.4, inside: true, range, intensity });
  };
  const sign = (text, lx, ly, lz, ry, w = 2.4, h = 0.5, { bg = '#2b2f36', fg = '#f3efe6', size = 90 } = {}) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: Tex.sign(text, { bg, fg, w: 1024, h: Math.round(1024 * h / w), size }), roughness: 0.7 }));
    m.position.set(cx + lx, y + ly, cz + lz); m.rotation.y = ry; group.add(m); return m;
  };

  // a door: a leaf in a frame; closed it blocks (a dynamic box), open it swings aside; a locked one
  // waits for Ido. `yaw` is the wall's direction; the leaf is `w` wide.
  const door = (lx, lz, yaw, w = 1.2, { locked = false, color = '#5d636b', h = 2.2 } = {}) => {
    const d = { pos: { x: cx + lx, z: cz + lz }, yaw, w, locked, open: false, label: '' };
    const leaf = mesh(box(w - 0.06, h - 0.06, 0.08), std({ color, roughness: 0.6, metalness: 0.2 }), lx, h / 2, lz, yaw);
    const pivot = new THREE.Group(); pivot.position.copy(leaf.position); pivot.rotation.y = yaw; group.add(pivot);
    leaf.position.set(w / 2 - 0.03, 0, 0); leaf.rotation.y = 0; pivot.add(leaf); pivot.position.x -= Math.cos(yaw) * (w / 2); pivot.position.z += Math.sin(yaw) * (w / 2);
    // the frame
    for (const sx of [-w / 2 - 0.05, w / 2 + 0.05]) mesh(box(0.1, h + 0.1, 0.16), std({ color: '#2a2d33' }), lx + Math.cos(yaw) * sx, h / 2, lz - Math.sin(yaw) * sx, yaw);
    const lamp = mesh(new THREE.SphereGeometry(0.06, 8, 6), locked ? redMat : greenMat, lx + Math.cos(yaw) * (w / 2 + 0.2), h + 0.1, lz - Math.sin(yaw) * (w / 2 + 0.2));
    const body = cols.addDynamicBox(d, w / 2, 0.12);
    CollisionWorld.setBox(body, cx + lx, cz + lz, yaw, y - 1, y + h);
    d.body = body; d.pivot = pivot; d.leaf = leaf; d.lamp = lamp;
    d.setOpen = (o) => { d.open = o; body.enabled = !o; pivot.rotation.y = yaw + (o ? -Math.PI / 2 * 0.9 : 0); lamp.material = o ? greenMat : locked && d.locked ? redMat : greenMat; };
    d.unlock = () => { d.locked = false; lamp.material = greenMat; };
    d.lock = () => { d.locked = true; d.setOpen(false); lamp.material = redMat; };
    d.setOpen(false);
    return d;
  };
  // a pressure plate: a slightly raised tile; the mission checks `inside`
  const plate = (lx, lz, w = 1.6, d = 1.6) => {
    const m = mesh(box(w, 0.04, d), std({ color: '#6b6f75', roughness: 0.5, metalness: 0.3 }), lx, 0.02, lz);
    const p = { ...toWorld(lx, lz), w, d, mesh: m, armed: true, inside: (x, z) => Math.abs(x - (cx + lx)) < w / 2 && Math.abs(z - (cz + lz)) < d / 2 };
    p.trip = () => { p.armed = false; m.material = redMat; };
    p.reset = () => { p.armed = true; m.material = std({ color: '#6b6f75', roughness: 0.5, metalness: 0.3 }); };
    return p;
  };
  // a camera on a wall: a box with a lens and a cone on the ground; `sees` wants a clear line
  const camera = (lx, ly, lz, yaw, { range = 11, half = 0.55 } = {}) => {
    mesh(box(0.3, 0.2, 0.4), std({ color: '#2a2d33' }), lx, ly, lz, yaw);
    const lens = mesh(new THREE.SphereGeometry(0.05, 8, 6), redMat, lx + Math.sin(yaw) * 0.22, ly, lz + Math.cos(yaw) * 0.22);
    const cone = new THREE.Mesh(new THREE.CircleGeometry(range, 18, -Math.PI / 2 - half, half * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff4a4a', transparent: true, opacity: 0.12, depthWrite: false }));
    cone.position.set(cx + lx, y + 0.03, cz + lz); cone.rotation.y = yaw; cone.renderOrder = 2; group.add(cone);
    const c = { pos: { x: cx + lx, y: y + ly, z: cz + lz }, yaw, range, half, cone, lens, on: true };
    c.sees = (world, x, z) => {
      if (!c.on) return false;
      const dx = x - c.pos.x, dz = z - c.pos.z, dd = Math.hypot(dx, dz); if (dd > range) return false;
      let a = Math.atan2(dx, dz) - yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > half) return false;
      return world.cols.raycast(c.pos.x, c.pos.y, c.pos.z, x, y + 1.2, z, null) === null;
    };
    c.setOn = (o) => { c.on = o; cone.visible = o; lens.material = o ? redMat : std({ color: '#2a2d33' }); };
    return c;
  };
  // a watchtower: a platform on legs with a railing; guards stand on `top`
  const tower = (lx, lz, h = 6, w = 3) => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) batch.add('paint', M.paint, box(0.18, h, 0.18), at(lx + sx * (w / 2 - 0.2), h / 2, lz + sz * (w / 2 - 0.2)), { color: tint('#3a3d44') });
    batch.add('metal', M.metal, box(w, 0.2, w), at(lx, h, lz), { color: tint('#6b6f75'), uv: 'world', uvScale: 0.5 });
    for (const [dx, dz, sx, sz] of [[0, w / 2, w, 0.06], [0, -w / 2, w, 0.06], [w / 2, 0, 0.06, w], [-w / 2, 0, 0.06, w]]) batch.add('paint', M.paint, box(sx, 1.0, sz), at(lx + dx, h + 0.6, lz + dz), { color: tint('#3a3d44') });
    batch.add('plaster', M.plaster, box(w + 0.6, 0.15, w + 0.6), at(lx, h + 2.4, lz), { color: tint('#c9c4b7'), uv: 'world' });
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) solid(lx + sx * (w / 2 - 0.2), lz + sz * (w / 2 - 0.2), 0.14, 0.14, h); // the legs block; the air between them does not
    lamps.push({ ...toWorld(lx, lz), y: y + h + 2.2, inside: false, range: 26, intensity: 50, color: '#dbe9ff' });
    mesh(new THREE.SphereGeometry(0.2, 10, 8), bulbMat, lx, h + 2.2, lz);
    return { ...L(lx, lz), y: y + h + 0.2 };
  };
  const finish = () => { batch.build(group, { cast: false, receive: true }); group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); };

  return { group, batch, box, at, toWorld, toLocal, L, std, mesh, seg, wall, slab, solid, crate, barrel, lampPost, ceilingLamp, sign, door, plate, camera, tower, lamps, emissives, cover, finish, bulbMat, redMat, greenMat, cx, cz, y };
}
