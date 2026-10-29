// Arcade fist fights: health, stamina, punches with a moment of impact, holding a block, a quick dodge
// with a moment of safety, staggering when hit, and going down out of the fight. No blood, no injuries
// shown: a hit is a white flash and a stagger. The same rules for Nehorai, friends and rivals.
import { clamp, angleDiff } from '../core/math.js';

export const MOVES = {
  jab: { cost: 10, damage: 8, reach: 1.45 },
  cross: { cost: 12, damage: 11, reach: 1.5 },
  hook: { cost: 18, damage: 16, reach: 1.35 },
  swing: { cost: 14, damage: 13, reach: 1.55 },
  bag: { cost: 6, damage: 5, reach: 1.45 },
};

export class Fighter {
  // body: { pos, get yaw(), set yaw(v), model } — the player or an Npc
  constructor(body, { hp = 100, stamina = 100, power = 1, name = '' } = {}) {
    this.body = body;
    this.name = name;
    this.maxHp = this.hp = hp;
    this.minHp = 0;          // above zero in practice: drills can sting but never knock anyone down
    this.maxStamina = this.stamina = stamina;
    this.power = power;
    this.state = 'idle';     // idle, attack, block, dodge, hit, down
    this.timer = 0;
    this.rest = 0;           // time since the last effort; stamina refills after a short rest
    this.invulnerable = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.counter = 0;        // a window in which this fighter takes extra damage (after a missed big swing)
    this.tired = 0;          // flashes the stamina bar when a move was refused
    this.blocks = 0; this.dodges = 0; this.landed = 0; this.taken = 0;
    this.onHurt = null;
    this.onDown = null;
    this.onDefend = null;    // a punch blocked or dodged: ('blocked' | 'dodged')
  }

  get down() { return this.state === 'down'; }
  get pos() { return this.body.pos; }

  update(dt) {
    this.timer = Math.max(0, this.timer - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.counter = Math.max(0, this.counter - dt);
    this.tired = Math.max(0, this.tired - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (!this.comboTimer) this.combo = 0;
    this.rest += dt;
    this.lastHurt = (this.lastHurt ?? 99) + dt;
    if (this.rest > 0.55 && this.state !== 'block' && !this.down) this.stamina = Math.min(this.maxStamina, this.stamina + 26 * dt);
    if ((this.state === 'attack' || this.state === 'hit' || this.state === 'dodge') && this.timer <= 0) this.state = 'idle';
  }

  spend(cost) {
    if (this.stamina < cost) { this.tired = 0.6; return false; }
    this.stamina -= cost;
    this.rest = 0;
    return true;
  }

  canAct() { return this.state === 'idle' || this.state === 'block'; }

  // throw a punch; `targets` are other fighters; returns false when too tired or busy
  punch(name, targets, { onLand } = {}) {
    if (!this.canAct()) return false;
    const mv = MOVES[name];
    if (!this.spend(mv.cost)) return false;
    this.state = 'attack';
    this.timer = 0.36;
    this.lastMove = name;
    this.body.model.play(name, {
      onHit: () => {
        const t = this.inReach(targets, mv.reach);
        if (!t) {
          // a punch that misses because its target stepped out of the way counts as dodged
          const quick = this.inReach(targets.filter((x) => x.invulnerable > 0 || x.state === 'dodge'), mv.reach + 2.2);
          if (quick) { quick.dodges++; quick.onDefend?.('dodged'); }
          onLand?.(null);
          return;
        }
        const open = t.counter > 0, res = t.takeHit(this, mv.damage * this.power, name);
        if (res === 'hit' || res === 'down') this.landed++;
        onLand?.(t, res, open);
      },
    });
    return true;
  }

  // the nearest standing fighter in front within reach (±65°)
  inReach(targets, reach) {
    let best = null, bd = Infinity;
    for (const t of targets) {
      if (t === this || t.down) continue;
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > reach + 0.35 || d > bd) continue;
      if (Math.abs(angleDiff(this.body.yaw, Math.atan2(dx, dz))) > 1.15) continue;
      best = t; bd = d;
    }
    return best;
  }

  // turn toward the nearest standing opponent within a few meters
  faceNearest(targets, range = 3.2) {
    let best = null, bd = range;
    for (const t of targets) {
      if (t === this || t.down) continue;
      const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
      if (d < bd) { bd = d; best = t; }
    }
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

  // being hit: a block soaks most of it (and costs stamina), a dodge avoids it, a counter doubles it
  takeHit(from, damage, move) {
    if (this.down) return 'none';
    if (this.invulnerable > 0) { this.dodges++; this.onDefend?.('dodged'); return 'dodged'; }
    const facing = Math.abs(angleDiff(this.body.yaw, Math.atan2(from.pos.x - this.pos.x, from.pos.z - this.pos.z))) < 1.4;
    if (this.state === 'block' && facing) {
      this.blocks++;
      this.stamina = Math.max(0, this.stamina - 9);
      this.rest = 0;
      this.hp = Math.max(1, this.hp - damage * 0.12);
      this.body.model.flash(0.35);
      if (this.stamina <= 0) this.setBlock(false); // guard broken
      this.onDefend?.('blocked');
      return 'blocked';
    }
    const dealt = damage * (this.counter > 0 ? 2 : 1);
    this.hp = Math.max(this.minHp, this.hp - dealt);
    this.lastHurt = 0;
    this.taken++;
    this.body.model.flash(1);
    this.onHurt?.(dealt, from, move);
    // knocked back a little, away from the punch
    const dx = this.pos.x - from.pos.x, dz = this.pos.z - from.pos.z, d = Math.hypot(dx, dz) || 1;
    this.knock = { x: (dx / d) * 0.45, z: (dz / d) * 0.45 };
    if (this.hp <= 0) { this.goDown(); return 'down'; }
    this.state = 'hit';
    this.timer = this.counter > 0 ? 0.6 : 0.34;
    this.body.model.play('hit');
    return 'hit';
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
    this.timer = this.counter = this.invulnerable = 0;
    this.knock = null;
    this.body.model.setPose('guard');
  }

  get hpFrac() { return clamp(this.hp / this.maxHp, 0, 1); }
  get staminaFrac() { return clamp(this.stamina / this.maxStamina, 0, 1); }
}
