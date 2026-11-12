// Chapter ten's moves (docs/chapter10.md, engine piece 2), made and disposed by the missions:
//   helpUp     a friend kneels by Nehorai on the floor, gets an arm under his shoulder, and both rise
//   Leap       over a gap, in an arc; a far side that comes and goes makes it a matter of timing
//   Climb      up a ledge (and down again)
//   giveHand   Nehorai on top pulls a friend up after him
//   the reality-path kit: PhasePlatform (a slab that is there and not there on a rhythm), StasisField (time
//   stops inside it for a few seconds), Disturbance (a drifting ball of energy: a knock back and one mark),
//   Switch, and riftGuard (whoever falls into the rift is back on the last firm stone: never a fail)
//   Kit        a bag for a mission's moves: one update, one interaction, one dispose
// Crawling itself is the controller's (game.player.crawl); a marker dropped and picked up is paint's.
// Each prompt goes through a step's interaction(); update(dt) is called once a frame (a second call in the
// same frame does nothing). Whatever holds a body (a leap in the air, a friend frozen) also drives itself to
// its end, so a step that changes in the middle can never leave anyone hanging. Nothing here is saved.
import * as THREE from 'three';
import { POSES } from '../characters/poses.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (k) => k * k * (3 - 2 * k);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pt = (p) => (typeof p === 'function' ? p() : p);
const turn = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const FADE = '#150c26';      // the short fade when someone is put back (a deep violet, the rift's colour)
const once = (self) => { const t = self.game.time; if (self.stamp === t) return false; self.stamp = t; return true; };

// ---------- poses laid by hand ----------
// A scripted move lays the whole body into a pose from poses.js after the body's own animation ran this
// frame, and blends from one pose to the next itself (the builder cannot cross-fade two held poses).
const KEYS = ['hips.y', 'chest.rx', 'chest.ry', 'chest.rz', 'head.rx', 'head.ry', 'head.rz', 'shL.rx', 'shL.rz', 'elL.rx', 'shR.rx', 'shR.rz', 'elR.rx',
  'hipL.rx', 'hipL.rz', 'kneeL.rx', 'ankL.rx', 'hipR.rx', 'hipR.rz', 'kneeR.rx', 'ankR.rx'];
const N = KEYS.length;
const JOINT = KEYS.map((k) => k.split('.')[0]), AXIS = KEYS.map((k) => (k === 'hips.y' ? null : k.split('.')[1][1]));
const REST = KEYS.map((k) => ({ 'elL.rx': -0.08, 'elR.rx': -0.08, 'shL.rz': 0.06, 'shR.rz': -0.06, 'kneeL.rx': 0.04, 'kneeR.rx': 0.04 }[k] ?? 0)); // standing
const MIRROR = KEYS.map((k) => KEYS.indexOf(k.replace(/(L|R)\./, (m, s) => `${s === 'L' ? 'R' : 'L'}.`)));
const FLIP = KEYS.map((k) => (/\.r[yz]$/.test(k) ? -1 : 1));
const tables = new Map();
// a pose as a full row of channels: what it leaves out stands at rest; mirrored, left and right change places
function table(name, mirror) {
  const key = mirror ? `${name}|m` : name;
  let t = tables.get(key);
  if (!t) {
    const p = name ? POSES[name] : null;
    t = new Float32Array(N);
    for (let i = 0; i < N; i++) { const j = mirror ? MIRROR[i] : i; t[i] = (p && KEYS[j] in p ? p[KEYS[j]] : REST[j]) * (mirror ? FLIP[i] : 1); }
    tables.set(key, t);
  }
  return t;
}
// the body between pose `a` and pose `b` (k 0..1; null is plain standing), at weight w over whatever it was doing
export function layPose(model, a, b = a, k = 0, w = 1, mirror = false) {
  const A = table(a, mirror), B = table(b, mirror), J = model.bones;
  for (let i = 0; i < N; i++) {
    const v = A[i] + (B[i] - A[i]) * k;
    if (AXIS[i] === null) { const o = J.hips.position; o.y += (0.96 + v - o.y) * w; } else { const r = J[JOINT[i]].rotation; r[AXIS[i]] += (v - r[AXIS[i]]) * w; }
  }
}
// the body as it stands now, kept (a statue while time is stopped) and put back
function keepBody(model, into) { const J = model.bones; for (let i = 0; i < N; i++) into[i] = AXIS[i] === null ? J.hips.position.y : J[JOINT[i]].rotation[AXIS[i]]; }
function putBody(model, from) { const J = model.bones; for (let i = 0; i < N; i++) { if (AXIS[i] === null) J.hips.position.y = from[i]; else J[JOINT[i]].rotation[AXIS[i]] = from[i]; } }

// ---------- bodies ----------
// `who` is a friend (an Npc) or null for the player
const modelOf = (game, who) => (who ? who.model : game.player.model);
const posOf = (game, who) => (who ? who.pos : game.player.pos);
function put(game, who, x, y, z, yaw) {
  if (who) { who.pos.x = who.lastX = x; who.pos.y = y; who.pos.z = who.lastZ = z; who.yaw = yaw; who.target = null; who.sync(); return; }
  const P = game.player;
  P.pos.x = x; P.pos.y = P.visualY = y; P.pos.z = z; P.yaw = yaw; P.sync();
}
// a friend kept out of the squad's hands for a moment (it would walk him back into the formation)
function holdNpc(game, n, label = '') {
  const S = game.squad;
  n.target = null;
  if (S?.active && S.ids.includes(n.id) && !S.tasks.has(n.id)) { S.tasks.set(n.id, { x: n.pos.x, z: n.pos.z, label }); S.refresh(true); return true; }
  return false;
}
function freeNpc(game, n, held) { if (held && game.squad?.tasks.has(n.id)) game.squad.release(n.id); }
const usable = (n) => !!n && n.visible && !n.inCar;
const floorY = (game, p, yRef) => p.y ?? game.world.groundHeight(p.x, p.z, yRef);

// ---------- whatever holds a body drives itself ----------
const runners = new WeakMap();
function drive(game, seq) {
  let r = runners.get(game);
  if (!r) {
    r = { list: [], update(dt) { for (let i = this.list.length - 1; i >= 0; i--) { const s = this.list[i]; s.update(dt); if (!s.holding) this.list.splice(i, 1); } } };
    runners.set(game, r);
    game.activities.push(r);
  }
  if (!r.list.includes(seq)) r.list.push(seq);
}
function undrive(game, seq) { const r = runners.get(game), i = r ? r.list.indexOf(seq) : -1; if (i >= 0) r.list.splice(i, 1); }

// ---------- shared shapes (one geometry for every platform, field and ball; gone with the last user) ----------
const shapes = new Map();
function shape(key, make) { let s = shapes.get(key); if (!s) shapes.set(key, (s = { geo: make(), n: 0 })); s.n++; return s.geo; }
function unshape(key) { const s = shapes.get(key); if (s && --s.n <= 0) { s.geo.dispose(); shapes.delete(key); } }
const live = { platforms: new Set(), disturbances: new Set(), fields: new Set() };

