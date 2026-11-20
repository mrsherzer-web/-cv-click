'use strict';
/* =====================================================================
   STARRY NIGHTS · world.js
   renderer · level geometry · props · lights · doors · collision · paths
   ===================================================================== */

let renderer = null, scene = null, camera = null, hemi = null, flash = null, flashTarget = null, riderSpot = null;
const MAT = {}, LIGHTS = {}, COLL = [], INTER = [], ITEMS = [], CCTV_CAMS = [];
const WORLD = {
  built: false, power: 100, genOn: false, fuses: false, doors: {}, doorLight: null,
  valves: [], gate: null, conveyor: null, fixtures: null, fixtureState: [], monitors: [], buttons: {},
  fan: null, disco: null, milk: [], milkIdx: 0, dust: null, fuseSlots: [], genPanel: null, gateLights: [], sun: null
};
const GATE_TILES = [5, 6, 7];
const _gc = {};
function boxGeo(w, h, d) { const k = w + '|' + h + '|' + d; return _gc[k] || (_gc[k] = new THREE.BoxGeometry(w, h, d)); }
function phong(o) { return new THREE.MeshPhongMaterial(Object.assign({ shininess: 10, specular: 0x111111 }, o)); }
function basic(o) { return new THREE.MeshBasicMaterial(o); }

function initRenderer() {
  const canvas = $('#gl');
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: SETTINGS.quality === 'high', powerPreference: 'high-performance' }); }
  catch (e) { renderer = null; return false; }
  if (!renderer.getContext()) { renderer = null; return false; }
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  ANISO = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x020306); scene.fog = new THREE.FogExp2(0x020306, 0.058);
  camera = new THREE.PerspectiveCamera(72, 1, 0.05, 90); camera.rotation.order = 'YXZ'; scene.add(camera);
  hemi = new THREE.HemisphereLight(0x3a4a70, 0x140c08, 0.22); scene.add(hemi);
  flash = new THREE.SpotLight(0xffe6bf, 1.35, 24, 0.45, 0.5, 1.6); flash.position.set(0.18, -0.12, 0.05); camera.add(flash);
  flashTarget = new THREE.Object3D(); flashTarget.position.set(0, 0, -6); camera.add(flashTarget); flash.target = flashTarget;
  window.addEventListener('resize', resize); resize();
  return true;
}
let dynScale = 1;
function pixelRatio() { const q = SETTINGS.quality, d = window.devicePixelRatio || 1; return q === 'high' ? Math.min(d, 1.75) : q === 'med' ? Math.min(d, 1.25) : Math.min(d, 0.85); }
function resize() {
  if (!renderer) return; const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(pixelRatio() * dynScale); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  for (const c of CCTV_CAMS) { c.aspect = w / h; c.updateProjectionMatrix(); }
}

