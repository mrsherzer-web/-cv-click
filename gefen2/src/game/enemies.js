// ============================================================================
//  Gefen, Ido and Dolev.  Each has two brains:
//   - office: FNAF style hops between named spots (roll 1..20 against a level)
//   - fp:     continuous movement on the nav grid while the player walks
//  Plus Follower for allies that walk behind the player.
// ============================================================================
import { AI, FP } from '../config.js';
import { SPOTS, VENTS, floorY, roomAt } from '../world/layout.js';
import { audio } from '../engine/audio.js';

const rnd = Math.random;
const roll = (level) => 1 + Math.floor(rnd() * 20) <= level;

class Mover {
  constructor(S, id, actor) {
    this.S = S;
    this.id = id;
    this.actor = actor;
    this.x = 0;
    this.z = 0;
    this.mode = 'off';
    this.path = null;
    this.pathT = 0;
    this.goal = [0, 0];
  }

  get nav() {
    return this.S.world.nav;
  }

  placeAt(x, z, room = null, y = null) {
    this.x = x;
    this.z = z;
    this.actor.place(x, z, room, y);
    this.path = null;
  }

  placeSpot(key) {
    const s = SPOTS[key];
    if (!s) throw new Error('unknown spot ' + key);
    this.spot = key;
    const vent = s[3] === 'ventL' || s[3] === 'ventR';
    this.placeAt(s[0], s[1], s[3], vent ? VENTS[s[3]].y0 : null);
    return s;
  }

  /** Walk towards a point. Returns true when there. */
  goTo(tx, tz, speed, dt, arrive = 0.35) {
    const d = Math.hypot(tx - this.x, tz - this.z);
    if (d < arrive) {
      this.actor.moving = false;
      return true;
    }
    this.pathT -= dt;
    if (!this.path || this.pathT <= 0 || Math.hypot(tx - this.goal[0], tz - this.goal[1]) > 1.2) {
      this.goal = [tx, tz];
      this.path = this.nav.path(this.x, this.z, tx, tz) || [[tx, tz]];
      this.pathT = 0.45 + rnd() * 0.25;
    }
    let step = speed * dt;
    while (step > 0 && this.path.length) {
      const [px, pz] = this.path[0];
      const dd = Math.hypot(px - this.x, pz - this.z);
      if (dd <= step) {
        this.x = px;
        this.z = pz;
        step -= dd;
        this.path.shift();
      } else {
        this.x += ((px - this.x) / dd) * step;
        this.z += ((pz - this.z) / dd) * step;
        step = 0;
      }
    }
    this.actor.moving = speed > 0.3;
    this.actor.place(this.x, this.z, roomAt(this.x, this.z), floorY(this.x, this.z));
    return false;
  }

  off() {
    this.mode = 'off';
    this.actor.show(false);
    this.actor.moving = false;
  }

  /** Stand somewhere under script control (camera events, cut scenes). */
  script(spotOrXZ, pose = null) {
    this.mode = 'script';
    if (typeof spotOrXZ === 'string') this.placeSpot(spotOrXZ);
    else this.placeAt(spotOrXZ[0], spotOrXZ[1]);
    if (pose) this.actor.setPose(pose);
    this.actor.show(true);
    this.actor.moving = false;
  }

  playerDist() {
    return Math.hypot(this.S.player.x - this.x, this.S.player.z - this.z);
  }
}

// ================================================================ Gefen
export class Gefen extends Mover {
  static ST = ['g_hall_a', 'g_hall_b', 'g_hall_c', 'g_corr_far', 'g_corr_mid', 'g_corr_near', 'g_front'];

  startOffice(level, { idx = 0 } = {}) {
    this.mode = 'office';
    this.level = level;
    this.idx = idx;
    this.tickT = AI.gefen.tick * (0.6 + rnd() * 0.6);
    this.lightT = 0;
    this.cool = 0;
    this.frontT = 0;
    this.actor.setPose(this.final ? 'final' : 'idle');
    this.placeSpot(Gefen.ST[idx]);
    this.actor.show(true);
    this.actor.jitter = 1;
  }

