// The Black Tower (chapter nine): המגדל השחור, the Black Order's tower and the Shadow's last stand. A fenced
// plaza in front of it (parked vehicles for cover, some of them cars that can blow; floodlights on masts; a
// gate in the west fence where the way up from the facility arrives; a vehicle gate in the south fence for
// the getaway), and the tower: a podium of five playable storeys — the lobby, the security floor, the server
// floor, the storage floor, the command room with its huge window over the plaza — joined by real stairs that
// alternate east and west (each flight climbs north to the hall of the floor above), an elevator in the core
// with a door on every floor (missions use it as a fade), and the roof: a big deck with a helipad. Above the
// podium the shaft goes on up as facade only, its windows lit at night. Site-local: origin at the tower's
// centre, +z south (toward the plaza). Invented throughout; nothing here is a real place or a way into one.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSite } from './compound.js';
import { tint } from './materials.js';
import { CollisionWorld } from './colliders.js';
import { trafficCarGeometry } from './car.js';
import { fence } from './countryside.js';
import { SIGN_FONT, signAtlas } from './textures.js';

const C = { x: 1780, z: -120 };                    // the tower's centre: the site's origin
const T = 19.75;                                   // the inner face of the outer walls (they stand at ±20)
export const FLOORS = [0, 6.0, 10.4, 14.8, 19.2];  // the lobby, security, servers, storage, the command room
export const ROOF = 23.6;
export const FLOOR_NAMES = ['הלובי', 'קומת האבטחה', 'קומת השרתים', 'קומת המחסנים', 'חדר הפיקוד', 'הגג'];
const TOP = ROOF + 1.2;                            // the outer walls go on up as the roof's parapet
const story = (k) => (k < 4 ? FLOORS[k + 1] : ROOF) - FLOORS[k];
const side = (k) => (k % 2 ? -1 : 1);              // flight k (floor k up to k + 1): east when k is even, west when odd
const foot = (k) => (k === 0 ? -1.2 : -4.2);       // where flight k starts; every flight climbs north to z = -12
const SHAFT = { x0: -12, x1: 12, z0: -20.25, z1: -4, h: 62 };   // the facade tower above the roof
const PLAZA = { x0: -120, x1: 100, z0: 20, z1: 100 };          // world x 1660..1880, z -100..-20
const GATE_Z = 60, EXIT_X = 40;                    // the west gate (from the facility), the south vehicle gate

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const h = baseHeight(C.x, C.z);
  // the tower's footprint and the plaza: one flat pad (world x 1655..1885, z -145..-15)
  net.addPad({ x: C.x - 10, z: C.z + 40, hx: 115, hz: 65, yaw: 0, h, top: 0.05, blend: 10, name: 'tower plaza' });
  ctx.keepOut?.push({ x: C.x - 10, z: C.z + 40, hx: 125, hz: 75 });
  ctx.keepOut?.push({ x: C.x + EXIT_X, z: C.z + 205, hx: 16, hz: 100 }); // the getaway's way south from the vehicle gate
  ctx.tower = { y: h + 0.05 };
}