/* ---------------- geometry builder ---------------- */
class GB {
  constructor() { this.p = []; this.n = []; this.u = []; this.i = []; }
  quad(pts, uvs, nrm) {
    const a = pts[0], b = pts[1], c = pts[2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const ord = (cx * nrm[0] + cy * nrm[1] + cz * nrm[2]) >= 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
    const base = this.p.length / 3;
    for (const k of ord) { this.p.push(pts[k][0], pts[k][1], pts[k][2]); this.n.push(nrm[0], nrm[1], nrm[2]); this.u.push(uvs[k][0], uvs[k][1]); }
    this.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setIndex(this.i); g.computeBoundingSphere(); return g;
  }
}
const UV4 = [[0, 0], [1, 0], [1, 1], [0, 1]];
const isFloor = (x, y) => inb(x, y) && GRID[idx(x, y)] === 1;
function doorwayAxis(x, y) {
  const r = (a, b) => ROOM_AT[idx(a, b)];
  if (isFloor(x, y - 1) && isFloor(x, y + 1) && !isFloor(x - 1, y) && !isFloor(x + 1, y) && r(x, y - 1) !== r(x, y + 1)) return 'ns';
  if (isFloor(x - 1, y) && isFloor(x + 1, y) && !isFloor(x, y - 1) && !isFloor(x, y + 1) && r(x - 1, y) !== r(x + 1, y)) return 'ew';
  return null;
}

/* ---------------- materials ---------------- */
function buildMaterials() {
  const fl = { concrete: fConcrete(), tiles: fTiles(4, '#cfc8b6', '#bab29f'), lino: fLino(), metal: fMetal(), carpet: fCarpet(), wood: fWood() };
  for (const k in fl) MAT['f_' + k] = phong({ map: mkTex(fl[k]), shininess: k === 'tiles' ? 45 : k === 'metal' ? 40 : 8, specular: (k === 'tiles' || k === 'metal') ? 0x333333 : 0x0a0a0a });
  const wl = { concrete: wConcrete(), tile: wTile(), paint: wPaint(), brick: wBrick(), wallpaper: wWallpaper(), steel: wSteel() };
  for (const k in wl) MAT['w_' + k] = phong({ map: mkTex(wl[k]), shininess: (k === 'tile' || k === 'steel') ? 40 : 6, specular: 0x1a1a1a });
  MAT.ceil = phong({ map: mkTex(cCeiling()), color: 0xa8a8a8 });
  MAT.frame = phong({ color: 0x2a2d31, shininess: 30 });
  MAT.metal = phong({ color: 0x7a838d, shininess: 70, specular: 0x555555 });
  MAT.dark = phong({ color: 0x23262b, shininess: 30 });
  MAT.rubber = phong({ color: 0x141416, shininess: 5 });
  MAT.crate = phong({ map: mkTex(tCrate()) });
  MAT.wood = phong({ map: mkTex(fWood()), color: 0xb08a66 });
  MAT.door = phong({ map: mkTex(tDoor(), true), shininess: 30 });
  MAT.gate = phong({ map: mkTex(tGate(), true), shininess: 20 });
  MAT.red = phong({ color: 0x9b1424, shininess: 60, specular: 0x552222 });
  MAT.white = phong({ color: 0xd9d6cc, shininess: 20 });
  MAT.fabric = phong({ color: 0x5a2d33, shininess: 2 });
  MAT.green = phong({ color: 0x2f4a3a, shininess: 40 });
  MAT.label = phong({ map: mkTex(tLabel()) });
  MAT.glass = phong({ color: 0xa3162a, emissive: 0x2a0308, shininess: 90, specular: 0xffffff });
  MAT.gold = phong({ color: 0xd9b45a, shininess: 80, specular: 0x886622 });
  MAT.stripe = phong({ map: mkTex(tStripes()) });
  MAT.fixture = basic({ color: 0xffffff });
  MAT.screenCam = basic({ map: mkTex(tScreen('cam'), true) }); MAT.screenPC = basic({ map: mkTex(tScreen('pc'), true) });
  MAT.exit = basic({ map: signTex('יציאה', 'EXIT', { bg: '#0f7a3c', border: '#e9fff0', fg: '#ffffff' }) });
  MAT.shadow = basic({ map: mkTex(tShadow(), true), transparent: true, depthWrite: false });
  MAT.milk = phong({ map: mkTex(tBlob('245,245,238'), true), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, shininess: 100, specular: 0xffffff });
  MAT.stain = phong({ map: mkTex(tBlob('110,8,20'), true), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, shininess: 80, specular: 0x552222 });
  MAT.glowTex = mkTex(tGlow(), true);
  MAT.paper = phong({ map: mkTex(tPaper(), true), side: THREE.DoubleSide, emissive: 0x111008 });
  MAT.strip = phong({ color: 0x9fc9e8, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, shininess: 90 });
  MAT.mirror = phong({ color: 0x8f9aa3, shininess: 140, specular: 0xffffff });
  MAT.btnOff = basic({ color: 0x3a1010 }); MAT.btnRed = basic({ color: 0xff2a2a }); MAT.btnWhite = basic({ color: 0xfff6dc }); MAT.btnDim = basic({ color: 0x3a3a34 });
  MAT.slotOff = basic({ color: 0x1a1a1a }); MAT.slotOn = basic({ color: 0xffb547 });
  MAT.led = basic({ color: 0xff2020 }); MAT.ledOk = basic({ color: 0x30ff80 });
  MAT.amber = basic({ color: 0x3a2400 });
  MAT.sun = basic({ color: 0xfff1cf });
}

/* ---------------- tiny helpers ---------------- */
function addCol(cx, cz, w, d) { COLL.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 }); }
function mesh(geo, mat, x, y, z, ry) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (ry) m.rotation.y = ry; scene.add(m); return m; }
function box(w, h, d, mat, x, y, z, o = {}) { const m = mesh(boxGeo(w, h, d), mat, x, y + h / 2, z, o.ry); if (o.col) { const sw = Math.abs(Math.sin(o.ry || 0)) > 0.7; addCol(x, z, sw ? d : w, sw ? w : d); } return m; }
function cyl(r, h, mat, x, y, z, o = {}) { const m = mesh(new THREE.CylinderGeometry(o.rt != null ? o.rt : r, r, h, o.seg || 14), mat, x, y + h / 2, z); if (o.col) addCol(x, z, r * 2, r * 2); return m; }
function onWall(tx, ty, side) {
  const x0 = tx * T, z0 = ty * T;
  if (side === 'n') return { x: x0 + T / 2, z: z0, nx: 0, nz: 1, ok: !isFloor(tx, ty - 1) };
  if (side === 's') return { x: x0 + T / 2, z: z0 + T, nx: 0, nz: -1, ok: !isFloor(tx, ty + 1) };
  if (side === 'w') return { x: x0, z: z0 + T / 2, nx: 1, nz: 0, ok: !isFloor(tx - 1, ty) };
  return { x: x0 + T, z: z0 + T / 2, nx: -1, nz: 0, ok: !isFloor(tx + 1, ty) };
}
function wallPlane(w, h, mat, x, y, z, nx, nz, off = 0.02) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x + nx * off, y, z + nz * off); m.rotation.y = Math.atan2(nx, nz); scene.add(m); return m; }

/* ---------------- level shell ---------------- */
function buildLevel() {
  const floors = {}, walls = {}, ceil = new GB(), lint = new GB(), LH = 2.5, signs = [];
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    if (!isFloor(x, y)) continue;
    const room = ROOMS[ROOM_AT[idx(x, y)]], x0 = x * T, x1 = x0 + T, z0 = y * T, z1 = z0 + T, H = WALL_H;
    (floors[room.floor] || (floors[room.floor] = new GB())).quad([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], UV4, [0, 1, 0]);
    ceil.quad([[x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1]], UV4, [0, -1, 0]);
    const wb = walls[room.wall] || (walls[room.wall] = new GB());
    if (!isFloor(x, y - 1)) wb.quad([[x0, 0, z0], [x1, 0, z0], [x1, H, z0], [x0, H, z0]], UV4, [0, 0, 1]);
    if (!isFloor(x, y + 1) && !(y === 22 && GATE_TILES.includes(x))) wb.quad([[x1, 0, z1], [x0, 0, z1], [x0, H, z1], [x1, H, z1]], UV4, [0, 0, -1]);
    if (!isFloor(x - 1, y)) wb.quad([[x0, 0, z1], [x0, 0, z0], [x0, H, z0], [x0, H, z1]], UV4, [1, 0, 0]);
    if (!isFloor(x + 1, y)) wb.quad([[x1, 0, z0], [x1, 0, z1], [x1, H, z1], [x1, H, z0]], UV4, [-1, 0, 0]);
    const ax = doorwayAxis(x, y);
    if (ax === 'ns') {
      lint.quad([[x0, LH, z0], [x1, LH, z0], [x1, H, z0], [x0, H, z0]], UV4, [0, 0, -1]);
      lint.quad([[x1, LH, z1], [x0, LH, z1], [x0, H, z1], [x1, H, z1]], UV4, [0, 0, 1]);
      lint.quad([[x0, LH, z0], [x1, LH, z0], [x1, LH, z1], [x0, LH, z1]], UV4, [0, -1, 0]);
      const hallS = ROOM_AT[idx(x, y + 1)] === 'hall', hallN = ROOM_AT[idx(x, y - 1)] === 'hall';
      if (hallS) signs.push([x0 + T / 2, z1, 0, 1, ROOM_AT[idx(x, y)]]); else if (hallN) signs.push([x0 + T / 2, z0, 0, -1, ROOM_AT[idx(x, y)]]);
    } else if (ax === 'ew') {
      lint.quad([[x0, LH, z1], [x0, LH, z0], [x0, H, z0], [x0, H, z1]], UV4, [-1, 0, 0]);
      lint.quad([[x1, LH, z0], [x1, LH, z1], [x1, H, z1], [x1, H, z0]], UV4, [1, 0, 0]);
      lint.quad([[x0, LH, z0], [x1, LH, z0], [x1, LH, z1], [x0, LH, z1]], UV4, [0, -1, 0]);
      const hallE = ROOM_AT[idx(x + 1, y)] === 'hall', hallW = ROOM_AT[idx(x - 1, y)] === 'hall';
      if (hallE) signs.push([x1, z0 + T / 2, 1, 0, ROOM_AT[idx(x, y)]]); else if (hallW) signs.push([x0, z0 + T / 2, -1, 0, ROOM_AT[idx(x, y)]]);
    }
  }
  for (const k in floors) scene.add(new THREE.Mesh(floors[k].build(), MAT['f_' + k]));
  for (const k in walls) scene.add(new THREE.Mesh(walls[k].build(), MAT['w_' + k]));
  scene.add(new THREE.Mesh(ceil.build(), MAT.ceil));
  scene.add(new THREE.Mesh(lint.build(), MAT.frame));
  const cache = {};
  for (const [x, z, nx, nz, room] of signs) {
    if (!cache[room]) cache[room] = phong({ map: room === 'dock' ? signTex('יציאה · רציף', 'EXIT', { bg: '#0f7a3c', border: '#e9fff0', fg: '#fff' }) : signTex(ROOMS[room].name, null), emissive: room === 'dock' ? 0x0d4a22 : 0x0a0a0a });
    wallPlane(1.9, 0.48, cache[room], x, 2.86, z, nx, nz, 0.03);
  }
}

