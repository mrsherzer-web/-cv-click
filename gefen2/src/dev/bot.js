// ============================================================================
//  Test autopilot (?bot).  Plays like a careful player: flashlight on Gefen,
//  mask for Ido, repairs + kill switch for Dolev, and walks to the objective
//  marker in first person.  Used by tools/test_nights.js.
// ============================================================================
export class Bot {
  constructor(S) {
    this.S = S;
    this.t = 0;
    this.path = null;
    this.pathT = 0;
    this.stuckT = 0;
    this.log = [];
    this.lastPos = [0, 0];
    window.__bot = this;
  }

  update(dt) {
    const S = this.S;
    const P = S.player;
    const inp = S.G.input;
    this.t += dt;
    // short history for the death report
    this.histT = (this.histT || 0) - dt;
    if (this.histT <= 0 && !S.dead) {
      this.histT = 0.3;
      const G = S.enemies.gefen;
      (this.hist = this.hist || []).push(`${this.branch || '-'}/${G.state || G.mode}/d${G.playerDist().toFixed(1)}/cd${(G.stunCd ?? 0).toFixed(1)}/los${S.world.nav.los(P.x, P.z, G.x, G.z) ? 1 : 0}/L${P.flash.on ? 1 : 0}/${P.room}`);
      if (this.hist.length > 14) this.hist.shift();
    }
    if (S.dead || S.won) return;
    if (S.phone.ringing) S.phone.answer();
    for (const b of document.querySelectorAll('.call-answer:not([hidden])')) void b;
    if (S.busy) {
      inp.hold('light', false);
      inp.hold('interact', false);
      this.axis(0, 0);
      return;
    }
    if (P.mode === 'seat') this.seat(dt);
    else if (P.mode === 'walk') this.walk(dt);
  }

  axis(x, y, sprint = false) {
    const st = this.S.G.input.stick;
    st.x = x;
    st.y = y;
    this.S.G.input.hold('sprint', sprint);
  }

  // ------------------------------------------------------------ office
  seat(dt) {
    const S = this.S;
    const P = S.player;
    const O = S.office;
    const inp = S.G.input;
    const { gefen: G, ido: I, dolev: D } = S.enemies;
    const gOn = G.mode === 'office';
    const iOn = I.mode === 'office';
    const dOn = D.mode === 'office';
    this.axis(0, 0);
    // scripted buttons
    const acts = S.hud.actions;
    if (acts.door) {
      if (!O.tablet.open) O.toggleTablet(true);
      O.selectCam(4);
      return acts.door.dispatchEvent(new Event('pointerdown'));
    }
    let wantLight = false;
    let wantMask = false;
    let wantTablet = false;
    if (iOn && I.idx === 5) wantMask = true;
    else if (gOn && G.idx >= 4) wantLight = true;
    if (acts.run && gOn && G.idx <= 3) acts.run.dispatchEvent(new Event('pointerdown'));
    else if (acts.run && gOn) wantLight = true;
    if (acts.yahali && gOn === false) void 0;
    if (dOn && D.idx === 5 && O.enabled.kill && !wantMask) {
      if (O.killCd <= 0) O.pullKill();
    }
    if (!wantLight && !wantMask && !O.dark) {
      if (O.enabled.fix && O.anyBroken()) {
        wantTablet = true;
        if (O.tablet.open) {
          O.setTab('fix');
          if (!O.rebooting) O.startReboot('all');
        }
      } else if (dOn && D.idx >= 3 && O.lureReady() ) {
        wantTablet = true;
        if (O.tablet.open) {
          O.setTab('cams');
          O.playLure();
        }
      } else if (this.wantCam != null) {
        wantTablet = true;
        if (O.tablet.open) O.selectCam(this.wantCam);
      }
    }
    if (P.mask.enabled && P.mask.on !== wantMask) P.setMask(wantMask);
    if (wantLight || wantMask) {
      if (O.tablet.open) O.toggleTablet(false);
    } else if (O.tablet.open !== wantTablet) O.toggleTablet(wantTablet);
    P.yawT = 0;
    P.pitchT = 0;
    inp.hold('light', wantLight && !P.mask.on);
  }

