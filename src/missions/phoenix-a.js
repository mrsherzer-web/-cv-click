// Chapter nine, missions 34-36 (the safe house, the death road, the Black Port): the pieces those three share.
// The gang's two other cars (the Renault is Nehorai's, with Erez and Ido in it; Yonati, Avraham and Muller in
// the second car, Dolev, Hadar and Liam in the third), the convoy that has them follow the Renault on the
// way it really drives (out of sight they catch up), a friend walking a route of waypoints through doorways
// (a watchdog puts him at the next one if he gets stuck), the lorry that comes head-on, a car of the Order
// that comes out of a side road to cut the Renault off, and lines that wait their turn behind the story's.
// The gang stays loyal throughout; every threat is the Black Order's. Invented, all of it.
import * as THREE from 'three';
import { Vehicle } from '../vehicle/vehicle.js';
import { Autopilot } from '../vehicle/autopilot.js';
import { makeHatchback } from '../world/car.js';
import { clamp, angleDiff } from '../core/math.js';
import { COLORS } from '../combat/paint.js';
import { TEAM } from './phoenix.js';

export const IN_RENAULT = ['erez', 'ido'];
export const CAR_CREWS = [['yonati', 'avraham', 'muller'], ['dolev', 'hadar', 'liam']];
export const CAR_NAMES = ['רכב שתיים', 'רכב שלוש'];
const CAR_COLORS = ['#7a1f24', '#24466e'];
const ORDER_COLORS = ['#121417', '#1c1f26', '#2a1416'];
export { ORDER_COLORS };

// a car taken out of the scene for good: its own meshes freed (the wheels' geometry is shared by every car)
function freeCar(game, v) {
  const keep = new Set((v.model.userData.wheels || []).map((w) => w.spin.geometry));
  v.model.removeFromParent();
  game.world.cols.dynamic.delete(v.box);
  v.model.traverse((o) => { if (o.isMesh) { if (!keep.has(o.geometry)) o.geometry.dispose(); o.material.dispose?.(); } });
  game.chaseCars = game.chaseCars.filter((c) => c !== v);
}

// ---------- the gang's two other cars ----------
const OWN = new WeakMap(); // game -> [car, car]
export function gangCars(game) {
  let cars = OWN.get(game);
  if (!cars) {
    cars = CAR_COLORS.map((color, k) => {
      const v = new Vehicle(game.world, makeHatchback({ color }), { name: `gang-${k + 2}`, maxSpeed: 33, accel: 8.2 });
      v.tune.armor = 0.35; // friends' cars take dents but never stop for good in a chase
      return v;
    });
    OWN.set(game, cars);
  }
  for (const v of cars) {
    if (!v.model.parent) game.scene.add(v.model);
    v.box.enabled = true;
    if (!game.chaseCars.includes(v)) game.chaseCars.push(v);
  }
  return cars;
}
export const hasGangCars = (game) => OWN.has(game);
// the cars gone for good: whoever is in them out, the meshes freed
export function dropGangCars(game) {
  const cars = OWN.get(game);
  if (!cars) return;
  for (const v of cars) {
    for (const id of [...v.occupants]) { const n = game.npcs.get(id); if (n && n.inCar === v) n.inCar = null; }
    v.occupants.clear();
    freeCar(game, v);
  }
  OWN.delete(game);
}
// each car at a spot { x, z, yaw, y? }
export function parkGangCars(game, spots) {
  gangCars(game).forEach((v, k) => { const s = spots[k]; v.repair(); v.place(s.x, s.z, s.yaw, s.y ?? null); });
}
export function carOf(game, id) {
  if (IN_RENAULT.includes(id)) return game.car;
  const k = CAR_CREWS.findIndex((c) => c.includes(id));
  return k < 0 ? null : gangCars(game)[k];
}
// everyone into his own car at once (a scene cut), Nehorai's two with him in the Renault
export function boardAll(game) {
  for (const id of TEAM) { const n = game.npc(id), car = carOf(game, id); if (n.inCar === car) continue; if (n.inCar) n.stepOut(); n.model.setPose(null); n.enter(car); }
}
// nobody of the gang left sitting in any car (a cut: they are put somewhere right after, or hidden)
export function unboardAll(game) {
  for (const id of TEAM) { const n = game.npc(id); if (!n.inCar) continue; n.inCar.occupants.delete(id); n.inCar = null; n.body.enabled = n.visible; }
}
// the door a friend gets in by: beside his own car (the side away from the driver for the Renault's two)
export function doorOf(game, id) {
  const car = carOf(game, id), crew = IN_RENAULT.includes(id) ? IN_RENAULT : CAR_CREWS.find((c) => c.includes(id));
  const i = crew.indexOf(id), side = IN_RENAULT.includes(id) ? -1 : (i % 2 ? -1 : 1), back = IN_RENAULT.includes(id) ? (i ? -0.9 : 0.4) : (i === 2 ? -1.0 : 0.3);
  return car.local(side * 1.7, back);
}

