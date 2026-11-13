// The Shadow's citadel (chapter ten): המצודה של הצל, the biggest site of the game. A walled fortress 340 × 250 m
// on the plain: the west wall with the main gate and the service gate; the industrial yard behind it
// (containers, tanks, cranes, lorries and cars that can blow, cover in lanes, the alarm room, the stores along
// the south wall with the lift's power switch and the alarm's fuse room, the vehicle bay of the armoured car,
// the freight lift); the tunnels six metres under the yard (a lobby, two ways, pipes, low light) that come up
// inside the inner compound; the inner wall with its gate of two wheels; the inner compound (control room B
// with the main computer and three doors, the plant house, reactors and pylons, bridges at +7 m between the
// roofs, the bridgehead and the long tower bridge at +14 m in segments that can fall, with a marked catwalk
// beside it); four watch towers with real stairs; and the central tower (citadel-tower.js), its own group, which
// destroy() brings down. Site-local: origin at the citadel's centre (1610, 155), +x east, +z south.
// Everything is invented; nothing here is a real place or a way into one.
import * as THREE from 'three';
import { makeSite } from './compound.js';
import { CollisionWorld } from './colliders.js';
import { trafficCarGeometry, trafficMaterial } from './car.js';
import { cutRects, tools, fittings, signsMesh, slitMaterial, makeScreen, routeMarks, lorryGeometry, makeArmoured, painted } from './citadel-kit.js';
import { buildCentralTower, TF, T_ROOF, T_NAMES } from './citadel-tower.js';

const C = { x: 1610, z: 155 };
const HX = 170, HZ = 125, WALL_H = 8;
const MAIN_Z = -60, SERV_Z = 80, IW = -58;                 // the two gates in the west wall; the inner wall's x
const PIT = { x0: -110, x1: -22, z0: 61, z1: 109 }, DEEP = 6; // the dug tunnels (world x 1500..1588, z 216..264: on the terrain's grid)
const TUN = -DEEP, TH = 4.2;
const LIFT = { x: -102, z: 85 }, LOW = TUN + 0.12;          // the freight lift's platform, and where it rests below
const HOLES = [{ x0: LIFT.x - 3, x1: LIFT.x + 3, z0: LIFT.z - 3, z1: LIFT.z + 3 }, { x0: -34, x1: -23.5, z0: 63, z1: 66 }, { x0: -34, x1: -23.5, z0: 104, z1: 107 }];
const BRIDGE = { x0: -12, x1: 29, z: -32, n: 8, y: 14 };   // the tower bridge: eight segments from the bridgehead to the ledge at the upper door
export const FLOORS = { tunnels: TUN, yard: 0, bridges: 7, watch: 9, towerBridge: BRIDGE.y, tower: TF, towerRoof: T_ROOF };

export function layout(ctx) {
  const { net, baseHeight } = ctx;
  const h = baseHeight(C.x, C.z);
  // the fortress's ground: one flat level all round the pit of the tunnels, which is dug six metres under it
  for (const r of cutRects({ x0: -HX, x1: HX, z0: -HZ, z1: HZ }, [PIT])) net.addPad({ x: C.x + (r.x0 + r.x1) / 2, z: C.z + (r.z0 + r.z1) / 2, hx: (r.x1 - r.x0) / 2, hz: (r.z1 - r.z0) / 2, yaw: 0, h, top: 0.05, blend: 8, name: 'citadel' });
  net.addPad({ x: C.x + (PIT.x0 + PIT.x1) / 2, z: C.z + (PIT.z0 + PIT.z1) / 2, hx: (PIT.x1 - PIT.x0) / 2, hz: (PIT.z1 - PIT.z0) / 2, yaw: 0, h: h - DEEP, top: 0.05, blend: 0, name: 'citadel tunnels' });
  ctx.keepOut?.push({ x: C.x, z: C.z, hx: HX + 10, hz: HZ + 10 });
  ctx.citadel = { y: h + 0.05 };
}

