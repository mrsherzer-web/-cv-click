// Paintball (chapter four): markers that shoot paint, by the rules the two crews have always played
// by. A pellet that lands leaves a splat; whoever is marked is out and sits down. No blood and no
// injuries, paint. Nehorai aims with the camera (the nearest guard in front of him is locked on), his
// friends with markers shoot at what they see, and the guards patrol, look around, call out and shoot
// back. Everything here is a game mechanic for an invented place; it shows nothing real.
import * as THREE from 'three';
import { makePaintGun, makeSplat, GUN_LOOKS } from './gunModel.js';
import { dampAngle, angleDiff } from '../core/math.js';
import { CollisionWorld } from '../world/colliders.js';
import { Energy } from './energy.js';
import { slowmo } from './fight.js';

export const CLIP = 8;        // pellets in the hopper before a reload
export const RELOAD = 1.3;    // seconds to reload
export const RANGE = 18;      // how far a pellet flies true
export const OUT_AT = 3;      // marks that put Nehorai out
const SEE = 13, HALF = 0.72;  // a guard's range and half angle of view
const SHIELD_HALF = 0.9;      // a riot shield covers this much either side of where its bearer faces
export const COLORS = { nehorai: '#ff5c8a', ido: '#36c3ff', hadar: '#ffd23f', erez: '#ff9180', yonati: '#a8e07c', avraham: '#7cc8ff', muller: '#d6a8ff', dolev: '#f5d04a', liam: '#ff7a59', kai: '#ffd166', yahli: '#8ad4ff', guard: '#7bd88f' };

// Chapter ten: the kinds of marker on the rack. clip: pellets in the hopper; reload: seconds; range: how far
// a pellet flies true (and how far it locks on); cool: seconds between two pellets; auto: it keeps firing
// while the fire button is held; spread: how wide a pellet may go (0: where it is pointed); power: what a
// pellet counts for on things that take several (props, shields, a weak point, a heavy guard). 'balanced'
// is the marker of chapters four to nine, to the number, and what everyone has until a kind is chosen.
export const KINDS = {
  quick: { id: 'quick', name: 'מהיר', clip: 6, reload: 0.7, range: 14, cool: 0.1, auto: true, spread: 0.14, power: 1 },
  balanced: { id: 'balanced', name: 'מאוזן', clip: CLIP, reload: RELOAD, range: RANGE, cool: 0, auto: false, spread: 0, power: 1 },
  long: { id: 'long', name: 'ארוך ומדויק', clip: 5, reload: 1.6, range: 30, cool: 0.8, auto: false, spread: 0, power: 2 },
};
export const KIND_IDS = ['quick', 'balanced', 'long'];

const up = new THREE.Vector3(0, 1, 0);
// a stash that owes someone a marker (an empty record is no stash: after a reload it would read as none)
const owed = (s) => !!(s && (s.player || s.allies?.length || s.overwatch));

// a gun in someone's right hand, pointing down the forearm
function hold(model, color, kind = 'balanced') {
  const gun = makePaintGun({ hopper: color, kind });
  gun.position.copy(model.handR.offset);
  gun.rotation.set(Math.PI / 2 - 0.55, 0, 0);
  model.handR.bone.add(gun);
  return gun;
}

