// Shared pieces of the Shadow's citadel (chapter ten): the tools both the site and its central tower are
// built with (pieces merged per material, walls with holes cut in them, flights of stairs, instanced doors
// and state lights, screens drawn on canvases, the slit-window skin, signs on one atlas), a recorder that can
// take a whole building's colliders, floors and walking surfaces out of the world and put them back (the
// tower falls at the end), and the model of the armoured getaway car. All of it invented.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat4 } from './batch.js';
import { tint } from './materials.js';
import { CollisionWorld } from './colliders.js';
import { SIGN_FONT, signAtlas } from './textures.js';

// a rectangle { x0, x1, z0, z1 } with holes cut out of it: the pieces that are left
export function cutRects(rect, holes) {
  let out = [rect];
  for (const h of holes) {
    const next = [];
    for (const r of out) {
      const x0 = Math.max(r.x0, h.x0), x1 = Math.min(r.x1, h.x1), z0 = Math.max(r.z0, h.z0), z1 = Math.min(r.z1, h.z1);
      if (x1 - x0 < 1e-6 || z1 - z0 < 1e-6) { next.push(r); continue; }
      if (x0 - r.x0 > 0.01) next.push({ x0: r.x0, x1: x0, z0: r.z0, z1: r.z1 });
      if (r.x1 - x1 > 0.01) next.push({ x0: x1, x1: r.x1, z0: r.z0, z1: r.z1 });
      if (z0 - r.z0 > 0.01) next.push({ x0, x1, z0: r.z0, z1: z0 });
      if (r.z1 - z1 > 0.01) next.push({ x0, x1, z0: z1, z1: r.z1 });
    }
    out = next;
  }
  return out;
}

// A ctx whose colliders, floors and walking surfaces are remembered: remove() takes them all out of the
// world, restore() puts them back exactly (closed doors block again, open ones do not).
export function recording(ctx) {
  const { cols, net } = ctx, CELL = 16;
  const rec = { statics: [], floors: [], pads: [], dynamics: [], out: false };
  const keep = (it) => { if (it) rec.statics.push(it); return it; };
  const extent = (it) => {
    if (it.circle) return [it.cx - it.r, it.cz - it.r, it.cx + it.r, it.cz + it.r];
    const ex = Math.abs(it.hx * it.c) + Math.abs(it.hz * it.s), ez = Math.abs(it.hx * it.s) + Math.abs(it.hz * it.c);
    return [it.cx - ex, it.cz - ez, it.cx + ex, it.cz + ez];
  };
  rec.ctx = {
    ...ctx,
    cols: {
      addBox: (...a) => keep(cols.addBox(...a)), addSegment: (...a) => keep(cols.addSegment(...a)), addCircle: (...a) => keep(cols.addCircle(...a)),
      addFloor: (...a) => { cols.addFloor(...a); const f = cols.floors[cols.floors.length - 1]; rec.floors.push(f); return f; },
      addDynamicBox: (...a) => { const b = cols.addDynamicBox(...a); rec.dynamics.push(b); return b; },
      raycast: (...a) => cols.raycast(...a), resolve: (...a) => cols.resolve(...a),
    },
    net: { addPad: (o) => { const p = net.addPad(o); rec.pads.push(p); return p; }, surface: (...a) => net.surface(...a), padAt: (...a) => net.padAt(...a) },
  };
  rec.remove = () => {
    if (rec.out) return; rec.out = true;
    for (const it of rec.statics) {
      const [x0, z0, x1, z1] = extent(it); let found = false;
      for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
        const list = cols.cells.get(CollisionWorld.key(ix, iz)), i = list ? list.indexOf(it) : -1;
        if (i >= 0) { list.splice(i, 1); found = true; }
      }
      if (found) cols.count--; else cols.remove(it);
    }
    const gone = new Set(rec.floors);
    for (let i = cols.floors.length - 1; i >= 0; i--) if (gone.has(cols.floors[i])) cols.floors.splice(i, 1);
    for (const p of rec.pads) net.removePad(p);
    for (const b of rec.dynamics) { b.was = b.enabled; b.enabled = false; }
  };
  rec.restore = () => {
    if (!rec.out) return; rec.out = false;
    for (const it of rec.statics) cols.insert(it, ...extent(it));
    for (const f of rec.floors) cols.floors.push(f);
    for (const p of rec.pads) net.restorePad(p);
    for (const b of rec.dynamics) b.enabled = b.was ?? b.enabled;
  };
  return rec;
}

