// West of Katzir, on the coastal plain, fictional and compressed: the road through the Gan Shmuel
// area to the edge of Hadera. Fish ponds to the south, citrus rows and the kibbutz gate to the north,
// eucalyptus windbreaks along the road and a roadside gas station. The station and its shop are
// invented; no real business is shown.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Road } from './roads.js';
import { mat4 } from './batch.js';
import { tint } from './materials.js';
import { Tex } from './textures.js';
import * as P from './props.js';
import { yawFacing } from './katzir.js';
import { directionSign } from './access.js';

export const HADERA_H = -55;   // Hadera lies flat a little below the plain
const WEST = [[-560, -142], [-612, -128.5], [-680, -119], [-760, -115], [-840, -117], [-905, -120], [-950, -120]];
const STATION_S = 196;         // the gas station, south of the road
const KIBBUTZ_S = 283;         // the turn to the kibbutz gate, north of the road
const PONDS = { x0: -618, x1: -904, z0: -66, z1: 58, cols: 3, rows: 2, berm: 9 };
const ORCHARD = { x0: -626, x1: -812, z0: -166, z1: -258, dx: 7, dz: 7 };

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  const access = places.accessRoad, end = access.at(access.length);
  const road = net.add(new Road(WEST, { name: 'דרך גן שמואל', kind: 'highway', width: 7.5, sidewalk: 0, curb: 0, shoulder: 3.5, spacing: 2, baseHeight, startH: end.h, endH: HADERA_H, maxGrade: 0.06 }));
  places.westRoad = road;

  // the gas station's forecourt, on the road's left (south) side driving toward Hadera
  const p = road.at(STATION_S), yaw = yawFacing(p.tx, p.tz), depth = 30, off = road.width / 2 + 1.2 + depth / 2;
  places.station = net.addPad({ x: p.x - p.nx * off, z: p.z - p.nz * off, hx: depth / 2, hz: 26, yaw, h: p.h, top: 0.05, blend: 7, name: 'gas station', map: '#cfcabe' });
  places.station.road = { s: STATION_S, nx: -p.nx, nz: -p.nz, tx: p.tx, tz: p.tz, yaw };

  // the short road up to the kibbutz gate, north of the highway
  const j = road.at(KIBBUTZ_S), n = [j.nx, j.nz];
  places.kibbutzRoad = net.add(new Road([[j.x, j.z], [j.x + n[0] * 22, j.z + n[1] * 22], [j.x + n[0] * 52 + j.tx * 4, j.z + n[1] * 52 + j.tz * 4]],
    { name: 'הכניסה לגן שמואל', kind: 'highway', width: 6, sidewalk: 0, curb: 0, shoulder: 2, spacing: 1.5, baseHeight, startH: j.h }));

  // fish ponds: shallow basins with earth banks between them
  places.ponds = [];
  const pw = (PONDS.x0 - PONDS.x1) / PONDS.cols, pd = (PONDS.z1 - PONDS.z0) / PONDS.rows;
  for (let c = 0; c < PONDS.cols; c++) {
    for (let r = 0; r < PONDS.rows; r++) {
      const x = PONDS.x0 - pw * (c + 0.5), z = PONDS.z0 + pd * (r + 0.5), hx = pw / 2 - PONDS.berm / 2, hz = pd / 2 - PONDS.berm / 2;
      const ground = baseHeight(x, z);
      const pad = net.addPad({ x, z, hx, hz, yaw: 0, h: ground - 2.2, top: 0, blend: 3, covered: false, name: 'fish pond', map: '#6f9fb0' });
      pad.water = ground - 0.75;
      places.ponds.push(pad);
    }
  }
}