  updateOffice(dt) {
    const S = this.S;
    const P = S.player;
    const n = S.night;
    const inCorr = this.idx >= 3;
    const lit = inCorr && P.lights(this.x, this.actor.y + 1.3, this.z, 28);
    this.lit = lit;
    this.actor.uniforms.twitch.value = lit ? 1.6 : this.idx >= 5 ? 0.7 : 0.2;
    const need = AI.gefen.lightTime[n] * (this.final ? 1.25 : 1) * (S.G.dev.bot ? 0.9 : 1);
    if (lit) {
      this.lightT += dt;
      if (this.lightT >= need) return this.retreat();
    } else this.lightT = Math.max(0, this.lightT - dt * 0.5);
    if (this.idx === 6) {
      if (!lit) this.frontT -= dt;
      S.threat = Math.max(S.threat, 1 - this.frontT / AI.gefen.frontDelay[n]);
      if (this.frontT <= 0) S.kill('gefen');
      return;
    }
    this.cool -= dt;
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = AI.gefen.tick * (0.8 + rnd() * 0.4) * (this.final ? 0.8 : 1);
      if (!lit && this.cool <= 0 && !this.hold && roll(this.level)) this.advance();
    }
  }

  advance() {
    const S = this.S;
    const from = SPOTS[Gefen.ST[this.idx]][3];
    this.idx = Math.min(6, this.idx + 1);
    const s = this.placeSpot(Gefen.ST[this.idx]);
    S.camGlitch(from);
    S.camGlitch(s[3]);
    const near = this.idx / 6;
    if (this.idx >= 3) audio.footsteps(0, 3, 0.16 + near * 0.5, 0.36);
    if (this.idx === 5) audio.laugh(0.45, 0, 80);
    if (this.idx === 6) {
      this.frontT = AI.gefen.frontDelay[S.night];
      audio.sting(0.45);
    }
    S.emit('move', { who: 'gefen', idx: this.idx, spot: Gefen.ST[this.idx] });
  }

  retreat() {
    const S = this.S;
    const was = this.idx;
    this.idx = was >= 5 ? 3 - (rnd() < 0.5 ? 1 : 0) : Math.max(0, was - 2 - (rnd() < 0.4 ? 1 : 0));
    if (this.final) this.idx = Math.max(this.idx, 2);
    this.placeSpot(Gefen.ST[this.idx]);
    this.lightT = 0;
    this.cool = (this.final ? 1.5 : 3) + rnd() * 3;
    this.tickT = AI.gefen.tick;
    audio.hiss?.(0.5);
    audio.running(0, 0.9, 0.35);
    S.G.gfx.fx.glitch = Math.max(S.G.gfx.fx.glitch, 0.5);
    S.emit('repel', { who: 'gefen', from: was });
  }

  // ---------------------------------------------------------- first person
  startFP(x, z, { patrol = null, state = 'patrol' } = {}) {
    this.mode = 'fp';
    this.cfg = this.final ? FP.gefenFinal : FP.gefen;
    this.placeAt(x, z);
    this.patrol = patrol || [[x, z]];
    this.pi = 0;
    this.state = state;
    this.loseT = 0;
    this.litT = 0;
    this.stunCd = 0;
    this.waitT = 0;
    this.lastSeen = [x, z];
    this.speedMul = 1;
    this.actor.setPose(this.final ? 'final' : 'idle');
    this.actor.show(true);
    this.actor.jitter = 1;
  }

  updateFP(dt) {
    const S = this.S;
    const P = S.player;
    const cfg = this.cfg;
    const d = this.playerDist();
    if (this.hold) {
      this.actor.moving = false;
      return;
    }
    this.dazeT = Math.max(0, (this.dazeT || 0) - dt);
    const daze = this.dazeT > 0 ? 0.55 : 1;
    const range = P.flash.on ? cfg.seeLit : cfg.see;
    const canSee = !S.playerSafe && d < range && this.nav.los(this.x, this.z, P.x, P.z) && Math.abs(P.y - this.actor.y) < 1.6;
    this.stunCd -= dt;
    if (this.state !== 'stunned' && this.stunCd <= 0 && d < 9 && P.lights(this.x, this.actor.y + 1.4, this.z, 9)) {
      this.litT += dt;
      if (this.litT > 0.45) {
        this.state = 'stunned';
        this.stunT = cfg.stun;
        this.stunCd = cfg.stunCooldown;
        this.litT = 0;
        P.flash.battery = Math.max(0, P.flash.battery - (cfg.stunCost || 0));
        audio.hiss?.(0.6);
        S.emit('stun', { who: 'gefen' });
      }
    } else this.litT = Math.max(0, this.litT - dt);
    this.actor.uniforms.twitch.value = this.state === 'stunned' ? 2 : this.state === 'chase' ? 0.9 : 0.25;
    this.actor.setPose(this.final ? 'final' : this.state === 'chase' && this.actor.sheet.reach ? 'reach' : 'idle');
    switch (this.state) {
      case 'stunned':
        this.actor.moving = false;
        this.stunT -= dt;
        if (this.stunT <= 0) {
          this.state = canSee ? 'chase' : 'search';
          this.dazeT = cfg.daze || 0;
          this.loseT = cfg.lose;
        }
        break;
      case 'wait':
        this.actor.moving = false;
        if (canSee && !this.passive) this.spotPlayer();
        break;
      case 'patrol': {
        const [tx, tz] = this.patrol[this.pi % this.patrol.length];
        if (this.goTo(tx, tz, cfg.patrol * this.speedMul, dt, 0.5)) {
          this.waitT += dt;
          if (this.waitT > 1.6) {
            this.waitT = 0;
            this.pi++;
          }
        }
        if (canSee && !this.passive) this.spotPlayer();
        break;
      }
      case 'goto': {
        if (this.goTo(this.target[0], this.target[1], (this.gotoSpeed || cfg.patrol) * this.speedMul, dt, 0.5)) {
          this.state = this.afterGoto || 'wait';
          S.emit('arrived', { who: 'gefen' });
        }
        if (canSee && !this.passive) this.spotPlayer();
        break;
      }
      case 'chase':
        if (canSee) {
          this.lastSeen = [P.x, P.z];
          this.loseT = cfg.lose;
        } else this.loseT -= dt;
        this.goTo(this.lastSeen[0], this.lastSeen[1], cfg.chase * this.speedMul * daze, dt, 0.2);
        if (this.loseT <= 0) {
          this.state = 'search';
          S.emit('chase', { who: 'gefen', on: false });
        }
        break;
      case 'search':
        if (canSee && !this.passive) this.spotPlayer();
        else if (this.goTo(this.lastSeen[0], this.lastSeen[1], cfg.patrol * 1.4, dt, 0.6)) {
          this.waitT += dt;
          if (this.waitT > 2.2) {
            this.waitT = 0;
            this.state = 'patrol';
          }
        }
        break;
    }
    if (d < 7 && this.state === 'chase') S.threat = Math.max(S.threat, 1 - d / 7);
    if (d < cfg.catch && this.state !== 'stunned' && !this.passive && !S.playerSafe && this.nav.los(this.x, this.z, P.x, P.z)) {
      if (this.noMercy) S.kill('fp_gefen');
      else S.grab('fp_gefen', this);
    }
  }

  spotPlayer() {
    if (this.state === 'chase') return;
    this.state = 'chase';
    this.loseT = this.cfg.lose;
    this.lastSeen = [this.S.player.x, this.S.player.z];
    audio.sting(0.5);
    audio.laugh(0.5, this.S.pan(this.x, this.z), 78);
    this.S.emit('chase', { who: 'gefen', on: true });
  }

  sendTo(x, z, speed = null, after = 'wait') {
    this.state = 'goto';
    this.target = [x, z];
    this.gotoSpeed = speed;
    this.afterGoto = after;
  }

  hear(x, z) {
    if (this.mode !== 'fp' || this.state === 'chase' || this.state === 'stunned') return;
    this.lastSeen = [x, z];
    this.state = 'search';
    this.waitT = 0;
  }

  update(dt) {
    if (this.mode === 'office') this.updateOffice(dt);
    else if (this.mode === 'fp') this.updateFP(dt);
  }
}

