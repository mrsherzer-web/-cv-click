// A fight: Nehorai (and friends who help) against one or more opponents. Opponents take turns: a red
// ring and a wind-up warn before each punch, and after a punch the opponent is open for a moment
// (yellow ring) and takes double damage. Beaten opponents sit down, out of the fight. No blood: hits
// are a white flash and a stagger. The same machinery runs practice drills, where nobody goes down.
// Chapter nine: Nehorai's heavy punch and shove, the three-hit combination (jab, cross, a finisher that
// knocks the opponent back), knockdowns (on the floor for a moment, up again unless he is out), bosses
// with armor and phases, and on the HUD the combination count, the health of the one he faces and a
// boss's bar with his name.
// Chapter ten's last fight, each only when the Fight is made with it (so every earlier fight is as it
// was): `special`: a meter that fills with landed hits and, full, a special attack on its own button (a
// short film of a hit: the camera pushes in, time slows as it lands, he is thrown back and floored);
// `openings`: when he staggers (a heavy punch or a combination's end landed, a shove stopped his swing,
// his swing was dodged) "עכשיו!" shows for a moment, and the punch pressed in that moment is a counter
// that goes through his guard and counts double; pressed late it is an ordinary punch; `impact`: harder
// hit reactions (a longer flash, sparks, a stronger shake, a blink of slow motion on a big hit).
// `finale: true` turns the three on.
import * as THREE from 'three';
import { Fighter, MOVES } from './fighter.js';
import { dampAngle } from '../core/math.js';

const ringGeo = new THREE.RingGeometry(0.5, 0.72, 32).rotateX(-Math.PI / 2);
const RED = new THREE.Color('#e2574c'), OPEN = new THREE.Color('#ffd23f');
export const COMBO_WINDOW = 1.1; // seconds after a landed punch in which the next one carries the combination on
const SLIDE = 0.22;               // a knock-back is a short slide, not a jump
export const OPENING = 0.85;      // seconds a timed opening stays open
const GAIN = { light: 0.1, armor: 0.06, finisher: 0.22, heavy: 0.2, shove: 0.05, counter: 0.3 }; // what a landed hit adds to the special's meter

// Slow motion for a moment: the whole game runs at `scale` of its speed for `seconds` of real time and
// eases back over the last tenth of a second. A call while one runs keeps the slower of the two and the
// later end. game.slowmo(scale, seconds) is this (combat/paint.js hangs it on the game). The game has no
// time scale of its own, so this wraps the game's update while it lasts and takes the wrap off after;
// game.slowScale is the factor now (1 when time runs as usual).
export function slowmo(game, scale = 0.3, seconds = 0.5) {
  let s = game.slow;
  if (!s) {
    s = game.slow = { scale: 1, left: 0 };
    const inner = game.update, own = Object.prototype.hasOwnProperty.call(game, 'update');
    game.update = function (dt) {
      const st = this.slow;
      let k = 1;
      if (st && st.left > 0) { k = st.left < 0.1 ? st.scale + (1 - st.scale) * (1 - st.left / 0.1) : st.scale; st.left -= dt; }
      this.slowScale = k;
      const out = inner.call(this, dt * k);
      if (!this.slow || this.slow.left <= 0) { // over: the wrap comes off
        this.slow = null; this.slowScale = 1;
        if (own) this.update = inner; else delete this.update;
      }
      return out;
    };
  }
  s.scale = Math.min(s.scale, Math.max(0.05, scale));
  s.left = Math.max(s.left, seconds);
  return s;
}

// a knock-back as a slide over a fifth of a second, against the walls
function slide(f, npc, cols, dt) {
  if (f.knock) { f.slide = { x: f.knock.x, z: f.knock.z, t: SLIDE }; f.knock = null; }
  const s = f.slide;
  if (!s) return;
  const k = Math.min(dt, s.t) / SLIDE;
  npc.pos.x += s.x * k; npc.pos.z += s.z * k;
  cols.resolve(npc.pos, 0.33, npc.pos.y, npc);
  if ((s.t -= dt) <= 0) f.slide = null;
}
// the fight over, nothing slides him any more: the rest of the knock-back now, in frame-sized steps
// so the walls still stop it (a finisher's 1.3 m is not lost on the last knock-out)
function settle(f, npc, cols) { for (let i = 0; i < 12 && (f.knock || f.slide); i++) slide(f, npc, cols, 1 / 30); }

// phases of a boss: [0.6, 0.3] or [{ at, aggression, windup, moves, power, armor, pop }]
function phaseList(phases) {
  return (phases || []).map((p) => (typeof p === 'number' ? { at: p } : p)).sort((a, b) => b.at - a.at);
}