  // ------------------------------------------------------------ walking
  walk(dt) {
    const S = this.S;
    const P = S.player;
    const inp = S.G.input;
    const nav = S.world.nav;
    const use = P.use.target;
    if (S.hud.actions.yahali && S.enemies.gefen.state === 'chase') S.hud.actions.yahali.dispatchEvent(new Event('pointerdown'));
    inp.hold('interact', false);
    const m = S.marker || this.goal;
    if (!m && !use) return this.axis(0, 0);
    // ---- threats, the way a careful player handles them
    if (!S.G.dev.god && !S.playerSafe) {
      const { gefen: G, ido: I, dolev: D } = S.enemies;
      const aim = (x, z) => {
        P.yaw = Math.atan2(-(x - P.x), -(z - P.z));
        P.pitch = 0;
      };
      // Ido close: mask until he leaves
      if (I.mode === 'fp' && !(I.awayT > 0) && I.playerDist() < 8 && P.mask.enabled && !(G.mode === 'fp' && G.state === 'chase' && G.playerDist() < 5)) {
        if (!P.mask.on) P.setMask(true);
        P.flash.toggled = false;
        this.branch = 'mask';
        return this.axis(0, 0);
      }
      if (P.mask.on) P.setMask(false);
      // Gefen on top of us and the light can stun him: turn and blind him
      const gNear = G.mode === 'fp' && G.state === 'chase' && !G.hold && nav.los(P.x, P.z, G.x, G.z);
      if (gNear && G.stunCd <= 0 && G.playerDist() < 6.5 && P.flash.battery > 3 && !P.flash.dead) {
        aim(G.x, G.z);
        P.flash.toggled = true;
        this.branch = 'stun';
        return this.axis(0, -0.6);
      }
      // Gefen chasing and the stun is not ready: keep away from him until it is
      if (gNear && (G.stunCd > 0 || P.flash.dead) && G.playerDist() < 5) {
        const nextD = use ? 0 : Math.hypot(this.path?.[0]?.[0] - G.x, this.path?.[0]?.[1] - G.z);
        if (!(nextD > G.playerDist() + 0.3)) {
          // the way forward leads to him: back off
          const ax = P.x - G.x;
          const az = P.z - G.z;
          const l = Math.hypot(ax, az) || 1;
          let best = null;
          let bs = -1e9;
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const dx = Math.cos(ang);
            const dz = Math.sin(ang);
            let free = 0;
            for (let k = 1; k <= 8; k++) {
              if (!nav.canWalk(P.x + dx * k * 0.4, P.z + dz * k * 0.4)) break;
              free = k;
            }
            const score = free * 0.5 + ((dx * ax + dz * az) / l) * 3;
            if (score > bs) {
              bs = score;
              best = [dx, dz];
            }
          }
          P.yaw = Math.atan2(-best[0], -best[1]);
          this.branch = 'flee';
          return this.axis(0, 1, true);
        }
      }
      // Dolev ahead: lure him past with a ball, keep the light off
      if (D.mode === 'fp' && !D.hold && D.playerDist() < 10 && nav.los(P.x, P.z, D.x, D.z)) {
        P.flash.toggled = false;
        this.noLight = 1.5;
        if (D.tinkerT <= 0) {
          if (!(D.noise && D.noise.strong) && S.balls > 0 && this.t > (this.throwCd || 0)) {
            aim(D.x, D.z);
            this.throwCd = this.t + 3;
            S.throwBall();
          }
          this.branch = 'dolev';
          if (D.playerDist() < 4.5) {
            aim(D.x, D.z);
            return this.axis(0, -1, false);
          }
          if (S.balls > 0 || (D.noise && D.noise.strong)) return this.axis(0, 0);
        }
      }
    }
    this.noLight = Math.max(0, (this.noLight || 0) - dt);
    this.branch = 'go';
    if (use) {
      this.axis(0, 0);
      P.face(use.x, use.z);
      inp.hold('interact', true);
      if (!use.hold) inp.press('interact');
      this.branch = 'use';
      return;
    }
    if (!m) return this.axis(0, 0);
    this.pathT -= dt;
    if (!this.path || this.pathT <= 0) {
      this.path = nav.path(P.x, P.z, m.x, m.z) || [[m.x, m.z]];
      this.pathT = 0.6;
    }
    // drop a waypoint once it is reached, or as soon as the next one is in a straight clear line
    while (this.path.length > 1 && (Math.hypot(this.path[0][0] - P.x, this.path[0][1] - P.z) < 0.18 || nav._clear([P.x, P.z], this.path[1]))) this.path.shift();
    const [tx, tz] = this.path[0];
    const want = Math.atan2(-(tx - P.x), -(tz - P.z));
    let d = want - P.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    P.yaw += d * Math.min(1, dt * 12);
    P.pitch = 0;
    this.axis(0, Math.abs(d) < 0.9 ? 1 : 0.2, true);
    if (!P.flash.on && !P.mask.on && P.flash.battery > 20 && !P.flash.dead && P.flash.enabled && !(this.noLight > 0)) P.flash.toggled = true;
    // stuck detection for the log
    const moved = Math.hypot(P.x - this.lastPos[0], P.z - this.lastPos[1]);
    this.lastPos = [P.x, P.z];
    this.stuckT = moved < 0.002 ? this.stuckT + dt : 0;
    if (this.stuckT > 6) {
      this.stuckT = 0;
      this.path = null;
      console.log('BOT stuck at', P.x.toFixed(1), P.z.toFixed(1), 'going to', m.x.toFixed(1), m.z.toFixed(1));
    }
  }
}
