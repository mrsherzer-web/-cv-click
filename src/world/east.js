// East of Katzir (chapter seven): the quarry road, from the end of the villa's street out past the
// abandoned quarry, and on toward Kotzi's places. The quarry itself: a pit with rock terraces, two
// sheds, a rusted dumper, an office container where the clues to Nehorai are. Invented places.
import * as THREE from 'three';
import { Road } from './roads.js';
import { makeSite } from './compound.js';
import { tint } from './materials.js';

const ROAD = [[124, 110], [165, 124], [205, 120], [250, 104], [295, 74], [325, 78], [332, 104]];
const Q = { x: 300, z: 22 };   // the quarry centre

export function layout(ctx) {
  const { net, baseHeight, places } = ctx;
  const road = net.add(new Road(ROAD, { name: 'דרך המחצבה', kind: 'highway', width: 6.5, sidewalk: 0, curb: 0, shoulder: 2.5, spacing: 1.5, baseHeight }));
  places.eastRoad = road;
  const q = road.nearest(Q.x, Q.z + 50);
  net.addPad({ x: Q.x, z: Q.z, hx: 34, hz: 30, yaw: 0, h: q.h, top: 0.05, blend: 10, name: 'quarry' });
  net.addPad({ x: Q.x, z: Q.z + 38, hx: 10, hz: 14, yaw: 0, h: q.h, top: 0.05, blend: 6, name: 'quarry approach' });
  ctx.keepOut?.push({ x: Q.x, z: Q.z + 10, hx: 42, hz: 48 });
  ctx.east = { quarryY: q.h + 0.05, road };
}

