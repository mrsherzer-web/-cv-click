// Arcade fist fights: health, stamina, punches with a moment of impact, holding a block, a quick dodge
// with a moment of safety, staggering when hit, and going down out of the fight. No blood, no injuries
// shown: a hit is a white flash and a stagger. The same rules for Nehorai, friends and rivals.
// Chapter nine adds the heavy punch (a slow start, breaks a block, a long stagger), the shove (pushes,
// stops a wind-up, opens the guard), knockdowns (on the floor for a moment, then up again) and armor
// (a big man shrugs off light punches).
import { clamp, angleDiff } from '../core/math.js';

// cost: stamina; damage: before the fighter's power; reach: meters; time: how long the fighter is busy
// (0.36 s when not given); heavy: a big hit (breaks a block, a long stagger, can put a low opponent on the
// floor); load: an action played before the strike (the slow start: a hit in that moment cancels it);
// windup: the action an opponent winds up with before this move; shove: pushes and opens, hardly hurts
export const MOVES = {
  jab: { cost: 10, damage: 8, reach: 1.45 },
  cross: { cost: 12, damage: 11, reach: 1.5 },
  hook: { cost: 18, damage: 16, reach: 1.35 },
  uppercut: { cost: 22, damage: 20, reach: 1.4 }, // close range, but it has to reach a bag from where its collider lets you stand
  swing: { cost: 14, damage: 13, reach: 1.55 },
  bag: { cost: 6, damage: 5, reach: 1.45 },
  heavy: { cost: 26, damage: 21, reach: 1.55, time: 0.78, load: 'heavyload', heavy: true },
  shove: { cost: 8, damage: 2, reach: 1.3, time: 0.42, shove: true },
  slam: { cost: 20, damage: 22, reach: 1.75, time: 0.6, heavy: true, windup: 'bigwindup' },
};

export const FINISH = 1.25;     // a combination's finisher hits this much harder than the same punch alone
export const KNOCKDOWN_AT = 0.4; // a big hit on someone at or under this share of his health puts him on the floor

// every landed, blocked or dodged punch is reported here (the game plays a sound for it)
export const fightEvents = { onHit: null };

export class Fighter {
  // body: { pos, get yaw(), set yaw(v), model } — the player or an Npc
  constructor(body, { hp = 100, stamina = 100, power = 1, name = '' } = {}) {
    this.body = body;
    this.name = name;
    this.maxHp = this.hp = hp;
    this.minHp = 0;          // above zero in practice: drills can sting but never knock anyone down
    this.maxStamina = this.stamina = stamina;
    this.power = power;
    this.state = 'idle';     // idle, attack, block, dodge, hit, floored, rising, down
    this.timer = 0;
    this.rest = 0;           // time since the last effort; stamina refills after a short rest
    this.invulnerable = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.counter = 0;        // a window in which this fighter takes extra damage (after a missed big swing, or shoved)
    this.tired = 0;          // flashes the stamina bar when a move was refused
    this.armor = 0;          // 0..1: the share of a light punch he shrugs off (a light punch never staggers him)
    this.floorable = true;   // a big hit can put him on the floor for a moment
    this.knockdownAt = KNOCKDOWN_AT;
    this.floorCool = 0;      // just back on his feet: not straight down again
    this.braced = 0;         // armor and just shoved: ready for the next shove (it does not stop him)
    this.blocks = 0; this.dodges = 0; this.landed = 0; this.taken = 0;
    this.thrown = 0; this.floors = 0; this.shoves = 0; this.breaks = 0; this.shrugged = 0;
    this.onHurt = null;
    this.onDown = null;
    this.onDefend = null;    // a punch blocked or dodged: ('blocked' | 'dodged')
    this.onBreak = null;     // his block broken by a heavy punch
    this.onArmor = null;     // a light punch shrugged off: (from)
    this.onFloor = null;     // knocked down for a moment
    this.onRise = null;      // back up from the floor
  }

  get down() { return this.state === 'down'; }
  // on the floor for a moment, or getting up: out of reach, but still in the fight
  get floored() { return this.state === 'floored' || this.state === 'rising'; }
  get pos() { return this.body.pos; }