// on completion the scene is left for the next mission only when that is the one that carries straight on
// from here (a replay from the menu may be followed by a later mission, which stages its own)
export function handsTo(game, id) { const M = game.missions, n = M.next(); return n?.id === id && !!n.follows && M.ready(n); }

// the squad's own chatter is written for chapter seven (Erez leading, Nehorai the one to be rescued): with
// Nehorai leading here, its banter and its "Erez, take cover" when the leader is hit stay quiet (the story's
// own lines, and the call-outs for a guard spotted or marked, still play)
export function hush(game) { const c = game.squad?.cool; if (!c) return; c.banter = Math.min(c.banter, 0); c.hit = game.squad.t; }

// ---------- the markers, the Order's guards ----------
// everyone of the gang with his own marker, the squad or not (the six who wait at a gate too); markers a
// later mission took (a replay) come back first, so no stale stash outlives this
export function armGang(game, ids = TEAM) {
  const P = game.paint;
  P.unstash();
  P.armPlayer(COLORS.nehorai);
  for (const id of ids) { const n = game.npc(id); if (!n.visible && !n.inCar) continue; if (!P.allies.some((a) => a.npc === n)) P.addAlly(n, COLORS[id] || COLORS.ido); }
}
// guards of the Order who come in the middle of a step (a wave, a chase): posted where they stand, on the
// board, without the reset postGuards does (which would stand everyone marked so far back up)
export function reinforce(game, list) {
  const P = game.paint, out = [];
  for (const [id, at, { still = false, route = null } = {}] of list) {
    const n = game.npc(id), pts = route || [at];
    n.floorY = at.y ?? null; n.idle = null; n.posed = false; n.face = null; n.target = null; n.model.setPose(null);
    n.place(at.x, at.z, at.yaw ?? n.yaw, at.y ?? null); n.show(true);
    let gd = P.guards.find((g) => g.npc === n);
    if (gd) { P.revive(gd); P.setRoute(gd, pts.map((p) => ({ x: p.x, z: p.z })), { still }); }
    else gd = P.addGuard(n, pts.map((p) => ({ x: p.x, z: p.z })), undefined, { quick: true, still });
    out.push(gd);
  }
  return out;
}
// a guard who knows where Nehorai is: he comes for him (running while he has no sight of him), and shoots
export function hunt(game, gd, foe = null) {
  gd.alerted = true; gd.calledOut = true; gd.seen = 0.5; gd.cool = Math.max(gd.cool, 0.6);
  gd.foe = foe || { player: true, pos: game.player.pos, yaw: game.player.yaw };
  gd.npc.walkTo(gd.foe.pos.x, gd.foe.pos.z, { run: true, near: 4 });
}
// every frame of a chase: the hunters run instead of walk (the board walks them toward the last place they saw him)
export function hurryHunters(guards) { for (const gd of guards) if (!gd.marked && gd.alerted && gd.npc.target) gd.npc.target.run = true; }
// the Order's people put away: off the board, out of sight
export function dropGuards(game, ids) {
  for (const id of ids) { const n = game.npc(id); game.paint.removeGuard(n); n.target = null; n.idle = null; n.face = null; n.floorY = null; n.model.setPose(null); n.show(false); }
}

// ---------- lines that wait their turn: a story line plays at once, these only when nobody is talking ----------
export class Chatter {
  constructor(game) { this.game = game; this.queue = []; this.hold = 0; }
  add(lines, { radio = false } = {}) { this.queue.push({ lines, radio }); }
  clear() { this.queue = []; }
  update(dt) {
    const g = this.game;
    if (this.hold > 0) { this.hold -= dt; return; }
    if (!this.queue.length || g.dialogue.busy || g.cutscene) return;
    const { lines, radio } = this.queue.shift();
    if (radio) g.hud.toast(`קשר · ${lines[0][0]}`, 1400);
    g.dialogue.play(lines);
    this.hold = 0.6;
  }
}