// an opponent: an Npc driven by a small state machine (approach, circle, windup, strike, recover).
// guard: share of Nehorai's punches he gets his guard up for (only a heavy punch goes through it);
// boss: a big opponent (hp, slow wind-ups with big swings, armor against light punches, phases, a bar
// on the HUD); armor: 0..1, the share of a light punch he shrugs off; phases: health shares at which he
// goes down for a moment and gets up angrier; knockdownAt: health share under which a big hit floors him
export class Opponent {
  constructor(fight, npc, opts = {}) {
    const boss = !!opts.boss;
    const {
      hp = boss ? 200 : 70, power = 1, aggression = 1, windup = boss ? 1.05 : 0.62, open = boss ? 1.1 : 0.8,
      moves = boss ? ['slam', 'swing', 'slam', 'cross'] : ['swing', 'cross'], name = npc.spec.name.split(' ')[0],
      drill = false, guard = 0, armor = boss ? 0.8 : 0, phases = boss ? [0.6, 0.3] : [], knockdownAt,
    } = opts;
    this.fight = fight;
    this.npc = npc;
    this.moves = moves;
    this.windupTime = windup;
    this.openTime = open;      // how long the counter window stays open after a punch
    this.aggression = aggression;
    this.drill = drill;        // a coach throwing punches on purpose: never goes down, keeps a steady rhythm
    this.guard = guard;
    this.boss = boss;
    this.phases = phaseList(phases);
    this.marks = this.phases.map((p) => p.at); // for the boss bar, built once (the HUD runs every frame)
    this.phase = 0;            // phases passed so far
    this.fighter = new Fighter({ pos: npc.pos, get yaw() { return npc.yaw; }, set yaw(v) { npc.yaw = v; }, model: npc.model }, { hp, power, name });
    const f = this.fighter;
    f.armor = armor;
    if (knockdownAt !== undefined) f.knockdownAt = knockdownAt;
    else if (boss) f.knockdownAt = 0;   // by default a boss goes down at his phases, not because he is low
    if (drill) { f.minHp = hp; f.floorable = false; }
    this.mode = 'approach';
    this.t = 0.6;
    this.side = Math.random() < 0.5 ? 1 : -1;
    this.swings = 0;
    this.interrupted = 0;      // wind-ups stopped by a shove or a punch
    this.shovesSeen = 0;
    this.ringScale = boss ? 1.45 : 1;
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 2;
    this.ringRed = true;
    fight.game.scene.add(this.ring);
    npc.idle = null;
    npc.posed = false;
    npc.face = null;
    npc.target = null;
    npc.model.setPose('guard');
    f.onDown = () => { this.mode = 'out'; this.ring.visible = false; npc.target = null; };
    // a light punch on armor: once in a while the HUD says what does move him
    f.onArmor = (from) => {
      if (from !== fight.player || fight.time - (this.armorSaid ?? -9) < 2.2) return;
      this.armorSaid = fight.time;
      fight.game.hud.pop('לא מזיז לו · מכה חזקה', 'block');
    };
  }

  get name() { return this.fighter.name; }
  // the moment before a punch: what a test bot (or a sharp player) reacts to
  get winding() { return this.mode === 'windup'; }

