// ============================================================================
//  The whole complex as one 3D scene: shells with door openings, furniture,
//  lamps (a small pool of real lights follows the viewer), doors, mission props.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import * as T from '../engine/textures.js';
import * as T2 from '../engine/textures2.js';
import * as P from './props.js';
import * as Q from './props2.js';
import { ROOMS, VENTS, DOORS, SEES, POINTS, WALL, floorY } from './layout.js';
import { Nav } from './nav.js';

const { box, cyl, std, M } = P;

// ---------------------------------------------------------------- batching
class Batch {
  constructor() {
    this.map = new Map();
  }
  _b(mat) {
    let b = this.map.get(mat);
    if (!b) this.map.set(mat, (b = { p: [], n: [], u: [] }));
    return b;
  }
  /** a,b,c,d counter clockwise seen from the front */
  quad(mat, a, b, c, d, ua, ub, uc, ud) {
    const B = this._b(mat);
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1];
    let ny = e1[2] * e2[0] - e1[0] * e2[2];
    let nz = e1[0] * e2[1] - e1[1] * e2[0];
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    for (const [v, uv] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) {
      B.p.push(v[0], v[1], v[2]);
      B.n.push(nx, ny, nz);
      B.u.push(uv[0], uv[1]);
    }
  }
  /** Take every static mesh below `root` (world space) into the batch and remove it. */
  absorb(root) {
    root.updateWorldMatrix(true, true);
    const take = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.keep) return;
      const m = o.material;
      if (Array.isArray(m) || m.transparent || m.isShaderMaterial || m.isMeshBasicMaterial) return;
      take.push(o);
    });
    const v = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    for (const o of take) {
      const B = this._b(o.material);
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const pos = g.attributes.position;
      const nor = g.attributes.normal;
      const uv = g.attributes.uv;
      nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        B.p.push(v.x, v.y, v.z);
        if (nor) {
          v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
          B.n.push(v.x, v.y, v.z);
        } else B.n.push(0, 1, 0);
        if (uv) B.u.push(uv.getX(i), uv.getY(i));
        else B.u.push(0, 0);
      }
      o.parent.remove(o);
      if (g !== o.geometry) g.dispose();
    }
  }
  build(group) {
    for (const [mat, B] of this.map) {
      if (!B.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      group.add(m);
    }
    this.map.clear();
  }
}

const unlit = (lamp) => {
  if (lamp.light) {
    lamp.remove(lamp.light);
    if (lamp.light.target) lamp.remove(lamp.light.target);
    lamp.light = null;
  }
  lamp.traverse((o) => {
    if (o.isMesh && (o.material.isMeshBasicMaterial || o.material.transparent)) o.userData.keep = true;
  });
  return lamp;
};

const surf = (canvas, rough = 0.85, extra = {}) =>
  new THREE.MeshStandardMaterial({ map: T.tex(canvas), roughness: rough, ...extra });