// ---------- the convoy: the gang's cars follow the Renault on its own way ----------
// The Renault leaves a trail of points as it drives; each friend's car drives that trail with the game's
// autopilot, keeping a gap (closer when the Renault is slow, never into its back). One that is stuck, far
// behind or off the trail, while nobody can see it, is put back on the trail at its gap.
export class Convoy {
  constructor(game, cars, { gaps = [17, 34], behind = null } = {}) {
    this.game = game;
    this.trail = [];
    this.cum = [0];
    if (behind?.length) for (const p of behind) this.push(p.x, p.z);
    const c = game.car.pos; this.push(c.x, c.z);
    this.cars = cars.map((car, k) => ({ car, gap: gaps[k] ?? 17 * (k + 1), ap: new Autopilot(this.trail, { cruise: 18, stopAtEnd: true }), lost: 0 }));
    for (const f of this.cars) f.ap.i = this.indexNear(f.car.pos.x, f.car.pos.z, 0, this.trail.length);
  }
  push(x, z) { const n = this.trail.length; if (n) { const p = this.trail[n - 1]; this.cum.push(this.cum[n - 1] + Math.hypot(x - p.x, z - p.z)); } this.trail.push({ x, z }); }
  indexNear(x, z, from, to) { let best = from, bd = Infinity; for (let k = Math.max(0, from); k < Math.min(this.trail.length, to); k++) { const d = (this.trail[k].x - x) ** 2 + (this.trail[k].z - z) ** 2; if (d < bd) { bd = d; best = k; } } return best; }
  // the trail point `d` metres behind the Renault's latest one
  behindBy(d) { const n = this.trail.length, end = this.cum[n - 1]; let k = n - 1; while (k > 0 && end - this.cum[k] < d) k--; return Math.max(0, k); }
  seen(car) {
    const cam = this.game.camera, p = cam.position, dx = car.pos.x - p.x, dz = car.pos.z - p.z, d = Math.hypot(dx, dz);
    if (d > 140) return false;
    const dir = cam.getWorldDirection(TMP);
    return (dx * dir.x + dz * dir.z) / (d || 1) > 0.35 || d < 12;
  }
  place(f, k) {
    const T = this.trail, q = T[Math.min(T.length - 1, k + 1)], p = T[k];
    f.car.repair(); f.car.place(p.x, p.z, Math.atan2(q.x - p.x, q.z - p.z) || this.game.car.yaw); f.car.stuckTime = 0; f.ap.i = k; f.lost = 0;
  }
  update(dt) {
    const g = this.game, c = g.car.pos, T = this.trail, last = T[T.length - 1];
    if (Math.hypot(c.x - last.x, c.z - last.z) > 2.5) this.push(c.x, c.z);
    const n = T.length, end = this.cum[n - 1] + Math.hypot(c.x - T[n - 1].x, c.z - T[n - 1].z);
    for (const f of this.cars) {
      const car = f.car;
      const i = this.indexNear(car.pos.x, car.pos.z, f.ap.i - 3, f.ap.i + 40), off = Math.hypot(car.pos.x - T[i].x, car.pos.z - T[i].z);
      const along = end - this.cum[i];
      // a gap: speed toward the Renault's own when at it, quicker when behind, braking when too close
      const err = along - f.gap, rs = Math.max(0, g.car.speed);
      f.ap.cruise = clamp(rs + err * 0.55, 0, 32);
      const input = f.ap.drive(car);
      if (along < f.gap * 0.55) { input.throttle = 0; input.brake = Math.max(input.brake, 0.8); }
      car.update(dt, input);
      f.lost = (car.stuckTime > 2.2 || along > 150 || off > 14 || car.disabled) ? f.lost + dt : 0;
      if (f.lost > 1.2 && !this.seen(car)) this.place(f, this.behindBy(f.gap));
    }
  }
  // the cars put at their gaps at once (after a cut)
  snap() { for (const f of this.cars) this.place(f, this.behindBy(f.gap)); }
}
const TMP = new THREE.Vector3();

// is a point on the screen now (in front of the camera, not far): a friend out of it may be moved on unseen
export function inView(game, pos, far = 140) {
  const cam = game.camera, p = cam.position, dx = pos.x - p.x, dz = pos.z - p.z, d = Math.hypot(dx, dz);
  if (d > far) return false;
  const dir = cam.getWorldDirection(TMP);
  return (dx * dir.x + dz * dir.z) / (d || 1) > 0.35 || d < 12;
}