  update(dt, target, mayAttack) {
    const f = this.fighter, npc = this.npc, F = this.fight, cols = F.game.world.cols;
    this.against = target;     // whom he is going for (Nehorai or a friend), for the mission and the tests
    slide(f, npc, cols, dt);
    if (this.boss || this.phases.length) this.checkPhase();
    if (f.down || !target) { this.ring.visible = false; return; }
    if (f.floored) { // on the floor: whatever he was about to do is gone
      if (this.mode === 'windup' || this.mode === 'strike') { this.mode = 'circle'; F.release(this); }
      this.t = 0.5;
      npc.target = null;
      this.showRing();
      return;
    }
    this.t -= dt;
    const dx = target.pos.x - npc.pos.x, dz = target.pos.z - npc.pos.z, d = Math.hypot(dx, dz) || 1;
    const facing = Math.atan2(dx, dz);
    if (f.state === 'hit') { // a punch to the face interrupts a wind-up; after a shove he takes a breath before the next
      if (this.mode === 'windup') {
        const shoved = f.shoves !== this.shovesSeen;
        this.mode = 'circle'; this.t = shoved ? (this.boss ? 1.5 : 1.0) + Math.random() * 0.5 : 0.6; this.interrupted++; F.release(this);
      }
      this.shovesSeen = f.shoves;
      this.showRing();
      return;
    }
    this.cover(dt);
    switch (this.mode) {
      case 'approach':
        if (d > 1.8) npc.walkTo(target.pos.x, target.pos.z, { near: 1.6, run: d > 6 });
        else { npc.target = null; this.mode = 'circle'; this.t = 0.3 + Math.random() * 0.6; }
        break;
      case 'circle': { // keep a fighting distance and drift sideways until it is our turn
        npc.target = null;
        npc.yaw = dampAngle(npc.yaw, facing, 8, dt);
        if (d > 4) { this.mode = 'approach'; break; }
        const want = mayAttack ? 1.3 : 2.3, step = (d - want) * 1.8 * dt, drift = this.drill ? 0.15 : this.boss ? 0.3 : 0.55;
        npc.pos.x += (dx / d) * step + (-dz / d) * this.side * drift * dt;
        npc.pos.z += (dz / d) * step + (dx / d) * this.side * drift * dt;
        cols.resolve(npc.pos, 0.33, npc.pos.y, npc);
        if (Math.random() < dt * 0.4) this.side *= -1;
        if (mayAttack && this.t <= 0 && d < 1.9 && f.canAct()) {
          f.setBlock(false);
          this.mode = 'windup';
          this.move = this.moves[this.swings++ % this.moves.length];
          this.t = this.windupLeft = this.windupTime / this.aggression;
          npc.model.play(MOVES[this.move]?.windup || 'windup', { speed: 0.6 / this.t });
        }
        break;
      }
      case 'windup':
        npc.yaw = dampAngle(npc.yaw, facing, 5, dt);
        // closing in while he winds up, so the punch reaches someone who stands his ground
        if (d > 1.35) {
          const k = Math.min(d - 1.35, 1.6 * dt) / d;
          npc.pos.x += dx * k; npc.pos.z += dz * k;
          cols.resolve(npc.pos, 0.33, npc.pos.y, npc);
        }
        if (this.t <= 0) {
          this.mode = 'strike';
          f.state = 'idle';
          f.stamina = f.maxStamina;
          f.punch(this.move, F.targetsFor(this), { load: false, prefer: target });
          this.t = 0.42;
        }
        break;
      case 'strike':
        if (this.t <= 0) { // open after the punch: the counter window
          this.mode = 'recover';
          this.t = this.openTime;
          f.counter = this.openTime;
          F.release(this);
        }
        break;
      case 'recover':
        if (this.t <= 0) {
          this.mode = 'circle';
          this.t = (this.drill ? 1.1 : 0.7 + Math.random() * 1.1) / this.aggression;
        }
        break;
      default: break;
    }
    this.showRing();
  }

  // red while he winds up (closing in on his feet: when it meets them, the punch comes); yellow while
  // he is open (after his punch, or shoved); nothing otherwise
  showRing() {
    const f = this.fighter, r = this.ring, npc = this.npc;
    const red = this.mode === 'windup' && !f.floored, open = !red && f.counter > 0 && !f.floored && !f.down;
    r.visible = red || open;
    if (!r.visible) return;
    if (red !== this.ringRed) { this.ringRed = red; r.material.color.copy(red ? RED : OPEN); }
    r.scale.setScalar(this.ringScale * (red ? 1 + 0.7 * Math.max(0, this.t / this.windupLeft) : 1));
    r.position.set(npc.pos.x, npc.pos.y + 0.04, npc.pos.z);
  }

  // covering up: when Nehorai throws a punch at him from close, now and then (`guard`) he gets his
  // arms up in time; a light punch then lands on the block, a heavy one goes through it
  cover(dt) {
    const f = this.fighter, P = this.fight.player;
    if (this.guard > 0 && P && P.thrown !== this.seenThrow) {
      this.seenThrow = P.thrown;
      const near = Math.hypot(P.pos.x - this.npc.pos.x, P.pos.z - this.npc.pos.z) < 2.4;
      if (near && (this.mode === 'circle' || this.mode === 'approach') && f.canAct() && Math.random() < this.guard) { f.setBlock(true); this.blockT = 0.6; }
    }
    if (f.state === 'block' && (this.blockT -= dt) <= 0) f.setBlock(false);
  }

  // a boss passing one of his phases: down for a moment, up angrier (faster, harder, as the phase says)
  checkPhase() {
    const f = this.fighter, ph = this.phases[this.phase];
    if (!ph || f.down || f.hpFrac > ph.at) return;
    this.phase++;
    this.aggression = ph.aggression ?? this.aggression * 1.15;
    this.windupTime = ph.windup ?? this.windupTime * 0.88;
    if (ph.moves) this.moves = ph.moves;
    if (ph.power) f.power = ph.power;
    if (ph.armor !== undefined) f.armor = ph.armor;
    if (this.mode === 'windup' || this.mode === 'strike') { this.mode = 'circle'; this.fight.release(this); }
    if (!f.floored) f.floor(1.4);
    const F = this.fight;
    F.game.hud.pop(ph.pop ?? `${this.name} על הרצפה!`, 'counter');
    F.game.follow?.shake?.(0.12);
    F.onPhase?.(this, this.phase, ph);
  }