// ================================================================ Ido
export class Ido extends Mover {
  route(side) {
    const v = side < 0 ? 'ventL' : 'ventR';
    return ['i_home', 'i_hall', side < 0 ? 'i_storage' : 'i_lobby', `i_${v}_far`, `i_${v}_mid`, `i_${v}_mouth`];
  }

  startOffice(level) {
    this.mode = 'office';
    this.level = level;
    this.idx = 0;
    this.side = rnd() < 0.5 ? -1 : 1;
    this.ST = this.route(this.side);
    this.tickT = AI.ido.tick * (1 + rnd());
    this.mouthT = 0;
    this.fooledT = 0;
    this.pose(0);
    this.placeSpot(this.ST[0]);
    this.actor.show(true);
    this.actor.flicker = 0.3;
  }

  pose(idx) {
    this.actor.setPose(idx >= 3 && this.actor.sheet.crawl ? 'crawl' : 'idle');
  }

  updateOffice(dt) {
    const S = this.S;
    const P = S.player;
    const n = S.night;
    if (this.idx === 5) {
      const masked = P.mask.on && P.mask.amt > 0.75;
      this.actor.uniforms.twitch.value = masked ? 0.3 : 1.2;
      if (masked) {
        this.fooledT += dt;
        if (this.fooledT >= AI.ido.maskHold) this.leave();
      } else {
        this.fooledT = Math.max(0, this.fooledT - dt * 2);
        this.mouthT -= dt;
        S.threat = Math.max(S.threat, 1 - this.mouthT / AI.ido.mouthDelay[n]);
        if (this.mouthT <= 0) S.kill('ido');
      }
      return;
    }
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = AI.ido.tick * (0.75 + rnd() * 0.5);
      if (!this.hold && roll(this.level)) this.advance();
    }
  }

  advance() {
    const S = this.S;
    if (this.idx === 0) {
      this.side = rnd() < 0.68 ? -this.side : this.side;
      this.ST = this.route(this.side);
    }
    const from = SPOTS[this.ST[this.idx]][3];
    this.idx++;
    this.pose(this.idx);
    const s = this.placeSpot(this.ST[this.idx]);
    S.camGlitch(from);
    S.camGlitch(s[3]);
    if (this.idx >= 3) {
      const vol = [0, 0, 0, 0.3, 0.42, 0.6][this.idx];
      audio.ventThump?.(this.side * 0.85, vol);
    }
    if (this.idx === 5) {
      this.mouthT = AI.ido.mouthDelay[S.night];
      this.fooledT = 0;
    }
    S.emit('move', { who: 'ido', idx: this.idx, side: this.side, spot: this.ST[this.idx] });
  }

  leave() {
    const S = this.S;
    audio.ventThump?.(this.side * 0.85, 0.35);
    audio.whoosh(false, 0.15, 0.5);
    this.idx = 0;
    this.pose(0);
    this.placeSpot(this.ST[0]);
    this.tickT = AI.ido.tick * (1.6 + rnd());
    S.emit('repel', { who: 'ido' });
  }

  // ---------------------------------------------------------- first person
  startFP(x, z) {
    this.mode = 'fp';
    this.placeAt(x, z);
    this.actor.setPose('idle');
    this.actor.show(true);
    this.watched = false;
    this.lostT = 0;
    this.awayT = 0;
    this.graceT = 1.2;
  }

  updateFP(dt) {
    const S = this.S;
    const P = S.player;
    const cfg = FP.ido;
    const d = this.playerDist();
    this.graceT -= dt;
    // gone for a while after the mask fooled him
    if (this.awayT > 0) {
      this.awayT -= dt;
      if (this.awayT <= 0) this.comeBack();
      return;
    }
    if (P.mask.on && P.mask.amt > 0.7 && d < cfg.sense) {
      // he cannot tell you apart: stands confused, then leaves
      this.lostT += dt;
      this.actor.moving = false;
      this.actor.uniforms.twitch.value = 0.25;
      this.actor.flicker = 1;
      if (this.lostT >= cfg.maskTime) {
        this.lostT = 0;
        this.awayT = cfg.away[0] + rnd() * (cfg.away[1] - cfg.away[0]);
        this.actor.show(false);
        audio.whoosh(false, 0.12, 0.5);
        S.emit('repel', { who: 'ido' });
      }
      return;
    }
    this.lostT = Math.max(0, this.lostT - dt);
    const los = this.nav.los(this.x, this.z, P.x, P.z);
    const watched = los && P.sees(this.x, this.z, 0.66, 24) && (P.fl.on || d < 7.5);
    this.watched = watched;
    this.actor.uniforms.twitch.value = watched ? 1.5 : 0;
    this.actor.flicker = watched ? 0.8 : 0.2;
    // while Gefen himself is chasing, Ido only watches: never two killers at once
    const yields = S.enemies.gefen.mode === 'fp' && S.enemies.gefen.state === 'chase';
    if (watched || this.graceT > 0 || S.playerSafe || this.hold || yields) {
      this.actor.moving = false;
      if (yields) this.graceT = Math.max(this.graceT, 1.5);
    } else if (d < cfg.sense) {
      this.goTo(P.x, P.z, cfg.speed, dt, 0.3);
    }
    if (d < 6) S.threat = Math.max(S.threat, (1 - d / 6) * 0.8);
    if (d < cfg.catch && !watched && this.graceT <= 0 && !S.playerSafe && !this.hold && los) S.grab('fp_ido', this);
  }

  /** Reappear somewhere far from the player and out of sight. */
  comeBack() {
    const P = this.S.player;
    const spots = [[14.4, -28.3], [-13, -27], [-5, -17], [5, -9], [-6, -8.5], [0, -30], [-4.5, -39.5], [4.6, -16.8]];
    let best = spots[0];
    let bd = -1;
    for (const s of spots) {
      const d = Math.hypot(s[0] - P.x, s[1] - P.z);
      if (d < 11 || this.nav.los(s[0], s[1], P.x, P.z)) continue;
      const score = -Math.abs(d - 16) + rnd() * 4;
      if (bd === -1 || score > bd) {
        bd = score;
        best = s;
      }
    }
    this.placeAt(...this.nav.nearest(best[0], best[1]));
    this.actor.show(true);
    this.graceT = 1.5;
  }

  update(dt) {
    if (this.mode === 'office') this.updateOffice(dt);
    else if (this.mode === 'fp') this.updateFP(dt);
  }
}