// ---------- a friend walking a route of waypoints (through doorways), with a watchdog ----------
// `hurry`: a long way (across a whole yard) — out of sight and well away from Nehorai he is moved on to the
// next point now and then, so he arrives in about the time a run in sight would take, never stuck behind
export class Walk {
  constructor(game, id, points, { run = false, near = 0.6, onDone = null, face = null, label = '', hurry = false } = {}) {
    this.game = game; this.id = id; this.points = points; this.k = 0; this.run = run; this.near = near; this.onDone = onDone; this.face = face; this.hurry = hurry;
    this.done = false; this.stuck = 0; this.best = Infinity; this.skip = 0;
    const n = game.npc(id);
    n.floorY = null; n.idle = null; n.model.setPose(null); n.target = null;
    if (game.squad.ids.includes(id)) game.squad.tasks.set(id, { ...points[points.length - 1], label });
  }
  update(dt) {
    if (this.done) return;
    const g = this.game, n = g.npc(this.id), p = this.points[this.k];
    if (n.inCar) return;
    const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
    if (d <= this.near + 0.15) { this.next(); return; }
    if (!n.target) n.walkTo(p.x, p.z, { run: this.run, near: this.near });
    if (d < this.best - 0.2) { this.best = d; this.stuck = 0; } else this.stuck += dt;
    if (this.stuck > 2.6) { n.target = null; n.place(p.x, p.z, n.yaw, p.y ?? null); this.next(); return; } // found another way round
    if (this.hurry && this.k < this.points.length - 1) {
      this.skip += dt;
      const me = g.player.pos;
      if (this.skip > 0.45 && !inView(g, n.pos) && !inView(g, p) && Math.hypot(n.pos.x - me.x, n.pos.z - me.z) > 22 && Math.hypot(p.x - me.x, p.z - me.z) > 22) { this.skip = 0; n.target = null; n.place(p.x, p.z, n.yaw, p.y ?? null); this.next(); }
    }
  }
  next() {
    const n = this.game.npc(this.id);
    this.k++; this.stuck = 0; this.best = Infinity; n.target = null;
    if (this.k < this.points.length) return;
    this.done = true;
    const f = this.face; if (f != null) n.lookAt(n.pos.x + Math.sin(f) * 3, n.pos.z + Math.cos(f) * 3);
    this.onDone?.(n);
  }
  cancel() { this.done = true; const n = this.game.npc(this.id); n.target = null; }
}

// ---------- the lorry that comes head-on in the gang's own lane ----------
let lorryWheel = null; // one wheel shape for every lorry (kept, like the cars' wheels)
function lorryModel() {
  const g = new THREE.Group(); g.name = 'order lorry';
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const body = new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.7 });
  const cab = new THREE.MeshStandardMaterial({ color: '#4a1517', roughness: 0.5, metalness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: '#22313d', roughness: 0.15, metalness: 0.5 });
  const headMat = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffe9b0', emissiveIntensity: 2.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: '#b3161c', emissive: '#3a0406' });
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.9 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  add(box(2.55, 3.0, 6.6), body, 0, 2.05, -1.6);
  add(box(2.5, 0.35, 9.4), body, 0, 0.75, -0.3);
  add(box(2.45, 2.4, 2.3), cab, 0, 1.75, 3.2);
  add(box(2.2, 0.95, 0.06), glass, 0, 2.3, 4.36);
  add(box(2.4, 0.45, 0.2), cab, 0, 0.8, 4.4);
  for (const sx of [-0.85, 0.85]) add(box(0.42, 0.24, 0.06), headMat, sx, 1.05, 4.38);
  for (const sx of [-1.0, 1.0]) add(box(0.3, 0.2, 0.06), tailMat, sx, 0.9, -4.92);
  const wheels = [];
  for (const z of [3.1, -2.4, -3.8]) for (const x of [-1.15, 1.15]) {
    lorryWheel ||= new THREE.CylinderGeometry(0.52, 0.52, 0.4, 14).rotateZ(Math.PI / 2);
    const pivot = new THREE.Group(), spin = new THREE.Mesh(lorryWheel, wheelMat);
    pivot.position.set(x, 0.52, z); pivot.add(spin); g.add(pivot); wheels.push({ pivot, spin, front: z > 0, x, z });
  }
  g.userData = { wheels, body, tailMat, headMat, halfExtents: { x: 1.3, z: 4.8 } };
  return g;
}
export class Truck {
  constructor(game, run, { speed = 12 } = {}) {
    this.game = game; this.run = run;
    this.car = new Vehicle(game.world, lorryModel(), { name: 'order-lorry', maxSpeed: speed + 2, accel: 4.5 });
    this.car.tune.armor = 0;
    this.car.box.hx = 1.3; this.car.box.hz = 4.8;
    game.scene.add(this.car.model);
    game.chaseCars.push(this.car);
    const s = run.start; this.car.place(s.x, s.z, s.yaw, s.y);
    this.ap = new Autopilot(run.path, { cruise: speed, stopAtEnd: true });
    this.honk = 0;
  }
  get pos() { return this.car.pos; }
  // the Renault inside the lorry's footprint (a little grown): a head-on crash
  hits(car) {
    const t = this.car, dx = car.pos.x - t.pos.x, dz = car.pos.z - t.pos.z, c = Math.cos(t.yaw), s = Math.sin(t.yaw);
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    return Math.abs(lx) < 1.3 + 1.05 && Math.abs(lz) < 4.8 + 2.1 && Math.abs(car.pos.y - t.pos.y) < 2.5;
  }
  update(dt) {
    this.car.update(dt, this.ap.drive(this.car));
    const d = Math.hypot(this.game.car.pos.x - this.car.pos.x, this.game.car.pos.z - this.car.pos.z);
    if ((this.honk -= dt) <= 0 && d < 160 && !this.ap.done) { this.honk = 1.4; this.game.sound?.beep?.(2, 196, 0.28); }
  }
  dispose() { freeCar(this.game, this.car); }
}

