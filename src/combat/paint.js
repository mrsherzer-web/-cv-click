// Paintball (chapter four): markers that shoot paint, by the rules the two crews have always played
// by. A pellet that lands leaves a splat; whoever is marked is out and sits down. No blood and no
// injuries, paint. Nehorai aims with the camera (the nearest guard in front of him is locked on), his
// friends with markers shoot at what they see, and the guards patrol, look around, call out and shoot
// back. Everything here is a game mechanic for an invented place; it shows nothing real.
import * as THREE from 'three';
import { makePaintGun, makeSplat } from './gunModel.js';
import { dampAngle, angleDiff } from '../core/math.js';
import { CollisionWorld } from '../world/colliders.js';

export const CLIP = 8;        // pellets in the hopper before a reload
export const RELOAD = 1.3;    // seconds to reload
export const RANGE = 18;      // how far a pellet flies true
export const OUT_AT = 3;      // marks that put Nehorai out
const SEE = 13, HALF = 0.72;  // a guard's range and half angle of view
export const COLORS = { nehorai: '#ff5c8a', ido: '#36c3ff', hadar: '#ffd23f', erez: '#ff9180', yonati: '#a8e07c', avraham: '#7cc8ff', muller: '#d6a8ff', dolev: '#f5d04a', liam: '#ff7a59', kai: '#ffd166', yahli: '#8ad4ff', guard: '#7bd88f' };

const up = new THREE.Vector3(0, 1, 0);

// a gun in someone's right hand, pointing down the forearm
function hold(model, color) {
  const gun = makePaintGun({ hopper: color });
  gun.position.copy(model.handR.offset);
  gun.rotation.set(Math.PI / 2 - 0.55, 0, 0);
  model.handR.bone.add(gun);
  return gun;
}

export class Paintball {
  constructor(game) {
    this.game = game;
    this.guards = [];
    this.allies = [];
    this.splats = [];
    this.tracers = [];
    this.player = null;      // { ammo, reloading, color, gun } while Nehorai carries a marker
    this.props = [];         // things to hit that are not people (chapter eight)
    this.hits = 0;           // marks on Nehorai
    this.shots = 0; this.landed = 0;
    this.lock = null;        // the guard Nehorai's marker is pointed at
    this.lockTimer = 0;
    this.onSpot = null;      // a guard just saw someone: (guard)
    this.onMarked = null;    // someone got marked: (who: 'player' | npc, by)
    this.onPlayerHit = null;
    this.boards = [];        // practice targets: { pos, hit(point) }
    // chapter five: a friend on overwatch (Muller on a roof). Nehorai marks the guard he is locked on;
    // if the overwatch can see that guard, a pellet comes from the post and the guard is out.
    this.overwatch = null;   // { npc, post: {x, y, z}, range, cool }
    this.onNoSight = null;   // a mark was asked for a guard the overwatch cannot see: (guard)
    this.onOverwatchHit = null; // the overwatch marked someone: (guard)
  }

  get armed() { return !!this.player; }
  get marked() { return this.guards.filter((g) => g.marked).length; }
  get standing() { return this.guards.filter((g) => !g.marked); }

  // ---------- who carries what ----------
  armPlayer(color = COLORS.nehorai) {
    if (this.player) return;
    const g = this.game;
    this.player = { ammo: CLIP, reloading: 0, color, gun: hold(g.nehorai, color) };
    this.hits = 0;
    g.hud.paintClear();
    g.hud.setAmmo(CLIP, CLIP, false);
  }

  disarmPlayer() {
    if (!this.player) return;
    this.player.gun.removeFromParent();
    this.player = null;
    this.lock = null;
    const g = this.game;
    g.follow.lockOn = null;
    g.hud.setGun(false); // the buttons go with the marker, this frame, not the next
    if (g.nehorai.pose === 'aim') g.nehorai.setPose(null);
  }

  addAlly(npc, color = COLORS[npc.id] || COLORS.ido) {
    if (this.allies.some((a) => a.npc === npc)) return;
    this.allies.push({ npc, color, gun: hold(npc.model, color), cool: 1 + Math.random(), marked: false, foe: null }); // foe: the guard he aims at now
  }