  settle() { settle(this.fighter, this.npc, this.fight.game.world.cols); }
  // on the floor when the fight stops: he gets up (nothing updates him any more, so he would lie there
  // through the scene after it, or snap upright)
  rise() {
    const f = this.fighter;
    if (!f.floored) return;
    const lying = f.state === 'floored';
    f.state = 'idle'; f.timer = 0;
    this.npc.model.setPose(null);
    if (lying) this.npc.model.play('getup', { speed: 1.25 });
  }

  dispose() { this.rise(); this.fight.game.scene.remove(this.ring); this.ring.material.dispose(); }
}

// a friend fighting alongside Nehorai: goes for the nearest opponent still standing, throws a jab or a
// cross every second or so, covers up when that opponent winds up at him. Down means he sits it out.
export class Ally {
  constructor(fight, npc, { hp = 80, power = 0.8, name = npc.spec.name.split(' ')[0] } = {}) {
    this.fight = fight;
    this.npc = npc;
    this.fighter = new Fighter({ pos: npc.pos, get yaw() { return npc.yaw; }, set yaw(v) { npc.yaw = v; }, model: npc.model }, { hp, power, name });
    this.fighter.floorable = false;
    this.t = 0.8 + Math.random() * 0.6;
    this.flip = false;
    npc.idle = null;
    npc.posed = false;
    npc.face = null;
    npc.target = null;
    npc.model.setPose('guard');
    this.fighter.onDown = () => { npc.target = null; };
  }

  update(dt) {
    const f = this.fighter, npc = this.npc, F = this.fight, cols = F.game.world.cols;
    f.update(dt);
    slide(f, npc, cols, dt);
    if (f.down || F.over) return;
    // the nearest one on his feet (one on the floor is left alone until he is up)
    let foe = null, bd = Infinity;
    for (const o of F.opponents) {
      if (o.fighter.down) continue;
      const d = Math.hypot(o.npc.pos.x - npc.pos.x, o.npc.pos.z - npc.pos.z) + (o.fighter.floored ? 50 : 0);
      if (d < bd) { bd = d; foe = o; }
    }
    if (!foe || f.state === 'hit') return;
    if (foe.fighter.floored) bd -= 50;
    const dx = foe.npc.pos.x - npc.pos.x, dz = foe.npc.pos.z - npc.pos.z;
    if (bd > 1.6) { npc.walkTo(foe.npc.pos.x, foe.npc.pos.z, { near: 1.4, run: bd > 5 }); return; }
    npc.target = null;
    npc.yaw = dampAngle(npc.yaw, Math.atan2(dx, dz), 8, dt);
    // covering up when the one in front of him winds up at him (one winding up at Nehorai is a chance)
    const atMe = foe.winding && (foe.against ?? f) === f && Math.hypot(foe.npc.pos.x - npc.pos.x, foe.npc.pos.z - npc.pos.z) < 2.2;
    f.setBlock(atMe);
    if (atMe || foe.fighter.floored) return;
    this.t -= dt;
    if (this.t <= 0 && f.canAct()) {
      this.flip = !this.flip;
      f.punch(this.flip ? 'jab' : 'cross', F.enemies);
      this.t = 0.9 + Math.random() * 0.9;
    }
  }

  settle() { settle(this.fighter, this.npc, this.fight.game.world.cols); }
}

