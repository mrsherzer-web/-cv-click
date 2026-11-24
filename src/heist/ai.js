/* Heist chapter: traffic, police pursuit and the wanted system. */
const HAI = {
  traffic: [], police: [], wanted: 0, maxWanted: 5, lastSeen: 0, seen: false, evadeK: 0, bustT: 0, crimeCd: 0, t: 0,
  maxTraffic: 16, patrols: 0, lockWanted: 0, enabled: true,
  COLORS: [0x2bb3a8, 0xf4f0e6, 0xff8fb0, 0x6aa7c8, 0xb38cff, 0x1f2a44, 0xd9d2c5, 0x8a1c2b, 0x3c6e47, 0xe0a33a],
  KINDS: ['sedan', 'sedan', 'coupe', 'taxi', 'van', 'sedan', 'coupe'],
  POLICE_BY_STARS: [0, 2, 3, 4, 6, 8],

  reset() {
    for (const v of [...this.traffic, ...this.police]) HVehicle.remove(v);
    this.traffic = []; this.police = []; this.wanted = 0; this.lastSeen = 0; this.seen = false; this.bustT = 0; this.crimeCd = 0; this.t = 0; this.lockWanted = 0; this.evadeK = 0;
  },
  setWanted(n, why) {
    n = HX.clamp(Math.round(n), 0, this.maxWanted);
    const was = this.wanted; this.wanted = Math.max(n, this.lockWanted);
    if (this.wanted > was) { this.lastSeen = this.t; if (window.HAudio) HAudio.sfx('star'); if (this.onWanted) this.onWanted(this.wanted, was, why); }
    else if (this.wanted < was && this.onWanted) this.onWanted(this.wanted, was, why);
  },
  crime(stars, ctx) { if (this.crimeCd > 0) return; this.crimeCd = 4; this.setWanted(Math.max(this.wanted + stars, stars)); },

  /* ---------- helpers ---------- */
  randomEdgeNear(px, pz, rMin, rMax, avoidView, cam) {
    const nodes = HX.nodes;
    for (let tries = 0; tries < 40; tries++) {
      const a = nodes[Math.floor(Math.random() * nodes.length)];
      if (!a.nbr.length) continue;
      const b = a.nbr[Math.floor(Math.random() * a.nbr.length)];
      const s = 8 + Math.random() * (Math.hypot(b.x - a.x, b.z - a.z) - 16);
      const p = HX.lanePoint(a, b, s);
      const d = Math.hypot(p.x - px, p.z - pz);
      if (d < rMin || d > rMax) continue;
      if (avoidView && cam) { const dx = p.x - cam.x, dz = p.z - cam.z, L = Math.hypot(dx, dz) || 1; if ((dx * cam.fx + dz * cam.fz) / L > 0.35 && d < rMax * 0.8) continue; }
      return { a, b, s, p };
    }
    return null;
  },
  pickNext(a, b, pref) { // at node b coming from a: choose the next node (no U-turn unless dead end)
    const opts = b.nbr.filter(n => n !== a);
    if (!opts.length) return a;
    if (pref) return pref(opts);
    // prefer going straight a bit more often
    const dx = b.x - a.x, dz = b.z - a.z;
    const w = opts.map(n => { const ex = n.x - b.x, ez = n.z - b.z, c = (dx * ex + dz * ez) / ((Math.hypot(dx, dz) * Math.hypot(ex, ez)) || 1); return c > 0.7 ? 2.2 : 1; });
    let r = Math.random() * w.reduce((s, x) => s + x, 0);
    for (let k = 0; k < opts.length; k++) { r -= w[k]; if (r <= 0) return opts[k]; }
    return opts[0];
  },
  steerTo(v, tx, tz) {
    const hd = Math.atan2(tx - v.x, tz - v.z), diff = HX.wrapAngle(hd - v.h);
    return { steer: HX.clamp(-diff * 2.4, -1, 1), diff };
  },

  /* ---------- traffic ---------- */
  spawnTraffic(ctx, near) {
    const e = this.randomEdgeNear(ctx.px, ctx.pz, near ? 25 : 120, near ? 160 : 230, !near, ctx.cam);
    if (!e) return null;
    const kind = this.KINDS[Math.floor(Math.random() * this.KINDS.length)];
    const v = HVehicle.make(kind, e.p.x, e.p.z, Math.atan2(e.p.ux, e.p.uz), { color: this.COLORS[Math.floor(Math.random() * this.COLORS.length)] });
    const sp = 9 + Math.random() * 4; v.vx = e.p.ux * sp; v.vz = e.p.uz * sp;
    v.ai = { type: 'traffic', a: e.a, b: e.b, next: null, s: e.s, cruise: 11 + Math.random() * 4, stuck: 0, stopT: 0, honkT: 0 };
    v.ai.next = this.pickNext(v.ai.a, v.ai.b);
    v.rig.setLights && v.rig.setLights(ctx.lights);
    this.traffic.push(v); return v;
  },
  driveTraffic(v, dt, ctx, all) {
    const ai = v.ai;
    if (v.wrecked) { v.inp.throttle = 0; v.inp.steer = 0; v.inp.handbrake = true; return; }
    const a = ai.a, b = ai.b, L = Math.hypot(b.x - a.x, b.z - a.z);
    // progress along the current edge
    const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L;
    ai.s = HX.clamp((v.x - a.x) * ux + (v.z - a.z) * uz, 0, L);
    if (ai.s > L - 6) { ai.a = b; ai.b = ai.next; ai.next = this.pickNext(ai.a, ai.b); return this.driveTraffic(v, dt, ctx, all); }
    // look-ahead target along this lane, spilling onto the next one
    const look = 7 + Math.abs(v.vF) * 0.45;
    let t;
    if (ai.s + look < L - 7) t = HX.lanePoint(a, b, ai.s + look);
    else t = HX.lanePoint(b, ai.next, Math.max(7, ai.s + look - L + 7));
    const st = this.steerTo(v, t.x, t.z);
    // turning soon? slow down
    const nx = ai.next.x - b.x, nz = ai.next.z - b.z, turn = 1 - Math.abs((ux * nx + uz * nz) / (Math.hypot(nx, nz) || 1));
    let target = ai.cruise;
    if (L - ai.s < 26 && turn > 0.5) target = 7;
    if (Math.abs(st.diff) > 0.6) target = Math.min(target, 6);
    // obstacles ahead (cars / player on foot)
    const fx = Math.sin(v.h), fz = Math.cos(v.h);
    let block = 99;
    for (const o of all) {
      if (o === v) continue; const dx = o.x - v.x, dz = o.z - v.z; if (Math.abs(dx) > 24 || Math.abs(dz) > 24) continue;
      const fwd = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
      if (fwd > 0 && fwd < 20 && lat < 2.4) block = Math.min(block, fwd);
    }
    if (!ctx.inCar) { const dx = ctx.px - v.x, dz = ctx.pz - v.z, fwd = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx); if (fwd > 0 && fwd < 14 && lat < 2) block = Math.min(block, fwd); }
    if (block < 20) target = Math.min(target, Math.max(0, (block - 6) * 0.9));
    if (ai.stopT > 0) { ai.stopT -= dt; target = 0; }
    v.inp.steer = st.steer; v.inp.handbrake = false;
    v.inp.throttle = HX.clamp((target - v.vF) * 0.35, -1, 1);
    // blocked for a while: honk, then give up later
    if (target < 1 && block < 10) { ai.stuck += dt; if (ai.stuck > 3 && (ai.honkT -= dt) < 0) { ai.honkT = 3 + Math.random() * 3; if (window.HAudio && Math.hypot(v.x - ctx.px, v.z - ctx.pz) < 40) HAudio.sfx('horn'); } }
    else ai.stuck = Math.max(0, ai.stuck - dt);
  },

  /* ---------- police ---------- */
  spawnPolice(ctx, opts) {
    opts = opts || {};
    let x, z, h;
    if (opts.at) { x = opts.at.x; z = opts.at.z; h = opts.at.h; }
    else {
      const e = this.randomEdgeNear(ctx.px, ctx.pz, opts.rMin || 110, opts.rMax || 190, true, ctx.cam) || this.randomEdgeNear(ctx.px, ctx.pz, 70, 240, false);
      if (!e) return null;
      x = e.p.x; z = e.p.z; h = Math.atan2(ctx.px - x, ctx.pz - z);
    }
    const v = HVehicle.make('police', x, z, h);
    v.ai = { type: 'police', node: HX.nearestNode(x, z), mode: opts.block ? 'block' : 'chase', stuck: 0, revT: 0, revSteer: 1, retire: false };
    v.sirenOn = !!(this.wanted > 0 || opts.block); v.rig.setLights && v.rig.setLights(true);
    this.police.push(v); return v;
  },
  drivePolice(v, dt, ctx, all) {
    const ai = v.ai;
    if (v.wrecked) { v.inp.throttle = 0; v.inp.steer = 0; v.inp.handbrake = true; v.sirenOn = false; return; }
    const dx = ctx.px - v.x, dz = ctx.pz - v.z, dist = Math.hypot(dx, dz);
    if (ai.mode === 'block') { v.inp.throttle = 0; v.inp.handbrake = true; if (this.wanted > 0 && dist < 40) { const fx = Math.sin(v.h), fz = Math.cos(v.h); if (dx * fx + dz * fz < -5) ai.mode = 'chase'; } return; }
    if (this.wanted === 0 || ai.retire) { // no pursuit: cruise away like traffic, siren off
      v.sirenOn = false;
      if (!ai.patrol) { ai.patrol = { type: 'traffic', a: HX.nearestNode(v.x, v.z), b: null, next: null, s: 0, cruise: 10, stuck: 0, stopT: 0, honkT: 9 }; ai.patrol.b = ai.patrol.a.nbr[0]; ai.patrol.next = this.pickNext(ai.patrol.a, ai.patrol.b); }
      const keep = v.ai; v.ai = ai.patrol; this.driveTraffic(v, dt, ctx, all); ai.patrol = v.ai; v.ai = keep; return;
    }
    ai.patrol = null; v.sirenOn = true;
    // reversing out of a jam
    if (ai.revT > 0) { ai.revT -= dt; v.inp.throttle = -1; v.inp.steer = ai.revSteer; v.inp.handbrake = false; return; }
    const los = dist < 85 && HX.canSee(v.x, v.z, ctx.px, ctx.pz);
    let tx, tz, target = v.spec.max * (dist > 160 ? 1.15 : 1);
    if (los || dist < 22) {
      const lead = Math.min(1.1, dist / 45);
      tx = ctx.px + ctx.pvx * lead; tz = ctx.pz + ctx.pvz * lead;
      if (dist < 14) target = Math.max(8, Math.hypot(ctx.pvx, ctx.pvz) + 6);
    } else {
      // graph navigation: head for the neighbour node that gets closest to the player
      let n = ai.node;
      if (!n || Math.hypot(n.x - v.x, n.z - v.z) < 12) {
        const from = n || HX.nearestNode(v.x, v.z);
        const choices = from.nbr.length ? from.nbr : [from];
        let best = choices[0], bd = 1e18;
        for (const c of choices) { const d = Math.hypot(c.x - ctx.px, c.z - ctx.pz) + Math.random() * 6 + (c === ai.prev ? 40 : 0); if (d < bd) { bd = d; best = c; } }
        ai.prev = from; ai.node = n = best;
      }
      tx = n.x; tz = n.z;
    }
    const st = this.steerTo(v, tx, tz);
    if (Math.abs(st.diff) > 0.9 && v.vF > 18) target = 14;
    v.inp.steer = st.steer;
    v.inp.handbrake = Math.abs(st.diff) > 1.1 && v.vF > 14;
    v.inp.throttle = HX.clamp((target - v.vF) * 0.4, -1, 1);
    // stuck detection
    if (Math.abs(v.vF) < 1.5 && v.inp.throttle > 0.3) { ai.stuck += dt; if (ai.stuck > 1.3) { ai.stuck = 0; ai.revT = 1.1; ai.revSteer = -Math.sign(st.steer || 1); ai.node = null; } }
    else ai.stuck = 0;
  },

  /* ---------- main update ---------- */
  update(dt, ctx, events) {
    this.t += dt; if (this.crimeCd > 0) this.crimeCd -= dt;
    const all = [...this.traffic, ...this.police]; if (ctx.pcar && !all.includes(ctx.pcar)) all.push(ctx.pcar);
    // keep the population around the player
    const nT = this.enabled ? Math.round(this.maxTraffic * (this.trafficScale || 1)) : 0;
    for (let k = this.traffic.length - 1; k >= 0; k--) {
      const v = this.traffic[k], d = Math.hypot(v.x - ctx.px, v.z - ctx.pz);
      if (d > 270 || (v.ai.stuck > 14 && d > 60)) { HVehicle.remove(v); this.traffic.splice(k, 1); }
    }
    if (this.traffic.length < nT) this.spawnTraffic(ctx, this.traffic.length < nT / 2 && this.t < 1);
    // police population follows the wanted level
    const wantP = this.wanted > 0 ? this.POLICE_BY_STARS[this.wanted] : this.patrols;
    const active = this.police.filter(v => !v.wrecked && !v.ai.retire);
    if (active.length < wantP && (this._spawnCd = (this._spawnCd || 0) - dt) < 0) { this._spawnCd = this.wanted > 0 ? 2.2 : 6; this.spawnPolice(ctx); }
    for (let k = this.police.length - 1; k >= 0; k--) {
      const v = this.police[k], d = Math.hypot(v.x - ctx.px, v.z - ctx.pz);
      if (this.wanted === 0 && active.length > this.patrols && !v.ai.retire && v.ai.mode !== 'block') v.ai.retire = true;
      if ((d > 300) || ((v.ai.retire || v.wrecked) && d > 160) || (this.wanted > 0 && d > 230 && !v.wrecked)) { HVehicle.remove(v); this.police.splice(k, 1); }
    }
    // drive
    for (const v of this.traffic) { this.driveTraffic(v, dt, ctx, all); HVehicle.step(v, dt, events); }
    for (const v of this.police) { this.drivePolice(v, dt, ctx, all); HVehicle.step(v, dt, events); }
    // car-vs-car (only nearby pairs)
    const near = all.filter(v => Math.abs(v.x - ctx.px) < 160 && Math.abs(v.z - ctx.pz) < 160);
    for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
      const a = near[i], b = near[j]; if (Math.abs(a.x - b.x) > 7 || Math.abs(a.z - b.z) > 7) continue;
      HVehicle.collidePair(a, b, events);
    }
    // visuals + LOD
    const far = this.drawDist || 180;
    for (const v of this.traffic.concat(this.police)) { const d = Math.hypot(v.x - ctx.px, v.z - ctx.pz); v.rig.group.visible = d < far || (v.sirenOn && d < far * 1.4); if (v.rig.group.visible) HVehicle.sync(v, dt); }
    this.updateWanted(dt, ctx);
  },
  updateWanted(dt, ctx) {
    if (this.wanted <= 0) { this.seen = false; this.bustT = 0; return; }
    let seen = false, closeSlow = false;
    const pSpeed = Math.hypot(ctx.pvx, ctx.pvz);
    for (const v of this.police) {
      if (v.wrecked || v.ai.retire) continue;
      const d = Math.hypot(v.x - ctx.px, v.z - ctx.pz);
      if (d < 30 || (d < 90 && HX.canSee(v.x, v.z, ctx.px, ctx.pz))) seen = true;
      if (d < (ctx.inCar ? 7.5 : 6) && Math.abs(v.vF) < 9) closeSlow = true;
    }
    this.seen = seen; if (seen) this.lastSeen = this.t;
    const evade = 7 + this.wanted * 2.2;
    this.evadeK = HX.clamp((this.t - this.lastSeen) / evade, 0, 1);
    if (!seen && this.t - this.lastSeen > evade && this.lockWanted === 0) { this.setWanted(0, 'evaded'); if (window.HAudio) HAudio.sfx('starDown'); }
    // busted: stopped next to a cop for a moment
    if (closeSlow && pSpeed < 2.5 && !ctx.safe) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 2);
    if (this.bustT > 2.4 && this.onBusted) { this.bustT = 0; this.onBusted(); }
  },
  // crimes the player commits near police
  witness(x, z, r) { for (const v of this.police) if (!v.wrecked && Math.hypot(v.x - x, v.z - z) < (r || 70) && HX.canSee(v.x, v.z, x, z)) return true; return false; },
  setLights(on) { for (const v of [...this.traffic, ...this.police]) v.rig.setLights && v.rig.setLights(on || v.kind === 'police'); },
};
