// Light traffic, kept cheap enough for phones: cars on fixed routes (from the foot of the access road to
// Hadera and back, and loops around city blocks), all drawn as one instanced mesh. They keep to the
// right, slow for bends, keep their distance from the car ahead, wait for Nehorai's car and for people
// in the way, and stop for a moment when bumped. Kinematic: they follow the route, no physics.
import * as THREE from 'three';
import { trafficCarGeometry, trafficMaterial } from '../world/car.js';
import { CollisionWorld } from '../world/colliders.js';
import { roadPath } from './autopilot.js';
import { angleDiff } from '../core/math.js';

const COLORS = ['#c8352d', '#2f5e8f', '#3d4046', '#d9d6cf', '#7a8a96', '#1f2a33', '#a9b4bc', '#5b5a45', '#e0b23a', '#2f6b3c', '#8a2f3c', '#e8e6e1'];
const LAT = 2.1; // how far to either side of its path a car looks for things in the way

// a closed path sampled every couple of meters, with the safe speed at each sample
class Route {
  constructor(points, cruise) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p.x, 0, p.z)), true, 'centripetal');
    this.length = curve.getLength();
    const n = Math.max(16, Math.round(this.length / 2)), pts = curve.getSpacedPoints(n);
    pts.pop();
    this.n = pts.length;
    this.step = this.length / this.n;
    this.x = Float32Array.from(pts, (p) => p.x);
    this.z = Float32Array.from(pts, (p) => p.z);
    this.yaw = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) { const j = (i + 1) % this.n; this.yaw[i] = Math.atan2(this.x[j] - this.x[i], this.z[j] - this.z[i]); }
    // a bend's safe speed, then eased back so cars brake before it rather than in it
    this.safe = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) {
      const turn = Math.abs(angleDiff(this.yaw[i], this.yaw[(i + 1) % this.n])) + 1e-4;
      this.safe[i] = Math.min(cruise, Math.sqrt(2.8 * (this.step / turn)));
    }
    for (let round = 0; round < 2; round++) {
      for (let i = this.n - 1; i >= 0; i--) {
        const next = this.safe[(i + 1) % this.n];
        this.safe[i] = Math.min(this.safe[i], Math.sqrt(next * next + 2 * 3.5 * this.step));
      }
    }
  }

  at(s, out) {
    const f = (((s % this.length) + this.length) % this.length) / this.step, i = Math.floor(f) % this.n, j = (i + 1) % this.n, t = f - Math.floor(f);
    out.x = this.x[i] + (this.x[j] - this.x[i]) * t;
    out.z = this.z[i] + (this.z[j] - this.z[i]) * t;
    out.yaw = this.yaw[i] + angleDiff(this.yaw[i], this.yaw[j]) * t;
    out.safe = this.safe[i];
    return out;
  }
}

class TrafficCar {
  constructor(id, route, s, color) {
    Object.assign(this, { id, route, s, color });
    this.speed = 0;
    this.wait = 0;        // stopped after a bump
    this.held = 0;        // how long something has been in the way
    this.pos = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.p = {};
  }

  // Nehorai's car ran into this one
  bumpedBy() { this.wait = 2.5; this.speed = 0; }
}

export class Traffic {
  constructor(game, count) {
    this.game = game;
    const W = game.world, P = W.places, H = P.hadera;
    this.routes = [];
    this.cars = [];
    if (!count || !H) return;
    // ---------- the road down to Hadera and back, around a block, turning at the foot of the hill ----------
    const acc = P.accessRoad, west = P.westRoad, blvd = P.cityRoads[H.XS.length + H.BLVD];
    const ns = (k) => P.cityRoads[k], ew = (k) => P.cityRoads[H.XS.length + k];
    const sAtX = (road, x) => Math.abs(road.x[0] - x); // city streets run straight along an axis
    const sAtZ = (road, z) => Math.abs(road.z[0] - z);
    const top = acc.length - 70, lane = 1.9, bl = 4.6, cl = 2.25;
    const loop = [
      ...roadPath(acc, top, acc.length - 2, lane, 4),
      ...roadPath(west, 2, west.length - 12, lane, 4),
      ...roadPath(blvd, 4, sAtX(blvd, H.XS[1]) - 12, bl, 4),
      ...roadPath(ns(1), sAtZ(ns(1), H.ZS[H.BLVD]) - 14, sAtZ(ns(1), H.ZS[1]) + 8, cl, 4),
      ...roadPath(ew(1), sAtX(ew(1), H.XS[1]) - 8, sAtX(ew(1), H.XS[0]) + 8, cl, 4),
      ...roadPath(ns(0), sAtZ(ns(0), H.ZS[1]) + 8, sAtZ(ns(0), H.ZS[H.BLVD]) - 14, cl, 4),
      // left onto the boulevard, which ends right there: straight into the road home
      ...roadPath(west, west.length - 12, 2, lane, 4),
      ...roadPath(acc, acc.length - 2, top + 4, lane, 4),
    ];
    // a U-turn across the road at the top, using the shoulders
    const at = (s, off) => { const q = acc.at(s); return { x: q.x + q.nx * off, z: q.z + q.nz * off }; };
    loop.push(at(top - 2, -2.6), at(top - 7, -1.4), at(top - 8.5, 1.0), at(top - 5, 2.8), at(top - 1, 2.2));
    this.routes.push(new Route(loop, 18));
    // ---------- around city blocks, always turning right ----------
    const pick = [[1, 1], [2, 2], [0, 3], [3, 1], [2, 3], [1, 0], [3, 3]];
    for (const [i, j] of pick) {
      const b = H.blocks.find((q) => q.i === i && q.j === j);
      if (!b) continue;
      const d = cl, x0 = b.x0 - d, x1 = b.x1 + d, z0 = b.z0 - d, z1 = b.z1 + d, k = 7;
      this.routes.push(new Route([
        { x: x0 + k, z: z0 }, { x: x1 - k, z: z0 }, { x: x1, z: z0 + k }, { x: x1, z: z1 - k },
        { x: x1 - k, z: z1 }, { x: x0 + k, z: z1 }, { x: x0, z: z1 - k }, { x: x0, z: z0 + k },
      ], 11));
    }
    // ---------- the cars: a few on the long route, one on each block loop ----------
    const highway = Math.max(1, Math.round(count * 0.35));
    for (let k = 0; k < count; k++) {
      const route = k < highway ? this.routes[0] : this.routes[1 + ((k - highway) % (this.routes.length - 1))];
      const s = k < highway ? (route.length * k) / highway : (route.length * ((k * 0.37) % 1));
      this.cars.push(new TrafficCar(k, route, s, COLORS[k % COLORS.length]));
    }
    this.mesh = new THREE.InstancedMesh(trafficCarGeometry(), trafficMaterial(), this.cars.length);
    this.mesh.name = 'traffic';
    this.mesh.frustumCulled = false; // a handful of cars: cheaper to draw them all than to keep bounds
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    const col = new THREE.Color();
    this.cars.forEach((c, k) => {
      this.mesh.setColorAt(k, col.set(c.color));
      c.box = W.cols.addDynamicBox(c, 0.92, 2.08);
    });
    game.scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.v = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    for (const c of this.cars) this.place(c);
  }

