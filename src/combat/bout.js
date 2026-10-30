// The boxing night (chapter three): bouts in rounds, by agreement, with gloves, a referee and a bell.
// A round runs on a clock; between rounds there is the corner, where one tip changes the next round;
// a fighter who goes down is out (no counts, no injuries shown), and a bout that goes the distance is
// decided by who has more left. The main event is Hadar's: he fights by himself, and Nehorai calls it
// from the corner, "חסום!" while Bulldozer winds up and "עכשיו!" while he is open after a punch.
import { Opponent } from './fight.js';
import { Fighter } from './fighter.js';
import { dampAngle } from '../core/math.js';

export const ROUND = 40; // seconds a round lasts

// a shot of two people from the side, low in the frame (the corner's panel goes over the top), from
// whichever side is farther from `away` (the crowd)
export function twoShot(game, a, b, away, { dist = 3.6, height = 2.0 } = {}) {
  const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  let px = -dz / l, pz = dx / l;
  if (Math.hypot(mx + px * dist - away.x, mz + pz * dist - away.z) < Math.hypot(mx - px * dist - away.x, mz - pz * dist - away.z)) { px = -px; pz = -pz; }
  const y = game.world.groundHeight(mx, mz);
  game.follow.shot({ x: mx + px * dist, y: y + height, z: mz + pz * dist }, { x: mx, y: y + 2.4, z: mz }, 9999);
}

// a fighter's health at the end of a round, partly back after a minute in the corner
export function rest(f, share) { f.hp = Math.min(f.maxHp, f.hp + f.maxHp * share); f.stamina = f.maxStamina; }

// Hadar against Bulldozer, Nehorai outside the ropes. Hadar: covers up for some of Bulldozer's punches
// by himself (`guard`), takes some of his openings with an uppercut (`sharp`), and works the jab in
// between (`jabEvery` seconds). Told to, he covers up every time, or goes in every time.
export class MainEvent {
  constructor(game, { red, blue }) {
    this.game = game;
    this.redNpc = red.npc;
    const npc = red.npc;
    this.hadar = new Fighter({ pos: npc.pos, get yaw() { return npc.yaw; }, set yaw(v) { npc.yaw = v; }, model: npc.model }, { hp: red.hp, power: red.power, name: red.name });
    // guard: share of punches he covers up for by himself; sharp: share of openings he takes by himself;
    // jabEvery: seconds between his jabs; jab: how hard they land; counter: how hard his uppercut lands
    this.stats = { guard: red.guard, sharp: red.sharp, jabEvery: red.jabEvery, jab: red.jab, counter: red.counter };
    this.base = red.power;
    npc.idle = null; npc.posed = false; npc.face = null; npc.target = null;
    npc.model.setPose('guard');
    this.hadar.onDown = () => { npc.target = null; };
    this.opp = new Opponent(this, blue.npc, blue); // the same opponent as in Nehorai's own fights
    this.t = 1;
    this.told = null;       // what Nehorai called and Hadar has yet to do: 'block' or 'counter'
    this.calls = { block: 0, counter: 0 };
    this.over = false;
    this.won = null;
    this.paused = false;    // between rounds: both in their corners
  }

  // what the opponent may hit, and what an opening means: as in a Fight, with Hadar the only target
  targetsFor() { return [this.hadar]; }
  release() {}
  get bulldozer() { return this.opp.fighter; }

  // the call Nehorai can make right now, if any
  get call() {
    const o = this.opp;
    if (this.over || this.paused || this.hadar.down || o.fighter.down) return null;
    if (o.mode === 'windup' && this.told !== 'block') return 'block';
    if (o.mode === 'recover' && o.fighter.counter > 0.1 && this.told !== 'counter' && this.went !== o.swings) return 'counter';
    return null;
  }

  shout(kind) {
    if (kind !== this.call) return false;
    this.told = kind;
    this.calls[kind]++;
    return true;
  }

  update(dt) {
    if (this.over) return;
    const h = this.hadar, o = this.opp, b = o.fighter, npc = this.redNpc, cols = this.game.world.cols;
    h.update(dt);
    b.update(dt);
    if (h.knock) { npc.pos.x += h.knock.x; npc.pos.z += h.knock.z; cols.resolve(npc.pos, 0.33, npc.pos.y, npc); h.knock = null; }
    if (this.paused) { if (b.knock) b.knock = null; o.ring.visible = false; return; }
    o.update(dt, h.down ? null : h, true); // Bulldozer goes for Hadar whenever he can
    if (h.down) { this.end(false); return; }
    if (b.down) { this.end(true); return; }
    const dx = o.npc.pos.x - npc.pos.x, dz = o.npc.pos.z - npc.pos.z, d = Math.hypot(dx, dz) || 1;
    npc.target = null;
    npc.yaw = dampAngle(npc.yaw, Math.atan2(dx, dz), 8, dt);
    if (h.state === 'hit') return;
    // Bulldozer winding up or swinging: cover up (sometimes by himself, always when told)
    if (o.mode === 'windup' || o.mode === 'strike') {
      if (this.seen !== o.swings) { this.seen = o.swings; this.cover = Math.random() < this.stats.guard; }
      h.setBlock(this.cover || this.told === 'block');
      return;
    }
    if (h.state === 'block') h.setBlock(false);
    if (this.told === 'block') this.told = null;
    // Bulldozer open after a punch: in with an uppercut (sometimes by himself, at once when told)
    if (o.mode === 'recover' && b.counter > 0) {
      if (this.seenOpen !== o.swings) { this.seenOpen = o.swings; this.take = Math.random() < this.stats.sharp; }
      if ((this.take || this.told === 'counter') && this.went !== o.swings && h.canAct() && d < 1.9) {
        this.went = o.swings;
        const called = this.told === 'counter';
        this.told = null;
        h.power = this.base * this.stats.counter; // read when the punch lands
        h.punch('uppercut', [b], {
          onLand: (t, res) => { if (t && res !== 'blocked') { this.game.hud.pop(called ? 'עכשיו! אפרקאט!' : 'אפרקאט!', 'counter'); this.game.follow.shake(0.05); } },
        });
        return;
      }
    } else if (this.told === 'counter') this.told = null; // the opening closed
    // in between: a boxing distance, and the jab
    const want = 1.25, step = (d - want) * 1.6 * dt;
    npc.pos.x += (dx / d) * step; npc.pos.z += (dz / d) * step;
    cols.resolve(npc.pos, 0.33, npc.pos.y, npc);
    this.t -= dt;
    if (this.t <= 0 && h.canAct() && d < 1.75) {
      this.flip = !this.flip;
      h.power = this.base * this.stats.jab;
      h.punch(this.flip ? 'jab' : 'cross', [b]);
      this.t = this.stats.jabEvery * (0.75 + Math.random() * 0.5);
    }
  }

  end(won) {
    this.over = true;
    this.won = won;
    this.opp.ring.visible = false;
    this.hadar.setBlock(false);
    for (const f of [this.hadar, this.bulldozer]) if (!f.down) f.body.model.setPose(null);
  }

  // the bell between rounds: guards down, both back to their corners
  pause(on) {
    this.paused = on;
    this.told = null;
    this.hadar.setBlock(false);
    this.opp.mode = 'circle';
    this.opp.t = 1;
    this.opp.ring.visible = false;
  }

  dispose() { this.opp.dispose(); }
}