export class Fight {
  // opponents: [{ npc, hp, power, moves, aggression, windup, open, name, guard, boss, armor, phases, ... }];
  // allies: friends fighting along ([{ npc, hp, power }]); safe: practice, Nehorai cannot be knocked down;
  // maxAttackers: how many opponents swing at once; onPhase(opponent, phase, def): a boss passed a phase;
  // moveset: 'full' (chapter nine's heavy punch, shove and jab-cross-finisher chain) or 'classic' (the
  // punch chain the earlier chapters teach, no heavy punch or shove). By default 'full' with no mission
  // running or in a chapter-nine mission, 'classic' in the missions of chapters 1-8 and the activities,
  // so their fights and texts stay as they were
  // special, openings, impact, finale: chapter ten's last fight (see the top of the file); off by default
  constructor(game, { opponents, allies = [], onWin, onLose, onPhase, maxAttackers = 1, safe = false, moveset, special = false, openings = false, impact = false, finale = false }) {
    game.fight?.dispose(); // the one before it hands Nehorai back first, so it cannot undo this one's settings
    const run = game.missions?.active?.def;
    this.full = (moveset ?? (!run || (run.chapter || 1) >= 9 ? 'full' : 'classic')) === 'full';
    this.game = game;
    this.onWin = onWin;
    this.onLose = onLose;
    this.onPhase = onPhase;
    this.maxAttackers = maxAttackers;
    this.player = game.fighter;
    this.player.revive();
    this.player.minHp = safe ? 25 : 0;
    this.player.floorable = false;   // Nehorai staggers, he is not floored (the stick stays his)
    this.player.onBreak = () => game.hud.pop('ההגנה נשברה', 'hit');
    this.opponents = opponents.map((o) => new Opponent(this, o.npc, o));
    this.allies = allies.map((a) => new Ally(this, a.npc, a));
    this.attackers = new Set();
    this.over = false;
    this.won = null;
    this.time = 0;
    this.combos = 0;       // finishers landed
    this.heavies = 0;      // heavy punches landed
    this.interrupts = 0;   // wind-ups stopped with a shove
    this.taken = this.player.taken;
    this.finishShow = 0;
    this.hudBoss = {}; this.hudFoe = {}; // filled in place each frame for the HUD (no garbage in the loop)
    this.opts = { special: !!(special || finale), openings: !!(openings || finale), impact: !!(impact || finale) };
    this.charge = 0;       // the special attack's meter, 0..1
    this.specials = 0;     // special attacks landed
    this.counters = 0;     // counters landed in a timed opening
    this.openingsShown = 0;
    this.opening = null;   // { o, t, window }: "now!" is on screen
    this.cine = null;      // the special's short film: { t, fov }
    this.dodgesSeen = this.player.dodges;
    if (this.opts.special && game.controls) game.controls.onSpecial = () => { const F = game.fight; if (F && !F.over && game.mode === 'foot' && !game.cutscene) F.special(); };
    if (this.opts.impact) {
      // harder reactions: every opponent's hurt is felt (after what the mission hung there, if anything)
      for (const o of this.opponents) { const f = o.fighter, was = f.onHurt; f.onHurt = (dealt, from, move, hit) => { was?.(dealt, from, move, hit); this.impact(o, from, hit); }; }
      const P = this.player; this.hurtWas = P.onHurt;
      P.onHurt = (dealt, from, move, hit) => { this.hurtWas?.(dealt, from, move, hit); if (hit?.heavy) { game.follow?.shake?.(0.3); game.hud.hurt?.(); } };
    }
    game.fight = this;
  }

  get standing() { return this.opponents.filter((o) => !o.fighter.down); }
  // whom an opponent can hit: Nehorai and any friend fighting along
  targetsFor() { return [this.player, ...this.allies.map((a) => a.fighter).filter(Boolean)]; }
  // whom Nehorai can hit
  get enemies() { return this.opponents.map((o) => o.fighter); }
  // the opponent about to punch, if any
  get threat() { return this.opponents.find((o) => o.winding) || null; }
  // the boss still standing, if any
  get boss() { return this.opponents.find((o) => o.boss && !o.fighter.down) || null; }
  // the combination so far: punches landed in a row (the next one after two is the finisher)
  get chain() { return this.full && this.game.has?.('combo') ? this.player.combo : 0; }

  release(o) { this.attackers.delete(o); }
  opponentOf(fighter) { return this.opponents.find((o) => o.fighter === fighter) || null; }

  // turn to the nearest one; once the move is under way, a short step in with it, so a combination (each
  // punch knocks him back a little) does not run out of reach. Walls and bodies still stop the step.
  aim(targets) { return this.player.faceNearest(targets, 3.2); }
  stepIn(t, max = 0.6) {
    const g = this.game, f = this.player;
    if (!t || t.bag || t.floored || g.dash) return;
    const dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z, d = Math.hypot(dx, dz), go = Math.min(max, d - 1.15);
    if (go > 0.05 && d < 2.6) g.dash = { x: dx / d, z: dz / d, t: go / 6.2 };
  }