// The builders both the site and the tower use, bound to one site S (makeSite) and its ctx.
export function tools(S, ctx) {
  const { M, cols, net } = ctx, { batch, box, at, toWorld, cx, cz, y } = S;
  const base = (floor) => y + floor - (floor > 0 ? 0.3 : 1);
  const piece = (key, mat, w, h, d, lx, ly, lz, { yaw = 0, color = '#ffffff', scale = 0.4, uv = 'world', pitch = 0, roll = 0 } = {}) =>
    batch.add(key, mat, box(w, h, d), mat4(cx + lx, y + ly, cz + lz, yaw, 1, 1, 1, pitch, roll), { color: tint(color), uv, uvScale: scale });
  const geo = (key, mat, g, lx, ly, lz, yaw = 0, color = '#ffffff', pitch = 0) => batch.add(key, mat, g, mat4(cx + lx, y + ly, cz + lz, yaw, 1, 1, 1, pitch), { color: tint(color) });
  const blockAt = (lx, lz, hx, hz, floor, top, yaw = 0) => cols.addBox(cx + lx, cz + lz, hx, hz, yaw, base(floor), y + floor + top);
  const roundAt = (lx, lz, r, floor, top) => cols.addCircle(cx + lx, cz + lz, r, base(floor), y + floor + top);
  // a solid thing standing on a floor: drawn, blocking, and (when it is tall enough) cover
  const thing = (lx, lz, w, h, d, floor, color, { key = 'paint', mat = M.paint, yaw = 0, collide = true, cover = true, ly = 0, scale = 0.5 } = {}) => {
    piece(key, mat, w, h, d, lx, floor + ly + h / 2, lz, { yaw, color, scale });
    if (collide) blockAt(lx, lz, w / 2, d / 2, floor, ly + h, yaw);
    if (cover && h >= 0.8) S.cover.push({ ...toWorld(lx, lz), y: y + floor, w, d });
  };
  // a wall along a line with rectangular holes cut in it (doors, windows at any height): holes = [{ a0, a1,
  // y0, y1 }], a in metres from the first end; every piece blocks only its own heights
  const holedWall = (x0, z0, x1, z1, H, holes = [], { t = 0.5, color = '#5a5f68', key = 'plaster', mat = M.plaster, scale = 0.25, floor = 0 } = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, yaw = Math.atan2(x1 - x0, z1 - z0);
    for (const r of cutRects({ x0: 0, x1: len, z0: 0, z1: H }, holes.map((o) => ({ x0: o.a0, x1: o.a1, z0: o.y0, z1: o.y1 })))) {
      const a = (r.x0 + r.x1) / 2, l = r.x1 - r.x0, hh = r.z1 - r.z0;
      batch.add(key, mat, box(t, hh, l), at(x0 + ux * a, floor + r.z0 + hh / 2, z0 + uz * a, yaw), { color: tint(color), uv: 'world', uvScale: scale });
      cols.addSegment(cx + x0 + ux * r.x0, cz + z0 + uz * r.x0, cx + x0 + ux * r.x1, cz + z0 + uz * r.x1, t, r.z0 > 0.01 ? y + floor + r.z0 - 0.3 : base(floor), y + floor + r.z1 - 0.4);
    }
  };
  // a low rail along a line on a floor: drawn bars, and a collider that blocks only that floor
  const rail = (x0, z0, x1, z1, floor, { h = 1.05, color = '#2a2d33', draw = true, top = null } = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.05) return;
    const yaw = Math.atan2(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (draw) for (const hy of [h, h * 0.5]) piece('paint', M.paint, 0.06, 0.06, len, mx, floor + hy, mz, { yaw, color, uv: 'keep' });
    cols.addSegment(cx + x0, cz + z0, cx + x1, cz + z1, 0.12, base(floor), y + (top ?? floor + h + 0.1));
  };
  // a flight of stairs from (lx, lz) on `floor`, climbing the way `yaw` points: steps to walk on (their
  // surfaces overlap a little, so no line across the flight falls between two), drawn solid from the floor or
  // (thin) as steel treads; `enclose` shuts its two sides and the space under its top to whoever is not on it
  const flight = (lx, lz, yaw, { rise, run, width = 3, steps = 18, floor = 0, color = '#7d7a74', name = 'citadel stairs', enclose = false, bars = true, thin = false } = {}) => {
    const d = run / steps, sx = Math.sin(yaw), sz = Math.cos(yaw), px = Math.cos(yaw), pz = -Math.sin(yaw);
    for (let k = 1; k <= steps; k++) {
      const sk = (k - 0.5) * d, hk = rise * k / steps;
      net.addPad({ x: cx + lx + sx * sk, z: cz + lz + sz * sk, hx: width / 2, hz: d / 2 + 0.02, yaw, h: y + floor + hk - 0.05, top: 0.05, blend: 0, walkOnly: true, name });
      if (thin) piece('metal', M.metal, width, 0.16, d + 0.04, lx + sx * sk, floor + hk - 0.08, lz + sz * sk, { yaw, color: '#4a4f57', scale: 0.5 });
      else piece('stone', M.stone, width, hk, d, lx + sx * sk, floor + hk / 2, lz + sz * sk, { yaw, color, scale: 0.4 });
      piece('paint', M.paint, width, 0.03, 0.06, lx + sx * (sk - d / 2 + 0.03), floor + hk + 0.005, lz + sz * (sk - d / 2 + 0.03), { yaw, color: '#c8a23a', uv: 'keep' });
    }
    const slope = Math.hypot(run, rise), pitch = -Math.atan2(rise, run);
    for (const sd of [-1, 1]) {
      const ox = px * sd * (width / 2 + 0.06), oz = pz * sd * (width / 2 + 0.06);
      if (bars) piece('paint', M.paint, 0.06, 0.06, slope, lx + sx * run / 2 + ox, floor + rise / 2 + 1.0, lz + sz * run / 2 + oz, { yaw, pitch, color: '#2a2d33', uv: 'keep' });
      if (thin) piece('metal', M.metal, 0.1, 0.3, slope, lx + sx * run / 2 + ox, floor + rise / 2 - 0.2, lz + sz * run / 2 + oz, { yaw, pitch, color: '#33373e', uv: 'keep' });
      if (enclose) cols.addSegment(cx + lx + ox, cz + lz + oz, cx + lx + sx * run + ox, cz + lz + sz * run + oz, 0.12, base(floor), y + floor + rise + 1.1);
    }
    if (enclose) cols.addBox(cx + lx + sx * (run - 0.3), cz + lz + sz * (run - 0.3), width / 2, 0.3, yaw, base(floor), y + floor + rise - 1.9);
    return { bottom: { ...toWorld(lx, lz), y: y + floor, yaw }, top: { ...toWorld(lx + sx * run, lz + sz * run), y: y + floor + rise, yaw }, yaw, rise, run, width, floor };
  };
  return { piece, geo, blockAt, roundAt, thing, holedWall, rail, flight, base };
}