// ================================================================ Dolev
export class Dolev extends Mover {
  static ST = ['d_home', 'd_door', 'd_corr_far', 'd_corr_mid', 'd_corr_near', 'd_front'];

  startOffice(level) {
    this.mode = 'office';
    this.level = level;
    this.idx = 0;
    this.sabT = AI.dolev.tick * (0.8 + rnd() * 0.8);
    this.advT = AI.dolev.advance[this.S.night];
    this.retT = AI.dolev.retreat;
    this.frontT = 0;
    this.actor.setPose('idle');
    this.placeSpot(Dolev.ST[0]);
    this.actor.show(true);
    this.actor.flicker = 0.5;
  }

  updateOffice(dt) {
    const S = this.S;
    const O = S.office;
    const n = S.night;
    if (O.power <= 0) {
      // nothing to feed on: he goes home and sleeps
      if (this.idx > 0) {
        this.retT -= dt;
        if (this.retT <= 0) {
          this.retT = 4;
          this.idx--;
          this.placeSpot(Dolev.ST[this.idx]);
        }
      }
      return;
    }
    if (this.idx === 5) {
      O.interference = 1;
      if (O.killT > 0) return this.leave();
      this.frontT -= dt;
      S.threat = Math.max(S.threat, 1 - this.frontT / AI.dolev.frontDelay[n]);
      if (this.frontT <= 0) S.kill('dolev');
      return;
    }
    O.interference = Math.max(O.interference, this.idx >= 4 ? 0.45 : 0);
    this.sabT -= dt;
    if (this.sabT <= 0) {
      this.sabT = AI.dolev.tick * (0.75 + rnd() * 0.5);
      if (!O.anyBroken() && !this.hold && roll(this.level)) O.sabotage(rnd() < 0.55 ? 'cams' : 'power');
    }
    const busy = O.anyBroken() || O.rebooting;
    if (busy && !this.hold) {
      this.advT -= dt;
      if (this.advT <= 0) {
        this.advT = AI.dolev.advance[n];
        this.advance();
      }
    } else {
      this.retT -= dt;
      if (this.retT <= 0) {
        this.retT = AI.dolev.retreat;
        if (this.idx > 0) {
          this.idx--;
          const s = this.placeSpot(Dolev.ST[this.idx]);
          S.camGlitch(s[3]);
        }
      }
    }
  }

