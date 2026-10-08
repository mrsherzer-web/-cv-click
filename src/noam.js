// Noam Amiram — the threat. Sleeps (with a wake-up meter driven by noise / light / proximity),
// then patrols, hears noises, sees you (worse in the dark, better if your flashlight is on),
// chases, searches hiding spots, opens doors, and catches you.
import * as THREE from 'three';
import { audio } from './audio.js';
import { clamp, damp, rand, pick, angleDiff, dist2 } from './util.js';

const TAUNTS = {
  spot: ['מצאתי אותך...', 'אתה לא אמור להיות ער.', 'בוא... בוא לשחק איתי פיפא.', 'למה אתה בורח ממני?', 'ראיתי אותך.'],
  search: ['אני שומע אותך נושם...', 'איפה אתה מתחבא...?', 'כולם ישנים. רק אתה ער.', 'זאת הקומונה שלי עכשיו.', 'צא צא... איפה שאתה לא...'],
  lost: ['...אני אמצא אותך.', 'הלילה עוד ארוך.', 'אתה לא יכול להתחבא לנצח.'],
  wake: ['מי. העיר. אותי.', 'מי... שם...?'],
};

export class Noam {
  constructor(game, model) {
    this.game = game;
    this.model = model;
    this.root = model.root;
    game.scene.add(this.root);
    this.pos = new THREE.Vector3(8.6, 0, 14);
    this.yaw = 0;
    this.state = 'off';
    this.disturbance = 0;
    this.patrolSpeed = 1.45;
    this.chaseSpeed = 3.6;
    this.canReturnToBed = true;
    this.path = null; this.pathI = 0;
    this.suspicion = 0;
    this.lastKnown = new THREE.Vector3();
    this.timer = 0;
    this.repath = 0;
    this.stepDist = 0;
    this.lostT = 0;
    this.lookAroundT = 0;
    this.doorWait = 0;
    this.speed = 0;
    this.mode = 'walk';
    this.searchSpots = [];
    this.tauntCd = 0;
    this.headYaw = 0;
    this.visible = true;
    this.em = null;
    this.waypoints = [
      [9.3, 14.8], [11.5, 12.5], [10.6, 9.9], [6.5, 9.9], [16.5, 9.9], [19.0, 9.9], [5.3, 13.5],
      [15.3, 13.0], [1.5, 11.5], [8.5, 6.5], [7.5, 2.0], [11.5, 4.5], [16.8, 6.5], [17.0, 2.6],
      [2.4, 6.5], [3.6, 7.6], [2.0, 2.0], [2.5, -2.5], [9.0, -4.0], [15.0, -3.0],
    ];
    game.world.onNoise((x, z, r, kind) => this.onNoise(x, z, r, kind));
  }

  get active() { return ['patrol', 'investigate', 'chase', 'search', 'returnBed', 'tv'].includes(this.state); }
  get awake() { return this.state !== 'sleep' && this.state !== 'off'; }

  ensureEmitter() {
    if (!this.em && audio.ready) this.em = audio.emitter(this.pos.x, 1.6, this.pos.z, { ref: 1.4, max: 35 });
  }

  show(v) { this.visible = v; this.root.visible = v; }

  teleport(x, z, yaw = this.yaw) {
    this.pos.set(x, 0, z); this.yaw = yaw; this.path = null;
    this._applyTransform();
  }

  setSleeping(onBed = true) {
    this.state = 'sleep';
    this.disturbance = 0;
    this.model.setPossessed(false);
    const b = this.game.world.noamBed;
    if (onBed) { this.pos.set(b.x, 0, b.z); this.yaw = 0; }
    this.show(true);
    this.ensureEmitter();
    if (this.em) audio.snoreLoop(this.em.input);
    this._stirT = 0;
  }

  stopSnore() { audio.stopLoop('snore', 0.2); }

  // story/script control
  setScripted(on) { this.state = on ? 'script' : this.state; if (on) { this.path = null; this.speed = 0; } }