// Doors and small state lights, all instanced (a door or a lamp costs no draw call of its own). A door has the
// site builder's API: pos, yaw, w, locked, open, setOpen(o), unlock(), lock(), setVisible(v), body, lamp.
export function fittings(group, { cx, cz, y }, cols, { doors: nd = 32, lights: nl = 128 } = {}) {
  const lightIM = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial(), nl);
  lightIM.count = 0; lightIM.frustumCulled = false; group.add(lightIM);
  const col = new THREE.Color(), m4 = new THREE.Matrix4();
  const indicator = (lx, ly, lz, r = 0.08, color = '#ff2a2a') => {
    const i = lightIM.count++;
    lightIM.setMatrixAt(i, m4.makeScale(r, r, r).setPosition(cx + lx, y + ly, cz + lz)); lightIM.instanceMatrix.needsUpdate = true;
    const l = { index: i, color: null, x: cx + lx, y: y + ly, z: cz + lz, set(c) { if (c === l.color) return; l.color = c; lightIM.setColorAt(i, col.set(c)); lightIM.instanceColor.needsUpdate = true; } };
    l.set(color);
    return l;
  };
  const leafIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.3 }), nd);
  leafIM.count = 0; leafIM.frustumCulled = false; group.add(leafIM);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), doors = [];
  // mode: 'swing' (toward the side `toward` of the wall's normal), 'slide' (along the wall), 'lift' (up into the wall)
  const door = (lx, lz, yaw, w, { floor = 0, h = 2.4, color = '#4a4e55', locked = false, mode = 'swing', toward = 1, label = '', t = 0.08, lamp: withLamp = true } = {}) => {
    const p = { x: cx + lx, z: cz + lz }, fy = y + floor, ux = Math.cos(yaw), uz = -Math.sin(yaw), index = leafIM.count++;
    const pivot = new THREE.Object3D(), leaf = new THREE.Object3D();
    pivot.add(leaf); pivot.rotation.y = yaw; leaf.scale.set(w - 0.06, h - 0.06, t);
    if (mode === 'swing') { pivot.position.set(p.x - ux * w / 2, fy + h / 2, p.z - uz * w / 2); leaf.position.x = w / 2; }
    else pivot.position.set(p.x, fy + h / 2, p.z);
    leafIM.setColorAt(index, col.set(color));
    const lamp = withLamp ? indicator(lx + ux * (w / 2 + 0.24), floor + Math.min(h, 3) + 0.12, lz + uz * (w / 2 + 0.24), 0.06, locked ? '#ff2a2a' : '#2fd27a') : { set() {} };
    const d = { pos: { x: p.x, z: p.z, y: fy }, yaw, w, h, locked, open: false, visible: true, label, floor, mode, pivot, leaf, lamp, index };
    const body = cols.addDynamicBox(d, w / 2, 0.14);
    CollisionWorld.setBox(body, p.x, p.z, yaw, fy - (floor > 0 ? 0.3 : 1), fy + h);
    d.body = body;
    const draw = () => { pivot.updateMatrixWorld(true); leafIM.setMatrixAt(index, d.visible ? leaf.matrixWorld : ZERO); leafIM.instanceMatrix.needsUpdate = true; };
    d.setOpen = (o) => {
      d.open = o; body.enabled = !o;
      if (mode === 'swing') pivot.rotation.y = yaw - toward * (o ? Math.PI / 2 * 0.9 : 0);
      else if (mode === 'slide') leaf.position.x = o ? w * 0.94 : 0;
      else leaf.position.y = o ? h - 0.12 : 0;
      lamp.set(!o && d.locked ? '#ff2a2a' : '#2fd27a');
      draw();
    };
    d.unlock = () => { d.locked = false; lamp.set('#2fd27a'); };
    d.lock = () => { d.locked = true; d.setOpen(false); };
    d.setVisible = (v) => { d.visible = v; draw(); };
    d.setOpen(false);
    doors.push(d);
    return d;
  };
  return { indicator, door, doors, lightIM, leafIM };
}