// ---------- the pieces of a leap and a climb, for the player and for a friend alike ----------
const WIND = 0.16, LAND = 0.22, MISS = 0.34;
// through the air from st.s to st.e over st.T seconds, st.H high in the middle: gathered, tucked, gathered again
function hop(game, who, st, dt) {
  st.t += dt;
  const k = clamp01(st.t / st.T), s = st.s, e = st.e, M = modelOf(game, who);
  put(game, who, s.x + (e.x - s.x) * k, s.y + (e.y - s.y) * k + st.H * 4 * k * (1 - k), s.z + (e.z - s.z) * k, st.yaw);
  if (k < 0.3) layPose(M, 'crouch', 'tuck', ease(k / 0.3)); else if (k < 0.72) layPose(M, 'tuck'); else layPose(M, 'tuck', 'crouch', ease((k - 0.72) / 0.28));
  return k >= 1;
}
// up a ledge: the hands to its edge (st.T[0]), the body pulled up to it (st.T[1]), over it and onto the top
// (st.T[2]). st.s where he began, st.b the foot of the ledge, st.p the spot on top
function haul(game, who, st, dt) {
  st.t += dt;
  const t = st.t, [t1, t2, t3] = st.T, s = st.s, b = st.b, p = st.p, M = modelOf(game, who), mid = Math.max(b.y, p.y - 0.75);
  if (t < t1) { const k = ease(t / t1); put(game, who, s.x + (b.x - s.x) * k, b.y, s.z + (b.z - s.z) * k, turn(st.yaw0, st.yaw, k)); layPose(M, null, 'hang', k); return false; }
  if (t < t1 + t2) { const k = ease((t - t1) / t2); put(game, who, b.x, b.y + (mid - b.y) * k, b.z, st.yaw); layPose(M, 'hang', 'mantle', clamp01(k * 1.8 - 0.8)); return false; }
  const k = clamp01((t - t1 - t2) / t3), kk = ease(clamp01((k - 0.15) / 0.85));
  put(game, who, b.x + (p.x - b.x) * kk, mid + (p.y - mid) * ease(Math.min(1, k / 0.5)), b.z + (p.z - b.z) * kk, st.yaw);
  if (k < 0.55) layPose(M, 'mantle', 'crouch', ease(k / 0.55)); else layPose(M, 'crouch', null, ease((k - 0.55) / 0.45));
  return k >= 1;
}
const landed = (game, e) => { game.fx?.dust?.(e.x, e.y, e.z, 0.4); game.follow?.shake?.(0.07); game.sound?.hit?.('block', 0.35); };
// down from a jump at st.e: out of the crouch and standing
function settle(game, who, st, dt) {
  st.t += dt;
  const k = clamp01(st.t / LAND);
  put(game, who, st.e.x, st.e.y, st.e.z, st.yaw);
  layPose(modelOf(game, who), 'crouch', null, ease(k));
  return k >= 1;
}
// off a ledge: a step out over its edge (from st.s to over st.e), then straight down to its foot
function drop(game, who, st, dt) {
  st.t += dt;
  const t = st.t, t1 = 0.26, s = st.s, e = st.e, M = modelOf(game, who);
  if (t < t1) { const k = ease(t / t1); put(game, who, s.x + (e.x - s.x) * k, s.y, s.z + (e.z - s.z) * k, turn(st.yaw0, st.yaw, k)); layPose(M, null, 'tuck', k); return false; }
  const k = clamp01((t - t1) / st.T);
  put(game, who, e.x, s.y + (e.y - s.y) * k * k, e.z, st.yaw);
  layPose(M, 'tuck', 'crouch', k * k);
  return k >= 1;
}
// a friend's whole move: through the air (`air`: hop or drop), then the landing; true when he stands
function airThenLand(air, game, who, st, dt) {
  if (!st.down) { if (air(game, who, st, dt)) { st.down = true; st.t = 0; landed(game, st.e); } return false; }
  return settle(game, who, st, dt);
}
// where friend i ends up beside `e` (a step to one side, then the other), unless the mission gave him a spot
function beside(e, yaw, i, spots) {
  if (spots?.[i]) return spots[i];
  const side = (i % 2 ? 1 : -1) * 0.6 * (1 + Math.floor(i / 2));
  return { x: e.x + Math.cos(yaw) * side, y: e.y, z: e.z - Math.sin(yaw) * side };
}

// Friends crossing after the player by themselves, one after the other: each runs to the start, waits for his
// moment, and makes the same move. `begin(job)` readies a job's move, `step(job, dt)` returns true when it is done
class Followers {
  constructor(game, list, spots) { this.game = game; this.list = list || []; this.spots = spots; this.jobs = []; }
  get busy() { return this.jobs.length > 0; }
  // held where they are while the player is in the air
  hold(label) { for (const n of this.list) if (usable(n) && !this.jobs.some((j) => j.n === n)) this.jobs.push({ n, state: 'hold', t: 0, i: this.jobs.length, held: holdNpc(this.game, n, label), st: { t: 0, s: { x: 0, y: 0, z: 0 }, e: null, b: null, p: null, T: 0, H: 0, yaw: 0, yaw0: 0 } }); }
  // the player made it: they come after him, half a second apart, from `a` (to `to(i)`, by `move`)
  go(a, yaw, ready, begin, step) { this.a = a; this.yaw = yaw; this.ready = ready; this.begin = begin; this.step = step; this.jobs.forEach((j, i) => { j.state = 'wait'; j.t = -(0.45 + 0.5 * i); }); }
  // the player did not: they stay
  drop() { for (const j of this.jobs) freeNpc(this.game, j.n, j.held); this.jobs.length = 0; }
  update(dt) {
    const g = this.game, a = this.a;
    for (let q = this.jobs.length - 1; q >= 0; q--) {
      const j = this.jobs[q], n = j.n;
      if (!usable(n)) { freeNpc(g, n, j.held); this.jobs.splice(q, 1); continue; }
      if (j.state === 'hold') { n.target = null; continue; }
      j.t += dt;
      if (j.state === 'wait') { n.target = null; if (j.t >= 0) { j.state = 'come'; j.t = 0; n.walkTo(a.x, a.z, { run: true, near: 0.45 }); } continue; }
      if (j.state === 'come') {
        const d = dist(n.pos, a);
        if (d < 0.6 || j.t > 2.4 || !n.target) { if (d >= 0.6) n.place(a.x, a.z, this.yaw, a.y); n.target = null; j.state = 'ready'; j.t = 0; }
        continue;
      }
      if (j.state === 'ready') { // a far side that comes and goes: he leaves when it will hold him (and never waits for ever)
        n.target = null; n.yaw = turn(n.yaw, this.yaw, 1 - Math.exp(-10 * dt)); n.sync();
        if (this.ready() || j.t > 12) { j.state = 'move'; j.st.t = 0; j.st.s.x = n.pos.x; j.st.s.y = n.pos.y; j.st.s.z = n.pos.z; j.st.yaw0 = n.yaw; this.begin(j); }
        continue;
      }
      if (this.step(j, dt)) { const e = j.st.e || j.st.p; put(g, n, e.x, e.y, e.z, j.st.yaw); freeNpc(g, n, j.held); this.jobs.splice(q, 1); }
    }
  }
}

// A gap to leap. `from`: the near edge; `to`: where he lands (a point, or a function for a far side that
// moves); both { x, z, y } (give y: the floor of each side). The prompt shows within `near` metres of `from`.
// `arc`: how high in the middle (m); `seconds`: in the air. Timing: `onto` (a PhasePlatform) or `ready()`
// must hold when he comes down, else it is a miss: a moment of falling, a short fade, and he is back at the
// edge he jumped from (onMiss(n)); never a fail. `twoWay`: the same leap offered from the far side back.
// `friendsFollow`: friends who make the same leap by themselves a moment after he lands (friendSpots[i]: where
// each comes down; else beside `to`). onStart(), onLand(), enabled, leaps, misses, active.
export class Leap {
  constructor(game, { from, to, label = 'לקפוץ', near = 1.6, arc = null, seconds = null, ready = null, onto = null, twoWay = false, backLabel = null,
    friendsFollow = [], friendSpots = null, onStart = null, onLand = null, onMiss = null, priority = 6 }) {
    Object.assign(this, { game, from, to, label, near, arc, seconds, ready, onto, twoWay, backLabel: backLabel ?? label, onStart, onLand, onMiss, priority });
    this.state = 'idle'; this.enabled = true; this.back = false; this.leaps = 0; this.misses = 0;
    this.st = { t: 0, s: { x: 0, y: 0, z: 0 }, e: { x: 0, y: 0, z: 0 }, T: 0.6, H: 1, yaw: 0 };
    this.edge = { x: 0, y: 0, z: 0, yaw: 0 };
    this.friends = new Followers(game, friendsFollow, friendSpots);
  }
  get active() { return this.state !== 'idle'; }
  get holding() { return this.state !== 'idle' || this.friends.busy; }
  // is the far side there to land on (for a hint on the screen)
  get open() { return (!this.ready || !!this.ready()) && (!this.onto || this.onto.solid); }

  interaction(game = this.game) {
    const P = game.player;
    if (!this.enabled || this.holding || game.mode !== 'foot' || P.busy || P.crawling) return null;
    const a = pt(this.from), b = pt(this.to), p = P.pos;
    if (dist(p, a) < this.near && Math.abs(p.y - (a.y ?? p.y)) < 1.2) return { label: this.label, priority: this.priority, run: () => this.start(false) };
    if (this.twoWay && dist(p, b) < this.near && Math.abs(p.y - (b.y ?? p.y)) < 1.2) return { label: this.backLabel, priority: this.priority, run: () => this.start(true) };
    return null;
  }