  advance() {
    const S = this.S;
    const from = SPOTS[Dolev.ST[this.idx]][3];
    this.idx = Math.min(5, this.idx + 1);
    const s = this.placeSpot(Dolev.ST[this.idx]);
    S.camGlitch(from);
    S.camGlitch(s[3]);
    audio.zap?.(0.25, 0.12 + this.idx * 0.09);
    if (this.idx === 5) {
      this.frontT = AI.dolev.frontDelay[S.night];
      audio.sting(0.4);
    }
    S.emit('move', { who: 'dolev', idx: this.idx, spot: Dolev.ST[this.idx] });
  }

  /** The audio lure pulls him back two stations. */
  lure() {
    if (this.mode !== 'office' || this.idx === 0) return false;
    this.idx = Math.max(0, this.idx - 2);
    const s = this.placeSpot(Dolev.ST[this.idx]);
    this.S.camGlitch(s[3]);
    this.advT = AI.dolev.advance[this.S.night];
    this.S.emit('repel', { who: 'dolev', lure: true });
    return true;
  }

  leave() {
    this.idx = 0;
    this.placeSpot(Dolev.ST[0]);
    this.sabT = AI.dolev.tick * 1.5;
    this.advT = AI.dolev.advance[this.S.night];
    audio.zap?.(0.2, 0.3);
    this.S.emit('repel', { who: 'dolev' });
  }