export function build(ctx) {
  const { places, M, cols } = ctx;
  const { y } = ctx.tower;
  const F = FLOORS;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'tower' });
  const { batch, box, at, toWorld, wall, slab, level, group } = S;
  const P = (lx, lz, ly = 0, yaw) => ({ ...toWorld(lx, lz), y: y + ly, ...(yaw != null ? { yaw } : {}) });
  const ground = (x, z) => ctx.net.surface(x, z) ?? ctx.terrain.heightAt(x, z);
  const lamps = S.lamps, emissives = S.emissives;

  // ---------- shared pieces: few materials, nearly everything merged into the site's batch ----------
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });             // screens' glow, LEDs: lit by themselves
  const win = windowMaterial(y); emissives.push(win);
  const piece = (key, mat, w, h, d, lx, ly, lz, { yaw = 0, color = '#ffffff', scale = 0.4, uv = 'world' } = {}) =>
    batch.add(key, mat, box(w, h, d), at(lx, ly, lz, yaw), { color: tint(color), uv, uvScale: scale });
  const geo = (key, mat, g, lx, ly, lz, yaw, color) => batch.add(key, mat, g, at(lx, ly, lz, yaw), { color: tint(color) });
  const blockAt = (lx, lz, hx, hz, floor, top, yaw = 0) => cols.addBox(C.x + lx, C.z + lz, hx, hz, yaw, y + floor - (floor ? 0.3 : 1), y + floor + top);
  // a solid thing standing on a floor: drawn, blocking, and (when it is tall enough) cover
  const thing = (lx, lz, w, h, d, floor, color, { key = 'paint', mat = M.paint, yaw = 0, collide = true, cover = true, ly = 0, scale = 0.5 } = {}) => {
    piece(key, mat, w, h, d, lx, floor + ly + h / 2, lz, { yaw, color, scale });
    if (collide) blockAt(lx, lz, w / 2, d / 2, floor, ly + h, yaw);
    if (cover && h >= 0.8) S.cover.push({ ...toWorld(lx, lz), y: y + floor, w, d });
  };
  const inner = (k, color = '#c9c6bf', t = 0.2) => ({ h: k <= 4 ? story(k) - 0.26 : 2.8, t, floor: k <= 4 ? F[k] : ROOF, color, key: 'plaster', mat: M.plaster, scale: 0.3 });
  const bulbGeo = new THREE.SphereGeometry(0.16, 10, 8);
  const lampAt = (lx, lz, floor, { range = 12, intensity = 22, h = null, inside = true, color, bulb = true } = {}) => {
    const hh = h ?? (floor === ROOF ? 3 : story(F.indexOf(floor))) - 0.3;
    if (bulb) geo('bulb', S.bulbMat, bulbGeo, lx, floor + hh, lz, 0, '#ffffff');
    lamps.push({ ...toWorld(lx, lz), y: y + floor + hh - 0.1, inside, range, intensity, ...(color ? { color } : {}) });
  };
  // a light panel in a ceiling (it glows; the light itself comes from the floor's lamps)
  const panel = (lx, lz, k, w = 1.4, d = 0.36) => piece('glow', glow, w, 0.04, d, lx, F[k] + story(k) - 0.28, lz, { color: '#fff1d2', uv: 'keep' });
  // a small light that shows a state (the alarm, the card reader, the exit switch): its own colour
  const indicator = (lx, ly, lz, r = 0.08, color = '#ff2a2a') => {
    const mat = new THREE.MeshBasicMaterial({ color }), m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
    m.position.set(C.x + lx, y + ly, C.z + lz); group.add(m);
    return { mesh: m, mat, set(c) { mat.color.set(c); } };
  };

  // doors: a leaf that swings (toward the side `toward` of the wall's normal), slides along the wall, or lifts
  // into the wall above it (a shutter); closed it blocks (a dynamic box on its own floor). The same API as the
  // site builder's doors: pos, yaw, w, locked, open, setOpen(o), unlock(), lock(), body, leaf, lamp
  const leafGeos = new Map(), leafMats = new Map(), lampGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const doors = [];
  const mkDoor = (lx, lz, yaw, w, { floor = 0, h = 2.4, color = '#4a4e55', locked = false, mode = 'swing', toward = 1, label = '' } = {}) => {
    const p = toWorld(lx, lz), fy = y + floor, ux = Math.cos(yaw), uz = -Math.sin(yaw);
    const gk = `${w}x${h}`;
    if (!leafGeos.has(gk)) leafGeos.set(gk, new THREE.BoxGeometry(w - 0.06, h - 0.06, 0.08));
    if (!leafMats.has(color)) leafMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.3 }));
    const leaf = new THREE.Mesh(leafGeos.get(gk), leafMats.get(color)), pivot = new THREE.Group();
    pivot.add(leaf); group.add(pivot); pivot.rotation.y = yaw;
    if (mode === 'swing') { pivot.position.set(p.x - ux * w / 2, fy + h / 2, p.z - uz * w / 2); leaf.position.x = w / 2; }
    else pivot.position.set(p.x, fy + h / 2, p.z);
    for (const sx of [-w / 2 - 0.06, w / 2 + 0.06]) piece('paint', M.paint, 0.12, h + 0.12, 0.22, lx + ux * sx, floor + (h + 0.12) / 2, lz + uz * sx, { yaw, color: '#22252a', uv: 'keep' });
    const lamp = new THREE.Mesh(lampGeo, locked ? S.redMat : S.greenMat);
    lamp.position.set(p.x + ux * (w / 2 + 0.24), fy + h + 0.12, p.z + uz * (w / 2 + 0.24)); group.add(lamp);
    const d = { pos: { x: p.x, z: p.z, y: fy }, yaw, w, h, locked, open: false, label, floor, k: k_of(floor), mode, pivot, leaf, lamp };
    const body = cols.addDynamicBox(d, w / 2, 0.12);
    CollisionWorld.setBox(body, p.x, p.z, yaw, fy - (floor ? 0.3 : 1), fy + h);
    d.body = body;
    d.setOpen = (o) => {
      d.open = o; body.enabled = !o;
      if (mode === 'swing') pivot.rotation.y = yaw - toward * (o ? Math.PI / 2 * 0.9 : 0);
      else if (mode === 'slide') leaf.position.x = o ? w * 0.94 : 0;
      else leaf.position.y = o ? h - 0.12 : 0;
      lamp.material = !o && d.locked ? S.redMat : S.greenMat;
    };
    d.unlock = () => { d.locked = false; lamp.material = S.greenMat; };
    d.lock = () => { d.locked = true; d.setOpen(false); };
    d.setOpen(false);
    doors.push(d);
    return d;
  };
  function k_of(floor) { const k = F.indexOf(floor); return k >= 0 ? k : floor === ROOF ? 5 : 0; }

  // signs: every one of them on one atlas, one mesh, lit by itself (readable on a dark floor)
  const signList = [];
  const signAt = (text, lx, ly, lz, yaw, w, h, { bg = '#14161a', fg = '#e8e4da' } = {}) => signList.push({ text, lx, ly, lz, yaw, w, h, bg, fg });

  // ---------- the plaza: asphalt round the tower, lines, the fence and its two gates ----------
  const asphalt = { key: 'asphalt', mat: M.asphalt, color: '#56575b', scale: 0.1 };
  for (const [x0, x1, z0, z1] of [[-125, -20, -25, 105], [20, 105, -25, 105], [-20, 20, 20, 105], [-20, 20, -25, -20]]) slab((x0 + x1) / 2, -0.01, (z0 + z1) / 2, x1 - x0, 0.06, z1 - z0, asphalt);
  for (let k = 0; k < 9; k++) for (const lz of [48, 80]) piece('paint', M.paint, 0.14, 0.02, 4.8, -96 + k * 3, 0.03, lz, { color: '#d9d6cc', uv: 'keep' }); // parking bays, west
  const fenceH = 2.4, fz = (lx, lz) => [C.x + lx, C.z + lz];
  const fenceRun = (a, b) => fence(batch, M, cols, ...fz(...a), ...fz(...b), () => y, fenceH);
  fenceRun([PLAZA.x0, PLAZA.z0], [PLAZA.x0, GATE_Z - 3.1]); fenceRun([PLAZA.x0, GATE_Z + 3.1], [PLAZA.x0, PLAZA.z1]);
  fenceRun([PLAZA.x0, PLAZA.z1], [EXIT_X - 3.6, PLAZA.z1]); fenceRun([EXIT_X + 3.6, PLAZA.z1], [PLAZA.x1, PLAZA.z1]);
  fenceRun([PLAZA.x1, PLAZA.z1], [PLAZA.x1, PLAZA.z0]);
  fenceRun([PLAZA.x1, PLAZA.z0], [20.3, PLAZA.z0]); fenceRun([-20.3, PLAZA.z0], [PLAZA.x0, PLAZA.z0]);
  for (const [lx, lz] of [[PLAZA.x0, GATE_Z - 3.2], [PLAZA.x0, GATE_Z + 3.2], [EXIT_X - 3.7, PLAZA.z1], [EXIT_X + 3.7, PLAZA.z1]]) thing(lx, lz, 0.4, 3.0, 0.4, 0, '#2a2d33', { key: 'metal', mat: M.metal, cover: false });
  const gate = mkDoor(PLAZA.x0, GATE_Z, Math.PI / 2, 6, { h: 2.6, color: '#23262b', locked: true, mode: 'slide', label: 'השער' });
  const exitGate = mkDoor(EXIT_X, PLAZA.z1, 0, 7, { h: 2.6, color: '#23262b', locked: true, mode: 'slide', label: 'שער הרכבים' });
  signAt('המגדל השחור · כניסה למורשים בלבד', PLAZA.x0 - 0.3, 3.4, GATE_Z, -Math.PI / 2, 5.4, 0.7, { bg: '#0d0f12', fg: '#ff9180' });
  for (const sz of [-1, 1]) thing(PLAZA.x0 - 0.3, GATE_Z + sz * 2.9, 0.12, 3.8, 0.12, 0, '#2a2d33', { collide: false, cover: false });
  // the guard booth inside the west gate (its door east, facing the plaza)
  const booth = { h: 2.7, t: 0.2, color: '#3a3f47' };
  wall(-114, 67, -110, 67, [], booth); wall(-110, 67, -110, 73, [{ at: 3, w: 1.4, h: 2.3 }], booth); wall(-110, 73, -114, 73, [], booth); wall(-114, 73, -114, 67, [], booth);
  slab(-112, 2.75, 70, 4.6, 0.12, 6.6, { color: '#2b2f36' });
  piece('glow', glow, 0.05, 0.6, 2.2, -110.12, 1.6, 70, { color: '#ffd9a0', uv: 'keep' }); // its lit window
  thing(-112.9, 70, 0.8, 0.8, 2.4, 0, '#4a4e55', { cover: false });

  // ---------- vehicles: cars that can blow (each one mesh), vans and an armoured truck (merged) ----------
  const carGeo = trafficCarGeometry();
  const vehicles = [];
  const parked = (lx, lz, yaw, color) => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color, roughness: 0.4, metalness: 0.2 });
    const m = new THREE.Mesh(carGeo, mat), p = toWorld(lx, lz);
    m.position.set(p.x, y, p.z); m.rotation.y = yaw; group.add(m);
    const body = cols.addBox(p.x, p.z, 0.95, 2.1, yaw, y - 1, y + 1.5);
    S.cover.push({ ...p, y, w: 1.9, d: 4.2 });
    const v = { kind: 'car', ...p, y, yaw, blows: true, wrecked: false, mesh: m, body, at: { ...p, y: y + 0.6 } };
    // burnt out after its blast (the mission's Blast warns first): black, low on its flat tyres; it still blocks
    v.wreck = () => { v.wrecked = true; mat.color.set('#1d1a17'); mat.roughness = 0.95; m.position.y = y - 0.12; m.rotation.z = 0.05; };
    v.reset = () => { v.wrecked = false; mat.color.set(color); mat.roughness = 0.4; m.position.y = y; m.rotation.z = 0; };
    vehicles.push(v);
    return v;
  };
  const rigid = (lx, lz, yaw, { kind, color, len, wid, hgt, cab = true }) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const part = (w, h, d, ox, oy, oz, col) => piece('paint', M.paint, w, h, d, lx + ox * c + oz * s, oy, lz - ox * s + oz * c, { yaw, color: col, uv: 'keep' });
    const wheel = new THREE.CylinderGeometry(0.45, 0.45, 0.32, 12).rotateZ(Math.PI / 2);
    const boxLen = cab ? len - 1.6 : len;
    part(wid, hgt - 0.5, boxLen, 0, 0.5 + (hgt - 0.5) / 2, -len / 2 + boxLen / 2, color);
    if (cab) { part(wid, hgt * 0.62, 1.55, 0, 0.5 + hgt * 0.31, len / 2 - 0.78, color); part(wid - 0.1, 0.55, 0.05, 0, 0.5 + hgt * 0.45, len / 2 + 0.01, '#1b232c'); }
    for (const oz of [len / 2 - 1.0, -len / 2 + 1.1]) for (const ox of [wid / 2 - 0.1, -wid / 2 + 0.1]) geo('paint', M.paint, wheel, lx + ox * c + oz * s, 0.45, lz - ox * s + oz * c, yaw, '#121315');
    const p = toWorld(lx, lz);
    cols.addBox(p.x, p.z, wid / 2 + 0.05, len / 2 + 0.05, yaw, y - 1, y + hgt);
    S.cover.push({ ...p, y, w: wid, d: len });
    const v = { kind, ...p, y, yaw, blows: false, at: { ...p, y: y + 1 } };
    vehicles.push(v);
    return v;
  };
  parked(-84, 48, 0.4, '#2a2d33'); parked(-62, 74, -1.2, '#5d636b'); parked(-34, 44, 1.9, '#1c1f26');
  parked(-14, 62, 0.2, '#7a2b2b'); parked(28, 44, -0.5, '#3a4b5f'); parked(66, 62, 1.1, '#2b2f36');
  rigid(-48, 58, 0.15, { kind: 'van', color: '#1f2226', len: 5.6, wid: 2.1, hgt: 2.5 });
  rigid(16, 86, Math.PI / 2, { kind: 'van', color: '#3a3d44', len: 5.6, wid: 2.1, hgt: 2.5 });
  rigid(-24, 30, Math.PI / 2, { kind: 'truck', color: '#15171a', len: 7.6, wid: 2.6, hgt: 3.0 });
  rigid(72, 34, 0.3, { kind: 'truck', color: '#2b2e33', len: 7.6, wid: 2.6, hgt: 3.0 });
  // concrete barriers and planters by the door (cover; nothing in the doorway's line)
  for (const [lx, lz, yaw] of [[8, 30, 0], [-8, 40, 0.3], [30, 30, Math.PI / 2], [-40, 30, 0], [50, 50, 0.6], [-74, 64, 1.2], [-100, 60, Math.PI / 2]]) thing(lx, lz, 3, 0.85, 0.7, 0, '#9a968d', { key: 'stone', mat: M.stone, yaw });
  const planter = new THREE.CylinderGeometry(0.75, 0.85, 0.9, 14), bush = new THREE.IcosahedronGeometry(0.75, 1);
  for (const [lx, lz] of [[-7, 24], [7, 24], [-14, 22.5], [14, 22.5]]) { geo('stone', M.stone, planter, lx, 0.45, lz, 0, '#7d7a72'); geo('paint', M.paint, bush, lx, 1.25, lz, 0, '#2f4a2c'); cols.addCircle(C.x + lx, C.z + lz, 0.85, y - 1, y + 1.6); S.cover.push({ ...toWorld(lx, lz), y, w: 1.6, d: 1.6 }); }
  // floodlights: eight masts along the plaza's two long sides, two posts by the door
  const flood = (lx, lz, h, yaw) => {
    geo('metal', M.metal, new THREE.CylinderGeometry(0.14, 0.2, h, 8), lx, h / 2, lz, 0, '#3a3d44');
    cols.addCircle(C.x + lx, C.z + lz, 0.25, y - 1, y + h);
    piece('metal', M.metal, 2.4, 0.14, 0.14, lx, h, lz, { yaw, color: '#3a3d44', uv: 'keep' });
    for (const o of [-0.9, 0, 0.9]) { piece('paint', M.paint, 0.5, 0.36, 0.3, lx + Math.cos(yaw) * o, h + 0.3, lz - Math.sin(yaw) * o, { yaw, color: '#2a2d33', uv: 'keep' }); piece('bulb', S.bulbMat, 0.42, 0.28, 0.04, lx + Math.cos(yaw) * o + Math.sin(yaw) * 0.16, h + 0.3, lz - Math.sin(yaw) * o + Math.cos(yaw) * 0.16, { yaw, uv: 'keep' }); }
    lamps.push({ ...toWorld(lx + Math.sin(yaw) * 0.6, lz + Math.cos(yaw) * 0.6), y: y + h - 0.2, inside: false, range: h > 8 ? 52 : 26, intensity: h > 8 ? 140 : 60, color: '#e9f0ff' });
  };
  const floodlights = [[-104, 30, 0.6], [-58, 30, 0.2], [32, 30, -0.2], [80, 30, -0.6], [-104, 94, 2.5], [-58, 94, 2.9], [32, 94, -2.9], [80, 94, -2.5]].map(([lx, lz, yaw]) => { flood(lx, lz, 12, yaw); return P(lx, lz); });
  for (const lx of [-11, 11]) { flood(lx, 27, 6, 0); floodlights.push(P(lx, 27)); }

  // ---------- the tower: its outer walls (windows outside, plaster inside), the shaft above ----------
  const outerCol = '#5a5f68';
  S.seg(20, -20.25, 20, 20.25, { h: TOP, t: 0.5, color: outerCol, scale: 0.25 });
  S.seg(-20, -20.25, -20, 20.25, { h: TOP, t: 0.5, color: outerCol, scale: 0.25 });
  S.seg(-20, -20, 20, -20, { h: TOP, t: 0.5, color: outerCol, scale: 0.25 });
  // the south wall, piece by piece: the lobby's door (5.2 m), the command room's window (28 m) on the fifth storey
  const south = (x0, x1, y0, y1, collide = true) => {
    piece('plaster', M.plaster, x1 - x0, y1 - y0, 0.5, (x0 + x1) / 2, (y0 + y1) / 2, 20, { color: outerCol, scale: 0.25 });
    if (collide) cols.addSegment(C.x + x0, C.z + 20, C.x + x1, C.z + 20, 0.5, y + y0 - (y0 ? 0.3 : 1), y + y1);
  };
  const WIN = { x0: -14, x1: 14, y0: F[4] + 0.9, y1: F[4] + 4.0 };
  south(-20.25, WIN.x0, 0, TOP); south(WIN.x1, 20.25, 0, TOP);
  south(WIN.x0, -2.6, 0, WIN.y0); south(2.6, WIN.x1, 0, WIN.y0);
  south(-2.6, 2.6, 3.8, WIN.y0);       // over the lobby's door: the wall of every floor above it
  south(WIN.x0, WIN.x1, WIN.y1, TOP);  // over the window, up to the parapet
  // the window: glass you see through, and a pane that stops paint (and anyone) going out
  const glassMat = new THREE.MeshStandardMaterial({ color: '#a9cbe0', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.2, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), glassMat);
  glass.position.set(C.x, y + (WIN.y0 + WIN.y1) / 2, C.z + 19.9); glass.renderOrder = 3; group.add(glass);
  const windowBody = cols.addSegment(C.x + WIN.x0, C.z + 20, C.x + WIN.x1, C.z + 20, 0.3, y + WIN.y0, y + WIN.y1);
  for (let lx = WIN.x0; lx <= WIN.x1 + 0.01; lx += 3.5) piece('paint', M.paint, 0.12, WIN.y1 - WIN.y0, 0.16, lx, (WIN.y0 + WIN.y1) / 2, 19.8, { color: '#15171a', uv: 'keep' });
  // the skin: windows on every outside face (one-sided planes, so the inside stays plaster)
  const skin = (w, h, lx, ly, lz, yaw) => batch.add('towerWin', win, new THREE.PlaneGeometry(w, h), at(lx, ly, lz, yaw), { uv: 'world', uvScale: 1 / 12 });
  skin(40.5, TOP, 0, TOP / 2, -20.26, Math.PI); skin(40.5, TOP, 20.26, TOP / 2, 0, Math.PI / 2); skin(40.5, TOP, -20.26, TOP / 2, 0, -Math.PI / 2);
  for (const [x0, x1, y0, y1] of [[-20.25, WIN.x0, 0, TOP], [WIN.x1, 20.25, 0, TOP], [WIN.x0, -2.6, 0, WIN.y0], [2.6, WIN.x1, 0, WIN.y0], [-2.6, 2.6, 3.8, WIN.y0], [WIN.x0, WIN.x1, WIN.y1, TOP]]) skin(x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2, 20.26, 0);
  for (const [w, d, lx, lz] of [[41.1, 0.7, 0, -20], [41.1, 0.7, 0, 20], [0.7, 40.4, -20, 0], [0.7, 40.4, 20, 0]]) piece('plaster', M.plaster, w, 0.2, d, lx, TOP + 0.1, lz, { color: '#1c1e22' });
  piece('plaster', M.plaster, 41, 0.5, 0.7, 0, F[1] - 0.25, 20.3, { color: '#1c1e22' }); // a band over the lobby
  // the shaft: twelve storeys of facade over the roof's north half, a crown, a mast with a red light
  const SH = SHAFT.h, shz = (SHAFT.z0 + SHAFT.z1) / 2, shd = SHAFT.z1 - SHAFT.z0;
  piece('towerWin', win, SHAFT.x1 - SHAFT.x0, SH, shd, 0, ROOF + SH / 2, shz, { scale: 1 / 12 });
  cols.addBox(C.x, C.z + shz, (SHAFT.x1 - SHAFT.x0) / 2, shd / 2, 0, y + ROOF - 0.3, y + ROOF + SH);
  piece('plaster', M.plaster, SHAFT.x1 - SHAFT.x0 + 1, 1.4, shd + 1, 0, ROOF + SH + 0.7, shz, { color: '#16181c' });
  geo('metal', M.metal, new THREE.CylinderGeometry(0.12, 0.3, 16, 8), 0, ROOF + SH + 9.4, shz, 0, '#3a3d44');
  const beacon = indicator(0, ROOF + SH + 17.6, shz, 0.35, '#ff3030');

  // ---------- the core: the elevator with a door on every floor ----------
  for (const sx of [-2.5, 2.5]) S.seg(sx, -20, sx, -16, { h: ROOF, t: 0.3, color: '#3a3f47' });
  const elevator = { doors: [], front: [], inside: [] };
  for (let k = 0; k <= 4; k++) {
    wall(-2.5, -16, 2.5, -16, [{ at: 2.5, w: 1.6, h: 2.4 }], inner(k, '#3a3f47', 0.3));
    elevator.doors.push(mkDoor(0, -16, 0, 1.6, { floor: F[k], h: 2.4, color: '#9aa0a8', mode: 'slide', label: 'מעלית' }));
    elevator.front.push(P(0, -14.4, F[k], Math.PI));
    elevator.inside.push(P(0, -18, F[k], 0));
    signAt(FLOOR_NAMES[k], 0, F[k] + 2.85, -15.82, 0, 2.4, 0.4);
  }

  // ---------- the stairs: five flights, east and west by turns, each in its own stairwell ----------
  // a flight like the site builder's stairs, its steps' walking surfaces overlapping a little, so no line
  // across the flight falls between two steps
  const flight = (lx, lz, yaw, { rise, run, width, steps, floor, color }) => {
    const d = run / steps, sx = Math.sin(yaw), sz = Math.cos(yaw);
    for (let k = 1; k <= steps; k++) {
      const sk = (k - 0.5) * d, hk = rise * k / steps;
      ctx.net.addPad({ x: C.x + lx + sx * sk, z: C.z + lz + sz * sk, hx: width / 2, hz: d / 2 + 0.02, yaw, h: y + floor + hk - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'tower stairs' });
      piece('stone', M.stone, width, hk, d, lx + sx * sk, floor + hk / 2, lz + sz * sk, { yaw, color, scale: 0.4 });
      piece('paint', M.paint, width, 0.03, 0.06, lx + sx * (sk - d / 2 + 0.03), floor + hk + 0.005, lz + sz * (sk - d / 2 + 0.03), { yaw, color: '#c8a23a', uv: 'keep' }); // the nosing
    }
  };
  const flights = [];
  for (let k = 0; k <= 4; k++) {
    const s = side(k), lx = s * 18.5, zb = foot(k), run = zb + 12, rise = story(k), up = k < 4 ? F[k + 1] : ROOF;
    flight(lx, zb, Math.PI, { rise, run, width: 2.4, steps: k === 0 ? 18 : 13, floor: F[k], color: '#7d7a74' });
    const xi = s * 17.2, xo = s * T, wl = inner(k, '#6b6f75'), wu = inner(k + 1, '#6b6f75');
    wall(xi, -12, xi, zb, [], wl); wall(xi, -12, xo, -12, [], wl);   // on the floor it leaves: climbed from its foot only
    wall(xi, -12, xi, zb, [], wu); wall(xi, zb, xo, zb, [], wu);     // round the hole on the floor it reaches
    flights.push({ k, from: k, to: k + 1, side: s > 0 ? 'east' : 'west', bottom: P(lx, zb + 0.6, F[k], Math.PI), top: P(lx, -12.6, up, Math.PI), foot: P(s * 15.6, zb + 1.8, F[k]), hall: P(s * 15.6, -13.6, up) });
  }
  // the hut over the roof's stair: a roof, its east side over the parapet; it opens north
  slab(18.5, ROOF + 2.9, -8.1, 3.1, 0.2, 8.2, { color: '#2b2f36' });
  piece('plaster', M.plaster, 0.3, 1.7, 8.2, 19.8, TOP + 0.85, -8.1, { color: '#6b6f75' });
  // the floors above the lobby, each with one hole: the stair coming up from below
  const FLOOR_COL = [null, '#6f7680', '#4d535c', '#8f887b', '#232428', '#5d6168'];
  for (let k = 1; k <= 5; k++) {
    const fl = k <= 4 ? F[k] : ROOF, s = side(k - 1), zb = foot(k - 1);
    const h = s > 0 ? { x0: 17.2, x1: T, z0: -12, z1: zb } : { x0: -T, x1: -17.2, z0: -12, z1: zb };
    for (const r of [{ x0: -T, x1: h.x0, z0: -T, z1: T }, { x0: h.x1, x1: T, z0: -T, z1: T }, { x0: h.x0, x1: h.x1, z0: -T, z1: h.z0 }, { x0: h.x0, x1: h.x1, z0: h.z1, z1: T }])
      if (r.x1 - r.x0 > 0.05 && r.z1 - r.z0 > 0.05) level((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, fl, { color: FLOOR_COL[k], name: `tower ${k}`, scale: 0.4 });
  }
  slab(0, 0.015, 0, 39.5, 0.03, 39.5, { key: 'stone', mat: M.stone, color: '#8d8a84', scale: 0.25 }); // the lobby's floor
  // the stair halls (x ±14..±19.75, z -12..0) on every floor above the lobby: the aisle to a flight's foot
  for (let k = 1; k <= 4; k++) for (const s of [-1, 1]) { wall(s * 14, -12, s * 14, 0, [], inner(k)); if (k < 4) wall(s * 14, 0, s * T, 0, [], inner(k)); }

  // ---------- the lobby (ground floor, 6 m high) ----------
  const lobbyDoor = mkDoor(0, 20, 0, 5.2, { h: 3.8, color: '#30343b', mode: 'lift', label: 'הדלת הראשית' });
  thing(0, 3, 7, 1.1, 1.0, 0, '#16181c');                                                    // the reception desk
  piece('paint', M.paint, 7.3, 0.08, 1.3, 0, 1.14, 3, { color: '#8a8f96', uv: 'keep' });
  for (const lx of [-2, 2]) piece('glow', glow, 0.6, 0.38, 0.04, lx, 1.42, 3.3, { color: '#59c7ff', uv: 'keep' });
  for (const [lx, lz] of [[-10, -6], [10, -6], [-10, 8], [10, 8]]) thing(lx, lz, 1.0, F[1] - 0.25, 1.0, 0, '#1f2226', { key: 'stone', mat: M.stone }); // pillars
  for (const [lx, lz, yaw] of [[-15.5, 1, Math.PI / 2], [-15.5, 9, Math.PI / 2], [-12, 5, 0]]) thing(lx, lz, 2.6, 0.8, 0.9, 0, '#3a2a2e', { yaw }); // the waiting area's sofas
  thing(-15, 5, 1.2, 0.45, 1.8, 0, '#2a2d33', { cover: false });
  signAt('המגדל השחור', 0, 4.6, -15.8, 0, 5.2, 0.9, { bg: '#0d0f12', fg: '#c8a46a' });
  for (const [lx, lz] of [[0, -4], [-11, 12], [11, 12], [-11, -8], [11, -8], [0, 14]]) panel(lx, lz, 0, 2.4, 0.5);
  // the exit switch: a panel by the door that works the lobby's shutter and the plaza's vehicle gate
  piece('paint', M.paint, 0.6, 0.8, 0.12, 6.5, 1.4, 19.65, { color: '#2a2d33', uv: 'keep' });
  const switchLamp = indicator(6.5, 1.95, 19.55, 0.07, '#ff2a2a');
  signAt('יציאה', 6.5, 2.4, 19.7, Math.PI, 1.0, 0.3, { bg: '#0f5a2c', fg: '#ffffff' });

  let monitorDoor, alarmDoor, camWall, alarmLamp, cardMesh, fireGate, breachDoor, trapDoor, commandDoor, escapeDoor, readerLamp, screen;
  // ---------- floor 1: security (monitors, the alarm, the locker room, the office with the card) ----------
  {
    const f = F[1], w1 = inner(1, '#b9bcc2');
    wall(-14, -12, 14, -12, [{ at: 8, w: 1.4, h: 2.4 }, { at: 22, w: 1.4, h: 2.4 }], w1);  // the monitor room (x -6), the alarm room (x 8)
    wall(-14, 0, -14, 2, [], w1); wall(14, 0, 14, 2, [], w1); wall(2, -12, 2, 2, [], w1);
    wall(-14, 2, 14, 2, [{ at: 6, w: 1.4, h: 2.4 }, { at: 22, w: 1.4, h: 2.4 }], w1);     // south doors at x -8 and x 8
    wall(0, 2, 0, T, [{ at: 10, w: 1.4, h: 2.4 }], w1);                                    // lockers | office, a door at z 12
    monitorDoor = mkDoor(-6, -12, 0, 1.4, { floor: f, color: '#4a4e55' }); alarmDoor = mkDoor(8, -12, 0, 1.4, { floor: f, color: '#4a4e55' });
    // the monitor room: a wall of camera feeds, the console in front of it
    camWall = makeScreen(); camWall.show('cams');
    const vw = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), camWall.mat); vw.position.set(C.x - 13.88, y + f + 1.9, C.z - 5); vw.rotation.y = Math.PI / 2; group.add(vw);
    thing(-11.2, -5, 0.9, 0.85, 8, f, '#2a2d33');
    for (const lz of [-8, -5.5, -3, -0.5]) piece('glow', glow, 0.04, 0.4, 0.7, -11.5, f + 1.1, lz, { color: '#59c7ff', uv: 'keep' });
    thing(-4, -8, 3, 0.8, 0.8, f, '#3a3f47'); thing(0.9, -10.8, 1.4, 1.9, 0.6, f, '#4a5560', { key: 'metal', mat: M.metal });
    signAt('חדר מוניטורים', -6, f + 2.75, -12.12, Math.PI, 2.2, 0.36);
    // the alarm room: the panel on the east wall, cabinets, the siren
    thing(13.75, -5, 0.3, 1.6, 1.4, f, '#5a1d1d', { ly: 0.6, cover: false });
    for (const lz of [-5.4, -5, -4.6]) piece('glow', glow, 0.04, 0.12, 0.2, 13.58, f + 1.6, lz, { color: '#ffb04a', uv: 'keep' });
    alarmLamp = indicator(13.6, f + 2.45, -5, 0.16, '#ff2a2a');
    for (const lx of [4, 11.6]) thing(lx, -11.4, 2.2, 2.0, 0.6, f, '#4a5560', { key: 'metal', mat: M.metal });
    thing(5, 1.3, 3, 0.8, 0.8, f, '#3a3f47');
    signAt('בקרת אזעקה', 8, f + 2.75, -12.12, Math.PI, 2.2, 0.36);
    // the locker room (south-west) and the security office (south-east, the card on its desk)
    thing(-19.3, 11, 0.8, 2.1, 14, f, '#4a5560', { key: 'metal', mat: M.metal });
    for (const lx of [-14, -8]) thing(lx, 11, 0.5, 0.45, 6, f, '#5a4a3a', { cover: false });
    thing(10.6, 12.2, 3, 0.78, 1.4, f, '#5a4a3a'); thing(16.5, 6, 1.6, 0.78, 3, f, '#5a4a3a');
    for (const lz of [9, 12, 15]) thing(19.2, lz, 0.7, 1.4, 2.4, f, '#6b6f75', { key: 'metal', mat: M.metal });
    piece('glow', glow, 0.9, 0.5, 0.04, 10.6, f + 1.1, 12.75, { color: '#59c7ff', uv: 'keep' });
    const cardMat = new THREE.MeshBasicMaterial({ color: '#ffd34d' });
    cardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.14), cardMat);
    cardMesh.position.set(C.x + 10.2, y + f + 0.79, C.z + 11.8); cardMesh.rotation.y = 0.4; group.add(cardMesh);
    for (const [lx, lz] of [[-10, -14], [10, -14], [-6, -5], [8, -5], [-10, 11], [10, 9]]) panel(lx, lz, 1);
  }

  // ---------- floor 2: the server floor (a corridor, four server rooms, the emergency gate in the hall) ----------
  {
    const f = F[2], w2 = inner(2, '#7d828a');
    wall(-14, -12, -2, -12, [], w2); wall(2, -12, 14, -12, [], w2);
    wall(-2, -12, -2, T, [{ at: 7, w: 1.4, h: 2.4 }, { at: 23, w: 1.4, h: 2.4 }], w2);   // rooms A (z -5) and B (z 11)
    wall(2, -12, 2, T, [{ at: 7, w: 1.4, h: 2.4 }, { at: 23, w: 1.4, h: 2.4 }], w2);     // C (z -5, the breach) and D (z 11)
    wall(-T, 4, -2, 4, [], w2); wall(2, 4, T, 4, [], w2);
    wall(8, -T, 8, -12, [{ at: 6.55, w: 2.4, h: 2.4 }], { ...inner(2, '#5a5f68'), t: 0.3 }); // the emergency gate across the hall at x 8
    fireGate = mkDoor(8, -13.2, Math.PI / 2, 2.4, { floor: f, h: 2.4, color: '#a33a2a', label: 'שער החירום' });
    breachDoor = mkDoor(2, -5, Math.PI / 2, 1.4, { floor: f, color: '#3a3d44', locked: true, label: 'חדר השרתים' });
    const rack = (x0, x1, lz, alongZ = false) => {
      const len = x1 - x0, cx0 = (x0 + x1) / 2;
      if (!alongZ) thing(cx0, lz, len, 2.2, 0.9, f, '#16191e', { key: 'metal', mat: M.metal });
      else thing(lz, cx0, 0.9, 2.2, len, f, '#16191e', { key: 'metal', mat: M.metal });
      for (let t = x0 + 0.5; t < x1 - 0.2; t += 1.0) for (const sd of [-1, 1]) {
        const col = (Math.round(t * 3) % 3) ? '#2fd27a' : '#59c7ff';
        if (!alongZ) piece('glow', glow, 0.4, 0.05, 0.02, t, f + 1.6, lz + sd * 0.46, { color: col, uv: 'keep' });
        else piece('glow', glow, 0.02, 0.05, 0.4, lz + sd * 0.46, f + 1.6, t, { color: col, uv: 'keep' });
      }
    };
    rack(-13, -4.5, -9.5); rack(-13, -4.5, -1); rack(4.5, 13, -9.5); rack(4.5, 13, -1);       // A and C
    for (const lx of [-16, -12.5, -9]) rack(7, 17, lx, true); for (const lx of [9, 12.5, 16]) rack(7, 17, lx, true); // B and D
    thing(-17, 2, 2.4, 1.8, 1.6, f, '#8a8f96', { key: 'metal', mat: M.metal }); thing(17, 2, 2.4, 1.8, 1.6, f, '#8a8f96', { key: 'metal', mat: M.metal }); // cooling
    thing(12, -5, 1.2, 1.1, 0.8, f, '#2a2d33');                                                // C's terminal
    piece('glow', glow, 0.8, 0.5, 0.04, 12, f + 1.45, -5.42, { color: '#ff9180', uv: 'keep' });
    signAt('חדר שרתים', 1.88, f + 2.75, -5, -Math.PI / 2, 1.8, 0.34, { bg: '#1c1f26', fg: '#59c7ff' });
    signAt('שער חירום', 8.18, f + 2.75, -13.2, Math.PI / 2, 1.8, 0.34, { bg: '#5a1d1d', fg: '#ffffff' });
    for (const [lx, lz] of [[-8, -14], [12, -14], [0, -4], [0, 8], [0, 15], [8, -5], [-8, -5], [-10, 12], [10, 12]]) panel(lx, lz, 2);
  }

  // ---------- floor 3: storage (shelves, the loading office, the store room where a friend can be shut in) ----------
  {
    const f = F[3], w3 = inner(3, '#a39b8c');
    wall(-14, -12, 14, -12, [{ at: 11, w: 2.4, h: 2.6 }, { at: 17, w: 2.4, h: 2.6 }], w3);  // two openings, x -3 and x 3
    wall(12, 12, T, 12, [{ at: 2.5, w: 1.4, h: 2.4 }], w3); wall(12, 12, 12, T, [], w3);     // the store room, its door at x 14.5
    wall(-T, 12, -12, 12, [{ at: 5.25, w: 1.4, h: 2.4 }], w3); wall(-12, 12, -12, T, [], w3); // the loading office, x -14.5
    trapDoor = mkDoor(14.5, 12, 0, 1.4, { floor: f, color: '#5d636b', locked: true, label: 'המחסן הנעול' });
    const shelf = (lx, lz, len, alongZ = false) => {
      const w = alongZ ? 0.9 : len, d = alongZ ? len : 0.9;
      thing(lx, lz, w, 2.6, d, f, '#5a5f66', { key: 'metal', mat: M.metal });
      for (let t = -len / 2 + 0.6; t < len / 2 - 0.3; t += 1.2) for (const ly of [0.55, 1.45]) piece('paint', M.paint, alongZ ? 0.8 : 0.9, 0.6, alongZ ? 0.9 : 0.8, alongZ ? lx : lx + t, f + ly + 0.3, alongZ ? lz + t : lz, { color: ['#b8955e', '#8a6b45', '#6b7a52'][Math.abs(Math.round(t * 2)) % 3], uv: 'keep' });
    };
    for (const lz of [-8, -3.5, 1, 5.5]) { shelf(-8.5, lz, 7); shelf(8.5, lz, 7); }
    shelf(-17.8, 6, 7, true); shelf(17.8, 6, 7, true);
    for (const [lx, lz] of [[-9, 9], [7, 8], [18.5, 18.5], [13.5, 18.5]]) thing(lx, lz, 1.4, 1.2, 1.4, f, '#b8955e');
    thing(-16, 16, 2.4, 0.78, 1.2, f, '#5a4a3a');                                              // the loading office's desk
    signAt('מחסן', 0, f + 2.95, -12.12, Math.PI, 1.6, 0.36);
    for (const [lx, lz] of [[-10, -14], [10, -14], [0, -2], [0, 5], [-8, 10], [8, 10], [16, 16], [-16, 16]]) panel(lx, lz, 3);
  }

  // ---------- floor 4: the command room (the anteroom and its card reader, the Shadow's desk, the window) ----------
  {
    const f = F[4], w4 = inner(4, '#2b2d33');
    wall(-14, -12, 14, -12, [{ at: 4, w: 1.4, h: 2.4 }, { at: 14, w: 1.8, h: 2.5 }, { at: 24, w: 1.4, h: 2.4 }], w4); // guard post, anteroom, archive
    wall(-6, -12, -6, 0, [], w4); wall(6, -12, 6, 0, [], w4);
    wall(-T, 0, T, 0, [{ at: T, w: 2.0, h: 2.6 }], w4);                                       // the command room's north wall, its door at x 0
    wall(-16.5, 0, -16.5, 3.5, [{ at: 2.0, w: 1.4, h: 2.4 }], w4); wall(-T, 3.5, -16.5, 3.5, [], w4); // the emergency elevator
    commandDoor = mkDoor(0, 0, 0, 2.0, { floor: f, h: 2.6, color: '#1c1f26', locked: true, label: 'חדר הפיקוד' });
    escapeDoor = mkDoor(-16.5, 2.0, Math.PI / 2, 1.4, { floor: f, color: '#8a1f1f', locked: true, mode: 'slide', label: 'מעלית החירום' });
    piece('paint', M.paint, 0.3, 0.45, 0.08, 1.7, f + 1.35, -0.14, { color: '#1c1f26', uv: 'keep' });
    readerLamp = indicator(1.7, f + 1.45, -0.2, 0.05, '#ff2a2a');
    signAt('חדר הפיקוד', 0, f + 3.0, -0.12, Math.PI, 2.4, 0.4, { bg: '#1c1f26', fg: '#ff9180' });
    signAt('מעלית חירום', -16.38, f + 2.75, 2.0, Math.PI / 2, 1.8, 0.32, { bg: '#5a1d1d', fg: '#ffffff' });
    // the guard post and the archive
    thing(-10, -9.5, 2.4, 0.78, 1.2, f, '#3a3f47'); thing(-13.4, -4, 0.6, 2.0, 4, f, '#4a5560', { key: 'metal', mat: M.metal });
    for (const lz of [-9, -5]) thing(10, lz, 6, 2.2, 0.8, f, '#4a4e55', { key: 'metal', mat: M.metal });
    // the command room: the desk and its computer, the screens, consoles for cover, two pillars
    thing(0, 13, 4.2, 0.8, 1.5, f, '#0e0f12');
    piece('paint', M.paint, 4.4, 0.06, 1.7, 0, f + 0.83, 13, { color: '#2a2d33', uv: 'keep' });
    screen = makeScreen();
    const mon = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.75), screen.mat); mon.position.set(C.x, y + f + 1.3, C.z + 12.62); group.add(mon);
    piece('paint', M.paint, 1.4, 0.85, 0.06, 0, f + 1.3, 12.58, { color: '#111214', uv: 'keep' });
    const wallScreen = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), screen.mat); wallScreen.position.set(C.x + 8.5, y + f + 2.1, C.z + 0.13); group.add(wallScreen);
    thing(-1.5, 15.3, 0.7, 1.15, 0.7, f, '#1c1f26', { collide: false, cover: false, yaw: 0.5 }); // his chair, pushed back
    for (const [lx, len] of [[-9.5, 7], [9.5, 7]]) { thing(lx, 5, len, 1.0, 0.8, f, '#2a2d33'); for (let t = -2.5; t <= 2.6; t += 1.25) piece('glow', glow, 0.6, 0.05, 0.4, lx + t, f + 1.03, 5, { color: '#ff9180', uv: 'keep' }); }
    for (const lx of [-9, 9]) thing(lx, 11, 1.0, story(4) - 0.26, 1.0, f, '#15171a', { key: 'stone', mat: M.stone });
    for (const lx of [-15.5, 15.5]) thing(lx, 15, 1.6, 1.0, 1.6, f, '#2a2d33');
    for (const [lx, lz] of [[-10, -14], [10, -14], [0, -6], [-8, 8], [8, 8], [0, 16], [-10, -5], [10, -5]]) panel(lx, lz, 4);
  }

  // ---------- the roof: the deck, the helipad, rooftop units, the stair hut ----------
  const padR = 7, padAt = { lx: 0, lz: 9 };
  geo('paint', M.paint, new THREE.CylinderGeometry(padR, padR, 0.15, 40), padAt.lx, ROOF + 0.075, padAt.lz, 0, '#3a3d44');
  ctx.net.addPad({ x: C.x + padAt.lx, z: C.z + padAt.lz, r: padR, h: y + ROOF + 0.15 - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'tower helipad' });
  const padMat = new THREE.MeshStandardMaterial({ map: helipadTexture(), roughness: 0.8, transparent: true });
  const padMark = new THREE.Mesh(new THREE.CircleGeometry(padR - 0.2, 40).rotateX(-Math.PI / 2), padMat);
  padMark.position.set(C.x + padAt.lx, y + ROOF + 0.155, C.z + padAt.lz); group.add(padMark);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; piece('glow', glow, 0.18, 0.1, 0.18, padAt.lx + Math.cos(a) * (padR - 0.15), ROOF + 0.2, padAt.lz + Math.sin(a) * (padR - 0.15), { color: i % 2 ? '#ffd34d' : '#2fd27a', uv: 'keep' }); }
  for (const [lx, lz, w, h, d] of [[-16, -9, 3, 1.6, 4], [-15, 15.5, 3.4, 1.4, 2.4], [15, 15.5, 3.4, 1.4, 2.4], [-16.5, 4, 2.4, 1.2, 2.4]]) thing(lx, lz, w, h, d, ROOF, '#8a8f96', { key: 'metal', mat: M.metal });
  for (const [lx, lz] of [[-18.5, 18.5], [18.5, 18.5]]) { geo('metal', M.metal, new THREE.CylinderGeometry(0.08, 0.1, 3, 8), lx, TOP + 1.5, lz, 0, '#3a3d44'); piece('bulb', S.bulbMat, 0.5, 0.3, 0.3, lx, TOP + 3, lz, { uv: 'keep' }); lamps.push({ ...toWorld(lx * 0.9, lz * 0.9), y: y + TOP + 2.8, inside: false, range: 30, intensity: 60, color: '#e9f0ff' }); }
  lampAt(18.5, -8.1, ROOF, { h: 2.6, range: 8, intensity: 12 });
  // the lamps inside: two on every storey, in the same two places on all of them, so whichever floor the
  // player is on, its own lamps are among the nearest the night keeps lit (lamps are picked by distance)
  for (let k = 0; k <= 4; k++) for (const lz of [-6, 9]) lampAt(0, lz, F[k], { range: k ? 18 : 22, intensity: k ? 32 : 42, bulb: !(k === 1 && lz === 9) });

  // ---------- the escape (mission 45): the route down, marked; the gate; where a friend falls; the switch; the car ----------
  const route = [
    P(0, 8, F[4]), P(0, 1.4, F[4]), P(0, -1.4, F[4]), P(0, -6, F[4]), P(0, -13.6, F[4]), P(-15.6, -13.6, F[4]),
    { ...flights[3].top },                                                                       // down the west flight to the storage floor
    { ...flights[3].bottom }, P(-15.6, -2.4, F[3]), P(-15.6, -13.6, F[3]), P(15.6, -13.6, F[3]),
    { ...flights[2].top },                                                                       // the east flight to the server floor
    { ...flights[2].bottom }, P(15.6, -2.4, F[2]), P(15.6, -13.6, F[2]), P(8, -13.4, F[2]), P(-15.6, -13.6, F[2]),
    { ...flights[1].top },                                                                       // the west flight to the security floor
    { ...flights[1].bottom }, P(-15.6, -2.4, F[1]), P(-15.6, -13.6, F[1]), P(15.6, -13.6, F[1]),
    { ...flights[0].top },                                                                       // the long flight down into the lobby
    P(18.5, -0.4, 0), P(12, 12, 0), P(3, 17.6, 0), P(0, 21.2, 0), P(0, 30, 0), P(EXIT_X, 62, 0),
  ];
  const chevrons = routeMarks(route.map((p) => ({ x: p.x, y: p.y, z: p.z })));
  group.add(chevrons);
  const escape = {
    route,
    gate: fireGate, gateAt: P(9.4, -13.4, F[2], -Math.PI / 2),
    fallen: P(-7, -17.6, F[1], Math.PI / 2), fallenAt: P(-7, -16.2, F[1], Math.PI),
    switch: P(6.5, 18.7, 0, 0), switchPanel: P(6.5, 19.65, 1.4), switchLamp,
    car: P(EXIT_X, 72, 0, 0), exitGate, exitOutside: (() => { const p = toWorld(EXIT_X, 106); return { ...p, y: ground(p.x, p.z), yaw: 0 }; })(),
    drive: [[EXIT_X, 72], [EXIT_X, 96], [EXIT_X, 106], [EXIT_X, 150], [36, 230], [30, 280]].map(([lx, lz]) => { const p = toWorld(lx, lz); return { ...p, y: ground(p.x, p.z) }; }),
    afar: (() => { const p = toWorld(30, 282); return { ...p, y: ground(p.x, p.z), yaw: Math.PI }; })(),
    blasts: [P(-9, 7, F[4]), P(10, 15, F[4]), P(-8, -17.6, F[3]), P(9, -17.4, F[3]), P(13, -17.6, F[2]), P(-6, -18, F[2]), P(10, -18, F[1]), P(9, 1, 0), P(-6, 11, 0), P(-22, 46, 0), P(30, 52, 0)],
    marked: false,
    mark(on = true) { chevrons.visible = on; escape.marked = on; },
    // the panel by the lobby's door: up opens the lobby's shutter and the plaza's vehicle gate; down shuts both
    throwSwitch(on = true) { for (const d of [lobbyDoor, exitGate]) { if (on) { d.unlock(); d.setOpen(true); } else d.lock(); } switchLamp.set(on ? '#2fd27a' : '#ff2a2a'); },
    // the index of the route point nearest p on its own floor (the next one is route[i + 1])
    routeIndex(p) { let best = 0, bd = Infinity; route.forEach((q, i) => { if (Math.abs(q.y - (p.y ?? q.y)) > 1.6) return; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = i; } }); return best; },
  };
  escape.mark(false);

  // ---------- the signs, all on one atlas ----------
  if (signList.length) {
    const atlas = signAtlas('tower-signs', signList.map((s) => ({ text: s.text, bg: s.bg, fg: s.fg, border: true })), { cellW: 512, cellH: 96, cols: 4, size: 50 });
    const parts = signList.map((s, i) => {
      const g = new THREE.PlaneGeometry(s.w, s.h), uv = g.getAttribute('uv'), [u0, v0, u1, v1] = atlas.uv[i];
      for (let j = 0; j < uv.count; j++) uv.setXY(j, u0 + uv.getX(j) * (u1 - u0), v0 + uv.getY(j) * (v1 - v0));
      g.applyMatrix4(at(s.lx, s.ly, s.lz, s.yaw)); return g;
    });
    const signs = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshBasicMaterial({ map: atlas.texture }));
    for (const g of parts) g.dispose();
    group.add(signs);
  }

  S.finish();
  for (const d of [monitorDoor, alarmDoor, fireGate, lobbyDoor]) { d.unlock(); d.setOpen(true); }
  for (const d of elevator.doors) d.unlock();

  // ---------- what the missions use ----------
  const fy = (k) => y + (k <= 4 ? F[k] : ROOF);
  const alarm = { at: P(13.6, -5, F[1] + 1.5), on: true, lamp: alarmLamp, set(on) { alarm.on = on; alarmLamp.set(on ? '#ff2a2a' : '#2fd27a'); } };
  const card = { at: { x: cardMesh.position.x, y: cardMesh.position.y, z: cardMesh.position.z }, pickAt: P(10.2, 10.7, F[1], 0), floor: 1, mesh: cardMesh, taken: false,
    take() { card.taken = true; cardMesh.visible = false; }, reset() { card.taken = false; cardMesh.visible = true; } };
  const reader = { at: P(1.7, -0.2, F[4] + 1.45), lamp: readerLamp, ok: false, set(ok) { reader.ok = ok; readerLamp.set(ok ? '#2fd27a' : '#ff2a2a'); } };
  let clock = 0;
  places.tower = {
    x: C.x, z: C.z, y, toWorld, F, ROOF, floorNames: FLOOR_NAMES,
    floors: FLOOR_NAMES.map((name, k) => ({ k, name, y: fy(k), centre: k === 5 ? P(0, 2, ROOF) : P(0, k === 0 ? 6 : -14, k <= 4 ? F[k] : ROOF) })),
    floorY: fy,
    floorOf(yy) { let best = 0; for (let k = 0; k <= 5; k++) if (yy >= fy(k) - 1.2) best = k; return best; },
    near(a, b, r) { return Math.hypot(a.x - b.x, a.z - b.z) < r && Math.abs((a.y ?? y) - (b.y ?? y)) < 1.8; },
    // the plaza
    gate, gateOutside: P(PLAZA.x0 - 4, GATE_Z, 0, Math.PI / 2), gateInside: P(PLAZA.x0 + 5, GATE_Z, 0, Math.PI / 2),
    approach: (() => { const p = toWorld(PLAZA.x0 - 9, GATE_Z); return { ...p, y: ground(p.x, p.z), yaw: Math.PI / 2 }; })(),
    plaza: { ...PLAZA, centre: P(-20, 60), entrance: P(0, 23.5, 0, Math.PI), booth: P(-112, 70, 0, Math.PI / 2), boothDoor: P(-108.8, 70, 0, -Math.PI / 2) },
    exitGate, vehicles, cars: vehicles.filter((v) => v.blows), floodlights, cover: S.cover,
    // the tower
    lobby: { door: lobbyDoor, outside: P(0, 23.5, 0, Math.PI), inside: P(0, 16.5, 0, Math.PI), centre: P(0, -2, 0, Math.PI), desk: P(0, 4.4, 0, Math.PI), reception: P(0, 1.6, 0, 0), waiting: P(-12, 2, 0), pillars: [P(-10, -6), P(10, -6), P(-10, 8), P(10, 8)] },
    stairs: flights,
    elevator: { ...elevator, open(k) { elevator.doors[k].unlock(); elevator.doors[k].setOpen(true); }, close(k) { elevator.doors[k].setOpen(false); }, closeAll() { for (const d of elevator.doors) d.setOpen(false); } },
    security: {
      hall: P(0, -14, F[1]), monitorRoom: P(-7, -5, F[1]), monitorDoor, monitorsAt: P(-9.8, -5, F[1], -Math.PI / 2), screen: camWall,
      alarmRoom: P(8, -6, F[1]), alarmDoor, lockers: P(-10, 8, F[1]), office: P(7, 8, F[1]),
    },
    alarm, alarmAt: P(12.7, -5, F[1], Math.PI / 2),
    card,
    servers: { hall: P(-8, -14, F[2]), corridor: P(0, -8, F[2], 0), rooms: { A: P(-8, -5, F[2]), B: P(-5, 11, F[2]), C: P(6, -5, F[2]), D: P(5, 11, F[2]) } },
    breach: { door: breachDoor, at: P(1.0, -6.0, F[2], Math.PI / 2), aside: P(1.0, -7.8, F[2], Math.PI / 2), cover: P(-0.8, -9.5, F[2], 0), inside: P(5.5, -5, F[2], Math.PI / 2), threats: [P(0, 16, F[2]), P(-6, 11, F[2]), P(6, 11, F[2])] },
    storage: { hall: P(0, -14, F[3]), aisle: P(0, 0, F[3]), west: P(-16, 1, F[3]), east: P(16, 1, F[3]), office: P(-16, 14, F[3]) },
    trapped: { door: trapDoor, at: P(14.5, 10.6, F[3], 0), inside: P(16, 15, F[3], Math.PI), floor: 3 },
    command: {
      door: commandDoor, doorAt: P(0, -1.2, F[4], 0), reader, readerAt: P(1.7, -1.1, F[4], 0), anteroom: P(0, -6, F[4], 0), hall: P(0, -14, F[4]),
      inside: P(0, 3.5, F[4], 0), desk: P(0, 11.2, F[4], 0), deskAt: P(0, 13, F[4] + 0.8), computer: P(0, 14.4, F[4], Math.PI), shadowAt: P(0.4, 14.9, F[4], Math.PI),
      screen, window: { glass, body: windowBody, at: P(0, 18.8, F[4], 0) }, arena: P(0, 7, F[4]),
      escapeDoor, escapeAt: P(-15.2, 2.0, F[4], -Math.PI / 2), escapeInside: P(-18.2, 2.0, F[4], Math.PI / 2),
      cover: [P(-9.5, 6.2, F[4]), P(9.5, 6.2, F[4]), P(-9, 12.2, F[4]), P(9, 12.2, F[4]), P(-15.5, 16.4, F[4]), P(15.5, 16.4, F[4])],
      guardPost: P(-10, -6, F[4]), archive: P(10, -2.5, F[4]),
    },
    roof: { at: P(18.5, -13.6, ROOF, Math.PI), deck: P(0, 0, ROOF), helipad: P(padAt.lx, padAt.lz, ROOF + 0.15), padR, edge: [P(0, 18.6, ROOF, 0), P(-18.4, 10, ROOF, -Math.PI / 2), P(18.4, 10, ROOF, Math.PI / 2)], hut: P(18.5, -8, ROOF) },
    escape,
    // where a guard stands or walks (every point with its floor's y)
    patrols: {
      gate: [P(-114, 54), P(-114, 64)], booth: [P(-112, 70, 0, Math.PI / 2)], plazaW: [P(-96, 40), P(-96, 86)], plazaMid: [P(-52, 44), P(-26, 76)], plazaE: [P(46, 40), P(80, 72)],
      cars: [P(4, 52), P(32, 60)], entrance: [P(-7, 27), P(7, 27)], southFence: [P(-70, 96.5), P(10, 96.5)],
      lobbyDesk: [P(0, 1.6, 0, 0)], lobbyW: [P(-13.9, -8), P(-13.9, 14)], lobbyE: [P(13, -9), P(13, 14)], lobbyStairs: [P(15.4, 1.6, 0, 0)],
      f1hall: [P(-12, -14, F[1]), P(12, -14, F[1])], f1monitor: [P(-8, -9.5, F[1]), P(-7, 0.4, F[1])], f1alarm: [P(5, -9, F[1]), P(11, -1, F[1])], f1office: [P(4, 6, F[1]), P(13.5, 9, F[1])], f1lockers: [P(-16.5, 4, F[1]), P(-16.5, 18, F[1])],
      f2hall: [P(-12, -14, F[2]), P(5, -14, F[2])], f2east: [P(15.6, -14, F[2]), P(15.6, -3, F[2])], f2corr: [P(0, -8, F[2]), P(0, 16, F[2])], f2A: [P(-12, -5, F[2]), P(-4, -5, F[2])], f2B: [P(-6, 6, F[2]), P(-6, 18, F[2])], f2C: [P(5, -5, F[2]), P(10.5, -5, F[2])], f2D: [P(6, 6, F[2]), P(6, 18, F[2])],
      f3hall: [P(-12, -14, F[3]), P(12, -14, F[3])], f3aisle: [P(0, -8, F[3]), P(0, 10, F[3])], f3west: [P(-16, 1.5, F[3]), P(-16, 10.5, F[3])], f3east: [P(16, 1.5, F[3]), P(10, 10.5, F[3])], f3trap: [P(13, 9.8, F[3], 0)],
      f4hall: [P(-12, -14, F[4]), P(12, -14, F[4])], f4ante: [P(-3.5, -6, F[4]), P(3.5, -6, F[4])], f4guard: [P(-10, -6, F[4])], f4archive: [P(10, -2.5, F[4], 0)], f4cmdW: [P(-13, 8, F[4]), P(-13, 17, F[4])], f4cmdE: [P(13, 8, F[4]), P(13, 17, F[4])], f4desk: [P(2.4, 15.2, F[4], Math.PI)],
      roofE: [P(15, -17, ROOF), P(15, -1, ROOF)], roofW: [P(-13.4, -18, ROOF), P(-13.4, -1, ROOF)], roofPad: [P(-9, 17.5, ROOF), P(9, 17.5, ROOF)], roofDeck: [P(-11, 0, ROOF), P(11, 0, ROOF)],
    },
    doors,
    lamps, emissives,
    inTower: (x, z) => Math.abs(x - C.x) < 20 && Math.abs(z - C.z) < 20,
    onPlaza: (x, z) => x > C.x + PLAZA.x0 && x < C.x + PLAZA.x1 && z > C.z + PLAZA.z0 && z < C.z + PLAZA.z1,
    inCommand: (x, z, yy) => yy > y + F[4] - 0.5 && yy < y + ROOF - 0.5 && Math.abs(x - C.x) < T && z > C.z && z < C.z + T,
    onRoof: (x, z, yy) => yy > y + ROOF - 0.5 && Math.abs(x - C.x) < T && Math.abs(z - C.z) < T,
    tick(camera, dt) {
      clock += dt;
      beacon.set(clock % 1.6 < 0.25 ? '#ff3030' : '#3a0a0a');
      if (alarm.on) alarmLamp.set(clock % 0.7 < 0.35 ? '#ff2a2a' : '#5a0a0a');
    },
  };
}