// every sign of a site on one atlas, one mesh, lit by itself: list = [{ text, lx, ly, lz, yaw, w, h, bg, fg }]
export function signsMesh(S, list, key) {
  if (!list.length) return null;
  const atlas = signAtlas(key, list.map((s) => ({ text: s.text, bg: s.bg || '#14161a', fg: s.fg || '#e8e4da', border: true })), { cellW: 512, cellH: 96, cols: 4, size: 50 });
  const parts = list.map((s, i) => {
    const g = new THREE.PlaneGeometry(s.w, s.h), uv = g.getAttribute('uv'), [u0, v0, u1, v1] = atlas.uv[i];
    for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) * (u1 - u0), v0 + uv.getY(j) * (v1 - v0));
    g.applyMatrix4(S.at(s.lx, s.ly, s.lz, s.yaw)); return g;
  });
  const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ map: atlas.texture }));
  for (const g of parts) g.dispose();
  S.group.add(mesh);
  return mesh;
}

// the fortress's skin: dark concrete with narrow window slits, some of them lit at night (12 m of wall a tile)
export function slitMaterial(seed0 = 411, lit = 0.34) {
  const W = 256, H = 256, cols = 6, rows = 3;
  const map = document.createElement('canvas'), emi = document.createElement('canvas');
  map.width = emi.width = W; map.height = emi.height = H;
  const g = map.getContext('2d'), e = emi.getContext('2d');
  g.fillStyle = '#585c63'; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  let seed = seed0; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 260; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,22,26' : '150,152,158'},${0.05 + r() * 0.08})`; g.fillRect(r() * W, r() * H, 3 + r() * 30, 1 + r() * 4); }
  const cw = W / cols, rh = H / rows;
  for (let j = 0; j < rows; j++) {
    g.fillStyle = '#34373d'; g.fillRect(0, j * rh, W, 5);
    for (let i = 0; i < cols; i++) {
      const x = i * cw + cw * 0.36, yy = j * rh + rh * 0.3, w = cw * 0.28, h = rh * 0.46, on = r() < lit;
      g.fillStyle = on ? '#d9b676' : '#14181e'; g.fillRect(x, yy, w, h);
      g.strokeStyle = '#2a2d33'; g.lineWidth = 2; g.strokeRect(x - 1, yy - 1, w + 2, h + 2);
      if (on) { e.fillStyle = `rgb(255,${190 + Math.floor(r() * 40)},${110 + Math.floor(r() * 50)})`; e.fillRect(x, yy, w, h); }
    }
  }
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const m = new THREE.MeshStandardMaterial({ map: tex(map), emissiveMap: tex(emi), emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.8, metalness: 0.1, vertexColors: true });
  m.userData.night = 1.3;
  return m;
}