  // ---------- chapter ten's last fight ----------
  // a landed hit fills the special's meter
  gain(k) {
    if (!this.opts.special || this.charge >= 1) return;
    this.charge = Math.min(1, this.charge + k);
    if (this.charge >= 1) this.game.hud.pop('מכה מיוחדת מוכנה!', 'counter');
  }
  // he staggers: "now!" for a moment (a punch pressed in it is a counter, see counter())
  openUp(o, window = OPENING) {
    if (!this.opts.openings || !o || o.fighter.down || o.fighter.floored || o.drill) return;
    this.opening = { o, t: window, window };
    this.openingsShown++;
  }
  // harder reactions to Nehorai's hits: a longer flash, sparks, a stronger shake, a blink of slow motion
  impact(o, from, hit) {
    if (from !== this.player) return;
    const g = this.game, big = !!(hit?.heavy || hit?.finisher), p = o.npc.pos;
    o.npc.model.flash(big ? 1.8 : 1.3);
    g.follow?.shake?.(big ? 0.28 : 0.1);
    g.energy?.sparks?.(p.x, p.y + 1.35, p.z, '#fff3d0', big ? 10 : 4, big ? 5 : 3);
    if (big && !hit.special) g.slowmo?.(0.3, 0.14);
  }
  // the punch pressed while "now!" is up: a straight right through his guard, counted double
  counter() {
    const g = this.game, f = this.player, op = this.opening;
    if (!op || this.over || !f.canAct()) return false;
    const t = op.o.fighter, dx = t.pos.x - f.pos.x, dz = t.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1;
    if (t.down || t.floored || d > 3.4) return false;
    this.opening = null;
    f.body.yaw = Math.atan2(dx, dz);
    const go = Math.min(1.5, d - 1.2);
    if (go > 0.05 && !g.dash) g.dash = { x: dx / d, z: dz / d, t: go / 6.2 };
    t.counter = Math.max(t.counter, 0.5); // caught open: it counts double
    return f.punch('counter', [t], {
      prefer: t,
      onLand: (hit, res) => {
        if (!hit || res === 'dodged' || res === 'none' || res === 'blocked') return;
        this.counters++;
        this.gain(GAIN.counter);
        f.combo = 0;
        g.follow?.shake?.(0.2);
        g.slowmo?.(0.35, 0.2);
        g.hud.pop(res === 'floored' ? 'מכת נגד! על הרצפה' : res === 'down' ? 'מכת נגד! נגמר' : 'מכת נגד!', 'counter');
      },
    });
  }
  // the special attack, once its meter is full: a short film of a hit. The camera pushes in, he loads and
  // drives an uppercut through any guard and armor, time slows as it lands, and the one hit is thrown back
  // and floored (or out, if that was the last of him). Nothing interrupts it. The meter is spent
  special() {
    const g = this.game, f = this.player;
    if (this.over || !this.opts.special) return false;
    if (this.charge < 1) { g.hud.pop('עוד לא טעון', 'block'); return false; }
    if (!f.canAct()) return false;
    const targets = this.enemies, t = this.aim(targets);
    const d = t ? Math.hypot(t.pos.x - f.pos.x, t.pos.z - f.pos.z) : Infinity;
    if (!t || t.floored || d > 4.2) { g.hud.pop(t?.floored ? 'כשהוא קם' : 'קרוב יותר', 'block'); return false; }
    const ok = f.punch('special', targets, {
      prefer: t, finisher: true,
      onLand: (hit, res) => {
        if (!hit || res === 'dodged' || res === 'none') { this.charge = 0.6; g.hud.pop('החטיא · נשאר מטען', 'block'); return; } // he was gone: most of the charge is kept
        this.specials++;
        g.slowmo?.(0.2, 0.55);
        g.follow?.shake?.(0.5);
        g.overlay?.flash?.('#ffffff', 240, 0.45);
        g.sound?.hit?.('crash', 0.9);
        g.energy?.sparks?.(hit.pos.x, hit.pos.y + 1.4, hit.pos.z, '#ffe9a8', 26, 8);
        g.hud.pop(res === 'down' ? 'מכה מיוחדת! נגמר' : 'מכה מיוחדת!', 'counter');
      },
    });
    if (!ok) return false;
    this.charge = 0;
    f.combo = 0;
    f.invulnerable = Math.max(f.invulnerable, 1.1);
    this.opening = null;
    const go = Math.min(2.6, d - 1.25);
    if (go > 0.05) g.dash = { x: (t.pos.x - f.pos.x) / d, z: (t.pos.z - f.pos.z) / d, t: go / 6.2 };
    if (g.camera) this.cine = { t: 0, fov: this.cine?.fov ?? g.camera.fov };
    return true;
  }
  // the camera's push for the special: in fast, held through the hit, out again (real seconds, not slowed)
  film(real) {
    const c = this.cine, cam = this.game.camera;
    if (!c) return;
    c.t += real;
    const k = c.t < 0.22 ? c.t / 0.22 : c.t < 0.85 ? 1 : Math.max(0, 1 - (c.t - 0.85) / 0.35), e = k * k * (3 - 2 * k);
    cam.fov = c.fov * (1 - 0.3 * e);
    cam.updateProjectionMatrix();
    if (c.t >= 1.2) this.endFilm();
  }
  endFilm() {
    const c = this.cine; if (!c) return;
    this.cine = null;
    this.game.camera.fov = c.fov;
    this.game.camera.updateProjectionMatrix();
  }