/* ---------------- rooms ---------------- */
function propsBottling() {
  const cz = tc(2), x0 = 9.2, x1 = 26.8, L = x1 - x0, cx = (x0 + x1) / 2;
  for (let i = 0; i <= 6; i++) box(0.14, 0.8, 1.25, MAT.dark, x0 + 0.3 + i * (L - 0.6) / 6, 0, cz);
  box(L, 0.14, 1.45, MAT.metal, cx, 0.8, cz, { col: true });
  box(L - 0.2, 0.05, 1.1, MAT.rubber, cx, 0.94, cz);
  box(L, 0.08, 0.06, MAT.metal, cx, 1.04, cz - 0.66); box(L, 0.08, 0.06, MAT.metal, cx, 1.04, cz + 0.66);
  const N = 34, body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.075, 0.08, 0.26, 10), MAT.glass, N), neck = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.028, 0.045, 0.12, 8), MAT.gold, N);
  scene.add(body); scene.add(neck);
  WORLD.conveyor = { body, neck, N, x0: x0 + 0.3, L: L - 0.6, cz, off: 0, m: new THREE.Matrix4() };
  vat(10, 1, 's'); vat(10, 4, 'n'); vat(2, 4, 'e');
  wallPlane(9, 1.7, phong({ map: bannerTex(), emissive: 0x0a0a14 }), 19.5, 2.3, 3, 0, 1, 0.03);
}
function vat(tx, ty, face) {
  const x = tc(tx), z = tc(ty);
  cyl(1.15, 2.9, MAT.metal, x, 0, z, { col: true, seg: 24 });
  cyl(1.17, 0.55, MAT.label, x, 1.35, z, { seg: 24 });
  const dome = mesh(new THREE.SphereGeometry(1.15, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.metal, x, 2.9, z); dome.scale.y = 0.22;
  cyl(0.12, 0.5, MAT.dark, x, 2.9, z);
  const dir = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[face];
  const wx = x + dir[0] * 1.32, wz = z + dir[1] * 1.32;
  const wheel = new THREE.Group(); wheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 20), MAT.red));
  for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(boxGeo(0.56, 0.04, 0.04), MAT.red); sp.rotation.z = k * Math.PI / 3; wheel.add(sp); }
  wheel.position.set(wx, 1.15, wz); wheel.rotation.y = Math.atan2(dir[0], dir[1]); scene.add(wheel);
  box(0.1, 0.1, 0.1, MAT.dark, x + dir[0] * 1.2, 1.1, z + dir[1] * 1.2);
  WORLD.valves.push({ x: wx, z: wz, ix: wx + dir[0] * 0.7, iz: wz + dir[1] * 0.7, wheel, open: false, spin: 0 });
}
function labTable(cx, cz) {
  box(5.4, 0.08, 1.3, MAT.white, cx, 0.9, cz, { col: true });
  for (const [dx, dz] of [[-2.55, -0.55], [2.55, -0.55], [-2.55, 0.55], [2.55, 0.55]]) box(0.08, 0.9, 0.08, MAT.metal, cx + dx, 0, cz + dz);
  const colors = [0x30ff90, 0xff3050, 0xffd040];
  for (let i = 0; i < 7; i++) { const c = pick(colors); const m = phong({ color: c, emissive: c, emissiveIntensity: 0.25, transparent: true, opacity: 0.85, shininess: 90 }); cyl(0.07, rand(0.18, 0.3), m, cx + rand(-2.4, 2.4), 0.98, cz + rand(-0.45, 0.45)); }
}
function propsLab() {
  labTable(42, tc(2)); labTable(51, tc(2));
  box(2.4, 1.0, 0.7, MAT.wood, 46.5, 0, 3.36, { col: true });
  cyl(0.06, 0.4, MAT.metal, 46.5, 1.0, 3.2); cyl(0.04, 0.04, MAT.red, 46.5, 1.4, 3.3);
  for (let i = 0; i < 3; i++) cyl(0.05, 0.12, MAT.glass, 45.7 + i * 0.8, 1.0, 3.5);
  wallPlane(1.6, 0.4, phong({ map: signTex('תחנת טעימות', 'TASTING'), emissive: 0x0a0a0a }), 46.5, 1.85, 3, 0, 1, 0.03);
  wallPlane(2.6, 1.3, phong({ map: whiteboardTex() }), 36, 1.7, tc(2), 1, 0, 0.03);
  box(0.5, 2.0, 2.6, MAT.dark, 56.7, 0, 9.6, { col: true });
  for (let i = 0; i < 9; i++) cyl(0.07, 0.26, MAT.glass, 56.6, 0.3 + (i % 3) * 0.6, 8.6 + Math.floor(i / 3) * 0.9);
}
function crateStack(x, z) {
  const s = 1.25;
  for (const [dx, dz] of [[-0.64, -0.64], [0.64, -0.64], [-0.64, 0.64], [0.64, 0.64]]) { const h = randi(1, 2); for (let k = 0; k < h; k++) box(s, s, s, MAT.crate, x + dx, k * s, z + dz, { ry: rand(-0.08, 0.08) }); }
  addCol(x, z, 2.6, 2.6);
}
function propsWarehouse() {
  for (const [tx, ty] of [[21, 2], [21, 3], [24, 2], [24, 3], [27, 2], [27, 3]]) crateStack(tc(tx), tc(ty));
  box(0.4, 2.4, 0.5, MAT.dark, 60.4, 0, 12.4);
  wallPlane(1.4, 1.4, phong({ map: signTex('⚽ 93', 'BRODANA ZONE', { bg: '#16224a', border: '#f3c613', fg: '#f3c613' }) }), 75, 1.9, 3, 0, 1, 0.03);
}
function propsLockers() {
  const lt = [7, 13, 21, 42].map(n => phong({ map: mkTex(tLocker(n), true), shininess: 50, specular: 0x333333 }));
  let n = 0;
  const bank = (tx, ty, side) => {
    const w = 0.95, d = 0.55, h = 2.05, nz = side === 'n' ? 1 : -1, wallZ = side === 'n' ? ty * T : (ty + 1) * T, z = wallZ + nz * d / 2;
    for (let k = 0; k < 3; k++) {
      const x = tx * T + 0.075 + w / 2 + k * w;
      const m = new THREE.Mesh(boxGeo(w - 0.03, h, d), [MAT.dark, MAT.dark, MAT.dark, MAT.dark, lt[n++ % 4], MAT.dark]);
      m.position.set(x, h / 2, z); m.rotation.y = side === 'n' ? 0 : Math.PI; scene.add(m);
      if (k === 1) {
        const L = { x, z: wallZ + nz * (d + 0.05), fx: x, fz: wallZ + nz * (d + 0.75), yaw: side === 'n' ? Math.PI : 0 };
        INTER.push({ id: 'locker', x: L.fx, z: L.fz, r: 1.25, label: () => 'להתחבא בלוקר', enabled: () => !P.hidden, use: () => enterLocker(L) });
      }
    }
    addCol(tx * T + 1.5, z, 2.9, d);
  };
  for (const tx of [4, 5, 7, 8, 9, 10, 11, 12]) bank(tx, 8, 'n');
  for (const tx of [4, 5, 6, 7, 8, 9, 11, 12]) bank(tx, 9, 's');
}
function propsParty() {
  const cx = 67.5;
  box(5.6, 0.45, 1.0, MAT.fabric, cx, 0, 24.55, { col: true }); box(5.6, 0.6, 0.3, MAT.fabric, cx, 0.45, 24.15);
  box(0.32, 0.72, 1.0, MAT.fabric, cx - 2.95, 0, 24.55); box(0.32, 0.72, 1.0, MAT.fabric, cx + 2.95, 0, 24.55);
  for (let i = 0; i < 3; i++) box(1.5, 0.16, 0.8, phong({ color: 0x6e3640 }), cx - 1.8 + i * 1.8, 0.45, 24.6);
  box(1.2, 0.42, 0.6, MAT.wood, 69, 0, 26.9, { col: true });
  for (let i = 0; i < 4; i++) cyl(0.06, 0.32, phong({ color: pick([0x2f6a35, 0x8fb3a0, 0x6a1a1a]), shininess: 90, specular: 0xffffff }), 68.6 + i * 0.25, 0.42, 26.8 + (i % 2) * 0.2);
  box(0.35, 0.22, 0.12, phong({ color: 0xff8a1e }), 69.4, 0.42, 27.05);
  WORLD.disco = mesh(new THREE.IcosahedronGeometry(0.28, 1), phong({ color: 0xcccccc, shininess: 140, specular: 0xffffff, flatShading: true }), cx, 2.75, 26.6);
  cyl(0.01, 0.2, MAT.dark, cx, 2.95, 26.6);
  box(0.7, 1.15, 0.6, MAT.dark, 55.7, 0, 24.65, { col: true });
  cyl(0.18, 0.04, MAT.rubber, 55.7, 0.7, 24.97);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 4), basic({ color: 0xffffff }), 22);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < 22; i++) { m4.makeTranslation(56 + i * 1.3, 2.6 - Math.sin(i * 0.9) * 0.08, 24.08); bulbs.setMatrixAt(i, m4); bulbs.setColorAt(i, col.setHSL(i / 22, 0.9, 0.6)); }
  scene.add(bulbs); WORLD.bulbs = bulbs;
}
function propsGenerator() {
  box(5.0, 2.2, 5.0, MAT.green, 18, 0, 45, { col: true });
  box(5.04, 0.24, 5.04, MAT.stripe, 18, 0.14, 45);
  cyl(0.22, 1.0, MAT.dark, 16.5, 2.2, 43.5);
  const panel = wallPlane(1.3, 0.8, MAT.screenPC, 20.5, 1.4, 45, 1, 0, 0.02); WORLD.genPanel = panel;
  const cap = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 12), MAT.red, 20.65, 0.85, 46.4); cap.rotation.z = Math.PI / 2;
  box(1.0, 1.2, 0.25, MAT.metal, 25.5, 0.9, 39.13);
  for (let i = 0; i < 3; i++) { const s = mesh(boxGeo(0.18, 0.5, 0.05), MAT.slotOff, 25.15 + i * 0.35, 1.5, 39.28); WORLD.fuseSlots.push(s); }
  wallPlane(1.2, 0.3, phong({ map: signTex('לוח נתיכים', 'FUSES'), emissive: 0x0a0a0a }), 25.5, 2.4, 39, 0, 1, 0.03);
  for (const [x, z] of [[13.1, 40.1], [14.1, 40.0]]) cyl(0.32, 0.95, MAT.red, x, 0, z, { col: true });
}
function propsCold() {
  for (const zz of [39.3, 47.7]) for (let tx = 13; tx <= 17; tx++) {
    if (zz < 40 && tx === 16) continue;
    box(2.7, 0.06, 0.6, MAT.metal, tc(tx), 0.6, zz); box(2.7, 0.06, 0.6, MAT.metal, tc(tx), 1.4, zz); box(2.7, 0.06, 0.6, MAT.metal, tc(tx), 2.1, zz);
    box(0.06, 2.2, 0.6, MAT.metal, tc(tx) - 1.33, 0, zz);
    if (Math.random() < 0.8) box(rand(0.5, 0.9), 0.5, 0.45, MAT.white, tc(tx) + rand(-0.8, 0.8), 0.66, zz);
    if (Math.random() < 0.7) box(rand(0.5, 0.9), 0.5, 0.45, MAT.crate, tc(tx) + rand(-0.8, 0.8), 1.46, zz);
    addCol(tc(tx), zz, 2.9, 0.62);
  }
  box(1.5, 1.0, 2.6, MAT.white, 56.1, 0, 43.5, { col: true }); box(1.52, 0.08, 2.62, phong({ color: 0x9fb6c8, shininess: 60 }), 56.1, 1.0, 43.5);
  wallPlane(1.0, 0.25, phong({ map: signTex('מקפיא 0001', 'FREEZER'), emissive: 0x0a0a0a }), 55.33, 0.7, 43.5, -1, 0, 0.03);
  for (let i = 0; i < 7; i++) { const p = mesh(new THREE.PlaneGeometry(0.4, 2.45), MAT.strip, 48.2 + i * 0.43, 1.23, 39); p.rotation.y = 0.04 * (i % 2 ? 1 : -1); }
}
function propsManager() {
  box(4.4, 0.08, 1.4, MAT.wood, 75, 0.74, 43.5, { col: true }); box(4.2, 0.74, 0.08, MAT.wood, 75, 0, 42.9);
  box(0.7, 0.45, 0.08, MAT.dark, 75, 0.82, 43.2); wallPlane(0.64, 0.38, MAT.screenPC, 75, 1.05, 43.25, 0, 1, 0.01);
  box(0.6, 1.0, 0.6, MAT.dark, 75, 0, 45.1);
  box(0.9, 1.1, 0.8, phong({ color: 0x3b3e44, shininess: 80, specular: 0x666666 }), 82.9, 0, 50.4, { col: true });
  const dial = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16), MAT.gold, 82.9, 0.7, 49.98); dial.rotation.x = Math.PI / 2;
  box(5.6, 2.3, 0.45, MAT.wood, 81, 0, 39.3, { col: true });
  for (let i = 0; i < 14; i++) box(0.12, rand(0.25, 0.36), 0.32, phong({ color: pick([0x7a1020, 0x16307a, 0x2f4a3a, 0xd9b45a]) }), 78.6 + i * 0.35, 0.95 + (i % 2) * 0.8, 39.35);
  const rug = mesh(new THREE.PlaneGeometry(4, 3), phong({ color: 0x5b1d22 }), 75, 0.015, 47); rug.rotation.x = -Math.PI / 2;
  cyl(0.25, 0.4, phong({ color: 0x6b4a33 }), 67, 0, 40); mesh(new THREE.SphereGeometry(0.45, 8, 6), phong({ color: 0x2d5a2e }), 67, 0.75, 40);
}
function propsOffice() {
  box(11.6, 0.82, 1.5, MAT.wood, 48, 0, 53.1, { col: true });
  for (const x of [45.2, 48, 50.8]) {
    box(0.78, 0.62, 0.62, phong({ color: 0x3d3a33, shininess: 30 }), x, 0.82, 52.95);
    const s = wallPlane(0.62, 0.46, MAT.screenCam, x, 1.13, 53.26, 0, 1, 0.005); WORLD.monitors.push(s);
  }
  const fan = new THREE.Group(); fan.position.set(43.3, 0.82, 53.15); scene.add(fan);
  const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 12), MAT.dark); fb.position.y = 0.04; fan.add(fb);
  const fp = new THREE.Mesh(boxGeo(0.04, 0.3, 0.04), MAT.dark); fp.position.y = 0.2; fan.add(fp);
  const blades = new THREE.Group(); blades.position.set(0, 0.38, 0.06); fan.add(blades);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(boxGeo(0.06, 0.22, 0.01), MAT.metal); b.position.y = 0.1; const piv = new THREE.Group(); piv.rotation.z = i * 2.094; piv.add(b); blades.add(piv); }
  WORLD.fan = blades;
  cyl(0.05, 0.11, MAT.white, 46.6, 0.82, 53.4); cyl(0.07, 0.26, MAT.glass, 49.6, 0.82, 53.3); cyl(0.03, 0.1, MAT.gold, 49.6, 1.08, 53.3);
  box(0.6, 0.9, 0.6, MAT.dark, 48, 0, 56.1);
  box(0.5, 0.7, 0.22, phong({ color: 0x8a8476, shininess: 40 }), 49.5, 0.85, 59.86);
  wallPlane(0.36, 0.2, basic({ color: 0x7dffb0 }), 49.5, 1.36, 59.74, 0, -1, 0.005);
  wallPlane(0.7, 0.9, MAT.paper, 50.4, 1.3, 60, 0, -1, 0.02);
  for (const k of ['w', 'e']) {
    const x = k === 'w' ? 42.06 : 53.94, nx = k === 'w' ? 1 : -1;
    box(0.08, 0.6, 0.42, MAT.metal, x, 1.05, 58.4);
    const bd = mesh(boxGeo(0.06, 0.14, 0.14), MAT.btnOff, x + nx * 0.05, 1.48, 58.4); const bl = mesh(boxGeo(0.06, 0.14, 0.14), MAT.btnDim, x + nx * 0.05, 1.2, 58.4);
    WORLD.buttons[k] = { door: bd, light: bl };
  }
  for (const k of ['w', 'e']) {
    const d = OFFICE_DOORS[k], m = mesh(boxGeo(0.18, 2.6, 3.0), MAT.door, tc(d.tx), 1.3 + 2.6, tc(d.ty));
    WORLD.doors[k] = { k, tx: d.tx, ty: d.ty, ox: d.ox, oy: d.oy, i: idx(d.tx, d.ty), closed: false, y: 2.6, mesh: m, broken: 0 };
  }
}
function propsDock() {
  box(5.6, 2.8, 5.6, phong({ color: 0x8b8f93, shininess: 30 }), 9.1, 0.3, 66.1, { col: true });
  wallPlane(4.6, 0.6, phong({ map: bannerTex() }), 11.92, 2.3, 66.1, 1, 0, 0.01);
  for (const [x, z] of [[7.2, 63.6], [11, 63.6], [7.2, 68.6], [11, 68.6]]) { const w = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), MAT.rubber, x, 0.42, z); w.rotation.z = Math.PI / 2; }
  box(1.2, 0.14, 1.0, MAT.wood, 28.2, 0, 61.2); box(1.0, 1.0, 0.9, MAT.crate, 28.2, 0.14, 61.2, { col: true });
  const gate = mesh(new THREE.PlaneGeometry(8.9, 3.15), MAT.gate, 19.5, 1.58, 68.9); gate.rotation.y = Math.PI;
  WORLD.gate = { mesh: gate, y: 0 };
  box(0.3, 3.2, 0.5, MAT.frame, 14.85, 0, 68.9); box(0.3, 3.2, 0.5, MAT.frame, 24.15, 0, 68.9);
  const sun = mesh(new THREE.PlaneGeometry(9, 3.2), MAT.sun, 19.5, 1.6, 69.6); sun.rotation.y = Math.PI; WORLD.sun = sun;
  for (const x of [14.3, 24.7]) WORLD.gateLights.push(mesh(boxGeo(0.25, 0.25, 0.25), MAT.amber, x, 2.75, 68.7));
  wallPlane(1.6, 0.4, MAT.exit, 19.5, 2.95, 69, 0, -1, 0.15);
}
function propsShowers() {
  for (let k = 1; k <= 6; k++) box(0.07, 2.0, 1.5, MAT.white, 63 + k * 3, 0, 68.25, { col: true });
  for (let k = 0; k < 7; k++) { cyl(0.09, 0.05, MAT.metal, 64.5 + k * 3, 2.15, 68.8, { rt: 0.04 }); box(0.04, 0.6, 0.04, MAT.metal, 64.5 + k * 3, 2.2, 68.96); }
  wallPlane(12, 1.0, MAT.mirror, 73.5, 1.65, 60, 0, 1, 0.02);
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) { const m = mesh(g, MAT.milk, rand(64, 83), 0.012, rand(61, 67)); const s = rand(0.8, 1.8); m.scale.set(s, 1, s); m.rotation.y = rand(6); }
}
function propsHall() {
  const pipe = (x0, z0, x1, z1, r, y) => { const len = Math.hypot(x1 - x0, z1 - z0), m = mesh(new THREE.CylinderGeometry(r, r, len, 8), MAT.dark, (x0 + x1) / 2, y, (z0 + z1) / 2); m.rotation.z = Math.PI / 2; m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); };
  pipe(6, 18.3, 90, 18.3, 0.09, 2.95); pipe(6, 18.6, 90, 18.6, 0.06, 2.85); pipe(6.3, 18, 6.3, 57, 0.08, 2.95); pipe(89.7, 18, 89.7, 57, 0.08, 2.95);
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  const halls = []; for (let i = 0; i < MW * MH; i++) if (ROOM_AT[i] === 'hall') halls.push(i);
  for (let k = 0; k < 16; k++) { const t = pick(halls), m = mesh(g, MAT.stain, tc(t % MW) + rand(-0.8, 0.8), 0.011, tc((t / MW) | 0) + rand(-0.8, 0.8)); const s = rand(0.6, 1.5); m.scale.set(s, 1, s * rand(0.6, 1.6)); m.rotation.y = rand(6); }
  for (const [tx, ty, side] of [[2, 7, 'w'], [29, 16, 'e'], [12, 11, 'n'], [19, 18, 's']]) { const w = onWall(tx, ty, side); if (!w.ok) continue; cyl(0.12, 0.55, MAT.red, w.x + w.nx * 0.2, 0.5, w.z + w.nz * 0.2); }
  const sh = []; for (const i of halls) { const x = i % MW, y = (i / MW) | 0; if ((x + y) % 3 === 0) sh.push([x, y]); }
  for (const r of ['bottling', 'lab', 'warehouse', 'lockers', 'party', 'generator', 'cold', 'manager', 'dock', 'showers']) { const a = ROOMS[r].at; sh.push([Math.floor(a[0]), Math.floor(a[1])]); }
  const fx = new THREE.InstancedMesh(boxGeo(1.3, 0.06, 0.24), MAT.fixture, sh.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), c = new THREE.Color(0x222222);
  sh.forEach(([x, y], i) => { const horiz = isFloor(x - 1, y) && isFloor(x + 1, y); e.set(0, horiz ? 0 : Math.PI / 2, 0); q.setFromEuler(e); p.set(tc(x), WALL_H - 0.04, tc(y)); m4.compose(p, q, one); fx.setMatrixAt(i, m4); fx.setColorAt(i, c); WORLD.fixtureState.push(Math.random() < 0.14 ? 'dead' : Math.random() < 0.2 ? 'flicker' : 'on'); });
  scene.add(fx); WORLD.fixtures = fx;
}
const POSTERS = [
  [8, 6, 'n', 'vandia'], [12, 6, 's', 'safety'], [24, 6, 's', 'vandia'], [13, 11, 'n', 'he'], [27, 11, 's', 'he'], [4, 11, 's', 'safety'],
  [8, 18, 'n', 'vandia'], [26, 18, 'n', 'emp:watcher'], [2, 9, 'w', 'he'], [29, 14, 'e', 'vandia'], [27, 9, 'e', 'vandia'], [22, 14, 'w', 'vandia'],
  [21, 21, 'w', 'milk'], [15, 17, 'n', 'vandia', 2.25], [16, 17, 'n', 'emp:host', 2.25], [18, 3, 'e', 'he'], [12, 8, 'e', 'safety'], [10, 21, 'e', 'he']
];
const POSTER_MATS = [];
function buildPosters() {
  const cache = { vandia: posterVandia(), he: posterHe(), safety: posterSafety(), milk: posterMilk() };
  for (const [tx, ty, side, kind, y] of POSTERS) {
    const w = onWall(tx, ty, side); if (!w.ok) continue;
    let mat;
    if (kind.startsWith('emp:')) { mat = phong({ map: posterEmployee(kind.slice(4)), emissive: 0x080808 }); POSTER_MATS.push({ mat, id: kind.slice(4) }); }
    else mat = phong({ map: cache[kind], emissive: 0x080808 });
    wallPlane(1.0, kind.startsWith('emp:') ? 1.25 : 1.5, mat, w.x, y || 1.65, w.z, w.nx, w.nz, 0.025);
  }
}
function refreshPosters() { for (const p of POSTER_MATS) { if (p.mat.map) p.mat.map.dispose(); p.mat.map = posterEmployee(p.id); p.mat.needsUpdate = true; } }