// a screen drawn on a canvas: show('off' | 'shadow' | 'alert' | 'map' | 'data' | 'portal' | 'engine' | 'static' | 'text', opts);
// data and engine take { progress: 0..1 }, text takes { title, sub, color }
export function makeScreen(W = 1024, H = 512) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const text = (s, x, yy, size, color = '#d8e6f2', align = 'right') => { g.fillStyle = color; g.font = `bold ${size}px ${SIGN_FONT}`; g.textAlign = align; g.direction = 'rtl'; g.textBaseline = 'middle'; g.fillText(s, x, yy); };
  const bg = (c0, c1) => { const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, c0); grd.addColorStop(1, c1); g.fillStyle = grd; g.fillRect(0, 0, W, H); };
  let seed = 31; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bar = (progress, label, color = '#59c7ff') => { g.strokeStyle = color; g.lineWidth = 4; g.strokeRect(60, H - 70, W - 120, 34); g.fillStyle = color; g.fillRect(W - 62 - (W - 124) * progress, H - 68, (W - 124) * progress, 30); text(`${label} · ${Math.round(progress * 100)}%`, W - 60, H - 96, 26, '#cfe6f5'); };
  const draw = {
    off() { bg('#07090c', '#020304'); g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(W * 0.1, 0, W * 0.12, H); },
    shadow() {
      bg('#12060c', '#020203');
      g.fillStyle = '#050506'; g.beginPath(); g.ellipse(W / 2, H * 0.98, 250, 180, 0, Math.PI, 0); g.fill();
      g.beginPath(); g.ellipse(W / 2, H * 0.42, 112, 142, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#1a1c22'; g.fillRect(W / 2 - 82, H * 0.36, 164, 30);
      g.fillStyle = '#c05cff'; for (const sx of [-34, 34]) { g.beginPath(); g.ellipse(W / 2 + sx, H * 0.36 + 15, 12, 7, 0, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = 'rgba(160,80,255,0.35)'; g.lineWidth = 3; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(W / 2, H * 0.5, 190 + k * 46, 170 + k * 30, 0, 0, Math.PI * 2); g.stroke(); }
      text('הצל', W - 40, 48, 40, '#ff9180');
    },
    alert() { bg('#3a0606', '#120202'); text('אזעקה', W / 2, H * 0.42, 150, '#ff6a5a', 'center'); text('המצודה · כל הכוחות', W / 2, H * 0.72, 46, '#ffd0c8', 'center'); },
    map() {
      bg('#0b1620', '#060c12');
      g.strokeStyle = 'rgba(89,199,255,0.12)'; g.lineWidth = 1; for (let x = 0; x < W; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let yy = 0; yy < H; yy += 64) { g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
      g.strokeStyle = '#3d6c8a'; g.lineWidth = 5; g.strokeRect(150, 90, 720, 340); g.strokeRect(560, 190, 190, 150);
      for (const [x, yy, s] of [[230, 180, 'שער ראשי'], [230, 370, 'שער שירות'], [420, 260, 'שער פנימי'], [655, 265, 'המגדל המרכזי']]) { g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(x, yy, 11, 0, Math.PI * 2); g.fill(); text(s, x - 18, yy, 24, '#ffd0c8'); }
      text('המצודה · מערכת ראשית', W - 40, 44, 36, '#ff9180');
    },
    data({ progress = null } = {}) {
      bg('#06121c', '#030a10');
      text('המחשב הראשי', W - 40, 54, 44, '#ff9180');
      ['מערכות ההגנה של המגדל', 'נעילות השערים', 'אספקת האנרגיה למנוע', 'קשר עם הכוחות'].forEach((s, i) => { g.fillStyle = 'rgba(89,199,255,0.08)'; g.fillRect(40, 104 + i * 68, W - 80, 54); text(s, W - 60, 131 + i * 68, 32, '#cfe6f5'); });
      if (progress != null) bar(progress, 'פורץ');
    },
    portal() {
      bg('#0d0520', '#020108');
      for (let k = 0; k < 9; k++) { g.strokeStyle = `rgba(${120 + k * 12},${60 + k * 10},255,${0.75 - k * 0.07})`; g.lineWidth = 10 - k; g.beginPath(); g.ellipse(W / 2, H / 2, 60 + k * 42, 34 + k * 24, k * 0.35, 0, Math.PI * 2); g.stroke(); }
      text('שער פתוח', W - 40, 48, 40, '#c9a8ff');
    },
    engine({ progress = 0 } = {}) {
      bg('#140a26', '#05030b');
      text('מנוע הפורטלים', W - 40, 54, 46, '#c9a8ff');
      for (let k = 0; k < 3; k++) { g.strokeStyle = '#7c4dff'; g.lineWidth = 6; g.beginPath(); g.arc(W * (0.25 + k * 0.25), H * 0.5, 62, 0, Math.PI * 2); g.stroke(); text(`מגן ${k + 1}`, W * (0.25 + k * 0.25), H * 0.5, 30, '#e6dcff', 'center'); }
      bar(progress, 'טעינה', '#a070ff');
    },
    static() { bg('#101214', '#060708'); for (let k = 0; k < 2600; k++) { const v = Math.floor(r() * 200); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * W, r() * H, 2 + r() * 5, 2); } },
    text({ title = '', sub = '', color = '#ff9180' } = {}) { bg('#0a0c10', '#020203'); text(title, W / 2, H * 0.42, 110, color, 'center'); if (sub) text(sub, W / 2, H * 0.72, 44, '#d8e6f2', 'center'); },
  };
  const scr = {
    canvas, tex, mat, mode: null, key: null,
    show(mode, opts = {}) {
      const key = `${mode}:${opts.progress == null ? '' : Math.round(opts.progress * 100)}:${opts.title || ''}:${opts.sub || ''}`;
      if (key === scr.key) return;
      scr.key = key; scr.mode = mode; seed = 31;
      (draw[mode] || draw.off)(opts); tex.needsUpdate = true;
    },
  };
  scr.show('off');
  return scr;
}

// chevrons on the floor along the flat legs of a route (stairs are left out): one mesh, hidden until marked
export function routeMarks(points, color = '#39ff7a') {
  const shape = new THREE.Shape([[0, 0.34], [0.38, -0.12], [0.18, -0.12], [0, 0.1], [-0.18, -0.12], [-0.38, -0.12]].map(([a, b]) => new THREE.Vector2(a, b)));
  const base = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), parts = [], m = new THREE.Matrix4();
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    if (Math.abs(a.y - b.y) > 0.1) continue;
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), yaw = Math.atan2(-dx, -dz);
    for (let s = 0.8; s < len - 0.4; s += 2.2) { const g = base.clone(); m.makeRotationY(yaw).setPosition(a.x + dx * s / len, a.y + 0.06, a.z + dz * s / len); g.applyMatrix4(m); parts.push(g); }
  }
  const mesh = new THREE.Mesh(parts.length ? mergeGeometries(parts) : base, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  for (const g of parts) g.dispose();
  mesh.renderOrder = 2;
  return mesh;
}