  start(back = false) {
    const g = this.game, P = g.player;
    if (this.holding || !P.take(this)) return false;
    const b = pt(back ? this.from : this.to), st = this.st, p = P.pos;
    this.back = back;
    st.s.x = p.x; st.s.y = p.y; st.s.z = p.z;
    st.e.x = b.x; st.e.z = b.z; st.e.y = b.y ?? (!back && this.onto ? this.onto.y : g.world.groundHeight(b.x, b.z, p.y + 1.2));
    const d = dist(st.s, st.e);
    st.T = this.seconds ?? Math.min(1.0, Math.max(0.5, 0.42 + 0.085 * d));
    st.H = this.arc ?? Math.min(1.6, Math.max(0.7, 0.55 + 0.14 * d));
    st.yaw = d > 0.05 ? Math.atan2(st.e.x - st.s.x, st.e.z - st.s.z) : P.yaw;
    st.t = 0;
    Object.assign(this.edge, st.s, { yaw: st.yaw });
    this.t = 0; this.state = 'windup';
    this.friends.hold(this.label);
    drive(g, this);
    this.onStart?.(this);
    return true;
  }

  update(dt) {
    if (!once(this)) return;
    const g = this.game, P = g.player, st = this.st;
    if (this.state !== 'idle' && P.scripted !== this) { this.state = 'idle'; this.friends.drop(); } // put somewhere else by hand (a restore): this leap is over
    if (this.state === 'windup') {
      this.t += dt;
      const k = clamp01(this.t / WIND);
      P.yaw = turn(P.yaw, st.yaw, 1 - Math.exp(-16 * dt)); P.sync();
      layPose(P.model, null, 'crouch', ease(k));
      if (k >= 1) { this.state = 'air'; st.t = 0; }
    } else if (this.state === 'air') {
      if (typeof this.to === 'function' && !this.back) { const b = this.to(); st.e.x = b.x; st.e.z = b.z; } // a far side that moves is followed
      if (hop(g, null, st, dt)) {
        if (this.back || this.open) { this.state = 'land'; this.t = 0; this.leaps++; landed(g, st.e); this.onLand?.(this); }
        else { this.state = 'miss'; this.t = 0; this.misses++; }
      }
    } else if (this.state === 'miss') { // nothing under him where he came down
      this.t += dt;
      put(g, null, st.e.x, st.e.y - 9 * this.t * this.t, st.e.z, st.yaw);
      layPose(P.model, 'crouch', 'hang', clamp01(this.t / MISS));
      if (this.t >= MISS) {
        const a = this.edge;
        this.state = 'idle';
        this.friends.drop();
        g.overlay?.flash?.(FADE, 520, 1);
        P.place(a.x, a.z, a.yaw, a.y); // (this lets go of the body too)
        P.freeze(0.3);
        g.follow?.shake?.(0.12);
        g.hud?.toast?.('פספסת · שוב, ברגע הנכון', 1700);
        this.onMiss?.(this.misses, this);
      }
    } else if (this.state === 'land') {
      this.t += dt;
      const k = clamp01(this.t / LAND);
      put(g, null, st.e.x, st.e.y, st.e.z, st.yaw);
      layPose(P.model, 'crouch', null, ease(k));
      if (k >= 1) {
        this.state = 'idle';
        P.release(this, st.e.y);
        const back = this.back, a = pt(back ? this.to : this.from), e = { x: st.e.x, y: st.e.y, z: st.e.z }, yaw = st.yaw, T = st.T, H = st.H;
        const from = { x: a.x, z: a.z, y: a.y ?? this.edge.y };
        this.friends.go(from, yaw,
          () => back || ((!this.ready || !!this.ready()) && (!this.onto || (this.onto.solidFor ? this.onto.solidFor(T + WIND + 0.2) : this.onto.solid))),
          (j) => { j.st.e = beside(e, yaw, j.i, this.friends.spots); j.st.T = T; j.st.H = H; j.st.yaw = yaw; },
          (j, d) => airThenLand(hop, g, j.n, j.st, d));
      }
    }
    if (this.friends.busy) this.friends.update(dt);
  }

  dispose() {
    const g = this.game, P = g.player;
    if (this.state !== 'idle' && P.scripted === this) { // cut short in the air: down at the edge he left
      const a = this.state === 'land' ? this.st.e : this.edge;
      P.place(a.x, a.z, this.st.yaw, a.y);
    }
    this.state = 'idle';
    this.friends.drop();
    undrive(g, this);
  }
}

// A ledge to climb. `bottom`: at its foot, close to the face; `top`: the spot on top; both { x, z, y } (give y).
// The prompt shows within `near` metres of `bottom`; `down` (a label, or null for none) offers the way back
// from the top. `seconds`: the pull itself (by default it follows the height). `friendsFollow`: friends who
// climb after him by themselves (leave out the one who needs a hand: giveHand). onTop(), onDown(), enabled.
export class Climb {
  constructor(game, { bottom, top, label = 'לטפס', near = 1.5, seconds = null, down = 'לרדת', friendsFollow = [], friendSpots = null, onTop = null, onDown = null, priority = 6 }) {
    Object.assign(this, { game, bottom, top, label, near, seconds, down, onTop, onDown, priority });
    this.state = 'idle'; this.enabled = true; this.climbs = 0;
    this.st = { t: 0, s: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 0, z: 0 }, p: { x: 0, y: 0, z: 0 }, T: [0.28, 0.9, 0.45], yaw: 0, yaw0: 0 }; // the way up
    this.dn = { t: 0, s: this.st.s, e: this.st.b, T: 0.5, yaw: 0, yaw0: 0 };                                                               // the way down
    this.friends = new Followers(game, friendsFollow, friendSpots);
  }
  get active() { return this.state !== 'idle'; }
  get holding() { return this.state !== 'idle' || this.friends.busy; }
  ends() {
    const g = this.game, b = pt(this.bottom), p = pt(this.top), st = this.st;
    st.b.x = b.x; st.b.z = b.z; st.b.y = floorY(g, b, g.player.pos.y);
    st.p.x = p.x; st.p.z = p.z; st.p.y = p.y ?? g.world.groundHeight(p.x, p.z);
    st.yaw = Math.atan2(st.p.x - st.b.x, st.p.z - st.b.z);
    const h = Math.max(0, st.p.y - st.b.y);
    st.T[0] = 0.28; st.T[1] = this.seconds ?? Math.min(1.6, Math.max(0.55, 0.4 + 0.32 * h)); st.T[2] = 0.45;
    return h;
  }

  interaction(game = this.game) {
    const P = game.player;
    if (!this.enabled || this.holding || game.mode !== 'foot' || P.busy || P.crawling) return null;
    const b = pt(this.bottom), t = pt(this.top), p = P.pos;
    if (dist(p, b) < this.near && Math.abs(p.y - (b.y ?? p.y)) < 1.0) return { label: this.label, priority: this.priority, run: () => this.start(true) };
    if (this.down && dist(p, t) < this.near && Math.abs(p.y - (t.y ?? p.y)) < 1.0) return { label: this.down, priority: this.priority, run: () => this.start(false) };
    return null;
  }

  start(up = true) {
    const g = this.game, P = g.player;
    if (this.holding || !P.take(this)) return false;
    const st = this.st, h = this.ends();
    st.t = 0; st.s.x = P.pos.x; st.s.y = P.pos.y; st.s.z = P.pos.z; st.yaw0 = P.yaw;
    if (up) this.state = 'up';
    else { const q = this.dn; this.state = 'down'; q.t = 0; q.T = Math.min(0.8, 0.28 + 0.12 * h); q.yaw = st.yaw + Math.PI; q.yaw0 = P.yaw; } // off the edge and down to its foot
    this.friends.hold(up ? this.label : this.down);
    drive(g, this);
    return true;
  }

  update(dt) {
    if (!once(this)) return;
    const g = this.game, P = g.player, st = this.st;
    if (this.state !== 'idle' && P.scripted !== this) { this.state = 'idle'; this.friends.drop(); }
    if (this.state === 'up') {
      if (haul(g, null, st, dt)) {
        this.state = 'idle'; this.climbs++;
        P.release(this, st.p.y);
        landed(g, st.p);
        const b = { x: st.b.x, y: st.b.y, z: st.b.z }, p = { x: st.p.x, y: st.p.y, z: st.p.z }, yaw = st.yaw, T = [st.T[0], st.T[1], st.T[2]];
        this.friends.go(b, yaw, () => true,
          (j) => { j.st.b = b; j.st.p = beside(p, yaw, j.i, this.friends.spots); j.st.T = T; j.st.yaw = yaw; },
          (j, d) => haul(g, j.n, j.st, d));
        this.onTop?.(this);
      }
    } else if (this.state === 'down') {
      const q = this.dn;
      if (drop(g, null, q, dt)) { this.state = 'settle'; q.t = 0; landed(g, q.e); }
    } else if (this.state === 'settle') {
      const q = this.dn;
      if (settle(g, null, q, dt)) {
        this.state = 'idle';
        P.release(this, q.e.y);
        const p = { x: st.p.x, y: st.p.y, z: st.p.z }, e = { x: q.e.x, y: q.e.y, z: q.e.z }, yaw = q.yaw, T = q.T;
        this.friends.go(p, yaw, () => true,
          (j) => { j.st.e = beside(e, yaw, j.i, this.friends.spots); j.st.T = T; j.st.yaw = yaw; },
          (j, d) => airThenLand(drop, g, j.n, j.st, d));
        this.onDown?.(this);
      }
    }
    if (this.friends.busy) this.friends.update(dt);
  }

  dispose() {
    const g = this.game, P = g.player, st = this.st;
    if (this.state !== 'idle' && P.scripted === this) { const a = this.state === 'up' ? st.p : st.b; P.place(a.x, a.z, st.yaw, a.y); }
    this.state = 'idle';
    this.friends.drop();
    undrive(g, this);
  }
}