export function build(ctx) {
  const { group, M, r, cols, batch, veg, terrain, places, net } = ctx;
  const road = places.westRoad, W2 = road.width / 2, L = road.length;
  const along = (rd, s, sd, d) => {
    const p = rd.at(s);
    return { x: p.x + p.nx * sd * d, z: p.z + p.nz * sd * d, h: p.h, tx: p.tx, tz: p.tz, nx: p.nx * sd, nz: p.nz * sd };
  };
  const clear = (x, z, m = 3) => { const n = net.nearest(x, z, 40); return (!n || n.d > n.road.halfSurface + m) && !net.padAt(x, z) && !inPond(x, z, 2); };
  const inPond = (x, z, m = 0) => places.ponds.some((p) => p.sd(x, z) < m);

  // ---------- the road: asphalt, lines, shoulders (the city paves its own end) ----------
  const cityS = L - 6;
  batch.add('asphalt', M.asphalt, road.ribbon(-W2, W2, 0.02, 1 / 7, 0, cityS), null, {});
  for (const sd of [1, -1]) batch.add('asphalt', M.asphalt, road.ribbon(sd * W2, sd * (W2 + 1.4), 0.0, 1 / 7, 0, cityS), null, { color: tint('#c9bfae') });
  for (const g of road.line(0, 0.14, 0.035, 3, 6, 0, cityS)) batch.add('paint', M.paint, g, null, { color: tint('#ecebe5') });
  for (const sd of [1, -1]) batch.add('paint', M.paint, road.line(sd * (W2 - 0.25), 0.12, 0.035, 0, 0, 0, cityS), null, { color: tint('#ecebe5') });
  const kr = places.kibbutzRoad;
  batch.add('asphalt', M.asphalt, kr.ribbon(-kr.width / 2, kr.width / 2, 0.025, 1 / 7, W2 + 0.5), null, {});

  // eucalyptus windbreaks on both sides, broken where something meets the road
  for (const sd of [1, -1]) {
    for (let s = 14; s < L - 30; s += 9 + r() * 3) {
      if (sd === -1 && Math.abs(s - STATION_S) < 40) continue;
      if (sd === 1 && Math.abs(s - KIBBUTZ_S) < 14) continue;
      const t = along(road, s, sd, W2 + 9 + r() * 2.5);
      if (!clear(t.x, t.z, 4)) continue;
      const y = terrain.heightAt(t.x, t.z);
      veg.push({ kind: 'eucalyptus', x: t.x, y: y - 0.2, z: t.z, s: 0.85 + r() * 0.4 });
      cols.addCircle(t.x, t.z, 0.4, y - 1, y + 9);
    }
  }

  // ---------- fish ponds: water, banks you cannot walk off, a few reeds ----------
  {
    const geos = [];
    for (const p of places.ponds) {
      geos.push(new THREE.PlaneGeometry(p.hx * 2 + 1.5, p.hz * 2 + 1.5).rotateX(-Math.PI / 2).translate(p.x, p.water, p.z));
      const e = 0.6; // keep people and cars on the bank
      const pts = [[p.x - p.hx - e, p.z - p.hz - e], [p.x + p.hx + e, p.z - p.hz - e], [p.x + p.hx + e, p.z + p.hz + e], [p.x - p.hx - e, p.z + p.hz + e]];
      for (let i = 0; i < 4; i++) { const [a, b] = [pts[i], pts[(i + 1) % 4]]; cols.addSegment(a[0], a[1], b[0], b[1], 0.3, p.water - 3, p.water + 3); }
    }
    const water = new THREE.Mesh(mergeGeometries(geos), M.water);
    water.name = 'ponds';
    water.receiveShadow = true;
    group.add(water);
    const sign = along(road, 60, -1, W2 + 3.2);
    P.addSign(group, batch, M, cols, sign.x, terrain.heightAt(sign.x, sign.z), sign.z, yawFacing(sign.tx, sign.tz), 'בריכות הדגים', { bg: '#2f5e8f' });
  }

  // ---------- citrus rows north of the road ----------
  for (let x = ORCHARD.x0; x > ORCHARD.x1; x -= ORCHARD.dx) {
    for (let z = ORCHARD.z0; z > ORCHARD.z1; z -= ORCHARD.dz) {
      const tx = x + (r() - 0.5) * 0.8, tz = z + (r() - 0.5) * 0.8;
      if (!clear(tx, tz, 3)) continue;
      const y = terrain.heightAt(tx, tz);
      veg.push({ kind: 'citrus', x: tx, y: y - 0.1, z: tz, s: 0.85 + r() * 0.3 });
      cols.addCircle(tx, tz, 0.45, y - 1, y + 3);
    }
  }

  // ---------- the kibbutz gate: a stone wall with the name, a closed barrier, fences ----------
  {
    const e = kr.at(kr.length), y = e.h, yaw = yawFacing(e.tx, e.tz);
    const side = (k, d) => ({ x: e.x + e.nx * d * k, z: e.z + e.nz * d * k });
    const w = side(1, 6.5);
    batch.add('stone', M.stone, new THREE.BoxGeometry(5.2, 1.8, 0.8), mat4(w.x, y + 0.7, w.z, yaw), { uv: 'world', uvScale: 0.5 });
    cols.addBox(w.x, w.z, 2.6, 0.45, yaw, y - 1, y + 1.8);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.75), new THREE.MeshStandardMaterial({ map: Tex.sign('גן שמואל', { bg: '#3d5a3a', fg: '#f3e6cc', w: 1024, h: 176, size: 108, border: false }), roughness: 0.6 }));
    plate.position.set(w.x - e.tx * 0.42, y + 1.15, w.z - e.tz * 0.42);
    plate.rotation.y = yaw + Math.PI;
    plate.userData.sign = true;
    group.add(plate);
    const gate = side(-1, kr.width / 2 + 0.4);
    P.addGateClosed(batch, M, cols, gate.x, y, gate.z, yaw, kr.width);
    for (const k of [1, -1]) { // fences running off both ways
      const a = side(k, k > 0 ? 9.2 : kr.width / 2 + 1), b = side(k, 70);
      fence(batch, M, cols, a.x, a.z, b.x, b.z, (x, z) => terrain.heightAt(x, z));
    }
    // beyond the gate: tall trees and a few roofs of the kibbutz
    for (let i = 0; i < 60; i++) {
      const x = e.x + e.tx * (8 + r() * 70) + e.nx * (r() - 0.5) * 130, z = e.z + e.tz * (8 + r() * 70) + e.nz * (r() - 0.5) * 130;
      if (!clear(x, z, 3)) continue;
      const yy = terrain.heightAt(x, z);
      veg.push({ kind: r() < 0.6 ? 'eucalyptus' : 'pine', x, y: yy - 0.2, z, s: 0.9 + r() * 0.4 });
    }
    for (let i = 0; i < 5; i++) {
      const x = e.x + e.tx * (24 + i * 13) + e.nx * (r() - 0.5) * 60, z = e.z + e.tz * (24 + i * 13) + e.nz * (r() - 0.5) * 60;
      const yy = terrain.heightAt(x, z);
      batch.add('plaster', M.plaster, new THREE.BoxGeometry(12, 3.2, 8), mat4(x, yy + 1.2, z, yaw + (r() - 0.5) * 0.3), { color: tint('#efe8dc'), uv: 'world', uvScale: 0.3 });
      batch.add('tiles', M.tiles, new THREE.BoxGeometry(12.6, 0.4, 8.6), mat4(x, yy + 2.9, z, yaw), { uv: 'world', uvScale: 0.6 });
      cols.addBox(x, z, 6.3, 4.3, yaw, yy - 1, yy + 4);
    }
  }

  // ---------- the gas station: forecourt, canopy over two pump islands, a shop ----------
  {
    const st = places.station, sr = st.road, y = st.h + st.top;
    const at = (along, out) => ({ x: st.x + sr.tx * along + sr.nx * out, z: st.z + sr.tz * along + sr.nz * out });
    const face = Math.atan2(-sr.nx, -sr.nz); // toward the road
    batch.add('paint', M.paint, new THREE.BoxGeometry(st.hx * 2, 0.1, st.hz * 2), mat4(st.x, y - 0.05, st.z, st.yaw), { color: tint('#bdb8ae') });
    const c = at(-4, -2);
    batch.add('paint', M.paint, new THREE.BoxGeometry(12.1, 0.5, 20.1), mat4(c.x, y + 5.35, c.z, st.yaw), { color: tint('#2f7a4a') });
    batch.add('paint', M.paint, new THREE.BoxGeometry(11.9, 0.3, 19.9), mat4(c.x, y + 4.95, c.z, st.yaw), { color: tint('#f2f2ee') });
    for (const [a, o] of [[-8, -4], [8, -4], [-8, 4], [8, 4]]) {
      const q = at(-4 + a, -2 + o);
      batch.add('paint', M.paint, new THREE.BoxGeometry(0.35, 5, 0.35), mat4(q.x, y + 2.5, q.z, st.yaw), { color: tint('#d9dcdf') });
      cols.addCircle(q.x, q.z, 0.3, y - 1, y + 5);
    }
    for (const o of [-3.2, 3.2]) { // two pump islands parallel to the road, a lane between them
      const q = at(-4, -2 + o);
      batch.add('paint', M.paint, new THREE.BoxGeometry(0.9, 0.2, 7), mat4(q.x, y + 0.1, q.z, st.yaw), { color: tint('#a9a49a') });
      for (const k of [-1.8, 1.8]) {
        const pp = at(-4 + k, -2 + o);
        batch.add('paint', M.paint, new THREE.BoxGeometry(0.6, 1.6, 0.9), mat4(pp.x, y + 1.0, pp.z, face), { color: tint('#f2f2ee') });
        batch.add('paint', M.paint, new THREE.BoxGeometry(0.62, 0.35, 0.92), mat4(pp.x, y + 1.55, pp.z, face), { color: tint('#2f7a4a') });
      }
      cols.addBox(q.x, q.z, 0.5, 3.6, st.yaw, y - 1, y + 1.8);
    }
    // the shop at the back
    const sh = at(14, 9), sy = face;
    batch.add('plaster', M.plaster, new THREE.BoxGeometry(14, 4, 9), mat4(sh.x, y + 2, sh.z, sy), { color: tint('#f4efe6'), uv: 'world', uvScale: 0.3 });
    const front = at(14, 9 - 4.52);
    batch.add('shopfront', M.shopfront, new THREE.PlaneGeometry(10, 3.4), mat4(front.x, y + 1.7, front.z, sy), {});
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.0), new THREE.MeshStandardMaterial({ map: Tex.sign('מינימרקט התחנה', { bg: '#2f7a4a', fg: '#ffffff', w: 1024, h: 128, size: 76, border: false }), roughness: 0.6 }));
    sign.position.set(front.x - sr.nx * 0.03, y + 3.55, front.z - sr.nz * 0.03);
    sign.rotation.y = sy;
    sign.userData.sign = true;
    group.add(sign);
    cols.addBox(sh.x, sh.z, 7, 4.5, sy, y - 1, y + 4.2);
    places.stationShop = { ...at(14, 9 - 6.4), y, yaw: sy + Math.PI };
    places.stationStop = { ...at(-4, -2), y, yaw: Math.atan2(sr.tx, sr.tz), r: 5 };
    places.stationEntry = { ...at(-24, -6), y };
    // the tall price sign by the road: name only, no brand
    const ps = at(-22, -st.hx + 2);
    batch.add('paint', M.paint, new THREE.BoxGeometry(0.4, 6, 0.4), mat4(ps.x, y + 3, ps.z, face), { color: tint('#8a8f96') });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), new THREE.MeshStandardMaterial({ map: Tex.sign(['תחנת הפרדס', 'דלק · שירות', 'מינימרקט'], { bg: '#2f7a4a', fg: '#ffffff', w: 512, h: 432, size: 66 }), roughness: 0.6, side: THREE.DoubleSide }));
    board.position.set(ps.x, y + 6.6, ps.z);
    board.rotation.y = Math.atan2(sr.tx, sr.tz) + Math.PI / 2;
    board.userData.sign = true;
    group.add(board);
    cols.addCircle(ps.x, ps.z, 0.3, y - 1, y + 7);
  }

  // ---------- signs along the way ----------
  const sign = (s, sd, lines, back = false) => {
    const t = along(road, s, sd, W2 + 2.4), f = back ? 1 : -1;
    directionSign(group, batch, M, cols, t.x, road.at(s).h, t.z, yawFacing(f * t.tx, f * t.tz), lines);
  };
  sign(KIBBUTZ_S - 70, -1, ['גן שמואל →', 'חדרה ↑']);
  sign(STATION_S - 90, -1, ['תחנת דלק 100 מ׳']);
  sign(30, 1, ['קציר ↑'], true);
  sign(L - 70, 1, ['קציר ↑', 'גן שמואל ←'], true);
  {
    const t = along(road, L - 34, -1, W2 + 4.5), y = road.at(L - 34).h, yaw = yawFacing(-t.tx, -t.tz);
    batch.add('stone', M.stone, new THREE.BoxGeometry(5.2, 1.7, 0.7), mat4(t.x, y + 0.6, t.z, yaw), { uv: 'world', uvScale: 0.5 });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.7), new THREE.MeshStandardMaterial({ map: Tex.sign('ברוכים הבאים לחדרה', { bg: '#1d4f91', fg: '#ffffff', w: 1024, h: 160, size: 86, border: false }), roughness: 0.6 }));
    plate.position.set(t.x - t.tx * 0.36, y + 1.0, t.z - t.tz * 0.36); // on the face toward drivers coming in
    plate.rotation.y = yaw;
    plate.userData.sign = true;
    group.add(plate);
    cols.addBox(t.x, t.z, 2.6, 0.4, yaw, y - 1, y + 1.6);
    places.haderaSign = { x: t.x, z: t.z };
  }
}

// stretch a geometry's texture coordinates so a texture repeats su × sv times across it
export function scaleUV(g, su, sv) {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

// a chain-link fence on posts between two points, following the ground
export function fence(batch, M, cols, x0, z0, x1, z1, groundAt, height = 1.9) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 3)), yaw = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i < n; i++) {
    const ax = x0 + ((x1 - x0) * i) / n, az = z0 + ((z1 - z0) * i) / n, bx = x0 + ((x1 - x0) * (i + 1)) / n, bz = z0 + ((z1 - z0) * (i + 1)) / n;
    const ya = groundAt(ax, az), yb = groundAt(bx, bz), y = Math.min(ya, yb);
    batch.add('paint', M.paint, new THREE.BoxGeometry(0.07, height + 0.2, 0.07), mat4(ax, ya + height / 2, az), { color: tint('#7b8087') });
    batch.add('fence', M.fence, scaleUV(new THREE.PlaneGeometry(len / n, height), len / n / 0.6, height / 0.6), mat4((ax + bx) / 2, y + height / 2 + 0.05, (az + bz) / 2, yaw + Math.PI / 2), { uv: 'keep' });
    cols.addSegment(ax, az, bx, bz, 0.12, y - 1, y + height);
  }
}