// one geometry from many pieces, each with its own colour: [geometry, colour, matrix?]
export function painted(pieces) {
  const geos = pieces.map(([g0, color, m]) => {
    const g = g0.index ? g0.toNonIndexed() : g0.clone();
    if (m) g.applyMatrix4(m);
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    const c = new THREE.Color(color), n = g.getAttribute('position').count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  });
  const out = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return out;
}
const T = (x, y, z, pitch = 0) => new THREE.Matrix4().makeRotationX(pitch).setPosition(x, y, z);
const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// a lorry for the yard, drawn many at once: white where the paint is, so an instance's colour tints the paint
// only (the traffic's material); local +z is the front, the origin on the ground under its middle
let lorryGeo = null;
export function lorryGeometry() {
  if (lorryGeo) return lorryGeo;
  const p = [
    [bx(2.5, 2.5, 5.6), '#ffffff', T(0, 2.0, -1.0)], [bx(2.45, 0.3, 7.6), '#2a2d31', T(0, 0.68, 0)],
    [bx(2.4, 1.9, 1.7), '#ffffff', T(0, 1.75, 2.9)], [bx(2.2, 0.8, 0.06), '#1b232c', T(0, 2.15, 3.77)],
    [bx(2.4, 0.4, 0.16), '#1c1d20', T(0, 0.75, 3.8)], [bx(0.4, 0.2, 0.05), '#e8eef2', T(0.85, 1.05, 3.78)], [bx(0.4, 0.2, 0.05), '#e8eef2', T(-0.85, 1.05, 3.78)],
    [bx(0.3, 0.2, 0.05), '#b3161c', T(0.95, 0.95, -3.83)], [bx(0.3, 0.2, 0.05), '#b3161c', T(-0.95, 0.95, -3.83)],
  ];
  for (const z of [2.8, -1.6, -2.9]) for (const x of [-1.12, 1.12]) p.push([new THREE.CylinderGeometry(0.5, 0.5, 0.36, 12).rotateZ(Math.PI / 2), '#141416', T(x, 0.5, z)]);
  return (lorryGeo = painted(p));
}

