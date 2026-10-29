// A fight: Nehorai (and friends who help) against one or more opponents. Opponents take turns: a red
// ring and a wind-up warn before each punch, and after a punch the opponent is open for a moment
// (yellow ring) and takes double damage. Beaten opponents sit down, out of the fight. No blood: hits
// are a white flash and a stagger. The same machinery runs practice drills, where nobody goes down.
import * as THREE from 'three';
import { Fighter } from './fighter.js';
import { dampAngle } from '../core/math.js';

const ringGeo = new THREE.RingGeometry(0.5, 0.72, 32).rotateX(-Math.PI / 2);
const RED = '#e2574c', OPEN = '#ffd23f';

// an opponent: an Npc driven by a small state machine (approach, circle, windup, strike, recover)
export class Opponent {
  constructor(fight, npc, { hp = 70, power = 1, aggression = 1, moves = ['swing', 'cross'], windup = 0.62, name = npc.spec.name.split(' ')[0], drill = false } = {}) {
    this.fight = fight;
    this.npc = npc;
    this.moves = moves;
    this.windupTime = windup;
    this.aggression = aggression;
    this.drill = drill;        // a coach throwing punches on purpose: never goes down, keeps a steady rhythm
    this.fighter = new Fighter({ pos: npc.pos, get yaw() { return npc.yaw; }, set yaw(v) { npc.yaw = v; }, model: npc.model }, { hp, power, name });
    if (drill) this.fighter.minHp = hp;
    this.mode = 'approach';
    this.t = 0.6;
    this.side = Math.random() < 0.5 ? 1 : -1;
    this.swings = 0;
    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.visible = false;
    this.ring.renderOrder = 2;
    fight.game.scene.add(this.ring);
    npc.idle = null;
    npc.posed = false;
    npc.face = null;
    npc.target = null;
    npc.model.setPose('guard');
    this.fighter.onDown = () => { this.mode = 'out'; this.ring.visible = false; npc.target = null; };
  }

  get name() { return this.fighter.name; }
  // the moment before a punch: what a test bot (or a sharp player) reacts to
  get winding() { return this.mode === 'windup'; }

  update(dt, target, mayAttack) {
    const f = this.fighter, npc = this.npc, F = this.fight, cols = F.game.world.cols;
    if (f.knock) { npc.pos.x += f.knock.x; npc.pos.z += f.knock.z; cols.resolve(npc.pos, 0.33, npc.pos.y, npc); f.knock = null; }
    if (f.down || !target) { this.ring.visible = false; return; }
    this.t -= dt;
    const dx = target.pos.x - npc.pos.x, dz = target.pos.z - npc.pos.z, d = Math.hypot(dx, dz) || 1;
    const facing = Math.atan2(dx, dz);
    if (f.state === 'hit') { // a punch to the face interrupts a wind-up
      if (this.mode === 'windup') { this.mode = 'circle'; this.t = 0.6; F.release(this); }
      this.ring.visible = false;
      return;
    }
    switch (this.mode) {
      case 'approach':
        if (d > 1.8) npc.walkTo(target.pos.x, target.pos.z, { near: 1.6, run: d > 6 });
        else { npc.target = null; this.mode = 'circle'; this.t = 0.3 + Math.random() * 0.6; }
        break;
      case 'circle': { // keep a fighting distance and drift sideways until it is our turn
        npc.target = null;
        npc.yaw = dampAngle(npc.yaw, facing, 8, dt);
        if (d > 4) { this.mode = 'approach'; break; }
        const want = mayAttack ? 1.3 : 2.3, step = (d - want) * 1.8 * dt, drift = this.drill ? 0.15 : 0.55;
        npc.pos.x += (dx / d) * step + (-dz / d) * this.side * drift * dt;
        npc.pos.z += (dz / d) * step + (dx / d) * this.side * drift * dt;
        cols.resolve(npc.pos, 0.33, npc.pos.y, npc);
        if (Math.random() < dt * 0.4) this.side *= -1;
        if (mayAttack && this.t <= 0 && d < 1.9 && f.canAct()) {
          this.mode = 'windup';
          this.move = this.moves[this.swings++ % this.moves.length];
          this.t = this.windupLeft = this.windupTime / this.aggression;
          npc.model.play('windup', { speed: 0.6 / this.t });
          this.ring.material.color.set(RED);
          this.ring.visible = true;
        }
        break;
      }
      case 'windup':
        npc.yaw = dampAngle(npc.yaw, facing, 5, dt);
        // the red ring closes in: when it meets the feet, the punch comes
        this.ring.scale.setScalar(1 + 0.7 * Math.max(0, this.t / this.windupLeft));
        if (this.t <= 0) {
          this.mode = 'strike';
          this.ring.visible = false;
          f.state = 'idle';
          f.stamina = f.maxStamina;
          f.punch(this.move, F.targetsFor(this));
          this.t = 0.42;
        }
        break;
      case 'strike':
        if (this.t <= 0) { // open after the punch: the counter window
          this.mode = 'recover';
          this.t = 0.8;
          f.counter = 0.8;
          this.ring.material.color.set(OPEN);
          this.ring.scale.setScalar(1);
          this.ring.visible = true;
          F.release(this);
        }
        break;
      case 'recover':
        if (this.t <= 0) {
          this.mode = 'circle';
          this.t = (this.drill ? 1.1 : 0.7 + Math.random() * 1.1) / this.aggression;
          this.ring.visible = false;
        }
        break;
      default: break;
    }
    this.ring.position.set(npc.pos.x, npc.pos.y + 0.04, npc.pos.z);
  }

