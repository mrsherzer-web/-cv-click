/* Heist chapter: the mission script ("THE BIG SCORE"), the vault level, checkpoints, free roam + collectibles. */
const HMission = {
  H: null, mode: 'story', step: null, money: 0, vault: null, route: null, allowCrime: false, promptBusy: false,
  checkpoint: null, stats: null, cash: [], cashTaken: new Set(), routeT: 0, goal: null, flags: {}, run: 0,
  CUTS: { // segments of assets/heist.mp4 (scene cuts at 4.125, 6.125, 7.79, 12.0, 14.67, 16.83 s)
    arrive: [0, 4.1], hacker: [4.15, 6.1], vault: [6.15, 7.75], finale: [12.0, 20.0],
  },
  tr(k, v) { return t(k, v); },
  // every deferred callback carries the run it was made in: quitting (or restarting) invalidates them all
  cancel() { this.run++; },
  later(fn, ms) { const r = this.run; return setTimeout(() => { if (this.H && this.H.active && this.run === r) fn(); }, ms); },

  /* ---------------- start ---------------- */
  begin(H, free) {
    this.cancel();
    this.H = H; this.money = 0; this.stats = { t0: H.time, crashes: 0, maxWanted: 0, busted: 0 }; this.flags = {};
    this.checkpoint = null; this.goal = null; this.route = null; this.step = null; this.vault = null; this.promptBusy = false;
    try { this.cashTaken = new Set(JSON.parse(localStorage.getItem('kotc_heist_cash') || '[]')); } catch (e) { this.cashTaken = new Set(); }
    HAI.reset(); HAI.trafficScale = H.q === 'high' ? 1 : H.q === 'med' ? 0.7 : 0.5; HAI.drawDist = H.q === 'high' ? 190 : 140;
    HAI.onBusted = () => this.onBusted(); HAI.onWanted = (n, was) => { this.stats.maxWanted = Math.max(this.stats.maxWanted, n); if (n === 0 && was > 0) HHud.toast(t('h_evaded'), '#7dffb0'); };
    const ho = HWorld.hotel;
    H.spawnPlayer(ho.start.x, ho.start.z, ho.start.h);
    H.setPlayerCar(H.makeCar('sports', ho.carSpot.x, ho.carSpot.z, ho.carSpot.h));
    H.car.inp.handbrake = true;
    this.hacker = H.makePerson('hacker'); this.hacker.group.position.set(ho.hacker.x, HX.groundY(ho.hacker.x, ho.hacker.z), ho.hacker.z); this.hacker.group.rotation.y = ho.hacker.h;
    H.tod = 0; H.todTarget = 0; H.applyTod();
    HHud.resetMoney(0);
    if (free) { this.startFree(true); return; }
    this.mode = 'story'; this.allowCrime = false;
    HAI.maxTraffic = 12; HAI.patrols = 0;
    H.state = 'cut';
    if (window.HAudio) HAudio.music('stealth');
    this.cut('arrive', () => {
      H.state = 'play';
      HHud.banner('THE BIG SCORE', '', '', 3.2);
      if (window.HAudio) HAudio.sfx('whoosh');
      this.setStep('meet');
      HHud.help(Input.touchMode ? t('h_helpTouch') : t('h_helpKeys'));
      this.later(() => HHud.help(''), 9000);
    });
  },
  cut(name, done) {
    const r = this.run, [a, b] = this.CUTS[name], caps = (I18N[LANG].heistCaps || I18N.he.heistCaps)[name] || [];
    if (window.HAudio) HAudio.duck(true);
    this.H.state = this.H.state === 'loading' ? 'cut' : this.H.state;
    HHud.playCut(a, b, caps, () => { if (this.run !== r || !this.H.active) return; if (window.HAudio) HAudio.duck(false); done && done(); });
  },

  /* ---------------- steps ---------------- */
  OBJ: ['meet', 'hack', 'enter', 'vault', 'getaway', 'escape'],
  setStep(s) {
    this.step = s; const H = this.H, ho = HWorld.hotel;
    const lines = this.OBJ.map(k => ({ t: t('h_o_' + k), done: this.OBJ.indexOf(k) < this.OBJ.indexOf(s), cur: k === s }));
    if (this.mode === 'story') HHud.setObjective(t('h_missionTitle'), lines);
    this.goal = null;
    if (s === 'meet') this.goal = { x: ho.hacker.x + 1.5, z: ho.hacker.z + 1.2 };
    else if (s === 'enter') this.goal = { x: ho.door.x + 1.2, z: ho.door.z };
    else if (s === 'getaway') this.goal = { x: H.car.x, z: H.car.z, car: true };
    else if (s === 'escape') this.goal = { x: HX.SAFEHOUSE.x, z: HX.SAFEHOUSE.z };
    H.setMarker(this.goal ? this.goal.x : null, this.goal ? this.goal.z : 0);
    this.routeT = 0;
  },
  blips() {
    const b = [];
    if (this.goal) b.push({ x: this.goal.x, z: this.goal.z, kind: 'goal', edge: true, label: this.mode === 'free' ? '$' : '★' });
    if (this.mode === 'free') { const H = this.H, p = H.player.inCar || H.player; for (const c of this.cash) if (!c.taken && Math.hypot(c.x - p.x, c.z - p.z) < 320) b.push({ x: c.x, z: c.z, kind: 'cash' }); b.push({ x: HX.SAFEHOUSE.x, z: HX.SAFEHOUSE.z, col: '#5cf2a8', edge: false }); }
    return b;
  },
  safeZone(x, z) { const S = HX.SAFEHOUSE; return x > S.x - 6 && x < S.x + 6 && Math.abs(z) < 8.5; },

  update(dt) {
    const H = this.H, p = H.player, pos = p.inCar || p;
    // GPS route
    this.routeT -= dt;
    if (this.routeT <= 0) { this.routeT = 0.8; this.route = this.goal ? this.computeRoute(pos.x, pos.z, this.goal.x, this.goal.z) : null; }
    if (this.goal && this.goal.car && H.car) { this.goal.x = H.car.x; this.goal.z = H.car.z; H.setMarker(H.car.x, H.car.z, 0x4da3ff); }
    this.promptBusy = false;
    const ho = HWorld.hotel;
    if (this.hacker) this.hacker.setPose(this.step === 'meet' || this.step === 'hack' ? 'type' : 'idle', H.time, 1);
    if (this.mode === 'story') {
      if (this.step === 'meet' && !p.inCar && Math.hypot(p.x - ho.hacker.x, p.z - ho.hacker.z) < 3.2) {
        this.promptBusy = true; HHud.prompt(Input.touchMode ? '🚗' : 'E', t('h_talkHacker'));
        if (H.actionPressed() || Math.hypot(p.x - ho.hacker.x, p.z - ho.hacker.z) < 2.2) this.startHack();
      }
      if (this.step === 'enter' && !p.inCar && Math.hypot(p.x - ho.door.x, p.z - ho.door.z) < 3.2) this.enterVault();
      if (this.step === 'escape') {
        // dawn rises as you drive east onto the causeway (like the trailer's sunset highway)
        H.todTarget = HX.clamp((pos.x - 150) / 520, 0, 1); H.todRate = 0.7;
        if (!this.flags.block && pos.x > 150 && pos.x < 290) { this.flags.block = true; this.roadblock(); }
        if (!this.flags.cpBridge && pos.x > HX.BRIDGE_X0 + 10 && p.inCar) { this.flags.cpBridge = true; this.checkpoint = 'bridge'; HHud.toast(t('h_checkpoint'), '#ffd23f'); if (window.HAudio) HAudio.sfx('checkpoint'); }
        if (this.safeZone(pos.x, pos.z)) this.complete();
      }
      if (this.step === 'getaway' && p.inCar && !this.flags.escaping) { this.flags.escaping = true; this.setStep('escape'); }
    } else this.freeUpdate(dt);
  },

  /* ---------- hacker + mini-game ---------- */
  startHack() {
    const H = this.H; if (this.step !== 'meet') return;
    this.step = 'hack'; H.state = 'hack'; H.setMarker(null); HHud.prompt();
    const p = H.player; p.vx = p.vz = 0; p.rig.setPose('idle', 0, 1);
    this.cut('hacker', () => {
      this.setStep('hack');
      const done = () => {
        H.state = 'play'; HHud.banner(t('h_hacked'), '', 'green', 2.4); // (HHack already played 'accessGranted')
        this.setStep('enter');
      };
      if (window.HHack && HHack.start) HHack.start({ container: H.stage, lang: LANG, onDone: done });
      else this.later(done, 1500);
    });
  },

  /* ---------- the vault ---------- */
  enterVault() {
    const H = this.H; this.step = 'vault-cut'; H.setMarker(null); HHud.fade(1, 0.35);
    this.later(() => {
      H.state = 'cut'; HHud.prompt();
      this.cut('vault', () => { this.buildVault(); this.setStep('vault'); H.state = 'vault'; HHud.fade(0, 0.5); if (window.HAudio) HAudio.music('stealth'); });
      HHud.fade(0, 0.01);
    }, 380);
  },
  buildVault() {
    const H = this.H, T = H.T;
    if (!this.vault) {
      const sc = new T.Scene(); sc.fog = new T.Fog(0x200006, 6, 26); sc.background = new T.Color(0x0a0002);
      const X = 9, Z = 8, Y = 4.6;
      const wall = new T.MeshStandardMaterial({ color: 0x5a0a12, roughness: 0.7, metalness: 0.1, side: T.BackSide });
      const floor = new T.MeshStandardMaterial({ color: 0x2c1013, roughness: 0.72, metalness: 0.1, side: T.BackSide });
      const metal = new T.MeshStandardMaterial({ color: 0x1b1416, roughness: 0.45, metalness: 0.8, envMap: H.env });
      const room = new T.Mesh(new T.BoxGeometry(X * 2, Y, Z * 2), [wall, wall, new T.MeshStandardMaterial({ color: 0x120306, side: T.BackSide }), floor, wall, wall]);
      room.position.y = Y / 2; sc.add(room); // seen from the inside (back faces)
      sc.add(new T.HemisphereLight(0xff5a5a, 0x1a0006, 0.28));
      const l1 = new T.PointLight(0xff2a2a, 1.4, 20, 1.8); l1.position.set(-4, 3.8, 0); sc.add(l1);
      const l2 = new T.PointLight(0xff5a3a, 1.3, 20, 1.8); l2.position.set(4, 3.8, -2); sc.add(l2);
      const spot = new T.SpotLight(0xffd9b0, 2.2, 14, 0.55, 0.7, 1.6); spot.position.set(0, 4.5, -0.5); spot.target.position.set(0, 0, -0.5); sc.add(spot); sc.add(spot.target);
      // red light strips along the ceiling (glow like the trailer)
      for (const z of [-Z + 0.3, Z - 0.3]) { const s = new T.Mesh(new T.BoxGeometry(X * 2 - 1, 0.08, 0.08), new T.MeshBasicMaterial({ color: 0xff3040, toneMapped: false })); s.position.set(0, Y - 0.15, z); sc.add(s); }
      // shelves full of cash along three walls
      const shelves = [], decor = new T.Group(); sc.add(decor);
      const stackProto = (window.HModels && HModels.cashStack) ? H.markLinear(HModels.cashStack()) : null;
      const greenM = new T.MeshStandardMaterial({ color: 0x3f7d4a, roughness: 0.8 });
      const fallbackStack = () => { const g = new T.Group(); const m = new T.Mesh(new T.BoxGeometry(0.5, 0.22, 0.32), greenM); m.position.y = 0.11; g.add(m); return g; };
      const mkStack = () => stackProto ? stackProto.clone(true) : fallbackStack();
      const addShelf = (x, z, w, d, rotY) => {
        const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY; sc.add(g);
        for (let k = 0; k < 4; k++) { const b = new T.Mesh(new T.BoxGeometry(w, 0.06, d), metal); b.position.y = 0.35 + k * 0.95; g.add(b); }
        for (const sx of [-w / 2 + 0.05, w / 2 - 0.05]) for (const sz of [-d / 2 + 0.05, d / 2 - 0.05]) { const p = new T.Mesh(new T.BoxGeometry(0.06, 3.3, 0.06), metal); p.position.set(sx, 1.65, sz); g.add(p); }
        for (let k = 0; k < 4; k++) for (let i = 0; i < Math.floor(w / 0.56); i++) { if (Math.random() < 0.12) continue; const s = mkStack(); s.position.set(-w / 2 + 0.3 + i * 0.56, 0.38 + k * 0.95, 0); g.add(s); }
        shelves.push(g);
      };
      addShelf(0, -Z + 0.5, X * 2 - 2.5, 0.7, 0); addShelf(-X + 0.5, 0, Z * 2 - 3, 0.7, Math.PI / 2); addShelf(X - 0.5, 0, Z * 2 - 3, 0.7, -Math.PI / 2);
      // pallets in the middle with the collectible stacks
      const items = [];
      const pal = (x, z) => { const p = new T.Mesh(new T.BoxGeometry(1.4, 0.18, 1.1), new T.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.9 })); p.position.set(x, 0.09, z); sc.add(p); };
      const spots = [];
      for (const [x, z] of [[-4.5, -2.5], [0, -2.5], [4.5, -2.5], [-4.5, 2], [0, 2], [4.5, 2]]) { pal(x, z); for (let k = 0; k < 6; k++) spots.push([x - 0.45 + (k % 3) * 0.45, z - 0.25 + Math.floor(k / 3) * 0.5, 0.2]); }
      for (let k = 0; k < 4; k++) spots.push([-X + 1.5, -4 + k * 2.6, 0.02]);
      for (let k = 0; k < 4; k++) spots.push([X - 1.5, -4 + k * 2.6, 0.02]);
      for (const [x, z, y] of spots.slice(0, 40)) { const s = mkStack(); s.position.set(x, y, z); s.scale.setScalar(1.25); sc.add(s); items.push({ obj: s, x, z, taken: false, fly: 0 }); }
      // the big round vault door (open) at the entrance
      const door = new T.Mesh(new T.CylinderGeometry(1.9, 1.9, 0.5, 40), metal); door.rotation.z = Math.PI / 2; door.rotation.y = 0.9; door.position.set(-2.6, 2.0, Z - 0.9); sc.add(door);
      const ringM = new T.Mesh(new T.TorusGeometry(2.0, 0.16, 10, 40), new T.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 1, roughness: 0.3, envMap: H.env })); ringM.position.set(0, 2.0, Z - 0.05); sc.add(ringM);
      const exitGlow = new T.Mesh(new T.CircleGeometry(1.9, 32), new T.MeshBasicMaterial({ color: 0xffd9b0, toneMapped: false })); exitGlow.position.set(0, 2.0, Z - 0.02); exitGlow.rotation.y = Math.PI; sc.add(exitGlow);
      H.linearize(sc);
      this.vault = { scene: sc, items, lights: [l1, l2], bounds: { x0: -X + 1.1, x1: X - 1.1, z0: -Z + 1.2, z1: Z - 0.6 }, pallets: [[-4.5, -2.5], [0, -2.5], [4.5, -2.5], [-4.5, 2], [0, 2], [4.5, 2]], exit: { x: 0, z: Z - 1.1 } };
    }
    const V = this.vault, p = this.H.player;
    for (const it of V.items) { it.taken = false; it.fly = 0; it.obj.visible = true; it.obj.position.set(it.x, it.obj.position.y, it.z); it.obj.scale.setScalar(1.25); }
    V.px = 0; V.pz = V.exit.z - 3.6; V.ph = Math.PI; V.vx = V.vz = 0; V.timer = 40; V.alarm = false; V.got = 0; V.at = 0;
    if (p.rig.group.parent) p.rig.group.parent.remove(p.rig.group); V.scene.add(p.rig.group); p.rig.group.visible = true;
    this.H.cam.yaw = Math.PI; this.H.cam.pitch = 0.22;
    if (p.rig.bag) p.rig.bag.scale.setScalar(1);
    HHud.setObjective(t('h_missionTitle'), [{ t: t('h_o_vault'), cur: true }, { t: t('h_vaultTimer', { n: 40 }), cur: false }]);
    HHud.banner(t('h_vaultGo'), '', '', 2.2);
    HHud.prompt(); // nothing carried in from the street (e.g. an 'enter car' prompt)
  },
  vaultUpdate(dt) {
    const H = this.H, V = this.vault, p = H.player, cam = H.cam;
    const mv = H.moveInput(), run = mv.mag > 0.05 && (H.key('ShiftLeft', 'ShiftRight') || (mv.mag > 0.92 && !mv.keys));
    const sp = (run ? 6.2 : 3.8) * Math.min(1, mv.mag * 1.15);
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    V.vx = HX.damp(V.vx, (fx * -mv.y + rx * mv.x) * sp, 12, dt); V.vz = HX.damp(V.vz, (fz * -mv.y + rz * mv.x) * sp, 12, dt);
    V.px = HX.clamp(V.px + V.vx * dt, V.bounds.x0, V.bounds.x1); V.pz = HX.clamp(V.pz + V.vz * dt, V.bounds.z0, V.bounds.z1);
    for (const [x, z] of V.pallets) { const dx = V.px - x, dz = V.pz - z, ox = 0.7 + 0.35 - Math.abs(dx), oz = 0.55 + 0.35 - Math.abs(dz); if (ox > 0 && oz > 0) { if (ox < oz) V.px += Math.sign(dx) * ox; else V.pz += Math.sign(dz) * oz; } }
    const spd = Math.hypot(V.vx, V.vz);
    if (spd > 0.3) V.ph = V.ph + HX.wrapAngle(Math.atan2(V.vx, V.vz) - V.ph) * Math.min(1, dt * 12);
    V.at += dt * (spd > 0.3 ? spd / (run ? 6.2 : 3.8) : 1);
    p.rig.setPose(spd > 4.5 ? 'run' : spd > 0.3 ? 'walk' : 'idle', V.at, spd > 0.3 ? HX.clamp(spd / 5, 0.3, 1) : 1);
    p.rig.group.position.set(V.px, 0, V.pz); p.rig.group.rotation.y = V.ph;
    // grab cash by walking into it
    for (const it of V.items) {
      if (it.taken) { if (it.fly > 0) { it.fly = Math.max(0, it.fly - dt * 3); const o = it.obj; o.position.lerp(new H.T.Vector3(V.px, 1.1, V.pz), 1 - it.fly); o.scale.setScalar(1.25 * it.fly); if (it.fly <= 0) o.visible = false; } continue; }
      if (Math.hypot(it.x - V.px, it.z - V.pz) < 1.0) {
        it.taken = true; it.fly = 1; V.got++; this.addMoney(250000);
        if (window.HAudio) HAudio.sfx(V.got % 10 === 0 ? 'bigCash' : 'cash');
        if (p.rig.bag) p.rig.bag.scale.setScalar(1 + V.got * 0.02);
      }
    }
    // silent alarm timer -> alarm -> get out
    if (!V.alarm) {
      V.timer -= dt;
      if (V.timer <= 0 || V.got >= V.items.length) { V.alarm = true; if (window.HAudio) { HAudio.sfx('alarm'); HAudio.music('drive'); HAudio.musicIntensity(2); } HHud.banner(V.got >= V.items.length ? t('h_allCash') : t('h_alarm'), '', 'busted', 2.2); }
    } else {
      const ph = Math.floor(H.time * 4) % 2; V.lights[0].intensity = ph ? 4 : 0.6; V.lights[1].intensity = ph ? 0.6 : 4;
    }
    HHud.setObjective(t('h_missionTitle'), [{ t: t('h_o_vault') + `  ${V.got}/${V.items.length}`, cur: !V.alarm, done: V.alarm }, V.alarm ? { t: t('h_getOut'), cur: true } : { t: t('h_vaultTimer', { n: Math.ceil(Math.max(0, V.timer)) }), cur: false }]);
    // the exit
    const dE = Math.hypot(V.px - V.exit.x, V.pz - V.exit.z);
    if (V.alarm || V.got > 4) {
      if (dE < 1.6 && (V.alarm || H.actionPressed())) this.leaveVault();
      else if (dE < 2.4 && !V.alarm) HHud.prompt(Input.touchMode ? '🚗' : 'E', t('h_leaveVault')); else HHud.prompt();
    }
  },
  leaveVault() {
    const H = this.H, V = this.vault, p = H.player; if (this.step !== 'vault') return;
    this.step = 'leaving'; HHud.prompt(); HHud.fade(1, 0.3); if (window.HAudio) HAudio.sfx('alarmStop');
    this.later(() => {
      V.scene.remove(p.rig.group); H.scene.add(p.rig.group);
      // the red supercar is the getaway car: if the player swapped cars earlier, it takes over again
      const red = (H.parked || []).find(v => v.kind === 'sports' && v.rig.group.parent && !v.wrecked);
      if (red && red !== H.car) { H.parked = H.parked.filter(v => v !== red); if (H.car) H.parkOld(H.car); H.setPlayerCar(red); }
      if (!H.car || H.car.exploded) { if (H.car) HVehicle.remove(H.car); H.setPlayerCar(H.makeCar('sports', 0, 0, 0)); }
      // move whatever else sits on the getaway spot out of the way
      for (const o of H.parked || []) if (o !== H.car && Math.hypot(o.x - HWorld.hotel.carSpot.x, o.z - HWorld.hotel.carSpot.z) < 6) { o.x += 9; o.vx = o.vz = 0; HVehicle.sync(o, 0); }
      const ho = HWorld.hotel; H.spawnPlayer(ho.front.x - 2, ho.front.z, Math.PI / 2);
      H.car.x = ho.carSpot.x; H.car.z = ho.carSpot.z; H.car.h = ho.carSpot.h; H.car.vx = H.car.vz = 0; HVehicle.repair(H.car); HVehicle.sync(H.car, 0);
      H.state = 'play'; HHud.fade(0, 0.6);
      this.allowCrime = false; HAI.maxTraffic = 14; HAI.lockWanted = 2; HAI.setWanted(3, 'heist');
      HAI.spawnPolice(this.ctx(), { at: { x: -140 + 3.5, z: -110, h: 0 } }); HAI.spawnPolice(this.ctx(), { at: { x: -140 - 3.5, z: 50, h: Math.PI } });
      this.checkpoint = 'getaway';
      if (window.HAudio) { HAudio.music('drive'); HAudio.musicIntensity(3); }
      HHud.banner(t('h_wanted'), '', 'busted', 2.2);
      this.setStep('getaway');
    }, 330);
  },
  ctx() { const H = this.H, p = H.player, v = p.inCar; return { px: v ? v.x : p.x, pz: v ? v.z : p.z, pvx: 0, pvz: 0, cam: { x: H.cam.x, z: H.cam.z, fx: Math.sin(H.cam.yaw), fz: Math.cos(H.cam.yaw) } }; },
  roadblock() { // two cruisers angled across the causeway, facing the oncoming player (west)
    const c = this.ctx();
    HAI.spawnPolice(c, { block: true, at: { x: 318, z: -4.6, h: -0.75 } });
    HAI.spawnPolice(c, { block: true, at: { x: 318, z: 4.8, h: -2.4 } });
  },
  addMoney(n) { this.money += n; HHud.setMoney(this.money); HHud.toast('+$' + n.toLocaleString('en-US'), '#7dffb0'); },
  onEnterCar(v) { if (this.step === 'getaway' && v === this.H.car) { /* handled in update */ } },
  onExitCar() {},

  /* ---------- fail states ---------- */
  onBusted() { this.fail('busted'); },
  onWasted() { this.fail('wasted'); },
  fail(kind) {
    const H = this.H; if (H.state !== 'play') return;
    H.state = 'fail'; this.stats.busted++;
    HHud.banner(kind === 'busted' ? t('h_busted') : t('h_wasted'), '', kind, 2.8); HHud.prompt();
    if (window.HAudio) { HAudio.sfx(kind); HAudio.music(null); }
    H.doFlash(kind === 'busted' ? 0.1 : 0.6, 0.1, 0.12, 0.5);
    this.later(() => HHud.fade(1, 0.6), 2200);
    this.later(() => { this.restore(); HHud.fade(0, 0.6); }, 3000);
  },
  restore() {
    const H = this.H, p = H.player;
    HAI.reset(); HAI.onBusted = () => this.onBusted();
    if (p.inCar) { p.inCar = null; p.rig.group.visible = true; }
    const car = H.car;
    if (car.exploded || car.wrecked) { HVehicle.remove(car); H.setPlayerCar(H.makeCar('sports', 0, 0, 0)); }
    HVehicle.repair(H.car); H.car.exploded = false; p.hp = 100;
    if (this.mode === 'free') {
      this.money = Math.floor(this.money * 0.9); HHud.setMoney(this.money);
      this.placeCar(HX.SAFEHOUSE.x - 14, 0, -Math.PI / 2); H.spawnPlayer(HX.SAFEHOUSE.x - 14, 3, -Math.PI / 2); H.enterCar(H.car); H.state = 'play'; HAI.patrols = 2; return;
    }
    if (!this.checkpoint) { // failed before the heist (e.g. wrecked the supercar while exploring): back to the hotel, same objective, no stars
      const ho = HWorld.hotel;
      this.placeCar(ho.carSpot.x, ho.carSpot.z, ho.carSpot.h); H.car.inp.handbrake = true;
      H.tod = 0; H.applyTod(); H.spawnPlayer(ho.start.x, ho.start.z, ho.start.h);
      H.state = 'play'; HAI.maxTraffic = 12; HAI.patrols = 0; // HAI.reset() above cleared wanted + lockWanted
      if (window.HAudio) HAudio.music('stealth');
      this.setStep(this.step === 'enter' || this.step === 'vault-cut' ? 'enter' : 'meet'); return;
    }
    if (this.checkpoint === 'bridge') { this.placeCar(HX.BRIDGE_X0 + 12, 2.5, Math.PI / 2); H.tod = 0.35; }
    else { const ho = HWorld.hotel; this.placeCar(ho.carSpot.x, ho.carSpot.z, ho.carSpot.h); H.tod = 0; }
    H.applyTod();
    H.spawnPlayer(H.car.x + 2.5, H.car.z, H.car.h); H.enterCar(H.car);
    H.state = 'play'; HAI.lockWanted = 2; HAI.setWanted(3, 'retry'); HAI.maxTraffic = 14;
    this.flags.block = this.checkpoint === 'bridge'; this.flags.cpBridge = this.checkpoint === 'bridge'; // no roadblock right in front of a bridge respawn
    if (window.HAudio) { HAudio.music('drive'); HAudio.musicIntensity(3); }
    this.setStep('escape'); this.flags.escaping = true;
  },
  placeCar(x, z, h) { const c = this.H.car; c.x = x; c.z = z; c.h = h; c.vx = c.vz = 0; c.w = 0; HVehicle.sync(c, 0); },

  /* ---------- success ---------- */
  complete() {
    const H = this.H; if (H.state !== 'play') return;
    H.state = 'done'; this.step = 'done'; H.setMarker(null); HHud.prompt();
    const v = H.player.inCar; if (v) { v.vx *= 0.3; v.vz *= 0.3; v.inp.throttle = 0; v.inp.handbrake = true; }
    HAI.lockWanted = 0; HAI.setWanted(0); for (const c of HAI.police) c.ai.retire = true;
    const total = this.money;
    HHud.banner(t('h_heistComplete'), total > 0 ? '+$' + total.toLocaleString('en-US') : '', 'green', 0);
    if (window.HAudio) { HAudio.music(null); HAudio.sfx('heistComplete'); }
    this.stats.time = H.time - this.stats.t0;
    this.later(() => {
      HHud.hideBanner();
      this.cut('finale', () => this.results());
    }, 3400);
  },
  results() {
    const H = this.H, s = this.stats, el = document.createElement('section');
    el.className = 'screen dim'; el.id = 'hresults'; el.style.zIndex = 9;
    const mm = Math.floor(s.time / 60), ss = String(Math.floor(s.time % 60)).padStart(2, '0');
    el.innerHTML = `<div class="panel"><h2 class="logo" style="font-family:'Bebas Neue','Secular One',sans-serif;letter-spacing:2px">${t('h_missionComplete')}</h2>
      <p>${t('h_resultsText')}</p>
      <div class="statlist"><div><span>${t('h_s_take')}</span><b>$${this.money.toLocaleString('en-US')}</b></div><div><span>${t('s_time')}</span><b>${mm}:${ss}</b></div>
      <div><span>${t('h_s_stars')}</span><b>${'★'.repeat(Math.max(1, s.maxWanted))}</b></div><div><span>${t('h_s_busted')}</span><b>${s.busted}</b></div></div>
      <button class="btn big" type="button" data-a="free">${t('h_freeRoam')}</button><button class="btn" type="button" data-a="menu">${t('quit')}</button></div>`;
    H.stage.appendChild(el);
    if (window.HAudio) HAudio.sfx('missionComplete');
    try { localStorage.setItem('kotc_heist_done', '1'); const b = +(localStorage.getItem('kotc_heist_best') || 0); if (this.money > b) localStorage.setItem('kotc_heist_best', String(this.money)); } catch (e) {}
    el.querySelector('[data-a=free]').addEventListener('click', () => { el.remove(); this.startFree(false); });
    el.querySelector('[data-a=menu]').addEventListener('click', () => { el.remove(); H.quit(); });
    setTimeout(() => el.querySelector('[data-a=free]').focus(), 60);
  },

  /* ---------------- free roam ---------------- */
  startFree(fresh) {
    const H = this.H; this.mode = 'free'; this.step = 'free'; this.allowCrime = true;
    HAI.reset(); HAI.onBusted = () => this.onBusted(); HAI.lockWanted = 0; HAI.patrols = 2; HAI.maxTraffic = 16;
    if (fresh) { // straight from the menu: start at the island garage with the car
      if (!this.money) { try { this.money = +(localStorage.getItem('kotc_heist_best') || 0); } catch (e) {} }
    }
    if (H.player.inCar) H.exitCar();
    this.placeCar(HX.SAFEHOUSE.x - 16, 0, -Math.PI / 2); HVehicle.repair(H.car);
    H.spawnPlayer(HX.SAFEHOUSE.x - 16, 3, -Math.PI / 2); H.enterCar(H.car);
    H.state = 'play'; H.tod = 1; H.todTarget = null; this.todClock = 1; H.applyTod();
    HHud.resetMoney(this.money);
    this.spawnCash();
    this.updateFreeObjective();
    HHud.banner(t('h_freeTitle'), t('h_freeSub'), '', 3.5);
    if (window.HAudio) { HAudio.music('free'); HAudio.musicIntensity(0); }
    this.goal = null; H.setMarker(null);
  },
  CASH_N: 25,
  spawnCash() {
    const H = this.H, T = H.T, R = HX.rng(2024);
    for (const c of this.cash) if (c.obj && c.obj.parent) c.obj.parent.remove(c.obj);
    this.cash = [];
    const spots = [];
    for (const l of HWorld.lots) if (spots.length < 60) { if (l.park) spots.push([(l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2]); else if (R() < 0.18) spots.push([l.x0 - 2.2, (l.z0 + l.z1) / 2]); }
    for (let k = 0; k < 5; k++) spots.push([302 + R() * 22, -240 + k * 110 + R() * 30]);
    spots.push([570, 6], [880, -30], [930, 30], [-150, -60], [140, 140]);
    for (let k = spots.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [spots[k], spots[j]] = [spots[j], spots[k]]; }
    const beamM = new T.MeshBasicMaterial({ color: 0x5cf2a8, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: T.DoubleSide });
    const beamG = new T.CylinderGeometry(0.35, 0.35, 40, 10, 1, true); beamG.translate(0, 20, 0);
    spots.slice(0, this.CASH_N).forEach(([x, z], k) => {
      const id = 'c' + k; const taken = this.cashTaken.has(id);
      const g = new T.Group(); g.position.set(x, 0, z);
      let bag = null; if (window.HModels && HModels.cashBag) { try { bag = HModels.cashBag(); } catch (e) {} }
      if (!bag) { bag = new T.Mesh(new T.BoxGeometry(0.7, 0.45, 0.4), new T.MeshStandardMaterial({ color: 0x2e7d4f, emissive: 0x1a5a35, roughness: 0.5 })); bag.position.y = 0.5; }
      g.add(bag); if (!bag.update) { const beam = new T.Mesh(beamG, beamM); g.add(beam); beam.layers.enable(1); } // HModels bags bring their own beam
      g.visible = !taken; H.scene.add(g);
      this.cash.push({ id, x, z, obj: g, bag, taken });
    });
  },
  updateFreeObjective() {
    const got = this.cash.filter(c => c.taken).length;
    HHud.setObjective(t('h_freeTitle'), [{ t: t('h_o_cash', { n: got, m: this.cash.length }), cur: got < this.cash.length, done: got >= this.cash.length }, { t: t('h_o_explore'), cur: false }]);
  },
  freeUpdate(dt) {
    const H = this.H, p = H.player, pos = p.inCar || p;
    // day / night cycle: 0 night -> 1 sunrise -> 2 day -> 1 sunset -> 0 night (4 minutes)
    this.todClock = (this.todClock + dt / 60) % 4;
    const c = this.todClock; H.tod = c < 2 ? c : 4 - c; H.applyTod();
    for (const k of this.cash) {
      if (k.taken) continue;
      if (k.bag.update) k.bag.update(H.time + k.x * 0.1); else { k.bag.rotation.y += dt * 1.6; k.bag.position.y = 0.55 + Math.sin(H.time * 2 + k.x) * 0.12; }
      if (Math.hypot(k.x - pos.x, k.z - pos.z) < (p.inCar ? 3.4 : 1.8)) {
        k.taken = true; k.obj.visible = false; this.cashTaken.add(k.id);
        try { localStorage.setItem('kotc_heist_cash', JSON.stringify([...this.cashTaken])); } catch (e) {}
        this.addMoney(25000); if (window.HAudio) HAudio.sfx('cash');
        HFX3.glowBurst(k.x, 1, k.z, 0.36, 0.95, 0.66, 30, 6);
        this.updateFreeObjective();
        if (this.cash.every(q => q.taken)) { HHud.banner(t('h_allBags'), '+$1,000,000', 'green', 3.5); this.addMoney(1000000); if (window.HAudio) HAudio.sfx('heistComplete'); }
      }
    }
    if (window.HAudio) { HAudio.music(HAI.wanted > 0 ? 'drive' : 'free'); HAudio.musicIntensity(Math.min(3, HAI.wanted)); }
  },

  /* ---------------- GPS route over the road graph ---------------- */
  computeRoute(x0, z0, x1, z1) {
    const a = HX.nearestNode(x0, z0), b = HX.nearestNode(x1, z1);
    if (!a || !b) return null;
    if (a === b) return [{ x: x0, z: z0 }, { x: x1, z: z1 }];
    const dist = new Map([[a, 0]]), prev = new Map(), open = [a], done = new Set();
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (dist.get(open[k]) < dist.get(open[bi])) bi = k;
      const n = open.splice(bi, 1)[0]; if (n === b) break; if (done.has(n)) continue; done.add(n);
      for (const m of n.nbr) { const d = dist.get(n) + Math.hypot(m.x - n.x, m.z - n.z); if (!dist.has(m) || d < dist.get(m)) { dist.set(m, d); prev.set(m, n); open.push(m); } }
    }
    const path = []; let n = b; while (n) { path.unshift({ x: n.x, z: n.z }); n = prev.get(n); }
    if (path[0].x !== a.x || path[0].z !== a.z) return null;
    path.unshift({ x: x0, z: z0 }); path.push({ x: x1, z: z1 });
    return path;
  },
};