// Nehorai on top gives a friend a hand over a ledge. `from`: where the friend stands below, at the foot of
// the ledge; `to`: where he ends on top; both { x, z, y } (give y). Until then the friend waits at `from`
// (he is kept there: the squad would otherwise bring him round by itself). The prompt shows to the player on
// top within `near` metres of `to`. onDone(); done; returns the move (interaction, update, dispose).
export function giveHand(game, friend, opts = {}) { return new HandUp(game, friend, opts); }
class HandUp {
  constructor(game, friend, { from, to, label = 'לתת יד לארז', near = 2.2, seconds = null, onDone = null, priority = 7 }) {
    Object.assign(this, { game, n: friend, from, to, label, near, seconds, onDone, priority });
    this.state = 'idle'; this.done = false; this.enabled = true; this.held = false; this.parked = false; this.waitT = 0; this.t = 0;
    this.st = { t: 0, s: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 0, z: 0 }, p: { x: 0, y: 0, z: 0 }, T: [0.3, 0.9, 0.45], yaw: 0, yaw0: 0 };
    this.yawP = 0;
  }
  get active() { return this.state !== 'idle'; }
  get holding() { return this.state !== 'idle'; }
  ends() {
    const g = this.game, a = pt(this.from), b = pt(this.to), st = this.st;
    st.p.x = b.x; st.p.z = b.z; st.p.y = b.y ?? g.world.groundHeight(b.x, b.z);
    st.b.x = a.x; st.b.z = a.z; st.b.y = a.y ?? g.world.groundHeight(a.x, a.z, st.p.y - 1.3);
    st.yaw = Math.atan2(st.p.x - st.b.x, st.p.z - st.b.z);
    return st;
  }
  // the player is on top by the edge
  get above() { const P = this.game.player, st = this.st; return Math.abs(P.pos.y - st.p.y) < 0.9 && dist(P.pos, st.p) < this.near; }

  interaction(game = this.game) {
    const P = game.player, n = this.n;
    if (!this.enabled || this.done || this.state !== 'idle' || game.mode !== 'foot' || P.busy || P.crawling || !usable(n)) return null;
    const st = this.ends();
    if (!this.above || n.pos.y > st.p.y - 0.5 || dist(n.pos, st.b) > 12) return null;
    return { label: this.label, priority: this.priority, run: () => this.start() };
  }

  start() {
    const g = this.game, P = g.player, n = this.n;
    if (this.done || this.state !== 'idle' || !usable(n) || !P.take(this)) return false;
    const st = this.ends(), h = Math.max(0, st.p.y - st.b.y);
    if (!this.held) this.held = holdNpc(g, n, this.label);
    put(g, n, st.b.x, st.b.y, st.b.z, st.yaw); // at the foot of the ledge, facing it (wherever he had got to)
    st.t = 0; st.s.x = st.b.x; st.s.y = st.b.y; st.s.z = st.b.z; st.yaw0 = st.yaw;
    st.T[0] = 0.3; st.T[1] = this.seconds ?? Math.min(1.7, Math.max(0.7, 0.5 + 0.34 * h)); st.T[2] = 0.45;
    this.yawP = Math.atan2(st.b.x - P.pos.x, st.b.z - P.pos.z);
    this.state = 'pull'; this.t = 0;
    drive(g, this);
    return true;
  }

  update(dt) {
    if (!once(this) || this.done) return;
    const g = this.game, P = g.player, n = this.n, st = this.st;
    if (this.state === 'pull') {
      if (P.scripted !== this || !usable(n)) { this.state = 'idle'; if (P.scripted === this) P.release(this); return; }
      this.t += dt;
      const total = st.T[0] + st.T[1] + st.T[2], out = clamp01((this.t - st.T[0] - st.T[1]) / st.T[2]);
      P.yaw = turn(P.yaw, this.yawP, 1 - Math.exp(-12 * dt)); P.sync();
      if (out > 0) layPose(P.model, 'reach', null, ease(out)); else layPose(P.model, null, 'reach', ease(clamp01(this.t / st.T[0])));
      if (haul(g, n, st, dt) || this.t >= total) {
        put(g, n, st.p.x, st.p.y, st.p.z, st.yaw);
        this.state = 'idle'; this.done = true;
        P.release(this);
        freeNpc(g, n, this.held); this.held = false;
        landed(g, st.p);
        g.sound?.chime?.(true);
        this.onDone?.(this);
      }
      return;
    }
    if (!usable(n)) return;
    this.ends();
    // up there already (he came another way): nothing left to do
    if (Math.abs(n.pos.y - st.p.y) < 0.6 && dist(n.pos, st.p) < 3) { this.done = true; freeNpc(g, n, this.held); this.held = false; this.onDone?.(this); return; }
    // by the ledge, or the player already up: he waits at its foot, looking up
    const below = n.pos.y < st.p.y - 0.5;
    if (below && (this.above || dist(n.pos, st.b) < 4)) {
      if (!this.parked) { this.parked = true; this.held = holdNpc(g, n, 'מחכה ליד') || this.held; this.waitT = 0; }
      if (dist(n.pos, st.b) > 0.5) {
        this.waitT += dt;
        if (this.waitT > 4) { n.place(st.b.x, st.b.z, st.yaw, st.b.y); n.target = null; }
        else if (!n.target) n.walkTo(st.b.x, st.b.z, { run: true, near: 0.4 });
      } else { n.target = null; n.lookAt(st.p.x, st.p.z); this.waitT = 0; }
    }
  }

  dispose() {
    const g = this.game, P = g.player;
    if (this.state === 'pull' && P.scripted === this) P.release(this);
    if (this.state === 'pull' && usable(this.n)) put(g, this.n, this.st.p.x, this.st.p.y, this.st.p.z, this.st.yaw); // half way up: he is put on top
    this.state = 'idle';
    freeNpc(g, this.n, this.held); this.held = false;
    undrive(g, this);
  }
}

// Helped up: the friend comes to Nehorai's side (the left, or the right when a wall is in the way; `side`:
// 1 left, -1 right), goes down on a knee and gets an arm under his shoulder; Nehorai comes up onto his knees,
// an arm over the friend's shoulders, and both stand. The crawl ends as the lift begins (crawl(false)) and
// control comes back when they stand: onDone(). It runs by itself; returns the move (active, done, dispose).
const HELP = { kneel: 0.45, lift: 0.9, rise: 1.0, hold: 0.5, out: 0.4 };
export function helpUp(game, friend, opts = {}) { const h = new HelpUp(game, friend, opts); h.start(); return h; }
class HelpUp {
  constructor(game, friend, { onDone = null, side = null } = {}) {
    Object.assign(this, { game, n: friend, onDone, side });
    this.state = 'idle'; this.done = false; this.t = 0; this.held = false; this.spot = { x: 0, y: 0, z: 0 }; this.base = null; this.lifted = false; this.body = false;
  }
  get active() { return this.state !== 'idle'; }
  get holding() { return this.state !== 'idle'; }