export function build(ctx) {
  const { places, M, cols } = ctx;
  const { y } = ctx.citadel;
  const S = makeSite(ctx, { cx: C.x, cz: C.z, y, name: 'citadel' });
  const { box, toWorld, wall, slab, level, group } = S;
  const K = tools(S, ctx), { piece, geo, thing, holedWall, rail, flight, blockAt, roundAt } = K;
  const fit = fittings(group, S, cols, { doors: 24, lights: 200 });
  const P = (lx, lz, ly = 0, yaw) => ({ ...toWorld(lx, lz), y: y + ly, ...(yaw != null ? { yaw } : {}) });
  const P3 = (lx, ly, lz) => ({ ...toWorld(lx, lz), y: y + ly });
  const ground = (x, z) => ctx.net.surface(x, z) ?? ctx.terrain.heightAt(x, z);
  const out = (lx, lz, yaw) => { const p = toWorld(lx, lz); return { ...p, y: ground(p.x, p.z), yaw }; };
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const win = slitMaterial(411, 0.24); S.emissives.push(win);
  const signs = [], signAt = (text, lx, ly, lz, yaw, w, h, o = {}) => signs.push({ text, lx, ly, lz, yaw, w, h, ...o });
  const lampAt = (lx, ly, lz, { range = 14, intensity = 26, inside = true, color } = {}) => S.lamps.push({ ...toWorld(lx, lz), y: y + ly, inside, range, intensity, ...(color ? { color } : {}) });
  const WALLC = '#4a4e55', DARK = '#23262b', VIOLET = '#8a5cff', STEEL = '#4a4f57';
  const beacons = [];
  const drum = (lx, lz, color) => { geo('paint', M.paint, new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), lx, 0.45, lz, 0, color); roundAt(lx, lz, 0.32, 0, 0.9); S.cover.push({ ...toWorld(lx, lz), y, w: 0.6, d: 0.6 }); };
  const T4 = (x, yy, z) => new THREE.Matrix4().makeTranslation(x, yy, z);

  // ---------- the ground: asphalt in the yard, concrete in the inner compound, the lid over the tunnels ----------
  for (const r of cutRects({ x0: -HX, x1: IW, z0: -HZ, z1: HZ }, [PIT])) slab((r.x0 + r.x1) / 2, -0.01, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.06, r.z1 - r.z0, { key: 'asphalt', mat: M.asphalt, color: '#96989d', scale: 0.1 });
  for (const r of cutRects({ x0: IW, x1: HX, z0: -HZ, z1: HZ }, [PIT])) slab((r.x0 + r.x1) / 2, -0.01, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.06, r.z1 - r.z0, { key: 'asphalt', mat: M.asphalt, color: '#b3b5bb', scale: 0.1 });
  for (const r of cutRects(PIT, HOLES)) level((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 0, { key: 'asphalt', mat: M.asphalt, color: '#96989d', name: 'citadel lid', thick: 0.5, scale: 0.1 });
  // lanes: from the main gate to the spine, the spine to the inner gate, the service gate's lane
  for (let lx = -164; lx < -72; lx += 6) piece('paint', M.paint, 3, 0.02, 0.16, lx, 0.035, MAIN_Z, { color: '#d9d6cc', uv: 'keep' });
  for (let lz = -96; lz < 60; lz += 6) piece('paint', M.paint, 0.16, 0.02, 3, -67, 0.035, lz, { color: '#d9d6cc', uv: 'keep' });
  for (let lx = -164; lx < -116; lx += 6) piece('paint', M.paint, 3, 0.02, 0.16, lx, 0.035, SERV_Z, { color: '#d9d6cc', uv: 'keep' });

  // ---------- the walls: the perimeter with its two gates, the inner wall with its gate and the service door ----------
  const outerWall = { t: 1.2, color: WALLC, scale: 0.2 };
  holedWall(-HX + 0.6, -HZ, -HX + 0.6, HZ, WALL_H, [{ a0: HZ + MAIN_Z - 5, a1: HZ + MAIN_Z + 5, y0: 0, y1: 6 }, { a0: HZ + SERV_Z - 4, a1: HZ + SERV_Z + 4, y0: 0, y1: 5 }], outerWall);
  holedWall(-HX, HZ - 0.6, HX, HZ - 0.6, WALL_H, [], outerWall); holedWall(HX - 0.6, HZ, HX - 0.6, -HZ, WALL_H, [], outerWall); holedWall(HX, -HZ + 0.6, -HX, -HZ + 0.6, WALL_H, [], outerWall);
  for (let lx = -HX + 2; lx < HX; lx += 4) for (const lz of [-HZ + 0.6, HZ - 0.6]) piece('plaster', M.plaster, 2, 1.1, 1.2, lx, WALL_H + 0.55, lz, { color: DARK, scale: 0.2 });
  for (let lz = -HZ + 2; lz < HZ; lz += 4) for (const lx of [-HX + 0.6, HX - 0.6]) piece('plaster', M.plaster, 1.2, 1.1, 2, lx, WALL_H + 0.55, lz, { color: DARK, scale: 0.2 });
  holedWall(IW, -HZ + 1.2, IW, HZ - 1.2, 7, [{ a0: HZ - 1.2 - 4, a1: HZ - 1.2 + 4, y0: 0, y1: 5 }, { a0: HZ - 1.2 + 40 - 1.1, a1: HZ - 1.2 + 40 + 1.1, y0: 0, y1: 2.6 }], { t: 0.8, color: '#44484f', scale: 0.2 });
  for (let lz = -HZ + 3; lz < HZ - 2; lz += 4) piece('plaster', M.plaster, 0.8, 0.9, 2, IW, 7.45, lz, { color: DARK, scale: 0.2 });
  const mainLeaf = fit.door(-HX + 0.6, MAIN_Z, Math.PI / 2, 10, { h: 6, mode: 'slide', color: '#1c1f24', locked: true, label: 'השער הראשי', t: 0.5 });
  const servLeaf = fit.door(-HX + 0.6, SERV_Z, Math.PI / 2, 8, { h: 5, mode: 'slide', color: '#23262b', locked: true, label: 'שער השירות', t: 0.4 });
  const innerLeaf = fit.door(IW, 0, Math.PI / 2, 8, { h: 5, mode: 'lift', color: '#1c1f24', locked: true, label: 'השער הפנימי', t: 0.5 });
  const servDoor = fit.door(IW, 40, Math.PI / 2, 2.2, { h: 2.6, mode: 'slide', color: '#8a1f1f', locked: true, label: 'דלת השירות', t: 0.2 });
  const gateOf = (leaf, extra) => ({ door: leaf, w: leaf.w, ...extra,
    open() { leaf.unlock(); leaf.setOpen(true); }, shut() { leaf.setOpen(false); }, lock() { leaf.lock(); }, unlock() { leaf.unlock(); },
    get locked() { return leaf.locked; }, set locked(v) { if (v) leaf.lock(); else leaf.unlock(); }, get isOpen() { return leaf.open; } });
  // the main gate's two towers, the plates over the gates
  for (const sz of [-9.5, 9.5]) {
    thing(-165.5, MAIN_Z + sz, 7, 13, 7, 0, '#ffffff', { key: 'win', mat: win, cover: false, scale: 1 / 12 });
    piece('plaster', M.plaster, 8, 0.8, 8, -165.5, 13.4, MAIN_Z + sz, { color: DARK });
    for (const [ox, oz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) piece('plaster', M.plaster, 1.6, 1, 1.6, -165.5 + ox, 14.3, MAIN_Z + sz + oz, { color: DARK });
    beacons.push(fit.indicator(-165.5, 15.2, MAIN_Z + sz, 0.32, '#ff3030'));
  }
  signAt('המסדר השחור · המצודה', -HX - 0.02, 7.0, MAIN_Z, -Math.PI / 2, 8.4, 1.0, { bg: '#0d0f12', fg: '#ff9180' });
  signAt('כניסת שירות', -HX - 0.02, 6.2, SERV_Z, -Math.PI / 2, 5, 0.8, { bg: '#0d0f12', fg: '#e8e4da' });
  signAt('השער הפנימי', IW - 0.42, 5.9, 0, -Math.PI / 2, 5, 0.7, { bg: '#0d0f12', fg: '#ff9180' });
  for (const [lx, lz] of [[-158, -50], [-156, 68]]) { thing(lx, lz, 3, 2.8, 3, 0, '#3a3f47', { cover: true }); piece('glow', glow, 0.05, 0.7, 1.6, lx + 1.53, 1.7, lz, { color: '#ffd9a0', uv: 'keep' }); }
  // the inner gate's two wheels (east of the wall, either side of the gate)
  const wheelGeo = painted([[new THREE.TorusGeometry(0.45, 0.06, 8, 20), '#b33a2a'], [box(0.9, 0.07, 0.07), '#8a8f96'], [box(0.07, 0.9, 0.07), '#8a8f96'], [new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8).rotateX(Math.PI / 2), '#3a3d44']]);
  const wheelMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 });
  const wheels = [-7, 7].map((lz) => {
    thing(-57.0, lz, 0.8, 1.9, 1.2, 0, '#2a2d33', { cover: false });
    const hold = new THREE.Group(); hold.position.set(C.x - 56.45, y + 1.3, C.z + lz); hold.rotation.y = Math.PI / 2; group.add(hold);
    const w = new THREE.Mesh(wheelGeo, wheelMat); hold.add(w); return w;
  });

  // ---------- four watch towers at the corners: a bastion, two flights along the wall, the post on top ----------
  const watch = (sx, sz, name) => {
    const bx0 = sx * 162.5, bz0 = sz * 117.5, yawUp = sz > 0 ? 0 : Math.PI, sc = '#3f434a';
    thing(bx0, bz0, 12, 8.72, 12, 0, sc, { key: 'plaster', mat: M.plaster, cover: false, scale: 0.2 });
    level(bx0, bz0, 6, 6, 9, { color: '#5a5f68', name: 'citadel watch', thick: 0.3 });
    const par = { h: 1.1, t: 0.3, floor: 9, color: sc };
    S.seg(sx * 156.5, sz * 111.5, sx * 156.5, sz * 123.5, par); S.seg(sx * 168.5, sz * 111.5, sx * 168.5, sz * 123.5, par); S.seg(sx * 156.5, sz * 123.5, sx * 168.5, sz * 123.5, par);
    S.seg(sx * 156.5, sz * 111.5, sx * 161.3, sz * 111.5, par); S.seg(sx * 164.7, sz * 111.5, sx * 168.5, sz * 111.5, par);
    const a = flight(sx * 163, sz * 90, yawUp, { rise: 4.5, run: 9, steps: 13, floor: 0, enclose: true, name: 'citadel watch stairs' });
    level(sx * 163, sz * 100.75, 1.5, 1.75, 4.5, { color: '#5a5f68', name: 'citadel watch', thick: 0.3 });
    const b = flight(sx * 163, sz * 102.5, yawUp, { rise: 4.5, run: 9, steps: 13, floor: 4.5, enclose: true, name: 'citadel watch stairs' });
    thing(sx * 163, sz * 105.25, 3, 4.2, 12.5, 0, sc, { key: 'plaster', mat: M.plaster, cover: false, scale: 0.2 });
    for (const o of [-1.56, 1.56]) rail(sx * 163 + o, sz * 99, sx * 163 + o, sz * 102.5, 4.5);
    for (const [ox, oz] of [[-5.6, -5.6], [5.6, -5.6], [-5.6, 5.6], [5.6, 5.6]]) piece('metal', M.metal, 0.3, 2.7, 0.3, bx0 + ox, 10.35, bz0 + oz, { color: '#2a2d33' });
    piece('plaster', M.plaster, 13, 0.3, 13, bx0, 11.85, bz0, { color: DARK });
    piece('bulb', S.bulbMat, 0.7, 0.4, 0.7, bx0 - sx * 5, 11.5, bz0 - sz * 5, { uv: 'keep' });
    lampAt(bx0 - sx * 4, 11.3, bz0 - sz * 4, { range: 44, intensity: 150, inside: false, color: '#dbe9ff' });
    geo('metal', M.metal, new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), bx0, 13.2, bz0, 0, '#3a3d44');
    beacons.push(fit.indicator(bx0, 14.5, bz0, 0.3, '#ff3030'));
    return { name, foot: P(sx * 163, sz * 88.6, 0, yawUp), landing: P(sx * 163, sz * 100.75, 4.5, yawUp), top: P(sx * 163, sz * 112.8, 9, yawUp), post: P(bx0, bz0, 9, Math.atan2(-sx, -sz)), look: P(bx0 - sx * 4.6, bz0 - sz * 4.6, 9, Math.atan2(-sx, -sz)), y: y + 9, stairs: [a, b] };
  };
  const towers = [watch(-1, -1, 'צפון-מערב'), watch(-1, 1, 'דרום-מערב'), watch(1, -1, 'צפון-מזרח'), watch(1, 1, 'דרום-מזרח')];

  // ---------- floodlights ----------
  const flood = (lx, lz, yaw, h = 14) => {
    geo('metal', M.metal, new THREE.CylinderGeometry(0.14, 0.2, h, 8), lx, h / 2, lz, 0, '#3a3d44'); roundAt(lx, lz, 0.25, 0, h);
    piece('metal', M.metal, 2.4, 0.14, 0.14, lx, h, lz, { yaw, color: '#3a3d44', uv: 'keep' });
    for (const o of [-0.9, 0, 0.9]) { piece('paint', M.paint, 0.5, 0.36, 0.3, lx + Math.cos(yaw) * o, h + 0.3, lz - Math.sin(yaw) * o, { yaw, color: '#2a2d33', uv: 'keep' }); piece('bulb', S.bulbMat, 0.42, 0.28, 0.04, lx + Math.cos(yaw) * o + Math.sin(yaw) * 0.16, h + 0.3, lz - Math.sin(yaw) * o + Math.cos(yaw) * 0.16, { yaw, uv: 'keep' }); }
    lampAt(lx + Math.sin(yaw) * 0.6, h - 0.2, lz + Math.cos(yaw) * 0.6, { range: 58, intensity: 380, inside: false, color: '#e9f0ff' });
    return P(lx, lz);
  };
  const floodlights = [[-156, -36, 1.2], [-110, -80, 0.4], [-76, 10, -1.2], [-150, 50, 1.4], [-122, 104, 2.6], [-74, 102, -2.4], [0, -60, 0.6], [24, 60, 2.2], [124, -50, -1.2], [124, 50, -1.9]].map(([lx, lz, yaw]) => flood(lx, lz, yaw));

  // ---------- the industrial yard: containers, tanks, cranes, vehicles that can blow, cover in lanes ----------
  const CONT = ['#7a2b2b', '#2b4a6b', '#5d636b', '#6b4a2b', '#2f5a48', '#8a6b2a'];
  let ci = 0;
  const container = (lx, lz, alongZ = false, tier = 0) => thing(lx, lz, alongZ ? 2.5 : 12, 2.6, alongZ ? 12 : 2.5, 0, CONT[ci++ % CONT.length], { key: 'metal', mat: M.metal, ly: tier * 2.6, collide: tier === 0, cover: tier === 0, scale: 0.6 });
  for (const lx of [-136, -122.5, -109]) for (const lz of [-102, -99.4]) container(lx, lz);
  container(-136, -102, false, 1); container(-109, -99.4, false, 1); container(-122.5, -100.7, false, 1);
  for (const lz of [-38, -24.5]) for (const lx of [-104, -101.4]) container(lx, lz, true);
  container(-104, -38, true, 1); container(-101.4, -24.5, true, 1);
  for (const lx of [-128, -114.5]) for (const lz of [14, 16.6]) container(lx, lz);
  container(-128, 15.3, false, 1);
  for (const lz of [24, 37.5]) for (const lx of [-86, -83.4]) container(lx, lz, true);
  container(-86, 24, true, 1);
  for (const lx of [-92, -78.5]) container(lx, -86);
  container(-92, -86, false, 1);
  for (const [lx, lz] of [[-84, -113], [-72, -113]]) {                                  // two standing tanks, two lying ones, pipes
    geo('metal', M.metal, new THREE.CylinderGeometry(4, 4, 9, 20), lx, 4.5, lz, 0, '#8a8f96'); geo('metal', M.metal, new THREE.CylinderGeometry(1.2, 4, 1.2, 20), lx, 9.6, lz, 0, '#6b6f75');
    roundAt(lx, lz, 4.1, 0, 10); S.cover.push({ ...toWorld(lx, lz), y, w: 8, d: 8 });
  }
  for (const lx of [-112, -126]) { geo('metal', M.metal, new THREE.CylinderGeometry(1.5, 1.5, 9, 14).rotateZ(Math.PI / 2), lx, 2.1, -116, 0, '#9a968d'); for (const o of [-3, 3]) piece('stone', M.stone, 0.6, 1.0, 2.6, lx + o, 0.5, -116, { color: '#6b6f75' }); blockAt(lx, -116, 4.5, 1.5, 0, 3.6); S.cover.push({ ...toWorld(lx, -116), y, w: 9, d: 3 }); }
  piece('metal', M.metal, 46, 0.3, 0.3, -99, 4.2, -116, { color: '#6b6f75' });
  // a gantry crane over the north containers and a tower crane in the middle of the yard
  for (const lx of [-146, -99]) for (const lz of [-106, -95]) { piece('metal', M.metal, 0.7, 11.4, 0.7, lx, 5.7, lz, { color: '#b88a1f' }); roundAt(lx, lz, 0.5, 0, 11); }
  for (const lz of [-106, -95]) piece('metal', M.metal, 49, 0.9, 0.7, -122.5, 11.4, lz, { color: '#b88a1f' });
  for (const lx of [-146, -99]) piece('metal', M.metal, 0.7, 0.7, 11, lx, 10.6, -100.5, { color: '#b88a1f' });
  piece('metal', M.metal, 3, 1.2, 12, -118, 11.6, -100.5, { color: '#2a2d33' }); piece('paint', M.paint, 0.08, 4.6, 0.08, -118, 8.8, -100.5, { color: '#15171a', uv: 'keep' });
  piece('metal', M.metal, 12, 2.6, 2.5, -118, 5.2, -100.5, { color: CONT[1], scale: 0.6, yaw: 0.12 });
  const CR = { x: -118, z: 46, h: 27, yaw: 0.5 };
  piece('metal', M.metal, 1.2, CR.h, 1.2, CR.x, CR.h / 2, CR.z, { color: '#b88a1f' }); thing(CR.x, CR.z, 4, 1, 4, 0, '#6b6f75', { key: 'stone', mat: M.stone, cover: true });
  piece('metal', M.metal, 0.9, 0.9, 40, CR.x + Math.sin(CR.yaw) * 14, CR.h + 0.5, CR.z + Math.cos(CR.yaw) * 14, { yaw: CR.yaw, color: '#b88a1f' });
  piece('metal', M.metal, 2.4, 2, 3, CR.x - Math.sin(CR.yaw) * 5, CR.h - 0.6, CR.z - Math.cos(CR.yaw) * 5, { yaw: CR.yaw, color: '#5d636b' });
  piece('metal', M.metal, 0.7, 4.4, 0.7, CR.x, CR.h + 3, CR.z, { color: '#b88a1f' }); piece('metal', M.metal, 1.6, 1.8, 1.6, CR.x + 1, CR.h - 1.4, CR.z + 1, { color: '#2a2d33' });
  piece('paint', M.paint, 0.07, 12, 0.07, CR.x + Math.sin(CR.yaw) * 24, CR.h - 5.6, CR.z + Math.cos(CR.yaw) * 24, { color: '#15171a', uv: 'keep' });
  beacons.push(fit.indicator(CR.x, CR.h + 5.5, CR.z, 0.35, '#ff3030'));
  // vehicles that can blow: cars and lorries, each kind one instanced mesh; wreck() burns one out (it still blocks)
  const carIM = new THREE.InstancedMesh(trafficCarGeometry(), trafficMaterial(), 5), lorryIM = new THREE.InstancedMesh(lorryGeometry(), trafficMaterial(), 3);
  carIM.count = 0; lorryIM.count = 0; group.add(carIM, lorryIM);
  const vehicles = [], vo = new THREE.Object3D(), vc = new THREE.Color();
  const parked = (kind, lx, lz, yaw, color) => {
    const im = kind === 'car' ? carIM : lorryIM, hx = kind === 'car' ? 0.95 : 1.3, hz = kind === 'car' ? 2.1 : 3.9, top = kind === 'car' ? 1.5 : 3.3, p = toWorld(lx, lz), index = im.count++;
    const body = cols.addBox(p.x, p.z, hx, hz, yaw, y - 1, y + top);
    S.cover.push({ ...p, y, w: hx * 2, d: hz * 2 });
    const v = { kind, ...p, y, yaw, blows: true, wrecked: false, body, index, at: { ...p, y: y + (kind === 'car' ? 0.6 : 1.2) }, near: { x: p.x + Math.cos(yaw) * (hx + 1.6), z: p.z - Math.sin(yaw) * (hx + 1.6), y } };
    const draw = (wreck) => {
      vo.position.set(p.x, y - (wreck ? 0.14 : 0), p.z); vo.rotation.set(0, yaw, wreck ? 0.05 : 0); vo.updateMatrix();
      im.setMatrixAt(index, vo.matrix); im.setColorAt(index, vc.set(wreck ? '#1d1a17' : color)); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    };
    v.wreck = () => { v.wrecked = true; draw(true); }; v.reset = () => { v.wrecked = false; draw(false); };
    draw(false); vehicles.push(v);
    return v;
  };
  parked('car', -150, -84, 0.3, '#2a2d33'); parked('car', -124, -46, 1.5, '#5d636b'); parked('car', -92, -4, -0.4, '#1c1f26'); parked('car', -136, 54, 2.0, '#3a4b5f'); parked('car', -78, 62, 0.9, '#7a2b2b');
  parked('lorry', -110, -74, Math.PI / 2, '#3a3d44'); parked('lorry', -80, -30, 0.15, '#2b3a2e'); parked('lorry', -146, 36, -0.3, '#4a3a2b');
  for (const [lx, lz, yaw] of [[-150, -52, 0], [-130, -68, 0], [-112, -48, 1.57], [-92, -52, 0], [-118, -4, 0], [-140, 4, 1.57], [-96, 22, 0], [-110, 34, 1.57], [-128, 70, 0], [-118, 96, 1.57], [-90, 64, 0.4], [-76, -70, 1.57], [-76, 22, 1.57], [-150, 96, 0]]) thing(lx, lz, 3, 0.9, 0.7, 0, '#9a968d', { key: 'stone', mat: M.stone, yaw });
  for (const [lx, lz] of [[-160, -20], [-158.6, -21.4], [-90, -110], [-140, 84], [-141.4, 85.4], [-64, -112], [-100, 60], [-66, 70]]) S.crate(lx, lz);
  for (const [lx, lz] of [[-132, -30], [-131, -28.8], [-96, 44], [-62, -80]]) drum(lx, lz, '#5a4a2b');

  // ---------- the alarm room (חדר בקרה א) and the sirens ----------
  const AR = { x0: -150, x1: -134, z0: -24, z1: -8, h: 4 }, aw = { h: AR.h, t: 0.3, color: '#5a5f68' };
  wall(AR.x0, AR.z0, AR.x1, AR.z0, [], aw); wall(AR.x1, AR.z0, AR.x1, AR.z1, [{ at: 8, w: 1.8, h: 2.5 }], aw); wall(AR.x1, AR.z1, AR.x0, AR.z1, [], aw); wall(AR.x0, AR.z1, AR.x0, AR.z0, [], aw);
  slab(-142, AR.h + 0.1, -16, 16.6, 0.2, 16.6, { color: '#2b2f36' });
  const alarmDoor = fit.door(AR.x1, -16, Math.PI / 2, 1.8, { h: 2.5, color: '#5d636b', label: 'חדר בקרה א' });
  piece('paint', M.paint, 0.3, 1.6, 3, AR.x0 + 0.3, 1.5, -16, { color: '#5a1d1d', uv: 'keep' });
  for (const lz of [-16.8, -16, -15.2]) piece('glow', glow, 0.04, 0.14, 0.3, AR.x0 + 0.47, 1.7, lz, { color: '#ffb04a', uv: 'keep' });
  const alarmLamp = fit.indicator(AR.x0 + 0.5, 2.5, -16, 0.16, '#3a0a0a');
  thing(-144, -10.4, 5, 0.8, 1.2, 0, '#3a3f47'); for (const lx of [-145.4, -144, -142.6]) piece('glow', glow, 0.9, 0.5, 0.04, lx, 1.2, -10.1, { color: '#59c7ff', uv: 'keep' });
  thing(-141, -22.9, 6, 2, 0.8, 0, '#4a5560', { key: 'metal', mat: M.metal, cover: false });
  signAt('חדר בקרה א', AR.x1 + 0.17, 3.0, -16, Math.PI / 2, 2.6, 0.4); signAt('בקרת אזעקה', AR.x0 + 0.17, 3.0, -16, Math.PI / 2, 2.2, 0.36, { bg: '#5a1d1d', fg: '#ffffff' });
  lampAt(-142, 3.6, -16);
  const sirenAt = [[-142, 4.7, -16], [-165.5, 14.2, MAIN_Z], [IW, 8.2, -30], [IW, 8.2, 30], [-92, 4.8, 110.4], [LIFT.x, 5.9, LIFT.z], [-118, 4.6, 98.2]];
  const sirens = sirenAt.map(([lx, ly, lz]) => fit.indicator(lx, ly, lz, 0.34, '#3a0a0a'));
  // the red light over the yard while the alarm is on: pools of red on the ground under the sirens (one mesh)
  const poolTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), grd = g.createRadialGradient(64, 64, 2, 64, 64, 64); grd.addColorStop(0, 'rgba(255,60,40,1)'); grd.addColorStop(0.5, 'rgba(255,30,20,0.45)'); grd.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  const poolAt = [[-140, -70], [-100, -44], [-136, 8], [-90, 40], [-142, 76], [-84, 96], [-86, -100]];
  const pools = new THREE.Mesh(painted(poolAt.map(([lx, lz]) => [new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2), '#ffffff', T4(C.x + lx, y + 0.09, C.z + lz)])), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
  { const uv = new Float32Array(poolAt.length * 12); for (let i = 0; i < poolAt.length; i++) uv.set([0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1], i * 12); pools.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); }
  pools.visible = false; pools.renderOrder = 2; group.add(pools);

  // ---------- the stores along the south wall: the lift's power switch (store 1), the alarm's fuse room (store 3) ----------
  const ST = { x0: -124, x1: -60, z0: 110, z1: HZ - 1.2, h: 4 }, sw = { h: ST.h, t: 0.3, color: '#6b6f75' };
  wall(ST.x0, ST.z0, ST.x1, ST.z0, [0, 1, 2, 3].map((i) => ({ at: 8 + 16 * i, w: 2.4, h: 2.6 })), sw);
  for (let i = 0; i <= 4; i++) wall(ST.x0 + 16 * i, ST.z0, ST.x0 + 16 * i, ST.z1, [], sw);
  slab(-92, ST.h + 0.1, (ST.z0 + ST.z1) / 2, 64.6, 0.2, ST.z1 - ST.z0 + 0.5, { color: '#2b2f36' });
  const STORE_NAMES = ['מחסן 1 · כוח למעלית', 'מחסן 2', 'מחסן 3 · חדר נתיכים', 'מחסן 4'];
  const storeDoors = [0, 1, 2, 3].map((i) => { signAt(STORE_NAMES[i], ST.x0 + 8 + 16 * i, 3.1, ST.z0 - 0.17, Math.PI, 3.2, 0.42); return fit.door(ST.x0 + 8 + 16 * i, ST.z0, 0, 2.4, { h: 2.6, color: '#5d636b', label: STORE_NAMES[i] }); });
  const shelf = (lx, lz, len) => { thing(lx, lz, 1.0, 2.2, len, 0, '#5a5f66', { key: 'metal', mat: M.metal }); for (let t = -len / 2 + 0.7; t < len / 2 - 0.4; t += 1.3) for (const ly of [0.6, 1.5]) piece('paint', M.paint, 0.9, 0.6, 0.9, lx, ly + 0.3, lz + t, { color: ['#b8955e', '#8a6b45', '#6b7a52'][Math.abs(Math.round(t * 2)) % 3], uv: 'keep' }); };
  for (const i of [0, 1, 2, 3]) { shelf(ST.x0 + 16 * i + 1.3, 117.5, 9); if (i !== 2) shelf(ST.x0 + 16 * i + 14.7, 117.5, 9); }
  for (const [lx, lz] of [[-100, 121], [-98.4, 121.6], [-66, 121], [-70, 116], [-64.4, 115]]) S.crate(lx, lz);
  piece('paint', M.paint, 0.9, 1.1, 0.16, -116, 1.4, ST.z1 - 0.1, { color: '#2a2d33', uv: 'keep' }); piece('paint', M.paint, 0.12, 0.5, 0.2, -116, 1.5, ST.z1 - 0.25, { color: '#e8c547', uv: 'keep' });
  const liftLamp = fit.indicator(-116, 2.1, ST.z1 - 0.2, 0.09, '#ff2a2a');
  signAt('מתג כוח · מעלית משא', -116, 2.75, ST.z1 - 0.02, Math.PI, 3.0, 0.4, { bg: '#5a4a1d', fg: '#ffffff' });
  thing(-84, ST.z1 - 0.4, 2.6, 2.0, 0.7, 0, '#5a1d1d', { cover: false, ly: 0.3 });
  for (let k = 0; k < 6; k++) piece('glow', glow, 0.16, 0.3, 0.04, -85 + k * 0.4, 1.5, ST.z1 - 0.78, { color: k % 2 ? '#ffb04a' : '#59c7ff', uv: 'keep' });
  const fuseLamp = fit.indicator(-84, 2.55, ST.z1 - 0.7, 0.09, '#ff2a2a');
  signAt('נתיכי האזעקה', -84, 2.95, ST.z1 - 0.02, Math.PI, 2.4, 0.36, { bg: '#5a1d1d', fg: '#ffffff' });
  lampAt(-116, 3.6, 117); lampAt(-84, 3.6, 117);

  // ---------- the vehicle bay by the service gate (the armoured car's) ----------
  const BAY = { x0: -152, x1: -128, z0: 98, z1: 122, h: 5 }, bw = { h: BAY.h, t: 0.4, color: '#4a4e55' };
  wall(BAY.x0, BAY.z0, BAY.x0, BAY.z1, [], bw); wall(BAY.x0, BAY.z1, BAY.x1, BAY.z1, [], bw); wall(BAY.x1, BAY.z1, BAY.x1, BAY.z0, [], bw);
  wall(BAY.x0, BAY.z0, BAY.x1, BAY.z0, [{ at: 12, w: 10, h: 4.2 }], bw);
  slab(-140, BAY.h + 0.12, 110, 24.6, 0.24, 24.6, { color: '#2b2f36' });
  signAt('חניון רכבי מילוט', -140, 4.62, BAY.z0 - 0.22, Math.PI, 5.2, 0.6, { bg: '#0d0f12', fg: '#e8c547' });
  thing(-140, 121.2, 12, 0.9, 1.0, 0, '#5a4a3a', { cover: false }); thing(-150.6, 114, 1.2, 2.2, 6, 0, '#4a5560', { key: 'metal', mat: M.metal, cover: false });
  for (const [lx, lz] of [[-130, 119], [-130.8, 117.8], [-129.6, 116.8]]) drum(lx, lz, '#7a2b2b');
  for (const lx of [-146.5, -133.5]) piece('paint', M.paint, 0.16, 0.02, 12, lx, 0.035, 110, { color: '#e8c547', uv: 'keep' });
  lampAt(-140, 4.5, 110, { range: 20, intensity: 40 });

  // ---------- the freight lift: a platform that really moves between the yard and the tunnels ----------
  const liftPad = ctx.net.addPad({ x: C.x + LIFT.x, z: C.z + LIFT.z, hx: 3, hz: 3, yaw: 0, h: y - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'citadel lift' });
  cols.addFloor(C.x + LIFT.x - 3, C.z + LIFT.z - 3, C.x + LIFT.x + 3, C.z + LIFT.z + 3, y - 0.15);
  const liftFloor = cols.floors[cols.floors.length - 1];
  const platform = new THREE.Mesh(painted([[box(5.96, 0.3, 5.96), STEEL], ...[-2.7, 2.7].map((o) => [box(5.96, 0.02, 0.4), '#e8c547', T4(0, 0.16, o)]), ...[-2.7, 2.7].map((o) => [box(0.4, 0.02, 5.96), '#e8c547', T4(o, 0.16, 0)]), [box(0.5, 0.5, 6.4), '#2a2d33', T4(-3.2, -0.3, 0)], [box(0.5, 0.5, 6.4), '#2a2d33', T4(3.2, -0.3, 0)]]),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
  platform.position.set(C.x + LIFT.x, y - 0.15, C.z + LIFT.z); group.add(platform);
  for (const [ox, oz] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) { piece('metal', M.metal, 0.36, DEEP + 5.4, 0.36, LIFT.x + ox, (5.4 - DEEP) / 2, LIFT.z + oz, { color: '#b88a1f' }); cols.addCircle(C.x + LIFT.x + ox, C.z + LIFT.z + oz, 0.26, y - DEEP - 1, y + 5.4); }
  for (const o of [-3.3, 3.3]) { piece('metal', M.metal, 7, 0.4, 0.4, LIFT.x, 5.4, LIFT.z + o, { color: '#b88a1f' }); piece('metal', M.metal, 0.4, 0.4, 7, LIFT.x + o, 5.4, LIFT.z, { color: '#b88a1f' }); }
  piece('metal', M.metal, 2.2, 1.2, 1.6, LIFT.x, 6.1, LIFT.z, { color: '#2a2d33' });
  for (const fl of [0, TUN]) { rail(LIFT.x - 3.1, LIFT.z - 3.1, LIFT.x + 3.1, LIFT.z - 3.1, fl, { color: '#e8c547' }); rail(LIFT.x - 3.1, LIFT.z + 3.1, LIFT.x + 3.1, LIFT.z + 3.1, fl, { color: '#e8c547' }); rail(LIFT.x - 3.1, LIFT.z - 3.1, LIFT.x - 3.1, LIFT.z + 3.1, fl, { color: '#e8c547' }); }
  const topGate = fit.door(LIFT.x + 3.1, LIFT.z, Math.PI / 2, 6, { floor: 0, h: 1.1, mode: 'slide', color: '#e8c547', t: 0.1, lamp: false, label: 'מעלית משא' });
  const lowGate = fit.door(LIFT.x + 3.1, LIFT.z, Math.PI / 2, 6, { floor: TUN, h: 1.1, mode: 'slide', color: '#e8c547', t: 0.1, lamp: false, label: 'מעלית משא · מנהרות' });
  signAt('מעלית משא', LIFT.x + 3.52, 5.4, LIFT.z, Math.PI / 2, 3.4, 0.5, { bg: '#5a4a1d', fg: '#ffffff' });
  const lift = {
    x: C.x + LIFT.x, z: C.z + LIFT.z, half: 3, power: false, level: 0, target: 0, state: 'top', speed: 1.5, top: y, bottom: y + LOW,
    at: P(LIFT.x, LIFT.z), topAt: P(LIFT.x + 5.4, LIFT.z, 0, -Math.PI / 2), bottomAt: P(LIFT.x + 5.4, LIFT.z, TUN, -Math.PI / 2), onTop: P(LIFT.x, LIFT.z, 0), onBottom: P(LIFT.x, LIFT.z, LOW),
    switch: P3(-116, 1.4, ST.z1 - 0.2), switchAt: P(-116, ST.z1 - 1.4, 0, 0), gates: { top: topGate, bottom: lowGate }, platform, pad: liftPad, onArrive: null,
    setPower(on = true) { lift.power = !!on; liftLamp.set(lift.power ? '#2fd27a' : '#ff2a2a'); },
    // 'down' | 'up': the platform travels with whoever stands on it; false without power or when it is there already
    go(dir) {
      if (!lift.power) return false;
      const t = dir === 'down' ? LOW : 0;
      if (Math.abs(lift.level - t) < 0.01 && lift.state !== 'moving') return false;
      lift.target = t; lift.state = 'moving'; topGate.setOpen(false); lowGate.setOpen(false);
      return true;
    },
    // bring the platform to a level: 'top' (the default) | 'bottom', or a position (the level its height is on)
    call(where = 'top') { const down = where === 'bottom' || where === 'down' || (typeof where === 'object' && where.y < y + TUN / 2); return lift.go(down ? 'down' : 'up'); },
    // put the platform at a level at once (restores)
    set(where = 'top') { lift.level = lift.target = where === 'bottom' ? LOW : 0; lift.state = where === 'bottom' ? 'bottom' : 'top'; placeLift(); topGate.setOpen(lift.state === 'top'); lowGate.setOpen(lift.state === 'bottom'); },
    has(p) { return Math.abs(p.x - lift.x) < 3 && Math.abs(p.z - lift.z) < 3 && Math.abs((p.y ?? y) - (y + lift.level)) < 1.3; },
  };
  const placeLift = () => { liftPad.h = y + lift.level - 0.05; liftFloor.y = y + lift.level - 0.15; platform.position.y = y + lift.level - 0.15; };

  // ---------- the tunnels, six metres down: the lobby under the lift, two ways east, a cross passage, two stairs up ----------
  const tw = { t: 0.5, floor: TUN, color: '#34363a', scale: 0.25, key: 'stone', mat: M.stone }, ROCK = '#2f3135';
  slab((PIT.x0 + PIT.x1) / 2, TUN - 0.04, (PIT.z0 + PIT.z1) / 2, PIT.x1 - PIT.x0, 0.1, PIT.z1 - PIT.z0, { key: 'stone', mat: M.stone, color: '#3d3e42', scale: 0.25 });
  holedWall(PIT.x0 + 0.25, PIT.z0, PIT.x0 + 0.25, PIT.z1, TH, [], tw); holedWall(PIT.x1 - 0.25, PIT.z0, PIT.x1 - 0.25, PIT.z1, TH, [], tw);
  holedWall(PIT.x0, PIT.z0 + 0.25, PIT.x1, PIT.z0 + 0.25, TH, [], tw); holedWall(PIT.x0, PIT.z1 - 0.25, PIT.x1, PIT.z1 - 0.25, TH, [], tw);
  for (const r of cutRects(PIT, HOLES)) slab((r.x0 + r.x1) / 2, TUN + TH + 0.15, (r.z0 + r.z1) / 2, r.x1 - r.x0, 0.3, r.z1 - r.z0, { key: 'stone', mat: M.stone, color: '#2a2b2e', scale: 0.25 });
  const rock = (x0, x1, z0, z1) => thing((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, TH, z1 - z0, TUN, ROCK, { key: 'stone', mat: M.stone, cover: false, scale: 0.25 });
  rock(-92, -66, 68, 102); rock(-62, -22.5, 68, 102);
  rock(-34, -22.5, 61.5, 63); rock(-34, -22.5, 66, 68); rock(-34, -22.5, 102, 104); rock(-34, -22.5, 107, 108.5);
  const tunnelStairs = [64.5, 105.5].map((lz) => {
    const f = flight(-34, lz, Math.PI / 2, { rise: DEEP, run: 10.5, steps: 18, floor: TUN, bars: false, color: '#55585e', name: 'citadel tunnel stairs' });
    piece('stone', M.stone, 1.5, DEEP - 0.5, 3, -22.75, TUN + (DEEP - 0.5) / 2, lz, { color: ROCK, scale: 0.25 });
    for (const o of [-1.6, 1.6]) { piece('stone', M.stone, 10.5, 1.7, 0.2, -28.75, -1.1, lz + o, { color: ROCK, scale: 0.25 }); rail(-34.1, lz + o, -23.5, lz + o, 0); }
    piece('stone', M.stone, 0.2, 1.7, 3.4, -34.1, -1.1, lz, { color: ROCK, scale: 0.25 }); rail(-34.1, lz - 1.6, -34.1, lz + 1.6, 0);
    return f;
  });
  for (const [lx, lz, w, d] of [[LIFT.x, LIFT.z - 3.1, 6.4, 0.2], [LIFT.x, LIFT.z + 3.1, 6.4, 0.2], [LIFT.x - 3.1, LIFT.z, 0.2, 6.4], [LIFT.x + 3.1, LIFT.z, 0.2, 6.4]]) piece('stone', M.stone, w, 1.7, d, lx, -1.1, lz, { color: ROCK, scale: 0.25 });
  // pipes along the walls, valves, dim amber strips in the ceiling, a little red by the stairs
  const pipeX = (x0, x1, lz, ly, r = 0.22, color = '#6b6f75') => geo('metal', M.metal, new THREE.CylinderGeometry(r, r, x1 - x0, 8).rotateZ(Math.PI / 2), (x0 + x1) / 2, TUN + ly, lz, 0, color);
  const pipeZ = (z0, z1, lx, ly, r = 0.22, color = '#6b6f75') => geo('metal', M.metal, new THREE.CylinderGeometry(r, r, z1 - z0, 8).rotateX(Math.PI / 2), lx, TUN + ly, (z0 + z1) / 2, 0, color);
  pipeX(-92, -36, 67.6, 3.4); pipeX(-92, -36, 67.6, 2.7, 0.14, '#7a4a2b'); pipeX(-92, -36, 102.4, 3.4); pipeX(-92, -36, 102.4, 2.7, 0.14, '#7a4a2b');
  pipeX(-109, -36, 61.9, 3.5, 0.3, '#4a5560'); pipeX(-109, -36, 108.1, 3.5, 0.3, '#4a5560');
  pipeZ(62, 108, -109.3, 3.4, 0.3, '#4a5560'); pipeZ(62, 108, -109.3, 2.6, 0.16, '#7a4a2b'); pipeZ(68, 102, -65.6, 3.5); pipeZ(68, 102, -62.4, 3.5, 0.14, '#7a4a2b');
  for (const [lx, lz] of [[-80, 67.6], [-50, 67.6], [-80, 102.4], [-50, 102.4]]) { piece('metal', M.metal, 0.5, 0.5, 0.5, lx, TUN + 3.4, lz, { color: '#3a3d44' }); piece('paint', M.paint, 0.5, 0.5, 0.06, lx, TUN + 2.9, lz + (lz < 85 ? -0.3 : 0.3), { color: '#b33a2a', uv: 'keep' }); }
  for (const [lx, lz] of [[-100, 68], [-100, 102], [-84, 64.5], [-64, 64.5], [-44, 64.5], [-84, 105.5], [-64, 105.5], [-44, 105.5], [-64, 85], [-96, 85]]) piece('glow', glow, 1.6, 0.06, 0.3, lx, TUN + TH - 0.04, lz, { color: '#ffb65c', uv: 'keep' });
  for (const lz of [64.5, 105.5]) piece('glow', glow, 0.06, 0.3, 1.2, -35.9, TUN + 3.2, lz, { color: '#ff5a4a', uv: 'keep' });
  for (const [lx, lz, ly] of [[-101, 72, 3.6], [-64, 85, 3.6], [-50, 64.5, 3.6], [-50, 105.5, 3.6]]) lampAt(lx, TUN + ly, lz, { range: 17, intensity: 18, color: '#ffcf8a' });
  for (const [lx, lz] of [[-80, 62.5], [-52, 62.5], [-76, 107.5], [-48, 107.5], [-94, 64], [-94, 106], [-103, 97], [-101.6, 98.2]]) thing(lx, lz, 1.3, 1.1, 1.3, TUN, '#6b5a3e', { key: 'wood', mat: M.plaster });
  thing(-106, 76, 1.0, 0.9, 2.6, TUN, '#3a3f47');
  signAt('מנהרות · מפלס תחתון', -109.2, TUN + 3.0, 72, Math.PI / 2, 3.6, 0.44); signAt('יציאה · המתחם הפנימי', -36.2, TUN + 3.2, 61.82, 0, 3.6, 0.44, { bg: '#0f5a2c', fg: '#ffffff' }); signAt('יציאה · מתקני האנרגיה', -36.2, TUN + 3.2, 108.18, Math.PI, 3.6, 0.44, { bg: '#0f5a2c', fg: '#ffffff' });

  // ---------- the inner compound: the forecourt's pylons, control room B, the plant house, reactors, filler ----------
  const pylons = [];
  for (const lx of [-40, -20, 0, 20]) for (const lz of [-9, 9]) {
    geo('metal', M.metal, new THREE.CylinderGeometry(0.22, 0.5, 10, 8), lx, 5, lz, 0, '#2a2d33'); roundAt(lx, lz, 0.5, 0, 10);
    for (const ly of [6, 7.5, 9]) geo('glow', glow, new THREE.CylinderGeometry(0.5, 0.5, 0.16, 10), lx, ly, lz, 0, VIOLET);
    const lamp = fit.indicator(lx, 10.4, lz, 0.4, VIOLET);
    const p = { i: pylons.length, ...P3(lx, 10.4, lz), base: P(lx, lz), r: 0.5, live: true, lamp, set(live) { p.live = live; lamp.set(live ? VIOLET : '#1a1a1e'); } };
    pylons.push(p);
  }
  // control room B (חדר בקרה ב): one tall room, the main computer on the north wall, a door west, south and east
  const CB = { x0: -44, x1: -12, z0: -44, z1: -16 }, cbw = { t: 0.5, color: WALLC, scale: 0.25 }, dh = { y0: 0, y1: 2.6 };
  holedWall(CB.x0, CB.z0, CB.x0, CB.z1, 6.7, [{ a0: 12.9, a1: 15.1, ...dh }], cbw); holedWall(CB.x0, CB.z1, CB.x1, CB.z1, 6.7, [{ a0: 14.9, a1: 17.1, ...dh }], cbw);
  holedWall(CB.x1, CB.z1, CB.x1, CB.z0, 6.7, [{ a0: 12.9, a1: 15.1, ...dh }], cbw); holedWall(CB.x1, CB.z0, CB.x0, CB.z0, 6.7, [], cbw);
  level(-28, -30, 16.25, 14.25, 7, { color: '#3a3d44', name: 'citadel control roof', thick: 0.3 });
  const ctrlDoors = [fit.door(CB.x0, -30, Math.PI / 2, 2.2, { h: 2.6, color: '#30343b', label: 'חדר בקרה ב · מערב' }), fit.door(-28, CB.z1, 0, 2.2, { h: 2.6, color: '#30343b', label: 'חדר בקרה ב · דרום' }), fit.door(CB.x1, -30, Math.PI / 2, 2.2, { h: 2.6, color: '#30343b', label: 'חדר בקרה ב · מזרח' })];
  thing(-28, -42.7, 14, 1.1, 1.4, 0, '#16181c'); for (let lx = -34; lx <= -22; lx += 2) piece('glow', glow, 1.4, 0.05, 0.6, lx, 1.13, -42.5, { color: '#59c7ff', uv: 'keep' });
  const compScreen = makeScreen(); compScreen.show('map');
  const compMesh = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.6), compScreen.mat); compMesh.position.set(C.x - 28, y + 3.9, C.z + CB.z0 + 0.3); group.add(compMesh);
  piece('paint', M.paint, 13.6, 4.0, 0.08, -28, 3.9, CB.z0 + 0.28, { color: '#0c0d10', uv: 'keep' });
  for (const lx of [-41, -15]) { thing(lx, -40.4, 4, 2.4, 1.0, 0, '#16191e', { key: 'metal', mat: M.metal }); for (let t = -1.5; t <= 1.5; t += 1) piece('glow', glow, 0.4, 0.05, 0.02, lx + t, 1.7, -39.88, { color: t ? '#2fd27a' : '#59c7ff', uv: 'keep' }); }
  thing(-36, -30, 0.8, 0.95, 3.2, 0, '#3a3f47'); thing(-28, -22, 3.2, 0.95, 0.8, 0, '#3a3f47'); thing(-20, -30, 0.8, 0.95, 3.2, 0, '#3a3f47');
  signAt('חדר בקרה ב', CB.x0 - 0.27, 3.2, -30, -Math.PI / 2, 2.8, 0.44); signAt('חדר בקרה ב', -28, 3.2, CB.z1 + 0.27, 0, 2.8, 0.44); signAt('חדר בקרה ב', CB.x1 + 0.27, 3.2, -30, Math.PI / 2, 2.8, 0.44);
  signAt('המחשב הראשי', -28, 6.05, CB.z0 + 0.3, 0, 3.4, 0.46, { fg: '#ff9180' });
  for (const lx of [-36, -20]) { piece('glow', glow, 3, 0.05, 0.5, lx, 6.62, -30, { color: '#e9ecff', uv: 'keep' }); lampAt(lx, 6.2, -30, { range: 22, intensity: 40 }); }
  // the plant house: stairs inside up to its roof (the way out comes down them), transformers
  const PL = { x0: -52, x1: -28, z0: 28, z1: 52 }, PH = { x0: -45, x1: -32.4, z0: 47.1, z1: 49.9 };
  holedWall(PL.x0, PL.z0, PL.x0, PL.z1, 6.7, [{ a0: 10.9, a1: 13.1, ...dh }], cbw); holedWall(PL.x0, PL.z1, PL.x1, PL.z1, 6.7, [], cbw);
  holedWall(PL.x1, PL.z1, PL.x1, PL.z0, 6.7, [{ a0: 16.5, a1: 19.5, y0: 0, y1: 3 }], cbw); holedWall(PL.x1, PL.z0, PL.x0, PL.z0, 6.7, [], cbw);
  for (const r of cutRects({ x0: PL.x0 - 0.25, x1: PL.x1 + 0.25, z0: PL.z0 - 0.25, z1: PL.z1 + 0.25 }, [PH])) level((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, (r.x1 - r.x0) / 2, (r.z1 - r.z0) / 2, 7, { color: '#3a3d44', name: 'citadel plant roof', thick: 0.3 });
  const plantStairs = flight(-45, 48.5, Math.PI / 2, { rise: 7, run: 12.6, steps: 20, floor: 0, width: 2.6, enclose: true, name: 'citadel plant stairs' });
  rail(-45.1, 47.1, -45.1, 49.9, 7);
  for (const lx of [-36, -42]) { thing(lx, 31.5, 3, 2.6, 2.4, 0, '#4a5560', { key: 'metal', mat: M.metal }); for (const o of [-0.8, 0, 0.8]) geo('glow', glow, new THREE.CylinderGeometry(0.22, 0.22, 0.7, 8), lx + o, 2.95, 31.5, 0, '#59c7ff'); }
  piece('paint', M.paint, 0.14, 0.7, 0.5, PL.x0 - 0.32, 1.4, 44, { color: '#2a2d33', uv: 'keep' });
  const servLamp = fit.indicator(PL.x0 - 0.42, 1.9, 44, 0.07, '#ff2a2a');
  signAt('מתקני אנרגיה', PL.x1 + 0.27, 3.6, 34, Math.PI / 2, 3.0, 0.44, { fg: '#9fdcff' }); signAt('יציאה לחצר', PL.x0 - 0.27, 3.1, 40, -Math.PI / 2, 2.4, 0.4, { bg: '#0f5a2c', fg: '#ffffff' });
  lampAt(-40, 6.2, 40, { range: 20, intensity: 34 });
  // energy plants: reactors with glowing cores
  const reactors = [];
  for (const [lx, lz] of [[-6, 62], [14, 82], [-6, 100], [140, -70], [140, 70]]) {
    geo('metal', M.metal, new THREE.CylinderGeometry(4, 4.4, 8, 20), lx, 4, lz, 0, '#2f3338'); geo('glow', glow, new THREE.CylinderGeometry(4.08, 4.08, 1.3, 20), lx, 4, lz, 0, '#7c4dff');
    geo('metal', M.metal, new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lx, 8, lz, 0, '#3a3f47'); geo('metal', M.metal, new THREE.CylinderGeometry(0.9, 1.2, 3, 10), lx, 12.4, lz, 0, '#2a2d33');
    roundAt(lx, lz, 4.5, 0, 12); S.cover.push({ ...toWorld(lx, lz), y, w: 8.8, d: 8.8 });
    const lamp = fit.indicator(lx, 14.3, lz, 0.6, VIOLET);
    const r = { i: reactors.length, ...P3(lx, 4, lz), r: 4.3, base: P(lx, lz), at: P(lx - 7, lz, 0, Math.PI / 2), live: true, lamp, set(live) { r.live = live; lamp.set(live ? VIOLET : '#1a1a1e'); } };
    reactors.push(r);
  }
  piece('metal', M.metal, 0.5, 0.5, 28.3, 4, 6.4, 72, { yaw: Math.PI / 4, color: '#6b6f75' }); piece('metal', M.metal, 0.5, 0.5, 26.9, 4, 6.4, 91, { yaw: -Math.atan2(20, 18), color: '#6b6f75' });
  for (const [lx, lz, yaw] of [[-14, 78, 0], [22, 66, 1.57], [-16, 94, 1.57], [24, 100, 0], [10, 56, 0]]) thing(lx, lz, 3, 1.3, 1.2, 0, '#4a5560', { key: 'metal', mat: M.metal, yaw });
  // filler that gives the fortress its skyline: the north hall, two cooling towers, the east blocks
  thing(72, -86, 56, 10, 30, 0, '#ffffff', { key: 'win', mat: win, cover: false, scale: 1 / 12 }); piece('plaster', M.plaster, 57, 0.6, 31, 72, 10.3, -86, { color: DARK });
  for (const lx of [142]) for (const lz of [-30, 30]) { thing(lx, lz, 28, 9, 22, 0, '#ffffff', { key: 'win', mat: win, cover: false, scale: 1 / 12 }); piece('plaster', M.plaster, 29, 0.6, 23, lx, 9.3, lz, { color: DARK }); }
  const cooling = new THREE.LatheGeometry([[9, 0], [7.6, 5], [6.4, 10], [6.2, 13], [6.8, 16], [7.4, 18]].map(([r, h]) => new THREE.Vector2(r, h)), 24);
  for (const lx of [60, 84]) { geo('plaster', M.plaster, cooling, lx, 0, 88, 0, '#7d7a74'); roundAt(lx, 88, 9, 0, 18); beacons.push(fit.indicator(lx, 18.6, 88, 0.3, '#ff3030')); }
  signAt('מתקני אנרגיה', -22, 3.4, 108.9, 0, 3.4, 0.5, { fg: '#9fdcff' });

  // ---------- bridges between the roofs at +7 m ----------
  const deck = { key: 'metal', mat: M.metal, color: STEEL, name: 'citadel bridge', thick: 0.3, scale: 0.5 };
  const post = (lx, lz, h) => { piece('metal', M.metal, 0.6, h - 0.3, 0.6, lx, (h - 0.3) / 2, lz, { color: '#33373e' }); roundAt(lx, lz, 0.42, 0, h - 0.4); };
  for (const [x0, z0, x1, z1] of [[CB.x0, CB.z0, CB.x0, CB.z1], [CB.x0, CB.z0, CB.x1, CB.z0], [CB.x1, CB.z0, CB.x1, -25.5], [CB.x1, -22.5, CB.x1, CB.z1], [CB.x0, CB.z1, -37.5, CB.z1], [-34.5, CB.z1, CB.x1, CB.z1]]) rail(x0, z0, x1, z1, 7);
  for (const [x0, z0, x1, z1] of [[PL.x0, PL.z0, PL.x0, PL.z1], [PL.x0, PL.z1, PL.x1, PL.z1], [PL.x0, PL.z0, -37.5, PL.z0], [-34.5, PL.z0, PL.x1, PL.z0], [PL.x1, PL.z0, PL.x1, 36.75], [PL.x1, 39.75, PL.x1, PL.z1]]) rail(x0, z0, x1, z1, 7);
  level(9.75, -24, 21.75, 1.5, 7, deck); rail(CB.x1, -25.5, 31.5, -25.5, 7); rail(CB.x1, -22.5, 31.5, -22.5, 7); post(2, -24, 7); post(18, -24, 7);       // A: control roof — the energy hall's door
  level(-36, 6, 1.5, 22, 7, deck); rail(-37.5, CB.z1, -37.5, PL.z0, 7); rail(-34.5, CB.z1, -34.5, PL.z0, 7); post(-36, -11, 7); post(-36, 14, 7);            // C: control roof — plant roof
  level(27, 38.25, 17, 1.5, 7, deck); level(-11, 38.25, 17, 1.5, 7, deck);                                                                                     // B: the fire stairs' foot — plant roof, with a gap
  for (const lz of [36.75, 39.75]) { rail(10, lz, 44, lz, 7); rail(PL.x1, lz, 6, lz, 7); }
  for (const lx of [34, 20, -6, -20]) post(lx, 38.25, 7);
  for (const [lx, a] of [[9.2, 0.5], [6.8, -0.6]]) for (const o of [-1, 0.2, 1.1]) piece('paint', M.paint, 0.06, 0.06, 1.6, lx, 6.5, 38.25 + o, { yaw: Math.PI / 2, pitch: a, color: '#5a3a2a', uv: 'keep' });
  const gapBars = [10.1, 5.9].map((lx) => { const b = cols.addDynamicBox({ name: 'citadel gap' }, 0.1, 1.5); CollisionWorld.setBox(b, C.x + lx, C.z + 38.25, 0, y + 6.7, y + 9); return b; });

  // ---------- the bridgehead on control room B's roof and the tower bridge at +14 m ----------
  const head = flight(-41, -40, Math.PI / 2, { rise: 7, run: 12.6, steps: 20, floor: 7, width: 2.4, thin: true, enclose: true, name: 'citadel bridgehead' });
  level(-20.2, -36, 8.2, 6, BRIDGE.y, deck);
  for (const [lx, lz] of [[-28, -41.6], [-28, -30.4], [-12.4, -41.6], [-12.4, -30.4]]) piece('metal', M.metal, 0.4, 6.9, 0.4, lx, 10.4, lz, { color: '#33373e' });
  for (const [x0, z0, x1, z1] of [[-28.4, -42, -12, -42], [-28.4, -42, -28.4, -41.3], [-28.4, -38.7, -28.4, -30], [-28.4, -30, -12, -30], [-12, -42, -12, -37.5], [-12, -36.3, -12, -33.5], [-12, -30.5, -12, -30]]) rail(x0, z0, x1, z1, BRIDGE.y);
  const SEG = (BRIDGE.x1 - BRIDGE.x0) / BRIDGE.n, jx = (k) => BRIDGE.x0 + k * SEG;
  level(30.25, -34.25, 1.25, 3.75, BRIDGE.y, deck);                                              // the ledge at the upper door
  level((BRIDGE.x0 + BRIDGE.x1) / 2, -36.9, (BRIDGE.x1 - BRIDGE.x0) / 2, 0.6, BRIDGE.y, { ...deck, color: '#6b5a1f' });   // the service catwalk: the marked detour
  for (let k = 1; k < BRIDGE.n; k++) level(jx(k), -34.9, 0.6, 1.45, BRIDGE.y, { ...deck, color: '#6b5a1f' });
  for (let lx = BRIDGE.x0 + 1.5; lx < BRIDGE.x1; lx += 3) piece('glow', glow, 0.5, 0.02, 0.5, lx, BRIDGE.y + 0.012, -36.9, { yaw: Math.PI / 4, color: '#ffd34d', uv: 'keep' });
  rail(BRIDGE.x0, -30.5, 31.5, -30.5, BRIDGE.y, { draw: false }); rail(BRIDGE.x0, -37.5, BRIDGE.x1, -37.5, BRIDGE.y); rail(BRIDGE.x1, -38, 31.5, -38, BRIDGE.y); rail(BRIDGE.x1, -36.3, BRIDGE.x1, -33.5, BRIDGE.y);
  rail(BRIDGE.x1, -30.5, 31.5, -30.5, BRIDGE.y);
  for (let k = 0; k < BRIDGE.n; k++) { const a = k === 0 ? BRIDGE.x0 : jx(k) + 0.6, b = k === BRIDGE.n - 1 ? BRIDGE.x1 : jx(k + 1) - 0.6; rail(a, -33.5, b, -33.5, BRIDGE.y, { draw: false }); rail(a, -36.3, b, -36.3, BRIDGE.y); }
  for (const k of [2, 4, 6]) { piece('metal', M.metal, 0.7, BRIDGE.y - 0.3, 0.7, jx(k), (BRIDGE.y - 0.3) / 2, -35.4, { color: '#33373e' }); roundAt(jx(k), -35.4, 0.5, 0, BRIDGE.y - 0.4); }
  signAt('גשר המגדל', -12.2, BRIDGE.y + 2.6, -32, -Math.PI / 2, 3.0, 0.46, { fg: '#c9a8ff' });
  const segGeo = painted([[box(SEG - 0.08, 0.3, 3), STEEL, T4(0, -0.15, 0)], [box(SEG - 0.08, 0.5, 0.2), '#33373e', T4(0, -0.55, 1.3)], [box(SEG - 0.08, 0.5, 0.2), '#33373e', T4(0, -0.55, -1.3)],
    ...[1.05, 0.55].flatMap((h) => [[box(SEG - 0.08, 0.06, 0.06), '#2a2d33', T4(0, h, 1.47)], [box(SEG - 1.3, 0.06, 0.06), '#2a2d33', T4(0, h, -1.47)]]),
    ...[-1, 1].flatMap((s) => [[box(0.06, 1.05, 0.06), '#2a2d33', T4(s * (SEG / 2 - 0.7), 0.52, -1.47)], [box(0.06, 1.05, 0.06), '#2a2d33', T4(s * (SEG / 2 - 0.1), 0.52, 1.47)]])]);
  const segIM = new THREE.InstancedMesh(segGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), BRIDGE.n);
  segIM.frustumCulled = false; group.add(segIM);
  const so = new THREE.Object3D();
  const segments = [];
  for (let i = 0; i < BRIDGE.n; i++) {
    const mx = (jx(i) + jx(i + 1)) / 2, w = toWorld(mx, BRIDGE.z);
    const pad = ctx.net.addPad({ x: w.x, z: w.z, hx: SEG / 2, hz: 1.5, yaw: 0, h: y + BRIDGE.y - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'citadel tower bridge' });
    cols.addFloor(w.x - SEG / 2, w.z - 1.5, w.x + SEG / 2, w.z + 1.5, y + BRIDGE.y - 0.15);
    const floor = cols.floors[cols.floors.length - 1];
    const bar = cols.addDynamicBox({ name: 'citadel bridge gap' }, SEG / 2 - 0.15, 1.5); CollisionWorld.setBox(bar, w.x, w.z, 0, y + BRIDGE.y - 0.3, y + BRIDGE.y + 2.2); bar.enabled = false;
    segments.push({ i, x0: C.x + jx(i), x1: C.x + jx(i + 1), centre: P(mx, BRIDGE.z, BRIDGE.y), from: P(jx(i) - 0.7, BRIDGE.z, BRIDGE.y, Math.PI / 2), to: P(jx(i + 1) + 0.7, BRIDGE.z, BRIDGE.y, Math.PI / 2), dropped: false, pad, floor, bar, fall: -1 });
  }
  const drawSeg = (s) => {
    const t = Math.max(0, s.fall), drop = 4.9 * t * t;
    if (s.dropped && s.fall < 0) so.scale.setScalar(0); else { so.scale.setScalar(1); so.position.set(s.centre.x, y + BRIDGE.y - drop, s.centre.z); so.rotation.set(0, 0, s.dropped ? t * 0.5 * (s.i % 2 ? 1 : -1) : 0); }
    so.updateMatrix(); segIM.setMatrixAt(s.i, so.matrix); segIM.instanceMatrix.needsUpdate = true;
  };
  const towerBridge = {
    y: y + BRIDGE.y, n: BRIDGE.n, length: BRIDGE.x1 - BRIDGE.x0, segments,
    head: { foot: P(-42.4, -40, 7, Math.PI / 2), stairs: head, top: P(-27, -40, BRIDGE.y, Math.PI / 2), platform: P(-20, -36, BRIDGE.y) },
    start: P(BRIDGE.x0 - 1, BRIDGE.z, BRIDGE.y, Math.PI / 2), end: P(30.2, BRIDGE.z, BRIDGE.y, Math.PI / 2),
    detour: { catwalk: [P(BRIDGE.x0 + 0.5, -36.9, BRIDGE.y), P(BRIDGE.x1 + 0.6, -36.9, BRIDGE.y)], links: [...Array(BRIDGE.n - 1).keys()].map((k) => P(jx(k + 1), -34.9, BRIDGE.y)) },
    // segment i falls (the mission warns first): its walking surface, its floor and its deck go, a bar keeps
    // walkers out of the hole; the catwalk beside it and the leap spots (from, to) stay. instant: no fall shown
    drop(i, instant = false) {
      const s = segments[i]; if (!s || s.dropped) return false;
      s.dropped = true; ctx.net.removePad(s.pad); const k = cols.floors.indexOf(s.floor); if (k >= 0) cols.floors.splice(k, 1);
      s.bar.enabled = true; s.fall = instant ? -1 : 0; drawSeg(s);
      return true;
    },
    restore(i = null) {
      for (const s of segments) { if (i != null && s.i !== i) continue; if (!s.dropped) continue; s.dropped = false; s.fall = -1; s.bar.enabled = false; ctx.net.restorePad(s.pad); if (!cols.floors.includes(s.floor)) cols.floors.push(s.floor); drawSeg(s); }
    },
    dropped() { return segments.filter((s) => s.dropped).map((s) => s.i); },
    segmentAt(p) { if (Math.abs(p.z - (C.z + BRIDGE.z)) > 1.6 || Math.abs((p.y ?? y + BRIDGE.y) - (y + BRIDGE.y)) > 1.5) return -1; const k = Math.floor((p.x - C.x - BRIDGE.x0) / SEG); return k >= 0 && k < BRIDGE.n ? k : -1; },
  };
  for (const s of segments) drawSeg(s);

  // ---------- the central tower: its own group ----------
  const T = buildCentralTower(ctx, C, y);
  const stubs = [[31.2, -24, 0.1, 1.5, 7], [43.8, 38.25, 0.1, 1.5, 7], [29.3, -34.25, 0.1, 3.75, BRIDGE.y]].map(([lx, lz, hx, hz, fl]) => { const b = cols.addDynamicBox({ name: 'citadel stub' }, hx, hz); CollisionWorld.setBox(b, C.x + lx, C.z + lz, 0, y + fl - 0.3, y + fl + 2.2); b.enabled = false; return b; });

  // ---------- the way out (mission 58): the route from the last hall to the armoured car, marked ----------
  const armoured = {
    spot: P(-140, 110, 0, Math.PI), model: makeArmoured, bay: P(-140, 104), door: P(-140, BAY.z0), boardAt: P(-142.9, 110, 0, Math.PI / 2), halfExtents: { x: 1.5, z: 3.85 },
    route: [P(-140, 110), P(-140, 92), P(-148, 83), P(-158, SERV_Z), P(-170, SERV_Z), out(-186, SERV_Z)], outside: out(-186, SERV_Z, -Math.PI / 2),
  };
  const X = T.lastHall.exit, leapFrom = P(10.9, 38.25, 7, -Math.PI / 2), leapTo = P(5.1, 38.25, 7, -Math.PI / 2);
  const route = [X.inside, X.outside, { ...T.fireStairs.flights[1].top }, { ...T.fireStairs.flights[1].bottom }, { ...T.fireStairs.flights[0].top }, { ...T.fireStairs.flights[0].bottom }, P(44.6, 38.25, 7), leapFrom, leapTo,
    P(-29.8, 38.25, 7), P(-30.2, 48.5, 7), { ...plantStairs.top }, { ...plantStairs.bottom }, P(-48.6, 48.5, 0), P(-49.6, 40, 0), P(-55, 40, 0), P(-62, 40, 0), P(-112, 60, 0), P(-126, 90, 0), P(-140, 94, 0), armoured.boardAt];
  const chevrons = routeMarks(route.map((p) => ({ x: p.x, y: p.y, z: p.z }))); group.add(chevrons);
  const wayOut = {
    route, marked: false, leapIndex: 7,
    mark(on = true) { chevrons.visible = on; wayOut.marked = on; },
    // two doors that lock, each with its switch: [0] the last hall's emergency door, [1] the service door in the inner wall
    doors: [
      { door: X.door, lamp: X.lamp, switch: X.switch, switchAt: X.switchAt, before: X.inside, after: X.outside },
      { door: servDoor, lamp: servLamp, switch: P3(PL.x0 - 0.4, 1.4, 44), switchAt: P(-53.7, 44, 0, Math.PI / 2), before: P(-55, 40, 0, -Math.PI / 2), after: P(-62, 40, 0, -Math.PI / 2) },
    ],
    throwSwitch(i, on = true) { const d = wayOut.doors[i]; if (on) { d.door.unlock(); d.door.setOpen(true); } else d.door.lock(); d.lamp.set(on ? '#2fd27a' : '#ff2a2a'); },
    // the gap in bridge B: leap from `from` to `to` (4.2 m); bars keep walkers out of the hole (guard(false) lifts them)
    leap: { from: leapFrom, to: leapTo, gap: 4.2, bars: gapBars, guard(on = true) { for (const b of gapBars) b.enabled = on; } },
    fallen: P(-38, 42, 0, Math.PI / 2), fallenAt: P(-39.5, 42, 0, Math.PI / 2),
    blasts: [P(62, 22, TF[3]), P(92, 26, TF[3]), P(74, 43, 0), P(36, 38.25, 7), P(22, 45, 0), P(-2, 50, 0), P(-16, 38.25, 7), P(-40, 34, 7), P(-34, 38, 0), P(-72, 52, 0), P(-100, 50, 0), P(-120, 76, 0), P(-134, 88, 0)],
    routeIndex(p) { let best = 0, bd = Infinity; route.forEach((q, i) => { if (Math.abs(q.y - (p.y ?? q.y)) > 1.6) return; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = i; } }); return best; },
    armoured,
  };
  wayOut.mark(false);

  signsMesh(S, signs, 'citadel-signs');
  S.finish();
  for (const d of [...storeDoors, alarmDoor, ...ctrlDoors]) { d.unlock(); d.setOpen(true); }
  topGate.setOpen(true);

  // ---------- what the missions use ----------
  const alarm = {
    active: false, room: P(-142, -16), door: alarmDoor, doorAt: P(-131.6, -16, 0, -Math.PI / 2), panel: P3(AR.x0 + 0.4, 1.5, -16), panelAt: P(-148.4, -16, 0, -Math.PI / 2),
    fuse: P3(-84, 1.5, ST.z1 - 0.7), fuseAt: P(-84, ST.z1 - 2.0, 0, 0), fuseLamp, lamp: alarmLamp,
    sirens: sirenAt.map(([lx, ly, lz]) => P3(lx, ly, lz)), lights: poolAt.map(([lx, lz]) => P3(lx, 9, lz)),
    // on: the sirens flash and the yard lies in red light until it is switched off
    on(v = true) { alarm.active = !!v; pools.visible = alarm.active; if (!alarm.active) { for (const s of sirens) s.set('#3a0a0a'); alarmLamp.set('#2fd27a'); } fuseLamp.set(alarm.active ? '#ff2a2a' : '#2fd27a'); },
  };
  const innerGate = gateOf(innerLeaf, {
    at: P(IW, 0), outside: P(IW - 8, 0, 0, Math.PI / 2), inside: P(IW + 8, 0, 0, Math.PI / 2),
    wheelA: P3(-56.45, 1.3, -7), wheelB: P3(-56.45, 1.3, 7), wheelAAt: P(-55.3, -7, 0, -Math.PI / 2), wheelBAt: P(-55.3, 7, 0, -Math.PI / 2), wheels,
    spin(i, angle) { wheels[i].rotation.z = angle; }, cover: [P(-48, -12, 0), P(-48, 12, 0)], threats: [P(-30, -4, 0), P(-30, 4, 0), P(-20, 0, 0)],
  });
  let clock = 0;
  const state = T.state;
  const citadel = {
    x: C.x, z: C.z, y, toWorld, F: FLOORS, box: { x0: C.x - HX, x1: C.x + HX, z0: C.z - HZ, z1: C.z + HZ },
    // every level's height (world y): tunnels, yard, bridges, watch, towerBridge, and tower 0..3
    floorY(k) { return y + (typeof k === 'number' ? TF[k] : FLOORS[k] ?? 0); },
    floors: [{ name: 'המנהרות', y: y + TUN }, { name: 'החצר', y }, { name: 'הגשרים', y: y + 7 }, { name: 'עמדות השמירה', y: y + 9 }, { name: 'גשר המגדל', y: y + BRIDGE.y }, ...T_NAMES.map((name, k) => ({ name, y: y + TF[k], tower: k }))],
    near(a, b, r) { return Math.hypot(a.x - b.x, a.z - b.z) < r && Math.abs((a.y ?? y) - (b.y ?? y)) < 1.8; },
    inside: (x, z) => Math.abs(x - C.x) < HX && Math.abs(z - C.z) < HZ,
    inYard: (x, z) => x > C.x - HX && x < C.x + IW && Math.abs(z - C.z) < HZ,
    inInner: (x, z) => x > C.x + IW && x < C.x + HX && Math.abs(z - C.z) < HZ,
    inTower: (x, z) => x > C.x + T.box.x0 && x < C.x + T.box.x1 && z > C.z + T.box.z0 && z < C.z + T.box.z1,
    inTunnels: (p) => p.y < y - 2.5 && p.x > C.x + PIT.x0 && p.x < C.x + PIT.x1 && p.z > C.z + PIT.z0 && p.z < C.z + PIT.z1,
    // the west wall
    gates: {
      main: gateOf(mainLeaf, { at: P(-HX, MAIN_Z), outside: out(-HX - 7, MAIN_Z, Math.PI / 2), inside: P(-HX + 10, MAIN_Z, 0, Math.PI / 2), approach: out(-HX - 22, MAIN_Z, Math.PI / 2) }),
      service: gateOf(servLeaf, { at: P(-HX, SERV_Z), outside: out(-HX - 7, SERV_Z, Math.PI / 2), inside: P(-HX + 10, SERV_Z, 0, Math.PI / 2), approach: out(-HX - 22, SERV_Z, Math.PI / 2) }),
    },
    // the yard
    yard: { centre: P(-112, -10), mainLane: [P(-160, MAIN_Z), P(-72, MAIN_Z)], spine: [P(-67, -56), P(-67, 60)], serviceLane: [P(-160, SERV_Z), P(-116, SERV_Z)], containers: P(-122, -92), tanks: P(-78, -102), crane: P(CR.x + 4, CR.z + 4) },
    vehicles, cars: vehicles.filter((v) => v.kind === 'car'), lorries: vehicles.filter((v) => v.kind === 'lorry'), floodlights, cover: S.cover, towers,
    stores: { doors: storeDoors, rooms: [0, 1, 2, 3].map((i) => P(ST.x0 + 8 + 16 * i, 117)), fronts: [0, 1, 2, 3].map((i) => P(ST.x0 + 8 + 16 * i, 107.6, 0, 0)), power: 0, fuse: 2 },
    alarm, lift,
    tunnels: {
      y: y + TUN, lobby: P(-101, 72, TUN), liftFront: lift.bottomAt, north: [P(-90, 64.5, TUN), P(-64, 64.5, TUN), P(-38, 64.5, TUN)], south: [P(-90, 105.5, TUN), P(-64, 105.5, TUN), P(-38, 105.5, TUN)], cross: P(-64, 85, TUN),
      exits: { north: { stairs: tunnelStairs[0], foot: P(-35.5, 64.5, TUN, Math.PI / 2), top: P(-20.5, 64.5, 0, Math.PI / 2) }, south: { stairs: tunnelStairs[1], foot: P(-35.5, 105.5, TUN, Math.PI / 2), top: P(-20.5, 105.5, 0, Math.PI / 2) } },
    },
    innerGate,
    // the inner compound
    control: {
      room: P(-28, -30), roof: P(-28, -24, 7), doors: ctrlDoors,
      computer: { at: P(-28, -40.9, 0, Math.PI), pos: P3(-28, 1.2, -42.7), screen: compScreen },
      approaches: [
        { name: 'west', door: ctrlDoors[0], inside: P(-41.4, -30, 0, -Math.PI / 2), outside: P(-47.6, -30, 0, Math.PI / 2), post: P(-34.7, -30, 0, -Math.PI / 2), from: P(-52, -70, 0) },
        { name: 'south', door: ctrlDoors[1], inside: P(-28, -18.6, 0, 0), outside: P(-28, -12.4, 0, Math.PI), post: P(-28, -23.3, 0, 0), from: P(-6, -4, 0) },
        { name: 'east', door: ctrlDoors[2], inside: P(-14.6, -30, 0, Math.PI / 2), outside: P(-8.4, -30, 0, -Math.PI / 2), post: P(-21.3, -30, 0, Math.PI / 2), from: P(14, -52, 0) },
      ],
    },
    computer: null,
    plant: { room: P(-40, 40), roof: P(-42, 36, 7), stairs: plantStairs, westDoor: P(PL.x0, 40), eastDoor: P(PL.x1, 34) },
    energy: { reactors, pylons, field: P(4, 80), forecourt: P(-10, 0) },
    bridges: { y: y + 7, a: [P(-11, -24, 7), P(30.6, -24, 7)], b: [P(43, 38.25, 7), P(-27, 38.25, 7)], c: [P(-36, -15, 7), P(-36, 27, 7)], controlRoof: P(-28, -24, 7), plantRoof: P(-42, 36, 7) },
    towerBridge,
    // the central tower (its own group): the halls, floor by floor
    tower: T, mainHall: T.mainHall, energyHall: T.energyHall, machine: T.machine, lastHall: T.lastHall, fireStairs: T.fireStairs,
    screen: T.mainHall.screen, medkit: T.mainHall.medkit, portalAt: T.lastHall.portalAt,
    wayOut, armoured,
    doors: [...fit.doors, ...T.doors],
    // where a guard stands or walks (every point with its floor's y; no leg passes a door that can be locked)
    patrols: {
      gateMain: [P(-154, -66), P(-154, -54)], gateService: [P(-156, 75), P(-156, 85)], yardNW: [P(-150, -92), P(-120, -92)], yardNE: [P(-92, -92), P(-76, -92)], mainLane: [P(-140, MAIN_Z), P(-80, MAIN_Z)],
      spine: [P(-67, -50), P(-67, 60)], containers: [P(-108, 8), P(-136, 8)], yardS: [P(-150, 62), P(-124, 62)], storesFront: [P(-116, 106), P(-70, 106)],
      alarmRoom: [P(-142, -16, 0, Math.PI / 2)], alarmDoor: [P(-131, -16, 0, Math.PI / 2)], liftPost: [P(-95, 85, 0, Math.PI / 2)], bay: [P(-140, 93, 0, Math.PI)], fuseRoom: [P(-86, 117, 0, Math.PI)], powerRoom: [P(-116, 117, 0, Math.PI)],
      tower0: [towers[0].post], tower1: [towers[1].post], tower2: [towers[2].post], tower3: [towers[3].post],
      tunLobby: [P(-107.4, 66, TUN), P(-107.4, 104, TUN)], tunNorth: [P(-88, 64.5, TUN), P(-40, 64.5, TUN)], tunSouth: [P(-88, 105.5, TUN), P(-40, 105.5, TUN)], tunCross: [P(-64, 72, TUN), P(-64, 98, TUN)], tunLift: [P(-95, 85, TUN, Math.PI / 2)],
      innerGate: [P(-52, -5), P(-52, 5)], forecourt: [P(-30, 0), P(24, 0)], controlWest: [P(-50, -40), P(-50, -20)], control: [P(-36, -36), P(-20, -36)], controlRoof: [P(-40, -22, 7), P(-16, -22, 7)],
      bridgeA: [P(-6, -24, 7), P(26, -24, 7)], bridgeC: [P(-36, -10, 7), P(-36, 22, 7)], bridgeB: [P(14, 38.25, 7), P(40, 38.25, 7)], plantRoof: [P(-48, 32, 7), P(-48, 44, 7)], plant: [P(-34, 40), P(-46, 40)],
      energy: [P(4, 60), P(4, 104)], towerDoor: [P(26, -5), P(26, 5)], north: [P(40, -62), P(104, -62)], south: [P(40, 58), P(104, 58)], east: [P(122, -40), P(122, 40)],
      bridgehead: [P(-20, -36, BRIDGE.y, Math.PI / 2)], towerBridge: [P(-6, BRIDGE.z, BRIDGE.y), P(24, BRIDGE.z, BRIDGE.y)],
      ...T.patrols,
    },
    lamps: [...S.lamps, ...T.lamps], emissives: [...S.emissives, ...T.emissives],
    get destroyed() { return state.destroyed; }, get falling() { return state.falling; }, ruin: T.ruin,
    // the end: the central tower sinks and breaks under smoke and leaves a ruin (rubble, stumps, fires); the
    // tower bridge goes with it. { instant: true } skips the fall. restore() puts everything back (replays)
    destroy(opts = {}) {
      if (!T.destroy(opts)) return false;
      for (const s of segments) towerBridge.drop(s.i, !!opts.instant);
      for (const b of stubs) b.enabled = true;
      return true;
    },
    restore() { const was = T.restore(); towerBridge.restore(); for (const b of stubs) b.enabled = false; return was; },
    tick(camera, dt) {
      clock += dt;
      const dx = camera.position.x - C.x, dz = camera.position.z - C.z, far = dx * dx + dz * dz > 640 * 640;
      if (lift.state === 'moving') {
        const d = lift.target - lift.level, step = Math.min(Math.abs(d), Math.min(0.45, lift.speed * dt));
        lift.level += Math.sign(d) * step; placeLift();
        if (Math.abs(lift.target - lift.level) < 1e-3) { lift.level = lift.target; lift.state = lift.target === 0 ? 'top' : 'bottom'; (lift.state === 'top' ? topGate : lowGate).setOpen(true); lift.onArrive?.(lift.state); }
      }
      for (const s of segments) if (s.dropped && s.fall >= 0) { s.fall += dt; if (s.fall > 2.2) s.fall = -1; drawSeg(s); }
      if (far && !state.falling) return;
      T.tick(camera, dt);
      const on = clock % 1.6 < 0.25; for (const b of beacons) b.set(on ? '#ff3030' : '#3a0a0a');
      if (alarm.active) {
        const a = clock % 0.8 < 0.4;
        for (let i = 0; i < sirens.length; i++) sirens[i].set((i % 2 ? a : !a) ? '#ff2a2a' : '#5a0a0a');
        alarmLamp.set(a ? '#ff2a2a' : '#5a0a0a'); pools.material.opacity = 0.34 + 0.2 * Math.sin(clock * 7.8);
      }
    },
  };
  citadel.computer = citadel.control.computer;
  alarm.on(false); lift.setPower(false);
  places.citadel = citadel;
}