export class World {
  constructor(opts = {}) {
    this.opts = opts;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030405, 0.034);
    this.nav = new Nav();
    this.groups = {};
    this.fixtures = [];
    this.items = {};
    this.doorObjs = {};
    this.screens = [];
    this.neons = [];
    this.power = 'normal';
    this.t = 0;
    this.viewRoom = null;
    this._mats();
    this.ambient = new THREE.HemisphereLight(0x8f9cb8, 0x241c16, 0.42);
    this.scene.add(this.ambient);
    this.poolSize = opts.lights ?? 6;
    this.pool = [];
    for (let i = 0; i < this.poolSize; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 12, 1.7);
      L.userData.fx = null;
      this.scene.add(L);
      this.pool.push(L);
    }
    this._build();
    this.nav.bake();
    this.setView('office');
  }

  _mats() {
    const m = (this.mat = {});
    m.woodDark = surf(T.woodFloor(true), 0.72);
    m.wood = surf(T.woodFloor(false), 0.7);
    m.carpetRed = surf(T2.carpet('#3a1418', '#521c20'), 0.95);
    m.carpetGreen = surf(T2.carpet('#12281c', '#1c3a2a'), 0.95);
    m.concrete = surf(T2.concrete(96), 0.92);
    m.concreteDark = surf(T2.concrete(62), 0.9);
    m.tiles = surf(T.bathTiles(), 0.35);
    m.checker = surf(T2.checker(), 0.45);
    m.asphalt = surf(T2.asphalt(), 0.95);
    m.wallGreen = surf(T.wallpaper('#20302a', '#2c4238'), 0.88);
    m.wallRed = surf(T.wallpaper('#3a1a1c', '#52262a'), 0.88);
    m.wallBlue = surf(T.wallpaper('#1c2434', '#2a3650'), 0.88);
    m.wallPlain = surf(T.plainWall('#4a4038'), 0.9);
    m.wallOffice = surf(T.plainWall('#3c4440'), 0.9);
    m.wallRust = surf(T2.rustWall(), 0.8, { metalness: 0.2 });
    m.curtain = surf(T.curtain(), 0.9);
    m.ceil = surf(T.ceilingTiles(false), 0.95);
    m.ceilBroken = surf(T.ceilingTiles(true), 0.95);
    m.vent = surf(T2.ventMetal(), 0.55, { metalness: 0.15 });
    for (const k of ['ceil', 'ceilBroken']) m[k].color.setScalar(0.42);
    m.frame = std(0x16100c, 0.6);
    m.frameMetal = std(0x2a2e31, 0.45, 0.7);
    m.black = std(0x040404, 0.9);
  }

  // ------------------------------------------------------------ shell builders
  _openingsFor(id, side) {
    const r = ROOMS[id].rect;
    const out = [];
    for (const did in DOORS) {
      const d = DOORS[did];
      if (d.a !== id && d.b !== id) continue;
      const near = (a, b) => Math.abs(a - b) < 0.02;
      let u0 = null;
      if (d.axis === 'x') {
        if (side === 'N' && near(d.at, r[1] - WALL / 2)) u0 = d.c - d.w / 2 - r[0];
        if (side === 'S' && near(d.at, r[3] + WALL / 2)) u0 = r[2] - (d.c + d.w / 2);
      } else {
        if (side === 'W' && near(d.at, r[0] - WALL / 2)) u0 = r[3] - (d.c + d.w / 2);
        if (side === 'E' && near(d.at, r[2] + WALL / 2)) u0 = d.c - d.w / 2 - r[1];
      }
      if (u0 !== null) out.push({ u0, u1: u0 + d.w, y0: 0, y1: d.h });
    }
    return out;
  }

  /** One wall with rectangular holes. P = left bottom corner seen from inside, D = unit vector to the right. */
  _wall(batch, mat, Pt, D, L, H, openings = [], tile = [2.2, 2.9]) {
    const ops = [...openings].sort((a, b) => a.u0 - b.u0);
    const q = (ua, ub, ya, yb) => {
      if (ub - ua < 0.005 || yb - ya < 0.005) return;
      const at = (u, y) => [Pt[0] + D[0] * u, Pt[1] + y, Pt[2] + D[1] * u];
      batch.quad(mat, at(ua, ya), at(ub, ya), at(ub, yb), at(ua, yb),
        [ua / tile[0], ya / tile[1]], [ub / tile[0], ya / tile[1]], [ub / tile[0], yb / tile[1]], [ua / tile[0], yb / tile[1]]);
    };
    let cur = 0;
    for (const o of ops) {
      const a = Math.max(0, o.u0);
      const b = Math.min(L, o.u1);
      if (a > cur) q(cur, a, 0, H);
      if (o.y0 > 0) q(a, b, 0, o.y0);
      if (o.y1 < H) q(a, b, o.y1, H);
      cur = Math.max(cur, b);
    }
    if (cur < L) q(cur, L, 0, H);
  }

  /** Floor, ceiling and four walls of a rectangular space. sides: which walls to build. */
  _shell(batch, rect, y, H, mats, { sides = 'NSWE', openings = {}, floorTile = 3, wallTile = [2.2, 2.9], ceilTile = 1.2, noCeil = false, noFloor = false } = {}) {
    const [x0, z0, x1, z1] = rect;
    if (!noFloor) {
      const t = floorTile;
      batch.quad(mats.floor, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [x0 / t, z1 / t], [x1 / t, z1 / t], [x1 / t, z0 / t], [x0 / t, z0 / t]);
    }
    if (!noCeil) {
      const t = ceilTile;
      batch.quad(mats.ceil, [x0, y + H, z0], [x1, y + H, z0], [x1, y + H, z1], [x0, y + H, z1], [x0 / t, z0 / t], [x1 / t, z0 / t], [x1 / t, z1 / t], [x0 / t, z1 / t]);
    }
    const W = mats.wall;
    if (sides.includes('N')) this._wall(batch, mats.wallN || W, [x0, y, z0], [1, 0], x1 - x0, H, openings.N, wallTile);
    if (sides.includes('S')) this._wall(batch, mats.wallS || W, [x1, y, z1], [-1, 0], x1 - x0, H, openings.S, wallTile);
    if (sides.includes('W')) this._wall(batch, mats.wallW || W, [x0, y, z1], [0, -1], z1 - z0, H, openings.W, wallTile);
    if (sides.includes('E')) this._wall(batch, mats.wallE || W, [x1, y, z0], [0, 1], z1 - z0, H, openings.E, wallTile);
  }

  _room(id, mats, opt = {}) {
    const r = ROOMS[id];
    const g = (this.groups[id] = new THREE.Group());
    g.name = id;
    this.scene.add(g);
    const batch = new Batch();
    const openings = { N: this._openingsFor(id, 'N'), S: this._openingsFor(id, 'S'), W: this._openingsFor(id, 'W'), E: this._openingsFor(id, 'E') };
    for (const k in opt.extraOpenings || {}) openings[k].push(...opt.extraOpenings[k]);
    this._shell(batch, r.rect, r.y, r.h, mats, { ...opt, openings });
    return { g, batch, r, x0: r.rect[0], z0: r.rect[1], x1: r.rect[2], z1: r.rect[3], cx: (r.rect[0] + r.rect[2]) / 2, cz: (r.rect[1] + r.rect[3]) / 2 };
  }

  /** Lining of a door tunnel through the wall gap + optional door leaf. */
  _doorFrames() {
    const g = (this.groups._doors = new THREE.Group());
    this.scene.add(g);
    const batch = new Batch();
    const h2 = WALL / 2 + 0.005;
    for (const id in DOORS) {
      const d = DOORS[id];
      const y = d.y || 0;
      const mat = d.glass ? this.mat.frameMetal : this.mat.frame;
      const a = d.c - d.w / 2;
      const b = d.c + d.w / 2;
      if (d.axis === 'x') {
        const zn = d.at - h2;
        const zs = d.at + h2;
        batch.quad(mat, [a, y, zs], [b, y, zs], [b, y, zn], [a, y, zn], [0, 0], [1, 0], [1, 1], [0, 1]);
        batch.quad(mat, [a, y + d.h, zn], [b, y + d.h, zn], [b, y + d.h, zs], [a, y + d.h, zs], [0, 0], [1, 0], [1, 1], [0, 1]);
        batch.quad(mat, [a, y, zs], [a, y, zn], [a, y + d.h, zn], [a, y + d.h, zs], [0, 0], [1, 0], [1, 1], [0, 1]);
        batch.quad(mat, [b, y, zn], [b, y, zs], [b, y + d.h, zs], [b, y + d.h, zn], [0, 0], [1, 0], [1, 1], [0, 1]);
      } else {
        const xw = d.at - h2;
        const xe = d.at + h2;
        batch.quad(mat, [xw, y, b], [xe, y, b], [xe, y, a], [xw, y, a], [0, 0], [1, 0], [1, 1], [0, 1]);
        batch.quad(mat, [xw, y + d.h, a], [xe, y + d.h, a], [xe, y + d.h, b], [xw, y + d.h, b], [0, 0], [1, 0], [1, 1], [0, 1]);
        batch.quad(mat, [xw, y, a], [xe, y, a], [xe, y + d.h, a], [xw, y + d.h, a], [0, 0], [1, 0], [1, 1], [0, 1]);
        batch.quad(mat, [xe, y, b], [xw, y, b], [xw, y + d.h, b], [xe, y + d.h, b], [0, 0], [1, 0], [1, 1], [0, 1]);
      }
    }
    batch.build(g);
    // door leaves
    const leaf = (id, kind) => {
      const d = DOORS[id];
      const pivot = new THREE.Group();
      let obj;
      if (kind === 'glass') {
        obj = Q.glassDoors(d.w, d.h);
        pivot.add(obj);
      } else {
        const color = kind === 'metal' ? 0x3a4246 : 0x3a2414;
        const slab = box(d.w, d.h, 0.06, std(color, 0.6, kind === 'metal' ? 0.5 : 0), d.w / 2, d.h / 2, 0);
        slab.userData.keep = true;
        const knob = cyl(0.025, 0.025, 0.1, M.brass, d.w - 0.12, d.h * 0.47, 0, null, 8);
        knob.rotation.x = Math.PI / 2;
        knob.userData.keep = true;
        pivot.add(slab, knob);
        obj = pivot;
      }
      const y = d.y || 0;
      if (d.axis === 'x') {
        pivot.position.set(kind === 'glass' ? d.c : d.c - d.w / 2, y, d.at);
      } else {
        pivot.position.set(d.at, y, kind === 'glass' ? d.c : d.c + d.w / 2);
        pivot.rotation.y = Math.PI / 2;
      }
      pivot.userData.baseYaw = pivot.rotation.y;
      g.add(pivot);
      const closed = this.nav.closed.has(id);
      this.doorObjs[id] = { id, kind, pivot, obj, open: !closed, a: closed ? 0 : 1 };
      this._poseDoor(this.doorObjs[id]);
    };
    leaf('storage', 'wood');
    leaf('vip', 'wood');
    leaf('cellar', 'metal');
    leaf('entrance', 'glass');
    leaf('wc', 'wood');
    leaf('elec', 'metal');
  }

  _poseDoor(o) {
    if (o.kind === 'glass') {
      const w = DOORS[o.id].w / 2;
      o.obj.leaves[0].rotation.y = o.a * 1.45;
      o.obj.leaves[1].rotation.y = -o.a * 1.45;
      void w;
    } else {
      o.pivot.rotation.y = o.pivot.userData.baseYaw - o.a * 1.75;
    }
  }

  setDoor(id, open, instant = false) {
    const o = this.doorObjs[id];
    this.nav.setDoor(id, open);
    if (!o) return;
    o.open = open;
    if (instant) {
      o.a = open ? 1 : 0;
      this._poseDoor(o);
    }
  }

  // ------------------------------------------------------------ fixtures
  /** Register a lamp. kind: pendant | tube | bulb | red | neon | vent | screen */
  _fx(room, x, y, z, { color = 0xffe2b0, base = 14, range = 11, kind = 'pendant', lamp = null, flick = 0.25, state = 'on', emergency = false, pool = 0, prio = 1 } = {}) {
    const f = { room, x, y, z, color: new THREE.Color(color), base, range, kind, lamp, flick, state, emergency, prio, seed: this.fixtures.length * 1.37, f: 0, target: 0, poolMesh: null };
    if (pool > 0) {
      const c = f.color;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(pool, pool),
        new THREE.MeshBasicMaterial({ map: T.tex(T2.pool()), color: c.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, floorY(x, z) + 0.012, z);
      mesh.renderOrder = 1;
      mesh.userData.keep = true;
      this.groups[room].add(mesh);
      f.poolMesh = mesh;
    }
    this.fixtures.push(f);
    return f;
  }

  _pendant(R, x, z, { on = true, shades = 3, color = 0xffe2b0, base = 15, flick = 0.25, drop = null, rotY = 0 } = {}) {
    const H = R.r.h + R.r.y;
    const lamp = unlit(P.pendantLamp({ shades, shadow: false, cone: true, drop: drop ?? H - 1.95 }));
    lamp.position.set(x, 1.95 + R.r.y, z);
    lamp.rotation.y = rotY;
    R.g.add(lamp);
    return this._fx(R.g.name, x, 1.35 + R.r.y, z, { color, base, range: 10, kind: 'pendant', lamp, flick, state: on ? 'on' : 'dead', pool: on ? 4.2 : 0 });
  }

  _tube(R, x, z, { on = true, color = 0xd8f0ff, base = 9, flick = 0.35, rotY = 0, y = null } = {}) {
    const H = R.r.h + R.r.y;
    const lamp = unlit(P.fluorescent(1, color));
    lamp.position.set(x, (y ?? H) - 0.05, z);
    lamp.rotation.y = rotY;
    R.g.add(lamp);
    return this._fx(R.g.name, x, (y ?? H) - 0.35, z, { color, base, range: 10, kind: 'tube', lamp, flick, state: on ? 'on' : 'dead', pool: on ? 3.4 : 0 });
  }

  _bulb(R, x, z, { on = true, color = 0xffd8a0, base = 6, flick = 0.3, y = null } = {}) {
    const H = R.r.h + R.r.y;
    const lamp = unlit(P.bareBulb(1, color));
    lamp.position.set(x, (y ?? H) - 0.42, z);
    R.g.add(lamp);
    return this._fx(R.g.name, x, (y ?? H) - 0.5, z, { color, base, range: 9, kind: 'bulb', lamp, flick, state: on ? 'on' : 'dead', pool: on ? 3 : 0 });
  }

  /** Red emergency lamp on a wall */
  _red(R, x, y, z) {
    const bm = new THREE.MeshBasicMaterial({ color: 0x200000 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.12), bm);
    m.position.set(x, y, z);
    m.userData.keep = true;
    R.g.add(m);
    const lamp = { light: null, bulbMats: [bm], cones: [], baseIntensity: 1, bulbBase: [new THREE.Color(5, 0.12, 0.06)] };
    return this._fx(R.g.name, x, y - 0.15, z, { color: 0xff1a10, base: 9, range: 11, kind: 'red', lamp, flick: 0.1, emergency: true, state: 'on' });
  }

  _neon(R, text, x, y, z, rotY, w, h, color = '#ff2a4a', size = 150) {
    const s = P.sign(T2.neon(text, color, size), w, h, 2.4);
    s.position.set(x, y, z);
    s.rotation.y = rotY;
    s.userData.keep = true;
    R.g.add(s);
    this.neons.push({ mesh: s, seed: this.neons.length * 2.1, room: R.g.name });
    return s;
  }

  _plate(R, text, x, y, z, rotY, w = 0.9) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.25), new THREE.MeshStandardMaterial({ map: T.tex(T2.plate(text)), roughness: 0.5, emissive: 0x33302a, emissiveIntensity: 0.35 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    R.g.add(m);
    return m;
  }

  _put(R, obj, x, z, rotY = 0, y = null, block = null, tall = false) {
    obj.position.set(x, y ?? R.r.y, z);
    obj.rotation.y = rotY;
    R.g.add(obj);
    if (block) {
      const [w, d] = block;
      const c = Math.abs(Math.cos(rotY));
      const s = Math.abs(Math.sin(rotY));
      const bw = (w * c + d * s) / 2;
      const bd = (w * s + d * c) / 2;
      this.nav.block(x - bw, z - bd, x + bw, z + bd, tall);
    }
    return obj;
  }

  _finish(R) {
    R.batch.absorb(R.g);
    R.batch.build(R.g);
  }

  // ------------------------------------------------------------ rooms
  _build() {
    this._office();
    this._corridor();
    this._storage();
    this._lobby();
    this._wc();
    this._elec();
    this._hall();
    this._bar();
    this._arcade();
    this._vip();
    this._stairs();
    this._basement();
    this._outside();
    this._vents();
    this._doorFrames();
  }

  _office() {
    const m = this.mat;
    const v = VENTS.ventL;
    const hole = (zc0, zc1, side) => (side === 'W' ? { u0: 2.6 - zc1, u1: 2.6 - zc0, y0: v.y0, y1: v.y1 } : { u0: zc0 + 2.6, u1: zc1 + 2.6, y0: v.y0, y1: v.y1 });
    const R = this._room('office', { floor: m.carpetGreen, wall: m.wallOffice, ceil: m.ceil }, {
      extraOpenings: { W: [hole(-0.25, 0.65, 'W')], E: [hole(-0.25, 0.65, 'E')] },
    });
    const it = this.items;
    this._put(R, Q.securityDesk(), 0, 0.45, 0, null, [3.4, 0.85]);
    // two CRT monitors turned to the player
    it.crtL = this._put(R, Q.crt(0.5), -1.02, 0.36, 0.42, 0.77);
    it.crtR = this._put(R, Q.crt(0.5), 1.02, 0.36, -0.42, 0.77);
    this.noise = T.noiseCanvas(128, 96);
    this.noiseTex = T.tex(this.noise.canvas);
    it.crtL.screen.map = this.noiseTex;
    it.crtR.screen.map = this.noiseTex;
    it.crtL.screen.color.setRGB(0.55, 0.8, 0.6);
    it.crtR.screen.color.setRGB(0.55, 0.8, 0.6);
    it.phone = this._put(R, Q.wallPhone(), 0.62, 0.62, -0.3, 0.8);
    it.phone.rotation.x = -1.35;
    // wall clock above the opening
    this.clock = T2.clockFace();
    this.clockTex = T.tex(this.clock.canvas);
    const ck = new THREE.Mesh(new THREE.CircleGeometry(0.24, 28), new THREE.MeshStandardMaterial({ map: this.clockTex, roughness: 0.5, emissive: 0x222018, emissiveIntensity: 0.6 }));
    ck.position.set(0, 2.68, -2.585);
    ck.userData.keep = true;
    R.g.add(ck);
    // kill switch right of the opening
    it.kill = this._put(R, Q.killSwitch(), 2.25, -2.56, 0, 1.45);
    // vent frames + light buttons
    for (const s of [-1, 1]) {
      const gr = Q.ventGrate(0.9, 0.8);
      gr.children.splice(4).forEach((c) => gr.remove(c)); // open mouth: keep only the frame
      this._put(R, gr, s * 3.185, 0.2, (-s * Math.PI) / 2, 0.85);
      const btn = box(0.12, 0.12, 0.05, std(0x2a2d30, 0.5), s * 3.17, 1.55, 0.2, R.g);
      btn.rotation.y = (-s * Math.PI) / 2;
      const led = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), new THREE.MeshBasicMaterial({ color: 0x331a00 }));
      led.position.set(s * 3.14, 1.55, 0.2);
      led.rotation.y = (-s * Math.PI) / 2;
      led.userData.keep = true;
      R.g.add(led);
      it['ventBtn' + (s < 0 ? 'L' : 'R')] = led;
      this._plate(R, s < 0 ? 'פיר שמאלי' : 'פיר ימני', s * 3.18, 1.82, 0.2, (-s * Math.PI) / 2, 0.7);
    }
    // back of the room
    this._put(R, Q.locker(4), -2.2, 2.35, Math.PI, null, [1.7, 0.5], true);
    this._put(R, P.shelfUnit(1.6, 4), 2.3, 2.38, Math.PI, null, [1.6, 0.45], true);
    this._put(R, Q.crates(3, 4), 2.6, -1.9, 0.3, null, [0.9, 0.9]);
    it.chair = this._put(R, Q.gamingChair(), -2.1, 1.75, 0.5);
    // posters
    const po = P.poster(T.tex(T.newspaper()), 0.7, 0.95);
    po.position.set(-2.3, 1.6, -2.57);
    R.g.add(po);
    this._plate(R, 'חדר אבטחה', -2.3, 2.35, -2.58, 0, 1.0);
    this._tube(R, 0, 0.9, { color: 0xcfe6d8, base: 5.5, flick: 0.2 });
    const dl = this._bulb(R, -1.25, 0.55, { color: 0xffc98a, base: 3.2, flick: 0.1, y: 1.75 });
    dl.prio = 1.4;
    this._red(R, 0, 2.35, 2.55);
    this._finish(R);
  }

  _corridor() {
    const m = this.mat;
    const R = this._room('corr', { floor: m.carpetRed, wall: m.wallGreen, ceil: m.ceilBroken });
    this.corrLamps = [
      this._tube(R, 0, -5.2, { base: 7, flick: 0.5, rotY: Math.PI / 2 }),
      this._tube(R, 0, -9.8, { base: 7, on: false, rotY: Math.PI / 2 }),
      this._tube(R, 0, -14.3, { base: 7, flick: 0.75, rotY: Math.PI / 2 }),
      this._tube(R, 0, -18.8, { base: 7, flick: 0.4, rotY: Math.PI / 2 }),
    ];
    this._red(R, 1.44, 2.5, -12);
    this._red(R, -1.44, 2.5, -4.4);
    this._plate(R, 'מחסן', -1.48, 2.42, -8.5, Math.PI / 2);
    this._plate(R, 'כניסה', 1.48, 2.52, -9, -Math.PI / 2);
    this._plate(R, 'שירותים', -1.48, 2.38, -16.5, Math.PI / 2);
    this._plate(R, 'חדר חשמל', 1.48, 2.38, -16.75, -Math.PI / 2);
    const ex = P.exitSign();
    ex.position.set(1.44, 2.62, -10.4);
    ex.rotation.y = -Math.PI / 2;
    ex.traverse((o) => (o.userData.keep = true));
    R.g.add(ex);
    this._put(R, Q.trashBag(), -1.1, -6.2);
    this._put(R, Q.trashBag(), 1.05, -19.6);
    this._put(R, Q.bottle(0x2a5c2e, true), 0.6, -11.3, 0.7);
    this._put(R, Q.bottle(0x5a2a12, true), -0.8, -14.9, 2.1);
    this._put(R, Q.bottle(0x2a5c2e), -1.2, -19.9);
    const ch = this._put(R, Q.chair(), -1.05, -12.9, 1.1);
    ch.rotation.z = 1.5;
    ch.position.y = 0.22;
    for (const [z, s] of [[-6.6, 1], [-13.4, -1], [-18.2, 1]]) {
      const po = P.poster(T.tex(T.newspaper()), 0.6, 0.8);
      po.position.set(s * 1.47, 1.55, z);
      po.rotation.y = (-s * Math.PI) / 2;
      po.rotation.z = s * 0.06;
      R.g.add(po);
    }
    const wr = P.decal(T.writing('הוא עדיין כאן'), 2.6, 0.65, 0.9);
    wr.position.set(-1.48, 1.5, -11.2);
    wr.rotation.y = Math.PI / 2;
    wr.userData.keep = true;
    R.g.add(wr);
    this._finish(R);
  }

  _storage() {
    const m = this.mat;
    const R = this._room('storage', { floor: m.concrete, wall: m.wallPlain, ceil: m.ceilBroken });
    for (let i = 0; i < 4; i++) this._put(R, P.shelfUnit(1.6, 4), -8.7 + i * 1.8, -11.25, 0, null, [1.6, 0.45], true);
    this._put(R, P.shelfUnit(1.6, 4), -4.4, -8.6, Math.PI / 2, null, [1.6, 0.45], true);
    this._put(R, Q.crates(1, 5), -5.6, -6.3, 0.2, null, [1.2, 1.0]);
    this._put(R, Q.crates(2, 4), -3.2, -10.2, 1.0, null, [1.0, 1.0]);
    this._put(R, Q.crates(5, 3), -7.3, -8.2, 2.0, null, [0.9, 0.9]);
    this._put(R, Q.locker(3), -2.15, -6.3, -Math.PI / 2, null, [1.3, 0.5], true);
    const gr = Q.ventGrate(0.9, 0.8);
    this._put(R, gr, -8.85, -5.52, Math.PI, 0.85);
    this.items.fuse_storage = this._put(R, Q.fuseBox(), -9.73, POINTS.fuse_storage[1], Math.PI / 2, 1.4);
    this._put(R, P.cueRack(6), -9.72, -10.2, Math.PI / 2, 1.0);
    this._bulb(R, -5.8, -8.5, { base: 5.5, flick: 0.55 });
    this._red(R, -5.8, 2.5, -5.56);
    this._finish(R);
  }

  _lobby() {
    const m = this.mat;
    const R = this._room('lobby', { floor: m.checker, wall: m.wallRed, ceil: m.ceil }, { floorTile: 4 });
    this._put(R, Q.receptionDesk(), 4.6, -11.0, 0, null, [3.0, 0.9]);
    this.nav.block(5.3, -12.4, 6.1, -10.6);
    this._put(R, P.sofa(2.2), 4.2, -5.95, Math.PI, null, [2.3, 0.9]);
    this._put(R, P.deadTree(), 2.5, -6.2, 0, null, [0.6, 0.6]);
    this._put(R, Q.ventGrate(0.9, 0.8), 8.85, -5.52, Math.PI, 0.85);
    // entrance control panel (east wall, north of the vent corner)
    const pan = new THREE.Group();
    box(0.5, 0.7, 0.12, std(0x3c4347, 0.5, 0.6), 0, 0, 0, pan);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), new THREE.MeshBasicMaterial({ color: 0x400806 }));
    scr.position.set(0, 0.14, 0.065);
    scr.userData.keep = true;
    pan.add(scr);
    pan.screen = scr.material;
    box(0.1, 0.1, 0.04, std(0x8a1010, 0.4), 0, -0.18, 0.07, pan);
    this.items.entrance_panel = this._put(R, pan, 9.73, POINTS.entrance_panel[1], -Math.PI / 2, 1.4);
    this._neon(R, 'הסנוקר של גפן', 5.6, 2.45, -12.46, 0, 4.2, 1.05, '#ff2a4a', 130);
    this._plate(R, 'יציאה', 9.76, 2.62, -9, -Math.PI / 2, 0.9);
    const nb = P.poster(T.tex(T.newspaper()), 1.1, 0.8);
    nb.position.set(2.6, 1.6, -12.47);
    R.g.add(nb);
    this._pendant(R, 5.6, -8.6, { shades: 2, base: 10, flick: 0.45 });
    this._tube(R, 3.4, -10.6, { on: false });
    this._red(R, 9.74, 2.75, -11.4);
    this._finish(R);
  }

  _wc() {
    const m = this.mat;
    const R = this._room('wc', { floor: m.tiles, wall: m.tiles, ceil: m.ceilBroken }, { floorTile: 1.6, wallTile: [1.6, 1.6] });
    const st = Q.stalls(3);
    this._put(R, st, -7.75, -18.75, 0);
    this.nav.block(-7.8, -19.5, -4.85, -18.0, true);
    this._put(R, Q.sinks(3), -6.9, -13.75, Math.PI, null, [2.6, 0.5]);
    this.nav.block(-7.6, -14.1, -4.7, -13.5);
    this.items.fuse_wc = this._put(R, Q.fuseBox(), -7.73, POINTS.fuse_wc[1], Math.PI / 2, 1.4);
    this._put(R, Q.trashBag(), -2.3, -19.0);
    const wr = P.decal(T.writing('תברחו'), 1.6, 0.5, 0.85);
    wr.position.set(-4.2, 1.5, -19.47);
    wr.userData.keep = true;
    R.g.add(wr);
    this._tube(R, -4.8, -16.4, { base: 8, flick: 0.85, color: 0xcfeee0 });
    this._red(R, -1.86, 2.45, -14.4);
    this._finish(R);
  }

  _elec() {
    const m = this.mat;
    const R = this._room('elec', { floor: m.concreteDark, wall: m.wallRust, ceil: m.concreteDark }, { wallTile: [2.6, 2.8], ceilTile: 3 });
    const bp = Q.breakerPanel();
    this.items.breaker = this._put(R, bp, 7.71, POINTS.breaker[1], -Math.PI / 2, 1.5);
    // cabinets on the north wall
    for (let i = 0; i < 4; i++) {
      const cab = new THREE.Group();
      box(0.9, 1.9, 0.5, std(0x47504c, 0.55, 0.5), 0, 0.95, 0, cab);
      box(0.8, 0.5, 0.02, std(0x1a1e1f, 0.6), 0, 1.4, 0.255, cab);
      box(0.06, 0.2, 0.03, M.steel, 0.3, 0.9, 0.26, cab);
      this._put(R, cab, 2.6 + i * 1.0, -19.2, 0, null, [0.9, 0.55], true);
    }
    for (let i = 0; i < 3; i++) {
      const p = Q.pipeRun(5.6, 0.045 + i * 0.01, [0x5a3a22, 0x3a4a4c, 0x4a4a48][i]);
      p.position.set(4.8, 2.55 - i * 0.15, -19.3 + i * 0.13);
      R.g.add(p);
    }
    this._put(R, Q.crates(8, 3), 2.6, -14.7, 0.4, null, [0.9, 0.9]);
    const b = this._bulb(R, 4.8, -16.8, { base: 5, color: 0xffb070, flick: 0.6 });
    b.prio = 1.2;
    this._red(R, 4.8, 2.5, -19.44);
    this._finish(R);
  }

  _hall() {
    const m = this.mat;
    const R = this._room('hall', { floor: m.woodDark, wall: m.wallGreen, ceil: m.ceilBroken }, { wallTile: [2.2, 3.6] });
    const tables = [
      [-5.2, -24.6, { cover: true }, false],
      [5.2, -24.6, { scatter: true }, true],
      [-5.2, -32.0, { balls: true }, true],
      [5.2, -32.0, { cover: true }, false],
    ];
    this.hallLamps = [];
    for (const [x, z, o, on] of tables) {
      this._put(R, P.snookerTable(o), x, z, 0, null, [3.9, 2.1]);
      this.hallLamps.push(this._pendant(R, x, z, { on, flick: 0.4 }));
    }
    // the cursed table in the middle
    const ct = P.snookerTable({ balls: false });
    this.items.cursedTable = this._put(R, ct, POINTS.cursed_table[0], POINTS.cursed_table[1], 0, null, [3.9, 2.1]);
    this.cursedLamp = this._pendant(R, 0, POINTS.cursed_table[1], { color: 0xff9a70, base: 13, flick: 0.6 });
    this._neon(R, 'הסנוקר של גפן', 0, 2.75, -35.15, 0, 6.4, 1.6, '#ff2a4a', 150);
    const sb = P.poster(T.tex(T.scoreboard()), 1.6, 1.0, { emissive: 0.5 });
    sb.position.set(6.2, 2.0, -35.17);
    sb.traverse((o) => (o.userData.keep = true));
    R.g.add(sb);
    this._put(R, P.cueRack(8), -7.0, -35.12, 0, 1.0);
    this._put(R, P.cueRack(8), 2.0, -35.12, 0, 1.0);
    this._put(R, P.bench(2.4), -8.6, -29.5, Math.PI / 2, null, [2.4, 0.6]);
    this._put(R, P.bench(2.4), 8.6, -24.0, -Math.PI / 2, null, [2.4, 0.6]);
    this._put(R, P.deadTree(), -8.2, -34.4, 0, null, [0.7, 0.7]);
    this._put(R, P.ballShelf(), 8.9, -33.4, -Math.PI / 2, 1.2);
    const bottles = [[1.6, -23.6, 0x2a5c2e, 1], [-2.3, -25.2, 0x5a2a12, 1], [2.9, -29.9, 0x2a5c2e, 0], [-7.4, -27.3, 0x2a5c2e, 1], [7.2, -29.1, 0x5a2a12, 1], [-0.9, -33.3, 0x2a5c2e, 0], [3.8, -22.4, 0x5a2a12, 1]];
    bottles.forEach(([x, z, c, ly], i) => this._put(R, Q.bottle(c, !!ly), x, z, i * 1.3));
    this._plate(R, 'VIP', -4.5, 2.52, -35.17, 0, 0.8);
    this._plate(R, 'מרתף · אין כניסה', 5, 2.42, -35.17, 0, 1.3);
    this._plate(R, 'בר', -8.97, 2.62, -27, Math.PI / 2, 0.7);
    this._plate(R, 'משחקים', 8.97, 2.62, -27, -Math.PI / 2, 0.9);
    this.items.vip_keypad = this._put(R, Q.keypad(), POINTS.vip_keypad[0], -35.16, 0, 1.35);
    const gp = P.poster(this.opts.tex?.gefenPhoto || T.tex(T.newspaper()), 0.9, 1.2);
    gp.position.set(-8.97, 1.75, -23.4);
    gp.rotation.y = Math.PI / 2;
    R.g.add(gp);
    this._red(R, 8.94, 3.1, -30.5);
    this._red(R, -8.94, 3.1, -23.6);
    this._finish(R);
  }

  _bar() {
    const m = this.mat;
    const R = this._room('bar', { floor: m.wood, wall: m.wallRed, ceil: m.ceil });
    this._put(R, P.barCounter(4.4), -15.5, -27.2, Math.PI / 2, null, [4.4, 0.8]);
    this._put(R, P.bottleShelf(4, true), -17.12, -27.2, Math.PI / 2, 1.25);
    for (let i = 0; i < 4; i++) this._put(R, P.stool(), -14.55, -25.6 - i * 1.05, 0, null, [0.4, 0.4]);
    this._put(R, Q.barTable(), -11.6, -29.4, 0, null, [0.9, 0.9]);
    this._put(R, Q.chair(), -12.3, -29.5, 1.4, null, [0.4, 0.4]);
    this._put(R, Q.chair(), -11.0, -30.0, -2.2, null, [0.4, 0.4]);
    this._put(R, Q.barTable(), -11.4, -24.3, 0, null, [0.9, 0.9]);
    const fallen = this._put(R, Q.chair(), -12.2, -24.9, 0.6);
    fallen.rotation.x = 1.5;
    fallen.position.y = 0.2;
    this._neon(R, 'בר', -13.4, 2.4, -30.95, 0, 1.8, 0.9, '#3ad0ff', 170);
    this.items.key = Q.keyProp();
    this.items.key.position.set(POINTS.bar_key[0] + 0.15, 1.13, POINTS.bar_key[1]);
    this.items.key.visible = false;
    R.g.add(this.items.key);
    this.items.ball_yellow = this._ball(R, 0xf2c81a, POINTS.ball_yellow[0], 1.14, POINTS.ball_yellow[1]);
    this._put(R, Q.bottle(0x2a5c2e, true), -13.2, -26.4, 0.4);
    this._put(R, Q.bottle(0x8a1818, true), -10.4, -27.8, 1.9);
    this._pendant(R, -15.4, -27.2, { shades: 3, base: 10, flick: 0.5, rotY: Math.PI / 2, color: 0xffc890 });
    this._bulb(R, -11.5, -26.6, { on: false });
    this._red(R, -13.3, 2.75, -23.06);
    this._finish(R);
  }

  _ball(R, color, x, y, z) {
    const b = Q.snookerBall(color);
    b.position.set(x, y, z);
    b.visible = false;
    R.g.add(b);
    return b;
  }

  _arcade() {
    const m = this.mat;
    const R = this._room('arcade', { floor: m.carpetGreen, wall: m.wallBlue, ceil: m.ceil });
    const titles = ['SNOOKER', 'NIGHT 8', 'BLACK', 'POT IT', 'CUE', 'DEMON'];
    this.cabs = [];
    for (let i = 0; i < 4; i++) {
      const c = Q.arcadeCabinet(i * 0.17 + 0.02, titles[i]);
      this._put(R, c, 10.6 + i * 1.25, -30.55, 0, null, [0.8, 0.8], true);
      this.cabs.push(c);
    }
    for (let i = 0; i < 2; i++) {
      const c = Q.arcadeCabinet(0.6 + i * 0.2, titles[4 + i]);
      this._put(R, c, 16.85, -26.6 - i * 1.3, -Math.PI / 2, null, [0.8, 0.8], true);
      this.cabs.push(c);
    }
    // air hockey / foosball table
    const tb = new THREE.Group();
    box(2.0, 0.16, 1.1, std(0xdadada, 0.25), 0, 0.82, 0, tb);
    box(2.1, 0.3, 1.2, std(0x12305a, 0.5), 0, 0.62, 0, tb);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.1, 0.5, 0.1, M.black, sx * 0.9, 0.25, sz * 0.5, tb);
    this._put(R, tb, 13.2, -26.6, 0.2, null, [2.2, 1.3]);
    this.items.ball_green = this._ball(R, 0x1a9a3a, POINTS.ball_green[0], 0.95, POINTS.ball_green[1]);
    this.items.note = Q.notePaper('קוד VIP\n1 9 4 7');
    this.items.note.position.set(17.26, 1.45, POINTS.arcade_note[1]);
    this.items.note.rotation.y = -Math.PI / 2;
    this.items.note.visible = false;
    R.g.add(this.items.note);
    this.items.fuse_arcade = this._put(R, Q.fuseBox(), 17.23, POINTS.fuse_arcade[1], -Math.PI / 2, 1.4);
    this._neon(R, 'משחקים', 13.3, 2.45, -23.05, Math.PI, 3.0, 0.9, '#b04aff', 150);
    this._put(R, P.stool(), 11.2, -29.6, 0, null, [0.4, 0.4]);
    this._put(R, Q.trashBag(), 16.6, -30.4);
    // screens light the room a little
    this._fx('arcade', 12.6, 1.4, -29.6, { color: 0x6a8cff, base: 4.5, range: 8, kind: 'screen', flick: 0.5, pool: 0 });
    this._bulb(R, 13.3, -26.6, { base: 4, flick: 0.7, color: 0xd0c0ff });
    this._red(R, 9.36, 2.75, -29.6);
    this._finish(R);
  }

  _vip() {
    const m = this.mat;
    const R = this._room('vip', { floor: m.carpetRed, wall: m.curtain, ceil: m.ceil }, { wallTile: [1.6, 3.0] });
    this._put(R, P.snookerTable({ cover: true }), -4.5, -39.3, 0, null, [3.9, 2.1]);
    this._put(R, P.sofa(2.4), -7.5, -39.2, Math.PI / 2, null, [2.5, 0.9]);
    this._put(R, P.sofa(1.8), -2.2, -41.9, Math.PI, null, [1.9, 0.9]);
    this._put(R, Q.barTable(), -6.6, -36.6, 0, null, [0.9, 0.9]);
    this.items.ball_brown = this._ball(R, 0x6a3a14, POINTS.ball_brown[0], 0.82, POINTS.ball_brown[1]);
    this._put(R, Q.barTable(), POINTS.ball_brown[0], POINTS.ball_brown[1], 0, null, [0.9, 0.9]);
    this._neon(R, 'VIP', -4.5, 2.45, -42.45, 0, 1.9, 0.9, '#ffb020', 170);
    this._pendant(R, -4.5, -39.3, { color: 0xffc070, base: 11, flick: 0.35 });
    this._red(R, -1.06, 2.6, -37.2);
    this._finish(R);
  }

  _stairs() {
    const m = this.mat;
    const r = ROOMS.stairs;
    const [x0, z0, x1, z1] = r.rect;
    const g = (this.groups.stairs = new THREE.Group());
    g.name = 'stairs';
    this.scene.add(g);
    const batch = new Batch();
    const mats = { floor: m.concreteDark, wall: m.wallPlain, ceil: m.concreteDark };
    const { z0: rz0, z1: rz1, y1 } = r.ramp;
    // landing, ramp, bottom
    const fq = (za, zb, ya, yb) => batch.quad(mats.floor, [x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb], [0, za / 3], [1, za / 3], [1, zb / 3], [0, zb / 3]);
    fq(z1, rz0, 0, 0);
    fq(rz0, rz1, 0, y1);
    fq(rz1, z0, y1, y1);
    // sloped ceiling
    batch.quad(mats.ceil, [x0, 3.0, z1], [x0, 0.0, z0], [x1, 0.0, z0], [x1, 3.0, z1], [0, 0], [0, 3], [1, 3], [1, 0]);
    // tall walls (from the basement floor up)
    const H = 6;
    const opN = [{ u0: DOORS.basement.c - DOORS.basement.w / 2 - x0, u1: DOORS.basement.c + DOORS.basement.w / 2 - x0, y0: 0, y1: DOORS.basement.h }];
    const opS = [{ u0: x1 - (DOORS.cellar.c + DOORS.cellar.w / 2), u1: x1 - (DOORS.cellar.c - DOORS.cellar.w / 2), y0: 3, y1: 3 + DOORS.cellar.h }];
    this._wall(batch, mats.wall, [x0, y1, z0], [1, 0], x1 - x0, H, opN, [2.2, 3]);
    this._wall(batch, mats.wall, [x1, y1, z1], [-1, 0], x1 - x0, H, opS, [2.2, 3]);
    this._wall(batch, mats.wall, [x0, y1, z1], [0, -1], z1 - z0, H, [], [2.2, 3]);
    this._wall(batch, mats.wall, [x1, y1, z0], [0, 1], z1 - z0, H, [], [2.2, 3]);
    // step edges
    const n = 16;
    for (let i = 0; i < n; i++) {
      const z = rz0 - ((i + 0.5) / n) * (rz0 - rz1);
      const y = (y1 * (i + 1)) / n;
      box(x1 - x0, 0.19, (rz0 - rz1) / n, std(0x3a3a38, 0.9), (x0 + x1) / 2, y + 0.19 / 2 + 0.0, z, g);
    }
    const R = { g, batch, r: { ...r, h: 3, y: 0 } };
    this._bulb(R, 5, -37.2, { base: 4, flick: 0.6, y: 2.8 });
    this._fx('stairs', 5, -1.4, -42.6, { color: 0xff3020, base: 4, range: 8, kind: 'red', lamp: null, emergency: false, flick: 0.4 });
    this._finish(R);
  }

  _basement() {
    const m = this.mat;
    const R = this._room('basement', { floor: m.concreteDark, wall: m.concrete, ceil: m.concreteDark }, { wallTile: [3, 3], ceilTile: 3 });
    const y = R.r.y;
    this.items.generator = this._put(R, Q.generator(), 0.2, -54.6, 0, null, [2.5, 1.4], true);
    this.items.altar = this._put(R, Q.altar(), POINTS.altar[0], POINTS.altar[1] - 0.9, 0, null, [1.4, 0.9]);
    const bb = Q.snookerBall(0x050505, 0.06);
    bb.material.emissive.setHex(0xff1008);
    bb.material.emissiveIntensity = 1.4;
    bb.position.set(POINTS.altar[0], y + 0.97, POINTS.altar[1] - 0.9);
    R.g.add(bb);
    this.items.blackBall = bb;
    this.sourceLight = this._fx('basement', POINTS.altar[0], y + 1.25, POINTS.altar[1] - 0.9, { color: 0xff1a0a, base: 7, range: 9, kind: 'red', lamp: null, flick: 0.7, pool: 3.4 });
    this.sourceLight.prio = 2;
    for (let i = 0; i < 4; i++) {
      const p = Q.pipeRun(13.6, 0.06 + (i % 2) * 0.03, [0x5a3a22, 0x3a4a4c, 0x55504a, 0x4a2a1a][i]);
      p.position.set(5, y + 2.6 - (i % 2) * 0.2, -45 - i * 2.9);
      R.g.add(p);
    }
    this._put(R, P.shelfUnit(1.6, 4), 10.6, -55.72, 0, null, [1.6, 0.45], true);
    this._put(R, P.shelfUnit(1.6, 4), 8.8, -55.72, 0, null, [1.6, 0.45], true);
    this._put(R, Q.crates(11, 5), 10.6, -46.2, 0.5, null, [1.2, 1.1]);
    this._put(R, Q.crates(12, 4), -0.9, -46.0, 1.2, null, [1.0, 1.0]);
    this._put(R, P.snookerTable({ cover: true }), 9.2, -51.0, Math.PI / 2, null, [3.9, 2.1]);
    const wr = P.decal(T.writing('מי שיכניס את השחור'), 4.2, 0.9, 0.9);
    wr.position.set(5.5, y + 1.7, -55.96);
    wr.userData.keep = true;
    R.g.add(wr);
    this._bulb(R, 2.2, -47.6, { base: 4.5, flick: 0.75 });
    this._bulb(R, 9.4, -53.2, { on: false });
    this._finish(R);
  }

  _outside() {
    const m = this.mat;
    const r = ROOMS.outside;
    const g = (this.groups.outside = new THREE.Group());
    g.name = 'outside';
    this.scene.add(g);
    const [x0, z0, x1, z1] = r.rect;
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 14, z1 - z0 + 14), m.asphalt);
    gr.rotation.x = -Math.PI / 2;
    gr.position.set((x0 + x1) / 2 + 4, -0.01, (z0 + z1) / 2);
    gr.receiveShadow = true;
    g.add(gr);
    this.skyNight = T.tex(T2.sky(false));
    this.skyDawn = T.tex(T2.sky(true));
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), new THREE.MeshBasicMaterial({ map: this.skyNight, fog: false }));
    sky.position.set(26, 7.5, -9);
    sky.rotation.y = -Math.PI / 2;
    g.add(sky);
    this.items.sky = sky;
    // building front wall around the entrance (seen from outside)
    const d = DOORS.entrance;
    const wallMat = std(0x2a2422, 0.9);
    box(0.2, 5, 8 - 0, wallMat, 10.2, 2.5, -9 - (d.w / 2 + 4), g);
    box(0.2, 5, 8, wallMat, 10.2, 2.5, -9 + (d.w / 2 + 4), g);
    box(0.2, 5 - d.h, d.w, wallMat, 10.2, d.h + (5 - d.h) / 2, -9, g);
    // street lamp
    cyl(0.05, 0.07, 4.2, M.black, 13.6, 2.1, -6.2, g, 8);
    const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd9a0).multiplyScalar(4) });
    const lb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.2), lampM);
    lb.position.set(13.35, 4.2, -6.2);
    g.add(lb);
    const lamp = { light: null, bulbMats: [lampM], cones: [], baseIntensity: 1 };
    this.streetLamp = this._fx('outside', 13.2, 4.0, -6.4, { color: 0xffc98a, base: 16, range: 14, kind: 'bulb', lamp, flick: 0.5, pool: 5 });
    this.dawnLight = this._fx('outside', 15, 3.2, -9, { color: 0xffb070, base: 0, range: 30, kind: 'sun', lamp: null, flick: 0, state: 'off' });
    this.nav.block(13.4, -6.4, 13.8, -6.0);
  }

  _vents() {
    const m = this.mat;
    const mats = { floor: m.vent, wall: m.vent, ceil: m.vent };
    for (const id of ['ventL', 'ventR']) {
      const v = VENTS[id];
      const g = (this.groups[id] = new THREE.Group());
      g.name = id;
      this.scene.add(g);
      const batch = new Batch();
      const H = v.y1 - v.y0;
      const tile = { floorTile: 1.2, wallTile: [1.6, 0.8], ceilTile: 1.2 };
      const aRect = [v.a[0], v.a[1], v.a[2], v.b[1]];
      this._shell(batch, aRect, v.y0, H, mats, { ...tile, sides: 'NWE' });
      const L = v.b[2] - v.b[0];
      const gap = v.side < 0 ? { u0: 0, u1: v.a[2] - v.a[0], y0: 0, y1: H } : { u0: L - (v.a[2] - v.a[0]), u1: L, y0: 0, y1: H };
      this._shell(batch, v.b, v.y0, H, mats, { ...tile, sides: v.side < 0 ? 'NSW' : 'NSE', openings: { N: [gap] } });
      batch.build(g);
      // dedicated vent light fixture (switched by the player)
      const mx = v.side < 0 ? v.b[2] - 0.7 : v.b[0] + 0.7;
      const f = this._fx(id, mx, v.y1 - 0.08, 0.2, { color: 0xfff0d0, base: 3.2, range: 6, kind: 'vent', lamp: null, flick: 0.15, state: 'off', prio: 3 });
      this[id + 'Light'] = f;
      const cx = v.side < 0 ? v.b[2] - 0.3 : v.b[0] + 0.3;
      this[id + 'IR'] = this._fx(id, cx, v.y1 - 0.1, 0.2, { color: 0xb8ffd0, base: 1.1, range: 9, kind: 'vent', lamp: null, flick: 0, state: 'off', prio: 4 });
      // grate at the far end
      const gr = Q.ventGrate(0.86, 0.76);
      gr.position.set((v.a[0] + v.a[2]) / 2, v.y0 + H / 2, v.a[1] + 0.03);
      g.add(gr);
      const B2 = new Batch();
      B2.absorb(g);
      B2.build(g);
    }
  }

  // ------------------------------------------------------------ runtime
  /** Decide which rooms are drawn. */
  setView(roomId) {
    if (!roomId || roomId === this.viewRoom) return;
    this.viewRoom = roomId;
    const vis = new Set(SEES[roomId] || [roomId]);
    this.visible = vis;
    for (const id in this.groups) {
      if (id === '_doors') continue;
      this.groups[id].visible = vis.has(id);
    }
  }

  /** Infra-red helper light for the vent cameras: id = 'ventL' | 'ventR' | null */
  setIR(id) {
    this.ventLIR.state = id === 'ventL' ? 'on' : 'off';
    this.ventRIR.state = id === 'ventR' ? 'on' : 'off';
  }

  /** normal | dim | emergency | blackout | dawn */
  setPower(mode) {
    this.power = mode;
  }

  setFixture(f, state) {
    f.state = state;
  }

  _target(f, t) {
    if (f.state !== 'on') return 0;
    const mode = this.power;
    if (f.kind === 'sun') return 1;
    if (f.kind === 'vent') return 1;
    if (mode === 'blackout') return 0;
    if (mode === 'emergency' || mode === 'final') {
      if (f.emergency) return 0.55 + 0.45 * Math.sin(t * 3.1 + f.seed);
      if (f === this.sourceLight) return P.flickerFactor(t, f.seed, 0.9) * 1.3;
      return 0;
    }
    if (f.emergency) return 0;
    let v = P.flickerFactor(t, f.seed, f.flick);
    if (mode === 'dim') v *= 0.45;
    if (mode === 'dawn') v *= 0.6;
    return v * (this.flickerBoost ? 1 - this.flickerBoost * (0.5 + 0.5 * Math.sin(t * 47 + f.seed * 9)) : 1);
  }

  /** Per frame: lamps flicker, the light pool follows the viewer, doors swing. */
  update(dt, viewPos) {
    const t = (this.t += dt);
    const vis = this.visible;
    const cands = [];
    for (const f of this.fixtures) {
      if (!vis.has(f.room)) {
        f.f = 0;
        continue;
      }
      const tg = this._target(f, t);
      f.f = tg;
      if (f.lamp) P.setLamp(f.lamp, Math.min(1.3, tg));
      if (f.poolMesh) f.poolMesh.material.opacity = Math.min(1, tg) * 0.5;
      if (tg > 0.02) {
        const d2 = (f.x - viewPos.x) ** 2 + (f.y - viewPos.y) ** 2 + (f.z - viewPos.z) ** 2;
        cands.push([(f.base * tg * f.prio) / (4 + d2), f]);
      }
    }
    cands.sort((a, b) => b[0] - a[0]);
    const chosen = cands.slice(0, this.pool.length).map((c) => c[1]);
    const set = new Set(chosen);
    const free = [];
    for (const L of this.pool) {
      if (L.userData.fx && set.has(L.userData.fx)) set.delete(L.userData.fx);
      else free.push(L);
    }
    for (const f of set) {
      const L = free.pop();
      if (!L) break;
      L.userData.fx = f;
      L.userData.fade = 0;
      L.position.set(f.x, f.y, f.z);
      L.color.copy(f.color);
      L.distance = f.range;
    }
    for (const L of free) L.userData.fx = null;
    for (const L of this.pool) {
      const f = L.userData.fx;
      if (!f) {
        L.intensity = 0;
        continue;
      }
      L.userData.fade = Math.min(1, (L.userData.fade || 0) + dt * 6);
      L.intensity = f.base * f.f * L.userData.fade;
    }
    // ambient by power mode
    const amb = { normal: 0.42, dim: 0.26, emergency: 0.2, final: 0.16, blackout: 0.07, dawn: 0.9 }[this.power] ?? 0.4;
    this.ambient.intensity += (amb - this.ambient.intensity) * Math.min(1, dt * 3);
    if (this.power === 'emergency' || this.power === 'final') this.ambient.color.setRGB(0.9, 0.34, 0.3);
    else if (this.power === 'dawn') this.ambient.color.setRGB(1.0, 0.82, 0.66);
    else this.ambient.color.setRGB(0.56, 0.61, 0.72);
    // neon signs buzz
    for (const n of this.neons) {
      if (!vis.has(n.room)) continue;
      const on = this.power === 'normal' || this.power === 'dim';
      const k = on ? P.flickerFactor(t, n.seed, 0.8) : 0.03;
      n.mesh.material.color.setScalar(n.mesh.baseIntensity * k);
    }
    // doors
    for (const id in this.doorObjs) {
      const o = this.doorObjs[id];
      const tg = o.open ? 1 : 0;
      if (Math.abs(o.a - tg) > 0.001) {
        o.a += Math.sign(tg - o.a) * Math.min(Math.abs(tg - o.a), dt * 1.6);
        this._poseDoor(o);
      }
    }
    // monitor static
    this._noiseT = (this._noiseT || 0) + dt;
    if (this._noiseT > 0.09 && vis.has('office')) {
      this._noiseT = 0;
      this.noise.draw([150, 255, 180], true);
      this.noiseTex.needsUpdate = true;
    }
    if (this.cabs && vis.has('arcade')) {
      const on = this.power === 'normal' || this.power === 'dim';
      this.cabs.forEach((c, i) => c.screen.color.setScalar(on ? 1.6 * P.flickerFactor(t, i * 3.3, 0.6) : 0.02));
    }
  }

  setClock(hours) {
    if (Math.abs((this._clockH ?? -1) - hours) < 0.01) return;
    this._clockH = hours;
    this.clock.draw(hours === 0 ? 12 : hours);
    this.clockTex.needsUpdate = true;
  }

  /**
   * Cheap light estimate for cut-out characters (they are not lit by the real lights).
   * Returns [r,g,b] roughly in 0..1.6
   */
  sampleLight(x, y, z, room) {
    let r = 0;
    let g = 0;
    let b = 0;
    for (const f of this.fixtures) {
      if (f.f <= 0.02) continue;
      if (f.room !== room && !(SEES[room] || []).includes(f.room)) continue;
      const d2 = (f.x - x) ** 2 + (f.y - (y + 1.2)) ** 2 + (f.z - z) ** 2;
      if (d2 > f.range * f.range) continue;
      const k = (f.base * f.f * 0.085) / (1 + d2 * 0.55) * (f.room === room ? 1 : 0.45);
      r += f.color.r * k;
      g += f.color.g * k;
      b += f.color.b * k;
    }
    const a = this.ambient.intensity * 0.3;
    r += this.ambient.color.r * a;
    g += this.ambient.color.g * a;
    b += this.ambient.color.b * a;
    return [r, g, b];
  }

  dawn(on = true) {
    this.items.sky.material.map = on ? this.skyDawn : this.skyNight;
    this.items.sky.material.needsUpdate = true;
    this.dawnLight.state = on ? 'on' : 'off';
    this.dawnLight.base = on ? 60 : 0;
    this.dawnLight.prio = 6;
    this.scene.fog.color.setHex(on ? 0x2a1c14 : 0x030405);
    this.scene.fog.density = on ? 0.012 : 0.034;
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
  }
}