  start() {
    const g = this.game, P = g.player, n = this.n;
    if (this.state !== 'idle' || this.done || !P.take(this)) return false;
    const yaw = P.yaw, p = P.pos, at = (s) => ({ x: p.x + Math.cos(yaw) * 0.56 * s + Math.sin(yaw) * 0.2, z: p.z - Math.sin(yaw) * 0.56 * s + Math.cos(yaw) * 0.2 });
    let side = this.side;
    if (side !== 1 && side !== -1) { const l = at(1); side = g.world.cols.blocks(l.x, p.y + 0.9, l.z) ? -1 : 1; }
    this.side = side; this.mirror = side < 0;
    const s = at(side);
    this.spot.x = s.x; this.spot.z = s.z; this.spot.y = p.y;
    this.base = P.crawling ? 'prone' : (P.model.pose && POSES[P.model.pose] ? P.model.pose : null);
    this.state = 'come'; this.t = 0; this.lifted = false;
    if (usable(n)) {
      this.held = holdNpc(g, n, 'עוזר לקום');
      this.body = n.body.enabled; n.body.enabled = false; // shoulder to shoulder: the two bodies do not push each other apart
      if (dist(n.pos, this.spot) > 9) put(g, n, s.x, p.y, s.z, yaw); else n.walkTo(s.x, s.z, { run: true, near: 0.3 });
    }
    drive(g, this);
    return true;
  }

  update(dt) {
    if (!once(this) || this.state === 'idle') return;
    const g = this.game, P = g.player, n = usable(this.n) ? this.n : null, s = this.spot, m = this.mirror;
    if (P.scripted !== this) { this.finish(false); return; } // put somewhere else by hand: over, as it stands
    this.t += dt;
    if (this.state === 'come') {
      if (n && dist(n.pos, s) > 0.35 && this.t < 1.8 && n.target) return;
      if (n) put(g, n, s.x, s.y, s.z, P.yaw);
      this.state = 'lift'; this.t = 0;
      return;
    }
    const t = this.t, H = HELP, t1 = H.kneel, t2 = t1 + H.lift, t3 = t2 + H.rise, t4 = t3 + H.hold, t5 = t4 + H.out;
    if (t >= t1 && !this.lifted) { this.lifted = true; P.crawl(false); }
    const M = P.model, F = n?.model;
    if (n) put(g, n, s.x, s.y, s.z, turn(n.yaw, P.yaw, 1 - Math.exp(-10 * dt)));
    if (t < t1) { if (F) layPose(F, null, 'kneel', ease(t / t1), 1, m); }
    else if (t < t2) { layPose(M, this.base, 'helped', ease((t - t1) / H.lift), 1, m); if (F) layPose(F, 'kneel', 'kneel', 0, 1, m); }
    else if (t < t3) { const k = ease((t - t2) / H.rise); layPose(M, 'helped', 'lean', k, 1, m); if (F) layPose(F, 'kneel', 'support', k, 1, m); }
    else { const w = t < t4 ? 1 : 1 - ease(clamp01((t - t4) / H.out)); layPose(M, 'lean', 'lean', 0, w, m); if (F) layPose(F, 'support', 'support', 0, w, m); }
    if (t >= t5) this.finish(true);
  }

  finish(ok) {
    const g = this.game, P = g.player, n = this.n;
    if (this.state === 'idle') return;
    this.state = 'idle'; this.done = true;
    if (!this.lifted) { this.lifted = true; if (ok) P.crawl(false); }
    if (P.scripted === this) P.release(this);
    if (n) { n.body.enabled = this.body && n.visible && !n.inCar; freeNpc(g, n, this.held); this.held = false; }
    undrive(g, this);
    if (ok) this.onDone?.(this);
  }
  cancel() { this.finish(false); }
  dispose() { this.finish(false); }
}

// ---------- the reality-path kit ----------

// A floating slab that is there for `on` seconds of every `period`, then gone until the period ends. The
// last `warn` seconds before it goes it blinks and turns warm; gone, a faint ghost of it stays, brightening
// just before it is back. Its walking surface and the floor under the camera and the lines of sight really
// come and go with it: one walk-only pad in the road network, switched on and off (covered), and one floor
// in the collision world; nothing is added or taken out between dispose()s. `offset`: seconds into the
// cycle at the start (platforms made together stay in step). `y`: the height of its top; `yaw` turns it.
// solid, phase, left (seconds to the next change), solidFor(s), lock(true | false | null), contains(x, z).
export class PhasePlatform {
  constructor(game, { x, z, hx = 1.2, hz = 1.2, y, period = 6, on = 3.5, offset = 0, thick = 0.3, warn = null, yaw = 0, color = '#8f88b8', onChange = null }) {
    Object.assign(this, { game, x, z, hx, hz, y, period: Math.max(0.5, period), offset, thick, yaw, onChange });
    this.on = Math.min(this.period, Math.max(0, on));
    this.warn = warn ?? Math.min(1.2, this.on * 0.4);
    this.t = 0; this.locked = null; this.solid = true;
    const W = game.world, c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), ex = hx * c + hz * s, ez = hx * s + hz * c;
    this.pad = W.net.addPad({ x, z, hx, hz, yaw, h: y - 0.05, top: 0.05, blend: 0, walkOnly: true, name: 'phase' });
    this.floor = { x0: x - ex, z0: z - ez, x1: x + ex, z1: z + ez, y: y - thick / 2 };
    W.cols.floors.push(this.floor);
    this.base = new THREE.Color(color);
    this.mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, emissive: '#3a2a6e', emissiveIntensity: 0.35, transparent: true, opacity: 1 });
    this.mesh = new THREE.Mesh(shape('slab', () => new THREE.BoxGeometry(1, 1, 1)), this.mat);
    this.mesh.scale.set(hx * 2, thick, hz * 2); this.mesh.position.set(x, y - thick / 2, z); this.mesh.rotation.y = yaw; this.mesh.name = 'phase-platform';
    game.scene.add(this.mesh);
    live.platforms.add(this);
    this.set((this.phase < this.on));
    this.look();
  }
  get phase() { const p = (this.t + this.offset) % this.period; return p < 0 ? p + this.period : p; }
  // seconds until it goes (while it is there) or is back (while it is gone); Infinity while locked
  get left() { if (this.locked !== null) return Infinity; const p = this.phase; return p < this.on ? this.on - p : this.period - p; }
  // there now and for at least `seconds` more
  solidFor(seconds) { return this.solid && this.left > seconds; }
  // held there (true: a switch steadied it), held away (false), or back on its rhythm (null)
  lock(state = true) { this.locked = state === null ? null : !!state; this.set(this.locked ?? (this.phase < this.on)); this.look(); }
  contains(x, z, margin = 0) { return this.pad.sd(x, z) <= margin; }

  set(solid) {
    if (solid === this.solid && this.pad.covered === solid) return;
    this.solid = solid;
    this.pad.covered = solid;                                   // the feet: padAt skips a pad that is not covered
    this.floor.y = solid ? this.y - this.thick / 2 : -Infinity; // the camera and the lines of sight: a floor nothing ever crosses
    this.onChange?.(solid, this);
  }

  update(dt) {
    if (!once(this)) return;
    this.t += dt;
    const want = this.locked ?? (this.phase < this.on);
    if (want !== this.solid) {
      this.set(want);
      if (!want) { const p = this.game.player.pos; if (this.contains(p.x, p.z) && Math.abs(p.y - this.y) < 0.4) this.game.sound?.hit?.('block', 0.4); }
    }
    this.look();
  }
  look() {
    const m = this.mat, l = this.left;
    if (this.solid) {
      m.depthWrite = true;
      if (this.locked === true) { m.opacity = 1; m.emissive.setRGB(0.1, 0.5, 0.42); m.emissiveIntensity = 0.5; }
      else if (l < this.warn) { // about to go: warm and blinking, faster toward the end
        const k = 1 - l / this.warn, blink = 0.5 + 0.5 * Math.sin(this.t * (9 + 20 * k));
        m.opacity = 1 - 0.5 * blink * (0.35 + 0.65 * k);
        m.emissive.setRGB(1, 0.32, 0.16); m.emissiveIntensity = 0.3 + 0.9 * blink;
        this.beep(k);
      } else { m.opacity = 1; m.emissive.setRGB(0.23, 0.16, 0.43); m.emissiveIntensity = 0.35; this.beeped = -1; }
    } else {
      m.depthWrite = false;
      m.opacity = l < 0.5 ? 0.14 + 0.45 * (1 - l / 0.5) : 0.14; // a ghost, brighter just before it is back
      m.emissive.setRGB(0.25, 0.5, 1); m.emissiveIntensity = 0.5;
    }
  }
  // the one he stands on ticks before it goes
  beep(k) {
    const g = this.game, p = g.player.pos, n = Math.floor(k * 4);
    if (n === this.beeped || !this.contains(p.x, p.z, 0.2) || Math.abs(p.y - this.y) > 0.5) return;
    this.beeped = n;
    g.sound?.beep?.(1, 700 + 160 * n);
  }

  dispose() {
    const W = this.game.world;
    if (!this.pad) return;
    W.net.removePad(this.pad); this.pad = null;
    const i = W.cols.floors.indexOf(this.floor); if (i >= 0) W.cols.floors.splice(i, 1);
    this.mesh.removeFromParent(); this.mat.dispose(); unshape('slab');
    live.platforms.delete(this);
  }
}