// The armoured getaway car (רכב מילוט משוריין): a big six-wheeled armoured carrier the game drives as a
// Vehicle. Local +z is the front, the origin on the ground under its middle; userData as the hatchback's
// (wheels, body, tailMat, headMat, halfExtents), so `new Vehicle(world, makeArmoured(), { ... })` works.
export function makeArmoured({ color = '#2f353d' } = {}) {
  const car = new THREE.Group(); car.name = 'armoured';
  const dark = '#1c1f24', glass = '#18222c';
  const body = new THREE.Mesh(painted([
    [bx(2.8, 1.05, 7.2), color, T(0, 1.2, 0)],                                    // the hull
    [bx(2.6, 1.0, 4.9), color, T(0, 2.2, -0.9)],                                  // the cabin and the hold
    [bx(2.6, 0.9, 1.9), color, T(0, 1.98, 2.25, 0.5)],                            // the sloped nose
    [bx(2.2, 0.5, 0.06), glass, T(0, 2.28, 1.62, 0.5)],                           // the windscreen: a slit of thick glass
    [bx(0.05, 0.3, 1.1), glass, T(1.31, 2.3, 0.6)], [bx(0.05, 0.3, 1.1), glass, T(-1.31, 2.3, 0.6)],
    [bx(0.05, 0.22, 0.6), glass, T(1.31, 2.3, -1.4)], [bx(0.05, 0.22, 0.6), glass, T(-1.31, 2.3, -1.4)],
    [bx(3.0, 0.55, 0.3), dark, T(0, 0.95, 3.7)], [bx(3.0, 0.45, 0.25), dark, T(0, 0.95, -3.68)], // the ram, the rear bumper
    [bx(0.12, 0.9, 0.12), dark, T(0.9, 1.5, 3.8)], [bx(0.12, 0.9, 0.12), dark, T(-0.9, 1.5, 3.8)], [bx(2.0, 0.1, 0.1), dark, T(0, 1.9, 3.8)],
    [bx(3.0, 0.5, 5.4), dark, T(0, 0.85, -0.2)],                                  // the skirts over the wheels
    [bx(1.5, 0.12, 1.5), dark, T(0, 2.76, -0.6)], [new THREE.CylinderGeometry(0.5, 0.56, 0.22, 12), dark, T(0, 2.86, -0.6)], // the roof hatch
    [bx(1.7, 0.16, 0.3), '#b9bec4', T(0, 2.8, 1.0)],                              // the light bar
    [bx(1.1, 1.4, 0.06), dark, T(0, 1.9, -3.38)], [bx(0.1, 0.5, 0.08), '#b9bec4', T(0.3, 1.9, -3.42)], // the rear door
    [bx(2.3, 0.08, 2.6), dark, T(0, 0.62, 0)],
    [bx(0.5, 0.14, 0.05), '#f5cf1d', T(0, 0.72, 3.87)],
  ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.3 }));
  car.add(body);
  const tailMat = new THREE.MeshStandardMaterial({ color: '#b3161c', roughness: 0.3, emissive: '#3a0406' });
  car.add(new THREE.Mesh(painted([[bx(0.34, 0.2, 0.06), '#ffffff', T(1.05, 1.5, -3.62)], [bx(0.34, 0.2, 0.06), '#ffffff', T(-1.05, 1.5, -3.62)]]), tailMat));
  const headMat = new THREE.MeshStandardMaterial({ color: '#e8eef2', roughness: 0.3, emissive: '#ffe3a8', emissiveIntensity: 0 });
  car.add(new THREE.Mesh(painted([[bx(0.4, 0.22, 0.06), '#ffffff', T(1.0, 1.42, 3.62)], [bx(0.4, 0.22, 0.06), '#ffffff', T(-1.0, 1.42, 3.62)], [bx(0.3, 0.12, 0.06), '#ffffff', T(0.5, 2.8, 1.17)], [bx(0.3, 0.12, 0.06), '#ffffff', T(-0.5, 2.8, 1.17)]]), headMat));
  const wheelGeo = painted([[new THREE.CylinderGeometry(0.62, 0.62, 0.46, 16).rotateZ(Math.PI / 2), '#141416'], [new THREE.CylinderGeometry(0.3, 0.3, 0.48, 10).rotateZ(Math.PI / 2), '#555b63'], [bx(0.49, 0.5, 0.1), '#3a3f47']]);
  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const wheels = [];
  for (const z of [2.45, 0.1, -2.3]) for (const x of [1.22, -1.22]) {
    const pivot = new THREE.Group(), spin = new THREE.Mesh(wheelGeo, wheelMat);
    pivot.position.set(x, 0.62, z); pivot.add(spin); car.add(pivot);
    wheels.push({ pivot, spin, front: z > 1, x, z });
  }
  car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  car.userData = { wheels, body, tailMat, headMat, paint: body.material, color, halfExtents: { x: 1.5, z: 3.85 }, seats: 8 };
  return car;
}
