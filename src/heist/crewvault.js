/* Chapter 3: the OCEAN TRUST BANK vault — the thermal-charge breach, the money burst and looting with an AI partner.
   Contract: CREW_SPEC.md section E1.

   API
   HCrewVault.open(H, { members: [{ id, rig, x?, z?, h? }], active, timer = 45, value = 5000, stackValue = 50000,
                        onBlown(), onAlarm(), onExit(result), onCash(total, delta) })  -> true
       Builds the interior (a cool blue-white antechamber with a marble floor and recessed lights, the big round steel
       door, the vault behind it with deposit-box walls, cash carts and pallets), takes over Heist.interior (state
       'interior') and moves the given rigs into it (close() hands them back to the parent + transform they had).
       Every member but the active one is an AI. Without onCash the HUD money shows HMission.money + the take.
       Phases (HCrewVault.phase):
         'enter' walk to the door, hold E (touch: the action button) ~1.4 s kneeling -> the charge is planted
         'fuse'  4 s of beeping: take cover (>= 5 m from the charge, or a pillar between you and it) or get thrown
         'blast' flash, shake, sparks, smoke, the door blown off its hinge (a ~1.8 s cinematic) -> onBlown()
         'blown' waits for resume() (without onBlown it resumes by itself)
         'burst' the money explosion: hundreds of bundles erupt from the vault, tumble, bounce and pile up; slow motion
         'loot'  walk over the cash to grab it ($5,000 a bundle, $50,000 a stack); the partner loots too (slower);
                 the countdown runs (opts.timer s)
         'alarm' onAlarm(): red strobes + siren, the partner runs for the exit; the active member walks out -> 'out'
         'out'   onExit(result) (without onExit the vault closes itself)
       The alarm also trips when everything is taken, or when the player leaves early through the exit (E): then
       onAlarm() and onExit() fire in that order, in the same frame.
   HCrewVault.resume()      after the story's 'vault' video cut that follows onBlown: starts the money burst.
   HCrewVault.setActive(id) the player switched (HCrew.onSwitch): the camera glides to that member, the other one
                            becomes the AI. Returns false for an unknown / already active id.
   HCrewVault.alarm()       force the alarm now.
   HCrewVault.close()       -> result. Leaves the interior (Heist.interior = null, state 'play' if it was 'interior'),
                            restores the rigs (a duffel stays visible + grown when that member looted), time scale,
                            grade, DOM and sounds, and frees everything it built. Runs by itself when Heist stops or
                            another module replaces Heist.interior.
   HCrewVault.result()      -> { cash, bundles, stacks, by: { [id]: { cash, bundles, stacks } }, alarm }
   Fields: active, phase, cash, bundles, curId.   Story/test helpers: plant() (plant now), blast() (blow it now). */
(function () {
  if (typeof I18N === 'undefined') return;
  Object.assign(I18N.he, {
    cv_title: 'הכספת',
    cv_o_plant: 'הצמידו את המטען התרמי לדלת',
    cv_o_cover: 'תפסו מחסה',
    cv_o_loot: 'תאספו כמה שיותר כסף',
    cv_o_alarm: 'אזעקה בעוד {n} שנ׳',
    cv_o_out: 'צאו מהכספת!',
    cv_hold: 'החזיקו כדי להצמיד את המטען',
    cv_cover: 'למחסה!',
    cv_coverSub: 'מאחורי עמוד, או 5 מטר אחורה',
    cv_inCover: 'במחסה',
    cv_noCover: 'קרוב מדי לפיצוץ!',
    cv_hit: 'קרוב מדי, הפיצוץ העיף אתכם!',
    cv_loot: 'תאספו את הכסף!',
    cv_lootSub: 'לפני שהאזעקה קופצת',
    cv_alarm: 'אזעקה!',
    cv_alarmSub: 'החוצה, עכשיו!',
    cv_clean: 'ניקינו את הכספת!',
    cv_leave: 'לצאת מהכספת (מפעיל את האזעקה)',
    cv_timer: 'אזעקה בעוד',
    cv_take: 'השלל',
    cv_n_yoav: 'יואב', cv_n_hadar: 'הדר', cv_n_ido: 'עידו',
  });
  Object.assign(I18N.en, {
    cv_title: 'THE VAULT',
    cv_o_plant: 'Plant the thermal charge on the door',
    cv_o_cover: 'Take cover',
    cv_o_loot: 'Grab as much cash as you can',
    cv_o_alarm: 'Alarm in {n}s',
    cv_o_out: 'Get out of the vault!',
    cv_hold: 'Hold to plant the charge',
    cv_cover: 'TAKE COVER!',
    cv_coverSub: 'Behind a pillar, or 5 m back',
    cv_inCover: 'IN COVER',
    cv_noCover: 'TOO CLOSE TO THE BLAST!',
    cv_hit: 'Too close — the blast threw you!',
    cv_loot: 'GRAB THE CASH!',
    cv_lootSub: 'before the alarm trips',
    cv_alarm: 'ALARM!',
    cv_alarmSub: 'Get out — now!',
    cv_clean: 'CLEANED OUT!',
    cv_leave: 'Leave the vault (trips the alarm)',
    cv_timer: 'ALARM IN',
    cv_take: 'TAKE',
    cv_n_yoav: 'Yoav', cv_n_hadar: 'Hadar', cv_n_ido: 'Ido',
  });
})();