  // ---------- Nehorai's moves (the buttons call these through the game) ----------
  // a punch: jab, cross, and once the combination is learned, the third one landed in quick succession
  // is the finisher (a hook, or an uppercut once Hadar has shown it) that knocks the opponent back, and
  // down for a moment if he is low. A miss, a block or a hit taken starts the count again.
  punch() {
    const g = this.game, f = this.player;
    if (this.over || !f.canAct()) return false;
    if (this.opening && this.counter()) return true; // pressed in a timed opening: the counter
    const targets = g.targets ?? this.enemies, t = this.aim(targets);
    const finisher = !!g.has?.('combo') && f.combo >= 2;
    const name = finisher ? (g.has('uppercut') ? 'uppercut' : 'hook') : f.combo % 2 ? 'cross' : 'jab';
    const ok = f.punch(name, targets, {
      finisher, cost: finisher ? 14 : undefined,
      onLand: (t, res, open) => {
        if (!t) { f.combo = 0; return; }
        if (t.bag) return;
        if (res === 'blocked' || res === 'dodged' || res === 'none') { f.combo = 0; return; }
        g.follow?.shake?.(finisher ? 0.12 : 0.06);
        this.gain(finisher ? GAIN.finisher : res === 'armor' ? GAIN.armor : GAIN.light);
        if (finisher) {
          f.combo = 0; f.comboTimer = 0;
          this.combos++;
          this.finishShow = 0.9;
          if (res === 'hit' || res === 'broken') this.openUp(this.opponentOf(t));
          g.hud.pop(res === 'floored' ? 'קומבו! הוא על הרצפה' : res === 'down' ? 'קומבו! נגמר' : 'קומבו!', 'counter');
          return;
        }
        f.combo++; f.comboTimer = COMBO_WINDOW;
        if (open && res === 'hit') g.hud.pop('מכת נגד!', 'counter');
      },
    });
    if (ok) this.stepIn(t);
    return ok;
  }

  // the heavy punch: a slow start (a punch taken in it cancels it), more stamina, more damage, through a
  // block, a long stagger (even a boss's armor gives), and on the floor if he is low or caught open
  heavy() {
    const g = this.game, f = this.player;
    if (this.over || !this.full || !f.canAct()) return false;
    const targets = this.enemies, aimed = this.aim(targets);
    const ok = f.punch('heavy', targets, {
      onLand: (t, res, open) => {
        if (!t || res === 'dodged' || res === 'none') return;
        this.heavies++;
        g.follow?.shake?.(0.14);
        const o = this.opponentOf(t);
        this.gain(GAIN.heavy);
        if (res === 'hit' || res === 'broken') this.openUp(o);
        if (res === 'broken') g.hud.pop('שברת לו את ההגנה!', 'counter');
        else if (res === 'floored') g.hud.pop('על הרצפה!', 'counter');
        else if (open && res === 'hit') g.hud.pop('מכת נגד!', 'counter');
        else if (o?.boss && res === 'hit') g.hud.pop(`${o.name} מתנדנד!`, 'hit');
      },
    });
    if (ok) { f.combo = 0; this.stepIn(aimed, 0.7); } // a heavy punch ends a combination
    return ok;
  }

  // the shove: short range, a little stamina; pushes the nearest one back, stops his wind-up and leaves
  // his guard open for a moment (his ring turns yellow: the next punch counts double)
  shove() {
    const g = this.game, f = this.player;
    if (this.over || !this.full || !f.canAct()) return false;
    const targets = this.enemies, aimed = this.aim(targets);
    const ok = f.punch('shove', targets, {
      onLand: (t, res) => {
        if (res === 'braced') { g.hud.pop('הוא מוכן לזה · להתחמק', 'block'); return; }
        if (res !== 'shoved') return;
        const o = this.opponentOf(t);
        g.follow?.shake?.(0.04);
        this.gain(GAIN.shove);
        if (o?.mode === 'windup' || o?.mode === 'strike') { this.interrupts++; g.hud.pop('עצרת אותו!', 'counter'); this.openUp(o); }
        else g.hud.pop('דחיפה', 'hit');
      },
    });
    if (ok) this.stepIn(aimed, 0.3); // short range: half a step at most
    return ok;
  }