  // ---------------------------------------------------------- first person
  startFP(x, z, { patrol = null } = {}) {
    this.mode = 'fp';
    this.placeAt(x, z);
    this.patrol = patrol || [[x, z]];
    this.pi = 0;
    this.noise = null;
    this.tinkerT = 0;
    this.waitT = 0;
    this.actor.setPose('idle');
    this.actor.show(true);
    this.actor.flicker = 0.5;
  }

  /** Something made a noise (thrown ball, generator, the player running). */
  hear(x, z, strength = 1) {
    if (this.mode !== 'fp') return;
    if (Math.hypot(x - this.x, z - this.z) > FP.dolev.hear * (0.6 + strength)) return;
    this.noise = { x, z, t: 9, strong: strength >= 1 };
  }

  updateFP(dt) {
    const S = this.S;
    const P = S.player;
    const cfg = FP.dolev;
    const d = this.playerDist();
    const los = this.nav.los(this.x, this.z, P.x, P.z);
    if (d < cfg.drain && los && P.flash.on) {
      P.flash.drainMul = 4;
      P.flash.flick = 0.7;
    }
    const yields = S.enemies.gefen.mode === 'fp' && S.enemies.gefen.state === 'chase';
    if (!yields) {
      if (P.noise > 0.7 && d < cfg.hear && !(this.noise && this.noise.strong)) this.noise = { x: P.x, z: P.z, t: 3, strong: false };
      if (P.flash.on && los && d < 9 && !(this.noise && this.noise.strong)) this.noise = { x: P.x, z: P.z, t: 2, strong: false };
    } else if (this.noise && !this.noise.strong) this.noise = null;
    this.actor.uniforms.twitch.value = this.tinkerT > 0 ? 0.8 : 0.2;
    if (this.hold || S.playerSafe) {
      this.actor.moving = false;
    } else if (this.tinkerT > 0) {
      this.tinkerT -= dt;
      this.actor.moving = false;
    } else if (this.noise) {
      this.noise.t -= dt;
      const close = d < 2.5 && los && !this.noise.strong;
      const sp = close ? cfg.lunge : cfg.speed;
      if (this.goTo(this.noise.x, this.noise.z, sp, dt, 0.6)) {
        if (this.noise.strong) this.tinkerT = 5.5;
        this.noise = null;
      } else if (this.noise.t <= 0) this.noise = null;
    } else {
      const [tx, tz] = this.patrol[this.pi % this.patrol.length];
      if (this.goTo(tx, tz, cfg.speed * 0.7, dt, 0.6)) {
        this.waitT += dt;
        if (this.waitT > 2.5) {
          this.waitT = 0;
          this.pi++;
        }
      }
    }
    if (d < 6) S.threat = Math.max(S.threat, (1 - d / 6) * 0.7);
    // on his way to a loud noise he only grabs you if you walk right into him
    const reach = this.noise && this.noise.strong ? 0.55 : cfg.catch;
    if (d < reach && los && !this.hold && !S.playerSafe && this.tinkerT <= 0) S.grab('fp_dolev', this);
  }