export function build(ctx) {
  const { places, M, cols } = ctx;
  const road = ctx.east.road, y = ctx.east.quarryY;
  const S = makeSite(ctx, { cx: Q.x, cz: Q.z, y, name: 'quarry' });
  const { L, slab, crate, barrel, lampPost, sign, mesh, std, box, solid } = S;
  // the pit: three terraces of rock to the north, a ramp down from the south
  for (const [i, r] of [[0, 26], [1, 20], [2, 14]]) {
    const depth = -1.6 * (i + 1);
    slab(0, depth - 0.3, -8, r * 2, 0.6, r * 1.3, { key: 'stone', mat: M.stone, color: '#b9ad95', scale: 0.4 });
    S.seg(-r, -8 + r * 0.65, r, -8 + r * 0.65, { h: 1.6, y0: depth, t: 0.6, key: 'stone', mat: M.stone, color: '#a89b83', scale: 0.4 });
  }
  slab(0, 0, 12, 64, 0.1, 26, { key: 'sand', mat: M.sand, color: '#cbb995', scale: 0.12 }); // the flat ground by the sheds
  // sheds: an open-fronted one with tools, and a closed one with the radios
  S.wall(-24, 2, -24, 12, [], { h: 3.2, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 }); S.wall(-24, 12, -14, 12, [], { h: 3.2, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 }); S.wall(-14, 12, -14, 2, [], { h: 3.2, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 });
  slab(-19, 3.3, 7, 10.6, 0.15, 10.6, { color: '#7a7d82' });
  S.wall(10, 2, 22, 2, [{ at: 6, w: 1.4, h: 2.2 }], { h: 3.2, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 }); S.wall(22, 2, 22, 12, [], { h: 3.2, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 }); S.wall(22, 12, 10, 12, [], { h: 3.2, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 }); S.wall(10, 12, 10, 2, [], { h: 3.2, color: '#8f949a', key: 'metal', mat: M.metal, scale: 0.5 });
  slab(16, 3.3, 7, 12.6, 0.15, 10.6, { color: '#7a7d82' });
  // the office container (the documents), door to the south
  S.wall(-6, 16, 6, 16, [], { h: 2.6, color: '#2f5e8f', key: 'metal', mat: M.metal, scale: 0.5 }); S.wall(-6, 16, -6, 22, [], { h: 2.6, color: '#2f5e8f', key: 'metal', mat: M.metal, scale: 0.5 }); S.wall(6, 16, 6, 22, [], { h: 2.6, color: '#2f5e8f', key: 'metal', mat: M.metal, scale: 0.5 }); S.wall(-6, 22, 6, 22, [{ at: 6, w: 1.2, h: 2.1 }], { h: 2.6, color: '#2f5e8f', key: 'metal', mat: M.metal, scale: 0.5 });
  slab(0, 2.65, 19, 12.2, 0.1, 6.2, { color: '#c9c4b7' });
  mesh(box(1.6, 0.05, 0.8), std({ color: '#7a5a3a' }), -2, 0.75, 19); solid(-2, 19, 0.8, 0.4, 0.8);
  mesh(box(0.5, 0.02, 0.35), std({ color: '#f1efe6' }), -2, 0.79, 19); // the documents
  mesh(box(0.6, 1.6, 0.5), std({ color: '#3a3f47', metalness: 0.4 }), 4.5, 0.8, 20.5); solid(4.5, 20.5, 0.3, 0.25, 1.6); // a cabinet
  S.ceilingLamp(0, 19, 2.6);
  sign('קוצי בע״מ · חומרי בניין', 0, 2.2, 22.05, 0, 3.2, 0.5, { bg: '#2f5e8f' });
  // the map on the office wall (the last clue), the radios on the shed's bench, the keys in the dumper
  sign('המפה', -5.9, 1.5, 19, Math.PI / 2, 1.4, 1.0, { bg: '#e8dcc0', fg: '#3b2a1a', size: 110 });
  mesh(box(2.4, 0.05, 0.6), std({ color: '#7a5a3a' }), 16, 0.8, 10.5); solid(16, 10.5, 1.2, 0.3, 0.85);
  for (const dx of [-0.6, 0, 0.6]) mesh(box(0.18, 0.28, 0.1), std({ color: '#2a2d33' }), 16 + dx, 0.95, 10.5);
  // the rusted dumper, nose to the pit
  const truck = (lx, lz) => { S.batch.add('paint', M.paint, box(5.5, 2.0, 2.4), S.at(lx, 1.5, lz, 0.3), { color: tint('#8a4b2a') }); S.batch.add('paint', M.paint, box(2.2, 1.6, 2.3), S.at(lx - 3.2, 1.3, lz - 1.0, 0.3), { color: tint('#5a3a2a') }); for (const [ax, az] of [[-2.2, -1.1], [-2.2, 1.1], [1.8, -1.1], [1.8, 1.1]]) mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.5, 12).rotateZ(Math.PI / 2), std({ color: '#1c1d20' }), lx + ax, 0.6, lz + az); cols.addBox(Q.x + lx, Q.z + lz, 3.5, 1.4, 0.3, y - 1, y + 2.5); S.cover.push({ ...S.toWorld(lx, lz), w: 7, d: 2.8 }); };
  truck(-4, -2);
  // a wrecked car by the ramp
  S.batch.add('paint', M.paint, box(3.8, 1.2, 1.8), S.at(26, 0.7, 20, -0.5), { color: tint('#5d636b') }); cols.addBox(Q.x + 26, Q.z + 20, 1.9, 0.9, -0.5, y - 1, y + 1.3);
  for (const [lx, lz] of [[-12, 20], [12, 26], [-26, 20], [28, 6]]) crate(lx, lz, 1.4, 1.4, 1.1);
  for (const [lx, lz] of [[-9, 6], [-8.3, 6.6], [24, 8]]) barrel(lx, lz, '#8a4b2a');
  for (const [lx, lz] of [[-20, 26], [20, 26], [0, 30], [-26, -4], [26, -4]]) lampPost(lx, lz, 5.5);
  sign('המחצבה · הכניסה אסורה', 0, 2.4, 33, Math.PI, 3.6, 0.5, { bg: '#a7452c' });
  S.finish();
  const p = road.at(road.nearest(Q.x, Q.z + 60).s);
  places.quarry = {
    x: Q.x, z: Q.z, y, toWorld: S.toWorld,
    entrance: L(0, 32, Math.PI),                 // by the sign, facing in (north)
    parking: { x: p.x + p.nx * 4.5, z: p.z + p.nz * 4.5, yaw: Math.atan2(p.tx, p.tz), y: p.h, r: 6 },
    office: { door: L(0, 23.5, Math.PI), inside: L(0, 19, 0), desk: { ...S.toWorld(-2, 18.3), y: y + 0.8 }, map: { ...S.toWorld(-5.2, 19), y: y + 1.5 }, cabinet: { ...S.toWorld(4.5, 19.8), y: y + 1 } },
    shed: { radios: { ...S.toWorld(16, 9.8), y: y + 0.9 }, inside: L(16, 7, 0) },
    truck: { keys: { ...S.toWorld(-4, 0.3), y: y + 1.2 }, cab: L(-7, -3) },
    pit: L(0, -8),
    spots: [L(2, 28, 0), L(-2, 28, 0), L(4, 30, 0), L(-4, 30, 0), L(0, 30.5, 0), L(6, 29, 0), L(-6, 29, 0)],
    cover: S.cover, lamps: S.lamps, emissives: S.emissives,
  };
}