/* ---------------- lights, cameras, decals, dust ---------------- */
function buildLights() {
  const add = (name, color, I, dist, x, y, z, o = {}) => { const l = new THREE.PointLight(color, I, dist, 1.6); l.position.set(x, y, z); scene.add(l); LIGHTS[name] = Object.assign({ l, base: I, fl: 0 }, o); };
  add('office', 0xffd9a0, 1.1, 9, 47, 2.5, 55.8, { ups: true });
  add('party', 0xff4fa0, 0.95, 12, 67.5, 2.7, 27.4, { power: true, disco: true });
  add('gen', 0xff8a3a, 1.0, 11, 21, 2.8, 41.5, { power: true, emergency: true });
  add('hallN', 0xcfe6ff, 1.0, 15, 47, 3.0, 19.5, { power: true, flicker: 0.3 });
  add('hallS', 0xcfe6ff, 0.9, 13, 13, 3.0, 55.5, { power: true, flicker: 0.6 });
  add('door', 0xfff4dc, 0, 9, tc(12), 2.6, tc(18));
  if (SETTINGS.quality !== 'low') { add('cold', 0x6fa8ff, 1.0, 12, 48, 2.8, 43.5, { power: true }); add('hallM', 0xcfe6ff, 0.9, 14, 69, 3.0, 34.5, { power: true, flicker: 0.4 }); }
  riderSpot = new THREE.SpotLight(0xfff4d8, 0, 26, 0.35, 0.45, 1.2); scene.add(riderSpot); scene.add(riderSpot.target);
}
function buildCCTV() {
  for (const c of CAMS) {
    const cam = new THREE.PerspectiveCamera(78, 1, 0.1, 70); cam.position.set(c.p[0] * T, 2.85, c.p[1] * T); cam.lookAt(c.l[0] * T, 0.9, c.l[1] * T); cam.updateMatrixWorld(); CCTV_CAMS.push(cam);
    const b = mesh(boxGeo(0.22, 0.16, 0.34), MAT.dark, c.p[0] * T, 3.0, c.p[1] * T); b.rotation.copy(cam.rotation);
    const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: MAT.glowTex, color: 0xff2020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); led.scale.set(0.12, 0.12, 1); led.position.set(c.p[0] * T, 2.94, c.p[1] * T); scene.add(led);
  }
  resize();
}
function initDecals() {
  const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
  for (let i = 0; i < 36; i++) { const m = new THREE.Mesh(g, MAT.milk); m.visible = false; scene.add(m); WORLD.milk.push({ m, x: 0, z: 0, life: 0 }); }
}
function dropMilk(x, z) { const d = WORLD.milk[WORLD.milkIdx++ % WORLD.milk.length]; d.m.position.set(x, 0.013, z); d.m.rotation.y = rand(6.28); const s = rand(0.6, 1.1); d.m.scale.set(s, 1, s); d.m.visible = true; d.x = x; d.z = z; d.life = 75; }
function clearMilk() { for (const d of WORLD.milk) { d.m.visible = false; d.life = 0; } }
function initDust() {
  const N = SETTINGS.quality === 'low' ? 140 : 260, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = rand(-5, 5); pos[i * 3 + 1] = rand(0.2, 3); pos[i * 3 + 2] = rand(-5, 5); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size: 0.06, map: MAT.glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  WORLD.dust = new THREE.Points(g, m); WORLD.dust.frustumCulled = false; scene.add(WORLD.dust);
}
function updateDust(dt, t) {
  const g = WORLD.dust.geometry, p = g.attributes.position, c = g.attributes.color, a = p.array, ca = c.array;
  const cp = camera.position, on = flash.intensity > 0.3;
  const fx = -Math.sin(P.flashYaw) * Math.cos(P.flashPitch), fy = Math.sin(P.flashPitch), fz = -Math.cos(P.flashYaw) * Math.cos(P.flashPitch);
  for (let i = 0; i < p.count; i++) {
    let x = a[i * 3] + Math.sin(t * 0.3 + i) * 0.05 * dt, y = a[i * 3 + 1] + Math.cos(t * 0.2 + i * 1.7) * 0.04 * dt, z = a[i * 3 + 2];
    if (x - cp.x > 5) x -= 10; else if (x - cp.x < -5) x += 10; if (z - cp.z > 5) z -= 10; else if (z - cp.z < -5) z += 10; if (y > 3) y = 0.2; else if (y < 0.1) y = 3;
    a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    const vx = x - cp.x, vy = y - cp.y, vz = z - cp.z, d = Math.hypot(vx, vy, vz) || 1, dot = (vx * fx + vy * fy + vz * fz) / d;
    const lit = on && d < 8 && dot > 0.9 ? Math.min(1, (1 - d / 8) * (dot - 0.9) * 14) : 0;
    const L = lit * 0.7; ca[i * 3] = L; ca[i * 3 + 1] = L * 0.93; ca[i * 3 + 2] = L * 0.8;
  }
  p.needsUpdate = true; c.needsUpdate = true;
}