  // points: a patrol loop; the guard walks it, pausing to look around, and sees a cone in front of him
  // opts.quick: reacts faster (chapter five's guards); opts.still: stands at the post, turning in place
  addGuard(npc, points, color = COLORS.guard, { quick = false, still = false } = {}) {
    const geo = new THREE.CircleGeometry(SEE, 20, -Math.PI / 2 - HALF, HALF * 2).rotateX(-Math.PI / 2);
    const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.16, depthWrite: false }));
    cone.renderOrder = 2;
    this.game.scene.add(cone);
    npc.idle = null; npc.posed = false; npc.face = null; npc.target = null;
    npc.model.setPose(null);
    const g = { npc, points, k: 0, pause: 0, cone, color, gun: hold(npc.model, color), marked: false, alerted: false, seen: 0, cool: 0.8, foe: null, calledOut: false, quick, still, turn: 0 };
    this.guards.push(g);
    this.walk(g);
    return g;
  }

  // ---------- overwatch ----------
  setOverwatch(o) {
    this.overwatch = o ? { range: 70, cool: 0, ...o } : null;
    this.game.hud.setMark(!!o, false);
  }
  // can the overwatch post see the guard: a clear line from the post to the guard's chest
  overwatchSees(g) {
    const o = this.overwatch; if (!o) return false;
    const p = g.npc.pos, d = Math.hypot(p.x - o.post.x, p.z - o.post.z);
    if (d > o.range) return false;
    return this.clear(o.post.x, o.post.y + 1.2, o.post.z, p.x, p.y + 1.1, p.z, o.npc);
  }
  // mark the locked guard for the overwatch; true when the pellet came
  mark() {
    const o = this.overwatch, L = this.lock, g = this.game;
    if (!o || !L || !L.npc || L.marked || g.mode !== 'foot' || g.cutscene || o.cool > 0) return false;
    if (!this.overwatchSees(L)) { this.onNoSight?.(L); g.hud.pop('אין קו ראייה', 'miss'); return false; }
    o.cool = 1.1;
    const from = new THREE.Vector3(o.post.x, o.post.y + 1.3, o.post.z), to = new THREE.Vector3(L.npc.pos.x, L.npc.pos.y + 1.1, L.npc.pos.z);
    o.npc.lookAt(L.npc.pos.x, L.npc.pos.z); o.npc.model.setPose('aim');
    this.tracer(from, to, COLORS.muller || '#d6a8ff');
    this.splat({ point: to.clone(), normal: new THREE.Vector3(0, 0, 1) }, COLORS.muller || '#d6a8ff', from);
    this.markGuard(L, 'overwatch');
    g.sound?.splat?.();
    this.onOverwatchHit?.(L);
    return true;
  }

  walk(g) {
    if (g.still) { g.npc.target = null; g.pause = 1.5 + Math.random() * 2; return; }
    const p = g.points[g.k];
    g.npc.walkTo(p.x, p.z, { near: 0.5, onArrive: () => { g.k = (g.k + 1) % g.points.length; g.pause = 1.2 + Math.random() * 1.6; } });
  }

  // ---------- seeing ----------
  // can `from` (an Npc) see the point: within range, inside the cone, nothing solid in between
  sees(from, x, z, range = SEE, half = HALF) {
    const dx = x - from.pos.x, dz = z - from.pos.z, d = Math.hypot(dx, dz);
    if (d > range) return false;
    if (Math.abs(angleDiff(from.yaw, Math.atan2(dx, dz))) > half) return false;
    return this.clear(from.pos.x, from.pos.y + 1.3, from.pos.z, x, from.pos.y + 1.3, z, from);
  }

  // a straight line with nothing solid on it: exact, so a doorway lets it through and a thin wall does not
  // (people are soft and never block)
  clear(x0, y0, z0, x1, y1, z1, ignore) {
    return this.game.world.cols.raycast(x0, y0, z0, x1, y1, z1, ignore) === null;
  }

  // the people a guard may shoot at: Nehorai on foot, and friends with markers, none of them marked
  foes() {
    const g = this.game, out = [];
    if (g.mode === 'foot' && !g.cutscene && this.player) out.push({ player: true, pos: g.player.pos, yaw: g.player.yaw });
    for (const a of this.allies) if (!a.marked && a.npc.visible && !a.npc.inCar) out.push({ ally: a, pos: a.npc.pos, yaw: a.npc.yaw });
    return out;
  }

  // ---------- shooting ----------
  // a pellet from (x, y, z) toward a point: the first thing on the way takes the paint; returns what was hit
  pellet(from, to, shooter, { color, targets, spread = 0 }) {
    this.shots++;
    const dir = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
    const len = dir.length() || 1;
    dir.divideScalar(len);
    if (spread) { // a miss, by a little: the pellet goes wide
      const side = new THREE.Vector3().crossVectors(dir, up).normalize();
      dir.addScaledVector(side, (Math.random() - 0.5) * spread).addScaledVector(up, (Math.random() - 0.5) * spread * 0.6).normalize();
    }
    // the pellet flies its range in a straight line: the first thing on the way takes the paint, a body
    // (a cylinder round it) before the wall behind it, never through a wall
    const cols = this.game.world.cols, end = new THREE.Vector3().copy(from).addScaledVector(dir, RANGE);
    let t = cols.raycast(from.x, from.y, from.z, end.x, end.y, end.z, shooter), hit = t === null ? null : { wall: true };
    if (t === null) t = 1;
    for (const tg of targets) {
      const q = CollisionWorld.segmentCylinder(from.x, from.y, from.z, end.x, end.y, end.z, tg.pos.x, tg.pos.z, 0.42, tg.pos.y + 0.25, tg.pos.y + 1.85);
      if (q !== null && q < t) { t = q; hit = { target: tg }; }
    }
    // things to hit that are not people (a sensor, a lock, a lamp): the player's pellets count on them
    if (shooter === this.game.player) for (const pr of this.props) {
      if (pr.done) continue;
      const q = CollisionWorld.segmentCylinder(from.x, from.y, from.z, end.x, end.y, end.z, pr.x, pr.z, pr.r, pr.y - pr.r, pr.y + pr.r);
      if (q !== null && q < t) { t = q; hit = { prop: pr }; }
    }
    if (!hit) hit = {};
    hit.point = new THREE.Vector3().copy(from).addScaledVector(dir, RANGE * t);
    this.tracer(from, hit.point, color);
    if (hit.target || hit.wall || hit.prop) this.splat(hit, color, from);
    this.game.sound?.shot();
    return hit;
  }

  tracer(from, to, color) {
    const g = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    line.frustumCulled = false;
    this.game.scene.add(line);
    this.tracers.push({ line, t: 0.12 });
  }

  splat(hit, color, from) {
    const s = makeSplat(color);
    if (hit.target && !hit.target.board) {
      // on the body, where the pellet came from
      const tg = hit.target, model = tg.model, chest = model.bones.chest;
      const a = Math.atan2(from.x - tg.pos.x, from.z - tg.pos.z) - (tg.yaw ?? 0);
      s.position.set(Math.sin(a) * 0.19 + (Math.random() - 0.5) * 0.08, 0.28 + Math.random() * 0.2, Math.cos(a) * 0.19);
      s.rotation.y = a;
      chest.add(s);
    } else {
      s.position.copy(hit.point);
      s.lookAt(from);
      this.game.scene.add(s);
    }
    this.splats.push(s);
    if (this.splats.length > 60) { const old = this.splats.shift(); old.removeFromParent(); }
  }

  // Nehorai's marker: at the guard locked on, or straight ahead
  fire() {
    const p = this.player, g = this.game;
    if (!p || g.mode !== 'foot' || g.cutscene || g.hold) return false;
    if (p.reloading > 0) return false;
    if (p.ammo <= 0) { this.reload(); return false; }
    p.ammo--;
    g.hud.setAmmo(p.ammo, CLIP, false);
    const yaw = g.player.yaw, from = new THREE.Vector3(g.player.pos.x + Math.sin(yaw) * 0.45, g.player.pos.y + 1.32, g.player.pos.z + Math.cos(yaw) * 0.45);
    const L = this.lock;
    const lp = L ? (L.npc ? L.npc.pos : L.pos) : null;
    // a thing to hit (a sensor, a lock) in front of him, nearer than the guard he is locked on: that first
    let pr = null, pd = lp ? Math.hypot(lp.x - from.x, lp.z - from.z) : Infinity;
    for (const q of this.props) {
      if (q.done) continue;
      const dx = q.x - from.x, dz = q.z - from.z, d = Math.hypot(dx, dz);
      if (d > RANGE - 1 || d >= pd) continue;
      let a = Math.atan2(dx, dz) - yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > 0.5) continue;
      const back = Math.min(0.6, d * 0.5) / (d || 1), tx = q.x - dx * back, tz = q.z - dz * back; // a sensor sits on a body: the line need only reach its face
      if (!this.clear(from.x, from.y, from.z, tx, q.y, tz, g.player)) continue;
      pr = q; pd = d;
    }
    const to = pr ? new THREE.Vector3(pr.x, pr.y, pr.z) : lp ? new THREE.Vector3(lp.x, lp.y + 1.1, lp.z) : new THREE.Vector3(from.x + Math.sin(yaw) * 10, from.y - 0.4, from.z + Math.cos(yaw) * 10);
    const targets = [...this.standing.map((q) => ({ pos: q.npc.pos, yaw: q.npc.yaw, model: q.npc.model, guard: q })), ...this.boards.filter((b) => !b.done)];
    const hit = this.pellet(from, to, g.player, { color: p.color, targets });
    g.nehorai.play('nod', { speed: 3 }); // the recoil
    g.follow.shake(0.05);
    if (hit.target?.guard) this.markGuard(hit.target.guard, 'player');
    if (hit.target?.board) { hit.target.done = true; this.landed++; g.hud.pop('פגיעה!', 'counter'); g.sound?.splat(); hit.target.onHit?.(hit.point); }
    if (hit.prop) { const pr = hit.prop; pr.left--; this.landed++; g.hud.pop(pr.left > 0 ? `פגיעה! עוד ${pr.left}` : 'פגיעה!', 'counter'); g.sound?.splat(); if (pr.left <= 0) pr.done = true; pr.onHit?.(pr, hit.point); }
    if (p.ammo <= 0) this.reload();
    return true;
  }

  // something the player must hit (chapter eight: a sensor on the armoured car, a lock, a lamp):
  // a ball at (x, y, z) that takes `hits` pellets; onHit(prop, point) each time, prop.done at the end
  addProp({ x, y, z, r = 0.45, hits = 1, onHit = null, label = '' }) {
    const pr = { x, y, z, r, hits, left: hits, onHit, label, done: false, pos: { x, y, z } };
    this.props.push(pr);
    return pr;
  }
  removeProp(pr) { this.props = this.props.filter((p) => p !== pr); }
  clearProps() { this.props = []; }
  // a guard back on his feet (a new wave uses the same people)
  revive(gd) { gd.marked = false; gd.alerted = false; gd.seen = 0; gd.foe = null; gd.calledOut = false; gd.cone.visible = true; gd.gun.visible = true; gd.npc.model.setPose(null); gd.npc.body.enabled = gd.npc.visible && !gd.npc.inCar; gd.k = 0; gd.pause = 0; this.walk(gd); }
  // a guard posted somewhere new: a new round to walk
  setRoute(gd, points, { still = false, quick = null } = {}) { gd.points = points; gd.k = 0; gd.pause = 0; gd.still = still; if (quick !== null) gd.quick = quick; this.walk(gd); }
  // a guard taken off the board (his cone and marker go with him)
  removeGuard(npc) { const gd = this.guards.find((g) => g.npc === npc); if (!gd) return; gd.cone.removeFromParent(); gd.gun.removeFromParent?.(); this.guards = this.guards.filter((g) => g !== gd); }
  // a mark on Nehorai from something that is not a pellet (a blast he stood in after the warning)
  strike(label = 'הדף', color = '#ffb070') {
    const g = this.game;
    this.hits++;
    g.hud.paintHit(color, this.hits);
    g.hud.pop(label, 'hit');
    g.follow.shake(0.5);
    g.sound?.hit?.('crash', 0.6);
    return this.hits;
  }

  reload() {
    const p = this.player;
    if (!p || p.reloading > 0 || p.ammo === CLIP) return;
    p.reloading = RELOAD;
    this.game.hud.setAmmo(p.ammo, CLIP, true);
  }

  markGuard(g, by) {
    if (g.marked) return;
    g.marked = true;
    g.alerted = false;
    g.cone.visible = false;
    g.npc.target = null;
    g.npc.face = null;
    g.npc.model.setPose('down');
    g.npc.body.enabled = false; // sitting on the floor: nobody is blocked by him in a doorway
    g.gun.visible = false;
    this.landed++;
    this.game.hud.pop('מסומן!', 'counter');
    this.game.sound?.splat();
    this.onMarked?.(g, by);
  }

  markPlayer(by, color) {
    const g = this.game;
    this.hits++;
    g.hud.paintHit(color, this.hits);
    g.hud.hurt();
    g.follow.shake(0.18);
    g.sound?.splat();
    this.onPlayerHit?.(this.hits, by);
  }

  markAlly(a, by) {
    if (a.marked) return;
    a.marked = true;
    a.npc.target = null;
    a.npc.model.setPose('down');
    a.npc.body.enabled = false;
    a.gun.visible = false;
    this.game.hud.pop(`${a.npc.spec.name.split(' ')[0]} מסומן`, 'hit');
    this.game.sound?.splat();
    this.onMarked?.(a, by);
  }

  // ---------- each frame ----------
  update(dt) {
    const g = this.game;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      if ((t.t -= dt) <= 0) { g.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); this.tracers.splice(i, 1); }
      else t.line.material.opacity = Math.min(1, t.t / 0.08);
    }
    this.updatePlayer(dt);
    if (this.overwatch) {
      const o = this.overwatch; o.cool = Math.max(0, o.cool - dt);
      if (o.cool === 0 && o.npc.model.pose === 'aim') o.npc.model.setPose(null);
      const L = this.lock && this.lock.npc && !this.lock.marked ? this.lock : null;
      g.hud.setMark(true, !!L && this.overwatchSees(L));
    }
    const foes = this.foes();
    for (const gd of this.guards) this.updateGuard(gd, dt, foes);
    for (const a of this.allies) this.updateAlly(a, dt);
  }

  updatePlayer(dt) {
    const p = this.player, g = this.game;
    if (!p) return;
    if (p.reloading > 0 && (p.reloading -= dt) <= 0) { p.reloading = 0; p.ammo = CLIP; g.hud.setAmmo(CLIP, CLIP, false); }
    // the marker up whenever Nehorai is on foot and free; the nearest guard in front of him locked on
    const onFoot = g.mode === 'foot' && !g.cutscene;
    if (onFoot && g.nehorai.pose !== 'aim' && g.nehorai.pose !== 'carry') g.nehorai.setPose('aim');
    if (!onFoot) { this.lock = null; return; }
    const me = g.player.pos, camYaw = g.follow.yaw;
    let best = null, bd = Infinity;
    const aimAt = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw)); // the camera looks along -yaw
    const consider = (pos, item) => {
      const dx = pos.x - me.x, dz = pos.z - me.z, d = Math.hypot(dx, dz);
      if (d > RANGE) return;
      const a = Math.abs(angleDiff(aimAt, Math.atan2(dx, dz)));
      if (a > 1.1) return;
      if (!this.clear(me.x, me.y + 1.3, me.z, pos.x, pos.y + 1.1, pos.z, g.player)) return;
      const score = d + a * 3;
      if (score < bd) { bd = score; best = item; }
    };
    for (const gd of this.guards) if (!gd.marked) consider(gd.npc.pos, gd);
    for (const b of this.boards) if (!b.done) consider(b.pos, b);
    this.lock = best;
    g.follow.lockOn = best ? (best.npc ? best.npc.pos : best.pos) : null;
    g.hud.setCrosshair(best ? 'locked' : 'free');
  }

  updateGuard(gd, dt, foes) {
    const n = gd.npc;
    if (gd.marked) { gd.cone.visible = false; return; }
    if (!n.visible) return;
    gd.cool -= dt;
    // the nearest foe he can see
    let foe = null, bd = Infinity;
    for (const f of foes) {
      const d = Math.hypot(f.pos.x - n.pos.x, f.pos.z - n.pos.z);
      if (d < bd && this.sees(n, f.pos.x, f.pos.z, gd.alerted ? SEE + 4 : SEE, gd.alerted ? Math.PI : HALF)) { bd = d; foe = f; }
    }
    gd.seen = foe ? gd.seen + dt * (gd.quick ? 1.6 : 1) : Math.max(0, gd.seen - dt * 2);
    if (gd.still && !gd.alerted && !foe) { gd.turn -= dt; if (gd.turn <= 0) { gd.turn = 2.5 + Math.random() * 2.5; const a = gd.npc.yaw + (Math.random() - 0.5) * 1.6; gd.npc.lookAt(gd.npc.pos.x + Math.sin(a) * 5, gd.npc.pos.z + Math.cos(a) * 5); } }
    if (foe && gd.seen > (gd.quick ? 0.22 : 0.35) && !gd.alerted) {
      gd.alerted = true;
      n.target = null;
      if (!gd.calledOut) { gd.calledOut = true; this.onSpot?.(gd, foe); }
      // the guards near him look up too
      for (const o of this.guards) if (o !== gd && !o.marked && !o.alerted && Math.hypot(o.npc.pos.x - n.pos.x, o.npc.pos.z - n.pos.z) < 11) { o.seen = Math.max(o.seen, 0.3); o.npc.lookAt(foe.pos.x, foe.pos.z); }
    }
    if (gd.alerted) {
      gd.foe = foe || gd.foe;
      if (gd.foe) {
        n.target = null;
        n.yaw = dampAngle(n.yaw, Math.atan2(gd.foe.pos.x - n.pos.x, gd.foe.pos.z - n.pos.z), 6, dt);
        n.model.setPose('aim');
        const d = Math.hypot(gd.foe.pos.x - n.pos.x, gd.foe.pos.z - n.pos.z);
        // a few steps closer when the foe is far, a shot when he is in range; a post (a tower, a roof) is
        // never left: he turns and waits there (and on a floor, Npc keeps every step on it)
        if (!foe && d > 6 && !n.target && !gd.still) n.walkTo(gd.foe.pos.x, gd.foe.pos.z, { near: 4 });
        if (foe && gd.cool <= 0 && d < RANGE) {
          gd.cool = 1.05 + Math.random() * 0.5;
          const from = new THREE.Vector3(n.pos.x + Math.sin(n.yaw) * 0.45, n.pos.y + 1.32, n.pos.z + Math.cos(n.yaw) * 0.45);
          const to = new THREE.Vector3(foe.pos.x, foe.pos.y + 1.1, foe.pos.z);
          const chance = d < 7 ? 0.5 : d < 12 ? 0.32 : 0.18;
          const miss = Math.random() > chance;
          const targets = foes.map((f) => ({ pos: f.pos, yaw: f.yaw, model: f.player ? this.game.nehorai : f.ally.npc.model, who: f }));
          const hit = this.pellet(from, to, n, { color: gd.color, targets, spread: miss ? 0.35 + Math.random() * 0.3 : 0 });
          if (hit.target) { const w = hit.target.who; if (w.player) this.markPlayer(gd, gd.color); else this.markAlly(w.ally, gd); }
        }
      }
      if (!foe && gd.seen <= 0 && gd.cool < -6) { gd.alerted = false; gd.foe = null; n.model.setPose(null); this.walk(gd); } // lost him: back to the round
    } else {
      if (gd.pause > 0 && (gd.pause -= dt) <= 0) this.walk(gd);
      if (gd.pause > 0) n.yaw += Math.sin(this.game.time * 1.1 + gd.k) * dt * 0.9;
      if (n.model.pose === 'aim') n.model.setPose(null);
    }
    gd.cone.material.color.set(gd.alerted ? '#e2574c' : foe ? '#ff9a3c' : '#ffd23f');
    gd.cone.material.opacity = gd.alerted ? 0.26 : 0.16;
    gd.cone.position.set(n.pos.x, n.pos.y + 0.06, n.pos.z);
    gd.cone.rotation.y = n.yaw;
    gd.cone.scale.setScalar(gd.alerted ? (SEE + 4) / SEE : 1);
  }

  updateAlly(a, dt) {
    const n = a.npc, g = this.game;
    if (a.marked || !n.visible || n.inCar || g.cutscene) return;
    a.cool -= dt;
    // the squad's 'cover' order (chapter eight): he stays at his spot with his marker up and works the guards
    // who are on the leader, not on himself: quicker shots, and paint flying at a guard keeps his head down
    const sq = g.squad, cover = !!sq?.active && sq.mode === 'cover' && sq.ids.includes(n.id) && !sq.tasks.has(n.id), lead = g.player.pos;
    // a guard he can see, not marked, within range (covering: the one nearest the leader, the one shooting at him first)
    let foe = null, bd = Infinity;
    for (const gd of this.guards) {
      if (gd.marked) continue;
      const d = Math.hypot(gd.npc.pos.x - n.pos.x, gd.npc.pos.z - n.pos.z);
      const score = cover ? Math.hypot(gd.npc.pos.x - lead.x, gd.npc.pos.z - lead.z) - (gd.alerted && gd.foe?.player ? 8 : 0) : d;
      if (score < bd && d < RANGE - 2 && this.clear(n.pos.x, n.pos.y + 1.3, n.pos.z, gd.npc.pos.x, gd.npc.pos.y + 1.1, gd.npc.pos.z, n)) { bd = score; foe = gd; }
    }
    a.foe = foe;
    if (!foe) { if (cover && !n.target) n.model.setPose('aim'); else if (n.model.pose === 'aim') n.model.setPose(null); return; }
    if (cover && !n.target) n.lookAt(foe.npc.pos.x, foe.npc.pos.z); // turned to the guard he works, not the leader's way
    if (!n.target) n.yaw = dampAngle(n.yaw, Math.atan2(foe.npc.pos.x - n.pos.x, foe.npc.pos.z - n.pos.z), 6, dt);
    n.model.setPose('aim');
    if (a.cool > 0) return;
    a.cool = cover ? 0.8 + Math.random() * 0.4 : 1.5 + Math.random() * 0.8;
    const from = new THREE.Vector3(n.pos.x + Math.sin(n.yaw) * 0.45, n.pos.y + 1.32, n.pos.z + Math.cos(n.yaw) * 0.45);
    const to = new THREE.Vector3(foe.npc.pos.x, foe.npc.pos.y + 1.1, foe.npc.pos.z);
    const targets = this.standing.map((q) => ({ pos: q.npc.pos, yaw: q.npc.yaw, model: q.npc.model, guard: q }));
    const hit = this.pellet(from, to, n, { color: a.color, targets, spread: Math.random() < (cover ? 0.4 : 0.55) ? 0 : 0.4 });
    if (hit.target?.guard) this.markGuard(hit.target.guard, a);
    if (cover && !foe.marked) foe.cool = Math.max(foe.cool, 0.7 + Math.random() * 0.4); // pinned: no shot for a moment
  }

  // everyone back on their feet, the paint gone (a retry, or the end of the mission)
  reset() {
    for (const gd of this.guards) { gd.marked = false; gd.alerted = false; gd.seen = 0; gd.foe = null; gd.calledOut = false; gd.cone.visible = true; gd.gun.visible = true; gd.npc.model.setPose(null); gd.npc.body.enabled = gd.npc.visible && !gd.npc.inCar; gd.k = 0; gd.pause = 0; this.walk(gd); }
    for (const a of this.allies) { a.marked = false; a.gun.visible = true; a.npc.body.enabled = a.npc.visible && !a.npc.inCar; if (a.npc.model.pose === 'down') a.npc.model.setPose(null); }
    for (const s of this.splats) s.removeFromParent();
    this.splats = [];
    this.hits = 0;
    if (this.player) { this.player.ammo = CLIP; this.player.reloading = 0; this.game.hud.setAmmo(CLIP, CLIP, false); }
    this.game.hud.paintClear();
  }

  dispose() {
    const g = this.game;
    this.disarmPlayer();
    for (const gd of this.guards) { g.scene.remove(gd.cone); gd.cone.geometry.dispose(); gd.cone.material.dispose(); gd.gun.removeFromParent(); if (gd.npc.model.pose === 'down' || gd.npc.model.pose === 'aim') gd.npc.model.setPose(null); }
    for (const a of this.allies) { a.gun.removeFromParent(); if (a.npc.model.pose === 'down' || a.npc.model.pose === 'aim') a.npc.model.setPose(null); }
    if (this.overwatch) { if (this.overwatch.npc.model.pose === 'aim') this.overwatch.npc.model.setPose(null); this.setOverwatch(null); }
    for (const s of this.splats) s.removeFromParent();
    for (const t of this.tracers) { g.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); }
    this.guards = []; this.allies = []; this.splats = []; this.tracers = []; this.boards = [];
    this.hits = 0;
    g.hud.paintClear();
    g.hud.setCrosshair(null);
  }
}