// frost at the edges of the screen while the player is held (one layer for every field, gone with the last)
let frost = null, frostUsers = 0;
function frostLayer(game) {
  if (frost || typeof document === 'undefined') return frost;
  const el = document.createElement('div');
  el.id = 'frost'; el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .2s ease-out;box-shadow:inset 0 0 110px 34px rgba(150,225,255,.72);background:radial-gradient(ellipse at 50% 50%,rgba(170,230,255,0) 42%,rgba(170,230,255,.24) 100%)';
  const host = game.overlay?.root || document.getElementById('game') || document.body;
  host.append(el);
  return (frost = el);
}

// A field where time stops. Every `period` seconds it winds up for `warn` seconds (it brightens and pulses
// faster, a ring closes in on its edge, beeps rise) and fires: whoever is inside at that moment (the
// player on foot, any friend or guard in sight, a Disturbance) is held for `hold` seconds: the player's
// stick does nothing (game.player.freeze), a body stands like a statue with a frost on it, a ball stops and
// is harmless. Walking in after it fired is safe. `y`: the floor it stands on. firesIn (seconds to the
// next), winding, holding, fired (count), onFire(caught), inside(pos).
export class StasisField {
  constructor(game, { x, z, r = 2.5, y = null, period = 7, hold = 2.5, warn = 1.4, offset = 0, height = 2.6, onFire = null }) {
    Object.assign(this, { game, x, z, r, period: Math.max(1, period), offset, height, onFire });
    this.y = y ?? game.world.groundHeight(x, z);
    this.hold = Math.min(hold, this.period * 0.6);
    this.warn = Math.min(warn, this.period - this.hold - 0.2);
    this.t = 0; this.cycle = -1; this.fired = 0; this.beeped = -1;
    this.caught = new Map();   // npc -> { left, x, z, y, yaw, held, target, kept }
    this.me = { left: 0, kept: new Float32Array(N) }; // the player, when he is caught
    this.mat = new THREE.MeshBasicMaterial({ color: '#59c8ff', transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(shape('field', () => new THREE.CylinderGeometry(1, 1, 1, 28, 1, true).translate(0, 0.5, 0)), this.mat);
    this.mesh.scale.set(r, height, r); this.mesh.position.set(x, this.y, z); this.mesh.renderOrder = 4; this.mesh.name = 'stasis-field';
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#9fe4ff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(shape('ring', () => new THREE.RingGeometry(0.93, 1, 40).rotateX(-Math.PI / 2)), this.ringMat);
    this.ring.position.set(x, this.y + 0.06, z); this.ring.renderOrder = 4; this.ring.name = 'stasis-ring';
    game.scene.add(this.mesh, this.ring);
    live.fields.add(this);
    frostUsers++;
    this.look();
  }
  get phase() { const p = (this.t + this.offset) % this.period; return p < 0 ? p + this.period : p; }
  get fireAt() { return this.period - this.hold; }
  get firesIn() { const p = this.phase, f = this.fireAt; return p < f ? f - p : this.period - p + f; }
  get winding() { const p = this.phase; return p >= this.fireAt - this.warn && p < this.fireAt; }
  get holding() { return this.me.left > 0 || this.caught.size > 0; } // someone is held: it runs by itself until he is let go
  get frozen() { return this.phase >= this.fireAt; }
  inside(pos, margin = 0) { return Math.hypot(pos.x - this.x, pos.z - this.z) < this.r + margin && pos.y > this.y - 1 && pos.y < this.y + this.height; }

  update(dt) {
    if (!once(this)) return;
    const g = this.game;
    this.t += dt;
    const n = Math.floor((this.t + this.offset) / this.period);
    if (this.phase >= this.fireAt && this.cycle !== n) { this.cycle = n; this.fire(); }
    this.keep(dt);
    this.look();
    if (this.winding && this.inside(g.player.pos, 6)) { // heard coming, by whoever is near
      const k = 1 - (this.fireAt - this.phase) / this.warn, b = Math.floor(k * 5);
      if (b !== this.beeped) { this.beeped = b; g.sound?.beep?.(1, 520 + 150 * b); }
    } else if (!this.winding) this.beeped = -1;
  }

  fire() {
    const g = this.game, P = g.player;
    let caught = 0;
    this.fired++;
    if (g.mode === 'foot' && !P.scripted && this.inside(P.pos)) {
      P.freeze(this.hold);
      this.me.left = this.hold; keepBody(P.model, this.me.kept);
      g.hud?.pop?.('הזמן נעצר', 'block');
      caught++;
    }
    for (const n of g.npcs.values()) {
      if (!usable(n) || !this.inside(n.pos)) continue;
      let c = this.caught.get(n);
      if (!c) this.caught.set(n, (c = { left: 0, x: 0, z: 0, y: 0, yaw: 0, held: false, target: null, kept: new Float32Array(N) }));
      c.left = this.hold; c.x = n.pos.x; c.z = n.pos.z; c.y = n.pos.y; c.yaw = n.yaw; c.target = n.target;
      c.held = holdNpc(g, n, 'קפוא') || c.held;
      keepBody(n.model, c.kept);
      caught++;
    }
    for (const d of live.disturbances) if (d.game === g && this.inside(d.pos)) { d.freeze(this.hold); caught++; }
    g.sound?.hit?.('block', this.inside(P.pos, 8) ? 0.8 : 0.25);
    if (caught) drive(g, this);
    this.onFire?.(caught, this);
  }

  // those held: still, cold, and let go when their time is up
  keep(dt) {
    const g = this.game, P = g.player, me = this.me;
    if (me.left > 0) {
      me.left = Math.min(me.left - dt, P.frozen); // (put somewhere by hand: the controller let him go, so do we)
      if (me.left > 0) { putBody(P.model, me.kept); P.model.body.material.emissive.setRGB(0.1, 0.34, 0.55); }
      else { me.left = 0; P.model.body.material.emissive.setRGB(0, 0, 0); }
      const el = frostLayer(g); if (el) el.style.opacity = me.left > 0 ? '1' : '0';
    }
    for (const [n, c] of this.caught) {
      c.left -= dt;
      if (c.left > 0 && usable(n)) { put(g, n, c.x, c.y, c.z, c.yaw); putBody(n.model, c.kept); n.model.body.material.emissive.setRGB(0.1, 0.34, 0.55); continue; }
      n.model.body.material.emissive.setRGB(0, 0, 0);
      if (c.held) freeNpc(g, n, true); else if (c.target && !n.target) n.target = c.target; // on his way somewhere: he goes on
      this.caught.delete(n);
    }
  }

  look() {
    const p = this.phase, f = this.fireAt, m = this.mat, rm = this.ringMat;
    if (p >= f) { // fired: frozen white-blue, fading as the hold runs out
      const k = (p - f) / this.hold;
      m.opacity = k < 0.08 ? 0.9 : 0.42 * (1 - 0.6 * k); m.color.setRGB(0.75, 0.93, 1);
      rm.opacity = 0.7; this.ring.scale.setScalar(this.r);
    } else if (p >= f - this.warn) { // winding up: brighter, pulsing faster, the ring closing in on the edge
      const k = 1 - (f - p) / this.warn, pulse = 0.5 + 0.5 * Math.sin(this.t * (8 + 26 * k));
      m.opacity = 0.14 + 0.4 * k * (0.55 + 0.45 * pulse); m.color.setRGB(0.35 + 0.5 * k, 0.78 + 0.16 * k, 1);
      rm.opacity = 0.45 + 0.5 * k; this.ring.scale.setScalar(this.r * (1.9 - 0.9 * k));
    } else { // quiet: a faint column, breathing
      m.opacity = 0.07 + 0.03 * Math.sin(this.t * 1.6); m.color.setRGB(0.35, 0.78, 1);
      rm.opacity = 0.32; this.ring.scale.setScalar(this.r);
    }
  }

  dispose() {
    const g = this.game, P = g.player;
    if (!this.mesh) return;
    if (this.me.left > 0) { this.me.left = 0; P.frozen = 0; P.model.body.material.emissive.setRGB(0, 0, 0); }
    for (const [n, c] of this.caught) { n.model.body.material.emissive.setRGB(0, 0, 0); if (c.held) freeNpc(g, n, true); else if (c.target && !n.target) n.target = c.target; }
    this.caught.clear();
    this.mesh.removeFromParent(); this.ring.removeFromParent(); this.mat.dispose(); this.ringMat.dispose(); unshape('field'); unshape('ring');
    this.mesh = null;
    live.fields.delete(this);
    undrive(g, this);
    if (--frostUsers <= 0) { frostUsers = 0; if (frost) { frost.remove(); frost = null; } }
  }
}

// A drifting ball of energy. It goes along `path` ([{ x, z, y? }, ...]: there and back, or round and round
// with `loop`) at `speed` m/s, `height` metres over the floor; the path is drawn on the ground and a spark
// runs ahead of it, so where it is going is always seen. Touching it (within `r`) knocks the player `knock`
// metres back and counts one mark (game.paint.strike, as a blast he stood in does): never more than once a
// second, all the balls of the game together. Held by a stasis field it stops, pales and is harmless.
// pos, touches, frozen, freeze(seconds), onTouch(n).
const GLOW = { life: 0.45, size: 1, grow: -0.6, color: [0.62, 0.36, 1], alpha: 0.55, grav: 0, drag: 1.2 };
const PIP = { life: 0.4, size: 0.5, grow: -0.4, color: [0.85, 0.7, 1], alpha: 0.8, grav: 0, drag: 0 };
let lastMark = { game: null, t: -Infinity };
export class Disturbance {
  constructor(game, { path, speed = 2.2, r = 0.9, height = 1.0, loop = false, marks = true, knock = 2.4, color = '#a66bff', label = 'הפרעה!', onTouch = null }) {
    Object.assign(this, { game, speed, r, height, loop, marks, knock, label, onTouch, color });
    const W = game.world;
    this.pts = (path || []).map((p) => ({ x: p.x, z: p.z, y: p.y ?? W.groundHeight(p.x, p.z) }));
    if (!this.pts.length) throw new Error('Disturbance: a path of at least one point');
    if (loop && this.pts.length > 2) this.pts.push({ ...this.pts[0] });
    const n = this.pts.length;
    this.len = new Float32Array(Math.max(1, n - 1)); this.total = 0;
    for (let i = 0; i < n - 1; i++) { this.len[i] = dist(this.pts[i], this.pts[i + 1]); this.total += this.len[i]; }
    this.s = 0; this.t = 0; this.frozen = 0; this.touches = 0; this.push = 0; this.px = 0; this.pz = 0; this.acc = 0; this.pipAcc = 0;
    this.pos = { x: this.pts[0].x, y: this.pts[0].y + height, z: this.pts[0].z };
    this.ahead = { x: 0, y: 0, z: 0 };
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.Mesh(shape('ball', () => new THREE.SphereGeometry(1, 14, 10)), this.mat);
    this.mesh.renderOrder = 5; this.mesh.name = 'disturbance';
    game.scene.add(this.mesh);
    // its way drawn on the ground: a thin ribbon
    this.trail = null;
    if (n > 1) {
      const pos = [], idx = [], w = 0.09;
      for (let i = 0; i < n - 1; i++) {
        const a = this.pts[i], b = this.pts[i + 1], l = this.len[i] || 1, nx = -(b.z - a.z) / l * w, nz = (b.x - a.x) / l * w, k = i * 4;
        pos.push(a.x - nx, a.y + 0.07, a.z - nz, a.x + nx, a.y + 0.07, a.z + nz, b.x - nx, b.y + 0.07, b.z - nz, b.x + nx, b.y + 0.07, b.z + nz);
        idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
      this.trailMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      this.trail = new THREE.Mesh(geo, this.trailMat); this.trail.renderOrder = 3; this.trail.name = 'disturbance-path';
      game.scene.add(this.trail);
    }
    live.disturbances.add(this);
    this.at(0, this.pos);
    this.look();
  }
  get holding() { return this.push > 0; }
  freeze(seconds) { this.frozen = Math.max(this.frozen, seconds); }

  // the point `s` metres along the path (bounced back at its ends, or wrapped round a loop), into `out`
  at(s, out) {
    const L = this.total, P = this.pts;
    if (L <= 0) { out.x = P[0].x; out.y = P[0].y + this.height; out.z = P[0].z; return out; }
    if (this.loop) s = ((s % L) + L) % L; else { s = ((s % (2 * L)) + 2 * L) % (2 * L); if (s > L) s = 2 * L - s; }
    let i = 0;
    while (i < this.len.length - 1 && s > this.len[i]) { s -= this.len[i]; i++; }
    const a = P[i], b = P[i + 1], k = this.len[i] > 0 ? Math.min(1, s / this.len[i]) : 0;
    out.x = a.x + (b.x - a.x) * k; out.y = a.y + (b.y - a.y) * k + this.height; out.z = a.z + (b.z - a.z) * k;
    return out;
  }

  update(dt) {
    if (!once(this)) return;
    const g = this.game, P = g.player, fire = g.fx?.fire;
    this.t += dt;
    if (this.push > 0) { // the knock back, over a few frames; walls still stop it
      const step = Math.min(dt, this.push) / 0.2 * this.knock;
      this.push -= dt;
      if (g.mode === 'foot' && !P.scripted) P.push(this.px * step, this.pz * step);
    }
    if (this.frozen > 0) { this.frozen = Math.max(0, this.frozen - dt); this.look(); return; }
    this.s += this.speed * dt;
    this.at(this.s, this.pos);
    this.look();
    if (fire) {
      this.acc += dt;
      if (this.acc > 0.07) { this.acc = 0; GLOW.size = this.r * 2.1; fire.spawn(this.pos.x, this.pos.y, this.pos.z, 0, 0.2, 0, GLOW); }
      this.pipAcc += dt;
      if (this.pipAcc > 0.16 && this.total > 0) { this.pipAcc = 0; const a = this.at(this.s + Math.max(1.2, this.speed), this.ahead); fire.spawn(a.x, a.y - this.height + 0.12, a.z, 0, 0, 0, PIP); }
    }
    // the touch
    if (g.mode !== 'foot' || P.scripted) return;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > this.r + 0.35 || Math.abs(P.pos.y + 0.9 - this.pos.y) > 1.6) return;
    if (lastMark.game === g && g.time - lastMark.t < 1) return;
    lastMark.game = g; lastMark.t = g.time;
    this.touches++;
    if (d > 0.05) { this.px = dx / d; this.pz = dz / d; } else { this.px = -Math.sin(P.yaw); this.pz = -Math.cos(P.yaw); }
    this.push = 0.2;
    drive(g, this);
    if (this.marks) g.paint.strike(this.label, this.color); else { g.hud?.pop?.(this.label, 'hit'); g.follow?.shake?.(0.4); }
    g.fx?.sparks?.(P.pos.x, P.pos.y + 1, P.pos.z, 10);
    this.onTouch?.(this.touches, this);
  }
  look() {
    const m = this.mat, cold = this.frozen > 0, s = this.r * 0.62 * (cold ? 1 : 1 + 0.09 * Math.sin(this.t * 9));
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.scale.setScalar(s);
    if (cold) { m.color.setRGB(0.6, 0.85, 1); m.opacity = 0.45; } else { m.color.set(this.color); m.opacity = 0.92; }
  }

  dispose() {
    if (!this.mesh) return;
    this.mesh.removeFromParent(); this.mat.dispose(); unshape('ball'); this.mesh = null;
    if (this.trail) { this.trail.removeFromParent(); this.trail.geometry.dispose(); this.trailMat.dispose(); this.trail = null; }
    live.disturbances.delete(this);
    undrive(this.game, this);
  }
}

// A switch: a prompt within `near` metres of `at` ({ x, z, y?, yaw? }), and onUse(on, switch) when it is
// pressed. `once`: it stays thrown (the default); else it goes on and off. A small stone post with a light
// stands there (red, green once thrown; `visual: false` when the site draws its own): 0.7 m ahead of `at`
// the way `at.yaw` points, or on `at` itself. on, used, reset(), enabled.
export class Switch {
  constructor(game, { at, label = 'להפעיל', onUse = null, near = 2.0, once: stays = true, visual = true, priority = 6 }) {
    Object.assign(this, { game, at, label, onUse, near, stays, priority });
    this.on = false; this.used = false; this.enabled = true; this.mesh = null; this.body = null;
    if (visual) {
      const W = game.world, yaw = at.yaw, x = at.x + (yaw != null ? Math.sin(yaw) * 0.7 : 0), z = at.z + (yaw != null ? Math.cos(yaw) * 0.7 : 0), y = at.y ?? W.groundHeight(at.x, at.z);
      this.mat = new THREE.MeshStandardMaterial({ color: '#8a8794', roughness: 0.8, emissive: '#ff3b5c', emissiveIntensity: 0.9 });
      this.mesh = new THREE.Mesh(shape('post', () => new THREE.CylinderGeometry(0.13, 0.2, 0.95, 8).translate(0, 0.475, 0)), this.mat);
      this.mesh.position.set(x, y, z); this.mesh.name = 'switch';
      game.scene.add(this.mesh);
      if (yaw != null) this.body = W.cols.addCircle(x, z, 0.22, y - 0.5, y + 1);
    }
  }
  interaction(game = this.game) {
    const P = game.player, a = this.at;
    if (!this.enabled || (this.stays && this.used) || game.mode !== 'foot' || P.busy || dist(P.pos, a) > this.near || Math.abs(P.pos.y - (a.y ?? P.pos.y)) > 1.6) return null;
    return { label: this.label, priority: this.priority, run: () => this.use() };
  }
  use() {
    if (!this.enabled || (this.stays && this.used)) return false;
    this.used = true; this.on = this.stays ? true : !this.on;
    this.light();
    this.game.sound?.chime?.(true);
    this.onUse?.(this.on, this);
    return true;
  }
  light() { if (this.mat) this.mat.emissive.set(this.on ? '#2fd27a' : '#ff3b5c'); }
  reset() { this.on = false; this.used = false; this.light(); }
  update() {}
  dispose() {
    if (this.mesh) { this.mesh.removeFromParent(); this.mat.dispose(); unshape('post'); this.mesh = null; }
    if (this.body) { this.game.world.cols.remove(this.body); this.body = null; }
  }
}

// The rift under the broken path: whoever goes below `minY` there is put back, never failed. While the
// guard lives the player falls through the air instead of snapping down (game.player.gravity). When he is
// under `minY` (and `where(pos)` holds, if given): a short fade, he stands on the last safe stone again
// (`safe()` → { x, z, y, yaw? }; without it the guard remembers the last firm ground he stood on that was
// no PhasePlatform), a beat held still, and `friends` are put beside him. A friend who fell alone is put
// beside the player if he stands on firm ground, else on the safe stone. falls, last, onFall(n).
export function riftGuard(game, opts) { return new RiftGuard(game, opts); }
class RiftGuard {
  constructor(game, { minY, safe = null, friends = [], where = null, onFall = null, hint = 'נפלת לקרע · חזרה לאבן האחרונה' }) {
    Object.assign(this, { game, minY, safe, friends, where, onFall, hint });
    this.falls = 0; this.t = 0; this.last = null; this.spot = { x: 0, y: 0, z: 0, yaw: 0 };
    const P = game.player;
    this.hadGravity = P.gravity; P.gravity = true;
    if (!this.below(P.pos) && !this.onPhase(P.pos)) this.remember();
  }
  get holding() { return false; }
  below(p) { return p.y < this.minY && (!this.where || this.where(p)); }
  onPhase(p) { for (const s of live.platforms) if (s.game === this.game && Math.abs(p.y - s.y) < 0.6 && s.contains(p.x, p.z, 0.1)) return true; return false; }
  remember() { const P = this.game.player, s = this.spot; s.x = P.pos.x; s.y = P.pos.y; s.z = P.pos.z; s.yaw = P.yaw; this.last = s; }
  // where to stand him again
  stone() { const s = this.safe ? this.safe() : null; return s || this.last; }

  update(dt) {
    if (!once(this)) return;
    const g = this.game, P = g.player;
    if (g.mode !== 'foot') return;
    const firm = !P.falling && !P.scripted && !this.below(P.pos);
    if (firm && !this.safe) { this.t += dt; if (this.t > 0.25 && !this.onPhase(P.pos)) { this.t = 0; this.remember(); } }
    if (!P.scripted && this.below(P.pos)) {
      const s = this.stone();
      if (s) {
        this.falls++;
        g.overlay?.flash?.(FADE, 560, 1);
        P.place(s.x, s.z, s.yaw ?? P.yaw, s.y ?? null);
        P.freeze(0.35);
        g.follow?.shake?.(0.1);
        if (this.hint) g.hud?.toast?.(this.hint, 1800);
        this.friends.forEach((n, i) => { if (usable(n)) this.bring(n, i); });
        this.onFall?.(this.falls, this);
      }
      return;
    }
    for (let i = 0; i < this.friends.length; i++) { // a friend who fell alone
      const n = this.friends[i];
      if (!usable(n) || !this.below(n.pos)) continue;
      if (firm && !this.onPhase(P.pos)) this.bring(n, i);
      else { const s = this.stone(); if (s) { n.place(s.x, s.z, s.yaw ?? n.yaw, s.y ?? null); n.target = null; } }
    }
  }
  // a friend beside the player, on the player's floor
  bring(n, i) {
    const P = this.game.player, yaw = P.yaw, side = (i % 2 ? -1 : 1) * 0.8 * (1 + Math.floor(i / 2));
    n.place(P.pos.x + Math.cos(yaw) * side - Math.sin(yaw) * 0.3, P.pos.z - Math.sin(yaw) * side - Math.cos(yaw) * 0.3, yaw, P.pos.y);
    if (Math.abs(n.pos.y - P.pos.y) > 0.6) n.place(P.pos.x, P.pos.z, yaw, P.pos.y); // no stone under that spot: right where the player stands
    n.target = null;
  }
  dispose() { const P = this.game.player; P.gravity = this.hadGravity; P.falling = false; P.vy = 0; }
}

// A bag for a mission's moves: kit.add(...things) (returns the first), kit.update(dt) from the step's
// update, kit.interaction(game) from the step's interaction (the most important prompt wins), kit.dispose()
// from the cleanup and before a restore stages the scene again.
export class Kit {
  constructor() { this.items = []; }
  add(...things) { for (const t of things) if (t) this.items.push(t); return things[0]; }
  remove(thing) { const i = this.items.indexOf(thing); if (i >= 0) this.items.splice(i, 1); thing?.dispose?.(); }
  update(dt) { for (let i = 0; i < this.items.length; i++) this.items[i].update?.(dt); }
  interaction(game) {
    let best = null;
    for (let i = 0; i < this.items.length; i++) { const it = this.items[i].interaction?.(game); if (it && (!best || it.priority > best.priority)) best = it; }
    return best;
  }
  dispose() { for (const t of this.items) t.dispose?.(); this.items.length = 0; }
}