/* ---------------- items ---------------- */
function itemMesh(kind, extra) {
  const g = new THREE.Group();
  if (kind === 'fuse') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 10), phong({ color: 0xffb547, emissive: 0x4a2a00, shininess: 70 })); b.rotation.z = Math.PI / 2; g.add(b); for (const s of [-0.13, 0.13]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 10), MAT.metal); c.rotation.z = Math.PI / 2; c.position.x = s; g.add(c); } }
  else if (kind === 'bottle') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.26, 10), MAT.glass); b.position.y = 0.13; g.add(b); const n = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, 0.12, 8), MAT.gold); n.position.y = 0.32; g.add(n); }
  else if (kind === 'fuel') { const b = new THREE.Mesh(boxGeo(0.4, 0.48, 0.18), MAT.red); b.position.y = 0.24; g.add(b); const h = new THREE.Mesh(boxGeo(0.24, 0.05, 0.06), MAT.dark); h.position.set(-0.05, 0.52, 0); g.add(h); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), MAT.gold); s.position.set(0.14, 0.53, 0); g.add(s); }
  else if (kind === 'note') { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), MAT.paper); p.rotation.x = -Math.PI / 2; p.position.y = 0.02; g.add(p); }
  else if (kind === 'battery') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.17, 10), phong({ color: 0x2a2a2a, shininess: 60 })); b.position.y = 0.09; g.add(b); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 10), basic({ color: 0x30ff80 })); band.position.y = 0.12; g.add(band); }
  else if (kind === 'card') { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.51), phong({ map: cardTex(extra), side: THREE.DoubleSide, emissive: 0x332200 })); p.position.y = 0.95; g.add(p); g.userData.spin = p; }
  else if (kind === 'cambox') { const b = new THREE.Mesh(boxGeo(0.42, 0.5, 0.16), MAT.metal); g.add(b); const l = new THREE.Mesh(boxGeo(0.08, 0.08, 0.02), MAT.led); l.position.set(0.12, 0.16, 0.09); g.add(l); g.userData.led = l; }
  if (kind !== 'cambox') {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: MAT.glowTex, color: kind === 'card' ? 0xffd27a : 0xffe2a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
    s.scale.set(0.55, 0.55, 1); s.position.y = kind === 'card' ? 0.95 : 0.2; g.add(s); g.userData.glint = s;
  }
  return g;
}