// a gun put down for good: out of the hand, its own geometry and hopper paint freed (the body and steel
// materials every marker shares stay; they are found once by building two markers and comparing)
let common = null;
function drop(gun) {
  if (!gun) return;
  if (!common) {
    const mats = (g) => { const out = []; g.traverse((o) => { if (o.isMesh) out.push(o.material); }); return out; };
    const a = makePaintGun(), b = makePaintGun(), mb = mats(b);
    common = new Set(mats(a).filter((m) => mb.includes(m)));
    drop(a); drop(b);
  }
  gun.removeFromParent();
  gun.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); if (!common.has(o.material)) o.material.dispose(); } });
}
// a splat cleaned off: each one has its own blobs and paint
function wipe(splat) {
  if (!splat) return;
  splat.removeFromParent();
  splat.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
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
    // chapter ten: things pellets land on that are neither guards nor props (an energy foe's body, its
    // shield, its weak point, its copies): see addTarget(). And the marker lying on the floor (drop())
    this.extra = [];
    this.fallen = null;
    this.onShield = null;    // a pellet stopped by a shield bearer's shield: (guard)
    // the energy kit (combat/energy.js) lives beside the markers: its attacks mark like a blast does and
    // its foes are things pellets land on. Nothing of it is built until a mission uses it
    this.energy = new Energy(game);
    game.energy ??= this.energy;
    game.slowmo ??= (scale, seconds) => slowmo(game, scale, seconds);
  }

  get armed() { return !!this.player; }
  // the kind of marker Nehorai carries (chapter ten's rack): kept in the progress, 'balanced' until chosen
  get kind() { const k = this.game.progress?.marker; return KINDS[k] ? k : 'balanced'; }
  // the marker lying on the floor after drop(): { x, y, z, kind, color, ammo } or null
  get dropped() { return this.fallen; }
  get marked() { return this.guards.filter((g) => g.marked).length; }
  get standing() { return this.guards.filter((g) => !g.marked); }
  // chapter nine: the gang's markers are taken away (see stash()); kept in the progress, so a reload knows
  get stashed() { return owed(this.game.progress?.stash); }
  // what is in the stash, a copy: { player: { color } | null, allies: [{ id, color }], overwatch } or null
  get stashContents() { const s = this.game.progress?.stash; return owed(s) ? JSON.parse(JSON.stringify(s)) : null; }

  // ---------- who carries what ----------
  // A marker handed to someone while the gang's are in the stash (a replay of an earlier mission from the
  // pause menu) leaves the stash as it is: it still owes him his own, and unstash() gives that back
  armPlayer(color = COLORS.nehorai, { kind = this.kind, ammo = null } = {}) {
    if (this.player) return;
    const g = this.game, K = KINDS[kind] || KINDS.balanced;
    this.takeFallen(); // a marker handed to him: the one on the floor is not a second one
    this.player = { ammo: ammo == null ? K.clip : Math.max(0, Math.min(K.clip, ammo)), reloading: 0, cool: 0, color, kind: K.id, clip: K.clip, gun: hold(g.nehorai, color, K.id) };
    this.hits = 0;
    g.hud.paintClear();
    g.hud.setAmmo(this.player.ammo, K.clip, false);
    this.showKind();
  }

  // the kind's Hebrew name on the HUD, once one has been chosen (before the rack the HUD is as it was)
  showKind() {
    const p = this.player, chosen = !!KINDS[this.game.progress?.marker];
    this.game.hud.setMarker?.(p && chosen ? KINDS[p.kind].name : null, p ? GUN_LOOKS[p.kind]?.accent : null);
  }

  // choose the kind of marker ('quick' | 'balanced' | 'long'): kept in the progress (a restore or a reload
  // has it), and the marker in his hand changes at once, with a full hopper of its own size
  setKind(kind) {
    const K = KINDS[kind], g = this.game; if (!K) return false;
    g.progress.marker = K.id;
    const p = this.player;
    if (p && p.kind !== K.id) {
      drop(p.gun);
      p.gun = hold(g.nehorai, p.color, K.id);
      p.kind = K.id; p.clip = K.clip; p.ammo = K.clip; p.reloading = 0; p.cool = 0;
      g.hud.setAmmo(p.ammo, p.clip, false);
    }
    this.showKind();
    g.save?.();
    return true;
  }

  // ---------- the marker on the floor (chapter ten) ----------
  // Nehorai's own marker out of his hand and on the floor at `at` ({ x, z, y? }; by default a step in front
  // of him): something to see and walk to, glowing a little in his colour. He is unarmed meanwhile: no fire
  // button, no firing, no reloading. It keeps its kind, colour and the paint left in it. Returns the record
  // (also paint.dropped), or what already lies there when he holds nothing
  drop(at = null) {
    const p = this.player, g = this.game;
    if (!p) return this.fallen;
    const me = g.player.pos, yaw = g.player.yaw;
    const x = at ? at.x : me.x + Math.sin(yaw) * 0.9, z = at ? at.z : me.z + Math.cos(yaw) * 0.9;
    const y = at?.y ?? g.world.groundHeight(x, z, me.y);
    const mesh = new THREE.Group();
    const gun = makePaintGun({ hopper: p.color, kind: p.kind });
    gun.rotation.set(0, 0, Math.PI / 2); gun.position.y = 0.035; // on its side
    const glow = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.46, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.6, depthWrite: false }));
    glow.position.y = 0.03; glow.renderOrder = 2;
    mesh.add(gun, glow);
    mesh.position.set(x, y, z);
    mesh.rotation.y = (at?.yaw ?? yaw + 1.1);
    g.scene.add(mesh);
    const rec = { x, y, z, pos: { x, y, z }, kind: p.kind, color: p.color, ammo: p.ammo, mesh, gun, glow };
    this.disarmPlayer();
    this.fallen = rec;
    return rec;
  }

  // is he close enough to take it (for the mission's prompt)
  nearDropped(r = 1.8) {
    const d = this.fallen, me = this.game.player.pos;
    return !!d && Math.hypot(d.x - me.x, d.z - me.z) <= r && Math.abs(d.y - me.y) < 2;
  }

  // the marker picked up again: the same kind, colour and paint as when it fell. True when he took it
  pickUp() {
    const d = this.fallen; if (!d) return false;
    if (this.player) this.disarmPlayer();
    const { color, kind, ammo } = d;
    this.takeFallen();
    this.armPlayer(color, { kind, ammo });
    return true;
  }

  // the marker on the floor taken away (picked up, stashed, or replaced by one handed to him)
  takeFallen() {
    const d = this.fallen; if (!d) return null;
    this.fallen = null;
    d.mesh.removeFromParent();
    drop(d.gun);
    d.glow.geometry.dispose(); d.glow.material.dispose();
    return d;
  }

  disarmPlayer() {
    if (!this.player) return;
    drop(this.player.gun);
    this.player = null;
    this.lock = null;
    const g = this.game;
    g.follow.lockOn = null;
    g.hud.setGun(false); // the buttons go with the marker, this frame, not the next
    g.hud.setMarker?.(null);
    if (g.nehorai.pose === 'aim') g.nehorai.setPose(null);
  }

  addAlly(npc, color = COLORS[npc.id] || COLORS.ido) {
    if (this.allies.some((a) => a.npc === npc)) return;
    this.allies.push({ npc, color, gun: hold(npc.model, color), cool: 1 + Math.random(), marked: false, foe: null }); // foe: the guard he aims at now
  }

  // a friend's marker taken from him (marked, he is back on his feet: he is out of the round)
  removeAlly(npc) {
    const a = this.allies.find((q) => q.npc === npc); if (!a) return;
    drop(a.gun);
    const n = a.npc;
    if (n.model.pose === 'aim' || n.model.pose === 'down') n.model.setPose(null);
    if (a.marked) n.body.enabled = n.visible && !n.inCar;
    this.allies = this.allies.filter((q) => q !== a);
  }

  // ---------- weapons taken and given back (chapter nine) ----------
  // Everyone's marker taken: remembers who carried what (the player's marker and its colour, each friend's
  // by npc id and colour, a friend on overwatch and his post) and disarms them all: no gun, no firing, no
  // reloading, the fire, reload and mark buttons gone (they show only with a marker in hand). The guards
  // keep theirs. The list is kept in progress.stash (and saved), so after a reload the gang is still unarmed
  // until unstash(). Called again while stashed it loses nothing: whoever was armed since is added and
  // disarmed. `player` (true, or a colour) and `allies` (ids, or { id, color }) name those whose markers
  // belong in the stash even if nobody holds one now: a setup or restore after the weapons are taken names
  // the gang, since the mission before may have put every marker down. With nobody armed and nobody named
  // nothing is owed, so nothing is kept and it returns null.
  stash({ player = false, allies = [] } = {}) {
    const g = this.game, pr = g.progress;
    const s = pr.stash || { player: null, allies: [], overwatch: null };
    const put = (id, color) => { if (id && !s.allies.some((a) => a.id === id)) s.allies.push({ id, color: color || COLORS[id] || COLORS.ido }); };
    if (!s.player && this.player) s.player = { color: this.player.color };
    if (!s.player && this.fallen) s.player = { color: this.fallen.color }; // the one on the floor is taken with the rest
    this.takeFallen();
    if (!s.player && player) s.player = { color: typeof player === 'string' ? player : COLORS.nehorai };
    for (const a of this.allies) put(a.npc.id, a.color);
    for (const q of allies) if (typeof q === 'string') put(q); else put(q?.id, q?.color);
    const o = this.overwatch;
    if (o && !s.overwatch) s.overwatch = { id: o.npc.id, post: { x: o.post.x, y: o.post.y, z: o.post.z }, range: o.range };
    this.disarmPlayer();
    for (const a of [...this.allies]) this.removeAlly(a.npc);
    if (o) { if (o.npc.model.pose === 'aim') o.npc.model.setPose(null); this.setOverwatch(null); }
    pr.stash = owed(s) ? s : null;
    g.hud.setGun(false);
    g.hud.setMark(false, false);
    g.save?.();
    return this.stashContents;
  }

  // The markers given back: each to his own owner in his own colour (the player, every friend who had one,
  // the overwatch at his post), and firing works again. `who` (an id or a list; 'player', or the id of the
  // one being played, for the player's) gives back only those and leaves the rest in the stash. Nothing
  // stashed: nothing happens (a retry may call it either way). True when something was given back.
  unstash(who = null) {
    const g = this.game, pr = g.progress, s = pr.stash;
    if (!owed(s)) return false;
    const list = who == null ? null : [].concat(who), want = (id) => !list || list.includes(id);
    const back = { player: null, allies: [], overwatch: null }, keep = { player: null, allies: [], overwatch: null };
    if (s.player) (want('player') || want(g.playingAs) ? back : keep).player = s.player;
    for (const a of s.allies || []) (want(a.id) ? back : keep).allies.push(a);
    if (s.overwatch) (want(s.overwatch.id) ? back : keep).overwatch = s.overwatch;
    pr.stash = keep.player || keep.allies.length || keep.overwatch ? keep : null;
    if (back.player) {
      if (this.player && this.player.color !== back.player.color) this.disarmPlayer();
      this.armPlayer(back.player.color);
    }
    for (const a of back.allies) {
      const n = g.npc(a.id), had = this.allies.find((q) => q.npc === n);
      if (had && had.color !== a.color) this.removeAlly(n);
      this.addAlly(n, a.color);
    }
    if (back.overwatch) { const w = back.overwatch; this.setOverwatch({ npc: g.npc(w.id), post: { ...w.post }, range: w.range }); }
    g.save?.();
    return !!(back.player || back.allies.length || back.overwatch);
  }

  // points: a patrol loop; the guard walks it, pausing to look around, and sees a cone in front of him
  // opts.quick: reacts faster (chapter five's guards); opts.still: stands at the post, turning in place
  // chapter ten's special people of the Order (by default as their spec says, see characters/extras.js):
  // shield: he carries a riot shield, a pellet from in front of him splashes on it (flank him: he turns slowly);
  // tough: the marks it takes to put him out (a heavy); rush: no marker, he sprints at whoever he saw and
  // shoves him over after a short wind-up (a mark on Nehorai, like a pellet), unless he is marked first
  addGuard(npc, points, color = COLORS.guard, { quick = false, still = false, shield = !!npc.spec.shield, tough = npc.spec.marks || 1, rush = !!npc.spec.rush } = {}) {
    const geo = new THREE.CircleGeometry(SEE, 20, -Math.PI / 2 - HALF, HALF * 2).rotateX(-Math.PI / 2);
    const cone = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.16, depthWrite: false }));
    cone.renderOrder = 2;
    this.game.scene.add(cone);
    npc.idle = null; npc.posed = false; npc.face = null; npc.target = null;
    npc.model.setPose(null);
    const g = { npc, points, k: 0, pause: 0, cone, color, gun: rush ? new THREE.Group() : hold(npc.model, color), marked: false, alerted: false, seen: 0, cool: 0.8, foe: null, calledOut: false, quick, still, turn: 0, shield, tough, toughMax: tough, rush, wind: 0, repath: 0, blocked: 0 };
    if (shield) npc.model.setShield?.(true);
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
  pellet(from, to, shooter, { color, targets, spread = 0, range = RANGE }) {
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
    const cols = this.game.world.cols, end = new THREE.Vector3().copy(from).addScaledVector(dir, range);
    let t = cols.raycast(from.x, from.y, from.z, end.x, end.y, end.z, shooter), hit = t === null ? null : { wall: true };
    if (t === null) t = 1;
    for (const tg of targets) {
      const q = CollisionWorld.segmentCylinder(from.x, from.y, from.z, end.x, end.y, end.z, tg.pos.x, tg.pos.z, tg.r ?? 0.42, tg.pos.y + (tg.lo ?? 0.25), tg.pos.y + (tg.hi ?? 1.85));
      if (q !== null && q < t) { t = q; hit = { target: tg }; }
    }
    // things to hit that are not people (a sensor, a lock, a lamp): the player's pellets count on them
    if (shooter === this.game.player) for (const pr of this.props) {
      if (pr.done) continue;
      const q = CollisionWorld.segmentCylinder(from.x, from.y, from.z, end.x, end.y, end.z, pr.x, pr.z, pr.r, pr.y - pr.r, pr.y + pr.r);
      if (q !== null && q < t) { t = q; hit = { prop: pr }; }
    }
    if (!hit) hit = {};
    hit.point = new THREE.Vector3().copy(from).addScaledVector(dir, range * t);
    this.tracer(from, hit.point, color);
    if ((hit.target && !hit.target.nosplat) || hit.wall || hit.prop) this.splat(hit, color, from);
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
    if (hit.target && !hit.target.board && hit.target.model) {
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
    if (this.splats.length > 60) { wipe(this.splats.shift()); }
  }

  // Nehorai's marker: at the guard locked on, or straight ahead
  fire() {
    const p = this.player, g = this.game;
    if (!p || g.mode !== 'foot' || g.cutscene || g.hold) return false;
    if (p.reloading > 0 || p.cool > 0) return false;
    if (p.ammo <= 0) { this.reload(); return false; }
    const K = KINDS[p.kind] || KINDS.balanced;
    p.ammo--;
    p.cool = K.cool;
    g.hud.setAmmo(p.ammo, p.clip, false);
    const yaw = g.player.yaw, from = new THREE.Vector3(g.player.pos.x + Math.sin(yaw) * 0.45, g.player.pos.y + 1.32, g.player.pos.z + Math.cos(yaw) * 0.45);
    const L = this.lock;
    const lp = L ? (L.npc ? L.npc.pos : L.pos) : null;
    // a thing to hit (a sensor, a lock) in front of him, nearer than the guard he is locked on: that first
    let pr = null, pd = lp ? Math.hypot(lp.x - from.x, lp.z - from.z) : Infinity;
    for (const q of this.props) {
      if (q.done) continue;
      const dx = q.x - from.x, dz = q.z - from.z, d = Math.hypot(dx, dz);
      if (d > K.range - 1 || d >= pd) continue;
      let a = Math.atan2(dx, dz) - yaw; a = Math.atan2(Math.sin(a), Math.cos(a));
      if (Math.abs(a) > 0.5) continue;
      const back = Math.min(0.6, d * 0.5) / (d || 1), tx = q.x - dx * back, tz = q.z - dz * back; // a sensor sits on a body: the line need only reach its face
      if (!this.clear(from.x, from.y, from.z, tx, q.y, tz, g.player)) continue;
      pr = q; pd = d;
    }
    const to = pr ? new THREE.Vector3(pr.x, pr.y, pr.z) : lp ? new THREE.Vector3(lp.x, lp.y + (L.aimY ?? 1.1), lp.z) : new THREE.Vector3(from.x + Math.sin(yaw) * 10, from.y - 0.4, from.z + Math.cos(yaw) * 10);
    const targets = [...this.standing.map((q) => ({ pos: q.npc.pos, yaw: q.npc.yaw, model: q.npc.model, guard: q })), ...this.boards.filter((b) => !b.done)];
    for (const t of this.extra) if (t.on) targets.push(t);
    const hit = this.pellet(from, to, g.player, { color: p.color, targets, spread: K.spread, range: K.range });
    g.nehorai.play('nod', { speed: 3 }); // the recoil
    g.follow.shake(0.05);
    if (hit.target?.guard) this.hitGuard(hit.target.guard, 'player', from, K.power);
    if (hit.target?.extra) { this.landed++; g.sound?.splat(); hit.target.onHit?.(hit.point, K.power, 'player'); }
    if (hit.target?.board) { hit.target.done = true; this.landed++; g.hud.pop('פגיעה!', 'counter'); g.sound?.splat(); hit.target.onHit?.(hit.point); }
    if (hit.prop) { const pr = hit.prop; pr.left = Math.max(0, pr.left - K.power); this.landed++; g.hud.pop(pr.left > 0 ? `פגיעה! עוד ${pr.left}` : 'פגיעה!', 'counter'); g.sound?.splat(); if (pr.left <= 0) pr.done = true; pr.onHit?.(pr, hit.point); }
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
  // chapter ten: something pellets land on that is neither a guard nor a prop (combat/energy.js makes them: a
  // foe's body or shield, its weak point, its copies): a cylinder of radius r round `pos` (a live { x, y, z }),
  // from lo to hi above it. on: false leaves it out; lock: the marker locks on to it as on a guard;
  // onHit(point, power, by) for each of the player's pellets on it (power: the marker kind's)
  addTarget({ pos, r = 0.5, lo = 0.2, hi = 1.9, lock = true, on = true, onHit = null }) {
    const t = { pos, r, lo, hi, lock, on, onHit, extra: true, nosplat: true, aimY: (lo + hi) / 2 };
    this.extra.push(t);
    return t;
  }
  removeTarget(t) { const i = this.extra.indexOf(t); if (i >= 0) this.extra.splice(i, 1); if (this.lock === t) this.lock = null; }
  // a guard back on his feet (a new wave uses the same people)
  revive(gd) { gd.tough = gd.toughMax; gd.wind = 0; gd.marked = false; gd.markedBy = null; gd.alerted = false; gd.seen = 0; gd.foe = null; gd.calledOut = false; gd.cone.visible = true; gd.gun.visible = true; gd.npc.model.setPose(null); gd.npc.body.enabled = gd.npc.visible && !gd.npc.inCar; gd.k = 0; gd.pause = 0; this.walk(gd); }
  // a guard posted somewhere new: a new round to walk
  setRoute(gd, points, { still = false, quick = null } = {}) { gd.points = points; gd.k = 0; gd.pause = 0; gd.still = still; if (quick !== null) gd.quick = quick; this.walk(gd); }
  // a guard taken off the board (his cone and marker go with him)
  removeGuard(npc) { const gd = this.guards.find((g) => g.npc === npc); if (!gd) return; gd.cone.removeFromParent(); gd.cone.geometry.dispose(); gd.cone.material.dispose(); drop(gd.gun); this.guards = this.guards.filter((g) => g !== gd); }
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
    if (!p || p.reloading > 0 || p.ammo >= p.clip) return;
    p.reloading = (KINDS[p.kind] || KINDS.balanced).reload;
    this.game.hud.setAmmo(p.ammo, p.clip, true);
  }

  // a pellet on a guard: a shield bearer's shield stops what comes from in front of him, a heavy takes
  // several (the 'long' marker's pellets count double); otherwise he is marked. True when he is out
  hitGuard(gd, by, from, power = 1) {
    if (gd.marked) return false;
    const g = this.game, n = gd.npc;
    if (gd.shield && Math.abs(angleDiff(n.yaw, Math.atan2(from.x - n.pos.x, from.z - n.pos.z))) < SHIELD_HALF) {
      gd.blocked++;
      gd.seen = Math.max(gd.seen, 0.4); // he knows where it came from
      if (by === 'player') g.hud.pop('המגן בולם · לאגף אותו', 'block');
      g.sound?.splat();
      this.onShield?.(gd, by);
      return false;
    }
    if (gd.tough > 1) {
      gd.tough -= power;
      if (gd.tough > 0) {
        n.model.flash(0.8);
        gd.seen = Math.max(gd.seen, 0.4);
        if (by === 'player') { this.landed++; g.hud.pop(`פגיעה! עוד ${Math.ceil(gd.tough)}`, 'counter'); }
        g.sound?.splat();
        return false;
      }
    }
    this.markGuard(gd, by);
    return true;
  }

  markGuard(g, by) {
    if (g.marked) return;
    g.marked = true; g.markedBy = by; // who (the player, a friend by id, a test): a mission can tell
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
    const d = this.fallen;
    if (d) { const k = 0.5 + 0.5 * Math.sin(g.time * 4); d.glow.material.opacity = 0.35 + 0.4 * k; d.glow.scale.setScalar(1 + 0.14 * k); }
    this.energy.update(dt);
  }

  updatePlayer(dt) {
    const p = this.player, g = this.game;
    if (!p) return;
    const K = KINDS[p.kind] || KINDS.balanced;
    if (p.cool > 0) p.cool -= dt;
    if (p.reloading > 0 && (p.reloading -= dt) <= 0) { p.reloading = 0; p.ammo = p.clip; g.hud.setAmmo(p.clip, p.clip, false); }
    // the marker up whenever Nehorai is on foot and free; the nearest guard in front of him locked on
    const onFoot = g.mode === 'foot' && !g.cutscene;
    if (onFoot && g.nehorai.pose !== 'aim' && g.nehorai.pose !== 'carry') g.nehorai.setPose('aim');
    if (!onFoot) { this.lock = null; return; }
    const me = g.player.pos, camYaw = g.follow.yaw;
    let best = null, bd = Infinity;
    const aimAt = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw)); // the camera looks along -yaw
    const consider = (pos, item) => {
      const dx = pos.x - me.x, dz = pos.z - me.z, d = Math.hypot(dx, dz);
      if (d > K.range) return;
      const a = Math.abs(angleDiff(aimAt, Math.atan2(dx, dz)));
      if (a > 1.1) return;
      if (!this.clear(me.x, me.y + 1.3, me.z, pos.x, pos.y + (item.aimY ?? 1.1), pos.z, g.player)) return;
      const score = d + a * 3;
      if (score < bd) { bd = score; best = item; }
    };
    for (const gd of this.guards) if (!gd.marked) consider(gd.npc.pos, gd);
    for (const b of this.boards) if (!b.done) consider(b.pos, b);
    for (const t of this.extra) if (t.on && t.lock) consider(t.pos, t);
    this.lock = best;
    g.follow.lockOn = best ? (best.npc ? best.npc.pos : best.pos) : null;
    g.hud.setCrosshair(best ? 'locked' : 'free');
    // a kind that keeps firing while the button is held (the 'quick' one)
    if (K.auto && p.cool <= 0 && p.reloading <= 0 && g.controls?.hold?.fire && !g.hold) this.fire();
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
      if (gd.foe?.ally?.marked) gd.foe = foe;
      if (gd.foe && gd.rush) this.rush(gd, dt);
      else if (gd.foe) {
        n.target = null;
        n.yaw = dampAngle(n.yaw, Math.atan2(gd.foe.pos.x - n.pos.x, gd.foe.pos.z - n.pos.z), gd.shield ? 1.2 : 6, dt); // behind a shield he turns slowly: he can be flanked
        n.model.setPose('aim');
        const d = Math.hypot(gd.foe.pos.x - n.pos.x, gd.foe.pos.z - n.pos.z);
        // a few steps closer when the foe is far, a shot when he is in range; a post (a tower, a roof) is
        // never left: he turns and waits there (and on a floor, Npc keeps every step on it)
        if (!foe && d > 6 && !n.target && !gd.still) n.walkTo(gd.foe.pos.x, gd.foe.pos.z, { near: 4 });
        if (foe && gd.cool <= 0 && d < RANGE) {
          gd.cool = (1.05 + Math.random() * 0.5) * (gd.toughMax > 1 ? 1.6 : 1); // a heavy is slow with his marker too
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

  // a runner who has seen someone: he sprints at him, winds up for a moment within arm's reach (the
  // warning: step away, or mark him) and shoves. Nehorai shoved takes a mark and a step back; a friend sits down
  rush(gd, dt) {
    const n = gd.npc, f = gd.foe, g = this.game;
    const dx = f.pos.x - n.pos.x, dz = f.pos.z - n.pos.z, d = Math.hypot(dx, dz) || 1;
    if (gd.wind > 0) {
      n.target = null;
      n.yaw = dampAngle(n.yaw, Math.atan2(dx, dz), 8, dt);
      if ((gd.wind -= dt) <= 0) {
        gd.wind = 0; gd.cool = 1.6;
        n.model.play('shove');
        if (d < 1.9) {
          if (f.player) { this.strike('נדחפת!', gd.color); g.player.push?.((dx / d) * 1.4, (dz / d) * 1.4); this.onPlayerHit?.(this.hits, gd); }
          else if (f.ally) this.markAlly(f.ally, gd);
        }
      }
      return;
    }
    if (d < 1.5 && gd.cool <= 0) { gd.wind = 0.6; n.target = null; n.model.play('windup', { speed: 1 }); return; }
    if ((gd.repath -= dt) <= 0 && d >= 1.4) { gd.repath = 0.35; n.walkTo(f.pos.x, f.pos.z, { near: 1.2, run: true }); }
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
    if (hit.target?.guard) this.hitGuard(hit.target.guard, a, from);
    if (cover && !foe.marked) foe.cool = Math.max(foe.cool, 0.7 + Math.random() * 0.4); // pinned: no shot for a moment
  }

  // everyone back on their feet, the paint gone (a retry, or the end of the mission)
  reset() {
    for (const gd of this.guards) { gd.tough = gd.toughMax; gd.wind = 0; gd.marked = false; gd.markedBy = null; gd.alerted = false; gd.seen = 0; gd.foe = null; gd.calledOut = false; gd.cone.visible = true; gd.gun.visible = true; gd.npc.model.setPose(null); gd.npc.body.enabled = gd.npc.visible && !gd.npc.inCar; gd.k = 0; gd.pause = 0; this.walk(gd); }
    for (const a of this.allies) { a.marked = false; a.gun.visible = true; a.npc.body.enabled = a.npc.visible && !a.npc.inCar; if (a.npc.model.pose === 'down') a.npc.model.setPose(null); }
    for (const s of this.splats) wipe(s);
    this.splats = [];
    this.hits = 0;
    if (this.player) { const p = this.player; p.ammo = p.clip; p.reloading = 0; p.cool = 0; this.game.hud.setAmmo(p.clip, p.clip, false); }
    this.game.hud.paintClear();
  }

  // everything of this round put away. The stash (progress.stash) is not touched: markers taken in chapter
  // nine stay taken until unstash(), whatever ends in between
  dispose() {
    const g = this.game;
    this.disarmPlayer();
    this.takeFallen(); // a marker left on the floor goes with the round
    for (const gd of this.guards) { g.scene.remove(gd.cone); gd.cone.geometry.dispose(); gd.cone.material.dispose(); drop(gd.gun); if (gd.npc.model.pose === 'down' || gd.npc.model.pose === 'aim') gd.npc.model.setPose(null); }
    for (const a of this.allies) { drop(a.gun); if (a.npc.model.pose === 'down' || a.npc.model.pose === 'aim') a.npc.model.setPose(null); }
    if (this.overwatch) { if (this.overwatch.npc.model.pose === 'aim') this.overwatch.npc.model.setPose(null); this.setOverwatch(null); }
    for (const s of this.splats) wipe(s);
    for (const t of this.tracers) { g.scene.remove(t.line); t.line.geometry.dispose(); t.line.material.dispose(); }
    this.guards = []; this.allies = []; this.splats = []; this.tracers = []; this.boards = [];
    this.hits = 0;
    g.hud.paintClear();
    g.hud.setCrosshair(null);
  }
}