  update(dt) {
    if (this.mode === 'office') this.updateOffice(dt);
    else if (this.mode === 'fp') this.updateFP(dt);
  }
}

// ================================================================ allies
export class Follower extends Mover {
  constructor(S, id, actor) {
    super(S, id, actor);
    this.state = 'ok';
    this.hurtCd = 0;
  }

  startFollow(x, z) {
    this.mode = 'follow';
    this.actor.setPose('idle');
    this.placeAt(x, z);
    this.actor.show(true);
  }

  /** Run to a point on his own (rescue sequence). */
  runTo(x, z, speed = 3.6) {
    this.mode = 'run';
    this.actor.setPose('idle');
    this.target = [x, z];
    this.runSpeed = speed;
    this.actor.show(true);
  }

  update(dt) {
    const S = this.S;
    if (this.mode === 'follow') {
      const P = S.player;
      const d = this.playerDist();
      const max = this.state === 'hurt' ? 2.2 : 3.6;
      if (d > 1.9) this.goTo(P.x, P.z, Math.min(max, 1.4 + d * 0.8), dt, 1.5);
      else this.actor.moving = false;
      this.hurtCd -= dt;
      for (const e of S.fpEnemies()) {
        if (e.mode !== 'fp' || e.hold) continue;
        if (Math.hypot(e.x - this.x, e.z - this.z) < 1.25 && this.hurtCd <= 0) {
          this.hurtCd = 8;
          if (this.state !== 'hurt') {
            this.state = 'hurt';
            S.emit('hurt', { who: this.id });
          }
          audio.bang(S.pan(this.x, this.z), 0.7);
          if (e.id === 'gefen') {
            e.state = 'stunned';
            e.stunT = 3.5;
          } else if (e.id === 'ido') e.graceT = 4;
          else e.tinkerT = 4;
        }
      }
    } else if (this.mode === 'run') {
      if (this.goTo(this.target[0], this.target[1], this.runSpeed, dt, 0.4)) {
        this.mode = 'idle';
        S.emit('arrived', { who: this.id });
      }
    }
  }
}
