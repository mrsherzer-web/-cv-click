// The citadel's central tower (chapter ten): המגדל המרכזי, built as its own group (nothing of it is in the
// site's merged batch), so that the end can bring it down. Four real storeys inside outer walls 80 × 72 m:
// the main hall on the ground (האולם המרכזי: the giant screen, the hall's defence system and its three control
// nodes, pillars, low cover, the first-aid box), the energy hall (אולם האנרגיה: the conduit, energy cells that
// blow, cover), the machine room (חדר המכונה: the energy source and Muller's console in a chamber with three
// doorways, a corridor round it) and the last hall (האולם האחרון, 79 × 71 m and 15 m high: the portal engine,
// three shield generators, cover, rift spots). Stairs join the main hall to the energy hall and the machine
// room to the last hall; between the energy hall and the machine room there is no way inside: the upper door
// is reached by the tower bridge. On the south face the fire stairs come down from the last hall's emergency
// door to the bridges. destroy() sinks the whole group under smoke and leaves a ruin; restore() puts it back.
// Coordinates are the citadel's site-local ones (origin at the citadel's centre, +z south). Invented.
import * as THREE from 'three';
import { makeSite } from './compound.js';
import { Batch, mat4 } from './batch.js';
import { tint } from './materials.js';
import { recording, tools, fittings, cutRects, makeScreen, slitMaterial, signsMesh } from './citadel-kit.js';

export const TF = [0, 7, 14, 21];           // the main hall, the energy hall, the machine room, the last hall
export const T_ROOF = 36;
export const T_NAMES = ['האולם המרכזי', 'אולם האנרגיה', 'חדר המכונה', 'האולם האחרון'];
const X0 = 32, X1 = 112, Z0 = -36, Z1 = 36, TOP = 37.4, SINK = 82, FALL = 10;
const IN = { x0: X0 + 0.5, x1: X1 - 0.5, z0: Z0 + 0.5, z1: Z1 - 0.5 };