  dispose() { this.fight.game.scene.remove(this.ring); this.ring.material.dispose(); }
}

// a friend fighting alongside Nehorai: goes for the nearest opponent still standing, throws a jab or a
// cross every second or so, covers up when that opponent winds up at him. Down means he sits it out.
export class Ally {
  constructor(fight, npc, { hp = 80, power = 0.8, name = npc.spec.name.split(' ')[0] } = {}) {
    this.fight = fight;
    this.npc = npc;
    this.fighter = new Fighter({ pos: npc.pos, get yaw() { return npc.yaw; }, set yaw(v) { npc.yaw = v; }, model: npc.model }, { hp, power, name });
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
    if (f.knock) { npc.pos.x += f.knock.x; npc.pos.z += f.knock.z; cols.resolve(npc.pos, 0.33, npc.pos.y, npc); f.knock = null; }
    if (f.down || F.over) return;
    let foe = null, bd = Infinity;
    for (const o of F.opponents) {
      if (o.fighter.down) continue;
      const d = Math.hypot(o.npc.pos.x - npc.pos.x, o.npc.pos.z - npc.pos.z);
      if (d < bd) { bd = d; foe = o; }
    }
    if (!foe || f.state === 'hit') return;
    const dx = foe.npc.pos.x - npc.pos.x, dz = foe.npc.pos.z - npc.pos.z;
    if (bd > 1.6) { npc.walkTo(foe.npc.pos.x, foe.npc.pos.z, { near: 1.4, run: bd > 5 }); return; }
    npc.target = null;
    npc.yaw = dampAngle(npc.yaw, Math.atan2(dx, dz), 8, dt);
    // covering up when the one in front of him winds up at him
    const atMe = foe.winding && Math.hypot(foe.npc.pos.x - npc.pos.x, foe.npc.pos.z - npc.pos.z) < 2.2;
    f.setBlock(atMe);
    if (atMe) return;
    this.t -= dt;
    if (this.t <= 0 && f.canAct()) {
      this.flip = !this.flip;
      f.punch(this.flip ? 'jab' : 'cross', F.enemies);
      this.t = 0.9 + Math.random() * 0.9;
    }
  }
}

export class Fight {
  // opponents: [{ npc, hp, power, moves, ... }]; allies: friends fighting along ({ fighter } each);
  // safe: practice, Nehorai cannot be knocked down; maxAttackers: how many opponents swing at once
  constructor(game, { opponents, allies = [], onWin, onLose, maxAttackers = 1, safe = false }) {
    // allies: [{ npc, hp, power }] — friends fighting along
    this.game = game;
    this.onWin = onWin;
    this.onLose = onLose;
    this.maxAttackers = maxAttackers;
    this.player = game.fighter;
    this.player.revive();
    this.player.minHp = safe ? 25 : 0;
    this.opponents = opponents.map((o) => new Opponent(this, o.npc, o));
    this.allies = allies.map((a) => new Ally(this, a.npc, a));
    this.attackers = new Set();
    this.over = false;
    this.won = null;
    this.time = 0;
    game.fight?.dispose();
    game.fight = this;
  }

  get standing() { return this.opponents.filter((o) => !o.fighter.down); }
  // whom an opponent can hit: Nehorai and any friend fighting along
  targetsFor() { return [this.player, ...this.allies.map((a) => a.fighter).filter(Boolean)]; }
  // whom Nehorai can hit
  get enemies() { return this.opponents.map((o) => o.fighter); }
  // the opponent about to punch, if any
  get threat() { return this.opponents.find((o) => o.winding) || null; }

  release(o) { this.attackers.delete(o); }

  update(dt) {
    if (this.over) return;
    this.time += dt;
    for (const o of this.opponents) {
      o.fighter.update(dt);
      if (o.fighter.down) { this.attackers.delete(o); o.update(dt, null, false); continue; }
      // go for whoever is closest: Nehorai or a friend helping him
      let tgt = this.player, bd = Math.hypot(this.player.pos.x - o.npc.pos.x, this.player.pos.z - o.npc.pos.z);
      for (const a of this.allies) {
        if (!a.fighter || a.fighter.down) continue;
        const d = Math.hypot(a.fighter.pos.x - o.npc.pos.x, a.fighter.pos.z - o.npc.pos.z);
        if (d < bd - 1) { bd = d; tgt = a.fighter; }
      }
      if (!this.attackers.has(o) && this.attackers.size < this.maxAttackers && o.mode === 'circle' && o.t <= 0) this.attackers.add(o);
      o.update(dt, tgt, this.attackers.has(o));
    }
    for (const a of this.allies) a.update(dt);
    if (this.player.down) this.end(false);
    else if (!this.standing.length) this.end(true);
  }

  end(won) {
    this.over = true;
    this.won = won;
    for (const o of this.opponents) { o.ring.visible = false; if (!o.fighter.down) o.npc.model.setPose(null); }
    for (const a of this.allies) { a.fighter.setBlock(false); if (!a.fighter.down) a.npc.model.setPose(null); }
    this.player.minHp = 0;
    (won ? this.onWin : this.onLose)?.(this);
  }

  // take the rings away and hand the game back; opponents stay where they are
  dispose() {
    for (const o of this.opponents) o.dispose();
    this.player.minHp = 0;
    if (this.game.fight === this) this.game.fight = null;
  }
}