// ---------- a car of the Order out of a side road: it cuts in ahead of the Renault, then gives chase ----------
export class Rival {
  constructor(game, join, { color = ORDER_COLORS[0], cruise = 15 } = {}) {
    this.game = game; this.join = join;
    this.car = new Vehicle(game.world, makeHatchback({ color, plates: false }), { name: `order-${join.name}`, maxSpeed: 27, accel: 8 });
    this.car.tune.armor = 0.6;
    game.scene.add(this.car.model); game.chaseCars.push(this.car);
    this.car.place(join.x, join.z, join.yaw, join.y);
    this.ap = new Autopilot(join.path, { cruise, stopAtEnd: false });
    this.phase = 'wait'; this.t = 0; this.cutFor = 0; this.out = false;
  }
  go() { if (this.phase === 'wait') { this.phase = 'out'; this.t = 0; } }
  get pos() { return this.car.pos; }
  update(dt) {
    const g = this.game, me = g.car, c = this.car;
    this.t += dt;
    if (this.phase === 'wait' || this.phase === 'done') { if (Math.abs(c.speed) > 0.1) c.update(dt, { brake: 1 }); return; }
    const dx = me.pos.x - c.pos.x, dz = me.pos.z - c.pos.z, d = Math.hypot(dx, dz);
    const ahead = (dx * Math.sin(me.yaw) + dz * Math.cos(me.yaw)) < 0; // he is in front of the Renault
    if (this.phase === 'out') {
      c.update(dt, this.ap.drive(c));
      if ((d < 30 && this.ap.i > 8) || this.ap.i > this.ap.points.length * 0.45) this.phase = 'cut';
      if (c.disabled || this.t > 30) this.phase = 'done';
      return;
    }
    if (this.phase === 'cut') {
      // across the Renault's nose: a point just ahead of it, a little slower than it drives
      const lead = 7 + Math.max(0, me.speed) * 0.25, tx = me.pos.x + Math.sin(me.yaw) * lead, tz = me.pos.z + Math.cos(me.yaw) * lead;
      const err = angleDiff(c.yaw, Math.atan2(tx - c.pos.x, tz - c.pos.z));
      const want = ahead ? Math.max(6, me.speed - 3) : me.speed + 5;
      const dv = want - c.speed;
      c.update(dt, { steer: clamp(-err * 2.2, -1, 1), throttle: dv > 0 ? clamp(dv / 3, 0, 1) : 0, brake: dv < -1 ? clamp(-dv / 5, 0, 1) : 0 });
      this.cutFor += dt;
      // left behind, or he has tried long enough: he drops back and gives chase for a while
      if ((!ahead && d > 25) || this.cutFor > 12) { this.phase = 'chase'; this.t = 0; }
      if (c.disabled) this.phase = 'done';
      return;
    }
    // chase: at the Renault, like the rivals behind it, until he is lost or has had enough
    const err = angleDiff(c.yaw, Math.atan2(dx, dz));
    c.update(dt, { steer: clamp(-err * 2.2, -1, 1), throttle: Math.abs(err) > 0.7 && c.speed > 9 ? 0.2 : 1, brake: Math.abs(err) > 0.7 && c.speed > 12 ? 0.6 : 0 });
    if (d > 160 || this.t > 25 || c.disabled) { this.phase = 'done'; this.out = true; }
  }
  dispose() { freeCar(this.game, this.car); }
}