  walkTo(x, z, { speed = this.patrolSpeed, mode = 'walk', run = false } = {}) {
    this.state = 'script';
    return new Promise((res) => {
      this._scriptGoal = { x, z, speed: run ? this.chaseSpeed : speed, mode: run ? 'run' : mode, res };
      this.path = this.game.world.nav.findPath(this.pos.x, this.pos.z, x, z) || [[x, z]];
      this.pathI = 0; this._bestD = Infinity; this._stuckT = 0;
    });
  }

  faceTowards(x, z) { this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z); this._applyTransform(); }

  startAI(state = 'patrol') {
    this.state = state;
    this.model.setPossessed(true);
    this.show(true);
    this.ensureEmitter();
    this.stopSnore();
    this.path = null; this.timer = 0; this.suspicion = 0;
    if (state === 'patrol') this._nextPatrol();
  }

  wake(reason = 'noise', instant = false) {
    if (this.state !== 'sleep') return;
    this.stopSnore();
    this.state = 'waking';
    this.timer = instant ? 0.3 : 2.4;
    this.model.setPossessed(true);
    if (this.em) { audio.bedCreak(this.em.input); setTimeout(() => this.em && audio.growl(this.em.input, 1.6, 1.2), 600); }
    this.game.ui.subtitle('נועם', pick(TAUNTS.wake), { danger: true, time: 2.6 });
    audio.stinger(0.8);
    this.game.events.emit('noamWoke', reason);
  }

  goToBed() {
    this.state = 'returnBed';
    const b = this.game.world.noamBed;
    this._setPath(b.x + 0.75, b.z);
  }

  // ---------- perception ----------
  canSee(px, pz, extra = 1) {
    if (!this.awake || this.state === 'waking') return false;
    const dx = px - this.pos.x, dz = pz - this.pos.z;
    const d = Math.hypot(dx, dz);
    const p = this.game.player;
    let range = 6.5;
    if (p.flashOn) range = 15;
    const room = this.game.world.roomAt(px, pz);
    if (room) {
      if (room.outdoor) range = Math.max(range, 12);
      if (room.id === 'living' && this.game.world.tv.mode !== 'off') range = Math.max(range, 11);
      if (room.id === 'hallway' && this.game.world.hallLight.intensity > 0.5) range = Math.max(range, 11);
    }
    if (p.crouch) range *= 0.65;
    range *= extra;
    if (this.state === 'tv') range = Math.min(range, 2.2);
    if (d > range) return false;
    const ang = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
    const fov = this.state === 'chase' ? 1.6 : 1.15;
    if (ang > fov && (d > 1.4 || this.state === 'tv')) return false;
    return this.game.world.nav.lineOfSight(this.pos.x, this.pos.z, px, pz);
  }

  // Is the player's flashlight beam hitting Noam?
  litByPlayer() {
    const p = this.game.player;
    if (!p.flashOn || p.hidden) return false;
    const cam = p.camera;
    const dx = this.pos.x - cam.position.x, dz = this.pos.z - cam.position.z, dy = 1.4 - cam.position.y;
    const d = Math.hypot(dx, dy, dz);
    if (d > 14) return false;
    const dir = cam.getWorldDirection(this._tmp || (this._tmp = new THREE.Vector3()));
    const c = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
    return c > 0.9 && this.game.world.nav.lineOfSight(cam.position.x, cam.position.z, this.pos.x, this.pos.z);
  }

  onNoise(x, z, r, kind) {
    if (this.state === 'off' || this.state === 'script') return;
    const d = dist2(x, z, this.pos.x, this.pos.z);
    const los = this.game.world.nav.lineOfSight(x, z, this.pos.x, this.pos.z);
    const eff = r * (los ? 1.6 : 0.9);
    if (d > eff) return;
    if (this.state === 'sleep') {
      const base = { walk: 11, run: 32, sneak: 3, door: 20, pots: 75, gasp: 30, item: 6, loud: 120 }[kind] ?? 10;
      this.disturbance += base * (1 - d / eff) * (this.game.sleepSensitivity || 1);
      return;
    }
    if (this.state === 'waking') return;
    if (this.state === 'chase') { if (kind !== 'door') this.lastKnown.set(x, 0, z); return; }
    if (this.state === 'tv' && kind !== 'run' && kind !== 'pots' && kind !== 'gasp') return;
    // investigate
    if (kind === 'gasp' && this.game.player.hidden) {
      this._discoverHidden(this.game.player.hidden);
      return;
    }
    this.state = 'investigate';
    this.lastKnown.set(x, 0, z);
    this._setPath(x, z);
    this.timer = 0;
    if (Math.random() < 0.5) this._taunt('search', 0.4);
  }

  _taunt(kind, chance = 1) {
    if (this.tauntCd > 0 || Math.random() > chance) return;
    this.tauntCd = rand(9, 15);
    const line = pick(TAUNTS[kind]);
    const d = dist2(this.pos.x, this.pos.z, this.game.player.pos.x, this.game.player.pos.z);
    if (d < 16) {
      this.game.ui.subtitle('נועם', line, { danger: true, time: 2.4 });
      if (this.em) audio.demonVoice(this.em.input, 1.4);
    }
  }

  _setPath(x, z) {
    this._bestD = Infinity; this._stuckT = 0;
    this.path = this.game.world.nav.findPath(this.pos.x, this.pos.z, x, z);
    this.pathI = 1;
    if (this.path && this.path.length === 1) this.pathI = 0;
  }

  _nextPatrol() {
    const p = this.game.player;
    let wp;
    if (Math.random() < (this.game.director || 0.45)) {
      // drift towards the player's area (keeps the pressure on)
      const near = this.waypoints.filter((w) => dist2(w[0], w[1], p.pos.x, p.pos.z) < 7 && dist2(w[0], w[1], this.pos.x, this.pos.z) > 2);
      wp = near.length ? pick(near) : pick(this.waypoints);
    } else {
      wp = pick(this.waypoints.filter((w) => dist2(w[0], w[1], this.pos.x, this.pos.z) > 3));
    }
    if (!this.game.allowTerrace && wp[1] < 0) wp = [7.5, 2.0];
    this._setPath(wp[0] + rand(-0.3, 0.3), wp[1] + rand(-0.3, 0.3));
    this.timer = 0;
  }

  _startChase() {
    if (this.state !== 'chase') {
      audio.stinger(1);
      if (this.em) audio.growl(this.em.input, 1.3, 1.2);
      this._taunt('spot', 0.8);
      this.game.events.emit('chase');
    }
    this.state = 'chase';
    this.lostT = 0;
    this.repath = 0;
  }

  _discoverHidden(spot) {
    if (this.state === 'catching') return;
    this.state = 'catching';
    this.game.caughtBy(this, spot);
  }

  // ---------- movement ----------
  _follow(dt, speed) {
    if (!this.path || this.pathI >= this.path.length) { this.speed = damp(this.speed, 0, 8, dt); return true; }
    const [tx, tz] = this.path[this.pathI];
    // open closed doors in the way
    const look = Math.min(1.2, dist2(this.pos.x, this.pos.z, tx, tz));
    const ang = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    const ax = this.pos.x + Math.sin(ang) * look, az = this.pos.z + Math.cos(ang) * look;
    const doors = this.game.world.nav.doorsOnSegment(this.pos.x, this.pos.z, ax, az);
    for (const d of doors) {
      if (d.solid) {
        if (d.locked && !d.noamCanPass) { this.path = null; return true; }
        if (this.doorWait <= 0) { d.open(true, this.state === 'chase'); this.doorWait = this.state === 'chase' ? 0.25 : 0.7; }
      }
    }
    if (this.doorWait > 0) { this.doorWait -= dt; this.speed = damp(this.speed, 0, 10, dt); return false; }
    this.speed = damp(this.speed, speed, 5, dt);
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, this.speed * dt);
    if (d > 0.001) {
      this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
      this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    }
    this.game.world.collide(this.pos, 0.28, 1.8);
    this.stepDist += step;
    const stride = speed > 2.5 ? 0.95 : 0.75;
    if (this.stepDist > stride) {
      this.stepDist = 0;
      if (this.em) audio.footstep(this.em.input, { heavy: true, vol: speed > 2.5 ? 1.4 : 0.9 });
    }
    // stuck detection (target inside furniture, pushed by collisions...)
    if (d < (this._bestD ?? Infinity) - 0.05) { this._bestD = d; this._stuckT = 0; }
    else if ((this._stuckT = (this._stuckT || 0) + dt) > 1.2) { this._stuckT = 0; this._bestD = Infinity; this.pathI++; if (this.pathI >= this.path.length) return true; }
    if (d < 0.25) { this.pathI++; this._bestD = Infinity; if (this.pathI >= this.path.length) return true; }
    return false;
  }

  _applyTransform() {
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  update(dt, t) {
    this.tauntCd -= dt;
    const p = this.game.player;
    const world = this.game.world;
    if (this.em) {
      this.em.setPos(this.pos.x, this.state === 'sleep' ? 0.7 : 1.6, this.pos.z);
      const los = world.nav.lineOfSight(this.pos.x, this.pos.z, p.camera.position.x, p.camera.position.z);
      this.em.setOcclusion(los ? 0 : 1);
    }
    const dPlayer = dist2(this.pos.x, this.pos.z, p.pos.x, p.pos.z);

    switch (this.state) {
      case 'off': return;
      case 'sleep': {
        const b = world.noamBed;
        this.root.position.set(b.x, 0.5, b.z + 0.1);
        this.root.rotation.set(0, 0, 0);
        this.model.animate(dt, 0, 'lie', t);
        // proximity + flashlight in the face disturb him
        if (dPlayer < 1.6 && !p.crouch && p.speedNow > 0.3) this.disturbance += dt * 7;
        if (this.litByPlayer() && dPlayer < 4.5) this.disturbance += dt * 14;
        this.disturbance = Math.max(0, this.disturbance - dt * 4.5);
        if (this.disturbance > 45 && !this._stirring) {
          this._stirring = true; this._stirT = 3.5;
          audio.stopLoop('snore', 0.2);
          if (this.em) { audio.mumble(this.em.input); audio.bedCreak(this.em.input); }
          this.game.events.emit('noamStir');
        }
        if (this._stirring) {
          this._stirT -= dt;
          if (this._stirT <= 0 && this.disturbance < 60) { this._stirring = false; if (this.em) audio.snoreLoop(this.em.input); }
        }
        if (this.disturbance >= 100) { this._stirring = false; this.wake('noise'); }
        return;
      }
      case 'waking': {
        this.timer -= dt;
        const b = world.noamBed;
        const k = clamp(1 - this.timer / 2.4, 0, 1);
        if (k < 0.5) {
          this.root.position.set(b.x, 0.5, b.z + 0.1);
          this.model.animate(dt, 0, 'lie', t);
          this.root.rotation.set(0, 0, 0);
          this.model.parts.hips.rotation.x = -Math.PI / 2 + k * 2 * (Math.PI / 2) * 0.6;
        } else {
          this.root.rotation.set(0, 0, 0);
          this.pos.set(b.x + 0.75, 0, b.z);
          this.yaw = Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
          this._applyTransform();
          this.model.animate(dt, 0, 'idle', t);
        }
        if (this.timer <= 0) {
          this.pos.set(b.x + 0.75, 0, b.z);
          if (this.canSee(p.pos.x, p.pos.z, 1.2)) this._startChase();
          else { this.state = 'search'; this.lastKnown.copy(p.pos); this._setPath(p.pos.x, p.pos.z); this.timer = 0; this.searchLeft = this.canReturnToBed ? 30 : 18; }
        }
        return;
      }
      case 'script': {
        const g = this._scriptGoal;
        if (g) {
          const done = this._follow(dt, g.speed);
          this.model.animate(dt, this.speed, g.mode, t);
          if (done) { this._scriptGoal = null; this.speed = 0; g.res(); }
        } else this.model.animate(dt, 0, this.scriptPose || 'idle', t);
        this._applyTransform();
        return;
      }
      case 'catching': {
        this.model.animate(dt, 0, 'reach', t);
        this._applyTransform();
        return;
      }
    }

    // ===== awake AI =====
    // flashlight beam on him = instant suspicion
    const sees = !p.hidden && (this.canSee(p.pos.x, p.pos.z) || (this.litByPlayer() && this.state !== 'tv'));
    if (sees) {
      this.suspicion += dt * (dPlayer < 4 ? 3.5 : dPlayer < 8 ? 1.8 : 1.1);
      this.lastKnown.copy(p.pos);
    } else this.suspicion = Math.max(0, this.suspicion - dt * 0.35);
    if (p.hidden && p.hidden.seen && this.state === 'chase') {
      this.state = 'search'; this.lastKnown.set(p.hidden.x, 0, p.hidden.z); this._setPath(p.hidden.x, p.hidden.z);
      this.searchSpots = [p.hidden]; this.searchLeft = 15;
    }
    if (this.suspicion >= 1 && this.state !== 'chase') this._startChase();

    switch (this.state) {
      case 'patrol': {
        if (this.suspicion > 0.25) {
          // turn towards what he thinks he saw
          this.yaw += angleDiff(this.yaw, Math.atan2(p.pos.x - this.pos.x, p.pos.z - this.pos.z)) * Math.min(1, dt * 3);
          this.speed = damp(this.speed, 0.4, 4, dt);
          this.model.animate(dt, this.speed, 'walk', t);
          break;
        }
        const arrived = this._follow(dt, this.patrolSpeed);
        if (arrived) {
          this.timer += dt;
          this.headYaw = Math.sin(t * 1.3) * 0.7;
          if (this.timer > (this._pause || (this._pause = rand(1.5, 3.5)))) { this._pause = 0; this._nextPatrol(); }
        }
        this.model.animate(dt, this.speed, 'walk', t);
        break;
      }
      case 'investigate': {
        const arrived = this._follow(dt, this.patrolSpeed * 1.35);
        this.model.animate(dt, this.speed, 'creep', t);
        if (arrived) {
          this.timer += dt;
          this.yaw += Math.sin(t * 2) * dt * 1.5;
          if (this.timer > 3) { this.state = 'search'; this.searchLeft = 10; this.timer = 0; this._pickSearchSpots(); }
        }
        break;
      }
      case 'chase': {
        this.repath -= dt;
        const seen = sees;
        if (seen) { this.lostT = 0; this.lastKnown.copy(p.pos); } else this.lostT += dt;
        if (this.repath <= 0) {
          this.repath = 0.3;
          const tgt = seen ? p.pos : this.lastKnown;
          this._setPath(tgt.x, tgt.z);
        }
        this._follow(dt, this.chaseSpeed * (this.game.chaseMul || 1));
        this.model.animate(dt, this.speed, 'run', t);
        if (seen && dPlayer < 1.05 && !p.hidden) { this._discoverHidden(null); return; }
        if (this.lostT > 2.6) {
          this.state = 'search'; this.searchLeft = this.canReturnToBed ? 22 : 16; this.timer = 0;
          this._setPath(this.lastKnown.x, this.lastKnown.z);
          this._pickSearchSpots();
          this._taunt('lost', 0.7);
          this.game.events.emit('lostPlayer');
        }
        break;
      }
      case 'search': {
        this.searchLeft -= dt;
        const arrived = this._follow(dt, this.patrolSpeed * 1.2);
        this.model.animate(dt, this.speed, 'creep', t);
        if (arrived) {
          this.timer += dt;
          this.yaw += Math.sin(t * 1.7) * dt * 2;
          if (this.timer > 2.2) {
            this.timer = 0;
            const next = this.searchSpots.shift();
            if (next) this._setPath(next.x, next.z);
            else this._setPath(this.lastKnown.x + rand(-2.5, 2.5), this.lastKnown.z + rand(-2.5, 2.5));
          }
        }
        this._taunt('search', 0.25 * dt * 10);
        if (this.searchLeft <= 0) {
          if (this.canReturnToBed) this.goToBed();
          else { this.state = 'patrol'; this._nextPatrol(); }
        }
        break;
      }
      case 'returnBed': {
        const arrived = this._follow(dt, this.patrolSpeed);
        this.model.animate(dt, this.speed, 'walk', t);
        if (arrived) { this.setSleeping(); this.disturbance = 25; this.game.events.emit('noamSleeps'); }
        break;
      }
      case 'tv': {
        this.speed = damp(this.speed, 0, 6, dt);
        this.model.animate(dt, 0, 'sit', t);
        const tvp = this.tvSpot;
        this.pos.set(tvp.x, 0, tvp.z); this.yaw = tvp.yaw;
        this.timer -= dt;
        if (this.timer <= 0) { this.state = 'patrol'; this.yaw += Math.PI; this._nextPatrol(); this.game.events.emit('tvOver'); }
        break;
      }
    }

    // hiding spot proximity check: you must hold your breath when he is right there
    if (p.hidden && this.state !== 'tv') {
      const s = p.hidden;
      const ds = dist2(this.pos.x, this.pos.z, s.cam.x, s.cam.z);
      if (s.seen && ds < 1.8) { this._discoverHidden(s); return; }
      if (ds < 2.3 && this.state !== 'patrol') {
        if (!p.holdingBreath) {
          this._heardBreath = (this._heardBreath || 0) + dt;
          if (this._heardBreath > 1.3) { this._discoverHidden(s); return; }
        } else this._heardBreath = Math.max(0, (this._heardBreath || 0) - dt);
      } else this._heardBreath = 0;
    }
    this._applyTransform();
    this.model.parts.head.rotation.y = damp(this.model.parts.head.rotation.y, this.state === 'patrol' ? this.headYaw : 0, 3, dt);
    // twitchy head when possessed
    if (Math.random() < dt * 0.6) this.model.parts.head.rotation.z = rand(-0.35, 0.35);
    else this.model.parts.head.rotation.z = damp(this.model.parts.head.rotation.z, 0, 4, dt);
  }

  _pickSearchSpots() {
    const spots = [...this.game.world.hidingSpots].sort((a, b) => dist2(a.x, a.z, this.lastKnown.x, this.lastKnown.z) - dist2(b.x, b.z, this.lastKnown.x, this.lastKnown.z));
    this.searchSpots = spots.slice(0, 2).filter((s) => dist2(s.x, s.z, this.lastKnown.x, this.lastKnown.z) < 6);
  }

  startTV(timeSec) {
    this.state = 'tv';
    this.timer = timeSec;
    this.tvSpot = { x: 13.75, z: 4.3, yaw: Math.PI / 2 };
  }

  fear() {
    if (!this.awake) return this.state === 'sleep' ? clamp(this.disturbance / 100, 0, 1) * 0.6 : 0;
    const p = this.game.player;
    const d = dist2(this.pos.x, this.pos.z, p.pos.x, p.pos.z);
    let f = clamp(1 - d / 13, 0, 1) * 0.85;
    if (this.state === 'chase') f = Math.max(f, 0.85);
    if (this.state === 'search') f = Math.max(f, 0.45);
    return f;
  }
}