  update(dt) {
    this.timer = Math.max(0, this.timer - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.counter = Math.max(0, this.counter - dt);
    this.tired = Math.max(0, this.tired - dt);
    this.floorCool = Math.max(0, this.floorCool - dt);
    this.braced = Math.max(0, this.braced - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (!this.comboTimer) this.combo = 0;
    this.rest += dt;
    this.lastHurt = (this.lastHurt ?? 99) + dt;
    if (this.rest > 0.55 && this.state !== 'block' && !this.down && !this.floored) this.stamina = Math.min(this.maxStamina, this.stamina + 26 * dt);
    if ((this.state === 'attack' || this.state === 'hit' || this.state === 'dodge') && this.timer <= 0) this.state = 'idle';
    else if (this.state === 'floored' && this.timer <= 0) { // up again: a moment nobody can hit him
      this.state = 'rising';
      this.timer = this.invulnerable = 0.8;
      this.body.model.setPose('guard');
      this.body.model.play('getup', { speed: 1.25 });
      this.onRise?.();
    } else if (this.state === 'rising' && this.timer <= 0) this.state = 'idle';
  }

  spend(cost) {
    if (this.stamina < cost) { this.tired = 0.6; return false; }
    this.stamina -= cost;
    this.rest = 0;
    return true;
  }

  canAct() { return this.state === 'idle' || this.state === 'block'; }

  // throw a punch; `targets` are other fighters; returns false when too tired or busy. finisher: the end
  // of a combination (harder, knocks back); cost: instead of the move's own; load: false skips the slow
  // start (an opponent's wind-up already was one); prefer: the one he swung at, hit if still in reach
  punch(name, targets, { onLand, finisher = false, cost, load = true, prefer = null } = {}) {
    if (!this.canAct()) return false;
    const mv = MOVES[name];
    if (!this.spend(cost ?? mv.cost)) return false;
    this.state = 'attack';
    this.timer = mv.time ?? 0.36;
    this.lastMove = name;
    this.thrown++;
    const strike = () => this.body.model.play(name, { onHit: () => this.land(name, mv, targets, finisher, onLand, prefer) });
    // a hit taken in the slow start replaces it with a stagger: the punch never comes
    if (load && mv.load) this.body.model.play(mv.load, { onDone: strike });
    else strike();
    return true;
  }

  land(name, mv, targets, finisher, onLand, prefer = null) {
    const t = (prefer && this.inReach([prefer], mv.reach)) || this.inReach(targets, mv.reach);
    if (!t) {
      // a punch that misses because its target stepped out of the way counts as dodged
      const quick = this.inReach(targets.filter((x) => !x.floored && (x.invulnerable > 0 || x.state === 'dodge')), mv.reach + 2.2);
      if (quick) { quick.dodges++; quick.onDefend?.('dodged'); }
      onLand?.(null);
      return;
    }
    const open = t.counter > 0;
    const res = t.takeHit(this, mv.damage * this.power * (finisher ? FINISH : 1), name, { heavy: !!mv.heavy, finisher, shove: !!mv.shove });
    if (res === 'hit' || res === 'down' || res === 'floored' || res === 'broken' || res === 'armor') this.landed++;
    onLand?.(t, res, open);
  }

  // the nearest standing fighter in front within reach (±65°); one on the floor is out of reach
  inReach(targets, reach) {
    let best = null, bd = Infinity;
    for (const t of targets) {
      if (t === this || t.down || t.floored) continue;
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > reach + 0.35 || d > bd) continue;
      if (Math.abs(angleDiff(this.body.yaw, Math.atan2(dx, dz))) > 1.15) continue;
      best = t; bd = d;
    }
    return best;
  }

  // turn toward the nearest standing opponent within a few meters; one on the floor only when nobody
  // else is in range (turning to him would turn the guard away from the one really attacking)
  faceNearest(targets, range = 3.2) {
    let best = null, bd = range, low = null, ld = range;
    for (const t of targets) {
      if (t === this || t.down) continue;
      const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
      if (t.floored) { if (d < ld) { ld = d; low = t; } } else if (d < bd) { bd = d; best = t; }
    }
    best = best || low;
    if (best) this.body.yaw = Math.atan2(best.pos.x - this.pos.x, best.pos.z - this.pos.z);
    return best;
  }

  setBlock(on) {
    if (on && this.canAct() && this.stamina > 0) { this.state = 'block'; this.body.model.setPose('block'); }
    else if (!on && this.state === 'block') { this.state = 'idle'; this.body.model.setPose('guard'); }
  }

  dodge() {
    if (!this.canAct() || !this.spend(18)) return false;
    this.state = 'dodge';
    this.timer = 0.45;
    this.invulnerable = 0.45;   // generous on purpose: a thumb on glass is not a gamepad
    this.body.model.play('dodge');
    return true;
  }

  // being hit: a block soaks most of it (and costs stamina) unless the hit is a big one, which breaks it;
  // a dodge avoids it; a counter doubles it; armor shrugs off a light punch. hit: { heavy, finisher, shove }.
  // Returns 'hit', 'broken' (through a block), 'armor', 'floored', 'down', 'shoved', 'braced', 'blocked',
  // 'dodged' or 'none'.
  takeHit(from, damage, move, hit = {}) {
    if (this.down || this.state === 'floored') return 'none';
    if (this.invulnerable > 0) { this.dodges++; this.onDefend?.('dodged'); fightEvents.onHit?.('dodged'); return 'dodged'; }
    const dx = this.pos.x - from.pos.x, dz = this.pos.z - from.pos.z, d = Math.hypot(dx, dz) || 1;
    if (hit.shove) return this.shoved(from, dx / d, dz / d, damage);
    const big = !!(hit.heavy || hit.finisher);
    const facing = Math.abs(angleDiff(this.body.yaw, Math.atan2(from.pos.x - this.pos.x, from.pos.z - this.pos.z))) < 1.4;
    let broken = false;
    if (this.state === 'block' && facing) {
      if (!big) {
        this.blocks++;
        this.stamina = Math.max(0, this.stamina - 9);
        this.rest = 0;
        this.hp = Math.max(1, this.hp - damage * 0.12);
        this.body.model.flash(0.35);
        if (this.stamina <= 0) this.setBlock(false); // guard broken
        this.onDefend?.('blocked');
        fightEvents.onHit?.('blocked');
        return 'blocked';
      }
      // a heavy punch goes through the guard: the arms knocked apart, most of it lands
      broken = true;
      this.breaks++;
      this.stamina = Math.max(0, this.stamina - 25);
      this.rest = 0;
      this.state = 'idle';
      this.body.model.setPose('guard');
      damage *= 0.6;
      this.onBreak?.(from);
    }
    // armor: a light punch does a little and moves nothing (his swing goes on); the last blow is a big one
    if (this.armor > 0 && !big) {
      const dealt = damage * (1 - this.armor) * (this.counter > 0 ? 2 : 1);
      this.hp = Math.max(this.minHp, 1, this.hp - dealt);
      this.lastHurt = 0;
      this.shrugged++;
      this.body.model.flash(0.4);
      fightEvents.onHit?.('blocked');
      this.onHurt?.(dealt, from, move, hit);
      this.onArmor?.(from);
      return 'armor';
    }
    const counter = this.counter > 0, dealt = damage * (counter ? 2 : 1);
    this.hp = Math.max(this.minHp, this.hp - dealt);
    this.lastHurt = 0;
    this.taken++;
    this.body.model.flash(1);
    fightEvents.onHit?.(counter || big ? 'counter' : 'hit');
    this.onHurt?.(dealt, from, move, hit);
    // knocked back, away from the punch: a little, or a lot for a big one (a big man half as far)
    const push = (hit.finisher ? 1.3 : big ? 0.9 : 0.45) * (this.armor ? 0.5 : 1);
    this.knock = { x: (dx / d) * push, z: (dz / d) * push };
    if (this.hp <= 0) { this.goDown(); return 'down'; }
    // a big hit on a man who is low, or a heavy one caught open, puts him on the floor for a moment
    if (big && this.floorable && this.floorCool <= 0 && (this.hpFrac <= this.knockdownAt || (counter && hit.heavy && !this.armor))) {
      this.floor();
      return 'floored';
    }
    this.state = 'hit';
    this.timer = big ? (this.armor ? 0.65 : 0.8) : counter ? 0.6 : 0.34;
    this.body.model.play(big ? 'reel' : 'hit');
    return broken ? 'broken' : 'hit';
  }

  // shoved: a step back, whatever he was winding up is gone, his guard open for a moment. A big man
  // (armor) braces after one: a second shove within a few seconds only rocks him ('braced')
  shoved(from, nx, nz, damage = 0) {
    if (this.armor > 0 && this.braced > 0) {
      this.knock = { x: nx * 0.2, z: nz * 0.2 };
      this.body.model.flash(0.25);
      fightEvents.onHit?.('blocked');
      return 'braced';
    }
    if (this.armor > 0) this.braced = 3.5;
    const push = this.armor ? 0.55 : 1.15;
    this.knock = { x: nx * push, z: nz * push };
    this.hp = Math.max(this.minHp, 1, this.hp - damage);
    this.shoves++;
    this.counter = Math.max(this.counter, 0.8);
    this.state = 'hit';
    this.timer = 0.45;
    this.body.model.setPose('guard');
    this.body.model.play('hit');
    this.body.model.flash(0.35);
    fightEvents.onHit?.('blocked');
    return 'shoved';
  }

  // on the floor for a moment; he gets up by himself (see update)
  floor(seconds = 1.5) {
    this.state = 'floored';
    this.timer = seconds;
    this.floorCool = seconds + 4;
    this.floors++;
    this.counter = 0;
    this.combo = 0;
    this.body.model.setPose('floored');
    this.body.model.play('hit');
    this.onFloor?.();
  }

  goDown() {
    this.state = 'down';
    this.hp = 0;
    this.body.model.setPose('down');
    this.onDown?.();
  }

  // back on the feet with full strength (after a sparring round or a retry)
  revive() {
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.state = 'idle';
    this.timer = this.counter = this.invulnerable = this.floorCool = this.braced = 0;
    this.combo = this.comboTimer = 0;
    this.knock = null;
    this.body.model.setPose('guard');
  }

  get hpFrac() { return clamp(this.hp / this.maxHp, 0, 1); }
  get staminaFrac() { return clamp(this.stamina / this.maxStamina, 0, 1); }
}