/* ---------------- collision · line of sight · paths ---------------- */
function doorClosedAt(i) { const d = WORLD.doors; return (d.w && d.w.i === i && d.w.closed) || (d.e && d.e.i === i && d.e.closed); }
function solidTile(tx, ty) { if (!inb(tx, ty)) return true; const i = idx(tx, ty); return GRID[i] !== 1 || doorClosedAt(i); }
function hitsSolid(x, z, r) {
  const tx0 = toTile(x - r), tx1 = toTile(x + r), tz0 = toTile(z - r), tz1 = toTile(z + r);
  for (let ty = tz0; ty <= tz1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (solidTile(tx, ty)) { const cx = clamp(x, tx * T, tx * T + T), cz = clamp(z, ty * T, ty * T + T); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return true; }
  }
  for (const c of COLL) { if (x + r < c.x0 || x - r > c.x1 || z + r < c.z0 || z - r > c.z1) continue; const cx = clamp(x, c.x0, c.x1), cz = clamp(z, c.z0, c.z1); if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return true; }
  return false;
}
function aiWalk(tx, ty) { if (!inb(tx, ty)) return false; const i = idx(tx, ty); return GRID[i] === 1 && !BLOCK[i] && !doorClosedAt(i); }
function seeThrough(tx, ty) { if (!inb(tx, ty)) return false; const i = idx(tx, ty); return GRID[i] === 1 && !doorClosedAt(i); }
function los(x0, z0, x1, z1) { const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(d / 0.4)); for (let i = 1; i < n; i++) { const t = i / n; if (!seeThrough(toTile(x0 + dx * t), toTile(z0 + dz * t))) return false; } return true; }
function losWide(x0, z0, x1, z1, ok = aiWalk) {
  const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz); if (d < 0.01) return true; const n = Math.ceil(d / 0.35), px = -dz / d * 0.4, pz = dx / d * 0.4;
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + dx * t, z = z0 + dz * t; if (!ok(toTile(x), toTile(z)) || !ok(toTile(x + px), toTile(z + pz)) || !ok(toTile(x - px), toTile(z - pz))) return false; }
  return true;
}
const _prev = new Int32Array(MW * MH), _q = new Int32Array(MW * MH);
function bfs(sx, sy, gx, gy, ok = aiWalk, near = false) {
  if (!inb(sx, sy) || !inb(gx, gy)) return null;
  _prev.fill(-1); let h = 0, t = 0; const s = idx(sx, sy), g = idx(gx, gy); _q[t++] = s; _prev[s] = s;
  let best = s, bd = Math.hypot(sx - gx, sy - gy);
  while (h < t) {
    const c = _q[h++]; if (c === g) { best = g; break; }
    const cx = c % MW, cy = (c / MW) | 0;
    if (near) { const d = Math.hypot(cx - gx, cy - gy); if (d < bd) { bd = d; best = c; } }
    for (const [dx, dy] of DIR4) { const nx = cx + dx, ny = cy + dy; if (!inb(nx, ny)) continue; const n = idx(nx, ny); if (_prev[n] !== -1 || !ok(nx, ny)) continue; _prev[n] = c; _q[t++] = n; }
  }
  const end = _prev[g] !== -1 ? g : (near ? best : -1); if (end < 0) return null;
  const path = []; let c = end; while (c !== s) { path.push(c); c = _prev[c]; } path.reverse(); return path;
}
function roomAtW(x, z) { const tx = toTile(x), tz = toTile(z); return inb(tx, tz) ? ROOM_AT[idx(tx, tz)] : null; }
function randomTile(filter) { const all = []; for (let i = 0; i < MW * MH; i++) { const x = i % MW, y = (i / MW) | 0; if (aiWalk(x, y) && filter(x, y, i)) all.push(i); } return all.length ? pick(all) : null; }

/* ---------------- build all ---------------- */
function buildWorld() {
  buildMaterials(); buildLevel();
  propsBottling(); propsLab(); propsWarehouse(); propsLockers(); propsParty(); propsGenerator(); propsCold(); propsManager(); propsOffice(); propsDock(); propsShowers(); propsHall();
  buildPosters(); buildLights(); buildCCTV(); initDecals(); initDust();
  for (const L of LORE) {
    const p = mesh(new THREE.PlaneGeometry(0.34, 0.44), MAT.paper, L.at[0] * T, 0.02, L.at[1] * T); p.rotation.x = -Math.PI / 2; p.rotation.z = rand(-0.5, 0.5);
    const x = p.position.x, z = p.position.z;
    INTER.push({ id: 'lore', x, z, r: 1.5, label: () => 'לקרוא את הפתק', use: () => showNote(L.title, fillNames(L.text)) });
  }
  WORLD.built = true;
}