// ---------- textures and meshes made on canvases here ----------

// the curtain wall: dark glass in a grid of mullions, a storey to each row, some panes lit (the emissive map)
function windowMaterial(y0) {
  const W = 512, H = 512, cols = 8, rows = 4;
  const map = document.createElement('canvas'), emi = document.createElement('canvas');
  map.width = emi.width = W; map.height = emi.height = H;
  const g = map.getContext('2d'), e = emi.getContext('2d');
  g.fillStyle = '#15181d'; g.fillRect(0, 0, W, H);
  e.fillStyle = '#000000'; e.fillRect(0, 0, W, H);
  let seed = 917; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cw = W / cols, rh = H / rows;
  for (let j = 0; j < rows; j++) {
    g.fillStyle = '#23272e'; g.fillRect(0, j * rh + rh * 0.8, W, rh * 0.2);               // the spandrel at each floor
    for (let i = 0; i < cols; i++) {
      const x = i * cw + 4, yy = j * rh + rh * 0.14, w = cw - 8, h = rh * 0.62, lit = r() < 0.3;
      const grd = g.createLinearGradient(x, yy, x + w * 0.6, yy + h);
      grd.addColorStop(0, lit ? '#e2c48a' : '#34465a'); grd.addColorStop(1, lit ? '#a8834a' : '#121a24');
      g.fillStyle = grd; g.fillRect(x, yy, w, h);
      if (lit) { e.fillStyle = `rgb(255, ${196 + Math.floor(r() * 40)}, ${120 + Math.floor(r() * 60)})`; e.fillRect(x, yy, w, h); }
    }
  }
  const tex = (c, color) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 12 / 17.6); t.offset.set(0, -((y0 + 6.0) / 17.6) % 1); t.anisotropy = 4; if (color) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const m = new THREE.MeshStandardMaterial({ map: tex(map, true), emissiveMap: tex(emi, true), emissive: '#ffffff', emissiveIntensity: 0, roughness: 0.32, metalness: 0.45, vertexColors: true });
  m.userData.night = 1.25;
  return m;
}

