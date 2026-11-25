/* Chapter 3 "THE CREW": the three playable crew members (Yoav, Hadar, Ido) and GTA-style character switching:
   the crew wheel (hold Tab, or tap the crew strip), quick switch (1/2/3), the sky-cam and zoom-punch transitions,
   seated passengers + a visible driver, the inactive members and their cars living in the world, and the abilities
   (Ido's Focus, Hadar's sprint + toughness, Yoav's eye for cash). Contract: CREW_SPEC.md section C.

   API
   HCrew.setup(H, { members: { yoav:{x,z,h, car?, seat?, masked?, pose?}, hadar:{...}, ido:{...} }, active:'ido' })
       car  = a vehicle (H.makeCar(...)), a spot {x,z,h, kind?='lux', color?} (the car is made here) or another member's
              id ('ido' = sit in Ido's car). seat = 'driver'|'passenger'|'rearL'|'rearR' (needs a car; x/z/h then optional).
              Members left out of `members` are not part of the cast. A second setup() rebuilds the cast (the cars the
              previous setup made from spots are removed unless passed in again as vehicles).
   HCrew.members   [{ id, name(), short(), role(), ability(), accent ('#rrggbb'), face (0..2: cell of crew_faces.jpg),
                      p (player-like: rig,x,z,y,h,vx,vz,vy,anim,at,inCar,knockT,enterT,hp,crew), car (the car this member
                      drives/owns or null), seat ('driver'|'passenger'|'rearL'|'rearR'|null), seatCar, masked, pose, hidden }]
                   p.x/p.z follow the car while seated. The active member's p is Heist.player, its car Heist.car.
   HCrew.cur() / member(id) / curId
   HCrew.switchTo(id, { instant, quick, force, onDone })  -> true when the switch started; false (+ a toast) when not allowed.
       instant: no transition. quick: the short zoom-punch even when far. force: ignore lock/allow/wanted/canSwitch
       (and cut a running transition short). onDone(): the camera is back on the new member.
       Far (>= 40 m): the sky cam, ~2.8-3.3 s; meanwhile Heist.state = 'switch' (street simulation frozen, input ignored,
       Heist.camOverride = ours). Near (< 40 m / same car): a 0.5 s zoom-punch (also state 'switch').
       In an interior (Heist.state 'interior'): a 0.4 s flash cut; the interior owns the camera, so the story should
       hand control over in onSwitch (e.g. HCrewVault.setActive(to)). Leave the interior first for a sky cam.
   HCrew.allow(ids|null)  HCrew.lock(reason|null)   (reason: an I18N key or plain text; true = the default text)
   HCrew.seat(id, car, seat) (the active member always takes the wheel)  HCrew.unseat(id, x?, z?, h?) (no x: by the door)
   HCrew.setMasked(id, bool)  HCrew.teleport(id, x, z, h) (a seated driver moves with the car; a passenger is unseated)
   HCrew.setPose(id, pose, k?) (idle pose of an inactive member on foot; also applied to the active one while the
       street is not in 'play', e.g. a staged shot)
   HCrew.onSwitch = (from, to) => {}   when control changes hands (mid-transition)
   HCrew.canSwitch = (to) => true | 'reason'
   HCrew.cashBonus() -> 1.25 while Yoav is active, else 1.   HCrew.radarRange() -> 480 with Yoav, else 320 (metres)
   HCrew.stop()
   Extras: HCrew.show(id, on) (hide a member: no rig, no collisions, not selectable); HCrew.walkTo(id, x, z,
   { run, face, onArrive }) (an inactive member walks/runs there in a straight line); HCrew.blips() (radar dots for the
   other members: concat into HCrewStory.blips()); HCrew.busy() (a transition is running); HCrew.focus { on, charge 0..1 }
   + setFocus(on); HCrew.openWheel('hold'|'sticky') / closeWheel(confirm); HCrew.SFX_NEW = false plays only the stock
   whoosh/impact instead of switchUp/switchDown/slowIn/slowOut. */
(function () {
  if (typeof I18N === 'undefined') return;
  const LRI = '⁦', PDI = '⁩'; // keeps "+25%" in one piece inside Hebrew text
  Object.assign(I18N.he, {
    cr_title: 'הצוות',
    cr_n_yoav: 'יואב ברסי', cr_n_hadar: 'הדר בן עמי', cr_n_ido: 'עידו הידנה',
    cr_s_yoav: 'יואב', cr_s_hadar: 'הדר', cr_s_ido: 'עידו',
    cr_r_yoav: 'המוח', cr_r_hadar: 'השרירים', cr_r_ido: 'הנהג',
    cr_a_yoav: 'עין לכסף: עוד 25% מכל שקית, ורואה כסף מרחוק ברדאר',
    cr_a_hadar: 'רץ מהר יותר ב־18%, וסופג פחות מכות ברגל',
    cr_a_ido: 'פוקוס (X): מאט את הזמן כשהוא נוהג',
    cr_a_ido_t: 'פוקוס: מאט את הזמן כשהוא נוהג',
    cr_t_yoav: 'כסף ' + LRI + '+25%' + PDI, cr_t_hadar: 'ספרינט ' + LRI + '+18%' + PDI, cr_t_ido: 'פוקוס',
    cr_now: 'עכשיו', cr_you: 'אתה משחק בו עכשיו',
    cr_st_drive: 'נוהג', cr_st_car: 'ברכב', cr_st_ride: 'נוסע', cr_st_foot: 'ברגל',
    cr_loc_here: 'ממש לידך', cr_loc_downtown: 'במרכז העיר', cr_loc_city: 'בעיר', cr_loc_beach: 'בחוף', cr_loc_bridge: 'על הגשר', cr_loc_island: 'באי',
    cr_m: '{n} מ׳', cr_km: '{n} ק״מ',
    cr_r_wanted: 'אי אפשר להחליף כשהמשטרה על הזנב!', cr_r_locked: 'ההחלפה נעולה כרגע', cr_r_unavail: 'לא זמין כרגע',
    cr_r_riding: 'נוסע עם {name}', cr_r_same: 'אתם באותו רכב',
    cr_hint_keys: 'שחרר Tab כדי להחליף · Esc לביטול', cr_hint_click: 'לחץ על דמות כדי להחליף · Esc לביטול', cr_hint_touch: 'גע בדמות כדי להחליף',
    cr_focus: 'פוקוס', cr_focusIdo: 'פוקוס זה הקטע של עידו', cr_focusCar: 'פוקוס עובד רק בנהיגה', cr_focusEmpty: 'הפוקוס עוד נטען…',
  });
  Object.assign(I18N.en, {
    cr_title: 'THE CREW',
    cr_n_yoav: 'Yoav Barsi', cr_n_hadar: 'Hadar Ben Ami', cr_n_ido: 'Ido Hayedna',
    cr_s_yoav: 'Yoav', cr_s_hadar: 'Hadar', cr_s_ido: 'Ido',
    cr_r_yoav: 'The Brain', cr_r_hadar: 'The Muscle', cr_r_ido: 'The Driver',
    cr_a_yoav: 'Eye for cash: +25% from every bag, spots cash from afar on the radar',
    cr_a_hadar: 'Sprints 18% faster and takes less damage on foot',
    cr_a_ido: 'Focus (X): slows time while he drives',
    cr_a_ido_t: 'Focus: slows time while he drives',
    cr_t_yoav: '+25% cash', cr_t_hadar: 'Sprint +18%', cr_t_ido: 'Focus',
    cr_now: 'NOW', cr_you: "You're playing him now",
    cr_st_drive: 'Driving', cr_st_car: 'In the car', cr_st_ride: 'Riding', cr_st_foot: 'On foot',
    cr_loc_here: 'right here', cr_loc_downtown: 'downtown', cr_loc_city: 'across town', cr_loc_beach: 'at the beach', cr_loc_bridge: 'on the causeway', cr_loc_island: 'on Key Island',
    cr_m: '{n} m', cr_km: '{n} km',
    cr_r_wanted: "Can't switch with the cops on your tail!", cr_r_locked: 'Switching is locked right now', cr_r_unavail: 'Unavailable right now',
    cr_r_riding: 'Riding with {name}', cr_r_same: "You're in the same car",
    cr_hint_keys: 'Release Tab to switch · Esc to cancel', cr_hint_click: 'Click a character to switch · Esc to cancel', cr_hint_touch: 'Tap a character to switch',
    cr_focus: 'FOCUS', cr_focusIdo: "Focus is Ido's thing", cr_focusCar: 'Focus only works while driving', cr_focusEmpty: 'Focus is recharging…',
  });
})();

