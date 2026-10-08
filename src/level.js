// World container: walls, floors, doors, colliders, rooms, interactables, hiding spots.
// Static geometry is merged per material at the end to keep draw calls low.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NavGrid } from './nav.js';
import { audio } from './audio.js';
import { clamp } from './util.js';

export const WALL_H = 2.7;
export const WALL_T = 0.2;

// Box geometry whose UVs are in metres (so textures tile at real-world scale)
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  return g;
}

export class Door {
  constructor(world, cfg) {
    Object.assign(this, {
      id: cfg.id, name: cfg.name || 'דלת', locked: !!cfg.locked, keyId: cfg.keyId || null,
      lockedMsg: cfg.lockedMsg || 'נעול.', openAmount: 0, target: 0, speed: 1.6,
      noamCanPass: !!cfg.noamCanPass, onOpen: cfg.onOpen || null, canLockInside: !!cfg.canLockInside, codeLock: !!cfg.codeLock,
    });
    const { x, z, axis, width, height = 2.08, hinge = 'start', swing = 1, mat } = cfg;
    this.axis = axis; this.width = width; this.swing = swing;
    // centre of the opening
    this.cx = axis === 'x' ? x + width / 2 : x;
    this.cz = axis === 'x' ? z : z + width / 2;
    const hx = axis === 'x' ? (hinge === 'start' ? x : x + width) : x;
    const hz = axis === 'x' ? z : (hinge === 'start' ? z : z + width);
    this.pivot = new THREE.Group();
    this.pivot.position.set(hx, 0, hz);
    this.baseRot = axis === 'z' ? -Math.PI / 2 : 0;
    const dirSign = hinge === 'start' ? 1 : -1;
    this.dirSign = dirSign;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(width - 0.04, height, 0.045), mat);
    panel.position.set(dirSign * width / 2, height / 2, 0);
    panel.castShadow = true; panel.receiveShadow = true;
    this.pivot.add(panel);
    this.panel = panel;
    // handles
    const hm = world.mats.chrome;
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.025), hm);
      h.position.set(dirSign * (width - 0.12), 1.0, s * 0.05);
      this.pivot.add(h);
    }
    if (cfg.decor) cfg.decor(this.pivot, panel, dirSign);
    this.pivot.rotation.y = this.baseRot;
    world.scene.add(this.pivot);
    // collider (only while closed-ish)
    const t = 0.12;
    this.collider = axis === 'x'
      ? { minX: x, maxX: x + width, minZ: z - t, maxZ: z + t, minY: 0, maxY: height, door: this }
      : { minX: x - t, maxX: x + t, minZ: z, maxZ: z + width, minY: 0, maxY: height, door: this };
    world.colliders.push(this.collider);
    // door cells must reach through the wall's agent-radius padding on both sides
    this.navBox = axis === 'x'
      ? { minX: x + 0.12, maxX: x + width - 0.12, minZ: z - 0.5, maxZ: z + 0.5 }
      : { minX: x - 0.5, maxX: x + 0.5, minZ: z + 0.12, maxZ: z + width - 0.12 };
    this.world = world;
    this.sndPos = { x: this.cx, y: 1.2, z: this.cz };
  }

  get isOpen() { return this.target > 0.5; }
  get solid() { return this.openAmount < 0.55; }

  open(byNoam = false, fast = false) {
    if (this.target === 1) return;
    this.target = 1;
    this.speed = fast ? 4.5 : byNoam ? 2.4 : 1.6;
    audio.at(this.sndPos, (d) => { if (fast) audio.doorSlam(d); else audio.doorCreak(d, byNoam ? 0.8 : 1.1, byNoam ? 1.3 : 1); });
    this.world.emitNoise(this.cx, this.cz, fast ? 9 : 3, 'door');
    if (this.onOpen) this.onOpen(byNoam);
  }

  close(slam = false) {
    if (this.target === 0) return;
    this.target = 0;
    this.speed = slam ? 5 : 1.8;
    this._closing = true;
    this._slam = slam;
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  setOpenInstant(v) { this.openAmount = this.target = v; this._apply(); }

  _apply() {
    const ang = this.swing * this.dirSign * this.openAmount * Math.PI * 0.48;
    this.pivot.rotation.y = this.baseRot + ang;
  }

  update(dt) {
    if (this.openAmount !== this.target) {
      const d = Math.sign(this.target - this.openAmount) * this.speed * dt;
      this.openAmount = clamp(this.openAmount + d, 0, 1);
      if ((d > 0 && this.openAmount >= this.target) || (d < 0 && this.openAmount <= this.target)) {
        this.openAmount = this.target;
        if (this._closing && this.target === 0) {
          this._closing = false;
          audio.at(this.sndPos, (dd) => (this._slam ? audio.doorSlam(dd) : audio.doorThud(dd, 0.7)));
          this.world.emitNoise(this.cx, this.cz, this._slam ? 9 : 2.5, 'door');
        }
      }
      this._apply();
    }
  }
}

