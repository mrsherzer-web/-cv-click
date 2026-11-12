// The underground facility (chapter nine): המתקן התת-קרקעי of the Black Order. A complex dug six metres into
// the plain and roofed everywhere (no windows: it plays as underground; from above there is only a fenced
// concrete lid, the hangar's bunker roof and the cutting of the ramp). Inside, from the west: the elevator's
// arrival hall, the holding cells (a row of cells and the big cell where the gang wakes), the iron corridor
// with its side bays and two guard rooms, the machine room (presses and steam vents a mission switches,
// catwalks up stairs), the detention arena (a cage in a pit of stands), the armory (a card door, a code gate,
// the wall of the gang's markers), the tunnels, two storage halls, and the giant hangar (vehicles that can
// blow, cover, a damaged door that traps someone, the safe room behind a heavy door, the first-aid kit) with
// the big door and the ramp up to the surface by the tower's plaza. Site-local: origin at (1520, -120), +z
// south. Everything is invented; nothing here is a real place or how one is got into.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSite } from './compound.js';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { CollisionWorld } from './colliders.js';
import { Tex, signAtlas, SIGN_FONT } from './textures.js';
import { COLORS } from '../combat/paint.js';

const C = { x: 1520, z: -120 };
const DIG = 6, HX = 92, HZ = 72;           // the dug floor: x 1428..1612, z -192..-48
const LID = 5.6, LID_T = 0.5;              // the concrete lid over the low halls: its underside, its thickness
const HANG = { x0: 30, x1: 86, z0: 8, z1: 56, h: 14 };
const RAMP = { x0: 86.4, x1: 120, z: 30, w: 8 };
export const ARMORY_CODE = '4719';
// whose marker hangs where on the wall of weapons (the colours of their hoppers)
const OWNERS = ['nehorai', 'erez', 'ido', 'yonati', 'avraham', 'muller', 'dolev', 'hadar', 'liam', 'kai'];

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const hC = baseHeight(C.x, C.z), y = hC - DIG + 0.05;
  net.addPad({ x: C.x, z: C.z, hx: HX, hz: HZ, yaw: 0, h: hC - DIG, top: 0.05, blend: 8, name: 'facility' });
  // the ramp's cutting, east of the hangar: the land is lowered under it, a little below each stretch
  const hExit = baseHeight(C.x + RAMP.x1 + 4, C.z + RAMP.z) + 0.05;
  const rampY = (lx) => y + (hExit - y) * Math.min(1, Math.max(0, (lx - RAMP.x0) / (RAMP.x1 - RAMP.x0)));
  for (let lx = 88; lx < RAMP.x1; lx += 4) net.addPad({ x: C.x + lx + 2, z: C.z + RAMP.z, hx: 2, hz: 8.2, yaw: 0, h: rampY(lx) - 0.45, top: 0, blend: 1, name: 'facility ramp cut' });
  net.addPad({ x: C.x + RAMP.x1 + 6, z: C.z + RAMP.z, hx: 6, hz: 9, yaw: 0, h: hExit - 0.05, top: 0.05, blend: 6, name: 'facility exit' });
  ctx.keepOut?.push({ x: C.x, z: C.z, hx: 104, hz: 84 }, { x: C.x + 112, z: C.z + RAMP.z, hx: 26, hz: 14 });
  ctx.facility = { y, hC, hExit };
}

// a texture of steel bars on nothing: one bar every 0.16 m, a cross bar every 1.1 m (world UVs in metres)
function barsTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 32, 128);
  const grd = g.createLinearGradient(10, 0, 22, 0);
  grd.addColorStop(0, '#2b3036'); grd.addColorStop(0.5, '#a3acb6'); grd.addColorStop(1, '#2b3036');
  g.fillStyle = grd; g.fillRect(11, 0, 10, 128);
  g.fillStyle = '#4a5058'; g.fillRect(0, 58, 32, 10);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 0.16, 1 / 1.1);
  return t;
}