export function buildCentralTower(ctx, C, y) {
  const { M } = ctx;
  const rec = recording(ctx);
  // the tower hangs in a pivot at the middle of its foot, so the whole of it can sink and lean when it falls
  const mid = { x: C.x + (X0 + X1) / 2, z: C.z + (Z0 + Z1) / 2 };
  const outer = new THREE.Group(); outer.name = 'citadel tower'; outer.position.set(mid.x, y, mid.z); ctx.group.add(outer);
  const inner = new THREE.Group(); inner.position.set(-mid.x, -y, -mid.z); outer.add(inner);
  const S = makeSite({ ...rec.ctx, group: inner }, { cx: C.x, cz: C.z, y, name: 'citadel tower parts' });
  const { batch, box, at, toWorld, wall, slab, level, group } = S;
  const K = tools(S, rec.ctx), { piece, geo, thing, holedWall, rail, flight } = K;
  const fit = fittings(group, S, rec.ctx.cols, { doors: 8, lights: 96 });
  const F = TF;
  const P = (lx, lz, ly = 0, yaw) => ({ ...toWorld(lx, lz), y: y + ly, ...(yaw != null ? { yaw } : {}) });
  const P3 = (lx, ly, lz) => ({ ...toWorld(lx, lz), y: y + ly });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const win = slitMaterial(733, 0.26); S.emissives.push(win);
  const signs = [], signAt = (text, lx, ly, lz, yaw, w, h, o = {}) => signs.push({ text, lx, ly, lz, yaw, w, h, ...o });
  const lampAt = (lx, ly, lz, range = 26, intensity = 46, color) => S.lamps.push({ ...toWorld(lx, lz), y: y + ly, inside: true, range, intensity, ...(color ? { color } : {}) });
  const WALL = '#3b3f47', DARK = '#23262b', VIOLET = '#8a5cff';

  // ---------- the shell: outer walls with their doors cut out, the slit-window skin, ribs, the parapet ----------
  const westHoles = [{ a0: 33, a1: 39, y0: 0, y1: 4.5 }, { a0: 10.8, a1: 13.2, y0: F[1], y1: F[1] + 2.6 }, { a0: 2.8, a1: 5.2, y0: F[2], y1: F[2] + 2.6 }];
  const southHoles = [{ a0: 51, a1: 53, y0: F[3], y1: F[3] + 2.4 }];
  const shell = { t: 1, color: '#8a8f98', scale: 0.2 };   // what shows of it is the inside: the outside wears the skin
  holedWall(X0, Z0, X0, Z1, TOP, westHoles, shell); holedWall(X0, Z1, X1, Z1, TOP, southHoles, shell);
  holedWall(X1, Z1, X1, Z0, TOP, [], shell); holedWall(X1, Z0, X0, Z0, TOP, [], shell);
  const skin = (x0, z0, x1, z1, holes, yaw) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, ox = Math.sin(yaw) * 0.52, oz = Math.cos(yaw) * 0.52;
    for (const r of cutRects({ x0: 0, x1: len, z0: 0, z1: TOP }, holes.map((o) => ({ x0: o.a0, x1: o.a1, z0: o.y0, z1: o.y1 })))) {
      const a = (r.x0 + r.x1) / 2;
      batch.add('win', win, new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0), at(x0 + ux * a + ox, (r.z0 + r.z1) / 2, z0 + uz * a + oz, yaw), { uv: 'world', uvScale: 1 / 12 });
    }
  };
  skin(X0, Z0, X0, Z1, westHoles, -Math.PI / 2); skin(X0, Z1, X1, Z1, southHoles, 0); skin(X1, Z1, X1, Z0, [], Math.PI / 2); skin(X1, Z0, X0, Z0, [], Math.PI);
  // ribs up the faces, each with a strip of the engine's light
  const rib = (lx, lz, alongX) => {
    piece('plaster', M.plaster, alongX ? 1.8 : 1.0, TOP + 1.6, alongX ? 1.0 : 1.8, lx, (TOP + 1.6) / 2, lz, { color: DARK, scale: 0.2 });
    piece('glow', glow, alongX ? 0.3 : 0.06, TOP - 6, alongX ? 0.06 : 0.3, lx + (alongX ? 0 : Math.sign(lx - 72) * 0.52), TOP / 2 + 1, lz + (alongX ? Math.sign(lz) * 0.52 : 0), { color: VIOLET, uv: 'keep' });
  };
  for (const lz of [-36, -12, 12, 36]) { rib(X0 - 0.7, lz, false); rib(X1 + 0.7, lz, false); }
  for (const lx of [48, 64, 80, 96]) rib(lx, Z0 - 0.7, true);
  for (const lx of [96]) rib(lx, Z1 + 0.7, true);
  for (let lx = X0 + 2; lx < X1; lx += 4) for (const lz of [Z0, Z1]) piece('plaster', M.plaster, 2, 1.3, 1.2, lx, TOP + 0.65, lz, { color: DARK, scale: 0.2 });
  for (let lz = Z0 + 2; lz < Z1; lz += 4) for (const lx of [X0, X1]) piece('plaster', M.plaster, 1.2, 1.3, 2, lx, TOP + 0.65, lz, { color: DARK, scale: 0.2 });
  slab(72, T_ROOF + 0.2, 0, 80, 0.4, 72, { color: '#2b2e33' });
  // over the roof: four corner turrets, the spire with its crown, a mast and the red light on it
  for (const [lx, lz] of [[38, -30], [106, -30], [38, 30], [106, 30]]) { piece('win', win, 8, 9, 8, lx, T_ROOF + 4.5, lz, { scale: 1 / 12 }); piece('plaster', M.plaster, 9, 0.8, 9, lx, T_ROOF + 9.4, lz, { color: DARK }); }
  piece('win', win, 32, 26, 32, 72, T_ROOF + 13, 0, { scale: 1 / 12 });
  piece('plaster', M.plaster, 34, 1.6, 34, 72, T_ROOF + 26.8, 0, { color: '#16181c' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) piece('plaster', M.plaster, 3, 5, 3, 72 + sx * 15, T_ROOF + 30, sz * 15, { color: '#16181c' });
  geo('metal', M.metal, new THREE.CylinderGeometry(0.2, 0.45, 13, 8), 72, T_ROOF + 34, 0, 0, '#3a3d44');
  const beacons = [fit.indicator(72, T_ROOF + 41, 0, 0.55, '#ff3030'), ...[[38, -30], [106, -30], [38, 30], [106, 30]].map(([lx, lz]) => fit.indicator(lx, T_ROOF + 10.4, lz, 0.3, '#ff3030'))];
  piece('glow', glow, 0.4, 20, 0.4, 72, T_ROOF + 13, -16.3, { color: VIOLET, uv: 'keep' }); piece('glow', glow, 0.4, 20, 0.4, 72, T_ROOF + 13, 16.3, { color: VIOLET, uv: 'keep' });
  piece('glow', glow, 0.4, 20, 0.4, 55.7, T_ROOF + 13, 0, { color: VIOLET, uv: 'keep' }); piece('glow', glow, 0.4, 20, 0.4, 88.3, T_ROOF + 13, 0, { color: VIOLET, uv: 'keep' });

  // ---------- the storeys: slabs with the stairs' holes, the two flights ----------
  const HOLE1 = { x0: 91.4, x1: 104, z0: -35.5, z1: -31.9 }, HOLE3 = { x0: 91.4, x1: 104, z0: 31.9, z1: 35.5 };
  const FLOOR_COL = ['#8f9298', '#858a93', '#7a7e86', '#70737a'];
  [null, [HOLE1], [], [HOLE3]].forEach((holes, k) => {
    if (!holes) return;
    for (const r of cutRects(IN, holes)) level((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, F[k], { key: 'stone', mat: M.stone, color: FLOOR_COL[k], name: `citadel tower ${k}`, scale: 0.25, thick: 0.3 });
  });
  slab(72, 0.015, 0, 79, 0.03, 71, { key: 'stone', mat: M.stone, color: FLOOR_COL[0], scale: 0.25 });
  const stairs = [
    flight(104, -33.7, -Math.PI / 2, { rise: 7, run: 12.6, steps: 20, floor: F[0], enclose: true, name: 'citadel tower stairs' }),   // the main hall up to the energy hall
    flight(91.4, 33.7, Math.PI / 2, { rise: 7, run: 12.6, steps: 20, floor: F[2], enclose: true, name: 'citadel tower stairs' }),   // the machine room up to the last hall
  ];
  // the doorways through the outer wall's thickness: a sill to walk on in each
  level(X0, -24, 0.62, 1.2, F[1], { key: 'stone', mat: M.stone, color: FLOOR_COL[1], name: 'citadel tower sill', thick: 0.3 });
  level(X0, -32, 0.62, 1.2, F[2], { key: 'stone', mat: M.stone, color: FLOOR_COL[2], name: 'citadel tower sill', thick: 0.3 });
  level(84, Z1, 1.0, 0.62, F[3], { key: 'stone', mat: M.stone, color: FLOOR_COL[3], name: 'citadel tower sill', thick: 0.3 });
  rail(104.1, -35.5, 104.1, -31.9, F[1]); rail(91.4, -32.1, 104.1, -32.1, F[1]);      // round the hole in the energy hall's floor
  rail(91.3, 31.9, 91.3, 35.5, F[3]); rail(91.3, 32.1, 104, 32.1, F[3]);              // round the hole in the last hall's floor
  // two lamps on every storey, in the same two places (whichever floor the player is on, its own are nearest)
  for (let k = 0; k < 4; k++) for (const lx of [52, 92]) lampAt(lx, F[k] + (k === 3 ? 9 : 6), 0, k === 3 ? 44 : 34, k === 3 ? 80 : 54, k === 3 ? '#d9c8ff' : '#e6ecff');
  const panels = (k, list, h = 6.62, color = '#e9e2ff') => { for (const [lx, lz] of list) piece('glow', glow, 3, 0.05, 0.5, lx, F[k] + h, lz, { color, uv: 'keep' }); };

  // ---------- the main hall (the ground) ----------
  const mainDoor = fit.door(X0, 0, Math.PI / 2, 6, { h: 4.5, mode: 'lift', color: '#23262b', locked: true, label: 'שער המגדל', t: 0.4 });
  for (const sz of [-3.3, 3.3]) piece('plaster', M.plaster, 1.6, 5.4, 0.8, X0 - 0.6, 2.7, sz, { color: DARK });
  piece('plaster', M.plaster, 1.6, 0.9, 7.4, X0 - 0.6, 5.0, 0, { color: DARK });
  signAt('המגדל המרכזי', X0 - 1.42, 5.0, 0, -Math.PI / 2, 5.6, 0.7, { bg: '#0d0f12', fg: '#c9a8ff' });
  const screen = makeScreen();
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 6.0), screen.mat);
  screenMesh.position.set(C.x + IN.x1 - 0.12, y + 3.9, C.z); screenMesh.rotation.y = -Math.PI / 2; group.add(screenMesh);
  piece('paint', M.paint, 0.1, 6.5, 30.6, IN.x1 - 0.05, 3.9, 0, { color: '#0c0d10', uv: 'keep' });
  const pillars = [];
  for (const lx of [48, 64, 80, 96]) for (const lz of [-14, 14]) { thing(lx, lz, 1.4, 6.7, 1.4, 0, '#2b2e33', { key: 'stone', mat: M.stone }); pillars.push({ ...P(lx, lz), holdAt: P(lx - 1.3, lz, 0, Math.PI / 2) }); }
  const lowCover = [];
  for (const [lx, lz] of [[42, -9], [42, 9], [56, -22], [56, 0], [56, 22], [72, -8], [72, 8], [72, -26], [72, 26], [88, -22], [88, 0], [88, 22], [100, -9], [100, 9]]) { thing(lx, lz, 0.7, 0.9, 3, 0, '#6b6f75', { key: 'stone', mat: M.stone }); lowCover.push({ ...P(lx, lz), behind: P(lx - 1.0, lz, 0, Math.PI / 2) }); }
  // the hall's defence system: emitters in the ceiling and on the walls, three control nodes on the floor
  const emitters = [[52, 6.4, -18], [52, 6.4, 18], [72, 6.4, 0], [92, 6.4, -18], [92, 6.4, 18], [72, 4.2, -35.2], [72, 4.2, 35.2]].map(([lx, ly, lz], i) => {
    piece('paint', M.paint, 0.9, 0.5, 0.9, lx, ly + (i < 5 ? 0.25 : 0), lz + (i === 5 ? -0.1 : i === 6 ? 0.1 : 0), { color: '#15171a', uv: 'keep' });
    const lamp = fit.indicator(lx, ly - (i < 5 ? 0.1 : 0), lz + (i === 5 ? 0.3 : i === 6 ? -0.3 : 0), 0.22, '#3a2a66');
    return { ...P3(lx, ly, lz), lamp, kind: i < 5 ? 'ceiling' : 'wall', set(c) { lamp.set(c); } };
  });
  const nodes = [[44, -29], [106, -24], [74, 31]].map(([lx, lz], i) => {
    thing(lx, lz, 0.9, 1.5, 0.9, 0, '#1c1f26', { key: 'metal', mat: M.metal, cover: false });
    const lamp = fit.indicator(lx, 1.72, lz, 0.24, VIOLET);
    const dx = 72 - lx, dz = -lz, dl = Math.hypot(dx, dz);
    const n = { i, ...P3(lx, 1.5, lz), at: P(lx + dx / dl * 1.5, lz + dz / dl * 1.5, 0, Math.atan2(-dx, -dz)), live: true, lamp, set(live) { n.live = live; lamp.set(live ? VIOLET : '#1a1a1e'); } };
    return n;
  });
  // the first-aid box on the south wall
  piece('paint', M.paint, 0.7, 0.55, 0.2, 58, 1.5, IN.z1 - 0.1, { color: '#e9ecef', uv: 'keep' });
  piece('glow', glow, 0.34, 0.1, 0.02, 58, 1.5, IN.z1 - 0.21, { color: '#2fd27a', uv: 'keep' }); piece('glow', glow, 0.1, 0.34, 0.02, 58, 1.5, IN.z1 - 0.21, { color: '#2fd27a', uv: 'keep' });
  signAt('עזרה ראשונה', 58, 2.2, IN.z1 - 0.02, Math.PI, 1.4, 0.3, { bg: '#0f5a2c', fg: '#ffffff' });
  signAt(T_NAMES[0], 37, 5.4, IN.z0 + 0.02, 0, 3.4, 0.5); signAt('מדרגות · אולם האנרגיה', 107.5, 3.2, IN.z0 + 0.02, 0, 3.6, 0.44);
  panels(0, [[44, 0], [60, -18], [60, 18], [84, -18], [84, 18], [100, 0], [72, 0]]);
  for (const lz of [-30, -18, 18, 30]) piece('glow', glow, 0.05, 5, 0.3, IN.x1 - 0.05, 3.4, lz, { color: VIOLET, uv: 'keep' });

  // ---------- the energy hall (floor 1) ----------
  const f1 = F[1];
  const hallDoor = fit.door(X0, -24, Math.PI / 2, 2.4, { floor: f1, h: 2.6, mode: 'slide', color: '#30343b', label: 'אולם האנרגיה' });
  geo('glow', glow, new THREE.CylinderGeometry(2.2, 2.2, 6.7, 20), 72, f1 + 3.35, 0, 0, '#7c4dff'); K.roundAt(72, 0, 2.35, f1, 6.6);
  for (const ly of [0.25, 3.3, 6.4]) geo('metal', M.metal, new THREE.CylinderGeometry(2.7, 2.7, 0.5, 20), 72, f1 + ly, 0, 0, '#22252a');
  const cellIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 0.7, 1.8, 14), new THREE.MeshBasicMaterial(), 8);
  cellIM.frustumCulled = false; group.add(cellIM);
  const cm = new THREE.Matrix4(), cc = new THREE.Color();
  const cells = [[46, -10], [46, 12], [58, 26], [58, -28], [84, -27], [84, 26], [100, -12], [100, 12]].map(([lx, lz], i) => {
    K.roundAt(lx, lz, 0.75, f1, 1.8); piece('paint', M.paint, 1.7, 0.12, 1.7, lx, f1 + 0.06, lz, { color: '#15171a', uv: 'keep' });
    cellIM.setMatrixAt(i, cm.makeTranslation(C.x + lx, y + f1 + 0.95, C.z + lz));
    const c = { i, ...P(lx, lz, f1), at: P3(lx, f1 + 1, lz), blown: false,
      blow() { c.blown = true; cellIM.setColorAt(i, cc.set('#141414')); cellIM.instanceColor.needsUpdate = true; },
      reset() { c.blown = false; cellIM.setColorAt(i, cc.set('#5cc8ff')); cellIM.instanceColor.needsUpdate = true; } };
    c.reset(); S.cover.push({ ...toWorld(lx, lz), y: y + f1, w: 1.4, d: 1.4 });
    return c;
  });
  for (const [lx, lz] of [[40, 0], [52, -20], [52, 20], [64, -8], [64, 8], [80, -8], [80, 8], [92, -20], [92, 20], [104, 0]]) thing(lx, lz, 1.0, 1.2, 4, f1, '#4a4e55', { key: 'metal', mat: M.metal });
  for (const lx of [58, 86]) for (const lz of [-14, 14]) thing(lx, lz, 1.2, 6.7, 1.2, f1, '#2b2e33', { key: 'stone', mat: M.stone });
  for (const [lx, lz] of [[70, -24], [70, 24], [96, 0], [44, -27]]) thing(lx, lz, 1.6, 1.3, 1.6, f1, '#5a4a3a');
  for (const [lx, lz] of [[38, 30], [106, 30], [38, -33]]) { thing(lx, lz, 2, 3, 2, f1, '#2a2d33', { key: 'metal', mat: M.metal }); piece('glow', glow, 1.2, 0.2, 0.04, lx, f1 + 2.2, lz - 1.02, { color: '#5cc8ff', uv: 'keep' }); }
  signAt(T_NAMES[1], 62, f1 + 5.4, IN.z0 + 0.02, 0, 3.4, 0.5, { fg: '#9fdcff' }); signAt('גשר · חדר בקרה ב', X0 + 0.52, f1 + 3.05, -24, Math.PI / 2, 2.6, 0.36);
  panels(1, [[44, -12], [44, 12], [60, -24], [60, 24], [84, -24], [84, 24], [100, -12], [100, 12]], 6.62, '#cfe9ff');

  // ---------- the machine room (floor 2): a chamber with three doorways, a corridor round it ----------
  const f2 = F[2], cw = { h: 6.7, t: 0.4, floor: f2, color: '#6b707a' };
  const upperDoor = fit.door(X0, -32, Math.PI / 2, 2.4, { floor: f2, h: 2.6, mode: 'slide', color: '#30343b', label: 'הדלת העליונה' });
  wall(52, -20, 92, -20, [{ at: 20, w: 4, h: 3 }], cw); wall(52, 20, 92, 20, [{ at: 20, w: 4, h: 3 }], cw);
  wall(52, -20, 52, 20, [{ at: 20, w: 4, h: 3 }], cw); wall(92, -20, 92, 20, [], cw);
  geo('glow', glow, new THREE.CylinderGeometry(2.6, 2.6, 6.7, 22), 82, f2 + 3.35, 0, 0, '#b48cff'); K.roundAt(82, 0, 2.75, f2, 6.6);
  for (const ly of [0.3, 6.35]) geo('metal', M.metal, new THREE.CylinderGeometry(3.3, 3.3, 0.6, 22), 82, f2 + ly, 0, 0, '#1c1f24');
  for (const a of [0.8, 2.4, 3.9, 5.5]) piece('metal', M.metal, 0.5, 6.7, 0.5, 82 + Math.cos(a) * 3.2, f2 + 3.35, Math.sin(a) * 3.2, { color: '#22252a' });
  thing(70, 0, 1.0, 1.0, 3.2, f2, '#16181c');                                                       // Muller's console
  for (const lz of [-1, 0, 1]) piece('glow', glow, 0.05, 0.5, 0.8, 69.9, f2 + 1.35, lz, { color: '#59c7ff', uv: 'keep' });
  for (const [lx, lz, w, d] of [[58, -3.6, 0.7, 2.4], [58, 3.6, 0.7, 2.4], [68.4, -14, 2.4, 0.7], [75.6, -14, 2.4, 0.7], [68.4, 14, 2.4, 0.7], [75.6, 14, 2.4, 0.7]]) thing(lx, lz, w, 0.95, d, f2, '#6b6f75', { key: 'stone', mat: M.stone });
  for (const [lx, lz] of [[35, 12], [35, -12], [108, -28], [108, 28], [60, 30], [84, -30]]) thing(lx, lz, 1.6, 1.3, 1.6, f2, '#5a4a3a');
  for (const [lx, lz] of [[40, -34.6], [100, -34.6], [40, 34.6]]) thing(lx, lz, 5, 2.6, 0.9, f2, '#2a2d33', { key: 'metal', mat: M.metal });
  signAt(T_NAMES[2], 51.78, f2 + 3.6, 0, -Math.PI / 2, 2.8, 0.44, { fg: '#c9a8ff' }); signAt(T_NAMES[2], 72, f2 + 3.6, -20.22, Math.PI, 2.8, 0.44, { fg: '#c9a8ff' }); signAt(T_NAMES[2], 72, f2 + 3.6, 20.22, 0, 2.8, 0.44, { fg: '#c9a8ff' });
  signAt('מדרגות · האולם האחרון', 86, f2 + 3.2, IN.z1 - 0.02, Math.PI, 3.6, 0.44);
  panels(2, [[42, -20], [42, 20], [62, -28], [62, 28], [100, -20], [100, 20], [62, 0], [72, -10], [72, 10]], 6.62, '#e9e2ff');

  // ---------- the last hall (floor 3, 15 m high): the portal engine, three shield generators ----------
  const f3 = F[3];
  geo('metal', M.metal, new THREE.TorusGeometry(6.5, 0.85, 10, 30).rotateY(Math.PI / 2), 104, f3 + 7.6, 0, 0, '#22242a');
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; piece('glow', glow, 0.2, 0.5, 0.5, 103.1, f3 + 7.6 + Math.sin(a) * 6.5, Math.cos(a) * 6.5, { color: VIOLET, uv: 'keep' }); }
  for (const lz of [-6.6, 6.6]) piece('metal', M.metal, 3.2, 5, 2.4, 105, f3 + 2.5, lz, { color: '#1c1f24' });
  piece('metal', M.metal, 3.4, 1.2, 16, 105.2, f3 + 0.6, 0, { color: '#16181c' });
  for (const lz of [-10, 10]) piece('metal', M.metal, 0.8, 0.8, 0.8, 108, f3 + 11, lz, { color: '#22242a' });
  K.blockAt(105.2, 0, 1.7, 8, f3, 14);
  const membrane = new THREE.Mesh(new THREE.CircleGeometry(5.7, 36), new THREE.MeshBasicMaterial({ color: '#7c4dff', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  membrane.position.set(C.x + 103.9, y + f3 + 7.6, C.z); membrane.rotation.y = -Math.PI / 2; membrane.renderOrder = 3; group.add(membrane);
  const engine = { ...P3(104, f3 + 7.6, 0), r: 6.5, mode: 'idle', membrane,
    // 'off' | 'idle' | 'on' | 'overload' | 'dead': how the gate in the ring looks
    set(mode) { engine.mode = mode; const o = { off: 0, idle: 0.3, on: 0.75, overload: 0.95, dead: 0 }[mode] ?? 0.3; membrane.visible = o > 0; membrane.material.opacity = o; membrane.material.color.set(mode === 'overload' ? '#ffd0f0' : mode === 'on' ? '#9b7bff' : '#7c4dff'); } };
  engine.set('idle');
  const genLamp = (lx, ly, lz) => fit.indicator(lx, ly, lz, 0.5, VIOLET);
  const mkGen = (i, kind, lx, lz, ly, extra) => { const lamp = genLamp(lx, f3 + ly, lz); const gen = { i, kind, ...P3(lx, f3 + ly, lz), live: true, lamp, set(live) { gen.live = live; lamp.set(live ? VIOLET : '#1a1a1e'); }, ...extra }; return gen; };
  // one in the open (to be shot), one in a cage on the north wall (switched off at its console), one inside a
  // ring of conductor rods (overloaded by a bolt lured into it)
  thing(50, -24, 1.6, 5, 1.6, f3, '#2a2d33', { key: 'metal', mat: M.metal }); for (const ly of [1.2, 2.4, 3.6]) piece('glow', glow, 1.7, 0.12, 1.7, 50, f3 + ly, -24, { color: VIOLET, uv: 'keep' });
  thing(72, -33.7, 3, 4, 2, f3, '#2a2d33', { key: 'metal', mat: M.metal, cover: false });
  for (let lx = 68.6; lx <= 75.5; lx += 0.45) piece('paint', M.paint, 0.08, 4.4, 0.08, lx, f3 + 2.2, -32.1, { color: '#15171a', uv: 'keep' });
  K.blockAt(72, -32.1, 3.6, 0.1, f3, 4.4);
  thing(72, -27, 2.4, 1.0, 0.9, f3, '#16181c'); piece('glow', glow, 1.6, 0.4, 0.05, 72, f3 + 1.3, -27.3, { color: '#59c7ff', uv: 'keep' });
  thing(58, 24, 1.8, 3, 1.8, f3, '#2a2d33', { key: 'metal', mat: M.metal });
  for (const [dx, dz] of [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]]) { geo('metal', M.metal, new THREE.CylinderGeometry(0.1, 0.14, 6, 8), 58 + dx, f3 + 3, 24 + dz, 0, '#8a8f96'); K.roundAt(58 + dx, 24 + dz, 0.16, f3, 6); piece('glow', glow, 0.3, 0.3, 0.3, 58 + dx, f3 + 6.1, 24 + dz, { color: '#59c7ff', uv: 'keep' }); }
  const generators = [
    mkGen(0, 'shoot', 50, -24, 5.5, { at: P(50, -24, f3), from: P(58, -16, f3) }),
    mkGen(1, 'console', 72, -33.7, 4.5, { at: P(72, -33.7, f3), console: P3(72, f3 + 1.2, -27), consoleAt: P(72, -25.8, f3, Math.PI) }),
    mkGen(2, 'overload', 58, 24, 3.5, { at: P(58, 24, f3), lureAt: P(58, 13, f3, 0), rods: [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4]].map(([dx, dz]) => P3(58 + dx, f3 + 6.1, 24 + dz)) }),
  ];
  for (const lx of [46, 66, 86]) for (const lz of [-16, 16]) thing(lx, lz, 1.6, 15, 1.6, f3, '#2b2e33', { key: 'stone', mat: M.stone });
  const lastCover = [];
  for (const [lx, lz] of [[40, -6], [40, 6], [54, 0], [60, -10], [60, 8], [82, -24], [82, 24], [80, -6], [80, 6], [92, -14], [92, 14], [96, 28]]) { thing(lx, lz, 0.8, 1.0, 3.2, f3, '#6b6f75', { key: 'stone', mat: M.stone }); lastCover.push(P(lx, lz, f3)); }
  for (const [lx, lz] of [[38, -30], [38, 30], [108, -30]]) thing(lx, lz, 2, 2.4, 2, f3, '#3a3f47', { key: 'metal', mat: M.metal });
  for (const lx of [40, 52, 64, 80, 92, 104]) for (const lz of [IN.z0 + 0.05, IN.z1 - 0.05]) piece('glow', glow, 0.3, 11, 0.05, lx, f3 + 7, lz, { color: VIOLET, uv: 'keep' });
  panels(3, [[44, -18], [44, 18], [60, 0], [76, -18], [76, 18], [92, 0]], 14.62, '#e9e2ff');
  signAt(T_NAMES[3], 60, f3 + 6, IN.z0 + 0.02, 0, 4.6, 0.7, { fg: '#c9a8ff' }); signAt('מנוע הפורטלים', IN.x1 - 0.02, f3 + 1.6, 12, -Math.PI / 2, 3.4, 0.5, { fg: '#c9a8ff' });
  // the emergency door in the south wall and its switch
  const exitDoor = fit.door(84, Z1, 0, 2, { floor: f3, h: 2.4, mode: 'slide', color: '#8a1f1f', locked: true, label: 'יציאת חירום' });
  piece('paint', M.paint, 0.5, 0.7, 0.12, 87.5, f3 + 1.4, IN.z1 - 0.06, { color: '#2a2d33', uv: 'keep' });
  const exitLamp = fit.indicator(87.5, f3 + 1.9, IN.z1 - 0.16, 0.07, '#ff2a2a');
  signAt('יציאת חירום', 84, f3 + 2.85, IN.z1 - 0.02, Math.PI, 2.2, 0.36, { bg: '#5a1d1d', fg: '#ffffff' });

  // ---------- the fire stairs on the south face: the gallery at the emergency door, two flights, two landings ----------
  const steel = { key: 'metal', mat: M.metal, color: '#4a4f57', name: 'citadel fire stairs', thick: 0.2, scale: 0.5 };
  level(83, 38.25, 3, 1.75, f3, steel); level(65.2, 38.25, 2.2, 1.75, f2, steel); level(47.2, 38.25, 3.2, 1.75, f1, steel);
  const fire = [
    flight(50.4, 38.25, Math.PI / 2, { rise: 7, run: 12.6, steps: 20, floor: f1, thin: true, enclose: true, name: 'citadel fire stairs' }),
    flight(67.4, 38.25, Math.PI / 2, { rise: 7, run: 12.6, steps: 20, floor: f2, thin: true, enclose: true, name: 'citadel fire stairs' }),
  ];
  rail(80, 40, 86, 40, f3); rail(86, 36.5, 86, 40, f3); rail(63, 40, 67.4, 40, f2); rail(44, 40, 50.4, 40, f1);
  for (const [lx, top] of [[85.6, f3], [80.4, f3], [67, f2], [63.4, f2], [50, f1], [44.4, f1]]) piece('metal', M.metal, 0.3, top - 0.2, 0.3, lx, (top - 0.2) / 2, 39.6, { color: '#33373e' });

  signsMesh(S, signs, 'citadel-tower-signs');
  S.finish();
  for (const d of [hallDoor, upperDoor]) d.lock();   // every way into the tower is shut until a mission opens it

  // ---------- the ruin the fall leaves: stumps of the walls, mounds of rubble, beams, fires, smoke ----------
  const ruin = new THREE.Group(); ruin.name = 'citadel ruin'; ruin.visible = false; ctx.group.add(ruin);
  const ruinRec = recording(ctx), rb = new Batch();
  let seed = 9173; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const wx = (lx) => C.x + lx, wz = (lz) => C.z + lz;
  rb.add('stone', M.stone, box(84, 0.06, 76), mat4(wx(72), y + 0.05, wz(0)), { color: tint('#1b1a19'), uv: 'world', uvScale: 0.2 });
  const stumps = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let s = 0; s < len;) {
      const l = Math.min(len - s, 4 + rnd() * 6), h = 1.2 + rnd() * rnd() * 9, gap = rnd() < 0.24;
      if (!gap) {
        const mx = x0 + ux * (s + l / 2), mz = z0 + uz * (s + l / 2);
        rb.add('plaster', M.plaster, box(1, h, l), mat4(wx(mx), y + h / 2, wz(mz), yaw, 1, 1, 1, 0, (rnd() - 0.5) * 0.12), { color: tint(rnd() < 0.5 ? '#2e3036' : '#3b3f47'), uv: 'world', uvScale: 0.2 });
        ruinRec.ctx.cols.addSegment(wx(x0 + ux * s), wz(z0 + uz * s), wx(x0 + ux * (s + l)), wz(z0 + uz * (s + l)), 1, y - 1, y + h);
      }
      s += l;
    }
  };
  stumps(X0, Z0, X0, Z1); stumps(X0, Z1, X1, Z1); stumps(X1, Z1, X1, Z0); stumps(X1, Z0, X0, Z0);
  const lump = new THREE.IcosahedronGeometry(1, 1), fires = [];
  // what is left standing of the four corners
  for (const [cx0, cz0, dx, dz] of [[X0, Z0, 1, 1], [X1, Z0, -1, 1], [X0, Z1, 1, -1], [X1, Z1, -1, -1]]) {
    const h1 = 10 + rnd() * 8, h2 = 7 + rnd() * 8, l1 = 6 + rnd() * 5, l2 = 5 + rnd() * 5;
    rb.add('win', win, box(l1, h1, 1.1), mat4(wx(cx0 + dx * l1 / 2), y + h1 / 2, wz(cz0), 0, 1, 1, 1, 0, (rnd() - 0.5) * 0.08), { uv: 'world', uvScale: 1 / 12 });
    rb.add('win', win, box(1.1, h2, l2), mat4(wx(cx0), y + h2 / 2, wz(cz0 + dz * l2 / 2), 0, 1, 1, 1, (rnd() - 0.5) * 0.08), { uv: 'world', uvScale: 1 / 12 });
    ruinRec.ctx.cols.addBox(wx(cx0 + dx * l1 / 2), wz(cz0), l1 / 2, 0.6, 0, y - 1, y + h1); ruinRec.ctx.cols.addBox(wx(cx0), wz(cz0 + dz * l2 / 2), 0.6, l2 / 2, 0, y - 1, y + h2);
  }
  for (let i = 0; i < 22; i++) {
    const lx = X0 + 6 + rnd() * 68, lz = Z0 + 6 + rnd() * 60, r = 4 + rnd() * 6, h = 2.2 + rnd() * 4.4;
    rb.add('stone', M.stone, lump, mat4(wx(lx), y + h * 0.25, wz(lz), rnd() * 6, r, h, r * (0.7 + rnd() * 0.3)), { color: tint(['#3a3a3c', '#2b2b2e', '#4a4744'][i % 3]), uv: 'world', uvScale: 0.3 });
    ruinRec.ctx.cols.addCircle(wx(lx), wz(lz), r * 0.7, y - 1, y + h);
    if (i % 2 === 0) fires.push([lx + r * 0.5, lz, h * 0.5]);
  }
  for (let i = 0; i < 14; i++) rb.add('metal', M.metal, box(0.5, 0.5, 8 + rnd() * 10), mat4(wx(X0 + 8 + rnd() * 64), y + 1 + rnd() * 2.5, wz(Z0 + 8 + rnd() * 56), rnd() * 6, 1, 1, 1, (rnd() - 0.5) * 0.9), { color: tint('#1d1e21') });
  rb.add('win', win, box(20, 12, 20), mat4(wx(84), y + 2.5, wz(-6), 0.5, 1, 1, 1, 0.5, 0.3), { uv: 'world', uvScale: 1 / 12 });   // the spire's top, half buried
  ruinRec.ctx.cols.addCircle(wx(84), wz(-6), 9, y - 1, y + 8);
  rb.build(ruin, {}); ruin.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  ruinRec.remove();
  const fireIM = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.85, depthWrite: false }), fires.length);
  fireIM.frustumCulled = false; ruin.add(fireIM);
  const NS = 26, smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#2a2623', transparent: true, opacity: 0.62, depthWrite: false }), NS);
  smoke.frustumCulled = false; smoke.visible = false; smoke.renderOrder = 4; ctx.group.add(smoke);
  const sx = new Float32Array(NS), sz = new Float32Array(NS), sp = new Float32Array(NS), ss = new Float32Array(NS);
  for (let i = 0; i < NS; i++) { const f = fires[i % fires.length]; sx[i] = wx(i < 12 ? f[0] : X0 + rnd() * 80); sz[i] = wz(i < 12 ? f[1] : Z0 + rnd() * 72); sp[i] = rnd(); ss[i] = 0.7 + rnd() * 0.6; }
  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3(), q0 = new THREE.Quaternion(), sc = new THREE.Vector3();

  const state = { destroyed: false, falling: false };
  let fall = null, clock = 0;
  const upright = () => { outer.position.set(mid.x, y, mid.z); outer.rotation.set(0, 0, 0); outer.visible = true; };
  // "המצודה קורסת לתוך עצמה": the tower's group sinks and leans under smoke, its colliders, floors and walking
  // surfaces leave the world at once, and the ruin (with its own colliders) is what stays; instant: no fall
  const destroy = ({ instant = false } = {}) => {
    if (state.destroyed) return false;
    state.destroyed = true; rec.remove(); ruinRec.restore(); ruin.visible = true; smoke.visible = true;
    if (instant) outer.visible = false; else { fall = { t: 0 }; state.falling = true; }
    return true;
  };
  const restore = () => {
    if (!state.destroyed) return false;
    state.destroyed = false; state.falling = false; fall = null; upright();
    ruinRec.remove(); ruin.visible = false; smoke.visible = false; rec.restore();
    return true;
  };
  const tick = (camera, dt) => {
    clock += dt;
    const on = clock % 1.6 < 0.25; for (const b of beacons) b.set(on ? '#ff3030' : '#3a0a0a');
    if (fall) {
      fall.t += dt; const k = Math.min(1, fall.t / FALL), e = k * k * (3 - 2 * k), shake = (1 - k) * 0.35;
      outer.position.set(mid.x + Math.sin(fall.t * 31) * shake, y - SINK * e, mid.z + Math.cos(fall.t * 27) * shake);
      outer.rotation.set(-0.035 * e, 0, 0.06 * e);
      if (k >= 1) { outer.visible = false; fall = null; state.falling = false; }
    }
    if (!state.destroyed) return;
    const big = fall ? 1 : 0;
    for (let i = 0; i < NS; i++) {
      const age = (clock * (0.05 + sp[i] * 0.05) * (1 + big * 2.5) + sp[i]) % 1, s = ss[i] * (i < 12 && !big ? 3 + age * 5 : 7 + big * 5 + age * 6) * Math.sin(Math.PI * Math.min(1, age * 1.15));
      m4.compose(v3.set(sx[i] + Math.sin(clock * 0.3 + i) * 2 + age * 8, y + 2 + age * (big ? 46 : 30), sz[i] + age * 5), q0, sc.set(s, s * 0.8, s));
      smoke.setMatrixAt(i, m4);
    }
    smoke.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < fires.length; i++) {
      const f = fires[i], h = 4.2 + Math.sin(clock * 9 + i * 2.1) * 0.9 + Math.sin(clock * 15.3 + i) * 0.5;
      m4.compose(v3.set(wx(f[0]), y + f[2] + h / 2, wz(f[1])), q0, sc.set(1.6, h, 1.6)); fireIM.setMatrixAt(i, m4);
    }
    fireIM.instanceMatrix.needsUpdate = true;
  };

  return {
    group: outer, ruin, state, destroy, restore, tick, doors: fit.doors, lamps: S.lamps, emissives: S.emissives, cover: S.cover,
    box: { x0: X0, x1: X1, z0: Z0, z1: Z1 }, F, ROOF: T_ROOF, names: T_NAMES, stairs, beacons,
    mainHall: {
      floor: 0, y: y + F[0], door: mainDoor, outside: P(26, 0, 0, Math.PI / 2), inside: P(38, 0, 0, Math.PI / 2), centre: P(72, 0), screen, screenAt: P(107, 0, 0, Math.PI / 2),
      shadowAt: P(102, 0, 0, -Math.PI / 2), erezAt: P(60, 5, 0, Math.PI / 2), portalAt: P(96, 0, 0, -Math.PI / 2), pillars, cover: lowCover,
      defence: { emitters, nodes },
      medkit: P3(58, 1.5, IN.z1 - 0.2), medkitAt: P(58, 33.9, 0, 0), markerAt: P(64, 27, 0), thrownAt: P(68, 34.3, 0, Math.PI), stairsAt: P(107.5, -33.7, 0, -Math.PI / 2),
    },
    energyHall: {
      floor: 1, y: y + f1, door: hallDoor, doorInside: P(35.5, -24, f1, Math.PI / 2), doorOutside: P(28.5, -24, f1, Math.PI / 2), centre: P(60, 0, f1), stairsTop: P(89, -33.7, f1, -Math.PI / 2),
      conduit: P3(72, f1 + 3.3, 0), cells, cover: S.cover.filter((c) => Math.abs(c.y - (y + f1)) < 0.1),
    },
    machine: {
      floor: 2, y: y + f2, upperDoor, doorInside: P(35.5, -32, f2, Math.PI / 2), doorOutside: P(30.4, -32, f2, Math.PI / 2), source: P3(82, f2 + 3.3, 0), sourceAt: P(77.6, 0, f2, Math.PI / 2),
      console: P3(70, f2 + 1.2, 0), consoleAt: P(68.6, 0, f2, Math.PI / 2), centre: P(64, 0, f2), portalAt: P(88.5, 0, f2, -Math.PI / 2),
      approaches: [
        { name: 'west', door: P(52, 0, f2), outside: P(44, 0, f2, Math.PI / 2), post: P(59.4, 3.6, f2, -Math.PI / 2), from: P(36, 22, f2) },
        { name: 'north', door: P(72, -20, f2), outside: P(72, -28, f2, 0), post: P(68.4, -12.7, f2, Math.PI), from: P(104, -28, f2) },
        { name: 'south', door: P(72, 20, f2), outside: P(72, 28, f2, Math.PI), post: P(68.4, 12.7, f2, 0), from: P(40, 30, f2) },
      ],
      stairsAt: P(89, 33.7, f2, Math.PI / 2),
    },
    lastHall: {
      floor: 3, y: y + f3, size: { x: 79, z: 71, h: 15 }, entry: P(107, 30, f3, Math.PI), centre: P(72, 0, f3), engine, engineAt: P(98, 0, f3, Math.PI / 2), generators, cover: lastCover,
      rifts: [P(44, -14, f3), P(44, 16, f3), P(62, -28, f3), P(70, 28, f3), P(90, -26, f3), P(96, 18, f3)], duel: P(72, 0, f3), duelR: 7,
      portalAt: P(94, 0, f3, -Math.PI / 2), landing: { nehorai: P(90, -2.5, f3, -Math.PI / 2), erez: P(90, 2.5, f3, -Math.PI / 2) }, shadowAt: P(98, 0, f3, -Math.PI / 2),
      friends: [P(46, -6, f3, Math.PI / 2), P(46, 6, f3, Math.PI / 2), P(52, -12, f3, Math.PI / 2), P(52, 12, f3, Math.PI / 2), P(42, 0, f3, Math.PI / 2)],
      exit: { door: exitDoor, lamp: exitLamp, switch: P3(87.5, f3 + 1.4, IN.z1 - 0.1), switchAt: P(87.5, 34.1, f3, 0), inside: P(84, 34.2, f3, 0), outside: P(84, 38.25, f3, 0) },
    },
    fireStairs: { gallery: P(83, 38.25, f3), flights: fire, landing2: P(65.2, 38.25, f2), landing1: P(47.2, 38.25, f1), foot: P(44.6, 38.25, f1, -Math.PI / 2) },
    patrols: {
      hall0a: [P(40, -20), P(40, 20)], hall0b: [P(86, -26), P(86, 26)], hall0door: [P(37, 5.5, 0, -Math.PI / 2)],
      hall1a: [P(36, -12, f1), P(36, 12, f1)], hall1b: [P(76, -20, f1), P(76, 20, f1)], hall1door: [P(36, -20.5, f1, -Math.PI / 2)],
      ring2a: [P(42, -26, f2), P(42, 26, f2)], ring2b: [P(100, -26, f2), P(100, 22, f2)], machine: [P(62, -10, f2), P(62, 10, f2)], upperDoor: [P(36, -28.5, f2, -Math.PI / 2)],
      last3a: [P(37, -22, f3), P(37, 22, f3)], last3b: [P(72, -10, f3), P(72, 10, f3)], last3c: [P(98, -20, f3), P(98, 20, f3)], fireStairs: [P(83, 38.25, f3, Math.PI)],
    },
  };
}