export class World {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.colliders = [];
    this.doors = new Map();
    this.interactables = [];
    this.hidingSpots = [];
    this.rooms = [];
    this.items = new Map();
    this.updaters = [];
    this.flickers = [];
    this._static = new Map();
    this.noiseListeners = [];
    this.mats = {};
  }

  mat(name, params) {
    if (!this.mats[name]) this.mats[name] = new THREE.MeshStandardMaterial(params);
    return this.mats[name];
  }

  // ---------- static geometry ----------
  _pushStatic(geo, mat, matrix) {
    geo.applyMatrix4(matrix);
    if (geo.index === null) geo = geo.toNonIndexed();
    // normalise attributes so all geometries can merge
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!this._static.has(mat)) this._static.set(mat, []);
    this._static.get(mat).push(geo);
  }

  // y = bottom of the box
  staticBox(x, y, z, w, h, d, mat, { collide = true, opaque, nav, rotY = 0, tag } = {}) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
    this._pushStatic(boxGeo(w, h, d), mat, m);
    if (collide) this.addCollider(x, y, z, rotY ? Math.max(w, d) : w, h, rotY ? Math.max(w, d) : d, { opaque, nav, tag });
  }

  staticMesh(geo, mat, pos, rot = new THREE.Euler(), scale = new THREE.Vector3(1, 1, 1)) {
    const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(rot), scale);
    this._pushStatic(geo, mat, m);
  }

  addCollider(x, y, z, w, h, d, { opaque, nav, tag } = {}) {
    const c = { minX: x - w / 2, maxX: x + w / 2, minY: y, maxY: y + h, minZ: z - d / 2, maxZ: z + d / 2, opaque, nav, tag };
    this.colliders.push(c);
    return c;
  }

  // dynamic mesh (not merged)
  box(x, y, z, w, h, d, mat, parent = this.scene) {
    const m = new THREE.Mesh(boxGeo(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // Wall along X (axis 'x', at z=c from a0..a1) or along Z (axis 'z', at x=c).
  // matA = side facing -z/-x, matB = side facing +z/+x. openings: [{a, b, bottom=0, top}]
  wall(axis, c, a0, a1, { matA, matB, openings = [], h = WALL_H, t = WALL_T, collide = true } = {}) {
    matA = matA || this.mats.wall; matB = matB || matA;
    const ops = [...openings].sort((p, q) => p.a - q.a);
    const pieces = [];
    let cur = a0;
    for (const o of ops) {
      if (o.a > cur) pieces.push([cur, o.a, 0, h]);
      if ((o.bottom || 0) > 0) pieces.push([o.a, o.b, 0, o.bottom]);
      if (o.top != null && o.top < h) pieces.push([o.a, o.b, o.top, h]);
      cur = o.b;
    }
    if (cur < a1) pieces.push([cur, a1, 0, h]);
    for (const [p0, p1, y0, y1] of pieces) {
      const len = p1 - p0, mid = (p0 + p1) / 2, hh = y1 - y0;
      if (len <= 0.001 || hh <= 0.001) continue;
      if (axis === 'x') {
        this.staticBox(mid, y0, c - t / 4, len, hh, t / 2, matA, { collide: false });
        this.staticBox(mid, y0, c + t / 4, len, hh, t / 2, matB, { collide: false });
        if (collide) this.addCollider(mid, y0, c, len, hh, t, { opaque: y0 < 0.3 && y1 > 1.6 });
      } else {
        this.staticBox(c - t / 4, y0, mid, t / 2, hh, len, matA, { collide: false });
        this.staticBox(c + t / 4, y0, mid, t / 2, hh, len, matB, { collide: false });
        if (collide) this.addCollider(c, y0, mid, t, hh, len, { opaque: y0 < 0.3 && y1 > 1.6 });
      }
    }
  }

  // horizontal plane with world-space UVs (x,z)
  plane(x0, z0, x1, z1, y, mat, facingDown = false) {
    const g = new THREE.BufferGeometry();
    const p = facingDown
      ? [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1]
      : [x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0];
    const n = facingDown ? [0, -1, 0] : [0, 1, 0];
    const uv = facingDown ? [x0, -z0, x1, -z0, x1, -z1, x0, -z1] : [x0, -z0, x0, -z1, x1, -z1, x1, -z0];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([...n, ...n, ...n, ...n], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this._pushStatic(g, mat, new THREE.Matrix4());
  }

  // vertical decal plane facing a direction ('+z','-z','+x','-x')
  decal(tex, x, y, z, w, h, facing, { emissive = 0, transparent = true, parent = this.scene, color = 0xffffff, rough = 0.85 } = {}) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent, roughness: rough, color, alphaTest: transparent ? 0.02 : 0, depthWrite: !transparent || true, polygonOffset: true, polygonOffsetFactor: -2 });
    if (emissive) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = tex; mat.emissiveIntensity = emissive; }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': -Math.PI / 2 }[facing];
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  addDoor(cfg) {
    const d = new Door(this, cfg);
    this.doors.set(cfg.id, d);
    this.addInteractable({
      id: 'door_' + cfg.id, x: d.cx, y: 1.1, z: d.cz, r: 1.9, cos: 0.72, door: true,
      label: () => {
        const p = this.game && this.game.player;
        if (d.locked && d.insideUnlock && p && p.room && p.room.id === d.insideUnlock) return 'לפתוח את המנעול';
        if (d.locked && d.codeLock) return null;
        if (d.locked) return d.keyId && p && p.has(d.keyId) ? null : `${d.name} — נעול`;
        return d.isOpen ? 'לסגור את הדלת' : 'לפתוח את הדלת';
      },
      use: () => {
        const p = this.game && this.game.player;
        if (d.locked && d.insideUnlock && p && p.room && p.room.id === d.insideUnlock) {
          d.locked = false; audio.unlock(); return;
        }
        if (d.locked) {
          audio.at(d.sndPos, (a) => audio.lockedRattle(a));
          this.emitNoise(d.cx, d.cz, 2.5, 'door');
          if (this.game) this.game.ui.toast(d.lockedMsg);
          return;
        }
        d.toggle();
      },
    });
    return d;
  }

  addRoom(id, name, x0, z0, x1, z1, extra = {}) {
    this.rooms.push({ id, name, x0, z0, x1, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, ...extra });
  }

  roomAt(x, z) {
    for (const r of this.rooms) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r;
    return null;
  }

  addInteractable(cfg) {
    const it = { r: 1.7, cos: 0.82, enabled: () => true, ...cfg };
    this.interactables.push(it);
    return it;
  }

  removeInteractable(id) { this.interactables = this.interactables.filter((i) => i.id !== id); }
  getInteractable(id) { return this.interactables.find((i) => i.id === id); }

  addHidingSpot(cfg) {
    this.hidingSpots.push(cfg);
    this.addInteractable({
      id: 'hide_' + cfg.id, x: cfg.x, y: cfg.y ?? 0.9, z: cfg.z, r: 1.6, cos: 0.7,
      label: () => cfg.label || 'להתחבא',
      enabled: () => this.game && !this.game.player.hidden && this.game.allowHiding,
      use: () => this.game.player.enterHide(cfg),
      hide: true,
    });
  }

  onNoise(fn) { this.noiseListeners.push(fn); }
  emitNoise(x, z, radius, kind) { for (const fn of this.noiseListeners) fn(x, z, radius, kind); }

  finalize() {
    for (const [mat, geos] of this._static) {
      const merged = mergeGeometries(geos, false);
      if (!merged) { console.warn('merge failed for', mat); continue; }
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = !mat.userData.noShadow;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }
    this._static.clear();
    const b = this.bounds;
    this.nav = new NavGrid(b.minX, b.minZ, b.maxX, b.maxZ, 0.25);
    this.nav.rasterize(this.colliders, 0.3);
    for (const d of this.doors.values()) this.nav.addDoor(d, d.navBox);
  }

  // Resolve a circle (player/agent) against colliders. Returns pushed position.
  collide(pos, r, height = 1.7, stepH = 0.3) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const c of this.colliders) {
        if (c.maxY <= stepH || c.minY >= height) continue;
        if (c.door && !c.door.solid) continue;
        if (c.disabled) continue;
        const nx = clamp(pos.x, c.minX, c.maxX);
        const nz = clamp(pos.z, c.minZ, c.maxZ);
        let dx = pos.x - nx, dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2), push = r - d;
            pos.x += (dx / d) * push; pos.z += (dz / d) * push;
          } else {
            // centre inside box: push out along the smallest axis
            const l = pos.x - c.minX, rr = c.maxX - pos.x, t = pos.z - c.minZ, bb = c.maxZ - pos.z;
            const m = Math.min(l, rr, t, bb);
            if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r;
            else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    return pos;
  }

  update(dt, t) {
    for (const d of this.doors.values()) d.update(dt);
    for (const f of this.flickers) f(dt, t);
    for (const u of this.updaters) u(dt, t);
  }
}