export function build(ctx) {
  const { places, M, cols } = ctx;
  const { y, hExit } = ctx.facility;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'facility' });
  const { batch, box, at, toWorld, std, solid, level } = S;
  const interior = S.group;                         // everything below the lid: shown only when the camera is in it
  const shellGroup = new THREE.Group(); shellGroup.name = 'facility shell'; ctx.group.add(shellGroup);
  const shell = new Batch();                         // the lid, the hangar's walls and roof, the ramp, the fence
  const cx = C.x, cz = C.z;
  const P = (lx, lz, ly = 0, yaw) => ({ ...toWorld(lx, lz), y: y + ly, ...(yaw != null ? { yaw } : {}) });
  const lidTop = y + LID + LID_T;

  // ---------- materials (shared; the static pieces are merged per material) ----------
  const coldMat = new THREE.MeshStandardMaterial({ color: '#e6eef8', emissive: '#cfe2ff', emissiveIntensity: 0, roughness: 0.4 }); coldMat.userData.night = 1.9;
  const redLampMat = new THREE.MeshStandardMaterial({ color: '#5a1414', emissive: '#ff1e1e', emissiveIntensity: 0.15, roughness: 0.5 });
  const barsTex = barsTexture();
  const barsMat = new THREE.MeshStandardMaterial({ map: barsTex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.55, roughness: 0.45 });
  const cageMat = new THREE.MeshStandardMaterial({ map: Tex.fence(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.6 });
  const doorMats = {
    steel: std({ color: '#4b525a', roughness: 0.5, metalness: 0.5 }),
    heavy: std({ color: '#30353b', roughness: 0.4, metalness: 0.7 }),
    damaged: std({ color: '#5b4c3e', roughness: 0.85, metalness: 0.3 }),
    bars: barsMat, cage: cageMat,
  };
  // every small status light (doors, machines, the reader, the keypad, the panels) is one instance of one mesh
  const IND = { red: new THREE.Color('#ff3030'), green: new THREE.Color('#36e07e'), amber: new THREE.Color('#ffb000'), off: new THREE.Color('#202328') };
  const indMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), 64);
  indMesh.count = 0; indMesh.name = 'facility lights';
  const indicator = (x, yy, z, s = 1, state = 'green') => {
    const i = indMesh.count++;
    indMesh.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, yy, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s)));
    const L = { i, state: null, set(st) { if (st === L.state) return; L.state = st; indMesh.setColorAt(i, IND[st] || IND.off); indMesh.instanceColor.needsUpdate = true; } };
    L.set(state);
    return L;
  };
  // movable pieces far from the camera are not drawn (the halls between hide them anyway)
  const near = [];
  const nearCull = (obj, lx, lz, r = 60) => near.push({ obj, x: cx + lx, z: cz + lz, r2: r * r });
  const CONCRETE = '#6a6d70', DARK = '#4f5256', STEEL = '#5a626b', STEEL_D = '#3a3f46';

  // ---------- walls into a batch (the interior's or the shell's), with doorways and colliders ----------
  const segB = (B, x0, z0, x1, z1, { h = LID, y0 = 0, t = 0.4, color = CONCRETE, key = 'plaster', mat = M.plaster, scale = 0.25, floor = 0, collide = true } = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
    if (len < 0.01 || h < 0.01) return;
    B.add(key, mat, box(t, h, len), at((x0 + x1) / 2, floor + y0 + h / 2, (z0 + z1) / 2, yaw), { color: tint(color), uv: 'world', uvScale: scale });
    if (y0 === 0 && collide) cols.addSegment(cx + x0, cz + z0, cx + x1, cz + z1, t, y + floor - (floor ? 0.3 : 1), y + floor + h);
  };
  const wallB = (B, x0, z0, x1, z1, openings = [], opts = {}) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, H = opts.h ?? LID;
    const Pt = (s) => [x0 + ux * s, z0 + uz * s];
    let s = 0;
    for (const o of [...openings].sort((a, b) => a.at - b.at)) {
      const a = o.at - o.w / 2, b = o.at + o.w / 2;
      segB(B, ...Pt(s), ...Pt(a), opts);
      segB(B, ...Pt(a), ...Pt(b), { ...opts, h: H - (o.h ?? 2.3), y0: o.h ?? 2.3 });
      s = b;
    }
    segB(B, ...Pt(s), ...Pt(len), opts);
  };
  const wall = (x0, z0, x1, z1, openings, opts) => wallB(batch, x0, z0, x1, z1, openings, opts);
  const conc = (h = LID, extra = {}) => ({ h, t: 0.4, color: CONCRETE, key: 'plaster', mat: M.plaster, scale: 0.25, ...extra });
  const steelW = (h = 4.4, extra = {}) => ({ h, t: 0.3, color: STEEL, key: 'metal', mat: M.metal, scale: 0.35, ...extra });
  const barsW = (h, extra = {}) => ({ h, t: 0.06, color: '#ffffff', key: 'bars', mat: barsMat, scale: 1, ...extra });
  const piece = (key, mat, w, h, d, lx, ly, lz, color, ry = 0, B = batch, scale = 0.3) => B.add(key, mat, box(w, h, d), at(lx, ly, lz, ry), { color: tint(color), uv: 'world', uvScale: scale });
  // a slab overhead that also keeps the camera under it
  const ceiling = (x0, z0, x1, z1, h, color = DARK, B = batch) => {
    piece('plaster', M.plaster, x1 - x0, 0.3, z1 - z0, (x0 + x1) / 2, h + 0.15, (z0 + z1) / 2, color, 0, B, 0.2);
    cols.addFloor(cx + x0, cz + z0, cx + x1, cz + z1, y + h);
  };
  const block = (lx, lz, w, d, h, color = '#4a4f57', key = 'paint', mat = M.paint, ry = 0) => {
    piece(key, mat, w, h, d, lx, h / 2, lz, color, ry);
    solid(lx, lz, w / 2, d / 2, h, ry);
  };
  const cover = (lx, lz, w, d) => S.cover.push({ ...toWorld(lx, lz), w, d, y });
  const crate = (lx, lz, w = 1.3, d = 1.3, h = 1.1, color = '#8d7650') => { piece('wood', M.plaster, w, h, d, lx, h / 2, lz, color, 0, batch, 0.5); solid(lx, lz, w / 2, d / 2, h); cover(lx, lz, w, d); };
  const barrel = (lx, lz, color = '#7a2b24') => {
    batch.add('paint', M.paint, new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), at(lx, 0.45, lz), { color: tint(color) });
    cols.addCircle(cx + lx, cz + lz, 0.32, y - 1, y + 0.9); cover(lx, lz, 0.6, 0.6);
  };
  const barrier = (lx, lz, ry = 0) => { // a concrete jersey barrier, 3 m long
    piece('plaster', M.plaster, 0.7, 0.35, 3, lx, 0.175, lz, '#8a8d90', ry); piece('plaster', M.plaster, 0.36, 0.7, 3, lx, 0.65, lz, '#8a8d90', ry);
    solid(lx, lz, 0.35, 1.5, 1.0, ry); S.cover.push({ ...toWorld(lx, lz), w: ry ? 3 : 0.7, d: ry ? 0.7 : 3, y });
  };
  // a flight of stairs going the way `yaw` points (as compound.js's, but each step's walking surface overlaps
  // the next by a few centimetres, so no point on an edge between two steps falls through to the floor)
  const stairs = (lx, lz, yaw, { rise = 3, run = 6, width = 2.2, steps = 12, floor = 0, color = '#6b6e71', key = 'plaster', mat = M.plaster, B = batch } = {}) => {
    const d = run / steps, sx = Math.sin(yaw), sz = Math.cos(yaw);
    for (let k = 1; k <= steps; k++) {
      const sk = (k - 0.5) * d, hk = rise * k / steps;
      ctx.net.addPad({ x: cx + lx + sx * sk, z: cz + lz + sz * sk, hx: width / 2, hz: d / 2 + 0.03, yaw, h: y + floor + hk - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'facility stairs' });
      B.add(key, mat, box(width, hk, d), at(lx + sx * sk, floor + hk / 2, lz + sz * sk, yaw), { color: tint(color), uv: 'world', uvScale: 0.4 });
    }
    for (const side of [-1, 1]) B.add('paint', M.paint, box(0.06, 0.06, Math.hypot(run, rise)), at(lx + sx * run / 2 + Math.cos(yaw) * side * (width / 2 + 0.04), floor + rise / 2 + 0.95, lz + sz * run / 2 - Math.sin(yaw) * side * (width / 2 + 0.04), yaw, 1, 1, 1, -Math.atan2(rise, run)), { color: tint('#c9a13a') });
    return { bottom: { ...toWorld(lx, lz), yaw, y: y + floor }, top: { ...toWorld(lx + sx * run, lz + sz * run), yaw, y: y + floor + rise }, yaw, rise, run, width, floor };
  };
  // x/z of a point (ox along the object's width, oz along its length) on an object at (lx, lz) facing yaw
  const rot = (lx, lz, yaw, ox, oz) => [lx + ox * Math.cos(yaw) + oz * Math.sin(yaw), lz - ox * Math.sin(yaw) + oz * Math.cos(yaw)];

  // ---------- lamps: cold tubes under the ceilings, red emergency lamps on the walls ----------
  const tube = (lx, lz, h, { range = 12, intensity = 24, len = 1.3, yaw = 0, B = batch, inside = true, color = '#d4e4ff' } = {}) => {
    B.add('flamp', coldMat, box(0.16, 0.07, len), at(lx, h - 0.06, lz, yaw));
    B.add('metal', M.metal, box(0.26, 0.05, len + 0.12), at(lx, h - 0.01, lz, yaw), { color: tint(STEEL_D) });
    S.lamps.push({ ...toWorld(lx, lz), y: y + Math.max(Math.min(2.4, h - 0.35), h - 1.1), inside, range, intensity, color }); // the light a little below the fitting: the floor gets it, not only the ceiling
  };
  // a light on a wall (the ramp's cutting): a small fitting on the face, `nx, nz` the way it faces
  const wallLamp = (lx, lz, h, nx, nz, { range = 14, intensity = 26, B = shell } = {}) => {
    B.add('flamp', coldMat, box(nz ? 0.9 : 0.08, 0.12, nx ? 0.9 : 0.08), at(lx + nx * 0.05, h, lz + nz * 0.05));
    S.lamps.push({ ...toWorld(lx + nx * 0.6, lz + nz * 0.6), y: y + h - 0.2, inside: false, range, intensity, color: '#d4e4ff' });
  };
  const redLamps = [];
  const redGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.3, 12);
  const red = (lx, lz, ly, zone) => { batch.add('rlamp', redLampMat, redGeo, at(lx, ly, lz)); piece('metal', M.metal, 0.46, 0.06, 0.46, lx, ly + 0.18, lz, STEEL_D); redLamps.push({ ...P(lx, lz, ly), zone }); };

  // ---------- signs: all on one atlas, one mesh ----------
  const signs = [];
  const sign = (text, lx, ly, lz, ry, w = 2.6, h = 0.55, bg = '#15181d', fg = '#9fd0ff', B = batch) => signs.push({ text, lx, ly, lz, ry, w, h, bg, fg, B });

  // ---------- doors: a leaf (swings, slides or rises), a frame merged into the batch, a lamp ----------
  // the same contract as compound.js's doors: setOpen(o), unlock(), lock(), open, locked, body, pos, yaw, w
  const doorList = [];
  const fdoor = (name, lx, lz, yaw, w = 1.4, { h = 2.3, floor = 0, locked = false, kind = 'steel', slide = false, parent = interior, B = batch } = {}) => {
    const wx = cx + lx, wz = cz + lz, wy = y + floor + h / 2, ux = Math.cos(yaw), uz = -Math.sin(yaw);
    const thick = kind === 'heavy' ? 0.3 : kind === 'bars' || kind === 'cage' ? 0.05 : 0.1;
    const geo = box(w - 0.06, h - 0.06, thick);
    if (kind === 'bars' || kind === 'cage') { const uv = geo.getAttribute('uv'), sx = kind === 'cage' ? w / 0.6 : w, sy = kind === 'cage' ? h / 0.6 : h; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); }
    const leaf = new THREE.Mesh(geo, doorMats[kind]);
    const pivot = new THREE.Group();
    if (slide) { pivot.position.set(wx, wy, wz); pivot.rotation.y = yaw; pivot.add(leaf); }
    else { pivot.position.set(wx - ux * w / 2, wy, wz - uz * w / 2); pivot.rotation.y = yaw; leaf.position.set(w / 2 - 0.03, 0, 0); pivot.add(leaf); }
    if (kind === 'damaged') { leaf.rotation.z = 0.035; leaf.rotation.y = 0.05; }
    parent.add(pivot);
    const fw = kind === 'heavy' ? 0.22 : 0.12;
    for (const sx of [-w / 2 - fw / 2, w / 2 + fw / 2]) piece('metal', M.metal, fw, h + fw, 0.22 + thick, lx + ux * sx, floor + h / 2, lz + uz * sx, '#2a2d33', yaw, B);
    piece('metal', M.metal, w + fw * 2, fw, 0.22 + thick, lx, floor + h + fw / 2, lz, '#2a2d33', yaw, B);
    const lamp = indicator(wx + ux * (w / 2 + 0.3), y + floor + h + 0.18, wz + uz * (w / 2 + 0.3), 1, locked ? 'red' : 'green');
    if (parent === interior) nearCull(pivot, lx, lz);
    const body = cols.addDynamicBox(null, w / 2, kind === 'heavy' ? 0.2 : 0.12);
    CollisionWorld.setBox(body, wx, wz, yaw, y + floor - (floor ? 0.3 : 1), y + floor + h);
    const d = { name, pos: { x: wx, z: wz, y: y + floor }, yaw, w, h, kind, locked, open: false, label: '', floor, body, pivot, leaf, lamp, k: 0 };
    body.owner = d;
    // where the leaf is at k (0 shut .. 1 open)
    d.pose = (k) => {
      if (slide === 'up') pivot.position.y = wy + k * (h - 0.25);
      else if (slide) { pivot.position.x = wx + ux * k * (w - 0.15); pivot.position.z = wz + uz * k * (w - 0.15); }
      else pivot.rotation.y = yaw - k * Math.PI / 2 * 0.9;
    };
    d.setOpen = (o) => { d.open = !!o; body.enabled = !o; lamp.set(o || !d.locked ? 'green' : 'red'); };
    d.snap = () => { d.k = d.open ? 1 : 0; d.pose(d.k); };     // no animation (a restore that stages the scene)
    d.unlock = () => { d.locked = false; lamp.set('green'); };
    d.lock = () => { d.locked = true; d.setOpen(false); lamp.set('red'); };
    d.setOpen(false);
    doorList.push(d);
    return d;
  };

  // ---------- the floor, the lid, the skirt round it, the fence ----------
  piece('asphalt', M.asphalt, HX * 2, 0.1, HZ * 2, 0, -0.055, 0, '#a3a5a8', 0, batch, 0.12);
  const lidRects = [[-99.5, -79.5, HANG.x0, 79.5], [HANG.x0, -79.5, 99.5, HANG.z0], [HANG.x0, HANG.z1, 99.5, 79.5], [HANG.x1, HANG.z0, 99.5, RAMP.z - 4.5], [HANG.x1, RAMP.z + 4.5, 99.5, HANG.z1]];
  for (const [x0, z0, x1, z1] of lidRects) {
    piece('plaster', M.plaster, x1 - x0, LID_T, z1 - z0, (x0 + x1) / 2, LID + LID_T / 2, (z0 + z1) / 2, '#46494d', 0, shell, 0.2);
    shell.add('fground', M.ground, box(x1 - x0, 0.04, z1 - z0), at((x0 + x1) / 2, LID + LID_T + 0.02, (z0 + z1) / 2), { color: tint('#9c9272'), uv: 'world', uvScale: 0.125 });
    cols.addFloor(cx + x0, cz + z0, cx + x1, cz + z1, y + LID);
  }
  const SK = 3.8; // the skirt: the lid's concrete edge where the land falls away from it
  piece('plaster', M.plaster, 199.4, SK, 0.4, 0, LID + LID_T - SK / 2, -79.3, '#77797b', 0, shell);
  piece('plaster', M.plaster, 199.4, SK, 0.4, 0, LID + LID_T - SK / 2, 79.3, '#77797b', 0, shell);
  piece('plaster', M.plaster, 0.4, SK, 158.6, -99.3, LID + LID_T - SK / 2, 0, '#77797b', 0, shell);
  piece('plaster', M.plaster, 0.4, SK, 79.5 + RAMP.z - 8.2, 99.3, LID + LID_T - SK / 2, (-79.5 + RAMP.z - 8.2) / 2, '#77797b', 0, shell);
  piece('plaster', M.plaster, 0.4, SK, 79.5 - RAMP.z - 8.2, 99.3, LID + LID_T - SK / 2, (79.5 + RAMP.z + 8.2) / 2, '#77797b', 0, shell);
  // air shafts through the lid (what shows from above of the halls below)
  for (const [lx, lz] of [[-75, -58], [-34, -53], [14, -53], [56, -49], [-37, 9], [5, 9], [-60, 40], [10, 62], [70, -20]]) {
    piece('plaster', M.plaster, 1.8, 1.3, 1.8, lx, LID + LID_T + 0.65, lz, '#5d6063', 0, shell);
    piece('metal', M.metal, 2.1, 0.12, 2.1, lx, LID + LID_T + 1.45, lz, STEEL_D, 0, shell);
  }
  // the fence round the lid: nobody walks onto it from the plain (panels follow the land)
  const fenceRun = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 4)), yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n, ax = x0 + (x1 - x0) * a, az = z0 + (z1 - z0) * a, bx = x0 + (x1 - x0) * b, bz = z0 + (z1 - z0) * b;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, ty = ctx.terrain.heightAt(cx + mx, cz + mz) - y;
      shell.add('fence', M.fence, box(0.03, 2.3, len / n), at(mx, ty + 1.2, mz, yaw), { color: tint('#c9ced3'), uv: 'world', uvScale: 1 / 0.6 });
      piece('metal', M.metal, 0.09, 2.6, 0.09, ax, ty + 1.2, az, '#3c4148', 0, shell);
      cols.addSegment(cx + ax, cz + az, cx + bx, cz + bz, 0.12, y + ty - 1, y + ty + 2.4);
    }
  };
  fenceRun(-99.9, -79.9, 99.9, -79.9); fenceRun(-99.9, 79.9, 99.9, 79.9); fenceRun(-99.9, -79.9, -99.9, 79.9);
  fenceRun(99.9, -79.9, 99.9, RAMP.z - 8.2); fenceRun(99.9, RAMP.z + 8.2, 99.9, 79.9);

  // =====================================================================================================
  // the arrival hall (x -90..-60, z -71.5..-44): the elevator's car stands in its shaft on the north wall
  // =====================================================================================================
  wall(-90, -71.5, -60, -71.5, [], conc()); wall(-90, -71.5, -90, -44, [], conc()); wall(-60, -71.5, -60, -44, [], conc());
  wall(-90, -44, -60, -44, [{ at: 22, w: 2.0, h: 2.4 }], conc());
  const arrivalDoor = fdoor('arrivalDoor', -68, -44, 0, 2.0, { h: 2.4 });
  wall(-81.2, -71.5, -81.2, -63, [], steelW(LID)); wall(-70.8, -71.5, -70.8, -63, [], steelW(LID));
  wall(-81.2, -63, -70.8, -63, [{ at: 5.2, w: 7.0, h: 3.0 }], steelW(LID));
  const carGate = fdoor('carGate', -76, -63, 0, 7.0, { h: 3.0, kind: 'bars', slide: 'up' });
  piece('metal', M.metal, 9.8, 0.04, 8.2, -76, 0.0, -67.3, '#6b737c', 0, batch, 0.6);               // the car's floor
  piece('metal', M.metal, 9.8, 0.12, 8.2, -76, 3.46, -67.3, STEEL_D);                                 // its roof
  cols.addFloor(cx - 81, cz - 71.5, cx - 71, cz - 63, y + 3.4);
  for (const sx of [-80.9, -71.1]) batch.add('bars', barsMat, box(0.04, 3.3, 8.0), at(sx, 1.7, -67.3), { uv: 'world', uvScale: 1 });
  for (const [lx, lz] of [[-81, -71.3], [-71, -71.3], [-81, -63.2], [-71, -63.2]]) piece('metal', M.metal, 0.16, 3.5, 0.16, lx, 1.75, lz, STEEL_D);
  piece('metal', M.metal, 0.7, 1.2, 0.2, -82.3, 1.3, -63.0, STEEL_D);                                // the call box
  tube(-76, -67.3, 3.4, { range: 8, intensity: 14 });
  const carSpots = [];
  for (const lz of [-69.6, -67.3, -65.0]) for (const lx of [-79, -77, -75, -73]) if (carSpots.length < 10) carSpots.push(P(lx, lz, 0, 0));
  const hallSpots = [];
  for (const lz of [-58.5, -55.5]) for (const lx of [-82, -79, -76, -73, -70]) hallSpots.push(P(lx, lz, 0, 0));
  block(-63.5, -52, 1.2, 3.0, 1.0, '#3d4249'); cover(-63.5, -52, 1.2, 3.0);                         // the guards' desk
  for (const [lx, lz] of [[-88, -47], [-86.4, -47], [-88, -48.6], [-62, -69]]) crate(lx, lz);
  for (const [lx, lz] of [[-86, -56], [-66, -56], [-86, -48], [-76, -50]]) tube(lx, lz, LID, { range: 13, intensity: 22 });
  red(-89.7, -60, 3.2, 'arrival'); red(-60.3, -60, 3.2, 'arrival');
  sign('מעלית משא · מפלס תחתון', -76, 4.2, -62.8, 0, 4.0, 0.6);
  sign('תאי מעצר', -68, 2.85, -44.25, Math.PI, 2.4, 0.5);

  // =====================================================================================================
  // the holding cells (x -90..-65, z -44..-6): a hallway, the big cell, three small cells, the guard door
  // =====================================================================================================
  const CELL_H = 3.6;
  wall(-90, -44, -90, -24, [], conc(CELL_H)); wall(-90, -24, -71, -24, [], conc(CELL_H));
  wall(-80, -24, -80, -6, [], conc(CELL_H)); wall(-80, -18, -71, -18, [], conc(CELL_H)); wall(-80, -12, -71, -12, [], conc(CELL_H));
  wall(-80, -6, -65, -6, [], conc(CELL_H));
  wall(-65, -44, -65, -6, [{ at: 16, w: 1.6, h: 2.3 }], conc(4.4));
  const guardDoor = fdoor('guardDoor', -65, -28, Math.PI / 2, 1.6);
  wall(-71, -44, -71, -24, [{ at: 10, w: 2.0, h: 2.4 }], barsW(CELL_H));
  wall(-71, -24, -71, -6, [{ at: 3, w: 1.2, h: 2.3 }, { at: 9, w: 1.2, h: 2.3 }, { at: 15, w: 1.2, h: 2.3 }], barsW(CELL_H));
  const bigCell = fdoor('bigCell', -71, -34, Math.PI / 2, 2.0, { h: 2.4, kind: 'bars', slide: true });
  const cellDoors = [-21, -15, -9].map((lz, i) => fdoor(`cell${i + 1}`, -71, lz, Math.PI / 2, 1.2, { kind: 'bars', slide: true }));
  ceiling(-90, -44, -65, -6, CELL_H);
  // the big cell: a bench along the west wall; the gang wakes here, on the bench and on the floor
  block(-89.35, -34, 0.5, 14, 0.45, '#5a5e63', 'plaster', M.plaster);
  for (const lz of [-21, -15, -9]) block(-79.35, lz, 0.5, 3.4, 0.45, '#5a5e63', 'plaster', M.plaster);
  const wake = [
    ...[-40, -37, -34, -31, -28].map((lz) => ({ ...P(-88.75, lz, 0, Math.PI / 2), pose: 'sit' })),
    { ...P(-84, -41.2, 0, 2.2), pose: 'down' }, { ...P(-80.5, -38.4, 0, -2.6), pose: 'down' }, { ...P(-84.5, -35.6, 0, 1.3), pose: 'down' },
    { ...P(-79.2, -31.4, 0, Math.PI), pose: 'down' }, { ...P(-83.2, -27.4, 0, 0.7), pose: 'down' },
  ];
  for (const [lx, lz] of [[-80, -34], [-75.5, -21], [-75.5, -15], [-75.5, -9], [-68, -38], [-68, -16]]) tube(lx, lz, CELL_H, { range: 9, intensity: 14 });
  red(-65.3, -40, 2.8, 'cells'); red(-89.7, -28, 2.8, 'cells');
  sign('תא 1', -70.92, 2.8, -21, Math.PI / 2, 1.0, 0.3); sign('תא 2', -70.92, 2.8, -15, Math.PI / 2, 1.0, 0.3); sign('תא 3', -70.92, 2.8, -9, Math.PI / 2, 1.0, 0.3);

  // =====================================================================================================
  // the iron corridor (x -65..80, z -31..-25): steel, ribbed, with bays both sides; the rooms open off it
  // =====================================================================================================
  const CH = 4.4, NB = [-50, -18, -2, 8, 26, 56, 70], SB = [-56, -40, -8, 18, 40, 62];
  wall(-65, -31, 80, -31, NB.map((x) => ({ at: x + 65, w: 5, h: CH })), steelW(CH));
  wall(-65, -25, 80, -25, [...SB.map((x) => ({ at: x + 65, w: 5, h: CH })), { at: 77 + 65, w: 3.8, h: 3.6 }], steelW(CH));
  wall(80, -31, 80, -25, [], steelW(CH));
  for (const x of NB) { wall(x - 2.5, -31, x - 2.5, -36, [], steelW(CH)); wall(x + 2.5, -31, x + 2.5, -36, [], steelW(CH)); if ([-2, 26, 70].includes(x)) wall(x - 2.5, -35.6, x + 2.5, -35.6, [], steelW(CH)); }
  for (const x of SB) { wall(x - 2.5, -25, x - 2.5, -21, [], steelW(CH)); wall(x + 2.5, -25, x + 2.5, -21, [], steelW(CH)); }
  for (const x of [-56, -8, 40, 62]) wall(x - 2.5, -21, x + 2.5, -21, [], steelW(CH));
  ceiling(-65, -36, 80, -21, CH, '#3b4047');
  piece('metal', M.metal, 145, 0.03, 5.7, 7.5, 0.015, -28, '#5b6067', 0, batch, 0.5);                 // steel deck plates
  for (let x = -62; x <= 78; x += 4) for (const z of [-30.75, -25.25]) if (!(z < -28 ? NB : [...SB, 77]).some((b) => Math.abs(b - x) < 3.2)) piece('metal', M.metal, 0.3, CH, 0.22, x, CH / 2, z, STEEL_D); // the ribs
  for (const z of [-30.4, -29.8]) batch.add('paint', M.paint, new THREE.CylinderGeometry(0.12, 0.12, 145, 8).rotateZ(Math.PI / 2), at(7.5, CH - 0.35, z), { color: tint(z < -30 ? '#7a3b2b' : '#3f5a6b') }); // pipes
  const shutter = fdoor('shutter', -34, -28, Math.PI / 2, 6.0, { h: 4.2, slide: 'up' });
  // the two guard rooms behind the south bays at x -40 and 18 (each with a back door into the stores)
  const guardRooms = [-40, 18].map((x, i) => {
    wall(x - 3, -21, x + 3, -21, [{ at: 3, w: 1.4, h: 2.3 }], conc(3.4)); wall(x - 3, -21, x - 3, -14, [], conc(3.4)); wall(x + 3, -21, x + 3, -14, [], conc(3.4));
    ceiling(x - 3, -21, x + 3, -14, 3.4);
    const door = fdoor(`guardRoom${i + 1}`, x, -21, 0, 1.4), back = fdoor(`guardRoom${i + 1}Back`, x, -14, 0, 1.4);
    block(x - 2.2, -17.5, 0.9, 1.8, 0.8, '#5a4a38'); crate(x + 2, -15.4, 1.0, 1.0, 0.9);
    tube(x, -17.5, 3.4, { range: 7, intensity: 12 });
    return { door, back, inside: P(x, -17.5), out: P(x, -23), backOut: P(x, -12.4) };
  });
  for (let x = -60; x <= 76; x += 10) tube(x, -28, CH, { range: 12, intensity: 22, yaw: Math.PI / 2, len: 1.6 });
  for (const x of [-46, -12, 22, 50]) red(x, -30.7, 3.4, 'corridor');
  sign('חדר מכונות', -50, 3.0, -35.75, 0, 2.4, 0.5); sign('חדר מכונות', -18, 3.0, -35.75, 0, 2.4, 0.5); sign('זירה', 8, 3.25, -35.75, 0, 2.0, 0.5);
  sign('מנהרה · מחסנים · האנגר', 77, 3.95, -25.2, Math.PI, 3.6, 0.5); sign('תאי מעצר', -64.8, 3.3, -28, Math.PI / 2, 2.4, 0.5);
  sign('שומרים', -40, 2.75, -21.25, Math.PI, 1.6, 0.4); sign('שומרים', 18, 2.75, -21.25, Math.PI, 1.6, 0.4);

  // =====================================================================================================
  // the machine room (x -56..-12, z -70..-36): the floor way under three presses and through two steam
  // vents, the catwalk way above them; doors A (west) and B (east) open off the corridor's bays
  // =====================================================================================================
  wall(-56, -36, -12, -36, [{ at: 6, w: 1.6, h: 2.4 }, { at: 38, w: 1.6, h: 2.4 }], conc());
  wall(-56, -70, -12, -70, [], conc()); wall(-56, -70, -56, -36, [], conc()); wall(-12, -70, -12, -36, [], conc());
  wall(-34, -36, -34, -40, [], conc());
  const machA = fdoor('machA', -50, -36, 0, 1.6, { h: 2.4 }), machB = fdoor('machB', -18, -36, 0, 1.6, { h: 2.4 });
  // the machines: a row along the north wall (under the catwalk), the boilers in the middle
  for (const [lx, w, h, col] of [[-49, 7.6, 2.5, '#4b5560'], [-41.5, 6.4, 2.2, '#5d4f3e'], [-34, 7.4, 2.6, '#3f4a55'], [-26.5, 6.4, 2.3, '#55483a'], [-19, 7.6, 2.5, '#4b5560']]) piece('paint', M.paint, w, h, 6.8, lx, h / 2, -66.4, col);
  solid(-34, -66.6, 19, 3.6, 2.6);
  for (const [lx, lz, w, d, h, col] of [[-37.5, -48, 6.6, 15.6, 3.6, '#55606b'], [-30.5, -48, 6.6, 15.6, 3.2, '#4a535d']]) piece('paint', M.paint, w, h, d, lx, h / 2, lz, col);
  solid(-34, -48, 7, 8, 3.6);
  for (const lz of [-52, -44]) batch.add('paint', M.paint, new THREE.CylinderGeometry(1.1, 1.1, 13.6, 14).rotateZ(Math.PI / 2), at(-34, 4.1, lz), { color: tint('#6b5a3e') }); // boiler drums
  // presses on the walkway (z -63..-56), steam vents across the west and east lanes
  const hazards = [];
  const pressMat = std({ color: '#7a7f86', roughness: 0.45, metalness: 0.6 });
  // who stands where (a mission hands over a list of positions, machines.watch): a press head never comes
  // down onto anyone. Over a body it stops at CLEAR (the hit still lands: a big shove of steel that knocks
  // him out from under it); with nobody under it, it comes all the way down and, while it is low, the
  // steel is solid: nobody walks into it until it has risen
  const crowd = { fn: null };
  const CLEAR = 2.1;
  const under = (hz) => {
    const list = crowd.fn?.(); if (!list) return false;
    for (const p of list) if (p.y < y + 2 && Math.abs(p.x - hz.x) < hz.hx + 0.3 && Math.abs(p.z - hz.z) < hz.hz + 0.3) return true;
    return false;
  };
  const press = (lx, offset) => {
    for (const pz of [-63.4, -55.6]) { piece('paint', M.paint, 0.5, 5.0, 0.5, lx, 2.5, pz, '#3b4048'); solid(lx, pz, 0.25, 0.25, 5.0); }
    piece('paint', M.paint, 3.0, 0.6, 8.4, lx, 5.0, -59.5, '#2f343b');
    for (const sx of [-1.35, 1.35]) piece('paint', M.paint, 0.18, 0.02, 6.8, lx + sx, 0.02, -59.5, '#d8b12a');
    piece('metal', M.metal, 2.5, 0.03, 6.6, lx, 0.015, -59.5, '#4a4e55', 0, batch, 0.6);
    const head = new THREE.Mesh(box(2.4, 1.1, 6.6), pressMat); head.position.set(cx + lx, y + 3.95, cz - 59.5); interior.add(head);
    const lamp = indicator(cx + lx, y + 4.55, cz - 55.25, 1.8);
    const steel = cols.addDynamicBox(null, 1.25, 3.35); steel.enabled = false;
    const hz = { kind: 'press', ...P(lx, -59.5), hx: 1.2, hz: 3.3, on: true, t: offset, period: 4.6, phase: 'idle', warning: false, active: false, held: false, head, lamp, steel };
    let drawn = 3.4; // where the head's underside is now
    hz.update = (dt) => {
      if (!hz.on) { hz.phase = 'off'; hz.warning = hz.active = hz.held = false; steel.enabled = false; head.position.y += (y + 3.95 - head.position.y) * Math.min(1, dt * 3); drawn = head.position.y - y - 0.55; lamp.set('off'); return; }
      hz.t = (hz.t + dt) % hz.period;
      const t = hz.t;
      let b; // the head's underside above the floor, as the cycle has it
      if (t < 2.4) { hz.phase = 'idle'; b = 3.4; }
      else if (t < 3.2) { hz.phase = 'warn'; b = 3.4 - (t - 2.4) * 0.25; }
      else if (t < 3.32) { hz.phase = 'slam'; b = 3.2 - (t - 3.2) / 0.12 * 3.1; }
      else if (t < 4.02) { hz.phase = 'down'; b = 0.1; }
      else { hz.phase = 'rise'; b = 0.1 + (t - 4.02) / 0.58 * 3.3; }
      // the safety stop: someone under it, and the head stays above him (it only ever goes down at a slam's pace)
      hz.held = b < CLEAR && drawn >= CLEAR - 0.05 && under(hz);
      const want = hz.held ? CLEAR : b;
      drawn = want < drawn ? Math.max(want, drawn - 30 * dt) : want;
      head.position.y = y + drawn + 0.55;
      steel.enabled = drawn < CLEAR - 0.05;
      if (steel.enabled) CollisionWorld.setBox(steel, cx + lx, cz - 59.5, 0, y - 1, y + drawn);
      hz.warning = hz.phase === 'warn'; hz.active = b < 1.7;
      lamp.set(hz.active ? 'red' : hz.warning ? ((t * 8) % 1 < 0.5 ? 'amber' : 'off') : 'green');
    };
    hazards.push(hz);
  };
  press(-38.5, 0); press(-34, 1.55); press(-29.5, 3.1);
  const vent = (x0, x1, lz, offset) => {
    const w = x1 - x0, lx = (x0 + x1) / 2;
    piece('metal', M.metal, w, 0.04, 1.6, lx, 0.02, lz, '#2c3036', 0, batch, 1.2);
    for (const sz of [-0.95, 0.95]) piece('paint', M.paint, w, 0.02, 0.16, lx, 0.025, lz + sz, '#d8b12a');
    for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) piece('paint', M.paint, 0.4, 0.5, 0.4, lx + sx, 0.25, lz, '#3b4048');
    const mat = new THREE.MeshStandardMaterial({ color: '#e8eef2', transparent: true, opacity: 0, depthWrite: false, roughness: 1 });
    const plume = new THREE.Mesh(box(w - 0.6, 1, 1.3), mat); plume.position.set(cx + lx, y, cz + lz); plume.visible = false; plume.userData.hide = true; plume.renderOrder = 3; interior.add(plume);
    const lamp = indicator(cx + x0 - 0.05, y + 1.6, cz + lz, 1.8);
    const hz = { kind: 'steam', ...P(lx, lz), hx: w / 2, hz: 0.8, on: true, t: offset, period: 4.0, phase: 'idle', warning: false, active: false, plume, lamp };
    hz.update = (dt) => {
      if (!hz.on) { hz.phase = 'off'; hz.warning = hz.active = false; plume.visible = false; plume.userData.hide = true; lamp.set('off'); return; }
      hz.t = (hz.t + dt) % hz.period;
      const t = hz.t;
      let s = 0, o = 0;
      if (t < 2.2) hz.phase = 'idle';
      else if (t < 2.8) { hz.phase = 'warn'; s = 0.35 + 0.15 * Math.sin(t * 20); o = 0.22; }
      else { hz.phase = 'burst'; const k = Math.min(1, (t - 2.8) / 0.2) * Math.min(1, (hz.period - t) / 0.3); s = 3.4 * k + 0.2; o = 0.5 * k + 0.1; }
      plume.userData.hide = !(s > 0); plume.scale.y = Math.max(0.01, s); plume.position.y = y + s / 2; mat.opacity = o;
      hz.warning = hz.phase === 'warn'; hz.active = hz.phase === 'burst';
      lamp.set(hz.active ? 'red' : hz.warning ? ((t * 8) % 1 < 0.5 ? 'amber' : 'off') : 'green');
    };
    hazards.push(hz);
  };
  vent(-53, -41.2, -48, 0.6); vent(-26.8, -15, -46, 2.4);
  for (const hz of hazards) {
    hz.set = (on) => { hz.on = !!on; if (on && hz.phase === 'off') hz.t = 0; };
    // is (x, z) caught: only while the press is down / the steam bursts (each warns first: an amber lamp)
    hz.hits = (x, z, yy = null) => hz.on && hz.active && (yy === null || yy < y + 2) && Math.abs(x - hz.x) < hz.hx + 0.3 && Math.abs(z - hz.z) < hz.hz + 0.3;
    hz.reset = () => { hz.on = true; hz.t = hz.kind === 'press' ? hazards.filter((q) => q.kind === 'press').indexOf(hz) * 1.55 : hz.kind === 'steam' ? [0.6, 2.4][hazards.filter((q) => q.kind === 'steam').indexOf(hz)] : 0; };
  }
  // the catwalk at 3 m: along the north wall over the machines, down both side walls to the stairs
  const CW = 3.0, cwOpts = { key: 'metal', mat: M.metal, color: '#646b73', scale: 0.8, name: 'facility catwalk', thick: 0.12 };
  level(-34, -68.5, 22, 1.5, CW, cwOpts); level(-54.5, -58.5, 1.5, 8.5, CW, cwOpts); level(-13.5, -58.5, 1.5, 8.5, CW, cwOpts);
  const rail = (x0, z0, x1, z1, floor = CW) => wall(x0, z0, x1, z1, [], { h: 1.1, t: 0.08, floor, color: '#c9a13a', key: 'paint', mat: M.paint, scale: 0.5 });
  rail(-53, -67, -15, -67); rail(-53, -67, -53, -48.6); rail(-15, -67, -15, -48.6);
  for (const [lx, lz] of [[-53.2, -62], [-53.2, -56], [-14.8, -62], [-14.8, -56], [-44, -66.8], [-24, -66.8]]) { piece('paint', M.paint, 0.16, CW, 0.16, lx, CW / 2, lz, '#3b4048'); solid(lx, lz, 0.08, 0.08, CW - 0.3); }
  const machStairsW = stairs(-54.5, -42, Math.PI, { rise: CW, run: 8, width: 2.2, steps: 12, color: '#5d646c', key: 'metal', mat: M.metal });
  const machStairsE = stairs(-13.5, -42, Math.PI, { rise: CW, run: 8, width: 2.2, steps: 12, color: '#5d646c', key: 'metal', mat: M.metal });
  // nobody steps off the stairs' open side, nor walks into it from the floor (up them from the foot only)
  cols.addSegment(cx - 53.3, cz - 41.95, cx - 53.3, cz - 50, 0.1, y - 1, y + CW + 1.2);
  cols.addSegment(cx - 14.7, cz - 41.95, cx - 14.7, cz - 50, 0.1, y - 1, y + CW + 1.2);
  // a striped barrier arm at the foot of each stair, hinged by the wall: up (the free walk) or down across
  // the stairs, so a fight on the floor stays on the floor (machines.stairBars)
  const barMat = std({ color: '#d8b12a', roughness: 0.55, metalness: 0.2 }), barDark = std({ color: '#22252a', roughness: 0.6 });
  const stairBars = [[-54.5, -1], [-13.5, 1]].map(([lx, side]) => {
    const len = 2.36, hx = cx + lx + side * 1.18, z = cz - 41.8;
    piece('metal', M.metal, 0.16, 1.1, 0.16, lx + side * 1.26, 0.55, -41.8, '#3b4048');
    const pivot = new THREE.Group(); pivot.position.set(hx, y + 1.0, z); interior.add(pivot);
    for (let k = 0; k < 6; k++) { const seg = new THREE.Mesh(box(len / 6, 0.1, 0.1), k % 2 ? barDark : barMat); seg.position.x = -side * (len / 12 + k * len / 6); pivot.add(seg); }
    nearCull(pivot, lx, -41.8);
    const body = cols.addDynamicBox(null, 1.25, 0.2); CollisionWorld.setBox(body, cx + lx, z, 0, y - 1, y + 1.2); body.enabled = false;
    const bar = { down: false, k: 0, pivot, body };
    bar.set = (on, snap = false) => { bar.down = !!on; body.enabled = bar.down; if (snap) bar.k = bar.down ? 1 : 0; bar.pose(); };
    bar.pose = () => { pivot.rotation.z = -side * (1 - bar.k) * Math.PI / 2 * 0.96; };
    bar.update = (dt) => { const want = bar.down ? 1 : 0; if (bar.k !== want) { bar.k = want > bar.k ? Math.min(1, bar.k + dt / 0.6) : Math.max(0, bar.k - dt / 0.6); bar.pose(); } };
    bar.pose();
    return bar;
  });
  // the panel that stops the machines, on the boilers' west face (south of the west vent)
  piece('paint', M.paint, 0.2, 1.1, 0.9, -41.1, 1.3, -42, '#2e3640');
  const panelLamp = indicator(cx - 41.25, y + 2.0, cz - 42, 1.6);
  for (const [lx, lz] of [[-48, -42], [-48, -59.5], [-34, -59.5], [-20, -59.5], [-20, -42], [-34, -68.5]]) tube(lx, lz, LID, { range: 13, intensity: 22 });
  red(-55.7, -52, 3.6, 'machines'); red(-12.3, -52, 3.6, 'machines');
  sign('סכנה · מכבשים', -34, 2.1, -62.95, 0, 2.8, 0.5, '#3a2a0a', '#ffd27a'); sign('קיטור', -47, 2.6, -36.25, Math.PI, 1.6, 0.4, '#3a2a0a', '#ffd27a');

  // =====================================================================================================
  // the detention arena (x -6..36, z -70..-36): a cage in a pit of stands (2.2 m up) on three sides
  // =====================================================================================================
  const SH = 2.2;
  wall(-6, -36, 36, -36, [{ at: 14, w: 2.0, h: 2.6 }], conc()); wall(-6, -70, 36, -70, [], conc()); wall(-6, -70, -6, -36, [], conc()); wall(36, -70, 36, -36, [], conc());
  const arenaDoor = fdoor('arena', 8, -36, 0, 2.0, { h: 2.6 });
  for (const [x0, z0, x1, z1] of [[-5.8, -69.8, 2, -40], [2, -69.8, 26, -64], [26, -69.8, 35.8, -40]]) {
    const lx = (x0 + x1) / 2, lz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    piece('plaster', M.plaster, hx * 2, SH - 0.25, hz * 2, lx, (SH - 0.25) / 2, lz, '#55585c');
    solid(lx, lz, hx, hz, 2.0);
    level(lx, lz, hx, hz, SH, { key: 'plaster', mat: M.plaster, color: '#5f6266', name: 'facility stands' });
  }
  const sRail = (x0, z0, x1, z1) => wall(x0, z0, x1, z1, [], { h: 1.1, t: 0.08, floor: SH, color: '#8a9099', key: 'metal', mat: M.metal, scale: 0.5 });
  sRail(2, -64, 2, -40); sRail(2, -64, 26, -64); sRail(26, -64, 26, -40);
  sRail(-5.8, -40, -4.95, -40); sRail(-2.65, -40, 2, -40); sRail(26, -40, 30.65, -40); sRail(32.95, -40, 35.8, -40);
  const arenaStairsW = stairs(-3.8, -37, Math.PI, { rise: SH, run: 3.0, width: 2.2, steps: 9, color: '#6b6e71' });
  const arenaStairsE = stairs(31.8, -37, Math.PI, { rise: SH, run: 3.0, width: 2.2, steps: 9, color: '#6b6e71' });
  for (const sx of [-5.0, -2.6, 30.6, 33.0]) cols.addSegment(cx + sx, cz - 37.6, cx + sx, cz - 40, 0.1, y - 1, y + SH + 1.2);
  // the cage: chain-link 3.4 m high round 16 × 16 m, the gate on its south side
  const cageO = { h: 3.4, t: 0.05, color: '#c8ccd2', key: 'fence', mat: M.fence, scale: 1 / 0.6 };
  wall(6, -60, 22, -60, [], cageO); wall(22, -60, 22, -44, [], cageO); wall(6, -44, 6, -60, [], cageO);
  wall(6, -44, 22, -44, [{ at: 8, w: 2.4, h: 2.6 }], cageO);
  const cageGate = fdoor('cage', 14, -44, 0, 2.4, { h: 2.6, kind: 'cage', slide: true });
  for (let k = 0; k <= 4; k++) for (const [lx, lz] of [[6 + k * 4, -60], [6 + k * 4, -44], [6, -60 + k * 4], [22, -60 + k * 4]]) if (!(lz === -44 && Math.abs(lx - 14) < 1.4)) piece('metal', M.metal, 0.12, 3.5, 0.12, lx, 1.75, lz, '#3c4148');
  for (const [x0, z0, x1, z1] of [[6, -60, 22, -60], [6, -44, 22, -44], [6, -60, 6, -44], [22, -60, 22, -44]]) piece('metal', M.metal, Math.abs(x1 - x0) + 0.1, 0.1, Math.abs(z1 - z0) + 0.1, (x0 + x1) / 2, 3.45, (z0 + z1) / 2, '#3c4148');
  piece('paint', M.paint, 15.6, 0.02, 15.6, 14, 0.012, -52, '#3d3a36');                                   // the cage's mat
  const rails = [...[-60, -55, -50, -45].map((lz) => P(0.9, lz, SH, Math.PI / 2)), ...[-60, -55, -50, -45].map((lz) => P(27.1, lz, SH, -Math.PI / 2)), ...[9, 14, 19].map((lx) => P(lx, -65.1, SH, 0))];
  for (const [lx, lz] of [[8, -46], [20, -46], [8, -58], [20, -58]]) tube(lx, lz, LID, { range: 16, intensity: 34 });
  for (const [lx, lz] of [[-2, -54], [30, -54], [14, -67]]) tube(lx, lz, LID, { range: 10, intensity: 14 });
  red(-5.7, -45, 3.8, 'arena'); red(35.7, -45, 3.8, 'arena');
  sign('הזירה', 14, 4.6, -69.75, 0, 3.0, 0.7, '#2a0d0d', '#ff8a7a');

  // =====================================================================================================
  // the armory (x 44..68, z -62..-36): the card door, the quartermaster's desk and its clipboard, the bars
  // across the room with a gate on a keypad, and behind them the wall of the gang's markers
  // =====================================================================================================
  wall(44, -36, 68, -36, [{ at: 12, w: 1.6, h: 2.4 }], conc()); wall(44, -62, 68, -62, [], conc()); wall(44, -62, 44, -36, [], conc()); wall(68, -62, 68, -36, [], conc());
  const armoryDoor = fdoor('armory', 56, -36, 0, 1.6, { h: 2.4, kind: 'heavy', locked: true });
  wall(44, -54, 68, -54, [{ at: 12, w: 1.6, h: 2.4 }], barsW(LID));
  const rackGate = fdoor('rackGate', 56, -54, 0, 1.6, { h: 2.4, kind: 'bars', slide: true, locked: true });
  // the card reader on the bay's west wall, the keypad on the bars by the gate
  const devMat = std({ color: '#1c1f24', roughness: 0.5, metalness: 0.4 });
  const readerMesh = new THREE.Mesh(box(0.06, 0.22, 0.14), devMat); readerMesh.position.set(cx + 53.7, y + 1.3, cz - 34.4); interior.add(readerMesh);
  const readerLamp = indicator(cx + 53.75, y + 1.44, cz - 34.4, 0.6, 'red');
  const keyCanvas = document.createElement('canvas'); keyCanvas.width = 64; keyCanvas.height = 96;
  { const g = keyCanvas.getContext('2d'); g.fillStyle = '#20242a'; g.fillRect(0, 0, 64, 96); g.fillStyle = '#9fb3c8'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(6 + c * 19, 26 + r * 17, 14, 12); g.fillStyle = '#2fd27a'; g.fillRect(6, 6, 52, 12); }
  const keyTex = new THREE.CanvasTexture(keyCanvas); keyTex.colorSpace = THREE.SRGBColorSpace;
  const keypadMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.3), std({ map: keyTex, roughness: 0.6 })); keypadMesh.position.set(cx + 57.6, y + 1.35, cz - 53.93); interior.add(keypadMesh);
  const keypadLamp = indicator(cx + 57.6, y + 1.6, cz - 53.9, 0.6, 'red');
  // the clipboard on the wall over the desk: whatever a mission writes on it (the code by default)
  block(45.0, -46, 1.6, 2.2, 0.8, '#5a4a38'); cover(45, -46, 1.6, 2.2);
  const clipCanvas = document.createElement('canvas'); clipCanvas.width = 256; clipCanvas.height = 320;
  const clipTex = new THREE.CanvasTexture(clipCanvas); clipTex.colorSpace = THREE.SRGBColorSpace;
  const clipMat = std({ map: clipTex, roughness: 0.8, emissive: '#ffffff', emissiveMap: clipTex, emissiveIntensity: 0 }); clipMat.userData.night = 0.25;
  const clipMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.52), clipMat); clipMesh.position.set(cx + 44.23, y + 1.55, cz - 46); clipMesh.rotation.y = Math.PI / 2; interior.add(clipMesh);
  const writeClip = (lines) => {
    const g = clipCanvas.getContext('2d');
    g.fillStyle = '#5a3f22'; g.fillRect(0, 0, 256, 320); g.fillStyle = '#efe9d8'; g.fillRect(12, 18, 232, 290);
    g.fillStyle = '#3a3d44'; g.fillRect(84, 4, 88, 30);
    g.fillStyle = '#1c1f26'; g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle';
    [].concat(lines).forEach((line, i) => { g.font = `${i === 0 ? 'bold ' : ''}${i === 0 ? 24 : 26}px ${SIGN_FONT}`; g.fillText(line, 232, 66 + i * 46); });
    clipTex.needsUpdate = true;
  };
  const clipDefault = ['נשקייה · משמרת לילה', 'שומר: ט׳ 7', 'בדיקה: 02:00', `קוד השער: ${ARMORY_CODE}`, 'לא להשאיר פתוח'];
  writeClip(clipDefault);
  // the wall of weapons: a steel board, pegs, ten markers (two rows of five), one instance each
  piece('metal', M.metal, 15, 2.4, 0.12, 56, 1.6, -61.72, '#3f454c', 0, batch, 0.6);
  piece('paint', M.paint, 15.4, 0.12, 0.5, 56, 0.45, -61.5, '#2f343b');
  const gunParts = (() => {
    const body = [box(0.06, 0.09, 0.32).translate(0, 0.06, 0.1), new THREE.CylinderGeometry(0.016, 0.016, 0.36, 8).rotateX(Math.PI / 2).translate(0, 0.075, 0.42), box(0.04, 0.12, 0.05), new THREE.CylinderGeometry(0.03, 0.03, 0.18, 8).rotateX(Math.PI / 2).translate(0, 0.02, -0.14)].map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; });
    const hop = new THREE.CylinderGeometry(0.05, 0.055, 0.13, 12).translate(0, 0.17, 0.09);
    return { body: mergeGeometries(body, false), hop };
  })();
  const rackBody = new THREE.InstancedMesh(gunParts.body, std({ color: '#26292e', roughness: 0.5, metalness: 0.45 }), 10);
  const rackHop = new THREE.InstancedMesh(gunParts.hop, std({ color: '#ffffff', roughness: 0.45 }), 10);
  const markers = [], hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < 10; i++) {
    const lx = 50.5 + (i % 5) * 2.75, ly = i < 5 ? 1.95 : 1.2, lz = -61.5;
    const m = mat4(cx + lx, y + ly, cz + lz, Math.PI / 2, 1.5, 1.5, 1.5);
    rackBody.setMatrixAt(i, m); rackHop.setMatrixAt(i, m); rackHop.setColorAt(i, new THREE.Color(COLORS[OWNERS[i]] || '#36c3ff'));
    piece('metal', M.metal, 0.05, 0.05, 0.22, lx - 0.25, ly - 0.03, -61.55, '#9aa1a8'); piece('metal', M.metal, 0.05, 0.05, 0.22, lx + 0.25, ly - 0.03, -61.55, '#9aa1a8');
    markers.push({ i, owner: OWNERS[i], color: COLORS[OWNERS[i]], ...P(lx, lz, ly), at: P(lx, -59.8, 0, Math.PI), matrix: m, taken: false });
  }
  rackBody.instanceMatrix.needsUpdate = true; rackHop.instanceMatrix.needsUpdate = true; rackHop.instanceColor.needsUpdate = true;
  interior.add(rackBody, rackHop);
  // beside each marker the rest of its owner's kit, taken with it: his paint pistol and his mask (the shell in
  // his colour), so the wall is full when the bars open and empties one owner at a time
  const kitParts = (() => {
    const pistol = [box(0.04, 0.07, 0.2).translate(0, 0.05, 0.03), box(0.035, 0.11, 0.05).translate(0, -0.03, -0.04), new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0.06, 0.18)].map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; });
    const mask = [box(0.2, 0.09, 0.07).translate(0, 0.05, 0), box(0.16, 0.1, 0.06).translate(0, -0.05, 0.01), box(0.22, 0.025, 0.09).translate(0, 0.1, -0.01)].map((g) => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; });
    return { pistol: mergeGeometries(pistol, false), mask: mergeGeometries(mask, false) };
  })();
  const rackPistol = new THREE.InstancedMesh(kitParts.pistol, std({ color: '#ffffff', roughness: 0.5, metalness: 0.3 }), 10);
  const rackMask = new THREE.InstancedMesh(kitParts.mask, std({ color: '#ffffff', roughness: 0.6 }), 10);
  const kitDark = new THREE.Color('#2a2d33');
  markers.forEach((mk, i) => {
    const lx = 50.5 + (i % 5) * 2.75, ly = i < 5 ? 1.95 : 1.2, own = new THREE.Color(mk.color || '#36c3ff');
    mk.pistolMatrix = mat4(cx + lx + 1.45, y + ly - 0.02, cz - 61.55, Math.PI / 2, 1.5, 1.5, 1.5);
    mk.maskMatrix = mat4(cx + lx + 2.05, y + ly + 0.02, cz - 61.58, 0, 1.4, 1.4, 1.4);
    rackPistol.setMatrixAt(i, mk.pistolMatrix); rackPistol.setColorAt(i, kitDark.clone().lerp(own, 0.45));
    rackMask.setMatrixAt(i, mk.maskMatrix); rackMask.setColorAt(i, own);
    piece('metal', M.metal, 0.04, 0.04, 0.18, lx + 2.05, ly + 0.14, -61.6, '#9aa1a8');
  });
  rackPistol.instanceMatrix.needsUpdate = true; rackPistol.instanceColor.needsUpdate = true; rackMask.instanceMatrix.needsUpdate = true; rackMask.instanceColor.needsUpdate = true;
  interior.add(rackPistol, rackMask);
  // on the shelf under the board: hoppers, paint pods and boxes of paint (the Order's haul, it stays); a strip
  // light over the board and the Order's own label on it
  for (let k = 0; k < 14; k++) {
    const lx = 49.3 + k * 1.03, col = COLORS[OWNERS[k % 10]] || '#36c3ff';
    if (k % 3 === 2) piece('paint', M.paint, 0.5, 0.32, 0.34, lx, 0.67, -61.45, '#3b4a2e');
    else { batch.add('paint', M.paint, new THREE.CylinderGeometry(0.1, 0.11, 0.26, 10), at(lx, 0.64, -61.45), { color: tint(col) }); piece('paint', M.paint, 0.06, 0.2, 0.06, lx + 0.22, 0.61, -61.45, '#2a2d33'); }
  }
  batch.add('flamp', coldMat, box(14.6, 0.06, 0.12), at(56, 2.98, -61.6));
  piece('metal', M.metal, 14.8, 0.08, 0.22, 56, 3.03, -61.62, STEEL_D);
  S.lamps.push({ ...toWorld(56, -60.4), y: y + 2.7, inside: true, range: 9, intensity: 22, color: '#e8f0ff' });
  sign('ציוד מוחרם · החבורה של נהוראי', 56, 3.35, -61.55, 0, 4.2, 0.42, '#2a0d0d', '#ff8a7a');
  const setMarker = (i, shown) => {
    const mk = markers[i]; if (!mk) return; mk.taken = !shown;
    rackBody.setMatrixAt(i, shown ? mk.matrix : hidden); rackHop.setMatrixAt(i, shown ? mk.matrix : hidden);
    rackPistol.setMatrixAt(i, shown ? mk.pistolMatrix : hidden); rackMask.setMatrixAt(i, shown ? mk.maskMatrix : hidden);
    rackBody.instanceMatrix.needsUpdate = true; rackHop.instanceMatrix.needsUpdate = true; rackPistol.instanceMatrix.needsUpdate = true; rackMask.instanceMatrix.needsUpdate = true;
  };
  const rack = {
    markers, owners: OWNERS,
    take: (i) => setMarker(i, false),                  // one picked up: it is gone from the wall
    all: () => markers.forEach((_, i) => setMarker(i, false)),
    reset: () => markers.forEach((_, i) => setMarker(i, true)),
    left: () => markers.filter((m) => !m.taken).length,
    of: (id) => markers.find((m) => m.owner === id) || null,
    at: P(56, -58.5, 0, Math.PI),
  };
  for (const [lx, lz] of [[50, -40], [62, -40], [56, -48], [50, -58], [62, -58]]) tube(lx, lz, LID, { range: 12, intensity: 20 });
  for (const [lx, lz] of [[64.6, -40.5], [66, -42], [64.6, -42], [62.6, -48.4]]) crate(lx, lz, 1.2, 1.2, 0.9, '#4d5a3a');
  red(44.3, -40, 3.4, 'armory'); red(67.7, -40, 3.4, 'armory');
  sign('נשקייה · כניסה בכרטיס', 56, 2.95, -35.75, 0, 3.0, 0.45, '#2a0d0d', '#ff8a7a'); sign('קוד', 57.6, 1.75, -53.95, 0, 0.5, 0.18);
  const armorySpots = [];
  for (const lz of [-57.6, -55.6]) for (const lx of [49, 52.5, 56, 59.5, 63]) armorySpots.push(P(lx, lz, 0, Math.PI));

  // =====================================================================================================
  // the tunnels: T1 from the corridor's east end south (to the hangar) and west (to the stores); T2 from
  // the stores' south side round to the hangar's west wall
  // =====================================================================================================
  const TH = 3.6, tun = conc(TH);
  wall(75, -25, 75, -10, [], tun); wall(79, -25, 79, 8, [], tun); wall(26, -10, 75, -10, [], tun); wall(26, -6, 75, -6, [], tun); wall(75, -6, 75, 8, [], tun);
  ceiling(75, -25, 79, 8, TH); ceiling(26, -10, 75, -6, TH);
  const t1Corridor = fdoor('t1Corridor', 77, -25, 0, 3.6, { h: 3.0 });
  wall(-42, 32, -42, 50, [], tun); wall(-38, 32, -38, 46, [], tun); wall(-38, 46, HANG.x0, 46, [], tun); wall(-42, 50, HANG.x0, 50, [], tun);
  ceiling(-42, 32, -38, 50, TH); ceiling(-38, 46, HANG.x0, 50, TH);
  // the passage from store B to the hangar's west door
  wall(26, 18, HANG.x0, 18, [], tun); wall(26, 22, HANG.x0, 22, [], tun); ceiling(26, 18, HANG.x0, 22, TH);
  for (const lz of [-19, -8, 3]) tube(77, lz, TH, { range: 11, intensity: 16 });
  for (const lx of [38, 52, 66]) tube(lx, -8, TH, { range: 11, intensity: 16, yaw: Math.PI / 2 });
  tube(-40, 40, TH, { range: 11, intensity: 16 });
  for (const lx of [-30, -14, 2, 18]) tube(lx, 48, TH, { range: 11, intensity: 16, yaw: Math.PI / 2 });
  for (const [lx, lz] of [[78.7, -16], [48, -9.7], [-41.7, 40], [-10, 46.3], [20, 49.7]]) red(lx, lz, 2.7, 'tunnels');
  for (const [lx, lz] of [[30, -9.3], [30, -6.7], [-20, 49.3], [10, 46.7]]) batch.add('paint', M.paint, new THREE.CylinderGeometry(0.1, 0.1, 30, 8).rotateZ(Math.PI / 2), at(lx + 15, 3.2, lz), { color: tint('#3f5a6b') });

  // =====================================================================================================
  // the storage halls (store A x -58..-16, store B x -16..26, z -14..32): racks, crates, forklifts
  // =====================================================================================================
  wall(-58, -14, 26, -14, [{ at: 18, w: 1.4, h: 2.3 }, { at: 76, w: 1.4, h: 2.3 }], conc());
  wall(-58, 32, 26, 32, [{ at: 18, w: 3.4, h: 3.0 }], conc());
  wall(-58, -14, -58, 32, [], conc());
  wall(26, -14, 26, 32, [{ at: 6, w: 3.6, h: 3.0 }, { at: 34, w: 3.6, h: 3.0 }], conc());
  wall(-16, -14, -16, 32, [{ at: 23, w: 6, h: 4.0 }], conc());
  const t1Stores = fdoor('t1Stores', 26, -8, Math.PI / 2, 3.4, { h: 3.0 });
  const t2Stores = fdoor('t2Stores', -40, 32, 0, 3.2, { h: 3.0 });
  const rackRow = (lx, lz) => { // a steel rack 1.4 × 10 m, three shelves of boxes
    piece('metal', M.metal, 1.4, 0.08, 10, lx, 1.1, lz, STEEL_D); piece('metal', M.metal, 1.4, 0.08, 10, lx, 2.2, lz, STEEL_D); piece('metal', M.metal, 1.4, 0.08, 10, lx, 3.3, lz, STEEL_D);
    for (const sz of [-4.9, 0, 4.9]) for (const sx of [-0.65, 0.65]) piece('paint', M.paint, 0.1, 3.4, 0.1, lx + sx, 1.7, lz + sz, '#c9a13a');
    for (let k = 0; k < 6; k++) for (const sh of [0, 1.1, 2.2]) if ((k + sh * 3) % 4 !== 1) piece('wood', M.plaster, 1.2, 0.8, 1.4, lx, sh + 0.45, lz - 4.2 + k * 1.68, ['#8d7650', '#6f6a5c', '#7b5b3b'][k % 3], 0, batch, 0.5);
    solid(lx, lz, 0.75, 5.05, 3.4); S.cover.push({ ...toWorld(lx, lz), w: 1.4, d: 10, y });
  };
  for (const lx of [-53, -46, -33, -26, -10, -3, 8, 15]) for (const lz of [-4, 18]) rackRow(lx, lz);
  const forklift = (lx, lz, yaw) => {
    const at2 = (ox, oz) => rot(lx, lz, yaw, ox, oz);
    piece('paint', M.paint, 1.2, 1.0, 2.2, ...((p) => [p[0], 0.75, p[1]])(at2(0, -0.2)), '#d9a61e', yaw);
    piece('paint', M.paint, 1.1, 0.08, 1.1, ...((p) => [p[0], 2.2, p[1]])(at2(0, -0.5)), '#2f343b', yaw);
    for (const sx of [-0.5, 0.5]) piece('paint', M.paint, 0.08, 2.0, 0.08, ...((p) => [p[0], 1.25, p[1]])(at2(sx, -0.7)), '#2f343b', yaw);
    for (const sx of [-0.45, 0.45]) piece('paint', M.paint, 0.1, 2.6, 0.12, ...((p) => [p[0], 1.3, p[1]])(at2(sx, 1.0)), '#2f343b', yaw);
    for (const sx of [-0.3, 0.3]) piece('paint', M.paint, 0.12, 0.06, 1.2, ...((p) => [p[0], 0.1, p[1]])(at2(sx, 1.7)), '#2f343b', yaw);
    for (const [sx, sz] of [[-0.62, 0.6], [0.62, 0.6], [-0.62, -0.9], [0.62, -0.9]]) batch.add('paint', M.paint, new THREE.CylinderGeometry(0.28, 0.28, 0.2, 10).rotateZ(Math.PI / 2), at(...((p) => [p[0], 0.28, p[1]])(at2(sx, sz)), yaw), { color: tint('#1c1d20') });
    const [bx, bz] = at2(0, 0.2); solid(bx, bz, 0.7, 1.7, 2.6, yaw); cover(bx, bz, 1.4, 3.4);
    return { ...P(lx, lz, 0, yaw) };
  };
  const forklifts = [forklift(-21, 6, Math.PI / 2), forklift(2, 28, 0), forklift(-50, 9, -Math.PI / 2 + 0.3)];
  for (const [lx, lz] of [[-56, -12], [-54.6, -12], [-56, 30], [22, 30], [23.4, 30], [24.4, -12.2], [-20, 30.4], [-36, 30.4]]) crate(lx, lz, 1.2, 1.2, 1.0);
  for (const [lx, lz] of [[-30, 7.2], [-28.6, 10.6], [10.6, 7], [12, 10.8], [-6, 30.6], [-44, -12.6]]) barrel(lx, lz, '#8f2b24');
  for (const [lx, lz] of [[-49.5, 7], [-37, 20], [-24, 3], [-6.5, 9], [5, 22], [16, 3]]) tube(lx, lz, LID, { range: 16, intensity: 28 });
  for (const [lx, lz, zone] of [[-57.7, 0, 'stores'], [-57.7, 20, 'stores'], [-16.3, -4, 'stores'], [-15.7, 22, 'stores'], [25.7, 0, 'stores'], [25.7, 26, 'stores'], [-30, -13.7, 'stores'], [0, 31.7, 'stores']]) red(lx, lz, 3.6, zone);
  sign('מחסן א', -37, 4.2, -13.75, 0, 2.2, 0.5); sign('מחסן ב', 5, 4.2, -13.75, 0, 2.2, 0.5); sign('האנגר', 25.75, 3.6, 20, -Math.PI / 2, 1.8, 0.45);

  // =====================================================================================================
  // the hangar (x 30..86, z 8..56, 14 m high): its walls and roof stand above the lid (the shell)
  // =====================================================================================================
  const hw = { h: HANG.h, t: 0.6, color: '#66696c', key: 'plaster', mat: M.plaster, scale: 0.2 };
  wallB(shell, HANG.x0, HANG.z0, HANG.x0, HANG.z1, [{ at: 12, w: 3.0, h: 3.0 }, { at: 40, w: 3.0, h: 3.0 }], hw);
  wallB(shell, HANG.x0, HANG.z0, HANG.x1, HANG.z0, [{ at: 33, w: 1.4, h: 2.3 }, { at: 47, w: 3.0, h: 3.0 }], hw);
  wallB(shell, HANG.x1, HANG.z0, HANG.x1, HANG.z1, [{ at: 22, w: 7.0, h: 5.0 }], hw);
  wallB(shell, HANG.x0, HANG.z1, HANG.x1, HANG.z1, [{ at: 17, w: 1.6, h: 2.4 }], hw);
  piece('plaster', M.plaster, HANG.x1 - HANG.x0 + 1.2, 0.5, HANG.z1 - HANG.z0 + 1.2, (HANG.x0 + HANG.x1) / 2, HANG.h + 0.25, (HANG.z0 + HANG.z1) / 2, '#4b4e52', 0, shell, 0.1);
  piece('plaster', M.plaster, HANG.x1 - HANG.x0 + 1.6, 0.6, 1.0, (HANG.x0 + HANG.x1) / 2, HANG.h + 0.4, HANG.z0, '#5a5d60', 0, shell); piece('plaster', M.plaster, HANG.x1 - HANG.x0 + 1.6, 0.6, 1.0, (HANG.x0 + HANG.x1) / 2, HANG.h + 0.4, HANG.z1, '#5a5d60', 0, shell);
  for (const [lx, lz] of [[44, 20], [68, 40]]) piece('metal', M.metal, 1.6, 1.2, 1.6, lx, HANG.h + 1.0, lz, STEEL_D, 0, shell);   // vents on the roof
  cols.addFloor(cx + HANG.x0, cz + HANG.z0, cx + HANG.x1, cz + HANG.z1, y + HANG.h);
  for (let lx = 36; lx <= 80; lx += 11) piece('metal', M.metal, 0.4, 0.8, HANG.z1 - HANG.z0, lx, HANG.h - 0.6, (HANG.z0 + HANG.z1) / 2, STEEL_D); // trusses
  const hangarW = fdoor('hangarW', HANG.x0, 20, Math.PI / 2, 3.0, { h: 3.0 });
  const t2Hangar = fdoor('t2Hangar', HANG.x0, 48, Math.PI / 2, 3.0, { h: 3.0 });
  const t1Hangar = fdoor('t1Hangar', 77, HANG.z0, 0, 3.0, { h: 3.0 });
  // vehicles that can blow (one mesh each; a blown one goes black and settles)
  const vehMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
  const burntMat = new THREE.MeshStandardMaterial({ color: '#2b2724', roughness: 0.95, metalness: 0.1 });
  const vpart = (geo, color, x, yy, z) => { let g = geo.index ? geo.toNonIndexed() : geo; g.deleteAttribute('uv'); g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, yy, z)); const n = g.getAttribute('position').count, c = new Float32Array(n * 3), col = tint(color); for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const wheel = (x, z, r = 0.45) => vpart(new THREE.CylinderGeometry(r, r, 0.35, 12).rotateZ(Math.PI / 2), '#1b1c1f', x, r, z);
  const KINDS = {
    truck: { w: 2.5, l: 8.2, h: 3.3, parts: () => [vpart(box(2.4, 2.0, 2.2), '#3c4a3a', 0, 1.6, 2.9), vpart(box(2.5, 2.7, 5.6), '#4b5a45', 0, 2.0, -1.2), vpart(box(2.2, 0.7, 0.1), '#1f2933', 0, 2.1, 4.01), ...[[-1.1, 2.9], [1.1, 2.9], [-1.1, -1.4], [1.1, -1.4], [-1.1, -3.0], [1.1, -3.0]].map(([x, z]) => wheel(x, z, 0.5))] },
    jeep: { w: 2.0, l: 4.4, h: 2.0, parts: () => [vpart(box(1.9, 0.9, 4.3), '#2f3a2b', 0, 0.95, 0), vpart(box(1.8, 0.7, 2.2), '#26301f', 0, 1.75, -0.5), vpart(box(1.6, 0.5, 0.08), '#1f2933', 0, 1.8, 0.62), ...[[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]].map(([x, z]) => wheel(x, z, 0.42))] },
    tanker: { w: 2.5, l: 8.4, h: 3.2, parts: () => [vpart(box(2.4, 2.0, 2.2), '#5a2b24', 0, 1.6, 3.0), vpart(new THREE.CylinderGeometry(1.2, 1.2, 5.8, 16).rotateX(Math.PI / 2), '#b9b4a8', 0, 2.0, -1.1), vpart(box(2.3, 0.4, 6.0), '#2f343b', 0, 0.75, -1.1), ...[[-1.1, 3.0], [1.1, 3.0], [-1.1, -1.6], [1.1, -1.6], [-1.1, -3.2], [1.1, -3.2]].map(([x, z]) => wheel(x, z, 0.5))] },
  };
  const vehicle = (kind, lx, lz, yaw) => {
    const K = KINDS[kind], mesh = new THREE.Mesh(mergeGeometries(K.parts(), false), vehMat);
    mesh.position.set(cx + lx, y, cz + lz); mesh.rotation.y = yaw; interior.add(mesh); nearCull(mesh, lx, lz, 75);
    solid(lx, lz, K.w / 2, K.l / 2, K.h, yaw); S.cover.push({ ...toWorld(lx, lz), w: K.w, d: K.l, y });
    const v = { kind, ...P(lx, lz, 0, yaw), w: K.w, l: K.l, h: K.h, mesh, blown: false, centre: P(lx, lz, K.h * 0.55) };
    v.blow = () => { v.blown = true; mesh.material = burntMat; mesh.rotation.z = 0.05; mesh.position.y = y - 0.15; };   // after a mission's warned blast
    v.reset = () => { v.blown = false; mesh.material = vehMat; mesh.rotation.z = 0; mesh.position.y = y; };
    return v;
  };
  const vehicles = [vehicle('truck', 46, 27, Math.PI / 2), vehicle('jeep', 64, 19, 0.3), vehicle('tanker', 54, 43, Math.PI / 2), vehicle('jeep', 73, 44, -0.45)];
  for (const [lx, lz, ry] of [[38, 15.6, Math.PI / 2], [58, 31, 0], [70, 30, 0], [40, 38, 0], [66, 47.6, Math.PI / 2], [78, 20, Math.PI / 2]]) barrier(lx, lz, ry);
  for (const [lx, lz] of [[36, 34], [37.3, 34], [36.6, 35.3], [60, 50], [80, 47], [80, 48.3], [52, 10.9], [53.3, 10.9]]) crate(lx, lz, 1.2, 1.2, 1.1, '#6f6a5c');
  for (const [lx, lz] of [[34, 52.6], [34.6, 53.4], [82.6, 11.2], [44, 11.0]]) barrel(lx, lz, '#8f2b24');
  for (const [lx, lz] of [[40, 18], [58, 18], [76, 18], [40, 44], [58, 44], [76, 44]]) { tube(lx, lz, 11, { range: 34, intensity: 150, len: 2.4 }); piece('metal', M.metal, 0.05, HANG.h - 11, 0.05, lx, (HANG.h + 11) / 2, lz, STEEL_D); }
  for (const [lx, lz] of [[30.4, 30], [30.4, 40], [85.6, 18], [85.6, 44], [40, 8.4], [70, 8.4], [36, 55.6], [64, 55.6]]) red(lx, lz, 5.2, 'hangar');
  // the damaged door in the north wall: a store room behind it that someone gets trapped in
  wall(58, 0, 68, 0, [], conc(3.4)); wall(58, 0, 58, HANG.z0, [], conc(3.4)); wall(68, 0, 68, HANG.z0, [], conc(3.4));
  ceiling(58, 0, 68, HANG.z0, 3.4);
  const trapDoor = fdoor('trap', 63, HANG.z0, 0, 1.4, { kind: 'damaged', locked: true });
  for (const [lx, lz, w, h, ry] of [[60, 2, 1.4, 0.6, 0.4], [66, 5.6, 1.0, 0.9, -0.3], [59.6, 6.4, 0.9, 0.5, 0.2]]) { piece('wood', M.plaster, w, h, w, lx, h / 2, lz, '#6f6a5c', ry); solid(lx, lz, w / 2, w / 2, h, ry); }
  tube(63, 3.5, 3.4, { range: 7, intensity: 8 });
  // the safe room behind a heavy security door in the south wall: a cot, shelves, room for the gang
  wall(40, HANG.z1, 40, 68, [], conc(3.4)); wall(54, HANG.z1, 54, 68, [], conc(3.4)); wall(40, 68, 54, 68, [], conc(3.4));
  ceiling(40, HANG.z1, 54, 68, 3.4);
  const safeDoor = fdoor('saferoom', 47, HANG.z1, 0, 1.6, { h: 2.4, kind: 'heavy' });
  piece('metal', M.metal, 0.06, 0.4, 0.4, 48.3, 1.2, 56.42, '#c9a13a');                            // the wheel's housing on the inside
  piece('paint', M.paint, 0.95, 0.12, 2.1, 52.3, 0.42, 63.6, '#5d6b5a'); piece('paint', M.paint, 0.9, 0.18, 0.5, 52.3, 0.55, 64.4, '#e3e0d6'); // the cot and its pillow
  for (const [sx, sz] of [[-0.42, -0.95], [0.42, -0.95], [-0.42, 0.95], [0.42, 0.95]]) piece('metal', M.metal, 0.05, 0.36, 0.05, 52.3 + sx, 0.18, 63.6 + sz, STEEL_D);
  solid(52.3, 63.6, 0.48, 1.05, 0.5);
  block(40.6, 63, 0.6, 5, 1.8, '#4b525a', 'metal', M.metal); block(47, 67.2, 4, 0.6, 1.0, '#5a4a38');
  tube(47, 62, 3.4, { range: 9, intensity: 16 }); red(53.7, 58, 2.6, 'saferoom');
  sign('חדר בטוח', 47, 2.9, 55.65, Math.PI, 2.0, 0.45, '#0d2a17', '#8affb0');
  // the first-aid kit on the hangar's west wall (a green box, a white cross)
  const kitCanvas = document.createElement('canvas'); kitCanvas.width = 64; kitCanvas.height = 64;
  { const g = kitCanvas.getContext('2d'); g.fillStyle = '#1f8a4c'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ffffff'; g.fillRect(26, 12, 12, 40); g.fillRect(12, 26, 40, 12); }
  const kitTex = new THREE.CanvasTexture(kitCanvas); kitTex.colorSpace = THREE.SRGBColorSpace;
  const kitMat = std({ map: kitTex, roughness: 0.6, emissive: '#ffffff', emissiveMap: kitTex, emissiveIntensity: 0 }); kitMat.userData.night = 0.3;
  const kitMesh = new THREE.Mesh(box(0.2, 0.42, 0.55), [kitMat, std({ color: '#1f8a4c' }), std({ color: '#1f8a4c' }), std({ color: '#1f8a4c' }), std({ color: '#1f8a4c' }), std({ color: '#1f8a4c' })]);
  kitMesh.position.set(cx + HANG.x0 + 0.42, y + 1.4, cz + 38); interior.add(kitMesh);
  piece('metal', M.metal, 0.06, 0.8, 0.9, HANG.x0 + 0.33, 1.4, 38, '#c9ced3');
  const medkit = { ...P(HANG.x0 + 0.42, 38, 1.4), at: P(HANG.x0 + 1.4, 38, 0, -Math.PI / 2), mesh: kitMesh, taken: false };
  medkit.take = () => { medkit.taken = true; kitMesh.visible = false; kitMesh.userData.hide = true; };
  medkit.reset = () => { medkit.taken = false; kitMesh.userData.hide = false; };
  sign('עזרה ראשונה', HANG.x0 + 0.36, 2.15, 38, Math.PI / 2, 1.6, 0.35, '#0d2a17', '#8affb0');

  // =====================================================================================================
  // the way out: the big door in the hangar's east wall, the ramp up a cutting to the surface
  // =====================================================================================================
  const exitDoor = fdoor('exit', HANG.x1, RAMP.z, Math.PI / 2, 7.0, { h: 5.0, slide: 'up', parent: shellGroup, B: shell });
  piece('paint', M.paint, 0.2, 0.7, 0.5, HANG.x1 - 0.42, 1.3, RAMP.z - 4.6, '#c9a13a');
  const exitLamp = indicator(cx + HANG.x1 - 0.55, y + 1.8, cz + RAMP.z - 4.6, 1.6);
  sign('יציאה לפני השטח', HANG.x1 - 0.35, 5.9, RAMP.z, -Math.PI / 2, 3.6, 0.6, '#0d2a17', '#8affb0');
  const rise = hExit - y, steps = 28, run = RAMP.x1 - RAMP.x0, d = run / steps;
  for (let k = 1; k <= steps; k++) {
    const sk = (k - 0.5) * d, hk = rise * k / steps;
    ctx.net.addPad({ x: cx + RAMP.x0 + sk, z: cz + RAMP.z, hx: d / 2 + 0.03, hz: RAMP.w / 2, yaw: 0, h: y + hk - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'facility ramp' });
    piece('plaster', M.plaster, d, hk + 0.6, RAMP.w, RAMP.x0 + sk, (hk - 0.6) / 2, RAMP.z, '#7a7c7e', 0, shell, 0.3);
  }
  const wallTop = hExit + 1.0 - y;
  for (const sz of [-RAMP.w / 2 - 0.2, RAMP.w / 2 + 0.2]) wallB(shell, HANG.x1, RAMP.z + sz, 99.5, RAMP.z + sz, [], { h: wallTop, t: 0.4, color: '#7a7c7e', key: 'plaster', mat: M.plaster });
  for (const side of [-1, 1]) { // thick retaining blocks outside the lid, their tops a metre over the land
    const lz = RAMP.z + side * (RAMP.w / 2 + 2.1), lx = (99.5 + RAMP.x1) / 2;
    piece('plaster', M.plaster, RAMP.x1 - 99.5, wallTop + 1, 4.2, lx, (wallTop - 1) / 2, lz, '#7a7c7e', 0, shell, 0.25);
    cols.addBox(cx + lx, cz + lz, (RAMP.x1 - 99.5) / 2, 2.1, 0, y - 1, y + wallTop);
  }
  for (const lx of [92, 104, 116]) wallLamp(lx, RAMP.z - RAMP.w / 2, Math.min(rise * (lx - RAMP.x0) / run + 2.6, wallTop - 0.3), 0, 1, { range: 14, intensity: 22 });
  red(HANG.x1 - 0.4, RAMP.z + 4.4, 5.6, 'exit');

  // ---------- the signs, the shell, the batch ----------
  if (signs.length) {
    const atlas = signAtlas('facility-signs', signs.map((s) => ({ text: s.text, bg: s.bg, fg: s.fg, border: true })), { cellW: 512, cellH: 112, cols: 4, size: 54 });
    const signMat = new THREE.MeshStandardMaterial({ map: atlas.texture, roughness: 0.7, emissive: '#ffffff', emissiveMap: atlas.texture, emissiveIntensity: 0 }); signMat.userData.night = 0.35;
    S.emissives.push(signMat);
    signs.forEach((s, i) => {
      const g = new THREE.PlaneGeometry(s.w, s.h), [u0, v0, u1, v1] = atlas.uv[i], uv = g.getAttribute('uv');
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) > 0.5 ? u1 : u0, uv.getY(k) > 0.5 ? v1 : v0);
      s.B.add('fsign', signMat, g, at(s.lx, s.ly, s.lz, s.ry));
    });
  }
  indMesh.instanceMatrix.needsUpdate = true; shellGroup.add(indMesh);
  for (const h of hazards) nearCull(h.kind === 'press' ? h.head : h.plume, h.x - cx, h.z - cz);
  for (const [obj, lx, lz] of [[rackBody, 56, -61.5], [rackHop, 56, -61.5], [rackPistol, 56, -61.5], [rackMask, 56, -61.5], [kitMesh, HANG.x0, 38], [clipMesh, 44, -46], [keypadMesh, 57.6, -54], [readerMesh, 53.7, -34.4]]) nearCull(obj, lx, lz);
  S.finish();
  shell.build(shellGroup, { cast: false, receive: true });
  shellGroup.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  for (const d of doorList) { d.unlock(); d.setOpen(true); d.snap(); }   // open for a free walk; a mission stages its own

  // ---------- the place ----------
  const doors = Object.fromEntries(doorList.map((q) => [q.name, q]));
  const zones = [
    ['tunnels', 75, -25, 79, 8], ['arrival', -90, -71.5, -60, -44], ['cells', -90, -44, -65, -6], ['corridor', -65, -36, 80, -21], ['guardRooms', -43, -21, -37, -14], ['guardRooms', 15, -21, 21, -14],
    ['machines', -56, -70, -12, -36], ['arena', -6, -70, 36, -36], ['armory', 44, -62, 68, -36], ['tunnels', 75, -25, 79, 8], ['tunnels', 26, -10, 79, -6], ['tunnels', -42, 32, -38, 50], ['tunnels', -42, 46, 30, 50], ['tunnels', 26, 18, 30, 22],
    ['stores', -58, -14, 26, 32], ['trap', 58, 0, 68, 8], ['saferoom', 40, 56, 54, 68], ['hangar', 30, 8, 86, 56], ['exit', 86, 25.5, 125, 34.5],
  ];
  const zoneAt = (x, z) => { const lx = x - cx, lz = z - cz; for (const [n, x0, z0, x1, z1] of zones) if (lx >= x0 && lx <= x1 && lz >= z0 && lz <= z1) return n; return null; };
  let alarmOn = false, alarmT = 0, time = 0;
  const machines = {
    doorA: machA, doorB: machB, outA: P(-50, -33.6, 0, Math.PI), inA: P(-50, -38.6, 0, Math.PI), outB: P(-18, -33.6, 0, Math.PI), inB: P(-18, -38.6, 0, 0),
    west: P(-48, -41), east: P(-20, -41), walkway: [P(-48, -59.5), P(-41.5, -59.5), P(-36.25, -59.5), P(-31.75, -59.5), P(-26, -59.5), P(-20, -59.5)],
    safe: [P(-36.25, -59.5), P(-31.75, -59.5)],      // the pockets between the presses
    hazards, presses: hazards.filter((h) => h.kind === 'press'), vents: hazards.filter((h) => h.kind === 'steam'),
    setAll: (on) => hazards.forEach((h) => h.set(on)),
    hits: (x, z, yy = null) => hazards.find((h) => h.hits(x, z, yy)) || null,
    reset: () => { hazards.forEach((h) => h.reset()); stairBars.forEach((b) => b.set(false, true)); },
    // who stands down there (a function giving positions), so a press head never comes down onto anyone
    watch: (fn) => { crowd.fn = fn || null; },
    // the barrier arms across the foot of both stairs (true) or up (false): the catwalk shut off or open
    stairBars: (down, snap = false) => stairBars.forEach((b) => b.set(down, snap)),
    get barsDown() { return stairBars.every((b) => b.down); },
    panel: { ...P(-41.1, -42, 1.3), at: P(-42.4, -42, 0, Math.PI / 2), lamp: panelLamp, light: (on) => panelLamp.set(on ? 'green' : 'red') },
    catwalk: { y: y + CW, west: P(-54.5, -58, CW), north: P(-34, -68.5, CW), east: P(-13.5, -58, CW), points: [P(-54.5, -52, CW), P(-54.5, -68.5, CW), P(-34, -68.5, CW), P(-13.5, -68.5, CW), P(-13.5, -52, CW)] },
    stairs: { west: machStairsW, east: machStairsE },
  };
  const arena = {
    door: arenaDoor, doorAt: P(8, -33.6, 0, Math.PI), entry: P(8, -38.6, 0, Math.PI),
    gate: cageGate, gateOut: P(14, -41.8, 0, Math.PI), gateIn: P(14, -46, 0, Math.PI),
    centre: P(14, -52), hammer: P(14, -56.5, 0, 0), player: P(14, -47.5, 0, Math.PI), allies: [P(10.2, -47, 0, Math.PI), P(17.8, -47, 0, Math.PI)],
    rail: rails, stands: { y: y + SH, west: P(-2, -54, SH), east: P(30, -54, SH), north: P(14, -67, SH) }, stairs: { west: arenaStairsW, east: arenaStairsE },
    cage: { x0: cx + 6, z0: cz - 60, x1: cx + 22, z1: cz - 44 },
    inCage: (x, z) => x > cx + 6.1 && x < cx + 21.9 && z > cz - 59.9 && z < cz - 44.1,
    from: [P(4, -62), P(24, -62), P(8, -38.6)],
  };
  const armory = {
    door: armoryDoor, doorAt: P(56, -33.4, 0, Math.PI), inside: P(56, -44, 0, Math.PI), code: ARMORY_CODE,
    reader: { ...P(53.7, -34.4, 1.3), at: P(54.7, -34.4, 0, -Math.PI / 2), mesh: readerMesh, light: (ok) => readerLamp.set(ok ? 'green' : 'red') },
    keypad: { ...P(57.6, -53.93, 1.35), at: P(57.6, -52.6, 0, Math.PI), mesh: keypadMesh, light: (ok) => keypadLamp.set(ok ? 'green' : 'red') },
    clipboard: { ...P(44.23, -46, 1.55), at: P(46.4, -48.2, 0, -Math.PI / 2), mesh: clipMesh, setText: (lines) => writeClip(lines), reset: () => writeClip(clipDefault) },
    desk: P(45, -46, 0.8), gate: rackGate, gateAt: P(56, -52.6, 0, Math.PI), behind: P(56, -56.4, 0, Math.PI),
    rack, spots: armorySpots,
  };
  const t1 = [P(77, -23), P(77, -8), P(30, -8)], t2 = [P(-40, 34), P(-40, 48), P(28, 48)];
  const tunnels = {
    t1, t1Branch: [P(77, -8), P(77, 6)], t2, points: [...t1, P(77, 6), ...t2],
    doors: { corridor: t1Corridor, stores: t1Stores, hangar: t1Hangar, storesSouth: t2Stores, hangarWest: t2Hangar },
    mouths: { corridor: P(77, -23.2, 0, 0), stores: P(28.2, -8, 0, -Math.PI / 2), hangar: P(77, 6.2, 0, 0), storesSouth: P(-40, 34.2, 0, 0), hangarWest: P(28.2, 48, 0, Math.PI / 2) },
    redLamps: redLamps.filter((r) => r.zone === 'tunnels'),
  };
  const stores = {
    a: P(-37, 9), b: P(5, 9), inside: P(-16, 9), halls: [{ name: 'א', inside: P(-37, 9) }, { name: 'ב', inside: P(5, 9) }],
    forklifts, lanes: [P(-40, -8), P(-40, 27), P(22, -8), P(22, 27), P(-16, 9)],
    redLamps: redLamps.filter((r) => r.zone === 'stores'),
    cover: S.cover.filter((c) => { const l = { x: c.x - cx, z: c.z - cz }; return l.x > -58 && l.x < 26 && l.z > -14 && l.z < 32; }),
  };
  const hangarCover = S.cover.filter((c) => { const l = { x: c.x - cx, z: c.z - cz }; return l.x > HANG.x0 && l.x < HANG.x1 && l.z > HANG.z0 && l.z < HANG.z1; });
  const trap = { door: trapDoor, at: P(63, 10.4, 0, Math.PI), behind: P(63, 4.2, 0, 0), room: P(63, 3.4) };
  trap.open = () => { trapDoor.unlock(); trapDoor.setOpen(true); };
  trap.close = () => { trapDoor.lock(); };
  const hangar = {
    centre: P(58, 36), inside: P(58, 36), doors: { west: hangarW, sw: t2Hangar, north: t1Hangar, trap: trapDoor, saferoom: safeDoor, exit: exitDoor },
    doorAt: { west: P(32, 20, 0, Math.PI / 2), sw: P(32, 48, 0, Math.PI / 2), north: P(77, 10.5, 0, 0) },
    vehicles, cover: hangarCover, trap, from: [P(77, 10.5), P(32, 20), P(32, 48)],
    redLamps: redLamps.filter((r) => r.zone === 'hangar'),
    blast: P(63, 13.5),                                   // where the blast by the damaged door goes off (a mission warns first)
  };
  const saferoom = {
    door: safeDoor, doorAt: P(47, 53.6, 0, 0), doorIn: P(47, 58, 0, Math.PI), inside: P(46, 62), wheel: P(48.3, 57.4, 0, Math.PI),
    bed: { ...P(52.3, 63.6, 0.5, 0), side: P(51, 63.6, 0, Math.PI / 2) },
    spots: [P(45.4, 58.4, 0, Math.PI), P(48.6, 58.4, 0, Math.PI), P(42.4, 60.4, 0, Math.PI / 2), P(44.4, 64.6, 0, 0), P(48.6, 61.2, 0, Math.PI / 2), P(50.6, 66.4, 0, Math.PI)],
  };
  const exit = {
    door: exitDoor, panel: { ...P(HANG.x1 - 0.42, RAMP.z - 4.6, 1.3), at: P(HANG.x1 - 1.6, RAMP.z - 4.6, 0, Math.PI / 2), lamp: exitLamp, light: (ok) => exitLamp.set(ok ? 'green' : 'red') },
    inside: P(HANG.x1 - 4, RAMP.z, 0, Math.PI / 2), rampBottom: P(RAMP.x0 + 1.5, RAMP.z, rise * 2 / steps, Math.PI / 2),
    rampMid: P((RAMP.x0 + RAMP.x1) / 2, RAMP.z, rise / 2, Math.PI / 2), rampTop: P(RAMP.x1 - 0.6, RAMP.z, rise, Math.PI / 2),
    outside: { x: cx + RAMP.x1 + 1, z: cz + RAMP.z, y: hExit, yaw: Math.PI / 2 },
  };
  const arrival = { car: { ...P(-76, -67.3), w: 9.6, d: 8.1 }, gate: carGate, inCar: carSpots, spots: hallSpots, centre: P(-75, -52, 0, 0), door: arrivalDoor, doorAt: P(-68, -45.6, 0, 0), doorOut: P(-68, -42.4, 0, 0) };
  const cells = {
    door: arrivalDoor, hall: P(-68, -28, 0, 0), wake, guardDoor, guardIn: P(-66.8, -28, 0, Math.PI / 2), guardOut: P(-63.2, -28, 0, Math.PI / 2), guardEntrance: P(-63.2, -28, 0, -Math.PI / 2),
    big: { door: bigCell, inside: P(-80, -34, 0, Math.PI / 2), doorIn: P(-72.4, -34, 0, Math.PI / 2), doorAt: P(-69.4, -34, 0, -Math.PI / 2) },
    row: cellDoors.map((door, i) => ({ door, inside: P(-75.5, [-21, -15, -9][i], 0, Math.PI / 2), doorAt: P(-69.4, [-21, -15, -9][i], 0, -Math.PI / 2) })),
    doors: [bigCell, ...cellDoors],
    openAll: () => { for (const q of [bigCell, ...cellDoors]) { q.unlock(); q.setOpen(true); } },
    closeAll: () => { for (const q of [bigCell, ...cellDoors]) q.lock(); },
  };
  const corridor = {
    start: P(-62, -28, 0, Math.PI / 2), end: P(77, -28, 0, Math.PI / 2), points: [-62, -46, -30, -14, 2, 18, 34, 50, 66, 77].map((x) => P(x, -28, 0, Math.PI / 2)),
    bays: [...NB.map((x) => ({ ...P(x, -33.6), side: 'n' })), ...SB.map((x) => ({ ...P(x, -23), side: 's' }))],
    fights: [P(-52, -28), P(-24, -28), P(2, -28), P(32, -28), P(62, -28)],
    shutter, shutterAt: { west: P(-36, -28, 0, Math.PI / 2), east: P(-32, -28, 0, -Math.PI / 2) },
    guardRooms, from: [guardRooms[0].inside, guardRooms[1].inside, P(77, -21), P(-63.2, -28)],
    redLamps: redLamps.filter((r) => r.zone === 'corridor'),
  };
  // where the guards walk (each with its floor's height; a single point = a post)
  const pp = (lx, lz, ly = 0) => P(lx, lz, ly);
  const cA = pp(-54.5, -55, CW), cB = pp(-54.5, -68.5, CW), cC = pp(-13.5, -68.5, CW), cD = pp(-13.5, -55, CW);
  const sA = pp(-2, -43, SH), sB = pp(-2, -67, SH), sC = pp(30, -67, SH), sD = pp(30, -43, SH);
  const patrols = {
    arrival: [pp(-86, -49), pp(-64, -49)], cells: [pp(-68, -41.5), pp(-68, -8.5)],
    corrW: [pp(-61, -28), pp(-37, -28)], corrE: [pp(-30, -28), pp(74, -28)],
    machW: [pp(-48, -39), pp(-46, -54)], machE: [pp(-20, -39), pp(-21, -54)], catwalk: [cA, cB, cC, cD, cC, cB],
    stands: [sA, sB, sC, sD, sC, sB], pit: [pp(4, -62), pp(24, -62)], armory: [pp(50, -40), pp(62, -50)],
    t1: [pp(77, -21), pp(77, -8), pp(31, -8), pp(77, -8)], t2: [pp(-40, 35), pp(-40, 48), pp(26, 48), pp(-40, 48)],
    stores: [pp(-40, 27), pp(-40, 9), pp(22, 9), pp(22, 27), pp(22, 9), pp(-40, 9)],
    hangarN: [pp(36, 13), pp(80, 13)], hangarS: [pp(80, 52), pp(36, 52)], exit: [pp(83, 25), pp(83, 35)],
  };
  places.facility = {
    x: cx, z: cz, y, toWorld, lidY: lidTop, surfaceY: hExit, interior, shell: shellGroup,
    arrival, cells, corridor, machines, arena, armory, tunnels, stores, hangar, saferoom, medkit, exit,
    doors, doorList, patrols, zones, zoneAt, cover: S.cover, redLamps,
    lamps: S.lamps, emissives: [...S.emissives, coldMat, clipMat, kitMat],
    // under the ground: the dug footprint (the minimap's "מתחת לאדמה")
    inside: (x, z) => Math.abs(x - cx) < HX && Math.abs(z - cz) < HZ,
    setDoors: (spec) => { for (const [n, v] of Object.entries(spec)) { const q = doors[n]; if (!q) continue; if (v === 'locked') q.lock(); else { q.unlock(); q.setOpen(!!v); } } },
    openAll: () => { for (const q of doorList) { q.unlock(); q.setOpen(true); } },
    closeAll: () => { for (const q of doorList) { q.unlock(); q.setOpen(false); } },
    snapDoors: () => doorList.forEach((q) => q.snap()),
    // the red emergency lamps flash (the alarm); off, they glow dim
    alarm: (on) => { alarmOn = !!on; alarmT = 0; if (!on) redLampMat.emissiveIntensity = 0.15; },
    get alarmOn() { return alarmOn; },
    reset: () => { for (const q of doorList) { q.unlock(); q.setOpen(true); q.snap(); } rack.reset(); medkit.reset(); for (const v of vehicles) v.reset(); machines.reset(); armory.clipboard.reset(); armory.reader.light(false); armory.keypad.light(false); alarmOn = false; redLampMat.emissiveIntensity = 0.15; },
    tick(camera, dt) {
      time += dt;
      const lx = camera.position.x - cx, lz = camera.position.z - cz;
      const inFoot = Math.abs(lx) < 100 && Math.abs(lz) < 80 && camera.position.y < lidTop + 0.3;
      const onRamp = lx > 84 && lx < 140 && Math.abs(lz - RAMP.z) < 14 && exitDoor.k > 0.02;
      interior.visible = inFoot || onRamp;
      for (const q of doorList) { const want = q.open ? 1 : 0; if (q.k !== want) { q.k = want > q.k ? Math.min(1, q.k + dt / 0.7) : Math.max(0, q.k - dt / 0.7); q.pose(q.k); } }
      for (const h of hazards) h.update(dt);   // the machines run whether or not anyone looks (a mission may test a guard under one)
      for (const b of stairBars) b.update(dt);
      if (interior.visible) { const px = camera.position.x, pz = camera.position.z; for (const n of near) n.obj.visible = (n.x - px) ** 2 + (n.z - pz) ** 2 < n.r2 && n.obj.userData.hide !== true; }
      if (alarmOn) { alarmT += dt; redLampMat.emissiveIntensity = 0.4 + 2.6 * Math.max(0, Math.sin(alarmT * 7)); }
    },
  };
}