  // things that must not be driven into: Nehorai, his car, friends and passers-by, other traffic
  obstacles() {
    const g = this.game, out = this.obs || (this.obs = []);
    out.length = 0;
    out.push({ x: g.car.pos.x, z: g.car.pos.z, r: 2.3, player: true });
    if (g.mode === 'foot') out.push({ x: g.player.pos.x, z: g.player.pos.z, r: 0.6, player: true });
    for (const n of g.npcs.values()) if (n.visible && !n.inCar) out.push({ x: n.pos.x, z: n.pos.z, r: 0.6 });
    for (const p of g.pedestrians?.people || []) if (p.visible) out.push({ x: p.pos.x, z: p.pos.z, r: 0.6 });
    return out;
  }

  update(dt) {
    if (!this.cars.length) return;
    const obs = this.obstacles(), cam = this.game.camera.position;
    for (const c of this.cars) {
      const R = c.route;
      R.at(c.s, c.p);
      // the nearest thing in the way, straight ahead within a short corridor
      const look = 7 + c.speed * 1.6, f = { x: Math.sin(c.p.yaw), z: Math.cos(c.p.yaw) };
      let gap = Infinity, byPlayer = false;
      const consider = (x, z, r, player) => {
        const dx = x - c.pos.x, dz = z - c.pos.z, ahead = dx * f.x + dz * f.z, side = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 1 && ahead < look + r && side < LAT + r * 0.5 && ahead - r < gap) { gap = ahead - r; byPlayer = player; }
      };
      for (const o of obs) consider(o.x, o.z, o.r, !!o.player);
      if (c.held < 4) for (const d of this.cars) if (d !== c) consider(d.pos.x, d.pos.z, 2.2, false);
      let want = c.p.safe;
      if (c.wait > 0) { c.wait -= dt; want = 0; }
      if (gap < Infinity) want = Math.min(want, Math.max(0, (gap - 3.5) * 0.8));
      c.held = want < 0.3 ? c.held + dt : Math.max(0, c.held - dt);
      if (c.held > 7) c.held = 0; // waited at a crossing long enough: go
      // stuck behind Nehorai's parked car for long and nobody watching: slip past it
      if (byPlayer && c.held > 6 && Math.hypot(c.pos.x - cam.x, c.pos.z - cam.z) > 90) { c.s += 30; c.held = 0; }
      c.speed = want < c.speed ? Math.max(want, c.speed - 7 * dt) : Math.min(want, c.speed + 2.6 * dt);
      c.s = (c.s + c.speed * dt) % R.length;
      this.place(c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  place(c) {
    const W = this.game.world, p = c.route.at(c.s, c.p);
    c.pos.x = p.x; c.pos.z = p.z; c.yaw = p.yaw;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    const yf = W.groundHeight(p.x + fx * 1.3, p.z + fz * 1.3), yb = W.groundHeight(p.x - fx * 1.3, p.z - fz * 1.3);
    c.pos.y = (yf + yb) / 2;
    c.pitch = Math.atan2(yf - yb, 2.6);
    this.e.set(-c.pitch, c.yaw, 0, 'YXZ');
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(c.pos.x, c.pos.y, c.pos.z), this.q, this.one);
    this.mesh.setMatrixAt(c.id, this.m);
    CollisionWorld.setBox(c.box, c.pos.x, c.pos.z, c.yaw, c.pos.y - 0.5, c.pos.y + 1.5);
  }

  dispose() {
    if (!this.mesh) return;
    this.game.scene.remove(this.mesh);
    this.mesh.dispose();
    for (const c of this.cars) this.game.world.cols.dynamic.delete(c.box);
    this.cars = [];
  }
}