const HCrewVault = {
  active: false, phase: 'off', H: null, o: null, V: null, members: [], ci: 0, run: 0,
  ACCENT: { yoav: '#ffd23f', hadar: '#5cf2a8', ido: '#4da3ff' }, FACE: { yoav: 0, hadar: 1, ido: 2 },
  // layout in metres: the antechamber spans z 0..AZ (entrance at +z), the vault wall z WZ..0, the vault z VZ..WZ.
  // The round opening (centre DCY, radius DR) is cut by the floor: 2*GAP wide at floor level.
  AX: 5.5, AZ: 13, AH: 4.6, WZ: -0.95, VX: 4.5, VZ: -10.5, VH: 3.6, DCY: 1.5, DR: 2.0, GAP: 1.32,
  PIL: [[-2.9, 4.8], [2.9, 4.8]], PHW: 0.42,
  CH: { x: 1.05, y: 0.76, z: 0.17 }, KNEEL: { x: 1.05, z: 0.76 }, EXIT: { x: 0, z: 12.1 },
  DOOR: { y: 1.5, z: -0.26, R: 1.96, D: 0.75 }, DOOR_REST: { x: 0.25, z: 6.7, ry: 0.32, t: 0.85 },
  CELL: 0.25, FUSE: 4, VALUE: 5000, STACK: 50000, BS: 1.8,

  get cash() { return this.V ? this.result().cash : 0; },
  get bundles() { return this.V ? this.result().bundles : 0; },
  get curId() { const m = this.cur(); return m ? m.id : null; },
  cur() { return this.members[this.ci] || null; },
  member(id) { return this.members.find(m => m.id === id) || null; },

  /* ======================================================================= lifecycle */
  open(H, o) {
    if (this.active) this.close();
    o = o || {}; this.H = H; this.o = o; this.run++;
    const T = H.T, q = H.q || 'high';
    this._own = []; this._bs = null; this.cp = null;
    this._tmp = { v: { x: 0, z: 0 }, v2: new T.Vector3(), o: new T.Object3D(), zm: new T.Matrix4().makeScale(0, 0, 0), col: new T.Color() };
    this.value = o.value > 0 ? o.value : this.VALUE; this.stackValue = o.stackValue > 0 ? o.stackValue : this.STACK;
    const base = o.onCash ? 0 : ((window.HMission && typeof HMission.money === 'number') ? HMission.money : (HHud.money || 0));
    this.V = {
      phase: 'enter', t: 0, rt: 0, plantK: 0, planting: false, action: null, fuse: 0, beepT: 0, keyT: 0, burn: 0,
      blastT: 0, blownSent: false, autoT: -1, doorT: -1, doorLanded: false, doorBounce: 0, burstAt: -1, burstT: 0,
      timer: o.timer > 0 ? o.timer : 45, timer0: o.timer > 0 ? o.timer : 45, tick: 99, alarmOn: false, alarmT: 0, cleaned: false,
      shot: null, flick: 0, fxI: 0, shake: 0, shockT: 0, accT: 0, base, objKey: '', hk: {}, lang: '', N: q === 'high' ? 420 : q === 'med' ? 300 : 200,
      fov: 0, exitSent: false, inCover: false, ms: 0,
    };
    this.build(T);
    this.setupMembers(o);
    const self = this;
    this._int = { scene: this.scene, update: dt => self.update(dt), camera: (dt, c, m) => self.camera(dt, c, m), touchButtons: () => self.touchButtons(), grade: 0.06, bloomTh: 1.0 };
    (H.extraScenes || (H.extraScenes = [])).push(this.scene);
    H.interior = this._int; H.state = 'interior';
    H.cam.yaw = Math.PI; H.cam.pitch = 0.2; H.cam.manualT = 0;
    this.active = true; this.phase = 'enter';
    this.ui();
    HHud.prompt(); if (H.setMarker && H.marker) H.setMarker(null);
    if (window.HAudio) { HAudio.music('stealth'); HAudio.musicIntensity(1); }
    this.precompile();
    // after every other module's update (HCrew re-syncs a rig to its street spot when control changes hands)
    this._mod = { update: () => { if (this.active) this.placeRigs(); } };
    (H.mods || (H.mods = [])).push(this._mod);
    this._wd = setInterval(() => { if (this.active && (!this.H.active || this.H.interior !== this._int)) this.close(); }, 400);
    return true;
  },
  close() {
    if (!this.active) return this._last || null;
    const H = this.H, V = this.V, res = this.result();
    this.active = false; this.phase = 'off'; this.run++;
    clearInterval(this._wd); this._wd = null;
    if (H.mods) { const i = H.mods.indexOf(this._mod); if (i >= 0) H.mods.splice(i, 1); }
    if (H.interior === this._int) { H.interior = null; if (H.state === 'interior') H.state = 'play'; }
    if (this.slow || V.slowOwned) { H.timeScale = 1; H.desat = V.prevDesat || 0; H.desatTint = V.prevTint || null; }
    this.slow = null;
    if (V.alarmOn && window.HAudio) HAudio.sfx('alarmStop');
    if (HHud.ready) { HHud.prompt(); HHud.setObjective('', []); }
    for (const m of this.members) {
      const g = m.rig.group, p = m.prev;
      if (g.parent) g.parent.remove(g);
      if (m.fbBag && m.fbBag.parent) m.fbBag.parent.remove(m.fbBag);
      if (!m.fbBag && m.bag && !(m.n + m.stacks)) { m.bag.visible = p.bagVis; m.bag.scale.setScalar(p.bagScale); }
      g.position.copy(p.pos); g.rotation.y = p.rot; g.visible = p.vis;
      try { m.rig.setPose('idle', 0, 1); } catch (e) {}
      if (p.parent && p.parent !== this.scene) p.parent.add(g);
    }
    if (H.extraScenes) { const i = H.extraScenes.indexOf(this.scene); if (i >= 0) H.extraScenes.splice(i, 1); }
    if (this.charge && this.charge.dispose) { try { this.charge.dispose(); } catch (e) {} }
    for (const r of this._own) { try { r.dispose(); } catch (e) {} }
    this._own = [];
    if (this.$ && this.$.root) this.$.root.remove();
    this.$ = null; this.scene = null; this.members = []; this._int = null; this.charge = null; this.bm = null; this.B = null; this.door = null;
    this._last = res;
    return res;
  },
  result() {
    if (!this.members.length && this._last && !this.active) return this._last;
    const by = {}; let cash = 0, n = 0, s = 0;
    for (const m of this.members) { by[m.id] = { cash: m.cash, bundles: m.n, stacks: m.stacks }; cash += m.cash; n += m.n; s += m.stacks; }
    return { cash, bundles: n, stacks: s, by, alarm: !!(this.V && this.V.alarmOn) };
  },
  own(x) { this._own.push(x); return x; },

  setupMembers(o) {
    const T = this.H.T; this.members = [];
    const list = (o.members || []).filter(mm => mm && mm.rig && mm.rig.group);
    const act = Math.max(0, list.findIndex(mm => mm.id === o.active));
    const spots = [[0.6, 11.0], [-0.9, 11.9], [1.8, 11.9]];
    list.forEach((mm, k) => {
      const rig = mm.rig, g = rig.group, j = k === act ? 0 : k < act ? k + 1 : k;
      const sp = spots[Math.min(j, spots.length - 1)];
      const m = {
        id: mm.id || ('m' + k), rig, prev: { parent: g.parent, pos: g.position.clone(), rot: g.rotation.y, vis: g.visible, bagVis: rig.bag ? rig.bag.visible : false, bagScale: rig.bag ? rig.bag.scale.x : 1 },
        x: mm.x !== undefined ? mm.x : sp[0], z: mm.z !== undefined ? mm.z : sp[1], h: mm.h !== undefined ? mm.h : Math.PI,
        vx: 0, vz: 0, at: Math.random() * 3, ph: Math.random() * 7, cash: 0, n: 0, stacks: 0, grabT: 0, knockT: 0, stepT: 0,
        pose: 'idle', poseK: 1, bag: rig.bag || null, fbBag: null, bx: 0, by: 1, bz: 0,
        ai: { mode: 'follow', path: null, pi: 0, gx: 0, gz: 0, replan: 0, tc: -1, grabT: 0, kneelT: 0, stuck: 0, spot: null, coverT: 0, g: { x: 0, z: 0 } },
      };
      if (!m.bag) { // stand-in duffel for rigs without one
        const b = new T.Group(), mesh = new T.Mesh(this.own(new T.BoxGeometry(0.5, 0.26, 0.26)), this.own(new T.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6 })));
        mesh.position.y = -0.15; b.add(mesh); b.position.set(-0.3, 0.72, 0.02); g.add(b); m.bag = b; m.fbBag = b; this.H.linearize(b);
      }
      m.bag.visible = false;
      if (g.parent) g.parent.remove(g);
      this.scene.add(g); g.visible = true;
      this.members.push(m);
    });
    this.ci = Math.max(0, this.members.findIndex(m => m.id === o.active));
    const A = this.cur();
    for (const m of this.members) m.ai.mode = m === A ? 'player' : 'follow';
    this.fp = A ? { x: A.x, z: A.z, x0: A.x, z0: A.z, t: 1, d: 1 } : { x: 0, z: 10, x0: 0, z0: 10, t: 1, d: 1 };
    this.syncRigs();
  },

  setActive(id) {
    if (!this.active) return false;
    const k = this.members.findIndex(m => m.id === id); if (k < 0 || k === this.ci) return false;
    const F = this.cur(), D = this.members[k], V = this.V;
    this.fp.x0 = this.fp.x; this.fp.z0 = this.fp.z; this.fp.t = 0; this.fp.d = 0.6; V.fov = 0.001;
    if (V.planting) V.planting = false;
    this.ci = k;
    if (F) { F.ai.mode = this.aiMode(); F.ai.path = null; F.ai.replan = 0; F.ai.tc = -1; F.ai.spot = F.ai.mode === 'cover' ? this.coverSpot(F) : null; }
    D.ai.mode = 'player'; D.ai.path = null; D.vx *= 0.3; D.vz *= 0.3;
    if (!(window.HCrew && HCrew.active) && window.HAudio) HAudio.sfx('whoosh', { intensity: 0.5 });
    V.hk.bags = '';
    return true;
  },
  aiMode() {
    const ph = this.V.phase;
    return ph === 'enter' ? 'follow' : ph === 'fuse' ? 'cover' : ph === 'loot' ? 'loot' : ph === 'alarm' || ph === 'out' ? 'exit' : 'stand';
  },

  /* ======================================================================= scene */
  build(T) {
    const H = this.H, sc = this.scene = new T.Scene(), own = x => this.own(x);
    const lin = hex => new T.Color(hex).convertSRGBToLinear();
    sc.background = lin(0x0a0d13); sc.fog = new T.Fog(lin(0x0c1018), 16, 34);
    const env = this.env = this.makeEnv(T);
    const tex = this.textures(T);
    const { AX, AZ, AH, WZ, VX, VZ, VH, DCY, DR } = this;
    // ---------------------------------------------------------------- materials (sRGB colours; linearized below)
    const M = this.M = {
      marble: own(new T.MeshStandardMaterial({ map: tex.marble, roughness: 0.3, metalness: 0.0, envMap: env, envMapIntensity: 0.5 })),
      wall: own(new T.MeshStandardMaterial({ map: tex.wall, roughness: 0.5, metalness: 0.05, envMap: env, envMapIntensity: 0.25 })),
      ceil: own(new T.MeshStandardMaterial({ map: tex.ceil, roughness: 0.9, metalness: 0, envMap: env, envMapIntensity: 0.2 })),
      facade: own(new T.MeshStandardMaterial({ map: tex.facade, roughness: 0.36, metalness: 0.75, envMap: env, envMapIntensity: 0.75 })),
      dark: own(new T.MeshStandardMaterial({ color: 0x414955, roughness: 0.38, metalness: 0.8, envMap: env, envMapIntensity: 0.9 })),
      chrome: own(new T.MeshStandardMaterial({ color: 0xd2dae4, roughness: 0.2, metalness: 1.0, envMap: env, envMapIntensity: 1.0 })),
      vc: own(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35, envMap: env, envMapIntensity: 0.6 })),
      vcm: own(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.9, envMap: env, envMapIntensity: 1.0 })),
      boxes: own(new T.MeshStandardMaterial({ map: tex.boxes, roughness: 0.32, metalness: 0.7, envMap: env, envMapIntensity: 0.8 })),
      vfloor: own(new T.MeshStandardMaterial({ map: tex.vfloor, roughness: 0.38, metalness: 0.25, envMap: env, envMapIntensity: 0.55 })),
      gold: own(new T.MeshStandardMaterial({ color: 0xe0b44c, roughness: 0.22, metalness: 1.0, envMap: env, envMapIntensity: 1.2 })),
      panel: own(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
      glow: own(new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
      beacon: own(new T.MeshBasicMaterial({ color: 0x401016, toneMapped: false })),
      sign: own(new T.MeshStandardMaterial({ map: tex.sign, transparent: true, roughness: 0.3, metalness: 0.9, envMap: env, envMapIntensity: 1.4, emissive: 0x3a2a08 })),
      plate: own(new T.MeshStandardMaterial({ map: tex.plate, roughness: 0.3, metalness: 0.85, envMap: env, envMapIntensity: 1.1 })),
      inlay: own(new T.MeshStandardMaterial({ map: tex.inlay, transparent: true, roughness: 0.5, metalness: 0.0, envMap: env, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false })),
      exit: own(new T.MeshBasicMaterial({ map: tex.exit, toneMapped: false })),
      lobby: own(new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
      scorch: own(new T.MeshBasicMaterial({ map: tex.scorch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, color: 0x000000, opacity: 0.85 })),
    };
    this.panelBase = [1.1, 1.18, 1.32]; M.panel.color.setRGB(1.1, 1.18, 1.32); M.panel.userData.lin = true;
    M.lobby.color.setRGB(1.25, 1.3, 1.4); M.lobby.userData.lin = true;
    M.glow.userData.lin = true; M.beacon.userData.lin = true;
    const add = (geo, mat, x, y, z, parent) => { own(geo); const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); (parent || sc).add(m); return m; };
    const uvScale = (g, su, sv) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; };
    // ---------------------------------------------------------------- the antechamber
    const fl = uvScale(new T.PlaneGeometry(AX * 2, AZ - WZ), AX * 2 / 2.4, (AZ - WZ) / 2.4); fl.rotateX(-Math.PI / 2);
    add(fl, M.marble, 0, 0, (AZ + WZ) / 2);
    const ce = uvScale(new T.PlaneGeometry(AX * 2, AZ), AX * 2 / 1.2, AZ / 1.2); ce.rotateX(Math.PI / 2);
    add(ce, M.ceil, 0, AH, AZ / 2);
    for (const s of [-1, 1]) { const w = uvScale(new T.PlaneGeometry(AZ, AH), AZ / 2.4, 1); w.rotateY(-s * Math.PI / 2); add(w, M.wall, s * AX, AH / 2, AZ / 2); }
    { // the entrance wall with its doorway (and a short bright corridor to the lobby behind it)
      const sh = new T.Shape(); sh.moveTo(-AX, 0); sh.lineTo(-1.2, 0); sh.lineTo(-1.2, 3.0); sh.lineTo(1.2, 3.0); sh.lineTo(1.2, 0); sh.lineTo(AX, 0); sh.lineTo(AX, AH); sh.lineTo(-AX, AH); sh.lineTo(-AX, 0);
      const g = new T.ShapeGeometry(sh); const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + AX) / 2.4, p.getY(i) / AH);
      g.rotateY(Math.PI); add(g, M.wall, 0, 0, AZ);
      const cf = uvScale(new T.PlaneGeometry(2.4, 3.2), 1, 1.3); cf.rotateX(-Math.PI / 2); add(cf, M.marble, 0, 0, AZ + 1.6);
      for (const s of [-1, 1]) { const cw = uvScale(new T.PlaneGeometry(3.2, 3.0), 1.3, 0.65); cw.rotateY(-s * Math.PI / 2); add(cw, M.wall, s * 1.2, 1.5, AZ + 1.6); }
      const cc = new T.PlaneGeometry(2.4, 3.2); cc.rotateX(Math.PI / 2); add(cc, M.lobby, 0, 3.0, AZ + 1.6);
      const end = new T.PlaneGeometry(2.4, 3.0); end.rotateY(Math.PI); add(end, M.lobby, 0, 1.5, AZ + 3.2);
    }
    // ---------------------------------------------------------------- the vault wall with the round opening
    const a = Math.asin(DCY / DR), cHalf = Math.sqrt(DR * DR - DCY * DCY);
    const archShape = (W, Ht) => {
      const sh = new T.Shape(); sh.moveTo(-W, 0); sh.lineTo(-cHalf, 0);
      for (let i = 0; i <= 48; i++) { const th = Math.PI + a - (Math.PI + 2 * a) * i / 48; sh.lineTo(DR * Math.cos(th), DCY + DR * Math.sin(th)); }
      sh.lineTo(W, 0); sh.lineTo(W, Ht); sh.lineTo(-W, Ht); sh.lineTo(-W, 0);
      const g = new T.ShapeGeometry(sh); const uv = g.attributes.uv, p = g.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + W) / 2.4, p.getY(i) / 2.4);
      return g;
    };
    add(archShape(AX, AH), M.facade, 0, 0, 0);
    { const g = archShape(VX, VH); g.rotateY(Math.PI); add(g, M.dark, 0, 0, WZ); }
    { // the tunnel through the wall (the inside of the opening)
      const n = 40, pos = [], nor = [], uvs = [];
      for (let i = 0; i < n; i++) {
        const t0 = Math.PI + a - (Math.PI + 2 * a) * i / n, t1 = Math.PI + a - (Math.PI + 2 * a) * (i + 1) / n;
        const P = (th, z) => [DR * Math.cos(th), DCY + DR * Math.sin(th), z], N = th => [-Math.cos(th), -Math.sin(th), 0];
        const q = [P(t0, 0), P(t1, 0), P(t1, WZ), P(t0, WZ)], nn = [N(t0), N(t1), N(t1), N(t0)], uu = [[i / n * 6, 0], [(i + 1) / n * 6, 0], [(i + 1) / n * 6, 0.4], [i / n * 6, 0.4]];
        for (const idx of [0, 1, 2, 0, 2, 3]) { pos.push(...q[idx]); nor.push(...nn[idx]); uvs.push(...uu[idx]); }
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
      const m = add(g, M.facade, 0, 0, 0); m.material = own(M.facade.clone()); m.material.side = T.DoubleSide;
    }
    // chrome frame ring around the opening + a darker backing plate
    { const g = new T.TorusGeometry(DR + 0.17, 0.17, 12, 72, Math.PI + 2 * a); g.rotateZ(-a); add(g, M.chrome, 0, DCY, 0.04); }
    { const g = new T.RingGeometry(DR, DR + 0.62, 72, 1, -a, Math.PI + 2 * a); add(g, M.dark, 0, DCY, 0.012); }
    // gold lettering above the door
    add(new T.PlaneGeometry(4.6, 0.72), M.sign, 0, 4.18, 0.02);
    // ---------------------------------------------------------------- merged decor (vertex colours)
    const dec = [], decM = [], glow = [];
    const vbox = (list, w, h, d, col, x, y, z, ry) => { const g = new T.BoxGeometry(w, h, d).toNonIndexed(); if (ry) g.rotateY(ry); g.translate(x, y, z); return this.vcol(list, g, col); };
    const vcyl = (list, r0, r1, h, seg, col, x, y, z, rx, rz) => { const g = new T.CylinderGeometry(r0, r1, h, seg).toNonIndexed(); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z); return this.vcol(list, g, col); };
    // crown moulding + skirting along the side walls, cornice over the vault wall and the entrance
    for (const s of [-1, 1]) { vbox(dec, 0.12, 0.16, AZ, 0xf1f4f8, s * (AX - 0.06), AH - 0.12, AZ / 2); vbox(dec, 0.06, 0.12, AZ, 0x161b22, s * (AX - 0.03), 0.06, AZ / 2); }
    vbox(dec, AX * 2, 0.16, 0.14, 0xf1f4f8, 0, AH - 0.12, 0.07); vbox(dec, AX * 2, 0.16, 0.14, 0xf1f4f8, 0, AH - 0.12, AZ - 0.07);
    // pillars: white marble shafts with dark plinths and chrome bands
    for (const [px, pz] of this.PIL) {
      const sg = uvScale(new T.BoxGeometry(this.PHW * 2, AH, this.PHW * 2), 0.36, 1.9); add(sg, M.marble, px, AH / 2, pz);
      vbox(dec, 1.0, 0.36, 1.0, 0x222a35, px, 0.18, pz); vbox(decM, 1.03, 0.05, 1.03, 0xd8dee6, px, 0.385, pz);
      vbox(dec, 1.0, 0.3, 1.0, 0xeef2f6, px, AH - 0.15, pz); vbox(decM, 0.94, 0.04, 0.94, 0xd8dee6, px, AH - 0.32, pz);
    }
    // keypad by the door, CCTV cameras, beacon housings, the exit sign
    vbox(dec, 0.26, 0.38, 0.07, 0x1b1f25, -2.95, 1.45, 0.035); vbox(glow, 0.18, 0.06, 0.01, 0x1df28a, -2.95, 1.55, 0.075);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) vbox(decM, 0.045, 0.035, 0.012, 0xb9c2cc, -3.0 + c * 0.055, 1.46 - r * 0.05, 0.075);
    for (const [cx, cz, ry] of [[-AX + 0.3, 0.45, 0.7], [AX - 0.3, AZ - 0.45, -2.4]]) {
      vbox(dec, 0.1, 0.1, 0.25, 0x30363f, cx, AH - 0.32, cz, ry); vbox(dec, 0.2, 0.17, 0.34, 0xe9edf1, cx, AH - 0.5, cz, ry);
      vbox(glow, 0.03, 0.03, 0.01, 0xff2a2a, cx + Math.sin(ry) * 0.18, AH - 0.46, cz + Math.cos(ry) * 0.18);
    }
    for (const bx of [-3.9, 3.9]) vbox(dec, 0.34, 0.12, 0.16, 0x1a1e24, bx, 3.68, 0.08);
    vbox(dec, 0.9, 0.3, 0.06, 0x101418, 0, 3.26, AZ - 0.04);
    add(new T.PlaneGeometry(0.8, 0.24), M.exit, 0, 3.26, AZ - 0.075).rotation.y = Math.PI;
    // the hinge barrel on the right edge of the opening
    vcyl(decM, 0.17, 0.17, 2.6, 18, 0x9aa4af, 2.32, 1.5, 0.3); vcyl(decM, 0.2, 0.2, 0.16, 18, 0x6c7681, 2.32, 2.86, 0.3); vcyl(decM, 0.2, 0.2, 0.16, 18, 0x6c7681, 2.32, 0.14, 0.3);
    vbox(dec, 0.5, 2.9, 0.22, 0x4a525d, 2.4, 1.5, 0.11);
    // recessed ceiling light panels in their frames
    const pan = [];
    for (const lx of [-3.3, 0, 3.3]) for (const lz of [1.9, 4.9, 7.9, 10.9]) {
      const g = new T.PlaneGeometry(1.7, 0.62); g.rotateX(Math.PI / 2); g.translate(lx, AH - 0.012, lz); pan.push(g);
      vbox(dec, 1.86, 0.03, 0.78, 0xcfd6de, lx, AH - 0.004, lz);
    }
    // ---------------------------------------------------------------- the vault room (hidden until the door is gone)
    const vg = this.vaultG = new T.Group(); sc.add(vg);
    const vf = uvScale(new T.PlaneGeometry(VX * 2, WZ - VZ), VX * 2 / 2, (WZ - VZ) / 2); vf.rotateX(-Math.PI / 2); add(vf, M.vfloor, 0, 0, (WZ + VZ) / 2, vg);
    const vc = uvScale(new T.PlaneGeometry(VX * 2, WZ - VZ), VX * 2 / 1.2, (WZ - VZ) / 1.2); vc.rotateX(Math.PI / 2); add(vc, M.ceil, 0, VH, (WZ + VZ) / 2, vg);
    const bh = VH - 0.32, vdec = [], vdecM = [], gold = [];
    for (const s of [-1, 1]) { const w = uvScale(new T.PlaneGeometry(WZ - VZ, bh), (WZ - VZ) / 3, bh / 1.5); w.rotateY(-s * Math.PI / 2); add(w, M.boxes, s * VX, 0.32 + bh / 2, (WZ + VZ) / 2, vg); vbox(vdec, 0.08, 0.32, WZ - VZ, 0x232930, s * (VX - 0.04), 0.16, (WZ + VZ) / 2); }
    { const w = uvScale(new T.PlaneGeometry(VX * 2, bh), VX * 2 / 3, bh / 1.5); add(w, M.boxes, 0, 0.32 + bh / 2, VZ, vg); vbox(vdec, VX * 2, 0.32, 0.08, 0x232930, 0, 0.16, VZ + 0.04); }
    for (const lx of [-2.6, 0, 2.6]) { const g = new T.PlaneGeometry(0.22, WZ - VZ - 1.4); g.rotateX(Math.PI / 2); g.translate(lx, VH - 0.012, (WZ + VZ) / 2 - 0.3); pan.push(g); vbox(vdec, 0.3, 0.03, WZ - VZ - 1.3, 0xcfd6de, lx, VH - 0.004, (WZ + VZ) / 2 - 0.3); }
    // vault props: pallets, cash carts, a table of gold. Each is a collider (people + bundles); the cash on them is loot
    this.props = []; this.stacks = [];
    const stackSpot = (x, y, z, s, ry) => this.stacks.push({ x, y, z, s, ry, taken: false, fly: -1, obj: null, cell: -1, who: 0 });
    for (const [px, pz] of [[-2.5, -6.0], [2.5, -6.0], [0, -8.6]]) {
      vbox(vdec, 1.3, 0.04, 1.0, 0x9a7a52, px, 0.13, pz); for (const sx of [-0.55, 0, 0.55]) vbox(vdec, 0.12, 0.11, 1.0, 0x7d6140, px + sx, 0.055, pz);
      stackSpot(px - 0.32, 0.15, pz, 1.3, 0.05); stackSpot(px + 0.32, 0.15, pz, 1.3, -0.04);
      this.props.push({ x0: px - 0.68, z0: pz - 0.53, x1: px + 0.68, z1: pz + 0.53, h: 0.9 });
    }
    for (const [cx, cz] of [[-3.45, -3.2], [3.45, -3.7]]) {
      for (const sx of [-0.52, 0.52]) for (const sz of [-0.27, 0.27]) { vbox(vdecM, 0.04, 0.95, 0.04, 0xaab3bd, cx + sx, 0.55, cz + sz); vcyl(vdec, 0.05, 0.05, 0.04, 10, 0x15171a, cx + sx, 0.05, cz + sz, 0, Math.PI / 2); }
      vbox(vdecM, 1.1, 0.03, 0.6, 0x9ba4ae, cx, 0.3, cz); vbox(vdecM, 1.1, 0.03, 0.6, 0x9ba4ae, cx, 0.92, cz);
      vbox(vdecM, 0.03, 0.03, 0.6, 0xc8d0d8, cx + 0.62, 1.05, cz);
      stackSpot(cx, 0.935, cz, 1.05, 0.1);
      this.props.push({ x0: cx - 0.6, z0: cz - 0.34, x1: cx + 0.6, z1: cz + 0.34, h: 1.2 });
    }
    { // the gold table (too heavy to carry)
      const tx = 0, tz = -4.9;
      vbox(vdecM, 1.6, 0.05, 0.8, 0x8d969f, tx, 0.82, tz); for (const sx of [-0.74, 0.74]) for (const sz of [-0.34, 0.34]) vbox(vdecM, 0.05, 0.8, 0.05, 0x6f7881, tx + sx, 0.4, tz + sz);
      for (let l = 0; l < 3; l++) for (let i = 0; i < 6 - l * 2; i++) for (let j = 0; j < 2; j++) {
        const g = new T.BoxGeometry(0.22, 0.055, 0.095).toNonIndexed(); g.translate(tx - 0.55 + l * 0.22 + i * 0.22, 0.875 + l * 0.055, tz - 0.07 + j * 0.14); gold.push(g);
      }
      this.props.push({ x0: tx - 0.85, z0: tz - 0.45, x1: tx + 0.85, z1: tz + 0.45, h: 1.0 });
    }
    const merged = (list, mat, parent) => list.length ? add(this.merge(list), mat, 0, 0, 0, parent) : null;
    merged(dec, M.vc); merged(decM, M.vcm); merged(glow, M.glow);
    merged(vdec, M.vc, vg); merged(vdecM, M.vcm, vg); merged(gold, M.gold, vg);
    this.panels = merged(pan, M.panel);
    // the lootable cash stacks (HModels.cashStack, else plain blocks)
    for (const s of this.stacks) {
      let m = null;
      if (window.HModels && HModels.cashStack) { try { m = H.markLinear(HModels.cashStack()); } catch (e) { m = null; } }
      if (!m) { const bg = this.own(new T.BoxGeometry(0.48, 0.5, 0.48)); bg.translate(0, 0.25, 0); m = new T.Mesh(bg, this.own(new T.MeshStandardMaterial({ color: 0x6f9a6a, roughness: 0.8 }))); }
      m.position.set(s.x, s.y, s.z); m.rotation.y = s.ry; m.scale.setScalar(s.s); vg.add(m); s.obj = m;
    }
    // floor inlay near the entrance, scorch decals (shown after the blast)
    { const g = new T.CircleGeometry(1.75, 64); g.rotateX(-Math.PI / 2); add(g, M.inlay, 0, 0.003, 9.6); }
    { const g = new T.CircleGeometry(2.6, 40); g.rotateX(-Math.PI / 2); this.scorchF = add(g, M.scorch, 0.7, 0.006, 1.7); this.scorchF.visible = false; }
    { const g = new T.RingGeometry(DR - 0.05, DR + 1.5, 64, 1, -a, Math.PI + 2 * a); this.scorchW = add(g, M.scorch, 0, DCY, 0.07); this.scorchW.visible = false; }
    // alarm beacons (domes under the housings)
    this.beacons = [];
    for (const bx of [-3.9, 3.9]) { const g = new T.SphereGeometry(0.11, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI); this.beacons.push(add(g, M.beacon, bx, 3.62, 0.1)); }
    // ---------------------------------------------------------------- the door
    this.door = this.buildDoor(T, M);
    // ---------------------------------------------------------------- the thermal charge + its burn glow
    let ch = null;
    if (window.HModels && HModels.thermalCharge) { try { ch = H.markLinear(HModels.thermalCharge()); } catch (e) { ch = null; } }
    if (!ch) {
      ch = new T.Group(); const body = new T.Mesh(this.own(new T.BoxGeometry(0.32, 0.24, 0.07)), this.own(new T.MeshStandardMaterial({ color: 0x5f6649, roughness: 0.7 }))); body.position.z = 0.035; ch.add(body);
      const led = new T.Mesh(this.own(new T.SphereGeometry(0.016, 8, 6)), this.own(new T.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }))); led.position.set(0.1, 0.07, 0.075); ch.add(led);
      ch.update = (t, rate) => { led.visible = ((t * (rate || 1) * 1.6) % 1) < 0.35; };
      H.linearize(ch);
    }
    ch.position.set(this.CH.x, this.CH.y, this.CH.z); ch.scale.setScalar(1.45); ch.visible = false; sc.add(ch); this.charge = ch;
    this.burnG = new T.Sprite(own(new T.SpriteMaterial({ map: tex.glowT, color: 0xffc58a, blending: T.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })));
    this.burnG.material.userData.lin = true; this.burnG.position.set(this.CH.x, this.CH.y, this.CH.z + 0.14); this.burnG.visible = false; sc.add(this.burnG);
    // ---------------------------------------------------------------- markers + shockwave
    const mkRing = (r, g2, b) => {
      const g = new T.Group();
      const ring = new T.Mesh(own(new T.RingGeometry(0.5, 0.66, 40)), own(new T.MeshBasicMaterial({ transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })));
      ring.material.color.setRGB(r, g2, b); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
      const d = new T.Mesh(own(new T.CircleGeometry(0.5, 32)), own(new T.MeshBasicMaterial({ map: tex.glowT, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })));
      d.material.color.setRGB(r, g2, b); d.rotation.x = -Math.PI / 2; d.position.y = 0.015; g.add(d);
      g.traverse(o => { if (o.material) o.material.userData.lin = true; });
      g.visible = false; sc.add(g); return g;
    };
    this.mkPlant = mkRing(1.0, 0.75, 0.12); this.mkPlant.position.set(this.KNEEL.x, 0, this.KNEEL.z);
    this.mkExit = mkRing(0.25, 1.0, 0.55); this.mkExit.position.set(this.EXIT.x, 0, this.EXIT.z);
    this.shock = add(new T.RingGeometry(0.85, 1.0, 56), own(new T.MeshBasicMaterial({ transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false })), this.CH.x, 0.05, 0.8);
    this.shock.material.color.setRGB(1.6, 1.25, 0.8); this.shock.material.userData.lin = true; this.shock.rotation.x = -Math.PI / 2; this.shock.visible = false;
    // ---------------------------------------------------------------- lights
    const L = this.L = {};
    L.hemi = new T.HemisphereLight(lin(0xd0dcf6), lin(0x252b37), 0.42); sc.add(L.hemi);
    const pl = (hex, i, d, x, y, z) => { const l = new T.PointLight(lin(hex), i, d, 1.6); l.position.set(x, y, z); l.userData.base = i; sc.add(l); return l; };
    L.a1 = pl(0xd8e5ff, 0.95, 17, 0, AH - 0.4, 7.6);
    L.a2 = pl(0xd8e5ff, 0.85, 15, 0, AH - 0.4, 3.4);
    L.v1 = pl(0xeef3ff, 1.3, 11, 0, VH - 0.4, -4.8);
    L.f1 = pl(0xff3040, 0, 18, -3.4, 3.8, 2.6); L.f2 = pl(0x3050ff, 0, 18, 3.4, 3.8, 2.6);
    L.spot = new T.SpotLight(lin(0xd8e6ff), 0.6, 12, 0.6, 0.8, 1.3); L.spot.position.set(0, AH - 0.15, 2.6); L.spot.target.position.set(0, 1.4, 0); L.spot.userData.base = 0.6; sc.add(L.spot); sc.add(L.spot.target);
    // ---------------------------------------------------------------- particles + the money
    this.fxA = this.mkPts(T, 760, true, tex.glowT);
    this.fxN = this.mkPts(T, 380, false, tex.smokeT);
    this.initBundles(T);
    this.initGrid();
    // ---------------------------------------------------------------- linear colours (HModels parts are already marked)
    H.linearize(sc);
    this.vaultG.visible = false;
  },

  // vertex-coloured, non-indexed geometry for merging
  vcol(list, g, hex) {
    const T = this.H.T, c = new T.Color(hex).convertSRGBToLinear(), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(a, 3)); list.push(g); return g;
  },
  merge(list) {
    const T = this.H.T; let n = 0; const col = list.some(g => g.attributes.color);
    const parts = list.map(g => g.index ? g.toNonIndexed() : g);
    for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), cl = col ? new Float32Array(n * 3) : null;
    let o = 0;
    for (const g of parts) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3); nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
      if (cl) { if (g.attributes.color) cl.set(g.attributes.color.array.subarray(0, c * 3), o * 3); else cl.fill(1, o * 3, (o + c) * 3); }
      o += c; g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('uv', new T.BufferAttribute(uv, 2));
    if (cl) out.setAttribute('color', new T.BufferAttribute(cl, 3));
    out.computeBoundingSphere();
    return out;
  },

  buildDoor(T, M) {
    const g = new T.Group(), D = this.DOOR, R = D.R, fz = D.D / 2;
    const steel = [], chrome = [];
    const cyl = (list, r0, r1, h, seg, col, x, y, z, rx, rz) => { const q = new T.CylinderGeometry(r0, r1, h, seg).toNonIndexed(); if (rx) q.rotateX(rx); if (rz) q.rotateZ(rz); q.translate(x, y, z); return this.vcol(list, q, col); };
    cyl(steel, R, R, D.D, 72, 0x5d6772, 0, 0, 0, Math.PI / 2);
    cyl(steel, R - 0.12, R - 0.12, 0.05, 72, 0x6c7783, 0, 0, fz + 0.02, Math.PI / 2);
    cyl(steel, 1.02, 1.02, 0.07, 56, 0x76818d, 0, 0, fz + 0.05, Math.PI / 2);
    // the locking bolts round the edge (seen once the door lies on the floor)
    for (let k = 0; k < 14; k++) { const an = k / 14 * Math.PI * 2; cyl(chrome, 0.075, 0.075, 0.34, 12, 0xcfd7e0, Math.cos(an) * (R + 0.12), Math.sin(an) * (R + 0.12), -0.05, 0, an - Math.PI / 2); }
    const ring = (r, tube) => { const q = new T.TorusGeometry(r, tube, 8, 72).toNonIndexed(); q.translate(0, 0, fz + 0.06); return this.vcol(chrome, q, 0xe3e9f0); };
    ring(1.72, 0.05); ring(1.1, 0.04);
    for (let k = 0; k < 24; k++) { const an = k / 24 * Math.PI * 2; cyl(chrome, 0.055, 0.055, 0.06, 10, 0xd2d9e1, Math.cos(an) * 1.86, Math.sin(an) * 1.86, fz + 0.04, Math.PI / 2); }
    // hub + the spoked wheel
    cyl(chrome, 0.3, 0.34, 0.24, 28, 0xd7dee6, 0, 0, fz + 0.16, Math.PI / 2);
    for (let k = 0; k < 3; k++) cyl(chrome, 0.045, 0.045, 1.5, 12, 0xdfe5ec, 0, 0, fz + 0.3, 0, k * Math.PI / 3);
    for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3, q = new T.SphereGeometry(0.09, 14, 10).toNonIndexed(); q.translate(Math.cos(an + Math.PI / 2) * 0.75, Math.sin(an + Math.PI / 2) * 0.75, fz + 0.3); this.vcol(chrome, q, 0xe6ebf1); }
    { const q = new T.SphereGeometry(0.17, 18, 12).toNonIndexed(); q.scale(1, 1, 0.6); q.translate(0, 0, fz + 0.3); this.vcol(chrome, q, 0xe6ebf1); }
    // the hinge arms (they break off with the door)
    for (const y of [-0.85, 0.85]) { const q = new T.BoxGeometry(0.85, 0.24, 0.2).toNonIndexed(); q.translate(1.95, y, fz + 0.12); this.vcol(steel, q, 0x4c555f); }
    const dm = this.own(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.85, envMap: this.env, envMapIntensity: 0.8 }));
    g.add(new T.Mesh(this.own(this.merge(steel)), dm), new T.Mesh(this.own(this.merge(chrome)), dm));
    const plate = new T.Mesh(this.own(new T.PlaneGeometry(1.05, 0.26)), M.plate); plate.position.set(0, 1.42, fz + 0.051); g.add(plate);
    g.position.set(0, D.y, D.z); this.scene.add(g);
    return g;
  },

  makeEnv(T) {
    const H = this.H, pm = new T.PMREMGenerator(H.renderer), es = new T.Scene(), tmp = [];
    es.background = new T.Color(0x4a566a);
    const room = new T.Mesh(new T.BoxGeometry(24, 9, 30), new T.MeshBasicMaterial({ color: 0x5d6a80, side: T.BackSide })); room.position.y = 3; es.add(room); tmp.push(room);
    const flo = new T.Mesh(new T.PlaneGeometry(24, 30), new T.MeshBasicMaterial({ color: 0x2a3038 })); flo.rotation.x = -Math.PI / 2; flo.position.y = -1.4; es.add(flo); tmp.push(flo);
    for (const x of [-5, 0, 5]) for (const z of [-9, -3, 3, 9]) { const p = new T.Mesh(new T.PlaneGeometry(2.6, 1.2), new T.MeshBasicMaterial({ color: 0xffffff })); p.rotation.x = Math.PI / 2; p.position.set(x, 7.4, z); es.add(p); tmp.push(p); }
    const rt = pm.fromScene(es, 0.025); pm.dispose();
    for (const m of tmp) { m.geometry.dispose(); m.material.dispose(); }
    this.own(rt);
    return rt.texture;
  },

  /* ---------------------------------------------------------------- canvas textures */
  textures(T) {
    const own = x => this.own(x), aniso = (this.H.renderer && this.H.renderer.capabilities.getMaxAnisotropy()) || 4;
    const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const tx = (c, rep, srgb) => { const t = own(new T.CanvasTexture(c)); if (srgb !== false) t.encoding = T.sRGBEncoding; t.anisotropy = Math.min(8, aniso); if (rep) t.wrapS = t.wrapT = T.RepeatWrapping; return t; };
    const R = HX.rng(1931);
    const vein = (g, x, y, a0, len, cols) => {
      const pts = [[x, y]]; let a = a0;
      for (let k = 0; k < 7; k++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * len * (0.6 + R() * 0.6); y += Math.sin(a) * len * (0.6 + R() * 0.6); pts.push([x, y]); }
      for (const [lw, c] of cols) { g.lineWidth = lw; g.strokeStyle = c; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length - 1; k++) g.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2); g.stroke(); }
    };
    const out = {};
    { // white marble floor: 2 x 2 tiles of 1.2 m
      const [c, g] = cv(1024, 1024);
      for (let ty = 0; ty < 2; ty++) for (let tx2 = 0; tx2 < 2; tx2++) {
        const x0 = tx2 * 512, y0 = ty * 512; g.save(); g.beginPath(); g.rect(x0, y0, 512, 512); g.clip();
        const sh = 216 + Math.floor(R() * 8); g.fillStyle = `rgb(${sh - 9},${sh - 3},${sh + 7})`; g.fillRect(x0, y0, 512, 512);
        for (let k = 0; k < 34; k++) { const x = x0 + R() * 512, y = y0 + R() * 512, r = 40 + R() * 150, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${R() < 0.5 ? '150,165,188' : '255,255,255'},${0.05 + R() * 0.06})`); gr.addColorStop(1, 'rgba(150,165,188,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
        for (let k = 0; k < 6; k++) vein(g, x0 + R() * 512, y0 + R() * 512, R() * 6.28, 70 + R() * 50, [[9, 'rgba(120,136,160,0.05)'], [3.2, 'rgba(112,128,152,0.16)'], [1.1, 'rgba(84,100,126,0.42)']]);
        for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(255,255,255,${0.2 + R() * 0.3})`; g.fillRect(x0 + R() * 512, y0 + R() * 512, 1, 1); }
        g.restore();
      }
      g.fillStyle = 'rgba(132,145,162,0.95)'; for (const p of [0, 512]) { g.fillRect(p, 0, 3, 1024); g.fillRect(0, p, 1024, 3); }
      g.fillStyle = 'rgba(255,255,255,0.7)'; for (const p of [3, 515]) { g.fillRect(p, 0, 1, 1024); g.fillRect(0, p, 1024, 1); }
      out.marble = tx(c, true);
    }
    { // wall panels: 2.4 m wide x 4.6 m tall (dark marble wainscot, chrome rail, blue-grey panels, crown band)
      const [c, g] = cv(512, 1024), Y = m => (1 - m / 4.6) * 1024;
      const gr = g.createLinearGradient(0, Y(4.6), 0, Y(1.1)); gr.addColorStop(0, '#d5dde7'); gr.addColorStop(1, '#b9c5d3'); g.fillStyle = gr; g.fillRect(0, 0, 512, 1024);
      for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '90,105,125'},0.05)`; g.fillRect(R() * 512, R() * Y(1.1), 2, 2); }
      for (const x of [0, 256]) { g.fillStyle = 'rgba(70,86,108,0.55)'; g.fillRect(x, 0, 3, Y(1.1)); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 3, 0, 1, Y(1.1)); }
      g.fillStyle = 'rgba(70,86,108,0.45)'; g.fillRect(0, Y(3.4), 512, 2); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, Y(3.4) + 2, 512, 1);
      g.fillStyle = '#eef2f6'; g.fillRect(0, 0, 512, Y(4.3)); g.fillStyle = 'rgba(60,72,90,0.35)'; g.fillRect(0, Y(4.3), 512, 3);
      g.fillStyle = '#243040'; g.fillRect(0, Y(1.02), 512, 1024 - Y(1.02));
      g.save(); g.beginPath(); g.rect(0, Y(1.02), 512, 1024 - Y(1.02)); g.clip();
      for (let k = 0; k < 5; k++) vein(g, R() * 512, Y(1.02) + R() * 200, R() * 6.28, 50, [[5, 'rgba(160,180,210,0.05)'], [1.2, 'rgba(170,190,215,0.25)']]);
      g.restore();
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, Y(0.12), 512, 1024 - Y(0.12));
      const rg = g.createLinearGradient(0, Y(1.1), 0, Y(1.02)); rg.addColorStop(0, '#f5f8fb'); rg.addColorStop(0.5, '#8b96a4'); rg.addColorStop(1, '#dde3ea'); g.fillStyle = rg; g.fillRect(0, Y(1.1), 512, Y(1.02) - Y(1.1));
      out.wall = tx(c, true);
    }
    { // ceiling tiles (1.2 m = 2 x 2 tiles)
      const [c, g] = cv(256, 256); g.fillStyle = '#e9edf2'; g.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 1400; k++) { g.fillStyle = `rgba(110,120,135,${R() * 0.12})`; g.fillRect(R() * 256, R() * 256, 1, 1); }
      g.fillStyle = '#b5bfca'; for (const p of [0, 128]) { g.fillRect(p, 0, 3, 256); g.fillRect(0, p, 256, 3); }
      out.ceil = tx(c, true);
    }
    { // brushed steel facade (vault wall + tunnel): 2.4 m square, seams every 0.8 m with rivets
      const [c, g] = cv(512, 512); const gr = g.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, '#8a96a5'); gr.addColorStop(1, '#6d7987'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '20,30,40'},${0.03 + R() * 0.05})`; g.fillRect(0, R() * 512, 512, 1); }
      for (let i = 0; i < 3; i++) {
        const x = i * 512 / 3; g.fillStyle = 'rgba(20,28,38,0.7)'; g.fillRect(x, 0, 3, 512); g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 3, 0, 1, 512);
        for (let y = 16; y < 512; y += 42) { g.fillStyle = 'rgba(30,38,48,0.6)'; g.beginPath(); g.arc(x + 12, y, 4, 0, 6.28); g.fill(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(x + 11, y - 1, 2, 0, 6.28); g.fill(); }
      }
      g.fillStyle = 'rgba(20,28,38,0.6)'; g.fillRect(0, 254, 512, 3);
      out.facade = tx(c, true);
    }
    { // safe-deposit boxes: 3.0 m x 1.5 m
      const [c, g] = cv(1024, 512); g.fillStyle = '#1b2027'; g.fillRect(0, 0, 1024, 512);
      const rows = [0.15, 0.15, 0.15, 0.3, 0.15, 0.3, 0.3], pxm = 1024 / 3; let y = 0, num = 101;
      for (const rh of rows) {
        const h = rh * 512 / 1.5;
        for (let i = 0; i < 12; i++) {
          const x = i * 0.25 * pxm, w = 0.25 * pxm, s = 160 + Math.floor(R() * 26);
          const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, `rgb(${s + 16},${s + 22},${s + 30})`); gr.addColorStop(1, `rgb(${s - 22},${s - 15},${s - 8})`);
          g.fillStyle = gr; g.fillRect(x + 3, y + 3, w - 6, h - 6);
          for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(255,255,255,${R() * 0.08})`; g.fillRect(x + 3, y + 3 + R() * (h - 6), w - 6, 1); }
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 3, y + 3, w - 6, 1);
          g.fillStyle = '#c9a75a'; g.fillRect(x + w / 2 - 14, y + 9, 28, 11); g.fillStyle = '#4a3610'; g.font = 'bold 9px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(num++), x + w / 2, y + 15);
          for (const kx of [-9, 9]) { g.fillStyle = '#2a2f36'; g.beginPath(); g.arc(x + w / 2 + kx, y + h / 2 + 4, 4.5, 0, 6.28); g.fill(); g.fillStyle = '#e2c372'; g.beginPath(); g.arc(x + w / 2 + kx, y + h / 2 + 4, 2.2, 0, 6.28); g.fill(); }
          if (rh > 0.2) { g.fillStyle = '#d9dee4'; g.fillRect(x + w / 2 - 16, y + h - 20, 32, 5); }
        }
        y += h;
      }
      out.boxes = tx(c, true);
    }
    { // vault floor: polished dark concrete, 1 m slabs (2 m texture)
      const [c, g] = cv(512, 512); g.fillStyle = '#3e444d'; g.fillRect(0, 0, 512, 512);
      for (let k = 0; k < 40; k++) { const x = R() * 512, y = R() * 512, r = 20 + R() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${R() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
      for (let k = 0; k < 2500; k++) { g.fillStyle = `rgba(255,255,255,${R() * 0.08})`; g.fillRect(R() * 512, R() * 512, 1, 1); }
      g.fillStyle = 'rgba(15,18,22,0.8)'; for (const p of [0, 256]) { g.fillRect(p, 0, 2, 512); g.fillRect(0, p, 512, 2); }
      out.vfloor = tx(c, true);
    }
    { // gold lettering
      const [c, g] = cv(1024, 160);
      const gr = g.createLinearGradient(0, 18, 0, 130); gr.addColorStop(0, '#fff1b0'); gr.addColorStop(0.45, '#d9a640'); gr.addColorStop(0.55, '#b98321'); gr.addColorStop(1, '#f3d27a');
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "400 112px 'Bebas Neue', Impact, sans-serif";
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillText('OCEAN  TRUST  BANK', 515, 77);
      g.fillStyle = gr; g.fillText('OCEAN  TRUST  BANK', 512, 72);
      g.fillStyle = '#d9a640'; g.fillRect(60, 138, 340, 3); g.fillRect(624, 138, 340, 3);
      g.font = "400 26px 'Bebas Neue', Impact, sans-serif"; g.fillText('VAULT  ·  B2', 512, 140);
      out.sign = tx(c, false);
    }
    { // brass door plate
      const [c, g] = cv(512, 128); const gr = g.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#e9cd84'); gr.addColorStop(0.5, '#b98a34'); gr.addColorStop(1, '#dcb867'); g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
      g.strokeStyle = '#5c4210'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112);
      g.fillStyle = '#4a330a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = "400 58px 'Bebas Neue', Impact, sans-serif"; g.fillText('OCEAN TRUST', 256, 56);
      g.font = "400 24px 'Bebas Neue', Impact, sans-serif"; g.fillText('TIME-LOCK  ·  NO. 7', 256, 98);
      out.plate = tx(c, false);
    }
    { // floor inlay: navy ring + gold compass star
      const [c, g] = cv(512, 512), C = 256;
      g.fillStyle = '#1c2e4d'; g.beginPath(); g.arc(C, C, 250, 0, 6.283); g.arc(C, C, 214, 0, 6.283, true); g.fill();
      g.strokeStyle = '#d8b25c'; g.lineWidth = 4; for (const r of [248, 216, 120]) { g.beginPath(); g.arc(C, C, r, 0, 6.283); g.stroke(); }
      for (let k = 0; k < 16; k++) {
        const an = k / 16 * 6.283, r0 = k % 2 ? 60 : 30, r1 = k % 4 === 0 ? 210 : k % 2 === 0 ? 150 : 100;
        g.fillStyle = k % 2 ? '#c9a24f' : '#1c2e4d'; g.beginPath(); g.moveTo(C + Math.cos(an) * r1, C + Math.sin(an) * r1); g.lineTo(C + Math.cos(an + 0.2) * r0, C + Math.sin(an + 0.2) * r0); g.lineTo(C, C); g.lineTo(C + Math.cos(an - 0.2) * r0, C + Math.sin(an - 0.2) * r0); g.closePath(); g.fill();
      }
      g.fillStyle = '#d8b25c'; g.beginPath(); g.arc(C, C, 26, 0, 6.283); g.fill(); g.fillStyle = '#1c2e4d'; g.font = "400 30px 'Bebas Neue', Impact, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OT', C, C + 2);
      out.inlay = tx(c, false);
    }
    { // exit sign
      const [c, g] = cv(256, 80); g.fillStyle = '#0b7a3a'; g.fillRect(0, 0, 256, 80); g.fillStyle = '#eafff1'; g.font = "400 58px 'Bebas Neue', Impact, sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXIT', 128, 43);
      out.exit = tx(c, false);
    }
    { // soft glow sprite (particles, the burn glow, markers)
      const [c, g] = cv(64, 64), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64); out.glowT = tx(c, false, false);
    }
    { // smoke puff
      const [c, g] = cv(64, 64);
      for (let k = 0; k < 14; k++) { const x = 18 + R() * 28, y = 18 + R() * 28, r = 8 + R() * 14, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
      const m = g.createRadialGradient(32, 32, 10, 32, 32, 32); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = m; g.fillRect(0, 0, 64, 64);
      out.smokeT = tx(c, false, false);
    }
    { // scorch
      const [c, g] = cv(256, 256);
      for (let k = 0; k < 26; k++) { const an = R() * 6.28, d = R() * 60, x = 128 + Math.cos(an) * d, y = 128 + Math.sin(an) * d, r = 50 + R() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
      out.scorch = tx(c, false, false);
    }
    return out;
  },

  precompile() {
    const H = this.H, hid = [this.vaultG, this.charge, this.burnG, this.mkPlant, this.mkExit, this.shock, this.scorchF, this.scorchW].filter(Boolean), was = hid.map(o => o.visible);
    for (const o of hid) o.visible = true;
    try { if (H.renderer && H.renderer.compile) H.renderer.compile(this.scene, H.camera); } catch (e) {}
    hid.forEach((o, k) => { o.visible = was[k]; });
  },

  /* ======================================================================= particles */
  mkPts(T, N, add, tex) {
    const geo = this.own(new T.BufferGeometry());
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 4), size = new Float32Array(N);
    geo.setAttribute('position', new T.BufferAttribute(pos, 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('rgba', new T.BufferAttribute(col, 4).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('size', new T.BufferAttribute(size, 1).setUsage(T.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    const mat = this.own(new T.ShaderMaterial({
      uniforms: { uMap: { value: tex }, uScale: { value: 400 } },
      vertexShader: 'attribute vec4 rgba; attribute float size; varying vec4 vC; uniform float uScale; void main(){ vC = rgba; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * uScale / max(0.1, -mv.z), 512.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D uMap; varying vec4 vC; void main(){ vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(vC.rgb, vC.a * t.a); if (gl_FragColor.a < 0.003) discard; }',
      transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending,
    }));
    const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = add ? 7 : 6; this.scene.add(pts);
    const F = () => new Float32Array(N);
    return { pts, geo, mat, pos, col, size, N, add, live: 0, next: 0, drawn: 0, x: F(), y: F(), z: F(), vx: F(), vy: F(), vz: F(), age: F(), life: F(), s0: F(), s1: F(), r: F(), g: F(), b: F(), a: F(), gr: F(), dr: F() };
  },
  emit(P, x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav, drag) {
    const i = P.next; P.next = (i + 1) % P.N; if (P.life[i] <= 0) P.live++;
    P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz; P.age[i] = 0; P.life[i] = life;
    P.s0[i] = s0; P.s1[i] = s1; P.r[i] = r; P.g[i] = g; P.b[i] = b; P.a[i] = a; P.gr[i] = grav || 0; P.dr[i] = drag || 0;
  },
  ptsStep(P, dt) {
    const H = this.H; P.mat.uniforms.uScale.value = H.H / (2 * Math.tan(H.camera.fov * Math.PI / 360));
    if (P.live <= 0) { if (P.drawn) { P.geo.setDrawRange(0, 0); P.drawn = 0; } return; }
    let n = 0, live = 0;
    for (let i = 0; i < P.N; i++) {
      const L = P.life[i]; if (L <= 0) continue;
      const age = P.age[i] += dt; if (age >= L) { P.life[i] = 0; continue; }
      live++;
      const f = age / L, d = P.dr[i];
      P.vy[i] -= 9.8 * P.gr[i] * dt;
      if (d) { const k = Math.max(0, 1 - d * dt); P.vx[i] *= k; P.vy[i] *= k; P.vz[i] *= k; }
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
      if (P.y[i] < 0.03 && P.vy[i] < 0) { P.y[i] = 0.03; P.vy[i] *= -0.35; P.vx[i] *= 0.6; P.vz[i] *= 0.6; }
      P.pos[n * 3] = P.x[i]; P.pos[n * 3 + 1] = P.y[i]; P.pos[n * 3 + 2] = P.z[i];
      P.col[n * 4] = P.r[i]; P.col[n * 4 + 1] = P.g[i]; P.col[n * 4 + 2] = P.b[i];
      P.col[n * 4 + 3] = P.a[i] * (P.add ? (1 - f) * (1 - f) : Math.sin(Math.min(1, f * 4) * 1.5708) * (1 - f));
      P.size[n] = P.s0[i] + (P.s1[i] - P.s0[i]) * f; n++;
    }
    P.live = live; P.drawn = n; P.geo.setDrawRange(0, n);
    P.geo.attributes.position.needsUpdate = true; P.geo.attributes.rgba.needsUpdate = true; P.geo.attributes.size.needsUpdate = true;
  },

  /* ======================================================================= money: one InstancedMesh */
  initBundles(T) {
    const N = this.V.N, S = this.BS; let geo = null, mat = null;
    if (window.HModels && HModels.billBundle) { try { const bb = HModels.billBundle(); geo = bb.geometry.clone(); mat = bb.material; } catch (e) { geo = null; } }
    if (!geo && window.HModels && HModels.cashStack) { try { const m = HModels.cashStack({ single: true }); geo = m.geometry.clone(); geo.computeBoundingBox(); const bb = geo.boundingBox; geo.translate(0, -(bb.min.y + bb.max.y) / 2, 0); geo.scale(0.98, 0.3, 0.94); mat = m.material; } catch (e) { geo = null; } }
    if (!geo) { geo = new T.BoxGeometry(0.156, 0.02, 0.066); mat = this.own(new T.MeshStandardMaterial({ color: 0x86a97c, roughness: 0.8 })); }
    this.own(geo); geo.computeBoundingBox();
    const bb = geo.boundingBox; this.TH = (bb.max.y - bb.min.y) * S;
    const mesh = this.bm = new T.InstancedMesh(geo, mat, N); mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.renderOrder = 2; mat.userData.lin = true;
    const c = this._tmp.col;
    for (let i = 0; i < N; i++) { mesh.setMatrixAt(i, this._tmp.zm); const k = 0.82 + Math.random() * 0.3; c.setRGB(k, k * (0.97 + Math.random() * 0.06), k); mesh.setColorAt(i, c); }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    const F = () => new Float32Array(N);
    this.B = { N, live: false, px: F(), py: F(), pz: F(), vx: F(), vy: F(), vz: F(), rx: F(), ry: F(), rz: F(), wx: F(), wy: F(), wz: F(), del: F(), at: F(), sx: F(), sy: F(), sz: F(),
      st: new Uint8Array(N), bnc: new Uint8Array(N), cell: new Int32Array(N).fill(-1), next: new Int32Array(N).fill(-1), who: new Int8Array(N), settled: 0, taken: 0 };
  },
  initGrid() {
    const C = this.CELL, NX = this.NX = Math.ceil(this.AX * 2 / C), NZ = this.NZ = Math.ceil((this.AZ - this.VZ) / C), n = NX * NZ;
    this.X0 = -this.AX; this.Z0 = this.VZ;
    this.G = { head: new Int32Array(n).fill(-1), cnt: new Int16Array(n), hgt: new Float32Array(n), base: new Float32Array(n), floor: new Uint8Array(n),
      nav: new Uint8Array(n), seen: new Int32Array(n), prev: new Int32Array(n), q: new Int32Array(n), stamp: 0, stack: new Uint8Array(n) };
    const G = this.G, bs = this.bSolids();
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      const x = this.X0 + (i + 0.5) * C, z = this.Z0 + (j + 0.5) * C;
      let ok = (z > 0.02 && z < this.AZ - 0.05 && Math.abs(x) < this.AX - 0.05) || (z >= this.WZ && z <= 0.02 && Math.abs(x) < this.GAP - 0.12) || (z < this.WZ && z > this.VZ + 0.05 && Math.abs(x) < this.VX - 0.05);
      if (ok) for (const b of bs) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) { ok = false; break; }
      G.floor[j * NX + i] = ok ? 1 : 0;
    }
    this.solidsInit();
    this.navBuild();
  },
  cellOf(x, z) { const i = Math.floor((x - this.X0) / this.CELL), j = Math.floor((z - this.Z0) / this.CELL); if (i < 0 || j < 0 || i >= this.NX || j >= this.NZ) return -1; return j * this.NX + i; },
  cx(c) { return this.X0 + (c % this.NX + 0.5) * this.CELL; },
  cz(c) { return this.Z0 + (Math.floor(c / this.NX) + 0.5) * this.CELL; },
  bSolids() { // what bundles bounce off (besides the room shell): the pillars and the vault props
    if (this._bs) return this._bs;
    const s = []; for (const [px, pz] of this.PIL) s.push({ x0: px - this.PHW, z0: pz - this.PHW, x1: px + this.PHW, z1: pz + this.PHW, h: 9 });
    for (const p of this.props || []) s.push(p);
    return (this._bs = s);
  },

  bw(i) { const B = this.B, o = this._tmp.o; o.position.set(B.px[i], B.py[i], B.pz[i]); o.rotation.set(B.rx[i], B.ry[i], B.rz[i]); o.scale.setScalar(this.BS); o.updateMatrix(); this.bm.setMatrixAt(i, o.matrix); },
  burstStart() {
    const B = this.B, V = this.V; V.burstAt = V.t; B.live = true;
    for (let i = 0; i < B.N; i++) {
      // three kinds: a spill that piles up in and just outside the opening, a fan that sprays the antechamber, a few that fall back inside
      const r = Math.random(), back = r < 0.14, spill = !back && r < 0.6;
      const a = (Math.random() - 0.5) * (spill ? 0.9 : 1.9), s = back ? 0.5 + Math.random() * 2.2 : spill ? 2.0 + Math.random() * 2.2 : 4.6 + Math.pow(Math.random(), 0.8) * 7.5;
      B.px[i] = (Math.random() - 0.5) * (spill ? 1.4 : 2.2); B.py[i] = 0.45 + Math.random() * 2.2; B.pz[i] = -2.4 + Math.random() * 1.3;
      B.vx[i] = Math.sin(a) * s * (back ? 1.5 : 1); B.vz[i] = back ? (Math.random() - 0.65) * 3 : Math.cos(a) * s; B.vy[i] = back ? 1 + Math.random() * 2.5 : spill ? 0.6 + Math.random() * 2.6 : 1.4 + Math.random() * 5;
      B.rx[i] = Math.random() * 6.28; B.ry[i] = Math.random() * 6.28; B.rz[i] = Math.random() * 6.28;
      B.wx[i] = (Math.random() - 0.5) * 22; B.wy[i] = (Math.random() - 0.5) * 14; B.wz[i] = (Math.random() - 0.5) * 22;
      B.del[i] = Math.pow(Math.random(), 1.6) * 0.55; B.st[i] = 0; B.bnc[i] = 0;
    }
  },
  bundlesStep(dt) {
    const B = this.B, V = this.V; if (!B || !B.live) return;
    const G = this.G, TH = this.TH, AX = this.AX, AZ = this.AZ, WZ = this.WZ, VX = this.VX, VZ = this.VZ, DCY = this.DCY, DRi = this.DR - 0.14;
    const tb = V.burstAt >= 0 ? V.t - V.burstAt : -1, bs = this.bSolids();
    let busy = 0, dirty = false;
    for (let i = 0; i < B.N; i++) {
      const st = B.st[i];
      if (st === 0) { if (tb >= 0 && tb >= B.del[i]) B.st[i] = 1; else { if (tb >= 0) busy++; continue; } }
      else if (st === 2 || st === 4) continue;
      busy++; dirty = true;
      if (B.st[i] === 3) { this.collectAnim(i, dt); continue; }
      // flying: gravity, a little air drag, tumbling
      const oz = B.pz[i];
      B.vy[i] -= 9.8 * dt; const dk = 1 - 0.35 * dt; B.vx[i] *= dk; B.vz[i] *= dk;
      let x = B.px[i] + B.vx[i] * dt, y = B.py[i] + B.vy[i] * dt, z = B.pz[i] + B.vz[i] * dt;
      B.rx[i] += B.wx[i] * dt; B.ry[i] += B.wy[i] * dt; B.rz[i] += B.wz[i] * dt;
      // the wall slab: only through the round opening
      if (z <= 0.04 && z >= WZ - 0.04) {
        const dy = y - DCY, rr = Math.hypot(x, dy);
        if (rr > DRi) {
          if (oz < WZ - 0.04 || oz > 0.04) { z = oz < WZ ? WZ - 0.05 : 0.05; B.vz[i] *= -0.35; B.vx[i] *= 0.7; }
          else { const nx = x / rr, ny = dy / rr; x = nx * DRi; y = DCY + ny * DRi; const vn = B.vx[i] * nx + B.vy[i] * ny; if (vn > 0) { B.vx[i] -= 1.5 * vn * nx; B.vy[i] -= 1.5 * vn * ny; } }
        }
      }
      // the room shell
      if (z > 0.04) {
        if (x < -AX + 0.1) { x = -AX + 0.1; B.vx[i] = Math.abs(B.vx[i]) * 0.35; } else if (x > AX - 0.1) { x = AX - 0.1; B.vx[i] = -Math.abs(B.vx[i]) * 0.35; }
        if (z > AZ - 0.1) { z = AZ - 0.1; B.vz[i] = -Math.abs(B.vz[i]) * 0.35; }
        if (y > this.AH - 0.08) { y = this.AH - 0.08; B.vy[i] = -Math.abs(B.vy[i]) * 0.3; }
      } else if (z < WZ - 0.04) {
        if (x < -VX + 0.1) { x = -VX + 0.1; B.vx[i] = Math.abs(B.vx[i]) * 0.35; } else if (x > VX - 0.1) { x = VX - 0.1; B.vx[i] = -Math.abs(B.vx[i]) * 0.35; }
        if (z < VZ + 0.1) { z = VZ + 0.1; B.vz[i] = Math.abs(B.vz[i]) * 0.35; }
        if (y > this.VH - 0.08) { y = this.VH - 0.08; B.vy[i] = -Math.abs(B.vy[i]) * 0.3; }
      }
      // pillars + props
      for (let k = 0; k < bs.length; k++) {
        const b = bs[k]; if (x <= b.x0 || x >= b.x1 || z <= b.z0 || z >= b.z1 || y > b.h) continue;
        const l = x - b.x0, r = b.x1 - x, f = z - b.z0, bk = b.z1 - z, m = Math.min(l, r, f, bk);
        if (m === l) { x = b.x0; B.vx[i] = -Math.abs(B.vx[i]) * 0.3; } else if (m === r) { x = b.x1; B.vx[i] = Math.abs(B.vx[i]) * 0.3; } else if (m === f) { z = b.z0; B.vz[i] = -Math.abs(B.vz[i]) * 0.3; } else { z = b.z1; B.vz[i] = Math.abs(B.vz[i]) * 0.3; }
      }
      B.px[i] = x; B.py[i] = y; B.pz[i] = z;
      // the floor / the piles / the fallen door
      const c = this.cellOf(x, z), gh = c >= 0 ? G.hgt[c] : 0;
      if (y - TH * 0.5 <= gh) {
        B.py[i] = gh + TH * 0.5;
        if (c >= 0 && G.base[c] > 0.01) { // on top of the fallen door: the cash slides off its edge (no loot out of reach)
          const R = this.DOOR_REST, dx = x - R.x, dz = z - R.z, d = Math.hypot(dx, dz) || 1, k = 2.4 + Math.random() * 0.8;
          B.vx[i] = dx / d * k; B.vz[i] = dz / d * k; B.vy[i] = Math.max(0, B.vy[i]) + 0.4; B.wy[i] *= 0.9;
        } else if (B.vy[i] < -1.5 && B.bnc[i] < 3) {
          B.vy[i] = -B.vy[i] * 0.26; B.vx[i] *= 0.55; B.vz[i] *= 0.55; B.wx[i] *= 0.45; B.wz[i] *= 0.45; B.wy[i] *= 0.7; B.bnc[i]++;
          if (B.bnc[i] === 1 && Math.random() < 0.08) this.paper(x, gh + 0.05, z, 2);
        } else { this.settle(i, c); continue; }
      }
      this.bw(i);
    }
    if (dirty) this.bm.instanceMatrix.needsUpdate = true;
    if (!busy && tb >= 0) B.live = false;
  },
  settle(i, c) {
    const B = this.B, G = this.G, TH = this.TH, NX = this.NX;
    if (c < 0 || !G.floor[c]) c = this.nearestFloor(B.px[i], B.pz[i]);
    let moved = false;
    for (let it = 0; it < 5; it++) { // avalanche: roll off a pile that got too steep
      const i0 = c % NX, j0 = (c - i0) / NX; let best = -1, bh = G.hgt[c] > 0.95 ? G.hgt[c] - TH * 0.2 : G.hgt[c] - TH * 3.0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ii = i0 + di, jj = j0 + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= this.NZ) continue;
        const nc = jj * NX + ii; if (!G.floor[nc]) continue; if (G.hgt[nc] < bh) { bh = G.hgt[nc]; best = nc; }
      }
      if (best < 0) break; c = best; moved = true;
    }
    if (moved) { B.px[i] = this.cx(c) + (Math.random() - 0.5) * 0.16; B.pz[i] = this.cz(c) + (Math.random() - 0.5) * 0.16; }
    const tilt = G.hgt[c] > G.base[c] + 0.02 ? 0.42 : 0.07;
    B.py[i] = G.hgt[c] + TH * 0.5 + 0.002; B.rx[i] = (Math.random() - 0.5) * tilt; B.rz[i] = (Math.random() - 0.5) * tilt;
    G.hgt[c] += TH * 0.92;
    const row = Math.floor(c / NX);
    for (const nc of [c - 1, c + 1, c - NX, c + NX]) {
      if (nc < 0 || nc >= G.floor.length || !G.floor[nc] || ((nc === c - 1 || nc === c + 1) && Math.floor(nc / NX) !== row)) continue;
      G.hgt[nc] = Math.max(G.hgt[nc], G.hgt[c] - TH * 2.2);
    }
    B.st[i] = 2; B.cell[i] = c; B.next[i] = G.head[c]; G.head[c] = i; G.cnt[c]++; B.settled++;
    this.bw(i);
  },
  nearestFloor(x, z) {
    const G = this.G; let best = -1, bd = 1e9;
    const c0 = this.cellOf(HX.clamp(x, -this.AX + 0.2, this.AX - 0.2), HX.clamp(z, this.VZ + 0.2, this.AZ - 0.2));
    const i0 = c0 % this.NX, j0 = (c0 - i0) / this.NX;
    for (let r = 0; r < 12 && best < 0; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      const ii = i0 + di, jj = j0 + dj; if (ii < 0 || jj < 0 || ii >= this.NX || jj >= this.NZ) continue; const c = jj * this.NX + ii;
      if (!G.floor[c]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = c; }
    }
    return best < 0 ? c0 : best;
  },
  // the highest settled bundle within r of (x, z)
  pick(x, z, r) {
    const G = this.G, B = this.B; if (!B || !B.settled) return -1;
    const C = this.CELL, i0 = Math.max(0, Math.floor((x - r - this.X0) / C)), i1 = Math.min(this.NX - 1, Math.floor((x + r - this.X0) / C));
    const j0 = Math.max(0, Math.floor((z - r - this.Z0) / C)), j1 = Math.min(this.NZ - 1, Math.floor((z + r - this.Z0) / C));
    let best = -1, by = -1; const r2 = r * r;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let k = G.head[j * this.NX + i]; k >= 0; k = B.next[k]) {
      const dx = B.px[k] - x, dz = B.pz[k] - z; if (dx * dx + dz * dz < r2 && B.py[k] > by) { by = B.py[k]; best = k; }
    }
    return best;
  },
  take(k, m) {
    const B = this.B, G = this.G, c = B.cell[k];
    if (c >= 0) { // unlink from its cell
      if (G.head[c] === k) G.head[c] = B.next[k]; else for (let p = G.head[c]; p >= 0; p = B.next[p]) if (B.next[p] === k) { B.next[p] = B.next[k]; break; }
      G.cnt[c]--; G.hgt[c] = Math.max(G.base[c], G.hgt[c] - this.TH * 0.92);
    }
    B.cell[k] = -1; B.next[k] = -1; B.st[k] = 3; B.at[k] = 0; B.sx[k] = B.px[k]; B.sy[k] = B.py[k]; B.sz[k] = B.pz[k];
    B.who[k] = this.members.indexOf(m); B.settled--; B.taken++; B.live = true;
    this.credit(m, this.value, false);
  },
  collectAnim(i, dt) {
    const B = this.B, m = this.members[B.who[i]] || this.cur(); B.at[i] += dt;
    const u = Math.min(1, B.at[i] / 0.3), e = u * u * (3 - 2 * u);
    B.px[i] = B.sx[i] + (m.bx - B.sx[i]) * e; B.py[i] = B.sy[i] + (m.by - B.sy[i]) * e + Math.sin(Math.PI * u) * 0.45; B.pz[i] = B.sz[i] + (m.bz - B.sz[i]) * e;
    B.rx[i] += 9 * dt; B.ry[i] += 6 * dt;
    if (u >= 1) { B.st[i] = 4; this.bm.setMatrixAt(i, this._tmp.zm); return; }
    const o = this._tmp.o; o.position.set(B.px[i], B.py[i], B.pz[i]); o.rotation.set(B.rx[i], B.ry[i], B.rz[i]); o.scale.setScalar(this.BS * (1 - 0.72 * u)); o.updateMatrix(); this.bm.setMatrixAt(i, o.matrix);
  },
  credit(m, amount, stack) {
    const V = this.V;
    if (stack) m.stacks++; else m.n++;
    m.cash += amount;
    if (!m.bag.visible) m.bag.visible = true;
    m.bag.scale.setScalar(0.75 + Math.min(0.85, m.n * 0.0055 + m.stacks * 0.05));
    const tot = this.result().cash;
    if (this.o.onCash) { try { this.o.onCash(tot, amount); } catch (e) { console.error(e); } } else HHud.setMoney(V.base + tot);
    if (window.HAudio) {
      const act = m === this.cur();
      if (stack) HAudio.sfx('bigCash', { vol: act ? 0.9 : 0.55 }); else HAudio.sfx('cash', { vol: act ? 0.6 : 0.32 });
      const ms = Math.floor(tot / 250000); if (ms > V.ms) { V.ms = ms; if (!stack) HAudio.sfx('coin', { vol: 0.8 }); }
    }
    // everything gone -> the alarm (cleaned out)
    if (V.phase === 'loot' && this.B.taken >= this.B.N && this.stacks.every(s => s.taken)) { V.cleaned = true; this.alarm(); }
  },
  stacksStep(dt) {
    for (const s of this.stacks) {
      if (!s.taken || s.fly < 0) continue;
      const m = this.members[s.who] || this.cur(); s.fly += dt;
      const u = Math.min(1, s.fly / 0.35), e = u * u * (3 - 2 * u), o = s.obj;
      o.position.set(s.x + (m.bx - s.x) * e, s.y + (m.by - s.y) * e + Math.sin(Math.PI * u) * 0.5, s.z + (m.bz - s.z) * e);
      o.scale.setScalar(s.s * (1 - 0.85 * u)); o.rotation.y += dt * 8;
      if (u >= 1) { o.visible = false; s.fly = -1; }
    }
  },
  grabStack(m, r) {
    if (!this.vaultG.visible) return false;
    for (let k = 0; k < this.stacks.length; k++) {
      const s = this.stacks[k]; if (s.taken) continue;
      if (Math.hypot(s.x - m.x, s.z - m.z) < r) {
        s.taken = true; s.fly = 0; s.who = this.members.indexOf(m);
        if (s.cell >= 0) this.G.stack[s.cell] = 0;
        this.credit(m, this.stackValue, true);
        if (m === this.cur()) HHud.toast('\u2066+$' + this.stackValue.toLocaleString('en-US') + '\u2069', '#7dffb0'); // (isolated: "+$5,000" reads left to right in Hebrew too)
        return true;
      }
    }
    return false;
  },

  /* ======================================================================= collisions + navigation */
  solidsInit() {
    const { AX, AZ, WZ, VX, VZ, GAP } = this, P = this.PHW, s = [];
    const box = (x0, z0, x1, z1, cam, kind) => { const b = { x0, z0, x1, z1, on: true, cam: cam !== false, kind: kind || 'wall' }; s.push(b); return b; };
    box(-9, 0, -AX, AZ + 3); box(AX, 0, 9, AZ + 3); box(-9, AZ, 9, AZ + 4);
    box(-9, WZ, -GAP, 0, false); box(GAP, WZ, 9, 0, false);
    box(-9, VZ - 3, -VX, WZ); box(VX, VZ - 3, 9, WZ); box(-9, VZ - 3, 9, VZ);
    for (const [px, pz] of this.PIL) box(px - P, pz - P, px + P, pz + P, true, 'pillar');
    for (const p of this.props) box(p.x0, p.z0, p.x1, p.z1, false, 'prop');
    this.doorBox = box(-GAP, WZ, GAP, 0.16, true, 'door');
    this.solids = s;
    // the camera sees through the opening a little wider than people fit through it
    this.camSolids = s.filter(b => b.cam).concat([{ x0: -9, z0: WZ, x1: -1.62, z1: 0, on: true }, { x0: 1.62, z0: WZ, x1: 9, z1: 0, on: true }]);
    this.circles = [];
  },
  resolve(x, z, r, out) {
    for (let it = 0; it < 2; it++) {
      for (const b of this.solids) {
        if (!b.on) continue;
        const px = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x, pz = z < b.z0 ? b.z0 : z > b.z1 ? b.z1 : z;
        const dx = x - px, dz = z - pz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 < 1e-10) { const l = x - b.x0, rr = b.x1 - x, f = z - b.z0, bk = b.z1 - z, m = Math.min(l, rr, f, bk); if (m === l) x = b.x0 - r; else if (m === rr) x = b.x1 + r; else if (m === f) z = b.z0 - r; else z = b.z1 + r; continue; }
        const d = Math.sqrt(d2), k = (r - d) / d; x += dx * k; z += dz * k;
      }
      for (const c of this.circles) { const dx = x - c.x, dz = z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr || d2 < 1e-10) continue; const d = Math.sqrt(d2), k = (rr - d) / d; x += dx * k; z += dz * k; }
    }
    out.x = x; out.z = z; return out;
  },
  blocked(x, z, r) {
    for (const b of this.solids) { if (!b.on) continue; const px = HX.clamp(x, b.x0, b.x1), pz = HX.clamp(z, b.z0, b.z1); if ((x - px) * (x - px) + (z - pz) * (z - pz) < r * r) return true; }
    for (const c of this.circles) if (Math.hypot(x - c.x, z - c.z) < r + c.r) return true;
    return false;
  },
  navBuild() {
    const G = this.G; for (let c = 0; c < G.nav.length; c++) G.nav[c] = this.blocked(this.cx(c), this.cz(c), 0.36) ? 1 : 0;
    G.stack.fill(0);
    for (const s of this.stacks) { s.cell = this.nearestNav(s.x, s.z); if (s.cell >= 0 && !s.taken) G.stack[s.cell] = 1; }
  },
  nearestNav(x, z) {
    const G = this.G, c0 = this.cellOf(x, z); if (c0 >= 0 && !G.nav[c0]) return c0;
    const i0 = Math.floor((x - this.X0) / this.CELL), j0 = Math.floor((z - this.Z0) / this.CELL);
    for (let r = 1; r < 16; r++) {
      let best = -1, bd = 1e9;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const ii = i0 + di, jj = j0 + dj; if (ii < 0 || jj < 0 || ii >= this.NX || jj >= this.NZ) continue;
        const c = jj * this.NX + ii; if (G.nav[c]) continue; const d = di * di + dj * dj; if (d < bd) { bd = d; best = c; }
      }
      if (best >= 0) return best;
    }
    return -1;
  },
  // breadth-first search on the nav grid from cell s until goal(c) holds; returns that cell (G.prev holds the way back)
  DI: [1, -1, 0, 0, 1, 1, -1, -1], DJ: [0, 0, 1, -1, 1, -1, 1, -1],
  bfs(s, goal) {
    const G = this.G, NX = this.NX, NZ = this.NZ, DI = this.DI, DJ = this.DJ; if (s < 0) return -1;
    const st = ++G.stamp; let h = 0, t = 0; G.q[t++] = s; G.seen[s] = st; G.prev[s] = -1;
    while (h < t) {
      const c = G.q[h++]; if (goal(c)) return c;
      const i = c % NX, j = (c - i) / NX;
      for (let k = 0; k < 8; k++) {
        const di = DI[k], dj = DJ[k], ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NX || jj >= NZ) continue;
        const nc = jj * NX + ii; if (G.nav[nc] || G.seen[nc] === st) continue;
        if (di && dj && (G.nav[j * NX + ii] || G.nav[jj * NX + i])) continue;
        G.seen[nc] = st; G.prev[nc] = c; G.q[t++] = nc;
      }
    }
    return -1;
  },
  pathTo(c) { // cells -> smoothed waypoints
    const G = this.G, cells = []; for (let k = c; k >= 0; k = G.prev[k]) cells.push(k); cells.reverse();
    const pts = cells.map(k => ({ x: this.cx(k), z: this.cz(k) })); if (pts.length < 3) return pts;
    const out = [pts[0]]; let a = 0;
    for (let k = 2; k < pts.length; k++) if (!this.los(pts[a], pts[k])) { out.push(pts[k - 1]); a = k - 1; }
    out.push(pts[pts.length - 1]); return out;
  },
  los(p, q) {
    const d = Math.hypot(q.x - p.x, q.z - p.z), n = Math.max(1, Math.ceil(d / 0.1));
    for (let k = 1; k < n; k++) { const c = this.cellOf(p.x + (q.x - p.x) * k / n, p.z + (q.z - p.z) * k / n); if (c < 0 || this.G.nav[c]) return false; }
    return true;
  },
  findPath(sx, sz, tx, tz) {
    const s = this.nearestNav(sx, sz), g = this.nearestNav(tx, tz); if (s < 0 || g < 0) return null;
    const e = this.bfs(s, c => c === g); if (e < 0) return null;
    const p = this.pathTo(e); p.push({ x: tx, z: tz }); return p;
  },

  /* ======================================================================= the frame */
  update(dt) {
    if (!this.active) return;
    const H = this.H, V = this.V, rdt = H.realDt || dt;
    V.t += dt; V.rt += rdt;
    this.slowStep(rdt);
    this.phaseStep(dt, rdt);
    if (!this.active) return; // the vault closed itself (walked out without an onExit)
    const A = this.cur();
    if (A) this.moveActive(A, dt);
    for (const m of this.members) if (m !== A) this.moveAI(m, dt);
    this.actorsCollide();
    if (V.phase === 'loot' || V.phase === 'alarm') this.lootStep(dt);
    this.doorStep(dt);
    for (const m of this.members) this.bagPos(m);
    this.bundlesStep(dt);
    this.stacksStep(dt);
    this.ptsStep(this.fxA, dt); this.ptsStep(this.fxN, dt);
    this.lightsStep(dt, rdt);
    this.syncRigs();
    this.hud(rdt);
  },

  phaseStep(dt, rdt) {
    const H = this.H, V = this.V, A = this.cur(); if (!A) return;
    V.action = null;
    if (V.phase === 'enter') {
      const K = this.KNEEL, d = Math.hypot(A.x - K.x, A.z - K.z), near = d < 1.3 && A.knockT <= 0;
      const held = near && (H.key('KeyE', 'KeyF', 'Enter', 'NumpadEnter') || this.touchHeld());
      if (near) V.action = 'plant';
      if (held) {
        if (!V.planting) { V.planting = true; A.vx = A.vz = 0; }
        V.plantK = Math.min(1, V.plantK + dt / 1.4);
        A.x = HX.damp(A.x, K.x, 12, dt); A.z = HX.damp(A.z, K.z, 12, dt); A.h += HX.wrapAngle(Math.PI - A.h) * Math.min(1, dt * 12);
        V.keyT -= dt; if (V.keyT <= 0 && V.plantK > 0.25) { V.keyT = 0.17; if (window.HAudio) HAudio.sfx('type', { vol: 1.2 }); }
        if (V.plantK >= 1) this.plant();
      } else { V.planting = false; V.plantK = Math.max(0, V.plantK - dt * 1.8); }
      if (V.phase === 'enter') { if (near) HHud.prompt(Input.touchMode ? '✋' : 'E', t('cv_hold')); else HHud.prompt(); }
    } else if (V.phase === 'fuse') {
      V.fuse -= dt; const k = 1 - Math.max(0, V.fuse) / this.FUSE;
      V.beepT -= dt;
      if (V.beepT <= 0) { V.beepT = 0.09 + 0.5 * Math.pow(1 - k, 1.4); this.snd('thermalBeep', { intensity: k }, 'beep', { pitch: 1 + k * 0.6, vol: 1.3 }); }
      if (this.charge.update) this.charge.update(V.t, 1 + k * 7);
      V.burn = HX.clamp((1.35 - V.fuse) / 1.35, 0, 1);
      if (V.burn > 0) { // the thermal charge burns through: a white-hot glow + a spark fountain
        const n = Math.floor(V.burn * 90 * dt + Math.random()), C = this.CH;
        for (let q = 0; q < n; q++) { const an = Math.random() * 6.28, s = 2 + Math.random() * 5; this.emit(this.fxA, C.x + (Math.random() - 0.5) * 0.3, C.y + (Math.random() - 0.5) * 0.2, C.z + 0.12, Math.cos(an) * s * 0.6, 1 + Math.sin(an) * s * 0.5, 1.5 + Math.random() * 3, 0.5 + Math.random() * 0.5, 0.07, 0.025, 3, 2.1, 1.1, 1, 1, 0.3); }
        if (Math.random() < V.burn * dt * 8) this.emit(this.fxN, C.x, C.y + 0.2, C.z + 0.25, (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.5, 0.3 + Math.random() * 0.3, 2.2, 0.3, 1.3, 0.55, 0.56, 0.6, 0.35, 0, 0.4);
      }
      if (V.fuse <= 0) this.blast();
    } else if (V.phase === 'blast') {
      V.blastT += rdt;
      if (V.blastT >= 1.85 && !V.blownSent) {
        V.blownSent = true; V.phase = 'blown'; this.phase = 'blown';
        if (this.o.onBlown) { try { this.o.onBlown(); } catch (e) { console.error(e); } } else V.autoT = 0.5;
      }
    } else if (V.phase === 'blown') {
      if (V.autoT >= 0) { V.autoT -= rdt; if (V.autoT < 0) this.resume(); }
    } else if (V.phase === 'burst') {
      V.burstT += rdt;
      if (V.burstT > 2.7) this.startLoot();
    } else if (V.phase === 'loot') {
      V.timer -= dt;
      const s = Math.ceil(Math.max(0, V.timer));
      if (s !== V.tick) { V.tick = s; if (s <= 10 && s > 0 && window.HAudio) HAudio.sfx('beep', { pitch: s <= 3 ? 1.5 : 1.15, vol: 1.6 }); }
      const dE = Math.hypot(A.x - this.EXIT.x, A.z - this.EXIT.z);
      if (dE < 1.5 && A.knockT <= 0) { V.action = 'leave'; HHud.prompt(Input.touchMode ? '🚪' : 'E', t('cv_leave')); if (H.actionPressed()) { this.alarm(); this.exit(); return; } }
      else HHud.prompt();
      if (V.timer <= 0) this.alarm();
    } else if (V.phase === 'alarm') {
      V.alarmT += dt;
      if (Math.hypot(A.x - this.EXIT.x, A.z - this.EXIT.z) < 1.35 && A.knockT <= 0) this.exit();
      HHud.prompt();
    }
  },
  touchHeld() { const b = Input.btnHeld; for (const k in b) if (b[k] === 'special') return true; return false; },
  snd(name, o, fb, fo) { // a dedicated sound another module may provide, with a stock fallback
    if (!window.HAudio) return;
    if (HAudio.sfxNames && HAudio.sfxNames.indexOf(name) >= 0) HAudio.sfx(name, o); else if (fb) HAudio.sfx(fb, fo || o);
  },

  plant() {
    const V = this.V; if (!this.active || V.phase !== 'enter') return;
    V.plantK = 1; V.planting = false; V.phase = 'fuse'; this.phase = 'fuse'; V.fuse = this.FUSE; V.beepT = 0.05;
    this.charge.visible = true; this.mkPlant.visible = false;
    for (const m of this.members) if (m !== this.cur()) { m.ai.mode = 'cover'; m.ai.spot = this.coverSpot(m); m.ai.path = null; }
    HHud.prompt(); HHud.banner(t('cv_cover'), t('cv_coverSub'), 'busted', 2.2);
    if (window.HAudio) { HAudio.sfx('hackOk', { vol: 1 }); HAudio.musicIntensity(2); }
  },
  coverSpot(m) { // behind the pillar on m's side, away from the charge
    const P = this.PIL[m.x < 0 ? 0 : 1], dx = P[0] - this.CH.x, dz = P[1] - this.CH.z, d = Math.hypot(dx, dz);
    return { x: P[0] + dx / d * 1.0, z: P[1] + dz / d * 1.0 };
  },
  inCover(x, z) {
    if (Math.hypot(x - this.CH.x, z - this.CH.z) >= 5) return true;
    for (const [px, pz] of this.PIL) if (this.segBox(this.CH.x, this.CH.z, x, z, px - this.PHW, pz - this.PHW, px + this.PHW, pz + this.PHW) < 1) return true;
    return false;
  },
  segBox(x0, z0, x1, z1, bx0, bz0, bx1, bz1) { // slab test: hit fraction in [0,1], 1 = clear
    const dx = x1 - x0, dz = z1 - z0; let t0 = 0, t1 = 1;
    if (Math.abs(dx) < 1e-9) { if (x0 < bx0 || x0 > bx1) return 1; } else { let a = (bx0 - x0) / dx, c = (bx1 - x0) / dx; if (a > c) { const q = a; a = c; c = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return 1; }
    if (Math.abs(dz) < 1e-9) { if (z0 < bz0 || z0 > bz1) return 1; } else { let a = (bz0 - z0) / dz, c = (bz1 - z0) / dz; if (a > c) { const q = a; a = c; c = q; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return 1; }
    return t0;
  },

  blast() {
    const H = this.H, V = this.V; if (!this.active || (V.phase !== 'fuse' && V.phase !== 'enter')) return;
    const A = this.cur(), C = this.CH;
    V.phase = 'blast'; this.phase = 'blast'; V.blastT = 0; V.burn = 0; V.planting = false;
    this.charge.visible = false; this.burnG.visible = false; this.mkPlant.visible = false; HHud.prompt();
    V.inCover = A ? this.inCover(A.x, A.z) : true;
    // the door leaves its hinge; the vault behind it shows
    V.doorT = 0; this.doorBox.on = false; this.vaultG.visible = true; this.scorchF.visible = true; this.scorchW.visible = true;
    // fire, sparks, smoke, debris, dust
    const fx = this.fxA, sm = this.fxN;
    this.emit(fx, C.x, C.y + 0.3, C.z + 0.4, 0, 0, 0, 0.32, 9, 13, 3.5, 3.1, 2.6, 1, 0, 0);
    for (let k = 0; k < 80; k++) { const an = Math.random() * 6.28, el = (Math.random() - 0.3) * 1.4, s = 2 + Math.random() * 6; this.emit(fx, C.x + (Math.random() - 0.5) * 0.6, C.y + 0.4 + (Math.random() - 0.5) * 0.6, C.z + 0.3, Math.cos(an) * s * 0.8, Math.sin(el) * s + 1, Math.abs(Math.sin(an)) * s + 1.5, 0.35 + Math.random() * 0.5, 1.0, 3.2 + Math.random() * 1.5, 2.6, 1.25 + Math.random() * 0.6, 0.35, 0.9, -0.08, 2.2); }
    for (let k = 0; k < 170; k++) { const an = Math.random() * 6.28, s = 5 + Math.random() * 13; this.emit(fx, C.x, C.y + 0.3, C.z + 0.3, Math.cos(an) * s * 0.7, 1 + Math.random() * 7, Math.abs(Math.sin(an)) * s * 0.9 + 1, 0.6 + Math.random() * 0.9, 0.09, 0.03, 3, 2.0, 0.9, 1, 1, 0.4); }
    for (let k = 0; k < 60; k++) { const an = Math.PI * Math.random(), r = this.DR * (0.6 + Math.random() * 0.45); this.emit(sm, Math.cos(an) * r, this.DCY + Math.sin(an) * r * 0.9, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 2.5, 0.2 + Math.random() * 1.2, 1 + Math.random() * 2.8, 3.5 + Math.random() * 3, 1.2, 4.6 + Math.random() * 2, 0.3, 0.32, 0.36, 0.5, -0.02, 0.55); }
    for (let k = 0; k < 40; k++) { const an = Math.random() * 6.28, s = 4 + Math.random() * 9; this.emit(sm, C.x, C.y + 0.4, C.z + 0.3, Math.cos(an) * s * 0.6, 2 + Math.random() * 6, Math.abs(Math.sin(an)) * s, 1.2 + Math.random() * 0.8, 0.1, 0.08, 0.05, 0.05, 0.06, 1, 1, 0.2); }
    for (let k = 0; k < 26; k++) this.emit(sm, (Math.random() - 0.5) * 7, this.AH - 0.1, Math.random() * 6, (Math.random() - 0.5) * 0.3, -0.4 - Math.random() * 0.5, (Math.random() - 0.5) * 0.3, 3 + Math.random() * 2, 0.3, 1.2, 0.72, 0.74, 0.76, 0.28, 0, 0.2);
    this.shock.visible = true; this.shock.scale.setScalar(0.3); this.shock.material.opacity = 0.9; V.shockT = 0;
    V.fxI = 1; V.flick = 1.7; V.shake = 1.5;
    H.doFlash(1, 0.93, 0.8, 0.95);
    this.snd('explosion', { intensity: 1, power: 2 }, 'crash', { intensity: 1 });
    if (window.HAudio) { HAudio.sfx('impact', { intensity: 1 }); if (!(HAudio.sfxNames && HAudio.sfxNames.indexOf('explosion') >= 0)) HAudio.sfx('vaultOpen', { vol: 0.8 }); }
    // the player: in cover or thrown; the partner too, if it never made it to its pillar
    for (const m of this.members) {
      const safe = m === A ? V.inCover : (this.inCover(m.x, m.z) || (m.ai.mode === 'cover' && m.ai.spot && Math.hypot(m.x - m.ai.spot.x, m.z - m.ai.spot.z) < 1.2));
      if (!safe) this.knock(m, m.x - C.x, m.z - C.z, 6.5);
      else if (m !== A) m.ai.coverT = 1.1;
      if (m !== A) { m.ai.mode = 'stand'; m.ai.path = null; }
    }
    if (A && !V.inCover) { HHud.toast(t('cv_hit'), '#ff8f8f'); if (H.player) H.player.hp = Math.max(8, (H.player.hp || 100) - 30); }
    V.shot = { kind: 'blast', t: 0, dur: 1.7, out: 0.7 };
    this.navBuild();
  },
  knock(m, dx, dz, sp) { const d = Math.hypot(dx, dz) || 1; m.knockT = 1.6; m.vx = dx / d * sp; m.vz = dz / d * sp; },
  doorStep(dt) {
    const V = this.V, g = this.door, D = this.DOOR, Rr = this.DOOR_REST; if (V.doorT < 0 || !g) return;
    if (!V.doorLanded) {
      V.doorT += dt; const t = Math.min(V.doorT, Rr.t), u = t / Rr.t;
      const vy0 = (D.D / 2 - D.y + 4.9 * Rr.t * Rr.t) / Rr.t;
      g.position.set(Rr.x * u, D.y + vy0 * t - 4.9 * t * t, D.z + (Rr.z - D.z) * u);
      g.rotation.set(-Math.PI / 2 * Math.pow(u, 1.35), Rr.ry * u, 0.25 * Math.sin(Math.PI * u));
      if (Math.random() < dt * 40) this.emit(this.fxN, g.position.x + (Math.random() - 0.5), g.position.y, g.position.z, 0, 0.5, 0, 1.6, 0.6, 2.2, 0.32, 0.33, 0.36, 0.35, 0, 0.8);
      if (u >= 1) {
        V.doorLanded = true; V.doorBounce = 0; V.shake = Math.max(V.shake, 0.9);
        if (window.HAudio) { HAudio.sfx('impact', { intensity: 0.9 }); HAudio.sfx('crash', { intensity: 0.85 }); }
        for (let k = 0; k < 34; k++) { const an = k / 34 * 6.28; this.emit(this.fxN, Rr.x + Math.cos(an) * 1.9, 0.15, Rr.z + Math.sin(an) * 1.9, Math.cos(an) * 2.6, 0.3 + Math.random() * 0.5, Math.sin(an) * 2.6, 2 + Math.random() * 1.5, 0.5, 2.4, 0.55, 0.56, 0.58, 0.4, 0, 1.3); }
        // the fallen door is a low platform: people walk round it, cash lands on top of it
        this.circles.push({ x: Rr.x, z: Rr.z, r: D.R + 0.05 });
        const G = this.G;
        for (let c = 0; c < G.hgt.length; c++) if (Math.hypot(this.cx(c) - Rr.x, this.cz(c) - Rr.z) < D.R - 0.08) { G.base[c] = D.D; G.hgt[c] = Math.max(G.hgt[c], D.D); }
        for (const m of this.members) { const dx = m.x - Rr.x, dz = m.z - Rr.z, d = Math.hypot(dx, dz); if (d < D.R + 0.36) { if (m.knockT <= 0) this.knock(m, dx || 1, dz, 5); const k = (D.R + 0.4) / (d || 1); m.x = Rr.x + (dx || 1) * k; m.z = Rr.z + dz * k; } }
        this.navBuild();
      }
    } else if (V.doorBounce < 0.5) {
      V.doorBounce += dt; const b = V.doorBounce, h = b < 0.22 ? Math.sin(Math.PI * b / 0.22) * 0.09 : 0;
      g.position.y = D.D / 2 + h; g.rotation.z = 0.035 * Math.sin(b * 30) * Math.exp(-b * 7);
    }
  },

  resume() {
    if (!this.active) return; const V = this.V, H = this.H;
    if (V.phase !== 'blown' && V.phase !== 'blast') return;
    if (V.phase === 'blast') { V.blownSent = true; if (!V.doorLanded) { V.doorT = this.DOOR_REST.t; this.doorStep(0); } }
    V.phase = 'burst'; this.phase = 'burst'; V.burstT = 0; V.autoT = -1;
    this.burstStart();
    // slow motion (real time): ease in, hold ~1.2 s, ease out
    if (!V.slowOwned) { V.slowOwned = true; V.prevDesat = H.desat || 0; V.prevTint = H.desatTint || null; }
    this.slow = { t: 0, to: 0.35, hold: 1.25, outSnd: false };
    this.snd('slowIn', {}, 'whoosh', { intensity: 0.8 });
    this.snd('moneyBurst', { intensity: 1 }, 'bigCash', { vol: 1 });
    for (let k = 0; k < 70; k++) this.paper((Math.random() - 0.5) * 2, 0.6 + Math.random() * 2, -0.6, 1);
    V.shot = { kind: 'burst', t: 0, dur: 2.15, out: 0.75 };
    V.fxI = 0; V.accT = 0;
    for (const m of this.members) if (m !== this.cur()) { m.ai.mode = 'stand'; m.ai.path = null; }
    if (window.HAudio) HAudio.musicIntensity(2);
  },
  paper(x, y, z, n) { // loose bills fluttering (pale green specks)
    for (let k = 0; k < n; k++) this.emit(this.fxA, x, y, z, (Math.random() - 0.5) * 6, 1 + Math.random() * 4, 1 + Math.random() * 7, 1.2 + Math.random(), 0.06, 0.05, 0.55, 0.85, 0.55, 0.9, 0.25, 1.6);
  },
  slowStep(rdt) {
    const s = this.slow, H = this.H; if (!s) return;
    s.t += rdt; const inT = 0.2, outT = 0.65;
    let k = s.t < inT ? s.t / inT : s.t < inT + s.hold ? 1 : 1 - (s.t - inT - s.hold) / outT;
    k = HX.clamp(k, 0, 1); k = k * k * (3 - 2 * k);
    if (!s.outSnd && s.t >= inT + s.hold) { s.outSnd = true; this.snd('slowOut', {}, null); }
    H.timeScale = 1 - (1 - s.to) * k; H.desat = (this.V.prevDesat || 0) + 0.22 * k; H.desatTint = [0.9, 0.97, 1.12];
    if (s.t >= inT + s.hold + outT) { H.timeScale = 1; H.desat = this.V.prevDesat || 0; H.desatTint = this.V.prevTint || null; this.slow = null; this.V.slowOwned = false; }
  },
  startLoot() {
    const V = this.V; if (V.phase !== 'burst') return;
    V.phase = 'loot'; this.phase = 'loot'; V.timer = V.timer0; V.tick = 99;
    HHud.banner(t('cv_loot'), t('cv_lootSub'), 'green', 2.2);
    if (window.HAudio) HAudio.sfx('star', { vol: 0.8 });
    for (const m of this.members) if (m !== this.cur()) { m.ai.mode = 'loot'; m.ai.path = null; m.ai.tc = -1; m.ai.replan = 0.3; }
  },
  alarm() {
    if (!this.active) return; const V = this.V; if (V.alarmOn) return;
    V.alarmOn = true; V.phase = 'alarm'; this.phase = 'alarm'; V.alarmT = 0;
    if (this.slow) this.slow.t = Math.max(this.slow.t, 0.2 + this.slow.hold);
    if (window.HAudio) { HAudio.sfx('alarm'); HAudio.music('drive'); HAudio.musicIntensity(2); }
    HHud.banner(V.cleaned ? t('cv_clean') : t('cv_alarm'), t('cv_alarmSub'), 'busted', 2.4);
    this.mkExit.visible = true;
    for (const m of this.members) if (m !== this.cur()) { m.ai.mode = 'exit'; m.ai.path = null; }
    if (this.o.onAlarm) { try { this.o.onAlarm(); } catch (e) { console.error(e); } }
  },
  exit() {
    if (!this.active) return; const V = this.V; if (V.exitSent) return;
    V.exitSent = true; V.phase = 'out'; this.phase = 'out'; this.mkExit.visible = false; HHud.prompt();
    const res = this.result();
    if (this.o.onExit) { try { this.o.onExit(res); } catch (e) { console.error(e); } } else this.close();
  },

  /* ======================================================================= actors */
  moveActive(A, dt) {
    const H = this.H, V = this.V, cam = H.cam;
    if (A.knockT > 0) { this.knockStep(A, dt); return; }
    const locked = !!(V.shot && V.shot.t < V.shot.dur) || V.planting || V.phase === 'blown' || V.phase === 'out' || (V.phase === 'blast' && V.blastT < 1.4);
    const mv = locked ? null : H.moveInput();
    const mag = mv ? mv.mag : 0, run = mag > 0.05 && (H.key('ShiftLeft', 'ShiftRight') || (mag > 0.92 && !mv.keys));
    const runSp = 6.2 * (A.id === 'hadar' ? 1.18 : 1), sp = (run ? runSp : 3.8) * Math.min(1, mag * 1.15);
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -Math.cos(cam.yaw), rz = Math.sin(cam.yaw);
    const tvx = mv ? (fx * -mv.y + rx * mv.x) * sp : 0, tvz = mv ? (fz * -mv.y + rz * mv.x) * sp : 0;
    A.vx = HX.damp(A.vx, tvx, 12, dt); A.vz = HX.damp(A.vz, tvz, 12, dt);
    if (!V.planting) { A.x += A.vx * dt; A.z += A.vz * dt; }
    const spd = V.planting ? 0 : Math.hypot(A.vx, A.vz);
    if (spd > 0.3) A.h += HX.wrapAngle(Math.atan2(A.vx, A.vz) - A.h) * Math.min(1, dt * 12);
    A.at += dt * (spd > 0.3 ? spd / (spd > 4.5 ? runSp : 3.8) : 1);
    if (V.planting) { A.pose = 'kneel'; A.poseK = 1; }
    else if (spd > 4.5) { A.pose = 'run'; A.poseK = HX.clamp(spd / runSp, 0.3, 1); }
    else if (spd > 0.3) { A.pose = A.bag.visible && A.n + A.stacks > 0 ? 'carry' : 'walk'; A.poseK = HX.clamp(spd / 3.8, 0.3, 1); }
    else { A.pose = V.phase === 'burst' && V.burstT > 0.4 && V.burstT < 2.4 ? 'cheer' : 'idle'; A.poseK = 1; }
    if (window.HAudio && spd > 0.5) { A.stepT -= dt * spd * 0.42; if (A.stepT < 0) { A.stepT = 1; HAudio.step({ surface: A.z < this.WZ ? 'metal' : 'marble', vol: spd > 4.5 ? 1.05 : 0.75 }); } }
  },
  knockStep(m, dt) {
    m.knockT -= dt; const k = Math.exp(-3.2 * dt); m.vx *= k; m.vz *= k; m.x += m.vx * dt; m.z += m.vz * dt;
    m.pose = 'fall'; m.poseK = HX.clamp((1.6 - m.knockT) / 0.5, 0, 1);
    if (m.knockT < 0.35) m.poseK = HX.clamp(m.knockT / 0.35, 0, 1); // get back up
    if (m.knockT <= 0) { m.knockT = 0; m.vx = m.vz = 0; m.pose = 'idle'; m.poseK = 1; }
  },
  moveAI(m, dt) {
    const V = this.V, A = this.cur(), ai = m.ai;
    if (m.knockT > 0) { this.knockStep(m, dt); return; }
    const moved = m.lx === undefined ? 1 : Math.hypot(m.x - m.lx, m.z - m.lz); m.lx = m.x; m.lz = m.z;
    ai.replan -= dt; ai.kneelT = Math.max(0, ai.kneelT - dt);
    let goal = null, arrive = 0.3, face = Math.PI, pose = 'idle', speed = 3.7;
    if (ai.mode === 'follow' && A) {
      const lx = Math.cos(A.h), lz = -Math.sin(A.h), fx = Math.sin(A.h), fz = Math.cos(A.h);
      const gx = HX.clamp(A.x - fx * 1.9 + lx * 1.0, -this.AX + 0.5, this.AX - 0.5), gz = HX.clamp(A.z - fz * 1.9 + lz * 1.0, 0.6, this.AZ - 0.6);
      const d = Math.hypot(m.x - gx, m.z - gz);
      if (d > (ai.moving ? 0.45 : 1.6)) { goal = ai.g; goal.x = gx; goal.z = gz; speed = d > 4.5 ? 5.8 : 3.7; }
      face = Math.atan2(this.CH.x - m.x, this.CH.z - m.z);
    } else if (ai.mode === 'cover') {
      const s = ai.spot || (ai.spot = this.coverSpot(m)); speed = 6.2;
      face = Math.atan2(this.CH.x - m.x, this.CH.z - m.z);
      if (Math.hypot(m.x - s.x, m.z - s.z) < 0.35) pose = 'cover'; else goal = s;
    } else if (ai.mode === 'stand') {
      ai.coverT = Math.max(0, (ai.coverT || 0) - dt);
      face = Math.atan2(-m.x * 0.3, -1 - m.z);
      pose = ai.coverT > 0 ? 'cover' : V.phase === 'burst' && V.burstT > 0.35 && V.burstT < 2.5 ? 'cheer' : 'idle';
    } else if (ai.mode === 'loot') {
      const r = this.aiLoot(m, dt);
      if (r === 'grab') { pose = 'kneel'; face = m.h; }
      else if (r) { goal = r; speed = 4.3; arrive = 0.2; }
      else face = m.h;
      if (!r && ai.kneelT > 0) pose = 'kneel';
    } else if (ai.mode === 'exit') {
      const ex = ai.g; ex.x = this.EXIT.x - 1.15; ex.z = this.EXIT.z - 0.3; speed = 6.2;
      if (Math.hypot(m.x - ex.x, m.z - ex.z) < 0.4) face = A ? Math.atan2(A.x - m.x, A.z - m.z) : 0; else goal = ex;
    }
    // steer along a grid path
    let tvx = 0, tvz = 0;
    if (goal) {
      if (!ai.path || ai.replan <= 0 || Math.hypot(ai.gx - goal.x, ai.gz - goal.z) > 0.7) { ai.path = this.findPath(m.x, m.z, goal.x, goal.z) || [goal]; ai.pi = 0; ai.gx = goal.x; ai.gz = goal.z; ai.replan = 1.1; }
      let wp = ai.path[Math.min(ai.pi, ai.path.length - 1)];
      while (ai.pi < ai.path.length - 1 && Math.hypot(wp.x - m.x, wp.z - m.z) < 0.32) { ai.pi++; wp = ai.path[ai.pi]; }
      const dx = wp.x - m.x, dz = wp.z - m.z, d = Math.hypot(dx, dz), last = ai.pi >= ai.path.length - 1;
      if (!(last && d < arrive)) { const k = last ? Math.max(0.35, Math.min(1, d / 0.7)) : 1; tvx = dx / (d || 1) * speed * k; tvz = dz / (d || 1) * speed * k; }
      ai.moving = true;
      // stuck (pushed against something)? -> plan again
      if (speed > 1 && moved < speed * dt * 0.2) { ai.stuck += dt; if (ai.stuck > 0.6) { ai.stuck = 0; ai.replan = 0; } } else ai.stuck = 0;
    } else { ai.moving = false; ai.path = null; ai.stuck = 0; }
    m.vx = HX.damp(m.vx, tvx, 9, dt); m.vz = HX.damp(m.vz, tvz, 9, dt);
    m.x += m.vx * dt; m.z += m.vz * dt;
    const spd = Math.hypot(m.vx, m.vz);
    if (spd > 0.3) m.h += HX.wrapAngle(Math.atan2(m.vx, m.vz) - m.h) * Math.min(1, dt * 10);
    else m.h += HX.wrapAngle(face - m.h) * Math.min(1, dt * 5);
    m.at += dt * (spd > 0.3 ? spd / (spd > 4.6 ? 6.2 : 3.8) : 1);
    if (spd > 4.6) { m.pose = 'run'; m.poseK = HX.clamp(spd / 6.2, 0.3, 1); }
    else if (spd > 0.3) { m.pose = m.bag.visible && m.n + m.stacks > 0 ? 'carry' : 'walk'; m.poseK = HX.clamp(spd / 3.8, 0.3, 1); }
    else { m.pose = pose; m.poseK = 1; }
  },
  aiLoot(m, dt) {
    const ai = m.ai, G = this.G, A = this.cur();
    if (this.grabStack(m, 1.2)) { ai.kneelT = 0.4; ai.tc = -1; return 'grab'; }
    const k = this.pick(m.x, m.z, 0.6);
    if (k >= 0) { ai.grabT -= dt; if (ai.grabT <= 0) { this.take(k, m); ai.grabT = 0.21; ai.kneelT = 0.45; } return 'grab'; }
    const tgtOk = ai.tc >= 0 && (G.cnt[ai.tc] > 0 || G.stack[ai.tc]);
    if ((!tgtOk && ai.tc !== -2) || ai.replan <= 0) { // (-2: nothing reachable last time -> wait for the next re-plan)
      const s = this.nearestNav(m.x, m.z), ax = A ? A.x : 99, az = A ? A.z : 99;
      const want = (c, avoid) => (G.cnt[c] > 0 || G.stack[c] > 0) && (!avoid || Math.hypot(this.cx(c) - ax, this.cz(c) - az) > 1.9);
      let e = this.bfs(s, c => want(c, true)); if (e < 0) e = this.bfs(s, c => want(c, false));
      ai.tc = e < 0 ? -2 : e; ai.replan = 1.4;
      if (e < 0) return null;
      ai.path = this.pathTo(e); ai.pi = 0; ai.gx = this.cx(e); ai.gz = this.cz(e);
    }
    if (ai.tc < 0) return null;
    ai.g.x = this.cx(ai.tc); ai.g.z = this.cz(ai.tc); return ai.g;
  },
  actorsCollide() {
    const o = this._tmp.v, ms = this.members, A = this.cur();
    for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i], b = ms[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), rr = 0.66;
      if (d < rr && d > 1e-5) { const p = (rr - d) / d, wa = a === A ? 0.2 : 0.5, wb = b === A ? 0.2 : 0.5, s = wa + wb; a.x -= dx * p * wa / s; a.z -= dz * p * wa / s; b.x += dx * p * wb / s; b.z += dz * p * wb / s; }
    }
    for (const m of ms) { this.resolve(m.x, m.z, 0.33, o); m.x = o.x; m.z = o.z; }
  },
  lootStep(dt) {
    const A = this.cur(); if (!A || A.knockT > 0) return;
    this.grabStack(A, 1.2);
    A.grabT -= dt;
    while (A.grabT <= 0) { const k = this.pick(A.x, A.z, 0.85); if (k < 0) { A.grabT = 0; break; } this.take(k, A); A.grabT += 0.055; }
  },
  bagPos(m) {
    const v = this._tmp.v2;
    if (m.bag && m.bag.parent && m.bag.visible) { m.bag.getWorldPosition(v); m.bx = v.x; m.by = v.y; m.bz = v.z; }
    else { m.bx = m.x - Math.cos(m.h) * 0.3; m.by = 0.85; m.bz = m.z + Math.sin(m.h) * 0.3; }
  },
  placeRigs() { for (const m of this.members) { const g = m.rig.group; if (g.parent !== this.scene) this.scene.add(g); g.position.set(m.x, 0, m.z); g.rotation.y = m.h; } },
  syncRigs() {
    const tt0 = this.V.t;
    this.placeRigs();
    for (const m of this.members) {
      const cyc = m.pose === 'walk' || m.pose === 'run' || m.pose === 'carry';
      m.rig.setPose(m.pose, cyc ? m.at : tt0 + m.ph, m.poseK);
    }
  },

  /* ======================================================================= lights */
  lightsStep(dt, rdt) {
    const V = this.V, L = this.L, t = V.rt;
    // ceiling lights: flicker after the blast, dim + red-shifted during the alarm
    let k = 1;
    if (V.flick > 0) { V.flick -= rdt; k = Math.random() < 0.35 ? 0.2 + Math.random() * 0.3 : 1; }
    if (V.alarmOn) k *= 0.55;
    L.a1.intensity = L.a1.userData.base * k; L.a2.intensity = L.a2.userData.base * k; L.spot.intensity = L.spot.userData.base * k;
    L.v1.intensity = this.vaultG.visible ? L.v1.userData.base * k : 0;
    const pb = this.panelBase, rd = V.alarmOn ? 0.8 : 1; this.M.panel.color.setRGB(pb[0] * k, pb[1] * k * rd, pb[2] * k * rd);
    // fx lights: blast flash > thermal burn > burst accents > alarm strobe
    let i1 = 0, i2 = 0;
    if (V.fxI > 0.01) {
      V.fxI *= Math.exp(-3.6 * rdt);
      L.f1.color.setRGB(1, 0.62, 0.3); L.f1.position.set(this.CH.x, 1.4, 1.2); i1 = 14 * V.fxI;
      L.f2.color.setRGB(1, 0.75, 0.45); L.f2.position.set(0, 2.2, -2.5); i2 = 6 * V.fxI;
    } else if (V.phase === 'fuse' && V.burn > 0) {
      L.f1.color.setRGB(1, 0.55, 0.25); L.f1.position.set(this.CH.x, this.CH.y + 0.2, this.CH.z + 0.6); i1 = (1.5 + 5 * V.burn) * (0.7 + Math.random() * 0.5);
    } else if (V.phase === 'burst' || (V.phase === 'loot' && V.accT < 1.2)) {
      if (V.phase === 'loot') V.accT += rdt;
      const fade = V.phase === 'burst' ? Math.min(1, V.burstT * 3) : 1 - V.accT / 1.2, p = Math.sin(t * 9);
      L.f1.color.setRGB(1, 0.1, 0.16); L.f1.position.set(-3.6, 3.6, 2.2); L.f2.color.setRGB(0.15, 0.3, 1); L.f2.position.set(3.6, 3.6, 2.2);
      i1 = 2.6 * fade * Math.max(0, p); i2 = 2.6 * fade * Math.max(0, -p);
    } else if (V.alarmOn) {
      const ph = Math.floor(t * 5) % 2, pulse = 0.5 + 0.5 * Math.sin(t * 10);
      L.f1.color.setRGB(1, 0.06, 0.08); L.f2.color.setRGB(1, 0.06, 0.08); L.f1.position.set(-3.9, 3.5, 1.2); L.f2.position.set(3.9, 3.5, 1.2);
      i1 = ph ? 3.4 * pulse + 0.6 : 0.25; i2 = ph ? 0.25 : 3.4 * pulse + 0.6;
      this.M.beacon.color.setRGB(ph ? 3 : 0.4, ph ? 0.15 : 0.05, ph ? 0.15 : 0.05);
    }
    L.f1.intensity = i1; L.f2.intensity = i2;
    // the burn glow sprite on the charge
    if (V.phase === 'fuse' && V.burn > 0) { this.burnG.visible = true; const s = (0.35 + V.burn * 1.4) * (0.85 + Math.random() * 0.3); this.burnG.scale.set(s, s, 1); this.burnG.material.color.setRGB(2.2, 1.6 + V.burn * 0.4, 1.0 + V.burn * 0.6); }
    // markers + the shockwave ring
    if (V.phase === 'enter') { this.mkPlant.visible = !V.planting; this.mkPlant.scale.setScalar(1 + Math.sin(t * 4) * 0.08); }
    if (this.mkExit.visible) this.mkExit.scale.setScalar(1 + Math.sin(t * 5) * 0.1);
    if (this.shock.visible) { V.shockT += dt; const u = V.shockT / 0.5; this.shock.scale.setScalar(0.3 + u * 9); this.shock.material.opacity = 0.9 * Math.max(0, 1 - u); if (u >= 1) this.shock.visible = false; }
  },

  /* ======================================================================= camera */
  camera(dt, c, mouse) {
    if (!this.active) return;
    const H = this.H, V = this.V, cam = H.cam, A = this.cur(); if (!A) return;
    const rdt = H.realDt || dt, shotOn = !!(V.shot && V.shot.t < V.shot.dur);
    let manual = false;
    if (!shotOn) {
      if (mouse.dx || mouse.dy) { cam.yaw -= mouse.dx * 0.0026; cam.pitch = HX.clamp(cam.pitch + mouse.dy * 0.0026 * 0.8, -0.25, 0.95); manual = true; }
      const look = Input.stickVec('aim', 10);
      if (look && look.mag > 0) { cam.yaw -= look.x * 2.6 * rdt; cam.pitch = HX.clamp(cam.pitch + look.y * 1.4 * rdt, -0.25, 0.95); manual = true; }
      if (H.key('KeyQ')) { cam.yaw += 2.2 * rdt; manual = true; } if (H.key('KeyR')) { cam.yaw -= 2.2 * rdt; manual = true; }
    }
    cam.manualT = manual ? 1.6 : Math.max(0, (cam.manualT || 0) - rdt);
    // the focus point glides to a new member after a switch
    const f = this.fp; f.t = Math.min(f.d, f.t + rdt); const u = f.t / f.d, e = u * u * (3 - 2 * u);
    f.x = HX.lerp(f.x0, A.x, e); f.z = HX.lerp(f.z0, A.z, e);
    const spd = Math.hypot(A.vx, A.vz);
    if (cam.manualT <= 0 && spd > 1 && (Input.touchMode || spd > 5)) cam.yaw += HX.wrapAngle(A.h - cam.yaw) * (1 - Math.exp(-1.1 * rdt));
    const ty = 1.45, dist = A.z < this.WZ ? 3.5 : 4.1;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let cx = f.x - Math.sin(cam.yaw) * cp * dist, cz = f.z - Math.cos(cam.yaw) * cp * dist, cy = ty + sp * dist + 0.25;
    const hit = this.camRay(f.x, f.z, cx, cz);
    if (hit < 1) { const k = Math.max(0.12, hit - 0.06); cx = f.x + (cx - f.x) * k; cz = f.z + (cz - f.z) * k; cy = HX.lerp(ty + 0.3, cy, k); }
    cy = HX.clamp(cy, 0.45, this.ceilAt(cz) - 0.3);
    if (!this.cp) this.cp = { x: cx, y: cy, z: cz };
    const P = this.cp, k = 1 - Math.exp(-18 * rdt);
    P.x = HX.lerp(P.x, cx, k); P.y = HX.lerp(P.y, cy, k); P.z = HX.lerp(P.z, cz, k);
    let px = P.x, py = P.y, pz = P.z, lx = f.x, ly = ty + 0.1, lz = f.z, fov = 60;
    if (V.fov > 0) { V.fov += rdt; const q = Math.min(1, V.fov / 0.6); fov -= 7 * Math.sin(Math.PI * q); if (q >= 1) V.fov = 0; }
    // scripted shots: a hard cut in, an eased glide back to the follow camera
    if (V.shot) {
      const S = V.shot; S.t += rdt;
      const sh = this.shotPose(S);
      let w = 1; if (S.t > S.dur) { const q = Math.min(1, (S.t - S.dur) / S.out); w = 1 - q * q * (3 - 2 * q); }
      px = HX.lerp(px, sh.x, w); py = HX.lerp(py, sh.y, w); pz = HX.lerp(pz, sh.z, w);
      lx = HX.lerp(lx, sh.lx, w); ly = HX.lerp(ly, sh.ly, w); lz = HX.lerp(lz, sh.lz, w); fov = HX.lerp(fov, sh.fov, w);
      if (S.t >= S.dur + S.out) V.shot = null;
    }
    V.shake = Math.max(0, V.shake - rdt * 1.6);
    const s = V.shake * V.shake * 0.28;
    c.position.set(px + (Math.random() - 0.5) * s, py + (Math.random() - 0.5) * s, pz + (Math.random() - 0.5) * s);
    c.fov = fov; c.updateProjectionMatrix();
    c.lookAt(lx, ly, lz);
    cam.x = px; cam.y = py; cam.z = pz;
  },
  _sp: { x: 0, y: 0, z: 0, lx: 0, ly: 0, lz: 0, fov: 60 },
  shotPose(S) { // blast: low and wide past the left pillar; burst: in front of the opening, the money flying at the lens
    const u = HX.clamp(S.t / S.dur, 0, 1), e = 1 - Math.pow(1 - u, 2), o = this._sp, b = S.kind === 'blast';
    o.x = b ? HX.lerp(-3.75, -3.35, e) : HX.lerp(-2.3, -1.6, e); o.y = b ? HX.lerp(1.2, 1.32, e) : HX.lerp(1.0, 1.1, e); o.z = b ? HX.lerp(10.9, 9.9, e) : HX.lerp(4.2, 3.3, e);
    o.lx = b ? 0.45 : 0.3; o.ly = b ? 1.45 : 1.4; o.lz = b ? 1.0 : -1.4; o.fov = b ? 54 : 62;
    return o;
  },
  ceilAt(z) { return z > 0.05 ? this.AH : z < this.WZ - 0.05 ? this.VH : 3.3; },
  camRay(x0, z0, x1, z1) {
    let best = 1;
    for (const b of this.camSolids) { if (!b.on) continue; const h = this.segBox(x0, z0, x1, z1, b.x0, b.z0, b.x1, b.z1); if (h < best) best = h; }
    return best;
  },

  touchButtons() {
    const B = Input.BTN, a = this.V ? this.V.action : null;
    return [{ x: B.special.x, y: B.special.y, r: B.r, label: a === 'leave' ? '🚪' : '✋', col: '#ffd23f', on: !!a }];
  },

  /* ======================================================================= HUD */
  CSS: `
  #cv-ui { position:absolute; inset:0; pointer-events:none; }
  #cv-ui .cv-red { position:absolute; inset:0; opacity:0; background: radial-gradient(ellipse at center, rgba(255,0,30,0) 42%, rgba(255,16,40,.28) 72%, rgba(255,10,30,.62) 100%); }
  #cv-ui .cv-hold { position:absolute; left:calc(50% + 120px); bottom:250px; width:96px; height:96px; opacity:0; transform:scale(.7); transition: opacity .18s, transform .25s cubic-bezier(.2,1.5,.4,1); }
  #cv-ui .cv-hold.on { opacity:1; transform:scale(1); }
  #cv-ui svg { display:block; width:100%; height:100%; transform: rotate(-90deg); overflow:visible; }
  #cv-ui circle { fill:none; }
  #cv-ui .cv-hold .bg { stroke: rgba(6,10,18,.72); stroke-width:10; }
  #cv-ui .cv-hold .fg { stroke:#ffd23f; stroke-width:7; stroke-linecap:round; stroke-dasharray: 0 100; filter: drop-shadow(0 0 6px rgba(255,210,63,.85)); }
  #cv-ui .cv-hold b { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font: 900 30px/1 var(--body); color:#fff; text-shadow:0 2px 0 #000; }
  #cv-ui .cv-cover { position:absolute; left:50%; top:60%; transform: translateX(-50%); display:flex; align-items:center; gap:12px; padding:9px 18px; border-radius:999px; background: rgba(6,10,18,.78); border:2px solid var(--c, #ff4d5e); font: 800 21px/1 var(--body); color:#fff; letter-spacing:.5px; white-space:nowrap; opacity:0; transition: opacity .25s, border-color .2s; }
  #cv-ui .cv-cover.on { opacity:1; }
  #cv-ui .cv-cover i { width:14px; height:14px; border-radius:50%; background: var(--c, #ff4d5e); box-shadow: 0 0 12px var(--c, #ff4d5e); flex:none; }
  #cv-ui .cv-cover.bad i { animation: cvblink .3s steps(2) infinite; }
  #cv-ui .cv-cover em { display:block; width:120px; height:7px; border-radius:4px; background: rgba(255,255,255,.14); overflow:hidden; }
  #cv-ui .cv-cover em u { display:block; height:100%; width:100%; transform-origin: left center; background: linear-gradient(90deg,#ffd23f,#ff5a2e); }
  [dir="rtl"] #cv-ui .cv-cover em u { transform-origin: right center; }
  @keyframes cvblink { 50% { opacity:.2; } }
  #cv-ui .cv-loot { position:absolute; left:22px; bottom:18px; width:262px; padding:14px 16px 12px; border-radius:16px; color:#fff;
    background: linear-gradient(160deg, rgba(16,24,38,.9), rgba(6,9,15,.82)); border:1px solid rgba(160,200,255,.22); box-shadow: 0 12px 30px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.08);
    transform: scale(var(--u)); transform-origin: bottom left; opacity:0; transition: opacity .35s; }
  [dir="rtl"] #cv-ui .cv-loot { left:auto; right:22px; transform-origin: bottom right; }
  #cv-ui .cv-loot.on { opacity:1; }
  #cv-ui .cv-tm { display:flex; align-items:center; gap:12px; }
  #cv-ui .cv-tm .ring { position:relative; width:58px; height:58px; flex:none; }
  #cv-ui .cv-tm .bg { stroke: rgba(255,255,255,.12); stroke-width:9; }
  #cv-ui .cv-tm .fg { stroke: #9fd0ff; stroke-width:9; stroke-linecap:round; stroke-dasharray: 100 100; transition: stroke .3s; }
  #cv-ui .cv-tm .ring::after { content:''; position:absolute; left:50%; top:50%; width:16px; height:16px; margin:-8px 0 0 -8px; border-radius:50%; background: radial-gradient(circle, #ff5a6a 0 40%, transparent 45%); box-shadow: 0 0 0 3px rgba(255,90,106,.28); }
  #cv-ui .cv-tm small { display:block; font: 800 12px/1 var(--body); letter-spacing:3px; color: rgba(190,215,255,.75); }
  #cv-ui .cv-tm b { display:block; margin-top:3px; font: 400 48px/0.9 'Bebas Neue', Impact, sans-serif; letter-spacing:1px; direction:ltr; font-variant-numeric: tabular-nums; }
  [dir="rtl"] #cv-ui .cv-tm b { text-align:right; }
  #cv-ui .cv-loot.hot .cv-tm b { color:#ff5a6a; animation: cvpulse .5s ease-in-out infinite alternate; }
  #cv-ui .cv-loot.hot .cv-tm .fg { stroke:#ff5a6a; }
  #cv-ui .cv-loot.alarm .cv-tm b { color:#ff5a6a; }
  @keyframes cvpulse { to { transform: scale(1.08); text-shadow: 0 0 14px rgba(255,60,80,.8); } }
  #cv-ui .cv-bags { margin-top:10px; display:flex; flex-direction:column; gap:6px; }
  #cv-ui .cv-bag { display:flex; align-items:center; gap:10px; padding:5px 9px 5px 6px; border-radius:11px; background: rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.06); }
  #cv-ui .cv-bag.cur { border-color: var(--ac); background: rgba(255,255,255,.1); box-shadow: inset 3px 0 0 var(--ac); }
  [dir="rtl"] #cv-ui .cv-bag.cur { box-shadow: inset -3px 0 0 var(--ac); }
  #cv-ui .cv-bag i { width:32px; height:32px; border-radius:50%; flex:none; background: #223 url(assets/crew_faces.jpg) var(--fx, 0%) 0% / 300% 100% no-repeat; box-shadow: 0 0 0 2px var(--ac); }
  #cv-ui .cv-bag span { flex:1; font: 700 16px/1 var(--body); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #cv-ui .cv-bag b { font: 400 25px/1 'Bebas Neue', Impact, sans-serif; color:#7dffb0; direction:ltr; font-variant-numeric: tabular-nums; letter-spacing:.5px; }
  #cv-ui .cv-bag.bump b { animation: cvbump .28s ease-out; }
  @keyframes cvbump { from { transform: scale(1.22); color:#d8ffe9; } to { transform:none; } }
  #cv-ui .cv-tot { margin-top:9px; padding-top:8px; border-top:1px solid rgba(255,255,255,.12); display:flex; align-items:baseline; justify-content:space-between; }
  #cv-ui .cv-tot small { font: 800 12px/1 var(--body); letter-spacing:3px; color: rgba(190,215,255,.75); }
  #cv-ui .cv-tot b { font: 400 32px/1 'Bebas Neue', Impact, sans-serif; color:#7dffb0; direction:ltr; text-shadow: 0 0 14px rgba(80,255,160,.35); font-variant-numeric: tabular-nums; }
  /* phones: a compact strip at the bottom centre, between the thumbs */
  #hhud.touch #cv-ui .cv-loot, [dir="rtl"] #hhud.touch #cv-ui .cv-loot { left:50%; right:auto; bottom:10px; width:auto; display:flex; align-items:center; gap:14px; padding:8px 14px; transform: translateX(-50%) scale(min(var(--u), 1.25)); transform-origin: bottom center; }
  #hhud.touch #cv-ui .cv-tm .ring { width:44px; height:44px; }
  #hhud.touch #cv-ui .cv-tm b { font-size:38px; }
  #hhud.touch #cv-ui .cv-bags { margin:0; flex-direction:row; }
  #hhud.touch #cv-ui .cv-bag span { display:none; }
  #hhud.touch #cv-ui .cv-tot { margin:0; padding:0 0 0 12px; border:0; border-left:1px solid rgba(255,255,255,.14); flex-direction:column; gap:3px; }
  [dir="rtl"] #hhud.touch #cv-ui .cv-tot { padding:0 12px 0 0; border-left:0; border-right:1px solid rgba(255,255,255,.14); }
  #hhud.touch #cv-ui .cv-hold { bottom: calc(230px * var(--u)); transform-origin: bottom left; }
  #hhud.touch #cv-ui .cv-hold.on { transform: scale(min(var(--u), 1.3)); }
  #hhud.touch #cv-ui .cv-cover { transform: translateX(-50%) scale(min(var(--u), 1.3)); }
  `,
  ui() {
    if (!document.getElementById('cv-style')) { const st = document.createElement('style'); st.id = 'cv-style'; st.textContent = this.CSS; document.head.appendChild(st); }
    const root = document.createElement('div'); root.id = 'cv-ui';
    const ring = '<svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="42" pathLength="100"/><circle class="fg" cx="50" cy="50" r="42" pathLength="100"/></svg>';
    root.innerHTML = `<div class="cv-red"></div><div class="cv-hold">${ring}<b>E</b></div><div class="cv-cover"><i></i><span></span><em><u></u></em></div>
      <div class="cv-loot"><div class="cv-tm"><div class="ring">${ring}</div><div><small></small><b>0:45</b></div></div><div class="cv-bags"></div><div class="cv-tot"><small></small><b>$0</b></div></div>`;
    const host = HHud.el || this.H.stage; host.insertBefore(root, host.firstChild);
    const q = s => root.querySelector(s);
    this.$ = { root, red: q('.cv-red'), hold: q('.cv-hold'), holdFg: q('.cv-hold .fg'), holdK: q('.cv-hold b'), cover: q('.cv-cover'), coverT: q('.cv-cover span'), fuse: q('.cv-cover em u'),
      loot: q('.cv-loot'), tmL: q('.cv-tm small'), tm: q('.cv-tm b'), tmFg: q('.cv-tm .fg'), bags: q('.cv-bags'), totL: q('.cv-tot small'), tot: q('.cv-tot b'), bag: {} };
  },
  buildBags() {
    const $ = this.$; $.bags.innerHTML = ''; $.bag = {};
    for (const m of this.members) {
      const d = document.createElement('div'), f = this.FACE[m.id]; d.className = 'cv-bag';
      d.style.setProperty('--ac', this.ACCENT[m.id] || '#9fd0ff');
      d.innerHTML = '<i></i><span></span><b>$0</b>'; d.querySelector('span').textContent = this.name(m.id);
      if (f !== undefined) d.style.setProperty('--fx', (f * 50) + '%'); else d.querySelector('i').style.backgroundImage = 'none';
      $.bags.appendChild(d); $.bag[m.id] = { el: d, b: d.querySelector('b'), v: -1 };
    }
    $.tmL.textContent = t('cv_timer'); $.totL.textContent = t('cv_take');
  },
  name(id) {
    try { const m = window.HCrew && HCrew.member && HCrew.member(id); if (m && m.short) return m.short(); } catch (e) {}
    const s = t('cv_n_' + id); return typeof s === 'string' ? s : id;
  },
  money(n) { return '$' + Math.round(n).toLocaleString('en-US'); },
  hud() {
    const $ = this.$, V = this.V; if (!$) return;
    const hk = V.hk, A = this.cur();
    if (V.lang !== LANG) { V.lang = LANG; this.buildBags(); V.objKey = ''; hk.bags = ''; hk.cover = ''; hk.al = undefined; }
    // objective
    const ph = V.phase, sec = ph === 'loot' ? Math.ceil(Math.max(0, V.timer)) : 0;
    if (ph !== V.objPh || sec !== V.objSec || V.objKey !== 'ok') {
      V.objPh = ph; V.objSec = sec; V.objKey = 'ok'; const pre = ph === 'enter', fuse = ph === 'fuse', mid = ph === 'blast' || ph === 'blown' || ph === 'burst';
      let lines;
      if (pre || fuse || mid) lines = [{ t: t('cv_o_plant'), done: !pre, cur: pre }, { t: t('cv_o_cover'), done: mid, cur: fuse }, { t: t('cv_o_loot'), cur: mid }];
      else if (ph === 'loot') lines = [{ t: t('cv_o_loot'), cur: true }, { t: t('cv_o_alarm', { n: sec }) }];
      else lines = [{ t: t('cv_o_loot'), done: true }, { t: t('cv_o_out'), cur: ph === 'alarm' }];
      HHud.setObjective(t('cv_title'), lines);
    }
    // hold-to-plant ring
    const holdOn = ph === 'enter' && (V.action === 'plant' || V.plantK > 0.01);
    if (holdOn !== hk.hold) { hk.hold = holdOn; $.hold.classList.toggle('on', holdOn); }
    const pk = Math.round(V.plantK * 100);
    if (pk !== hk.pk) { hk.pk = pk; $.holdFg.style.strokeDasharray = pk + ' 100'; }
    const kk = Input.touchMode ? '✋' : 'E'; if (kk !== hk.kk) { hk.kk = kk; $.holdK.textContent = kk; }
    // the cover chip during the fuse
    const covOn = ph === 'fuse';
    if (covOn) {
      const ok = A ? this.inCover(A.x, A.z) : true, ck = (ok ? 1 : 0) + LANG;
      if (ck !== hk.cover) { hk.cover = ck; $.coverT.textContent = ok ? t('cv_inCover') : t('cv_noCover'); $.cover.style.setProperty('--c', ok ? '#5cf2a8' : '#ff4d5e'); $.cover.classList.toggle('bad', !ok); }
      $.fuse.style.transform = `scaleX(${HX.clamp(V.fuse / this.FUSE, 0, 1).toFixed(3)})`;
    }
    if (covOn !== hk.covOn) { hk.covOn = covOn; $.cover.classList.toggle('on', covOn); }
    // the loot panel
    const lootOn = ph === 'loot' || ph === 'alarm' || ph === 'out';
    if (lootOn !== hk.loot) { hk.loot = lootOn; $.loot.classList.toggle('on', lootOn); }
    if (lootOn) {
      const tl = V.alarmOn ? 0 : Math.max(0, V.timer), s = Math.ceil(tl);
      if (s !== hk.tm) { hk.tm = s; $.tm.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
      const fr = Math.round(tl / V.timer0 * 1000) / 10; if (fr !== hk.fr) { hk.fr = fr; $.tmFg.style.strokeDasharray = fr + ' 100'; }
      const hot = !V.alarmOn && tl <= 10, al = V.alarmOn;
      if (hot !== hk.hot) { hk.hot = hot; $.loot.classList.toggle('hot', hot); }
      if (al !== hk.al) { hk.al = al; $.loot.classList.toggle('alarm', al); $.tmL.textContent = al ? t('cv_alarm') : t('cv_timer'); }
      const cid = A ? A.id : ''; if (cid !== hk.bags) { hk.bags = cid; for (const id in $.bag) $.bag[id].el.classList.toggle('cur', id === cid); }
      let tot = 0;
      for (const m of this.members) {
        tot += m.cash; const b = $.bag[m.id];
        if (b && b.v !== m.cash) { const up = b.v >= 0; b.v = m.cash; b.b.textContent = this.money(m.cash); if (up) { b.el.classList.remove('bump'); void b.el.offsetWidth; b.el.classList.add('bump'); } }
      }
      if (tot !== hk.tot) { hk.tot = tot; $.tot.textContent = this.money(tot); }
    }
    // the alarm's red vignette strobe
    const ra = V.alarmOn ? (Math.floor(V.rt * 5) % 2 ? 0.95 : 0.25) * (0.75 + 0.25 * Math.sin(V.rt * 10)) : 0, rs = Math.round(ra * 20) / 20;
    if (rs !== hk.red) { hk.red = rs; $.red.style.opacity = rs; }
  },
};
window.HCrewVault = HCrewVault;
