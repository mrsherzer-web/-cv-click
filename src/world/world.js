// The whole map, fictional and compressed: Katzir's hilltop neighborhood in the east, the road down to
// the coastal plain, the Gan Shmuel area and Hadera in the west. Built in three passes: the layout
// (roads and paved areas), the terrain shaped around it, then everything that stands on top.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, rng } from '../core/math.js';
import { Terrain } from './terrain.js';
import { RoadNetwork } from './roads.js';
import { CollisionWorld } from './colliders.js';
import { Batch } from './batch.js';
import { materials } from './materials.js';
import { buildVegetation } from './vegetation.js';
import { Lod } from './lod.js';
import * as katzir from './katzir.js';
import * as access from './access.js';
import * as gym from './gym.js';

export const BOUNDS = { x0: -1700, z0: -560, x1: 480, z1: 380 }; // the terrain
export const PLAY = { x0: -1560, z0: -500, x1: 420, z1: 320 };   // where people and cars may go
export const PLAIN = -50;                                          // the coastal plain below Katzir

// The land before roads: Katzir's rolling hilltop falling to the plain, steepest below the lookout,
// and low hills closing the map in the north, south and east.
export function baseHeight(x, z) {
  const roll = 4.0 * Math.sin(x * 0.012 + 0.8) * Math.cos(z * 0.01 - 0.3)
    + 2.2 * Math.sin((x - z) * 0.018 + 1.3)
    + 1.0 * Math.sin(x * 0.045) * Math.sin(z * 0.04);
  const plain = PLAIN + 1.5 * Math.sin(x * 0.004 + 1) * Math.cos(z * 0.005) + 0.6 * Math.sin(x * 0.013 + z * 0.009)
    - smoothstep(-700, -1650, x) * 5;
  const e = Math.hypot((x - 40) / 270, (z - 5) / 175);           // 1 at the edge of the plateau
  const cliff = smoothstep(-105, -215, x) * (1 - smoothstep(110, 240, Math.abs(z - 5)));
  let h = lerp(roll, plain, Math.max(smoothstep(0.8, 1.9, e), cliff ** 1.5));
  const edge = Math.max(smoothstep(PLAY.z1 - 40, BOUNDS.z1, z), smoothstep(PLAY.z0 + 40, BOUNDS.z0, z), smoothstep(PLAY.x1 - 40, BOUNDS.x1, x));
  h += edge * 28;
  return h;
}

export function buildWorld(scene, { shadows }) {
  const M = materials();
  const group = new THREE.Group();
  group.name = 'world';
  scene.add(group);
  const lod = new Lod();
  const ctx = {
    group, M, r: rng(2026), cols: new CollisionWorld(), batch: new Batch({ chunk: 96 }), veg: [],
    net: new RoadNetwork(), places: {}, baseHeight, interactables: [], lod,
  };

  // 1. layout: roads and paved areas, which the terrain is shaped to
  katzir.layout(ctx);
  access.layout(ctx);
  gym.layout(ctx);

  // 2. terrain
  const terrain = new Terrain({ x0: BOUNDS.x0, z0: BOUNDS.z0, w: BOUNDS.x1 - BOUNDS.x0, d: BOUNDS.z1 - BOUNDS.z0, step: 4 });
  ctx.net.shape(terrain, baseHeight);
  ctx.terrain = terrain;
  const c = (hex) => new THREE.Color(hex);
  const C = { dry: c('#b9a768'), green: c('#71813f'), lawn: c('#6f8f43'), soil: c('#9b6a47'), rock: c('#a59b89'), field: c('#8f9a52') };
  const col = new THREE.Color();
  const colorFn = (x, z, y, slope) => {
    const noise = 0.5 + 0.5 * Math.sin(x * 0.11 + Math.sin(z * 0.07) * 3) * Math.cos(z * 0.09 - x * 0.03);
    col.copy(C.dry).lerp(C.green, noise * 0.55);
    if (y < PLAIN + 8) col.lerp(C.field, 0.35 * smoothstep(PLAIN + 8, PLAIN + 2, y));       // farmland on the plain
    const yard = ctx.yardWeight?.(x, z) ?? 0;
    if (yard) col.lerp(C.lawn, 0.5 * yard);                                                // watered yards
    col.lerp(C.soil, smoothstep(0.35, 0.8, noise) * 0.25);
    col.lerp(C.rock, smoothstep(0.35, 0.8, slope));
    return [col.r, col.g, col.b];
  };
  const tmesh = (g, name) => {
    const m = new THREE.Mesh(g, M.ground);
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.name = name;
    group.add(m);
    return m;
  };
  for (const b of terrain.buildLod(colorFn)) {
    lod.addSwap(b.center, b.radius * 0.72, b.near.map((g) => tmesh(g, 'terrain')), [tmesh(b.far, 'terrain-far')], 130);
  }

  // 3. everything on top
  katzir.build(ctx);
  access.build(ctx);
  gym.build(ctx);
  ctx.batch.build(group, {
    plaster: { cast: shadows }, stone: { cast: shadows }, tiles: { cast: shadows }, paint: { cast: shadows },
    solar: { cast: false }, shutter: { cast: false }, door: { cast: false },
  });
  // small things vanish first with distance; buildings and roads stay until the fog
  const SEEN = { paint: 200, curbGray: 160, curbPainted: 160, bump: 120, solar: 170, shutter: 220, door: 200, pavers: 280, stone: 320 };
  group.updateMatrixWorld(true);
  for (const o of group.children) {
    const k = o.name.split('@')[0];
    if (o.isMesh && SEEN[k]) lod.addCull(o, SEEN[k]);
    else if (o.isMesh && o.userData.sign) lod.addCull(o, 140);
  }
  buildVegetation(ctx.veg, M, group, { shadows, lod });

  // ---------- queries used by people, cars, the camera and missions ----------
  const groundHeight = (x, z) => {
    const s = ctx.net.surface(x, z);
    return s !== null ? s : terrain.heightAt(x, z);
  };
  const clampToPlayArea = (pos) => {
    pos.x = clamp(pos.x, PLAY.x0, PLAY.x1);
    pos.z = clamp(pos.z, PLAY.z0, PLAY.z1);
  };
  // the nearest place on a road to put a car back on (facing along the road)
  const roadSpot = (x, z) => {
    const n = ctx.net.nearest(x, z, 400);
    if (!n) return null;
    const p = n.road.at(n.s), side = -1, off = n.road.width / 4;
    return { x: p.x + p.nx * side * off, z: p.z + p.nz * side * off, h: p.h, yaw: Math.atan2(p.tx, p.tz) };
  };

  // per frame: detail by distance, the gym roof
  const tick = (camera, dt) => {
    lod.update(camera, dt);
    gym.update(ctx.places.gym, camera, dt, ctx.places.gymBags);
  };

  return {
    group, terrain, lod, tick, cols: ctx.cols, net: ctx.net, places: ctx.places, interactables: ctx.interactables,
    groundHeight, clampToPlayArea, roadSpot, bounds: PLAY,
    start: ctx.places.start, home: ctx.places.home, lookout: ctx.places.lookout, telescope: ctx.places.telescope, plaza: ctx.places.plaza,
    road: ctx.places.mainRoad,
  };
}