  update(dt) {
    if (this.over) return;
    this.time += dt;
    const P = this.player, real = dt / (this.game.slowScale || 1);
    if (this.cine) this.film(real);
    if (this.opts.openings) {
      // his swing dodged: an opening on the one who threw it
      if (P.dodges !== this.dodgesSeen) { this.dodgesSeen = P.dodges; const o = this.opponents.find((q) => q.mode === 'strike' || q.mode === 'recover'); if (o && !this.opening) this.openUp(o); }
      const op = this.opening;
      if (op && ((op.t -= real) <= 0 || op.o.fighter.down || op.o.fighter.floored)) this.opening = null;
    }
    if (this.full && P.taken !== this.taken) { this.taken = P.taken; P.combo = 0; P.comboTimer = 0; } // hit: the count starts again
    for (const o of this.opponents) {
      const f = o.fighter;
      f.update(dt);
      if (f.down) { this.attackers.delete(o); o.update(dt, null, false); continue; }
      if (f.floored) this.attackers.delete(o);
      // go for whoever is closest: Nehorai or a friend helping him
      let tgt = P, bd = Math.hypot(P.pos.x - o.npc.pos.x, P.pos.z - o.npc.pos.z);
      for (const a of this.allies) {
        if (!a.fighter || a.fighter.down) continue;
        const d = Math.hypot(a.fighter.pos.x - o.npc.pos.x, a.fighter.pos.z - o.npc.pos.z);
        if (d < bd - 1) { bd = d; tgt = a.fighter; }
      }
      if (!f.floored && !this.attackers.has(o) && this.attackers.size < this.maxAttackers && o.mode === 'circle' && o.t <= 0) this.attackers.add(o);
      o.update(dt, tgt, this.attackers.has(o));
    }
    for (const a of this.allies) a.update(dt);
    this.finishShow = Math.max(0, this.finishShow - dt);
    this.showHud();
    if (P.down) this.end(false);
    else if (!this.standing.length) this.end(true);
  }

  // the combination count, the one Nehorai faces and a boss's bar (the HUD only touches what changed;
  // every frame, so nothing is allocated here: the two records are filled in place)
  showHud() {
    const hud = this.game.hud;
    hud.setCombo?.(this.finishShow > 0 ? 3 : this.chain, this.finishShow > 0);
    let b = null;
    for (const o of this.opponents) if (o.boss && !o.fighter.down) { b = o; break; }
    if (b?.drill) b = null;
    if (b) { const B = this.hudBoss, f = b.fighter; B.name = b.name; B.frac = f.hpFrac; B.phase = b.phase; B.marks = b.marks; B.open = f.counter > 0; B.floored = f.floored; }
    hud.setBoss?.(b ? this.hudBoss : null);
    let foe = this.game.foe?.(6) ?? null;
    if (foe === b || foe?.drill) foe = null;
    if (foe) { const E = this.hudFoe, f = foe.fighter; E.name = foe.name; E.frac = f.hpFrac; E.open = f.counter > 0; E.floored = f.floored; }
    hud.setFoe?.(foe ? this.hudFoe : null);
    if (this.opts.special) hud.setSpecial?.(this.charge);
    if (this.opts.openings) hud.setOpening?.(this.opening ? this.opening.t / this.opening.window : null);
  }

  clearHud() {
    const hud = this.game.hud;
    if (this.opts.special) hud.setSpecial?.(null);
    if (this.opts.openings) hud.setOpening?.(null);
    this.opening = null;
    this.endFilm();
    hud.setCombo?.(0, false);
    hud.setBoss?.(null);
    hud.setFoe?.(null);
  }

  end(won) {
    this.over = true;
    this.won = won;
    // knock-backs played out, a man on the floor back on his feet: nothing updates them after this
    for (const o of this.opponents) { o.ring.visible = false; o.settle(); o.rise(); if (!o.fighter.down) o.npc.model.setPose(null); }
    for (const a of this.allies) { a.fighter.setBlock(false); a.settle(); if (!a.fighter.down) a.npc.model.setPose(null); }
    this.player.minHp = 0;
    this.clearHud();
    (won ? this.onWin : this.onLose)?.(this);
  }

  // take the rings away and hand the game back; opponents stay where they are (one on the floor gets up)
  dispose() {
    for (const o of this.opponents) o.dispose();
    this.player.minHp = 0;
    this.player.floorable = true;
    this.player.onBreak = null;
    if (this.opts.impact) this.player.onHurt = this.hurtWas ?? null;
    this.player.combo = this.player.comboTimer = 0;
    this.clearHud();
    if (this.game.fight === this) this.game.fight = null;
  }
}