// the helipad's marking: a ring, an H
function helipadTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = '#e8c547'; g.lineWidth = 22; g.beginPath(); g.arc(256, 256, 226, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#f2f0ea';
  g.fillRect(150, 120, 52, 272); g.fillRect(310, 120, 52, 272); g.fillRect(150, 230, 212, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// a screen drawn on a canvas: show('off' | 'cams' | 'alarm' | 'shadow' | 'data' | 'map', opts); data takes { progress: 0..1 }
function makeScreen(W = 1024, H = 512) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const text = (s, x, yy, size, color = '#d8e6f2', align = 'right') => { g.fillStyle = color; g.font = `bold ${size}px ${SIGN_FONT}`; g.textAlign = align; g.direction = 'rtl'; g.textBaseline = 'middle'; g.fillText(s, x, yy); };
  const bg = (c0, c1) => { const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, c0); grd.addColorStop(1, c1); g.fillStyle = grd; g.fillRect(0, 0, W, H); };
  let seed = 31; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const draw = {
    off() { bg('#07090c', '#020304'); g.fillStyle = 'rgba(255,255,255,0.04)'; g.fillRect(W * 0.1, 0, W * 0.12, H); },
    cams() {
      bg('#05080c', '#05080c');
      const cw = W / 3, ch = H / 3;
      for (let i = 0; i < 9; i++) {
        const x = (i % 3) * cw, yy = Math.floor(i / 3) * ch;
        g.fillStyle = '#0f1a24'; g.fillRect(x + 4, yy + 4, cw - 8, ch - 8);
        g.fillStyle = '#1d2c3a'; for (let k = 0; k < 5; k++) g.fillRect(x + 10 + r() * (cw - 60), yy + ch * 0.45 + r() * ch * 0.35, 20 + r() * 50, 8 + r() * 26);
        g.strokeStyle = '#2b4458'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 6, yy + ch * 0.62); g.lineTo(x + cw - 6, yy + ch * 0.5); g.stroke();
        text(`מצלמה ${String(i + 1).padStart(2, '0')}`, x + cw - 14, yy + 22, 20, '#9fc7e6');
        g.fillStyle = '#ff3a3a'; g.beginPath(); g.arc(x + 22, yy + 22, 7, 0, Math.PI * 2); g.fill();
      }
    },
    alarm() { bg('#3a0606', '#120202'); text('אזעקה', W / 2, H * 0.42, 150, '#ff6a5a', 'center'); text('המגדל השחור · כל הקומות', W / 2, H * 0.72, 46, '#ffd0c8', 'center'); },
    shadow() {
      bg('#0a0c10', '#020203');
      g.fillStyle = '#050506'; g.beginPath(); g.ellipse(W / 2, H * 0.95, 230, 170, 0, Math.PI, 0); g.fill();   // the shoulders
      g.beginPath(); g.ellipse(W / 2, H * 0.42, 110, 140, 0, 0, Math.PI * 2); g.fill();                        // the masked head
      g.fillStyle = '#1a1c22'; g.fillRect(W / 2 - 80, H * 0.36, 160, 30);                                    // the eye slit
      g.fillStyle = '#c9d2dc'; for (const sx of [-34, 34]) { g.beginPath(); g.ellipse(W / 2 + sx, H * 0.36 + 15, 12, 7, 0, 0, Math.PI * 2); g.fill(); }
      text('הצל', W - 40, 48, 40, '#ff9180');
    },
    data({ progress = null } = {}) {
      bg('#06121c', '#030a10');
      text('תיקיית מבצע · הצל', W - 40, 54, 44, '#ff9180');
      const rows = ['מצלמות מעקב חיצוניות — 214 הקלטות', 'גיבויים מהבסיסים הישנים של קוצי — 37 תיקיות', 'מפת בסיסים — 5 נקודות', 'רשימת יעדים — מוצפן'];
      rows.forEach((s, i) => { g.fillStyle = 'rgba(89,199,255,0.08)'; g.fillRect(40, 104 + i * 68, W - 80, 54); text(s, W - 60, 131 + i * 68, 32, '#cfe6f5'); });
      if (progress != null) { g.strokeStyle = '#59c7ff'; g.lineWidth = 4; g.strokeRect(60, H - 70, W - 120, 34); g.fillStyle = '#59c7ff'; g.fillRect(W - 62 - (W - 124) * progress, H - 68, (W - 124) * progress, 30); text(`מעתיק · ${Math.round(progress * 100)}%`, W - 60, H - 96, 26, '#cfe6f5'); }
    },
    map() {
      bg('#0b1620', '#060c12');
      g.strokeStyle = 'rgba(89,199,255,0.12)'; g.lineWidth = 1; for (let x = 0; x < W; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let yy = 0; yy < H; yy += 64) { g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy); g.stroke(); }
      g.strokeStyle = '#3d6c8a'; g.lineWidth = 6; g.beginPath(); g.moveTo(90, 0); g.bezierCurveTo(140, 160, 70, 300, 120, H); g.stroke();       // the coast
      for (const [x, yy, s] of [[300, 140, 'בסיס 1'], [520, 260, 'בסיס 2'], [700, 120, 'בסיס 3'], [820, 360, 'בסיס 4'], [420, 400, 'בסיס 5']]) { g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(x, yy, 14, 0, Math.PI * 2); g.fill(); text(s, x - 22, yy, 26, '#ffd0c8'); }
      text('הבסיסים של המסדר', W - 40, 44, 36, '#ff9180');
    },
  };
  const scr = {
    canvas, tex, mat, mode: null, key: null,
    show(mode, opts = {}) {
      const key = `${mode}:${opts.progress == null ? '' : Math.round(opts.progress * 100)}`;
      if (key === scr.key) return;
      scr.key = key; scr.mode = mode; seed = 31;
      (draw[mode] || draw.off)(opts); tex.needsUpdate = true;
    },
  };
  scr.show('off');
  return scr;
}

// chevrons on the floor along the flat legs of a route (stairs are left out): one mesh, hidden until marked
function routeMarks(points) {
  const shape = new THREE.Shape([[0, 0.34], [0.38, -0.12], [0.18, -0.12], [0, 0.1], [-0.18, -0.12], [-0.38, -0.12]].map(([a, b]) => new THREE.Vector2(a, b)));
  const base = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), parts = [], m = new THREE.Matrix4();
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1];
    if (Math.abs(a.y - b.y) > 0.1) continue;
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), yaw = Math.atan2(-dx, -dz);
    for (let s = 0.8; s < len - 0.4; s += 1.8) { const g = base.clone(); m.makeRotationY(yaw).setPosition(a.x + dx * s / len, a.y + 0.05, a.z + dz * s / len); g.applyMatrix4(m); parts.push(g); }
  }
  const mesh = new THREE.Mesh(parts.length ? mergeGeometries(parts) : base, new THREE.MeshBasicMaterial({ color: '#39ff7a', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  for (const g of parts) g.dispose();
  mesh.renderOrder = 2;
  return mesh;
}