const HCrew = {
  active: false, H: null, members: [], curId: null,
  onSwitch: null, canSwitch: null,
  IDS: ['yoav', 'hadar', 'ido'],
  ACCENT: { yoav: '#ffd23f', hadar: '#5cf2a8', ido: '#4da3ff' },
  FACE: { yoav: 0, hadar: 1, ido: 2 },
  SEED: { yoav: 7, hadar: 12, ido: 26 },  // civilian stand-ins when HModels has no crew kinds
  NEAR: 40,                                // closer than this: the short zoom-punch instead of the sky cam
  SFX_NEW: true,
  focus: { on: false, charge: 1, drain: 6, recharge: 25, k: 0 },
  wheel: { open: false, mode: null, sel: null, vx: 0, vy: 0, k: 0 },
  _tr: null, _allowed: null, _lock: null, _ts: null, _dsOwn: null, _filter: '', _stash: null, $: null,
  COOL: [0.84, 0.97, 1.16], WARM: [1.16, 0.97, 0.76],
  SLOT_A: [205, 270, 335], // wheel portraits: screen angles (degrees, y down) of the left / top / right slots

  /* ================================================================ setup / teardown */
  setup(H, opts) {
    opts = opts || {};
    if (this.active) this._teardown();
    this.H = H; this.active = true;
    this._allowed = null; this._lock = null; this._tr = null; this._ts = null; this._dsOwn = null; this._filter = '';
    Object.assign(this.focus, { on: false, charge: 1, k: 0 });
    Object.assign(this.wheel, { open: false, mode: null, sel: null, vx: 0, vy: 0, k: 0 });
    this._scratch();
    this._drive = window.HModels && HModels.CREW ? 'drive' : 'sit'; // older HModels have no 'drive' pose (a standing rig would poke through the roof)
    const spec = opts.members || {};
    this.members = this.IDS.filter(id => spec[id]).map(id => this._makeMember(id, spec[id]));
    // cars: everyone's own car first, then the seats (a seat may point at another member's car)
    const keep = new Set();
    for (const m of this.members) { const c = spec[m.id].car; if (c && typeof c === 'object') { m._own = this._carFrom(c); keep.add(m._own); } }
    for (const m of this.members) {
      const s = spec[m.id], ref = typeof s.car === 'string' ? this.member(s.car) : null;
      const car = ref ? ref._own || ref.car : m._own;
      if (m._own) m.car = m._own;
      if (s.seat && car) this._seatM(m, car, s.seat, true);
    }
    for (const v of this._prevMade || []) if (!keep.has(v)) { // cars the previous cast had and this one doesn't use
      if (H.car === v) { H.car = null; HVehicle.player = null; }
      if (H.parked) H.parked = H.parked.filter(o => o !== v);
      HVehicle.remove(v);
    }
    this._prevMade = null;
    // the active member takes over Heist.player / Heist.car
    const A = this.member(opts.active) || this.members[0];
    const old = H.player, oldCar = H.car;
    if (old && !this.members.some(m => m.p === old)) this._dropRig(old.rig); // e.g. the placeholder hero
    if (oldCar && !this._isCrewCar(oldCar)) { H.car = null; HVehicle.player = null; H.parkOld(oldCar); }
    this.curId = null;
    if (A) this._takeControl(A, true);
    for (const m of this.members) this._refresh(m);
    if (A) this._snapCam(A);
    H.mods = H.mods || [];
    this._mod = { preUpdate: dt => this.preUpdate(dt), update: dt => this.update(dt) };
    H.mods.push(this._mod);
    this._camFn = (dt, c) => this._camApply(c);
    this._bind();
    this._buildUI();
    return this;
  },
  stop() {
    if (!this.active && !this.members.length && !this.$) return;
    this._teardown();
    this.active = false; this.H = null; this.members = []; this.curId = null; this.onSwitch = null; this.canSwitch = null; this._prevMade = null;
  },
  _teardown() {
    const H = this.H;
    if (this._stash) this._unstash();
    if (H) {
      if (this._tr) { const T = this._tr; this._tr = null; if (H.state === 'switch') H.state = T.prev && T.prev !== 'switch' ? T.prev : 'play'; }
      if (this._ts !== null && H.timeScale === this._ts) H.timeScale = 1;
      if (this._dsOwn !== null && H.desat === this._dsOwn) { H.desat = 0; H.desatTint = [1, 1, 1]; }
      if (H.canvas) { H.canvas.style.filter = ''; H.canvas.style.transform = ''; }
      if (H.camOverride === this._camFn) H.camOverride = null;
      if (H.mods) H.mods = H.mods.filter(m => m !== this._mod);
      if (HHud.el) HHud.el.classList.remove('cr-sky');
      for (const m of this.members) { for (const k in m.rigs) this._dropRig(m.rigs[k]); m.rigs = {}; }
      this._prevMade = H.active && H.scene ? this._made : null; // a re-setup in the same session removes or reuses them
    }
    this._tr = null; this._ts = null; this._dsOwn = null; this._filter = '';
    this.focus.on = false; this.wheel.open = false; this.wheel.mode = null;
    this._unbind();
    if (this.$ && this.$.root) this.$.root.remove();
    this.$ = null; this._made = [];
  },
  _scratch() {
    const T = this.H.T;
    this._m4 = new T.Matrix4(); this._tg = new T.Vector3(); this._up = new T.Vector3();
    this._cars = []; this._ev = []; this._made = [];
  },

  /* ================================================================ members + rigs */
  _makeMember(id, s) {
    const m = {
      id, accent: this.ACCENT[id], face: this.FACE[id], masked: !!s.masked, pose: s.pose || 'idle', poseK: 1,
      seat: null, seatCar: null, car: null, hidden: false, rigs: {}, walk: null, ph: this.FACE[id] * 3.7,
      name: () => t('cr_n_' + id), short: () => t('cr_s_' + id), role: () => t('cr_r_' + id),
      ability: () => t(id === 'ido' && Input.touchMode ? 'cr_a_ido_t' : 'cr_a_' + id),
    };
    const rig = this._rig(m, m.masked);
    let x = +s.x || 0, z = +s.z || 0;
    if (!s.seat) { const r = HX.resolveCircle(x, z, 0.4); x = r.x; z = r.z; }
    m.p = { rig, x, z, y: 0, h: +s.h || 0, vx: 0, vz: 0, vy: 0, anim: 'idle', at: 0, inCar: null, knockT: 0, enterT: 0, hp: 100, crew: id };
    return m;
  },
  _rig(m, masked) {
    const key = masked ? 'masked' : 'plain'; if (m.rigs[key]) return m.rigs[key];
    const H = this.H, kinds = window.HModels && HModels.CREW;
    let rig = null;
    if (kinds && kinds.indexOf(m.id) >= 0) rig = H.makePerson(m.id, { masked: !!masked, seed: this.SEED[m.id] });
    if (!rig || rig.kind !== m.id) { // no crew kinds in this HModels: a fixed civilian per member (and per outfit)
      if (rig) this._dropRig(rig);
      rig = H.makePerson('civ', { seed: this.SEED[m.id] + (masked ? 40 : 0) }); rig.crewFallback = true;
    }
    rig.group.name = 'crew-' + m.id + (masked ? '-masked' : '');
    m.rigs[key] = rig;
    return rig;
  },
  _dropRig(rig) {
    if (!rig) return;
    if (rig.group && rig.group.parent) rig.group.parent.remove(rig.group);
    if (rig.mesh && rig.mesh.skeleton && !rig._skDisposed) { rig._skDisposed = true; rig.mesh.skeleton.dispose(); }
  },
  _carFrom(c) {
    if (c.rig && c.inp) return c;
    const H = this.H, kind = c.kind || 'lux';
    const v = H.makeCar(kind, +c.x || 0, +c.z || 0, +c.h || 0, { color: c.color !== undefined ? c.color : kind === 'lux' ? 0x15161a : undefined });
    v.inp.handbrake = true; if (v.rig.setLights) v.rig.setLights(H.tod < 1.45);
    this._made.push(v);
    return v;
  },
  _isCrewCar(v) { for (const m of this.members) if (m.car === v || m.seatCar === v || m.p.inCar === v) return true; return false; },

  cur() { return this.curId ? this.member(this.curId) : null; },
  member(id) { for (const m of this.members) if (m.id === id) return m; return null; },
  busy() { return !!this._tr; },
  cashBonus() { return this.active && this.curId === 'yoav' ? 1.25 : 1; },
  radarRange() { return this.active && this.curId === 'yoav' ? 480 : 320; },
  allow(ids) { this._allowed = ids ? new Set(ids) : null; this._statusT = 0; },
  lock(reason) { this._lock = reason ? reason : null; if (reason && this.wheel.open) this.closeWheel(false); this._statusT = 0; },
  show(id, on) {
    const m = this.member(id); if (!m) return;
    m.hidden = !on; m.p.rig.group.visible = !!on; if (!on) m.walk = null;
    if (on) this._refresh(m);
    this._statusT = 0;
  },
  setPose(id, pose, k) { const m = this.member(id); if (!m) return; m.pose = pose || 'idle'; m.poseK = k === undefined ? 1 : k; m._poseSet = true; },
  blips() {
    const out = [];
    if (!this.active) return out;
    for (const m of this.members) { if (m.id === this.curId || m.hidden) continue; const q = this._pos(m); out.push({ x: q.x, z: q.z, col: m.accent, edge: true }); }
    return out;
  },
  walkTo(id, x, z, o) {
    const m = this.member(id); if (!m || m.id === this.curId) return false;
    if (m.seat) this.unseat(id);
    o = o || {}; m.walk = { x, z, run: !!o.run, face: o.face, onArrive: o.onArrive || null, t: 0 };
    return true;
  },
  setMasked(id, on) {
    const m = this.member(id); if (!m || m.masked === !!on) return;
    const H = this.H, old = m.p.rig, nu = this._rig(m, !!on);
    (old.group.parent || H.scene).add(nu.group);
    nu.group.position.copy(old.group.position); nu.group.rotation.copy(old.group.rotation); nu.group.visible = old.group.visible;
    if (old.bag && nu.bag) nu.bag.visible = old.bag.visible;
    if (old.group.parent) old.group.parent.remove(old.group);
    m.p.rig = nu; m.masked = !!on;
    nu.setPose(old.pose && old.pose !== 'hidden' ? old.pose : 'idle', H.time, 1);
    if (old.pose === 'hidden') nu.setPose('hidden', 0, 0);
    if (m.seat) this._seatRig(m);
  },

  /* ---------------- seats ---------------- */
  SEATS: { driver: [0.36, 0.3, -0.1], passenger: [-0.36, 0.3, -0.1] },
  _seatPos(car, seat) {
    const S = car.rig.seats, arr = s => Array.isArray(s) ? s : [s.x, s.y, s.z];
    if (S && S[seat]) return arr(S[seat]);
    // no such seat on this model: derive the rear row from the front one
    const front = seat === 'passenger' || seat === 'rearR' ? 'passenger' : 'driver';
    const b = S && S[front] ? arr(S[front]) : this.SEATS[front];
    return seat === 'rearL' || seat === 'rearR' ? [b[0] * 0.95, b[1], b[2] - 0.9] : b;
  },
  _seatRig(m) {
    const car = m.seatCar, rig = m.p.rig, par = car.rig.body || car.rig.group;
    if (rig.group.parent !== par) par.add(rig.group);
    const s = this._seatPos(car, m.seat);
    rig.group.position.set(s[0], s[1] - (rig.seatHeight || 0.44), s[2]); rig.group.rotation.set(0, 0, 0);
    if (rig.shadow) rig.shadow.visible = false;
  },
  seat(id, car, seat) { const m = this.member(id); if (!this.active || !m || !car) return false; return this._seatM(m, car, seat || 'passenger', false); },
  _seatM(m, car, seat, init) {
    const H = this.H, active = m.id === this.curId, p = m.p;
    if (active && seat !== 'driver') seat = 'driver'; // the player is always the one at the wheel
    for (const o of this.members) if (o !== m && o.seatCar === car && o.seat === seat) { if (o.id === this.curId) return false; this.unseat(o.id); }
    if (m.seat && (m.seatCar !== car || m.seat !== seat)) { m.seat = null; m.seatCar = null; }
    m.seat = seat; m.seatCar = car; m.walk = null; p.knockT = 0; p.vx = p.vz = p.vy = 0; p.y = 0;
    if (seat === 'driver') { m.car = car; p.inCar = car; } else p.inCar = null;
    const pi = H.parked ? H.parked.indexOf(car) : -1; if (pi >= 0) H.parked.splice(pi, 1); // crew cars are never "parked cars"
    if (active) { H.setPlayerCar(car); car.inp.handbrake = false; H.cam.yaw = car.h; HHud.prompt(); }
    else if (seat === 'driver') { car.inp.throttle = 0; car.inp.handbrake = true; }
    if (car.rig.setLights) car.rig.setLights(H.tod < 1.45);
    p.x = car.x; p.z = car.z; p.h = car.h;
    this._seatRig(m);
    p.rig.setPose(seat === 'driver' ? this._drive : 'sit', H.time + m.ph, 1);
    if (m.hidden) p.rig.group.visible = false;
    if (!init) this._statusT = 0;
    return true;
  },
  _doorSpot(car, seat) {
    const side = seat === 'passenger' || seat === 'rearR' ? -1 : 1, rear = seat === 'rearL' || seat === 'rearR';
    const d = car.rig.door || { x: 1.4, z: 0.3 }, c = Math.cos(car.h), s = Math.sin(car.h);
    const at = (sd) => { const dx = d.x * sd, dz = d.z - (rear ? 0.95 : 0); const x = car.x + dx * c + dz * s, z = car.z - dx * s + dz * c; const r = HX.resolveCircle(x, z, 0.4); return Math.hypot(r.x - x, r.z - z) < 0.05 ? { x: r.x, z: r.z, h: car.h + sd * Math.PI / 2 } : null; };
    return at(side) || at(-side) || { x: car.x - Math.sin(car.h) * (car.half + 1.2), z: car.z - Math.cos(car.h) * (car.half + 1.2), h: car.h + Math.PI };
  },
  unseat(id, x, z, h) {
    const m = this.member(id), H = this.H; if (!this.active || !m || !m.seat) return false;
    const car = m.seatCar, active = m.id === this.curId, p = m.p;
    const spot = x === undefined || x === null ? this._doorSpot(car, m.seat) : { x, z, h: car.h };
    if (h !== undefined && h !== null) spot.h = h;
    if (m.seat === 'driver') { car.inp.throttle = 0; car.inp.steer = 0; car.inp.handbrake = true; }
    m.seat = null; m.seatCar = null; p.inCar = null;
    const r = HX.resolveCircle(spot.x, spot.z, 0.38);
    p.x = r.x; p.z = r.z; p.y = 0; p.vx = p.vz = p.vy = 0; p.h = spot.h; p.knockT = 0;
    H.scene.add(p.rig.group); if (p.rig.shadow) p.rig.shadow.visible = true;
    p.rig.setPose('idle', H.time, 1);
    if (m.hidden) p.rig.group.visible = false;
    if (active) { H.syncPlayer(); HHud.prompt(); } else this._placeFoot(m);
    this._statusT = 0;
    return true;
  },
  teleport(id, x, z, h) {
    const m = this.member(id), H = this.H; if (!this.active || !m) return false;
    m.walk = null;
    if (m.seat && m.seat !== 'driver') { this.unseat(id, x, z, h); return true; }
    const v = m.seat === 'driver' ? m.seatCar : m.p.inCar;
    if (v) { v.x = x; v.z = z; if (h !== undefined) v.h = h; v.vx = v.vz = v.w = 0; v.vF = v.vR = 0; HVehicle.sync(v, 0); m.p.x = x; m.p.z = z; }
    else {
      const r = HX.resolveCircle(x, z, 0.38), p = m.p; p.x = r.x; p.z = r.z; p.y = 0; p.vx = p.vz = p.vy = 0; p.knockT = 0; if (h !== undefined) p.h = h;
      if (m.id === this.curId) H.syncPlayer(); else this._placeFoot(m);
    }
    if (m.id === this.curId) this._snapCam(m);
    return true;
  },
  _placeFoot(m) {
    const p = m.p, g = p.rig.group, H = this.H;
    if (g.parent !== H.scene) H.scene.add(g);
    g.position.set(p.x, p.y + HX.groundY(p.x, p.z), p.z); g.rotation.set(0, p.h, 0);
  },
  _refresh(m) { // put the rig where the member's state says
    if (m.hidden) { m.p.rig.group.visible = false; return; }
    m.p.rig.group.visible = true;
    if (m.seat && m.seatCar) this._seatRig(m); else this._placeFoot(m);
  },

  /* ---------------- taking control ---------------- */
  // m becomes Heist.player (+ Heist.car). A passenger slides over to the wheel (the player always drives).
  _takeControl(m, init) {
    const H = this.H, p = m.p;
    if (m.seat && m.seat !== 'driver') {
      const car = m.seatCar; let drv = null;
      for (const o of this.members) if (o !== m && o.seatCar === car && o.seat === 'driver') drv = o;
      if (drv) { drv.seat = m.seat; drv.p.inCar = null; this._seatRig(drv); }
      m.seat = 'driver'; this._seatRig(m);
    }
    if (m.seat === 'driver') { p.inCar = m.seatCar; m.car = m.seatCar; }
    this.curId = m.id;
    H.player = p;
    H.setPlayerCar(m.car || null);
    if (p.inCar) { const v = p.inCar; v.inp.handbrake = false; if (v.rig.setLights) v.rig.setLights(H.tod < 1.45); const pi = H.parked ? H.parked.indexOf(v) : -1; if (pi >= 0) H.parked.splice(pi, 1); }
    else { p.rig.group.visible = !m.hidden; if (!init) H.syncPlayer(); }
    m.walk = null;
    H.cam.yaw = p.inCar ? p.inCar.h : p.h; H.cam.pitch = p.inCar ? 0.2 : 0.22; H.cam.manualT = 0;
    if (H.aiCtx) H.aiCtx._fx = undefined; // the AI's speed estimate must not read the jump as running
    HHud.prompt();
    this._abT = 4.5; this._statusT = 0;
  },
  _release(m) { // m stops being the player: the rig stays in the world, a car brakes to a stop
    const H = this.H, p = m.p;
    m.car = H.car || m.car;
    if (p.inCar) { m.seat = 'driver'; m.seatCar = p.inCar; p.inCar.inp.throttle = 0; p.inCar.inp.steer = 0; }
    else { p.vx = p.vz = p.vy = 0; p.y = 0; p.anim = 'idle'; }
    if (this.focus.on) this.setFocus(false);
  },
  _swap(F, D) {
    if (F) this._release(F);
    this._takeControl(D, false);
    if (typeof this.onSwitch === 'function') { try { this.onSwitch(F ? F.id : null, D.id); } catch (e) { console.error(e); } }
  },

  /* ================================================================ switching */
  BUSY: '\u0000busy',
  _text(r) {
    if (typeof r !== 'string') return t('cr_r_locked');
    const known = (I18N[LANG] && I18N[LANG][r] !== undefined) || I18N.he[r] !== undefined;
    return known ? t(r) : r;
  },
  // why nobody can be switched to right now (null = fine; BUSY = silently not now)
  _globalBlock() {
    const H = this.H;
    if (!this.active || !H || !H.active) return this.BUSY;
    if (this._tr || H.paused || HHud.cutActive() || (window.HHack && HHack.active)) return this.BUSY;
    if (H.state !== 'play' && H.state !== 'interior') return this.BUSY;
    if (H.camOverride && H.camOverride !== this._camFn) return this.BUSY;
    if (this._lock) return this._text(this._lock);
    if (H.state === 'play' && HAI.wanted > 0) return t('cr_r_wanted');
    return null;
  },
  // why this member can't be picked (null = fine; the current member is never blocked)
  _why(m) {
    if (!m || m.hidden) return t('cr_r_unavail');
    if (m.id === this.curId) return null;
    if (this._allowed && !this._allowed.has(m.id)) return t('cr_r_unavail');
    if (m.seat && m.seat !== 'driver' && m.seatCar) {
      for (const o of this.members) if (o !== m && o.seatCar === m.seatCar && o.seat === 'driver') return o.id === this.curId ? t('cr_r_same') : t('cr_r_riding', { name: o.short() });
    }
    if (typeof this.canSwitch === 'function') {
      let r = true; try { r = this.canSwitch(m.id); } catch (e) { console.error(e); }
      if (r !== true && r !== undefined && r !== null) return this._text(r === false ? 'cr_r_unavail' : r);
    }
    return null;
  },
  _pickable(m) { return !!m && m.id !== this.curId && !this._why(m); },
  switchTo(id, o) {
    o = o || {};
    const H = this.H, D = this.member(id), F = this.cur();
    if (!this.active || !H || !D || D === F) return false;
    if (this._tr) { if (!o.force) return false; this._finish(); }
    if (this.wheel.open) this._hideWheel();
    if (!o.force) {
      const why = this._globalBlock() || this._why(D);
      if (why) { if (why !== this.BUSY) this._deny(why); return false; }
    }
    if (D.hidden) this.show(D.id, true);
    const st = H.state, done = o.onDone;
    if (o.instant || !F || (st !== 'play' && st !== 'interior') || HHud.cutActive()) {
      this._swap(F, D); this._snapCam(D); if (done) done(); return true;
    }
    if (st === 'interior') { this._punchTr(F, D, done); return true; }
    if (o.quick || this._sameCar(F, D) || this._dist(F, D) < this.NEAR) this._nearTr(F, D, done); else this._skyTr(F, D, done);
    return true;
  },
  _pos(m) { const v = m.p.inCar || (m.seat ? m.seatCar : null); return v ? { x: v.x, z: v.z } : { x: m.p.x, z: m.p.z }; },
  _dist(a, b) { const p = this._pos(a), q = this._pos(b); return Math.hypot(p.x - q.x, p.z - q.z); },
  _sameCar(a, b) { const x = a.p.inCar || a.seatCar, y = b.p.inCar || b.seatCar; return !!x && x === y; },
  _deny(text) {
    const now = performance.now(); if (this._denyTxt === text && now - this._denyT < 1200) return;
    this._denyTxt = text; this._denyT = now;
    HHud.toast(text, '#ff9a8a'); if (window.HAudio) HAudio.sfx('beep', { vol: 0.5 });
  },
  _snd(name, fb, o, fbVol) { // a dedicated sound (another module may provide it) with a stock fallback
    if (!window.HAudio || !HAudio.sfx) return;
    const listed = HAudio.sfxNames && HAudio.sfxNames.indexOf(name) >= 0;
    if (this.SFX_NEW) HAudio.sfx(name, o);
    if (fb && (!listed || !this.SFX_NEW)) HAudio.sfx(fb, Object.assign({}, o, { vol: ((o && o.vol) || 1) * (fbVol || 1) }));
  },

  /* ---------------- camera poses ---------------- */
  // what the follow camera will show for member m (mirrors Heist.updateCamera)
  _followPose(m) {
    const H = this.H, T = H.T, p = m.p, v = p.inCar || (m.seat ? m.seatCar : null);
    const yaw = v ? v.h : p.h, pitch = v ? 0.2 : 0.22;
    let tx, ty, tz, dist, fov = 60, ly;
    if (v) { const spd = Math.abs(v.vF || 0); tx = v.x + Math.sin(v.h) * 1.5; ty = 1.25; tz = v.z + Math.cos(v.h) * 1.5; dist = 7.2 + spd * 0.045; fov = 62 + Math.min(18, spd * 0.32); ly = ty + 0.55; }
    else { tx = p.x; ty = 1.55 + (p.y || 0); tz = p.z; dist = 4.4; ly = ty + 0.1; }
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let cx = tx - Math.sin(yaw) * cp * dist, cz = tz - Math.cos(yaw) * cp * dist, cy = ty + sp * dist + (v ? 0.9 : 0.25);
    const hit = HX.raycast(tx, tz, cx, cz, cy - 0.5);
    if (hit < 1) { const k = Math.max(0.15, hit - 0.08); cx = tx + (cx - tx) * k; cz = tz + (cz - tz) * k; cy = HX.lerp(ty + 0.4, cy, k); }
    cy = Math.max(0.4, cy);
    const pos = new T.Vector3(cx, cy, cz), q = new T.Quaternion();
    this._m4.lookAt(pos, this._tg.set(tx, ly, tz), this._up.set(0, 1, 0)); q.setFromRotationMatrix(this._m4);
    return { p: pos, q, fov, yaw, pitch };
  },
  // straight down over (x, z) from h metres, the top of the screen pointing along (ux, uz)
  _topPose(x, z, h, ux, uz, fov) {
    const T = this.H.T, gy = HX.groundY(x, z), pos = new T.Vector3(x, gy + h, z), q = new T.Quaternion();
    this._m4.lookAt(pos, this._tg.set(x, gy, z), this._up.set(ux, 0, uz)); q.setFromRotationMatrix(this._m4);
    return { p: pos, q, fov };
  },
  _camPose() { const c = this.H.camera; return { p: c.position.clone(), q: c.quaternion.clone(), fov: c.fov }; },
  _snapCam(m) {
    const H = this.H, f = this._followPose(m), c = H.camera;
    Object.assign(H.cam, { x: f.p.x, y: f.p.y, z: f.p.z, yaw: f.yaw, pitch: f.pitch, fov: f.fov, manualT: 0 });
    c.position.copy(f.p); c.quaternion.copy(f.q); c.fov = f.fov; c.updateProjectionMatrix();
  },

  /* ---------------- transitions ---------------- */
  // a transition = camera segments (each eases from the previous pose to `to`) + timed events
  _begin(kind, F, D, segs, evs, onDone) {
    const H = this.H, T = H.T;
    let t0 = 0, prev = segs.length ? this._camPose() : null, ds = 0;
    for (const s of segs) { s.t0 = t0; t0 += s.d; s.t1 = t0; if (!s.from) s.from = prev; prev = s.to; s.ds0 = ds; if (s.ds !== undefined) ds = s.ds; s.ds = ds; }
    let last = 0; for (const e of evs) last = Math.max(last, e.at);
    evs.sort((a, b) => a.at - b.at);
    const tr = this._tr = { kind, F, D, segs, evs, ei: 0, t: 0, dur: Math.max(t0, last + 0.01), onDone, swapped: false, shake: 0, ds: 0,
      cam: segs.length > 0, cp: new T.Vector3(), cq: new T.Quaternion(), cf: 60, prev: H.state };
    if (tr.cam) { H.state = 'switch'; H.camOverride = this._camFn; tr.cp.copy(H.camera.position); tr.cq.copy(H.camera.quaternion); tr.cf = H.camera.fov; }
    HHud.prompt();
    if (this.focus.on) this.setFocus(false);
    this._trStep(0);
  },
  _skyTr(F, D, onDone) {
    const H = this.H, S = this._pos(F), E = this._pos(D), fD = this._followPose(D);
    const uS = [Math.sin(H.cam.yaw), Math.cos(H.cam.yaw)], uD = [Math.sin(fD.yaw), Math.cos(fD.yaw)];
    const top = (q, h, u) => this._topPose(q.x, q.z, h, u[0], u[1], 52);
    const dist = Math.hypot(E.x - S.x, E.z - S.z), travel = HX.clamp(0.55 + dist / 1400, 0.6, 1.15);
    const oc = u => 1 - Math.pow(1 - u, 3), ic = u => u * u * u, io = u => 0.5 - 0.5 * Math.cos(Math.PI * u);
    const up = (k) => () => { this._tr.shake = 0.35; this._snd('switchUp', 'whoosh', { intensity: 0.45 + 0.2 * k, duration: 0.42, vol: 0.9 }, 0.8); };
    const thump = (k) => () => { this._tr.shake = 0.6 + 0.3 * k; this._flash(0.1 + 0.06 * k, '#fff'); this._snd('switchDown', 'impact', { intensity: 0.45 + 0.2 * k, vol: 0.85 }, 0.55); };
    const segs = [
      { d: 0.30, to: top(S, 10, uS), e: oc, ds: 0.28 }, { d: 0.08 },        // lift: three snaps up
      { d: 0.30, to: top(S, 45, uS), e: oc, ds: 0.5 }, { d: 0.07 },
      { d: 0.32, to: top(S, 180, uS), e: oc, ds: 0.66 }, { d: 0.05 },
      { d: travel, to: top(E, 180, uD), e: io },                             // glide over the city
      { d: 0.24, to: top(E, 45, uD), e: ic }, { d: 0.1 },                    // drop: three thumps down
      { d: 0.22, to: top(E, 10, uD), e: ic }, { d: 0.1 },
      { d: 0.42, to: fD, e: oc, ds: 0 },
    ];
    for (let k = 0; k < segs.length; k++) if (!segs[k].to) segs[k].to = segs[k - 1].to;
    const st = []; let at = 0; for (const s of segs) { st.push(at); at += s.d; }
    const evs = [
      { at: st[0], fn: up(0) }, { at: st[2], fn: up(1) }, { at: st[4], fn: up(2) },
      { at: st[6], fn: () => { this._card(D, true); this._snd('whoosh', null, { duration: travel + 0.3, intensity: 0.3, vol: 0.55 }); } },
      { at: st[7], fn: () => this._doSwap() },
      { at: st[8], fn: thump(0) }, { at: st[10], fn: thump(1) },
      { at: st[11] + 0.1, fn: () => this._card(D, false) },
      { at: at, fn: () => { this._tr.shake = 0.25; if (window.HAudio) HAudio.sfx('land', { intensity: 0.5, vol: 0.6 }); } },
    ];
    if (HHud.el) HHud.el.classList.add('cr-sky');
    if (this.$) this.$.sky.style.setProperty('--ac', D.accent);
    this._begin('sky', F, D, segs, evs, onDone);
  },
  _nearTr(F, D, onDone) { // zoom-punch: push in on the current member, flash, push out from the new one
    const T = this.H.T, c = this._camPose(), fD = this._followPose(D), mid = 0.22, d = 0.5, push = 2.2, zoom = 20;
    const fwd = q => new T.Vector3(0, 0, -1).applyQuaternion(q);
    const inA = { p: c.p.clone().addScaledVector(fwd(c.q), push), q: c.q, fov: c.fov - zoom };
    const inB = { p: fD.p.clone().addScaledVector(fwd(fD.q), push), q: fD.q, fov: fD.fov - zoom };
    const segs = [
      { d: mid, to: inA, e: u => u * u * u, ds: 0.42 },
      { d: d - mid, from: inB, to: fD, e: u => 1 - Math.pow(1 - u, 3), ds: 0 },
    ];
    const evs = [
      { at: 0, fn: () => this._snd('switchUp', 'whoosh', { intensity: 0.6, duration: 0.35 }, 0.9) },
      { at: mid, fn: () => { this._doSwap(); this._flash(0.55, '#fff'); if (this._tr) this._tr.shake = 0.3; } },
    ];
    this._begin('near', F, D, segs, evs, onDone);
  },
  _punchTr(F, D, onDone) { // interiors own the camera: a flash cut with a CSS zoom punch on the canvas
    const evs = [
      { at: 0, fn: () => this._snd('switchUp', 'whoosh', { intensity: 0.55, duration: 0.3 }, 0.9) },
      { at: 0.13, fn: () => { this._doSwap(); this._flash(0.5, '#fff'); } },
      { at: 0.4, fn: () => {} },
    ];
    this._begin('punch', F, D, [], evs, onDone);
  },
  _doSwap() { const T = this._tr; if (!T || T.swapped) return; T.swapped = true; this._swap(T.F, T.D); },
  _trStep(rdt) {
    const T = this._tr, H = this.H; if (!T) return;
    // someone else took over (a cutscene, a fail, a quit): jump to the end
    if (T.cam && (H.state !== 'switch' || H.camOverride !== this._camFn)) { this._finish(); return; }
    T.t += rdt;
    while (T.ei < T.evs.length && T.t >= T.evs[T.ei].at) { const e = T.evs[T.ei++]; try { e.fn(); } catch (err) { console.error(err); } if (this._tr !== T) return; }
    T.shake = Math.max(0, T.shake - rdt * 2.4);
    if (T.cam) {
      let s = T.segs[T.segs.length - 1];
      for (const q of T.segs) if (T.t < q.t1) { s = q; break; }
      const u = HX.clamp((T.t - s.t0) / s.d, 0, 1), e = s.e ? s.e(u) : u;
      T.cp.lerpVectors(s.from.p, s.to.p, e); T.cq.copy(s.from.q).slerp(s.to.q, e);
      T.cf = HX.lerp(s.from.fov, s.to.fov, e);
      T.ds = HX.lerp(s.ds0, s.ds, u);
    } else {
      const u = HX.clamp(T.t / T.dur, 0, 1), k = Math.sin(Math.PI * u); T.ds = 0.4 * k;
      if (H.canvas) H.canvas.style.transform = k > 0.002 ? `scale(${(1 + 0.055 * k).toFixed(4)})` : '';
    }
    if (T.t >= T.dur) this._finish();
  },
  _camApply(c) {
    const T = this._tr, H = this.H; if (!T || !T.cam) return;
    const sh = T.shake * T.shake * (0.35 + T.cp.y * 0.004);
    c.position.set(T.cp.x + (Math.random() - 0.5) * sh, T.cp.y + (Math.random() - 0.5) * sh, T.cp.z + (Math.random() - 0.5) * sh);
    c.quaternion.copy(T.cq); c.fov = T.cf; c.updateProjectionMatrix();
    H.cam.x = T.cp.x; H.cam.y = T.cp.y; H.cam.z = T.cp.z;
  },
  _finish() {
    const T = this._tr, H = this.H; if (!T) return;
    this._tr = null;
    if (!T.swapped) { T.swapped = true; this._swap(T.F, T.D); }
    if (H.camOverride === this._camFn) H.camOverride = null;
    if (T.cam) { if (H.state === 'switch') H.state = T.prev && T.prev !== 'switch' ? T.prev : 'play'; this._snapCam(T.D); }
    if (H.canvas) H.canvas.style.transform = '';
    if (HHud.el) HHud.el.classList.remove('cr-sky');
    this._card(T.D, false);
    if (T.onDone) { try { T.onDone(); } catch (e) { console.error(e); } }
  },

  /* ================================================================ abilities */
  setFocus(on) {
    const H = this.H, A = this.cur(), F = this.focus;
    if (!this.active) return false;
    if (on) {
      if (F.on) return true;
      if (!A || A.id !== 'ido') { this._deny(t('cr_focusIdo')); return false; }
      if (!A.p.inCar || H.state !== 'play' || this._tr) { this._deny(t('cr_focusCar')); return false; }
      if (F.charge < 0.12) { this._deny(t('cr_focusEmpty')); return false; }
      F.on = true; this._snd('slowIn', 'whoosh', { intensity: 0.4, duration: 0.5, vol: 0.8 }, 0.7);
    } else {
      if (!F.on) return false;
      F.on = false; this._snd('slowOut', 'whoosh', { intensity: 0.3, duration: 0.4, vol: 0.6 }, 0.6);
    }
    return F.on;
  },
  toggleFocus() { return this.setFocus(!this.focus.on); },
  _abilities(dt, rdt) {
    const H = this.H, A = this.cur(), p = H.player, F = this.focus;
    if (F.on) { F.charge = Math.max(0, F.charge - rdt / F.drain); if (F.charge <= 0 || !A || A.id !== 'ido' || !p || !p.inCar || H.state !== 'play') this.setFocus(false); }
    else F.charge = Math.min(1, F.charge + rdt / F.recharge);
    if (!A || !p || p !== A.p || H.state !== 'play') return;
    if (A.id === 'hadar' && !p.inCar && !this._pin && this._px !== undefined) {
      // Hadar: sprints 18% faster (on top of the engine's run) and shrugs off a third of the hits on foot
      if (p.anim === 'run' && p.knockT <= 0) {
        const dx = p.x - this._px, dz = p.z - this._pz;
        if (dx * dx + dz * dz < 1) { const r = HX.resolveCircle(p.x + dx * 0.18, p.z + dz * 0.18, 0.38); p.x = r.x; p.z = r.z; H.syncPlayer(); }
      }
      if (p.hp < this._php) p.hp = Math.min(this._php, p.hp + (this._php - p.hp) * 0.35);
    }
  },

  /* ================================================================ frame */
  preUpdate(dt) {
    if (!this.active) return;
    const H = this.H;
    this._syncActive();
    this._input(H.realDt || dt);
    const p = H.player;
    if (p) { this._px = p.x; this._pz = p.z; this._php = p.hp; this._pin = !!p.inCar; }
  },
  update(dt) {
    if (!this.active) return;
    const H = this.H, rdt = H.realDt || dt;
    if (this._stash) this._unstash();
    this._syncActive();
    if (this._tr) this._trStep(rdt);
    this._abilities(dt, rdt);
    this._manage(dt);
    this._fx(rdt);
    this._hud(rdt);
  },
  // Heist.player is the truth for who is active; the active member's car is whatever the engine drives
  _syncActive() {
    const H = this.H, p = H.player;
    let A = this.cur();
    if (!A || A.p !== p) { A = null; for (const m of this.members) if (m.p === p) A = m; if (A) this.curId = A.id; }
    if (!A) return;
    A.car = H.car || null;
    const v = p.inCar;
    if (v) {
      if (A.seat !== 'driver' || A.seatCar !== v) {
        A.seat = 'driver'; A.seatCar = v;
        const pi = H.parked ? H.parked.indexOf(v) : -1; if (pi >= 0) H.parked.splice(pi, 1);
        // someone (inactive) was sitting at that wheel: they move over
        for (const o of this.members) if (o !== A && o.seatCar === v && o.seat === 'driver') {
          let free = null;
          for (const s of ['passenger', 'rearL', 'rearR']) { let used = false; for (const q of this.members) if (q.seatCar === v && q.seat === s) used = true; if (!used) { free = s; break; } }
          if (free) { o.seat = free; o.p.inCar = null; this._seatRig(o); } else this.unseat(o.id);
        }
      }
    } else if (A.seat) { A.seat = null; A.seatCar = null; }
  },

  /* ---------------- the cast + crew cars, every frame ---------------- */
  _manage(dt) {
    const H = this.H, st = H.state, A = this.cur(), play = st === 'play';
    if (st === 'interior') return; // the interior module owns the rigs it was given until the street is back
    const tm = H.time;
    for (const m of this.members) {
      const p = m.p, rig = p.rig;
      if (m.hidden) { if (rig.group.visible) rig.group.visible = false; continue; }
      if (m.seat && m.seatCar) {
        const car = m.seatCar;
        if (!car.rig.group.parent) { this.unseat(m.id, car.x + Math.cos(car.h) * 1.6, car.z - Math.sin(car.h) * 1.6, car.h); continue; } // the car left the world
        if (rig.group.parent !== (car.rig.body || car.rig.group)) this._seatRig(m);
        const drv = m.seat === 'driver';
        if (drv) { const s = HX.clamp((car.steerVis || 0) / ((car.spec && car.spec.steer) || 0.6), -1, 1); rig.steer = s; if (car.rig.setSteer) car.rig.setSteer(s); }
        rig.setPose(drv ? this._drive : 'sit', tm + m.ph, 1); // (also the active driver, whom Heist.enterCar hid)
        p.x = car.x; p.z = car.z;
        continue;
      }
      if (m.id === this.curId) { // the player on foot: the engine moves it
        if (rig.group.parent !== H.scene) { H.scene.add(rig.group); H.syncPlayer(); if (rig.shadow) rig.shadow.visible = true; } // just got out of a car
        if (play) m._poseSet = false; else if (st !== 'switch' && m._poseSet) rig.setPose(m.pose, tm + m.ph, m.poseK);
        continue;
      }
      if (rig.group.parent !== H.scene) { H.scene.add(rig.group); if (rig.shadow) rig.shadow.visible = true; }
      this._idle(m, dt, play, A);
    }
    if (play) { this._carsStep(dt, A); if (A) this._blockPlayer(A); }
  },
  _idle(m, dt, play, A) {
    const H = this.H, p = m.p, rig = p.rig;
    if (play && p.knockT > 0) {
      p.knockT -= dt; p.vx *= 0.9; p.vz *= 0.9; p.x += p.vx * dt; p.z += p.vz * dt;
      const r = HX.resolveCircle(p.x, p.z, 0.38); p.x = r.x; p.z = r.z;
      rig.setPose('fall', H.time, HX.clamp(1 - p.knockT / 1.4, 0, 1));
      if (p.knockT <= 0) { p.knockT = 0; p.vx = p.vz = 0; }
    } else if (play && m.walk) {
      const w = m.walk, dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz), sp = w.run ? 6.6 : 3.9;
      w.t += dt;
      if (d < 0.35 || w.t > 40) {
        m.walk = null; p.vx = p.vz = 0; if (w.face !== undefined) p.h = w.face;
        rig.setPose(m.pose, H.time + m.ph, m.poseK);
        if (w.onArrive) { try { w.onArrive(); } catch (e) { console.error(e); } }
      } else {
        const k = Math.min(1, d / 1.2), ox = p.x, oz = p.z;
        p.vx = HX.damp(p.vx, dx / d * sp * k, 10, dt); p.vz = HX.damp(p.vz, dz / d * sp * k, 10, dt);
        p.x += p.vx * dt; p.z += p.vz * dt;
        const r = HX.resolveCircle(p.x, p.z, 0.38); p.x = r.x; p.z = r.z;
        const spd = Math.hypot(p.x - ox, p.z - oz) / Math.max(dt, 1e-4);
        p.h = p.h + HX.wrapAngle(Math.atan2(p.vx, p.vz) - p.h) * Math.min(1, dt * 10);
        const run = spd > 5, carry = !run && rig.bag && rig.bag.visible && rig.kind === m.id;
        p.at += dt * spd / (run ? 7.6 : 4.2);
        rig.setPose(carry ? 'carry' : run ? 'run' : 'walk', p.at, HX.clamp(spd / (run ? 7.6 : 4.2), 0.3, 1));
      }
    } else {
      // standing around: breathing + looking around (the idle pose); turn to face the player when close
      if (A && play && m.pose === 'idle' && !A.p.inCar) {
        const dx = A.p.x - p.x, dz = A.p.z - p.z, d2 = dx * dx + dz * dz;
        if (d2 < 81 && d2 > 0.5) p.h = p.h + HX.wrapAngle(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 2.2);
      }
      rig.setPose(m.pose, H.time + m.ph, m.poseK);
    }
    if (play) this._pushFromCars(m);
    this._placeFoot(m);
  },
  _pushOne(m, v) {
    const p = m.p;
    if (!v || v === m.seatCar || !v.rig.group.parent || Math.abs(v.x - p.x) > 6 || Math.abs(v.z - p.z) > 6) return;
    for (const c of HVehicle.circles(v)) {
      const dx = p.x - c[0], dz = p.z - c[1], rr = v.radius + 0.35, d = Math.hypot(dx, dz);
      if (d >= rr || d < 1e-4) continue;
      const sp = HVehicle.speed(v);
      if (sp > 6.5 && p.knockT <= 0) { // run over: down they go
        p.knockT = 1.4; p.vx = v.vx / sp * Math.min(9, sp * 0.6); p.vz = v.vz / sp * Math.min(9, sp * 0.6); p.hp = Math.max(5, p.hp - Math.min(30, sp * 1.5));
        if (window.HAudio) HAudio.sfx('crash', { intensity: 0.4 });
      }
      p.x += dx / d * (rr - d); p.z += dz / d * (rr - d);
    }
  },
  _pushFromCars(m) {
    const H = this.H, p = m.p;
    for (const v of HAI.traffic) this._pushOne(m, v);
    for (const v of HAI.police) this._pushOne(m, v);
    for (const v of H.parked || []) this._pushOne(m, v);
    this._pushOne(m, H.car); if (H.player && H.player.inCar !== H.car) this._pushOne(m, H.player.inCar);
    for (const v of this._cars) if (v !== H.car) this._pushOne(m, v);
    const r = HX.resolveCircle(p.x, p.z, 0.38); p.x = r.x; p.z = r.z;
  },
  // cars of the inactive members are real cars: they brake to a stop, collide and get pushed (never Heist.parked)
  _carsStep(dt, A) {
    const H = this.H, list = this._cars, pc = H.player && H.player.inCar, ev = this._ev;
    list.length = 0; ev.length = 0;
    for (const m of this.members) { if (m.car && list.indexOf(m.car) < 0) list.push(m.car); if (m.seatCar && list.indexOf(m.seatCar) < 0) list.push(m.seatCar); }
    let ax = 0, az = 0; if (A) { const v = A.p.inCar; ax = v ? v.x : A.p.x; az = v ? v.z : A.p.z; }
    for (const v of list) {
      if (v === H.car || v === pc || v.ai || !v.rig.group.parent) continue;
      const pi = H.parked ? H.parked.indexOf(v) : -1;
      if (pi >= 0) { H.parked.splice(pi, 1); continue; } // the engine already stepped it this frame
      const vF = v.vF || 0, moving = Math.abs(vF) > 0.05 || Math.abs(v.vx) + Math.abs(v.vz) > 0.05;
      if (!moving && (Math.abs(v.x - ax) > 300 || Math.abs(v.z - az) > 300)) continue; // far away and at rest
      v.inp.steer = 0;
      if (Math.abs(vF) > 1) { v.inp.throttle = -Math.sign(vF); v.inp.handbrake = false; } else { v.inp.throttle = 0; v.inp.handbrake = true; }
      HVehicle.step(v, dt, ev);
      if (this._near(v, pc)) HVehicle.collidePair(pc, v, ev);
      if (H.car !== pc && this._near(v, H.car)) HVehicle.collidePair(H.car, v, ev);
      for (const o of HAI.traffic) if (this._near(v, o) && HVehicle.collidePair(v, o, ev) && o.ai) o.ai.stopT = 2.5;
      for (const o of HAI.police) if (this._near(v, o)) HVehicle.collidePair(v, o, ev);
      for (const o of H.parked || []) if (this._near(v, o)) HVehicle.collidePair(v, o, ev);
      for (const o of list) if (o.id > v.id && o !== pc && o !== H.car && this._near(v, o)) HVehicle.collidePair(v, o, ev);
      HVehicle.sync(v, dt);
    }
    if (pc && ev.length) HVehicle.sync(pc, 0); // the engine synced the player's car before we pushed it
    for (const e of ev) {
      if ((e.type === 'crash' || e.type === 'carhit') && Math.hypot(e.x - H.cam.x, e.z - H.cam.z) < 60) {
        HFX3.sparkBurst(e.x, 0.6, e.z, e.nx || 0, e.nz || 0, Math.min(20, 4 + e.impact * 1.4));
        if (window.HAudio) HAudio.sfx('crash', { intensity: HX.clamp(e.impact / 22, 0.15, 1) });
        if (pc && (e.a === pc || e.b === pc)) H.cam.shake = Math.min(1.2, H.cam.shake + e.impact * 0.05);
      }
    }
  },
  _near(v, o) { return !!o && o !== v && !!o.rig.group.parent && Math.abs(o.x - v.x) < 8 && Math.abs(o.z - v.z) < 8; },
  // the player on foot bumps into the others and their cars instead of walking through them
  _blockPlayer(A) {
    const H = this.H, p = A.p; if (p.inCar || H.player !== p) return;
    let moved = false;
    for (const m of this.members) {
      if (m === A || m.hidden || m.seat) continue;
      const dx = p.x - m.p.x, dz = p.z - m.p.z, d = Math.hypot(dx, dz), rr = 0.72;
      if (d < rr && d > 1e-4) { p.x += dx / d * (rr - d); p.z += dz / d * (rr - d); moved = true; }
    }
    for (const v of this._cars) {
      if (v === H.car || v.ai || !v.rig.group.parent || Math.abs(v.x - p.x) > 6 || Math.abs(v.z - p.z) > 6) continue;
      for (const c of HVehicle.circles(v)) {
        const dx = p.x - c[0], dz = p.z - c[1], rr = v.radius + 0.35, d = Math.hypot(dx, dz);
        if (d < rr && d > 1e-4) { p.x += dx / d * (rr - d); p.z += dz / d * (rr - d); moved = true; }
      }
    }
    if (moved) { const r = HX.resolveCircle(p.x, p.z, 0.38); p.x = r.x; p.z = r.z; H.syncPlayer(); }
  },

  /* ================================================================ input */
  STASH: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'special', 'KeyQ', 'KeyR', 'KeyH'],
  _stashKeys() { const s = []; for (const k of this.STASH) if (Input.keys.has(k)) { s.push(k); Input.keys.delete(k); } this._stash = s; },
  _unstash() { const s = this._stash; this._stash = null; if (s) for (const k of s) Input.keys.add(k); },
  _input(rdt) {
    const P = Input.pressed;
    if (this._tr) { for (const k of ['Tab', 'Digit1', 'Digit2', 'Digit3', 'KeyX']) P.delete(k); return; }
    if (this.wheel.open) { this._wheelInput(rdt); return; }
    if (P.has('KeyX')) { P.delete('KeyX'); if (this.focus.on) this.setFocus(false); else this.setFocus(true); }
    if (P.has('Tab')) { this.openWheel('hold'); return; }
    for (let k = 0; k < 3; k++) if (P.has('Digit' + (k + 1))) { const id = this.IDS[k]; if (id !== this.curId && this.member(id)) this.switchTo(id); break; }
  },
  _wheelInput(rdt) {
    const H = this.H, W = this.wheel, P = Input.pressed;
    if (this._softBlock()) { this.closeWheel(false); return; }
    if (W.mode === 'hold' && !Input.keys.has('Tab')) { this.closeWheel(true); return; }
    if (W.mode === 'sticky' && (P.has('Tab') || P.has('Enter') || P.has('KeyE') || P.has('Space'))) { this.closeWheel(true); return; }
    // keys: A/W/D (and the arrows) pick the left/top/right slot, S/down = stay; 1/2/3 pick by number
    const slot = this._slotIds();
    let pick;
    if (P.has('KeyA') || P.has('ArrowLeft')) pick = slot[0];
    else if (P.has('KeyW') || P.has('ArrowUp')) pick = slot[1];
    else if (P.has('KeyD') || P.has('ArrowRight')) pick = slot[2];
    else if (P.has('KeyS') || P.has('ArrowDown')) pick = null;
    for (let k = 0; k < 3; k++) if (P.has('Digit' + (k + 1))) pick = this.IDS[k];
    if (pick !== undefined) { W.vx = W.vy = 0; this._wheelSel(pick && this.member(pick) ? pick : null); }
    // mouse: with pointer lock the movement steers a virtual cursor around the disc
    if (document.pointerLockElement && (H.mouse.dx || H.mouse.dy)) {
      W.vx += H.mouse.dx * 0.9; W.vy += H.mouse.dy * 0.9;
      const L = Math.hypot(W.vx, W.vy); if (L > 150) { W.vx *= 150 / L; W.vy *= 150 / L; }
      this._wheelFromVec();
    }
    H.mouse.dx = 0; H.mouse.dy = 0; // the camera doesn't turn while the wheel is up
    P.clear();          // nothing else reacts to keys while choosing...
    this._stashKeys();  // ...and nobody walks or drives off with the movement keys (restored after the frame's update)
  },
  _softBlock() { const H = this.H; return !H.active || H.paused || HHud.cutActive() || (H.state !== 'play' && H.state !== 'interior') || !!this._lock || (H.state === 'play' && HAI.wanted > 0) || !!(H.camOverride && H.camOverride !== this._camFn); },
  _slotIds() { return LANG === 'he' ? ['ido', 'hadar', 'yoav'] : ['yoav', 'hadar', 'ido']; }, // 1-2-3 in reading order
  _wheelFromVec() {
    const W = this.wheel, L = Math.hypot(W.vx, W.vy);
    if (L < 36) return;
    let a = Math.atan2(W.vy, W.vx) * 180 / Math.PI; if (a < 0) a += 360;
    const ids = this._slotIds(); let best = null, bd = 52;
    for (let k = 0; k < 3; k++) { let d = Math.abs(a - this.SLOT_A[k]); if (d > 180) d = 360 - d; if (d < bd) { bd = d; best = ids[k]; } }
    this._wheelSel(best && this.member(best) ? best : null);
  },
  _wheelSel(id) {
    const W = this.wheel; if (W.sel === id) return;
    W.sel = id; if (window.HAudio) HAudio.sfx('ui', { vol: 0.7 });
    this._renderWheel();
  },
  openWheel(mode) {
    if (!this.active || !this.$ || this.wheel.open) return false;
    const why = this._globalBlock();
    if (why) { if (why !== this.BUSY) this._deny(why); return false; }
    if (!this.members.some(m => this._pickable(m))) {
      let o = null; for (const m of this.members) if (m.id !== this.curId) o = o || m;
      this._deny(o ? this._why(o) || t('cr_r_locked') : t('cr_r_locked')); return false;
    }
    const W = this.wheel; W.open = true; W.mode = mode || 'sticky'; W.sel = null; W.vx = W.vy = 0;
    this._layoutWheel(); this._renderWheel(true);
    const el = this.$.wheel; clearTimeout(this._whT); el.hidden = false; void el.offsetWidth; el.classList.add('cr-open');
    if (window.HAudio) HAudio.sfx('whoosh', { intensity: 0.25, duration: 0.25, vol: 0.45 });
    HHud.prompt();
    return true;
  },
  closeWheel(confirm) {
    const W = this.wheel; if (!W.open) return;
    const sel = W.sel; this._hideWheel();
    if (confirm && sel && sel !== this.curId) this.switchTo(sel);
  },
  _hideWheel() {
    const W = this.wheel; W.open = false; W.mode = null;
    if (this.$ && this.$.wheel) { const el = this.$.wheel; el.classList.remove('cr-open'); clearTimeout(this._whT); this._whT = setTimeout(() => { if (!this.wheel.open && this.$ && this.$.wheel === el) el.hidden = true; }, 180); }
  },
  _bind() {
    this._onKey = (e) => {
      if (!this.active || !this.H || !this.H.active) return;
      if (e.code === 'Tab') { if (!this.H.paused && !HHud.cutActive() && !document.getElementById('hresults')) e.preventDefault(); return; } // Tab is the crew wheel, not browser focus
      if (this.wheel.open && (e.code === 'Escape' || e.code === 'KeyP')) { e.preventDefault(); e.stopImmediatePropagation(); if (e.code === 'Escape') this.closeWheel(false); } // Esc cancels the wheel instead of pausing
    };
    this._onBlur = () => { if (this.wheel.open) this.closeWheel(false); };
    this._onPtr = (e) => {
      if (!this.wheel.open || document.pointerLockElement || e.pointerType === 'touch' || !this.$) return;
      const r = this.$.disc.getBoundingClientRect(); if (!r.width) return;
      const k = 460 / r.width, W = this.wheel; W.vx = (e.clientX - (r.left + r.width / 2)) * k; W.vy = (e.clientY - (r.top + r.height / 2)) * k;
      if (Math.hypot(W.vx, W.vy) < 36) this._wheelSel(null); else this._wheelFromVec();
    };
    window.addEventListener('keydown', this._onKey, true);
    window.addEventListener('blur', this._onBlur);
    window.addEventListener('pointermove', this._onPtr);
  },
  _unbind() {
    if (this._onKey) window.removeEventListener('keydown', this._onKey, true);
    if (this._onBlur) window.removeEventListener('blur', this._onBlur);
    if (this._onPtr) window.removeEventListener('pointermove', this._onPtr);
    this._onKey = this._onBlur = this._onPtr = null;
    clearTimeout(this._whT);
  },

  /* ================================================================ grade / time (shared seams: only touched while ours) */
  _fx(rdt) {
    const W = this.wheel, F = this.focus, T = this._tr, H = this.H;
    W.k = HX.damp(W.k, W.open ? 1 : 0, W.open ? 16 : 20, rdt); if (!W.open && W.k < 0.01) W.k = 0;
    F.k = HX.damp(F.k, F.on ? 1 : 0, F.on ? 7 : 5, rdt); if (!F.on && F.k < 0.01) F.k = 0;
    let ts = 1, d = 0, tint = this.COOL;
    if (W.k > 0) { ts = Math.min(ts, 1 - 0.8 * W.k); d = 0.6 * W.k; }
    if (F.k > 0) { ts = Math.min(ts, 1 - 0.5 * F.k); if (0.34 * F.k > d) { d = 0.34 * F.k; tint = this.WARM; } }
    if (T && T.ds > d) { d = T.ds; tint = this.COOL; }
    // the time scale: wheel 0.2, Focus 0.5 (if another module changed it meanwhile, it's theirs)
    if (ts < 0.999) { if (this._ts === null || H.timeScale === this._ts) { H.timeScale = ts; this._ts = ts; } }
    else if (this._ts !== null) { if (H.timeScale === this._ts) H.timeScale = 1; this._ts = null; }
    // the grade: Heist's post pass when there is one, else a CSS filter on the canvas
    if (d > 0.004) {
      if (H.bloom) {
        if (this._dsOwn === null || H.desat === this._dsOwn) { H.desat = d; H.desatTint = tint; this._dsOwn = d; }
        if (this._filter) { H.canvas.style.filter = ''; this._filter = ''; }
      } else if (H.canvas) {
        const q = Math.round(d * 50) / 50, f = `grayscale(${q})` + (tint === this.WARM ? ` sepia(${(q * 0.55).toFixed(2)})` : ` brightness(${(1 - q * 0.15).toFixed(2)}) contrast(1.05)`);
        if (f !== this._filter) { H.canvas.style.filter = f; this._filter = f; }
      }
    } else {
      if (this._dsOwn !== null) { if (H.desat === this._dsOwn) { H.desat = 0; H.desatTint = [1, 1, 1]; } this._dsOwn = null; }
      if (this._filter) { if (H.canvas) H.canvas.style.filter = ''; this._filter = ''; }
    }
  },
  _flash(a, col) { this._fl = Math.max(this._fl || 0, a); this._flCol = col || '#fff'; },

  /* ================================================================ HUD: crew strip, wheel, sky card, focus */
  CSS: `
  #cr-ui { position:absolute; inset:0; pointer-events:none; z-index:3; }
  #cr-ui button { font-family: var(--body); color:#fff; -webkit-tap-highlight-color: transparent; outline:none; }
  #cr-ui .cr-face { position:absolute; inset:0; border-radius:50%; background:#1a1d26 url(assets/crew_faces.jpg) var(--fx, 0%) 0% / 300% 100% no-repeat; }
  /* --- the crew strip: top centre on desktop, beside the radar on phones --- */
  #cr-ui .cr-strip { position:absolute; top:12px; left:50%; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:8px; transition: opacity .35s; }
  #cr-ui .cr-strip.cr-off { opacity:0; }
  #cr-ui .cr-strip.cr-off .cr-chip { pointer-events:none; }
  #cr-ui .cr-row { display:flex; align-items:center; gap:10px; }
  #cr-ui .cr-tabk { font:800 11px/1 var(--body); letter-spacing:1px; color:rgba(255,255,255,.85); border:1px solid rgba(255,255,255,.4); border-bottom-width:3px; border-radius:6px; padding:5px 7px 4px; background:rgba(8,6,18,.55); }
  #hhud.touch #cr-ui .cr-tabk { display:none; }
  #cr-ui .cr-chip { pointer-events:auto; position:relative; width:46px; height:46px; padding:0; border-radius:50%; border:2px solid rgba(255,255,255,.45); background:#111; cursor:pointer; opacity:.8; box-shadow:0 3px 10px rgba(0,0,0,.55); transition: width .25s cubic-bezier(.2,1.4,.4,1), height .25s cubic-bezier(.2,1.4,.4,1), opacity .25s, border-color .25s, box-shadow .25s; }
  #cr-ui .cr-chip .cr-face { inset:1px; }
  #cr-ui .cr-chip:hover { opacity:1; }
  #cr-ui .cr-chip.cr-cur { width:64px; height:64px; opacity:1; border:3px solid var(--ac); box-shadow:0 0 0 3px rgba(0,0,0,.5), 0 0 22px var(--ac); }
  #cr-ui .cr-chip.cr-lk .cr-face { filter: grayscale(1) brightness(.55); }
  #cr-ui .cr-chip.cr-lk::after { content:''; position:absolute; right:-4px; top:-4px; width:17px; height:17px; border-radius:50%; background:#2a2d38 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='4' y='7' width='8' height='6' rx='1' fill='%23fff'/%3E%3Cpath d='M5.5 7V5.5a2.5 2.5 0 015 0V7' stroke='%23fff' stroke-width='1.6' fill='none'/%3E%3C/svg%3E") center/12px no-repeat; border:1px solid rgba(255,255,255,.5); }
  #cr-ui .cr-chip .cr-num { position:absolute; left:50%; bottom:-8px; transform:translateX(-50%); font:800 11px/1 var(--body); background:#0d0b16; color:#fff; border:1px solid rgba(255,255,255,.45); border-radius:5px; padding:2px 5px; }
  #cr-ui .cr-chip.cr-cur .cr-num { display:none; }
  #hhud.touch #cr-ui .cr-chip .cr-num { display:none; }
  #cr-ui .cr-chip svg { position:absolute; left:-8px; top:-8px; width:calc(100% + 16px); height:calc(100% + 16px); transform:rotate(-90deg); display:none; overflow:visible; }
  #cr-ui .cr-chip.cr-meter svg { display:block; }
  #cr-ui .cr-chip svg circle { fill:none; stroke-width:4.5; }
  #cr-ui .cr-chip svg .bg { stroke:rgba(0,0,0,.5); }
  #cr-ui .cr-chip svg .fg { stroke:#ffb347; stroke-linecap:round; stroke-dasharray:100 100; }
  #cr-ui .cr-chip.cr-focus svg .fg { stroke:#ffd23f; filter: drop-shadow(0 0 4px #ff9d00); }
  #cr-ui .cr-ab { display:flex; align-items:center; gap:8px; padding:4px 12px 4px 6px; border-radius:999px; background:rgba(8,6,18,.62); border:1px solid rgba(255,255,255,.14); font:700 14px/1 var(--body); white-space:nowrap; opacity:0; transform:translateY(-4px); transition: opacity .35s, transform .35s; }
  #cr-ui .cr-ab:not(.cr-meter) { padding:5px 12px; }
  #cr-ui .cr-ab.cr-show { opacity:1; transform:none; }
  #cr-ui .cr-ab kbd { font:900 12px/1 var(--body); background:var(--ac, #fff); color:#111; border-radius:5px; padding:3px 6px; }
  #cr-ui .cr-ab .cr-abt { color:var(--ac, #fff); text-shadow:0 1px 2px #000; }
  #cr-ui .cr-ab .cr-abbar { width:74px; height:6px; border-radius:3px; background:rgba(255,255,255,.16); overflow:hidden; display:none; }
  #cr-ui .cr-ab.cr-meter .cr-abbar { display:block; }
  #cr-ui .cr-ab .cr-abbar i { display:block; height:100%; width:100%; background:linear-gradient(90deg,#ff8a1f,#ffd23f); transform-origin:left center; }
  [dir="rtl"] #cr-ui .cr-ab .cr-abbar i { transform-origin:right center; }
  #hhud.touch #cr-ui .cr-ab kbd { display:none; }
  #hhud.touch #cr-ui .cr-strip { top:10px; left:calc(640px + 105px * (.35 + .4 * var(--u)) + 26px); transform:scale(min(var(--u), 1.25)); transform-origin:top left; align-items:flex-start; }
  [dir="rtl"] #hhud.touch #cr-ui .cr-strip { left:auto; right:calc(640px + 105px * (.35 + .4 * var(--u)) + 26px); transform-origin:top right; align-items:flex-end; }
  #hhud.touch #cr-ui .cr-strip.cr-mid, [dir="rtl"] #hhud.touch #cr-ui .cr-strip.cr-mid { left:50%; right:auto; transform:translateX(-50%) scale(min(var(--u), 1.25)); transform-origin:top center; align-items:center; }
  /* --- the wheel --- */
  #cr-ui .cr-wheel { position:absolute; inset:0; opacity:0; transition: opacity .16s ease-out; }
  #cr-ui .cr-wheel.cr-open { opacity:1; }
  #cr-ui .cr-wbg { position:absolute; inset:0; width:100%; height:100%; margin:0; padding:0; border:0; border-radius:0; pointer-events:auto; cursor:default;
    background: radial-gradient(ellipse 60% 70% at 50% 50%, rgba(6,8,18,.18) 0%, rgba(6,8,18,.5) 55%, rgba(2,3,10,.82) 100%); }
  #cr-ui .cr-disc { position:absolute; left:50%; top:50%; width:460px; height:460px; margin:-238px 0 0 -230px; transform:scale(calc(var(--ws, 1) * .86)); transition: transform .22s cubic-bezier(.2,1.35,.4,1); }
  #cr-ui .cr-wheel.cr-open .cr-disc { transform:scale(var(--ws, 1)); }
  #cr-ui .cr-ring { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
  #cr-ui .cr-rbg { fill:rgba(9,11,22,.76); stroke:rgba(255,255,255,.18); stroke-width:1.5; }
  #cr-ui .cr-tick { stroke:rgba(255,255,255,.2); stroke-width:2; }
  #cr-ui .cr-sec { fill:rgba(255,255,255,.035); stroke:rgba(255,255,255,.12); stroke-width:1.5; transition: fill .14s, fill-opacity .14s; }
  #cr-ui .cr-sec.cr-sel { fill:var(--ac); fill-opacity:.8; stroke:rgba(255,255,255,.75); }
  #cr-ui .cr-sec.cr-lk { fill:url(#cr-hatch); }
  #cr-ui .cr-sec.cr-lk.cr-sel { fill:#ff5a5a; fill-opacity:.3; }
  #cr-ui .cr-arc { fill:none; stroke-width:5; stroke-linecap:round; stroke:var(--ac); opacity:0; transition: opacity .14s; }
  #cr-ui .cr-arc.cr-sel { opacity:1; filter: drop-shadow(0 0 6px var(--ac)); }
  #cr-ui .cr-slot { position:absolute; width:104px; height:104px; margin:-52px 0 0 -52px; padding:0; border-radius:50%; border:4px solid rgba(255,255,255,.55); background:#111; pointer-events:auto; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,.6); transition: transform .16s cubic-bezier(.2,1.4,.4,1), border-color .16s, box-shadow .16s; }
  #cr-ui .cr-slot.cr-sel { transform:scale(1.14); border-color:#fff; box-shadow:0 0 0 4px var(--ac), 0 0 34px var(--ac); }
  #cr-ui .cr-slot.cr-lk .cr-face { filter: grayscale(1) brightness(.42); }
  #cr-ui .cr-slot.cr-lk::before { content:''; position:absolute; left:50%; top:46%; width:38px; height:38px; margin:-19px 0 0 -19px; z-index:1; background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect x='3.5' y='7' width='9' height='7' rx='1.2' fill='%23fff'/%3E%3Cpath d='M5.3 7V5.2a2.7 2.7 0 015.4 0V7' stroke='%23fff' stroke-width='1.7' fill='none'/%3E%3C/svg%3E") center/contain no-repeat; opacity:.92; }
  #cr-ui .cr-slot .cr-num { position:absolute; left:-7px; top:-7px; z-index:2; font:900 13px/1 var(--body); color:#111; background:#fff; border-radius:6px; padding:4px 6px; box-shadow:0 2px 0 rgba(0,0,0,.5); }
  #cr-ui .cr-slot.cr-sel .cr-num { background:var(--ac); }
  #hhud.touch #cr-ui .cr-slot .cr-num { display:none; }
  #cr-ui .cr-slot .cr-sn { position:absolute; left:50%; bottom:-15px; transform:translateX(-50%); z-index:2; font:400 21px/1 'Bebas Neue','Secular One',sans-serif; letter-spacing:1px; color:#fff; background:rgba(8,9,18,.94); border:2px solid var(--ac); border-radius:999px; padding:4px 12px 3px; white-space:nowrap; box-shadow:0 3px 8px rgba(0,0,0,.5); }
  #cr-ui .cr-slot.cr-sel .cr-sn { background:var(--ac); color:#111; border-color:#fff; }
  #cr-ui .cr-slot .cr-now { position:absolute; right:-10px; top:-4px; z-index:2; font:900 10px/1 var(--body); letter-spacing:1px; color:#111; background:#fff; border-radius:999px; padding:3px 7px; display:none; box-shadow:0 2px 0 rgba(0,0,0,.45); }
  #cr-ui .cr-slot.cr-cur .cr-now { display:block; }
  #cr-ui .cr-ttl { position:absolute; left:0; right:0; top:196px; text-align:center; font:400 17px/1 'Bebas Neue','Secular One',sans-serif; letter-spacing:5px; color:rgba(255,255,255,.42); }
  #cr-ui .cr-hub { position:absolute; left:50%; top:262px; width:310px; margin-left:-155px; text-align:center; --ac:#fff; }
  #cr-ui .cr-hn { font:400 42px/1 'Bebas Neue','Secular One',sans-serif; letter-spacing:1px; color:var(--ac); text-shadow:0 3px 0 #000; white-space:nowrap; }
  #cr-ui .cr-hr { margin-top:4px; font:800 12px/1 var(--body); letter-spacing:3px; color:rgba(255,255,255,.6); text-transform:uppercase; }
  #cr-ui .cr-hs { margin-top:12px; font:700 16px/1.25 var(--body); color:#fff; }
  #cr-ui .cr-ha { margin-top:7px; font:500 14px/1.35 var(--body); color:rgba(255,255,255,.72); }
  #cr-ui .cr-hl { margin-top:8px; font:800 15px/1.25 var(--body); color:#ff8f8f; }
  #cr-ui .cr-whint { position:absolute; left:50%; top:calc(50% + 236px * var(--ws, 1)); transform:translateX(-50%); font:700 15px/1 var(--body); color:rgba(255,255,255,.8); background:rgba(0,0,0,.45); border-radius:999px; padding:7px 16px; white-space:nowrap; }
  #cr-ui .cr-whint:empty { display:none; }
  #cr-ui .cr-whint kbd { font:900 12px/1 var(--body); background:#fff; color:#111; border-radius:5px; padding:2px 6px; margin:0 3px; }
  /* --- the sky cam: HUD out, a framed cool look, the name card --- */
  #hhud.cr-sky > .hh-obj, #hhud.cr-sky > .hh-tr, #hhud.cr-sky > .hh-toasts, #hhud.cr-sky > .hh-prompt, #hhud.cr-sky > .hh-help, #hhud.cr-sky > .hh-speed, #hhud.cr-sky #cr-ui .cr-strip { opacity:0 !important; transition: opacity .25s; }
  #cr-ui .cr-skyfx { position:absolute; inset:0; opacity:0; transition: opacity .3s;
    background: radial-gradient(ellipse 75% 75% at 50% 50%, rgba(0,0,0,0) 55%, rgba(16,40,80,.38) 100%), repeating-linear-gradient(0deg, rgba(255,255,255,.028) 0 1px, rgba(0,0,0,0) 1px 4px); }
  #hhud.cr-sky #cr-ui .cr-skyfx { opacity:1; }
  #cr-ui .cr-skyfx i { position:absolute; width:46px; height:46px; border:3px solid var(--ac, #fff); opacity:.75; }
  #cr-ui .cr-skyfx i:nth-child(1) { left:36px; top:36px; border-right:0; border-bottom:0; }
  #cr-ui .cr-skyfx i:nth-child(2) { right:36px; top:36px; border-left:0; border-bottom:0; }
  #cr-ui .cr-skyfx i:nth-child(3) { left:36px; bottom:36px; border-right:0; border-top:0; }
  #cr-ui .cr-skyfx i:nth-child(4) { right:36px; bottom:36px; border-left:0; border-top:0; }
  #cr-ui .cr-skyfx b { position:absolute; left:50%; top:50%; width:22px; height:22px; margin:-11px 0 0 -11px; border:2px solid rgba(255,255,255,.55); border-radius:50%; }
  #cr-ui .cr-card { position:absolute; left:50%; bottom:58px; display:flex; align-items:center; gap:16px; padding:10px 28px 10px 10px; border-radius:999px; background:linear-gradient(90deg, rgba(8,9,18,.9), rgba(8,9,18,.68)); border:1px solid rgba(255,255,255,.14); box-shadow:0 10px 30px rgba(0,0,0,.5); opacity:0; transform:translate(-50%, 26px) scale(.96); transform-origin:bottom center; transition: opacity .3s, transform .38s cubic-bezier(.2,1.3,.4,1); }
  [dir="rtl"] #cr-ui .cr-card { padding:10px 10px 10px 28px; }
  #cr-ui .cr-card.cr-show { opacity:1; transform:translate(-50%, 0) scale(min(var(--u), 1.3)); }
  #cr-ui .cr-card .cr-cf { position:relative; width:74px; height:74px; border-radius:50%; border:3px solid var(--ac); box-shadow:0 0 18px var(--ac); flex:none; }
  #cr-ui .cr-card b { display:block; font:400 46px/0.95 'Bebas Neue','Secular One',sans-serif; letter-spacing:1px; color:#fff; text-shadow:0 3px 0 #000; white-space:nowrap; }
  #cr-ui .cr-card small { display:block; margin-top:4px; font:800 13px/1 var(--body); letter-spacing:3px; color:var(--ac); text-transform:uppercase; }
  #cr-ui .cr-flash { position:absolute; inset:0; opacity:0; background:#fff; }
  #cr-ui .cr-focusfx { position:absolute; inset:0; opacity:0; transition: opacity .45s;
    background: radial-gradient(ellipse 72% 72% at 50% 50%, rgba(0,0,0,0) 52%, rgba(255,140,30,.22) 82%, rgba(110,40,0,.55) 100%); }
  #cr-ui .cr-focusfx.cr-on { opacity:1; }
  #cr-ui .cr-fbtn { position:absolute; left:1042px; top:452px; width:82px; height:82px; margin:0; padding:0; border-radius:50%; border:0; pointer-events:auto; display:none;
    background: conic-gradient(#ffb347 calc(var(--c, 1) * 1turn), rgba(255,255,255,.18) 0); box-shadow:0 4px 14px rgba(0,0,0,.45); }
  #cr-ui .cr-fbtn.cr-show { display:block; }
  #cr-ui .cr-fbtn span { position:absolute; inset:6px; border-radius:50%; background:rgba(12,10,22,.8); display:flex; align-items:center; justify-content:center; font:900 14px/1 var(--body); letter-spacing:1px; color:#ffd23f; }
  #cr-ui .cr-fbtn.cr-on span { background:#ffb347; color:#2a1400; }
  @media (prefers-reduced-motion: reduce) { #cr-ui .cr-disc, #cr-ui .cr-card, #cr-ui .cr-chip { transition:none; } }
  `,
  _buildUI() {
    if (!HHud.el) return;
    if (!document.getElementById('cr-style')) { const st = document.createElement('style'); st.id = 'cr-style'; st.textContent = this.CSS; document.head.appendChild(st); }
    const root = document.createElement('div'); root.id = 'cr-ui';
    const R0 = 92, R1 = 222, rad = d => d * Math.PI / 180, f = n => n.toFixed(1);
    const sec = (a, half) => { const a0 = rad(a - half), a1 = rad(a + half); return `M${f(R1 * Math.cos(a0))} ${f(R1 * Math.sin(a0))}A${R1} ${R1} 0 0 1 ${f(R1 * Math.cos(a1))} ${f(R1 * Math.sin(a1))}L${f(R0 * Math.cos(a1))} ${f(R0 * Math.sin(a1))}A${R0} ${R0} 0 0 0 ${f(R0 * Math.cos(a0))} ${f(R0 * Math.sin(a0))}Z`; };
    const arc = (a, half) => { const a0 = rad(a - half), a1 = rad(a + half), R = 231; return `M${f(R * Math.cos(a0))} ${f(R * Math.sin(a0))}A${R} ${R} 0 0 1 ${f(R * Math.cos(a1))} ${f(R * Math.sin(a1))}`; };
    let ticks = ''; for (let k = 0; k < 72; k++) { const a = rad(k * 5), l = k % 6 === 0 ? 9 : 4; ticks += `<line class="cr-tick" x1="${f(226 * Math.cos(a))}" y1="${f(226 * Math.sin(a))}" x2="${f((226 - l) * Math.cos(a))}" y2="${f((226 - l) * Math.sin(a))}"/>`; }
    const chips = this.IDS.map((id, k) => `<button class="cr-chip" type="button" tabindex="-1" data-id="${id}" style="--ac:${this.ACCENT[id]}"><i class="cr-face" style="--fx:${this.FACE[id] * 50}%"></i><svg viewBox="0 0 64 64"><circle class="bg" cx="32" cy="32" r="29" pathLength="100"/><circle class="fg" cx="32" cy="32" r="29" pathLength="100"/></svg><b class="cr-num">${k + 1}</b></button>`).join('');
    const slots = this.IDS.map((id, k) => `<button class="cr-slot" type="button" tabindex="-1" data-id="${id}" style="--ac:${this.ACCENT[id]}"><i class="cr-face" style="--fx:${this.FACE[id] * 50}%"></i><b class="cr-num">${k + 1}</b><em class="cr-now"></em><span class="cr-sn"></span></button>`).join('');
    root.innerHTML = `
      <div class="cr-skyfx"><i></i><i></i><i></i><i></i><b></b></div>
      <div class="cr-focusfx"></div>
      <div class="cr-strip off"><div class="cr-row"><span class="cr-tabk">TAB</span>${chips}</div><div class="cr-ab"><kbd>X</kbd><span class="cr-abt"></span><span class="cr-abbar"><i></i></span></div></div>
      <div class="cr-wheel" hidden><button class="cr-wbg" type="button" tabindex="-1" aria-label="close"></button>
        <div class="cr-disc"><svg class="cr-ring" viewBox="-230 -230 460 460">
          <defs><pattern id="cr-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="rgba(255,255,255,.02)"/><rect width="3" height="10" fill="rgba(255,255,255,.07)"/></pattern></defs>
          <circle class="cr-rbg" r="${R1 + 6}"/>${ticks}
          ${this.SLOT_A.map((a, k) => `<path class="cr-sec" data-k="${k}" d="${sec(a, 31)}"/><path class="cr-arc" data-k="${k}" d="${arc(a, 29)}"/>`).join('')}
          </svg>
          <div class="cr-ttl"></div>${slots}
          <div class="cr-hub"><div class="cr-hn"></div><div class="cr-hr"></div><div class="cr-hs"></div><div class="cr-ha"></div><div class="cr-hl"></div></div>
        </div><div class="cr-whint"></div></div>
      <div class="cr-card"><i class="cr-cf"><i class="cr-face"></i></i><div><b></b><small></small></div></div>
      <div class="cr-flash"></div>
      <button class="cr-fbtn" type="button" tabindex="-1"><span></span></button>`;
    HHud.el.appendChild(root);
    const q = s => root.querySelector(s), qa = s => Array.from(root.querySelectorAll(s));
    this.$ = { root, strip: q('.cr-strip'), ab: q('.cr-ab'), abt: q('.cr-abt'), abbar: q('.cr-abbar i'), abk: q('.cr-ab kbd'),
      wheel: q('.cr-wheel'), disc: q('.cr-disc'), bg: q('.cr-wbg'), ttl: q('.cr-ttl'), hub: q('.cr-hub'), hn: q('.cr-hn'), hr: q('.cr-hr'), hs: q('.cr-hs'), ha: q('.cr-ha'), hl: q('.cr-hl'), hint: q('.cr-whint'),
      card: q('.cr-card'), cardF: q('.cr-card .cr-face'), cardB: q('.cr-card b'), cardS: q('.cr-card small'), sky: q('.cr-skyfx'), flash: q('.cr-flash'), ffx: q('.cr-focusfx'), fbtn: q('.cr-fbtn'), fbtnS: q('.cr-fbtn span'),
      chips: {}, slots: {}, secs: qa('.cr-sec'), arcs: qa('.cr-arc') };
    for (const el of qa('.cr-chip')) this.$.chips[el.dataset.id] = el;
    for (const el of qa('.cr-slot')) this.$.slots[el.dataset.id] = el;
    for (const id of this.IDS) if (!this.member(id)) this.$.chips[id].style.display = 'none';
    // pointerdown (not click): works with a second finger on a stick, and Input ignores touches that start on a button
    const tap = (el, fn) => { el.addEventListener('mousedown', e => e.preventDefault()); el.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); e.stopPropagation(); fn(e); }); };
    for (const id in this.$.chips) tap(this.$.chips[id], () => { if (this.wheel.open) this.closeWheel(false); else this.openWheel('sticky'); });
    for (const id in this.$.slots) {
      const el = this.$.slots[id];
      tap(el, () => {
        if (!this.wheel.open) return; const m = this.member(id); if (!m) return;
        if (id === this.curId) { this.closeWheel(false); return; }
        const why = this._why(m); this.wheel.sel = id;
        if (why) { this._renderWheel(); this._deny(why); return; }
        this.closeWheel(true);
      });
      el.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch' && this.wheel.open && this.member(id)) this._wheelSel(id); });
    }
    tap(this.$.bg, () => this.closeWheel(false));
    tap(this.$.fbtn, () => this.toggleFocus());
    this._sig = {}; this._statusT = 0; this._abT = 4.5; this._fl = 0; this._flOn = false;
  },
  _layoutWheel() {
    const $ = this.$, ids = this._slotIds(), R = 152;
    ids.forEach((id, k) => {
      const a = this.SLOT_A[k] * Math.PI / 180, el = $.slots[id], m = this.member(id);
      el.style.left = (230 + R * Math.cos(a)).toFixed(1) + 'px'; el.style.top = (230 + R * Math.sin(a)).toFixed(1) + 'px';
      el.style.display = m ? '' : 'none';
      $.secs[k].dataset.id = id; $.arcs[k].dataset.id = id;
      $.secs[k].style.setProperty('--ac', this.ACCENT[id]); $.arcs[k].style.setProperty('--ac', this.ACCENT[id]);
      $.secs[k].style.display = $.arcs[k].style.display = m ? '' : 'none';
    });
    const touch = !!Input.touchMode, compact = this.H.stage && this.H.stage.classList.contains('compact');
    $.wheel.style.setProperty('--ws', touch || compact ? 'min(var(--u), 1.3)' : '1');
    $.ttl.textContent = t('cr_title');
    if (touch) $.hint.textContent = t('cr_hint_touch');
    else $.hint.innerHTML = this.wheel.mode === 'hold' ? t('cr_hint_keys').replace('Tab', '<kbd>Tab</kbd>').replace('Esc', '<kbd>Esc</kbd>') : t('cr_hint_click').replace('Esc', '<kbd>Esc</kbd>');
  },
  _renderWheel(full) {
    if (!this.$ || (!this.wheel.open && !full)) return;
    const $ = this.$, W = this.wheel, shown = this.member(W.sel) || this.cur();
    for (const m of this.members) {
      const el = $.slots[m.id], why = this._why(m);
      el.classList.toggle('cr-sel', W.sel === m.id); el.classList.toggle('cr-lk', !!why); el.classList.toggle('cr-cur', m.id === this.curId);
      el.querySelector('.cr-now').textContent = t('cr_now'); el.querySelector('.cr-sn').textContent = m.short();
    }
    $.secs.forEach((s, k) => { const m = this.member(s.dataset.id), lk = !!(m && this._why(m)), sel = W.sel === s.dataset.id; s.classList.toggle('cr-sel', sel); s.classList.toggle('cr-lk', lk); $.arcs[k].classList.toggle('cr-sel', sel && !lk); });
    if (shown) {
      $.hub.style.setProperty('--ac', shown.accent);
      $.hn.textContent = shown.name(); $.hr.textContent = shown.role();
      $.hs.textContent = shown.id === this.curId ? t('cr_you') : this._status(shown);
      $.ha.textContent = shown.ability();
      const why = shown.id === this.curId ? null : this._why(shown); $.hl.textContent = why || ''; $.hl.style.display = why ? '' : 'none';
    }
  },
  _status(m) {
    const A = this.cur(), v = m.p.inCar || m.seatCar, q = this._pos(m);
    let st = v ? (m.seat === 'driver' || m.p.inCar ? (Math.abs(v.vF || 0) > 2 ? t('cr_st_drive') : t('cr_st_car')) : t('cr_st_ride')) : t('cr_st_foot');
    const other = A && A !== m, d = other ? this._dist(A, m) : 0;
    st += ' · ' + (other && d < this.NEAR ? t('cr_loc_here') : this._place(q.x, q.z));
    if (other && d >= this.NEAR) st += ' · ' + (d >= 1000 ? t('cr_km', { n: (d / 1000).toFixed(1) }) : t('cr_m', { n: Math.round(d / 10) * 10 }));
    return st;
  },
  _place(x, z) {
    const I = HX.ISLAND;
    if (x > I.x0 - 8) return t('cr_loc_island');
    if (x > HX.BRIDGE_X0 + 14 && Math.abs(z) < 40) return t('cr_loc_bridge');
    if (x > HX.BEACH_X - 6) return t('cr_loc_beach');
    return Math.abs(x) < 150 && Math.abs(z) < 150 ? t('cr_loc_downtown') : t('cr_loc_city');
  },
  _card(m, on) {
    if (!this.$) return;
    const $ = this.$;
    if (on) { $.card.style.setProperty('--ac', m.accent); $.cardF.style.setProperty('--fx', m.face * 50 + '%'); $.cardB.textContent = m.name(); $.cardS.textContent = m.role(); }
    $.card.classList.toggle('cr-show', !!on);
  },
  _hud(rdt) {
    const $ = this.$, H = this.H; if (!$) return;
    const st = H.state, A = this.cur(), W = this.wheel, F = this.focus, touch = !!Input.touchMode;
    // status (locks, pickability) every quarter second; the DOM only when something changed
    this._statusT -= rdt;
    if (this._statusT <= 0) {
      this._statusT = 0.25;
      let n = 0; const global = !!this._lock || (st === 'play' && HAI.wanted > 0);
      for (const m of this.members) { const l = m.id !== this.curId && (global || !!this._why(m)); if (!l && m.id !== this.curId) n++; $.chips[m.id].classList.toggle('cr-lk', l); }
      this._nPick = n;
      if (W.open) this._renderWheel();
    }
    const foreignCam = !!(H.camOverride && H.camOverride !== this._camFn);
    const vis = this.members.length > 1 && !foreignCam && (st === 'play' || st === 'switch' || (st === 'interior' && this._nPick > 0 && !this._lock));
    const radarOff = !!H.camOverride || st === 'interior';
    const sig = (vis ? 1 : 0) + '|' + this.curId + '|' + LANG + '|' + (radarOff ? 1 : 0);
    if (sig !== this._sig.main) {
      this._sig.main = sig;
      $.strip.classList.toggle('cr-off', !vis); $.strip.classList.toggle('cr-mid', radarOff);
      for (const id in $.chips) { const el = $.chips[id], m = this.member(id); el.classList.toggle('cr-cur', id === this.curId); if (m) el.setAttribute('aria-label', m.name()); }
    }
    // the ability line: the member's perk for a few seconds after a switch; Ido's Focus meter while he drives
    this._abT = Math.max(0, (this._abT || 0) - rdt);
    const ido = !!A && A.id === 'ido', meter = ido && (!!A.p.inCar || F.on || F.charge < 1);
    const abShow = vis && !W.open && !!A && (this._abT > 0 || meter);
    const abTxt = A ? (meter ? t('cr_focus') : t('cr_t_' + A.id)) : '';
    const asig = (abShow ? 1 : 0) + abTxt + (meter ? 'm' : '') + (A ? A.id : '');
    if (asig !== this._sig.ab) {
      this._sig.ab = asig; $.ab.classList.toggle('cr-show', abShow); $.ab.classList.toggle('cr-meter', meter);
      $.abt.textContent = abTxt; $.ab.style.setProperty('--ac', meter ? '#ffb347' : A ? A.accent : '#fff');
      $.abk.style.display = meter ? '' : 'none';
    }
    const c = Math.round(F.charge * 100) / 100;
    if (c !== this._sig.c) {
      this._sig.c = c; $.abbar.style.transform = `scaleX(${c})`; $.fbtn.style.setProperty('--c', c);
      const fg = $.chips.ido && $.chips.ido.querySelector('.fg'); if (fg) fg.style.strokeDasharray = `${(c * 100).toFixed(1)} 100`;
    }
    const fsig = (ido ? 1 : 0) + '|' + (F.on ? 1 : 0);
    if (fsig !== this._sig.f) { this._sig.f = fsig; if ($.chips.ido) { $.chips.ido.classList.toggle('cr-meter', ido); $.chips.ido.classList.toggle('cr-focus', F.on); } $.ffx.classList.toggle('cr-on', F.on); $.fbtn.classList.toggle('cr-on', F.on); }
    const fb = touch && ido && !!A.p.inCar && st === 'play' && !H.camOverride && !W.open;
    if (fb !== this._sig.fb) { this._sig.fb = fb; $.fbtn.classList.toggle('cr-show', fb); $.fbtnS.textContent = t('cr_focus'); }
    // the flash
    if (this._fl > 0 || this._flOn) {
      this._fl = Math.max(0, this._fl - rdt * 3.2);
      $.flash.style.background = this._flCol || '#fff'; $.flash.style.opacity = (this._fl * this._fl * 1.6).toFixed(3);
      this._flOn = this._fl > 0;
    }
  },
};
window.HCrew = HCrew;
